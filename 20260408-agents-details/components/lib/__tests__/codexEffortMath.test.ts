/**
 * codexEffortMath.test.ts — pinnt das Kostenmodell der Codex-Effort-Wechsel-
 * Folie, damit spätere Änderungen die gezeigten Zahlen nicht still verstellen.
 * Referenzwerte von Hand nachgerechnet (Sol 6.1, Regler-Defaults der Folie:
 * Faktor 1,8 · Kontext 180k · Exec-Read 21 MTok · Exec-Out 80k · 2 Re-Plans
 * · Cache-Bruch an — Kontext und Exec-Out kommen aus SZENARIO_DEFAULTS;
 * Preise $2 / $10, Read 0,05×, Write 1,25×):
 *
 *   c = 57,622 / 51,833 = 1,111687 (capFaktor Sol 6.1, AA-Index, Opus 5.5)
 *   Plan medium  = c · (0,03·10 + 4,1·0,1 + 0,16·2,5) = c · 1,11  = 1,2340 $
 *   Exec medium  = c · (0,08·10 + 21·0,1)             = c · 2,9   = 3,2239 $
 *   Bruch        = 0,85 · c · 0,18 · 2,5              = c · 0,3825 = 0,4252 $
 *   Nur medium   = 4,4579 $ · Nur xhigh = 1,8 · 4,4579 = 8,0242 $
 *   Wechsel      = 1,8·1,2340 + 0,4252 + 3,2239       = 5,8703 $
 *   Ersparnis    = 2,1539 $ = 1,89 € (−26,8 %)
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CTX,
  CONFIG_UPDATE_SLUGS,
  DEFAULT_MODELL,
  EXEC_OUT_RATIO,
  MODELLE,
  OPUSPLAN_REF,
  WRITE_FAKTOR,
  bruchKosten,
  cacheBleibt,
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

const SOL = modellByKey("sol61");

const DEFAULTS: Eingaben = {
  modell: "sol61",
  faktor: effortFaktorRegler("sol61"),
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
  it("Sol 6.1 ist der Default (Codex-Default seit 0.159.1), Reihenfolge teuer → billig, kein Terra", () => {
    expect(DEFAULT_MODELL).toBe("sol61");
    expect(MODELLE.map((m) => m.key)).toEqual([
      "astra",
      "sol61",
      "sol",
      "luna",
    ]);
    expect(MODELLE.map((m) => m.slug)).toEqual([
      "gpt-6-astra",
      "gpt-6.1-sol",
      "gpt-6-sol",
      "gpt-6-luna",
    ]);
  });
  it("Listenpreise USD/MTok (developers.openai.com/api/docs/pricing, 05.10.2026)", () => {
    const preise = Object.fromEntries(
      MODELLE.map((m) => [m.key, [m.input, m.output]]),
    );
    expect(preise).toEqual({
      astra: [10, 50],
      sol61: [2, 10],
      sol: [2, 10],
      luna: [0.1, 0.5],
    });
  });
  it("Read 0,05× nur bei Sol 6.1 (cached $0,10 auf $2), sonst 0,1×; Write überall 1,25×", () => {
    expect(Object.fromEntries(MODELLE.map((m) => [m.key, m.read]))).toEqual({
      astra: undefined,
      sol61: 0.05,
      sol: undefined,
      luna: undefined,
    });
    expect(SOL.input * (SOL.read ?? READ_FAKTOR)).toBeCloseTo(0.1, 12);
    expect(Math.round(SOL.input * WRITE_FAKTOR * 100) / 100).toBe(2.5);
  });
});

describe("Faktoren aus dem Artificial-Analysis-Snapshot (aaData.CONFIGS)", () => {
  it("effortFaktor = USD/Task xhigh ÷ medium: Astra 1,50 · Sol 6.1 1,84 · Sol 6 2,11 · Luna 2,41", () => {
    const f = Object.fromEntries(
      MODELLE.map((m) => [m.key, Number(m.effortFaktor.toFixed(2))]),
    );
    expect(f).toEqual({ astra: 1.5, sol61: 1.84, sol: 2.11, luna: 2.41 });
  });
  it("Regler-Vorgabe ist auf eine Nachkommastelle gerundet", () => {
    expect(effortFaktorRegler("astra")).toBe(1.5);
    expect(effortFaktorRegler("sol61")).toBe(1.8);
    expect(effortFaktorRegler("sol")).toBe(2.1);
    expect(effortFaktorRegler("luna")).toBe(2.4);
  });
  it("capFaktor = bester Index Opus 5.5 ÷ bester Index des Modells: 1,09 bis 1,51", () => {
    const c = Object.fromEntries(
      MODELLE.map((m) => [m.key, Number(m.capFaktor.toFixed(3))]),
    );
    expect(c).toEqual({ astra: 1.094, sol61: 1.112, sol: 1.21, luna: 1.511 });
    // Ein Index-Verhältnis ist kein Tokenverhältnis: der Faktor ist eine
    // Setzung, und alle Modelle liegen unter Opus 5.5.
    for (const m of MODELLE) {
      expect(m.capFaktor).toBeGreaterThan(1);
      expect(m.capFaktor).toBeLessThan(1.6);
    }
  });
});

describe("Allow-List für configuration_update (Codex 0.160)", () => {
  it("nur gpt-6-astra und gpt-6.1-sol tragen supports_reasoning_effort_updates", () => {
    // models.json, rust-v0.160.0: true bei diesen beiden, bei gpt-6-sol und
    // gpt-6-luna fehlt das Flag (Default false), gpt-5.6-* ausdrücklich false.
    expect([...CONFIG_UPDATE_SLUGS]).toEqual(["gpt-6-astra", "gpt-6.1-sol"]);
    expect(
      Object.fromEntries(MODELLE.map((m) => [m.key, m.cacheUpdate])),
    ).toEqual({ astra: true, sol61: true, sol: false, luna: false });
  });
  it("cacheBleibt braucht Schalter UND Allow-List", () => {
    for (const m of MODELLE) {
      expect(cacheBleibt({ modell: m.key, cacheErhalten: false })).toBe(false);
      expect(cacheBleibt({ modell: m.key, cacheErhalten: true })).toBe(
        m.cacheUpdate,
      );
    }
  });
  it("Schalter an bei Sol 6 und Luna: Codex ignoriert ihn, die Zahlen sind exakt die des ausgeschalteten Schalters", () => {
    for (const modell of ["sol", "luna"] as const) {
      const e: Eingaben = {
        ...DEFAULTS,
        modell,
        faktor: effortFaktorRegler(modell),
      };
      expect(szenarien({ ...e, cacheErhalten: true })).toEqual(
        szenarien({ ...e, cacheErhalten: false }),
      );
      const an = kostenGeraden({ ...e, cacheErhalten: true });
      const aus = kostenGeraden({ ...e, cacheErhalten: false });
      for (const x of [0, 5, 20]) {
        expect(an.effortWechsel(x)).toBe(aus.effortWechsel(x));
        expect(an.nurXhigh(x)).toBe(aus.nurXhigh(x));
      }
      expect(
        szenarien({ ...e, cacheErhalten: true }).bruchEinmal,
      ).toBeGreaterThan(0);
    }
  });
  it("Schalter an bei Astra und Sol 6.1: der Bruch entfällt", () => {
    for (const modell of ["astra", "sol61"] as const) {
      const e: Eingaben = {
        ...DEFAULTS,
        modell,
        faktor: effortFaktorRegler(modell),
        cacheErhalten: true,
      };
      expect(szenarien(e).bruchEinmal).toBe(0);
      expect(szenarien(e).breakEvenRead).toBe(0);
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
  it("Sol 6.1: 0,85 × 180k × 1,25 × $2 = 0,3825 $ (vor Fähigkeitsfaktor)", () => {
    expect(bruchKosten(SOL, DEFAULT_CTX)).toBeCloseTo(0.3825, 6);
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
    // +220k Out auf medium = c · 0,22 · $10 = 2,45 $; auf xhigh f-mal so viel.
    expect(e.nurMedium - basis.nurMedium).toBeCloseTo(c * 0.22 * 10, 10);
    expect(e.nurXhigh - basis.nurXhigh).toBeCloseTo(
      DEFAULTS.faktor * c * 0.22 * 10,
      10,
    );
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
    // Defaults: Break-even 3,46 MTok, am Rand liegt „Nur xhigh“ oben.
    const g3 = kostenGeraden(DEFAULTS);
    expect(g3.nurXhigh(20)).toBeGreaterThan(g3.effortWechsel(20));
  });
  it("„Nur xhigh“ startet ohne Bruch tiefer und steigt f-mal so steil", () => {
    const g = kostenGeraden(DEFAULTS);
    const erg = szenarien(DEFAULTS);
    expect(g.effortWechsel(0) - g.nurXhigh(0)).toBeCloseTo(erg.bruchEinmal, 10);
    const steigung = (fn: (x: number) => number) => fn(10) - fn(0);
    expect(steigung(g.nurXhigh) / steigung(g.effortWechsel)).toBeCloseTo(
      DEFAULTS.faktor,
      10,
    );
  });
});

describe("Sol 6.1, Regler-Defaults (Faktor 1,8 · 21 MTok · 2 Re-Plans)", () => {
  const e = szenarien(DEFAULTS);

  it("Szenarien: Nur medium 4,46 $ · Nur xhigh 8,02 $ · Effort-Wechsel 5,87 $", () => {
    expect(e.nurMedium).toBeCloseTo(4.4579, 3);
    expect(e.nurXhigh).toBeCloseTo(8.0242, 3);
    expect(e.effortWechsel).toBeCloseTo(5.8703, 3);
    expect(e.antiPattern).toBeCloseTo(7.6112, 3);
  });

  it("Ersparnis 2,15 $ = 1,89 € (−26,8 %) gegenüber durchgängig xhigh", () => {
    expect(e.ersparnis).toBeCloseTo(2.1539, 3);
    expect(toEur(e.ersparnis)).toBeCloseTo(1.89, 2);
    expect(e.ersparnisProzent).toBeCloseTo(26.84, 2);
  });

  it("der eine Bruch kostet 0,43 $, Break-even bei 3,46 MTok Exec-Read bzw. Faktor 1,132", () => {
    expect(e.bruchEinmal).toBeCloseTo(0.4252, 4);
    expect(e.proMtokErsparnis).toBeCloseTo(0.1228, 4);
    expect(e.breakEvenRead).toBeCloseTo(3.462, 3);
    expect(e.breakEvenFaktor).toBeCloseTo(1.1319, 4);
  });

  it("Rückkehr ohne /compact: 2 Brüche 0,85 $ + neuer Plan auf xhigh 0,02 $ = 0,87 $", () => {
    expect(e.rueckkehrBrueche).toBeCloseTo(0.8504, 4);
    expect(e.rueckkehrGesamt).toBeCloseTo(0.8705, 4);
  });

  it("Balken über „Nur xhigh“ ab 3 Rückkehren, allein die Brüche ebenfalls ab 3", () => {
    expect(e.balkenUeberAb).toBe(3);
    expect(e.ersparnisWegAb).toBe(3);
    const bei2 = szenarien({ ...DEFAULTS, replans: 2 });
    const bei3 = szenarien({ ...DEFAULTS, replans: 3 });
    expect(bei2.antiPattern).toBeLessThan(bei2.nurXhigh);
    expect(bei3.antiPattern).toBeGreaterThan(bei3.nurXhigh);
  });

  it("Vergleichsmaßstab opusplan (dessen Regler-Defaults): 1,25 € und −13,0 %", () => {
    expect(toEur(OPUSPLAN_REF.ersparnis)).toBeCloseTo(1.25, 2);
    expect(OPUSPLAN_REF.ersparnisProzent).toBeCloseTo(12.97, 1);
  });

  it("relativ größer als opusplan: −26,8 % gegen −13,0 %", () => {
    // Der Prozentwert ist preisneutral; die €-Beträge vergleichen zwei
    // verschieden teure Basen (Nur xhigh 7,03 € gegen Nur Opus 9,61 €).
    expect(e.ersparnisProzent).toBeGreaterThan(OPUSPLAN_REF.ersparnisProzent);
    expect(toEur(e.ersparnis)).toBeGreaterThan(toEur(OPUSPLAN_REF.ersparnis));
  });
});

describe("Schalter „Cache erhalten“ (configuration_update, Sol 6.1 auf der Allow-List)", () => {
  const an = szenarien({ ...DEFAULTS, cacheErhalten: true });
  const aus = szenarien(DEFAULTS);

  it("setzt Bruch und Break-even auf 0 und hebt die Ersparnis genau um den Bruch", () => {
    expect(an.bruchEinmal).toBe(0);
    expect(an.breakEvenRead).toBe(0);
    expect(an.breakEvenFaktor).toBe(1);
    expect(an.rueckkehrBrueche).toBe(0);
    expect(an.ersparnis - aus.ersparnis).toBeCloseTo(aus.bruchEinmal, 10);
  });

  it("Rückkehren kosten nur den neuen Plan: Balken strikt drüber erst ab 129", () => {
    expect(an.rueckkehrGesamt).toBeCloseTo(0.02, 4);
    expect(an.ersparnisWegAb).toBe(Infinity);
    // Mit dem gemessenen Re-Plan-Output von 1k Tokens ist eine Rückkehr fast
    // gratis: 2,58 $ Ersparnis / 0,0200 $ = 128,9. Bei 128 liegt der Balken
    // noch darunter, erst 129 STRIKT darüber.
    expect(an.ersparnis / an.rueckkehrGesamt).toBeCloseTo(128.89, 2);
    const bei128 = szenarien({
      ...DEFAULTS,
      cacheErhalten: true,
      replans: 128,
    });
    const bei129 = szenarien({
      ...DEFAULTS,
      cacheErhalten: true,
      replans: 129,
    });
    expect(bei128.antiPattern).toBeLessThan(bei128.nurXhigh);
    expect(bei129.antiPattern).toBeGreaterThan(bei129.nurXhigh);
    expect(an.balkenUeberAb).toBe(129);
  });
});

describe("Modellwahl ändert die Zahlen", () => {
  const bei = (modell: ModellKey) =>
    szenarien({ ...DEFAULTS, modell, faktor: effortFaktorRegler(modell) });

  it("Ersparnis in €: Astra 10,15 · Sol 6.1 1,89 · Sol 6 5,42 · Luna 0,44", () => {
    expect(toEur(bei("astra").ersparnis)).toBeCloseTo(10.15, 1);
    expect(toEur(bei("sol61").ersparnis)).toBeCloseTo(1.89, 1);
    expect(toEur(bei("sol").ersparnis)).toBeCloseTo(5.42, 1);
    expect(toEur(bei("luna").ersparnis)).toBeCloseTo(0.44, 1);
  });

  it("in Prozent: Astra −22 · Sol 6.1 −27 · Sol 6 −37 · Luna −42 — alle vier über opusplans −13", () => {
    expect(bei("astra").ersparnisProzent).toBeCloseTo(21.7, 1);
    expect(bei("sol61").ersparnisProzent).toBeCloseTo(26.8, 1);
    expect(bei("sol").ersparnisProzent).toBeCloseTo(37.4, 1);
    expect(bei("luna").ersparnisProzent).toBeCloseTo(42.3, 1);
    for (const k of ["astra", "sol61", "sol", "luna"] as const)
      expect(bei(k).ersparnisProzent).toBeGreaterThan(
        OPUSPLAN_REF.ersparnisProzent,
      );
  });

  it("in Euro (verschiedene Basen!): nur Luna spart weniger als opusplans 1,25 € — ihre Basis „Nur xhigh“ kostet 1,04 €", () => {
    for (const k of ["astra", "sol61", "sol"] as const)
      expect(toEur(bei(k).ersparnis)).toBeGreaterThan(
        toEur(OPUSPLAN_REF.ersparnis),
      );
    expect(toEur(bei("luna").ersparnis)).toBeLessThan(
      toEur(OPUSPLAN_REF.ersparnis),
    );
    expect(toEur(bei("luna").nurXhigh)).toBeCloseTo(1.04, 2);
  });

  it("Astra: teuerster Bruch (2,09 $), Break-even 3,21 MTok, Balken drüber ab 3", () => {
    const a = bei("astra");
    expect(a.bruchEinmal).toBeCloseTo(2.0922, 4);
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

  it("Sweep: über alle Modelle und Regler-Ecken (Faktor ≥ 2) spart der Wechsel ab 5 MTok Exec-Read immer", () => {
    // Bei Faktor 1,5 gilt das nicht mehr für Sol 6.1: Read 0,05× macht jedes
    // MTok billiger, der Write (und damit der Bruch) bleibt bei $2,50 — Break-
    // even dort 5,5 MTok (Astra, Sol 6 und Luna: 3,2).
    for (const m of MODELLE)
      for (const faktor of [2, 4, 8])
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
