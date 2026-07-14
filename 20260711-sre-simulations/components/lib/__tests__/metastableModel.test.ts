/**
 * metastableModel.test.ts — pinnt das Fluid-Skelett gegen von Hand
 * abgeleitete Werte und den stochastischen Zwilling gegen gemessene,
 * seed-fixierte Größen (Regressions-Guard gegen Mathe-Drift).
 *
 * Analytik (μ = 100, D = 1, S = 0,15, R = 2):
 *  - Kipppunkt q*: löse att(p) = 1 + p + p² = μ/λ, dann
 *    q* = μ·(1 + S·ln(p/(1−p))).
 *    λ = 70:  p* = (−1+√(1+4·3/7))/2 = 0,32375 → q* = 88,95.
 *    λ = 95:  p* = 0,05012 → q* = 55,87.
 *  - Falte: λ_c = μ / att(pT(0)) mit pT(0) = sig(−1/0,15) = 1,2706·10⁻³
 *    → att = 1,0012722 → λ_c = 99,873.
 *  - Barrieren ΔU = −∫₀^q* drift (Trapez): 1290 (λ=80) · 523 (λ=90) ·
 *    206 (λ=95) — gemessen am Modell, monoton fallend in λ.
 *  - MTTF-Sweep (Seed 12345, 24 Läufe, tMax = 300 s): ρ=0,80 komplett
 *    zensiert; ρ=0,95 → MTTF ≈ 84 s; ρ=1,05 → ≈ 8,5 s; Klippe
 *    (MTTF < 60 s) bei ρ ≈ 0,96 — vor der Falte bei ρ_c = 0,9987.
 */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import {
  MU,
  MttfSweep,
  Q_COLLAPSE,
  TwinSim,
  barrier,
  cliffLambda,
  drift,
  foldLambda,
  potential,
  tippingPoint,
} from "../metastableModel.js";

describe("Fluid-Skelett: Kipppunkt und Falte", () => {
  it("q*(λ=70) ≈ 88,95 — analytisch aus att(p)=μ/λ", () => {
    const qu = tippingPoint(70);
    expect(qu).toBeGreaterThan(88.8);
    expect(qu).toBeLessThan(89.1);
  });
  it("q*(λ=95) ≈ 55,87", () => {
    const qu = tippingPoint(95);
    expect(qu).toBeGreaterThan(55.7);
    expect(qu).toBeLessThan(56.0);
  });
  it("Falte λ_c ≈ 99,873 — Becken existiert knapp darunter, nicht darüber", () => {
    const lc = foldLambda(2);
    expect(lc).toBeGreaterThan(99.86);
    expect(lc).toBeLessThan(99.89);
    expect(tippingPoint(lc - 0.05)).not.toBeNull();
    expect(tippingPoint(lc + 0.05)).toBeNull();
  });
  it("λ·(R+1) ≤ μ ⇒ unbedingt stabil (q* = ∞)", () => {
    expect(tippingPoint(30)).toBe(Infinity);
  });
  it("Drift-Vorzeichen bei λ=70: negativ im Tal, positiv jenseits von q*", () => {
    expect(drift(0, 70)).toBeLessThan(0);
    expect(drift(50, 70)).toBeLessThan(0);
    expect(drift(120, 70)).toBeGreaterThan(0);
  });
});

describe("Potential und Barriere", () => {
  it("U startet bei 0, Maximum liegt am Kipppunkt (λ=90)", () => {
    const { qs, U } = potential(90, 2, 200, 400);
    expect(U[0]).toBe(0);
    let iMax = 0;
    for (let i = 0; i < U.length; i++) if (U[i] > U[iMax]) iMax = i;
    const qu = tippingPoint(90) ?? Infinity;
    expect(Math.abs(qs[iMax] - qu)).toBeLessThan(1.5);
  });
  it("Barriere fällt monoton: ΔU(80)≈1290 > ΔU(90)≈523 > ΔU(95)≈206 > 0", () => {
    const b80 = barrier(80);
    const b90 = barrier(90);
    const b95 = barrier(95);
    expect(b80).toBeGreaterThan(1220);
    expect(b80).toBeLessThan(1360);
    expect(b90).toBeGreaterThan(490);
    expect(b90).toBeLessThan(560);
    expect(b95).toBeGreaterThan(190);
    expect(b95).toBeLessThan(225);
    expect(b80).toBeGreaterThan(b90);
    expect(b90).toBeGreaterThan(b95);
  });
  it("jenseits der Falte ist die Barriere 0", () => {
    expect(barrier(101)).toBe(0);
  });
});

describe("Stochastischer Zwilling (TwinSim)", () => {
  it("gleicher Seed ⇒ identische Trajektorie", () => {
    const a = new TwinSim(4711, 94);
    const b = new TwinSim(4711, 94);
    for (let i = 0; i < 2000; i++) {
      a.step();
      b.step();
    }
    expect(a.q).toBe(b.q);
    expect(a.t).toBeCloseTo(b.t, 9);
  });
  it("q bleibt nichtnegativ (Bedienung ist bei q gedeckelt)", () => {
    const s = new TwinSim(9, 85);
    let min = Infinity;
    for (let i = 0; i < 20000; i++) {
      s.step();
      if (s.q < min) min = s.q;
    }
    expect(min).toBeGreaterThanOrEqual(0);
  });
  it("collapsed() genau ab Q_COLLAPSE", () => {
    const s = new TwinSim(1, 70);
    s.q = Q_COLLAPSE - 1;
    expect(s.collapsed()).toBe(false);
    s.q = Q_COLLAPSE;
    expect(s.collapsed()).toBe(true);
  });
});

describe("MTTF-Sweep (Seed 12345, 24 Läufe, tMax 300 s)", () => {
  const rhos = [
    0.8, 0.825, 0.85, 0.875, 0.9, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05,
  ];
  const sweep = new MttfSweep({
    lambdas: rhos.map((r) => r * MU),
    runs: 24,
    tMax: 300,
    seed: 12345,
  });
  while (!sweep.work(500000)) {
    /* bis fertig */
  }
  it("ρ=0,80: kein einziges Entkommen — komplett zensiert", () => {
    const r = sweep.results[0];
    expect(r.events).toBe(0);
    expect(r.censored).toBe(24);
    expect(r.mttf).toBeNull();
  });
  it("ρ=0,95: MTTF ≈ 84 s — Minuten statt Ewigkeit", () => {
    const r = sweep.results[rhos.indexOf(0.95)];
    expect(r.censored).toBe(0);
    expect(r.mttf).toBeGreaterThan(60);
    expect(r.mttf).toBeLessThan(115);
  });
  it("ρ=1,05 (hinter der Falte): Kollaps in Sekunden", () => {
    const r = sweep.results[rhos.indexOf(1.05)];
    expect(r.censored).toBe(0);
    expect(r.mttf).toBeGreaterThan(5);
    expect(r.mttf).toBeLessThan(13);
  });
  it("Klippe (MTTF < 60 s) bei ρ ≈ 0,96 — deutlich VOR der Falte ρ_c = 0,9987", () => {
    const cliff = cliffLambda(sweep.results, 60, 300);
    expect(cliff / MU).toBeGreaterThan(0.93);
    expect(cliff / MU).toBeLessThan(0.985);
    expect(cliff).toBeLessThan(foldLambda(2));
  });
  it("MTTF fällt monoton über die Klippe (ρ ≥ 0,9)", () => {
    const eff = (r: any) => (r.mttf == null ? 300 : Math.min(r.mttf, 300));
    for (let i = rhos.indexOf(0.9); i < sweep.results.length - 1; i++) {
      expect(eff(sweep.results[i + 1])).toBeLessThanOrEqual(
        eff(sweep.results[i]) + 15,
      );
    }
  });
});

describe("cliffLambda (synthetisch)", () => {
  it("interpoliert linear zwischen den Rasterpunkten", () => {
    const results = [
      { lam: 80, mttf: null, censored: 24 },
      { lam: 90, mttf: 100, censored: 0 },
      { lam: 100, mttf: 20, censored: 0 },
    ];
    // 100 → 20 kreuzt 60 genau in der Mitte: λ = 95
    expect(cliffLambda(results, 60, 300)).toBe(95);
  });
  it("null, wenn die Kurve nie unter die Schwelle fällt", () => {
    const results = [
      { lam: 80, mttf: null, censored: 24 },
      { lam: 90, mttf: 200, censored: 0 },
    ];
    expect(cliffLambda(results, 60, 300)).toBeNull();
  });
});
