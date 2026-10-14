<script setup lang="ts">
/**
 * GrafanaGauge.vue — Grafana-Gauge als Panel: Halbbogen mit schmalem
 * Threshold-Band außen (grün/gelb/rot), Wertbogen in der Farbe der aktuellen
 * Schwelle, große Zahl. Wie im Katalog (VizGuide, Folie „Visualisierungstypen“):
 * nur für begrenzte Werte wie Auslastung. Optional eine Theorie-Marke.
 */
import { computed } from "vue";
import { useGrafanaPalette } from "./lib/grafanaPalette";

const props = withDefaults(
  defineProps<{
    title: string;
    /** Wert als Anteil 0..1 der Skala. */
    frac: number;
    text: string;
    unit?: string;
    /** Schwellen als Anteil; Farbe gilt ab `from`. Erste Schwelle from = 0. */
    thresholds?: { from: number; color: "ok" | "warn" | "crit" }[];
    /** Theorie-/Sollwert als Anteil, oder null. */
    mark?: number | null;
    sub?: string;
    dim?: boolean;
  }>(),
  {
    unit: "",
    thresholds: () => [
      { from: 0, color: "ok" },
      { from: 0.7, color: "warn" },
      { from: 0.9, color: "crit" },
    ],
    mark: null,
    sub: "",
    dim: false,
  },
);
const C = useGrafanaPalette();

const CX = 50;
const CY = 50;
const R = 36;
const RB = 43;
const clamp = (f: number) => Math.max(0, Math.min(1, f));
const pt = (f: number, r: number) => {
  const a = Math.PI * (1 - clamp(f));
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};
function arc(f0: number, f1: number, r: number) {
  const [x0, y0] = pt(f0, r);
  const [x1, y1] = pt(f1, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const bands = computed(() =>
  props.thresholds.map((t, i) => ({
    d: arc(t.from, props.thresholds[i + 1]?.from ?? 1, RB),
    color: C.value[t.color],
  })),
);
const valueColor = computed(() => {
  const f = clamp(props.frac);
  let col = props.thresholds[0]!.color;
  for (const t of props.thresholds) if (f >= t.from) col = t.color;
  return C.value[col];
});
const tick = computed(() => {
  if (props.mark == null || !Number.isFinite(props.mark)) return null;
  const [x1, y1] = pt(props.mark, R - 7);
  const [x2, y2] = pt(props.mark, RB + 3);
  return { x1, y1, x2, y2 };
});
</script>

<template>
  <div
    class="gp"
    :class="{ 'gp-dim': dim }"
    :style="{ background: C.panel, borderColor: C.border }"
  >
    <div class="gp-head">
      <span class="gp-title" :style="{ color: C.textMid }">{{ title }}</span>
      <slot name="info" />
    </div>
    <svg viewBox="0 0 100 58" class="gp-svg" role="img" :aria-label="title">
      <path
        v-for="(b, i) in bands"
        :key="i"
        :d="b.d"
        fill="none"
        :stroke="b.color"
        stroke-width="3"
      />
      <path
        :d="arc(0, 1, R)"
        fill="none"
        :stroke="C.panelHi"
        stroke-width="9"
      />
      <path
        v-if="frac > 0.002"
        :d="arc(0, frac, R)"
        fill="none"
        :stroke="valueColor"
        stroke-width="9"
      />
      <line
        v-if="tick"
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        :stroke="C.theory"
        stroke-width="2"
        stroke-dasharray="2 1.5"
      />
      <text
        x="50"
        y="49"
        text-anchor="middle"
        :fill="valueColor"
        class="gp-val"
      >
        {{ text }}
        <tspan class="gp-unit" :fill="C.textMid">{{ unit }}</tspan>
      </text>
    </svg>
    <div v-if="sub" class="gp-sub" :style="{ color: C.textLow }">{{ sub }}</div>
  </div>
</template>

<style scoped>
.gp {
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 6px 3px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: opacity 0.2s;
}
.gp-dim {
  opacity: 0.32;
}
.gp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
}
.gp-title {
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gp-svg {
  width: 100%;
  max-height: 46px;
  display: block;
}
.gp-val {
  font-size: 15px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
}
.gp-unit {
  font-size: 8px;
  font-weight: 400;
}
.gp-sub {
  font-size: 8.5px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--slidev-code-font-family);
}
</style>
