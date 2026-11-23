// Reine Logik der Folie „Context Rot bei Luna“ (`ContextRotLuna.vue`). Die Daten
// stammen aus Studie 7 und liegen in `data/contextrot/study7-luna.json`
// (erzeugt von `build.ts` daneben).
//
// Drei Teile:
// - Auswahl und Kennzahlen aus den vorberechneten Werten (Zeilen je Stelle,
//   Mittel über die Semantik-Stellen, Reihen für das Diagramm),
// - Prompt und Anfrage genau wie der Runner der Studie (`userPrompt`,
//   `liveBody`); `contextRotLive.test.ts` hält beides gegen den Beispiel-Body
//   der JSON,
// - die Live-Abfrage ohne Browser-Abhängigkeit (`parseLive`, `runJobs`):
//   Versand und Wartezeit kommen als Funktionen herein, damit die Tests ohne
//   Netz und ohne Uhr laufen.
//
// Metrik (`norm`, `isHit`) wie in `contextHygieneLogic.ts`; die Leak-Regel ist aus
// `build.ts` übernommen.
import { isHit, norm } from "./contextHygieneLogic";

// --- Daten -----------------------------------------------------------------

export type Variant = "D0" | "D4";
export const VARIANTS: readonly Variant[] = ["D0", "D4"];
export type ScenarioName = "warehouse" | "expense";
export const SCENARIOS: readonly ScenarioName[] = ["warehouse", "expense"];
export type ModelName = "luna" | "terra" | "sol";

/** Regelzahlen des Reglers; 0 ist die Grundlinie `none`. */
export const RULE_COUNTS = [0, 1, 3, 10] as const;
export type RuleCount = (typeof RULE_COUNTS)[number];
export type ConditionName = "none" | "contra-1" | "contra-3" | "contra-10";

export const conditionOf = (n: RuleCount): ConditionName =>
  n === 0 ? "none" : `contra-${n}`;

/** Obergrenze von P(top1) in der Auswertung der Studie; der höchste logit ist daher 6,91. */
export const P_MAX = 0.999;

export interface SiteDef {
  id: string;
  /** Klasse der Stelle; `syntax` ist die Kontrollstelle. */
  cls: string;
  gold: string;
  prefixChars: number;
  cursorContext: string;
}
export interface CodeBlock {
  code: string;
  sites: SiteDef[];
}
export interface Cell {
  /** [Token, Wahrscheinlichkeit] im Mittel über die Seeds */
  top5: [string, number][];
  top1: string;
  /** Mittel der Seed-logits */
  logit: number;
  /** Anteil der Seeds mit Leak beziehungsweise Treffer */
  leak: number;
  hit: number;
  n: number;
  /** [Seed, Top-1, P(top1) gedeckelt, logit] */
  seeds: [number, string, number, number][];
}
export interface Condition {
  rules: string | null;
  ruleTokens: number;
  leaks: string[];
}
export interface VariantAgg {
  logit: number;
  delta: number | null;
  hit: number;
  leak: number;
  n: number;
}
export interface CondAgg {
  D0: VariantAgg;
  D4: VariantAgg;
  pooled: { delta: number; falling: number; of: number } | null;
}
export interface RequestSpec {
  systemPrompt: string;
  TASK: string;
  TASK_RULES: string;
  userTemplateNone: string;
  userTemplateRules: string;
  exampleBody: Record<string, unknown>;
}
export interface Study7 {
  source: { study: string; seeds: number[] };
  request: RequestSpec;
  conditions: Record<string, Condition>;
  leakDefinition: string;
  logitDefinition: string;
  sites: Record<ScenarioName, { label: string } & Record<Variant, CodeBlock>>;
  results: {
    cells: Record<ScenarioName, Record<string, Record<string, Cell>>>;
  };
  aggregates: {
    byModel: Record<
      ModelName,
      { all: Record<string, CondAgg>; warehouse: Record<string, CondAgg> }
    >;
    reportAnalysis: {
      values: Record<
        ModelName,
        Record<string, { ci: [number, number] | null }>
      >;
    };
  };
  notes: {
    noise: string;
    limits: string[];
    scope: string;
    cost: {
      luna: {
        perCondition: Record<
          string,
          { costUsd: number; latencyMsMean: number; latencyMsMax: number }
        >;
      };
    };
  };
}

// --- Vorberechnete Werte ---------------------------------------------------

export interface SiteRow {
  /** Nummer der Marke im Code, ab 1 in Lesereihenfolge */
  n: number;
  site: SiteDef;
  cell: Cell;
  /** logit der Bedingung minus logit derselben Stelle ohne Regeln */
  delta: number;
  semantic: boolean;
}

const cellKey = (variant: Variant, id: string): string => `${variant}|${id}`;

function cellOf(
  study: Study7,
  scenario: ScenarioName,
  cond: string,
  variant: Variant,
  id: string,
): Cell {
  const cell = study.results.cells[scenario][cond]?.[cellKey(variant, id)];
  if (!cell) {
    throw new Error(
      `keine Messung für ${scenario}/${cond}/${cellKey(variant, id)}`,
    );
  }
  return cell;
}

/** Die Stellen einer Variante in Lesereihenfolge. */
export function orderedSites(block: CodeBlock): SiteDef[] {
  return [...block.sites].sort((a, b) => a.prefixChars - b.prefixChars);
}

/** Eine Zeile je Stelle: Messung der Bedingung und Abstand zur Grundlinie. */
export function siteRows(
  study: Study7,
  scenario: ScenarioName,
  variant: Variant,
  cond: ConditionName,
): SiteRow[] {
  return orderedSites(study.sites[scenario][variant]).map((site, i) => {
    const cell = cellOf(study, scenario, cond, variant, site.id);
    const base = cellOf(study, scenario, "none", variant, site.id);
    return {
      n: i + 1,
      site,
      cell,
      delta: cell.logit - base.logit,
      semantic: site.cls !== "syntax",
    };
  });
}

export interface RowSummary {
  /** Zahl der Semantik-Stellen */
  sites: number;
  logit: number;
  delta: number;
  /** Anteil der Messungen (Stelle mal Seed) mit Leak */
  leak: number;
  /** Stellen mit negativem Δ */
  falling: number;
}

/** Mittel über die Semantik-Stellen; die Syntax-Stelle ist Kontrolle und zählt nicht mit. */
export function summarize(rows: readonly SiteRow[]): RowSummary {
  const sem = rows.filter((r) => r.semantic);
  if (!sem.length) throw new Error("keine Semantik-Stelle in der Auswahl");
  const mean = (f: (r: SiteRow) => number) =>
    sem.reduce((s, r) => s + f(r), 0) / sem.length;
  return {
    sites: sem.length,
    logit: mean((r) => r.cell.logit),
    delta: mean((r) => r.delta),
    leak: mean((r) => r.cell.leak),
    falling: sem.filter((r) => r.delta < 0).length,
  };
}

export interface SeriesPoint {
  rules: RuleCount;
  /** Δ gepoolt über D0 und D4, beide Fachgebiete; 0 bei 0 Regeln */
  delta: number;
  ci: [number, number] | null;
  falling: number | null;
  of: number | null;
}

/** Δ gepoolt je Regelzahl für ein Modell: die Werte des Berichts. */
export function series(study: Study7, model: ModelName): SeriesPoint[] {
  return RULE_COUNTS.map((rules) => {
    if (rules === 0) {
      return { rules, delta: 0, ci: null, falling: null, of: null };
    }
    const cond = conditionOf(rules);
    const pooled = study.aggregates.byModel[model].all[cond]?.pooled;
    if (!pooled) throw new Error(`kein Gesamtwert für ${model}/${cond}`);
    return {
      rules,
      delta: pooled.delta,
      ci: study.aggregates.reportAnalysis.values[model][cond]?.ci ?? null,
      falling: pooled.falling,
      of: pooled.of,
    };
  });
}

// --- Regeltext und Code ----------------------------------------------------

export interface RuleParts {
  id: string;
  /** Bedingung zwischen „If “ und „, then“ */
  condition: string;
  /** verlangter Anfang, etwa „the call Objects.requireNonNull(“ */
  start: string;
}

/** Zerlegt eine Regelzeile der Studie; `null` bei jeder anderen Zeile. */
export function parseRule(line: string): RuleParts | null {
  // matches:  "R002. If an array has length 4 and length 7, then start your continuation with the modifier final."
  //           ->  id "R002", condition "an array has length 4 and length 7", start "the modifier final"
  const m =
    /^(?<id>R\d+)\. If (?<condition>.+), then start your continuation with (?<start>.+)\.$/.exec(
      line,
    );
  if (!m?.groups) return null;
  return {
    id: m.groups.id!,
    condition: m.groups.condition!,
    start: m.groups.start!,
  };
}

/** Die nicht leeren Zeilen eines Regeltexts. */
export function ruleLines(rules: string | null): string[] {
  return rules ? rules.split("\n").filter((l) => l.length > 0) : [];
}

export interface Segment {
  text: string;
  /** Marke hinter `text`; fehlt beim Rest nach der letzten Stelle */
  mark?: { n: number; site: SiteDef };
}

/** Der Code in Stücken, jeweils bis zur nächsten Messstelle. */
export function codeSegments(block: CodeBlock): Segment[] {
  const out: Segment[] = [];
  let from = 0;
  orderedSites(block).forEach((site, i) => {
    out.push({
      text: block.code.slice(from, site.prefixChars),
      mark: { n: i + 1, site },
    });
    from = site.prefixChars;
  });
  out.push({ text: block.code.slice(from) });
  return out;
}

/** Der Code bis zur Stelle: das, was das Modell sieht. */
export function sitePrefix(block: CodeBlock, site: SiteDef): string {
  return block.code.slice(0, site.prefixChars);
}

// --- Prompt und Anfrage wie in der Studie ----------------------------------

/**
 * User-Nachricht nach `build_message` der Studie. Ersetzt wird mit Funktionen,
 * weil Java-Code `$` enthalten darf und `String.replace` ein `$&` im
 * Ersatztext sonst als Rückbezug liest.
 */
export function userPrompt(
  req: RequestSpec,
  rules: string | null,
  prefix: string,
): string {
  if (rules === null) {
    return req.userTemplateNone
      .replace("{TASK}", () => req.TASK)
      .replace("{PREFIX}", () => prefix);
  }
  return req.userTemplateRules
    .replace("{TASK_RULES}", () => req.TASK_RULES)
    .replace("{RULES}", () => rules)
    .replace("{PREFIX}", () => prefix);
}

export type Provider = "openai" | "openrouter";

export const DEFAULT_LUNA: Record<Provider, string> = {
  openai: "gpt-5.6-luna",
  openrouter: "openai/gpt-5.6-luna",
};

/** Erster Seed der Studie; der Live-Lauf misst nur diesen einen. */
export const LIVE_SEED = 1000;

export interface LiveOptions {
  noReasoning: boolean;
  flex: boolean;
}

/**
 * Anfrage wie der Runner der Studie: 4 Ausgabe-Tokens, Top-5-Logprobs. Mit
 * OpenAI, Reasoning aus und Flex an ist das der Body aus `request.exampleBody`.
 * OpenRouter kennt Flex und `seed` in dieser Form nicht; dort gelten die
 * Parameter der Folie `kontext-hygiene`.
 */
export function liveBody(
  provider: Provider,
  model: string,
  req: RequestSpec,
  user: string,
  opts: LiveOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: user },
    ],
    logprobs: true,
    top_logprobs: 5,
  };
  if (provider === "openai") {
    body.max_completion_tokens = 4;
    body.seed = LIVE_SEED;
    if (opts.noReasoning) body.reasoning_effort = "none";
    if (opts.flex) body.service_tier = "flex";
  } else {
    body.max_tokens = 4;
    body.provider = { require_parameters: true };
    if (opts.noReasoning) body.reasoning = { enabled: false };
  }
  return body;
}

/** Geschätzte Kosten eines Laufs aus den gemessenen Kosten je Anfrage (Luna, Flex). */
export function estimateCostUsd(
  study: Study7,
  cond: ConditionName,
  requests: number,
): number {
  const per = study.notes.cost.luna.perCondition[cond];
  if (!per) throw new Error(`keine Kostenangabe für ${cond}`);
  return per.costUsd * requests;
}

// --- Auswertung einer Antwort ----------------------------------------------

/**
 * Leak nach `build.ts`: Top-1 beginnt mit einem Anfang, den die Regelliste
 * verlangt, und ist nicht das Soll-Token.
 */
export function isLeak(
  top1: string,
  gold: string,
  leaks: readonly string[],
): boolean {
  const t = norm(top1);
  if (isHit(top1, gold)) return false;
  return leaks.some((l) => t.startsWith(l.toLowerCase()));
}

export interface LiveResult {
  /** [Token, Wahrscheinlichkeit], Leerraum-Tokens entfernt und renormiert */
  top: [string, number][];
  top1: string | null;
  p1: number | null;
  logit: number | null;
  hit: boolean;
  leak: boolean;
  error?: string;
  /** Wiederholen lohnt nicht: Key, Modellname oder Parameter stimmen nicht. */
  fatal?: boolean;
  /** Rate-Limit oder Serverfehler: später erneut. */
  retry?: boolean;
  usage?: string;
}

const failure = (
  error: string,
  flags: { fatal?: boolean; retry?: boolean } = {},
): LiveResult => ({
  top: [],
  top1: null,
  p1: null,
  logit: null,
  hit: false,
  leak: false,
  error,
  ...flags,
});

export interface TopLogprob {
  token: string;
  logprob: number;
}

/**
 * Auswertung wie `measure` in der Studie: Tokens ohne Leerraum und klein
 * geschrieben zusammenfassen, Leerraum-Tokens verwerfen, renormieren, P(top1)
 * bei `P_MAX` deckeln. Angezeigt wird je Gruppe die wahrscheinlichste
 * Schreibweise.
 */
export function measureTop(
  top: readonly TopLogprob[],
  gold: string,
  leaks: readonly string[],
): LiveResult {
  const groups = new Map<string, { p: number; best: number; shown: string }>();
  for (const { token, logprob } of top) {
    const p = Math.exp(Math.min(logprob, 0));
    const k = norm(token);
    const g = groups.get(k);
    if (!g) groups.set(k, { p, best: p, shown: token.trim() });
    else {
      g.p += p;
      if (p > g.best) {
        g.best = p;
        g.shown = token.trim();
      }
    }
  }
  const pws = groups.get("<ws>")?.p ?? 0;
  groups.delete("<ws>");
  if (!groups.size) return failure("nur Leerraum unter den Top-5-Tokens");
  let sum = 0;
  for (const g of groups.values()) sum += g.p;
  const mass = Math.max(1 - pws, sum);
  const ranked = [...groups.values()]
    .map((g): [string, number] => [g.shown, g.p / mass])
    .sort((a, b) => b[1] - a[1]);
  const [top1, best] = ranked[0]!;
  const p1 = Math.min(best, P_MAX);
  return {
    top: ranked,
    top1,
    p1,
    logit: Math.log(p1 / (1 - p1)),
    hit: isHit(top1, gold),
    leak: isLeak(top1, gold, leaks),
  };
}

/**
 * Ersetzt alles, was wie ein API-Key aussieht, durch `sk-…`. Anbieter zitieren
 * in Fehlermeldungen Teile des Keys („Incorrect API key provided: sk-ab***yz“);
 * die Folie zeigt Fehlermeldungen an, also auch vor Publikum.
 */
export function redactKeys(text: string): string {
  // matches:  "sk-proj-Ab12*****9xYz"  und  "sk-or-v1-0123abcd"  ->  "sk-…"
  // Kein Punkt in der Klasse: der Satzpunkt hinter dem Key bleibt stehen.
  return text.replace(/\bsk-[A-Za-z0-9_*-]{2,}/g, "sk-…");
}

/** Was bei diesem HTTP-Status zu tun ist; steht hinter der Fehlermeldung. */
export function errorHint(status: number): string {
  if (status === 401 || status === 403) return "Key oder Berechtigung prüfen.";
  if (status === 400 || status === 404) {
    return "Modellname im Feld „Modell“ prüfen oder einen Haken ändern.";
  }
  if (status === 429) {
    return "Rate-Limit oder Flex ausgelastet: später erneut, oder Flex abwählen.";
  }
  if (status >= 500) return "Fehler beim Anbieter: später erneut.";
  return "";
}

interface LiveJson {
  error?: { message?: string } | string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  choices?: {
    logprobs?: { content?: { top_logprobs?: TopLogprob[] }[] } | null;
  }[];
}

/** Antwort der Chat-Completions-Schnittstelle zu einem Messwert oder einer Fehlermeldung. */
export function parseLive(
  status: number,
  text: string,
  gold: string,
  leaks: readonly string[],
): LiveResult {
  let json: LiveJson | null = null;
  try {
    json = JSON.parse(text) as LiveJson;
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
    return failure(`HTTP ${status}: ${msg} ${errorHint(status)}`.trim(), {
      fatal: [400, 401, 403, 404].includes(status),
      retry: status === 429 || status >= 500,
    });
  }
  const u = json.usage ?? {};
  const usage = `Modell laut Antwort: ${json.model ?? "?"} · Tokens ein/aus ${u.prompt_tokens ?? "?"}/${u.completion_tokens ?? "?"}`;
  const first = json.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;
  const top = (first ?? []).filter((t) => t.logprob > -9000);
  if (!top.length) {
    return failure(
      `keine Logprobs in der Antwort (${usage}). Das Modell oder der Anbieter liefert keine; anderes Modell eintragen.`,
    );
  }
  return { ...measureTop(top, gold, leaks), usage };
}

// --- Lauf über mehrere Stellen ---------------------------------------------

export interface LiveJob {
  /** Schlüssel, unter dem das Ergebnis abgelegt wird */
  key: string;
  label: string;
  gold: string;
  body: Record<string, unknown>;
}

export interface RunOptions {
  /** Schickt eine Anfrage; wirft bei Netzfehler oder Abbruch (`AbortError`). */
  send: (
    body: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<{ status: number; text: string }>;
  /** Wartet zwischen zwei Versuchen. */
  sleep: (ms: number) => Promise<void>;
  signal: AbortSignal;
  leaks: readonly string[];
  onResult: (job: LiveJob, result: LiveResult) => void;
  concurrency?: number;
  attempts?: number;
}

export interface RunSummary {
  done: number;
  failed: number;
  /** nach einem Fehler, der sich wiederholen würde, nicht mehr gesendet */
  skipped: number;
  stopped: boolean;
}

export const RETRY_BASE_MS = 1500;

/**
 * Arbeitet die Anfragen mit mehreren parallelen Arbeitern ab. Rate-Limit und
 * Serverfehler werden wiederholt, mit wachsender Pause. Ein Fehler, den eine
 * Wiederholung nicht behebt (Key, Modellname), stoppt den Rest: Alle Anfragen
 * gehen an dasselbe Modell und würden gleich scheitern. Nach einem Abbruch
 * bleiben die offenen Anfragen ohne Ergebnis.
 */
export async function runJobs(
  jobs: readonly LiveJob[],
  opts: RunOptions,
): Promise<RunSummary> {
  const queue = jobs.slice();
  const attempts = opts.attempts ?? 3;
  const sum: RunSummary = { done: 0, failed: 0, skipped: 0, stopped: false };
  let dead: string | null = null;

  async function one(job: LiveJob): Promise<LiveResult | null> {
    let r: LiveResult | null = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await opts.send(job.body, opts.signal);
        r = parseLive(res.status, res.text, job.gold, opts.leaks);
      } catch (e) {
        if (opts.signal.aborted || (e as Error).name === "AbortError") {
          return null;
        }
        r = failure(`Netzfehler: ${(e as Error).message || String(e)}`, {
          retry: true,
        });
      }
      if (!r.retry || attempt === attempts) break;
      await opts.sleep(RETRY_BASE_MS * attempt);
      if (opts.signal.aborted) return null;
    }
    return r;
  }

  async function worker(): Promise<void> {
    while (queue.length && !opts.signal.aborted) {
      const job = queue.shift()!;
      if (dead !== null) {
        sum.skipped++;
        opts.onResult(
          job,
          failure(`nicht gesendet: früherer Fehler (${dead})`),
        );
        continue;
      }
      const r = await one(job);
      if (r === null) break;
      if (r.error) {
        sum.failed++;
        if (r.fatal) dead = r.error;
      } else {
        sum.done++;
      }
      opts.onResult(job, r);
    }
  }

  const n = Math.max(1, Math.min(opts.concurrency ?? 4, jobs.length));
  await Promise.all(Array.from({ length: n }, worker));
  sum.stopped = opts.signal.aborted;
  return sum;
}

// --- Live gegen Studie -----------------------------------------------------

export interface LiveSummary {
  /** Semantik-Stellen mit Messwert */
  measured: number;
  logit: number;
  /** gegen die Grundlinie der Studie (3 Seeds) an denselben Stellen */
  delta: number;
  leaks: number;
  falling: number;
}

/**
 * Mittel eines Live-Laufs über die Semantik-Stellen mit Messwert, oder `null`
 * ohne Messwert. `baseline` sind die Zeilen derselben Auswahl ohne Regeln.
 */
export function summarizeLive(
  rows: readonly SiteRow[],
  baseline: readonly SiteRow[],
  results: (siteId: string) => LiveResult | undefined,
): LiveSummary | null {
  const base = new Map(baseline.map((r) => [r.site.id, r.cell.logit]));
  let measured = 0;
  let logit = 0;
  let delta = 0;
  let leaks = 0;
  let falling = 0;
  for (const row of rows) {
    if (!row.semantic) continue;
    const r = results(row.site.id);
    const b = base.get(row.site.id);
    if (!r || r.logit === null || b === undefined) continue;
    measured++;
    logit += r.logit;
    delta += r.logit - b;
    if (r.leak) leaks++;
    if (r.logit - b < 0) falling++;
  }
  if (!measured) return null;
  return {
    measured,
    logit: logit / measured,
    delta: delta / measured,
    leaks,
    falling,
  };
}

// --- Darstellung -----------------------------------------------------------

/** Zahl mit Dezimalkomma und echtem Minuszeichen. */
export function formatNumber(x: number, digits = 2): string {
  const s = Math.abs(x).toFixed(digits).replace(".", ",");
  const zero = Number(Math.abs(x).toFixed(digits)) === 0;
  return x < 0 && !zero ? `−${s}` : s;
}

/** Wie `formatNumber`, positive Werte mit Pluszeichen; für Differenzen. */
export function formatDelta(x: number, digits = 2): string {
  const s = formatNumber(x, digits);
  const zero = Number(Math.abs(x).toFixed(digits)) === 0;
  return x > 0 && !zero ? `+${s}` : s;
}

/** Dollarbetrag mit zwei tragenden Stellen, etwa „0,00058 $“. */
export function formatUsd(x: number): string {
  if (x <= 0) return "0 $";
  const digits = Math.max(2, 1 - Math.floor(Math.log10(x)));
  return `${x.toFixed(digits).replace(".", ",")} $`;
}
