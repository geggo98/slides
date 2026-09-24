/**
 * preliminaryParetoPoints.test.ts — verriegelt die Zwei-Bucket-Preisschätzung
 * für Claude Opus 5.5, GPT-6 Sol und GPT-6 Luna gegen die Rohzahlen aus dem
 * Board-Archiv (board-20260903T222437Z-c55e58f2.ndjson) und die offiziellen
 * Preislisten von Anthropic/OpenAI, sowie die daraus folgende Front-Änderung.
 * Herleitung ausführlich im Kopfkommentar von `preliminaryParetoPoints.ts`.
 */
import { describe, expect, it } from "vitest";
import { CURRENT, fmt, paretoFront } from "../../paretoData";
import { PRELIMINARY_PARETO_POINTS } from "../preliminaryParetoPoints";

// Rohzahlen des jeweils besten Vorgänger-Configs ("max"), aus dem
// 03.09.-Board-Archiv (derselbe Stand wie `CURRENT`).
const RAW = {
  "claude-opus-5.5": {
    meanOutputTokens: 117565.6936936937,
    meanCostUsd: 11.837583271396396,
  },
  "gpt-6-sol": {
    meanOutputTokens: 60013.64444444444,
    meanCostUsd: 6.455954682467823,
  },
  "gpt-6-luna": {
    meanOutputTokens: 73399.70758928571,
    meanCostUsd: 0.6056233620535714,
  },
} as const;

// Offizielle Preise je MTok (USD), Vorgänger → Nachfolger.
const PRICES = {
  "claude-opus-5.5": { inOld: 5, outOld: 25, inNew: 4, outNew: 20 },
  "gpt-6-sol": { inOld: 4, outOld: 20, inNew: 2, outNew: 10 },
  "gpt-6-luna": { inOld: 0.2, outOld: 1.2, inNew: 0.1, outNew: 0.5 },
} as const;

const EUR_PER_USD = 0.876;

/** Dieselbe Zwei-Bucket-Formel wie die reale gpt-5.6-sol-Repricing-Herleitung
 * im Kopfkommentar von `paretoData.ts`. */
function twoBucketEur(label: keyof typeof RAW): number {
  const { meanOutputTokens, meanCostUsd } = RAW[label];
  const { inOld, outOld, inNew, outNew } = PRICES[label];
  const outputAnteil = (meanOutputTokens * outOld) / 1e6;
  const restAnteil = meanCostUsd - outputAnteil;
  const neuUsd =
    restAnteil * (inNew / inOld) + outputAnteil * (outNew / outOld);
  return neuUsd * EUR_PER_USD;
}

const byLabel = new Map(PRELIMINARY_PARETO_POINTS.map((p) => [p.label, p]));

describe("Zwei-Bucket-Preisschätzung", () => {
  it("claude-opus-5.5: 8,30 €, Score wie Opus 5 (74 %)", () => {
    expect(twoBucketEur("claude-opus-5.5")).toBeCloseTo(8.2958, 3);
    const p = byLabel.get("claude-opus-5.5")!;
    expect(p.x).toBeCloseTo(8.3, 2);
    expect(p.eur).toBe(fmt(p.x));
    expect(p.y).toBe(CURRENT.find((c) => c.label === "claude-opus-5")!.y);
  });

  it("gpt-6-sol: 2,83 €, Score wie gpt-5.6-sol (73 %)", () => {
    expect(twoBucketEur("gpt-6-sol")).toBeCloseTo(2.8277, 3);
    const p = byLabel.get("gpt-6-sol")!;
    expect(p.x).toBeCloseTo(2.83, 2);
    expect(p.eur).toBe(fmt(p.x));
    expect(p.y).toBe(CURRENT.find((c) => c.label === "gpt-5.6-sol")!.y);
  });

  it("gpt-6-luna: 0,26 €, Score wie gpt-5.6-luna (67 %)", () => {
    expect(twoBucketEur("gpt-6-luna")).toBeCloseTo(0.2589, 3);
    const p = byLabel.get("gpt-6-luna")!;
    expect(p.x).toBeCloseTo(0.26, 2);
    expect(p.eur).toBe(fmt(p.x));
    expect(p.y).toBe(CURRENT.find((c) => c.label === "gpt-5.6-luna")!.y);
  });

  it("alle drei Punkte sind als provisional markiert", () => {
    for (const p of PRELIMINARY_PARETO_POINTS) expect(p.provisional).toBe(true);
  });

  it("claude-opus-5.5 und gpt-6-luna sind Story-Punkte, gpt-6-sol nicht", () => {
    // gpt-6-sol liegt in der dichten astra/sol/terra-Zone — wie gpt-6-astra
    // auf dieser Folie bekommt es KEIN erzwungenes Label, siehe Kommentar in
    // `preliminaryParetoPoints.ts`.
    expect(byLabel.get("claude-opus-5.5")!.story).toBe(true);
    expect(byLabel.get("gpt-6-luna")!.story).toBe(true);
    expect(byLabel.get("gpt-6-sol")!.story).toBeUndefined();
  });
});

describe("Front-Auswirkung", () => {
  it("CURRENT allein bleibt unverändert bei 2,81 €", () => {
    const front = paretoFront(CURRENT).front;
    expect(front.map((p) => p.label)).toStrictEqual([
      "glm-5.3-flash",
      "gpt-5.6-luna",
      "gemini-3.8-flash",
    ]);
    expect(fmt(front.reduce((s, p) => s + p.x, 0))).toBe("2,81");
  });

  it("mit den drei geschätzten Punkten ersetzt gpt-6-luna gpt-5.6-luna als Sprosse 2 — 2,54 €", () => {
    const front = paretoFront([...CURRENT, ...PRELIMINARY_PARETO_POINTS]).front;
    expect(front.map((p) => p.label)).toStrictEqual([
      "glm-5.3-flash",
      "gpt-6-luna",
      "gemini-3.8-flash",
    ]);
    expect(fmt(front.reduce((s, p) => s + p.x, 0))).toBe("2,54");
  });

  it("gpt-6-sol und claude-opus-5.5 bleiben dominiert (gemini-3.8-flash schlägt beide)", () => {
    const front = paretoFront([...CURRENT, ...PRELIMINARY_PARETO_POINTS]).front;
    expect(front.map((p) => p.label)).not.toContain("gpt-6-sol");
    expect(front.map((p) => p.label)).not.toContain("claude-opus-5.5");
  });
});
