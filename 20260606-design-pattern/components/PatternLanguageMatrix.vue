<script setup>
import { computed } from "vue";
import MatrixPivot from "../../shared/components/MatrixPivot.vue";
import raw from "./pattern-language-matrix.json";

// Optional: nur eine Teilmenge der Muster zeigen (z.B. pro Schicht), damit die
// Matrix in eine Folie passt.
const props = defineProps({
  keys: { type: Array, default: null },
});

const data = computed(() => {
  if (!props.keys) return raw;
  const set = new Set(props.keys);
  return { ...raw, dimensions: raw.dimensions.filter((d) => set.has(d.key)) };
});

// 3-Zustands-Schema dieses Vortrags.
const markScheme = {
  relevant: { symbol: "✓", light: "#27500A", dark: "#80c050" },
  ersatz: { symbol: "↻", light: "#BA7517", dark: "#e0a030" },
  na: { symbol: "—", light: "#9a9a9a", dark: "#777777" },
};
const legend = [
  { mark: "relevant", label: "weiterhin idiomatisch" },
  { mark: "ersatz", label: "moderner Ersatz (Sprachfeature)" },
  { mark: "na", label: "trifft nicht zu" },
];
</script>

<template>
  <MatrixPivot :data="data" :legend="legend" :mark-scheme="markScheme" />
</template>
