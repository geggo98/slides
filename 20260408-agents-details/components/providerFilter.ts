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
// Die Kataloge sind vollständig (Rohdaten unter `data/toolcatalogs/`); welche
// ihrer Modelle das Chart zeichnet, entscheidet der Abgleich in
// `catalogMatch.ts`. Modelle, die ein Produkt führt und das Chart nicht kennt,
// tauchen im Filter nicht auf.

import { catalogHas } from "./catalogMatch";
import { labOf, type Lab, type Pt } from "./paretoData";
import { CATALOGS, type CatalogId } from "./toolCatalogs";

export type ToolId = CatalogId;
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
  /** Abrufdatum des Katalogs. Diese Kataloge ändern sich monatlich. */
  retrieved: string;
  /** Was die Quelle nicht hergibt. Steht im Menü-Tooltip und im ⓘ-Dialog. */
  caveat: string;
}

// Welche Modelle ein Produkt führt, steht NICHT hier, sondern in den Rohkatalogen
// (`toolCatalogs.ts`, Daten unter `data/toolcatalogs/`); `catalogMatch.ts`
// entscheidet, welches Chart-Label zu welchem Katalogeintrag gehört. Hier stehen
// nur Anzeigename und der Vorbehalt, den die jeweilige Quelle mitbringt.
//
// BYOK (eigener API-Schlüssel) gilt für JetBrains AI und Junie, nicht für die
// Presets: Ein Preset zeigt, was das JETBRAINS-ABO mitbringt. Wer mit eigenem
// Schlüssel arbeitet, wählt das Lab-Häkchen seines Anbieters (OpenAI, Anthropic,
// Google, xAI) — bei einem OpenRouter-Schlüssel ist das faktisch „Alle“.
const BYOK =
  "Mit eigenem API-Schlüssel (BYOK) ist mehr möglich: Lab-Häkchen des Schlüssel-Anbieters wählen, bei OpenRouter „Alle“.";

export const TOOLS: readonly Tool[] = [
  {
    id: "cursor",
    label: "Cursor",
    source: CATALOGS.cursor.source,
    retrieved: CATALOGS.cursor.retrieved,
    // Rohseite `models-and-pricing.md`: 58 Modelle, 39 davon „Hidden by default“.
    // Die HTML-Ansicht `/docs/models` zeigt nur die 13 Standard-Modelle; wer nur
    // sie liest, findet Kimi K3, GLM 5.x, Opus 5 und Gemini 3.5–3.7 nicht. Hier
    // zählt „wählbar“, also auch das Versteckte.
    caveat:
      "Viele Modelle sind in Cursor „hidden by default“ und erst nach dem Einschalten wählbar; hier zählen sie mit. GPT-6 (Astra/Sol/Luna), DeepSeek, Qwen und MiMo fehlen im Katalog. Cursors eigenes Composer-Modell misst kein Board; es fehlt hier also.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    // Die alte Adresse docs.windsurf.com leitet seit der Übernahme durch
    // Cognition per 307 hierher um.
    source: CATALOGS.windsurf.source,
    retrieved: CATALOGS.windsurf.retrieved,
    // Rohseite `models.md`, die Liste steckt als JSON darin (269 Einträge im
    // Pro-Tarif, je Effort-Stufe einer). Ein Zusammenfassungs-Abruf hatte am
    // 29.09. GLM 5.3, DeepSeek V4 Flash und Gemini 3.7/3.8 Flash verloren.
    caveat:
      "Die Seite trägt kein Änderungsdatum und verweist auf die Modellauswahl in der App als aktuellen Stand. Sonnet 5.5, Grok 4.7, Muse Spark, Qwen und MiMo fehlen im Katalog. Windsurfs eigenes SWE-x misst kein Board; es fehlt hier also.",
  },
  {
    id: "jetbrains-ai",
    label: "JetBrains AI",
    source: CATALOGS["jetbrains-ai"].source,
    retrieved: CATALOGS["jetbrains-ai"].retrieved,
    // Bis 29.09. stand hier eine Obergrenze auf Providerebene (OpenAI,
    // Anthropic, Google, xAI), weil nur die Preisseite geprüft war. Die Hilfe
    // „Supported models“ (AI Assistant 2026.2, Seitenstand 14.09.2026, zuletzt
    // geändert 06.08.2026) führt 41 Modelle einzeln — und deutlich weniger, als
    // die vier Labs hergäben: Gemini nur bis 3.6 Flash, von xAI nur Grok-4.3, von
    // Anthropic Opus/Sonnet/Fable 5, aber weder 5.5 noch 5.1.
    caveat: `Gilt für das JetBrains-AI-Abo (Hilfeseite vom 06.08./14.09.2026, seit IDE 2026.1 ohne Neuzugang). ${BYOK} Lokale Modelle (Ollama, LM Studio) stehen ebenfalls nicht in der Liste.`,
  },
  {
    id: "junie",
    label: "Junie",
    source: CATALOGS.junie.source,
    retrieved: CATALOGS.junie.retrieved,
    // Der Coding-Agent von JetBrains (CLI und in der IDE). Er ist neuer als die
    // AI-Assistant-Hilfe: GPT-6 (04.09./22.09.), Opus 5.5 und Grok 4.7 (22.09.),
    // Sonnet 5.5 (29.09.). Eine vollständige Liste gibt es nicht.
    caveat: `Junie veröffentlicht keine vollständige Modellliste: belegt sind die Modelle der Landingpage und der datierten Release-Notes, weitere zeigt \`/model\` im Produkt. Das ist eine Untergrenze. ${BYOK}`,
  },
];

/** Bietet das Werkzeug das Modell an, das dieses Chart-Label meint? */
export const toolHas = (id: ToolId, label: string): boolean =>
  catalogHas(id, label);

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

/**
 * Die Modelle, die ein Preset auswählt. `universe` sind alle Punkte, die ein
 * Produkt einbringen kann (kuratiertes Feld plus Extras, `aaExtras.ts`),
 * `curated` das kuratierte Feld allein: „Alle“ ist das Feld, ein Produkt
 * bekommt seine Modelle aus dem ganzen Universe — auch die älteren.
 */
export function presetModels(
  id: PresetId,
  universe: Pt[],
  curated: Pt[] = universe,
): string[] {
  return id === "all"
    ? curated.map((p) => p.label)
    : universe.filter((p) => toolHas(id, p.label)).map((p) => p.label);
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
export function matchingPreset(
  sel: ModelSet,
  universe: Pt[],
  curated: Pt[] = universe,
): Preset | undefined {
  return PRESETS.find((p) => {
    const m = presetModels(p.id, universe, curated);
    return m.length === sel.size && m.every((x) => sel.has(x));
  });
}
