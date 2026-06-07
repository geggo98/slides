<script setup>
import { ref } from "vue";

const activeTab = ref("layers");

const tabs = [
  { key: "layers", label: "Dependency Stack" },
  { key: "ecosystem", label: "Ökosystem-Vergleich" },
  { key: "table", label: "Feature-Vergleich" },
  { key: "simulator", label: "Resolution Simulator" },
];
</script>

<template>
  <div class="infographic">
    <div class="tab-bar">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab-btn"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="tab-content">
      <LayerStack v-if="activeTab === 'layers'" />
      <EcosystemTabs v-if="activeTab === 'ecosystem'" />
      <CompareTable v-if="activeTab === 'table'" />
      <ResolutionSimulator v-if="activeTab === 'simulator'" />
    </div>
  </div>
</template>

<style scoped>
.infographic {
  width: 100%;
}
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}
.tab-btn {
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}
.tab-btn:hover {
  background: var(--color-background-secondary);
}
.tab-btn.active {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-text-secondary);
}
.tab-content {
  width: 100%;
}
</style>
