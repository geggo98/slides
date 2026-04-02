<script setup>
import { ref, inject } from 'vue'
import CrossRefLink from './CrossRefLink.vue'

const skillNav = inject('skillNav', null)

const activeFile = ref('skill')
const activeDetail = ref(null)

const FILES = {
  root: {
    header: 'deploy-check/',
    path: '.claude/skills/deploy-check/',
    type: 'welcome',
    content: 'Klicke auf eine Datei im Baum, um ihren Inhalt und annotierte Erklärungen zu sehen.<br><br>Dieses Beispiel zeigt einen <b>Pattern-B-Skill</b> (Prompt + Scripts) mit MCP-Integration, der vor Kubernetes-Deployments eine automatisierte Checkliste durchläuft.<br><br><b>Struktur:</b><br>• <code>SKILL.md</code> — Frontmatter + Instruktionen<br>• <code>scripts/check_deploy.py</code> — Deployment-Validierung<br>• <code>references/k8s-checklist.md</code> — Referenzmaterial',
  },
  skill: {
    header: 'SKILL.md',
    path: 'deploy-check/SKILL.md',
    lines: [
      { n: 1, t: '<span class="cmt">---</span>', g: 'fm-start', d: { t: 'YAML-Frontmatter (Anfang)', b: 'Alles zwischen den <code>---</code>-Markern ist YAML-Frontmatter. Es wird als Level-1-Metadaten geladen (~100 Tokens) und entscheidet, ob Claude den Skill aktiviert.', ref: { tab: 'skillmd', section: 'yaml-frontmatter', label: 'SKILL.md \u2192 YAML-Frontmatter' } } },
      { n: 2, t: '<span class="fm-key">name:</span> <span class="fm-val">deploy-check</span>', g: 'fm-name', d: { t: 'name \u2014 Pflichtfeld', b: 'Max 64 Zeichen. Nur Kleinbuchstaben, Zahlen, Bindestriche. <b>Muss dem Verzeichnisnamen entsprechen.</b> Wird als <code>/deploy-check</code> Slash-Command verf\u00fcgbar. Offener Standard (plattform\u00fcbergreifend).' } },
      { n: 3, t: '<span class="fm-key">description:</span> <span class="fm-val">|</span>', g: 'fm-desc', d: { t: 'description \u2014 Pflichtfeld (das kritischste!)', b: 'Max 1024 Zeichen. Beschreibt <b>was</b> der Skill tut UND <b>wann</b> er aktiviert werden soll. Claude entscheidet allein anhand von Name + Description (~100 Tokens), ob der Skill relevant ist. \u201ePushy\u201c formulieren.', ref: { tab: 'disclosure', section: 'load-system', label: 'Progressive disclosure \u2192 Level 1' } } },
      { n: 4, t: '  <span class="fm-val">Pre-deployment validation for K8s rollouts.</span>', g: 'fm-desc' },
      { n: 5, t: '  <span class="fm-val">Use before deploying, when reviewing a</span>', g: 'fm-desc' },
      { n: 6, t: '  <span class="fm-val">rollout, or when asked "is this safe to deploy?"</span>', g: 'fm-desc' },
      { n: 7, t: '<span class="fm-key">allowed-tools:</span>', g: 'fm-tools', d: { t: 'allowed-tools \u2014 MCP-Tool-Freigabe', b: 'Vorab genehmigte Tools f\u00fcr diesen Skill. Namenskonvention: <code>mcp__&lt;server&gt;__&lt;tool&gt;</code>. Dieser Skill darf Grafana-Daten abfragen und Jira-Issues erstellen.', ref: { tab: 'mcp', section: 'skills-mcp', label: 'MCP \u2192 Skills + MCP' } } },
      { n: 8, t: '  - <span class="str">mcp__grafana__query_metrics</span>', g: 'fm-tools' },
      { n: 9, t: '  - <span class="str">mcp__jira__create_issue</span>', g: 'fm-tools' },
      { n: 10, t: '  - <span class="str">Read</span>', g: 'fm-tools' },
      { n: 11, t: '  - <span class="str">Bash(python3*)</span>', g: 'fm-tools' },
      { n: 12, t: '<span class="fm-key">context:</span> <span class="fm-val">fork</span>', g: 'fm-ctx', d: { t: 'context: fork \u2014 CC-Erweiterung', b: 'Startet den Skill in einem <b>eigenen Subagent</b> mit isoliertem Kontext. Das Ergebnis wird zur\u00fcck an den Hauptagent gegeben. Verhindert, dass der Skill-Kontext das Hauptfenster aufbl\u00e4ht. <span class="badge-s b-cc">CC only</span>', ref: { tab: 'skillmd', section: 'cc-extensions', label: 'SKILL.md \u2192 Claude-Code-Erweiterungen' } } },
      { n: 13, t: '<span class="fm-key">agent:</span> <span class="fm-val">Explore</span>', g: 'fm-agent', d: { t: 'agent: Explore \u2014 CC-Erweiterung', b: 'Bestimmt den Subagent-Typ bei <code>context: fork</code>. <code>Explore</code> ist ein Read-Only-Agent. Alternativen: <code>Plan</code> (Planungsmodus). <span class="badge-s b-cc">CC only</span>' } },
      { n: 14, t: '<span class="fm-key">effort:</span> <span class="fm-val">medium</span>', g: 'fm-effort', d: { t: 'effort \u2014 CC-Erweiterung', b: 'Steuert das Execution-Quality-Level: <code>low</code>, <code>medium</code>, <code>high</code>. Niedrige Effort-Level sind schneller aber weniger gr\u00fcndlich. <span class="badge-s b-cc">CC only</span>' } },
      { n: 15, t: '<span class="cmt">---</span>', g: 'fm-end' },
      { n: 16, t: '', g: 'blank' },
      { n: 17, t: '<span class="h1">## Pre-deployment checklist</span>', g: 'body-h1', d: { t: 'Markdown-Body = Level-2-Instruktionen', b: 'Alles unterhalb des Frontmatter ist der Markdown-Body. Wird erst geladen, wenn Claude den Skill als relevant erkennt oder der Nutzer <code>/deploy-check</code> aufruft. Sollte <b>max 500 Zeilen</b> lang sein.', ref: { tab: 'disclosure', section: 'load-system', label: 'Progressive disclosure \u2192 Level 2' } } },
      { n: 18, t: '', g: 'blank2' },
      { n: 19, t: 'Before any K8s deployment, run through these steps:', g: 'body' },
      { n: 20, t: '', g: 'blank3' },
      { n: 21, t: '<span class="h2">### 1. Validierung</span>', g: 'body-script', d: { t: 'Script-Referenz mit ${CLAUDE_SKILL_DIR}', b: 'Die Variable <code>${CLAUDE_SKILL_DIR}</code> zeigt auf das Verzeichnis der SKILL.md. Claude f\u00fchrt das Skript via Bash aus \u2014 nur das <b>Output</b> gelangt in den Kontext, nicht der Quellcode. Token-Hygiene beachten!', ref: { tab: 'files', section: 'token-hygiene', label: 'Scripts & references \u2192 Token-Hygiene' } } },
      { n: 22, t: 'Run the validation script:', g: 'body-script' },
      { n: 23, t: '<span class="kw">`python3 ${CLAUDE_SKILL_DIR}/scripts/check_deploy.py`</span>', g: 'body-script' },
      { n: 24, t: '', g: 'blank4' },
      { n: 25, t: '<span class="h2">### 2. Observability</span>', g: 'body-mcp', d: { t: 'MCP-Tool-Nutzung im Workflow', b: 'Der Skill weist Claude an, Grafana-Metriken via MCP abzufragen. Die Tools sind im <code>allowed-tools</code>-Frontmatter freigegeben. Ohne Freigabe m\u00fcsste Claude bei jeder Tool-Nutzung um Erlaubnis fragen.', ref: { tab: 'mcp', section: 'skills-mcp', label: 'MCP \u2192 Skills + MCP' } } },
      { n: 26, t: 'Query error rate and latency via <span class="kw">mcp__grafana__query_metrics</span>:', g: 'body-mcp' },
      { n: 27, t: '- <span class="str">rate(http_requests_total{status=~"5.."}[5m])</span>', g: 'body-mcp' },
      { n: 28, t: '- <span class="str">histogram_quantile(0.99, rate(http_duration_seconds_bucket[5m]))</span>', g: 'body-mcp' },
      { n: 29, t: '', g: 'blank5' },
      { n: 30, t: '<span class="h2">### 3. Referenz-Checkliste</span>', g: 'body-ref', d: { t: 'Verweis auf references/-Datei', b: 'Claude liest die Referenzdatei <b>bei Bedarf</b> (Level 3+). Der Quellinhalt verbraucht erst Tokens, wenn Claude ihn tats\u00e4chlich l\u00e4dt. Best Practice: max eine Ebene tief verlinken.', ref: { tab: 'files', section: 'references-folder', label: 'Scripts & references \u2192 References-Ordner' } } },
      { n: 31, t: 'Consult <span class="kw">`${CLAUDE_SKILL_DIR}/references/k8s-checklist.md`</span>', g: 'body-ref' },
      { n: 32, t: 'for the full deployment safety checklist.', g: 'body-ref' },
      { n: 33, t: '', g: 'blank6' },
      { n: 34, t: '<span class="h2">### 4. Ergebnis</span>', g: 'body-result', d: { t: 'Strukturierte Ausgabe-Anweisung', b: 'Skills k\u00f6nnen Claude anweisen, Ergebnisse in einem bestimmten Format auszugeben. Hier: tabellarische Zusammenfassung mit Go/No-Go-Empfehlung. Bei Problemen wird automatisch ein Jira-Issue via MCP erstellt.' } },
      { n: 35, t: 'Summarize findings as a table:', g: 'body-result' },
      { n: 36, t: '| Check | Status | Detail |', g: 'body-result' },
      { n: 37, t: '', g: 'body-result' },
      { n: 38, t: 'If any check fails, create a blocking issue via', g: 'body-result' },
      { n: 39, t: '<span class="kw">mcp__jira__create_issue</span> and recommend NO-GO.', g: 'body-result' },
    ],
  },
  check_py: {
    header: 'check_deploy.py',
    path: 'deploy-check/scripts/check_deploy.py',
    lines: [
      { n: 1, t: '<span class="cmt">#!/usr/bin/env python3</span>', g: 'py-head', d: { t: 'Skript-Datei im scripts/-Ordner', b: 'Claude f\u00fchrt dieses Skript via Bash aus. Der <b>Quellcode verbraucht keine Tokens</b> \u2014 nur das stdout/stderr-Output gelangt in den Kontext. Deshalb ist Token-Hygiene hier entscheidend.', ref: { tab: 'files', section: 'token-hygiene', label: 'Scripts & references \u2192 Token-Hygiene' } } },
      { n: 2, t: '<span class="cmt">"""Pre-deployment validation checks."""</span>', g: 'py-head' },
      { n: 3, t: '<span class="kw">import</span> subprocess, json, sys', g: 'py' },
      { n: 4, t: '<span class="kw">from</span> pathlib <span class="kw">import</span> Path', g: 'py' },
      { n: 5, t: '', g: 'py-blank' },
      { n: 6, t: '<span class="kw">def</span> check_manifests():', g: 'py-fn' },
      { n: 7, t: '    <span class="cmt"># Validate K8s YAML</span>', g: 'py-fn' },
      { n: 8, t: '    result = subprocess.run(', g: 'py-fn' },
      { n: 9, t: '        [<span class="str">"kubectl"</span>, <span class="str">"apply"</span>, <span class="str">"--dry-run=client"</span>, <span class="str">"-f"</span>, <span class="str">"k8s/"</span>],', g: 'py-fn' },
      { n: 10, t: '        capture_output=<span class="kw">True</span>, text=<span class="kw">True</span>)', g: 'py-fn' },
      { n: 11, t: '    <span class="kw">return</span> result.returncode == 0, result.stderr', g: 'py-fn' },
      { n: 12, t: '', g: 'py-blank2' },
      { n: 13, t: '<span class="kw">def</span> check_image_tags():', g: 'py-fn2' },
      { n: 14, t: '    <span class="cmt"># Reject :latest tags in production</span>', g: 'py-fn2' },
      { n: 15, t: '    <span class="cmt"># ... (Validierungslogik) ...</span>', g: 'py-fn2' },
      { n: 16, t: '    <span class="kw">return True</span>, <span class="str">""</span>', g: 'py-fn2' },
      { n: 17, t: '', g: 'py-blank3' },
      { n: 18, t: '<span class="cmt"># === Token-Hygiene: Ergebnis in Datei ===</span>', g: 'py-hygiene', d: { t: 'Token-Hygiene in Aktion', b: 'Das vollst\u00e4ndige Ergebnis-JSON wird in eine Datei geschrieben. Auf stdout landet nur eine <b>knappe Zusammenfassung</b> und der Dateipfad. So bleibt das Kontextfenster schlank, auch wenn das Skript hunderte Checks durchf\u00fchrt.', ref: { tab: 'files', section: 'token-hygiene', label: 'Scripts & references \u2192 Token-Hygiene' } } },
      { n: 19, t: 'results = {', g: 'py-hygiene' },
      { n: 20, t: '    <span class="str">"manifests"</span>: check_manifests(),', g: 'py-hygiene' },
      { n: 21, t: '    <span class="str">"image_tags"</span>: check_image_tags(),', g: 'py-hygiene' },
      { n: 22, t: '}', g: 'py-hygiene' },
      { n: 23, t: '', g: 'py-blank4' },
      { n: 24, t: '<span class="cmt"># Vollständiges Ergebnis in Datei, NICHT auf stdout</span>', g: 'py-out', d: { t: 'Datei statt stdout', b: 'Die Datei <code>/tmp/deploy-check.json</code> enth\u00e4lt das vollst\u00e4ndige Ergebnis. Claude kann sie bei Bedarf lesen, aber sie verbraucht nur dann Tokens, wenn Claude sie tats\u00e4chlich \u00f6ffnet.' } },
      { n: 25, t: 'out = Path(<span class="str">"/tmp/deploy-check.json"</span>)', g: 'py-out' },
      { n: 26, t: 'out.write_text(json.dumps(results, indent=2))', g: 'py-out' },
      { n: 27, t: '', g: 'py-blank5' },
      { n: 28, t: '<span class="cmt"># Nur Summary + Pfad auf stdout</span>', g: 'py-summary', d: { t: 'Minimaler stdout = minimaler Token-Verbrauch', b: 'Nur 2 Zeilen Output: Anzahl der Checks und Dateipfad. Statt potenziell kilobytes an JSON landen nur ~50 Zeichen im Kontextfenster. Claude kann bei Bedarf die Datei lesen.' } },
      { n: 29, t: 'passed = sum(1 <span class="kw">for</span> ok, _ <span class="kw">in</span> results.values() <span class="kw">if</span> ok)', g: 'py-summary' },
      { n: 30, t: 'print(<span class="str">f"</span>{passed}/{len(results)} checks passed<span class="str">"</span>)', g: 'py-summary' },
      { n: 31, t: 'print(<span class="str">f"Details: </span>{out}<span class="str">"</span>)', g: 'py-summary' },
    ],
  },
  checklist: {
    header: 'k8s-checklist.md',
    path: 'deploy-check/references/k8s-checklist.md',
    lines: [
      { n: 1, t: '<span class="h1"># Kubernetes deployment safety checklist</span>', g: 'ref-head', d: { t: 'Level-3-Ressource (references/)', b: 'Diese Datei wird <b>nur bei Bedarf</b> geladen \u2014 wenn Claude im Skill-Workflow auf sie verwiesen wird. Der Inhalt verbraucht erst dann Tokens. Best Practice: Dateien \u00fcber 300 Zeilen sollten ein Inhaltsverzeichnis enthalten.', ref: { tab: 'files', section: 'references-folder', label: 'Scripts & references \u2192 References-Ordner' } } },
      { n: 2, t: '', g: 'ref-blank' },
      { n: 3, t: '<span class="h2">## Resource limits</span>', g: 'ref' },
      { n: 4, t: '- Every container MUST have CPU/memory requests', g: 'ref' },
      { n: 5, t: '- Limits should be 2-3x requests for burst', g: 'ref' },
      { n: 6, t: '- No unbounded containers in production', g: 'ref' },
      { n: 7, t: '', g: 'ref-blank2' },
      { n: 8, t: '<span class="h2">## Health checks</span>', g: 'ref2' },
      { n: 9, t: '- Liveness probe: TCP or HTTP, not exec', g: 'ref2' },
      { n: 10, t: '- Readiness probe: must check dependencies', g: 'ref2' },
      { n: 11, t: '- Startup probe for slow-starting apps', g: 'ref2' },
      { n: 12, t: '', g: 'ref-blank3' },
      { n: 13, t: '<span class="h2">## Rollout strategy</span>', g: 'ref3' },
      { n: 14, t: '- maxUnavailable: 0 for zero-downtime', g: 'ref3' },
      { n: 15, t: '- maxSurge: 25% default, adjust for cost', g: 'ref3' },
      { n: 16, t: '- PodDisruptionBudget for critical services', g: 'ref3' },
    ],
  },
  scripts: {
    header: 'scripts/',
    path: 'deploy-check/scripts/',
    type: 'welcome',
    content: 'Verzeichnis f\u00fcr ausf\u00fchrbare Skripte. Claude f\u00fchrt sie via Bash aus \u2014 nur das <b>Output</b> (stdout/stderr) gelangt in den Kontext, nicht der Quellcode selbst.<br><br>Klicke auf <code>check_deploy.py</code> im Baum, um das Beispielskript mit Token-Hygiene-Annotationen zu sehen.',
  },
  refs: {
    header: 'references/',
    path: 'deploy-check/references/',
    type: 'welcome',
    content: 'Verzeichnis f\u00fcr Referenzmaterial, das Claude <b>bei Bedarf</b> liest (Level 3+ im Progressive-Disclosure-System).<br><br>Typische Inhalte: API-Dokumentation, Checklisten, Schema-Definitionen, Style Guides.<br><br>Klicke auf <code>k8s-checklist.md</code>, um die Beispiel-Referenz zu sehen.',
  },
}

const treeItems = [
  { id: 'root', label: 'deploy-check/', icon: 'dir', indent: 0 },
  { id: 'skill', label: 'SKILL.md', icon: 'skill', indent: 1 },
  { id: 'scripts', label: 'scripts/', icon: 'dir', indent: 1 },
  { id: 'check_py', label: 'check_deploy.py', icon: 'file', indent: 2 },
  { id: 'refs', label: 'references/', icon: 'dir', indent: 1 },
  { id: 'checklist', label: 'k8s-checklist.md', icon: 'file', indent: 2 },
]

function selectFile(id) {
  activeFile.value = id
  activeDetail.value = null
}

function getGroupDetail(file, group) {
  if (!file.lines) return null
  const line = file.lines.find(l => l.g === group && l.d)
  return line ? line.d : null
}

function hasGroupDetail(fileId, group) {
  const file = FILES[fileId]
  return !!getGroupDetail(file, group)
}

function clickLine(group) {
  const file = FILES[activeFile.value]
  if (!getGroupDetail(file, group)) return
  if (activeDetail.value === group) {
    activeDetail.value = null
  } else {
    activeDetail.value = group
  }
}
</script>

<template>
  <div class="ex">
    <div class="ex-hint">
      <span class="dot" />
      Zeilen mit blauem Rand sind klickbar und zeigen Erklärungen
    </div>
    <div class="ex-layout">
      <div class="tree-pan">
        <div class="tp-title">Verzeichnisbaum</div>
        <div
          v-for="item in treeItems"
          :key="item.id"
          class="tn"
          :class="{ active: activeFile === item.id }"
          :style="{ paddingLeft: (item.indent * 18) + 'px' }"
          @click.stop="selectFile(item.id)"
        >
          <span :class="['ico', item.icon + '-ico']">
            <svg v-if="item.icon === 'dir'" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/></svg>
            <svg v-else-if="item.icon === 'skill'" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2-.5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V4a.5.5 0 00-.5-.5H4z"/><path d="M5 6h6M5 8h4M5 10h5" stroke="currentColor" stroke-width="1" fill="none"/></svg>
            <svg v-else viewBox="0 0 16 16" fill="currentColor"><path d="M4 1a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5.414a1 1 0 00-.293-.707L9.293 1.293A1 1 0 008.586 1H4z"/></svg>
          </span>
          <span class="tn-label">{{ item.label }}</span>
        </div>
      </div>

      <div class="content-pan">
        <div class="file-header">
          <span class="file-path">{{ FILES[activeFile].path }}</span>
        </div>

        <!-- Welcome content for directories -->
        <div v-if="FILES[activeFile].type === 'welcome'" class="welcome" v-html="FILES[activeFile].content" />

        <!-- Code view for files -->
        <template v-else-if="FILES[activeFile].lines">
          <div class="code-block">
            <div
              v-for="line in FILES[activeFile].lines"
              :key="line.n"
              class="cl"
              :class="{
                clickable: hasGroupDetail(activeFile, line.g),
                'active-line': activeDetail === line.g && hasGroupDetail(activeFile, line.g),
              }"
              @click.stop="clickLine(line.g)"
            >
              <span class="ln">{{ line.n }}</span>
              <span class="ct" v-html="line.t" />
            </div>
          </div>

          <!-- Detail panel -->
          <div v-if="activeDetail && getGroupDetail(FILES[activeFile], activeDetail)" class="detail-pan">
            <div class="dt">{{ getGroupDetail(FILES[activeFile], activeDetail).t }}</div>
            <span v-html="getGroupDetail(FILES[activeFile], activeDetail).b" />
            <div v-if="getGroupDetail(FILES[activeFile], activeDetail).ref" class="ref">
              <CrossRefLink
                :tab="getGroupDetail(FILES[activeFile], activeDetail).ref.tab"
                :section="getGroupDetail(FILES[activeFile], activeDetail).ref.section"
                :label="getGroupDetail(FILES[activeFile], activeDetail).ref.label"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ex { padding: 0.5rem 0; }
.ex-hint { font-size: 11px; color: var(--color-text-tertiary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-background-info); border: 0.5px solid var(--color-border-info); flex-shrink: 0; }
.ex-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 0; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--sk-rad); overflow: hidden; min-height: 360px; }
.tree-pan { background: var(--color-background-secondary); padding: 12px; border-right: 0.5px solid var(--color-border-tertiary); font-size: 12px; }
.tp-title { font-size: 11px; font-weight: 500; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 8px; }
.tn { padding: 3px 0; cursor: pointer; color: var(--color-text-secondary); transition: color .1s; display: flex; align-items: center; gap: 5px; user-select: none; }
.tn:hover { color: var(--color-text-primary); }
.tn.active { color: var(--color-text-info); font-weight: 500; }
.ico { width: 14px; height: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.ico svg { width: 12px; height: 12px; }
.dir-ico { color: var(--color-text-warning); }
.file-ico { color: var(--color-text-tertiary); }
.skill-ico { color: var(--color-text-info); }
.tn-label { font-family: var(--font-mono); font-size: 12px; }
.content-pan { padding: 16px; overflow-y: auto; background: var(--color-background-primary); }
.file-header { font-size: 13px; font-weight: 500; margin-bottom: 12px; }
.file-path { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-secondary); }
.welcome { font-size: 13px; color: var(--color-text-secondary); line-height: 1.7; padding: 20px 0; }
.code-block { font-family: var(--font-mono); font-size: 11.5px; background: var(--color-background-secondary); padding: 0; border-radius: var(--sk-radm); overflow-x: auto; line-height: 1.65; border: 0.5px solid var(--color-border-tertiary); }
.cl { padding: 1px 12px; display: flex; cursor: default; transition: background .15s; min-height: 20px; border-left: 2px solid transparent; }
.cl:hover { background: var(--color-background-tertiary); }
.cl.clickable { cursor: pointer; border-left-color: var(--color-border-info); background: color-mix(in srgb, var(--color-background-info) 35%, transparent); }
.cl.clickable:hover { background: var(--color-background-info); }
.cl.active-line { background: var(--color-background-info); border-left-color: var(--color-text-info); }
.ln { color: var(--color-text-tertiary); min-width: 24px; text-align: right; padding-right: 12px; user-select: none; font-size: 11px; }
.ct { white-space: pre; flex: 1; }
/* Syntax highlighting via :deep for v-html content */
.ct :deep(.kw) { color: var(--color-text-info); }
.ct :deep(.str) { color: var(--color-text-success); }
.ct :deep(.cmt) { color: var(--color-text-tertiary); font-style: italic; }
.ct :deep(.fm-key) { color: var(--color-text-warning); font-weight: 500; }
.ct :deep(.fm-val) { color: var(--color-text-primary); }
.ct :deep(.h1) { color: var(--color-text-primary); font-weight: 500; }
.ct :deep(.h2) { color: var(--color-text-secondary); font-weight: 500; }
.detail-pan { border: 0.5px solid var(--color-border-info); border-radius: var(--sk-radm); padding: 10px 14px; margin-top: 12px; background: var(--color-background-info); font-size: 12px; line-height: 1.6; color: var(--color-text-info); }
.detail-pan .dt { font-weight: 500; margin-bottom: 4px; font-size: 13px; }
.detail-pan :deep(code) { font-family: var(--font-mono); font-size: 11px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; }
.detail-pan :deep(.badge-s) { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: var(--sk-radm); font-weight: 500; margin-left: 4px; vertical-align: middle; }
.detail-pan :deep(.b-cc) { background: var(--color-background-warning); color: var(--color-text-warning); }
.ref { font-size: 11px; margin-top: 6px; }
</style>
