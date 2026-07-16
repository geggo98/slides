<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-slash-menu.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; prefix filter,
  arrow-key navigation and listbox ARIA kept faithful.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CodexPrompt from "./CodexPrompt.vue";

export interface CodexSlashCommand {
  name: string;
  description: string;
}

const props = withDefaults(defineProps<{ commands?: CodexSlashCommand[] }>(), {
  commands: () => [
    {
      name: "/model",
      description: "choose what model and reasoning effort to use",
    },
    { name: "/permissions", description: "choose what Codex is allowed to do" },
    { name: "/diff", description: "show the unified diff for this session" },
    { name: "/review", description: "review a pull request or local changes" },
    { name: "/status", description: "show model, limits, and session info" },
    {
      name: "/compact",
      description: "summarize the conversation to save context",
    },
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
  <div class="cxs-root">
    <CodexPrompt
      v-model="value"
      placeholder=""
      mode="default"
      @keydown="onKeyDown"
    />

    <ul
      role="listbox"
      aria-label="Slash commands"
      :aria-activedescendant="
        list.length ? `codex-slash-${clampedActive}` : undefined
      "
      class="cxs-list"
    >
      <li
        v-for="(c, i) in list"
        :id="`codex-slash-${i}`"
        :key="c.name"
        role="option"
        :aria-selected="i === clampedActive"
        class="cxs-row"
        :class="i === clampedActive ? 'cxs-row--active' : 'cxs-row--inactive'"
        @mouseenter="active = i"
      >
        <span class="cxs-name">{{ c.name }}</span
        >{{ c.description }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cxs-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
}
.cxs-list {
  margin: 8px 0 0;
  padding: 0 0 0 2ch;
  list-style: none;
}
.cxs-list > li + li {
  margin-top: 2px;
}
.cxs-row {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cxs-row--active {
  color: #ededed;
}
.cxs-row--inactive {
  color: #7a7a7a;
}
.cxs-name {
  display: inline-block;
  width: 16ch;
}
</style>
