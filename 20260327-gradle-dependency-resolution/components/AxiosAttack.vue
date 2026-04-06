<script setup>
import { ref, watch, nextTick } from 'vue'

const activeTab = ref('timeline')
const contentRef = ref(null)

const tabs = [
  { key: 'timeline', label: 'Zeitleiste' },
  { key: 'anatomy', label: 'Anatomie' },
  { key: 'infection', label: 'Infektionskette' },
]

watch(activeTab, () => {
  nextTick(() => contentRef.value?.scrollTo(0, 0))
})
</script>

<template>
  <GradleVars>
    <div class="axios-attack">
      <div class="tab-bar">
        <button
          v-for="t in tabs" :key="t.key"
          class="tab-btn" :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
        >{{ t.label }}</button>
      </div>
      <div ref="contentRef" class="tab-content">
        <AxiosTimeline v-if="activeTab === 'timeline'" />
        <AxiosAnatomy v-if="activeTab === 'anatomy'" />
        <AxiosInfectionChain v-if="activeTab === 'infection'" />
      </div>
    </div>
  </GradleVars>
</template>

<style scoped>
.axios-attack {
  width: 100%;
  height: 472px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  transition: background 0.15s, color 0.15s, border-color 0.15s;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-secondary) transparent;
  padding-bottom: 16px;
}
</style>
