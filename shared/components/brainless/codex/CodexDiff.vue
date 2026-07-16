<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-diff.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; the `/diff` pager
  grammar (slash-padded D I F F bar, vim ~ fillers, % footer) is kept.
-->
<script setup lang="ts">
import { computed } from "vue";

export interface CodexDiffLine {
  type: "meta" | "hunk" | "add" | "del" | "ctx" | "fill";
  text: string;
}

const props = withDefaults(
  defineProps<{
    lines?: CodexDiffLine[];
    percent?: number;
    fillRows?: number;
  }>(),
  {
    lines: () => [
      { type: "meta", text: "diff --git a/scratch.txt b/scratch.txt" },
      { type: "meta", text: "index e382994..401fe17 100644" },
      { type: "meta", text: "--- a/scratch.txt" },
      { type: "meta", text: "+++ b/scratch.txt" },
      { type: "hunk", text: "@@ -1 +1 @@" },
      { type: "del", text: "-hello scratch" },
      { type: "add", text: "+hello scratch edited" },
    ],
    percent: 100,
    fillRows: 8,
  },
);

const LINE_COLOR: Record<CodexDiffLine["type"], string> = {
  add: "#abdfa7",
  del: "#f2a0a0",
  hunk: "#f6e2b7",
  fill: "#7a7a7a",
  meta: "#ededed",
  ctx: "#ededed",
};

function titleBar(cols = 80) {
  const label = "D I F F";
  const inner = `/ ${label} ${"/ ".repeat(40)}`.trimEnd();
  return (inner + " /".repeat(cols)).slice(0, cols);
}
const bar = titleBar(88);

const body = computed(() => [
  ...props.lines,
  ...Array.from({ length: props.fillRows }, () => ({
    type: "fill" as const,
    text: "~",
  })),
]);
</script>

<template>
  <div class="cxd-root" role="region" aria-label="Diff pager">
    <div class="cxd-bar">{{ bar }}</div>

    <!-- Kein <pre> als Container: Vue erhält dort Template-Whitespace als
         echte Einrückung — pre-Whitespace gilt nur im Text-Span je Zeile. -->
    <div class="cxd-pre">
      <div
        v-for="(l, i) in body"
        :key="i"
        :style="{ color: LINE_COLOR[l.type] }"
      >
        <span v-if="l.type === 'add'" class="sr-only">added: </span>
        <span v-else-if="l.type === 'del'" class="sr-only">removed: </span>
        <span class="cxd-line-text">{{ l.text }}</span>
      </div>
    </div>

    <div class="cxd-footer">
      <div class="cxd-percent">{{ percent }}%</div>
      <div class="cxd-hints">
        ↑/↓ to scroll · pgup/pgdn to page · home/end to jump
      </div>
      <div><kbd class="cxd-kbd">q</kbd> to quit</div>
    </div>
  </div>
</template>

<style scoped>
.cxd-root {
  overflow: hidden;
  border: 1px solid #2a2a2a;
  border-radius: 0;
  background: #1a1a1a;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.45;
}
.cxd-bar {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 8px;
  font-size: 12px;
  letter-spacing: 0.025em;
  color: #7a7a7a;
  background: #121212;
}
.cxd-pre {
  margin: 0;
  overflow-x: auto;
  padding: 6px 8px;
}
.cxd-line-text {
  white-space: pre;
}
.cxd-footer {
  border-top: 1px solid #2a2a2a;
  padding: 4px 8px;
  font-size: 12px;
  color: #7a7a7a;
}
.cxd-percent {
  display: flex;
  justify-content: flex-end;
}
.cxd-hints {
  margin-top: 2px;
}
.cxd-kbd {
  font-family: inherit;
  font-weight: 600;
  color: #ededed;
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
