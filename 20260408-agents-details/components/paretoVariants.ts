// Die beiden Ansichten der Folie „Welches Modell wofür?“. Jede Variante bündelt
// alles, was sich zwischen ihnen unterscheidet — Punkte, Skala, Ticks,
// Quadranten, Pfeiltexte, Legenden- und Tooltip-Formate, Fußzeile und den
// Empfehlungsabsatz. `ParetoChart.vue` zeichnet nur noch, was hier steht, und
// wird pro Variante neu gemountet (`:key`): Skala, Pfeilcluster und Entzerrung
// sind Setup-Konstanten der Komponente, nicht reaktiv.
//
//   aa-cost   Artificial-Analysis-Intelligence-Index × €/Task   (Default)
//   aa-speed  derselbe Index × Output-Tokens/s
//
// DeepSWE war bis Oktober 2026 die dritte Ansicht. Das Board wird nicht mehr
// gepflegt; seine Daten leben nur noch auf der Historien-Folie
// (`ModelRoutingHistory.vue`, `paretoData.ts`).
//
// Beide folgen „kleiner x ist besser, größerer y ist besser“ — `paretoFront`,
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
import { makeScale, paretoFront, type Pt, type Scale } from "./paretoData";
import {
  quadrantsWith,
  QUADRANTS,
  tickLabel,
  type Quadrant,
} from "./paretoChrome";
import type { XY } from "./labelLayout";

export type VariantId = "aa-cost" | "aa-speed";

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
   * geschätztem Index (`aaExtras.ts`).
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
// Kosten log von 0,04 € bis 10 € (am 28.10.2026 kleinster Punkt 0,11 €, größter
// 9,54 €), der Index (v5) linear von 22 bis 62 (Punkte 25,3 bis 58,4). Ein
// yMin > 0 spart die untere Hälfte der Achse, in der kein Modell liegt.
const AA_BASE = { W: 932, L: 46, R: 10, T: 10, H: 306, B: 33 } as const;
const AA_COST_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 10,
  xLog: { min: 0.04 },
  yMin: 22,
  yMax: 62,
});
// x = 1000/tps: am 28.10.2026 4,2 s (241 tok/s) bis 24,5 s (41 tok/s) je 1 000 Tokens.
const AA_SPEED_SCALE: Scale = makeScale({
  ...AA_BASE,
  xMax: 30,
  xLog: { min: 3 },
  yMin: 22,
  yMax: 62,
});

const AA_COST_TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];
const AA_Y_TICKS = [25, 30, 35, 40, 45, 50, 55, 60];
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
      // v5 (28.10.2026): Rechts stehen Opus, Sonnet und Fable übereinander,
      // unten rechts glm-5.3, qwen3.8-2.4t, gemini-3.8-flash und grok-4.7. Am
      // Rand fand sich keine Lage ohne verdeckten Marker. Per Suche über Knoten
      // (x, y) und Ziel: Knoten bei (4 €, 34), Ziel (0,7 €, 40) — kein Marker
      // unter einem Schaft, jedes Label hat Platz, der Text der Diagonale passt,
      // und sie bleibt unter der Front (ein höheres Ziel schnitte sie).
      hubX: (s) => s.px(4),
      hubY: (s) => s.py(34),
      target: (s) => ({ x: s.px(0.7), y: s.py(40) }),
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
};

export const VARIANT_ORDER: readonly VariantId[] = ["aa-cost", "aa-speed"];
export const DEFAULT_VARIANT: VariantId = "aa-cost";

/** Die Front einer Variante als Text — für die aria-Beschreibung. */
export const frontSentence = (v: ParetoVariant, front: Pt[]) =>
  front
    .map(
      (p, i) =>
        `Sprosse ${i + 1}: ${p.label} mit ${v.yText(p.y)} für ${v.xText(p)}`,
    )
    .join(". ");
