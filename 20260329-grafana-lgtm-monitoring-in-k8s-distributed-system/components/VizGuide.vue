<script setup>
import { ref, computed, watch } from "vue";
import { useDarkMode } from "@slidev/client";

const props = defineProps({
  initialSelectedViz: { type: String, default: null },
});

const { isDark } = useDarkMode();

const DARK_PALETTE = {
  bg: "#0b0e14",
  surface: "#131720",
  surfaceHover: "#1a1f2e",
  border: "#1e2536",
  text: "#e2e8f0",
  // #64748b erreichte auf dunkler Surface nur ~4:1 — heller abgestuft.
  textMuted: "#94a3b8",
  textDim: "#475569",
  accent: "#3b82f6",
  accentGlow: "rgba(59,130,246,0.15)",
  green: "#22c55e",
  greenDim: "rgba(34,197,94,0.15)",
  yellow: "#eab308",
  yellowDim: "rgba(234,179,8,0.15)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.15)",
  orange: "#f97316",
  orangeDim: "rgba(249,115,22,0.15)",
  purple: "#a855f7",
  purpleDim: "rgba(168,85,247,0.15)",
  cyan: "#06b6d4",
  cyanDim: "rgba(6,182,212,0.15)",
};

const LIGHT_PALETTE = {
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  accent: "#2563eb",
  accentGlow: "rgba(37,99,235,0.12)",
  green: "#16a34a",
  greenDim: "rgba(22,163,74,0.10)",
  yellow: "#ca8a04",
  yellowDim: "rgba(202,138,4,0.10)",
  red: "#dc2626",
  redDim: "rgba(220,38,38,0.10)",
  orange: "#ea580c",
  orangeDim: "rgba(234,88,12,0.10)",
  purple: "#9333ea",
  purpleDim: "rgba(147,51,234,0.10)",
  cyan: "#0891b2",
  cyanDim: "rgba(8,145,178,0.10)",
};

const PALETTE = computed(() => (isDark.value ? DARK_PALETTE : LIGHT_PALETTE));

const LEVELS = [
  {
    id: 1,
    name: "Platform Overview",
    color: "#ef4444",
    colorDim: "rgba(239,68,68,0.15)",
  },
  {
    id: 2,
    name: "Service Dashboard",
    color: "#3b82f6",
    colorDim: "rgba(59,130,246,0.15)",
  },
  {
    id: 3,
    name: "Pod / Instance",
    color: "#f97316",
    colorDim: "rgba(249,115,22,0.15)",
  },
  {
    id: 4,
    name: "Infrastructure",
    color: "#a855f7",
    colorDim: "rgba(168,85,247,0.15)",
  },
];

const VIZ_TYPES = [
  {
    id: "timeseries",
    name: "Time Series",
    icon: "\u{1F4C8}",
    color: DARK_PALETTE.accent,
    colorDim: DARK_PALETTE.accentGlow,
    useFor: "Kontinuierliche Metriken \u00fcber die Zeit",
    examples: [
      "Request-Rate (req/s)",
      "Latenz-Perzentile (p50/p95/p99)",
      "CPU/Memory-Trends",
      "Error-Rate \u00fcber Zeit",
    ],
    tips: "Max. 4\u20135 Serien pro Panel. Exemplar-Diamonds aktivieren f\u00fcr Trace-Links. Thresholds als farbige Regionen f\u00fcr SLO-Grenzen.",
    levels: [1, 2, 3, 4],
    sizing: "8\u201312 Spalten, 6\u20138 H\u00f6he",
  },
  {
    id: "stat",
    name: "Stat Panel",
    icon: "\u{1F522}",
    color: DARK_PALETTE.green,
    colorDim: DARK_PALETTE.greenDim,
    useFor: "Einzelne aktuelle KPIs als gro\u00dfe Zahlen",
    examples: [
      "SLO-Compliance (99.7%)",
      "Aktuelle Error-Rate",
      "Aktive Pods",
      "Request-Rate aktuell",
    ],
    tips: "Mit Sparkline f\u00fcr Trend. Farbcodierung: gr\u00fcn/gelb/rot nach Schwellwerten. Ideal f\u00fcr die Header-Zeile.",
    levels: [1, 2],
    sizing: "4\u20138 Spalten, 3\u20134 H\u00f6he",
  },
  {
    id: "gauge",
    name: "Gauge",
    icon: "\u23F1\uFE0F",
    color: DARK_PALETTE.orange,
    colorDim: DARK_PALETTE.orangeDim,
    useFor: "Utilization relativ zu Min/Max-Grenzen",
    examples: [
      "CPU-Auslastung (0\u2013100%)",
      "Memory vs. Limit",
      "Connection-Pool-Nutzung",
      "JVM Heap %",
    ],
    tips: "Gelb ab 70%, rot ab 90%. Nur f\u00fcr bounded Werte, nicht f\u00fcr unbounded Metriken wie Request-Count.",
    levels: [2, 3],
    sizing: "4\u20136 Spalten, 4\u20135 H\u00f6he",
  },
  {
    id: "heatmap",
    name: "Heatmap",
    icon: "\u{1F7E7}",
    color: DARK_PALETTE.yellow,
    colorDim: DARK_PALETTE.yellowDim,
    useFor: "Verteilung von Werten \u00fcber die Zeit (Histogramm-Buckets)",
    examples: [
      "Latenz-Verteilung",
      "Request-Duration-Buckets",
      "Bimodale Verteilungen erkennen",
    ],
    tips: "Unverzichtbar f\u00fcr Latenz-Analyse. Zeigt Outlier und Muster, die Perzentile verstecken. Braucht volle Breite.",
    levels: [2],
    sizing: "12\u201324 Spalten, 8\u201310 H\u00f6he",
  },
  {
    id: "table",
    name: "Table",
    icon: "\u{1F4CB}",
    color: DARK_PALETTE.purple,
    colorDim: DARK_PALETTE.purpleDim,
    useFor: "Vergleiche, Top-N-Listen, sortierbare Daten",
    examples: [
      "Top-10 langsamste Endpoints",
      "Pod-Ressourcenverbrauch",
      "Provider-API-Status",
      "Service-Matrix",
    ],
    tips: "Field Overrides f\u00fcr farbige Hintergr\u00fcnde. Gradient-Gauge in Zellen. Sortierbar nach Spalten.",
    levels: [2, 3, 4],
    sizing: "12\u201324 Spalten, 8\u201310 H\u00f6he",
  },
  {
    id: "logs",
    name: "Logs Panel",
    icon: "\u{1F4DC}",
    color: DARK_PALETTE.cyan,
    colorDim: DARK_PALETTE.cyanDim,
    useFor: "Korrelierte Logs aus Loki",
    examples: [
      "Fehler-Logs eines Service",
      "Logs zu einer Trace-ID",
      "Exception Stack-Traces",
    ],
    tips: 'Filter via Template-Variablen: {namespace="$namespace", app="$service"}. Volle Breite. Log-to-Trace-Links konfigurieren.',
    levels: [2, 3],
    sizing: "24 Spalten (volle Breite), 8\u201312 H\u00f6he",
  },
  {
    id: "traces",
    name: "Traces Panel",
    icon: "\u{1F517}",
    color: "#f472b6",
    colorDim: "rgba(244,114,182,0.15)",
    useFor: "Verteilte Traces als Gantt-Chart (Tempo)",
    examples: [
      "Request-Flow \u00fcber Services",
      "Langsame Span-Identifikation",
      "Dependency-Analyse",
    ],
    tips: "Trace-to-Logs und Trace-to-Metrics konfigurieren. Service-Map aus Tempo-Daten.",
    levels: [1, 2],
    sizing: "24 Spalten, 10\u201314 H\u00f6he",
  },
  {
    id: "statetimeline",
    name: "State Timeline",
    icon: "\u{1F6A6}",
    color: DARK_PALETTE.green,
    colorDim: DARK_PALETTE.greenDim,
    useFor: "Diskrete Zustands\u00e4nderungen als farbige B\u00e4nder",
    examples: [
      "Service-Verf\u00fcgbarkeit (24h)",
      "Deployment-Rollout-Status",
      "Carrier-API-Verf\u00fcgbarkeit",
    ],
    tips: "Gr\u00fcn = healthy, gelb = degraded, rot = down. Ideal f\u00fcr Status-Historien auf dem Platform-Overview.",
    levels: [1],
    sizing: "12\u201324 Spalten, 4\u20136 H\u00f6he",
  },
  {
    id: "alertlist",
    name: "Alert List",
    icon: "\u{1F514}",
    color: DARK_PALETTE.red,
    colorDim: DARK_PALETTE.redDim,
    useFor: "Aktive Alarme anzeigen",
    examples: [
      "Critical Alerts (Firing)",
      "Service-spezifische Alerts",
      "SLO-Burn-Rate-Alerts",
    ],
    tips: "Platform-Overview: severity=critical. Service-Dashboard: nach service filtern. Nur Firing/Error-States.",
    levels: [1, 2],
    sizing: "8\u201312 Spalten, 6\u20138 H\u00f6he",
  },
  {
    id: "text",
    name: "Text Panel",
    icon: "\u{1F4DD}",
    color: "#94a3b8",
    colorDim: "rgba(148,163,184,0.12)",
    useFor: "Markdown-Kontext, Runbook-Links, Eskalationspfade",
    examples: [
      "Runbook-Link pro Service",
      "SLO-Definition + Eskalationspfad",
      "Architektur-Diagramm (Mermaid)",
      "Team-Ownership / Kontaktinfo",
    ],
    tips: "Markdown mit Links zu Runbooks in jedem Service-Dashboard. Am Anfang oder als Collapsible Row. Template-Variablen ($service, $namespace) funktionieren in Text-Panels. Mermaid-Diagramme ab Grafana 10+.",
    levels: [1, 2, 3],
    sizing: "6\u201312 Spalten, 3\u20136 H\u00f6he",
  },
  {
    id: "dashlink",
    name: "Dashboard Links",
    icon: "\u{1F500}",
    color: "#38bdf8",
    colorDim: "rgba(56,189,248,0.12)",
    useFor: "Drill-Down-Navigation zwischen Dashboards mit Variablen",
    examples: [
      "Overview -> Service (?var-service=X)",
      "Service RED -> Pod USE (?var-pod=X)",
      "Service -> Upstream-Provider-Detail",
      "Panel Data Link -> Runbook (extern)",
    ],
    tips: "Dashboard Settings > Links oder Data Links auf Panels. Variablen via URL: ?var-namespace=$namespace&var-service=$service. Data Links auf Time-Series: Klick auf Serie springt zum Pod-Dashboard. Relative URLs: d/<uid>/<slug>?var-X=$X.",
    levels: [1, 2, 3, 4],
    sizing: "Header / Panel Data Links",
  },
];

const DECISION_MATRIX = [
  {
    q: "Wie ver\u00e4ndert sich X \u00fcber die Zeit?",
    a: "Time Series",
    icon: "\u{1F4C8}",
  },
  {
    q: "Wie ist der aktuelle Wert eines KPIs?",
    a: "Stat Panel",
    icon: "\u{1F522}",
  },
  {
    q: "Wie voll ist eine Ressource (% von Max)?",
    a: "Gauge",
    icon: "\u23F1\uFE0F",
  },
  {
    q: "Wie verteilen sich Latenzen (Histogramm)?",
    a: "Heatmap",
    icon: "\u{1F7E7}",
  },
  { q: "Welche Endpoints sind am langsamsten?", a: "Table", icon: "\u{1F4CB}" },
  {
    q: "Was steht in den Logs zu diesem Fehler?",
    a: "Logs Panel",
    icon: "\u{1F4DC}",
  },
  {
    q: "Wie flie\u00dft ein Request \u00fcber alle Services?",
    a: "Traces Panel",
    icon: "\u{1F517}",
  },
  {
    q: "War der Service heute Nacht verf\u00fcgbar?",
    a: "State Timeline",
    icon: "\u{1F6A6}",
  },
  { q: "Welche Alerts feuern gerade?", a: "Alert List", icon: "\u{1F514}" },
  {
    q: "Wo ist das Runbook / wer ist Owner?",
    a: "Text Panel",
    icon: "\u{1F4DD}",
  },
  {
    q: "Drill-Down zum Pod / zur Infrastruktur?",
    a: "Dashboard Links",
    icon: "\u{1F500}",
  },
];

const selectedViz = ref(props.initialSelectedViz);

watch(
  () => props.initialSelectedViz,
  (val) => {
    if (val) selectedViz.value = val;
  },
);

const vizDetail = computed(() =>
  VIZ_TYPES.find((v) => v.id === selectedViz.value),
);

function selectViz(id) {
  selectedViz.value = id;
}

function selectByName(name) {
  const match = VIZ_TYPES.find((v) => v.name === name);
  if (match) selectedViz.value = match.id;
}

function getLevelInfo(levelId) {
  return LEVELS[levelId - 1];
}
</script>

<template>
  <div class="vizguide-root">
    <div class="vizguide-columns">
      <!-- Left: Decision Matrix -->
      <div class="decision-matrix">
        <div class="dm-title">Entscheidungsmatrix</div>
        <div class="dm-list">
          <button
            v-for="(item, i) in DECISION_MATRIX"
            :key="i"
            class="dm-item"
            @click="selectByName(item.a)"
            @mouseenter="
              (e) => {
                e.currentTarget.style.borderColor = PALETTE.accent;
                e.currentTarget.style.background = PALETTE.surfaceHover;
              }
            "
            @mouseleave="
              (e) => {
                e.currentTarget.style.borderColor = PALETTE.border;
                e.currentTarget.style.background = `${PALETTE.accent}05`;
              }
            "
          >
            <span class="dm-question">{{ item.q }}</span>
            <span class="dm-answer">{{ item.icon }} {{ item.a }}</span>
          </button>
        </div>
      </div>

      <!-- Right: Viz Grid + Detail -->
      <div class="vizguide-main">
        <!-- Viz Type Cards Grid -->
        <div class="viz-grid">
          <button
            v-for="viz in VIZ_TYPES"
            :key="viz.id"
            class="viz-card"
            :style="{
              background:
                selectedViz === viz.id ? viz.colorDim : PALETTE.surface,
              borderColor: selectedViz === viz.id ? viz.color : PALETTE.border,
            }"
            @click="selectViz(viz.id)"
            @mouseenter="
              (e) => {
                if (selectedViz !== viz.id) {
                  e.currentTarget.style.borderColor = `${viz.color}80`;
                  e.currentTarget.style.background = PALETTE.surfaceHover;
                }
              }
            "
            @mouseleave="
              (e) => {
                if (selectedViz !== viz.id) {
                  e.currentTarget.style.borderColor = PALETTE.border;
                  e.currentTarget.style.background = PALETTE.surface;
                }
              }
            "
          >
            <div class="viz-card-top">
              <span class="viz-icon">{{ viz.icon }}</span>
              <span class="viz-sizing">{{ viz.sizing }}</span>
            </div>
            <div
              class="viz-card-name"
              :style="{
                color: selectedViz === viz.id ? viz.color : PALETTE.text,
              }"
            >
              {{ viz.name }}
            </div>
            <div class="viz-card-usefor">{{ viz.useFor }}</div>
            <div class="viz-card-levels">
              <span
                v-for="l in viz.levels"
                :key="l"
                class="viz-level-badge"
                :style="{
                  background: getLevelInfo(l).colorDim,
                  color: getLevelInfo(l).color,
                }"
                >L{{ l }}</span
              >
            </div>
          </button>
        </div>

        <!-- Viz Detail -->
        <div
          v-if="vizDetail"
          class="viz-detail"
          :style="{
            background: vizDetail.colorDim,
            borderColor: `${vizDetail.color}40`,
          }"
        >
          <div class="viz-detail-header">
            <span class="viz-detail-icon">{{ vizDetail.icon }}</span>
            <div>
              <div class="viz-detail-name" :style="{ color: vizDetail.color }">
                {{ vizDetail.name }}
              </div>
              <div class="viz-detail-sizing">
                Sizing: {{ vizDetail.sizing }}
              </div>
            </div>
          </div>
          <div class="viz-detail-body">
            <div class="viz-detail-usefor">{{ vizDetail.useFor }}</div>
            <div class="viz-detail-examples">
              <div class="section-label">Beispiele</div>
              <div class="examples-list">
                <div
                  v-for="(ex, i) in vizDetail.examples"
                  :key="i"
                  class="example-item"
                >
                  <span
                    class="example-marker"
                    :style="{ color: vizDetail.color }"
                    >&rsaquo;</span
                  >
                  {{ ex }}
                </div>
              </div>
            </div>
            <div
              class="viz-detail-tip"
              :style="{
                background: `${vizDetail.color}10`,
                borderColor: `${vizDetail.color}20`,
              }"
            >
              <div class="tip-label" :style="{ color: vizDetail.color }">
                Praxis-Tipp
              </div>
              <div class="tip-text">{{ vizDetail.tips }}</div>
            </div>
          </div>
          <div class="viz-detail-levels-used">
            <span class="levels-prefix">Eingesetzt auf:</span>
            <span
              v-for="l in vizDetail.levels"
              :key="l"
              class="level-used-badge"
              :style="{
                background: getLevelInfo(l).colorDim,
                color: getLevelInfo(l).color,
                borderColor: `${getLevelInfo(l).color}30`,
              }"
              >Level {{ l }} &ndash; {{ getLevelInfo(l).name }}</span
            >
          </div>
        </div>

        <div v-if="!vizDetail" class="viz-placeholder">
          Klick auf einen Visualisierungstyp f&uuml;r Details, Beispiele und
          Praxis-Tipps.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vizguide-root {
  animation: fadeSlideIn 0.3s ease;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.vizguide-columns {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.vizguide-main {
  flex: 1;
  min-width: 0;
}

.viz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
  margin-bottom: 6px;
}

.viz-card {
  border: 1px solid;
  border-radius: 5px;
  padding: 8px 9px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-family: inherit;
}

.viz-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.viz-icon {
  font-size: 13px;
}

.viz-sizing {
  font-size: 6px;
  color: v-bind("PALETTE.textDim");
  font-family: monospace;
}

.viz-card-name {
  font-size: 9px;
  font-weight: 700;
}

.viz-card-usefor {
  font-size: 7px;
  color: v-bind("PALETTE.textMuted");
  line-height: 1.3;
}

.viz-card-levels {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  margin-top: 1px;
}

.viz-level-badge {
  font-size: 6px;
  padding: 1px 3px;
  border-radius: 2px;
  font-weight: 600;
}

/* Viz Detail */
.viz-detail {
  border: 1px solid;
  border-radius: 5px;
  padding: 8px 10px;
  animation: fadeSlideIn 0.25s ease;
}

.viz-detail-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.viz-detail-icon {
  font-size: 14px;
}

.viz-detail-name {
  font-size: 10px;
  font-weight: 800;
}

.viz-detail-sizing {
  font-size: 7px;
  color: v-bind("PALETTE.textMuted");
  font-family: monospace;
}

.viz-detail-body {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.viz-detail-usefor {
  font-size: 8px;
  color: v-bind("PALETTE.text");
  margin-bottom: 4px;
  line-height: 1.3;
  flex-shrink: 0;
}

.viz-detail-examples {
  margin-bottom: 0;
  flex-shrink: 0;
}

.section-label {
  font-size: 7px;
  font-weight: 700;
  color: v-bind("PALETTE.textMuted");
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 4px;
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.example-item {
  font-size: 8px;
  color: v-bind("PALETTE.text");
  padding-left: 8px;
  position: relative;
}

.example-marker {
  position: absolute;
  left: 0;
}

.viz-detail-tip {
  border-radius: 4px;
  padding: 6px 8px;
  border: 1px solid;
}

.tip-label {
  font-size: 7px;
  font-weight: 700;
  margin-bottom: 2px;
}

.tip-text {
  font-size: 8px;
  color: v-bind("PALETTE.text");
  line-height: 1.4;
}

.viz-detail-levels-used {
  margin-top: 6px;
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.levels-prefix {
  font-size: 7px;
  color: v-bind("PALETTE.textDim");
}

.level-used-badge {
  font-size: 7px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  border: 1px solid;
}

.viz-placeholder {
  text-align: center;
  padding: 24px;
  color: v-bind("PALETTE.textDim");
  font-size: 9px;
}

/* Decision Matrix */
.decision-matrix {
  width: 210px;
  flex-shrink: 0;
  padding: 6px;
  background: v-bind("PALETTE.surface");
  border-radius: 5px;
  border: 1px solid v-bind("PALETTE.border");
}

.dm-title {
  font-size: 6px;
  font-weight: 700;
  color: v-bind("PALETTE.textDim");
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 4px;
}

.dm-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dm-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 3px 5px;
  background: rgba(59, 130, 246, 0.02);
  border: 1px solid v-bind("PALETTE.border");
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  outline: none;
  font-family: inherit;
}

.dm-question {
  font-size: 7px;
  color: v-bind("PALETTE.text");
  line-height: 1.2;
}

.dm-answer {
  font-size: 7px;
  font-weight: 700;
  color: v-bind("PALETTE.accent");
  white-space: nowrap;
}
</style>
