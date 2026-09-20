// Datenbasis der zwei HarnessTax-Folien: 21 Modell×Harness-Paare auf
// SWE-bench Lite und Terminal-Bench 2.0, dazu Ausdauer (Steps/Tokens) und
// Erstkontext je Harness auf SWE-bench Lite.
//
// Herkunft
// --------
// Melissa Z. Pan, Shuo Yang, Negar Arabzadeh, Wei-Lin Chiang, Ion Stoica,
// Matei Zaharia. „HarnessTax: How Much Does the Harness Matter for Coding
// Agents?" UC Berkeley Sky Lab + Arena, https://harnesstax.github.io/,
// abgerufen 18.09.2026, Stand der Seite (`__AB_BOOT__.generated`)
// 2026-09-16 16:23 UTC.
//
// Sieben Modelle × drei Harnesse (Pi, Codex CLI, Claude Code), 30 zufällig
// gezogene Tasks je Benchmark, 3 Wiederholungen je Paar, 95-%-Konfidenz-
// intervalle über 10.000 Bootstrap-Resamples. Kosten sind Token-Verbrauch ×
// eine am 01.09.2026 eingefrorene Direct-API-Preisliste — nicht das,
// was tatsächlich bezahlt wurde (dieselbe Einschränkung wie bei den
// DeepSWE-Kosten in `paretoData.ts`).
//
// Die Website ist eine SPA ohne Inhalt im HTML; `data/harnesstax/fetch.ts`
// archiviert die zugrundeliegenden JSON-Dateien, und die Arrays hier sind aus
// genau diesem Archiv erzeugt (nie von Hand abgetippt) — nachgerechnet in
// `lib/__tests__/harnessTaxData.test.ts`, nach demselben Muster wie
// `boardArchive.test.ts` für die DeepSWE-Zahlen.
//
// ⚠️ NICHT vergleichbar mit `CURRENT`/`SNAPSHOTS` aus `paretoData.ts`: anderer
// Benchmark (DeepSWE v1.1 dort, SWE-bench Lite / Terminal-Bench 2.0 hier),
// andere Harnesse (mini-swe-agent dort), andere Preisliste, andere
// Modellauswahl. Beide Charts plotten €/Task auf einer log-Achse — das macht
// sie NICHT zur selben Messung.

import { paretoFront } from "./paretoData";

/** Derselbe Kurs wie `paretoData.ts` (dort Zeile 82, „1 USD = 0,876 €, Stand
 * 21.07.2026" — dort nicht exportiert, jeder €-Wert ist von Hand
 * vorgerechnet). Eine eigene Konstante hier, damit `eur()` nicht denselben
 * Wert ein zweites Mal hart codiert. */
export const EUR_PER_USD = 0.876;

export type Harness = "pi" | "codex" | "cc";
export type HModel =
  | "fable"
  | "opus"
  | "sonnet"
  | "haiku"
  | "sol"
  | "luna"
  | "kimi";
export type Bench = "swe" | "tb";

export interface HarnessMeta {
  key: Harness;
  label: string;
  /** Marker-Form der Studie selbst übernommen (Figure 1) — bleibt gegen die
   * Quelle prüfbar, statt eine eigene Formsprache zu erfinden. */
  symbol: "square" | "triangle" | "diamond";
}

export const HARNESSES: readonly HarnessMeta[] = [
  { key: "pi", label: "Pi", symbol: "square" },
  { key: "codex", label: "Codex", symbol: "triangle" },
  { key: "cc", label: "Claude Code", symbol: "diamond" },
];

/** Leserichtung Pi → Codex → Claude Code: Reihenfolge in Legende, bei
 * Gleichständen (`bestHarnesses`, `nativeUpgrades`) und beim Tiebreak der
 * Label-Anker im Chart. Reine Konvention, keine Wertung. */
export const HARNESS_ORDER: readonly Harness[] = ["pi", "codex", "cc"];

export const harnessLabel = (h: Harness): string =>
  HARNESSES.find((m) => m.key === h)?.label ?? h;

export const MODEL_LABELS: Record<HModel, string> = {
  fable: "Claude Fable 5",
  opus: "Claude Opus 4.8",
  sonnet: "Claude Sonnet 4.6",
  haiku: "Claude Haiku 4.5",
  sol: "GPT-5.6 Sol",
  luna: "GPT-5.6 Luna",
  kimi: "Kimi K3",
};

/** Reihenfolge der Legende/Farbskala — teuerste Anthropic-Modelle zuerst,
 * dann OpenAI, Kimi K3 zuletzt (kein natives Harness, siehe `NATIVE`). */
export const MODEL_ORDER: readonly HModel[] = [
  "fable",
  "opus",
  "sonnet",
  "haiku",
  "sol",
  "luna",
  "kimi",
];

/**
 * Anbieter-Harness je Modell — die Grundlage für „Finding 3": läuft ein
 * Modell im HERSTELLEREIGENEN Harness am besten? Kimi K3 (Moonshot, über
 * Fireworks AI) hat kein natives Harness unter den dreien und fehlt deshalb
 * hier UND in „9 von 12" — der Blogpost zählt ausdrücklich nur die sechs
 * Anthropic- und OpenAI-Modelle.
 */
export const NATIVE: Partial<Record<HModel, Harness>> = {
  fable: "cc",
  opus: "cc",
  sonnet: "cc",
  haiku: "cc",
  sol: "codex",
  luna: "codex",
};

export interface HPt {
  model: HModel;
  modelLabel: string;
  harness: Harness;
  /** Kosten pro Rollout in USD, wie veröffentlicht — NICHT selbst umrechnen,
   * das übernimmt `eur()`. */
  usd: number;
  usdCi: readonly [number, number];
  /** Erfolgsquote in Prozent (0–100), gerundet wie die Studie. */
  y: number;
  yCi: readonly [number, number];
  /** Bootstrap-Häufigkeit, mit der dieser Punkt über 10.000 Resamples auf der
   * Front lag (0–1) — kein p-Wert, siehe ⓘ-Caveat „30 Tasks × 3 Läufe". */
  bootstrap: number;
}

export const eur = (usd: number): number => usd * EUR_PER_USD;
export const eurCi = (
  ci: readonly [number, number],
): readonly [number, number] => [eur(ci[0]), eur(ci[1])];

// Erzeugt aus data/harnesstax/frontier-swe.json und frontier-tb.json — siehe
// Kopfkommentar. Reihenfolge folgt der Quelle (nicht neu sortiert), damit ein
// Diff gegen einen neuen Abruf lesbar bleibt.

export const SWE: readonly HPt[] = [
  {
    model: "fable",
    modelLabel: "Claude Fable 5",
    harness: "cc",
    usd: 1.3293,
    usdCi: [1.101256, 1.601415],
    y: 97.7778,
    yCi: [93.3333, 100],
    bootstrap: 0.337,
  },
  {
    model: "opus",
    modelLabel: "Claude Opus 4.8",
    harness: "cc",
    usd: 0.975761,
    usdCi: [0.733246, 1.262789],
    y: 86.6667,
    yCi: [75.5556, 95.5556],
    bootstrap: 0,
  },
  {
    model: "sonnet",
    modelLabel: "Claude Sonnet 4.6",
    harness: "cc",
    usd: 0.669348,
    usdCi: [0.498678, 0.862522],
    y: 66.6667,
    yCi: [51.1111, 81.1111],
    bootstrap: 0,
  },
  {
    model: "haiku",
    modelLabel: "Claude Haiku 4.5",
    harness: "cc",
    usd: 0.426164,
    usdCi: [0.345863, 0.507158],
    y: 52.2222,
    yCi: [36.6667, 67.7778],
    bootstrap: 0.0125,
  },
  {
    model: "sol",
    modelLabel: "GPT-5.6 Sol",
    harness: "cc",
    usd: 1.540276,
    usdCi: [1.184199, 2.09472],
    y: 77.7778,
    yCi: [63.3333, 90],
    bootstrap: 0,
  },
  {
    model: "luna",
    modelLabel: "GPT-5.6 Luna",
    harness: "cc",
    usd: 0.15246,
    usdCi: [0.119702, 0.190419],
    y: 55.5556,
    yCi: [38.8889, 72.2222],
    bootstrap: 0.3845,
  },
  {
    model: "kimi",
    modelLabel: "Kimi K3",
    harness: "cc",
    usd: 0.784425,
    usdCi: [0.566712, 1.044778],
    y: 76.6667,
    yCi: [62.2222, 88.8889],
    bootstrap: 0.007,
  },
  {
    model: "fable",
    modelLabel: "Claude Fable 5",
    harness: "codex",
    usd: 0.890467,
    usdCi: [0.696656, 1.126628],
    y: 96.6667,
    yCi: [91.1111, 100],
    bootstrap: 0.384,
  },
  {
    model: "opus",
    modelLabel: "Claude Opus 4.8",
    harness: "codex",
    usd: 0.693734,
    usdCi: [0.491485, 0.946207],
    y: 88.8889,
    yCi: [77.7778, 97.7778],
    bootstrap: 0.2775,
  },
  {
    model: "sonnet",
    modelLabel: "Claude Sonnet 4.6",
    harness: "codex",
    usd: 0.744673,
    usdCi: [0.485095, 1.0996],
    y: 68.8889,
    yCi: [53.3333, 83.3333],
    bootstrap: 0.0015,
  },
  {
    model: "haiku",
    modelLabel: "Claude Haiku 4.5",
    harness: "codex",
    usd: 0.391888,
    usdCi: [0.295968, 0.510313],
    y: 57.7778,
    yCi: [41.1111, 74.4444],
    bootstrap: 0.2645,
  },
  {
    model: "sol",
    modelLabel: "GPT-5.6 Sol",
    harness: "codex",
    usd: 0.561265,
    usdCi: [0.442062, 0.702244],
    y: 73.3333,
    yCi: [57.7778, 87.7778],
    bootstrap: 0.057,
  },
  {
    model: "luna",
    modelLabel: "GPT-5.6 Luna",
    harness: "codex",
    usd: 0.035486,
    usdCi: [0.028296, 0.043708],
    y: 55.5556,
    yCi: [37.7778, 72.2222],
    bootstrap: 0.7885,
  },
  {
    model: "kimi",
    modelLabel: "Kimi K3",
    harness: "codex",
    usd: 0.845004,
    usdCi: [0.665122, 1.042766],
    y: 74.4444,
    yCi: [60, 87.7778],
    bootstrap: 0,
  },
  {
    model: "fable",
    modelLabel: "Claude Fable 5",
    harness: "pi",
    usd: 0.665695,
    usdCi: [0.493714, 0.875495],
    y: 96.6667,
    yCi: [91.1111, 100],
    bootstrap: 0.989,
  },
  {
    model: "opus",
    modelLabel: "Claude Opus 4.8",
    harness: "pi",
    usd: 0.472603,
    usdCi: [0.271722, 0.725234],
    y: 82.2222,
    yCi: [71.1111, 92.2222],
    bootstrap: 0.861,
  },
  {
    model: "sonnet",
    modelLabel: "Claude Sonnet 4.6",
    harness: "pi",
    usd: 0.679488,
    usdCi: [0.461425, 0.926388],
    y: 64.4444,
    yCi: [47.7778, 80],
    bootstrap: 0.0005,
  },
  {
    model: "haiku",
    modelLabel: "Claude Haiku 4.5",
    harness: "pi",
    usd: 0.37357,
    usdCi: [0.308035, 0.440719],
    y: 60,
    yCi: [43.3333, 75.5556],
    bootstrap: 0.5115,
  },
  {
    model: "sol",
    modelLabel: "GPT-5.6 Sol",
    harness: "pi",
    usd: 0.440661,
    usdCi: [0.341663, 0.553393],
    y: 74.4444,
    yCi: [58.8889, 88.8889],
    bootstrap: 0.587,
  },
  {
    model: "luna",
    modelLabel: "GPT-5.6 Luna",
    harness: "pi",
    usd: 0.029976,
    usdCi: [0.023563, 0.037023],
    y: 53.3333,
    yCi: [35.5556, 70],
    bootstrap: 0.9985,
  },
  {
    model: "kimi",
    modelLabel: "Kimi K3",
    harness: "pi",
    usd: 0.455158,
    usdCi: [0.322859, 0.607449],
    y: 72.2222,
    yCi: [57.7778, 85.5556],
    bootstrap: 0.3095,
  },
];

export const TB2: readonly HPt[] = [
  {
    model: "fable",
    modelLabel: "Claude Fable 5",
    harness: "cc",
    usd: 1.554103,
    usdCi: [0.992643, 2.235054],
    y: 75.5556,
    yCi: [61.1111, 88.8889],
    bootstrap: 0.0095,
  },
  {
    model: "haiku",
    modelLabel: "Claude Haiku 4.5",
    harness: "cc",
    usd: 0.262522,
    usdCi: [0.162475, 0.377011],
    y: 41.1111,
    yCi: [27.7778, 55.5556],
    bootstrap: 0,
  },
  {
    model: "opus",
    modelLabel: "Claude Opus 4.8",
    harness: "cc",
    usd: 0.899294,
    usdCi: [0.589994, 1.276792],
    y: 68.8889,
    yCi: [52.2222, 84.4444],
    bootstrap: 0.0005,
  },
  {
    model: "sonnet",
    modelLabel: "Claude Sonnet 4.6",
    harness: "cc",
    usd: 0.668745,
    usdCi: [0.446929, 0.917128],
    y: 62.2222,
    yCi: [46.6667, 76.6667],
    bootstrap: 0.0005,
  },
  {
    model: "luna",
    modelLabel: "GPT-5.6 Luna",
    harness: "codex",
    usd: 0.06397,
    usdCi: [0.038652, 0.092664],
    y: 72.2222,
    yCi: [57.7778, 85.5556],
    bootstrap: 0.1745,
  },
  {
    model: "sol",
    modelLabel: "GPT-5.6 Sol",
    harness: "codex",
    usd: 0.761134,
    usdCi: [0.46322, 1.130819],
    y: 78.8889,
    yCi: [65.5556, 91.1111],
    bootstrap: 0.0645,
  },
  {
    model: "fable",
    modelLabel: "Claude Fable 5",
    harness: "pi",
    usd: 1.078506,
    usdCi: [0.571387, 1.74867],
    y: 71.1111,
    yCi: [54.4444, 85.5556],
    bootstrap: 0.001,
  },
  {
    model: "haiku",
    modelLabel: "Claude Haiku 4.5",
    harness: "pi",
    usd: 0.249566,
    usdCi: [0.160236, 0.355113],
    y: 47.7778,
    yCi: [32.2222, 63.3333],
    bootstrap: 0,
  },
  {
    model: "opus",
    modelLabel: "Claude Opus 4.8",
    harness: "pi",
    usd: 0.757909,
    usdCi: [0.384428, 1.245274],
    y: 72.2222,
    yCi: [58.8889, 84.4444],
    bootstrap: 0.0075,
  },
  {
    model: "sonnet",
    modelLabel: "Claude Sonnet 4.6",
    harness: "pi",
    usd: 0.614356,
    usdCi: [0.390826, 0.8692],
    y: 65.5556,
    yCi: [48.8889, 82.2222],
    bootstrap: 0.012,
  },
  {
    model: "luna",
    modelLabel: "GPT-5.6 Luna",
    harness: "pi",
    usd: 0.045341,
    usdCi: [0.025556, 0.06917],
    y: 76.6667,
    yCi: [62.2222, 90],
    bootstrap: 0.9995,
  },
  {
    model: "sol",
    modelLabel: "GPT-5.6 Sol",
    harness: "pi",
    usd: 0.420517,
    usdCi: [0.272168, 0.61226],
    y: 83.3333,
    yCi: [71.1111, 94.4444],
    bootstrap: 0.9365,
  },
  {
    model: "kimi",
    modelLabel: "Kimi K3",
    harness: "pi",
    usd: 0.38318,
    usdCi: [0.238695, 0.543259],
    y: 73.3333,
    yCi: [60, 85.5556],
    bootstrap: 0.1325,
  },
  {
    model: "kimi",
    modelLabel: "Kimi K3",
    harness: "cc",
    usd: 0.521312,
    usdCi: [0.355968, 0.707199],
    y: 66.6667,
    yCi: [52.2222, 80],
    bootstrap: 0,
  },
  {
    model: "luna",
    modelLabel: "GPT-5.6 Luna",
    harness: "cc",
    usd: 0.098445,
    usdCi: [0.067636, 0.13316],
    y: 70,
    yCi: [55.5556, 83.3333],
    bootstrap: 0.0795,
  },
  {
    model: "sol",
    modelLabel: "GPT-5.6 Sol",
    harness: "cc",
    usd: 1.354545,
    usdCi: [0.94836, 1.852551],
    y: 71.1111,
    yCi: [55.5556, 85.5556],
    bootstrap: 0.007,
  },
  {
    model: "fable",
    modelLabel: "Claude Fable 5",
    harness: "codex",
    usd: 0.976038,
    usdCi: [0.631696, 1.406231],
    y: 72.2222,
    yCi: [56.6667, 86.6667],
    bootstrap: 0.013,
  },
  {
    model: "haiku",
    modelLabel: "Claude Haiku 4.5",
    harness: "codex",
    usd: 0.213731,
    usdCi: [0.142742, 0.293352],
    y: 31.1111,
    yCi: [15.5556, 47.7778],
    bootstrap: 0,
  },
  {
    model: "kimi",
    modelLabel: "Kimi K3",
    harness: "codex",
    usd: 0.449972,
    usdCi: [0.283386, 0.656948],
    y: 70,
    yCi: [55.5556, 83.3333],
    bootstrap: 0.002,
  },
  {
    model: "opus",
    modelLabel: "Claude Opus 4.8",
    harness: "codex",
    usd: 0.847954,
    usdCi: [0.507623, 1.269417],
    y: 72.2222,
    yCi: [56.6667, 86.6667],
    bootstrap: 0.0125,
  },
  {
    model: "sonnet",
    modelLabel: "Claude Sonnet 4.6",
    harness: "codex",
    usd: 0.552243,
    usdCi: [0.38034, 0.741388],
    y: 63.3333,
    yCi: [46.6667, 78.8889],
    bootstrap: 0.002,
  },
];

export function pointsFor(bench: Bench): readonly HPt[] {
  return bench === "swe" ? SWE : TB2;
}

/** Auf 100 Turns gedeckelte Zellen mit Cap-Treffern — nur Terminal-Bench 2.0,
 * nur Claude Code × Haiku (4 von 30 Tasks ungelöst wegen des Caps). Für die
 * ⓘ-Einschränkung „100-Turn-Cap". */
export const TURN_CAP_HITS: readonly {
  bench: Bench;
  model: HModel;
  harness: Harness;
  hits: number;
}[] = [{ bench: "tb", model: "haiku", harness: "cc", hits: 4 }];

// ---------------------------------------------------------------------------
// Ausdauer: Steps und Tokens je Versuch, SWE-bench Lite. Terminal-Bench 2.0
// liefert Steps nur für ein einziges Paar (Kimi K3 · Pi) — dort fehlt der
// Datenpunkt in der Quelle selbst, siehe `data/harnesstax/steps-tb.json`.
// ---------------------------------------------------------------------------

export interface StepRow {
  model: HModel;
  harness: Harness;
  /** Mittlere Zahl geloggter Harness-Schritte je Versuch. Turn-Definitionen
   * unterscheiden sich zwischen Harnessen — siehe ⓘ. */
  steps: number;
  /** Mittlere Summe aus gemeldeten Prompt- und Output-Tokens je Versuch. */
  tokens: number;
}

export const STEPS_SWE: readonly StepRow[] = [
  { model: "fable", harness: "cc", steps: 15.3, tokens: 629300 },
  { model: "opus", harness: "cc", steps: 22, tokens: 1013000 },
  { model: "sonnet", harness: "cc", steps: 24.1, tokens: 1079000 },
  { model: "haiku", harness: "cc", steps: 50.9, tokens: 2683000 },
  { model: "sol", harness: "cc", steps: 52.4, tokens: 1743000 },
  { model: "luna", harness: "cc", steps: 92.4, tokens: 4508000 },
  { model: "kimi", harness: "cc", steps: 31.4, tokens: 1359000 },
  { model: "fable", harness: "codex", steps: 14, tokens: 336000 },
  { model: "opus", harness: "codex", steps: 20.3, tokens: 595400 },
  { model: "sonnet", harness: "codex", steps: 32.2, tokens: 1039000 },
  { model: "haiku", harness: "codex", steps: 62.7, tokens: 2131000 },
  { model: "sol", harness: "codex", steps: 20.4, tokens: 639300 },
  { model: "luna", harness: "codex", steps: 22.1, tokens: 810400 },
  { model: "kimi", harness: "codex", steps: 38, tokens: 1250000 },
  { model: "fable", harness: "pi", steps: 15.4, tokens: 175900 },
  { model: "opus", harness: "pi", steps: 18.2, tokens: 346600 },
  { model: "sonnet", harness: "pi", steps: 31.8, tokens: 956400 },
  { model: "haiku", harness: "pi", steps: 60.1, tokens: 1872000 },
  { model: "sol", harness: "pi", steps: 20.7, tokens: 461000 },
  { model: "luna", harness: "pi", steps: 27.1, tokens: 666200 },
  { model: "kimi", harness: "pi", steps: 29.2, tokens: 600000 },
];

export function stepsFor(model: HModel, harness: Harness): StepRow | null {
  return (
    STEPS_SWE.find((r) => r.model === model && r.harness === harness) ?? null
  );
}

/** Prüft die Abbruch-These wörtlich, auf SWE-bench Lite, für ein Modell:
 * eigener Harness (Claude Code) läuft LÄNGER (mehr Schritte) UND löst MEHR
 * (höhere Erfolgsquote) als der Vier-Werkzeuge-Harness (Pi). Beide Teile
 * müssen stimmen — "mehr Schritte, aber nicht mehr gelöst" (Fable 5) oder
 * "weniger Schritte, obwohl weniger gelöst" (Haiku 4.5) widerlegen die
 * These, auch wenn nur eine Hälfte kippt. Wirft, wenn ein Paar in den
 * Archiven fehlt — eine stille `false` wäre nicht von einer echten
 * Widerlegung zu unterscheiden. */
export function holdsGiveUpThesis(model: HModel): boolean {
  const stepsCc = stepsFor(model, "cc");
  const stepsPi = stepsFor(model, "pi");
  const ptCc = SWE.find((p) => p.model === model && p.harness === "cc");
  const ptPi = SWE.find((p) => p.model === model && p.harness === "pi");
  if (!stepsCc || !stepsPi || !ptCc || !ptPi) {
    throw new Error(`holdsGiveUpThesis: fehlende Daten für Modell „${model}“`);
  }
  return stepsCc.steps > stepsPi.steps && ptCc.y > ptPi.y;
}

// ---------------------------------------------------------------------------
// Erstkontext je Harness, gemittelt über je 630 Versuche auf SWE-bench Lite
// (`data/harnesstax/agent-context-swe.json`, Figure 3 im Blogpost).
// ---------------------------------------------------------------------------

export interface ContextRow {
  harness: Harness;
  label: string;
  /** Harness-Version, unter der gemessen wurde. */
  version: string;
  toolCount: number;
  toolSchemaChars: number;
  instructionChars: number;
  contextTokensMean: number;
  contextTokensSd: number;
  n: number;
}

export const CONTEXT_SWE: readonly ContextRow[] = [
  {
    harness: "pi",
    label: "Pi",
    version: "0.85.1",
    toolCount: 4,
    toolSchemaChars: 2873,
    instructionChars: 2547,
    contextTokensMean: 1972.18,
    contextTokensSd: 552.78,
    n: 630,
  },
  {
    harness: "codex",
    label: "Codex",
    version: "0.146.0",
    toolCount: 7.43,
    toolSchemaChars: 18114.29,
    instructionChars: 23502.43,
    contextTokensMean: 11308.3,
    contextTokensSd: 2683.43,
    n: 630,
  },
  {
    harness: "cc",
    label: "Claude Code",
    version: "2.1.224",
    toolCount: 23,
    toolSchemaChars: 76995.43,
    instructionChars: 13464.64,
    contextTokensMean: 27010.79,
    contextTokensSd: 6933.94,
    n: 630,
  },
];

// ---------------------------------------------------------------------------
// Ableitungen — als Funktionen über die Rohdaten, nicht als zweite,
// handgepflegte Zahlenspalte. Jede hier erzeugte Kennzahl wird in
// `harnessTaxData.test.ts` gegen die Rohdaten nachgerechnet.
// ---------------------------------------------------------------------------

/** Pareto-Front für einen Benchmark, in Chartkoordinaten (x = USD, NICHT €;
 * die Front hängt nicht von der Anzeigewährung ab). */
export function frontFor(bench: Bench): { front: HPt[]; dom: HPt[] } {
  return paretoFront(
    pointsFor(bench).map((p) => ({ ...p, x: p.usd })) as (HPt & {
      x: number;
    })[],
  );
}

/** Pareto-Front über eine TEILMENGE der Punkte — für die Legenden-
 * Hervorhebung „nur dieser Harness". Mit `p => p.harness === h` entspricht
 * das genau den `frontier.subsets`-Einträgen mit `model: null` aus dem
 * Archiv (Test). Nach USD aufsteigend sortiert, wie `frontFor`. */
export function subsetFront(bench: Bench, pred: (p: HPt) => boolean): HPt[] {
  return paretoFront(
    pointsFor(bench)
      .filter(pred)
      .map((p) => ({ ...p, x: p.usd })) as (HPt & { x: number })[],
  ).front;
}

export interface HarnessPair {
  model: HModel;
  from: HPt;
  to: HPt;
  /** `to.usd / from.usd`, ungerundet — die Anzeige rundet auf eine Stelle. */
  costRatio: number;
  /** `to.y − from.y` in Prozentpunkten, ungerundet. */
  dSuccess: number;
}

/** Je Modell das Paar (Harness `from` → Harness `to`) — die Aufpreis-Pfeile
 * des Charts (Schritt 2: Pi → Claude Code). Reihenfolge `MODEL_ORDER`;
 * Modelle, die in einem der beiden Harnesse fehlen, fallen weg (bei den
 * sieben Modellen dieser Studie also keines). */
export function harnessPairs(
  bench: Bench,
  from: Harness,
  to: Harness,
): HarnessPair[] {
  const pts = pointsFor(bench);
  return MODEL_ORDER.flatMap((model) => {
    const a = pts.find((p) => p.model === model && p.harness === from);
    const b = pts.find((p) => p.model === model && p.harness === to);
    if (!a || !b) return [];
    return [
      { model, from: a, to: b, costRatio: b.usd / a.usd, dSuccess: b.y - a.y },
    ];
  });
}

export interface BestHarness {
  model: HModel;
  /** ALLE Harnesse mit der höchsten Erfolgsquote — bei Gleichstand mehrere,
   * in `HARNESS_ORDER`. Wer einen einzelnen braucht, nimmt `best[0]`. */
  best: Harness[];
  bestY: number;
}

/** Harness mit dem höchsten Erfolg je Modell, alle sieben Modelle (auch Kimi
 * K3, das kein natives Harness hat). Gleichstände werden NICHT aufgelöst:
 * Luna auf SWE-bench Lite (Codex und Claude Code je 55,6 %) und Opus auf
 * Terminal-Bench 2.0 (Pi und Codex je 72,2 %) liefern zwei Einträge. */
export function bestHarnesses(bench: Bench): BestHarness[] {
  const pts = pointsFor(bench);
  return MODEL_ORDER.flatMap((model) => {
    const mine = pts.filter((p) => p.model === model);
    if (!mine.length) return [];
    const bestY = Math.max(...mine.map((p) => p.y));
    const best = HARNESS_ORDER.filter((h) =>
      mine.some((p) => p.harness === h && p.y === bestY),
    );
    return [{ model, best, bestY }];
  });
}

/** Zähltabelle „höchster Erfolg je Modell" je Harness — Gleichstände zählen
 * für JEDEN beteiligten Harness (deshalb kann die Summe 7 übersteigen). */
export function bestHarnessCounts(bench: Bench): Record<Harness, number> {
  const out: Record<Harness, number> = { pi: 0, codex: 0, cc: 0 };
  for (const r of bestHarnesses(bench)) for (const h of r.best) out[h]++;
  return out;
}

/** Geometrisches Mittel der Kostenverhältnisse `a`/`b` über alle Modelle, die
 * in BEIDEN Harnessen gemessen wurden (bei sieben Modellen also alle sieben).
 * Robuster gegen Ausreißer als ein arithmetisches Mittel über Ratios — und
 * die Kennzahl, die der Blogpost selbst verwendet ("2,0× … geometrische
 * Mittel der Kostenverhältnisse"). */
export function geoCostRatio(a: Harness, b: Harness, bench: Bench): number {
  const pts = pointsFor(bench);
  const byModel = new Map<HModel, Partial<Record<Harness, number>>>();
  for (const p of pts) {
    const e = byModel.get(p.model) ?? {};
    e[p.harness] = p.usd;
    byModel.set(p.model, e);
  }
  let sumLog = 0;
  let n = 0;
  for (const e of byModel.values()) {
    if (e[a] === undefined || e[b] === undefined) continue;
    sumLog += Math.log(e[a]! / e[b]!);
    n++;
  }
  return Math.exp(sumLog / n);
}

/** Mittlere Differenz im Erfolg (Prozentpunkte) zwischen Harness `a` und der
 * Baseline `base`, über alle gemeinsam gemessenen Modelle. */
export function meanSuccessDelta(
  a: Harness,
  base: Harness,
  bench: Bench,
): number {
  const pts = pointsFor(bench);
  const byModel = new Map<HModel, Partial<Record<Harness, number>>>();
  for (const p of pts) {
    const e = byModel.get(p.model) ?? {};
    e[p.harness] = p.y;
    byModel.set(p.model, e);
  }
  let sum = 0;
  let n = 0;
  for (const e of byModel.values()) {
    if (e[a] === undefined || e[base] === undefined) continue;
    sum += e[a]! - e[base]!;
    n++;
  }
  return sum / n;
}

export interface NativeResult {
  model: HModel;
  native: Harness;
  best: Harness[];
  bestY: number;
  nativeWins: boolean;
}

/** Gewinnt für ein Modell mit definiertem nativem Harness (`NATIVE`) genau
 * dieser Harness (bei Gleichstand: ist er unter den Bestplatzierten)? Nur
 * Modelle mit Eintrag in `NATIVE` zählen — Kimi K3 fällt raus. */
export function nativeComparisons(bench: Bench): NativeResult[] {
  const pts = pointsFor(bench);
  const byModel = new Map<HModel, Partial<Record<Harness, number>>>();
  for (const p of pts) {
    const e = byModel.get(p.model) ?? {};
    e[p.harness] = p.y;
    byModel.set(p.model, e);
  }
  const out: NativeResult[] = [];
  for (const [model, native] of Object.entries(NATIVE) as [HModel, Harness][]) {
    const e = byModel.get(model);
    if (!e) continue;
    const bestY = Math.max(
      ...Object.values(e).filter((v): v is number => v !== undefined),
    );
    const best = (Object.keys(e) as Harness[]).filter((h) => e[h] === bestY);
    out.push({ model, native, best, bestY, nativeWins: best.includes(native) });
  }
  return out;
}

/** „Native Harness gewinnt in X von Y" über einen oder beide Benchmarks — die
 * Kennzahl aus Finding 3 („9 von 12"). */
export function nativeWinRate(benches: readonly Bench[]): {
  wins: number;
  total: number;
} {
  const all = benches.flatMap((b) => nativeComparisons(b));
  return { wins: all.filter((r) => r.nativeWins).length, total: all.length };
}

export interface NativeUpgrade {
  model: HModel;
  native: Harness;
  /** Der Punkt im nativen Harness — dort sitzt der Geisterring. */
  from: HPt;
  /** Der Punkt im Harness mit dem höchsten Erfolg — dort endet der Pfeil. */
  to: HPt;
  /** `to.y − from.y` in Prozentpunkten, immer > 0. */
  dSuccess: number;
}

/** Die Geisterpfeile „natives → bestes Harness" (Schritt 3 des Charts): ein
 * Eintrag je Modell, dessen natives Harness NICHT unter den Bestplatzierten
 * ist — also genau die Verlierer aus `nativeComparisons`. Luna auf SWE-bench
 * Lite bekommt KEINEN Pfeil: Codex (nativ) und Claude Code liegen beide bei
 * 55,6 %, und ein Gleichstand zählt als „nativ gewinnt" (so zählt auch der
 * Blogpost seine „9 von 12"). Liegen zwei fremde Harnesse gleichauf (Opus
 * auf Terminal-Bench 2.0: Pi und Codex je 72,2 %), zeigt der Pfeil auf den
 * ersten in `HARNESS_ORDER` — Pi. */
export function nativeUpgrades(bench: Bench): NativeUpgrade[] {
  const pts = pointsFor(bench);
  return nativeComparisons(bench).flatMap((r) => {
    if (r.nativeWins) return [];
    const target = HARNESS_ORDER.find((h) => r.best.includes(h));
    const from = pts.find((p) => p.model === r.model && p.harness === r.native);
    const to = pts.find((p) => p.model === r.model && p.harness === target);
    if (!from || !to) return [];
    return [
      { model: r.model, native: r.native, from, to, dSuccess: to.y - from.y },
    ];
  });
}

/** €/gelöste Aufgabe — Kosten pro Rollout geteilt durch die Erfolgsquote,
 * nicht durch die Zahl der Tasks: Fehlversuche kosten auch etwas. */
export function costPerSolve(p: HPt): number {
  return eur(p.usd) / (p.y / 100);
}
