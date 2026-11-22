/**
 * mwmbrMath.test.ts — das MWMBR-Modell gegen von Hand nachgerechnete Werte.
 *
 * Erwartungswerte stammen aus dem Google SRE Workbook, Kapitel 5 (Table 5-4,
 * Table 5-8, Figure 5-6, die sechs Ansätze), und aus der Formel
 * t = θ/B · langes Fenster, nicht aus der Ausgabe des Codes. Die Rechnung
 * steht jeweils im Kommentar am Test.
 */
import { describe, expect, it } from "vitest";
import {
  PERIOD_MIN,
  RULES,
  SCENARIOS,
  SLOS,
  budgetShareAtFire,
  burnRate,
  bursts,
  decimate,
  detectionMin,
  errorTrace,
  fmtBurn,
  fmtDuration,
  fmtNum,
  gate,
  indexAt,
  minutesToExhaustion,
  outcome,
  prefixSums,
  segmentsOf,
  severityOf,
  simulate,
  sustainedBurn,
  thresholdFromBudget,
  windowMean,
  type GateMode,
  type Rule,
  type Scenario,
} from "../mwmbrMath";

const scenario = (key: string): Scenario => {
  const sc = SCENARIOS.find((s) => s.key === key);
  if (!sc) throw new Error(`Szenario ${key} fehlt`);
  return sc;
};
const MODES: GateMode[] = ["and", "long", "short"];
/** Sekunden nach Störungsbeginn als Minuten auf der Diagrammachse. */
const at = (sc: Scenario, s: number) => sc.onsetMin + s / 60;
/**
 * Liegt die Kreuzung rechnerisch genau auf einem Rasterpunkt, entscheidet die
 * Gleitkomma-Rundung, ob dieser oder der nächste Schritt zählt. Erlaubt ist
 * deshalb genau ein Schritt nach dem exakten Wert, keiner davor.
 */
function expectWithinStep(
  got: number | null,
  exactMin: number,
  stepS: number,
  hint: string,
) {
  expect(got, hint).not.toBeNull();
  expect(got! - exactMin, hint).toBeGreaterThan(-1e-9);
  expect(got! - exactMin, hint).toBeLessThanOrEqual(stepS / 60 + 1e-9);
}

describe("Formeln der Standardtabelle", () => {
  it("leitet die Schwellen aus dem Budgetanteil ab (30 d = 720 h)", () => {
    expect(thresholdFromBudget(0.02, 60)).toBeCloseTo(14.4, 10);
    expect(thresholdFromBudget(0.05, 360)).toBeCloseTo(6, 10);
    expect(thresholdFromBudget(0.1, 1440)).toBeCloseTo(3, 10);
    expect(thresholdFromBudget(0.1, 4320)).toBeCloseTo(1, 10);
  });

  it("rechnet bei 28 d (672 h) andere Faktoren aus", () => {
    const p28 = 672 * 60;
    expect(thresholdFromBudget(0.02, 60, p28)).toBeCloseTo(13.44, 10);
    expect(thresholdFromBudget(0.05, 360, p28)).toBeCloseTo(5.6, 10);
    expect(thresholdFromBudget(0.1, 4320, p28)).toBeCloseTo(0.9333, 4);
  });

  it("gibt für die drei Regeln 2 %, 5 % und 10 % Budget beim Feuern", () => {
    const shares = RULES.map((r) => budgetShareAtFire(r.theta, r.longMin));
    expect(shares[0]).toBeCloseTo(0.02, 10);
    expect(shares[1]).toBeCloseTo(0.05, 10);
    expect(shares[2]).toBeCloseTo(0.1, 10);
    // 30-d-Faktor 14,4 auf einer 28-d-Periode: 14,4 · 1 / 672 = 2,14 %
    expect(budgetShareAtFire(14.4, 60, 672 * 60)).toBeCloseTo(0.0214, 4);
  });

  it("hält die Regeln der Table 5-8 fest", () => {
    expect(
      RULES.map((r) => [r.severity, r.theta, r.longMin, r.shortMin]),
    ).toEqual([
      ["page", 14.4, 60, 5],
      ["page", 6, 360, 30],
      ["ticket", 1, 4320, 360],
    ]);
    // Faustregel des Workbooks: kurzes Fenster = 1/12 des langen
    for (const r of RULES) expect(r.longMin / r.shortMin).toBe(12);
    expect(PERIOD_MIN).toBe(43200);
    expect(SLOS).toEqual([0.995, 0.999, 0.9995]);
  });

  it("berechnet die Burn Rate als Fehlerquote / (1 − SLO)", () => {
    expect(burnRate(0.001, 0.999)).toBeCloseTo(1, 9);
    expect(burnRate(1, 0.999)).toBeCloseTo(1000, 6);
    // Low Traffic: 1 Fehler in 10 Requests = 100×, nicht 1000× (Erratum)
    expect(burnRate(0.1, 0.999)).toBeCloseTo(100, 7);
    // 90 %-SLO: ein Totalausfall brennt nur mit 10×
    expect(burnRate(1, 0.9)).toBeCloseTo(10, 9);
    expect(burnRate(0, 0.999)).toBe(0);
  });

  it("gibt die Zeit bis zum leeren Budget wie Table 5-4", () => {
    expect(minutesToExhaustion(1)).toBe(30 * 1440);
    expect(minutesToExhaustion(2)).toBe(15 * 1440);
    expect(minutesToExhaustion(10)).toBe(3 * 1440);
    expect(minutesToExhaustion(1000)).toBeCloseTo(43.2, 10);
    // Ansatz 4: 35× bleibt unter θ = 36 und leert das Budget in 20,6 h
    expect(minutesToExhaustion(35) / 60).toBeCloseTo(20.57, 2);
    expect(minutesToExhaustion(0)).toBe(Infinity);
    expect(minutesToExhaustion(-1)).toBe(Infinity);
    expect(minutesToExhaustion(1, 672 * 60)).toBe(28 * 1440);
  });

  it("gibt die Detektionszeit θ/B · langes Fenster", () => {
    expect(detectionMin(14.4, 1000, 60)).toBeCloseTo(0.864, 10);
    expect(detectionMin(6, 1000, 360)).toBeCloseTo(2.16, 10);
    expect(detectionMin(1, 1000, 4320)).toBeCloseTo(4.32, 10);
    expect(detectionMin(1, 3, 4320)).toBeCloseTo(1440, 8);
    // strikt: Burn genau auf der Schwelle feuert nie
    expect(detectionMin(3, 3, 1440)).toBe(Infinity);
    expect(detectionMin(36, 35, 60)).toBe(Infinity);
  });
});

describe("Fehlerspur und Fenster", () => {
  const base: Scenario = {
    key: "t",
    label: "t",
    title: "t",
    spanMin: 4,
    stepS: 30,
    onsetMin: 1,
    cursorMin: 1,
    phases: [],
  };

  it("liefert ohne Phasen nur Nullen in der richtigen Länge", () => {
    expect(Array.from(errorTrace(base))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("schließt den Anfang einer Phase ein und das Ende aus", () => {
    const err = errorTrace({
      ...base,
      phases: [{ fromMin: 1, toMin: 2, rate: 0.5 }],
    });
    expect(Array.from(err)).toEqual([0, 0, 0.5, 0.5, 0, 0, 0, 0]);
  });

  it("lässt bei Überlappung die erste Phase gewinnen und kappt am Rand", () => {
    const err = errorTrace({
      ...base,
      phases: [
        { fromMin: 1, toMin: 2, rate: 0.5 },
        { fromMin: -1, toMin: 9, rate: 0.1 },
      ],
    });
    expect(Array.from(err)).toEqual([0.1, 0.1, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1]);
  });

  it("erzeugt gleichmäßige Bursts und kürzt den letzten", () => {
    expect(bursts(0, 70, 30, 20, 0.05)).toEqual([
      { fromMin: 0, toMin: 20, rate: 0.05 },
      { fromMin: 30, toMin: 50, rate: 0.05 },
      { fromMin: 60, toMin: 70, rate: 0.05 },
    ]);
    expect(bursts(10, 10, 30, 2, 1)).toEqual([]);
  });

  it("summiert Fehler-Sekunden auf", () => {
    const P = prefixSums(Float64Array.from([0, 0.5, 0.5, 0]), 30);
    expect(Array.from(P)).toEqual([0, 0, 15, 30, 30]);
    expect(Array.from(prefixSums(new Float64Array(0), 30))).toEqual([0]);
  });

  it("mittelt über das Fenster und zählt die Vorgeschichte als fehlerfrei", () => {
    const P = prefixSums(Float64Array.from([1, 1, 0, 0]), 30);
    // Fenster 60 s am Zeitpunkt 2 (= 60 s): beide Fehler-Schritte liegen drin
    expect(windowMean(P, 2, 60, 30)).toBe(1);
    // Zeitpunkt 3: ein Fehler-Schritt, ein guter
    expect(windowMean(P, 3, 60, 30)).toBe(0.5);
    // Zeitpunkt 4: Fenster ist wieder sauber
    expect(windowMean(P, 4, 60, 30)).toBe(0);
    // Fenster 120 s am Zeitpunkt 1: 30 Fehler-Sekunden / 120 s
    expect(windowMean(P, 1, 120, 30)).toBe(0.25);
    expect(windowMean(P, 0, 120, 30)).toBe(0);
  });
});

describe("Gatter und Segmente", () => {
  it("verknüpft je nach Modus und vergleicht strikt", () => {
    const cases: [number, number, boolean, boolean, boolean][] = [
      // long, short → and, long, short
      [7, 7, true, true, true],
      [7, 5, false, true, false],
      [5, 7, false, false, true],
      [5, 5, false, false, false],
      [6, 6, false, false, false],
      [6, 7, false, false, true],
      [7, 6, false, true, false],
    ];
    for (const [l, s, and, long, short] of cases) {
      expect(gate(l, s, 6, "and"), `and ${l}/${s}`).toBe(and);
      expect(gate(l, s, 6, "long"), `long ${l}/${s}`).toBe(long);
      expect(gate(l, s, 6, "short"), `short ${l}/${s}`).toBe(short);
    }
  });

  it("findet kein, ein geschlossenes, ein offenes und mehrere Segmente", () => {
    expect(segmentsOf([0, 0, 0], 60)).toEqual([]);
    expect(segmentsOf([], 60)).toEqual([]);
    expect(segmentsOf([0, 1, 1, 0], 60)).toEqual([
      { fromMin: 1, toMin: 3, open: false },
    ]);
    expect(segmentsOf([1, 0, 0, 1, 1], 30)).toEqual([
      { fromMin: 0, toMin: 0.5, open: false },
      { fromMin: 1.5, toMin: 2, open: true },
    ]);
    expect(segmentsOf([0, 1, 0, 1, 0], 60).length).toBe(2);
  });

  it("stuft nach der höchsten gefeuerten Stufe ein", () => {
    expect(severityOf([])).toBe("none");
    expect(
      severityOf([
        { severity: "page", count: 0 },
        { severity: "ticket", count: 0 },
      ]),
    ).toBe("none");
    expect(
      severityOf([
        { severity: "page", count: 0 },
        { severity: "ticket", count: 2 },
      ]),
    ).toBe("ticket");
    expect(
      severityOf([
        { severity: "ticket", count: 1 },
        { severity: "page", count: 1 },
      ]),
    ).toBe("page");
  });
});

describe("Szenario „Harter Ausfall“ (100 %, SLO 99,9 %, Burn 1000×)", () => {
  const sc = scenario("outage");
  const run = simulate(sc, 0.999);

  it("meldet den Spitzen-Burn", () => {
    expect(run.peakBurn).toBeCloseTo(1000, 6);
  });

  it("feuert nach 52 s, 2,2 min und 4,3 min", () => {
    // 14,4/1000 · 3600 s = 51,84 s → erster Sekundenschritt darüber: 52 s
    expect(outcome(run, 0, "and").firstFireMin).toBeCloseTo(at(sc, 52), 9);
    // 6/1000 · 21600 s = 129,6 s → 130 s
    expect(outcome(run, 1, "and").firstFireMin).toBeCloseTo(at(sc, 130), 9);
    // 1/1000 · 259200 s = 259,2 s → 260 s
    expect(outcome(run, 2, "and").firstFireMin).toBeCloseTo(at(sc, 260), 9);
  });

  it("hat beim Feuern 2 %, 5 % und 10 % des Budgets verbraucht", () => {
    expect(outcome(run, 0, "and").budgetAtFire).toBeCloseTo(0.02, 3);
    expect(outcome(run, 1, "and").budgetAtFire).toBeCloseTo(0.05, 3);
    expect(outcome(run, 2, "and").budgetAtFire).toBeCloseTo(0.1, 3);
  });

  it("verbraucht in 30 min 69,4 % des Budgets", () => {
    // 1000 · 30 min / 43200 min
    expect(run.consumed[run.n]).toBeCloseTo(0.6944, 4);
    expect(run.consumed[0]).toBe(0);
    expect(run.consumed[indexAt(run, sc.onsetMin)]).toBe(0);
  });

  it("verbraucht bei SLO 99,95 % mehr als das ganze Budget", () => {
    expect(simulate(sc, 0.9995).consumed[run.n]).toBeCloseTo(1.3889, 3);
  });
});

describe("Szenario „Kurzer Spike“ (Workbook Figure 5-6: 15 % für 10 min)", () => {
  const sc = scenario("spike");
  const run = simulate(sc, 0.999);

  it("feuert nach 5,8 min, wenn das lange Fenster die Schwelle erreicht", () => {
    // 15 % · t / 3600 s > 1,44 % ⇔ t > 345,6 s → 346 s
    const o = outcome(run, 0, "and");
    expect(o.firstFireMin).toBeCloseTo(at(sc, 346), 9);
    expect(o.count).toBe(1);
    expect(o.budgetAtFire).toBeCloseTo(0.02, 3);
  });

  it("endet mit kurzem Fenster 4,5 min nach Fehlerende", () => {
    // 15 % · x / 300 s > 1,44 % ⇔ x > 28,8 s; x = 300 − s ⇒ aus ab s = 272
    expect(outcome(run, 0, "and").resetMin).toBeCloseTo(at(sc, 600 + 272), 9);
  });

  it("bleibt ohne kurzes Fenster 54 min nach Fehlerende an", () => {
    // Fehler-Sekunden im 1-h-Fenster > 345,6 ⇔ t < 3854,4 s ⇒ aus bei 3855 s
    const o = outcome(run, 0, "long");
    expect(o.firstFireMin).toBeCloseTo(at(sc, 346), 9);
    expect(o.resetMin).toBeCloseTo(at(sc, 3855), 9);
  });

  it("feuert mit nur dem kurzen Fenster schon nach 29 s", () => {
    // 15 % · t / 300 s > 1,44 % ⇔ t > 28,8 s → 29 s
    expect(outcome(run, 0, "short").firstFireMin).toBeCloseTo(at(sc, 29), 9);
  });

  it("lässt die langsamen Regeln still", () => {
    // 6 h: 15 % · 10/360 = 0,417 % < 0,6 %; 3 d: 0,035 % < 0,1 %
    for (const i of [1, 2]) {
      const o = outcome(run, i, "and");
      expect(o.count).toBe(0);
      expect(o.firstFireMin).toBeNull();
      expect(o.resetMin).toBeNull();
      expect(o.budgetAtFire).toBeNull();
    }
  });

  it("verbraucht 3,47 % des Budgets", () => {
    // 150 · 10 min / 43200 min
    expect(run.consumed[run.n]).toBeCloseTo(0.0347, 4);
  });

  it("feuert bei SLO 99,5 % gar nicht (Burn 30×, 1-h-Mittel 2,5 % < 7,2 %)", () => {
    const loose = simulate(sc, 0.995);
    expect(RULES.map((_, i) => outcome(loose, i, "and").count)).toEqual([
      0, 0, 0,
    ]);
  });

  it("feuert bei SLO 99,95 % auch die 6-h-Regel", () => {
    const strict = simulate(sc, 0.9995);
    // 15 % · t / 21600 s > 0,3 % ⇔ t > 432 s, genau auf dem Raster
    expectWithinStep(
      outcome(strict, 1, "and").firstFireMin,
      at(sc, 432),
      sc.stepS,
      "6-h-Regel",
    );
    // 15 % · t / 3600 s > 0,72 % ⇔ t > 172,8 s → 173 s
    expect(outcome(strict, 0, "and").firstFireMin).toBeCloseTo(at(sc, 173), 9);
  });
});

describe("Szenario „Schon vorbei“ (20 % für 15 min)", () => {
  const sc = scenario("past");
  const run = simulate(sc, 0.999);
  const i = indexAt(run, sc.cursorMin);

  it("zeigt am Startzeiger: langes Fenster drüber, kurzes drunter", () => {
    const fast = run.rules[0]!;
    // 1-h-Fenster: 20 % · 15/60 = 5 % = Burn 50; 5-min-Fenster ist sauber
    expect(fast.long[i]).toBeCloseTo(50, 6);
    expect(fast.short[i]).toBe(0);
    expect(gate(fast.long[i]!, fast.short[i]!, 14.4, "and")).toBe(false);
    expect(gate(fast.long[i]!, fast.short[i]!, 14.4, "long")).toBe(true);
  });

  it("lässt den Alarm ohne kurzes Fenster über das Diagramm hinaus an", () => {
    // 6-h-Regel: 20 % · 15/360 = 0,83 % > 0,6 % bis das Fenster rausläuft
    // an ab 648 s; aus, sobald höchstens 648 Fehler-Sekunden im Fenster
    // liegen: 21600 + 900 − 648 s nach Beginn, genau auf dem Raster
    expectWithinStep(
      outcome(run, 1, "long").resetMin,
      at(sc, 21600 + 900 - 648),
      sc.stepS,
      "Reset nur lang",
    );
    // mit kurzem Fenster: 20 % · x/1800 s > 0,6 % ⇔ x > 54 s ⇒ aus 1746 s
    expect(outcome(run, 1, "and").resetMin).toBeCloseTo(at(sc, 900 + 1746), 9);
  });
});

describe("Szenario „Schleichend“ (0,4 %, Burn 4×)", () => {
  const sc = scenario("creep");
  const run = simulate(sc, 0.999);

  it("feuert nur das Ticket, nach 18 h", () => {
    expect(outcome(run, 0, "and").count).toBe(0);
    expect(outcome(run, 1, "and").count).toBe(0);
    const t = outcome(run, 2, "and");
    // 1/4 · 72 h = 18 h, genau auf dem Raster
    expectWithinStep(t.firstFireMin, sc.onsetMin + 18 * 60, sc.stepS, "Ticket");
    expect(t.budgetAtFire).toBeCloseTo(0.1, 3);
    expect(t.resetMin).toBeNull();
    expect(t.segments[0]?.open).toBe(true);
    expect(
      severityOf(
        RULES.map((r, i) => ({
          severity: r.severity,
          count: outcome(run, i, "and").count,
        })),
      ),
    ).toBe("ticket");
  });

  it("bleibt bei SLO 99,5 % unter jeder Schwelle (Burn 0,8×)", () => {
    const loose = simulate(sc, 0.995);
    expect(loose.peakBurn).toBeCloseTo(0.8, 9);
    for (const mode of MODES)
      expect(RULES.map((_, i) => outcome(loose, i, mode).count)).toEqual([
        0, 0, 0,
      ]);
  });
});

describe("Szenario „Flattern“ (2 min mit 5 % alle 30 min)", () => {
  const sc = scenario("flap");
  const run = simulate(sc, 0.999);

  it("löst mit nur dem kurzen Fenster bei jedem Burst einen Page aus", () => {
    // 5-min-Fenster: 5 % · 2/5 = 2 % > 1,44 %; (4320 − 120) / 30 = 140 Bursts
    expect(sc.phases.length).toBe(140);
    expect(outcome(run, 0, "short").count).toBe(140);
  });

  it("hält den Page mit langem Fenster still", () => {
    // 1-h-Fenster: höchstens 2 Bursts, 5 % · 4/60 = 0,33 % < 1,44 %
    expect(outcome(run, 0, "and").count).toBe(0);
    expect(outcome(run, 0, "long").count).toBe(0);
  });

  it("feuert das Ticket nach 21,5 h, ein einziges Mal", () => {
    // nötig: 0,1 % · 4320 min = 4,32 Fehler-Minuten = 86,4 Burst-Minuten
    // = 43 volle Bursts + 0,4 min des 44. ⇒ 43 · 30 + 0,4 = 1290,4 min
    const t = outcome(run, 2, "and");
    expectWithinStep(t.firstFireMin, sc.onsetMin + 1290.4, sc.stepS, "Ticket");
    expect(t.count).toBe(1);
  });
});

describe("Ansatz 4 des Workbooks: eine Schwelle 36× auf 1 h", () => {
  const rule36: Rule = {
    key: "a4",
    severity: "page",
    theta: 36,
    longMin: 60,
    shortMin: 5,
  };
  const steady = (rate: number): Scenario => ({
    key: "a4",
    label: "a4",
    title: "a4",
    spanMin: 1500,
    stepS: 30,
    onsetMin: 0,
    cursorMin: 0,
    phases: [{ fromMin: 0, toMin: 1500, rate }],
  });

  it("meldet einen Burn von 35× nie, obwohl das Budget nach 20,6 h leer ist", () => {
    const run = simulate(steady(0.035), 0.999, [rule36]);
    expect(outcome(run, 0, "long").count).toBe(0);
    expect(run.consumed[indexAt(run, 20.5 * 60)]).toBeLessThan(1);
    expect(run.consumed[indexAt(run, 20.6 * 60)]).toBeGreaterThan(1);
  });

  it("meldet einen Burn von 40× nach 54 min", () => {
    // 36/40 · 60 min = 54 min, genau auf dem Raster
    const run = simulate(steady(0.04), 0.999, [rule36]);
    expectWithinStep(outcome(run, 0, "long").firstFireMin, 54, 30, "36×");
  });
});

describe("Eigenschaften über alle Szenarien und SLOs", () => {
  const grid = SCENARIOS.flatMap((sc) =>
    SLOS.map((slo) => ({ sc, slo, run: simulate(sc, slo) })),
  );

  it("deckt 5 Szenarien × 3 SLOs ab", () => {
    expect(grid.length).toBe(15);
  });

  it("lässt den Budgetverbrauch nie sinken", () => {
    for (const { sc, slo, run } of grid)
      for (let i = 1; i <= run.n; i++)
        if (run.consumed[i]! < run.consumed[i - 1]!)
          throw new Error(`${sc.key} @ ${slo}: Verbrauch sinkt bei ${i}`);
  });

  it("feuert mit UND nie, wenn eines der Einzelfenster schweigt", () => {
    for (const { sc, slo, run } of grid)
      for (const w of run.rules)
        for (let i = 0; i <= run.n; i += 7) {
          const and = gate(w.long[i]!, w.short[i]!, w.rule.theta, "and");
          const l = gate(w.long[i]!, w.short[i]!, w.rule.theta, "long");
          const s = gate(w.long[i]!, w.short[i]!, w.rule.theta, "short");
          if (and !== (l && s))
            throw new Error(`${sc.key} @ ${slo} ${w.rule.key}: Index ${i}`);
        }
  });

  it("trifft beim Sprung die Formel θ/B · Fenster auf einen Schritt genau", () => {
    let checked = 0;
    for (const key of ["spike", "outage", "past", "creep"])
      for (const slo of SLOS) {
        const sc = scenario(key);
        const run = simulate(sc, slo);
        const phase = sc.phases[0]!;
        RULES.forEach((rule, i) => {
          const expected = detectionMin(rule.theta, run.peakBurn, rule.longMin);
          const got = outcome(run, i, "and").firstFireMin;
          // Feuert nur, wenn die Störung lang genug dauert.
          if (expected >= phase.toMin - phase.fromMin) {
            expect(got, `${key} @ ${slo} ${rule.key}`).toBeNull();
            return;
          }
          checked++;
          const delta = got! - sc.onsetMin - expected;
          expect(delta, `${key} @ ${slo} ${rule.key}`).toBeGreaterThan(-1e-9);
          expect(delta, `${key} @ ${slo} ${rule.key}`).toBeLessThanOrEqual(
            sc.stepS / 60 + 1e-9,
          );
        });
      }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it("hält jeden Startzeiger und Störungsbeginn im Diagramm", () => {
    for (const sc of SCENARIOS) {
      expect(sc.cursorMin, sc.key).toBeGreaterThan(sc.onsetMin);
      expect(sc.cursorMin, sc.key).toBeLessThan(sc.spanMin);
      expect((sc.spanMin * 60) % sc.stepS, sc.key).toBe(0);
    }
  });
});

describe("Hilfsfunktionen", () => {
  it("begrenzt den Index auf das Diagramm", () => {
    const run = simulate(scenario("spike"), 0.999);
    expect(run.n).toBe(7200);
    expect(indexAt(run, -5)).toBe(0);
    expect(indexAt(run, 0)).toBe(0);
    expect(indexAt(run, 1)).toBe(60);
    expect(indexAt(run, 120)).toBe(7200);
    expect(indexAt(run, 999)).toBe(7200);
  });

  it("mittelt die Burn Rate über die Dauer der Störung", () => {
    const burn = (key: string, slo: number) =>
      sustainedBurn(simulate(scenario(key), slo));
    expect(burn("spike", 0.999)).toBeCloseTo(150, 6);
    expect(burn("outage", 0.999)).toBeCloseTo(1000, 6);
    expect(burn("past", 0.9995)).toBeCloseTo(400, 6);
    expect(burn("creep", 0.999)).toBeCloseTo(4, 6);
    // 140 Bursts · 2 min · 5 % = 14 Fehler-Minuten; der letzte Burst endet
    // 4172 min nach Beginn ⇒ 14 / 4172 = 0,3356 % ⇒ 3,36×, Spitze 50×
    expect(burn("flap", 0.999)).toBeCloseTo(3.3557, 4);
    const empty = simulate({ ...scenario("spike"), phases: [] }, 0.999);
    expect(sustainedBurn(empty)).toBe(0);
    // Phase läuft über das Diagramm hinaus: nur der sichtbare Teil zählt
    const cut = simulate(
      {
        ...scenario("spike"),
        phases: [{ fromMin: 20, toMin: 500, rate: 0.15 }],
      },
      0.999,
    );
    expect(sustainedBurn(cut)).toBeCloseTo(150, 6);
  });

  it("dünnt aus, ohne einen einzelnen Ausreißer zu verlieren", () => {
    const arr = new Float64Array(1000);
    arr[517] = 9;
    arr[3] = -2;
    const pts = decimate(arr, 10);
    expect(pts.length).toBeLessThanOrEqual(40);
    expect(pts.find((p) => p.v === 9)?.i).toBe(517);
    expect(pts.find((p) => p.v === -2)?.i).toBe(3);
    expect(pts[0]?.i).toBe(0);
    expect(pts[pts.length - 1]?.i).toBe(999);
    const idx = pts.map((p) => p.i);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(new Set(idx).size).toBe(idx.length);
  });

  it("gibt kurze Reihen unverändert zurück", () => {
    expect(decimate([1, 2, 3], 10)).toEqual([
      { i: 0, v: 1 },
      { i: 1, v: 2 },
      { i: 2, v: 3 },
    ]);
    expect(decimate([], 10)).toEqual([]);
    expect(decimate(new Float64Array(40), 10).length).toBe(40);
    expect(decimate(new Float64Array(41), 10).length).toBeLessThan(41);
  });

  it("formatiert Zahlen mit Dezimalkomma", () => {
    expect(fmtNum(3.456, 1)).toBe("3,5");
    expect(fmtNum(2, 0)).toBe("2");
    expect(fmtBurn(14.4)).toBe("14,4×");
    expect(fmtBurn(6)).toBe("6×");
    expect(fmtBurn(1)).toBe("1×");
    expect(fmtBurn(0)).toBe("0×");
    expect(fmtBurn(0.05)).toBe("0,05×");
    expect(fmtBurn(0.5)).toBe("0,5×");
    expect(fmtBurn(9.99)).toBe("9,99×");
    expect(fmtBurn(10)).toBe("10×");
    expect(fmtBurn(10.26)).toBe("10,3×");
    expect(fmtBurn(33.33)).toBe("33,3×");
    expect(fmtBurn(150)).toBe("150×");
    expect(fmtBurn(1000)).toBe("1000×");
  });

  it("formatiert Dauern in der passenden Einheit", () => {
    expect(fmtDuration(52 / 60)).toBe("52 s");
    expect(fmtDuration(0)).toBe("0 s");
    expect(fmtDuration(1)).toBe("1 min");
    expect(fmtDuration(5.77)).toBe("5,8 min");
    expect(fmtDuration(89)).toBe("89 min");
    expect(fmtDuration(90)).toBe("1,5 h");
    expect(fmtDuration(1080)).toBe("18 h");
    expect(fmtDuration(2879)).toBe("48 h");
    expect(fmtDuration(2880)).toBe("2 d");
    expect(fmtDuration(10800)).toBe("7,5 d");
    expect(fmtDuration(Infinity)).toBe("nie");
    expect(fmtDuration(NaN)).toBe("nie");
  });
});
