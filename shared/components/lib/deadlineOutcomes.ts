/**
 * deadlineOutcomes.ts — reine Rechnung hinter DeadlineOutcomeViz.vue.
 *
 * Fluid-Modell im eingeschwungenen Zustand, also nach der Anlaufphase:
 * Raten in Anfragen/s, ohne Zufall. Je Situation wird aufgeteilt, was mit
 * den angebotenen Anfragen geschieht:
 *
 *   ontime    rechtzeitig (Online: in der Deadline; Batch: sofort erledigt)
 *   rejected  schnell abgewiesen (429/503), statt in den Timeout zu laufen
 *   timeout   Antwort zu spät; die Arbeit daran ist verschwendet
 *   later     angenommen, aber später erledigt (Batch-Rückstand, der im
 *             Fertigstellungsfenster abgearbeitet wird)
 *
 * Annahme „ohne Maßnahme“: Liegt die Nachfrage über der Kapazität, wächst
 * die Queue ohne Grenze, und ihre Wartezeit überholt jede Deadline. Dann
 * läuft jede Online-Anfrage in den Timeout. Das ist der Grenzfall aus dem
 * AWS-Lasttest (Verfügbarkeit 0 %, sobald selbst die schnellste Antwort
 * länger braucht als der Client-Timeout), nicht der Zustand in der ersten
 * Sekunde der Überlast.
 */

/* ===== Zahlen aus der SRE-Simulation ===== */

// Kopiert, NICHT importiert: shared/ hängt nicht vom SRE-Deck ab. Quelle ist
// 20260711-sre-simulations/components/lib/wanderingBottleneckModel.js,
// Szenario „Rabattaktion“. shared/__tests__/deadlineOutcomes.test.ts prüft,
// dass die Werte dort noch dieselben sind.
// Vereinfachung: Die 1000 req/s der Sim enthalten auch Checkouts; hier zählt
// jede Anfrage wie eine Produktseite.
export const SIM_DEMAND = 1000; // LOAD_CAMPAIGN: req/s während der Aktion
export const SIM_CAPACITY = 300; // INV_PAGES_PER_S: Produktseiten/s der Bestands-DB
export const SIM_CAPACITY_FS = 1500; // INV_PAGES_PER_S_FS: Seiten ohne Empfehlungen

/* ===== Gemischte Last (eigenes Rechenbeispiel) ===== */

// Online allein passt in die Kapazität, erst der Batch-Anteil hebt die
// Summe darüber.
export const MIXED_ONLINE = 200; // req/s Online
export const MIXED_BATCH = 200; // req/s Batch (Import, Export, Reports)
export const MIXED_CAPACITY = SIM_CAPACITY; // 300 req/s, dieselbe DB

/* ===== Typen ===== */

export type Outcome = "ontime" | "rejected" | "timeout" | "later";
export type LoadClass = "online" | "batch";

export interface Segment {
  cls: LoadClass;
  outcome: Outcome;
  value: number; // req/s
}

/** Summe der Segmente, gefiltert nach Klasse und/oder Ausgang. */
export function sum(
  segs: readonly Segment[],
  filter: { cls?: LoadClass; outcome?: Outcome } = {},
): number {
  return segs
    .filter(
      (s) =>
        (filter.cls === undefined || s.cls === filter.cls) &&
        (filter.outcome === undefined || s.outcome === filter.outcome),
    )
    .reduce((a, s) => a + s.value, 0);
}

// Segmente mit 0 req/s würden als leere Balkenstücke gezeichnet.
const nonZero = (segs: Segment[]): Segment[] => segs.filter((s) => s.value > 0);

/* ===== Online ===== */

/**
 * Ohne Maßnahme: Bei Überlast wächst die Queue ohne Grenze; jede Anfrage
 * läuft in den Timeout. Der Server arbeitet trotzdem mit voller Kapazität
 * weiter, aber für Antworten, auf die niemand mehr wartet.
 */
export function onlineUnprotected(demand: number, capacity: number) {
  const overloaded = demand > capacity;
  return {
    segments: nonZero([
      {
        cls: "online",
        outcome: overloaded ? "timeout" : "ontime",
        value: demand,
      },
    ]),
    wasted: overloaded ? capacity : 0, // req/s Arbeit für tote Antworten
  };
}

/**
 * Back Pressure als begrenzte Annahme oder Load Shedding: Angenommen wird
 * höchstens, was die Kapazität schafft; der Rest wird sofort abgewiesen.
 */
export function onlineShed(demand: number, capacity: number) {
  const accepted = Math.min(demand, capacity);
  return {
    segments: nonZero([
      { cls: "online", outcome: "ontime", value: accepted },
      { cls: "online", outcome: "rejected", value: demand - accepted },
    ]),
  };
}

/* ===== Batch ===== */

/**
 * Gedrosselt (Back Pressure, Rate Limit): Erledigt wird, was die Kapazität
 * schafft; der Rest wartet beim Erzeuger und wird später abgearbeitet.
 */
export function batchThrottled(demand: number, capacity: number) {
  const now = Math.min(demand, capacity);
  return {
    segments: nonZero([
      { cls: "batch", outcome: "ontime", value: now },
      { cls: "batch", outcome: "later", value: demand - now },
    ]),
  };
}

/* ===== Gemischte Last ===== */

/**
 * Eine gemeinsame FIFO-Queue ohne Trennung. Bei Überlast wächst sie für
 * alle; die Kapazität verteilt sich im Verhältnis der Ankünfte. Online-
 * Anfragen laufen sämtlich in den Timeout, Batch wird verspätet erledigt.
 */
export function mixedShared(online: number, batch: number, capacity: number) {
  const total = online + batch;
  if (total <= capacity) {
    return {
      segments: nonZero([
        { cls: "online", outcome: "ontime", value: online },
        { cls: "batch", outcome: "ontime", value: batch },
      ]),
      onlineServedLate: 0,
      batchServed: batch,
    };
  }
  const onlineServedLate = (capacity * online) / total;
  return {
    segments: nonZero([
      { cls: "online", outcome: "timeout", value: online },
      { cls: "batch", outcome: "later", value: batch },
    ]),
    onlineServedLate, // req/s Kapazität für Online-Antworten, die zu spät kommen
    batchServed: capacity - onlineServedLate, // req/s Batch, verspätet erledigt
  };
}

/**
 * Workload Separation: Online hat Vorrang (Priorität oder eigene Instanzen),
 * Batch bekommt nur die Restkapazität, der Überschuss wird gedrosselt.
 * Reicht die Kapazität nicht einmal für Online, wird der Online-Überschuss
 * abgewiesen statt in den Timeout geschickt.
 */
export function mixedSeparated(
  online: number,
  batch: number,
  capacity: number,
) {
  const onlineOk = Math.min(online, capacity);
  const batchNow = Math.min(batch, capacity - onlineOk);
  return {
    segments: nonZero([
      { cls: "online", outcome: "ontime", value: onlineOk },
      { cls: "online", outcome: "rejected", value: online - onlineOk },
      { cls: "batch", outcome: "ontime", value: batchNow },
      { cls: "batch", outcome: "later", value: batch - batchNow },
    ]),
    batchCapacity: capacity - onlineOk, // req/s, die Batch bleiben
  };
}

/* ===== Jitter für Batch-Starts ===== */

// Zwölf nächtliche Jobs à 5 min. Ohne Jitter starten alle um 0:00
// (`0 0 * * *`). Mit Jitter bestimmt ein Hash des Jobnamens die Startminute
// in der ersten Stunde, wie Jenkins' `H 0 * * *`. Der Hash hier ist FNV-1a,
// nur ein Stellvertreter: Jenkins rechnet anders, das Prinzip ist dasselbe
// (stabil je Job, verteilt über das Fenster, Kollisionen möglich).
export const JITTER_JOBS = [
  "backup",
  "reports",
  "search-index",
  "crm-export",
  "cleanup",
  "stock-sync",
  "billing",
  "audit",
  "metrics",
  "newsletter",
  "archive",
  "thumbnails",
] as const;
export const JITTER_JOB_MIN = 5; // Laufzeit je Job in Minuten
export const JITTER_WINDOW_MIN = 60; // Startminute 0 … 59

/** FNV-1a, 32 Bit, über die UTF-16-Codeeinheiten (Jobnamen sind ASCII). */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Laufende Jobs je Minute; Länge = Fenster + Laufzeit (letzter Start 59). */
export function concurrency(
  starts: readonly number[],
  durationMin: number,
  windowMin: number,
): number[] {
  const profile = new Array<number>(windowMin + durationMin).fill(0);
  for (const s of starts) {
    for (let m = s; m < s + durationMin; m++) profile[m]! += 1;
  }
  return profile;
}

export function jitterProfiles(
  jobs: readonly string[] = JITTER_JOBS,
  durationMin = JITTER_JOB_MIN,
  windowMin = JITTER_WINDOW_MIN,
) {
  const fixedStarts = jobs.map(() => 0);
  const hashedStarts = jobs.map((j) => fnv1a(j) % windowMin);
  const fixed = concurrency(fixedStarts, durationMin, windowMin);
  const hashed = concurrency(hashedStarts, durationMin, windowMin);
  const total = (p: number[]) => p.reduce((a, b) => a + b, 0);
  return {
    hashedStarts,
    fixed,
    hashed,
    peakFixed: Math.max(...fixed),
    peakHashed: Math.max(...hashed),
    workFixed: total(fixed), // Job-Minuten
    workHashed: total(hashed),
  };
}

/* ===== Alle Zeilen der Grafik ===== */

/**
 * Zeilen in Klick-Reihenfolge; die Folie braucht `clicks: ROW_KEYS.length - 1`,
 * ohne Jitter-Zeile (`:jitter="false"`, sie ist die letzte) eine weniger,
 * mit `lenses` zusätzlich `LENS_KEYS.length - 1`.
 */
export const ROW_KEYS = [
  "unprotected",
  "shed",
  "enough",
  "batch",
  "mixedShared",
  "mixedSeparated",
  "jitter",
] as const;
export type RowKey = (typeof ROW_KEYS)[number];

export interface BarRow {
  key: Exclude<RowKey, "jitter">;
  segments: Segment[];
  total: number; // req/s angeboten
  capacity: number; // req/s
}

export function outcomeRows(): BarRow[] {
  return [
    {
      key: "unprotected",
      segments: onlineUnprotected(SIM_DEMAND, SIM_CAPACITY).segments,
      total: SIM_DEMAND,
      capacity: SIM_CAPACITY,
    },
    {
      key: "shed",
      segments: onlineShed(SIM_DEMAND, SIM_CAPACITY).segments,
      total: SIM_DEMAND,
      capacity: SIM_CAPACITY,
    },
    {
      // Feature Shedding: gleiche DB, weniger Arbeit je Seite. Cache und
      // Scaling landen hier, wenn sie die Kapazität ebenso weit heben.
      key: "enough",
      segments: onlineUnprotected(SIM_DEMAND, SIM_CAPACITY_FS).segments,
      total: SIM_DEMAND,
      capacity: SIM_CAPACITY_FS,
    },
    {
      key: "batch",
      segments: batchThrottled(SIM_DEMAND, SIM_CAPACITY).segments,
      total: SIM_DEMAND,
      capacity: SIM_CAPACITY,
    },
    {
      key: "mixedShared",
      segments: mixedShared(MIXED_ONLINE, MIXED_BATCH, MIXED_CAPACITY).segments,
      total: MIXED_ONLINE + MIXED_BATCH,
      capacity: MIXED_CAPACITY,
    },
    {
      key: "mixedSeparated",
      segments: mixedSeparated(MIXED_ONLINE, MIXED_BATCH, MIXED_CAPACITY)
        .segments,
      total: MIXED_ONLINE + MIXED_BATCH,
      capacity: MIXED_CAPACITY,
    },
  ];
}

/**
 * Eine Skala für alle Balken: volle Breite = größte angebotene Last. So
 * liegt dieselbe Kapazität in jeder Zeile an derselben Stelle, und 200 req/s
 * sind nie breiter gezeichnet als 300 req/s. Die gemischten Zeilen (400
 * req/s) werden dadurch kürzer.
 */
export function barScale(rows: readonly BarRow[] = outcomeRows()): number {
  return Math.max(...rows.map((r) => r.total));
}

/* ===== Metrik-Sichten (Monitoring-Deck) ===== */

/**
 * Was ein Dashboard über die Anfragen einer Zeile wissen kann. Jede Zeile
 * zerfällt in Flüsse: Teilmengen mit demselben Kundenausgang (`truth`) und
 * demselben Bild beim Server.
 *
 *   answered  Der Server schließt die Anfrage ab und zählt sie erst dann
 *             (Prometheus empfiehlt das: „When they end is suggested“;
 *             promhttp und otelhttp messen nach dem Handler). Wächst die
 *             Queue, bleibt der Überschuss offen: Im eingeschwungenen
 *             Zustand beantwortet der Server höchstens seine Kapazität, den
 *             Rest zählt er nicht.
 *   code      Statuscode der Antwort. Online-Abweisen bei Überlast ist 503
 *             (SRE Book, Kap. 22: 503, sobald zu viele Anfragen in Arbeit
 *             sind), Batch-Drosselung ist 429 wie bei Kubernetes API
 *             Priority and Fairness, wenn eine Prioritätsstufe ihr Limit
 *             überschreitet.
 *   fast      Antwort innerhalb der Deadline
 *   degraded  2xx und rechtzeitig, aber mit reduziertem Ergebnis
 */
export type StatusCode = "2xx" | "429" | "503";
export interface Flow {
  cls: LoadClass;
  truth: Outcome;
  value: number; // req/s
  answered: boolean;
  code: StatusCode; // bei answered = false bedeutungslos
  fast: boolean;
  degraded: boolean;
}

type FlowInit = Pick<Flow, "cls" | "truth" | "value"> & Partial<Flow>;
const flow = (f: FlowInit): Flow => ({
  answered: true,
  code: "2xx",
  fast: true,
  degraded: false,
  ...f,
});
const nonZeroFlows = (fs: Flow[]): Flow[] => fs.filter((f) => f.value > 0);

/** Ohne Maßnahme: beantwortet wird die Kapazität (zu spät), der Rest bleibt offen. */
export function flowsUnprotected(
  demand: number,
  capacity: number,
  degraded = false,
): Flow[] {
  if (demand <= capacity)
    return nonZeroFlows([
      flow({ cls: "online", truth: "ontime", value: demand, degraded }),
    ]);
  return nonZeroFlows([
    flow({ cls: "online", truth: "timeout", value: capacity, fast: false }),
    flow({
      cls: "online",
      truth: "timeout",
      value: demand - capacity,
      answered: false,
      fast: false,
    }),
  ]);
}

/** Back Pressure / Load Shedding: Abweisen ist eine schnelle 503. */
export function flowsShed(demand: number, capacity: number): Flow[] {
  const accepted = Math.min(demand, capacity);
  return nonZeroFlows([
    flow({ cls: "online", truth: "ontime", value: accepted }),
    flow({
      cls: "online",
      truth: "rejected",
      value: demand - accepted,
      code: "503",
    }),
  ]);
}

/** Batch, gedrosselt per 429 (+ Retry-After): schnell, aber ≠ 2xx. */
export function flowsBatchThrottled(demand: number, capacity: number): Flow[] {
  const now = Math.min(demand, capacity);
  return nonZeroFlows([
    flow({ cls: "batch", truth: "ontime", value: now }),
    flow({ cls: "batch", truth: "later", value: demand - now, code: "429" }),
  ]);
}

/** Gemeinsame Queue: beantwortet wird die Kapazität im Verhältnis der Ankünfte, alles zu spät. */
export function flowsMixedShared(
  online: number,
  batch: number,
  capacity: number,
): Flow[] {
  if (online + batch <= capacity)
    return nonZeroFlows([
      flow({ cls: "online", truth: "ontime", value: online }),
      flow({ cls: "batch", truth: "ontime", value: batch }),
    ]);
  const r = mixedShared(online, batch, capacity);
  const open = { answered: false, fast: false };
  return nonZeroFlows([
    flow({
      cls: "online",
      truth: "timeout",
      value: r.onlineServedLate,
      fast: false,
    }),
    flow({
      cls: "online",
      truth: "timeout",
      value: online - r.onlineServedLate,
      ...open,
    }),
    flow({ cls: "batch", truth: "later", value: r.batchServed, fast: false }),
    flow({
      cls: "batch",
      truth: "later",
      value: batch - r.batchServed,
      ...open,
    }),
  ]);
}

/** Workload Separation: Online zuerst, Batch-Überschuss gedrosselt (429). */
export function flowsMixedSeparated(
  online: number,
  batch: number,
  capacity: number,
): Flow[] {
  const onlineOk = Math.min(online, capacity);
  const batchNow = Math.min(batch, capacity - onlineOk);
  return nonZeroFlows([
    flow({ cls: "online", truth: "ontime", value: onlineOk }),
    flow({
      cls: "online",
      truth: "rejected",
      value: online - onlineOk,
      code: "503",
    }),
    flow({ cls: "batch", truth: "ontime", value: batchNow }),
    flow({
      cls: "batch",
      truth: "later",
      value: batch - batchNow,
      code: "429",
    }),
  ]);
}

export function rowFlows(key: BarRow["key"]): Flow[] {
  switch (key) {
    case "unprotected":
      return flowsUnprotected(SIM_DEMAND, SIM_CAPACITY);
    case "shed":
      return flowsShed(SIM_DEMAND, SIM_CAPACITY);
    case "enough":
      // Zahlen aus Feature Shedding, also reduziert. Mit Scaling wäre
      // dieselbe Zeile vollständig — genau das trennt die Sicht „degradiert“.
      return flowsUnprotected(SIM_DEMAND, SIM_CAPACITY_FS, true);
    case "batch":
      return flowsBatchThrottled(SIM_DEMAND, SIM_CAPACITY);
    case "mixedShared":
      return flowsMixedShared(MIXED_ONLINE, MIXED_BATCH, MIXED_CAPACITY);
    case "mixedSeparated":
      return flowsMixedSeparated(MIXED_ONLINE, MIXED_BATCH, MIXED_CAPACITY);
  }
}

/**
 * Sichten in Klick-Reihenfolge, kumulativ: Jede fügt dem Dashboard eine
 * Konvention, eine Metrik, einen Messpunkt oder ein Label hinzu. Die letzte
 * kommt der Kundensicht am nächsten: Kein Panel alarmiert mehr anders. Was
 * keine Anfrage-Metrik sieht, bleibt offen: ob Batch später erledigt wird
 * und welche Kunden aufgeben (das sieht nur der Client).
 *
 *   kunde       die Wahrheit (wie ohne Sichten)
 *   status5xx   Server, Anfragen nach Statuscode, Fehler = 5xx (SRE
 *               Workbook, Grafana-SLO-Beispiel: 429 zählt als Erfolg)
 *   statusNot2xx  Fehler = jeder Status außer 2xx (PromQL-Beispiel zur RED-Methode)
 *   dauer       + Dauer gegen die Deadline (Histogramm-Bucket an der Deadline)
 *   eingang     + gezählt am Load Balancer statt am Server
 *   degradiert  + eigene Metrik für reduzierte Antworten
 *   workload    + Label workload=online|batch
 */
export const LENS_KEYS = [
  "kunde",
  "status5xx",
  "statusNot2xx",
  "dauer",
  "eingang",
  "degradiert",
  "workload",
] as const;
export type LensKey = (typeof LENS_KEYS)[number];

/** Wie ein Panel eine Anfrage einordnet. */
export type ViewKind = Outcome | "error" | "unseen" | "degraded";

const lensAt = (lens: LensKey) => LENS_KEYS.indexOf(lens);

export function classify(f: Flow, lens: LensKey): ViewKind {
  const k = lensAt(lens);
  if (k === 0) return f.truth;
  const has = (l: LensKey) => k >= lensAt(l);
  // Erst mit dem Label lässt sich für Batch ein eigenes Ziel anlegen
  // (Fertigstellungsfenster statt Deadline).
  const batchOwnGoal = has("workload") && f.cls === "batch";
  if (!f.answered) {
    if (!has("eingang")) return "unseen";
    return batchOwnGoal ? "later" : "timeout";
  }
  if (lens === "status5xx") return f.code === "503" ? "error" : "ontime";
  if (lens === "statusNot2xx") return f.code === "2xx" ? "ontime" : "error";
  if (f.code !== "2xx") return batchOwnGoal ? "later" : "rejected";
  if (!f.fast) return batchOwnGoal ? "later" : "timeout";
  if (f.degraded && has("degradiert")) return "degraded";
  return "ontime";
}

export interface ViewSegment {
  cls: LoadClass | null; // null: ohne Label nicht unterscheidbar
  kind: ViewKind;
  value: number;
}

const KIND_ORDER: ViewKind[] = [
  "ontime",
  "degraded",
  "error",
  "rejected",
  "timeout",
  "later",
  "unseen",
];

/**
 * Balken einer Zeile in einer Sicht: gleiche Einordnung zusammengefasst.
 * Vor dem Workload-Label kennt das Dashboard die Klassen nicht, die
 * Segmente tragen dann `cls: null`; danach erst Online, dann Batch.
 */
export function lensSegments(
  flows: readonly Flow[],
  lens: LensKey,
): ViewSegment[] {
  const labeled = lens === "kunde" || lensAt(lens) >= lensAt("workload");
  const out: ViewSegment[] = [];
  const classes: (LoadClass | null)[] = labeled ? ["online", "batch"] : [null];
  for (const cls of classes)
    for (const kind of KIND_ORDER) {
      const value = flows
        .filter(
          (f) => (cls === null || f.cls === cls) && classify(f, lens) === kind,
        )
        .reduce((a, f) => a + f.value, 0);
      if (value > 0) out.push({ cls, kind, value });
    }
  return out;
}

export type PanelTone = "good" | "bad" | "warn" | "info";
export interface Panel {
  label: string; // was als gut zählt, z. B. „ohne 5xx“
  pct: number; // 0 … 100
  of: number; // req/s, die das Panel überhaupt zählt
  tone: PanelTone;
}

const pctOf = (part: number, whole: number) =>
  whole > 0 ? (100 * part) / whole : 0;

/** Ab diesem Anteil „gut“ ist das Panel grün (Ziel 99 %). */
export const PANEL_GOOD_PCT = 99;

/**
 * Der Wert, den ein Stat-Panel dieser Sicht für die Zeile anzeigt: durch
 * alle Sichten derselbe Typ, der Anteil „gut“ an dem, was das Panel zählt
 * (der Server zählt nur, was er beantwortet). Was „gut“ heißt, legt die
 * Sicht fest. Ausnahmen: degradierte Antworten (eingeschränkt) und reiner
 * Batch mit eigenem Ziel (später erledigt, erwartet).
 */
export function lensPanel(flows: readonly Flow[], lens: LensKey): Panel {
  const segs = lensSegments(flows, lens);
  const total = (s: readonly ViewSegment[]) =>
    s.reduce((a, x) => a + x.value, 0);
  const of = (kind: ViewKind, s: readonly ViewSegment[] = segs) =>
    total(s.filter((x) => x.kind === kind));
  const counted = total(segs) - of("unseen");
  const tone = (p: number): PanelTone => (p >= PANEL_GOOD_PCT ? "good" : "bad");

  if (of("degraded") > 0) {
    const p = pctOf(of("degraded"), counted);
    return { label: "degradiert", pct: p, of: counted, tone: "warn" };
  }
  const labeled = segs.every((x) => x.cls !== null);
  const online = segs.filter((x) => x.cls === "online");
  if (labeled && online.length === 0) {
    const p = pctOf(of("later"), counted);
    const label = lens === "kunde" ? "Batch später" : "Batch toleriert";
    return { label, pct: p, of: counted, tone: "info" };
  }
  if (labeled) {
    const p = pctOf(of("ontime", online), total(online));
    const label = lens === "kunde" ? "rechtzeitig" : "Online gut";
    return { label, pct: p, of: total(online), tone: tone(p) };
  }
  const p = pctOf(of("ontime"), counted);
  const label =
    lens === "status5xx" ? "ohne 5xx" : lens === "statusNot2xx" ? "2xx" : "gut";
  return { label, pct: p, of: counted, tone: tone(p) };
}

/**
 * Weicht das Urteil des Panels von der Kundensicht ab? Grün, eingeschränkt
 * und erwartet gelten als „in Ordnung“, nur Rot als Alarm. Jede Sicht ist
 * technisch korrekt; „weicht ab“ heißt: Sie führt hier zu einer anderen
 * Entscheidung als die Kundensicht.
 */
export function deviatesFromCustomer(
  flows: readonly Flow[],
  lens: LensKey,
): boolean {
  const alarm = (l: LensKey) => lensPanel(flows, l).tone === "bad";
  return alarm(lens) !== alarm("kunde");
}
