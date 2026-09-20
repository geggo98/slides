<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/codex/codex-permissions.tsx
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; radiogroup semantics
  and the › active-row grammar are kept; onChoose → `choose` emit.
  Deviation: `subtitle` and `columns` (two-column rows, cyan accent) reproduce
  Codex CLI's two-column list-selection popup (rust-v0.154.0, tui/src/
  bottom_pane/list_selection_view.rs and selection_popup_common.rs; two
  columns already in v0.132, the version brainless captured; e.g. "Apply
  reasoning change" in Plan mode). Both are opt-in; without them the
  rendering stays upstream's stacked layout.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";

export interface CodexPermissionOption {
  label: string;
  description: string;
  current?: boolean;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    /** Dim line under the title, e.g. "Choose where to apply extra high reasoning." */
    subtitle?: string;
    options?: CodexPermissionOption[];
    defaultSelected?: number;
    /**
     * Two-column rows like Codex's list-selection popup: name cell sized to
     * the widest row, description beside it, selected row in cyan.
     */
    columns?: boolean;
  }>(),
  {
    title: "Update Model Permissions",
    subtitle: undefined,
    columns: false,
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
// Deviation: a host may move the cursor after mount by changing
// `defaultSelected` (an animated walk through the options, say). Upstream
// reads the prop once; with a constant prop this watch never fires, so the
// default path is unchanged.
watch(
  () => props.defaultSelected,
  (v) => {
    sel.value = v;
  },
);

// Width of the name cell in `ch`: the widest rendered "N. label (current)"
// over all rows, as Codex's compute_desc_col measures prefix + name per row
// (so a two-digit index on row 10+ counts). Consumed on `.cxp-name`, which
// shares the root's font-size, so `ch` is exact for a monospace face — bold
// keeps the advance width.
const nameW = computed(() =>
  Math.max(
    0,
    ...props.options.map(
      (o, i) =>
        `${i + 1}. `.length +
        o.label.length +
        (o.current ? " (current)".length : 0),
    ),
  ),
);

// Inline colors win over any class, so they must know about `columns`.
const CYAN = "#5cc2e0";
const markerColor = (i: number) =>
  sel.value !== i ? "transparent" : props.columns ? CYAN : "#ededed";
const nameColor = (i: number) =>
  sel.value !== i ? "#ededed" : props.columns ? CYAN : "#f6e2b7";

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
  <div class="cxp-root" :style="{ '--cxp-name-w': `${nameW}ch` }">
    <div class="cxp-title" :class="{ 'cxp-title-tight': subtitle }">
      {{ title }}
    </div>
    <div v-if="subtitle" class="cxp-subtitle">{{ subtitle }}</div>

    <div role="radiogroup" :aria-label="title" class="cxp-group">
      <div
        v-for="(opt, i) in options"
        :key="opt.label"
        role="radio"
        :aria-checked="sel === i"
        :tabindex="sel === i ? 0 : -1"
        class="cxp-option"
        :class="{ 'cxp-cols': columns, 'cxp-sel': sel === i }"
        @keydown="onKey($event, i)"
        @click="choose(i)"
      >
        <span
          aria-hidden="true"
          class="cxp-marker"
          :style="{ color: markerColor(i) }"
          >›</span
        >
        <div class="cxp-body">
          <div class="cxp-name" :style="{ color: nameColor(i) }">
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
  font-size: var(--cxp-font-size, 13px);
  line-height: 1.55;
}
.cxp-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #ededed;
}
.cxp-title-tight {
  margin-bottom: 0;
}
.cxp-subtitle {
  margin-bottom: 8px;
  color: #7a7a7a;
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

/* Two-column rows (Codex list_selection_view): marker | name | description,
   consecutive lines without the stacked layout's blank line between rows.
   Cell-exact like the TUI: the 2ch marker box already holds "› ", so no flex
   gap before "N."; the description starts desc_col = widest row + 2 cells
   (selection_popup_common.rs compute_desc_col `.saturating_add(2)`). */
.cxp-cols {
  align-items: baseline;
  gap: 0;
}
.cxp-group > .cxp-cols + .cxp-cols {
  margin-top: 0;
}
.cxp-cols .cxp-body {
  display: contents;
}
.cxp-cols .cxp-name {
  flex: 0 0 calc(var(--cxp-name-w) + 2ch);
  white-space: nowrap;
}
.cxp-cols .cxp-dim {
  /* Codex appends " (current)" to the plain name; the selected row's accent
     covers every span (apply_row_state_style). Only the stacked layout dims it. */
  color: inherit;
}
.cxp-cols .cxp-desc {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  max-width: none;
  font-size: inherit;
  /* Slidev's `.slidev-layout p` sets 1.5rem; the name cell has the root's
     1.55 — without this the two cells miss the shared baseline. */
  line-height: inherit;
}
.cxp-cols.cxp-sel .cxp-marker,
.cxp-cols.cxp-sel .cxp-name,
.cxp-cols.cxp-sel .cxp-desc {
  font-weight: 600;
}
.cxp-cols.cxp-sel .cxp-desc {
  color: #5cc2e0;
}
</style>
