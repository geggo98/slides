// Die Modellkataloge der Produkte, die der Filter der Folie „Welches Modell
// wofür?“ als Presets anbietet — als Rohnamen, so wie das Produkt sie führt.
// Welcher Katalogname zu welchem Messwert gehört, entscheidet `catalogMatch.ts`.
//
// Herkunft und Abrufdatum stehen je Katalog hier; die Rohdaten unter
// `data/toolcatalogs/` (`fetch.ts` erklärt, warum aus den Rohseiten und nicht aus
// der gerenderten HTML-Ansicht). Ein neuer Abruf heißt: `fetch.ts` laufen lassen,
// die Dateinamen unten nachziehen, `retrieved` setzen — `toolCatalogs.test.ts`
// hält beides gegen den Index.

import cursor from "../data/toolcatalogs/cursor-20260929-e63cb420.json";
import jetbrains from "../data/toolcatalogs/jetbrains-ai-20260929-6a5537e8.json";
import junie from "../data/toolcatalogs/junie.json";
import windsurf from "../data/toolcatalogs/windsurf-20260929-1ef22504.json";

export type CatalogId = "cursor" | "windsurf" | "jetbrains-ai" | "junie";

export interface CatalogEntry {
  name: string;
  /** Cursor: „Hidden by default“ — wählbar nach dem Einschalten. */
  hidden?: boolean;
  /** Junie: woran die Aufnahme belegt ist. */
  evidence?: string[];
}

export interface ToolCatalog {
  id: CatalogId;
  source: string;
  /** Abrufdatum der Rohseite (Junie: Datum der Belege). */
  retrieved: string;
  models: readonly CatalogEntry[];
}

export const CATALOGS: Readonly<Record<CatalogId, ToolCatalog>> = {
  cursor: {
    id: "cursor",
    source: cursor.source,
    retrieved: "2026-09-29",
    models: cursor.models,
  },
  windsurf: {
    id: "windsurf",
    source: windsurf.source,
    retrieved: "2026-09-29",
    models: windsurf.models,
  },
  "jetbrains-ai": {
    id: "jetbrains-ai",
    source: jetbrains.source,
    retrieved: "2026-09-29",
    models: jetbrains.models,
  },
  junie: {
    id: "junie",
    source: junie.source,
    retrieved: junie.retrieved,
    models: junie.models,
  },
};
