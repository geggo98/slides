<script setup lang="ts">
import type { LaidOutGroup, LaidOutPillar } from "./componentMapData";

const props = defineProps<{
  pillar: LaidOutPillar;
  level: number;
}>();

const emit = defineEmits<{ zoom: [id: string] }>();

/** Farbklasse: Fehler/Prozess/Varianten haben Vorrang, sonst Richtung. */
function tone(g: LaidOutGroup): string {
  if (g.category === "error") return "danger";
  if (g.category === "process") return "warning";
  if (g.category === "variant") return "variant";
  if (g.direction === "in") return "dir-in";
  if (g.direction === "out") return "dir-out";
  return "neutral";
}

function onGroupClick(g: LaidOutGroup) {
  if (props.level >= 2 && g.detailId) emit("zoom", g.detailId);
}
</script>

<template>
  <g
    class="pillar"
    :class="{ core: pillar.kind === 'core' }"
    :data-pillar-id="pillar.id"
  >
    <rect
      class="pillar-box"
      :x="pillar.rect.x"
      :y="pillar.rect.y"
      :width="pillar.rect.w"
      :height="pillar.rect.h"
      rx="8"
      @click.stop="emit('zoom', `pillar:${pillar.id}`)"
    />
    <text class="title" :x="pillar.rect.x + 10" :y="pillar.rect.y + 16">
      {{ pillar.label }}
    </text>
    <text
      v-if="pillar.norm"
      class="norm"
      :x="pillar.rect.x + pillar.rect.w - 10"
      :y="pillar.rect.y + 15"
      text-anchor="end"
    >
      {{ pillar.norm }}
    </text>
    <text class="stats" :x="pillar.rect.x + 10" :y="pillar.rect.y + 28">
      {{ pillar.stats.join(" · ") }}
    </text>

    <g
      v-for="g in pillar.groups"
      :key="g.id"
      class="group"
      :class="[tone(g), { clickable: level >= 2 && g.detailId }]"
      :data-group-id="g.id"
    >
      <rect
        class="group-box"
        :x="g.rect.x"
        :y="g.rect.y"
        :width="g.rect.w"
        :height="g.rect.h"
        rx="4"
        :style="{ pointerEvents: level >= 2 ? 'auto' : 'none' }"
        @click.stop="onGroupClick(g)"
      />
      <text
        class="group-label lod"
        :class="{ visible: level >= 2 }"
        :x="g.rect.x + 5"
        :y="g.rect.y + g.rect.h * 0.42"
      >
        {{ g.label }}
      </text>
      <text
        v-if="g.note"
        class="group-note lod"
        :class="{ visible: level >= 2 }"
        :x="g.rect.x + 5"
        :y="g.rect.y + g.rect.h * 0.78"
      >
        {{ g.note }}
      </text>
      <g
        v-if="g.detailId"
        class="lens lod"
        :class="{ visible: level >= 2 }"
        aria-hidden="true"
      >
        <circle :cx="g.rect.x + g.rect.w - 8" :cy="g.rect.y + 7" r="2.6" />
        <line
          :x1="g.rect.x + g.rect.w - 6.2"
          :y1="g.rect.y + 8.8"
          :x2="g.rect.x + g.rect.w - 4.4"
          :y2="g.rect.y + 10.6"
        />
      </g>
    </g>
  </g>
</template>

<style scoped>
.pillar-box {
  fill: var(--color-background-secondary);
  stroke: var(--color-border-secondary);
  stroke-width: 0.8;
  cursor: pointer;
}
.pillar-box:hover {
  stroke: var(--color-border-primary);
}
.core .pillar-box {
  fill: var(--color-background-tertiary);
  stroke-dasharray: 5 3;
}
.title {
  font-size: 13px;
  font-weight: 600;
  fill: var(--color-text-primary);
  pointer-events: none;
}
.norm {
  font-size: 7px;
  fill: var(--color-text-tertiary);
  pointer-events: none;
}
.stats {
  font-size: 7.5px;
  fill: var(--color-text-secondary);
  pointer-events: none;
}
.group-box {
  fill: var(--color-background-primary);
  stroke: var(--color-border-tertiary);
  stroke-width: 0.6;
}
.dir-in .group-box {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
.dir-out .group-box {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
}
.neutral .group-box {
  fill: var(--color-background-primary);
  stroke: var(--color-border-secondary);
}
.warning .group-box {
  fill: var(--color-background-warning);
  stroke: var(--color-border-warning);
}
.danger .group-box {
  fill: var(--color-background-danger);
  stroke: var(--color-border-danger);
}
.variant .group-box {
  fill: color-mix(
    in srgb,
    var(--color-background-info) 45%,
    var(--color-background-primary) 55%
  );
  stroke: var(--color-border-info);
  stroke-dasharray: 3 2;
}
.group.clickable .group-box {
  cursor: pointer;
}
.group.clickable .group-box:hover {
  stroke-width: 1.4;
}
.group-label {
  font-size: 7px;
  font-weight: 600;
  fill: var(--color-text-primary);
  pointer-events: none;
}
.group-note {
  font-size: 5.6px;
  fill: var(--color-text-secondary);
  pointer-events: none;
}
.lens circle {
  fill: none;
  stroke: var(--color-text-tertiary);
  stroke-width: 0.9;
}
.lens line {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.9;
  stroke-linecap: round;
}
.lod {
  opacity: 0;
  transition: opacity 400ms ease;
}
.lod.visible {
  opacity: 1;
}
</style>
