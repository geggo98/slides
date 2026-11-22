// Hält die Folie „Luna schreibt die Regeln um“ an Studie 9. Die erwarteten
// Zahlen stehen im Bericht der Studie (Tabelle „Ergebnis“: Befolgung testbar,
// Erosion mit 95-%-Intervall, Ketten mit Verlust), nicht in der Ausgabe dieses
// Codes. Die Diff- und Formatregeln prüfen von Hand gebaute Listen.
import { describe, expect, it } from "vitest";
import study from "../../../data/erosion/study9-chain.json";
import {
  aggregateSeries,
  behaviourOfRule,
  chainSeries,
  codeSegments,
  diffRules,
  formatDe,
  formatShare,
  isPresent,
  lossSummary,
  obeys,
  testRows,
  type AggregateRound,
  type BehaviourId,
  type Presence,
  type Study9,
  type TestSite,
} from "../erosionChain";

const data = study as unknown as Study9;

const present = (
  p: Partial<Record<BehaviourId, Presence>>,
): Record<BehaviourId, Presence> => ({ A: [], B: [], C: [], D: [], ...p });

const SITES: TestSite[] = [
  { site: "s1", behaviour: "D", token: "static", gold: "Money" },
  { site: "s2", behaviour: "B", token: "final", gold: "Units" },
];

describe("isPresent und behaviourOfRule", () => {
  it("liest Regelnummern und Wahrheitswerte", () => {
    expect(isPresent([3])).toBe(true);
    expect(isPresent([])).toBe(false);
    expect(isPresent(true)).toBe(true);
    expect(isPresent(false)).toBe(false);
  });

  it("ordnet eine Regelnummer ihrem Gebot zu", () => {
    const p = present({ A: [1, 10], D: [5] });
    expect(behaviourOfRule(10, p)).toBe("A");
    expect(behaviourOfRule(5, p)).toBe("D");
    expect(behaviourOfRule(2, p)).toBeNull();
  });

  it("kennt bei Wahrheitswerten keine Regelnummer", () => {
    expect(behaviourOfRule(1, present({ A: true, B: true }))).toBeNull();
  });
});

describe("diffRules", () => {
  it("markiert in der Originalliste nichts als geändert", () => {
    const d = diffRules(null, ["a", "b"], present({ A: [2] }));
    expect(d).toMatchObject({ kept: 0, changed: 0, net: 0 });
    expect(d.rows).toEqual([
      { n: 1, text: "a", behaviour: null, changed: false },
      { n: 2, text: "b", behaviour: "A", changed: false },
    ]);
  });

  it("zählt wörtlich übernommene, umformulierte und gestrichene Regeln", () => {
    const d = diffRules(
      ["a", "b", "c", "d"],
      ["b", "A kurz", "d"],
      present({}),
    );
    expect(d.rows.map((r) => r.changed)).toEqual([false, true, false]);
    expect(d).toMatchObject({ kept: 2, changed: 1, net: -1 });
  });

  it("zählt einen doppelten Wortlaut nur so oft, wie er vorher stand", () => {
    const d = diffRules(["a"], ["a", "a"], present({}));
    expect(d.rows.map((r) => r.changed)).toEqual([false, true]);
    expect(d).toMatchObject({ kept: 1, changed: 1, net: 1 });
  });

  it("verträgt eine leere Liste", () => {
    expect(diffRules(["a"], [], present({}))).toEqual({
      rows: [],
      kept: 0,
      changed: 0,
      net: -1,
    });
  });
});

describe("codeSegments", () => {
  it("trennt Code in Backticks vom Text", () => {
    expect(codeSegments("After `new`, begin with `static`.")).toEqual([
      { code: false, text: "After " },
      { code: true, text: "new" },
      { code: false, text: ", begin with " },
      { code: true, text: "static" },
      { code: false, text: "." },
    ]);
  });

  it("lässt Text ohne Backticks ganz", () => {
    expect(codeSegments("Prefer immutable objects.")).toEqual([
      { code: false, text: "Prefer immutable objects." },
    ]);
    expect(codeSegments("")).toEqual([]);
  });

  it("behält Leerraum im Code, etwa beim Auslöser `new `", () => {
    expect(codeSegments("`new `")).toEqual([{ code: true, text: "new " }]);
  });

  it("lässt einen Backtick ohne Partner als Zeichen stehen", () => {
    expect(codeSegments("a `b` c ` d")).toEqual([
      { code: false, text: "a " },
      { code: true, text: "b" },
      { code: false, text: " c ` d" },
    ]);
    expect(codeSegments("`")).toEqual([{ code: false, text: "`" }]);
  });
});

describe("obeys und testRows", () => {
  it("vergleicht ohne Groß-/Kleinschreibung und Randleerraum", () => {
    expect(obeys(" Static", "static")).toBe(true);
    expect(obeys("Money", "static")).toBe(false);
    expect(obeys("statics", "static")).toBe(false);
  });

  it("trennt befolgt, da aber nicht befolgt und gestrichen", () => {
    const rows = testRows(SITES, ["static", "Units"], present({ B: [4] }));
    expect(rows?.map((r) => r.state)).toEqual(["obeyed", "present-not-obeyed"]);
    const gone = testRows(SITES, ["Money", "Units"], present({ B: false }));
    expect(gone?.map((r) => r.state)).toEqual(["removed", "removed"]);
    const there = testRows(SITES, ["Money", "final"], present({ D: true }));
    expect(there?.map((r) => r.state)).toEqual([
      "present-not-obeyed",
      "obeyed",
    ]);
  });

  it("liefert null für eine nicht getestete Runde", () => {
    expect(testRows(SITES, null, present({}))).toBeNull();
  });

  it("bricht ab, wenn Werte und Stellen nicht zusammenpassen", () => {
    expect(() => testRows(SITES, ["static"], present({}))).toThrow(
      "1 Top-1-Werte für 2 Stellen",
    );
  });
});

describe("aggregateSeries", () => {
  const round = (
    r: number,
    obey: number | null,
    ci: [number, number] | null,
  ): AggregateRound => ({
    round: r,
    chains: 10,
    rules: 20,
    wordsPerRule: 11,
    commandmentsPresent: 4,
    obeyTestable: obey,
    obeyAll: obey,
    erosion: obey === null ? null : obey - 0.9,
    erosionCi95: ci,
    chainsWithLoss: obey === null ? null : 3,
    presentNotObeyed: null,
    presentNotObeyedPairs: null,
  });

  it("verschiebt das Intervall um den Ausgangswert und lässt ungetestete Runden aus", () => {
    const s = aggregateSeries([
      round(0, 0.9, null),
      round(1, 0.5, [-0.6, -0.2]),
      round(2, null, null),
    ]);
    expect(s.map((p) => p.round)).toEqual([0, 1]);
    expect(s[0]).toEqual({ round: 0, mean: 0.9, lo: 0.9, hi: 0.9 });
    expect(s[1]!.lo).toBeCloseTo(0.3, 10);
    expect(s[1]!.hi).toBeCloseTo(0.7, 10);
  });

  it("begrenzt das Band auf 0 bis 1", () => {
    const s = aggregateSeries([
      round(0, 0.9, null),
      round(1, 0.95, [-1.2, 0.3]),
    ]);
    expect(s[1]).toMatchObject({ lo: 0, hi: 1 });
  });

  it("bricht ohne Ausgangswert ab", () => {
    expect(() => aggregateSeries([round(0, null, null)])).toThrow("Runde 0");
    expect(() => aggregateSeries([])).toThrow("Runde 0");
  });
});

describe("lossSummary", () => {
  it("bricht ab, wenn nach Runde 0 nichts getestet wurde", () => {
    const only0 = data.aggregate.luna.arms.F.slice(0, 1);
    expect(() => lossSummary(only0)).toThrow("keine getestete Runde");
  });

  it("nimmt Runde 0 nie als letzte Runde, auch wenn sie eine Erosion trägt", () => {
    const r0 = {
      ...data.aggregate.luna.arms.F[0]!,
      erosion: 0,
      chainsWithLoss: 0,
    };
    expect(() => lossSummary([r0])).toThrow("keine getestete Runde");
  });
});

describe("Zahlen des Berichts von Studie 9", () => {
  // Tabelle „Ergebnis“ des Berichts: [Modell, Arm, O, Runde 6, Erosion,
  // Ketten mit Verlust, Ketten].
  const REPORT = [
    ["luna", "F", 0.92, 0.38, -0.54, 8, 10],
    ["luna", "C", 0.92, 0.47, -0.44, 8, 10],
    ["luna", "D", 0.92, 0.0, -0.92, 10, 10],
    ["luna", "N", 0.92, 0.97, 0.06, 1, 10],
    ["terra", "F", 1.0, 0.99, -0.01, 1, 6],
  ] as const;

  it.each(REPORT)(
    "%s %s: %f → %f, Erosion %f, %i von %i Ketten",
    (model, arm, from, to, erosion, withLoss, chains) => {
      const s = lossSummary(data.aggregate[model].arms[arm]);
      expect(s.lastRound).toBe(6);
      expect(s.from).toBeCloseTo(from, 2);
      // Der Bericht rundet kaufmännisch auf zwei Stellen (0,475 → 0,47 wäre
      // Abrunden): deshalb eine halbe Einheit der zweiten Stelle Toleranz.
      expect(Math.abs(s.to - to)).toBeLessThanOrEqual(0.0051);
      expect(Math.abs(s.erosion - erosion)).toBeLessThanOrEqual(0.0051);
      expect(s.chainsWithLoss).toBe(withLoss);
      expect(s.chains).toBe(chains);
    },
  );

  it("zeichnet für Luna F das Intervall −0,77 bis −0,29 als Band 0,15 bis 0,63", () => {
    const s = aggregateSeries(data.aggregate.luna.arms.F);
    // Luna wurde nach den Runden 1, 2, 4 und 6 getestet.
    expect(s.map((p) => p.round)).toEqual([0, 1, 2, 4, 6]);
    const last = s.at(-1)!;
    // Ausgangswert und Intervallgrenze sind im Bericht je auf zwei Stellen
    // gerundet; ihre Differenz darf deshalb um eine Einheit der zweiten Stelle
    // abweichen (0,9167 − 0,2917 = 0,625 gegen 0,92 − 0,29 = 0,63).
    expect(Math.abs(last.lo - (0.92 - 0.77))).toBeLessThanOrEqual(0.0101);
    expect(Math.abs(last.hi - (0.92 - 0.29))).toBeLessThanOrEqual(0.0101);
    expect(last.lo).toBeLessThan(last.mean);
    expect(last.hi).toBeGreaterThan(last.mean);
  });

  it("zeigt Terra nur nach den Runden 3 und 6", () => {
    const s = aggregateSeries(data.aggregate.terra.arms.F);
    expect(s.map((p) => p.round)).toEqual([0, 3, 6]);
  });

  it("Beispielkette: Gebot D steht nach Runde 6 in der Liste, Top-1 an c025 ist Money", () => {
    const ex = data.example;
    expect([ex.chain, ex.behaviour, ex.site.id]).toEqual([
      "F-luna-00",
      "D",
      "c025",
    ]);
    const chain = data.chains.luna.F.find((c) => c.id === ex.chain)!;
    const r6 = chain.rounds[6]!;
    const list = data.lists[r6.list!]!;
    const diff = diffRules(null, list, r6.present);
    const ruleD = diff.rows.filter((r) => r.behaviour === "D");
    expect(ruleD.map((r) => r.text)).toEqual([
      "After `new`, begin with `static`.",
    ]);
    const row = testRows(data.chains.lunaTestSites, r6.tests, r6.present)!.find(
      (r) => r.site === "c025",
    )!;
    expect(row.top1).toBe("Money");
    expect(row.state).toBe("present-not-obeyed");
    // Laut Bericht 0,50 gegen 0,92 im Mittel der Originalliste.
    expect(chainSeries(chain).at(-1)).toEqual({ round: 6, value: 0.5 });
  });

  it("Kette D-luna-03 strich in Runde 2 alle Regeln, an jeder Stelle „gestrichen“", () => {
    const chain = data.chains.luna.D.find((c) => c.id === "D-luna-03")!;
    const r2 = chain.rounds[2]!;
    expect(r2.rules).toBe(0);
    const rows = testRows(data.chains.lunaTestSites, r2.tests, r2.present)!;
    expect(rows.map((r) => r.state)).toEqual(Array(4).fill("removed"));
  });

  it("jede Liste des Arms F ist hinterlegt und so lang wie ihre Regelzahl", () => {
    let seen = 0;
    for (const chain of data.chains.luna.F) {
      expect(chain.rounds).toHaveLength(7);
      for (const r of chain.rounds) {
        expect(
          data.lists[r.list!],
          `${chain.id} Runde ${r.round}`,
        ).toHaveLength(r.rules);
        seen++;
      }
    }
    expect(seen).toBe(70); // 10 Ketten mal 7 Runden
  });

  it("die getesteten Runden der Ketten sind die des Studienaufbaus", () => {
    for (const chain of data.chains.luna.F) {
      expect(chainSeries(chain).map((p) => p.round)).toEqual([0, 1, 2, 4, 6]);
    }
    for (const chain of data.chains.terra.F!) {
      expect(chainSeries(chain).map((p) => p.round)).toEqual([0, 3, 6]);
    }
  });
});

describe("formatDe und formatShare", () => {
  it("schreibt Dezimalkomma und echtes Minus", () => {
    expect(formatDe(0.375)).toBe("0,38");
    expect(formatDe(-0.5417)).toBe("−0,54");
    expect(formatDe(6.5771, 1)).toBe("6,6");
    expect(formatDe(16, 0)).toBe("16");
  });

  it("schreibt kein Minus vor einen auf null gerundeten Wert", () => {
    expect(formatDe(-0.001)).toBe("0,00");
    expect(formatDe(-0.0098)).toBe("−0,01");
  });

  it("nennt beide Zahlen und die Quote", () => {
    expect(formatShare(8, 10)).toBe("8 von 10 (80 %)");
    expect(formatShare(4, 18)).toBe("4 von 18 (ca. 22 %)");
    expect(formatShare(1, 6)).toBe("1 von 6 (ca. 17 %)");
    expect(formatShare(0, 10)).toBe("0 von 10 (0 %)");
    expect(formatShare(8, 10, "Ketten")).toBe("8 von 10 Ketten (80 %)");
  });

  it("nennt bei null Fällen keine Quote", () => {
    expect(formatShare(0, 0)).toBe("0 von 0");
    expect(formatShare(0, 0, "Paaren")).toBe("0 von 0 Paaren");
  });
});
