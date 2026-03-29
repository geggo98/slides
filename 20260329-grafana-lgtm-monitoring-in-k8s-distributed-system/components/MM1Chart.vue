<script setup>
/**
 * MM1Chart.vue — Standalone M/M/1 queueing theory chart.
 * Shows Response-Time = S/(1-rho) curve with hover interaction.
 */
import { ref, computed } from 'vue'

const C = {
  bg: '#0a0d12', surface: '#111621', border: '#1e2536',
  text: '#e2e8f0', muted: '#64748b', dim: '#3e4a63',
  blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', red: '#ef4444',
}

const W = 380
const H = 180
const pad = { t: 16, r: 16, b: 34, l: 42 }
const cw = W - pad.l - pad.r
const ch = H - pad.t - pad.b
const maxY = 12

const hoveredU = ref(null)

const pts = computed(() => {
  const a = []
  for (let i = 0; i <= 150; i++) {
    const u = (i / 150) * 0.98
    a.push({ u, f: Math.min(1 / (1 - u), maxY) })
  }
  return a
})

function toX(u) { return pad.l + (u * cw) / 0.98 }
function toY(f) { return pad.t + ch - (f / maxY) * ch }

const pathD = computed(() =>
  pts.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.u).toFixed(1)},${toY(p.f).toFixed(1)}`).join(' ')
)

const hoverF = computed(() =>
  hoveredU.value !== null ? Math.min(1 / (1 - hoveredU.value), maxY) : null
)

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function onMouseMove(e) {
  const r = e.currentTarget.getBoundingClientRect()
  hoveredU.value = clamp(((e.clientX - r.left) / r.width) * 0.98, 0, 0.98)
}

function onMouseLeave() {
  hoveredU.value = null
}

const gridFracs = [2, 5, 10]
</script>

<template>
  <div class="mm1-chart-wrap">
    <div class="mm1-title">M/M/1 Warteschlange: Warum 80%</div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="mm1-svg">
      <!-- Zone backgrounds -->
      <rect :x="pad.l" :y="pad.t" :width="toX(0.7) - pad.l" :height="ch" :fill="C.green" opacity="0.04" />
      <rect :x="toX(0.7)" :y="pad.t" :width="toX(0.8) - toX(0.7)" :height="ch" :fill="C.yellow" opacity="0.06" />
      <rect :x="toX(0.8)" :y="pad.t" :width="toX(0.98) - toX(0.8)" :height="ch" :fill="C.red" opacity="0.06" />

      <!-- Grid lines + Y labels -->
      <g v-for="f in gridFracs" :key="f">
        <line :x1="pad.l" :y1="toY(f)" :x2="pad.l + cw" :y2="toY(f)" :stroke="C.border" stroke-width="0.5" />
        <text :x="pad.l - 4" :y="toY(f) + 3" text-anchor="end" font-size="10" :fill="C.dim" font-family="'JetBrains Mono', monospace">{{ f }}x</text>
      </g>

      <!-- Axes -->
      <line :x1="pad.l" :y1="pad.t + ch" :x2="pad.l + cw" :y2="pad.t + ch" :stroke="C.dim" stroke-width="1" />
      <line :x1="pad.l" :y1="pad.t" :x2="pad.l" :y2="pad.t + ch" :stroke="C.dim" stroke-width="1" />

      <!-- 80% threshold line -->
      <line :x1="toX(0.8)" :y1="pad.t" :x2="toX(0.8)" :y2="pad.t + ch" :stroke="C.orange" stroke-width="1" stroke-dasharray="3,2" opacity="0.6" />
      <text :x="toX(0.8) + 3" :y="pad.t + ch - 4" font-size="10" :fill="C.orange" font-weight="700" font-family="'JetBrains Mono', monospace">80%</text>

      <!-- Curve -->
      <path :d="pathD" fill="none" :stroke="C.blue" stroke-width="2" stroke-linecap="round" />

      <!-- X-axis label -->
      <text :x="pad.l + cw / 2" :y="H - 4" text-anchor="middle" font-size="13" :fill="C.muted">Utilization</text>

      <!-- Formula -->
      <text :x="pad.l + cw - 4" :y="pad.t + 12" text-anchor="end" font-size="11" :fill="C.dim" font-family="'JetBrains Mono', monospace">T = S/(1-p)</text>

      <!-- Hover indicator -->
      <g v-if="hoveredU !== null && hoverF !== null">
        <circle :cx="toX(hoveredU)" :cy="toY(hoverF)" r="4" :fill="C.blue" :stroke="C.text" stroke-width="1" />
        <text :x="toX(hoveredU)" :y="toY(hoverF) - 8" text-anchor="middle" font-size="11" :fill="C.blue" font-weight="700" font-family="'JetBrains Mono', monospace">
          {{ (hoveredU * 100).toFixed(0) }}%={{ hoverF.toFixed(1) }}x
        </text>
      </g>

      <!-- Invisible hover rect -->
      <rect
        :x="pad.l" :y="pad.t" :width="cw" :height="ch"
        fill="transparent" style="cursor: crosshair"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
      />
    </svg>
    <div class="mm1-caption">
      Response-Time = Service-Time / (1 - Utilization). Bei 50%: 2x, bei 80%: 5x, bei 90%: 10x. Die Kurve biegt ab ~70% merklich, wird ab 80% steil. Hover für Werte.
    </div>
  </div>
</template>

<style scoped>
.mm1-chart-wrap {
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}
.mm1-title {
  font-size: 12px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 5px;
}
.mm1-svg {
  width: 100%;
  max-width: 500px;
  height: auto;
}
.mm1-caption {
  font-size: 10px;
  color: #64748b;
  line-height: 1.5;
  margin-top: 4px;
}
</style>
