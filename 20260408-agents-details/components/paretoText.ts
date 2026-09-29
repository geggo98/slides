// Empfehlungsabsatz und Fußzeile der Folie für eine Auswahl, die nicht das
// kuratierte Feld ist — vor allem für ein Produkt. Der Standard behält die
// redaktionellen Texte der Variante (`paretoVariants.ts`); hier steht, was aus
// den BERECHNETEN Zahlen der Auswahl folgt: ihre Front, wie viele Modelle strikt
// übertroffen werden, wie viele das Produkt hat, aber das Chart nicht zeichnet.

import type { ParetoVariant, Seg, VariantId } from "./paretoVariants";
import { missingByReason, type SelectionSummary } from "./productCoverage";

const deDatum = (iso: string) => iso.split("-").reverse().join(".");

/** „0,05 € (37,9)“, bei geschätztem Index „(≈ 37,9)“. */
const punkt = (V: ParetoVariant, p: SelectionSummary["front"][number]) =>
  `${p.label} ${V.xText(p)} (${p.est ? "≈ " : ""}${V.yText(p.y)})`;

export function leadFor(V: ParetoVariant, s: SelectionSummary): Seg[] {
  const n = s.base.length;
  const wer = s.tool ? s.tool.label : "Die Auswahl";
  if (n === 0)
    return [
      {
        t: "Kein Modell ausgewählt — im Anbieter-Menü ein Produkt oder ein Lab wählen.",
      },
    ];
  if (n === 1)
    return [
      {
        t: `${wer}: ein Modell, ${s.base[0]!.label} — keine Front, nur eine Wahl.`,
      },
    ];

  const schnell = V.id === "aa-speed";
  const leiter = schnell ? [...s.front].reverse() : s.front;
  const out: Seg[] = schnell
    ? [
        { t: "Wo Du wartest, zählt die Front nach Tempo:", b: true },
        { t: " die schnellste Sprosse nehmen, die Deine Aufgaben löst. " },
      ]
    : [
        {
          t: "Nimm den billigsten Punkt der Front, der Deine Aufgaben löst",
          b: true,
        },
        {
          t: " — im Zweifel unten anfangen, bei Fehlschlag eine Sprosse höher. ",
        },
      ];
  // Eine lange Leiter (mehr als acht Sprossen) ohne Scores: sonst läuft die Folie
  // über, und der Tooltip nennt sie ohnehin.
  const kompakt = leiter.length > 8;
  leiter.forEach((p, i) => {
    if (i) out.push({ t: " → " });
    out.push(
      { t: p.label, b: true },
      {
        t: kompakt
          ? ` ${V.xText(p)}`
          : ` ${V.xText(p)} (${p.est ? "≈ " : ""}${V.yText(p.y)})`,
      },
    );
  });
  out.push({
    t: s.dominated
      ? `. ${wer}: ${s.front.length} von ${n} auf der Front, die übrigen ${s.dominated} übertrifft je ein Modell ${s.tool ? "des Produkts" : "der Auswahl"} strikt (Tooltip).`
      : `. ${wer}: alle ${n} auf der Front.`,
  });
  return out;
}

/** Fußzeile bei angepassten Achsen; `attribution` hängt die Komponente an. */
const FIT: Record<VariantId, string> = {
  "aa-cost":
    "AA Intelligence Index · Kosten = Ø Kosten eines Index-Durchlaufs, kein SWE-Task · beste Effort-Stufe je Modell · 1 USD = 0,876 € · Achsen und Quadranten-Linien (Median) folgen der Auswahl · Werte abgekündigter Modelle: letzter AA-Lauf",
  "aa-speed":
    "AA Intelligence Index · Tempo = Median der Output-Tokens/s · beste Effort-Stufe je Modell · Achsen und Quadranten-Linien (Median) folgen der Auswahl · Werte abgekündigter Modelle: letzter AA-Lauf",
  deepswe:
    "DeepSWE v1.1 · 113 Tasks · mini-swe-agent · pass@1 · Datacurve 03.09. · 1 USD = 0,876 € · Achsen und Quadranten-Linien (Median) folgen der Auswahl",
};

export function footnoteFor(V: ParetoVariant, s: SelectionSummary): Seg[] {
  const out: Seg[] = [{ t: FIT[V.id] }];
  if (s.base.some((p) => p.est))
    out.push({ t: " · ≈ = Index von AA geschätzt" });
  const c = s.coverage;
  if (s.tool && c) {
    out.push({
      t: ` · ${s.tool.label} (Katalog ${deDatum(s.tool.retrieved)}): ${c.plotted} von ${c.total} mit Messwert`,
    });
    if (c.missing.length) {
      const liste = missingByReason(c)
        .map(([grund, namen]) => `${grund}: ${namen.join(", ")}`)
        .join("\n");
      out.push({ t: ` · ${c.missing.length} ohne Wert (Hover)`, title: liste });
    }
  }
  out.push({ t: V.attribution ? " · Quelle: " : "" });
  return out;
}
