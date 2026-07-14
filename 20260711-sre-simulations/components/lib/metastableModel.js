/**
 * metastableModel.js — deterministisches Skelett + stochastischer Zwilling
 * des Retry-Sturm-Modells, für die MTTF-Klippen-Sim (Making-of).
 *
 * Provenienz: pT (Sigmoid-Soft-Deadline), att (Retry-Verstärkung), MU und DT
 * werden aus breakerModel.js IMPORTIERT — es sind buchstäblich dieselben
 * Gleichungen wie in RetryStormSim/CircuitBreakerSim. Einziger Unterschied:
 * kein Burst-Fenster, kein Shedding. Die Last λ ist konstant; nur das
 * Poisson-Rauschen treibt das System über den Kipppunkt (Freidlin-Wentzell /
 * Kramers: Entkommen aus einem metastabilen Becken).
 *
 * Fluid-Skelett (Mittelwert):   dq/dt = λ·att(pT(q), R) − μ   für q > 0.
 *  - drift(0) < 0 und drift(q→∞) > 0  ⇒ genau ein Kipppunkt q* (Barriere).
 *  - Falte (Sattel-Knoten): λ_c = μ / att(pT(0), R) — darüber existiert
 *    kein stabiles Becken mehr, Kollaps ist deterministisch.
 *  - Potential U(q) = −∫₀^q drift ds: Tal an der Wand q = 0, Kamm bei q*.
 *
 * MTTF-Schätzer: Exponential-MLE mit Zensierung — Gesamt-Simulationszeit
 * geteilt durch Anzahl der Entkommens-Ereignisse. Ohne Ereignis ist nur die
 * Untergrenze „≥ Gesamtzeit" bekannt (censored).
 */
import { mulberry32, pois } from "./rng.js";
import { att, pT, MU, DT } from "./breakerModel.js";

export { att, pT, MU, DT };

export const R_DEFAULT = 2;
// Kollabiert = Queue so tief, dass p(Timeout) > 98 % — Goodput ≈ 0.
export const Q_COLLAPSE = 160;
export const Q_START = 2; // Startwert wie in RetryStormSim (q = 2)

/* ===== Fluid-Skelett ===== */

// dq/dt im Mittelwert-Modell (Bedienung mit voller Rate μ, gilt für q > 0).
export function drift(q, lam, R = R_DEFAULT) {
  return lam * att(pT(q), R) - MU;
}

/**
 * Kipppunkt q*: Nullstelle der Drift (λ·att(pT(q)) ist monoton steigend in q).
 *  - null      ⇒ drift(0) ≥ 0: Falte überschritten, kein Becken mehr.
 *  - Infinity  ⇒ drift bleibt überall negativ (λ·(R+1) ≤ μ): unbedingt stabil.
 */
export function tippingPoint(lam, R = R_DEFAULT, qMax = 600) {
  if (drift(0, lam, R) >= 0) return null;
  if (drift(qMax, lam, R) <= 0) return Infinity;
  let lo = 0;
  let hi = qMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (drift(mid, lam, R) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Sattel-Knoten-Falte: größtes λ mit stabilem Becken. Minimum der
// Verstärkung liegt bei q = 0, also analytisch λ_c = μ / att(pT(0), R).
export function foldLambda(R = R_DEFAULT) {
  return MU / att(pT(0), R);
}

/**
 * Potential U(q) = −∫₀^q drift(s) ds, Trapezregel auf gleichmäßigem Raster.
 * Rückgabe { qs, U }: Tal bei 0 (U = 0), Maximum am Kipppunkt q*.
 */
export function potential(lam, R = R_DEFAULT, qMax = 200, n = 240) {
  const qs = new Float64Array(n + 1);
  const U = new Float64Array(n + 1);
  const dq = qMax / n;
  let acc = 0;
  let prev = -drift(0, lam, R);
  for (let i = 1; i <= n; i++) {
    const q = i * dq;
    const cur = -drift(q, lam, R);
    acc += ((prev + cur) / 2) * dq;
    qs[i] = q;
    U[i] = acc;
    prev = cur;
  }
  return { qs, U };
}

// Barrierenhöhe ΔU = U(q*) — 0 jenseits der Falte, Infinity wenn unbedingt stabil.
export function barrier(lam, R = R_DEFAULT) {
  const qu = tippingPoint(lam, R);
  if (qu == null) return 0;
  if (!isFinite(qu)) return Infinity;
  const { U } = potential(lam, R, qu, 400);
  return U[U.length - 1];
}

/* ===== Stochastischer Zwilling ===== */

/**
 * Identischer Schritt wie RetryStormSim.Sim.step() (Poisson-Ankünfte mit
 * Retry-Verstärkung, Poisson-Bedienung, q ≥ 0) — ohne Burst, ohne Shedding.
 * `lam` ist mutierbar (Live-Regler während des Laufs).
 */
export class TwinSim {
  constructor(seed, lam, R = R_DEFAULT) {
    this.rnd = mulberry32(seed);
    this.lam = lam;
    this.R = R;
    this.t = 0;
    this.q = Q_START;
  }
  step() {
    const p = pT(this.q);
    const arr = pois(this.lam * att(p, this.R) * DT, this.rnd);
    const comp = Math.min(this.q, pois(MU * DT, this.rnd));
    this.q = this.q + arr - comp;
    this.t += DT;
    return p;
  }
  collapsed() {
    return this.q >= Q_COLLAPSE;
  }
}

/* ===== MTTF-Sweep (chunked, damit die UI nicht blockiert) ===== */

/**
 * Für jedes λ des Rasters `runs` unabhängige Zwillings-Läufe, jeder bis zum
 * Kollaps (q ≥ Q_COLLAPSE) oder bis tMax. work(budget) arbeitet höchstens
 * `budget` Sim-Schritte ab und liefert true, wenn der Sweep fertig ist.
 *
 * results[i] = { lam, runs, events, simTime, times[], mttf, censored }
 *  - mttf: Exponential-MLE simTime/events, null solange events = 0.
 *  - censored: Läufe ohne Kollaps (nur Untergrenze bekannt).
 */
export class MttfSweep {
  constructor({ lambdas, runs = 24, tMax = 300, seed = 1, R = R_DEFAULT }) {
    this.lambdas = lambdas;
    this.runs = runs;
    this.tMax = tMax;
    this.seed = seed;
    this.R = R;
    this.results = lambdas.map((lam) => ({
      lam,
      runs,
      events: 0,
      simTime: 0,
      times: [],
      mttf: null,
      censored: 0,
    }));
    this.i = 0; // λ-Index
    this.j = 0; // Lauf-Index
    this.sim = null;
    this.done = false;
  }
  progress() {
    return this.done
      ? 1
      : (this.i * this.runs + this.j) / (this.lambdas.length * this.runs);
  }
  work(budget = 200000) {
    let steps = 0;
    while (steps < budget && !this.done) {
      if (!this.sim) {
        // deterministische Seed-Ableitung pro (λ, Lauf)
        const s = (this.seed + this.i * 7919 + this.j * 104729) >>> 0 || 1;
        this.sim = new TwinSim(s, this.lambdas[this.i], this.R);
      }
      const res = this.results[this.i];
      const sim = this.sim;
      while (steps < budget) {
        sim.step();
        steps++;
        if (sim.collapsed()) {
          res.events++;
          res.times.push(sim.t);
          res.simTime += sim.t;
          this.sim = null;
          break;
        }
        if (sim.t >= this.tMax) {
          res.censored++;
          res.simTime += sim.t;
          this.sim = null;
          break;
        }
      }
      if (this.sim) break; // Budget mitten im Lauf erschöpft
      res.mttf = res.events > 0 ? res.simTime / res.events : null;
      this.j++;
      if (this.j >= this.runs) {
        this.j = 0;
        this.i++;
        if (this.i >= this.lambdas.length) this.done = true;
      }
    }
    return this.done;
  }
}

/**
 * Erste Last (linear interpoliert), bei der die Überlebenszeit unter
 * `threshold` fällt — die „Klippe". Zensierte Punkte gelten als ≥ tMax.
 * null, wenn die Kurve nie unter die Schwelle fällt.
 */
export function cliffLambda(results, threshold, tMax) {
  const eff = (r) => (r.mttf == null ? tMax : Math.min(r.mttf, tMax));
  for (let i = 0; i < results.length; i++) {
    if (eff(results[i]) < threshold) {
      if (i === 0) return results[0].lam;
      const a = results[i - 1];
      const b = results[i];
      const va = eff(a);
      const vb = eff(b);
      const f = va === vb ? 0 : (va - threshold) / (va - vb);
      return a.lam + f * (b.lam - a.lam);
    }
  }
  return null;
}
