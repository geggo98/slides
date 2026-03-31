<script setup>
import { ref, computed } from 'vue'
import { useDarkMode } from '@slidev/client'

const emit = defineEmits(['selectViz'])

const { isDark } = useDarkMode()

const DARK_PALETTE = {
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

const LIGHT_PALETTE = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceHover: '#f1f5f9',
  border: '#e2e8f0',
  borderActive: '#3b82f6',
  text: '#1e293b',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  accent: '#2563eb',
  accentGlow: 'rgba(37,99,235,0.12)',
  green: '#16a34a',
  greenDim: 'rgba(22,163,74,0.10)',
  yellow: '#ca8a04',
  yellowDim: 'rgba(202,138,4,0.10)',
  red: '#dc2626',
  redDim: 'rgba(220,38,38,0.10)',
  orange: '#ea580c',
  orangeDim: 'rgba(234,88,12,0.10)',
  purple: '#9333ea',
  purpleDim: 'rgba(147,51,234,0.10)',
  cyan: '#0891b2',
  cyanDim: 'rgba(8,145,178,0.10)',
}

const PALETTE = computed(() => isDark.value ? DARK_PALETTE : LIGHT_PALETTE)

const VIZ_TYPES = [
  { id: 'timeseries', name: 'Time Series', icon: '\u{1F4C8}' },
  { id: 'stat', name: 'Stat Panel', icon: '\u{1F522}' },
  { id: 'gauge', name: 'Gauge', icon: '\u23F1\uFE0F' },
  { id: 'heatmap', name: 'Heatmap', icon: '\u{1F7E7}' },
  { id: 'table', name: 'Table', icon: '\u{1F4CB}' },
  { id: 'logs', name: 'Logs Panel', icon: '\u{1F4DC}' },
  { id: 'traces', name: 'Traces Panel', icon: '\u{1F517}' },
  { id: 'statetimeline', name: 'State Timeline', icon: '\u{1F6A6}' },
  { id: 'alertlist', name: 'Alert List', icon: '\u{1F514}' },
  { id: 'text', name: 'Text Panel', icon: '\u{1F4DD}' },
  { id: 'dashlink', name: 'Dashboard Links', icon: '\u{1F500}' },
]

const LEVELS = [
  {
    id: 1, name: 'Platform Overview', tag: '[Platform] Overview',
    question: 'Werde ich gerade gepaged?', timeRange: '6\u201312h', refresh: '1\u20135 min',
    color: DARK_PALETTE.red, colorDim: DARK_PALETTE.redDim,
    description: 'SLO-Compliance \u00fcber alle Services, aggregierte RED-Metriken, Service-Map, Alert-Liste, State-Timeline f\u00fcr Verf\u00fcgbarkeit.',
    panels: [
      { type: 'text', label: 'Runbook + Eskalation', w: 4, h: 2, color: '#94a3b8' },
      { type: 'stat', label: 'SLO Status', w: 2, h: 2, color: DARK_PALETTE.green },
      { type: 'stat', label: 'Error Rate', w: 2, h: 2, color: DARK_PALETTE.red },
      { type: 'stat', label: 'Req/s', w: 2, h: 2, color: DARK_PALETTE.accent },
      { type: 'stat', label: 'Active Pods', w: 2, h: 2, color: DARK_PALETTE.cyan },
      { type: 'statetimeline', label: 'Service Availability', w: 8, h: 3, color: DARK_PALETTE.green },
      { type: 'alertlist', label: 'Active Alerts', w: 4, h: 3, color: DARK_PALETTE.red },
      { type: 'timeseries', label: 'Platform Request Rate', w: 6, h: 4, color: DARK_PALETTE.accent },
      { type: 'traces', label: 'Service Map (Tempo)', w: 6, h: 4, color: '#f472b6' },
    ],
    links: [
      { target: '[Service] Quote-API', vars: 'var-service=$service', type: 'drilldown' },
      { target: '[Infra] K8s Nodes', vars: 'var-cluster=$cluster', type: 'drilldown' },
    ],
  },
  {
    id: 2, name: 'Service Dashboard', tag: '[Service] Quote-API',
    question: 'Welcher Service hat das Problem?', timeRange: '1\u20133h', refresh: '30s',
    color: DARK_PALETTE.accent, colorDim: DARK_PALETTE.accentGlow,
    description: 'RED-Metriken f\u00fcr einen Service, Latenz-Perzentile, Heatmap, Top-N Endpoints, Upstream-Dependency-Health, korrelierte Logs.',
    panels: [
      { type: 'text', label: 'Service-Info + Runbook', w: 3, h: 2, color: '#94a3b8' },
      { type: 'stat', label: 'P99 Latenz', w: 3, h: 2, color: DARK_PALETTE.yellow },
      { type: 'stat', label: 'Error %', w: 3, h: 2, color: DARK_PALETTE.red },
      { type: 'stat', label: 'Req/s', w: 3, h: 2, color: DARK_PALETTE.accent },
      { type: 'timeseries', label: 'Latenz p50/p95/p99', w: 6, h: 4, color: DARK_PALETTE.accent },
      { type: 'timeseries', label: 'Error Rate by Status', w: 6, h: 4, color: DARK_PALETTE.red },
      { type: 'heatmap', label: 'Latenz-Verteilung (Histogram)', w: 12, h: 4, color: DARK_PALETTE.yellow },
      { type: 'table', label: 'Top-10 langsamste Endpoints', w: 6, h: 4, color: DARK_PALETTE.purple },
      { type: 'logs', label: 'Error Logs (Loki)', w: 6, h: 4, color: DARK_PALETTE.cyan },
    ],
    links: [
      { target: '[Pod] Instance Details', vars: 'var-pod=$pod&var-namespace=$namespace', type: 'drilldown' },
      { target: '[Platform] Overview', vars: '', type: 'back' },
      { target: 'Upstream Provider Status', vars: 'var-provider=$provider', type: 'drilldown' },
    ],
  },
  {
    id: 3, name: 'Pod / Instance', tag: '[Pod] Instance Details',
    question: 'Welcher Pod ist betroffen?', timeRange: '30min\u20131h', refresh: '15s',
    color: DARK_PALETTE.orange, colorDim: DARK_PALETTE.orangeDim,
    description: 'CPU/Memory vs. Limits, JVM-Metriken (Heap, GC), HikariCP Connection-Pool, Netzwerk-I/O, Container-Restarts.',
    panels: [
      { type: 'gauge', label: 'CPU %', w: 3, h: 2, color: DARK_PALETTE.orange },
      { type: 'gauge', label: 'Memory %', w: 3, h: 2, color: DARK_PALETTE.yellow },
      { type: 'gauge', label: 'Hikari Pool', w: 3, h: 2, color: DARK_PALETTE.purple },
      { type: 'gauge', label: 'JVM Heap', w: 3, h: 2, color: DARK_PALETTE.green },
      { type: 'timeseries', label: 'CPU: Request / Limit / Actual', w: 6, h: 4, color: DARK_PALETTE.orange },
      { type: 'timeseries', label: 'Memory: WSS / Limit', w: 6, h: 4, color: DARK_PALETTE.yellow },
      { type: 'timeseries', label: 'GC Pause Duration', w: 6, h: 4, color: DARK_PALETTE.red },
      { type: 'timeseries', label: 'HikariCP Active / Pending', w: 6, h: 4, color: DARK_PALETTE.purple },
      { type: 'table', label: 'Container Restarts', w: 6, h: 3, color: DARK_PALETTE.red },
      { type: 'logs', label: 'Pod Logs', w: 6, h: 3, color: DARK_PALETTE.cyan },
    ],
    links: [
      { target: '[Service] $service', vars: 'var-service=$service', type: 'back' },
      { target: '[Infra] K8s Nodes', vars: 'var-node=$node', type: 'drilldown' },
    ],
  },
  {
    id: 4, name: 'Infrastructure', tag: '[Infra] K8s Nodes',
    question: 'Ist die Infrastruktur der Engpass?', timeRange: '1\u20136h', refresh: '1 min',
    color: DARK_PALETTE.purple, colorDim: DARK_PALETTE.purpleDim,
    description: 'USE-Metriken auf Node-Level, Cluster-Ressourcen, PV-Usage, CoreDNS, Pod-Scheduling, CPU-Throttling cluster-weit.',
    panels: [
      { type: 'stat', label: 'Nodes', w: 2, h: 2, color: DARK_PALETTE.green },
      { type: 'stat', label: 'Pods Running', w: 2, h: 2, color: DARK_PALETTE.accent },
      { type: 'stat', label: 'Pending', w: 2, h: 2, color: DARK_PALETTE.yellow },
      { type: 'stat', label: 'OOMKilled', w: 2, h: 2, color: DARK_PALETTE.red },
      { type: 'stat', label: 'CFS Throttled', w: 2, h: 2, color: DARK_PALETTE.orange },
      { type: 'stat', label: 'Disk Pressure', w: 2, h: 2, color: DARK_PALETTE.purple },
      { type: 'timeseries', label: 'Node CPU Utilization', w: 6, h: 4, color: DARK_PALETTE.orange },
      { type: 'timeseries', label: 'Node Memory Utilization', w: 6, h: 4, color: DARK_PALETTE.yellow },
      { type: 'timeseries', label: 'Disk I/O (IOPS + Queue)', w: 6, h: 4, color: DARK_PALETTE.purple },
      { type: 'table', label: 'Node Resource Summary', w: 6, h: 4, color: DARK_PALETTE.cyan },
    ],
    links: [
      { target: '[Platform] Overview', vars: '', type: 'back' },
      { target: '[Pod] Instance Details', vars: 'var-pod=$pod', type: 'drilldown' },
    ],
  },
]

const METHOD_MAPPING = {
  1: { methods: ['RED'], note: 'Alle 3 Signale aggregiert: Rate, Errors, Durations. Saturation kommt meist erst auf der nächsten Detailstufe.' },
  2: { methods: ['RED', 'Golden Signals'], note: 'RED f\u00fcr jeden Service einheitlich. Saturation f\u00fcr kritische Pfade.' },
  3: { methods: ['USE'], note: 'Utilization, Saturation, Errors pro Ressource (CPU, Memory, Disk, Pool)' },
  4: { methods: ['USE'], note: 'USE auf Node-/Cluster-Level f\u00fcr Kapazit\u00e4tsplanung' },
}

const SIZING_REF = [
  { type: 'Stat Panel', size: '4\u20138 \u00d7 3\u20134', hint: 'KPI Header-Zeile' },
  { type: 'Time Series', size: '8\u201312 \u00d7 6\u20138', hint: '2\u20133 pro Reihe' },
  { type: 'Heatmap', size: '12\u201324 \u00d7 8\u201310', hint: 'breit f\u00fcr Bucket-Aufl\u00f6sung' },
  { type: 'Table', size: '12\u201324 \u00d7 8\u201310', hint: 'sortierbar, farbcodiert' },
  { type: 'Logs Panel', size: '24 \u00d7 8\u201312', hint: 'immer volle Breite' },
  { type: 'Gauge', size: '4\u20136 \u00d7 4\u20135', hint: 'f\u00fcr Utilization %' },
]

const activeLevel = ref(1)
const highlightType = ref(null)

const level = computed(() => LEVELS[activeLevel.value - 1])
const methodInfo = computed(() => METHOD_MAPPING[activeLevel.value])

function getVizInfo(typeId) {
  return VIZ_TYPES.find(v => v.id === typeId)
}

function getMethodColors(name) {
  const p = PALETTE.value
  const colors = {
    RED: { bg: p.redDim, fg: p.red, border: `${p.red}40` },
    'Golden Signals': { bg: p.yellowDim, fg: p.yellow, border: `${p.yellow}40` },
    USE: { bg: p.purpleDim, fg: p.purple, border: `${p.purple}40` },
  }
  return colors[name] || { bg: p.accentGlow, fg: p.accent, border: p.border }
}

function onPanelClick(type) {
  highlightType.value = type === highlightType.value ? null : type
  emit('selectViz', type)
}

function drillDown() {
  if (activeLevel.value < 4) {
    activeLevel.value++
    highlightType.value = null
  }
}

function selectLevel(id) {
  activeLevel.value = id
  highlightType.value = null
}

// Generate deterministic heatmap opacities
const heatmapCells = Array.from({ length: 30 }, (_, i) => {
  const seed = (i * 7 + 3) % 10
  return (seed * 0.08 + 0.15).toFixed(2)
})
</script>

<template>
  <div class="hierarchy-root">
    <div class="hierarchy-columns">
      <!-- Left: Level Selector + Sizing Ref -->
      <div class="hierarchy-sidebar">
        <div class="level-grid">
          <button
            v-for="l in LEVELS"
            :key="l.id"
            class="level-btn"
            :style="{
              background: activeLevel === l.id ? l.colorDim : PALETTE.surface,
              borderColor: activeLevel === l.id ? l.color : PALETTE.border,
            }"
            @click="selectLevel(l.id)"
          >
            <div class="level-tag" :style="{ color: l.color }">L{{ l.id }}</div>
            <div class="level-name" :style="{ color: activeLevel === l.id ? PALETTE.text : PALETTE.textMuted }">
              {{ l.name }}
            </div>
          </button>
        </div>

        <!-- Drill-Down Flow -->
        <div class="flow-bar">
          <template v-for="(l, i) in LEVELS" :key="l.id">
            <span
              class="flow-tag"
              :style="{
                color: activeLevel === l.id ? l.color : PALETTE.textDim,
                background: activeLevel === l.id ? l.colorDim : 'transparent',
                border: activeLevel === l.id ? `1px solid ${l.color}40` : '1px solid transparent',
              }"
            >{{ l.tag }}</span>
            <span v-if="i < LEVELS.length - 1" class="flow-arrow">&darr;</span>
          </template>
        </div>

        <!-- Grid sizing legend -->
        <div class="sizing-ref">
          <div class="sizing-title">24-Spalten-Grid &middot; Sizing</div>
          <div class="sizing-grid">
            <div v-for="s in SIZING_REF" :key="s.type" class="sizing-item">
              <span class="sizing-item-type">{{ s.type }}</span>
              <span class="sizing-item-size">{{ s.size }}</span>
            </div>
          </div>
          <div class="sizing-note">
            Max. 10&ndash;20 Panels. Collapsible Rows / Tabs f&uuml;r Gruppierung.
          </div>
        </div>
      </div>

      <!-- Right: Active Level Detail -->
      <div class="hierarchy-main">
        <div class="level-detail" :style="{ borderColor: `${level.color}30` }">
          <!-- Level Header -->
          <div class="level-header">
            <div class="level-header-left">
              <div class="level-header-title">
                <span :style="{ fontSize: '11px', fontWeight: 800, color: level.color }">Level {{ level.id }}</span>
                <span :style="{ fontSize: '9px', fontWeight: 700, color: PALETTE.text }">{{ level.name }}</span>
                <span class="range-info">{{ level.timeRange }} &middot; {{ level.refresh }}</span>
              </div>
              <div class="level-question">&bdquo;{{ level.question }}&ldquo;</div>
            </div>
            <div class="level-header-right">
              <div class="method-badges">
                <span
                  v-for="m in methodInfo.methods"
                  :key="m"
                  class="method-badge"
                  :style="{
                    background: getMethodColors(m).bg,
                    color: getMethodColors(m).fg,
                    borderColor: getMethodColors(m).border,
                  }"
                >{{ m }}</span>
              </div>
              <div class="method-note">{{ methodInfo.note }}</div>
            </div>
          </div>

          <!-- Mock Dashboard Grid -->
          <div class="panel-section">
            <div class="panel-grid">
              <button
                v-for="(p, i) in level.panels"
                :key="i"
                class="panel-mock"
                :style="{
                  gridColumn: `span ${p.w}`,
                  gridRow: `span ${p.h}`,
                  background: highlightType === p.type ? `${p.color}18` : `${p.color}08`,
                  borderColor: highlightType === p.type ? p.color : PALETTE.border,
                }"
                @click="onPanelClick(p.type)"
                @mouseenter="(e) => { e.currentTarget.style.background = `${p.color}20`; e.currentTarget.style.borderColor = p.color }"
                @mouseleave="(e) => { e.currentTarget.style.background = highlightType === p.type ? `${p.color}18` : `${p.color}08`; e.currentTarget.style.borderColor = highlightType === p.type ? p.color : PALETTE.border }"
              >
                <div class="panel-type-label">{{ getVizInfo(p.type)?.icon }} {{ getVizInfo(p.type)?.name }}</div>
                <div class="panel-name">{{ p.label }}</div>
                <!-- Mini visualizations for taller panels -->
                <div v-if="p.h >= 3" class="panel-mini">
                  <svg v-if="p.type === 'timeseries'" viewBox="0 0 100 30" class="mini-svg">
                    <polyline points="0,25 10,20 20,22 30,15 40,18 50,10 60,14 70,8 80,12 90,5 100,9" fill="none" :stroke="p.color" stroke-width="2" />
                  </svg>
                  <div v-if="p.type === 'stat'" class="mini-stat" :style="{ color: p.color }">99.7%</div>
                  <svg v-if="p.type === 'gauge'" viewBox="0 0 60 35" class="mini-gauge">
                    <path d="M5,30 A25,25 0 0,1 55,30" fill="none" :stroke="PALETTE.border" stroke-width="5" stroke-linecap="round" />
                    <path d="M5,30 A25,25 0 0,1 42,10" fill="none" :stroke="p.color" stroke-width="5" stroke-linecap="round" />
                  </svg>
                  <svg v-if="p.type === 'heatmap'" viewBox="0 0 100 30" class="mini-svg">
                    <rect v-for="(op, idx) in heatmapCells" :key="idx" :x="(idx % 10) * 10" :y="Math.floor(idx / 10) * 10" width="9" height="9" rx="1" :fill="p.color" :opacity="op" />
                  </svg>
                  <div v-if="p.type === 'table'" class="mini-table">
                    <div v-for="(o, i) in [0.9, 0.7, 0.5]" :key="i" class="mini-table-row" :style="{ background: p.color, opacity: o, width: `${90 - i * 20}%` }" />
                  </div>
                  <div v-if="p.type === 'logs'" class="mini-logs" :style="{ color: p.color }">
                    <span>ERROR NullPointerExc&hellip;</span>
                    <span style="opacity: 0.5">WARN timeout</span>
                  </div>
                  <div v-if="p.type === 'alertlist'" class="mini-alert">
                    <span class="mini-alert-dot" :style="{ background: p.color }" />
                    <span class="mini-alert-text" :style="{ color: p.color }">3 FIRING</span>
                  </div>
                  <div v-if="p.type === 'statetimeline'" class="mini-state">
                    <div v-for="(c, i) in [PALETTE.green, PALETTE.green, PALETTE.yellow, PALETTE.green, PALETTE.red, PALETTE.green, PALETTE.green]" :key="i" :style="{ flex: 1, background: c, opacity: 0.7 }" />
                  </div>
                  <div v-if="p.type === 'traces'" class="mini-traces">
                    <div v-for="(s, i) in [{ w: '100%', c: PALETTE.accent, ml: '0' }, { w: '60%', c: PALETTE.orange, ml: '10%' }, { w: '30%', c: PALETTE.purple, ml: '25%' }]" :key="i" :style="{ height: '3px', background: s.c, borderRadius: '2px', width: s.w, marginLeft: s.ml, opacity: 0.6 }" />
                  </div>
                  <div v-if="p.type === 'text'" class="mini-text-lines">
                    <div v-for="(o, i) in [0.7, 0.5, 0.3]" :key="i" :style="{ height: '2px', background: p.color || '#94a3b8', opacity: o, borderRadius: '1px', width: `${95 - i * 15}%` }" />
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Dashboard Links -->
          <div v-if="level.links && level.links.length > 0" class="links-section">
            <div class="links-title">Dashboard Links</div>
            <div class="links-wrap">
              <div
                v-for="(link, i) in level.links"
                :key="i"
                class="link-item"
                :style="{
                  background: link.type === 'back' ? 'rgba(148,163,184,0.08)' : 'rgba(56,189,248,0.08)',
                  borderColor: link.type === 'back' ? 'rgba(148,163,184,0.2)' : 'rgba(56,189,248,0.2)',
                }"
              >
                <span :style="{ fontSize: '7px', color: link.type === 'back' ? '#94a3b8' : '#38bdf8' }">
                  {{ link.type === 'back' ? '\u2190' : '\u2192' }}
                </span>
                <span class="link-target">{{ link.target }}</span>
                <span v-if="link.vars" class="link-vars">?{{ link.vars }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Drill-down hint -->
        <div v-if="activeLevel < 4" class="drilldown-hint">
          <button
            class="drilldown-btn"
            @click="drillDown"
            @mouseenter="(e) => { e.currentTarget.style.borderColor = LEVELS[activeLevel].color; e.currentTarget.style.color = LEVELS[activeLevel].color }"
            @mouseleave="(e) => { e.currentTarget.style.borderColor = PALETTE.border; e.currentTarget.style.color = PALETTE.textMuted }"
          >
            &darr; Drill-Down Level {{ activeLevel + 1 }}: {{ LEVELS[activeLevel].name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hierarchy-root {
  animation: fadeSlideIn 0.3s ease;
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.hierarchy-columns {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.hierarchy-sidebar {
  width: 150px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hierarchy-main {
  flex: 1;
  min-width: 0;
}

.level-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.level-btn {
  border: 1px solid;
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  outline: none;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 5px;
}

.level-tag {
  font-size: 7px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}

.level-name {
  font-size: 8px;
  font-weight: 700;
}

.flow-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.flow-tag {
  font-size: 6px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
}

.flow-arrow {
  color: v-bind('PALETTE.textDim');
  font-size: 7px;
  line-height: 1;
}

.level-detail {
  background: v-bind('PALETTE.surface');
  border: 1px solid;
  border-radius: 6px;
  overflow: hidden;
}

.level-header {
  padding: 6px 8px;
  border-bottom: 1px solid v-bind('PALETTE.border');
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.level-header-left {
  flex: 1;
  min-width: 0;
}

.level-header-title {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 1px;
}

.level-question {
  font-size: 7px;
  color: v-bind('PALETTE.textMuted');
  line-height: 1.3;
  font-style: italic;
}

.level-header-right {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
  flex-shrink: 0;
}

.method-badges {
  display: flex;
  gap: 3px;
}

.method-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 7px;
  font-weight: 700;
  border: 1px solid;
  letter-spacing: 0.3px;
}

.range-info {
  font-size: 6px;
  color: v-bind('PALETTE.textDim');
  font-family: 'JetBrains Mono', monospace;
}

.method-note {
  font-size: 6px;
  color: v-bind('PALETTE.textMuted');
  max-width: 180px;
  text-align: right;
  line-height: 1.3;
}

.panel-section {
  padding: 6px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 3px;
  grid-auto-rows: minmax(20px, auto);
}

.panel-mock {
  border: 1px solid;
  border-radius: 3px;
  padding: 3px 5px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s ease;
  text-align: left;
  outline: none;
  position: relative;
  overflow: hidden;
  min-height: 0;
  font-family: inherit;
}

.panel-type-label {
  font-size: 6px;
  color: v-bind('PALETTE.textMuted');
  font-weight: 500;
  letter-spacing: 0.2px;
}

.panel-name {
  font-size: 7px;
  color: v-bind('PALETTE.text');
  font-weight: 600;
  line-height: 1.2;
}

.panel-mini {
  margin-top: auto;
  padding-top: 3px;
  opacity: 0.4;
}

.mini-svg {
  width: 100%;
  height: 16px;
}

.mini-stat {
  font-size: 12px;
  font-weight: 800;
  font-family: monospace;
}

.mini-gauge {
  width: 34px;
  height: 20px;
}

.mini-table {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mini-table-row {
  height: 3px;
  border-radius: 1px;
}

.mini-logs {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-family: monospace;
  font-size: 5px;
}

.mini-alert {
  display: flex;
  gap: 3px;
  align-items: center;
}

.mini-alert-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  display: inline-block;
}

.mini-alert-text {
  font-size: 6px;
  font-weight: 600;
}

.mini-state {
  display: flex;
  gap: 1px;
  height: 5px;
  border-radius: 1px;
  overflow: hidden;
  width: 100%;
}

.mini-traces {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mini-text-lines {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mini-dashlink {
  display: flex;
  align-items: center;
  gap: 2px;
}

.links-section {
  padding: 4px 6px;
  border-top: 1px solid v-bind('PALETTE.border');
}

.links-title {
  font-size: 6px;
  font-weight: 700;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 3px;
  font-family: 'JetBrains Mono', monospace;
}

.links-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 3px;
  border: 1px solid;
}

.link-target {
  font-size: 7px;
  font-weight: 600;
  color: v-bind('PALETTE.text');
}

.link-vars {
  font-size: 5px;
  color: v-bind('PALETTE.textDim');
  font-family: 'JetBrains Mono', monospace;
  background: rgba(59,130,246,0.06);
  padding: 1px 3px;
  border-radius: 2px;
}

.drilldown-hint {
  text-align: center;
  margin-top: 4px;
}

.drilldown-btn {
  background: transparent;
  border: 1px solid v-bind('PALETTE.border');
  border-radius: 4px;
  padding: 2px 8px;
  color: v-bind('PALETTE.textMuted');
  font-size: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.sizing-ref {
  padding: 5px 6px;
  background: v-bind('PALETTE.surface');
  border-radius: 4px;
  border: 1px solid v-bind('PALETTE.border');
}

.sizing-title {
  font-size: 6px;
  font-weight: 700;
  color: v-bind('PALETTE.textDim');
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}

.sizing-grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sizing-item {
  display: flex;
  gap: 4px;
  align-items: baseline;
  padding: 1px 0;
}

.sizing-item-type {
  font-size: 6px;
  font-weight: 600;
  color: v-bind('PALETTE.text');
}

.sizing-item-size {
  font-size: 6px;
  color: v-bind('PALETTE.accent');
  font-family: 'JetBrains Mono', monospace;
}

.sizing-note {
  margin-top: 3px;
  font-size: 6px;
  color: v-bind('PALETTE.textDim');
  line-height: 1.3;
}
</style>
