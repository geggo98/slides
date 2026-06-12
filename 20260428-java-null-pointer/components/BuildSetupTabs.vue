<script setup lang="ts">
import Tabs from "@shared/components/Tabs.vue";
import { usePalette } from "@shared/composables/usePalette";
import GradleBuildSetup from "./GradleBuildSetup.vue";
import MavenBuildSetup from "./MavenBuildSetup.vue";

// Carbon-Familie des Decks — Tab-Optik analog zu den Szenario-Buttons des
// NarrowingExplorer (Akzent-Orange für den aktiven Tab).
const P = usePalette({
  light: {
    border: "#e4e4e7",
    textMuted: "rgba(63,63,70,0.65)",
    accent: "#ea580c",
    accentBg: "rgba(234,88,12,0.08)",
  },
  dark: {
    border: "#2a2a35",
    textMuted: "rgba(200,200,208,0.6)",
    accent: "#fb923c",
    accentBg: "rgba(251,146,60,0.12)",
  },
});

const tabs = [
  { key: "gradle", label: "Gradle (Kotlin DSL)" },
  { key: "maven", label: "Maven" },
];
</script>

<template>
  <div class="build-setup-tabs">
    <Tabs
      v-slot="{ active }"
      :tabs="tabs"
      aria-label="Build-Setup: Gradle oder Maven"
    >
      <!-- v-show statt benannter Slots: beide Monaco-Editoren bleiben
           gemountet. Ein Remount nach dem Slidev-Boot liefe über das von
           shiki gepatchte monaco.editor.setTheme und würde mit „Theme
           mb-light not found“ als Pageerror abbrechen. -->
      <div v-show="active === 'gradle'"><GradleBuildSetup /></div>
      <div v-show="active === 'maven'"><MavenBuildSetup /></div>
    </Tabs>
  </div>
</template>

<style scoped>
.build-setup-tabs {
  --sk-tab-font-size: 11px;
  --sk-tab-pad: 4px 12px;
  --sk-tab-border: 0.5px solid v-bind("P.border");
  --sk-tab-radius: 5px;
  --sk-tab-color: v-bind("P.textMuted");
  --sk-tab-hover-bg: transparent;
  --sk-tab-active-bg: v-bind("P.accentBg");
  --sk-tab-active-color: v-bind("P.accent");
  --sk-tab-active-border: v-bind("P.accent");
  --sk-tab-bar-mb: 8px;
}
</style>
