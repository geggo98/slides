/**
 * CVD-Abstandsmessung für die Farbcodierung der rnext-ComponentMap.
 * Misst Worst-Case-ΔE2000 (normal/protan/deutan/tritan) für alle Paare der
 * Gruppen-Töne — getrennt für Light- und Dark-Theme, jeweils Fill + Border.
 *
 * Kanal-Modell der Map: Prozess (gepunkteter Rahmen), Varianten
 * (gestrichelt) und Fehler (Diagonal-Schraffur) tragen eigene
 * NICHT-Farb-Kanäle plus Label; nur Eingabe/Ausgabe/Neutral müssen sich
 * rein farblich unterscheiden. Der Floor (ΔE ≥ 10 auf Border-Farben) gilt
 * daher nur für diese drei; alle übrigen Paare werden informativ gelistet.
 */
import { minDistAcrossCVD } from "./cvd-core.ts";

const COLOR_ONLY = new Set(["in", "out", "neutral"]);

const SETS: Record<string, Record<string, string>> = {
  "light/border": {
    in: "#85b7eb",
    out: "#97c459",
    warning: "#ef9f27",
    danger: "#f09595",
    neutral: "#cccccc",
  },
  "dark/border": {
    in: "#185fa5",
    out: "#3b6d11",
    warning: "#854f0b",
    danger: "#a32d2d",
    neutral: "#464646",
  },
  "light/fill": {
    in: "#e6f1fb",
    out: "#eaf3de",
    warning: "#faeeda",
    danger: "#fcebeb",
    neutral: "#ffffff",
    variant: "#f4f9fd",
  },
  "dark/fill": {
    in: "#042c53",
    out: "#173404",
    warning: "#412402",
    danger: "#501313",
    neutral: "#1e1e1e",
    variant: "#122436",
  },
};

const BORDER_FLOOR = 10;
let fail = false;

for (const [set, colors] of Object.entries(SETS)) {
  const keys = Object.keys(colors);
  console.log(`\n${set}:`);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i]!;
      const b = keys[j]!;
      const d = minDistAcrossCVD(colors[a]!, colors[b]!);
      const gated =
        set.endsWith("border") && COLOR_ONLY.has(a) && COLOR_ONLY.has(b);
      const bad = gated && d < BORDER_FLOOR;
      if (bad) fail = true;
      console.log(
        `  ${a.padEnd(8)} ↔ ${b.padEnd(8)} ΔE2000(worst) = ${d.toFixed(1)}${gated ? " [Farb-Floor]" : ""}${bad ? "  ← unter Floor!" : ""}`,
      );
    }
  }
}

console.log(fail ? "\nFAIL: Border-Paare unter Floor" : "\nOK");
process.exit(fail ? 1 : 0);
