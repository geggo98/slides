import { describe, expect, it } from "vitest";
import { AA_COST, AA_ROWS, AA_SPEED } from "../../aaData";
import {
  AA_EXTRAS_COST,
  AA_EXTRAS_SPEED,
  aaFamily,
  bestCand,
  PRODUCT_FAMILIES,
  type Cand,
} from "../../aaExtras";
import { catalogHas, familyKey } from "../../catalogMatch";
import { paretoFront } from "../../paretoData";
import { matchingPreset, presetModels, PRESETS } from "../../providerFilter";
import { VARIANTS } from "../../paretoVariants";

const cand = (over: Partial<Cand>): Cand => ({
  slug: "x",
  name: "X",
  creator: "X",
  index: 30,
  estimated: false,
  deprecated: false,
  usd: 1,
  tps: 100,
  ...over,
});

describe("bestCand — welche Zeile eine Familie vertritt", () => {
  it("nimmt gemessen vor geschätzt, auch wenn die geschätzte höher liegt", () => {
    // gemini-3.5-flash am 29.09.: medium geschätzt 33,6, high gemessen 32,6
    const c = bestCand(
      [
        cand({ slug: "medium", index: 33.6, estimated: true }),
        cand({ slug: "high", index: 32.6 }),
      ],
      "speed",
    );
    expect(c?.slug).toBe("high");
  });

  it("nimmt dann den höchsten Index, bei Gleichstand billiger bzw. schneller", () => {
    const zeilen = [
      cand({ slug: "a", index: 50, usd: 3, tps: 60 }),
      cand({ slug: "b", index: 52, usd: 5, tps: 50 }),
      cand({ slug: "c", index: 52, usd: 4, tps: 70 }),
    ];
    expect(bestCand(zeilen, "cost")?.slug).toBe("c");
    expect(bestCand(zeilen, "speed")?.slug).toBe("c");
    expect(
      bestCand(
        [
          cand({ slug: "a", index: 52, usd: 4, tps: 40 }),
          cand({ slug: "b", index: 52, usd: 4, tps: 90 }),
        ],
        "speed",
      )?.slug,
    ).toBe("b");
  });

  it("verlangt in der Kostenansicht Kosten, in der Tempoansicht ein Tempo", () => {
    const ohneKosten = [cand({ usd: null })];
    expect(bestCand(ohneKosten, "cost")).toBeUndefined();
    expect(bestCand(ohneKosten, "speed")).toBeDefined();
    expect(bestCand([cand({ tps: null })], "speed")).toBeUndefined();
  });
});

describe("Extras", () => {
  it("kein von AA geschätzter Index hat Kosten — deshalb gibt es „geschätzt“ nur beim Tempo", () => {
    const schaetz = AA_ROWS.filter((r) => r.intelligenceIndexIsEstimated);
    expect(schaetz.length).toBeGreaterThan(400);
    expect(
      schaetz.filter((r) => typeof r.intelligenceIndexCostPerTask === "number"),
    ).toStrictEqual([]);
    expect(AA_EXTRAS_COST.filter((p) => p.est)).toStrictEqual([]);
    expect(AA_EXTRAS_SPEED.filter((p) => p.est).length).toBe(18);
  });

  it("zählt, was die Folie in den Notizen und im ⓘ verspricht", () => {
    expect(PRODUCT_FAMILIES.size).toBe(90);
    expect(AA_EXTRAS_COST.length).toBe(28);
    expect(AA_EXTRAS_SPEED.length).toBe(48);
  });

  for (const [view, kurat, extras] of [
    ["cost", AA_COST, AA_EXTRAS_COST],
    ["speed", AA_SPEED, AA_EXTRAS_SPEED],
  ] as const) {
    describe(view, () => {
      it("kollidiert nie mit dem kuratierten Feld und hat eindeutige Labels", () => {
        const labels = [...kurat, ...extras].map((p) => p.label);
        expect(new Set(labels).size).toBe(labels.length);
        const keys = new Set(kurat.map((p) => familyKey(p.label)));
        for (const p of extras)
          expect(keys.has(familyKey(p.label)), p.label).toBe(false);
      });

      it("trägt Labels, die der Katalogabgleich wiederfindet (Schlüssel ist idempotent)", () => {
        for (const p of extras)
          expect(familyKey(p.label), p.label).toBe(p.label);
      });

      it("führt nur Modelle, die irgendein Produkt anbietet", () => {
        for (const p of extras)
          expect(
            (["cursor", "windsurf", "jetbrains-ai", "junie"] as const).some(
              (id) => catalogHas(id, p.label),
            ),
            p.label,
          ).toBe(true);
      });

      it("hat Werte im Rahmen: positive Kosten bzw. Tempo, Index 0–100", () => {
        for (const p of extras) {
          expect(p.x, p.label).toBeGreaterThan(0);
          expect(p.y, p.label).toBeGreaterThan(0);
          expect(p.y, p.label).toBeLessThan(100);
          expect(p.tps === undefined || p.tps > 0, p.label).toBe(true);
        }
      });
    });
  }

  it("zeigt kleine Kosten nicht als 0,00 €", () => {
    const klein = AA_EXTRAS_COST.filter((p) => p.x < 0.095);
    expect(klein.length).toBeGreaterThan(0);
    for (const p of klein) expect(p.eur, p.label).not.toBe("0,00");
  });

  it("gibt Claude-Extras das Kontingent ×0,8, allen anderen keines", () => {
    for (const p of AA_EXTRAS_COST) {
      if (p.label.startsWith("claude-")) expect(p.sub, p.label).toBeDefined();
      else expect(p.sub, p.label).toBeUndefined();
    }
  });
});

// Die Fronten je Produkt und Ansicht, gerechnet aus den Daten vom 29.09.2026.
// Sie sind der Kern der neuen Folienaussage: jedes Produkt an sich selbst
// gemessen, nicht am Markt. Bricht einer dieser Werte, hat sich ein Katalog oder
// der AA-Snapshot bewegt und die Sprechernotizen müssen mit.
describe("Front je Produkt", () => {
  const universe = (view: "aa-cost" | "aa-speed") => [
    ...VARIANTS[view].pts,
    ...VARIANTS[view].extras,
  ];
  const front = (
    view: "aa-cost" | "aa-speed",
    id: (typeof PRESETS)[number]["id"],
  ) => {
    const V = VARIANTS[view];
    const sel = new Set(presetModels(id, universe(view), V.pts));
    return paretoFront(
      universe(view).filter((p) => sel.has(p.label)),
    ).front.map((p) => p.label);
  };

  it("Kosten: JetBrains AI an den eigenen, älteren Modellen gemessen", () => {
    expect(front("aa-cost", "jetbrains-ai")).toStrictEqual([
      "gemini-3.1-flash-lite",
      "gpt-5-mini",
      "gemini-3.5-flash-lite",
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "claude-opus-5",
    ]);
  });

  it("Kosten: Junie führt dieselbe Spitze wie der Markt, Windsurf ebenfalls", () => {
    expect(front("aa-cost", "junie")).toStrictEqual([
      "gpt-6-luna",
      "gpt-6-sol",
      "gpt-6-astra",
      "claude-opus-5.5",
    ]);
    expect(front("aa-cost", "windsurf").at(-1)).toBe("claude-opus-5.5");
  });

  it("Kosten: Cursor kommt mit Opus 5 und Opus 5.5 auf die Front — Opus 5 kostet dort noch kaum weniger", () => {
    const f = front("aa-cost", "cursor");
    expect(f.slice(-2)).toStrictEqual(["claude-opus-5", "claude-opus-5.5"]);
  });

  it("Tempo: JetBrains AI hat elf Sprossen, die älteren Gemini vorn", () => {
    const f = front("aa-speed", "jetbrains-ai");
    expect(f[0]).toBe("gemini-2.5-flash-lite"); // geschätzter Index, hohes Tempo
    expect(f.at(-1)).toBe("claude-opus-5");
    expect(f.length).toBe(11);
  });

  it("Junie steht in beiden Ansichten auf der Front mit dem neuesten Claude", () => {
    expect(front("aa-speed", "junie")).toStrictEqual([
      "gemini-3.8-flash",
      "claude-sonnet-5.5",
      "claude-opus-5.5",
    ]);
  });
});

describe("Universe und „Alle“", () => {
  it("wählt bei „Alle“ nur das kuratierte Feld, auch wenn das Universe größer ist", () => {
    for (const id of ["aa-cost", "aa-speed"] as const) {
      const V = VARIANTS[id];
      const uni = [...V.pts, ...V.extras];
      expect(uni.length).toBeGreaterThan(V.pts.length);
      expect(presetModels("all", uni, V.pts)).toStrictEqual(
        V.pts.map((p) => p.label),
      );
    }
  });

  it("erkennt ein Produkt-Preset über das Universe und „Alle“ über das Feld", () => {
    const V = VARIANTS["aa-cost"];
    const uni = [...V.pts, ...V.extras];
    const jb = new Set(presetModels("jetbrains-ai", uni, V.pts));
    expect(jb.size).toBe(21);
    expect(matchingPreset(jb, uni, V.pts)?.id).toBe("jetbrains-ai");
    expect(
      matchingPreset(new Set(V.pts.map((p) => p.label)), uni, V.pts)?.id,
    ).toBe("all");
  });

  it("findet zu jeder Extra-Familie mindestens eine AA-Zeile mit Index", () => {
    for (const p of [...AA_EXTRAS_COST, ...AA_EXTRAS_SPEED])
      expect(aaFamily(p.label).length, p.label).toBeGreaterThan(0);
  });
});
