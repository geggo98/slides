<script setup lang="ts">
/**
 * GrafanaStat.vue — Grafana-Stat-Panel: Titelzeile, große Zahl, Sparkline mit
 * Flächenfüllung über das gewählte Zeitfenster. Für unbegrenzte Werte
 * (Wartezeit, Durchsatz, Queue-Länge). Ein oder zwei Werte (M/M/c:
 * Alternative | Pool); `best` markiert den besseren mit ✓.
 * `skeleton`: nur Rahmen + Titel, Inhalt als grauer Platzhalter (Szenario-Modus).
 */
import { computed } from "vue";
import { useGrafanaPalette } from "./lib/grafanaPalette";
import { withAlpha } from "./lib/queueing.js";
import type { Bucket } from "./lib/metricHistory";

interface StatValue {
  text: string;
  color: string;
  label?: string;
  best?: boolean;
}
interface Spark {
  pts: Bucket[];
  color: string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    values: StatValue[];
    unit?: string;
    sparks?: Spark[];
    range: [number, number];
    /** Theorie-Mittel als gestrichelte Linie in der Sparkline. */
    theory?: number | null;
    sub?: string;
    dim?: boolean;
    skeleton?: boolean;
  }>(),
  {
    unit: "",
    sparks: () => [],
    theory: null,
    sub: "",
    dim: false,
    skeleton: false,
  },
);
const C = useGrafanaPalette();

const W = 100;
const H = 22;
const yMax = computed(() => {
  let m =
    props.theory != null && Number.isFinite(props.theory) ? props.theory : 0;
  for (const s of props.sparks) for (const b of s.pts) m = Math.max(m, b.avg);
  return m > 0 ? m * 1.1 : 1;
});
const x = (t: number) =>
  ((t - props.range[0]) / Math.max(1e-9, props.range[1] - props.range[0])) * W;
const y = (v: number) => H - (Math.min(v, yMax.value) / yMax.value) * (H - 1);

const paths = computed(() =>
  props.sparks
    .filter((s) => s.pts.length > 1)
    .map((s) => {
      const line = s.pts
        .map(
          (b, i) =>
            `${i ? "L" : "M"}${x(b.t).toFixed(1)} ${y(b.avg).toFixed(1)}`,
        )
        .join(" ");
      const first = s.pts[0]!;
      const last = s.pts[s.pts.length - 1]!;
      const area = `${line} L${x(last.t).toFixed(1)} ${H} L${x(first.t).toFixed(1)} ${H} Z`;
      return {
        line,
        area,
        color: s.color,
        fill: withAlpha(s.color, 0.16),
      };
    }),
);
const theoryY = computed(() =>
  props.theory != null && Number.isFinite(props.theory)
    ? y(props.theory)
    : null,
);
</script>

<template>
  <div
    class="sp"
    :class="{ 'sp-dim': dim && !skeleton, skel: skeleton }"
    :style="{
      background: C.panel,
      borderColor: C.border,
      '--skel-bg': C.panelHi,
    }"
  >
    <div class="sp-head">
      <span class="sp-title" :style="{ color: C.textMid }">{{ title }}</span>
      <span class="info-slot" :class="{ hidden: skeleton }"
        ><slot name="info"
      /></span>
    </div>
    <div class="sp-vals" :class="{ 'sp-dual': values.length > 1 }">
      <span
        v-for="(v, i) in values"
        :key="i"
        class="sp-val"
        :style="{ color: v.color }"
        :title="v.label"
        >{{ v.best ? "✓" : "" }}{{ v.text
        }}<span
          v-if="i === values.length - 1"
          class="sp-unit"
          :style="{ color: C.textMid }"
          >{{ unit }}</span
        ></span
      >
    </div>
    <svg
      class="sp-spark"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g v-for="(p, i) in paths" :key="i">
        <path :d="p.area" :fill="p.fill" />
        <path
          :d="p.line"
          fill="none"
          :stroke="p.color"
          stroke-width="1.2"
          vector-effect="non-scaling-stroke"
        />
      </g>
      <line
        v-if="theoryY != null"
        x1="0"
        :y1="theoryY"
        :x2="W"
        :y2="theoryY"
        :stroke="C.theory"
        stroke-width="1"
        stroke-dasharray="3 2"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <div v-if="sub" class="sp-sub" :style="{ color: C.textLow }">{{ sub }}</div>
  </div>
</template>

<style scoped>
.sp {
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 6px 3px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: opacity 0.2s;
}
.sp-dim {
  opacity: 0.32;
}
.info-slot {
  display: inline-flex;
}
.info-slot.hidden {
  visibility: hidden;
}
/* Skelett: Größe bleibt, Inhalt unsichtbar, grauer Platzhalter darüber. */
.skel {
  position: relative;
}
.skel > :not(.sp-head) {
  visibility: hidden;
}
.skel::after {
  content: "";
  position: absolute;
  inset: 18px 6px 5px;
  border-radius: 3px;
  background: var(--skel-bg);
}
.sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
}
.sp-title {
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sp-vals {
  display: flex;
  justify-content: center;
  gap: 8px;
  line-height: 1.15;
}
.sp-dual {
  gap: 6px;
}
.sp-dual .sp-val {
  font-size: 12.5px;
}
.sp-val {
  font-size: 16px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
  white-space: nowrap;
}
.sp-unit {
  font-size: 8.5px;
  font-weight: 400;
  margin-left: 1px;
}
.sp-spark {
  width: 100%;
  height: 20px;
  display: block;
}
.sp-sub {
  font-size: 8.5px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--slidev-code-font-family);
}
</style>
