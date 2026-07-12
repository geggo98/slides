<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#0a0d12" : "#f8fafc",
    surface: d ? "#111621" : "#ffffff",
    surfaceAlt: d ? "#161c2a" : "#f1f5f9",
    border: d ? "#1e2536" : "#e2e8f0",
    text: d ? "#e2e8f0" : "#1e293b",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    blue: d ? "#3b82f6" : "#2563eb",
    green: d ? "#22c55e" : "#16a34a",
    yellow: d ? "#eab308" : "#ca8a04",
    orange: d ? "#f97316" : "#ea580c",
    red: d ? "#ef4444" : "#dc2626",
    purple: d ? "#a855f7" : "#9333ea",
    cyan: d ? "#06b6d4" : "#0891b2",
    pink: d ? "#ec4899" : "#db2777",
    lime: d ? "#84cc16" : "#65a30d",
    amber: d ? "#f59e0b" : "#d97706",
  };
});

const CATEGORIES = computed(() => [
  { id: "all", label: "Alle", color: C.value.text },
  { id: "app", label: "Applikation", color: C.value.orange },
  { id: "gc", label: "Garbage Collection", color: C.value.red },
  { id: "component", label: "Infra-Komponente", color: C.value.purple },
  { id: "infra", label: "Plattform", color: C.value.green },
  { id: "network", label: "Netzwerk", color: C.value.cyan },
  { id: "k8s", label: "Kubernetes", color: C.value.blue },
]);

function buildPath(points) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const segs = 12;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const st = t * t * (3 - 2 * t);
      result.push({ x: x0 + (x1 - x0) * st, y: y0 + (y1 - y0) * st });
    }
  }
  return result;
}

const HYSTERESES = computed(() => [
  {
    id: "cache-stampede",
    short:
      "Unter Last evicten/expiren Cache-Entries; sinkt die Last, ist der Cache kalt.",
    name: "Cache-Stampede",
    icon: "\u26A1",
    category: "app",
    color: C.value.yellow,
    x: "Request Rate",
    y: "P99 Latenz",
    upPath: [
      [0.05, 0.04],
      [0.15, 0.05],
      [0.3, 0.07],
      [0.45, 0.12],
      [0.6, 0.22],
      [0.75, 0.45],
      [0.85, 0.72],
      [0.95, 0.95],
    ],
    downPath: [
      [0.95, 0.95],
      [0.88, 0.9],
      [0.78, 0.82],
      [0.65, 0.68],
      [0.5, 0.52],
      [0.35, 0.38],
      [0.2, 0.2],
      [0.08, 0.1],
    ],
    mechanism:
      "Unter Überlast werden Cache-Entries evicted oder expiren. Wenn Last sinkt, ist der Cache kalt: jeder Request triggert einen Upstream-Call.",
    whyStick:
      "Cache-Warm-Up dauert Minuten. Hit-Ratio bei 40% statt 96% hält Upstream-Last hoch, was wiederum Rate-Limiting provoziert.",
    recovery:
      "Stale-while-revalidate Pattern. Cache-Prewarming nach Incidents. TTL-Jitter gegen synchrone Expiration.",
    severity: "hoch",
    metrics: "cache_hit_ratio, rate(http_client_requests_seconds_count[5m])",
    brakeForm: "super-linear",
    memory: "zustandsbehaftet",
    setReset: "Set: Hit-Ratio bricht ein · Reset: Cache warm",
  },
  {
    id: "gc-death-spiral",
    short:
      "Heap-Druck nahe dem Limit erzwingt mehr GC; GC und App teilen sich die CPU → selbstverstärkend.",
    name: "Runtime GC Death Spiral",
    icon: "\uD83D\uDD04",
    category: "gc",
    color: C.value.red,
    x: "CPU-Auslastung",
    y: "GC-CPU-Anteil",
    upPath: [
      [0.25, 0.02],
      [0.35, 0.03],
      [0.45, 0.05],
      [0.55, 0.1],
      [0.65, 0.2],
      [0.75, 0.4],
      [0.85, 0.68],
      [0.95, 0.95],
    ],
    downPath: [
      [0.95, 0.95],
      [0.9, 0.92],
      [0.82, 0.85],
      [0.72, 0.72],
      [0.6, 0.55],
      [0.48, 0.38],
      [0.38, 0.25],
      [0.28, 0.15],
    ],
    mechanism:
      "In jeder Runtime mit Tracing-GC (JVM, V8/Node, Go, .NET) erzwingt Heap-Druck nahe dem Limit häufigere GC. GC und Anwendungscode teilen sich die CPU → Requests langsamer → Objekte leben länger und stauen → noch mehr GC.",
    whyStick:
      "Selbstverstärkend bis CPU-Sättigung oder OOM. Bremsen unterscheiden sich: Go (mutator-assist + ~50%-CPU-Limiter) und Shenandoah (Pacer) drosseln graceful, ZGC stallt binär, V8/.NET haben kein Ventil. Python: Refcounting recycelt synchron, nur der zyklische GC brennt CPU (Asterisk).",
    recovery:
      "Heap/CPU-Headroom schaffen, Allokationsrate senken, Limits korrekt setzen (JVM -XX:MaxRAMPercentage, Go GOMEMLIMIT, .NET GCHeapHardLimit). Oft hilft nur Pod-Restart (Heap-Reset).",
    severity: "kritisch",
    metrics:
      "go_gc_cpu_fraction / GODEBUG=gctrace, jvm_gc_pause_seconds_*, .NET % Time in GC, node --trace-gc",
    brakeForm: "super-linear",
    memory: "zustandsbehaftet",
    setReset: null,
  },
  {
    id: "heap-fragmentation",
    name: "Heap-Fragmentierung",
    icon: "\uD83E\uDDE9",
    category: "gc",
    color: C.value.orange,
    x: "Allocation Rate",
    y: "Full-GC Frequenz",
    upPath: [
      [0.08, 0.02],
      [0.2, 0.03],
      [0.35, 0.05],
      [0.5, 0.12],
      [0.65, 0.3],
      [0.8, 0.6],
      [0.92, 0.9],
    ],
    downPath: [
      [0.92, 0.9],
      [0.82, 0.85],
      [0.68, 0.72],
      [0.52, 0.55],
      [0.38, 0.4],
      [0.25, 0.28],
      [0.12, 0.18],
    ],
    mechanism:
      "Hohe Allocation-Rate erzeugt kurzlebige Objekte in der Young Gen. Survivor-Spaces laufen über → Fragmentierung.",
    whyStick:
      "Old-Gen-Fragmentierung bleibt nach Last-Reduktion. G1 muss viele Mixed-GC-Zyklen fahren um zu compacten.",
    recovery:
      "G1 statt CMS. -XX:G1HeapRegionSize tunen. Allocation-Rate reduzieren (Object Pooling für heiße Pfade).",
    severity: "mittel",
    metrics:
      'jvm_gc_pause_seconds_count{gc="G1 Old Generation"}, jvm_memory_pool_bytes_used',
    brakeForm: "super-linear",
    memory: "zustandsbehaftet",
    setReset: null,
  },
  {
    id: "hikari-backlog",
    name: "Connection-Pool-Backlog",
    icon: "\uD83D\uDDC4\uFE0F",
    category: "app",
    color: C.value.purple,
    x: "Eingehende Req/s",
    y: "Pending Threads",
    upPath: [
      [0.05, 0.0],
      [0.2, 0.0],
      [0.35, 0.01],
      [0.5, 0.05],
      [0.65, 0.18],
      [0.78, 0.45],
      [0.88, 0.75],
      [0.95, 0.98],
    ],
    downPath: [
      [0.95, 0.98],
      [0.88, 0.95],
      [0.78, 0.85],
      [0.65, 0.65],
      [0.52, 0.42],
      [0.38, 0.22],
      [0.25, 0.08],
      [0.1, 0.0],
    ],
    mechanism:
      "Alle Connections belegt. Threads blockieren auf getConnection() bis connectionTimeout (Default 30s).",
    whyStick:
      "Drain-Time = Backlog / (Kapazität − Ankunftsrate). Connections durch Timeouts beschädigt, müssen neu aufgebaut werden.",
    recovery:
      "connectionTimeout auf 10s (Fail-Fast). leakDetectionThreshold=60000. hikaricp_connections_pending monitoren.",
    severity: "kritisch",
    metrics: "hikaricp_connections_pending, hikaricp_connections_timeout_total",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: Pool = max · Reset: Connection frei (Timeout 30 s)",
  },
  {
    id: "circuit-breaker",
    name: "Circuit-Breaker-Recovery",
    icon: "\uD83D\uDEE1\uFE0F",
    category: "app",
    color: C.value.cyan,
    x: "Provider Error Rate",
    y: "Quote Completeness",
    upPath: [
      [0.05, 0.96],
      [0.15, 0.9],
      [0.3, 0.78],
      [0.5, 0.58],
      [0.7, 0.35],
      [0.85, 0.18],
      [0.95, 0.05],
    ],
    downPath: [
      [0.95, 0.05],
      [0.85, 0.06],
      [0.7, 0.1],
      [0.5, 0.18],
      [0.3, 0.35],
      [0.15, 0.58],
      [0.05, 0.78],
    ],
    mechanism:
      "Circuit Breaker trippt bei Fehlerrate. Provider erholt sich, aber Breaker ist OPEN: keine Requests.",
    whyStick:
      "Half-Open lässt nur 1–3 Probe-Requests durch. Slow Recovery by Design (Resilience4j waitDurationInOpenState).",
    recovery:
      "waitDurationInOpenState tunen. permittedNumberOfCallsInHalfOpenState erhöhen. Fallback mit Stale-Daten.",
    severity: "hoch",
    metrics: "resilience4j_circuitbreaker_state, provider_quote_success_total",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: Fehlerrate > Schwelle · Reset: Half-Open-Probes ok",
  },
  {
    id: "redis-eviction",
    name: "Redis-Eviction-Kaskade",
    icon: "\uD83D\uDCA8",
    category: "component",
    color: C.value.amber,
    x: "Redis Memory %",
    y: "Upstream API Calls/s",
    upPath: [
      [0.1, 0.05],
      [0.25, 0.06],
      [0.4, 0.08],
      [0.55, 0.12],
      [0.7, 0.25],
      [0.82, 0.5],
      [0.92, 0.8],
      [0.98, 0.95],
    ],
    downPath: [
      [0.98, 0.95],
      [0.9, 0.88],
      [0.78, 0.72],
      [0.62, 0.55],
      [0.48, 0.4],
      [0.35, 0.28],
      [0.22, 0.15],
      [0.1, 0.08],
    ],
    mechanism:
      "Redis erreicht maxmemory, Eviction-Policy verdrängt Keys. Hit-Ratio sinkt, mehr Requests an Upstream-APIs.",
    whyStick:
      "Evicted Keys müssen alle neu geladen werden. Upstream-Last bleibt hoch bis Cache warm. Kann Rate-Limiting triggern.",
    recovery:
      "maxmemory erhöhen oder Redis-Cluster skalieren. TTL-Strategie reviewen. Separate Key-Namespaces pro Produktsparte.",
    severity: "hoch",
    metrics:
      "redis_evicted_keys_total, redis_memory_used_bytes, redis_keyspace_hits_total",
    brakeForm: "super-linear",
    memory: "zustandsbehaftet",
    setReset: "Set: maxmemory erreicht · Reset: Cache warm",
  },
  {
    id: "tomcat-thread-saturation",
    name: "Tomcat Thread-Saturation",
    icon: "\uD83E\uDDF5",
    category: "app",
    color: C.value.pink,
    x: "Request Rate",
    y: "HTTP 503 Rate",
    upPath: [
      [0.05, 0.0],
      [0.25, 0.0],
      [0.45, 0.0],
      [0.6, 0.02],
      [0.72, 0.1],
      [0.82, 0.35],
      [0.9, 0.65],
      [0.95, 0.95],
    ],
    downPath: [
      [0.95, 0.95],
      [0.9, 0.85],
      [0.82, 0.62],
      [0.72, 0.38],
      [0.6, 0.18],
      [0.48, 0.06],
      [0.3, 0.01],
      [0.1, 0.0],
    ],
    mechanism:
      "200 Threads busy + Accept-Queue (100) voll = Connection Refused. Oft Folgeproblem: langsame Upstream-Calls.",
    whyStick:
      "Accept-Queue muss erst leerlaufen. Blockierte Threads halten Connections offen.",
    recovery:
      "Root Cause finden (DB-Pool? Upstream-Timeout?). Timeouts verkürzen (<5s). Virtual Threads evaluieren.",
    severity: "kritisch",
    metrics: "tomcat_threads_busy_threads, tomcat_threads_config_max_threads",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: Threads + Accept-Queue voll · Reset: Queue leer",
  },
  {
    id: "cfs-throttling",
    name: "CPU-Throttling (CFS)",
    icon: "\uD83D\uDD25",
    category: "infra",
    color: C.value.red,
    x: "CPU Usage / Limit",
    y: "Throttled Periods %",
    upPath: [
      [0.1, 0.0],
      [0.3, 0.0],
      [0.5, 0.02],
      [0.65, 0.08],
      [0.75, 0.22],
      [0.85, 0.5],
      [0.92, 0.78],
      [0.98, 0.95],
    ],
    downPath: [
      [0.98, 0.95],
      [0.92, 0.88],
      [0.85, 0.72],
      [0.75, 0.48],
      [0.65, 0.28],
      [0.55, 0.15],
      [0.4, 0.05],
      [0.2, 0.01],
    ],
    mechanism:
      "Container verbraucht CPU-Quota in der 100ms CFS-Periode. Wird pausiert bis zur nächsten Periode.",
    whyStick:
      "Throttling erzeugt Request-Backlog. Backlog erhöht CPU-Bedarf. Erst wenn Backlog leer UND Last unter Quota.",
    recovery:
      "CPU-Limit erhöhen. Burstable QoS (kein Limit, nur Request). GC-Tuning: -XX:MaxGCPauseMillis=100.",
    severity: "hoch",
    metrics:
      "container_cpu_cfs_throttled_periods_total, container_cpu_cfs_periods_total",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset:
      "Set: Quota/Periode erschöpft · Reset: Backlog leer + Last < Quota",
  },
  {
    id: "oom-restart",
    name: "OOMKill-Restart-Cycle",
    icon: "\uD83D\uDC80",
    category: "infra",
    color: C.value.red,
    x: "Memory / Limit %",
    y: "Pod Restarts / h",
    upPath: [
      [0.3, 0.0],
      [0.45, 0.0],
      [0.6, 0.0],
      [0.72, 0.0],
      [0.8, 0.05],
      [0.88, 0.3],
      [0.94, 0.65],
      [0.98, 0.95],
    ],
    downPath: [
      [0.98, 0.95],
      [0.92, 0.7],
      [0.84, 0.45],
      [0.75, 0.25],
      [0.65, 0.12],
      [0.55, 0.05],
      [0.42, 0.01],
      [0.3, 0.0],
    ],
    mechanism:
      "Working-Set überschreitet Memory-Limit. OOM-Kill → Pod restartet mit kaltem Cache, kaltem JIT.",
    whyStick:
      "Restart = Cold Start. JIT muss neu kompilieren, Caches leer, Connections müssen aufgebaut werden.",
    recovery:
      "-XX:MaxRAMPercentage=75 (25% für Off-Heap). Memory-Limit = Heap + 30%. HeapDumpOnOutOfMemoryError.",
    severity: "kritisch",
    metrics:
      "container_memory_working_set_bytes, kube_pod_container_status_restarts_total",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: Working-Set > Limit (OOM) · Reset: Cold Start fertig",
  },
  {
    id: "noisy-neighbor-cpu",
    short:
      "Rechenlast von B verdrängt A von der gemeinsamen Node-CPU → Räuber-Beute-Oszillation.",
    name: "Noisy-Neighbor CPU-Kopplung",
    icon: "\u2694\uFE0F",
    category: "infra",
    color: C.value.orange,
    x: "Service B CPU %",
    y: "Service A Throughput",
    upPath: [
      [0.08, 0.92],
      [0.2, 0.9],
      [0.35, 0.82],
      [0.5, 0.65],
      [0.65, 0.42],
      [0.78, 0.2],
      [0.92, 0.08],
    ],
    downPath: [
      [0.92, 0.08],
      [0.82, 0.1],
      [0.68, 0.18],
      [0.52, 0.32],
      [0.38, 0.52],
      [0.22, 0.7],
      [0.08, 0.85],
    ],
    mechanism:
      "A sendet rechenintensive Aufträge an B, beide auf demselben Node. B-Last verdrängt A von der CPU \u2192 R\u00e4uber-Beute-Oszillation.",
    whyStick:
      "Gekoppeltes System: A erholt sich \u2192 flutet B erneut \u2192 n\u00e4chster Zyklus. Ohne Entkopplung oszilliert das System endlos (Lotka-Volterra-Dynamik).",
    recovery:
      "Pod Anti-Affinity (Pods auf verschiedene Nodes). CPU-Requests/Limits korrekt setzen. Rate-Limiting A\u2192B. Dedicated Node-Pools pro Workload-Typ.",
    severity: "hoch",
    metrics:
      "container_cpu_usage_seconds_total per pod, container_cpu_cfs_throttled_periods_total per pod",
    brakeForm: "super-linear",
    memory: "zustandsbehaftet",
    setReset: null,
  },
  {
    id: "node-imbalance",
    name: "Node-Imbalance nach Rescheduling",
    icon: "\u2696\uFE0F",
    category: "k8s",
    color: C.value.blue,
    x: "Cluster Avg CPU %",
    y: "Max Node CPU %",
    upPath: [
      [0.1, 0.12],
      [0.25, 0.28],
      [0.4, 0.48],
      [0.55, 0.65],
      [0.68, 0.78],
      [0.78, 0.88],
      [0.88, 0.95],
    ],
    downPath: [
      [0.88, 0.95],
      [0.78, 0.9],
      [0.68, 0.82],
      [0.55, 0.72],
      [0.42, 0.58],
      [0.3, 0.42],
      [0.18, 0.28],
    ],
    mechanism:
      "Bei Rescheduling (Node-Drain, Preemption) landen Pods ungleichmäßig. Hotspots entstehen.",
    whyStick:
      "Kubernetes rescheduled laufende Pods nicht proaktiv (kein Rebalancing). Descheduler muss explizit konfiguriert werden.",
    recovery:
      "Descheduler mit RemoveDuplicates/LowNodeUtilization. Pod Topology Spread Constraints. Resource Requests korrekt setzen.",
    severity: "mittel",
    metrics:
      "node_cpu_seconds_total per node, kube_pod_info aggregated per node",
    brakeForm: "proportional",
    memory: "zustandsbehaftet",
    setReset: null,
  },
  {
    id: "hpa-oscillation",
    name: "HPA-Oszillation",
    icon: "\uD83C\uDF0A",
    category: "k8s",
    color: C.value.green,
    x: "Request Rate",
    y: "Pod Count",
    upPath: [
      [0.1, 0.1],
      [0.25, 0.12],
      [0.4, 0.15],
      [0.55, 0.25],
      [0.68, 0.45],
      [0.8, 0.7],
      [0.9, 0.88],
      [0.95, 0.95],
    ],
    downPath: [
      [0.95, 0.95],
      [0.9, 0.92],
      [0.82, 0.85],
      [0.7, 0.72],
      [0.55, 0.55],
      [0.4, 0.38],
      [0.25, 0.25],
      [0.12, 0.15],
    ],
    mechanism:
      "HPA skaliert hoch bei Threshold. Neue Pods nehmen Last auf, Metrik sinkt, HPA skaliert runter.",
    whyStick:
      "Cooldown-Period verzögert Scale-Down. Neue Pods starten kalt (JIT, Cache), brauchen mehr Ressourcen.",
    recovery:
      "stabilizationWindowSeconds erhöhen (5–10 min). behavior.scaleDown.policies: max 1 Pod pro 60s.",
    severity: "mittel",
    metrics:
      "kube_horizontalpodautoscaler_status_current_replicas, kube_horizontalpodautoscaler_spec_max_replicas",
    brakeForm: "proportional",
    memory: "zustandsbehaftet",
    setReset: "Set: scale-up-Schwelle · Reset: stabilizationWindow",
  },
  {
    id: "tcp-slowstart",
    name: "TCP Slow-Start nach Timeout",
    icon: "\uD83C\uDF10",
    category: "network",
    color: C.value.cyan,
    x: "Packet Loss Rate",
    y: "Effective Throughput",
    upPath: [
      [0.05, 0.95],
      [0.15, 0.9],
      [0.28, 0.8],
      [0.42, 0.62],
      [0.58, 0.4],
      [0.72, 0.22],
      [0.85, 0.1],
      [0.95, 0.05],
    ],
    downPath: [
      [0.95, 0.05],
      [0.82, 0.08],
      [0.68, 0.15],
      [0.52, 0.3],
      [0.38, 0.48],
      [0.25, 0.62],
      [0.12, 0.78],
      [0.05, 0.88],
    ],
    mechanism:
      "Paketverluste triggern TCP Congestion Control. Window wird auf 1 MSS reduziert. Throughput bricht ein.",
    whyStick:
      "Slow-Start braucht viele RTTs um das Window wieder hochzufahren. Bei hohem BDP: Recovery dauert Sekunden.",
    recovery:
      "TCP BBR statt Cubic. Keep-Alive Connections (HTTP/2, Connection-Pooling). Retransmit-Timeouts tunen.",
    severity: "mittel",
    metrics: "node_netstat_Tcp_RetransSegs, node_netstat_Tcp_OutSegs",
    brakeForm: "binär",
    memory: "zustandsarm",
    setReset:
      "Set: Paketverlust → cwnd = 1 MSS · Reset: Slow-Start über viele RTT",
  },
  {
    id: "dns-staleness",
    name: "DNS/Service-Discovery Staleness",
    icon: "\uD83D\uDD0D",
    category: "network",
    color: C.value.lime,
    x: "Endpoint Changes/min",
    y: "Stale DNS %",
    upPath: [
      [0.05, 0.02],
      [0.2, 0.03],
      [0.35, 0.06],
      [0.5, 0.15],
      [0.65, 0.35],
      [0.8, 0.62],
      [0.92, 0.88],
    ],
    downPath: [
      [0.92, 0.88],
      [0.8, 0.78],
      [0.65, 0.58],
      [0.5, 0.38],
      [0.35, 0.22],
      [0.2, 0.12],
      [0.08, 0.05],
    ],
    mechanism:
      "Rolling Updates ändern Endpoints. DNS-TTL und Client-Caches (JVM: unendlich!) halten stale Einträge.",
    whyStick:
      "JVM cached DNS per Default unendlich. Nach Deployment zeigen Requests auf terminierte Pods → Connection Refused.",
    recovery:
      "JVM: -Dnetworkaddress.cache.ttl=10. CoreDNS TTL anpassen. Headless Services für client-side LB.",
    severity: "mittel",
    metrics:
      'coredns_dns_requests_total, coredns_dns_responses_total{rcode="NXDOMAIN"}',
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: Endpoint-Wechsel · Reset: DNS-TTL abgelaufen",
  },
  {
    id: "pv-io-saturation",
    name: "PV I/O-Sättigung",
    icon: "\uD83D\uDCBE",
    category: "infra",
    color: C.value.purple,
    x: "IOPS / Provisioned",
    y: "I/O Latenz (ms)",
    upPath: [
      [0.1, 0.03],
      [0.25, 0.04],
      [0.4, 0.06],
      [0.55, 0.12],
      [0.7, 0.28],
      [0.82, 0.55],
      [0.92, 0.82],
      [0.98, 0.95],
    ],
    downPath: [
      [0.98, 0.95],
      [0.9, 0.88],
      [0.78, 0.72],
      [0.65, 0.52],
      [0.5, 0.35],
      [0.38, 0.22],
      [0.25, 0.12],
      [0.12, 0.06],
    ],
    mechanism:
      "Cloud-PVs haben IOPS-Limits. Überschreitung führt zu I/O-Queuing. MySQL/InnoDB Buffer Pool Flush: I/O-Spikes.",
    whyStick:
      "I/O-Queue muss erst abgearbeitet werden. InnoDB-Dirty-Pages aufgestaut, Flush dauert.",
    recovery:
      "PV-Typ upgraden (gp3 mit Provisioned IOPS). InnoDB: innodb_io_capacity tunen.",
    severity: "hoch",
    metrics:
      "node_disk_io_time_seconds_total, node_disk_io_time_weighted_seconds_total",
    brakeForm: "super-linear",
    memory: "zustandsbehaftet",
    setReset: "Set: IOPS > Provisioned · Reset: I/O-Queue abgearbeitet",
  },
  {
    id: "zgc-alloc-stall",
    short:
      "Hält die GC nicht Schritt, stallt der allokierende Thread, bis Speicher frei wird.",
    name: "ZGC Allocation Stall",
    icon: "🛑",
    category: "gc",
    color: C.value.red,
    x: "Heap-Allokationsrate",
    y: "Allocation-Stall (ms)",
    upPath: [
      [0.2, 0.01],
      [0.35, 0.01],
      [0.5, 0.02],
      [0.62, 0.03],
      [0.72, 0.06],
      [0.82, 0.2],
      [0.9, 0.6],
      [0.97, 0.96],
    ],
    downPath: [
      [0.97, 0.96],
      [0.88, 0.95],
      [0.78, 0.92],
      [0.66, 0.86],
      [0.54, 0.7],
      [0.44, 0.4],
      [0.34, 0.14],
      [0.22, 0.04],
    ],
    mechanism:
      "Hält die GC mit der aggregierten Allokationsrate nicht Schritt, blockiert der jeweils allokierende Thread (irgendeiner) in einem Allocation Stall, bis Speicher frei wird — generisch, nicht threadselektiv.",
    whyStick:
      "Reiner Heap-Pegel: solange die Allokation über der Reclaim-Rate liegt, stallen Threads wiederholt. Ein gesundes ZGC stallt praktisch nie — ein Stall heißt, CPU-/Heap-Headroom fehlt.",
    recovery:
      "ConcGCThreads / CPU erhöhen, -Xmx anheben, auf Generational ZGC (JDK 21+) wechseln. Stalls als Alarm behandeln, nicht als Feature.",
    severity: "hoch",
    metrics: "jdk.ZAllocationStall (JFR, ≥JDK15), -Xlog:gc 'Allocation Stall'",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: Kapazität erschöpft · Reset: Speicher frei (sonst OOME)",
  },
  {
    id: "shenandoah-pacing",
    short:
      "Der Pacer drosselt allokierende Threads proaktiv und proportional zur Allokationsmenge.",
    name: "Shenandoah Pacing",
    icon: "🐢",
    category: "gc",
    color: C.value.amber,
    x: "GC-Rückstand",
    y: "Pacing-Delay (≤10 ms)",
    upPath: [
      [0.1, 0.02],
      [0.25, 0.05],
      [0.4, 0.1],
      [0.55, 0.16],
      [0.68, 0.22],
      [0.8, 0.28],
      [0.9, 0.33],
      [0.97, 0.36],
    ],
    downPath: [
      [0.97, 0.36],
      [0.88, 0.34],
      [0.76, 0.3],
      [0.62, 0.24],
      [0.5, 0.18],
      [0.38, 0.12],
      [0.26, 0.07],
      [0.12, 0.03],
    ],
    mechanism:
      "Der Pacer drosselt allokierende Threads proaktiv und proportional zur Allokationsmenge, während der nebenläufige Zyklus läuft — ein Budget-Modell, das den Thread kurz warten lässt, bevor der Heap erschöpft ist.",
    whyStick:
      "Kein langsamer Pegel: das Budget setzt pro Zyklus zurück. Reicht Pacing nicht, eskaliert es: Pacing → Degenerated GC → Full GC.",
    recovery:
      "Heuristik 'compact' für Latenz, mehr CPU/Heap statt ShenandoahPacingMaxDelay hochzusetzen. Pacing nur im GC-Log sichtbar — kein JFR-Event, unsichtbar in Profilern.",
    severity: "mittel",
    metrics: "-Xlog:gc (Pacing-Delays), Häufung von Degenerated/Full GC",
    brakeForm: "proportional",
    memory: "zustandsarm",
    setReset: "gedeckelt ≤10 ms (ShenandoahPacingMaxDelay)",
  },
  {
    id: "innodb-checkpoint",
    short:
      "Mit wachsender Checkpoint Age rampt InnoDB das Flushing über Stufen hoch.",
    name: "InnoDB Redo-Log / Checkpoint",
    icon: "🐬",
    category: "component",
    color: C.value.cyan,
    x: "Checkpoint-Age",
    y: "Flush-Intensität",
    upPath: [
      [0.1, 0.02],
      [0.3, 0.05],
      [0.5, 0.12],
      [0.62, 0.2],
      [0.72, 0.35],
      [0.82, 0.58],
      [0.9, 0.8],
      [0.97, 0.95],
    ],
    downPath: [
      [0.97, 0.95],
      [0.88, 0.9],
      [0.78, 0.78],
      [0.66, 0.62],
      [0.54, 0.45],
      [0.42, 0.3],
      [0.3, 0.16],
      [0.16, 0.06],
    ],
    mechanism:
      "Das Redo-Log ist ein zirkulärer Puffer. Mit wachsender Checkpoint Age rampt InnoDB das Flushing über Stufen hoch — Adaptive-Flushing-LWM → Async-Point (7/8) → Sync-Point (15/16) → Soft-Limit (Voll-Pause).",
    whyStick:
      "Der Akkumulator (Checkpoint Age) füllt über Minuten und leert nur so schnell wie die IO-Kapazität. 'Flush Storms' frieren Schreiboperationen ein, bis die Age unter die Schwelle fällt.",
    recovery:
      "innodb_redo_log_capacity groß genug für Write-Bursts. Innodb_checkpoint_age überwachen; Nähe zum Async-Point = erschöpfte IO-Kapazität.",
    severity: "hoch",
    metrics: "Innodb_checkpoint_age, innodb_redo_log_capacity",
    brakeForm: "proportional",
    memory: "zustandsbehaftet",
    setReset: "Set: Async 7/8 · Sync 15/16 · Reset: < LWM 10%",
  },
  {
    id: "galera-flow-control",
    short:
      "Wächst die Receive-Queue über gcs.fc_limit, broadcastet der Node FC_PAUSE → Cluster stoppt.",
    name: "Galera Flow Control",
    icon: "🚦",
    category: "component",
    color: C.value.purple,
    x: "Receive-Queue",
    y: "FC-Pause-Anteil",
    upPath: [
      [0.15, 0.0],
      [0.35, 0.0],
      [0.55, 0.01],
      [0.68, 0.03],
      [0.78, 0.15],
      [0.86, 0.55],
      [0.93, 0.85],
      [0.98, 0.97],
    ],
    downPath: [
      [0.98, 0.97],
      [0.9, 0.96],
      [0.8, 0.93],
      [0.7, 0.88],
      [0.58, 0.7],
      [0.48, 0.35],
      [0.4, 0.08],
      [0.3, 0.01],
    ],
    mechanism:
      "Wächst die Receive-Queue eines Nodes über gcs.fc_limit, broadcastet er FC_PAUSE und der ganze Cluster stoppt temporär die Replikation neuer Transaktionen — ein einziger langsamer Node drosselt alle.",
    whyStick:
      "Doppelschwelle: gelockert wird erst bei gcs.fc_limit · gcs.fc_factor (< 1). Solange der langsame Node nicht aufholt, bleibt der Cluster pausiert.",
    recovery:
      "Den langsamen Node fixen, nicht die FC-Limits lockern. wsrep_flow_control_paused (>0 verdächtig) und wsrep_flow_control_sent (Täter-Node) beobachten.",
    severity: "hoch",
    metrics:
      "wsrep_flow_control_paused, wsrep_flow_control_sent, wsrep_local_recv_queue",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: recv-queue > fc_limit · Reset: < fc_limit · fc_factor",
  },
  {
    id: "mongodb-flow-control",
    short:
      "Nähert sich der Majority-Lag dem Ziel, brauchen Writes Tickets — drosselt die Schreibrate.",
    name: "MongoDB Flow Control",
    icon: "🍃",
    category: "component",
    color: C.value.green,
    x: "Replication-Lag",
    y: "Ticket-Drosselung",
    upPath: [
      [0.1, 0.03],
      [0.28, 0.06],
      [0.45, 0.12],
      [0.58, 0.22],
      [0.7, 0.38],
      [0.8, 0.58],
      [0.9, 0.8],
      [0.97, 0.94],
    ],
    downPath: [
      [0.97, 0.94],
      [0.87, 0.88],
      [0.75, 0.74],
      [0.62, 0.56],
      [0.5, 0.4],
      [0.38, 0.26],
      [0.26, 0.14],
      [0.13, 0.05],
    ],
    mechanism:
      "Nähert sich der Majority-Committed-Lag dem flowControlTargetLagSeconds (10 s), müssen Writes auf dem Primary erst Tickets erwerben — die Tickets/s begrenzen die Schreibrate, um den Lag unter dem Ziel zu halten.",
    whyStick:
      "Credit-/Ticket-basiert auf dem Primary, gesteuert über die Lag-Einschätzung. In PSA-Topologien drohen unnötiges Throttling oder Stalls bei ausgefallenem Secondary.",
    recovery:
      "Langsames Secondary fixen. flowControl.isLagged und timeAcquiringMicros beobachten. Nicht das Ziel-Lag blind hochsetzen.",
    severity: "mittel",
    metrics: "flowControl.isLagged, flowControl.timeAcquiringMicros",
    brakeForm: "proportional",
    memory: "zustandsbehaftet",
    setReset: "Ziel-Lag 10 s (flowControlTargetLagSeconds)",
  },
  {
    id: "cockroach-admission",
    short:
      "Admission Control sortiert wartende Arbeit nach Priorität und vergibt IO-Tokens dynamisch.",
    name: "CockroachDB Admission Control",
    icon: "🪳",
    category: "component",
    color: C.value.blue,
    x: "L0-Sublevels",
    y: "Admission-Wait",
    upPath: [
      [0.12, 0.03],
      [0.3, 0.07],
      [0.46, 0.14],
      [0.6, 0.26],
      [0.71, 0.42],
      [0.81, 0.62],
      [0.9, 0.82],
      [0.97, 0.95],
    ],
    downPath: [
      [0.97, 0.95],
      [0.88, 0.9],
      [0.76, 0.76],
      [0.64, 0.58],
      [0.52, 0.42],
      [0.4, 0.28],
      [0.27, 0.15],
      [0.14, 0.05],
    ],
    mechanism:
      "Admission Control sortiert wartende Arbeit nach (Tenant, Priorität, Txn-Startzeit) und vergibt IO-Tokens dynamisch aus der LSM-L0-Bandbreite — lock-haltende Transaktionen werden priorisiert.",
    whyStick:
      "Token-Bucket über den L0-Druck: steigt der Sublevel-Count, sinken die Tokens. Designt als Kollaps-Schutz, aber kein Ersatz für einen korrekt dimensionierten Cluster.",
    recovery:
      "L0-Druck / Admission-Wait-Latenz beobachten. Cluster richtig dimensionieren; Client-Verbindungen separat via server.max_connections_per_gateway.",
    severity: "mittel",
    metrics: "admission.wait_durations, storage L0-Sublevels",
    brakeForm: "proportional",
    memory: "zustandsbehaftet",
    setReset: "Token-Bucket ∝ L0-Bandbreite, prio nach Txn-Start",
  },
  {
    id: "rabbitmq-conn-block",
    short:
      "Über dem Memory-Watermark stoppt der Broker das Socket-Lesen → Publisher blockieren (TCP-Back-Pressure).",
    name: "RabbitMQ Connection-Blocking",
    icon: "🐰",
    category: "component",
    color: C.value.orange,
    x: "Broker-Memory %",
    y: "Blocked Publisher",
    upPath: [
      [0.2, 0.0],
      [0.4, 0.0],
      [0.55, 0.01],
      [0.66, 0.03],
      [0.74, 0.12],
      [0.82, 0.5],
      [0.9, 0.85],
      [0.97, 0.98],
    ],
    downPath: [
      [0.97, 0.98],
      [0.9, 0.97],
      [0.82, 0.94],
      [0.72, 0.88],
      [0.6, 0.66],
      [0.5, 0.3],
      [0.42, 0.08],
      [0.32, 0.01],
    ],
    mechanism:
      "Übersteigt die Speichernutzung den vm_memory_high_watermark (~60%) oder fällt der freie Disk-Space unter disk_free_limit, stoppt der Broker das Lesen vom Socket — publizierende Connections blockieren passiv im Socket-Write (TCP-Back-Pressure).",
    whyStick:
      "Pegelgetriggert und binär: der Durchsatz bestimmt nur, wie schnell der RAM-Pegel die Schwelle erreicht, nicht die Stärke der Bremse. Consumer bleiben unblockiert.",
    recovery:
      "BlockedListener registrieren, Publishing über eigene Queue + Thread entkoppeln. Auf blocked/blocking-State überwachen. AMQP 1.0 für selektives Queue-Throttling evaluieren.",
    severity: "kritisch",
    metrics:
      "rabbitmqctl list_connections state (blocked/blocking), memory.used vs watermark",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: mem-watermark ~60% · Reset: Alarm clear",
  },
  {
    id: "rabbitmq-credit-flow",
    short:
      "Ein langsamer Channel verbraucht Credits nicht nach → blockt den Reader → Producer gedrosselt.",
    name: "RabbitMQ credit_flow",
    icon: "🎟️",
    category: "component",
    color: C.value.pink,
    x: "Channel-Durchsatz",
    y: "Reader-Block-Anteil",
    upPath: [
      [0.2, 0.02],
      [0.38, 0.04],
      [0.52, 0.08],
      [0.64, 0.16],
      [0.74, 0.3],
      [0.83, 0.5],
      [0.91, 0.7],
      [0.97, 0.85],
    ],
    downPath: [
      [0.97, 0.85],
      [0.9, 0.72],
      [0.82, 0.54],
      [0.73, 0.36],
      [0.63, 0.22],
      [0.52, 0.12],
      [0.4, 0.06],
      [0.26, 0.03],
    ],
    mechanism:
      "Intern fließen Nachrichten reader → channel → queue → msg_store; jeder Prozess gewährt Credits (200 init, +50 / 50 verarbeitet). Verarbeitet der Channel langsamer, blockt er den Reader → Producer werden gedrosselt.",
    whyStick:
      "Nicht ressourcengetrieben und mit Millisekunden-Gedächtnis: das Credit-Fenster toggelt mehrmals pro Sekunde — nur als Rate beobachtbar, kein Pegel zum Hochrechnen.",
    recovery:
      "Verkettung (queue → channel → reader) entzerren. Interne Flow-Control-Metriken / Channel-Block-Events beobachten.",
    severity: "mittel",
    metrics: "interne credit_flow-Metriken, Channel-Block-Events",
    brakeForm: "binär",
    memory: "zustandsarm",
    setReset: "Credits 200 init, +50 / 50 verarbeitet",
  },
  {
    id: "kafka-buffer-memory",
    short:
      "Ist buffer.memory (32 MB) erschöpft, blockiert send() bis max.block.ms, dann TimeoutException.",
    name: "Kafka Producer buffer.memory",
    icon: "🪣",
    category: "component",
    color: C.value.lime,
    x: "Producer-Buffer %",
    y: "send()-Blockzeit",
    upPath: [
      [0.15, 0.0],
      [0.35, 0.01],
      [0.52, 0.02],
      [0.65, 0.05],
      [0.75, 0.14],
      [0.84, 0.45],
      [0.92, 0.8],
      [0.98, 0.97],
    ],
    downPath: [
      [0.98, 0.97],
      [0.9, 0.93],
      [0.8, 0.85],
      [0.68, 0.66],
      [0.56, 0.42],
      [0.44, 0.22],
      [0.3, 0.08],
      [0.16, 0.01],
    ],
    mechanism:
      "Ist der Producer-Buffer (buffer.memory, Default 32 MB) erschöpft, blockieren weitere send()-Aufrufe bis max.block.ms (Default 60 s), dann TimeoutException.",
    whyStick:
      "Buffer = bounded buffer: der App-Thread blockiert, bis der Sender-Thread Platz schafft. Bei langsamem Broker/Netz bleibt der Buffer voll.",
    recovery:
      "buffer-available-bytes überwachen (→ 0 = Sättigung). linger.ms / batch.size tunen, Partitionen/Broker skalieren, Backpressure an die Quelle weiterreichen.",
    severity: "hoch",
    metrics:
      "kafka producer buffer-available-bytes, record-queue-time, buffer-exhausted-rate",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: buffer.memory voll · max.block.ms 60 s",
  },
  {
    id: "cgroup-memory-high",
    short:
      "memory.high ist weich: über der Grenze drosselt der Kernel per Reclaim-Verzögerung (kein OOM-Kill).",
    name: "cgroup-v2 memory.high",
    icon: "🐧",
    category: "infra",
    color: C.value.yellow,
    x: "Memory über memory.high",
    y: "Reclaim-Drosselung",
    upPath: [
      [0.1, 0.02],
      [0.28, 0.06],
      [0.44, 0.14],
      [0.58, 0.26],
      [0.7, 0.42],
      [0.8, 0.6],
      [0.9, 0.8],
      [0.97, 0.94],
    ],
    downPath: [
      [0.97, 0.94],
      [0.87, 0.87],
      [0.75, 0.72],
      [0.62, 0.54],
      [0.5, 0.38],
      [0.38, 0.24],
      [0.26, 0.13],
      [0.13, 0.05],
    ],
    mechanism:
      "cgroup-v2 memory.high ist eine weiche Grenze: übersteigt eine Control-Group sie, drosselt der Kernel die Prozesse durch Reclaim-Verzögerung, die mit dem Druck steigt (kein OOM-Kill wie bei memory.max).",
    whyStick:
      "Pegelgetrieben und proportional: solange die Allokation über der Reclaim-Rate liegt, akkumuliert der Speicherdruck und die Verzögerung wächst.",
    recovery:
      "memory.high korrekt dimensionieren, PSI (memory.pressure) überwachen, Allokationsrate senken. memory.max als harter Backstop.",
    severity: "mittel",
    metrics: "memory.pressure (PSI), memory.current vs memory.high",
    brakeForm: "proportional",
    memory: "zustandsbehaftet",
    setReset: "Reclaim-Delay ∝ Druck über memory.high",
  },
  {
    id: "dirty-writeback",
    short:
      "Ab dirty_ratio drosselt der Kernel schreibende Prozesse synchron, bis genug zurückgeschrieben ist.",
    name: "Linux Dirty-Page Writeback",
    icon: "💽",
    category: "infra",
    color: C.value.purple,
    x: "Dirty Pages %",
    y: "Writer-Throttle",
    upPath: [
      [0.15, 0.0],
      [0.35, 0.01],
      [0.5, 0.04],
      [0.6, 0.1],
      [0.7, 0.22],
      [0.8, 0.5],
      [0.9, 0.82],
      [0.97, 0.96],
    ],
    downPath: [
      [0.97, 0.96],
      [0.89, 0.92],
      [0.79, 0.82],
      [0.68, 0.64],
      [0.57, 0.42],
      [0.46, 0.22],
      [0.34, 0.08],
      [0.2, 0.02],
    ],
    mechanism:
      "Linux startet Background-Writeback ab dirty_background_ratio; überschreiten die Dirty Pages dirty_ratio, werden schreibende Prozesse synchron gedrosselt, bis genug zurückgeschrieben ist.",
    whyStick:
      "Doppelschwelle (dirty_background_ratio < dirty_ratio) erzeugt ein Hystereseband. Bei langsamem Storage stauen sich Dirty Pages und der Throttle bleibt aktiv.",
    recovery:
      "dirty_ratio / dirty_background_ratio an die Storage-Geschwindigkeit anpassen, schnelleres Storage, fsync-Verhalten der App prüfen.",
    severity: "mittel",
    metrics: "node_vmstat_nr_dirty, dirty_ratio / dirty_background_ratio",
    brakeForm: "binär",
    memory: "zustandsbehaftet",
    setReset: "Set: dirty_ratio · Reset: < dirty_background_ratio",
  },
]);

const filter = ref("all");
const expanded = ref(null);
const progress = ref(0);
const playing = ref(true);
let animId = null;

function animate() {
  progress.value += 0.004;
  if (progress.value > 1) progress.value = 0;
  animId = requestAnimationFrame(animate);
}

onMounted(() => {
  animId = requestAnimationFrame(animate);
});
onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId);
});

function togglePlay() {
  playing.value = !playing.value;
  if (playing.value) {
    animId = requestAnimationFrame(animate);
  } else {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
  }
}

const filtered = computed(() =>
  filter.value === "all"
    ? HYSTERESES.value
    : HYSTERESES.value.filter((h) => h.category === filter.value),
);

function catCount(id) {
  return HYSTERESES.value.filter((h) => h.category === id).length;
}
function sevColor(sev) {
  return sev === "kritisch"
    ? C.value.red
    : sev === "hoch"
      ? C.value.orange
      : C.value.yellow;
}
function catColor(cat) {
  return CATEGORIES.value.find((c) => c.id === cat)?.color || C.value.muted;
}
function catLabel(cat) {
  return CATEGORIES.value.find((c) => c.id === cat)?.label || cat;
}
function brakeColor(form) {
  return form === "binär"
    ? C.value.red
    : form === "proportional"
      ? C.value.amber
      : C.value.purple;
}

function toggle(id) {
  expanded.value = expanded.value === id ? null : id;
}

// SVG helpers
const SVG_W = 160,
  SVG_H = 120;
const pad = { t: 8, r: 8, b: 10, l: 14 };
const cw = SVG_W - pad.l - pad.r;
const ch = SVG_H - pad.t - pad.b;

function toX(v) {
  return pad.l + v * cw;
}
function toY(v) {
  return pad.t + ch - v * ch;
}
function mkPath(pts) {
  return pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`,
    )
    .join(" ");
}

function areaPath(h) {
  const up = buildPath(h.upPath);
  const down = buildPath(h.downPath);
  // downPath already goes from end back to start, no need to reverse
  return (
    mkPath(up) +
    " " +
    down
      .map((p) => `L${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`)
      .join(" ") +
    " Z"
  );
}

function upPathD(h) {
  return mkPath(buildPath(h.upPath));
}
function downPathD(h) {
  return mkPath(buildPath(h.downPath));
}

function drawnUpPath(h) {
  const up = buildPath(h.upPath);
  const total = up.length + buildPath(h.downPath).length;
  const drawn = Math.max(1, Math.floor(progress.value * total));
  const upDrawn = Math.min(drawn, up.length);
  return upDrawn > 1 ? mkPath(up.slice(0, upDrawn)) : "";
}

function drawnDownPath(h) {
  const up = buildPath(h.upPath);
  const down = buildPath(h.downPath);
  const total = up.length + down.length;
  const drawn = Math.max(1, Math.floor(progress.value * total));
  const downDrawn = Math.max(0, drawn - up.length);
  return downDrawn > 1 ? mkPath(down.slice(0, downDrawn)) : "";
}

function showUpArrow(h) {
  const up = buildPath(h.upPath);
  const total = up.length + buildPath(h.downPath).length;
  const drawn = Math.max(1, Math.floor(progress.value * total));
  return Math.min(drawn, up.length) > up.length / 2;
}

function showDownArrow(h) {
  const up = buildPath(h.upPath);
  const down = buildPath(h.downPath);
  const total = up.length + down.length;
  const drawn = Math.max(1, Math.floor(progress.value * total));
  return Math.max(0, drawn - up.length) > down.length / 2;
}

function pathDirection(pathPts) {
  const pts = buildPath(pathPts);
  const mid = Math.floor(pts.length / 2);
  const before = pts[Math.max(0, mid - 3)];
  const after = pts[Math.min(pts.length - 1, mid + 3)];
  const dx = after.x - before.x;
  const dy = after.y - before.y; // positive = up in data space
  if (dx >= 0 && dy >= 0) return "↗";
  if (dx >= 0 && dy < 0) return "↘";
  if (dx < 0 && dy >= 0) return "↖";
  return "↙";
}

function arrowOffset(arrow) {
  const offsets = {
    "↗": [6, -6],
    "↘": [6, 10],
    "↖": [-10, -6],
    "↙": [-10, 10],
  };
  return offsets[arrow] || [0, 0];
}

function upArrowPos(h) {
  const up = buildPath(h.upPath);
  const mid = up[Math.floor(up.length / 2)];
  const arrow = pathDirection(h.upPath);
  const [dx, dy] = arrowOffset(arrow);
  return { x: toX(mid.x) + dx, y: toY(mid.y) + dy };
}

function upArrowChar(h) {
  return pathDirection(h.upPath);
}

function downArrowPos(h) {
  const down = buildPath(h.downPath);
  const mid = down[Math.floor(down.length / 2)];
  const arrow = pathDirection(h.downPath);
  const [dx, dy] = arrowOffset(arrow);
  return { x: toX(mid.x) + dx, y: toY(mid.y) + dy };
}

function downArrowChar(h) {
  return pathDirection(h.downPath);
}

function dotPos(h) {
  const up = buildPath(h.upPath);
  const down = buildPath(h.downPath);
  const allPts = [...up, ...down];
  const total = allPts.length;
  const drawn = Math.max(1, Math.floor(progress.value * total));
  const cur = allPts[Math.min(drawn - 1, total - 1)];
  return { x: toX(cur.x), y: toY(cur.y), isDown: drawn > up.length };
}

function startDot(h) {
  const up = buildPath(h.upPath);
  return { x: toX(up[0].x), y: toY(up[0].y) };
}
</script>

<template>
  <div
    class="hysterese-catalog"
    :style="{
      '--c-bg': C.bg,
      '--c-surface': C.surface,
      '--c-surfaceAlt': C.surfaceAlt,
      '--c-border': C.border,
      '--c-text': C.text,
      '--c-muted': C.muted,
      '--c-dim': C.dim,
      '--c-blue': C.blue,
      '--c-green': C.green,
      '--c-yellow': C.yellow,
      '--c-orange': C.orange,
      '--c-red': C.red,
    }"
  >
    <!-- Controls -->
    <div class="controls">
      <div class="filter-buttons">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.id"
          :class="{ active: filter === cat.id }"
          :style="{
            borderColor: filter === cat.id ? cat.color : C.border,
            background: filter === cat.id ? cat.color + '12' : 'transparent',
            color: filter === cat.id ? cat.color : C.muted,
          }"
          @click="filter = cat.id"
        >
          {{ cat.label }}
          <span v-if="cat.id !== 'all'" class="cat-count"
            >({{ catCount(cat.id) }})</span
          >
        </button>
      </div>
      <button class="play-btn" @click="togglePlay">
        {{ playing ? "\u23F8 Pause" : "\u25B6 Play" }}
      </button>
    </div>

    <!-- Legend -->
    <div class="legend">
      <div class="legend-item">
        <div class="legend-line" :style="{ background: C.red }" />
        <span>Last steigt</span>
      </div>
      <div class="legend-item">
        <div class="legend-line" :style="{ background: C.blue }" />
        <span>Last sinkt</span>
      </div>
      <div class="legend-item">
        <div
          class="legend-box"
          :style="{ background: C.yellow + '10', borderColor: C.yellow + '20' }"
        />
        <span>Fläche = Recovery-Verlust</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" :style="{ background: C.green }" />
        <span>Startpunkt</span>
      </div>
    </div>

    <!-- Cards -->
    <div class="cards">
      <div
        v-for="h in filtered"
        :key="h.id"
        class="card"
        :style="{ borderColor: expanded === h.id ? h.color + '50' : C.border }"
      >
        <button class="card-header" @click="toggle(h.id)">
          <!-- Phase space mini -->
          <div class="phase-space">
            <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`">
              <path :d="areaPath(h)" :fill="h.color" opacity="0.06" />
              <path
                :d="upPathD(h)"
                fill="none"
                :stroke="C.red"
                stroke-width="1"
                opacity="0.15"
                stroke-dasharray="2,2"
              />
              <path
                :d="downPathD(h)"
                fill="none"
                :stroke="C.blue"
                stroke-width="1"
                opacity="0.15"
                stroke-dasharray="2,2"
              />
              <line
                :x1="pad.l"
                :y1="pad.t + ch"
                :x2="pad.l + cw"
                :y2="pad.t + ch"
                :stroke="C.dim"
                stroke-width="0.5"
              />
              <line
                :x1="pad.l"
                :y1="pad.t"
                :x2="pad.l"
                :y2="pad.t + ch"
                :stroke="C.dim"
                stroke-width="0.5"
              />
              <path
                v-if="drawnUpPath(h)"
                :d="drawnUpPath(h)"
                fill="none"
                :stroke="C.red"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                v-if="drawnDownPath(h)"
                :d="drawnDownPath(h)"
                fill="none"
                :stroke="C.blue"
                stroke-width="2"
                stroke-linecap="round"
              />
              <text
                v-if="showUpArrow(h)"
                :x="upArrowPos(h).x"
                :y="upArrowPos(h).y"
                style="font-size: 9px"
                :fill="C.red"
              >
                {{ upArrowChar(h) }}
              </text>
              <text
                v-if="showDownArrow(h)"
                :x="downArrowPos(h).x"
                :y="downArrowPos(h).y"
                style="font-size: 9px"
                :fill="C.blue"
              >
                {{ downArrowChar(h) }}
              </text>
              <circle
                :cx="dotPos(h).x"
                :cy="dotPos(h).y"
                r="3.5"
                :fill="C.bg"
                :stroke="dotPos(h).isDown ? C.blue : C.red"
                stroke-width="2"
              />
              <circle
                :cx="startDot(h).x"
                :cy="startDot(h).y"
                r="2"
                :fill="C.green"
              />
              <text
                :x="pad.l + cw / 2"
                :y="SVG_H - 1"
                text-anchor="middle"
                style="font-size: 3.8px"
                :fill="C.dim"
              >
                {{ h.x }}
              </text>
              <text
                :x="4"
                :y="pad.t + ch / 2"
                text-anchor="middle"
                dominant-baseline="central"
                style="font-size: 3.8px"
                :fill="C.dim"
                :transform="`rotate(-90,4,${pad.t + ch / 2})`"
              >
                {{ h.y }}
              </text>
            </svg>
          </div>
          <!-- Text -->
          <div class="card-text">
            <div class="card-title-row">
              <span class="card-icon">{{ h.icon }}</span>
              <span class="card-name">{{ h.name }}</span>
              <span
                class="severity-badge"
                :style="{
                  background: sevColor(h.severity) + '15',
                  color: sevColor(h.severity),
                  borderColor: sevColor(h.severity) + '30',
                }"
                >{{ h.severity.toUpperCase() }}</span
              >
              <span
                class="category-badge"
                :style="{
                  background: catColor(h.category) + '12',
                  color: catColor(h.category),
                }"
                >{{ catLabel(h.category) }}</span
              >
            </div>
            <div class="card-mechanism">{{ h.short || h.mechanism }}</div>
          </div>
          <!-- Expand -->
          <span class="expand-arrow" :class="{ rotated: expanded === h.id }"
            >▾</span
          >
        </button>

        <!-- Expanded -->
        <div v-if="expanded === h.id" class="card-detail">
          <div v-if="h.memory || h.brakeForm" class="regelkreis-row">
            <span
              v-if="h.memory"
              class="rk-chip"
              :style="{
                background: C.blue + '15',
                color: C.blue,
                borderColor: C.blue + '30',
              }"
              >Gedächtnis · {{ h.memory }}</span
            >
            <span
              v-if="h.brakeForm"
              class="rk-chip"
              :style="{
                background: brakeColor(h.brakeForm) + '15',
                color: brakeColor(h.brakeForm),
                borderColor: brakeColor(h.brakeForm) + '30',
              }"
              >Bremse · {{ h.brakeForm }}</span
            >
            <span v-if="h.setReset" class="rk-setreset">{{ h.setReset }}</span>
          </div>
          <div class="detail-box mechanism-box">
            <div class="detail-label" :style="{ color: h.color }">
              MECHANISMUS
            </div>
            <div class="detail-text">{{ h.mechanism }}</div>
          </div>
          <div class="detail-grid">
            <div class="detail-box why-box">
              <div class="detail-label" :style="{ color: C.red }">
                WARUM KLEBT ES?
              </div>
              <div class="detail-text">{{ h.whyStick }}</div>
            </div>
            <div class="detail-box recovery-box">
              <div class="detail-label" :style="{ color: C.green }">
                RECOVERY
              </div>
              <div class="detail-text">{{ h.recovery }}</div>
            </div>
            <div class="detail-box axes-box">
              <div class="axes-label">ACHSEN</div>
              <div class="axes-text">X = {{ h.x }}<br />Y = {{ h.y }}</div>
            </div>
            <div class="detail-box metrics-box">
              <div class="metrics-label">METRIKEN</div>
              <div class="metrics-text">{{ h.metrics }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-title">Severity-Verteilung</div>
      <div class="summary-counts">
        <div
          v-for="sev in ['kritisch', 'hoch', 'mittel']"
          :key="sev"
          class="summary-item"
        >
          <span class="summary-number" :style="{ color: sevColor(sev) }">{{
            HYSTERESES.filter((h) => h.severity === sev).length
          }}</span>
          <span class="summary-label">{{ sev }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hysterese-catalog {
  font-family: inherit;
  color: var(--c-text);
  line-height: 1.4;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-buttons button {
  padding: 3px 10px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s ease;
  outline: none;
  font-family: inherit;
}

.cat-count {
  opacity: 0.5;
}

.play-btn {
  padding: 3px 12px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: var(--c-muted);
  outline: none;
  font-family: inherit;
}

.legend {
  display: flex;
  gap: 14px;
  margin-bottom: 6px;
  font-size: 10px;
  color: var(--c-dim);
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-line {
  width: 14px;
  height: 2px;
  border-radius: 1px;
}

.legend-box {
  width: 11px;
  height: 11px;
  border: 1px solid;
  border-radius: 2px;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 330px;
  overflow-y: auto;
}

.cards::-webkit-scrollbar {
  width: 4px;
}
.cards::-webkit-scrollbar-thumb {
  background: var(--c-border);
  border-radius: 2px;
}

.card {
  background: var(--c-surface);
  border: 1px solid;
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.2s ease;
  flex-shrink: 0;
}

.card-header {
  width: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 10px;
  text-align: left;
  outline: none;
  display: flex;
  gap: 8px;
  align-items: center;
  font-family: inherit;
  color: inherit;
}

.phase-space {
  flex-shrink: 0;
  width: 56px;
}

.phase-space svg {
  width: 100%;
  height: auto;
}

.card-text {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 1px;
  flex-wrap: wrap;
}

.card-icon {
  font-size: 13px;
}
.card-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text);
}

.severity-badge,
.category-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 0px 5px;
  border-radius: 3px;
  border: 1px solid;
  font-family: var(--slidev-code-font-family);
}

.card-mechanism {
  font-size: 10px;
  color: var(--c-muted);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expand-arrow {
  color: var(--c-dim);
  font-size: 12px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.expand-arrow.rotated {
  transform: rotate(180deg);
}

.card-detail {
  padding: 0 10px 8px;
}

.regelkreis-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
}

.rk-chip {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid;
  font-family: var(--slidev-code-font-family);
}

.rk-setreset {
  font-size: 9px;
  color: var(--c-muted);
  font-family: var(--slidev-code-font-family);
}

.mechanism-box {
  background: var(--c-surfaceAlt);
  border-color: var(--c-border);
  margin-bottom: 6px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.detail-box {
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid;
}

.why-box {
  background: rgba(239, 68, 68, 0.04);
  border-color: rgba(239, 68, 68, 0.1);
}

.recovery-box {
  background: rgba(34, 197, 94, 0.04);
  border-color: rgba(34, 197, 94, 0.1);
}

.axes-box {
  background: var(--c-surfaceAlt);
  border-color: var(--c-border);
}

.metrics-box {
  background: var(--c-surfaceAlt);
  border-color: var(--c-border);
}

.detail-label {
  font-size: 9px;
  font-weight: 700;
  margin-bottom: 2px;
  font-family: var(--slidev-code-font-family);
}

.detail-text {
  font-size: 10px;
  color: var(--c-muted);
  line-height: 1.4;
}

.axes-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--c-muted);
  margin-bottom: 2px;
  font-family: var(--slidev-code-font-family);
}

.axes-text {
  font-size: 10px;
  color: var(--c-text);
  line-height: 1.4;
  font-family: var(--slidev-code-font-family);
}

.metrics-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--c-blue);
  margin-bottom: 2px;
  font-family: var(--slidev-code-font-family);
}

.metrics-text {
  font-size: 10px;
  color: var(--c-muted);
  font-family: var(--slidev-code-font-family);
}

.summary {
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--c-surface);
  border-radius: 6px;
  border: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-title {
  font-size: 11px;
  font-weight: 700;
}

.summary-counts {
  display: flex;
  gap: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.summary-number {
  font-size: 16px;
  font-weight: 800;
  font-family: var(--slidev-code-font-family);
}

.summary-label {
  font-size: 10px;
  color: var(--c-muted);
}
</style>
