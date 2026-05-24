<script setup>
import BadgeRow from "./BadgeRow.vue";
import WhenGrid from "./WhenGrid.vue";

defineProps({
  tag: { type: String, required: true },
  badges: { type: Array, required: true },
  apply: { type: Array, required: true },
  avoid: { type: Array, required: true },
  verdict: { type: String, required: true },
  verdictTone: {
    type: String,
    default: "info",
    validator: (v) => ["info", "success", "warning", "danger"].includes(v),
  },
});
</script>

<template>
  <div class="aip-card">
    <p class="tag">{{ tag }}</p>
    <BadgeRow :badges="badges" />
    <slot name="pipeline" />
    <WhenGrid :apply="apply" :avoid="avoid" />
    <div :class="['verdict', `t-${verdictTone}`]">
      <strong>Meine Einschätzung:</strong> {{ verdict }}
    </div>
  </div>
</template>

<style scoped>
.aip-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tag {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin: 0;
  line-height: 1.55;
}
.verdict {
  padding: 10px 14px;
  border-radius: var(--sk-rad);
  font-size: 13.5px;
  line-height: 1.55;
}
.verdict.t-info {
  background: var(--color-background-info);
  color: var(--color-text-info);
}
.verdict.t-success {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.verdict.t-warning {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.verdict.t-danger {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}
.verdict strong {
  font-weight: 500;
}
</style>
