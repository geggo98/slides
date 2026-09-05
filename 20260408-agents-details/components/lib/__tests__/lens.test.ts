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
import { ASTRA_LENS, EFFORT_ORDER, EFFORTS, SNAPSHOTS } from "../../paretoData";

// Die Lupe ist der zehnte Klick der Historie: Sie soll das Publikum vor einer
// teuren Fehlkonfiguration bewahren. Was sie behauptet, muss aus der
// Effort-Tabelle folgen, und ihr Panel muss lesbar sein.

describe("Lupe: die Effort-Falle", () => {
  const snap = SNAPSHOTS[SNAPSHOTS.length - 1]!;
  const view = lensView(ASTRA_LENS, snap.pts, HISTORY_SCALE);

  it("hängt nur am letzten Stand und ist aus EFFORTS abgeleitet", () => {
    expect(snap.lens).toBe(ASTRA_LENS);
    expect(SNAPSHOTS.filter((s) => s.lens)).toHaveLength(1);
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
