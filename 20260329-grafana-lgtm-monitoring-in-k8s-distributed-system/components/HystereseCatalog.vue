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
    muted: "#64748b",
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
  { id: "infra", label: "Infrastruktur", color: C.value.purple },
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
  },
  {
    id: "gc-death-spiral",
    name: "JVM GC Death Spiral",
    icon: "\uD83D\uDD04",
    category: "app",
    color: C.value.red,
    x: "CPU-Auslastung",
    y: "GC Pause (ms)",
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
      "Memory-Pressure löst häufigere GC-Zyklen aus. GC verbraucht CPU, verlangsamt Request-Verarbeitung, Objekte akkumulieren.",
    whyStick:
      "Heap-Fragmentierung persistiert. Full-GC-Zyklen bleiben häufig bis Compaction abgeschlossen. Stop-the-World kompoundiert mit CFS-Throttling.",
    recovery:
      "Oft nur Pod-Restart (Heap-Reset). -XX:+UseG1GC mit -XX:MaxGCPauseMillis. -XX:MaxRAMPercentage=75.",
    severity: "kritisch",
    metrics: 'jvm_gc_pause_seconds_sum, jvm_memory_used_bytes{area="heap"}',
  },
  {
    id: "heap-fragmentation",
    name: "Heap-Fragmentierung",
    icon: "\uD83E\uDDE9",
    category: "app",
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
  },
  {
    id: "redis-eviction",
    name: "Redis-Eviction-Kaskade",
    icon: "\uD83D\uDCA8",
    category: "app",
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
  },
  {
    id: "noisy-neighbor-cpu",
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
                font-size="9"
                :fill="C.red"
              >
                {{ upArrowChar(h) }}
              </text>
              <text
                v-if="showDownArrow(h)"
                :x="downArrowPos(h).x"
                :y="downArrowPos(h).y"
                font-size="9"
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
                font-size="3.8"
                :fill="C.dim"
              >
                {{ h.x }}
              </text>
              <text
                :x="4"
                :y="pad.t + ch / 2"
                text-anchor="middle"
                dominant-baseline="central"
                font-size="3.8"
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
                >{{ h.category }}</span
              >
            </div>
            <div class="card-mechanism">{{ h.mechanism }}</div>
          </div>
          <!-- Expand -->
          <span class="expand-arrow" :class="{ rotated: expanded === h.id }"
            >▾</span
          >
        </button>

        <!-- Expanded -->
        <div v-if="expanded === h.id" class="card-detail">
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
  font-family: "DM Sans", "Segoe UI", system-ui, sans-serif;
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
  font-family: "JetBrains Mono", monospace;
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
  font-family: "JetBrains Mono", monospace;
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
  font-family: "JetBrains Mono", monospace;
}

.axes-text {
  font-size: 10px;
  color: var(--c-text);
  line-height: 1.4;
  font-family: "JetBrains Mono", monospace;
}

.metrics-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--c-blue);
  margin-bottom: 2px;
  font-family: "JetBrains Mono", monospace;
}

.metrics-text {
  font-size: 10px;
  color: var(--c-muted);
  font-family: "JetBrains Mono", monospace;
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
  font-family: "JetBrains Mono", monospace;
}

.summary-label {
  font-size: 10px;
  color: var(--c-muted);
}
</style>
