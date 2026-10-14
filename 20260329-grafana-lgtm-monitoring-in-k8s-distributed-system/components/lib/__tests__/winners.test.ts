/**
 * winners.test.ts — die Pointe der M/M/c-Folie gegen die geschlossenen Formeln
 * (`theory()` in mmc.js, Erlang C): Im Tempo-Modus gewinnt der Pool die
 * Wartezeit Wq, die Alternative (1 Koch mit cμ) die Gesamtzeit T — für jedes
 * c und ρ. Im Pooling-Modus gewinnt der Pool beides.
 */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import { theory } from "../mmc.js";
import { WinnerTracker, winner } from "../winners";

const CS = [2, 3, 6];
const RHOS = [0.3, 0.5, 0.7, 0.85, 0.95];
const MU = 1;

function grid(mode: "tempo" | "pooling") {
  return CS.flatMap((c) =>
    RHOS.map((rho) => {
      const lam = rho * c * MU;
      return {
        c,
        rho,
        alt: theory(mode, lam, MU, c),
        pool: theory("pool", lam, MU, c),
      };
    }),
  );
}

describe("Theorie: Tempo-Modus (1 Koch mit cμ vs. Pool)", () => {
  it.each(grid("tempo"))("c=$c ρ=$rho: Wq → Pool, T → Alternative", (g) => {
    expect(winner(g.alt.Wq, g.pool.Wq)).toBe("pool");
    expect(winner(g.alt.T, g.pool.T)).toBe("alt");
  });

  it("T − Wq ist die Bedienzeit: 1/(cμ) gegen 1/μ", () => {
    for (const g of grid("tempo")) {
      expect(g.alt.T - g.alt.Wq).toBeCloseTo(1 / (g.c * MU), 9);
      expect(g.pool.T - g.pool.Wq).toBeCloseTo(1 / MU, 9);
    }
  });
});

describe("Theorie: Pooling-Modus (c getrennte Schlangen vs. Pool)", () => {
  it.each(grid("pooling"))("c=$c ρ=$rho: Pool gewinnt Wq und T", (g) => {
    expect(winner(g.alt.Wq, g.pool.Wq)).toBe("pool");
    expect(winner(g.alt.T, g.pool.T)).toBe("pool");
  });
});

describe("WinnerTracker", () => {
  it("urteilt erst nach genügend Abgängen", () => {
    const w = new WinnerTracker(40);
    expect(w.update(1, 2, 39)).toBe("pending");
    expect(w.update(1, 2, 40)).toBe("alt");
  });

  it("fast gleiche Werte gelten als unentschieden", () => {
    const w = new WinnerTracker(0, 0.03, 0.08);
    expect(w.update(1.0, 1.02, 100)).toBe("tie");
  });

  it("flackert nicht, wenn Rauschen den Abstand kurz umdreht", () => {
    const w = new WinnerTracker(0, 0.03, 0.08);
    expect(w.update(1.0, 1.3, 100)).toBe("alt");
    // Pool liegt kurz 5 % vorn: unter der Wechselschwelle → bleibt „alt“.
    expect(w.update(1.05, 1.0, 101)).toBe("alt");
    expect(w.update(1.0, 1.04, 102)).toBe("alt");
    // Deutlicher Vorsprung (> 8 %) → Wechsel.
    expect(w.update(1.2, 1.0, 103)).toBe("pool");
  });

  it("reset() verwirft das Urteil", () => {
    const w = new WinnerTracker(0);
    w.update(1, 2, 10);
    w.reset();
    expect(w.verdict).toBe("pending");
  });
});
