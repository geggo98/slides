<script setup>
import { ref, provide } from 'vue'

const activeScene = ref('highest')
const activeRanks = ref([3])

provide('activeRanks', activeRanks)

const tabs = [
  { id: 'highest', label: 'Highest wins' },
  { id: 'bom', label: 'BOM override' },
  { id: 'bomdown', label: 'BOM downgrade' },
  { id: 'catalog', label: 'Catalog vs BOM' },
  { id: 'force', label: 'force() / strictly()' },
  { id: 'sandbox', label: 'Überblick' },
]

// Default ranks per scene (scenes can override via inject)
const defaultRanks = {
  highest: [3],
  bom: [6],
  bomdown: [6],
  catalog: [6],
  force: [8],
  sandbox: [8, 9],
}

function switchScene(id) {
  activeScene.value = id
  activeRanks.value = defaultRanks[id] || []
}
</script>

<template>
  <GradleVars>
    <div class="simulator">
      <div class="sim-header">
        <h2 class="sim-title">Resolution Simulator</h2>
        <div class="sc-tabs">
          <button
            v-for="t in tabs" :key="t.id"
            class="sc-tab" :class="{ active: activeScene === t.id }"
            @click.stop="switchScene(t.id)"
          >{{ t.label }}</button>
        </div>
      </div>

      <div class="sim-body">
        <div class="sim-left">
          <PriorityBar :active-ranks="activeRanks" />
        </div>
        <div class="sim-right">
          <SceneHighest v-if="activeScene === 'highest'" />
          <SceneBom v-if="activeScene === 'bom'" />
          <SceneBomDown v-if="activeScene === 'bomdown'" />
          <SceneCatalog v-if="activeScene === 'catalog'" />
          <SceneForce v-if="activeScene === 'force'" />
          <SceneSandbox v-if="activeScene === 'sandbox'" />
        </div>
      </div>
    </div>
  </GradleVars>
</template>

<style scoped>
.simulator { width: 100%; }
.sim-header { margin: 0 0 10px; }
.sim-title { font-size: 16px; font-weight: 500; margin: 0 0 6px; color: var(--color-text-primary); }
.sc-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.sc-tab { font-size: 11px; padding: 4px 10px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-tertiary); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: inherit; }
.sc-tab:hover { background: var(--color-background-secondary); }
.sc-tab.active { background: var(--color-background-primary); border-color: var(--color-border-primary); color: var(--color-text-primary); font-weight: 500; }
.sim-body { display: flex; gap: 1rem; align-items: flex-start; }
.sim-left { flex: 0 0 220px; }
.sim-right { flex: 1; min-width: 0; }
</style>
