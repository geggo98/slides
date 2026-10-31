import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { familyKey } from "../../catalogMatch";
import {
  bestPerModel,
  daLabel,
  DA_BOARD,
  DA_COST,
  DA_EXTRAS_COST,
  DA_EXTRAS_SPEED,
  DA_FLOOR,
  DA_MODELS,
  DA_NO_TIME,
  DA_SPEED,
  DA_STAND,
  mixPrice,
  type DaRow,
} from "../../daData";
import { paretoFront } from "../../paretoData";
import { VARIANTS } from "../../paretoVariants";

// Die DesignArena-Ansichten (`da-cost`, `da-speed`) und die beiden Archive, aus
// denen die Folie liest. Wie bei AA (`paretoVariants.test.ts`) sind das die
// Stellen, an denen ein stiller Fehler gut aussähe: ein halb gemachter
// Snapshot-Wechsel, eine Effort-Stufe als eigenes Modell, ein Archiv-Eintrag,
// dessen Datei fehlt oder sich verändert hat.

const DATA = join(import.meta.dirname, "../../../data");

interface Eintrag {
  file: string;
  fetched_at: string;
  sha256: string;
}
const index = (quelle: string): Eintrag[] =>
  readFileSync(join(DATA, quelle, "index.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Eintrag);

// Ein neuer Snapshot ist ein Datenwechsel an EINER Stelle (`daData.ts`: Import,
// `DA_BOARD`, `DA_STAND`). Diese Tests schlagen fehl, solange er halb gemacht
// ist — nach `fetch.ts` also so lange, bis das Deck auf dem neuen Stand steht.
describe("daData — Snapshot", () => {
  const idx = index("designarena");

  it("liest den Snapshot, den DA_BOARD nennt", () => {
    const src = readFileSync(
      join(import.meta.dirname, "../..", "daData.ts"),
      "utf8",
    );
    expect(src).toContain(`import raw from "../data/designarena/${DA_BOARD}";`);
  });

  it("steht auf dem neuesten archivierten Snapshot", () => {
    expect(DA_BOARD).toBe(idx.at(-1)!.file);
  });

  it("datiert den Stand auf den Abruf dieses Snapshots", () => {
    const e = idx.find((x) => x.file === DA_BOARD)!;
    const [y, m, d] = e.fetched_at.slice(0, 10).split("-");
    expect(DA_STAND).toBe(`${d}.${m}.${y}`);
  });
});

// Die Archive sind die Grundlage einer späteren Zeitreihe (wie DeepSWE auf der
// Historien-Folie). Das setzt voraus, dass jeder Eintrag im Index auf eine
// Datei zeigt, die noch genau den Inhalt hat, unter dem sie verbucht ist.
describe("Archive — Index und Dateien", () => {
  for (const quelle of ["artificialanalysis", "designarena"]) {
    const idx = index(quelle);

    it(`${quelle}: jede Datei existiert und hat die verbuchte sha256`, () => {
      expect(idx.length).toBeGreaterThan(0);
      for (const e of idx) {
        const pfad = join(DATA, quelle, e.file);
        expect(existsSync(pfad), e.file).toBe(true);
        const sha = createHash("sha256")
          .update(readFileSync(pfad))
          .digest("hex");
        expect(sha, e.file).toBe(e.sha256);
        expect(e.file).toContain(e.sha256.slice(0, 8));
      }
    });

    it(`${quelle}: Inhalt ist der Schlüssel, chronologisch angehängt`, () => {
      expect(new Set(idx.map((e) => e.sha256)).size).toBe(idx.length);
      const t = idx.map((e) => e.fetched_at);
      expect([...t].sort()).toStrictEqual(t);
    });
  }
});

const row = (
  displayName: string,
  elo: number,
  over: Partial<DaRow> = {},
): DaRow => ({
  modelId: displayName.toLowerCase(),
  displayName,
  provider: "x",
  elo,
  battles: 1000,
  avgGenerationTimeMs: null,
  priceInput: 1,
  priceOutput: 5,
  ...over,
});

describe("daData — Modelle und Stufen", () => {
  it("bildet Labels in AA-Schreibweise aus dem Anzeigenamen", () => {
    expect(daLabel("Claude Opus 5.5")).toBe("claude-opus-5.5");
    expect(daLabel("GPT-6 Astra (max)")).toBe("gpt-6-astra");
    expect(daLabel("MiMo-V2.6-Pro")).toBe("mimo-v2.6-pro");
  });

  it("mischt den Preis 3:1 wie die Seite", () => {
    expect(mixPrice(10, 50)).toBe(20);
    expect(mixPrice(2, 10)).toBe(4);
    expect(mixPrice(null, 10)).toBeNull();
  });

  it("nimmt je Modell die Stufe mit dem höchsten Elo, bei Gleichstand die billigere", () => {
    const ms = bestPerModel([
      row("GPT-6 Astra (xhigh)", 1303),
      row("GPT-6 Astra (max)", 1408, { priceInput: 10 }),
      row("Muse Spark 1.3 (xhigh)", 1261),
      row("Muse Spark 1.3 Max", 1281),
      row("Kimi K3 (low)", 1200, { priceInput: 2 }),
      row("Kimi K3 (high)", 1200, { priceInput: 1 }),
    ]);
    expect(ms.map((m) => [m.label, m.elo, m.usd])).toStrictEqual([
      ["gpt-6-astra", 1408, 8.75],
      ["kimi-k3", 1200, 2],
      ["muse-spark-1.3-max", 1281, 2],
    ]);
  });

  it("zählt jedes Modell einmal: ein Punkt je `familyKey`", () => {
    const keys = DA_MODELS.map((m) => familyKey(m.label));
    expect(new Set(keys).size).toBe(keys.length);
    for (const pts of [
      [...DA_COST, ...DA_EXTRAS_COST],
      [...DA_SPEED, ...DA_EXTRAS_SPEED],
    ]) {
      const ls = pts.map((p) => p.label);
      expect(new Set(ls).size).toBe(ls.length);
    }
  });

  it("legt die Böden je Ansicht: Kurator-Feld darüber, Extras darunter", () => {
    for (const p of DA_COST) expect(p.y).toBeGreaterThanOrEqual(DA_FLOOR.cost);
    for (const p of DA_EXTRAS_COST) expect(p.y).toBeLessThan(DA_FLOOR.cost);
    for (const p of DA_SPEED)
      expect(p.y).toBeGreaterThanOrEqual(DA_FLOOR.speed);
    for (const p of DA_EXTRAS_SPEED) expect(p.y).toBeLessThan(DA_FLOOR.speed);
  });

  it("nennt als ohne Zeit genau die Modelle der Preisansicht, die in der Tempoansicht fehlen", () => {
    const schnell = new Set(DA_SPEED.map((p) => p.label));
    expect(DA_NO_TIME).toStrictEqual(
      DA_COST.map((p) => p.label)
        .filter((l) => !schnell.has(l))
        .sort(),
    );
  });
});

// Die Fronten, die Lead-Text und Sprechernotizen nennen. Bewegt sich eine mit
// einem neuen Snapshot, muss der Text nach (Runbook, Schritt 5).
describe("daData — Fronten (Stand 31.10.2026)", () => {
  it("Preisansicht", () => {
    expect(paretoFront(DA_COST).front.map((p) => p.label)).toStrictEqual([
      "minimax-m3.1-flash",
      "mimo-v2.6-pro",
      "muse-spark-1.3-max",
      "gemini-4-argon",
      "claude-opus-5.5",
      "gpt-6-astra",
    ]);
  });

  it("Tempoansicht", () => {
    expect(paretoFront(DA_SPEED).front.map((p) => p.label)).toStrictEqual([
      "grok-4.3",
      "gemini-3.1-pro-preview",
      "claude-fable-5",
    ]);
  });

  it("die Sprechernotizen nennen dieselben Fronten und Zahlen", () => {
    const md = readFileSync(
      join(import.meta.dirname, "../../..", "slides.md"),
      "utf8",
    );
    // Nur der Absatz selbst: bis zum nächsten Abschnitt der Notizen. Sonst fände
    // der Test die Zahlen auch in einem anderen Absatz weiter unten.
    const start = md.indexOf("DESIGNARENA (Board");
    const ende = md.indexOf("PRODUKT-AUSWAHL", start);
    expect(start).toBeGreaterThan(0);
    expect(ende).toBeGreaterThan(start);
    const notiz = md.slice(start, ende);
    expect(notiz).toContain(`Stand ${DA_STAND}`);
    expect(notiz).toContain(`${DA_COST.length} Modelle.`);
    expect(notiz).toContain(
      `${DA_NO_TIME.length} der ${DA_COST.length} Modelle der Preisansicht`,
    );
    for (const p of [
      ...paretoFront(DA_COST).front,
      ...paretoFront(DA_SPEED).front,
    ])
      expect(notiz, p.label).toContain(`${p.label} `);
  });

  it("beschriftet angepasste Tempo-Ticks ohne Rundung auf ganze Minuten", () => {
    // `fitScale` wählt bei einer Auswahl runde Sekunden (100, 200, 500).
    const V = VARIANTS["da-speed"];
    expect([100, 120, 200, 300].map(V.xTickLabel)).toStrictEqual([
      "1,7 min",
      "2 min",
      "3,3 min",
      "5 min",
    ]);
  });

  it("die Tempo-Ticks sprechen von Minuten, schnell links", () => {
    const V = VARIANTS["da-speed"];
    expect(V.xTicks.map(V.xTickLabel)).toStrictEqual([
      "2 min",
      "3 min",
      "5 min",
      "8 min",
      "12 min",
    ]);
  });
});
