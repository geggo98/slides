<script setup>
const PALETTE = {
  bg: '#0b0e14',
  surface: '#131720',
  surfaceHover: '#1a1f2e',
  border: '#1e2536',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#475569',
  accent: '#3b82f6',
  accentGlow: 'rgba(59,130,246,0.15)',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  purple: '#a855f7',
}

const LINK_MECHANISMS = [
  {
    title: 'Dashboard Links (Header-Navigation)',
    color: '#38bdf8',
    desc: 'Dashboard Settings > Links. Erscheinen als klickbare Links im Dashboard-Header. Variablen werden automatisch weitergegeben oder explizit via URL-Parameter.',
    code: `# Dashboard Settings > Links
Type: Dashboard
Dashboard: [Pod] Instance Details
Include current template variables: true

# Oder manuell:
d/pod-details/pod-instance
  ?var-namespace=$namespace
  &var-pod=$__series.labels.pod
  &from=$__from&to=$__to`,
    useCase: 'Globale Navigation: Overview -> Service -> Pod -> Infra',
  },
  {
    title: 'Data Links (Panel-Level)',
    color: PALETTE.accent,
    desc: 'Panel > Field Overrides > Data Links. Klick auf einen Datenpunkt oder eine Zeile in einem Panel springt zum Ziel-Dashboard mit Kontext.',
    code: `# Panel Edit > Overrides > Data links
Title: Drill-Down to Pod
URL: d/pod-details/pod-instance
  ?var-pod=\${__data.fields.pod}
  &var-namespace=\${__data.fields.namespace}
  &from=\${__from}&to=\${__to}

# Auf Time-Series: Klick auf Serie
URL: d/pod-details/pod-instance
  ?var-pod=\${__series.labels.pod}`,
    useCase: 'Klick auf Pod in Table -> Pod-Dashboard. Klick auf Latenz-Serie -> Instance-Detail.',
  },
  {
    title: 'Externe Links (Runbooks, Wiki)',
    color: PALETTE.green,
    desc: 'Dashboard Links oder Data Links mit externer URL. Verweisen auf Runbooks, Confluence, PagerDuty oder Git-Repos. Template-Variablen funktionieren auch in externen URLs.',
    code: `# Dashboard Settings > Links
Type: Link
URL: https://wiki.internal/runbooks/\${service}
Title: Runbook: $service
Icon: doc
Open in new tab: true

# Oder im Text Panel (Markdown):
## Runbook
- [Incident-Response](https://wiki/runbooks/quote-api)
- [Eskalation](https://pagerduty.com/services/$service)`,
    useCase: 'On-Call-Kontext: Runbook direkt aus dem Dashboard, wo das Problem sichtbar ist.',
  },
]

const DRILL_DOWN_MAP = [
  { from: 'Platform Overview', to: 'Service Dashboard', trigger: 'Klick auf Service in State-Timeline oder Service-Map', vars: 'var-service, var-namespace', method: 'Golden Signals \u2192 RED', color: PALETTE.red },
  { from: 'Service (RED)', to: 'Pod / Instance (USE)', trigger: 'Data Link auf Latenz-Serie oder Pod-Name in Table', vars: 'var-pod, var-namespace, var-service', method: 'RED Duration \u2192 USE Utilization', color: PALETTE.orange },
  { from: 'Service (RED)', to: 'Upstream Provider Detail', trigger: 'Data Link auf Provider-Name in Error-Table', vars: 'var-provider', method: 'RED Errors \u2192 Provider-Analyse', color: PALETTE.yellow },
  { from: 'Pod / Instance (USE)', to: 'Infrastructure / Nodes', trigger: 'Dashboard Link oder Klick auf Node-Name', vars: 'var-node, var-cluster', method: 'USE (Pod) \u2192 USE (Node)', color: PALETTE.purple },
  { from: 'Any Dashboard', to: 'Tempo Trace View', trigger: 'Exemplar-Diamond auf Time-Series-Graph', vars: 'traceID (via Exemplar)', method: 'Metrik \u2192 Trace \u2192 Logs', color: '#f472b6' },
]

const TEXT_PANEL_EXAMPLES = [
  {
    title: 'Service-Runbook-Header',
    level: 'Level 2 \u2013 Service',
    content: `## quote-service
Owner: Team KFZ-IF
[Runbook](https://wiki/runbooks/quote-api)
[PagerDuty](https://pd/services/quote)

SLO: p99 < 500ms, Error < 0.5%`,
    tip: 'Erste Zeile im Dashboard. Collapsible Row, default eingeklappt.',
    color: PALETTE.accent,
  },
  {
    title: 'Architektur-Kontext',
    level: 'Level 1 \u2013 Platform',
    content: '```mermaid\ngraph LR\n  FE[Frontend] --> BFF\n  BFF --> QuoteAPI\n  QuoteAPI --> Provider-A\n  QuoteAPI --> Provider-B\n  QuoteAPI --> Redis\n```',
    tip: 'Mermaid-Diagramme rendern ab Grafana 10+ nativ im Text Panel.',
    color: PALETTE.green,
  },
  {
    title: 'Eskalations-Matrix',
    level: 'Level 2 \u2013 Service',
    content: `| Severity | Aktion |
|----------|--------|
| Warning  | Slack #kfzif-alerts |
| Critical | PagerDuty + TL |
| P1       | War Room + Mgmt |`,
    tip: 'Markdown-Tabellen. Direkt neben dem Alert-List-Panel platzieren.',
    color: PALETTE.red,
  },
  {
    title: 'Variablen-Kontext',
    level: 'Level 3 \u2013 Pod',
    content: `Aktuell: **$pod** in **$namespace**

[Service-Dashboard](
  d/svc/service?var-service=$service
)

Template-Variablen ($pod,
$namespace) rendern dynamisch.`,
    tip: '$-Variablen funktionieren auch in Text Panels und Links darin.',
    color: PALETTE.purple,
  },
]

const URL_PARAMS = [
  { param: 'var-namespace=$namespace', desc: 'Template-Variable namespace setzen' },
  { param: 'var-service=${__data.fields.service}', desc: 'Aus Table Data Link: Feldwert' },
  { param: 'var-pod=${__series.labels.pod}', desc: 'Aus Time-Series Data Link: Label' },
  { param: 'from=$__from&to=$__to', desc: 'Aktuellen Zeitbereich weitergeben' },
  { param: 'var-provider=${__value.text}', desc: 'Aus Table: Zellenwert als Variable' },
  { param: 'orgId=1&refresh=30s', desc: 'Org-ID und Refresh-Rate mitgeben' },
]
</script>

<template>
  <div class="linking-root">
    <!-- Linking patterns overview -->
    <div class="mechanisms-section">
      <div class="mechanisms-title">Dashboard-Linking: Drei Mechanismen</div>
      <div class="mechanisms-desc">
        Grafana bietet drei Wege, Dashboards zu vernetzen. Zusammen erzeugen sie einen navigierbaren Drill-Down-Pfad von der Anomalie-Erkennung (Golden Signals / RED) zur Root-Cause-Analyse (USE).
      </div>
      <div class="mechanisms-list">
        <div v-for="(item, i) in LINK_MECHANISMS" :key="i" class="mechanism-item" :style="{ borderColor: `${item.color}20` }">
          <div class="mechanism-top" :style="{ background: `${item.color}06` }">
            <div class="mechanism-header">
              <div class="mechanism-bar" :style="{ background: item.color }" />
              <span class="mechanism-name" :style="{ color: item.color }">{{ item.title }}</span>
            </div>
            <div class="mechanism-desc">{{ item.desc }}</div>
            <div class="mechanism-usecase">Einsatz: {{ item.useCase }}</div>
          </div>
          <pre class="mechanism-code">{{ item.code }}</pre>
        </div>
      </div>
    </div>

    <!-- Drill-Down Navigation Map -->
    <div class="drilldown-section">
      <div class="drilldown-title">Drill-Down-Karte: RED / Golden Signals &rarr; USE</div>
      <div class="drilldown-desc">
        Die Verlinkung folgt dem diagnostischen Trichter: Anomalie auf Service-Level erkennen (RED/Golden), dann zur Ressourcen-Ebene navigieren (USE), um die Root Cause zu finden.
      </div>
      <div class="drilldown-list">
        <div
          v-for="(link, i) in DRILL_DOWN_MAP"
          :key="i"
          class="dd-item"
          :style="{ background: `${link.color}06`, borderColor: `${link.color}12` }"
        >
          <div class="dd-flow">
            <span class="dd-from">{{ link.from }}</span>
            <span class="dd-arrow" :style="{ color: link.color }">&rarr;</span>
            <span class="dd-to" :style="{ color: link.color }">{{ link.to }}</span>
          </div>
          <div class="dd-trigger">{{ link.trigger }}</div>
          <div class="dd-badges">
            <span class="dd-vars">{{ link.vars }}</span>
            <span class="dd-method" :style="{ background: `${link.color}15`, color: link.color }">{{ link.method }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Text Panel Best Practices -->
    <div class="textpanel-section">
      <div class="textpanel-title">Text Panels: Was und wo</div>
      <div class="textpanel-grid">
        <div v-for="(item, i) in TEXT_PANEL_EXAMPLES" :key="i" class="tp-item" :style="{ borderColor: `${item.color}20` }">
          <div class="tp-header" :style="{ background: `${item.color}06` }">
            <div class="tp-name" :style="{ color: item.color }">{{ item.title }}</div>
            <div class="tp-level">{{ item.level }}</div>
          </div>
          <pre class="tp-code">{{ item.content }}</pre>
          <div class="tp-tip">{{ item.tip }}</div>
        </div>
      </div>
    </div>

    <!-- URL Parameter Reference -->
    <div class="urlref-section">
      <div class="urlref-title">URL-Parameter-Referenz</div>
      <div class="urlref-grid">
        <div v-for="(p, i) in URL_PARAMS" :key="i" class="urlref-item">
          <code class="urlref-param">{{ p.param }}</code>
          <div class="urlref-desc">{{ p.desc }}</div>
        </div>
      </div>
      <div class="urlref-tip">
        <div class="urlref-tip-label">PRAXIS-TIPP</div>
        <div class="urlref-tip-text">
          Checkbox 'Include current template variables' in Dashboard Links aktivieren: Alle aktuell gesetzten Variablen (namespace, cluster, service) werden automatisch an das Ziel-Dashboard weitergegeben, ohne sie manuell in die URL zu schreiben. Funktioniert nur, wenn das Ziel-Dashboard gleichnamige Variablen hat.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.linking-root {
  animation: fadeSlideIn 0.3s ease;
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mechanisms Section */
.mechanisms-section {
  background: v-bind('PALETTE.surface');
  border: 1px solid rgba(56,189,248,0.12);
  border-radius: 7px;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.mechanisms-title {
  font-size: 10px;
  font-weight: 800;
  color: v-bind('PALETTE.text');
  margin-bottom: 3px;
}

.mechanisms-desc {
  font-size: 8px;
  color: v-bind('PALETTE.textMuted');
  line-height: 1.4;
  margin-bottom: 10px;
}

.mechanisms-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.mechanism-item {
  border-radius: 5px;
  border: 1px solid;
  overflow: hidden;
}

.mechanism-top {
  padding: 8px 10px;
}

.mechanism-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
}

.mechanism-bar {
  width: 3px;
  height: 13px;
  border-radius: 1px;
}

.mechanism-name {
  font-size: 9px;
  font-weight: 700;
}

.mechanism-desc {
  font-size: 8px;
  color: v-bind('PALETTE.text');
  line-height: 1.4;
  margin-bottom: 3px;
}

.mechanism-usecase {
  font-size: 7px;
  color: v-bind('PALETTE.textMuted');
  font-style: italic;
}

.mechanism-code {
  margin: 0;
  padding: 8px 10px;
  background: #0d1117;
  font-size: 7px;
  color: #79c0ff;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  border-top: 1px solid v-bind('PALETTE.border');
}

/* Drill-Down Section */
.drilldown-section {
  background: v-bind('PALETTE.surface');
  border: 1px solid v-bind('PALETTE.border');
  border-radius: 7px;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.drilldown-title {
  font-size: 8px;
  font-weight: 700;
  color: v-bind('PALETTE.text');
  margin-bottom: 8px;
}

.drilldown-desc {
  font-size: 8px;
  color: v-bind('PALETTE.textMuted');
  line-height: 1.4;
  margin-bottom: 10px;
}

.drilldown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dd-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid;
}

.dd-flow {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}

.dd-from {
  font-size: 7px;
  font-weight: 700;
  color: v-bind('PALETTE.text');
}

.dd-arrow {
  font-size: 7px;
}

.dd-to {
  font-size: 7px;
  font-weight: 700;
}

.dd-trigger {
  font-size: 7px;
  color: v-bind('PALETTE.textMuted');
  margin-bottom: 2px;
}

.dd-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.dd-vars {
  font-size: 6px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(59,130,246,0.06);
  color: v-bind('PALETTE.accent');
  font-family: 'JetBrains Mono', monospace;
}

.dd-method {
  font-size: 6px;
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 600;
}

/* Text Panel Section */
.textpanel-section {
  background: v-bind('PALETTE.surface');
  border: 1px solid v-bind('PALETTE.border');
  border-radius: 7px;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.textpanel-title {
  font-size: 8px;
  font-weight: 700;
  color: v-bind('PALETTE.text');
  margin-bottom: 8px;
}

.textpanel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
}

.tp-item {
  border-radius: 5px;
  border: 1px solid;
  overflow: hidden;
}

.tp-header {
  padding: 6px 9px;
}

.tp-name {
  font-size: 8px;
  font-weight: 700;
  margin-bottom: 1px;
}

.tp-level {
  font-size: 7px;
  color: v-bind('PALETTE.textDim');
}

.tp-code {
  margin: 0;
  padding: 6px 9px;
  background: #0d1117;
  font-size: 7px;
  color: #adbac7;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.tp-tip {
  padding: 5px 9px;
  font-size: 7px;
  color: v-bind('PALETTE.textMuted');
  line-height: 1.3;
  border-top: 1px solid v-bind('PALETTE.border');
}

/* URL Reference Section */
.urlref-section {
  background: v-bind('PALETTE.surface');
  border: 1px solid v-bind('PALETTE.border');
  border-radius: 7px;
  padding: 12px 14px;
}

.urlref-title {
  font-size: 8px;
  font-weight: 700;
  color: v-bind('PALETTE.text');
  margin-bottom: 6px;
}

.urlref-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 5px;
}

.urlref-item {
  padding: 5px 8px;
  border-radius: 4px;
  background: rgba(59,130,246,0.03);
  border: 1px solid v-bind('PALETTE.border');
}

.urlref-param {
  font-size: 7px;
  color: v-bind('PALETTE.accent');
  font-family: 'JetBrains Mono', monospace;
  word-break: break-all;
}

.urlref-desc {
  font-size: 7px;
  color: v-bind('PALETTE.textMuted');
  margin-top: 2px;
}

.urlref-tip {
  margin-top: 8px;
  padding: 6px 9px;
  background: rgba(34,197,94,0.03);
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.08);
}

.urlref-tip-label {
  font-size: 7px;
  font-weight: 700;
  color: v-bind('PALETTE.green');
  margin-bottom: 2px;
  font-family: 'JetBrains Mono', monospace;
}

.urlref-tip-text {
  font-size: 8px;
  color: v-bind('PALETTE.text');
  line-height: 1.4;
}
</style>
