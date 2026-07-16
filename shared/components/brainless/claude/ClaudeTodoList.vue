<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-todo-list.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; capture grammar
  (⎿ prefix, ✔/◼/◻ single icon column) kept faithful to the original.
-->
<script setup lang="ts">
export interface Todo {
  label: string;
  status: "done" | "active" | "todo";
}

defineProps<{ todos: Todo[] }>();

const ICON: Record<Todo["status"], string> = {
  done: "✔",
  active: "◼",
  todo: "◻",
};
// done: 38;5;114 · active: 38;5;174 (Claude terracotta)
const ICON_COLOR: Record<Todo["status"], string | undefined> = {
  done: "#87d787",
  active: "#d78787",
  todo: undefined,
};
const STATUS_TEXT: Record<Todo["status"], string> = {
  done: "completed",
  active: "in progress",
  todo: "pending",
};
</script>

<template>
  <ol class="ct-root">
    <li v-for="(t, i) in todos" :key="i" class="ct-row">
      <!-- First row: "  ⎿ " then icon. Later rows: four spaces so the icon
           column lines up under ✔ (no capture-style nbsp jump). -->
      <span aria-hidden="true" class="ct-dim">{{
        i === 0 ? "  ⎿ " : "    "
      }}</span>
      <span aria-hidden="true" :style="{ color: ICON_COLOR[t.status] }">{{
        ICON[t.status] + " "
      }}</span>
      <span
        class="ct-label"
        :class="{
          'ct-done': t.status === 'done',
          'ct-active': t.status === 'active',
        }"
      >
        {{ t.label }}<span class="sr-only"> ({{ STATUS_TEXT[t.status] }})</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.ct-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
  list-style: none;
  margin: 0;
  padding: 0;
}
.ct-row {
  white-space: pre;
}
.ct-dim {
  color: #949494;
}
.ct-done {
  text-decoration: line-through;
  color: #949494;
}
.ct-active {
  font-weight: 600;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
