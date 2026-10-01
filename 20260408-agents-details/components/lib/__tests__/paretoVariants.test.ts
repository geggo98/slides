import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import raw from "../../../data/artificialanalysis/board-20261001-ae520e03.json";
import {
  AA_CFGS,
  AA_COST,
  AA_FLOOR,
  AA_NO_TPS,
  AA_SPEED,
  bestPerModel,
  CONFIGS,
  effortOf,
  labelOf,
  modelSlug,
  SUB_FACTOR,
  USD_EUR,
  type AaCfg,
} from "../../aaData";
import {
  collisions,
  layoutLabels,
  markerBoxes,
  type Obstacle,
} from "../../labelLayout";
import {
  arrowCluster,
  dodgeMarkers,
  frontUnion,
  HIT_R,
  LABEL_FONT,
  plotBounds,
  quadrantBoxes,
  toLayoutPoints,
  visiblePoints,
} from "../../paretoChrome";
import { labOf, paretoFront } from "../../paretoData";
import {
  VARIANT_ORDER,
  VARIANTS,
  frontSentence,
  type ParetoVariant,
} from "../../paretoVariants";
import { presetModels, toolHas } from "../../providerFilter";

// Die beiden Artificial-Analysis-Ansichten und der Rahmen, der sie zeichnet.
// Was hier verriegelt wird, sind die Stellen, an denen ein stiller Fehler gut
// aussähe: eine Effort-Stufe, die als eigenes Modell durchgeht, ein
// vertauschtes Vorzeichen bei der Tempo-Achse, ein Label ohne Lab.

const cfg = (
  model: string,
  index: number,
  usd: number,
  over: Partial<AaCfg> = {},
): AaCfg => ({
  slug: model,
  model,
  label: labelOf(model),
  effort: null,
  creator: "X",
  index,
  usd,
  tps: 50,
  ...over,
});

describe("aaData — Effort-Stufen und Labels", () => {
  it("liest die Stufe aus der Klammer des Namens", () => {
    expect(effortOf("GPT-6 Astra (xhigh)")).toBe("xhigh");
    expect(
      effortOf(
        "Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)",
      ),
    ).toBe("max");
    expect(effortOf("DeepSeek V4 Pro 0813 (Reasoning, Max Effort)")).toBe(
      "max",
    );
    expect(effortOf("GLM 5.3 Flash")).toBeNull();
    expect(effortOf("GPT-6 Sol (Non-reasoning)")).toBeNull();
  });

  it("nimmt ein Suffix nur weg, wenn der Name dieselbe Stufe nennt", () => {
    expect(modelSlug("gpt-6-astra-xhigh", "GPT-6 Astra (xhigh)")).toBe(
      "gpt-6-astra",
    );
    // Qwen3.8 Max ist ein Modell, keine max-Stufe von „qwen3-8“.
    expect(modelSlug("qwen3-8-max", "Qwen3.8 Max (0902)")).toBe("qwen3-8-max");
  });

  it("schreibt Versionen wie DeepSWE, damit Lab und Filter greifen", () => {
    expect(labelOf("gpt-6-1-sol")).toBe("gpt-6.1-sol");
    expect(labelOf("claude-opus-5-5")).toBe("claude-opus-5.5");
    expect(labelOf("mimo-v2-6-pro")).toBe("mimo-v2.6-pro");
    expect(labelOf("qwen3-8-2-4t-a95b")).toBe("qwen3.8-2.4t");
  });

  it("wählt je Modell den höchsten Index, bei Gleichstand den billigeren", () => {
    const best = bestPerModel([
      cfg("m", 50, 3, { effort: "high" }),
      cfg("m", 52, 5, { effort: "max" }),
      cfg("m", 52, 4, { effort: "xhigh" }),
      cfg("n", 40, 1),
    ]);
    expect(best.map((c) => [c.model, c.usd])).toStrictEqual([
      ["m", 4],
      ["n", 1],
    ]);
  });

  it("trägt claude-opus-5-5 (die max-Stufe) — der Fall, den ein Regex verlor", () => {
    expect(CONFIGS.some((c) => c.slug === "claude-opus-5-5")).toBe(true);
    expect(AA_COST.some((p) => p.label === "claude-opus-5.5")).toBe(true);
  });
});

describe("aaData — die beiden Punktmengen", () => {
  it("hat eindeutige Labels und für jedes ein bekanntes Lab", () => {
    const labels = AA_COST.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const l of labels) expect(labOf(l), l).not.toBe("Andere");
  });

  it("liegt über dem Boden und zählt so viele Modelle, wie die Quellen-Notiz nennt", () => {
    for (const c of AA_CFGS) expect(c.index).toBeGreaterThanOrEqual(AA_FLOOR);
    expect(AA_COST.length).toBe(25);
    const rows = raw as {
      deprecated: boolean;
      intelligenceIndexCostPerTask: unknown;
    }[];
    const mitKosten = rows.filter(
      (r) =>
        !r.deprecated && typeof r.intelligenceIndexCostPerTask === "number",
    ).length;
    const src = readFileSync(
      join(import.meta.dirname, "../..", "ModelRoutingSources.vue"),
      "utf8",
    );
    // Die Notiz nennt „688 Einträge, 110 aktive mit Kosten“ und „25 Modelle“.
    expect(src).toContain(
      `${rows.length} Einträge, ${mitKosten} aktive mit Kosten`,
    );
    expect(src).toContain(`${AA_COST.length} Modelle mit Index`);
  });

  it("rechnet USD zum festen Kurs in € um", () => {
    const c = AA_CFGS.find((x) => x.model === "gpt-6-astra")!;
    const p = AA_COST.find((x) => x.label === "gpt-6-astra")!;
    expect(p.x).toBeCloseTo(c.usd * USD_EUR, 2);
    expect(p.y).toBeCloseTo(c.index, 1);
  });

  it("gibt nur Claude-Punkten ein Kontingent, und zwar ×0,8", () => {
    for (const p of AA_COST) {
      if (labOf(p.label) === "Anthropic")
        expect(p.sub).toBeCloseTo(p.x * SUB_FACTOR, 2);
      else expect(p.sub, p.label).toBeUndefined();
    }
  });

  it("lässt die Tempo-Ansicht genau die Modelle ohne Messwert verlieren", () => {
    const fehlt = AA_COST.map((p) => p.label).filter(
      (l) => !AA_SPEED.some((p) => p.label === l),
    );
    expect(fehlt.sort()).toStrictEqual([...AA_NO_TPS].sort());
    expect(AA_NO_TPS).toStrictEqual(["gemini-4-argon"]);
  });

  it("nimmt für die Tempo-Achse die Zeit je 1 000 Tokens: schnell heißt kleines x", () => {
    // `tps` am Punkt ist auf ganze tok/s gerundet; x rechnet mit dem Rohwert.
    for (const p of AA_SPEED) {
      const c = AA_CFGS.find((q) => q.label === p.label)!;
      expect(p.x).toBeCloseTo(1000 / c.tps!, 2);
    }
    const flash = AA_SPEED.find((p) => p.label === "gemini-3.8-flash")!;
    const opus = AA_SPEED.find((p) => p.label === "claude-opus-5.5")!;
    expect(flash.x).toBeLessThan(opus.x);
  });

  it("hat die Fronten, die die Speaker Notes nennen", () => {
    expect(paretoFront(AA_COST).front.map((p) => p.label)).toStrictEqual([
      "mimo-v2.6-flash",
      "gpt-6-luna",
      "mimo-v2.6-pro",
      "gpt-6.1-sol",
      "gemini-4-argon",
      "gpt-6-astra",
      "claude-opus-5.5",
    ]);
    expect(paretoFront(AA_SPEED).front.map((p) => p.label)).toStrictEqual([
      "gemini-3.8-flash",
      "muse-spark-1.3",
      "claude-sonnet-5.5",
      "claude-opus-5.5",
    ]);
  });
});

describe("Varianten", () => {
  it("führt genau die drei Ansichten, AA-Kosten zuerst", () => {
    expect(VARIANT_ORDER).toStrictEqual(["aa-cost", "aa-speed", "deepswe"]);
  });

  for (const id of VARIANT_ORDER) {
    const V = VARIANTS[id];
    describe(id, () => {
      it("legt jeden Punkt und jeden Tick in den Plot", () => {
        const b = plotBounds(V.scale);
        for (const p of V.pts) {
          const x = V.scale.px(p.x);
          const y = V.scale.py(p.y);
          expect(x, `${p.label} x`).toBeGreaterThan(b.x);
          expect(x, `${p.label} x`).toBeLessThan(b.x + b.w);
          expect(y, `${p.label} y`).toBeGreaterThan(b.y);
          expect(y, `${p.label} y`).toBeLessThan(b.y + b.h);
        }
        for (const t of V.xTicks) {
          const x = V.scale.px(t);
          expect(x).toBeGreaterThan(b.x);
          expect(x).toBeLessThan(b.x + b.w);
        }
        for (const t of V.yTicks) {
          // Der 0-%-Tick der DeepSWE-Achse liegt exakt auf der Plot-Kante.
          const y = V.scale.py(t);
          expect(y).toBeGreaterThanOrEqual(b.y);
          expect(y).toBeLessThanOrEqual(b.y + b.h);
        }
      });

      it("beschriftet die Front und überschneidet nichts (Default, Overlay aus/an)", () => {
        for (const subOn of V.features.subOverlay ? [false, true] : [false]) {
          const S = V.scale;
          const ghost = V.features.priceGhost;
          const all = new Set(presetModels("all", V.pts));
          const pos = dodgeMarkers(
            visiblePoints(V.pts, all, subOn, { ghost }),
            S,
            "pareto",
            (p) => p.sub !== undefined,
            { horizontalOnly: frontUnion(V.pts) },
          );
          const lp = toLayoutPoints(V.pts, S, {
            overlay: V.features.subOverlay,
            ghost,
            subOn,
            story: (p) => p.story === true,
            presets: true,
            pos,
          });
          const cluster = arrowCluster(S, V.arrows);
          const obstacles: Obstacle[] = [
            ...quadrantBoxes(S, undefined, V.quadrants),
            ...cluster.boxes,
          ];
          const layout = layoutLabels(lp, {
            font: LABEL_FONT.pareto,
            bounds: plotBounds(S),
            hitR: HIT_R,
            obstacles,
          });
          const blocks = [...obstacles, ...markerBoxes(lp, HIT_R)];
          expect(
            collisions(layout.core.values(), blocks, plotBounds(S)),
            `${id} overlay=${subOn}`,
          ).toStrictEqual([]);
          expect(layout.missing, `${id}: Rang 0/1 ohne Platz`).toStrictEqual(
            [],
          );
        }
      });

      it("hat aria-Text für jede Sprosse", () => {
        const front = paretoFront(V.pts).front;
        const s = frontSentence(V, front);
        for (const p of front) expect(s).toContain(p.label);
      });
    });
  }

  it("beschriftet die Tempo-Ticks in tok/s, schnell links", () => {
    const V: ParetoVariant = VARIANTS["aa-speed"];
    expect(V.xTicks.map(V.xTickLabel)).toStrictEqual([
      "300",
      "200",
      "100",
      "60",
      "40",
    ]);
    const px = V.xTicks.map((t) => V.scale.px(t));
    expect([...px].sort((a, b) => a - b)).toStrictEqual(px);
  });

  it("gibt Ghost nur der DeepSWE-Ansicht: nach dem 14.09. gibt es keinen künftigen Kontingent-Stand mehr", () => {
    expect(VARIANTS.deepswe.features.priceGhost).toBe(true);
    expect(VARIANTS["aa-cost"].features.priceGhost).toBe(false);
    const on = visiblePoints(
      AA_COST,
      new Set(AA_COST.map((p) => p.label)),
      true,
      { ghost: false },
    );
    for (const p of on) expect(p.old, p.label).toBeUndefined();
  });
});

describe("Werkzeug-Kataloge in den AA-Ansichten", () => {
  it("nennt nur Modelle, die die AA-Ansicht zeichnet", () => {
    const gezeigt = new Set(AA_COST.map((p) => p.label));
    for (const id of ["cursor", "windsurf", "jetbrains-ai"] as const) {
      const m = presetModels(id, AA_COST);
      expect(m.length, id).toBeGreaterThan(0);
      for (const l of m) expect(gezeigt.has(l)).toBe(true);
    }
  });

  // Ein Katalog je Werkzeug, für beide Datenquellen: was Windsurf führt, gilt
  // in jeder Ansicht.
  it("liest dieselbe Liste wie die DeepSWE-Ansicht", () => {
    expect(toolHas("windsurf", "gemini-3.8-flash")).toBe(true);
    expect(presetModels("windsurf", AA_COST)).toContain("gemini-3.8-flash");
    expect(presetModels("windsurf", AA_COST)).toContain("gpt-6-astra");
    expect(presetModels("windsurf", AA_COST)).not.toContain(
      "claude-sonnet-5.5",
    );
    expect(presetModels("cursor", AA_COST)).toContain("claude-sonnet-5.5");
    expect(presetModels("cursor", AA_COST)).not.toContain("gpt-6-astra");
    // JetBrains AI führt nur GPT-5.6 Terra aus dem AA-Feld — die neuen 5.5er
    // Claude-Modelle stehen nicht in der Hilfe „Supported models“.
    expect(presetModels("jetbrains-ai", AA_COST)).toStrictEqual([
      "gpt-5.6-terra",
    ]);
  });
});
