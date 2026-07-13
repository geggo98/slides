/**
 * burnRate.test.ts — verifiziert das Burn-Rate-Modell gegen die analytisch
 * hergeleitete Soll-Tabelle (SRE Workbook, 30-d-SLO 99,9 %):
 * Detektionszeit = θ·W_long/B nach Onset; Budget beim Feuern = θ·W/720 h
 * ⇒ Fast 2 % · Slow 5 % · Ticket 10 % — unabhängig von der Burn-Höhe.
 */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import { buildRun } from "../burnRate.js";

const seg0 = (run: any, key: string) =>
  run.lanes.find((l: any) => l.key === key).segments[0];
const segs = (run: any, key: string) =>
  run.lanes.find((l: any) => l.key === key).segments;

describe("Spike (100 % Fehler für 20 min ab t=10 min)", () => {
  const run = buildRun({ scenario: "spike", seed: 1 });
  it("Fast Page feuert ≈ 52 s nach Onset bei ≈ 98 % Restbudget", () => {
    expect(run.firstAlert).toBe("fast");
    const [t0] = seg0(run, "fast");
    expect(t0 - 600).toBeGreaterThan(45);
    expect(t0 - 600).toBeLessThan(60);
    expect(run.remainingAtFire).toBeGreaterThan(97.3);
    expect(run.remainingAtFire).toBeLessThan(98.5);
  });
  it("Slow Page ≈ 130 s, Ticket ≈ 246 s nach Onset (5 % / 10 % verbraucht)", () => {
    expect(seg0(run, "slow")[0] - 600).toBeCloseTo(129.6, -1);
    // 259,2 err-s nötig; ≈ 12,9 davon liefert die Baseline-Vorgeschichte
    // des 3-d-Fensters → Feuern ≈ 246 s nach Onset.
    expect(seg0(run, "ticket")[0] - 600).toBeGreaterThan(238);
    expect(seg0(run, "ticket")[0] - 600).toBeLessThan(256);
    const evSlow = run.events.find((e: any) => e.key === "slow")!;
    const evTicket = run.events.find((e: any) => e.key === "ticket")!;
    expect(evSlow.remaining).toBeGreaterThan(93.5);
    expect(evSlow.remaining).toBeLessThan(95.8);
    expect(evTicket.remaining).toBeGreaterThan(88.5);
    expect(evTicket.remaining).toBeLessThan(91);
  });
  it("Ende: ≈ 54 % Restbudget; Fast-Page-Nachlauf ≈ 5 min (Kurzfenster!)", () => {
    expect(run.remaining[run.n - 1]).toBeGreaterThan(51);
    expect(run.remaining[run.n - 1]).toBeLessThan(57);
    const [, t1] = seg0(run, "fast");
    expect(t1 - 1800).toBeGreaterThan(240);
    expect(t1 - 1800).toBeLessThan(360);
  });
});

describe("Schleichend (0,3 % = Burn 3× ab t=6 h)", () => {
  const run = buildRun({ scenario: "creep", seed: 1 });
  it("keine Page — nur das Ticket nach ≈ 24 h bei ≈ 90 %", () => {
    expect(segs(run, "fast")).toHaveLength(0);
    expect(segs(run, "slow")).toHaveLength(0);
    expect(run.firstAlert).toBe("ticket");
    const [t0] = seg0(run, "ticket");
    expect((t0 - 21600) / 3600).toBeGreaterThan(22.5);
    expect((t0 - 21600) / 3600).toBeLessThan(25);
    expect(run.remainingAtFire).toBeGreaterThan(89);
    expect(run.remainingAtFire).toBeLessThan(91);
  });
  it("Reichweite: Budget bei Burn 3× in ≈ 7 Tagen (ab Ende) leer", () => {
    expect(run.reachS / 86400).toBeGreaterThan(6);
    expect(run.reachS / 86400).toBeLessThan(8.5);
  });
  it("SLO 99 % statt 99,9 %: dieselbe Störung, totale Stille", () => {
    const lax = buildRun({ scenario: "creep", slo: 0.99, seed: 1 });
    expect(lax.firstAlert).toBe("none");
  });
});

describe("Flattern (2-min-Bursts à 5 % alle 30 min ab t=6 h)", () => {
  const run = buildRun({ scenario: "flap", seed: 1 });
  it("naiver 5-min-Alert feuert ≈ 130-mal, die Policy genau 1 Ticket", () => {
    expect(run.naiveCount).toBeGreaterThan(115);
    expect(run.naiveCount).toBeLessThan(140);
    expect(segs(run, "fast")).toHaveLength(0);
    expect(segs(run, "slow")).toHaveLength(0);
    expect(segs(run, "ticket")).toHaveLength(1);
    expect(run.firstAlert).toBe("ticket");
    expect(run.remainingAtFire).toBeGreaterThan(89);
    expect(run.remainingAtFire).toBeLessThan(91);
  });
  it("Intensität ×2: die Slow Page kommt dazu — wieder bei ≈ 95 %", () => {
    const hot = buildRun({ scenario: "flap", intensity: 2, seed: 1 });
    expect(segs(hot, "slow").length).toBeGreaterThan(0);
    const ev = hot.events.find((e: any) => e.key === "slow")!;
    expect(ev.remaining).toBeGreaterThan(93);
    expect(ev.remaining).toBeLessThan(96.5);
  });
  it("Fast-Fenster 5 min statt 1 h: die Page flattert wie der naive Alert", () => {
    const tight = buildRun({ scenario: "flap", fastWinMin: 5, seed: 1 });
    expect(segs(tight, "fast").length).toBeGreaterThan(50);
  });
});

describe("Invariante: Budget beim Feuern = θ·W/720 h, unabhängig von B", () => {
  it("Spike mit halber Intensität: Fast Page später, aber wieder ≈ 98 %", () => {
    const half = buildRun({ scenario: "spike", intensity: 0.5, seed: 1 });
    const ev = half.events.find((e: any) => e.key === "fast")!;
    expect(ev.remaining).toBeGreaterThan(97.3);
    expect(ev.remaining).toBeLessThan(98.5);
  });
});
