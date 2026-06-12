<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { usePalette } from "@shared/composables/usePalette";
import PrimitiveCard from "./PrimitiveCard.vue";

// isDark bleibt für die farbigen Karten-Daten unten; das Palettenobjekt P
// läuft über usePalette (Hint-Grau weicht vom Token ab — exakt erhalten).
const { isDark } = useDarkMode();

const P = usePalette({
  light: { hintColor: "#888" },
  dark: { hintColor: "#aaa" },
});

const primitives = computed(() => {
  const d = isDark.value;
  return [
    {
      icon: "📋",
      name: "Instruktionsdatei",
      analogy: "Projekthandbuch",
      bg: d ? "#2a2640" : "#EEEDFE",
      color: d ? "#a5a0e0" : "#3C3489",
      purpose:
        "Statischer Projektkontext — Architektur, Konventionen, Build-Befehle. Wird bei jeder Session in den System-Prompt geladen.",
      type: "Beratend",
      typeBg: d ? "#332810" : "#FAEEDA",
      typeColor: d ? "#d4a050" : "#633806",
      context: "Immer geladen",
      when: "Fakten, die in <em>jeder</em> Konversation gelten. Coding-Standards, verbotene Patterns, Tech-Stack. Unter 200 Zeilen halten.",
      whenNot:
        "Workflows > 20 Zeilen → <strong>Skill</strong>. Dinge die garantiert laufen müssen → <strong>Hook</strong>. Dynamische Info → <strong>MCP</strong>.",
    },
    {
      icon: "📐",
      name: "Rules",
      analogy: "Programmierrichtlinien",
      bg: d ? "#1a2840" : "#E6F1FB",
      color: d ? "#85b7eb" : "#0C447C",
      purpose:
        "Modulare .md-Dateien mit YAML-Frontmatter. Laden konditional basierend auf Dateipfad oder Modell-Entscheidung.",
      type: "Beratend",
      typeBg: d ? "#332810" : "#FAEEDA",
      typeColor: d ? "#d4a050" : "#633806",
      context: "Konditional",
      when: 'Pfad-spezifische Konventionen. Z.B. "Im /api-Ordner immer OpenAPI-Schemas generieren".',
      whenNot:
        "Wenn die Regel <em>immer</em> gilt → gehört in die Instruktionsdatei.",
    },
    {
      icon: "🔧",
      name: "Skills (SKILL.md)",
      analogy: "Run-Book",
      bg: d ? "#1a3028" : "#E1F5EE",
      color: d ? "#5cc0a0" : "#085041",
      purpose:
        "Wiederverwendbare Workflows und Domänenwissen. Nur Beschreibung laden initial.",
      type: "On-Demand",
      typeBg: d ? "#1a2810" : "#EAF3DE",
      typeColor: d ? "#80c050" : "#27500A",
      context: "Bei Bedarf",
      when: "Wiederkehrende Workflows (Code-Review, Deployment), Domänenwissen, Prozeduren die Urteilsvermögen erfordern.",
      whenNot:
        "Immer gültige Regeln → <strong>Instruktionsdatei</strong>. Deterministische Aktionen → <strong>Hook</strong>.",
    },
    {
      icon: "⚡",
      name: "Hooks",
      analogy: "Git-Hooks",
      bg: d ? "#331810" : "#FAECE7",
      color: d ? "#e09060" : "#712B13",
      purpose:
        "Deterministische Shell-Befehle bei Lifecycle-Events. Laufen GARANTIERT — ohne KI-Urteil.",
      type: "Deterministisch",
      typeBg: d ? "#301818" : "#FCEBEB",
      typeColor: d ? "#f09090" : "#791F1F",
      context: "Bei Event",
      when: "Linter/Formatter nach File-Write. Unit-Tests. Commit-Validierung. Schreibschutz (Exit-Code 2).",
      whenNot: "Dinge die Urteilsvermögen erfordern → <strong>Skill</strong>.",
    },
    {
      icon: "🔌",
      name: "MCP Server",
      analogy: "Datenbank",
      bg: d ? "#1a2840" : "#E6F1FB",
      color: d ? "#85b7eb" : "#0C447C",
      purpose:
        "Externe Tool-Anbindung via Model Context Protocol. Gibt dem Modell Fähigkeiten die es sonst nicht hat.",
      type: "Verbindung",
      typeBg: d ? "#1a2840" : "#E6F1FB",
      typeColor: d ? "#85b7eb" : "#0C447C",
      context: "Pro Session",
      when: "Datenbankzugriff, Issue-Tracker, aktuelle API-Docs, Browser-Automation.",
      whenNot:
        "Statische Info → <strong>Skill</strong>. Token-Kosten monitoren!",
    },
    {
      icon: "👤",
      name: "Subagents",
      analogy: "Praktikant",
      bg: d ? "#301820" : "#FBEAF0",
      color: d ? "#e080a0" : "#72243E",
      purpose:
        "Isolierte Agent-Instanzen mit eigenem Kontextfenster. Geben nur Zusammenfassung zurück.",
      type: "Isoliert",
      typeBg: d ? "#301820" : "#FBEAF0",
      typeColor: d ? "#e080a0" : "#72243E",
      context: "Pro Task",
      when: "Codebase-Scan (50 Dateien → 20-Zeilen-Summary). Parallele Arbeit. Kontextfenster voll.",
      whenNot: "Aufgabe < 5 Tool-Calls → Overhead lohnt nicht.",
    },
    {
      icon: "📦",
      name: "Plugins",
      analogy: "npm-Paket",
      bg: d ? "#1a2810" : "#EAF3DE",
      color: d ? "#80c050" : "#27500A",
      purpose:
        "Bündelung von Skills + Hooks + Subagents + MCP als verteilbare Einheit.",
      type: "Paket",
      typeBg: d ? "#1a2810" : "#EAF3DE",
      typeColor: d ? "#80c050" : "#27500A",
      context: "Installiert",
      when: "Gleiche Config in mehreren Repos. Team-Standardisierung. Community-Beitrag.",
      whenNot:
        "Einmaliger projektspezifischer Workflow → einfacher Skill reicht.",
    },
  ];
});
</script>

<template>
  <p :style="{ fontSize: '11px', color: P.hintColor, marginBottom: '8px' }">
    Grundregel: Instruktionsdateien sind <em>beratend</em>, Hooks sind
    <em>deterministisch</em>. Klick für Details.
  </p>
  <div class="grid">
    <PrimitiveCard v-for="p in primitives" :key="p.name" v-bind="p" />
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
