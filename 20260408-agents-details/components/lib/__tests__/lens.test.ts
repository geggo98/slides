import { describe, expect, it } from "vitest";
import { collisions, squareAt } from "../../labelLayout";
import {
  DODGE,
  HISTORY_SCALE,
  LENS,
  lensView,
  MARKER,
  plotBounds,
} from "../../paretoChrome";
import {
  ASTRA_LENS,
  ASTRA_LENS_TODAY,
  ASTRA_TODAY,
  CURRENT,
  CURRENT_ASTRA_TODAY,
  EFFORT_ORDER,
  EFFORTS,
  SNAPSHOTS,
} from "../../paretoData";

// Die Lupe war bis 22.09.2026 der neunte Klick der Historie, seither eine
// eigene Folie (`EffortFalle.vue`, routeAlias `effort-falle`) mit den
// aktualisierten astra-Preisen (`ASTRA_LENS_TODAY`, eigener Test unten). Sie
// soll das Publikum vor einer teuren Fehlkonfiguration bewahren. Was sie
// behauptet, muss aus der Effort-Tabelle folgen, und ihr Panel muss lesbar
// sein — beides prüft dieser Block weiterhin an `ASTRA_LENS`, der Stand vom
// 03.09.2026, an dem `EFFORTS`/`CURRENT` hängen. Kein Snapshot trägt sie mehr
// (die Zuweisung ist mit dem Umzug entfallen), deshalb wird sie hier direkt
// importiert statt über `SNAPSHOTS` gesucht.

describe("Lupe: die Effort-Falle", () => {
  const view = lensView(ASTRA_LENS, CURRENT, HISTORY_SCALE);

  it("hängt an keinem Snapshot mehr und ist aus EFFORTS abgeleitet", () => {
    expect(SNAPSHOTS.every((s) => !s.lens)).toBe(true);
    expect(ASTRA_LENS.ladder.map((c) => c.effort)).toStrictEqual([
      ...EFFORT_ORDER,
    ]);
    for (const c of ASTRA_LENS.ladder) expect(EFFORTS).toContain(c);
  });

  it("zeigt die Falle: high und max gleicher Score, max mehr als doppelt so teuer", () => {
    const by = (e: string) => ASTRA_LENS.ladder.find((c) => c.effort === e)!;
    expect(by("max").y).toBe(by("high").y);
    expect(by("max").x / by("high").x).toBeGreaterThan(2);
    const best = [...ASTRA_LENS.ladder].sort((a, b) => b.y - a.y)[0]!;
    expect(best.effort).toBe("xhigh");
    // Die geplottete Stufe ist die beste, nicht die höchste.
    expect(
      view.ladder.filter((l) => l.shown).map((l) => l.c.effort),
    ).toStrictEqual(["xhigh"]);
    expect(view.bracket?.text).toBe("×2,2 Preis, gleicher Score");
  });

  it("beschriftet alle fünf Stufen ohne Überschneidung", () => {
    expect([...view.labels.keys()].sort()).toStrictEqual(
      [...EFFORT_ORDER].sort(),
    );
    const blocks = [
      ...view.obstacles,
      ...view.ladder.map((l) => squareAt(l, LENS.hitR, l.c.effort)),
    ];
    expect(
      collisions(view.labels.values(), blocks, plotBounds(view.scale)),
    ).toStrictEqual([]);
  });

  it("lässt die Leiter an der wahren Lage und hält die Nachbarn fern", () => {
    // Die Leiter steht fest: jede Stufe exakt auf ihrem Wert der Panel-Skala.
    for (const l of view.ladder) {
      expect(l.px, l.c.effort).toBeCloseTo(view.scale.px(l.c.x), 9);
      expect(l.py, l.c.effort).toBeCloseTo(view.scale.py(l.c.y), 9);
    }
    // Alle Paare im Panel — Stufe/Kontext und Kontext/Kontext — sind nach dem
    // Kastenkriterium getrennt; im Panel gilt ein Halbmaß für alle.
    const S = 2 * MARKER.lens.dom + DODGE.gap;
    const all = [
      ...view.ladder.map((l) => ({ id: l.c.effort, px: l.px, py: l.py })),
      ...view.ctx.map((c) => ({ id: c.p.label, px: c.px, py: c.py })),
    ];
    expect(view.ctx.length).toBeGreaterThan(3);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        const apart = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
        expect(apart, `${a.id} ~ ${b.id}`).toBeGreaterThanOrEqual(
          S - DODGE.tol,
        );
      }
    // sol und gpt-5.5 liegen in der Region und bleiben als Kontext sichtbar.
    expect(view.ctx.map((c) => c.p.label)).toEqual(
      expect.arrayContaining(["gpt-5.6-sol", "gpt-5.5", "gemini-3.8-flash"]),
    );
  });

  it("liegt mit dem Panel im Plot und vergrößert die Region", () => {
    const b = plotBounds(HISTORY_SCALE);
    expect(view.box.x).toBeGreaterThanOrEqual(b.x);
    expect(view.box.x + view.box.w).toBeLessThanOrEqual(b.x + b.w);
    expect(view.box.y + view.box.h).toBeLessThanOrEqual(b.y + b.h);
    // Vergrößerung: x 1,3×, y 2×, gemessen an der Leiter low → max.
    const [lo, hi] = [view.ladder[0]!, view.ladder[4]!];
    const mainDx = HISTORY_SCALE.px(hi.c.x) - HISTORY_SCALE.px(lo.c.x);
    expect((hi.px - lo.px) / mainDx).toBeGreaterThan(1.3);
    const perPp = Math.abs(view.scale.py(1) - view.scale.py(0));
    expect(
      perPp / Math.abs(HISTORY_SCALE.py(1) - HISTORY_SCALE.py(0)),
    ).toBeGreaterThan(2);
  });
});

// `EffortFalle.vue` (routeAlias `effort-falle`) zeigt dieselbe Leiter mit dem
// Preis von heute statt vom 03.09.2026 — eigener Datensatz (`ASTRA_TODAY`),
// damit `CURRENT`/`EFFORTS` beim historischen Stand bleiben. Score und CI
// jeder Stufe sind identisch zu `ASTRA_LENS` (siehe `boardArchive.test.ts`
// für den Beleg gegen die archivierten Rohdaten), nur die Preise und damit
// der Klammer-Faktor unterscheiden sich.
describe("Lupe heute: ASTRA_LENS_TODAY", () => {
  const view = lensView(ASTRA_LENS_TODAY, CURRENT_ASTRA_TODAY, HISTORY_SCALE);

  it("hat dieselben Scores wie ASTRA_LENS, aber niedrigere Preise", () => {
    for (const today of ASTRA_TODAY) {
      const alt = ASTRA_LENS.ladder.find((c) => c.effort === today.effort)!;
      expect(today.y).toBe(alt.y);
      expect(today.ci).toBe(alt.ci);
      expect(today.x).toBeLessThan(alt.x);
    }
  });

  it("zeigt dieselbe Falle mit kleinerem Faktor: max teurer, gleicher Score", () => {
    const by = (e: string) => ASTRA_TODAY.find((c) => c.effort === e)!;
    expect(by("max").y).toBe(by("high").y);
    const ratio = by("max").x / by("high").x;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2); // 1,9× statt der 2,2× vom 03.09.
    expect(
      view.ladder.filter((l) => l.shown).map((l) => l.c.effort),
    ).toStrictEqual(["xhigh"]);
  });

  it("beschriftet alle fünf Stufen ohne Überschneidung", () => {
    expect([...view.labels.keys()].sort()).toStrictEqual(
      [...EFFORT_ORDER].sort(),
    );
    const blocks = [
      ...view.obstacles,
      ...view.ladder.map((l) => squareAt(l, LENS.hitR, l.c.effort)),
    ];
    expect(
      collisions(view.labels.values(), blocks, plotBounds(view.scale)),
    ).toStrictEqual([]);
  });
});
