<script setup lang="ts">
/**
 * NullSafetyQuiz — self-paced multiple-choice quiz placed after the talk's
 * end slide so audience members can test their understanding without the
 * speaker present.
 *
 * Requirements:
 *  - Questions and answers are data-only (quiz-questions.json).
 *  - Each run shows QUIZ_CONFIG.questionsPerRun questions, each with
 *    QUIZ_CONFIG.answersPerQuestion answer options sampled from 8.
 *  - Adaptive difficulty: starts at medium, escalates on score >=
 *    escalateAt, de-escalates on score < deescalateBelow. Score is
 *    computed over GRADED (non-`depends`) displayed answers only.
 *  - Each answer is correct / wrong / depends. `depends` answers are not
 *    scored; their rationale presents the alternative perspective.
 *  - After submission: per-answer verdict badge + rationale + general
 *    explanation. Checkboxes lock.
 *  - Final bucket label + percentage; "Nochmal" re-samples from scratch
 *    (no carry-over of last difficulty).
 *  - Each question is tagged with the deck section it relates to (or
 *    `abschnittsübergreifend` / `transfer` when it spans / exceeds the
 *    talk). Displayed as a small badge above the stem.
 *  - JSON authoring invariants (asserted on mount): exactly 8 answers,
 *    >= 2 correct, >= 2 wrong, 0..2 depends, length budgets per the
 *    Slidev 980x552 logical-canvas constraint (no internal scrolling).
 *  - Slidev intercepts Space/Arrows for slide nav: handlers therefore
 *    stop propagation so toggling answers does not advance the slide.
 */

import { computed, onMounted, ref } from "vue";
import { useDarkMode } from "@slidev/client";
import questionsData from "./quiz-questions.json";

// ---------------------------------------------------------------------------
// Tuning knobs — change here to alter quiz behavior.
// ---------------------------------------------------------------------------
const QUIZ_CONFIG = {
  questionsPerRun: 4,
  answersPerQuestion: 4,
  escalateAt: 0.85,
  deescalateBelow: 0.5,
  seedDifficulty: 2 as 1 | 2 | 3,
} as const;

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------
type Verdict = "correct" | "wrong" | "depends";
type Difficulty = 1 | 2 | 3;
type Section =
  | "JSpecify"
  | "Optional"
  | "Build & Lombok"
  | "Spring Boot 4"
  | "Refinement"
  | "Andere JVM-Sprachen"
  | "Was kommt nativ?"
  | "Action Plan"
  | "Bonus"
  | "abschnittsübergreifend"
  | "transfer";

interface Answer {
  text: string;
  verdict: Verdict;
  rationale: string;
}
interface Question {
  id: string;
  difficulty: Difficulty;
  section: Section;
  stem: string;
  explanation: string;
  answers: Answer[];
}
interface SampledQuestion extends Question {
  shown: Answer[];
}

const POOL: Question[] = (questionsData as { questions: Question[] }).questions;

// ---------------------------------------------------------------------------
// Authoring-invariant assertions (dev only — visible in console)
// ---------------------------------------------------------------------------
function assertInvariants() {
  console.assert(
    POOL.length >= QUIZ_CONFIG.questionsPerRun,
    `Quiz pool too small: ${POOL.length} < ${QUIZ_CONFIG.questionsPerRun}`,
  );
  for (const q of POOL) {
    const c = q.answers.filter((a) => a.verdict === "correct").length;
    const w = q.answers.filter((a) => a.verdict === "wrong").length;
    const d = q.answers.filter((a) => a.verdict === "depends").length;
    console.assert(
      q.answers.length === 8,
      `Q ${q.id}: expected 8 answers, got ${q.answers.length}`,
    );
    console.assert(c >= 2, `Q ${q.id}: needs >=2 correct (has ${c})`);
    console.assert(w >= 2, `Q ${q.id}: needs >=2 wrong (has ${w})`);
    console.assert(d <= 2, `Q ${q.id}: at most 2 depends (has ${d})`);
    console.assert(
      q.stem.length <= 140,
      `Q ${q.id}: stem >140 chars (${q.stem.length})`,
    );
    for (const a of q.answers) {
      console.assert(
        a.text.length <= 90,
        `Q ${q.id}: answer text >90 chars: "${a.text}"`,
      );
      console.assert(
        a.rationale.length <= 100,
        `Q ${q.id}: rationale >100 chars: "${a.rationale}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickOne<T>(arr: T[]): T | null {
  return arr.length === 0 ? null : arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick the next question from the pool at the target difficulty.
 * Fall-back order: target -> step toward seed -> step away.
 */
function pickNext(
  pool: Question[],
  usedIds: Set<string>,
  target: Difficulty,
): Question | null {
  const seed = QUIZ_CONFIG.seedDifficulty;
  const order: Difficulty[] = [target];
  const towardSeed = (d: Difficulty): Difficulty =>
    (d < seed ? d + 1 : d > seed ? d - 1 : d) as Difficulty;
  const awayFromSeed = (d: Difficulty): Difficulty =>
    (d < seed
      ? Math.max(1, d - 1)
      : d > seed
        ? Math.min(3, d + 1)
        : d) as Difficulty;
  const stepToward = towardSeed(target);
  if (stepToward !== target) order.push(stepToward);
  for (let d: Difficulty = 1; d <= 3; d = (d + 1) as Difficulty) {
    if (!order.includes(d)) order.push(d);
  }
  const stepAway = awayFromSeed(target);
  if (!order.includes(stepAway)) order.push(stepAway);

  for (const d of order) {
    const candidates = pool.filter(
      (q) => q.difficulty === d && !usedIds.has(q.id),
    );
    const pick = pickOne(candidates);
    if (pick) return pick;
  }
  return null;
}

/**
 * Sample answersPerQuestion answers from a question's 8, guaranteeing at
 * least 1 correct and 1 wrong, with optional 0..1 depends. Final order is
 * shuffled.
 */
function sampleAnswers(q: Question): Answer[] {
  const k = QUIZ_CONFIG.answersPerQuestion;
  const correct = q.answers.filter((a) => a.verdict === "correct");
  const wrong = q.answers.filter((a) => a.verdict === "wrong");
  const depends = q.answers.filter((a) => a.verdict === "depends");
  const picked = new Set<Answer>();
  const c = pickOne(correct);
  if (c) picked.add(c);
  const w = pickOne(wrong);
  if (w) picked.add(w);
  if (depends.length > 0 && Math.random() < depends.length / 8) {
    const d = pickOne(depends);
    if (d) picked.add(d);
  }
  const remaining = q.answers.filter((a) => !picked.has(a));
  for (const a of shuffle(remaining)) {
    if (picked.size >= k) break;
    picked.add(a);
  }
  return shuffle([...picked]);
}

function scoreOf(shown: Answer[], picks: boolean[]): number {
  let graded = 0;
  let correctDecisions = 0;
  for (let i = 0; i < shown.length; i++) {
    if (shown[i].verdict === "depends") continue;
    graded++;
    const want = shown[i].verdict === "correct";
    if (picks[i] === want) correctDecisions++;
  }
  if (graded === 0) return 1; // shouldn't happen given invariant
  return correctDecisions / graded;
}

function nextDifficulty(current: Difficulty, score: number): Difficulty {
  if (score >= QUIZ_CONFIG.escalateAt)
    return Math.min(3, current + 1) as Difficulty;
  if (score < QUIZ_CONFIG.deescalateBelow)
    return Math.max(1, current - 1) as Difficulty;
  return current;
}

// ---------------------------------------------------------------------------
// Reactive run state
// ---------------------------------------------------------------------------
type Mode = "question" | "summary";
const mode = ref<Mode>("question");
const idx = ref(0);
const selected = ref<SampledQuestion[]>([]);
const picks = ref<boolean[][]>([]);
const submitted = ref<boolean[]>([]);
const scores = ref<number[]>([]);
const difficulty = ref<Difficulty>(QUIZ_CONFIG.seedDifficulty);
const usedIds = ref<Set<string>>(new Set());

function startRun() {
  usedIds.value = new Set();
  difficulty.value = QUIZ_CONFIG.seedDifficulty;
  const first = pickNext(POOL, usedIds.value, difficulty.value);
  if (!first) return;
  usedIds.value.add(first.id);
  const sampled: SampledQuestion = { ...first, shown: sampleAnswers(first) };
  selected.value = [sampled];
  picks.value = [Array(sampled.shown.length).fill(false)];
  submitted.value = [false];
  scores.value = [];
  idx.value = 0;
  mode.value = "question";
}

function submitCurrent() {
  const i = idx.value;
  if (submitted.value[i]) return;
  const s = scoreOf(selected.value[i].shown, picks.value[i]);
  scores.value[i] = s;
  submitted.value[i] = true;
  difficulty.value = nextDifficulty(difficulty.value, s);
}

function next() {
  if (!submitted.value[idx.value]) return;
  if (idx.value + 1 >= QUIZ_CONFIG.questionsPerRun) {
    mode.value = "summary";
    return;
  }
  const nq = pickNext(POOL, usedIds.value, difficulty.value);
  if (!nq) {
    mode.value = "summary";
    return;
  }
  usedIds.value.add(nq.id);
  const sampled: SampledQuestion = { ...nq, shown: sampleAnswers(nq) };
  selected.value.push(sampled);
  picks.value.push(Array(sampled.shown.length).fill(false));
  submitted.value.push(false);
  idx.value++;
}

function restart() {
  startRun();
}

function togglePick(qIdx: number, aIdx: number, ev?: Event) {
  if (submitted.value[qIdx]) return;
  ev?.stopPropagation();
  picks.value[qIdx][aIdx] = !picks.value[qIdx][aIdx];
}

// ---------------------------------------------------------------------------
// Computed UI helpers
// ---------------------------------------------------------------------------
const currentQ = computed(() => selected.value[idx.value]);
const currentPicks = computed(() => picks.value[idx.value] ?? []);
const isSubmitted = computed(() => submitted.value[idx.value] ?? false);
const isLastQuestion = computed(
  () => idx.value + 1 >= QUIZ_CONFIG.questionsPerRun,
);

const totalScore = computed(() => {
  if (scores.value.length === 0) return 0;
  const sum = scores.value.reduce((a, b) => a + b, 0);
  return sum / QUIZ_CONFIG.questionsPerRun;
});

const totalPercent = computed(() => Math.round(totalScore.value * 100));

const bucket = computed(() => {
  const t = totalScore.value;
  if (t < 0.25) return "Anfänger:in";
  if (t < 0.5) return "Solide Basis";
  if (t < 0.75) return "Profi";
  return "Spezialist:in";
});

const bucketBlurb = computed(() => {
  const t = totalScore.value;
  if (t < 0.25)
    return "Folien gerne nochmal in Ruhe durchgehen — vor allem die Build- und JSpecify-Abschnitte.";
  if (t < 0.5)
    return "Die Grundlagen sitzen — verfeinere die Trade-offs (Refinement, Spring-Boot-Pitfalls).";
  if (t < 0.75)
    return "Solides Verständnis. Restwissen liegt in den Edge Cases (Mockito, generics, JEP-Roadmap).";
  return "Sehr gut. Du kannst das Team durch eine JSpecify-Migration leiten.";
});

function answerVerdictClass(qIdx: number, aIdx: number): string {
  if (!submitted.value[qIdx]) return "";
  const a = selected.value[qIdx].shown[aIdx];
  const picked = picks.value[qIdx][aIdx];
  if (a.verdict === "depends") return "av-depends";
  const want = a.verdict === "correct";
  return picked === want ? "av-right" : "av-wrong";
}

function answerVerdictLabel(qIdx: number, aIdx: number): string {
  if (!submitted.value[qIdx]) return "";
  const a = selected.value[qIdx].shown[aIdx];
  if (a.verdict === "depends") return "kommt drauf an";
  return a.verdict === "correct" ? "richtig" : "falsch";
}

// ---------------------------------------------------------------------------
// Theme palette — mirrors NarrowingExplorer.vue token shape
// ---------------------------------------------------------------------------
const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#14141c" : "#ffffff",
    panelBg: d ? "#1a1a24" : "#f4f4f5",
    border: d ? "#2a2a35" : "#e4e4e7",
    text: d ? "#c8c8d0" : "#3f3f46",
    textMuted: d ? "rgba(200,200,208,0.6)" : "rgba(63,63,70,0.65)",
    accent: d ? "#fb923c" : "#ea580c",
    accentBg: d ? "rgba(251,146,60,0.12)" : "rgba(234,88,12,0.08)",
    green: d ? "#86efac" : "#16a34a",
    greenBg: d ? "rgba(74,222,128,0.18)" : "rgba(22,163,74,0.12)",
    yellow: d ? "#fde68a" : "#a16207",
    yellowBg: d ? "rgba(250,204,21,0.20)" : "rgba(202,138,4,0.14)",
    red: d ? "#fca5a5" : "#dc2626",
    redBg: d ? "rgba(248,113,113,0.18)" : "rgba(220,38,38,0.12)",
    blue: d ? "#93c5fd" : "#1d4ed8",
    blueBg: d ? "rgba(96,165,250,0.18)" : "rgba(37,99,235,0.12)",
  };
});

const paletteVars = computed(() => ({
  "--qz-bg": P.value.bg,
  "--qz-panel-bg": P.value.panelBg,
  "--qz-border": P.value.border,
  "--qz-text": P.value.text,
  "--qz-text-muted": P.value.textMuted,
  "--qz-accent": P.value.accent,
  "--qz-accent-bg": P.value.accentBg,
  "--qz-green": P.value.green,
  "--qz-green-bg": P.value.greenBg,
  "--qz-yellow": P.value.yellow,
  "--qz-yellow-bg": P.value.yellowBg,
  "--qz-red": P.value.red,
  "--qz-red-bg": P.value.redBg,
  "--qz-blue": P.value.blue,
  "--qz-blue-bg": P.value.blueBg,
}));

function sectionBadgeClass(section: Section): string {
  if (section === "transfer") return "sec-badge sec-transfer";
  if (section === "abschnittsübergreifend") return "sec-badge sec-cross";
  return "sec-badge sec-default";
}

function difficultyLabel(d: Difficulty): string {
  return d === 1 ? "leicht" : d === 2 ? "mittel" : "schwer";
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  assertInvariants();
  startRun();
});
</script>

<template>
  <div
    class="quiz-root"
    :style="paletteVars"
    @keydown.space.stop
    @keydown.enter.stop
    @keydown.left.stop
    @keydown.right.stop
  >
    <!-- ============================== QUESTION ============================ -->
    <div v-if="mode === 'question' && currentQ" class="quiz-pane">
      <div class="meta-row">
        <span class="progress"
          >Frage {{ idx + 1 }} von {{ QUIZ_CONFIG.questionsPerRun }}</span
        >
        <span :class="sectionBadgeClass(currentQ.section)">
          {{
            currentQ.section === "transfer"
              ? "über den Vortrag hinaus"
              : currentQ.section
          }}
        </span>
        <span class="diff-badge" :data-diff="currentQ.difficulty">
          {{ difficultyLabel(currentQ.difficulty) }}
        </span>
      </div>

      <div class="stem">{{ currentQ.stem }}</div>
      <div class="hint">Mehrfachauswahl möglich.</div>

      <div class="answers">
        <label
          v-for="(a, aIdx) in currentQ.shown"
          :key="aIdx"
          class="answer-row"
          :class="answerVerdictClass(idx, aIdx)"
          :for="`q${idx}-a${aIdx}`"
        >
          <input
            :id="`q${idx}-a${aIdx}`"
            type="checkbox"
            :checked="currentPicks[aIdx]"
            :disabled="isSubmitted"
            @click.stop="togglePick(idx, aIdx, $event)"
            @keydown.space.stop
          />
          <span class="answer-text">{{ a.text }}</span>
          <span v-if="isSubmitted" class="verdict-tag">
            {{ answerVerdictLabel(idx, aIdx) }}
          </span>
        </label>
      </div>

      <div v-if="isSubmitted" class="rationales" :aria-live="'polite'">
        <div
          v-for="(a, aIdx) in currentQ.shown"
          :key="aIdx"
          class="rationale-line"
        >
          <span
            class="rationale-marker"
            :class="answerVerdictClass(idx, aIdx)"
          ></span>
          <span class="rationale-text">{{ a.rationale }}</span>
        </div>
        <div class="general-explanation">{{ currentQ.explanation }}</div>
      </div>

      <div class="controls">
        <button
          v-if="!isSubmitted"
          type="button"
          class="primary-btn"
          @click.stop="submitCurrent"
        >
          Antworten
        </button>
        <button v-else type="button" class="primary-btn" @click.stop="next">
          {{ isLastQuestion ? "Auswertung" : "Weiter" }}
        </button>
      </div>
    </div>

    <!-- ============================== SUMMARY ============================= -->
    <div v-else-if="mode === 'summary'" class="quiz-pane summary">
      <div class="summary-header">Auswertung</div>
      <div class="summary-bucket">
        <span class="bucket-label">{{ bucket }}</span>
        <span class="bucket-percent">{{ totalPercent }}%</span>
      </div>
      <div class="summary-blurb">{{ bucketBlurb }}</div>

      <div class="per-question">
        <div v-for="(q, qIdx) in selected" :key="qIdx" class="per-q-row">
          <span class="per-q-num">{{ qIdx + 1 }}.</span>
          <span class="per-q-section">{{
            q.section === "transfer" ? "transfer" : q.section
          }}</span>
          <span class="per-q-stem">{{ q.stem }}</span>
          <span
            class="per-q-score"
            :data-pct="Math.round((scores[qIdx] ?? 0) * 100)"
          >
            {{ Math.round((scores[qIdx] ?? 0) * 100) }}%
          </span>
        </div>
      </div>

      <div class="controls">
        <button type="button" class="primary-btn" @click.stop="restart">
          Nochmal
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz-root {
  font-family: "Inter", sans-serif;
  color: var(--qz-text);
  font-size: 12px;
  line-height: 1.45;
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
}

.quiz-pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* meta row ---------------------------------------------------------------- */
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
}
.progress {
  color: var(--qz-text-muted);
  font-family: "0xProto", monospace;
  margin-right: auto;
}
.sec-badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  letter-spacing: 0.02em;
  border: 0.5px solid var(--qz-border);
  background: var(--qz-panel-bg);
  color: var(--qz-text-muted);
}
.sec-default {
  border-color: var(--qz-blue);
  color: var(--qz-blue);
  background: var(--qz-blue-bg);
}
.sec-cross {
  border-color: var(--qz-yellow);
  color: var(--qz-yellow);
  background: var(--qz-yellow-bg);
}
.sec-transfer {
  border-color: var(--qz-accent);
  color: var(--qz-accent);
  background: var(--qz-accent-bg);
  font-weight: 600;
}
.diff-badge {
  font-family: "0xProto", monospace;
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--qz-panel-bg);
  border: 0.5px solid var(--qz-border);
  color: var(--qz-text-muted);
}
.diff-badge[data-diff="3"] {
  border-color: var(--qz-red);
  color: var(--qz-red);
  background: var(--qz-red-bg);
}
.diff-badge[data-diff="2"] {
  border-color: var(--qz-yellow);
  color: var(--qz-yellow);
  background: var(--qz-yellow-bg);
}
.diff-badge[data-diff="1"] {
  border-color: var(--qz-green);
  color: var(--qz-green);
  background: var(--qz-green-bg);
}

/* stem -------------------------------------------------------------------- */
.stem {
  font-size: 14px;
  font-weight: 500;
  color: var(--qz-text);
  margin: 4px 0 0;
  line-height: 1.35;
}
.hint {
  font-size: 10px;
  color: var(--qz-text-muted);
  margin-bottom: 4px;
}

/* answers ----------------------------------------------------------------- */
.answers {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.answer-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border: 0.5px solid var(--qz-border);
  border-radius: 5px;
  background: var(--qz-panel-bg);
  cursor: pointer;
  font-size: 11.5px;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.answer-row:hover {
  border-color: var(--qz-accent);
}
.answer-row input[type="checkbox"] {
  accent-color: var(--qz-accent);
  width: 13px;
  height: 13px;
  cursor: pointer;
}
.answer-row input[type="checkbox"]:disabled {
  cursor: default;
}
.answer-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}
.verdict-tag {
  font-family: "0xProto", monospace;
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.02em;
}

.av-right {
  border-color: var(--qz-green);
  background: var(--qz-green-bg);
}
.av-right .verdict-tag {
  background: rgba(0, 0, 0, 0.12);
  color: var(--qz-green);
}
.av-wrong {
  border-color: var(--qz-red);
  background: var(--qz-red-bg);
}
.av-wrong .verdict-tag {
  background: rgba(0, 0, 0, 0.12);
  color: var(--qz-red);
}
.av-depends {
  border-color: var(--qz-yellow);
  background: var(--qz-yellow-bg);
}
.av-depends .verdict-tag {
  background: rgba(0, 0, 0, 0.12);
  color: var(--qz-yellow);
}

/* rationales -------------------------------------------------------------- */
.rationales {
  margin-top: 3px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border: 0.5px solid var(--qz-border);
  border-radius: 5px;
  background: var(--qz-panel-bg);
}
.rationale-line {
  display: grid;
  grid-template-columns: 9px 1fr;
  gap: 6px;
  align-items: start;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--qz-text-muted);
}
.rationale-marker {
  width: 7px;
  height: 7px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--qz-text-muted);
}
.rationale-marker.av-right {
  background: var(--qz-green);
}
.rationale-marker.av-wrong {
  background: var(--qz-red);
}
.rationale-marker.av-depends {
  background: var(--qz-yellow);
}
.rationale-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.general-explanation {
  margin-top: 5px;
  padding-top: 5px;
  border-top: 0.5px dashed var(--qz-border);
  font-size: 10.5px;
  color: var(--qz-text);
  line-height: 1.4;
}

/* controls ---------------------------------------------------------------- */
.controls {
  margin-top: 4px;
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

/* summary ----------------------------------------------------------------- */
.summary {
  gap: 8px;
}
.summary-header {
  font-size: 16px;
  font-weight: 500;
  color: var(--qz-accent);
}
.summary-bucket {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.bucket-label {
  font-size: 18px;
  font-weight: 600;
  color: var(--qz-text);
}
.bucket-percent {
  font-family: "0xProto", monospace;
  font-size: 14px;
  color: var(--qz-accent);
}
.summary-blurb {
  font-size: 11.5px;
  color: var(--qz-text-muted);
  line-height: 1.45;
}
.per-question {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 3px;
  padding: 7px 9px;
  border: 0.5px solid var(--qz-border);
  border-radius: 5px;
  background: var(--qz-panel-bg);
}
.per-q-row {
  display: grid;
  grid-template-columns: 18px auto 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 10.5px;
  line-height: 1.4;
}
.per-q-num {
  color: var(--qz-text-muted);
  font-family: "0xProto", monospace;
}
.per-q-section {
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 0.5px solid var(--qz-border);
  color: var(--qz-text-muted);
  white-space: nowrap;
}
.per-q-stem {
  color: var(--qz-text);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.per-q-score {
  font-family: "0xProto", monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--qz-panel-bg);
  border: 0.5px solid var(--qz-border);
  color: var(--qz-text-muted);
}
</style>
