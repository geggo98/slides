import { beforeEach, describe, expect, it } from "vitest";
import {
  appendHistory,
  clearMemory,
  clearRunState,
  loadMemory,
  loadRunState,
  saveMemory,
  saveRunState,
  type StorageBackend,
} from "../persistence";
import type { CompletedRun, QuizMemory, RunState } from "../types";

function makeMockStorage(): StorageBackend & {
  __dump: () => Record<string, string>;
} {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
    __dump: () => Object.fromEntries(store),
  };
}

const QID = "test-quiz";

const sampleRun: RunState = {
  runId: "r1",
  startedAt: "2026-05-09T10:00:00Z",
  asked: [
    {
      questionId: "q1",
      difficulty: "medium",
      sampledOptionIds: ["a", "b", "c", "d"],
      picks: [true, false, false, true],
      submitted: true,
      score: 0.5,
    },
  ],
  currentDifficulty: "medium",
};

const sampleCompleted: CompletedRun = {
  runId: "r1",
  completedAt: "2026-05-09T10:05:00Z",
  stopReason: "max",
  questionsAsked: 4,
  scoringStatementsTotal: 12,
  scoringStatementsCorrect: 9,
  scorePercent: 75,
  perDifficulty: {
    easy: { asked: 1, fullCount: 1, partialCount: 0, noneCount: 0 },
    medium: { asked: 2, fullCount: 1, partialCount: 1, noneCount: 0 },
    hard: { asked: 1, fullCount: 0, partialCount: 1, noneCount: 0 },
  },
  askedQuestionIds: ["q1", "q2", "q3", "q4"],
  questionScores: { q1: 1, q2: 0.5, q3: 1, q4: 0.5 },
};

describe("RunState round-trip", () => {
  let storage: ReturnType<typeof makeMockStorage>;
  beforeEach(() => {
    storage = makeMockStorage();
  });
  it("returns null when no run is stored", () => {
    expect(loadRunState(QID, storage)).toBeNull();
  });
  it("saves and re-loads identically", () => {
    saveRunState(QID, sampleRun, storage);
    expect(loadRunState(QID, storage)).toEqual(sampleRun);
  });
  it("clearRunState removes the run key", () => {
    saveRunState(QID, sampleRun, storage);
    clearRunState(QID, storage);
    expect(loadRunState(QID, storage)).toBeNull();
  });
  it("survives malformed JSON by returning null", () => {
    storage.setItem(`quiz:${QID}:run`, "{not json");
    expect(loadRunState(QID, storage)).toBeNull();
  });
});

describe("Memory round-trip", () => {
  let storage: ReturnType<typeof makeMockStorage>;
  beforeEach(() => {
    storage = makeMockStorage();
  });
  it("returns an empty memory shape when nothing stored", () => {
    const m = loadMemory(QID, storage);
    expect(m.questionExposure).toEqual({});
    expect(m.optionExposure).toEqual({});
    expect(m.questionFailureCount).toEqual({});
    expect(m.history).toEqual([]);
  });
  it("saves and re-loads identically", () => {
    const m: QuizMemory = {
      questionExposure: { q1: 3 },
      optionExposure: { "q1::a": 1 },
      questionFailureCount: { q1: 1 },
      history: [sampleCompleted],
    };
    saveMemory(QID, m, storage);
    expect(loadMemory(QID, storage)).toEqual(m);
  });
  it("clearMemory removes the memory key only", () => {
    saveRunState(QID, sampleRun, storage);
    saveMemory(
      QID,
      { ...loadMemory(QID, storage), questionExposure: { q1: 1 } },
      storage,
    );
    clearMemory(QID, storage);
    expect(loadMemory(QID, storage).questionExposure).toEqual({});
    expect(loadRunState(QID, storage)).toEqual(sampleRun);
  });
  it("clearRunState keeps memory intact", () => {
    saveRunState(QID, sampleRun, storage);
    saveMemory(
      QID,
      { ...loadMemory(QID, storage), questionExposure: { q1: 1 } },
      storage,
    );
    clearRunState(QID, storage);
    expect(loadMemory(QID, storage).questionExposure).toEqual({ q1: 1 });
  });
});

describe("appendHistory", () => {
  it("appends to the history array", () => {
    const m: QuizMemory = {
      questionExposure: {},
      optionExposure: {},
      questionFailureCount: {},
      history: [],
    };
    const out = appendHistory(m, sampleCompleted, 100);
    expect(out.history).toHaveLength(1);
    expect(out.history[0]?.runId).toBe("r1");
  });
  it("trims to limit when exceeded", () => {
    const m: QuizMemory = {
      questionExposure: {},
      optionExposure: {},
      questionFailureCount: {},
      history: Array.from({ length: 100 }, (_, i) => ({
        ...sampleCompleted,
        runId: `r${i}`,
      })),
    };
    const out = appendHistory(m, { ...sampleCompleted, runId: "rNEW" }, 100);
    expect(out.history).toHaveLength(100);
    expect(out.history[0]?.runId).toBe("r1");
    expect(out.history.at(-1)?.runId).toBe("rNEW");
  });
});
