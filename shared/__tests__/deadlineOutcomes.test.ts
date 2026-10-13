/**
 * deadlineOutcomes.test.ts — pinnt die Fluid-Rechnung hinter
 * shared/components/DeadlineOutcomeViz.vue und prüft, dass die aus der
 * SRE-Simulation kopierten Zahlen dort noch gelten. Die Komponente
 * importiert das SRE-Modell bewusst nicht; dieser Test ist die Brücke.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INV_PAGES_PER_S,
  INV_PAGES_PER_S_FS,
  LOAD_CAMPAIGN,
} from "../../20260711-sre-simulations/components/lib/wanderingBottleneckModel.js";
import {
  JITTER_JOBS,
  MIXED_BATCH,
  MIXED_CAPACITY,
  MIXED_ONLINE,
  ROW_KEYS,
  SIM_CAPACITY,
  SIM_CAPACITY_FS,
  SIM_DEMAND,
  barScale,
  batchThrottled,
  concurrency,
  fnv1a,
  jitterProfiles,
  mixedSeparated,
  mixedShared,
  onlineShed,
  onlineUnprotected,
  outcomeRows,
  sum,
  type Segment,
} from "../components/lib/deadlineOutcomes";

describe("Zahlen aus der SRE-Simulation (kopiert, nicht importiert)", () => {
  it("Nachfrage = LOAD_CAMPAIGN", () => {
    expect(SIM_DEMAND).toBe(LOAD_CAMPAIGN);
    expect(SIM_DEMAND).toBe(1000);
  });
  it("Kapazität = INV_PAGES_PER_S", () => {
    expect(SIM_CAPACITY).toBe(INV_PAGES_PER_S);
    expect(SIM_CAPACITY).toBe(300);
    expect(MIXED_CAPACITY).toBe(INV_PAGES_PER_S);
  });
  it("Kapazität mit Feature Shedding = INV_PAGES_PER_S_FS", () => {
    expect(SIM_CAPACITY_FS).toBe(INV_PAGES_PER_S_FS);
    expect(SIM_CAPACITY_FS).toBe(1500);
  });
});

// Kompakte Form für Vergleiche: "cls:outcome" → req/s
const table = (segs: readonly Segment[]) =>
  Object.fromEntries(segs.map((s) => [`${s.cls}:${s.outcome}`, s.value]));

describe("Online", () => {
  it("ohne Maßnahme bei Überlast: alle im Timeout, Server arbeitet weiter", () => {
    const r = onlineUnprotected(1000, 300);
    expect(table(r.segments)).toEqual({ "online:timeout": 1000 });
    expect(r.wasted).toBe(300);
  });
  it("ohne Überlast (auch Nachfrage = Kapazität): alle rechtzeitig", () => {
    expect(table(onlineUnprotected(300, 300).segments)).toEqual({
      "online:ontime": 300,
    });
    expect(onlineUnprotected(300, 300).wasted).toBe(0);
  });
  it("Back Pressure / Load Shedding: Kapazität rechtzeitig, Rest abgewiesen", () => {
    expect(table(onlineShed(1000, 300).segments)).toEqual({
      "online:ontime": 300,
      "online:rejected": 700,
    });
    expect(table(onlineShed(200, 300).segments)).toEqual({
      "online:ontime": 200,
    });
  });
});

describe("Batch", () => {
  it("gedrosselt: Kapazität sofort, Rest später — nichts abgewiesen", () => {
    expect(table(batchThrottled(1000, 300).segments)).toEqual({
      "batch:ontime": 300,
      "batch:later": 700,
    });
  });
});

describe("Gemischte Last", () => {
  it("Online allein passt, erst Batch hebt die Summe über die Kapazität", () => {
    expect(MIXED_ONLINE).toBeLessThanOrEqual(MIXED_CAPACITY);
    expect(MIXED_ONLINE + MIXED_BATCH).toBeGreaterThan(MIXED_CAPACITY);
  });
  it("gemeinsame Queue: Online im Timeout, Batch verdrängt Online", () => {
    const r = mixedShared(200, 200, 300);
    expect(table(r.segments)).toEqual({
      "online:timeout": 200,
      "batch:later": 200,
    });
    expect(r.onlineServedLate).toBe(150);
    expect(r.batchServed).toBe(150);
  });
  it("gemeinsame Queue ohne Überlast: alle rechtzeitig", () => {
    expect(table(mixedShared(100, 100, 300).segments)).toEqual({
      "online:ontime": 100,
      "batch:ontime": 100,
    });
  });
  it("Workload Separation: Online rechtzeitig, nur Batch gedrosselt", () => {
    const r = mixedSeparated(200, 200, 300);
    expect(table(r.segments)).toEqual({
      "online:ontime": 200,
      "batch:ontime": 100,
      "batch:later": 100,
    });
    expect(r.batchCapacity).toBe(100);
  });
  it("Separation, Online allein über der Kapazität: Online-Rest abgewiesen", () => {
    expect(table(mixedSeparated(400, 100, 300).segments)).toEqual({
      "online:ontime": 300,
      "online:rejected": 100,
      "batch:later": 100,
    });
  });
});

describe("Zeilen der Grafik", () => {
  const rows = outcomeRows();

  it("Reihenfolge = ROW_KEYS ohne die Jitter-Zeile", () => {
    expect(rows.map((r) => r.key)).toEqual(
      ROW_KEYS.filter((k) => k !== "jitter"),
    );
  });

  it("jede Zeile verteilt genau die angebotene Last", () => {
    for (const r of rows) expect(sum(r.segments)).toBe(r.total);
  });

  it("die Ausgänge je Zeile (Folientext und Notizen hängen daran)", () => {
    expect(rows.map((r) => [r.key, table(r.segments)])).toEqual([
      ["unprotected", { "online:timeout": 1000 }],
      ["shed", { "online:ontime": 300, "online:rejected": 700 }],
      ["enough", { "online:ontime": 1000 }],
      ["batch", { "batch:ontime": 300, "batch:later": 700 }],
      ["mixedShared", { "online:timeout": 200, "batch:later": 200 }],
      [
        "mixedSeparated",
        { "online:ontime": 200, "batch:ontime": 100, "batch:later": 100 },
      ],
    ]);
  });

  it("eine Skala für alle Zeilen: Kapazität 300 überall an derselben Stelle", () => {
    const scale = barScale(rows);
    expect(scale).toBe(SIM_DEMAND);
    const shares = rows
      .filter((r) => r.capacity === SIM_CAPACITY)
      .map((r) => r.capacity / scale);
    expect(shares).toHaveLength(5); // alle außer „enough“
    expect(new Set(shares)).toEqual(new Set([0.3]));
    // Gemischte Zeilen sind kürzer, nicht breiter gezeichnet
    expect(rows.find((r) => r.key === "mixedShared")!.total / scale).toBe(0.4);
    // „enough“: Kapazität jenseits der Skala, also Marker statt Strich
    expect(rows.find((r) => r.key === "enough")!.capacity).toBeGreaterThan(
      scale,
    );
  });

  it("Online kommt nur ohne Timeout durch, wenn eine Maßnahme greift", () => {
    const timeout = (k: string) =>
      sum(rows.find((r) => r.key === k)!.segments, { outcome: "timeout" });
    expect(timeout("unprotected")).toBe(SIM_DEMAND);
    expect(timeout("shed")).toBe(0);
    expect(timeout("enough")).toBe(0);
    expect(timeout("mixedShared")).toBe(MIXED_ONLINE);
    expect(timeout("mixedSeparated")).toBe(0);
  });
});

describe("Jitter für Batch-Starts", () => {
  it("FNV-1a: Standard-Testvektoren", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });

  it("Gleichzeitigkeit je Minute", () => {
    expect(concurrency([0, 2], 3, 4)).toEqual([1, 1, 2, 1, 1, 0, 0]);
  });

  it("gleiche Arbeit, kleinere Spitze", () => {
    const j = jitterProfiles();
    expect(JITTER_JOBS).toHaveLength(12);
    expect(j.hashedStarts).toEqual([
      59, 44, 36, 8, 55, 31, 52, 0, 18, 10, 21, 32,
    ]);
    expect(j.peakFixed).toBe(12);
    expect(j.peakHashed).toBe(2);
    expect(j.workFixed).toBe(60); // 12 Jobs × 5 min
    expect(j.workHashed).toBe(j.workFixed);
  });
});

// Jede Folie mit <DeadlineOutcomeViz> braucht so viele Klicks, wie die
// Grafik Zeilen hat (minus der ersten), und reicht $clicks als step durch.
describe("Folien mit DeadlineOutcomeViz", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const uses = readdirSync(root, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(resolve(root, d.name, "slides.md")),
    )
    .flatMap((d) => {
      const md = readFileSync(resolve(root, d.name, "slides.md"), "utf8");
      return [...md.matchAll(/<DeadlineOutcomeViz\b[^>]*>/g)].map((m) => {
        // Die letzten beiden "---"-Zeilen davor umschließen das Frontmatter
        // der Folie (die Folie braucht ohnehin eins: clicks, routeAlias).
        const lines = md.slice(0, m.index).split("\n");
        const close = lines.lastIndexOf("---");
        const open = lines.lastIndexOf("---", close - 1);
        const fm = lines.slice(open + 1, close).join("\n");
        return { deck: d.name, tag: m[0], fm };
      });
    });

  it("wird mindestens einmal verwendet (Smoke)", () => {
    expect(uses.length).toBeGreaterThan(0);
  });

  it.each(uses)("$deck: clicks und step passen", ({ tag, fm }) => {
    expect(fm).toMatch(new RegExp(`^clicks: ${ROW_KEYS.length - 1}$`, "m"));
    expect(tag).toContain(':step="$clicks"');
  });
});
