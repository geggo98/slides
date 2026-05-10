<script setup lang="ts">
/**
 * One answer option: native checkbox + text + (after submit) two-part status
 * pill and `<details>` explanation. The pill carries icon + result + truth so
 * color is never the sole semantic carrier (WCAG 1.4.1 + 1.3.1).
 */

import { computed } from "vue";
import { PILL_WORDING, classify } from "./lib/feedback";
import type { QuizOption } from "./lib/types";

const props = defineProps<{
  option: QuizOption;
  inputId: string;
  checked: boolean;
  submitted: boolean;
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
    <label :for="inputId" class="option-label" @click.stop>
      <input
        :id="inputId"
        type="checkbox"
        :checked="checked"
        :disabled="submitted"
        :aria-describedby="submitted ? `${inputId}-pill` : undefined"
        @change="onChange"
        @click.stop
        @keydown.space.stop
      />
      <span class="option-text">{{ option.text }}</span>
    </label>

    <span v-if="pill" :id="`${inputId}-pill`" class="status-pill">
      <span class="pill-icon" aria-hidden="true">{{ pill.icon }}</span>
      <span class="pill-result">{{ pill.result }}</span>
      <span class="pill-sep" aria-hidden="true">·</span>
      <span class="pill-truth">{{ pill.truth }}</span>
    </span>
  </div>
</template>

<style scoped>
.option-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 0.5px solid var(--qz-border);
  border-radius: 5px;
  background: var(--qz-panel-bg);
  transition:
    border-color 0.15s,
    background 0.15s;
}
.option-row:hover:not(.fb-success):not(.fb-info):not(.fb-error):not(
    .fb-warning
  ):not(.fb-tradeoff) {
  border-color: var(--qz-accent);
}

.option-label {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 7px;
  align-items: center;
  cursor: pointer;
  font-size: 11.5px;
  line-height: 1.35;
}
.option-label input[type="checkbox"] {
  margin: 2px 0 0;
  accent-color: var(--qz-accent);
  width: 14px;
  height: 14px;
}
.option-label input[type="checkbox"]:disabled {
  cursor: default;
  opacity: 0.85;
}
.option-label input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--qz-focus);
  outline-offset: 2px;
}
.option-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--qz-text);
}

/* feedback pill ----------------------------------------------------------- */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}
.pill-sep {
  opacity: 0.55;
}
.pill-truth {
  font-weight: 400;
  opacity: 0.85;
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
