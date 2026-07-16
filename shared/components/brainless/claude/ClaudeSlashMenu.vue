<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-slash-menu.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; prefix filter,
  arrow-key navigation and listbox ARIA kept faithful.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ClaudePrompt from "./ClaudePrompt.vue";

export interface SlashCommand {
  name: string;
  description: string;
}

const props = withDefaults(defineProps<{ commands?: SlashCommand[] }>(), {
  commands: () => [
    { name: "/agents", description: "Manage subagents for specialized tasks" },
    {
      name: "/clear",
      description: "Clear conversation history and free up context",
    },
    {
      name: "/compact",
      description: "Summarize the conversation to save context",
    },
    { name: "/init", description: "Initialize a CLAUDE.md with codebase docs" },
    { name: "/model", description: "Change the model for this session" },
    { name: "/review", description: "Review a pull request" },
  ],
});

const value = ref("/");
const active = ref(0);

const list = computed(() => {
  const query = value.value.startsWith("/")
    ? value.value.slice(1)
    : value.value;
  return props.commands.filter((c) =>
    c.name.slice(1).toLowerCase().startsWith(query.toLowerCase()),
  );
});
const clampedActive = computed(() =>
  list.value.length ? Math.min(active.value, list.value.length - 1) : 0,
);

watch(value, () => (active.value = 0));

function onKeyDown(e: KeyboardEvent) {
  if (!list.value.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    active.value = (active.value + 1) % list.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    active.value = (active.value - 1 + list.value.length) % list.value.length;
  }
}
</script>

<template>
  <div class="sm-root">
    <ul
      role="listbox"
      aria-label="Slash commands"
      :aria-activedescendant="
        list.length ? `slash-${clampedActive}` : undefined
      "
      class="sm-list"
    >
      <li
        v-for="(c, i) in list"
        :id="`slash-${i}`"
        :key="c.name"
        role="option"
        :aria-selected="i === clampedActive"
        class="sm-row"
        :class="i === clampedActive ? 'sm-row--active' : 'sm-row--inactive'"
        @mouseenter="active = i"
      >
        <span class="sm-name">{{ c.name }}</span
        >{{ c.description }}
      </li>
    </ul>

    <ClaudePrompt v-model="value" mode="auto" @keydown="onKeyDown" />
  </div>
</template>

<style scoped>
.sm-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
}
.sm-list {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}
.sm-list > li + li {
  margin-top: 2px;
}
.sm-row {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 4px;
}
.sm-row--active {
  color: #afd7ff;
}
.sm-row--inactive {
  color: #949494;
}
.sm-name {
  display: inline-block;
  width: 37ch;
}
</style>
