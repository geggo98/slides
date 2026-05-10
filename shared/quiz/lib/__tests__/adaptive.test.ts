import { describe, expect, it } from "vitest";
import {
  evaluateStopReason,
  nextDifficulty,
  performanceOf,
  pickNextQuestion,
  sampleOptions,
  scoreOf,
} from "../adaptive";
import type { Difficulty, QuizOption, QuizQuestion } from "../types";

const opt = (
  id: string,
  verdict: QuizOption["verdict"],
  text = id,
): QuizOption => ({ id, text, verdict, explanation: "" });

const q = (
  id: string,
  difficulty: Difficulty,
  options: QuizOption[],
): QuizQuestion => ({ id, difficulty, options, question: id });

describe("scoreOf", () => {
  it("counts correct picks and correct omissions", () => {
    const sampled = [
      opt("a", "true"),
      opt("b", "false"),
      opt("c", "true"),
      opt("d", "false"),
    ];
    const selected = new Set(["a", "c"]);
    expect(scoreOf(sampled, selected)).toBe(1);
  });
  it("excludes depends from the denominator", () => {
    const sampled = [
      opt("a", "true"),
      opt("b", "false"),
      opt("c", "depends"),
      opt("d", "depends"),
    ];
    const selected = new Set(["a"]);
    expect(scoreOf(sampled, selected)).toBe(1);
  });
  it("returns 0 for all-wrong picks", () => {
    const sampled = [opt("a", "true"), opt("b", "false")];
    const selected = new Set(["b"]);
    expect(scoreOf(sampled, selected)).toBe(0);
  });
  it("falls back to 0.5 when only depends are sampled", () => {
    const sampled = [opt("a", "depends"), opt("b", "depends")];
    expect(scoreOf(sampled, new Set())).toBe(0.5);
  });
});

describe("performanceOf", () => {
  it("classifies the three buckets", () => {
    expect(performanceOf(0)).toBe("none");
    expect(performanceOf(0.5)).toBe("partial");
    expect(performanceOf(1)).toBe("full");
  });
});

describe("nextDifficulty", () => {
  it("escalates on score >= 0.75", () => {
    expect(nextDifficulty("easy", 0.75)).toBe("medium");
    expect(nextDifficulty("medium", 0.75)).toBe("hard");
    expect(nextDifficulty("hard", 1)).toBe("hard"); // clamped
  });
  it("de-escalates on score <= 0.25", () => {
    expect(nextDifficulty("hard", 0.25)).toBe("medium");
    expect(nextDifficulty("medium", 0.25)).toBe("easy");
    expect(nextDifficulty("easy", 0)).toBe("easy"); // clamped
  });
  it("stays in trade-off zone (0.25 < score < 0.75)", () => {
    expect(nextDifficulty("medium", 0.5)).toBe("medium");
    expect(nextDifficulty("medium", 0.74)).toBe("medium");
    expect(nextDifficulty("medium", 0.26)).toBe("medium");
  });
});

describe("evaluateStopReason", () => {
  const ask = (difficulty: Difficulty, score: number) => ({
    difficulty,
    score,
    submitted: true,
  });
  it("returns mastery on 2 hard ≥ 0.75 after 3+ submitted", () => {
    expect(
      evaluateStopReason(
        [ask("medium", 0.5), ask("hard", 0.8), ask("hard", 0.9)],
        { maxQuestions: 6, floorStopEnabled: false },
      ),
    ).toBe("mastery");
  });
  it("does not return mastery before 3 questions", () => {
    expect(
      evaluateStopReason([ask("hard", 1), ask("hard", 1)], {
        maxQuestions: 4,
        floorStopEnabled: false,
      }),
    ).toBeNull();
  });
  it("returns floor only when enabled and 2 easy ≤ 0.25", () => {
    const asked = [ask("medium", 0.5), ask("easy", 0.2), ask("easy", 0.1)];
    expect(
      evaluateStopReason(asked, { maxQuestions: 4, floorStopEnabled: false }),
    ).toBeNull();
    expect(
      evaluateStopReason(asked, { maxQuestions: 4, floorStopEnabled: true }),
    ).toBe("floor");
  });
  it("returns max when reached", () => {
    expect(
      evaluateStopReason(
        [
          ask("medium", 0.5),
          ask("medium", 0.5),
          ask("medium", 0.5),
          ask("medium", 0.5),
        ],
        { maxQuestions: 4, floorStopEnabled: false },
      ),
    ).toBe("max");
  });
  it("ignores not-yet-submitted entries", () => {
    expect(
      evaluateStopReason(
        [
          { difficulty: "hard", score: 1, submitted: true },
          { difficulty: "hard", score: 1, submitted: true },
          { difficulty: "easy", score: 0, submitted: false },
        ],
        { maxQuestions: 4, floorStopEnabled: false },
      ),
    ).toBeNull();
  });
});

describe("pickNextQuestion", () => {
  const pool: QuizQuestion[] = [
    q("e1", "easy", []),
    q("e2", "easy", []),
    q("m1", "medium", []),
    q("m2", "medium", []),
    q("h1", "hard", []),
  ];
  const memory = {
    questionExposure: {} as Record<string, number>,
    questionFailureCount: {} as Record<string, number>,
  };
  it("picks from desired difficulty when available", () => {
    const picked = pickNextQuestion(pool, new Set(), "medium", memory, {
      rng: () => 0,
    });
    expect(picked?.difficulty).toBe("medium");
  });
  it("falls back toward center when desired bucket exhausted", () => {
    const picked = pickNextQuestion(pool, new Set(["h1"]), "hard", memory, {
      rng: () => 0,
    });
    expect(picked?.difficulty).toBe("medium");
  });
  it("prefers least-exposed within a tier", () => {
    const exp = {
      questionExposure: { m1: 5, m2: 0 },
      questionFailureCount: {},
    };
    const picked = pickNextQuestion(pool, new Set(), "medium", exp, {
      rng: () => 0,
    });
    expect(picked?.id).toBe("m2");
  });
  it("returns null when pool is exhausted", () => {
    expect(
      pickNextQuestion(
        pool,
        new Set(["e1", "e2", "m1", "m2", "h1"]),
        "easy",
        memory,
      ),
    ).toBeNull();
  });
});

describe("sampleOptions", () => {
  const question = q("q1", "medium", [
    opt("c1", "true"),
    opt("c2", "true"),
    opt("c3", "true"),
    opt("w1", "false"),
    opt("w2", "false"),
    opt("w3", "false"),
    opt("d1", "depends"),
    opt("d2", "depends"),
  ]);
  const exposure = { optionExposure: {} as Record<string, number> };

  it("returns exactly k options", () => {
    const out = sampleOptions(question, 4, exposure, { rng: () => 0.5 });
    expect(out).toHaveLength(4);
  });
  it("guarantees at least one true and one false", () => {
    for (let i = 0; i < 50; i++) {
      const out = sampleOptions(question, 4, exposure);
      expect(out.some((o) => o.verdict === "true")).toBe(true);
      expect(out.some((o) => o.verdict === "false")).toBe(true);
    }
  });
  it("prefers least-exposed options within a stratum", () => {
    const exp = {
      optionExposure: {
        "q1::c1": 10,
        "q1::c2": 0,
        "q1::c3": 10,
      } as Record<string, number>,
    };
    const out = sampleOptions(question, 4, exp, { rng: () => 0 });
    expect(out.some((o) => o.id === "c2")).toBe(true);
  });
});
