// Rechen- und Lesehilfen für die Folie „Luna schreibt die Regeln um“
// (components/ErosionChain.vue). Die Daten sind eine Aufzeichnung von Studie 9:
// data/erosion/study9-chain.json, gebaut von data/erosion/build.ts.
//
// Begriffe der Studie, soweit dieser Code sie braucht:
// - Gebot: Regel der Form „endet der Code auf X, beginne mit Token T“. Es gibt
//   vier Gebote, A bis D.
// - Originalliste O: die 20 Regeln vor dem ersten Umschreiben (Runde 0).
// - Kette: sechs Umschreib-Runden ab O. Arm: die Anweisung, nach der das Modell
//   umschreibt (F offen, C eng, D nur Änderungen, N abschreiben).
// - Befolgung testbar: Anteil der testbaren Stellen, an denen das
//   wahrscheinlichste erste Token (Top-1) das Token des Gebots ist.
// - Erosion: Befolgung testbar nach einer Runde minus Befolgung testbar von O.

export type BehaviourId = "A" | "B" | "C" | "D";
export type Arm = "F" | "C" | "D" | "N";
export type ModelId = "luna" | "terra";

export const BEHAVIOUR_IDS: readonly BehaviourId[] = ["A", "B", "C", "D"];

/** Arm F nennt die Nummern der Regeln (ab 1), die das Gebot tragen; ein leeres
 * Array heißt „gestrichen“. Die übrigen Arme speichern nur ja oder nein. */
export type Presence = readonly number[] | boolean;

export interface ChainRound {
  round: number;
  /** Schlüssel in `Study9.lists`; nur Luna, Arm F. */
  list?: string;
  rules: number;
  /** `null`, wenn die Liste leer ist. */
  wordsPerRule: number | null;
  present: Record<BehaviourId, Presence>;
  /** Top-1 je testbarer Stelle, Reihenfolge wie `lunaTestSites`; `null`, wenn
   * die Runde nicht getestet wurde oder die Daten keine Einzelwerte tragen. */
  tests: readonly string[] | null;
  obeyTestable: number | null;
  obeyAll: number | null;
}

export interface Chain {
  id: string;
  rounds: readonly ChainRound[];
}

export interface AggregateRound {
  round: number;
  chains: number;
  rules: number;
  wordsPerRule: number | null;
  commandmentsPresent: number;
  obeyTestable: number | null;
  /** Befolgung über alle 18 Gebotsstellen, nicht nur die testbaren. */
  obeyAll: number | null;
  erosion: number | null;
  erosionCi95: readonly [number, number] | null;
  chainsWithLoss: number | null;
  presentNotObeyed: number | null;
  presentNotObeyedPairs: number | null;
}

export interface TestSite {
  site: string;
  behaviour: BehaviourId;
  token: string;
  gold: string;
}

export interface BehaviourSpec {
  id: BehaviourId;
  cue: string;
  token: string;
  sites: readonly string[];
}

export interface ExampleTest {
  seed: number;
  top1: string;
  obeyed: boolean;
  p1: number;
  top5: readonly (readonly [string, number])[];
}

export interface ModelAggregate {
  testableSites: readonly string[];
  baselineO: { all: number; testable: number };
  arms: Record<Arm, readonly AggregateRound[]>;
}

/** Der Teil von study9-chain.json, den die Folie liest. */
export interface Study9 {
  source: { models: Record<ModelId, string> };
  spec: {
    behaviours: readonly BehaviourSpec[];
    sites: Record<string, { behaviour: BehaviourId }>;
    arms: Record<Arm, { name: string; instruction: string }>;
    design: { rounds: number; testedRounds: Record<ModelId, number[]> };
  };
  lists: Record<string, readonly string[]>;
  chains: {
    lunaTestSites: readonly TestSite[];
    luna: Record<Arm, readonly Chain[]>;
    terra: Partial<Record<Arm, readonly Chain[]>>;
  };
  aggregate: Record<ModelId, ModelAggregate>;
  example: {
    chain: string;
    arm: Arm;
    model: ModelId;
    behaviour: BehaviourId;
    site: { id: string };
    noRules: ExampleTest;
    rounds: readonly { round: number; test: readonly ExampleTest[] }[];
    typical: {
      chainsWithLossOverAllTestableSites: { count: number; of: number };
    };
  };
}

/** Steht das Gebot noch in der Liste? */
export function isPresent(p: Presence): boolean {
  return typeof p === "boolean" ? p : p.length > 0;
}

/** Welches Gebot trägt die Regel mit der Nummer `n` (ab 1)? `null` für eine
 * Richtlinie und immer dann, wenn die Daten nur ja oder nein speichern. */
export function behaviourOfRule(
  n: number,
  present: Record<BehaviourId, Presence>,
): BehaviourId | null {
  for (const id of BEHAVIOUR_IDS) {
    const p = present[id];
    if (typeof p !== "boolean" && p.includes(n)) return id;
  }
  return null;
}

export interface RuleRow {
  n: number;
  text: string;
  behaviour: BehaviourId | null;
  /** Der Wortlaut stand so nicht in der Vorrunde: umformuliert oder neu. */
  changed: boolean;
}

export interface RuleDiff {
  rows: RuleRow[];
  /** Regeln, die wörtlich aus der Vorrunde stammen. */
  kept: number;
  /** Regeln mit neuem Wortlaut. */
  changed: number;
  /** Regelzahl dieser Runde minus Regelzahl der Vorrunde. */
  net: number;
}

/** Vergleicht die Liste einer Runde wörtlich mit der Liste der Vorrunde.
 * `prev === null` steht für die Originalliste, die keine Vorrunde hat. Kommt
 * derselbe Wortlaut in `cur` öfter vor als in `prev`, zählt nur so oft als
 * „unverändert“, wie er in `prev` stand. */
export function diffRules(
  prev: readonly string[] | null,
  cur: readonly string[],
  present: Record<BehaviourId, Presence>,
): RuleDiff {
  const left = new Map<string, number>();
  for (const text of prev ?? []) left.set(text, (left.get(text) ?? 0) + 1);
  let kept = 0;
  const rows = cur.map((text, i): RuleRow => {
    const n = i + 1;
    const available = left.get(text) ?? 0;
    const changed = prev !== null && available === 0;
    if (prev !== null && available > 0) {
      left.set(text, available - 1);
      kept++;
    }
    return { n, text, behaviour: behaviourOfRule(n, present), changed };
  });
  return {
    rows,
    kept,
    changed: prev === null ? 0 : cur.length - kept,
    net: prev === null ? 0 : cur.length - prev.length,
  };
}

/** Zerlegt einen Regeltext an Backticks, damit die Folie Code-Stücke als Code
 * setzen kann, ohne HTML aus den Daten zu übernehmen. Ein Backtick ohne
 * Partner bleibt als Zeichen im Text stehen. */
export function codeSegments(text: string): { code: boolean; text: string }[] {
  const parts = text.split("`");
  // Gerade Zahl von Teilen = ungerade Zahl von Backticks: der letzte ist offen.
  if (parts.length % 2 === 0) {
    const tail = parts.pop()!; // split liefert mindestens ein Element
    parts[parts.length - 1] += "`" + tail;
  }
  return parts
    .map((t, i) => ({ code: i % 2 === 1, text: t }))
    .filter((s) => s.text !== "");
}

/** Befolgt heißt: Top-1 ist das Token des Gebots. Groß- und Kleinschreibung
 * und Leerraum am Rand zählen nicht, wie in der Auswertung der Studie. */
export function obeys(top1: string, token: string): boolean {
  return top1.trim().toLowerCase() === token.trim().toLowerCase();
}

export type TestState = "obeyed" | "present-not-obeyed" | "removed";

export interface TestRow extends TestSite {
  top1: string;
  state: TestState;
}

/** Eine Zeile je testbarer Stelle, oder `null`, wenn die Runde nicht getestet
 * wurde. `present-not-obeyed` ist der Fall „da, aber nicht befolgt“: Das Gebot
 * steht in der Liste, und Top-1 ist trotzdem ein anderes Token. */
export function testRows(
  sites: readonly TestSite[],
  tests: readonly string[] | null,
  present: Record<BehaviourId, Presence>,
): TestRow[] | null {
  if (tests === null) return null;
  if (tests.length !== sites.length) {
    throw new Error(
      `testRows: ${tests.length} Top-1-Werte für ${sites.length} Stellen`,
    );
  }
  return sites.map((s, i): TestRow => {
    const top1 = tests[i]!; // Länge oben gegen sites geprüft
    const state: TestState = obeys(top1, s.token)
      ? "obeyed"
      : isPresent(present[s.behaviour])
        ? "present-not-obeyed"
        : "removed";
    return { ...s, top1, state };
  });
}

export interface SeriesPoint {
  round: number;
  mean: number;
  lo: number;
  hi: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Mittlere Befolgung testbar je getesteter Runde, mit Band. Das Band ist das
 * 95-%-Intervall der Erosion, verschoben um den Ausgangswert von O und auf
 * 0 bis 1 begrenzt. Runde 0 hat kein Intervall, dort ist das Band leer. */
export function aggregateSeries(
  rounds: readonly AggregateRound[],
): SeriesPoint[] {
  const base = rounds[0]?.obeyTestable;
  if (base == null) {
    throw new Error("aggregateSeries: Runde 0 ohne Befolgung testbar");
  }
  const out: SeriesPoint[] = [];
  for (const r of rounds) {
    if (r.obeyTestable === null) continue;
    const ci = r.erosionCi95;
    out.push({
      round: r.round,
      mean: r.obeyTestable,
      lo: ci ? clamp01(base + ci[0]) : r.obeyTestable,
      hi: ci ? clamp01(base + ci[1]) : r.obeyTestable,
    });
  }
  return out;
}

/** Die getesteten Runden einer Kette. */
export function chainSeries(chain: Chain): { round: number; value: number }[] {
  const out: { round: number; value: number }[] = [];
  for (const r of chain.rounds) {
    if (r.obeyTestable !== null) {
      out.push({ round: r.round, value: r.obeyTestable });
    }
  }
  return out;
}

export interface LossSummary {
  from: number;
  to: number;
  lastRound: number;
  erosion: number;
  chainsWithLoss: number;
  chains: number;
}

/** Ausgangswert, Wert der letzten getesteten Runde und Zahl der Ketten, die
 * dort unter dem Ausgangswert liegen. */
export function lossSummary(rounds: readonly AggregateRound[]): LossSummary {
  const first = rounds[0];
  const last = [...rounds]
    .reverse()
    .find((r) => r.round > 0 && r.obeyTestable !== null);
  if (
    first?.obeyTestable == null ||
    last?.obeyTestable == null ||
    last.erosion === null ||
    last.chainsWithLoss === null
  ) {
    throw new Error("lossSummary: keine getestete Runde nach Runde 0");
  }
  return {
    from: first.obeyTestable,
    to: last.obeyTestable,
    lastRound: last.round,
    erosion: last.erosion,
    chainsWithLoss: last.chainsWithLoss,
    chains: last.chains,
  };
}

/** Deutsche Dezimalschreibweise mit fester Stellenzahl und echtem Minus. */
export function formatDe(x: number, digits = 2): string {
  const s = Math.abs(x).toFixed(digits).replace(".", ",");
  // −0,00 gibt es nicht: ein auf null gerundeter Wert trägt kein Vorzeichen.
  return x < 0 && Number(Math.abs(x).toFixed(digits)) !== 0 ? `−${s}` : s;
}

/** „8 von 10 (80 %)“, mit `noun` „8 von 10 Ketten (80 %)“. Die Quote wird vor dem Runden gerechnet; ist sie nicht
 * ganzzahlig, steht „ca.“ davor. Bei `of === 0` gibt es keine Quote. */
export function formatShare(count: number, of: number, noun = ""): string {
  const what = noun === "" ? "" : ` ${noun}`;
  if (of === 0) return `${count} von 0${what}`;
  const pct = (count / of) * 100;
  const rounded = Math.round(pct);
  const approx = Math.abs(pct - rounded) > 1e-9 ? "ca. " : "";
  return `${count} von ${of}${what} (${approx}${rounded} %)`;
}
