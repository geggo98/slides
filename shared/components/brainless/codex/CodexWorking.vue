<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-working.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; grayscale shimmer
  keyframes and reduced-motion fallback kept faithful.
-->
<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { usePrefersReducedMotion } from "../lib/usePrefersReducedMotion";

const props = withDefaults(
  defineProps<{ running?: boolean; label?: string }>(),
  {
    running: true,
    label: "Working",
  },
);

const prefersReduced = usePrefersReducedMotion();
const secs = ref(0);

let timer: ReturnType<typeof setInterval> | undefined;
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
watch(
  () => props.running,
  (running) => {
    stopTimer();
    if (running) timer = setInterval(() => (secs.value += 1), 1000);
  },
  { immediate: true },
);
onUnmounted(stopTimer);
</script>

<template>
  <div v-if="running" role="status" aria-live="polite" class="cxw-root">
    <span aria-hidden="true" class="cxw-bullet">•</span>
    <span :class="prefersReduced ? 'cxw-static' : 'cxw-shimmer'">{{
      label
    }}</span>
    <span class="cxw-dim">({{ secs }}s • esc to interrupt)</span>
  </div>
</template>

<style scoped>
.cxw-root {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  font-weight: 700;
}
.cxw-bullet {
  color: #a7a7a7;
}
.cxw-dim {
  font-weight: 400;
  color: #7a7a7a;
}
.cxw-static {
  color: #e7e7e7;
}
.cxw-shimmer {
  background-image: linear-gradient(
    90deg,
    #808080 0%,
    #808080 40%,
    #e7e7e7 50%,
    #808080 60%,
    #808080 100%
  );
  /* 200% size + 100%→−100% travel = one clean period (no loop hitch) */
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: cxw-shine 1.6s linear infinite;
}
@keyframes cxw-shine {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cxw-shimmer {
    animation: none;
    background-image: none;
    color: #e7e7e7;
    -webkit-text-fill-color: #e7e7e7;
  }
}
</style>
