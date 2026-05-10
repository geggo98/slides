/**
 * Five-state feedback semantics. The state combines the answer's verdict
 * with the user's pick. Each state has a deterministic icon, two-part
 * wording (Resultat + Aussage-Wahrheit) and a CSS class hook.
 */

import type { FeedbackState, Verdict } from "./types";

export function classify(verdict: Verdict, checked: boolean): FeedbackState {
  if (verdict === "depends") return "depends";
  if (verdict === "true") return checked ? "hit" : "missed";
  return checked ? "wrongPick" : "correctOmit";
}

export interface PillSpec {
  result: string;
  truth: string;
  icon: string;
  cssClass: string;
}

export const PILL_WORDING: Record<FeedbackState, PillSpec> = {
  hit: {
    result: "Treffer",
    truth: "Aussage trifft zu",
    icon: "✓",
    cssClass: "fb-success",
  },
  correctOmit: {
    result: "Treffer",
    truth: "Aussage trifft nicht zu",
    icon: "✓",
    cssClass: "fb-success",
  },
  wrongPick: {
    result: "Fälschlich ausgewählt",
    truth: "Aussage trifft nicht zu",
    icon: "✗",
    cssClass: "fb-error",
  },
  missed: {
    result: "Übersehen",
    truth: "Aussage trifft zu",
    icon: "⚠",
    cssClass: "fb-warning",
  },
  depends: {
    result: "Kontextabhängig",
    truth: "Aussage hängt vom Szenario ab",
    icon: "⚖",
    cssClass: "fb-tradeoff",
  },
};
