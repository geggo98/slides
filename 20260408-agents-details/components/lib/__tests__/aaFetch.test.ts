import { describe, expect, it } from "vitest";
import { FELDER, parseModels } from "../../../data/artificialanalysis/fetch";

// `fetch.ts` liest die Modell-Liste aus der RSC-Payload der Leaderboard-Seite.
// Die Seite hat ihre Form schon einmal geändert (Ende Oktober 2026: `models` →
// `initialModels`), und der Fehler zeigte sich als „0 Modelle“ in der
// Cloud-Routine. Diese Tests halten beide Formen fest, mit nachgebauten
// Payloads statt einer gespeicherten Seite.

/** Eine Seite, deren Payload `body` ist — in zwei `__next_f`-Stücken wie echt. */
const seite = (body: string): string => {
  const mitte = Math.floor(body.length / 2);
  const stueck = (s: string) =>
    `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`;
  return `<html><body>${stueck(body.slice(0, mitte))}${stueck(body.slice(mitte))}</body></html>`;
};

const stub = (slug: string) => ({ slug, name: slug.toUpperCase() });
const voll = (slug: string, index: number | "$undefined", cost: number) => ({
  slug,
  name: slug.toUpperCase(),
  deprecated: false,
  intelligenceIndex: index,
  intelligenceIndexCostPerTask: cost,
  medianOutputTokensPerSecond: "$undefined",
  scores: { "frontiercode-2-0": 0.1 },
});

describe("parseModels", () => {
  it("liest die alte Form: Stub-`models` und Voll-`models`", () => {
    const body =
      `22:{"models":${JSON.stringify([stub("a"), stub("b"), stub("c")])}}` +
      `23:{"models":${JSON.stringify([voll("b", 50, 1), voll("a", 40, 2)])}}`;
    const ms = parseModels(seite(body));
    expect(ms.map((m) => m.slug)).toStrictEqual(["a", "b"]);
  });

  it("liest die neue Form: Stub-`models` und `initialModels` mit Kennzahlen", () => {
    const body =
      `22:["$","$L23",null,{"initialModels":${JSON.stringify([voll("z", 30, 1), voll("y", "$undefined", 2)])},"manifest":{"path":"/data/x.txt","key":"00"}}]` +
      `24:{"models":${JSON.stringify([stub("y"), stub("z"), stub("w")])}}`;
    const ms = parseModels(seite(body));
    expect(ms.map((m) => m.slug)).toStrictEqual(["y", "z"]);
    // RSC-Sentinel wird zu null, nicht zu einem String.
    expect(ms[0]!.intelligenceIndex).toBeNull();
    expect(ms[1]!.medianOutputTokensPerSecond).toBeNull();
    // Nur die Felder, die das Deck braucht.
    expect(Object.keys(ms[1]!)).toStrictEqual([...FELDER]);
  });

  it("nimmt bei mehreren Listen mit Kennzahlen die mit den meisten", () => {
    const body =
      `1:{"initialModels":${JSON.stringify([voll("a", 40, 1)])}}` +
      `2:{"models":${JSON.stringify([voll("a", 40, 1), voll("b", 41, 1)])}}`;
    expect(parseModels(seite(body)).map((m) => m.slug)).toStrictEqual([
      "a",
      "b",
    ]);
  });

  it("gibt ohne Kennzahlen-Liste nichts zurück statt der Stubs", () => {
    const body = `24:{"models":${JSON.stringify([stub("a"), stub("b")])}}`;
    expect(parseModels(seite(body))).toStrictEqual([]);
  });
});
