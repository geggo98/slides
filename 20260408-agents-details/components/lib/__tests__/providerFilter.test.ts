import { describe, expect, it } from "vitest";
import { CURRENT, labOf, paretoFront } from "../../paretoData";
import {
  TOOLS,
  memberOf,
  optionsFor,
  type Selection,
} from "../../providerFilter";

// Der Filter behauptet auf der Folie eine konkrete Sache: Für einen
// Windsurf-Nutzer sieht die Front anders aus als für einen Cursor-Nutzer. Das
// ist keine Meinung, sondern folgt aus zwei Modell-Listen — und die veralten.
// Bricht einer dieser Tests, hat ein Anbieter seinen Katalog geändert und die
// Aussage der Folie muss nachgezogen werden, statt still falsch zu werden.

const frontOf = (sel: Selection) =>
  paretoFront(CURRENT.filter((p) => memberOf(sel, p.label))).front.map(
    (p) => p.label,
  );

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

  it("verteilt die 21 Punkte auf neun Labs", () => {
    const { labs } = optionsFor(CURRENT);
    expect(labs.map((l) => [l.label, l.count])).toStrictEqual([
      ["Anthropic", 4],
      ["Google", 4],
      ["OpenAI", 4],
      ["Zhipu", 3],
      ["DeepSeek", 2],
      ["Alibaba", 1],
      ["Meta", 1],
      ["Moonshot", 1],
      ["xAI", 1],
    ]);
  });
});

describe("Werkzeug-Kataloge", () => {
  it("nennt nur Modelle, die dieses Chart auch zeichnet", () => {
    const gezeigt = new Set(CURRENT.map((p) => p.label));
    for (const t of TOOLS)
      for (const m of t.models ?? [])
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

describe("Front je Auswahl", () => {
  it("zeigt ungefiltert drei Punkte", () => {
    expect(frontOf("all")).toStrictEqual([
      "glm-5.3-flash",
      "gpt-5.6-luna",
      "gemini-3.8-flash",
    ]);
  });

  // Der Kern der Folie: dasselbe Board, dieselbe Woche, zwei Werkzeuge, zwei
  // völlig verschiedene Antworten. Windsurfs Katalog endet bei Gemini 3.6
  // Flash, deshalb gilt dort weiter die Front von vorletzter Woche.
  it("gibt einem Windsurf-Nutzer noch die alte Front mit Opus 5 an der Spitze", () => {
    expect(frontOf("windsurf")).toStrictEqual([
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "claude-opus-5",
    ]);
  });

  it("gibt einem Cursor-Nutzer denselben Score für ein Fünftel", () => {
    expect(frontOf("cursor")).toStrictEqual([
      "gpt-5.6-luna",
      "gemini-3.8-flash",
    ]);
    const front = paretoFront(
      CURRENT.filter((p) => memberOf("cursor", p.label)),
    ).front;
    const spitze = front.at(-1)!;
    const opus = CURRENT.find((p) => p.label === "claude-opus-5")!;
    expect(spitze.y).toBe(opus.y);
    expect(opus.x / spitze.x).toBeGreaterThan(4.9);
  });

  it("behandelt JetBrains AI auf Providerebene", () => {
    expect(frontOf("jetbrains-ai")).toStrictEqual([
      "gpt-5.6-luna",
      "gemini-3.8-flash",
    ]);
    // Obergrenze: alles von OpenAI, Anthropic, Google und xAI, sonst nichts.
    const drin = CURRENT.filter((p) => memberOf("jetbrains-ai", p.label));
    expect(new Set(drin.map((p) => labOf(p.label)))).toStrictEqual(
      new Set(["OpenAI", "Anthropic", "Google", "xAI"]),
    );
  });

  // Wer an einen einzigen Anbieter gebunden ist, hat keine Kurve mehr.
  it("lässt Anthropic mit einem einzigen Frontpunkt zurück", () => {
    expect(frontOf("Anthropic")).toStrictEqual(["claude-opus-5"]);
  });
});
