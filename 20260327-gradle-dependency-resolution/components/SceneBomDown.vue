<script setup>
// Scene: BOM forces a downgrade
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      <strong>Gefährlicher Fall:</strong>
      Eine nicht-Spring-Library zieht transitiv jackson <code>2.18.0</code> ein.
      Die Spring BOM pinnt aber auf <code>2.17.2</code>. Die BOM gewinnt — Gradle macht ein stilles Downgrade.
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" version="+ Spring BOM 3.4.4" variant="source" />
      </div>
      <div class="g-spacer"><span class="g-arrow">↓</span></div>
      <div class="g-row">
        <GraphNode name="external-lib" version="3.0" />
        <div class="g-gap" />
        <GraphNode name="BOM" version="jackson = 2.17.2" variant="bom-node" />
      </div>
      <div class="g-spacer"><span class="g-arrow">↓</span></div>
      <div class="g-row">
        <GraphNode name="jackson" version="2.18.0" variant="loser" />
        <div class="g-gap" />
        <GraphNode name="jackson" version="2.17.2" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.17.2"
      value-color="warning"
      explain="Die BOM erzwingt 2.17.2, obwohl external-lib 2.18.0 braucht. Kein Compile-Fehler — aber wenn external-lib Features aus 2.18.0 nutzt, gibt es NoSuchMethodError zur Laufzeit."
    >
      <template #suffix>
        <span style="margin-left: 8px; font-size: 12px;">(Downgrade!)</span>
      </template>
    </ResultBox>
    <PriorityBar :active-ranks="[6]" />
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 12px; }
.scene-desc strong { color: var(--color-text-primary); font-weight: 500; }
.scene-desc code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 4px; border-radius: 4px; }
.graph { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 0 0 12px; }
.g-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.g-spacer { height: 24px; display: flex; align-items: center; justify-content: center; }
.g-arrow { font-size: 14px; color: var(--color-text-tertiary); }
.g-gap { width: 24px; }
</style>
