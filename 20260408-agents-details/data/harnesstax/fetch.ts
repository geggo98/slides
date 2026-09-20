#!/usr/bin/env bun
//
// Archiviert die HarnessTax-Rohdaten (harnesstax.github.io), die
// `harnessTaxData.ts` in Folienzahlen übersetzt.
//
// Warum es das gibt
// ------------------
// Dasselbe Argument wie bei `data/deepswe/fetch.ts`: Zahlen, die nur einmal
// von Hand abgetippt wurden, driften unbemerkt vom Original weg. Hier kommt
// dazu, dass die Website selbst eine SPA ist — `index.html` liefert nur ein
// Lade-Icon, der Text und die Charts stecken in nachgeladenem JSON. Wer die
// Seite mit einem simplen HTML-Fetch liest, bekommt nichts.
//
// Abrufkette (verifiziert 18.09.2026, Bun 1.x + native fetch)
// -------------------------------------------------------------
//   1. index.html            -> window.__AB_BOOT__ (Dateinamen mit Content-Hash)
//   2. blog.json              -> Liste der Blogposts, hier genau einer
//   3. data/blog/<slug>.<hash>.json  -> { html }, die Prosa des Posts
//   4. data/charts/<name>.<hash>.json -> je ein Chart, siehe CHARTS unten
//
// Die Hashes im Dateinamen ändern sich bei jeder inhaltlichen Änderung — der
// Code liest sie deshalb aus `__AB_BOOT__` statt sie hier zu hardcoden. Ändert
// die Studie ihre Zahlen, meldet `harnessTaxData.test.ts` das über die dann
// nicht mehr passenden archivierten Werte, nicht dieses Skript.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/harnesstax/fetch.ts
//
// Schreibt (überschreibt) im selben Verzeichnis:
//   post.json               — { html, generated, source_url }
//   frontier-swe.json        — 21 Punkte + Tabelle, SWE-bench Lite
//   frontier-tb.json         — dito, Terminal-Bench 2.0
//   agent-context-swe.json  — Erstkontext-Statistik je Harness
//
// Bewusst NICHT archiviert: die beiden cumulative-accrual-Charts (zusammen
// >800 KB, fast nur Zwischenwerte der Kurvenglättung aus Figure 2). Ihre
// Tabellenzeilen (Steps/Tokens je Paar) zieht `--steps` heraus und schreibt sie
// kompakt nach steps-swe.json / steps-tb.json — das ist alles, was
// `harnessTaxData.ts` daraus braucht.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://harnesstax.github.io/";
const OUT = new URL(".", import.meta.url).pathname;

interface Boot {
  charts: Record<string, string>;
  generated: string;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, SITE));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

function readBoot(html: string): Boot {
  // window.__AB_BOOT__ = {...};  — ein einzeiliges JSON-Objektliteral, echtes
  // JSON (anders als das DeepSWE-Board gibt es hier keine JS-Objektliterale
  // mit unquotierten Schlüsseln, siehe data/deepswe/fetch.ts Punkt 3).
  const m = html.match(/window\.__AB_BOOT__\s*=\s*(\{.*?\});/s);
  if (!m)
    throw new Error(
      "__AB_BOOT__ nicht gefunden — hat sich index.html geändert?",
    );
  return JSON.parse(m[1]!) as Boot;
}

interface TableRow {
  [i: number]: unknown;
}
interface ChartTable {
  columns: string[];
  rows: TableRow[];
}
interface ChartFile {
  table?: ChartTable;
  [k: string]: unknown;
}

/** Zieht aus einem cumulative-accrual-Chart nur die Tabellenzeilen der
 * gewünschten `view`-Spalte (Steps oder Tokens) — der Rest ist Kurven-
 * Zwischenwerte, die kein Slide braucht. */
function extractSteps(chart: ChartFile, view: "Steps" | "Tokens") {
  const t = chart.table;
  if (!t) throw new Error("Chart hat keine table.rows");
  const viewIdx = t.columns.indexOf("view");
  const sysIdx = t.columns.indexOf("system");
  const fpIdx = t.columns.indexOf("fixed-point resource/rollout");
  const finIdx = t.columns.indexOf("final success");
  if ([viewIdx, sysIdx, fpIdx, finIdx].some((i) => i < 0)) {
    throw new Error("Spalten der Tabelle haben sich geändert");
  }
  return t.rows
    .filter((r) => r[viewIdx] === view)
    .map((r) => ({ system: r[sysIdx], value: r[fpIdx], success: r[finIdx] }));
}

async function main() {
  const wantSteps = process.argv.includes("--steps");

  const html = await (await fetch(SITE)).text();
  const boot = readBoot(html);
  console.log(`__AB_BOOT__ generated: ${boot.generated}`);

  const blog = await getJSON<{
    posts: { slug: string; path: string }[];
  }>("blog.json");
  const post = blog.posts[0];
  if (!post) throw new Error("blog.json hat keine posts[]");
  const postData = await getJSON<{ html: string }>(post.path);
  writeFileSync(
    join(OUT, "post.json"),
    JSON.stringify(
      { source_url: SITE + post.path, generated: boot.generated, ...postData },
      null,
      2,
    ),
  );
  console.log(`post.json geschrieben (${postData.html.length} Zeichen HTML)`);

  const WANTED: Record<string, string> = {
    "system-frontier-swe": "frontier-swe.json",
    "system-frontier-tb": "frontier-tb.json",
    "system-agent-context-swe": "agent-context-swe.json",
  };
  for (const [key, file] of Object.entries(WANTED)) {
    const path = boot.charts[key];
    if (!path) throw new Error(`Chart „${key}“ fehlt in __AB_BOOT__`);
    const data = await getJSON<ChartFile>(path);
    // `plotly`-Layout ist reine Darstellungskonfiguration (Achsenfarben,
    // Ränder) — jede hier gebrauchte Zahl steht in `table`/`frontier`/`context`.
    delete data.plotly;
    writeFileSync(
      join(OUT, file),
      JSON.stringify(
        { source_url: SITE + path, generated: boot.generated, ...data },
        null,
        2,
      ),
    );
    console.log(`${file} geschrieben`);
  }

  if (wantSteps) {
    for (const [bench, key] of [
      ["swe", "system-cumulative-accrual-swe"],
      ["tb", "system-cumulative-accrual-tb"],
    ] as const) {
      const path = boot.charts[key];
      if (!path) throw new Error(`Chart „${key}“ fehlt in __AB_BOOT__`);
      const data = await getJSON<ChartFile>(path);
      const steps = extractSteps(data, "Steps");
      const tokens = extractSteps(data, "Tokens");
      writeFileSync(
        join(OUT, `steps-${bench}.json`),
        JSON.stringify(
          {
            source_url: SITE + path,
            generated: boot.generated,
            note: "Extrahiert aus table.rows (view=Steps/Tokens) — die vollen Kurvendaten (bands, curves) liegen NICHT archiviert, siehe Kopfkommentar dieses Skripts.",
            steps,
            tokens,
          },
          null,
          2,
        ),
      );
      console.log(`steps-${bench}.json geschrieben (${steps.length} Zeilen)`);
    }
  } else {
    console.log(
      "(--steps weglassen übersprungen: steps-*.json nicht neu geschrieben)",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
