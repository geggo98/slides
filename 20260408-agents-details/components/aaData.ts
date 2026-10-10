// Datenbasis der Varianten `aa-cost` und `aa-speed` des Modell-Routing-Charts:
// Artificial Analysis Intelligence Index gegen Kosten pro Task bzw. gegen
// Output-Geschwindigkeit. `paretoVariants.ts` fasst sie mit der DeepSWE-Variante
// zusammen, `ModelRoutingPareto.vue` schaltet zwischen ihnen um.
//
// Herkunft
// --------
// https://artificialanalysis.ai/leaderboards/models, Stand 01.10.2026. Die Rohdaten
// liegen als Archiv unter `data/artificialanalysis/` (`fetch.ts` erklärt, wie
// sie aus der Seite kommen und warum nicht aus der API). Hier steht nur, was
// daraus wird. Attribution laut AA-Bedingungen: Link auf artificialanalysis.ai
// — sie steht in der Fußzeile der Folie und im ⓘ-Dialog.
//
// Was „Kosten pro Task“ hier heißt
// --------------------------------
// `intelligenceIndexCostPerTask` ist der Durchschnitt über die Aufgaben des
// Intelligence Index: Tokenverbrauch des Modells × Listenpreis, in USD. Ein
// Task ist dort eine Eval-Aufgabe (Wissen, Logik, Agenten-Aufgaben im Mix), KEIN
// SWE-Task wie bei DeepSWE. Die €-Werte beider Varianten sind deshalb nicht
// vergleichbar, und die Folie sagt es.
//
// Auswahlregel: je Modell die BESTE gemessene Konfiguration
// ---------------------------------------------------------
// AA führt jede Effort-Stufe als eigenen Eintrag (`gpt-6-astra-xhigh`,
// `claude-opus-5-5-high` …); die höchste Stufe trägt den nackten Slug. Wie bei
// DeepSWE (`bestByScore` in `paretoData.ts`) zählt je Modell die Stufe mit dem
// höchsten Index, bei Gleichstand die billigere. Wer stattdessen die höchste
// Stufe nähme, zeigte Modelle von ihrer teuren Seite: gpt-6-astra max kostet
// 3,26 $ für 52,7 gegen 2,31 $ für 52,4 auf xhigh.
//
// Was zur selben Konfigurationsfamilie gehört, entscheidet der NAME, nicht der
// Slug: `qwen3-8-max` ist ein Modell (Qwen3.8 Max) und keine max-Stufe von
// „qwen3-8“. Ein Suffix fällt nur weg, wenn der Name dieselbe Stufe in seiner
// Klammer nennt.
//
// Boden: Index ≥ 30. Darunter stehen Modelle, die als Routing-Kandidaten keine
// Rolle spielen und das Chart auf 40 Punkte aufblähen würden.

import raw from "../data/artificialanalysis/board-20261001-ae520e03.json";
import { P, type Pt } from "./paretoData";

export const AA_STAND = "01.10.2026";
export const AA_URL = "https://artificialanalysis.ai/leaderboards/models";
/** Wie bei DeepSWE: ein fester Kurs (Stand 21.07.2026), keine Kursbewegung. */
export const USD_EUR = 0.876;
export const AA_FLOOR = 30;
/** Claude-Code-Kontingent ab 14.09.2026: dauerhaft +25 % ⇒ €/Task × 0,8. */
export const SUB_FACTOR = 0.8;

export interface Row {
  slug: string;
  name: string;
  deprecated: boolean | null;
  modelCreatorName: string | null;
  intelligenceIndex: number | null;
  intelligenceIndexIsEstimated: boolean | null;
  intelligenceIndexCostPerTask: number | null;
  medianOutputTokensPerSecond: number | null;
}

/** Eine gemessene Konfiguration (Modell × Effort-Stufe) mit Rohwerten. */
export interface AaCfg {
  /** Slug der Konfiguration, wie AA ihn führt. */
  slug: string;
  /** Slug der Modellfamilie ohne Effort-Suffix. */
  model: string;
  label: string;
  effort: string | null;
  creator: string;
  /** Intelligence Index, ungerundet. */
  index: number;
  /** USD je Task, wie AA es führt. */
  usd: number;
  tps: number | null;
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

/** Stufe aus der Klammer des Namens — „(xhigh)“, „(…, Max Effort, …)“. */
export function effortOf(name: string): string | null {
  const klammer = name.slice(name.indexOf("("));
  if (!klammer.startsWith("(")) return null;
  const m = /\b(low|medium|high|xhigh|max)\b(?: effort)?\s*[,)]/i.exec(klammer);
  return m ? m[1]!.toLowerCase() : null;
}

export function modelSlug(slug: string, name: string): string {
  const e = effortOf(name);
  return e && slug.endsWith(`-${e}`) ? slug.slice(0, -(e.length + 1)) : slug;
}

// Ziffer-Bindestrich-Ziffer ⇒ Punkt: `gpt-6-1-sol` → `gpt-6.1-sol`. Deutsche
// Slugs mit echtem Bindestrich zwischen Ziffern gibt es im Datensatz nicht; der
// Test hält die Labels gegen Doppelungen.
const OVERRIDES: Readonly<Record<string, string>> = {
  "qwen3-8-2-4t-a95b": "qwen3.8-2.4t",
};
export function labelOf(model: string): string {
  const o = OVERRIDES[model];
  if (o) return o;
  return model.replace(/(\d)-(\d)/g, "$1.$2");
}

const rows = raw as unknown as Row[];

/** Alle Rohzeilen des Snapshots, auch abgekündigte und geschätzte — für `aaExtras.ts`. */
export const AA_ROWS: readonly Row[] = rows;

/** Alle gemessenen Konfigurationen der aktiven Modelle mit Index UND Kosten. */
export const CONFIGS: readonly AaCfg[] = rows.flatMap((r) => {
  if (
    r.deprecated ||
    r.intelligenceIndexIsEstimated ||
    typeof r.intelligenceIndex !== "number" ||
    typeof r.intelligenceIndexCostPerTask !== "number"
  )
    return [];
  const model = modelSlug(r.slug, r.name);
  return [
    {
      slug: r.slug,
      model,
      label: labelOf(model),
      effort: effortOf(r.name),
      creator: r.modelCreatorName ?? "",
      index: r.intelligenceIndex,
      usd: r.intelligenceIndexCostPerTask,
      tps:
        typeof r.medianOutputTokensPerSecond === "number"
          ? r.medianOutputTokensPerSecond
          : null,
    },
  ];
});

/**
 * Je Modell die Konfiguration mit dem höchsten Index, bei Gleichstand die
 * billigere. Reihenfolge der Eingabe egal: sortiert wird nach Label.
 */
export function bestPerModel(cfgs: readonly AaCfg[] = CONFIGS): AaCfg[] {
  const best = new Map<string, AaCfg>();
  for (const c of cfgs) {
    const b = best.get(c.model);
    if (!b || c.index > b.index || (c.index === b.index && c.usd < b.usd))
      best.set(c.model, c);
  }
  return [...best.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Über dem Boden, das sind die Modelle des Charts. */
export const AA_CFGS: readonly AaCfg[] = bestPerModel().filter(
  (c) => c.index >= AA_FLOOR,
);

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Index auf eine Nachkommastelle: gerundet auf ganze Punkte stünden 17 Modelle in vier Zeilen. */
const idx = (c: AaCfg) => r1(c.index);

/** €/Task × Kontingent für Claude-Punkte, sonst nichts. */
const sub = (c: AaCfg, eur: number) =>
  c.creator === "Anthropic" ? r2(eur * SUB_FACTOR) : undefined;

/** Variante `aa-cost`: x = €/Task. */
export const AA_COST: Pt[] = AA_CFGS.map((c) => {
  const eur = r2(c.usd * USD_EUR);
  return P(c.label, eur, idx(c), {
    sub: sub(c, eur),
    tps: c.tps !== null ? Math.round(c.tps) : undefined,
  });
}).sort((a, b) => a.x - b.x);

/**
 * Variante `aa-speed`: x = Sekunden je 1 000 Output-Tokens (1000 / tok/s).
 *
 * Nicht tok/s selbst: `paretoFront`, die Quadranten und der Pfeilcluster
 * rechnen alle „kleiner x ist besser“. Mit x = 1000/tps gilt das auch hier, die
 * Achse bleibt log und normal orientiert, schnell steht links, und die Ticks
 * tragen die tok/s-Beschriftung (`paretoVariants.ts`). Modelle ohne gemessene
 * Geschwindigkeit fehlen in dieser Variante (`AA_NO_TPS`).
 */
export const AA_SPEED: Pt[] = AA_CFGS.flatMap((c) =>
  c.tps === null
    ? []
    : [
        P(c.label, r2(1000 / c.tps), idx(c), {
          tps: Math.round(c.tps),
        }),
      ],
).sort((a, b) => a.x - b.x);

/** Modelle der Chart-Menge, für die AA keine Geschwindigkeit führt. */
export const AA_NO_TPS: string[] = AA_CFGS.filter((c) => c.tps === null).map(
  (c) => c.label,
);
