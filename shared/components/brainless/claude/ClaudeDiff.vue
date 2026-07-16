<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-diff.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; tinted diff rows and
  the off-screen added/removed labels are kept.
-->
<script setup lang="ts">
export interface DiffLine {
  type: "add" | "del" | "ctx";
  n?: number;
  text: string;
}

withDefaults(
  defineProps<{ file: string; summary?: string; lines: DiffLine[] }>(),
  {
    summary: undefined,
  },
);

const ROW_BG = {
  add: "rgba(78, 169, 111, .10)",
  del: "rgba(247, 118, 142, .12)",
  ctx: "transparent",
} as const;
const MARK = { add: "+", del: "-", ctx: " " } as const;
const MARK_COLOR = { add: "#4ea96f", del: "#f7768e", ctx: "#565f89" } as const;
</script>

<template>
  <div class="cd-root">
    <div class="cd-head">
      <span aria-hidden="true" class="cd-dot">⏺</span>
      <span class="cd-fg">Update</span>
      <span class="cd-file">
        <span class="cd-punct">(</span><span class="cd-path">{{ file }}</span
        ><span class="cd-punct">)</span>
      </span>
    </div>
    <div v-if="summary" class="cd-summary">
      <!-- invisible status glyph spacer: aligns ⎿ under "Update" -->
      <span aria-hidden="true" class="cd-spacer">⏺</span>
      <span aria-hidden="true" class="cd-elbow">⎿</span>
      <span class="cd-summary-text">{{ summary }}</span>
    </div>

    <!-- Kein <pre> als Container: Vue erhält dort Template-Whitespace, der in
         den Flex-Rows zu Riesenzeilen würde — pre-Whitespace gilt nur im Text-Span. -->
    <div class="cd-pre">
      <div
        v-for="(l, i) in lines"
        :key="i"
        class="cd-row"
        :style="{ background: ROW_BG[l.type] }"
      >
        <span class="cd-num">{{ l.n ?? "" }}</span>
        <span class="cd-mark" :style="{ color: MARK_COLOR[l.type] }">{{
          MARK[l.type]
        }}</span>
        <span
          class="cd-text"
          :style="{ color: l.type === 'ctx' ? '#8b8fa3' : '#c0caf5' }"
          ><span v-if="l.type !== 'ctx'" class="sr-only">{{
            l.type === "add" ? "added: " : "removed: "
          }}</span
          >{{ l.text }}</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-root {
  min-width: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.55;
}
.cd-head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
}
.cd-dot {
  flex-shrink: 0;
  color: #4ea96f;
}
.cd-fg {
  color: #c0caf5;
}
.cd-file {
  min-width: 0;
  word-break: break-all;
}
.cd-punct {
  color: #565f89;
}
.cd-path {
  color: #7dcfff;
}
.cd-summary {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
  color: #8b8fa3;
}
.cd-spacer {
  visibility: hidden;
  flex-shrink: 0;
}
.cd-elbow {
  flex-shrink: 0;
  color: #565f89;
}
.cd-summary-text {
  min-width: 0;
  overflow-wrap: break-word;
}
.cd-pre {
  margin: 4px 0 0;
  min-width: 0;
  overflow-x: auto;
  border: 1px solid #202022;
  background: #101010;
  padding: 6px 12px 6px 8px;
}
.cd-row {
  display: flex;
  min-width: 0;
}
.cd-num {
  width: 36px;
  flex-shrink: 0;
  user-select: none;
  padding-right: 8px;
  text-align: right;
  color: #3b3f52;
}
.cd-mark {
  width: 12px;
  flex-shrink: 0;
  user-select: none;
}
.cd-text {
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
