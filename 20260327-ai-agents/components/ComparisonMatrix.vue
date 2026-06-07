<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";

const { isDark } = useDarkMode();

const tab = ref("files");
const tabs = [
  { key: "files", label: "Dateien" },
  { key: "features", label: "Features" },
  { key: "compat", label: "Kompatibilität" },
];

const tools = [
  {
    name: "Claude Code",
    short: "Claude",
    key: "claude",
    instrFile: "CLAUDE.md",
    skills: ".claude/skills/",
    hooks: "settings.json",
    mcp: ".mcp.json",
    subagents: ".claude/agents/",
  },
  {
    name: "Codex",
    short: "Codex",
    key: "codex",
    instrFile: "AGENTS.md",
    skills: ".codex/skills/",
    hooks: "config.toml notify",
    mcp: "config.toml",
    subagents: ".codex/agents/",
  },
  {
    name: "Windsurf",
    short: "Wind",
    key: "wind",
    instrFile: ".windsurf/rules/",
    skills: ".windsurf/skills/",
    hooks: "hooks.json",
    mcp: "mcp_config.json",
    subagents: "—",
  },
  {
    name: "Junie",
    short: "Junie",
    key: "junie",
    instrFile: ".junie/AGENTS.md",
    skills: ".junie/skills/",
    hooks: "Allowlist",
    mcp: ".junie/mcp/",
    subagents: "Custom",
  },
  {
    name: "OpenCode",
    short: "OC",
    key: "oc",
    instrFile: "AGENTS.md",
    skills: ".opencode/skills/",
    hooks: "JS/TS Plugins",
    mcp: "opencode.json",
    subagents: ".opencode/agents/",
  },
  {
    name: "Gemini CLI",
    short: "Gemini",
    key: "gemini",
    instrFile: "GEMINI.md",
    skills: "Extension skills/",
    hooks: "settings.json",
    mcp: "settings.json",
    subagents: "Preview",
  },
];

const Y = computed(() => {
  const c = isDark.value ? "#639922" : "#639922";
  return `<span style="color:${c};font-weight:600">✓</span>`;
});
const N = computed(() => {
  const c = isDark.value ? "#f06060" : "#A32D2D";
  return `<span style="color:${c}">✗</span>`;
});
const Partial = computed(() => {
  const c = isDark.value ? "#e0a030" : "#BA7517";
  return `<span style="color:${c};font-weight:500">◐</span>`;
});

const C = computed(() => {
  const d = isDark.value;
  return {
    tabBtnBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    tabBtnColor: d ? "#aaa" : "#888",
    tabActiveBg: d ? "#2a2a2e" : "#f3f2ee",
    tabActiveColor: d ? "#e5e5e5" : "#1a1a18",
    tableBg: d ? "#1e1e1e" : "white",
    tableBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    tableColor: d ? "#e5e5e5" : "#1a1a18",
    thBg: d ? "#2a2a2e" : "#f3f2ee",
    thColor: d ? "#999" : "#5f5e5a",
    thBorderBottom: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    tdBorderBottom: d ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tdColor: d ? "#e5e5e5" : "#1a1a18",
    toolNameColor: d ? "#e5e5e5" : "#1a1a18",
    monoColor: d ? "#999" : "#5f5e5a",
  };
});

const features = computed(() => [
  {
    name: "Hook-Events",
    claude: "12+",
    codex: "2",
    wind: "12",
    junie: N.value,
    oc: "30+",
    gemini: "10",
  },
  {
    name: "Pre-Tool-Block",
    claude: Y.value,
    codex: N.value,
    wind: Y.value,
    junie: N.value,
    oc: Y.value,
    gemini: Y.value,
  },
  {
    name: "Worktrees nativ",
    claude: Y.value,
    codex: Y.value,
    wind: Y.value,
    junie: Y.value,
    oc: N.value,
    gemini: N.value,
  },
  {
    name: "Plugin-System",
    claude: Y.value,
    codex: N.value,
    wind: Partial.value,
    junie: N.value,
    oc: Y.value,
    gemini: Y.value,
  },
  {
    name: "AGENTS.md",
    claude: N.value,
    codex: Y.value,
    wind: Y.value,
    junie: Y.value,
    oc: Y.value,
    gemini: Partial.value,
  },
  {
    name: "SKILL.md-Format",
    claude: Y.value,
    codex: Y.value,
    wind: Y.value,
    junie: Y.value,
    oc: Y.value,
    gemini: Y.value,
  },
  {
    name: "MCP Support",
    claude: Y.value,
    codex: Y.value,
    wind: Y.value,
    junie: Y.value,
    oc: Y.value,
    gemini: Y.value,
  },
  {
    name: "LSP nativ",
    claude: Y.value,
    codex: Partial.value,
    wind: Y.value,
    junie: Y.value,
    oc: Y.value,
    gemini: N.value,
  },
  {
    name: "ACP-kompatibel",
    claude: Y.value,
    codex: Y.value,
    wind: N.value,
    junie: Y.value,
    oc: N.value,
    gemini: Y.value,
  },
]);

const compatData = computed(() => ({
  claude: {
    claude: "—",
    codex: Partial.value,
    wind: Partial.value,
    junie: Y.value,
    oc: Y.value,
    gemini: Partial.value,
  },
  codex: {
    claude: Partial.value,
    codex: "—",
    wind: Y.value,
    junie: Y.value,
    oc: Y.value,
    gemini: Y.value,
  },
  wind: {
    claude: Partial.value,
    codex: Y.value,
    wind: "—",
    junie: Y.value,
    oc: Y.value,
    gemini: Y.value,
  },
  junie: {
    claude: Y.value,
    codex: Y.value,
    wind: Y.value,
    junie: "—",
    oc: Y.value,
    gemini: Y.value,
  },
  oc: {
    claude: Y.value,
    codex: Y.value,
    wind: Y.value,
    junie: Y.value,
    oc: "—",
    gemini: Y.value,
  },
  gemini: {
    claude: Partial.value,
    codex: Y.value,
    wind: Y.value,
    junie: Y.value,
    oc: Y.value,
    gemini: "—",
  },
}));

const tabVars = computed(() => ({
  "--sk-tab-gap": "4px",
  "--sk-tab-bar-mb": "10px",
  "--sk-tab-font-size": "10px",
  "--sk-tab-font-weight": "500",
  "--sk-tab-pad": "3px 10px",
  "--sk-tab-radius": "4px",
  "--sk-tab-border": `1px solid ${C.value.tabBtnBorder}`,
  "--sk-tab-bg": "transparent",
  "--sk-tab-color": C.value.tabBtnColor,
  "--sk-tab-hover-bg": "transparent",
  "--sk-tab-transition": "none",
  "--sk-tab-active-bg": C.value.tabActiveBg,
  "--sk-tab-active-color": C.value.tabActiveColor,
  "--sk-tab-active-border": C.value.tabBtnBorder,
}));
</script>

<template>
  <div class="cmx-tabs" :style="tabVars">
    <Tabs v-model="tab" :tabs="tabs" aria-label="Vergleichsmatrix">
      <template #files>
        <div class="table-wrap">
          <table class="mtx">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Instruktionsdatei</th>
                <th>Skills</th>
                <th>Hooks</th>
                <th>MCP</th>
                <th>Subagents</th>
              </tr>
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
        </div>
      </template>

      <template #features>
        <div class="table-wrap">
          <table class="mtx">
            <thead>
              <tr>
                <th>Feature</th>
                <th v-for="t in tools" :key="t.key">{{ t.short }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in features" :key="f.name">
                <td style="font-weight: 500">{{ f.name }}</td>
                <td v-for="t in tools" :key="t.key" v-html="f[t.key]" />
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template #compat>
        <div class="table-wrap">
          <table class="mtx">
            <thead>
              <tr>
                <th>Von \ Nach</th>
                <th v-for="t in tools" :key="t.key">{{ t.short }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tools" :key="t.key">
                <td class="tool-name">{{ t.short }}</td>
                <td
                  v-for="t2 in tools"
                  :key="t2.key"
                  v-html="compatData[t.key]?.[t2.key] ?? '—'"
                />
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </Tabs>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}
.mtx {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  background: v-bind("C.tableBg");
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid v-bind("C.tableBorder");
  color: v-bind("C.tableColor");
}
.mtx th {
  text-align: left;
  padding: 6px 8px;
  font-weight: 600;
  font-size: 10px;
  background: v-bind("C.thBg");
  color: v-bind("C.thColor");
  border-bottom: 1px solid v-bind("C.thBorderBottom");
}
.mtx td {
  padding: 5px 8px;
  border-bottom: 1px solid v-bind("C.tdBorderBottom");
  vertical-align: top;
  color: v-bind("C.tdColor");
}
.mtx tr:last-child td {
  border-bottom: none;
}
.tool-name {
  font-weight: 600;
  white-space: nowrap;
  font-size: 10px;
  color: v-bind("C.toolNameColor");
}
.mono {
  font-family: "Fira Code", monospace;
  font-size: 9px;
  color: v-bind("C.monoColor");
}
</style>
