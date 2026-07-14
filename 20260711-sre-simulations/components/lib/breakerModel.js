/**
 * breakerModel.js — Retry-Sturm-Szenario mit zuschaltbarem Circuit Breaker.
 * Modellkern (pT, att, Konstanten, Poisson-Schritt, EMA-Goodput) identisch
 * zu RetryStormSim.vue — bewusst dupliziert statt refactored, damit die
 * verifizierte Sim unangetastet bleibt. Neu: Breaker-FSM Closed → Open →
 * Half-Open (Fehlerraten-EMA kippt, Cooldown-Totzone, Probe-Budget) —
 * gewollte Hysterese als Werkzeug.
 */
import { mulberry32, pois } from "./rng.js";

export const MU = 100; // Service-Kapazität [req/s]
export const LAMBDA0 = 70; // Grundlast [req/s] (ρ = 0,7)
export const D = 1.0; // Client-Deadline/Timeout [s]
export const S_SIG = 0.15; // Sigmoid-Breite
export const DT = 0.05;
export const T_END = 120;
export const B0 = 20; // Burst-Beginn
export const B1 = 30; // Burst-Ende
export const GP_MAX = 120;
export const Q_MAX = 1200;
export const TAU_ERR = 2; // Fehlerraten-EMA [s]
export const HALF_ADMIT = 0.1; // Half-Open: Anteil zugelassener Proben
export const HALF_FAIL = 3; // Probe-Fails → wieder Open
export const HALF_OK = 20; // Probe-OKs → Closed
export const FASTFAIL_LAT = 0.005; // Latenz einer sofort abgewiesenen Anfrage [s]
export const L_BASE = 0.25; // Good-Case-Antwortzeit (Basis-Servicezeit) [s]

const sig = (x) => 1 / (1 + Math.exp(-x));
export const pT = (q) => sig((q / MU - D) / S_SIG);
export const att = (p, R) =>
  R === 0 ? 1 : p > 0.999999 ? R + 1 : (1 - Math.pow(p, R + 1)) / (1 - p);

export class BreakerSim {
  /**
   * @param seed    PRNG-Seed (beide Lanes mit demselben Seed → identische
   *                Ströme bis zur ersten Divergenz)
   * @param amp     Burst-Amplitude
   * @param R       max. Retries
   * @param opts    { enabled, auto, eTrip, tOpen } — enabled=false ⇒ Lane
   *                „ohne Breaker" (verhält sich exakt wie RetryStormSim);
   *                auto=false ⇒ Breaker vorhanden, kippt aber nur per
   *                forceOpen() von Hand (kein automatisches Auslösen).
   */
  constructor(
    seed,
    amp,
    R,
    { enabled = true, auto = true, eTrip = 0.5, tOpen = 5 } = {},
  ) {
    this.rnd = mulberry32(seed);
    this.amp = amp;
    this.R = R;
    this.enabled = enabled;
    this.auto = auto;
    this.eTrip = eTrip;
    this.tOpen = tOpen;
    this.t = 0;
    this.q = 2;
    this.ema = LAMBDA0;
    this.state = "closed"; // closed | open | half
    this.errEMA = 0;
    this.openedAt = -Infinity;
    this.probeOk = 0;
    this.probeFail = 0;
    this.rejected = 0; // fast-failed (billig)
    this.lostTotal = 0; // Σ (angebotene − rechtzeitige) Requests
    this.trips = 0;
    this.pts = []; // {t, q, g, state}
  }
  lam(t) {
    return t >= B0 && t < B1 ? LAMBDA0 * this.amp : LAMBDA0;
  }
  open() {
    this.state = "open";
    this.openedAt = this.t;
    this.trips++;
  }
  /* Operator-Kill-Switch: Breaker sofort öffnen (nur sinnvoll bei enabled). */
  forceOpen() {
    if (this.enabled && this.state === "closed") this.open();
  }
  /* Operator schließt den Breaker von Hand wieder (komplett manuelle
     Bedienung, ohne auf den Cooldown/Half-Open-Zyklus zu warten). */
  forceClose() {
    if (this.enabled && this.state !== "closed") {
      this.state = "closed";
      this.errEMA = 0;
      this.probeOk = 0;
      this.probeFail = 0;
    }
  }
  step() {
    const lamNow = this.lam(this.t);
    const p = pT(this.q);
    let arr = 0;
    if (!this.enabled || this.state === "closed") {
      arr = pois(lamNow * att(p, this.R) * DT, this.rnd);
      if (this.enabled) {
        // Fehlerraten-EMA läuft immer mit (auch bei auto=false), damit ein
        // Zuschalten von „Auto" mitten im Lauf sofort kippen kann.
        this.errEMA += (DT / TAU_ERR) * (p - this.errEMA);
        if (this.auto && this.errEMA > this.eTrip) this.open();
      }
    } else if (this.state === "open") {
      // Basis-Requests werden sofort billig abgewiesen (kein Retry, kein
      // Timeout) — die Queue draint derweil mit voller Kapazität.
      this.rejected += pois(lamNow * DT, this.rnd);
      // Cooldown → Half-Open nur automatisch; von Hand geöffnet (auto=false)
      // bleibt der Breaker offen, bis der Operator ihn wieder schließt.
      if (this.auto && this.t - this.openedAt >= this.tOpen) {
        this.state = "half";
        this.probeOk = 0;
        this.probeFail = 0;
      }
    } else {
      // Half-Open: kleiner Probe-Anteil darf durch, Rest fast-fail.
      const base = pois(lamNow * DT, this.rnd);
      for (let k = 0; k < base; k++) {
        if (this.rnd() < HALF_ADMIT) {
          arr++;
          if (this.rnd() < p) this.probeFail++;
          else this.probeOk++;
        } else {
          this.rejected++;
        }
      }
      if (this.probeFail >= HALF_FAIL) this.open();
      else if (this.probeOk >= HALF_OK) {
        this.state = "closed";
        this.errEMA = 0;
      }
    }
    this.q += arr;
    const comp = Math.min(this.q, pois(MU * DT, this.rnd));
    this.q -= comp;
    const good = comp * (1 - p);
    this.lostTotal += Math.max(0, lamNow * DT - good);
    const g = good / DT;
    this.ema = this.ema + (DT / 0.8) * (g - this.ema);
    this.t += DT;
    // Effektive Downstream-Antwortzeit: Basis-Servicezeit L_BASE plus
    // Queue-Wartezeit, affin auf [L_BASE .. D] skaliert — erreicht den
    // Timeout-Deckel D genau am Timeout-Punkt (q/MU = D) wie zuvor, nur mit
    // sichtbarem Good-Case-Sockel statt ~20 ms. Stiller Timeout = keine
    // Fehlermeldung. Offener Breaker weist sofort ab → billige Fast-Fail-
    // Latenz, klar unter dem Good-Case.
    const wait = Math.min(this.q / MU, D);
    const served = L_BASE + (D - L_BASE) * (wait / D);
    let lat;
    if (this.enabled && this.state === "open") lat = FASTFAIL_LAT;
    else if (this.enabled && this.state === "half")
      lat = HALF_ADMIT * served + (1 - HALF_ADMIT) * FASTFAIL_LAT;
    else lat = served;
    this.pts.push({
      t: this.t,
      q: this.q,
      g: this.ema,
      state: this.state,
      lat,
    });
  }
  runTo(t) {
    while (this.t < t - 1e-9) this.step();
  }
}

/* Recovery-Zeit: erster Zeitpunkt ≥ B0, ab dem der Goodput 4 s lang
   ≥ 80 % der Grundlast hält — null, wenn nie. (80 % statt 90 %: das
   EMA-Rauschen um λ₀ herum würde ein engeres Fenster ständig zurücksetzen.) */
export function recoveryTime(pts) {
  const need = 0.8 * LAMBDA0;
  let start = null;
  for (const p of pts) {
    if (p.t < B0) continue;
    if (p.g >= need) {
      if (start == null) start = p.t;
      if (p.t - start >= 4) return start;
    } else {
      start = null;
    }
  }
  return null;
}
