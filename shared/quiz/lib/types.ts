/**
 * Type definitions for the reusable quiz infrastructure.
 *
 * `Quiz` is the input data shape (loaded from JSON). `RunState` is the live
 * working state during a single run. `QuizMemory` is the cross-run, per-user
 * persistent memory (exposure counts + run history).
 */

export type Verdict = "true" | "false" | "depends";
export type Difficulty = "easy" | "medium" | "hard";
export type StopReason = "mastery" | "max" | "floor" | "pool_exhausted";
export type Tier = "Top" | "Stark" | "Solide" | "Mitte" | "Lücken" | "Anfang";

export type FeedbackState =
  | "hit"
  | "correctOmit"
  | "wrongPick"
  | "missed"
  | "depends";

export interface QuizOption {
  id: string;
  text: string;
  verdict: Verdict;
  explanation: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  difficulty: Difficulty;
  options: QuizOption[];
  framingHint?: string;
  section?: string;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title?: string;
  questions: QuizQuestion[];
}

export interface QuizConfig {
  maxQuestions: number;
  optionsPerQuestion: number;
  seedDifficulty: Difficulty;
  floorStopEnabled: boolean;
  enableSpacedRepetition: boolean;
  spacedRepetitionWeight: number;
  tierWordingVariant: "A" | "B";
  historyTrimAt: number;
}

export const DEFAULT_CONFIG: QuizConfig = {
  maxQuestions: 4,
  optionsPerQuestion: 4,
  seedDifficulty: "medium",
  floorStopEnabled: false,
  enableSpacedRepetition: false,
  spacedRepetitionWeight: 1.0,
  tierWordingVariant: "B",
  historyTrimAt: 100,
};

export interface AskedQuestion {
  questionId: string;
  difficulty: Difficulty;
  sampledOptionIds: string[];
  picks: boolean[];
  submitted: boolean;
  score?: number;
}

export interface RunState {
  runId: string;
  startedAt: string;
  asked: AskedQuestion[];
  currentDifficulty: Difficulty;
  stopReason?: StopReason;
}

export interface CompletedRun {
  runId: string;
  completedAt: string;
  stopReason: StopReason;
  questionsAsked: number;
  scoringStatementsTotal: number;
  scoringStatementsCorrect: number;
  scorePercent: number;
  perDifficulty: Record<
    Difficulty,
    {
      asked: number;
      fullCount: number;
      partialCount: number;
      noneCount: number;
    }
  >;
  askedQuestionIds: string[];
  questionScores: Record<string, number>;
}

export interface QuizMemory {
  questionExposure: Record<string, number>;
  optionExposure: Record<string, number>;
  questionFailureCount: Record<string, number>;
  history: CompletedRun[];
}

export const EMPTY_MEMORY: QuizMemory = {
  questionExposure: {},
  optionExposure: {},
  questionFailureCount: {},
  history: [],
};
