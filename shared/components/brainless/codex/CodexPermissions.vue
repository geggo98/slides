<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-permissions.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; radiogroup semantics
  and the › active-row grammar are kept; onChoose → `choose` emit.
-->
<script setup lang="ts">
import { ref } from "vue";

export interface CodexPermissionOption {
  label: string;
  description: string;
  current?: boolean;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    options?: CodexPermissionOption[];
    defaultSelected?: number;
  }>(),
  {
    title: "Update Model Permissions",
    options: () => [
      {
        label: "Default",
        current: true,
        description:
          "Codex can read and edit files in the current workspace, and run commands. Approval is required to access the internet or edit other files.",
      },
      {
        label: "Auto-review",
        description:
          "Same workspace-write permissions as Default, but eligible `on-request` approvals are routed through the auto-reviewer subagent.",
      },
      {
        label: "Full Access",
        description:
          "Codex can edit files outside this workspace and access the internet without asking for approval. Exercise caution when using.",
      },
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
  <div class="cxp-root">
    <div class="cxp-title">{{ title }}</div>

    <div role="radiogroup" :aria-label="title" class="cxp-group">
      <div
        v-for="(opt, i) in options"
        :key="opt.label"
        role="radio"
        :aria-checked="sel === i"
        :tabindex="sel === i ? 0 : -1"
        class="cxp-option"
        @keydown="onKey($event, i)"
        @click="choose(i)"
      >
        <span
          aria-hidden="true"
          class="cxp-marker"
          :style="{ color: sel === i ? '#ededed' : 'transparent' }"
          >›</span
        >
        <div class="cxp-body">
          <div :style="{ color: sel === i ? '#f6e2b7' : '#ededed' }">
            <span class="cxp-num">{{ i + 1 }}.</span> {{ opt.label
            }}<span v-if="opt.current" class="cxp-dim"> (current)</span>
          </div>
          <p class="cxp-desc">{{ opt.description }}</p>
        </div>
      </div>
    </div>

    <p class="cxp-footer">Press enter to confirm or esc to go back</p>
  </div>
</template>

<style scoped>
.cxp-root {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.55;
}
.cxp-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #ededed;
}
.cxp-group > * + * {
  margin-top: 8px;
}
.cxp-option {
  display: flex;
  cursor: pointer;
  gap: 8px;
  outline: none;
}
.cxp-option:focus-visible {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
}
.cxp-marker {
  display: inline-block;
  width: 2ch;
  flex-shrink: 0;
  font-weight: 700;
}
.cxp-body {
  min-width: 0;
}
.cxp-num {
  font-variant-numeric: tabular-nums;
}
.cxp-dim {
  color: #7a7a7a;
}
.cxp-desc {
  margin: 2px 0 0;
  max-width: 65ch;
  font-size: 12px;
  color: #7a7a7a;
}
.cxp-footer {
  margin: 12px 0 0;
  font-size: 12px;
  color: #7a7a7a;
}
</style>
