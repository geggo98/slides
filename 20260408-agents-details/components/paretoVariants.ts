// Die drei Ansichten der Folie „Welches Modell wofür?“. Jede Variante bündelt
// alles, was sich zwischen ihnen unterscheidet — Punkte, Skala, Ticks,
// Quadranten, Pfeiltexte, Legenden- und Tooltip-Formate, Fußzeile und den
// Empfehlungsabsatz. `ParetoChart.vue` zeichnet nur noch, was hier steht, und
// wird pro Variante neu gemountet (`:key`): Skala, Pfeilcluster und Entzerrung
// sind Setup-Konstanten der Komponente, nicht reaktiv.
//
//   aa-cost   Artificial-Analysis-Intelligence-Index × €/Task   (Default)
//   aa-speed  derselbe Index × Output-Tokens/s
//   deepswe   DeepSWE Pass@1 × €/Task                          (der bisherige Stand)
//
// Alle drei folgen „kleiner x ist besser, größerer y ist besser“ — `paretoFront`,
// Quadranten und Pfeile brauchen dadurch keinen Richtungsparameter. Bei
// `aa-speed` ist x deshalb die Zeit je 1 000 Tokens (`aaData.ts`), und nur die
// Tick-Beschriftung spricht von tok/s.

import { AA_COST, AA_NO_TPS, AA_SPEED, AA_STAND, AA_URL } from "./aaData";
import { AA_EXTRAS_COST, AA_EXTRAS_SPEED } from "./aaExtras";
import {
  CURRENT,
  makeScale,
  paretoFront,
  tip,
  type Pt,
  type Scale,
} from "./paretoData";
import {
  PARETO_SCALE,
  quadrantsWith,
  QUADRANTS,
  tickLabel,
  X_TICKS_LOG,
  Y_TICKS,
  type Quadrant,
} from "./paretoChrome";
import type { XY } from "./labelLayout";

export type VariantId = "aa-cost" | "aa-speed" | "deepswe";

/** Ein Stück Fließtext; `b` = fett. Die Komponente setzt daraus <strong>. */
export interface Seg {
  t: string;
  b?: boolean;
  /** Hover-Text, z. B. die Liste der Modelle ohne Wert. */
  title?: string;
}

export interface ParetoVariant {
  id: VariantId;
  /** Menüzeile. */
  menu: string;
  /** Zweite Menüzeile, klein. */
  menuNote: string;
  pts: Pt[];
  /**
   * Modelle, die nur ein Produkt-Preset einblendet: ältere, abgekündigte, mit
   * geschätztem Index (`aaExtras.ts`). Leer bei DeepSWE — das Board misst nur sein
   * eigenes Feld.
   */
  extras: Pt[];
  /** Bedeutung der x-Achse für das Anpassen der Skala (`paretoGeometry.ts`). */
  xKind: "cost" | "speed";
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
    /** Fehlerbalken und ±-Badges (nur DeepSWE führt ein Konfidenzintervall). */
    ci: boolean;
    /** Claude-Code-Kontingent-Schalter (Claude-Punkte × Faktor). */
    subOverlay: boolean;
    /** Geisterring für die künftigen Preise (Gemini-Listenpreis, Kontingent). */
    priceGhost: boolean;
    /** Schalter „Tempo als Größe“. */
    sizeBySpeed: boolean;
  };
  /** Beschriftung des Kontingent-Schalters (Tooltip). */
  subTitle: string;
  /** Legende-Eintrag für den Geisterring ohne / mit Kontingent-Overlay. */
  ghostLegend: [string, string];
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
// Dieselbe Bühne wie die DeepSWE-Folie (932 × 306), nur andere Achsen:
// Kosten log von 0,04 € bis 10 € (kleinster Punkt 0,05 €, größter 6,68 €), der
// Index linear von 28 bis 62 (Punkte 33,7 bis 57,6). Ein yMin > 0 spart die
// untere Hälfte der Achse, in der kein Modell liegt.
const AA_BASE = { W: 932, L: 46, R: 10, T: 10, H: 306, B: 33 } as const;
const AA_COST_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 10,
  xLog: { min: 0.04 },
  yMin: 28,
  yMax: 62,
});
// x = 1000/tps: 4,2 s (239 tok/s) bis 25,8 s (39 tok/s) je 1 000 Tokens.
const AA_SPEED_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 30,
  xLog: { min: 3 },
  yMin: 28,
  yMax: 62,
});

const AA_COST_TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];
const AA_Y_TICKS = [30, 35, 40, 45, 50, 55, 60];
/** tok/s-Ticks von schnell nach langsam — in x-Koordinaten 1000/t. */
const TPS_TICKS = [300, 200, 100, 60, 40];

/** Vorderste Sprossen einer Variante — für Lead-Text und Tests. */
export const frontOf = (v: Pick<ParetoVariant, "pts">) =>
  paretoFront(v.pts).front;

const leiter = (pts: Pt[], f: (p: Pt) => string): Seg[] =>
  pts.flatMap((p, i) => [
    ...(i ? [{ t: " → " }] : []),
    { t: p.label, b: true },
    { t: ` ${f(p)}` },
  ]);

const AA_FOOT_COMMON = `Kosten = Ø Kosten eines Durchlaufs des Intelligence Index (Listenpreis × Tokenverbrauch), kein SWE-Task · Tempo-Halo fehlt bei ${AA_NO_TPS.join(", ")} (kein Messwert) · je Modell die beste Effort-Stufe · Index ≥ 30 · 1 USD = 0,876 € · Quadranten redaktionell · Quelle: `;

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
const NUR_EINGESCHRAENKT = new Set(["gemini-4-argon"]);
const kostenText = (p: Pt) =>
  `${p.eur} € (${dez1(p.y)}${NUR_EINGESCHRAENKT.has(p.label) ? ", sofern verfügbar" : ""})`;

const costFront = paretoFront(AA_COST).front;
const speedFront = paretoFront(AA_SPEED).front;

export const VARIANTS: Record<VariantId, ParetoVariant> = {
  "aa-cost": {
    id: "aa-cost",
    menu: "Intelligenz × Kosten",
    menuNote: "Artificial Analysis · Default",
    pts: AA_COST,
    extras: AA_EXTRAS_COST,
    xKind: "cost",
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
      target: (s) => ({ x: s.px(3), y: s.py(38) }),
      hubY: (s) => s.py(31.5),
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
      ci: false,
      subOverlay: true,
      priceGhost: false,
      sizeBySpeed: true,
    },
    subTitle:
      "Kontingentrechnung, kein API-Preis: seit 14.09. dauerhaft +25 % ⇒ ×0,8",
    ghostLegend: ["", ""],
    footnote: [
      {
        t: `Artificial Analysis Intelligence Index · Stand ${AA_STAND} · ${AA_FOOT_COMMON}`,
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
        t: `. Der Index misst breite Fähigkeit, nicht Coding-Agenten — die DeepSWE-Ansicht ordnet die Spitze deshalb anders.`,
      },
    ],
    ariaIntro:
      "Streudiagramm Artificial-Analysis-Intelligence-Index gegen Kosten pro Task in Euro, " +
      "x-Achse logarithmisch von 0,04 bis 10 Euro, unterteilt in vier Quadranten: " +
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
    menu: "Intelligenz × Tempo",
    menuNote: "Artificial Analysis · Output-Tokens/s",
    pts: AA_SPEED,
    extras: AA_EXTRAS_SPEED,
    xKind: "speed",
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
      // In Pixeln vom Hub aus: eine Lücke zwischen qwen3.8-27b (43 tok/s, 33,7) und
      // mimo-v2.6-pro (41 tok/s, 46,3); ein Datenziel läge quer über einem von beiden.
      target: (s) => ({ x: s.W - s.R - 26 - 150, y: s.py(31.5) - 60 }),
      hubY: (s) => s.py(31.5),
    },
    axisTitle:
      "Ø Output-Tokens/s (Median, log. Skala, links = schneller) — Artificial Analysis Intelligence Index",
    xText: (p) => `${p.tps} tok/s`,
    yText: dez1,
    tip: (p) =>
      `${p.label}: Index ${dez1(p.y)} · ${p.tps} tok/s · ${p.eur} s/1k Tok.`,
    yName: "Artificial-Analysis-Intelligence-Index",
    features: {
      ci: false,
      subOverlay: false,
      priceGhost: false,
      sizeBySpeed: false,
    },
    subTitle: "",
    ghostLegend: ["", ""],
    footnote: [
      {
        t: `Artificial Analysis Intelligence Index · Stand ${AA_STAND} · Tempo = Median der Output-Tokens/s des Anbieter-Endpunkts, den AA misst · ohne Messwert fehlen: ${AA_NO_TPS.join(", ")} · je Modell die beste Effort-Stufe · Index ≥ 30 · Quadranten redaktionell · Quelle: `,
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

  deepswe: {
    id: "deepswe",
    menu: "DeepSWE × Kosten",
    menuNote: "Coding-Benchmark · Stand 03.09.",
    pts: CURRENT,
    extras: [],
    xKind: "cost",
    scale: PARETO_SCALE,
    xTicks: X_TICKS_LOG,
    xTickLabel: tickLabel,
    yTicks: Y_TICKS,
    yTickLabel: (y) => `${y} %`,
    split: { x: 8, y: 50 },
    quadrants: QUADRANTS as Quadrant[],
    arrows: {
      texts: {
        cheaper: "Billiger",
        stronger: "Leistungsfähiger",
        better: "Besseres Preis-Leistungs-Verhältnis",
      },
    },
    axisTitle: "Ø Kosten pro Task (EUR, log. Skala) — DeepSWE Pass@1 (%)",
    xText: eurT,
    yText: (y) => `${y} %`,
    tip,
    yName: "DeepSWE-Score",
    features: {
      ci: true,
      subOverlay: true,
      priceGhost: true,
      sizeBySpeed: false,
    },
    subTitle:
      "Kontingentrechnung, kein API-Preis: ×2/3 bis 13.09., ab 14.09. ×0,8",
    ghostLegend: ["Preis ab 01.01.2027", "künftig: ab 01.01. / 14.09."],
    footnote: [
      {
        t: "DeepSWE v1.1 · 113 Tasks · mini-swe-agent · pass@1 · Datacurve 03.09. · 1 USD = 0,876 € · Board-Default + terra · Quadranten redaktionell",
      },
    ],
    lead: [
      {
        t: "Nimm den billigsten Punkt der Front, der Deine Aufgaben löst",
        b: true,
      },
      {
        t: " — im Zweifel unten anfangen, bei Fehlschlag eine Sprosse höher. ",
      },
      { t: "glm-5.3-flash", b: true },
      { t: " 0,21 € (63 %) → " },
      { t: "gpt-5.6-luna", b: true },
      { t: " 0,53 € (67 %) → " },
      { t: "gemini-3.8-flash", b: true },
      {
        t: " 2,07 € (74 %). Alle drei zusammen: 2,81 €, gut ein Viertel eines Laufs mit Opus 5 (10,37 €) — der nicht mehr löst als Sprosse 3. Was Du wählen kannst, hängt am Werkzeug (Filter oben): bei JetBrains AI sind es vier Sprossen bis 10,37 €.",
      },
    ],
    ariaIntro:
      "Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, x-Achse logarithmisch " +
      "von 0,1 bis 30 Euro, unterteilt in vier Quadranten: " +
      "Sweet Spot (billig und stark), Leistung um jeden Preis (teuer und stark), Budget-Ecke " +
      "(billig und schwach), Geldverbrennung (teuer und schwach). Stand 03.09.2026",
    ariaFit:
      "Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, x-Achse logarithmisch, Achsen an die Auswahl angepasst, die Quadranten-Linien liegen auf dem Median der Auswahl. Stand 03.09.2026",
    ariaTail:
      " gpt-6-astra mit 5,71 Euro hat mit 74,12 Prozent den höchsten Rohwert des Boards und liegt " +
      "trotzdem nicht auf der Front — gemini-3.8-flash erreicht denselben gerundeten Wert für 2,07 Euro." +
      " Der Geisterring an gemini-3.8-flash markiert 4,14 Euro — den Listenpreis ab dem " +
      "1. Januar 2027, wenn Googles Einführungspreis ausläuft.",
  },
};

export const VARIANT_ORDER: readonly VariantId[] = [
  "aa-cost",
  "aa-speed",
  "deepswe",
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
