/**
 * Ported from "brainless" — https://github.com/theswerd/brainless
 * Original: the `usePrefersReducedMotion` React hook duplicated in
 * registry/brainless/claude/claude-thinking.tsx and
 * registry/brainless/codex/codex-working.tsx (deduplicated here).
 * Copyright (c) 2026 Ben Swerdlow — MIT License (copy: ../LICENSE)
 */
import { onMounted, onUnmounted, ref } from "vue";

export function usePrefersReducedMotion() {
  const reduced = ref(false);
  let mq: MediaQueryList | undefined;
  const update = () => {
    reduced.value = mq?.matches ?? false;
  };
  onMounted(() => {
    mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    update();
    mq.addEventListener("change", update);
  });
  onUnmounted(() => mq?.removeEventListener("change", update));
  return reduced;
}
