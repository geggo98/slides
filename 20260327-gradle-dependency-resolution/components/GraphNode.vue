<script setup>
defineProps({
  name: String,
  version: String,
  variant: { type: String, default: 'neutral' }, // neutral, source, winner, loser, bom-node
})
</script>

<template>
  <div class="g-node" :class="variant">
    <div class="g-node-name">{{ name }}</div>
    <div v-if="version" class="g-node-ver">{{ version }}</div>
  </div>
</template>

<style scoped>
.g-node { border-radius: var(--border-radius-md); padding: 8px 16px; text-align: center; min-width: 100px; border: 0.5px solid var(--color-border-tertiary); background: var(--color-background-secondary); transition: all 0.3s; }
.g-node-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
.g-node-ver { font-size: 12px; font-family: var(--font-mono); color: var(--color-text-secondary); margin-top: 2px; }
.g-node.winner { border-color: var(--color-border-success); background: var(--color-background-success); }
.g-node.winner .g-node-name { color: var(--color-text-success); }
.g-node.winner .g-node-ver { color: var(--color-text-success); }
.g-node.loser { border-color: var(--color-border-danger); background: var(--color-background-danger); opacity: 0.6; }
.g-node.loser .g-node-name { color: var(--color-text-danger); }
.g-node.loser .g-node-ver { color: var(--color-text-danger); text-decoration: line-through; }
.g-node.source { border-color: var(--color-border-info); background: var(--color-background-info); }
.g-node.source .g-node-name { color: var(--color-text-info); }
.g-node.source .g-node-ver { color: var(--color-text-info); }
.g-node.bom-node { border-color: var(--color-border-warning); background: var(--color-background-warning); }
.g-node.bom-node .g-node-name { color: var(--color-text-warning); }
.g-node.bom-node .g-node-ver { color: var(--color-text-warning); }
</style>
