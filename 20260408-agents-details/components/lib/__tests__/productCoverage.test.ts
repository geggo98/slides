import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_ROWS } from "../../aaData";
import { dominators, paretoFront, type Pt } from "../../paretoData";
import { footnoteFor, leadFor } from "../../paretoText";
import { VARIANTS, type VariantId } from "../../paretoVariants";
import { coverage, missingByReason, summarize } from "../../productCoverage";
import { presetModels, type ToolId } from "../../providerFilter";

const pt = (label: string, x: number, y: number): Pt => ({
  label,
  x,
  y,
  eur: String(x),
});

describe("dominators", () => {
  const a = pt("a", 1, 40);
  const b = pt("b", 2, 50);
  const c = pt("c", 3, 45);
  const d = pt("d", 2, 50); // gleich wie b

  it("nennt Punkte, die höchstens so teuer und mindestens so gut sind — einer echt besser", () => {
    expect(dominators(c, [a, b, c]).map((p) => p.label)).toStrictEqual(["b"]);
    expect(dominators(b, [a, b, c])).toStrictEqual([]); // a ist billiger, aber schwächer
  });

  it("zählt einen Punkt nicht als Dominator seiner selbst und nicht bei völliger Gleichheit", () => {
    expect(dominators(b, [b, d])).toStrictEqual([]);
  });

  it("sortiert den billigsten zuerst", () => {
    const e = pt("e", 5, 40);
    expect(dominators(e, [b, a, c]).map((p) => p.label)).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("stimmt mit `paretoFront` überein: dominiert genau dann, wenn ein Dominator existiert", () => {
    for (const id of ["aa-cost", "aa-speed", "deepswe"] as const) {
      const V = VARIANTS[id];
      const uni = [...V.pts, ...V.extras];
      const { front, dom } = paretoFront(uni);
      for (const p of front)
        expect(dominators(p, uni), `${id} ${p.label}`).toStrictEqual([]);
      for (const p of dom)
        expect(dominators(p, uni).length, `${id} ${p.label}`).toBeGreaterThan(
          0,
        );
    }
  });
});

// Die Zahlen, die in der Fußzeile stehen: „21 von 41 Modellen mit Messwert“. Sie
// werden hier aus Katalogen und AA-Snapshot vom 29.09.2026 nachgerechnet; bewegt
// sich einer der beiden, stimmt die Fußzeile nicht mehr, und dieser Test sagt es.
describe("coverage", () => {
  const erwartet: Record<VariantId, Record<ToolId, [number, number]>> = {
    // [Familien des Produkts, davon gezeichnet]
    "aa-cost": {
      cursor: [49, 31],
      windsurf: [64, 33],
      "jetbrains-ai": [41, 21],
      junie: [11, 11],
    },
    "aa-speed": {
      cursor: [49, 38],
      windsurf: [64, 44],
      "jetbrains-ai": [41, 40],
      junie: [11, 11],
    },
    deepswe: {
      cursor: [49, 17],
      windsurf: [64, 20],
      "jetbrains-ai": [41, 10],
      junie: [11, 4],
    },
  };

  for (const view of Object.keys(erwartet) as VariantId[])
    for (const id of Object.keys(erwartet[view]) as ToolId[])
      it(`${view} · ${id}: ${erwartet[view][id][1]} von ${erwartet[view][id][0]}`, () => {
        const c = coverage(id, VARIANTS[view]);
        expect([c.total, c.plotted]).toStrictEqual(erwartet[view][id]);
        expect(c.missing.length).toBe(c.total - c.plotted);
      });

  it("zeichnet genau so viele Punkte, wie das Preset auswählt", () => {
    for (const view of ["aa-cost", "aa-speed", "deepswe"] as const) {
      const V = VARIANTS[view];
      const uni = [...V.pts, ...V.extras];
      for (const id of ["cursor", "windsurf", "jetbrains-ai", "junie"] as const)
        expect(presetModels(id, uni, V.pts).length, `${view} ${id}`).toBe(
          coverage(id, V).plotted,
        );
    }
  });

  it("nennt je Ansicht den Grund: Kosten, Tempo, Index oder Board", () => {
    const jb = coverage("jetbrains-ai", VARIANTS["aa-cost"]);
    expect(missingByReason(jb)).toStrictEqual([
      [
        "kein Kostenwert bei AA",
        expect.arrayContaining(["GPT-5.4", "o3", "Claude 4.7 Opus"]),
      ],
    ]);
    const cur = coverage("cursor", VARIANTS["aa-cost"]);
    const gruende = new Map(missingByReason(cur));
    expect(gruende.get("kein Index bei AA")).toContain("Composer 2.5");
    expect(
      coverage("cursor", VARIANTS.deepswe).missing.every(
        (m) => m.reason === "nicht auf dem Board",
      ),
    ).toBe(true);
  });
});

describe("summarize", () => {
  const V = VARIANTS["aa-cost"];
  const uni = [...V.pts, ...V.extras];

  it("erkennt den Standard und kein Produkt", () => {
    const s = summarize(V, new Set(V.pts.map((p) => p.label)));
    expect(s.isDefault).toBe(true);
    expect(s.tool).toBeNull();
    expect(s.coverage).toBeNull();
  });

  it("erkennt ein Produkt-Preset samt Front und Zahl der Übertroffenen", () => {
    const s = summarize(V, new Set(presetModels("jetbrains-ai", uni, V.pts)));
    expect(s.isDefault).toBe(false);
    expect(s.tool?.id).toBe("jetbrains-ai");
    expect(s.base.length).toBe(21);
    expect(s.front.length).toBe(7);
    expect(s.dominated).toBe(14);
    expect(s.coverage?.plotted).toBe(21);
  });

  it("kennt bei einer eigenen Auswahl kein Produkt", () => {
    const s = summarize(V, new Set([V.pts[0]!.label, V.pts[4]!.label]));
    expect(s.tool).toBeNull();
    expect(s.isDefault).toBe(false);
  });
});

describe("Texte für eine Auswahl", () => {
  const cost = VARIANTS["aa-cost"];
  const uni = [...cost.pts, ...cost.extras];
  const jb = summarize(
    cost,
    new Set(presetModels("jetbrains-ai", uni, cost.pts)),
  );
  const text = (segs: { t: string }[]) => segs.map((s) => s.t).join("");

  it("der Absatz nennt die berechnete Leiter des Produkts, billigste zuerst, und die Zahlen", () => {
    const t = text(leadFor(cost, jb));
    expect(t).toContain("gemini-3.1-flash-lite 0,035 € (15,6) → gpt-5-mini");
    expect(t).toContain("claude-opus-5 5,13 € (50,8)");
    expect(t).toContain("JetBrains AI: 7 von 21 auf der Front, die übrigen 14");
  });

  it("die Tempo-Ansicht beginnt beim Langsamsten und kennzeichnet geschätzte Werte", () => {
    const V = VARIANTS["aa-speed"];
    const u = [...V.pts, ...V.extras];
    const s = summarize(V, new Set(presetModels("jetbrains-ai", u, V.pts)));
    const t = text(leadFor(V, s));
    expect(t).toContain("Wo Du wartest");
    // elf Sprossen: kompakt, ohne Scores (sonst läuft die Folie über)
    expect(t).toContain(
      "gemini-3.5-flash-lite 320 tok/s → gemini-2.5-flash-lite 353 tok/s",
    );
    expect(t).not.toContain("(≈");
    expect(t.indexOf("claude-opus-5")).toBeLessThan(
      t.indexOf("gemini-2.5-flash-lite"),
    );
  });

  it("zeigt Scores bei kurzen Leitern, auch geschätzte mit ≈", () => {
    const V = VARIANTS["aa-speed"];
    const u = [...V.pts, ...V.extras];
    const s = summarize(V, new Set(presetModels("cursor", u, V.pts)));
    expect(s.front.length).toBeLessThanOrEqual(8);
    expect(text(leadFor(V, s))).toMatch(/tok\/s \(\d/);
  });

  it("nennt Sonderfälle: leer, ein Modell", () => {
    expect(text(leadFor(cost, summarize(cost, new Set())))).toContain(
      "Kein Modell ausgewählt",
    );
    expect(
      text(leadFor(cost, summarize(cost, new Set([cost.pts[0]!.label])))),
    ).toContain("keine Front");
  });

  it("die Fußzeile nennt Katalogdatum, Abdeckung und legt die Liste in den Hover", () => {
    const segs = footnoteFor(cost, jb);
    const t = text(segs);
    expect(t).toContain(
      "JetBrains AI (Katalog 29.09.2026): 21 von 41 mit Messwert",
    );
    expect(t).toContain("20 ohne Wert (Hover)");
    expect(t).toContain(
      "Achsen und Quadranten-Linien (Median) folgen der Auswahl",
    );
    expect(t).not.toContain("Quadranten redaktionell");
    const liste = segs.find((s) => s.title)?.title ?? "";
    expect(liste).toContain("kein Kostenwert bei AA: ");
    expect(liste).toContain("GPT-5.4");
  });

  it("die Fußzeile erklärt „≈“ nur, wenn ein Punkt geschätzt ist", () => {
    const V = VARIANTS["aa-speed"];
    const u = [...V.pts, ...V.extras];
    const est = summarize(V, new Set(presetModels("jetbrains-ai", u, V.pts)));
    expect(text(footnoteFor(V, est))).toContain("≈ = Index von AA geschätzt");
    expect(text(footnoteFor(cost, jb))).not.toContain("≈");
  });
});

// Die Sprechernotizen und der ⓘ-Dialog nennen Leitern und Zahlen. Sie stehen von
// Hand dort — dieser Test rechnet sie aus den Daten nach, damit ein neuer Katalog
// oder AA-Snapshot nicht still falsche Notizen hinterlässt.
describe("Notizen und Dialog gegen die Berechnung", () => {
  const dir = join(import.meta.dirname, "../..");
  const notes = readFileSync(join(dir, "../slides.md"), "utf8").replace(
    /\s+/g,
    " ",
  );
  const dialog = readFileSync(join(dir, "ModelRoutingSources.vue"), "utf8");
  const tools = ["jetbrains-ai", "junie", "cursor", "windsurf"] as const;

  for (const view of ["aa-cost", "aa-speed"] as const)
    for (const id of tools) {
      const V = VARIANTS[view];
      const u = [...V.pts, ...V.extras];
      const s = summarize(V, new Set(presetModels(id, u, V.pts)));

      it(`${view} · ${id}: die Leiter in den Notizen ist die berechnete`, () => {
        const segs = leadFor(V, s);
        const leiter = segs
          .slice(2, -1)
          .map((x) => x.t)
          .join("");
        expect(leiter.length).toBeGreaterThan(20);
        expect(notes).toContain(leiter);
      });

      it(`${view} · ${id}: „${s.coverage!.plotted} von ${s.coverage!.total}“ steht in den Notizen`, () => {
        const { plotted, total } = s.coverage!;
        expect(notes).toContain(`(${plotted} von ${total}`);
      });
    }

  it("nennt im Dialog die Zahl der geschätzten AA-Einträge ohne Kosten", () => {
    const schaetz = AA_ROWS.filter((r) => r.intelligenceIndexIsEstimated);
    expect(dialog).toContain(`(0 von ${schaetz.length})`);
  });

  it("führt Junie im Dialog mit beiden Quellen", () => {
    expect(dialog).toContain("https://junie.jetbrains.com/whats-new");
    expect(dialog).toContain("https://junie.jetbrains.com/");
  });
});
