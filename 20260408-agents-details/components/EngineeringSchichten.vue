<script setup>
import { ref } from "vue";
import Tabs from "@shared/components/Tabs.vue";

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
    <Tabs
      v-model="activeTab"
      :tabs="tabs"
      aria-label="Engineering-Schichten-Ansichten"
      class="schichten-infographic"
    >
      <div class="tab-content">
        <SchichtenStack v-if="activeTab === 'stack'" />
        <SchichtenTimeline v-else-if="activeTab === 'timeline'" />
        <SchichtenDisciplines v-else-if="activeTab === 'disciplines'" />
        <SchichtenEvolution v-else-if="activeTab === 'evolution'" />
        <SchichtenVerdict v-else-if="activeTab === 'verdict'" />
      </div>
    </Tabs>
  </SchichtenVars>
</template>

<style scoped>
.schichten-infographic {
  width: 100%;
  /* Optik der alten deck-eigenen Tab-Bar 1:1 über die --sk-tab-*-Hooks
     des shared Tabs.vue (Gap, Font, Padding, Transition = Defaults). */
  --sk-tab-bar-mb: 14px;
  --sk-tab-border: 1px solid var(--s-line-strong);
  --sk-tab-radius: 6px;
  --sk-tab-color: var(--s-fg-muted);
  --sk-tab-hover-bg: var(--s-bg-soft);
  --sk-tab-active-bg: var(--s-bg-soft);
  --sk-tab-active-color: var(--s-fg);
  --sk-tab-active-border: var(--s-fg-muted);
}
/* Die alte Tab-Bar hellte beim Hover auch die Schrift auf — das shared
   Tabs.vue ändert nur den Hintergrund, daher hier nachgezogen. */
.schichten-infographic :deep(.sk-tab:hover) {
  color: var(--s-fg);
}
.tab-content {
  width: 100%;
  max-height: 390px;
  overflow-y: auto;
  padding-right: 4px;
}
</style>
