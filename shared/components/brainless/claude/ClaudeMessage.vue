<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-message.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS. Single root element
  with a class switch (instead of two conditional roots) so attribute
  fallthrough keeps working.
-->
<script setup lang="ts">
withDefaults(defineProps<{ role?: "user" | "assistant" }>(), {
  role: "assistant",
});
</script>

<template>
  <div class="cm-root" :class="role === 'user' ? 'cm-user' : 'cm-assistant'">
    <template v-if="role === 'user'">
      <span aria-hidden="true" class="cm-caret">❯</span>
      <!-- one terminal cell between caret and text — a trailing space inside
           a flex child collapses, so use an explicit width -->
      <span aria-hidden="true" class="cm-cell" />
      <span class="cm-text"><slot /></span>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<style scoped>
.cm-root {
  min-width: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
}
.cm-user {
  display: flex;
  width: 100%;
  align-items: baseline;
  line-height: 1.55;
  background: #3a3a3a;
}
.cm-assistant {
  line-height: 1.6;
  color: #c0caf5;
}
.cm-caret {
  flex-shrink: 0;
  color: #4e4e4e;
}
.cm-cell {
  flex-shrink: 0;
  display: inline-block;
  width: 1ch;
}
.cm-text {
  min-width: 0;
  flex: 1 1 0%;
  overflow-wrap: break-word;
  color: #ffffff;
}
</style>
