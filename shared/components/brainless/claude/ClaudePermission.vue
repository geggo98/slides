<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-permission.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; the keyboard-driven
  radiogroup semantics are kept; onChoose → `choose` emit.
-->
<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    command?: string;
    question?: string;
    options?: string[];
    defaultSelected?: number;
  }>(),
  {
    title: "Bash command",
    command: "rm -rf node_modules",
    question: "Do you want to proceed?",
    options: () => [
      "Yes",
      "Yes, and don't ask again this session",
      "No, and tell Claude what to do (esc)",
    ],
    defaultSelected: 0,
  },
);

const emit = defineEmits<{ choose: [index: number] }>();

const sel = ref(props.defaultSelected);

function choose(i: number) {
  sel.value = i;
  emit("choose", i);
}

function onKey(e: KeyboardEvent, i: number) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const next =
      e.key === "ArrowDown"
        ? (i + 1) % props.options.length
        : (i - 1 + props.options.length) % props.options.length;
    sel.value = next;
    const el = (e.currentTarget as HTMLElement).parentElement?.children[
      next
    ] as HTMLElement | undefined;
    el?.focus();
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    choose(i);
  }
}
</script>

<template>
  <fieldset class="cp-root">
    <legend class="cp-legend">{{ title }}</legend>
    <div class="cp-fg">{{ command }}</div>
    <div class="cp-fg cp-question">{{ question }}</div>
    <div role="radiogroup" :aria-label="question">
      <div
        v-for="(opt, i) in options"
        :key="i"
        role="radio"
        :aria-checked="sel === i"
        :tabindex="sel === i ? 0 : -1"
        class="cp-option"
        :class="{ 'cp-option--active': sel === i }"
        @keydown="onKey($event, i)"
        @click="choose(i)"
      >
        <span
          aria-hidden="true"
          class="cp-caret"
          :style="{ color: sel === i ? '#cd694a' : 'transparent' }"
          >❯</span
        >
        <span class="cp-label" :class="{ 'cp-label--active': sel === i }"
          >{{ i + 1 }}. {{ opt }}</span
        >
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.cp-root {
  border: 1px solid #cd694a;
  border-radius: 0;
  padding: 10px 14px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  min-width: 0;
}
.cp-legend {
  padding: 0 8px;
  color: #cd694a;
}
.cp-fg {
  color: #c0caf5;
}
.cp-question {
  margin: 8px 0 6px;
}
.cp-option {
  display: flex;
  cursor: pointer;
  align-items: baseline;
  gap: 8px;
  border-radius: 4px;
  padding: 2px 4px;
  outline: none;
  background: transparent;
}
.cp-option--active {
  background: #cd694a1f;
}
.cp-option:focus-visible {
  box-shadow: 0 0 0 1px rgba(125, 207, 255, 0.6);
}
.cp-caret {
  width: 1ch;
}
.cp-label {
  color: #8b8fa3;
}
.cp-label--active {
  color: #c0caf5;
  font-weight: 600;
}
</style>
