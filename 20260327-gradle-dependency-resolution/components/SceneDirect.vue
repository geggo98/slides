<script setup>
// Scene: Direct version declaration / Version Catalog overrides transitive version
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      Eine direkte Versionsangabe (oder Version aus dem Catalog) übersteuert die transitive Version.
      Ohne BOM reicht eine explizite Deklaration, um die gewünschte Version zu erzwingen.
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" variant="source" />
      </div>
      <TreeConnector type="fork" :width="180" />
      <div class="g-row">
        <GraphNode name="lib-a" version="1.0" />
        <div class="g-gap" />
        <GraphNode name="jackson" version="2.18.3 (direkt)" variant="winner" />
      </div>
      <TreeConnector type="left-single" :width="180" />
      <div class="g-row">
        <GraphNode name="jackson" version="2.15.0 (transitiv)" variant="loser" />
        <div class="g-gap" />
        <div class="g-placeholder" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.18.3"
      explain="Die direkte Version (Prio 3) schlägt die transitive (Prio 1). Version Catalog ist Textersatz — zählt ebenfalls als direkte Deklaration."
    />
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 10px; }
.graph { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 0 0 10px; }
.g-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.g-gap { width: 24px; }
.g-placeholder { min-width: 100px; padding: 8px 16px; visibility: hidden; }
</style>
