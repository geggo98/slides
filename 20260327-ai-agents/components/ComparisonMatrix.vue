<script setup>
import { ref, computed } from 'vue'
import { useDarkMode } from '@slidev/client'

const { isDark } = useDarkMode()

const tab = ref('files')
const tabs = [
  { id: 'files', label: 'Dateien' },
  { id: 'features', label: 'Features' },
  { id: 'compat', label: 'Kompatibilität' },
]

const tools = [
  { name: 'Claude Code', short: 'Claude', key: 'claude', instrFile: 'CLAUDE.md', skills: '.claude/skills/', hooks: 'settings.json', mcp: '.mcp.json', subagents: '.claude/agents/' },
  { name: 'Codex', short: 'Codex', key: 'codex', instrFile: 'AGENTS.md', skills: '.codex/skills/', hooks: 'config.toml notify', mcp: 'config.toml', subagents: '.codex/agents/' },
  { name: 'Windsurf', short: 'Wind', key: 'wind', instrFile: '.windsurf/rules/', skills: '.windsurf/skills/', hooks: 'hooks.json', mcp: 'mcp_config.json', subagents: '—' },
  { name: 'Junie', short: 'Junie', key: 'junie', instrFile: '.junie/AGENTS.md', skills: '.junie/skills/', hooks: 'Allowlist', mcp: '.junie/mcp/', subagents: 'Custom' },
  { name: 'OpenCode', short: 'OC', key: 'oc', instrFile: 'AGENTS.md', skills: '.opencode/skills/', hooks: 'JS/TS Plugins', mcp: 'opencode.json', subagents: '.opencode/agents/' },
  { name: 'Gemini CLI', short: 'Gemini', key: 'gemini', instrFile: 'GEMINI.md', skills: 'Extension skills/', hooks: 'settings.json', mcp: 'settings.json', subagents: 'Preview' },
]

const Y = computed(() => isDark.value
  ? '<span style="color:#639922;font-weight:600">✓</span>'
  : '<span style="color:#639922;font-weight:600">✓</span>')
const N = computed(() => isDark.value
  ? '<span style="color:#f06060">✗</span>'
  : '<span style="color:#A32D2D">✗</span>')
const Partial = computed(() => isDark.value
  ? '<span style="color:#e0a030;font-weight:500">◐</span>'
  : '<span style="color:#BA7517;font-weight:500">◐</span>')

const C = computed(() => isDark.value ? {
  tabBtnBorder: 'rgba(255,255,255,0.12)',
  tabBtnColor: '#aaa',
  tabActiveBg: '#2a2a2e',
  tabActiveColor: '#e5e5e5',
  tableBg: '#1e1e1e',
  tableBorder: 'rgba(255,255,255,0.12)',
  tableColor: '#e5e5e5',
  thBg: '#2a2a2e',
  thColor: '#999',
  thBorderBottom: 'rgba(255,255,255,0.12)',
  tdBorderBottom: 'rgba(255,255,255,0.06)',
  tdColor: '#e5e5e5',
  toolNameColor: '#e5e5e5',
  monoColor: '#999',
} : {
  tabBtnBorder: 'rgba(0,0,0,0.1)',
  tabBtnColor: '#888',
  tabActiveBg: '#f3f2ee',
  tabActiveColor: '#1a1a18',
  tableBg: 'white',
  tableBorder: 'rgba(0,0,0,0.1)',
  tableColor: '#1a1a18',
  thBg: '#f3f2ee',
  thColor: '#5f5e5a',
  thBorderBottom: 'rgba(0,0,0,0.1)',
  tdBorderBottom: 'rgba(0,0,0,0.06)',
  tdColor: '#1a1a18',
  toolNameColor: '#1a1a18',
  monoColor: '#5f5e5a',
})

const features = computed(() => [
  { name: 'Hook-Events', claude: '12+', codex: '2', wind: '12', junie: N.value, oc: '30+', gemini: '10' },
  { name: 'Pre-Tool-Block', claude: Y.value, codex: N.value, wind: Y.value, junie: N.value, oc: Y.value, gemini: Y.value },
  { name: 'Worktrees nativ', claude: Y.value, codex: Y.value, wind: Y.value, junie: Y.value, oc: N.value, gemini: N.value },
  { name: 'Plugin-System', claude: Y.value, codex: N.value, wind: Partial.value, junie: N.value, oc: Y.value, gemini: Y.value },
  { name: 'AGENTS.md', claude: N.value, codex: Y.value, wind: Y.value, junie: Y.value, oc: Y.value, gemini: Partial.value },
  { name: 'SKILL.md-Format', claude: Y.value, codex: Y.value, wind: Y.value, junie: Y.value, oc: Y.value, gemini: Y.value },
  { name: 'MCP Support', claude: Y.value, codex: Y.value, wind: Y.value, junie: Y.value, oc: Y.value, gemini: Y.value },
  { name: 'LSP nativ', claude: Y.value, codex: Partial.value, wind: Y.value, junie: Y.value, oc: Y.value, gemini: N.value },
  { name: 'ACP-kompatibel', claude: Y.value, codex: Y.value, wind: N.value, junie: Y.value, oc: N.value, gemini: Y.value },
])

const compatData = computed(() => ({
  claude: { claude: '—', codex: Partial.value, wind: Partial.value, junie: Y.value, oc: Y.value, gemini: Partial.value },
  codex: { claude: Partial.value, codex: '—', wind: Y.value, junie: Y.value, oc: Y.value, gemini: Y.value },
  wind: { claude: Partial.value, codex: Y.value, wind: '—', junie: Y.value, oc: Y.value, gemini: Y.value },
  junie: { claude: Y.value, codex: Y.value, wind: Y.value, junie: '—', oc: Y.value, gemini: Y.value },
  oc: { claude: Y.value, codex: Y.value, wind: Y.value, junie: Y.value, oc: '—', gemini: Y.value },
  gemini: { claude: Partial.value, codex: Y.value, wind: Y.value, junie: Y.value, oc: Y.value, gemini: '—' },
}))
</script>

<template>
  <div class="tabs">
    <button
      v-for="t in tabs"
      :key="t.id"
      :class="{ active: tab === t.id }"
      @click.stop="tab = t.id"
    >
      {{ t.label }}
    </button>
  </div>

  <div class="table-wrap">
    <table v-if="tab === 'files'" class="mtx">
      <thead>
        <tr><th>Tool</th><th>Instruktionsdatei</th><th>Skills</th><th>Hooks</th><th>MCP</th><th>Subagents</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in tools" :key="t.key">
          <td class="tool-name">{{ t.name }}</td>
          <td class="mono">{{ t.instrFile }}</td>
          <td class="mono">{{ t.skills }}</td>
          <td class="mono">{{ t.hooks }}</td>
          <td class="mono">{{ t.mcp }}</td>
          <td class="mono">{{ t.subagents }}</td>
        </tr>
      </tbody>
    </table>

    <table v-if="tab === 'features'" class="mtx">
      <thead>
        <tr><th>Feature</th><th v-for="t in tools" :key="t.key">{{ t.short }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="f in features" :key="f.name">
          <td style="font-weight:500">{{ f.name }}</td>
          <td v-for="t in tools" :key="t.key" v-html="f[t.key]" />
        </tr>
      </tbody>
    </table>

    <table v-if="tab === 'compat'" class="mtx">
      <thead>
        <tr><th>Von \ Nach</th><th v-for="t in tools" :key="t.key">{{ t.short }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in tools" :key="t.key">
          <td class="tool-name">{{ t.short }}</td>
          <td v-for="t2 in tools" :key="t2.key" v-html="compatData[t.key]?.[t2.key] ?? '—'" />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.tabs button {
  font-size: 10px; font-weight: 500; padding: 3px 10px;
  border-radius: 4px; border: 1px solid v-bind('C.tabBtnBorder');
  background: transparent; color: v-bind('C.tabBtnColor'); cursor: pointer;
}
.tabs button.active { background: v-bind('C.tabActiveBg'); color: v-bind('C.tabActiveColor'); }
.table-wrap { overflow-x: auto; }
.mtx {
  width: 100%; border-collapse: collapse; font-size: 11px;
  background: v-bind('C.tableBg'); border-radius: 8px; overflow: hidden;
  border: 1px solid v-bind('C.tableBorder'); color: v-bind('C.tableColor');
}
.mtx th {
  text-align: left; padding: 6px 8px; font-weight: 600; font-size: 10px;
  background: v-bind('C.thBg'); color: v-bind('C.thColor'); border-bottom: 1px solid v-bind('C.thBorderBottom');
}
.mtx td {
  padding: 5px 8px; border-bottom: 1px solid v-bind('C.tdBorderBottom'); vertical-align: top;
  color: v-bind('C.tdColor');
}
.mtx tr:last-child td { border-bottom: none; }
.tool-name { font-weight: 600; white-space: nowrap; font-size: 10px; color: v-bind('C.toolNameColor'); }
.mono { font-family: 'Fira Code', monospace; font-size: 9px; color: v-bind('C.monoColor'); }
</style>
