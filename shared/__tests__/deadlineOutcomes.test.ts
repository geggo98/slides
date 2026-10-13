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
  LENS_KEYS,
  MIXED_BATCH,
  MIXED_CAPACITY,
  MIXED_ONLINE,
  ROW_KEYS,
  SIM_CAPACITY,
  SIM_CAPACITY_FS,
  SIM_DEMAND,
  PANEL_GOOD_PCT,
  barScale,
  batchThrottled,
  classify,
  concurrency,
  deviatesFromCustomer,
  flowsBatchThrottled,
  flowsMixedSeparated,
  flowsMixedShared,
  flowsShed,
  flowsUnprotected,
  fnv1a,
  jitterProfiles,
  lensPanel,
  lensSegments,
  mixedSeparated,
  mixedShared,
  onlineShed,
  onlineUnprotected,
  outcomeRows,
  rowFlows,
  sum,
  type LensKey,
  type Segment,
  type ViewSegment,
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

  it("Stundenmittel nicht gleich (Panel sagt deshalb „Ø Tag gleich“)", () => {
    const j = jitterProfiles();
    // Über genau die erste Stunde nicht: Der Job mit Startminute 59 läuft
    // bis 1:04, also stecken nur 56 der 60 Job-Minuten in [0, 60).
    const hour = (p: number[]) =>
      p.slice(0, 60).reduce((a, b) => a + b, 0) / 60;
    expect(hour(j.fixed)).toBe(1);
    expect(hour(j.hashed)).toBeCloseTo(56 / 60, 10);
  });
});

/* ===== Metrik-Sichten ===== */

const view = (segs: readonly ViewSegment[]) =>
  Object.fromEntries(segs.map((s) => [`${s.cls ?? "*"}:${s.kind}`, s.value]));
const ROWS = outcomeRows();
const lensTable = (lens: LensKey) =>
  Object.fromEntries(
    ROWS.map((r) => [r.key, view(lensSegments(rowFlows(r.key), lens))]),
  );

describe("Metrik-Sichten: Flüsse", () => {
  it.each(ROWS.map((r) => [r.key, r] as const))(
    "%s: Flüsse ergeben genau die Kundensicht",
    (_k, r) => {
      expect(lensSegments(rowFlows(r.key), "kunde")).toEqual(
        r.segments.map((s) => ({
          cls: s.cls,
          kind: s.outcome,
          value: s.value,
        })),
      );
    },
  );

  it("der Server bearbeitet höchstens seine Kapazität (Absagen kosten nichts)", () => {
    for (const r of ROWS) {
      const answered = rowFlows(r.key)
        .filter((f) => f.answered && f.code === "2xx")
        .reduce((a, f) => a + f.value, 0);
      expect(answered, r.key).toBeLessThanOrEqual(r.capacity);
    }
    // ohne Maßnahme: genau die Kapazität, alles zu spät
    const u = rowFlows("unprotected");
    expect(u.filter((f) => f.answered).map((f) => [f.value, f.fast])).toEqual([
      [SIM_CAPACITY, false],
    ]);
  });

  // Randfälle der Flüsse an anderen Arbeitspunkten als den Folienzeilen:
  // ohne Überlast und Separation mit Online über der Kapazität.
  const kundeOf = (fs: ReturnType<typeof rowFlows>) =>
    lensSegments(fs, "kunde").map((s) => ({
      cls: s.cls,
      outcome: s.kind,
      value: s.value,
    }));
  it.each([
    ["Shed ohne Überlast", flowsShed(200, 300), onlineShed(200, 300).segments],
    [
      "gemeinsame Queue ohne Überlast",
      flowsMixedShared(100, 100, 300),
      mixedShared(100, 100, 300).segments,
    ],
    [
      "Separation, Online über der Kapazität",
      flowsMixedSeparated(400, 100, 300),
      mixedSeparated(400, 100, 300).segments,
    ],
    [
      "Batch ohne Überlast",
      flowsBatchThrottled(200, 300),
      batchThrottled(200, 300).segments,
    ],
  ] as const)("%s: Flüsse = Segmente", (_n, fs, segs) => {
    expect(kundeOf(fs)).toEqual(segs);
  });

  it("Separation, Online über der Kapazität: Online 503, Batch 429", () => {
    expect(
      flowsMixedSeparated(400, 100, 300)
        .filter((f) => f.code !== "2xx")
        .map((f) => `${f.cls}:${f.code}`),
    ).toEqual(["online:503", "batch:429"]);
  });

  it("Online-Abweisen ist 503, Batch-Drosselung 429", () => {
    const codes = (k: Parameters<typeof rowFlows>[0]) =>
      rowFlows(k)
        .filter((f) => f.code !== "2xx")
        .map((f) => `${f.cls}:${f.code}`);
    expect(codes("shed")).toEqual(["online:503"]);
    expect(codes("batch")).toEqual(["batch:429"]);
    expect(codes("mixedSeparated")).toEqual(["batch:429"]);
  });
});

describe("Metrik-Sichten: was jede Sicht zeigt", () => {
  it("Reihenfolge: Kunde, zwei Fehlerkonventionen, Dauer, Eingang, degradiert, workload", () => {
    expect(LENS_KEYS).toEqual([
      "kunde",
      "status5xx",
      "statusNot2xx",
      "dauer",
      "eingang",
      "degradiert",
      "workload",
    ]);
  });

  it("die Balken je Sicht (Folientext und Notizen hängen daran)", () => {
    expect(lensTable("status5xx")).toEqual({
      unprotected: { "*:ontime": 300, "*:unseen": 700 },
      shed: { "*:ontime": 300, "*:error": 700 },
      enough: { "*:ontime": 1000 },
      batch: { "*:ontime": 1000 },
      mixedShared: { "*:ontime": 300, "*:unseen": 100 },
      mixedSeparated: { "*:ontime": 400 },
    });
    expect(lensTable("statusNot2xx")).toEqual({
      unprotected: { "*:ontime": 300, "*:unseen": 700 },
      shed: { "*:ontime": 300, "*:error": 700 },
      enough: { "*:ontime": 1000 },
      batch: { "*:ontime": 300, "*:error": 700 },
      mixedShared: { "*:ontime": 300, "*:unseen": 100 },
      mixedSeparated: { "*:ontime": 300, "*:error": 100 },
    });
    expect(lensTable("dauer")).toEqual({
      unprotected: { "*:timeout": 300, "*:unseen": 700 },
      shed: { "*:ontime": 300, "*:rejected": 700 },
      enough: { "*:ontime": 1000 },
      batch: { "*:ontime": 300, "*:rejected": 700 },
      mixedShared: { "*:timeout": 300, "*:unseen": 100 },
      mixedSeparated: { "*:ontime": 300, "*:rejected": 100 },
    });
    expect(lensTable("eingang")).toEqual({
      unprotected: { "*:timeout": 1000 },
      shed: { "*:ontime": 300, "*:rejected": 700 },
      enough: { "*:ontime": 1000 },
      batch: { "*:ontime": 300, "*:rejected": 700 },
      mixedShared: { "*:timeout": 400 },
      mixedSeparated: { "*:ontime": 300, "*:rejected": 100 },
    });
    expect(lensTable("degradiert")).toEqual({
      ...lensTable("eingang"),
      enough: { "*:degraded": 1000 },
    });
    expect(lensTable("workload")).toEqual({
      unprotected: { "online:timeout": 1000 },
      shed: { "online:ontime": 300, "online:rejected": 700 },
      enough: { "online:degraded": 1000 },
      batch: { "batch:ontime": 300, "batch:later": 700 },
      mixedShared: { "online:timeout": 200, "batch:later": 200 },
      mixedSeparated: {
        "online:ontime": 200,
        "batch:ontime": 100,
        "batch:later": 100,
      },
    });
  });

  it("jede Sicht verteilt genau die angebotene Last", () => {
    for (const lens of LENS_KEYS)
      for (const r of ROWS)
        expect(
          lensSegments(rowFlows(r.key), lens).reduce((a, s) => a + s.value, 0),
          `${lens}/${r.key}`,
        ).toBe(r.total);
  });

  it("die letzte Sicht zeigt die Kundensicht, bis auf „degradiert“", () => {
    const last = LENS_KEYS[LENS_KEYS.length - 1]!;
    for (const r of ROWS) {
      const segs = lensSegments(rowFlows(r.key), last).map((s) => ({
        ...s,
        kind: s.kind === "degraded" ? "ontime" : s.kind,
      }));
      expect(segs, r.key).toEqual(lensSegments(rowFlows(r.key), "kunde"));
    }
  });
});

describe("Metrik-Sichten: die vier Punkte der Folie", () => {
  const panel = (k: Parameters<typeof rowFlows>[0], lens: LensKey) =>
    lensPanel(rowFlows(k), lens);

  it("1) Statuscode zeigt keine Timeouts: ohne Maßnahme grün, obwohl kein Kunde durchkommt", () => {
    expect(panel("unprotected", "kunde")).toMatchObject({
      pct: 0,
      tone: "bad",
    });
    for (const lens of ["status5xx", "statusNot2xx"] as const) {
      expect(panel("unprotected", lens)).toMatchObject({
        pct: 100,
        of: SIM_CAPACITY, // gezählt wird nur, was beantwortet ist
        tone: "good",
      });
      expect(panel("mixedShared", lens).tone).toBe("good");
    }
    // erst mit der Dauer rot, erst am Eingang über die ganze Nachfrage
    expect(panel("unprotected", "dauer")).toMatchObject({ pct: 0, of: 300 });
    expect(panel("unprotected", "eingang")).toMatchObject({ pct: 0, of: 1000 });
  });

  it("2) „nicht 2xx“ zeigt Back Pressure als Fehler, 5xx nur das 503", () => {
    expect(panel("shed", "status5xx")).toMatchObject({ pct: 30, tone: "bad" });
    expect(panel("batch", "status5xx")).toMatchObject({
      pct: 100,
      tone: "good",
    });
    expect(panel("batch", "statusNot2xx")).toMatchObject({
      pct: 30,
      tone: "bad",
    });
    // die bessere Lage sieht schlechter aus als ohne Trennung
    expect(panel("mixedSeparated", "statusNot2xx").pct).toBe(75);
    expect(panel("mixedShared", "statusNot2xx").pct).toBe(100);
  });

  it("3) Feature Shedding sieht ohne eigene Metrik aus wie Scaling", () => {
    const fs = rowFlows("enough");
    const scaling = flowsUnprotected(SIM_DEMAND, SIM_CAPACITY_FS);
    const kinds = (f: typeof fs, lens: LensKey) =>
      f.map((x) => classify(x, lens));
    for (const lens of [
      "kunde",
      "status5xx",
      "statusNot2xx",
      "dauer",
      "eingang",
    ] as const)
      expect(kinds(fs, lens), lens).toEqual(kinds(scaling, lens));
    expect(kinds(fs, "degradiert")).toEqual(["degraded"]);
    expect(kinds(scaling, "degradiert")).toEqual(["ontime"]);
    expect(panel("enough", "degradiert").tone).toBe("warn");
  });

  it("4) Online und Batch trennt erst das Label", () => {
    for (const lens of LENS_KEYS.slice(1, -1))
      for (const r of ROWS)
        expect(
          lensSegments(rowFlows(r.key), lens).every((s) => s.cls === null),
          `${lens}/${r.key}`,
        ).toBe(true);
    expect(panel("mixedSeparated", "degradiert")).toMatchObject({
      pct: 75,
      tone: "bad",
    });
    expect(panel("mixedSeparated", "workload")).toMatchObject({
      label: "Online gut",
      pct: 100,
      of: MIXED_ONLINE,
      tone: "good",
    });
    expect(panel("batch", "workload")).toMatchObject({ tone: "info" });
  });

  it("Zeilen, deren Panel anders urteilt als die Kundensicht, je Sicht", () => {
    const dev = Object.fromEntries(
      LENS_KEYS.map((lens) => [
        lens,
        ROWS.filter((r) => deviatesFromCustomer(rowFlows(r.key), lens)).map(
          (r) => r.key,
        ),
      ]),
    );
    expect(dev).toEqual({
      kunde: [],
      status5xx: ["unprotected", "mixedShared"],
      statusNot2xx: ["unprotected", "batch", "mixedShared", "mixedSeparated"],
      dauer: ["batch", "mixedSeparated"],
      eingang: ["batch", "mixedSeparated"],
      degradiert: ["batch", "mixedSeparated"],
      workload: [],
    });
  });

  it("Ampel: grün ab dem Ziel, genau an der Grenze", () => {
    expect(PANEL_GOOD_PCT).toBe(99);
    expect(panel("mixedSeparated", "dauer").tone).toBe("bad"); // 75 %
    // 99 von 100 rechtzeitig: genau 99 % → grün; 989 von 1.000 → rot
    expect(lensPanel(flowsShed(100, 99), "dauer")).toMatchObject({
      pct: 99,
      tone: "good",
    });
    expect(lensPanel(flowsShed(1000, 989), "dauer").tone).toBe("bad");
  });
});

// Jede Folie mit <DeadlineOutcomeViz> braucht so viele Klicks, wie die
// Grafik Zeilen hat (minus der ersten), mit `lenses` dazu einen je Sicht
// außer der Kundensicht, und reicht $clicks als step durch.
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
        // Notizen: der letzte Kommentar vor dem nächsten Folientrenner
        const rest = md.slice(m.index);
        const body = rest.slice(
          0,
          (rest.indexOf("\n---\n") + 1 || rest.length + 1) - 1,
        );
        const notes =
          [...body.matchAll(/<!--([\s\S]*?)-->/g)].at(-1)?.[1] ?? "";
        return { deck: d.name, tag: m[0], fm, notes };
      });
    });

  it("wird mindestens einmal verwendet (Smoke)", () => {
    expect(uses.length).toBeGreaterThan(0);
  });

  // Die Notizen der Sichten zitieren Panel-Werte; sie kommen aus der Rechnung.
  it.each(uses.filter((u) => /\slenses\b/.test(u.tag)))(
    "$deck: Notizen der Sichten nennen die gerechneten Panel-Werte",
    ({ notes }) => {
      const flat = notes.replace(/\s+/g, " ");
      const p = (k: Parameters<typeof rowFlows>[0], l: LensKey) =>
        lensPanel(rowFlows(k), l);
      const n = (x: number) => Math.round(x).toLocaleString("de-DE");
      expect(flat.length).toBeGreaterThan(2000); // Notizen gefunden
      expect(flat).toContain(
        `Ohne Maßnahme ${n(p("unprotected", "status5xx").pct)} % ohne 5xx`,
      );
      expect(flat).toContain(
        `Workload Separation (${n(p("mixedSeparated", "statusNot2xx").pct)} %) sieht schlechter aus als die gemeinsame Queue (${n(p("mixedShared", "statusNot2xx").pct)} %)`,
      );
      expect(flat).toContain(
        `ist jetzt rot: ${n(p("unprotected", "dauer").pct)} % von ${n(p("unprotected", "dauer").of)}/s`,
      );
      expect(flat).toContain(
        `Ohne Maßnahme: ${n(p("unprotected", "eingang").pct)} % von ${n(p("unprotected", "eingang").of)}/s statt von ${n(p("unprotected", "dauer").of)}/s`,
      );
      expect(flat).toContain(
        `Workload Separation zeigt Online ${n(p("mixedSeparated", "workload").pct)} %`,
      );
      expect(flat).toContain(`grün ab ${PANEL_GOOD_PCT} % gut`);
      // je Sicht ein Klick-Stichpunkt 7 … 12
      for (let k = 1; k < LENS_KEYS.length; k++)
        expect(notes).toMatch(
          new RegExp(`^ {2}${ROW_KEYS.length - 1 + k} `, "m"),
        );
    },
  );

  it.each(uses)("$deck: clicks und step passen", ({ tag, fm }) => {
    const lenses = /\slenses\b/.test(tag);
    const clicks = ROW_KEYS.length - 1 + (lenses ? LENS_KEYS.length - 1 : 0);
    expect(fm).toMatch(new RegExp(`^clicks: ${clicks}$`, "m"));
    expect(tag).toContain(':step="$clicks"');
  });
});
