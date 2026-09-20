/**
 * codexEffortMath.test.ts — pinnt das Kostenmodell der Codex-Effort-Wechsel-
 * Folie, damit spätere Änderungen die gezeigten Zahlen nicht still verstellen.
 * Referenzwerte von Hand nachgerechnet (Sol, Regler-Defaults der Folie:
 * Faktor 2,5 · Kontext 180k · Exec-Read 30 MTok · Exec-Out 150k · 3 Re-Plans
 * · Cache-Bruch an — Kontext und Exec-Out kommen aus SZENARIO_DEFAULTS):
 *
 *   c = 73,65 / 72,67 = 1,013486 (capFaktor Sol)
 *   Plan medium  = c · (0,1·20 + 7,0·0,4 + 0,36·5)   = c · 6,6  =  6,689 $
 *   Exec medium  = c · (0,15·20 + 30·0,4)            = c · 15   = 15,202 $
 *   Bruch        = 0,93 · c · 0,18 · 5               = c · 0,837 = 0,848 $
 *   Nur medium   = 21,891 $ · Nur xhigh = 2,5 · 21,891 = 54,728 $
 *   Wechsel      = 2,5·6,689 + 0,848 + 15,202        = 32,773 $
 *   Ersparnis    = 21,955 $ = 19,23 € (−40,1 %)
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
  it("teilt Read 0,1× und BREAK_SHARE 0,93 mit opusplanMath", () => {
    expect(READ_FAKTOR).toBe(0.1);
    expect(BREAK_SHARE).toBe(0.93);
    expect(PLAN).toEqual({ out: 0.1, read: 7.0, write: 0.36 });
  });
  it("Write 1,25× (GPT-5.6+, einzige TTL 30 min), Kontext 180k, 150k Out je 30 MTok", () => {
    expect(WRITE_FAKTOR).toBe(1.25);
    expect(DEFAULT_CTX).toBe(0.18);
    expect(EXEC_OUT_RATIO).toBe(0.005);
    expect(execOutAusRatio(30)).toBeCloseTo(0.15, 12);
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
  it("Defaults 180k · 30 MTok · 150k · 3 — die Regler-Defaults beider Folien", () => {
    expect(SZENARIO_DEFAULTS).toEqual({
      ctxK: 180,
      readM: 30,
      outK: 150,
      n: 3,
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
    // Exec-Read 60 statt 30 (der Fall aus breakeven-sync-qa.ts): opusplan
    // zeigt dann −45 %, nicht mehr die −37 % der Defaults.
    const bewegt = { ...SZENARIO_DEFAULTS, readM: 60 };
    const live = opusplanVergleich(bewegt);
    expect(live).toEqual(
      opusplanSzenarien({
        ctx: 0.18,
        execRead: 60,
        execOut: 0.15,
        replans: 3,
        ttl: DEFAULT_TTL,
      }),
    );
    expect(Math.round(Math.abs(live.ersparnisProzent))).toBe(45);
    expect(Math.round(Math.abs(OPUSPLAN_REF.ersparnisProzent))).toBe(37);
    // Es wird das rohe Szenario verglichen, keine Codex-Umrechnung:
    expect(opusplanVergleich(toCodexSzenario(bewegt))).toEqual(live);
  });
});

describe("Cache-Bruch eines Effort-Wechsels", () => {
  it("Sol: 0,93 × 180k × 1,25 × $4 = 0,837 $ (vor Fähigkeitsfaktor)", () => {
    expect(bruchKosten(SOL, DEFAULT_CTX)).toBeCloseTo(0.837, 6);
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
    // +150k Out auf medium = c · 0,15 · $20 = 3,04 $; auf xhigh f-mal so viel.
    expect(e.nurMedium - basis.nurMedium).toBeCloseTo(c * 0.15 * 20, 10);
    expect(e.nurXhigh - basis.nurXhigh).toBeCloseTo(2.5 * c * 0.15 * 20, 10);
    expect(e.proMtokErsparnis).toBeGreaterThan(basis.proMtokErsparnis);
    expect(e.breakEvenRead).toBeLessThan(basis.breakEvenRead);
    expect(e.bruchEinmal).toBeCloseTo(basis.bruchEinmal, 10);
  });

  it("execOut im Default-Verhältnis reproduziert exakt die Referenz", () => {
    const e = szenarien({ ...DEFAULTS, execOut: execOutAusRatio(30) });
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

describe("Sol, Regler-Defaults (Faktor 2,5 · 30 MTok · 3 Re-Plans)", () => {
  const e = szenarien(DEFAULTS);

  it("Szenarien: Nur medium 21,89 $ · Nur xhigh 54,73 $ · Effort-Wechsel 32,77 $", () => {
    expect(e.nurMedium).toBeCloseTo(21.8913, 3);
    expect(e.nurXhigh).toBeCloseTo(54.7282, 3);
    expect(e.effortWechsel).toBeCloseTo(32.7731, 3);
    expect(e.antiPattern).toBeCloseTo(44.7038, 3);
  });

  it("Ersparnis 21,96 $ = 19,23 € (−40,1 %) gegenüber durchgängig xhigh", () => {
    expect(e.ersparnis).toBeCloseTo(21.9551, 3);
    expect(toEur(e.ersparnis)).toBeCloseTo(19.23, 2);
    expect(e.ersparnisProzent).toBeCloseTo(40.12, 2);
  });

  it("der eine Bruch kostet 0,85 $, Break-even bei 1,12 MTok Exec-Read bzw. Faktor 1,056", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.8483, 4);
    expect(e.proMtokErsparnis).toBeCloseTo(0.7601, 4);
    expect(e.breakEvenRead).toBeCloseTo(1.116, 3);
    expect(e.breakEvenFaktor).toBeCloseTo(1.0558, 4);
  });

  it("Rückkehr ohne /compact: 2 Brüche 1,70 $ + neuer Plan auf xhigh 2,28 $ = 3,98 $", () => {
    expect(e.rueckkehrBrueche).toBeCloseTo(1.6966, 4);
    expect(e.rueckkehrGesamt).toBeCloseTo(3.9769, 4);
  });

  it("Balken über „Nur xhigh“ ab 6 Rückkehren, allein die Brüche ab 13", () => {
    expect(e.balkenUeberAb).toBe(6);
    expect(e.ersparnisWegAb).toBe(13);
    const bei5 = szenarien({ ...DEFAULTS, replans: 5 });
    const bei6 = szenarien({ ...DEFAULTS, replans: 6 });
    expect(bei5.antiPattern).toBeLessThan(bei5.nurXhigh);
    expect(bei6.antiPattern).toBeGreaterThan(bei6.nurXhigh);
  });

  it("Vergleichsmaßstab opusplan (dessen Regler-Defaults): 9,27 € und −37,3 %", () => {
    expect(toEur(OPUSPLAN_REF.ersparnis)).toBeCloseTo(9.27, 2);
    expect(OPUSPLAN_REF.ersparnisProzent).toBeCloseTo(37.32, 1);
  });

  it("relativ nicht kleiner als opusplan: −40,1 % gegen −37,3 %", () => {
    // Der Prozentwert ist preisneutral; die €-Beträge vergleichen zwei
    // verschieden teure Basen (Nur xhigh 47,94 € gegen Nur Opus 24,83 €).
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

  it("Rückkehren kosten nur den neuen Plan: bei 10 exakt gleichauf, Balken strikt drüber erst ab 11", () => {
    expect(an.rueckkehrGesamt).toBeCloseTo(2.2803, 4);
    expect(an.ersparnisWegAb).toBe(Infinity);
    // (f−1)·15 / (f·0,9) = 10 exakt: bei 10 Rückkehren sind beide Balken
    // gleich (47,94 €), erst 11 liegt STRIKT darüber. Kippt der Pin auf 10,
    // hat eine Umsortierung der Produkte den Quotienten auf 9,99… gedrückt.
    expect(an.ersparnis / an.rueckkehrGesamt).toBeCloseTo(10, 10);
    const bei10 = szenarien({ ...DEFAULTS, cacheErhalten: true, replans: 10 });
    const bei11 = szenarien({ ...DEFAULTS, cacheErhalten: true, replans: 11 });
    expect(bei10.antiPattern).toBeCloseTo(bei10.nurXhigh, 8);
    expect(bei11.antiPattern).toBeGreaterThan(bei11.nurXhigh);
    expect(an.balkenUeberAb).toBe(11);
  });
});

describe("Modellwahl ändert die Zahlen", () => {
  const bei = (modell: ModellKey) =>
    szenarien({ ...DEFAULTS, modell, faktor: effortFaktorRegler(modell) });

  it("Ersparnis in €: Astra 14,50 · Sol 19,23 · Terra 18,41 · Luna 4,30", () => {
    expect(toEur(bei("astra").ersparnis)).toBeCloseTo(14.5, 1);
    expect(toEur(bei("sol").ersparnis)).toBeCloseTo(19.23, 1);
    expect(toEur(bei("terra").ersparnis)).toBeCloseTo(18.41, 1);
    expect(toEur(bei("luna").ersparnis)).toBeCloseTo(4.3, 1);
  });

  it("in Prozent: Sol −40 · Terra −49 · Luna −58 — nur Astra (−21) liegt unter opusplans −37", () => {
    expect(bei("sol").ersparnisProzent).toBeCloseTo(40.1, 1);
    expect(bei("terra").ersparnisProzent).toBeCloseTo(48.8, 1);
    expect(bei("luna").ersparnisProzent).toBeCloseTo(58.3, 1);
    expect(bei("astra").ersparnisProzent).toBeCloseTo(20.6, 1);
    for (const k of ["sol", "terra", "luna"] as const)
      expect(bei(k).ersparnisProzent).toBeGreaterThan(
        OPUSPLAN_REF.ersparnisProzent,
      );
    expect(bei("astra").ersparnisProzent).toBeLessThan(
      OPUSPLAN_REF.ersparnisProzent,
    );
  });

  it("in Euro (verschiedene Basen!): nur Luna spart weniger als opusplans 9,27 €", () => {
    expect(toEur(bei("luna").ersparnis)).toBeLessThan(
      toEur(OPUSPLAN_REF.ersparnis),
    );
    for (const k of ["astra", "sol", "terra"] as const)
      expect(toEur(bei(k).ersparnis)).toBeGreaterThan(
        toEur(OPUSPLAN_REF.ersparnis),
      );
  });

  it("Astra: teuerster Bruch (2,08 $), Break-even 3,35 MTok, Balken drüber ab 3", () => {
    const a = bei("astra");
    expect(a.bruchEinmal).toBeCloseTo(2.0792, 4);
    expect(a.breakEvenRead).toBeCloseTo(3.348, 3);
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
      szenarien({ ...DEFAULTS, execRead: 30 }).ersparnis,
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
