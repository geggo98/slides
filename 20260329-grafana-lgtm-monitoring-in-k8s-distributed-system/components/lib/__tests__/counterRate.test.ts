/**
 * counterRate.test.ts — Raten aus Zählern wie Prometheus' rate(x[1m]).
 */
import { describe, expect, it } from "vitest";
import { CounterRate } from "../counterRate";

describe("CounterRate", () => {
  it("liefert den Zuwachs pro Sekunde über das Fenster", () => {
    const r = new CounterRate();
    for (let t = 0; t <= 120; t += 2) r.push(t, { x: t * 3 });
    expect(r.rate("x", 60)).toBeCloseTo(3, 9);
  });

  it("nutzt nur das Fenster, nicht die ganze Historie", () => {
    const r = new CounterRate();
    let c = 0;
    for (let t = 0; t <= 200; t += 1) {
      c += t < 100 ? 1 : 5; // Rate springt bei t=100 von 1 auf 5
      r.push(t, { x: c });
    }
    expect(r.rate("x", 60)).toBeCloseTo(5, 9);
  });

  it("am Anfang zählt der vorhandene Zeitraum", () => {
    const r = new CounterRate();
    r.push(0, { x: 0 });
    r.push(10, { x: 20 });
    expect(r.rate("x", 60)).toBeCloseTo(2, 9);
  });

  it("ohne zwei Stützpunkte keine Rate", () => {
    const r = new CounterRate();
    expect(r.rate("x", 60)).toBeNull();
    r.push(0, { x: 1 });
    expect(r.rate("x", 60)).toBeNull();
  });

  it("ignoriert nicht fortschreitende Zeit (Pause)", () => {
    const r = new CounterRate();
    r.push(0, { x: 0 });
    r.push(10, { x: 10 });
    r.push(10, { x: 99 });
    expect(r.rate("x", 60)).toBeCloseTo(1, 9);
  });
});
