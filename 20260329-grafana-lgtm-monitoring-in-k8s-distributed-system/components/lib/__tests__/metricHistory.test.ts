/**
 * metricHistory.test.ts — Zeitfenster, Downsampling und Ringpuffer des
 * Zeitreihen-Speichers der Simulator-Dashboards.
 */
import { describe, expect, it } from "vitest";
import { MetricHistory } from "../metricHistory";

function filled(n: number, f: (i: number) => number, cap = 20000) {
  const h = new MetricHistory(["x"], cap);
  for (let i = 0; i < n; i++) h.push(i, { x: f(i) });
  return h;
}

describe("window()", () => {
  it("1m und 5m enden bei der letzten Probe", () => {
    const h = filled(1000, () => 1);
    expect(h.window("1m")).toEqual([939, 999]);
    expect(h.window("5m")).toEqual([699, 999]);
  });

  it("„seit Änderung“ beginnt bei der letzten Annotation", () => {
    const h = filled(1000, () => 1);
    h.annotate(200, "ρ → 0,80");
    h.annotate(750, "ρ → 0,95");
    expect(h.window("since")).toEqual([750, 999]);
  });

  it("„seit Änderung“ ohne Annotation beginnt beim Start", () => {
    expect(filled(10, () => 1).window("since")).toEqual([0, 9]);
  });

  it("„seit Änderung“ direkt nach der Änderung hat Mindestbreite", () => {
    const h = filled(10, () => 1);
    h.annotate(9, "neu");
    expect(h.window("since")).toEqual([9, 10]);
  });
});

describe("series()", () => {
  it("behält eine einzelne Spitze in Min/Max", () => {
    const h = filled(10000, (i) => (i === 5003 ? 99 : 1));
    const s = h.series("x", 0, 9999, 50);
    expect(s).toHaveLength(50);
    expect(Math.max(...s.map((b) => b.max))).toBe(99);
    expect(Math.min(...s.map((b) => b.min))).toBe(1);
  });

  it("Lücken (null, NaN) erfinden keinen Wert", () => {
    const h = new MetricHistory(["x"]);
    h.push(0, { x: 1 });
    h.push(1, { x: null });
    h.push(2, { x: Number.NaN });
    h.push(3, { x: 3 });
    const s = h.series("x", 0, 4, 4);
    expect(s.map((b) => b.avg)).toEqual([1, 3]);
    expect(h.last("x")).toBe(3);
  });

  it("schneidet auf das Fenster zu", () => {
    const h = filled(100, (i) => i);
    const s = h.series("x", 50, 59, 1);
    expect(s[0]).toMatchObject({ min: 50, max: 59 });
  });
});

describe("Konsolidierung (feste Obergrenze)", () => {
  it("bleibt unter der Kapazität und behält den ganzen Zeitraum", () => {
    const h = new MetricHistory(["x"], 100);
    for (let i = 0; i < 10000; i++) h.push(i, { x: i % 7 });
    expect(h.size).toBeLessThanOrEqual(100);
    const s = h.series("x", 0, 9999, 10);
    expect(s).toHaveLength(10); // auch der Anfang ist noch da
  });

  it("behält Spitzen über die Zusammenfassung hinweg", () => {
    const h = new MetricHistory(["x"], 100);
    for (let i = 0; i < 10000; i++) h.push(i, { x: i === 123 ? 99 : 1 });
    const s = h.series("x", 0, 9999, 5);
    expect(s[0]!.max).toBe(99);
    expect(s[0]!.min).toBe(1);
    expect(s[4]!.max).toBe(1);
  });

  it("Auflösung wird gleichmäßig gröber, Extrema und Mittel bleiben", () => {
    const h = new MetricHistory(["x"], 100);
    for (let i = 0; i < 1000; i++) h.push(i, { x: i });
    expect(h.size).toBeGreaterThan(40);
    const all = h.series("x", 0, 999, 1)[0]!;
    expect(all.min).toBe(0);
    expect(all.max).toBe(999);
    expect(all.avg).toBeCloseTo(499.5, -1);
    // Mittel nur näherungsweise: angebrochene Punkte gehen voll gewichtet ein.
    // Zeitstempel bleiben monoton (Binärsuche in series()).
    const ts = h.series("x", 0, 999, 1000).map((b) => b.t);
    expect([...ts].sort((p, q) => p - q)).toEqual(ts);
  });

  it("Lücken überleben die Zusammenfassung als Lücken", () => {
    const h = new MetricHistory(["x", "y"], 8);
    for (let i = 0; i < 40; i++) h.push(i, { x: 1, y: null });
    expect(h.series("y", 0, 40, 4)).toEqual([]);
    expect(h.last("x")).toBe(1);
  });

  it("„seit Änderung“ hängt nicht am Puffer", () => {
    const h = new MetricHistory(["x"], 100);
    h.annotate(3, "alt");
    for (let i = 0; i < 2000; i++) h.push(i, { x: i });
    expect(h.window("since")[0]).toBe(3);
  });

  it("reset() leert Proben und Annotationen", () => {
    const h = filled(10, () => 1);
    h.annotate(5, "x");
    h.reset();
    expect(h.size).toBe(0);
    expect(h.annotations).toEqual([]);
  });
});
