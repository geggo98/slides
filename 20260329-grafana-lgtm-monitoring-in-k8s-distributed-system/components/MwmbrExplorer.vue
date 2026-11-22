<script setup lang="ts">
/**
 * MwmbrExplorer.vue — Multi-Window, Multi-Burn-Rate Alerting zum Anfassen.
 *
 * Oben die Fehlerquote eines wählbaren Störungsszenarios, darunter für die
 * gewählte Regel die Burn Rate im langen und im kurzen Fenster gegen die
 * Schwelle θ, darunter je Regel die Zeitleiste „feuert / feuert nicht“.
 * Rechts der Zustand am Zeitzeiger: beide Fenster, das UND-Gatter, der
 * Budgetverbrauch und die Einordnung Alarm oder Ticket. Der Schalter
 * „lang ∧ kurz / nur lang / nur kurz“ zeigt, was jede Fensterhälfte leistet:
 * ohne kurzes Fenster endet der Alarm spät, ohne langes feuert er zu oft.
 *
 * Regeln: Google SRE Workbook, Kapitel 5, Table 5-8 (abgerufen 22.11.2026).
 * Die Rechnung liegt in `lib/mwmbrMath.ts` und ist dort getestet. Die
 * Simulation mit Quiz und Reglern steht im Deck `20260711-sre-simulations`
 * (`BurnRateSim.vue`); diese Komponente zeigt die Fenster-Geometrie.
 */
import { computed, ref, watch } from "vue";
import { useGrafanaPalette } from "./lib/grafanaPalette";
import { useInfoPopover } from "./lib/useInfoPopover";
import InfoPopover from "./InfoPopover.vue";
import {
  RULES,
  SCENARIOS,
  SLOS,
  decimate,
  fmtBurn,
  fmtDuration,
  fmtNum,
  gate,
  indexAt,
  minutesToExhaustion,
  outcome,
  severityOf,
  simulate,
  sustainedBurn,
  type GateMode,
  type Rule,
  type RuleOutcome,
  type Scenario,
} from "./lib/mwmbrMath";

const C = useGrafanaPalette();
const { info, toggle } = useInfoPopover();

const MODES: { key: GateMode; label: string }[] = [
  { key: "and", label: "lang ∧ kurz" },
  { key: "long", label: "nur lang" },
  { key: "short", label: "nur kurz" },
];

/* ---- Zustand ---- */
const scenarioKey = ref("spike");
const slo = ref(0.999);
const mode = ref<GateMode>("and");
const selected = ref(0);
const scenario = computed<Scenario>(
  () => SCENARIOS.find((s) => s.key === scenarioKey.value) ?? SCENARIOS[0]!,
);
const cursorMin = ref(scenario.value.cursorMin);
watch(scenario, (sc) => {
  cursorMin.value = sc.cursorMin;
});

/* ---- Modell ---- */
const run = computed(() => simulate(scenario.value, slo.value));
const outcomes = computed<Record<GateMode, RuleOutcome>[]>(() =>
  RULES.map((_, i) => ({
    and: outcome(run.value, i, "and"),
    long: outcome(run.value, i, "long"),
    short: outcome(run.value, i, "short"),
  })),
);
const rule = computed<Rule>(() => RULES[selected.value]!);
const cursorIdx = computed(() => indexAt(run.value, cursorMin.value));

/* ---- Formate ---- */
function fmtWin(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${min / 60} h`;
  return `${min / 1440} d`;
}
function fmtPct(share: number): string {
  const p = share * 100;
  return `${fmtNum(p, p < 0.095 ? 2 : p < 9.95 ? 1 : 0)}\u00a0%`;
}
const fmtSlo = (s: number) => `${fmtNum(s * 100, s === 0.9995 ? 2 : 1)} %`;
/** Zeit ab Störungsbeginn. */
const rel = (min: number) => fmtDuration(min - scenario.value.onsetMin);
const ruleName = (r: Rule) =>
  `${r.severity === "page" ? "Alarm" : "Ticket"} ${fmtBurn(r.theta)}`;
const sevColor = (r: Rule) =>
  r.severity === "page" ? C.value.crit : C.value.warn;

/* ---- Geometrie des Diagramms (viewBox-Einheiten) ---- */
const VW = 600;
const VH = 288;
const X0 = 40;
const X1 = 594;
const A_TOP = 14;
const A_BOT = 64;
const B_TOP = 88;
const B_BOT = 194;
const LANE_TOP = 208;
const LANE_H = 16;
const LANE_GAP = 5;
const BUCKETS = 260;

const xOf = (min: number) =>
  X0 +
  (Math.min(Math.max(min, 0), scenario.value.spanMin) /
    scenario.value.spanMin) *
    (X1 - X0);
const minOfIndex = (i: number) => (i * run.value.stepS) / 60;
const laneY = (i: number) => LANE_TOP + i * (LANE_H + LANE_GAP);

const maxRate = computed(() => {
  let m = 0;
  for (const p of scenario.value.phases) m = Math.max(m, p.rate);
  return m || 1;
});
const yRate = (v: number) =>
  A_BOT - (v / (maxRate.value * 1.12)) * (A_BOT - A_TOP);
/** Log-Achse von 0,1× bis 1000×; Werte außerhalb kleben am Rand. */
const yBurn = (v: number) =>
  B_BOT -
  ((Math.log10(Math.min(1000, Math.max(0.1, v))) + 1) / 4) * (B_BOT - B_TOP);

function polyline(arr: ArrayLike<number>, y: (v: number) => number): string {
  return decimate(arr, BUCKETS)
    .map((p) => `${xOf(minOfIndex(p.i)).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(" ");
}
const errArea = computed(
  () =>
    `${X0},${A_BOT} ${polyline(run.value.err, yRate)} ${X1},${yRate(run.value.err[run.value.n - 1]!).toFixed(1)} ${X1},${A_BOT}`,
);

/**
 * Richtungswechsel einer Reihe. `frac` bildet den Wert auf die Höhe seiner
 * Zeichenfläche ab (0 unten, 1 oben). Ein Wechsel zählt erst ab
 * `REVERSAL_FRAC` Hub, damit Rauschen keine Schwingung vortäuscht; auf der
 * Burn-Achse mit ihren vier Dekaden sind das 0,15 Dekaden.
 */
const REVERSAL_FRAC = 0.0375;
function reversals(
  arr: ArrayLike<number>,
  frac: (v: number) => number,
): number {
  let ref = frac(arr[0] ?? 0);
  let dir = 0;
  let n = 0;
  for (let i = 1; i < arr.length; i++) {
    const l = frac(arr[i]!);
    if (dir === 0) {
      if (Math.abs(l - ref) > REVERSAL_FRAC) {
        dir = l > ref ? 1 : -1;
        ref = l;
      }
    } else if ((l - ref) * dir > 0) ref = l;
    else if ((ref - l) * dir > REVERSAL_FRAC) {
      dir = -dir;
      ref = l;
      n++;
    }
  }
  return n;
}

/** Schmaler als so viele viewBox-Einheiten je Schwingung: Band statt Linie. */
const MIN_PERIOD_W = 8;
/** Hüllfläche zwischen Minimum und Maximum, dazu ihre obere und untere Kante. */
interface Envelope {
  band: string;
  top: string;
  bottom: string;
}
/**
 * Eine Reihe, die enger schwingt als `MIN_PERIOD_W`, verschmiert als
 * Linienzug zur Fläche, und `decimate` schneidet die Zacken je nach Lage der
 * Eimer verschieden ab (Aliasing). Dann zeichnet das Diagramm die Hüllkurve:
 * je Eimer Minimum und Maximum als Treppe. Jeder Eimer fasst zwei volle
 * Schwingungen, enthält also sicher eine Spitze und ein Tal. Die Werte selbst
 * bleiben unverändert; Karten, Zeitleisten und Befund rechnen weiter mit der
 * vollen Reihe. `null` heißt: Die Reihe ist als Linie lesbar.
 */
function envelope(
  arr: ArrayLike<number>,
  y: (v: number) => number,
  frac: (v: number) => number,
): Envelope | null {
  const periods = reversals(arr, frac) / 2;
  if (periods <= (X1 - X0) / MIN_PERIOD_W) return null;
  const n = arr.length;
  const buckets = Math.min(BUCKETS, Math.max(1, Math.floor(periods / 2)));
  const top: string[] = [];
  const bottom: string[] = [];
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor((b * n) / buckets);
    const to = Math.floor(((b + 1) * n) / buckets);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = from; i < to; i++) {
      lo = Math.min(lo, arr[i]!);
      hi = Math.max(hi, arr[i]!);
    }
    const xa = xOf(minOfIndex(from)).toFixed(1);
    const xb = xOf(minOfIndex(to)).toFixed(1);
    top.push(`${xa},${y(hi).toFixed(1)}`, `${xb},${y(hi).toFixed(1)}`);
    bottom.push(`${xa},${y(lo).toFixed(1)}`, `${xb},${y(lo).toFixed(1)}`);
  }
  return {
    band: [...top, ...bottom.slice().reverse()].join(" "),
    top: top.join(" "),
    bottom: bottom.join(" "),
  };
}
/** Legendentext für die Hüllfläche; erscheint nur, wenn eine gezeichnet ist. */
const BAND_LABEL = "Band: Minimum bis Maximum";

const errEnv = computed(() =>
  envelope(run.value.err, yRate, (v) => v / (maxRate.value * 1.12)),
);
const burnFrac = (v: number) =>
  (Math.log10(Math.min(1000, Math.max(0.1, v))) + 1) / 4;
/** Burn-Rate-Reihe: entweder Hüllfläche oder Linienzug. */
function series(arr: ArrayLike<number>) {
  const env = envelope(arr, yBurn, burnFrac);
  return { env, line: env ? null : polyline(arr, yBurn) };
}
const longSeries = computed(() =>
  series(run.value.rules[selected.value]!.long),
);
const shortSeries = computed(() =>
  series(run.value.rules[selected.value]!.short),
);
const burnSeries = computed(() => [
  {
    key: "long",
    cls: "s-long",
    keyCls: "k-long",
    textCls: "f-long-text",
    off: mode.value === "short",
    s: longSeries.value,
  },
  {
    key: "short",
    cls: "s-short",
    keyCls: "k-short",
    textCls: "f-short-text",
    off: mode.value === "long",
    s: shortSeries.value,
  },
]);

const BURN_TICKS = [0.1, 1, 10, 100, 1000];
const xTicks = computed(() => {
  const sc = scenario.value;
  const step = sc.spanMin <= 180 ? 20 : sc.spanMin <= 600 ? 60 : 720;
  const out: { x: number; label: string; end: boolean }[] = [];
  for (let t = sc.onsetMin; t <= sc.spanMin; t += step) {
    const d = t - sc.onsetMin;
    out.push({
      x: xOf(t),
      label: d === 0 ? "Beginn" : step < 60 ? `+${d} min` : `+${d / 60} h`,
      // Die letzte Marke rechtsbündig, sonst ragt ihr Text aus dem Diagramm.
      end: xOf(t) > X1 - 16,
    });
  }
  return out;
});

interface Bar {
  x: number;
  w: number;
}
const bars = (o: RuleOutcome): Bar[] =>
  o.segments.map((s) => ({
    x: xOf(s.fromMin),
    w: Math.max(1.4, xOf(s.toMin) - xOf(s.fromMin)),
  }));
const lanes = computed(() =>
  RULES.map((r, i) => ({
    rule: r,
    y: laneY(i),
    color: sevColor(r),
    bars: bars(outcomes.value[i]![mode.value]),
    refBars: mode.value === "and" ? [] : bars(outcomes.value[i]!.and),
  })),
);
const selectedBars = computed(() =>
  bars(outcomes.value[selected.value]![mode.value]),
);
const cursorX = computed(() => xOf(cursorMin.value));
/**
 * Der Zeitzeiger läuft nur durch die Zeichenflächen. Die Zeile dazwischen
 * trägt Titel und Legende des Burn-Rate-Diagramms und bleibt frei.
 */
const CURSOR_SPANS = [
  { y1: A_TOP, y2: A_BOT },
  { y1: B_TOP, y2: LANE_TOP + RULES.length * (LANE_H + LANE_GAP) - LANE_GAP },
];
/** Länge des Linienmusters neben dem Schwellen-Eintrag der Legende. */
const THETA_KEY_W = 8;
const windowBands = computed(() => {
  const band = (len: number) => {
    const from = xOf(cursorMin.value - len);
    return { x: from, w: Math.max(1, cursorX.value - from) };
  };
  return { long: band(rule.value.longMin), short: band(rule.value.shortMin) };
});

/* ---- Zeitzeiger ziehen ---- */
const svgEl = ref<SVGSVGElement | null>(null);
let dragging = false;
function pick(e: PointerEvent) {
  const el = svgEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * VW;
  const y = ((e.clientY - r.top) / r.height) * VH;
  const t = ((x - X0) / (X1 - X0)) * scenario.value.spanMin;
  cursorMin.value = Math.min(scenario.value.spanMin, Math.max(0, t));
  return y;
}
function onDown(e: PointerEvent) {
  dragging = true;
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  const y = pick(e);
  if (y === undefined) return;
  // Klick auf eine Zeitleiste wählt zusätzlich die Regel.
  const lane = Math.floor((y - LANE_TOP + LANE_GAP / 2) / (LANE_H + LANE_GAP));
  if (y >= LANE_TOP - LANE_GAP / 2 && lane >= 0 && lane < RULES.length)
    selected.value = lane;
}
function onMove(e: PointerEvent) {
  if (dragging) pick(e);
}
function onUp() {
  dragging = false;
}

/* ---- Karten: Zustand je Regel am Zeitzeiger ---- */
function resetText(o: RuleOutcome): string {
  if (o.count === 0) return "feuert nicht";
  return o.resetMin === null
    ? "an bis Diagrammende"
    : `aus nach ${rel(o.resetMin)}`;
}
const cards = computed(() =>
  RULES.map((r, i) => {
    const w = run.value.rules[i]!;
    const long = w.long[cursorIdx.value]!;
    const short = w.short[cursorIdx.value]!;
    const o = outcomes.value[i]!;
    const cur = o[mode.value];
    let line = "feuert nicht";
    if (cur.count > 1)
      line = `${cur.count}× an, zuerst nach ${rel(cur.firstFireMin!)}`;
    else if (cur.count === 1)
      line = `an nach ${rel(cur.firstFireMin!)} · ${resetText(cur)}`;
    const compare =
      mode.value === "and"
        ? `nur lang: ${resetText(o.long)}`
        : `lang ∧ kurz: ${o.and.count > 1 ? `${o.and.count}× an` : resetText(o.and)}`;
    return {
      rule: r,
      color: sevColor(r),
      long,
      short,
      longOk: long > r.theta,
      shortOk: short > r.theta,
      firing: gate(long, short, r.theta, mode.value),
      line,
      compare,
    };
  }),
);

/* ---- Budget ---- */
const budget = computed(() => {
  const now = run.value.consumed[cursorIdx.value]!;
  const end = run.value.consumed[run.value.n]!;
  let fire: number | null = null;
  let first = Infinity;
  for (const o of outcomes.value) {
    if (o.and.firstFireMin !== null && o.and.firstFireMin < first) {
      first = o.and.firstFireMin;
      fire = o.and.budgetAtFire;
    }
  }
  return {
    now,
    end,
    fire,
    color: now >= 1 ? C.value.crit : now >= 0.1 ? C.value.warn : C.value.ok,
  };
});

/* ---- Einordnung Alarm oder Ticket (immer nach lang ∧ kurz) ---- */
const verdict = computed(() => {
  const sev = severityOf(
    RULES.map((r, i) => ({
      severity: r.severity,
      count: outcomes.value[i]!.and.count,
    })),
  );
  const burn = sustainedBurn(run.value);
  const left = fmtDuration(minutesToExhaustion(burn));
  if (sev === "page")
    return {
      label: "Alarm",
      color: C.value.crit,
      text: `Burn ${fmtBurn(burn)}: Ein volles Budget wäre nach ${left} leer. Das ist eine Sache von Stunden oder wenigen Tagen, also sofort einen Menschen rufen.`,
    };
  if (sev === "ticket")
    return {
      label: "Ticket",
      color: C.value.warn,
      text: `Burn ${fmtBurn(burn)}: Ein volles Budget reicht noch ${left}. Das hat Zeit bis zum nächsten Werktag, aber nicht bis zum Monatsende.`,
    };
  return {
    label: "kein Alarm",
    color: C.value.ok,
    text:
      burn < 1
        ? `Burn ${fmtBurn(burn)} liegt unter 1: Das Budget reicht für die ganze Periode.`
        : `Die Störung kostet ${fmtPct(run.value.consumed[run.value.n]!)} des Budgets und endet, bevor eine Regel anspricht.`,
  };
});

/* ---- Befund unter dem Diagramm ---- */
const finding = computed(() => {
  const o = outcomes.value[selected.value]!;
  const name = ruleName(rule.value);
  if (mode.value === "long") {
    if (o.long.count === 0)
      return `${name}: Auch das lange Fenster allein feuert hier nicht.`;
    if (o.and.count > 0 && o.and.resetMin === null)
      return `${name}: Solange die Störung läuft, feuern beide Varianten. Das kurze Fenster zählt erst, wenn die Fehler aufhören.`;
    if (o.and.resetMin === null)
      return `${name}: Nur das lange Fenster feuert. Das kurze sieht keine frischen Fehler über der Schwelle und hält den Alarm zurück.`;
    return o.long.resetMin === null
      ? `${name}: Ohne kurzes Fenster bleibt der Alarm über das Diagrammende hinaus an. Mit kurzem Fenster ist er nach ${rel(o.and.resetMin)} aus.`
      : `${name}: Ohne kurzes Fenster bleibt der Alarm ${fmtDuration(o.long.resetMin - o.and.resetMin)} länger an, obwohl keine Fehler mehr auftreten.`;
  }
  if (mode.value === "short") {
    if (o.short.count === 0)
      return `${name}: Auch das kurze Fenster allein feuert hier nicht.`;
    if (o.short.count > o.and.count + 1)
      return `${name}: Ohne langes Fenster feuert die Regel ${o.short.count}×, mit beiden Fenstern ${o.and.count}×. Jeder kurze Ausschlag löst aus, egal wie wenig Budget er kostet.`;
    if (o.and.count === 0)
      return `${name}: Nur das kurze Fenster feuert, schon nach ${rel(o.short.firstFireMin!)}. Im langen Fenster ist dafür noch zu wenig Budget verbrannt.`;
    return `${name}: Ohne langes Fenster feuert die Regel schon nach ${rel(o.short.firstFireMin!)} statt nach ${rel(o.and.firstFireMin!)}, bevor nennenswert Budget verbrannt ist.`;
  }
  let first = -1;
  outcomes.value.forEach((x, i) => {
    if (x.and.firstFireMin === null) return;
    if (
      first < 0 ||
      x.and.firstFireMin < outcomes.value[first]!.and.firstFireMin!
    )
      first = i;
  });
  if (first < 0) return "Keine der drei Regeln feuert.";
  const f = outcomes.value[first]!.and;
  const head = `Erster Alarm: ${ruleName(RULES[first]!)} nach ${rel(f.firstFireMin!)}, bei ${fmtPct(f.budgetAtFire!)} verbrauchtem Budget.`;
  if (o.and.resetMin === null || o.and.count !== 1) return head;
  const longer =
    o.long.resetMin === null
      ? "über das Diagrammende hinaus"
      : `${fmtDuration(o.long.resetMin - o.and.resetMin)} länger`;
  return `${head} ${name} endet nach ${rel(o.and.resetMin)}; ohne kurzes Fenster bliebe sie ${longer} an.`;
});

const HELP = {
  windows:
    "Das lange Fenster entscheidet, ob genug Budget verbrannt ist, um jemanden zu stören. Das kurze Fenster prüft, ob das Budget jetzt noch brennt. Die Regel feuert erst, wenn beide über der Schwelle liegen. Das SRE Workbook nennt als Faustregel: kurzes Fenster = 1/12 des langen. „nur lang“ und „nur kurz“ zeigen, was ohne die jeweils andere Hälfte passiert.",
  budget:
    "Bezug ist ein Budget über 30 Tage (720 h). Budget beim Feuern = Schwelle × langes Fenster / 720 h. Für die drei Regeln sind das 2 %, 5 % und 10 %. Der Strich markiert den Verbrauch beim ersten Alarm. Die Zeit vor dem Diagramm gilt als fehlerfrei.",
  verdict:
    "SRE Workbook: Leert eine Störung das Budget in Stunden oder wenigen Tagen, ist eine aktive Benachrichtigung angemessen (Alarm). Sonst genügt ein Ticket für den nächsten Werktag. Die Einordnung folgt immer der Variante „lang ∧ kurz“. Table 5-8 hat drei Zeilen; eine vierte Bedingung, 3× über 24 h und 2 h, steht nur im PromQL-Beispiel des Workbooks und fehlt hier.",
};

const cssVars = computed(() => ({
  "--mw-bg": C.value.bg,
  "--mw-panel": C.value.panel,
  "--mw-panel-hi": C.value.panelHi,
  "--mw-border": C.value.border,
  "--mw-hi": C.value.textHi,
  "--mw-mid": C.value.textMid,
  "--mw-grid": C.value.grid,
  "--mw-grid-strong": C.value.gridStrong,
  "--mw-accent": C.value.accent,
  "--mw-long": C.value.accent,
  "--mw-short": C.value.alt,
  "--mw-err": C.value.series.t ?? C.value.accent,
  "--mw-ok": C.value.ok,
}));
</script>

<template>
  <div class="mw" :style="cssVars">
    <div class="mw-controls">
      <div class="mw-seg" role="group" aria-label="Störungsszenario">
        <button
          v-for="sc in SCENARIOS"
          :key="sc.key"
          type="button"
          :class="{ on: sc.key === scenarioKey }"
          :aria-pressed="sc.key === scenarioKey"
          @click="scenarioKey = sc.key"
        >
          {{ sc.label }}
        </button>
      </div>
      <div class="mw-group">
        <span class="mw-lbl">SLO</span>
        <div class="mw-seg" role="group" aria-label="SLO">
          <button
            v-for="s in SLOS"
            :key="s"
            type="button"
            :class="{ on: s === slo }"
            :aria-pressed="s === slo"
            @click="slo = s"
          >
            {{ fmtSlo(s) }}
          </button>
        </div>
      </div>
      <div class="mw-group">
        <div class="mw-seg" role="group" aria-label="Fenster-Verknüpfung">
          <button
            v-for="m in MODES"
            :key="m.key"
            type="button"
            :class="{ on: m.key === mode }"
            :aria-pressed="m.key === mode"
            @click="mode = m.key"
          >
            {{ m.label }}
          </button>
        </div>
        <InfoPopover
          id="windows"
          :active-id="info ?? undefined"
          title="Zwei Fenster, ein UND"
          @toggle="toggle('windows')"
          >{{ HELP.windows }}</InfoPopover
        >
      </div>
    </div>

    <div class="mw-main">
      <div class="mw-chart">
        <svg
          ref="svgEl"
          :viewBox="`0 0 ${VW} ${VH}`"
          class="mw-svg"
          role="img"
          :aria-label="`Fehlerquote, Burn Rate und Alarm-Zeitleiste für das Szenario ${scenario.label}`"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <!-- Fehlerquote -->
          <text :x="X0" y="9" class="t-title">
            Fehlerquote · {{ scenario.title }} · Spitze
            {{ fmtBurn(run.peakBurn) }}
          </text>
          <rect
            :x="X0"
            :y="A_TOP"
            :width="X1 - X0"
            :height="A_BOT - A_TOP"
            class="s-panel"
          />
          <rect
            :x="windowBands.long.x"
            :y="A_TOP"
            :width="windowBands.long.w"
            :height="A_BOT - A_TOP"
            class="f-long band"
          />
          <rect
            :x="windowBands.short.x"
            :y="A_TOP"
            :width="windowBands.short.w"
            :height="A_BOT - A_TOP"
            class="f-short band"
          />
          <!-- Eng flatternde Fehlerquote: Hüllfläche statt Zackenkamm -->
          <g v-if="errEnv" class="s-err env">
            <polygon :points="errEnv.band" class="env-fill" />
            <polyline :points="errEnv.top" class="env-edge" />
            <polyline :points="errEnv.bottom" class="env-edge" />
          </g>
          <polygon v-else :points="errArea" class="f-err" />
          <text v-if="errEnv" :x="X1" y="9" class="t-title end">
            <tspan class="env-key k-err">■</tspan>
            <tspan dx="4">{{ BAND_LABEL }}</tspan>
          </text>
          <text :x="X0 - 4" :y="yRate(maxRate) + 3" class="t-tick end">
            {{ fmtPct(maxRate) }}
          </text>
          <text :x="X0 - 4" :y="A_BOT + 1" class="t-tick end">0</text>

          <!-- Burn Rate der gewählten Regel -->
          <text :x="X0" :y="B_TOP - 6" class="t-title">
            Burn Rate für {{ ruleName(rule) }}:
            <tspan dx="3" class="f-long-text">▬</tspan>
            <tspan dx="4" class="f-long-text">
              langes Fenster {{ fmtWin(rule.longMin) }}
            </tspan>
            <tspan dx="6" class="f-short-text">▬</tspan>
            <tspan dx="4" class="f-short-text">
              kurzes Fenster {{ fmtWin(rule.shortMin) }}
            </tspan>
            <template v-for="b in burnSeries" :key="`k-${b.key}`">
              <template v-if="b.s.env">
                <tspan dx="6" class="env-key" :class="b.keyCls">■</tspan>
                <tspan dx="4" :class="b.textCls">{{ BAND_LABEL }}</tspan>
              </template>
            </template>
          </text>
          <!-- Schwelle: Eintrag in der Legendenzeile, dort kreuzt ihn keine Kurve -->
          <text
            :x="X1 - THETA_KEY_W - 3"
            :y="B_TOP - 6"
            class="t-title end"
            :style="{ fill: sevColor(rule) }"
          >
            Schwelle {{ fmtBurn(rule.theta) }}
          </text>
          <line
            :x1="X1 - THETA_KEY_W"
            :x2="X1"
            :y1="B_TOP - 9"
            :y2="B_TOP - 9"
            class="s-theta key"
            :style="{ stroke: sevColor(rule) }"
          />
          <rect
            :x="X0"
            :y="B_TOP"
            :width="X1 - X0"
            :height="B_BOT - B_TOP"
            class="s-panel"
          />
          <g v-for="t in BURN_TICKS" :key="t">
            <line
              :x1="X0"
              :x2="X1"
              :y1="yBurn(t)"
              :y2="yBurn(t)"
              class="s-grid"
            />
            <text :x="X0 - 4" :y="yBurn(t) + 3" class="t-tick end">
              {{ fmtBurn(t) }}
            </text>
          </g>
          <rect
            v-for="(b, k) in selectedBars"
            :key="`f${k}`"
            :x="b.x"
            :y="B_TOP"
            :width="b.w"
            :height="B_BOT - B_TOP"
            class="fire-zone"
            :style="{ fill: sevColor(rule) }"
          />
          <!-- Hüllflächen eng schwingender Reihen liegen unter der Schwelle -->
          <template v-for="b in burnSeries" :key="`b-${b.key}`">
            <g v-if="b.s.env" :class="[b.cls, 'env', { off: b.off }]">
              <polygon :points="b.s.env.band" class="env-fill" />
              <polyline :points="b.s.env.top" class="env-edge" />
              <polyline :points="b.s.env.bottom" class="env-edge" />
            </g>
          </template>
          <line
            :x1="X0"
            :x2="X1"
            :y1="yBurn(rule.theta)"
            :y2="yBurn(rule.theta)"
            class="s-theta"
            :style="{ stroke: sevColor(rule) }"
          />
          <template v-for="b in burnSeries" :key="`l-${b.key}`">
            <polyline
              v-if="b.s.line"
              :points="b.s.line"
              :class="[b.cls, { off: b.off }]"
            />
          </template>

          <!-- Zeitleisten: wann feuert welche Regel -->
          <g v-for="(l, i) in lanes" :key="l.rule.key">
            <rect
              :x="X0"
              :y="l.y"
              :width="X1 - X0"
              :height="LANE_H"
              class="lane"
              :class="{ sel: i === selected }"
            />
            <text
              :x="X0 - 4"
              :y="l.y + 11"
              class="t-tick end"
              :class="{ bold: i === selected }"
            >
              {{ fmtBurn(l.rule.theta) }}
            </text>
            <rect
              v-for="(b, k) in l.bars"
              :key="k"
              :x="b.x"
              :y="l.y + 1"
              :width="b.w"
              :height="l.refBars.length ? LANE_H - 6 : LANE_H - 2"
              :style="{ fill: l.color }"
            />
            <rect
              v-for="(b, k) in l.refBars"
              :key="`r${k}`"
              :x="b.x"
              :y="l.y + LANE_H - 4"
              :width="b.w"
              height="3"
              class="f-ref"
            />
          </g>

          <!-- Zeitachse -->
          <g v-for="t in xTicks" :key="t.x">
            <line
              :x1="t.x"
              :x2="t.x"
              :y1="laneY(RULES.length) - LANE_GAP + 1"
              :y2="laneY(RULES.length) - LANE_GAP + 5"
              class="s-tick"
            />
            <text
              :x="t.x"
              :y="VH - 3"
              class="t-tick"
              :class="t.end ? 'end' : 'mid'"
            >
              {{ t.label }}
            </text>
          </g>

          <!-- Zeitzeiger -->
          <line
            v-for="c in CURSOR_SPANS"
            :key="c.y1"
            :x1="cursorX"
            :x2="cursorX"
            :y1="c.y1"
            :y2="c.y2"
            class="s-cursor"
          />
        </svg>
        <input
          v-model.number="cursorMin"
          class="mw-range"
          type="range"
          min="0"
          :max="scenario.spanMin"
          :step="scenario.spanMin / 480"
          aria-label="Zeitzeiger"
          @keydown.stop
        />
        <div class="mw-finding">
          <span v-if="mode !== 'and'" class="mw-ref"
            ><i />Vergleich: lang ∧ kurz</span
          >
          {{ finding }}
        </div>
      </div>

      <div class="mw-side">
        <div class="mw-now">
          Zeitzeiger:
          <b>{{
            cursorMin >= scenario.onsetMin
              ? `${rel(cursorMin)} nach Beginn`
              : `${fmtDuration(scenario.onsetMin - cursorMin)} vor Beginn`
          }}</b>
        </div>
        <button
          v-for="(c, i) in cards"
          :key="c.rule.key"
          type="button"
          class="mw-card"
          :class="{ sel: i === selected }"
          :aria-pressed="i === selected"
          @click="selected = i"
        >
          <span class="mw-card-head">
            <span class="mw-badge" :style="{ background: c.color }">{{
              c.rule.severity === "page" ? "Alarm" : "Ticket"
            }}</span>
            <span class="mw-rule"
              >{{ fmtBurn(c.rule.theta) }} über {{ fmtWin(c.rule.longMin) }} ∧
              {{ fmtWin(c.rule.shortMin) }}</span
            >
            <span
              class="mw-lamp"
              :style="
                c.firing
                  ? { background: c.color, color: '#fff', borderColor: c.color }
                  : {}
              "
              >{{ c.firing ? "feuert" : "aus" }}</span
            >
          </span>
          <span class="mw-gate">
            <span class="mw-chip long" :class="{ off: mode === 'short' }"
              >lang {{ fmtBurn(c.long) }} {{ c.longOk ? "✓" : "✗" }}</span
            >
            <span class="mw-op">{{ mode === "and" ? "UND" : "·" }}</span>
            <span class="mw-chip short" :class="{ off: mode === 'long' }"
              >kurz {{ fmtBurn(c.short) }} {{ c.shortOk ? "✓" : "✗" }}</span
            >
          </span>
          <template v-if="i === selected">
            <span class="mw-line">{{ c.line }}</span>
            <span class="mw-line dim">{{ c.compare }}</span>
          </template>
        </button>

        <div class="mw-box">
          <div class="mw-box-head">
            <span>Error Budget (30 d)</span>
            <InfoPopover
              id="budget"
              :active-id="info ?? undefined"
              title="Error Budget"
              @toggle="toggle('budget')"
              >{{ HELP.budget }}</InfoPopover
            >
            <b :style="{ color: budget.color }">{{
              budget.now >= 1
                ? "aufgebraucht"
                : `${fmtPct(budget.now)} verbraucht`
            }}</b>
          </div>
          <div class="mw-bar">
            <div
              class="mw-bar-fill"
              :style="{
                width: `${Math.min(100, budget.now * 100)}%`,
                background: budget.color,
              }"
            />
            <div
              v-if="budget.fire !== null && budget.fire <= 1"
              class="mw-bar-mark"
              :style="{ left: `${budget.fire * 100}%` }"
            />
          </div>
          <div class="mw-line dim">
            am Diagrammende {{ fmtPct(budget.end) }}
            <template v-if="budget.fire !== null">
              · beim ersten Alarm {{ fmtPct(budget.fire) }}</template
            >
          </div>
        </div>

        <div class="mw-box">
          <div class="mw-box-head">
            <span>Einordnung</span>
            <InfoPopover
              id="verdict"
              :active-id="info ?? undefined"
              title="Alarm oder Ticket"
              @toggle="toggle('verdict')"
              >{{ HELP.verdict }}</InfoPopover
            >
            <span class="mw-badge" :style="{ background: verdict.color }">{{
              verdict.label
            }}</span>
          </div>
          <div class="mw-line">{{ verdict.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mw {
  font-family:
    Inter,
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--mw-hi);
  background: var(--mw-bg);
  border: 1px solid var(--mw-border);
  border-radius: 8px;
  padding: 6px 8px;
}
.mw-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 10px;
  margin-bottom: 5px;
}
.mw-group {
  display: flex;
  align-items: center;
  gap: 5px;
}
.mw-lbl {
  color: var(--mw-mid);
  font-weight: 600;
}
.mw-seg {
  display: inline-flex;
  border: 1px solid var(--mw-border);
  border-radius: 5px;
  overflow: hidden;
  background: var(--mw-panel);
}
.mw-seg button {
  font: inherit;
  font-weight: 600;
  padding: 2px 6px;
  border: 0;
  border-right: 1px solid var(--mw-border);
  background: transparent;
  color: var(--mw-mid);
  cursor: pointer;
}
.mw-seg button:last-child {
  border-right: 0;
}
.mw-seg button.on {
  background: var(--mw-accent);
  color: #fff;
}
.mw-seg button:focus-visible,
.mw-card:focus-visible {
  outline: 2px solid var(--mw-accent);
  outline-offset: -2px;
}
.mw-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 268px;
  gap: 8px;
  align-items: start;
}
.mw-chart {
  background: var(--mw-panel);
  border: 1px solid var(--mw-border);
  border-radius: 6px;
  padding: 4px 4px 5px;
}
.mw-svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
}
.t-title {
  font-size: 9px;
  font-weight: 600;
  fill: var(--mw-mid);
}
.t-tick {
  font-size: 8px;
  fill: var(--mw-mid);
}
.t-tick.end,
.t-title.end {
  text-anchor: end;
}
.t-tick.mid {
  text-anchor: middle;
}
.bold {
  font-weight: 700;
  fill: var(--mw-hi);
}
.s-panel {
  fill: none;
  stroke: var(--mw-border);
}
.s-grid {
  stroke: var(--mw-grid);
}
.s-tick {
  stroke: var(--mw-mid);
}
.f-err {
  fill: var(--mw-err);
  fill-opacity: 0.55;
  stroke: var(--mw-err);
  stroke-width: 1;
}
.band {
  pointer-events: none;
}
.f-long {
  fill: var(--mw-long);
  fill-opacity: 0.16;
}
.f-short {
  fill: var(--mw-short);
  fill-opacity: 0.38;
}
.f-long-text {
  fill: var(--mw-long);
}
.f-short-text {
  fill: var(--mw-short);
}
.s-long,
.s-short {
  fill: none;
  stroke-width: 1.7;
  stroke-linejoin: round;
}
.s-long {
  stroke: var(--mw-long);
}
.s-short {
  stroke: var(--mw-short);
}
.s-long.off,
.s-short.off {
  stroke-opacity: 0.3;
  stroke-dasharray: 2 3;
}
.env .env-fill {
  stroke: none;
  fill-opacity: 0.26;
}
.s-err {
  fill: none;
  stroke: var(--mw-err);
}
.s-err.env .env-fill {
  fill: var(--mw-err);
}
.env-key {
  fill-opacity: 0.26;
  stroke-width: 0.7;
}
.k-long {
  fill: var(--mw-long);
  stroke: var(--mw-long);
}
.k-short {
  fill: var(--mw-short);
  stroke: var(--mw-short);
}
.k-err {
  fill: var(--mw-err);
  stroke: var(--mw-err);
}
.s-long.env .env-fill {
  fill: var(--mw-long);
}
.s-short.env .env-fill {
  fill: var(--mw-short);
}
.env .env-edge {
  stroke-width: 1;
  stroke-linejoin: miter;
}
.env.off .env-fill {
  fill-opacity: 0.1;
}
.s-theta {
  stroke-width: 1.2;
  stroke-dasharray: 5 3;
}
.s-theta.key {
  stroke-dasharray: 3 2;
}
.fire-zone {
  fill-opacity: 0.14;
}
.lane {
  fill: var(--mw-panel-hi);
  stroke: var(--mw-border);
}
.lane.sel {
  stroke: var(--mw-grid-strong);
}
.f-ref {
  fill: var(--mw-hi);
}
.s-cursor {
  stroke: var(--mw-hi);
  stroke-width: 1;
  stroke-dasharray: 3 2;
}
.mw-range {
  display: block;
  width: 92.4%;
  margin: 1px 0 2px 6.4%;
  height: 10px;
  accent-color: var(--mw-accent);
}
.mw-finding {
  min-height: 2.6em;
  padding: 0 4px;
  color: var(--mw-hi);
}
.mw-ref {
  color: var(--mw-mid);
  margin-right: 6px;
  white-space: nowrap;
}
.mw-ref i {
  display: inline-block;
  width: 12px;
  height: 3px;
  margin-right: 3px;
  vertical-align: middle;
  background: var(--mw-hi);
}
.mw-side {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mw-now {
  color: var(--mw-mid);
}
.mw-now b {
  color: var(--mw-hi);
}
.mw-card,
.mw-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font: inherit;
  text-align: left;
  color: inherit;
  background: var(--mw-panel);
  border: 1px solid var(--mw-border);
  border-radius: 6px;
  padding: 4px 6px;
}
.mw-card {
  cursor: pointer;
}
.mw-card.sel {
  border-color: var(--mw-accent);
  background: var(--mw-panel-hi);
}
.mw-card-head,
.mw-box-head {
  display: flex;
  align-items: center;
  gap: 5px;
}
.mw-box-head > :last-child {
  margin-left: auto;
}
.mw-box-head > span:first-child {
  font-weight: 600;
  color: var(--mw-mid);
}
.mw-badge {
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  border-radius: 3px;
  padding: 0 4px;
}
.mw-rule {
  font-weight: 600;
}
.mw-lamp {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  border: 1px solid var(--mw-border);
  border-radius: 8px;
  padding: 0 6px;
  color: var(--mw-mid);
}
.mw-gate {
  display: flex;
  align-items: center;
  gap: 4px;
}
.mw-chip {
  border-radius: 3px;
  padding: 0 4px;
  border: 1px solid;
  font-variant-numeric: tabular-nums;
}
.mw-chip.long {
  border-color: var(--mw-long);
}
.mw-chip.short {
  border-color: var(--mw-short);
}
.mw-chip.off {
  opacity: 0.4;
  text-decoration: line-through;
}
.mw-op {
  font-size: 9px;
  font-weight: 700;
  color: var(--mw-mid);
}
.mw-line {
  display: block;
}
.mw-line.dim {
  color: var(--mw-mid);
}
.mw-bar {
  position: relative;
  height: 7px;
  border-radius: 4px;
  background: var(--mw-panel-hi);
  border: 1px solid var(--mw-border);
  overflow: hidden;
}
.mw-bar-fill {
  height: 100%;
}
.mw-bar-mark {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--mw-hi);
}
</style>
