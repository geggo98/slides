<script setup>
import { ref, provide, watch } from "vue";
import Tabs from "@shared/components/Tabs.vue";

const activeScene = ref("highest");
const activeRanks = ref([3]);

provide("activeRanks", activeRanks);

const tabs = [
  { key: "highest", label: "Highest wins" },
  { key: "direct", label: "Direkte Version" },
  { key: "constraint", label: "Dependency Constraints" },
  { key: "bom", label: "BOM override" },
  { key: "bomdown", label: "BOM downgrade" },
  { key: "catalog", label: "Catalog vs BOM" },
  { key: "force", label: "force() / strictly()" },
  { key: "sandbox", label: "Überblick" },
];

// Default ranks per scene (scenes can override via inject)
const defaultRanks = {
  highest: [2],
  direct: [3],
  constraint: [4],
  bom: [6],
  bomdown: [6],
  catalog: [6],
  force: [8],
  sandbox: [8, 9],
};

watch(activeScene, (id) => {
  activeRanks.value = defaultRanks[id] || [];
});
</script>

<template>
  <div class="simulator">
    <h2 class="sim-title">Resolution Simulator</h2>
    <Tabs v-model="activeScene" :tabs="tabs" aria-label="Resolution-Szenarien">
      <div class="sim-body">
        <div class="sim-left">
          <PriorityBar :active-ranks="activeRanks" />
        </div>
        <div class="sim-right">
          <SceneHighest v-if="activeScene === 'highest'" />
          <SceneDirect v-if="activeScene === 'direct'" />
          <SceneConstraint v-if="activeScene === 'constraint'" />
          <SceneBom v-if="activeScene === 'bom'" />
          <SceneBomDown v-if="activeScene === 'bomdown'" />
          <SceneCatalog v-if="activeScene === 'catalog'" />
          <SceneForce v-if="activeScene === 'force'" />
          <SceneSandbox v-if="activeScene === 'sandbox'" />
        </div>
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
.simulator {
  width: 100%;
  /* Reproduce the previous .sc-tab styling via the shared Tabs vars. */
  --sk-tab-bar-mb: 10px;
  --sk-tab-font-size: 11px;
  --sk-tab-pad: 4px 10px;
  --sk-tab-radius: var(--border-radius-md);
  --sk-tab-border: 0.5px solid var(--color-border-tertiary);
  --sk-tab-transition: all 0.15s;
  --sk-tab-font-weight: 400;
  --sk-tab-active-font-weight: 500;
  --sk-tab-active-bg: var(--color-background-primary);
  --sk-tab-active-border: var(--color-border-primary);
}
.sim-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 6px;
  color: var(--color-text-primary);
}
.sim-body {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.sim-left {
  flex: 0 0 220px;
}
.sim-right {
  flex: 1;
  min-width: 0;
}
</style>
