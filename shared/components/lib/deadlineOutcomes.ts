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

/** Zeilen in Klick-Reihenfolge; die Folie braucht `clicks: ROW_KEYS.length - 1`. */
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
