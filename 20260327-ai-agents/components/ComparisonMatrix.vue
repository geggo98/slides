<script setup>
import { ref } from 'vue'

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

const Y = '<span style="color:#639922;font-weight:600">✓</span>'
const N = '<span style="color:#A32D2D">✗</span>'
const P = '<span style="color:#BA7517;font-weight:500">◐</span>'

const features = [
  { name: 'Hook-Events', claude: '12+', codex: '2', wind: '12', junie: N, oc: '30+', gemini: '10' },
  { name: 'Pre-Tool-Block', claude: Y, codex: N, wind: Y, junie: N, oc: Y, gemini: Y },
  { name: 'Worktrees nativ', claude: Y, codex: Y, wind: Y, junie: Y, oc: N, gemini: N },
  { name: 'Plugin-System', claude: Y, codex: N, wind: P, junie: N, oc: Y, gemini: Y },
  { name: 'AGENTS.md', claude: N, codex: Y, wind: Y, junie: Y, oc: Y, gemini: P },
  { name: 'SKILL.md-Format', claude: Y, codex: Y, wind: Y, junie: Y, oc: Y, gemini: Y },
  { name: 'MCP Support', claude: Y, codex: Y, wind: Y, junie: Y, oc: Y, gemini: Y },
  { name: 'LSP nativ', claude: Y, codex: P, wind: Y, junie: Y, oc: Y, gemini: N },
  { name: 'ACP-kompatibel', claude: Y, codex: Y, wind: N, junie: Y, oc: N, gemini: Y },
]

const compatData = {
  claude: { claude: '—', codex: P, wind: P, junie: Y, oc: Y, gemini: P },
  codex: { claude: P, codex: '—', wind: Y, junie: Y, oc: Y, gemini: Y },
  wind: { claude: P, codex: Y, wind: '—', junie: Y, oc: Y, gemini: Y },
  junie: { claude: Y, codex: Y, wind: Y, junie: '—', oc: Y, gemini: Y },
  oc: { claude: Y, codex: Y, wind: Y, junie: Y, oc: '—', gemini: Y },
  gemini: { claude: P, codex: Y, wind: Y, junie: Y, oc: Y, gemini: '—' },
}
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
  border-radius: 4px; border: 1px solid rgba(0,0,0,0.1);
  background: transparent; color: #888; cursor: pointer;
}
.tabs button.active { background: #f3f2ee; color: #1a1a18; }
.table-wrap { overflow-x: auto; }
.mtx {
  width: 100%; border-collapse: collapse; font-size: 11px;
  background: white; border-radius: 8px; overflow: hidden;
  border: 1px solid rgba(0,0,0,0.1); color: #1a1a18;
}
.mtx th {
  text-align: left; padding: 6px 8px; font-weight: 600; font-size: 10px;
  background: #f3f2ee; color: #5f5e5a; border-bottom: 1px solid rgba(0,0,0,0.1);
}
.mtx td {
  padding: 5px 8px; border-bottom: 1px solid rgba(0,0,0,0.06); vertical-align: top;
  color: #1a1a18;
}
.mtx tr:last-child td { border-bottom: none; }
.tool-name { font-weight: 600; white-space: nowrap; font-size: 10px; color: #1a1a18; }
.mono { font-family: 'Fira Code', monospace; font-size: 9px; color: #5f5e5a; }
</style>
