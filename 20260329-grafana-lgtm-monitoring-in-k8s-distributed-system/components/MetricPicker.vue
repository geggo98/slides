<script setup lang="ts">
/**
 * MetricPicker.vue — Metriken an-/abwählen, gruppiert nach den Golden Signals.
 * Steuert Stat-Panels und Zeitreihen gemeinsam. Errors ist absichtlich
 * ausgegraut (im Modell gibt es keine Fehler, siehe lib/metrics.ts).
 */
import { computed } from "vue";
import { useGrafanaPalette } from "./lib/grafanaPalette";
import { ERRORS_HELP, METRICS, SIGNALS, type MetricKey } from "./lib/metrics";

const props = defineProps<{
  available: MetricKey[];
  modelValue: MetricKey[];
}>();
const emit = defineEmits<{ "update:modelValue": [MetricKey[]] }>();
const C = useGrafanaPalette();

const groups = computed(() =>
  SIGNALS.map((signal) => ({
    signal,
    items: props.available
      .map((k) => METRICS[k])
      .filter((m) => m.signal === signal),
  })),
);

function toggle(k: MetricKey) {
  const on = props.modelValue.includes(k);
  // Reihenfolge der Ausgabe folgt `available`, nicht der Klickfolge.
  emit(
    "update:modelValue",
    props.available.filter((x) =>
      x === k ? !on : props.modelValue.includes(x),
    ),
  );
}
</script>

<template>
  <div class="mp" role="group" aria-label="Metriken auswählen">
    <div v-for="g in groups" :key="g.signal" class="mp-group">
      <span class="mp-signal" :style="{ color: C.textLow }">{{
        g.signal
      }}</span>
      <template v-if="g.signal === 'Errors'">
        <span
          class="mp-chip mp-disabled"
          :title="ERRORS_HELP"
          :style="{ borderColor: C.border, color: C.textLow }"
          >– n/a</span
        >
      </template>
      <button
        v-for="m in g.items"
        :key="m.key"
        type="button"
        class="mp-chip"
        :aria-pressed="modelValue.includes(m.key)"
        :data-metric="m.key"
        :title="m.help"
        :style="
          modelValue.includes(m.key)
            ? {
                borderColor: C.series[m.key],
                background: C.panelHi,
                color: C.textHi,
              }
            : {
                borderColor: C.border,
                background: 'transparent',
                color: C.textLow,
              }
        "
        @click="toggle(m.key)"
      >
        <span
          class="mp-dot"
          :style="{
            background: modelValue.includes(m.key)
              ? C.series[m.key]
              : 'transparent',
            borderColor: C.series[m.key],
          }"
        />{{ m.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.mp {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
.mp-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.mp-signal {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.mp-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.mp-disabled {
  cursor: help;
  font-style: italic;
}
.mp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid;
}
</style>
