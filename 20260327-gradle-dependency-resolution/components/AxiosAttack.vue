<script setup>
import { ref, watch, nextTick } from "vue";
import Tabs from "@shared/components/Tabs.vue";

const activeTab = ref("timeline");
const contentRef = ref(null);

const tabs = [
  { key: "timeline", label: "Zeitleiste" },
  { key: "anatomy", label: "Anatomie" },
  { key: "infection", label: "Infektionskette" },
];

watch(activeTab, () => {
  nextTick(() => contentRef.value?.scrollTo(0, 0));
});
</script>

<template>
  <div class="axios-attack">
    <Tabs v-model="activeTab" :tabs="tabs" aria-label="Axios-Angriff">
      <div ref="contentRef" class="tab-content">
        <AxiosTimeline v-if="activeTab === 'timeline'" />
        <AxiosAnatomy v-if="activeTab === 'anatomy'" />
        <AxiosInfectionChain v-if="activeTab === 'infection'" />
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
/* Tab-Optik = shared Tabs-Defaults (1:1 die alte .tab-btn-Palette); nur das
   Flex-Gerüst bleibt hier, damit der Scroll-Container die Resthöhe füllt. */
.axios-attack {
  width: 100%;
  height: 424px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.axios-attack :deep(.sk-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.axios-attack :deep(.sk-tab-panel) {
  flex: 1;
  min-height: 0;
}
.tab-content {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-secondary) transparent;
  padding-bottom: 16px;
}
</style>
