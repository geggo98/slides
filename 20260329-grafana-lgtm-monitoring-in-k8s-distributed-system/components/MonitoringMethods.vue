<script setup>
import { ref } from 'vue'
import MethodBox from './MethodBox.vue'
import DiagnosticFunnel from './DiagnosticFunnel.vue'
import ErrorsPerspective from './ErrorsPerspective.vue'

const activeTab = ref('overview')

const C = {
  bg: '#0a0d12',
  surface: '#111621',
  surfaceAlt: '#161c2a',
  border: '#1e2536',
  text: '#e2e8f0',
  muted: '#64748b',
  dim: '#3e4a63',
  blue: '#3b82f6',
  blueDim: 'rgba(59,130,246,0.12)',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.10)',
  yellow: '#eab308',
  yellowDim: 'rgba(234,179,8,0.10)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.10)',
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.10)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.10)',
  cyan: '#06b6d4',
}

const tabs = [
  { id: 'overview', label: '\u00DCberblick & Zusammenhang' },
  { id: 'praxis', label: 'Monitoring-Praxis' },
]

const redSignals = [
  {
    letter: 'R', name: 'Rate',
    desc: 'Requests pro Sekunde. Mathematisch die erste Ableitung (\u0394/\u0394t) eines monoton steigenden Counters.',
    detail: 'rate() in PromQL = (counter_now \u2212 counter_prev) / interval. Counter z\u00E4hlt nur hoch, rate() macht daraus eine Geschwindigkeit.',
    accent: C.blue, color: C.blueDim,
  },
  {
    letter: 'E', name: 'Errors',
    desc: 'Fehlgeschlagene Requests pro Sekunde. Aus User-Sicht: HTTP 5xx, Timeouts, Business-Logik-Fehler.',
    detail: 'Perspektive User: \u201EHat mein Request funktioniert?\u201C Nicht zu verwechseln mit USE-Errors (Infrastruktur-Fehler wie ECC, Packet-Drops).',
    accent: C.red, color: C.redDim,
  },
  {
    letter: 'D', name: 'Duration',
    desc: 'Latenz-Verteilung (p50, p95, p99). Steigt als Symptom von Saturation, aber auch durch langsame Dependencies oder schlechten Code.',
    detail: 'Kausalit\u00E4t: Saturation \u2192 Duration\u2191 (Warteschlangen). Aber: Duration\u2191 \u21CF immer Saturation. Auch Netzwerk, langsame DB-Queries, GC-Pausen.',
    accent: C.orange, color: C.orangeDim,
  },
]

const useSignals = [
  {
    letter: 'U', name: 'Utilization',
    desc: 'Prozentsatz der genutzten Kapazit\u00E4t. CPU-Zeit, Memory vs. Limit, Connection-Pool active/max.',
    detail: 'Gemessen als Durchschnitt \u00FCber ein Intervall. Achtung: 60% Durchschnitt kann Spitzen von 100% verstecken.',
    accent: C.orange, color: C.orangeDim,
  },
  {
    letter: 'S', name: 'Saturation',
    desc: 'Grad der Warteschlange. Arbeit, die auf Verarbeitung wartet: CPU-Runqueue, HikariCP-Pending, Disk-I/O-Queue.',
    detail: 'Warteschlangentheorie (M/M/1): Ab ~70\u201380% Utilization steigt Wartezeit \u00FCberproportional. Bei 90%: Response-Time = 10\u00D7 Service-Time.',
    accent: C.yellow, color: C.yellowDim,
  },
  {
    letter: 'E', name: 'Errors',
    desc: 'Infrastruktur-Fehler. ECC-Memory-Errors, Netzwerk-Packet-Drops, Disk-I/O-Errors, CRC-Fehler.',
    detail: 'Perspektive Maschine: \u201EIst die Hardware fehlerfrei?\u201C Nicht zu verwechseln mit RED-Errors (User-facing HTTP 5xx).',
    accent: C.red, color: C.redDim,
  },
]

const goldenSignals = [
  { letter: 'L', name: 'Latency', desc: '= RED Duration. Erfolgreiche und fehlerhafte Requests getrennt messen.', accent: C.orange, color: C.orangeDim },
  { letter: 'T', name: 'Traffic', desc: '= RED Rate. HTTP Requests/s, aber auch Domain-spezifisch: Quotes/s, Policen/s.', accent: C.blue, color: C.blueDim },
  { letter: 'E', name: 'Errors', desc: '= RED Errors. Explizite (5xx), implizite (200er mit falschem Inhalt), Policy-basiert (>1s = Fehler).', accent: C.red, color: C.redDim },
  { letter: 'S', name: 'Saturation', desc: 'Das Extra gegen\u00FCber RED. Misst, wie voll das System ist. Bester Fr\u00FChindikator vor User-Impact.', accent: C.purple, color: C.purpleDim },
]

const equationMapping = [
  { gs: 'Traffic', red: 'Rate', col: C.blue },
  { gs: 'Errors', red: 'Errors', col: C.red },
  { gs: 'Latency', red: 'Duration', col: C.orange },
  { gs: 'Saturation', red: '\u2014', col: C.purple },
]

const thresholds = [
  { res: 'CPU (Container)', warn: '70\u201380%', crit: '90%+', note: 'CFS-Throttling beachten, nicht nur Utilization' },
  { res: 'Memory (Container)', warn: '80%', crit: '90%+', note: 'container_memory_working_set_bytes, nicht usage_bytes' },
  { res: 'HikariCP Pool', warn: '80%', crit: '95%+', note: 'Pending > 0 ist bereits Saturation' },
  { res: 'Tomcat Threads', warn: '75%', crit: '90%+', note: 'Gepaart mit Upstream-Timeout-Check' },
  { res: 'Redis Memory', warn: '80%', crit: '95%+', note: 'Evictions = aktive S\u00E4ttigung' },
  { res: 'Disk I/O', warn: '70%', crit: '85%+', note: 'Queue-Depth > 1 = S\u00E4ttigung beginnt' },
]

const xyCharts = [
  {
    title: 'CPU vs. P99 Latenz (Saturation \u2192 Duration)',
    x: 'avg(rate(container_cpu_usage_seconds_total{pod=~"quote.*"}[5m]))',
    y: 'histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[5m])) by (le))',
    insight: 'Zeigt den Knickpunkt, ab dem CPU die Latenz \u00FCberproportional treibt. Hysterese sichtbar wenn Latenz nach Last-Reduktion nicht auf den gleichen Pfad zur\u00FCckkehrt.',
    color: C.orange,
  },
  {
    title: 'Request Rate vs. Error Rate (Traffic \u2192 Errors)',
    x: 'sum(rate(http_server_requests_seconds_count[5m]))',
    y: 'sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) / sum(rate(http_server_requests_seconds_count[5m]))',
    insight: 'Ab welcher Rate beginnen Errors? Gehen sie bei niedrigerer Rate auf Null zur\u00FCck, oder bleiben sie (Hysterese)?',
    color: C.red,
  },
  {
    title: 'Cache-Hit-Ratio vs. Upstream-Call-Rate',
    x: 'rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))',
    y: 'sum(rate(http_client_requests_seconds_count[5m]))',
    insight: 'Cache-Miss-Amplification: Hit-Ratio sinkt \u2192 Upstream-Rate steigt \u2192 Rate-Limiting \u2192 Feedback-Loop.',
    color: C.yellow,
  },
]

const provisioningYaml = `# Alert Rule Konfiguration
Condition: Threshold > 500   (P99 Latenz in ms)
Custom recovery threshold: < 200

# Oder via Provisioning YAML:
condition: C
data:
  - refId: A
    # ... PromQL Query ...
  - refId: C
    datasourceUid: __expr__
    model:
      type: threshold
      expression: A
      conditions:
        - evaluator:
            type: gt
            params: [0.5]   # 500ms
          unloadEvaluator:
            type: lt
            params: [0.2]   # 200ms Recovery`
</script>

<template>
  <div
    class="monitoring-methods"
    :style="{
      background: C.bg,
      color: C.text,
      height: '100%',
      fontFamily: `'DM Sans', 'Segoe UI', system-ui, sans-serif`,
      overflow: 'auto',
    }"
  >
    <div :style="{ maxWidth: '630px', margin: '0 auto', padding: '14px 14px 28px' }">
      <!-- Header -->
      <div :style="{ marginBottom: '14px' }">
        <div :style="{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }">
          <div
            :style="{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: C.yellow,
              boxShadow: `0 0 7px ${C.yellow}`,
            }"
          />
          <span
            :style="{
              fontSize: '7.7px',
              fontWeight: 700,
              color: C.yellow,
              textTransform: 'uppercase',
              letterSpacing: '1.4px',
              fontFamily: `'JetBrains Mono', monospace`,
            }"
          >Monitoring-Methodologie</span>
        </div>
        <h1 :style="{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '4px', margin: 0 }">
          Golden Signals &middot; RED &middot; USE
        </h1>
        <p :style="{ fontSize: '9px', color: C.muted, lineHeight: 1.5, maxWidth: '450px', margin: 0 }">
          Drei komplement&auml;re Methoden, ihre Zusammenh&auml;nge, und die Monitoring-Praxis: Schwellwerte, Hysterese-Alerting und Phasenraum-Diagnose.
        </p>
      </div>

      <!-- Tabs -->
      <div :style="{ display: 'flex', gap: '1px', marginBottom: '14px', borderBottom: `1px solid ${C.border}` }">
        <button
          v-for="t in tabs"
          :key="t.id"
          :style="{
            padding: '7px 13px',
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === t.id ? C.blue : 'transparent'}`,
            color: activeTab === t.id ? C.text : C.muted,
            fontSize: '9px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '-1px',
            transition: 'all 0.15s ease',
            fontFamily: 'inherit',
          }"
          @click="activeTab = t.id"
        >{{ t.label }}</button>
      </div>

      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="tab-content">
        <!-- The Big Equation -->
        <div
          :style="{
            background: C.surface,
            border: `1px solid ${C.yellow}20`,
            borderRadius: '7px',
            padding: '14px 17px',
            marginBottom: '14px',
            textAlign: 'center',
          }"
        >
          <div
            :style="{
              fontSize: '7.7px',
              fontWeight: 700,
              color: C.yellow,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px',
              fontFamily: `'JetBrains Mono', monospace`,
            }"
          >Die zentrale Gleichung</div>
          <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', flexWrap: 'wrap' }">
            <span
              :style="{
                fontSize: '13px',
                fontWeight: 800,
                color: C.yellow,
                padding: '4px 11px',
                borderRadius: '4px',
                background: C.yellowDim,
                border: `1px solid ${C.yellow}30`,
              }"
            >4 Golden Signals</span>
            <span :style="{ fontSize: '14px', color: C.dim, fontWeight: 300 }">=</span>
            <span
              :style="{
                fontSize: '13px',
                fontWeight: 800,
                color: C.red,
                padding: '4px 11px',
                borderRadius: '4px',
                background: C.redDim,
                border: `1px solid ${C.red}30`,
              }"
            >RED</span>
            <span :style="{ fontSize: '14px', color: C.dim, fontWeight: 300 }">+</span>
            <span
              :style="{
                fontSize: '13px',
                fontWeight: 800,
                color: C.purple,
                padding: '4px 11px',
                borderRadius: '4px',
                background: C.purpleDim,
                border: `1px solid ${C.purple}30`,
              }"
            >Saturation</span>
          </div>
          <div :style="{ fontSize: '7.7px', color: C.muted, marginTop: '7px', fontStyle: 'italic' }">
            &mdash; Tom Wilkie, Grafana Labs
          </div>

          <!-- Mapping -->
          <div :style="{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '11px', flexWrap: 'wrap' }">
            <div
              v-for="(m, i) in equationMapping"
              :key="i"
              :style="{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px',
                padding: '6px 10px',
                borderRadius: '4px',
                background: `${m.col}08`,
                border: `1px solid ${m.col}15`,
                minWidth: '63px',
              }"
            >
              <span :style="{ fontSize: '7px', color: C.yellow, fontWeight: 600, fontFamily: `'JetBrains Mono', monospace` }">{{ m.gs }}</span>
              <span :style="{ fontSize: '7px', color: C.dim }">&updownarrow;</span>
              <span :style="{ fontSize: '7px', color: m.red === '\u2014' ? C.dim : C.red, fontWeight: 600, fontFamily: `'JetBrains Mono', monospace` }">{{ m.red }}</span>
            </div>
          </div>
        </div>

        <!-- Three Method Boxes -->
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }">
          <!-- RED -->
          <MethodBox
            :color="C.red"
            :color-dim="C.redDim"
            title="RED-Methode"
            tag="SERVICE"
            description="Für jeden Microservice. Misst, was der User erlebt. Erzeugt konsistente, vergleichbare Dashboards."
            :signals="redSignals"
          >
            <div :style="{ marginTop: '8px', padding: '7px 8px', background: `${C.red}06`, borderRadius: '4px', border: `1px solid ${C.red}12` }">
              <div :style="{ fontSize: '7px', fontWeight: 700, color: C.red, marginBottom: '3px', fontFamily: `'JetBrains Mono', monospace` }">SCOPE</div>
              <div :style="{ fontSize: '7.7px', color: C.muted, lineHeight: 1.5 }">
                RED beantwortet: &lsquo;Sind meine User happy?&rsquo; Kein Blick auf Infrastruktur. Wenn alle RED-Signale gut sind, aber CPU bei 95% liegt, sieht RED das nicht &mdash; daf&uuml;r braucht man USE.
              </div>
            </div>
          </MethodBox>

          <!-- USE -->
          <MethodBox
            :color="C.purple"
            :color-dim="C.purpleDim"
            title="USE-Methode"
            tag="RESOURCE"
            description="Für jede Ressource (CPU, Memory, Disk, Network, Pools). Systematische Checkliste von Brendan Gregg. Erklärt das 'Warum'."
            :signals="useSignals"
          >
            <div :style="{ marginTop: '8px', padding: '7px 8px', background: `${C.purple}06`, borderRadius: '4px', border: `1px solid ${C.purple}12` }">
              <div :style="{ fontSize: '7px', fontWeight: 700, color: C.purple, marginBottom: '3px', fontFamily: `'JetBrains Mono', monospace` }">SCOPE</div>
              <div :style="{ fontSize: '7.7px', color: C.muted, lineHeight: 1.5 }">
                USE beantwortet: &bdquo;Ist die Infrastruktur der Engpass?&ldquo; Kein Blick auf User-Experience. Wenn CPU bei 20% liegt aber Error-Rate bei 30%, sieht USE kein Problem &mdash; daf&uuml;r braucht man RED.
              </div>
            </div>
          </MethodBox>

          <!-- Golden Signals -->
          <MethodBox
            :color="C.yellow"
            :color-dim="C.yellowDim"
            title="4 Golden Signals"
            tag="HYBRID"
            description="Google SRE Book. Vereint die User-Sicht (≈RED) mit Kapazitäts-Frühwarnung (Saturation). Für die kritischsten Service-Pfade."
            :signals="goldenSignals"
          >
            <div :style="{ marginTop: '8px', padding: '7px 8px', background: `${C.yellow}06`, borderRadius: '4px', border: `1px solid ${C.yellow}12` }">
              <div :style="{ fontSize: '7px', fontWeight: 700, color: C.yellow, marginBottom: '3px', fontFamily: `'JetBrains Mono', monospace` }">WANN STATT RED?</div>
              <div :style="{ fontSize: '7.7px', color: C.muted, lineHeight: 1.5 }">
                F&uuml;r die kritischen Pfade, wo Saturation als Fr&uuml;hwarnung den Unterschied macht: Quote-Vergleich, Policen-Abschluss, Zahlungs-Flow. RED f&uuml;r alle Services einheitlich, Golden Signals zus&auml;tzlich f&uuml;r die gesch&auml;ftskritischen.
              </div>
            </div>
          </MethodBox>
        </div>

        <!-- Errors: Two Perspectives -->
        <ErrorsPerspective />

        <div :style="{ height: '14px' }" />

        <!-- Diagnostic Funnel -->
        <DiagnosticFunnel />
      </div>

      <!-- Praxis Tab -->
      <div v-if="activeTab === 'praxis'" class="tab-content">
        <!-- Practical thresholds -->
        <div :style="{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '13px 14px', marginBottom: '11px' }">
          <div :style="{ fontSize: '10px', fontWeight: 800, color: C.text, marginBottom: '3px' }">
            Praxis-Schwellwerte (Kubernetes / Spring Boot)
          </div>
          <div :style="{ fontSize: '8.4px', color: C.muted, lineHeight: 1.6, marginBottom: '10px' }">
            Faustregel aus der Warteschlangentheorie (M/M/1): ab ~80% Utilization steigt die Wartezeit &uuml;berproportional. Bei 80%: 5x Service-Time, bei 90%: 10x. Details und interaktive Simulation im Systemdynamik-Simulator.
          </div>
          <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }">
            <div
              v-for="(r, i) in thresholds"
              :key="i"
              :style="{ padding: '7px 8px', borderRadius: '4px', background: C.surfaceAlt, border: `1px solid ${C.border}` }"
            >
              <div :style="{ fontSize: '8.4px', fontWeight: 700, color: C.text, marginBottom: '3px' }">{{ r.res }}</div>
              <div :style="{ display: 'flex', gap: '6px', marginBottom: '3px' }">
                <span
                  :style="{
                    fontSize: '7px',
                    fontWeight: 700,
                    color: C.orange,
                    fontFamily: `'JetBrains Mono', monospace`,
                    padding: '1px 4px',
                    borderRadius: '2px',
                    background: C.orangeDim,
                  }"
                >&#x26A0; {{ r.warn }}</span>
                <span
                  :style="{
                    fontSize: '7px',
                    fontWeight: 700,
                    color: C.red,
                    fontFamily: `'JetBrains Mono', monospace`,
                    padding: '1px 4px',
                    borderRadius: '2px',
                    background: C.redDim,
                  }"
                >&#x1F534; {{ r.crit }}</span>
              </div>
              <div :style="{ fontSize: '7px', color: C.muted, lineHeight: 1.4 }">{{ r.note }}</div>
            </div>
          </div>
        </div>

        <!-- Hysteresis alerting -->
        <div :style="{ background: C.surface, border: `1px solid ${C.yellow}20`, borderRadius: '7px', padding: '13px 14px', marginBottom: '11px' }">
          <div :style="{ fontSize: '10px', fontWeight: 800, color: C.text, marginBottom: '3px' }">
            Hysterese-Alerting: Recovery Threshold
          </div>
          <div :style="{ fontSize: '8.4px', color: C.muted, lineHeight: 1.6, marginBottom: '10px' }">
            Systeme kehren nach &Uuml;berlast nicht sofort in den Normalzustand zur&uuml;ck (Hysterese): leere Caches, volle Queues, fragmentierte JVM-Heaps brauchen Zeit zum Recovery. Naive Schwellwert-Alerts ignorieren das und erzeugen Flapping. Grafana hat seit Version 10.3 ein natives Feature daf&uuml;r.
          </div>
          <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '10px' }">
            <div :style="{ padding: '8px 10px', borderRadius: '6px', background: C.redDim, border: `1px solid ${C.red}20` }">
              <div :style="{ fontSize: '7.7px', fontWeight: 700, color: C.red, marginBottom: '3px' }">Naiver Alert (nur Schwelle)</div>
              <div :style="{ fontSize: '7.7px', color: C.muted, lineHeight: 1.5 }">
                &ldquo;P99 Latenz &gt; 500ms&rdquo; feuert beim Hinaufgehen und resolved beim Heruntergehen. Ignoriert, dass das System bei 500ms auf dem R&uuml;ckweg noch degradiert ist. Erzeugt Flapping wenn die Metrik um die Schwelle pendelt.
              </div>
            </div>
            <div :style="{ padding: '8px 10px', borderRadius: '6px', background: C.greenDim, border: `1px solid ${C.green}20` }">
              <div :style="{ fontSize: '7.7px', fontWeight: 700, color: C.green, marginBottom: '3px' }">Mit Recovery Threshold</div>
              <div :style="{ fontSize: '7.7px', color: C.muted, lineHeight: 1.5 }">
                Feuert bei P99 &gt; 500ms, resolved erst bei P99 &lt; 200ms. Asymmetrische Schwellen verhindern Flapping und stellen sicher, dass das System wirklich erholt ist bevor der Alert resolved.
              </div>
            </div>
          </div>
          <div :style="{ borderRadius: '6px', border: `1px solid ${C.green}20`, overflow: 'hidden' }">
            <div :style="{ padding: '8px 11px', background: `${C.green}06` }">
              <div :style="{ fontSize: '8.4px', fontWeight: 700, color: C.green, marginBottom: '3px' }">Grafana: Custom Recovery Threshold (GA seit 10.3)</div>
              <div :style="{ fontSize: '8.4px', color: C.text, lineHeight: 1.6 }">
                Alert Rule Editor &rarr; Threshold Expression &rarr; Toggle &ldquo;Custom recovery threshold&rdquo; &rarr; Wert eingeben. Der Alert wechselt in den Zustand &ldquo;Recovering&rdquo; und resolved erst, wenn der Recovery-Wert unterschritten wird. Zus&auml;tzlich: &ldquo;Keep firing for&rdquo; h&auml;lt den Alert f&uuml;r eine konfigurierbare Dauer aktiv nach Unterschreitung.
              </div>
            </div>
            <pre
              :style="{
                margin: 0,
                padding: '8px 11px',
                background: '#0d1117',
                fontSize: '7px',
                color: '#79c0ff',
                fontFamily: `'JetBrains Mono', monospace`,
                lineHeight: 1.6,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                borderTop: `1px solid ${C.border}`,
              }"
            >{{ provisioningYaml }}</pre>
          </div>
        </div>

        <!-- XY Chart for diagnosis -->
        <div :style="{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '13px 14px' }">
          <div :style="{ fontSize: '10px', fontWeight: 800, color: C.text, marginBottom: '3px' }">
            Phasenraum-Diagnose: XY Chart in Grafana
          </div>
          <div :style="{ fontSize: '8.4px', color: C.muted, lineHeight: 1.6, marginBottom: '10px' }">
            Statt zwei Metriken gegen die Zeit zu plotten, plottet man sie
            <strong :style="{ color: C.text }">gegeneinander</strong> (X-Y). Die Trajektorie zeigt die Hysterese-Schleife: der Hinweg (Last steigt) folgt einem anderen Pfad als der R&uuml;ckweg (Last sinkt). Nutze das
            <strong :style="{ color: C.text }">XY Chart Panel</strong> (ab Grafana 10+) f&uuml;r Post-Incident-Reviews.
          </div>
          <div :style="{ display: 'flex', flexDirection: 'column', gap: '6px' }">
            <div
              v-for="(item, i) in xyCharts"
              :key="i"
              :style="{ borderRadius: '6px', border: `1px solid ${item.color}20`, overflow: 'hidden' }"
            >
              <div :style="{ padding: '7px 10px', background: `${item.color}06` }">
                <div :style="{ fontSize: '8.4px', fontWeight: 700, color: item.color, marginBottom: '2px' }">{{ item.title }}</div>
                <div :style="{ fontSize: '7.7px', color: C.muted, lineHeight: 1.5 }">{{ item.insight }}</div>
              </div>
              <div :style="{ padding: '6px 10px', background: '#0d1117', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }">
                <div :style="{ flex: 1, minWidth: '100px' }">
                  <div :style="{ fontSize: '6.3px', color: C.blue, fontFamily: `'JetBrains Mono', monospace`, marginBottom: '1px' }">X-Achse:</div>
                  <pre :style="{ margin: 0, fontSize: '6.3px', color: '#79c0ff', fontFamily: `'JetBrains Mono', monospace`, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }">{{ item.x }}</pre>
                </div>
                <div :style="{ flex: 1, minWidth: '100px' }">
                  <div :style="{ fontSize: '6.3px', color: C.red, fontFamily: `'JetBrains Mono', monospace`, marginBottom: '1px' }">Y-Achse:</div>
                  <pre :style="{ margin: 0, fontSize: '6.3px', color: '#79c0ff', fontFamily: `'JetBrains Mono', monospace`, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }">{{ item.y }}</pre>
                </div>
              </div>
            </div>
          </div>
          <div :style="{ marginTop: '7px', padding: '7px 10px', background: `${C.green}06`, borderRadius: '4px', border: `1px solid ${C.green}15` }">
            <div :style="{ fontSize: '7.7px', fontWeight: 700, color: C.green, marginBottom: '2px', fontFamily: `'JetBrains Mono', monospace` }">PRAXIS-TIPP</div>
            <div :style="{ fontSize: '7.7px', color: C.text, lineHeight: 1.5 }">
              XY Charts sind prim&auml;r ein Diagnose-Tool f&uuml;r Post-Incident-Reviews. Zeitbereich auf die Incident-Dauer setzen, Trajektorie analysieren. Die Hysterese-Fl&auml;che quantifiziert den Recovery-Verlust. Kombination mit Annotations (Deployment, Restart) zeigt, welche Interventionen die Schleife brechen.
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
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.monitoring-methods {
  box-sizing: border-box;
}

.monitoring-methods *,
.monitoring-methods *::before,
.monitoring-methods *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.monitoring-methods ::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.monitoring-methods ::-webkit-scrollbar-track {
  background: transparent;
}

.monitoring-methods ::-webkit-scrollbar-thumb {
  background: #1e2536;
  border-radius: 2px;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}
</style>
