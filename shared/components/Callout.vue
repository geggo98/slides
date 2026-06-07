<script setup lang="ts">
/**
 * Left-accent callout — replaces the repeated inline markdown soup
 *
 *   <div class="mt-4 px-4 py-2 text-sm border-l-4 border-amber-500 bg-amber-500/10 rounded">
 *
 * with `<Callout tone="warning">`. Tone → Tailwind-500 accent (the exact
 * colours the inline divs used), tinted at 10% so it reads on both light and
 * dark — a visual no-op. Structural styles (padding, font-size, radius) live
 * in scoped CSS; per-instance *margins* are preserved by passing the old
 * utility classes through, e.g. `<Callout tone="danger" class="mt-2">`
 * (Vue forwards `class` to the root element).
 *
 * Tone map mirrors the inline usage: amber→warning, red→danger, blue→info,
 * green→success. `dense` reproduces `py-1` instead of the default `py-2`.
 *
 * Used in markdown, so each deck registers it globally in setup/main.ts:
 *   app.component("Callout", Callout)
 */
withDefaults(
  defineProps<{
    tone?: "info" | "success" | "warning" | "danger";
    dense?: boolean;
  }>(),
  { tone: "info", dense: false },
);
</script>

<template>
  <div class="sk-callout" :class="[`tone-${tone}`, { dense }]">
    <slot />
  </div>
</template>

<style scoped>
.sk-callout {
  border-left: 4px solid; /* border-l-4; color set per tone below */
  padding: 0.5rem 1rem; /* py-2 px-4 */
  font-size: 0.875rem; /* text-sm */
  line-height: 1.25rem;
  border-radius: 0.25rem; /* rounded */
}
.sk-callout.dense {
  padding-top: 0.25rem; /* py-1 */
  padding-bottom: 0.25rem;
}
/* Tailwind-500 accents at 10% tint — matches the previous inline divs. */
.tone-info {
  border-left-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}
.tone-success {
  border-left-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}
.tone-warning {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}
.tone-danger {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
</style>
