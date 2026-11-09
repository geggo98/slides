import { describe, expect, it } from "vitest";
import {
  type AaRecord,
  FELDER,
  feldZaehler,
  parseModels,
  pruefeFelder,
} from "../../../data/artificialanalysis/fetch";

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
  outputSpeed: "$undefined",
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
    expect(ms[1]!.outputSpeed).toBeNull();
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

// Am 09.11.2026 hatte AA die Tempo-Felder umbenannt (`medianOutputTokensPerSecond`
// → `outputSpeed`). Der Abruf meldete trotzdem „neu: … 282 Modelle“ und schrieb
// einen Snapshot ohne einen einzigen Tempo-Wert. `pruefeFelder()` macht daraus
// einen Abbruch.
describe("pruefeFelder", () => {
  /** Ein vollständiger Datensatz in der Form von `parseModels()`. */
  const rec = (slug: string, tps: number | null): AaRecord =>
    Object.fromEntries(
      FELDER.map((k) => [
        k,
        k === "slug" ? slug : k === "outputSpeed" ? tps : 1,
      ]),
    ) as AaRecord;
  const zehn = (tps: (i: number) => number | null) =>
    Array.from({ length: 10 }, (_, i) => rec(`m${i}`, tps(i)));

  it("lässt einen vollständigen Stand durch, auch ohne Vorgänger", () => {
    const ms = zehn(() => 100);
    expect(() => pruefeFelder(ms, null)).not.toThrow();
    expect(() => pruefeFelder(ms, ms)).not.toThrow();
  });

  it("scheitert, wenn ein Feld in keinem Datensatz steht, und nennt den Zähler", () => {
    expect(() =>
      pruefeFelder(
        zehn(() => null),
        null,
      ),
    ).toThrow(/outputSpeed: 0 von 10/);
  });

  it("scheitert unter der Hälfte des Vorgängers — gezählt unter dem alten Namen", () => {
    // Vorgänger im Format bis 02.11.2026: 10 von 10 mit Median-Tempo.
    const alt = zehn(() => 1).map(({ outputSpeed: _o, ...r }) => ({
      ...r,
      medianOutputTokensPerSecond: 100,
    }));
    expect(() =>
      pruefeFelder(
        zehn((i) => (i < 4 ? 100 : null)),
        alt,
      ),
    ).toThrow(
      /outputSpeed: 4 von 10 \(Vorgänger: 10 mit medianOutputTokensPerSecond\)/,
    );
    expect(() =>
      pruefeFelder(
        zehn((i) => (i < 5 ? 100 : null)),
        alt,
      ),
    ).not.toThrow();
  });

  it("zählt null nicht als Wert", () => {
    expect(feldZaehler([{ a: null }, { a: 0 }, {}], ["a"])).toStrictEqual({
      a: 1,
    });
  });
});
