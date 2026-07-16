<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-message.tsx
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
  <div class="cxm-root" :class="role === 'user' ? 'cxm-user' : 'cxm-assistant'">
    <template v-if="role === 'user'">
      <span aria-hidden="true" class="cxm-marker">›</span>
      <span class="cxm-text"><slot /></span>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<style scoped>
.cxm-root {
  min-width: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
}
.cxm-user {
  display: flex;
  gap: 8px;
  color: #ededed;
}
.cxm-assistant {
  color: #c9c9c9;
}
.cxm-marker {
  flex-shrink: 0;
  font-weight: 700;
}
.cxm-text {
  min-width: 0;
  flex: 1 1 0%;
  overflow-wrap: break-word;
}
</style>
