<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const openProto = ref(null);
const toggle = (name) => {
  openProto.value = openProto.value === name ? null : name;
};

const Yhtml = computed(() => {
  const c = isDark.value ? "#639922" : "#639922";
  return `<span style="color:${c};font-weight:600">✓</span>`;
});
const Nhtml = computed(() => {
  const c = isDark.value ? "#f06060" : "#A32D2D";
  return `<span style="color:${c}">✗</span>`;
});
const Phtml = computed(() => {
  const c = isDark.value ? "#e0a030" : "#BA7517";
  return `<span style="color:${c};font-weight:500">◐</span>`;
});

const protocols = computed(() => {
  const Y = Yhtml.value,
    N = Nhtml.value,
    P = Phtml.value;
  const d = isDark.value;
  return [
    {
      name: "LSP",
      icon: "👁",
      by: "Microsoft, 2016",
      purpose:
        'Semantisches Code-Verständnis: Go-to-Definition, Find-References, Diagnostics. Gibt dem Agenten "IDE-Augen".',
      bg: d ? "#1a2840" : "#E6F1FB",
      color: d ? "#85b7eb" : "#0C447C",
      direction: "Agent → Code",
      dirBg: d ? "#1a2840" : "#E6F1FB",
      dirColor: d ? "#85b7eb" : "#0C447C",
      transport: "JSON-RPC stdio/socket",
      support: [
        {
          tool: "Claude Code",
          level: Y,
          detail: "Nativ seit v2.0.74, 22+ Sprachen",
        },
        {
          tool: "OpenCode",
          level: Y,
          detail: "30+ Language Server, Auto-Install",
        },
        {
          tool: "Devin Desktop",
          level: Y,
          detail: "IDE-integriert (VS Code Fork)",
        },
        {
          tool: "Junie",
          level: Y,
          detail: "JetBrains-eigene Code-Intelligence",
        },
        { tool: "Codex", level: P, detail: "Kein expliziter LSP" },
        { tool: "Gemini CLI", level: N, detail: "Terminal-basiert, kein LSP" },
      ],
    },
    {
      name: "MCP",
      icon: "🔌",
      by: "Anthropic, 2024",
      purpose:
        'Externe Tool-/Datenanbindung: Datenbanken, APIs, Issue-Tracker. "Hände für die Außenwelt".',
      bg: d ? "#1a3028" : "#E1F5EE",
      color: d ? "#5cc0a0" : "#085041",
      direction: "Agent → Externe Welt",
      dirBg: d ? "#1a3028" : "#E1F5EE",
      dirColor: d ? "#5cc0a0" : "#085041",
      transport: "JSON-RPC stdio/HTTP/SSE",
      support: [
        {
          tool: "Claude Code",
          level: Y,
          detail: ".mcp.json, drei Scopes, CLI-Wizard",
        },
        { tool: "Codex", level: Y, detail: "config.toml, OAuth-Flows" },
        {
          tool: "Devin Desktop",
          level: Y,
          detail: "MCP Marketplace, 100-Tool-Limit",
        },
        { tool: "Junie", level: Y, detail: ".junie/mcp/, AI-powered Wizard" },
        {
          tool: "OpenCode",
          level: Y,
          detail: "Remote-MCP via .well-known/opencode",
        },
        { tool: "Gemini CLI", level: Y, detail: "settings.json, Extensions" },
      ],
    },
    {
      name: "ACP",
      icon: "🤝",
      by: "Zed + JetBrains, 2025",
      purpose:
        'Agent ↔ IDE-Kommunikation: jeder Agent in jeder IDE. "LSP für AI-Agenten".',
      bg: d ? "#2a2640" : "#EEEDFE",
      color: d ? "#a5a0e0" : "#3C3489",
      direction: "Agent ↔ IDE",
      dirBg: d ? "#2a2640" : "#EEEDFE",
      dirColor: d ? "#a5a0e0" : "#3C3489",
      transport: "JSON-RPC stdio",
      support: [
        { tool: "Claude Code", level: Y, detail: "In JetBrains-IDEs und Zed" },
        { tool: "Codex", level: Y, detail: "In JetBrains ab 2026.1" },
        { tool: "Junie", level: Y, detail: "JetBrains-nativ, ACP-kompatibel" },
        {
          tool: "Gemini CLI",
          level: Y,
          detail: "Via ACP in JetBrains und Zed",
        },
        {
          tool: "Devin Desktop",
          level: Y,
          detail: "ACP ab Launch (Juni 2026)",
        },
        { tool: "OpenCode", level: N, detail: "Kein ACP dokumentiert" },
      ],
    },
  ];
});

const stack = computed(() => {
  const d = isDark.value;
  return [
    {
      name: "ACP: Agent ↔ IDE",
      question: '"Welcher Agent arbeitet in welcher IDE?"',
      bg: d ? "#2a2640" : "#EEEDFE",
      border: d ? "#7c72d0" : "#534AB7",
      color: d ? "#a5a0e0" : "#3C3489",
    },
    {
      name: "MCP: Agent → Externe Welt",
      question: '"Woher kommen die Daten?"',
      bg: d ? "#1a3028" : "#E1F5EE",
      border: d ? "#40a080" : "#0F6E56",
      color: d ? "#5cc0a0" : "#085041",
    },
    {
      name: "LSP: Agent → Code-Verständnis",
      question: '"Was bedeutet dieser Code semantisch?"',
      bg: d ? "#1a2840" : "#E6F1FB",
      border: d ? "#4a8fd0" : "#185FA5",
      color: d ? "#85b7eb" : "#0C447C",
    },
  ];
});

const C = computed(() => {
  const d = isDark.value;
  return {
    hintColor: d ? "#aaa" : "#888",
    cardBg: d ? "#1e1e1e" : "white",
    cardBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    cardColor: d ? "#e5e5e5" : "#1a1a18",
    hoverBorder: d ? "#aaa" : "#888",
    byColor: d ? "#aaa" : "#888",
    purposeColor: d ? "#ccc" : "#333",
    neutralBg: d ? "#2a2a2e" : "#f3f2ee",
    neutralColor: d ? "#ccc" : "#333",
    detailBg: d ? "#1e1e1e" : "white",
    detailBorder: d ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    tableColor: d ? "#e5e5e5" : "#1a1a18",
    thBorderBottom: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    thColor: d ? "#aaa" : "#555",
    tdBorderBottom: d ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
    tdColor: d ? "#e5e5e5" : "#1a1a18",
    toolNameColor: d ? "#e5e5e5" : "#1a1a18",
    detailTextColor: d ? "#ccc" : "#333",
    stackLabelColor: d ? "#aaa" : "#888",
    stackQ: d ? "#ccc" : "#333",
    stackPlusColor: d ? "#aaa" : "#888",
  };
});
</script>

<template>
  <p :style="{ fontSize: '11px', color: C.hintColor, marginBottom: '8px' }">
    Drei Protokolle, drei Schichten — <strong>orthogonal</strong>, nicht
    hierarchisch. Klick für Support-Details.
  </p>

  <div class="proto-list">
    <div
      v-for="pr in protocols"
      :key="pr.name"
      class="proto-card"
      @click="toggle(pr.name)"
    >
      <div class="proto-header">
        <div class="proto-icon" :style="{ background: pr.bg, color: pr.color }">
          {{ pr.icon }}
        </div>
        <div>
          <div class="proto-title">{{ pr.name }}</div>
          <div class="proto-by">{{ pr.by }}</div>
        </div>
      </div>
      <div class="proto-purpose">{{ pr.purpose }}</div>
      <div class="proto-badges">
        <span
          class="badge"
          :style="{ background: pr.dirBg, color: pr.dirColor }"
          >{{ pr.direction }}</span
        >
        <span class="badge neutral">{{ pr.transport }}</span>
      </div>
      <div v-if="openProto === pr.name" class="proto-detail" @click.stop>
        <table class="support-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Support</th>
              <th>Details</th>
            </tr>
          </thead>
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
      <div
        class="stack-box"
        :style="{ background: q.bg, borderColor: q.border }"
      >
        <div class="stack-name" :style="{ color: q.color }">{{ q.name }}</div>
        <div class="stack-q">{{ q.question }}</div>
      </div>
      <div v-if="i < stack.length - 1" class="stack-plus">+</div>
    </div>
  </div>
</template>

<style scoped>
.proto-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.proto-card {
  background: v-bind("C.cardBg");
  border: 1px solid v-bind("C.cardBorder");
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  color: v-bind("C.cardColor");
}
.proto-card:hover {
  border-color: v-bind("C.hoverBorder");
}
.proto-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.proto-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.proto-title {
  font-size: 12px;
  font-weight: 600;
}
.proto-by {
  font-size: 8px;
  color: v-bind("C.byColor");
}
.proto-purpose {
  font-size: 9px;
  color: v-bind("C.purposeColor");
  line-height: 1.3;
}
.proto-badges {
  margin-top: 3px;
}
.badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 6px;
  margin-right: 2px;
}
.badge.neutral {
  background: v-bind("C.neutralBg");
  color: v-bind("C.neutralColor");
}
.proto-detail {
  margin-top: 6px;
  padding: 5px;
  background: v-bind("C.detailBg");
  border-radius: 6px;
  border: 1px solid v-bind("C.detailBorder");
}
.support-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8px;
  color: v-bind("C.tableColor");
}
.support-table th {
  text-align: left;
  padding: 2px 4px;
  font-weight: 600;
  border-bottom: 1px solid v-bind("C.thBorderBottom");
  font-size: 7px;
  color: v-bind("C.thColor");
}
.support-table td {
  padding: 2px 4px;
  border-bottom: 1px solid v-bind("C.tdBorderBottom");
  color: v-bind("C.tdColor");
}
.tool-name {
  font-weight: 600;
  font-size: 8px;
  white-space: nowrap;
  color: v-bind("C.toolNameColor");
}
.detail-text {
  font-size: 7px;
  color: v-bind("C.detailTextColor");
}
.stack-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: v-bind("C.stackLabelColor");
  margin: 8px 0 4px;
}
.stack {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.stack > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stack-box {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid;
  text-align: center;
  width: 100%;
}
.stack-name {
  font-weight: 600;
  font-size: 10px;
}
.stack-q {
  font-size: 8px;
  color: v-bind("C.stackQ");
}
.stack-plus {
  text-align: center;
  color: v-bind("C.stackPlusColor");
  font-size: 10px;
  margin: 2px 0;
  display: none;
}
</style>
