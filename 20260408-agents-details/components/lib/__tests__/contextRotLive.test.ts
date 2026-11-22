// Hält die Folie „Context Rot bei Luna“ an Studie 7: Die Kennzahlen müssen die
// Werte des Gesamtberichts ergeben, der Prompt-Bau den Body des Runners, und die
// Live-Abfrage muss Fehler, Wiederholung und Abbruch ohne Netz und ohne Uhr
// richtig behandeln.
//
// Woher die Erwartungswerte stammen:
// - Berichtswerte (−0,96, −1,44, −1,62, 17 von 36): Gesamtbericht der Studien,
//   Teil 1.2, Absatz „Studie 7“, hier von Hand eingetragen.
// - Lager-Werte: `aggregates.byModel.luna.warehouse` der JSON, die `build.ts`
//   aus den Rohdaten rechnet, nicht aus den Zellen, die `summarize` liest.
// - Beispiel-Body: `request.exampleBody`, wörtlich aus der Datenbank der Studie.
import { describe, expect, it } from "vitest";
import raw from "../../../data/contextrot/study7-luna.json";
import {
  DEFAULT_LUNA,
  LIVE_SEED,
  P_MAX,
  RETRY_BASE_MS,
  RULE_COUNTS,
  SCENARIOS,
  VARIANTS,
  codeSegments,
  conditionOf,
  errorHint,
  estimateCostUsd,
  formatDelta,
  formatNumber,
  formatUsd,
  isLeak,
  liveBody,
  measureTop,
  orderedSites,
  parseLive,
  parseRule,
  redactKeys,
  ruleLines,
  runJobs,
  series,
  sitePrefix,
  siteRows,
  summarize,
  summarizeLive,
  userPrompt,
  type ConditionName,
  type LiveJob,
  type LiveResult,
  type Study7,
} from "../contextRotLive";

const study = raw as unknown as Study7;
const CONDS: ConditionName[] = RULE_COUNTS.map(conditionOf);
const LEAKS = study.conditions["contra-1"]!.leaks;

describe("Bedingungen des Reglers", () => {
  it("bildet die Regelzahl auf die Bedingung der Studie ab", () => {
    expect(CONDS).toEqual(["none", "contra-1", "contra-3", "contra-10"]);
  });

  it("hat zu jeder Bedingung so viele Regelzeilen wie der Regler sagt", () => {
    for (const n of RULE_COUNTS) {
      const lines = ruleLines(study.conditions[conditionOf(n)]!.rules);
      expect(lines.length, `Regelzahl ${n}`).toBe(n);
    }
  });
});

describe("Kennzahlen gegen den Bericht", () => {
  it("liefert für Luna die Werte aus Gesamtbericht Teil 1.2", () => {
    const got = series(study, "luna").map((p) => [
      p.rules,
      Math.round(p.delta * 100) / 100,
    ]);
    expect(got).toEqual([
      [0, 0],
      [1, -0.96],
      [3, -1.44],
      [10, -1.62],
    ]);
  });

  it("liefert für Sol contra-1 −0,53 mit 17 von 36 fallenden Stellen", () => {
    const p = series(study, "sol")[1]!;
    expect(Math.round(p.delta * 100) / 100).toBe(-0.53);
    expect([p.falling, p.of]).toEqual([17, 36]);
  });

  it("hält Terra bei jeder Regelzahl unter 0,1 logit Abstand", () => {
    for (const p of series(study, "terra")) {
      expect(Math.abs(p.delta), `Terra, ${p.rules} Regeln`).toBeLessThan(0.1);
    }
  });

  it("gibt das Intervall des Berichts mit: Luna contra-1 von −1,80 bis −0,09", () => {
    const ci = series(study, "luna")[1]!.ci!;
    expect(ci.map((x) => Math.round(x * 100) / 100)).toEqual([-1.8, -0.09]);
  });

  it("wirft bei einem Modell ohne Gesamtwert, statt 0 zu zeichnen", () => {
    const broken = structuredClone(study);
    delete broken.aggregates.byModel.luna.all["contra-3"];
    expect(() => series(broken, "luna")).toThrow(/luna\/contra-3/);
  });
});

describe("Zeilen je Stelle", () => {
  it("rechnet für Lager dieselben Mittel wie build.ts aus den Rohdaten", () => {
    const seen: string[] = [];
    for (const variant of VARIANTS) {
      for (const cond of CONDS) {
        const got = summarize(siteRows(study, "warehouse", variant, cond));
        const want = study.aggregates.byModel.luna.warehouse[cond]![variant];
        const where = `warehouse/${variant}/${cond}`;
        expect(got.sites, where).toBe(want.n);
        expect(got.logit, `${where} logit`).toBeCloseTo(want.logit, 3);
        expect(got.delta, `${where} delta`).toBeCloseTo(want.delta ?? 0, 3);
        expect(got.leak, `${where} leak`).toBeCloseTo(want.leak, 3);
        seen.push(where);
      }
    }
    expect(seen.length).toBe(8);
  });

  it("ergibt mit Spesen zusammen den Gesamtwert des Berichts", () => {
    for (const variant of VARIANTS) {
      for (const cond of CONDS) {
        const parts = SCENARIOS.map((s) =>
          summarize(siteRows(study, s, variant, cond)),
        );
        const mean = (parts[0]!.delta + parts[1]!.delta) / 2;
        const want = study.aggregates.byModel.luna.all[cond]![variant];
        expect(mean, `${variant}/${cond}`).toBeCloseTo(want.delta ?? 0, 3);
      }
    }
  });

  it("zählt die Syntax-Stelle nicht mit und nummeriert in Lesereihenfolge", () => {
    const rows = siteRows(study, "warehouse", "D0", "contra-1");
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rows.filter((r) => !r.semantic).map((r) => r.site.id)).toEqual([
      "c077",
    ]);
    expect(summarize(rows).sites).toBe(9);
  });

  it("zählt fallende Stellen: Lager contra-1 hat 14 von 18", () => {
    const falling = VARIANTS.reduce(
      (n, v) =>
        n + summarize(siteRows(study, "warehouse", v, "contra-1")).falling,
      0,
    );
    expect(falling).toBe(
      study.aggregates.byModel.luna.warehouse["contra-1"]!.pooled!.falling,
    );
    expect(falling).toBe(14);
  });

  it("wirft bei einer fehlenden Messung und nennt die Stelle", () => {
    const broken = structuredClone(study);
    delete broken.results.cells.warehouse["contra-1"]!["D0|c096"];
    expect(() => siteRows(broken, "warehouse", "D0", "contra-1")).toThrow(
      /warehouse\/contra-1\/D0\|c096/,
    );
  });

  it("wirft, wenn die Auswahl keine Semantik-Stelle enthält", () => {
    const rows = siteRows(study, "warehouse", "D0", "none").filter(
      (r) => !r.semantic,
    );
    expect(rows.length).toBe(1);
    expect(() => summarize(rows)).toThrow(/Semantik/);
    expect(() => summarize([])).toThrow(/Semantik/);
  });
});

describe("Leak", () => {
  it("ergibt an jeder gespeicherten Zelle den Leak-Anteil der Studie", () => {
    let checked = 0;
    for (const scenario of SCENARIOS) {
      for (const [cond, cells] of Object.entries(
        study.results.cells[scenario],
      )) {
        const leaks = study.conditions[cond]!.leaks;
        for (const [key, cell] of Object.entries(cells)) {
          const [variant, id] = key.split("|") as ["D0" | "D4", string];
          const site = study.sites[scenario][variant].sites.find(
            (s) => s.id === id,
          )!;
          const got =
            cell.seeds.filter(([, top1]) => isLeak(top1, site.gold, leaks))
              .length / cell.seeds.length;
          expect(got, `${scenario}/${cond}/${key}`).toBeCloseTo(cell.leak, 3);
          checked++;
        }
      }
    }
    // 2 Fachgebiete × 6 Bedingungen × 2 Varianten × 10 Stellen
    expect(checked).toBe(240);
  });

  it("verlangt einen Anfang aus der Liste und kein Soll-Token", () => {
    expect(isLeak("Objects", "new", LEAKS)).toBe(true);
    expect(isLeak(" @Override", "new", LEAKS)).toBe(true);
    // „.Objects“ beginnt nicht mit „objects“
    expect(isLeak(".Objects", "new", LEAKS)).toBe(false);
    // Soll-Token, das selbst in der Liste steht, ist kein Leak
    expect(isLeak("this", "this", LEAKS)).toBe(false);
    expect(isLeak("units", "new", LEAKS)).toBe(false);
    expect(isLeak("  \n", "new", LEAKS)).toBe(false);
    // ohne Regeln gibt es keinen Leak
    expect(isLeak("Objects", "new", [])).toBe(false);
  });
});

describe("Regeltext und Code", () => {
  it("zerlegt eine Regel in Bedingung und verlangten Anfang", () => {
    expect(
      parseRule(
        "R002. If an array has length 4 and length 7, then start your continuation with the modifier final.",
      ),
    ).toEqual({
      id: "R002",
      condition: "an array has length 4 and length 7",
      start: "the modifier final",
    });
  });

  it("behält den Punkt im verlangten Anfang: Objects.requireNonNull(", () => {
    const line = ruleLines(study.conditions["contra-1"]!.rules)[0]!;
    expect(parseRule(line)?.start).toBe("the call Objects.requireNonNull(");
  });

  it("zerlegt alle zehn Regeln der Studie", () => {
    const lines = ruleLines(study.conditions["contra-10"]!.rules);
    expect(lines.map((l) => parseRule(l)?.id)).toEqual(
      Array.from(
        { length: 10 },
        (_, i) => `R${String(i + 1).padStart(3, "0")}`,
      ),
    );
  });

  it("gibt für Kopfzeilen und Regeln ohne If-Teil null zurück", () => {
    expect(parseRule("The following is forbidden:")).toBeNull();
    expect(
      parseRule("R003. Start your continuation with the keyword this."),
    ).toBeNull();
    expect(parseRule("")).toBeNull();
  });

  it("liefert ohne Regeltext keine Zeilen", () => {
    expect(ruleLines(null)).toEqual([]);
    expect(ruleLines("")).toEqual([]);
  });

  it("zerlegt den Code lückenlos und setzt jede Marke an ihre Stelle", () => {
    for (const scenario of SCENARIOS) {
      for (const variant of VARIANTS) {
        const block = study.sites[scenario][variant];
        const segs = codeSegments(block);
        const where = `${scenario}/${variant}`;
        expect(segs.map((s) => s.text).join(""), where).toBe(block.code);
        expect(segs.length, where).toBe(11);
        expect(segs[10]!.mark, where).toBeUndefined();
        let offset = 0;
        segs.slice(0, 10).forEach((s, i) => {
          offset += s.text.length;
          expect(s.mark!.n, where).toBe(i + 1);
          expect(offset, `${where} Marke ${i + 1}`).toBe(
            s.mark!.site.prefixChars,
          );
          // `cursorContext` kommt aus der Datenbank der Studie
          expect(
            sitePrefix(block, s.mark!.site).endsWith(
              s.mark!.site.cursorContext,
            ),
            `${where} ${s.mark!.site.id}`,
          ).toBe(true);
        });
      }
    }
  });

  it("sortiert Stellen nach Position, auch wenn die Daten ungeordnet sind", () => {
    const block = study.sites.warehouse.D0;
    const shuffled = { code: block.code, sites: [...block.sites].reverse() };
    expect(orderedSites(shuffled).map((s) => s.id)).toEqual(
      block.sites.map((s) => s.id),
    );
    expect(codeSegments(shuffled)).toEqual(codeSegments(block));
  });

  it("zerlegt Code ohne Stellen in ein einziges Stück", () => {
    expect(codeSegments({ code: "int x;", sites: [] })).toEqual([
      { text: "int x;" },
    ]);
  });
});

describe("Prompt und Anfrage wie in der Studie", () => {
  const ex = study.request.exampleBody as {
    messages: { role: string; content: string }[];
    model: string;
  };
  const block = study.sites.warehouse.D4;
  const site = block.sites.find((s) => s.id === "c050")!;
  const user = userPrompt(
    study.request,
    study.conditions["req-8"]!.rules,
    sitePrefix(block, site),
  );

  it("baut die User-Nachricht des Beispiels byte-genau", () => {
    expect(user).toBe(ex.messages[1]!.content);
  });

  it("baut mit OpenAI, Reasoning aus und Flex an den Body des Runners", () => {
    expect(
      liveBody("openai", ex.model, study.request, user, {
        noReasoning: true,
        flex: true,
      }),
    ).toEqual(study.request.exampleBody);
    expect(ex.model).toBe(DEFAULT_LUNA.openai);
    expect(LIVE_SEED).toBe(study.source.seeds[0]);
  });

  it("lässt abgewählte Haken aus dem Body weg", () => {
    const body = liveBody("openai", "m", study.request, "u", {
      noReasoning: false,
      flex: false,
    });
    expect(Object.keys(body).sort()).toEqual([
      "logprobs",
      "max_completion_tokens",
      "messages",
      "model",
      "seed",
      "top_logprobs",
    ]);
  });

  it("schickt über OpenRouter weder Flex noch OpenAI-Parameter", () => {
    const on = liveBody("openrouter", "openai/x", study.request, "u", {
      noReasoning: true,
      flex: true,
    });
    expect(on).toEqual({
      model: "openai/x",
      messages: [
        { role: "system", content: study.request.systemPrompt },
        { role: "user", content: "u" },
      ],
      logprobs: true,
      top_logprobs: 5,
      max_tokens: 4,
      provider: { require_parameters: true },
      reasoning: { enabled: false },
    });
    const off = liveBody("openrouter", "openai/x", study.request, "u", {
      noReasoning: false,
      flex: false,
    });
    expect("reasoning" in off).toBe(false);
  });

  it("baut ohne Regeln den Prompt ohne Abschnitt Rules", () => {
    expect(userPrompt(study.request, null, "class A {")).toBe(
      '# Task\nComplete the Java source file in the section "Source file". Continue exactly at its end.\n\n# Source file\n```java\nclass A {',
    );
  });

  it("übernimmt $-Folgen im Code und in den Regeln wörtlich", () => {
    const prefix = 'String s = "$& $1 $$ {RULES}";';
    expect(userPrompt(study.request, null, prefix).endsWith(prefix)).toBe(true);
    // Der Regeltext endet selbst mit einem Zeilenumbruch, die Vorlage setzt zwei dahinter.
    const withRules = userPrompt(study.request, "R001. $& $'\n", prefix);
    expect(withRules).toContain("# Rules\nR001. $& $'\n\n\n# Source file");
    expect(withRules.endsWith(prefix)).toBe(true);
  });

  it("schätzt die Kosten aus den gemessenen Kosten je Anfrage", () => {
    // notes.cost.luna.perCondition["contra-10"].costUsd = 0,000062
    expect(estimateCostUsd(study, "contra-10", 10)).toBeCloseTo(0.00062, 8);
    expect(estimateCostUsd(study, "none", 0)).toBe(0);
    const broken = structuredClone(study);
    delete broken.notes.cost.luna.perCondition["contra-1"];
    expect(() => estimateCostUsd(broken, "contra-1", 10)).toThrow(/contra-1/);
  });
});

describe("Auswertung einer Antwort", () => {
  const lp = (token: string, p: number) => ({ token, logprob: Math.log(p) });

  it("fasst Schreibweisen zusammen, verwirft Leerraum und renormiert", () => {
    // objects 0,6 + 0,2 = 0,8; Leerraum 0,1 fällt weg; Masse max(0,9; 0,9);
    // p1 = 0,8 / 0,9, logit = ln(8) = 2,0794
    const r = measureTop(
      [lp(" Objects", 0.6), lp("objects", 0.2), lp("\n", 0.1), lp("new", 0.1)],
      "new",
      LEAKS,
    );
    expect(r.top1).toBe("Objects");
    expect(r.p1).toBeCloseTo(0.8 / 0.9, 10);
    expect(r.logit).toBeCloseTo(Math.log(8), 10);
    expect(r.top.map(([t]) => t)).toEqual(["Objects", "new"]);
    expect(r.top[1]![1]).toBeCloseTo(0.1 / 0.9, 10);
    expect([r.hit, r.leak]).toEqual([false, true]);
  });

  it("zeigt die wahrscheinlichste Schreibweise einer Gruppe", () => {
    const r = measureTop([lp("new", 0.2), lp(" New", 0.5)], "new", LEAKS);
    expect(r.top).toHaveLength(1);
    expect(r.top1).toBe("New");
    expect([r.hit, r.leak]).toEqual([true, false]);
  });

  it("rechnet mit der Restmasse, wenn die Top-5 nicht alles abdecken", () => {
    // sichtbar 0,5 + 0,2, kein Leerraum: Masse = max(1; 0,7) = 1
    const r = measureTop([lp("base", 0.5), lp("cold", 0.2)], "baseSeconds", []);
    expect(r.p1).toBeCloseTo(0.5, 10);
    expect(r.logit).toBeCloseTo(0, 10);
    expect(r.hit).toBe(true);
  });

  it("deckelt P(top1) bei 0,999: logit höchstens 6,91", () => {
    const r = measureTop([{ token: "Units", logprob: 0 }], "Units", LEAKS);
    expect(r.p1).toBe(P_MAX);
    expect(r.logit).toBeCloseTo(6.9068, 4);
    // positive Logprobs durch Rundung des Anbieters zählen als 0
    expect(
      measureTop([{ token: "Units", logprob: 0.01 }], "Units", []).p1,
    ).toBe(P_MAX);
  });

  it("zählt einen positiven Logprob als 0, auch wenn die Deckelung nicht greift", () => {
    // a: exp(min(0,2; 0)) = 1; b: 0,5; Masse = max(1; 1,5) = 1,5; p1 = 2/3
    const r = measureTop(
      [
        { token: "a", logprob: 0.2 },
        { token: "b", logprob: Math.log(0.5) },
      ],
      "a",
      [],
    );
    expect(r.p1).toBeCloseTo(2 / 3, 10);
  });

  it("meldet einen Fehler, wenn nur Leerraum unter den Top-5 steht", () => {
    const r = measureTop([lp("\n", 0.7), lp("  ", 0.3)], "new", LEAKS);
    expect(r.error).toMatch(/Leerraum/);
    expect([r.top1, r.p1, r.logit]).toEqual([null, null, null]);
  });

  const okBody = (top: { token: string; logprob: number }[]) =>
    JSON.stringify({
      model: "gpt-5.6-luna-2026",
      usage: { prompt_tokens: 751, completion_tokens: 4 },
      choices: [{ logprobs: { content: [{ top_logprobs: top }] } }],
    });

  it("liest Top-1, Leak und Verbrauch aus einer Antwort", () => {
    const r = parseLive(
      200,
      okBody([lp("Objects", 0.9), lp("new", 0.1)]),
      "new",
      LEAKS,
    );
    expect(r.error).toBeUndefined();
    expect([r.top1, r.leak, r.hit]).toEqual(["Objects", true, false]);
    expect(r.logit).toBeCloseTo(Math.log(9), 10);
    expect(r.usage).toBe(
      "Modell laut Antwort: gpt-5.6-luna-2026 · Tokens ein/aus 751/4",
    );
  });

  it("verwirft Platzhalter-Logprobs von −9999", () => {
    const r = parseLive(
      200,
      okBody([lp("new", 0.5), { token: "x", logprob: -9999 }]),
      "new",
      [],
    );
    expect(r.top.map(([t]) => t)).toEqual(["new"]);
  });

  it("meldet fehlende Logprobs als Fehler ohne Wiederholung", () => {
    for (const body of [
      JSON.stringify({ choices: [{ logprobs: null }] }),
      JSON.stringify({ choices: [] }),
      okBody([]),
    ]) {
      const r = parseLive(200, body, "new", LEAKS);
      expect(r.error, body).toMatch(/keine Logprobs/);
      expect([r.fatal, r.retry], body).toEqual([undefined, undefined]);
    }
  });

  it.each([
    [401, true, false, /Key/],
    [403, true, false, /Key/],
    [404, true, false, /Modellname/],
    [400, true, false, /Modellname/],
    [429, false, true, /Rate-Limit/],
    [500, false, true, /später erneut/],
    [503, false, true, /später erneut/],
  ])("ordnet HTTP %i ein", (status, fatal, retry, hint) => {
    const r = parseLive(
      status,
      JSON.stringify({ error: { message: "nope" } }),
      "new",
      LEAKS,
    );
    expect(r.error).toMatch(new RegExp(`^HTTP ${status}: nope `));
    expect(r.error).toMatch(hint);
    expect([r.fatal, r.retry]).toEqual([fatal, retry]);
    expect(r.logit).toBeNull();
  });

  it("zeigt bei einer Antwort ohne JSON den Anfang des Texts", () => {
    const r = parseLive(502, "<html>Bad Gateway</html>", "new", LEAKS);
    expect(r.error).toContain("HTTP 502: <html>Bad Gateway</html>");
    expect(r.retry).toBe(true);
    expect(parseLive(200, "not json", "new", LEAKS).error).toBe(
      "HTTP 200: not json",
    );
  });

  it("liest Fehler als Text, als Objekt ohne message und im 200er-Body", () => {
    expect(parseLive(429, '{"error":"slow down"}', "new", []).error).toMatch(
      /^HTTP 429: slow down /,
    );
    expect(parseLive(400, '{"error":{"code":"x"}}', "new", []).error).toMatch(
      /^HTTP 400: \{"code":"x"\} /,
    );
    const r = parseLive(200, '{"error":{"message":"upstream"}}', "new", []);
    expect(r.error).toBe("HTTP 200: upstream");
    expect([r.fatal, r.retry]).toEqual([false, false]);
  });

  it("schwärzt Keys in Fehlermeldungen, auch teilweise maskierte", () => {
    expect(
      redactKeys(
        "HTTP 401: Incorrect API key provided: sk-proj-Ab12*****9xYz. Find your key at example.",
      ),
    ).toBe(
      "HTTP 401: Incorrect API key provided: sk-…. Find your key at example.",
    );
    expect(redactKeys("a sk-or-v1-0123abcd b sk-live_9 c")).toBe(
      "a sk-… b sk-… c",
    );
    // kein Key: Wörter mit „sk-“ ohne Rest und gewöhnlicher Text bleiben stehen
    expect(redactKeys("task-12 risk- ask sk-1")).toBe("task-12 risk- ask sk-1");
    expect(redactKeys("HTTP 404: model not found")).toBe(
      "HTTP 404: model not found",
    );
  });

  it("gibt zu einem Status ohne Rat einen leeren Hinweis", () => {
    expect(errorHint(418)).toBe("");
    expect(errorHint(499)).toBe("");
    expect(errorHint(500)).not.toBe("");
  });
});

describe("Lauf über mehrere Stellen", () => {
  const good = JSON.stringify({
    choices: [
      {
        logprobs: {
          content: [{ top_logprobs: [{ token: "new", logprob: -0.1 }] }],
        },
      },
    ],
  });
  const jobs = (n: number): LiveJob[] =>
    Array.from({ length: n }, (_, i) => ({
      key: `k${i}`,
      label: `Stelle ${i + 1}`,
      gold: "new",
      body: { i },
    }));

  function harness(
    reply: (
      i: number,
      call: number,
    ) => { status: number; text: string } | Error,
  ) {
    const ctl = new AbortController();
    const calls = new Map<number, number>();
    const sleeps: number[] = [];
    const results = new Map<string, LiveResult>();
    let active = 0;
    let peak = 0;
    const opts = {
      signal: ctl.signal,
      leaks: LEAKS,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      send: async (body: Record<string, unknown>) => {
        const i = body.i as number;
        const call = (calls.get(i) ?? 0) + 1;
        calls.set(i, call);
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active--;
        const r = reply(i, call);
        if (r instanceof Error) throw r;
        return r;
      },
      onResult: (job: LiveJob, r: LiveResult) => {
        results.set(job.key, r);
      },
    };
    return { ctl, calls, sleeps, results, opts, peak: () => peak };
  }

  it("fragt jede Stelle einmal ab und zählt die Ergebnisse", async () => {
    const h = harness(() => ({ status: 200, text: good }));
    const sum = await runJobs(jobs(10), h.opts);
    expect(sum).toEqual({ done: 10, failed: 0, skipped: 0, stopped: false });
    expect([...h.results.keys()].sort()).toEqual(
      jobs(10)
        .map((j) => j.key)
        .sort(),
    );
    expect([...h.calls.values()]).toEqual(Array(10).fill(1));
    expect(h.sleeps).toEqual([]);
  });

  it("hält höchstens vier Anfragen gleichzeitig offen", async () => {
    const h = harness(() => ({ status: 200, text: good }));
    await runJobs(jobs(10), h.opts);
    expect(h.peak()).toBe(4);
    const one = harness(() => ({ status: 200, text: good }));
    await runJobs(jobs(3), { ...one.opts, concurrency: 1 });
    expect(one.peak()).toBe(1);
  });

  it("läuft ohne Anfragen leer durch", async () => {
    const h = harness(() => ({ status: 200, text: good }));
    expect(await runJobs([], h.opts)).toEqual({
      done: 0,
      failed: 0,
      skipped: 0,
      stopped: false,
    });
  });

  it("wiederholt bei Rate-Limit mit wachsender Pause", async () => {
    const h = harness((_i, call) =>
      call < 3
        ? { status: 429, text: '{"error":{"message":"slow"}}' }
        : { status: 200, text: good },
    );
    const sum = await runJobs(jobs(1), h.opts);
    expect(sum).toEqual({ done: 1, failed: 0, skipped: 0, stopped: false });
    expect(h.calls.get(0)).toBe(3);
    expect(h.sleeps).toEqual([RETRY_BASE_MS, 2 * RETRY_BASE_MS]);
  });

  it("gibt nach drei Versuchen auf und meldet den letzten Fehler", async () => {
    const h = harness(() => ({ status: 503, text: "down" }));
    const sum = await runJobs(jobs(1), h.opts);
    expect(sum).toEqual({ done: 0, failed: 1, skipped: 0, stopped: false });
    expect(h.calls.get(0)).toBe(3);
    // nach dem letzten Versuch wird nicht mehr gewartet
    expect(h.sleeps).toEqual([RETRY_BASE_MS, 2 * RETRY_BASE_MS]);
    expect(h.results.get("k0")!.error).toContain("HTTP 503: down");
  });

  it("wiederholt einen Netzfehler und meldet ihn als solchen", async () => {
    const h = harness((_i, call) =>
      call === 1
        ? new TypeError("Failed to fetch")
        : { status: 200, text: good },
    );
    expect((await runJobs(jobs(1), h.opts)).done).toBe(1);
    const dead = harness(() => new TypeError("Failed to fetch"));
    await runJobs(jobs(1), dead.opts);
    expect(dead.results.get("k0")!.error).toBe("Netzfehler: Failed to fetch");
  });

  it("stoppt nach einem falschen Modellnamen und sendet den Rest nicht", async () => {
    const h = harness(() => ({
      status: 404,
      text: '{"error":{"message":"model not found"}}',
    }));
    const sum = await runJobs(jobs(10), { ...h.opts, concurrency: 1 });
    expect(sum).toEqual({ done: 0, failed: 1, skipped: 9, stopped: false });
    expect(h.calls.size).toBe(1);
    expect(h.sleeps).toEqual([]);
    expect(h.results.get("k0")!.error).toMatch(/Modellname/);
    expect(h.results.get("k9")!.error).toMatch(
      /^nicht gesendet: früherer Fehler \(HTTP 404: model not found/,
    );
  });

  it("lässt nach einem Abbruch die offenen Stellen ohne Ergebnis", async () => {
    const h = harness((i) => {
      if (i === 2) {
        h.ctl.abort();
        const e = new Error("aborted");
        e.name = "AbortError";
        return e;
      }
      return { status: 200, text: good };
    });
    const sum = await runJobs(jobs(10), { ...h.opts, concurrency: 1 });
    expect(sum).toEqual({ done: 2, failed: 0, skipped: 0, stopped: true });
    expect([...h.results.keys()]).toEqual(["k0", "k1"]);
  });

  it("meldet einen Abbruch im letzten Versuch nicht als Netzfehler", async () => {
    const h = harness(() => {
      h.ctl.abort();
      const e = new Error("aborted");
      e.name = "AbortError";
      return e;
    });
    const sum = await runJobs(jobs(1), { ...h.opts, attempts: 1 });
    expect(sum).toEqual({ done: 0, failed: 0, skipped: 0, stopped: true });
    expect(h.results.size).toBe(0);
  });

  it("bricht auch in der Pause zwischen zwei Versuchen ab", async () => {
    const h = harness(() => ({ status: 429, text: "{}" }));
    const sum = await runJobs(jobs(2), {
      ...h.opts,
      concurrency: 1,
      sleep: async () => {
        h.ctl.abort();
      },
    });
    expect(sum).toEqual({ done: 0, failed: 0, skipped: 0, stopped: true });
    expect(h.calls.get(0)).toBe(1);
    expect(h.results.size).toBe(0);
  });
});

describe("Live gegen Studie", () => {
  const rows = siteRows(study, "warehouse", "D0", "contra-1");
  const base = siteRows(study, "warehouse", "D0", "none");
  const result = (logit: number, leak: boolean): LiveResult => ({
    top: [],
    top1: "x",
    p1: 0.5,
    logit,
    hit: false,
    leak,
  });

  it("mittelt nur Semantik-Stellen mit Messwert gegen die Grundlinie", () => {
    // Grundlinien: c050 1,4136; c066 6,9068; c096 3,4504. c077 ist die Syntax-Stelle.
    // Δ: c050 −1, c066 +0,3, c096 genau 0 (zählt nicht als fallend).
    const live: Record<string, LiveResult> = {
      c050: result(0.4136, true),
      c066: result(7.2068, false),
      c077: result(-5, true),
      c096: result(3.4504, false),
      c124: { ...result(0, false), logit: null, error: "HTTP 500" },
    };
    const s = summarizeLive(rows, base, (id) => live[id])!;
    expect(s.measured).toBe(3);
    expect(s.logit).toBeCloseTo((0.4136 + 7.2068 + 3.4504) / 3, 6);
    expect(s.delta).toBeCloseTo(-0.7 / 3, 6);
    expect([s.leaks, s.falling]).toEqual([1, 1]);
  });

  it("gibt ohne Messwert null zurück", () => {
    expect(summarizeLive(rows, base, () => undefined)).toBeNull();
    expect(
      summarizeLive(rows, base, (id) =>
        id === "c077" ? result(1, false) : undefined,
      ),
    ).toBeNull();
  });

  it("überspringt Stellen ohne Grundlinie", () => {
    const s = summarizeLive(
      rows,
      base.filter((r) => r.site.id !== "c050"),
      (id) =>
        id === "c050" || id === "c066" ? result(6.9068, false) : undefined,
    )!;
    expect(s.measured).toBe(1);
    expect(s.delta).toBeCloseTo(0, 3);
  });
});

describe("Zahlen für die Folie", () => {
  it("schreibt Dezimalkomma und echtes Minus", () => {
    expect(formatNumber(-0.9569)).toBe("−0,96");
    expect(formatNumber(1.4136)).toBe("1,41");
    expect(formatNumber(6.9068, 1)).toBe("6,9");
    expect(formatNumber(-0.004)).toBe("0,00");
    expect(formatNumber(0)).toBe("0,00");
  });

  it("gibt Differenzen ein Vorzeichen, außer bei gerundet null", () => {
    expect(formatDelta(0.1594)).toBe("+0,16");
    expect(formatDelta(-1.6243)).toBe("−1,62");
    expect(formatDelta(0.004)).toBe("0,00");
    expect(formatDelta(-0.004)).toBe("0,00");
    expect(formatDelta(0)).toBe("0,00");
  });

  it("schreibt Dollarbeträge mit zwei tragenden Stellen", () => {
    expect(formatUsd(0.00062)).toBe("0,00062 $");
    expect(formatUsd(0.000585)).toMatch(/^0,0005[89] \$$/);
    expect(formatUsd(0.0033)).toBe("0,0033 $");
    expect(formatUsd(0.25)).toBe("0,25 $");
    expect(formatUsd(3)).toBe("3,00 $");
    expect(formatUsd(0)).toBe("0 $");
  });
});
