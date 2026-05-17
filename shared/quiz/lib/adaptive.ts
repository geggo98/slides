/**
 * Adaption, sampling and stop-condition logic. Pure functions, no Vue.
 *
 *   scoreOf            — fraction of correctly classified scoring options
 *   performanceOf      — three-bucket UI label for the per-difficulty breakdown
 *   nextDifficulty     — Elo-inspired step (Wauters et al. 2010 thresholds)
 *   evaluateStopReason — mastery / floor / max ordering per FR-064
 *   pickNextQuestion   — exposure-biased question pick with fallback ladder
 *   sampleOptions      — stratified option sampling guaranteeing 1× true & 1× false
 */

import type {
  AskedQuestion,
  Difficulty,
  QuizConfig,
  QuizMemory,
  QuizOption,
  QuizQuestion,
  StopReason,
} from "./types";

export function scoreOf(
  sampled: QuizOption[],
  selected: ReadonlySet<string>,
): number {
  const scoring = sampled.filter((o) => o.verdict !== "depends");
  if (scoring.length === 0) return 0.5;
  let correct = 0;
  for (const o of scoring) {
    const isPicked = selected.has(o.id);
    if (
      (o.verdict === "true" && isPicked) ||
      (o.verdict === "false" && !isPicked)
    )
      correct++;
  }
  return correct / scoring.length;
}

export function performanceOf(score: number): "full" | "partial" | "none" {
  if (score >= 0.999) return "full";
  if (score <= 0.001) return "none";
  return "partial";
}

const DIFF_ORDER: readonly Difficulty[] = ["easy", "medium", "hard"] as const;

export function nextDifficulty(current: Difficulty, score: number): Difficulty {
  const i = DIFF_ORDER.indexOf(current);
  if (score >= 0.75) return DIFF_ORDER[Math.min(i + 1, 2)] as Difficulty;
  if (score <= 0.25) return DIFF_ORDER[Math.max(i - 1, 0)] as Difficulty;
  return current;
}

/**
 * Stop-reason resolution per FR-064: mastery → floor → max → continue.
 * Caller passes the asked-questions slice (only `submitted` ones with a score).
 */
export function evaluateStopReason(
  asked: ReadonlyArray<
    Pick<AskedQuestion, "difficulty" | "score" | "submitted">
  >,
  cfg: Pick<QuizConfig, "maxQuestions" | "floorStopEnabled">,
): StopReason | null {
  const submitted = asked.filter(
    (a) => a.submitted && typeof a.score === "number",
  );
  if (submitted.length >= 3) {
    const last2 = submitted.slice(-2);
    if (last2.every((a) => a.difficulty === "hard" && (a.score ?? 0) >= 0.75))
      return "mastery";
    if (
      cfg.floorStopEnabled &&
      last2.every((a) => a.difficulty === "easy" && (a.score ?? 0) <= 0.25)
    )
      return "floor";
  }
  if (submitted.length >= cfg.maxQuestions) return "max";
  return null;
}

function towardCenter(d: Difficulty): readonly Difficulty[] {
  // Fallback ladder when the desired difficulty has no remaining questions.
  if (d === "hard") return ["medium", "easy"];
  if (d === "easy") return ["medium", "hard"];
  return ["hard", "easy"];
}

export interface PickNextOpts {
  enableSpacedRepetition?: boolean;
  spacedRepetitionWeight?: number;
  rng?: () => number;
}

/**
 * Choose the next question. Adaption beats exposure: if the desired
 * difficulty still has unseen items, the choice happens within that bucket.
 * Within a bucket, items are scored by exposure (lower = preferred); when
 * spaced-repetition is on, past-failure count subtracts from the score so
 * previously-failed items leap ahead.
 *
 * `excludeIds` is what to skip. In exhaust-correct mode the caller passes
 * only the perfectly-answered question IDs, so wrong/partial answers stay
 * in rotation. When this returns `null` the caller may retry with an empty
 * Set (cycle reset) before giving up with `pool_exhausted`.
 */
export function pickNextQuestion(
  pool: readonly QuizQuestion[],
  excludeIds: ReadonlySet<string>,
  desired: Difficulty,
  memory: Pick<QuizMemory, "questionExposure" | "questionFailureCount">,
  opts: PickNextOpts = {},
): QuizQuestion | null {
  const { enableSpacedRepetition = false, spacedRepetitionWeight = 1.0 } = opts;
  const rng = opts.rng ?? Math.random;
  const remaining = pool.filter((q) => !excludeIds.has(q.id));
  if (remaining.length === 0) return null;

  const ladder: Difficulty[] = [desired, ...towardCenter(desired)];
  for (const d of ladder) {
    const candidates = remaining.filter((q) => q.difficulty === d);
    if (candidates.length === 0) continue;
    const priority = (q: QuizQuestion) => {
      const exp = memory.questionExposure[q.id] ?? 0;
      const fail = enableSpacedRepetition
        ? (memory.questionFailureCount[q.id] ?? 0)
        : 0;
      return exp - spacedRepetitionWeight * fail;
    };
    const minPriority = Math.min(...candidates.map(priority));
    const leastSeen = candidates.filter((q) => priority(q) === minPriority);
    return leastSeen[Math.floor(rng() * leastSeen.length)] ?? null;
  }
  return null;
}

export interface SampleOptionsOpts {
  rng?: () => number;
}

/**
 * Sample `k` options from a question. Guarantees ≥ 1 `true` and ≥ 1 `false`
 * if the pool allows. Within each verdict stratum, prefers least-exposed
 * options. Final order is shuffled.
 */
export function sampleOptions(
  question: QuizQuestion,
  k: number,
  exposure: Pick<QuizMemory, "optionExposure">,
  opts: SampleOptionsOpts = {},
): QuizOption[] {
  const rng = opts.rng ?? Math.random;
  const expKey = (o: QuizOption) => `${question.id}::${o.id}` as const;

  const sortedByExposure = (arr: QuizOption[]): QuizOption[] => {
    const tagged = arr.map((o) => ({
      o,
      e: exposure.optionExposure[expKey(o)] ?? 0,
      r: rng(),
    }));
    tagged.sort((a, b) => a.e - b.e || a.r - b.r);
    return tagged.map((t) => t.o);
  };

  const truths = sortedByExposure(
    question.options.filter((o) => o.verdict === "true"),
  );
  const falses = sortedByExposure(
    question.options.filter((o) => o.verdict === "false"),
  );
  const dependsList = sortedByExposure(
    question.options.filter((o) => o.verdict === "depends"),
  );

  const picked: QuizOption[] = [];
  if (truths.length > 0 && picked.length < k)
    picked.push(truths[0] as QuizOption);
  if (falses.length > 0 && picked.length < k)
    picked.push(falses[0] as QuizOption);

  // Fill the remainder by re-merging strata (least-exposed first across all).
  const remaining = question.options
    .filter((o) => !picked.includes(o))
    .map((o) => ({ o, e: exposure.optionExposure[expKey(o)] ?? 0, r: rng() }));
  remaining.sort((a, b) => a.e - b.e || a.r - b.r);
  for (const { o } of remaining) {
    if (picked.length >= k) break;
    picked.push(o);
  }

  // Avoid using `dependsList` directly above — it's already covered by the
  // remainder, but reference it so unused-variable lint stays quiet and the
  // intent (depends are eligible fillers) remains visible to readers.
  void dependsList;

  // Shuffle final display order.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picked[i], picked[j]] = [picked[j] as QuizOption, picked[i] as QuizOption];
  }
  return picked;
}
