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

/** Nur diese Felder braucht das Deck; der Rest wäre Rauschen im Diff. */
export const FELDER = [
  "slug",
  "name",
  "shortName",
  "deprecated",
  "isReasoning",
  "modelCreatorName",
  "intelligenceIndex",
  "intelligenceIndexIsEstimated",
  "intelligenceIndexCostPerTask",
  "medianOutputTokensPerSecond",
  "medianTimeToFirstTokenSeconds",
  "price1mInputTokens",
  "price1mOutputTokens",
] as const;

export type AaRecord = Record<(typeof FELDER)[number], unknown>;

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
 * Die Payload trägt ZWEI `"models":[{"slug"…`-Arrays: eine Stub-Liste (Slug,
 * Name, `deprecated`, `releaseDate`, `creator` — für Suche und Filter) und die
 * Voll-Liste mit den Kennzahlen. Die erste zu nehmen liefert 679 Modelle ohne
 * einen einzigen Messwert und sieht bis auf die Nullen vollständig aus — der
 * Größencheck in `hole()` fängt genau das ab. Voll-Liste ist die, deren
 * Datensätze `intelligenceIndex` tragen.
 */
export function parseModels(html: string): AaRecord[] {
  const p = payload(html);
  const listen = [...p.matchAll(/"models":\[\{"slug"/g)].map(
    (m) =>
      JSON.parse(
        feld(p, p.indexOf("[", m.index + '"models":'.length)),
      ) as Record<string, unknown>[],
  );
  const voll = listen.find((l) => l.some((r) => "intelligenceIndex" in r));
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
  const html = await hole();
  const ms = parseModels(html);
  const inhalt = JSON.stringify(ms, null, 2) + "\n";
  const sha = createHash("sha256").update(inhalt).digest("hex");
  const index = lesIndex();
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
