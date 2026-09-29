import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIN_MODELS,
  parseCursor,
  parseJetbrains,
  parseWindsurf,
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
      expect(c.models.length).toBe(e!.models);
      expect(c.models.length).toBeGreaterThanOrEqual(MIN_MODELS[id]);
      const roh = readFileSync(join(DATA, e!.file), "utf8");
      expect(createHash("sha256").update(roh).digest("hex")).toBe(e!.sha256);
    });
  }

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
