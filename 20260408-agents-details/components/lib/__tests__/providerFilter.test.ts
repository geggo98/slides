import { describe, expect, it } from "vitest";
import { AA_COST } from "../../aaData";
import { CURRENT, labOf, paretoFront, type Lab } from "../../paretoData";
import {
  PRESETS,
  TOOLS,
  labRows,
  matchingPreset,
  presetModels,
  toggleLab,
  toolHas,
  type ModelSet,
  type PresetId,
} from "../../providerFilter";

// Der Filter behauptet auf der Folie eine konkrete Sache: Für einen
// JetBrains-Nutzer sieht die Front anders aus als für einen Cursor- oder
// Windsurf-Nutzer. Das ist keine Meinung, sondern folgt aus drei Modell-Listen
// — und die veralten.
// Bricht einer dieser Tests, hat ein Anbieter seinen Katalog geändert und die
// Aussage der Folie muss nachgezogen werden, statt still falsch zu werden.

const front = (sel: ModelSet) =>
  paretoFront(CURRENT.filter((p) => sel.has(p.label))).front.map(
    (p) => p.label,
  );
const vonPreset = (id: PresetId) => new Set(presetModels(id, CURRENT));
const nurLabs = (...labs: Lab[]) =>
  labs.reduce<ModelSet>((s, l) => toggleLab(s, l, CURRENT), new Set<string>());

describe("labOf()", () => {
  it("ordnet jedes gezeigte Modell einem Lab zu, keines landet in „Andere“", () => {
    expect(CURRENT.map((p) => labOf(p.label))).not.toContain("Andere");
  });

  it("erkennt die vier Präfixe, die man sonst falsch rät", () => {
    // Aus der Zuordnung des Boards (`stats-*.js`, Funktion B()).
    expect(labOf("muse-spark-1.2")).toBe("Meta");
    expect(labOf("glm-5.3-flash")).toBe("Zhipu");
    expect(labOf("mimo-v2.5-pro")).toBe("Xiaomi");
    expect(labOf("composer-2.5")).toBe("Cursor");
  });
});

describe("Werkzeug-Kataloge", () => {
  // Die Listen gelten für beide Datenquellen (DeepSWE und Artificial Analysis):
  // gleiche Bezeichnung, gleiches Modell, ein Abrufdatum je Werkzeug.
  it("nennt nur Modelle, die eine der Ansichten auch zeichnet", () => {
    const gezeigt = new Set([...CURRENT, ...AA_COST].map((p) => p.label));
    for (const t of TOOLS)
      for (const m of t.models)
        expect(gezeigt.has(m), `${t.label}: ${m} steht nicht im Chart`).toBe(
          true,
        );
  });

  it("führt Quelle und Abrufdatum je Werkzeug", () => {
    for (const t of TOOLS) {
      expect(t.source).toMatch(/^https:\/\//);
      expect(t.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.caveat.length).toBeGreaterThan(20);
    }
  });
});

// Das hier ist der Grund für das ganze Datenmodell. Ein Preset schreibt eine
// MODELLMENGE. Würde es stattdessen nur Lab-Häkchen setzen, bekäme JetBrains AI
// das Google-Lab vollständig — und damit gemini-3.8-flash, das der Katalog
// (Gemini nur bis 3.6 Flash) gar nicht führt. Seine Front wäre dann die von
// „Alle", und die Aussage der Folie wäre still weg. Bricht dieser Test, hat
// jemand genau das vereinfacht.
describe("Presets schreiben Modellmengen, keine Lab-Häkchen", () => {
  const jb = vonPreset("jetbrains-ai");
  const labsVonJb = [...new Set([...jb].map(labOf))];

  it("lässt gemini-3.8-flash bei JetBrains AI draußen, obwohl Google dabei ist", () => {
    expect(labsVonJb).toContain("Google");
    expect(jb.has("gemini-3.8-flash")).toBe(false);
    // Über die Labs gerechnet käme es fälschlich herein:
    expect(front(nurLabs(...labsVonJb))).toContain("gemini-3.8-flash");
  });

  // OpenAI ist bei JetBrains nur teilweise abgedeckt: gpt-6-astra steht nicht
  // in der Hilfe „Supported models“ (Stand 14.09.2026).
  it("deckt zwei Labs bei JetBrains AI nur teilweise ab", () => {
    const teil = labRows(jb, CURRENT)
      .filter((r) => r.zustand === "teilweise")
      .map((r) => `${r.lab} ${r.drin}/${r.gesamt}`);
    expect(teil).toStrictEqual(["OpenAI 4/5", "Google 2/4"]);
  });
});

describe("Front je Preset", () => {
  it("zeigt ungefiltert drei Punkte", () => {
    expect(front(vonPreset("all"))).toStrictEqual([
      "glm-5.3-flash",
      "gpt-5.6-luna",
      "gemini-3.8-flash",
    ]);
  });

  // Seit dem 29.09.2026 (Katalog-Stand) führen beide Werkzeuge alle drei
  // Frontpunkte: Cursor hat glm-5.3-flash hinter „Hidden by default“, Windsurf
  // hat Gemini 3.7/3.8 Flash und GPT-6. Vorher — am 03.09. — hatte Windsurf
  // noch die alte Front mit Opus 5 an der Spitze.
  it.each(["cursor", "windsurf"] as const)(
    "gibt einem %s-Nutzer dieselbe Leiter wie „Alle“",
    (id) => {
      expect(front(vonPreset(id))).toStrictEqual(front(vonPreset("all")));
    },
  );

  it("gibt einem JetBrains-Nutzer die Front mit Opus 5 an der Spitze", () => {
    expect(front(vonPreset("jetbrains-ai"))).toStrictEqual([
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "claude-opus-5",
    ]);
    // Derselbe Score wie der Neuzugang, das Vier- bis Fünffache.
    const neu = CURRENT.find((p) => p.label === "gemini-3.8-flash")!;
    const opus = CURRENT.find((p) => p.label === "claude-opus-5")!;
    expect(neu.y).toBe(opus.y);
    expect(opus.x / neu.x).toBeGreaterThan(4.9);
  });

  it("führt JetBrains AI je Modell, nicht mehr auf Providerebene", () => {
    const jb = vonPreset("jetbrains-ai");
    expect(jb.size).toBe(10);
    expect(new Set([...jb].map(labOf))).toStrictEqual(
      new Set(["OpenAI", "Anthropic", "Google"]),
    );
  });
});

// Wofür der Umbau auf Checkboxen gemacht ist: einzeln sind die Labs nichts,
// kombiniert werden sie zur Aussage.
describe("Labs kombinieren", () => {
  it("macht aus zwei mageren Fronten eine brauchbare", () => {
    expect(front(nurLabs("Anthropic"))).toStrictEqual(["claude-opus-5"]);
    expect(front(nurLabs("OpenAI"))).toStrictEqual([
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "gpt-6-astra",
    ]);
    // Zusammen — der realistische Fall „bei uns sind beide freigegeben":
    // Seit gpt-6-astra bringt Anthropic hier NICHTS mehr ein: astra erreicht
    // denselben gerundeten Score wie Opus 5 fuer 5,71 € statt 10,37 €, und
    // damit faellt der einzige Anthropic-Punkt von der kombinierten Front.
    // Das ist keine Nebensache fuer die Folie — es ist der einzige Fall im
    // Filter, in dem ein zusaetzliches Lab die Front NICHT verbessert.
    expect(front(nurLabs("OpenAI", "Anthropic"))).toStrictEqual(
      front(nurLabs("OpenAI")),
    );
  });

  it("füllt ein teilweise enthaltenes Lab auf und leert ein volles", () => {
    const jb = vonPreset("jetbrains-ai");
    const zustand = (s: ModelSet, l: Lab) =>
      labRows(s, CURRENT).find((r) => r.lab === l)!.zustand;

    expect(zustand(jb, "Google")).toBe("teilweise");
    const voll = toggleLab(jb, "Google", CURRENT);
    expect(zustand(voll, "Google")).toBe("an");
    expect(voll.has("gemini-3.8-flash")).toBe(true);

    const leer = toggleLab(voll, "Google", CURRENT);
    expect(zustand(leer, "Google")).toBe("aus");
    expect([...leer].some((m) => labOf(m) === "Google")).toBe(false);
  });

  it("verlässt den Werkzeug-Blick sichtbar, sobald ein Lab dazukommt", () => {
    const jb = vonPreset("jetbrains-ai");
    expect(matchingPreset(jb, CURRENT)?.id).toBe("jetbrains-ai");
    expect(
      matchingPreset(toggleLab(jb, "Google", CURRENT), CURRENT),
    ).toBeUndefined();
  });
});

describe("Menü-Einträge", () => {
  it("führt „Alle“ und die drei Werkzeuge als Presets", () => {
    expect(PRESETS.map((p) => p.id)).toStrictEqual([
      "all",
      "cursor",
      "windsurf",
      "jetbrains-ai",
    ]);
  });

  it("sortiert Labs nach Modellzahl, dann alphabetisch", () => {
    const alle = vonPreset("all");
    expect(labRows(alle, CURRENT).map((r) => [r.lab, r.gesamt])).toStrictEqual([
      ["OpenAI", 5],
      ["Anthropic", 4],
      ["Google", 4],
      ["Zhipu", 3],
      ["DeepSeek", 2],
      ["Alibaba", 1],
      ["Meta", 1],
      ["Moonshot", 1],
      ["xAI", 1],
    ]);
    expect(labRows(alle, CURRENT).every((r) => r.zustand === "an")).toBe(true);
  });

  it("kennt für jedes Werkzeug die Zugehörigkeit einzelner Modelle", () => {
    expect(toolHas("jetbrains-ai", "gemini-3.6-flash")).toBe(true);
    expect(toolHas("jetbrains-ai", "gemini-3.8-flash")).toBe(false);
    expect(toolHas("windsurf", "gemini-3.8-flash")).toBe(true);
    expect(toolHas("cursor", "glm-5.3-flash")).toBe(true);
    expect(toolHas("cursor", "gpt-6-astra")).toBe(false);
    expect(toolHas("windsurf", "gpt-6-astra")).toBe(true);
    expect(toolHas("windsurf", "claude-sonnet-5.5")).toBe(false);
    expect(toolHas("jetbrains-ai", "claude-opus-5.5")).toBe(false);
  });
});
