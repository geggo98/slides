<script setup>
defineProps({
  badges: { type: Array, required: true },
});
</script>

<template>
  <div class="badge-row">
    <span
      v-for="b in badges"
      :key="b.label"
      :class="['badge', `t-${b.tone || 'neutral'}`]"
    >
      {{ b.label }}
    </span>
  </div>
</template>

<style scoped>
.badge-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: var(--sk-rad);
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
}
.badge.t-good {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.badge.t-bad {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}
.badge.t-warn {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
</style>
