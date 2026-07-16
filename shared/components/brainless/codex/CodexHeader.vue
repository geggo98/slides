<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-header.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; monochrome launch
  card with model/directory rows kept faithful.
-->
<script setup lang="ts">
withDefaults(
  defineProps<{ version?: string; model?: string; directory?: string }>(),
  {
    version: "v0.132.0",
    model: "gpt-5.6-sol low",
    directory: "~/dev/brainless",
  },
);
</script>

<template>
  <div class="cxh-root">
    <div class="cxh-title">
      <span aria-hidden="true" class="cxh-dim">&gt;_</span>
      <span class="cxh-name">OpenAI Codex</span>
      <span class="cxh-dim">({{ version }})</span>
    </div>
    <div class="cxh-grid">
      <span class="cxh-dim">model:</span>
      <span class="cxh-value">
        {{ model }}
        <span class="cxh-accent">/model</span>
        <span class="cxh-dim">to change</span>
      </span>
      <span class="cxh-dim">directory:</span>
      <span class="cxh-dir">{{ directory }}</span>
    </div>
  </div>
</template>

<style scoped>
.cxh-root {
  min-width: 0;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 12px 16px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.7;
  color: #ededed;
}
.cxh-title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
}
.cxh-name {
  font-weight: 500;
}
.cxh-dim {
  color: #7a7a7a;
}
.cxh-grid {
  margin-top: 8px;
  display: grid;
  min-width: 0;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 12px;
}
.cxh-value {
  min-width: 0;
  overflow-wrap: break-word;
}
.cxh-accent {
  margin-left: 12px;
  color: #5cc2e0;
}
.cxh-accent + .cxh-dim {
  margin-left: 4px;
}
.cxh-dir {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
