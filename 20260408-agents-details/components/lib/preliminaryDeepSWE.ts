// VORLÄUFIG — SELBSTBERICHTET, NICHT VON DEEPSWE GEMESSEN.
// ---------------------------------------------------------------------------
// Drei Zahlen, die die Hersteller selbst bei der Ankündigung ihrer Modelle
// genannt haben, nicht Datacurve. Beide Tracking-Issues sind offen und enden
// mit „Please test“ — DeepSWE hat am 23.09.2026 noch nichts nachgemessen:
//
//   https://github.com/datacurve-ai/deep-swe/issues/98  (Claude Opus 5.5)
//   https://github.com/datacurve-ai/deep-swe/issues/99  (GPT-6 Sol + Luna)
//
// Ersetzen, sobald eines der beiden Issues einen echten Board-Wert bringt —
// und diese Datei dann LÖSCHEN, nicht nur editieren: Kein Re-Export über
// `paretoData.ts`, damit `grep -rl preliminaryDeepSWE` beim Aufräumen jede
// betroffene Stelle findet (aktuell nur `EffortFalle.vue`).
//
// Bewusst keine €/Task-Spalte: Opus 5.5 nennt gar keinen Preis, und das
// OpenAI-Chart zu Sol/Luna ist zu niedrig aufgelöst, um eine Kosten-Zahl
// daraus abzulesen, ohne sie zu erfinden. Deshalb Text/Tabelle statt
// Chart-Punkt — ein Punkt bräuchte eine belastbare x-Koordinate.

export interface Preliminary {
  label: string;
  /** Anzeigename wie auf der Folie, nicht der Board-Slug (den gibt es noch nicht). */
  displayName: string;
  /** Pass@1 in Prozent, wie vom Hersteller genannt. */
  y: number;
  /** Nur wenn genannt — Opus 5.5 nennt keine Stufe. */
  effort?: string;
  /** Nur wenn genannt — Opus 5.5 nennt „five trials“, das OpenAI-Chart keine Wiederholungszahl. */
  trials?: number;
  /** Fundstelle, wörtlich zitierbar. */
  source: string;
  href: string;
}

export const PRELIMINARY_SELF_REPORTED: readonly Preliminary[] = [
  {
    label: "claude-opus-5.5",
    displayName: "Claude Opus 5.5",
    y: 74.2,
    trials: 5,
    source:
      "Anthropic, Claude Opus 5.5 System Card, Abschnitt 8.3 „DeepSWE v1.1“: „Claude Opus 5.5 scored an average of 74.2% over five trials.“ Kein Preis genannt.",
    href: "https://github.com/datacurve-ai/deep-swe/issues/98",
  },
  {
    label: "gpt-6-sol",
    displayName: "GPT-6 Sol",
    y: 68.8,
    effort: "max",
    source:
      "OpenAI, eigenes Ankündigungs-Chart „DeepSWE“ (self-reported): 68,8 % bei max effort.",
    href: "https://github.com/datacurve-ai/deep-swe/issues/99",
  },
  {
    label: "gpt-6-luna",
    displayName: "GPT-6 Luna",
    y: 66.6,
    effort: "max",
    source:
      "OpenAI, eigenes Ankündigungs-Chart „DeepSWE“ (self-reported): 66,6 % bei max effort.",
    href: "https://github.com/datacurve-ai/deep-swe/issues/99",
  },
];
