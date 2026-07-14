<script setup>
// Vergleichsmatrix LGTM-Stack vs. Sentry (Stand Mitte 2026) — erste Verwendung
// der geteilten MatrixPivot-Kreuztabelle. Marks nutzen das eingebaute Schema
// (yes ✓ / partial ◐ / no ✗ / none); Details öffnen als Klick-Bubbles.
// Faktenlage (Primärquellen, 07/2026): Sentry Logs GA seit 09/2025;
// General-Purpose-Metriken fehlen (Custom-Metrics-Beta 10/2024 eingestellt,
// „Application Metrics“ nur Open Beta 11/2025, kein OTLP-Metrics-Ingest);
// kein natives SLO-/Burn-Rate-Alerting; Ticket-Auto-Create via Alert Rules.
import MatrixPivot from "@shared/components/MatrixPivot.vue";

const data = {
  dimensions: [
    { key: "fokus", label: "Fokus & Blickwinkel", short: "wer schaut worauf" },
    { key: "signale", label: "Signal-Abdeckung", short: "MELT + Extras" },
    {
      key: "metriken",
      label: "Metriken & SLO/Burn-Rate",
      short: "PromQL · Error Budget",
    },
    { key: "k8s", label: "K8s- & Infra-Sicht", short: "Cluster bis Pod" },
    {
      key: "tickets",
      label: "Issue- & Ticket-Workflow",
      short: "Alarm → Aufgabe",
    },
    { key: "betrieb", label: "Betrieb & Lizenz", short: "Self-Hosted" },
  ],
  tools: [
    {
      key: "lgtm",
      name: "Grafana LGTM",
      color: "#F46800",
      cells: {
        fokus: {
          mark: "none",
          teaser: "Plattform & Infrastruktur",
          detail:
            "Metriken, Logs, Traces und Profile der ganzen Plattform — vom Node bis zum Service. Zielgruppe Ops/SRE; Dashboards und Alerting als Zentrale.",
        },
        signale: {
          mark: "yes",
          teaser: "Metrics · Logs · Traces · Profiles",
          detail:
            "Vier Backends (Mimir, Loki, Tempo, Pyroscope), ein UI. Alle Signale OTLP-nativ über Grafana Alloy bzw. OTel Collector.",
        },
        metriken: {
          mark: "yes",
          teaser: "PromQL + Burn-Rate-Alerts",
          detail:
            "Mimir speichert General-Purpose-Metriken; Grafana alarmiert nach SRE-Workbook-Policy (Multi-Window-Burn-Rate) inkl. Recovery Thresholds.",
        },
        k8s: {
          mark: "yes",
          teaser: "K8s-nativ via Alloy",
          detail:
            "Node-Metriken, Pod-Logs und Cluster-Dashboards out of the box — Grafana Alloy bzw. kube-prometheus-stack.",
        },
        tickets: {
          mark: "partial",
          teaser: "Ticket-Lane der SLO-Policy",
          detail:
            "Die Burn-Rate-Policy definiert „Aufgabe (Ticket)“ als langsamste Eskalationsstufe (Burn 1× über 3 Tage); die Ticketanlage selbst läuft über Webhooks/Integrationen.",
        },
        betrieb: {
          mark: "none",
          teaser: "AGPLv3 · leichtgewichtig",
          detail:
            "Jede Komponente einzeln deploybar und skalierbar (Helm-Charts); Lizenz AGPLv3.",
        },
      },
    },
    {
      key: "sentry",
      name: "Sentry",
      color: "#7B51F8",
      cells: {
        fokus: {
          mark: "none",
          teaser: "Applikation & Developer",
          detail:
            "Blick aus der App heraus: Exceptions mit Stacktrace, Releases, Source Maps, Session Replay. Zielgruppe Entwickler — vom Fehler zum Commit.",
        },
        signale: {
          mark: "partial",
          teaser: "Errors · Traces · Logs · Replay",
          detail:
            "Stark bei Errors/Issues (Auto-Grouping), Tracing, Profiling, Session Replay, Crons, Uptime. Logs GA seit 09/2025, trace-verlinkt. OTLP: Traces + Logs ja — Metrics nein.",
        },
        metriken: {
          mark: "no",
          teaser: "keine General-Purpose-Metriken",
          detail:
            "Custom-Metrics-Beta 10/2024 eingestellt; trace-basierte „Application Metrics“ erst Open Beta (11/2025). Alerting statisch, Prozent oder Anomalie — kein natives SLO-/Error-Budget-/Burn-Rate-Alerting.",
        },
        k8s: {
          mark: "partial",
          teaser: "nur App-Ebene",
          detail:
            "sentry-kubernetes-Agent (Beta) meldet K8s-Events als Errors plus Cron-Checks. Keine Node-Metriken, keine Pod-Logs, keine Cluster-Dashboards.",
        },
        tickets: {
          mark: "yes",
          teaser: "Auto-Tickets aus Alert Rules",
          detail:
            "Alert Rules legen Tickets automatisch an: Jira, GitHub, Azure DevOps, Linear u. a. — rund 19 Issue-Tracker-Integrationen, Two-Way-Sync ab Team-Plan.",
        },
        betrieb: {
          mark: "none",
          teaser: "FSL · schwergewichtig",
          detail:
            "Self-Hosted = Docker-Compose-Monolith mit Kafka, ClickHouse, PostgreSQL, Redis; min. 4 Cores / 16 GB RAM. FSL („Fair Source“, nach 2 Jahren Apache 2.0); SaaS volumenbasiert pro Signal.",
        },
      },
    },
  ],
};

const legend = [
  { mark: "yes", label: "stark" },
  { mark: "partial", label: "teilweise / Beta" },
  { mark: "no", label: "fehlt" },
];
</script>

<template>
  <div class="sentry-compare">
    <MatrixPivot :data="data" :legend="legend" />
  </div>
</template>

<style scoped>
/* MatrixPivot setzt px-Schriften (9-10px) — für nur zwei Tool-Spalten auf dem
 * 980px-Canvas zu klein. zoom skaliert layout-konsistent; die Bubble-
 * Positionierung der Komponente rechnet ihren Scale-Faktor selbst aus und
 * absorbiert zoom wie die Slidev-Skalierung. */
.sentry-compare {
  zoom: 1.25;
}
</style>
