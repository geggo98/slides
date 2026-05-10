/**
 * Tier classification and wording for end-of-run summary.
 *
 * Two wording variants:
 *   - WORDING_VARIANT_A — ego-bezogen (motivational)
 *   - WORDING_VARIANT_B — aufgabenbezogen (Hattie/Timperley-conform, default)
 *
 * Tier-Grenzen werden auf den ungerundeten Score-Prozentwert geprüft;
 * der angezeigte Wert in der UI ist `Math.round(scorePercent)`.
 */

import type { Tier } from "./types";

export function tierFor(scorePercent: number): Tier {
  if (scorePercent >= 100) return "Top";
  if (scorePercent >= 90) return "Stark";
  if (scorePercent >= 75) return "Solide";
  if (scorePercent >= 50) return "Mitte";
  if (scorePercent >= 25) return "Lücken";
  return "Anfang";
}

export const WORDING_VARIANT_B: Record<Tier, string> = {
  Top: "Alle Aussagen korrekt eingeschätzt.",
  Stark:
    "Bis auf wenige Aussagen alles korrekt. Die Begründungen unten zeigen, wo es geklemmt hat.",
  Solide: "Mehrheit korrekt. Die Begründungen unten klären die offenen Punkte.",
  Mitte:
    "Etwa die Hälfte korrekt. Die Begründungen sind hier der eigentliche Lerngewinn.",
  Lücken:
    "Wenige Aussagen korrekt. Empfehlung: erst die Begründungen lesen, dann erneut starten.",
  Anfang:
    "Kaum Treffer. Das Material ist offenbar neu — die Begründungen sind ein guter Einstieg.",
};

export const WORDING_VARIANT_A: Record<Tier, string> = {
  Top: "Vollständig korrekt. Dein Verständnis dieses Themas ist gefestigt.",
  Stark:
    "Sehr starkes Ergebnis. Du bist auf dem besten Weg, Expert:in für das Thema zu werden.",
  Solide:
    "Solide. Ein paar Details lohnen sich, in den Begründungen unten nachzulesen.",
  Mitte:
    "Du hast die Grundlagen. Einige Aspekte sind noch unscharf — die Begründungen helfen weiter.",
  Lücken:
    "Wesentliche Aspekte sind noch offen. Eine zweite Runde mit Fokus auf die Erläuterungen lohnt sich.",
  Anfang:
    "Das Thema ist offenbar neu für dich oder es gibt größere Verständnislücken. Geh die Begründungen Schritt für Schritt durch — das Quiz ist zum Lernen, nicht zum Bewerten.",
};

export type DeltaTone = "strong-up" | "up" | "flat" | "down" | "strong-down";

export interface DeltaWording {
  tone: DeltaTone;
  text: string;
}

/**
 * Wording for the percentage-point delta vs the previous run.
 * Bands per FR-083: ≥ +20 / +5..+19 / −4..+4 / −19..−5 / ≤ −20.
 */
export function deltaWording(deltaPP: number): DeltaWording {
  const sign = deltaPP > 0 ? "+" : "";
  const ppText = `${sign}${deltaPP} PP`;
  if (deltaPP >= 20)
    return {
      tone: "strong-up",
      text: `Deutlicher Sprung gegenüber dem letzten Lauf (${ppText}).`,
    };
  if (deltaPP >= 5)
    return {
      tone: "up",
      text: `Verbesserung gegenüber dem letzten Lauf (${ppText}).`,
    };
  if (deltaPP >= -4)
    return {
      tone: "flat",
      text: `Vergleichbares Niveau wie beim letzten Lauf (${ppText}).`,
    };
  if (deltaPP >= -19)
    return {
      tone: "down",
      text: `Etwas schwächer als beim letzten Lauf (${ppText}). Andere Stichprobe und Schwierigkeit können das erklären.`,
    };
  return {
    tone: "strong-down",
    text: `Deutlich schwächer als beim letzten Lauf (${ppText}). Andere Auswahl an Fragen kann das erklären; schau dir die Begründungen an.`,
  };
}
