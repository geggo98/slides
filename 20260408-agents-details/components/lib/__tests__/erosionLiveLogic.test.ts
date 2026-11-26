// Hält den Live-Nachbau der Erosions-Kette (`erosionLiveLogic.ts`) an der Spezifikation
// aus `data/erosion/study9-chain.json` und prüft den Ablauf ohne Netz und ohne Uhr.
//
// Woher die Erwartungswerte stammen:
// - Prompts: von Hand aus dem Text von `spec.round.userTemplate` und
//   `spec.test.userTemplate` zusammengesetzt; nur die Anweisungstexte der Arme
//   werden aus der JSON gelesen (dort stehen sie, nicht im Code).
// - Parser: Beispielantworten von Hand, die Erwartung ebenso.
// - Kosten: 1,1830 $ aus `notes.cost` geteilt durch 64 Ketten (4 Arme mal 16),
//   von Hand gerechnet.
import { describe, expect, it } from "vitest";
import chain from "../../../data/erosion/study9-chain.json";
import live from "../../../data/erosion/study9-live.json";
import { RETRY_BASE_MS } from "../contextRotLive";
import {
  drawPieces,
  estimateChainCost,
  parseRewrite,
  parseRewriteResponse,
  presentBehaviours,
  rewriteBody,
  roundPrompt,
  runChain,
  testBody,
  testPrompt,
  type Corpus,
  type RoundEvent,
} from "../erosionLiveLogic";

const spec = chain.spec;
const corpus = live.corpus as unknown as Corpus;
const ORIGINAL = spec.original.map((r) => r.text);
const PREFIX = spec.testablePrefixes as Record<string, string>;

describe("roundPrompt", () => {
  const items = ["Rule one.", "Rule two."];
  const pieces = ["P0", "P1", "P2"];
  const block = (p: string) =>
    `[reference material]\n${p}\n[end of reference material]`;

  it("setzt Anweisung, Regeln und n + 1 Stücke nach der Vorlage zusammen", () => {
    const expected =
      `# Task\n${spec.arms.F.instruction}\n\n# Rules with reference material\n\n` +
      `${block("P0")}\n\n1. Rule one.\n\n${block("P1")}\n\n2. Rule two.\n\n${block("P2")}\n\n# Your answer\n`;
    expect(roundPrompt("F", items, pieces)).toBe(expected);
  });

  it("nimmt je Arm dessen Anweisung", () => {
    for (const arm of ["F", "C", "D", "N"] as const) {
      expect(roundPrompt(arm, items, pieces)).toContain(
        `# Task\n${spec.arms[arm].instruction}\n\n`,
      );
    }
    expect(roundPrompt("C", items, pieces)).not.toBe(
      roundPrompt("F", items, pieces),
    );
  });

  it("nummeriert im Arm D als R01, R02", () => {
    const out = roundPrompt("D", items, pieces);
    expect(out).toContain("\n\nR01: Rule one.\n\n");
    expect(out).toContain("\n\nR02: Rule two.\n\n");
    expect(out).not.toContain("1. Rule one.");
  });

  it("schreibt im Arm D auch die zehnte Regel als R10", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `r${i}`);
    const out = roundPrompt(
      "D",
      ten,
      Array.from({ length: 11 }, (_, i) => `p${i}`),
    );
    expect(out).toContain("\n\nR10: r9\n\n");
  });

  it("verlangt genau n + 1 Stücke", () => {
    expect(() => roundPrompt("F", items, ["P0", "P1"])).toThrow(/3 Stücke/);
    expect(() => roundPrompt("F", items, [...pieces, "P3"])).toThrow(
      /3 Stücke/,
    );
  });

  it("liest `$&` im Fülltext wörtlich", () => {
    expect(roundPrompt("F", ["a"], ["x $& y", "z"])).toContain("x $& y");
  });
});

describe("testPrompt", () => {
  it("setzt Regeln und Code nach der Vorlage zusammen, der Zaun bleibt offen", () => {
    const expected =
      `# Task\n${spec.test.TASK_RULES}\n\n# Rules\n1. Rule one.\n2. Rule two.\n\n` +
      "# Source file\n```java\nint x = ";
    expect(testPrompt(["Rule one.", "Rule two."], "int x = ")).toBe(expected);
  });

  it("schreibt bei leerer Liste (no rules)", () => {
    expect(testPrompt([], "p")).toBe(
      `# Task\n${spec.test.TASK_RULES}\n\n# Rules\n(no rules)\n\n# Source file\n\`\`\`java\np`,
    );
  });

  it("liest `$&` im Code wörtlich", () => {
    expect(testPrompt(["a"], "x = $& + $1")).toMatch(
      /\n```java\nx = \$& \+ \$1$/,
    );
  });
});

describe("Request-Bodies", () => {
  const opts = { flex: false };
  it("Umschreiben (OpenAI): Seed 1000 + Runde, 1500 Tokens, Reasoning none", () => {
    expect(rewriteBody("openai", "m", "U", 3, opts)).toEqual({
      model: "m",
      messages: [
        { role: "system", content: spec.round.systemPrompt },
        { role: "user", content: "U" },
      ],
      max_completion_tokens: 1500,
      seed: 1003,
      reasoning_effort: "none",
    });
  });
  it("Flex setzt service_tier", () => {
    expect(rewriteBody("openai", "m", "U", 1, { flex: true })).toMatchObject({
      service_tier: "flex",
      seed: 1001,
    });
    expect(testBody("openai", "m", "U", { flex: true })).toMatchObject({
      service_tier: "flex",
    });
    expect(rewriteBody("openai", "m", "U", 1, opts)).not.toHaveProperty(
      "service_tier",
    );
  });
  it("Test (OpenAI): 4 Tokens, Logprobs, Top 5, Seed 1000", () => {
    expect(testBody("openai", "m", "U", opts)).toEqual({
      model: "m",
      messages: [
        { role: "system", content: spec.test.systemPrompt },
        { role: "user", content: "U" },
      ],
      logprobs: true,
      top_logprobs: 5,
      max_completion_tokens: 4,
      seed: 1000,
      reasoning_effort: "none",
    });
  });
  it("OpenRouter: max_tokens statt max_completion_tokens, kein Seed", () => {
    const r = rewriteBody("openrouter", "o/m", "U", 2, opts);
    expect(r).toMatchObject({
      max_tokens: 1500,
      reasoning: { enabled: false },
    });
    expect(r).not.toHaveProperty("seed");
    expect(r).not.toHaveProperty("max_completion_tokens");
    expect(testBody("openrouter", "o/m", "U", opts)).toMatchObject({
      max_tokens: 4,
      logprobs: true,
      top_logprobs: 5,
    });
  });
});

describe("parseRewrite, Arme F, C und N", () => {
  const prev = ["old one", "old two"];
  for (const arm of ["F", "C", "N"] as const) {
    it(`${arm}: liest die nummerierte Liste`, () => {
      expect(parseRewrite(arm, "1. A\n2. B\n3. C", prev)).toEqual({
        items: ["A", "B", "C"],
        ok: true,
        note: "",
      });
    });
  }
  it("liest auch `1)` und überspringt Text vor der Liste", () => {
    const r = parseRewrite("F", "Here is the list:\n\n1) A\n2) B", prev);
    expect(r.items).toEqual(["A", "B"]);
    expect(r.ok).toBe(true);
  });
  it("hängt umgebrochene Zeilen an die vorige Regel", () => {
    const r = parseRewrite("F", "1. A starts\n   and continues\n2. B", prev);
    expect(r.items).toEqual(["A starts and continues", "B"]);
  });
  it("entfernt einen Code-Zaun um die Liste", () => {
    const r = parseRewrite("F", "```\n1. A\n2. B\n```", prev);
    expect(r.items).toEqual(["A", "B"]);
  });
  it("behält bei leerer Antwort die vorige Liste", () => {
    for (const raw of ["", "  \n "]) {
      const r = parseRewrite("F", raw, prev);
      expect(r).toEqual({ items: prev, ok: false, note: "leere Antwort" });
    }
  });
  it("behält bei Antwort ohne Nummern die vorige Liste", () => {
    const r = parseRewrite("C", "I cannot do that.", prev);
    expect(r.items).toEqual(prev);
    expect(r.ok).toBe(false);
    expect(r.note).toContain("keine nummerierte Liste");
  });
  it("gibt eine Kopie der vorigen Liste zurück, nicht dieselbe", () => {
    const r = parseRewrite("F", "", prev);
    expect(r.items).not.toBe(prev);
  });
});

describe("parseRewrite, Arm D", () => {
  const prev = ["a", "b", "c"];
  it("wendet reword, remove und add an", () => {
    const raw = '{"remove":["R02"],"reword":{"R01":"A2"},"add":["d"]}';
    expect(parseRewrite("D", raw, prev)).toEqual({
      items: ["A2", "c", "d"],
      ok: true,
      note: "",
    });
  });
  it("nummeriert nach der Liste vor der Änderung, nicht fortlaufend nach dem Entfernen", () => {
    const raw = '{"remove":["R01"],"reword":{"R03":"C2"}}';
    expect(parseRewrite("D", raw, prev).items).toEqual(["b", "C2"]);
  });
  it("liest JSON mit Text drumherum", () => {
    const raw = 'Sure! {"remove":["R03"]} Hope that helps.';
    expect(parseRewrite("D", raw, prev)).toMatchObject({
      items: ["a", "b"],
      ok: true,
    });
  });
  it("liest JSON im Code-Zaun", () => {
    const raw = '```json\n{"add":["x"]}\n```';
    expect(parseRewrite("D", raw, prev).items).toEqual(["a", "b", "c", "x"]);
  });
  it("ignoriert unbekannte Nummern und nennt sie", () => {
    const raw = '{"remove":["R99"],"reword":{"R77":"z","R01":"A2"}}';
    const r = parseRewrite("D", raw, prev);
    expect(r.items).toEqual(["A2", "b", "c"]);
    expect(r.ok).toBe(true);
    expect(r.note).toContain("R99");
    expect(r.note).toContain("R77");
  });
  it("ignoriert Einträge mit falschem Typ", () => {
    const raw = '{"remove":[3,"R02"],"reword":{"R01":5},"add":["x",null,""]}';
    expect(parseRewrite("D", raw, prev).items).toEqual(["a", "c", "x"]);
  });
  it("behält die Liste bei leerer Antwort", () => {
    expect(parseRewrite("D", "", prev)).toEqual({
      items: prev,
      ok: false,
      note: "leere Antwort",
    });
  });
  it("behält die Liste, wenn kein JSON da ist", () => {
    const r = parseRewrite("D", "I removed the second rule.", prev);
    expect(r.items).toEqual(prev);
    expect(r.ok).toBe(false);
    expect(r.note).toContain("kein JSON-Objekt");
  });
  it("behält die Liste bei kaputtem JSON", () => {
    const r = parseRewrite("D", '{"remove": ["R01"', prev);
    expect(r.ok).toBe(false);
    expect(r.items).toEqual(prev);
    const r2 = parseRewrite("D", '{"remove": ["R01",]}', prev);
    expect(r2.ok).toBe(false);
    expect(r2.note).toContain("nicht lesbar");
  });
  it("behält die Liste, wenn das Objekt keines der drei Felder hat", () => {
    for (const raw of ["{}", '{"foo":1}']) {
      const r = parseRewrite("D", raw, prev);
      expect(r.ok, raw).toBe(false);
      expect(r.items).toEqual(prev);
      expect(r.note).toContain("remove");
    }
  });
});

describe("drawPieces", () => {
  it("liefert n + 1 Stücke", () => {
    for (const n of [0, 1, 7, 20]) {
      expect(drawPieces(corpus, n, 5, 1)).toHaveLength(n + 1);
    }
  });
  it("ist bei gleichen Argumenten gleich", () => {
    expect(drawPieces(corpus, 20, 42, 3)).toEqual(
      drawPieces(corpus, 20, 42, 3),
    );
  });
  it("zieht je Runde und je Kette neu", () => {
    const a = drawPieces(corpus, 20, 42, 1);
    expect(drawPieces(corpus, 20, 42, 2)).not.toEqual(a);
    expect(drawPieces(corpus, 20, 43, 1)).not.toEqual(a);
  });
  it("wechselt die Art ab: je drei aufeinanderfolgende Stücke tragen alle drei Arten", () => {
    const kinds = new Map(corpus.pieces.map((p) => [p.text, p.kind]));
    const drawn = drawPieces(corpus, 20, 9, 4).map((t) => kinds.get(t));
    for (let i = 0; i + 2 < drawn.length; i++) {
      expect(new Set(drawn.slice(i, i + 3)).size, `ab Stück ${i}`).toBe(3);
    }
  });
  it("wiederholt kein Stück, solange der Korpus reicht", () => {
    const d = drawPieces(corpus, 20, 11, 2);
    expect(new Set(d).size).toBe(d.length);
  });
  it("greift bei zu kleinem Korpus wieder auf Stücke zurück, statt zu scheitern", () => {
    const d = drawPieces(corpus, 40, 1, 1);
    expect(d).toHaveLength(41);
  });
  it("verändert den Korpus nicht", () => {
    const before = JSON.stringify(corpus);
    drawPieces(corpus, 20, 1, 1);
    expect(JSON.stringify(corpus)).toBe(before);
  });
  it("nennt eine fehlende Art", () => {
    const only = { pieces: corpus.pieces.filter((p) => p.kind !== "math") };
    expect(() => drawPieces(only, 3, 1, 1)).toThrow(/math/);
  });
});

describe("Korpus-Datei", () => {
  it("hat mindestens 8 Stücke je Art, Herkunft und Kennzeichnung", () => {
    for (const k of ["prose", "math", "java"]) {
      expect(
        corpus.pieces.filter((p) => p.kind === k).length,
      ).toBeGreaterThanOrEqual(8);
    }
    expect(live.source).toBe("Nachbau ohne Originalcode");
    expect(live.provenance.length).toBeGreaterThan(20);
    expect(new Set(corpus.pieces.map((p) => p.id)).size).toBe(
      corpus.pieces.length,
    );
  });
});

describe("presentBehaviours", () => {
  it("findet alle vier Gebote in der Originalliste", () => {
    expect(presentBehaviours(ORIGINAL)).toEqual({
      A: true,
      B: true,
      C: true,
      D: true,
    });
  });
  it("findet kein Gebot in einer leeren Liste", () => {
    expect(presentBehaviours([])).toEqual({
      A: false,
      B: false,
      C: false,
      D: false,
    });
  });
  it("verlangt Token und Auslöser in derselben Regel", () => {
    const r = presentBehaviours([
      "Use the keyword this when it helps.",
      "Always return early.",
    ]);
    expect(r.A).toBe(false);
    expect(presentBehaviours(["Start with this after return."]).A).toBe(true);
  });
});

describe("estimateChainCost", () => {
  it("teilt die Kosten der Studie auf 64 Ketten", () => {
    const e = estimateChainCost({ flex: true });
    expect(e.usd).toBeCloseTo(1.183 / 64, 6);
    expect(e.basis).toMatch(/Schätzung/);
  });
  it("verdoppelt den Preis ohne Flex", () => {
    expect(estimateChainCost({ flex: false }).usd).toBeCloseTo(
      (2 * 1.183) / 64,
      6,
    );
  });
});

describe("parseRewriteResponse", () => {
  const ok = (content: string, finish = "stop") =>
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finish }],
    });
  it("liest den Antworttext", () => {
    expect(parseRewriteResponse(200, ok("1. A"))).toMatchObject({
      text: "1. A",
    });
  });
  it("meldet 401 als fatal und schwärzt den Key", () => {
    const r = parseRewriteResponse(
      401,
      '{"error":{"message":"Incorrect API key provided: sk-proj-abc***xyz."}}',
    );
    expect(r.fatal).toBe(true);
    expect(r.error).not.toContain("sk-proj");
    expect(r.error).toContain("sk-…");
    expect(r.text).toBeUndefined();
  });
  it("meldet 429 und 503 als wiederholbar", () => {
    expect(parseRewriteResponse(429, "{}").retry).toBe(true);
    expect(parseRewriteResponse(503, "oops").retry).toBe(true);
    expect(parseRewriteResponse(429, "{}").fatal).toBeFalsy();
  });
  it("meldet eine Antwort ohne Text als Fehler", () => {
    const r = parseRewriteResponse(200, '{"choices":[]}');
    expect(r.error).toBeTruthy();
    expect(r.text).toBeUndefined();
  });
  it("liefert bei leerem Text einen leeren String, keinen Fehler", () => {
    expect(parseRewriteResponse(200, ok(""))).toMatchObject({ text: "" });
  });
});

// --- Ablauf der Kette -------------------------------------------------------

const SITE_OF_PREFIX = new Map(
  Object.entries(PREFIX).map(([id, p]) => [p, id]),
);
const TOKEN_OF = new Map(
  spec.behaviours.flatMap((b) => b.sites.map((s) => [s, b.token] as const)),
);

function testReply(token: string): string {
  return JSON.stringify({
    model: "fake",
    usage: { prompt_tokens: 1, completion_tokens: 1 },
    choices: [
      {
        logprobs: {
          content: [
            {
              top_logprobs: [
                { token, logprob: -0.1 },
                { token: "zzz", logprob: -3 },
              ],
            },
          ],
        },
      },
    ],
  });
}
const rewriteReply = (content: string) =>
  JSON.stringify({
    choices: [{ message: { content }, finish_reason: "stop" }],
  });

const D_ONLY =
  "1. If the cursor is directly after the keyword `new`, start your continuation with the modifier static.";

interface Call {
  body: Record<string, unknown>;
}

/** Antwortet auf Tests mit dem Token der Stelle, falls die Liste eine Regel für genau dieses Token enthält. */
function harness(
  rewrite: (
    call: number,
    body: Call["body"],
  ) => { status: number; text: string } | "abort",
  opts: { testStatus?: number; failSite?: string } = {},
) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const ac = new AbortController();
  let rewrites = 0;
  const send = async (body: Record<string, unknown>) => {
    calls.push({ body });
    const user = (body.messages as { content: string }[])[1]!.content;
    if (body.max_completion_tokens === 4) {
      if (opts.testStatus)
        return {
          status: opts.testStatus,
          text: '{"error":{"message":"nope"}}',
        };
      const rules = user.split("# Source file")[0]!;
      const prefix = user.split("```java\n")[1]!;
      const site = SITE_OF_PREFIX.get(prefix)!;
      if (site === opts.failSite) return { status: 500, text: "boom" };
      const obey =
        rules.includes(
          `start your continuation with the keyword ${TOKEN_OF.get(site)}`,
        ) ||
        rules.includes(
          `start your continuation with the modifier ${TOKEN_OF.get(site)}`,
        );
      return {
        status: 200,
        text: testReply(obey ? TOKEN_OF.get(site)! : "other"),
      };
    }
    const r = rewrite(++rewrites, body);
    if (r === "abort") {
      ac.abort();
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
    return r;
  };
  const sleep = async (ms: number) => {
    sleeps.push(ms);
  };
  const events: RoundEvent[] = [];
  const run = (extra: Record<string, unknown> = {}) =>
    runChain({
      provider: "openai",
      model: "fake-model",
      arm: "F",
      flex: false,
      rounds: 2,
      seed: 7,
      corpus,
      send,
      sleep,
      signal: ac.signal,
      onRound: (e: RoundEvent) => events.push(e),
      ...extra,
    });
  return { calls, sleeps, events, run, ac };
}

describe("runChain", () => {
  it("testet O, dann je Runde umschreiben und die vier Stellen testen", async () => {
    const h = harness(() => ({ status: 200, text: rewriteReply(D_ONLY) }));
    const sum = await h.run();
    expect(sum).toMatchObject({ rounds: 2, stopped: false });
    expect(h.events.map((e) => e.round)).toEqual([0, 1, 2]);

    const r0 = h.events[0]!;
    expect(r0.items).toEqual(ORIGINAL);
    expect(r0.parse).toBeNull();
    expect(r0.tests.map((t) => t.site)).toEqual([
      "c025",
      "c066",
      "c124",
      "c141",
    ]);
    expect(r0.tests.map((t) => t.token)).toEqual([
      "static",
      "final",
      "final",
      "final",
    ]);
    expect(r0.presentCount).toBe(4);
    expect(r0.obeyedCount).toBe(4);

    const r1 = h.events[1]!;
    expect(r1.items).toEqual([D_ONLY.slice(3)]);
    expect(r1.parse).toMatchObject({ ok: true });
    expect(r1.present).toEqual({ A: false, B: false, C: false, D: true });
    expect(r1.presentCount).toBe(1);
    expect(r1.obeyedCount).toBe(1);
    // 12 Tests + 2 Umschreibungen
    expect(h.calls).toHaveLength(14);
  });

  it("schickt Seed 1000 + Runde und einen Prompt aus n + 1 Stücken", async () => {
    const h = harness(() => ({ status: 200, text: rewriteReply(D_ONLY) }));
    await h.run();
    const rewrites = h.calls.filter(
      (c) => c.body.max_completion_tokens === 1500,
    );
    expect(rewrites.map((c) => c.body.seed)).toEqual([1001, 1002]);
    const prompt = (rewrites[0]!.body.messages as { content: string }[])[1]!
      .content;
    expect(prompt.split("[reference material]\n").length - 1).toBe(
      ORIGINAL.length + 1,
    );
    const second = (rewrites[1]!.body.messages as { content: string }[])[1]!
      .content;
    expect(second.split("[reference material]\n").length - 1).toBe(2);
  });

  it("behält bei unlesbarer Antwort die Liste und meldet parse.ok = false", async () => {
    const h = harness(() => ({ status: 200, text: rewriteReply("no list") }));
    await h.run({ rounds: 1 });
    const r1 = h.events[1]!;
    expect(r1.items).toEqual(ORIGINAL);
    expect(r1.parse?.ok).toBe(false);
  });

  it("wiederholt bei 429 mit wachsender Pause", async () => {
    const h = harness((n) =>
      n < 3
        ? { status: 429, text: '{"error":{"message":"slow"}}' }
        : { status: 200, text: rewriteReply(D_ONLY) },
    );
    const sum = await h.run({ rounds: 1 });
    expect(sum).toMatchObject({ rounds: 1, stopped: false });
    expect(h.sleeps).toEqual([RETRY_BASE_MS, RETRY_BASE_MS * 2]);
    expect(h.events.map((e) => e.round)).toEqual([0, 1]);
  });

  it("gibt nach drei Fehlversuchen auf und meldet den Fehler", async () => {
    const h = harness(() => ({ status: 503, text: "down" }));
    const sum = (await h.run({ rounds: 2 })) as {
      stopped: boolean;
      error?: string;
    };
    expect(sum.stopped).toBe(true);
    expect(sum.error).toContain("503");
    expect(h.events.map((e) => e.round)).toEqual([0]);
    expect(
      h.calls.filter((c) => c.body.max_completion_tokens === 1500),
    ).toHaveLength(3);
  });

  it("stoppt bei einem fatalen Fehler ohne Wiederholung und ohne den Key zu zeigen", async () => {
    const h = harness(() => ({
      status: 401,
      text: '{"error":{"message":"Incorrect API key provided: sk-proj-abc***xyz."}}',
    }));
    const sum = (await h.run()) as { stopped: boolean; error?: string };
    expect(sum.stopped).toBe(true);
    expect(sum.error).not.toContain("sk-proj");
    expect(h.sleeps).toEqual([]);
    expect(
      h.calls.filter((c) => c.body.max_completion_tokens === 1500),
    ).toHaveLength(1);
    expect(h.events.map((e) => e.round)).toEqual([0]);
  });

  it("stoppt bei fatalem Fehler im Test, ohne die Runde zu melden", async () => {
    const h = harness(() => ({ status: 200, text: rewriteReply(D_ONLY) }), {
      testStatus: 401,
    });
    const sum = (await h.run()) as { stopped: boolean; error?: string };
    expect(sum.stopped).toBe(true);
    expect(sum.error).toBeTruthy();
    expect(h.events).toEqual([]);
    expect(h.calls.some((c) => c.body.max_completion_tokens === 1500)).toBe(
      false,
    );
  });

  it("bricht ab, ohne die angefangene Runde zu melden", async () => {
    const h = harness((n) =>
      n === 1 ? "abort" : { status: 200, text: rewriteReply(D_ONLY) },
    );
    const sum = (await h.run()) as { stopped: boolean; error?: string };
    expect(sum.stopped).toBe(true);
    expect(sum.error).toBeUndefined();
    expect(h.events.map((e) => e.round)).toEqual([0]);
  });

  it("startet nicht, wenn schon abgebrochen ist", async () => {
    const h = harness(() => ({ status: 200, text: rewriteReply(D_ONLY) }));
    h.ac.abort();
    const sum = (await h.run()) as { stopped: boolean };
    expect(sum.stopped).toBe(true);
    expect(h.events).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it("zählt eine Stelle ohne Messwert nicht als befolgt und läuft weiter", async () => {
    const h = harness(() => ({ status: 200, text: rewriteReply(D_ONLY) }), {
      failSite: "c066",
    });
    const sum = (await h.run({ rounds: 1 })) as { stopped: boolean };
    expect(sum.stopped).toBe(false);
    expect(h.events.map((e) => e.round)).toEqual([0, 1]);
    const r0 = h.events[0]!;
    expect(r0.tests.find((t) => t.site === "c066")!.result.error).toContain(
      "500",
    );
    expect(r0.obeyedCount).toBe(3);
  });
});
