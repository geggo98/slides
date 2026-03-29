<script setup>
import { ref, computed } from 'vue'
import DashboardHierarchy from './DashboardHierarchy.vue'
import VizGuide from './VizGuide.vue'
import DashboardLinking from './DashboardLinking.vue'

const PALETTE = {
  bg: '#0b0e14',
  surface: '#131720',
  surfaceHover: '#1a1f2e',
  border: '#1e2536',
  borderActive: '#3b82f6',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#475569',
  accent: '#3b82f6',
  accentGlow: 'rgba(59,130,246,0.15)',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.15)',
  yellow: '#eab308',
  yellowDim: 'rgba(234,179,8,0.15)',
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.15)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.15)',
  cyan: '#06b6d4',
  cyanDim: 'rgba(6,182,212,0.15)',
}

const tab = ref('hierarchy')
const selectedViz = ref(null)

const tabs = [
  { id: 'hierarchy', label: 'Dashboard-Hierarchie' },
  { id: 'vizguide', label: 'Visualisierungs-Guide' },
  { id: 'linking', label: 'Linking & Runbooks' },
]

function switchToVizGuide(vizId) {
  selectedViz.value = vizId
  tab.value = 'vizguide'
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
        Vier Ebenen vom Platform-Overview zur Root-Cause-Analyse. Klick auf ein Level f&uuml;r das Layout, auf ein Panel f&uuml;r die Visualisierungs-Details.
      </p>

      <!-- Tabs -->
      <div class="tab-bar">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab-btn"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <div class="content">
      <DashboardHierarchy
        v-if="tab === 'hierarchy'"
        @select-viz="switchToVizGuide"
      />
      <VizGuide
        v-if="tab === 'vizguide'"
        :initialSelectedViz="selectedViz"
      />
      <DashboardLinking
        v-if="tab === 'linking'"
      />
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap');

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.grafana-root {
  background: v-bind('PALETTE.bg');
  color: v-bind('PALETTE.text');
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
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

.grafana-root ::-webkit-scrollbar { width: 4px; }
.grafana-root ::-webkit-scrollbar-track { background: transparent; }
.grafana-root ::-webkit-scrollbar-thumb { background: v-bind('PALETTE.border'); border-radius: 2px; }

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
  background: v-bind('PALETTE.accent');
  box-shadow: 0 0 8px v-bind('PALETTE.accent');
}

.header-label {
  font-size: 7px;
  font-weight: 700;
  color: v-bind('PALETTE.accent');
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-family: 'JetBrains Mono', monospace;
}

.header-title {
  font-size: 17px;
  font-weight: 800;
  color: v-bind('PALETTE.text');
  line-height: 1.2;
  margin-bottom: 3px;
  letter-spacing: -0.3px;
}

.header-desc {
  font-size: 8px;
  color: v-bind('PALETTE.textMuted');
  line-height: 1.4;
  max-width: 500px;
}

.tab-bar {
  display: flex;
  gap: 1px;
  margin-top: 10px;
  border-bottom: 1px solid v-bind('PALETTE.border');
}

.tab-btn {
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: v-bind('PALETTE.textMuted');
  font-size: 9px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: -1px;
  font-family: inherit;
}

.tab-btn.active {
  border-bottom-color: v-bind('PALETTE.accent');
  color: v-bind('PALETTE.text');
}

.tab-btn:hover:not(.active) {
  color: v-bind('PALETTE.text');
}

.content {
  max-width: 960px;
  margin: 0 auto;
  padding: 10px 16px 20px;
}
</style>
