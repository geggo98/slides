<script setup>
defineProps({
  apply: { type: Array, required: true },
  avoid: { type: Array, required: true },
  applyLabel: { type: String, default: "Wann anwenden" },
  avoidLabel: { type: String, default: "Wann nicht" },
});
</script>

<template>
  <div class="when-grid">
    <div class="cell">
      <h4>{{ applyLabel }}</h4>
      <ul>
        <li v-for="(a, i) in apply" :key="i">{{ a }}</li>
      </ul>
    </div>
    <div class="cell">
      <h4>{{ avoidLabel }}</h4>
      <ul>
        <li v-for="(a, i) in avoid" :key="i">{{ a }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.when-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cell {
  background: var(--color-background-secondary);
  border-radius: var(--sk-rad);
  padding: 6px 12px;
}
h4 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
}
ul {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--color-text-secondary);
}
li {
  margin: 0.15rem 0;
}
</style>
