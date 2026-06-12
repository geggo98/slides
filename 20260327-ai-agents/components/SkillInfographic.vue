<script setup>
import { ref, computed, provide, nextTick } from "vue";
import Tabs from "@shared/components/Tabs.vue";
import { usePalette } from "@shared/composables/usePalette";
import SkillOverviewPanel from "./skill/SkillOverviewPanel.vue";
import SkillMdPanel from "./skill/SkillMdPanel.vue";
import DisclosurePanel from "./skill/DisclosurePanel.vue";
import PlatformsPanel from "./skill/PlatformsPanel.vue";
import ScriptsRefsPanel from "./skill/ScriptsRefsPanel.vue";
import McpPanel from "./skill/McpPanel.vue";
import PermissionsPanel from "./skill/PermissionsPanel.vue";
import CompareSkillsPanel from "./skill/CompareSkillsPanel.vue";
import ExampleExplorer from "./skill/ExampleExplorer.vue";

// Die semantischen --color-*-Variablen kommen global aus SlidevTokens
// (setup/main.ts); hier bleiben nur die invertierte Pill-Optik der
// Navigation und die Fonts als Deck-Overrides.
const P = usePalette({
  light: {
    btnBg: "white",
    btnColor: "#888",
    btnBorder: "rgba(0,0,0,0.1)",
    btnHoverBorder: "#888",
    btnHoverColor: "#1a1a18",
    activeBg: "#1a1a18",
    activeColor: "white",
    activeBorder: "#1a1a18",
  },
  dark: {
    btnBg: "#1e1e1e",
    btnColor: "#aaa",
    btnBorder: "rgba(255,255,255,0.12)",
    btnHoverBorder: "#aaa",
    btnHoverColor: "#e5e5e5",
    activeBg: "#e5e5e5",
    activeColor: "#1e1e1e",
    activeBorder: "#e5e5e5",
  },
});

const fontSans = "'DM Sans', sans-serif";
const fontMono = "'Fira Code', 'JetBrains Mono', monospace";

const activeTab = ref("overview");
const activeSection = ref(null);

function navigateTo(tabId, sectionId = null) {
  activeTab.value = tabId;
  activeSection.value = sectionId;
  if (sectionId) {
    nextTick(() => {
      const el = document.getElementById(`section-${sectionId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

provide("skillNav", { activeTab, activeSection, navigateTo });

// Gruppen (0–3) werden als Trennstriche zwischen den Pills gerendert —
// siehe die :deep(.sk-tab:nth-child(…))-Regeln unten.
const tabs = [
  { key: "overview", label: "Überblick" },
  { key: "skillmd", label: "SKILL.md" },
  { key: "disclosure", label: "Disclosure" },
  { key: "platforms", label: "Plattformen" },
  { key: "files", label: "Scripts" },
  { key: "mcp", label: "MCP" },
  { key: "perms", label: "Rechte" },
  { key: "compare", label: "Vergleich" },
  { key: "explorer", label: "Example Explorer" },
];

// Pill-Optik der bisherigen .nav-Buttons als Tabs.vue-Custom-Properties
// (visueller No-Op); Hover-Verhalten siehe :deep-Regel unten.
const tabVars = computed(() => ({
  "--sk-tab-gap": "4px",
  "--sk-tab-bar-mb": "8px",
  "--sk-tab-font-size": "10px",
  "--sk-tab-font-weight": "500",
  "--sk-tab-pad": "4px 10px",
  "--sk-tab-radius": "16px",
  "--sk-tab-border": `1px solid ${P.value.btnBorder}`,
  "--sk-tab-bg": P.value.btnBg,
  "--sk-tab-color": P.value.btnColor,
  "--sk-tab-hover-bg": P.value.btnBg,
  "--sk-tab-transition": "all 0.15s",
  "--sk-tab-active-bg": P.value.activeBg,
  "--sk-tab-active-color": P.value.activeColor,
  "--sk-tab-active-border": P.value.activeBorder,
}));
</script>

<template>
  <div class="skill-infographic" :style="tabVars">
    <Tabs
      v-model="activeTab"
      :tabs="tabs"
      aria-label="Agent-Skills-Themen"
      @update:model-value="activeSection = null"
    >
      <!-- v-show statt benannter Slots: Panels behalten ihren Zustand
           (Monaco-Editor, aufgeklappte Sektionen) beim Tab-Wechsel. -->
      <div v-show="activeTab === 'overview'"><SkillOverviewPanel /></div>
      <div v-show="activeTab === 'skillmd'"><SkillMdPanel /></div>
      <div v-show="activeTab === 'disclosure'"><DisclosurePanel /></div>
      <div v-show="activeTab === 'platforms'"><PlatformsPanel /></div>
      <div v-show="activeTab === 'files'"><ScriptsRefsPanel /></div>
      <div v-show="activeTab === 'mcp'"><McpPanel /></div>
      <div v-show="activeTab === 'perms'"><PermissionsPanel /></div>
      <div v-show="activeTab === 'compare'"><CompareSkillsPanel /></div>
      <div v-show="activeTab === 'explorer'"><ExampleExplorer /></div>
    </Tabs>
  </div>
</template>

<style scoped>
.skill-infographic {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 430px;
  overflow: hidden;
  font-family: v-bind("fontSans");
  /* Nicht-semantische Variablen für die skill/*.vue-Panels. --sk-rad/--sk-radm
     weichen bewusst von den globalen SlidevTokens-Werten ab (hier 8px/6px,
     global 6px/8px) — Panel-Optik exakt erhalten. */
  --font-sans: v-bind("fontSans");
  --font-mono: v-bind("fontMono");
  --sk-rad: 8px;
  --sk-radm: 6px;
}
.skill-infographic :deep(.sk-tabs) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.skill-infographic :deep(.sk-tab-bar) {
  align-items: center;
  flex-shrink: 0;
}
.skill-infographic :deep(.sk-tab) {
  white-space: nowrap;
}
/* Hover wie die alten .nav-Buttons: nur Rahmen + Schriftfarbe, kein
   Hintergrundwechsel; der aktive Tab behält seine invertierte Optik. */
.skill-infographic :deep(.sk-tab:hover:not(.active)) {
  border-color: v-bind("P.btnHoverBorder");
  color: v-bind("P.btnHoverColor");
}
/* Gruppen-Trennstriche (vorher .nav-sep): vor den Pills 4 (Plattformen),
   7 (Rechte) und 9 (Example Explorer). 9px Margin + Linie bei -7px ergeben
   den alten Abstand aus gap(4) + margin(2) + 1px Linie + margin(2) + gap(4). */
.skill-infographic :deep(.sk-tab:nth-child(4)),
.skill-infographic :deep(.sk-tab:nth-child(7)),
.skill-infographic :deep(.sk-tab:nth-child(9)) {
  position: relative;
  margin-left: 9px;
}
.skill-infographic :deep(.sk-tab:nth-child(4))::before,
.skill-infographic :deep(.sk-tab:nth-child(7))::before,
.skill-infographic :deep(.sk-tab:nth-child(9))::before {
  content: "";
  position: absolute;
  left: -7px;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 16px;
  background: var(--color-border-tertiary);
}
.skill-infographic :deep(.sk-tab-panel) {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
</style>
