#!/usr/bin/env bun
//
// Archiviert das DesignArena-Board „Overall Agentic“ von
// https://www.designarena.ai/leaderboard?section=overall&board=overall-agentic
// als JSON — Datenbasis der Varianten `da-cost` und `da-speed` in
// `components/daData.ts`.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/designarena/fetch.ts
//
// Woher die Zahlen kommen
// -----------------------
// Die Seite ist Next.js und zeichnet ihre Charts serverseitig. Die Zahlen dafür
// stehen in der RSC-Payload (`self.__next_f.push`, entpackt mit `payload()` aus
// dem AA-Skript) in EINEM Objekt:
//
//   {"seed":{"boards":[{"category":"overall-agentic","data":[{modelId, elo, …}],
//                       "metadata":{lastUpdateTime, totalVotes}}],
//            "subcategoryBoards":[…],
//            "registry":{"models":{<id>:{displayName, provider, …}},
//                        "providers":{…},
//                        "pricing":{<id>:{"text":{input, output, …}}}}}}
//
// Es wird mit einem string-bewussten Klammerzähler ausgeschnitten und echt
// geparst, nicht per Regex (siehe den Kopf von `../artificialanalysis/fetch.ts`).
//
// Die `robots.txt` der Seite erlaubt `/` und sperrt `/api/`. Dieses Skript liest
// nur die öffentliche Seite, einmal pro Woche, und nie `/api/`.
//
// Was die Felder heißen
// ---------------------
// - `elo`: Bradley-Terry-Rating aus Blind-Duellen, Start 1200. Gewählt wird
//   nach Gefallen am Ergebnis einer Design- bzw. Agentic-Aufgabe, nicht nach
//   Korrektheit.
// - `avgGenerationTimeMs`: Ø Zeit einer Generierung. Die Seite führt sie nur für
//   einen Teil der Modelle (am 31.10.2026: 28 von 72, keines der neuesten).
// - `priceInput`/`priceOutput`: Listenpreis in USD je 1M Token. Die Seite mischt
//   3:1 (Input:Output) für ihr Kosten-Chart; gemischt wird erst in `daData.ts`.
// - `modelId` ist teils ein Codename (`hampshire` = MiMo-V2.6-Pro). Maßgeblich
//   für das Deck ist `displayName`.
//
// Versionierung
// -------------
// Wie bei AA ist der Schlüssel die sha256 des Inhalts, nicht das Datum: neuer
// Inhalt wird `board-JJJJMMTT-<sha8>.json` plus eine Zeile in `index.ndjson`,
// gleicher Inhalt verlängert nur `seen`. Kein Stand wird je gelöscht — das
// Archiv ist die Grundlage einer späteren Zeitreihe.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { payload } from "../artificialanalysis/fetch.ts";

const HIER = new URL(".", import.meta.url).pathname;
const INDEX = join(HIER, "index.ndjson");
export const CATEGORY = "overall-agentic";
const URL_BOARD = `https://www.designarena.ai/leaderboard?section=overall&board=${CATEGORY}`;

/** Weniger als das ist kein Board, sondern eine kaputte Antwort. */
const MIN_MODELS = 50;
/** Ebenso: so wenige Werte ergäben ein Chart ohne Punkte. */
const MIN_WITH_TIME = 15;
const MIN_WITH_PRICE = 40;
/** So viele Zeilen ohne Elo werden übergangen; mehr heißt: Format geändert. */
const MAX_OHNE_ELO = 3;
const VERSUCHE = 4;

export interface DaRecord {
  modelId: string;
  displayName: string | null;
  provider: string | null;
  openSource: boolean | null;
  elo: number;
  winRate: number | null;
  wins: number | null;
  losses: number | null;
  battles: number | null;
  btStdErr: number | null;
  avgGenerationTimeMs: number | null;
  /** USD je 1M Input-Token. */
  priceInput: number | null;
  /** USD je 1M Output-Token. */
  priceOutput: number | null;
}

export interface DaBoard {
  category: string;
  /** Zeitpunkt der letzten Neuberechnung laut Seite. */
  lastUpdateTime: string | null;
  totalVotes: number | null;
  models: DaRecord[];
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Schneidet `{ … }` bzw. `[ … ]` ab `start` mit Blick auf Strings aus. */
function block(s: string, start: number): string {
  const auf = s[start];
  const zu = auf === "{" ? "}" : "]";
  let tiefe = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === auf) tiefe++;
    else if (c === zu && --tiefe === 0) return s.slice(start, i + 1);
  }
  throw new Error(`${auf}-Block ohne Ende`);
}

const zahl = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const text = (v: unknown): string | null =>
  typeof v === "string" && v !== "$undefined" ? v : null;

type Obj = Record<string, unknown>;

/**
 * Das Board `CATEGORY` einer Seite, mit Name, Anbieter und Preis je Modell,
 * nach `modelId` sortiert. Wirft, wenn das Board fehlt — eine leere Liste sähe
 * aus wie ein Board ohne Modelle.
 */
export function parseBoard(html: string): DaBoard {
  const p = payload(html);
  const a = p.indexOf('{"seed":{');
  if (a < 0) throw new Error("kein seed-Objekt in der Payload");
  const seed = (JSON.parse(block(p, a)) as { seed: Obj }).seed;
  const boards = (seed.boards ?? []) as Obj[];
  const board = boards.find((b) => b.category === CATEGORY);
  if (!board) throw new Error(`Board ${CATEGORY} fehlt in der Payload`);
  const reg = (seed.registry ?? {}) as Obj;
  const karten = (reg.models ?? {}) as Record<string, Obj>;
  const preise = (reg.pricing ?? {}) as Record<string, { text?: Obj }>;
  const meta = (board.metadata ?? {}) as Obj;
  const zeilen = (board.data ?? []) as Obj[];
  // Eine Zeile ohne Elo ist kein Punkt. `Number(null)` wäre 0 und sähe aus wie
  // ein Messwert — deshalb über `zahl()` und aussortieren, nicht umrechnen.
  const mitElo = zeilen.filter((r) => zahl(r.elo) !== null);
  if (zeilen.length - mitElo.length > MAX_OHNE_ELO)
    throw new Error(
      `${zeilen.length - mitElo.length} von ${zeilen.length} Zeilen ohne Elo — Format geändert?`,
    );
  const models = mitElo
    .map((r): DaRecord => {
      const id = String(r.modelId);
      const k = karten[id] ?? {};
      const t = preise[id]?.text ?? {};
      return {
        modelId: id,
        displayName: text(k.displayName),
        provider: text(k.provider),
        openSource: typeof k.openSource === "boolean" ? k.openSource : null,
        elo: zahl(r.elo)!,
        winRate: zahl(r.winRate),
        wins: zahl(r.wins),
        losses: zahl(r.losses),
        battles: zahl(r.battles),
        btStdErr: zahl(r.btStdErr),
        avgGenerationTimeMs: zahl(r.avgGenerationTimeMs),
        priceInput: zahl(t.input),
        priceOutput: zahl(t.output),
      };
    })
    .sort((x, y) => x.modelId.localeCompare(y.modelId));
  return {
    category: CATEGORY,
    lastUpdateTime: text(meta.lastUpdateTime),
    totalVotes: zahl(meta.totalVotes),
    models,
  };
}

const mitZeit = (b: DaBoard) =>
  b.models.filter((m) => m.avgGenerationTimeMs !== null).length;
const mitPreis = (b: DaBoard) =>
  b.models.filter((m) => m.priceInput !== null && m.priceOutput !== null)
    .length;

async function hole(): Promise<DaBoard> {
  let letzter = "";
  for (let v = 1; v <= VERSUCHE; v++) {
    try {
      const r = await fetch(URL_BOARD, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (slides archive)" },
      });
      const roh = Buffer.from(await r.arrayBuffer());
      const html =
        roh[0] === 0x1f && roh[1] === 0x8b
          ? gunzipSync(roh).toString("utf8")
          : roh.toString("utf8");
      const b = parseBoard(html);
      const n = b.models.length;
      if (
        n >= MIN_MODELS &&
        mitZeit(b) >= MIN_WITH_TIME &&
        mitPreis(b) >= MIN_WITH_PRICE
      )
        return b;
      letzter = `HTTP ${r.status}, ${n} Modelle (≥ ${MIN_MODELS}), ${mitZeit(b)} mit Zeit (≥ ${MIN_WITH_TIME}), ${mitPreis(b)} mit Preis (≥ ${MIN_WITH_PRICE})`;
    } catch (e) {
      letzter = String(e);
    }
    if (v < VERSUCHE) await schlaf(2000 * 2 ** (v - 1));
  }
  throw new Error(`${URL_BOARD}\n  nach ${VERSUCHE} Versuchen: ${letzter}`);
}

export interface Eintrag {
  /** Abrufzeitpunkt des ERSTEN Abrufs mit diesem Inhalt (UTC). */
  fetched_at: string;
  file: string;
  models: number;
  withTime: number;
  withPrice: number;
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
  const b = await hole();
  const inhalt = JSON.stringify(b, null, 2) + "\n";
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
    index.push({
      fetched_at: t,
      file: datei,
      models: b.models.length,
      withTime: mitZeit(b),
      withPrice: mitPreis(b),
      sha256: sha,
      seen: [],
    });
    console.log(
      `neu: ${datei} — ${b.models.length} Modelle, ${mitZeit(b)} mit Zeit, ${mitPreis(b)} mit Preis`,
    );
  }
  writeFileSync(INDEX, index.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// Nur als Programm, nicht beim Import: der Test benutzt `parseBoard()`.
if (import.meta.main) await main();
