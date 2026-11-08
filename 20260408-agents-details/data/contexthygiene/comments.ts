#!/usr/bin/env bun
//
// Hängt die für die Folie geschriebenen Kommentare an `study3.json`.
//
// Die Studie kennt Kommentare nur für S0/D0 (`S0k`). Auf der Folie bekommen die
// Zuschauer aber wenig Zeit zum Lesen und müssen dem Ablauf schnell folgen. Darum
// gibt es zusätzlich
//   - je Fachgebiet eine Kopfzeile, die fachlich sagt, wofür die Datei da ist
//     (`scenario.header`, steht über jeder Stufe), und
//   - Kommentare für S1–S6 (`levels[Sx].comments`), sinngemäß die von S0 und dort,
//     wo die Struktur sich geändert hat, neu gesetzt.
// Nichts davon wurde gemessen. Live gesendet wird weiterhin nur `scenario.comments`.
//
// Quelle: `comments/<fachgebiet>.json`
//   { "header": "…",
//     "levels": { "S1": [ { "before": "final class Price {", "text": "…" }, … ], … } }
// `before` ist der Text der Codezeile (ohne Einrückung), über der der Kommentar steht.
// Kommt die Zeile mehrfach vor, wählt `nth` (ab 1) das Vorkommen.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/contexthygiene/comments.ts          # study3.json aktualisieren
//   bun run 20260408-agents-details/data/contexthygiene/comments.ts --check  # nur prüfen
//   … --check --only warehouse                                                 # nur ein Fachgebiet prüfen
//
// `build.ts` ruft dieselbe Funktion nach dem Einlesen der Studie auf.

import { readFileSync, writeFileSync } from "node:fs";

export interface CommentBlock {
  beforeLine: number;
  lines: string[];
}
export interface AuthoredTarget {
  levels: Record<string, { code: string; comments?: CommentBlock[] }>;
  comments: CommentBlock[];
  header?: string;
}
interface AuthoredBlock {
  before: string;
  nth?: number;
  text: string;
}
interface AuthoredFile {
  header: string;
  levels: Record<string, AuthoredBlock[]>;
}

export const AUTHORED_LEVELS = ["S1", "S2", "S3", "S4", "S5", "S6"];
/** Länger liest niemand auf der Folie. */
export const MAX_HEADER = 200;
export const MAX_TEXT = 150;
/** Anteil der S0-Kommentare, den jede Stufe mindestens erreicht. */
const MIN_SHARE = 0.7;

export function applyAuthored(
  scenarios: Record<string, AuthoredTarget>,
  dir: URL,
): void {
  const problems: string[] = [];
  for (const [name, sc] of Object.entries(scenarios)) {
    const file = new URL(`./${name}.json`, dir);
    let authored: AuthoredFile;
    try {
      authored = JSON.parse(readFileSync(file, "utf8")) as AuthoredFile;
    } catch (e) {
      problems.push(`${name}: ${file.pathname} nicht lesbar (${String(e)})`);
      continue;
    }
    const where = (level: string, i?: number) =>
      `${name}/${level}${i === undefined ? "" : `#${i + 1}`}`;

    if (!authored.header?.trim()) problems.push(`${name}: header fehlt`);
    else if (authored.header.length > MAX_HEADER)
      problems.push(
        `${name}: header hat ${authored.header.length} Zeichen (max. ${MAX_HEADER})`,
      );
    sc.header = authored.header;

    for (const level of Object.keys(authored.levels ?? {})) {
      if (!AUTHORED_LEVELS.includes(level))
        problems.push(`${name}: unbekannte Stufe ${level}`);
    }
    for (const level of AUTHORED_LEVELS) {
      const blocks = authored.levels?.[level];
      const target = sc.levels[level];
      if (!blocks || !target) {
        problems.push(`${where(level)}: Kommentare fehlen`);
        continue;
      }
      const need = Math.ceil(sc.comments.length * MIN_SHARE);
      if (blocks.length < need)
        problems.push(
          `${where(level)}: ${blocks.length} Kommentare, mindestens ${need} (70 % der ${sc.comments.length} von S0)`,
        );
      const lines = target.code.split("\n");
      const used = new Map<number, number>();
      const out: CommentBlock[] = [];
      blocks.forEach((b, i) => {
        if (!b.text?.trim() || /\n/.test(b.text)) {
          problems.push(`${where(level, i)}: text leer oder mehrzeilig`);
          return;
        }
        if (b.text.length > MAX_TEXT)
          problems.push(
            `${where(level, i)}: text hat ${b.text.length} Zeichen (max. ${MAX_TEXT})`,
          );
        const hits = lines
          .map((l, idx) => (l.trim() === b.before.trim() ? idx : -1))
          .filter((idx) => idx >= 0);
        const nth = b.nth ?? 1;
        if (hits.length === 0) {
          problems.push(
            `${where(level, i)}: Zeile nicht gefunden: ${b.before}`,
          );
          return;
        }
        if (hits.length > 1 && b.nth === undefined) {
          problems.push(
            `${where(level, i)}: Zeile kommt ${hits.length}× vor, nth angeben: ${b.before}`,
          );
          return;
        }
        const at = hits[nth - 1];
        if (at === undefined) {
          problems.push(
            `${where(level, i)}: nth=${nth}, aber nur ${hits.length} Treffer: ${b.before}`,
          );
          return;
        }
        if (used.has(at)) {
          problems.push(
            `${where(level, i)}: Zeile ${at} hat schon Kommentar #${used.get(at)! + 1}`,
          );
          return;
        }
        used.set(at, i);
        const indent = /^\s*/.exec(lines[at]!)![0];
        out.push({ beforeLine: at, lines: [`${indent}// ${b.text.trim()}`] });
      });
      out.sort((a, b) => a.beforeLine - b.beforeLine);
      target.comments = out;
    }
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`${problems.length} Problem(e) in den Kommentardateien`);
    process.exit(1);
  }
}

if (import.meta.main) {
  const study = new URL("./study3.json", import.meta.url);
  const data = JSON.parse(readFileSync(study, "utf8")) as {
    scenarios: Record<string, AuthoredTarget>;
  };
  const only = process.argv.includes("--only")
    ? process.argv[process.argv.indexOf("--only") + 1]
    : undefined;
  if (only && !data.scenarios[only]) {
    console.error(`Fachgebiet ${only} gibt es nicht`);
    process.exit(1);
  }
  const scenarios = only ? { [only]: data.scenarios[only]! } : data.scenarios;
  applyAuthored(scenarios, new URL("./comments/", import.meta.url));
  if (process.argv.includes("--check")) {
    console.error("Kommentardateien in Ordnung");
  } else {
    writeFileSync(study, JSON.stringify(data));
    console.error(`study3.json aktualisiert (${study.pathname})`);
  }
}
