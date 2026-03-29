<script setup>
/**
 * SystemDynamicsSimulator.vue — Full interactive system dynamics simulator.
 * Ports the React JSX component to Vue 3 <script setup>.
 * Scaled to ~65% for 960x540 Slidev viewport.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

/* ================================================================
   COLOR CONSTANTS
   ================================================================ */

const C = {
  bg: '#0a0d12', surface: '#111621', surfaceAlt: '#161c2a',
  border: '#1e2536', text: '#e2e8f0', muted: '#64748b', dim: '#3e4a63',
  blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.10)',
  yellow: '#eab308', yellowDim: 'rgba(234,179,8,0.10)',
  orange: '#f97316', orangeDim: 'rgba(249,115,22,0.10)',
  red: '#ef4444', redDim: 'rgba(239,68,68,0.10)',
  purple: '#a855f7', purpleDim: 'rgba(168,85,247,0.10)',
  cyan: '#06b6d4', cyanDim: 'rgba(6,182,212,0.10)',
}

const STAGE_COLORS = [C.blue, C.orange, C.purple, C.cyan, C.green]

/* ================================================================
   SIMULATION ENGINE
   ================================================================ */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function simulatePipeline(inputSignal, stages, steps, dt) {
  const nStages = stages.length
  const outputs = stages.map(() => new Float64Array(steps))
  const buffers = stages.map(() => new Float64Array(steps))
  const clipped = stages.map(() => new Float64Array(steps))
  const inputs = new Float64Array(steps)

  const buf = stages.map(() => 0)

  for (let t = 0; t < steps; t++) {
    const inVal = inputSignal(t * dt)
    inputs[t] = inVal

    let flowIn = inVal
    for (let s = 0; s < nStages; s++) {
      const st = stages[s]
      buf[s] += flowIn * dt
      const drain = Math.min(buf[s], st.capacity * dt)
      buf[s] -= drain
      const overflow = Math.max(0, buf[s] - st.bufferMax)
      buf[s] = Math.min(buf[s], st.bufferMax)
      clipped[s][t] = overflow / dt
      const rawOut = drain / dt
      const prevOut = t > 0 ? outputs[s][t - 1] : 0
      outputs[s][t] = prevOut + (rawOut - prevOut) * st.damping
      buffers[s][t] = buf[s]
      flowIn = outputs[s][t]
    }
  }
  return { inputs, outputs, buffers, clipped }
}

/* ================================================================
   INPUT SIGNAL GENERATORS
   ================================================================ */

function steadySignal(rate) {
  return (_t) => rate
}

function diracSignal(peakTime, peakWidth, peakHeight, baseRate) {
  return (t) => {
    const d = Math.abs(t - peakTime)
    if (d < peakWidth / 2) return baseRate + peakHeight * Math.exp(-0.5 * Math.pow(d / (peakWidth / 6), 2))
    return baseRate
  }
}

function stepSignal(stepTime, stepDuration, highRate, lowRate) {
  return (t) => (t >= stepTime && t < stepTime + stepDuration) ? highRate : lowRate
}

function oscillatingSignal(freq, amplitude, baseRate) {
  return (t) => baseRate + amplitude * Math.sin(2 * Math.PI * freq * t)
}

/* ================================================================
   SIMULATION PRESETS
   ================================================================ */

const SIMS = [
  {
    id: 'springs',
    name: 'Queues als Federn',
    icon: '\u{1F300}',
    subtitle: 'Backpressure, Dämpfung und Clipping bei 100%',
    description: 'Drei Services in Serie. Jeder hat begrenzte Kapazität und einen Puffer. Wenn ein Puffer voll ist, wird der Überschuss verworfen (Clipping = HTTP 503). Beobachte wie Backpressure sich verzögert durch die Kette ausbreitet und die Oszillation asymmetrisch gedämpft wird.',
    stages: [
      { name: 'API Gateway', capacity: 100, bufferMax: 50, damping: 0.3 },
      { name: 'Quote-Service', capacity: 80, bufferMax: 30, damping: 0.2 },
      { name: 'Provider-Adapter', capacity: 60, bufferMax: 20, damping: 0.15 },
    ],
    inputType: 'oscillating',
    inputParams: { freq: 0.08, amplitude: 50, baseRate: 70 },
    duration: 30,
    steps: 300,
    insight: 'Die Oszillation wird an jedem Stage gedämpft und verzögert (Phasenverschiebung). Bei 100% Kapazität wird die Spitze abgeschnitten (Clipping). Die Ausgabe ist asymmetrisch: Peaks werden gekappt, Täler nicht — der effektive Durchsatz sinkt.',
  },
  {
    id: 'dirac',
    name: 'Dirac-Impuls',
    icon: '\u26A1',
    subtitle: 'Ein Burst rauscht durch die Service-Kette',
    description: 'Ein kurzer Last-Peak (z.B. Cache-Flush, Marketing-Push) trifft das System. Der Impuls breitet sich durch die Kette aus, wird an jeder Station verbreitert und gedämpft. Die Puffer füllen und leeren sich mit Verzögerung.',
    stages: [
      { name: 'API Gateway', capacity: 100, bufferMax: 80, damping: 0.25 },
      { name: 'Quote-Service', capacity: 80, bufferMax: 40, damping: 0.18 },
      { name: 'Provider-Adapter', capacity: 60, bufferMax: 25, damping: 0.12 },
    ],
    inputType: 'dirac',
    inputParams: { peakTime: 5, peakWidth: 2, peakHeight: 200, baseRate: 40 },
    duration: 25,
    steps: 250,
    insight: 'Der scharfe Impuls wird an jedem Stage breiter und flacher (Tiefpassfilter-Effekt). Aber: die Puffer brauchen Zeit zum Leeren. Wenn die Kapazität eng ist (Provider-Adapter: 60 req/s), staut sich der Impuls und die Drain-Time verlängert sich — das System braucht länger zurück zum Normalzustand als der Impuls gedauert hat (Hysterese).',
  },
  {
    id: 'step',
    name: 'Überlast + Recovery',
    icon: '\u{1F4C8}',
    subtitle: 'Last steigt, bleibt, sinkt — Hysterese sichtbar',
    description: 'Last steigt für 10 Sekunden über die Kapazität, dann zurück auf Normal. Im Phasenraum-Diagramm (Throughput vs. Latenz-Proxy) wird die Hysterese-Schleife sichtbar: der Rückweg folgt einem anderen Pfad als der Hinweg.',
    stages: [
      { name: 'API Gateway', capacity: 100, bufferMax: 60, damping: 0.2 },
      { name: 'Quote-Service', capacity: 70, bufferMax: 35, damping: 0.15 },
      { name: 'Provider-Adapter', capacity: 50, bufferMax: 20, damping: 0.1 },
    ],
    inputType: 'step',
    inputParams: { stepTime: 5, stepDuration: 10, highRate: 120, lowRate: 30 },
    duration: 30,
    steps: 300,
    insight: 'Nach dem Step-Down (Last sinkt) bleiben die Puffer gefüllt. Die Drain-Phase erzeugt eine Verzögerung. Im Phasenraum (Input vs. letzter Output) ist die Hysterese-Schleife klar sichtbar: Hinweg und Rückweg sind verschiedene Pfade.',
  },
  {
    id: 'rolling',
    name: 'Rolling Bottleneck',
    icon: '\u{1F30A}',
    subtitle: 'Engpass wandert durch die Kette',
    description: 'Gleichmäßige Last nahe der Kapazität. Kleine Schwankungen verursachen wandernde Engpässe: mal staut es am Gateway, mal am Provider-Adapter. Ohne Excess Capacity leeren sich die Puffer nicht rechtzeitig.',
    stages: [
      { name: 'API Gateway', capacity: 80, bufferMax: 25, damping: 0.25 },
      { name: 'Quote-Service', capacity: 75, bufferMax: 20, damping: 0.2 },
      { name: 'Provider-Adapter', capacity: 70, bufferMax: 15, damping: 0.15 },
    ],
    inputType: 'oscillating',
    inputParams: { freq: 0.15, amplitude: 15, baseRate: 72 },
    duration: 25,
    steps: 250,
    insight: 'Bei 90%+ Auslastung wandert der Engpass. Puffer können sich nicht mehr rechtzeitig leeren bevor die nächste Schwankung kommt. Ergebnis: Starvation kaskadiert. Bei ~80% Auslastung (baseRate 60 statt 72) verschwinden die Probleme.',
  },
]

/* ================================================================
   REACTIVE STATE
   ================================================================ */

const activeTab = ref('sim')
const simId = ref('springs')
const progress = ref(1)
const playing = ref(false)
const hovU = ref(null)

let animFrame = null
let startTime = null

const sim = computed(() => SIMS.find(s => s.id === simId.value))
const dt = computed(() => sim.value.duration / sim.value.steps)

const inputFn = computed(() => {
  const p = sim.value.inputParams
  if (sim.value.inputType === 'dirac') return diracSignal(p.peakTime, p.peakWidth, p.peakHeight, p.baseRate)
  if (sim.value.inputType === 'step') return stepSignal(p.stepTime, p.stepDuration, p.highRate, p.lowRate)
  if (sim.value.inputType === 'oscillating') return oscillatingSignal(p.freq, p.amplitude, p.baseRate)
  return steadySignal(p.baseRate || 50)
})

const result = computed(() =>
  simulatePipeline(inputFn.value, sim.value.stages, sim.value.steps, dt.value)
)

const visSteps = computed(() => Math.max(2, Math.floor(progress.value * sim.value.steps)))

function sliceArr(arr) {
  return arr.slice(0, visSteps.value)
}

/* ================================================================
   ANIMATION
   ================================================================ */

function animate(ts) {
  if (startTime === null) startTime = ts
  const p = Math.min((ts - startTime) / 8000, 1)
  progress.value = p
  if (p < 1) {
    animFrame = requestAnimationFrame(animate)
  } else {
    playing.value = false
  }
}

function handlePlay() {
  progress.value = 0
  startTime = null
  playing.value = true
  animFrame = requestAnimationFrame(animate)
}

function handleStop() {
  playing.value = false
  if (animFrame) {
    cancelAnimationFrame(animFrame)
    animFrame = null
  }
}

function selectSim(id) {
  handleStop()
  simId.value = id
  progress.value = 1
}

function onSlider(e) {
  handleStop()
  progress.value = parseFloat(e.target.value)
}

watch(playing, (val) => {
  if (!val && animFrame) {
    cancelAnimationFrame(animFrame)
    animFrame = null
  }
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})

/* ================================================================
   MINI CHART HELPERS
   ================================================================ */

function miniChartPath(series, toXFn, toYFn) {
  const path = []
  for (let i = 0; i < series.length; i++) {
    path.push(`${i === 0 ? 'M' : 'L'}${toXFn(i).toFixed(1)},${toYFn(series[i]).toFixed(1)}`)
  }
  return path.join(' ')
}

function computeMaxVal(seriesArr, capValue, showCapLine) {
  let maxVal = 0
  for (const s of seriesArr) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] > maxVal) maxVal = s[i]
    }
  }
  if (showCapLine && capValue > maxVal) maxVal = capValue
  return (maxVal * 1.1) || 1
}

/* ================================================================
   M/M/1 CHART HELPERS
   ================================================================ */

const mm1W = 380
const mm1H = 180
const mm1Pad = { t: 16, r: 16, b: 34, l: 42 }
const mm1Cw = mm1W - mm1Pad.l - mm1Pad.r
const mm1Ch = mm1H - mm1Pad.t - mm1Pad.b
const mm1MaxY = 12

const mm1Pts = computed(() => {
  const a = []
  for (let i = 0; i <= 150; i++) {
    const u = (i / 150) * 0.98
    a.push({ u, f: Math.min(1 / (1 - u), mm1MaxY) })
  }
  return a
})

function mm1ToX(u) { return mm1Pad.l + (u * mm1Cw) / 0.98 }
function mm1ToY(f) { return mm1Pad.t + mm1Ch - (f / mm1MaxY) * mm1Ch }

const mm1PathD = computed(() =>
  mm1Pts.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${mm1ToX(p.u).toFixed(1)},${mm1ToY(p.f).toFixed(1)}`).join(' ')
)

const mm1HoverF = computed(() =>
  hovU.value !== null ? Math.min(1 / (1 - hovU.value), mm1MaxY) : null
)

function mm1MouseMove(e) {
  const r = e.currentTarget.getBoundingClientRect()
  hovU.value = clamp(((e.clientX - r.left) / r.width) * 0.98, 0, 0.98)
}

function mm1MouseLeave() {
  hovU.value = null
}

/* ================================================================
   PHASE SPACE HELPERS
   ================================================================ */

const psW = 200
const psH = 160
const psPad = { t: 10, r: 10, b: 26, l: 32 }
const psCw = psW - psPad.l - psPad.r
const psCh = psH - psPad.t - psPad.b

function phaseSpacePath(xData, yData, xMax, yMax, drawn) {
  const toX = (v) => psPad.l + (v / xMax) * psCw
  const toY = (v) => psPad.t + psCh - (v / yMax) * psCh
  const pts = []
  for (let i = 0; i < drawn; i++) {
    pts.push(`${i === 0 ? 'M' : 'L'}${toX(xData[i]).toFixed(1)},${toY(yData[i]).toFixed(1)}`)
  }
  return pts.join(' ')
}

/* ================================================================
   KEY TAKEAWAYS & CAVEATS DATA
   ================================================================ */

const caveats = [
  { t: 'Bursty Traffic', d: 'Verschiebt den Knick nach links. Versicherungs-Peaks (November) sind bursty.', c: C.orange },
  { t: 'Parallelisierung (M/M/c)', d: '200 Tomcat-Threads verschieben den Knick nach rechts (~90-95%), aber der Absturz ist steiler.', c: C.blue },
  { t: 'CFS-Throttling', d: 'Binär, nicht graduell. 80% CPU kann plötzlich 40% Throttling bedeuten bei Bursts.', c: C.red },
  { t: 'Trotzdem: 80% ist gut', d: 'Genug Headroom für Schwankungen. Lieber bei 80% warnen als bei 95% überrascht werden.', c: C.green },
]

const takeaways = [
  { title: 'Excess Capacity ist Pflicht', desc: 'Systeme brauchen Headroom (~20%) um Puffer nach Schwankungen wieder aufzufüllen. Ohne Headroom kaskadieren Rolling Bottlenecks.', icon: '\u{1F3CB}\uFE0F', color: C.green },
  { title: 'Gleichmäßiger Flow statt Batches', desc: 'Große Batches = Dirac-Impuls = maximale Oszillation. TTL+Jitter, Leaky Bucket, Staggered Rollout vermeiden Resonanz.', icon: '\u{1F30A}', color: C.yellow },
  { title: 'Hysterese einplanen', desc: 'Systeme kehren nicht sofort zurück. Cache-Warmup, Queue-Drain, GC-Recovery brauchen Zeit. Alerting mit asymmetrischen Schwellen (Grafana Recovery Threshold).', icon: '\u{1F504}', color: C.red },
]
</script>

<template>
  <div class="sim-root">
    <!-- Header -->
    <div class="header">
      <div class="header-tag">
        <div class="tag-dot" />
        <span class="tag-text">Systemdynamik-Simulator</span>
      </div>
      <h1 class="title">Warteschlangen, Oszillation, Hysterese</h1>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'sim' }" @click="activeTab = 'sim'">Simulation</button>
      <button class="tab-btn" :class="{ active: activeTab === 'theory' }" @click="activeTab = 'theory'">M/M/1 &amp; Regeln</button>
    </div>

    <!-- TAB: Simulation -->
    <template v-if="activeTab === 'sim'">

    <!-- Scenario selector -->
    <div class="scenario-grid">
      <button
        v-for="s in SIMS"
        :key="s.id"
        class="scenario-btn"
        :class="{ active: simId === s.id }"
        @click="selectSim(s.id)"
      >
        <div class="scenario-name">{{ s.icon }} <span :style="{ color: simId === s.id ? C.orange : C.text }">{{ s.name }}</span></div>
        <div class="scenario-sub">{{ s.subtitle }}</div>
      </button>
    </div>

    <!-- Simulation area -->
    <div class="sim-panel">
      <div class="sim-desc">{{ sim.description }}</div>

      <!-- Controls -->
      <div class="controls">
        <button class="play-btn" @click="playing ? handleStop() : handlePlay()">
          {{ playing ? '⏸' : '▶' }}
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
        <span class="time-label">{{ (progress * sim.duration).toFixed(1) }}s</span>
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
            {{ st.name }} <span style="opacity: 0.6">({{ st.capacity }}req/s, buf:{{ st.bufferMax }})</span>
          </div>
        </template>
      </div>

      <!-- Charts row: Throughput + Buffer side by side -->
      <div class="charts-row">
        <!-- Throughput chart -->
        <svg
          :viewBox="`0 0 480 68`"
          class="chart-svg"
        >
          <line
            v-for="f in [0.25, 0.5, 0.75]"
            :key="'tg' + f"
            :x1="42" :y1="10 + 38 - (f * 38)"
            :x2="470" :y2="10 + 38 - (f * 38)"
            :stroke="C.border" stroke-width="0.5"
          />
          <line x1="42" :y1="48" x2="470" :y2="48" :stroke="C.dim" stroke-width="1" />
          <line x1="42" y1="10" x2="42" :y2="48" :stroke="C.dim" stroke-width="1" />
          <text x="46" y="6" style="font-size: 10px" :fill="C.muted" font-weight="600">Throughput (req/s)</text>
          <text x="42" y="58" style="font-size: 7px" :fill="C.dim" font-family="'JetBrains Mono', monospace">0s</text>
          <text x="470" y="58" text-anchor="end" style="font-size: 7px" :fill="C.dim" font-family="'JetBrains Mono', monospace">{{ (sim.steps * dt).toFixed(0) }}s</text>
          <path
            :d="(() => {
              const fullSeries = [result.inputs, ...sim.stages.map((_, i) => result.outputs[i])]
              const maxVal = computeMaxVal(fullSeries, 0, false)
              const series = sliceArr(result.inputs)
              const xSteps = sim.steps
              const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428
              const toY = (v) => 10 + 38 - (v / maxVal) * 38
              return miniChartPath(series, toX, toY)
            })()"
            fill="none" :stroke="C.green" stroke-width="1.2" stroke-linecap="round" opacity="0.85"
          />
          <path
            v-for="(st, si) in sim.stages"
            :key="'tp' + si"
            :d="(() => {
              const fullSeries = [result.inputs, ...sim.stages.map((_, i) => result.outputs[i])]
              const maxVal = computeMaxVal(fullSeries, 0, false)
              const series = sliceArr(result.outputs[si])
              const xSteps = sim.steps
              const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428
              const toY = (v) => 10 + 38 - (v / maxVal) * 38
              return miniChartPath(series, toX, toY)
            })()"
            fill="none" :stroke="STAGE_COLORS[si]" stroke-width="1.2" stroke-linecap="round" opacity="0.85"
          />
          <line x1="50" y1="63" x2="60" y2="63" :stroke="C.green" stroke-width="1.5" />
          <text x="62" y="65" style="font-size: 6px" :fill="C.green" font-family="'JetBrains Mono', monospace">Input</text>
          <g v-for="(st, i) in sim.stages" :key="'tl' + i">
            <line :x1="50 + (i + 1) * 90" y1="63" :x2="60 + (i + 1) * 90" y2="63" :stroke="STAGE_COLORS[i]" stroke-width="1.5" />
            <text :x="62 + (i + 1) * 90" y="65" style="font-size: 6px" :fill="STAGE_COLORS[i]" font-family="'JetBrains Mono', monospace">{{ st.name }}</text>
          </g>
        </svg>

        <!-- Buffer chart -->
        <svg
          :viewBox="`0 0 480 52`"
          class="chart-svg"
        >
          <line
            v-for="f in [0.25, 0.5, 0.75]"
            :key="'bg' + f"
            :x1="42" :y1="10 + 24 - (f * 24)"
            :x2="470" :y2="10 + 24 - (f * 24)"
            :stroke="C.border" stroke-width="0.5"
          />
          <line x1="42" :y1="34" x2="470" :y2="34" :stroke="C.dim" stroke-width="1" />
          <line x1="42" y1="10" x2="42" :y2="34" :stroke="C.dim" stroke-width="1" />
          <text x="46" y="6" style="font-size: 10px" :fill="C.muted" font-weight="600">Buffer-Füllstand</text>
          <text x="42" y="44" style="font-size: 7px" :fill="C.dim" font-family="'JetBrains Mono', monospace">0s</text>
          <text x="470" y="44" text-anchor="end" style="font-size: 7px" :fill="C.dim" font-family="'JetBrains Mono', monospace">{{ (sim.steps * dt).toFixed(0) }}s</text>
          <path
            v-for="(st, si) in sim.stages"
            :key="'bp' + si"
            :d="(() => {
              const fullSeries = sim.stages.map((_, i) => result.buffers[i])
              const maxVal = computeMaxVal(fullSeries, 0, false)
              const series = sliceArr(result.buffers[si])
              const xSteps = sim.steps
              const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428
              const toY = (v) => 10 + 24 - (v / maxVal) * 24
              return miniChartPath(series, toX, toY)
            })()"
            fill="none" :stroke="STAGE_COLORS[si]" stroke-width="1.2" stroke-linecap="round" opacity="0.85"
          />
          <g v-for="(st, i) in sim.stages" :key="'bl' + i">
            <line :x1="50 + i * 90" y1="48" :x2="60 + i * 90" y2="48" :stroke="STAGE_COLORS[i]" stroke-width="1.5" />
            <text :x="62 + i * 90" y="50" style="font-size: 6px" :fill="STAGE_COLORS[i]" font-family="'JetBrains Mono', monospace">{{ st.name }}</text>
          </g>
        </svg>
      </div>

      <!-- Clipping chart -->
      <svg
        :viewBox="`0 0 480 42`"
        class="chart-svg"
      >
        <line
          v-for="f in [0.25, 0.5, 0.75]"
          :key="'cg' + f"
          :x1="42" :y1="10 + 18 - (f * 18)"
          :x2="470" :y2="10 + 18 - (f * 18)"
          :stroke="C.border" stroke-width="0.5"
        />
        <line x1="42" :y1="28" x2="470" :y2="28" :stroke="C.dim" stroke-width="1" />
        <line x1="42" y1="10" x2="42" :y2="28" :stroke="C.dim" stroke-width="1" />
        <text x="46" y="6" style="font-size: 10px" :fill="C.muted" font-weight="600">Drops (req/s)</text>
        <text x="42" y="37" style="font-size: 7px" :fill="C.dim" font-family="'JetBrains Mono', monospace">0s</text>
        <text x="470" y="37" text-anchor="end" style="font-size: 7px" :fill="C.dim" font-family="'JetBrains Mono', monospace">{{ (sim.steps * dt).toFixed(0) }}s</text>
        <path
          v-for="(st, si) in sim.stages"
          :key="'cp' + si"
          :d="(() => {
            const fullSeries = sim.stages.map((_, i) => result.clipped[i])
            const maxVal = computeMaxVal(fullSeries, 0, false)
            const series = sliceArr(result.clipped[si])
            const xSteps = sim.steps
            const toX = (idx) => 42 + (idx / (xSteps - 1)) * 428
            const toY = (v) => 10 + 18 - (v / maxVal) * 18
            return miniChartPath(series, toX, toY)
          })()"
          fill="none" :stroke="STAGE_COLORS[si]" stroke-width="1.2" stroke-linecap="round" opacity="0.85"
        />
        <g v-for="(st, i) in sim.stages" :key="'cl' + i">
          <line :x1="50 + i * 90" y1="39" :x2="60 + i * 90" y2="39" :stroke="STAGE_COLORS[i]" stroke-width="1.5" />
          <text :x="62 + i * 90" y="41" style="font-size: 6px" :fill="STAGE_COLORS[i]" font-family="'JetBrains Mono', monospace">{{ st.name }}</text>
        </g>
      </svg>

      <!-- Bottom: phase space (conditional) + insight side by side -->
      <div class="sim-bottom-row">
        <!-- Phase space for step scenario -->
        <div v-if="sim.id === 'step'" class="phase-space-panel">
          <div class="phase-title">PHASENRAUM</div>
          <svg :viewBox="`0 0 ${psW} ${psH}`" class="phase-svg">
            <g v-for="f in [0.25, 0.5, 0.75]" :key="'pg' + f">
              <line :x1="psPad.l" :y1="psPad.t + psCh - (f * psCh)" :x2="psPad.l + psCw" :y2="psPad.t + psCh - (f * psCh)" :stroke="C.border" stroke-width="0.5" />
              <line :x1="psPad.l + (f * psCw)" :y1="psPad.t" :x2="psPad.l + (f * psCw)" :y2="psPad.t + psCh" :stroke="C.border" stroke-width="0.5" />
            </g>
            <line :x1="psPad.l" :y1="psPad.t + psCh" :x2="psPad.l + psCw" :y2="psPad.t + psCh" :stroke="C.dim" stroke-width="1" />
            <line :x1="psPad.l" :y1="psPad.t" :x2="psPad.l" :y2="psPad.t + psCh" :stroke="C.dim" stroke-width="1" />
            <text :x="psPad.l + psCw / 2" :y="psH - 2" text-anchor="middle" style="font-size: 9px" :fill="C.muted">Input</text>
            <text x="6" :y="psPad.t + psCh / 2" text-anchor="middle" style="font-size: 9px" :fill="C.muted" :transform="`rotate(-90, 6, ${psPad.t + psCh / 2})`">Output</text>
            <path
              v-if="(() => { const d = Math.floor(progress * sim.steps); return d > 1; })()"
              :d="(() => {
                const xData = result.inputs
                const yData = result.outputs[sim.stages.length - 1]
                const N = sim.steps
                let xMax = 0, yMax = 0
                for (let i = 0; i < N; i++) { if (xData[i] > xMax) xMax = xData[i]; if (yData[i] > yMax) yMax = yData[i] }
                xMax = xMax * 1.1 || 1; yMax = yMax * 1.1 || 1
                const drawn = Math.floor(progress * N)
                return phaseSpacePath(xData, yData, xMax, yMax, drawn)
              })()"
              fill="none" :stroke="C.yellow" stroke-width="1.2" opacity="0.7" stroke-linecap="round"
            />
            <circle
              v-if="Math.floor(progress * sim.steps) > 0"
              :cx="(() => { const xData = result.inputs; const N = sim.steps; let xMax = 0; for (let i = 0; i < N; i++) if (xData[i] > xMax) xMax = xData[i]; xMax = xMax * 1.1 || 1; return psPad.l + (xData[0] / xMax) * psCw })()"
              :cy="(() => { const yData = result.outputs[sim.stages.length - 1]; const N = sim.steps; let yMax = 0; for (let i = 0; i < N; i++) if (yData[i] > yMax) yMax = yData[i]; yMax = yMax * 1.1 || 1; return psPad.t + psCh - (yData[0] / yMax) * psCh })()"
              r="2" :fill="C.green" :stroke="C.bg" stroke-width="0.5"
            />
            <circle
              v-if="Math.floor(progress * sim.steps) > 0"
              :cx="(() => { const xData = result.inputs; const N = sim.steps; let xMax = 0; for (let i = 0; i < N; i++) if (xData[i] > xMax) xMax = xData[i]; xMax = xMax * 1.1 || 1; const cur = Math.max(0, Math.floor(progress * N) - 1); return psPad.l + (xData[cur] / xMax) * psCw })()"
              :cy="(() => { const yData = result.outputs[sim.stages.length - 1]; const N = sim.steps; let yMax = 0; for (let i = 0; i < N; i++) if (yData[i] > yMax) yMax = yData[i]; yMax = yMax * 1.1 || 1; const cur = Math.max(0, Math.floor(progress * N) - 1); return psPad.t + psCh - (yData[cur] / yMax) * psCh })()"
              r="3" :fill="C.yellow" :stroke="C.text" stroke-width="1"
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

    </template>

    <!-- TAB: Theory -->
    <template v-if="activeTab === 'theory'">

    <!-- M/M/1 + caveats -->
    <div class="bottom-row">
      <div class="mm1-panel">
        <div class="section-title">M/M/1 Warteschlange: Warum 80%</div>
        <svg :viewBox="`0 0 ${mm1W} ${mm1H}`" class="mm1-svg">
          <rect :x="mm1Pad.l" :y="mm1Pad.t" :width="mm1ToX(0.7) - mm1Pad.l" :height="mm1Ch" :fill="C.green" opacity="0.04" />
          <rect :x="mm1ToX(0.7)" :y="mm1Pad.t" :width="mm1ToX(0.8) - mm1ToX(0.7)" :height="mm1Ch" :fill="C.yellow" opacity="0.06" />
          <rect :x="mm1ToX(0.8)" :y="mm1Pad.t" :width="mm1ToX(0.98) - mm1ToX(0.8)" :height="mm1Ch" :fill="C.red" opacity="0.06" />
          <g v-for="f in [2, 5, 10]" :key="'mg' + f">
            <line :x1="mm1Pad.l" :y1="mm1ToY(f)" :x2="mm1Pad.l + mm1Cw" :y2="mm1ToY(f)" :stroke="C.border" stroke-width="0.5" />
            <text :x="mm1Pad.l - 4" :y="mm1ToY(f) + 3" text-anchor="end" style="font-size: 10px" :fill="C.dim" font-family="'JetBrains Mono', monospace">{{ f }}x</text>
          </g>
          <line :x1="mm1Pad.l" :y1="mm1Pad.t + mm1Ch" :x2="mm1Pad.l + mm1Cw" :y2="mm1Pad.t + mm1Ch" :stroke="C.dim" stroke-width="1" />
          <line :x1="mm1Pad.l" :y1="mm1Pad.t" :x2="mm1Pad.l" :y2="mm1Pad.t + mm1Ch" :stroke="C.dim" stroke-width="1" />
          <line :x1="mm1ToX(0.8)" :y1="mm1Pad.t" :x2="mm1ToX(0.8)" :y2="mm1Pad.t + mm1Ch" :stroke="C.orange" stroke-width="1" stroke-dasharray="3,2" opacity="0.6" />
          <text :x="mm1ToX(0.8) + 3" :y="mm1Pad.t + mm1Ch - 4" style="font-size: 10px" :fill="C.orange" font-weight="700" font-family="'JetBrains Mono', monospace">80%</text>
          <path :d="mm1PathD" fill="none" :stroke="C.blue" stroke-width="2" stroke-linecap="round" />
          <text :x="mm1Pad.l + mm1Cw / 2" :y="mm1H - 4" text-anchor="middle" style="font-size: 12px" :fill="C.muted">Utilization</text>
          <text :x="mm1Pad.l + mm1Cw - 4" :y="mm1Pad.t + 12" text-anchor="end" style="font-size: 8px" :fill="C.dim" font-family="'JetBrains Mono', monospace">T = S/(1-p)</text>
          <g v-if="hovU !== null && mm1HoverF !== null">
            <circle :cx="mm1ToX(hovU)" :cy="mm1ToY(mm1HoverF)" r="4" :fill="C.blue" :stroke="C.text" stroke-width="1" />
            <text :x="mm1ToX(hovU)" :y="mm1ToY(mm1HoverF) - 8" text-anchor="middle" style="font-size: 8px" :fill="C.blue" font-weight="700" font-family="'JetBrains Mono', monospace">
              {{ (hovU * 100).toFixed(0) }}%={{ mm1HoverF.toFixed(1) }}x
            </text>
          </g>
          <rect :x="mm1Pad.l" :y="mm1Pad.t" :width="mm1Cw" :height="mm1Ch" fill="transparent" style="cursor: crosshair" @mousemove="mm1MouseMove" @mouseleave="mm1MouseLeave" />
        </svg>
        <div class="mm1-caption">
          Response-Time = Service-Time / (1 - Utilization). Bei 50%: 2x, bei 80%: 5x, bei 90%: 10x. Hover für Werte.
        </div>
      </div>
      <div class="caveats-panel">
        <div class="section-title">Einschränkungen</div>
        <div class="caveats-list">
          <div
            v-for="(c, i) in caveats"
            :key="i"
            class="caveat-item"
            :style="{ background: c.c + '06', borderColor: c.c + '12' }"
          >
            <div class="caveat-title" :style="{ color: c.c }">{{ c.t }}</div>
            <div class="caveat-desc">{{ c.d }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Key takeaways -->
    <div class="takeaways-panel">
      <div class="section-title">Drei Regeln aus der Systemdynamik</div>
      <div class="takeaways-grid">
        <div
          v-for="(r, i) in takeaways"
          :key="i"
          class="takeaway-item"
          :style="{ background: r.color + '06', borderColor: r.color + '15' }"
        >
          <div class="takeaway-title">{{ r.icon }} <span :style="{ color: r.color }">{{ r.title }}</span></div>
          <div class="takeaway-desc">{{ r.desc }}</div>
        </div>
      </div>
    </div>

    </template>
  </div>
</template>

<style scoped>
/* All sizes scaled ~65% for 960x540 Slidev viewport */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap');

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

* { box-sizing: border-box; margin: 0; padding: 0; }

.sim-root {
  background: #0a0d12;
  color: #e2e8f0;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  padding: 10px 12px 16px;
  max-width: 960px;
  margin: 0 auto;
  overflow-y: auto;
  max-height: 540px;
}

.sim-root ::-webkit-scrollbar { width: 4px; }
.sim-root ::-webkit-scrollbar-thumb { background: #1e2536; border-radius: 2px; }

/* Header */
.header { margin-bottom: 8px; }
.header-tag { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
.tag-dot { width: 5px; height: 5px; border-radius: 50%; background: #f97316; box-shadow: 0 0 6px #f97316; }
.tag-text { font-size: 7px; font-weight: 700; color: #f97316; text-transform: uppercase; letter-spacing: 1.5px; font-family: 'JetBrains Mono', monospace; }
.title { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; margin-bottom: 2px; }
.subtitle-text { font-size: 8px; color: #64748b; line-height: 1.4; max-width: 500px; }

/* Tabs */
.tab-bar { display: flex; gap: 4px; margin-bottom: 8px; }
.tab-btn {
  padding: 4px 12px; border-radius: 4px; border: 1px solid #1e2536;
  background: #111621; color: #64748b; font-size: 8px; font-weight: 700;
  cursor: pointer; outline: none; font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s ease;
}
.tab-btn.active { background: rgba(249, 115, 22, 0.08); border-color: #f97316; color: #f97316; }

/* Scenario selector */
.scenario-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px; }
.scenario-btn {
  background: #111621;
  border: 1px solid #1e2536;
  border-radius: 5px;
  padding: 5px 7px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  outline: none;
  color: #e2e8f0;
}
.scenario-btn.active { background: rgba(249, 115, 22, 0.06); border-color: #f97316; }
.scenario-name { font-size: 10px; margin-bottom: 1px; }
.scenario-name span { font-size: 8px; font-weight: 700; }
.scenario-sub { font-size: 6px; color: #64748b; }

/* Simulation panel */
.sim-panel {
  background: #111621;
  border: 1px solid #1e2536;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 4px;
  animation: fadeIn 0.3s ease;
}
.sim-desc { font-size: 7px; color: #64748b; line-height: 1.3; margin-bottom: 4px; }

/* Controls */
.controls { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.play-btn {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid #f97316; background: rgba(249, 115, 22, 0.08);
  color: #f97316; font-size: 9px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; outline: none;
}
.slider {
  flex: 1;
  -webkit-appearance: none; appearance: none;
  background: #1e2536; height: 3px; border-radius: 2px; outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 10px; height: 10px; border-radius: 50%;
  background: #3b82f6; cursor: pointer; border: 1.5px solid #0a0d12;
}
.time-label { font-size: 7px; color: #64748b; font-family: 'JetBrains Mono', monospace; min-width: 28px; }

/* Pipeline */
.pipeline { display: flex; align-items: center; gap: 3px; margin-bottom: 3px; flex-wrap: wrap; }
.pipe-node { padding: 2px 6px; border-radius: 3px; font-size: 6px; font-weight: 600; border: 1px solid; white-space: nowrap; }
.input-node { background: rgba(34, 197, 94, 0.07); border-color: rgba(34, 197, 94, 0.15); color: #22c55e; }
.arrow { color: #3e4a63; font-size: 6px; }

/* Charts */
.charts-row { display: flex; gap: 6px; }
.charts-row .chart-svg { flex: 1; min-width: 0; }
.chart-svg { width: 100%; max-width: 520px; height: auto; display: block; overflow: visible; margin-top: 2px; }

/* Bottom row: phase space + insight */
.sim-bottom-row { display: flex; gap: 6px; margin-top: 4px; align-items: stretch; }

/* Phase space */
.phase-space-panel { flex: 0 0 180px; padding: 5px; background: #161c2a; border-radius: 4px; border: 1px solid #1e2536; }
.phase-title { font-size: 6px; font-weight: 700; color: #eab308; margin-bottom: 2px; font-family: 'JetBrains Mono', monospace; }
.phase-svg { width: 100%; height: auto; }

/* Insight */
.insight-box { flex: 1; padding: 5px 7px; background: rgba(249, 115, 22, 0.02); border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.08); }
.insight-label { font-size: 6px; font-weight: 700; color: #f97316; margin-bottom: 2px; font-family: 'JetBrains Mono', monospace; }
.insight-text { font-size: 7px; color: #e2e8f0; line-height: 1.4; }

/* Bottom row */
.bottom-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.mm1-panel { flex: 1 1 250px; background: #111621; border: 1px solid #1e2536; border-radius: 6px; padding: 7px 8px; }
.mm1-svg { width: 100%; height: auto; }
.mm1-caption { font-size: 6px; color: #64748b; line-height: 1.4; margin-top: 3px; }
.caveats-panel { flex: 1 1 180px; background: #111621; border: 1px solid #1e2536; border-radius: 6px; padding: 7px 8px; }
.section-title { font-size: 8px; font-weight: 700; color: #e2e8f0; margin-bottom: 5px; }
.caveats-list { display: flex; flex-direction: column; gap: 3px; }
.caveat-item { padding: 3px 5px; border-radius: 3px; border: 1px solid; }
.caveat-title { font-size: 6px; font-weight: 700; }
.caveat-desc { font-size: 6px; color: #64748b; line-height: 1.3; }

/* Key takeaways */
.takeaways-panel { background: #111621; border: 1px solid #1e2536; border-radius: 6px; padding: 8px 10px; }
.takeaways-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.takeaway-item { padding: 6px 7px; border-radius: 5px; border: 1px solid; }
.takeaway-title { font-size: 9px; margin-bottom: 2px; }
.takeaway-title span { font-size: 7px; font-weight: 700; }
.takeaway-desc { font-size: 6px; color: #64748b; line-height: 1.4; }
</style>
