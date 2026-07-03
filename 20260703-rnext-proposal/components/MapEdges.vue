<script setup lang="ts">
import type { MapEdge } from "./componentMapData";

// Kanten-Labels nur in der Übersicht (Ebene 1) — beim Zoomen ragen sie sonst
// abgeschnitten in die Säulen-Ansicht.
defineProps<{ edges: MapEdge[]; level: number }>();
</script>

<template>
  <g class="edges" aria-hidden="true">
    <defs>
      <marker
        id="cmapArrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path
          d="M2 1L8 5L2 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </marker>
    </defs>
    <g v-for="e in edges" :key="`${e.from}-${e.to}`" :class="e.kind">
      <line
        :x1="e.x1"
        :y1="e.y1"
        :x2="e.x2"
        :y2="e.y2"
        :marker-end="e.kind === 'flow' ? 'url(#cmapArrow)' : undefined"
      />
      <text
        v-if="e.label"
        :x="(e.x1 + e.x2) / 2"
        :y="(e.y1 + e.y2) / 2 - 5"
        text-anchor="middle"
        class="edge-label"
        :class="{ hidden: level > 1 }"
      >
        {{ e.label }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.edges {
  pointer-events: none;
}
.flow line {
  stroke: var(--color-text-secondary);
  stroke-width: 1.4;
  color: var(--color-text-secondary);
}
.reuse line {
  stroke: var(--color-border-secondary);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.edge-label {
  font-size: 7.5px;
  fill: var(--color-text-secondary);
  paint-order: stroke;
  stroke: var(--color-background-primary);
  stroke-width: 3;
  stroke-linejoin: round;
  transition: opacity 400ms ease;
}
.edge-label.hidden {
  opacity: 0;
}
</style>
