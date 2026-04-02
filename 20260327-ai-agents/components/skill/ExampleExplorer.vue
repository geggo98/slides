<script setup>
import { ref, inject, onMounted, onBeforeUnmount, computed, watchEffect } from 'vue'
import { useDarkMode } from '@slidev/client'
import CrossRefLink from './CrossRefLink.vue'

const skillNav = inject('skillNav', null)
const { isDark } = useDarkMode()

const activeFile = ref('skill')
const activeDetail = ref(null)
const editorContainer = ref(null)

let editor = null
let monaco = null
let decoCollection = null
let activeDecoCollection = null
let currentAnnotations = {}
let viewZoneIds = []

const FILES = {
  root: {
    header: 'deploy-check/',
    path: '.claude/skills/deploy-check/',
    type: 'welcome',
    content: 'Klicke auf eine Datei im Baum, um ihren Inhalt und annotierte Erkl\u00e4rungen zu sehen.<br><br>Dieses Beispiel zeigt einen <b>Pattern-B-Skill</b> (Prompt + Scripts) mit MCP-Integration, der vor Kubernetes-Deployments eine automatisierte Checkliste durchl\u00e4uft.<br><br><b>Struktur:</b><br>\u2022 <code>SKILL.md</code> \u2014 Frontmatter + Instruktionen<br>\u2022 <code>scripts/check_deploy.py</code> \u2014 Deployment-Validierung<br>\u2022 <code>references/k8s-checklist.md</code> \u2014 Referenzmaterial',
  },
  skill: {
    header: 'SKILL.md',
    path: 'deploy-check/SKILL.md',
    lang: 'yaml',
    lines: [
      { n: 1, t: '---', g: 'fm-start', d: { t: 'YAML-Frontmatter (Anfang)', b: 'Alles zwischen den <code>---</code>-Markern ist YAML-Frontmatter. Es wird als Level-1-Metadaten geladen (~100 Tokens) und entscheidet, ob Claude den Skill aktiviert.', ref: { tab: 'skillmd', section: 'yaml-frontmatter', label: 'SKILL.md \u2192 YAML-Frontmatter' } } },
      { n: 2, t: 'name: deploy-check', g: 'fm-name', d: { t: 'name \u2014 Pflichtfeld', b: 'Max 64 Zeichen. Nur Kleinbuchstaben, Zahlen, Bindestriche. <b>Muss dem Verzeichnisnamen entsprechen.</b> Wird als <code>/deploy-check</code> Slash-Command verf\u00fcgbar. Offener Standard (plattform\u00fcbergreifend).' } },
      { n: 3, t: 'description: |', g: 'fm-desc', d: { t: 'description \u2014 Pflichtfeld (das kritischste!)', b: 'Max 1024 Zeichen. Beschreibt <b>was</b> der Skill tut UND <b>wann</b> er aktiviert werden soll. Claude entscheidet allein anhand von Name + Description (~100 Tokens), ob der Skill relevant ist. \u201ePushy\u201c formulieren.', ref: { tab: 'disclosure', section: 'load-system', label: 'Progressive disclosure \u2192 Level 1' } } },
      { n: 4, t: '  Pre-deployment validation for K8s rollouts.', g: 'fm-desc' },
      { n: 5, t: '  Use before deploying, when reviewing a', g: 'fm-desc' },
      { n: 6, t: '  rollout, or when asked "is this safe to deploy?"', g: 'fm-desc' },
      { n: 7, t: 'allowed-tools:', g: 'fm-tools', d: { t: 'allowed-tools \u2014 MCP-Tool-Freigabe', b: 'Vorab genehmigte Tools f\u00fcr diesen Skill. Namenskonvention: <code>mcp__&lt;server&gt;__&lt;tool&gt;</code>. Dieser Skill darf Grafana-Daten abfragen und Jira-Issues erstellen.', ref: { tab: 'mcp', section: 'skills-mcp', label: 'MCP \u2192 Skills + MCP' } } },
      { n: 8, t: '  - mcp__grafana__query_metrics', g: 'fm-tools' },
      { n: 9, t: '  - mcp__jira__create_issue', g: 'fm-tools' },
      { n: 10, t: '  - Read', g: 'fm-tools' },
      { n: 11, t: '  - Bash(python3*)', g: 'fm-tools' },
      { n: 12, t: 'context: fork', g: 'fm-ctx', d: { t: 'context: fork \u2014 CC-Erweiterung', b: 'Startet den Skill in einem <b>eigenen Subagent</b> mit isoliertem Kontext. Das Ergebnis wird zur\u00fcck an den Hauptagent gegeben. Verhindert, dass der Skill-Kontext das Hauptfenster aufbl\u00e4ht. <span class="badge-s b-cc">CC only</span>', ref: { tab: 'skillmd', section: 'cc-extensions', label: 'SKILL.md \u2192 Claude-Code-Erweiterungen' } } },
      { n: 13, t: 'agent: Explore', g: 'fm-agent', d: { t: 'agent: Explore \u2014 CC-Erweiterung', b: 'Bestimmt den Subagent-Typ bei <code>context: fork</code>. <code>Explore</code> ist ein Read-Only-Agent. Alternativen: <code>Plan</code> (Planungsmodus). <span class="badge-s b-cc">CC only</span>' } },
      { n: 14, t: 'effort: medium', g: 'fm-effort', d: { t: 'effort \u2014 CC-Erweiterung', b: 'Steuert das Execution-Quality-Level: <code>low</code>, <code>medium</code>, <code>high</code>. Niedrige Effort-Level sind schneller aber weniger gr\u00fcndlich. <span class="badge-s b-cc">CC only</span>' } },
      { n: 15, t: '---', g: 'fm-end' },
      { n: 16, t: '' },
      { n: 17, t: '## Pre-deployment checklist', g: 'body-h1', d: { t: 'Markdown-Body = Level-2-Instruktionen', b: 'Alles unterhalb des Frontmatter ist der Markdown-Body. Wird erst geladen, wenn Claude den Skill als relevant erkennt oder der Nutzer <code>/deploy-check</code> aufruft. Sollte <b>max 500 Zeilen</b> lang sein.', ref: { tab: 'disclosure', section: 'load-system', label: 'Progressive disclosure \u2192 Level 2' } } },
      { n: 18, t: '' },
      { n: 19, t: 'Before any K8s deployment, run through these steps:' },
      { n: 20, t: '' },
      { n: 21, t: '### 1. Validierung', g: 'body-script', d: { t: 'Script-Referenz mit ${CLAUDE_SKILL_DIR}', b: 'Die Variable <code>${CLAUDE_SKILL_DIR}</code> zeigt auf das Verzeichnis der SKILL.md. Claude f\u00fchrt das Skript via Bash aus \u2014 nur das <b>Output</b> gelangt in den Kontext, nicht der Quellcode. Token-Hygiene beachten!', ref: { tab: 'files', section: 'token-hygiene', label: 'Scripts & references \u2192 Token-Hygiene' } } },
      { n: 22, t: 'Run the validation script:', g: 'body-script' },
      { n: 23, t: '`python3 ${CLAUDE_SKILL_DIR}/scripts/check_deploy.py`', g: 'body-script' },
      { n: 24, t: '' },
      { n: 25, t: '### 2. Observability', g: 'body-mcp', d: { t: 'MCP-Tool-Nutzung im Workflow', b: 'Der Skill weist Claude an, Grafana-Metriken via MCP abzufragen. Die Tools sind im <code>allowed-tools</code>-Frontmatter freigegeben. Ohne Freigabe m\u00fcsste Claude bei jeder Tool-Nutzung um Erlaubnis fragen.', ref: { tab: 'mcp', section: 'skills-mcp', label: 'MCP \u2192 Skills + MCP' } } },
      { n: 26, t: 'Query error rate and latency via mcp__grafana__query_metrics:', g: 'body-mcp' },
      { n: 27, t: '- rate(http_requests_total{status=~"5.."}[5m])', g: 'body-mcp' },
      { n: 28, t: '- histogram_quantile(0.99, rate(http_duration_seconds_bucket[5m]))', g: 'body-mcp' },
      { n: 29, t: '' },
      { n: 30, t: '### 3. Referenz-Checkliste', g: 'body-ref', d: { t: 'Verweis auf references/-Datei', b: 'Claude liest die Referenzdatei <b>bei Bedarf</b> (Level 3+). Der Quellinhalt verbraucht erst Tokens, wenn Claude ihn tats\u00e4chlich l\u00e4dt. Best Practice: max eine Ebene tief verlinken.', ref: { tab: 'files', section: 'references-folder', label: 'Scripts & references \u2192 References-Ordner' } } },
      { n: 31, t: 'Consult `${CLAUDE_SKILL_DIR}/references/k8s-checklist.md`', g: 'body-ref' },
      { n: 32, t: 'for the full deployment safety checklist.', g: 'body-ref' },
      { n: 33, t: '' },
      { n: 34, t: '### 4. Ergebnis', g: 'body-result', d: { t: 'Strukturierte Ausgabe-Anweisung', b: 'Skills k\u00f6nnen Claude anweisen, Ergebnisse in einem bestimmten Format auszugeben. Hier: tabellarische Zusammenfassung mit Go/No-Go-Empfehlung. Bei Problemen wird automatisch ein Jira-Issue via MCP erstellt.' } },
      { n: 35, t: 'Summarize findings as a table:', g: 'body-result' },
      { n: 36, t: '| Check | Status | Detail |', g: 'body-result' },
      { n: 37, t: '', g: 'body-result' },
      { n: 38, t: 'If any check fails, create a blocking issue via', g: 'body-result' },
      { n: 39, t: 'mcp__jira__create_issue and recommend NO-GO.', g: 'body-result' },
    ],
  },
  check_py: {
    header: 'check_deploy.py',
    path: 'deploy-check/scripts/check_deploy.py',
    lang: 'python',
    lines: [
      { n: 1, t: '#!/usr/bin/env python3', g: 'py-head', d: { t: 'Skript-Datei im scripts/-Ordner', b: 'Claude f\u00fchrt dieses Skript via Bash aus. Der <b>Quellcode verbraucht keine Tokens</b> \u2014 nur das stdout/stderr-Output gelangt in den Kontext. Deshalb ist Token-Hygiene hier entscheidend.', ref: { tab: 'files', section: 'token-hygiene', label: 'Scripts & references \u2192 Token-Hygiene' } } },
      { n: 2, t: '"""Pre-deployment validation checks."""', g: 'py-head' },
      { n: 3, t: 'import subprocess, json, sys', g: 'py' },
      { n: 4, t: 'from pathlib import Path', g: 'py' },
      { n: 5, t: '' },
      { n: 6, t: 'def check_manifests():', g: 'py-fn' },
      { n: 7, t: '    # Validate K8s YAML', g: 'py-fn' },
      { n: 8, t: '    result = subprocess.run(', g: 'py-fn' },
      { n: 9, t: '        ["kubectl", "apply", "--dry-run=client", "-f", "k8s/"],', g: 'py-fn' },
      { n: 10, t: '        capture_output=True, text=True)', g: 'py-fn' },
      { n: 11, t: '    return result.returncode == 0, result.stderr', g: 'py-fn' },
      { n: 12, t: '' },
      { n: 13, t: 'def check_image_tags():', g: 'py-fn2' },
      { n: 14, t: '    # Reject :latest tags in production', g: 'py-fn2' },
      { n: 15, t: '    # ... (Validierungslogik) ...', g: 'py-fn2' },
      { n: 16, t: '    return True, ""', g: 'py-fn2' },
      { n: 17, t: '' },
      { n: 18, t: '# === Token-Hygiene: Ergebnis in Datei ===', g: 'py-hygiene', d: { t: 'Token-Hygiene in Aktion', b: 'Das vollst\u00e4ndige Ergebnis-JSON wird in eine Datei geschrieben. Auf stdout landet nur eine <b>knappe Zusammenfassung</b> und der Dateipfad. So bleibt das Kontextfenster schlank, auch wenn das Skript hunderte Checks durchf\u00fchrt.', ref: { tab: 'files', section: 'token-hygiene', label: 'Scripts & references \u2192 Token-Hygiene' } } },
      { n: 19, t: 'results = {', g: 'py-hygiene' },
      { n: 20, t: '    "manifests": check_manifests(),', g: 'py-hygiene' },
      { n: 21, t: '    "image_tags": check_image_tags(),', g: 'py-hygiene' },
      { n: 22, t: '}', g: 'py-hygiene' },
      { n: 23, t: '' },
      { n: 24, t: '# Vollst\u00e4ndiges Ergebnis in Datei, NICHT auf stdout', g: 'py-out', d: { t: 'Datei statt stdout', b: 'Die Datei <code>/tmp/deploy-check.json</code> enth\u00e4lt das vollst\u00e4ndige Ergebnis. Claude kann sie bei Bedarf lesen, aber sie verbraucht nur dann Tokens, wenn Claude sie tats\u00e4chlich \u00f6ffnet.' } },
      { n: 25, t: 'out = Path("/tmp/deploy-check.json")', g: 'py-out' },
      { n: 26, t: 'out.write_text(json.dumps(results, indent=2))', g: 'py-out' },
      { n: 27, t: '' },
      { n: 28, t: '# Nur Summary + Pfad auf stdout', g: 'py-summary', d: { t: 'Minimaler stdout = minimaler Token-Verbrauch', b: 'Nur 2 Zeilen Output: Anzahl der Checks und Dateipfad. Statt potenziell kilobytes an JSON landen nur ~50 Zeichen im Kontextfenster. Claude kann bei Bedarf die Datei lesen.' } },
      { n: 29, t: 'passed = sum(1 for ok, _ in results.values() if ok)', g: 'py-summary' },
      { n: 30, t: 'print(f"{passed}/{len(results)} checks passed")', g: 'py-summary' },
      { n: 31, t: 'print(f"Details: {out}")', g: 'py-summary' },
    ],
  },
  checklist: {
    header: 'k8s-checklist.md',
    path: 'deploy-check/references/k8s-checklist.md',
    lang: 'markdown',
    lines: [
      { n: 1, t: '# Kubernetes deployment safety checklist', g: 'ref-head', d: { t: 'Level-3-Ressource (references/)', b: 'Diese Datei wird <b>nur bei Bedarf</b> geladen \u2014 wenn Claude im Skill-Workflow auf sie verwiesen wird. Der Inhalt verbraucht erst dann Tokens. Best Practice: Dateien \u00fcber 300 Zeilen sollten ein Inhaltsverzeichnis enthalten.', ref: { tab: 'files', section: 'references-folder', label: 'Scripts & references \u2192 References-Ordner' } } },
      { n: 2, t: '' },
      { n: 3, t: '## Resource limits', g: 'ref' },
      { n: 4, t: '- Every container MUST have CPU/memory requests', g: 'ref' },
      { n: 5, t: '- Limits should be 2-3x requests for burst', g: 'ref' },
      { n: 6, t: '- No unbounded containers in production', g: 'ref' },
      { n: 7, t: '' },
      { n: 8, t: '## Health checks', g: 'ref2' },
      { n: 9, t: '- Liveness probe: TCP or HTTP, not exec', g: 'ref2' },
      { n: 10, t: '- Readiness probe: must check dependencies', g: 'ref2' },
      { n: 11, t: '- Startup probe for slow-starting apps', g: 'ref2' },
      { n: 12, t: '' },
      { n: 13, t: '## Rollout strategy', g: 'ref3' },
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

function getPlainText(fileId) {
  const f = FILES[fileId]
  if (!f.lines) return ''
  return f.lines.map(l => l.t).join('\n')
}

function buildAnnotations(fileId) {
  const f = FILES[fileId]
  if (!f.lines) return {}
  const groups = {}
  f.lines.forEach(l => {
    if (!l.g) return
    if (!groups[l.g]) groups[l.g] = { lines: [], detail: null }
    groups[l.g].lines.push(l.n)
    if (l.d) groups[l.g].detail = l.d
  })
  const result = {}
  for (const [gId, g] of Object.entries(groups)) {
    if (g.detail) {
      result[gId] = {
        startLine: Math.min(...g.lines),
        endLine: Math.max(...g.lines),
        detail: g.detail,
      }
    }
  }
  return result
}

function selectFile(id) {
  activeFile.value = id
  activeDetail.value = null
  if (FILES[id].lines && editor) {
    updateEditor(id)
  }
}

function toggleDetail(groupId) {
  if (activeDetail.value === groupId) {
    activeDetail.value = null
  } else {
    activeDetail.value = groupId
  }
  updateActiveHighlight()
}

function updateActiveHighlight() {
  if (!editor || !monaco) return
  if (activeDecoCollection) activeDecoCollection.clear()
  if (!activeDetail.value || !currentAnnotations[activeDetail.value]) return

  const ann = currentAnnotations[activeDetail.value]
  const decos = []
  for (let i = ann.startLine; i <= ann.endLine; i++) {
    decos.push({
      range: new monaco.Range(i, 1, i, 1),
      options: { isWholeLine: true, className: 'ex-block-active' },
    })
  }
  activeDecoCollection = editor.createDecorationsCollection(decos)
}

function updateEditor(fileId) {
  if (!editor || !monaco) return
  const content = getPlainText(fileId)
  const lang = FILES[fileId].lang || 'markdown'

  const model = editor.getModel()
  if (model) {
    monaco.editor.setModelLanguage(model, lang)
    model.setValue(content)
  }

  applyAnnotations(fileId)
}

function applyAnnotations(fileId) {
  currentAnnotations = buildAnnotations(fileId)

  // Block-border decorations
  const decos = []
  for (const [, ann] of Object.entries(currentAnnotations)) {
    const { startLine, endLine } = ann
    if (startLine === endLine) {
      decos.push({
        range: new monaco.Range(startLine, 1, startLine, 1),
        options: { isWholeLine: true, className: 'ex-block-single' },
      })
    } else {
      decos.push({
        range: new monaco.Range(startLine, 1, startLine, 1),
        options: { isWholeLine: true, className: 'ex-block-top' },
      })
      for (let i = startLine + 1; i < endLine; i++) {
        decos.push({
          range: new monaco.Range(i, 1, i, 1),
          options: { isWholeLine: true, className: 'ex-block-mid' },
        })
      }
      decos.push({
        range: new monaco.Range(endLine, 1, endLine, 1),
        options: { isWholeLine: true, className: 'ex-block-bottom' },
      })
    }
  }

  if (decoCollection) decoCollection.clear()
  decoCollection = editor.createDecorationsCollection(decos)

  if (activeDecoCollection) activeDecoCollection.clear()

  // View zones for annotation labels (replaces CodeLens for reliable positioning)
  editor.changeViewZones(accessor => {
    // Remove old zones
    viewZoneIds.forEach(id => accessor.removeZone(id))
    viewZoneIds = []

    for (const [gId, ann] of Object.entries(currentAnnotations)) {
      const domNode = document.createElement('div')
      domNode.className = 'ex-viewzone-label'
      domNode.textContent = '\u{1F4A1} ' + ann.detail.t
      domNode.dataset.group = gId
      domNode.addEventListener('click', (e) => {
        e.stopPropagation()
        toggleDetail(gId)
      })

      const id = accessor.addZone({
        afterLineNumber: ann.startLine - 1,
        heightInPx: 20,
        domNode,
      })
      viewZoneIds.push(id)
    }
  })
}

const currentDetail = computed(() => {
  if (!activeDetail.value || !currentAnnotations[activeDetail.value]) return null
  return currentAnnotations[activeDetail.value].detail
})

onMounted(async () => {
  // Import monaco-editor directly; Slidev's setup uses the same package
  const monacoModule = await import('monaco-editor')
  monaco = monacoModule

  if (!editorContainer.value) return

  // Define GitHub Dark & Light themes
  monaco.editor.defineTheme('github-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'constant', foreground: '79b8ff' },
      { token: 'entity.name', foreground: 'b392f0' },
      { token: 'keyword', foreground: 'f97583' },
      { token: 'storage', foreground: 'f97583' },
      { token: 'string', foreground: '9ecbff' },
      { token: 'support', foreground: '79b8ff' },
      { token: 'variable', foreground: 'ffab70' },
      { token: 'tag', foreground: '85e89d' },
      { token: 'type', foreground: '79b8ff' },
      { token: 'number', foreground: '79b8ff' },
    ],
    colors: {
      'editor.background': '#24292e',
      'editor.foreground': '#e1e4e8',
      'editorLineNumber.foreground': '#444d56',
      'editorLineNumber.activeForeground': '#e1e4e8',
      'editor.selectionBackground': '#3392FF44',
      'editor.lineHighlightBackground': '#2b3036',
      'editorWidget.background': '#1f2428',
      'editorGutter.background': '#24292e',
      'editorCodeLens.foreground': '#8b949e',
    },
  })

  monaco.editor.defineTheme('github-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'constant', foreground: '005cc5' },
      { token: 'entity.name', foreground: '6f42c1' },
      { token: 'keyword', foreground: 'd73a49' },
      { token: 'storage', foreground: 'd73a49' },
      { token: 'string', foreground: '032f62' },
      { token: 'support', foreground: '005cc5' },
      { token: 'variable', foreground: 'e36209' },
      { token: 'tag', foreground: '22863a' },
      { token: 'type', foreground: '005cc5' },
      { token: 'number', foreground: '005cc5' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#24292e',
      'editorLineNumber.foreground': '#1b1f234d',
      'editorLineNumber.activeForeground': '#24292e',
      'editor.selectionBackground': '#0366d625',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editorWidget.background': '#f6f8fa',
      'editorGutter.background': '#ffffff',
      'editorCodeLens.foreground': '#6a737d',
    },
  })

  editor = monaco.editor.create(editorContainer.value, {
    value: getPlainText('skill'),
    language: 'yaml',
    theme: isDark.value ? 'github-dark' : 'github-light',
    readOnly: true,
    automaticLayout: true,
    fontSize: 12,
    lineHeight: 26,
    fontFamily: 'var(--font-mono)',
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    glyphMargin: false,
    folding: false,
    renderLineHighlight: 'none',
    codeLens: false,
    scrollbar: { vertical: 'auto', horizontal: 'auto' },
    padding: { top: 8, bottom: 8 },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    contextmenu: false,
    wordWrap: 'off',
    lineDecorationsWidth: 0,
    bracketPairColorization: { enabled: false },
  })

  // Switch theme when dark mode changes
  watchEffect(() => {
    monaco.editor.setTheme(isDark.value ? 'github-dark' : 'github-light')
  })

  applyAnnotations('skill')
})

onBeforeUnmount(() => {
  editor?.dispose()
})
</script>

<template>
  <div class="ex">
    <div class="ex-hint">
      <span class="dot" />
      Annotationen sind klickbar und zeigen Erkl&auml;rungen
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

        <!-- Monaco editor for files -->
        <template v-else-if="FILES[activeFile].lines">
          <div ref="editorContainer" class="editor-container" />

          <!-- Detail panel -->
          <div v-if="currentDetail" class="detail-pan">
            <div class="dt">{{ currentDetail.t }}</div>
            <span v-html="currentDetail.b" />
            <div v-if="currentDetail.ref" class="ref">
              <CrossRefLink
                :tab="currentDetail.ref.tab"
                :section="currentDetail.ref.section"
                :label="currentDetail.ref.label"
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
.ex-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 0; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--sk-rad); overflow: hidden; min-height: 420px; }
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
.content-pan { padding: 16px; overflow-y: auto; background: var(--color-background-primary); display: flex; flex-direction: column; }
.file-header { font-size: 13px; font-weight: 500; margin-bottom: 12px; }
.file-path { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-secondary); }
.welcome { font-size: 13px; color: var(--color-text-secondary); line-height: 1.7; padding: 20px 0; }
.editor-container { flex: 1; min-height: 360px; border-radius: var(--sk-radm); overflow: hidden; border: 0.5px solid var(--color-border-tertiary); }
.detail-pan { border: 0.5px solid var(--color-border-info); border-radius: var(--sk-radm); padding: 10px 14px; margin-top: 12px; background: var(--color-background-info); font-size: 12px; line-height: 1.6; color: var(--color-text-info); flex-shrink: 0; }
.detail-pan .dt { font-weight: 500; margin-bottom: 4px; font-size: 13px; }
.detail-pan :deep(code) { font-family: var(--font-mono); font-size: 11px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; }
.detail-pan :deep(.badge-s) { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: var(--sk-radm); font-weight: 500; margin-left: 4px; vertical-align: middle; }
.detail-pan :deep(.b-cc) { background: var(--color-background-warning); color: var(--color-text-warning); }
.ref { font-size: 11px; margin-top: 6px; }
</style>

<!-- Global styles for Monaco decorations (cannot be scoped) -->
<style>
/* Block-border decorations — inset box-shadow to avoid layout shifts */
.ex-block-top {
  background: var(--color-background-info) !important;
  box-shadow: inset 0 2px 0 var(--color-border-info), inset 2px 0 0 var(--color-border-info), inset -2px 0 0 var(--color-border-info) !important;
}
.ex-block-mid {
  background: var(--color-background-info) !important;
  box-shadow: inset 2px 0 0 var(--color-border-info), inset -2px 0 0 var(--color-border-info) !important;
}
.ex-block-bottom {
  background: var(--color-background-info) !important;
  box-shadow: inset 0 -2px 0 var(--color-border-info), inset 2px 0 0 var(--color-border-info), inset -2px 0 0 var(--color-border-info) !important;
}
.ex-block-single {
  background: var(--color-background-info) !important;
  box-shadow: inset 0 2px 0 var(--color-border-info), inset 0 -2px 0 var(--color-border-info), inset 2px 0 0 var(--color-border-info), inset -2px 0 0 var(--color-border-info) !important;
}

/* Active/selected group highlight */
.ex-block-active {
  background: color-mix(in srgb, var(--color-background-info) 80%, var(--color-text-info) 20%) !important;
}

/* View zone labels */
.ex-viewzone-label {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-tertiary);
  padding: 2px 8px 0 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 18px;
  pointer-events: auto !important;
  position: relative;
  z-index: 10;
  transition: color 0.15s;
}
.ex-viewzone-label:hover {
  color: var(--color-text-info);
}

/* Allow clicks through to view zones */
.editor-container .monaco-editor .view-zones {
  pointer-events: none !important;
}
.editor-container .monaco-editor .view-zones > * {
  pointer-events: auto !important;
}
</style>
