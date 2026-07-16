<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-header.tsx (ClaudeHeader export)
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; the <fieldset>/<legend>
  title-in-border semantics are kept. Port addition: a `compact` prop that drops
  the tips/what's-new column so the header fits a 980×552 slide canvas.
-->
<script setup lang="ts">
import ClaudeLogo from "./ClaudeLogo.vue";

withDefaults(
  defineProps<{
    version?: string;
    user?: string;
    model?: string;
    org?: string;
    cwd?: string;
    tips?: string[];
    whatsNew?: string[];
    compact?: boolean;
  }>(),
  {
    version: "v2.1.206",
    user: "Ben",
    model: "Fable 5 with xhigh effort · Claude Max",
    org: "ben@freestyle.sh's Organization",
    cwd: "~/dev/brainless",
    tips: () => ["Ask Claude to create a new app or clone a repo"],
    whatsNew: () => [
      "Added directory path suggestions to /cd",
      "Added a /doctor check that proposes trims",
    ],
    compact: false,
  },
);
</script>

<template>
  <fieldset class="ch-root" :class="{ 'ch-root--compact': compact }">
    <legend class="ch-legend">
      Claude Code <span class="ch-gray">{{ version }}</span>
    </legend>

    <div class="ch-grid">
      <!-- left: identity -->
      <div class="ch-identity">
        <div class="ch-welcome">Welcome back {{ user }}!</div>
        <ClaudeLogo class="ch-logo" :scale="compact ? 3 : 4" />
        <div class="ch-meta">
          <div>{{ model }}</div>
          <div>{{ org }}</div>
          <div>{{ cwd }}</div>
        </div>
      </div>

      <div v-if="!compact" aria-hidden="true" class="ch-divider" />

      <!-- right: tips + what's new -->
      <div v-if="!compact" class="ch-tips">
        <div class="ch-rose ch-bold">Tips for getting started</div>
        <div v-for="t in tips" :key="t" class="ch-line">{{ t }}</div>
        <div class="ch-rule" />
        <div class="ch-rose ch-bold">What's new</div>
        <div v-for="t in whatsNew" :key="t" class="ch-line">{{ t }}</div>
        <div class="ch-line ch-gray ch-italic">/release-notes for more</div>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.ch-root {
  min-width: 0;
  border: 1px solid #cd694a;
  border-radius: 6px;
  padding: 4px 16px 14px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.5;
  color: #c0caf5;
  margin: 0;
}
.ch-legend {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
  color: #cd694a;
}
.ch-gray {
  color: #949494;
}
.ch-rose {
  color: #cd694a;
}
.ch-bold {
  font-weight: 600;
}
.ch-italic {
  font-style: italic;
}
.ch-grid {
  display: grid;
  min-width: 0;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1.1fr);
}
.ch-root--compact .ch-grid {
  grid-template-columns: minmax(0, 1fr);
}
.ch-identity {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-block: 4px;
  text-align: center;
}
.ch-root--compact .ch-identity {
  gap: 4px;
  padding-block: 0;
}
.ch-welcome {
  font-weight: 600;
}
.ch-logo {
  margin-block: 6px;
}
.ch-root--compact .ch-logo {
  margin-block: 2px;
}
.ch-meta {
  min-width: 0;
  overflow-wrap: break-word;
  color: #949494;
}
.ch-meta > div + div {
  margin-top: 2px;
}
.ch-divider {
  background: #cd694a55;
}
.ch-tips {
  min-width: 0;
}
.ch-tips > * + * {
  margin-top: 4px;
}
.ch-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ch-rule {
  height: 1px;
  margin-block: 6px;
  background: #cd694a;
}
</style>
