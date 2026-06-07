<script setup>
import { ref, computed } from "vue";
import MonacoBlockAnnotated from "../../shared/components/MonacoBlockAnnotated.vue";
import { PATTERNS } from "./slide-data.ts";

// Tab-Block „Original vs. moderne Entsprechung". Entweder direkt `:tabs`
// übergeben oder per `name` aus der PATTERNS-Registry in slide-data.ts ziehen.
// tab = { label, code, language?, annotations?, note?, callout?, height? }
const props = defineProps({
  name: { type: String, default: "" },
  tabs: { type: Array, default: null },
});

const tabs = computed(() => props.tabs ?? PATTERNS[props.name]?.tabs ?? []);
const active = ref(0);
const current = computed(() => tabs.value[active.value] ?? {});
</script>

<template>
  <div class="pt-wrap">
    <div class="tab-bar">
      <button
        v-for="(t, i) in tabs"
        :key="i"
        :class="{ active: active === i }"
        type="button"
        @click.stop="active = i"
      >
        {{ t.label }}
      </button>
    </div>

    <div :key="active" class="panel">
      <p v-if="current.note" class="lead" v-html="current.note" />
      <MonacoBlockAnnotated
        :code="current.code"
        :language="current.language || 'java'"
        :height="current.height || '300px'"
        :annotations="current.annotations || []"
        show-language-badge
      />
      <div v-if="current.callout" class="callout" v-html="current.callout" />
    </div>
  </div>
</template>

<style scoped>
.pt-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tab-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  padding-bottom: 8px;
}
.tab-bar button {
  font: inherit;
  font-size: 12px;
  padding: 6px 12px;
  background: transparent;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--sk-rad);
  cursor: pointer;
  color: var(--color-text-secondary);
}
.tab-bar button.active {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-color: var(--color-border-info);
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lead {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}
.lead :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-secondary);
  padding: 1px 5px;
  border-radius: 3px;
}
.callout {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  border-radius: var(--sk-rad);
  padding: 9px 13px;
  line-height: 1.5;
}
.callout :deep(strong) {
  color: var(--color-text-primary);
  font-weight: 500;
}
.callout :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-primary);
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
