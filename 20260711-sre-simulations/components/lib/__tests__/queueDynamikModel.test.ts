/**
 * queueDynamikModel.test.ts — pinnt die exakte Kette gegen geschlossene
 * Formeln und die didaktischen Kernaussagen der Voll-oder-leer-Sim
 * (Regressions-Guard gegen Mathe-Drift).
 *
 * Analytik (μ = 1, K = 40):
 *  - Preset „0" (b = 0): das MMPP degeneriert (λ_low = λ_high), die
 *    Kette kollabiert marginal auf M/M/1/K → geometrisches
 *    π(n) = (1−ρ)·ρⁿ / (1−ρ^(K+1)) mit ρ = 0,9.
 *  - Verdicts: „0" und „B1" (τ_c = 0,05 ≪ Füllzeit) unimodal;
 *    „B2" (τ_c = 50) und „C" (Feedback r = 0,02) bimodal — die
 *    Kernaussage „Burstiness allein reicht nicht" als Test.
 *  - Barriere n*(C) = (μ − λ̄)/r = (1 − 0,6)/0,02 = 20 exakt.
 *  - MFPT(leer→voll, Preset C) ≈ 6 900 Zeiteinheiten (Kramers-artige
 *    Metastabilität; Wert aus unabhängiger Python-Rechnung der
 *    Original-Sim), monoton fallend in r.
 */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import {
  GillespieSim,
  K,
  PRESETS,
  PRESET_ORDER,
  classify,
  makeParams,
  mfptEmptyToFull,
  nStar,
  solveStationary,
  tvDistance,
  zoneOf,
} from "../queueDynamikModel.js";

const ORDER = PRESET_ORDER as (keyof typeof PRESETS)[];

describe("Exakte stationäre Verteilung", () => {
  it("π summiert zu 1 für alle vier Presets", () => {
    for (const key of ORDER) {
      const pi = solveStationary(makeParams(PRESETS[key]));
      let sum = 0;
      for (const p of pi) sum += p;
      expect(sum).toBeCloseTo(1, 12);
    }
  });
  it("Preset „0” (ρ=0,9): geometrisches M/M/1/K-Profil, Fehler < 1e−9", () => {
    const pi = solveStationary(makeParams(PRESETS["0"]));
    const rho = 0.9;
    const norm = (1 - rho) / (1 - Math.pow(rho, K + 1));
    let maxErr = 0;
    for (let n = 0; n <= K; n++) {
      const exact = norm * Math.pow(rho, n);
      maxErr = Math.max(maxErr, Math.abs(pi[n] - exact));
    }
    expect(maxErr).toBeLessThan(1e-9);
  });
});

describe("Verdicts der vier Szenarien (didaktischer Kern)", () => {
  const verdicts: Record<string, string> = {
    "0": "uni",
    B1: "uni",
    B2: "bi",
    C: "bi",
  };
  for (const key of ORDER) {
    it(`Preset „${key}” → ${verdicts[key]}modal`, () => {
      const { cls } = classify(solveStationary(makeParams(PRESETS[key])));
      expect(cls).toBe(verdicts[key]);
    });
  }
});

describe("Feedback-Kennzahlen (Preset C)", () => {
  const P = makeParams(PRESETS.C);
  it("Barriere n* = (μ−λ̄)/r = 20 exakt", () => {
    expect(nStar(P)).toBeCloseTo(20, 9);
  });
  it("n* ist null ohne Feedback", () => {
    expect(nStar(makeParams(PRESETS["0"]))).toBeNull();
  });
  it("MFPT leer→voll ≈ 6 900 Zeiteinheiten", () => {
    const m = mfptEmptyToFull(P);
    expect(m).toBeGreaterThan(6300);
    expect(m).toBeLessThan(7500);
  });
  it("MFPT fällt monoton in r (mehr Feedback → schnellerer Übertritt)", () => {
    const lo = mfptEmptyToFull(makeParams({ ...PRESETS.C, r: 0.02 }));
    const hi = mfptEmptyToFull(makeParams({ ...PRESETS.C, r: 0.025 }));
    expect(hi).toBeLessThan(lo ?? Infinity);
  });
  it("MFPT ist null ohne Feedback", () => {
    expect(mfptEmptyToFull(makeParams(PRESETS.B2))).toBeNull();
  });
});

describe("Gillespie-Simulation", () => {
  it("gleicher Seed ⇒ identischer Endzustand", () => {
    const P = makeParams(PRESETS.B2);
    const a = new GillespieSim(P, 4711);
    const b = new GillespieSim(P, 4711);
    a.stepTo(500, false);
    b.stepTo(500, false);
    expect(a.n).toBe(b.n);
    expect(a.tsim).toBeCloseTo(b.tsim, 9);
    expect(a.events).toBe(b.events);
    expect(a.events).toBeGreaterThan(0);
  });
  it("empirisches Histogramm konvergiert gegen π (Preset „0”, TV < 0,03)", () => {
    const P = makeParams(PRESETS["0"]);
    const sim = new GillespieSim(P, 12345);
    sim.stepTo(100_000, false);
    const tv = tvDistance(sim.empirical(), solveStationary(P));
    expect(tv).toBeLessThan(0.03);
  });
  it("⚡ Laststoß springt auf n = K und zählt den Übertritt", () => {
    const P = makeParams(PRESETS.C);
    const sim = new GillespieSim(P, 7);
    sim.triggerLoad();
    sim.stepTo(1, false);
    expect(sim.upCross).toBeGreaterThanOrEqual(1);
  });
});

describe("Wartezeit-Zonen", () => {
  it("Grenzen: 0–7 kurz, 8–19 mittel, 20–33 lang, ab 34 Überlast", () => {
    expect(zoneOf(0)).toBe(0);
    expect(zoneOf(7)).toBe(0);
    expect(zoneOf(8)).toBe(1);
    expect(zoneOf(19)).toBe(1);
    expect(zoneOf(20)).toBe(2);
    expect(zoneOf(33)).toBe(2);
    expect(zoneOf(34)).toBe(3);
    expect(zoneOf(K)).toBe(3);
  });
});
