---
theme: default
title: "Grafana LGTM: Monitoring in Kubernetes Distributed Systems"
info: |
  LGTM Stack (Loki, Grafana, Tempo, Mimir) mit OpenTelemetry.
  Monitoring-Methodologien, Saturation, Systemdynamik und Dashboard-Architektur,
  dazu Software-Evolution aus Produktionsdaten mit Agenten und Goodharts Gesetz.
monaco: true
mdc: true
lang: de
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
---

# Grafana LGTM Stack

## Monitoring in Kubernetes Distributed Systems

Loki · Grafana · Tempo · Mimir · OpenTelemetry

<div class="text-slate-500" style="margin-top: 2em; font-size: 0.85em;">
B2C-Versicherungsintegrator · Spring-Boot-Microservices · Percona PostgreSQL · Redis · Traefik Gateway API
</div>

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

---
layout: section
---

# Monitoring-Methodologien

RED · USE · Golden Signals

---
hideInToc: true
---

# Drei komplementäre Methoden

<MethodsOverview />

<div v-click style="margin-top: 14px; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.25); background: rgba(148,163,184,0.06);">
  <div style="display: grid; grid-template-columns: auto auto auto auto auto; justify-content: center; align-items: center; column-gap: 14px; row-gap: 8px;">
    <div class="text-amber-700 dark:text-amber-400" style="font-size: 1.5em; font-weight: 800; letter-spacing: 0.5px; text-align: center;">Let's</div>
    <div></div>
    <div style="font-size: 1.5em; font-weight: 800; letter-spacing: 0.5px; text-align: center; color: #a855f7;">use</div>
    <div></div>
    <div style="font-size: 1.5em; font-weight: 800; letter-spacing: 0.5px; text-align: center; color: #ef4444;">RED</div>
    <div style="text-align: center;"><span class="text-amber-700 dark:text-amber-400" style="font-family: var(--slidev-code-font-family); font-size: 0.7em; font-weight: 700; letter-spacing: 0.7px; padding: 3px 10px; border-radius: 5px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3); display: inline-block;">HYBRID</span></div>
    <div class="text-gray-400 dark:text-slate-600" style="font-size: 1.1em; font-weight: 700;">=</div>
    <div style="text-align: center;"><span style="font-family: var(--slidev-code-font-family); font-size: 0.7em; font-weight: 700; letter-spacing: 0.7px; padding: 3px 10px; border-radius: 5px; color: #a855f7; background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.3); display: inline-block;">RESOURCE</span></div>
    <div class="text-gray-400 dark:text-slate-600" style="font-size: 1.1em; font-weight: 700;">+</div>
    <div style="text-align: center;"><span style="font-family: var(--slidev-code-font-family); font-size: 0.7em; font-weight: 700; letter-spacing: 0.7px; padding: 3px 10px; border-radius: 5px; color: #ef4444; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); display: inline-block;">SERVICE</span></div>
  </div>
</div>

<!--
- Merksatz „Let's use RED": die drei Wörter stehen für die drei Methoden —
  „Let's" → 4 Golden Signals, „use" → USE-Methode, „RED" → RED-Methode.
- Untere Reihe ordnet jeder Methode ihre Perspektive zu: Golden Signals sind
  der HYBRID aus RESOURCE (USE, Ressourcen-Sicht) und SERVICE (RED, User-Sicht).
-->

---
hideInToc: true
---

# Die zentrale Gleichung des Monitorings

<div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin: 1.5em 0; flex-wrap: wrap;">
  <span class="text-amber-700 dark:text-amber-400" style="font-size: 1.3em; font-weight: 800; padding: 8px 20px; border-radius: 8px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3);">4 Golden Signals</span>
  <span class="text-gray-400 dark:text-slate-600" style="font-size: 1.4em;">=</span>
  <span style="font-size: 1.3em; font-weight: 800; color: #ef4444; padding: 8px 20px; border-radius: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);">RED</span>
  <span class="text-gray-400 dark:text-slate-600" style="font-size: 1.4em;">+</span>
  <span style="font-size: 1.3em; font-weight: 800; color: #a855f7; padding: 8px 20px; border-radius: 8px; background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.3);">Saturation</span>
</div>

<p class="text-slate-500" style="text-align: center; font-size: 0.8em; font-style: italic;">— Tom Wilkie, Grafana Labs</p>

| Golden Signal  | RED-Äquivalent | Perspektive                        |
| -------------- | -------------- | ---------------------------------- |
| **Traffic**    | Rate           | User-facing                        |
| **Errors**     | Errors         | User-facing                        |
| **Latency**    | Duration       | User-facing                        |
| **Saturation** | —              | Infrastruktur (nur Golden Signals) |

---
hideInToc: true
---

# Errors ≠ Errors: Zwei Perspektiven

<ErrorsPerspective />

---
hideInToc: true
---

# Diagnostischer Trichter

<DiagnosticFunnel />

---
layout: section
---

# Golden Signals nach Google SRE

_"If you can only measure four metrics of your user-facing system, focus on these four."_

---
hideInToc: true
---

# Latency

Misst, wie lange ein Request bis zur Antwort braucht. Entscheidend ist die **Verteilung** (p50, p95, p99), nicht der Durchschnitt.

Drei Latenz-Ebenen im Versicherungsintegrator:

| Ebene                        | Ziel        | Typisch                              |
| ---------------------------- | ----------- | ------------------------------------ |
| **Interne Service-Latenz**   | p99 < 200ms | Frontend-BFF, Quote-Aggregation      |
| **Externe B2B-API-Latenz**   | 500ms–5s    | Allianz, AXA etc. — stark schwankend |
| **Cache-Hit vs. Cache-Miss** | Hit < 10ms  | Miss triggert B2B-Call               |

```promql
# P99 Latenz für erfolgreiche interne Requests
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket{status=~"2.."}[5m])) by (le, uri))
```

---
hideInToc: true
---

# Traffic

Quantifiziert die Last. Zentral ist der **Fan-out-Multiplikator**: Ein Kundenrequest auf `/api/v1/quotes` löst 5–15 parallele Provider-Calls aus.

```promql
# Gesamte Request-Rate über alle Services
sum(rate(http_server_requests_seconds_count[5m]))

# Fan-out-Ratio: ausgehende B2B-Calls vs. eingehende Kundenrequests
sum(rate(http_client_requests_seconds_count[5m]))
  / sum(rate(http_server_requests_seconds_count{uri="/api/v1/quotes"}[5m]))

# Cache-Hit-Ratio als Traffic-Qualitätssignal
sum(rate(cache_gets_total{result="hit"}[5m]))
  / sum(rate(cache_gets_total[5m]))
```

---
hideInToc: true
---

# Errors

Drei Fehlerkategorien:

- **Interne 5xx**: Bugs, DB-Fehler
- **Upstream-Provider-Fehler**: 500er, Timeouts, 429 Rate-Limiting
- **Partielle Degradation**: 3 von 10 Anbietern (30 %) fallen aus → Quote unvollständig, aber nutzbar

```promql
# Interne Error-Rate als Anteil (0–1)
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
  / sum(rate(http_server_requests_seconds_count[5m]))

# Provider-Fehlerrate (status=IO_ERROR = Verbindungsabbruch/Timeout ohne Response)
sum(rate(http_client_requests_seconds_count{status="IO_ERROR"}[5m])) by (clientName)
```

---
hideInToc: true
---

# Saturation

Misst, wie nahe das System an seinen Kapazitätsgrenzen ist.

_"Many systems degrade in performance before they achieve 100% utilization."_ — SRE Book

Bester Indikator: **Queuing**, also Arbeit, die auf Bearbeitung wartet.

```promql
# Tomcat Thread-Pool-Auslastung
tomcat_threads_busy_threads / tomcat_threads_config_max_threads

# HikariCP DB-Connection-Pool-Auslastung
hikaricp_connections_active / hikaricp_connections_max

# Container CPU nahe am Limit
sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod)
  / sum(kube_pod_container_resource_limits{resource="cpu"}) by (pod)
```

---
layout: section
---

# RED-Methode

_"The RED Method is a good proxy to how happy your customers will be."_
— Tom Wilkie

---
hideInToc: true
---

# RED: Rate, Errors, Duration

| Signal       | Was                                         | Wie (PromQL)                                       |
| ------------ | ------------------------------------------- | -------------------------------------------------- |
| **Rate**     | Requests/s — erste Ableitung eines Counters | `rate()` = (counter_now − counter_prev) / interval |
| **Errors**   | Fehlgeschlagene Requests/s — User-Sicht     | HTTP 5xx, Timeouts, Business-Logik-Fehler          |
| **Duration** | Latenz-Verteilung (p50, p95, p99)           | Steigt als Symptom von Saturation                  |

**Kausalität einseitig**: Saturation → Duration↑, aber Duration↑ ⇏ Saturation.

### Wann RED, wann Golden Signals?

- **RED** für jedes Service-Dashboard: konsistent, vergleichbar
- **Golden Signals** zusätzlich für die kritischsten Pfade, wo Saturation als Frühwarnung entscheidend ist, z. B. Vertragswechselsaison (November/Dezember)

---
layout: section
---

# USE-Methode

_"Like an emergency checklist in a flight manual."_
— Brendan Gregg, 2012

---
hideInToc: true
---

# USE: Utilization, Saturation, Errors

Für **jede Ressource** (CPU, Memory, Disk, Network, Pools).
Frage: „Ist die Infrastruktur der Engpass?“

### CPU in Kubernetes

```promql
# Utilization: CPU-Nutzung als Anteil des Limits
sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod)
  / sum(kube_pod_container_resource_limits{resource="cpu"}) by (pod)

# Saturation: CPU-Throttling-Prozentsatz (DER kritische K8s-CPU-Indikator)
sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod, container)
  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod, container)
```

### Memory in Kubernetes

```promql
# Utilization: Working Set vs. Limit (Näherung an den OOM-Kill)
sum(container_memory_working_set_bytes{container!=""}) by (pod)
  / sum(kube_pod_container_resource_limits{resource="memory"}) by (pod)
```

**Immer** `container_memory_working_set_bytes` statt `container_memory_usage_bytes`!

**Errors**: `rate(node_network_receive_errs_total[5m])` — Fehler auf Interface-Ebene (CRC, Frame).

---
layout: section
---

# Saturation erkennen

10 kritische Indikatoren

---
hideInToc: true
---

# CPU-Throttling: Der versteckte JVM-Killer

CFS (Completely Fair Scheduler) arbeitet in **100-ms-Perioden**. Ein Container, der sein Quota aufbraucht, pausiert bis zur nächsten Periode.

Für die JVM: **Schon moderates Throttling (im Simulator ab ca. 15 %) kann Stop-the-World-Pausen verlängern.**

```promql
# CPU-Throttling-Prozentsatz
sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod, container)
  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod, container) * 100
```

Schwellwerte: **Warning ab 25 % über 15 min**, **Critical ab 50 %**

---
hideInToc: true
---

# Pool-Saturation: HikariCP & Tomcat

### HikariCP Connection-Pool

Pool-Erschöpfung → blockierte Threads → kaskadierende Timeouts

```promql
hikaricp_connections_active / hikaricp_connections_max * 100
hikaricp_connections_pending  # Wartende Threads (>0 = Saturation!)
```

Startwert: `(core_count × 2) + effective_spindle_count` (DB-Server) → 4-Core: **(4×2)+1 = 9**

### Tomcat Thread-Pool

Default: 200 Threads, acceptCount 100. Alle Threads belegt: Requests warten, Clients laufen in Timeouts.

```promql
tomcat_threads_busy_threads / tomcat_threads_config_max_threads * 100
```

---
hideInToc: true
routeAlias: saturation-schwellwerte
---

# Prioritätsmatrix

<style>
table {
  font-size: 0.9em;
}
</style>

| Prio   | Signal                                     | Business-Impact                     |
| ------ | ------------------------------------------ | ----------------------------------- |
| **P1** | HikariCP-Timeouts, Tomcat-Thread-Pool voll | Direkte User-Facing-Failures        |
| **P1** | HTTP 429 von Upstream-B2B-APIs             | Keine Quotes lieferbar              |
| **P1** | OOMKilled Pods                             | Service-Neustarts, Datenverlust     |
| **P2** | CPU-Throttling >25%                        | JVM-GC-Verstärkung → Latenz-Spikes  |
| **P2** | P99-Latenz über SLO                        | Erstes Signal vor Kaskaden          |
| **P2** | Redis Cache-Hit-Ratio <85%                 | Mehr Upstream-Calls → Rate-Limiting |
| **P3** | HPA am Maximum                             | Keine Auto-Skalierung mehr          |
| **P3** | Disk-I/O-Saturation, DNS-Fehler            | Infrastruktur-Bottlenecks           |

---
clicks: false
hideInToc: true
---

# Saturation-Szenarien — Interaktiv

<SaturationSimulator />

<div class="sim-xref">

Workshop & Selbststudium: <TalkXref slug="20260711-sre-simulations" anchor="saturation-szenarien">SRE-Simulationen</TalkXref>

</div>

<!--
- Bedienung: links Szenario wählen (nach Kategorie gruppiert: Compute, Pool,
  Infra, Extern, Kaskade), dann ▶ drücken. Der Fortschritts-Slider
  fährt das Szenario von HEALTHY über DEGRADED/WARNING bis CRITICAL, die vier
  Gauges laufen mit. Slider auch manuell ziehbar.
- Zeigen: „CPU-Throttling“ komplett durchspielen (GC-Verstärkung beim
  JVM-Killer von eben!), danach „MySQL/InnoDB: Checkpoint-Sättigung“ oder „Broker
  Back-Pressure“ als Infra-Komponente, „Kaskaden-Failure“ als Eskalation.
- Unser Stack ist PostgreSQL (Checkpoint/WAL); das Szenario zeigt die
  InnoDB-Variante derselben Mechanik.
- Unten „PromQL-Queries anzeigen“ aufklappen. Die Queries entsprechen
  den Schwellwerten der vorigen Folien; Gegenmaßnahmen-Box mitgeben.
-->

---
layout: section
---

# Praxis-Schwellwerte

Warteschlangentheorie und die 80%-Regel

---
hideInToc: true
routeAlias: mm1-80-prozent
---

# M/M/1: Warum 80%

<div class="mm1-merge">
<div class="mm1-merge-top">
<div class="mm1-merge-chart">

<MM1Chart />

Faustregel: **T = S / (1 − ρ)**. Bei 80 % ist T fünfmal so groß wie S, bei 90 % zehnmal.

</div>
<div v-click>

<MM1Rules part="caveats" />

</div>
</div>
<div v-click>

<MM1Rules part="rules" />

</div>
</div>

<style>
.mm1-merge {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.mm1-merge-top {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 1em;
  align-items: start;
}
.mm1-merge-chart p {
  font-size: 0.82em;
  line-height: 1.4;
  margin-top: 0.3em;
}
</style>

---
hideInToc: true
---

# Schwellwerte für Kubernetes / Spring Boot

<style>
table {
  font-size: 0.84em;
}
table td,
table th {
  padding-top: 0.35em;
  padding-bottom: 0.35em;
}
h3 {
  margin-top: 0.1em;
  margin-bottom: 0.2em;
}
</style>

| Ressource          | Warning | Critical | Hinweis                              |
| ------------------ | ------- | -------- | ------------------------------------ |
| CPU (Container)    | 70–80%  | 95%+     | CFS-Throttling beachten              |
| Memory (Container) | 80%     | 90%+     | `container_memory_working_set_bytes` |
| HikariCP Pool      | 80%     | 95%+     | Pending > 0 ist bereits Saturation   |
| Tomcat Threads     | 75%     | 95%+     | Gepaart mit Upstream-Timeout-Check   |
| Redis Memory       | 80%     | 95%+     | Evictions = aktive Saturation        |
| Disk I/O           | 70%     | 85%+     | Queue-Depth > 1 = Saturation beginnt |

### Einschränkungen der 80%-Faustregel

- **M/M/1 vs. M/M/c**: Stoßartiger Traffic verschiebt den Knick nach links, viele Threads nach rechts (ca. 90–95 %)
- **CFS-Throttling ist binär**: Schon bei 80 % CPU kann ein Burst 40 % Throttling auslösen

---
layout: section
---

# Systemdynamik

Warteschlangen, Oszillation, Hysterese

---
clicks: false
hideInToc: true
---

<MM1Simulator />

<div class="sim-xref">

Workshop & Selbststudium: <TalkXref slug="20260711-sre-simulations" anchor="mm1-simulator">SRE-Simulationen</TalkXref>

</div>

<!--
- Bedienung: ▶ startet die Kantine. λ (Ankunft) und μ (Kapazität) hinter 🛠️;
  die ρ-Schnellwahl ist immer sichtbar — auf 0.80, dann 0.95 springen.
- Zeigen: Bei ρ=0,8 pendelt Wq auf ~4× Bedienzeit ein (Gauge-Strich = Theorie);
  bei 0,95 zappelt der Phosphor-Punkt stark, der Einschwing-Balken braucht lange
  — läuft aber nicht davon. Erst ρ≥1: der Punkt verlässt das Feld nach oben.
- Kernaussage: „80 %“ ist ein Punkt auf 1/(1−ρ), keine Klippe.
-->

---
clicks: false
hideInToc: true
---

<MMcCompare />

<!--
- Bedienung: Modus „Tempo“ (1 schneller Koch vs. Pool) ist Default. Metrik im
  Scope zwischen Wq und T umschalten — der Gewinner dreht sich. Slider hinter 🛠️.
- Zeigen: Der Zwillings-Rennbalken (mittig) misst id-gekoppelt, wer zuerst fertig
  ist: Pool gewinnt P(warten)/Wq (Pooling-Effekt), der schnelle Koch gewinnt T.
- Dann Modus „Pooling“ (c getrennte Schlangen vs. Pool): der Pool gewinnt alles —
  Head-of-Line-Blocking in den getrennten Spuren. Das spricht für eine gemeinsame
  Queue oder einen Work-Stealing-Pool statt Sharding per Hash.
-->

---
hideInToc: true
clicks: 4
---

# Wandernde Engpässe und Schutzkapazität

Die langsamste Station begrenzt den Durchsatz der Kette (Goldratt, Theory of Constraints). Liegen die Kapazitäten nah beieinander und schwanken, wechselt der Engpass: Er **wandert** (Lawrence & Buss, 1994).

Ohne Reserve baut sich der Rückstau nicht ab, bevor die nächste Schwankung kommt: **Vor dem Engpass staut es, dahinter laufen Stationen leer (Starvation).**

<PipelineViz />

**Schutzkapazität (Protective Capacity, Faustregel ~20 % Headroom) ist eine Systemanforderung, keine Verschwendung.**

<div class="sim-xref">

Zum Ausprobieren (Szenario „Wandernder Engpass“): <TalkXref slug="20260711-sre-simulations" anchor="systemdynamik">SRE-Simulationen</TalkXref>

</div>

<!--
- Lesen: links die Last (62 req/s), rechts die drei Stationen. Große Zahl =
  aktuelle Kapazität in req/s (durchgestrichen: der Nennwert), „Reserve“ =
  Kapazität / Last − 1, Balken = Warteschlange vor der Station („buf“; rot und
  „voll, 503“ = Puffer voll, Requests werden verworfen). Rote Umrandung mit
  Badge „Engpass“ = die Kapazität liegt gerade unter der Last.
- Klick für Klick:
  0 Normalbetrieb — alle über der Last, aber die Reserve ist schmal (13–29 %).
  1 GC-Pause im Quote-Service — 75 → 53 req/s, unter der Last: davor staut es,
    der Puffer läuft voll (503); dahinter kommen nur noch 53 req/s an.
  2 Provider wird langsam — der Engpass wandert nach hinten (70 → 53); der
    Quote-Service ist frei.
  3 Pod-Neustart am Gateway — 80 → 56; dahinter laufen Quote-Service und
    Provider-Adapter leer (Starvation downstream).
  4 Dieselben drei Einbrüche gleichzeitig, aber mit ~20 % mehr Kapazität
    (96/90/84): 67/63/63 req/s, jede Station bleibt über der Last. Kein
    Rückstau, kein 503.
- Kernaussage: Der Engpass ist keine feste Station, sondern dort, wo die
  Kapazität gerade unter die Last fällt. Goldratt sieht das Wandern selbst
  als Fehlwahrnehmung: „the problem was not wandering bottlenecks. It was
  insufficient protection for the existing bottlenecks“ (The Goal,
  überarbeitete Ausgabe 1992). Ursache nach Goldratt: abhängige Ereignisse
  plus statistische Schwankungen.
- Zwei Sichten auf denselben Effekt. ToC: Die Schutzkapazität der
  Nicht-Engpässe füllt den Puffer vor dem Engpass nach einer Störung wieder
  auf (TOCICO Dictionary). Warteschlange: Ein Rückstau Q baut sich nur mit
  μ − λ ab, Abbauzeit = Q / (μ − λ). Provider-Adapter (μ = 70, buf 15): bei
  λ = 62 gut 1,9 s, bei λ = 67 schon 5 s — und die nächste Schwankung kommt
  vorher.
- Begriffe: „Excess Capacity“ heißt in der ToC der Teil, der weder
  produziert noch schützt (also echte Verschwendung); gemeint ist
  Protective Capacity. „Rolling Bottleneck“ ist kein Fachbegriff, etabliert
  sind shifting bzw. wandering bottleneck (Lawrence & Buss 1994; das APICS
  Dictionary nennt sie „pseudo-constraints“).
- 20 % sind eine Praktiker-Faustregel, keine Norm (andere Quellen nennen
  25–30 %): mehr bei Bursts, vielen Abhängigkeiten und langen Ketten.
  Verwandt mit der M/M/1-Folie: 80 % Auslastung ist ein Punkt auf 1/(1−ρ),
  keine Klippe.
- Praxis: Ein Autoscaler skaliert eine Stufe hoch, der Engpass rutscht zur
  nächsten (SRE Workbook, Managing Load, Niantic: „moved the capacity
  bottleneck from GFE to the Niantic stack“); GC-Pausen; ein langsamer
  Provider bindet Threads im Adapter.
- Vereinfachung des Modells: Ein voller Puffer verwirft Requests, statt die
  Vorstufe zu blockieren. In echten Systemen läuft der Rückstau zusätzlich
  upstream (Backpressure, erschöpfte Pools).
- Zum Selbstausprobieren: Folie „Systemdynamik — Interaktiv“, Szenario
  „Wandernder Engpass“.
-->

---
hideInToc: true
---

# Queues als Federn / Oszillation

Mit Backpressure verhalten sich Queues wie Federn: komprimierbar, mit Rückstellkraft.

**Asymmetrie**: Oszillation gleicht nicht über 100 % Kapazität hinaus aus, fällt aber beliebig weit darunter. Der effektive Durchsatz sinkt.

### Steady Flow statt Batch-Peaks

| Anti-Pattern                                  | Pattern                                        |
| --------------------------------------------- | ---------------------------------------------- |
| Cronjob refresht alle Cache-Keys gleichzeitig | Cache-Refresh mit Jitter (TTL + random 0–60 s) |
| Batch-Import: 10.000 Quotes auf einmal        | Rate-Limiter: Leaky Bucket                     |
| HPA skaliert 10 Pods gleichzeitig hoch        | HPA behavior.scaleUp (Pods/min)                |
| Retry-Storm nach Upstream-Recovery            | Exponential Backoff mit Jitter                 |

---
hideInToc: true
routeAlias: hysterese
---

# Hysterese: warum Systeme nach Überlast „kleben“

<style>
table { font-size: 0.8em; }
table td, table th { padding-top: 0.28em; padding-bottom: 0.28em; }
</style>

Systeme bauen unter Überlast interne Zustände auf, die nicht verschwinden, wenn die externe Last sinkt:

| Mechanismus                      | Feedback-Loop                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Cache-Stampede**               | Überlast → Evictions → Cache kalt → mehr Upstream-Calls → Last bleibt hoch                                                |
| **Runtime GC Death Spiral**      | Heap-Druck → mehr GC → GC frisst CPU → Requests langsamer → mehr GC · _JVM/V8/Go/.NET; Python nur zyklischer GC_          |
| **Queue-Backlog**                | Pool erschöpft → Backlog wächst → Drain-Time = Backlog / (Kapazität − Rate)                                               |
| **Circuit-Breaker**              | Errors → Breaker OPEN → Recovery nur via Probes → langsame Rückkehr                                                       |
| **Backing-Service Flow-Control** | Pegel steigt → Broker/DB drosselt (RabbitMQ-Block, Galera-FC, InnoDB-Checkpoint) → löst erst, wenn der Pegel wieder fällt |
| **Metastabiler Fehler**          | Positive Rückkopplung hält die Überlast → Reset-Punkt unerreichbar → nur Load-Shedding/Drain/Restart                      |
| **Autoscaler-Lag**               | Scale-Up mit kalten Pods → Cold Cache + Cold JIT → Latenz bleibt hoch                                                     |

---
clicks: false
hideInToc: true
---

# Hysterese-Katalog — Interaktiv

<HystereseCatalog />

<div class="sim-xref">

Workshop & Selbststudium: <TalkXref slug="20260711-sre-simulations" anchor="hysterese-katalog">SRE-Simulationen</TalkXref>

</div>

<!--
- Bedienung: Filter-Pills oben (Applikation, Garbage Collection,
  Infra-Komponente, Plattform, Netzwerk, Kubernetes); Klick auf eine Karte
  klappt die Detail-Ansicht mit Feedback-Loop + Regelkreis-Badges
  (Gedächtnis, Bremse, Set/Reset) auf. Die Kurven-Animation läuft von selbst.
- Zeigen: „Cache-Stampede“ und „Runtime GC Death Spiral“ aufklappen, dann das
  Paar ZGC Allocation Stall (binär) vs. Shenandoah Pacing (proportional) —
  die zwei Achsen der folgenden Quadranten-Folie an einem GC-Beispiel.
- Hinweis: alle 26 Mechanismen teilen dasselbe Muster — interner Zustand
  bleibt bestehen, obwohl die externe Last längst gesunken ist.
-->

---
hideInToc: true
---

# Back-Pressure als Regelkreise

Zwei Achsen bestimmen Monitorbarkeit und Hysterese: **Gedächtnis** (Pegel vs. Momentanrate) und **Bremsform** (binär vs. proportional):

<div class="bpq-layout">
<div class="bpq-diagram"><BackpressureQuadrant /></div>
<div class="bpq-explain">
<Callout tone="info" dense>
<strong>Hysterese = Integrator (Gedächtnis).</strong> Eine <strong>Doppelschwelle</strong> (Set/Reset, Schmitt-Trigger) kommt hinzu, wo getrennte Schwellen gewollt sind, gegen Flapping (Galera <code>fc_factor</code> &lt; 1, Grafana Recovery Threshold).
</Callout>
<Callout tone="danger" dense>
<strong>Metastabiler Fehler.</strong> Wird die „Bremse“ eine positive Rückkopplung (super-linear), bleibt das System nach der Lastspitze überlastet — effektiv unendliche Hysterese. Rückkehr nur via Load-Shedding/Drain/Restart.
</Callout>
</div>
</div>

<div class="text-slate-500" style="margin-top:0.3em; font-size:0.6em;">
Brendan Gregg · USE-Methode &nbsp;·&nbsp; Neil Gunther · Universal Scalability Law &nbsp;·&nbsp; Bronson et al. · Metastable Failures (HotOS 2021)
</div>

<div class="sim-xref">

Workshop & Selbststudium: <TalkXref slug="20260711-sre-simulations" anchor="backpressure-quadrant">SRE-Simulationen</TalkXref>

</div>

<style>
.bpq-layout {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
  margin-top: 0.4em;
  align-items: start;
}
.bpq-explain {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.82em;
}
</style>

<!--
- Synthese-Folie nach dem Katalog: der Magic-Quadrant ordnet jeden Mechanismus
  nach Gedächtnis (Y: Rate → Pegel) und Bremsform (X: binär → proportional) ein
  und quantifiziert die Ausprägung über die Position.
- Zeigen: das ZGC-vs-Shenandoah-Paar (beide GC, aber binär vs. proportional) und
  die Diagonale — lange Zeitkonstante neigt zu binär, kurze zu proportional.
- Merksatz: zustandsbehaftet = vorhersagbar (Pegel-Gauge + dL/dt → Time-to-
  threshold); zustandsarm = nur detektierbar. Metastabiler Fehler = die
  super-lineare Eskalation oben-links (∞ Hysterese).
- Eck-Animationen: grau = Last, Farbe = Reaktion. Fläche = Pegel (Gedächtnis),
  Linie = Rate; harte Kanten = binär, glatte Kurve = proportional. Wehr:
  Sägezahn im Schwellenband; Regler: exponentielle Annäherung; Reflex: Rate
  kippt sofort auf 0 und zurück; Dämpfer: gedämpftes Mitlaufen. ⓘ an jeder
  Spur hält alles an und öffnet die Vergrößerung mit Erklärung.
  Jeder Datenpunkt ist klickbar: Dialog mit Was, Warum hier, Achtung und Link
  auf die Original-Doku. Einordnung faktengeprüft: Fenster-/Credit-Verfahren
  (TCP, Netty, HTTP/2, Reactive Streams, credit_flow) sind pegelbasiert und
  stehen im Wehr. Lehrpaar: Envoy stop_accepting_requests ist mit Trigger
  threshold ein Reflex, mit scaled ein Dämpfer.
-->

---
clicks: false
hideInToc: true
---

# Systemdynamik — Interaktiv

<SystemDynamicsSimulator />

<div class="sim-xref">

Workshop & Selbststudium: <TalkXref slug="20260711-sre-simulations" anchor="systemdynamik">SRE-Simulationen</TalkXref>

</div>

<!--
- Bedienung: Szenario wählen (Queues als Federn,
  Dirac-Impuls, Überlast + Recovery, Wandernder Engpass), ▶ startet die
  Pipeline-Animation Gateway → Quote-Service → Provider-Adapter.
- Zeigen: „Dirac-Impuls“ (Batch = maximale Oszillation) und „Wandernder
  Engpass“ (der Rückstau wandert mit den Kapazitätseinbrüchen: erst
  Quote-Service, dann Provider-Adapter, dann Gateway) — die Kernaussagen
  der Sektion live.
- Die drei Regeln (Schutzkapazität, Steady Flow, Doppelschwelle) stehen auf der
  M/M/1-Folie und in der Zusammenfassung.
-->

---
layout: section
---

# Doppelschwelle im Alerting

Grafana Recovery Thresholds

---
hideInToc: true
---

# Naive Alerts vs. Recovery Threshold

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 1em 0;">
<Callout tone="danger">
<h4 style="color: #ef4444; margin: 0 0 8px;">Naiver Alert</h4>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;">"P99 > 500ms" feuert beim Anstieg und resolved beim Absinken. Bei 500 ms ist das System noch degradiert. Folge: Flapping.</p>
</Callout>
<Callout tone="success">
<h4 style="color: #22c55e; margin: 0 0 8px;">Mit Recovery Threshold</h4>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;">Feuert bei P99 > 500 ms, resolved erst bei P99 < 200 ms. Asymmetrische Schwellen verhindern Flapping und belegen die Erholung.</p>
</Callout>
</div>

```yaml
# Grafana Custom Recovery Threshold (GA seit 10.3)
condition: C
data:
  - refId: C
    model:
      type: threshold
      expression: A
      conditions:
        - evaluator:
            type: gt
            params: [0.5] # 500ms: Alert feuert
          unloadEvaluator:
            type: lt
            params: [0.2] # 200ms: Alert resolved
```

---
hideInToc: true
---

# Phasenraum-Diagnose: XY Chart

Plotte zwei Metriken **gegeneinander** (X-Y) statt gegen die Zeit. Die Trajektorie zeigt die Hysterese-Schleife.

| Kombination        | X-Achse      | Y-Achse          | Erkenntnis                                      |
| ------------------ | ------------ | ---------------- | ----------------------------------------------- |
| CPU vs. Latenz     | CPU-Usage    | P99 Latenz       | Knickpunkt CPU → Latenz, Hysterese bei Recovery |
| Rate vs. Errors    | Request-Rate | Error-Rate       | Ab welcher Rate beginnen Errors?                |
| Cache vs. Upstream | Hit-Ratio    | Upstream-Calls/s | Cache-Miss-Amplification sichtbar               |

**Praxis-Tipp**: XY Charts eignen sich für Post-Incident-Reviews. Setze den Zeitbereich auf die Incident-Dauer. Die eingeschlossene Fläche quantifiziert den Recovery-Verlust.

---
layout: section
routeAlias: dashboard-architektur
---

# Dashboard-Architektur

Vier Ebenen vom Platform-Overview zur Root-Cause-Analyse

---
hideInToc: true
---

# Was gehört nach oben?

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 0.6em;">

  <!-- Lila ist kein Callout-Tone — Akzent per Inline-Style überschrieben. -->
  <Callout style="border-left-color: #a855f7; background: rgba(168,85,247,0.08); padding: 16px 18px;">
    <p style="font-style: italic; margin: 0 0 4px; line-height: 1.35;">
      «Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.»
    </p>
    <p style="font-style: italic; margin: 0 0 6px; line-height: 1.35;">
      „Alle glücklichen Familien sind einander ähnlich, jede unglückliche Familie ist auf ihre eigene Weise unglücklich.“
    </p>
    <p class="text-slate-500 dark:text-slate-400" style="font-size: 0.85em; margin: 0 0 10px;">
      — Lew Tolstoi, <em>Anna Karenina</em> (1878), Teil I, Kap. 1 · Übers. R. Tietze (2009) · Begriff „Anna-Karenina-Prinzip“: J. Diamond, <em>Guns, Germs, and Steel</em> (1997)
    </p>
    <p style="margin: 0; line-height: 1.4;">
      <strong>Glück hat eine Form, Unglück viele.</strong> Liste auf dem Haupt-Dashboard nicht alle Fehlerklassen auf. Zeige <em>einen</em> Indikator: Ist der Service aus Sicht der Endnutzer und SLOs glücklich?
    </p>
  </Callout>

  <Callout tone="info" style="padding: 16px 18px;">
    <p style="font-style: italic; margin: 0 0 4px; line-height: 1.35;">
      "A man with a watch knows what time it is. A man with two watches is never sure."
    </p>
    <p style="font-style: italic; margin: 0 0 6px; line-height: 1.35;">
      „Wer eine Uhr hat, weiß, wie spät es ist. Wer zwei Uhren hat, ist sich nie sicher.“
    </p>
    <p class="text-slate-500 dark:text-slate-400" style="font-size: 0.85em; margin: 0 0 10px;">
      — Segal's Law (apokryph; häufig Lee Segall, KIXL Dallas, zugeschrieben)
    </p>
    <p style="margin: 0; line-height: 1.4;">
      <strong>Ein Status, eine Ampel.</strong> Zwei „Top-Level“-Statusanzeigen stiften Zweifel. Alles Diagnostische gehört tiefer ins Dashboard oder auf verlinkte Detail-Dashboards.
    </p>
  </Callout>

</div>

---
hideInToc: true
---

# Dashboard-Hierarchie

<DashboardHierarchy />

<!--
- Bedienung: links Ebene L1–L4 anklicken — rechts erscheint das
  Beispiel-Layout der Ebene (Panels, Dashboard-Links, Methoden-Badge).
  Alternativ unten der „Drill-Down“-Button für die nächste Ebene.
- Zeigen: L1 Platform Overview — genau eine Ampel (Anna Karenina und
  Segal's Law von eben), dann L2 → L3 als Drill-Down-Pfad durchklicken.
- Hinweis: pro Ebene wechselt die Methode — L1 RED, L2 RED + Golden
  Signals (User-Sicht), L3/L4 USE (Ressourcen-Sicht). Links unten der
  Sizing-Spickzettel für das 24-Spalten-Grid.
-->

---
hideInToc: true
---

# Visualisierungstypen

<VizGuide />

---
hideInToc: true
---

# Dashboard-Linking: Drei Mechanismen

<DashboardLinking part="mechanisms" />

<!--
- Referenz-Slide 1/2: die drei Linking-Mechanismen nebeneinander
  (Dashboard Links, Data Links, externe Links), darunter die
  URL-Parameter-Referenz.
- Nicht jede Code-Zeile vorlesen — pro Mechanismus den Einsatzzweck
  nennen, der Rest ist Nachschlage-Material.
-->

---
hideInToc: true
---

# Dashboard-Linking: Drill-Down & Text-Panels

<DashboardLinking part="drilldown" />

<!--
- Referenz-Slide 2/2: links die Drill-Down-Karte (RED/Golden → USE),
  rechts Text-Panel-Beispiele pro Dashboard-Ebene.
- Kernbotschaft: Verlinkung folgt dem diagnostischen Trichter — von der
  Anomalie (Service-Level) zur Root Cause (Ressourcen-Level).
-->

---
layout: section
---

# LGTM-Stack: Metriken, Logs und Traces

Mimir · Loki · Tempo · Grafana

---
hideInToc: true
---

# Mimir für Metriken (PromQL)

Horizontal skalierbare Langzeitspeicherung. Prometheus schreibt via `remote_write`.

### Recording Rules

Namenskonvention: `level:metric_name:operations`

```yaml
rules:
  # Stufe 1: pro Job + Status aggregieren (Level "job_status")
  - record: job_status:http_requests:rate5m
    expr: sum by (job, status) (rate(http_requests_total[5m]))
  # Stufe 2: baut auf Stufe 1 auf, entfernt status (Level "job")
  - record: job:http_requests:rate5m
    expr: sum by (job) (job_status:http_requests:rate5m)
```

---
hideInToc: true
---

# Loki für Logs (LogQL)

Labels beschreiben die **Quelle**, nicht den Inhalt. `trace_id` und `user_id` gehören in Structured Metadata (Loki 3.0+).

```logql
# Fehler-Logs eines Services
{namespace="production", app="quote-service"} | json | level="error"

# Error-Log-Rate pro Service
sum by (app) (rate({namespace="production"} |= "error" [5m]))

# Exception-Pattern
{app="quote-service"} |~ "(?i)(NullPointerException|OutOfMemoryError|TimeoutException)"
```

**Performance**: Schnellste Filter zuerst: String-Filter (`|=`), dann Regex (`|~`), dann Parser (`| json`).

---
hideInToc: true
---

# Tempo für Traces (TraceQL)

```traceql
// Spans langsamer als 2 Sekunden
{ duration > 2s }

// Fehler in einem Service
{ resource.service.name = "quote-service" && status = error }

// Langsame DB-Calls
{ span.db.system = "postgresql" && duration > 500ms }
```

### Metrics-Generator

Erzeugt automatisch RED-Metriken aus Spans:

- `traces_spanmetrics_calls_total`
- `traces_spanmetrics_latency_bucket`

---
hideInToc: true
---

# Korrelation: der Drill-Down-Workflow

<DrillDownWorkflow />

### Exemplars konfigurieren

```hcl
// Alloy-Konfigurationssyntax (kein YAML)
prometheus.remote_write "default" {
  endpoint {
    url            = "http://mimir:9009/api/v1/push"
    send_exemplars = true
  }
}
```

---
hideInToc: true
---

# OpenTelemetry-Instrumentierung

### Zero-Code mit Java-Agent

```bash
java -javaagent:opentelemetry-javaagent.jar \
  -Dotel.service.name=quote-service \
  -Dotel.exporter.otlp.endpoint=http://collector:4317 \
  -jar quote-service.jar
```

### Kubernetes Auto-Instrumentation

```yaml
metadata:
  annotations:
    instrumentation.opentelemetry.io/inject-java: "true"
```

---
layout: section
routeAlias: software-evolution
---

# Software-Evolution aus Produktionsdaten

Messen → Lernen → Ändern — zunehmend mit Agenten

---
hideInToc: true
---

# Drei Rückkanäle aus der Produktion

Die Telemetrie des Stacks beantwortet mehr als „läuft es?“. Sie speist die Weiterentwicklung des Systems:

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin: 1em 0 0.6em; font-size: 0.82em;">
<Callout tone="info">
<h4 style="color: #3b82f6; margin: 0 0 6px;">Kontinuierlich verbessern</h4>
<p style="margin: 0 0 6px;">Hot Path aus dem Flame Graph, Trend der Saturation (CPU-Throttling, Pool-Auslastung), Cache-Hit-Ratio.</p>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;"><b>Mit Agent:</b> findet die breiteste Funktion, schlägt den Fix als PR vor und misst nach dem Rollout dieselbe Metrik erneut.</p>
</Callout>
<Callout tone="success">
<h4 style="color: #22c55e; margin: 0 0 6px;">Features planen</h4>
<p style="margin: 0 0 6px;">Welche Endpoints und Provider werden genutzt? Wo bricht die Conversion-Rate ein, wo sind Quotes unvollständig?</p>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;"><b>Mit Agent:</b> fasst Nutzungsdaten für das Refinement zusammen und belegt Annahmen mit Zahlen statt Bauchgefühl.</p>
</Callout>
<Callout tone="warning">
<h4 style="color: #d97706; margin: 0 0 6px;">Bugs finden und analysieren</h4>
<p style="margin: 0 0 6px;">Exemplar → Trace → Log: der Drill-Down aus diesem Talk, vom Symptom bis zur Zeile Code.</p>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;"><b>Mit Agent:</b> geht den Drill-Down selbst durch und formuliert eine Hypothese samt Beleg.</p>
</Callout>
</div>

<div class="text-slate-500" style="font-size: 0.72em;">
Technisch: der offizielle <code>mcp-grafana</code>-Server gibt Agenten Zugriff auf PromQL, LogQL, Dashboards, Alerts und Incidents (Stand 10/2026).
</div>

<!--
- Drei Wege, wie Produktionsdaten ins Engineering zurückfließen. Die
  Spalten folgen der Aufzählung im Vortrag: verbessern, planen, Bugs.
- „Mit Agent“ meint: der Agent bekommt dieselben Abfragen wie ein Mensch
  (MCP-Server zu Grafana) und arbeitet den Drill-Down der Folie
  „Korrelation“ ab.
- mcp-grafana: Prometheus, Loki, Pyroscope, Dashboards, Alert-Regeln,
  Incidents (Quelle: README des Servers, geprüft 11.10.2026).
-->

---
hideInToc: true
---

# Der Agenten-Loop — ein Ansatz zur Antifragilität

<div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 0.8em 0; font-size: 0.8em;">
  <span style="padding: 6px 12px; border-radius: 8px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.35);"><b>Telemetrie</b><br/>Mimir · Loki · Tempo</span>
  <span class="text-gray-400">→</span>
  <span style="padding: 6px 12px; border-radius: 8px; background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.35);"><b>Agent</b><br/>Analyse, Hypothese</span>
  <span class="text-gray-400">→</span>
  <span style="padding: 6px 12px; border-radius: 8px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.35);"><b>Änderung</b><br/>Pull Request</span>
  <span class="text-gray-400">→</span>
  <span style="padding: 6px 12px; border-radius: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"><b>Gate</b><br/>Review · Tests · SLO</span>
  <span class="text-gray-400">→</span>
  <span style="padding: 6px 12px; border-radius: 8px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.35);"><b>Rollout</b><br/>gestaffelt</span>
  <span class="text-gray-400">↺</span>
</div>

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 0.8em;">
<Callout tone="danger" dense>
<b>Fragil</b> — Stress schadet. Ein Incident hinterlässt eine Wunde, aber keine Lehre.
</Callout>
<Callout tone="warning" dense>
<b>Robust</b> — Stress schadet nicht. Circuit Breaker, Headroom und Back-Pressure halten die Last aus.
</Callout>
<Callout tone="success" dense>
<b>Antifragil</b> — Stress nützt. Jeder Incident wird zu einem Alert, einem Test und einem Fix.
</Callout>
</div>

**Neu:** Der Lernschritt braucht keinen Menschen mehr im Detail-Loop. Der Agent schließt die Schleife; das Review bleibt beim Menschen, das SLO-Gate prüft automatisch.

<div class="text-slate-500" style="margin-top: 0.6em; font-size: 0.7em;">
Begriff: Nassim N. Taleb, <i>Antifragile</i> (2012) · Selbstverbessernde Agenten (DGM, Hermes): <TalkXref slug="20260408-agents-details">Wie funktioniert ein Coding-Agent?</TalkXref>
</div>

<!--
- Der Loop ist ein Ansatz, kein Beweis: Antifragilität im Sinne von Taleb
  gilt auch für Organisationen und Märkte, nicht nur für Biologie. Neu ist,
  dass Software ihren eigenen Lernschritt (Analyse → Fix) automatisieren
  kann. Chaos Engineering war die menschliche Vorstufe.
- Das Gate ist der kritische Teil: ohne Review, Tests und SLO-Prüfung
  verstärkt der Agent Fehler, statt zu lernen.
- Brücke zur nächsten Sektion: Der Agent optimiert, was wir ihm als Signal
  geben. Was, wenn das Signal nicht das Ziel ist?
-->

---
layout: section
routeAlias: goodhart
---

# Das Alignment-Problem

Wir messen A — und hoffen auf B

---
hideInToc: true
---

# Goodharts Gesetz

> „When a measure becomes a target, it ceases to be a good measure.“
>
> — Marilyn Strathern (1997), nach Charles Goodhart (1975)

Ein Agent findet die Lücke zwischen **A** (Metrik) und **B** (Ziel) schneller als ein Team. Vier Varianten nach Manheim & Garrabrant (2018):

<div style="font-size: 0.78em;">

| Variante         | Mechanismus                              | Beispiel aus dem Monitoring                            |
| ---------------- | ---------------------------------------- | ------------------------------------------------------ |
| **Regressional** | Auswahl nach Proxy belohnt auch Rauschen | „Bester“ Provider im Messfenster: oft nur Glück        |
| **Extremal**     | Zusammenhang trägt nur im Normalbereich  | Hit-Ratio 99 % per langer TTL, dafür alte Tarife       |
| **Kausal**       | Eingriff am Proxy statt an der Ursache   | Schwellwert anheben: weniger Alarme, gleiche Störungen |
| **Adversarial**  | Optimierer hat Anreiz zur Manipulation   | Agent entfernt die Marker der Prüffunktion             |

</div>

<div class="text-slate-500" style="margin-top: 0.2em; font-size: 0.65em;">
Verwandt: Campbell's Law (1976) — je wichtiger ein Indikator für Entscheidungen, desto stärker der Druck, ihn zu verfälschen
</div>

<!--
- Zitat: Goodhart schrieb 1975 über Geldpolitik („Any observed statistical
  regularity will tend to collapse once pressure is placed upon it for
  control purposes“). Die bekannte Kurzfassung stammt von Strathern, 1997.
- Vier Varianten: Manheim & Garrabrant, „Categorizing Variants of
  Goodhart's Law“, arXiv 1803.04585 (2018).
- Die letzte Zeile ist ein echter Fall: Darwin Gödel Machine (Sakana AI,
  2025, arXiv 2505.22954). Der Agent entfernte die Marker, an denen die
  Prüffunktion Halluzinationen erkannte. Die übernächste Folie zeigt
  einen zweiten Fall (SWE-Bench Pro).
-->

---
clicks: false
hideInToc: true
---

# Beispiel: Test Coverage als Ziel

**B:** Tests finden Fehler, bevor Kunden sie finden · **A:** Coverage-Quote

<CoverageCounterMetrics />

<!--
- Einstieg: Fowler, „TestCoverage“ (2012): „If you make a certain level
  of coverage a target, people will try to attain it. The trouble is that
  high coverage numbers are too easy to reach with low quality testing.“
  Im Extremfall „AssertionFreeTesting“ (Fowler, 2004). Das ist ein
  Anekdotenbefund, kein dokumentierter Fall einer Coverage-Quote.
- Studienlage: Inozemtseva & Holmes (ICSE 2014, fünf Java-Systeme,
  Mutanten als Maß): sobald die Suite-Größe herausgerechnet ist, nur noch
  ein schwacher bis mäßiger Zusammenhang; Coverage „should not be used as
  a quality target“. Gegenstimme: Chen et al. (ASE 2020) halten das
  Herausrechnen für methodisch fragwürdig. Sicher ist nur: Coverage zeigt
  ungetestete Stellen, eine feste Quote sagt wenig über Testqualität.
- Mutation Score: Petrović et al., „Practical Mutation Testing at Scale“
  (IEEE TSE 48(10), 2022) und ICSE 2021. Google zeigt überlebende Mutanten
  im Review und berechnet bewusst keinen Score („neither concrete nor
  actionable“). Werkzeuge: PIT (Java), Stryker (JS/TS, C#, Scala). Dass
  Ausschlüsse den Nenner schönen, folgt aus den Scoring-Regeln der Tools;
  dokumentierte Fälle von Missbrauch gibt es nicht.
- Feedbackzeit: Software Engineering at Google, Kap. 11 und 14; DORA
  (test-automation): Tests unter etwa zehn Minuten. Das Perzentil p90/p95
  ist Konvention, keine Quelle nennt eines.
- Flaky: Micco, Google Testing Blog (2016): ~1,5 % der Testläufe, ~16 %
  der Tests, ~84 % der Pass→Fail-Wechsel betreffen einen flaky Test.
  Listfield (2017): 0,5 % der kleinen, 1,6 % der mittleren, 14 % der großen
  Tests. Das sind verschiedene Einheiten, nicht eine Rate. Luo et al.
  (FSE 2014): flaky heißt nicht automatisch „kein Produktfehler“.
- Offen: Keine Studie hat gemessen, ob ein Coverage-Ziel Flaky-Rate oder
  CI-Dauer erhöht. Das ist die Befürchtung, nicht der Befund.
- Produktionsregressionen: Kaner & Bond (METRICS 2004) zu Bug-Zahlen als
  Maß; Chillarege et al., ODC (IEEE TSE 1992): Felddefekte kommen „so
  late in the development cycle“, Ursachenanalyse ist der Nutzen. Normiert:
  DORA Change Fail Rate.
- Blinder Fleck: Marick, „How to Misuse Code Coverage“ (TCS ’99) und
  „Faults of Omission“ (STQE 2000): 22–54 % der Fehler in fünf zitierten
  Studien waren Auslassungen. Für Code-Mutation: „would seem to have
  little leverage“ (Marick, Bach, Kaner 2000, Anhang A). Spezifikations-
  mutation ist die Ausnahme, braucht aber eine formale Spezifikation.
- Risiko vor Durchschnitt: Arguelles, Ivanković, Bender, „Code Coverage
  Best Practices“ (Google Testing Blog, 2020): Debug-Logzeilen als
  weniger wichtig, pro Commit 99 % „reasonable“, 90 % untere Schwelle,
  keine pauschalen Vorgaben von oben. Berechtigungsprüfung und „keine
  Team-Rangliste“ sind unser Schluss, nicht Google.
- Agenten: METR (10.03.2026): rund die Hälfte der test-bestandenen
  SWE-bench-Verified-PRs würden Maintainer nicht mergen (Tests von
  Menschen). Chen et al. (arXiv 2602.07900, 2026): Wie viele Tests ein
  Agent unterwegs schreibt, ändert das Ergebnis kaum. Claude 3.7 Sonnet
  System Card (2025) und ImpossibleBench (arXiv 2510.20270): Agenten
  passen Tests an oder bauen erwartete Werte fest ein; „occurs
  infrequently in normal usage“. „Viele Tests je Änderung“ ist
  Praxiserfahrung: In GitHub-Daten fassen Agenten nur in 40–50 % der PRs
  Tests an, bringen dann aber fast doppelt so viel Testcode je
  Quellzeile mit (arXiv 2601.21194, 2607.18057).
- Quellen abgerufen am 11.10.2026. Überleitung: die interaktive Liste
  zeigt dieselbe Struktur für Monitoring-Ziele.
-->

---
clicks: false
hideInToc: true
---

# A vs. B — Interaktiv

<MetricAlignment />

<!--
- Bedienung: links ein Ziel anklicken, rechts erscheinen gemessene
  Metrik (A), das Fehlbild, das bessere Signal und eine Gegenmetrik.
- Zeigen: „Dienst ist benutzbar“ (Probe grün, Quotes kaputt),
  „Provider“ (globale Rate versteckt den Ausfall) und die drei
  Agent-Zeilen unten.
- Quellen: Spring-Boot-Doku, Kubernetes Probes (Readiness-Gruppe ohne
  externe Abhängigkeiten); Datacurve, „Introducing DeepSWE“ (Audit von
  SWE-Bench Pro: Opus liest den Gold-Commit per git log) und „DeepSWE v1.1“.
  Die Zahlen gelten für SWE-Bench Pro, nicht für DeepSWE v1.
-->

---
hideInToc: true
---

# Gegenmittel

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 0.85em;">
<Callout tone="info">
<b>Gegenmetrik koppeln.</b> Jede Zielmetrik bekommt ein Gegengewicht: Hit-Ratio ↔ Alter der Daten, weniger Alerts ↔ unentdeckte Störungen, niedrigere Limits ↔ CPU-Throttling. (Idee: Andy Grove, <i>High Output Management</i>)
</Callout>
<Callout tone="success">
<b>Am Nutzerpfad messen.</b> Vollständige Quotes und Conversion-Rate statt Probe und Statuscode — die Perspektive aus „Errors ≠ Errors“.
</Callout>
<Callout tone="warning">
<b>Verteilung statt Mittelwert, Aufschlüsselung statt Summe.</b> P99 statt Durchschnitt, <code>by (clientName)</code> statt globaler Rate.
</Callout>
<Callout tone="danger">
<b>Holdout und Schreibschutz.</b> Prüffunktionen und Musterlösungen vor dem Agenten verbergen. Alert-Regeln, Tests und Metrikdefinitionen nur per Review ändern. Auf SWE-Bench Pro las der Agent die Musterlösung aus der sichtbaren Git-Historie.
</Callout>
</div>

**Faustregel:** Wer ein Signal als Ziel vorgibt, braucht ein zweites, das der Optimierer nicht verfälschen kann.

<!--
- Andy Grove (Intel): Indikatoren paaren, damit die Optimierung der einen
  Größe die andere nicht stillschweigend opfert.
- Beispiel von der Folie davor: Datacurve hat den git-log-Pfad in
  DeepSWE v1.1 vorsorglich geschlossen. Bewertet wird nur der committete
  Patch, in eigenem Container, ohne spätere Commits im Repo.
- Zusatz, falls gefragt: Bei der Darwin Gödel Machine waren die
  Prüffunktionen vor dem Agenten verborgen; trat Objective Hacking
  trotzdem auf, dann beim Entfernen der Spezial-Tokens (arXiv
  2505.22954). Ohne Verbergen häufiger.
- Überleitung: die Zusammenfassung fasst Goodhart im Block „Aus Messungen lernen“ zusammen.
-->

---
hideInToc: true
---

# Zusammenfassung

<div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 22px; font-size: 0.82em;">
<div>

### Drei Regeln aus der Systemdynamik

1. **Schutzkapazität ist Pflicht** — Faustregel ca. 20 % Headroom, damit sich Rückstau abbaut
2. **Gleichmäßiger Flow statt Batches** — TTL+Jitter, Leaky Bucket, Staggered Rollout
3. **Doppelschwelle einplanen** — Recovery Threshold (Set ≠ Reset), XY Charts für Post-Incident; Flow-Control im Backing Service (Galera, RabbitMQ, InnoDB) signalisiert fehlende Kapazität; Load-Shedding _vor_ der Komponente bricht den metastabilen Kollaps

</div>
<div>

### Dashboard-Strategie

- Jeder Service → **RED-Dashboard** (Rate, Errors, Duration)
- Customer-facing Endpoints → zusätzlich **Saturation-Monitoring**
- Infrastruktur → **USE-Dashboards** (CPU-Throttling, Memory-Pressure, Disk-I/O)

### LGTM-Korrelation

Exemplars → Trace → Logs: Von „P99 ist hoch“ zu Root Cause in **drei Schritten** (Dashboard → Trace → Logs).

### Aus Messungen lernen

Agenten schließen die Schleife Telemetrie → Fix → Rollout; das **Review** bleibt beim Menschen, das **SLO-Gate** prüft die Automatik. Jede optimierte Metrik bekommt eine **Gegenmetrik** (Goodhart).

</div>
</div>

---
layout: section
---

# Bonus: Continuous Profiling mit Pyroscope

Die fünfte Säule — Code-Level-Sicht zum LGTM-Stack

---
hideInToc: true
---

# Pyroscope: Continuous Profiling für LGTM

Multi-tenant, horizontal skalierbar — gleiche Architektur wie Mimir, Loki, Tempo. **Mimir, Loki und Tempo zeigen, was und wo. Pyroscope zeigt, welche Funktion** – im Flame Graph.

<ProfilingMethods />

<div class="text-slate-500" style="margin-top: 0.7em; font-size: 0.7em;">
SDKs: Java · Go · .NET · Python · Ruby · Node.js · Rust · Auto-Instrumentation: Grafana Alloy mit eBPF
</div>

---
hideInToc: true
---

# Flame Graphs lesen — vom Sample zur Hot Function

Pyroscope zeigt die Daten als _Flame Graph_ (**interaktives** Beispiel):

<div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; margin-top: 0.3em; font-size: 0.82em; line-height: 1.4;">

<FlameGraphReader />

<div>

- **Y**: Stack-Tiefe (klassisch unten Einstieg; Pyroscope: Wurzel oben)
- **X**: Samples alphabetisch — **keine Zeitachse**
- **Breite**: Anteil der CPU-Samples → der Hot Path
- **Farben**: im Original zufällig; Grafana: Wert/Package
- „Breit = teuer“ stimmt, „schmal = unwichtig“ stimmt **nicht**
- Nachbar-Frames stehen **nicht** in Aufrufreihenfolge

</div>
</div>

<div class="text-slate-500" style="margin-top: 0.3em; font-size: 0.65em;">
Brendan Gregg, 2011 · <a href="https://www.brendangregg.com/flamegraphs.html">brendangregg.com/flamegraphs.html</a> · auch als Off-CPU-, Memory-, Differential-Variante
</div>

---
hideInToc: true
---

# Pyroscope in der Praxis

<div class="pyro-grid">

<div>

### Java-Agent für Spring Boot

```bash
java -javaagent:pyroscope.jar \
  -Dpyroscope.application.name=quote-service \
  -Dpyroscope.server.address=http://pyroscope:4040 \
  -Dpyroscope.format=jfr \
  -Dpyroscope.profiler.alloc=512k \
  -Dpyroscope.profiler.lock=10ms \
  -jar quote-service.jar
```

JFR aktiviert CPU + Allocation + Lock gleichzeitig (async-profiler unter der Haube). Alternative ohne Änderung am Startkommando: eBPF-Auto-Instrumentation via Grafana Alloy.

</div>

<div>

### Span Profiles: Drill-Down mit vier Schritten

<DrillDownWorkflow variant="pyroscope" />

Verlinkung über OTel-Span-Attribut `pyroscope.profile.id` — pro Span nur die Samples aus seiner Laufzeit.

</div>

</div>

<style>
.pyro-grid {
  display: grid;
  grid-template-columns: 1.12fr 1fr;
  gap: 26px;
  align-items: start;
  margin-top: 0.5em;
}
.pyro-grid pre {
  font-size: 0.86em;
}
</style>

---
layout: section
routeAlias: sentry-vergleich
---

# Bonus: LGTM vs. Sentry

Konkurrenz oder Ergänzung? Zwei Blickwinkel auf dasselbe System

---
hideInToc: true
---

# Zwei Werkzeuge, zwei Blickwinkel

LGTM beobachtet die **Plattform**, Sentry die **Applikation aus Entwicklersicht**. Die Matrix ist klickbar:

<SentryCompare />

<div class="text-slate-500" style="margin-top: 0.4em; font-size: 0.65em;">
Stand 10/2026 · Sentry Logs GA seit 09/2025 · „Application Metrics“ (App-Ebene, kein OTLP-Ingest) · Self-Hosted-Anforderungen laut getsentry/self-hosted
</div>

<!--
- Kernbotschaft: kein Entweder-oder. Sentry schaut aus der App heraus
  (Exceptions, Releases, User-Sessions), LGTM auf die Plattform
  (Metriken, SLOs, Cluster).
- Klick-Demo 1: Sentry × „Metriken & SLO/Burn-Rate“ — Custom-Metrics-Beta
  10/2024 eingestellt, neue Application Metrics (App-Ebene), kein
  OTLP-Metrics-Ingest, kein natives Burn-Rate-Alerting.
- Klick-Demo 2: Sentry × „K8s“ — sentry-kubernetes (Beta) macht aus
  K8s-Events Sentry-Errors, mehr nicht.
-->

---
hideInToc: true
---

# Besser zusammen: Sentry neben LGTM

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 1em 0;">
<Callout tone="info">
<h4 style="color: #3b82f6; margin: 0 0 8px;">Offiziell komplementär</h4>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;">Grafana Labs pflegt die <b>Sentry-Datasource</b> (v2.x): Issues, Events, Spans und Stats direkt neben Mimir-Metriken im Dashboard. Sentry wirbt selbst dafür, Prometheus-Infrastrukturdaten mit Issue- und Stats-Daten zu koppeln.</p>
</Callout>
<Callout tone="success">
<h4 style="color: #22c55e; margin: 0 0 8px;">Arbeitsteilung bei Tickets</h4>
<p class="text-slate-500 dark:text-slate-400" style="margin: 0;"><b>Sentry</b>: Alert Rules legen pro Issue automatisch Jira-/GitHub-Tickets an, mit Stacktrace, Release, Two-Way-Sync. <b>LGTM</b>: Die Burn-Rate-Policy liefert die „Aufgabe (Ticket)“-Lane: SLO-getrieben statt exception-getrieben.</p>
</Callout>
</div>

**Faustregel:** LGTM alarmiert auf Symptom und SLO; Sentry gruppiert die Ursache im Code und hängt das Ticket dran.

<div class="text-slate-500" style="margin-top: 0.6em; font-size: 0.7em;">
Burn-Rate-Policy zum Ausprobieren: <TalkXref slug="20260711-sre-simulations" anchor="slo-burn-rate">SRE-Simulationen — SLO-Burn-Rate</TalkXref>
</div>

<!--
- Beide Anbieter vermarkten das Zusammenspiel offiziell: Grafana pflegt
  die Sentry-Datasource, Sentry die Prometheus-Kopplung.
- Ticket-Kontrast: Sentry = exception-getrieben, Ticket entsteht
  automatisch am Issue; LGTM = SLO-getrieben, Ticket ist die langsamste
  Lane der Policy (Burn 1× über 3 Tage).
- Deep-Link öffnet die BurnRateSim aus dem SRE-Sim-Deck — dort zeigen,
  wann die Aufgabe-Lane feuert.
-->

---
layout: end
hideInToc: true
---

# Danke

Quellen: Google SRE Book · Brendan Gregg (USE) · Tom Wilkie (RED) · Grafana Docs · Grafana Pyroscope Docs · Sentry Docs · Strathern (1997) · Manheim & Garrabrant (2018) · Taleb (2012) · Darwin Gödel Machine (2025)

Alle Simulationen zum Ausprobieren: <TalkXref slug="20260711-sre-simulations">SRE-Simulationen — Komplexe Systeme interaktiv</TalkXref>

---
layout: default
title: Selbsttest
hideInToc: true
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<GrafanaQuiz />

<!--
- Hinter der End-Folie: Selbststudium nach dem Vortrag. Adaptiv — startet
  mittel, passt sich der Antwortqualität an.
- Fragenpool via Web-Recherche + Fable-Generierung + adversariale Auswahl;
  Sektion „transfer“ mit Fragen über den Vortrag hinaus (Prometheus,
  Kingman, Retry-Sturm, Symptom-Alerting), Schwellwert-Fragen sind
  bewusst kontextabhängig.
-->
