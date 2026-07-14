/**
 * bullwhipModel.test.ts — sichert das Order-up-to-Kettenmodell:
 *  1. Grundszenario byte-identisch (Preisschock aus == Preisschock mit shockT
 *     jenseits des Horizonts, denn cov=1 ⇒ `1*x===x`) + eingefrorene Kennzahlen.
 *  2. Preisschock-Dynamik: mehrwöchiger Bestell-Blackout bei Micron ab shockT,
 *     Blackout wächst stromaufwärts, Erholung der Rate auf ~Nachfrage, dauerhaft
 *     magererer Bestand, Erholung von unten. Endnachfrage bleibt unangetastet.
 *  3. K-Skalierung: die fünfte Stufe verdoppelt die Spitzen-Bestellung.
 * Werte gemessen am Modell (Seed 12345, L=2, α=0,4, share=false).
 */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import { Chain, T } from "../bullwhipModel.js";

const SEED = 12345;
const run = (opts: any = {}) => {
  const c = new Chain(SEED, 2, 0.4, false, opts);
  c.runTo(T);
  return c;
};
const longestZero = (a: number[]) => {
  let best = 0,
    cur = 0;
  for (const x of a) {
    if (x < 1) best = Math.max(best, ++cur);
    else cur = 0;
  }
  return best;
};
const lastZero = (a: number[]) => {
  let last = -1;
  a.forEach((x, i) => {
    if (x < 1) last = i;
  });
  return last;
};
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

describe("Grundszenario (priceShock aus)", () => {
  const base = run({ priceShock: false });
  it("cov=1 ist byte-identisch: Schock jenseits des Horizonts ändert nichts", () => {
    const beyond = run({ priceShock: true, shockT: 1000 });
    expect(beyond.orders).toEqual(base.orders);
    expect(beyond.inv).toEqual(base.inv);
    expect(beyond.demand).toEqual(base.demand);
  });
  it("eingefrorene Kennzahlen (Regressions-Guard gegen Mathe-Drift)", () => {
    const o3 = base.orders[3];
    expect(Math.max(...o3)).toBeGreaterThan(606); // Spitze ~607
    expect(Math.max(...o3)).toBeLessThan(608);
    expect(o3.reduce((a, b) => a + b, 0)).toBeCloseTo(7210.75, 0);
    expect(base.inv[3][T - 1]).toBeCloseTo(179.02, 0);
  });
});

describe("Preisschock: Lagerabbau → Bestell-Blackout", () => {
  const shock = run({ priceShock: true }); // shockT=20, coverage=0.5
  const nom = run({ priceShock: false });

  it("Endnachfrage unangetastet (Predict-first-Invariante)", () => {
    expect(shock.demand).toEqual(nom.demand);
  });
  it("Micron: mehrwöchiger Bestell-Blackout ab dem Schock (W20)", () => {
    expect(shock.orders[3][20]).toBeLessThan(1);
    expect(longestZero(shock.orders[3])).toBeGreaterThanOrEqual(6);
  });
  it("Blackout wächst stromaufwärts: 1/3/5/7 Wochen (unten→oben)", () => {
    const streaks = shock.orders.map((o: number[]) => longestZero(o));
    expect(streaks[0]).toBeLessThanOrEqual(streaks[1]);
    expect(streaks[1]).toBeLessThanOrEqual(streaks[2]);
    expect(streaks[2]).toBeLessThanOrEqual(streaks[3]);
    expect(streaks[0]).toBeLessThanOrEqual(2);
    expect(streaks[3]).toBeGreaterThanOrEqual(6);
  });
  it("Erholung von unten: Lokales Inventar verlässt den Blackout vor Micron", () => {
    expect(lastZero(shock.orders[0])).toBeLessThan(lastZero(shock.orders[3]));
  });
  it("Bestell-Rate erholt sich auf ~Nachfrage (kein Dauer-Null)", () => {
    const late = mean(shock.orders[3].slice(50, 60));
    expect(late).toBeGreaterThan(110);
    expect(late).toBeLessThan(135);
  });
  it("Lagerbestand bleibt dauerhaft magerer (Rückstand am Ende)", () => {
    expect(shock.inv[3][T - 1]).toBeLessThan(0); // ~ -51
    expect(shock.inv[3][T - 1]).toBeGreaterThan(-90);
  });
});

describe("K-Skalierung", () => {
  it("die fünfte Stufe verdoppelt die Spitzen-Bestellung (~2×)", () => {
    const k4 = Math.max(...run({ K: 4 }).orders[3]);
    const k5 = Math.max(...run({ K: 5 }).orders[4]);
    expect(k5 / k4).toBeGreaterThan(1.8);
    expect(k5 / k4).toBeLessThan(2.2);
  });
});
