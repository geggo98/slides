import { describe, expect, it } from "vitest";
import {
  type AaRecord,
  FELDER,
  feldZaehler,
  parseModels,
  pruefeFelder,
  vergibSlugs,
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

  it("liest die Form vom 16.11.2026: kein `slug`, nur `release.slug` und `suffix`", () => {
    const neu = (
      release: string,
      name: string,
      suffix: string | null,
      index: number,
    ) => ({
      id: `id-${name}`,
      release: { slug: release, name: release },
      name,
      suffix,
      deprecated: false,
      intelligenceIndex: index,
      intelligenceIndexCostPerTask: 1,
      outputSpeed: 100,
    });
    const body = `22:{"initialModels":${JSON.stringify([
      neu(
        "claude-x",
        "Claude X (Max, Default Fallback)",
        "Max, Default Fallback",
        59,
      ),
      neu(
        "claude-x",
        "Claude X (Low, Default Fallback)",
        "Low, Default Fallback",
        35,
      ),
      neu("ling-3-1-flash-1001", "Ling 3.1 Flash", null, 20),
      neu("gem-y", "Gem Y (High)", "High", 50),
    ])}}`;
    // „Ling 3.1 Flash“ kennt das Archiv unter einem Slug, der nicht der
    // Release-Slug ist; „Gem Y (High)“ unter dem Release-Slug selbst.
    const bekannt = new Map([
      ["Ling 3.1 Flash", "ling-3-1-flash"],
      ["Gem Y (High)", "gem-y"],
    ]);
    const ms = parseModels(seite(body), bekannt);
    expect(ms.map((m) => m.slug)).toStrictEqual([
      "claude-x",
      "claude-x-low",
      "gem-y",
      "ling-3-1-flash",
    ]);
    expect(Object.keys(ms[0]!)).toStrictEqual([...FELDER]);
    // Ohne Archiv: die Regel — Release-Slug für Max und stufenlose Namen,
    // `-<stufe>` sonst. „Gem Y (High)“ bekommt `gem-y-high`.
    expect(parseModels(seite(body)).map((m) => m.slug)).toStrictEqual([
      "claude-x",
      "claude-x-low",
      "gem-y-high",
      "ling-3-1-flash-1001",
    ]);
  });

  it("gibt ohne Kennzahlen-Liste nichts zurück statt der Stubs", () => {
    const body = `24:{"models":${JSON.stringify([stub("a"), stub("b")])}}`;
    expect(parseModels(seite(body))).toStrictEqual([]);
  });
});

describe("vergibSlugs", () => {
  const rec = (release: string, name: string, suffix: string | null) => ({
    release: { slug: release },
    name,
    suffix,
  });

  it("behält den Slug aus dem Archiv, auch wenn er von release.slug abweicht", () => {
    const slugs = vergibSlugs(
      [rec("nova-2-0-pro-preview", "Nova 2.0 Pro Preview (Low)", "Low")],
      new Map([["Nova 2.0 Pro Preview (Low)", "nova-2-0-pro-reasoning-low"]]),
    );
    expect(slugs).toStrictEqual(["nova-2-0-pro-reasoning-low"]);
  });

  it("weicht aus, wenn der Release-Slug schon an eine bekannte Stufe vergeben ist", () => {
    // Argon führte bisher nur die High-Stufe, und der Archiv-Slug dafür ist der
    // Release-Slug. Kommt die Max-Stufe dazu, darf sie ihn nicht doppelt tragen.
    const slugs = vergibSlugs(
      [
        rec("gem-argon", "Gem Argon (High)", "High"),
        rec("gem-argon", "Gem Argon (Max)", "Max"),
      ],
      new Map([["Gem Argon (High)", "gem-argon"]]),
    );
    expect(slugs).toStrictEqual(["gem-argon", "gem-argon-max"]);
  });

  it("nimmt „Reasoning“ als Hauptfall und hängt „Non-reasoning“ an", () => {
    const slugs = vergibSlugs(
      [
        rec("m", "M (Reasoning)", "Reasoning"),
        rec("m", "M (Non-reasoning)", "Non-reasoning"),
      ],
      new Map(),
    );
    expect(slugs).toStrictEqual(["m", "m-non-reasoning"]);
  });

  it("überspringt Zusätze, die keine Stufe sind", () => {
    expect(
      vergibSlugs(
        [rec("g", "G (Daybreak Blue, max)", "Daybreak Blue, max")],
        new Map(),
      ),
    ).toStrictEqual(["g"]);
  });

  it("bricht ab statt zu raten: ohne Schlüssel, bei doppeltem Archiv-Slug und ohne freien Slug", () => {
    expect(() => vergibSlugs([{ name: "X" }], new Map())).toThrow(
      /ohne slug und ohne release\.slug: X/,
    );
    expect(() =>
      vergibSlugs(
        [rec("r", "A", null), rec("r", "B", null)],
        new Map([
          ["A", "s"],
          ["B", "s"],
        ]),
      ),
    ).toThrow(/Slug doppelt: s/);
    // Zwei stufenlose Namen auf demselben Release: der zweite fällt auf den
    // Slug seines Namens zurück, statt den ersten zu überschreiben.
    expect(
      vergibSlugs([rec("r", "Eins", null), rec("r", "Zwei", null)], new Map()),
    ).toStrictEqual(["r", "zwei"]);
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
