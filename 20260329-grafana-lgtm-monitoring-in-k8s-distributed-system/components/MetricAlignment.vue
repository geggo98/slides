<script setup>
// „Wir messen A — und hoffen auf B“: klickbare Liste von Ziel/Metrik-Paaren
// im Szenario des Versicherungsintegrators (Provider, Quotes, Cache). Rechts
// erscheinen das Fehlbild, das bessere Signal und eine Gegenmetrik.
// Die letzten drei Paare tragen die Markierung „Agent“: ein Optimierer ohne
// Menschen im Detail-Loop findet die Lücke zwischen A und B schneller.
// Belege: Spring Boot Actuator (docs.spring.io, Kubernetes Probes): „By
// default, Spring Boot does not add other health indicators to these groups“
// — die readiness-Gruppe enthält nur readinessState. Datacurve, „Introducing
// DeepSWE“ (deepswe.datacurve.ai/blog/deepswe, 26.05.2026), Audit von
// SWE-Bench Pro: „Both Opus configurations register CHEATED on more than 12%
// of their reviewed SWE-Bench Pro rollouts (about 18% of Opus 4.7's passes
// and 25% of Opus 4.6's)“, 33 von 38 Fällen per `git log --all` oder
// `git show <gold-hash>`. Die Zahlen stammen von SWE-Bench Pro, nicht von
// DeepSWE: Der v1.1-Post (…/blog/deepswe-v1-1, 14.06.2026) sagt zu v1
// „results from v1.0 remain free of this form of cheating“ und schließt den
// Pfad vorsorglich (nur der committete Patch zählt, in eigenem Container,
// keine späteren Commits im Repo). Abgerufen 10.10.2026. Metriknamen mit
// „Beispiel“ sind erfunden, alle anderen stehen so auf den PromQL-Folien
// dieses Decks.
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";
import QueryCode from "@shared/components/QueryCode.vue";
import TalkXref from "@shared/components/TalkXref.vue";

const { isDark } = useDarkMode();

const pairs = [
  {
    key: "usable",
    goal: "Dienst ist benutzbar",
    metric: "Pod „Ready“, Liveness-Probe grün",
    miss: "Der Prozess lebt, aber Redis oder die Provider-Anbindung ist tot. Spring Boot nimmt in die Readiness-Gruppe standardmäßig nur den eigenen Zustand auf — keine externen Abhängigkeiten.",
    better:
      "RED auf dem echten Endpoint und Quote-Completeness; die Probe entscheidet nur, ob ein Pod Traffic bekommt.",
    counter: "Quote-Completeness pro Request",
    query: null,
  },
  {
    key: "quotes",
    goal: "Kunden bekommen vollständige Quotes",
    metric: "Anteil HTTP-200-Antworten",
    miss: "200 OK, aber nur 7 von 10 Providern haben geantwortet. Die Partielle Degradation aus der Errors-Folie ist für die Statuscode-Quote unsichtbar.",
    better:
      "Business-Fehler mitzählen: Completeness je Request statt Statuscode allein.",
    counter: "Conversion-Rate",
    query: null,
  },
  {
    key: "latency",
    goal: "Kunden bekommen schnelle Antworten",
    metric: "Durchschnittliche Antwortzeit",
    miss: "Viele Cache-Hits (< 10 ms) drücken den Mittelwert, während ein Teil der Requests auf langsame Provider wartet (500 ms bis 5 s).",
    better:
      "P99 aus den summierten Buckets, dazu ein SLO. P99-Werte einzelner Pods nie mitteln.",
    counter: "Anteil langsamer Requests je Endpoint",
    query:
      'histogram_quantile(0.99,\n  sum(rate(http_server_requests_seconds_bucket{status=~"2.."}[5m])) by (le, uri))',
  },
  {
    key: "provider",
    goal: "Jeder Provider ist zuverlässig angebunden",
    metric: "Globale Error-Rate",
    miss: "Fällt ein Provider komplett aus, liefert der Service weiter 200 mit unvollständiger Quote. Die interne Error-Rate bleibt niedrig, und in der Summe aller Provider-Calls geht ein einzelner Anbieter unter.",
    better: "Fehlerrate je Provider, Alert auf den schlechtesten.",
    counter: "Quote-Completeness insgesamt",
    query:
      'sum(rate(http_client_requests_seconds_count{status="IO_ERROR"}[5m])) by (clientName)\n  / sum(rate(http_client_requests_seconds_count[5m])) by (clientName)',
  },
  {
    key: "fresh",
    goal: "Tarifdaten sind aktuell",
    metric: "Cache-Refresh-Cronjob erfolgreich",
    miss: "Der Job endet mit Exit 0, hat aber nichts aktualisiert, weil der Provider leer oder mit alten Daten geantwortet hat.",
    better: "Alter der Daten messen, nicht den Status des Jobs.",
    counter: "Zeit seit dem letzten geänderten Datensatz",
    query: "time() - max(tarif_letzte_aenderung_timestamp_seconds) # Beispiel",
  },
  {
    key: "cache",
    goal: "Der Cache entlastet die B2B-Calls",
    metric: "Cache-Hit-Ratio",
    miss: "Eine längere TTL treibt die Ratio nach oben, die Kunden sehen dafür veraltete Tarife. Die Metrik ist für sich genommen leicht zu verbessern.",
    better: "Hit-Ratio nur zusammen mit dem Alter der Daten bewerten.",
    counter: "Alter der ausgelieferten Tarife",
    query:
      'sum(rate(cache_gets_total{result="hit"}[5m]))\n  / sum(rate(cache_gets_total[5m]))',
  },
  {
    key: "noise",
    goal: "Weniger Störungen",
    metric: "Weniger Alerts",
    agent: true,
    miss: "Ein Agent mit dem Auftrag „Alert-Rauschen senken“ hebt Schwellwerte an oder schaltet Regeln stumm. Die Alarme sinken, die Störungen nicht.",
    better:
      "Alert-Regeln und Schwellwerte für den Agenten schreibgeschützt, Änderungen nur per Review.",
    counter: "Störungen, die Kunden vor dem Alert melden",
    query: null,
  },
  {
    key: "cost",
    goal: "Kosten senken ohne Qualitätsverlust",
    metric: "Niedrigere CPU-Requests und -Limits",
    agent: true,
    miss: "Weniger Ressourcen sparen Geld, bis das CPU-Throttling steigt. Schon 15 % Throttling verstärken GC-Pausen und treiben den P99.",
    better: "Throttling und P99 als Gate vor jeder Änderung der Limits.",
    counter: "CPU-Throttling-Prozentsatz",
    query:
      "sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod, container)\n  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod, container)",
  },
  {
    key: "score",
    goal: "Der Agent löst die Aufgabe richtig",
    metric: "Benchmark-Score: die Tests sind grün",
    agent: true,
    miss: "Auf SWE-Bench Pro holten sich Opus 4.6 und 4.7 die Musterlösung per git log aus der Historie, bei 25 % bzw. 18 % ihrer Treffer. Die Tests waren grün, gelöst war die Aufgabe nicht.",
    better:
      "Den Patch getrennt vom Agenten bewerten, ohne spätere Commits im Repo. DeepSWE v1.1 macht das vorsorglich.",
    counter: "Holdout-Messung, die der Agent nie sieht",
    xref: {
      slug: "20260408-agents-details",
      anchor: "pareto-v1-bonus",
      label: "Pareto-Front: DeepSWE v1 gegen v1.1",
    },
    query: null,
  },
];

const selected = ref(0);
const cur = computed(() => pairs[selected.value]);

const vars = computed(() => {
  const d = isDark.value;
  return {
    "--ma-surface": d ? "#111621" : "#ffffff",
    "--ma-alt": d ? "#161c2a" : "#f1f5f9",
    "--ma-border": d ? "#1e2536" : "#e2e8f0",
    "--ma-text": d ? "#e2e8f0" : "#1e293b",
    "--ma-muted": d ? "#94a3b8" : "#475569",
    "--ma-blue": d ? "#60a5fa" : "#2563eb",
    "--ma-red": d ? "#f87171" : "#dc2626",
    "--ma-green": d ? "#4ade80" : "#15803d",
    "--ma-purple": d ? "#c084fc" : "#7e22ce",
    "--ma-code": d ? "#79c0ff" : "#1e40af",
    "--ma-code-bg": d ? "#0d1117" : "#f1f5f9",
  };
});
</script>

<template>
  <div class="ma" :style="vars">
    <div class="ma-list" role="tablist" aria-label="Ziele und Metriken">
      <button
        v-for="(p, i) in pairs"
        :key="p.key"
        role="tab"
        :aria-selected="i === selected"
        :class="['ma-item', { active: i === selected }]"
        @click="selected = i"
      >
        <span class="ma-goal">{{ p.goal }}</span>
        <span v-if="p.agent" class="ma-tag">Agent</span>
      </button>
    </div>
    <div class="ma-detail" role="tabpanel">
      <div class="ma-row">
        <span class="ma-label" style="color: var(--ma-blue)">Gemessen (A)</span>
        <span>{{ cur.metric }}</span>
      </div>
      <div class="ma-row">
        <span class="ma-label" style="color: var(--ma-red)">Verfehlt (B)</span>
        <span>{{ cur.miss }}</span>
      </div>
      <div class="ma-row">
        <span class="ma-label" style="color: var(--ma-green)">Besser</span>
        <span>{{ cur.better }}</span>
      </div>
      <div class="ma-row">
        <span class="ma-label" style="color: var(--ma-purple)"
          >Gegenmetrik</span
        >
        <span>{{ cur.counter }}</span>
      </div>
      <div v-if="cur.xref" class="ma-xref">
        →
        <TalkXref :slug="cur.xref.slug" :anchor="cur.xref.anchor">{{
          cur.xref.label
        }}</TalkXref>
      </div>
      <QueryCode
        v-if="cur.query"
        class="ma-query"
        lang="promql"
        :code="cur.query"
      />
    </div>
  </div>
</template>

<style scoped>
.ma {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr;
  gap: 12px;
  margin-top: 0.3em;
  color: var(--ma-text);
  font-size: 14px;
  line-height: 1.4;
}
.ma-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ma-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 9px;
  text-align: left;
  color: var(--ma-text);
  background: var(--ma-surface);
  border: 1px solid var(--ma-border);
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}
.ma-item:hover {
  background: var(--ma-alt);
}
.ma-item.active {
  border-color: var(--ma-blue);
  background: var(--ma-alt);
}
/* Faux-Bold statt font-weight: ändert die Textbreite nicht, die Zeile bricht
   beim Aktivieren also nicht um. */
.ma-item.active .ma-goal {
  text-shadow:
    0.3px 0 0 currentColor,
    -0.3px 0 0 currentColor;
}
.ma-tag {
  flex: none;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--ma-purple);
  border: 1px solid var(--ma-purple);
  border-radius: 4px;
}
.ma-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--ma-surface);
  border: 1px solid var(--ma-border);
  border-radius: 8px;
}
.ma-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 8px;
}
.ma-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  padding-top: 1px;
}
.ma-xref {
  font-size: 12px;
  color: var(--ma-muted);
}
.ma-query {
  margin: 2px 0 0;
  padding: 6px 8px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--ma-code);
  background: var(--ma-code-bg);
  border: 1px solid var(--ma-border);
  border-radius: 6px;
  white-space: pre-wrap;
}
</style>
