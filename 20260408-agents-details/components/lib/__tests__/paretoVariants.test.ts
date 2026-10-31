import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AA_BOARD,
  AA_CFGS,
  AA_COST,
  AA_FLOOR,
  AA_NO_TPS,
  AA_ROWS,
  AA_SPEED,
  AA_STAND,
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
  NUR_EINGESCHRAENKT,
  VARIANT_ORDER,
  VARIANTS,
  frontSentence,
  type ParetoVariant,
} from "../../paretoVariants";
import { presetModels, toolHas } from "../../providerFilter";

// Die Artificial-Analysis-Ansichten und der Rahmen, der alle vier zeichnet
// (die DesignArena-Daten prüft `daData.test.ts`).
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

// Ein neuer Snapshot ist ein Datenwechsel an EINER Stelle (`aaData.ts`: Import,
// `AA_BOARD`, `AA_STAND`). Diese Tests schlagen fehl, solange er halb gemacht
// ist — nach `fetch.ts` also so lange, bis das Deck auf dem neuen Stand steht.
describe("aaData — Snapshot", () => {
  const dir = join(import.meta.dirname, "../..");
  const index = readFileSync(
    join(dir, "../data/artificialanalysis/index.ndjson"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { file: string; fetched_at: string });

  it("liest den Snapshot, den AA_BOARD nennt", () => {
    const src = readFileSync(join(dir, "aaData.ts"), "utf8");
    expect(src).toContain(
      `import raw from "../data/artificialanalysis/${AA_BOARD}";`,
    );
  });

  it("steht auf dem neuesten archivierten Snapshot", () => {
    expect(AA_BOARD).toBe(index.at(-1)!.file);
  });

  it("datiert den Stand auf den Abruf dieses Snapshots", () => {
    const e = index.find((x) => x.file === AA_BOARD)!;
    const [y, m, d] = e.fetched_at.slice(0, 10).split("-");
    expect(AA_STAND).toBe(`${d}.${m}.${y}`);
  });

  it("markiert als eingeschränkt verfügbar nur Modelle des Charts", () => {
    const labels = new Set(AA_COST.map((p) => p.label));
    for (const l of NUR_EINGESCHRAENKT) expect(labels.has(l), l).toBe(true);
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
    expect(AA_COST.length).toBe(27);
    const v5 = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../../data/artificialanalysis", AA_BOARD),
        "utf8",
      ),
    ) as unknown[];
    const aktiv = AA_ROWS.filter(
      (r) =>
        !r.deprecated && typeof r.intelligenceIndexCostPerTask === "number",
    );
    const gemessen = aktiv.filter((r) => !r.migrated).length;
    const umgerechnet = aktiv.filter((r) => r.migrated).length;
    const src = readFileSync(
      join(import.meta.dirname, "../..", "ModelRoutingSources.vue"),
      "utf8",
    );
    // Die Notiz nennt „273 Einträge, 74 aktive mit Kosten; 38 weitere aus v4
    // umgerechnet“ und „27 Modelle“.
    expect(src).toContain(
      `${v5.length} Einträge, ${gemessen} aktive mit Kosten; ${umgerechnet} weitere aus v4 umgerechnet`,
    );
    expect(src).toContain(`${AA_COST.length} Modelle mit Index ≥ ${AA_FLOOR}`);
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
    expect(AA_NO_TPS).toStrictEqual(["ling-3.1-flash-1019"]);
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
      "gpt-6.1-terra-non-reasoning",
      "claude-haiku-5.5",
      "gpt-6.1-terra",
      "gpt-6.1-sol",
      "gpt-6-astra",
      "gemini-4-carbon",
    ]);
    expect(paretoFront(AA_SPEED).front.map((p) => p.label)).toStrictEqual([
      "claude-haiku-5.5",
      "muse-wonder",
      "claude-sonnet-5.5",
      "claude-opus-5.5",
      "gemini-4-carbon",
    ]);
    // Auf beiden Fronten nur gemessene v5-Werte, keine aus v4 umgerechneten.
    for (const p of [
      ...paretoFront(AA_COST).front,
      ...paretoFront(AA_SPEED).front,
    ])
      expect(p.mig, p.label).toBeUndefined();
  });
});

/**
 * Bekannte Pfeil-Überdeckungen, als Sperrklinke: Die Liste darf nur kürzer
 * werden. Seit 31.10.2026 leer: `aa-speed` hatte vier Überdeckungen, die der
 * neue Knoten links über der Front behebt. Ein neuer Eintrag ist kein
 * Ausweg — `arrows.hubX`/`hubY`/`target` der Ansicht neu suchen.
 */
const PFEIL_BEKANNT: Partial<Record<string, string[]>> = {};

describe("Varianten", () => {
  it("führt die AA- und die DesignArena-Ansichten, je Kosten zuerst", () => {
    expect(VARIANT_ORDER).toStrictEqual([
      "aa-cost",
      "aa-speed",
      "da-cost",
      "da-speed",
    ]);
    // Das Menü gruppiert nach Quelle: dieselbe Quelle steht zusammen.
    expect(VARIANT_ORDER.map((id) => VARIANTS[id].source)).toStrictEqual([
      "aa",
      "aa",
      "da",
      "da",
    ]);
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
          const y = V.scale.py(t);
          expect(y).toBeGreaterThanOrEqual(b.y);
          expect(y).toBeLessThanOrEqual(b.y + b.h);
        }
      });

      it("beschriftet die Front und überschneidet nichts (Default, Overlay aus/an)", () => {
        for (const subOn of V.features.subOverlay ? [false, true] : [false]) {
          const S = V.scale;
          const ghost = false;
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

      it("legt den Pfeilcluster über keine Quadranten-Überschrift und keinen Marker", () => {
        // `collisions` oben prüft nur Labels; ein Pfeil quer über „Geldverbrennung“
        // oder über einem Punkt fiele dort nicht auf (DesignArena, 31.10.2026).
        const S = V.scale;
        const all = new Set(presetModels("all", V.pts));
        const pos = dodgeMarkers(
          visiblePoints(V.pts, all, false, { ghost: false }),
          S,
          "pareto",
          (p) => p.sub !== undefined,
          { horizontalOnly: frontUnion(V.pts) },
        );
        const lp = toLayoutPoints(V.pts, S, {
          overlay: V.features.subOverlay,
          ghost: false,
          subOn: false,
          story: (p) => p.story === true,
          presets: true,
          pos,
        });
        const blocks = [
          ...quadrantBoxes(S, undefined, V.quadrants),
          ...markerBoxes(lp, HIT_R),
        ];
        const hit = (a: Obstacle, b: Obstacle) =>
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h;
        const treffer = arrowCluster(S, V.arrows).boxes.flatMap((c) =>
          blocks.filter((b) => hit(c, b)).map((b) => `${c.name} × ${b.name}`),
        );
        expect(treffer).toStrictEqual(PFEIL_BEKANNT[id] ?? []);
      });

      it("legt den Pfeilcluster ganz in den Plot", () => {
        // „Billiger“ ist fest 250 px lang: Ein Knoten nah am linken Rand schob
        // ihn am 31.10.2026 über die Achsenbeschriftung — kein anderer Test sah es.
        const b = plotBounds(V.scale);
        for (const c of arrowCluster(V.scale, V.arrows).boxes) {
          expect(c.x, c.name).toBeGreaterThanOrEqual(b.x);
          expect(c.y, c.name).toBeGreaterThanOrEqual(b.y);
          expect(c.x + c.w, c.name).toBeLessThanOrEqual(b.x + b.w);
          expect(c.y + c.h, c.name).toBeLessThanOrEqual(b.y + b.h);
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
      "30",
    ]);
    const px = V.xTicks.map((t) => V.scale.px(t));
    expect([...px].sort((a, b) => a - b)).toStrictEqual(px);
  });

  it("zeigt keinen Geisterring: nach dem 14.09. gibt es keinen künftigen Kontingent-Stand mehr", () => {
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
    for (const id of ["cursor", "windsurf", "junie"] as const) {
      const m = presetModels(id, AA_COST);
      expect(m.length, id).toBeGreaterThan(0);
      for (const l of m) expect(gezeigt.has(l)).toBe(true);
    }
  });

  // Ein Katalog je Werkzeug, für beide Datenquellen: was Windsurf führt, gilt
  // in jeder Ansicht.
  it("liest dieselbe Liste wie die Historien-Folie", () => {
    expect(toolHas("windsurf", "gemini-3.8-flash")).toBe(true);
    expect(presetModels("windsurf", AA_COST)).toContain("gemini-3.8-flash");
    expect(presetModels("windsurf", AA_COST)).toContain("gpt-6-astra");
    expect(presetModels("windsurf", AA_COST)).not.toContain(
      "claude-sonnet-5.5",
    );
    expect(presetModels("cursor", AA_COST)).toContain("claude-sonnet-5.5");
    expect(presetModels("cursor", AA_COST)).not.toContain("gpt-6-astra");
    // JetBrains AI führt seit dem Katalog vom 28.10. auch GPT-6 und Opus 5.5
    // des aktuellen Felds.
    expect(presetModels("jetbrains-ai", AA_COST)).toStrictEqual([
      "gpt-6-luna",
      "gpt-6.1-sol",
      "gemini-3.8-flash",
      "claude-sonnet-5.5",
      "claude-opus-5.5",
      "claude-fable-5.1",
    ]);
  });
});
