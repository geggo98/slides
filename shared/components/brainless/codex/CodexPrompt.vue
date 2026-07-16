<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-prompt.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; the gray input
  surface (user_message_bg #353535), status row and plan-mode model swap are
  kept. Controlled value → defineModel; onKeyDown → `keydown` emit.
-->
<script setup lang="ts">
import { computed } from "vue";

export type CodexMode = "default" | "plan";

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    mode?: CodexMode;
    model?: string;
    directory?: string;
  }>(),
  {
    placeholder: "Use /skills to list available skills",
    mode: "default",
    model: "gpt-5.6-sol low",
    directory: "~/dev/brainless",
  },
);

const emit = defineEmits<{ keydown: [event: KeyboardEvent] }>();

const value = defineModel<string>({ default: "" });

const displayModel = computed(() =>
  props.mode === "plan" && props.model.includes(" low")
    ? props.model.replace(" low", " medium")
    : props.model,
);
</script>

<template>
  <div class="cxpr-root">
    <div class="cxpr-surface">
      <div class="cxpr-line">
        <span aria-hidden="true" class="cxpr-marker">›</span>
        <input
          v-model="value"
          type="text"
          aria-label="Prompt"
          :placeholder="placeholder"
          class="cxpr-input"
          @keydown="emit('keydown', $event)"
        />
      </div>
    </div>

    <div class="cxpr-status">
      <span class="cxpr-status-main">
        <span class="cxpr-model">{{ displayModel }}</span>
        <span class="cxpr-dim"> · </span>
        <span class="cxpr-cwd">{{ directory }}</span>
      </span>
      <span v-if="mode === 'plan'" class="cxpr-plan"
        >Plan mode (shift+tab to cycle)</span
      >
    </div>
  </div>
</template>

<style scoped>
.cxpr-root {
  min-width: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
}
/* Codex user_message_bg: white blended at 12% over --term-bg #1a1a1a. */
.cxpr-surface {
  min-width: 0;
  padding-block: 1lh;
  padding-right: 1ch;
  background: #353535;
  color: #ededed;
}
.cxpr-line {
  display: flex;
  min-width: 0;
  align-items: center;
}
.cxpr-marker {
  display: inline-block;
  width: 2ch;
  flex-shrink: 0;
  font-weight: 700;
}
.cxpr-input {
  min-width: 0;
  flex: 1 1 0%;
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  font: inherit;
  color: #ededed;
  caret-color: #ededed;
}
.cxpr-input::placeholder {
  color: #7a7a7a;
}
.cxpr-status {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 12px;
  padding-left: 2ch;
  font-size: 12px;
}
.cxpr-status-main {
  min-width: 0;
  overflow-wrap: break-word;
}
.cxpr-model {
  color: #f6e2b7;
}
.cxpr-dim {
  color: #7a7a7a;
}
.cxpr-cwd {
  color: #abdfa7;
}
.cxpr-plan {
  margin-left: auto;
  color: #bb9af7;
}
</style>
