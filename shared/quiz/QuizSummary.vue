<script setup lang="ts">
/**
 * End-of-run summary. Renders tier text prominently (UX-006), score percentage
 * smaller below, stop-reason heading, optional delta vs previous run, per-
 * difficulty breakdown, per-question review, and the action buttons.
 */

import { computed } from "vue";
import PrivacyFooter from "./PrivacyFooter.vue";
import { deltaWording } from "./lib/scoring";
import type {
  CompletedRun,
  Difficulty,
  QuizQuestion,
  StopReason,
} from "./lib/types";

const props = defineProps<{
  run: CompletedRun;
  history: CompletedRun[];
  questionsById: Record<string, QuizQuestion>;
  tierLabel: string;
  tierBlurb: string;
}>();

const emit = defineEmits<{
  (e: "restart"): void;
  (e: "clear-all"): void;
}>();

const stopReasonText: Record<StopReason, { heading: string; body: string }> = {
  mastery: {
    heading: "Niveau „schwer“ sicher erreicht",
    body: "Du hast zwei schwere Fragen in Folge sicher beantwortet — der Lauf endet hier vorzeitig.",
  },
  max: {
    heading: "Quiz abgeschlossen",
    body: "Hier ist deine Auswertung.",
  },
  floor: {
    heading: "Grundlagen noch nicht gefestigt",
    body: "Wir empfehlen, das Thema noch einmal in Ruhe durchzugehen.",
  },
  pool_exhausted: {
    heading: "Keine weiteren Fragen verfügbar",
    body: "Du hast den Fragenpool ausgeschöpft.",
  },
};

const difficultyLabel: Record<Difficulty, string> = {
  easy: "leicht",
  medium: "mittel",
  hard: "schwer",
};

const previous = computed(() => {
  // history already includes `run` as the last entry; previous = the one before.
  if (props.history.length < 2) return null;
  return props.history[props.history.length - 2] ?? null;
});

const delta = computed(() => {
  if (!previous.value) return null;
  const dpp = Math.round(props.run.scorePercent - previous.value.scorePercent);
  return deltaWording(dpp);
});

const breakdown = computed(() => {
  return (Object.keys(props.run.perDifficulty) as Difficulty[])
    .filter((d) => (props.run.perDifficulty[d]?.asked ?? 0) > 0)
    .map((d) => ({ difficulty: d, ...props.run.perDifficulty[d] }));
});

const reviewItems = computed(() =>
  props.run.askedQuestionIds.map((qid) => {
    const q = props.questionsById[qid];
    const score = props.run.questionScores[qid] ?? 0;
    return {
      id: qid,
      question: q?.question ?? qid,
      section: q?.section ?? null,
      difficulty: q?.difficulty,
      percent: Math.round(score * 100),
    };
  }),
);
</script>

<template>
  <section class="summary-pane" aria-labelledby="qz-summary-heading">
    <header class="summary-stop">
      <h2 id="qz-summary-heading" class="stop-heading">
        {{ stopReasonText[run.stopReason].heading }}
      </h2>
      <p class="stop-body">{{ stopReasonText[run.stopReason].body }}</p>
    </header>

    <div class="tier-card">
      <p class="tier-label">{{ tierLabel }}</p>
      <p class="tier-blurb">{{ tierBlurb }}</p>
      <p class="score-detail">
        <span class="score-percent">{{ Math.round(run.scorePercent) }}%</span>
        <span class="score-explainer">
          ({{ run.scoringStatementsCorrect }} von
          {{ run.scoringStatementsTotal }} Aussagen korrekt eingeschätzt)
        </span>
      </p>
      <p v-if="delta" class="delta-line" :data-tone="delta.tone">
        {{ delta.text }}
      </p>
    </div>

    <table
      class="breakdown-table"
      aria-label="Aufschlüsselung pro Schwierigkeit"
    >
      <caption class="breakdown-caption">
        Pro Schwierigkeit
      </caption>
      <thead>
        <tr>
          <th scope="col">Schwierigkeit</th>
          <th scope="col">gestellt</th>
          <th scope="col">voll</th>
          <th scope="col">teils</th>
          <th scope="col">verfehlt</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in breakdown" :key="row.difficulty">
          <th scope="row">{{ difficultyLabel[row.difficulty] }}</th>
          <td>{{ row.asked }}</td>
          <td>{{ row.fullCount }}</td>
          <td>{{ row.partialCount }}</td>
          <td>{{ row.noneCount }}</td>
        </tr>
      </tbody>
    </table>

    <ol class="review-list">
      <li v-for="item in reviewItems" :key="item.id" class="review-item">
        <span v-if="item.section" class="review-section">{{
          item.section
        }}</span>
        <span class="review-question">{{ item.question }}</span>
        <span class="review-percent">{{ item.percent }}%</span>
      </li>
    </ol>

    <div class="summary-actions">
      <button type="button" class="primary-btn" @click.stop="emit('restart')">
        Quiz neu starten
      </button>
    </div>

    <PrivacyFooter compact @clear-all="emit('clear-all')" />
  </section>
</template>

<style scoped>
.summary-pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: "Inter", sans-serif;
  font-size: 12px;
  color: var(--qz-text);
}

.summary-stop {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.stop-heading {
  margin: 0;
  font-size: 14px;
  color: var(--qz-accent);
  font-weight: 600;
}
.stop-body {
  margin: 0;
  font-size: 10.5px;
  color: var(--qz-text-muted);
  line-height: 1.4;
}

.tier-card {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 7px 10px;
  border: 0.5px solid var(--qz-border);
  border-radius: 6px;
  background: var(--qz-panel-bg);
}
.tier-label {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--qz-text);
  letter-spacing: 0.005em;
}
.tier-blurb {
  margin: 0;
  font-size: 11px;
  color: var(--qz-text);
  line-height: 1.4;
}
.score-detail {
  margin: 1px 0 0;
  font-size: 10px;
  color: var(--qz-text-muted);
}
.score-percent {
  font-family: "0xProto", monospace;
  font-weight: 600;
  color: var(--qz-accent);
  margin-right: 5px;
}
.delta-line {
  margin: 1px 0 0;
  font-size: 10.5px;
  color: var(--qz-text);
}
.delta-line[data-tone="strong-up"] {
  color: var(--qz-success);
}
.delta-line[data-tone="up"] {
  color: var(--qz-success);
}
.delta-line[data-tone="flat"] {
  color: var(--qz-text-muted);
}
.delta-line[data-tone="down"] {
  color: var(--qz-warning);
}
.delta-line[data-tone="strong-down"] {
  color: var(--qz-error);
}

.breakdown-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
}
.breakdown-caption {
  font-size: 9.5px;
  color: var(--qz-text-muted);
  text-align: left;
  letter-spacing: 0.05em;
  padding-bottom: 2px;
}
.breakdown-table th,
.breakdown-table td {
  padding: 2px 6px;
  border-bottom: 0.5px dashed var(--qz-border);
  text-align: left;
}
.breakdown-table th[scope="col"] {
  color: var(--qz-text-muted);
  font-weight: 500;
}
.breakdown-table td {
  font-family: "0xProto", monospace;
  color: var(--qz-text);
}

.review-list {
  list-style: none;
  margin: 0;
  padding: 5px 9px;
  border: 0.5px solid var(--qz-border);
  border-radius: 6px;
  background: var(--qz-panel-bg);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.review-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 10.5px;
}
.review-section {
  padding: 1px 6px;
  border-radius: 999px;
  border: 0.5px solid var(--qz-border);
  font-size: 9.5px;
  color: var(--qz-text-muted);
  white-space: nowrap;
}
.review-question {
  color: var(--qz-text);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.review-percent {
  font-family: "0xProto", monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--qz-panel-bg);
  border: 0.5px solid var(--qz-border);
  color: var(--qz-text-muted);
}

.summary-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
.primary-btn:hover {
  background: var(--qz-accent);
  color: var(--qz-bg);
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
