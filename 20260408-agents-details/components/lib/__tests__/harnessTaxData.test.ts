import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bestHarnessCounts,
  bestHarnesses,
  CONTEXT_SWE,
  costPerSolve,
  eur,
  frontFor,
  geoCostRatio,
  harnessPairs,
  holdsGiveUpThesis,
  MODEL_LABELS,
  meanSuccessDelta,
  NATIVE,
  nativeComparisons,
  nativeUpgrades,
  nativeWinRate,
  pointsFor,
  STEPS_SWE,
  stepsFor,
  subsetFront,
  SWE,
  TB2,
  type Bench,
  type Harness,
  type HModel,
} from "../../harnessTaxData";

// Rechnet die beiden HarnessTax-Folien gegen die archivierten Rohdaten unter
// `data/harnesstax/` nach — dieselbe Kultur wie `boardArchive.test.ts` für die
// DeepSWE-Zahlen: Werte, die einmal von Hand aus einer Studie übertragen
// wurden, driften unbemerkt vom Original weg, wenn nichts sie nachrechnet.
//
// Der Test liest ausschließlich committete Dateien und ruft nichts ab.

const DIR = join(import.meta.dirname, "../../../data/harnesstax");

interface RawPoint {
  id: string;
  model: string;
  model_label: string;
  harness: string;
  x: number;
  x_ci: [number, number];
  y: number;
  y_ci: [number, number];
  bootstrap: number;
}
/** Die Studie liefert je Harness (`model: null`) und je Modell
 * (`harness: null`) eine eigene Teil-Front als Liste von Punkt-IDs. */
interface RawSubset {
  model: string | null;
  harness: string | null;
  path: string[];
}
interface RawFrontier {
  frontier: { points: RawPoint[]; subsets: RawSubset[] };
}
const raw = (file: string): RawFrontier =>
  JSON.parse(readFileSync(join(DIR, file), "utf8")) as RawFrontier;

const rawSwe = raw("frontier-swe.json");
const rawTb = raw("frontier-tb.json");

function findRaw(points: RawPoint[], model: string, harness: string): RawPoint {
  const p = points.find((r) => r.model === model && r.harness === harness);
  if (!p) throw new Error(`kein Rohpunkt für ${model}·${harness}`);
  return p;
}

describe("SWE und TB2 gegen die archivierten Rohdaten", () => {
  it("haben je 21 Paare, wie die Studie sie ausweist (7 Modelle × 3 Harnesse)", () => {
    expect(SWE.length).toBe(21);
    expect(TB2.length).toBe(21);
    expect(rawSwe.frontier.points.length).toBe(21);
    expect(rawTb.frontier.points.length).toBe(21);
  });

  it.each([
    ["SWE-bench Lite", SWE, rawSwe],
    ["Terminal-Bench 2.0", TB2, rawTb],
  ] as const)(
    "%s: jeder Punkt stimmt auf 6 Nachkommastellen",
    (_name, pts, source) => {
      for (const p of pts) {
        const r = findRaw(source.frontier.points, p.model, p.harness);
        expect(p.usd).toBeCloseTo(r.x, 6);
        expect(p.usdCi[0]).toBeCloseTo(r.x_ci[0], 6);
        expect(p.usdCi[1]).toBeCloseTo(r.x_ci[1], 6);
        expect(p.y).toBeCloseTo(r.y * 100, 4);
        expect(p.yCi[0]).toBeCloseTo(r.y_ci[0] * 100, 4);
        expect(p.yCi[1]).toBeCloseTo(r.y_ci[1] * 100, 4);
        expect(p.bootstrap).toBeCloseTo(r.bootstrap, 6);
        expect(p.modelLabel).toBe(r.model_label);
      }
    },
  );

  it("MODEL_LABELS deckt jedes in SWE/TB2 vorkommende Modell", () => {
    for (const p of [...SWE, ...TB2]) {
      expect(MODEL_LABELS[p.model as HModel]).toBe(p.modelLabel);
    }
  });
});

describe("Pareto-Front stimmt mit dem, was die Studie selbst als „frontier“ markiert", () => {
  it("SWE-bench Lite: 7 von 21 Punkten auf der Front", () => {
    const { front } = frontFor("swe");
    expect(front.length).toBe(7);
    expect(new Set(front.map((p) => `${p.model}:${p.harness}`))).toEqual(
      new Set([
        "luna:pi",
        "luna:codex",
        "haiku:pi",
        "sol:pi",
        "opus:pi",
        "fable:pi",
        "fable:cc",
      ]),
    );
  });

  it("Terminal-Bench 2.0: 2 von 21 Punkten auf der Front, beide Pi", () => {
    const { front } = frontFor("tb");
    expect(front.length).toBe(2);
    expect(front.every((p) => p.harness === "pi")).toBe(true);
    expect(new Set(front.map((p) => p.model))).toEqual(
      new Set(["luna", "sol"]),
    );
  });

  it("stimmt mit den `frontier`-Flags überein, die die Studie selbst setzt", () => {
    for (const [bench, source] of [
      ["swe", rawSwe],
      ["tb", rawTb],
    ] as const) {
      const { front } = frontFor(bench);
      const frontKeys = new Set(front.map((p) => `${p.model}:${p.harness}`));
      const rawFrontKeys = new Set(
        source.frontier.points
          .filter((p: RawPoint & { frontier?: boolean }) => p.frontier)
          .map((p) => `${p.model}:${p.harness}`),
      );
      expect(frontKeys).toEqual(rawFrontKeys);
    }
  });
});

describe("Finding 3: native Harness gewinnt nur in 3 von 12 Vergleichen", () => {
  it("6 Anthropic/OpenAI-Modelle × 2 Benchmarks ergeben 12 Vergleiche", () => {
    expect(Object.keys(NATIVE).length).toBe(6);
    const { total } = nativeWinRate(["swe", "tb"]);
    expect(total).toBe(12);
  });

  it("native gewinnt in genau 3 von 12 — Fable 5 zweimal, Luna einmal (Gleichstand auf SWE)", () => {
    const { wins, total } = nativeWinRate(["swe", "tb"]);
    expect(wins).toBe(3);
    expect(total).toBe(12);
    const swe = nativeComparisons("swe").filter((r) => r.nativeWins);
    const tb = nativeComparisons("tb").filter((r) => r.nativeWins);
    // Fable 5 gewinnt eindeutig auf beiden Benchmarks. Luna gewinnt auf SWE
    // nur im Gleichstand: codex (55,5556 %) und cc (55,5556 %) runden beide
    // auf 55,6 % — Luna zählt trotzdem als „native gewinnt", weil ihr
    // natives Harness (codex) unter den Bestplatzierten ist.
    expect(new Set(swe.map((r) => r.model))).toEqual(
      new Set(["fable", "luna"]),
    );
    expect(new Set(tb.map((r) => r.model))).toEqual(new Set(["fable"]));
  });

  it("Opus, Sonnet und Haiku verlieren gegen einen fremden Harness auf beiden Benchmarks", () => {
    for (const model of ["opus", "sonnet", "haiku"] as const) {
      for (const bench of ["swe", "tb"] as const) {
        const r = nativeComparisons(bench).find((x) => x.model === model);
        expect(r?.nativeWins).toBe(false);
      }
    }
  });

  it("bei den vier Anthropic-Modellen (natives Harness Claude Code) gewinnt Claude Code nur in 2 von 8", () => {
    const anthropic = ["fable", "opus", "sonnet", "haiku"] as const;
    const rows = [
      ...nativeComparisons("swe"),
      ...nativeComparisons("tb"),
    ].filter((r) => anthropic.includes(r.model as (typeof anthropic)[number]));
    expect(rows.length).toBe(8);
    expect(rows.filter((r) => r.nativeWins).length).toBe(2);
  });
});

describe("Kostenverhältnisse (geometrisches Mittel), wie im Blogpost genannt", () => {
  it("SWE-bench Lite: Claude Code ≈ 2,0× Pi und ≈ 1,6× Codex", () => {
    expect(geoCostRatio("cc", "pi", "swe")).toBeCloseTo(2.03, 1);
    expect(geoCostRatio("cc", "codex", "swe")).toBeCloseTo(1.56, 1);
    expect(geoCostRatio("codex", "pi", "swe")).toBeCloseTo(1.3, 1);
  });

  it("Terminal-Bench 2.0: Claude Code ≈ 1,5× Pi", () => {
    expect(geoCostRatio("cc", "pi", "tb")).toBeCloseTo(1.52, 1);
  });

  it("schlimmster Einzelfall: GPT-5.6 Luna kostet in Claude Code ≈ 5,1× so viel wie in Pi (SWE)", () => {
    const luna = SWE.filter((p) => p.model === "luna");
    const cc = luna.find((p) => p.harness === "cc")!;
    const pi = luna.find((p) => p.harness === "pi")!;
    expect(cc.usd / pi.usd).toBeCloseTo(5.09, 1);
    expect(cc.y - pi.y).toBeCloseTo(2.22, 1);
  });
});

describe("Harness-Effekt auf den Erfolg bleibt im Mittel klein", () => {
  it("SWE-bench Lite: ±2 Prozentpunkte gegenüber Pi", () => {
    expect(meanSuccessDelta("cc", "pi", "swe")).toBeCloseTo(1.4, 0);
    expect(meanSuccessDelta("codex", "pi", "swe")).toBeCloseTo(1.7, 0);
  });

  it("Terminal-Bench 2.0: Claude Code und Codex liegen im Mittel UNTER Pi", () => {
    expect(meanSuccessDelta("cc", "pi", "tb")).toBeCloseTo(-4.9, 0);
    expect(meanSuccessDelta("codex", "pi", "tb")).toBeCloseTo(-4.3, 0);
  });
});

describe("Ausdauer: Steps und Tokens gegen die archivierte Tabelle", () => {
  interface RawStepFile {
    steps: { system: string; value: string; success: string }[];
  }
  const rawSteps = JSON.parse(
    readFileSync(join(DIR, "steps-swe.json"), "utf8"),
  ) as RawStepFile;

  it("hat 21 Zeilen, eine je Modell×Harness-Paar", () => {
    expect(STEPS_SWE.length).toBe(21);
    expect(rawSteps.steps.length).toBe(21);
  });

  it("jede Zeile stimmt mit der Rohtabelle überein (system = „Modell · Harness“)", () => {
    const harnessLabel: Record<string, string> = {
      pi: "Pi",
      codex: "Codex",
      cc: "Claude Code",
    };
    for (const r of STEPS_SWE) {
      const wanted = `${MODEL_LABELS[r.model]} · ${harnessLabel[r.harness]}`;
      const row = rawSteps.steps.find((x) => x.system === wanted);
      expect(row, `keine Rohzeile für „${wanted}“`).toBeDefined();
      expect(r.steps).toBeCloseTo(Number(row!.value), 6);
    }
  });

  it("Claude Fable 5: praktisch gleiche Schrittzahl in Pi und Claude Code (15,4 vs. 15,3)", () => {
    const pi = stepsFor("fable", "pi")!;
    const cc = stepsFor("fable", "cc")!;
    expect(Math.abs(pi.steps - cc.steps)).toBeLessThan(0.2);
    // Der Aufpreis (2,0×) steckt trotzdem im Preis — die These "mehr
    // Schritte wegen Nicht-Aufgeben" trägt diesen Fall NICHT.
    const swePi = SWE.find((p) => p.model === "fable" && p.harness === "pi")!;
    const sweCc = SWE.find((p) => p.model === "fable" && p.harness === "cc")!;
    expect(sweCc.usd / swePi.usd).toBeGreaterThan(1.9);
  });

  it("GPT-5.6 Luna: Claude Code lässt 3,4× so viele Schritte laufen wie Pi", () => {
    const pi = stepsFor("luna", "pi")!;
    const cc = stepsFor("luna", "cc")!;
    expect(cc.steps / pi.steps).toBeCloseTo(3.4, 1);
    expect(cc.tokens / pi.tokens).toBeCloseTo(6.77, 1);
  });

  it("Claude Haiku 4.5: Claude Code bricht FRÜHER ab als Pi und Codex, nicht später", () => {
    const cc = stepsFor("haiku", "cc")!;
    const pi = stepsFor("haiku", "pi")!;
    const codex = stepsFor("haiku", "codex")!;
    expect(cc.steps).toBeLessThan(pi.steps);
    expect(cc.steps).toBeLessThan(codex.steps);
  });
});

describe("holdsGiveUpThesis: die drei Antworten der Ausdauer-Folie", () => {
  // Die These wörtlich: eigener Harness (Claude Code) läuft LÄNGER UND löst
  // MEHR als der Vier-Werkzeuge-Harness (Pi). Nachgerechnet direkt gegen die
  // Steps- und Erfolgs-Archive, unabhängig von holdsGiveUpThesis() selbst —
  // sonst würde der Test nur die Implementierung gegen sich selbst prüfen.
  it("GPT-5.6 Luna: trägt die These (mehr Schritte UND mehr gelöst)", () => {
    const stepsCc = stepsFor("luna", "cc")!.steps;
    const stepsPi = stepsFor("luna", "pi")!.steps;
    const yCc = SWE.find((p) => p.model === "luna" && p.harness === "cc")!.y;
    const yPi = SWE.find((p) => p.model === "luna" && p.harness === "pi")!.y;
    expect(stepsCc).toBeGreaterThan(stepsPi);
    expect(yCc).toBeGreaterThan(yPi);
    expect(holdsGiveUpThesis("luna")).toBe(true);
  });

  it("Claude Fable 5: widerlegt die These (praktisch gleiche Schrittzahl)", () => {
    const stepsCc = stepsFor("fable", "cc")!.steps;
    const stepsPi = stepsFor("fable", "pi")!.steps;
    expect(stepsCc).toBeLessThan(stepsPi); // 15,3 gegen 15,4 — knapp, aber nicht "mehr"
    expect(holdsGiveUpThesis("fable")).toBe(false);
  });

  it("Claude Haiku 4.5: widerlegt die These klar (weniger Schritte UND weniger gelöst)", () => {
    const stepsCc = stepsFor("haiku", "cc")!.steps;
    const stepsPi = stepsFor("haiku", "pi")!.steps;
    const yCc = SWE.find((p) => p.model === "haiku" && p.harness === "cc")!.y;
    const yPi = SWE.find((p) => p.model === "haiku" && p.harness === "pi")!.y;
    expect(stepsCc).toBeLessThan(stepsPi);
    expect(yCc).toBeLessThan(yPi);
    expect(holdsGiveUpThesis("haiku")).toBe(false);
  });

  it("liefert genau {luna: true, fable: false, haiku: false} — die drei Folien-Modelle", () => {
    const result = {
      luna: holdsGiveUpThesis("luna"),
      fable: holdsGiveUpThesis("fable"),
      haiku: holdsGiveUpThesis("haiku"),
    };
    expect(result).toEqual({ luna: true, fable: false, haiku: false });
  });
});

describe("Erstkontext gegen die archivierten Mittelwerte", () => {
  interface RawContextFile {
    context: {
      rows: {
        harness: string;
        tool_count: { mean: number };
        tool_schema_chars: { mean: number };
        instruction_chars: { mean: number };
        first_call_context_tokens: { mean: number; sd: number };
        n: number;
      }[];
    };
  }
  const rawCtx = JSON.parse(
    readFileSync(join(DIR, "agent-context-swe.json"), "utf8"),
  ) as RawContextFile;

  it("jede Zeile stimmt auf zwei Nachkommastellen", () => {
    for (const r of CONTEXT_SWE) {
      const key = r.harness === "cc" ? "claude-code" : r.harness;
      const raw = rawCtx.context.rows.find((x) => x.harness === key);
      expect(raw, `keine Rohzeile für ${key}`).toBeDefined();
      expect(r.toolCount).toBeCloseTo(raw!.tool_count.mean, 2);
      expect(r.toolSchemaChars).toBeCloseTo(raw!.tool_schema_chars.mean, 2);
      expect(r.instructionChars).toBeCloseTo(raw!.instruction_chars.mean, 2);
      expect(r.contextTokensMean).toBeCloseTo(
        raw!.first_call_context_tokens.mean,
        2,
      );
      expect(r.n).toBe(630);
    }
  });

  it("Claude Code hat 13,7× so viel Erstkontext wie Pi", () => {
    const pi = CONTEXT_SWE.find((r) => r.harness === "pi")!;
    const cc = CONTEXT_SWE.find((r) => r.harness === "cc")!;
    expect(cc.contextTokensMean / pi.contextTokensMean).toBeCloseTo(13.7, 1);
    expect(cc.toolCount).toBe(23);
    expect(cc.toolSchemaChars).toBeGreaterThan(75000);
  });

  it("Codex' Aufschlag steckt in den Instruktionen, Claude Codes im Werkzeug-Schema", () => {
    const codex = CONTEXT_SWE.find((r) => r.harness === "codex")!;
    const cc = CONTEXT_SWE.find((r) => r.harness === "cc")!;
    expect(codex.instructionChars).toBeGreaterThan(cc.instructionChars);
    expect(cc.toolSchemaChars).toBeGreaterThan(codex.toolSchemaChars);
  });
});

describe("€-Ableitung", () => {
  it("eur() rechnet mit 1 USD = 0,876 €, wie im Rest des Decks", () => {
    for (const p of [...SWE, ...TB2]) {
      expect(eur(p.usd)).toBeCloseTo(p.usd * 0.876, 10);
    }
  });

  it("costPerSolve ist €/Rollout geteilt durch die Erfolgsquote", () => {
    const p = pointsFor("swe")[0]!;
    expect(costPerSolve(p)).toBeCloseTo(eur(p.usd) / (p.y / 100), 10);
  });
});

// ---------------------------------------------------------------------------
// Ableitungen für das Chart (Schritte 2 und 3, Legenden-Hervorhebung).
// ---------------------------------------------------------------------------

const RAW: Record<Bench, RawFrontier> = { swe: rawSwe, tb: rawTb };
const key = (p: { model: string; harness: string }) =>
  `${p.model}:${p.harness}`;
const round1 = (v: number) => Math.round(v * 10) / 10;

describe("subsetFront: Harness-Teilfronten gleich den `frontier.subsets` der Studie", () => {
  it.each(["swe", "tb"] as const)(
    "%s: drei Harness-Teilfronten (model: null), je eine pro Harness",
    (bench) => {
      const subsets = RAW[bench].frontier.subsets.filter(
        (s) => s.model === null && s.harness !== null,
      );
      expect(subsets.length).toBe(3);
      expect(new Set(subsets.map((s) => s.harness))).toEqual(
        new Set(["pi", "codex", "cc"]),
      );
    },
  );

  it.each(["swe", "tb"] as const)(
    "%s: jede Teilfront enthält genau die Punkte, die die Studie im Subset-Pfad nennt",
    (bench) => {
      const byId = new Map(RAW[bench].frontier.points.map((p) => [p.id, p]));
      for (const s of RAW[bench].frontier.subsets) {
        if (s.model !== null || s.harness === null) continue;
        const h = s.harness as Harness;
        const wanted = new Set(
          s.path.map((id) => {
            const p = byId.get(id);
            if (!p) throw new Error(`Subset-Pfad nennt unbekannte ID ${id}`);
            return key(p);
          }),
        );
        const got = new Set(
          subsetFront(bench, (p) => p.harness === h).map((p) => key(p)),
        );
        expect(got, `${bench} · ${h}`).toEqual(wanted);
      }
    },
  );

  it("SWE-bench Lite: Pi 5, Codex 5, Claude Code 5 — Terminal-Bench 2.0: 2, 2, 3 Punkte", () => {
    const n = (b: Bench, h: Harness) =>
      subsetFront(b, (p) => p.harness === h).length;
    expect([n("swe", "pi"), n("swe", "codex"), n("swe", "cc")]).toEqual([
      5, 5, 5,
    ]);
    expect([n("tb", "pi"), n("tb", "codex"), n("tb", "cc")]).toEqual([2, 2, 3]);
  });

  it("die Teilfront eines Harness ist eine Teilmenge seiner Punkte und nach USD sortiert", () => {
    for (const bench of ["swe", "tb"] as const) {
      for (const h of ["pi", "codex", "cc"] as const) {
        const f = subsetFront(bench, (p) => p.harness === h);
        expect(f.every((p) => p.harness === h)).toBe(true);
        for (let i = 1; i < f.length; i++) {
          expect(f[i]!.usd).toBeGreaterThan(f[i - 1]!.usd);
          expect(f[i]!.y).toBeGreaterThan(f[i - 1]!.y);
        }
      }
    }
  });
});

describe("harnessPairs: die Aufpreis-Pfeile Pi → Claude Code (Schritt 2)", () => {
  // Erwartungswerte aus dem Archiv, nachgerechnet am 20.09.2026: Verhältnis
  // = usd(cc) / usd(pi) auf UNGERUNDETEN Werten, dann eine Nachkommastelle;
  // Differenz = y(cc) − y(pi) in Prozentpunkten, ebenso. Der Plan nannte
  // Luna 5,0×, Haiku 1,2× (SWE) und Luna 2,0× (TB) — das sind Quotienten
  // der auf zwei Stellen gerundeten Dollarbeträge, nicht der Rohwerte;
  // die Folie sagt selbst „bis 5,1× bei Luna".
  const EXPECTED: Record<Bench, Record<HModel, [number, number]>> = {
    swe: {
      luna: [5.1, 2.2],
      sol: [3.5, 3.3],
      opus: [2.1, 4.4],
      fable: [2.0, 1.1],
      kimi: [1.7, 4.4],
      haiku: [1.1, -7.8],
      sonnet: [1.0, 2.2],
    },
    tb: {
      sol: [3.2, -12.2],
      luna: [2.2, -6.7],
      fable: [1.4, 4.4],
      kimi: [1.4, -6.7],
      opus: [1.2, -3.3],
      sonnet: [1.1, -3.3],
      haiku: [1.1, -6.7],
    },
  };

  it.each(["swe", "tb"] as const)(
    "%s: sieben Paare, eines je Modell",
    (bench) => {
      const pairs = harnessPairs(bench, "pi", "cc");
      expect(pairs.length).toBe(7);
      expect(new Set(pairs.map((p) => p.model)).size).toBe(7);
      for (const p of pairs) {
        expect(p.from.harness).toBe("pi");
        expect(p.to.harness).toBe("cc");
        expect(p.from.model).toBe(p.model);
        expect(p.to.model).toBe(p.model);
      }
    },
  );

  it.each(["swe", "tb"] as const)(
    "%s: Kostenfaktor und Erfolgsdifferenz je Modell, auf eine Stelle gerundet",
    (bench) => {
      const raw = RAW[bench].frontier.points;
      for (const p of harnessPairs(bench, "pi", "cc")) {
        const [ratio, delta] = EXPECTED[bench][p.model];
        expect(round1(p.costRatio), `${bench} ${p.model} ratio`).toBe(ratio);
        expect(round1(p.dSuccess), `${bench} ${p.model} delta`).toBe(delta);
        // … und unabhängig von SWE/TB2 direkt gegen das Archiv:
        const cc = findRaw(raw, p.model, "cc");
        const pi = findRaw(raw, p.model, "pi");
        expect(p.costRatio).toBeCloseTo(cc.x / pi.x, 6);
        expect(p.dSuccess).toBeCloseTo((cc.y - pi.y) * 100, 4);
      }
    },
  );

  it("das geometrische Mittel der Paare ist geoCostRatio (SWE 2,0×, TB 1,5×)", () => {
    for (const [bench, want] of [
      ["swe", 2.0],
      ["tb", 1.5],
    ] as const) {
      const pairs = harnessPairs(bench, "pi", "cc");
      const geo = Math.exp(
        pairs.reduce((s, p) => s + Math.log(p.costRatio), 0) / pairs.length,
      );
      expect(geo).toBeCloseTo(geoCostRatio("cc", "pi", bench), 10);
      expect(round1(geo)).toBe(want);
    }
  });

  it("Sonnet auf SWE-bench Lite ist der einzige Fall, in dem Claude Code BILLIGER ist als Pi", () => {
    const cheaper = (["swe", "tb"] as const).flatMap((b) =>
      harnessPairs(b, "pi", "cc")
        .filter((p) => p.costRatio < 1)
        .map((p) => `${b}:${p.model}`),
    );
    expect(cheaper).toEqual(["swe:sonnet"]);
  });
});

describe("bestHarnesses: höchster Erfolg je Modell (Zähltabelle aus dem Faktencheck)", () => {
  // Gleichstand-Regel: `best` nennt ALLE Harnesse mit der höchsten Quote, und
  // die Zähltabelle zählt einen Gleichstand für jeden Beteiligten. Deshalb
  // ergibt SWE 4 + 3 + 1 = 8 bei sieben Modellen — Luna steht bei Codex UND
  // Claude Code — und TB 6 + 1 + 1 = 8, weil Opus bei Pi UND Codex steht.
  it("SWE-bench Lite: Luna ist ein Gleichstand zwischen Codex und Claude Code (55,6 %)", () => {
    const luna = bestHarnesses("swe").find((r) => r.model === "luna")!;
    expect(luna.best).toEqual(["codex", "cc"]);
    expect(luna.bestY).toBeCloseTo(55.5556, 3);
  });

  it("Terminal-Bench 2.0: Opus ist ein Gleichstand zwischen Pi und Codex (72,2 %)", () => {
    const opus = bestHarnesses("tb").find((r) => r.model === "opus")!;
    expect(opus.best).toEqual(["pi", "codex"]);
    expect(opus.bestY).toBeCloseTo(72.2222, 3);
  });

  it("SWE-bench Lite: Claude Code 4 (Fable, Sol, Luna*, Kimi) · Codex 3 (Opus, Sonnet, Luna*) · Pi 1 (Haiku)", () => {
    expect(bestHarnessCounts("swe")).toEqual({ cc: 4, codex: 3, pi: 1 });
    const by = new Map(bestHarnesses("swe").map((r) => [r.model, r.best]));
    expect(by.get("fable")).toEqual(["cc"]);
    expect(by.get("sol")).toEqual(["cc"]);
    expect(by.get("kimi")).toEqual(["cc"]);
    expect(by.get("opus")).toEqual(["codex"]);
    expect(by.get("sonnet")).toEqual(["codex"]);
    expect(by.get("haiku")).toEqual(["pi"]);
  });

  it("Terminal-Bench 2.0: Pi 6 (alle außer Fable) · Claude Code 1 (Fable) · Codex 1 (Opus*)", () => {
    expect(bestHarnessCounts("tb")).toEqual({ pi: 6, cc: 1, codex: 1 });
    const by = new Map(bestHarnesses("tb").map((r) => [r.model, r.best]));
    expect(by.get("fable")).toEqual(["cc"]);
    for (const m of ["haiku", "sonnet", "sol", "luna", "kimi"] as const) {
      expect(by.get(m), m).toEqual(["pi"]);
    }
  });

  it("stimmt mit dem Archiv überein: kein Punkt desselben Modells liegt höher als bestY", () => {
    for (const bench of ["swe", "tb"] as const) {
      const raw = RAW[bench].frontier.points;
      for (const r of bestHarnesses(bench)) {
        const mine = raw.filter((p) => p.model === r.model);
        expect(Math.max(...mine.map((p) => p.y * 100))).toBeCloseTo(r.bestY, 4);
        for (const h of r.best) {
          expect(findRaw(raw, r.model, h).y * 100).toBeCloseTo(r.bestY, 4);
        }
      }
    }
  });
});

describe("nativeUpgrades: die Geisterpfeile natives → bestes Harness (Schritt 3)", () => {
  it("nativeWinRate über beide Benchmarks ist 3 von 12 — der fremde Harness gewinnt also 9 von 12", () => {
    const { wins, total } = nativeWinRate(["swe", "tb"]);
    expect({ wins, total }).toEqual({ wins: 3, total: 12 });
    expect(total - wins).toBe(9);
    expect(nativeUpgrades("swe").length + nativeUpgrades("tb").length).toBe(9);
  });

  it("SWE-bench Lite: Opus → Codex, Sonnet → Codex, Haiku → Pi, Sol → Claude Code (4 Pfeile)", () => {
    const got = nativeUpgrades("swe").map(
      (u) => `${u.model}:${u.from.harness}>${u.to.harness}`,
    );
    expect(new Set(got)).toEqual(
      new Set([
        "opus:cc>codex",
        "sonnet:cc>codex",
        "haiku:cc>pi",
        "sol:codex>cc",
      ]),
    );
  });

  it("SWE-bench Lite: Fable (nativ gewinnt) und Luna (Gleichstand zählt als nativ) ohne Pfeil, Kimi ohne natives Harness", () => {
    const models = new Set(nativeUpgrades("swe").map((u) => u.model));
    expect(models.has("fable")).toBe(false);
    expect(models.has("luna")).toBe(false);
    expect(models.has("kimi")).toBe(false);
  });

  it("Terminal-Bench 2.0: Opus, Sonnet, Haiku, Sol, Luna → Pi (5 Pfeile), Fable bleibt", () => {
    const ups = nativeUpgrades("tb");
    expect(new Set(ups.map((u) => u.model))).toEqual(
      new Set(["opus", "sonnet", "haiku", "sol", "luna"]),
    );
    expect(ups.every((u) => u.to.harness === "pi")).toBe(true);
    // Opus: Pi und Codex gleichauf (72,2 %) — der Pfeil zeigt per
    // HARNESS_ORDER auf Pi, nicht auf Codex.
    expect(ups.find((u) => u.model === "opus")!.to.harness).toBe("pi");
  });

  it("jeder Pfeil startet im nativen Harness und endet echt höher", () => {
    for (const bench of ["swe", "tb"] as const) {
      for (const u of nativeUpgrades(bench)) {
        expect(u.from.harness).toBe(NATIVE[u.model]);
        expect(u.from.model).toBe(u.model);
        expect(u.to.model).toBe(u.model);
        expect(u.dSuccess).toBeGreaterThan(0);
        expect(u.dSuccess).toBeCloseTo(u.to.y - u.from.y, 10);
        // … und `to` ist tatsächlich ein Bestplatzierter laut bestHarnesses.
        const best = bestHarnesses(bench).find((r) => r.model === u.model)!;
        expect(best.best).toContain(u.to.harness);
        expect(best.best).not.toContain(u.from.harness);
      }
    }
  });

  it("die Punkte der Pfeile sind Instanzen aus pointsFor(), keine Kopien", () => {
    for (const bench of ["swe", "tb"] as const) {
      const pts = pointsFor(bench);
      for (const u of nativeUpgrades(bench)) {
        expect(pts).toContain(u.from);
        expect(pts).toContain(u.to);
      }
      for (const p of harnessPairs(bench, "pi", "cc")) {
        expect(pts).toContain(p.from);
        expect(pts).toContain(p.to);
      }
    }
  });
});
