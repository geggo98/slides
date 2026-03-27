<script setup>
import { ref } from 'vue'

const openProto = ref(null)
const toggle = (name) => { openProto.value = openProto.value === name ? null : name }

const Y = '<span style="color:#639922;font-weight:600">✓</span>'
const N = '<span style="color:#A32D2D">✗</span>'
const P = '<span style="color:#BA7517;font-weight:500">◐</span>'

const protocols = [
  {
    name: 'LSP', icon: '👁', by: 'Microsoft, 2016',
    purpose: 'Semantisches Code-Verständnis: Go-to-Definition, Find-References, Diagnostics. Gibt dem Agenten "IDE-Augen".',
    bg: '#E6F1FB', color: '#0C447C', direction: 'Agent → Code', dirBg: '#E6F1FB', dirColor: '#0C447C',
    transport: 'JSON-RPC stdio/socket',
    support: [
      { tool: 'Claude Code', level: Y, detail: 'Nativ seit v2.0.74, 22+ Sprachen' },
      { tool: 'OpenCode', level: Y, detail: '30+ Language Server, Auto-Install' },
      { tool: 'Windsurf', level: Y, detail: 'IDE-integriert (VS Code Fork)' },
      { tool: 'Junie', level: Y, detail: 'JetBrains-eigene Code-Intelligence' },
      { tool: 'Codex', level: P, detail: 'Kein expliziter LSP' },
      { tool: 'Gemini CLI', level: N, detail: 'Terminal-basiert, kein LSP' },
    ],
  },
  {
    name: 'MCP', icon: '🔌', by: 'Anthropic, 2024',
    purpose: 'Externe Tool-/Datenanbindung: Datenbanken, APIs, Issue-Tracker. "Hände für die Außenwelt".',
    bg: '#E1F5EE', color: '#085041', direction: 'Agent → Externe Welt', dirBg: '#E1F5EE', dirColor: '#085041',
    transport: 'JSON-RPC stdio/HTTP/SSE',
    support: [
      { tool: 'Claude Code', level: Y, detail: '.mcp.json, drei Scopes, CLI-Wizard' },
      { tool: 'Codex', level: Y, detail: 'config.toml, OAuth-Flows' },
      { tool: 'Windsurf', level: Y, detail: 'MCP Marketplace, 100-Tool-Limit' },
      { tool: 'Junie', level: Y, detail: '.junie/mcp/, AI-powered Wizard' },
      { tool: 'OpenCode', level: Y, detail: 'Remote-MCP via .well-known/opencode' },
      { tool: 'Gemini CLI', level: Y, detail: 'settings.json, Extensions' },
    ],
  },
  {
    name: 'ACP', icon: '🤝', by: 'Zed + JetBrains, 2025',
    purpose: 'Agent ↔ IDE-Kommunikation: jeder Agent in jeder IDE. "LSP für AI-Agenten".',
    bg: '#EEEDFE', color: '#3C3489', direction: 'Agent ↔ IDE', dirBg: '#EEEDFE', dirColor: '#3C3489',
    transport: 'JSON-RPC stdio',
    support: [
      { tool: 'Claude Code', level: Y, detail: 'In JetBrains-IDEs und Zed' },
      { tool: 'Codex', level: Y, detail: 'In JetBrains ab 2026.1' },
      { tool: 'Junie', level: Y, detail: 'JetBrains-nativ, ACP-kompatibel' },
      { tool: 'Gemini CLI', level: Y, detail: 'Via ACP in JetBrains und Zed' },
      { tool: 'Windsurf', level: N, detail: 'Eigene IDE, kein ACP' },
      { tool: 'OpenCode', level: N, detail: 'Kein ACP dokumentiert' },
    ],
  },
]

const stack = [
  { name: 'ACP: Agent ↔ IDE', question: '"Welcher Agent arbeitet in welcher IDE?"', bg: '#EEEDFE', border: '#534AB7', color: '#3C3489' },
  { name: 'MCP: Agent → Externe Welt', question: '"Woher kommen die Daten?"', bg: '#E1F5EE', border: '#0F6E56', color: '#085041' },
  { name: 'LSP: Agent → Code-Verständnis', question: '"Was bedeutet dieser Code semantisch?"', bg: '#E6F1FB', border: '#185FA5', color: '#0C447C' },
]
</script>

<template>
  <p style="font-size: 11px; color: #888; margin-bottom: 8px;">
    Drei Protokolle, drei Schichten — <strong>orthogonal</strong>, nicht hierarchisch. Klick für Support-Details.
  </p>

  <div class="proto-list">
    <div
      v-for="pr in protocols"
      :key="pr.name"
      class="proto-card"
      @click="toggle(pr.name)"
    >
      <div class="proto-header">
        <div class="proto-icon" :style="{ background: pr.bg, color: pr.color }">{{ pr.icon }}</div>
        <div>
          <div class="proto-title">{{ pr.name }}</div>
          <div class="proto-by">{{ pr.by }}</div>
        </div>
      </div>
      <div class="proto-purpose">{{ pr.purpose }}</div>
      <div class="proto-badges">
        <span class="badge" :style="{ background: pr.dirBg, color: pr.dirColor }">{{ pr.direction }}</span>
        <span class="badge neutral">{{ pr.transport }}</span>
      </div>
      <div v-if="openProto === pr.name" class="proto-detail" @click.stop>
        <table class="support-table">
          <thead><tr><th>Tool</th><th>Support</th><th>Details</th></tr></thead>
          <tbody>
            <tr v-for="s in pr.support" :key="s.tool">
              <td class="tool-name">{{ s.tool }}</td>
              <td v-html="s.level" />
              <td class="detail-text">{{ s.detail }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="stack-label">Drei Protokolle, drei Fragen</div>
  <div class="stack">
    <div v-for="(q, i) in stack" :key="q.name">
      <div class="stack-box" :style="{ background: q.bg, borderColor: q.border }">
        <div class="stack-name" :style="{ color: q.color }">{{ q.name }}</div>
        <div class="stack-q">{{ q.question }}</div>
      </div>
      <div v-if="i < stack.length - 1" class="stack-plus">+</div>
    </div>
  </div>
</template>

<style scoped>
.proto-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.proto-card {
  background: white; border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px; padding: 8px 10px; cursor: pointer;
  color: #1a1a18;
}
.proto-card:hover { border-color: #888; }
.proto-header { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.proto-icon {
  width: 24px; height: 24px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.proto-title { font-size: 12px; font-weight: 600; }
.proto-by { font-size: 8px; color: #888; }
.proto-purpose { font-size: 9px; color: #333; line-height: 1.3; }
.proto-badges { margin-top: 3px; }
.badge {
  display: inline-block; font-size: 8px; font-weight: 600;
  padding: 1px 5px; border-radius: 6px; margin-right: 2px;
}
.badge.neutral { background: #f3f2ee; color: #333; }
.proto-detail {
  margin-top: 6px; padding: 5px;
  background: white; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08);
}
.support-table {
  width: 100%; border-collapse: collapse; font-size: 8px; color: #1a1a18;
}
.support-table th {
  text-align: left; padding: 2px 4px; font-weight: 600;
  border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 7px; color: #555;
}
.support-table td { padding: 2px 4px; border-bottom: 1px solid rgba(0,0,0,0.04); color: #1a1a18; }
.tool-name { font-weight: 600; font-size: 8px; white-space: nowrap; color: #1a1a18; }
.detail-text { font-size: 7px; color: #333; }
.stack-label {
  font-size: 9px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.8px; color: #888; margin: 8px 0 4px;
}
.stack { display: flex; gap: 6px; align-items: stretch; }
.stack > div { flex: 1; display: flex; flex-direction: column; align-items: center; }
.stack-box {
  padding: 6px 8px; border-radius: 6px; border: 1px solid;
  text-align: center; width: 100%;
}
.stack-name { font-weight: 600; font-size: 10px; }
.stack-q { font-size: 8px; color: #333; }
.stack-plus { text-align: center; color: #888; font-size: 10px; margin: 2px 0; display: none; }
</style>
