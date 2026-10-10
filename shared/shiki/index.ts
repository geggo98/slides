import type { LanguageRegistration } from "shiki";
import { logql } from "./logql";
import { promql } from "./promql";
import { traceql } from "./traceql";

export { logql, promql, traceql };

/** Alle Grammatiken für `langs:` in einem Deck-`setup/shiki.ts`. */
export const queryLangs: LanguageRegistration[] = [promql, logql, traceql];
