<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-exec.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; the real <details>
  disclosure and the • / ▸ grammar are kept.
-->
<script setup lang="ts">
import { computed, useSlots } from "vue";

withDefaults(
  defineProps<{
    command: string;
    result?: string;
    status?: "ok" | "error" | "run";
    defaultOpen?: boolean;
  }>(),
  { status: "ok", defaultOpen: false, result: undefined },
);

const DOT = { ok: "#4ea96f", error: "#f7768e", run: "#e0af68" } as const;

const slots = useSlots();
const expandable = computed(() => Boolean(slots.default));
</script>

<template>
  <details class="cxe-root" :open="defaultOpen">
    <summary
      class="cxe-summary"
      :class="expandable ? 'cxe-pointer' : 'cxe-default'"
    >
      <span aria-hidden="true" class="cxe-dot" :style="{ color: DOT[status] }"
        >•</span
      >
      <span class="cxe-command">{{ command }}</span>
      <span v-if="result" class="cxe-result">{{ result }}</span>
      <span v-if="expandable" class="cxe-hint">▸</span>
    </summary>
    <pre v-if="expandable" class="cxe-body"><slot /></pre>
  </details>
</template>

<style scoped>
.cxe-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.55;
}
.cxe-summary {
  display: flex;
  min-width: 0;
  list-style: none;
  align-items: baseline;
  /* Port deviation: upstream assumes short results ("(3 files)") and pins them
     with shrink-0 — long results would crush the command to one char per line.
     flex-wrap lets a long result drop to its own row instead. */
  flex-wrap: wrap;
  gap: 0 8px;
  outline: none;
}
.cxe-summary::-webkit-details-marker {
  display: none;
}
.cxe-summary:focus-visible {
  box-shadow: 0 0 0 1px rgba(92, 194, 224, 0.6);
}
.cxe-pointer {
  cursor: pointer;
}
.cxe-default {
  cursor: default;
}
.cxe-dot {
  flex-shrink: 0;
}
.cxe-command {
  min-width: 0;
  flex: 0 1 auto;
  overflow-wrap: break-word;
  color: #5cc2e0;
}
.cxe-result {
  min-width: 0;
  flex: 0 1 auto;
  overflow-wrap: break-word;
  color: #7a7a7a;
}
.cxe-hint {
  flex-shrink: 0;
  color: #565656;
}
details[open] .cxe-hint {
  display: none;
}
.cxe-body {
  margin: 4px 0 0;
  overflow-x: auto;
  white-space: pre-wrap;
  padding-left: 16px;
  color: #8a8a8a;
  font: inherit;
  line-height: inherit;
}
</style>
