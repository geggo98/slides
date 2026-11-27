// Reine Logik des Live-Nachlaufs der Erosions-Kette (Folie `erosion-luna-live`).
// Die Folie `erosion-luna` zeigt aufgezeichnete Daten aus Studie 9; hier läuft
// eine einzelne Kette mit dem eigenen Key des Vortragenden nach.
//
// Die Datei ist eine Portierung des Original-Runners (`study9/run.py` im
// Repository context-rot-experiments, Commit 7e5e7c7): `parse_list`,
// `apply_delta`, `render_numbered`, `compact_message`, `test_message`,
// `build_body` und die Systemprompts. Goldene Tests
// (`__tests__/erosionLiveGolden.test.ts`) halten sie Byte für Byte an den
// Ausgaben des Originals. Der Fülltext ist der Original-Korpus
// (`data/erosion/study9-live.json`, Herkunft in `LIVE_CORPUS_NOTICE.md`).
//
// Bewusster Unterschied zum Original: Die Ziehung des Fülltexts nutzt einen
// eigenen Zufallszähler (mulberry32), nicht den Mersenne-Twister von Python mit
// dem Seed `sha256("<Kette>:<Runde>")`. Die Regel der Ziehung ist dieselbe
// (Arten wechseln sich ab, Startart zufällig, Stücke mit Zurücklegen), die
// gezogenen Stücke sind es nicht.
//
// Wie `contextRotLive.ts` hat die Datei keine Browser-Abhängigkeit: Versand und
// Wartezeit kommen als Funktionen herein, damit die Tests ohne Netz und ohne
// Uhr laufen.
import study9 from "../../data/erosion/study9-chain.json";
import {
  RETRY_BASE_MS,
  errorHint,
  redactKeys,
  runJobs,
  type LiveJob,
  type LiveResult,
  type Provider,
} from "./contextRotLive";
import {
  BEHAVIOUR_IDS,
  obeys,
  type Arm,
  type BehaviourId,
} from "./erosionChainLogic";

// --- Spezifikation ---------------------------------------------------------

interface Spec9 {
  original: { n: number; text: string; behaviour: BehaviourId | null }[];
  behaviours: {
    id: BehaviourId;
    token: string;
    sites: string[];
    present: string[];
  }[];
  sites: Record<string, { gold: string }>;
  testablePrefixes: Record<string, string>;
  arms: Record<Arm, { instruction: string }>;
  round: { systemPrompt: string };
  test: { systemPrompt: string; TASK_RULES: string };
  design: { chainsPerArm: Record<string, number> };
}
const root = study9 as unknown as {
  spec: Spec9;
  notes: { cost: string };
};
const SPEC = root.spec;

/** Die 20 Regeln der Originalliste O. */
export const ORIGINAL_ITEMS: readonly string[] = SPEC.original.map(
  (r) => r.text,
);

/** Anzahl der Umschreib-Runden der Studie. */
export const ROUNDS = 6;

/** Erster Seed des Umschreibens; Runde r nutzt `1000 + r`. */
const REWRITE_SEED = 1000;
/** Seed der Tests. */
const TEST_SEED = 1000;
/** `MAX_OUT` des Originals: höchstens so viele Ausgabe-Tokens beim Umschreiben. */
const MAX_OUT = 1500;

/** Eine Regel der Kette: feste Id (`R01`) und Text, wie in `s9_state.items`. */
export type Item = [id: string, text: string];

/** `initial_items()` des Originals: die Originalliste O mit den Ids `R01` … */
export const INITIAL_ITEMS: readonly Item[] = ORIGINAL_ITEMS.map(
  (text, i): Item => [`R${String(i + 1).padStart(2, "0")}`, text],
);

export interface LiveSite {
  id: string;
  behaviour: BehaviourId;
  token: string;
  gold: string;
  prefix: string;
}

/** Die vier testbaren Luna-Stellen mit Token, Soll-Token und Code-Präfix. */
export const LIVE_SITES: readonly LiveSite[] = Object.keys(
  SPEC.testablePrefixes,
).map((id): LiveSite => {
  const b = SPEC.behaviours.find((x) => x.sites.includes(id));
  if (!b) throw new Error(`Stelle ${id} gehört zu keinem Gebot`);
  return {
    id,
    behaviour: b.id,
    token: b.token,
    gold: SPEC.sites[id]!.gold,
    prefix: SPEC.testablePrefixes[id]!,
  };
});

// --- Prompts ---------------------------------------------------------------

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Whitespace im Sinne von Python (`str.strip`, `\s` in `re`); JS' `\s` weicht ab. */
const WS =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const STRIP_RE = new RegExp(`^[${WS}]+|[${WS}]+$`, "g");
const RSTRIP_RE = new RegExp(`[${WS}]+$`);
const pyStrip = (s: string): string => s.replace(STRIP_RE, "");
const pyRstrip = (s: string): string => s.replace(RSTRIP_RE, "");
/** `str.splitlines()` trennt an mehr als `\\n`. */
const pySplitlines = (s: string): string[] =>
  s.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);

/**
 * `render_numbered`: Regeln als `1. Text`, je Zeile eine; ohne Regeln
 * `(no rules)`. Die Ids (`R01`) erscheinen hier nicht.
 */
export function renderNumbered(items: readonly Item[]): string {
  return items.length
    ? items.map(([, text], i) => `${i + 1}. ${text}`).join("\n")
    : "(no rules)";
}

/**
 * `compact_message`: Anweisung des Arms, dann n + 1 Fülltext-Stücke im Wechsel
 * mit den n Regeln. Arm D schreibt die Regeln als `R01: …` mit ihrer festen Id,
 * die anderen als `1. …`. Jedes Stück steht in `[reference material]` …
 * `[end of reference material]`, rechts von Leerraum befreit (`rstrip`).
 */
export function roundPrompt(
  arm: Arm,
  items: readonly Item[],
  pieces: readonly string[],
): string {
  if (pieces.length !== items.length + 1) {
    throw new Error(
      `roundPrompt: ${items.length + 1} Stücke erwartet, ${pieces.length} erhalten`,
    );
  }
  const block = (p: string) =>
    `[reference material]\n${pyRstrip(p)}\n[end of reference material]`;
  const parts: string[] = [block(pieces[0]!)];
  items.forEach(([id, text], k) => {
    parts.push(arm === "D" ? `${id}: ${text}` : `${k + 1}. ${text}`);
    parts.push(block(pieces[k + 1]!));
  });
  return (
    `# Task\n${SPEC.arms[arm].instruction}\n\n# Rules with reference material\n\n` +
    `${parts.join("\n\n")}\n\n# Your answer\n`
  );
}

/**
 * `test_message`: Regeln und Code. Der Code-Zaun bleibt offen, der Prompt endet
 * am Cursor. Mit Funktionen verkettet statt `String.replace`, weil Code `$&`
 * enthalten darf.
 */
export function testPrompt(items: readonly Item[], prefix: string): string {
  return `# Task\n${SPEC.test.TASK_RULES}\n\n# Rules\n${renderNumbered(items)}\n\n# Source file\n\`\`\`java\n${prefix}`;
}

// --- Request-Bodies --------------------------------------------------------

export interface BodyOptions {
  flex: boolean;
}

/**
 * `R.build_body` des Original-Runners. OpenAI: `max_completion_tokens`, `seed`,
 * `reasoning_effort: none`, bei Flex `service_tier`. OpenRouter-Zweig nach dem
 * allgemeinen Pfad des Originals (ohne die Anbieter-Zuordnung je Modell, die der
 * Runner aus seiner Routentabelle nahm).
 */
function buildBody(
  provider: Provider,
  model: string,
  system: string,
  user: string,
  seed: number,
  maxTokens: number,
  wantLogprobs: boolean,
  opts: BodyOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (provider === "openai") {
    body.max_completion_tokens = maxTokens;
    body.seed = seed;
    body.reasoning_effort = "none";
    if (opts.flex) body.service_tier = "flex";
  } else {
    body.max_tokens = maxTokens;
    body.usage = { include: true };
    body.reasoning = { enabled: false };
    body.provider = { require_parameters: wantLogprobs };
  }
  if (wantLogprobs) {
    body.logprobs = true;
    body.top_logprobs = 5;
  }
  return body;
}

/** Body des Umschreibens: Seed `1000 + Runde`, höchstens 1 500 Ausgabe-Tokens, ohne Logprobs. */
export function rewriteBody(
  provider: Provider,
  model: string,
  user: string,
  round: number,
  opts: BodyOptions,
): Record<string, unknown> {
  return buildBody(
    provider,
    model,
    SPEC.round.systemPrompt,
    user,
    REWRITE_SEED + round,
    MAX_OUT,
    false,
    opts,
  );
}

/** Body des Tests: 4 Ausgabe-Tokens, Top-5-Logprobs, Seed 1000. */
export function testBody(
  provider: Provider,
  model: string,
  user: string,
  opts: BodyOptions,
): Record<string, unknown> {
  return buildBody(
    provider,
    model,
    SPEC.test.systemPrompt,
    user,
    TEST_SEED,
    4,
    true,
    opts,
  );
}

// --- Antwort des Umschreibens ----------------------------------------------

export interface RewriteResponse {
  text?: string;
  error?: string;
  fatal?: boolean;
  retry?: boolean;
  /** Die Antwort endete am Token-Limit. */
  truncated?: boolean;
}

/** Textantwort der Chat-Completions-Schnittstelle oder Fehlermeldung ohne Key. */
export function parseRewriteResponse(
  status: number,
  text: string,
): RewriteResponse {
  let json: {
    error?: { message?: string } | string;
    choices?: {
      message?: { content?: unknown };
      finish_reason?: string;
    }[];
  } | null;
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    json = null;
  }
  const ok = status >= 200 && status < 300;
  if (!ok || !json || json.error) {
    const err = json?.error;
    const msg =
      typeof err === "string"
        ? err
        : err
          ? (err.message ?? JSON.stringify(err))
          : text.slice(0, 300);
    return {
      error: redactKeys(`HTTP ${status}: ${msg} ${errorHint(status)}`.trim()),
      fatal: [400, 401, 403, 404].includes(status),
      retry: status === 429 || status >= 500,
    };
  }
  const choice = json.choices?.[0];
  if (!choice) return { error: "keine Textantwort in der Antwort des Modells" };
  // Das Original liest `content or ""`: eine Antwort ohne Text gilt als leerer Text.
  const content = choice?.message?.content ?? "";
  if (typeof content !== "string") {
    return { error: "keine Textantwort in der Antwort des Modells" };
  }
  return { text: content, truncated: choice?.finish_reason === "length" };
}

// --- Parser des Umschreibens (portiert aus run.py) --------------------------

export interface ParseOutcome {
  /** Die Liste nach der Runde. */
  items: Item[];
  /** `ok = 0` im Original: die Antwort war nicht wie verlangt lesbar. */
  ok: boolean;
  /** Was auffiel; leer, wenn alles glatt lief (wie `s9_state.note`). */
  note: string;
}

const FENCE_RE = new RegExp(`^\`\`\`[a-z]*\\n|\\n\`\`\`[${WS}]*$`, "g");
const stripFence = (text: string): string => text.replace(FENCE_RE, "");

// matches:  "3. If the cursor is directly after a dot, ..."  ->  "If the cursor ..."
//           "- Prefer immutable objects."                    ->  "Prefer immutable objects."
const ITEM_RE = new RegExp(
  `^[${WS}]*(?:\\p{Nd}+[.)]|[-*])[${WS}]+(.*[^${WS}])[${WS}]*$`,
  "u",
);

/**
 * `parse_list`: nummerierte oder mit `-`/`*` aufgezählte Liste lesen (Arme F, C,
 * N). Zeilen ohne Marke gehören zur vorigen Regel. Fehlt jede Marke, werden die
 * nicht leeren Zeilen zu Regeln und `ok` ist `false`; die vorige Liste bleibt
 * NICHT erhalten. Die Ids werden neu als `R01` … vergeben.
 */
function parseList(text: string): ParseOutcome {
  const lines = pySplitlines(stripFence(pyStrip(text)));
  const groups: string[][] = [];
  let cur: string[] | null = null;
  for (const line of lines) {
    const m = ITEM_RE.exec(line);
    if (m) {
      cur = [m[1]!];
      groups.push(cur);
    } else if (pyStrip(line) && cur !== null) {
      cur.push(pyStrip(line));
    }
  }
  if (groups.length) {
    return {
      items: groups.map((c, i): Item => [`R${pad2(i + 1)}`, c.join(" ")]),
      ok: true,
      note: "",
    };
  }
  const nonEmpty = lines.map(pyStrip).filter((l) => l);
  return {
    items: nonEmpty.map((l, i): Item => [`R${pad2(i + 1)}`, l]),
    ok: false,
    note: "",
  };
}

/** Python-`repr` eines JSON-Werts, für den Hinweistext `unknown ids [...]`. */
function pyRepr(v: unknown): string {
  if (typeof v === "string") {
    const q = v.includes("'") && !v.includes('"') ? '"' : "'";
    let out = "";
    for (const ch of v) {
      const c = ch.codePointAt(0)!;
      if (ch === "\\") out += "\\\\";
      else if (ch === q) out += `\\${q}`;
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else if (c < 0x20 || c === 0x7f)
        out += `\\x${c.toString(16).padStart(2, "0")}`;
      else out += ch;
    }
    return `${q}${out}${q}`;
  }
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
  if (typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`)
      .join(", ")}}`;
  }
  return String(v);
}
/** Python-`str` eines JSON-Werts. */
const pyStr = (v: unknown): string => (typeof v === "string" ? v : pyRepr(v));
/** Python-Wahrheitswert eines JSON-Werts (`x or default`). */
const pyTruthy = (v: unknown): boolean =>
  !(
    v === undefined || // fehlender Schlüssel: `ops.get(k)` ist `None`
    v === null ||
    v === false ||
    v === 0 ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0)
  );

/**
 * `apply_delta` (Arm D): JSON `{remove, reword, add}` auf die festen Ids
 * anwenden. Unlesbares JSON lässt die Liste unverändert (`ok = false`, Hinweis
 * `unreadable json`). Unbekannte Ids werden ignoriert und in `note` genannt.
 * Neue Regeln bekommen `max(Id) + 1`, gezählt vor dem Entfernen.
 */
function applyDelta(items: readonly Item[], text: string): ParseOutcome {
  const unreadable = (): ParseOutcome => ({
    items: items.map((it): Item => [...it]),
    ok: false,
    note: "unreadable json",
  });
  const body = stripFence(pyStrip(text));
  let remove: unknown[];
  let reword: Record<string, unknown>;
  let add: unknown[];
  try {
    const from = body.indexOf("{");
    const to = body.lastIndexOf("}");
    if (from < 0 || to < 0) throw new Error("no braces");
    const ops = JSON.parse(body.slice(from, to + 1)) as Record<string, unknown>;
    const pick = (k: string, empty: unknown): unknown =>
      pyTruthy(ops[k]) ? ops[k] : empty;
    const r = pick("remove", []);
    const w = pick("reword", {});
    const a = pick("add", []);
    if (
      !(
        Array.isArray(r) &&
        typeof w === "object" &&
        w !== null &&
        !Array.isArray(w) &&
        Array.isArray(a)
      )
    ) {
      throw new Error("wrong types");
    }
    [remove, reword, add] = [r, w as Record<string, unknown>, a];
  } catch {
    return unreadable();
  }
  const ids = new Set(items.map(([id]) => id));
  const unknown = [...remove, ...Object.keys(reword)].filter(
    (i) => !(typeof i === "string" && ids.has(i)),
  );
  const gone = new Set(remove.map(pyStr));
  const out: Item[] = items
    .filter(([id]) => !gone.has(id))
    .map(
      ([id, t]): Item => [
        id,
        Object.hasOwn(reword, id) ? pyStr(reword[id]) : t,
      ],
    );
  let next =
    Math.max(
      ...items.map(([id]) => {
        const n = Number(id.slice(1));
        if (!Number.isInteger(n)) throw new Error(`Id ${id} ohne Nummer`);
        return n;
      }),
      0,
    ) + 1;
  for (const t of add) out.push([`R${pad2(next++)}`, pyStr(t)]);
  return {
    items: out,
    ok: true,
    note: unknown.length ? `unknown ids ${pyRepr(unknown)}` : "",
  };
}

/**
 * Aus der Rohantwort die Liste nach der Runde: Arm D wendet `{remove, reword,
 * add}` auf die Liste vor der Runde an (`apply_delta`), die anderen lesen eine
 * Liste (`parse_list`).
 */
export function parseRewrite(
  arm: Arm,
  raw: string,
  prev: readonly Item[],
): ParseOutcome {
  return arm === "D" ? applyDelta(prev, raw) : parseList(raw);
}

// --- Fülltext ziehen -------------------------------------------------------

export type PieceKind = "prose" | "math" | "code" | "foreign";
/** Die vier Arrays des Original-Korpus (`study9/corpus/pieces/*.json`). */
export type Corpus = Record<PieceKind, string[]>;

/** Reihenfolge der Arten wie in `filler()` des Originals. */
const KINDS: readonly PieceKind[] = ["prose", "math", "code", "foreign"];

/**
 * Lädt den Korpus beim ersten Start. Ein dynamischer Import hält die 450 KB aus
 * dem Bundle der übrigen Folien heraus; der Browser holt die Datei erst hier.
 */
export async function loadCorpus(): Promise<Corpus> {
  const mod = await import("../../data/erosion/study9-live.json");
  return mod.default.corpus as Corpus;
}

/** mulberry32: kleiner, fester PRNG; gleicher Seed, gleiche Folge. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `filler()` des Originals mit eigenem Zufallszähler: n + 1 Stücke. Ein
 * Zufallsversatz 0 bis 3 wählt die Startart, dann wechseln die Arten
 * Prosa, Mathematik, Code, fremder Code; jedes Stück wird mit Zurücklegen
 * gezogen. Zurück kommen die rohen Stücke, `roundPrompt` rahmt sie ein.
 */
export function drawPieces(
  corpus: Corpus,
  n: number,
  chainSeed: number,
  round: number,
): string[] {
  const rand = prng(chainSeed ^ Math.imul(round + 1, 0x9e3779b1));
  const offset = Math.floor(rand() * KINDS.length);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const kind = KINDS[(i + offset) % KINDS.length]!;
    const pool = corpus[kind];
    if (!pool?.length) {
      throw new Error(`Korpus enthält keine Stücke der Art ${kind}`);
    }
    out.push(pool[Math.floor(rand() * pool.length)]!);
  }
  return out;
}

// --- Auswertung einer Liste ------------------------------------------------

/**
 * Steht das Gebot noch in der Liste? Ja, wenn eine einzelne Regel alle
 * Erkennungs-Ausdrücke des Gebots (`behaviours[].present`) erfüllt.
 */
export function presentBehaviours(
  items: readonly string[],
): Record<BehaviourId, boolean> {
  const out = {} as Record<BehaviourId, boolean>;
  for (const id of BEHAVIOUR_IDS) {
    const b = SPEC.behaviours.find((x) => x.id === id)!;
    const res = b.present.map((p) => new RegExp(p, "i"));
    out[id] = items.some((t) => res.every((r) => r.test(t)));
  }
  return out;
}

// --- Kosten ----------------------------------------------------------------

/**
 * Grobe Schätzung der Kosten einer Kette. Grundlage: Gesamtkosten der Studie
 * (`notes.cost`, 1,1830 $ mit Flex) geteilt durch alle Ketten (Arme mal
 * Ketten je Arm für Luna und Terra, also 64). Das ist großzügig: Terra kostet
 * je Anfrage mehr, und die Studie testet je Kette bis zu 80 Stellen statt 28.
 * Ohne Flex wird der doppelte Preis angesetzt (Annahme, nicht gemessen).
 */
export function estimateChainCost(opts: BodyOptions): {
  usd: number;
  basis: string;
} {
  const m = /(?<int>\d+),(?<frac>\d+) \$/.exec(root.notes.cost);
  if (!m?.groups) throw new Error("notes.cost enthält keinen Dollarbetrag");
  const total = Number(`${m.groups.int}.${m.groups.frac}`);
  const perArm = Object.values(SPEC.design.chainsPerArm).reduce(
    (s, x) => s + x,
    0,
  );
  const chains = perArm * Object.keys(SPEC.arms).length;
  const usd = (total / chains) * (opts.flex ? 1 : 2);
  return {
    usd,
    basis:
      `Schätzung: Gesamtkosten der Studie (${m.groups.int},${m.groups.frac} $, Flex) ` +
      `geteilt durch ${chains} Ketten${opts.flex ? "" : ", ohne Flex mit doppeltem Preis angesetzt"}.`,
  };
}

// --- Ablauf der Kette ------------------------------------------------------

export interface SiteTest {
  site: string;
  token: string;
  result: LiveResult;
}

export interface RoundEvent {
  /** 0 ist die Originalliste O, ohne Umschreiben. */
  round: number;
  /** Die Regeltexte der Liste nach der Runde (ohne Ids). */
  items: string[];
  /** Die Antwort des Umschreibens endete am Token-Limit. */
  truncated: boolean;
  /** Ergebnis des Parsers; `null` in Runde 0. */
  parse: ParseOutcome | null;
  tests: SiteTest[];
  /** Gebote, die noch in der Liste stehen. */
  present: Record<BehaviourId, boolean>;
  presentCount: number;
  /** Stellen, an denen Top-1 das Token des Gebots ist (ohne Messwert zählt nicht). */
  obeyedCount: number;
}

export interface ChainOptions {
  provider: Provider;
  model: string;
  arm: Arm;
  flex: boolean;
  /** Kettenseed für die Ziehung des Fülltexts. */
  seed: number;
  /** Zahl der Umschreib-Runden; Vorgabe 6. */
  rounds?: number;
  corpus: Corpus;
  send: (
    body: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<{ status: number; text: string }>;
  sleep: (ms: number) => Promise<void>;
  signal: AbortSignal;
  onRound: (e: RoundEvent) => void;
  concurrency?: number;
  attempts?: number;
}

export interface ChainSummary {
  /** Letzte vollständig gemeldete Runde (0 = nur O getestet). */
  rounds: number;
  stopped: boolean;
  /** Grund eines Abbruchs durch Fehler; fehlt bei Abbruch durch den User. */
  error?: string;
}

/**
 * Eine Kette: Runde 0 testet O, danach je Runde Fülltext ziehen, umschreiben,
 * die vier Stellen testen und die Runde melden. Rate-Limit und Serverfehler
 * werden wiederholt; ein Fehler ohne Aussicht auf Erfolg (Key, Modellname) und
 * ein Abbruch beenden die Kette. Eine angefangene Runde wird nicht gemeldet.
 */
export async function runChain(opts: ChainOptions): Promise<ChainSummary> {
  const rounds = opts.rounds ?? ROUNDS;
  const attempts = opts.attempts ?? 3;
  const body = { flex: opts.flex };
  let done = -1;
  const sum = (extra: Partial<ChainSummary> = {}): ChainSummary => ({
    rounds: Math.max(done, 0),
    stopped: false,
    ...extra,
  });
  const aborted = (): ChainSummary => sum({ stopped: true });
  const failed = (error: string): ChainSummary =>
    sum({ stopped: true, error: redactKeys(error) });

  async function rewrite(
    prompt: string,
    round: number,
  ): Promise<RewriteResponse | "aborted"> {
    let r: RewriteResponse = { error: "kein Versuch" };
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await opts.send(
          rewriteBody(opts.provider, opts.model, prompt, round, body),
          opts.signal,
        );
        r = parseRewriteResponse(res.status, res.text);
      } catch (e) {
        if (opts.signal.aborted || (e as Error).name === "AbortError") {
          return "aborted";
        }
        r = {
          error: `Netzfehler: ${(e as Error).message || String(e)}`,
          retry: true,
        };
      }
      if (!r.error || !r.retry || attempt === attempts) break;
      await opts.sleep(RETRY_BASE_MS * attempt);
      if (opts.signal.aborted) return "aborted";
    }
    return r;
  }

  async function test(
    items: readonly Item[],
  ): Promise<SiteTest[] | ChainSummary> {
    const results = new Map<string, LiveResult>();
    const jobs: LiveJob[] = LIVE_SITES.map((s) => ({
      key: s.id,
      label: s.id,
      gold: s.gold,
      body: testBody(
        opts.provider,
        opts.model,
        testPrompt(items, s.prefix),
        body,
      ),
    }));
    let fatal: string | null = null;
    await runJobs(jobs, {
      send: opts.send,
      sleep: opts.sleep,
      signal: opts.signal,
      leaks: [],
      concurrency: opts.concurrency,
      attempts,
      onResult: (job, r) => {
        const res = r.error ? { ...r, error: redactKeys(r.error) } : r;
        results.set(job.key, res);
        if (r.fatal && fatal === null) fatal = res.error ?? "Fehler";
      },
    });
    if (opts.signal.aborted) return aborted();
    if (fatal !== null) return failed(fatal);
    return LIVE_SITES.map((s) => ({
      site: s.id,
      token: s.token,
      result: results.get(s.id)!,
    }));
  }

  const report = (
    round: number,
    state: readonly Item[],
    parse: ParseOutcome | null,
    tests: SiteTest[],
    truncated = false,
  ): void => {
    const items = state.map(([, text]) => text);
    const present = presentBehaviours(items);
    opts.onRound({
      round,
      items,
      truncated,
      parse,
      tests,
      present,
      presentCount: BEHAVIOUR_IDS.filter((id) => present[id]).length,
      obeyedCount: tests.filter(
        (t) => t.result.top1 !== null && obeys(t.result.top1, t.token),
      ).length,
    });
    done = round;
  };

  if (opts.signal.aborted) return aborted();
  let items: Item[] = INITIAL_ITEMS.map((it): Item => [...it]);
  const first = await test(items);
  if (!Array.isArray(first)) return first;
  report(0, items, null, first);

  for (let round = 1; round <= rounds; round++) {
    const pieces = drawPieces(opts.corpus, items.length, opts.seed, round);
    const res = await rewrite(roundPrompt(opts.arm, items, pieces), round);
    if (res === "aborted" || opts.signal.aborted) return aborted();
    if (res.error !== undefined || res.text === undefined) {
      return failed(res.error ?? "keine Antwort");
    }
    const parse = parseRewrite(opts.arm, res.text, items);
    items = parse.items;
    const tests = await test(items);
    if (!Array.isArray(tests)) return tests;
    report(round, items, parse, tests, res.truncated === true);
  }
  return sum();
}
