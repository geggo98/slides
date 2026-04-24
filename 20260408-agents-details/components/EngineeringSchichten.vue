<script setup>
import { ref } from "vue";

const activeTab = ref("stack");

const tabs = [
  { key: "stack", label: "Schichtung" },
  { key: "timeline", label: "Zeitachse" },
  { key: "disciplines", label: "Disziplinen" },
  { key: "evolution", label: "Evolution" },
  { key: "verdict", label: "Fazit" },
];
</script>

<template>
  <SchichtenVars>
    <div class="schichten-infographic">
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
        <SchichtenStack v-if="activeTab === 'stack'" />
        <SchichtenTimeline v-else-if="activeTab === 'timeline'" />
        <SchichtenDisciplines v-else-if="activeTab === 'disciplines'" />
        <SchichtenEvolution v-else-if="activeTab === 'evolution'" />
        <SchichtenVerdict v-else-if="activeTab === 'verdict'" />
      </div>
    </div>
  </SchichtenVars>
</template>

<style scoped>
.schichten-infographic {
  width: 100%;
}
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.tab-btn {
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--s-line-strong);
  border-radius: 6px;
  background: transparent;
  color: var(--s-fg-muted);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  font-family: inherit;
}
.tab-btn:hover {
  background: var(--s-bg-soft);
  color: var(--s-fg);
}
.tab-btn.active {
  background: var(--s-bg-soft);
  color: var(--s-fg);
  border-color: var(--s-fg-muted);
}
.tab-content {
  width: 100%;
  max-height: 390px;
  overflow-y: auto;
  padding-right: 4px;
}
</style>
