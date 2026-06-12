<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";

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
  };
});

const currentView = ref("primitives");
const views = [
  { id: "primitives", label: "Primitive" },
  { id: "matrix", label: "Vergleichsmatrix" },
  { id: "protocols", label: "LSP · MCP · ACP" },
  { id: "flow", label: "Zusammenspiel" },
  { id: "worktrees", label: "Git Worktrees" },
];
</script>

<template>
  <div class="infographic">
    <div class="nav" role="tablist">
      <button
        v-for="v in views"
        :key="v.id"
        role="tab"
        :aria-selected="currentView === v.id"
        :class="{ active: currentView === v.id }"
        @click.stop="currentView = v.id"
      >
        {{ v.label }}
      </button>
    </div>

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
  </div>
</template>

<style scoped>
.infographic {
  font-family: "DM Sans", sans-serif;
}
.nav {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.nav button {
  font-size: 10px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid v-bind("P.btnBorder");
  background: v-bind("P.btnBg");
  color: v-bind("P.btnColor");
  cursor: pointer;
  transition: all 0.15s;
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
.view-content {
  min-height: 200px;
}
</style>
