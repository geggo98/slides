<script setup>
/**
 * PipelineViz.vue — Static pipeline visualization showing stages with capacity and buffer sizes.
 * Props: stages — Array of { name, capacity, bufferMax }
 */

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

const C = {
  bg: '#0a0d12', surface: '#111621', surfaceAlt: '#161c2a',
  border: '#1e2536', text: '#e2e8f0', muted: '#64748b', dim: '#3e4a63',
  blue: '#3b82f6', orange: '#f97316', purple: '#a855f7', cyan: '#06b6d4', green: '#22c55e',
}

const STAGE_COLORS = [C.blue, C.orange, C.purple, C.cyan, C.green]
</script>

<template>
  <div class="pipeline-viz">
    <div class="pipeline-node input-node">
      Input
    </div>
    <template v-for="(st, i) in props.stages" :key="i">
      <span class="arrow">&#8594;</span>
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
.input-node {
  background: rgba(34, 197, 94, 0.07);
  border-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}
.arrow {
  color: #3e4a63;
  font-size: 16px;
}
.stage-meta {
  opacity: 0.6;
}
</style>
