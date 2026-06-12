<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import Badge from "./Badge.vue";
import { AGENT_COLORS } from "./chartData";
import { resolveColor } from "./chartConfig";
import { useDeckPalette } from "./palette";

const { isDark } = useDarkMode();
const P = useDeckPalette();

const rows = [
  {
    feature: "Sprache",
    cc: "TypeScript",
    codex: "Rust",
    gemini: "TypeScript",
    pi: "TypeScript",
    opencode: "TypeScript",
    cursor: "(IDE)",
  },
  {
    feature: "Open Source",
    cc: "n",
    codex: "y",
    gemini: "y",
    pi: "y",
    opencode: "y",
    cursor: "n",
  },
  {
    feature: "Tools",
    cc: "19+",
    codex: "~6",
    gemini: "~12",
    pi: "4",
    opencode: "~9",
    cursor: "~8",
  },
  {
    feature: "MCP",
    cc: "Client",
    codex: "Client+Server",
    gemini: "Client",
    pi: "Nein",
    opencode: "Client",
    cursor: "Client",
  },
  {
    feature: "Subagents",
    cc: "Ja (Tiefe 1)",
    codex: "Parallel",
    gemini: "A2A (exp.)",
    pi: "Nein",
    opencode: "@general",
    cursor: "Bis 8 parallel",
  },
  {
    feature: "Sandboxing",
    cc: "AST-Parser",
    codex: "OS-native",
    gemini: "Docker/gVisor",
    pi: "Keines",
    opencode: "Konfigurierbar",
    cursor: "IDE+Cloud",
  },
  {
    feature: "Memory",
    cc: "CLAUDE.md",
    codex: "AGENTS.md",
    gemini: "GEMINI.md",
    pi: "AGENTS.md",
    opencode: "Rules",
    cursor: ".cursorrules",
  },
  {
    feature: "Multi-Provider",
    cc: "Nein",
    codex: "OpenAI-Fokus",
    gemini: "Nein",
    pi: "15+ Provider",
    opencode: "Multi",
    cursor: "Eigene+alle",
  },
  {
    feature: "Context",
    cc: "200K (1M)",
    codex: "Modell-abh.",
    gemini: "1M",
    pi: "Provider-abh.",
    opencode: "Provider-abh.",
    cursor: "Provider-abh.",
  },
  {
    feature: "System-Prompt",
    cc: "Multi-K Tok.",
    codex: "Mittel",
    gemini: "Mittel",
    pi: "<1K Tokens",
    opencode: "Mittel",
    cursor: "Mittel",
  },
];

const agents = ["cc", "codex", "gemini", "pi", "opencode", "cursor"] as const;
const agentNames: Record<string, string> = {
  cc: "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  pi: "Pi",
  opencode: "OpenCode",
  cursor: "Cursor",
};
// Agentenfarben aus AGENT_COLORS: Dark-Mode helle 400er-Töne, Light-Mode
// die dunkleren 600er/700er derselben Skala (Kontrast auf Weiß).
const agentColors = computed<Record<string, string>>(() => ({
  cc: resolveColor(AGENT_COLORS.claudeCode, isDark),
  codex: resolveColor(AGENT_COLORS.codex, isDark),
  gemini: resolveColor(AGENT_COLORS.gemini, isDark),
  pi: resolveColor(AGENT_COLORS.pi, isDark),
  opencode: resolveColor(AGENT_COLORS.opencode, isDark),
  cursor: resolveColor(AGENT_COLORS.cursor, isDark),
}));
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Merkmal</th>
          <th v-for="a in agents" :key="a">
            <span :style="{ color: agentColors[a] }">{{ agentNames[a] }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.feature">
          <td class="feature">{{ row.feature }}</td>
          <td v-for="a in agents" :key="a">
            <Badge v-if="(row as any)[a] === 'y'" tone="green">Ja</Badge>
            <Badge v-else-if="(row as any)[a] === 'n'" tone="red">Nein</Badge>
            <span v-else>{{ (row as any)[a] }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
  border-radius: 8px;
  overflow: hidden;
  font-size: 11px;
}
th,
td {
  padding: 7px 8px;
  text-align: left;
  border-bottom: 1px solid v-bind("P.border");
}
th {
  background: v-bind("P.headerBg");
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
td {
  color: v-bind("P.text");
}
.feature {
  font-weight: 600;
}
tr:last-child td {
  border-bottom: none;
}
tr:hover td {
  background: v-bind("P.hoverBg");
}
</style>
