<script setup>
/**
 * GaugeRing.vue — exact port of the React GaugeRing from saturation-simulator.jsx
 * Original defaults: size=72, strokeWidth=5, r=(size-10)/2
 * Value font: size>60 ? 15 : 12, at y=size/2-2
 * Unit font: 8, at y=size/2+13
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const props = defineProps({
  value: { type: Number, required: true },
  max: { type: Number, required: true },
  warn: { type: Number, required: true },
  crit: { type: Number, required: true },
  size: { type: Number, default: 72 },
  label: { type: String, default: "" },
  unit: { type: String, default: "" },
  invert: { type: Boolean, default: false },
});

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    border: d ? "#1e2536" : "#e2e8f0",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    green: d ? "#22c55e" : "#16a34a",
    orange: d ? "#f97316" : "#ea580c",
    red: d ? "#ef4444" : "#dc2626",
  };
});

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const pct = computed(() => clamp((props.value / props.max) * 100, 0, 100));
const r = computed(() => (props.size - 10) / 2);
const circ = computed(() => 2 * Math.PI * r.value);
const sweep = 0.75;
const dashLen = computed(() => circ.value * sweep);
const valLen = computed(() => dashLen.value * (pct.value / 100));
const rotation = 135;

const color = computed(() => {
  if (props.invert) {
    if (props.value <= props.crit) return C.value.red;
    if (props.value <= props.warn) return C.value.orange;
  } else {
    if (props.value >= props.crit) return C.value.red;
    if (props.value >= props.warn) return C.value.orange;
  }
  return C.value.green;
});

// Non-color status cue (Protan/Deutan can't tell warn-orange from crit-red):
// "" = ok, "!" = warning, "!!" = critical.
const statusGlyph = computed(() => {
  if (props.invert) {
    if (props.value <= props.crit) return "!!";
    if (props.value <= props.warn) return "!";
  } else {
    if (props.value >= props.crit) return "!!";
    if (props.value >= props.warn) return "!";
  }
  return "";
});

const trackDasharray = computed(
  () => `${dashLen.value} ${circ.value - dashLen.value}`,
);
const trackDashoffset = computed(() => (-circ.value * (1 - sweep)) / 2);
const valDasharray = computed(
  () => `${valLen.value} ${circ.value - valLen.value}`,
);
const transformStr = computed(
  () => `rotate(${rotation} ${props.size / 2} ${props.size / 2})`,
);

const displayValue = computed(() => {
  const v = props.value;
  if (typeof v !== "number") return v;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (v % 1 === 0) return String(v);
  return v.toFixed(1);
});

// Exact same font sizes as original React
const valueFontSize = computed(() => (props.size > 60 ? 15 : 12));
const unitFontSize = 8;
</script>

<template>
  <div class="gauge-ring-wrapper">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="C.border"
        stroke-width="5"
        :stroke-dasharray="trackDasharray"
        :stroke-dashoffset="trackDashoffset"
        :transform="transformStr"
        stroke-linecap="round"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="color"
        stroke-width="5"
        :stroke-dasharray="valDasharray"
        :stroke-dashoffset="trackDashoffset"
        :transform="transformStr"
        stroke-linecap="round"
        class="gauge-value-arc"
      />
      <text
        :x="size / 2"
        :y="size / 2 - 2"
        text-anchor="middle"
        dominant-baseline="middle"
        :style="{
          fill: color,
          fontSize: valueFontSize + 'px',
          fontWeight: 800,
          fontFamily: 'var(--slidev-code-font-family)',
        }"
      >
        {{ displayValue }}
      </text>
      <text
        v-if="statusGlyph"
        :x="size / 2"
        :y="size / 2 - 16"
        text-anchor="middle"
        dominant-baseline="middle"
        :style="{
          fill: color,
          fontSize: '10px',
          fontWeight: 800,
          fontFamily: 'var(--slidev-code-font-family)',
        }"
      >
        {{ statusGlyph }}
      </text>
      <text
        :x="size / 2"
        :y="size / 2 + 13"
        text-anchor="middle"
        :style="{
          fill: C.muted,
          fontSize: unitFontSize + 'px',
          fontFamily: 'var(--slidev-code-font-family)',
        }"
      >
        {{ unit }}
      </text>
    </svg>
    <div
      class="gauge-label"
      :style="{ maxWidth: size + 20 + 'px', color: C.muted }"
    >
      {{ label }}
    </div>
  </div>
</template>

<style scoped>
.gauge-ring-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.gauge-value-arc {
  transition:
    stroke-dasharray 0.6s ease,
    stroke 0.3s ease;
}
.gauge-label {
  font-size: 10px;
  color: #64748b;
  text-align: center;
  line-height: 1.2;
}
</style>
