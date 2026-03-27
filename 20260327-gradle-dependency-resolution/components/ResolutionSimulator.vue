<script setup>
import { ref } from 'vue'

const activeScene = ref('highest')

const tabs = [
  { id: 'highest', label: 'Highest wins' },
  { id: 'bom', label: 'BOM override' },
  { id: 'bomdown', label: 'BOM downgrade' },
  { id: 'catalog', label: 'Catalog vs BOM' },
  { id: 'force', label: 'force() / strictly()' },
  { id: 'sandbox', label: 'Überblick' },
]
</script>

<template>
  <GradleVars>
    <div class="simulator">
      <h2 class="sim-title">Gradle Dependency Resolution Simulator</h2>
      <p class="sim-subtitle">Interaktiv: Szenarien durchspielen und sehen, welche Prioritätsstufe gewinnt.</p>

      <div class="sc-tabs">
        <button
          v-for="t in tabs" :key="t.id"
          class="sc-tab" :class="{ active: activeScene === t.id }"
          @click="activeScene = t.id"
        >{{ t.label }}</button>
      </div>

      <SceneHighest v-if="activeScene === 'highest'" />
      <SceneBom v-if="activeScene === 'bom'" />
      <SceneBomDown v-if="activeScene === 'bomdown'" />
      <SceneCatalog v-if="activeScene === 'catalog'" />
      <SceneForce v-if="activeScene === 'force'" />
      <SceneSandbox v-if="activeScene === 'sandbox'" />
    </div>
  </GradleVars>
</template>

<style scoped>
.simulator { width: 100%; overflow-y: auto; max-height: 100%; }
.sim-title { font-size: 18px; font-weight: 500; margin: 0 0 4px; color: var(--color-text-primary); }
.sim-subtitle { font-size: 12px; color: var(--color-text-secondary); margin: 0 0 12px; }
.sc-tabs { display: flex; gap: 4px; margin: 0 0 16px; flex-wrap: wrap; }
.sc-tab { font-size: 12px; padding: 5px 12px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-tertiary); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: inherit; }
.sc-tab:hover { background: var(--color-background-secondary); }
.sc-tab.active { background: var(--color-background-primary); border-color: var(--color-border-primary); color: var(--color-text-primary); font-weight: 500; }
</style>
