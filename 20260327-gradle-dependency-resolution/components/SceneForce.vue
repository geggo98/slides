<script setup>
import { ref, computed } from 'vue'

const mode = ref('force')

const projVer = computed(() =>
  mode.value === 'force' ? '+ force(jackson:2.18.3)' : '+ strictly(jackson:2.18.3)'
)

const explain = computed(() =>
  mode.value === 'force'
    ? 'force() übersteuert alles — BOM, transitive Deps, Constraints. Kein Fehler, kein Warning. Du bist jetzt selbst für die Kompatibilität verantwortlich.'
    : 'strictly() erzwingt ebenfalls 2.18.3, aber: wenn die BOM 2.17.2 als Constraint setzt und dieser inkompatibel ist, schlägt der Build mit einem klaren Fehler fehl.'
)

const activeRank = computed(() => mode.value === 'force' ? [8] : [9])
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      <code>force()</code> und <code>strictly()</code> sind die höchsten Prioritäten.
      Beide übersteuern BOM, transitive Deps und alles andere.
      Unterschied: <code>force()</code> ist still, <code>strictly()</code> bricht bei Konflikten ab.
    </div>
    <div class="ctrl-row">
      <label>Modus:</label>
      <select v-model="mode">
        <option value="force">force()</option>
        <option value="strict">strictly()</option>
      </select>
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" :version="projVer" variant="source" />
      </div>
      <div class="g-spacer"><span class="g-arrow">↓</span></div>
      <div class="g-row">
        <GraphNode name="BOM" version="jackson = 2.17.2" variant="loser" />
        <div class="g-gap" />
        <GraphNode name="lib-a (transitiv)" version="jackson = 2.16.0" variant="loser" />
      </div>
      <div class="g-spacer"><span class="g-arrow">↓</span></div>
      <div class="g-row">
        <GraphNode name="jackson" version="2.18.3" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.18.3"
      :explain="explain"
    />
    <PriorityBar :active-ranks="activeRank" />
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 12px; }
.scene-desc code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 4px; border-radius: 4px; }
.graph { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 0 0 12px; }
.g-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.g-spacer { height: 24px; display: flex; align-items: center; justify-content: center; }
.g-arrow { font-size: 14px; color: var(--color-text-tertiary); }
.g-gap { width: 24px; }
.ctrl-row { display: flex; align-items: center; gap: 12px; margin: 0 0 12px; }
.ctrl-row label { font-size: 12px; color: var(--color-text-secondary); }
.ctrl-row select { font-family: inherit; font-size: 12px; padding: 4px 8px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-secondary); background: var(--color-background-primary); color: var(--color-text-primary); }
</style>
