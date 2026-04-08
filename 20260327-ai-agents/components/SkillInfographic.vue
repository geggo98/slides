<script setup>
import { ref, computed, provide, nextTick } from "vue";
import { useDarkMode } from "@slidev/client";
import SkillOverviewPanel from "./skill/SkillOverviewPanel.vue";
import SkillMdPanel from "./skill/SkillMdPanel.vue";
import DisclosurePanel from "./skill/DisclosurePanel.vue";
import PlatformsPanel from "./skill/PlatformsPanel.vue";
import ScriptsRefsPanel from "./skill/ScriptsRefsPanel.vue";
import McpPanel from "./skill/McpPanel.vue";
import PermissionsPanel from "./skill/PermissionsPanel.vue";
import CompareSkillsPanel from "./skill/CompareSkillsPanel.vue";
import ExampleExplorer from "./skill/ExampleExplorer.vue";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    btnBg: d ? "#1e1e1e" : "white",
    btnColor: d ? "#aaa" : "#888",
    btnBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    btnHoverBorder: d ? "#aaa" : "#888",
    btnHoverColor: d ? "#e5e5e5" : "#1a1a18",
    activeBg: d ? "#e5e5e5" : "#1a1a18",
    activeColor: d ? "#1e1e1e" : "white",
    activeBorder: d ? "#e5e5e5" : "#1a1a18",
    textPrimary: d ? "#e5e5e5" : "#1a1a18",
    textSecondary: d ? "#aaa" : "#555",
    textTertiary: d ? "#666" : "#888",
    textInfo: d ? "#7c9fff" : "#4a6fd0",
    textWarning: d ? "#e0a030" : "#a07020",
    textDanger: d ? "#f06060" : "#c04040",
    textSuccess: d ? "#5cc0a0" : "#308060",
    bgPrimary: d ? "#1e1e1e" : "#ffffff",
    bgSecondary: d ? "#2a2a2e" : "#f5f5f5",
    bgTertiary: d ? "#333" : "#eee",
    bgInfo: d ? "rgba(124,159,255,0.12)" : "rgba(74,111,208,0.08)",
    bgWarning: d ? "rgba(224,160,48,0.12)" : "rgba(160,112,32,0.08)",
    bgDanger: d ? "rgba(240,96,96,0.12)" : "rgba(192,64,64,0.08)",
    bgSuccess: d ? "rgba(92,192,160,0.12)" : "rgba(48,128,96,0.08)",
    borderTertiary: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    borderInfo: d ? "rgba(124,159,255,0.25)" : "rgba(74,111,208,0.25)",
    borderWarning: d ? "rgba(224,160,48,0.25)" : "rgba(160,112,32,0.25)",
    borderDanger: d ? "rgba(240,96,96,0.25)" : "rgba(192,64,64,0.25)",
    borderSuccess: d ? "rgba(92,192,160,0.25)" : "rgba(48,128,96,0.25)",
    fontSans: "'DM Sans', sans-serif",
    fontMono: "'Fira Code', 'JetBrains Mono', monospace",
  };
});

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

const tabs = [
  { id: "overview", label: "Überblick", group: 0 },
  { id: "skillmd", label: "SKILL.md", group: 0 },
  { id: "disclosure", label: "Disclosure", group: 0 },
  { id: "platforms", label: "Plattformen", group: 1 },
  { id: "files", label: "Scripts", group: 1 },
  { id: "mcp", label: "MCP", group: 1 },
  { id: "perms", label: "Rechte", group: 2 },
  { id: "compare", label: "Vergleich", group: 2 },
  { id: "explorer", label: "Example Explorer", group: 3 },
];
</script>

<template>
  <div class="skill-infographic">
    <div class="nav">
      <template v-for="(tab, i) in tabs" :key="tab.id">
        <span v-if="i > 0 && tab.group !== tabs[i - 1].group" class="nav-sep" />
        <button
          :class="{ active: activeTab === tab.id }"
          @click.stop="
            activeTab = tab.id;
            activeSection = null;
          "
        >
          {{ tab.label }}
        </button>
      </template>
    </div>

    <div class="panel-container">
      <div v-show="activeTab === 'overview'"><SkillOverviewPanel /></div>
      <div v-show="activeTab === 'skillmd'"><SkillMdPanel /></div>
      <div v-show="activeTab === 'disclosure'"><DisclosurePanel /></div>
      <div v-show="activeTab === 'platforms'"><PlatformsPanel /></div>
      <div v-show="activeTab === 'files'"><ScriptsRefsPanel /></div>
      <div v-show="activeTab === 'mcp'"><McpPanel /></div>
      <div v-show="activeTab === 'perms'"><PermissionsPanel /></div>
      <div v-show="activeTab === 'compare'"><CompareSkillsPanel /></div>
      <div v-show="activeTab === 'explorer'"><ExampleExplorer /></div>
    </div>
  </div>
</template>

<style scoped>
.skill-infographic {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 430px;
  overflow: hidden;
  font-family: v-bind("P.fontSans");
  --color-text-primary: v-bind("P.textPrimary");
  --color-text-secondary: v-bind("P.textSecondary");
  --color-text-tertiary: v-bind("P.textTertiary");
  --color-text-info: v-bind("P.textInfo");
  --color-text-warning: v-bind("P.textWarning");
  --color-text-danger: v-bind("P.textDanger");
  --color-text-success: v-bind("P.textSuccess");
  --color-background-primary: v-bind("P.bgPrimary");
  --color-background-secondary: v-bind("P.bgSecondary");
  --color-background-tertiary: v-bind("P.bgTertiary");
  --color-background-info: v-bind("P.bgInfo");
  --color-background-warning: v-bind("P.bgWarning");
  --color-background-danger: v-bind("P.bgDanger");
  --color-background-success: v-bind("P.bgSuccess");
  --color-border-tertiary: v-bind("P.borderTertiary");
  --color-border-info: v-bind("P.borderInfo");
  --color-border-warning: v-bind("P.borderWarning");
  --color-border-danger: v-bind("P.borderDanger");
  --color-border-success: v-bind("P.borderSuccess");
  --font-sans: v-bind("P.fontSans");
  --font-mono: v-bind("P.fontMono");
  --sk-rad: 8px;
  --sk-radm: 6px;
}
.nav {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  align-items: center;
  flex-shrink: 0;
}
.nav-sep {
  width: 1px;
  height: 16px;
  background: v-bind("P.borderTertiary");
  margin: 0 2px;
}
.nav button {
  font-size: 10px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid v-bind("P.btnBorder");
  background: v-bind("P.btnBg");
  color: v-bind("P.btnColor");
  cursor: pointer;
  transition: all 0.15s;
  font-family: v-bind("P.fontSans");
  white-space: nowrap;
}
.nav button:hover {
  border-color: v-bind("P.btnHoverBorder");
  color: v-bind("P.btnHoverColor");
}
.nav button.active {
  background: v-bind("P.activeBg");
  color: v-bind("P.activeColor");
  border-color: v-bind("P.activeBorder");
}
.panel-container {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
</style>
