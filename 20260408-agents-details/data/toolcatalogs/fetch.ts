#!/usr/bin/env bun
//
// Archiviert die Modellkataloge von Cursor, Windsurf und JetBrains AI als JSON —
// Datenbasis von `components/toolCatalogs.ts` und damit des Produkt-Filters der
// Folie „Welches Modell wofür?“.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/toolcatalogs/fetch.ts
//
// Warum Rohseiten und nicht die HTML-Ansicht
// ------------------------------------------
// Ein Zusammenfassungs-Abruf und auch die gerenderte HTML-Seite verlieren
// Einträge — am 29.09.2026 zeigte Cursors `/docs/models` nur 13 Standard-Modelle,
// die Rohdatei `models-and-pricing.md` führt 66 (der Rest „Hidden by default“,
// nach dem Einschalten wählbar). Deshalb je Quelle die maschinenlesbare Fassung:
//
//   Cursor        https://cursor.com/docs/models-and-pricing.md
//                 Markdown-Tabellen; Spalte 1 ist `Name` oder `[Name](url)`.
//   Windsurf      https://docs.devin.ai/desktop/models.md
//                 MDX mit `export const modelCostData = [ … ]` (JSON), je Tarif
//                 und je Effort-Stufe ein Eintrag; wir nehmen den Pro-Tarif.
//   JetBrains AI  https://www.jetbrains.com/help/ai-assistant/supported-llms.html
//                 Zwei HTML-Tabellen: die erste die aktiven Modelle des
//                 JetBrains-AI-Abos, die zweite die Historie mit Status.
//
// Junie hat keine maschinenlesbare Liste und steht von Hand in `junie.json`
// (mit Beleg je Eintrag), nicht hier.
//
// Jeder Abruf wird gegen eine Mindestzahl geprüft, bevor etwas geschrieben wird:
// eine Seite, die ihre Tabelle nicht mehr ausliefert, meldet sonst „0 Modelle“
// und sieht aus wie ein leerer Katalog. Schlüssel des Archivs ist der INHALT
// (sha256), nicht das Datum.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HIER = new URL(".", import.meta.url).pathname;
const INDEX = join(HIER, "index.ndjson");

export type ToolKey = "cursor" | "windsurf" | "jetbrains-ai";

export interface CatalogModel {
  /** Name wörtlich wie im Katalog. */
  name: string;
  /** Nur Cursor: „Hidden by default“ — wählbar erst nach dem Einschalten. */
  hidden?: boolean;
  /** Nur Windsurf: Anbieter laut Katalog. */
  provider?: string;
}

export interface Catalog {
  tool: ToolKey;
  source: string;
  models: CatalogModel[];
}

/** Weniger als das ist keine Katalogseite, sondern eine kaputte Antwort. */
export const MIN_MODELS: Record<ToolKey, number> = {
  cursor: 50,
  windsurf: 200,
  "jetbrains-ai": 30,
};

export const SOURCES: Record<ToolKey, string> = {
  cursor: "https://cursor.com/docs/models-and-pricing.md",
  windsurf: "https://docs.devin.ai/desktop/models.md",
  "jetbrains-ai":
    "https://www.jetbrains.com/help/ai-assistant/supported-llms.html",
};

const nbsp = (s: string) => s.replace(/&nbsp;| /g, " ");

/** `[Grok 4.7](https://…)` → `Grok 4.7`, sonst der Text selbst. */
const linkText = (cell: string) =>
  /^\[(?<t>[^\]]+)\]\([^)]*\)$/.exec(cell.trim())?.groups?.t ?? cell.trim();

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/**
 * Zeilen der Modelltabellen: Tabellen, deren Kopf `Model | Provider | …` lautet.
 * Die Seite trägt auch Tarif- und Preistabellen (`**Pro Plus**`, `**Ultra**`),
 * die kein Modell sind. `Hidden by default` steht in der letzten Spalte (Notes).
 */
export function parseCursor(md: string): CatalogModel[] {
  const out: CatalogModel[] = [];
  let inModelle = false;
  for (const zeile of md.split("\n")) {
    if (!zeile.startsWith("|")) {
      inModelle = false;
      continue;
    }
    const zellen = zeile
      .slice(1, zeile.lastIndexOf("|"))
      .split("|")
      .map((z) => z.trim());
    if (zellen[0] === "Model") {
      inModelle = zellen[1] === "Provider";
      continue;
    }
    if (!inModelle || /^-+$/.test(zellen[0]!)) continue;
    const name = linkText(zellen[0]!);
    if (!name) continue;
    out.push({
      name,
      ...(/hidden by default/i.test(zeile) ? { hidden: true } : {}),
    });
  }
  return dedupe(out);
}

// ---------------------------------------------------------------------------
// Windsurf
// ---------------------------------------------------------------------------

/** Schneidet `[ … ]` ab `start` (auf der `[`) mit Blick auf Strings aus. */
function feld(s: string, start: number): string {
  let tiefe = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") tiefe++;
    else if (c === "]" && --tiefe === 0) return s.slice(start, i + 1);
  }
  throw new Error("modelCostData ohne Ende");
}

/**
 * Eintrag je `label` im Pro-Tarif. Der Enterprise-Tarif führt weniger Modelle
 * (253 statt 269 am 29.09.2026); wer im Pro-Tarif wählen kann, hat das Modell.
 */
export function parseWindsurf(md: string): CatalogModel[] {
  const a = md.indexOf("modelCostData = [");
  if (a < 0) throw new Error("modelCostData nicht gefunden");
  const daten = JSON.parse(feld(md, md.indexOf("[", a))) as {
    tier: string;
    label: string;
    model_provider?: string;
  }[];
  const out = daten
    .filter((d) => d.tier === "TEAMS_TIER_PRO")
    .map((d) => ({
      name: d.label,
      ...(d.model_provider
        ? { provider: d.model_provider.replace(/^MODEL_PROVIDER_/, "") }
        : {}),
    }));
  return dedupe(out);
}

// ---------------------------------------------------------------------------
// JetBrains AI
// ---------------------------------------------------------------------------

/**
 * Erste Tabelle der Seite: die aktiven Modelle des JetBrains-AI-Abos
 * (`Model | Capabilities | Model context window`). Die zweite ist die Historie
 * mit Status und gehört nicht hierher — ihre „Deprecated“-Zeilen sind nicht mehr
 * wählbar.
 */
export function parseJetbrains(html: string): CatalogModel[] {
  const tabelle = /<table[\s\S]*?<\/table>/.exec(html)?.[0];
  if (!tabelle) throw new Error("keine Tabelle gefunden");
  const out: CatalogModel[] = [];
  for (const tr of tabelle.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const td = /<td[^>]*>([\s\S]*?)<\/td>/.exec(tr)?.[1];
    if (!td) continue; // Kopfzeile trägt <th>
    const name = nbsp(td.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (name) out.push({ name });
  }
  return out;
}

const dedupe = (ms: CatalogModel[]): CatalogModel[] => {
  const seen = new Set<string>();
  return ms.filter((m) => !seen.has(m.name) && seen.add(m.name));
};

const PARSER: Record<ToolKey, (raw: string) => CatalogModel[]> = {
  cursor: parseCursor,
  windsurf: parseWindsurf,
  "jetbrains-ai": parseJetbrains,
};

// ---------------------------------------------------------------------------
// Abruf und Archiv
// ---------------------------------------------------------------------------

const UA = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15";
const VERSUCHE = 4;
const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hole(tool: ToolKey): Promise<CatalogModel[]> {
  let letzter = "";
  for (let v = 1; v <= VERSUCHE; v++) {
    try {
      const r = await fetch(SOURCES[tool], {
        redirect: "follow",
        headers: { "user-agent": UA },
      });
      const text = await r.text();
      const models = PARSER[tool](text);
      if (models.length >= MIN_MODELS[tool]) return models;
      letzter = `HTTP ${r.status}, ${text.length} Zeichen, ${models.length} Modelle (< ${MIN_MODELS[tool]})`;
    } catch (e) {
      letzter = String(e);
    }
    if (v < VERSUCHE) await schlaf(2000 * 2 ** (v - 1));
  }
  throw new Error(`${SOURCES[tool]}\n  nach ${VERSUCHE} Versuchen: ${letzter}`);
}

interface Eintrag {
  tool: ToolKey;
  /** Erster Abruf mit genau diesem Inhalt (UTC). */
  fetched_at: string;
  file: string;
  models: number;
  sha256: string;
  /** Jeder spätere Abruf mit demselben Inhalt. */
  seen: string[];
}

const lesIndex = (): Eintrag[] => {
  try {
    return readFileSync(INDEX, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Eintrag);
  } catch {
    return [];
  }
};

const jetzt = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

async function main() {
  const index = lesIndex();
  const t = jetzt();
  for (const tool of Object.keys(SOURCES) as ToolKey[]) {
    const catalog: Catalog = {
      tool,
      source: SOURCES[tool],
      models: await hole(tool),
    };
    const inhalt = JSON.stringify(catalog, null, 2) + "\n";
    const sha = createHash("sha256").update(inhalt).digest("hex");
    const da = index.find((e) => e.sha256 === sha);
    if (da) {
      da.seen.push(t);
      console.log(`${tool}: unverändert (${da.file})`);
      continue;
    }
    const datei = `${tool}-${t.replace(/\D/g, "").slice(0, 8)}-${sha.slice(0, 8)}.json`;
    writeFileSync(join(HIER, datei), inhalt);
    index.push({
      tool,
      fetched_at: t,
      file: datei,
      models: catalog.models.length,
      sha256: sha,
      seen: [],
    });
    console.log(`${tool}: neu ${datei} — ${catalog.models.length} Modelle`);
  }
  writeFileSync(INDEX, index.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// Nur als Programm, nicht beim Import: der Test benutzt die Parser.
if (import.meta.main) await main();
