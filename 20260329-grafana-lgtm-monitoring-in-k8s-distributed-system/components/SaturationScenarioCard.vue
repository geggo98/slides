<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const props = defineProps({
  scenarioId: { type: String, required: true },
});

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
    muted: "#64748b",
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
    cyan: d ? "#06b6d4" : "#0891b2",
  };
});

const SCENARIOS = [
  {
    id: "cpu-throttle",
    name: "CPU-Throttling",
    icon: "\u{1F525}",
    subtitle: "CFS Quota ersch\u00f6pft \u2192 JVM-GC-Verst\u00e4rkung",
    category: "compute",
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
      },
      {
        name: "P99 Latenz",
        unit: "ms",
        healthy: 180,
        degraded: 350,
        warning: 800,
        critical: 2400,
      },
      {
        name: "GC Pause avg",
        unit: "ms",
        healthy: 12,
        degraded: 45,
        warning: 110,
        critical: 280,
      },
      {
        name: "CPU Usage / Limit",
        unit: "%",
        healthy: 55,
        degraded: 78,
        warning: 92,
        critical: 99,
      },
    ],
  },
  {
    id: "hikari-exhaust",
    name: "HikariCP-Ersch\u00f6pfung",
    icon: "\u{1F5C4}\uFE0F",
    subtitle: "DB-Connection-Pool leer \u2192 Thread-Blockade",
    category: "pool",
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
      },
      {
        name: "Pending Threads",
        unit: "",
        healthy: 0,
        degraded: 2,
        warning: 8,
        critical: 27,
      },
      {
        name: "Acquire Time",
        unit: "ms",
        healthy: 0.5,
        degraded: 50,
        warning: 500,
        critical: 10000,
      },
      {
        name: "Timeout Count /min",
        unit: "/m",
        healthy: 0,
        degraded: 0,
        warning: 2,
        critical: 45,
      },
    ],
  },
  {
    id: "upstream-429",
    name: "Upstream API Rate-Limiting",
    icon: "\u{1F6AB}",
    subtitle: "B2B-Provider drosselt \u2192 Quotes unvollst\u00e4ndig",
    category: "external",
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
      },
      {
        name: "Quote Completeness",
        unit: "%",
        healthy: 100,
        degraded: 92,
        warning: 70,
        critical: 45,
      },
      {
        name: "Provider verf\u00fcgbar",
        unit: "/15",
        healthy: 15,
        degraded: 14,
        warning: 12,
        critical: 10,
      },
      {
        name: "Retry-Queue Depth",
        unit: "",
        healthy: 0,
        degraded: 120,
        warning: 800,
        critical: 5000,
      },
    ],
  },
  {
    id: "tomcat-exhaust",
    name: "Tomcat Thread-Pool voll",
    icon: "\u{1F9F5}",
    subtitle: "Alle Worker-Threads busy \u2192 HTTP 503",
    category: "pool",
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
      },
      {
        name: "Accept-Queue Depth",
        unit: "",
        healthy: 0,
        degraded: 5,
        warning: 45,
        critical: 100,
      },
      {
        name: "P99 Latenz",
        unit: "ms",
        healthy: 150,
        degraded: 400,
        warning: 1500,
        critical: 8000,
      },
      {
        name: "HTTP 503 /min",
        unit: "/m",
        healthy: 0,
        degraded: 0,
        warning: 5,
        critical: 120,
      },
    ],
  },
  {
    id: "memory-oom",
    name: "Memory Pressure \u2192 OOMKill",
    icon: "\u{1F480}",
    subtitle: "Working-Set \u00fcberschreitet Limit \u2192 Pod-Restart",
    category: "compute",
    trigger:
      "Memory-Leak im JSON-Parsing (gro\u00dfe Provider-Responses nicht gestreamt), oder Metaspace-Wachstum durch dynamische Proxy-Klassen",
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
      },
      {
        name: "Full-GC /min",
        unit: "/m",
        healthy: 0.1,
        degraded: 0.5,
        warning: 2,
        critical: 8,
      },
      {
        name: "Restarts (1h)",
        unit: "",
        healthy: 0,
        degraded: 0,
        warning: 1,
        critical: 4,
      },
      {
        name: "JVM Heap Used",
        unit: "%",
        healthy: 45,
        degraded: 62,
        warning: 78,
        critical: 92,
      },
    ],
  },
  {
    id: "redis-saturation",
    name: "Redis-Cache-S\u00e4ttigung",
    icon: "\u26A1",
    subtitle:
      "Cache voll \u2192 Evictions \u2192 Miss-Rate steigt \u2192 API-Flut",
    category: "external",
    trigger:
      "Neue Produktsparte mit vielen Tarifen ongeboardet, Cache-Keys explodieren.",
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
      },
      {
        name: "Memory / Max",
        unit: "%",
        healthy: 55,
        degraded: 78,
        warning: 95,
        critical: 99,
      },
      {
        name: "Evictions /s",
        unit: "/s",
        healthy: 0,
        degraded: 20,
        warning: 500,
        critical: 3000,
      },
      {
        name: "Upstream Calls /s",
        unit: "/s",
        healthy: 50,
        degraded: 85,
        warning: 200,
        critical: 600,
      },
    ],
  },
  {
    id: "cascade",
    name: "Kaskaden-Failure",
    icon: "\u{1F30A}",
    subtitle:
      "Slow Upstream \u2192 Thread-Block \u2192 Pool-Exhaust \u2192 503",
    category: "cascade",
    trigger:
      "Provider-A hat Wartungsfenster, antwortet statt in 500ms in 15s. Kein Circuit-Breaker konfiguriert.",
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
        desc: "HikariCP 95%, auch Provider-B/C-Calls langsam",
      },
      {
        t: 0.8,
        severity: "critical",
        label: "Systemausfall",
        desc: "503 f\u00fcr ALLE Requests. Kompletter Stillstand.",
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
      },
      {
        name: "Tomcat Busy %",
        unit: "%",
        healthy: 20,
        degraded: 55,
        warning: 85,
        critical: 100,
      },
      {
        name: "Hikari Active %",
        unit: "%",
        healthy: 35,
        degraded: 60,
        warning: 95,
        critical: 100,
      },
      {
        name: "Error Rate (alle)",
        unit: "%",
        healthy: 0.1,
        degraded: 2,
        warning: 15,
        critical: 65,
      },
    ],
  },
];

function severityColor(s) {
  return s === "critical"
    ? C.value.red
    : s === "warning"
      ? C.value.orange
      : s === "degraded"
        ? C.value.yellow
        : C.value.green;
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

const scenario = computed(
  () => SCENARIOS.find((s) => s.id === props.scenarioId) || SCENARIOS[0],
);
</script>

<template>
  <div
    class="scenario-card"
    :style="{
      '--c-surface': C.surface,
      '--c-surfaceAlt': C.surfaceAlt,
      '--c-border': C.border,
      '--c-text': C.text,
      '--c-muted': C.muted,
      '--c-dim': C.dim,
      '--c-orange': C.orange,
    }"
  >
    <!-- Header -->
    <div class="card-header">
      <span class="card-icon">{{ scenario.icon }}</span>
      <div class="card-title-block">
        <div class="card-name">{{ scenario.name }}</div>
        <div class="card-subtitle">{{ scenario.subtitle }}</div>
      </div>
    </div>

    <!-- Trigger -->
    <div class="card-trigger">
      <span class="trigger-label">TRIGGER</span>
      <span class="trigger-text">{{ scenario.trigger }}</span>
    </div>

    <!-- Phases -->
    <div class="card-phases">
      <div v-for="(phase, i) in scenario.phases" :key="i" class="phase-item">
        <span
          class="phase-dot"
          :style="{ background: severityColor(phase.severity) }"
        />
        <span
          class="phase-severity"
          :style="{ color: severityColor(phase.severity) }"
          >{{ severityLabel(phase.severity) }}</span
        >
        <span class="phase-label">{{ phase.label }}</span>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="card-metrics">
      <div v-for="(m, i) in scenario.metrics" :key="i" class="metric-pill">
        <span class="metric-name">{{ m.name }}</span>
        <span class="metric-range"
          >{{ m.healthy }}{{ m.unit }} → {{ m.critical }}{{ m.unit }}</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.scenario-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 7px;
  padding: 10px 12px;
  font-family: "DM Sans", "Segoe UI", system-ui, sans-serif;
  color: var(--c-text);
  max-width: 420px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}
.card-icon {
  font-size: 16px;
}
.card-title-block {
  flex: 1;
}
.card-name {
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}
.card-subtitle {
  font-size: 8px;
  color: var(--c-muted);
  line-height: 1.3;
}
.card-trigger {
  background: rgba(249, 115, 22, 0.06);
  border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 4px;
  padding: 5px 7px;
  margin-bottom: 7px;
}
.trigger-label {
  font-size: 7px;
  font-weight: 700;
  color: var(--c-orange);
  font-family: "JetBrains Mono", monospace;
  margin-right: 4px;
}
.trigger-text {
  font-size: 8px;
  color: var(--c-text);
  line-height: 1.4;
}
.card-phases {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 7px;
}
.phase-item {
  display: flex;
  align-items: center;
  gap: 3px;
}
.phase-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.phase-severity {
  font-size: 7px;
  font-weight: 700;
  font-family: "JetBrains Mono", monospace;
}
.phase-label {
  font-size: 7px;
  color: var(--c-muted);
}
.card-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.metric-pill {
  background: var(--c-surfaceAlt);
  border: 1px solid var(--c-border);
  border-radius: 3px;
  padding: 3px 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.metric-name {
  font-size: 7px;
  font-weight: 600;
  color: var(--c-muted);
  font-family: "JetBrains Mono", monospace;
}
.metric-range {
  font-size: 7px;
  color: var(--c-text);
  font-family: "JetBrains Mono", monospace;
}
</style>
