// Die erwarteten Zahlen stammen aus dem Entwurf (Spec ToolLoop, Abschnitt 3
// und 6) und von der Folie „Ein Bugfix, Token für Token“, nicht aus der
// Ausgabe des geprüften Codes.
import { describe, expect, it } from "vitest";
import {
  EVENTS,
  LAST,
  evIndex,
  highlightJson,
  inputSumAt,
  requestsAt,
  richParts,
  stepTitle,
  total,
  ROUNDS,
  viewForClicks,
  wireFor,
} from "../toolLoopLogic";

describe("Zeitleiste", () => {
  it("hat 13 Ereignisse, das letzte ist die Antwort", () => {
    expect(EVENTS).toHaveLength(13);
    expect(LAST).toBe(12);
    expect(EVENTS[LAST]).toEqual({ kind: "final", r: 3 });
  });

  it("legt req/use/res je Runde in die erwartete Reihenfolge", () => {
    expect(evIndex("req", 0)).toBe(2);
    expect(evIndex("use", 0)).toBe(3);
    expect(evIndex("res", 0)).toBe(4);
    expect(evIndex("req", 1)).toBe(5);
    expect(evIndex("use", 2)).toBe(9);
    expect(evIndex("res", 2)).toBe(10);
    expect(evIndex("req", 3)).toBe(11);
    expect(evIndex("final", 3)).toBe(12);
  });
});

describe("Zähler", () => {
  it("Balkensummen: 4.200, 11.300, 17.400, 20.950", () => {
    expect(ROUNDS.map(total)).toEqual([4200, 11300, 17400, 20950]);
  });

  it("Requests und laufende Summe: 4.200 → 15.500 → 32.900 → 53.850", () => {
    expect(requestsAt(0)).toBe(0);
    expect(requestsAt(1)).toBe(0);
    expect(inputSumAt(1)).toBe(0);
    expect(inputSumAt(2)).toBe(4200);
    expect(inputSumAt(4)).toBe(4200);
    expect(inputSumAt(5)).toBe(15500);
    expect(inputSumAt(8)).toBe(32900);
    expect(inputSumAt(11)).toBe(53850);
    expect(inputSumAt(LAST)).toBe(53850);
    expect(requestsAt(LAST)).toBe(4);
  });
});

describe("Klick-Übergänge", () => {
  it("Klick 0: Ruhezustand", () => {
    expect(viewForClicks(0, 1, false)).toEqual({
      ev: 0,
      cost: false,
      autoplay: false,
    });
  });

  it("Klick 1 vorwärts von 0: Autoplay, außer bei reduzierter Bewegung", () => {
    expect(viewForClicks(1, 0, false)).toEqual({
      ev: 0,
      cost: false,
      autoplay: true,
    });
    expect(viewForClicks(1, 0, true)).toEqual({
      ev: LAST,
      cost: false,
      autoplay: false,
    });
  });

  it("Klick 1 rückwärts von 2 oder beim Eintritt: Endzustand ohne Kosten", () => {
    expect(viewForClicks(1, 2, false)).toEqual({
      ev: LAST,
      cost: false,
      autoplay: false,
    });
    expect(viewForClicks(1, null, false).autoplay).toBe(false);
  });

  it("Klick 2: Kostenansicht, auch beim Sprung von 0", () => {
    expect(viewForClicks(2, 1, false)).toEqual({
      ev: LAST,
      cost: true,
      autoplay: false,
    });
    expect(viewForClicks(2, 0, false).autoplay).toBe(false);
  });
});

describe("richParts", () => {
  it("trennt <b> und <code> vom Fließtext", () => {
    expect(richParts("a <b>x</b> b <code>y</code>")).toEqual([
      { tag: null, text: "a " },
      { tag: "b", text: "x" },
      { tag: null, text: " b " },
      { tag: "code", text: "y" },
    ]);
  });
  it("lässt Text ohne Tags unverändert", () => {
    expect(richParts("nur Text")).toEqual([{ tag: null, text: "nur Text" }]);
  });
});

describe("highlightJson", () => {
  it("färbt Schlüssel, Strings und die Anmerkung", () => {
    const tokens = highlightJson('{ "a": "b" }  ← wächst');
    expect(tokens.filter((x) => x.cls === "k").map((x) => x.text)).toEqual([
      '"a"',
    ]);
    expect(tokens.filter((x) => x.cls === "s").map((x) => x.text)).toEqual([
      '"b"',
    ]);
    expect(tokens.filter((x) => x.cls === "c").map((x) => x.text)).toEqual([
      "← wächst",
    ]);
  });

  it("verliert beim Zerlegen keine Zeichen", () => {
    const src = wireFor(11, "local")!.json;
    expect(
      highlightJson(src)
        .map((x) => x.text)
        .join(""),
    ).toBe(src);
  });

  it("behandelt Escapes in Strings als Teil des Strings", () => {
    const tokens = highlightJson('"a\\"b"');
    expect(tokens).toEqual([{ cls: "s", text: '"a\\"b"' }]);
  });
});

describe("Detail-Panel", () => {
  it("Ruhezustand hat kein Panel", () => {
    expect(wireFor(0, "local")).toBeNull();
  });

  it("Request 1 trägt das tools-Array und die 4.200 Tokens", () => {
    const w = wireFor(2, "local")!;
    expect(w.dir).toBe("Harness → Modell · Request 1");
    expect(w.json).toContain('"tools"');
    expect(w.json).toContain("[ … 1 … ]");
    expect(w.json).toContain("~4.200 Tokens");
  });

  it("Request 4 zählt 7 messages und 20.950 Tokens", () => {
    const w = wireFor(11, "local")!;
    expect(w.json).toContain("[ … 7 … ]");
    expect(w.json).toContain("~20.950 Tokens");
  });

  it("Variante MCP tauscht nur die ersten beiden Tool-Aufrufe", () => {
    expect(wireFor(3, "local")!.json).toContain('"name": "Read"');
    expect(wireFor(3, "mcp")!.json).toContain(
      '"name": "mcp__github__get_file_contents"',
    );
    expect(wireFor(9, "mcp")!.json).toContain('"name": "Edit"');
    expect(wireFor(9, "mcp")!.json).toBe(wireFor(9, "local")!.json);
  });

  it("tool_result verweist auf die id des tool_use derselben Runde", () => {
    for (const [use, res] of [
      [3, 4],
      [6, 7],
      [9, 10],
    ] as const) {
      const id = /"id": "(toolu_\d+)"/.exec(wireFor(use, "local")!.json)![1];
      expect(wireFor(res, "local")!.json).toContain(`"tool_use_id": "${id}"`);
    }
  });
});

describe("Schritttitel", () => {
  it("nennt die Request-Nummer", () => {
    expect(stepTitle(5)).toBe("Request 2: Modell liest den Kontext");
    expect(stepTitle(0)).toBe("Der User tippt seine Frage");
  });
});
