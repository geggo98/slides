import { describe, expect, it } from "vitest";
import { CATEGORY, parseBoard } from "../../../data/designarena/fetch";

// `fetch.ts` liest das Board aus der RSC-Payload der Leaderboard-Seite. Wie bei
// AA (`aaFetch.test.ts`) mit nachgebauten Payloads statt einer gespeicherten
// Seite: Ändert DesignArena die Form, soll der Wochenlauf laut scheitern und
// nicht ein leeres Board archivieren.

/** Eine Seite, deren Payload `body` ist — in zwei `__next_f`-Stücken wie echt. */
const seite = (body: string): string => {
  const mitte = Math.floor(body.length / 2);
  const stueck = (s: string) =>
    `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`;
  return `<html><body>${stueck(body.slice(0, mitte))}${stueck(body.slice(mitte))}</body></html>`;
};

const seed = (category: string) => ({
  seed: {
    boards: [
      {
        arenaType: "agents",
        category,
        variationName: "public",
        inputModality: "$undefined",
        data: [
          {
            modelId: "zeta",
            wins: 10,
            losses: 5,
            battles: 15,
            winRate: 66.7,
            elo: 1300,
            btStdErr: null,
            avgGenerationTimeMs: 120000,
          },
          {
            modelId: "hampshire",
            wins: 5,
            losses: 10,
            battles: 15,
            winRate: 33.3,
            elo: 1100,
            btStdErr: null,
            avgGenerationTimeMs: null,
          },
        ],
        metadata: { lastUpdateTime: "2026-10-31T08:00:00Z", totalVotes: 30 },
      },
    ],
    subcategoryBoards: [],
    registry: {
      models: {
        zeta: { id: "zeta", displayName: "Zeta 1 (max)", provider: "z" },
        hampshire: {
          id: "hampshire",
          displayName: "MiMo-V2.6-Pro",
          provider: "xiaomi",
          openSource: true,
        },
      },
      providers: {},
      pricing: {
        zeta: { text: { input: 2, output: 10, cachedInput: 0.2 } },
      },
    },
  },
});

describe("parseBoard", () => {
  it("liest Board, Namen und Preise und sortiert nach modelId", () => {
    const body = `1e:["$","$L3a",null,${JSON.stringify(seed(CATEGORY))}]`;
    const b = parseBoard(seite(body));
    expect(b.category).toBe(CATEGORY);
    expect(b.totalVotes).toBe(30);
    expect(b.models.map((m) => m.modelId)).toStrictEqual(["hampshire", "zeta"]);
    const [h, z] = b.models;
    // Codename → Anzeigename; fehlender Preis wird null, nicht 0.
    expect(h!.displayName).toBe("MiMo-V2.6-Pro");
    expect(h!.priceInput).toBeNull();
    expect(h!.avgGenerationTimeMs).toBeNull();
    expect(z).toMatchObject({
      elo: 1300,
      priceInput: 2,
      priceOutput: 10,
      avgGenerationTimeMs: 120000,
      openSource: null,
    });
  });

  it("wirft, wenn das Board fehlt, statt ein leeres zu liefern", () => {
    const body = `1e:${JSON.stringify(seed("overall-website"))}`;
    expect(() => parseBoard(seite(body))).toThrow(CATEGORY);
  });

  it("übergeht eine Zeile ohne Elo, statt sie als 0 zu lesen", () => {
    const s = seed(CATEGORY);
    const zeilen = s.seed.boards[0]!.data as Record<string, unknown>[];
    zeilen.push({ ...zeilen[0]!, modelId: "ohne", elo: null });
    const b = parseBoard(seite(`1:${JSON.stringify(s)}`));
    expect(b.models.map((m) => m.modelId)).toStrictEqual(["hampshire", "zeta"]);
  });

  it("wirft, wenn vielen Zeilen der Elo fehlt (Format geändert)", () => {
    const s = seed(CATEGORY);
    const zeilen = s.seed.boards[0]!.data as Record<string, unknown>[];
    for (let i = 0; i < 4; i++)
      zeilen.push({ ...zeilen[0]!, modelId: `x${i}`, elo: "$undefined" });
    expect(() => parseBoard(seite(`1:${JSON.stringify(s)}`))).toThrow(
      "ohne Elo",
    );
  });

  it("wirft ohne seed-Objekt", () => {
    expect(() => parseBoard(seite(`1:{"x":1}`))).toThrow("seed");
  });
});
