<script setup lang="ts">
// Einordnung „Wer übernimmt was beim SLO-/Burn-Rate-Alerting?“ — zwei Tabs:
//   1. Matrix Grafana · Sentry · Zusatzsystem (geteilte MatrixPivot-Kreuztabelle,
//      Muster wie SentryCompare.vue; Marks yes ✓ / partial ◐ / no ✗ / none).
//   2. Entscheidungsliste „Wann ist ein Zusatzsystem nötig?“ (12 Auslöser,
//      links wählen, rechts lesen).
// Faktenlage: Recherche-Dossier vom 22.11.2026 (Primärquellen roh gelesen:
// grafana.com/docs, docs.sentry.io, getsentry/sentry, sre.google/workbook).
// Versionsstand: Grafana v13.3.1, Sentry „Monitors & Alerts“ (GA 07.05.2026).
// Im Detailtext steht „Einschätzung“, wo das Dossier keine wörtliche Quelle
// hat, und „nicht geprüft“, wo nichts recherchiert wurde.
import { computed, ref } from "vue";
import MatrixPivot from "@shared/components/MatrixPivot.vue";
import { useGrafanaPalette } from "./lib/grafanaPalette";

type Mark = "yes" | "partial" | "no" | "none";

interface Cell {
  mark: Mark;
  teaser: string;
  detail: string;
}

const DIMENSIONS = [
  { key: "mwmbr", label: "MWMBR eingebaut" },
  { key: "slo", label: "SLO & Error Budget" },
  { key: "and", label: "Zwei Fenster per AND" },
  { key: "zustand", label: "Pending & Recovery" },
  { key: "routing", label: "Routing & Inhibition" },
  { key: "oncall", label: "On-Call & Eskalation" },
  { key: "tickets", label: "Issues & Tickets" },
  { key: "crash", label: "Crash-free-Rate" },
  { key: "uptime", label: "Uptime & Cron" },
  { key: "meta", label: "Meta-Monitoring" },
] as const;

type DimKey = (typeof DIMENSIONS)[number]["key"];

interface Tool {
  key: string;
  name: string;
  color: string;
  cells: Record<DimKey, Cell>;
}

const C = useGrafanaPalette();

const tools = computed<Tool[]>(() => [
  {
    key: "grafana",
    name: "Grafana · Alerting, SLO, Mimir-Ruler",
    color: "#F46800",
    cells: {
      mwmbr: {
        mark: "yes",
        teaser: "Cloud: SLO-App · OSS: Sloth, Pyrra",
        detail:
          "Grafana SLO (Cloud) erzeugt die vier SRE-Workbook-Bedingungen selbst: 14,4× und 6× als critical, 3× und 1× als warning. Als einstellbar nennt die Doku nur Name, Labels, Annotationen und eine Mindestzahl an Fehlern, Fenster und Faktoren nicht. In OSS schreibt man die Regeln als PromQL für den Mimir-Ruler oder lässt sie von Sloth oder Pyrra generieren. Quelle: grafana.com/docs, SLO „configure burn rate notifications“.",
      },
      slo: {
        mark: "partial",
        teaser: "SLO-App nur für Cloud belegt",
        detail:
          "Grafana SLO (Cloud): Periode per Default 28 Tage, mindestens 7 Tage, höchstens 70 SLOs pro Instanz, je SLO 10 bis 12 Recording Rules. Eine OSS-Fassung der App hat die Recherche nicht gefunden. In OSS halten Sloth oder Pyrra die SLOs als Code. Quelle: grafana.com/docs, SLO „introduction“ und „create“.",
      },
      and: {
        mark: "yes",
        teaser: "PromQL and/or · Math && ||",
        detail:
          "Zwei Wege: ein PromQL-Ausdruck mit and/or im Mimir- oder Loki-Ruler, oder eine Grafana-managed Rule mit mehreren Queries, je eigenem Zeitraum, verknüpft per Math-Ausdruck. Das Fenster bestimmt der Range-Selektor in PromQL, nicht der Zeitraum der Oberfläche. Quelle: Grafana-Blog zu MWMBR in Grafana Cloud (2025).",
      },
      zustand: {
        mark: "yes",
        teaser: "Pending · Keep firing · Recovery",
        detail:
          "Pending period verzögert den Alarm, Keep firing for hält ihn nach der Erholung, der Recovery threshold löst erst unter einer zweiten Schwelle auf (seit Anfang 2024). Bei MWMBR übernimmt das kurze Fenster die Rolle der Hysterese; das SRE Workbook rät dort von for ab. Quelle: grafana.com/docs, „alert rule evaluation“.",
      },
      routing: {
        mark: "partial",
        teaser: "Policies ja · Inhibition ab v13",
        detail:
          "Notification Policies bilden einen Baum aus Label-Matchern mit Group by, dazu Mute Timings und Silences. Inhibition für Grafana-managed Alerts gibt es erst ab Grafana 13, nur über die API (v1beta1), ohne Oberfläche. In Grafana 12 braucht sie einen externen Alertmanager. Quelle: grafana.com/docs, „inhibition rules“.",
      },
      oncall: {
        mark: "no",
        teaser: "kein Dienstplan im Alerting",
        detail:
          "Grafana Alerting kennt keine Rotation und keine Eskalation. Grafana Cloud IRM ist ein kostenpflichtiges Add-on (Free: 3 Nutzer; Pro: 20 $ je aktivem Nutzer über 3, die Pro-Plattformgebühr von 19 $ im Monat enthält 3). Grafana OnCall OSS ist seit 24.03.2026 archiviert. Sonst geht der Alarm per Contact Point an ein Alarmierungs-System. Quelle: grafana.com/pricing, Grafana-Blog „OnCall maintenance mode“.",
      },
      tickets: {
        mark: "partial",
        teaser: "gruppiert Alerts, keine Issues",
        detail:
          "Grafana gruppiert Alert-Instanzen nach Labels, legt aber keine Issues an. Für den langsamen Burn empfiehlt die SLO-Doku Jira, ServiceNow oder einen Team-Channel. Ob es dafür einen eigenen Jira-Contact-Point gibt, ist nicht geprüft. Quelle: grafana.com/docs, SLO „configure burn rate notifications“.",
      },
      crash: {
        mark: "partial",
        teaser: "über das Sentry-Datasource-Plugin",
        detail:
          "Das Sentry-Datasource-Plugin (v2.2.12, ab Grafana 10.4) erlaubt Alerts wie session.crash_free_rate < 0.995. Jede Auswertung zählt gegen die Rate Limits der Sentry-API. MWMBR auf Sentry-Daten ist so möglich, eine Anleitung dafür gibt es nicht (Einschätzung). Quelle: grafana.com/docs/plugins/grafana-sentry-datasource.",
      },
      uptime: {
        mark: "none",
        teaser: "nicht geprüft",
        detail:
          "Grafana Cloud Synthetic Monitoring war nicht Teil der Recherche. Die Zelle bleibt deshalb ohne Bewertung.",
      },
      meta: {
        mark: "partial",
        teaser: "Metriken ja · Watchdog fehlt",
        detail:
          "Grafana liefert Metriken über sich selbst, etwa grafana_alerting_scheduler_behind_seconds. Auswerten muss sie ein externer Prometheus oder Mimir. Einen unabhängigen Watchdog beschreibt die Doku nicht. Der IRM-Heartbeat (Cloud) legt eine Alert Group an, wenn Grafana Alerting verstummt. Quelle: grafana.com/docs, „monitor alerting“.",
      },
    },
  },
  {
    key: "sentry",
    name: "Sentry · Monitors & Alerts",
    color: "#7B51F8",
    cells: {
      mwmbr: {
        mark: "no",
        teaser: "kein Burn-Rate-Alerting",
        detail:
          "Der offene Feature Request #126639 (seit 06.10.2026) hält fest: „Sentry has no first-class service level objectives (SLOs) or error budget tracking“, also auch keinen Alarm auf die Burn Rate. Quelle: github.com/getsentry/sentry/issues/126639.",
      },
      slo: {
        mark: "no",
        teaser: "kein Budget · Fenster höchstens 1 d",
        detail:
          "Sentry kennt kein SLO-Objekt, kein Error Budget und keine rollierende Periode. Das längste Fenster eines Monitors ist 1 Tag. Ein Budget über 28 oder 30 Tage lässt sich damit nicht abbilden. Quelle: Frontend-Code getsentry/sentry, timePeriods.tsx.",
      },
      and: {
        mark: "no",
        teaser: "ein Aggregat, ein Fenster",
        detail:
          "Ein Monitor wertet ein Aggregat über ein Fenster aus (1 min bis 1 d); Monitore lassen sich nicht per AND verknüpfen. Annäherung: mehrere Monitore, die jeder für sich feuern, oder ein Monitor mit den Prioritäten medium und high (Einschätzung). Ein Alert kann zwar Frequenzfilter per „all“ verknüpfen, etwa „Percentage of sessions affected“ über 1 h und über 5 min, aber nur je Issue und mit Fenstern bis 1 h. Quelle: docs.sentry.io „Monitors & Alerts“, „create alerts“ und Code.",
      },
      zustand: {
        mark: "partial",
        teaser: "nur für Uptime und Cron belegt",
        detail:
          "Uptime: Alarm nach 3 Fehlschlägen in Folge, Erholung nach 1 Erfolg (Defaults). Cron: Failure Tolerance und Check-in-Margin. Für Metric Monitors sind Pending und ein eigener Resolve-Schwellwert nicht belegt. Quelle: docs.sentry.io, „uptime monitoring“ und „crons“.",
      },
      routing: {
        mark: "partial",
        teaser: "Trigger, Filter, Throttling",
        detail:
          "Alerts haben Trigger, Filter (all, any, none) und Throttling von 5 Minuten bis 30 Tage; Ownership Rules schlagen Zuständige vor. Inhibition und eine Gruppierung über mehrere Monitore fehlen. Quelle: docs.sentry.io, „create alerts“.",
      },
      oncall: {
        mark: "no",
        teaser: "leitet an PagerDuty weiter",
        detail:
          "Sentry hat keinen Dienstplan und keine Eskalation. Es reicht den Alarm an PagerDuty (mit Severity) oder Opsgenie (mit Priority) weiter. Opsgenie ist seit 04.06.2025 nicht mehr käuflich, der Support endet am 05.04.2027. Quelle: docs.sentry.io, atlassian.com/licensing/opsgenie.",
      },
      tickets: {
        mark: "yes",
        teaser: "Issues per Fingerprint · Jira",
        detail:
          "Sentrys Stärke: Es fasst Fehler per Fingerprint zu Issues zusammen und alarmiert auf „new“, „escalates“ und „regresses“. Tickets legt es in Jira, GitHub und Azure DevOps an. Quelle: docs.sentry.io, „create alerts“.",
      },
      crash: {
        mark: "yes",
        teaser: "nativ · Fenster ab 1 h",
        detail:
          "crash_free_rate(session) und crash_free_rate(user) sind eingebaut, das Fenster beträgt mindestens 1 Stunde. Sessions werden weder gefiltert noch gesampelt, Error-Events schon. Eine Session im Server-Modus entspricht ungefähr einem Request. Quelle: docs.sentry.io, „release health“, und Code.",
      },
      uptime: {
        mark: "yes",
        teaser: "Uptime 1 min bis 1 h · Cron",
        detail:
          "Uptime-Checks laufen aus mehreren Regionen im Intervall von 1 Minute bis 1 Stunde. Der Header Sentry-Trace verknüpft einen Fehlschlag mit dem Backend-Trace. Cron Monitors prüfen, ob ein Job sich meldet. Quelle: docs.sentry.io, „uptime monitoring“ und „crons“.",
      },
      meta: {
        mark: "partial",
        teaser: "Cron als Heartbeat denkbar",
        detail:
          "Sentry läuft als SaaS außerhalb des Clusters. Ein Cron Monitor könnte deshalb den Heartbeat des Grafana-Stacks empfangen. Das ist eine Einschätzung; dokumentiert ist dieser Einsatz nicht.",
      },
    },
  },
  {
    key: "extra",
    name: "Zusatz · On-Call, Incident, SLO",
    color: C.value.theory,
    cells: {
      mwmbr: {
        mark: "none",
        teaser: "nicht nötig",
        detail:
          "Die Regeln erzeugt Grafana SLO oder ein Generator wie Sloth oder Pyrra; ausgewertet werden sie im Mimir-Ruler. Ein weiteres System braucht es dafür nicht (Einschätzung).",
      },
      slo: {
        mark: "partial",
        teaser: "SLO-Plattform erst bei vielen SLOs",
        detail:
          "Eine eigene SLO-Plattform lohnt sich erst bei vielen SLOs über mehrere Datenquellen, mit Governance und Reporting (Einschätzung). Preisanker: Nobl9 Teams kostet 14.950 $ im Jahr für 50 SLO Units. Quelle: nobl9.com/pricing.",
      },
      and: {
        mark: "none",
        teaser: "nicht nötig",
        detail:
          "Die AND-Verknüpfung zweier Fenster ist ein PromQL-Ausdruck. Sie gehört in die Alert-Regel, nicht in ein nachgelagertes System (Einschätzung).",
      },
      zustand: {
        mark: "none",
        teaser: "bleibt in der Alert-Regel",
        detail:
          "Pending, Keep firing und Recovery entscheiden, wann eine Regel feuert. Ein Alarmierungs-System setzt erst danach an: Es verlangt eine Quittierung und eskaliert, wenn sie ausbleibt (Einschätzung).",
      },
      routing: {
        mark: "yes",
        teaser: "Korrelation über alle Quellen",
        detail:
          "Ein Alertmanager gruppiert nur, was bei ihm ankommt. Meldet dieselbe Störung sich aus Grafana, Sentry und der Cloud, korreliert ein System darüber: Keep (Open Source, seit 05/2025 bei Elastic) oder das Alarmierungs-System, etwa PagerDuty AIOps. Für Inhibition bis Grafana 12.4 braucht es einen externen Alertmanager. Quelle: github.com/keephq/keep.",
      },
      oncall: {
        mark: "yes",
        teaser: "Rotation, Quittierung, Telefon",
        detail:
          "Dienstplan, Quittierungspflicht, Eskalation bei Schweigen, Anruf und SMS liefern nur Grafana Cloud IRM, PagerDuty oder incident.io. Für ein einzelnes Team gibt es kostenlose Pläne: PagerDuty Free (5 Nutzer, 1 Schedule) und incident.io Basic. Quelle: pagerduty.com/pricing, incident.io/pricing.",
      },
      tickets: {
        mark: "partial",
        teaser: "Incident-Register, falls DORA gilt",
        detail:
          "Gilt DORA, sind alle IKT-Vorfälle zu erfassen, zu klassifizieren und schwere zu melden (Art. 17 bis 19). Das verlangt ein auditierbares Register mit Timeline und Postmortem; Grafana und Slack allein liefern das nicht (Einschätzung). Versicherungsvermittler, die KMU sind, nimmt Art. 2(3)(e) aus. Quelle: eur-lex.europa.eu, EIOPA Q&A DORA237.",
      },
      crash: {
        mark: "none",
        teaser: "nicht nötig",
        detail:
          "Die Crash-free-Rate misst Sentry selbst. Ein Zusatzsystem trägt dazu nichts bei (Einschätzung).",
      },
      uptime: {
        mark: "partial",
        teaser: "Statusseite, extern gehostet",
        detail:
          "Wer Verfügbarkeit zusagt oder viele Kundenanfragen erwartet, braucht eine Statusseite außerhalb der eigenen Infrastruktur: Atlassian Statuspage (kostenlos bis 100 Abonnenten), incident.io oder PagerDuty. Grafana betreibt status.grafana.com selbst auf Atlassian Statuspage. Quelle: atlassian.com/software/statuspage/pricing.",
      },
      meta: {
        mark: "yes",
        teaser: "Dead Man's Switch von außen",
        detail:
          "Läuft LGTM im selben Cluster wie die Anwendung, fällt beides gemeinsam aus. Muster: eine Watchdog-Regel vector(1) feuert dauernd an einen externen Empfänger, der Alarm schlägt, sobald das Signal ausbleibt: IRM-Heartbeat, Healthchecks.io, Dead Man's Snitch. Quelle: kube-prometheus, kubePrometheus-prometheusRule.yaml.",
      },
    },
  },
]);

const matrix = computed(() => ({ dimensions: DIMENSIONS, tools: tools.value }));

const legend = [
  { mark: "yes", label: "deckt es ab" },
  { mark: "partial", label: "mit Einschränkung" },
  { mark: "no", label: "fehlt" },
];

// ── Tab 2: Auslöser für ein Zusatzsystem ─────────────────────────────────

type Group = "immer" | "pager" | "stoerfall" | "pflicht" | "sonder";

interface Trigger {
  id: number;
  group: Group;
  title: string;
  /** Woran man den Fall erkennt. */
  when: string;
  /** Was Grafana und Sentry dabei nicht leisten. */
  gap: string;
  /** Was das Zusatzsystem ist. */
  fix: string;
  source: string;
}

const GROUPS = computed<Record<Group, { label: string; color: string }>>(
  () => ({
    immer: { label: "gilt immer", color: C.value.crit },
    pager: { label: "Rufbereitschaft", color: C.value.alt },
    stoerfall: { label: "Störfall", color: C.value.accent },
    pflicht: { label: "SLO & Pflicht", color: C.value.series.t ?? "#9333ea" },
    sonder: { label: "Sonderfall", color: C.value.textMid },
  }),
);

const TRIGGERS: Trigger[] = [
  {
    id: 1,
    group: "immer",
    title: "Das Monitoring fällt selbst aus",
    when: "LGTM läuft im selben Cluster wie die Anwendung. Dann gilt dieser Punkt immer.",
    gap: "Ein toter Alertmanager meldet nichts, und Stille sieht aus wie Normalbetrieb.",
    fix: "Watchdog-Regel vector(1) an einen Dead Man's Switch außerhalb von Cluster, Cloud-Account und Alerting-Stack: IRM-Heartbeat, Healthchecks.io, Dead Man's Snitch, Cronitor oder Better Stack.",
    source: "kube-prometheus, kubePrometheus-prometheusRule.yaml",
  },
  {
    id: 2,
    group: "pager",
    title: "Rufbereitschaft außerhalb der Geschäftszeit",
    when: "Nachts oder am Wochenende muss ein Mensch den Alarm quittieren.",
    gap: "Der Alertmanager kennt Zeitfenster (time_intervals), aber keine Rotation.",
    fix: "Grafana Cloud IRM, PagerDuty oder incident.io.",
    source: "prometheus/alertmanager, docs/configuration.md",
  },
  {
    id: 3,
    group: "pager",
    title: "Eskalation, Telefon oder SMS",
    when: "Bleibt die Quittierung aus, soll der Alarm die nächste Person anrufen.",
    gap: "Weder Grafana Alerting noch Sentry können das. OnCall OSS ist seit 24.03.2026 archiviert und ruft ohne eigenes Twilio-Konto niemanden an.",
    fix: "Ein Alarmierungs-System mit Escalation Chain. In IRM startet eine neue Integration ohne Chain; man muss sie selbst anhängen.",
    source:
      "Grafana-Blog „OnCall maintenance mode“; grafana.com/docs, IRM „connect“",
  },
  {
    id: 4,
    group: "pager",
    title: "Mehrere Teams mit eigenen Dienstplänen",
    when: "Jedes Team hat eigene Zeiten, Vertretungen und Eskalationswege.",
    gap: "Notification Policies und Mimir-Tenants trennen die Alarme, aber sie planen keine Dienste. Als Kipppunkt gelten etwa 3 bis 4 Teams (Einschätzung).",
    fix: "Ein Alarmierungs-System mit Plänen je Team. Für ein einzelnes Team reichen die kostenlosen Pläne von PagerDuty (5 Nutzer, 1 Schedule) oder incident.io.",
    source: "pagerduty.com/pricing, incident.io/pricing",
  },
  {
    id: 5,
    group: "stoerfall",
    title: "Dieselbe Störung aus drei Quellen",
    when: "Grafana, Sentry und der Cloud-Anbieter melden denselben Ausfall je für sich.",
    gap: "Der Alertmanager gruppiert und dedupliziert nur, was bei ihm ankommt.",
    fix: "Korrelation über den Quellen: Keep (Open Source, v0.55.0 vom 03.11.2026) oder das Alarmierungs-System, etwa PagerDuty AIOps als Add-on.",
    source: "github.com/keephq/keep",
  },
  {
    id: 6,
    group: "stoerfall",
    title: "Das SaaS-Alarmierungs-System fällt aus",
    when: "Der einzige Weg zum Menschen führt über einen Anbieter.",
    gap: "Grafana IRM am 05.06.2026: „users are not currently getting paged“, gelöst nach etwa 5,4 Stunden.",
    fix: "Ein zweiter, unabhängiger Kanal, etwa ein Heartbeat bei einem anderen Anbieter.",
    source: "status.grafana.com, Incident 8rpwnq74lwvz",
  },
  {
    id: 7,
    group: "stoerfall",
    title: "Mehrere Cluster oder Regionen",
    when: "Eine zentrale Rufbereitschaft betreut mehrere Cluster, oder das WAN kann sich teilen.",
    gap: "Ein einzelner Alertmanager unterdrückt nichts über Cluster-Grenzen hinweg.",
    fix: "Lokale Alertmanager, ein zentrales Routing und ein Alarmierungs-System (Einschätzung).",
    source: "Einschätzung aus der Recherche, ohne Primärquelle",
  },
  {
    id: 8,
    group: "stoerfall",
    title: "Kunden im Störfall informieren",
    when: "Verfügbarkeit ist zugesagt, oder ein Ausfall löst viele Kundenanfragen aus.",
    gap: "Eine Statusseite im eigenen Cluster fällt mit dem Cluster aus.",
    fix: "Extern gehostete Statusseite: Atlassian Statuspage (kostenlos bis 100 Abonnenten), incident.io oder PagerDuty.",
    source: "atlassian.com/software/statuspage/pricing",
  },
  {
    id: 9,
    group: "pflicht",
    title: "SLOs mit rollierendem 30-Tage-Budget",
    when: "Das Team will ein Error Budget über 28 oder 30 Tage führen.",
    gap: "In Sentry ausgeschlossen: Fenster höchstens 1 Tag, kein AND. Grafana schafft es mit Grafana SLO, Sloth oder Pyrra.",
    fix: "Meist keines. Eine SLO-Plattform lohnt sich erst bei vielen SLOs über mehrere Datenquellen (Nobl9 Teams: 14.950 $ im Jahr für 50 SLO Units).",
    source: "getsentry/sentry, timePeriods.tsx; nobl9.com/pricing",
  },
  {
    id: 10,
    group: "pflicht",
    title: "DORA-Pflicht",
    when: "Das Unternehmen ist ein Finanzunternehmen im Sinn von DORA. Ein Versicherungsvermittler fällt erst darunter, wenn er über der KMU-Schwelle liegt: ab 250 Personen, oder über 50 Mio. € Umsatz und zugleich über 43 Mio. € Bilanzsumme.",
    gap: "DORA verlangt, alle IKT-Vorfälle zu erfassen, zu klassifizieren und schwere zu melden (Art. 17 bis 19). Grafana und Slack liefern kein auditierbares Register (Einschätzung).",
    fix: "Incident-Management mit Register, Timeline und Postmortem. Versicherungsvermittler, die KMU sind, nimmt Art. 2(3)(e) aus.",
    source: "eur-lex.europa.eu, Verordnung (EU) 2022/2554; EIOPA Q&A DORA237",
  },
  {
    id: 11,
    group: "sonder",
    title: "Business-Alerts mit Event-Time oder Joins",
    when: "Die Bedingung verknüpft mehrere Streams oder stößt dauerhafte Folgeaktionen an.",
    gap: "Einfache Schwellwerte auf SQL schafft Grafana selbst. Joins über Streams und Event-Time nicht (Einschätzung).",
    fix: "Stream-Processing oder eine Workflow-Engine; das Ergebnis fließt als Metrik zurück nach Mimir.",
    source: "Einschätzung aus der Recherche, ohne Primärquelle",
  },
  {
    id: 12,
    group: "sonder",
    title: "Inhibition bis Grafana 12.4",
    when: "Der Alarm soll das Ticket derselben Störung unterdrücken, und Grafana ist älter als 13.",
    gap: "Inhibition für Grafana-managed Alerts gibt es erst ab Grafana 13, dort nur über die API.",
    fix: "Ein externer Alertmanager oder das Upgrade auf Grafana 13.",
    source: "grafana.com/docs, „inhibition rules“",
  },
];

type Tab = "matrix" | "trigger";
const tab = ref<Tab>("matrix");
const selectedId = ref(1);
const selected = computed<Trigger>(
  () => TRIGGERS.find((t) => t.id === selectedId.value) ?? TRIGGERS[0]!,
);
const usedGroups = computed(() =>
  (Object.keys(GROUPS.value) as Group[]).map((g) => ({
    key: g,
    ...GROUPS.value[g],
  })),
);
</script>

<template>
  <div class="as-root">
    <div class="as-tabs" role="tablist">
      <button
        role="tab"
        class="as-tab"
        :class="{ on: tab === 'matrix' }"
        :aria-selected="tab === 'matrix'"
        @click="tab = 'matrix'"
      >
        Wer übernimmt was?
      </button>
      <button
        role="tab"
        class="as-tab"
        :class="{ on: tab === 'trigger' }"
        :aria-selected="tab === 'trigger'"
        @click="tab = 'trigger'"
      >
        Wann ist ein Zusatzsystem nötig?
      </button>
      <span class="as-stand"
        >Stand 22.11.2026 · Grafana 13.3 · Sentry SaaS</span
      >
    </div>

    <div v-show="tab === 'matrix'" class="as-matrix">
      <MatrixPivot
        :data="matrix"
        :legend="legend"
        hint="ⓘ = Klick (oder Hover) für Details und Quelle"
      />
    </div>

    <div v-show="tab === 'trigger'" class="as-trig">
      <div class="as-list">
        <button
          v-for="t in TRIGGERS"
          :key="t.id"
          class="as-item"
          :class="{ on: t.id === selectedId }"
          :style="{ '--g': GROUPS[t.group].color }"
          :aria-pressed="t.id === selectedId"
          @click="selectedId = t.id"
        >
          <span class="as-num">{{ t.id }}</span>
          <span class="as-title">{{ t.title }}</span>
        </button>
        <div class="as-groups">
          <span v-for="g in usedGroups" :key="g.key" class="as-group">
            <span class="as-swatch" :style="{ background: g.color }"></span
            >{{ g.label }}
          </span>
        </div>
      </div>

      <div class="as-detail" :style="{ '--g': GROUPS[selected.group].color }">
        <div class="as-d-head">
          <span class="as-d-badge">{{ GROUPS[selected.group].label }}</span>
          <span class="as-d-title">{{ selected.title }}</span>
        </div>
        <dl class="as-dl">
          <dt>Auslöser</dt>
          <dd>{{ selected.when }}</dd>
          <dt>Lücke</dt>
          <dd>{{ selected.gap }}</dd>
          <dt>Zusatzsystem</dt>
          <dd>{{ selected.fix }}</dd>
        </dl>
        <div class="as-src">Quelle: {{ selected.source }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.as-root {
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  color: v-bind("C.textHi");
}
.as-tabs {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  border-bottom: 1px solid v-bind("C.border");
  margin-bottom: 8px;
}
.as-tab {
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px 5px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: v-bind("C.textMid");
  cursor: pointer;
  margin-bottom: -1px;
}
.as-tab:hover {
  color: v-bind("C.textHi");
}
.as-tab.on {
  color: v-bind("C.textHi");
  background: v-bind("C.panel");
  border-color: v-bind("C.border");
  box-shadow: inset 0 2px 0 v-bind("C.accent");
}
.as-tab:focus-visible,
.as-item:focus-visible {
  outline: 2px solid v-bind("C.accent");
  outline-offset: 1px;
}
.as-stand {
  margin-left: auto;
  padding-bottom: 5px;
  font-size: 9.5px;
  color: v-bind("C.textMid");
}

/* MatrixPivot setzt px-Schriften (9–10px). zoom skaliert layout-konsistent;
 * die Bubble-Positionierung rechnet ihren Scale-Faktor selbst aus (siehe
 * SentryCompare.vue). Drei Tool-Spalten: etwas weniger als dort (1.25). */
.as-matrix {
  zoom: 1.16;
}
.as-matrix :deep(.col-dim) {
  width: 17%;
}

.as-trig {
  display: grid;
  grid-template-columns: minmax(0, 46fr) minmax(0, 54fr);
  gap: 12px;
  align-items: stretch;
}
.as-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.as-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font: inherit;
  font-size: 11.5px;
  line-height: 1.2;
  text-align: left;
  padding: 2px 8px 2px 5px;
  border: 1px solid v-bind("C.border");
  border-left: 3px solid var(--g);
  border-radius: 4px;
  background: v-bind("C.panel");
  color: v-bind("C.textHi");
  cursor: pointer;
}
.as-item:hover {
  background: v-bind("C.panelHi");
}
.as-item.on {
  border-color: var(--g);
  background: v-bind("C.panelHi");
  font-weight: 700;
}
.as-num {
  flex: none;
  width: 16px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  color: v-bind("C.textMid");
}
.as-title {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.as-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 3px;
  font-size: 9.5px;
  color: v-bind("C.textMid");
}
.as-swatch {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: baseline;
}

.as-detail {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  border: 1px solid v-bind("C.border");
  border-top: 3px solid var(--g);
  border-radius: 6px;
  background: v-bind("C.panel");
}
.as-d-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  margin-bottom: 8px;
}
.as-d-badge {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--g);
}
.as-d-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
}
.as-dl {
  margin: 0;
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 7px 12px;
}
.as-dl dt {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: v-bind("C.textMid");
  padding-top: 2px;
}
.as-dl dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}
.as-src {
  margin-top: auto;
  padding-top: 8px;
  font-size: 9.5px;
  color: v-bind("C.textMid");
}
</style>
