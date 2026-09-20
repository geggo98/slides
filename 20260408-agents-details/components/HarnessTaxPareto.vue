<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDarkMode } from "@slidev/client";
import HarnessTaxSources from "./HarnessTaxSources.vue";
import { AGENT_COLORS, type ThemedColor } from "./chartData";
import { resolveColor } from "./chartConfig";
import {
  eur,
  frontFor,
  geoCostRatio,
  HARNESS_ORDER,
  HARNESSES,
  harnessLabel,
  harnessPairs,
  nativeUpgrades,
  nativeWinRate,
  pointsFor,
  subsetFront,
  type Bench,
  type Harness,
  type HarnessMeta,
  type HPt,
} from "./harnessTaxData";
import { fmt, makeScale, type Pt } from "./paretoData";
import {
  dodgeDetailed,
  HIT_R,
  LABEL_FONT,
  MARKER,
  plotBounds,
  tickLabel,
} from "./paretoChrome";
import {
  hits,
  inside,
  labelBox,
  layoutLabels,
  leaderFor,
  squareAt,
  TEXT,
  type LayoutPoint,
  type Obstacle,
  type Placed,
  type Seg,
  type XY,
} from "./labelLayout";
import { useCrosshairs } from "./useCrosshairs";

// HarnessTax-Streudiagramm (21 Modell×Harness-Paare) im Look von
// `ModelRoutingPareto.vue`: dieselbe Gitter-/Tick-/Achsen-Optik, dieselben
// Markergrößen (`MARKER.pareto`), derselbe Platzierer (`labelLayout.ts`),
// dieselbe Entzerrung (`dodgeDetailed`) und dieselben Fadenkreuze
// (`useCrosshairs`). Bewusst OHNE die DeepSWE-Schicht (Quadranten,
// Pfeilcluster, Kontingent-Overlay, Anbieter-Filter): andere Studie, andere
// Erzählung. Die Daten sind `HPt` (USD, CI, Bootstrap); für die geteilten
// Bausteine, die `Pt` erwarten, gibt es unten den Adapter `toPt`.
//
// Kodierung: Farbe UND Form = Harness (Quadrat Pi, Dreieck Codex, Raute
// Claude Code — die Symbole der Studie, `HarnessMeta.symbol`). Die Farben
// sind `AGENT_COLORS`, dieselben wie in Kapitel 10 (`HarnessTable.vue`,
// `RadarCompare.vue`). Der Paletten-Validator maß Light PASS, Dark nur WARN
// (ΔE 7,7 Claude Code↔Codex) — deshalb ist die Form Pflicht, auch in der
// Legende. Front vs. dominiert = groß/gefüllt mit `--color-text-primary`-
// Rand vs. klein/abgeschwächt. Beschriftung: EIN Label je Modell (siehe
// `labelAnchors`), „alle Namen" holt die anderen 14 nach.
//
// Klick-Dramaturgie (Prop `step` ← `$clicks`, Folie `clicks: 4`):
//   0  alle 21 Punkte
//   1  globale Pareto-Front (gestrichelt) — bleibt ab hier sichtbar
//   2  Claude-Code-Aufpreis: je Modell ein Pfeil Pi → Claude Code mit dem
//      Kostenfaktor, Codex-Punkte gedimmt, Legende nennt das geometrische
//      Mittel (`geoCostRatio`)
//   3  natives → bestes Harness: Geisterring am nativen Punkt, Pfeil zum
//      Harness mit dem höchsten Erfolg — nur wo sie sich unterscheiden
//      (`nativeUpgrades`: SWE 4, TB 5 Pfeile, „9 von 12"). Die Aufpreis-
//      Pfeile verschwinden. Luna auf SWE bekommt keinen Pfeil: Codex (nativ)
//      und Claude Code liegen beide bei 55,6 %, Gleichstand zählt als nativ.
//   4  (Schlusstext der Folie) — das Chart bleibt im Zustand von Schritt 3.
// Rückwärts ist reines Mapping — kein Timer, kein Zustand außer `step`.

const props = withDefaults(defineProps<{ step?: number }>(), { step: 0 });

const { isDark } = useDarkMode();
const sourcesOpen = ref(false);
const bench = ref<Bench>("swe");
const allOn = ref(false);

const BENCH_LABEL: Record<Bench, string> = {
  swe: "SWE-bench Lite",
  tb: "Terminal-Bench 2.0",
};
const BENCHES: readonly Bench[] = ["swe", "tb"];

// Nach JEDER Zeigerbedienung eines Buttons den Fokus abgeben: Slidev schaltet
// seine Shortcuts ab, solange ein Button fokussiert ist — sonst steht die
// Folie im Vortrag still, sobald nach einem Klick der Klicker kommt (Muster
// `CodexEffortBreakEven.vue`).
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();
const blurLater = () => {
  blurActive();
  setTimeout(blurActive, 0);
};

// Eigene Skala: Die DeepSWE-Skala (`PARETO_SCALE`) läuft 0,08–30 €; hier
// reichen die 21 Paare von 0,03 € bis 1,55 € — mit ihr klebten alle Punkte am
// linken Rand. Breite und Ränder wie das Pareto-Chart, 280 hoch, damit unter
// der Folie noch der Schlusstext Platz hat.
const S = makeScale({
  W: 900,
  H: 280,
  L: 46,
  R: 14,
  T: 12,
  B: 30,
  xMax: 1.8,
  xLog: { min: 0.02 },
  yMax: 100,
});
const { W, H, L, R, T, B, px, py } = S;
const X_TICKS = [0.02, 0.05, 0.1, 0.2, 0.5, 1];
const Y_TICKS = [0, 20, 40, 60, 80, 100];

const HARNESS_COLOR: Record<Harness, ThemedColor> = {
  pi: AGENT_COLORS.pi,
  codex: AGENT_COLORS.codex,
  cc: AGENT_COLORS.claudeCode,
};
const colorFor = (h: Harness) => resolveColor(HARNESS_COLOR[h], isDark);
const symbolOf = (h: Harness): HarnessMeta["symbol"] =>
  HARNESSES.find((m) => m.key === h)?.symbol ?? "square";

// Markerformen als Pfad um (cx, cy) mit „Radius" r — so skaliert, dass alle
// drei etwa gleich groß wirken und keine Form über das Halbmaß hinausragt,
// mit dem `dodgeDetailed` rechnet (`MARKER.pareto`: Front 8 = r 7 + halber
// Rand, dominiert 5 = r 4,5 + halber Rand).
function shapePath(
  sym: HarnessMeta["symbol"],
  cx: number,
  cy: number,
  r: number,
): string {
  const f = (v: number) => v.toFixed(2);
  if (sym === "square") {
    const h = r * 0.85;
    return `M${f(cx - h)},${f(cy - h)}h${f(2 * h)}v${f(2 * h)}h${f(-2 * h)}Z`;
  }
  if (sym === "triangle") {
    const R = r * 1.1;
    const dx = R * Math.cos(Math.PI / 6);
    return `M${f(cx)},${f(cy - R)}L${f(cx + dx)},${f(cy + R / 2)}L${f(cx - dx)},${f(cy + R / 2)}Z`;
  }
  const d = r * 1.05;
  return `M${f(cx)},${f(cy - d)}L${f(cx + d)},${f(cy)}L${f(cx)},${f(cy + d)}L${f(cx - d)},${f(cy)}Z`;
}

// --- Punkte, Adapter, Entzerrung ------------------------------------------

const key = (p: HPt) => `${p.model}:${p.harness}`;
const nameOf = (p: HPt) => `${p.modelLabel} · ${harnessLabel(p.harness)}`;
/** „alle Namen": nur der Modellname ohne Anbieter-Präfix („Opus 4.8"). Den
 * Harness sagt der Marker daneben (Form + Farbe), der Tooltip nennt beides.
 * Gemessen am 20.09.2026 mit dem Platzierer: „Claude Opus 4.8 · Claude
 * Code" (28 Zeichen) → 5 von 21 Labels erzwungen überlappend je Benchmark,
 * „Opus 4.8 · CC" → 3, „Opus 4.8" → 0 (SWE) bzw. 1 (TB). */
const shortOf = (p: HPt) => p.modelLabel.replace(/^(Claude|GPT-5\.6) /, "");
const pts = computed<HPt[]>(() => [...pointsFor(bench.value)]);

/** HPt → Pt für die geteilten Bausteine: x in Euro, `label` = „Modell ·
 * Harness" (eindeutig, und was Fadenkreuz-Badge und Tooltip zeigen sollen),
 * `ci` = halbe Breite des 95-%-Intervalls in Prozentpunkten. */
const toPt = (p: HPt): Pt => ({
  label: nameOf(p),
  x: eur(p.usd),
  y: p.y,
  eur: fmt(eur(p.usd)),
  ci: (p.yCi[1] - p.yCi[0]) / 2,
});
const ptsP = computed<Pt[]>(() => pts.value.map(toPt));

const front = computed(() => frontFor(bench.value).front);
const frontSet = computed(() => new Set(front.value.map((p) => key(p))));
const isFront = (p: HPt) => frontSet.value.has(key(p));
const rOf = (p: HPt) => (isFront(p) ? MARKER.pareto.front : MARKER.pareto.dom);

// Entzerrung: Sol und Kimi sitzen auf SWE-bench Lite beide bei ≈0,45 € /
// 72–74 % (Pi), Sonnet Pi und Sonnet Claude Code bei 0,58 € / 64–67 %. Die
// angezeigte Lage (`at`) bekommen Marker, Front-Polylines, Pfeilenden,
// Klickziele und der Platzierer; Fadenkreuz-Linien und Badges bleiben wahr.
const dodge = computed(() => dodgeDetailed(ptsP.value, S, "pareto"));
const at = (p: HPt): XY =>
  dodge.value.pos.get(nameOf(p)) ?? { px: px(eur(p.usd)), py: py(p.y) };

const polyOf = (list: readonly HPt[]) =>
  list
    .slice()
    .sort((a, b) => a.usd - b.usd)
    .map((p) => `${at(p).px},${at(p).py}`)
    .join(" ");
const frontPath = computed(() => polyOf(front.value));

// --- Schritte ----------------------------------------------------------------

const showFront = computed(() => props.step >= 1);

// Lokale Übersteuerung aus der Legende: ein Harness hervorheben (dimmt die
// anderen, zeichnet seine Teilfront in seiner Farbe). Zweiter Klick oder der
// nächste Klickschritt heben sie auf (Muster `override` in
// `ModelRoutingHistory.vue`).
const hl = ref<Harness | null>(null);
watch(
  () => props.step,
  () => {
    hl.value = null;
  },
);
const toggleHl = (h: Harness) => {
  hl.value = hl.value === h ? null : h;
};
const hlFront = computed<HPt[]>(() =>
  hl.value ? subsetFront(bench.value, (p) => p.harness === hl.value) : [],
);
const hlPath = computed(() => polyOf(hlFront.value));

const dimmed = (p: HPt) =>
  hl.value ? p.harness !== hl.value : props.step === 2 && p.harness === "codex";

// --- Pfeile ------------------------------------------------------------------
//
// Flache Bögen statt Geraden: Sol und Kimi starten auf SWE-bench Lite fast am
// selben Punkt und laufen beide nach rechts oben — als Geraden lägen sie
// übereinander; und Sonnet Pi → Sonnet Claude Code ist nur 13 px lang, ein
// Bogen gibt dem Pfeil sichtbare Länge. Spitze wie bei den Preis-Wanderungen
// des Modell-Charts (`movedSegments`): kleiner Kopf, dünner Schaft, Ende
// 2 px außerhalb des Zielmarkers, Anfang 2 px außerhalb des Startmarkers.

const ARROW_FONT = 10;
const HEAD_L = 7;
const HEAD_W = 3.5;
const CLEAR = 2;

interface Curve {
  id: string;
  d: string;
  head: string;
  text: string;
  tip: string;
  /** Sichtbare Teilkurve (Bézier-Kontrollpunkte) und Bogen-Normale. */
  q: [XY, XY, XY];
  nx: number;
  ny: number;
}
interface Arrow extends Curve {
  /** Anker und Grundlinie der Beschriftung (Anker „middle"). */
  tx: number;
  ty: number;
  box: Obstacle;
  /** Vorhergesagte Box (x y w h) für die Browser-QA. */
  boxAttr: string;
  /** Haarlinie vom Kurvenpunkt zur Box, wenn die Beschriftung abgesetzt
   * steht — sonst ist im dichten Feld nicht klar, zu welchem Pfeil sie
   * gehört (gemessen 20.09.2026: „1,7×" von Kimi stand über Opus' Pfeil). */
  leader: Seg | null;
}

const bez = (p0: XY, p1: XY, p2: XY, t: number): XY => {
  const u = 1 - t;
  return {
    px: u * u * p0.px + 2 * u * t * p1.px + t * t * p2.px,
    py: u * u * p0.py + 2 * u * t * p1.py + t * t * p2.py,
  };
};
const dist = (a: XY, b: XY) => Math.hypot(a.px - b.px, a.py - b.py);
/** Teilkurve [t0, t1] einer quadratischen Bézier (de Casteljau). */
function subQuad(p0: XY, p1: XY, p2: XY, t0: number, t1: number): XY[] {
  const lerp = (a: XY, b: XY, t: number): XY => ({
    px: a.px + (b.px - a.px) * t,
    py: a.py + (b.py - a.py) * t,
  });
  // Rechter Teil ab t0 …
  const a1 = lerp(p0, p1, t0);
  const b1 = lerp(p1, p2, t0);
  const q0 = lerp(a1, b1, t0);
  const q1 = b1;
  const q2 = p2;
  // … davon der linke Teil bis (t1 − t0) / (1 − t0).
  const s = t0 >= 1 ? 0 : (t1 - t0) / (1 - t0);
  const a2 = lerp(q0, q1, s);
  const b2 = lerp(q1, q2, s);
  return [q0, a2, lerp(a2, b2, s)];
}

function bowArrow(
  id: string,
  a: XY,
  ra: number,
  b: XY,
  rb: number,
  text: string,
  tip: string,
): Curve {
  const len = dist(a, b) || 1;
  const ux = (b.px - a.px) / len;
  const uy = (b.py - a.py) / len;
  // Normale so, dass ein Pfeil nach rechts nach OBEN ausbaucht; kurze Pfeile
  // bauchen stärker, damit zwischen den Markern etwas zu sehen bleibt.
  const nx = uy;
  const ny = -ux;
  const k = len < 40 ? 14 : Math.max(8, len * 0.1);
  const p0 = a;
  const p1 = { px: (a.px + b.px) / 2 + nx * k, py: (a.py + b.py) / 2 + ny * k };
  const p2 = b;
  let t0 = 0;
  let t1 = 1;
  for (let t = 0; t <= 1; t += 0.005) {
    if (dist(bez(p0, p1, p2, t), a) >= ra + CLEAR) {
      t0 = t;
      break;
    }
  }
  for (let t = 1; t >= 0; t -= 0.005) {
    if (dist(bez(p0, p1, p2, t), b) >= rb + CLEAR) {
      t1 = t;
      break;
    }
  }
  if (t1 <= t0) t1 = Math.min(1, t0 + 0.05);
  const [q0, q1, q2] = subQuad(p0, p1, p2, t0, t1) as [XY, XY, XY];
  // Tangente am Ende der Teilkurve zeigt die Spitze aus.
  const tl = dist(q1, q2) || 1;
  const ex = (q2.px - q1.px) / tl;
  const ey = (q2.py - q1.py) / tl;
  const bx = q2.px - ex * HEAD_L;
  const by = q2.py - ey * HEAD_L;
  const head = `${q2.px},${q2.py} ${bx - ey * HEAD_W},${by + ex * HEAD_W} ${bx + ey * HEAD_W},${by - ex * HEAD_W}`;
  const f = (v: number) => v.toFixed(1);
  const d = `M${f(q0.px)},${f(q0.py)}Q${f(q1.px)},${f(q1.py)} ${f(q2.px)},${f(q2.py)}`;
  return { id, d, head, text, tip, q: [q0, q1, q2], nx, ny };
}

// Beschriftung eines Pfeils: Kandidaten entlang des Bogens (Mitte zuerst),
// außen bevorzugt, innen erlaubt; der erste, der weder einen Marker, einen
// Geisterring noch eine schon gesetzte Pfeil-Beschriftung trifft und im Plot
// liegt, gewinnt. Ohne Treffer bleibt die Mitte außen — sichtbar, notfalls
// überlappend. `ty` ist die Grundlinie, damit `labelBox` dieselbe Box rechnet
// wie der Browser.
// Kandidaten: [t auf der Kurve, Seite (+1 außen), Abstand in Vielfachen]
const LABEL_T = [0.5, 0.38, 0.62, 0.26, 0.74, 0.15, 0.85, 0.06, 0.94];
const LABEL_CANDS: readonly [number, number, number][] = [1, 1.9, 2.8].flatMap(
  (far) =>
    LABEL_T.flatMap((t): [number, number, number][] => [
      [t, 1, far],
      [t, -1, far],
    ]),
);
function curveLabel(c: Curve, t: number, side: number, far = 1) {
  const m = bez(c.q[0], c.q[1], c.q[2], t);
  const off = (5 + ARROW_FONT * 0.55) * far;
  const tx = m.px + c.nx * off * side;
  const ty =
    m.py +
    c.ny * off * side +
    ((TEXT.ascentEm - TEXT.descentEm) / 2) * ARROW_FONT;
  const box = { ...labelBox(c.text, tx, ty, "middle", ARROW_FONT), name: c.id };
  return { tx, ty, box, m, far };
}
function placeArrows(curves: Curve[], blocks: readonly Obstacle[]): Arrow[] {
  const bounds = plotBounds(S);
  const taken: Obstacle[] = [];
  return curves.map((c) => {
    // Ohne Text keine Beschriftung — und kein Hindernis (leere Box).
    if (!c.text) {
      const box = { x: 0, y: 0, w: 0, h: 0, name: c.id };
      return { ...c, tx: 0, ty: 0, box, boxAttr: "", leader: null };
    }
    let pick: ReturnType<typeof curveLabel> | null = null;
    let fallback: ReturnType<typeof curveLabel> | null = null;
    let fewest = Infinity;
    for (const [t, side, far] of LABEL_CANDS) {
      const l = curveLabel(c, t, side, far);
      if (!inside(l.box, bounds)) continue;
      const n = [...blocks, ...taken].filter((b) => hits(l.box, b)).length;
      if (n === 0) {
        pick = l;
        break;
      }
      // Kein freier Platz: der Kandidat mit den wenigsten Treffern, früh in
      // der Liste (also nah an der Mitte) bevorzugt.
      if (n < fewest) {
        fewest = n;
        fallback = l;
      }
    }
    pick ??= fallback ?? curveLabel(c, 0.5, 1);
    taken.push(pick.box);
    const boxAttr = [pick.box.x, pick.box.y, pick.box.w, pick.box.h]
      .map((v) => v.toFixed(1))
      .join(" ");
    // `leaderFor` beginnt 8 px hinter dem Kurvenpunkt und liefert erst ab
    // 24 px Abstand eine Linie — nah am Pfeil braucht es keine.
    const leader = pick.far > 1 ? leaderFor(pick.m, pick.box) : null;
    const { tx, ty, box } = pick;
    return { ...c, tx, ty, box, boxAttr, leader };
  });
}

const de1 = (v: number) => v.toFixed(1).replace(".", ",");
const signed = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de1(Math.abs(v))}`;

// Schritt 2: Aufpreis-Pfeile Pi → Claude Code, Beschriftung = Kostenfaktor.
const surcharge = computed<Curve[]>(() =>
  props.step === 2
    ? harnessPairs(bench.value, "pi", "cc").map((q) =>
        bowArrow(
          `up-${q.model}`,
          at(q.from),
          rOf(q.from),
          at(q.to),
          rOf(q.to),
          `${de1(q.costRatio)}×`,
          `${q.from.modelLabel}: Claude Code kostet ${de1(q.costRatio)}× Pi ` +
            `(${fmt(eur(q.from.usd))} → ${fmt(eur(q.to.usd))} €/Task), ` +
            `Erfolg ${signed(q.dSuccess)} Pkt.`,
        ),
      )
    : [],
);

// Schritt 3: Geisterring am nativen Punkt, Pfeil zum besten Harness.
const RING_R = 11;
const upgrades = computed(() =>
  props.step >= 3 ? nativeUpgrades(bench.value) : [],
);
const ghostArrows = computed<Curve[]>(() =>
  upgrades.value.map((u) =>
    bowArrow(
      `nat-${u.model}`,
      at(u.from),
      RING_R,
      at(u.to),
      rOf(u.to),
      // Ohne Beschriftung: die Richtung ist die Aussage, die Zahl steht im
      // Tooltip. Mit „+4,4 Pkt." an vier bis fünf kurzen Pfeilen im dichten
      // Feld um Kimi/Sol/Opus war nichts mehr lesbar (gemessen 20.09.2026).
      "",
      `${u.from.modelLabel}: ` +
        `${harnessLabel(u.to.harness)} löst ${signed(u.dSuccess)} Punkte mehr ` +
        `als das native ${harnessLabel(u.native)}`,
    ),
  ),
);
// Hindernisse der Pfeil-Beschriftung: alle Marker (sichtbares Halbmaß plus
// Luft — nicht das Klickziel, das wäre zu grob) und die Geisterringe.
const arrowBlocks = computed<Obstacle[]>(() => [
  ...pts.value.map((p) => squareAt(at(p), rOf(p) + 3, key(p))),
  ...upgrades.value.map((u) =>
    squareAt(at(u.from), RING_R + 1, `ring-${u.model}`),
  ),
]);
const arrows = computed<Arrow[]>(() =>
  placeArrows([...surcharge.value, ...ghostArrows.value], arrowBlocks.value),
);

// --- Beschriftung ------------------------------------------------------------
//
// Default: EIN Label je MODELL. Alle drei Harness-Punkte eines Modells tragen
// denselben Namen und liegen auf der log-Skala oft nur 60–80 px auseinander;
// 21 Labels waren unlesbar. Anker: der Frontpunkt, wenn das Modell einen hat,
// sonst der mit dem höchsten Erfolg (oben im Chart, am ehesten frei) —
// Tiebreak `HARNESS_ORDER`. Alle 21 Marker tragen ihr `<title>`-Tooltip.
// „alle Namen": 21 Labels (kurzer Modellname, siehe `shortOf`) über
// denselben Platzierer, der zweite Durchgang (`all`) mit Führungslinie.
const labelAnchors = computed<HPt[]>(() => {
  const byModel = new Map<string, HPt[]>();
  for (const p of pts.value) {
    const arr = byModel.get(p.model) ?? [];
    arr.push(p);
    byModel.set(p.model, arr);
  }
  return [...byModel.values()].map((list) => {
    const onFront = list.find((p) => isFront(p));
    if (onFront) return onFront;
    return [...list].sort(
      (a, b) =>
        b.y - a.y ||
        HARNESS_ORDER.indexOf(a.harness) - HARNESS_ORDER.indexOf(b.harness),
    )[0]!;
  });
});
// Hindernisse des Modell-Label-Platzierers: die Pfeil-Beschriftungen (hart)
// und die Pfeilspitzen (weich). Weich heißt: nur der Default-Durchgang weicht
// ihnen aus, „alle Namen" darf sie im Notfall überdecken — die Pfeile liegen
// deshalb ÜBER den Label-Flächen (siehe Template). Nur die Spitze, nicht der
// Bogen: mit dem ganzen Bogen als Hindernis (Kästchen alle 4 px) fand „Kimi
// K3" in Schritt 2 auf SWE-bench Lite keinen Nahplatz mehr und landete mit
// 200 px Führungslinie am unteren Rand; ein Bogen hinter Glyphen bleibt
// lesbar, eine verdeckte Spitze nicht. Ohne die Spitze als Hindernis stand
// auf Terminal-Bench 2.0 in Schritt 3 die des Sol-Pfeils unter dem
// „GPT-5.6 Sol"-Kasten, einer von fünf Story-Pfeilen war unsichtbar
// (gemessen 20.09.2026, playwright-tests/harness-review-probe3.ts).
const arrowHeads = computed<Obstacle[]>(() =>
  arrows.value.map((a) => ({
    ...squareAt(a.q[2], HEAD_L + 1, `${a.id}-spitze`),
    soft: true,
  })),
);
const obstacles = computed<Obstacle[]>(() => [
  ...arrows.value.filter((a) => a.text).map((a) => a.box),
  ...arrowHeads.value,
]);
const layoutOpts = computed(() => ({
  font: LABEL_FONT.pareto,
  allFont: LABEL_FONT.historyAll,
  bounds: plotBounds(S),
  hitR: HIT_R,
  obstacles: obstacles.value,
}));
const lp = (p: HPt, text: string, rank: 0 | 1 | 2): LayoutPoint => ({
  id: key(p),
  text,
  px: at(p).px,
  py: at(p).py,
  rank,
  movable: false,
  alt: [],
});
// Auch im Default kennt der Platzierer ALLE 21 Klickziele als Hindernis —
// ein Anker-Label darf nicht über einem namenlosen Marker liegen. Die 14
// Nicht-Anker gehen als PUNKTE mit leerem Text hinein, nicht als feste
// Hindernisse: ein Punkt sperrt Label-Boxen mit seinem Klickziel (`hitR`),
// Führungslinien aber nur mit dem sichtbaren Marker (`LEADER_CLEAR`) — als
// festes Hindernis sperrte er auch jede Linie im Umkreis von 10 px, und im
// dichten Feld um Kimi K3 fand dann kein Anker mehr einen Platz (gemessen
// 20.09.2026, Schritt 3: „forced"). Ihr eigenes leeres Label ist ein
// 4-px-Kasten direkt am Marker; `placed` filtert es weg. Anker ohne Front
// sind Rang 1 (Story): immer platziert, notfalls mit Führungslinie.
const anchorSet = computed(() => new Set(labelAnchors.value.map(key)));
const layoutCore = computed(() => {
  const l = layoutLabels(
    pts.value.map((p) =>
      anchorSet.value.has(key(p))
        ? lp(p, p.modelLabel, isFront(p) ? 0 : 1)
        : lp(p, "", 2),
    ),
    { ...layoutOpts.value, rank2Rings: [] },
  );
  const anchors = new Map<string, Placed>();
  for (const [id, pl] of l.all)
    if (anchorSet.value.has(id)) anchors.set(id, pl);
  return anchors;
});
// 21 Labels „Modell · Harness" (bis 28 Zeichen) passen nur in der kleinen
// Schrift — beide Durchgänge mit `historyAll`, sonst blieben nach dem ersten
// Durchgang kaum Nahplätze übrig. Gedimmte Punkte (Schritt 2: Codex;
// Hervorhebung: die anderen Harness) gehen wie die Nicht-Anker im Default
// als PUNKTE ohne Text hinein: ihr Label verschwindet mit dem Marker, statt
// bei 0,3 Deckkraft den Platz zu belegen, den die Kostenfaktoren brauchen —
// gemessen 20.09.2026 („alle Namen" + Schritt 2): vorher 4 erzwungene Labels
// auf SWE, zwei davon über „2,0×" und „3,5×".
const layoutAll = computed(() => {
  const l = layoutLabels(
    pts.value.map((p) =>
      dimmed(p) ? lp(p, "", 2) : lp(p, shortOf(p), isFront(p) ? 0 : 2),
    ),
    { ...layoutOpts.value, font: LABEL_FONT.historyAll },
  );
  const named = new Map<string, Placed>();
  for (const p of pts.value) {
    const pl = l.all.get(key(p));
    if (pl && !dimmed(p)) named.set(key(p), pl);
  }
  return named;
});
// Erzwungene Plätze (`forced`) setzt der Platzierer rechts an den Marker,
// ohne auf den Rahmen zu achten — am rechten Rand ragte „Opus 4.8 · Claude
// Code" aus dem Plot. Nachbessern: über den Rand hinaus → gespiegelt links
// an den Marker („end"), senkrecht in den Plot geklemmt.
const fixForced = (pl: Placed): Placed => {
  const b = plotBounds(S);
  if (!pl.forced || inside(pl.box, b)) return pl;
  const font = LABEL_FONT.historyAll;
  const g = HIT_R + TEXT.pad;
  let { x, ax } = pl;
  if (pl.box.x + pl.box.w > b.x + b.w) {
    ax = "end";
    x = pl.x - 2 * g;
  }
  const text = shortOf(pts.value.find((p) => key(p) === pl.id)!);
  const box = labelBox(text, x, pl.y, ax, font);
  let y = pl.y;
  if (box.y < b.y) y += b.y - box.y;
  if (box.y + box.h > b.y + b.h) y -= box.y + box.h - (b.y + b.h);
  return { ...pl, x, y, ax, box: labelBox(text, x, y, ax, font) };
};
const placed = computed<Map<string, Placed>>(() =>
  allOn.value
    ? new Map([...layoutAll.value].map(([id, pl]) => [id, fixForced(pl)]))
    : layoutCore.value,
);

interface LabelView {
  id: string;
  p: HPt;
  pl: Placed;
  text: string;
  font: number;
  /** Vorhergesagte Box (x y w h) — die Browser-QA hält sie gegen die gemessene. */
  box: string;
  rect: { x: number; y: number; w: number; h: number };
}
const fontOf = (pl: Placed) =>
  allOn.value || pl.pass === "all" ? LABEL_FONT.historyAll : LABEL_FONT.pareto;
const view = (p: HPt, pl: Placed, text: string): LabelView => {
  const font = fontOf(pl);
  const b = labelBox(text, pl.x, pl.y, pl.ax, font);
  return {
    id: key(p),
    p,
    pl,
    text,
    font,
    box: [b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(" "),
    rect: b,
  };
};
const labels = computed<LabelView[]>(() =>
  pts.value.flatMap((p) => {
    const pl = placed.value.get(key(p));
    if (!pl) return [];
    return [view(p, pl, allOn.value ? shortOf(p) : p.modelLabel)];
  }),
);
const leaders = computed(() =>
  labels.value.flatMap(({ id, pl }) =>
    pl.leader ? [{ id, ...pl.leader }] : [],
  ),
);
// Ein Modell-Label dimmt im Default nicht mit seinem Ankerpunkt — es steht
// für das Modell, nicht für den Harness; in „alle Namen" tragen gedimmte
// Punkte gar kein Label (siehe `layoutAll`).
const labelCls = (l: LabelView) => [
  isFront(l.p) ? "ht-label-front" : "ht-label-dom",
  pinCls(nameOf(l.p)),
];
const markerPath = (p: HPt) =>
  shapePath(symbolOf(p.harness), at(p).px, at(p).py, isFront(p) ? 7 : 4.5);
const arrowLeaders = computed(() =>
  arrows.value.flatMap((a) => (a.leader ? [{ id: a.id, ...a.leader }] : [])),
);
const arrowTexts = computed(() => arrows.value.filter((a) => a.text));
const unnamed = computed(() =>
  pts.value.filter((p) => !placed.value.has(key(p))).map((p) => nameOf(p)),
);

// --- Fadenkreuze -------------------------------------------------------------

const { byLabel, hovered, pinned, togglePin, clear, crosshairs, pinCls } =
  useCrosshairs(ptsP, S, { ciBadge: true });
const pin = (p: HPt) => {
  togglePin(nameOf(p));
  blurLater();
};
// Pins lösen beim Benchmark-Wechsel: „Claude Opus 4.8 · Pi" gibt es in beiden
// Sätzen, ein stehen gebliebenes Fadenkreuz zeigte sonst still die Werte des
// anderen Benchmarks unter demselben Namen.
watch(bench, clear);

// Hover-Name für Punkte ohne Beschriftung: mit demselben Platzierer gegen die
// gesetzten Labels und Pfeil-Beschriftungen gerechnet, damit er keines
// verdeckt. Transient, zuoberst.
const hoverLabels = computed<LabelView[]>(() => {
  const want = new Set([
    ...pinned.value,
    ...(hovered.value ? [hovered.value] : []),
  ]);
  const taken: Obstacle[] = [...placed.value.values()].map((v) => ({
    ...v.box,
    name: v.id,
  }));
  const out: LabelView[] = [];
  for (const name of want) {
    const p = pts.value.find((q) => nameOf(q) === name);
    if (!p || placed.value.has(key(p))) continue;
    const pl = layoutLabels([lp(p, nameOf(p), 0)], {
      ...layoutOpts.value,
      obstacles: [...obstacles.value, ...taken],
    }).all.get(key(p));
    if (pl) out.push(view(p, pl, nameOf(p)));
  }
  return out;
});

// Fehlerbalken nur an gepinnten Punkten: ±15 Punkte bei 30 Tasks × 3 Läufen —
// zwei gepinnte Harness-Punkte desselben Modells zeigen so, dass ihre
// Intervalle einander fast immer überlappen (ⓘ-Caveat).
const whiskers = computed(() =>
  pinned.value.flatMap((name, i) => {
    const p = byLabel.value.get(name);
    return p?.ci ? [{ p, ci: p.ci, cls: `ht-ch-${i % 4}` }] : [];
  }),
);

// --- Text --------------------------------------------------------------------

const tip = (p: HPt) =>
  `${nameOf(p)}: ${de1(p.y)} % ± ${de1((p.yCi[1] - p.yCi[0]) / 2)} · ` +
  `${fmt(eur(p.usd))} €/Task` +
  (isFront(p) ? " · Pareto-Front" : "");

const geo = computed(() => geoCostRatio("cc", "pi", bench.value));
const winRate = computed(() => nativeWinRate(["swe", "tb"]));
const note = computed(() => {
  if (hl.value) return `${harnessLabel(hl.value)}: eigene Front`;
  if (props.step === 2)
    return `Claude Code ≈ ${de1(geo.value)}× Pi (geom. Mittel)`;
  if (props.step >= 3)
    return `fremder Harness gewinnt ${winRate.value.total - winRate.value.wins} von ${winRate.value.total}`;
  return "";
});

const chartLabel = computed(() => {
  const fr = front.value;
  const base =
    `Streudiagramm Erfolgsquote gegen Kosten pro Task in Euro auf ${BENCH_LABEL[bench.value]}, ` +
    "x-Achse logarithmisch von 0,02 bis 1,8 Euro, 21 Modell-Harness-Paare. " +
    "Farbe und Form nach Harness: violettes Quadrat Pi, grünes Dreieck Codex, " +
    "orange Raute Claude Code. Beschriftung nach Modell. ";
  const step = [
    "Schritt 0: alle Punkte, ohne Front.",
    `Schritt 1: die Pareto-Front mit ${fr.length} Punkten ist eingeblendet: ` +
      fr.map((p) => nameOf(p)).join(", ") +
      ".",
    `Schritt 2: ${surcharge.value.length} Pfeile von Pi zu Claude Code je Modell zeigen den Kostenfaktor; ` +
      `im geometrischen Mittel kostet Claude Code ${de1(geo.value)}-mal so viel wie Pi.`,
    `Schritt 3: ${ghostArrows.value.length} Pfeile vom nativen Harness zum Harness mit dem höchsten Erfolg: ` +
      upgrades.value
        .map(
          (u) =>
            `${u.from.modelLabel} von ${harnessLabel(u.native)} zu ${harnessLabel(u.to.harness)}`,
        )
        .join(", ") +
      `. Über beide Benchmarks gewinnt der fremde Harness ${winRate.value.total - winRate.value.wins} von ${winRate.value.total}.`,
  ][Math.min(Math.max(props.step, 0), 3)];
  const extra = hl.value
    ? ` Hervorgehoben: ${harnessLabel(hl.value)} mit seiner eigenen Front aus ${hlFront.value.length} Punkten.`
    : "";
  const names = allOn.value
    ? unnamed.value.length
      ? ` ${labels.value.length} Namen sind eingeblendet; die ${unnamed.value.length} gedimmten Punkte tragen keinen.`
      : " Alle 21 Namen sind eingeblendet."
    : ` ${unnamed.value.length} Punkte tragen keinen Namen; Hover oder Pin zeigt ihn, der Schalter „alle Namen“ alle.`;
  return base + step + extra + names;
});
</script>

<template>
  <div class="ht-wrap">
    <!-- Legendenzeile ist nowrap; Breite mit
         playwright-tests/harness-chart-qa.ts messen, wenn hier Text dazukommt.
         Die Pill-Optik ist von `.mp-tg` (ModelRoutingPareto.vue) abgeschrieben,
         weil scoped CSS keine fremden Komponenten erreicht. -->
    <div class="ht-legend" @click="blurLater">
      <button
        v-for="b in BENCHES"
        :key="b"
        class="ht-tg"
        :class="{ on: bench === b }"
        :aria-pressed="bench === b"
        @click="bench = b"
      >
        {{ BENCH_LABEL[b] }}
      </button>
      <button
        v-for="h in HARNESSES"
        :key="h.key"
        class="ht-sw"
        :class="{ on: hl === h.key }"
        :aria-pressed="hl === h.key"
        :style="{ '--sw': colorFor(h.key) }"
        :title="`Nur ${h.label} hervorheben und seine eigene Front zeigen`"
        @click="toggleHl(h.key)"
      >
        <svg class="ht-sw-ic" viewBox="-6 -6 12 12" aria-hidden="true">
          <path :d="shapePath(h.symbol, 0, 0, 4.4)" />
        </svg>
        {{ h.label }}
      </button>
      <button
        class="ht-tg"
        :class="{ on: allOn }"
        :aria-pressed="allOn"
        title="Jeden sichtbaren Punkt beschriften (kurzer Modellname; den Harness zeigt die Markerform), nachgeholte mit Führungslinie — gedimmte Punkte bleiben ohne Namen"
        @click="allOn = !allOn"
      >
        alle Namen
      </button>
      <span class="ht-note" :data-step="step">{{ note }}</span>
      <button
        class="ht-ib"
        aria-label="Quellen und Einschränkungen anzeigen"
        @click="sourcesOpen = true"
      >
        ⓘ
      </button>
    </div>

    <svg
      class="ht-chart"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="chartLabel"
      :data-step="step"
      :data-bench="bench"
      :data-all="allOn ? 'on' : 'off'"
      :data-dropped="unnamed.join(' | ')"
    >
      <!-- Gitter + Achsen — identisch zu ModelRoutingPareto.vue -->
      <g class="ht-grid">
        <line
          v-for="t in X_TICKS"
          :key="`x${t}`"
          :x1="px(t)"
          :y1="T"
          :x2="px(t)"
          :y2="H - B"
        />
        <line
          v-for="t in Y_TICKS"
          :key="`y${t}`"
          :x1="L"
          :y1="py(t)"
          :x2="W - R"
          :y2="py(t)"
        />
      </g>
      <g class="ht-ticks">
        <text
          v-for="t in X_TICKS"
          :key="`xl${t}`"
          :x="px(t)"
          :y="H - B + 15"
          text-anchor="middle"
        >
          {{ tickLabel(t) }}
        </text>
        <text
          v-for="t in Y_TICKS"
          :key="`yl${t}`"
          :x="L - 7"
          :y="py(t) + 3"
          text-anchor="end"
        >
          {{ t }} %
        </text>
        <text
          :x="L + (W - L - R) / 2"
          :y="H - 4"
          text-anchor="middle"
          class="ht-axis-title"
        >
          Ø Kosten pro Task (EUR, log. Skala) — Erfolg (%)
        </text>
      </g>

      <!-- Teilfront des hervorgehobenen Harness (Legendenklick), in seiner
           Farbe, vor der globalen Front -->
      <polyline
        v-if="hl"
        :points="hlPath"
        class="ht-hl-line"
        :style="{ '--c': colorFor(hl) }"
      />

      <!-- Globale Pareto-Front ab Schritt 1 — bleibt danach stehen. -->
      <polyline
        :points="frontPath"
        class="ht-front-line"
        :class="{ 'ht-front-on': showFront }"
      />

      <!-- Geisterringe am nativen Harness (Schritt 3) -->
      <circle
        v-for="u in upgrades"
        :key="`ring-${u.model}`"
        :cx="at(u.from).px"
        :cy="at(u.from).py"
        :r="RING_R"
        class="ht-native-ring"
      >
        <title>
          {{ u.from.modelLabel }}: natives Harness {{ harnessLabel(u.native) }}
        </title>
      </circle>

      <!-- Deckende Fläche hinter jedem Label statt nur eines Glyph-Halos: ein
           Halo lässt Linien in den Wortzwischenräumen durchscheinen — gemessen
           an der Frontlinie, die genau durch „Claude Fable 5" lief. Die Box
           kommt aus `labelBox()`, derselben Rechnung wie die Kollisions-
           vermeidung. Die Flächen liegen VOR Pfeilen und Markern: sie decken
           nur Gitter und Front ab, nie einen Pfeil — seine Spitze weicht den
           Labels im Default aus (`arrowHeads`), und wo ein Bogen ein Label
           doch kreuzt, bleibt er sichtbar. -->
      <rect
        v-for="l in labels"
        :key="`bg-${l.id}`"
        :x="l.rect.x"
        :y="l.rect.y"
        :width="l.rect.w"
        :height="l.rect.h"
        class="ht-label-bg"
      />

      <!-- Pfeile (Schritt 2: Aufpreis, Schritt 3: natives → bestes) vor den
           Markern, damit deren Formen obenauf liegen -->
      <g v-for="a in arrows" :key="a.id" class="ht-arrow">
        <title>{{ a.tip }}</title>
        <path :d="a.d" />
        <polygon :points="a.head" />
      </g>

      <!-- Führungslinien vor den Markern -->
      <line
        v-for="l in leaders"
        :key="`ld-${l.id}`"
        :x1="l.x1"
        :y1="l.y1"
        :x2="l.x2"
        :y2="l.y2"
        class="ht-leader"
      />

      <!-- Marker: Form = Harness, Größe/Rand = Front oder dominiert -->
      <g
        v-for="p in pts"
        :key="key(p)"
        class="ht-pt"
        :class="{ 'ht-pt-front': isFront(p), 'ht-dim': dimmed(p) }"
        :style="{ '--c': colorFor(p.harness) }"
        :data-key="key(p)"
      >
        <path :d="markerPath(p)">
          <title>{{ tip(p) }}</title>
        </path>
      </g>

      <!-- Beschriftung über Flächen, Pfeilen und Markern -->
      <text
        v-for="l in labels"
        :key="`lbl-${l.id}`"
        :x="l.pl.x"
        :y="l.pl.y"
        :text-anchor="l.pl.ax"
        class="ht-label"
        :class="labelCls(l)"
        :style="{ fontSize: `${l.font}px` }"
        :data-model="l.id"
        :data-box="l.box"
        :data-pass="l.pl.pass"
        :data-forced="l.pl.forced ? 'yes' : 'no'"
        :data-leader="l.pl.leader ? 'yes' : 'no'"
        @mouseenter="hovered = nameOf(l.p)"
        @mouseleave="hovered = null"
        @click.stop="pin(l.p)"
      >
        {{ l.text }}
      </text>

      <!-- Pfeil-Beschriftungen (Kostenfaktor, Schritt 2) mit Halo; abgesetzte
           bekommen eine Haarlinie zum Pfeil -->
      <line
        v-for="l in arrowLeaders"
        :key="`al-${l.id}`"
        :x1="l.x1"
        :y1="l.y1"
        :x2="l.x2"
        :y2="l.y2"
        class="ht-leader"
      />
      <text
        v-for="a in arrowTexts"
        :key="`at-${a.id}`"
        :x="a.tx"
        :y="a.ty"
        text-anchor="middle"
        class="ht-arrow-label"
        :data-arrow="a.id"
        :data-box="a.boxAttr"
      >
        <title>{{ a.tip }}</title>
        {{ a.text }}
      </text>

      <!-- Fehlerbalken der gepinnten Punkte -->
      <g
        v-for="w in whiskers"
        :key="`ci-${w.p.label}`"
        class="ht-ci"
        :class="w.cls"
      >
        <rect
          :x="L"
          :y="py(w.p.y + w.ci)"
          :width="W - R - L"
          :height="py(w.p.y - w.ci) - py(w.p.y + w.ci)"
          class="ht-ci-band"
        />
        <line
          :x1="px(w.p.x)"
          :y1="py(w.p.y - w.ci)"
          :x2="px(w.p.x)"
          :y2="py(w.p.y + w.ci)"
          class="ht-ci-bar"
        />
        <line
          :x1="px(w.p.x) - 5"
          :y1="py(w.p.y + w.ci)"
          :x2="px(w.p.x) + 5"
          :y2="py(w.p.y + w.ci)"
          class="ht-ci-bar"
        />
        <line
          :x1="px(w.p.x) - 5"
          :y1="py(w.p.y - w.ci)"
          :x2="px(w.p.x) + 5"
          :y2="py(w.p.y - w.ci)"
          class="ht-ci-bar"
        />
      </g>

      <!-- Fadenkreuze: Hover temporär, Klick fixiert. Die Klassen heißen
           `ht-ch-*`, das Composable liefert `mp-ch-*` — unten umgeschrieben,
           damit die Farbtöne hier scoped definiert bleiben. -->
      <g
        v-for="c in crosshairs"
        :key="`ch-${c.p.label}`"
        class="ht-ch"
        :class="c.cls.replace('mp-', 'ht-')"
      >
        <line :x1="px(c.p.x)" :y1="T" :x2="px(c.p.x)" :y2="H - B" />
        <line :x1="L" :y1="py(c.p.y)" :x2="W - R" :y2="py(c.p.y)" />
        <circle :cx="px(c.p.x)" :cy="py(c.p.y)" r="9.5" class="ht-ch-ring" />
        <text
          :x="px(c.p.x)"
          :y="H - B + 15"
          text-anchor="middle"
          class="ht-ch-badge"
        >
          {{ c.p.eur }} €
        </text>
        <text :x="L - 7" :y="c.badgeY" text-anchor="end" class="ht-ch-badge">
          {{ de1(c.p.y) }} %
        </text>
        <text
          v-if="c.p.ci && pinned.includes(c.p.label)"
          :x="L - 7"
          :y="c.badgeY + 10"
          text-anchor="end"
          class="ht-ch-badge ht-ci-badge"
        >
          ± {{ de1(c.p.ci) }}
        </text>
      </g>

      <!-- Hover-Name für Punkte ohne Beschriftung: transient, zuoberst. -->
      <text
        v-for="l in hoverLabels"
        :key="`hover-${l.id}`"
        :x="l.pl.x"
        :y="l.pl.y"
        :text-anchor="l.pl.ax"
        class="ht-label ht-label-hover"
        :class="pinCls(nameOf(l.p))"
        :style="{ fontSize: `${l.font}px` }"
        :data-model="l.id"
        :data-box="l.box"
      >
        {{ l.text }}
      </text>

      <!-- Unsichtbare Hit-Targets — zuletzt gerendert, fangen also die Events.
           Ihr Radius ist zugleich das Hindernis des Platzierers. -->
      <circle
        v-for="p in pts"
        :key="`hit-${key(p)}`"
        :cx="at(p).px"
        :cy="at(p).py"
        :r="HIT_R"
        class="ht-hit"
        role="button"
        tabindex="0"
        :aria-pressed="pinned.includes(nameOf(p))"
        :aria-label="`Fadenkreuz für ${nameOf(p)}`"
        @mouseenter="hovered = nameOf(p)"
        @mouseleave="hovered = null"
        @click.stop="pin(p)"
        @keydown.enter.prevent="togglePin(nameOf(p))"
      >
        <title>{{ tip(p) }}</title>
      </circle>
    </svg>

    <HarnessTaxSources :open="sourcesOpen" @close="sourcesOpen = false" />
  </div>
</template>

<style scoped>
.ht-wrap {
  margin-top: 0;
  /* Fläche hinter Labels, Halos und Marker-Rändern — dieselbe Form wie in
     ModelRoutingPareto.vue und ModelRoutingHistory.vue. `--deck-surface`
     definiert die `style.css` des Decks auf Slidevs Folienfarbe (`bg-main`:
     `bg-white dark:bg-[#121212]`, `@slidev/client/uno.config.ts`); der
     Fallback `--color-background-primary` ist im Dark Mode #1e1e1e und
     stünde als hellerer Kasten um jedes Label (gemessen 20.09.2026). */
  --ht-surface: var(--deck-surface, var(--color-background-primary));
}
.ht-legend {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  margin-bottom: 0;
  font-size: 11px;
  color: var(--color-text-secondary);
}
/* Pill-Schalter — Kopie von `.mp-tg` in ModelRoutingPareto.vue. */
.ht-tg {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 1px 7px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  background: none;
  font: inherit;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.ht-tg:hover {
  color: var(--color-text-secondary);
}
.ht-tg.on {
  border-color: var(--color-text-info);
  background: color-mix(in srgb, var(--color-text-info) 12%, transparent);
  color: var(--color-text-primary);
}
/* Harness-Swatch: Form UND Farbe, klickbar (Hervorhebung). Bei „on" färbt
   sich die Pille im Harness-Ton statt im Info-Blau, damit klar ist, WER
   hervorgehoben ist. */
.ht-sw {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px 1px 5px;
  border: 0.5px solid transparent;
  border-radius: 999px;
  background: none;
  font: inherit;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.ht-sw:hover {
  border-color: var(--color-border-tertiary);
}
.ht-sw.on {
  border-color: var(--sw);
  background: color-mix(in srgb, var(--sw) 14%, transparent);
  color: var(--color-text-primary);
}
.ht-sw-ic {
  width: 11px;
  height: 11px;
  fill: var(--sw);
}
.ht-note {
  margin-left: auto;
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  color: var(--color-text-primary);
  min-height: 1em;
}
.ht-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.ht-ib:hover {
  color: var(--color-text-primary);
}
.ht-chart {
  display: block;
  width: 100%;
  height: auto;
}
.ht-grid line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.ht-ticks text {
  font-size: 11px;
  fill: var(--color-text-tertiary);
}
.ht-axis-title {
  font-size: 11px;
  fill: var(--color-text-tertiary);
}

/* Globale Front: gestrichelt in Textfarbe (nicht Primary wie das Modell-
   Chart — Primary läge zu nah am Violett von Pi). Blendet per Schritt 1
   ein; Rückwärts blendet sie wieder aus. */
.ht-front-line {
  fill: none;
  stroke: var(--color-text-primary);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0;
  transition: opacity 240ms ease;
}
.ht-front-on {
  opacity: 0.55;
}
/* Teilfront eines Harness: durchgezogen, in seiner Farbe. */
.ht-hl-line {
  fill: none;
  stroke: var(--c);
  stroke-width: 2;
  opacity: 0.8;
}
.ht-leader {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.9;
  opacity: 0.7;
}

/* Marker: dominiert klein und abgeschwächt mit Surface-Rand, Front groß mit
   Rand in Textfarbe. `--c` trägt die Harness-Farbe. */
.ht-pt path {
  fill: var(--c);
  opacity: 0.62;
  stroke: var(--ht-surface);
  stroke-width: 1.2;
  stroke-linejoin: round;
  transition: opacity 240ms ease;
}
.ht-pt-front path {
  opacity: 1;
  stroke: var(--color-text-primary);
  stroke-width: 2;
}
.ht-pt.ht-dim path {
  opacity: 0.2;
}

/* Geisterring am nativen Harness (Schritt 3) — Optik von `.mp-old-pt`. */
.ht-native-ring {
  fill: none;
  stroke: var(--color-text-tertiary);
  stroke-width: 1.4;
  stroke-dasharray: 3 2;
  opacity: 0.9;
}
/* Pfeile — Optik der Preis-Wanderungen (`.mp-moved`): dünner Schaft, kleine
   Spitze, gedeckt statt farbig, damit die Markerfarben die Geschichte
   erzählen und nicht der Pfeil. */
.ht-arrow path {
  fill: none;
  stroke: var(--color-text-secondary);
  stroke-width: 1.2;
  opacity: 0.85;
}
.ht-arrow polygon {
  fill: var(--color-text-secondary);
  opacity: 0.85;
}
.ht-arrow-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  font-weight: 700;
  fill: var(--color-text-primary);
  paint-order: stroke;
  stroke: var(--ht-surface);
  stroke-width: 3px;
  pointer-events: none;
}

.ht-label-bg {
  fill: var(--ht-surface);
}
/* Schriftgröße kommt inline aus LABEL_FONT (pareto 12 / historyAll 10) —
   daraus rechnet `labelBox()` die Hintergrundfläche und die QA die Box. */
.ht-label {
  font-family: var(--slidev-code-font-family, monospace);
  cursor: pointer;
  transition: opacity 240ms ease;
}
.ht-label-front {
  font-weight: 700;
  fill: var(--color-text-primary);
}
.ht-label-dom {
  fill: var(--color-text-secondary);
}
.ht-label-hover {
  fill: var(--color-text-primary);
  font-weight: 700;
  paint-order: stroke;
  stroke: var(--ht-surface);
  stroke-width: 3px;
  pointer-events: none;
}
/* Gepinnt: die Beschriftung trägt die Pin-Farbe ihres Fadenkreuzes. Das
   Composable liefert `mp-ch-0…3`; hier sind dieselben Namen definiert. */
.ht-label.mp-ch-0,
.ht-label.mp-ch-1,
.ht-label.mp-ch-2,
.ht-label.mp-ch-3 {
  fill: var(--ch);
}
.mp-ch-0 {
  --ch: var(--color-text-info);
}
.mp-ch-1 {
  --ch: var(--color-text-danger);
}
.mp-ch-2 {
  --ch: var(--color-text-warning);
}
.mp-ch-3 {
  --ch: var(--color-text-success);
}

.ht-ci {
  pointer-events: none;
}
.ht-ci-bar {
  stroke: var(--ch);
  stroke-width: 1.8;
}
.ht-ci-band {
  fill: var(--ch);
  opacity: 0.09;
}

.ht-ch {
  pointer-events: none;
}
.ht-ch line {
  stroke: var(--ch);
  stroke-width: 1.2;
  stroke-dasharray: 2 3;
}
.ht-ch-ring {
  fill: none;
  stroke: var(--ch);
  stroke-width: 1.5;
}
.ht-ch-badge {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  font-weight: 700;
  fill: var(--ch);
  paint-order: stroke;
  stroke: var(--ht-surface);
  stroke-width: 3px;
}
.ht-ch-0 {
  --ch: var(--color-text-info);
}
.ht-ch-1 {
  --ch: var(--color-text-danger);
}
.ht-ch-2 {
  --ch: var(--color-text-warning);
}
.ht-ch-3 {
  --ch: var(--color-text-success);
}
.ht-ch-hover {
  --ch: var(--color-text-secondary);
  opacity: 0.55;
}
.ht-hit {
  fill: transparent;
  cursor: pointer;
}
.ht-hit:focus-visible {
  outline: none;
  stroke: var(--slidev-theme-primary);
  stroke-width: 1.5;
}
</style>
