// Geometrie, die beide Modell-Routing-Charts UND die Tests teilen: Skalen,
// Ticks, Quadrantenbeschriftung, Pfeilcluster, und der Weg von den Datenpunkten
// zur Eingabe des Platzierers (`labelLayout.ts`). Rein, ohne Vue.
//
// Was hier steht, war vorher in `ModelRoutingPareto.vue` und
// `ModelRoutingHistory.vue` je einmal vorhanden. Es ist herausgezogen, damit
// vitest dieselbe Chart-Geometrie sieht wie der Browser — sonst prüfte der Test
// ein anderes Chart als das, das gezeigt wird.

import {
  labelBox,
  type Anchor,
  type LayoutPoint,
  type Obstacle,
  type XY,
} from "./labelLayout";
import { fmt, makeScale, paretoFront, type Pt, type Scale } from "./paretoData";
import { PRESETS, presetModels } from "./providerFilter";

export const X_TICKS_LINEAR = [0, 5, 10, 15, 20, 25];
export const X_TICKS_LOG = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
export const Y_TICKS = [0, 20, 40, 60, 80];

/** „0,1 €", „1 €", „20 €" — deutsches Komma, keine Nachkommanullen. */
export const tickLabel = (t: number) => `${String(t).replace(".", ",")} €`;

/**
 * Beide Charts teilen die Achse, sonst wären die Stände nicht vergleichbar:
 * x logarithmisch von 0,08 € bis 30 € (kleinster Wert aller Stände: 0,09 €),
 * y linear, Ticks bis 80 %.
 */
// yMax 88 statt 80: Die Spitzenmodelle liegen bei 74 %, mit yMax 80 also 20 px
// unter der Oberkante — dort passt weder die Quadranten-Überschrift noch ein
// Label. Die Ticks enden weiter bei 80 %.
const CHART = {
  W: 932,
  L: 46,
  R: 10,
  T: 10,
  xMax: 30,
  xLog: { min: 0.08 },
  yMax: 88,
};
/** Folie „Welches Modell wofür?“: 306 hoch, 33 px Achsenband. */
export const PARETO_SCALE: Scale = makeScale({ ...CHART, H: 306, B: 33 });
/** Historien-Folie: 56 px flacher, sonst dieselbe Achse. */
export const HISTORY_SCALE: Scale = makeScale({ ...CHART, H: 250, B: 30 });

/** Schriftgrößen der Labels in viewBox-px. */
export const LABEL_FONT = { pareto: 12, history: 11, historyAll: 10 } as const;
/** Radius des Klickziels je Marker — zugleich das Hindernis des Platzierers. */
export const HIT_R = 10;
/**
 * Die Historie hat im Normalmodus keine Klickziele; ihr Hindernis ist der
 * sichtbare Marker plus Luft. Im Detailmodus bekommen die Klickziele denselben
 * Radius, damit kein Label unter einem fremden liegt.
 */
export const HIT_R_HISTORY = 7;
export const QUADRANT_FONT = 13;
export const QUADRANT_FONT_HISTORY = 12;
/** Quadranten sind Sans-Serif, halbfett — grob 0,62 em je Zeichen. */
export const SANS_EM = 0.62;

/** Der Plot ohne Achsenband — ein Label muss vollständig darin liegen. */
export const plotBounds = (s: Scale) => ({
  x: s.L + 1,
  y: s.T,
  w: s.W - s.R - 1 - (s.L + 1),
  h: s.H - s.B - s.T,
});

export interface Quadrant {
  key: "sweet" | "price" | "budget" | "burn";
  text: string;
  ax: Anchor;
  x: (s: Scale) => number;
  y: (s: Scale) => number;
}

/** Die vier Ecken — redaktionell, wie die Trennung bei 8 € / 50 %. */
export const QUADRANTS: readonly Quadrant[] = [
  {
    key: "sweet",
    text: "Sweet Spot",
    ax: "start",
    x: (s) => s.L + 10,
    y: (s) => s.T + 14,
  },
  {
    key: "price",
    text: "Leistung um jeden Preis",
    ax: "end",
    x: (s) => s.W - s.R - 10,
    y: (s) => s.T + 14,
  },
  {
    key: "budget",
    text: "Budget-Ecke",
    ax: "start",
    x: (s) => s.L + 10,
    y: (s) => s.H - s.B - 8,
  },
  {
    key: "burn",
    text: "Geldverbrennung",
    ax: "end",
    x: (s) => s.W - s.R - 10,
    y: (s) => s.H - s.B - 8,
  },
];

export const quadrantBoxes = (s: Scale, font = QUADRANT_FONT): Obstacle[] =>
  QUADRANTS.map((q) => ({
    ...labelBox(q.text, q.x(s), q.y(s), q.ax, font, SANS_EM),
    name: `«${q.text}»`,
  }));

// --- Pfeilcluster „Besseres Preis-Leistungs-Verhältnis" --------------------
// Drei Blockpfeile aus einem Hub: waagerecht „Billiger", senkrecht
// „Leistungsfähiger", diagonal der Resultierende. Polygon in Pfeil-Koordinaten
// (Schaft entlang +x), per Gruppe gedreht.

export type ArrowPts = [number, number][];

export function arrowPoints(
  len: number,
  w: number,
  hw: number,
  hl: number,
): ArrowPts {
  return [
    [0, -w],
    [len - hl, -w],
    [len - hl, -hw],
    [len, 0],
    [len - hl, hw],
    [len - hl, w],
    [0, w],
  ];
}

export const polyAttr = (pts: ArrowPts) =>
  pts.map((p) => p.join(",")).join(" ");

/** AABB eines um `deg` gedrehten und nach (tx, ty) verschobenen Polygons. */
export function polyBox(
  pts: ArrowPts,
  tx: number,
  ty: number,
  deg: number,
  name: string,
): Obstacle {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    const rx = tx + x * c - y * s;
    const ry = ty + x * s + y * c;
    x0 = Math.min(x0, rx);
    y0 = Math.min(y0, ry);
    x1 = Math.max(x1, rx);
    y1 = Math.max(y1, ry);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, name };
}

export interface Arrow {
  key: "cheaper" | "stronger" | "better";
  text: string;
  /** Schriftgröße der Beschriftung auf dem Schaft. */
  font: number;
  len: number;
  /** Drehung der Pfeilgruppe in Grad. */
  rot: number;
  poly: string;
  /** Mitte des Schafts — dort sitzt der Text. */
  mid: number;
  /** Text um 180° drehen, sonst stünde er kopf. */
  flip: boolean;
}

export interface ArrowCluster {
  hub: { x: number; y: number; r: number };
  arrows: Arrow[];
  /** Hindernisse für den Platzierer. */
  boxes: Obstacle[];
}

export function arrowCluster(s: Scale): ArrowCluster {
  // Der Cluster ankert in Pixeln im leeren Bereich rechts unten, nicht mehr in
  // €-Koordinaten: Auf der log-Achse läge (20,5 € → 12 €) auf 80 px, und der
  // senkrechte Pfeil liefe in claude-sonnet-5 (23 €/54 %). Frei ist rechts von
  // 4 € unterhalb von 45 % in jedem Stand der Hauptfolie — der niedrigste Punkt
  // dort ist claude-sonnet-5 bei 54 %, auch mit Kontingent-Overlay.
  const hx = s.W - s.R - 26;
  const hy = s.py(9);
  const tx = s.px(4);
  const ty = s.py(42);
  const aRot = (Math.atan2(ty - hy, tx - hx) * 180) / Math.PI;
  const aLen = Math.hypot(tx - hx, ty - hy);
  const aW = 12; // halbe Schaftbreite, Resultierende
  const aHW = 24; // halbe Spitzenbreite
  const aHL = 34; // Spitzenlänge
  const cW = 9; // dasselbe für die beiden Komponenten
  const cHW = 17;
  const cHL = 24;
  const bLen = 250; // „Billiger“ nach links: Schweif bei ≈ 646 px, rechts von px(4)
  const cLen = 100; // „Leistungsfähiger“ nach oben: Spitze bei ≈ py(40), unter Sonnet 5
  const mk = (
    key: Arrow["key"],
    text: string,
    font: number,
    len: number,
    rot: number,
    w: number,
    hw: number,
    hl: number,
  ): { arrow: Arrow; box: Obstacle } => {
    const pts = arrowPoints(len, w, hw, hl);
    return {
      arrow: {
        key,
        text,
        font,
        len,
        rot,
        poly: polyAttr(pts),
        mid: (len - hl) / 2,
        flip: Math.abs(rot) > 90,
      },
      box: polyBox(pts, hx, hy, rot, `Pfeil „${text}"`),
    };
  };
  const parts = [
    mk("cheaper", "Billiger", 11, bLen, 180, cW, cHW, cHL),
    mk("stronger", "Leistungsfähiger", 11, cLen, -90, cW, cHW, cHL),
    mk(
      "better",
      "Besseres Preis-Leistungs-Verhältnis",
      12,
      aLen,
      aRot,
      aW,
      aHW,
      aHL,
    ),
  ];
  return {
    hub: { x: hx, y: hy, r: aW + 2 },
    arrows: parts.map((p) => p.arrow),
    boxes: parts.map((p) => p.box),
  };
}

// --- Von den Datenpunkten zur Eingabe des Platzierers ------------------------

/**
 * Was das Chart in einem Zustand zeichnet: der Anbieter-Filter blendet aus,
 * das Kontingent-Overlay setzt die Claude-Punkte auf `sub` und hängt ihnen die
 * künftige Lage (`sub25`) als Geisterring an.
 */
export function visiblePoints(
  all: readonly Pt[],
  sel: ReadonlySet<string>,
  subOn: boolean,
): Pt[] {
  const shown =
    sel.size === all.length ? [...all] : all.filter((p) => sel.has(p.label));
  if (!subOn) return shown;
  return shown.map((p) =>
    p.sub
      ? {
          ...p,
          x: p.sub,
          eur: fmt(p.sub),
          old: {
            x: p.sub25 ?? p.x,
            eur: fmt(p.sub25 ?? p.x),
            pre: "ab 14.09.",
            why: "dauerhaft +25 % statt +50 % — Stand ab 14.09.2026",
          },
        }
      : p,
  );
}

export interface LayoutSource {
  /**
   * Hat das Chart das Kontingent-Overlay? Nur dann sind die Claude-Punkte
   * verschiebbar und ihre anderen Lagen Hindernis. Die Historie hat es nicht —
   * dort wären die `sub`-Lagen Phantom-Hindernisse.
   */
  overlay: boolean;
  /** Kontingent-Overlay an? Bestimmt die aktuelle Lage der Claude-Punkte. */
  subOn?: boolean;
  /** Wer Rang 1 bekommt, obwohl weder Front noch Wanderung. */
  story: (p: Pt) => boolean;
  /**
   * Rang 0 als Vereinigung der Fronten über alle Anbieter-Presets und beide
   * Overlay-Zustände — so ist die Front jedes Presets beschriftet, ohne dass
   * der Filter das Layout ändert. Nur die Hauptfolie hat Presets.
   */
  presets?: boolean;
}

/** Baut aus dem VOLLEN Datensatz die Eingabe des Platzierers für einen Zustand. */
export function toLayoutPoints(
  all: readonly Pt[],
  s: Scale,
  o: LayoutSource,
): LayoutPoint[] {
  const subOn = o.subOn ?? false;
  const at = (x: number, y: number): XY => ({ px: s.px(x), py: s.py(y) });

  const front = new Set<string>();
  const views: Pt[][] = o.presets
    ? PRESETS.flatMap((pr) => {
        const sel = new Set(presetModels(pr.id, [...all]));
        return [false, true].map((on) => visiblePoints(all, sel, on));
      })
    : [[...all]];
  for (const v of views)
    for (const f of paretoFront(v).front) front.add(f.label);

  return all.map((p) => {
    const movable = o.overlay && p.sub !== undefined;
    const moved = subOn && movable;
    const cur = moved ? at(p.sub!, p.y) : at(p.x, p.y);
    const alt: XY[] = [];
    if (movable) {
      if (moved) alt.push(at(p.x, p.y));
      else {
        alt.push(at(p.sub!, p.y));
        if (p.sub25 !== undefined) alt.push(at(p.sub25, p.y));
      }
    }
    const ghost = moved
      ? at(p.sub25 ?? p.x, p.y)
      : p.old
        ? at(p.old.x, p.old.y ?? p.y)
        : undefined;
    return {
      id: p.label,
      text: p.label,
      px: cur.px,
      py: cur.py,
      rank: front.has(p.label) ? 0 : o.story(p) || p.old ? 1 : 2,
      movable,
      alt,
      ghost,
    };
  });
}
