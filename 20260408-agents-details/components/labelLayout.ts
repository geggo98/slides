// Beschriftungen der beiden Modell-Routing-Charts automatisch platzieren.
//
// Bis zum 04.09.2026 standen die Label-Versätze als handgestimmte `ax/dy/dx`
// an rund 180 Datenpunkten in `paretoData.ts`, und die Historien-Folie hatte
// für ihren Detailmodus einen eigenen Greedy-Platzierer in der Komponente.
// Beides kannte den Zustand nicht: Kontingent-Overlay, Anbieter-Filter und
// Station ändern die Punktmenge, die Platzierung blieb — gemessen 76
// Überschneidungen (`playwright-tests/pareto-label-qa.ts`).
//
// Dieses Modul ist rein (kein Vue, kein DOM) und deterministisch, damit vitest
// dieselbe Rechnung anstellt wie die Komponente.
//
// Zusicherungen
// -------------
// 1. Im Default (`core`) überschneidet sich nichts: kein Label mit einem
//    anderen, keines mit einem Klickziel, keines mit Quadrantenbeschriftung
//    oder Pfeilcluster, keines ragt aus dem Plot.
// 2. Ein Schalter verschiebt nichts. Das Layout ist eine Funktion des VOLLEN
//    Datensatzes: Punkte, die im Kontingent-Overlay woanders stehen, sind in
//    ALLEN ihren Lagen Hindernis (`alt`), und ihre eigenen Labels werden
//    zuletzt platziert — gegen eine Grundmenge, die von ihnen nichts weiß. Der
//    Durchgang „alle Namen" (`all`) legt nur nach, er rechnet nichts neu.
// 3. Rang 0 (Front) und Rang 1 (Story, Wanderung) werden immer platziert,
//    notfalls mit Führungslinie. Rang 2 bekommt einen Platz direkt am Marker
//    oder, nachdem alle Nahplätze vergeben sind, eine kurze Linie (Ringe 28
//    und 44 px) — sonst bleibt der Punkt im Default namenlos; Hover zeigt
//    ihn, „alle Namen" holt ihn mit längerer Linie nach.
//
// Hindernis eines Markers ist sein KLICKZIEL (`hitR`), nicht der sichtbare
// Punkt: So liegt kein Label unter einem fremden Hit-Target, und jedes Label
// bleibt der Griff für seinen Punkt. Marker, die einander verdeckten
// (astra/sol, terra/glm-5.3), rückt `dodgeMarkers` in `paretoChrome.ts`
// vorher auseinander; der Platzierer rechnet mit der ANGEZEIGTEN Lage
// (`LayoutSource.pos`), Geisterringe und Overlay-Lagen bleiben wahr.
//
// Textmaß
// -------
// Die Labels sind 0xProto, Monospace. Gemessen am 04.09.2026 mit
// `playwright-tests/font-metrics.ts` NACH dem Laden der Schrift: Vorschub
// 0,62 em je Zeichen; Glyphzelle 1,10 em über und 0,41 em unter der Grundlinie
// (das ist, was `getBoundingClientRect()` liefert); Tinte der Modellnamen
// höchstens 0,77 em über und 0,22 em unter der Grundlinie. Die Box des
// Platzierers ist die TINTE plus Rand — das Halo liegt um die Tinte, und die
// 1,5 em hohe Zelle würde in jeder Zeile ein Drittel Luft verschenken.
//
// Falle, in die jede frühere Messung gelaufen ist: 0xProto lädt erst, wenn
// ein Text es anfordert, und in diesem Deck registrierte lange kein globales
// @font-face die Schrift. Ein Deep-Link auf die Folie maß deshalb die
// Fallback-Monospace (Menlo/SF Mono: 0,60 em, Zelle 1,15 em). Die QA wartet
// jetzt auf `document.fonts`, und `style.css` des Decks lädt die Schrift von
// der ersten Folie an; die Konstanten unten gelten für 0xProto.

export type Anchor = "start" | "middle" | "end";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hindernis mit Namen — die Namen machen Kollisionsmeldungen lesbar. */
export interface Obstacle extends Box {
  name: string;
  /**
   * Weich: gilt nur im Default, nicht im Durchgang „alle Namen“. Für
   * Dekoration wie den halbtransparenten Pfeilcluster — ein Label mit Halo
   * bleibt darauf lesbar, und ohne diese Fläche fände der zweite Durchgang
   * für den 3–6-€-Knoten oft keinen Platz mehr.
   */
  soft?: boolean;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface XY {
  px: number;
  py: number;
}

export const TEXT = {
  /** Vorschub je Zeichen in em. */
  charEm: 0.62,
  /** Tinte über der Grundlinie in em (Oberlängen von f, l, h). */
  ascentEm: 0.77,
  /** Tinte unter der Grundlinie in em (Unterlängen von p, g, q). */
  descentEm: 0.22,
  /** Glyphzelle über der Grundlinie — so misst der Browser eine Textbox. */
  cellAscentEm: 1.1,
  /** Glyphzelle unter der Grundlinie. */
  cellDescentEm: 0.41,
  /** Rand um die Tinte: Halo (`paint-order: stroke`, 3 px) plus Luft. */
  pad: 2,
} as const;

/**
 * Gemessene Textbox (Glyphzelle, wie `getBoundingClientRect()` sie liefert)
 * in die Tintenbox des Modells umrechnen — ohne Rand. Für die Browser-QA, die
 * dieselben Konstanten benutzen muss wie der Platzierer.
 */
export function inkFromCell(cell: Box): Box {
  const font = cell.h / (TEXT.cellAscentEm + TEXT.cellDescentEm);
  const baseline = cell.y + TEXT.cellAscentEm * font;
  return {
    x: cell.x,
    y: baseline - TEXT.ascentEm * font,
    w: cell.w,
    h: (TEXT.ascentEm + TEXT.descentEm) * font,
  };
}

/** Sichtbarer Radius des Geisterrings plus Luft. */
export const GHOST_R = 7;
/**
 * Halbe Kantenlänge des Kastens, den eine Führungslinie nicht kreuzen darf:
 * der sichtbare Marker (r 7) — nicht das Klickziel. Das Klickziel ist zum
 * Klicken da; eine Haarlinie, die 8 px neben einem fremden Punkt vorbeiläuft,
 * verwirrt niemanden, eine durch den Punkt hindurch schon.
 */
const LEADER_CLEAR = 7;
/** Ab dieser Länge (Markermitte → Boxkante) bekommt ein Label eine Linie. */
export const LEADER_MIN = 24;
/** Die Linie setzt so weit hinter der Markermitte an (sichtbarer Marker r 7). */
const LEADER_START = 8;

export const hits = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inside = (a: Box, b: Box): boolean =>
  a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/**
 * Bounding-Box eines Textes, wie der Browser sie misst — plus `pad` rundum.
 * `x`/`y` sind Anker und Grundlinie, genau wie die SVG-Attribute des Labels.
 */
export function labelBox(
  text: string,
  x: number,
  y: number,
  ax: Anchor,
  font: number,
  charEm: number = TEXT.charEm,
): Box {
  const w = text.length * charEm * font;
  const left = ax === "start" ? x : ax === "end" ? x - w : x - w / 2;
  return {
    x: left - TEXT.pad,
    y: y - TEXT.ascentEm * font - TEXT.pad,
    w: w + 2 * TEXT.pad,
    h: (TEXT.ascentEm + TEXT.descentEm) * font + 2 * TEXT.pad,
  };
}

/** Quadrat um einen Marker — Klickziel (`hitR`) oder Geisterring. */
export const squareAt = (c: XY, r: number, name: string): Obstacle => ({
  x: c.px - r,
  y: c.py - r,
  w: 2 * r,
  h: 2 * r,
  name,
});

export interface LayoutPoint {
  id: string;
  text: string;
  /** Marker im aktuellen Zustand, in Chart-Pixeln. */
  px: number;
  py: number;
  /** 0 Front, 1 Story oder Wanderung, 2 Rest. */
  rank: 0 | 1 | 2;
  /** Steht in einem anderen Zustand woanders (Kontingent-Overlay). */
  movable: boolean;
  /** Lagen in anderen Zuständen — Hindernis für alle anderen, nicht für sich. */
  alt: readonly XY[];
  /** Geisterring im aktuellen Zustand — Hindernis für alle, auch für sich. */
  ghost?: XY;
}

export interface LayoutOpts {
  /** Schriftgröße der Labels im Default. */
  font: number;
  /** Schriftgröße im Durchgang „alle Namen" — kleiner, wenn es eng wird. */
  allFont?: number;
  /** Der Plot ohne Achsenband; Labels müssen vollständig darin liegen. */
  bounds: Box;
  /** Radius des Klickziels; sein Quadrat ist das Hindernis eines Markers. */
  hitR: number;
  /** Feste Hindernisse: Quadrantenbeschriftung, Pfeilcluster. */
  obstacles: readonly Obstacle[];
  /**
   * Ringe für Rang 2 im Default (Durchgang 1b). Default `RANK2_RINGS`;
   * `[]` schaltet den Durchgang ab — die Tests vergleichen beide Layouts.
   */
  rank2Rings?: readonly number[];
}

export interface Placed {
  id: string;
  /** Anker und Grundlinie — direkt als `x`/`y`/`text-anchor` zu binden. */
  x: number;
  y: number;
  ax: Anchor;
  box: Box;
  leader: Seg | null;
  rank: 0 | 1 | 2;
  /** „core": im Default sichtbar; „all": erst mit „alle Namen". */
  pass: "core" | "all";
  /** Kein freier Platz, Überlappung hingenommen — kommt nur in `all` vor. */
  forced: boolean;
}

export interface Layout {
  core: Map<string, Placed>;
  /** Obermenge von `core`, positionsgleich; dazu alles Nachgeholte. */
  all: Map<string, Placed>;
  /** Rang 0/1 ohne Platz im Default. Darf nie etwas enthalten — Test. */
  missing: string[];
  /** Rang 2 ohne freien Platz direkt am Marker; erscheinen erst in `all`. */
  dropped: string[];
}

/** Alle Marker-Hindernisse eines Datensatzes: aktuelle Lage, `alt`, Geist. */
export function markerBoxes(
  pts: readonly LayoutPoint[],
  hitR: number,
): Obstacle[] {
  return pts.flatMap((p) => ownBoxes(p, hitR));
}

function ownBoxes(p: LayoutPoint, hitR: number): Obstacle[] {
  const out = [squareAt(p, hitR, p.id)];
  p.alt.forEach((a, i) =>
    out.push(squareAt(a, hitR, `${p.id} (Lage ${i + 2})`)),
  );
  if (p.ghost) out.push(squareAt(p.ghost, GHOST_R, `${p.id} (Geist)`));
  return out;
}

// Liang–Barsky: Parameterintervall, in dem die Strecke im Kasten liegt.
function clip(s: Seg, b: Box): [number, number] | null {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, s.x1 - b.x],
    [dx, b.x + b.w - s.x1],
    [-dy, s.y1 - b.y],
    [dy, b.y + b.h - s.y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return t0 <= t1 ? [t0, t1] : null;
}

export const segHitsBox = (s: Seg, b: Box): boolean => clip(s, b) !== null;

/**
 * Führungslinie von der Markermitte zur nächstgelegenen Kante der Label-Box,
 * 8 px hinter der Mitte beginnend und 2 px vor der Kante endend. `null`, wenn
 * die Box so nah liegt, dass die Zuordnung ohne Linie klar ist.
 */
export function leaderFor(m: XY, box: Box): Seg | null {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const t = clip({ x1: m.px, y1: m.py, x2: cx, y2: cy }, box);
  if (!t) return null;
  const ex = m.px + (cx - m.px) * t[0];
  const ey = m.py + (cy - m.py) * t[0];
  const len = Math.hypot(ex - m.px, ey - m.py);
  if (len < LEADER_MIN) return null;
  const ux = (ex - m.px) / len;
  const uy = (ey - m.py) / len;
  return {
    x1: m.px + ux * LEADER_START,
    y1: m.py + uy * LEADER_START,
    x2: ex - ux * 2,
    y2: ey - uy * 2,
  };
}

interface Cand {
  x: number;
  y: number;
  ax: Anchor;
  box: Box;
  leader: Seg | null;
}

// Grundlinie so, dass die optische Mitte der Zeile auf der Markerhöhe liegt.
const midOf = (font: number) => ((TEXT.ascentEm - TEXT.descentEm) / 2) * font;

// Kandidaten „nah": acht Anker unmittelbar am Klickziel, ohne Linie. Reihenfolge
// ist Präferenz — rechts liest sich am natürlichsten, senkrecht darüber oder
// darunter am wenigsten.
const NEAR_FAN_Y = [0, -3, 3, -6, 6, -9, 9, -12, 12];
const NEAR_FAN_X = [0, -12, 12, -24, 24, -36, 36];

function* nearCands(
  p: LayoutPoint,
  font: number,
  hitR: number,
): Generator<Cand> {
  const g = hitR + TEXT.pad;
  const mid = midOf(font);
  const above = p.py - g - TEXT.descentEm * font - TEXT.pad;
  const below = p.py + g + TEXT.ascentEm * font + TEXT.pad;
  const c = (ax: Anchor, x: number, y: number): Cand => ({
    x,
    y,
    ax,
    box: labelBox(p.text, x, y, ax, font),
    leader: null,
  });
  for (const f of NEAR_FAN_Y) yield c("start", p.px + g, p.py + mid + f);
  for (const f of NEAR_FAN_Y) yield c("end", p.px - g, p.py + mid + f);
  yield c("start", p.px + g, above);
  yield c("start", p.px + g, below);
  yield c("end", p.px - g, above);
  yield c("end", p.px - g, below);
  for (const f of NEAR_FAN_X) yield c("middle", p.px + f, above);
  for (const f of NEAR_FAN_X) yield c("middle", p.px + f, below);
}

// Kandidaten „fern": Ringe nach außen, je 16 Richtungen, waagerecht bevorzugt.
// Winkel in Grad, y wächst nach unten — 270 ist also „oben". Der Durchgang
// „alle Namen“ sucht weiter draußen und in 32 Richtungen: Vollständigkeit
// geht dort vor Nähe.
const FAR_RINGS = [28, 44, 58, 75, 92, 110, 130, 150, 170, 195, 220, 250, 280];
const FAR_RINGS_ALL = [...FAR_RINGS, 320, 360, 400, 450];
/** Rang 2 im Default: nur die zwei innersten Ringe, siehe Durchgang 1b. */
export const RANK2_RINGS: readonly number[] = [28, 44];
const FAR_DIRS = [
  0, 180, 337.5, 22.5, 202.5, 157.5, 315, 45, 225, 135, 292.5, 67.5, 247.5,
  112.5, 270, 90,
];
const FAR_DIRS_ALL = FAR_DIRS.flatMap((d) => [d, d + 11.25]);
const FAR_FAN = [0, -8, 8];

function* farCands(
  p: LayoutPoint,
  font: number,
  rings: readonly number[] = FAR_RINGS,
  dirs: readonly number[] = FAR_DIRS,
): Generator<Cand> {
  const mid = midOf(font);
  for (const r of rings) {
    for (const deg of dirs) {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const ax: Anchor = cos > 0.38 ? "start" : cos < -0.38 ? "end" : "middle";
      const x = p.px + r * cos;
      const yc = p.py + r * Math.sin(rad);
      for (const f of FAR_FAN) {
        const y = yc + mid + f;
        const box = labelBox(p.text, x, y, ax, font);
        yield { x, y, ax, box, leader: leaderFor(p, box) };
      }
    }
  }
}

// Feste Punkte vor verschiebbaren — die Grundmenge darf vom Zustand der
// verschiebbaren nichts wissen. Dann Rang, dann Front von links nach rechts,
// alles andere von oben nach unten. Gleichstand entscheidet der Name, nie die
// Array-Reihenfolge: die hängt am Filter.
const byOrder = (a: LayoutPoint, b: LayoutPoint) =>
  Number(a.movable) - Number(b.movable) ||
  a.rank - b.rank ||
  (a.rank === 0 ? a.px - b.px : a.py - b.py) ||
  a.id.localeCompare(b.id);

export function layoutLabels(
  pts: readonly LayoutPoint[],
  o: LayoutOpts,
): Layout {
  const order = [...pts].sort(byOrder);
  const allFont = o.allFont ?? o.font;

  // Hindernisse je Punkt: alles Fremde in allen Lagen, dazu eigenes Klickziel
  // und eigener Geist — die eigenen `alt`-Lagen nicht, dort steht der Marker
  // nur in einem Zustand, in dem dieses Label ohnehin mitwandert.
  const foreign = new Map<string, Obstacle[]>();
  const foreignNarrow = new Map<string, Obstacle[]>();
  const own = new Map<string, Obstacle[]>();
  for (const p of order) {
    const f: Obstacle[] = [];
    const n: Obstacle[] = [];
    for (const q of order) {
      if (q === p) continue;
      f.push(...ownBoxes(q, o.hitR));
      n.push(...ownBoxes(q, LEADER_CLEAR));
    }
    foreign.set(p.id, f);
    foreignNarrow.set(p.id, n);
    const mine = [squareAt(p, o.hitR, p.id)];
    if (p.ghost) mine.push(squareAt(p.ghost, GHOST_R, `${p.id} (Geist)`));
    own.set(p.id, mine);
  }

  const hardChrome = o.obstacles.filter((b) => !b.soft);
  const fits = (
    p: LayoutPoint,
    c: Cand,
    taken: readonly Box[],
    pass: "core" | "all",
  ): boolean => {
    if (!inside(c.box, o.bounds)) return false;
    const chrome = pass === "core" ? o.obstacles : hardChrome;
    const blocks = [...chrome, ...foreign.get(p.id)!, ...own.get(p.id)!];
    if (taken.some((t) => hits(c.box, t))) return false;
    if (blocks.some((b) => hits(c.box, b))) return false;
    if (c.leader) {
      // Die Linie darf keine Beschriftung und keinen fremden sichtbaren Marker
      // kreuzen (`LEADER_CLEAR`, nicht `hitR`); sie beginnt im eigenen
      // Klickziel. Den eigenen Geisterring darf sie kreuzen: Er liegt auf dem
      // Wanderungspfeil dieses Punkts, und im Overlay steht er 27 px neben dem
      // Marker — mit ihm als Sperre fände claude-fable-5 dort keinen Platz.
      const l = c.leader;
      const crossed = [...chrome, ...foreignNarrow.get(p.id)!, ...taken];
      if (crossed.some((b) => segHitsBox(l, b))) return false;
    }
    return true;
  };

  const first = (
    p: LayoutPoint,
    gen: Iterable<Cand>,
    taken: readonly Box[],
    pass: "core" | "all" = "core",
  ): Cand | null => {
    for (const c of gen) if (fits(p, c, taken, pass)) return c;
    return null;
  };

  const place = (
    p: LayoutPoint,
    c: Cand,
    pass: "core" | "all",
    forced = false,
  ): Placed => ({
    id: p.id,
    x: c.x,
    y: c.y,
    ax: c.ax,
    box: c.box,
    leader: c.leader,
    rank: p.rank,
    pass,
    forced,
  });

  // Durchgang 1: die Grundmenge.
  const core = new Map<string, Placed>();
  const taken: Box[] = [];
  const missing: string[] = [];
  const dropped: string[] = [];
  const later: LayoutPoint[] = [];
  for (const p of order) {
    let c = first(p, nearCands(p, o.font, o.hitR), taken);
    if (!c && p.rank < 2) c = first(p, farCands(p, o.font), taken);
    if (c) {
      taken.push(c.box);
      core.set(p.id, place(p, c, "core"));
    } else if (p.rank < 2) {
      missing.push(p.id);
    } else {
      later.push(p);
    }
  }

  // Durchgang 1b: Rang 2 ohne Nahplatz bekommt eine KURZE Linie (Ringe 28
  // und 44 px), wo dort Platz ist. Erst nach allen Nahplätzen, damit die
  // Linie niemandem einen Platz wegnimmt — sie bewegt kein Label aus
  // Durchgang 1 (Test). Gemessen am 05.09.2026: +9 Namen über alle Zustände,
  // +2 an Station 9 der Historie, 0 auf der Hauptfolie.
  const rank2Rings = o.rank2Rings ?? RANK2_RINGS;
  for (const p of later) {
    const c = rank2Rings.length
      ? first(p, farCands(p, o.font, rank2Rings), taken)
      : null;
    if (c) {
      taken.push(c.box);
      core.set(p.id, place(p, c, "core"));
    } else {
      dropped.push(p.id);
    }
  }

  // Durchgang 2: „alle Namen" — dieselbe Grundmenge, unverändert, dazu der
  // Rest mit Linie. Wo auch das nicht geht, steht das Label rechts am Marker
  // und überlappt; die QA zählt das dort als „weich".
  const all = new Map(core);
  const takenAll = [...taken];
  for (const p of order) {
    if (all.has(p.id)) continue;
    let c = first(p, nearCands(p, allFont, o.hitR), takenAll, "all");
    if (!c)
      c = first(
        p,
        farCands(p, allFont, FAR_RINGS_ALL, FAR_DIRS_ALL),
        takenAll,
        "all",
      );
    let forced = false;
    if (!c) {
      c = nearCands(p, allFont, o.hitR).next().value as Cand;
      forced = true;
    }
    takenAll.push(c.box);
    all.set(p.id, place(p, c, "all", forced));
  }

  return { core, all, missing, dropped };
}

/**
 * Prüft ein Layout wie die Browser-QA: Label gegen Label, Label gegen
 * Hindernis, Label gegen den Rahmen. Leer heißt sauber.
 */
export function collisions(
  placed: Iterable<Placed>,
  obstacles: readonly Obstacle[],
  bounds?: Box,
): string[] {
  const list = [...placed];
  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      if (hits(a.box, list[j].box))
        out.push(`label/label  ${a.id}  ×  ${list[j].id}`);
    }
    for (const b of obstacles) {
      // Das eigene Klickziel und die eigenen anderen Lagen zählen nicht — dort
      // steht der Marker nur in einem Zustand, in dem dieses Label mitwandert.
      // Der eigene Geist zählt: er ist im aktuellen Zustand sichtbar.
      if (b.name === a.id || b.name.startsWith(`${a.id} (Lage`)) continue;
      if (hits(a.box, b)) out.push(`label/marker ${a.id}  ×  ${b.name}`);
    }
    if (bounds && !inside(a.box, bounds)) out.push(`label/rahmen ${a.id}`);
  }
  return out;
}
