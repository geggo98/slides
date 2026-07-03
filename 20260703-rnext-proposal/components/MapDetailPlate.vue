<script setup lang="ts">
import { computed } from "vue";
import type { AttrGroup, DetailPlate, Rect } from "./componentMapData";

const props = defineProps<{
  plate: DetailPlate;
  active: boolean;
}>();

interface Column {
  key: "in" | "shared" | "out";
  group: AttrGroup;
  rect: Rect;
}

const PAD = 10;
const TITLE_H = 20;
const COL_GAP = 8;

const columns = computed<Column[]>(() => {
  const r = props.plate.rect;
  const footH = props.plate.footnote ? 16 : 0;
  const inner: Rect = {
    x: r.x + PAD,
    y: r.y + TITLE_H + 4,
    w: r.w - 2 * PAD,
    h: r.h - TITLE_H - 4 - PAD - footH,
  };
  const colW = (inner.w - 2 * COL_GAP) / 3;
  const groups: Array<[Column["key"], AttrGroup]> = [
    ["in", props.plate.inAttrs],
    ["shared", props.plate.sharedAttrs],
    ["out", props.plate.outAttrs],
  ];
  return groups.map(([key, group], i) => ({
    key,
    group,
    rect: {
      x: inner.x + i * (colW + COL_GAP),
      y: inner.y,
      w: colW,
      h: inner.h,
    },
  }));
});
</script>

<template>
  <g class="plate" :class="{ active }">
    <rect
      class="plate-box"
      :x="plate.rect.x"
      :y="plate.rect.y"
      :width="plate.rect.w"
      :height="plate.rect.h"
      rx="8"
    />
    <text class="title" :x="plate.rect.x + PAD" :y="plate.rect.y + 14">
      {{ plate.title }}
    </text>

    <g v-for="col in columns" :key="col.key" class="col" :class="col.key">
      <rect
        class="col-box"
        :x="col.rect.x"
        :y="col.rect.y"
        :width="col.rect.w"
        :height="col.rect.h"
        rx="5"
      />
      <text class="col-head" :x="col.rect.x + 6" :y="col.rect.y + 12">
        {{ col.group.label }}
      </text>
      <text
        v-if="col.group.note"
        class="col-note"
        :x="col.rect.x + 6"
        :y="col.rect.y + 21"
      >
        {{ col.group.note }}
      </text>
      <text
        v-for="(attr, i) in col.group.attrs"
        :key="attr"
        class="attr"
        :x="col.rect.x + 6"
        :y="col.rect.y + 33 + i * 11"
      >
        – {{ attr }}
      </text>
    </g>

    <text
      v-if="plate.footnote"
      class="footnote"
      :x="plate.rect.x + PAD"
      :y="plate.rect.y + plate.rect.h - 7"
    >
      {{ plate.footnote }}
    </text>
  </g>
</template>

<style scoped>
.plate {
  pointer-events: none;
}
.plate-box {
  fill: var(--color-background-secondary);
  stroke: var(--color-border-tertiary);
  stroke-width: 0.8;
}
.plate.active .plate-box {
  stroke: var(--color-border-primary);
}
.title {
  font-size: 11px;
  font-weight: 600;
  fill: var(--color-text-primary);
}
.col-box {
  fill: var(--color-background-primary);
  stroke: var(--color-border-secondary);
  stroke-width: 0.6;
}
.col.in .col-box {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
.col.out .col-box {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
}
.col-head {
  font-size: 8px;
  font-weight: 600;
  fill: var(--color-text-primary);
}
.col.in .col-head {
  fill: var(--color-text-info);
}
.col.out .col-head {
  fill: var(--color-text-success);
}
.col-note {
  font-size: 5.6px;
  fill: var(--color-text-secondary);
  font-style: italic;
}
.attr {
  font-size: 6.8px;
  fill: var(--color-text-primary);
}
.footnote {
  font-size: 6.2px;
  font-style: italic;
  fill: var(--color-text-secondary);
}
</style>
