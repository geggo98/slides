import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_COST } from "../../aaData";
import { catalogHas, catalogKeys, familyKey } from "../../catalogMatch";
import { CURRENT } from "../../paretoData";
import { CATALOGS, type CatalogId } from "../../toolCatalogs";

// Ein Name, drei Schreibweisen: Katalog, AA, Chart. Die Fälle unten sind die
// Stellen, an denen ein stiller Fehler gut aussähe — zwei Modelle, die
// verschmelzen, oder eines, das sich nicht wiederfindet.
describe("familyKey — dieselbe Familie", () => {
  it.each([
    ["GPT-5.6 Luna High Thinking Fast", "gpt-5.6-luna"],
    ["GPT 5.6 Luna", "gpt-5.6-luna"],
    ["gpt-5.6-luna", "gpt-5.6-luna"],
    ["GPT-5.4 (xhigh)", "gpt-5.4"],
    ["o3 High Reasoning", "o3"],
    ["o4-mini (high)", "o4-mini"],
    ["Kimi K3 Max", "kimi-k3"],
    ["Claude Opus 5.5 Max Fast", "claude-opus-5.5"],
    [
      "Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)",
      "claude-opus-5.5",
    ],
    // Wortstellung bei älteren Claude-Namen
    ["Claude 4.5 Opus", "claude-opus-4.5"],
    ["Claude Opus 4.5 (Reasoning)", "claude-opus-4.5"],
    ["Claude 4 Sonnet 1M", "claude-sonnet-4"],
    ["Claude Sonnet 4.6 Thinking 1M", "claude-sonnet-4.6"],
    // Kontext- und Modusvarianten
    ["Grok 4.7 500k (Fast)", "grok-4.7"],
    ["GPT-5.2 No Thinking Fast", "gpt-5.2"],
    // Datum und Vorschau
    ["DeepSeek V4 Pro 0813 (Reasoning, Max Effort)", "deepseek-v4-pro"],
    ["Gemini 3.1 Pro Preview", "gemini-3.1-pro"],
    ["Gemini 2.5 Flash Preview (Sep '25) (Reasoning)", "gemini-2.5-flash"],
    // Schreibweisen desselben Modells
    ["GLM-5.3 Flash High", "glm-5.3-flash"],
    ["GLM 5.3 Flash", "glm-5.3-flash"],
    ["MiMo-V2.6-Pro", "mimo-v2.6-pro"],
  ])("%s → %s", (name, key) => {
    expect(familyKey(name)).toBe(key);
  });
});

describe("familyKey — verschiedene Modelle bleiben verschieden", () => {
  it.each([
    ["Gemini 3.5 Flash", "Gemini 3.5 Flash-Lite"],
    ["GPT-5.4", "GPT-5.4 mini"],
    ["GPT-5.3 Codex", "GPT-5.3 Codex Spark Medium"],
    ["GPT-5.1 Codex", "GPT-5.1 Codex Max"], // „Max“ ist hier der Name
    ["Qwen3.8 Max (0902)", "Qwen3.8 27B (xhigh)"],
    ["Claude Opus 4.7", "Claude Opus 4.8"],
    ["GPT-5.6 Luna", "GPT-6 Luna"],
    ["Command A", "Command A+"],
    ["Grok 4", "Grok 4 Fast"], // bei xAI ist „Fast“ ein eigenes Modell
    ["Grok 4.1 Fast", "Grok 4.1"],
  ])("%s ≠ %s", (a, b) => {
    expect(familyKey(a)).not.toBe(familyKey(b));
  });

  it("behält „Max“ hinter Qwen, streicht es als Stufe sonst", () => {
    expect(familyKey("Qwen3.8 Max")).toBe("qwen3.8-max");
    expect(familyKey("Qwen3 Max Thinking")).toBe("qwen3-max");
    expect(familyKey("GPT-5.1 Codex Max")).toBe("gpt-5.1-codex-max");
    expect(familyKey("Claude Opus 5 Max")).toBe("claude-opus-5");
  });
});

// Die drei Listen, die am 29.09.2026 von Hand aus den Rohseiten gelesen und von
// zwei unabhängigen Rechercheuren bestätigt wurden. Der abgeleitete Abgleich
// muss sie auf dem Label-Raum beider Datenquellen exakt reproduzieren — nicht
// mehr, nicht weniger. Bricht das, hat sich Normalisierung oder Katalog bewegt.
describe("Katalog ↔ Chart-Labels — die geprüften Listen", () => {
  const HAND: Partial<Record<CatalogId, string[]>> = {
    cursor: [
      "claude-fable-5",
      "claude-fable-5.1",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-opus-5.5",
      "claude-sonnet-5",
      "claude-sonnet-5.5",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "glm-5.2",
      "glm-5.3",
      "glm-5.3-flash",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "grok-4.6",
      "grok-4.7",
      "kimi-k3",
      "muse-spark-1.3",
    ],
    windsurf: [
      "claude-fable-5",
      "claude-fable-5.1",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-opus-5.5",
      "claude-sonnet-5",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "glm-5.2",
      "glm-5.3",
      "glm-5.3-flash",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-6-astra",
      "gpt-6-luna",
      "gpt-6-sol",
      "grok-4.6",
      "kimi-k3",
    ],
    "jetbrains-ai": [
      "claude-fable-5",
      "claude-opus-4.8",
      "claude-opus-5",
      "claude-sonnet-5",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ],
  };
  const labels = [...new Set([...CURRENT, ...AA_COST].map((p) => p.label))];

  for (const [id, hand] of Object.entries(HAND) as [CatalogId, string[]][])
    it(`${id}: ${hand.length} Chart-Labels, genau die geprüften`, () => {
      const abgeleitet = labels.filter((l) => catalogHas(id, l)).sort();
      expect(abgeleitet).toStrictEqual([...hand].sort());
    });

  it("Junie führt die neueren Modelle, die die AI-Assistant-Hilfe noch nicht kennt", () => {
    const j = labels.filter((l) => catalogHas("junie", l));
    for (const l of [
      "gpt-6-astra",
      "gpt-6-sol",
      "gpt-6-luna",
      "claude-opus-5.5",
      "claude-sonnet-5.5",
      "claude-fable-5.1",
      "gemini-3.8-flash",
      "grok-4.7",
    ])
      expect(j, l).toContain(l);
    expect(catalogHas("jetbrains-ai", "gpt-6-astra")).toBe(false);
  });
});

// Alle 379 Katalognamen mit ihrem Schlüssel, einmal von Hand durchgesehen. Ein
// Unterschied zeigt genau, welcher Name jetzt woanders landet — bei einer
// Änderung der Normalisierung oder eines neuen Abrufs bewusst neu erzeugen.
describe("Golden: Katalogname → Schlüssel", () => {
  const golden = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "__fixtures__/catalog-keys.json"),
      "utf8",
    ),
  ) as Record<CatalogId, Record<string, string>>;

  for (const id of Object.keys(CATALOGS) as CatalogId[])
    it(`${id}: ${CATALOGS[id].models.length} Namen`, () => {
      const jetzt = Object.fromEntries(
        CATALOGS[id].models.map((m) => [m.name, familyKey(m.name)]),
      );
      expect(jetzt).toStrictEqual(golden[id]);
    });

  it("kollabiert nirgends zwei Namen, die sich in mehr als Konfigurationswörtern unterscheiden", () => {
    // Hilfsprobe: je Produkt gilt, dass ein Schlüssel höchstens Namen vereint,
    // deren Kleinbuchstaben-Anfang (bis zur ersten Ziffer nach dem Familienwort)
    // übereinstimmt. Sichtbar wird es an den Zahlen: Windsurf hat 269 Namen und
    // 64 Familien, weil jede Effort-Stufe ein Eintrag ist.
    expect(catalogKeys("windsurf").size).toBeLessThan(80);
    expect(catalogKeys("jetbrains-ai").size).toBe(41); // jedes Modell einzeln
    expect(catalogKeys("junie").size).toBe(11);
  });
});

describe("labOf für die o-Reihe", () => {
  it("ordnet o1, o3 und o4-mini OpenAI zu, ohne andere Wörter mit o zu treffen", async () => {
    const { labOf } = await import("../../paretoData");
    for (const l of ["o1", "o3", "o3-mini", "o4-mini"])
      expect(labOf(l), l).toBe("OpenAI");
    expect(labOf("olmo-3")).toBe("Andere");
  });
});
