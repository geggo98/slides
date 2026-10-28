// Die Modelle, die ein Produkt führt und das kuratierte Feld nicht zeigt: ältere,
// von AA abgekündigte, mit geschätztem Index, unter dem Boden (`AA_FLOOR`). Ein
// Produkt-Preset blendet sie ein — sein Zweck ist zu zeigen, welche der Modelle
// DES PRODUKTS sich lohnen, auch wenn ein anderes Produkt neuere hat
// (`paretoGeometry.ts` rechnet die Front über genau diese Auswahl).
//
// Warum eigene Regeln je Ansicht
// ------------------------------
// Die Kostenansicht braucht einen Kostenwert, die Tempoansicht nur tok/s. Kein
// von AA GESCHÄTZTER Index hat einen Kostenwert (am 28.10.2026: keiner von 484);
// „≈“ heißt in der Kostenansicht deshalb immer „aus v4 umgerechnet“
// (`migrateV4` in `aaData.ts`). Deshalb wird je Ansicht getrennt gewählt und
// nicht einmal für beide.
//
// Welche Zeile ein Modell vertritt
// --------------------------------
// AA führt jede Effort- und Reasoning-Konfiguration einzeln, `familyKey()`
// (`catalogMatch.ts`) fasst sie zu einer Familie zusammen. Je Familie und Ansicht
// gilt: in v5 GEMESSEN vor aus einer v4-Messung umgerechnet vor geschätzt
// (`stufe`), dann höchster Index, dann billiger (Tempo: schneller). Ohne den ersten Schritt schlüge `gemini-3.5-flash medium`
// (geschätzt, 33,6) die gemessene `high` (32,6), und ein Label hätte in zwei
// Ansichten zwei verschiedene y-Werte.
//
// Vorbehalt: Der Punkt ist die BESTE Konfiguration der Familie. Ein Produkt bietet
// nicht immer die höchste Effort-Stufe an (Windsurf führt jede einzeln). AA
// liefert abgekündigte Modelle nicht mehr aus; ihre Werte sind der v4-Stand vom
// 01.10.2026, auf v5 umgerechnet.

import { AA_COST, AA_ROWS, AA_SPEED, SUB_FACTOR, USD_EUR } from "./aaData";
import { familyKey } from "./catalogMatch";
import { P, type Pt } from "./paretoData";
import { CATALOGS, type CatalogId } from "./toolCatalogs";

export type AaView = "cost" | "speed";

export interface Cand {
  slug: string;
  name: string;
  creator: string;
  index: number;
  estimated: boolean;
  /** Aus v4 umgerechnet (`migrateV4`); zählt beim Vertreter wie „geschätzt“. */
  migrated: boolean;
  deprecated: boolean;
  usd: number | null;
  tps: number | null;
}

/** Alle AA-Zeilen mit Index, nach Familie. */
const FAMILIES: ReadonlyMap<string, Cand[]> = (() => {
  const m = new Map<string, Cand[]>();
  for (const r of AA_ROWS) {
    if (typeof r.intelligenceIndex !== "number") continue;
    const key = familyKey(r.name);
    const c: Cand = {
      slug: r.slug,
      name: r.name,
      creator: r.modelCreatorName ?? "",
      index: r.intelligenceIndex,
      estimated: r.intelligenceIndexIsEstimated === true,
      migrated: r.migrated === true,
      deprecated: r.deprecated === true,
      usd:
        typeof r.intelligenceIndexCostPerTask === "number"
          ? r.intelligenceIndexCostPerTask
          : null,
      tps:
        typeof r.medianOutputTokensPerSecond === "number"
          ? r.medianOutputTokensPerSecond
          : null,
    };
    (m.get(key) ?? m.set(key, []).get(key)!).push(c);
  }
  return m;
})();

/** Die AA-Familie zu einem Schlüssel; leer, wenn AA das Modell nicht kennt. */
export const aaFamily = (key: string): readonly Cand[] =>
  FAMILIES.get(key) ?? [];

/**
 * Rang der Herkunft: in v5 gemessen, aus einer v4-MESSUNG umgerechnet, irgendwie
 * geschätzt. Ein einziges „geschätzt oder umgerechnet“ ließ die Tempoansicht
 * eine geschätzte v4-Stufe nehmen, wo die Kostenansicht die gemessene nahm — ein
 * Label, zwei y-Werte (gpt-5-mini 6,9 gegen 9,8, 28.10.2026).
 */
const stufe = (c: Cand) => (c.estimated ? 2 : c.migrated ? 1 : 0);

/** Vertreter einer Familie in einer Ansicht — siehe Kopf; undefined ohne Messwert. */
export function bestCand(
  cands: readonly Cand[],
  view: AaView,
): Cand | undefined {
  const ok = cands.filter((c) =>
    view === "cost" ? c.usd !== null : c.tps !== null,
  );
  return [...ok].sort(
    (a, b) =>
      stufe(a) - stufe(b) ||
      b.index - a.index ||
      (view === "cost" ? a.usd! - b.usd! : b.tps! - a.tps!),
  )[0];
}

/** Alle Modell-Familien, die irgendein Produktkatalog führt, mit einem lesbaren Namen. */
export const PRODUCT_FAMILIES: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const id of Object.keys(CATALOGS) as CatalogId[])
    for (const e of CATALOGS[id].models) {
      const k = familyKey(e.name);
      if (!m.has(k)) m.set(k, e.name);
    }
  return m;
})();

const r1 = (v: number) => Math.round(v * 10) / 10;
const sig3 = (v: number) => Number(v.toPrecision(3));

function toPt(key: string, c: Cand, view: AaView): Pt {
  const y = r1(c.index);
  const tps = c.tps !== null ? Math.round(c.tps) : undefined;
  const est = c.estimated || c.migrated ? (true as const) : undefined;
  const mig = c.migrated ? (true as const) : undefined;
  const v4est = c.migrated && c.estimated ? (true as const) : undefined;
  if (view === "speed")
    return P(key, sig3(1000 / c.tps!), y, { tps, est, mig, v4est });
  const x = sig3(c.usd! * USD_EUR);
  return P(key, x, y, {
    tps,
    est,
    mig,
    v4est,
    sub: c.creator === "Anthropic" ? sig3(x * SUB_FACTOR) : undefined,
  });
}

/**
 * Extras einer Ansicht: jede Produkt-Familie mit Messwert in dieser Ansicht, die
 * nicht schon im kuratierten Feld steht. Nach x sortiert wie das Feld.
 */
export function extrasFor(view: AaView): Pt[] {
  const curated = new Set(
    (view === "cost" ? AA_COST : AA_SPEED).map((p) => familyKey(p.label)),
  );
  const out: Pt[] = [];
  for (const key of PRODUCT_FAMILIES.keys()) {
    if (curated.has(key)) continue;
    const c = bestCand(aaFamily(key), view);
    if (c) out.push(toPt(key, c, view));
  }
  return out.sort((a, b) => a.x - b.x);
}

export const AA_EXTRAS_COST: Pt[] = extrasFor("cost");
export const AA_EXTRAS_SPEED: Pt[] = extrasFor("speed");
