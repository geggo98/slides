import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIN_MODELS,
  mindestzahl,
  parseCursor,
  parseJetbrains,
  parseWindsurf,
  SOURCES,
} from "../../../data/toolcatalogs/fetch";
import { CATALOGS } from "../../toolCatalogs";

const DATA = join(import.meta.dirname, "../../../data/toolcatalogs");

// Die Parser lesen drei Rohformate. Die Ausschnitte unten sind gekürzte, aber
// wörtliche Stücke der Seiten vom 29.09.2026 — jeweils mit dem Rauschen, das die
// Parser abhalten müssen (Tarif-Tabelle, zweiter Tarif, Historie-Tabelle).
describe("parseCursor", () => {
  const md = [
    "| Model | Provider | Input | Output | Notes |",
    "| ----- | -------- | ----- | ------ | ----- |",
    "| [Grok 4.7](https://x.ai/news/grok-4-7) | Cursor | $2 | $6 | Jointly trained |",
    "| Claude Opus 5 | Anthropic | $5 | $25 | Hidden by default; Cache: writes 1.25x |",
    "",
    "| Plan | **Pro** | **Pro Plus** | **Ultra** |",
    "| ---- | ------- | ------------ | --------- |",
    "| **Pro Plus** | x | y | z |",
    "",
    "| Model | Provider | Input | Output | Notes |",
    "| ----- | -------- | ----- | ------ | ----- |",
    "| Kimi K3 | Moonshot | $3 | $9 | Hidden by default |",
    "| Grok 4.7 | Cursor | $2 | $6 | doppelt |",
  ].join("\n");

  it("liest nur Modelltabellen, entlinkt Namen und merkt „hidden“", () => {
    expect(parseCursor(md)).toStrictEqual([
      { name: "Grok 4.7" },
      { name: "Claude Opus 5", hidden: true },
      { name: "Kimi K3", hidden: true },
    ]);
  });
});

describe("parseWindsurf", () => {
  const eintrag = (tier: string, label: string) =>
    `{ "tier": "${tier}", "label": "${label}", "model_provider": "MODEL_PROVIDER_OPENAI", "credit_multiplier": 1 }`;
  const md = `# AI Models\n\nexport const modelCostData = [${[
    eintrag("TEAMS_TIER_ENTERPRISE_SAAS", "GPT-4o"),
    eintrag("TEAMS_TIER_PRO", "GPT-4o"),
    eintrag("TEAMS_TIER_PRO", "GPT-5.6 Luna High Thinking"),
    eintrag(
      "TEAMS_TIER_PRO",
      'Label mit ] und "Anführungszeichen'.replace(/"/g, '\\"'),
    ),
  ].join(", ")}];\n\n<ModelCosts data={modelCostData} tier="TEAMS_TIER_PRO" />`;

  it("nimmt den Pro-Tarif, entdoppelt und übersteht Klammern in Strings", () => {
    expect(parseWindsurf(md).map((m) => m.name)).toStrictEqual([
      "GPT-4o",
      "GPT-5.6 Luna High Thinking",
      'Label mit ] und "Anführungszeichen',
    ]);
    expect(parseWindsurf(md)[0]).toStrictEqual({
      name: "GPT-4o",
      provider: "OPENAI",
    });
  });

  it("scheitert laut, wenn die Daten fehlen", () => {
    expect(() => parseWindsurf("# AI Models")).toThrow(/nicht gefunden/);
  });

  // Die HTML-Seite ab 28.10.2026: das Feld steht im kompilierten MDX, und das
  // wiederum als JSON-String in `"compiledSource":"…"`. Werte sind dort
  // Template-Strings, Zahlen haben keine führende Null. Nachgebaut nach der
  // Seite vom 09.11.2026, gekürzt.
  const js = (tier: string, label: string, provider: string) =>
    `{"tier":\`${tier}\`,"model_uid":\`MODEL_X\`,"label":\`${label}\`,"model_provider":\`MODEL_PROVIDER_${provider}\`,"input_cost_per_million_usd":.15,"credit_multiplier":0,"is_recommended":false}`;
  const mdx = `"use strict";const modelCostData=[${[
    js("TEAMS_TIER_DEVIN_ENTERPRISE", "GPT-OSS 120B Medium Thinking", "OPENAI"),
    js("TEAMS_TIER_PRO", "GPT-OSS 120B Medium Thinking", "OPENAI"),
    js("TEAMS_TIER_PRO", "SWE-2 Flash Low", "WINDSURF"),
    js("TEAMS_TIER_PRO", "Label mit ] darin", "ANTHROPIC"),
    js("TEAMS_TIER_PRO", "Penguin High", "UNSPECIFIED"),
    js("TEAMS_TIER_PRO", "GPT-6 Sol [dev]", "OPENAI"),
    js("TEAMS_TIER_PRO", "Grok 4.7 (Backend Only)", "XAI"),
  ].join(",")}];const ModelCosts=({data,tier})=>null;`;
  const html = `<html><script id="__NEXT_DATA__">{"props":{"mdx":{"compiledSource":${JSON.stringify(mdx)},"frontmatter":{}}}}</script>
    <table><tbody></tbody></table></html>`;

  it("liest die HTML-Seite: kompiliertes MDX, Template-Strings, .15", () => {
    expect(parseWindsurf(html)).toStrictEqual([
      { name: "GPT-OSS 120B Medium Thinking", provider: "OPENAI" },
      { name: "SWE-2 Flash Low", provider: "WINDSURF" },
      { name: "Label mit ] darin", provider: "ANTHROPIC" },
    ]);
  });

  it("blendet aus, was die Seite ausblendet (UNSPECIFIED, [dev], backend only)", () => {
    const n = parseWindsurf(html).map((m) => m.name);
    expect(n).not.toContain("Penguin High");
    expect(n).not.toContain("GPT-6 Sol [dev]");
    expect(n).not.toContain("Grok 4.7 (Backend Only)");
  });

  it("scheitert laut bei einer Seite mit leerer Tabelle und ohne Feld", () => {
    expect(() =>
      parseWindsurf("<table><tbody /></table><p>as of November 5</p>"),
    ).toThrow(/nicht gefunden/);
  });
});

describe("mindestzahl", () => {
  const m = (name: string, evidence?: string[]) => ({
    name,
    ...(evidence ? { evidence } : {}),
  });

  it("ohne Vorarchiv gilt die feste Untergrenze", () => {
    expect(mindestzahl("windsurf", undefined)).toBe(MIN_MODELS.windsurf);
  });

  it("verlangt 80 % der selbst belegten Einträge des letzten Archivs", () => {
    const vorher = Array.from({ length: 300 }, (_, i) => m(`M${i}`));
    expect(mindestzahl("windsurf", vorher)).toBe(240);
  });

  it("zählt „übernommen aus …“ nicht mit — die Seite hat sie nicht gezeigt", () => {
    const vorher = [
      ...Array.from({ length: 259 }, (_, i) => m(`M${i}`, ["https://…: X"])),
      ...Array.from({ length: 67 }, (_, i) =>
        m(`A${i}`, ["übernommen aus windsurf-20261028-c06820a4.json"]),
      ),
    ];
    // So sah das ungemergte Zwischenarchiv vom 09.11.2026 aus (326 Einträge):
    // 0,8 × 326 = 261 hätte die 259 der Seite abgewiesen.
    expect(mindestzahl("windsurf", vorher)).toBe(208);
  });

  it("Windsurf heute: ein Abrufarchiv, die Basis sind alle Einträge", () => {
    // Seit 09.11.2026 gilt die Tabelle als Entfernungsbeleg; das Archiv ist
    // die Ausgabe von `parseWindsurf`, ohne „übernommen“-Einträge.
    const w = CATALOGS.windsurf.models;
    expect(w.some((x) => x.evidence)).toBe(false);
    expect(mindestzahl("windsurf", w)).toBe(Math.ceil(0.8 * w.length));
    expect(mindestzahl("windsurf", w)).toBe(208); // ⌈0,8 × 259⌉
  });
});

describe("parseJetbrains", () => {
  const html = `<table><tr><th>Model</th><th>Capabilities</th></tr>
    <tr><td>&nbsp; Claude Fable 5</td><td></td></tr>
    <tr><td><span>GPT 5.6 Luna</span></td><td></td></tr></table>
    <h2>History</h2>
    <table><tr><td>Claude 3.5 Haiku</td><td>Deprecated by provider</td></tr></table>`;

  it("liest nur die erste Tabelle (aktive Modelle), ohne Kopfzeile", () => {
    expect(parseJetbrains(html)).toStrictEqual([
      { name: "Claude Fable 5" },
      { name: "GPT 5.6 Luna" },
    ]);
  });
});

// Die eingecheckten Schnappschüsse: Mindestzahl (dieselbe wie im Abruf), Hash
// gegen den Index — wer eine Datei von Hand ändert, fällt hier auf.
describe("Schnappschüsse", () => {
  const index = readFileSync(join(DATA, "index.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map(
      (l) =>
        JSON.parse(l) as {
          tool: keyof typeof MIN_MODELS;
          file: string;
          sha256: string;
          models: number;
          fetched_at: string;
        },
    );

  for (const id of ["cursor", "windsurf", "jetbrains-ai"] as const) {
    it(`${id}: Mindestzahl, Hash und Abrufdatum stimmen`, () => {
      const c = CATALOGS[id];
      const e = index.find(
        (x) => x.tool === id && x.fetched_at.startsWith(c.retrieved),
      );
      expect(e, `${id} fehlt im Index`).toBeDefined();
      // `find` nimmt den ersten Treffer; ein zweiter Eintrag desselben Tages
      // bliebe sonst unbemerkt.
      expect(
        index.filter(
          (x) => x.tool === id && x.fetched_at.startsWith(c.retrieved),
        ).length,
      ).toBe(1);
      expect(c.models.length).toBe(e!.models);
      // Von Hand recherchiert (`fetch.ts --manual`): keine Mindestzahl, dafür
      // ein Beleg je Modell.
      if (c.source.startsWith("manuell:"))
        for (const m of c.models)
          expect(
            (m as { evidence?: string[] }).evidence?.length,
            m.name,
          ).toBeGreaterThan(0);
      else expect(c.models.length).toBeGreaterThanOrEqual(MIN_MODELS[id]);
      const roh = readFileSync(join(DATA, e!.file), "utf8");
      expect(createHash("sha256").update(roh).digest("hex")).toBe(e!.sha256);
    });
  }

  // Archiv im Format eines Abrufs: dann erzeugt die Routine bei unveränderter
  // Seite denselben Inhalt, derselbe Hash hängt nur `seen` an, und es entsteht
  // keine neue Datei. Ein `--manual`-Archiv hätte Belege und „manuell:“ und
  // würde beim nächsten Abruf ohne echte Änderung ersetzt.
  it("Windsurf: Abrufformat (Quelle, Anbieter je Eintrag, keine Belege), keine Dubletten", () => {
    const w = CATALOGS.windsurf;
    expect(w.source).toBe(SOURCES.windsurf);
    for (const m of w.models)
      expect((m as { provider?: string }).provider, m.name).toBeTruthy();
    expect(new Set(w.models.map((m) => m.name)).size).toBe(w.models.length);
    expect(w.models.map((m) => m.name)).not.toContain("GPT 5.5 Review");
  });

  it("Cursor: die Hälfte der Modelle ist „hidden by default“ und zählt mit", () => {
    const hidden = CATALOGS.cursor.models.filter((m) => m.hidden).length;
    expect(hidden).toBeGreaterThan(30);
    expect(CATALOGS.cursor.models.map((m) => m.name)).toContain("Kimi K3");
  });

  it("JetBrains AI: nur aktive Modelle, keine Historie", () => {
    const n = CATALOGS["jetbrains-ai"].models.map((m) => m.name);
    expect(n).toContain("Claude Opus 5");
    expect(n).not.toContain("Claude 4.1 Opus"); // „Deprecated by provider“
    expect(new Set(n).size).toBe(n.length);
  });

  it("Junie: jedes Modell trägt einen Beleg, keines steht doppelt", () => {
    const m = CATALOGS.junie.models;
    for (const e of m) expect(e.evidence?.length, e.name).toBeGreaterThan(0);
    expect(new Set(m.map((e) => e.name)).size).toBe(m.length);
    // Junie führt neuere Modelle als die Hilfe zum AI Assistant.
    expect(m.map((e) => e.name)).toContain("GPT-6 Astra");
  });
});
