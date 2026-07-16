<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-prompt.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; mode colors/glyphs,
  effort chips (○◐●◉◈✦) and the ultracode rainbow border-image are kept.
  Controlled value → defineModel; onKeyDown → `keydown` emit.
-->
<script setup lang="ts">
import { computed } from "vue";

export type ClaudeMode = "auto" | "manual" | "accept-edits" | "plan";
export type ClaudeEffort =
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
  | "ultracode";

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    mode?: ClaudeMode;
    /** Effort chip above the prompt. Pass `false` to hide. */
    effort?: ClaudeEffort | false;
  }>(),
  { placeholder: "", mode: "auto", effort: "xhigh" },
);

const emit = defineEmits<{ keydown: [event: KeyboardEvent] }>();

const model = defineModel<string>({ default: "" });

const GRAY = "#949494";

const MODES: Record<
  ClaudeMode,
  { glyph: string; label: string; color: string; hint: string }
> = {
  auto: {
    glyph: "⏵⏵",
    label: "auto mode on",
    color: "#ffd700",
    hint: "(shift+tab to cycle) · ← for agents",
  },
  manual: {
    glyph: "⏸",
    label: "manual mode on",
    color: GRAY,
    hint: "· ? for shortcuts · ← for agents",
  },
  "accept-edits": {
    glyph: "⏵⏵",
    label: "accept edits on",
    color: "#afafd7",
    hint: "(shift+tab to cycle) · ← for agents",
  },
  plan: {
    glyph: "⏸",
    label: "plan mode on",
    color: "#5fafaf",
    hint: "(shift+tab to cycle) · ← for agents",
  },
};

const EFFORTS: Record<
  ClaudeEffort,
  { glyph: string; label: string; rainbow?: boolean }
> = {
  low: { glyph: "○", label: "low · /effort" },
  medium: { glyph: "◐", label: "medium · /effort" },
  high: { glyph: "●", label: "high · /effort" },
  xhigh: { glyph: "◉", label: "xhigh · /effort" },
  max: { glyph: "◈", label: "max · /effort" },
  ultracode: {
    glyph: "✦",
    label:
      "ultracode · xhigh effort + dynamic workflows for maximum thoroughness",
    rainbow: true,
  },
};

const m = computed(() => MODES[props.mode]);
const e = computed(() =>
  props.effort === false ? null : EFFORTS[props.effort],
);
const rainbow = computed(() => Boolean(e.value?.rainbow));
</script>

<template>
  <div class="pr-root">
    <div v-if="e" class="pr-chip">
      <span class="pr-chip-text"
        ><span aria-hidden="true">{{ e.glyph }}</span> {{ e.label }}</span
      >
    </div>

    <div class="pr-row" :class="rainbow ? 'pr-row--rainbow' : 'pr-row--plain'">
      <span aria-hidden="true" class="pr-caret">❯</span>
      <input
        v-model="model"
        type="text"
        aria-label="Prompt"
        :placeholder="placeholder"
        class="pr-input"
        @keydown="emit('keydown', $event)"
      />
    </div>

    <div class="pr-mode">
      <span :style="{ color: m.color }"
        ><span aria-hidden="true">{{ m.glyph + " " }}</span
        >{{ m.label }}</span
      >
      <span v-if="m.hint" class="pr-hint">{{ " " + m.hint }}</span>
    </div>
  </div>
</template>

<style scoped>
.pr-root {
  min-width: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
}
.pr-chip {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px 4px;
  font-size: 12px;
  color: #949494;
}
.pr-chip-text {
  min-width: 0;
  overflow-wrap: break-word;
  text-align: right;
}
.pr-row {
  display: flex;
  min-width: 0;
  align-items: center;
  padding-block: 2px;
  border-top: 1px solid;
  border-bottom: 1px solid;
}
.pr-row--plain {
  border-color: #808080;
}
/* Ultracode prompt-rule cycle from live captures (38;5;146→182→210→216→222→151). */
.pr-row--rainbow {
  border-image-source: linear-gradient(
    90deg,
    #afafd7,
    #d7afd7,
    #ff87af,
    #ffaf87,
    #ffd787,
    #afd787,
    #afafd7
  );
  border-image-slice: 1;
}
.pr-caret {
  flex-shrink: 0;
  color: #c0caf5;
}
.pr-input {
  min-width: 0;
  flex: 1 1 0%;
  background: transparent;
  border: none;
  padding: 2px 0 2px 1ch;
  outline: none;
  font: inherit;
  color: #c0caf5;
  caret-color: #c0caf5;
}
.pr-input::placeholder {
  color: #565f89;
}
.pr-mode {
  margin-top: 6px;
  min-width: 0;
  overflow-wrap: break-word;
  padding: 0 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
.pr-hint {
  color: #949494;
}
</style>
