<script setup>
import { ref } from "vue";
import Tabs from "@shared/components/Tabs.vue";

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
    <!-- Tab-Optik = shared Tabs-Defaults (identisch zur alten .tab-btn). -->
    <Tabs v-model="activeTab" :tabs="tabs" aria-label="Gradle-Infografik">
      <LayerStack v-if="activeTab === 'layers'" />
      <EcosystemTabs v-if="activeTab === 'ecosystem'" />
      <CompareTable v-if="activeTab === 'table'" />
      <ResolutionSimulator v-if="activeTab === 'simulator'" />
    </Tabs>
  </div>
</template>

<style scoped>
.infographic {
  width: 100%;
}
</style>
