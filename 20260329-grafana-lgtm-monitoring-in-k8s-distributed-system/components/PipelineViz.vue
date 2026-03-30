<script setup>
/**
 * PipelineViz.vue — Static pipeline visualization showing stages with capacity and buffer sizes.
 * Props: stages — Array of { name, capacity, bufferMax }
 */
import { computed } from 'vue'
import { useDarkMode } from '@slidev/client'

const props = defineProps({
  stages: {
    type: Array,
    default: () => [
      { name: 'API Gateway', capacity: 100, bufferMax: 50 },
      { name: 'Quote-Service', capacity: 80, bufferMax: 30 },
      { name: 'Provider-Adapter', capacity: 60, bufferMax: 20 },
    ],
  },
})

const { isDark } = useDarkMode()

const C = computed(() => isDark.value ? {
  bg: '#0a0d12', surface: '#111621', surfaceAlt: '#161c2a',
  border: '#1e2536', text: '#e2e8f0', muted: '#64748b', dim: '#3e4a63',
  blue: '#3b82f6', orange: '#f97316', purple: '#a855f7', cyan: '#06b6d4', green: '#22c55e',
} : {
  bg: '#f8fafc', surface: '#ffffff', surfaceAlt: '#f1f5f9',
  border: '#e2e8f0', text: '#1e293b', muted: '#64748b', dim: '#94a3b8',
  blue: '#2563eb', orange: '#ea580c', purple: '#9333ea', cyan: '#0891b2', green: '#16a34a',
})

const STAGE_COLORS = computed(() => [C.value.blue, C.value.orange, C.value.purple, C.value.cyan, C.value.green])
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
        <span class="stage-meta">({{ st.capacity }}req/s, buf:{{ st.bufferMax }})</span>
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
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
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
