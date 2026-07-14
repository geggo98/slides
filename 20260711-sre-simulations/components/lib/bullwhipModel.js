/**
 * bullwhipModel.js — Order-up-to-Lieferkette mit Bullwhip-Verstärkung,
 * extrahiert aus BullwhipSim.vue (Modell verbatim, nur DOM-frei). Wie beim
 * Circuit Breaker (breakerModel.js) herausgezogen, damit die Dynamik
 * deterministisch per vitest prüfbar ist.
 *
 * Kern: K Stufen mit exponentiell geglätteter Prognose (Chen et al. 2000),
 * jede Stufe sieht nur die Bestellungen ihrer Nachbarstufe; +20 %-Nachfrage-
 * Sprung bei Woche STEP_T. Neu: optionaler Preisschock — nach `shockT` senkt
 * jede Stufe ihr Ziel-Lager auf Faktor `coverage < 1` (Reaktion auf leicht
 * höhere Herstellerpreise), fährt ihr Lager herunter → Bestell-Blackout nach
 * oben, bis die stetige Endnachfrage die Kette von unten wieder anschiebt.
 */
import { mulberry32 } from "./rng.js";

export const T = 60, // Horizont [Wochen]
  STEP_T = 15, // Nachfrage-Sprung bei Woche 15
  D0 = 100, // Grundnachfrage [Riegel/Woche]
  D1 = 120, // Nachfrage nach dem Sprung (+20 %)
  SIGMA = 2, // Nachfragerauschen (σ)
  K = 4; // Stufen der Kette
export const O_MAX = 700, // Bestell-Skala [Riegel/Woche]
  I_MIN = 0, // physisches On-hand-Lager ist ≥ 0 (Netto-Bestand < 0 = Rückstand,
  I_MAX = 600; //  wird am Boden als Stockout gezeigt); Peak ~395, ⚙-Extreme → Off-Scale-Notiz
/* Preisschock-Defaults (Szenario 2). Der Schock liegt bewusst dicht hinter dem
   Nachfrage-Sprung (STEP_T=15): der Hersteller bedient noch den Bestell-Peak und
   hebt dann die Preise → hoher Peak, unmittelbar gefolgt von der Flaute. */
export const SHOCK_T = 20, // Preisschock-Woche (kurz nach dem Peak)
  SHOCK_COVERAGE = 0.5; // Ziel-Lager-Faktor nach dem Schock
export const TIER_NAMES = [
  "Lokales Inventar",
  "Zentrallager",
  "DigiKey",
  "Micron",
];

function gauss(r) {
  let u = 0,
    v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Chain {
  /**
   * @param seed  PRNG-Seed
   * @param L     Lieferzeit je Stufe [Wochen]
   * @param alpha Prognose-Reaktionsfreude (EMA)
   * @param share POS-Sharing: alle Stufen sehen die Endnachfrage
   * @param opts  { priceShock, shockT, coverage, K } — priceShock=false ⇒
   *              Verhalten byte-identisch zum Grundszenario (cov=1, `1*x===x`).
   */
  constructor(
    seed,
    L,
    alpha,
    share,
    {
      priceShock = false,
      shockT = SHOCK_T,
      coverage = SHOCK_COVERAGE,
      K: tiers = K,
    } = {},
  ) {
    this.rnd = mulberry32(seed);
    this.L = L;
    this.alpha = alpha;
    this.share = share;
    this.priceShock = priceShock;
    this.shockT = shockT;
    this.coverage = coverage;
    this.K = tiers;
    this.F = Array(tiers).fill(D0);
    this.NI = Array(tiers).fill(D0);
    this.pipe = Array.from({ length: tiers }, () => Array(L).fill(D0));
    this.week = 0;
    this.demand = [];
    this.orders = Array.from({ length: tiers }, () => []);
    this.inv = Array.from({ length: tiers }, () => []);
  }
  step() {
    const t = this.week;
    const dCust = (t < STEP_T ? D0 : D1) + SIGMA * gauss(this.rnd);
    this.demand.push(dCust);
    let d = dCust;
    // Preisschock: Ziel-Lager auf coverage·(L+1)·F absenken → Überbestand wird
    // abgebaut, Bestellungen fallen auf 0, bis IP unter das neue Ziel sinkt.
    const cov = this.priceShock && t >= this.shockT ? this.coverage : 1;
    for (let i = 0; i < this.K; i++) {
      this.NI[i] += this.pipe[i].shift() - d;
      const signal = this.share ? dCust : d;
      this.F[i] += this.alpha * (signal - this.F[i]);
      const IP = this.NI[i] + this.pipe[i].reduce((a, b) => a + b, 0);
      const q = Math.max(0, cov * (this.L + 1) * this.F[i] - IP);
      this.pipe[i].push(q);
      this.orders[i].push(q);
      this.inv[i].push(this.NI[i]);
      d = q;
    }
    this.week++;
  }
  runTo(w) {
    while (this.week < w) this.step();
  }
}
