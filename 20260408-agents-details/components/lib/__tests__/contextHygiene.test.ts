// Hält die Folie „Kontext-Hygiene“ an den Daten von Studie 3: die portierte
// Metrik muss an allen gespeicherten Messstellen dieselben Werte ergeben wie
// die Auswertung der Studie, die Kommentare müssen sich auf S0 abbilden lassen,
// und die Stufenfarben müssen auch bei Farbsehschwäche trennbar bleiben.
import { describe, expect, it } from "vitest";
import study from "../../../data/contexthygiene/study3.json";
import {
  BUCKETS,
  LADDERS,
  MODELS,
  SCENARIO_ORDER,
  buildBody,
  commentZones,
  measuredComments,
  commentedOffset,
  commentProse,
  insertComments,
  formatPercent,
  isHit,
  keyType,
  measure,
  pBucket,
  type Study3,
} from "../contextHygiene";
import {
  contrastRatio,
  deltaE,
  parseHex,
  simulate,
  type CvdType,
} from "../../../../shared/quiz/lib/__tests__/_colorMath";

const data = study as unknown as Study3;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*\/|\*)/;

describe("Metrik gegen die gespeicherten Messwerte", () => {
  const checks: {
    where: string;
    got: number | null;
    want: number | null;
    hit: boolean;
    wantHit: boolean;
  }[] = [];
  for (const [name, sc] of Object.entries(data.scenarios)) {
    for (const [level, lv] of Object.entries(sc.levels)) {
      for (const s of lv.sites) {
        for (const m of MODELS) {
          const r = s.m[m];
          const got = measure(r.top, s.gold, data.p_max);
          checks.push({
            where: `${name}/${level}/${s.id}/${m}`,
            got: got.p1,
            want: r.p1,
            hit: got.hit,
            wantHit: r.hit,
          });
        }
      }
    }
  }

  it("sieht alle 2160 Stellen (6 Gebiete × 12 Stufen × 10 Stellen × 3 Modelle)", () => {
    expect(checks.length).toBe(2160);
  });

  it("p1 stimmt überall (Toleranz 1e-4: die Studie rundet die Logprobs der Anzeige auf 5 Stellen, gemessen max. 1,4e-5)", () => {
    const bad = checks.filter(
      (c) =>
        (c.got == null) !== (c.want == null) ||
        (c.got != null && c.want != null && Math.abs(c.got - c.want) > 1e-4),
    );
    expect(bad.map((c) => c.where)).toEqual([]);
  });

  it("Treffer stimmt überall", () => {
    expect(
      checks.filter((c) => c.hit !== c.wantHit).map((c) => c.where),
    ).toEqual([]);
  });

  it("isHit: Präfix und Wortgrenze", () => {
    expect(isHit("amount", "amount")).toBe(true);
    expect(isHit(" Amount", "amount")).toBe(true);
    expect(isHit("amounts", "amount")).toBe(false);
    expect(isHit("amount(", "amount")).toBe(true);
    expect(isHit("  ", "amount")).toBe(false);
  });
});

describe("Gebiete und Stufen", () => {
  it("zurückgehaltene Gebiete stehen zuerst, dev genau parking, payroll, warehouse", () => {
    expect(SCENARIO_ORDER.slice(0, 3)).toEqual([
      "ticketing",
      "rental",
      "expense",
    ]);
    expect([...SCENARIO_ORDER].sort()).toEqual(
      Object.keys(data.scenarios).sort(),
    );
    const dev = Object.entries(data.scenarios)
      .filter(([, s]) => s.dev)
      .map(([k]) => k)
      .sort();
    expect(dev).toEqual(["parking", "payroll", "warehouse"]);
  });

  it("jede Leiter-Stufe hat Code und 10 Stellen", () => {
    for (const sc of Object.values(data.scenarios)) {
      for (const level of [...LADDERS.dose, ...LADDERS.steps]) {
        expect(sc.levels[level]?.sites.length).toBe(10);
      }
    }
  });

  it("D0 und S0 sind derselbe Code, D1–D4 haben dieselbe Zeilenzahl", () => {
    for (const sc of Object.values(data.scenarios)) {
      const d0 = sc.levels["D0"]!.code;
      expect(sc.levels["S0"]!.code).toBe(d0);
      for (const level of LADDERS.dose) {
        expect(sc.levels[level]!.code.split("\n").length).toBe(
          d0.split("\n").length,
        );
      }
    }
  });
});

describe("Kommentare", () => {
  it("Studie-Kommentare nur für D0–D4 und S0, angezeigt werden sie auf jeder Stufe", () => {
    const sc = data.scenarios["warehouse"]!;
    for (const level of [...LADDERS.dose, "S0"]) {
      expect(measuredComments(sc, level), level).toBe(sc.comments);
    }
    for (const level of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
      expect(measuredComments(sc, level), level).toBeNull();
      expect(commentZones(sc, level), level).not.toBeNull();
    }
  });

  it("Kopfzeile steht ganz oben und fachlich sinnvoll auf jeder Stufe", () => {
    for (const [name, sc] of Object.entries(data.scenarios)) {
      expect(sc.header, name).toBeTruthy();
      for (const level of [...LADDERS.dose, ...LADDERS.steps]) {
        const zones = commentZones(sc, level)!;
        expect(zones[0]!.beforeLine, `${name}/${level}`).toBe(0);
        expect(commentProse(zones[0]!).join(" "), name).toBe(sc.header);
      }
    }
  });

  it("S1–S6: eigene Kommentare, jeder in den Codezeilen, nie auf derselben Zeile", () => {
    for (const [name, sc] of Object.entries(data.scenarios)) {
      for (const level of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
        const lv = sc.levels[level]!;
        const lines = lv.code.split("\n").length;
        const blocks = lv.comments!;
        expect(blocks.length, `${name}/${level}`).toBeGreaterThanOrEqual(
          Math.ceil(sc.comments.length * 0.7),
        );
        const at = blocks.map((b) => b.beforeLine);
        expect(new Set(at).size, `${name}/${level}`).toBe(at.length);
        for (const b of blocks) {
          expect(b.beforeLine).toBeGreaterThanOrEqual(0);
          expect(b.beforeLine).toBeLessThan(lines);
          expect(b.lines.every((l) => COMMENT_LINE.test(l))).toBe(true);
        }
      }
    }
  });

  it("jeder Block liegt in den Codezeilen und besteht nur aus Kommentarzeilen", () => {
    for (const [name, sc] of Object.entries(data.scenarios)) {
      const lines = sc.levels["D0"]!.code.split("\n").length;
      expect(sc.comments.length, name).toBeGreaterThanOrEqual(10 / 3);
      for (const b of sc.comments) {
        expect(b.beforeLine, name).toBeGreaterThanOrEqual(0);
        expect(b.beforeLine, name).toBeLessThanOrEqual(lines);
        expect(
          b.lines.every((l) => COMMENT_LINE.test(l)),
          name,
        ).toBe(true);
      }
    }
  });

  it("der Code selbst enthält keine reine Kommentarzeile, die ein Block sein müsste", () => {
    // sonst würde die Kommentar-Rekonstruktion in build.ts S0 verfälschen
    for (const [name, sc] of Object.entries(data.scenarios)) {
      const bad = sc.levels["D0"]!.code.split("\n").filter((l) =>
        COMMENT_LINE.test(l),
      );
      expect(bad, name).toEqual([]);
    }
  });
});

describe("Kommentare im Prompt (Option „mitsenden“)", () => {
  const strip = (t: string) =>
    t
      .split("\n")
      .filter((l) => !COMMENT_LINE.test(l))
      .join("\n");

  it("insertComments ergibt ohne Kommentarzeilen wieder den Code", () => {
    for (const [name, sc] of Object.entries(data.scenarios)) {
      const code = sc.levels["D0"]!.code;
      expect(strip(insertComments(code, sc.comments)), name).toBe(code);
    }
  });

  it("commentedOffset: Präfix ohne Kommentarzeilen ist das Präfix des Codes", () => {
    let n = 0;
    for (const [name, sc] of Object.entries(data.scenarios)) {
      const lv = sc.levels["D0"]!;
      const text = insertComments(lv.code, sc.comments);
      for (const s of lv.sites) {
        const prefix = text.slice(
          0,
          commentedOffset(lv.code, sc.comments, s.pos),
        );
        expect(strip(prefix), `${name}/${s.id}`).toBe(lv.code.slice(0, s.pos));
        n += 1;
      }
    }
    expect(n).toBe(60);
  });

  it("commentProse entfernt Zeichen und leere Zeilen", () => {
    expect(
      commentProse({
        beforeLine: 0,
        lines: [
          "/**",
          " * A quantity.",
          " * Never negative.",
          " */",
          "// Rounds up.",
        ],
      }),
    ).toEqual(["A quantity.", "Never negative.", "Rounds up."]);
    expect(
      commentProse({ beforeLine: 0, lines: ["/** One line. */"] }),
    ).toEqual(["One line."]);
  });
});

describe("Färbung", () => {
  it("pBucket: Grenzen", () => {
    expect(pBucket(null)).toBe(-1);
    expect(pBucket(0.2)).toBe(0);
    expect(pBucket(0.5)).toBe(1);
    expect(pBucket(0.89)).toBe(1);
    expect(pBucket(0.9)).toBe(2);
    expect(pBucket(0.99)).toBe(3);
    expect(pBucket(0.999)).toBe(3);
  });

  it("unsichere Stufen tragen eine zweite Kodierung (Rand gestrichelt)", () => {
    expect(BUCKETS.slice(0, 2).every((b) => b.dashed)).toBe(true);
    expect(BUCKETS.slice(2).every((b) => !b.dashed)).toBe(true);
    expect(BUCKETS[0]!.sign).not.toBe("");
  });

  const CVD_MIN_DELTA_E = 14; // wie carbonTokens.test.ts
  const types: CvdType[] = ["normal", "protan", "deutan", "tritan"];
  for (const cvd of types) {
    it(`Stufen paarweise trennbar unter ${cvd} (ΔE > ${CVD_MIN_DELTA_E}, Nachbarn ausgenommen unter tritan)`, () => {
      for (let i = 0; i < BUCKETS.length; i++) {
        for (let j = i + 1; j < BUCKETS.length; j++) {
          // Unter Tritanopie fällt die Blau-Gelb-Achse zusammen. Dort tragen
          // Rand, Zeichen und Helligkeit die Unterscheidung (siehe Test oben).
          if (cvd === "tritan" && j - i === 1) continue;
          const dE = deltaE(
            simulate(parseHex(BUCKETS[i]!.bg), cvd),
            simulate(parseHex(BUCKETS[j]!.bg), cvd),
          );
          expect(
            dE,
            `${BUCKETS[i]!.label} vs ${BUCKETS[j]!.label}`,
          ).toBeGreaterThan(CVD_MIN_DELTA_E);
        }
      }
    });
  }

  it("Ziffernkontrast mindestens 4,5:1 auf jeder Stufe, auch simuliert", () => {
    for (const b of BUCKETS) {
      for (const cvd of types) {
        const cr = contrastRatio(
          simulate(parseHex(b.fg), cvd),
          simulate(parseHex(b.bg), cvd),
        );
        expect(cr, `${b.label} unter ${cvd}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("Darstellung und Live-Abfrage", () => {
  it("formatPercent mit Dezimalkomma", () => {
    expect(formatPercent(0.5)).toBe("50 %");
    expect(formatPercent(0.052)).toBe("5,2 %");
    expect(formatPercent(0.9995)).toBe(">99,9 %");
  });

  it("keyType erkennt OpenRouter vor OpenAI", () => {
    expect(keyType("")).toBeNull();
    expect(keyType("sk-or-abc")).toBe("openrouter");
    expect(keyType("sk-abc")).toBe("openai");
    expect(keyType("abc")).toBe("unknown");
  });

  it("buildBody entspricht der Studie (4 Token, Top-5, kein Reasoning)", () => {
    const o = buildBody("openai", "m", "sys", "code", {
      noReasoning: true,
      flex: false,
    });
    expect(o).toMatchObject({
      model: "m",
      logprobs: true,
      top_logprobs: 5,
      max_completion_tokens: 4,
      seed: 1,
      reasoning_effort: "none",
    });
    expect(o).not.toHaveProperty("service_tier");
    const r = buildBody("openrouter", "m", "sys", "code", {
      noReasoning: true,
      flex: true,
    });
    expect(r).toMatchObject({ max_tokens: 4, reasoning: { enabled: false } });
    expect(r).not.toHaveProperty("service_tier");
  });
});
