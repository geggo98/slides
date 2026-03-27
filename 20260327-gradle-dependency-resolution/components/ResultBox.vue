<script setup>
defineProps({
  label: { type: String, default: 'Aufgelöste Version' },
  value: String,
  valueColor: { type: String, default: 'success' }, // success, warning, danger
  explain: String,
})
</script>

<template>
  <div class="result-box">
    <div class="result-label">{{ label }}</div>
    <div class="result-val" :style="{ color: `var(--color-text-${valueColor})` }">
      <code>{{ value }}</code>
      <slot name="suffix" />
    </div>
    <div v-if="explain" class="result-explain">{{ explain }}</div>
    <slot />
  </div>
</template>

<style scoped>
.result-box { border-radius: var(--border-radius-lg); padding: 0.75rem 1rem; margin: 0 0 8px; border: 0.5px solid var(--color-border-tertiary); background: var(--color-background-primary); }
.result-label { font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px; }
.result-val { font-size: 14px; font-weight: 500; }
.result-val code { font-family: var(--font-mono); font-size: 13px; background: var(--color-background-tertiary); padding: 1px 5px; border-radius: 4px; }
.result-explain { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; line-height: 1.5; }
</style>
