/**
 * opusplanMath.test.ts — pinnt das Kostenmodell der opusplan-Break-even-Folie,
 * damit spätere Änderungen die gezeigten Zahlen nicht still verstellen.
 * Referenzwerte von Hand nachgerechnet (Defaults: C=0,18 · R=30 · O=0,15 · N=2).
 */
import { describe, expect, it } from "vitest";
import {
  OPUS,
  SONNET,
  bruchKosten,
  execKosten,
  kostenGerade,
  planKosten,
  szenarien,
  toEur,
  type Eingaben,
} from "../opusplanMath";

const DEFAULTS: Eingaben = {
  ctx: 0.18,
  execRead: 30,
  execOut: 0.15,
  replans: 2,
  ttl: "5min",
};

describe("Defaults bei 5-min-TTL (Write 1,25×)", () => {
  const e = szenarien(DEFAULTS);
  it("Phasenkosten: Plan 4,95/8,25 $ · Exec 11,25/18,75 $ (Exec −40 %)", () => {
    expect(planKosten(SONNET, "5min")).toBeCloseTo(4.95, 4);
    expect(planKosten(OPUS, "5min")).toBeCloseTo(8.25, 4);
    expect(execKosten(SONNET, 30, 0.15)).toBeCloseTo(11.25, 4);
    expect(execKosten(OPUS, 30, 0.15)).toBeCloseTo(18.75, 4);
  });
  it("Szenarien: 16,20 / 27,00 / 20,13 / 25,73 $", () => {
    expect(e.nurSonnet).toBeCloseTo(16.2, 3);
    expect(e.nurOpus).toBeCloseTo(27.0, 3);
    expect(e.opusplan).toBeCloseTo(20.128, 3);
    expect(e.antiPattern).toBeCloseTo(25.726, 3);
  });
  it("Bruch 0,628 $ · Ersparnis 6,87 $ (−25 %) · Break-even 2,51 MTok", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.628, 3);
    expect(e.ersparnis).toBeCloseTo(6.872, 3);
    expect(e.ersparnisProzent).toBeCloseTo(25.45, 1);
    expect(e.breakEvenRead).toBeCloseTo(2.511, 3);
  });
  it("Rückkehr: Brüche 1,674 $ (≈1,47 €) + Re-Plan = 2,799 $ · Ersparnis weg ab 5×", () => {
    expect(e.rueckkehrBrueche).toBeCloseTo(1.674, 3);
    expect(toEur(e.rueckkehrBrueche)).toBeCloseTo(1.466, 3);
    expect(e.rueckkehrGesamt).toBeCloseTo(2.799, 3);
    expect(e.ersparnisWegAb).toBe(5);
  });
  it("Euro-Umrechnung wie paretoData: 14,19 / 23,65 / 17,63 / 22,54 €", () => {
    expect(toEur(1)).toBeCloseTo(0.876, 6);
    expect(toEur(e.nurSonnet)).toBeCloseTo(14.19, 2);
    expect(toEur(e.nurOpus)).toBeCloseTo(23.65, 2);
    expect(toEur(e.opusplan)).toBeCloseTo(17.63, 2);
    expect(toEur(e.antiPattern)).toBeCloseTo(22.54, 2);
  });
});

describe("Defaults bei 1-h-TTL (Write 2×, Max-Abo)", () => {
  const e = szenarien({ ...DEFAULTS, ttl: "1h" });
  it("Szenarien: 17,01 / 28,35 / 21,85 / 29,46 $", () => {
    expect(e.nurSonnet).toBeCloseTo(17.01, 3);
    expect(e.nurOpus).toBeCloseTo(28.35, 3);
    expect(e.opusplan).toBeCloseTo(21.854, 3);
    expect(e.antiPattern).toBeCloseTo(29.461, 3);
  });
  it("Brüche ×1,6: Break-even 4,02 MTok · Rückkehr-Brüche 2,678 $ · Ersparnis weg ab 3×", () => {
    expect(e.bruchEinmal).toBeCloseTo(1.0044, 4);
    expect(e.breakEvenRead).toBeCloseTo(4.018, 3);
    expect(e.rueckkehrBrueche).toBeCloseTo(2.678, 3);
    expect(e.ersparnisWegAb).toBe(3);
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
  it("Worst Case über alle Reglerbereiche: Break-even ≤ 19 MTok (x-Leiter {12, 20})", () => {
    const e = szenarien({
      ctx: 0.7,
      execRead: 120,
      execOut: 0.08,
      replans: 0,
      ttl: "1h",
    });
    expect(e.breakEvenRead).toBeCloseTo(18.9, 1);
    expect(e.breakEvenRead).toBeLessThanOrEqual(19);
  });
  it("Exec-Volumen unter Break-even ⇒ negative Ersparnis, ersparnisWegAb = 0", () => {
    const e = szenarien({
      ctx: 0.7,
      execRead: 5,
      execOut: 0.08,
      replans: 0,
      ttl: "1h",
    });
    expect(e.ersparnis).toBeCloseTo(-2.106, 3);
    expect(e.ersparnisWegAb).toBe(0);
  });
  it("Kostengerade trifft die Szenariowerte: Schnittpunkt beider Geraden = Break-even", () => {
    const e = szenarien(DEFAULTS);
    const ratio = DEFAULTS.execOut / DEFAULTS.execRead;
    const x = e.breakEvenRead;
    const yOpus = kostenGerade(OPUS, OPUS, "5min", ratio, 0, x);
    const yOpusplan = kostenGerade(
      OPUS,
      SONNET,
      "5min",
      ratio,
      e.bruchEinmal,
      x,
    );
    expect(yOpus).toBeCloseTo(yOpusplan, 6);
    // und bei x = execRead entspricht die Gerade dem Szenario-Gesamtwert
    expect(kostenGerade(OPUS, OPUS, "5min", ratio, 0, 30)).toBeCloseTo(
      e.nurOpus,
      6,
    );
    expect(
      kostenGerade(OPUS, SONNET, "5min", ratio, e.bruchEinmal, 30),
    ).toBeCloseTo(e.opusplan, 6);
  });
  it("bruchKosten: 93 % des Kontexts zum Write-Preis des Zielmodells", () => {
    expect(bruchKosten(SONNET, 0.18, "5min")).toBeCloseTo(
      0.93 * 0.18 * 3.75,
      6,
    );
    expect(bruchKosten(OPUS, 0.18, "1h")).toBeCloseTo(0.93 * 0.18 * 10, 6);
  });
});
