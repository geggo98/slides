/**
 * queueDynamikModel.js — M/M/1/K-Kette mit 2-Phasen-MMPP-Bursts und
 * linearem Retry-Feedback λ(n) = λ̄ + r·n. Beantwortet den Publikums-
 * Einwand „eine Queue ist doch immer voll ODER leer": Bimodalität
 * entsteht nicht durch Burstiness an sich, sondern durch lange
 * Korrelationszeiten (τ_c = 1/(2q)) oder Selbstverstärkung (r > 0).
 *
 * Exakte stationäre Verteilung π(n) per Gauß-Elimination auf dem
 * CTMC-Generator (2·(K+1) Zustände: Belegung × Burst-Phase); die
 * Gillespie-Simulation liefert das empirische Histogramm dazu.
 * MFPT leer→voll über den Thomas-Algorithmus (Tridiagonalsystem).
 */
import { mulberry32 } from "./rng.js";

export const MU = 1;
export const K = 40;

/* Szenarien in fester Regie-Reihenfolge; Werte aus der Original-Sim. */
export const PRESETS = {
  0: { rho: 0.9, b: 0.0, q: 1.0, r: 0.0 },
  B1: { rho: 0.9, b: 0.778, q: 10.0, r: 0.0 },
  B2: { rho: 0.9, b: 0.778, q: 0.01, r: 0.0 },
  C: { rho: 0.6, b: 0.0, q: 1.0, r: 0.02 },
};
export const PRESET_ORDER = ["0", "B1", "B2", "C"];

/* Reglerwerte → Modellparameter (λ_low/high symmetrisch um ρ̄·μ). */
export function makeParams({ rho, b, q, r }) {
  const base = rho * MU;
  return { mu: MU, K, lamLow: base * (1 - b), lamHigh: base * (1 + b), q, r };
}

export function arrivalRate(n, phase, P) {
  return (phase === 1 ? P.lamHigh : P.lamLow) + P.r * n;
}

/* Generator Q der CTMC; Zustand s = n·2 + phase, phase 0=niedrig 1=hoch. */
export function buildGenerator(P) {
  const S = 2 * (P.K + 1);
  const Q = Array.from({ length: S }, () => new Float64Array(S));
  const idx = (n, ph) => n * 2 + ph;
  for (let n = 0; n <= P.K; n++) {
    for (let ph = 0; ph < 2; ph++) {
      const s = idx(n, ph);
      if (n < P.K) Q[s][idx(n + 1, ph)] += arrivalRate(n, ph, P);
      if (n > 0) Q[s][idx(n - 1, ph)] += P.mu;
      Q[s][idx(n, 1 - ph)] += P.q;
    }
  }
  for (let s = 0; s < S; s++) {
    let d = 0;
    for (let j = 0; j < S; j++) if (j !== s) d += Q[s][j];
    Q[s][s] = -d;
  }
  return Q;
}

/* πQ = 0, Σπ = 1 — Gauß-Elimination mit Spaltenpivot, marginalisiert
 * über die Phase. Rückgabe: Float64Array π(0..K), normiert. */
export function solveStationary(P) {
  const Q = buildGenerator(P);
  const S = Q.length;
  const A = Array.from({ length: S }, (_, i) => {
    const row = new Float64Array(S);
    for (let j = 0; j < S; j++) row[j] = Q[j][i];
    return row;
  });
  const b = new Float64Array(S);
  for (let j = 0; j < S; j++) A[S - 1][j] = 1;
  b[S - 1] = 1;
  for (let col = 0; col < S; col++) {
    let piv = col;
    let best = Math.abs(A[col][col]);
    for (let r = col + 1; r < S; r++) {
      const v = Math.abs(A[r][col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (piv !== col) {
      const t = A[piv];
      A[piv] = A[col];
      A[col] = t;
      const tb = b[piv];
      b[piv] = b[col];
      b[col] = tb;
    }
    const d = A[col][col];
    for (let r = col + 1; r < S; r++) {
      const f = A[r][col] / d;
      if (!f) continue;
      for (let j = col; j < S; j++) A[r][j] -= f * A[col][j];
      b[r] -= f * b[col];
    }
  }
  const x = new Float64Array(S);
  for (let r = S - 1; r >= 0; r--) {
    let s = b[r];
    for (let j = r + 1; j < S; j++) s -= A[r][j] * x[j];
    x[r] = s / A[r][r];
  }
  const KK = S / 2 - 1;
  const pi = new Float64Array(KK + 1);
  for (let n = 0; n <= KK; n++) pi[n] = x[n * 2] + x[n * 2 + 1];
  let sum = 0;
  for (let n = 0; n <= KK; n++) sum += pi[n];
  for (let n = 0; n <= KK; n++) pi[n] /= sum;
  return pi;
}

/* Moden-Detektion: bimodal = Moden an beiden Rändern (≤3 und ≥K−3). */
export function classify(pi) {
  const KK = pi.length - 1;
  const modes = [];
  for (let i = 0; i <= KK; i++) {
    const l = i > 0 ? pi[i - 1] : -1;
    const rr = i < KK ? pi[i + 1] : -1;
    if (pi[i] >= l && pi[i] >= rr && pi[i] > 2e-4) modes.push(i);
  }
  const bimodal =
    modes.length >= 2 &&
    Math.min(...modes) <= 3 &&
    Math.max(...modes) >= KK - 3;
  if (bimodal) return { cls: "bi", label: "BIMODAL — voll ODER leer", modes };
  let m = 0;
  let mx = -1;
  for (let i = 0; i <= KK; i++) {
    if (pi[i] > mx) {
      mx = pi[i];
      m = i;
    }
  }
  if (m <= KK * 0.25)
    return { cls: "uni", label: "UNIMODAL — meist leer", modes };
  if (m >= KK * 0.75)
    return { cls: "bi", label: "UNIMODAL — meist voll", modes };
  return { cls: "", label: "UNIMODAL — mittig / breit", modes };
}

/* Feedback-Barriere n*: Drift λ̄ + r·n − μ kreuzt Null. */
export function nStar(P) {
  const baseMean = (P.lamLow + P.lamHigh) / 2;
  return P.r > 1e-9 && baseMean < P.mu ? (P.mu - baseMean) / P.r : null;
}

/* Mean First Passage Time 0→K der Geburts-Todes-Kette mit mittlerer
 * Ankunftsrate (Phase herausgemittelt); Thomas-Algorithmus. */
export function mfptEmptyToFull(P) {
  if (P.r <= 1e-9) return null;
  const baseMean = (P.lamLow + P.lamHigh) / 2;
  const N = P.K;
  const b = new Float64Array(N);
  const a = new Float64Array(N);
  const c = new Float64Array(N);
  const d = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const li = baseMean + P.r * i;
    const mi = i > 0 ? P.mu : 0;
    const tot = li + mi;
    b[i] = 1;
    a[i] = i > 0 ? -(mi / tot) : 0;
    c[i] = i < N - 1 ? -(li / tot) : 0;
    d[i] = 1 / tot;
  }
  for (let i = 1; i < N; i++) {
    const m = a[i] / b[i - 1];
    b[i] -= m * c[i - 1];
    d[i] -= m * d[i - 1];
  }
  const h = new Float64Array(N);
  h[N - 1] = d[N - 1] / b[N - 1];
  for (let i = N - 2; i >= 0; i--) h[i] = (d[i] - c[i] * h[i + 1]) / b[i];
  return h[0];
}

/* Total-Variation-Distanz ½·Σ|aᵢ−bᵢ| — Konvergenz = 1 − TV. */
export function tvDistance(a, b) {
  let tv = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) tv += Math.abs(a[i] - b[i]);
  return tv / 2;
}

/* Wartezeit-Zonen (Lesehilfe): kurz | mittel | lang | Überlast. */
export const ZB = [
  0,
  Math.round(0.2 * K),
  Math.round(0.5 * K),
  Math.round(0.85 * K),
  K + 1,
];
export function zoneOf(n) {
  if (n < ZB[1]) return 0;
  if (n < ZB[2]) return 1;
  if (n < ZB[3]) return 2;
  return 3;
}

/**
 * Gillespie-Simulation der Kette — exakte Ereigniszeiten, zeitgewichtete
 * Belegungsstatistik, Trace-Sampling auf festem Gitter fürs Scope.
 */
export const GRID_STEP = 0.4;
export const TRACE_LEN = 520;

export class GillespieSim {
  constructor(P, seed) {
    this.P = P;
    this.reset(seed);
  }
  reset(seed) {
    if (seed !== undefined) this.seed = seed;
    this.rnd = mulberry32(this.seed);
    this.n = 0;
    this.ph = 1;
    this.tsim = 0;
    this.events = 0;
    this.upCross = 0;
    this.wellHigh = false;
    this.zoneVisits = new Int32Array(4);
    this.curZone = -1;
    this.timeAcc = new Float64Array(this.P.K + 1);
    this.totalT = 0;
    this.trace = [];
    this.nextGrid = 0;
  }
  setParams(P) {
    this.P = P;
  }
  /* ⚡ Laststoß: Sprung über die Barriere. */
  triggerLoad() {
    this.n = this.P.K;
    this.ph = 1;
  }
  sampleGrid() {
    while (this.nextGrid <= this.tsim) {
      this.trace.push(this.n);
      if (this.trace.length > TRACE_LEN) this.trace.shift();
      this.nextGrid += GRID_STEP;
    }
  }
  stepTo(target, sampleTrace) {
    const P = this.P;
    let guard = 0;
    while (this.tsim < target && guard++ < 20_000_000) {
      const a = this.n < P.K ? arrivalRate(this.n, this.ph, P) : 0;
      const sv = this.n > 0 ? P.mu : 0;
      const sw = P.q;
      const R = a + sv + sw;
      if (R <= 0) {
        this.tsim = target;
        break;
      }
      const dt = -Math.log(1 - this.rnd()) / R;
      if (this.tsim + dt > target) {
        const d = target - this.tsim;
        this.timeAcc[this.n] += d;
        this.totalT += d;
        this.tsim = target;
        if (sampleTrace) this.sampleGrid();
        break;
      }
      this.timeAcc[this.n] += dt;
      this.totalT += dt;
      this.tsim += dt;
      this.events++;
      if (sampleTrace) this.sampleGrid();
      const u = this.rnd() * R;
      if (u < a) this.n++;
      else if (u < a + sv) this.n--;
      else this.ph = 1 - this.ph;
      if (!this.wellHigh && this.n >= 0.85 * P.K) {
        this.wellHigh = true;
        this.upCross++;
      } else if (this.wellHigh && this.n <= 0.15 * P.K) {
        this.wellHigh = false;
      }
      const z = zoneOf(this.n);
      if (z !== this.curZone) {
        this.zoneVisits[z]++;
        this.curZone = z;
      }
    }
  }
  /* ⏩ Batch ohne Trace; Gitter danach ans Sim-Ende schieben. */
  batch(units) {
    this.stepTo(this.tsim + units, false);
    this.nextGrid = this.tsim;
  }
  empirical() {
    const emp = new Float64Array(this.P.K + 1);
    if (this.totalT > 0)
      for (let i = 0; i <= this.P.K; i++)
        emp[i] = this.timeAcc[i] / this.totalT;
    return emp;
  }
}
