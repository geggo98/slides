import { describe, expect, it } from "vitest";
import {
  collisions,
  hits,
  inkFromCell,
  labelBox,
  layoutLabels,
  markerBoxes,
  segHitsBox,
  type Layout,
  type LayoutPoint,
  type Obstacle,
  type Placed,
} from "../../labelLayout";
import {
  arrowCluster,
  HISTORY_SCALE,
  HIT_R,
  HIT_R_HISTORY,
  LABEL_FONT,
  PARETO_SCALE,
  plotBounds,
  quadrantBoxes,
  toLayoutPoints,
  visiblePoints,
} from "../../paretoChrome";
import { CURRENT, paretoFront, SNAPSHOTS, type Pt } from "../../paretoData";
import { PRESETS, presetModels } from "../../providerFilter";

// Der Platzierer ersetzt ~180 handgestimmte Versätze und einen zweiten
// Algorithmus in der Historien-Komponente. Diese Tests sind die maschinelle
// Fassung von drei Zusagen an den Betrachter: Im Default überschneidet sich
// nichts; Front und Story tragen immer einen Namen; und kein Schalter verschiebt
// ein Label, das schon da war. Was hier grün ist, misst die Browser-QA
// (`playwright-tests/pareto-label-qa.ts`) noch einmal an echten Boxen nach —
// samt dem Textmaß, auf dem alles hier aufbaut.

const story = (p: Pt) => p.story === true;

const pos = (p: Placed) => [p.x, p.y, p.ax] as const;

function pareto(subOn: boolean) {
  const pts = toLayoutPoints(CURRENT, PARETO_SCALE, {
    overlay: true,
    subOn,
    story,
    presets: true,
  });
  const obstacles = [
    ...quadrantBoxes(PARETO_SCALE),
    ...arrowCluster(PARETO_SCALE).boxes,
  ];
  const layout = layoutLabels(pts, {
    font: LABEL_FONT.pareto,
    bounds: plotBounds(PARETO_SCALE),
    hitR: HIT_R,
    obstacles,
  });
  return { pts, obstacles, layout };
}

function history(pts: Pt[]) {
  const lp = toLayoutPoints(pts, HISTORY_SCALE, { overlay: false, story });
  // Die Historie hat weder Quadranten-Überschriften noch Pfeilcluster.
  const obstacles: Obstacle[] = [];
  const layout = layoutLabels(lp, {
    font: LABEL_FONT.history,
    allFont: LABEL_FONT.historyAll,
    bounds: plotBounds(HISTORY_SCALE),
    hitR: HIT_R_HISTORY,
    obstacles,
  });
  return { pts: lp, obstacles, layout };
}

function expectClean(
  name: string,
  pts: LayoutPoint[],
  layout: Layout,
  obstacles: Obstacle[],
  bounds: ReturnType<typeof plotBounds>,
  hitR: number,
) {
  const blocks = [...obstacles, ...markerBoxes(pts, hitR)];
  expect(collisions(layout.core.values(), blocks, bounds), name).toStrictEqual(
    [],
  );
  expect(layout.missing, `${name}: Rang 0/1 ohne Platz`).toStrictEqual([]);
  for (const p of pts) {
    if (p.rank < 2)
      expect(layout.core.has(p.id), `${name}: ${p.id}`).toBe(true);
  }
}

describe("Textmaß", () => {
  it("rechnet 0xProto bei 10 px auf 6,2 px je Zeichen und 9,9 px Tintenhöhe", () => {
    // Gemessen mit font-metrics.ts am 04.09.2026, nach dem Laden der Schrift:
    // Vorschub 0,62 em, Tinte 0,77 em über und 0,22 em unter der Grundlinie.
    const b = labelBox("claude-opus-5", 100, 50, "start", 10);
    expect(b.w - 4).toBeCloseTo(13 * 6.2, 5);
    expect(b.h - 4).toBeCloseTo(9.9, 5);
    expect(50 - (b.y + 2)).toBeCloseTo(7.7, 5);
    expect(b.x + 2).toBe(100);
  });

  it("rechnet eine gemessene Glyphzelle in die Tintenbox zurück", () => {
    // Zelle einer 12-px-Zeile: 1,51 em hoch, Oberkante 1,10 em über der
    // Grundlinie. Die Tinte davon: 0,77 em darüber, 0,22 em darunter.
    const cell = { x: 10, y: 100 - 13.2, w: 80, h: 18.12 };
    const ink = inkFromCell(cell);
    expect(ink.y).toBeCloseTo(100 - 9.24, 5);
    expect(ink.h).toBeCloseTo(11.88, 5);
    expect(ink.x).toBe(10);
    expect(ink.w).toBe(80);
  });

  it("legt den Anker rechts bzw. mittig an", () => {
    const e = labelBox("abcd", 100, 50, "end", 10);
    expect(e.x + 2 + (e.w - 4)).toBe(100);
    const m = labelBox("abcd", 100, 50, "middle", 10);
    expect(m.x + 2 + (m.w - 4) / 2).toBe(100);
  });

  it("zählt Berührung nicht als Überschneidung", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(hits(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(hits(a, { x: 9.9, y: 0, w: 10, h: 10 })).toBe(true);
    expect(hits({ x: 9.9, y: 0, w: 10, h: 10 }, a)).toBe(true);
  });

  it("erkennt, ob eine Strecke einen Kasten schneidet", () => {
    const b = { x: 10, y: 10, w: 10, h: 10 };
    expect(segHitsBox({ x1: 0, y1: 0, x2: 30, y2: 30 }, b)).toBe(true);
    expect(segHitsBox({ x1: 0, y1: 25, x2: 30, y2: 25 }, b)).toBe(false);
    expect(segHitsBox({ x1: 0, y1: 0, x2: 5, y2: 5 }, b)).toBe(false);
    expect(segHitsBox({ x1: 12, y1: 12, x2: 14, y2: 14 }, b)).toBe(true);
  });
});

describe("Folie 42 — Default ohne Überschneidung", () => {
  for (const subOn of [false, true]) {
    it(`Overlay ${subOn ? "an" : "aus"}`, () => {
      const { pts, obstacles, layout } = pareto(subOn);
      expectClean(
        `Overlay ${subOn}`,
        pts,
        layout,
        obstacles,
        plotBounds(PARETO_SCALE),
        HIT_R,
      );
    });
  }

  it("beschriftet die Front jedes Presets, ohne dass der Filter das Layout kennt", () => {
    const { layout } = pareto(false);
    for (const pr of PRESETS) {
      const sel = new Set(presetModels(pr.id, CURRENT));
      for (const on of [false, true]) {
        const front = paretoFront(visiblePoints(CURRENT, sel, on)).front;
        for (const f of front) {
          expect(layout.core.has(f.label), `${pr.id}/${on}: ${f.label}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("lässt im Default nur diese Punkte namenlos", () => {
    const { layout } = pareto(false);
    expect(layout.dropped).toMatchInlineSnapshot(`
      [
        "gpt-6-astra",
        "kimi-k3",
        "gpt-5.5",
        "gemini-3.7-flash",
      ]
    `);
  });
});

describe("Folie 42 — kein Schalter verschiebt ein Label", () => {
  it("Kontingent-Overlay: nur die verschiebbaren Labels wandern", () => {
    const aus = pareto(false);
    const an = pareto(true);
    const movable = new Set(aus.pts.filter((p) => p.movable).map((p) => p.id));
    expect(movable.size).toBe(4);
    for (const [id, p] of aus.layout.core) {
      if (movable.has(id)) continue;
      const q = an.layout.core.get(id);
      expect(q, `${id} fehlt mit Overlay`).toBeDefined();
      expect(pos(q!), id).toStrictEqual(pos(p));
    }
    expect(
      [...an.layout.core.keys()].filter((id) => !movable.has(id)).sort(),
    ).toStrictEqual(
      [...aus.layout.core.keys()].filter((id) => !movable.has(id)).sort(),
    );
  });

  it("„alle Namen“ legt nach, ohne die Grundmenge anzufassen", () => {
    for (const subOn of [false, true]) {
      const { pts, layout } = pareto(subOn);
      for (const [id, p] of layout.core) {
        expect(pos(layout.all.get(id)!), id).toStrictEqual(pos(p));
        expect(layout.all.get(id)!.pass).toBe("core");
      }
      expect(layout.all.size).toBe(pts.length);
      for (const id of layout.dropped)
        expect(layout.all.get(id)!.pass).toBe("all");
    }
  });

  it("rechnet deterministisch", () => {
    const a = pareto(false).layout;
    const b = pareto(false).layout;
    expect([...a.core.entries()]).toStrictEqual([...b.core.entries()]);
    expect([...a.all.entries()]).toStrictEqual([...b.all.entries()]);
  });
});

describe("Folie 43 — jede Station", () => {
  for (const snap of SNAPSHOTS) {
    it(`${snap.date}: Default sauber, Detailmodus vollständig und positionsgleich`, () => {
      const { pts, obstacles, layout } = history(snap.pts);
      expectClean(
        snap.id,
        pts,
        layout,
        obstacles,
        plotBounds(HISTORY_SCALE),
        HIT_R_HISTORY,
      );
      expect(layout.all.size).toBe(snap.pts.length);
      for (const [id, p] of layout.core) {
        expect(pos(layout.all.get(id)!), `${snap.id}: ${id}`).toStrictEqual(
          pos(p),
        );
      }
    });
  }

  it("lässt je Station nur so viele Punkte namenlos", () => {
    const n = Object.fromEntries(
      SNAPSHOTS.map((s) => [s.id, history(s.pts).layout.dropped.length]),
    );
    expect(n).toMatchInlineSnapshot(`
      {
        "0722": 0,
        "0725": 0,
        "0730": 0,
        "0814": 4,
        "0826": 6,
        "0902": 7,
        "0903": 7,
        "v1": 4,
        "v11": 0,
      }
    `);
  });
});
