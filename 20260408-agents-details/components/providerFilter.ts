// Anbieter-Filter der Folie „Welches Modell wofür? Die Datenlage".
//
// Zwei Arten von Auswahl, bewusst in einem Menü:
//
//   Labs      — wer das Modell gebaut hat. Kommt aus `labOf()` in
//               `paretoData.ts`, dessen Präfixregeln 1:1 die des Boards sind.
//   Werkzeuge — was Du in Deiner IDE tatsächlich auswählen kannst. Kommt aus
//               der jeweiligen Hersteller-Doku, siehe `source` je Eintrag.
//
// Der Zweck ist die zweite Sorte: Ein Nutzer von Cursor oder Windsurf sieht mit
// einem Klick, welche der für ihn VERFÜGBAREN Modelle auf der Front liegen —
// und das ist am 03.09.2026 nicht dieselbe Antwort. Windsurfs Katalog endet bei
// Gemini 3.6 Flash, dort führt weiter Opus 5 für 10,37 €; bei Cursor kostet
// derselbe Score 2,07 €.
//
// Was der Filter NICHT tut
// ------------------------
// Er zeigt Verfügbarkeit, nicht Preis. Cursor, Windsurf und JetBrains rechnen
// nach eigenen Tarifen und Credits ab; geplottet bleibt der API-Listenpreis.
// Aufschläge sind bewusst ausgeklammert — sonst müsste das Chart drei
// Preismodelle gleichzeitig abbilden.
//
// Und das Eigenmodell jedes Werkzeugs fehlt in seiner eigenen Ansicht: DeepSWE
// misst weder Cursors Composer noch Windsurfs SWE-1.x. Die echte Front eines
// Windsurf-Nutzers könnte also einen Punkt enthalten, den niemand gemessen hat.
//
// Umfang der Listen
// -----------------
// Aufgeführt sind nur Modelle, die dieses Chart auch zeichnet. Cursor und
// Windsurf bieten zusätzlich mehrere der sieben vom Board ausgeblendeten
// Modelle an (grok-4.5, kimi-k2.7-code, gpt-5.4, claude-sonnet-4.6,
// gemini-3.1-pro). Nachgerechnet am 03.09.2026: keines käme je auf eine Front —
// alle liegen bei mindestens 1,88 € und höchstens 54 %, gpt-5.6-luna (0,53 €,
// 67 %) dominiert sie sämtlich. Die Verkürzung ändert also keine Aussage.

import { labOf, type Lab, type Pt } from "./paretoData";

export type ToolId = "cursor" | "windsurf" | "jetbrains-ai";
export type Selection = "all" | Lab | ToolId;

export interface Tool {
  id: ToolId;
  label: string;
  source: string;
  /** Abrufdatum der Modell-Liste. Diese Kataloge ändern sich monatlich. */
  retrieved: string;
  /** Modelle dieses Charts, die das Werkzeug anbietet. */
  models?: readonly string[];
  /**
   * Alternativ zur Modell-Liste: Freigabe auf Providerebene. Nur für
   * JetBrains AI — die Preisseite nennt Anbieter, keine Modelle. Das ist eine
   * Obergrenze, keine Aufzählung.
   */
  labs?: readonly Lab[];
  /** Was die Quelle nicht hergibt. Steht im Menü-Tooltip und im ⓘ-Dialog. */
  caveat: string;
}

export const TOOLS: readonly Tool[] = [
  {
    id: "cursor",
    label: "Cursor",
    source: "https://cursor.com/docs/models",
    retrieved: "2026-09-03",
    models: [
      "claude-fable-5",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-sonnet-5",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "glm-5.2",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "grok-4.6",
      "kimi-k3",
    ],
    caveat:
      "Cursors eigenes Composer-Modell misst DeepSWE nicht; es fehlt hier also.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    // Die alte Adresse docs.windsurf.com leitet seit der Übernahme durch
    // Cognition per 307 hierher um.
    source: "https://docs.devin.ai/desktop/models",
    retrieved: "2026-09-03",
    models: [
      "claude-fable-5",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-sonnet-5",
      "deepseek-v4-pro",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "glm-5.2",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "grok-4.6",
      "kimi-k3",
    ],
    caveat:
      "Der Katalog endet bei Gemini 3.6 Flash — 3.7 und 3.8 stehen nicht darin, ebenso wenig GLM 5.3 und DeepSeek V4 Flash. Windsurfs eigenes SWE-1.x misst DeepSWE nicht.",
  },
  {
    id: "jetbrains-ai",
    label: "JetBrains AI",
    source: "https://www.jetbrains.com/ai-ides/buy/",
    retrieved: "2026-09-03",
    // Providerebene statt Modell-Liste: die Preisseite sagt „Third-party cloud
    // AI models via JetBrains AI — OpenAI, Anthropic, Google, and xAI" und
    // nennt keine einzelnen Modelle. Diese Auswahl nimmt deshalb ALLE Modelle
    // dieser vier Labs und ist damit eine Obergrenze, keine Aufzählung.
    labs: ["OpenAI", "Anthropic", "Google", "xAI"],
    caveat:
      "Auf Providerebene belegt, nicht je Modell — die Auswahl ist eine Obergrenze. Junie fehlt ganz: dort veröffentlicht JetBrains keinen Modellkatalog.",
  },
];

const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

/** Gehört das Modell zur aktuellen Auswahl? */
export function memberOf(sel: Selection, label: string): boolean {
  if (sel === "all") return true;
  const tool = TOOL_BY_ID.get(sel as ToolId);
  if (!tool) return labOf(label) === sel;
  return tool.labs
    ? tool.labs.includes(labOf(label))
    : (tool.models?.includes(label) ?? false);
}

export interface Option {
  value: Selection;
  label: string;
  /** Wie viele der gezeigten Punkte diese Auswahl übrig lässt. */
  count: number;
  /** Schlüssel in `LOGOS`; fehlt, wenn es kein Glyph gibt (JetBrains). */
  logo?: string;
  caveat?: string;
}

/**
 * Menü-Einträge für die übergebenen Punkte. Labs nach Modellzahl absteigend —
 * so stehen die drei, an die man sich real bindet, oben; die Einzelgänger
 * (ein bis zwei Modelle, triviale „Front") fallen ans Ende.
 */
export function optionsFor(pts: Pt[]): { labs: Option[]; tools: Option[] } {
  const byLab = new Map<Lab, number>();
  for (const p of pts)
    byLab.set(labOf(p.label), (byLab.get(labOf(p.label)) ?? 0) + 1);

  const labs: Option[] = [...byLab.entries()]
    .map(([lab, count]) => ({ value: lab, label: lab, count, logo: lab }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const tools: Option[] = TOOLS.map((t) => ({
    value: t.id,
    label: t.label,
    count: pts.filter((p) => memberOf(t.id, p.label)).length,
    logo: t.id,
    caveat: t.caveat,
  }));

  return { labs, tools };
}
