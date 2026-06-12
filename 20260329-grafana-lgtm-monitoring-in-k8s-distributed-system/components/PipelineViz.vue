<script setup>
/**
 * PipelineViz.vue — Static pipeline visualization showing stages with capacity and buffer sizes.
 * Props: stages — Array of { name, capacity, bufferMax }
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const props = defineProps({
  stages: {
    type: Array,
    default: () => [
      { name: "API Gateway", capacity: 100, bufferMax: 50 },
      { name: "Quote-Service", capacity: 80, bufferMax: 30 },
      { name: "Provider-Adapter", capacity: 60, bufferMax: 20 },
    ],
  },
});

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
    orange: d ? "#f97316" : "#ea580c",
    purple: d ? "#a855f7" : "#9333ea",
    cyan: d ? "#06b6d4" : "#0891b2",
    green: d ? "#22c55e" : "#16a34a",
  };
});

const STAGE_COLORS = computed(() => [
  C.value.blue,
  C.value.orange,
  C.value.purple,
  C.value.cyan,
  C.value.green,
]);
</script>

<template>
  <div class="pipeline-viz">
    <div
      class="pipeline-node"
      :style="{
        background: C.green + '12',
        borderColor: C.green + '25',
        color: C.green,
      }"
    >
      Input
    </div>
    <template v-for="(st, i) in props.stages" :key="i">
      <span class="arrow" :style="{ color: C.dim }">&#8594;</span>
      <div
        class="pipeline-node"
        :style="{
          background: STAGE_COLORS[i % STAGE_COLORS.length] + '10',
          borderColor: STAGE_COLORS[i % STAGE_COLORS.length] + '25',
          color: STAGE_COLORS[i % STAGE_COLORS.length],
        }"
      >
        {{ st.name }}
        <span class="stage-meta"
          >({{ st.capacity }}req/s, buf:{{ st.bufferMax }})</span
        >
      </div>
    </template>
  </div>
</template>

<style scoped>
.pipeline-viz {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-family: inherit;
}
.pipeline-node {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.arrow {
  font-size: 16px;
}
.stage-meta {
  opacity: 0.6;
}
</style>
