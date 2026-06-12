<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const openLayer = ref(null);
const toggle = (id) => {
  openLayer.value = openLayer.value === id ? null : id;
};

const layers = computed(() => {
  const d = isDark.value;
  return [
    {
      id: "plugin",
      name: "Plugin / Extension",
      question: "Wie verteile ich alles?",
      bg: d ? "#1a2810" : "#EAF3DE",
      border: d ? "#80c050" : "#639922",
      color: d ? "#80c050" : "#27500A",
      detail:
        "Bündelt Skills, Hooks, Subagents, MCP in ein installierbares Paket. Claude Code: <code>.claude-plugin/</code>, Gemini CLI: <code>gemini-extension.json</code>, OpenCode: <code>.opencode/plugins/*.js</code>.",
    },
    {
      id: "instr",
      name: "Instruktionsdatei",
      question: "Was gilt immer?",
      bg: d ? "#2a2640" : "#EEEDFE",
      border: d ? "#7c72d0" : "#534AB7",
      color: d ? "#a5a0e0" : "#3C3489",
      detail:
        "Statischer Projektkontext. CLAUDE.md / AGENTS.md / GEMINI.md. Unter 200 Zeilen. Deny-Regeln haben Vorrang über alle Ebenen.",
    },
    {
      id: "rules",
      name: "Rules (konditional)",
      question: "Was gilt hier?",
      bg: d ? "#1a2840" : "#E6F1FB",
      border: d ? "#4a8fd0" : "#185FA5",
      color: d ? "#85b7eb" : "#0C447C",
      detail:
        "Pfad-/dateibasiert geladene Regeln. Devin Desktop: <code>glob</code>, <code>model_decision</code>. Claude Code: <code>globs</code> in YAML-Frontmatter.",
    },
    {
      id: "skills",
      name: "Skills",
      question: "Wie mache ich X?",
      bg: d ? "#1a3028" : "#E1F5EE",
      border: d ? "#40a080" : "#0F6E56",
      color: d ? "#5cc0a0" : "#085041",
      detail:
        "On-Demand Workflows. Nur Beschreibung lädt initial → voller Inhalt bei Aktivierung. Cross-Tool-Standard.",
    },
    {
      id: "mcp",
      name: "MCP Server",
      question: "Woher die Daten?",
      bg: d ? "#1a2840" : "#E6F1FB",
      border: d ? "#4a8fd0" : "#185FA5",
      color: d ? "#85b7eb" : "#0C447C",
      detail:
        "Externe Fähigkeiten via Model Context Protocol. Alle 6 Tools unterstützen MCP. Token-Kosten monitoren.",
    },
    {
      id: "sub",
      name: "Subagents",
      question: "Wer arbeitet isoliert?",
      bg: d ? "#301820" : "#FBEAF0",
      border: d ? "#c06080" : "#993556",
      color: d ? "#e080a0" : "#72243E",
      detail:
        "Eigenes Kontextfenster. Gibt Zusammenfassung zurück. Mit <code>isolation: worktree</code> auch Dateisystem-Isolation.",
    },
    {
      id: "hooks",
      name: "Hooks",
      question: "Was MUSS passieren?",
      bg: d ? "#331810" : "#FAECE7",
      border: d ? "#e08050" : "#D85A30",
      color: d ? "#e09060" : "#712B13",
      detail:
        "Deterministisch. Kein KI-Urteil. Quality Gates: Linter, Formatter, Tests. <code>PreToolUse</code> kann blockieren (Exit 2).",
    },
  ];
});

const C = computed(() => {
  const d = isDark.value;
  return {
    hintColor: d ? "#aaa" : "#888",
    layerQ: d ? "#999" : "#5f5e5a",
    detailBg: d ? "#1e1e1e" : "white",
    detailColor: d ? "#e5e5e5" : "#1a1a18",
    detailBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    codeBg: d ? "#2a2a2e" : "#f3f2ee",
    codeColor: d ? "#e5e5e5" : "#1a1a18",
    arrowColor: d ? "#aaa" : "#888",
    sectionLabelColor: d ? "#aaa" : "#888",
    tableBg: d ? "#1e1e1e" : "white",
    tableBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    tableColor: d ? "#e5e5e5" : "#1a1a18",
    thBg: d ? "#2a2a2e" : "#f3f2ee",
    thColor: d ? "#ccc" : "#333",
    thBorderBottom: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    tdBorderBottom: d ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tdColor: d ? "#e5e5e5" : "#1a1a18",
    toolNameColor: d ? "#e5e5e5" : "#1a1a18",
    exUsageColor: d ? "#ccc" : "#333",
  };
});

const examples = [
  {
    prim: "CLAUDE.md",
    usage:
      "Spring Boot 3.4, Java 21, Gradle. MySQL 8 via Percona. Traefik Gateway API Controller.",
  },
  {
    prim: "Rules",
    usage:
      ".claude/rules/api.md (globs: controller/**) → OpenAPI-Annotationen, keine Feld-Injection.",
  },
  {
    prim: "Skill: db-migration",
    usage:
      "Flyway-Script → Staging-Test → pt-online-schema-change für große Tabellen.",
  },
  {
    prim: "MCP: database",
    usage: "MySQL-Schema-Zugriff und Testdaten für Query-Validierung.",
  },
  {
    prim: "Hook: PostToolUse",
    usage: "./gradlew spotlessApply nach jedem File-Edit.",
  },
  {
    prim: "Hook: Stop",
    usage: "./gradlew test als finaler Quality Gate vor Task-Completion.",
  },
];
</script>

<template>
  <p :style="{ fontSize: '11px', color: C.hintColor, marginBottom: '8px' }">
    Klick auf eine Schicht für Details.
  </p>

  <div class="layers">
    <div v-for="(layer, i) in layers" :key="layer.id">
      <div
        class="layer-box"
        :style="{ background: layer.bg, borderColor: layer.border }"
        @click="toggle(layer.id)"
      >
        <div class="layer-name" :style="{ color: layer.color }">
          {{ layer.name }}
        </div>
        <div class="layer-q">{{ layer.question }}</div>
      </div>
      <div v-if="openLayer === layer.id" class="layer-detail">
        <p v-html="layer.detail" />
      </div>
      <div v-if="i < layers.length - 1" class="layer-arrow">▼</div>
    </div>
  </div>

  <div class="section-label">Konkretes Beispiel: Spring-Boot-Projekt</div>
  <div class="table-wrap">
    <table class="ex-table">
      <thead>
        <tr>
          <th>Primitiv</th>
          <th>Konkrete Nutzung</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in examples" :key="e.prim">
          <td class="tool-name">{{ e.prim }}</td>
          <td class="ex-usage">{{ e.usage }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.layers {
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
}
.layer-box {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid;
  text-align: center;
  cursor: pointer;
  transition: opacity 0.15s;
}
.layer-box:hover {
  opacity: 0.85;
}
.layer-name {
  font-weight: 600;
  font-size: 11px;
}
.layer-q {
  font-size: 9px;
  color: v-bind("C.layerQ");
}
.layer-detail {
  padding: 6px 10px;
  background: v-bind("C.detailBg");
  border-radius: 6px;
  font-size: 10px;
  line-height: 1.5;
  margin: 2px 0;
  color: v-bind("C.detailColor");
  border: 1px solid v-bind("C.detailBorder");
}
.layer-detail :deep(code) {
  background: v-bind("C.codeBg");
  color: v-bind("C.codeColor");
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9px;
}
.layer-arrow {
  text-align: center;
  color: v-bind("C.arrowColor");
  font-size: 9px;
  margin: 1px 0;
}
.section-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: v-bind("C.sectionLabelColor");
  margin: 10px 0 4px;
}
.table-wrap {
  overflow-x: auto;
}
.ex-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  background: v-bind("C.tableBg");
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid v-bind("C.tableBorder");
  color: v-bind("C.tableColor");
}
.ex-table th {
  text-align: left;
  padding: 4px 7px;
  font-weight: 600;
  font-size: 9px;
  background: v-bind("C.thBg");
  color: v-bind("C.thColor");
  border-bottom: 1px solid v-bind("C.thBorderBottom");
}
.ex-table td {
  padding: 3px 7px;
  border-bottom: 1px solid v-bind("C.tdBorderBottom");
  color: v-bind("C.tdColor");
}
.tool-name {
  font-weight: 600;
  white-space: nowrap;
  font-size: 9px;
  color: v-bind("C.toolNameColor");
}
.ex-usage {
  font-size: 9px;
  color: v-bind("C.exUsageColor");
}
</style>
