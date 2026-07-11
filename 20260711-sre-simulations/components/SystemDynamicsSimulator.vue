<script setup>
/**
 * SystemDynamicsSimulator.vue — Full interactive system dynamics simulator.
 * Ports the React JSX component to Vue 3 <script setup>.
 * Scaled to ~65% for 960x540 Slidev viewport.
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useDarkMode } from "@slidev/client";

/* ================================================================
   COLOR CONSTANTS
   ================================================================ */

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#0a0d12" : "#f8fafc",
    surface: d ? "#111621" : "#ffffff",
    surfaceAlt: d ? "#161c2a" : "#f1f5f9",
    border: d ? "#1e2536" : "#e2e8f0",
    text: d ? "#e2e8f0" : "#1e293b",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    blue: d ? "#3b82f6" : "#2563eb",
    blueDim: d ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.08)",
    green: d ? "#22c55e" : "#16a34a",
    greenDim: d ? "rgba(34,197,94,0.10)" : "rgba(22,163,74,0.08)",
    yellow: d ? "#eab308" : "#ca8a04",
    yellowDim: d ? "rgba(234,179,8,0.10)" : "rgba(202,138,4,0.08)",
    orange: d ? "#f97316" : "#ea580c",
    orangeDim: d ? "rgba(249,115,22,0.10)" : "rgba(234,88,12,0.08)",
    red: d ? "#ef4444" : "#dc2626",
    redDim: d ? "rgba(239,68,68,0.10)" : "rgba(220,38,38,0.08)",
    purple: d ? "#a855f7" : "#9333ea",
    purpleDim: d ? "rgba(168,85,247,0.10)" : "rgba(147,51,234,0.08)",
    cyan: d ? "#06b6d4" : "#0891b2",
    cyanDim: d ? "rgba(6,182,212,0.10)" : "rgba(8,145,178,0.08)",
  };
});

const STAGE_COLORS = computed(() => [
  C.value.blue,
  C.value.orange,
  C.value.purple,
  C.value.cyan,
  C.value.green,
]);

/* ================================================================
   SIMULATION ENGINE
   ================================================================ */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function simulatePipeline(inputSignal, stages, steps, dt) {
  const nStages = stages.length;
  const outputs = stages.map(() => new Float64Array(steps));
  const buffers = stages.map(() => new Float64Array(steps));
  const clipped = stages.map(() => new Float64Array(steps));
  const inputs = new Float64Array(steps);

  const buf = stages.map(() => 0);

  for (let t = 0; t < steps; t++) {
    const inVal = inputSignal(t * dt);
    inputs[t] = inVal;

    let flowIn = inVal;
    for (let s = 0; s < nStages; s++) {
      const st = stages[s];
      buf[s] += flowIn * dt;
      const drain = Math.min(buf[s], st.capacity * dt);
      buf[s] -= drain;
      const overflow = Math.max(0, buf[s] - st.bufferMax);
      buf[s] = Math.min(buf[s], st.bufferMax);
      clipped[s][t] = overflow / dt;
      const rawOut = drain / dt;
      const prevOut = t > 0 ? outputs[s][t - 1] : 0;
      outputs[s][t] = prevOut + (rawOut - prevOut) * st.damping;
      buffers[s][t] = buf[s];
      flowIn = outputs[s][t];
    }
  }
  return { inputs, outputs, buffers, clipped };
}

/* ================================================================
   INPUT SIGNAL GENERATORS
   ================================================================ */

function steadySignal(rate) {
  return (_t) => rate;
}

function diracSignal(peakTime, peakWidth, peakHeight, baseRate) {
  return (t) => {
    const d = Math.abs(t - peakTime);
    if (d < peakWidth / 2)
      return (
        baseRate +
        peakHeight * Math.exp(-0.5 * Math.pow(d / (peakWidth / 6), 2))
      );
    return baseRate;
  };
}

function stepSignal(stepTime, stepDuration, highRate, lowRate) {
  return (t) =>
    t >= stepTime && t < stepTime + stepDuration ? highRate : lowRate;
}

function oscillatingSignal(freq, amplitude, baseRate) {
  return (t) => baseRate + amplitude * Math.sin(2 * Math.PI * freq * t);
}

/* ================================================================
   SIMULATION PRESETS
   ================================================================ */

const SIMS = [
  {
    id: "springs",
    name: "Queues als Federn",
    icon: "\u{1F300}",
    subtitle: "Backpressure, Dämpfung und Clipping bei 100%",
    description:
      "Drei Services in Serie. Jeder hat begrenzte Kapazität und einen Puffer. Wenn ein Puffer voll ist, wird der Überschuss verworfen (Clipping = HTTP 503). Beobachte wie Backpressure sich verzögert durch die Kette ausbreitet und die Oszillation asymmetrisch gedämpft wird.",
    stages: [
      { name: "API Gateway", capacity: 100, bufferMax: 50, damping: 0.3 },
      { name: "Quote-Service", capacity: 80, bufferMax: 30, damping: 0.2 },
      { name: "Provider-Adapter", capacity: 60, bufferMax: 20, damping: 0.15 },
    ],
    inputType: "oscillating",
    inputParams: { freq: 0.08, amplitude: 50, baseRate: 70 },
    duration: 30,
    steps: 300,
    insight:
      "Die Oszillation wird an jedem Stage gedämpft und verzögert (Phasenverschiebung). Bei 100% Kapazität wird die Spitze abgeschnitten (Clipping). Die Ausgabe ist asymmetrisch: Peaks werden gekappt, Täler nicht — der effektive Durchsatz sinkt.",
  },
  {
    id: "dirac",
    name: "Dirac-Impuls",
    icon: "\u26A1",
    subtitle: "Ein Burst rauscht durch die Service-Kette",
    description:
      "Ein kurzer Last-Peak (z.B. Cache-Flush, Marketing-Push) trifft das System. Der Impuls breitet sich durch die Kette aus, wird an jeder Station verbreitert und gedämpft. Die Puffer füllen und leeren sich mit Verzögerung.",
    stages: [
      { name: "API Gateway", capacity: 100, bufferMax: 80, damping: 0.25 },
      { name: "Quote-Service", capacity: 80, bufferMax: 40, damping: 0.18 },
      { name: "Provider-Adapter", capacity: 60, bufferMax: 25, damping: 0.12 },
    ],
    inputType: "dirac",
    inputParams: { peakTime: 5, peakWidth: 2, peakHeight: 200, baseRate: 40 },
    duration: 25,
    steps: 250,
    insight:
      "Der scharfe Impuls wird an jedem Stage breiter und flacher (Tiefpassfilter-Effekt). Aber: die Puffer brauchen Zeit zum Leeren. Wenn die Kapazität eng ist (Provider-Adapter: 60 req/s), staut sich der Impuls und die Drain-Time verlängert sich — das System braucht länger zurück zum Normalzustand als der Impuls gedauert hat (Hysterese).",
  },
  {
    id: "step",
    name: "Überlast + Recovery",
    icon: "\u{1F4C8}",
    subtitle: "Last steigt, bleibt, sinkt — Hysterese sichtbar",
    description:
      "Last steigt für 10 Sekunden über die Kapazität, dann zurück auf Normal. Im Phasenraum-Diagramm (Throughput vs. Latenz-Proxy) wird die Hysterese-Schleife sichtbar: der Rückweg folgt einem anderen Pfad als der Hinweg.",
    stages: [
      { name: "API Gateway", capacity: 100, bufferMax: 60, damping: 0.2 },
      { name: "Quote-Service", capacity: 70, bufferMax: 35, damping: 0.15 },
      { name: "Provider-Adapter", capacity: 50, bufferMax: 20, damping: 0.1 },
    ],
    inputType: "step",
    inputParams: { stepTime: 5, stepDuration: 10, highRate: 120, lowRate: 30 },
    duration: 30,
    steps: 300,
    insight:
      "Nach dem Step-Down (Last sinkt) bleiben die Puffer gefüllt. Die Drain-Phase erzeugt eine Verzögerung. Im Phasenraum (Input vs. letzter Output) ist die Hysterese-Schleife klar sichtbar: Hinweg und Rückweg sind verschiedene Pfade.",
  },
  {
    id: "rolling",
    name: "Rolling Bottleneck",
    icon: "\u{1F30A}",
    subtitle: "Engpass wandert durch die Kette",
    description:
      "Gleichmäßige Last nahe der Kapazität. Kleine Schwankungen verursachen wandernde Engpässe: mal staut es am Gateway, mal am Provider-Adapter. Ohne Excess Capacity leeren sich die Puffer nicht rechtzeitig.",
    stages: [
      { name: "API Gateway", capacity: 80, bufferMax: 25, damping: 0.25 },
      { name: "Quote-Service", capacity: 75, bufferMax: 20, damping: 0.2 },
      { name: "Provider-Adapter", capacity: 70, bufferMax: 15, damping: 0.15 },
    ],
    inputType: "oscillating",
    inputParams: { freq: 0.15, amplitude: 15, baseRate: 72 },
    duration: 25,
    steps: 250,
    insight:
      "Bei 90%+ Auslastung wandert der Engpass. Puffer können sich nicht mehr rechtzeitig leeren bevor die nächste Schwankung kommt. Ergebnis: Starvation kaskadiert. Bei ~80% Auslastung (baseRate 60 statt 72) verschwinden die Probleme.",
  },
];

/* ================================================================
   REACTIVE STATE
   ================================================================ */

const simId = ref("springs");
const progress = ref(1);
const playing = ref(false);

let animFrame = null;
let startTime = null;

const sim = computed(() => SIMS.find((s) => s.id === simId.value));
const dt = computed(() => sim.value.duration / sim.value.steps);

const inputFn = computed(() => {
  const p = sim.value.inputParams;
  if (sim.value.inputType === "dirac")
    return diracSignal(p.peakTime, p.peakWidth, p.peakHeight, p.baseRate);
  if (sim.value.inputType === "step")
    return stepSignal(p.stepTime, p.stepDuration, p.highRate, p.lowRate);
  if (sim.value.inputType === "oscillating")
    return oscillatingSignal(p.freq, p.amplitude, p.baseRate);
  return steadySignal(p.baseRate || 50);
});

const result = computed(() =>
  simulatePipeline(inputFn.value, sim.value.stages, sim.value.steps, dt.value),
);

const visSteps = computed(() =>
  Math.max(2, Math.floor(progress.value * sim.value.steps)),
);

function sliceArr(arr) {
  return arr.slice(0, visSteps.value);
}

/* ================================================================
   ANIMATION
   ================================================================ */

function animate(ts) {
  if (startTime === null) startTime = ts;
  const p = Math.min((ts - startTime) / 8000, 1);
  progress.value = p;
  if (p < 1) {
    animFrame = requestAnimationFrame(animate);
  } else {
    playing.value = false;
  }
}

function handlePlay() {
  progress.value = 0;
  startTime = null;
  playing.value = true;
  animFrame = requestAnimationFrame(animate);
}

function handleStop() {
  playing.value = false;
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
}

function selectSim(id) {
  handleStop();
  simId.value = id;
  progress.value = 1;
}

function onSlider(e) {
  handleStop();
  progress.value = parseFloat(e.target.value);
}

watch(playing, (val) => {
  if (!val && animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
});

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame);
});

/* ================================================================
   MINI CHART HELPERS
   ================================================================ */

function miniChartPath(series, toXFn, toYFn) {
  const path = [];
  for (let i = 0; i < series.length; i++) {
    path.push(
      `${i === 0 ? "M" : "L"}${toXFn(i).toFixed(1)},${toYFn(series[i]).toFixed(1)}`,
    );
  }
  return path.join(" ");
}

function computeMaxVal(seriesArr, capValue, showCapLine) {
  let maxVal = 0;
  for (const s of seriesArr) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] > maxVal) maxVal = s[i];
    }
  }
  if (showCapLine && capValue > maxVal) maxVal = capValue;
  return maxVal * 1.1 || 1;
}

/* ================================================================
   PHASE SPACE HELPERS
   ================================================================ */

const psW = 200;
const psH = 160;
const psPad = { t: 10, r: 10, b: 26, l: 32 };
const psCw = psW - psPad.l - psPad.r;
const psCh = psH - psPad.t - psPad.b;

function phaseSpacePath(xData, yData, xMax, yMax, drawn) {
  const toX = (v) => psPad.l + (v / xMax) * psCw;
  const toY = (v) => psPad.t + psCh - (v / yMax) * psCh;
  const pts = [];
  for (let i = 0; i < drawn; i++) {
    pts.push(
      `${i === 0 ? "M" : "L"}${toX(xData[i]).toFixed(1)},${toY(yData[i]).toFixed(1)}`,
    );
  }
  return pts.join(" ");
}
</script>

<template>
  <div
    class="sim-root"
    :style="{
      '--c-bg': C.bg,
      '--c-surface': C.surface,
      '--c-surfaceAlt': C.surfaceAlt,
      '--c-border': C.border,
      '--c-text': C.text,
      '--c-muted': C.muted,
      '--c-dim': C.dim,
      '--c-blue': C.blue,
      '--c-green': C.green,
      '--c-yellow': C.yellow,
      '--c-orange': C.orange,
      '--c-red': C.red,
    }"
  >
    <!-- Header -->
    <div class="header">
      <div class="header-tag">
        <div class="tag-dot" />
        <span class="tag-text">Systemdynamik-Simulator</span>
      </div>
      <h1 class="title">Warteschlangen, Oszillation, Hysterese</h1>
    </div>

    <!-- Einzelansicht „Simulation“ — der frühere Tab „M/M/1 & Regeln“ ist nach
         MM1Rules.vue ausgelagert und lebt jetzt auf der M/M/1-Folie. -->
    <!-- Scenario selector -->
    <div class="scenario-grid">
      <button
        v-for="s in SIMS"
        :key="s.id"
        class="scenario-btn"
        :class="{ active: simId === s.id }"
        @click="selectSim(s.id)"
      >
        <div class="scenario-name">
          {{ s.icon }}
          <span :style="{ color: simId === s.id ? C.orange : C.text }">{{
            s.name
          }}</span>
        </div>
        <div class="scenario-sub">{{ s.subtitle }}</div>
      </button>
    </div>

    <!-- Simulation area -->
    <div class="sim-panel">
      <div class="sim-desc">{{ sim.description }}</div>

      <!-- Controls -->
      <div class="controls">
        <button class="play-btn" @click="playing ? handleStop() : handlePlay()">
          {{ playing ? "⏸" : "▶" }}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.005"
          :value="progress"
          class="slider"
          @input="onSlider"
        />
        <span class="time-label"
          >{{ (progress * sim.duration).toFixed(1) }}s</span
        >
      </div>

      <!-- Pipeline visualization -->
      <div class="pipeline">
        <div class="pipe-node input-node">Input</div>
        <template v-for="(st, i) in sim.stages" :key="i">
          <span class="arrow">&rarr;</span>
          <div
            class="pipe-node"
            :style="{
              background: STAGE_COLORS[i] + '10',
              borderColor: STAGE_COLORS[i] + '25',
              color: STAGE_COLORS[i],
            }"
          >
            {{ st.name }}
            <span style="opacity: 0.6"
              >({{ st.capacity }}req/s, buf:{{ st.bufferMax }})</span
            >
          </div>
        </template>
      </div>

      <!-- Charts 2x2 grid: Throughput, Buffer, Drops -->
      <div class="charts-grid">
        <!-- Throughput chart (1,1) -->
        <svg viewBox="0 0 480 58" class="chart-svg">
          <line
            v-for="f in [0.25, 0.5, 0.75]"
            :key="'tg' + f"
            :x1="42"
            :y1="10 + 30 - f * 30"
            :x2="470"
            :y2="10 + 30 - f * 30"
            :stroke="C.border"
            stroke-width="0.5"
          />
          <line
            x1="42"
            :y1="40"
            x2="470"
            :y2="40"
            :stroke="C.dim"
            stroke-width="1"
          />
          <line
            x1="42"
            y1="10"
            x2="42"
            :y2="40"
            :stroke="C.dim"
            stroke-width="1"
          />
          <text
            x="46"
            y="6"
            style="font-size: 10px"
            :fill="C.muted"
            font-weight="600"
          >
            Throughput (req/s)
          </text>
          <text
            x="42"
            y="50"
            style="font-size: 7px"
            :fill="C.dim"
            class="mono-label"
          >
            0s
          </text>
          <text
            x="470"
            y="50"
            text-anchor="end"
            style="font-size: 7px"
            :fill="C.dim"
            class="mono-label"
          >
            {{ (sim.steps * dt).toFixed(0) }}s
          </text>
          <path
            :d="
              (() => {
                const fullSeries = [
                  result.inputs,
                  ...sim.stages.map((_, i) => result.outputs[i]),
                ];
                const maxVal = computeMaxVal(fullSeries, 0, false);
                const series = sliceArr(result.inputs);
                const xSteps = sim.steps;
                const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428;
                const toY = (v) => 10 + 30 - (v / maxVal) * 30;
                return miniChartPath(series, toX, toY);
              })()
            "
            fill="none"
            :stroke="C.green"
            stroke-width="1.2"
            stroke-linecap="round"
            opacity="0.85"
          />
          <path
            v-for="(st, si) in sim.stages"
            :key="'tp' + si"
            :d="
              (() => {
                const fullSeries = [
                  result.inputs,
                  ...sim.stages.map((_, i) => result.outputs[i]),
                ];
                const maxVal = computeMaxVal(fullSeries, 0, false);
                const series = sliceArr(result.outputs[si]);
                const xSteps = sim.steps;
                const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428;
                const toY = (v) => 10 + 30 - (v / maxVal) * 30;
                return miniChartPath(series, toX, toY);
              })()
            "
            fill="none"
            :stroke="STAGE_COLORS[si]"
            stroke-width="1.2"
            stroke-linecap="round"
            opacity="0.85"
          />
          <line
            x1="50"
            y1="55"
            x2="60"
            y2="55"
            :stroke="C.green"
            stroke-width="1.5"
          />
          <text
            x="62"
            y="57"
            style="font-size: 6px"
            :fill="C.green"
            class="mono-label"
          >
            Input
          </text>
          <g v-for="(st, i) in sim.stages" :key="'tl' + i">
            <line
              :x1="50 + (i + 1) * 90"
              y1="55"
              :x2="60 + (i + 1) * 90"
              y2="55"
              :stroke="STAGE_COLORS[i]"
              stroke-width="1.5"
            />
            <text
              :x="62 + (i + 1) * 90"
              y="57"
              style="font-size: 6px"
              :fill="STAGE_COLORS[i]"
              class="mono-label"
            >
              {{ st.name }}
            </text>
          </g>
        </svg>

        <!-- Buffer chart (1,2) -->
        <svg viewBox="0 0 480 58" class="chart-svg">
          <line
            v-for="f in [0.25, 0.5, 0.75]"
            :key="'bg' + f"
            :x1="42"
            :y1="10 + 30 - f * 30"
            :x2="470"
            :y2="10 + 30 - f * 30"
            :stroke="C.border"
            stroke-width="0.5"
          />
          <line
            x1="42"
            :y1="40"
            x2="470"
            :y2="40"
            :stroke="C.dim"
            stroke-width="1"
          />
          <line
            x1="42"
            y1="10"
            x2="42"
            :y2="40"
            :stroke="C.dim"
            stroke-width="1"
          />
          <text
            x="46"
            y="6"
            style="font-size: 10px"
            :fill="C.muted"
            font-weight="600"
          >
            Buffer-Füllstand
          </text>
          <text
            x="42"
            y="50"
            style="font-size: 7px"
            :fill="C.dim"
            class="mono-label"
          >
            0s
          </text>
          <text
            x="470"
            y="50"
            text-anchor="end"
            style="font-size: 7px"
            :fill="C.dim"
            class="mono-label"
          >
            {{ (sim.steps * dt).toFixed(0) }}s
          </text>
          <path
            v-for="(st, si) in sim.stages"
            :key="'bp' + si"
            :d="
              (() => {
                const fullSeries = sim.stages.map((_, i) => result.buffers[i]);
                const maxVal = computeMaxVal(fullSeries, 0, false);
                const series = sliceArr(result.buffers[si]);
                const xSteps = sim.steps;
                const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428;
                const toY = (v) => 10 + 30 - (v / maxVal) * 30;
                return miniChartPath(series, toX, toY);
              })()
            "
            fill="none"
            :stroke="STAGE_COLORS[si]"
            stroke-width="1.2"
            stroke-linecap="round"
            opacity="0.85"
          />
          <g v-for="(st, i) in sim.stages" :key="'bl' + i">
            <line
              :x1="50 + i * 90"
              y1="55"
              :x2="60 + i * 90"
              y2="55"
              :stroke="STAGE_COLORS[i]"
              stroke-width="1.5"
            />
            <text
              :x="62 + i * 90"
              y="57"
              style="font-size: 6px"
              :fill="STAGE_COLORS[i]"
              class="mono-label"
            >
              {{ st.name }}
            </text>
          </g>
        </svg>

        <!-- Drops chart (2,1) -->
        <svg viewBox="0 0 480 58" class="chart-svg">
          <line
            v-for="f in [0.25, 0.5, 0.75]"
            :key="'cg' + f"
            :x1="42"
            :y1="10 + 30 - f * 30"
            :x2="470"
            :y2="10 + 30 - f * 30"
            :stroke="C.border"
            stroke-width="0.5"
          />
          <line
            x1="42"
            :y1="40"
            x2="470"
            :y2="40"
            :stroke="C.dim"
            stroke-width="1"
          />
          <line
            x1="42"
            y1="10"
            x2="42"
            :y2="40"
            :stroke="C.dim"
            stroke-width="1"
          />
          <text
            x="46"
            y="6"
            style="font-size: 10px"
            :fill="C.muted"
            font-weight="600"
          >
            Drops (req/s)
          </text>
          <text
            x="42"
            y="50"
            style="font-size: 7px"
            :fill="C.dim"
            class="mono-label"
          >
            0s
          </text>
          <text
            x="470"
            y="50"
            text-anchor="end"
            style="font-size: 7px"
            :fill="C.dim"
            class="mono-label"
          >
            {{ (sim.steps * dt).toFixed(0) }}s
          </text>
          <path
            v-for="(st, si) in sim.stages"
            :key="'cp' + si"
            :d="
              (() => {
                const fullSeries = sim.stages.map((_, i) => result.clipped[i]);
                const maxVal = computeMaxVal(fullSeries, 0, false);
                const series = sliceArr(result.clipped[si]);
                const xSteps = sim.steps;
                const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428;
                const toY = (v) => 10 + 30 - (v / maxVal) * 30;
                return miniChartPath(series, toX, toY);
              })()
            "
            fill="none"
            :stroke="STAGE_COLORS[si]"
            stroke-width="1.2"
            stroke-linecap="round"
            opacity="0.85"
          />
          <g v-for="(st, i) in sim.stages" :key="'cl' + i">
            <line
              :x1="50 + i * 90"
              y1="55"
              :x2="60 + i * 90"
              y2="55"
              :stroke="STAGE_COLORS[i]"
              stroke-width="1.5"
            />
            <text
              :x="62 + i * 90"
              y="57"
              style="font-size: 6px"
              :fill="STAGE_COLORS[i]"
              class="mono-label"
            >
              {{ st.name }}
            </text>
          </g>
        </svg>
      </div>

      <!-- Bottom: phase space (conditional) + insight side by side -->
      <div class="sim-bottom-row">
        <!-- Phase space for step scenario -->
        <div v-if="sim.id === 'step'" class="phase-space-panel">
          <div class="phase-title">PHASENRAUM</div>
          <svg :viewBox="`0 0 ${psW} ${psH}`" class="phase-svg">
            <g v-for="f in [0.25, 0.5, 0.75]" :key="'pg' + f">
              <line
                :x1="psPad.l"
                :y1="psPad.t + psCh - f * psCh"
                :x2="psPad.l + psCw"
                :y2="psPad.t + psCh - f * psCh"
                :stroke="C.border"
                stroke-width="0.5"
              />
              <line
                :x1="psPad.l + f * psCw"
                :y1="psPad.t"
                :x2="psPad.l + f * psCw"
                :y2="psPad.t + psCh"
                :stroke="C.border"
                stroke-width="0.5"
              />
            </g>
            <line
              :x1="psPad.l"
              :y1="psPad.t + psCh"
              :x2="psPad.l + psCw"
              :y2="psPad.t + psCh"
              :stroke="C.dim"
              stroke-width="1"
            />
            <line
              :x1="psPad.l"
              :y1="psPad.t"
              :x2="psPad.l"
              :y2="psPad.t + psCh"
              :stroke="C.dim"
              stroke-width="1"
            />
            <text
              :x="psPad.l + psCw / 2"
              :y="psH - 2"
              text-anchor="middle"
              style="font-size: 9px"
              :fill="C.muted"
            >
              Input
            </text>
            <text
              x="6"
              :y="psPad.t + psCh / 2"
              text-anchor="middle"
              style="font-size: 9px"
              :fill="C.muted"
              :transform="`rotate(-90, 6, ${psPad.t + psCh / 2})`"
            >
              Output
            </text>
            <path
              v-if="
                (() => {
                  const d = Math.floor(progress * sim.steps);
                  return d > 1;
                })()
              "
              :d="
                (() => {
                  const xData = result.inputs;
                  const yData = result.outputs[sim.stages.length - 1];
                  const N = sim.steps;
                  let xMax = 0,
                    yMax = 0;
                  for (let i = 0; i < N; i++) {
                    if (xData[i] > xMax) xMax = xData[i];
                    if (yData[i] > yMax) yMax = yData[i];
                  }
                  xMax = xMax * 1.1 || 1;
                  yMax = yMax * 1.1 || 1;
                  const drawn = Math.floor(progress * N);
                  return phaseSpacePath(xData, yData, xMax, yMax, drawn);
                })()
              "
              fill="none"
              :stroke="C.yellow"
              stroke-width="1.2"
              opacity="0.7"
              stroke-linecap="round"
            />
            <circle
              v-if="Math.floor(progress * sim.steps) > 0"
              :cx="
                (() => {
                  const xData = result.inputs;
                  const N = sim.steps;
                  let xMax = 0;
                  for (let i = 0; i < N; i++)
                    if (xData[i] > xMax) xMax = xData[i];
                  xMax = xMax * 1.1 || 1;
                  return psPad.l + (xData[0] / xMax) * psCw;
                })()
              "
              :cy="
                (() => {
                  const yData = result.outputs[sim.stages.length - 1];
                  const N = sim.steps;
                  let yMax = 0;
                  for (let i = 0; i < N; i++)
                    if (yData[i] > yMax) yMax = yData[i];
                  yMax = yMax * 1.1 || 1;
                  return psPad.t + psCh - (yData[0] / yMax) * psCh;
                })()
              "
              r="2"
              :fill="C.green"
              :stroke="C.bg"
              stroke-width="0.5"
            />
            <circle
              v-if="Math.floor(progress * sim.steps) > 0"
              :cx="
                (() => {
                  const xData = result.inputs;
                  const N = sim.steps;
                  let xMax = 0;
                  for (let i = 0; i < N; i++)
                    if (xData[i] > xMax) xMax = xData[i];
                  xMax = xMax * 1.1 || 1;
                  const cur = Math.max(0, Math.floor(progress * N) - 1);
                  return psPad.l + (xData[cur] / xMax) * psCw;
                })()
              "
              :cy="
                (() => {
                  const yData = result.outputs[sim.stages.length - 1];
                  const N = sim.steps;
                  let yMax = 0;
                  for (let i = 0; i < N; i++)
                    if (yData[i] > yMax) yMax = yData[i];
                  yMax = yMax * 1.1 || 1;
                  const cur = Math.max(0, Math.floor(progress * N) - 1);
                  return psPad.t + psCh - (yData[cur] / yMax) * psCh;
                })()
              "
              r="3"
              :fill="C.yellow"
              :stroke="C.text"
              stroke-width="1"
            />
          </svg>
        </div>

        <!-- Insight -->
        <div class="insight-box">
          <div class="insight-label">BEOBACHTUNG</div>
          <div class="insight-text">{{ sim.insight }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* All sizes scaled ~65% for 960x540 Slidev viewport */

/* SVG-Achsen-Labels in der Deck-Code-Schrift (ersetzt das frühere JetBrains
 * Mono aus dem Google-Fonts-Laufzeit-Import). */
.mono-label {
  font-family: var(--slidev-code-font-family);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.sim-root {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: inherit;
  padding: 10px 12px 16px;
  max-width: 960px;
  margin: 0 auto;
  overflow-y: auto;
  max-height: 540px;
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
  margin-bottom: 8px;
}
.header-tag {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 2px;
}
.tag-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-orange);
  box-shadow: 0 0 6px var(--c-orange);
}
.tag-text {
  font-size: 7px;
  font-weight: 700;
  color: var(--c-orange);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-family: var(--slidev-code-font-family);
}
.title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
  margin-bottom: 2px;
}
.subtitle-text {
  font-size: 8px;
  color: var(--c-muted);
  line-height: 1.4;
  max-width: 500px;
}

/* Scenario selector */
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}
.scenario-btn {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 5px 7px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  outline: none;
  color: var(--c-text);
}
.scenario-btn.active {
  background: rgba(249, 115, 22, 0.06);
  border-color: var(--c-orange);
}
.scenario-name {
  font-size: 10px;
  margin-bottom: 1px;
}
.scenario-name span {
  font-size: 8px;
  font-weight: 700;
}
.scenario-sub {
  font-size: 6px;
  color: var(--c-muted);
}

/* Simulation panel */
.sim-panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 4px;
  animation: fadeIn 0.3s ease;
}
.sim-desc {
  font-size: 7px;
  color: var(--c-muted);
  line-height: 1.3;
  margin-bottom: 4px;
}

/* Controls */
.controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.play-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--c-orange);
  background: rgba(249, 115, 22, 0.08);
  color: var(--c-orange);
  font-size: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}
.slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  background: var(--c-border);
  height: 3px;
  border-radius: 2px;
  outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-blue);
  cursor: pointer;
  border: 1.5px solid var(--c-bg);
}
.time-label {
  font-size: 7px;
  color: var(--c-muted);
  font-family: var(--slidev-code-font-family);
  min-width: 28px;
}

/* Pipeline */
.pipeline {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 3px;
  flex-wrap: wrap;
}
.pipe-node {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 6px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.input-node {
  background: rgba(34, 197, 94, 0.07);
  border-color: rgba(34, 197, 94, 0.15);
  color: var(--c-green);
}
.arrow {
  color: var(--c-dim);
  font-size: 6px;
}

/* Charts 2x2 grid */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.chart-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

/* Bottom row: phase space + insight */
.sim-bottom-row {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  align-items: stretch;
}

/* Phase space */
.phase-space-panel {
  flex: 0 0 180px;
  padding: 5px;
  background: var(--c-surfaceAlt);
  border-radius: 4px;
  border: 1px solid var(--c-border);
}
.phase-title {
  font-size: 6px;
  font-weight: 700;
  color: var(--c-yellow);
  margin-bottom: 2px;
  font-family: var(--slidev-code-font-family);
}
.phase-svg {
  width: 100%;
  height: auto;
}

/* Insight */
.insight-box {
  flex: 1;
  padding: 5px 7px;
  background: rgba(249, 115, 22, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(249, 115, 22, 0.08);
}
.insight-label {
  font-size: 6px;
  font-weight: 700;
  color: var(--c-orange);
  margin-bottom: 2px;
  font-family: var(--slidev-code-font-family);
}
.insight-text {
  font-size: 7px;
  color: var(--c-text);
  line-height: 1.4;
}
</style>
