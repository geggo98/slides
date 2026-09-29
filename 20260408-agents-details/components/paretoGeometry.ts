// Alles, was das Chart „Welches Modell wofür?“ aus einer Auswahl zeichnet —
// Skala, Ticks, Quadranten, Pfeile, Entzerrung, Beschriftung — als EINE reine
// Funktion: `chartGeometry(variante, universe, auswahl, overlay)`. `ParetoChart.vue`
// ruft sie in einem einzigen `computed` auf; die Tests rufen dieselbe Funktion,
// statt die Pipeline von Hand nachzubauen.
//
// Zwei Fälle
// ----------
// STANDARD (die Auswahl ist genau das kuratierte Feld, „Alle“): unverändert die
//   redaktionelle Skala der Variante, ihre Quadranten-Linien, der Pfeilcluster,
//   Entzerrung und Beschriftung gerechnet auf dem VOLLEN Feld. Dadurch bleiben
//   die DeepSWE-Skala (geteilt mit der Historien-Folie), alle Schnappschüsse und
//   die Sprechernotizen gültig, und kein Schalter bewegt ein Label.
// JEDE ANDERE Auswahl (ein Produkt, Labs, ein Modell): die Achsen passen sich an
//   die sichtbaren Punkte an (`fitScale`), die Quadranten-Linien liegen auf dem
//   Median der Auswahl, der Pfeilcluster entfällt (er ist in Pixeln geankert und
//   läge auf Markern), Entzerrung und Beschriftung rechnen auf den sichtbaren
//   Punkten. Ein Produkt mit nur älteren Modellen soll seine Front an sich selbst
//   zeigen, nicht am Rest des Marktes.

import {
  layoutLabels,
  type Layout,
  type LayoutPoint,
  type Obstacle,
} from "./labelLayout";
import {
  arrowCluster,
  dodgeDetailed,
  frontUnion,
  HIT_R,
  LABEL_FONT,
  plotBounds,
  quadrantBoxes,
  toLayoutPoints,
  visiblePoints,
  type ArrowCluster,
  type DodgeResult,
  type Quadrant,
} from "./paretoChrome";
import { makeScale, paretoFront, type Pt, type Scale } from "./paretoData";
import type { ParetoVariant } from "./paretoVariants";

// --- Schöne Ticks ------------------------------------------------------------

/** 1-2-5-Schritt, der `range` in etwa `target` Teile teilt. */
export function niceStep(range: number, target = 6): number {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Ticks eines linearen Bereichs auf Vielfachen von 1, 2 oder 5 · 10^k. */
export function niceLinearTicks(lo: number, hi: number, target = 6): number[] {
  const step = niceStep(hi - lo, target);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step)
    out.push(Math.round(v / step) * step);
  return out;
}

/**
 * Ticks eines logarithmischen Bereichs: die Werte 1, 2, 5 · 10^k innerhalb von
 * [lo, hi]. Werden es zu viele, nur 1 und 5; zu wenige, dazu 3 und 7.
 */
export function niceLogTicks(lo: number, hi: number): number[] {
  const bau = (mantissen: number[]) => {
    const out: number[] = [];
    for (
      let k = Math.floor(Math.log10(lo)) - 1;
      k <= Math.ceil(Math.log10(hi));
      k++
    )
      for (const m of mantissen) {
        const v = Number((m * 10 ** k).toPrecision(12));
        if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.push(v);
      }
    return out;
  };
  let t = bau([1, 2, 5]);
  if (t.length > 9) t = bau([1, 5]);
  if (t.length > 9) t = bau([1]);
  if (t.length < 3) t = bau([1, 2, 3, 5, 7]);
  return t;
}

// --- Achsen an die Auswahl anpassen -----------------------------------------

/** Ein Punkt, so wie `fitScale` ihn braucht; `sub` = Lage unter dem Kontingent-Overlay. */
export type FitPoint = Pick<Pt, "x" | "y" | "sub">;

export interface Fit {
  scale: Scale;
  xTicks: number[];
  yTicks: number[];
}

/**
 * Passt Skala und Ticks an die Punkte an. `kind` ist die Bedeutung der x-Achse:
 * Kosten (schöne Werte in €) oder Tempo (schöne Werte in tok/s, die Achse
 * trägt 1000/tps, siehe `aaData.ts`). Liefert null bei weniger als zwei
 * verschiedenen Punkten — dann gibt es nichts anzupassen.
 *
 * Die Overlay-Lage `sub` zählt IMMER mit, auch bei ausgeschaltetem Overlay: sonst
 * verschöbe der Schalter die Achse und mit ihr jeden Marker.
 */
export function fitScale(
  pts: readonly FitPoint[],
  base: Scale,
  kind: "cost" | "speed",
  yLowest = 0,
): Fit | null {
  if (pts.length < 2) return null;
  const ys = pts.map((p) => p.y);
  const xs = pts.flatMap((p) => (p.sub !== undefined ? [p.x, p.sub] : [p.x]));
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xMin = Math.max(Math.min(...xs), 1e-4);
  const xMax = Math.max(...xs);
  if (yMax - yMin < 1e-9 && xMax / xMin < 1 + 1e-9) return null;

  // y: linear, unten 8 %, oben 14 % Luft (Quadranten-Überschriften und Labels).
  const span = Math.max(yMax - yMin, 4);
  const mid = (yMax + yMin) / 2;
  const lo = Math.max(yLowest, mid - span / 2 - span * 0.08);
  const hi = mid + span / 2 + span * 0.14;
  const yTicks = niceLinearTicks(lo, hi);

  // x: logarithmisch, mindestens Faktor 6 breit (sonst zwei Ticks) und 25 %
  // Luft nach beiden Seiten. Beim Tempo wird in tok/s gerechnet.
  const wert = (x: number) => (kind === "speed" ? 1000 / x : x);
  const vs = xs.map(wert);
  let a = Math.min(...vs) / 1.25;
  let b = Math.max(...vs) * 1.25;
  if (b / a < 6) {
    const c = Math.sqrt(a * b);
    a = c / Math.sqrt(6);
    b = c * Math.sqrt(6);
  }
  // Ein Tick genau auf dem Achsenrand schöbe sein Label über den SVG-Rand hinaus:
  // Ticks nur mit 3 % Abstand zu beiden Rändern.
  const ticksV = niceLogTicks(a * 1.03, b / 1.03);
  const xTicks =
    kind === "speed"
      ? ticksV.map((t) => 1000 / t).sort((p, q) => p - q)
      : ticksV;
  const [xLo, xHi] = kind === "speed" ? [1000 / b, 1000 / a] : [a, b];

  const scale = makeScale({
    W: base.W,
    H: base.H,
    L: base.L,
    R: base.R,
    T: base.T,
    B: base.B,
    xMax: xHi,
    xLog: { min: xLo },
    yMin: lo,
    yMax: hi,
  });
  return { scale, xTicks, yTicks };
}

const median = (v: number[]) => {
  const s = [...v].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

// --- Die Geometrie eines Zustands -------------------------------------------

export interface ChartGeometry {
  /** true = die Auswahl ist genau das kuratierte Feld. */
  isDefault: boolean;
  scale: Scale;
  xTicks: number[];
  yTicks: number[];
  split: { x: number; y: number };
  quadrants: Quadrant[];
  /** Nur im Standard; sonst null. */
  cluster: ArrowCluster | null;
  obstacles: Obstacle[];
  /** Die Punkte dieses Zustands ohne Overlay-Ersetzung. */
  base: Pt[];
  dodge: DodgeResult;
  layoutPts: LayoutPoint[];
  layout: Layout;
  /** Die Optionen des Platzierers, auch für Einzelläufe (Hover-Name). */
  layoutOpts: {
    font: number;
    bounds: ReturnType<typeof plotBounds>;
    hitR: number;
    obstacles: Obstacle[];
  };
}

export type GeometryVariant = Pick<
  ParetoVariant,
  | "pts"
  | "scale"
  | "xTicks"
  | "yTicks"
  | "split"
  | "quadrants"
  | "arrows"
  | "features"
  | "xKind"
>;

export function chartGeometry(
  V: GeometryVariant,
  universe: readonly Pt[],
  sel: ReadonlySet<string>,
  subOn: boolean,
): ChartGeometry {
  const ghost = V.features.priceGhost;
  const curated = V.pts;
  const isDefault =
    sel.size === curated.length && curated.every((p) => sel.has(p.label));

  const base = isDefault
    ? [...curated]
    : universe.filter((p) => sel.has(p.label));
  const fit = isDefault ? null : fitScale(base, V.scale, V.xKind);
  const scale = fit?.scale ?? V.scale;
  const xTicks = fit?.xTicks ?? V.xTicks;
  const yTicks = fit?.yTicks ?? V.yTicks;

  const split =
    isDefault || base.length < 2
      ? V.split
      : { x: median(base.map((p) => p.x)), y: median(base.map((p) => p.y)) };

  const cluster = isDefault ? arrowCluster(scale, V.arrows) : null;
  const obstacles: Obstacle[] = [
    ...quadrantBoxes(scale, undefined, [...V.quadrants]),
    ...(cluster?.boxes ?? []),
  ];
  const layoutOpts = {
    font: LABEL_FONT.pareto,
    bounds: plotBounds(scale),
    hitR: HIT_R,
    obstacles,
  };

  // Entzerrung: im Standard auf dem vollen Feld (der Filter blendet nur aus),
  // sonst auf den sichtbaren Punkten. Punkte, die auf der Front stehen, rücken
  // nur waagerecht — die Front darf in der Höhe nicht lügen.
  const alle = new Set(base.map((p) => p.label));
  const dodge = dodgeDetailed(
    visiblePoints(base, alle, subOn, { ghost }),
    scale,
    "pareto",
    (p) => p.sub !== undefined,
    {
      horizontalOnly: isDefault
        ? frontUnion(curated)
        : new Set(paretoFront(base).front.map((p) => p.label)),
    },
  );
  const layoutPts = toLayoutPoints(base, scale, {
    overlay: V.features.subOverlay,
    ghost,
    subOn,
    story: (p) => p.story === true,
    presets: isDefault,
    pos: dodge.pos,
  });
  const layout = layoutLabels(layoutPts, layoutOpts);

  return {
    isDefault,
    scale,
    xTicks,
    yTicks,
    split,
    quadrants: [...V.quadrants],
    cluster,
    obstacles,
    base,
    dodge,
    layoutPts,
    layout,
    layoutOpts,
  };
}
