<script setup>
import { ref, computed } from 'vue'

const activeTab = ref('size')
const downloadScale = ref('linear')

const tabs = [
  { id: 'size', label: 'Größe' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'malware', label: 'Malware' },
  { id: 'security', label: 'Security' },
  { id: 'timeline', label: 'Timeline' },
]

function fmt(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1).replace('.', ',') + ' Bio.'
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' Mrd.'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' Mio.'
  if (n >= 1e3) return Math.round(n / 1e3).toLocaleString('de-DE') + 'K'
  return n.toLocaleString('de-DE')
}

function pct(value, max) {
  return Math.max(2, (value / max) * 100)
}

// --- Section 1: Repository Size ---
const sizeData = [
  { name: 'Maven Central', components: 808600, releases: 24950000, cls: 'maven' },
  { name: 'npm', components: 5590000, releases: 65560000, cls: 'npm' },
  { name: 'PyPI', components: 821300, releases: 8850000, cls: 'pypi' },
  { name: 'Go Modules*', components: 1250000, releases: 16700000, cls: 'go' },
]
const maxComp = Math.max(...sizeData.map(d => d.components))
const maxRel = Math.max(...sizeData.map(d => d.releases))

// --- Section 2: Downloads ---
const dlData = [
  { name: 'Maven Central', value: 839.05e9, growth: '+19,42 %', cls: 'maven' },
  { name: 'npm', value: 7970e9, growth: '+65,43 %', cls: 'npm' },
  { name: '  ↳ davon Axios', value: 5200e9, growth: '~100 Mio./Woche', cls: 'npm', indent: true },
  { name: 'PyPI', value: 804.97e9, growth: '+50,64 %', cls: 'pypi' },
  { name: 'Go Modules*', value: null, growth: 'k.\u00A0A.', cls: 'go' },
]
const dlMaxVal = computed(() => {
  const vals = dlData.filter(d => d.value).map(d =>
    downloadScale.value === 'log' ? Math.log10(d.value) : d.value
  )
  return Math.max(...vals)
})
function dlWidth(d) {
  if (!d.value) return 0
  const v = downloadScale.value === 'log' ? Math.log10(d.value) : d.value
  return Math.max(2, (v / dlMaxVal.value) * 100)
}

// --- Section 3: Malware ---
const malwareTotal = 454648
const malwareData = [
  { name: 'npm', value: 449955, cls: 'npm' },
  { name: 'PyPI', value: 3500, cls: 'pypi' },
  { name: 'Maven Central', value: 800, cls: 'maven' },
  { name: 'Sonstige', value: 393, cls: 'go' },
]
const malwareScale = ref('linear')
const malMaxVal = computed(() => {
  const vals = malwareData.map(d => malwareScale.value === 'log' ? Math.log10(d.value) : d.value)
  return Math.max(...vals)
})
function malWidth(d) {
  const v = malwareScale.value === 'log' ? Math.log10(d.value) : d.value
  return Math.max(2, (v / malMaxVal.value) * 100)
}
function malPct(v) { return ((v / malwareTotal) * 100).toFixed(2).replace('.', ',') }

// --- Section 4: Security Matrix ---
const secRows = [
  { m: 'Namespace-Verifikation', maven: ['✓ DNS TXT / GitHub', 'good'], npm: ['✗ flach, frei', 'bad'], go: ['~ via Git-Repo', 'warn'] },
  { m: 'Signatur-Pflicht (Publish)', maven: ['✓ PGP verpflichtend', 'good'], npm: ['✗ keine', 'bad'], go: ['~ Git-Commit-Sig', 'warn'] },
  { m: 'Signatur-Verif. downstream', maven: ['~ opt-in (Gradle)', 'warn'], npm: ['✗ keine', 'bad'], go: ['✓ Checksum-DB', 'good'] },
  { m: 'Code-Exec beim Install', maven: ['✓ keine', 'good'], npm: ['✗ pre/postinstall', 'bad'], go: ['✓ keine', 'good'] },
  { m: 'Code-Exec beim Build²', maven: ['✗ Plugins, Ann.-Proc.', 'bad'], npm: ['✗ Build-Tools, Tests', 'bad'], go: ['~ nur test/generate', 'warn'] },
  { m: 'Immutabilität (Publisher)', maven: ['✓ absolut\u00B9', 'good'], npm: ['~ 72h Unpublish', 'warn'], go: ['✓ Proxy-Cache', 'good'] },
  { m: 'Security-Removal (Operator)', maven: ['~ informell', 'warn'], npm: ['~ aktiv, schnell', 'warn'], go: ['~ Proxy blocken', 'warn'] },
  { m: 'Sigstore-Integration', maven: ['~ opt. seit 01/25', 'warn'], npm: ['~ Provenance', 'warn'], go: ['✗ keine', 'bad'] },
  { m: 'Hierarchische Namespaces', maven: ['✓ Reverse-Domain', 'good'], npm: ['~ @scope opt.', 'warn'], go: ['✓ Git-URL', 'good'] },
]

// --- Section 5: Timeline ---
const events = [
  { date: 'Nov 2018', title: 'event-stream', eco: 'npm', desc: 'Maintainer-Übergabe an Angreifer. Bitcoin-Wallet-Targeting.' },
  { date: 'Jan 2021', title: 'Jenkins-Brandjacking', eco: 'maven', desc: '846 Downloads in 10 Tagen. Sonatype entfernte sie.' },
  { date: 'Okt 2021', title: 'ua-parser-js', eco: 'npm', desc: 'Account-Hijack. 7 Mio. Weekly Downloads.' },
  { date: 'Dez 2021', title: 'Log4Shell', eco: 'maven', desc: 'CVSS 10.0. ~17.000 Pakete (4 % von Maven Central).' },
  { date: 'Jan 2022', title: 'colors / faker', eco: 'npm', desc: 'Maintainer-Sabotage. 20M+ Weekly Downloads.' },
  { date: 'Jan 2024', title: 'MavenGate', eco: 'maven', desc: '18 % der groupId-Domains abgelaufen/kaufbar.' },
  { date: 'Feb 2025', title: 'BoltDB-Typosquat', eco: 'go', desc: '3 Jahre unentdeckt. Proxy-Cache als Persistenz.' },
  { date: 'Mai 2025', title: 'Disk-Wiper Module', eco: 'go', desc: 'Erste destruktive Go-Modules in freier Wildbahn.' },
  { date: 'Sep 2025', title: 'Shai-Hulud v1', eco: 'npm', desc: 'Erster npm-Wurm. 2,6 Mrd. Weekly Downloads. CISA-Alert.' },
  { date: 'Nov 2025', title: 'Shai-Hulud v2 → Maven', eco: 'both', desc: 'mvnpm-Bridge spiegelte Malware nach Maven Central.' },
  { date: 'Mär 2026', title: 'Axios', eco: 'npm', desc: '40M+ Weekly Downloads. Lazarus-Gruppe (Nordkorea).' },
]
const evLeft = events.slice(0, 6)
const evRight = events.slice(6)

function ecoLabel(eco) {
  return { npm: 'npm', maven: 'Maven', go: 'Go', both: 'npm + Maven' }[eco]
}
</script>

<template>
  <GradleVars>
    <div class="infographic">
      <div class="info-header">
        <h2 class="info-title">Maven Central vs. npm vs. Go</h2>
        <p class="info-subtitle">Größe, Downloads und Security-Lage im Vergleich</p>
      </div>

      <div class="info-tabs">
        <button
          v-for="t in tabs" :key="t.id"
          class="info-tab" :class="{ active: activeTab === t.id }"
          @click.stop="activeTab = t.id"
        >{{ t.label }}</button>
      </div>

      <div class="info-content">
        <!-- Tab 1: Größe -->
        <div v-if="activeTab === 'size'" class="tab-panel">
          <p class="desc">Unique Components (groupId:artifactId bzw. Package-Name) und Releases je Ökosystem. Go-Zahlen sind Schätzungen.</p>
          <div class="size-sections">
            <div class="size-section">
              <div class="size-heading">Components (unique)</div>
              <div v-for="d in sizeData" :key="d.name + 'c'" class="bar-row">
                <div class="bar-name">{{ d.name }}</div>
                <div class="bar-track">
                  <div class="bar" :class="d.cls" :style="{ width: pct(d.components, maxComp) + '%' }"></div>
                </div>
                <div class="bar-val">{{ fmt(d.components) }}</div>
              </div>
            </div>
            <div class="size-section">
              <div class="size-heading">Releases (mit Version)</div>
              <div v-for="d in sizeData" :key="d.name + 'r'" class="bar-row">
                <div class="bar-name">{{ d.name }}</div>
                <div class="bar-track">
                  <div class="bar bar-light" :class="d.cls" :style="{ width: pct(d.releases, maxRel) + '%' }"></div>
                </div>
                <div class="bar-val">{{ fmt(d.releases) }}</div>
              </div>
            </div>
          </div>
          <p class="note">Go: keine offiziellen Aggregat-Statistiken. Letzte belastbare Zahl: ~16,7 Mio. Module-Versionen (März 2023).</p>
        </div>

        <!-- Tab 2: Downloads -->
        <div v-if="activeTab === 'downloads'" class="tab-panel">
          <p class="desc">Jährliche Download-Volumina 2025. npm-Zahlen teils durch Spam-Kampagnen aufgebläht.</p>
          <div class="dl-controls">
            <button class="scale-btn" :class="{ active: downloadScale === 'linear' }" @click.stop="downloadScale = 'linear'">Linear</button>
            <button class="scale-btn" :class="{ active: downloadScale === 'log' }" @click.stop="downloadScale = 'log'">Logarithmisch</button>
          </div>
          <div class="dl-bars">
            <div v-for="d in dlData" :key="d.name" class="bar-row" :class="{ 'indent-row': d.indent }">
              <div class="bar-name" :class="{ 'indent-name': d.indent }">{{ d.name }}</div>
              <div class="bar-track">
                <template v-if="d.value">
                  <div class="bar" :class="d.cls" :style="{ width: dlWidth(d) + '%' }"></div>
                </template>
              </div>
              <div class="bar-val" :class="{ na: !d.value }">
                <template v-if="d.value">{{ fmt(d.value) }} <span class="growth">{{ d.growth }}</span></template>
                <template v-else>keine offiziellen Statistiken</template>
              </div>
            </div>
          </div>
          <p class="note">Maven Central: Wachstum von ~36 % auf 19,42 % verlangsamt (bewusste Sustainability-Maßnahmen). 86 % des Traffics von Cloud-Providern.</p>
        </div>

        <!-- Tab 3: Malware -->
        <div v-if="activeTab === 'malware'" class="tab-panel">
          <div class="malware-header">
            <div class="malware-big">{{ malwareTotal.toLocaleString('de-DE') }}</div>
            <div class="malware-label">neue Malware-Pakete 2025</div>
          </div>
          <div class="dl-controls">
            <button class="scale-btn" :class="{ active: malwareScale === 'linear' }" @click.stop="malwareScale = 'linear'">Linear</button>
            <button class="scale-btn" :class="{ active: malwareScale === 'log' }" @click.stop="malwareScale = 'log'">Logarithmisch</button>
          </div>
          <div class="malware-bars">
            <div v-for="d in malwareData" :key="d.name" class="malware-row">
              <div class="bar-name">{{ d.name }}</div>
              <div class="bar-track malware-track">
                <div class="bar" :class="d.cls" :style="{ width: malWidth(d) + '%' }"></div>
              </div>
              <div class="malware-stats">
                <span class="malware-count">{{ d.value.toLocaleString('de-DE') }}</span>
                <span class="malware-pct">{{ malPct(d.value) }} %</span>
              </div>
            </div>
          </div>
          <p class="note">Quelle: Sonatype SSC Report 2026. Kumulativ seit 2019: über 1,23 Mio. Malware-Pakete entdeckt. Die Ungleichverteilung ist strukturell bedingt — siehe Security-Tab.</p>
        </div>

        <!-- Tab 4: Security Matrix -->
        <div v-if="activeTab === 'security'" class="tab-panel">
          <p class="desc">Strukturelle Designentscheidungen. Diese Matrix erklärt, warum 99 % der Malware auf npm landet.</p>
          <table class="sec-table">
            <thead>
              <tr>
                <th>Mechanismus</th>
                <th class="th-maven">Maven Central</th>
                <th class="th-npm">npm</th>
                <th class="th-go">Go Modules</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in secRows" :key="r.m">
                <td class="mech">{{ r.m }}</td>
                <td><span class="cell" :class="r.maven[1]">{{ r.maven[0] }}</span></td>
                <td><span class="cell" :class="r.npm[1]">{{ r.npm[0] }}</span></td>
                <td><span class="cell" :class="r.go[1]">{{ r.go[0] }}</span></td>
              </tr>
            </tbody>
          </table>
          <p class="note">✓ stark · ~ teilweise · ✗ fehlend — ¹ Immutabilität gilt nur für Publisher; Sonatype entfernt bei Malware/Brandjacking. — ² Ann.-Processors (Lombok, MapStruct) werden implizit beim Compile geladen, auch transitiv ohne Konfiguration. Gradle-Skripte sind ausführbarer Code. Go: <code>go build</code> führt keinen Dep-Code aus; <code>go test</code>/<code>go generate</code> explizit.</p>
        </div>

        <!-- Tab 5: Timeline -->
        <div v-if="activeTab === 'timeline'" class="tab-panel">
          <div class="tl-legend">
            <span class="tl-legend-item"><span class="tl-dot dot-maven"></span>Maven Central</span>
            <span class="tl-legend-item"><span class="tl-dot dot-npm"></span>npm</span>
            <span class="tl-legend-item"><span class="tl-dot dot-go"></span>Go Modules</span>
          </div>
          <div class="tl-grid">
            <div class="tl-col">
              <div v-for="e in evLeft" :key="e.title" class="tl-event" :class="e.eco">
                <div class="tl-date">{{ e.date }}</div>
                <div class="tl-title">
                  {{ e.title }}
                  <span class="tl-tag" :class="'tag-' + e.eco">{{ ecoLabel(e.eco) }}</span>
                </div>
                <div class="tl-desc">{{ e.desc }}</div>
              </div>
            </div>
            <div class="tl-col">
              <div v-for="e in evRight" :key="e.title" class="tl-event" :class="e.eco">
                <div class="tl-date">{{ e.date }}</div>
                <div class="tl-title">
                  {{ e.title }}
                  <span class="tl-tag" :class="'tag-' + e.eco">{{ ecoLabel(e.eco) }}</span>
                </div>
                <div class="tl-desc">{{ e.desc }}</div>
              </div>
            </div>
          </div>
          <p class="note">Auswahl bewusst gekürzt. npm dominiert die Liste — Maven- und Go-Vorfälle zeigen jeweils neue strukturelle Angriffsvektoren.</p>
        </div>
      </div>

      <div class="info-footer">
        Datenstand 2025 · Quellen: Sonatype SSC Report 2026, CISA, central.sonatype.org, go.dev
      </div>
    </div>
  </GradleVars>
</template>

<style scoped>
/* ── Layout ── */
.infographic { width: 100%; display: flex; flex-direction: column; gap: 0; }
.info-header { text-align: center; margin-bottom: 6px; }
.info-title {
  font-size: 20px; font-weight: 700; margin: 0;
  background: linear-gradient(90deg, #d4691a, #cb3837, #00add8);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.info-subtitle { font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0; }

/* ── Tabs ── */
.info-tabs { display: flex; gap: 4px; margin: 0 0 10px; flex-wrap: wrap; }
.info-tab {
  font-size: 12px; padding: 5px 14px; border-radius: var(--border-radius-md);
  border: 0.5px solid var(--color-border-tertiary); background: transparent;
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.info-tab:hover { background: var(--color-background-secondary); }
.info-tab.active {
  background: var(--color-background-primary); border-color: var(--color-border-primary);
  color: var(--color-text-primary); font-weight: 500;
}

/* ── Content ── */
.info-content { flex: 1; min-height: 0; }
.tab-panel { display: flex; flex-direction: column; }
.desc { font-size: 11px; color: var(--color-text-tertiary); margin: 0 0 8px; line-height: 1.5; }
.note {
  font-size: 10px; color: var(--color-text-tertiary); margin-top: 10px;
  padding-top: 6px; border-top: 1px dashed var(--color-border-tertiary); line-height: 1.5;
}
.info-footer {
  font-size: 9px; color: var(--color-text-tertiary); text-align: center;
  margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--color-border-tertiary);
}

/* ── Ecosystem colors ── */
.bar.maven { background: #d4691a; }
.bar.npm { background: #cb3837; }
.bar.pypi { background: #3776ab; }
.bar.go { background: #00add8; }
.bar.bar-light { opacity: 0.55; }

/* ── Shared bar layout ── */
.bar-row {
  display: grid; grid-template-columns: 100px 1fr 90px;
  align-items: center; gap: 8px; height: 26px;
}
.bar-name { font-size: 11px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; }
.bar-track { height: 16px; background: var(--color-background-secondary); border-radius: 3px; overflow: hidden; }
.bar { height: 100%; border-radius: 3px; transition: width 0.3s ease; min-width: 3px; }
.bar-val { font-size: 10px; color: var(--color-text-secondary); white-space: nowrap; text-align: right; }
.bar-val.na { font-style: italic; color: var(--color-text-tertiary); text-align: right; }

/* ── Tab 1: Size ── */
.size-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.size-heading {
  font-size: 10px; font-weight: 600; color: var(--color-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;
}
.size-section .bar-row { grid-template-columns: 90px 1fr 70px; }

/* ── Tab 2: Downloads ── */
.dl-controls { display: flex; gap: 4px; margin: 0 0 8px; }
.scale-btn {
  font-size: 11px; padding: 3px 10px; border-radius: 4px;
  border: 0.5px solid var(--color-border-tertiary); background: transparent;
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.scale-btn:hover { background: var(--color-background-secondary); }
.scale-btn.active {
  background: var(--color-background-primary); border-color: var(--color-border-primary);
  color: var(--color-text-primary); font-weight: 500;
}
.dl-bars .bar-row { grid-template-columns: 100px 1fr 160px; }
.dl-bars .indent-row { height: 22px; opacity: 0.75; }
.indent-name { font-size: 10px; font-weight: 400; padding-left: 8px; }
.growth { font-size: 9px; color: var(--color-text-tertiary); margin-left: 4px; }

/* ── Tab 3: Malware ── */
.malware-header { text-align: center; margin: 0 0 12px; }
.malware-big { font-size: 32px; font-weight: 700; color: var(--color-text-primary); line-height: 1.1; }
.malware-label { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.malware-bars { display: flex; flex-direction: column; gap: 2px; }
.malware-row {
  display: grid; grid-template-columns: 100px 1fr 140px;
  align-items: center; gap: 8px; height: 28px;
}
.malware-track { height: 18px; }
.malware-stats { font-size: 11px; text-align: right; white-space: nowrap; }
.malware-count { color: var(--color-text-primary); font-weight: 500; }
.malware-pct { color: var(--color-text-tertiary); margin-left: 6px; }

/* ── Tab 4: Security ── */
.sec-table { width: 100%; border-collapse: collapse; }
.sec-table th {
  text-align: left; font-weight: 600; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.04em;
  padding: 5px 6px; border-bottom: 1px solid var(--color-border-tertiary);
  color: var(--color-text-tertiary);
}
.sec-table td { padding: 3px 6px; border-bottom: 0.5px solid var(--color-border-tertiary); vertical-align: middle; }
.sec-table tr:last-child td { border-bottom: none; }
.th-maven { color: #d4691a !important; }
.th-npm { color: #cb3837 !important; }
.th-go { color: #0090b5 !important; }
:global(.dark) .th-go { color: #00add8 !important; }
.mech { font-weight: 500; color: var(--color-text-primary); white-space: nowrap; font-size: 11px; }
.cell {
  display: inline-block; padding: 2px 6px; border-radius: 3px;
  font-size: 10px; font-weight: 500; white-space: nowrap;
}
.cell.good { background: var(--color-background-success); color: var(--color-text-success); }
.cell.warn { background: var(--color-background-warning); color: var(--color-text-warning); }
.cell.bad { background: var(--color-background-danger); color: var(--color-text-danger); }

/* ── Tab 5: Timeline ── */
.tl-legend { display: flex; gap: 14px; margin: 0 0 8px; font-size: 10px; color: var(--color-text-secondary); }
.tl-legend-item { display: flex; align-items: center; gap: 5px; }
.tl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-maven { background: #d4691a; }
.dot-npm { background: #cb3837; }
.dot-go { background: #00add8; }

.tl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tl-col { border-left: 2px solid var(--color-border-tertiary); padding-left: 14px; }
.tl-event { position: relative; padding-bottom: 10px; }
.tl-event::before {
  content: '';
  position: absolute;
  left: -19px; top: 4px;
  width: 8px; height: 8px; border-radius: 50%;
  border: 2px solid var(--color-background-primary);
}
.tl-event.npm::before { background: #cb3837; }
.tl-event.maven::before { background: #d4691a; }
.tl-event.go::before { background: #00add8; }
.tl-event.both::before { background: linear-gradient(135deg, #cb3837 50%, #d4691a 50%); }
.tl-date {
  font-size: 9px; color: var(--color-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.tl-title { font-size: 11px; font-weight: 600; color: var(--color-text-primary); }
.tl-tag {
  display: inline-block; font-size: 8px; padding: 1px 5px; border-radius: 3px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin-left: 4px;
  vertical-align: middle;
}
.tag-npm { background: rgba(203, 56, 55, 0.15); color: #cb3837; }
.tag-maven { background: rgba(212, 105, 26, 0.15); color: #d4691a; }
.tag-go { background: rgba(0, 173, 216, 0.15); color: #00add8; }
.tag-both { background: rgba(203, 56, 55, 0.1); color: #cb3837; }
.tl-desc { font-size: 10px; color: var(--color-text-secondary); line-height: 1.45; }
</style>
