// Datenbasis der Varianten `aa-cost` und `aa-speed` des Modell-Routing-Charts:
// Artificial Analysis Intelligence Index gegen Kosten pro Task bzw. gegen
// Output-Geschwindigkeit. `paretoVariants.ts` fasst sie mit der DeepSWE-Variante
// zusammen, `ModelRoutingPareto.vue` schaltet zwischen ihnen um.
//
// Herkunft
// --------
// https://artificialanalysis.ai/leaderboards/models, Stand `AA_STAND`. Die
// Rohdaten liegen als Archiv unter `data/artificialanalysis/` (`fetch.ts`
// erklärt, wie sie aus der Seite kommen und warum nicht aus der API). Hier
// steht nur, was daraus wird.
//
// Snapshot wechseln: Import, `AA_BOARD` und `AA_STAND` direkt darunter — nur
// dort. Der Ablauf steht in `data/artificialanalysis/UPDATE.md`; ein Test
// (`paretoVariants.test.ts`) schlägt fehl, solange die drei nicht zum neuesten
// Eintrag in `index.ndjson` passen. Attribution laut AA-Bedingungen: Link auf artificialanalysis.ai
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
// Boden: Index ≥ 25 (v5-Skala; in v4 war es 30). Darunter stehen Modelle, die
// als Routing-Kandidaten keine Rolle spielen und das Chart aufblähen würden.
//
// Index v5 und die Werte aus v4
// -----------------------------
// Ende Oktober 2026 hat AA auf Intelligence Index v5 umgestellt und führt Index
// und Kosten nur noch für neu gemessene Modelle (am 28.10.: 76 mit Index, 73
// mit Kosten; am 01.10. hatten 175 Einträge Kosten). Die übrigen kommen aus dem letzten v4-Snapshot vom 01.10.2026,
// UMGERECHNET auf die v5-Skala (`migrateV4`): Index und Kosten je als
// Potenzgesetz (Gerade in log-log), bei jedem Lauf neu aus den Konfigurationen
// gefittet, die in beiden Snapshots gemessen sind. Linear passte schlechter
// (28.10.: Restfehler 4,3 statt 3,6 Punkte) und lief unten ins Negative; v5
// staucht schwache Modelle stark (command-a-plus 13,1 → 6,2). Das ist eine Näherung für eine Präsentation,
// keine Messung — die Punkte stehen hohl und gestrichelt („≈“), der Tooltip sagt
// „aus v4 umgerechnet“, und `V4_MIGRATION` hält die Güte des Fits fest.

import raw from "../data/artificialanalysis/board-20261028-7ba3a00a.json";
import rawV4 from "../data/artificialanalysis/board-20261001-ae520e03.json";
import { P, type Pt } from "./paretoData";

/** Dateiname des Snapshots oben im Import; der Test hält beide gleich. */
export const AA_BOARD = "board-20261028-7ba3a00a.json";
/** Abrufdatum dieses Snapshots (`fetched_at` in `index.ndjson`), TT.MM.JJJJ. */
export const AA_STAND = "28.10.2026";
export const AA_URL = "https://artificialanalysis.ai/leaderboards/models";
/** Wie bei DeepSWE: ein fester Kurs (Stand 21.07.2026), keine Kursbewegung. */
export const USD_EUR = 0.876;
export const AA_FLOOR = 25;
/** Der letzte Snapshot mit Index v4 — Quelle der umgerechneten Werte, fest. */
export const AA_V4_BOARD = "board-20261001-ae520e03.json";
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
  /** Index und Kosten aus v4 umgerechnet, nicht von AA in v5 gemessen. */
  migrated?: true;
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
  /** Aus v4 umgerechnet (`migrateV4`). */
  migrated?: true;
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

/** Güte und Parameter der Umrechnung v4 → v5. */
export interface Migration {
  /** Zahl der Konfigurationen, die in beiden Snapshots einen Index tragen. */
  n: number;
  /** Index: ln v5 ≈ a + b · ln v4, also v5 ≈ eᵃ · v4ᵇ. */
  a: number;
  b: number;
  /** Bestimmtheitsmaß und Wurzel des mittleren Fehlers, in Indexpunkten. */
  r2: number;
  sigma: number;
  /** Kosten: ln v5 ≈ ca + cb · ln v4; Streuung als Faktor ×/÷. */
  ca: number;
  cb: number;
  costFactor: number;
}

const istZahl = (v: unknown): v is number => typeof v === "number";

/** Lineare Regression y ≈ a + b·x, dazu die Streuung der Reste. */
function fit(xy: readonly (readonly [number, number])[]) {
  const n = xy.length;
  const mx = xy.reduce((s, [x]) => s + x, 0) / n;
  const my = xy.reduce((s, [, y]) => s + y, 0) / n;
  const sxx = xy.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  const b = xy.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / sxx;
  const a = my - b * mx;
  const ss = xy.reduce((s, [x, y]) => s + (y - a - b * x) ** 2, 0);
  return { a, b, sigma: Math.sqrt(ss / (n - 2)) };
}

/**
 * Ergänzt den v5-Snapshot um umgerechnete v4-Werte.
 *
 * - Eine v5-Zeile ohne Index, die es in v4 mit Index gab, bekommt Index und
 *   Kosten aus v4, umgerechnet; Tempo und Status bleiben die aus v5.
 * - Eine v4-Zeile, die in v5 ganz fehlt, kommt als abgekündigt dazu (AA führt
 *   abgekündigte Modelle nicht mehr aus) — nur für die Produkt-Presets.
 * - Hat eine Modellfamilie in v5 IRGENDEINE gemessene Stufe, bekommt sie keine
 *   umgerechneten Stufen dazu: Messung schlägt Näherung, und ein Modell soll nicht
 *   aus zwei Skalen zusammengesetzt sein.
 */
export function migrateV4(
  v5: readonly Row[],
  v4: readonly Row[],
): { rows: Row[]; migration: Migration } {
  const alt = new Map(v4.map((r) => [r.slug, r]));
  const gemessen = (r: Row | undefined): r is Row =>
    !!r &&
    !r.intelligenceIndexIsEstimated &&
    istZahl(r.intelligenceIndex) &&
    r.intelligenceIndex > 0;
  const paare = v5.flatMap((r) => {
    const o = alt.get(r.slug);
    return gemessen(r) && gemessen(o) ? [[o, r] as const] : [];
  });
  if (paare.length < 10)
    throw new Error(
      `migrateV4: nur ${paare.length} Konfigurationen in beiden Ständen gemessen — zu wenig für einen Fit`,
    );
  const mitKosten = paare.filter(
    ([o, r]) =>
      (o.intelligenceIndexCostPerTask ?? 0) > 0 &&
      (r.intelligenceIndexCostPerTask ?? 0) > 0,
  );
  const ln = Math.log;
  const idx = fit(
    paare.map(
      ([o, r]) => [ln(o.intelligenceIndex!), ln(r.intelligenceIndex!)] as const,
    ),
  );
  const kost = fit(
    mitKosten.map(
      ([o, r]) =>
        [
          ln(o.intelligenceIndexCostPerTask!),
          ln(r.intelligenceIndexCostPerTask!),
        ] as const,
    ),
  );
  const v5Index = (x: number) => Math.exp(idx.a + idx.b * ln(x));
  // Güte in Indexpunkten, nicht in log: das ist die Einheit der Folie.
  const y = paare.map(([, r]) => r.intelligenceIndex!);
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  const ss = paare.reduce(
    (s, [o, r]) =>
      s + (r.intelligenceIndex! - v5Index(o.intelligenceIndex!)) ** 2,
    0,
  );
  const migration: Migration = {
    n: paare.length,
    a: idx.a,
    b: idx.b,
    r2: 1 - ss / y.reduce((s, v) => s + (v - my) ** 2, 0),
    sigma: Math.sqrt(ss / paare.length),
    ca: kost.a,
    cb: kost.b,
    costFactor: Math.exp(kost.sigma),
  };
  const familieGemessen = new Set(
    v5.filter((r) => gemessen(r)).map((r) => modelSlug(r.slug, r.name)),
  );

  // Verankerung im eigenen Haus: Der globale Fit kennt keine Geschwister. Am
  // 28.10. setzte er glm-5.3-flash (v4 41,8) auf 33,0 — über das gemessene
  // glm-5.3 (v4 44,8 → v5 31,7). Deshalb zwischen den gemessenen Nachbarn
  // desselben Herstellers interpolieren (nach v4-Index), und wo es nur auf
  // einer Seite einen gibt, den Fitwert dort begrenzen. Die v4-Reihenfolge
  // innerhalb eines Herstellers bleibt so erhalten.
  const nachbarn = new Map<string, (readonly [number, number])[]>();
  for (const [o, r] of paare) {
    const k = r.modelCreatorName ?? "";
    (nachbarn.get(k) ?? nachbarn.set(k, []).get(k)!).push([
      o.intelligenceIndex!,
      r.intelligenceIndex!,
    ]);
  }
  const verankert = (o: Row): number => {
    const x = o.intelligenceIndex!;
    const f = v5Index(x);
    const n = nachbarn.get(o.modelCreatorName ?? "") ?? [];
    const unten = n.filter(([x4]) => x4 < x).sort((a, b) => b[0] - a[0])[0];
    const oben = n.filter(([x4]) => x4 > x).sort((a, b) => a[0] - b[0])[0];
    if (unten && oben)
      return (
        unten[1] +
        ((x - unten[0]) / (oben[0] - unten[0])) * (oben[1] - unten[1])
      );
    if (unten) return Math.max(f, unten[1]);
    if (oben) return Math.min(f, oben[1]);
    return f;
  };

  const um = (o: Row, basis: Row, deprecated: boolean | null): Row => ({
    ...basis,
    deprecated,
    intelligenceIndex: verankert(o),
    intelligenceIndexIsEstimated: o.intelligenceIndexIsEstimated,
    intelligenceIndexCostPerTask: istZahl(o.intelligenceIndexCostPerTask)
      ? Math.exp(kost.a + kost.b * Math.log(o.intelligenceIndexCostPerTask))
      : null,
    migrated: true,
  });
  const kandidat = (o: Row | undefined): o is Row =>
    !!o &&
    istZahl(o.intelligenceIndex) &&
    !familieGemessen.has(modelSlug(o.slug, o.name));

  const neu = new Set(v5.map((r) => r.slug));
  const rows: Row[] = v5.map((r) => {
    const o = alt.get(r.slug);
    return !istZahl(r.intelligenceIndex) && kandidat(o)
      ? um(o, r, r.deprecated)
      : r;
  });
  for (const o of v4)
    if (!neu.has(o.slug) && kandidat(o)) rows.push(um(o, o, true));
  return { rows, migration };
}

const { rows, migration } = migrateV4(
  raw as unknown as Row[],
  rawV4 as unknown as Row[],
);

/** Parameter und Güte der Umrechnung — für Notizen, ⓘ und Tests. */
export const V4_MIGRATION: Migration = migration;

/** Tooltip-Zusatz eines umgerechneten Punkts, mit der typischen Abweichung. */
export const MIG_HINWEIS = `aus Index v4 umgerechnet (typisch ±${Math.round(migration.sigma)} Punkte, Kosten ×/÷ ${migration.costFactor.toFixed(1).replace(".", ",")})`;

/**
 * Alle Zeilen: v5-Snapshot plus umgerechnete v4-Werte, auch abgekündigte und
 * geschätzte — für `aaExtras.ts`.
 */
export const AA_ROWS: readonly Row[] = rows;

/**
 * Alle gemessenen Konfigurationen der aktiven Modelle mit Index UND Kosten.
 * Als Funktion, damit eine Folie auf einem festen Snapshot bleiben kann
 * (`lib/codexEffortMath.ts`), während die Pareto-Folie weiterzieht.
 */
export const configsOf = (rows: readonly Row[]): AaCfg[] =>
  rows.flatMap((r) => {
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
        ...(r.migrated ? { migrated: true as const } : {}),
      },
    ];
  });

/** Die Konfigurationen des aktuellen Snapshots. */
export const CONFIGS: readonly AaCfg[] = configsOf(rows);

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

/** Umgerechnete Punkte stehen wie geschätzte hohl und gestrichelt. */
const umgerechnet = (c: AaCfg) =>
  c.migrated ? { est: true as const, mig: true as const } : {};

/** €/Task × Kontingent für Claude-Punkte, sonst nichts. */
const sub = (c: AaCfg, eur: number) =>
  c.creator === "Anthropic" ? r2(eur * SUB_FACTOR) : undefined;

/** Variante `aa-cost`: x = €/Task. */
export const AA_COST: Pt[] = AA_CFGS.map((c) => {
  const eur = r2(c.usd * USD_EUR);
  return P(c.label, eur, idx(c), {
    sub: sub(c, eur),
    tps: c.tps !== null ? Math.round(c.tps) : undefined,
    ...umgerechnet(c),
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
          ...umgerechnet(c),
        }),
      ],
).sort((a, b) => a.x - b.x);

/** Modelle der Chart-Menge, für die AA keine Geschwindigkeit führt. */
export const AA_NO_TPS: string[] = AA_CFGS.filter((c) => c.tps === null).map(
  (c) => c.label,
);
