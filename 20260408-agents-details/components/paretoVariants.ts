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
// Kosten log von 0,04 € bis 22 € (am 31.10.2026 kleinster Punkt 0,11 €, größter
// 9,50 €; der Rand rechts gibt den Labels von Carbon und Opus Platz), der
// Index (v5) linear von 22 bis 64 (Punkte 26,0 bis 59,4). Ein
// yMin > 0 spart die untere Hälfte der Achse, in der kein Modell liegt.
const AA_BASE = { W: 932, L: 46, R: 10, T: 10, H: 306, B: 33 } as const;
const AA_COST_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 22,
  xLog: { min: 0.04 },
  yMin: 22,
  yMax: 64,
});
// x = 1000/tps: am 31.10.2026 4,3 s (235 tok/s) bis 32,4 s (31 tok/s,
// kimi-k3.1-pro) je 1 000 Tokens.
const AA_SPEED_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 40,
  xLog: { min: 3 },
  yMin: 22,
  yMax: 62,
});

const AA_COST_TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const AA_Y_TICKS = [25, 30, 35, 40, 45, 50, 55, 60];
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
// 31.10.2026 0,26 $ bis 20 $), Elo linear von 1125 bis 1430 (Punkte 1202 bis
// 1408). Tempo: Sekunden log von 80 s bis 1 000 s (Punkte 112 s bis 772 s),
// Elo 880 bis 1300 (Punkte 1011 bis 1271) — der Boden liegt dort tiefer, weil
// nur ältere Modelle eine Zeit tragen (`daData.ts`). Unter den Punkten bleibt
// jeweils ein freier Streifen für den Pfeilcluster.
const DA_COST_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 40,
  xLog: { min: 0.15 },
  yMin: 1125,
  yMax: 1430,
});
const DA_SPEED_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 1000,
  xLog: { min: 80 },
  yMin: 880,
  yMax: 1300,
});
const DA_COST_TICKS = [0.2, 0.5, 1, 2, 5, 10, 20];
/** Sekunden-Positionen, beschriftet in Minuten. */
const DA_SPEED_TICKS = [120, 180, 300, 480, 720];

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
      // v5 (31.10.2026): Unter dem Knoten vom 28.10. (3 €, 32) liegen jetzt
      // glm-5.3-flash, deepseek-v4.1-flash-1017, step-5 und ling-3.1-flash-1019,
      // unter dem Schaft „Leistungsfähiger“ kimi-k3.1-pro. Gitter 17 × 11 × 17 × 11
      // über Knoten und Ziel (`playwright-tests/pareto-arrow-grid.ts`, dieselben
      // Prüfungen wie die Tests, dazu „ganz im Plot“: „Billiger“ ist fest 250 px
      // lang). Rechts der Front schneidet „Billiger“ die Front zwischen Haiku und
      // Terra; frei ist die leere Ecke links über ihr — Knoten (0,33 €, 43),
      // Ziel (0,08 €, 53,5). Dort zeigen die Pfeile in den Bereich, den kein
      // Modell erreicht, und kreuzen die Front nicht.
      hubX: (s) => s.px(0.33),
      hubY: (s) => s.py(43),
      target: (s) => ({ x: s.px(0.08), y: s.py(53.5) }),
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
      "x-Achse logarithmisch von 0,04 bis 22 Euro, unterteilt in vier Quadranten: " +
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
    yTicks: AA_Y_TICKS,
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
      hubX: (s) => s.px(19.45),
      hubY: (s) => s.py(42),
      target: (s) => ({ x: s.px(16.85), y: s.py(52) }),
    },
    axisTitle:
      "Ø Output-Tokens/s (Median, log. Skala, links = schneller) — Artificial Analysis Intelligence Index",
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
        t: `Artificial Analysis Intelligence Index v5 · Stand ${AA_STAND} · Tempo = Median der Output-Tokens/s des Anbieter-Endpunkts, den AA misst · ohne Messwert fehlen: ${AA_NO_TPS.join(", ")} · je Modell die beste Effort-Stufe · Index ≥ ${AA_FLOOR} · Quadranten redaktionell${MIG_FUSS} · Quelle: `,
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
        t: ". Das Tempo hängt am Endpunkt und an der Tageszeit — es ist ein Median, keine Zusage.",
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
    yTicks: [1200, 1250, 1300, 1350, 1400],
    yTickLabel: String,
    split: { x: 3.5, y: 1275 },
    quadrants: QUADRANTS as Quadrant[],
    arrows: {
      texts: {
        cheaper: "Billiger",
        stronger: "Beliebter",
        better: "Besseres Preis-Leistungs-Verhältnis",
      },
      // Unter allen Punkten (tiefster 1202) und links der Quadranten-Überschrift
      // „Geldverbrennung“: per Gitter aus Knoten × Ziel gesucht, kein Label,
      // kein Marker und keine Überschrift unter einem Schaft (31.10.2026). yMin
      // 1125 statt 1140, Knoten 1145: Beim alten Knoten 1150 ragte die Spitze von
      // „Billiger“ 8 px unter den Plot, ein höherer legte die Diagonale auf ihn.
      hubX: (s) => s.px(8),
      hubY: (s) => s.py(1145),
      target: (s) => ({ x: s.px(2), y: s.py(1172) }),
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
    yTicks: [1000, 1050, 1100, 1150, 1200, 1250],
    yTickLabel: String,
    split: { x: 300, y: 1125 },
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
      // Ebenso unter allen Punkten (tiefster 1011) und mittig, weil rechts unten
      // Punkte und die Überschrift „Langsam & unbeliebt“ stehen. yMin 880 statt
      // 900 und Knoten 910, aus demselben Grund wie bei da-cost.
      hubX: (s) => s.px(350),
      hubY: (s) => s.py(910),
      target: (s) => ({ x: s.px(160), y: s.py(945) }),
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
      {
        t: `${DA_NO_TIME.length} Modelle der Preisansicht ohne Zeitangabe, darunter alle neuen (Hover)`,
        title: DA_NO_TIME.join(", "),
      },
      {
        t: ` · je Modell die beste Stufe · Elo ≥ ${DA_FLOOR.speed} · Quadranten redaktionell · Quelle: `,
      },
    ],
    attribution: DA_ATTRIBUTION,
    lead: [
      { t: "Tempo misst DesignArena nur für ältere Modelle:", b: true },
      {
        t: ` ${DA_NO_TIME.length} der ${DA_COST.length} Modelle der Preisansicht haben keine Zeit, die Spitze fehlt ganz. Was bleibt: `,
      },
      ...leiter(daSpeedFront, (p) => `${minuten(p.x)} (${p.y})`),
      { t: ". Ein Stand der Generation davor, keine Empfehlung für heute." },
    ],
    ariaIntro:
      "Streudiagramm DesignArena-Elo gegen durchschnittliche Generierungszeit, " +
      "x-Achse logarithmisch von 80 Sekunden bis 1000 Sekunden, schnellere Modelle stehen links, unterteilt in vier Quadranten. Stand " +
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
