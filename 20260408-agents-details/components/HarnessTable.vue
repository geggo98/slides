<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#14141c" : "#ffffff",
    headerBg: d ? "#1a1a24" : "#f4f4f5",
    headerText: d ? "#a78bfa" : "#7c3aed",
    border: d ? "#2a2a35" : "#e4e4e7",
    text: d ? "#c8c8d0" : "#3f3f46",
    hoverBg: d ? "#181820" : "#f9fafb",
    badgeGreenBg: d ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.1)",
    badgeGreenText: d ? "#86efac" : "#16a34a",
    badgeRedBg: d ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.1)",
    badgeRedText: d ? "#fca5a5" : "#dc2626",
  };
});

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
// OpenCode-Gelb #facc15 erreicht auf weißem Grund nur ~1.5:1 — im Light-Mode
// das dunklere Amber (#ca8a04) nutzen, im Dark-Mode das helle Gelb behalten.
const agentColors = computed<Record<string, string>>(() => ({
  cc: "#fb923c",
  codex: "#10b981",
  gemini: "#60a5fa",
  pi: "#a78bfa",
  opencode: isDark.value ? "#facc15" : "#ca8a04",
  cursor: "#f472b6",
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
            <span v-if="(row as any)[a] === 'y'" class="badge green">Ja</span>
            <span v-else-if="(row as any)[a] === 'n'" class="badge red"
              >Nein</span
            >
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
.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}
.badge.green {
  background: v-bind("P.badgeGreenBg");
  color: v-bind("P.badgeGreenText");
}
.badge.red {
  background: v-bind("P.badgeRedBg");
  color: v-bind("P.badgeRedText");
}
</style>
