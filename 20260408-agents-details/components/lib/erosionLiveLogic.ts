// Reine Logik des Live-Nachbaus der Erosions-Kette (Folie `erosion-luna-live`).
// Die Folie `erosion-luna` zeigt aufgezeichnete Daten aus Studie 9; hier läuft
// eine einzelne Kette mit dem eigenen Key des Vortragenden nach.
//
// WICHTIG: Das ist ein Nachbau. Der Originalcode der Studie (`run.py`, Korpus)
// liegt nicht vor. Alles, was davon abhängt, steht an zwei Stellen und lässt
// sich später austauschen:
// - der Fülltext-Korpus in `data/erosion/study9-live.json`,
// - der Antwort-Parser `parseRewrite` (wie aus der Antwort die neue Liste wird)
//   samt den Request-Bodies (`rewriteBody`, `testBody`).
// Prompts und Parameter folgen `spec` aus `data/erosion/study9-chain.json`.
//
// Wie `contextRotLive.ts` hat die Datei keine Browser-Abhängigkeit: Versand und
// Wartezeit kommen als Funktionen herein, damit die Tests ohne Netz und ohne
// Uhr laufen.
import study9 from "../../data/erosion/study9-chain.json";
import {
  RETRY_BASE_MS,
  errorHint,
  liveBody,
  redactKeys,
  runJobs,
  type LiveJob,
  type LiveResult,
  type Provider,
  type RequestSpec,
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
const REWRITE_MAX_TOKENS = 1500;

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

/**
 * Prompt zum Umschreiben nach `spec.round.userTemplate`: Anweisung des Arms,
 * dann n + 1 Fülltext-Stücke im Wechsel mit den n Regeln. Arm D nummeriert die
 * Regeln als `R01: …`, die anderen als `1. …`.
 */
export function roundPrompt(
  arm: Arm,
  items: readonly string[],
  pieces: readonly string[],
): string {
  if (pieces.length !== items.length + 1) {
    throw new Error(
      `roundPrompt: ${items.length + 1} Stücke erwartet, ${pieces.length} erhalten`,
    );
  }
  const block = (p: string) =>
    `[reference material]\n${p}\n[end of reference material]`;
  const parts: string[] = [block(pieces[0]!)];
  items.forEach((text, i) => {
    parts.push(arm === "D" ? `R${pad2(i + 1)}: ${text}` : `${i + 1}. ${text}`);
    parts.push(block(pieces[i + 1]!));
  });
  return (
    `# Task\n${SPEC.arms[arm].instruction}\n\n# Rules with reference material\n\n` +
    `${parts.join("\n\n")}\n\n# Your answer\n`
  );
}

/**
 * Prompt zum Testen nach `spec.test.userTemplate`. Eine leere Liste erscheint
 * als `(no rules)`; der Code-Zaun bleibt offen, der Prompt endet am Cursor.
 * Mit Funktionen verkettet statt `String.replace`, weil Code `$&` enthalten darf.
 */
export function testPrompt(items: readonly string[], prefix: string): string {
  const rules = items.length
    ? items.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(no rules)";
  return `# Task\n${SPEC.test.TASK_RULES}\n\n# Rules\n${rules}\n\n# Source file\n\`\`\`java\n${prefix}`;
}

// --- Request-Bodies --------------------------------------------------------

export interface BodyOptions {
  flex: boolean;
}

/**
 * Body des Umschreibens: Seed `1000 + Runde`, höchstens 1 500 Ausgabe-Tokens,
 * Reasoning aus. OpenRouter kennt Flex und `seed` in dieser Form nicht.
 */
export function rewriteBody(
  provider: Provider,
  model: string,
  user: string,
  round: number,
  opts: BodyOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: SPEC.round.systemPrompt },
      { role: "user", content: user },
    ],
  };
  if (provider === "openai") {
    body.max_completion_tokens = REWRITE_MAX_TOKENS;
    body.seed = REWRITE_SEED + round;
    body.reasoning_effort = "none";
    if (opts.flex) body.service_tier = "flex";
  } else {
    body.max_tokens = REWRITE_MAX_TOKENS;
    body.provider = { require_parameters: true };
    body.reasoning = { enabled: false };
  }
  return body;
}

/** Body des Tests: 4 Ausgabe-Tokens, Top-5-Logprobs, Seed 1000 (wie `liveBody`). */
export function testBody(
  provider: Provider,
  model: string,
  user: string,
  opts: BodyOptions,
): Record<string, unknown> {
  const req = { systemPrompt: SPEC.test.systemPrompt } as RequestSpec;
  return liveBody(provider, model, req, user, {
    noReasoning: true,
    flex: opts.flex,
  });
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
  const content = choice?.message?.content;
  if (typeof content !== "string") {
    return { error: "keine Textantwort in der Antwort des Modells" };
  }
  return { text: content, truncated: choice?.finish_reason === "length" };
}

// --- Parser des Umschreibens -----------------------------------------------

export interface ParseOutcome {
  /** Die Liste nach der Runde; bei `ok = false` die vorige. */
  items: string[];
  ok: boolean;
  /** Was auffiel; leer, wenn alles glatt lief. */
  note: string;
}

const keep = (prev: readonly string[], note: string): ParseOutcome => ({
  items: [...prev],
  ok: false,
  note,
});

/** Nummerierte Liste lesen (Arme F, C und N). */
function parseNumbered(raw: string, prev: readonly string[]): ParseOutcome {
  const items: string[] = [];
  for (const line of raw.split("\n")) {
    if (/^\s*```/.test(line)) continue;
    // matches:  "3. If the cursor is directly after a dot, start with var."  ->  "If the cursor ..."
    //           "3) Prefer immutable objects."                              ->  "Prefer immutable objects."
    const m = /^\s*\d+[.)]\s+(?<text>\S.*)$/.exec(line);
    if (m?.groups) items.push(m.groups.text!.trim());
    else if (items.length && /^\s+\S/.test(line)) {
      // eingerückte Fortsetzungszeile einer umgebrochenen Regel
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }
  if (!items.length) return keep(prev, "keine nummerierte Liste gefunden");
  return { items, ok: true, note: "" };
}

/** JSON-Änderungen auf die `R01`-Zeilen anwenden (Arm D). */
function parseChanges(raw: string, prev: readonly string[]): ParseOutcome {
  const from = raw.indexOf("{");
  const to = raw.lastIndexOf("}");
  if (from < 0 || to < from) return keep(prev, "kein JSON-Objekt gefunden");
  let obj: unknown;
  try {
    obj = JSON.parse(raw.slice(from, to + 1));
  } catch (e) {
    return keep(prev, `JSON nicht lesbar: ${(e as Error).message}`);
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return keep(prev, "JSON ist kein Objekt");
  }
  const o = obj as Record<string, unknown>;
  if (!("remove" in o || "reword" in o || "add" in o)) {
    return keep(prev, "Objekt ohne die Felder remove, reword oder add");
  }
  const unknown: string[] = [];
  /** `R07` oder `r7` -> Index 6; `null` bei unbekannter Nummer. */
  const indexOf = (id: string): number | null => {
    const m = /^R0*(?<n>\d+)$/i.exec(id.trim());
    const n = m?.groups ? Number(m.groups.n) : NaN;
    return n >= 1 && n <= prev.length ? n - 1 : null;
  };
  const texts = [...prev];
  const gone = new Set<number>();
  const reword = o.reword;
  if (typeof reword === "object" && reword !== null && !Array.isArray(reword)) {
    for (const [id, text] of Object.entries(reword)) {
      if (typeof text !== "string" || !text.trim()) continue;
      const i = indexOf(id);
      if (i === null) unknown.push(id);
      else texts[i] = text.trim();
    }
  }
  if (Array.isArray(o.remove)) {
    for (const id of o.remove) {
      if (typeof id !== "string") continue;
      const i = indexOf(id);
      if (i === null) unknown.push(id);
      else gone.add(i);
    }
  }
  const items = texts.filter((_, i) => !gone.has(i));
  if (Array.isArray(o.add)) {
    for (const t of o.add) {
      if (typeof t === "string" && t.trim()) items.push(t.trim());
    }
  }
  return {
    items,
    ok: true,
    note: unknown.length
      ? `unbekannte Nummer ${unknown.join(", ")} ignoriert`
      : "",
  };
}

/**
 * Aus der Rohantwort die Liste nach der Runde. F, C und N lesen die
 * nummerierte Liste; D wendet `{remove, reword, add}` auf die Zeilen
 * `R01: …` der Liste vor der Runde an. Ist die Antwort nicht lesbar, bleibt
 * die vorige Liste und `ok` ist `false`.
 *
 * NACHBAU: der Parser der Studie ist nicht verfügbar; unbekannte `R`-Nummern
 * werden hier ignoriert und in `note` genannt.
 */
export function parseRewrite(
  arm: Arm,
  raw: string,
  prev: readonly string[],
): ParseOutcome {
  if (!raw.trim()) return keep(prev, "leere Antwort");
  return arm === "D" ? parseChanges(raw, prev) : parseNumbered(raw, prev);
}

// --- Fülltext ziehen -------------------------------------------------------

export type PieceKind = "prose" | "math" | "java";
export interface Piece {
  id: string;
  kind: PieceKind;
  text: string;
}
export interface Corpus {
  pieces: Piece[];
}

const KINDS: readonly PieceKind[] = ["prose", "math", "java"];

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
 * Zieht n + 1 Stücke, Prosa, Mathematik und Code im Wechsel, deterministisch
 * aus Kettenseed und Runde. Je Art wird ohne Zurücklegen gezogen, solange der
 * Korpus reicht; danach wird neu gemischt.
 */
export function drawPieces(
  corpus: Corpus,
  n: number,
  chainSeed: number,
  round: number,
): string[] {
  const rand = prng(chainSeed ^ Math.imul(round + 1, 0x9e3779b1));
  const pools = new Map<PieceKind, { order: string[]; next: number }>();
  const shuffled = (kind: PieceKind): string[] => {
    const texts = corpus.pieces
      .filter((p) => p.kind === kind)
      .map((p) => p.text);
    if (!texts.length) {
      throw new Error(`Korpus enthält keine Stücke der Art ${kind}`);
    }
    for (let i = texts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [texts[i], texts[j]] = [texts[j]!, texts[i]!];
    }
    return texts;
  };
  const start = Math.floor(rand() * KINDS.length);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const kind = KINDS[(start + i) % KINDS.length]!;
    let pool = pools.get(kind);
    if (!pool || pool.next >= pool.order.length) {
      pool = { order: shuffled(kind), next: 0 };
      pools.set(kind, pool);
    }
    out.push(pool.order[pool.next++]!);
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
  items: string[];
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
    items: readonly string[],
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
    items: string[],
    parse: ParseOutcome | null,
    tests: SiteTest[],
  ): void => {
    const present = presentBehaviours(items);
    opts.onRound({
      round,
      items,
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
  let items = [...ORIGINAL_ITEMS];
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
    if (res.truncated && parse.ok) {
      parse.note = `${parse.note} Antwort am Token-Limit abgeschnitten.`.trim();
    }
    items = parse.items;
    const tests = await test(items);
    if (!Array.isArray(tests)) return tests;
    report(round, items, parse, tests);
  }
  return sum();
}
