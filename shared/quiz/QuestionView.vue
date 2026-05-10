<script setup lang="ts">
/**
 * Renders one question with its sampled options. Owns the local picks and
 * emits submit/next so the parent can drive the run state machine.
 *
 * Accessibility:
 *  - `<fieldset>` + `<legend>` for the question grouping (1.3.1, 4.1.2)
 *  - `role="status"` + `aria-live="polite"` on the feedback summary line
 *  - Focus moves to the feedback heading on submit (2.4.3)
 *  - Reduced-motion-friendly: only 200 ms opacity transitions
 *  - Slidev's slide-nav keys (Space, arrows, Enter) are stopped at handlers
 */

import { computed, nextTick, ref, watch } from "vue";
import OptionItem from "./OptionItem.vue";
import { classify, PILL_WORDING } from "./lib/feedback";
import type { Difficulty, QuizOption, QuizQuestion } from "./lib/types";

const props = defineProps<{
  question: QuizQuestion;
  shownOptions: QuizOption[];
  picks: boolean[];
  submitted: boolean;
  questionIndex: number;
  totalIndex: number;
  feedbackHeading?: string;
}>();

const emit = defineEmits<{
  (e: "update:picks", value: boolean[]): void;
  (e: "submit"): void;
  (e: "next"): void;
}>();

const feedbackHeadingRef = ref<HTMLElement | null>(null);

const difficultyLabel: Record<Difficulty, string> = {
  easy: "leicht",
  medium: "mittel",
  hard: "schwer",
};

const numberSelected = computed(() =>
  props.picks.reduce((n, p) => (p ? n + 1 : n), 0),
);

const sectionLabel = computed(() => {
  const s = props.question.section;
  if (!s) return null;
  if (s === "transfer") return "über den Vortrag hinaus";
  return s;
});

function togglePick(idx: number) {
  if (props.submitted) return;
  const next = props.picks.slice();
  next[idx] = !next[idx];
  emit("update:picks", next);
}

function rationaleClass(i: number): string {
  const opt = props.shownOptions[i];
  const checked = props.picks[i] ?? false;
  if (!opt) return "";
  return PILL_WORDING[classify(opt.verdict, checked)].cssClass;
}

watch(
  () => props.submitted,
  async (now) => {
    if (now) {
      await nextTick();
      feedbackHeadingRef.value?.focus();
    }
  },
);
</script>

<template>
  <section
    class="question-pane"
    @keydown.space.stop
    @keydown.enter.stop
    @keydown.left.stop
    @keydown.right.stop
  >
    <header class="meta-row">
      <span class="progress">
        Frage {{ questionIndex + 1 }} · Schwierigkeit:
        <strong>{{ difficultyLabel[question.difficulty] }}</strong>
      </span>
      <span v-if="sectionLabel" class="section-badge">{{ sectionLabel }}</span>
    </header>

    <div v-if="question.framingHint" class="framing-hint" role="note">
      <span class="framing-icon" aria-hidden="true">⚖</span>
      <span>{{ question.framingHint }}</span>
    </div>

    <fieldset class="question-fieldset" :disabled="submitted">
      <legend class="question-legend">{{ question.question }}</legend>
      <div class="hint">Mehrfachauswahl möglich.</div>
      <div class="options">
        <OptionItem
          v-for="(opt, i) in shownOptions"
          :key="opt.id"
          :option="opt"
          :input-id="`q${totalIndex}-o${i}`"
          :checked="picks[i] ?? false"
          :submitted="submitted"
          @toggle="togglePick(i)"
        />
      </div>
    </fieldset>

    <div
      v-if="submitted"
      class="feedback-status"
      role="status"
      aria-live="polite"
    >
      <h3 ref="feedbackHeadingRef" tabindex="-1" class="feedback-heading">
        {{ feedbackHeading ?? "Auflösung" }}
      </h3>
      <ul class="rationale-list">
        <li
          v-for="(opt, i) in shownOptions"
          :key="opt.id"
          class="rationale-item"
          :class="rationaleClass(i)"
        >
          <span class="rationale-marker" aria-hidden="true"></span>
          <span class="rationale-text">{{ opt.explanation }}</span>
        </li>
      </ul>
      <p v-if="question.explanation" class="general-explanation">
        {{ question.explanation }}
      </p>
    </div>

    <div class="controls">
      <button
        v-if="!submitted"
        type="button"
        class="primary-btn"
        :disabled="numberSelected === 0"
        @click.stop="emit('submit')"
      >
        Antwort prüfen
      </button>
      <button
        v-else
        type="button"
        class="primary-btn"
        @click.stop="emit('next')"
      >
        Weiter
      </button>
    </div>
  </section>
</template>

<style scoped>
.question-pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: "Inter", sans-serif;
  font-size: 12px;
  color: var(--qz-text);
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  color: var(--qz-text-muted);
}
.progress {
  font-family: "0xProto", monospace;
  margin-right: auto;
}
.progress strong {
  color: var(--qz-text);
  font-weight: 600;
}

.section-badge {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 9.5px;
  border: 0.5px solid var(--qz-border);
  background: var(--qz-panel-bg);
  color: var(--qz-text-muted);
}

.framing-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  border-radius: 5px;
  background: var(--qz-tradeoff-bg);
  border: 0.5px dashed var(--qz-tradeoff);
  color: var(--qz-tradeoff);
  font-size: 10.5px;
  line-height: 1.4;
}
.framing-icon {
  font-size: 13px;
}

.question-fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.question-legend {
  font-size: 14px;
  font-weight: 500;
  color: var(--qz-text);
  line-height: 1.35;
  padding: 0;
  margin: 0 0 1px;
}
.hint {
  font-size: 10px;
  color: var(--qz-text-muted);
  margin-bottom: 2px;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feedback-status {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 9px;
  border: 0.5px solid var(--qz-border);
  border-radius: 5px;
  background: var(--qz-panel-bg);
}
.feedback-heading {
  margin: 0;
  font-size: 9.5px;
  font-weight: 600;
  color: var(--qz-accent);
  letter-spacing: 0.05em;
  text-transform: lowercase;
  outline: none;
}
.feedback-heading:focus-visible {
  outline: 2px solid var(--qz-focus);
  outline-offset: 2px;
  border-radius: 3px;
}

.rationale-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.rationale-item {
  display: grid;
  grid-template-columns: 8px 1fr;
  gap: 6px;
  align-items: start;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--qz-text);
}
.rationale-marker {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 5px;
  background: var(--qz-text-muted);
}
.rationale-item.fb-success .rationale-marker {
  background: var(--qz-success);
}
.rationale-item.fb-info .rationale-marker {
  background: var(--qz-info);
}
.rationale-item.fb-error .rationale-marker {
  background: var(--qz-error);
}
.rationale-item.fb-warning .rationale-marker {
  background: var(--qz-warning);
}
.rationale-item.fb-tradeoff .rationale-marker {
  background: var(--qz-tradeoff);
}
.rationale-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.general-explanation {
  margin: 4px 0 0;
  padding-top: 4px;
  border-top: 0.5px dashed var(--qz-border);
  font-size: 10.5px;
  color: var(--qz-text);
  line-height: 1.4;
}

.controls {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}
.primary-btn {
  font-family: inherit;
  font-size: 11px;
  padding: 5px 14px;
  border-radius: 5px;
  border: 0.5px solid var(--qz-accent);
  background: var(--qz-accent-bg);
  color: var(--qz-accent);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.primary-btn:hover:not(:disabled) {
  background: var(--qz-accent);
  color: var(--qz-bg);
}
.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.primary-btn:focus-visible {
  outline: 2px solid var(--qz-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .primary-btn {
    transition: none;
  }
}
</style>
