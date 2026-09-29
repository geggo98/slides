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
// ist nicht immer dieselbe Antwort. Am 29.09.2026 führen Cursor und Windsurf
// alle drei Frontpunkte; bei JetBrains AI endet der Katalog bei Gemini 3.6
// Flash, dort führt weiter Opus 5 für 10,37 €. Am 03.09. war es Windsurf, das
// zurücklag — Kataloge wandern, deshalb Abrufdatum je Werkzeug.
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
 * ab: JetBrains AI führt von Google nur 3.5 und 3.6 Flash. Schriebe ein Preset auf
 * Lab-Häkchen, bekäme JetBrains das ganze Google-Lab und damit gemini-3.8-flash,
 * das es gar nicht anbietet — 13 statt 10 Modelle, und mit gemini-3.8-flash auf
 * der Front die Leiter von „Alle" statt der eines JetBrains-Nutzers. Die Aussage,
 * für die es diesen Filter gibt, wäre weg. Von OpenAI fehlt dort gpt-6-astra.
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
  /**
   * Modelle dieses Charts (beider Datenquellen — gleiche Bezeichnung heißt
   * dasselbe Modell), die das Werkzeug anbietet. Eine Liste je Werkzeug und ein
   * Abrufdatum: `gemini-3.8-flash` gibt es bei Windsurf oder nicht, egal in
   * welcher Ansicht.
   */
  models: readonly string[];
  /** Was die Quelle nicht hergibt. Steht im Menü-Tooltip und im ⓘ-Dialog. */
  caveat: string;
}

export const TOOLS: readonly Tool[] = [
  {
    id: "cursor",
    label: "Cursor",
    source: "https://cursor.com/docs/models-and-pricing",
    retrieved: "2026-09-29",
    // Rohseite `models-and-pricing.md`: 66 Zeilen. Die HTML-Ansicht
    // `/docs/models` zeigt nur die 13 Standard-Modelle; alles andere trägt dort
    // „Hidden by default“ und ist erst nach dem Einschalten wählbar. Wer nur die
    // HTML-Seite liest, findet Kimi K3, GLM 5.x, Opus 5 und Gemini 3.5–3.7 nicht.
    // Hier zählt „wählbar“, also auch das Versteckte.
    models: [
      "claude-fable-5",
      "claude-fable-5.1",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-opus-5.5",
      "claude-sonnet-5",
      "claude-sonnet-5.5",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "glm-5.2",
      "glm-5.3",
      "glm-5.3-flash",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "grok-4.6",
      "grok-4.7",
      "kimi-k3",
      "muse-spark-1.3",
    ],
    caveat:
      "Viele Modelle sind in Cursor „hidden by default“ und erst nach dem Einschalten wählbar; hier zählen sie mit. GPT-6 (Astra/Sol/Luna), DeepSeek, Qwen und MiMo fehlen im Katalog. Cursors eigenes Composer-Modell misst kein Board; es fehlt hier also.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    // Die alte Adresse docs.windsurf.com leitet seit der Übernahme durch
    // Cognition per 307 hierher um.
    source: "https://docs.devin.ai/desktop/models",
    retrieved: "2026-09-29",
    // Rohseite `models.md`, die Modellliste steckt als JSON darin (269
    // verschiedene Einträge im Pro-Tarif, je Effort-Stufe einer). Ein
    // Zusammenfassungs-Abruf hatte am 29.09. GLM 5.3, DeepSeek V4 Flash und
    // Gemini 3.7/3.8 Flash verloren.
    models: [
      "claude-fable-5",
      "claude-fable-5.1",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-opus-5.5",
      "claude-sonnet-5",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "glm-5.2",
      "glm-5.3",
      "glm-5.3-flash",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-6-astra",
      "gpt-6-luna",
      "gpt-6-sol",
      "grok-4.6",
      "kimi-k3",
    ],
    caveat:
      "Die Seite trägt kein Änderungsdatum und verweist auf die Modellauswahl in der App als aktuellen Stand. Sonnet 5.5, Grok 4.7, Muse Spark, Qwen und MiMo fehlen im Katalog. Windsurfs eigenes SWE-x misst kein Board; es fehlt hier also.",
  },
  {
    id: "jetbrains-ai",
    label: "JetBrains AI",
    source: "https://www.jetbrains.com/help/ai-assistant/supported-llms.html",
    retrieved: "2026-09-29",
    // Bis 29.09. stand hier eine Obergrenze auf Providerebene (OpenAI,
    // Anthropic, Google, xAI), weil nur die Preisseite geprüft war. Die Hilfe
    // „Supported models“ (AI Assistant 2026.2, Seitenstand 14.09.2026, zuletzt
    // geändert 06.08.2026) führt die Modelle einzeln — und deutlich weniger, als
    // die vier Labs hergäben: Gemini nur bis 3.6 Flash, von xAI nur Grok-4.3, von
    // Anthropic Opus/Sonnet/Fable 5, aber weder 5.5 noch 5.1.
    models: [
      "claude-fable-5",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-sonnet-5",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ],
    caveat:
      "Gilt für das JetBrains-AI-Abo. Eigene API-Schlüssel (BYOK) und lokale Modelle (Ollama, LM Studio) sind zusätzlich möglich und stehen nicht in der Liste — ein „fehlt“ heißt also nicht „unbenutzbar“. Die Seite ist vom 06.08. bzw. 14.09.2026 und kennt spätere Neuzugänge nicht. Für Junie fand sich keine eigene Modellliste.",
  },
];

const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

/** Bietet das Werkzeug dieses Modell an? Baut die Preset-Mengen. */
export function toolHas(id: ToolId, label: string): boolean {
  return TOOL_BY_ID.get(id)?.models.includes(label) ?? false;
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
