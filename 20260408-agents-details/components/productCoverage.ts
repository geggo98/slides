// Was ein Produkt-Preset über sein Produkt sagt: Wie viele seiner Modelle das Chart
// zeichnen kann, welche nicht und warum — und wie seine Front aussieht. Daraus
// bauen Fußzeile, Empfehlungsabsatz und Tooltip; rein, damit der Test die Zahlen
// nachrechnet, die auf der Folie stehen.

import { aaFamily } from "./aaExtras";
import { familyKey } from "./catalogMatch";
import { paretoFront, type Pt } from "./paretoData";
import type { ParetoVariant } from "./paretoVariants";
import { matchingPreset, TOOLS, type Tool } from "./providerFilter";
import { CATALOGS } from "./toolCatalogs";

export type Missing = {
  /** Name wörtlich wie im Katalog (erste Schreibweise der Familie). */
  name: string;
  reason: string;
};

export interface Coverage {
  /** Verschiedene Modelle des Produkts (Familien: Effort-Stufen zählen einmal). */
  total: number;
  plotted: number;
  missing: Missing[];
}

/** Warum ein Modell in dieser Ansicht fehlt. */
function reasonFor(key: string, view: ParetoVariant["id"]): string {
  if (view === "deepswe") return "nicht auf dem Board";
  if (aaFamily(key).length === 0) return "kein Index bei AA";
  return view === "aa-cost"
    ? "kein Kostenwert bei AA"
    : "kein Tempo-Wert bei AA";
}

export function coverage(
  tool: Tool["id"],
  V: Pick<ParetoVariant, "id" | "pts" | "extras">,
): Coverage {
  const drawn = new Set([...V.pts, ...V.extras].map((p) => familyKey(p.label)));
  const families = new Map<string, string>();
  for (const e of CATALOGS[tool].models) {
    const k = familyKey(e.name);
    if (!families.has(k)) families.set(k, e.name);
  }
  const missing: Missing[] = [];
  for (const [k, name] of families)
    if (!drawn.has(k)) missing.push({ name, reason: reasonFor(k, V.id) });
  missing.sort((a, b) => a.name.localeCompare(b.name));
  return {
    total: families.size,
    plotted: families.size - missing.length,
    missing,
  };
}

/** Fehlende Modelle je Grund: `[["kein Kostenwert bei AA", ["GPT-5.4", …]], …]`. */
export function missingByReason(c: Coverage): [string, string[]][] {
  const m = new Map<string, string[]>();
  for (const x of c.missing)
    (m.get(x.reason) ?? m.set(x.reason, []).get(x.reason)!).push(x.name);
  return [...m];
}

export interface SelectionSummary {
  /** Auswahl = kuratiertes Feld („Alle“). */
  isDefault: boolean;
  /** Das Produkt, wenn die Auswahl genau sein Preset ist. */
  tool: Tool | null;
  base: Pt[];
  front: Pt[];
  /** Punkte der Auswahl, die von einem anderen der Auswahl strikt übertroffen werden. */
  dominated: number;
  coverage: Coverage | null;
}

export function summarize(
  V: Pick<ParetoVariant, "id" | "pts" | "extras">,
  sel: ReadonlySet<string>,
): SelectionSummary {
  const universe = [...V.pts, ...V.extras];
  const isDefault =
    sel.size === V.pts.length && V.pts.every((p) => sel.has(p.label));
  const preset = matchingPreset(sel, universe, V.pts);
  const tool =
    preset && preset.id !== "all"
      ? (TOOLS.find((t) => t.id === preset.id) ?? null)
      : null;
  const base = universe.filter((p) => sel.has(p.label));
  const { front, dom } = paretoFront(base);
  return {
    isDefault,
    tool,
    base,
    front,
    dominated: dom.length,
    coverage: tool ? coverage(tool.id, V) : null,
  };
}
