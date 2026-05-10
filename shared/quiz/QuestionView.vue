<script setup lang="ts">
/**
 * Renders one question with its sampled options. Owns the local picks and
 * emits submit/next so the parent can drive the run state machine.
 *
 * Layout after submit:
 *  - Per-option explanation is inline inside each <OptionItem> (no separate
 *    "Auflösung" panel).
 *  - A dimmed solution checkbox sits in a reserved right-hand column under
 *    the "Lösung" header. `solutionPolicy` decides which rows show the box;
 *    default = "mismatches" → only `wrongPick` + `missed`.
 *  - Whenever any sampled option has verdict=depends, an auto
 *    "Abwägungsfrage" note appears between legend and options, both pre- and
 *    post-submit.
 *
 * Accessibility:
 *  - `<fieldset>` + `<legend>` for the question grouping (1.3.1, 4.1.2)
 *  - `role="status"` + `aria-live="polite"` on the options region so the
 *    inline post-submit content announces (4.1.3)
 *  - Visually-hidden `<h3>` inside the options region absorbs focus on
 *    submit so the existing focus-management still works (2.4.3)
 *  - Slidev's slide-nav keys (Space, arrows, Enter) are stopped at handlers
 */

import { computed, nextTick, ref, watch } from "vue";
import OptionItem from "./OptionItem.vue";
import { classify } from "./lib/feedback";
import type {
  Difficulty,
  FeedbackState,
  QuizOption,
  QuizQuestion,
} from "./lib/types";

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

// Single config knob. Flip to "always" to show the solution checkbox on every
// row post-submit (the user mentioned this may change later).
const solutionPolicy: "mismatches" | "always" = "mismatches";

const HINT_BODY =
  "Hier gibt es nicht die eine richtige Antwort. Markiere, was du allgemein als zutreffend ansehen würdest — die Auflösung erklärt die Bedingungen.";

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

const hasDepends = computed(() =>
  props.shownOptions.some((o) => o.verdict === "depends"),
);

function togglePick(idx: number) {
  if (props.submitted) return;
  const next = props.picks.slice();
  next[idx] = !next[idx];
  emit("update:picks", next);
}

function feedbackStateFor(i: number): FeedbackState | null {
  if (!props.submitted) return null;
  const opt = props.shownOptions[i];
  if (!opt) return null;
  return classify(opt.verdict, props.picks[i] ?? false);
}

function solutionShownFor(i: number): boolean {
  if (!props.submitted) return false;
  const state = feedbackStateFor(i);
  if (!state) return false;
  if (solutionPolicy === "always") return state !== "depends";
  // "mismatches" — only show the canonical correct answer where the user got
  // it wrong; correct hits and correct omissions get no box.
  return state === "wrongPick" || state === "missed";
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

    <fieldset class="question-fieldset" :disabled="submitted">
      <legend class="question-legend">{{ question.question }}</legend>

      <div v-if="hasDepends" class="framing-hint" role="note">
        <span class="framing-icon" aria-hidden="true">⚖</span>
        <span>
          <strong>Abwägungsfrage.</strong>
          {{ HINT_BODY }}
        </span>
      </div>

      <p v-if="!submitted" class="hint">Mehrfachauswahl möglich.</p>

      <div
        class="options-region"
        :role="submitted ? 'status' : undefined"
        :aria-live="submitted ? 'polite' : undefined"
      >
        <h3 ref="feedbackHeadingRef" tabindex="-1" class="sr-only-heading">
          {{ feedbackHeading ?? "Auflösung" }}
        </h3>
        <div class="options">
          <OptionItem
            v-for="(opt, i) in shownOptions"
            :key="opt.id"
            :option="opt"
            :input-id="`q${totalIndex}-o${i}`"
            :checked="picks[i] ?? false"
            :submitted="submitted"
            :show-solution-box="solutionShownFor(i)"
            @toggle="togglePick(i)"
          />
        </div>
      </div>
    </fieldset>

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
  display: grid;
  grid-template-columns: 14px 1fr;
  gap: 8px;
  padding: 5px 9px;
  border-radius: 5px;
  background: var(--qz-tradeoff-bg);
  border: 0.5px dashed var(--qz-tradeoff);
  color: var(--qz-tradeoff);
  font-size: 10.5px;
  line-height: 1.4;
  margin: 0;
}
.framing-icon {
  font-size: 13px;
  line-height: 1.2;
}
.framing-hint strong {
  font-weight: 600;
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
  margin: 0;
}

.options-region {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Visually-hidden but focusable heading for screen-reader announcement. */
.sr-only-heading {
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
