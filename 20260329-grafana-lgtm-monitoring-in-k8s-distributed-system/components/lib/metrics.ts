/**
 * metrics — die Metriken der Simulator-Dashboards, gruppiert nach den vier
 * Golden Signals (Google SRE Book, Kap. 6: Latency, Traffic, Errors,
 * Saturation). Zeiten in Vielfachen der Bedienzeit 1/μ („×Bed.“).
 *
 * Errors gibt es im Modell nicht: Niemand bricht ab, kein Timeout. Die Gruppe
 * steht trotzdem in der Auswahl, ausgegraut, damit die vier Signale komplett
 * sind und die Lücke sichtbar ist.
 */

export type MetricKey = "wq" | "t" | "thr" | "rho" | "queue" | "pw";
export type Signal = "Latency" | "Traffic" | "Errors" | "Saturation";

export interface MetricDef {
  key: MetricKey;
  signal: Signal;
  /** Kurzname für Chips und Panel-Titel. */
  label: string;
  unit: string;
  /** Text für das (i)-Popover. */
  help: string;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  wq: {
    key: "wq",
    signal: "Latency",
    label: "Wartezeit Wq",
    unit: "×Bed.",
    help: "Mittlere Zeit in der Warteschlange vor der Bedienung (Wq), in Vielfachen einer Bedienzeit. Das spürt der Kunde als Verzögerung, bevor überhaupt jemand an seiner Anfrage arbeitet.",
  },
  t: {
    key: "t",
    signal: "Latency",
    label: "Gesamtzeit T",
    unit: "×Bed.",
    help: "Verweildauer gesamt T = Wartezeit + Bedienzeit, also die Antwortzeit aus Kundensicht (end-to-end).",
  },
  thr: {
    key: "thr",
    signal: "Traffic",
    label: "Durchsatz",
    unit: "/s",
    help: "Tatsächlich bediente Gäste pro Sekunde, gemessen wie rate(departures_total[5m]). Im Gleichgewicht gleich der Ankunftsrate λ: Der Koch schafft genau das, was ankommt — egal, wie lang die Schlange ist.",
  },
  rho: {
    key: "rho",
    signal: "Saturation",
    label: "Auslastung",
    unit: "%",
    help: "Anteil der Zeit, in der gearbeitet wird (Utilization), gemessen wie rate(busy_seconds_total[5m]) je Koch. Begrenzt auf 0–100 %, daher als Gauge. Sagt nichts darüber, wie lange Gäste warten.",
  },
  queue: {
    key: "queue",
    signal: "Saturation",
    label: "Queue-Länge",
    unit: "Gäste",
    help: "Wartende Gäste (ohne die gerade bediente). Das SRE Book nennt Queuing den besten Saturation-Indikator: Arbeit, die auf Bearbeitung wartet.",
  },
  pw: {
    key: "pw",
    signal: "Saturation",
    label: "P(warten)",
    unit: "%",
    help: "Anteil der Gäste, die überhaupt warten müssen, weil kein Koch sofort frei ist (Erlang C beim Pool).",
  },
};

export const SIGNALS: Signal[] = ["Latency", "Traffic", "Errors", "Saturation"];

export const ERRORS_HELP =
  "Errors: Im Modell bricht niemand ab und es gibt keinen Timeout — die Fehlerrate ist immer 0. In echten Systemen würden lange Wartezeiten genau hier auftauchen (Timeouts, 504).";
