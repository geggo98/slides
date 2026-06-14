<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useDarkMode } from "@slidev/client";
import GaugeRing from "./GaugeRing.vue";

// --- Color constants ---
const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#0a0d12" : "#f8fafc",
    surface: d ? "#111621" : "#ffffff",
    surfaceAlt: d ? "#161c2a" : "#f1f5f9",
    border: d ? "#1e2536" : "#e2e8f0",
    borderHi: d ? "#2a3350" : "#cbd5e1",
    text: d ? "#e2e8f0" : "#1e293b",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    blue: d ? "#3b82f6" : "#2563eb",
    green: d ? "#22c55e" : "#16a34a",
    greenDim: d ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.08)",
    yellow: d ? "#eab308" : "#ca8a04",
    yellowDim: d ? "rgba(234,179,8,0.12)" : "rgba(202,138,4,0.08)",
    orange: d ? "#f97316" : "#ea580c",
    orangeDim: d ? "rgba(249,115,22,0.12)" : "rgba(234,88,12,0.08)",
    red: d ? "#ef4444" : "#dc2626",
    redDim: d ? "rgba(239,68,68,0.12)" : "rgba(220,38,38,0.08)",
    purple: d ? "#a855f7" : "#9333ea",
    purpleDim: d ? "rgba(168,85,247,0.12)" : "rgba(147,51,234,0.08)",
    cyan: d ? "#06b6d4" : "#0891b2",
    cyanDim: d ? "rgba(6,182,212,0.12)" : "rgba(8,145,178,0.08)",
    codeBg: d ? "#0d1117" : "#f1f5f9",
    codeText: d ? "#79c0ff" : "#1e40af",
  };
});

function severityColor(s) {
  return s === "critical"
    ? C.value.red
    : s === "warning"
      ? C.value.orange
      : s === "degraded"
        ? C.value.yellow
        : C.value.green;
}
function severityBg(s) {
  return s === "critical"
    ? C.value.redDim
    : s === "warning"
      ? C.value.orangeDim
      : s === "degraded"
        ? C.value.yellowDim
        : C.value.greenDim;
}
function severityLabel(s) {
  return s === "critical"
    ? "CRITICAL"
    : s === "warning"
      ? "WARNING"
      : s === "degraded"
        ? "DEGRADED"
        : "HEALTHY";
}
function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// --- Data ---
const SCENARIOS = [
  {
    id: "cpu-throttle",
    name: "CPU-Throttling",
    icon: "\u{1F525}",
    subtitle: "CFS Quota ersch\u00f6pft \u2192 JVM-GC-Verst\u00e4rkung",
    category: "compute",
    description:
      "Container verbraucht sein CPU-Quota innerhalb der 100ms-CFS-Periode. Kubernetes pausiert den Container bis zur n\u00e4chsten Periode. Bei JVM-Anwendungen kompoundiert das mit Stop-the-World-GC-Pausen: eine 20ms-GC-Pause kann durch CFS-Throttling auf 120ms+ anschwellen.",
    trigger:
      "Hohe Parallelit\u00e4t bei Quote-Aggregation: 10+ Provider-Calls gleichzeitig, JSON-Parsing, Objektallokation \u2192 GC-Druck + CPU-Spike",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Throttling <5%, P99 stabil bei 180ms",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Erste Anzeichen",
        desc: "Throttling steigt auf 15%, P99 springt auf 350ms",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Sp\u00fcrbar",
        desc: "Throttling bei 35%, GC-Pausen h\u00e4ufen sich, P99 bei 800ms",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Kritisch",
        desc: "Throttling >50%, P99 >2s, erste Timeouts, Liveness-Probe-Failures",
      },
    ],
    metrics: [
      {
        name: "CFS Throttled %",
        unit: "%",
        healthy: 3,
        degraded: 15,
        warning: 35,
        critical: 62,
        thresholdWarn: 25,
        thresholdCrit: 50,
      },
      {
        name: "P99 Latenz",
        unit: "ms",
        healthy: 180,
        degraded: 350,
        warning: 800,
        critical: 2400,
        thresholdWarn: 500,
        thresholdCrit: 2000,
      },
      {
        name: "GC Pause avg",
        unit: "ms",
        healthy: 12,
        degraded: 45,
        warning: 110,
        critical: 280,
        thresholdWarn: 50,
        thresholdCrit: 200,
      },
      {
        name: "CPU Usage / Limit",
        unit: "%",
        healthy: 55,
        degraded: 78,
        warning: 92,
        critical: 99,
        thresholdWarn: 80,
        thresholdCrit: 95,
      },
    ],
    promql: [
      {
        label: "Throttling %",
        query:
          "sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod)\n  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod) * 100",
      },
      {
        label: "Throttled Seconds",
        query:
          'rate(container_cpu_cfs_throttled_seconds_total{container!=""}[5m])',
      },
    ],
    fix: "CPU-Limit erh\u00f6hen (z.B. 500m \u2192 1000m), oder Request-Parallelit\u00e4t begrenzen. Burstable QoS erw\u00e4gen (kein Limit, nur Request). GC-Tuning: -XX:MaxGCPauseMillis=100.",
    dashboardLevel: 3,
  },
  {
    id: "hikari-exhaust",
    name: "HikariCP-Ersch\u00f6pfung",
    icon: "\u{1F5C4}\uFE0F",
    subtitle: "DB-Connection-Pool leer \u2192 Thread-Blockade",
    category: "pool",
    description:
      "Alle Connections im HikariCP-Pool sind belegt. Neue Requests blockieren auf pool.getConnection() bis connectionTimeout (Default: 30s) abl\u00e4uft \u2192 SQLTransientConnectionException. Blockierte Threads k\u00f6nnen den Tomcat-Thread-Pool mitrei\u00dfen (Kaskadeneffekt).",
    trigger:
      "Langsame SQL-Query (fehlender Index auf Datenbank-Join) h\u00e4lt Connections 5x l\u00e4nger als normal \u2192 Pool l\u00e4uft leer",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Pool 40% belegt, keine Pending-Threads, Acquire-Time <1ms",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Pool f\u00fcllt sich",
        desc: "Pool 75% belegt, Acquire-Time steigt auf 50ms",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Pending-Threads",
        desc: "Pool 95%, 8 Threads warten, Acquire-Time 500ms",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Timeouts",
        desc: "Pool 100%, 25+ Pending, Connection-Timeouts, HTTP 503",
      },
    ],
    metrics: [
      {
        name: "Pool Active / Max",
        unit: "%",
        healthy: 40,
        degraded: 75,
        warning: 95,
        critical: 100,
        thresholdWarn: 80,
        thresholdCrit: 95,
      },
      {
        name: "Pending Threads",
        unit: "",
        healthy: 0,
        degraded: 2,
        warning: 8,
        critical: 27,
        thresholdWarn: 5,
        thresholdCrit: 15,
      },
      {
        name: "Acquire Time",
        unit: "ms",
        healthy: 0.5,
        degraded: 50,
        warning: 500,
        critical: 10000,
        thresholdWarn: 100,
        thresholdCrit: 5000,
      },
      {
        name: "Timeout Count /min",
        unit: "/m",
        healthy: 0,
        degraded: 0,
        warning: 2,
        critical: 45,
        thresholdWarn: 1,
        thresholdCrit: 10,
      },
    ],
    promql: [
      {
        label: "Pool-Auslastung",
        query: "hikaricp_connections_active / hikaricp_connections_max * 100",
      },
      { label: "Pending Threads", query: "hikaricp_connections_pending" },
      {
        label: "Connection-Timeouts",
        query: "rate(hikaricp_connections_timeout_total[5m]) * 60",
      },
      {
        label: "Usage-Duration P95",
        query:
          "histogram_quantile(0.95,\n  sum(rate(hikaricp_connections_usage_seconds_bucket[5m])) by (le))",
      },
    ],
    fix: "Langsame Query finden (Slow-Query-Log, Tempo DB-Spans). Pool vergr\u00f6\u00dfern ist Symptombek\u00e4mpfung. connectionTimeout auf 10s reduzieren (Fail-Fast). leakDetectionThreshold=60000 aktivieren.",
    dashboardLevel: 3,
  },
  {
    id: "upstream-429",
    name: "Upstream API Rate-Limiting",
    icon: "\u{1F6AB}",
    subtitle: "B2B-Provider drosselt \u2192 Quotes unvollst\u00e4ndig",
    category: "external",
    description:
      "Ein Versicherungs-Provider antwortet mit HTTP 429 (Too Many Requests). Der Integrator kann f\u00fcr diesen Anbieter keine Quotes liefern \u2192 Endkunden sehen weniger Vergleichsangebote. Bei mehreren betroffenen Providern sinkt die Conversion-Rate.",
    trigger:
      "Peak-Traffic zur Vertragswechselsaison (November/Dezember), Retry-Storm nach kurzer Downtime eines Providers",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "0 Rejections, alle Provider antworten, Quote-Completeness 100%",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Erste 429s",
        desc: "Ein Provider drosselt, Quote-Completeness 92%",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Mehrere Provider",
        desc: "3 Provider drosseln, Completeness 70%, Retry-Backoff aktiv",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Massives Throttling",
        desc: "5+ Provider drosseln, Completeness <50%, Conversion-Rate eingebrochen",
      },
    ],
    metrics: [
      {
        name: "429 Rate (alle)",
        unit: "/s",
        healthy: 0,
        degraded: 5,
        warning: 25,
        critical: 80,
        thresholdWarn: 10,
        thresholdCrit: 50,
      },
      {
        name: "Quote Completeness",
        unit: "%",
        healthy: 100,
        degraded: 92,
        warning: 70,
        critical: 45,
        thresholdWarn: 85,
        thresholdCrit: 60,
        invert: true,
      },
      {
        name: "Provider verf\u00fcgbar",
        unit: "/15",
        healthy: 15,
        degraded: 14,
        warning: 12,
        critical: 10,
        thresholdWarn: 13,
        thresholdCrit: 11,
        invert: true,
      },
      {
        name: "Retry-Queue Depth",
        unit: "",
        healthy: 0,
        degraded: 120,
        warning: 800,
        critical: 5000,
        thresholdWarn: 500,
        thresholdCrit: 2000,
      },
    ],
    promql: [
      {
        label: "429-Rate pro Provider",
        query:
          'sum(rate(http_client_requests_seconds_count{status="429"}[5m])) by (clientName)',
      },
      {
        label: "Quote-Completeness",
        query:
          "sum(provider_quote_success_total) / sum(provider_quote_attempt_total) * 100",
      },
      {
        label: "Retry-After Header (Sekunden)",
        query: "max(upstream_retry_after_seconds) by (provider)",
      },
    ],
    fix: "Exponential Backoff mit Jitter implementieren (nicht feste Intervalle). Circuit Breaker pro Provider (Resilience4j). Request-Budgets pro Provider konfigurieren. Cached Quotes als Fallback (Stale-while-revalidate). Provider kontaktieren f\u00fcr h\u00f6heres Rate-Limit.",
    dashboardLevel: 2,
  },
  {
    id: "tomcat-exhaust",
    name: "Tomcat Thread-Pool voll",
    icon: "\u{1F9F5}",
    subtitle: "Alle Worker-Threads busy \u2192 HTTP 503",
    category: "pool",
    description:
      "Tomcat hat max. 200 Worker-Threads (Default). Wenn alle busy sind, landen neue Requests in der Accept-Queue (Default: 100). Ist auch die voll \u2192 Connection Refused / HTTP 503. H\u00e4ufig ein Folgeproblem: langsame Upstream-Calls oder DB-Queries blockieren Threads.",
    trigger:
      "HikariCP-Ersch\u00f6pfung blockiert Threads auf getConnection() \u2192 Tomcat-Threads stauen sich \u2192 Dominoeffekt",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "30/200 Threads busy (15%), Accept-Queue leer",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Last steigt",
        desc: "120/200 busy (60%), erste Queuing-Latenz",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Pool fast voll",
        desc: "185/200 busy (92%), Accept-Queue f\u00fcllt sich",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Ersch\u00f6pft",
        desc: "200/200 busy, Queue \u00fcerl\u00e4uft, HTTP 503",
      },
    ],
    metrics: [
      {
        name: "Busy / Max Threads",
        unit: "%",
        healthy: 15,
        degraded: 60,
        warning: 92,
        critical: 100,
        thresholdWarn: 75,
        thresholdCrit: 95,
      },
      {
        name: "Accept-Queue Depth",
        unit: "",
        healthy: 0,
        degraded: 5,
        warning: 45,
        critical: 100,
        thresholdWarn: 20,
        thresholdCrit: 80,
      },
      {
        name: "P99 Latenz",
        unit: "ms",
        healthy: 150,
        degraded: 400,
        warning: 1500,
        critical: 8000,
        thresholdWarn: 500,
        thresholdCrit: 3000,
      },
      {
        name: "HTTP 503 /min",
        unit: "/m",
        healthy: 0,
        degraded: 0,
        warning: 5,
        critical: 120,
        thresholdWarn: 1,
        thresholdCrit: 30,
      },
    ],
    promql: [
      {
        label: "Thread-Pool %",
        query:
          "tomcat_threads_busy_threads\n  / tomcat_threads_config_max_threads * 100",
      },
      {
        label: "Aktuelle Connections",
        query: "tomcat_connections_current_connections",
      },
    ],
    fix: "Root Cause finden: warum blockieren Threads? (DB-Pool? Upstream-Timeout?). Upstream-Timeouts verk\u00fcrzen (<5s). Virtual Threads evaluieren (spring.threads.virtual.enabled=true). Nicht einfach max-threads erh\u00f6hen \u2013 das verschiebt das Problem nur.",
    dashboardLevel: 2,
  },
  {
    id: "memory-oom",
    name: "Memory Pressure \u2192 OOMKill",
    icon: "\u{1F480}",
    subtitle: "Working-Set \u00fcberschreitet Limit \u2192 Pod-Restart",
    category: "compute",
    description:
      "container_memory_working_set_bytes n\u00e4hert sich dem Memory-Limit. Der Kubelet-OOM-Killer terminiert den Container. Bei JVM: Off-Heap-Bereiche (Metaspace, Thread-Stacks, NIO-Buffer) wachsen \u00fcber den JVM-Heap hinaus. Der Container stirbt, obwohl -Xmx noch Platz hat.",
    trigger:
      "Memory-Leak im JSON-Parsing (gro\u00dfe Provider-Responses nicht gestreamt), oder Metaspace-Wachstum durch dynamische Proxy-Klassen (Hibernate, Spring AOP)",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Memory bei 60% des Limits, GC effektiv",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Steigend",
        desc: "Memory bei 75%, GC-Frequenz nimmt zu",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Hoch",
        desc: "Memory bei 88%, Full-GC alle 2 Minuten",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "OOMKill",
        desc: "Memory >95%, OOMKilled, Pod restartet, Requests verloren",
      },
    ],
    metrics: [
      {
        name: "Memory / Limit",
        unit: "%",
        healthy: 60,
        degraded: 75,
        warning: 88,
        critical: 97,
        thresholdWarn: 80,
        thresholdCrit: 90,
      },
      {
        name: "Full-GC /min",
        unit: "/m",
        healthy: 0.1,
        degraded: 0.5,
        warning: 2,
        critical: 8,
        thresholdWarn: 1,
        thresholdCrit: 5,
      },
      {
        name: "Restarts (1h)",
        unit: "",
        healthy: 0,
        degraded: 0,
        warning: 1,
        critical: 4,
        thresholdWarn: 1,
        thresholdCrit: 3,
      },
      {
        name: "JVM Heap Used",
        unit: "%",
        healthy: 45,
        degraded: 62,
        warning: 78,
        critical: 92,
        thresholdWarn: 70,
        thresholdCrit: 85,
      },
    ],
    promql: [
      {
        label: "Memory vs. Limit",
        query:
          'container_memory_working_set_bytes{container!=""}\n  / kube_pod_container_resource_limits{resource="memory"} * 100',
      },
      {
        label: "OOMKilled erkennen",
        query:
          'kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}',
      },
      {
        label: "Restarts z\u00e4hlen",
        query: "increase(kube_pod_container_status_restarts_total[1h])",
      },
    ],
    fix: "Immer container_memory_working_set_bytes \u00fcberwachen (nicht usage_bytes). JVM: -XX:MaxRAMPercentage=75 (l\u00e4sst 25% f\u00fcr Off-Heap). Memory-Limit = JVM-Heap + ~30% f\u00fcr Metaspace/Stacks/NIO. Heap-Dump bei 85% automatisch ausl\u00f6sen: -XX:+HeapDumpOnOutOfMemoryError.",
    dashboardLevel: 3,
  },
  {
    id: "redis-saturation",
    name: "Redis-Cache-S\u00e4ttigung",
    icon: "\u26A1",
    subtitle:
      "Cache voll \u2192 Evictions \u2192 Miss-Rate steigt \u2192 API-Flut",
    category: "component",
    description:
      "Redis erreicht maxmemory. Die Eviction-Policy (z.B. allkeys-lru) beginnt, Keys zu verdr\u00e4ngen. Cache-Hit-Ratio sinkt \u2192 mehr Requests an B2B-APIs \u2192 Rate-Limiting-Risiko steigt. Kaskadeneffekt: Cache-Miss \u2192 Upstream-Call \u2192 h\u00f6here Latenz \u2192 mehr gleichzeitige Requests \u2192 noch mehr Cache-Misses.",
    trigger:
      "Neue Produktsparte mit vielen Tarifen ongeboardet, Cache-Keys explodieren. Oder: TTL zu lang, Stale-Daten f\u00fcllen den Cache.",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Hit-Ratio 96%, Memory 55%, 0 Evictions",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Memory steigt",
        desc: "Hit-Ratio 90%, Memory 78%, erste Evictions",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Eviction-Storm",
        desc: "Hit-Ratio 72%, Memory 95%, 500 Evictions/s",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Cache nutzlos",
        desc: "Hit-Ratio <50%, massive Upstream-Last, 429s h\u00e4ufen sich",
      },
    ],
    metrics: [
      {
        name: "Cache Hit-Ratio",
        unit: "%",
        healthy: 96,
        degraded: 90,
        warning: 72,
        critical: 45,
        thresholdWarn: 85,
        thresholdCrit: 60,
        invert: true,
      },
      {
        name: "Memory / Max",
        unit: "%",
        healthy: 55,
        degraded: 78,
        warning: 95,
        critical: 99,
        thresholdWarn: 80,
        thresholdCrit: 95,
      },
      {
        name: "Evictions /s",
        unit: "/s",
        healthy: 0,
        degraded: 20,
        warning: 500,
        critical: 3000,
        thresholdWarn: 100,
        thresholdCrit: 1000,
      },
      {
        name: "Upstream Calls /s",
        unit: "/s",
        healthy: 50,
        degraded: 85,
        warning: 200,
        critical: 600,
        thresholdWarn: 150,
        thresholdCrit: 400,
      },
    ],
    promql: [
      {
        label: "Hit-Ratio",
        query:
          "rate(redis_keyspace_hits_total[5m])\n  / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100",
      },
      { label: "Evictions", query: "rate(redis_evicted_keys_total[5m])" },
      {
        label: "Memory %",
        query: "redis_memory_used_bytes / redis_memory_max_bytes * 100",
      },
    ],
    fix: "maxmemory erh\u00f6hen oder Redis-Cluster skalieren. TTL-Strategie reviewen (k\u00fcrzere TTLs f\u00fcr volatile Daten). Cache-Key-Namespace pro Produktsparte. Stale-while-revalidate Pattern: abgelaufene Keys weiter ausliefern, im Hintergrund refreshen.",
    dashboardLevel: 2,
  },
  {
    id: "db-checkpoint",
    name: "DB Checkpoint-Sättigung",
    icon: "\u{1F418}",
    subtitle: "Redo-/WAL-Backlog → Flush-Storm → Commit-Latenz steigt",
    category: "component",
    description:
      "Das Redo-Log/WAL ist ein zirkulärer Puffer fester Größe. Steigt die Checkpoint Age (Abstand zwischen neuen Writes und geflushtem Schwanz) über die Schwellen, eskaliert InnoDB das Flushing: Adaptive-Flushing → Async-Point (7/8) → Sync-Point (15/16) → Voll-Pause aller User-Threads. Flush Storms frieren die Schreiboperationen ein.",
    trigger:
      "Write-Burst (Batch-Import, Massen-Update einer Produktsparte) übersteigt die provisionierte IOPS; das Redo-Log ist zu klein, um den Burst zu absorbieren.",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Checkpoint Age 20%, Commit-Latenz 4ms, sanftes Flushing",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Adaptive-Flushing",
        desc: "Checkpoint Age 60%, Flushing rampt, Commit-Latenz 12ms",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Async-Point (7/8)",
        desc: "Flushing auf max IO-Kapazität, Commit-Latenz 60ms",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Sync-Point (15/16)",
        desc: "User-Threads pausiert bis Age sinkt, Commit-Latenz >300ms",
      },
    ],
    metrics: [
      {
        name: "Checkpoint Age",
        unit: "%",
        healthy: 20,
        degraded: 60,
        warning: 88,
        critical: 97,
        thresholdWarn: 80,
        thresholdCrit: 94,
      },
      {
        name: "Commit-Latenz",
        unit: "ms",
        healthy: 4,
        degraded: 12,
        warning: 60,
        critical: 320,
        thresholdWarn: 50,
        thresholdCrit: 200,
      },
      {
        name: "IOPS / Provisioned",
        unit: "%",
        healthy: 45,
        degraded: 75,
        warning: 95,
        critical: 100,
        thresholdWarn: 80,
        thresholdCrit: 95,
      },
      {
        name: "Pool Pending",
        unit: "",
        healthy: 0,
        degraded: 2,
        warning: 12,
        critical: 40,
        thresholdWarn: 5,
        thresholdCrit: 20,
      },
    ],
    promql: [
      {
        label: "Checkpoint Age (InnoDB)",
        query:
          "mysql_global_status_innodb_checkpoint_age\n  / mysql_global_variables_innodb_redo_log_capacity * 100",
      },
      {
        label: "Commit-Latenz p99",
        query:
          "histogram_quantile(0.99,\n  sum(rate(db_commit_duration_seconds_bucket[5m])) by (le))",
      },
      { label: "Pending Connections", query: "hikaricp_connections_pending" },
    ],
    fix: "innodb_redo_log_capacity vergrößern, damit Write-Bursts absorbiert werden, ohne in Sync-Flushing zu kippen. PV mit Provisioned IOPS (gp3). Writes gleichmäßig verteilen (Jitter, Leaky Bucket) statt Batch-Peaks. Innodb_checkpoint_age überwachen — Nähe zum Async-Point = erschöpfte IO-Kapazität.",
    dashboardLevel: 3,
  },
  {
    id: "queue-broker",
    name: "Broker Back-Pressure",
    icon: "\u{1F4EC}",
    subtitle: "Memory-Watermark / Producer-Buffer voll → Publish blockiert",
    category: "component",
    description:
      "Zwei Spielarten: RabbitMQ überschreitet den vm_memory_high_watermark (~60%) und stoppt das Lesen vom Socket → publizierende Connections blockieren passiv im Socket-Write. Kafka erschöpft den Producer-Buffer (buffer.memory) → send() blockiert bis max.block.ms, dann TimeoutException. Beide sind pegelgetriggert: der Durchsatz bestimmt nur, wie schnell die Schwelle erreicht wird.",
    trigger:
      "Consumer/Broker langsamer als der Producer (langsamer Downstream, GC im Broker, Disk-Druck); der Producer schiebt weiter Last nach → der Pegel läuft auf die Schwelle zu.",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Broker-Memory 40%, Buffer frei, Publish-Latenz 3ms",
      },
      {
        t: 0.25,
        severity: "degraded",
        label: "Pegel steigt",
        desc: "Broker-Memory 55%, Buffer 60%, Publish-Latenz 15ms",
      },
      {
        t: 0.5,
        severity: "warning",
        label: "Watermark nah",
        desc: "58% Memory, erste blocked-Connections, Buffer 90%",
      },
      {
        t: 0.75,
        severity: "critical",
        label: "Blockiert",
        desc: "Watermark überschritten: alle Publisher blockiert, send()-Timeouts",
      },
    ],
    metrics: [
      {
        name: "Broker Memory",
        unit: "%",
        healthy: 40,
        degraded: 55,
        warning: 58,
        critical: 65,
        thresholdWarn: 55,
        thresholdCrit: 60,
      },
      {
        name: "Producer-Buffer",
        unit: "%",
        healthy: 20,
        degraded: 60,
        warning: 90,
        critical: 100,
        thresholdWarn: 75,
        thresholdCrit: 95,
      },
      {
        name: "Publish-Latenz",
        unit: "ms",
        healthy: 3,
        degraded: 15,
        warning: 120,
        critical: 800,
        thresholdWarn: 50,
        thresholdCrit: 500,
      },
      {
        name: "Blocked Publisher",
        unit: "",
        healthy: 0,
        degraded: 0,
        warning: 3,
        critical: 25,
        thresholdWarn: 1,
        thresholdCrit: 10,
      },
    ],
    promql: [
      {
        label: "RabbitMQ blocked connections",
        query: 'rabbitmq_connections{state="blocked"}',
      },
      {
        label: "RabbitMQ Memory vs Watermark",
        query:
          "rabbitmq_process_resident_memory_bytes\n  / rabbitmq_resident_memory_limit_bytes * 100",
      },
      {
        label: "Kafka Producer Buffer",
        query:
          "kafka_producer_buffer_available_bytes\n  / kafka_producer_buffer_total_bytes * 100",
      },
    ],
    fix: "RabbitMQ: BlockedListener registrieren, Publishing über eigene Queue + dedizierten Thread entkoppeln, bei handleBlocked aufhören nachzuschieben. Kafka: buffer-available-bytes überwachen (→0 = Sättigung), linger.ms/batch.size tunen, Partitionen/Broker skalieren. Generell: Back-Pressure bis an die Quelle weiterreichen statt unbounded Buffer.",
    dashboardLevel: 3,
  },
  {
    id: "cascade",
    name: "Kaskaden-Failure",
    icon: "\u{1F30A}",
    subtitle:
      "Slow Upstream \u2192 Thread-Block \u2192 Pool-Exhaust \u2192 503",
    category: "cascade",
    description:
      "Ein Provider wird langsam (Latenz 500ms \u2192 15s). Threads warten auf die Antwort. Tomcat-Threads stauen sich. HikariCP-Connections werden l\u00e4nger gehalten. Andere Provider-Calls werden ebenfalls blockiert, obwohl sie selbst schnell sind. Das gesamte System steht.",
    trigger:
      "Provider-A hat Wartungsfenster, antwortet statt in 500ms in 15s. Kein Circuit-Breaker konfiguriert. Connect-Timeout 30s.",
    phases: [
      {
        t: 0,
        severity: "healthy",
        label: "Normal",
        desc: "Alle Provider <500ms, System gesund",
      },
      {
        t: 0.2,
        severity: "degraded",
        label: "Provider-A langsam",
        desc: "Provider-A: 5s statt 500ms, andere noch OK",
      },
      {
        t: 0.4,
        severity: "warning",
        label: "Thread-Stau",
        desc: "Tomcat-Threads 85% busy durch wartende Provider-A-Calls",
      },
      {
        t: 0.6,
        severity: "warning",
        label: "Pool-Ersch\u00f6pfung",
        desc: "HikariCP 95%, auch Provider-B/C-Calls langsam (Thread-Starvation)",
      },
      {
        t: 0.8,
        severity: "critical",
        label: "Systemausfall",
        desc: "503 f\u00fcr ALLE Requests, nicht nur Provider-A. Kompletter Stillstand.",
      },
    ],
    metrics: [
      {
        name: "Provider-A P99",
        unit: "ms",
        healthy: 450,
        degraded: 5000,
        warning: 12000,
        critical: 15000,
        thresholdWarn: 3000,
        thresholdCrit: 10000,
      },
      {
        name: "Tomcat Busy %",
        unit: "%",
        healthy: 20,
        degraded: 55,
        warning: 85,
        critical: 100,
        thresholdWarn: 75,
        thresholdCrit: 95,
      },
      {
        name: "Hikari Active %",
        unit: "%",
        healthy: 35,
        degraded: 60,
        warning: 95,
        critical: 100,
        thresholdWarn: 80,
        thresholdCrit: 95,
      },
      {
        name: "Error Rate (alle)",
        unit: "%",
        healthy: 0.1,
        degraded: 2,
        warning: 15,
        critical: 65,
        thresholdWarn: 5,
        thresholdCrit: 30,
      },
    ],
    promql: [
      {
        label: "P99 pro Provider",
        query:
          "histogram_quantile(0.99,\n  sum(rate(http_client_requests_seconds_bucket[5m])) by (le, clientName))",
      },
      {
        label: "Thread-Pool + DB-Pool korreliert",
        query:
          "# Tomcat\ntomcat_threads_busy_threads / tomcat_threads_config_max_threads\n# HikariCP\nhikaricp_connections_active / hikaricp_connections_max",
      },
    ],
    fix: "Circuit Breaker (Resilience4j) pro Provider mit Timeout <3s. Bulkhead: dedizierte Thread-Pools pro Provider, damit ein langsamer Provider nicht alle Threads blockiert. Virtual Threads l\u00f6sen das Problem fundamental (blockierte Threads sind billig). Fallback: gecachte/leere Response statt Warten.",
    dashboardLevel: 2,
  },
];

// Kategorie-Metadaten je Szenario: Icon + Kurzlabel f\u00FCrs Badge, plus eine
// theme-abh\u00E4ngige, farbfehlsichtigkeits-taugliche Farbe (Okabe-Ito / Paul-Tol-
// inspiriert; Light abgedunkelt f\u00FCr Textkontrast auf heller Fl\u00E4che, Dark
// aufgehellt). Bewusst KEINE Severity-Farben (gr\u00FCn/gelb/orange/rot), damit ein
// Kategorie-Badge nicht mit einem HEALTHY/WARNING/\u2026 Severity-Badge verwechselt
// wird. "all" entf\u00E4llt \u2014 es ist keine Szenario-Kategorie.
const CAT_META = {
  compute: {
    short: "Compute",
    icon: "\u2699\uFE0F",
    light: "#0072B2",
    dark: "#5BB0E5",
  }, // Blau
  pool: { short: "Pool", icon: "\u{1F517}", light: "#007A6B", dark: "#34D3A6" }, // Teal
  component: {
    short: "Infra",
    icon: "\u{1F9F1}",
    light: "#9333A8",
    dark: "#D08BE8",
  }, // Violett
  external: {
    short: "Extern",
    icon: "\u{1F310}",
    light: "#B26A00",
    dark: "#E69F00",
  }, // Bernstein
  cascade: {
    short: "Kaskade",
    icon: "\u{1F30A}",
    light: "#C2255C",
    dark: "#F06292",
  }, // Magenta
};
function catColor(id) {
  const m = CAT_META[id];
  return isDark.value ? m.dark : m.light;
}

// Szenarien nach Kategorie gruppiert anzeigen (Compute unter Compute …), in der
// Reihenfolge der CAT_META-Definition; innerhalb einer Kategorie bleibt die
// Autoren-Reihenfolge erhalten (Array.sort ist stabil). SCENARIOS selbst bleibt
// unangetastet, damit Lookups per id unverändert funktionieren.
const CAT_ORDER = Object.keys(CAT_META);
const SCENARIOS_SORTED = [...SCENARIOS].sort(
  (a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category),
);

// --- Reactive state ---
const activeId = ref("cpu-throttle");
const progress = ref(0);
const playing = ref(false);
const showPromQL = ref(false);

let animFrameId = null;
let startTime = null;

const scenario = computed(
  () => SCENARIOS.find((s) => s.id === activeId.value) || SCENARIOS[0],
);

// --- Animation ---
function animate(timestamp) {
  if (startTime === null) startTime = timestamp;
  const elapsed = timestamp - startTime;
  const duration = 8000;
  const p = Math.min(elapsed / duration, 1);
  progress.value = p;
  if (p < 1) {
    animFrameId = requestAnimationFrame(animate);
  } else {
    playing.value = false;
  }
}

function handlePlay() {
  progress.value = 0;
  startTime = null;
  playing.value = true;
  animFrameId = requestAnimationFrame(animate);
}

function handleStop() {
  playing.value = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function handleSelectScenario(id) {
  handleStop();
  activeId.value = id;
  progress.value = 0;
  showPromQL.value = false;
}

function handleSliderInput(e) {
  handleStop();
  progress.value = parseFloat(e.target.value);
}

// --- Scroll-Fade-Affordance der Szenario-Liste ---
// Blendet den oberen/unteren Rand weich aus, solange in die jeweilige Richtung
// gescrollt werden kann — auf einem schlechten Beamer sofort als „hier gibt es
// mehr, bitte scrollen" erkennbar. Am tatsächlichen Ende verschwindet der Fade,
// damit die letzte Kachel voll sicht- und klickbar bleibt.
const listEl = ref(null);
const canScrollUp = ref(false);
const canScrollDown = ref(false);
function updateScrollFades() {
  const el = listEl.value;
  if (!el) return;
  canScrollUp.value = el.scrollTop > 2;
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
}

// Slidev mountet Folien teils unsichtbar vor (Größe 0) — dann misst onMounted
// noch keine Überlauf-Höhe. Ein ResizeObserver rechnet den Fade neu, sobald die
// Liste beim Sichtbarwerden ihre echte Höhe bekommt.
let listResizeObs = null;
onMounted(() => {
  updateScrollFades();
  if (listEl.value && typeof ResizeObserver !== "undefined") {
    listResizeObs = new ResizeObserver(() => updateScrollFades());
    listResizeObs.observe(listEl.value);
  }
});

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (listResizeObs) listResizeObs.disconnect();
});

// --- Computed metric values ---
const currentPhaseIdx = computed(() =>
  scenario.value.phases.reduce(
    (acc, p, i) => (progress.value >= p.t ? i : acc),
    0,
  ),
);
const currentPhase = computed(
  () => scenario.value.phases[currentPhaseIdx.value],
);
const nextPhase = computed(
  () => scenario.value.phases[currentPhaseIdx.value + 1] || null,
);
const phaseProgress = computed(() => {
  const cp = currentPhase.value;
  const np = nextPhase.value;
  if (np) return (progress.value - cp.t) / (np.t - cp.t);
  return (progress.value - cp.t) / (1 - cp.t);
});

const metricValues = computed(() =>
  scenario.value.metrics.map((m) => {
    const sevKeys = ["healthy", "degraded", "warning", "critical"];
    const vals = sevKeys.map((k) => m[k]);
    const pIdx = Math.min(currentPhaseIdx.value, vals.length - 1);
    const nextIdx = Math.min(pIdx + 1, vals.length - 1);
    return lerp(vals[pIdx], vals[nextIdx], clamp(phaseProgress.value, 0, 1));
  }),
);

const sparklines = computed(() =>
  scenario.value.metrics.map((m, idx) => {
    const pts = [];
    const numPts = 50;
    for (let i = 0; i < numPts; i++) {
      const t = i / (numPts - 1);
      if (t > progress.value) {
        pts.push(0);
        continue;
      }
      const pIdx2 = scenario.value.phases.reduce(
        (a, p, j) => (t >= p.t ? j : a),
        0,
      );
      const nxt2 = scenario.value.phases[pIdx2 + 1];
      const pp2 = nxt2
        ? (t - scenario.value.phases[pIdx2].t) /
          (nxt2.t - scenario.value.phases[pIdx2].t)
        : (t - scenario.value.phases[pIdx2].t) /
          (1 - scenario.value.phases[pIdx2].t);
      const sevKeys2 = ["healthy", "degraded", "warning", "critical"];
      const vals2 = sevKeys2.map((k) => m[k]);
      const clampedIdx2 = Math.min(pIdx2, vals2.length - 1);
      const nxtIdx2 = Math.min(clampedIdx2 + 1, vals2.length - 1);
      const base = lerp(vals2[clampedIdx2], vals2[nxtIdx2], clamp(pp2, 0, 1));
      const maxVal = Math.max(...vals2);
      const noise =
        Math.sin(i * 5.1 + idx * 7) * 0.03 +
        Math.sin(i * 11.3 + idx * 3) * 0.02;
      pts.push(clamp(base / maxVal + noise, 0, 1));
    }
    return pts;
  }),
);

const currentSeverity = computed(() => currentPhase.value.severity);

// --- Sparkline SVG path helpers ---
function sparklinePath(points, width, height) {
  return points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - v * height * 0.85 - 1.3;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
function sparklineArea(points, width, height) {
  return (
    sparklinePath(points, width, height) + ` L${width},${height} L0,${height} Z`
  );
}

// --- Gauge color helper ---
function gaugeColor(m, curVal) {
  if (Number.isNaN(curVal)) return C.value.red;
  if (m.invert) {
    if (curVal <= m.thresholdCrit) return C.value.red;
    if (curVal <= m.thresholdWarn) return C.value.orange;
  } else {
    if (curVal >= m.thresholdCrit) return C.value.red;
    if (curVal >= m.thresholdWarn) return C.value.orange;
  }
  return C.value.green;
}

// Phase timeline helpers
function phaseWidth(phases, idx) {
  const p = phases[idx];
  const next = phases[idx + 1];
  const end = next ? next.t : 1;
  return (end - p.t) * 100;
}
function phaseFilled(phases, idx, prog) {
  const p = phases[idx];
  const next = phases[idx + 1];
  const end = next ? next.t : 1;
  if (prog >= end) return 100;
  if (prog <= p.t) return 0;
  return ((prog - p.t) / (end - p.t)) * 100;
}
</script>

<template>
  <div
    class="sim-root"
    :style="{
      '--c-bg': C.bg,
      '--c-surface': C.surface,
      '--c-surfaceAlt': C.surfaceAlt,
      '--c-border': C.border,
      '--c-borderHi': C.borderHi,
      '--c-text': C.text,
      '--c-muted': C.muted,
      '--c-dim': C.dim,
      '--c-blue': C.blue,
      '--c-green': C.green,
      '--c-yellow': C.yellow,
      '--c-orange': C.orange,
      '--c-red': C.red,
      '--c-codeBg': C.codeBg,
      '--c-codeText': C.codeText,
    }"
  >
    <div class="sim-container">
      <!-- Header -->
      <div class="sim-header">
        <div class="sim-header-top">
          <div class="pulse-dot" :class="{ animating: playing }" />
          <span class="sim-label">Saturation Simulator</span>
        </div>
        <h1 class="sim-title">S&auml;ttigungs-Szenarien durchspielen</h1>
        <p class="sim-desc">
          W&auml;hle ein Szenario und beobachte, wie sich Metriken von HEALTHY
          &rarr; CRITICAL entwickeln.
        </p>
      </div>

      <div class="sim-layout">
        <!-- Left: scenario list -->
        <div class="sim-sidebar">
          <div
            ref="listEl"
            class="scenario-list"
            :class="{ 'fade-top': canScrollUp, 'fade-bottom': canScrollDown }"
            @scroll="updateScrollFades"
          >
            <button
              v-for="s in SCENARIOS_SORTED"
              :key="s.id"
              class="scenario-btn"
              :class="{ active: activeId === s.id }"
              @click="handleSelectScenario(s.id)"
            >
              <span
                class="cat-badge"
                :style="{
                  background: catColor(s.category) + '22',
                  color: catColor(s.category),
                  borderColor: catColor(s.category) + '55',
                }"
                >{{ CAT_META[s.category].icon }}
                {{ CAT_META[s.category].short }}</span
              >
              <div class="scenario-btn-header">
                <span class="scenario-icon">{{ s.icon }}</span>
                <span
                  class="scenario-name"
                  :class="{ 'text-blue': activeId === s.id }"
                  >{{ s.name }}</span
                >
              </div>
              <div class="scenario-subtitle">{{ s.subtitle }}</div>
            </button>
          </div>
        </div>

        <!-- Right: simulator -->
        <div class="sim-main">
          <!-- Scenario header card -->
          <div
            class="scenario-header-card"
            :style="{ borderColor: severityColor(currentSeverity) + '30' }"
          >
            <div class="scenario-header-top">
              <div>
                <div class="scenario-header-title">
                  <span class="scenario-header-icon">{{ scenario.icon }}</span>
                  <span class="scenario-header-name">{{ scenario.name }}</span>
                  <span
                    class="severity-badge"
                    :style="{
                      background: severityBg(currentSeverity),
                      color: severityColor(currentSeverity),
                      borderColor: severityColor(currentSeverity) + '40',
                    }"
                    >{{ severityLabel(currentSeverity) }}</span
                  >
                </div>
                <div class="scenario-header-desc">
                  {{ scenario.description }}
                </div>
              </div>
              <div class="dashboard-level">
                Dashboard: Level {{ scenario.dashboardLevel }}
              </div>
            </div>

            <!-- Trigger -->
            <div class="trigger-box">
              <span class="trigger-label">TRIGGER </span>
              <span class="trigger-text">{{ scenario.trigger }}</span>
            </div>

            <!-- Controls -->
            <div class="controls-row">
              <button
                class="play-btn"
                @click="playing ? handleStop() : handlePlay()"
              >
                {{ playing ? "⏸" : "▶" }}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                :value="progress"
                class="progress-slider"
                @input="handleSliderInput"
              />
              <span class="progress-pct"
                >{{ Math.round(progress * 100) }}%</span
              >
            </div>

            <!-- Phase timeline -->
            <div class="phase-timeline">
              <!-- Track -->
              <div class="phase-track">
                <div
                  v-for="(p, i) in scenario.phases"
                  :key="i"
                  class="phase-track-segment"
                  :style="{ width: phaseWidth(scenario.phases, i) + '%' }"
                >
                  <div
                    class="phase-track-fill"
                    :style="{
                      background: severityColor(p.severity),
                      width: phaseFilled(scenario.phases, i, progress) + '%',
                    }"
                  />
                </div>
              </div>
              <!-- Phase labels -->
              <div class="phase-labels">
                <div
                  v-for="(p, i) in scenario.phases"
                  :key="i"
                  class="phase-label-item"
                  :style="{
                    width: phaseWidth(scenario.phases, i) + '%',
                    opacity:
                      progress >= p.t &&
                      progress < (scenario.phases[i + 1]?.t ?? 1)
                        ? 1
                        : progress >= (scenario.phases[i + 1]?.t ?? 1)
                          ? 0.5
                          : 0.3,
                  }"
                >
                  <div class="phase-label-header">
                    <span
                      class="phase-dot"
                      :style="{
                        background: severityColor(p.severity),
                        border:
                          progress >= p.t &&
                          progress < (scenario.phases[i + 1]?.t ?? 1)
                            ? '1.5px solid ' + C.text
                            : 'none',
                      }"
                    />
                    <span
                      class="phase-sev"
                      :style="{ color: severityColor(p.severity) }"
                    >
                      {{ severityLabel(p.severity) }}
                    </span>
                  </div>
                  <div class="phase-name">{{ p.label }}</div>
                  <div class="phase-desc">{{ p.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Metrics gauges + sparklines -->
          <div class="metrics-grid">
            <div
              v-for="(m, i) in scenario.metrics"
              :key="i"
              class="metric-card"
              :style="{
                borderColor:
                  gaugeColor(m, metricValues[i]) === C.red
                    ? C.red + '40'
                    : gaugeColor(m, metricValues[i]) === C.orange
                      ? C.orange + '30'
                      : C.border,
              }"
            >
              <GaugeRing
                :value="metricValues[i]"
                :max="
                  Math.max(m.healthy, m.degraded, m.warning, m.critical) * 1.1
                "
                :warn="m.thresholdWarn"
                :crit="m.thresholdCrit"
                :size="68"
                :label="m.name"
                :unit="m.unit"
                :invert="!!m.invert"
              />
              <svg :viewBox="`0 0 65 16`" class="sparkline-svg">
                <defs>
                  <linearGradient :id="'sg-' + i" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      :stop-color="gaugeColor(m, metricValues[i])"
                      stop-opacity="0.25"
                    />
                    <stop
                      offset="100%"
                      :stop-color="gaugeColor(m, metricValues[i])"
                      stop-opacity="0"
                    />
                  </linearGradient>
                </defs>
                <path
                  :d="sparklineArea(sparklines[i], 65, 16)"
                  :fill="`url(#sg-${i})`"
                />
                <path
                  :d="sparklinePath(sparklines[i], 65, 16)"
                  fill="none"
                  :stroke="gaugeColor(m, metricValues[i])"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <div class="metric-thresholds">
                <span class="threshold-warn"
                  >⚠ {{ m.thresholdWarn }}{{ m.unit }}</span
                >
                <span class="threshold-crit"
                  >🔴 {{ m.thresholdCrit }}{{ m.unit }}</span
                >
              </div>
            </div>
          </div>

          <!-- Fix + PromQL -->
          <div class="fix-promql-area">
            <!-- Fix -->
            <div class="fix-box">
              <div class="fix-label">✓ Gegenmaßnahmen</div>
              <div class="fix-text">{{ scenario.fix }}</div>
            </div>

            <!-- PromQL toggle -->
            <button class="promql-toggle" @click="showPromQL = !showPromQL">
              <span
                >PromQL-Queries anzeigen ({{ scenario.promql.length }})</span
              >
              <span class="promql-arrow" :class="{ open: showPromQL }">▾</span>
            </button>
            <div v-if="showPromQL" class="promql-block">
              <div
                v-for="(item, i) in scenario.promql"
                :key="i"
                class="promql-item"
              >
                <div class="promql-label">{{ item.label }}</div>
                <pre class="promql-code">{{ item.query }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.sim-root {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: inherit;
  width: 100%;
  height: 100%;
  overflow: auto;
  font-size: 8px;
}
.sim-root ::-webkit-scrollbar {
  width: 3px;
  height: 3px;
}
.sim-root ::-webkit-scrollbar-track {
  background: transparent;
}
.sim-root ::-webkit-scrollbar-thumb {
  background: var(--c-border);
  border-radius: 2px;
}

.sim-container {
  max-width: 650px;
  margin: 0 auto;
  padding: 8px 8px 12px;
}

/* Header */
.sim-header {
  margin-bottom: 6px;
}
.sim-header-top {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 1px;
}
.pulse-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-red);
  box-shadow: 0 0 6px var(--c-red);
}
.pulse-dot.animating {
  animation: pulse 1.5s infinite;
}
.sim-label {
  font-size: 7px;
  font-weight: 700;
  color: var(--c-red);
  text-transform: uppercase;
  letter-spacing: 1.3px;
  font-family: var(--slidev-code-font-family);
}
.sim-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.3px;
  margin-bottom: 1px;
}
.sim-desc {
  font-size: 7.5px;
  color: var(--c-muted);
  max-width: 420px;
  line-height: 1.4;
}

/* Layout */
.sim-layout {
  display: flex;
  gap: 8px;
}
.sim-sidebar {
  flex: 0 0 140px;
  min-width: 120px;
}
.sim-main {
  flex: 1;
  min-width: 200px;
}

/* Scenario list */
.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  /* Independently scrollable. max-height is in LOGICAL canvas px (the deck
     renders on a ~1.3x-scaled 980x552 canvas), sized to fill the body all
     the way down to the visible viewport edge so the list is not short.
     The half-tile bottom padding lets the last card scroll up far enough to
     stay selectable even when the auto-hiding Slidev nav-toolbar overlays
     the bottom-left — it then only covers the padding / lower half of the
     last tile, never its clickable header. Höhe bewusst begrenzt: die Liste
     soll innerhalb des Slide-Canvas enden (sonst schneidet Slidev unten ab). */
  max-height: 348px;
  overflow-y: auto;
  padding-right: 3px;
  padding-bottom: 26px;
  overscroll-behavior: contain;
}
/* Scroll-Fade: weicher Verlauf am scrollbaren Rand als Scroll-Affordance.
   ~24px ≈ halbe Kachel; per JS-Klasse nur aktiv, solange in die Richtung
   gescrollt werden kann. mask + -webkit-mask, da WebKit nur das Präfix kennt. */
.scenario-list.fade-bottom {
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 calc(100% - 24px),
    transparent
  );
  mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent);
}
.scenario-list.fade-top {
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 24px);
  mask-image: linear-gradient(to bottom, transparent, #000 24px);
}
.scenario-list.fade-top.fade-bottom {
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
}
.scenario-btn {
  position: relative;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 6px 7px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  outline: none;
  width: 100%;
  color: var(--c-text);
}
/* Kategorie-Badge oben rechts (Icon + Kurzlabel, in Kategorie-Farbe) */
.cat-badge {
  position: absolute;
  top: 6px;
  right: 7px;
  font-size: 6px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid;
  white-space: nowrap;
  line-height: 1.3;
  font-family: var(--slidev-code-font-family);
}
.scenario-btn.active {
  border-color: var(--c-blue);
}
.scenario-btn:hover:not(.active) {
  border-color: var(--c-borderHi);
  background: var(--c-surfaceAlt);
}
.scenario-btn-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
  /* Platz für das oben rechts absolut positionierte Kategorie-Badge */
  padding-right: 48px;
}
.scenario-icon {
  font-size: 11px;
}
.scenario-name {
  font-size: 8px;
  font-weight: 700;
}
.scenario-name.text-blue {
  color: var(--c-blue);
}
.scenario-subtitle {
  font-size: 6.5px;
  color: var(--c-muted);
  line-height: 1.3;
}

/* Scenario header card */
.scenario-header-card {
  background: var(--c-surface);
  border: 1px solid;
  border-radius: 7px;
  padding: 8px 10px;
  margin-bottom: 6px;
  animation: fadeIn 0.3s ease;
}
.scenario-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 6px;
}
.scenario-header-title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}
.scenario-header-icon {
  font-size: 14px;
}
.scenario-header-name {
  font-size: 11px;
  font-weight: 800;
}
.severity-badge {
  font-size: 6.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid;
  font-family: var(--slidev-code-font-family);
}
.scenario-header-desc {
  font-size: 7.5px;
  color: var(--c-muted);
  line-height: 1.4;
  max-width: 340px;
}
.dashboard-level {
  font-size: 6.5px;
  color: var(--c-dim);
  font-family: var(--slidev-code-font-family);
  text-align: right;
  flex-shrink: 0;
}

/* Trigger */
.trigger-box {
  background: rgba(249, 115, 22, 0.05);
  border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 4px;
  padding: 4px 6px;
  margin-bottom: 7px;
}
.trigger-label {
  font-size: 6.5px;
  font-weight: 700;
  color: var(--c-orange);
  font-family: var(--slidev-code-font-family);
}
.trigger-text {
  font-size: 7.5px;
  color: var(--c-text);
}

/* Controls */
.controls-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.play-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--c-blue);
  background: rgba(59, 130, 246, 0.1);
  color: var(--c-blue);
  font-size: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.play-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}
.progress-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  background: var(--c-border);
  height: 3px;
  border-radius: 1.5px;
  outline: none;
}
.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c-blue);
  cursor: pointer;
  border: 1.5px solid var(--c-bg);
}
.progress-pct {
  font-size: 7px;
  color: var(--c-muted);
  font-family: var(--slidev-code-font-family);
  min-width: 22px;
  text-align: right;
}

/* Phase timeline */
.phase-timeline {
  position: relative;
}
.phase-track {
  display: flex;
  gap: 0;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--c-border);
}
.phase-track-segment {
  position: relative;
}
.phase-track-fill {
  height: 100%;
  transition: width 0.3s ease;
  opacity: 0.8;
}
.phase-labels {
  display: flex;
  margin-top: 4px;
  gap: 2px;
}
.phase-label-item {
  transition: opacity 0.3s ease;
}
.phase-label-header {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 1px;
}
.phase-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  flex-shrink: 0;
}
.phase-sev {
  font-size: 6px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
}
.phase-name {
  font-size: 7px;
  font-weight: 600;
  color: var(--c-text);
  margin-bottom: 1px;
}
.phase-desc {
  font-size: 6.5px;
  color: var(--c-muted);
  line-height: 1.3;
}

/* Metrics grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}
.metric-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: border-color 0.3s ease;
}
.sparkline-svg {
  width: 100%;
  height: 16px;
}
.metric-thresholds {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 1px;
}
.threshold-warn {
  font-size: 5.5px;
  color: var(--c-dim);
  font-family: var(--slidev-code-font-family);
}
.threshold-crit {
  font-size: 5.5px;
  color: var(--c-dim);
  font-family: var(--slidev-code-font-family);
}

/* Fix + PromQL */
.fix-promql-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fix-box {
  background: var(--c-surface);
  border: 1px solid rgba(34, 197, 94, 0.12);
  border-radius: 5px;
  padding: 6px 8px;
}
.fix-label {
  font-size: 7px;
  font-weight: 700;
  color: var(--c-green);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 3px;
  font-family: var(--slidev-code-font-family);
}
.fix-text {
  font-size: 7.5px;
  color: var(--c-text);
  line-height: 1.5;
}

.promql-toggle {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 5px 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--c-blue);
  font-size: 7.5px;
  font-weight: 600;
  transition: all 0.15s ease;
  outline: none;
}
.promql-toggle:hover {
  border-color: var(--c-blue);
}
.promql-arrow {
  transition: transform 0.2s ease;
  display: inline-block;
}
.promql-arrow.open {
  transform: rotate(180deg);
}

.promql-block {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 6px 8px;
  animation: fadeIn 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.promql-item {
}
.promql-label {
  font-size: 6.5px;
  font-weight: 700;
  color: var(--c-blue);
  margin-bottom: 2px;
  font-family: var(--slidev-code-font-family);
}
.promql-code {
  background: var(--c-codeBg);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  padding: 5px 6px;
  font-size: 7px;
  color: var(--c-codeText);
  font-family: var(--slidev-code-font-family);
  line-height: 1.4;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
