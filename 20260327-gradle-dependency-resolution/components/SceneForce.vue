<script setup>
import { ref, computed, inject, watch } from 'vue'

const activeRanks = inject('activeRanks', ref([8]))
const mode = ref('force')

const projVer = computed(() =>
  mode.value === 'force' ? '+ force(jackson:2.18.3)' : '+ strictly(jackson:2.18.3)'
)

const explain = computed(() =>
  mode.value === 'force'
    ? 'force() übersteuert alles — BOM, transitive Deps, Constraints. Kein Fehler, kein Warning. Du bist selbst für Kompatibilität verantwortlich.'
    : 'strictly() erzwingt 2.18.3 — bei inkompatiblem BOM-Constraint schlägt der Build mit klarem Fehler fehl.'
)

watch(mode, (val) => {
  activeRanks.value = val === 'force' ? [8] : [9]
}, { immediate: true })
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      <code>force()</code> und <code>strictly()</code> sind die höchsten Prioritäten.
      <code>force()</code> ist still, <code>strictly()</code> bricht bei Konflikten ab.
    </div>
    <div class="ctrl-row">
      <label>Modus:</label>
      <select v-model="mode" @click.stop>
        <option value="force">force()</option>
        <option value="strict">strictly()</option>
      </select>
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" :version="projVer" variant="source" />
      </div>
      <TreeConnector type="fork" :width="180" />
      <div class="g-row">
        <GraphNode name="BOM" version="jackson = 2.17.2" variant="loser" />
        <div class="g-gap" />
        <GraphNode name="lib-a (transitiv)" version="jackson = 2.16.0" variant="loser" />
      </div>
      <TreeConnector type="single" />
      <div class="g-row">
        <GraphNode name="jackson" version="2.18.3" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.18.3"
      :explain="explain"
    />
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 8px; }
.scene-desc code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 4px; border-radius: 4px; }
.graph { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 0 0 10px; }
.g-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.g-gap { width: 24px; }
.ctrl-row { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; }
.ctrl-row label { font-size: 12px; color: var(--color-text-secondary); }
.ctrl-row select { font-family: inherit; font-size: 12px; padding: 4px 8px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-secondary); background: var(--color-background-primary); color: var(--color-text-primary); }
</style>
