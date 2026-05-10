/**
 * localStorage helpers for the quiz. Two keys per quiz id:
 *   quiz:<id>:run    → RunState | absent
 *   quiz:<id>:memory → QuizMemory
 *
 * All functions tolerate a missing or malformed payload by falling back to
 * sensible defaults so a corrupted entry never crashes the UI.
 */

import {
  EMPTY_MEMORY,
  type CompletedRun,
  type QuizMemory,
  type RunState,
} from "./types";

export const RUN_KEY = (id: string) => `quiz:${id}:run`;
export const MEMORY_KEY = (id: string) => `quiz:${id}:memory`;

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(): StorageBackend | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const ls = (globalThis as { localStorage?: StorageBackend }).localStorage;
    if (!ls) return null;
    const probe = "__quiz_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadRunState(
  quizId: string,
  storage: StorageBackend | null = safeStorage(),
): RunState | null {
  if (!storage) return null;
  return safeParse<RunState | null>(storage.getItem(RUN_KEY(quizId)), null);
}

export function saveRunState(
  quizId: string,
  run: RunState,
  storage: StorageBackend | null = safeStorage(),
): void {
  if (!storage) return;
  storage.setItem(RUN_KEY(quizId), JSON.stringify(run));
}

export function clearRunState(
  quizId: string,
  storage: StorageBackend | null = safeStorage(),
): void {
  if (!storage) return;
  storage.removeItem(RUN_KEY(quizId));
}

export function loadMemory(
  quizId: string,
  storage: StorageBackend | null = safeStorage(),
): QuizMemory {
  if (!storage) return cloneEmpty();
  const raw = safeParse<Partial<QuizMemory>>(
    storage.getItem(MEMORY_KEY(quizId)),
    {},
  );
  return {
    questionExposure: raw.questionExposure ?? {},
    optionExposure: raw.optionExposure ?? {},
    questionFailureCount: raw.questionFailureCount ?? {},
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

export function saveMemory(
  quizId: string,
  memory: QuizMemory,
  storage: StorageBackend | null = safeStorage(),
): void {
  if (!storage) return;
  storage.setItem(MEMORY_KEY(quizId), JSON.stringify(memory));
}

export function clearMemory(
  quizId: string,
  storage: StorageBackend | null = safeStorage(),
): void {
  if (!storage) return;
  storage.removeItem(MEMORY_KEY(quizId));
}

/** Append a completed run to history, trimming if it exceeds the limit. */
export function appendHistory(
  memory: QuizMemory,
  run: CompletedRun,
  trimAt: number,
): QuizMemory {
  const history = [...memory.history, run];
  while (history.length > trimAt) history.shift();
  return { ...memory, history };
}

function cloneEmpty(): QuizMemory {
  return {
    questionExposure: { ...EMPTY_MEMORY.questionExposure },
    optionExposure: { ...EMPTY_MEMORY.optionExposure },
    questionFailureCount: { ...EMPTY_MEMORY.questionFailureCount },
    history: [],
  };
}
