/**
 * opusplanMath.test.ts — pinnt das Kostenmodell der opusplan-Break-even-Folie,
 * damit spätere Änderungen die gezeigten Zahlen nicht still verstellen.
 * Referenzwerte von Hand nachgerechnet (Defaults: C=0,18 · R=30 · O=0,15 · N=3,
 * TTL=1 h wie DEFAULT_TTL — die Folie modelliert eine interaktive Session).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TTL,
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
  replans: 3,
  ttl: DEFAULT_TTL,
};

describe("Default-TTL", () => {
  it("ist 1 h — die Folie rechnet eine interaktive Session", () => {
    // Der Schalter der Folie startet auf diesem Wert. Steht er wieder auf
    // "5min", widerspricht die Rechnung der Fußzeile derselben Folie.
    expect(DEFAULT_TTL).toBe("1h");
  });
});

describe("Defaults bei 1-h-TTL (Write 2×, jedes Claude-Abo im Kontingent)", () => {
  const e = szenarien(DEFAULTS);
  it("Phasenkosten: Plan 3,84/9,60 $ · Exec 7,50/18,75 $ (Exec −60 %)", () => {
    expect(planKosten(SONNET, "1h")).toBeCloseTo(3.84, 4);
    expect(planKosten(OPUS, "1h")).toBeCloseTo(9.6, 4);
    expect(execKosten(SONNET, 30, 0.15)).toBeCloseTo(7.5, 4);
    expect(execKosten(OPUS, 30, 0.15)).toBeCloseTo(18.75, 4);
  });
  it("Szenarien: 11,34 / 28,35 / 17,77 / 28,18 $", () => {
    expect(e.nurSonnet).toBeCloseTo(11.34, 3);
    expect(e.nurOpus).toBeCloseTo(28.35, 3);
    expect(e.opusplan).toBeCloseTo(17.77, 3);
    expect(e.antiPattern).toBeCloseTo(28.1754, 4);
  });
  it("Bruch 0,670 $ · Ersparnis 10,58 $ (−37 %) · Break-even 1,79 MTok", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.6696, 4);
    expect(e.ersparnis).toBeCloseTo(10.58, 3);
    expect(e.ersparnisProzent).toBeCloseTo(37.32, 1);
    expect(e.breakEvenRead).toBeCloseTo(1.786, 3);
  });
  it("Rückkehr: Brüche 2,344 $ (≈2,05 €) + Re-Plan = 3,469 $ · Balken ab 4×, Ersparnis weg ab 5×", () => {
    expect(e.rueckkehrBrueche).toBeCloseTo(2.344, 3);
    expect(toEur(e.rueckkehrBrueche)).toBeCloseTo(2.053, 3);
    expect(e.rueckkehrGesamt).toBeCloseTo(3.469, 3);
    expect(e.ersparnisWegAb).toBe(5);
    // Zwei Maßstäbe, beide auf der Folie: der BALKEN trägt zusätzlich den
    // Re-Plan-Output (0,99 €) und liegt darum schon ab 4× über „Nur Opus“,
    // während ersparnisWegAb nur die Brüche zählt — die Re-Plan-Arbeit fiele
    // auch ohne Modellwechsel an.
    expect(e.balkenUeberAb).toBe(4);
    expect(toEur(e.rueckkehrGesamt - e.rueckkehrBrueche)).toBeCloseTo(
      0.9855,
      4,
    );
  });
  it("Euro-Umrechnung wie paretoData: 9,93 / 24,83 / 15,57 / 24,68 €", () => {
    expect(toEur(1)).toBeCloseTo(0.876, 6);
    expect(toEur(e.nurSonnet)).toBeCloseTo(9.93, 2);
    expect(toEur(e.nurOpus)).toBeCloseTo(24.83, 2);
    expect(toEur(e.opusplan)).toBeCloseTo(15.57, 2);
    expect(toEur(e.antiPattern)).toBeCloseTo(24.68, 2);
  });
  it("Anti-Pattern überholt Nur Opus erst ab der vierten Rückkehr", () => {
    // Mit Sonnet 4.6 ($3/$15) war das schon bei zwei Rückkehren der Fall. Mit
    // Sonnet 5 spart opusplan mehr, also braucht es mehr Rückkehren — die
    // Folie zeigt bei ihrem Default n=3 einen Balken, der „Nur Opus“ gerade
    // eben erreicht.
    const bei = (n: number) => szenarien({ ...DEFAULTS, replans: n });
    expect(bei(2).antiPattern).toBeLessThan(bei(2).nurOpus);
    expect(bei(3).antiPattern).toBeLessThan(bei(3).nurOpus);
    expect(bei(4).antiPattern).toBeGreaterThan(bei(4).nurOpus);
    // Der Regler-Default der Folie: bei 3 sind die beiden Balken optisch
    // deckungsgleich (0,6 % Abstand) — genau das ist dort die Pointe.
    const bei3 = bei(3);
    expect((bei3.nurOpus - bei3.antiPattern) / bei3.nurOpus).toBeLessThan(0.01);
    expect(bei3.balkenUeberAb).toBe(4);
  });
});

describe("Option 5-min-TTL (Write 1,25× — API-Key, Credits, Cloud, Kontingent leer)", () => {
  const e = szenarien({ ...DEFAULTS, ttl: "5min" });
  it("Phasenkosten: Plan 3,30/8,25 $", () => {
    expect(planKosten(SONNET, "5min")).toBeCloseTo(3.3, 4);
    expect(planKosten(OPUS, "5min")).toBeCloseTo(8.25, 4);
  });
  it("Szenarien: 10,80 / 27,00 / 16,17 / 23,94 $ (9,46 / 23,65 / 14,16 / 20,97 €)", () => {
    expect(e.nurSonnet).toBeCloseTo(10.8, 3);
    expect(e.nurOpus).toBeCloseTo(27.0, 3);
    expect(e.opusplan).toBeCloseTo(16.169, 3);
    expect(e.antiPattern).toBeCloseTo(23.938, 3);
    expect(toEur(e.nurSonnet)).toBeCloseTo(9.46, 2);
    expect(toEur(e.nurOpus)).toBeCloseTo(23.65, 2);
    expect(toEur(e.opusplan)).toBeCloseTo(14.16, 2);
    expect(toEur(e.antiPattern)).toBeCloseTo(20.97, 2);
  });
  it("Brüche ×1/1,6: Bruch 0,419 $ · Break-even 1,12 MTok · Balken ab 5×, Ersparnis weg ab 8×", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.4185, 4);
    expect(e.ersparnis).toBeCloseTo(10.8315, 4);
    expect(e.breakEvenRead).toBeCloseTo(1.116, 3);
    expect(e.rueckkehrBrueche).toBeCloseTo(1.465, 3);
    expect(e.ersparnisWegAb).toBe(8);
    expect(e.balkenUeberAb).toBe(5);
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
  it("Worst Case über alle Reglerbereiche: Break-even ≤ 8,4 MTok", () => {
    // Maximaler Bruch (Kontext ganz rechts) gegen minimale Ersparnis pro MTok
    // (viel Read, wenig Output). Mit Sonnet 4.6 waren das 18,9 MTok und die
    // 20er-Sprosse der x-Leiter wurde erreicht; mit Sonnet 5 ist sie reine
    // Reserve — die Leiter bleibt trotzdem stehen, Preise ändern sich.
    const e = szenarien({
      ctx: 0.7,
      execRead: 120,
      execOut: 0.08,
      replans: 0,
      ttl: "1h",
    });
    expect(e.breakEvenRead).toBeCloseTo(8.4, 1);
    expect(e.breakEvenRead).toBeLessThanOrEqual(12);
  });
  it("Mit Sonnet 5 ist opusplan an JEDER Reglerstellung billiger als Nur Opus", () => {
    // Vorher erreichbar: bei kleinem Exec-Volumen und großem Kontext war
    // opusplan teurer, und die Komponente zeigte „kostet hier X € mehr".
    // Sonnet 5 macht die Exec-Phase so billig, dass der Bruch sie im ganzen
    // Reglerbereich nicht mehr aufwiegt. Der Zweig bleibt im Code — er greift
    // wieder, sobald sich Preise oder Reglergrenzen ändern.
    let schlechteste = Infinity;
    for (const ctx of [0.08, 0.18, 0.4, 0.7]) {
      for (const execRead of [5, 12, 30, 60, 120]) {
        for (const execOut of [0.08, 0.15, 0.25, 0.4]) {
          for (const ttl of ["5min", "1h"] as const) {
            const e = szenarien({ ctx, execRead, execOut, replans: 0, ttl });
            schlechteste = Math.min(schlechteste, e.ersparnis);
          }
        }
      }
    }
    expect(schlechteste).toBeGreaterThan(0);
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
    expect(kostenGerade(OPUS, OPUS, DEFAULTS.ttl, ratio, 0, 30)).toBeCloseTo(
      e.nurOpus,
      6,
    );
    expect(
      kostenGerade(OPUS, SONNET, DEFAULTS.ttl, ratio, e.bruchEinmal, 30),
    ).toBeCloseTo(e.opusplan, 6);
  });
  it("bruchKosten: 93 % des Kontexts zum Write-Preis des Zielmodells", () => {
    expect(bruchKosten(SONNET, 0.18, "5min")).toBeCloseTo(0.93 * 0.18 * 2.5, 6);
    expect(bruchKosten(OPUS, 0.18, "1h")).toBeCloseTo(0.93 * 0.18 * 10, 6);
  });
});
