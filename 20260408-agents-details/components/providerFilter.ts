// Anbieter-Filter der Folie „Welches Modell wofür? Die Datenlage".
//
// Zwei Arten von Einträgen in einem Menü, mit verschiedener Rolle:
//
//   Labs      — Checkboxen, beliebig kombinierbar. Wer das Modell gebaut hat,
//               kommt aus `labOf()` in `paretoData.ts`, dessen Präfixregeln 1:1
//               die des Boards sind.
//   Werkzeuge — Presets. Was Du in Deiner IDE tatsächlich auswählen kannst;
//               ein Klick überschreibt die Auswahl. Quelle je Eintrag unten.
//
// Der Zweck der Presets: Ein Nutzer von Cursor oder Windsurf sieht mit einem
// Klick, welche der für ihn VERFÜGBAREN Modelle auf der Front liegen — und das
// ist am 03.09.2026 nicht dieselbe Antwort. Windsurfs Katalog endet bei Gemini
// 3.6 Flash, dort führt weiter Opus 5 für 10,37 €; bei Cursor kostet derselbe
// Score 2,07 €.
//
// Der Zweck der Checkboxen: Ein einzelnes Lab hat ein bis vier Punkte, seine
// „Front" ist dann kaum mehr als der beste Punkt. Interessant wird es
// kombiniert — „bei uns sind OpenAI und Anthropic freigegeben".
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
export type PresetId = "all" | ToolId;

/**
 * Der Zustand des Filters ist eine MODELLMENGE, keine Lab-Menge — und das ist
 * kein Geschmack, sondern Rechnung. Ein Werkzeug deckt Labs oft nur teilweise
 * ab: Windsurf führt von Google nur 3.5 und 3.6 Flash. Schriebe ein Preset auf
 * Lab-Häkchen, bekäme Windsurf das ganze Google-Lab und damit gemini-3.8-flash,
 * das es gar nicht anbietet — seine Front wäre dann Zeichen für Zeichen die von
 * „Alle" (20 statt 14 Modelle), und die Aussage, für die es diesen Filter gibt,
 * wäre weg. Cursor bekäme auf demselben Weg glm-5.3-flash dazu.
 *
 * Deshalb: Presets schreiben Modellmengen, die Lab-Checkboxen arbeiten auf
 * derselben Menge, und ein nur teilweise enthaltenes Lab wird als „teilweise"
 * angezeigt statt gerundet. `providerFilter.test.ts` hält das fest.
 */
export type ModelSet = ReadonlySet<string>;

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

/** Bietet das Werkzeug dieses Modell an? Baut die Preset-Mengen. */
export function toolHas(id: ToolId, label: string): boolean {
  const t = TOOL_BY_ID.get(id);
  if (!t) return false;
  return t.labs
    ? t.labs.includes(labOf(label))
    : (t.models?.includes(label) ?? false);
}

export interface Preset {
  id: PresetId;
  label: string;
  /** Schlüssel in `LOGOS`; fehlt, wo es kein Glyph gibt (Alle, JetBrains). */
  logo?: string;
  caveat?: string;
}

/** „Alle" und die drei Werkzeuge in einer Liste — kein Sonderfall im Menü. */
export const PRESETS: readonly Preset[] = [
  { id: "all", label: "Alle" },
  ...TOOLS.map((t) => ({
    id: t.id,
    label: t.label,
    logo: t.id,
    caveat: t.caveat,
  })),
];

/** Die Modelle, die ein Preset auswählt. */
export function presetModels(id: PresetId, pts: Pt[]): string[] {
  return id === "all"
    ? pts.map((p) => p.label)
    : pts.filter((p) => toolHas(id, p.label)).map((p) => p.label);
}

export interface LabRow {
  lab: Lab;
  /** Wie viele Modelle dieses Labs stecken in der Auswahl … */
  drin: number;
  /** … und wie viele hat es überhaupt im Chart. */
  gesamt: number;
  zustand: "an" | "aus" | "teilweise";
  logo: string;
}

/**
 * Eine Zeile je Lab, nach Modellzahl absteigend und dann alphabetisch — so
 * stehen die drei, an die man sich real bindet, oben, und die Einzelgänger
 * fallen ans Ende.
 */
export function labRows(sel: ModelSet, pts: Pt[]): LabRow[] {
  const nach = new Map<Lab, Pt[]>();
  for (const p of pts) {
    const l = labOf(p.label);
    nach.set(l, [...(nach.get(l) ?? []), p]);
  }
  return [...nach.entries()]
    .map(([lab, ms]) => {
      const drin = ms.filter((p) => sel.has(p.label)).length;
      return {
        lab,
        drin,
        gesamt: ms.length,
        zustand: drin === 0 ? "aus" : drin === ms.length ? "an" : "teilweise",
        logo: lab,
      } as LabRow;
    })
    .sort((a, b) => b.gesamt - a.gesamt || a.lab.localeCompare(b.lab));
}

/**
 * Klick auf ein Lab. Vollständig enthalten heißt leeren, sonst auffüllen —
 * „teilweise" wird also zu „an", nicht zu „aus". Das ist das übliche
 * Tri-State-Verhalten und zugleich das des DeepSWE-Boards.
 */
export function toggleLab(sel: ModelSet, lab: Lab, pts: Pt[]): Set<string> {
  const meins = pts.filter((p) => labOf(p.label) === lab).map((p) => p.label);
  const naechste = new Set(sel);
  const voll = meins.every((m) => naechste.has(m));
  for (const m of meins)
    if (voll) naechste.delete(m);
    else naechste.add(m);
  return naechste;
}

/**
 * Deckt sich die Auswahl exakt mit einem Preset? Sonst ist es eine eigene
 * Zusammenstellung, und der Auslöser sagt das auch — sonst stünde dort noch
 * „Windsurf", obwohl ein zugeschaltetes Lab den Werkzeug-Blick längst verlassen
 * hat.
 */
export function matchingPreset(sel: ModelSet, pts: Pt[]): Preset | undefined {
  return PRESETS.find((p) => {
    const m = presetModels(p.id, pts);
    return m.length === sel.size && m.every((x) => sel.has(x));
  });
}
