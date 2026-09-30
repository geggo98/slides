/**
 * opusplanMath.test.ts — pinnt das Kostenmodell der opusplan-Break-even-Folie,
 * damit spätere Änderungen die gezeigten Zahlen nicht still verstellen.
 * Referenzwerte von Hand nachgerechnet (Defaults: C=0,18 · R=21 · O=0,08 · N=2,
 * TTL=1 h wie DEFAULT_TTL — die Folie modelliert eine interaktive Session;
 * Preise Opus 5.5 $4/$20 bei Read 0,05×, Sonnet 5.5 $2/$10).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BREAK_SHARE,
  DEFAULT_TTL,
  EXEC_WRITE_PRO_READ,
  OPUS,
  PLAN,
  REPLAN_OUT,
  SONNET,
  bruchKosten,
  execKosten,
  kostenGerade,
  planKosten,
  readPreis,
  szenarien,
  toEur,
  type Eingaben,
} from "../opusplanMath";
import { SZENARIO_DEFAULTS } from "../scenarioState";

const DEFAULTS: Eingaben = {
  ctx: 0.18,
  execRead: 21,
  execOut: 0.08,
  replans: 2,
  ttl: DEFAULT_TTL,
};

describe("Konstanten gegen das Archiv data/opusplan-sessions/summary.json", () => {
  // Wer extract.py neu laufen lässt und andere Mediane bekommt, muss die
  // Konstanten (und die Folientexte) bewusst nachziehen — sonst läuft die
  // Folie still vom Archiv weg.
  const summary = JSON.parse(
    readFileSync(
      new URL("../../../data/opusplan-sessions/summary.json", import.meta.url),
      "utf-8",
    ),
  );
  it("Bruch, Plan-Phase, Re-Plan und Exec-Writes entsprechen den Medianen", () => {
    expect(BREAK_SHARE).toBeCloseTo(
      summary.sitzungen.erster_wechsel_break_share.median,
      2,
    );
    expect(PLAN.out).toBeCloseTo(summary.plan_out_mtok.median, 2);
    expect(PLAN.read).toBeCloseTo(summary.plan_read_mtok.median, 1);
    expect(PLAN.write).toBeCloseTo(summary.plan_write_mtok.median, 2);
    expect(REPLAN_OUT).toBeCloseTo(summary.replan_out_mtok.median, 3);
    expect(EXEC_WRITE_PRO_READ).toBe(
      summary.kontrollrechnung_usd.exec_write_pro_read,
    );
  });
  it("Regler-Defaults liegen an den Session-Medianen (Output am Reglerende)", () => {
    const k = summary.kontrollrechnung_usd;
    expect(SZENARIO_DEFAULTS.readM).toBeCloseTo(
      k.exec_read_je_sitzung_mtok.median,
      0,
    );
    // Median 76k; der Regler beginnt bei 80k, also steht der Default am Rand.
    expect(SZENARIO_DEFAULTS.outK).toBeGreaterThanOrEqual(
      k.exec_out_je_sitzung_mtok.median * 1000,
    );
    expect(SZENARIO_DEFAULTS.outK).toBeLessThan(
      k.exec_out_je_sitzung_mtok.median * 1000 + 10,
    );
    expect(SZENARIO_DEFAULTS.ctxK).toBeCloseTo(
      summary.sitzungen.erster_wechsel_ctx_mtok.median * 1000,
      -1,
    );
  });
});

describe("Preise", () => {
  it("Opus 5.5 liest zu 0,05× — genauso billig wie Sonnet 5.5 ($0,20/MTok)", () => {
    // Preisseite, Fußnote 2. Ab hier kommt die Ersparnis nicht mehr aus dem
    // Read, sondern aus Output und Cache-Writes.
    expect(readPreis(OPUS)).toBeCloseTo(0.2, 6);
    expect(readPreis(SONNET)).toBeCloseTo(0.2, 6);
  });
});

describe("Default-TTL", () => {
  it("ist 1 h — die Folie rechnet eine interaktive Session", () => {
    // Der Schalter der Folie startet auf diesem Wert. Steht er wieder auf
    // "5min", widerspricht die Rechnung der Fußzeile derselben Folie. In den
    // Sessions sind 100 % der Cache-Writes 1-h-Writes.
    expect(DEFAULT_TTL).toBe("1h");
  });
});

describe("Defaults bei 1-h-TTL (Write 2×, jedes Claude-Abo im Kontingent)", () => {
  const e = szenarien(DEFAULTS);
  it("Phasenkosten: Plan 1,76/2,70 $ · Exec 6,23/8,27 $", () => {
    expect(planKosten(SONNET, "1h")).toBeCloseTo(1.76, 4);
    expect(planKosten(OPUS, "1h")).toBeCloseTo(2.7, 4);
    expect(execKosten(SONNET, 21, 0.08)).toBeCloseTo(6.2348, 4);
    expect(execKosten(OPUS, 21, 0.08)).toBeCloseTo(8.2696, 4);
  });
  it("Szenarien: 7,99 / 10,97 / 9,55 $, Worst Case bei n=2: 13,26 $", () => {
    expect(e.nurSonnet).toBeCloseTo(7.9948, 3);
    expect(e.nurOpus).toBeCloseTo(10.9696, 3);
    expect(e.opusplan).toBeCloseTo(9.5468, 3);
    expect(e.antiPattern).toBeCloseTo(13.2588, 3);
  });
  it("Bruch 0,612 $ · Ersparnis 1,42 $ (−13 %) · Break-even 6,3 MTok", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.612, 4);
    expect(e.ersparnis).toBeCloseTo(1.4228, 3);
    expect(e.ersparnisProzent).toBeCloseTo(12.97, 1);
    expect(e.breakEvenRead).toBeCloseTo(6.316, 3);
  });
  it("Rückkehr im Worst Case: Brüche 1,836 $ + Re-Plan 0,02 $ · Ersparnis weg ab 1×", () => {
    expect(e.rueckkehrBrueche).toBeCloseTo(1.836, 3);
    expect(toEur(e.rueckkehrBrueche)).toBeCloseTo(1.608, 3);
    expect(e.rueckkehrGesamt).toBeCloseTo(1.856, 3);
    // Schon ein einziger Worst-Case-Bruch (beide Caches kalt) frisst die
    // Ersparnis: 1,42 $ gegen 1,84 $. Gemessen ist das die Ausnahme — 12 von
    // 81 Rückkehren schreiben mehr als die Hälfte des Kontexts neu.
    expect(e.ersparnisWegAb).toBe(1);
    expect(e.balkenUeberAb).toBe(1);
    expect(toEur(e.rueckkehrGesamt - e.rueckkehrBrueche)).toBeCloseTo(
      0.0175,
      4,
    );
  });
  it("Euro-Umrechnung wie paretoData: 7,00 / 9,61 / 8,36 / 11,61 €", () => {
    expect(toEur(1)).toBeCloseTo(0.876, 6);
    expect(toEur(e.nurSonnet)).toBeCloseTo(7.0, 2);
    expect(toEur(e.nurOpus)).toBeCloseTo(9.61, 2);
    expect(toEur(e.opusplan)).toBeCloseTo(8.36, 2);
    expect(toEur(e.antiPattern)).toBeCloseTo(11.61, 2);
  });
  it("Mit Opus 5 ($5/$25, Read 0,1×) wäre es deutlich mehr — die Messung zeigt −44 % statt −8 %", () => {
    // Gegenprobe zur Preisbasis: dieselben Regler, alter Opus. Der Medianwert
    // der echten Sessions liegt bei Opus 5 bei −44 %, bei Opus 5.5 bei −8 %
    // (summary.json, kontrafaktisch_A_je_opus_modell); die Modellrechnung am
    // Regler-Default trifft mit −13 % den 5.5er-Bereich.
    const opus5 = { input: 5, output: 25 };
    const nurOpus5 =
      planKosten(opus5, "1h") + execKosten(opus5, 21, 0.08, "1h");
    const plan5 = planKosten(opus5, "1h");
    const opusplan5 =
      plan5 +
      bruchKosten(SONNET, 0.18, "1h") +
      execKosten(SONNET, 21, 0.08, "1h");
    expect(1 - opusplan5 / nurOpus5).toBeGreaterThan(0.3);
  });
  it("Worst Case überholt Nur Opus schon bei einer Rückkehr", () => {
    const bei = (n: number) => szenarien({ ...DEFAULTS, replans: n });
    expect(bei(0).antiPattern).toBeLessThan(bei(0).nurOpus);
    expect(bei(1).antiPattern).toBeGreaterThan(bei(1).nurOpus);
  });
});

describe("Option 5-min-TTL (Write 1,25× — API-Key, Credits, Cloud, Kontingent leer)", () => {
  const e = szenarien({ ...DEFAULTS, ttl: "5min" });
  it("Phasenkosten: Plan 1,52/2,22 $", () => {
    expect(planKosten(SONNET, "5min")).toBeCloseTo(1.52, 4);
    expect(planKosten(OPUS, "5min")).toBeCloseTo(2.22, 4);
  });
  it("Szenarien: 7,29 / 9,56 / 8,37 $ (6,39 / 8,38 / 7,34 €)", () => {
    expect(e.nurSonnet).toBeCloseTo(7.292, 3);
    expect(e.nurOpus).toBeCloseTo(9.564, 3);
    expect(e.opusplan).toBeCloseTo(8.374, 3);
    expect(toEur(e.nurSonnet)).toBeCloseTo(6.39, 2);
    expect(toEur(e.nurOpus)).toBeCloseTo(8.38, 2);
    expect(toEur(e.opusplan)).toBeCloseTo(7.34, 2);
  });
  it("Brüche ×1/1,6: Bruch 0,383 $ · Break-even 5,1 MTok · Balken ab 2×, Ersparnis weg ab 2×", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.3825, 4);
    expect(e.ersparnis).toBeCloseTo(1.19, 2);
    expect(e.breakEvenRead).toBeCloseTo(5.111, 3);
    expect(e.rueckkehrBrueche).toBeCloseTo(1.147, 3);
    expect(e.ersparnisWegAb).toBe(2);
    expect(e.balkenUeberAb).toBe(2);
  });
});

describe("Invarianten und Randfälle", () => {
  it("N=0 ⇒ Anti-Pattern identisch mit opusplan", () => {
    const e = szenarien({ ...DEFAULTS, replans: 0 });
    expect(e.antiPattern).toBe(e.opusplan);
  });
  it("Break-even wächst monoton mit dem Kontext", () => {
    const klein = szenarien({ ...DEFAULTS, ctx: 0.1 }).breakEvenRead;
    const gross = szenarien({ ...DEFAULTS, ctx: 0.5 }).breakEvenRead;
    expect(gross).toBeGreaterThan(klein);
  });
  it("Worst Case über alle Reglerbereiche: Break-even bis 36 MTok, jenseits der x-Achse", () => {
    // Maximaler Bruch (Kontext ganz rechts) gegen minimale Ersparnis pro MTok
    // (viel Read, wenig Output). Mit Opus 5.5 ist der Read-Preis beider Modelle
    // gleich, die Ersparnis hängt nur an Output und Writes — der Break-even
    // liegt dann hinter der 20er-Sprosse der x-Leiter, und das Chart zeigt
    // seinen „Break-even jenseits“-Hinweis.
    const e = szenarien({
      ctx: 0.7,
      execRead: 120,
      execOut: 0.08,
      replans: 0,
      ttl: "1h",
    });
    expect(e.breakEvenRead).toBeCloseTo(36.4, 1);
    expect(e.breakEvenRead).toBeGreaterThan(20);
  });
  it("opusplan ist NICHT an jeder Reglerstellung billiger als Nur Opus", () => {
    // Mit Opus 5.5 greift der „kostet hier X € mehr“-Zweig der Komponente
    // wieder: bei kleinem Exec-Volumen und großem Kontext wiegt der Bruch die
    // Ersparnis nicht auf. Bei den Defaults dagegen spart opusplan.
    let schlechteste = Infinity;
    for (const ctx of [0.08, 0.18, 0.4, 0.7]) {
      for (const execRead of [5, 12, 21, 60, 120]) {
        for (const execOut of [0.08, 0.15, 0.25, 0.4]) {
          for (const ttl of ["5min", "1h"] as const) {
            const e = szenarien({ ctx, execRead, execOut, replans: 0, ttl });
            schlechteste = Math.min(schlechteste, e.ersparnis);
          }
        }
      }
    }
    expect(schlechteste).toBeLessThan(0);
    expect(szenarien(DEFAULTS).ersparnis).toBeGreaterThan(0);
  });
  it("Kostengerade trifft die Szenariowerte: Schnittpunkt beider Geraden = Break-even", () => {
    const e = szenarien(DEFAULTS);
    const ratio = DEFAULTS.execOut / DEFAULTS.execRead;
    const x = e.breakEvenRead;
    const yOpus = kostenGerade(OPUS, OPUS, DEFAULTS.ttl, ratio, 0, x);
    const yOpusplan = kostenGerade(
      OPUS,
      SONNET,
      DEFAULTS.ttl,
      ratio,
      e.bruchEinmal,
      x,
    );
    expect(yOpus).toBeCloseTo(yOpusplan, 6);
    // und bei x = execRead entspricht die Gerade dem Szenario-Gesamtwert
    expect(kostenGerade(OPUS, OPUS, DEFAULTS.ttl, ratio, 0, 21)).toBeCloseTo(
      e.nurOpus,
      6,
    );
    expect(
      kostenGerade(OPUS, SONNET, DEFAULTS.ttl, ratio, e.bruchEinmal, 21),
    ).toBeCloseTo(e.opusplan, 6);
  });
  it("bruchKosten: 85 % des Kontexts zum Write-Preis des Zielmodells", () => {
    expect(bruchKosten(SONNET, 0.18, "5min")).toBeCloseTo(0.85 * 0.18 * 2.5, 6);
    expect(bruchKosten(OPUS, 0.18, "1h")).toBeCloseTo(0.85 * 0.18 * 8, 6);
  });
});
