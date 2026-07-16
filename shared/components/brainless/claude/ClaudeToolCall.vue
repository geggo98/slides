<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-tool-call.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; the real <details>
  disclosure and the exact ⏺ / ⎿ visual grammar are kept.
-->
<script setup lang="ts">
import { computed, useSlots } from "vue";

withDefaults(
  defineProps<{
    tool: string;
    arg?: string;
    result: string;
    status?: "success" | "error" | "pending";
    defaultOpen?: boolean;
  }>(),
  { status: "success", defaultOpen: false, arg: undefined },
);

const STATUS_COLOR = {
  success: "#4ea96f",
  error: "#f7768e",
  pending: "#e0af68",
} as const;

const slots = useSlots();
const expandable = computed(() => Boolean(slots.default));
</script>

<template>
  <details class="tc-root" :open="defaultOpen">
    <summary
      class="tc-summary"
      :class="expandable ? 'tc-pointer' : 'tc-default'"
    >
      <span class="tc-line">
        <span
          aria-hidden="true"
          class="tc-dot"
          :style="{ color: STATUS_COLOR[status] }"
          >⏺</span
        >
        <span class="tc-name">
          <span class="tc-fg">{{ tool }}</span>
          <template v-if="arg !== undefined">
            <span class="tc-punct">(</span><span class="tc-arg">{{ arg }}</span
            ><span class="tc-punct">)</span>
          </template>
        </span>
      </span>
      <span class="tc-line tc-result">
        <!-- invisible status glyph spacer: aligns ⎿ under the tool name -->
        <span aria-hidden="true" class="tc-spacer">⏺</span>
        <span class="tc-line">
          <span aria-hidden="true" class="tc-elbow">⎿</span>
          <span class="tc-text">
            {{ result }}
            <span v-if="expandable" class="tc-hint">(ctrl+o to expand)</span>
          </span>
        </span>
      </span>
    </summary>

    <div v-if="expandable" class="tc-body"><slot /></div>
  </details>
</template>

<style scoped>
.tc-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.55;
}
.tc-summary {
  list-style: none;
  border-radius: 0;
  outline: none;
}
.tc-summary::-webkit-details-marker {
  display: none;
}
.tc-summary:focus-visible {
  box-shadow: 0 0 0 1px rgba(125, 207, 255, 0.6);
}
.tc-pointer {
  cursor: pointer;
}
.tc-default {
  cursor: default;
}
.tc-line {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}
.tc-dot {
  flex-shrink: 0;
}
.tc-name {
  min-width: 0;
  overflow-wrap: break-word;
}
.tc-fg {
  color: #c0caf5;
}
.tc-punct {
  color: #565f89;
}
.tc-arg {
  color: #7dcfff;
}
.tc-result {
  color: #8b8fa3;
}
.tc-spacer {
  visibility: hidden;
  flex-shrink: 0;
}
.tc-elbow {
  flex-shrink: 0;
  color: #565f89;
}
.tc-text {
  min-width: 0;
  overflow-wrap: break-word;
}
.tc-hint {
  margin-left: 8px;
  color: #565f89;
}
details[open] .tc-hint {
  display: none;
}
.tc-body {
  margin-top: 4px;
  white-space: pre-wrap;
  padding-left: 32px;
  color: #8b8fa3;
}
</style>
