<script setup>
defineProps({
  activeRanks: { type: Array, default: () => [] }, // which rank numbers are highlighted
})

const rows = [
  { rank: 9, name: 'strictly()' },
  { rank: 8, name: 'force()' },
  { rank: 7, name: 'enforcedPlatform()' },
  { rank: 6, name: 'Spring dependency-management plugin' },
  { rank: 5, name: 'platform() (BOM)' },
  { rank: 4, name: 'Dependency constraints' },
  { rank: 3, name: 'Direkte Version / Catalog' },
  { rank: 2, name: 'Highest version wins (default)' },
  { rank: 1, name: 'Transitive Version' },
]
</script>

<template>
  <div class="prio-bar">
    <div
      v-for="r in rows" :key="r.rank"
      class="prio-row"
      :class="{ active: activeRanks.includes(r.rank) }"
    >
      <div class="prio-rank">{{ r.rank }}</div>
      <div class="prio-name">{{ r.name }}</div>
    </div>
  </div>
</template>

<style scoped>
.prio-bar { display: flex; flex-direction: column; gap: 2px; }
.prio-row { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: var(--border-radius-md); font-size: 11px; transition: all 0.3s; }
.prio-row .prio-rank { font-weight: 500; min-width: 18px; color: var(--color-text-tertiary); }
.prio-row .prio-name { flex: 1; color: var(--color-text-secondary); }
.prio-row.active { background: var(--color-background-success); }
.prio-row.active .prio-name { color: var(--color-text-success); font-weight: 500; }
.prio-row.active .prio-rank { color: var(--color-text-success); }
</style>
