/**
 * codexEffortMath.test.ts — pinnt das Kostenmodell der Codex-Effort-Wechsel-
 * Folie, damit spätere Änderungen die gezeigten Zahlen nicht still verstellen.
 * Referenzwerte von Hand nachgerechnet (Sol, Regler-Defaults der Folie:
 * Faktor 2,5 · Kontext 180k · Exec-Read 21 MTok · Exec-Out 80k · 2 Re-Plans
 * · Cache-Bruch an — Kontext und Exec-Out kommen aus SZENARIO_DEFAULTS):
 *
 *   c = 73,65 / 72,67 = 1,013486 (capFaktor Sol)
 *   Plan medium  = c · (0,03·20 + 4,1·0,4 + 0,16·5)  = c · 3,04 =  3,081 $
 *   Exec medium  = c · (0,08·20 + 21·0,4)            = c · 10   = 10,135 $
 *   Bruch        = 0,85 · c · 0,18 · 5               = c · 0,765 = 0,775 $
 *   Nur medium   = 13,216 $ · Nur xhigh = 2,5 · 13,216 = 33,040 $
 *   Wechsel      = 2,5·3,081 + 0,775 + 10,135        = 18,613 $
 *   Ersparnis    = 14,427 $ = 12,64 € (−43,7 %)
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CTX,
  DEFAULT_MODELL,
  EXEC_OUT_RATIO,
  MODELLE,
  OPUSPLAN_REF,
  WRITE_FAKTOR,
  bruchKosten,
  effortFaktorRegler,
  execOutAusRatio,
  kostenGeraden,
  modellByKey,
  opusplanVergleich,
  szenarien,
  toCodexSzenario,
  toEur,
  type Eingaben,
  type ModellKey,
} from "../codexEffortMath";
import {
  BREAK_SHARE,
  DEFAULT_TTL,
  PLAN,
  READ_FAKTOR,
  szenarien as opusplanSzenarien,
} from "../opusplanMath";
import {
  SZENARIO_BEREICHE,
  SZENARIO_DEFAULTS,
  ctxK,
  n as nRef,
  outK,
  readM,
  resetSzenario,
  szenarioSnapshot,
} from "../scenarioState";

const SOL = modellByKey("sol");

const DEFAULTS: Eingaben = {
  modell: "sol",
  faktor: effortFaktorRegler("sol"),
  ctx: SZENARIO_DEFAULTS.ctxK / 1000,
  execRead: SZENARIO_DEFAULTS.readM,
  execOut: SZENARIO_DEFAULTS.outK / 1000,
  replans: SZENARIO_DEFAULTS.n,
  cacheErhalten: false,
};

describe("Konstanten", () => {
  it("teilt Read 0,1× und BREAK_SHARE 0,85 mit opusplanMath", () => {
    expect(READ_FAKTOR).toBe(0.1);
    expect(BREAK_SHARE).toBe(0.85);
    expect(PLAN).toEqual({ out: 0.03, read: 4.1, write: 0.16 });
  });
  it("Write 1,25× (GPT-5.6+, einzige TTL 30 min), Kontext 180k, 80k Out je 21 MTok", () => {
    expect(WRITE_FAKTOR).toBe(1.25);
    expect(DEFAULT_CTX).toBe(0.18);
    expect(EXEC_OUT_RATIO).toBeCloseTo(0.08 / 21, 12);
    expect(execOutAusRatio(21)).toBeCloseTo(0.08, 12);
  });
  it("Sol ist der Default, Reihenfolge teuer → billig", () => {
    expect(DEFAULT_MODELL).toBe("sol");
    expect(MODELLE.map((m) => m.key)).toEqual([
      "astra",
      "sol",
      "terra",
      "luna",
    ]);
  });
  it("Listenpreise USD/MTok (developers.openai.com/api/docs/pricing, 16.09.2026)", () => {
    const preise = Object.fromEntries(
      MODELLE.map((m) => [m.key, [m.input, m.output]]),
    );
    expect(preise).toEqual({
      astra: [10, 50],
      sol: [4, 20],
      terra: [2, 12],
      luna: [0.2, 1.2],
    });
  });
});

describe("Faktoren aus der DeepSWE-Leiter (paretoData.EFFORTS)", () => {
  it("effortFaktor = €/Task xhigh ÷ medium: Astra 1,49 · Sol 2,54 · Terra 3,63 · Luna 6,75", () => {
    const f = Object.fromEntries(
      MODELLE.map((m) => [m.key, Number(m.effortFaktor.toFixed(2))]),
    );
    expect(f).toEqual({ astra: 1.49, sol: 2.54, terra: 3.63, luna: 6.75 });
  });
  it("Regler-Vorgabe ist auf eine Nachkommastelle gerundet", () => {
    expect(effortFaktorRegler("astra")).toBe(1.5);
    expect(effortFaktorRegler("sol")).toBe(2.5);
    expect(effortFaktorRegler("terra")).toBe(3.6);
    expect(effortFaktorRegler("luna")).toBe(6.8);
  });
  it("capFaktor = pass@1 Opus 5 ÷ bestes pass@1 des Modells, alle ≤ 10 %", () => {
    const c = Object.fromEntries(
      MODELLE.map((m) => [m.key, Number(m.capFaktor.toFixed(3))]),
    );
    expect(c).toEqual({ astra: 0.994, sol: 1.013, terra: 1.058, luna: 1.096 });
    for (const m of MODELLE) {
      expect(m.capFaktor).toBeGreaterThan(0.95);
      expect(m.capFaktor).toBeLessThan(1.1);
    }
  });
});

describe("Geteiltes Szenario (scenarioState.ts)", () => {
  it("Defaults 180k · 21 MTok · 80k · 2 — die Regler-Defaults beider Folien", () => {
    expect(SZENARIO_DEFAULTS).toEqual({
      ctxK: 180,
      readM: 21,
      outK: 80,
      n: 2,
    });
    expect(Object.isFrozen(SZENARIO_DEFAULTS)).toBe(true);
  });
  it("Bereiche wie die opusplan-Regler; jeder Default liegt im Bereich", () => {
    expect(SZENARIO_BEREICHE.ctxK).toEqual({ min: 80, max: 700, step: 10 });
    expect(SZENARIO_BEREICHE.readM).toEqual({ min: 5, max: 120, step: 1 });
    expect(SZENARIO_BEREICHE.outK).toEqual({ min: 80, max: 400, step: 10 });
    expect(SZENARIO_BEREICHE.n).toEqual({ min: 0, max: 13, step: 1 });
    for (const k of ["ctxK", "readM", "outK", "n"] as const) {
      expect(SZENARIO_DEFAULTS[k]).toBeGreaterThanOrEqual(
        SZENARIO_BEREICHE[k].min,
      );
      expect(SZENARIO_DEFAULTS[k]).toBeLessThanOrEqual(
        SZENARIO_BEREICHE[k].max,
      );
    }
  });
  it("Refs starten auf den Defaults; resetSzenario() bringt sie zurück", () => {
    expect(szenarioSnapshot()).toEqual(SZENARIO_DEFAULTS);
    ctxK.value = 400;
    readM.value = 90;
    outK.value = 300;
    nRef.value = 7;
    expect(szenarioSnapshot()).toEqual({
      ctxK: 400,
      readM: 90,
      outK: 300,
      n: 7,
    });
    resetSzenario();
    expect(szenarioSnapshot()).toEqual(SZENARIO_DEFAULTS);
  });
  it("toCodexSzenario ist (noch) die Identität und gibt eine Kopie zurück", () => {
    const s = { ctxK: 400, readM: 90, outK: 300, n: 7 };
    const t = toCodexSzenario(s);
    expect(t).toEqual(s);
    expect(t).not.toBe(s);
  });
  it("OPUSPLAN_REF folgt SZENARIO_DEFAULTS statt abgetippten Zahlen", () => {
    expect(OPUSPLAN_REF).toEqual(
      opusplanSzenarien({
        ctx: SZENARIO_DEFAULTS.ctxK / 1000,
        execRead: SZENARIO_DEFAULTS.readM,
        execOut: SZENARIO_DEFAULTS.outK / 1000,
        replans: SZENARIO_DEFAULTS.n,
        ttl: DEFAULT_TTL,
      }),
    );
    // Sichtbar ungleich, sobald jemand die Defaults verstellt:
    const anders = opusplanSzenarien({
      ctx: 0.4,
      execRead: 90,
      execOut: 0.3,
      replans: 7,
      ttl: DEFAULT_TTL,
    });
    expect(anders.ersparnis).not.toBeCloseTo(OPUSPLAN_REF.ersparnis, 1);
  });
  it("opusplanVergleich rechnet opusplan (1-h-TTL) über einem bewegten Szenario — die Notiz vergleicht damit live", () => {
    expect(opusplanVergleich(SZENARIO_DEFAULTS)).toEqual(OPUSPLAN_REF);
    // Exec-Read 60 statt 21 (der Fall aus breakeven-sync-qa.ts): opusplan
    // zeigt dann −16 %, nicht mehr die −13 % der Defaults.
    const bewegt = { ...SZENARIO_DEFAULTS, readM: 60 };
    const live = opusplanVergleich(bewegt);
    expect(live).toEqual(
      opusplanSzenarien({
        ctx: 0.18,
        execRead: 60,
        execOut: 0.08,
        replans: 2,
        ttl: DEFAULT_TTL,
      }),
    );
    expect(Math.round(Math.abs(live.ersparnisProzent))).toBe(16);
    expect(Math.round(Math.abs(OPUSPLAN_REF.ersparnisProzent))).toBe(13);
    // Es wird das rohe Szenario verglichen, keine Codex-Umrechnung:
    expect(opusplanVergleich(toCodexSzenario(bewegt))).toEqual(live);
  });
});

describe("Cache-Bruch eines Effort-Wechsels", () => {
  it("Sol: 0,85 × 180k × 1,25 × $4 = 0,765 $ (vor Fähigkeitsfaktor)", () => {
    expect(bruchKosten(SOL, DEFAULT_CTX)).toBeCloseTo(0.765, 6);
  });
});

describe("Kontext und Exec-Output als Eingaben", () => {
  const basis = szenarien(DEFAULTS);

  it("doppelter Kontext = doppelter Bruch, Plan- und Exec-Kosten unverändert", () => {
    const e = szenarien({ ...DEFAULTS, ctx: 0.36 });
    expect(e.bruchEinmal).toBeCloseTo(2 * basis.bruchEinmal, 10);
    expect(e.nurXhigh).toBeCloseTo(basis.nurXhigh, 10);
    expect(e.nurMedium).toBeCloseTo(basis.nurMedium, 10);
    expect(e.effortWechsel - basis.effortWechsel).toBeCloseTo(
      basis.bruchEinmal,
      10,
    );
    expect(e.breakEvenRead).toBeCloseTo(2 * basis.breakEvenRead, 10);
    expect(e.rueckkehrBrueche).toBeCloseTo(2 * basis.rueckkehrBrueche, 10);
  });

  it("mehr Exec-Output verteuert medium wie xhigh und hebt die Ersparnis je MTok", () => {
    const e = szenarien({ ...DEFAULTS, execOut: 0.3 });
    const c = SOL.capFaktor;
    // +220k Out auf medium = c · 0,22 · $20 = 4,46 $; auf xhigh f-mal so viel.
    expect(e.nurMedium - basis.nurMedium).toBeCloseTo(c * 0.22 * 20, 10);
    expect(e.nurXhigh - basis.nurXhigh).toBeCloseTo(2.5 * c * 0.22 * 20, 10);
    expect(e.proMtokErsparnis).toBeGreaterThan(basis.proMtokErsparnis);
    expect(e.breakEvenRead).toBeLessThan(basis.breakEvenRead);
    expect(e.bruchEinmal).toBeCloseTo(basis.bruchEinmal, 10);
  });

  it("execOut im Default-Verhältnis reproduziert exakt die Referenz", () => {
    const e = szenarien({ ...DEFAULTS, execOut: execOutAusRatio(21) });
    expect(e.effortWechsel).toBeCloseTo(basis.effortWechsel, 12);
    // und bei anderem Exec-Read bleibt der Break-even nur dann volumenneutral,
    // wenn der Output im selben Verhältnis mitwächst
    const a = szenarien({
      ...DEFAULTS,
      execRead: 90,
      execOut: execOutAusRatio(90),
    });
    expect(a.breakEvenRead).toBeCloseTo(basis.breakEvenRead, 10);
  });
});

describe("Kostengeraden fürs Break-even-Chart", () => {
  it("treffen bei x = execRead die Szenario-Balken und schneiden sich im Break-even", () => {
    for (const m of MODELLE)
      for (const faktor of [1, 1.5, 2.5, 8])
        for (const cacheErhalten of [false, true]) {
          const e: Eingaben = {
            ...DEFAULTS,
            modell: m.key,
            faktor,
            cacheErhalten,
          };
          const erg = szenarien(e);
          const g = kostenGeraden(e);
          expect(g.nurXhigh(e.execRead)).toBeCloseTo(erg.nurXhigh, 10);
          expect(g.effortWechsel(e.execRead)).toBeCloseTo(
            erg.effortWechsel,
            10,
          );
          if (Number.isFinite(erg.breakEvenRead))
            expect(g.nurXhigh(erg.breakEvenRead)).toBeCloseTo(
              g.effortWechsel(erg.breakEvenRead),
              8,
            );
          else
            expect(g.nurXhigh(0) - g.effortWechsel(0)).toBeCloseTo(
              -erg.bruchEinmal,
              10,
            );
        }
  });
  it("am rechten Chart-Rand (20 MTok) liegt der Wechsel oben, sobald der Break-even dahinter liegt — das Chart setzt die Labels danach", () => {
    // Faktor 1,0: kein Break-even, „Effort-Wechsel“ bleibt die obere Gerade.
    const g1 = kostenGeraden({ ...DEFAULTS, faktor: 1 });
    expect(g1.effortWechsel(20)).toBeGreaterThan(g1.nurXhigh(20));
    // Faktor 1,2 · Kontext 700k · 120 MTok Read / 80k Out: Break-even > 20.
    const e = {
      ...DEFAULTS,
      faktor: 1.2,
      ctx: 0.7,
      execRead: 120,
      execOut: 0.08,
    };
    expect(szenarien(e).breakEvenRead).toBeGreaterThan(20);
    const g2 = kostenGeraden(e);
    expect(g2.effortWechsel(20)).toBeGreaterThan(g2.nurXhigh(20));
    // Defaults: Break-even 1,12 MTok, am Rand liegt „Nur xhigh“ oben.
    const g3 = kostenGeraden(DEFAULTS);
    expect(g3.nurXhigh(20)).toBeGreaterThan(g3.effortWechsel(20));
  });
  it("„Nur xhigh“ startet ohne Bruch tiefer und steigt f-mal so steil", () => {
    const g = kostenGeraden(DEFAULTS);
    const erg = szenarien(DEFAULTS);
    expect(g.effortWechsel(0) - g.nurXhigh(0)).toBeCloseTo(erg.bruchEinmal, 10);
    const steigung = (fn: (x: number) => number) => fn(10) - fn(0);
    expect(steigung(g.nurXhigh) / steigung(g.effortWechsel)).toBeCloseTo(
      2.5,
      10,
    );
  });
});

describe("Sol, Regler-Defaults (Faktor 2,5 · 21 MTok · 2 Re-Plans)", () => {
  const e = szenarien(DEFAULTS);

  it("Szenarien: Nur medium 13,22 $ · Nur xhigh 33,04 $ · Effort-Wechsel 18,61 $", () => {
    expect(e.nurMedium).toBeCloseTo(13.2159, 3);
    expect(e.nurXhigh).toBeCloseTo(33.0396, 3);
    expect(e.effortWechsel).toBeCloseTo(18.6127, 3);
    expect(e.antiPattern).toBeCloseTo(21.8153, 3);
  });

  it("Ersparnis 14,43 $ = 12,64 € (−43,7 %) gegenüber durchgängig xhigh", () => {
    expect(e.ersparnis).toBeCloseTo(14.427, 3);
    expect(toEur(e.ersparnis)).toBeCloseTo(12.64, 2);
    expect(e.ersparnisProzent).toBeCloseTo(43.67, 2);
  });

  it("der eine Bruch kostet 0,78 $, Break-even bei 1,07 MTok Exec-Read bzw. Faktor 1,077", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.7753, 4);
    expect(e.proMtokErsparnis).toBeCloseTo(0.7239, 4);
    expect(e.breakEvenRead).toBeCloseTo(1.071, 3);
    expect(e.breakEvenFaktor).toBeCloseTo(1.0765, 4);
  });

  it("Rückkehr ohne /compact: 2 Brüche 1,55 $ + neuer Plan auf xhigh 0,05 $ = 1,60 $", () => {
    expect(e.rueckkehrBrueche).toBeCloseTo(1.5506, 4);
    expect(e.rueckkehrGesamt).toBeCloseTo(1.6013, 4);
  });

  it("Balken über „Nur xhigh“ ab 10 Rückkehren, allein die Brüche ebenfalls ab 10", () => {
    expect(e.balkenUeberAb).toBe(10);
    expect(e.ersparnisWegAb).toBe(10);
    const bei9 = szenarien({ ...DEFAULTS, replans: 9 });
    const bei10 = szenarien({ ...DEFAULTS, replans: 10 });
    expect(bei9.antiPattern).toBeLessThan(bei9.nurXhigh);
    expect(bei10.antiPattern).toBeGreaterThan(bei10.nurXhigh);
  });

  it("Vergleichsmaßstab opusplan (dessen Regler-Defaults): 1,25 € und −13,0 %", () => {
    expect(toEur(OPUSPLAN_REF.ersparnis)).toBeCloseTo(1.25, 2);
    expect(OPUSPLAN_REF.ersparnisProzent).toBeCloseTo(12.97, 1);
  });

  it("relativ deutlich größer als opusplan: −43,7 % gegen −13,0 %", () => {
    // Der Prozentwert ist preisneutral; die €-Beträge vergleichen zwei
    // verschieden teure Basen (Nur xhigh 28,94 € gegen Nur Opus 9,61 €).
    expect(e.ersparnisProzent).toBeGreaterThan(OPUSPLAN_REF.ersparnisProzent);
    expect(toEur(e.ersparnis)).toBeGreaterThan(toEur(OPUSPLAN_REF.ersparnis));
  });
});

describe("Schalter „Cache erhalten“ (configuration_update, experimentell)", () => {
  const an = szenarien({ ...DEFAULTS, cacheErhalten: true });
  const aus = szenarien(DEFAULTS);

  it("setzt Bruch und Break-even auf 0 und hebt die Ersparnis genau um den Bruch", () => {
    expect(an.bruchEinmal).toBe(0);
    expect(an.breakEvenRead).toBe(0);
    expect(an.breakEvenFaktor).toBe(1);
    expect(an.rueckkehrBrueche).toBe(0);
    expect(an.ersparnis - aus.ersparnis).toBeCloseTo(aus.bruchEinmal, 10);
  });

  it("Rückkehren kosten nur den neuen Plan: Balken strikt drüber erst ab 301", () => {
    expect(an.rueckkehrGesamt).toBeCloseTo(0.0507, 4);
    expect(an.ersparnisWegAb).toBe(Infinity);
    // Mit dem gemessenen Re-Plan-Output von 1k Tokens ist eine Rückkehr fast
    // gratis: 14,43 $ Ersparnis / 0,0507 $ = 300 exakt. Bei 300 sind beide
    // Balken gleich, erst 301 liegt STRIKT darüber. Kippt der Pin auf 300,
    // hat eine Umsortierung der Produkte den Quotienten auf 299,99… gedrückt.
    expect(an.ersparnis / an.rueckkehrGesamt).toBeCloseTo(300, 6);
    const bei300 = szenarien({
      ...DEFAULTS,
      cacheErhalten: true,
      replans: 300,
    });
    const bei301 = szenarien({
      ...DEFAULTS,
      cacheErhalten: true,
      replans: 301,
    });
    expect(bei300.antiPattern).toBeCloseTo(bei300.nurXhigh, 6);
    expect(bei301.antiPattern).toBeGreaterThan(bei301.nurXhigh);
    expect(an.balkenUeberAb).toBe(301);
  });
});

describe("Modellwahl ändert die Zahlen", () => {
  const bei = (modell: ModellKey) =>
    szenarien({ ...DEFAULTS, modell, faktor: effortFaktorRegler(modell) });

  it("Ersparnis in €: Astra 9,22 · Sol 12,64 · Terra 12,08 · Luna 2,84", () => {
    expect(toEur(bei("astra").ersparnis)).toBeCloseTo(9.22, 1);
    expect(toEur(bei("sol").ersparnis)).toBeCloseTo(12.64, 1);
    expect(toEur(bei("terra").ersparnis)).toBeCloseTo(12.08, 1);
    expect(toEur(bei("luna").ersparnis)).toBeCloseTo(2.84, 1);
  });

  it("in Prozent: Astra −22 · Sol −44 · Terra −54 · Luna −65 — alle vier über opusplans −13", () => {
    expect(bei("astra").ersparnisProzent).toBeCloseTo(21.7, 1);
    expect(bei("sol").ersparnisProzent).toBeCloseTo(43.7, 1);
    expect(bei("terra").ersparnisProzent).toBeCloseTo(53.7, 1);
    expect(bei("luna").ersparnisProzent).toBeCloseTo(64.5, 1);
    for (const k of ["astra", "sol", "terra", "luna"] as const)
      expect(bei(k).ersparnisProzent).toBeGreaterThan(
        OPUSPLAN_REF.ersparnisProzent,
      );
  });

  it("in Euro (verschiedene Basen!): jedes Codex-Modell spart mehr als opusplans 1,25 €", () => {
    for (const k of ["astra", "sol", "terra", "luna"] as const)
      expect(toEur(bei(k).ersparnis)).toBeGreaterThan(
        toEur(OPUSPLAN_REF.ersparnis),
      );
  });

  it("Astra: teuerster Bruch (1,90 $), Break-even 3,21 MTok, Balken drüber ab 3", () => {
    const a = bei("astra");
    expect(a.bruchEinmal).toBeCloseTo(1.9004, 4);
    expect(a.breakEvenRead).toBeCloseTo(3.213, 3);
    expect(a.balkenUeberAb).toBe(3);
  });
});

describe("Invarianten", () => {
  it("Faktor 1: der Wechsel kostet genau den Bruch mehr als Nur xhigh (= Nur medium)", () => {
    const e = szenarien({ ...DEFAULTS, faktor: 1 });
    expect(e.nurXhigh).toBeCloseTo(e.nurMedium, 10);
    expect(e.ersparnis).toBeCloseTo(-e.bruchEinmal, 10);
    expect(e.breakEvenRead).toBe(Infinity);
    expect(e.ersparnisWegAb).toBe(0);
    expect(e.balkenUeberAb).toBe(0);
  });

  it("0 Rückkehren: Anti-Pattern = Effort-Wechsel; jede Rückkehr kostet rueckkehrGesamt", () => {
    const e0 = szenarien({ ...DEFAULTS, replans: 0 });
    expect(e0.antiPattern).toBeCloseTo(e0.effortWechsel, 10);
    const e4 = szenarien({ ...DEFAULTS, replans: 4 });
    expect(e4.antiPattern - e0.antiPattern).toBeCloseTo(
      4 * e0.rueckkehrGesamt,
      10,
    );
  });

  it("Ersparnis wächst mit Faktor und Exec-Volumen, Break-even fällt mit dem Faktor", () => {
    let prev = szenarien({ ...DEFAULTS, faktor: 1.2 });
    for (const faktor of [1.5, 2, 3, 5, 8]) {
      const cur = szenarien({ ...DEFAULTS, faktor });
      expect(cur.ersparnis).toBeGreaterThan(prev.ersparnis);
      expect(cur.breakEvenRead).toBeLessThan(prev.breakEvenRead);
      prev = cur;
    }
    expect(szenarien({ ...DEFAULTS, execRead: 60 }).ersparnis).toBeGreaterThan(
      szenarien({ ...DEFAULTS, execRead: 21 }).ersparnis,
    );
  });

  it("Break-even hängt bei festem Out/Read-Verhältnis nicht vom Exec-Volumen ab und bleibt bei Regler-Defaults unter 3,5 MTok", () => {
    // Seit Exec-Out ein eigener Regler ist, steckt das Verhältnis in den
    // Eingaben: mit festem Output je MTok bleibt der Break-even volumen-
    // neutral (wie bisher), mit festem Output in kTok wandert er — genau
    // wie auf der opusplan-Folie.
    for (const m of MODELLE) {
      const f = effortFaktorRegler(m.key);
      const a = szenarien({
        ...DEFAULTS,
        modell: m.key,
        faktor: f,
        execRead: 5,
        execOut: execOutAusRatio(5),
      });
      const b = szenarien({
        ...DEFAULTS,
        modell: m.key,
        faktor: f,
        execRead: 120,
        execOut: execOutAusRatio(120),
      });
      expect(a.breakEvenRead).toBeCloseTo(b.breakEvenRead, 10);
      expect(a.breakEvenRead).toBeLessThan(3.5);
      const festerOut = szenarien({
        ...DEFAULTS,
        modell: m.key,
        faktor: f,
        execRead: 5,
      });
      expect(festerOut.breakEvenRead).toBeLessThan(a.breakEvenRead);
    }
  });

  it("Sweep: über alle Modelle und Regler-Ecken (Faktor ≥ 1,5) spart der Wechsel ab 5 MTok Exec-Read immer", () => {
    for (const m of MODELLE)
      for (const faktor of [1.5, 2, 4, 8])
        for (const execRead of [5, 30, 120])
          for (const cacheErhalten of [false, true]) {
            const e = szenarien({
              ...DEFAULTS,
              modell: m.key,
              faktor,
              execRead,
              execOut: execOutAusRatio(execRead),
              replans: 0,
              cacheErhalten,
            });
            expect(e.ersparnis).toBeGreaterThan(0);
            expect(e.breakEvenRead).toBeLessThan(5);
          }
  });
});
