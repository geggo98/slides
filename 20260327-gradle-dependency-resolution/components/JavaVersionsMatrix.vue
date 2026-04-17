<script setup>
import { ref } from "vue";

const activeTab = ref("terms");

const tabs = [
  { key: "terms", label: "Begriffe" },
  { key: "core", label: "Kernproblem" },
  { key: "evolution", label: "Evolution" },
  { key: "idiomatic", label: "Idiomatisch" },
  { key: "pitfalls", label: "Fallstricke" },
  { key: "matrix", label: "Matrix" },
];
</script>

<template>
  <GradleVars>
    <div class="jv-infographic">
      <div class="tab-bar">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab-btn"
          :class="{ active: activeTab === t.key }"
          @click.stop="activeTab = t.key"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="tab-content">
        <JvmTerms v-if="activeTab === 'terms'" />
        <JvmCoreProblem v-else-if="activeTab === 'core'" />
        <JvmEvolution v-else-if="activeTab === 'evolution'" />
        <JvmIdiomatic v-else-if="activeTab === 'idiomatic'" />
        <JvmPitfalls v-else-if="activeTab === 'pitfalls'" />
        <JvmMatrix v-else-if="activeTab === 'matrix'" />
      </div>
    </div>
  </GradleVars>
</template>

<style scoped>
.jv-infographic {
  width: 100%;
}
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-wrap: wrap;
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
  font-family: inherit;
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
