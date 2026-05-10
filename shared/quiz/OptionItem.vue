<script setup lang="ts">
/**
 * One answer option laid out as a four-column grid:
 *
 *   [user-pick] [correction-cell] [option text … pill] (row 1)
 *               [option explanation, spans cols 3-4]   (row 2, post-submit only)
 *
 * The correction-cell column is always reserved (no layout shift on submit).
 * After submit the parent decides whether to render the dimmed read-only
 * "what you should have done" checkbox there via `showSolutionBox` — current
 * policy is `wrongPick` + `missed`; the prop accepts any boolean so the
 * policy can flip to "show on every row" without touching this file.
 *
 * Accessibility:
 *  - User's checkbox + label via `<label for=id>` (text is the click target).
 *  - Status pill carries icon + Resultat + Aussage-Wahrheit (WCAG 1.4.1).
 *  - Solution checkbox is `disabled` with an `aria-label` reading
 *    "Korrekte Auswahl: ja/nein" so screen readers don't announce a bare box.
 */

import { computed } from "vue";
import { PILL_WORDING, classify } from "./lib/feedback";
import type { QuizOption } from "./lib/types";

const props = defineProps<{
  option: QuizOption;
  inputId: string;
  checked: boolean;
  submitted: boolean;
  showSolutionBox: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
}>();

const feedbackState = computed(() =>
  props.submitted ? classify(props.option.verdict, props.checked) : null,
);
const pill = computed(() =>
  feedbackState.value ? PILL_WORDING[feedbackState.value] : null,
);

const solutionChecked = computed(() => props.option.verdict === "true");
const solutionAriaLabel = computed(() =>
  solutionChecked.value ? "Korrekte Auswahl: ja" : "Korrekte Auswahl: nein",
);

function onChange(ev: Event) {
  if (props.submitted) return;
  ev.stopPropagation();
  emit("toggle");
}
</script>

<template>
  <div
    class="option-row"
    :class="pill?.cssClass"
    :data-state="feedbackState ?? 'pending'"
  >
    <input
      :id="inputId"
      type="checkbox"
      class="user-pick"
      :checked="checked"
      :disabled="submitted"
      :aria-describedby="submitted ? `${inputId}-pill` : undefined"
      @change="onChange"
      @click.stop
      @keydown.space.stop
    />
    <div class="correction-cell">
      <input
        v-if="submitted && showSolutionBox"
        type="checkbox"
        class="solution-pick"
        disabled
        :checked="solutionChecked"
        :aria-label="solutionAriaLabel"
      />
    </div>
    <label :for="inputId" class="option-text">{{ option.text }}</label>
    <span
      v-if="pill"
      :id="`${inputId}-pill`"
      class="status-pill"
      :class="pill.cssClass"
    >
      <span class="pill-icon" aria-hidden="true">{{ pill.icon }}</span>
      <span class="pill-result">{{ pill.result }}</span>
      <span class="pill-sep" aria-hidden="true">·</span>
      <span class="pill-truth">{{ pill.truth }}</span>
    </span>
    <p v-if="pill && option.explanation" class="option-explanation">
      {{ option.explanation }}
    </p>
  </div>
</template>

<style scoped>
.option-row {
  display: grid;
  grid-template-columns: 18px 22px 1fr auto;
  column-gap: 8px;
  row-gap: 2px;
  align-items: center;
  padding: 5px 9px;
  border: 0.5px solid var(--qz-border);
  border-radius: 5px;
  background: var(--qz-panel-bg);
  font-size: 11.5px;
  line-height: 1.35;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.option-row:hover:not(.fb-success):not(.fb-info):not(.fb-error):not(
    .fb-warning
  ):not(.fb-tradeoff) {
  border-color: var(--qz-accent);
}

.user-pick {
  grid-column: 1;
  grid-row: 1;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--qz-accent);
  justify-self: center;
}
.user-pick:disabled {
  cursor: default;
  opacity: 0.85;
}
.user-pick:focus-visible {
  outline: 2px solid var(--qz-focus);
  outline-offset: 2px;
}

.correction-cell {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}
.solution-pick {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: default;
  opacity: 0.5;
  accent-color: var(--qz-text-muted);
}

.option-text {
  grid-column: 3;
  grid-row: 1;
  min-width: 0;
  cursor: pointer;
  color: var(--qz-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* status pill ------------------------------------------------------------- */
.status-pill {
  grid-column: 4;
  grid-row: 1;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 500;
  white-space: nowrap;
  width: max-content;
  max-width: 100%;
}
.pill-sep {
  opacity: 0.55;
}
.pill-truth {
  font-weight: 400;
  opacity: 0.85;
}

/* explanation row --------------------------------------------------------- */
.option-explanation {
  grid-column: 3 / span 2;
  grid-row: 2;
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
  color: var(--qz-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* status-class colours (color + bg + border + icon glyph already differ) -- */
.fb-success {
  border-color: var(--qz-success);
  background: var(--qz-success-bg);
}
.fb-success .status-pill {
  background: var(--qz-success);
  color: var(--qz-bg);
}
.fb-info {
  border-color: var(--qz-info);
  background: var(--qz-info-bg);
}
.fb-info .status-pill {
  background: var(--qz-info);
  color: var(--qz-bg);
}
.fb-error {
  border-color: var(--qz-error);
  background: var(--qz-error-bg);
}
.fb-error .status-pill {
  background: var(--qz-error);
  color: var(--qz-bg);
}
.fb-warning {
  border-color: var(--qz-warning);
  background: var(--qz-warning-bg);
}
.fb-warning .status-pill {
  background: var(--qz-warning);
  color: var(--qz-bg);
}
.fb-tradeoff {
  /* dashed border = 4th differentiator beyond color, icon, label */
  border-color: var(--qz-tradeoff);
  border-style: dashed;
  background: var(--qz-tradeoff-bg);
}
.fb-tradeoff .status-pill {
  background: var(--qz-tradeoff);
  color: var(--qz-bg);
}

@media (prefers-reduced-motion: reduce) {
  .option-row {
    transition: none;
  }
}
</style>
