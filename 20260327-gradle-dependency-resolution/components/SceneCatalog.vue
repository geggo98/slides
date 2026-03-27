<script setup>
import { ref } from 'vue'

const overrideMode = ref('none')

const overrideResults = {
  ext: { value: 'jackson:2.18.3', color: 'success', explain: 'ext["jackson.version"] ändert die BOM-Property direkt. Das Spring-Plugin liest die überschriebene Property und verwendet 2.18.3. Funktioniert nur für BOM-Properties.', rank: 6 },
  force: { value: 'jackson:2.18.3', color: 'success', explain: 'force() übersteuert alles — BOM, Plugin, Constraints. Still, ohne Fehler. Du bist für Kompatibilität verantwortlich.', rank: 8 },
  strict: { value: 'jackson:2.18.3', color: 'success', explain: 'strictly() erzwingt die Version. Wenn ein anderer Constraint eine inkompatible Version fordert, schlägt der Build fehl statt still zu übersteuern.', rank: 9 },
}
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      Der Version Catalog sagt jackson <code>2.18.3</code>. Die Spring BOM sagt <code>2.17.2</code>. Wer gewinnt?
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" version="+ Spring BOM 3.4.4" variant="source" />
      </div>
      <div class="g-spacer"><span class="g-arrow">↓</span></div>
      <div class="g-row">
        <GraphNode name="Catalog" version="jackson = 2.18.3" variant="loser" />
        <div class="g-gap" />
        <GraphNode name="BOM" version="jackson = 2.17.2" variant="bom-node" />
      </div>
      <div class="g-spacer"><span class="g-arrow">↓</span></div>
      <div class="g-row">
        <GraphNode name="jackson" version="2.17.2" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.17.2"
      value-color="warning"
      explain="Der Catalog ist reiner Textersatz (Prio 3). Das Spring-Plugin (Prio 6) übersteuert ihn. Die TOML-Datei suggeriert 2.18.3, im Build landet 2.17.2. Nur das Lock-File zeigt die Wahrheit."
    >
      <template #suffix>
        <span style="margin-left: 8px; font-size: 12px;">(Catalog ignoriert!)</span>
      </template>
    </ResultBox>

    <div class="ctrl-row">
      <label>Override-Variante:</label>
      <select v-model="overrideMode">
        <option value="none">-- Variante wählen --</option>
        <option value="ext">ext["jackson.version"] = "2.18.3"</option>
        <option value="force">force("...jackson:2.18.3")</option>
        <option value="strict">version { strictly("2.18.3") }</option>
      </select>
    </div>

    <ResultBox
      v-if="overrideMode !== 'none'"
      :value="overrideResults[overrideMode].value"
      :value-color="overrideResults[overrideMode].color"
      :explain="overrideResults[overrideMode].explain"
    />

    <PriorityBar :active-ranks="overrideMode !== 'none' ? [overrideResults[overrideMode].rank] : [6]" />
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
.ctrl-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; flex-wrap: wrap; }
.ctrl-row label { font-size: 12px; color: var(--color-text-secondary); }
.ctrl-row select { font-family: inherit; font-size: 12px; padding: 4px 8px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-secondary); background: var(--color-background-primary); color: var(--color-text-primary); }
</style>
