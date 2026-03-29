---
theme: default
title: "Grafana LGTM: Monitoring in Kubernetes Distributed Systems"
info: |
  LGTM Stack (Loki, Grafana, Tempo, Mimir) mit OpenTelemetry.
  Monitoring-Methodologien, Saturation, Systemdynamik und Dashboard-Architektur.
---

# Grafana LGTM Stack

## Monitoring in Kubernetes Distributed Systems

Loki · Grafana · Tempo · Mimir · OpenTelemetry

<div style="margin-top: 2em; font-size: 0.85em; color: #64748b;">
B2C-Versicherungsintegrator · Spring Boot Microservices · Percona MySQL · Redis · Traefik Gateway API
</div>

---
layout: section
---

# Monitoring-Methodologien

RED · USE · Golden Signals

---

# Die zentrale Gleichung

<div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin: 1.5em 0; flex-wrap: wrap;">
  <span style="font-size: 1.3em; font-weight: 800; color: #eab308; padding: 8px 20px; border-radius: 8px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3);">4 Golden Signals</span>
  <span style="font-size: 1.4em; color: #3e4a63;">=</span>
  <span style="font-size: 1.3em; font-weight: 800; color: #ef4444; padding: 8px 20px; border-radius: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);">RED</span>
  <span style="font-size: 1.4em; color: #3e4a63;">+</span>
  <span style="font-size: 1.3em; font-weight: 800; color: #a855f7; padding: 8px 20px; border-radius: 8px; background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.3);">Saturation</span>
</div>

<p style="text-align: center; font-size: 0.8em; color: #64748b; font-style: italic;">— Tom Wilkie, Grafana Labs</p>

| Golden Signal | RED-Equivalent | Perspektive |
|---|---|---|
| **Traffic** | Rate | User-facing |
| **Errors** | Errors | User-facing |
| **Latency** | Duration | User-facing |
| **Saturation** | — | Infrastruktur (nur Golden Signals) |

---

# Drei komplementäre Methoden

<MethodsOverview />

---

# Errors ≠ Errors: Zwei Perspektiven

<ErrorsPerspective />

---

# Diagnostischer Trichter

<DiagnosticFunnel />

---
clicks: false
---

# Monitoring-Methodologien — Interaktiv

<MonitoringMethods />

---
layout: section
---

# Golden Signals nach Google SRE

*"If you can only measure four metrics of your user-facing system, focus on these four."*

---

# Latency

Misst die Zeit bis zur Beantwortung eines Requests. **Verteilung** (p50, p90, p99) entscheidend, nicht der Durchschnitt.

Drei Latenz-Ebenen im Versicherungsintegrator:

| Ebene | Ziel | Typisch |
|---|---|---|
| **Interne Service-Latenz** | p99 < 200ms | Frontend-BFF, Quote-Aggregation |
| **Externe B2B-API-Latenz** | 500ms–5s | Allianz, AXA etc. — stark schwankend |
| **Cache-Hit vs. Cache-Miss** | Hit < 10ms | Miss triggert B2B-Call |

```sql
-- P99 Latenz für erfolgreiche interne Requests
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket{status=~"2.."}[5m])) by (le, uri))
```

---

# Traffic

Quantifiziert die Last. Im Versicherungskontext ist der **Fan-out-Multiplikator** zentral: ein Kundenrequest auf `/api/v1/quotes` löst 5–15 parallele Provider-Calls aus.

```sql
-- Gesamte Request-Rate über alle Services
sum(rate(http_server_requests_seconds_count[5m]))

-- Fan-out-Ratio: ausgehende B2B-Calls vs. eingehende Kundenrequests
sum(rate(http_client_requests_seconds_count[5m]))
  / sum(rate(http_server_requests_seconds_count{uri="/api/v1/quotes"}[5m]))

-- Cache-Hit-Ratio als Traffic-Qualitätssignal
sum(rate(cache_gets_total{result="hit"}[5m]))
  / sum(rate(cache_gets_total[5m]))
```

---

# Errors

Drei Kategorien im Integrator-Kontext:

- **Interne 5xx** — Bugs, DB-Fehler
- **Upstream-Provider-Fehler** — 500er, Timeouts, 429 Rate-Limiting
- **Partielle Degradation** — 3 von 10 Anbietern fallen aus → Quote unvollständig, aber nicht komplett fehlerhaft

```sql
-- Interne Error-Rate als Prozentsatz
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
  / sum(rate(http_server_requests_seconds_count[5m]))

-- Provider-Timeout-Rate (Status 0 = Verbindungsabbruch)
sum(rate(http_client_requests_seconds_count{status="0"}[5m])) by (clientName)
```

---

# Saturation

Misst, wie nahe das System an seinen Kapazitätsgrenzen ist.

*"Many systems degrade in performance before achieving 100% utilization."* — SRE Book

Beste Indikatoren: **Queuing** — Arbeit, die auf Verarbeitung wartet.

```sql
-- Tomcat Thread-Pool-Auslastung
tomcat_threads_busy_threads / tomcat_threads_config_max_threads

-- HikariCP DB-Connection-Pool-Auslastung
hikaricp_connections_active / hikaricp_connections_max

-- Container CPU nahe am Limit
sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod)
  / sum(kube_pod_container_resource_limits{resource="cpu"}) by (pod)
```

---
layout: section
---

# RED-Methode

*"The RED Method is a good proxy to how happy your customers will be."*
— Tom Wilkie, 2015

---

# RED: Rate, Errors, Duration

| Signal | Was | Wie (PromQL) |
|---|---|---|
| **Rate** | Requests/s — erste Ableitung eines Counters | `rate()` = (counter_now − counter_prev) / interval |
| **Errors** | Fehlgeschlagene Requests/s — User-Sicht | HTTP 5xx, Timeouts, Business-Logik-Fehler |
| **Duration** | Latenz-Verteilung (p50, p95, p99) | Steigt als Symptom von Saturation |

**Kausalität einseitig**: Saturation → Duration↑, aber Duration↑ ⇏ immer Saturation.

### Wann RED, wann Golden Signals?

- **RED** für jedes Service-Dashboard — konsistent, vergleichbar
- **Golden Signals** zusätzlich für die kritischsten Pfade, wo Saturation als Frühwarnung entscheidend ist — z.B. Vertragswechselsaison (November/Dezember)

---
layout: section
---

# USE-Methode

*"Like an emergency checklist in a flight manual."*
— Brendan Gregg, 2012

---

# USE: Utilization, Saturation, Errors

Für **jede Ressource** (CPU, Memory, Disk, Network, Pools).
Beantwortet: „Ist die Infrastruktur der Engpass?"

### CPU in Kubernetes

```sql
-- Utilization: CPU-Nutzung als Anteil des Limits
sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod)
  / sum(kube_pod_container_resource_limits{resource="cpu"}) by (pod)

-- Saturation: CPU-Throttling-Prozentsatz (DER kritische K8s-CPU-Indikator)
sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod, container)
  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod, container)
```

### Memory in Kubernetes

```sql
-- Utilization: Working Set vs. Limit (was der OOM-Killer beobachtet)
sum(container_memory_working_set_bytes{container!=""}) by (pod)
  / sum(kube_pod_container_resource_limits{resource="memory"}) by (pod)
```

**Immer** `container_memory_working_set_bytes` statt `container_memory_usage_bytes`!

---
layout: section
---

# Saturation erkennen

10 kritische Indikatoren

---

# CPU-Throttling: Der versteckte JVM-Killer

CFS (Completely Fair Scheduler) arbeitet in **100ms-Perioden**. Container, der sein Quota aufbraucht, wird pausiert.

Für JVM: **Bereits 15% Throttling kann GC-Pausen verstärken** — Stop-the-World-Pausen werden durch CFS-Pausen kompoundiert.

```sql
-- CPU-Throttling-Prozentsatz
sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod, container)
  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod, container) * 100
```

Schwellwerte: **>25% über 15min = Warning**, **>50% = Critical**

---

# Pool-Saturation: HikariCP & Tomcat

### HikariCP Connection-Pool

Pool-Erschöpfung → blockierte Threads → kaskadierende Timeouts

```sql
hikaricp_connections_active / hikaricp_connections_max * 100
hikaricp_connections_pending  -- Wartende Threads (>0 = Saturation!)
```

Sizing: `(core_count × 2) + effective_spindle_count` → 4-Core SSD: **(4×2)+1 = 9**

### Tomcat Thread-Pool

Default: max 200 Threads, Accept-Queue: 100. Alle busy + Queue voll → HTTP 503.

```sql
tomcat_threads_busy_threads / tomcat_threads_config_max_threads * 100
```

---

# Prioritätsmatrix

| Prio | Signal | Business-Impact |
|---|---|---|
| **P1** | HikariCP-Timeouts, Tomcat-Thread-Pool voll | Direkte User-Facing-Failures |
| **P1** | HTTP 429 von Upstream-B2B-APIs | Keine Quotes lieferbar |
| **P1** | OOMKilled Pods | Service-Neustarts, Datenverlust |
| **P2** | CPU-Throttling >25% | JVM-GC-Verstärkung → Latenz-Spikes |
| **P2** | P99-Latenz über SLO | Erstes Signal vor Kaskaden |
| **P2** | Redis Cache-Hit-Ratio <80% | Mehr Upstream-Calls → Rate-Limiting |
| **P3** | HPA am Maximum | Keine Auto-Skalierung mehr |
| **P3** | Disk-I/O-Saturation, DNS-Fehler | Infrastruktur-Bottlenecks |

---
clicks: false
---

# Saturation-Szenarien — Interaktiv

<SaturationSimulator />

---
layout: section
---

# Praxis-Schwellwerte

Warteschlangentheorie und die 80%-Regel

---

# M/M/1: Warum 80%

<MM1Chart />

Faustregel: **T = S / (1 − ρ)**. Bei 80% Utilization: Response-Time = **5×** Service-Time. Bei 90%: **10×**.

---

# Schwellwerte für Kubernetes / Spring Boot

| Ressource | Warning | Critical | Hinweis |
|---|---|---|---|
| CPU (Container) | 70–80% | 90%+ | CFS-Throttling beachten, nicht nur Utilization |
| Memory (Container) | 80% | 90%+ | `container_memory_working_set_bytes` |
| HikariCP Pool | 80% | 95%+ | Pending > 0 ist bereits Saturation |
| Tomcat Threads | 75% | 90%+ | Gepaart mit Upstream-Timeout-Check |
| Redis Memory | 80% | 95%+ | Evictions = aktive Sättigung |
| Disk I/O | 70% | 85%+ | Queue-Depth > 1 = Sättigung beginnt |

### Einschränkungen der 80%-Faustregel

- **M/M/1 ist ein Idealmodell** — bursty Traffic verschiebt den Knick nach links
- **Parallelisierung (M/M/c)** — 200 Tomcat-Threads verschieben den Knick nach rechts (~90–95%), aber Absturz steiler
- **CFS-Throttling ist binär** — 80% CPU kann plötzlich 40% Throttling bedeuten bei Bursts

---
layout: section
---

# Systemdynamik

Warteschlangen, Oszillation, Hysterese

---

# Rolling Bottlenecks und Excess Capacity

In einer Kette abhängiger Services wandert der Engpass (Goldratt, Theory of Constraints).

Ohne Überschusskapazität kann der Puffer nicht wieder aufgefüllt werden bevor die nächste Schwankung kommt → **Starvation kaskadiert downstream**.

<PipelineViz />

**Excess Capacity (~20% Headroom) ist keine Verschwendung, sondern Systemanforderung.**

---

# Queues als Federn / Oszillation

Mit Backpressure verhalten sich Queues wie Federn: komprimierbar, mit Rückstellkraft.

**Zentrale Asymmetrie**: Oszillation kann nicht über 100% Kapazität hinaus ausgleichen, aber beliebig weit darunter fallen → reduzierter effektiver Durchsatz.

### Steady Flow statt Batch-Peaks

| Anti-Pattern | Pattern |
|---|---|
| Cronjob refresht alle Cache-Keys gleichzeitig | Cache-Refresh mit Jitter (TTL + random 0–60s) |
| Batch-Import: 10.000 Quotes auf einmal | Rate-Limiter: Leaky Bucket |
| HPA skaliert 10 Pods gleichzeitig hoch | Staggered Rollout (maxSurge: 1) |
| Retry-Storm nach Upstream-Recovery | Exponential Backoff mit Jitter |

---

# Hysterese: Warum Systeme nach Überlast „kleben"

Systeme bauen unter Überlast interne Zustände auf, die nicht verschwinden wenn die externe Last sinkt:

| Mechanismus | Feedback-Loop |
|---|---|
| **Cache-Stampede** | Überlast → Evictions → Cache kalt → mehr Upstream-Calls → Last bleibt hoch |
| **GC Death Spiral** | Memory-Pressure → mehr GC → CPU verbraucht → Requests langsamer → mehr GC |
| **Queue-Backlog** | Pool erschöpft → Backlog wächst → Drain-Time = Backlog / (Kapazität − Rate) |
| **Circuit-Breaker** | Errors → Breaker OPEN → Recovery nur via Probes → langsame Rückkehr |
| **Autoscaler-Lag** | Scale-Up mit kalten Pods → Cold Cache + Cold JIT → Latenz bleibt hoch |

---
clicks: false
---

# Hysterese-Katalog — Interaktiv

<HystereseCatalog />

---
clicks: false
---

# Systemdynamik — Interaktiv

<SystemDynamicsSimulator />

---
layout: section
---

# Hysterese-Alerting

Grafana Recovery Thresholds

---

# Naive Alerts vs. Recovery Threshold

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 1em 0;">
<div style="padding: 16px; border-radius: 8px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);">
<h4 style="color: #ef4444; margin: 0 0 8px;">Naiver Alert</h4>
<p style="font-size: 0.85em; color: #94a3b8;">"P99 > 500ms" feuert beim Hinaufgehen und resolved beim Heruntergehen. Bei 500ms auf dem Rückweg ist das System noch degradiert. Erzeugt Flapping.</p>
</div>
<div style="padding: 16px; border-radius: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);">
<h4 style="color: #22c55e; margin: 0 0 8px;">Mit Recovery Threshold</h4>
<p style="font-size: 0.85em; color: #94a3b8;">Feuert bei P99 > 500ms, resolved erst bei P99 < 200ms. Asymmetrische Schwellen verhindern Flapping und stellen sicher, dass das System wirklich erholt ist.</p>
</div>
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
            params: [0.5]        # 500ms: Alert feuert
          unloadEvaluator:
            type: lt
            params: [0.2]        # 200ms: Alert resolved
```

---

# Phasenraum-Diagnose: XY Chart

Statt zwei Metriken gegen die Zeit zu plotten, plottet man sie **gegeneinander** (X-Y). Die Trajektorie zeigt die Hysterese-Schleife.

| Kombination | X-Achse | Y-Achse | Insight |
|---|---|---|---|
| CPU vs. Latenz | CPU-Usage | P99 Latenz | Knickpunkt CPU → Latenz, Hysterese bei Recovery |
| Rate vs. Errors | Request-Rate | Error-Rate | Ab welcher Rate beginnen Errors? |
| Cache vs. Upstream | Hit-Ratio | Upstream-Calls/s | Cache-Miss-Amplification sichtbar |

**Praxis-Tipp**: XY Charts sind für Post-Incident-Reviews. Zeitbereich auf die Incident-Dauer setzen. Die eingeschlossene Fläche quantifiziert den Recovery-Verlust.

---
layout: section
---

# Dashboard-Architektur

Vier Ebenen vom Platform-Overview zur Root-Cause-Analyse

---

# Dashboard-Hierarchie

<DashboardHierarchy />

---

# Visualisierungstypen

<VizGuide />

---

# Dashboard-Linking

<DashboardLinking />

---
clicks: false
---

# Dashboard-Architektur — Interaktiv

<GrafanaDashboard />

---
layout: section
---

# LGTM-Stack: Metriken, Logs und Traces

Mimir · Loki · Tempo · Grafana

---

# Mimir für Metriken (PromQL)

Horizontal skalierbare Langzeitspeicherung. Prometheus schreibt via `remote_write`.

### Recording Rules

Namenskonvention: `level:metric_name:operations`

```yaml
rules:
  - record: job:http_requests:rate5m
    expr: sum by (job, status) (rate(http_requests_total[5m]))
  - record: service:http_requests:rate5m
    expr: sum by (service) (job:http_requests:rate5m)
```

---

# Loki für Logs (LogQL)

Labels beschreiben die **Quelle**, nicht den Inhalt. `trace_id`, `user_id` → Structured Metadata (Loki 3.0+).

```text
-- Fehler-Logs eines Services
{namespace="production", app="quote-service"} | json | level="error"

-- Error-Log-Rate pro Service
sum by (app) (rate({namespace="production"} |= "error" [5m]))

-- Exception-Pattern
{app="quote-service"} |~ "(?i)(NullPointerException|OutOfMemoryError|TimeoutException)"
```

**Performance**: Von links nach rechts filtern. String-Filter (`|=`) > Regex (`|~`) > Parser (`| json`).

---

# Tempo für Traces (TraceQL)

```text
-- Spans langsamer als 2 Sekunden
{ duration > 2s }

-- Fehler in einem Service
{ resource.service.name = "quote-service" && status = error }

-- Langsame DB-Calls
{ span.db.system = "postgresql" && duration > 500ms }
```

### Metrics-Generator

Erzeugt automatisch RED-Metriken aus Spans:
- `traces_spanmetrics_calls_total`
- `traces_spanmetrics_latency_bucket`

---

# Korrelation: Der Drill-Down-Workflow

```
1. Dashboard    → Anomalie in Metrik (P99-Spike)
       ↓ Exemplar-Diamond klicken
2. Trace-View   → Langsamer Span identifiziert (Tempo)
       ↓ Trace-to-Logs klicken
3. Logs          → Fehlermeldung lesen (Loki)
       ↓
4. Root Cause   → "dieser PostgreSQL-Query ist der Bottleneck"
```

### Exemplars konfigurieren

```yaml
# Alloy → Mimir
prometheus.remote_write "default" {
  endpoint {
    url = "http://mimir:9009/api/v1/push"
    send_exemplars = true
  }
}
```

---

# OpenTelemetry Instrumentierung

### Zero-Code mit Java Agent

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

# Zusammenfassung

### Drei Regeln aus der Systemdynamik

1. **Excess Capacity ist Pflicht** — ~20% Headroom für Puffer-Recovery
2. **Gleichmäßiger Flow statt Batches** — TTL+Jitter, Leaky Bucket, Staggered Rollout
3. **Hysterese einplanen** — Recovery Threshold in Alerting, XY Charts für Post-Incident

### Dashboard-Strategie

- Jeder Service → **RED-Dashboard** (Rate, Errors, Duration)
- Customer-facing Endpoints → zusätzlich **Saturation-Monitoring**
- Infrastruktur → **USE-Dashboards** (CPU-Throttling, Memory-Pressure, Disk-I/O)

### LGTM-Korrelation

Exemplars → Trace → Logs: Von „P99 ist hoch" zu Root Cause in **drei Klicks**.

---
layout: end
---

# Danke

Quellen: Google SRE Book · Brendan Gregg (USE) · Tom Wilkie (RED) · Grafana Docs
