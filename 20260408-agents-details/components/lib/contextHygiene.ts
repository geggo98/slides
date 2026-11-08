// Reine Logik der Folie „Kontext-Hygiene“ (`ContextHygiene.vue`). Die Daten
// stammen aus Studie 3 und liegen in `data/contexthygiene/study3.json`.
//
// `measure()` und `isHit()` sind aus `viz/template.html` der Studie portiert
// (dort wiederum aus `analyze.py`). `contextHygiene.test.ts` hält sie gegen alle
// gespeicherten Messwerte, damit die Folie dieselben Zahlen zeigt wie der Bericht.

export type Model = "luna" | "sol" | "terra";
export const MODELS: readonly Model[] = ["luna", "sol", "terra"];

export type Ladder = "dose" | "steps";
export const LADDERS: Record<Ladder, readonly string[]> = {
  dose: ["D0", "D1", "D2", "D3", "D4"],
  steps: ["S0", "S1", "S2", "S3", "S4", "S5", "S6"],
};
export const LADDER_NAME: Record<Ladder, string> = {
  dose: "Dosis: nur Namen",
  steps: "Stufen: gemischte Mängel",
};

/** Zurückgehaltene Gebiete zuerst (Kontrollgruppe), danach die Entwicklungsgebiete. */
export const SCENARIO_ORDER: readonly string[] = [
  "ticketing",
  "rental",
  "expense",
  "parking",
  "payroll",
  "warehouse",
];

export type TopList = [string, number][];
export interface Measure {
  top: TopList;
  p1: number | null;
  hit: boolean;
}
export interface Site {
  id: string;
  pos: number;
  cls: string;
  gold: string;
  stratum: string | null;
  m: Record<Model, Measure>;
}
export interface Level {
  code: string;
  sites: Site[];
  /** Für die Folie geschrieben (nur S1–S6), nie gemessen. */
  comments?: CommentBlock[];
}
export interface CommentBlock {
  beforeLine: number;
  lines: string[];
}
export interface Scenario {
  dev: boolean;
  summary: string;
  /** Wofür die Datei fachlich da ist; steht über jeder Stufe. Für die Folie geschrieben. */
  header?: string;
  /** Kommentare der Studie (S0k = D0k), nur diese werden live mitgesendet. */
  comments: CommentBlock[];
  levels: Record<string, Level>;
}
export interface Study3 {
  source: string;
  source_sha256: string;
  retrieved: string;
  system: string;
  p_max: number;
  routes: Record<Model, string>;
  scenarios: Record<string, Scenario>;
}

// --- Metrik der Studie -----------------------------------------------------

/** Ohne Leerraum, klein geschrieben; reiner Leerraum wird zu `<ws>`. */
export const norm = (t: string): string => {
  const s = t.replace(/\s+/g, "").toLowerCase();
  return s || "<ws>";
};

const isWord = (c: string | undefined): boolean =>
  !!c && /[A-Za-z0-9_]/.test(c);

export function isHit(top: string, gold: string): boolean {
  const a = norm(top);
  const b = gold.toLowerCase();
  if (a === "<ws>") return false;
  if (b.startsWith(a)) return true;
  if (!a.startsWith(b)) return false;
  return !isWord(b[b.length - 1]) || !isWord(a[b.length]);
}

export interface Measured {
  top1: string;
  p1: number | null;
  logit: number | null;
  off: boolean;
  hit: boolean;
}

export function measure(top: TopList, gold: string, pMax: number): Measured {
  const groups = new Map<string, number>();
  for (const [t, lp] of top) {
    const k = norm(t);
    groups.set(k, (groups.get(k) ?? 0) + Math.exp(Math.min(lp, 0)));
  }
  const pws = groups.get("<ws>") ?? 0;
  groups.delete("<ws>");
  if (!groups.size) {
    return { top1: "<ws>", p1: null, logit: null, off: true, hit: false };
  }
  let sum = 0;
  for (const v of groups.values()) sum += v;
  const mass = Math.max(1 - pws, sum);
  const ranked = [...groups].map(([k, v]): [string, number] => [k, v / mass]);
  ranked.sort((x, y) => y[1] - x[1]);
  const [top1, best] = ranked[0]!;
  const p1 = Math.min(best, pMax);
  return {
    top1,
    p1,
    logit: Math.log(p1 / (1 - p1)),
    off: top1.startsWith("```") || top1.startsWith("<|"),
    hit: isHit(top1, gold),
  };
}

// --- Färbung ---------------------------------------------------------------

export interface Bucket {
  /** untere Grenze von P(top1) */
  min: number;
  label: string;
  /** Füllung der Marke */
  bg: string;
  /** Ziffernfarbe auf `bg` */
  fg: string;
  /** Randlinie: unsichere Stellen sind zusätzlich gestrichelt */
  dashed: boolean;
  /** Zusatzzeichen hinter der Nummer, damit die Stufe nicht nur an der Farbe hängt */
  sign: string;
}

/**
 * Vier Stufen von unsicher (Orange) zu sicher (Blau). Orange gegen Blau liegt
 * auf der Achse, die bei Rot-Grün-Schwäche (Protanopie, Deuteranopie) erhalten
 * bleibt. Dazu trägt jede Stufe eine zweite Kodierung (Rand, Zeichen), und
 * `contextHygiene.test.ts` prüft Abstand unter Farbsehschwäche und Kontrast.
 */
export const BUCKETS: readonly Bucket[] = [
  {
    min: 0,
    label: "unter 0,5",
    bg: "#9a4406",
    fg: "#ffffff",
    dashed: true,
    sign: "!",
  },
  {
    min: 0.5,
    label: "0,5 bis 0,9",
    bg: "#fbbf24",
    fg: "#1c1917",
    dashed: true,
    sign: "",
  },
  {
    min: 0.9,
    label: "0,9 bis 0,99",
    bg: "#93c5fd",
    fg: "#0f172a",
    dashed: false,
    sign: "",
  },
  {
    min: 0.99,
    label: "ab 0,99",
    bg: "#1d4ed8",
    fg: "#ffffff",
    dashed: false,
    sign: "",
  },
];

/** Index in `BUCKETS`, oder -1 ohne Messwert. */
export function pBucket(p: number | null | undefined): number {
  if (p == null) return -1;
  let idx = 0;
  BUCKETS.forEach((b, i) => {
    if (p >= b.min) idx = i;
  });
  return idx;
}

// --- Kommentare ------------------------------------------------------------

/** Die Stufen, auf denen die Studie Kommentare kennt: S0 und damit D0–D4 (gleiche Zeilen, nur andere Namen). */
const isMeasuredLevel = (level: string): boolean =>
  level === "S0" || /^D[0-4]$/.test(level);

/**
 * Kommentare der Studie für diese Stufe, oder `null`. Nur diese gehen bei der
 * Live-Abfrage mit; auf S1–S6 gab es nie welche.
 */
export function measuredComments(
  scenario: Scenario,
  level: string,
): CommentBlock[] | null {
  return isMeasuredLevel(level) ? scenario.comments : null;
}

/**
 * Kommentarblöcke zum Anzeigen, oder `null`. Vorn steht die Kopfzeile, die sagt,
 * wofür die Datei fachlich da ist. Danach folgen auf S0/D0–D4 die Kommentare der
 * Studie und auf S1–S6 die für die Folie geschriebenen (die Zeilen ändern sich
 * dort, S0 passt nicht mehr).
 */
export function commentZones(
  scenario: Scenario,
  level: string,
): CommentBlock[] | null {
  const body = isMeasuredLevel(level)
    ? scenario.comments
    : (scenario.levels[level]?.comments ?? null);
  if (!body) return null;
  const head: CommentBlock[] = scenario.header
    ? [{ beforeLine: 0, lines: [`// ${scenario.header}`] }]
    : [];
  return [...head, ...body];
}

/** Kommentarzeilen ohne Zeichen: `/** Text`, ` * Text`, `// Text` werden zu `Text`; leere Zeilen entfallen. */
export function commentProse(block: CommentBlock): string[] {
  const out: string[] = [];
  for (const raw of block.lines) {
    // matches:  "/** A quantity of ... */"  ->  "A quantity of ..."
    const t = raw
      .replace(/^\s*(\/\/+|\/\*+|\*\/|\*)\s?/, "")
      .replace(/\s*\*\/\s*$/, "")
      .trim();
    if (t) out.push(t);
  }
  return out;
}

/** Der Code mit den Kommentarblöcken, wie die Studie ihn für „S0 + Kommentare“ bildet. */
export function insertComments(code: string, blocks: CommentBlock[]): string {
  const lines = code.split("\n");
  const out: string[] = [];
  for (let i = 0; i <= lines.length; i++) {
    for (const b of blocks) if (b.beforeLine === i) out.push(...b.lines);
    if (i < lines.length) out.push(lines[i]!);
  }
  return out.join("\n");
}

/** Versatz einer Stelle `pos` in `code` im Text von `insertComments`. */
export function commentedOffset(
  code: string,
  blocks: CommentBlock[],
  pos: number,
): number {
  const line = code.slice(0, pos).split("\n").length - 1;
  const col = pos - (code.lastIndexOf("\n", pos - 1) + 1);
  const before = blocks
    .filter((b) => b.beforeLine <= line)
    .reduce((n, b) => n + b.lines.length, 0);
  const text = insertComments(code, blocks).split("\n");
  let offset = 0;
  for (let i = 0; i < line + before; i++) offset += text[i]!.length + 1;
  return offset + col;
}

// --- Darstellung -----------------------------------------------------------

/** Leerraum sichtbar machen: `·` Leerzeichen, `↵` Zeilenumbruch, `→` Tabulator. */
export function showToken(t: string): string {
  return t.replace(/ /g, "·").replace(/\n/g, "↵").replace(/\t/g, "→");
}

/** Prozentwert mit Dezimalkomma; ab 99,95 % kein „100,0“, sondern „>99,9“. */
export function formatPercent(p: number): string {
  if (p >= 0.9995) return ">99,9 %";
  return `${(p * 100).toFixed(p < 0.1 ? 1 : p < 0.99 ? 0 : 1).replace(".", ",")} %`;
}

// --- Live-Abfrage ----------------------------------------------------------

export type KeyType = "openai" | "openrouter" | "unknown" | null;

export function keyType(key: string): KeyType {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-")) return "openai";
  return "unknown";
}

export const ENDPOINT = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
} as const;

export const DEFAULT_LIVE_MODELS = {
  openai: "gpt-6.1-terra, gpt-6-sol, gpt-5.6-luna",
  openrouter: "openai/gpt-6.1-terra, openai/gpt-6-sol, openai/gpt-5.6-luna",
} as const;

export interface LiveOptions {
  noReasoning: boolean;
  flex: boolean;
}

/** Anfrage wie in der Studie: System-Prompt, Code bis zur Stelle, 4 Token, Top-5-Logprobs. */
export function buildBody(
  type: "openai" | "openrouter",
  model: string,
  system: string,
  prefix: string,
  opts: LiveOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prefix },
    ],
    logprobs: true,
    top_logprobs: 5,
  };
  if (type === "openai") {
    body.max_completion_tokens = 4;
    body.seed = 1;
    if (opts.noReasoning) body.reasoning_effort = "none";
    if (opts.flex) body.service_tier = "flex";
  } else {
    body.max_tokens = 4;
    body.provider = { require_parameters: true };
    if (opts.noReasoning) body.reasoning = { enabled: false };
  }
  return body;
}
