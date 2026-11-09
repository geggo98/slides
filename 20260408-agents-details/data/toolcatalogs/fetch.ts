#!/usr/bin/env bun
//
// Archiviert die Modellkataloge von Cursor, Windsurf und JetBrains AI als JSON —
// Datenbasis von `components/toolCatalogs.ts` und damit des Produkt-Filters der
// Folie „Welches Modell wofür?“.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/toolcatalogs/fetch.ts [tool]
//   bun run 20260408-agents-details/data/toolcatalogs/fetch.ts --dry-run [tool]
//
// Ohne `tool` alle drei Quellen, mit `tool` (`cursor`, `windsurf`,
// `jetbrains-ai`) nur diese — die Index-Zeilen der anderen bleiben unberührt.
// `--dry-run` holt und prüft wie ein echter Lauf, schreibt aber nichts und
// nennt je Quelle die Labels, die gegenüber dem letzten Archiv neu sind oder
// fehlen.
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
//   Windsurf      https://docs.devin.ai/desktop/models (HTML, nicht `.md`)
//                 Die Tabelle füllt erst der Browser, aus dem Feld
//                 `modelCostData` im eingebetteten MDX-Quelltext. Je Tarif und
//                 je Effort-Stufe ein Eintrag; wir nehmen den Pro-Tarif und
//                 blenden aus, was die Seite selbst ausblendet. `models.md`
//                 liefert seit 28.10.2026 nur leere Tabellen (`<tbody />`).
//   JetBrains AI  https://www.jetbrains.com/help/ai-assistant/supported-llms.html
//                 Zwei HTML-Tabellen: die erste die aktiven Modelle des
//                 JetBrains-AI-Abos, die zweite die Historie mit Status.
//
// Junie hat keine maschinenlesbare Liste und steht von Hand in `junie.json`
// (mit Beleg je Eintrag), nicht hier.
//
// Fällt eine Quelle aus (so Windsurf vom 28.10. bis 09.11.2026, solange der
// Parser `models.md` las), wird von Hand recherchiert und die Liste mit
// Belegen archiviert:
//
//   bun run 20260408-agents-details/data/toolcatalogs/fetch.ts \
//     --manual windsurf <liste.json>
//
// `liste.json` ist `{"source": "<url(s)>", "models": [{"name": "…",
// "evidence": ["<url>: <Zitat>"]}, …]}`. Archiviert wird wie bei einem Abruf —
// Datei mit Inhalts-Hash, Index-Eintrag —, die Mindestzahl gilt nicht, weil
// eine Recherche selten den ganzen Katalog findet.
//
// Jeder Abruf wird gegen eine Mindestzahl geprüft, bevor etwas geschrieben wird:
// eine Seite, die ihre Tabelle nicht mehr ausliefert, meldet sonst „0 Modelle“
// und sieht aus wie ein leerer Katalog. Zweite Schranke: mindestens 80 % der
// Einträge des letzten Archivs, die dort einen eigenen Beleg haben. Einträge
// einer `--manual`-Liste mit dem Beleg „übernommen aus …“ zählen nicht mit —
// sie stehen dort, weil keine Entfernung belegt ist, nicht weil die Seite sie
// zeigt. Ein Archiv aus einem Abruf hat keine solchen Einträge; dort ist die
// Basis jeder Eintrag (Windsurf 09.11.2026: ⌈0,8 × 259⌉ = 208).
// Schlüssel des Archivs ist der INHALT (sha256), nicht das Datum: ein Abruf,
// der dieselben Modelle liefert, erzeugt dieselbe Datei und hängt nur einen
// `seen`-Zeitstempel an. Eine `--manual`-Liste hat dagegen einen eigenen
// Inhalt (Belege, `manuell:`), und der nächste Abruf legt danach immer eine
// neue Datei an, auch wenn sich am Katalog nichts geändert hat.
//
// Windsurf: Seit 09.11.2026 gilt die Tabelle der Seite als Entfernungsbeleg.
// Was dort fehlt, fällt aus dem Archiv (Entscheidung des Nutzers; die Seite
// datiert ihren Stand: „as of November 5, 2026“). Für Cursor und JetBrains AI
// bleibt es bei der alten Regel: Muss von Hand recherchiert werden, bleiben
// Modelle im Archiv, bis eine Entfernung belegt ist.

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
  /** Nur bei `--manual`: woher der Eintrag stammt (URL und Zitat). */
  evidence?: string[];
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
  windsurf: "https://docs.devin.ai/desktop/models",
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

/**
 * Schneidet ein JS-Array-Literal `[ … ]` ab `start` (auf der `[`) aus und macht
 * JSON daraus. Das kompilierte MDX schreibt Werte als Template-Strings
 * (`` `TEAMS_TIER_PRO` ``) und Zahlen ohne führende Null (`.15`); beides wird
 * hier übersetzt. Strings werden beim Klammerzählen übersprungen, damit ein `]`
 * in einem Label das Feld nicht beendet.
 */
function feld(s: string, start: number): string {
  let out = "";
  let tiefe = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === "\\" ? 2 : 1;
      out += s.slice(i, j + 1);
      i = j;
    } else if (c === "`") {
      let j = i + 1;
      let roh = "";
      while (j < s.length && s[j] !== "`") {
        if (s[j] === "$" && s[j + 1] === "{")
          throw new Error("modelCostData: Template mit ${…} — kein Literal");
        if (s[j] === "\\") roh += s[++j];
        else roh += s[j];
        j++;
      }
      out += JSON.stringify(roh);
      i = j;
    } else if (
      c === "." &&
      ":,[-".includes(out.at(-1) ?? "") &&
      /\d/.test(s[i + 1] ?? "")
    ) {
      out += "0.";
    } else {
      out += c;
      if (c === "[") tiefe++;
      else if (c === "]" && --tiefe === 0) return out;
    }
  }
  throw new Error("modelCostData ohne Ende");
}

/**
 * Der Quelltext, in dem `modelCostData` steht. Die HTML-Seite trägt das
 * kompilierte MDX als JSON-String (`"compiledSource":"…"`) — erst dekodieren,
 * dann ist es JS. Die frühere `models.md` trug das Feld direkt als JSON.
 */
function windsurfQuelle(text: string): string {
  const marke = '"compiledSource":"';
  for (let a = text.indexOf(marke); a >= 0; a = text.indexOf(marke, a + 1)) {
    const q = a + marke.length - 1;
    let e = q + 1;
    while (e < text.length && text[e] !== '"') e += text[e] === "\\" ? 2 : 1;
    const js = JSON.parse(text.slice(q, e + 1)) as string;
    if (/modelCostData\s*=\s*\[/.test(js)) return js;
  }
  return text;
}

/**
 * Was die Seite selbst ausblendet (`isUserFacing` im Render-Code der Tabelle,
 * gelesen am 09.11.2026): Anbieter UNSPECIFIED, `[dev]`, „backend only“.
 */
const nutzersichtbar = (d: { label: string; model_provider?: string }) =>
  d.model_provider !== "MODEL_PROVIDER_UNSPECIFIED" &&
  !d.label.includes("[dev]") &&
  !d.label.toLowerCase().includes("backend only");

/**
 * Eintrag je `label` im Pro-Tarif (Reiter „Self-serve“), so wie die Tabelle der
 * Seite ihn zeigt. Am 29.09.2026 führte der Enterprise-Tarif weniger Modelle
 * (253 statt 269), am 09.11.2026 dieselben 259; wer im Pro-Tarif wählen kann,
 * hat das Modell.
 *
 * Liest die HTML-Seite (`docs.devin.ai/desktop/models`): Die Tabelle wird im
 * Browser aus `modelCostData` gefüllt, und das Feld steht im eingebetteten
 * MDX-Quelltext. `models.md` liefert seit 28.10.2026 nur leere Tabellen. Am
 * 09.11.2026 ergab dieser Weg dieselben 259 Labels wie das gerenderte DOM
 * (agent-browser, alle Reiter und Anbieter-Filter durchgeklickt).
 */
export function parseWindsurf(text: string): CatalogModel[] {
  const quelle = windsurfQuelle(text);
  const a = /modelCostData\s*=\s*\[/.exec(quelle);
  if (!a) throw new Error("modelCostData nicht gefunden");
  const daten = JSON.parse(feld(quelle, a.index + a[0].length - 1)) as {
    tier: string;
    label: string;
    model_provider?: string;
  }[];
  const out = daten
    .filter((d) => d.tier === "TEAMS_TIER_PRO" && nutzersichtbar(d))
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

/** Ein Beleg „übernommen aus …“ heißt: nicht auf der Seite gesehen. */
const übernommen = (m: CatalogModel) =>
  m.evidence?.some((e) => e.startsWith("übernommen")) ?? false;

/**
 * Mindestzahl eines Abrufs: die feste Untergrenze, und 80 % der Einträge des
 * letzten Archivs, die dort einen eigenen Beleg haben. Ein Abruf, der deutlich
 * weniger findet als zuletzt auf der Seite stand, ist eher ein kaputter Parser
 * als ein geschrumpfter Katalog — er bricht ab, statt die Liste zu kürzen.
 */
export function mindestzahl(
  tool: ToolKey,
  vorher: readonly CatalogModel[] | undefined,
): number {
  const belegt = (vorher ?? []).filter((m) => !übernommen(m)).length;
  return Math.max(MIN_MODELS[tool], Math.ceil(0.8 * belegt));
}

async function hole(tool: ToolKey, min: number): Promise<CatalogModel[]> {
  let letzter = "";
  for (let v = 1; v <= VERSUCHE; v++) {
    try {
      const r = await fetch(SOURCES[tool], {
        redirect: "follow",
        headers: { "user-agent": UA },
      });
      const text = await r.text();
      const models = PARSER[tool](text);
      if (models.length >= min) return models;
      letzter = `HTTP ${r.status}, ${text.length} Zeichen, ${models.length} Modelle (< ${min})`;
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

/** Archiviert einen Katalog: Datei mit Inhalts-Hash, Eintrag im Index. */
function archiviere(index: Eintrag[], t: string, catalog: Catalog): void {
  const { tool } = catalog;
  const inhalt = JSON.stringify(catalog, null, 2) + "\n";
  const sha = createHash("sha256").update(inhalt).digest("hex");
  const da = index.find((e) => e.sha256 === sha);
  if (da) {
    da.seen.push(t);
    console.log(`${tool}: unverändert (${da.file})`);
    return;
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

/** `--manual <tool> <liste.json>`: von Hand recherchierte Liste archivieren. */
function manuell(tool: string, pfad: string): void {
  if (!(tool in SOURCES)) throw new Error(`unbekanntes Werkzeug: ${tool}`);
  const roh = JSON.parse(readFileSync(pfad, "utf8")) as {
    source?: string;
    models?: CatalogModel[];
  };
  const models = roh.models ?? [];
  if (!roh.source || !models.length)
    throw new Error(`${pfad}: \`source\` und mindestens ein Modell nötig`);
  for (const m of models)
    if (!m.name || !m.evidence?.length)
      throw new Error(`${pfad}: ${m.name || "?"} ohne Name oder Beleg`);
  const index = lesIndex();
  archiviere(index, jetzt(), {
    tool: tool as ToolKey,
    source: `manuell: ${roh.source}`,
    models,
  });
  writeFileSync(INDEX, index.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

/** Modelle des letzten Archivs dieses Werkzeugs, falls es eins gibt. */
function letztesArchiv(
  index: Eintrag[],
  tool: ToolKey,
): { file: string; models: CatalogModel[] } | undefined {
  const e = index.filter((x) => x.tool === tool).at(-1);
  if (!e) return undefined;
  const c = JSON.parse(readFileSync(join(HIER, e.file), "utf8")) as Catalog;
  return { file: e.file, models: c.models };
}

async function main(trocken: boolean, nur?: string) {
  if (nur && !(nur in SOURCES)) throw new Error(`unbekanntes Werkzeug: ${nur}`);
  const index = lesIndex();
  const t = jetzt();
  // Eine Quelle, die scheitert, hält die anderen nicht auf und hinterlässt
  // nichts: jede Datei wird mit ihrem Index-Eintrag zusammen geschrieben, der
  // Index am Ende einmal. Vorher schrieb ein Abbruch bei Windsurf schon die
  // Cursor-Datei, aber keinen Index-Eintrag dazu (28.10.2026).
  const fehler: string[] = [];
  for (const tool of Object.keys(SOURCES) as ToolKey[]) {
    if (nur && tool !== nur) continue;
    const vorher = letztesArchiv(index, tool);
    const min = mindestzahl(tool, vorher?.models);
    let models: CatalogModel[];
    try {
      models = await hole(tool, min);
    } catch (e) {
      fehler.push(`${tool}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`${tool}: FEHLER — Katalog bleibt auf dem alten Stand`);
      continue;
    }
    if (vorher) {
      const alt = new Set(vorher.models.map((m) => m.name));
      const neu = new Set(models.map((m) => m.name));
      const plus = [...neu].filter((n) => !alt.has(n));
      const minus = [...alt].filter((n) => !neu.has(n));
      console.log(
        `${tool}: ${models.length} Modelle (Schranke ${min}); gegenüber ${vorher.file}: +${plus.length} −${minus.length}`,
      );
      if (trocken) {
        for (const n of plus) console.log(`  + ${n}`);
        for (const n of minus) console.log(`  − ${n}`);
      }
    }
    if (!trocken) archiviere(index, t, { tool, source: SOURCES[tool], models });
  }
  if (!trocken)
    writeFileSync(INDEX, index.map((e) => JSON.stringify(e)).join("\n") + "\n");
  if (fehler.length) {
    console.error(
      `\n${fehler.length} Quelle(n) gescheitert:\n${fehler.join("\n")}`,
    );
    process.exit(1);
  }
}

// Nur als Programm, nicht beim Import: der Test benutzt die Parser.
if (import.meta.main) {
  const [flag, tool, pfad] = process.argv.slice(2);
  if (flag === "--manual") manuell(tool ?? "", pfad ?? "");
  else if (flag === "--dry-run") await main(true, tool);
  else if (flag && flag in SOURCES) await main(false, flag);
  else if (flag) throw new Error(`unbekannte Option: ${flag}`);
  else await main(false);
}
