#!/usr/bin/env bun
//
// Archiviert die Modell-Liste von https://artificialanalysis.ai/leaderboards/models
// als JSON — Datenbasis der Varianten `aa-cost` und `aa-speed` in
// `components/aaData.ts`.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/artificialanalysis/fetch.ts
//
// Warum die Seite und nicht die API
// ---------------------------------
// Die offizielle API (`/api/v2/data/llms/models`, Header `x-api-key`) führt
// keine Kosten pro Task. Die Seite bettet den vollständigen Datensatz in die
// Next.js-RSC-Payload ein: Stücke der Form
//
//   self.__next_f.push([1,"3a:[\"$\",\"div\",null,{…,\"models\":[{…},…]…"])
//
// Jedes Stück ist ein JSON-String-Literal; erst alle zusammengesetzt ergibt das
// eine Modell-Liste. Deshalb: Stücke einzeln per `JSON.parse` entpacken,
// verketten, das `"models":[`-Array mit einem string-bewussten Klammerzähler
// ausschneiden und echt parsen. Ein Regex auf die Objekte hat am 29.09.2026 den
// Eintrag `claude-opus-5-5` (die max-Stufe) übersehen und sah trotzdem
// vollständig aus.
//
// Fehlende Werte stehen als `"$undefined"` in der Payload (RSC-Sentinel). Das
// Archiv schreibt dafür `null` — sonst rechnet jemand mit einem String.
//
// Kosten sind USD und beziehen sich auf einen Durchlauf des Intelligence Index,
// nicht auf einen Agenten-Task. Umrechnung erst in `aaData.ts`.
//
// Attribution: AA verlangt bei jeder Nutzung den Link auf
// https://artificialanalysis.ai/ — sie steht in der Folie und im ⓘ-Dialog.
//
// Seit Ende Oktober 2026 (Intelligence Index v5)
// ----------------------------------------------
// Die Seite heißt die Liste mit Kennzahlen jetzt `initialModels` und trägt nur
// noch AKTUELLE Modelle (am 28.10.2026: 272, davon 77 mit Index, 74 mit
// Kosten). Abgekündigte stehen nur noch in einer client-seitig verschlüsselten
// Datei, die dieses Skript bewusst NICHT liest — die Verschlüsselung ist eine
// Sperre gegen automatisches Auslesen. Mehr Index- und Kostenwerte stecken
// darin ohnehin nicht: Modelle ohne v5-Messung haben auch dort keine.
//
// Seit 03.11.2026 (AA-Methodik „Performance Benchmarking“ 3.0.0)
// ---------------------------------------------------------------
// Tempo heißt auf der Seite `outputSpeed`, die Latenz `timeToFirstToken` und
// `timeToFirstAnswerToken`; `medianOutputTokensPerSecond`,
// `medianTimeToFirstTokenSeconds` und `intelligenceIndexIsEstimated` gibt es
// nicht mehr (am 09.11.2026: 0 von 283 Modellen). Die neuen Tempo-Felder
// stehen im Archiv unter IHREN Namen, nicht unter den alten, denn sie messen
// etwas anderes. Laut <https://artificialanalysis.ai/methodology/performance-benchmarking>
// (Version History, 3.0.0):
//
//   „Headline output speed: Our headline output speed now averages the
//   workloads we measured over the past 5 days (previously the median of the
//   10k input token workload over the past 72 hours).“
//   „End-to-end output speed: Output speed now covers each request's full
//   duration, including time to first token, …“
//
// Gemessen am 09.11.2026 an 156 Konfigurationen, die beide Stände tragen:
// `outputSpeed` / alter Median im Median 0,80 (0,33 … 2,46); zwischen zwei
// Ständen der alten Methodik lag der Median bei 0,96 … 1,06. Alte und neue
// Tempo-Werte gehören deshalb nie in dasselbe Chart.
//
// `pruefeFelder()` bricht ab, wenn ein Feld deutlich seltener vorkommt als im
// Vorgänger-Snapshot — so fällt die nächste Umbenennung als Fehler auf und
// nicht als leere Tempo-Ansicht.
//
// Die Website-Nutzungsbedingungen (3.3(b)(vi)) untersagen Skripte, die Daten
// von der Seite „strip, scrape, or mine“. Das Deck liest trotzdem einmal pro
// Woche diese eine öffentliche Seite — eine bewusste Entscheidung des
// Repo-Inhabers vom 28.10.2026, mit Attribution und ohne die Sperre zu umgehen.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const HIER = new URL(".", import.meta.url).pathname;
const INDEX = join(HIER, "index.ndjson");
const URL_BOARD = "https://artificialanalysis.ai/leaderboards/models";

/** Weniger als das ist keine Modell-Liste, sondern eine kaputte Antwort. */
const MIN_MODELS = 200;
/** Ebenso: so wenige mit Kosten pro Task hätten ein Chart ohne Punkte. */
const MIN_WITH_COST = 50;
const VERSUCHE = 4;

/**
 * Nur diese Felder braucht das Deck; der Rest wäre Rauschen im Diff. Namen wie
 * auf der Seite. Jedes ist Pflicht im Sinn von `pruefeFelder()`.
 */
export const FELDER = [
  "slug",
  "name",
  "shortName",
  "deprecated",
  "isReasoning",
  "modelCreatorName",
  "intelligenceIndex",
  "intelligenceIndexCostPerTask",
  "outputSpeed",
  "timeToFirstToken",
  "timeToFirstAnswerToken",
  "price1mInputTokens",
  "price1mOutputTokens",
] as const;

export type AaRecord = Record<(typeof FELDER)[number], unknown>;

/**
 * Vorgänger-Namen für den Vergleich in `pruefeFelder()`: bis 02.11.2026 trug
 * das Archiv die alten Tempo-Felder. Nur zum ZÄHLEN gleichgesetzt — die Werte
 * sind nicht vergleichbar (siehe Kopf).
 */
const FRUEHER: Partial<Record<(typeof FELDER)[number], string>> = {
  outputSpeed: "medianOutputTokensPerSecond",
  timeToFirstToken: "medianTimeToFirstTokenSeconds",
};

/** Ein Feld muss mindestens so oft belegt sein wie dieser Anteil im Vorgänger. */
export const MIN_ANTEIL = 0.5;

/** Je Feld: wie viele Datensätze tragen einen Wert (nicht null). */
export function feldZaehler(
  ms: readonly Record<string, unknown>[],
  felder: readonly string[] = FELDER,
): Record<string, number> {
  return Object.fromEntries(
    felder.map((k) => [k, ms.filter((m) => (m[k] ?? null) !== null).length]),
  );
}

/**
 * Bricht LAUT ab, wenn ein Feld fehlt oder deutlich seltener belegt ist als im
 * Vorgänger-Snapshot (`vorher`, das zuletzt archivierte Board): kein Wert in
 * keinem Datensatz, oder weniger als `MIN_ANTEIL` der Vorgänger-Zahl. Die
 * Meldung nennt alle Felder mit Zählern, nicht nur das erste.
 */
export function pruefeFelder(
  ms: readonly AaRecord[],
  vorher: readonly Record<string, unknown>[] | null,
): void {
  const neu = feldZaehler(ms);
  const fehler: string[] = [];
  for (const k of FELDER) {
    const n = neu[k]!;
    const altName = vorher?.some((r) => k in r) ? k : (FRUEHER[k] ?? k);
    const alt = vorher ? feldZaehler(vorher, [altName])[altName]! : null;
    if (n === 0 || (alt !== null && n < alt * MIN_ANTEIL))
      fehler.push(
        `  ${k}: ${n} von ${ms.length}` +
          (alt !== null ? ` (Vorgänger: ${alt} mit ${altName})` : ""),
      );
  }
  if (fehler.length)
    throw new Error(
      `Format geändert? Felder fehlen oder sind zu selten belegt (< ${MIN_ANTEIL * 100} % des Vorgängers):\n${fehler.join("\n")}`,
    );
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Alle `self.__next_f.push([1,"…"])`-Stücke, entpackt und verkettet. */
export function payload(html: string): string {
  // Bewusst KEIN Regex auf den String-Rumpf: `"(?:[^"\\]|\\.)*"` schlägt bei
  // dem ~1-MB-Stück mit der Voll-Liste in Bun/JSC still fehl (kein Fehler,
  // einfach kein Treffer) — am 29.09.2026 fielen 13 von 56 Stücken heraus,
  // darunter genau dieses. Deshalb von Hand bis zum ersten unmaskierten `"`.
  const kopf = 'self.__next_f.push([1,"';
  let out = "";
  let pos = 0;
  let gefunden = 0;
  for (;;) {
    const a = html.indexOf(kopf, pos);
    if (a < 0) break;
    const start = a + kopf.length - 1; // auf dem öffnenden "
    let i = start + 1;
    for (; i < html.length; i++) {
      const c = html.charCodeAt(i);
      if (c === 0x5c)
        i++; // Backslash: nächstes Zeichen überspringen
      else if (c === 0x22) break;
    }
    if (i >= html.length) throw new Error("Push-Stück ohne Ende");
    out += JSON.parse(html.slice(start, i + 1)) as string;
    gefunden++;
    pos = i + 1;
  }
  if (!gefunden) throw new Error("keine __next_f-Stücke in der Seite");
  return out;
}

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
  throw new Error("models-Array ohne Ende");
}

const entsentinel = (v: unknown): unknown => (v === "$undefined" ? null : v);

/**
 * Die Modell-Liste einer Seite, auf `FELDER` reduziert, nach Slug sortiert.
 *
 * Die Payload trägt mehrere Arrays aus `{"slug"…}`-Objekten: eine Stub-Liste
 * (`models`: Slug, Name und wenig mehr — für Suche und Filter) und die Liste mit
 * den Kennzahlen (bis Oktober 2026 ebenfalls `models`, seither
 * `initialModels`). Die Stub-Liste zu nehmen liefert Hunderte Modelle ohne einen
 * einzigen Messwert und sieht bis auf die Nullen vollständig aus — der
 * Größencheck in `hole()` fängt genau das ab. Gewählt wird deshalb nicht nach
 * Namen, sondern nach Inhalt: die Liste mit den meisten Datensätzen, die
 * `intelligenceIndex` tragen.
 */
export function parseModels(html: string): AaRecord[] {
  const p = payload(html);
  const listen = [...p.matchAll(/"(?:initialModels|models)":\[\{"slug"/g)].map(
    (m) =>
      JSON.parse(feld(p, p.indexOf("[", m.index))) as Record<string, unknown>[],
  );
  const mitIndex = (l: Record<string, unknown>[]) =>
    l.filter((r) => "intelligenceIndex" in r).length;
  const voll = listen
    .filter((l) => mitIndex(l) > 0)
    .sort((a, b) => mitIndex(b) - mitIndex(a))[0];
  if (!voll) return [];
  return voll
    .map((r) => {
      const o = {} as AaRecord;
      for (const k of FELDER) o[k] = entsentinel(r[k]) ?? null;
      return o;
    })
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
}

async function hole(): Promise<string> {
  let letzter = "";
  for (let v = 1; v <= VERSUCHE; v++) {
    try {
      const r = await fetch(URL_BOARD, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (slides archive)" },
      });
      const roh = Buffer.from(await r.arrayBuffer());
      const text =
        roh[0] === 0x1f && roh[1] === 0x8b
          ? gunzipSync(roh).toString("utf8")
          : roh.toString("utf8");
      const ms = parseModels(text);
      const mitKosten = ms.filter(
        (m) => typeof m.intelligenceIndexCostPerTask === "number",
      ).length;
      if (ms.length >= MIN_MODELS && mitKosten >= MIN_WITH_COST) return text;
      letzter = `HTTP ${r.status}, ${roh.length} Bytes, ${ms.length} Modelle (< ${MIN_MODELS}), ${mitKosten} mit Kosten (< ${MIN_WITH_COST})`;
    } catch (e) {
      letzter = String(e);
    }
    if (v < VERSUCHE) await schlaf(2000 * 2 ** (v - 1));
  }
  throw new Error(`${URL_BOARD}\n  nach ${VERSUCHE} Versuchen: ${letzter}`);
}

interface Eintrag {
  /** Abrufzeitpunkt des ERSTEN Abrufs mit diesem Inhalt (UTC). */
  fetched_at: string;
  file: string;
  models: number;
  withCost: number;
  /** Der Schlüssel: Inhalt, nicht Datum. */
  sha256: string;
  /** Jeder spätere Abruf mit demselben Inhalt. */
  seen: string[];
}

/**
 * Nur eine FEHLENDE Datei ist ein leerer Index. Jeder andere Fehler (eine
 * kaputte Zeile, ein Konfliktmarker) bricht ab — sonst schriebe `main()` den
 * Index mit nur dem neuen Eintrag neu, und das Archiv verlöre wortlos seine
 * Geschichte.
 */
const lesIndex = (): Eintrag[] => {
  let text: string;
  try {
    text = readFileSync(INDEX, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  return text
    .split("\n")
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l) as Eintrag;
      } catch {
        throw new Error(
          `${INDEX}:${i + 1}: keine JSON-Zeile — Index von Hand prüfen`,
        );
      }
    });
};

const jetzt = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

async function main() {
  const html = await hole();
  const ms = parseModels(html);
  const index = lesIndex();
  const letzter = index.at(-1);
  pruefeFelder(
    ms,
    letzter
      ? (JSON.parse(readFileSync(join(HIER, letzter.file), "utf8")) as Record<
          string,
          unknown
        >[])
      : null,
  );
  const inhalt = JSON.stringify(ms, null, 2) + "\n";
  const sha = createHash("sha256").update(inhalt).digest("hex");
  const da = index.find((e) => e.sha256 === sha);
  const t = jetzt();
  if (da) {
    da.seen.push(t);
    console.log(`unverändert: ${da.file} (${da.seen.length + 1}. Sichtung)`);
  } else {
    const datei = `board-${t.replace(/\D/g, "").slice(0, 8)}-${sha.slice(0, 8)}.json`;
    writeFileSync(join(HIER, datei), inhalt);
    const withCost = ms.filter(
      (m) => typeof m.intelligenceIndexCostPerTask === "number",
    ).length;
    index.push({
      fetched_at: t,
      file: datei,
      models: ms.length,
      withCost,
      sha256: sha,
      seen: [],
    });
    console.log(`neu: ${datei} — ${ms.length} Modelle, ${withCost} mit Kosten`);
  }
  writeFileSync(INDEX, index.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// Nur als Programm, nicht beim Import: der Test benutzt `parseModels()`.
if (import.meta.main) await main();
