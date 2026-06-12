<script setup>
import { ref, computed } from "vue";
import Tabs from "@shared/components/Tabs.vue";
import { usePalette } from "@shared/composables/usePalette";

// Invertierte Pill-Optik der Navigation — weicht von den kanonischen Tokens
// ab und bleibt via usePalette-Overrides exakt erhalten.
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

const currentView = ref("primitives");
const views = [
  { key: "primitives", label: "Primitive" },
  { key: "matrix", label: "Vergleichsmatrix" },
  { key: "protocols", label: "LSP · MCP · ACP" },
  { key: "flow", label: "Zusammenspiel" },
  { key: "worktrees", label: "Git Worktrees" },
];

// Pill-Optik der bisherigen .nav-Buttons als Tabs.vue-Custom-Properties
// (visueller No-Op); Hover-Verhalten siehe :deep-Regel unten.
const tabVars = computed(() => ({
  "--sk-tab-gap": "5px",
  "--sk-tab-bar-mb": "10px",
  "--sk-tab-font-size": "10px",
  "--sk-tab-font-weight": "500",
  "--sk-tab-pad": "4px 12px",
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
  <div class="infographic" :style="tabVars">
    <Tabs v-model="currentView" :tabs="views" aria-label="Infografik-Ansicht">
      <!-- v-if wie zuvor: inaktive Ansichten bleiben unmontiert. -->
      <div v-if="currentView === 'primitives'" class="view-content">
        <PrimitivesOverview />
      </div>
      <div v-if="currentView === 'matrix'" class="view-content">
        <ComparisonMatrix />
      </div>
      <div v-if="currentView === 'protocols'" class="view-content">
        <ProtocolCards />
      </div>
      <div v-if="currentView === 'flow'" class="view-content">
        <FlowLayers />
      </div>
      <div v-if="currentView === 'worktrees'" class="view-content">
        <WorktreeOverview />
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
.infographic {
  font-family: "DM Sans", sans-serif;
}
/* Hover wie die alten .nav-Buttons: nur Rahmen + Schriftfarbe, kein
   Hintergrundwechsel; der aktive Tab behält seine invertierte Optik. */
.infographic :deep(.sk-tab:hover:not(.active)) {
  border-color: v-bind("P.btnHoverBorder");
  color: v-bind("P.btnHoverColor");
}
.view-content {
  min-height: 200px;
}
/* FlowLayers passt solo auf die Folie (S20), aber unter der Tab-Leiste
   fehlen ~35 logische px: den (ohnehin scrollenden) Layer-Stack einkürzen,
   damit die Beispiel-Tabelle nicht unter der Folienkante abgeschnitten wird. */
.view-content :deep(.layers) {
  max-height: 205px;
}
</style>
