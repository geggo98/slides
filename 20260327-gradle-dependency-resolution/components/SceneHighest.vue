<script setup>
// Scene: Two libraries require different versions → highest wins
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      Zwei Libraries fordern unterschiedliche Versionen derselben transitiven Dependency. Gradle wählt die höchste — stillschweigend, ohne Warning.
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" variant="source" />
      </div>
      <TreeConnector type="fork" :width="180" />
      <div class="g-row">
        <GraphNode name="lib-a" version="1.0" />
        <div class="g-gap" />
        <GraphNode name="lib-b" version="1.0" />
      </div>
      <TreeConnector type="parallel" :width="180" />
      <div class="g-row">
        <GraphNode name="jackson" version="2.15.0" variant="loser" />
        <div class="g-gap" />
        <GraphNode name="jackson" version="2.17.2" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.17.2"
      explain="Gradle wählt automatisch die höchste Version. Im Dependency-Tree sichtbar als 2.15.0 -> 2.17.2. Kein Fehler, kein Warning."
    />
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 10px; }
.graph { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 0 0 10px; }
.g-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.g-gap { width: 24px; }
</style>
