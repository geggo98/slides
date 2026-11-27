// Goldene Tests: der Live-Nachlauf muss parse_list, apply_delta, compact_message,
// test_message und die Request-Bodies des ORIGINAL-Runners von Studie 9 Byte für
// Byte erreichen.
//
// Woher die Erwartungswerte stammen: aus `data/erosion/golden-live.json`. Die Datei
// erzeugt `data/erosion/golden-live-gen.py` mit dem Original-`run.py` (Repository
// context-rot-experiments, Commit 7e5e7c7) und dessen Datenbank. Dort stehen zuerst
// Gegenproben: die Original-Funktionen müssen jede gespeicherte Liste und jeden
// gespeicherten Prompt aus der Datenbank reproduzieren. Kein Wert hier stammt aus
// dem TypeScript-Code.
import { describe, expect, it } from "vitest";
import golden from "../../../data/erosion/golden-live.json";
import {
  parseRewrite,
  rewriteBody,
  roundPrompt,
  testBody,
  testPrompt,
  type Item,
} from "../erosionLiveLogic";
import type { Arm } from "../erosionChainLogic";

interface ParseCase {
  source: string;
  arm: Arm;
  prev: Item[];
  raw: string;
  items: Item[];
  ok: 0 | 1;
  note: string;
}
const G = golden as unknown as {
  parse: ParseCase[];
  compact: {
    arm: Arm;
    items: Item[];
    pieces: string[];
    message: string;
  }[];
  realCompact: {
    arm: Arm;
    chain: string;
    round: number;
    items: Item[];
    pieces: string[];
    body: Record<string, unknown> & {
      model: string;
      messages: { content: string }[];
    };
  }[];
  realTest: {
    arm: Arm;
    chain: string;
    site: string;
    items: Item[];
    prefix: string;
    body: Record<string, unknown> & {
      model: string;
      messages: { content: string }[];
    };
  }[];
  originalTest: {
    items: Item[];
    prefix: string;
    body: Record<string, unknown> & {
      model: string;
      messages: { content: string }[];
    };
  };
};

describe("Golden: parse_list und apply_delta", () => {
  it("deckt alle Arme, ok = 0 und Hinweise zu unbekannten Ids ab", () => {
    // Schutz vor einer leeren oder zu schmalen Fixture-Datei
    expect(G.parse.length).toBeGreaterThanOrEqual(40);
    expect(new Set(G.parse.map((c) => c.arm))).toEqual(
      new Set(["F", "C", "D", "N"]),
    );
    expect(G.parse.some((c) => c.ok === 0)).toBe(true);
    expect(G.parse.some((c) => c.note.startsWith("unknown ids"))).toBe(true);
  });
  for (const [i, c] of G.parse.entries()) {
    it(`#${i} ${c.source} (${c.arm})`, () => {
      const r = parseRewrite(c.arm, c.raw, c.prev);
      expect(r.items).toEqual(c.items);
      expect(r.ok ? 1 : 0).toBe(c.ok);
      expect(r.note).toBe(c.note);
    });
  }
});

describe("Golden: compact_message", () => {
  for (const [i, c] of G.compact.entries()) {
    it(`#${i} Arm ${c.arm}, ${c.items.length} Regeln`, () => {
      expect(roundPrompt(c.arm, c.items, c.pieces)).toBe(c.message);
    });
  }
  for (const c of G.realCompact) {
    it(`echte Anfrage ${c.chain} Runde ${c.round}: Prompt und Body`, () => {
      const user = roundPrompt(c.arm, c.items, c.pieces);
      expect(user).toBe(c.body.messages[1]!.content);
      expect(
        rewriteBody("openai", c.body.model, user, c.round, { flex: true }),
      ).toEqual(c.body);
    });
  }
});

describe("Golden: test_message und Test-Body", () => {
  for (const c of G.realTest) {
    it(`echte Anfrage ${c.chain} ${c.site}`, () => {
      const user = testPrompt(c.items, c.prefix);
      expect(user).toBe(c.body.messages[1]!.content);
      expect(testBody("openai", c.body.model, user, { flex: true })).toEqual(
        c.body,
      );
    });
  }
  it("Originalliste O", () => {
    const o = G.originalTest;
    const user = testPrompt(o.items, o.prefix);
    expect(user).toBe(o.body.messages[1]!.content);
    expect(testBody("openai", o.body.model, user, { flex: true })).toEqual(
      o.body,
    );
  });
});
