import { describe, expect, it } from "vitest";
import {
  collisions,
  layoutLabels,
  markerBoxes,
  type Obstacle,
} from "../../labelLayout";
import {
  arrowCluster,
  dodgeMarkers,
  frontUnion,
  HIT_R,
  LABEL_FONT,
  plotBounds,
  quadrantBoxes,
  toLayoutPoints,
  visiblePoints,
} from "../../paretoChrome";
import {
  chartGeometry,
  fitScale,
  niceLinearTicks,
  niceLogTicks,
  niceStep,
} from "../../paretoGeometry";
import { labOf, makeScale, paretoFront, type Pt } from "../../paretoData";
import { presetModels, PRESETS } from "../../providerFilter";
import { VARIANT_ORDER, VARIANTS } from "../../paretoVariants";

describe("schöne Ticks", () => {
  it("wählt 1-2-5-Schritte", () => {
    expect(niceStep(60)).toBe(10);
    expect(niceStep(28)).toBe(5);
    expect(niceStep(100)).toBe(20);
    expect(niceStep(0.6)).toBe(0.1);
  });

  it("legt lineare Ticks auf Vielfache des Schritts", () => {
    expect(niceLinearTicks(31, 60)).toStrictEqual([35, 40, 45, 50, 55, 60]);
    expect(niceLinearTicks(0, 100)).toStrictEqual([0, 20, 40, 60, 80, 100]);
  });

  it("legt log-Ticks auf 1, 2, 5 · 10^k innerhalb des Bereichs", () => {
    expect(niceLogTicks(0.04, 10)).toStrictEqual([
      0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10,
    ]);
    expect(niceLogTicks(3, 30)).toStrictEqual([5, 10, 20]);
  });

  it("dünnt zu dichte Bereiche aus und füllt zu leere auf", () => {
    // fünf Dekaden: 1-2-5 wären 15 Ticks
    expect(niceLogTicks(0.001, 100).length).toBeLessThanOrEqual(9);
    // eine halbe Dekade: nur 1 und 2 lägen drin
    expect(niceLogTicks(1, 2.5).length).toBeGreaterThanOrEqual(2);
  });
});

const pt = (
  label: string,
  x: number,
  y: number,
  extra: Partial<Pt> = {},
): Pt => ({
  label,
  x,
  y,
  eur: String(x),
  ...extra,
});
const BASE = makeScale({
  W: 932,
  H: 306,
  L: 46,
  R: 10,
  T: 10,
  B: 33,
  xMax: 10,
  xLog: { min: 0.04 },
  yMin: 28,
  yMax: 62,
});

describe("fitScale", () => {
  const pts = [pt("a", 0.5, 30), pt("b", 2, 41), pt("c", 8, 55)];

  it("liegt jeden Punkt in den Plot, mit Luft oben für die Überschriften", () => {
    const f = fitScale(pts, BASE, "cost")!;
    const b = plotBounds(f.scale);
    for (const p of pts) {
      expect(f.scale.px(p.x)).toBeGreaterThan(b.x + 10);
      expect(f.scale.px(p.x)).toBeLessThan(b.x + b.w - 10);
      expect(f.scale.py(p.y)).toBeGreaterThan(b.y + 20); // Überschrift
      expect(f.scale.py(p.y)).toBeLessThan(b.y + b.h - 5);
    }
    for (const t of f.xTicks) {
      expect(f.scale.px(t)).toBeGreaterThanOrEqual(b.x);
      expect(f.scale.px(t)).toBeLessThanOrEqual(b.x + b.w);
    }
    expect(f.yTicks.length).toBeGreaterThanOrEqual(3);
  });

  it("zählt die Overlay-Lage mit: die Achse reicht bis zum Kontingent-Wert", () => {
    const f = fitScale(
      [pt("a", 5, 50, { sub: 1 }), pt("b", 4, 40)],
      BASE,
      "cost",
    )!;
    const g = fitScale([pt("a", 5, 50), pt("b", 4, 40)], BASE, "cost")!;
    // mit sub = 1 muss die Achse weiter nach links reichen als ohne
    expect(f.scale.px(4)).toBeGreaterThan(g.scale.px(4));
  });

  it("rechnet die Tempo-Achse in tok/s: schöne Ticks, schnell links", () => {
    // x = 1000 / tps
    const s = [
      pt("schnell", 1000 / 240, 41),
      pt("mittel", 1000 / 90, 55),
      pt("langsam", 1000 / 40, 46),
    ];
    const f = fitScale(s, BASE, "speed")!;
    const tps = f.xTicks.map((x) => Math.round(1000 / x));
    for (const t of tps) expect([1, 2, 5]).toContain(Number(String(t)[0]));
    const px = f.xTicks.map((x) => f.scale.px(x));
    expect([...px].sort((a, b) => a - b)).toStrictEqual(px); // aufsteigend
    expect(f.scale.px(s[0]!.x)).toBeLessThan(f.scale.px(s[2]!.x));
  });

  it("liefert null, wo es nichts anzupassen gibt", () => {
    expect(fitScale([], BASE, "cost")).toBeNull();
    expect(fitScale([pt("a", 1, 40)], BASE, "cost")).toBeNull();
    expect(fitScale([pt("a", 1, 40), pt("b", 1, 40)], BASE, "cost")).toBeNull();
  });

  it("hält die Achse nie schmaler als einen Faktor 6 und nie unter dem Boden", () => {
    const f = fitScale([pt("a", 1, 3), pt("b", 1.1, 4)], BASE, "cost", 0)!;
    expect(f.scale.px(1.1) - f.scale.px(1)).toBeGreaterThan(0);
    expect(f.yTicks.every((t) => t >= 0)).toBe(true);
    expect(f.xTicks.length).toBeGreaterThanOrEqual(2);
  });
});

// Der wichtigste Test dieser Datei: Im Standard rechnet `chartGeometry` exakt das,
// was die Komponente bisher von Hand rechnete. Steht das, bleiben die DeepSWE-
// Skala, alle Schnappschüsse und die Sprechernotizen unberührt.
describe("chartGeometry — Standard = bisherige Pipeline", () => {
  for (const id of VARIANT_ORDER) {
    const V = VARIANTS[id];
    for (const subOn of V.features.subOverlay ? [false, true] : [false]) {
      it(`${id}, Overlay ${subOn ? "an" : "aus"}`, () => {
        const all = new Set(V.pts.map((p) => p.label));
        const g = chartGeometry(V, V.pts, all, subOn);
        expect(g.isDefault).toBe(true);
        expect(g.scale).toBe(V.scale);
        expect(g.xTicks).toBe(V.xTicks);
        expect(g.split).toBe(V.split);
        expect(g.cluster).not.toBeNull();

        // die alte Rechnung, wörtlich
        const ghost = V.features.priceGhost;
        const pos = dodgeMarkers(
          visiblePoints(V.pts, all, subOn, { ghost }),
          V.scale,
          "pareto",
          (p) => p.sub !== undefined,
          { horizontalOnly: frontUnion(V.pts) },
        );
        expect([...g.dodge.pos]).toStrictEqual([...pos]);
        const lp = toLayoutPoints(V.pts, V.scale, {
          overlay: V.features.subOverlay,
          ghost,
          subOn,
          story: (p) => p.story === true,
          presets: true,
          pos,
        });
        const obstacles: Obstacle[] = [
          ...quadrantBoxes(V.scale, undefined, [...V.quadrants]),
          ...arrowCluster(V.scale, V.arrows).boxes,
        ];
        const layout = layoutLabels(lp, {
          font: LABEL_FONT.pareto,
          bounds: plotBounds(V.scale),
          hitR: HIT_R,
          obstacles,
        });
        expect([...g.layout.core]).toStrictEqual([...layout.core]);
        expect([...g.layout.all]).toStrictEqual([...layout.all]);
      });
    }
  }
});

describe("chartGeometry — jede andere Auswahl", () => {
  const auswahlen = (V: (typeof VARIANTS)[keyof typeof VARIANTS]) => {
    const labs = [...new Set(V.pts.map((p) => labOf(p.label)))];
    return [
      ...PRESETS.filter((p) => p.id !== "all").map((p) => ({
        name: `Preset ${p.id}`,
        sel: new Set(presetModels(p.id, V.pts)),
      })),
      ...labs.map((l) => ({
        name: `Lab ${l}`,
        sel: new Set(
          V.pts.filter((p) => labOf(p.label) === l).map((p) => p.label),
        ),
      })),
      { name: "ein Modell", sel: new Set([V.pts[3]!.label]) },
      {
        name: "zwei Modelle",
        sel: new Set([V.pts[0]!.label, V.pts[5]!.label]),
      },
      { name: "leer", sel: new Set<string>() },
    ];
  };

  for (const id of VARIANT_ORDER) {
    const V = VARIANTS[id];
    for (const { name, sel } of auswahlen(V)) {
      for (const subOn of V.features.subOverlay ? [false, true] : [false]) {
        it(`${id} · ${name} · Overlay ${subOn ? "an" : "aus"}: alles im Plot, nichts überlappt`, () => {
          const g = chartGeometry(V, V.pts, sel, subOn);
          expect(g.isDefault).toBe(false);
          expect(g.cluster).toBeNull();
          const b = plotBounds(g.scale);
          const sichtbar = visiblePoints(g.base, sel, subOn, {
            ghost: V.features.priceGhost,
          });
          for (const p of sichtbar) {
            const at = g.dodge.pos.get(p.label);
            expect(at, p.label).toBeDefined();
            expect(at!.px).toBeGreaterThan(b.x);
            expect(at!.px).toBeLessThan(b.x + b.w);
            expect(at!.py).toBeGreaterThan(b.y);
            expect(at!.py).toBeLessThan(b.y + b.h);
          }
          // Wo nicht genug Punkte für eine Anpassung da sind, bleibt die Skala.
          if (g.base.length < 2) expect(g.scale).toBe(V.scale);
          // Rang 0 und 1 bekommen einen Platz, im Kernlauf steht nichts übereinander.
          const blocks = [...g.obstacles, ...markerBoxes(g.layoutPts, HIT_R)];
          expect(
            collisions(g.layout.core.values(), blocks, plotBounds(g.scale)),
          ).toStrictEqual([]);
          expect(g.layout.missing).toStrictEqual([]);
        });
      }
    }
  }

  it("verschiebt der Kontingent-Schalter die Achse nicht", () => {
    const V = VARIANTS["aa-cost"];
    const sel = new Set(presetModels("cursor", V.pts));
    expect(sel.size).toBeGreaterThan(0);
    const aus = chartGeometry(V, V.pts, sel, false);
    const an = chartGeometry(V, V.pts, sel, true);
    expect(an.xTicks).toStrictEqual(aus.xTicks);
    expect(an.yTicks).toStrictEqual(aus.yTicks);
    for (const x of [0.1, 1, 5])
      expect(an.scale.px(x)).toBeCloseTo(aus.scale.px(x), 9);
  });

  it("liegt die Front einer Auswahl über der Auswahl, nicht über dem Feld", () => {
    const V = VARIANTS["aa-cost"];
    const sel = new Set(presetModels("jetbrains-ai", V.pts));
    const g = chartGeometry(V, V.pts, sel, false);
    const front = paretoFront(g.base).front.map((p) => p.label);
    for (const l of front) expect(sel.has(l)).toBe(true);
  });

  it("legt die Quadranten-Linien auf den Median der Auswahl", () => {
    const V = VARIANTS["aa-cost"];
    const sel = new Set(V.pts.slice(0, 5).map((p) => p.label));
    const g = chartGeometry(V, V.pts, sel, false);
    const xs = g.base.map((p) => p.x).sort((a, b) => a - b);
    expect(g.split.x).toBe(xs[2]);
  });
});
