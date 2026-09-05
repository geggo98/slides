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
  layoutLabels,
  squareAt,
  type Anchor,
  type Box,
  type LayoutPoint,
  type Obstacle,
  type Placed,
  type XY,
} from "./labelLayout";
import {
  fmt,
  makeScale,
  paretoFront,
  type Cfg,
  type Lens,
  type Pt,
  type Scale,
  type Snapshot,
} from "./paretoData";
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

/**
 * Warnhinweis oben links im Historien-Chart (⚠️ plus Kurztext), nur für
 * Stände mit `warn` — auf der Bonusfolie der v1-Stand. Lage und Schrift stehen
 * hier, weil der Platzierer die Box als Hindernis kennen muss.
 */
export const WARN = {
  font: 10.5,
  iconW: 16,
  text: "v1: nur mit Vorbehalt vergleichbar",
  at: (s: Scale) => ({ x: s.L + 8, y: s.T + 14 }),
} as const;

/**
 * Hindernisse des Historien-Charts für den Platzierer: die Kreuze (`gone`)
 * weich — ein Label mit Halo bleibt darauf lesbar —, der Warnhinweis hart.
 * Quadranten-Überschriften und Pfeile hat dieses Chart nicht.
 */
export function historyObstacles(
  snap: Pick<Snapshot, "gone" | "warn">,
  s: Scale,
): Obstacle[] {
  const o: Obstacle[] = (snap.gone ?? []).map((p) => ({
    ...squareAt({ px: s.px(p.x), py: s.py(p.y) }, 5, `gone:${p.label}`),
    soft: true,
  }));
  if (snap.warn) {
    const a = WARN.at(s);
    const b = labelBox(WARN.text, a.x + WARN.iconW, a.y, "start", WARN.font);
    o.push({ ...b, x: a.x - 2, w: b.w + WARN.iconW + 2, name: "warn" });
  }
  return o;
}
export const QUADRANT_FONT = 13;
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
      // Weich: im Durchgang „alle Namen“ darf ein Label auf dem Cluster liegen.
      box: { ...polyBox(pts, hx, hy, rot, `Pfeil „${text}"`), soft: true },
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

// --- Marker-Entzerrung -------------------------------------------------------
//
// Marker, die einander verdecken (sol/astra 2,7 px, terra/glm-5.3 2,7 px,
// muse-spark-1.1/grok-4.5 4,3 px, muse-spark-1.2/qwen3.8-max 5 px), werden
// um höchstens `cap` px auseinandergerückt. Das ist eine bewusste Abweichung
// vom Wert — die Folie soll auf einen Blick lesbar sein —, und sie ist
// dokumentiert: Speaker Notes und ⓘ nennen das gemessene Maximum,
// `markerDodge.test.ts` rechnet es nach und hält die Notiz dagegen.
//
// Regeln, gemessen am 05.09.2026 über alle 13 Zustände:
//   * Kriterium: zwei Marker sind getrennt, wenn |dx| ≥ S oder |dy| ≥ S mit
//     S = h(a) + h(b) + gap (achsenweise Kästen, nicht Kreise).
//   * Je Paar die Achse mit dem kleineren Schub, hälftig auf beide. Stößt ein
//     Partner an ein festes Hindernis (Geisterring, Kappe, Wächter), bekommt
//     der andere den vollen Schub; sind beide blockiert, die andere Achse.
//   * Front-Wächter: ein dominierter Punkt darf nicht über das wahre Niveau
//     der billigeren Frontpunkte rücken — sonst sähe astra an Station 9
//     besser aus als gemini-3.8-flash. Dann weicht er waagerecht aus.
//   * Zwei Stufen, damit kein Schalter einen festen Marker bewegt: erst die
//     festen Punkte gegeneinander und gegen ihre Geisterringe, dann die
//     verschiebbaren (Kontingent-Overlay) gegen das fertige Bild.
//   * Deterministisch: Reihenfolge nach Label, nie nach Array.
// Wahre Lagen behalten Fadenkreuz-Linien, Badges, Fehlerbalken und
// Geisterringe; die angezeigte Lage bekommen Marker, Front-Polyline,
// Klickziele und der Platzierer (`LayoutSource.pos`).

/** Halbmaße der sichtbaren Marker je Chart, inklusive halbem Surface-Strich. */
export const MARKER = {
  history: { front: 7, dom: 4.5, ghost: 5.2 },
  pareto: { front: 8, dom: 5, ghost: 5.7 },
  /** Lupe: Stufenpunkte r 4, Kontextmarker r 3, keine Geisterringe. */
  lens: { front: 4.5, dom: 3.5, ghost: 3.5 },
} as const;

export const DODGE = {
  gap: 3,
  cap: 8,
  /** Rechenschwelle für Wächter und Kappe. */
  eps: 1e-6,
  /** Unter dieser Restüberlappung gilt ein Paar als getrennt — 0,02 px sieht niemand, und die hälftige Auflösung konvergiert nur geometrisch. */
  tol: 0.02,
  maxSweeps: 12,
} as const;

export interface DodgeResult {
  /** Angezeigte Lage je Label — für unbewegte Marker die wahre. */
  pos: Map<string, XY>;
  sweeps: number;
  /** Größte verbleibende Verletzung in px; 0 heißt: alle Paare getrennt. */
  residual: number;
  /** Bewegte Marker mit Versatz in px. */
  moved: { label: string; dx: number; dy: number }[];
}

interface Ob {
  px: number;
  py: number;
  h: number;
  owner?: string;
}

export interface DodgeOpts {
  /**
   * Punkte, die in irgendeiner Ansicht auf der Front stehen (Anbieter-Presets
   * der Hauptfolie, siehe `frontUnion`): Sie rücken nur waagerecht, auch wenn
   * sie im vollen Satz dominiert sind — sonst stünde terra im Windsurf-Preset
   * als Sprosse 2 um 1,7 Punkte zu hoch (Befund vom 05.09.2026).
   */
  horizontalOnly?: ReadonlySet<string>;
}

export function dodgeDetailed(
  pts: readonly Pt[],
  s: Scale,
  kind: keyof typeof MARKER,
  movable: (p: Pt) => boolean = () => false,
  opts: DodgeOpts = {},
): DodgeResult {
  const M = MARKER[kind];
  const fixedY = (label: string) =>
    front.has(label) || (opts.horizontalOnly?.has(label) ?? false);
  const { gap, cap, eps, tol, maxSweeps } = DODGE;
  const front = new Set(paretoFront([...pts]).front.map((p) => p.label));
  const order = [...pts].sort((a, b) => a.label.localeCompare(b.label));
  const half = (p: Pt) => (front.has(p.label) ? M.front : M.dom);
  const truth = new Map(
    order.map((p) => [p.label, { px: s.px(p.x), py: s.py(p.y) } as XY]),
  );
  const cur = new Map(order.map((p) => [p.label, { ...truth.get(p.label)! }]));

  // Wächter-Niveau je dominiertem Punkt: kleinstes wahres py (= höchster
  // Punkt) der Frontpunkte, die nicht teurer sind. Frontpunkte selbst rücken
  // nur waagerecht — die Front darf in der Höhe nicht lügen, und ihr
  // Paarpartner ist meist ein Nachbar auf der Front, wo ohnehin x gewinnt.
  const level = new Map<string, number>();
  for (const p of order) {
    if (front.has(p.label)) continue;
    const t = truth.get(p.label)!;
    let lvl = Infinity;
    for (const f of order) {
      if (!front.has(f.label)) continue;
      const tf = truth.get(f.label)!;
      if (tf.px <= t.px + eps) lvl = Math.min(lvl, tf.py);
    }
    level.set(p.label, lvl === Infinity ? -Infinity : lvl);
  }

  const ghostOf = (p: Pt): Ob | null =>
    p.old
      ? {
          px: s.px(p.old.x),
          py: s.py(p.old.y ?? p.y),
          h: M.ghost,
          owner: p.label,
        }
      : null;

  const violates = (p: Pt, at: XY, obs: readonly Ob[]) =>
    obs.some((o) => {
      if (o.owner === p.label) return false;
      const S = half(p) + o.h + gap;
      return (
        Math.abs(at.px - o.px) < S - tol && Math.abs(at.py - o.py) < S - tol
      );
    });

  const clamp = (p: Pt, at: XY): XY => {
    const t = truth.get(p.label)!;
    const dx = at.px - t.px;
    const dy = at.py - t.py;
    const d = Math.hypot(dx, dy);
    if (d <= cap) return at;
    return { px: t.px + (dx / d) * cap, py: t.py + (dy / d) * cap };
  };

  /** Darf `p` nach `at`? Kappe, Wächter, Front-Höhe und feste Hindernisse. */
  const canMove = (p: Pt, at: XY, obs: readonly Ob[]) => {
    const t = truth.get(p.label)!;
    if (Math.hypot(at.px - t.px, at.py - t.py) > cap + eps) return false;
    if (fixedY(p.label) && Math.abs(at.py - t.py) > eps) return false;
    const lvl = level.get(p.label);
    if (lvl !== undefined && at.py < lvl - eps) return false;
    return !violates(p, at, obs);
  };

  const shift = (p: Pt, dx: number, dy: number) => {
    const c = cur.get(p.label)!;
    cur.set(p.label, clamp(p, { px: c.px + dx, py: c.py + dy }));
  };

  let sweeps = 0;
  const relax = (group: readonly Pt[], obs: readonly Ob[]) => {
    for (let sweep = 1; sweep <= maxSweeps; sweep++) {
      let hit = false;
      // Punkt gegen feste Hindernisse: voller Schub auf den Punkt.
      for (const p of group) {
        for (const o of obs) {
          if (o.owner === p.label) continue;
          const c = cur.get(p.label)!;
          const S = half(p) + o.h + gap;
          const dx = c.px - o.px;
          const dy = c.py - o.py;
          if (Math.abs(dx) >= S - tol || Math.abs(dy) >= S - tol) continue;
          hit = true;
          const nx = S - Math.abs(dx);
          const ny = S - Math.abs(dy);
          const sx = dx >= 0 ? 1 : -1;
          const sy = dy >= 0 ? 1 : -1;
          const up = { px: c.px, py: c.py + sy * ny };
          if (ny < nx && canMove(p, up, obs)) shift(p, 0, sy * ny);
          else shift(p, sx * nx, 0);
        }
      }
      // Paare innerhalb der Gruppe.
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const p = group[i]!;
          const q = group[j]!;
          const a = cur.get(p.label)!;
          const b = cur.get(q.label)!;
          const S = half(p) + half(q) + gap;
          const dx = b.px - a.px;
          const dy = b.py - a.py;
          if (Math.abs(dx) >= S - tol || Math.abs(dy) >= S - tol) continue;
          hit = true;
          const need = { x: S - Math.abs(dx), y: S - Math.abs(dy) };
          // Gleichstand: der lexikografisch spätere (q) geht nach rechts/unten.
          const sign = { x: dx >= 0 ? 1 : -1, y: dy >= 0 ? 1 : -1 };
          const axes: ("x" | "y")[] = need.y < need.x ? ["y", "x"] : ["x", "y"];
          const vec = (ax: "x" | "y", k: number, sgn: number): XY =>
            ax === "x" ? { px: sgn * k, py: 0 } : { px: 0, py: sgn * k };
          const to = (c: XY, v: XY): XY => ({
            px: c.px + v.px,
            py: c.py + v.py,
          });
          // Erst hälftig auf beiden Achsen (bevorzugte zuerst), dann volle
          // Schübe: ein Partner, der frei ist, übernimmt für den blockierten.
          let done = false;
          for (const ax of axes) {
            const pHalf = vec(ax, need[ax] / 2, -sign[ax]);
            const qHalf = vec(ax, need[ax] / 2, sign[ax]);
            if (
              canMove(p, to(a, pHalf), obs) &&
              canMove(q, to(b, qHalf), obs)
            ) {
              shift(p, pHalf.px, pHalf.py);
              shift(q, qHalf.px, qHalf.py);
              done = true;
              break;
            }
          }
          for (const ax of axes) {
            if (done) break;
            const pFull = vec(ax, need[ax], -sign[ax]);
            const qFull = vec(ax, need[ax], sign[ax]);
            if (canMove(q, to(b, qFull), obs)) {
              shift(q, qFull.px, qFull.py);
              done = true;
            } else if (canMove(p, to(a, pFull), obs)) {
              shift(p, pFull.px, pFull.py);
              done = true;
            }
          }
          if (!done) {
            // Beide auf beiden Achsen blockiert: hälftig auf der ersten Achse,
            // die Kappe schneidet ab. Bleibt als `residual` messbar.
            const ax = axes[0]!;
            const n = need[ax];
            if (ax === "x") {
              shift(p, (-sign.x * n) / 2, 0);
              shift(q, (sign.x * n) / 2, 0);
            } else {
              shift(p, 0, (-sign.y * n) / 2);
              shift(q, 0, (sign.y * n) / 2);
            }
          }
        }
      }
      sweeps++;
      if (!hit) break;
    }
  };

  const fixed = order.filter((p) => !movable(p));
  const mov = order.filter(movable);
  const fixedGhosts = fixed.flatMap((p) => {
    const g = ghostOf(p);
    return g ? [g] : [];
  });
  relax(fixed, fixedGhosts);
  if (mov.length) {
    const allGhosts = order.flatMap((p) => {
      const g = ghostOf(p);
      return g ? [g] : [];
    });
    const fixedObs: Ob[] = fixed.map((p) => ({
      ...cur.get(p.label)!,
      h: half(p),
      owner: p.label,
    }));
    relax(mov, [...allGhosts, ...fixedObs]);
  }

  // Restverletzung über alle Paare und Ringe.
  let residual = 0;
  const allObs = order.flatMap((p) => {
    const g = ghostOf(p);
    return g ? [g] : [];
  });
  for (let i = 0; i < order.length; i++) {
    const p = order[i]!;
    const a = cur.get(p.label)!;
    for (const o of allObs) {
      if (o.owner === p.label) continue;
      const S = half(p) + o.h + gap;
      const v = Math.min(S - Math.abs(a.px - o.px), S - Math.abs(a.py - o.py));
      residual = Math.max(residual, v);
    }
    for (let j = i + 1; j < order.length; j++) {
      const q = order[j]!;
      const b = cur.get(q.label)!;
      const S = half(p) + half(q) + gap;
      const v = Math.min(S - Math.abs(b.px - a.px), S - Math.abs(b.py - a.py));
      residual = Math.max(residual, v);
    }
  }

  const moved = order.flatMap((p) => {
    const t = truth.get(p.label)!;
    const c = cur.get(p.label)!;
    const dx = c.px - t.px;
    const dy = c.py - t.py;
    return Math.hypot(dx, dy) > eps ? [{ label: p.label, dx, dy }] : [];
  });
  return { pos: cur, sweeps, residual: Math.max(0, residual), moved };
}

/** Angezeigte Lage je Label, siehe `dodgeDetailed`. */
export function dodgeMarkers(
  pts: readonly Pt[],
  s: Scale,
  kind: keyof typeof MARKER,
  movable: (p: Pt) => boolean = () => false,
  opts: DodgeOpts = {},
): Map<string, XY> {
  return dodgeDetailed(pts, s, kind, movable, opts).pos;
}

/**
 * Vereinigung der Fronten über alle Anbieter-Presets und beide
 * Overlay-Zustände der Hauptfolie. Der Platzierer beschriftet diese Punkte
 * immer (Rang 0), die Entzerrung rückt sie nur waagerecht — beides, damit kein
 * Schalter das Bild umbaut.
 */
export function frontUnion(all: readonly Pt[]): Set<string> {
  const front = new Set<string>();
  for (const pr of PRESETS) {
    const sel = new Set(presetModels(pr.id, [...all]));
    for (const on of [false, true])
      for (const f of paretoFront(visiblePoints(all, sel, on)).front)
        front.add(f.label);
  }
  return front;
}

export interface LayoutSource {
  /**
   * Hat das Chart das Kontingent-Overlay? Nur dann sind die Claude-Punkte
   * verschiebbar und ihre anderen Lagen Hindernis. Die Historie hat es nicht —
   * dort wären die `sub`-Lagen Phantom-Hindernisse.
   */
  overlay: boolean;
  /**
   * Angezeigte Lagen aus `dodgeMarkers`. Der Marker steht dann dort, sein
   * Klickziel auch — also rechnet der Platzierer damit. `alt` und `ghost`
   * bleiben wahre Lagen.
   */
  pos?: ReadonlyMap<string, XY>;
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

  const front = o.presets
    ? frontUnion(all)
    : new Set(paretoFront([...all]).front.map((f) => f.label));

  return all.map((p) => {
    const movable = o.overlay && p.sub !== undefined;
    const moved = subOn && movable;
    const cur = o.pos?.get(p.label) ?? (moved ? at(p.sub!, p.y) : at(p.x, p.y));
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

// --- Lupe ---------------------------------------------------------------------
//
// Ein eigener Klickschritt der Historie: Das Hauptchart dimmt, ein Panel im
// unteren Band zeigt die Region vergrößert (x 1,36×, y 2,3×) und darin alle
// gemessenen Effort-Stufen des Fokus-Modells als Leiter. Die Geometrie steht
// hier, damit die Tests dasselbe Panel rechnen wie die Komponente.

/** Panel der Lupe in viewBox-px des Historien-Charts. */
export const LENS = {
  x: 420,
  y: 96,
  w: 485,
  h: 120,
  L: 44,
  R: 8,
  T: 16,
  B: 18,
  font: 10,
  dotR: 4,
  ctxR: 3,
  /** Hindernis eines Stufenpunkts für den Platzierer. */
  hitR: 6,
  xTicks: [2, 3, 5, 10],
  yTicks: [65, 70, 75],
} as const;

export interface LensStep {
  c: Cfg;
  px: number;
  py: number;
  /** Die Stufe, die das Chart selbst plottet. */
  shown: boolean;
  text: string;
}

export interface LensView {
  /** Panel-Rahmen in Chart-Koordinaten. */
  box: Box;
  /** Quellrechteck der Region in Chart-Koordinaten. */
  src: Box;
  /** Panel-lokale Skala (0/0 = Panel-Ecke). */
  scale: Scale;
  ladder: LensStep[];
  /** Polyline der Leiter in Effort-Reihenfolge. */
  path: string;
  /** Nachbarpunkte der Region, um die Leiter herum entzerrt. */
  ctx: { p: Pt; px: number; py: number; front: boolean }[];
  labels: Map<string, Placed>;
  /** Klammer zwischen zwei Stufen mit gleichem Score. */
  bracket: { x1: number; x2: number; y: number; text: string } | null;
  obstacles: Obstacle[];
}

export function lensView(
  lens: Lens,
  pts: readonly Pt[],
  main: Scale,
): LensView {
  const { region } = lens;
  const scale = makeScale({
    W: LENS.w,
    H: LENS.h,
    L: LENS.L,
    R: LENS.R,
    T: LENS.T,
    B: LENS.B,
    xMax: region.x[1],
    xLog: { min: region.x[0] },
    yMax: region.y[1],
    yMin: region.y[0],
  });
  const box: Box = { x: LENS.x, y: LENS.y, w: LENS.w, h: LENS.h };
  const src: Box = {
    x: main.px(region.x[0]),
    y: main.py(region.y[1]),
    w: main.px(region.x[1]) - main.px(region.x[0]),
    h: main.py(region.y[0]) - main.py(region.y[1]),
  };
  const inRegion = (x: number, y: number) =>
    x >= region.x[0] &&
    x <= region.x[1] &&
    y >= region.y[0] &&
    y <= region.y[1];
  const front = new Set(paretoFront([...pts]).front.map((p) => p.label));
  const focus = pts.find((p) => p.label === lens.focus);
  const ctxPts = pts.filter(
    (p) => p.label !== lens.focus && inRegion(p.x, p.y),
  );

  // Die Leiter steht fest, die Nachbarn weichen ihr aus — dieselbe
  // Entzerrung wie im Hauptchart, nur auf der Panel-Skala.
  const stepId = (c: Cfg) => `${lens.focus} ${c.effort}`;
  const ladderPts: Pt[] = lens.ladder.map((c) => ({
    label: stepId(c),
    x: c.x,
    y: c.y,
    eur: fmt(c.x),
  }));
  const ladderIds = new Set(ladderPts.map((p) => p.label));
  const pos = dodgeMarkers(
    [...ladderPts, ...ctxPts],
    scale,
    "lens",
    (p) => !ladderIds.has(p.label),
  );
  const at = (p: Pt): XY => pos.get(p.label)!;

  const ladder: LensStep[] = lens.ladder.map((c, i) => {
    const q = at(ladderPts[i]!);
    const shown =
      !!focus && Math.abs(c.x - focus.x) < 1e-9 && Math.round(c.y) === focus.y;
    return {
      c,
      px: q.px,
      py: q.py,
      shown,
      text: `${c.effort} · ${fmt(c.x)} €${shown ? " · gezeigt" : ""}`,
    };
  });
  const path = ladder.map((l) => `${l.px},${l.py}`).join(" ");
  const ctx = ctxPts.map((p) => ({ p, ...at(p), front: front.has(p.label) }));

  // Klammer: das teuerste Paar mit gleichem Score — bei astra high und max.
  let bracket: LensView["bracket"] = null;
  for (let i = 0; i < ladder.length; i++) {
    for (let j = i + 1; j < ladder.length; j++) {
      const a = ladder[i]!;
      const b = ladder[j]!;
      if (Math.abs(a.c.y - b.c.y) > 1e-9 || b.c.x <= a.c.x) continue;
      const ratio = b.c.x / a.c.x;
      if (
        bracket &&
        ratio <= Number(bracket.text.slice(1, 4).replace(",", "."))
      )
        continue;
      bracket = {
        x1: a.px,
        x2: b.px,
        y: Math.max(a.py, b.py) + 12,
        text: `×${ratio.toFixed(1).replace(".", ",")} Preis, gleicher Score`,
      };
    }
  }

  // Hindernisse der Beschriftung: Kontextmarker, Klammer samt Text.
  const obstacles: Obstacle[] = ctx.map((c) =>
    squareAt(c, LENS.ctxR + 1, c.p.label),
  );
  if (bracket) {
    obstacles.push(
      {
        x: bracket.x1,
        y: bracket.y - 4,
        w: bracket.x2 - bracket.x1,
        h: 8,
        name: "Klammer",
      },
      {
        ...labelBox(
          bracket.text,
          (bracket.x1 + bracket.x2) / 2,
          bracket.y + 11,
          "middle",
          LENS.font,
        ),
        name: "Klammer-Text",
      },
    );
  }
  const lp: LayoutPoint[] = ladder.map((l) => ({
    id: l.c.effort,
    text: l.text,
    px: l.px,
    py: l.py,
    rank: 0,
    movable: false,
    alt: [],
    ghost: undefined,
  }));
  const layout = layoutLabels(lp, {
    font: LENS.font,
    bounds: plotBounds(scale),
    hitR: LENS.hitR,
    obstacles,
  });
  return {
    box,
    src,
    scale,
    ladder,
    path,
    ctx,
    labels: layout.core,
    bracket,
    obstacles,
  };
}
