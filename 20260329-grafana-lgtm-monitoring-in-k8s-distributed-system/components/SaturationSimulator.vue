<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDarkMode } from '@slidev/client'
import GaugeRing from './GaugeRing.vue'

// --- Color constants ---
const { isDark } = useDarkMode()

const C = computed(() => isDark.value ? {
  bg: '#0a0d12',
  surface: '#111621',
  surfaceAlt: '#161c2a',
  border: '#1e2536',
  borderHi: '#2a3350',
  text: '#e2e8f0',
  muted: '#64748b',
  dim: '#3e4a63',
  blue: '#3b82f6',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.12)',
  yellow: '#eab308',
  yellowDim: 'rgba(234,179,8,0.12)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.12)',
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.12)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.12)',
  cyan: '#06b6d4',
  cyanDim: 'rgba(6,182,212,0.12)',
  codeBg: '#0d1117',
  codeText: '#79c0ff',
} : {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#e2e8f0',
  borderHi: '#cbd5e1',
  text: '#1e293b',
  muted: '#64748b',
  dim: '#94a3b8',
  blue: '#2563eb',
  green: '#16a34a',
  greenDim: 'rgba(22,163,74,0.08)',
  yellow: '#ca8a04',
  yellowDim: 'rgba(202,138,4,0.08)',
  orange: '#ea580c',
  orangeDim: 'rgba(234,88,12,0.08)',
  red: '#dc2626',
  redDim: 'rgba(220,38,38,0.08)',
  purple: '#9333ea',
  purpleDim: 'rgba(147,51,234,0.08)',
  cyan: '#0891b2',
  cyanDim: 'rgba(8,145,178,0.08)',
  codeBg: '#f1f5f9',
  codeText: '#1e40af',
})

function severityColor(s) {
  return s === 'critical' ? C.value.red : s === 'warning' ? C.value.orange : s === 'degraded' ? C.value.yellow : C.value.green
}
function severityBg(s) {
  return s === 'critical' ? C.value.redDim : s === 'warning' ? C.value.orangeDim : s === 'degraded' ? C.value.yellowDim : C.value.greenDim
}
function severityLabel(s) {
  return s === 'critical' ? 'CRITICAL' : s === 'warning' ? 'WARNING' : s === 'degraded' ? 'DEGRADED' : 'HEALTHY'
}
function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// --- Data ---
const SCENARIOS = [
  {
    id: 'cpu-throttle', name: 'CPU-Throttling', icon: '\u{1F525}',
    subtitle: 'CFS Quota ersch\u00f6pft \u2192 JVM-GC-Verst\u00e4rkung', category: 'compute',
    description: 'Container verbraucht sein CPU-Quota innerhalb der 100ms-CFS-Periode. Kubernetes pausiert den Container bis zur n\u00e4chsten Periode. Bei JVM-Anwendungen kompoundiert das mit Stop-the-World-GC-Pausen: eine 20ms-GC-Pause kann durch CFS-Throttling auf 120ms+ anschwellen.',
    trigger: 'Hohe Parallelit\u00e4t bei Quote-Aggregation: 10+ Provider-Calls gleichzeitig, JSON-Parsing, Objektallokation \u2192 GC-Druck + CPU-Spike',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: 'Throttling <5%, P99 stabil bei 180ms' },
      { t: 0.25, severity: 'degraded', label: 'Erste Anzeichen', desc: 'Throttling steigt auf 15%, P99 springt auf 350ms' },
      { t: 0.5, severity: 'warning', label: 'Sp\u00fcrbar', desc: 'Throttling bei 35%, GC-Pausen h\u00e4ufen sich, P99 bei 800ms' },
      { t: 0.75, severity: 'critical', label: 'Kritisch', desc: 'Throttling >50%, P99 >2s, erste Timeouts, Liveness-Probe-Failures' },
    ],
    metrics: [
      { name: 'CFS Throttled %', unit: '%', healthy: 3, degraded: 15, warning: 35, critical: 62, thresholdWarn: 25, thresholdCrit: 50 },
      { name: 'P99 Latenz', unit: 'ms', healthy: 180, degraded: 350, warning: 800, critical: 2400, thresholdWarn: 500, thresholdCrit: 2000 },
      { name: 'GC Pause avg', unit: 'ms', healthy: 12, degraded: 45, warning: 110, critical: 280, thresholdWarn: 50, thresholdCrit: 200 },
      { name: 'CPU Usage / Limit', unit: '%', healthy: 55, degraded: 78, warning: 92, critical: 99, thresholdWarn: 80, thresholdCrit: 95 },
    ],
    promql: [
      { label: 'Throttling %', query: 'sum(rate(container_cpu_cfs_throttled_periods_total[5m])) by (pod)\n  / sum(rate(container_cpu_cfs_periods_total[5m])) by (pod) * 100' },
      { label: 'Throttled Seconds', query: 'rate(container_cpu_cfs_throttled_seconds_total{container!=""}[5m])' },
    ],
    fix: 'CPU-Limit erh\u00f6hen (z.B. 500m \u2192 1000m), oder Request-Parallelit\u00e4t begrenzen. Burstable QoS erw\u00e4gen (kein Limit, nur Request). GC-Tuning: -XX:MaxGCPauseMillis=100.',
    dashboardLevel: 3,
  },
  {
    id: 'hikari-exhaust', name: 'HikariCP-Ersch\u00f6pfung', icon: '\u{1F5C4}\uFE0F',
    subtitle: 'DB-Connection-Pool leer \u2192 Thread-Blockade', category: 'pool',
    description: 'Alle Connections im HikariCP-Pool sind belegt. Neue Requests blockieren auf pool.getConnection() bis connectionTimeout (Default: 30s) abl\u00e4uft \u2192 SQLTransientConnectionException. Blockierte Threads k\u00f6nnen den Tomcat-Thread-Pool mitrei\u00dfen (Kaskadeneffekt).',
    trigger: 'Langsame SQL-Query (fehlender Index auf Datenbank-Join) h\u00e4lt Connections 5x l\u00e4nger als normal \u2192 Pool l\u00e4uft leer',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: 'Pool 40% belegt, keine Pending-Threads, Acquire-Time <1ms' },
      { t: 0.25, severity: 'degraded', label: 'Pool f\u00fcllt sich', desc: 'Pool 75% belegt, Acquire-Time steigt auf 50ms' },
      { t: 0.5, severity: 'warning', label: 'Pending-Threads', desc: 'Pool 95%, 8 Threads warten, Acquire-Time 500ms' },
      { t: 0.75, severity: 'critical', label: 'Timeouts', desc: 'Pool 100%, 25+ Pending, Connection-Timeouts, HTTP 503' },
    ],
    metrics: [
      { name: 'Pool Active / Max', unit: '%', healthy: 40, degraded: 75, warning: 95, critical: 100, thresholdWarn: 80, thresholdCrit: 95 },
      { name: 'Pending Threads', unit: '', healthy: 0, degraded: 2, warning: 8, critical: 27, thresholdWarn: 5, thresholdCrit: 15 },
      { name: 'Acquire Time', unit: 'ms', healthy: 0.5, degraded: 50, warning: 500, critical: 10000, thresholdWarn: 100, thresholdCrit: 5000 },
      { name: 'Timeout Count /min', unit: '/m', healthy: 0, degraded: 0, warning: 2, critical: 45, thresholdWarn: 1, thresholdCrit: 10 },
    ],
    promql: [
      { label: 'Pool-Auslastung', query: 'hikaricp_connections_active / hikaricp_connections_max * 100' },
      { label: 'Pending Threads', query: 'hikaricp_connections_pending' },
      { label: 'Connection-Timeouts', query: 'rate(hikaricp_connections_timeout_total[5m]) * 60' },
      { label: 'Usage-Duration P95', query: 'histogram_quantile(0.95,\n  sum(rate(hikaricp_connections_usage_seconds_bucket[5m])) by (le))' },
    ],
    fix: 'Langsame Query finden (Slow-Query-Log, Tempo DB-Spans). Pool vergr\u00f6\u00dfern ist Symptombek\u00e4mpfung. connectionTimeout auf 10s reduzieren (Fail-Fast). leakDetectionThreshold=60000 aktivieren.',
    dashboardLevel: 3,
  },
  {
    id: 'upstream-429', name: 'Upstream API Rate-Limiting', icon: '\u{1F6AB}',
    subtitle: 'B2B-Provider drosselt \u2192 Quotes unvollst\u00e4ndig', category: 'external',
    description: 'Ein Versicherungs-Provider antwortet mit HTTP 429 (Too Many Requests). Der Integrator kann f\u00fcr diesen Anbieter keine Quotes liefern \u2192 Endkunden sehen weniger Vergleichsangebote. Bei mehreren betroffenen Providern sinkt die Conversion-Rate.',
    trigger: 'Peak-Traffic zur Vertragswechselsaison (November/Dezember), Retry-Storm nach kurzer Downtime eines Providers',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: '0 Rejections, alle Provider antworten, Quote-Completeness 100%' },
      { t: 0.25, severity: 'degraded', label: 'Erste 429s', desc: 'Ein Provider drosselt, Quote-Completeness 92%' },
      { t: 0.5, severity: 'warning', label: 'Mehrere Provider', desc: '3 Provider drosseln, Completeness 70%, Retry-Backoff aktiv' },
      { t: 0.75, severity: 'critical', label: 'Massives Throttling', desc: '5+ Provider drosseln, Completeness <50%, Conversion-Rate eingebrochen' },
    ],
    metrics: [
      { name: '429 Rate (alle)', unit: '/s', healthy: 0, degraded: 5, warning: 25, critical: 80, thresholdWarn: 10, thresholdCrit: 50 },
      { name: 'Quote Completeness', unit: '%', healthy: 100, degraded: 92, warning: 70, critical: 45, thresholdWarn: 85, thresholdCrit: 60, invert: true },
      { name: 'Provider verf\u00fcgbar', unit: '/15', healthy: 15, degraded: 14, warning: 12, critical: 10, thresholdWarn: 13, thresholdCrit: 11, invert: true },
      { name: 'Retry-Queue Depth', unit: '', healthy: 0, degraded: 120, warning: 800, critical: 5000, thresholdWarn: 500, thresholdCrit: 2000 },
    ],
    promql: [
      { label: '429-Rate pro Provider', query: 'sum(rate(http_client_requests_seconds_count{status="429"}[5m])) by (clientName)' },
      { label: 'Quote-Completeness', query: 'sum(provider_quote_success_total) / sum(provider_quote_attempt_total) * 100' },
      { label: 'Retry-After Header (Sekunden)', query: 'max(upstream_retry_after_seconds) by (provider)' },
    ],
    fix: 'Exponential Backoff mit Jitter implementieren (nicht feste Intervalle). Circuit Breaker pro Provider (Resilience4j). Request-Budgets pro Provider konfigurieren. Cached Quotes als Fallback (Stale-while-revalidate). Provider kontaktieren f\u00fcr h\u00f6heres Rate-Limit.',
    dashboardLevel: 2,
  },
  {
    id: 'tomcat-exhaust', name: 'Tomcat Thread-Pool voll', icon: '\u{1F9F5}',
    subtitle: 'Alle Worker-Threads busy \u2192 HTTP 503', category: 'pool',
    description: 'Tomcat hat max. 200 Worker-Threads (Default). Wenn alle busy sind, landen neue Requests in der Accept-Queue (Default: 100). Ist auch die voll \u2192 Connection Refused / HTTP 503. H\u00e4ufig ein Folgeproblem: langsame Upstream-Calls oder DB-Queries blockieren Threads.',
    trigger: 'HikariCP-Ersch\u00f6pfung blockiert Threads auf getConnection() \u2192 Tomcat-Threads stauen sich \u2192 Dominoeffekt',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: '30/200 Threads busy (15%), Accept-Queue leer' },
      { t: 0.25, severity: 'degraded', label: 'Last steigt', desc: '120/200 busy (60%), erste Queuing-Latenz' },
      { t: 0.5, severity: 'warning', label: 'Pool fast voll', desc: '185/200 busy (92%), Accept-Queue f\u00fcllt sich' },
      { t: 0.75, severity: 'critical', label: 'Ersch\u00f6pft', desc: '200/200 busy, Queue \u00fcerl\u00e4uft, HTTP 503' },
    ],
    metrics: [
      { name: 'Busy / Max Threads', unit: '%', healthy: 15, degraded: 60, warning: 92, critical: 100, thresholdWarn: 75, thresholdCrit: 95 },
      { name: 'Accept-Queue Depth', unit: '', healthy: 0, degraded: 5, warning: 45, critical: 100, thresholdWarn: 20, thresholdCrit: 80 },
      { name: 'P99 Latenz', unit: 'ms', healthy: 150, degraded: 400, warning: 1500, critical: 8000, thresholdWarn: 500, thresholdCrit: 3000 },
      { name: 'HTTP 503 /min', unit: '/m', healthy: 0, degraded: 0, warning: 5, critical: 120, thresholdWarn: 1, thresholdCrit: 30 },
    ],
    promql: [
      { label: 'Thread-Pool %', query: 'tomcat_threads_busy_threads\n  / tomcat_threads_config_max_threads * 100' },
      { label: 'Aktuelle Connections', query: 'tomcat_connections_current_connections' },
    ],
    fix: 'Root Cause finden: warum blockieren Threads? (DB-Pool? Upstream-Timeout?). Upstream-Timeouts verk\u00fcrzen (<5s). Virtual Threads evaluieren (spring.threads.virtual.enabled=true). Nicht einfach max-threads erh\u00f6hen \u2013 das verschiebt das Problem nur.',
    dashboardLevel: 2,
  },
  {
    id: 'memory-oom', name: 'Memory Pressure \u2192 OOMKill', icon: '\u{1F480}',
    subtitle: 'Working-Set \u00fcberschreitet Limit \u2192 Pod-Restart', category: 'compute',
    description: 'container_memory_working_set_bytes n\u00e4hert sich dem Memory-Limit. Der Kubelet-OOM-Killer terminiert den Container. Bei JVM: Off-Heap-Bereiche (Metaspace, Thread-Stacks, NIO-Buffer) wachsen \u00fcber den JVM-Heap hinaus. Der Container stirbt, obwohl -Xmx noch Platz hat.',
    trigger: 'Memory-Leak im JSON-Parsing (gro\u00dfe Provider-Responses nicht gestreamt), oder Metaspace-Wachstum durch dynamische Proxy-Klassen (Hibernate, Spring AOP)',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: 'Memory bei 60% des Limits, GC effektiv' },
      { t: 0.25, severity: 'degraded', label: 'Steigend', desc: 'Memory bei 75%, GC-Frequenz nimmt zu' },
      { t: 0.5, severity: 'warning', label: 'Hoch', desc: 'Memory bei 88%, Full-GC alle 2 Minuten' },
      { t: 0.75, severity: 'critical', label: 'OOMKill', desc: 'Memory >95%, OOMKilled, Pod restartet, Requests verloren' },
    ],
    metrics: [
      { name: 'Memory / Limit', unit: '%', healthy: 60, degraded: 75, warning: 88, critical: 97, thresholdWarn: 80, thresholdCrit: 90 },
      { name: 'Full-GC /min', unit: '/m', healthy: 0.1, degraded: 0.5, warning: 2, critical: 8, thresholdWarn: 1, thresholdCrit: 5 },
      { name: 'Restarts (1h)', unit: '', healthy: 0, degraded: 0, warning: 1, critical: 4, thresholdWarn: 1, thresholdCrit: 3 },
      { name: 'JVM Heap Used', unit: '%', healthy: 45, degraded: 62, warning: 78, critical: 92, thresholdWarn: 70, thresholdCrit: 85 },
    ],
    promql: [
      { label: 'Memory vs. Limit', query: 'container_memory_working_set_bytes{container!=""}\n  / kube_pod_container_resource_limits{resource="memory"} * 100' },
      { label: 'OOMKilled erkennen', query: 'kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}' },
      { label: 'Restarts z\u00e4hlen', query: 'increase(kube_pod_container_status_restarts_total[1h])' },
    ],
    fix: 'Immer container_memory_working_set_bytes \u00fcberwachen (nicht usage_bytes). JVM: -XX:MaxRAMPercentage=75 (l\u00e4sst 25% f\u00fcr Off-Heap). Memory-Limit = JVM-Heap + ~30% f\u00fcr Metaspace/Stacks/NIO. Heap-Dump bei 85% automatisch ausl\u00f6sen: -XX:+HeapDumpOnOutOfMemoryError.',
    dashboardLevel: 3,
  },
  {
    id: 'redis-saturation', name: 'Redis-Cache-S\u00e4ttigung', icon: '\u26A1',
    subtitle: 'Cache voll \u2192 Evictions \u2192 Miss-Rate steigt \u2192 API-Flut', category: 'external',
    description: 'Redis erreicht maxmemory. Die Eviction-Policy (z.B. allkeys-lru) beginnt, Keys zu verdr\u00e4ngen. Cache-Hit-Ratio sinkt \u2192 mehr Requests an B2B-APIs \u2192 Rate-Limiting-Risiko steigt. Kaskadeneffekt: Cache-Miss \u2192 Upstream-Call \u2192 h\u00f6here Latenz \u2192 mehr gleichzeitige Requests \u2192 noch mehr Cache-Misses.',
    trigger: 'Neue Produktsparte mit vielen Tarifen ongeboardet, Cache-Keys explodieren. Oder: TTL zu lang, Stale-Daten f\u00fcllen den Cache.',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: 'Hit-Ratio 96%, Memory 55%, 0 Evictions' },
      { t: 0.25, severity: 'degraded', label: 'Memory steigt', desc: 'Hit-Ratio 90%, Memory 78%, erste Evictions' },
      { t: 0.5, severity: 'warning', label: 'Eviction-Storm', desc: 'Hit-Ratio 72%, Memory 95%, 500 Evictions/s' },
      { t: 0.75, severity: 'critical', label: 'Cache nutzlos', desc: 'Hit-Ratio <50%, massive Upstream-Last, 429s h\u00e4ufen sich' },
    ],
    metrics: [
      { name: 'Cache Hit-Ratio', unit: '%', healthy: 96, degraded: 90, warning: 72, critical: 45, thresholdWarn: 85, thresholdCrit: 60, invert: true },
      { name: 'Memory / Max', unit: '%', healthy: 55, degraded: 78, warning: 95, critical: 99, thresholdWarn: 80, thresholdCrit: 95 },
      { name: 'Evictions /s', unit: '/s', healthy: 0, degraded: 20, warning: 500, critical: 3000, thresholdWarn: 100, thresholdCrit: 1000 },
      { name: 'Upstream Calls /s', unit: '/s', healthy: 50, degraded: 85, warning: 200, critical: 600, thresholdWarn: 150, thresholdCrit: 400 },
    ],
    promql: [
      { label: 'Hit-Ratio', query: 'rate(redis_keyspace_hits_total[5m])\n  / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100' },
      { label: 'Evictions', query: 'rate(redis_evicted_keys_total[5m])' },
      { label: 'Memory %', query: 'redis_memory_used_bytes / redis_memory_max_bytes * 100' },
    ],
    fix: 'maxmemory erh\u00f6hen oder Redis-Cluster skalieren. TTL-Strategie reviewen (k\u00fcrzere TTLs f\u00fcr volatile Daten). Cache-Key-Namespace pro Produktsparte. Stale-while-revalidate Pattern: abgelaufene Keys weiter ausliefern, im Hintergrund refreshen.',
    dashboardLevel: 2,
  },
  {
    id: 'cascade', name: 'Kaskaden-Failure', icon: '\u{1F30A}',
    subtitle: 'Slow Upstream \u2192 Thread-Block \u2192 Pool-Exhaust \u2192 503', category: 'cascade',
    description: 'Ein Provider wird langsam (Latenz 500ms \u2192 15s). Threads warten auf die Antwort. Tomcat-Threads stauen sich. HikariCP-Connections werden l\u00e4nger gehalten. Andere Provider-Calls werden ebenfalls blockiert, obwohl sie selbst schnell sind. Das gesamte System steht.',
    trigger: 'Provider-A hat Wartungsfenster, antwortet statt in 500ms in 15s. Kein Circuit-Breaker konfiguriert. Connect-Timeout 30s.',
    phases: [
      { t: 0, severity: 'healthy', label: 'Normal', desc: 'Alle Provider <500ms, System gesund' },
      { t: 0.2, severity: 'degraded', label: 'Provider-A langsam', desc: 'Provider-A: 5s statt 500ms, andere noch OK' },
      { t: 0.4, severity: 'warning', label: 'Thread-Stau', desc: 'Tomcat-Threads 85% busy durch wartende Provider-A-Calls' },
      { t: 0.6, severity: 'warning', label: 'Pool-Ersch\u00f6pfung', desc: 'HikariCP 95%, auch Provider-B/C-Calls langsam (Thread-Starvation)' },
      { t: 0.8, severity: 'critical', label: 'Systemausfall', desc: '503 f\u00fcr ALLE Requests, nicht nur Provider-A. Kompletter Stillstand.' },
    ],
    metrics: [
      { name: 'Provider-A P99', unit: 'ms', healthy: 450, degraded: 5000, warning: 12000, critical: 15000, thresholdWarn: 3000, thresholdCrit: 10000 },
      { name: 'Tomcat Busy %', unit: '%', healthy: 20, degraded: 55, warning: 85, critical: 100, thresholdWarn: 75, thresholdCrit: 95 },
      { name: 'Hikari Active %', unit: '%', healthy: 35, degraded: 60, warning: 95, critical: 100, thresholdWarn: 80, thresholdCrit: 95 },
      { name: 'Error Rate (alle)', unit: '%', healthy: 0.1, degraded: 2, warning: 15, critical: 65, thresholdWarn: 5, thresholdCrit: 30 },
    ],
    promql: [
      { label: 'P99 pro Provider', query: 'histogram_quantile(0.99,\n  sum(rate(http_client_requests_seconds_bucket[5m])) by (le, clientName))' },
      { label: 'Thread-Pool + DB-Pool korreliert', query: '# Tomcat\ntomcat_threads_busy_threads / tomcat_threads_config_max_threads\n# HikariCP\nhikaricp_connections_active / hikaricp_connections_max' },
    ],
    fix: 'Circuit Breaker (Resilience4j) pro Provider mit Timeout <3s. Bulkhead: dedizierte Thread-Pools pro Provider, damit ein langsamer Provider nicht alle Threads blockiert. Virtual Threads l\u00f6sen das Problem fundamental (blockierte Threads sind billig). Fallback: gecachte/leere Response statt Warten.',
    dashboardLevel: 2,
  },
]

const CATEGORIES = [
  { id: 'all', label: 'Alle', icon: '\u25C9' },
  { id: 'compute', label: 'Compute', icon: '\u2699\uFE0F' },
  { id: 'pool', label: 'Pools', icon: '\u{1F517}' },
  { id: 'external', label: 'Extern', icon: '\u{1F310}' },
  { id: 'cascade', label: 'Kaskade', icon: '\u{1F30A}' },
]

// --- Reactive state ---
const activeId = ref('cpu-throttle')
const progress = ref(0)
const playing = ref(false)
const catFilter = ref('all')
const showPromQL = ref(false)

let animFrameId = null
let startTime = null

const scenario = computed(() => SCENARIOS.find(s => s.id === activeId.value) || SCENARIOS[0])
const filtered = computed(() =>
  catFilter.value === 'all' ? SCENARIOS : SCENARIOS.filter(s => s.category === catFilter.value)
)

// --- Animation ---
function animate(timestamp) {
  if (startTime === null) startTime = timestamp
  const elapsed = timestamp - startTime
  const duration = 8000
  const p = Math.min(elapsed / duration, 1)
  progress.value = p
  if (p < 1) {
    animFrameId = requestAnimationFrame(animate)
  } else {
    playing.value = false
  }
}

function handlePlay() {
  progress.value = 0
  startTime = null
  playing.value = true
  animFrameId = requestAnimationFrame(animate)
}

function handleStop() {
  playing.value = false
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

function handleSelectScenario(id) {
  handleStop()
  activeId.value = id
  progress.value = 0
  showPromQL.value = false
}

function handleSliderInput(e) {
  handleStop()
  progress.value = parseFloat(e.target.value)
}

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})

// --- Computed metric values ---
const currentPhaseIdx = computed(() =>
  scenario.value.phases.reduce((acc, p, i) => progress.value >= p.t ? i : acc, 0)
)
const currentPhase = computed(() => scenario.value.phases[currentPhaseIdx.value])
const nextPhase = computed(() => scenario.value.phases[currentPhaseIdx.value + 1] || null)
const phaseProgress = computed(() => {
  const cp = currentPhase.value
  const np = nextPhase.value
  if (np) return (progress.value - cp.t) / (np.t - cp.t)
  return (progress.value - cp.t) / (1 - cp.t)
})

const metricValues = computed(() =>
  scenario.value.metrics.map((m) => {
    const sevKeys = ['healthy', 'degraded', 'warning', 'critical']
    const vals = sevKeys.map(k => m[k])
    const pIdx = Math.min(currentPhaseIdx.value, vals.length - 1)
    const nextIdx = Math.min(pIdx + 1, vals.length - 1)
    return lerp(vals[pIdx], vals[nextIdx], clamp(phaseProgress.value, 0, 1))
  })
)

const sparklines = computed(() =>
  scenario.value.metrics.map((m, idx) => {
    const pts = []
    const numPts = 50
    for (let i = 0; i < numPts; i++) {
      const t = i / (numPts - 1)
      if (t > progress.value) { pts.push(0); continue }
      const pIdx2 = scenario.value.phases.reduce((a, p, j) => t >= p.t ? j : a, 0)
      const nxt2 = scenario.value.phases[pIdx2 + 1]
      const pp2 = nxt2
        ? (t - scenario.value.phases[pIdx2].t) / (nxt2.t - scenario.value.phases[pIdx2].t)
        : (t - scenario.value.phases[pIdx2].t) / (1 - scenario.value.phases[pIdx2].t)
      const sevKeys2 = ['healthy', 'degraded', 'warning', 'critical']
      const vals2 = sevKeys2.map(k => m[k])
      const clampedIdx2 = Math.min(pIdx2, vals2.length - 1)
      const nxtIdx2 = Math.min(clampedIdx2 + 1, vals2.length - 1)
      const base = lerp(vals2[clampedIdx2], vals2[nxtIdx2], clamp(pp2, 0, 1))
      const maxVal = Math.max(...vals2)
      const noise = Math.sin(i * 5.1 + idx * 7) * 0.03 + Math.sin(i * 11.3 + idx * 3) * 0.02
      pts.push(clamp((base / maxVal) + noise, 0, 1))
    }
    return pts
  })
)

const currentSeverity = computed(() => currentPhase.value.severity)

// --- Sparkline SVG path helpers ---
function sparklinePath(points, width, height) {
  return points.map((v, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - v * height * 0.85 - 1.3
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
function sparklineArea(points, width, height) {
  return sparklinePath(points, width, height) + ` L${width},${height} L0,${height} Z`
}

// --- Gauge color helper ---
function gaugeColor(m, curVal) {
  if (Number.isNaN(curVal)) return C.value.red
  if (m.invert) {
    if (curVal <= m.thresholdCrit) return C.value.red
    if (curVal <= m.thresholdWarn) return C.value.orange
  } else {
    if (curVal >= m.thresholdCrit) return C.value.red
    if (curVal >= m.thresholdWarn) return C.value.orange
  }
  return C.value.green
}

// Phase timeline helpers
function phaseWidth(phases, idx) {
  const p = phases[idx]
  const next = phases[idx + 1]
  const end = next ? next.t : 1
  return (end - p.t) * 100
}
function phaseFilled(phases, idx, prog) {
  const p = phases[idx]
  const next = phases[idx + 1]
  const end = next ? next.t : 1
  if (prog >= end) return 100
  if (prog <= p.t) return 0
  return ((prog - p.t) / (end - p.t)) * 100
}
</script>

<template>
  <div class="sim-root" :style="{
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
  }">
    <div class="sim-container">
      <!-- Header -->
      <div class="sim-header">
        <div class="sim-header-top">
          <div class="pulse-dot" :class="{ animating: playing }" />
          <span class="sim-label">Saturation Simulator</span>
        </div>
        <h1 class="sim-title">S&auml;ttigungs-Szenarien durchspielen</h1>
        <p class="sim-desc">
          W&auml;hle ein Szenario und beobachte, wie sich Metriken von HEALTHY &rarr; CRITICAL entwickeln.
        </p>
      </div>

      <div class="sim-layout">
        <!-- Left: scenario list -->
        <div class="sim-sidebar">
          <!-- Category filter -->
          <div class="cat-filter">
            <button
              v-for="cat in CATEGORIES"
              :key="cat.id"
              class="cat-btn"
              :class="{ active: catFilter === cat.id }"
              @click="catFilter = cat.id"
            >
              {{ cat.icon }} {{ cat.label }}
            </button>
          </div>
          <div class="scenario-list">
            <button
              v-for="s in filtered"
              :key="s.id"
              class="scenario-btn"
              :class="{ active: activeId === s.id }"
              @click="handleSelectScenario(s.id)"
            >
              <div class="scenario-btn-header">
                <span class="scenario-icon">{{ s.icon }}</span>
                <span class="scenario-name" :class="{ 'text-blue': activeId === s.id }">{{ s.name }}</span>
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
                  >{{ severityLabel(currentSeverity) }}</span>
                </div>
                <div class="scenario-header-desc">{{ scenario.description }}</div>
              </div>
              <div class="dashboard-level">Dashboard: Level {{ scenario.dashboardLevel }}</div>
            </div>

            <!-- Trigger -->
            <div class="trigger-box">
              <span class="trigger-label">TRIGGER </span>
              <span class="trigger-text">{{ scenario.trigger }}</span>
            </div>

            <!-- Controls -->
            <div class="controls-row">
              <button class="play-btn" @click="playing ? handleStop() : handlePlay()">
                {{ playing ? '⏸' : '▶' }}
              </button>
              <input
                type="range" min="0" max="1" step="0.005"
                :value="progress"
                class="progress-slider"
                @input="handleSliderInput"
              />
              <span class="progress-pct">{{ Math.round(progress * 100) }}%</span>
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
                    opacity: (progress >= p.t && progress < (scenario.phases[i+1]?.t ?? 1)) ? 1 : (progress >= (scenario.phases[i+1]?.t ?? 1)) ? 0.5 : 0.3,
                  }"
                >
                  <div class="phase-label-header">
                    <span
                      class="phase-dot"
                      :style="{
                        background: severityColor(p.severity),
                        border: (progress >= p.t && progress < (scenario.phases[i+1]?.t ?? 1)) ? '1.5px solid ' + C.text : 'none',
                      }"
                    />
                    <span class="phase-sev" :style="{ color: severityColor(p.severity) }">
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
                borderColor: gaugeColor(m, metricValues[i]) === C.red
                  ? C.red + '40'
                  : gaugeColor(m, metricValues[i]) === C.orange
                    ? C.orange + '30'
                    : C.border,
              }"
            >
              <GaugeRing
                :value="metricValues[i]"
                :max="Math.max(m.healthy, m.degraded, m.warning, m.critical) * 1.1"
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
                    <stop offset="0%" :stop-color="gaugeColor(m, metricValues[i])" stop-opacity="0.25" />
                    <stop offset="100%" :stop-color="gaugeColor(m, metricValues[i])" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <path :d="sparklineArea(sparklines[i], 65, 16)" :fill="`url(#sg-${i})`" />
                <path :d="sparklinePath(sparklines[i], 65, 16)" fill="none" :stroke="gaugeColor(m, metricValues[i])" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <div class="metric-thresholds">
                <span class="threshold-warn">⚠ {{ m.thresholdWarn }}{{ m.unit }}</span>
                <span class="threshold-crit">🔴 {{ m.thresholdCrit }}{{ m.unit }}</span>
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
              <span>PromQL-Queries anzeigen ({{ scenario.promql.length }})</span>
              <span class="promql-arrow" :class="{ open: showPromQL }">▾</span>
            </button>
            <div v-if="showPromQL" class="promql-block">
              <div v-for="(item, i) in scenario.promql" :key="i" class="promql-item">
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
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap');

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.sim-root {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  width: 100%;
  height: 100%;
  overflow: auto;
  font-size: 8px;
}
.sim-root ::-webkit-scrollbar { width: 3px; height: 3px; }
.sim-root ::-webkit-scrollbar-track { background: transparent; }
.sim-root ::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }

.sim-container {
  max-width: 650px;
  margin: 0 auto;
  padding: 8px 8px 12px;
}

/* Header */
.sim-header { margin-bottom: 6px; }
.sim-header-top { display: flex; align-items: center; gap: 5px; margin-bottom: 1px; }
.pulse-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--c-red); box-shadow: 0 0 6px var(--c-red);
}
.pulse-dot.animating { animation: pulse 1.5s infinite; }
.sim-label {
  font-size: 7px; font-weight: 700; color: var(--c-red);
  text-transform: uppercase; letter-spacing: 1.3px;
  font-family: 'JetBrains Mono', monospace;
}
.sim-title { font-size: 13px; font-weight: 800; letter-spacing: -0.3px; margin-bottom: 1px; }
.sim-desc { font-size: 7.5px; color: var(--c-muted); max-width: 420px; line-height: 1.4; }

/* Layout */
.sim-layout { display: flex; gap: 8px; }
.sim-sidebar { flex: 0 0 140px; min-width: 120px; }
.sim-main { flex: 1; min-width: 200px; }

/* Category filter */
.cat-filter { display: flex; flex-wrap: wrap; gap: 2px; margin-bottom: 5px; }
.cat-btn {
  padding: 2px 5px; border-radius: 3px; font-size: 6.5px; font-weight: 600;
  cursor: pointer; border: 1px solid var(--c-border); background: transparent;
  color: var(--c-muted); transition: all 0.15s ease;
}
.cat-btn.active { border-color: var(--c-blue); color: var(--c-blue); }

/* Scenario list */
.scenario-list { display: flex; flex-direction: column; gap: 3px; }
.scenario-btn {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 5px;
  padding: 6px 7px; cursor: pointer; text-align: left;
  transition: all 0.2s ease; outline: none; width: 100%; color: var(--c-text);
}
.scenario-btn.active { border-color: var(--c-blue); }
.scenario-btn:hover:not(.active) { border-color: var(--c-borderHi); background: var(--c-surfaceAlt); }
.scenario-btn-header { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.scenario-icon { font-size: 11px; }
.scenario-name { font-size: 8px; font-weight: 700; }
.scenario-name.text-blue { color: var(--c-blue); }
.scenario-subtitle { font-size: 6.5px; color: var(--c-muted); line-height: 1.3; }

/* Scenario header card */
.scenario-header-card {
  background: var(--c-surface); border: 1px solid; border-radius: 7px;
  padding: 8px 10px; margin-bottom: 6px; animation: fadeIn 0.3s ease;
}
.scenario-header-top {
  display: flex; justify-content: space-between; align-items: flex-start;
  flex-wrap: wrap; gap: 5px; margin-bottom: 6px;
}
.scenario-header-title { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.scenario-header-icon { font-size: 14px; }
.scenario-header-name { font-size: 11px; font-weight: 800; }
.severity-badge {
  font-size: 6.5px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  border: 1px solid; font-family: 'JetBrains Mono', monospace;
}
.scenario-header-desc { font-size: 7.5px; color: var(--c-muted); line-height: 1.4; max-width: 340px; }
.dashboard-level {
  font-size: 6.5px; color: var(--c-dim); font-family: 'JetBrains Mono', monospace;
  text-align: right; flex-shrink: 0;
}

/* Trigger */
.trigger-box {
  background: rgba(249, 115, 22, 0.05); border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 4px; padding: 4px 6px; margin-bottom: 7px;
}
.trigger-label {
  font-size: 6.5px; font-weight: 700; color: var(--c-orange);
  font-family: 'JetBrains Mono', monospace;
}
.trigger-text { font-size: 7.5px; color: var(--c-text); }

/* Controls */
.controls-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.play-btn {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid var(--c-blue); background: rgba(59, 130, 246, 0.1);
  color: var(--c-blue); font-size: 9px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s ease; flex-shrink: 0;
}
.play-btn:hover { background: rgba(59, 130, 246, 0.2); }
.progress-slider {
  flex: 1; -webkit-appearance: none; appearance: none;
  background: var(--c-border); height: 3px; border-radius: 1.5px; outline: none;
}
.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 9px; height: 9px;
  border-radius: 50%; background: var(--c-blue); cursor: pointer;
  border: 1.5px solid var(--c-bg);
}
.progress-pct {
  font-size: 7px; color: var(--c-muted); font-family: 'JetBrains Mono', monospace;
  min-width: 22px; text-align: right;
}

/* Phase timeline */
.phase-timeline { position: relative; }
.phase-track {
  display: flex; gap: 0; height: 4px; border-radius: 2px;
  overflow: hidden; background: var(--c-border);
}
.phase-track-segment { position: relative; }
.phase-track-fill {
  height: 100%; transition: width 0.3s ease; opacity: 0.8;
}
.phase-labels { display: flex; margin-top: 4px; gap: 2px; }
.phase-label-item { transition: opacity 0.3s ease; }
.phase-label-header { display: flex; align-items: center; gap: 2px; margin-bottom: 1px; }
.phase-dot {
  width: 5px; height: 5px; border-radius: 50%;
  display: inline-block; box-sizing: border-box; flex-shrink: 0;
}
.phase-sev {
  font-size: 6px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}
.phase-name { font-size: 7px; font-weight: 600; color: var(--c-text); margin-bottom: 1px; }
.phase-desc { font-size: 6.5px; color: var(--c-muted); line-height: 1.3; }

/* Metrics grid */
.metrics-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 4px; margin-bottom: 6px;
}
.metric-card {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 5px;
  padding: 6px; display: flex; flex-direction: column;
  align-items: center; gap: 2px; transition: border-color 0.3s ease;
}
.sparkline-svg { width: 100%; height: 16px; }
.metric-thresholds { display: flex; justify-content: space-between; width: 100%; margin-top: 1px; }
.threshold-warn { font-size: 5.5px; color: var(--c-dim); font-family: 'JetBrains Mono', monospace; }
.threshold-crit { font-size: 5.5px; color: var(--c-dim); font-family: 'JetBrains Mono', monospace; }

/* Fix + PromQL */
.fix-promql-area { display: flex; flex-direction: column; gap: 4px; }
.fix-box {
  background: var(--c-surface); border: 1px solid rgba(34, 197, 94, 0.12);
  border-radius: 5px; padding: 6px 8px;
}
.fix-label {
  font-size: 7px; font-weight: 700; color: var(--c-green); text-transform: uppercase;
  letter-spacing: 0.7px; margin-bottom: 3px; font-family: 'JetBrains Mono', monospace;
}
.fix-text { font-size: 7.5px; color: var(--c-text); line-height: 1.5; }

.promql-toggle {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 5px;
  padding: 5px 8px; cursor: pointer; display: flex;
  justify-content: space-between; align-items: center;
  color: var(--c-blue); font-size: 7.5px; font-weight: 600;
  transition: all 0.15s ease; outline: none;
}
.promql-toggle:hover { border-color: var(--c-blue); }
.promql-arrow { transition: transform 0.2s ease; display: inline-block; }
.promql-arrow.open { transform: rotate(180deg); }

.promql-block {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 5px;
  padding: 6px 8px; animation: fadeIn 0.2s ease;
  display: flex; flex-direction: column; gap: 5px;
}
.promql-item {}
.promql-label {
  font-size: 6.5px; font-weight: 700; color: var(--c-blue);
  margin-bottom: 2px; font-family: 'JetBrains Mono', monospace;
}
.promql-code {
  background: var(--c-codeBg); border: 1px solid var(--c-border); border-radius: 4px;
  padding: 5px 6px; font-size: 7px; color: var(--c-codeText);
  font-family: 'JetBrains Mono', monospace; line-height: 1.4;
  overflow-x: auto; margin: 0; white-space: pre-wrap; word-break: break-all;
}
</style>
