#!/usr/bin/env bun
//
// Baut aus den Rohdaten von Studie 9 („Erodieren Regeln, wenn ein Modell die
// Regelliste immer wieder umschreibt?“) die Daten für die Folie „Luna schreibt
// die Regeln um“ und schreibt sie schlank nach `study9-chain.json`.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/erosion/build.ts <pfad>/study9
//
// `<pfad>/study9` ist das Verzeichnis der Studie. Gelesen wird (nur lesend)
//   - `corpus/spec.json`           Originalliste O, Gebote, Anweisungen der Arme, Stellen
//   - `results/experiment.sqlite`  Listenstände je Kette und Runde (`s9_state`), Tests, Logprobs
//   - `results/analysis.json`      Aggregate des Berichts (zum Übernehmen und Abgleichen)
// Der Pfad wird bewusst übergeben und nicht fest verdrahtet: die Studie liegt
// außerhalb dieses Repos.
//
// Was übernommen wird
// -------------------
// - `spec`: O mit Markierung der Gebote A bis D, Arme F, C, D, N, Prompt einer Runde
//   und des Tests, Aufbau.
// - `lists` und `chains`: alle Luna-Ketten aller vier Arme, je Runde 0 bis 6 die
//   Liste (als Verweis in `lists`, gleiche Listen stehen nur einmal), Regelzahl,
//   Wörter je Regel, Gebote mit Wortlaut, Top-1 an den testbaren Stellen.
//   Terra: nur Arm F, kompakt.
// - `aggregate`: je Modell und Arm aus analysis.json.
// - `example`: Kette F-luna-00, Gebot D, Stelle c025, mit Belegen aus der Datenbank.
//
// Was geprüft wird (das Skript bricht nicht ab, meldet aber auf stderr und in `checks`)
// ----------------------------------------------------------------------------------
// - Die aus den Rohantworten selbst gerechneten Aggregate (Befolgung testbar, Regeln,
//   Wörter je Regel, Gebote da) stimmen mit analysis.json überein.
// - Die Werte, die der Gesamtbericht (Teil 2.2) nennt, stimmen mit den Aggregaten überein.
// - Die testbaren Stellen aus O sind die, die analysis.json nennt.

import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "results/experiment.sqlite"))) {
  console.error("usage: bun run build.ts <pfad>/study9");
  process.exit(2);
}
const OUT = join(dirname(import.meta.path), "study9-chain.json");

const P_MAX = 0.999;
const ARMS = ["F", "C", "D", "N"] as const;
const MODELS = ["luna", "terra"] as const;
type Model = (typeof MODELS)[number];
const START_IDS = ["A", "B", "C", "D"];

const spec = JSON.parse(readFileSync(join(dir, "corpus/spec.json"), "utf8"));
const analysis = JSON.parse(
  readFileSync(join(dir, "results/analysis.json"), "utf8"),
).models as Record<string, any>;
const db = new Database(join(dir, "results/experiment.sqlite"), {
  readonly: true,
});

const r4 = (x: number | null | undefined) =>
  x === null || x === undefined || Number.isNaN(x)
    ? null
    : Math.round(x * 1e4) / 1e4;
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const sha8 = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 8);

// Wörtlich aus study9/run.py und run.py der Studie 1.
const SYS_COMPACT =
  "You maintain the rule list of a code completion assistant.";
const SYSTEM_PROMPT =
  "You are a code completion engine. The user message is a source file that ends at the cursor. " +
  "Continue the file exactly at the cursor, starting with the very next character. " +
  "Output only the raw continuation. No markdown, no code fences, no explanation, no repetition of existing code.";
const TASK_RULES =
  'Complete the Java source file in the section "Source file". Continue exactly at its end.\nFollow every rule in the section "Rules".';

// ---- Messung wie analyze.py (Studie 1, measure) -------------------------------

const normalize = (t: string) => t.replace(/\s+/g, "").toLowerCase() || "<ws>";
function top5Of(tops: [string, number][]) {
  const groups = new Map<string, number>();
  const raw = new Map<string, [string, number]>();
  for (const [token, lp] of tops) {
    const k = normalize(token);
    const p = Math.exp(lp);
    groups.set(k, (groups.get(k) ?? 0) + p);
    const cur = raw.get(k);
    if (!cur || p > cur[1])
      raw.set(k, [token.trim() === "" ? token : token.trim(), p]);
  }
  const pWs = groups.get("<ws>") ?? 0;
  groups.delete("<ws>");
  if (!groups.size) return null;
  const sum = [...groups.values()].reduce((a, b) => a + b, 0);
  const mass = Math.max(1 - pWs, sum);
  const ranked = [...groups.entries()]
    .map(([k, v]) => [k, v / mass] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const p1 = Math.min(ranked[0]![1], P_MAX);
  return {
    top1: ranked[0]![0],
    top1Raw: raw.get(ranked[0]![0])![0],
    p1,
    logit: Math.log(p1 / (1 - p1)),
    top5: ranked.map(
      ([k, p]) => [raw.get(k)![0], r4(p)] as [string, number | null],
    ),
  };
}

// ---- Spezifikation -------------------------------------------------------------

const BEH: Record<string, any> = Object.fromEntries(
  spec.behaviours.map((b: any) => [b.id, b]),
);
const SITE_BEH: Record<string, string> = {};
for (const b of spec.behaviours) for (const s of b.sites) SITE_BEH[s] = b.id;
const allStart = Object.keys(spec.sites)
  .filter((s) => START_IDS.includes(SITE_BEH[s]!))
  .sort();
const controls = Object.keys(spec.sites)
  .filter((s) => BEH[SITE_BEH[s]!].kind === "control")
  .sort();
const tokenOf = (site: string) => BEH[SITE_BEH[site]!].token as string;
const lineMatches = (line: string, regexes: string[]) =>
  regexes.every((r) => new RegExp(r, "i").test(line));
const presentLines = (items: string[], b: string) =>
  items.filter((l) => lineMatches(l, BEH[b].present));
const wordsPerRule = (items: string[]) =>
  mean(items.map((l) => l.split(/\s+/).filter(Boolean).length));

const originalItems: string[] = spec.original.map((r: any) => r.text);

// ---- Listenstände und Tests ------------------------------------------------------

const state = new Map<
  string,
  { items: string[]; raw: string | null; parseOk: number; note: string }
>();
for (const r of db
  .query("SELECT chain, round, items, raw, parse_ok, note FROM s9_state")
  .all() as any[])
  state.set(`${r.chain}|${r.round}`, {
    items: (JSON.parse(r.items) as [string, string][]).map((x) => x[1]),
    raw: r.raw,
    parseOk: r.parse_ok,
    note: r.note,
  });

interface TestRow {
  site: string;
  top1: string;
  top1Raw: string;
  p1: number;
  logit: number;
  top5: [string, number | null][];
  requestKey: string;
}
const tests = new Map<string, Map<string, TestRow>>(); // model|arm|chain|round|seed -> site -> Zeile
const respStmt = db.query(
  "SELECT response_id FROM responses WHERE request_key=? AND valid=1 ORDER BY response_id DESC LIMIT 1",
);
const topsStmt = db.query(
  "SELECT token, logprob FROM token_logprobs WHERE response_id=? AND position=0 ORDER BY rank",
);
for (const q of db
  .query(
    "SELECT request_key, model, arm, chain, round, seed, site FROM s9_requests WHERE kind='test'",
  )
  .all() as any[]) {
  const resp = respStmt.get(q.request_key) as any;
  if (!resp) continue;
  const tops = (topsStmt.all(resp.response_id) as any[])
    .filter((t) => t.logprob > -9000)
    .map((t) => [t.token, t.logprob] as [string, number]);
  const m = top5Of(tops);
  if (!m) continue;
  const k = [q.model, q.arm, q.chain, q.round, q.seed].join("|");
  const map = tests.get(k) ?? new Map();
  map.set(q.site, {
    site: q.site,
    top1: m.top1,
    top1Raw: m.top1Raw,
    p1: m.p1,
    logit: m.logit,
    top5: m.top5,
    requestKey: q.request_key,
  });
  tests.set(k, map);
}
const getTest = (
  model: string,
  arm: string,
  chain: string,
  round: number,
  seed: number,
) => tests.get([model, arm, chain, round, seed].join("|"));

// Testbare Stellen je Modell: O in mindestens 2 von 3 Seeds befolgt.
const SEEDS = [1000, 1001, 1002];
const testable: Record<Model, string[]> = { luna: [], terra: [] };
const baseO: Record<Model, any> = { luna: null, terra: null };
for (const model of MODELS) {
  const o = SEEDS.map((sd) => getTest(model, "base", "O", 0, sd)!);
  testable[model] = allStart.filter(
    (s) => o.filter((t) => t.get(s)?.top1 === tokenOf(s)).length >= 2,
  );
  const obey = (t: Map<string, TestRow>, sites: string[]) =>
    mean(
      sites
        .filter((s) => t.has(s))
        .map((s) => +(t.get(s)!.top1 === tokenOf(s))),
    );
  baseO[model] = {
    testable:
      obey(o[0]!, testable[model]) / 3 +
      obey(o[1]!, testable[model]) / 3 +
      obey(o[2]!, testable[model]) / 3,
    all:
      (obey(o[0]!, allStart) + obey(o[1]!, allStart) + obey(o[2]!, allStart)) /
      3,
  };
  const want = analysis[model].testable as string[];
  if (JSON.stringify(want) !== JSON.stringify(testable[model]))
    console.error(
      `ABWEICHUNG testbare Stellen ${model}: ${testable[model]} gegen ${want}`,
    );
}

const obeyOf = (t: Map<string, TestRow>, sites: string[]) =>
  mean(
    sites.filter((s) => t.has(s)).map((s) => +(t.get(s)!.top1 === tokenOf(s))),
  );

// ---- Ketten ------------------------------------------------------------------------

const lists: Record<string, string[]> = {};
const listId = (items: string[]) => {
  const id = "L" + sha8(JSON.stringify(items));
  lists[id] ??= items;
  return id;
};
const chainIds = (model: Model, arm: string) =>
  [
    ...new Set(
      [...state.keys()]
        .map((k) => k.split("|")[0]!)
        .filter((c) => c.startsWith(`${arm}-${model}-`)),
    ),
  ].sort();

type Mode = "full" | "slim" | "terra";
function chainRounds(model: Model, arm: string, chain: string, mode: Mode) {
  const rounds: any[] = [];
  for (let rnd = 0; rnd <= 6; rnd++) {
    const st = state.get(`${chain}|${rnd}`);
    if (!st) {
      rounds.push(null);
      continue;
    }
    const entry: any = {
      round: rnd,
      ...(mode === "full" ? { list: listId(st.items) } : {}),
      rules: st.items.length,
      wordsPerRule: r4(wordsPerRule(st.items)),
      // full: Nummern (ab 1) der Regeln, die Auslöser und Token eines Gebots zugleich enthalten; slim und terra: nur ja/nein
      present: Object.fromEntries(
        START_IDS.map((b) => {
          const idx = st.items.flatMap((l, i) =>
            lineMatches(l, BEH[b].present) ? [i + 1] : [],
          );
          return [b, mode === "full" ? idx : idx.length > 0];
        }),
      ),
      parseOk: st.parseOk === 1,
      tests: null as any,
      obeyTestable: null as number | null,
      obeyAll: null as number | null,
    };
    // Runde 0 = O, getestet mit drei Seeds; hier Seed 1000, alle Seeds stehen in `baseline`.
    const t =
      rnd === 0
        ? getTest(model, "base", "O", 0, 1000)
        : getTest(model, arm, chain, rnd, 1000);
    if (t) {
      // Top-1 (Roh-Token) in der Reihenfolge von chains.lunaTestSites
      entry.tests =
        mode === "terra" ? null : testable[model].map((s) => t.get(s)!.top1Raw);
      entry.obeyTestable = r4(obeyOf(t, testable[model]));
      entry.obeyAll = r4(obeyOf(t, allStart));
      entry.over = r4(
        mean(
          controls
            .filter((s) => t.has(s))
            .map(
              (s) =>
                +["this", "final", "var", "static"].includes(t.get(s)!.top1),
            ),
        ),
      );
    }
    rounds.push(entry);
  }
  return rounds;
}

const chains: { luna: Record<string, any[]>; terra: Record<string, any[]> } = {
  luna: {},
  terra: {},
};
const LIST_ARMS = (process.env.LIST_ARMS ?? "F").split(","); // Arme, deren Listentexte im JSON stehen (Platz: unter 150 kB)
for (const arm of ARMS) {
  chains.luna[arm] = chainIds("luna", arm).map((id) => ({
    id,
    rounds: chainRounds(
      "luna",
      arm,
      id,
      LIST_ARMS.includes(arm) ? "full" : "slim",
    ),
  }));
}
// Terra: nur Arm F, kompakt (ohne Listen- und Stellentexte).
chains.terra.F = chainIds("terra", "F").map((id) => ({
  id,
  rounds: chainRounds("terra", "F", id, "terra"),
}));

// ---- Eigene Rechnung gegen analysis.json -----------------------------------------------

const checks: {
  what: string;
  mine: number | null;
  report: number | null;
  ok: boolean;
}[] = [];
const near = (a: number | null, b: number | null, tol: number) =>
  a === null || b === null ? a === b : Math.abs(a - b) <= tol;
for (const model of MODELS) {
  for (const arm of ARMS) {
    for (let rnd = 0; rnd <= 6; rnd++) {
      const a = analysis[model].table[`${arm}-r${rnd}`];
      if (!a) continue;
      const rs =
        chains[model]![arm]?.map((c) => c.rounds[rnd]).filter(Boolean) ?? [];
      if (!rs.length) continue;
      checks.push({
        what: `${model} ${arm} r${rnd} Regeln`,
        mine: r4(mean(rs.map((r) => r.rules))),
        report: r4(a.rules),
        ok: near(mean(rs.map((r) => r.rules)), a.rules, 1e-3),
      });
      const wv = rs
        .map((r) => r.wordsPerRule)
        .filter((x) => x !== null) as number[]; // leere Liste: keine Wörter je Regel (wie analyze.py)
      checks.push({
        what: `${model} ${arm} r${rnd} Wörter/Regel`,
        mine: r4(mean(wv)),
        report: r4(a.words),
        ok: near(mean(wv), a.words, 1e-3),
      });
      const presentN = mean(
        rs.map(
          (r) =>
            START_IDS.filter((b) =>
              Array.isArray(r.present[b])
                ? r.present[b].length > 0
                : r.present[b],
            ).length,
        ),
      );
      checks.push({
        what: `${model} ${arm} r${rnd} Gebote da`,
        mine: r4(presentN),
        report: r4(a.present),
        ok: near(presentN, a.present, 1e-3),
      });
      if (rnd > 0 && a.tested) {
        const ob = rs
          .filter((r) => r.obeyTestable !== null)
          .map((r) => r.obeyTestable as number);
        checks.push({
          what: `${model} ${arm} r${rnd} Befolgung testbar`,
          mine: r4(mean(ob)),
          report: r4(a.testable),
          ok: near(mean(ob), a.testable, 1e-3),
        });
        const er = mean(ob.map((x) => x - baseO[model].testable));
        checks.push({
          what: `${model} ${arm} r${rnd} Erosion`,
          mine: r4(er),
          report: r4(a.erosion),
          ok: near(er, a.erosion, 1e-3),
        });
        const losing = ob.filter((x) => x - baseO[model].testable < 0).length;
        checks.push({
          what: `${model} ${arm} r${rnd} Ketten mit Verlust`,
          mine: losing,
          report: a.losing,
          ok: losing === a.losing,
        });
      }
    }
  }
}
// Werte, wie der Gesamtbericht Teil 2.2 sie nennt (Zahl, Dezimalstellen).
const T = (m: string, arm: string, r: number) =>
  analysis[m].table[`${arm}-r${r}`];
const rep: [string, number | null, number, number][] = [
  ["luna O testbar", baseO.luna.testable, 0.92, 2],
  ["luna O alle", baseO.luna.all, 0.28, 2],
  ["terra O testbar", baseO.terra.testable, 1.0, 2],
  ["terra O alle", baseO.terra.all, 0.94, 2],
  ["luna F r6 testbar", T("luna", "F", 6).testable, 0.38, 2],
  ["luna F r6 Erosion", T("luna", "F", 6).erosion, -0.54, 2],
  ["luna F r6 Ketten mit Verlust", T("luna", "F", 6).losing, 8, 0],
  ["luna F r6 Gebote da", T("luna", "F", 6).present, 3.6, 1],
  ["luna F r6 Regeln", T("luna", "F", 6).rules, 15.1, 1],
  ["luna F r6 Wörter/Regel", T("luna", "F", 6).words, 6.6, 1],
  [
    "luna F r1 da, nicht befolgt",
    T("luna", "F", 1).present_not_obeyed,
    0.44,
    2,
  ],
  [
    "luna F r6 da, nicht befolgt",
    T("luna", "F", 6).present_not_obeyed,
    0.65,
    2,
  ],
  ["luna F r6 alle", T("luna", "F", 6).all, 0.17, 2],
  ["luna F r1 Erosion", T("luna", "F", 1).erosion, -0.32, 2],
  ["luna C r6 testbar", T("luna", "C", 6).testable, 0.47, 2],
  ["luna C r6 Erosion", T("luna", "C", 6).erosion, -0.44, 2],
  ["luna C r6 Gebote da", T("luna", "C", 6).present, 3.9, 1],
  ["luna C r6 Regeln", T("luna", "C", 6).rules, 15.8, 1],
  ["luna C r6 Wörter/Regel", T("luna", "C", 6).words, 8.3, 1],
  [
    "luna C r1 da, nicht befolgt",
    T("luna", "C", 1).present_not_obeyed,
    0.37,
    2,
  ],
  [
    "luna C r6 da, nicht befolgt",
    T("luna", "C", 6).present_not_obeyed,
    0.49,
    2,
  ],
  ["luna D r6 testbar", T("luna", "D", 6).testable, 0.0, 2],
  ["luna D r6 Erosion", T("luna", "D", 6).erosion, -0.92, 2],
  ["luna D r6 Gebote da", T("luna", "D", 6).present, 0.0, 1],
  ["luna D r6 Regeln", T("luna", "D", 6).rules, 9.2, 1],
  ["luna D r6 Wörter/Regel", T("luna", "D", 6).words, 8.1, 1],
  ["luna N r6 testbar", T("luna", "N", 6).testable, 0.97, 2],
  ["luna N r6 Erosion", T("luna", "N", 6).erosion, 0.06, 2],
  ["luna N r6 Regeln", T("luna", "N", 6).rules, 20.0, 1],
  ["luna N r6 Wörter/Regel", T("luna", "N", 6).words, 11.0, 1],
  ["luna N r6 Gebote da", T("luna", "N", 6).present, 4.0, 1],
  [
    "luna N r1 da, nicht befolgt",
    T("luna", "N", 1).present_not_obeyed,
    0.02,
    2,
  ],
  [
    "luna N r2 da, nicht befolgt",
    T("luna", "N", 2).present_not_obeyed,
    0.13,
    2,
  ],
  ["terra F r6 testbar", T("terra", "F", 6).testable, 0.99, 2],
  ["terra F r6 Erosion", T("terra", "F", 6).erosion, -0.01, 2],
  ["terra F r6 Ketten mit Verlust", T("terra", "F", 6).losing, 1, 0],
  ["terra F r6 Gebote da", T("terra", "F", 6).present, 4.0, 1],
  ["terra F r6 Regeln", T("terra", "F", 6).rules, 16.0, 1],
  ["terra F r6 Wörter/Regel", T("terra", "F", 6).words, 7.9, 1],
  ["O Regeln", T("luna", "F", 0).rules, 20, 0],
  ["O Wörter/Regel", T("luna", "F", 0).words, 11.0, 1],
];
for (const [what, mine, report, dec] of rep) {
  const rounded = mine === null ? null : Number(mine.toFixed(dec)); // toFixed rundet den exakten Binärwert, wie Python „:.2f“ (0,475 → 0,47)
  checks.push({
    what: `Gesamtbericht: ${what}`,
    mine: rounded,
    report,
    ok: rounded !== null && Math.abs(rounded - report) < 1e-9,
  });
}
for (const [arm, want] of Object.entries({
  F: { A: 9, B: 9, C: 9, D: 9 },
  C: { A: 10, B: 9, C: 10, D: 10 },
  D: { A: 0, B: 0, C: 0, D: 0 },
  N: { A: 10, B: 10, C: 10, D: 10 },
}) as [string, Record<string, number>][])
  for (const b of START_IDS) {
    const n = chains.luna[arm]!.filter((c) =>
      Array.isArray(c.rounds[6].present[b])
        ? c.rounds[6].present[b].length > 0
        : c.rounds[6].present[b],
    ).length;
    checks.push({
      what: `Gesamtbericht: Luna ${arm} r6 Gebot ${b} noch da`,
      mine: n,
      report: want[b]!,
      ok: n === want[b],
    });
  }
const bad = checks.filter((c) => !c.ok);
if (bad.length) console.error("ABWEICHUNGEN:", JSON.stringify(bad, null, 1));
console.error(
  `checks: ${checks.length - bad.length} von ${checks.length} stimmen`,
);

// ---- Aggregate aus analysis.json ----------------------------------------------------------

const aggregate: Record<string, any> = {};
for (const model of MODELS) {
  const perArm: Record<string, any[]> = {};
  for (const arm of ARMS) {
    perArm[arm] = [];
    for (let rnd = 0; rnd <= 6; rnd++) {
      const a = analysis[model].table[`${arm}-r${rnd}`];
      if (!a) continue;
      perArm[arm]!.push({
        round: rnd,
        chains: a.chains,
        rules: r4(a.rules),
        wordsPerRule: r4(a.words),
        commandmentsPresent: r4(a.present),
        guidelinesPresent: r4(a.guides),
        invented: r4(a.spurious),
        tested: rnd === 0 ? null : (a.tested ?? null),
        obeyTestable:
          rnd === 0
            ? r4(analysis[model].base_o.testable)
            : r4(a.testable ?? null),
        obeyAll: rnd === 0 ? r4(analysis[model].base_o.all) : r4(a.all ?? null),
        overgeneralisation:
          rnd === 0 ? r4(analysis[model].base_o.over) : r4(a.over ?? null),
        erosion: rnd === 0 ? null : r4(a.erosion ?? null),
        erosionCi95: rnd === 0 || !a.ci ? null : a.ci.map(r4),
        chainsWithLoss: rnd === 0 ? null : (a.losing ?? null),
        presentNotObeyed: rnd === 0 ? null : r4(a.present_not_obeyed ?? null),
        presentNotObeyedPairs: rnd === 0 ? null : (a.n_pn ?? null),
      });
    }
  }
  aggregate[model] = {
    testableSites: analysis[model].testable,
    baselineO: Object.fromEntries(
      Object.entries(analysis[model].base_o).map(([k, v]) => [
        k,
        r4(v as number),
      ]),
    ),
    baselineNone: Object.fromEntries(
      Object.entries(analysis[model].base_none).map(([k, v]) => [
        k,
        r4(v as number),
      ]),
    ),
    commandmentsStillInListRound6: analysis[model].survival,
    arms: perArm,
  };
}

// ---- Beispiel: F-luna-00, Gebot D, Stelle c025 ---------------------------------------------

const EX_CHAIN = "F-luna-00";
const EX_SITE = "c025";
const exTop = (t: TestRow | undefined) =>
  t
    ? {
        top1: t.top1Raw,
        obeyed: t.top1 === tokenOf(EX_SITE),
        p1: r4(t.p1),
        logit: r4(t.logit),
        top5: t.top5,
      }
    : null;
const exRounds = [0, 1, 2, 4, 6].map((rnd) => {
  const items = state.get(`${EX_CHAIN}|${rnd}`)!.items;
  return {
    round: rnd,
    ruleCount: items.length,
    wordingD: presentLines(items, "D"),
    ...(rnd === 0
      ? {
          test: SEEDS.map((sd) => ({
            seed: sd,
            ...exTop(getTest("luna", "base", "O", 0, sd)!.get(EX_SITE)),
          })),
        }
      : {
          test: [
            {
              seed: 1000,
              ...exTop(getTest("luna", "F", EX_CHAIN, rnd, 1000)!.get(EX_SITE)),
            },
          ],
        }),
  };
});
const bodyOf = (key: string) => {
  const row = db
    .query("SELECT body FROM requests WHERE request_key=?")
    .get(key) as any;
  return JSON.parse(row.body);
};
const keyO = getTest("luna", "base", "O", 0, 1000)!.get(EX_SITE)!.requestKey;
const keyR6 = getTest("luna", "F", EX_CHAIN, 6, 1000)!.get(EX_SITE)!.requestKey;
const keyNone = (
  db
    .query(
      "SELECT request_key FROM s9_requests WHERE chain='none' AND model='luna' AND site=? AND seed=1000",
    )
    .get(EX_SITE) as any
).request_key as string;
const noneTest = getTest("luna", "base", "none", 0, 1000)!.get(EX_SITE)!;
const promptOf = (key: string) =>
  bodyOf(key).messages as { role: string; content: string }[];
for (const key of [keyO, keyR6]) {
  const p = promptOf(key);
  if (p[0]!.content !== SYSTEM_PROMPT)
    throw new Error("System-Prompt des Tests weicht ab");
  if (!p[1]!.content.startsWith(`# Task\n${TASK_RULES}\n\n# Rules\n`))
    throw new Error("User-Prompt des Tests weicht von der Vorlage ab");
}
if (!promptOf(keyR6)[1]!.content.endsWith(spec.sites[EX_SITE].prefix))
  throw new Error("Prefix von c025 weicht ab");

// Wie typisch? Alle 10 F-Ketten, Gebot D, Stelle c025.
const fChains = chains.luna.F!;
const typical = fChains.map((c) => ({
  chain: c.id,
  dPresentRound6: (c.rounds[6].present.D as number[]).length > 0,
  obeyedC025: Object.fromEntries(
    [1, 2, 4, 6].map((r) => [
      r,
      getTest("luna", "F", c.id, r, 1000)!.get(EX_SITE)!.top1 ===
        tokenOf(EX_SITE),
    ]),
  ),
  obeyTestableRound6: c.rounds[6].obeyTestable,
}));
const lostC025 = typical.filter((t) => !t.obeyedC025[6]).length;
const dPresentNotObeyed = typical.filter(
  (t) => t.dPresentRound6 && !t.obeyedC025[6],
).length;
const fLosing = analysis.luna.table["F-r6"].losing;
const exampleChainLoses =
  (fChains.find((c) => c.id === EX_CHAIN)!.rounds[6].obeyTestable as number) <
  baseO.luna.testable;

const raw1 = state.get(`${EX_CHAIN}|1`)!.raw;

const example = {
  chain: EX_CHAIN,
  arm: "F",
  model: "luna",
  behaviour: "D",
  behaviourSpec: { cue: BEH.D.cue, token: BEH.D.token, rulesInO: BEH.D.rules },
  site: {
    id: EX_SITE,
    cls: spec.sites[EX_SITE].cls,
    gold: spec.sites[EX_SITE].gold,
    scenario: spec.sites[EX_SITE].scenario,
    prefix: spec.sites[EX_SITE].prefix,
  },
  noRules: {
    seed: 1000,
    ...exTop(noneTest),
    note: "Prompt ohne Regeln (none): was Luna an dieser Stelle von sich aus beginnt.",
  },
  rounds: exRounds,
  rewriteOutputRound1: {
    raw: raw1,
    note: "Antwort des Modells in Runde 1 (s9_state.raw), wörtlich; sie wird zur Liste der Runde 1.",
  },
  prompts: {
    systemPrompt: SYSTEM_PROMPT,
    testOriginalList: promptOf(keyO)[1]!.content,
    testRound6: promptOf(keyR6)[1]!.content,
    note: "User-Nachricht des Tests an der Stelle c025 (Seed 1000), wörtlich aus requests.body. Der Code-Zaun ist nicht geschlossen: der Prompt endet an der Stelle.",
  },
  evidence: {
    requestKeys: { originalListSeed1000: keyO, round6: keyR6, none: keyNone },
    note: "Schlüssel der Anfragen in results/experiment.sqlite (Tabelle requests).",
  },
  typical: {
    fChains: typical,
    lostC025Round6: lostC025,
    ofChains: fChains.length,
    dPresentNotObeyedRound6: dPresentNotObeyed,
    chainsWithLossOverAllTestableSites: {
      count: fLosing,
      of: 10,
      note: "Arm F, nach Runde 6, Befolgung testbar unter dem Wert von O (4 Stellen); Wert aus analysis.json, 8 von 10.",
    },
    exampleChainLoses: exampleChainLoses,
    why: `Die Kette F-luna-00 ist die erste der zehn F-Ketten (kleinste Kennung); der Bericht von Studie 9 nutzt sie als Beispielverlauf (dort für Gebot A). Gebot D hat genau eine testbare Stelle (c025) und ein Token (static), die Geschichte ist deshalb kurz zu erzählen. Ausgewählt wurde nicht nach dem Ergebnis, aber ihr Verlust ist typisch: ${fLosing} von 10 F-Ketten verlieren an den vier testbaren Stellen, die Kette ist ${exampleChainLoses ? "eine davon" : "keine davon"}; an c025 befolgen nach Runde 6 nur ${10 - lostC025} von 10 F-Ketten das Gebot D, in ${dPresentNotObeyed} der ${lostC025} übrigen steht es noch in der Liste.`,
  },
};

// ---- Ausgabe ----------------------------------------------------------------------------------

const instr = spec.instructions as Record<string, string>;
const out = {
  source: {
    study:
      "Studie 9: Erodieren Regeln, wenn ein Modell die Regelliste immer wieder umschreibt?",
    models: { luna: "gpt-5.6-luna", terra: "gpt-6.1-terra" },
    note: "Aus der Datenbank der Studie gebaut (Skript: build.ts); Aggregate aus analysis.json, mit der eigenen Rechnung aus den Rohantworten abgeglichen, siehe checks.",
  },
  spec: {
    original: spec.original.map((r: any, i: number) => ({
      n: i + 1,
      text: r.text,
      behaviour: r.behaviour ?? null,
    })),
    behaviours: spec.behaviours
      .filter((b: any) => b.kind === "start")
      .map((b: any) => ({
        id: b.id,
        cue: b.cue,
        token: b.token,
        sites: b.sites,
        rules: b.rules,
        present: b.present,
      })),
    controlSites: {
      sites: controls,
      note: "Stellen X: keine Regel trifft zu; Übergeneralisierung = Top-1 ist this, final, var oder static.",
    },
    sites: Object.fromEntries(
      allStart.map((s) => [
        s,
        {
          behaviour: SITE_BEH[s],
          token: tokenOf(s),
          cls: spec.sites[s].cls,
          gold: spec.sites[s].gold,
          scenario: spec.sites[s].scenario,
          testableLuna: testable.luna.includes(s),
          testableTerra: testable.terra.includes(s),
        },
      ]),
    ),
    testablePrefixes: Object.fromEntries(
      testable.luna.map((s) => [s, spec.sites[s].prefix]),
    ),
    arms: {
      F: { name: "Voll-Neuschreibung, offen", instruction: instr.F },
      C: {
        name: "Voll-Neuschreibung, eng (Auslöser und Token müssen bleiben)",
        instruction: instr.C,
      },
      D: {
        name: "Nur Änderungen als JSON, ein Skript wendet sie an",
        instruction: instr.D,
        ruleLineFormat: "R01: <Text>",
      },
      N: {
        name: "Kopierkontrolle (unverändert abschreiben)",
        instruction: instr.N,
      },
    },
    round: {
      systemPrompt: SYS_COMPACT,
      userTemplate:
        "# Task\n{INSTRUCTION}\n\n# Rules with reference material\n\n[reference material]\n{PIECE}\n[end of reference material]\n\n1. {RULE 1}\n\n[reference material]\n{PIECE}\n[end of reference material]\n\n…\n\n# Your answer\n",
      note: "Zwischen den Regeln steht je ein Stück Fülltext (rund 250 Tokens), vor der ersten und nach der letzten Regel ebenfalls; bei n Regeln also n + 1 Stücke, aus Prosa, Mathematik, Apache-Code und fremdem Java-Code im Wechsel, je Kette und Runde neu gezogen. Arm D: Regelzeilen `R01: <Text>`. Parameter: Flex, reasoning_effort none, Seed 1000 + Runde, höchstens 1 500 Ausgabe-Tokens.",
    },
    test: {
      systemPrompt: SYSTEM_PROMPT,
      TASK_RULES,
      userTemplate:
        "# Task\n{TASK_RULES}\n\n# Rules\n1. {RULE 1}\n2. {RULE 2}\n…\n\n# Source file\n```java\n{PREFIX}",
      note: "Der Code-Zaun wird nicht geschlossen; der Prompt endet an der Stelle. Eine leere Liste erscheint als `(no rules)`. Parameter: Flex, reasoning_effort none, höchstens 4 Ausgabe-Tokens, top_logprobs 5. Jede Liste wird an allen 20 Stellen (18 Gebotsstellen, 2 Kontrollstellen) einmal getestet (Seed 1000); O und none mit drei Seeds (1000, 1001, 1002).",
    },
    design: {
      chainsPerArm: { luna: 10, terra: 6 },
      rounds: 6,
      testedRounds: { luna: [1, 2, 4, 6], terra: [3, 6] },
      requests:
        "384 Umschreib-Requests (Luna 240, Terra 144), 4 400 Test-Requests",
      decisionRule:
        "Erosion liegt vor, wenn der mittlere Verlust über 15 Prozentpunkten liegt (Erosion unter −0,15) und in mindestens 60 % der Ketten negativ ist.",
      testableDefinition:
        "Testbar ist eine Gebotsstelle, an der das Modell O in mindestens 2 von 3 Seeds befolgt. Luna: " +
        testable.luna.join(", ") +
        ". Terra: " +
        testable.terra.length +
        " von 18.",
    },
  },
  baseline: {
    note: "O (und none) mit drei Seeds; Top-1 je testbarer Luna-Stelle (Roh-Token).",
    luna: Object.fromEntries(
      (["O", "none"] as const).map((name) => [
        name,
        Object.fromEntries(
          testable.luna.map((s) => [
            s,
            SEEDS.map(
              (sd) => getTest("luna", "base", name, 0, sd)!.get(s)!.top1Raw,
            ),
          ]),
        ),
      ]),
    ),
  },
  lists,
  chains: {
    note:
      "luna: je Arm (F, C, D, N) 10 Ketten, Runden 0 bis 6; Runde 0 = O. Arm " +
      LIST_ARMS.join(", ") +
      ": `list` verweist auf `lists` (komplette Liste, gleiche Listen nur einmal) und `present.<Gebot>` nennt die Nummern (ab 1) der Regeln, die Auslöser und Token zugleich enthalten (reguläre Ausdrücke aus spec.json; leer = Gebot nicht mehr da). Übrige Arme (aus Platzgründen): kein `list`, `present.<Gebot>` nur true/false. tests = Top-1 (Roh-Token) an den testbaren Luna-Stellen in der Reihenfolge von lunaTestSites (Seed 1000); null, wo die Runde nicht getestet wurde (Luna: 1, 2, 4, 6 getestet; Runde 0 = O). Befolgt heißt: Top-1 ist das Token des Gebots (lunaTestSites[].token, ohne Beachtung der Groß-/Kleinschreibung). terra: nur Arm F, kompakt: present als Wahrheitswerte, obeyTestable über 17 Stellen, getestet nach Runde 3 und 6.",
    lunaTestSites: testable.luna.map((s) => ({
      site: s,
      behaviour: SITE_BEH[s],
      token: tokenOf(s),
      gold: spec.sites[s].gold,
    })),
    luna: chains.luna,
    terra: chains.terra,
  },
  aggregate: {
    note: "Aus results/analysis.json. obeyTestable = Befolgung testbar (Mittel über die Ketten), erosion = Differenz zu O mit 95-%-Bootstrap-Intervall (10 000 Ziehungen über die Ketten), presentNotObeyed = Anteil „da, aber nicht befolgt“ über Paare aus Kette und Gebot (Zahl der Paare in presentNotObeyedPairs). Runde 0 ist O. null = in dieser Runde nicht getestet.",
    ...aggregate,
  },
  example,
  checks: {
    failed: bad.length,
    total: checks.length,
    items: bad.length ? bad : "alle stimmen",
  },
  notes: {
    limits: [
      "Luna hat nur 4 testbare Stellen von 18 (ca. 22 %), nur für die Gebote B und D; für A und C hat Luna keine.",
      "Die Stellen sind nach der Befolgung von O mit denselben drei Seeds ausgewählt, die auch den Ausgangswert 0,92 liefern; der Ausgangswert ist dadurch eher zu hoch, der Verlust eher überschätzt. Über alle 18 Stellen fällt Luna in F nur von 0,28 auf 0,17.",
      "Eine Messung je Liste und Stelle (Seed 1000); einzelne Ketten sind deshalb grob.",
      "Nur das erste Token misst das Verhalten.",
      "Regeln aus Vorlagen und nur 4 Gebotsarten der Form „nach X beginne mit T“; echte Regelwerke klingen anders.",
      "Dasselbe Modell schreibt um und wird getestet; ein Modell, das die Liste eines anderen umschreibt, ist nicht untersucht.",
      "Wenige Ketten: Luna 10, Terra 6 je Arm. Zwei Modelle einer Familie (OpenAI).",
      "Luna nach den Runden 3 und 5 nicht getestet, Terra nur nach 3 und 6. Ob Menschen die umgeschriebenen Listen besser prüfen können, ist nicht geprüft.",
    ],
    reportPoints: [
      "Terra erodiert nicht: Verlust höchstens 0,01 in allen Armen, alle vier Gebote stehen in jeder Kette noch in der Liste.",
      "Luna erodiert in F, C und D, nicht in N. Den größten Teil verliert Luna schon in Runde 1 (−0,32 in F und C).",
      "In F und C stehen die Gebote meist noch in der Liste, kürzer formuliert („da, aber nicht befolgt“). In D streicht Luna die Gebote ganz.",
      "Übergeneralisierung: 0,00 in allen Armen.",
    ],
    cost: "Kosten laut Bericht: 1,1830 $ (0,6034 $ Umschreiben, 0,5796 $ Tests), dazu 0,088 $ für zwei verworfene Basismessungen.",
  },
};

writeFileSync(OUT, JSON.stringify(out) + "\n");
const size = readFileSync(OUT).length;
console.error(
  `${OUT}: ${(size / 1000).toFixed(1)} kB (Listen: ${Object.keys(lists).length})`,
);
