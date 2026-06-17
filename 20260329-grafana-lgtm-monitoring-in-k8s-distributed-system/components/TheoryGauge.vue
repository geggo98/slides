<script setup>
/**
 * TheoryGauge.vue — Arc-Gauge: Bogen = Messung, cyan Strich = Theorie/Sollwert.
 * Port des React-`Gauge` aus mm1-simulator.jsx (270°-Bogen a0=0.75π…a1=2.25π).
 * Bewusst eigene Komponente statt GaugeRing: GaugeRing leitet Farbe aus
 * warn/crit ab und hat keinen Theorie-Tick / `sub` / Info-Slot.
 */
import { computed } from "vue";
import { useScopeColors } from "./lib/useScopeColors";

const props = defineProps({
  label: { type: String, default: "" },
  value: { type: [String, Number], default: "" },
  unit: { type: String, default: "" },
  frac: { type: Number, default: 0 },
  markFrac: { type: Number, default: null }, // Theorie-Tick (0..1) oder null
  color: { type: String, default: "" },
  sub: { type: String, default: "" },
});
const C = useScopeColors();

const a0 = Math.PI * 0.75;
const a1 = Math.PI * 2.25;
const R = 34;
const cx = 44;
const cy = 44;

function arc(from, to) {
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${cx + R * Math.cos(from)} ${cy + R * Math.sin(from)} A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(to)} ${cy + R * Math.sin(to)}`;
}
const f = computed(() => Math.max(0, Math.min(1, props.frac)));
const trackPath = arc(a0, a1);
const valPath = computed(() => arc(a0, a0 + (a1 - a0) * f.value));
const tick = computed(() => {
  const mf = props.markFrac;
  if (mf == null || mf < 0 || mf > 1) return null;
  const ma = a0 + (a1 - a0) * mf;
  return {
    x1: cx + (R - 7) * Math.cos(ma),
    y1: cy + (R - 7) * Math.sin(ma),
    x2: cx + (R + 7) * Math.cos(ma),
    y2: cy + (R + 7) * Math.sin(ma),
  };
});
const gaugeColor = computed(() => props.color || C.value.phosphor);
</script>

<template>
  <div class="tg">
    <svg viewBox="0 0 88 74" class="tg-svg">
      <path
        :d="trackPath"
        fill="none"
        :stroke="C.border"
        stroke-width="7"
        stroke-linecap="round"
      />
      <path
        :d="valPath"
        fill="none"
        :stroke="gaugeColor"
        stroke-width="7"
        stroke-linecap="round"
      />
      <line
        v-if="tick"
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        :stroke="C.theory"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <text
        x="44"
        y="44"
        text-anchor="middle"
        :fill="C.textHi"
        style="font-size: 17px"
        class="tg-mono"
      >
        {{ value }}
      </text>
      <text
        x="44"
        y="59"
        text-anchor="middle"
        :fill="C.textLow"
        style="font-size: 9px"
        class="tg-mono"
      >
        {{ unit }}
      </text>
    </svg>
    <div class="tg-label-row">
      <span class="tg-label" :style="{ color: C.textMid }">{{ label }}</span>
      <slot name="info" />
    </div>
    <div v-if="sub" class="tg-sub" :style="{ color: C.textLow }">{{ sub }}</div>
  </div>
</template>

<style scoped>
.tg {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 0;
  min-width: 0;
}
.tg-svg {
  width: 100%;
  max-width: 96px;
  height: auto;
}
.tg-mono {
  font-family: var(--slidev-code-font-family);
}
.tg-label-row {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  margin-top: -3px;
}
.tg-label {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tg-sub {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
