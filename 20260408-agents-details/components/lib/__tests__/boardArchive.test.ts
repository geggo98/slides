import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  paretoFront,
  SNAPSHOTS,
  V1_COMPARE,
  type Pt,
  type Snapshot,
} from "../../paretoData";

// Rechnet die neun Stände der Historie und die zwei der Bonusfolie aus
// `paretoData.ts` aus den archivierten Rohdaten unter `data/deepswe/` nach.
//
// Warum das kein Luxus ist: Die Punkte sind von Hand aus dem Board
// abgeschrieben, und zweimal ist dabei ein falscher Wert hängengeblieben —
// einmal eine Spalte daneben (`median_cost_usd` statt `mean_cost_usd`, siehe
// Kopf von `paretoData.ts`), einmal ein auf 8,3 statt 8,31 gerundeter Preis.
// Beides fällt beim Ansehen nicht auf. Hier fällt es auf.
//
// Der Test liest ausschließlich committete Dateien und ruft nichts ab.

const DIR = join(import.meta.dirname, "../../../data/deepswe");

interface Zeile {
  model: string;
  reasoning_effort: string | null;
  pass_at_1: number | null;
  mean_cost_usd: number | null;
}

const index = readFileSync(join(DIR, "index.ndjson"), "utf8")
  .trim()
  .split("\n")
  .map(
    (l) =>
      JSON.parse(l) as {
        sha256: string;
        file: string;
        generated_at: string | null;
      },
  );

/** Historie plus Bonusfolie; die Stand-IDs sind über beide Listen eindeutig. */
const STAENDE: Snapshot[] = [...SNAPSHOTS, ...V1_COMPARE];

const zustand = (sha: string): Zeile[] => {
  const e = index.find((x) => x.sha256.startsWith(sha));
  if (!e) throw new Error(`kein Board-Zustand ${sha} im Archiv`);
  return readFileSync(join(DIR, e.file), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Zeile);
};

/**
 * Board-Name → Chart-Name. Das Board schreibt Versionsnummern mit Bindestrich
 * (`gemini-3-8-flash`); umgekehrt wird jede Ziffer-Bindestrich-Ziffer-Stelle zum
 * Punkt. `gpt-6-astra` bleibt dabei unangetastet — dort steht ein Buchstabe
 * hinter dem Bindestrich, und `gemini-3-flash` trägt gar keine Nummer.
 *
 * Die beiden `-preview`-Namen brauchen eine eigene Zeile: Das Board hat sie
 * später fallen lassen, das Chart hat sie nie geführt.
 */
export function chartName(model: string): string {
  let s = model;
  for (let v = s; ; v = s) {
    s = s.replace(/(\d)-(\d)/g, "$1.$2");
    if (s === v) break;
  }
  return (
    {
      "gemini-3.1-pro-preview": "gemini-3.1-pro",
      "gemini-3-flash-preview": "gemini-3-flash",
    }[s] ?? s
  );
}

/** Die Auswahlregel dieses Charts, auf Rohzeilen statt auf `EFFORTS`. */
function besteJeModell(zeilen: Zeile[]): Map<string, { x: number; y: number }> {
  const best = new Map<string, { x: number; y: number }>();
  for (const r of zeilen) {
    if (r.pass_at_1 == null || r.mean_cost_usd == null) continue;
    const k = chartName(r.model);
    const w = { y: 100 * r.pass_at_1, x: 0.876 * r.mean_cost_usd };
    const da = best.get(k);
    if (!da || w.y > da.y || (w.y === da.y && w.x < da.x)) best.set(k, w);
  }
  return best;
}

/**
 * Welcher archivierte Board-Zustand zu welchem Stand gehört, über die ersten
 * acht Zeichen des sha256. Die Zuordnung steht hier ausgeschrieben statt über
 * ein Datum geraten — der 13.08.2026 hatte ZWEI Zustände, und der Stand 14.08.
 * gehört zum zweiten (der erste kennt gemini-3.7-flash auf `medium` noch nicht).
 */
const ZUSTAND: Record<string, string> = {
  v1: "cf2c61f9", // 11.06., 20 Modelle — nur auf der Bonusfolie
  v11: "aa99357b", // 14.06., 8 Modelle — die v1.1-Runde
  "v11-vs-v1": "aa99357b", // dieselben Werte, plus v1-Geisterringe
  "0710": "2bc8cfe6", // 09.07. 20:23 UTC, Changelog-Eintrag vom 10.07.
  "0722": "f4153ab1", // 21.07.
  "0725": "978c7e4a", // 25.07.
  "0730": "d94cbb86", // Preissenkung, GLEICHER generated_at wie 0725
  "0814": "3d468f23", // 13.08. 16:11, nicht 03:56
  "0826": "fb4f6a65",
  "0902": "1808d73f",
  "0903": "c55e58f2",
};

/**
 * Die einzige Abweichung, die stehenbleibt — und sie hat einen Grund: Der
 * v1-Stand der Bonusfolie stammt laut Kopf von `paretoData.ts` aus
 * `/artifacts/v1/leaderboard-live.json`, nicht aus der SSR-Payload. Die
 * beiden Quellen desselben Tages unterscheiden sich um genau dieses eine
 * Modell. Die übrigen 20 Punkte stimmen.
 */
const AUSNAHMEN: Record<string, string[]> = { v1: ["glm-5.2"] };

describe("Stände gegen das Board-Archiv", () => {
  it("hat für jeden Stand einen archivierten Zustand", () => {
    expect(Object.keys(ZUSTAND).sort()).toStrictEqual(
      STAENDE.map((s) => s.id).sort(),
    );
  });

  it.each(STAENDE.map((s) => [s.id, s] as const))(
    "leitet Stand %s Punkt für Punkt aus den Rohdaten her",
    (id, s) => {
      const best = besteJeModell(zustand(ZUSTAND[id]!));
      const erlaubt = new Set(AUSNAHMEN[id] ?? []);
      const abweichungen = s.pts
        .filter((p) => !erlaubt.has(p.label))
        .flatMap((p) => {
          const b = best.get(p.label);
          if (!b) return [`${p.label}: nicht im Board-Zustand`];
          const x = Number(b.x.toFixed(2));
          const y = Math.round(b.y);
          return x === p.x && y === p.y
            ? []
            : [`${p.label}: Chart ${p.x}/${p.y}, Archiv ${x}/${y}`];
        });
      expect(abweichungen).toStrictEqual([]);
    },
  );

  // Die Umbenennung ist die Stelle, an der ein Modell still aus dem Vergleich
  // fallen könnte: ein nicht abgebildeter Name sieht aus wie „nicht im
  // Board-Zustand" und damit wie ein Datenfehler. Deshalb hier direkt geprüft.
  it("bildet Board-Namen auf Chart-Namen ab", () => {
    expect(
      [
        "gemini-3-8-flash",
        "gpt-5-6-luna",
        "claude-opus-4-8",
        "kimi-k2-7-code",
        "qwen3-8-max",
        "gemini-3-1-pro-preview",
        "gemini-3-flash-preview",
        "gpt-6-astra",
        "kimi-k3",
        "claude-fable-5",
      ].map(chartName),
    ).toStrictEqual([
      "gemini-3.8-flash",
      "gpt-5.6-luna",
      "claude-opus-4.8",
      "kimi-k2.7-code",
      "qwen3.8-max",
      "gemini-3.1-pro",
      "gemini-3-flash",
      "gpt-6-astra",
      "kimi-k3",
      "claude-fable-5",
    ]);
  });
});

// Der Befund, der das Archiv nötig gemacht hat: `generated_at` ist keine
// Zustandskennung. Das Board rechnet Preise nach, ohne den Stempel anzufassen —
// die Stände 25.07. und 30.07. tragen denselben. Wer darüber dedupliziert,
// verliert die reinen Preis-Stände, und das ist ein Drittel der Bewegungen
// dieser Zeitreihe.
describe("generated_at taugt nicht als Schlüssel", () => {
  it("führt zwei verschiedene Zustände unter demselben Stempel", () => {
    const a = besteJeModell(zustand(ZUSTAND["0725"]!));
    const b = besteJeModell(zustand(ZUSTAND["0730"]!));
    expect(a.get("gpt-5.6-luna")!.x).toBeCloseTo(2.65, 2);
    expect(b.get("gpt-5.6-luna")!.x).toBeCloseTo(0.53, 2);
  });

  it("hält im Index mehrere Zustände je Stempel", () => {
    const stempel = readFileSync(join(DIR, "index.ndjson"), "utf8")
      .trim()
      .split("\n")
      .map(
        (l) => (JSON.parse(l) as { generated_at: string | null }).generated_at,
      );
    expect(stempel.length).toBeGreaterThan(new Set(stempel).size);
  });
});

// Die Aussage der Folie, gegen die Rohdaten statt gegen die abgeschriebenen
// Punkte: Die Front bewegt sich in keinem Stand, wenn man von der Board-Regel
// auf die beste Konfiguration umstellt.
describe("Der Regelwechsel bewegt keine Front", () => {
  const RANG: Record<string, number> = {
    low: 2,
    medium: 3,
    high: 4,
    xhigh: 5,
    max: 6,
  };

  it.each(STAENDE.map((s) => [s.id, s] as const))(
    "lässt die Front in Stand %s unverändert",
    (id, s) => {
      const zeilen = zustand(ZUSTAND[id]!).filter(
        (r) => r.pass_at_1 != null && r.mean_cost_usd != null,
      );
      const gezeigt = new Set(s.pts.map((p) => p.label));
      const nachRang = new Map<string, { x: number; y: number }>();
      for (const r of zeilen) {
        const k = chartName(r.model);
        if (!gezeigt.has(k)) continue;
        const w = { y: 100 * r.pass_at_1!, x: 0.876 * r.mean_cost_usd! };
        const da = nachRang.get(k);
        const rang = RANG[r.reasoning_effort ?? ""] ?? -1;
        if (!da || rang > (da as { rang?: number }).rang!)
          nachRang.set(k, { ...w, rang } as { x: number; y: number });
      }
      const alsPt = (m: Map<string, { x: number; y: number }>) =>
        [...m]
          .map(
            ([label, w]) =>
              ({
                label,
                x: Number(w.x.toFixed(2)),
                y: Math.round(w.y),
              }) as Pt,
          )
          .sort((a, b) => a.x - b.x);
      const best = besteJeModell(zeilen);
      for (const k of [...best.keys()]) if (!gezeigt.has(k)) best.delete(k);
      expect(paretoFront(alsPt(best)).front.map((p) => p.label)).toStrictEqual(
        paretoFront(alsPt(nachRang)).front.map((p) => p.label),
      );
    },
  );
});

// Der Faktencheck vom 05.09.2026, gegen die Rohdaten festgehalten: Die
// Historie beginnt mit v1.1, weil Datacurve am 15.06. nur acht Modelle neu
// gefahren hat. Von den 15 v1-Modellen ohne v1.1-Wert (die Kreuze der
// Bonusfolie) tauchen 13 in keinem späteren Board-Zustand mehr auf; glm-5.2
// und deepseek-v4-pro kommen später neu gemessen zurück.
describe("v1 gegen v1.1 in den Rohdaten", () => {
  const modelle = (sha: string) =>
    new Set(zustand(sha).map((r) => chartName(r.model)));

  it("hatte am 11.06. 20 Modelle, am 14.06. genau die acht von v1.1", () => {
    expect(modelle("cf2c61f9").size).toBe(20);
    const v11 = SNAPSHOTS.find((s) => s.id === "v11")!;
    expect([...modelle("aa99357b")].sort()).toStrictEqual(
      v11.pts.map((p) => p.label).sort(),
    );
  });

  it("hat 13 v1-Modelle nie wieder gemessen, zwei erst später", () => {
    const spaeter = new Set<string>();
    for (const e of index)
      if (e.generated_at !== null && e.generated_at >= "2026-06-14")
        for (const m of modelle(e.sha256)) spaeter.add(m);
    const kreuze = V1_COMPARE[1]!.gone!.map((p) => p.label).sort();
    expect(kreuze).toHaveLength(15);
    expect(kreuze.filter((m) => !spaeter.has(m))).toStrictEqual([
      "claude-haiku-4.5",
      "claude-opus-4.6",
      "claude-opus-4.7",
      "gemini-3-flash",
      "glm-5.1",
      "gpt-5.4-mini",
      "grok-build-0.1",
      "kimi-k2.6",
      "mimo-v2.5-pro",
      "minimax-m2.7",
      "minimax-m3",
      "qwen3.6-plus",
      "qwen3.7-max",
    ]);
    expect(kreuze.filter((m) => spaeter.has(m))).toStrictEqual([
      "deepseek-v4-pro",
      "glm-5.2",
    ]);
  });
});
