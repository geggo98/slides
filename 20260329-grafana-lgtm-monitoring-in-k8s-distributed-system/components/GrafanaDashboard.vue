<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import DashboardHierarchy from "./DashboardHierarchy.vue";
import VizGuide from "./VizGuide.vue";
import DashboardLinking from "./DashboardLinking.vue";

const { isDark } = useDarkMode();

const DARK_PALETTE = {
  bg: "#0b0e14",
  surface: "#131720",
  surfaceHover: "#1a1f2e",
  border: "#1e2536",
  borderActive: "#3b82f6",
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
  borderActive: "#3b82f6",
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

const tab = ref("hierarchy");
const selectedViz = ref(null);

const tabs = [
  { key: "hierarchy", label: "Dashboard-Hierarchie" },
  { key: "vizguide", label: "Visualisierungs-Guide" },
  { key: "linking", label: "Linking & Runbooks" },
];

function switchToVizGuide(vizId) {
  selectedViz.value = vizId;
  tab.value = "vizguide";
}
</script>

<template>
  <div class="grafana-root">
    <!-- Header -->
    <div class="header">
      <div class="header-badge">
        <div class="header-dot" />
        <span class="header-label">LGTM Stack &middot; Grafana</span>
      </div>
      <h1 class="header-title">Dashboard-Architektur &amp; Visualisierungen</h1>
      <p class="header-desc">
        Vier Ebenen vom Platform-Overview zur Root-Cause-Analyse. Klick auf ein
        Level f&uuml;r das Layout, auf ein Panel f&uuml;r die
        Visualisierungs-Details.
      </p>

      <!-- Tabs: shared Komponente, Panels bleiben als v-if-Geschwister unten
           (Zustand via v-model). Optik via --sk-tab-* im scoped Style. -->
      <Tabs
        v-model="tab"
        class="gd-tabs"
        :tabs="tabs"
        aria-label="Dashboard-Ansichten"
      />
    </div>

    <div class="content">
      <DashboardHierarchy
        v-if="tab === 'hierarchy'"
        @select-viz="switchToVizGuide"
      />
      <VizGuide v-if="tab === 'vizguide'" :initial-selected-viz="selectedViz" />
      <DashboardLinking v-if="tab === 'linking'" />
    </div>
  </div>
</template>

<style scoped>
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

.grafana-root {
  background: v-bind("PALETTE.bg");
  color: v-bind("PALETTE.text");
  font-family: inherit;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 9px;
}

.grafana-root * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.grafana-root ::-webkit-scrollbar {
  width: 4px;
}
.grafana-root ::-webkit-scrollbar-track {
  background: transparent;
}
.grafana-root ::-webkit-scrollbar-thumb {
  background: v-bind("PALETTE.border");
  border-radius: 2px;
}

.header {
  padding: 14px 16px 0;
  max-width: 960px;
  margin: 0 auto;
}

.header-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.header-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: v-bind("PALETTE.accent");
  box-shadow: 0 0 8px v-bind("PALETTE.accent");
}

.header-label {
  font-size: 7px;
  font-weight: 700;
  color: v-bind("PALETTE.accent");
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-family: var(--slidev-code-font-family);
}

.header-title {
  font-size: 17px;
  font-weight: 800;
  color: v-bind("PALETTE.text");
  line-height: 1.2;
  margin-bottom: 3px;
  letter-spacing: -0.3px;
}

.header-desc {
  font-size: 8px;
  color: v-bind("PALETTE.textMuted");
  line-height: 1.4;
  max-width: 500px;
}

/* Shared-Tabs-Optik: exakt die frühere .tab-btn-Leiste (Unterstrich-Tabs
 * auf Border-Linie). */
.gd-tabs {
  margin-top: 10px;
  --sk-tab-gap: 1px;
  --sk-tab-bar-mb: 0;
  --sk-tab-bar-border-bottom: 1px solid v-bind("PALETTE.border");
  --sk-tab-pad: 6px 12px;
  --sk-tab-radius: 0;
  --sk-tab-bg: transparent;
  --sk-tab-hover-bg: transparent;
  --sk-tab-active-bg: transparent;
  --sk-tab-color: v-bind("PALETTE.textMuted");
  --sk-tab-active-color: v-bind("PALETTE.text");
  --sk-tab-font-size: 9px;
  --sk-tab-font-weight: 600;
  --sk-tab-transition: all 0.15s ease;
}

.gd-tabs :deep(button.sk-tab) {
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.gd-tabs :deep(button.sk-tab.active) {
  border-bottom-color: v-bind("PALETTE.accent");
}

.gd-tabs :deep(button.sk-tab:hover:not(.active)) {
  color: v-bind("PALETTE.text");
}

.content {
  max-width: 960px;
  margin: 0 auto;
  padding: 10px 16px 20px;
}
</style>
