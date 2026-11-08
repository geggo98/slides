#!/usr/bin/env bun
//
// Zieht aus `viz/index.html` von Studie 3 („Logprob-Leitern“) die Daten für die
// Folie `kontext-hygiene` (`components/ContextHygiene.vue`) und schreibt sie
// schlank nach `study3.json`.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/contexthygiene/build.ts <pfad>/viz/index.html
//
// Der Pfad wird bewusst übergeben und nicht im Skript fest verdrahtet: die
// Studie liegt außerhalb dieses Repos.
//
// Was übernommen wird
// -------------------
// - je Fachgebiet die Stufen D0–D4 (Dosis-Leiter, nur Namen) und S0–S6
//   (Stufen-Leiter, gemischte Mängel) mit Code, Messstellen und den rohen
//   Top-5-Tokens je Modell (`m.<modell>.top` = [Token, Logprob]).
// - `comments`: die Kommentarzeilen der Ansicht „S0 + Kommentare“ (`S0k`,
//   gleich `D0k`). Jeder Block steht VOR einer Codezeile (`beforeLine`, 0-basiert,
//   gezählt im Code ohne Kommentare). Nicht Teil der Studie, nie gemessen.
// - `header` und `levels[S1–S6].comments`: für die Folie geschrieben, siehe `comments.ts`.
//
// Was geprüft wird (das Skript bricht sonst ab)
// ---------------------------------------------
// - Ohne Kommentarzeilen ergibt `S0k` exakt `S0`, so wie `check_commented.py`
//   der Studie es verlangt.
// - D0–D4 haben je Gebiet dieselbe Zeilenzahl wie D0, denn die Kommentare
//   werden an Zeilennummern von D0 gehängt und gelten für alle D-Stufen.
// - Jedes Gebiet hat Stufen, Messstellen und Messwerte für alle drei Modelle.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { applyAuthored, type AuthoredTarget } from "./comments.ts";

type Model = "luna" | "sol" | "terra";
const MODELS: Model[] = ["luna", "sol", "terra"];

interface RawMeasure {
  top: [string, number][];
  p1: number | null;
  hit: boolean;
}
interface RawSite {
  id: string;
  pos: number;
  cls: string;
  gold: string;
  stratum: string | null;
  m: Record<Model, RawMeasure | null>;
}
interface RawEntry {
  scenario: string;
  ladder: "steps" | "dose";
  variant: string;
  code: string;
  sites: RawSite[];
  commented?: boolean;
}
interface RawData {
  entries: RawEntry[];
  summaries: Record<string, string>;
  routes: Record<Model, string>;
  system: string;
  p_max: number;
}

// matches comment-only lines: "    // text", "/** Doc", " * more", " */"
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*\/|\*)/;
const DEV = new Set(["parking", "payroll", "warehouse"]);
const KEEP = [
  "D0",
  "D1",
  "D2",
  "D3",
  "D4",
  "S0",
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function extractData(html: string): RawData {
  const marker = "const DATA = ";
  const from = html.indexOf(marker);
  const to = html.indexOf(";\nconst BASE", from);
  if (from < 0 || to < 0) fail("DATA-Block in index.html nicht gefunden");
  return JSON.parse(html.slice(from + marker.length, to)) as RawData;
}

interface CommentBlock {
  beforeLine: number;
  lines: string[];
}

/** Kommentarblöcke von `commented`, bezogen auf den Code ohne Kommentarzeilen. */
function commentBlocks(
  scenario: string,
  commented: string,
  base: string,
): CommentBlock[] {
  const blocks: CommentBlock[] = [];
  const code: string[] = [];
  let open: string[] = [];
  for (const line of commented.split("\n")) {
    if (COMMENT_LINE.test(line)) {
      open.push(line);
      continue;
    }
    if (open.length) blocks.push({ beforeLine: code.length, lines: open });
    open = [];
    code.push(line);
  }
  if (open.length) blocks.push({ beforeLine: code.length, lines: open });
  if (code.join("\n") !== base) {
    fail(`${scenario}: S0k ohne Kommentarzeilen ist nicht gleich S0`);
  }
  return blocks;
}

const lineCount = (code: string): number => code.split("\n").length;

function main(): void {
  const path = process.argv[2];
  if (!path) fail("usage: build.ts <pfad>/viz/index.html");
  const raw = readFileSync(path);
  const data = extractData(raw.toString("utf8"));
  const find = (scenario: string, variant: string): RawEntry => {
    const e = data.entries.find(
      (x) => x.scenario === scenario && x.variant === variant,
    );
    if (!e) fail(`${scenario}/${variant} fehlt`);
    return e;
  };

  const scenarios = [...new Set(data.entries.map((e) => e.scenario))].sort();
  const out: Record<string, unknown> = {};
  let siteCount = 0;
  for (const scenario of scenarios) {
    const s0 = find(scenario, "S0");
    const d0 = find(scenario, "D0");
    if (s0.code !== d0.code) fail(`${scenario}: D0 weicht von S0 ab`);
    const comments = commentBlocks(
      scenario,
      find(scenario, "S0k").code,
      s0.code,
    );
    const levels: Record<string, unknown> = {};
    for (const variant of KEEP) {
      const e = find(scenario, variant);
      if (variant.startsWith("D") && lineCount(e.code) !== lineCount(d0.code)) {
        fail(`${scenario}/${variant}: Zeilenzahl weicht von D0 ab`);
      }
      levels[variant] = {
        code: e.code,
        sites: e.sites.map((s) => {
          siteCount += 1;
          for (const m of MODELS) {
            if (!s.m[m])
              fail(`${scenario}/${variant}/${s.id}: Messwert ${m} fehlt`);
          }
          return {
            id: s.id,
            pos: s.pos,
            cls: s.cls,
            gold: s.gold,
            stratum: s.stratum,
            m: Object.fromEntries(
              MODELS.map((m) => {
                const r = s.m[m]!;
                return [m, { top: r.top, p1: r.p1, hit: r.hit }];
              }),
            ),
          };
        }),
      };
    }
    out[scenario] = {
      dev: DEV.has(scenario),
      summary: data.summaries[scenario],
      comments,
      levels,
    };
  }

  applyAuthored(
    out as Record<string, AuthoredTarget>,
    new URL("./comments/", import.meta.url),
  );

  const result = {
    source: "study3/viz/index.html",
    source_sha256: createHash("sha256").update(raw).digest("hex"),
    retrieved: new Date().toISOString().slice(0, 10),
    system: data.system,
    p_max: data.p_max,
    routes: data.routes,
    scenarios: out,
  };
  const target = new URL("./study3.json", import.meta.url);
  writeFileSync(target, JSON.stringify(result));
  console.error(
    `${scenarios.length} Gebiete, ${siteCount} Stellen -> ${target.pathname}`,
  );
}

main();
