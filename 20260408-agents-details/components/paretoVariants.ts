// Die beiden Ansichten der Folie „Welches Modell wofür?“. Jede Variante bündelt
// alles, was sich zwischen ihnen unterscheidet — Punkte, Skala, Ticks,
// Quadranten, Pfeiltexte, Legenden- und Tooltip-Formate, Fußzeile und den
// Empfehlungsabsatz. `ParetoChart.vue` zeichnet nur noch, was hier steht, und
// wird pro Variante neu gemountet (`:key`): Skala, Pfeilcluster und Entzerrung
// sind Setup-Konstanten der Komponente, nicht reaktiv.
//
//   aa-cost   Artificial-Analysis-Intelligence-Index × €/Task   (Default)
//   aa-speed  derselbe Index × Output-Tokens/s
//   da-cost   DesignArena-Elo (Overall Agentic) × Listenpreis je 1M Token
//   da-speed  derselbe Elo × Ø Generierungszeit
//
// Die DesignArena-Ansichten sind eine zweite, von AA unabhängige
// Qualitätsachse: Menschen stimmen blind über Design- und Agentic-Ergebnisse ab
// (`daData.ts`).
//
// DeepSWE war bis Oktober 2026 die dritte Ansicht. Das Board wird nicht mehr
// gepflegt; seine Daten leben nur noch auf der Historien-Folie
// (`ModelRoutingHistory.vue`, `paretoData.ts`).
//
// Alle folgen „kleiner x ist besser, größerer y ist besser“ — `paretoFront`,
// Quadranten und Pfeile brauchen dadurch keinen Richtungsparameter. Bei
// `aa-speed` ist x deshalb die Zeit je 1 000 Tokens (`aaData.ts`), und nur die
// Tick-Beschriftung spricht von tok/s.

import {
  AA_COST,
  AA_FLOOR,
  AA_NO_TPS,
  AA_SPEED,
  AA_STAND,
  AA_URL,
} from "./aaData";
import { AA_EXTRAS_COST, AA_EXTRAS_SPEED } from "./aaExtras";
import {
  DA_COST,
  DA_EXTRAS_COST,
  DA_EXTRAS_SPEED,
  DA_FLOOR,
  DA_NO_TIME,
  DA_SPEED,
  DA_STAND,
  DA_URL,
  MIX,
} from "./daData";
import { makeScale, paretoFront, type Pt, type Scale } from "./paretoData";
import {
  quadrantsWith,
  QUADRANTS,
  tickLabel,
  type Quadrant,
} from "./paretoChrome";
import type { XY } from "./labelLayout";

export type VariantId = "aa-cost" | "aa-speed" | "da-cost" | "da-speed";

/** Datenquelle einer Ansicht — das Menü gruppiert danach. */
export type Source = "aa" | "da";
export const SOURCE_LABEL: Record<Source, string> = {
  aa: "Artificial Analysis",
  da: "DesignArena · Design-Duelle",
};

/** Ein Stück Fließtext; `b` = fett. Die Komponente setzt daraus <strong>. */
export interface Seg {
  t: string;
  b?: boolean;
  /** Hover-Text, z. B. die Liste der Modelle ohne Wert. */
  title?: string;
}

export interface ParetoVariant {
  id: VariantId;
  source: Source;
  /** Menüzeile. */
  menu: string;
  /** Zweite Menüzeile, klein. */
  menuNote: string;
  pts: Pt[];
  /**
   * Modelle, die nur ein Produkt-Preset einblendet: ältere, abgekündigte, mit
   * geschätztem Index (`aaExtras.ts`).
   */
  extras: Pt[];
  /** Was die x-Achse misst — Texte („billigste“ oder „schnellste Sprosse“). */
  xKind: "cost" | "speed";
  /**
   * x ist der Kehrwert der beschrifteten Größe (`aa-speed`: x = 1000/tps, die
   * Ticks sprechen von tok/s). Steuert das Anpassen der Skala
   * (`paretoGeometry.ts`).
   */
  xInverse: boolean;
  scale: Scale;
  /** Tick-POSITIONEN in Datenkoordinaten (x) — bei `aa-speed` also Sekunden. */
  xTicks: number[];
  xTickLabel: (x: number) => string;
  yTicks: number[];
  yTickLabel: (y: number) => string;
  /** Redaktionelle Quadranten-Trennung (Datenkoordinaten). */
  split: { x: number; y: number };
  quadrants: Quadrant[];
  arrows: {
    texts: { cheaper: string; stronger: string; better: string };
    target?: (s: Scale) => { x: number; y: number };
    hubY?: (s: Scale) => number;
    hubX?: (s: Scale) => number;
  };
  axisTitle: string;
  /** „2,07 €“ bzw. „93 tok/s“ — Fadenkreuz-Badge unten und Kurzform im Text. */
  xText: (p: Pt) => string;
  /** „74 %“ bzw. „52,7“. */
  yText: (y: number) => string;
  tip: (p: Pt) => string;
  /** Name der y-Größe im aria-Label. */
  yName: string;
  features: {
    /** Claude-Code-Kontingent-Schalter (Claude-Punkte × Faktor). */
    subOverlay: boolean;
    /** Schalter „Tempo als Größe“. */
    sizeBySpeed: boolean;
  };
  /** Beschriftung des Kontingent-Schalters (Tooltip). */
  subTitle: string;
  /** Was die Fußzeile über der Folie sagt. */
  footnote: Seg[];
  /** Ziel der Quellenangabe in der Fußzeile, falls die Quelle Attribution verlangt. */
  attribution?: { href: string; label: string };
  /** Der Empfehlungsabsatz unter dem Chart. */
  lead: Seg[];
  /** Erklärt in der aria-Beschreibung, was die Ansicht zeigt (redaktionelle Skala). */
  ariaIntro: string;
  /** Dasselbe für jede andere Auswahl: Achsen angepasst, Quadranten am Median. */
  ariaFit: string;
  /** Satz(e) am Ende der aria-Beschreibung, variantenspezifisch. */
  ariaTail: string;
}

const eurT = (p: Pt) => `${p.eur} €`;
const dez1 = (v: number) => v.toFixed(1).replace(".", ",");

// --- AA-Skalen -------------------------------------------------------------
// Dieselbe Bühne wie die Historien-Folie (932 × 306), nur andere Achsen:
// Kosten log von 0,08 € bis 40 € (am 16.11.2026 kleinster Punkt 0,11 €, größter
// 23,25 € mit claude-fable-5.2; bis 09.11. reichte 0,04 € bis 22 €), der
// Index (v5) linear von 24 bis 68 (am 16.11.2026 Punkte 26,7 bis 64,6). Bis
// 09.11. lief die Achse von 22 bis 66; Fable 5.2 (64,6) braucht darüber Platz
// für sein Label. Den unteren Rand hat der 16.11. von 0,04 € auf 0,08 € und
// von 22 auf 24 gehoben: Unten links drängen sich mimo-v2.6-flash, muse-ember
// und gpt-6-luna, und gpt-6.1-terra-non-reasoning fand dort keinen Platz mehr
// (0,04 €: 0 gültige Pfeilpositionen, 0,08 €: 35). Ein yMin > 0 spart die untere
// Hälfte der Achse, in der kein Modell liegt.
// 23.11.2026: yMax 69 statt 68. claude-sonnet-5.5 steht seit diesem Stand auf
// der JetBrains-Front (Rang 0) und belegt mit seinem Label den Platz, an den
// claude-fable-5.2 bisher seine Führungslinie legte; links neben Fable steht
// das Label von gemini-4-neon (neu). Bei 68 lag Fables Label unter der
// Überschrift „Leistung um jeden Preis“ und fand keinen Platz, bei 69 steht
// es mit einer langen Führungslinie (≈ 185 px) links über gemini-4-neon —
// im Browser ansehen. 70 nimmt claude-haiku-5.5 den Platz, 71 und 72
// gpt-6.1-terra-non-reasoning (Gitter über yMax × Pfeilknoten × Ziel, siehe
// `arrows` der Kostenansicht).
const AA_BASE = { W: 932, L: 46, R: 10, T: 10, H: 306, B: 33 } as const;
const AA_COST_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 40,
  xLog: { min: 0.08 },
  yMin: 24,
  yMax: 69,
});
// x = 1000/tps: am 31.10.2026 4,3 s (235 tok/s) bis 32,4 s (31 tok/s,
// kimi-k3.1-pro) je 1 000 Tokens; am 09.11.2026 (neue AA-Tempo-Methodik)
// 4,3 s (233 tok/s) bis 31,6 s (32 tok/s), wieder kimi-k3.1-pro. Am 16.11.2026
// kommt muse-ember mit 2,3 s (439 tok/s) dazu, deshalb beginnt die Achse bei
// 2 s statt 3 s, und der Index reicht bis 68 (claude-fable-5.2: 64,6).
// 23.11.2026: 2,15–34 s und Index 18–74. Mit den neuen Tempowerten liegen
// gemini-4-hydrogen (157 tok/s) und claude-sonnet-5.5 (152 tok/s) bei Index
// ≈ 54 fast aufeinander, dazu ein Knäuel aus glm-5.3, gpt-6.1-terra-non-
// reasoning und qwen3.8-flash-next um 30. Auf der alten Skala (2–40 s, 22–68)
// braucht die Entzerrung sechs Durchgänge, der Test erlaubt fünf. Gitter
// yMin 14–25 × yMax 66–80 × xMax 33–60 × xMin 1,5–2,2: Fünf oder weniger
// gibt es erst ab einer Indexspanne von 56 und xMax ≤ 38. Gewählt die
// kleinste Spanne mit zwei Durchgängen und allen Prüfungen der Tests:
// 18–74, xMax 34 (kimi-k3.1-pro: 30,7 s), xMin 2,15 (muse-ember: 2,26 s).
const AA_SPEED_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 34,
  xLog: { min: 2.15 },
  yMin: 18,
  yMax: 74,
});

const AA_COST_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
const AA_Y_TICKS = [25, 30, 35, 40, 45, 50, 55, 60];
/** Tempoansicht: Skala 18–74, die Ticks decken sie bis 70 ab. */
const AA_SPEED_Y_TICKS = [20, ...AA_Y_TICKS, 65, 70];
/** tok/s-Ticks von schnell nach langsam — in x-Koordinaten 1000/t. */
const TPS_TICKS = [300, 200, 100, 60, 40, 30];

/** Vorderste Sprossen einer Variante — für Lead-Text und Tests. */
export const frontOf = (v: Pick<ParetoVariant, "pts">) =>
  paretoFront(v.pts).front;

const leiter = (pts: Pt[], f: (p: Pt) => string): Seg[] =>
  pts.flatMap((p, i) => [
    ...(i ? [{ t: " → " }] : []),
    { t: p.label, b: true },
    { t: ` ${f(p)}` },
  ]);

/** Fußzeilen-Zusatz, solange umgerechnete Punkte im Feld stehen. */
const MIG_FUSS = [...AA_COST, ...AA_SPEED].some((p) => p.mig)
  ? " · ≈ = aus Index v4 umgerechnet"
  : "";

const AA_FOOT_COMMON = `Kosten = Ø Kosten eines Durchlaufs des Intelligence Index (Listenpreis × Tokenverbrauch), kein SWE-Task · Tempo-Halo fehlt bei ${AA_NO_TPS.join(", ")} (kein Messwert) · je Modell die beste Effort-Stufe · Index ≥ ${AA_FLOOR} · 1 USD = 0,876 € · Quadranten redaktionell${MIG_FUSS} · Quelle: `;

const AA_ATTRIBUTION = {
  href: AA_URL,
  label: "artificialanalysis.ai",
} as const;

/**
 * Modelle mit AA-Messwert, die heute kaum jemand buchen kann. Der Absatz der
 * Kostenansicht ergänzt bei ihnen „sofern verfügbar“: sonst liest sich die
 * Front wie eine Auswahl, obwohl die Sprosse nur auf dem Papier steht.
 * gemini-4-argon: nur im Programm „Fairwind“ für Cyber-Defender, ohne
 * Termin für die allgemeine Freigabe (Google-Blog, 30.09.2026).
 */
export const NUR_EINGESCHRAENKT: ReadonlySet<string> = new Set([
  "gemini-4-argon",
]);
const kostenText = (p: Pt) =>
  `${p.eur} € (${dez1(p.y)}${NUR_EINGESCHRAENKT.has(p.label) ? ", sofern verfügbar" : ""})`;

const costFront = paretoFront(AA_COST).front;
const speedFront = paretoFront(AA_SPEED).front;

// --- DesignArena-Skalen ----------------------------------------------------
// Dieselbe Bühne wie AA. Kosten: Mischpreis log von 0,15 $ bis 40 $ (am
// 09.11.2026 0,26 $ bis 20 $), Elo linear von 1115 bis 1470 (Punkte 1200 bis
// 1459; bis 31.10.2026 reichte 1430, dann kam claude-opus-5.5 (high) mit
// 1459). Tempo: Sekunden log von 300 s bis 6 000 s (am 16.11.2026 Punkte
// 445 s bis 3 797 s), Elo wie bei den Kosten 1010 bis 1470. Bis 09.11.2026
// reichte die Achse von 80 s bis 1 000 s und Elo ab 880: Damals trugen nur
// ältere Modelle eine Zeit. Seit 16.11.2026 führt DesignArena sie für fast
// alle Modelle, und die Werte liegen weit höher — bei den 28 Modellen, die
// in beiden Ständen eine Zeit haben, im Median rund 4-mal so hoch (1,4- bis
// 75-mal). Einen Grund nennt die Seite nicht. Unter den Punkten bleibt
// jeweils ein freier Streifen für den Pfeilcluster.
const DA_COST_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 40,
  xLog: { min: 0.15 },
  yMin: 1010,
  yMax: 1470,
});
const DA_SPEED_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 6000,
  xLog: { min: 300 },
  yMin: 1010,
  yMax: 1470,
});
const DA_COST_TICKS = [0.2, 0.5, 1, 2, 5, 10, 20];
/** Sekunden-Positionen, beschriftet in Minuten. */
const DA_SPEED_TICKS = [600, 900, 1200, 1800, 2400, 3600];

const usdT = (p: Pt) => `${p.eur} $`;
const minuten = (s: number) => `${dez1(s / 60)} min`;
const usdTick = (t: number) => `${String(t).replace(".", ",")} $`;

const DA_ATTRIBUTION = { href: DA_URL, label: "designarena.ai" } as const;
const DA_MIX_TEXT = `${MIX.input}:${MIX.output} Input:Output`;

const daCostFront = paretoFront(DA_COST).front;
const daSpeedFront = paretoFront(DA_SPEED).front;

export const VARIANTS: Record<VariantId, ParetoVariant> = {
  "aa-cost": {
    id: "aa-cost",
    source: "aa",
    menu: "Intelligenz × Kosten",
    menuNote: "Intelligence Index × €/Task · Default",
    pts: AA_COST,
    extras: AA_EXTRAS_COST,
    xKind: "cost",
    xInverse: false,
    scale: AA_COST_SCALE,
    xTicks: AA_COST_TICKS,
    xTickLabel: tickLabel,
    yTicks: AA_Y_TICKS,
    yTickLabel: String,
    split: { x: 2, y: 45 },
    quadrants: QUADRANTS as Quadrant[],
    arrows: {
      texts: {
        cheaper: "Billiger",
        stronger: "Leistungsfähiger",
        better: "Besseres Preis-Leistungs-Verhältnis",
      },
      // 16.11.2026: Mit der Skala 0,08–40 € / 24–68 (Fable 5.2 oben, muse-ember
      // unten links) passt nur noch ein Knoten rechts der Front in der Mitte:
      // Gitter 10 × 7 × 5 × 7 über Knoten und Ziel mit denselben Prüfungen wie
      // die Tests (beide Overlay-Zustände, Layout mit und ohne Kontext, Cluster
      // ganz im Plot, über keinem Marker): 35 Treffer, alle mit Knoten
      // (0,5 €, 46) oder (0,5 €, 50). Gewählt (0,5 €, 46) → Ziel (0,13 €, 56).
      //
      // v5 (31.10.2026): Unter dem Knoten vom 28.10. (3 €, 32) liegen jetzt
      // glm-5.3-flash, deepseek-v4.1-flash-1017, step-5 und ling-3.1-flash-1019,
      // unter dem Schaft „Leistungsfähiger“ kimi-k3.1-pro. Gitter 17 × 11 × 17 × 11
      // über Knoten und Ziel (`playwright-tests/pareto-arrow-grid.ts`, dieselben
      // Prüfungen wie die Tests, dazu „ganz im Plot“: „Billiger“ ist fest 250 px
      // lang). Rechts der Front schneidet „Billiger“ die Front zwischen Haiku und
      // Terra; frei ist die leere Ecke links über ihr — Knoten (0,33 €, 43),
      // Ziel (0,08 €, 53,5). Dort zeigen die Pfeile in den Bereich, den kein
      // Modell erreicht, und kreuzen die Front nicht.
      //
      // 23.11.2026, Skala bis 69: Gitter yMax 68–72 × Knoten (0,3–0,8 € ×
      // 42–50) × Ziel (0,10–0,16 € × 52–60), dieselben Prüfungen wie die
      // Tests (dazu die von `labelLayout.test.ts`): 90 Treffer, alle mit yMax
      // 69 und Knoten (0,5 € oder 0,6 €, 48 oder 50), jedes Ziel. Gewählt
      // Knoten (0,5 €, 48), Ziel unverändert.
      hubX: (s) => s.px(0.5),
      hubY: (s) => s.py(48),
      target: (s) => ({ x: s.px(0.13), y: s.py(56) }),
    },
    axisTitle:
      "Ø Kosten pro Task (EUR, log. Skala) — Artificial Analysis Intelligence Index",
    xText: eurT,
    yText: dez1,
    tip: (p) =>
      `${p.label}: Index ${dez1(p.y)} · ${p.eur} €/Task` +
      (p.tps ? ` · ${p.tps} tok/s` : ""),
    yName: "Artificial-Analysis-Intelligence-Index",
    features: {
      subOverlay: true,
      sizeBySpeed: true,
    },
    subTitle:
      "Kontingentrechnung, kein API-Preis: seit 14.09. dauerhaft +25 % ⇒ ×0,8",
    footnote: [
      {
        t: `Artificial Analysis Intelligence Index v5 · Stand ${AA_STAND} · ${AA_FOOT_COMMON}`,
      },
    ],
    attribution: AA_ATTRIBUTION,
    lead: [
      {
        t: "Nimm den billigsten Punkt der Front, der Deine Aufgaben löst",
        b: true,
      },
      {
        t: " — im Zweifel unten anfangen, bei Fehlschlag eine Sprosse höher. ",
      },
      ...leiter(costFront, kostenText),
      {
        t: `. Der Index misst breite Fähigkeit, nicht Coding-Agenten — für Deine Aufgaben kann die Spitze anders aussehen.`,
      },
    ],
    ariaIntro:
      "Streudiagramm Artificial-Analysis-Intelligence-Index gegen Kosten pro Task in Euro, " +
      "x-Achse logarithmisch von 0,08 bis 40 Euro, unterteilt in vier Quadranten: " +
      "Sweet Spot (billig und stark), Leistung um jeden Preis (teuer und stark), Budget-Ecke " +
      "(billig und schwach), Geldverbrennung (teuer und schwach). Stand " +
      AA_STAND,
    ariaFit:
      "Streudiagramm Artificial-Analysis-Intelligence-Index gegen Kosten pro Task in Euro, x-Achse logarithmisch, Achsen an die Auswahl angepasst, die Quadranten-Linien liegen auf dem Median der Auswahl. Stand " +
      AA_STAND,
    ariaTail:
      " Kosten sind der Durchschnitt eines Durchlaufs des Intelligence Index, kein SWE-Task.",
  },

  "aa-speed": {
    id: "aa-speed",
    source: "aa",
    menu: "Intelligenz × Tempo",
    menuNote: "Intelligence Index × Output-Tokens/s",
    pts: AA_SPEED,
    extras: AA_EXTRAS_SPEED,
    xKind: "speed",
    xInverse: true,
    scale: AA_SPEED_SCALE,
    xTicks: TPS_TICKS.map((t) => 1000 / t),
    xTickLabel: (x) => String(Math.round(1000 / x)),
    yTicks: AA_SPEED_Y_TICKS,
    yTickLabel: String,
    split: { x: 1000 / 100, y: 45 },
    quadrants: quadrantsWith({
      sweet: "Schnell & stark",
      price: "Stark, aber langsam",
      budget: "Schnell, aber schwach",
      burn: "Langsam & schwach",
    }),
    arrows: {
      texts: {
        cheaper: "Schneller",
        stronger: "Leistungsfähiger",
        better: "Schneller & stärker",
      },
      // 31.10.2026: Der Knoten rechts bei Index 31,5 lag unter mimo-v2.6-pro,
      // qwen3.8-max und glm-5.3-flash. Dieselbe Gittersuche wie bei aa-cost
      // (xMax 40 für kimi-k3.1-pro): Knoten (19,45 s ≈ 51 tok/s, 42) rechts
      // unter der Front, Ziel (16,85 s ≈ 59 tok/s, 52); „Schneller“ endet bei
      // ≈ 9 s, rechts von allen Frontpunkten unter Index 45.
      // 16.11.2026: muse-ember (2,3 s) und claude-fable-5.2 (Index 64,6)
      // brachten die Skala auf 2–40 s und 24–68; der alte Knoten lag unter
      // muse-wonder und gpt-6.1-sol. Gitter 9 × 7 × 7 × 7 mit denselben
      // Prüfungen wie die Tests: 21 Treffer, alle mit Knoten bei 30 s (≈ 33
      // tok/s). Gewählt Knoten (30 s, 42) → Ziel (20 s, 48).
      // 23.11.2026: Unter diesem Knoten liegen jetzt qwen4-max (neu mit Tempo,
      // 64 tok/s) und kimi-k3.1-pro. Gitter Knoten (4–35 s × 26–46) × Ziel
      // (0,5–0,8 × Knoten-x, +4 bis +10 Punkte): 33 Treffer, 32 davon mit
      // Knoten bei 5 s (≈ 200 tok/s) und Index 42–46, dazu (35 s, 38) am
      // rechten Rand. Verfeinert (4,2–6 s × 40–48): frei sind 4,8–5,6 s bei
      // 42–48. Gewählt die Mitte, Knoten (5 s, 45) → Ziel (3 s, 51): Die
      // Pfeile zeigen in die leere Ecke links oben, wie in der Kostenansicht.
      // Gesucht auf der alten Skala, auf der neuen (18–74, 2,15–34 s) mit
      // denselben Prüfungen nachgeprüft.
      hubX: (s) => s.px(5),
      hubY: (s) => s.py(45),
      target: (s) => ({ x: s.px(3), y: s.py(51) }),
    },
    axisTitle:
      "Ø Output-Tokens/s (Ende zu Ende, log. Skala, links = schneller) — Artificial Analysis Intelligence Index",
    xText: (p) => `${p.tps} tok/s`,
    yText: dez1,
    tip: (p) =>
      `${p.label}: Index ${dez1(p.y)} · ${p.tps} tok/s · ${p.eur} s/1k Tok.`,
    yName: "Artificial-Analysis-Intelligence-Index",
    features: {
      subOverlay: false,
      sizeBySpeed: false,
    },
    subTitle: "",
    footnote: [
      {
        t: `Artificial Analysis Intelligence Index v5 · Stand ${AA_STAND} · Tempo = Ø Output-Tokens/s des Anbieter-Endpunkts, den AA misst, über alle Lastprofile und samt Wartezeit bis zum ersten Token (AA-Methodik seit 03.11.2026) · ohne Messwert fehlen: ${AA_NO_TPS.join(", ")} · je Modell die beste Effort-Stufe · Index ≥ ${AA_FLOOR} · Quadranten redaktionell${MIG_FUSS} · Quelle: `,
      },
    ],
    attribution: AA_ATTRIBUTION,
    lead: [
      { t: "Wo Du wartest, zählt die Front nach Tempo:", b: true },
      { t: " die schnellste Sprosse nehmen, die Deine Aufgaben löst. " },
      ...leiter(
        [...speedFront].reverse(),
        (p) => `${p.tps} tok/s (${dez1(p.y)})`,
      ),
      {
        t: ". Das Tempo hängt am Endpunkt und an der Tageszeit — es ist ein Mittelwert, keine Zusage.",
      },
    ],
    ariaIntro:
      "Streudiagramm Artificial-Analysis-Intelligence-Index gegen Output-Geschwindigkeit in Tokens pro Sekunde, " +
      "x-Achse logarithmisch, schnellere Modelle stehen links, unterteilt in vier Quadranten: " +
      "Schnell und stark, stark aber langsam, schnell aber schwach, langsam und schwach. Stand " +
      AA_STAND,
    ariaFit:
      "Streudiagramm Artificial-Analysis-Intelligence-Index gegen Output-Geschwindigkeit in Tokens pro Sekunde, x-Achse logarithmisch, schnellere Modelle links, Achsen an die Auswahl angepasst, die Quadranten-Linien liegen auf dem Median der Auswahl. Stand " +
      AA_STAND,
    ariaTail: ` Ohne Geschwindigkeitswert fehlen ${AA_NO_TPS.join(" und ")}.`,
  },
  "da-cost": {
    id: "da-cost",
    source: "da",
    menu: "Design-Elo × Preis",
    menuNote: "Elo aus Blind-Votes × Listenpreis je 1M Token",
    pts: DA_COST,
    extras: DA_EXTRAS_COST,
    xKind: "cost",
    xInverse: false,
    scale: DA_COST_SCALE,
    xTicks: DA_COST_TICKS,
    xTickLabel: usdTick,
    yTicks: [1200, 1250, 1300, 1350, 1400, 1450],
    yTickLabel: String,
    split: { x: 3.5, y: 1275 },
    quadrants: QUADRANTS as Quadrant[],
    arrows: {
      texts: {
        cheaper: "Billiger",
        stronger: "Beliebter",
        better: "Besseres Preis-Leistungs-Verhältnis",
      },
      // Unter allen Punkten (tiefster 1200) und links der Quadranten-Überschrift
      // „Geldverbrennung“, ohne dass sich die Beschriftungen der Pfeile berühren:
      // Gitter über yMin × Knoten × Ziel (09.11.2026), mit Kasten-Test gegen Marker
      // und Überschriften und einem Textmodell für „Billiger“ gegen die Diagonale.
      // Die Diagonale braucht mindestens ≈ 8° Neigung, sonst liegt ihr Text über
      // „Billiger“ (bei 1140/1160 gemessen: Überdeckung); so steil passt sie nur in
      // ein Band unter den Punkten, deshalb yMin 1010 statt 1115. Gemessen in
      // Chromium, Firefox und WebKit, hell und dunkel: 4 px Luft zwischen beiden Texten.
      // 23.11.2026: glm-5.2 (1201) liegt erstmals über dem Boden, bei 2,15 $
      // direkt unter der Diagonale zum Ziel (2 $, 1154). Gitter Ziel (1–4 $ ×
      // 1100–1185) beim alten Knoten: 21 Treffer. Gewählt (2,5 $, 1154) — die
      // Diagonale steigt damit mit 11,8° statt 10,5°, also steiler als die
      // 8°, unter denen ihr Text „Billiger“ berührt.
      hubX: (s) => s.px(16),
      hubY: (s) => s.py(1048),
      target: (s) => ({ x: s.px(2.5), y: s.py(1154) }),
    },
    axisTitle: `Listenpreis je 1M Token (USD, ${DA_MIX_TEXT} gemischt, log. Skala) — DesignArena-Elo`,
    xText: usdT,
    yText: String,
    tip: (p) => `${p.label}: Elo ${p.y} · ${p.eur} $ je 1M Token`,
    yName: "DesignArena-Elo",
    features: { subOverlay: false, sizeBySpeed: false },
    subTitle: "",
    footnote: [
      {
        t: `DesignArena Overall Agentic · Stand ${DA_STAND} · Elo = Bradley-Terry aus Blind-Duellen (Gefallen, nicht Korrektheit) · Preis = Listenpreis ${DA_MIX_TEXT}, kein Verbrauch pro Task · je Modell die beste Stufe · Elo ≥ ${DA_FLOOR.cost} · Quadranten redaktionell · Quelle: `,
      },
    ],
    attribution: DA_ATTRIBUTION,
    lead: [
      { t: "Die zweite Meinung: Menschen statt Benchmark.", b: true },
      { t: " Wer im Blind-Vergleich gewinnt, für welchen Listenpreis — " },
      ...leiter(daCostFront, (p) => `${p.eur} $ (${p.y})`),
      {
        t: ". Der Preis je Token sagt nichts über den Verbrauch: ein gesprächiges Modell kostet pro Aufgabe mehr, als sein Platz hier verrät.",
      },
    ],
    ariaIntro:
      "Streudiagramm DesignArena-Elo gegen Listenpreis je Million Token in US-Dollar, " +
      `Input und Output ${DA_MIX_TEXT} gemischt, x-Achse logarithmisch von 0,15 bis 40 Dollar, unterteilt in vier Quadranten. Stand ` +
      DA_STAND,
    ariaFit:
      "Streudiagramm DesignArena-Elo gegen Listenpreis je Million Token in US-Dollar, x-Achse logarithmisch, Achsen an die Auswahl angepasst, die Quadranten-Linien liegen auf dem Median der Auswahl. Stand " +
      DA_STAND,
    ariaTail:
      " Der Elo stammt aus Blind-Duellen, in denen Menschen das gefälligere Ergebnis wählen; der Preis ist ein Listenpreis, kein Verbrauch pro Aufgabe.",
  },

  "da-speed": {
    id: "da-speed",
    source: "da",
    menu: "Design-Elo × Tempo",
    menuNote: "Elo aus Blind-Votes × Ø Generierungszeit",
    pts: DA_SPEED,
    extras: DA_EXTRAS_SPEED,
    xKind: "speed",
    xInverse: false,
    scale: DA_SPEED_SCALE,
    xTicks: DA_SPEED_TICKS,
    // Feste Ticks sind ganze Minuten; bei angepassten Achsen wählt `fitScale`
    // runde SEKUNDEN (100, 200, 500) — die dürfen nicht auf Minuten gerundet
    // werden, sonst stünde „2 min“ bei 100 s.
    xTickLabel: (x) =>
      Number.isInteger(x / 60) ? `${x / 60} min` : minuten(x),
    yTicks: [1200, 1250, 1300, 1350, 1400, 1450],
    yTickLabel: String,
    split: { x: 1200, y: 1275 },
    quadrants: quadrantsWith({
      sweet: "Schnell & beliebt",
      price: "Beliebt, aber langsam",
      budget: "Schnell, aber unbeliebt",
      burn: "Langsam & unbeliebt",
    }),
    arrows: {
      texts: {
        cheaper: "Schneller",
        stronger: "Beliebter",
        better: "Schneller & beliebter",
      },
      // Unter allen Punkten (Boden 1200 seit 16.11.2026), Knoten rechts wie bei
      // da-cost. Gitter über Knoten (350–5000 s × 1030–1100) × Ziel (320–1000 s
      // × 1080–1190), mit Kasten-Test gegen Marker, Quadranten-Überschriften
      // und Labels: Es passen nur Knoten bei 3000–5000 s und 1070–1100; links
      // kreuzt „Schneller & beliebter“ Punkte oder „Schnell, aber unbeliebt“.
      // Gewählt die Mitte der freien Fläche (16.11.2026).
      // 23.11.2026: glm-5.2 (1201, 46 min) liegt jetzt über dem Boden, direkt
      // unter „Beliebter“ am Knoten 3000 s. Gitter Knoten (2000–5500 s ×
      // 1030–1100) × Ziel (320–1000 s × 1080–1190): frei sind 2000–2400 s bei
      // 1040–1060 und 3500–5500 s bei 1080–1100. Gewählt die Mitte des
      // größeren Felds, Knoten (4500 s, 1090), Ziel unverändert.
      hubX: (s) => s.px(4500),
      hubY: (s) => s.py(1090),
      target: (s) => ({ x: s.px(450), y: s.py(1120) }),
    },
    axisTitle:
      "Ø Generierungszeit (log. Skala, links = schneller) — DesignArena-Elo",
    xText: (p) => minuten(p.x),
    yText: String,
    tip: (p) => `${p.label}: Elo ${p.y} · ${minuten(p.x)} je Generierung`,
    yName: "DesignArena-Elo",
    features: { subOverlay: false, sizeBySpeed: false },
    subTitle: "",
    footnote: [
      {
        t: `DesignArena Overall Agentic · Stand ${DA_STAND} · Tempo = Ø Zeit einer Generierung · `,
      },
      DA_NO_TIME.length
        ? {
            t: `${DA_NO_TIME.length} Modelle der Preisansicht ohne Zeitangabe (Hover)`,
            title: DA_NO_TIME.join(", "),
          }
        : { t: "jedes Modell der Preisansicht hat eine Zeitangabe" },
      {
        t: ` · je Modell die beste Stufe · Elo ≥ ${DA_FLOOR.speed} · Quadranten redaktionell · Quelle: `,
      },
    ],
    attribution: DA_ATTRIBUTION,
    lead: [
      { t: "Tempo heißt hier: Ø Zeit einer Generierung.", b: true },
      {
        t: ` ${DA_COST.length - DA_NO_TIME.length} der ${DA_COST.length} Modelle der Preisansicht haben eine. Die Front: `,
      },
      ...leiter(daSpeedFront, (p) => `${minuten(p.x)} (${p.y})`),
      {
        t: ". Seit dem Stand vom 16.11.2026 liegen die Zeiten weit über den früheren; vergleichbar sind nur Werte desselben Stands.",
      },
    ],
    ariaIntro:
      "Streudiagramm DesignArena-Elo gegen durchschnittliche Generierungszeit, " +
      "x-Achse logarithmisch von 5 Minuten bis 100 Minuten, schnellere Modelle stehen links, unterteilt in vier Quadranten. Stand " +
      DA_STAND,
    ariaFit:
      "Streudiagramm DesignArena-Elo gegen durchschnittliche Generierungszeit, x-Achse logarithmisch, schnellere Modelle links, Achsen an die Auswahl angepasst, die Quadranten-Linien liegen auf dem Median der Auswahl. Stand " +
      DA_STAND,
    ariaTail: ` Von den ${DA_COST.length} Modellen der Preisansicht haben ${DA_NO_TIME.length} keine Zeitangabe, darunter alle neuen; sie fehlen hier.`,
  },
};

export const VARIANT_ORDER: readonly VariantId[] = [
  "aa-cost",
  "aa-speed",
  "da-cost",
  "da-speed",
];
export const DEFAULT_VARIANT: VariantId = "aa-cost";

/** Die Front einer Variante als Text — für die aria-Beschreibung. */
export const frontSentence = (v: ParetoVariant, front: Pt[]) =>
  front
    .map(
      (p, i) =>
        `Sprosse ${i + 1}: ${p.label} mit ${v.yText(p.y)} für ${v.xText(p)}`,
    )
    .join(". ");
