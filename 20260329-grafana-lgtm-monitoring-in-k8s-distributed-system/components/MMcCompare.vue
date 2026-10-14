<script setup>
/**
 * MMcCompare.vue — derselbe Ankunftsstrom in zwei Subsysteme: Pool (rechts)
 * gegen Alternative (links: 1 schneller Koch „Tempo“ oder c getrennte Schlangen
 * „Pooling“), als Grafana-Dashboard. Pointe: Im Tempo-Modus küren Wartezeit Wq
 * und Gesamtzeit T verschiedene Sieger (T = Wq + Bedienzeit; 1/(cμ) gegen 1/μ),
 * die Latency-Leiste hebt das hervor. Metriken nach Golden Signals wählbar,
 * Zeitreihen mit je einer Serie für Alternative und Pool.
 */
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from "vue";
import { expo } from "./lib/queueing.js";
import { World, theory, makeLayout, reconcile, drawXY, SC } from "./lib/mmc.js";
import { useGrafanaPalette } from "./lib/grafanaPalette";
import { useInfoPopover } from "./lib/useInfoPopover";
import { MetricHistory } from "./lib/metricHistory";
import { CounterRate } from "./lib/counterRate";
import { METRICS } from "./lib/metrics";
import { WinnerTracker, winner } from "./lib/winners";
import QueueSlider from "./QueueSlider.vue";
import InfoPopover from "./InfoPopover.vue";
import CanteenStage from "./CanteenStage.vue";
import MetricPicker from "./MetricPicker.vue";
import GrafanaGauge from "./GrafanaGauge.vue";
import GrafanaStat from "./GrafanaStat.vue";
import GrafanaTimeSeries from "./GrafanaTimeSeries.vue";

const props = defineProps({
  initialMetrics: { type: Array, default: () => ["wq", "t"] },
});

const C = useGrafanaPalette();
const { info, toggle } = useInfoPopover();

const FONTS = {
  MONO: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  SANS: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
};
const MODES = [
  { key: "tempo", label: "Tempo: 1 schneller Koch" },
  { key: "pooling", label: "Pooling: getrennte Schlangen" },
];
const XY_METRICS = [
  { key: "Wq", label: "Wq" },
  { key: "T", label: "T" },
  { key: "pw", label: "P(warten)" },
];
const RHO_PRESETS = [0.5, 0.7, 0.85, 0.95];
const SPEED_PRESETS = [3, 20, 100];
const AVAILABLE = ["wq", "t", "thr", "rho", "queue", "pw"];
const HIST_KEYS = AVAILABLE.flatMap((k) => [`${k}_alt`, `${k}_pool`]);

/* ---- reaktiver Zustand ---- */
const mode = ref("tempo");
const lambda = ref(1.5);
const mu = ref(1.0);
const c = ref(3);
const speed = ref(3);
const paused = ref(true);
const xyMetric = ref("T");
const controlsOpen = ref(false);
const xyZoomed = ref(false);
const active = ref(AVAILABLE.filter((k) => props.initialMetrics.includes(k)));
const rangeKey = ref("since");
const logY = ref(false);

/* ---- nicht-reaktive Holder ---- */
const world = new World(1.5, 1.0, 3, "tempo");
const history = new MetricHistory(HIST_KEYS);
/** Zähler wie ein Exporter; Durchsatz/Auslastung = rate(…[5m]). */
const rates = new CounterRate();
const RATE_WINDOW = 300;
const wqTracker = new WinnerTracker();
const tTracker = new WinnerTracker();
let anchorDep = 0;
const visL = new Map();
const visR = new Map();
const xyCanvas = ref(null);
let ctx = null;
let raf = 0;
let last = 0;
let lastSample = 0;

const zMetrics = () => ({ pw: 0, Wq: 0, T: 0, S: 0, N: 0, Nq: 0, L: 0, n: 0 });
const leftView = shallowRef({
  entities: [],
  badges: [],
  servers: [],
  layout: makeLayout(world.left),
  fast: world.mode === "tempo",
});
const rightView = shallowRef({
  entities: [],
  badges: [],
  servers: [],
  layout: makeLayout(world.right),
});
const score = shallowRef({
  l: zMetrics(),
  r: zMetrics(),
  thrL: 0,
  thrR: 0,
  busyL: 0,
  busyR: 0,
  wq: "pending",
  t: "pending",
});
const race = shallowRef({ n: 0, lPct: 0, rPct: 0, lLead: 0, rLead: 0 });
const sampleTick = ref(0);

const fmtRho = (r) => r.toFixed(2).replace(".", ",");
function annotateChange() {
  const rho = world.lambda / (world.c * world.mu);
  const label = `ρ → ${fmtRho(rho)}`;
  const a = history.annotations[history.annotations.length - 1];
  if (a && world.clock - a.t < 2) {
    a.label = label;
    a.t = world.clock;
  } else history.annotate(world.clock, label);
  // Gewinner neu beurteilen: Messfenster enthält noch die alte Welt.
  wqTracker.reset();
  tTracker.reset();
  anchorDep = Math.min(world.left.numDep, world.right.numDep);
}
function hardReset() {
  history.reset();
  rates.reset();
  wqTracker.reset();
  tTracker.reset();
  anchorDep = 0;
  visL.clear();
  visR.clear();
  sampleTick.value++;
}

watch(lambda, (v) => {
  world.lambda = v;
  world.nextArrival = world.clock + expo(v);
  annotateChange();
});
watch(mu, (v) => {
  world.mu = v;
  annotateChange();
});
watch([mode, c], () => {
  world.mode = mode.value;
  world.c = c.value;
  world.configure();
  hardReset();
});

function reset() {
  world.configure();
  hardReset();
}
function setRhoMMc(rr) {
  lambda.value = +(rr * c.value * mu.value).toFixed(3);
}

const rho = computed(() => lambda.value / (c.value * mu.value));
const rhoColor = computed(() =>
  rho.value < 0.7 ? C.value.ok : rho.value < 0.9 ? C.value.warn : C.value.crit,
);
const leftCaption = computed(() =>
  mode.value === "tempo"
    ? `1 Koch @ ${(c.value * mu.value).toFixed(1)}/s ⚡`
    : `${c.value} Köche @ ${mu.value.toFixed(1)}/s · je eigene Schlange`,
);

/* ---- Theorie ---- */
const th = computed(() => {
  const leftSys = mode.value === "tempo" ? "tempo" : "pooling";
  return {
    alt: theory(leftSys, lambda.value, mu.value, c.value),
    pool: theory("pool", lambda.value, mu.value, c.value),
  };
});
function theoryOf(key, side) {
  const t = th.value[side];
  const m = mu.value;
  if (!Number.isFinite(t.Wq)) return key === "rho" ? 1 : null;
  switch (key) {
    case "wq":
      return t.Wq * m;
    case "t":
      return t.T * m;
    case "thr":
      return lambda.value;
    case "rho":
      return t.rho;
    case "queue":
      return lambda.value * t.Wq;
    case "pw":
      return t.pw;
  }
  return null;
}

const fmt1 = (v) =>
  !Number.isFinite(v) ? "∞" : v >= 9.95 ? v.toFixed(0) : v.toFixed(2);
const FMT = {
  rho: (v) => (v * 100).toFixed(0) + " %",
  thr: (v) => v.toFixed(2),
  queue: (v) =>
    v >= 9.95 || Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1),
  wq: fmt1,
  t: fmt1,
  pw: (v) => (v * 100).toFixed(0) + " %",
};

/* ---- Messwerte je Seite in Panel-Einheiten ---- */
function sideValues(m, thr, busy, nServers) {
  const u = mu.value;
  return {
    wq: m.Wq * u,
    t: m.T * u,
    s: m.S * u,
    thr,
    rho: Math.min(1, busy / nServers),
    queue: m.Nq,
    pw: m.pw,
  };
}
const vals = computed(() => {
  const s = score.value;
  return {
    alt: sideValues(s.l, s.thrL, s.busyL, world.left.nServers),
    pool: sideValues(s.r, s.thrR, s.busyR, world.right.nServers),
  };
});

/* ---- Dashboard-Daten aus der History ---- */
const dash = computed(() => {
  void sampleTick.value;
  const now = history.lastT;
  const [t0, t1] = history.window(rangeKey.value, now);
  const panels = {};
  for (const key of AVAILABLE) {
    panels[key] = {
      altSpark: history.series(`${key}_alt`, t0, t1, 40),
      poolSpark: history.series(`${key}_pool`, t0, t1, 40),
      altRows: history.series(`${key}_alt`, t0, t1, 200),
      poolRows: history.series(`${key}_pool`, t0, t1, 200),
    };
  }
  return { t0, t1, now, panels };
});

/** Stat-Panels für die Nicht-Latenz-Metriken (Latenz hat die Gewinner-Leiste). */
const statPanels = computed(() =>
  ["queue", "pw", "thr"].map((key) => {
    const def = METRICS[key];
    const a = vals.value.alt[key];
    const p = vals.value.pool[key];
    // Durchsatz ist im Gleichgewicht auf beiden Seiten λ — kein Sieger.
    const w = key === "thr" ? "tie" : winner(a, p, 0.03);
    return {
      key,
      title: def.label,
      help: def.help,
      unit: def.unit === "%" ? "" : def.unit,
      dim: !active.value.includes(key),
      values: [
        {
          text: FMT[key](a),
          color: C.value.alt,
          label: "Alternative",
          best: w === "alt",
        },
        {
          text: FMT[key](p),
          color: C.value.pool,
          label: "Pool",
          best: w === "pool",
        },
      ],
      sparks: [
        { pts: dash.value.panels[key].altSpark, color: C.value.alt },
        { pts: dash.value.panels[key].poolSpark, color: C.value.pool },
      ],
      sub:
        key === "thr"
          ? `beide ≈ λ = ${lambda.value.toFixed(2)}`
          : `Theorie ${FMT[key](theoryOf(key, "alt") ?? Infinity)} | ${FMT[key](theoryOf(key, "pool") ?? Infinity)}`,
    };
  }),
);

/* ---- Latency-Leiste: Sieger je Metrik + Zerlegung T = Wq + Bedienzeit ---- */
const SIDE_LABEL = {
  alt: "Alternative",
  pool: "Pool",
  tie: "≈ gleich",
  pending: "misst …",
};
const latency = computed(() => {
  const s = score.value;
  const v = vals.value;
  const thWq = winner(th.value.alt.Wq, th.value.pool.Wq);
  const thT = winner(th.value.alt.T, th.value.pool.T);
  const rows = [
    { key: "wq", label: "Wartezeit Wq", verdict: s.wq, theory: thWq },
    { key: "t", label: "Gesamtzeit T", verdict: s.t, theory: thT },
  ].filter((r) => active.value.includes(r.key));
  const decided = (x) => x === "alt" || x === "pool";
  const conflict =
    active.value.includes("wq") &&
    active.value.includes("t") &&
    decided(s.wq) &&
    decided(s.t) &&
    s.wq !== s.t;
  const agree =
    active.value.includes("wq") &&
    active.value.includes("t") &&
    decided(s.wq) &&
    s.wq === s.t;
  const scale = Math.max(v.alt.t, v.pool.t, 1e-6) * 1.05;
  const bars = [
    { side: "alt", name: "Alt", color: C.value.alt, ...v.alt },
    { side: "pool", name: "Pool", color: C.value.pool, ...v.pool },
  ].map((b) => ({
    ...b,
    wqPct: (Math.max(0, b.wq) / scale) * 100,
    sPct: (Math.max(0, b.s) / scale) * 100,
  }));
  const theoryText =
    "Theorie: " +
    rows
      .map(
        (r) =>
          `${r.key === "wq" ? "Wq" : "T"} → ${r.theory === "alt" ? "Alt" : r.theory === "pool" ? "Pool" : "≈"}`,
      )
      .join(" · ");
  return { rows, conflict, agree, agreeSide: s.wq, bars, theoryText };
});
function verdictColor(v) {
  return v === "alt"
    ? C.value.alt
    : v === "pool"
      ? C.value.pool
      : C.value.textLow;
}

const tsRows = computed(() =>
  active.value.map((key) => {
    const def = METRICS[key];
    const p = dash.value.panels[key];
    return {
      key,
      title: def.label,
      unit: def.unit === "%" ? def.signal : `${def.signal} · ${def.unit}`,
      series: [
        { name: "Alt", color: C.value.alt, pts: p.altRows },
        { name: "Pool", color: C.value.pool, pts: p.poolRows },
      ],
      theory:
        key === "thr"
          ? [{ value: theoryOf(key, "pool"), label: "Theorie λ" }]
          : [
              {
                value: theoryOf(key, "alt"),
                color: C.value.alt,
                label: "Theorie",
              },
              { value: theoryOf(key, "pool"), color: C.value.pool },
            ],
      fixedMax: key === "rho" || key === "pw" ? 1 : undefined,
      logAllowed: key === "wq" || key === "t" || key === "queue",
      fmt: FMT[key],
    };
  }),
);

const HELP = {
  "kantine-r":
    "Eine gemeinsame Schlange für alle c Köche: Der vorderste Gast geht zum nächsten freien Koch. Essen-Emoji = Bedienlänge, „Xs“ = Restzeit, „+N“ = zusätzlich Wartende. Diese Kantine ist in beiden Modi identisch, die Referenz, gegen die links verglichen wird.",
  race: "Beide Seiten bekommen denselben Gast (gleiche Ankunft, gleicher Arbeitsbedarf, gekoppelte Zufallsströme). Der Balken zeigt, wie oft derselbe Zwilling links bzw. im Pool zuerst fertig wird — das misst die Gesamtzeit T.",
  latency:
    "Wer ist schneller? Das hängt davon ab, welche Latenz man misst. T = Wq + Bedienzeit. Im Tempo-Modus wartet man im Pool kürzer (eine Schlange für c Köche: Pooling-Effekt), wird dort aber c-mal langsamer bedient (1/μ statt 1/(cμ)). Deshalb gewinnt der Pool die Wartezeit Wq und der schnelle Koch die Gesamtzeit T — bei jedem ρ und jedem c (geschlossene Formeln: Erlang C). Im Pooling-Modus gewinnt der Pool beides. Der Sieger wird aus den Messwerten bestimmt, sobald genug Gäste fertig sind; „Theorie“ daneben ist das Ergebnis der Formel.",
  xy: "XY-Chart (Phasenraum) wie in Grafana: Theoriekurven über der Auslastung ρ, orange = Alternative, grün = Pool. Die Punkte sind die aktuellen Messwerte bei deinem ρ (gestrichelte Linie). Zwischen Wq, T und P(warten) umschalten: Im Tempo-Modus wechselt der Sieger mit der Metrik; im Pooling-Modus liegt der Pool immer unten.",
  ts: "Zeitreihen der gewählten Metriken, je Zeile Alternative (orange) und Pool (grün). Gestrichelt = Theorie-Mittel. Bei Wq liegt die orange Linie über der grünen, bei T darunter: dieselben Gäste, entgegengesetztes Urteil.",
  rho: "Gemessene Auslastung (Utilization) beider Seiten, Mittel aus Alternative und Pool. Bei gleicher Gesamtkapazität cμ ist sie auf beiden Seiten gleich — sie unterscheidet die Systeme also gar nicht.",
};
const kantineLHelp = computed(
  () =>
    "Gäste kommen links an, stellen sich an, werden vom 🧑‍🍳 bedient und gehen rechts. Essen-Emoji = Bedienlänge, „Xs“ = Restzeit, „+N“ = zusätzlich Wartende. " +
    (mode.value === "tempo"
      ? "⚡ = ein einzelner, c-fach schnellerer Koch."
      : "Jeder Koch hat seine eigene Schlange. Sie wird bei Ankunft zufällig gewählt, daher droht Head-of-Line-Blocking."),
);

function btnStyle(border) {
  return {
    background: C.value.panelHi,
    color: C.value.textHi,
    border: `1px solid ${border}`,
  };
}
function modeStyle(key) {
  return mode.value === key
    ? { background: C.value.panelHi, color: C.value.textHi }
    : { background: "transparent", color: C.value.textLow };
}
function presetStyle(rr) {
  return btnStyle(rr >= 0.9 ? C.value.warn : C.value.border);
}
function speedStyle(s) {
  return btnStyle(speed.value === s ? C.value.accent : C.value.border);
}

/* ---- RAF-Loop ---- */
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused.value) world.advance(world.clock + dtReal * speed.value);

  const layL = makeLayout(world.left);
  const layR = makeLayout(world.right);
  const instant = speed.value > 10;
  const recL = reconcile(world.left, visL, layL, dtReal, instant);
  const recR = reconcile(world.right, visR, layR, dtReal, instant);
  const sv = (sub) =>
    sub.servers.map((s) => ({
      busy: s.busy,
      food: s.food,
      remaining: s.busy ? Math.max(0, s.depart - world.clock) : 0,
    }));
  leftView.value = {
    entities: recL.entities,
    badges: recL.badges,
    servers: sv(world.left),
    layout: layL,
    fast: world.mode === "tempo",
  };
  rightView.value = {
    entities: recR.entities,
    badges: recR.badges,
    servers: sv(world.right),
    layout: layR,
  };

  if (ctx) {
    drawXY(
      ctx,
      C.value,
      FONTS,
      xyMetric.value,
      world.mu,
      world.c,
      world.mode,
      world.left.metrics(),
      world.right.metrics(),
      world.lambda / (world.c * world.mu),
    );
  }

  if (now - lastSample > 140) {
    lastSample = now;
    const lm = world.left.metrics();
    const rm = world.right.metrics();
    rates.push(world.clock, {
      depL: world.left.numDep,
      depR: world.right.numDep,
      busyL: world.left.busyArea,
      busyR: world.right.busyArea,
    });
    const thrL = rates.rate("depL", RATE_WINDOW) ?? 0;
    const thrR = rates.rate("depR", RATE_WINDOW) ?? 0;
    const busyL = rates.rate("busyL", RATE_WINDOW) ?? 0;
    const busyR = rates.rate("busyR", RATE_WINDOW) ?? 0;
    const samples = Math.min(lm.n, rm.n) - anchorDep;
    const u = world.mu;
    const wq = wqTracker.update(lm.Wq * u, rm.Wq * u, samples);
    const t = tTracker.update(lm.T * u, rm.T * u, samples);
    score.value = { l: lm, r: rm, thrL, thrR, busyL, busyR, wq, t };
    race.value = world.raceSummary();
    if (!paused.value && lm.n > 0 && rm.n > 0) {
      const a = sideValues(lm, thrL, busyL, world.left.nServers);
      const p = sideValues(rm, thrR, busyR, world.right.nServers);
      const rec = {};
      for (const k of AVAILABLE) {
        rec[`${k}_alt`] = a[k];
        rec[`${k}_pool`] = p[k];
      }
      history.push(world.clock, rec);
    }
    sampleTick.value++;
  }
}

onMounted(() => {
  const cv = xyCanvas.value;
  if (cv) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = SC.W * dpr;
    cv.height = SC.H * dpr;
    ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
  }
  last = performance.now();
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <div
    class="sim-root"
    :style="{
      '--c-bg': C.bg,
      '--c-panel': C.panel,
      '--c-border': C.border,
      '--c-textHi': C.textHi,
      '--c-textMid': C.textMid,
      '--c-textLow': C.textLow,
    }"
  >
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="title">M/M/c · Welche Latenz kürt den Sieger?</div>
        <div class="subtitle">
          Gleiche Kapazität cμ, gleicher Ankunftsstrom — Wartezeit und
          Gesamtzeit können verschiedene Sieger küren.
        </div>
      </div>
      <div class="header-btns">
        <span class="rho-badge"
          >ρ=<b :style="{ color: rhoColor }">{{ rho.toFixed(2) }}</b> · cμ={{
            (c * mu).toFixed(1)
          }}</span
        >
        <button
          class="btn"
          :style="btnStyle(paused ? C.accent : C.border)"
          @click="paused = !paused"
        >
          {{ paused ? "▶ Weiter" : "⏸ Pause" }}
        </button>
        <button class="btn" :style="btnStyle(C.border)" @click="reset">
          ↻ Reset
        </button>
        <button
          class="btn"
          :style="btnStyle(controlsOpen ? C.accent : C.border)"
          :aria-expanded="controlsOpen"
          aria-controls="mmc-ctl"
          title="Regler ein-/ausblenden"
          @click="controlsOpen = !controlsOpen"
        >
          🛠️
        </button>
      </div>
    </div>

    <!-- Toolbar: Modus, ρ, Zeitraffer, Metriken — immer sichtbar -->
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="mode-toggle" :style="{ borderColor: C.border }">
          <button
            v-for="m in MODES"
            :key="m.key"
            class="mode-btn"
            :data-mode="m.key"
            :style="modeStyle(m.key)"
            @click="mode = m.key"
          >
            {{ m.label }}
          </button>
        </div>
        <div class="presets">
          <span class="presets-label">ρ:</span>
          <button
            v-for="rr in RHO_PRESETS"
            :key="rr"
            class="preset-btn"
            :data-rho="rr"
            :style="presetStyle(rr)"
            @click="setRhoMMc(rr)"
          >
            {{ rr.toFixed(2) }}
          </button>
          <span class="presets-label sep">Zeitraffer:</span>
          <button
            v-for="s in SPEED_PRESETS"
            :key="s"
            class="preset-btn"
            :data-speed="s"
            :style="speedStyle(s)"
            @click="speed = s"
          >
            {{ s }}×
          </button>
        </div>
      </div>
      <MetricPicker v-model="active" :available="AVAILABLE" />
    </div>

    <!-- Regler hinter 🛠️ (Overlay) -->
    <div
      v-show="controlsOpen"
      id="mmc-ctl"
      class="controls"
      :style="{ background: C.panel, borderColor: C.border }"
    >
      <QueueSlider
        :model-value="lambda"
        label="Ankunftsrate λ"
        :min="0.1"
        :max="c * mu * 1.05"
        :step="0.01"
        unit="/s"
        @update:model-value="(v) => (lambda = v)"
      />
      <QueueSlider
        :model-value="mu"
        label="Bedienrate μ (je Koch)"
        :min="0.3"
        :max="2.0"
        :step="0.01"
        unit="/s"
        @update:model-value="(v) => (mu = v)"
      />
      <QueueSlider
        :model-value="c"
        label="Anzahl Köche c"
        :min="2"
        :max="6"
        :step="1"
        unit=""
        @update:model-value="(v) => (c = Math.round(v))"
      />
      <QueueSlider
        :model-value="speed"
        label="Zeitraffer"
        :min="0.5"
        :max="100"
        :step="0.5"
        unit="×"
        @update:model-value="(v) => (speed = v)"
      />
    </div>

    <div class="top">
      <!-- links: Kantinen + Race-Bar -->
      <div class="left">
        <div class="canteens">
          <div
            class="canteen"
            :style="{ background: C.panel, borderColor: C.alt + '55' }"
          >
            <div class="canteen-info">
              <InfoPopover
                id="kantine-l"
                :active-id="info"
                title="Kantine links (Alternative)"
                @toggle="toggle('kantine-l')"
                >{{ kantineLHelp }}</InfoPopover
              >
            </div>
            <CanteenStage
              :accent="C.alt"
              :caption="`◄ Alt · ${leftCaption}`"
              :layout="leftView.layout"
              :servers="leftView.servers"
              :entities="leftView.entities"
              :badges="leftView.badges"
              :fast="leftView.fast"
            />
          </div>
          <div
            class="canteen"
            :style="{ background: C.panel, borderColor: C.pool + '55' }"
          >
            <div class="canteen-info">
              <InfoPopover
                id="kantine-r"
                :active-id="info"
                title="Kantine rechts (Pool)"
                @toggle="toggle('kantine-r')"
                >{{ HELP["kantine-r"] }}</InfoPopover
              >
            </div>
            <CanteenStage
              :accent="C.pool"
              :caption="`Pool · ${c} Köche @ ${mu.toFixed(1)}/s ►`"
              :layout="rightView.layout"
              :servers="rightView.servers"
              :entities="rightView.entities"
              :badges="rightView.badges"
            />
          </div>
        </div>

        <div
          class="race"
          :style="{ background: C.panel, borderColor: C.border }"
        >
          <div class="race-head">
            <span>Zwillinge: wer ist zuerst fertig (T)?</span>
            <InfoPopover
              id="race"
              :active-id="info"
              title="Wettrennen der Zwillinge"
              @toggle="toggle('race')"
              >{{ HELP.race }}</InfoPopover
            >
            <span class="race-n">n={{ race.n }}</span>
          </div>
          <div class="race-bar" :style="{ background: C.panelHi }">
            <div
              class="race-seg"
              :style="{ width: race.lPct * 100 + '%', background: C.alt }"
            >
              {{
                race.lPct * 100 >= 14 ? `${(race.lPct * 100).toFixed(0)}%` : ""
              }}
            </div>
            <div
              class="race-seg"
              :style="{ width: race.rPct * 100 + '%', background: C.pool }"
            >
              {{
                race.rPct * 100 >= 14 ? `${(race.rPct * 100).toFixed(0)}%` : ""
              }}
            </div>
          </div>
        </div>
        <!-- Latency: Sieger je Metrik + Zerlegung -->
        <div
          class="panel latency"
          data-panel="latency"
          :style="{ background: C.panel, borderColor: C.border }"
        >
          <div class="panel-head">
            <span class="panel-title"
              >Latency · Wer gewinnt? (kleiner = besser)</span
            >
            <span class="lat-caption">Zerlegung: T = Wq + Bedienzeit</span>
            <InfoPopover
              id="latency"
              :active-id="info"
              title="Wartezeit vs. Gesamtzeit"
              @toggle="toggle('latency')"
              >{{ HELP.latency }}</InfoPopover
            >
          </div>
          <div class="lat-body">
            <div class="lat-verdicts">
              <div
                v-for="r in latency.rows"
                :key="r.key"
                class="lat-row"
                :data-verdict="r.key"
                :data-winner="r.verdict"
              >
                <span class="lat-label">{{ r.label }}</span>
                <span
                  class="lat-win"
                  :style="{ color: verdictColor(r.verdict) }"
                  >{{ r.verdict === "alt" || r.verdict === "pool" ? "✓ " : ""
                  }}{{ SIDE_LABEL[r.verdict] }}</span
                >
              </div>
              <div v-if="latency.rows.length" class="lat-theo">
                {{ latency.theoryText }}
              </div>
              <div v-if="!latency.rows.length" class="lat-empty">
                Wartezeit oder Gesamtzeit oben einschalten.
              </div>
            </div>
            <div class="lat-bars" aria-label="Zerlegung T = Wq + Bedienzeit">
              <div v-for="b in latency.bars" :key="b.side" class="lat-bar-row">
                <span class="lat-bar-name" :style="{ color: b.color }">{{
                  b.name
                }}</span>
                <div class="lat-track" :style="{ background: C.panelHi }">
                  <div
                    class="lat-seg"
                    :style="{ width: b.wqPct + '%', background: b.color }"
                    :title="`Wartezeit Wq ${fmt1(b.wq)}×`"
                  />
                  <div
                    class="lat-seg lat-seg-s"
                    :style="{
                      width: b.sPct + '%',
                      background: `repeating-linear-gradient(45deg, ${b.color}66, ${b.color}66 3px, transparent 3px, transparent 6px)`,
                      borderColor: b.color,
                    }"
                    :title="`Bedienzeit ${fmt1(b.s)}×`"
                  />
                </div>
                <span class="lat-bar-txt"
                  >Wq {{ fmt1(b.wq) }} + Bed. {{ fmt1(b.s) }} = T
                  {{ fmt1(b.t) }}</span
                >
              </div>
            </div>
          </div>
          <div
            v-if="latency.conflict"
            class="lat-conflict"
            data-conflict
            :style="{
              borderColor: C.warn,
              background: C.warn + '22',
              color: C.textHi,
            }"
          >
            ⚠ Wq und T widersprechen sich — die Wahl der Metrik entscheidet.
          </div>
          <div
            v-else-if="latency.agree"
            class="lat-agree"
            :style="{ color: C.textMid }"
          >
            Kein Widerspruch: {{ SIDE_LABEL[latency.agreeSide] }} gewinnt beide.
          </div>
        </div>
      </div>

      <div class="right">
        <!-- rechts: XY-Chart (Phasenraum) -->
        <div
          class="panel xy-panel"
          :class="{ zoomed: xyZoomed }"
          :style="{ background: C.panel, borderColor: C.border }"
        >
          <div class="panel-head">
            <span class="panel-title">
              XY-Chart (Phasenraum) ·
              <span :style="{ color: C.alt }">Alt</span> vs.
              <span :style="{ color: C.pool }">Pool</span>
              <InfoPopover
                id="xy"
                :active-id="info"
                title="XY-Chart (Phasenraum)"
                @toggle="toggle('xy')"
                >{{ HELP.xy }}</InfoPopover
              >
            </span>
            <div class="xy-toggle">
              <button
                v-for="mt in XY_METRICS"
                :key="mt.key"
                class="btn-sm"
                :data-xy="mt.key"
                :style="btnStyle(xyMetric === mt.key ? C.accent : C.border)"
                @click="xyMetric = mt.key"
              >
                {{ mt.label }}
              </button>
            </div>
          </div>
          <canvas ref="xyCanvas" class="xy-canvas" />
          <button
            class="zoom-btn"
            :style="{
              background: C.panelHi,
              borderColor: C.border,
              color: C.textMid,
            }"
            :title="xyZoomed ? 'XY-Chart verkleinern' : 'XY-Chart vergrößern'"
            @click="xyZoomed = !xyZoomed"
          >
            {{ xyZoomed ? "⤡" : "⤢" }}
          </button>
        </div>
        <!-- übrige Metriken -->
        <div class="stats">
          <GrafanaGauge
            data-panel="rho"
            :title="METRICS.rho.label"
            :frac="(vals.alt.rho + vals.pool.rho) / 2"
            :text="(((vals.alt.rho + vals.pool.rho) / 2) * 100).toFixed(0)"
            unit="%"
            :mark="Math.min(1, rho)"
            :sub="`Alt ${(vals.alt.rho * 100).toFixed(0)} · Pool ${(vals.pool.rho * 100).toFixed(0)} %`"
            :dim="!active.includes('rho')"
          >
            <template #info>
              <InfoPopover
                id="st-rho"
                :active-id="info"
                :title="METRICS.rho.label"
                @toggle="toggle('st-rho')"
                >{{ HELP.rho }}</InfoPopover
              >
            </template>
          </GrafanaGauge>
          <GrafanaStat
            v-for="p in statPanels"
            :key="p.key"
            :data-panel="p.key"
            :title="p.title"
            :values="p.values"
            :unit="p.unit"
            :sparks="p.sparks"
            :range="[dash.t0, dash.t1]"
            :sub="p.sub"
            :dim="p.dim"
          >
            <template #info>
              <InfoPopover
                :id="'st-' + p.key"
                :active-id="info"
                :title="p.title"
                @toggle="toggle('st-' + p.key)"
                >{{ p.help }}</InfoPopover
              >
            </template>
          </GrafanaStat>
        </div>
      </div>
    </div>

    <GrafanaTimeSeries
      title="Time Series · Alt vs. Pool"
      :rows="tsRows"
      :range="[dash.t0, dash.t1]"
      :range-key="rangeKey"
      :annotations="history.annotations"
      :log-y="logY"
      :plot-height="104"
      @update:range-key="(k) => (rangeKey = k)"
      @toggle-log="logY = !logY"
    >
      <template #info>
        <InfoPopover
          id="ts"
          :active-id="info"
          title="Zeitverlauf"
          @toggle="toggle('ts')"
          >{{ HELP.ts }}</InfoPopover
        >
      </template>
    </GrafanaTimeSeries>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.sim-root {
  position: relative;
  background: var(--c-bg);
  color: var(--c-textHi);
  font-family: inherit;
  padding: 6px 10px 6px;
  max-width: 960px;
  margin: 0 auto;
  max-height: 540px;
  overflow-y: auto;
  border-radius: 6px;
}
.sim-root ::-webkit-scrollbar {
  width: 4px;
}
.sim-root ::-webkit-scrollbar-thumb {
  background: var(--c-border);
  border-radius: 2px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.subtitle {
  font-size: 9.5px;
  color: var(--c-textMid);
  line-height: 1.35;
  max-width: 560px;
}
.header-btns {
  display: flex;
  gap: 6px;
  align-items: center;
}
.rho-badge {
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  white-space: nowrap;
  color: var(--c-textLow);
}
.btn {
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
}

/* Toolbar */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 5px;
}
.toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.mode-toggle {
  display: flex;
  border: 1px solid;
  border-radius: 4px;
  overflow: hidden;
}
.mode-btn {
  border: none;
  padding: 3px 10px;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.presets {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.presets-label {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textLow);
}
.presets-label.sep {
  margin-left: 8px;
}
.preset-btn {
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 10.5px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}

/* Controls — Overlay, belegt keinen Flussplatz */
.controls {
  position: absolute;
  left: 10px;
  right: 10px;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  border: 1px solid;
  border-radius: 6px;
  padding: 10px 14px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
}

/* Oben */
.top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 6px;
  margin-bottom: 6px;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.canteens {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  max-width: 370px;
  width: 100%;
  margin: 0 auto;
}
.canteen {
  position: relative;
  border: 1px solid;
  border-radius: 4px;
  padding: 2px 4px;
}
.canteen-info {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 5;
}
.race {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 8px;
}
.race-head {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  font-weight: 600;
  color: var(--c-textMid);
  white-space: nowrap;
}
.race-n {
  margin-left: auto;
  font-weight: 400;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textLow);
}
.race-bar {
  flex: 1 1 auto;
  display: flex;
  height: 14px;
  border-radius: 3px;
  overflow: hidden;
}
.race-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
  color: rgba(0, 0, 0, 0.75);
  transition: width 0.2s linear;
}
.panel {
  position: relative;
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 6px 4px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 2px;
}
.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9.5px;
  font-weight: 600;
  color: var(--c-textMid);
}
.xy-toggle {
  display: flex;
  gap: 3px;
}
.btn-sm {
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.xy-canvas {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 440 / 144;
}
/* Zoom: schwebt über der Simulation und füllt deren Fläche. */
.xy-panel.zoomed {
  position: absolute;
  inset: 6px;
  z-index: 50;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
}
.xy-panel.zoomed .xy-canvas {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  aspect-ratio: auto;
  object-fit: contain;
}
.zoom-btn {
  position: absolute;
  bottom: 5px;
  right: 5px;
  z-index: 2;
  border: 1px solid;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 1.35;
  cursor: pointer;
  opacity: 0.85;
}

.right {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.lat-body {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 8px;
  align-items: center;
}
.lat-verdicts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lat-row {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 6px;
  align-items: baseline;
}
.lat-label {
  font-size: 10px;
  color: var(--c-textMid);
}
.lat-win {
  font-size: 13px;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}
.lat-theo {
  font-size: 8.5px;
  color: var(--c-textLow);
  font-family: var(--slidev-code-font-family);
}
.lat-caption {
  margin-left: auto;
  margin-right: 4px;
  font-size: 8.5px;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textLow);
}
.lat-empty {
  font-size: 9.5px;
  color: var(--c-textLow);
}
.lat-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.lat-bar-row {
  display: grid;
  grid-template-columns: 26px 1fr;
  column-gap: 4px;
  align-items: center;
}
.lat-bar-name {
  font-size: 9.5px;
  font-weight: 700;
}
.lat-track {
  display: flex;
  height: 10px;
  border-radius: 2px;
  overflow: hidden;
}
.lat-seg {
  height: 100%;
  transition: width 0.2s linear;
}
.lat-seg-s {
  border: 1px solid;
  border-left: none;
}
.lat-bar-txt {
  grid-column: 2;
  font-size: 8.5px;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textMid);
  white-space: nowrap;
}
.lat-conflict {
  margin-top: 4px;
  border: 1px solid;
  border-left-width: 4px;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
}
.lat-agree {
  margin-top: 4px;
  font-size: 9.5px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}
</style>
