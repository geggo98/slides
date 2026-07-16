<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-thinking.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; glyph cycle, verb
  rotation, shimmer keyframes and reduced-motion fallback kept faithful.
-->
<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { usePrefersReducedMotion } from "../lib/usePrefersReducedMotion";

const props = withDefaults(
  defineProps<{ running?: boolean; verbs?: string[]; showTokens?: boolean }>(),
  {
    running: true,
    verbs: () => [
      "Thinking",
      "Levitating",
      "Schlepping",
      "Herding",
      "Percolating",
      "Noodling",
      "Conjuring",
    ],
    showTokens: true,
  },
);

// Captured cycle from claude/thinking frames: · ✢ ✳ ✶ ✻ ✽ ✻ ✶ ✳ ✢
const GLYPHS = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];

const prefersReduced = usePrefersReducedMotion();
const glyph = ref(0);
const verbIdx = ref(0);
const secs = ref(0);

let timers: ReturnType<typeof setInterval>[] = [];
function stopTimers() {
  timers.forEach(clearInterval);
  timers = [];
}
function armTimers() {
  stopTimers();
  if (!props.running) return;
  if (!prefersReduced.value) {
    timers.push(
      setInterval(() => (glyph.value = (glyph.value + 1) % GLYPHS.length), 110),
    );
  }
  timers.push(setInterval(() => (secs.value += 1), 1000));
  // Verbs change slowly, like the real thing — not every second.
  timers.push(
    setInterval(
      () => (verbIdx.value = (verbIdx.value + 1) % props.verbs.length),
      5200,
    ),
  );
}
watch([() => props.running, prefersReduced], armTimers, { immediate: true });
onUnmounted(stopTimers);
</script>

<template>
  <div v-if="running" role="status" aria-live="polite" class="cw-root">
    <span aria-hidden="true" class="cw-glyph">{{
      prefersReduced ? "✳" : GLYPHS[glyph]
    }}</span>
    <span class="cw-verb">{{ verbs[verbIdx % verbs.length] }}…</span>
    <span class="cw-dim"
      >({{ secs }}s{{
        showTokens ? ` · ↑ ${Math.max(0, secs * 137)} tokens` : ""
      }}
      · esc to interrupt)</span
    >
  </div>
</template>

<style scoped>
.cw-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cw-glyph {
  color: #cd694a;
  width: 1ch;
  display: inline-block;
}
.cw-dim {
  color: #7d7d7d;
}
/* The verb carries Claude's understated shimmer: a lighter highlight drifts
   across the terracotta word (background-clip: text keeps the DOM text
   selectable and announced). */
.cw-verb {
  background-image: linear-gradient(
    100deg,
    #cd694a 43%,
    #e79475 50%,
    #cd694a 57%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: cw-shine 2.8s linear infinite;
}
@keyframes cw-shine {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cw-verb {
    animation: none;
    background-image: none;
    color: #cd694a;
    -webkit-text-fill-color: #cd694a;
  }
}
</style>
