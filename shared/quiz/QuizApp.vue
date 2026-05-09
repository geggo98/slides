<script setup lang="ts">
/**
 * QuizApp — top-level orchestrator for the reusable training quiz.
 *
 * State machine:
 *   awaitingAnswer   user picks options for the current question
 *   showingFeedback  question submitted, feedback visible, "Weiter" arms
 *   completed        end summary visible, "Quiz neu starten" available
 *
 * Persistence (localStorage, per quiz id):
 *   quiz:<id>:run     active RunState (so reload mid-run resumes)
 *   quiz:<id>:memory  exposure counters + run history
 *
 * Reusability: pass in any `quiz: Quiz` (loaded from JSON) and an optional
 * partial `config`. The component never references talk-specific content.
 */

import { computed, onMounted, ref, watch } from "vue";
import { useDarkMode } from "@slidev/client";
import QuestionView from "./QuestionView.vue";
import QuizSummary from "./QuizSummary.vue";
import PrivacyFooter from "./PrivacyFooter.vue";
import {
  evaluateStopReason,
  nextDifficulty,
  performanceOf,
  pickNextQuestion,
  sampleOptions,
  scoreOf,
} from "./lib/adaptive";
import { tierFor, WORDING_VARIANT_A, WORDING_VARIANT_B } from "./lib/scoring";
import {
  appendHistory,
  clearMemory,
  clearRunState,
  loadMemory,
  loadRunState,
  saveMemory,
  saveRunState,
} from "./lib/persistence";
import { makePalette, paletteToCssVars } from "./lib/carbonTokens";
import {
  DEFAULT_CONFIG,
  type AskedQuestion,
  type CompletedRun,
  type Difficulty,
  type Quiz,
  type QuizConfig,
  type QuizMemory,
  type QuizOption,
  type QuizQuestion,
  type RunState,
  type StopReason,
} from "./lib/types";

const props = defineProps<{
  quiz: Quiz;
  config?: Partial<QuizConfig>;
}>();

const cfg = computed<QuizConfig>(() => ({
  ...DEFAULT_CONFIG,
  ...props.config,
}));

const { isDark } = useDarkMode();
const paletteVars = computed(() => paletteToCssVars(makePalette(isDark.value)));

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------
const run = ref<RunState | null>(null);
const memory = ref<QuizMemory>({
  questionExposure: {},
  optionExposure: {},
  questionFailureCount: {},
  history: [],
});
const lastCompletedRun = ref<CompletedRun | null>(null);

const questionsById = computed<Record<string, QuizQuestion>>(() =>
  Object.fromEntries(props.quiz.questions.map((q) => [q.id, q])),
);
const optionsByQuestion = computed<Record<string, Record<string, QuizOption>>>(
  () =>
    Object.fromEntries(
      props.quiz.questions.map((q) => [
        q.id,
        Object.fromEntries(q.options.map((o) => [o.id, o])),
      ]),
    ),
);

const currentAsked = computed<AskedQuestion | null>(() => {
  if (!run.value || run.value.stopReason) return null;
  return run.value.asked[run.value.asked.length - 1] ?? null;
});

const currentQuestion = computed<QuizQuestion | null>(() => {
  const a = currentAsked.value;
  if (!a) return null;
  return questionsById.value[a.questionId] ?? null;
});

const currentShownOptions = computed<QuizOption[]>(() => {
  const a = currentAsked.value;
  if (!a) return [];
  const map = optionsByQuestion.value[a.questionId] ?? {};
  return a.sampledOptionIds
    .map((id) => map[id])
    .filter((o): o is QuizOption => Boolean(o));
});

const isCompleted = computed(
  () => Boolean(run.value?.stopReason) && Boolean(lastCompletedRun.value),
);

// ---------------------------------------------------------------------------
// Lifecycle: load persisted state
// ---------------------------------------------------------------------------
onMounted(() => {
  memory.value = loadMemory(props.quiz.id);
  const persisted = loadRunState(props.quiz.id);
  if (persisted && persisted.asked.length > 0 && !persisted.stopReason) {
    run.value = persisted;
    return;
  }
  if (persisted?.stopReason) {
    // Old completed-run leftovers: clear and start fresh.
    clearRunState(props.quiz.id);
  }
  startNewRun();
});

watch(
  run,
  (v) => {
    if (v && !v.stopReason) saveRunState(props.quiz.id, v);
  },
  { deep: true },
);

watch(memory, (m) => saveMemory(props.quiz.id, m), { deep: true });

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------
function startNewRun() {
  lastCompletedRun.value = null;
  const seed = pickNextQuestion(
    props.quiz.questions,
    new Set(),
    cfg.value.seedDifficulty,
    memory.value,
    {
      enableSpacedRepetition: cfg.value.enableSpacedRepetition,
      spacedRepetitionWeight: cfg.value.spacedRepetitionWeight,
    },
  );
  if (!seed) {
    run.value = null;
    return;
  }
  const sampled = sampleOptions(
    seed,
    cfg.value.optionsPerQuestion,
    memory.value,
  );
  registerExposure(seed, sampled);
  run.value = {
    runId: makeRunId(),
    startedAt: new Date().toISOString(),
    currentDifficulty: cfg.value.seedDifficulty,
    asked: [
      {
        questionId: seed.id,
        difficulty: seed.difficulty,
        sampledOptionIds: sampled.map((o) => o.id),
        picks: sampled.map(() => false),
        submitted: false,
      },
    ],
  };
}

function registerExposure(question: QuizQuestion, sampled: QuizOption[]) {
  const m = { ...memory.value };
  m.questionExposure = { ...m.questionExposure };
  m.optionExposure = { ...m.optionExposure };
  m.questionExposure[question.id] = (m.questionExposure[question.id] ?? 0) + 1;
  for (const o of sampled) {
    const k = `${question.id}::${o.id}`;
    m.optionExposure[k] = (m.optionExposure[k] ?? 0) + 1;
  }
  memory.value = m;
}

function onPicksUpdate(picks: boolean[]) {
  if (!run.value) return;
  const i = run.value.asked.length - 1;
  if (i < 0) return;
  const asked = [...run.value.asked];
  const last = asked[i];
  if (!last) return;
  asked[i] = { ...last, picks };
  run.value = { ...run.value, asked };
}

function onSubmit() {
  if (!run.value) return;
  const i = run.value.asked.length - 1;
  if (i < 0) return;
  const a = run.value.asked[i];
  if (!a || a.submitted) return;
  const shown = currentShownOptions.value;
  const selected = new Set<string>();
  shown.forEach((opt, idx) => {
    if (a.picks[idx]) selected.add(opt.id);
  });
  const score = scoreOf(shown, selected);

  // failure count for spaced-rep (tracked even when feature off)
  if (score < 0.5) {
    const failMap = { ...memory.value.questionFailureCount };
    failMap[a.questionId] = (failMap[a.questionId] ?? 0) + 1;
    memory.value = { ...memory.value, questionFailureCount: failMap };
  }

  const updated: AskedQuestion = { ...a, submitted: true, score };
  const asked = [...run.value.asked];
  asked[i] = updated;
  const newDifficulty = nextDifficulty(run.value.currentDifficulty, score);
  run.value = { ...run.value, asked, currentDifficulty: newDifficulty };
}

function onNext() {
  if (!run.value) return;
  const stop = evaluateStopReason(run.value.asked, {
    maxQuestions: cfg.value.maxQuestions,
    floorStopEnabled: cfg.value.floorStopEnabled,
  });
  if (stop) {
    finalizeRun(stop);
    return;
  }
  const askedIds = new Set(run.value.asked.map((a) => a.questionId));
  const nq = pickNextQuestion(
    props.quiz.questions,
    askedIds,
    run.value.currentDifficulty,
    memory.value,
    {
      enableSpacedRepetition: cfg.value.enableSpacedRepetition,
      spacedRepetitionWeight: cfg.value.spacedRepetitionWeight,
    },
  );
  if (!nq) {
    finalizeRun("pool_exhausted");
    return;
  }
  const sampled = sampleOptions(nq, cfg.value.optionsPerQuestion, memory.value);
  registerExposure(nq, sampled);
  run.value = {
    ...run.value,
    asked: [
      ...run.value.asked,
      {
        questionId: nq.id,
        difficulty: nq.difficulty,
        sampledOptionIds: sampled.map((o) => o.id),
        picks: sampled.map(() => false),
        submitted: false,
      },
    ],
  };
}

function finalizeRun(stop: StopReason) {
  if (!run.value) return;
  const submitted = run.value.asked.filter((a) => a.submitted);
  const completed = computeCompletedRun(run.value, submitted, stop);
  lastCompletedRun.value = completed;
  memory.value = appendHistory(
    memory.value,
    completed,
    cfg.value.historyTrimAt,
  );
  run.value = { ...run.value, stopReason: stop };
  // Wipe the in-progress key so the next mount starts fresh.
  clearRunState(props.quiz.id);
}

function computeCompletedRun(
  state: RunState,
  submitted: AskedQuestion[],
  stop: StopReason,
): CompletedRun {
  let scoringTotal = 0;
  let scoringCorrect = 0;
  const perDifficulty: CompletedRun["perDifficulty"] = {
    easy: { asked: 0, fullCount: 0, partialCount: 0, noneCount: 0 },
    medium: { asked: 0, fullCount: 0, partialCount: 0, noneCount: 0 },
    hard: { asked: 0, fullCount: 0, partialCount: 0, noneCount: 0 },
  };
  const questionScores: Record<string, number> = {};

  for (const a of submitted) {
    const map = optionsByQuestion.value[a.questionId] ?? {};
    const shown = a.sampledOptionIds
      .map((id) => map[id])
      .filter((o): o is QuizOption => Boolean(o));
    const scoringOpts = shown.filter((o) => o.verdict !== "depends");
    scoringTotal += scoringOpts.length;
    let correct = 0;
    scoringOpts.forEach((o) => {
      const isPicked = a.picks[a.sampledOptionIds.indexOf(o.id)];
      if (
        (o.verdict === "true" && isPicked) ||
        (o.verdict === "false" && !isPicked)
      )
        correct++;
    });
    scoringCorrect += correct;
    questionScores[a.questionId] = a.score ?? 0;
    const bucket = perDifficulty[a.difficulty];
    bucket.asked++;
    const perf = performanceOf(a.score ?? 0);
    if (perf === "full") bucket.fullCount++;
    else if (perf === "partial") bucket.partialCount++;
    else bucket.noneCount++;
  }

  const scorePercent =
    scoringTotal === 0 ? 0 : (scoringCorrect / scoringTotal) * 100;

  return {
    runId: state.runId,
    completedAt: new Date().toISOString(),
    stopReason: stop,
    questionsAsked: submitted.length,
    scoringStatementsTotal: scoringTotal,
    scoringStatementsCorrect: scoringCorrect,
    scorePercent,
    perDifficulty,
    askedQuestionIds: submitted.map((a) => a.questionId),
    questionScores,
  };
}

function onRestart() {
  clearRunState(props.quiz.id);
  startNewRun();
}

function onClearAll() {
  clearRunState(props.quiz.id);
  clearMemory(props.quiz.id);
  memory.value = {
    questionExposure: {},
    optionExposure: {},
    questionFailureCount: {},
    history: [],
  };
  startNewRun();
}

// ---------------------------------------------------------------------------
// Tier wording
// ---------------------------------------------------------------------------
const tierLabel = computed(() =>
  lastCompletedRun.value
    ? tierFor(lastCompletedRun.value.scorePercent)
    : "Anfang",
);

const tierBlurb = computed(() => {
  const variant =
    cfg.value.tierWordingVariant === "A"
      ? WORDING_VARIANT_A
      : WORDING_VARIANT_B;
  return variant[tierLabel.value];
});

const totalIndex = computed(() => run.value?.asked.length ?? 0);

function makeRunId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
</script>

<template>
  <div class="quiz-root" :style="paletteVars">
    <header class="quiz-header">
      <h2 v-if="quiz.title" class="quiz-title">{{ quiz.title }}</h2>
    </header>

    <QuestionView
      v-if="!isCompleted && currentAsked && currentQuestion"
      :question="currentQuestion"
      :shown-options="currentShownOptions"
      :picks="currentAsked.picks"
      :submitted="currentAsked.submitted"
      :question-index="totalIndex - 1"
      :total-index="totalIndex - 1"
      @update:picks="onPicksUpdate"
      @submit="onSubmit"
      @next="onNext"
    />

    <QuizSummary
      v-else-if="isCompleted && lastCompletedRun"
      :run="lastCompletedRun"
      :history="memory.history"
      :questions-by-id="questionsById"
      :tier-label="tierLabel"
      :tier-blurb="tierBlurb"
      @restart="onRestart"
      @clear-all="onClearAll"
    />

    <PrivacyFooter
      v-if="!isCompleted"
      class="quiz-footer"
      compact
      @clear-all="onClearAll"
    />
  </div>
</template>

<style scoped>
.quiz-root {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: "Inter", sans-serif;
  color: var(--qz-text);
  font-size: 12px;
}
.quiz-header {
  display: none; /* talks usually have their own slide title */
}
.quiz-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--qz-text);
}
.quiz-footer {
  margin-top: 1px;
}
</style>
