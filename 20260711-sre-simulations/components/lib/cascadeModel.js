/**
 * cascadeModel.js — Modellkern der Health-Check-Spirale (Predict first).
 * N Instanzen hinter einem LB; Health-Check misst die Wartezeit, die er
 * durch seine eigenen Auswürfe mit verursacht (Lastumverteilung auf den
 * Rest). Modellkern-Stil identisch zu RetryStormSim.vue (Poisson-Schritte,
 * Sigmoid-Deadline, EMA-Goodput), eine Ebene höher angesiedelt.
 */
import { mulberry32, pois } from "./rng.js";

export const MU = 100; // req/s je Instanz
export const RHO = 0.7; // Grundauslastung → Λ = RHO · N · MU
export const T_HC = 0.4; // Probe-Timeout [s]
export const E_BASE = 5; // Basis-Auswurfzeit [s] — wächst ×Auswurf-Zähler (Envoy)
export const DEADLINE = 1.0; // Client-Deadline [s]
export const S_SIG = 0.15; // Sigmoid-Breite (wie RetryStorm)
export const B0 = 20; // Störung beginnt
export const D_SLOW = 15; // Störungsdauer [s]
export const SLOW_FACTOR = 0.4; // gestörte Instanzen: Kapazität ×0,4
export const DT = 0.05;
export const T_END = 120;
export const PANIC_FRAC = 0.5; // Envoy-Panic: < 50 % healthy → an ALLE routen
export const H_AX = 10; // feste y-Achse 0…10 Instanzen

const sig = (x) => 1 / (1 + Math.exp(-x));

export class CascadeSim {
  /**
   * @param seed  PRNG-Seed
   * @param N     Instanzen gesamt
   * @param m     davon gestört (die ersten m)
   * @param F     Probe-Fails in Folge → Auswurf
   * @param P     Probe-Intervall [s]
   */
  constructor(seed, N, m, F, P) {
    this.rnd = mulberry32(seed);
    this.N = N;
    this.m = m;
    this.F = F;
    this.P = P;
    this.lambda = RHO * N * MU;
    this.t = 0;
    this.q = new Array(N).fill(0);
    this.inRot = new Array(N).fill(true);
    this.fails = new Array(N).fill(0);
    // Envoy-Outlier-Ejection: Auswurf Nr. k hält k·E_BASE Sekunden —
    // wiederholte Auswürfe parken immer mehr Kapazität außerhalb der
    // Rotation. Genau dieses Backoff macht die Spirale selbsterhaltend.
    this.ejCount = new Array(N).fill(0);
    this.ejUntil = new Array(N).fill(0);
    // Gestaffelte Proben, sonst würfeln alle Instanzen synchron.
    this.nextProbe = Array.from({ length: N }, (_, i) => (i / N) * P);
    this.panicAt = Infinity;
    this.ema = this.lambda;
    this.lost = 0;
    this.lowSec = 0; // Sekunden mit Goodput < 50 %
    this.minH = N;
    this.pts = []; // {t, h, g, panic}
  }

  disturbed() {
    return this.t >= B0 && this.t < B0 + D_SLOW;
  }
  capOf(i) {
    return MU * (i < this.m && this.disturbed() ? SLOW_FACTOR : 1);
  }

  step() {
    const N = this.N;
    const rot = [];
    for (let i = 0; i < N; i++) if (this.inRot[i]) rot.push(i);
    const panicActive = this.t >= this.panicAt && rot.length < N * PANIC_FRAC;
    // Panic-Mode (Fail-Open): Health-Status ignorieren, an alle N routen.
    const route = panicActive ? Array.from({ length: N }, (_, i) => i) : rot;

    // Ankünfte: LB verteilt gleichmäßig über die Route-Menge.
    if (route.length > 0) {
      const per = (this.lambda / route.length) * DT;
      for (const i of route) this.q[i] += pois(per, this.rnd);
    }

    // Bedienung: auch ausgeworfene Instanzen drainen weiter (Rückkehr-Pfad).
    let good = 0;
    for (let i = 0; i < N; i++) {
      const cap = this.capOf(i);
      const comp = Math.min(this.q[i], pois(cap * DT, this.rnd));
      this.q[i] -= comp;
      const w = this.q[i] / cap;
      good += comp * (1 - sig((w - DEADLINE) / S_SIG));
    }
    if (route.length === 0) this.lost += this.lambda * DT;
    else this.lost += Math.max(0, this.lambda * DT - good);

    // Proben: fail ⇔ aktuelle Wartezeit > Timeout. F Fails in Folge → raus
    // für ejCount·E_BASE Sekunden; Rückkehr erst nach Ablauf UND gesundem w.
    for (let i = 0; i < N; i++) {
      while (this.nextProbe[i] <= this.t) {
        const w = this.q[i] / this.capOf(i);
        if (this.inRot[i]) {
          if (w > T_HC) {
            this.fails[i]++;
            if (this.fails[i] >= this.F) {
              this.inRot[i] = false;
              this.ejCount[i]++;
              this.ejUntil[i] = this.t + this.ejCount[i] * E_BASE;
              this.fails[i] = 0;
            }
          } else {
            this.fails[i] = 0;
          }
        } else if (this.t >= this.ejUntil[i] && w <= T_HC) {
          this.inRot[i] = true;
        }
        this.nextProbe[i] += this.P;
      }
    }

    const gRate = good / DT;
    this.ema = this.ema + (DT / 0.8) * (gRate - this.ema);
    this.t += DT;
    let h = 0;
    for (let i = 0; i < N; i++) if (this.inRot[i]) h++;
    if (h < this.minH) this.minH = h;
    const gPct = Math.max(0, (this.ema / this.lambda) * 100);
    if (gPct < 50) this.lowSec += DT;
    this.pts.push({ t: this.t, h, g: gPct, panic: panicActive });
  }
  runTo(t) {
    while (this.t < t - 1e-9) this.step();
  }
}
