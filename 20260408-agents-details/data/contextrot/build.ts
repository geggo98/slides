#!/usr/bin/env bun
//
// Baut aus den Rohdaten von Studie 7 („Anzahl oder Inhalt der Regeln?“) die Daten
// für die Folie „Regeln, die nie greifen“ und schreibt sie schlank nach
// `study7-luna.json`.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/contextrot/build.ts <pfad>/study7
//
// `<pfad>/study7` ist das Verzeichnis der Studie. Gelesen wird (nur lesend)
//   - `results/experiment.sqlite`   Anfragen, Antworten, Top-5-Logprobs, Kosten, Latenz
//   - `results/analysis.json`       Berichtswerte (gepoolt, Intervall, fallend) zum Abgleich
//   - `corpus/conditions.json`      Bedingungen, Token-Zahl, `leaks`
//   - `corpus/rules/<name>.txt`     Regeltext (sha256 gegen conditions.json geprüft)
// Der Pfad wird bewusst übergeben und nicht fest verdrahtet: die Studie liegt
// außerhalb dieses Repos.
//
// Was übernommen wird
// -------------------
// - `request`: System-Prompt, TASK, TASK_RULES, Vorlagen des User-Prompts (wie
//   `build_message` in `study7/run.py`), ein vollständiger Beispiel-Body.
// - `conditions`: none, contra-1/3/10, ban-8, req-8 mit Regeltext und `leaks`.
// - `sites`: je Fachgebiet und Variante die 10 Stellen, Code-Präfix bis zur Stelle.
// - `results.luna`: je Bedingung × Variante × Stelle die Top-5 (Mittel über 3 Seeds),
//   Einzel-Seeds, logit, Leak-Anteil. `aggregates`: Luna mit Teilmengen, Terra und
//   Sol nur Aggregate.
//
// Was geprüft wird (das Skript bricht sonst ab)
// ---------------------------------------------
// - Jeder User-Prompt der übernommenen Luna-Anfragen ist byte-genau das, was die
//   Vorlagen aus `request` liefern (nach Einsetzen des Regeltexts).
// - Der Regeltext passt zum sha256 in conditions.json.
// - Alle Code-Präfixe einer (Fachgebiet, Variante) sind Anfänge des längsten Präfixes.
// - Die selbst gerechneten Gesamtwerte (beide Fachgebiete, D0 und D4) stimmen mit
//   `analysis.json` überein (Abweichung unter 0,005). Abweichungen stehen unter
//   `checks` in der Ausgabe und werden auf stderr gemeldet.

import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "results/experiment.sqlite"))) {
  console.error("usage: bun run build.ts <pfad>/study7");
  process.exit(2);
}
const OUT = join(dirname(import.meta.path), "study7-luna.json");

const P_MAX = 0.999;
const SEEDS = [1000, 1001, 1002];
const COND_SHOWN = [
  "none",
  "contra-1",
  "contra-3",
  "contra-10",
  "ban-8",
  "req-8",
];
const MODELS = {
  luna: "gpt-5.6-luna",
  terra: "gpt-6.1-terra",
  sol: "gpt-6-sol",
} as const;
type Model = keyof typeof MODELS;
const VARIANTS = ["D0", "D4"] as const;

// Wörtlich aus study7/run.py (Zeilen 49 bis 51) und run.py der Studie 1.
const SYSTEM_PROMPT =
  "You are a code completion engine. The user message is a source file that ends at the cursor. " +
  "Continue the file exactly at the cursor, starting with the very next character. " +
  "Output only the raw continuation. No markdown, no code fences, no explanation, no repetition of existing code.";
const TASK =
  'Complete the Java source file in the section "Source file". Continue exactly at its end.';
const TASK_RULES = TASK + '\nFollow every rule in the section "Rules".';
const tmplNone = (prefix: string) =>
  `# Task\n${TASK}\n\n# Source file\n\`\`\`java\n${prefix}`;
const tmplRules = (rules: string, prefix: string) =>
  `# Task\n${TASK_RULES}\n\n# Rules\n${rules}\n\n# Source file\n\`\`\`java\n${prefix}`;

const db = new Database(join(dir, "results/experiment.sqlite"), {
  readonly: true,
});
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

// ---- Messung, 1:1 aus analyze.py (Studie 1) --------------------------------

const normalize = (t: string) => t.replace(/\s+/g, "").toLowerCase() || "<ws>";
function isHit(top: string, gold: string): boolean {
  const a = normalize(top);
  const b = gold.toLowerCase();
  if (a === "<ws>") return false;
  if (b.startsWith(a)) return true;
  if (!a.startsWith(b)) return false;
  const alnum = (c: string) => /[A-Za-z0-9_]/.test(c);
  return !alnum(b[b.length - 1]!) || !alnum(a[b.length] ?? "");
}
interface Measure {
  top1: string; // normalisiert
  top1Raw: string;
  p1: number;
  logit: number;
  hit: boolean;
  offFormat: boolean;
  ranked: [string, number][]; // [normalisierter Schlüssel, renormierte Wahrscheinlichkeit]
  raw: Map<string, string>; // Schlüssel -> Anzeigetoken (wahrscheinlichste Roh-Variante, getrimmt)
}
function measure(tops: [string, number][], gold: string): Measure | null {
  const groups = new Map<string, number>();
  const rawBest = new Map<string, [string, number]>();
  for (const [token, lp] of tops) {
    const k = normalize(token);
    const p = Math.exp(lp);
    groups.set(k, (groups.get(k) ?? 0) + p);
    const cur = rawBest.get(k);
    if (!cur || p > cur[1])
      rawBest.set(k, [token.trim() === "" ? token : token.trim(), p]);
  }
  const pWs = groups.get("<ws>") ?? 0;
  groups.delete("<ws>");
  if (!groups.size) return null; // wie off_format=True in der Analyse: Messung zählt nicht
  const sum = [...groups.values()].reduce((a, b) => a + b, 0);
  const mass = Math.max(1 - pWs, sum);
  const ranked = [...groups.entries()]
    .map(([k, v]) => [k, v / mass] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const p1 = Math.min(ranked[0]![1], P_MAX);
  const top1 = ranked[0]![0];
  const raw = new Map([...rawBest].map(([k, v]) => [k, v[0]]));
  if (top1.startsWith("```") || top1.startsWith("<|")) return null;
  return {
    top1,
    top1Raw: raw.get(top1)!,
    p1,
    logit: Math.log(p1 / (1 - p1)),
    hit: isHit(top1, gold),
    offFormat: false,
    ranked,
    raw,
  };
}
const isLeak = (top1: string, leaks: string[]) =>
  top1 !== "<ws>" && leaks.some((l) => top1.startsWith(l.toLowerCase()));

// ---- Bedingungen und Regeltexte --------------------------------------------

const conditionsAll = JSON.parse(
  readFileSync(join(dir, "corpus/conditions.json"), "utf8"),
) as Record<
  string,
  {
    chars: number;
    file: string;
    kind: string;
    leaks: string[];
    sha256: string;
    tokens: number;
  }
>;
const ruleText: Record<string, string> = {};
for (const c of COND_SHOWN.filter((c) => c !== "none")) {
  const text = readFileSync(
    join(dir, "corpus", conditionsAll[c]!.file),
    "utf8",
  );
  if (sha(text) !== conditionsAll[c]!.sha256)
    throw new Error(`${c}: Regeltext passt nicht zu conditions.json`);
  ruleText[c] = text;
  if (conditionsAll[c]!.kind !== "rules")
    throw new Error(
      `${c}: kind ${conditionsAll[c]!.kind}, Vorlage kennt nur rules`,
    );
}

// ---- Anfragen laden ---------------------------------------------------------

interface Req {
  key: string;
  stage: string;
  condition: string;
  scenario: string;
  variant: string;
  site: string;
  cls: string;
  gold: string;
  seed: number;
  model: Model;
  body: string;
}
const modelOf = (route: string) =>
  Object.entries(MODELS).find(([, v]) => v === route)![0] as Model;
const reqRows = db
  .query(
    `SELECT q.request_key key, q.stage, q.condition, q.scenario, q.variant, q.site, q.cls, q.gold, q.seed, rq.route, rq.body
     FROM s7_requests q JOIN requests rq USING(request_key) WHERE q.stage != 'pilot'`,
  )
  .all() as any[];
const reqs: Req[] = reqRows.map((r) => ({ ...r, model: modelOf(r.route) }));
const respStmt = db.query(
  `SELECT response_id, prompt_tokens, latency_ms, cost_usd, completion_tokens, reasoning_tokens FROM responses WHERE request_key=? AND valid=1 ORDER BY response_id DESC LIMIT 1`,
);
const topsStmt = db.query(
  `SELECT token, logprob FROM token_logprobs WHERE response_id=? AND position=0 ORDER BY rank`,
);

interface Row {
  seed: number;
  m: Measure;
  leak: boolean;
  promptTokens: number;
  latencyMs: number;
  cost: number;
}
const cells = new Map<string, { cls: string; gold: string; rows: Row[] }>(); // model|cond|variant|scenario|site
const dropped: Record<string, number> = {};
const prompts = new Map<string, string>(); // Luna: Prefix je (scenario|variant|site) aus der none-Anfrage
for (const r of reqs) {
  const resp = respStmt.get(r.key) as any;
  if (!resp) continue;
  const cond = conditionsAll[r.condition] ?? { leaks: [] as string[] };
  if (!COND_SHOWN.includes(r.condition)) continue;
  const tops = (topsStmt.all(resp.response_id) as any[])
    .filter((t) => t.logprob > -9000)
    .map((t) => [t.token, t.logprob] as [string, number]);
  const m = measure(tops, r.gold);
  if (!m) {
    dropped[`${r.model}/${r.condition}`] =
      (dropped[`${r.model}/${r.condition}`] ?? 0) + 1;
    continue;
  }
  const leak = !!cond.leaks.length && !m.hit && isLeak(m.top1, cond.leaks);
  const k = [r.model, r.condition, r.variant, r.scenario, r.site].join("|");
  const cell = cells.get(k) ?? { cls: r.cls, gold: r.gold, rows: [] };
  cell.rows.push({
    seed: r.seed,
    m,
    leak,
    promptTokens: resp.prompt_tokens,
    latencyMs: resp.latency_ms,
    cost: resp.cost_usd,
  });
  cells.set(k, cell);
}

// Prompt-Präfixe und Gegenprobe der Vorlagen (Luna, alle gezeigten Bedingungen).
const userOf = (body: string, cond: string): string => {
  const b = JSON.parse(
    body.replace(/\{\{filler:[0-9a-f]{64}\}\}/g, () =>
      JSON.stringify(ruleText[cond] ?? "").slice(1, -1),
    ),
  );
  if (b.messages[0].content !== SYSTEM_PROMPT)
    throw new Error("System-Prompt weicht ab");
  return b.messages[1].content as string;
};
for (const r of reqs.filter(
  (r) => r.model === "luna" && COND_SHOWN.includes(r.condition),
)) {
  const user = userOf(r.body, r.condition);
  const marker = "```java\n";
  const prefix = user.slice(user.indexOf(marker) + marker.length);
  const expected =
    r.condition === "none"
      ? tmplNone(prefix)
      : tmplRules(ruleText[r.condition]!, prefix);
  if (expected !== user)
    throw new Error(
      `Vorlage weicht ab: ${r.condition} ${r.scenario} ${r.variant} ${r.site}`,
    );
  const pk = [r.scenario, r.variant, r.site].join("|");
  const seen = prompts.get(pk);
  if (seen !== undefined && seen !== prefix)
    throw new Error(`Präfix ${pk} je Bedingung verschieden`);
  prompts.set(pk, prefix);
}

// ---- Stellen ----------------------------------------------------------------

const SCENARIOS = { warehouse: "Lager", expense: "Spesen" } as const;
type Scenario = keyof typeof SCENARIOS;
const siteMeta = new Map<string, { cls: string; gold: string }>();
for (const r of reqs)
  siteMeta.set([r.scenario, r.variant, r.site].join("|"), {
    cls: r.cls,
    gold: r.gold,
  });

function buildSites(scenario: Scenario) {
  const out: Record<string, unknown> = {};
  for (const v of VARIANTS) {
    const ids = [...siteMeta.keys()]
      .filter((k) => k.startsWith(`${scenario}|${v}|`))
      .map((k) => k.split("|")[2]!)
      .sort();
    const prefixes = ids.map((id) => prompts.get(`${scenario}|${v}|${id}`)!);
    const code = prefixes.reduce((a, b) => (b.length > a.length ? b : a));
    for (const p of prefixes)
      if (!code.startsWith(p))
        throw new Error(
          `${scenario} ${v}: Präfixe sind keine Anfänge desselben Codes`,
        );
    out[v] = {
      // Der Code-Präfix einer Stelle ist code.slice(0, prefixChars); alle Präfixe sind Anfänge des längsten (geprüft).
      code,
      sites: ids.map((id, i) => {
        const meta = siteMeta.get(`${scenario}|${v}|${id}`)!;
        const p = prefixes[i]!;
        return {
          id,
          cls: meta.cls,
          gold: meta.gold,
          prefixChars: p.length,
          cursorContext: p.slice(-40),
        };
      }),
    };
  }
  return out;
}

// ---- Ergebnisse je Zelle ------------------------------------------------------

function cellResult(
  model: Model,
  cond: string,
  v: string,
  sc: string,
  id: string,
) {
  const c = cells.get([model, cond, v, sc, id].join("|"));
  if (!c) return null;
  const rows = [...c.rows].sort((a, b) => a.seed - b.seed);
  const probs = new Map<string, number>();
  const display = new Map<string, string>();
  for (const r of rows) {
    for (const [k, p] of r.m.ranked) {
      probs.set(k, (probs.get(k) ?? 0) + p / rows.length);
      if (!display.has(k)) display.set(k, r.m.raw.get(k)!);
    }
  }
  const top5 = [...probs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, p]) => [display.get(k)!, r4(p)]);
  const top1Share = new Map<string, number>();
  for (const r of rows)
    top1Share.set(r.m.top1Raw, (top1Share.get(r.m.top1Raw) ?? 0) + 1);
  return {
    top5,
    top1: top5[0]![0],
    logit: r4(mean(rows.map((r) => r.m.logit))),
    leak: r4(mean(rows.map((r) => +r.leak))),
    hit: r4(mean(rows.map((r) => +r.m.hit))),
    n: rows.length,
    seeds: rows.map((r) => [r.seed, r.m.top1Raw, r4(r.m.p1), r4(r.m.logit)]),
  };
}

// ---- Aggregate wie analyze.py -------------------------------------------------

interface Agg {
  logit: number;
  delta: number | null;
  hit: number;
  leak: number;
  n: number; // Semantik-Stellen
  syntaxDelta: number | null;
}
function aggregate(model: Model, cond: string, v: string, scs: string[]): Agg {
  const keys = [...cells.keys()].filter((k) => {
    const [m, c, vv, sc] = k.split("|");
    return (
      m === model &&
      c === cond &&
      vv === v &&
      scs.includes(sc!) &&
      cells.get(k)!.cls !== "syntax"
    );
  });
  const syn = [...cells.keys()].filter((k) => {
    const [m, c, vv, sc] = k.split("|");
    return (
      m === model &&
      c === cond &&
      vv === v &&
      scs.includes(sc!) &&
      cells.get(k)!.cls === "syntax"
    );
  });
  const lg = (k: string) => mean(cells.get(k)!.rows.map((r) => r.m.logit));
  const base = (k: string) => k.replace(`|${cond}|`, "|none|");
  const diffs =
    cond === "none"
      ? []
      : keys.filter((k) => cells.has(base(k))).map((k) => lg(k) - lg(base(k)));
  const sd =
    cond === "none"
      ? []
      : syn.filter((k) => cells.has(base(k))).map((k) => lg(k) - lg(base(k)));
  const rows = keys.flatMap((k) => cells.get(k)!.rows);
  return {
    logit: r4(mean(keys.map(lg))),
    delta: diffs.length ? r4(mean(diffs)) : null,
    hit: r4(mean(rows.map((r) => +r.m.hit))),
    leak: r4(mean(rows.map((r) => +r.leak))),
    n: keys.length,
    syntaxDelta: sd.length ? r4(mean(sd)) : null,
  };
}
function pooled(model: Model, cond: string, scs: string[]) {
  const d: number[] = [];
  for (const v of VARIANTS) {
    const keys = [...cells.keys()].filter((k) => {
      const [m, c, vv, sc] = k.split("|");
      return (
        m === model &&
        c === cond &&
        vv === v &&
        scs.includes(sc!) &&
        cells.get(k)!.cls !== "syntax"
      );
    });
    for (const k of keys) {
      const b = k.replace(`|${cond}|`, "|none|");
      if (cells.has(b))
        d.push(
          mean(cells.get(k)!.rows.map((r) => r.m.logit)) -
            mean(cells.get(b)!.rows.map((r) => r.m.logit)),
        );
    }
  }
  return {
    delta: d.length ? r4(mean(d)) : null,
    falling: d.filter((x) => x < 0).length,
    of: d.length,
  };
}

const SUBSETS: Record<string, string[]> = {
  all: ["warehouse", "expense"],
  warehouse: ["warehouse"],
};
const aggregates: Record<string, unknown> = {};
for (const model of Object.keys(MODELS) as Model[]) {
  const perSubset: Record<string, unknown> = {};
  for (const [name, scs] of Object.entries(SUBSETS)) {
    const perCond: Record<string, unknown> = {};
    for (const cond of COND_SHOWN) {
      const byVar = Object.fromEntries(
        VARIANTS.map((v) => [v, aggregate(model, cond, v, scs)]),
      );
      perCond[cond] = {
        ...byVar,
        pooled: cond === "none" ? null : pooled(model, cond, scs),
      };
    }
    perSubset[name] = perCond;
  }
  aggregates[model] = perSubset;
}

// ---- Abgleich mit analysis.json und Gesamtbericht ----------------------------

const analysis = JSON.parse(
  readFileSync(join(dir, "results/analysis.json"), "utf8"),
).models as Record<string, Record<string, any>>;
const checks: {
  what: string;
  mine: number | null;
  report: number;
  ok: boolean;
}[] = [];
const near = (a: number | null, b: number, tol = 0.005) =>
  a !== null && Math.abs(a - b) <= tol;
const reportAnalysis: Record<string, any> = {};
for (const model of Object.keys(MODELS) as Model[]) {
  reportAnalysis[model] = {};
  for (const cond of COND_SHOWN) {
    const a = analysis[model]?.[cond];
    if (!a) continue;
    reportAnalysis[model][cond] = {
      tokens: a.tokens,
      pooled: a.pooled === null ? null : r4(a.pooled),
      ci: a.ci ? a.ci.map(r4) : null,
      falling: a.falling,
      D0: {
        logit: r4(a.D0.logit),
        delta: a.D0.delta === null ? null : r4(a.D0.delta),
        hit: r4(a.D0.hit),
        leak: r4(a.D0.leak),
      },
      D4: {
        logit: r4(a.D4.logit),
        delta: a.D4.delta === null ? null : r4(a.D4.delta),
        hit: r4(a.D4.hit),
        leak: r4(a.D4.leak),
      },
    };
    const mine = (aggregates[model] as any).all[cond];
    for (const v of VARIANTS) {
      checks.push({
        what: `${model} ${cond} ${v} logit (analysis.json)`,
        mine: mine[v].logit,
        report: a[v].logit,
        ok: near(mine[v].logit, a[v].logit),
      });
      checks.push({
        what: `${model} ${cond} ${v} leak (analysis.json)`,
        mine: mine[v].leak,
        report: a[v].leak,
        ok: near(mine[v].leak, a[v].leak),
      });
      if (a[v].delta !== null)
        checks.push({
          what: `${model} ${cond} ${v} delta (analysis.json)`,
          mine: mine[v].delta,
          report: a[v].delta,
          ok: near(mine[v].delta, a[v].delta),
        });
    }
    if (a.pooled !== null)
      checks.push({
        what: `${model} ${cond} pooled (analysis.json)`,
        mine: mine.pooled.delta,
        report: a.pooled,
        ok: near(mine.pooled.delta, a.pooled),
      });
  }
}
// Werte, wie der Gesamtbericht sie nennt (Teil 1.2, Studie 7). Prozent als Anteil.
const reportValues: [string, number, number | null][] = [
  [
    "luna contra-1 pooled",
    -0.96,
    (aggregates.luna as any).all["contra-1"].pooled.delta,
  ],
  [
    "luna contra-3 pooled",
    -1.44,
    (aggregates.luna as any).all["contra-3"].pooled.delta,
  ],
  [
    "luna contra-10 pooled",
    -1.62,
    (aggregates.luna as any).all["contra-10"].pooled.delta,
  ],
  [
    "luna req-8 pooled",
    -2.99,
    (aggregates.luna as any).all["req-8"].pooled.delta,
  ],
  [
    "terra req-8 pooled",
    -3.81,
    (aggregates.terra as any).all["req-8"].pooled.delta,
  ],
  [
    "sol req-8 pooled",
    -3.19,
    (aggregates.sol as any).all["req-8"].pooled.delta,
  ],
  [
    "sol contra-1 pooled",
    -0.53,
    (aggregates.sol as any).all["contra-1"].pooled.delta,
  ],
  ["luna req-8 leak D0", 0.54, (aggregates.luna as any).all["req-8"].D0.leak],
  ["luna req-8 leak D4", 0.61, (aggregates.luna as any).all["req-8"].D4.leak],
  ["terra req-8 leak D0", 0.33, (aggregates.terra as any).all["req-8"].D0.leak],
  ["terra req-8 leak D4", 0.48, (aggregates.terra as any).all["req-8"].D4.leak],
  ["sol req-8 leak D0", 0.15, (aggregates.sol as any).all["req-8"].D0.leak],
  ["sol req-8 leak D4", 0.35, (aggregates.sol as any).all["req-8"].D4.leak],
  ["luna ban-8 leak D0", 0, (aggregates.luna as any).all["ban-8"].D0.leak],
  ["luna ban-8 leak D4", 0, (aggregates.luna as any).all["ban-8"].D4.leak],
];
for (const [what, rep, mine] of reportValues)
  checks.push({
    what: `Gesamtbericht: ${what}`,
    mine,
    report: rep,
    ok: near(mine, rep, 0.011),
  });
const sol1 = (aggregates.sol as any).all["contra-1"].pooled;
checks.push({
  what: "Gesamtbericht: sol contra-1 fallend 17 von 36",
  mine: sol1.falling,
  report: 17,
  ok: sol1.falling === 17 && sol1.of === 36,
});
const bad = checks.filter((c) => !c.ok);
if (bad.length) console.error("ABWEICHUNGEN:", JSON.stringify(bad, null, 1));
console.error(
  `checks: ${checks.length - bad.length} von ${checks.length} stimmen`,
);
if (Object.keys(dropped).length)
  console.error(
    "verworfen (nur Leerraum oder außerhalb des Formats):",
    JSON.stringify(dropped),
  );

// ---- Kosten und Latenz (Luna) -------------------------------------------------

const costRows = db
  .query(
    `SELECT q.condition cond, COUNT(*) n, AVG(r.cost_usd) cost, AVG(r.latency_ms) lat, MAX(r.latency_ms) latMax, AVG(r.prompt_tokens) pt
     FROM s7_requests q JOIN requests rq USING(request_key) JOIN responses r USING(request_key)
     WHERE rq.route = ? AND r.valid = 1 GROUP BY q.condition`,
  )
  .all(MODELS.luna) as any[];
const costBy = Object.fromEntries(
  costRows
    .filter((r) => COND_SHOWN.includes(r.cond))
    .map((r) => [
      r.cond,
      {
        n: r.n,
        costUsd: Math.round(r.cost * 1e7) / 1e7,
        latencyMsMean: Math.round(r.lat),
        latencyMsMax: r.latMax,
        promptTokensMean: Math.round(r.pt),
      },
    ]),
);
const costAll = db
  .query(
    `SELECT COUNT(*) n, AVG(r.cost_usd) cost, AVG(r.latency_ms) lat, MAX(r.latency_ms) latMax FROM s7_requests q JOIN requests rq USING(request_key) JOIN responses r USING(request_key) WHERE rq.route = ? AND r.valid = 1`,
  )
  .get(MODELS.luna) as any;

// ---- Ausgabe ------------------------------------------------------------------

const exampleReq = reqs.find(
  (r) =>
    r.model === "luna" &&
    r.condition === "req-8" &&
    r.scenario === "warehouse" &&
    r.variant === "D4" &&
    r.seed === 1000 &&
    r.cls !== "syntax",
)!;
const exampleBody = JSON.parse(
  exampleReq.body.replace(/\{\{filler:[0-9a-f]{64}\}\}/g, () =>
    JSON.stringify(ruleText["req-8"]).slice(1, -1),
  ),
);

const results: Record<
  string,
  Record<string, Record<string, Record<string, unknown>>>
> = {};
for (const sc of Object.keys(SCENARIOS) as Scenario[]) {
  const ids = (buildSites(sc).D0 as any).sites.map(
    (s: any) => s.id,
  ) as string[];
  for (const cond of COND_SHOWN) {
    for (const v of VARIANTS) {
      for (const id of ids) {
        const r = cellResult("luna", cond, v, sc, id);
        if (r) ((results[sc] ??= {})[cond] ??= {})[`${v}|${id}`] = r;
      }
    }
  }
}

const sitesOut: Record<string, unknown> = {};
for (const sc of Object.keys(SCENARIOS) as Scenario[])
  sitesOut[sc] = { label: SCENARIOS[sc], ...buildSites(sc) };

const out = {
  source: {
    study: "Studie 7: Anzahl oder Inhalt der Regeln?",
    notation:
      "Studie 6 = Screening mit einem Request je Stelle, Studie 7 = drei Seeds. Modelle: luna = gpt-5.6-luna, terra = gpt-6.1-terra, sol = gpt-6-sol.",
    seeds: SEEDS,
    note: "Alle Zahlen aus der Datenbank der Studie nachgerechnet (Skript: build.ts), die Gesamtwerte gegen analysis.json und Gesamtbericht geprüft, siehe checks.",
  },
  request: {
    model: "luna",
    systemPrompt: SYSTEM_PROMPT,
    TASK,
    TASK_RULES,
    userTemplateNone: "# Task\n{TASK}\n\n# Source file\n```java\n{PREFIX}",
    userTemplateRules:
      "# Task\n{TASK_RULES}\n\n# Rules\n{RULES}\n\n# Source file\n```java\n{PREFIX}",
    templateNote:
      "Der Code-Zaun wird nicht geschlossen: der Prompt endet an der Stelle. {RULES} ist der Regeltext der Bedingung wörtlich, {PREFIX} der Code bis zur Stelle. Bei none fehlen der Satz „Follow every rule“ und der Abschnitt „# Rules“ (build_message in study7/run.py).",
    exampleCondition: "req-8",
    exampleSite: {
      scenario: exampleReq.scenario,
      variant: exampleReq.variant,
      site: exampleReq.site,
      seed: exampleReq.seed,
    },
    exampleBody,
    bodyNote:
      "Der Body so, wie der Runner ihn schickt (Chat-Completions, OpenAI), ohne Schlüssel. Flex halbiert den Preis bei längerer Wartezeit.",
  },
  conditions: Object.fromEntries(
    COND_SHOWN.map((c) => [
      c,
      c === "none"
        ? {
            rules: null,
            ruleTokens: 0,
            leaks: [],
            note: "Prompt ohne Regeln, Grundlinie",
          }
        : {
            rules: ruleText[c],
            ruleChars: conditionsAll[c]!.chars,
            ruleTokens: conditionsAll[c]!.tokens,
            leaks: conditionsAll[c]!.leaks,
            kind: conditionsAll[c]!.kind,
          },
    ]),
  ),
  leakDefinition:
    "Leak: Top-1 ist ein Anfang aus `leaks` (Präfix-Vergleich nach Normalisierung: Leerraum entfernt, kleingeschrieben) und nicht das Soll-Token. Unter contra-n und req-8 heißt das: das Modell befolgt die Regel. Unter ban-8: das Verbot ist zum Gebot gekippt. Das Modell hat die Regel dann gelesen und umgesetzt.",
  logitDefinition:
    'analyze.py (Studie 1), Funktion measure: Leerraum-Tokens werden verworfen und der Rest renormiert ("at a line start they measure indentation, not content"); groups[normalize(token)] += exp(logprob), mass = max(1 - p_ws, sum(groups)); ranked = Gruppen nach Wahrscheinlichkeit; p1 = min(ranked[0].p, P_MAX) mit P_MAX = 0.999; logit = ln(p1 / (1 - p1)). Höchstwert daher 6,91. normalize(token) = Leerraum entfernt, kleingeschrieben. Der logit einer Stelle ist das Mittel über die drei Seeds; Δ = logit der Bedingung minus logit derselben Stelle unter none; Δ gepoolt = Mittel über die Semantik-Stellen aus D0 und D4.',
  sites: sitesOut,
  results: {
    model: "luna",
    note: "Schlüssel: Fachgebiet → Bedingung → `<Variante>|<Stelle>`. top5 = [Token, Wahrscheinlichkeit] im Mittel über die Seeds (nach Entfernen von Leerraum-Tokens renormiert); seeds = [Seed, Top-1, P(top1) gedeckelt, logit].",
    cells: results,
  },
  aggregates: {
    note: "all = beide Fachgebiete, D0 und D4 (Aufbau des Berichts: 18 Semantik-Stellen je Variante, Δ gepoolt über 36); warehouse = nur das Fachgebiet Lager (9 Semantik-Stellen je Variante, Δ gepoolt über 18), selbst gerechnet. delta/logit/hit/leak je Variante; leak und hit sind Anteile über die Semantik-Messungen; syntaxDelta ist die Kontrollstelle.",
    byModel: aggregates,
    reportAnalysis: {
      note: "Unverändert aus results/analysis.json (Studie 7), auf 4 Stellen gerundet: der Bericht, gilt für beide Fachgebiete.",
      values: reportAnalysis,
    },
  },
  checks: {
    note: "Eigene Rechnung gegen Berichtswerte; ok = Abweichung höchstens 0,005 (Gesamtbericht-Werte sind auf zwei Stellen gerundet: Toleranz 0,011).",
    failed: bad.length,
    total: checks.length,
    items: checks,
  },
  notes: {
    noise:
      "Lauf-zu-Lauf-Rauschen bei Luna: Zellmittel derselben Eingabe liegen im Mittel um 0,76 logit auseinander (Studie 6, Wiederholung von none). Einzelne Zellen sind deshalb grob.",
    limits: [
      "Rauschen je Zelle: Jede Stelle läuft je Bedingung und Seed einmal. Die drei Seeds mitteln nur die Schwankung zwischen Läufen bei gleicher Eingabe, nicht die Auswahl der Stellen. Laut Studie 6 schwanken Zellmittel von Luna ohne jede Änderung um etwa 0,76.",
      "Decke: Terra und Sol liegen in D0 schon bei none nahe der Obergrenze 6,91 (6,72 und 6,60). Ein Anstieg ist dort kaum messbar, ein Abfall schon.",
      "Regeln aus Vorlagen: Alle Listen sind aus wenigen Schablonen zusammengesetzt; echte Regelwerke klingen anders.",
      "Ein Korpus: ein Paar von Fachgebieten, eine Sprache (Java), 40 Stellen.",
      "Verneinung: nur bis 48 Einträge, nur eine Kopfzeile je Richtung, Regeln direkt vor dem Code.",
      "Nur das erste Token wird gemessen. Ob das Modell danach Regeln befolgt, ist nicht gemessen.",
      "Positivkontrolle (positive-50) bei Luna (ca. 87 %) und Sol (ca. 86 %) knapp unter der vorab gesetzten Schwelle von 90 %.",
    ],
    scope:
      "Die Teilmenge warehouse hat nur 9 Semantik-Stellen je Variante und drei Seeds; einzelne Abweichungen gegen die Berichtswerte sind bei diesem Rauschen zu erwarten.",
    cost: {
      luna: {
        perCondition: costBy,
        allConditions: {
          n: costAll.n,
          costUsdMean: Math.round(costAll.cost * 1e7) / 1e7,
          latencyMsMean: Math.round(costAll.lat),
          latencyMsMax: costAll.latMax,
        },
        note: "Aus der Datenbank (responses.cost_usd, Flex, teils mit Cache; responses.latency_ms, gemessen aus Python, nicht im Browser).",
      },
    },
  },
};

writeFileSync(OUT, JSON.stringify(out) + "\n");
console.error(`${OUT}: ${(readFileSync(OUT).length / 1000).toFixed(1)} kB`);
