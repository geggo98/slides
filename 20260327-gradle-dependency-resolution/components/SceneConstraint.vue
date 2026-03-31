<script setup>
// Scene: Dependency constraints influence version resolution
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      <code>constraints { }</code> setzen eine bevorzugte Version, ohne die Dependency selbst einzuziehen.
      Wirkt nur, wenn die Dependency bereits im Graph ist (transitiv oder direkt).
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" version="+ constraint jackson:2.18.3" variant="source" />
      </div>
      <TreeConnector type="fork" :width="180" />
      <div class="g-row">
        <GraphNode name="lib-a" version="1.0" />
        <div class="g-gap" />
        <GraphNode name="Constraint" version="jackson ≥ 2.18.3" variant="neutral" />
      </div>
      <TreeConnector type="parallel" :width="180" />
      <div class="g-row">
        <GraphNode name="jackson" version="2.15.0 (transitiv)" variant="loser" />
        <div class="g-gap" />
        <GraphNode name="jackson" version="2.18.3" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.18.3"
      explain="Der Constraint hebt die Version auf 2.18.3. Ohne die transitive Dependency im Graph hätte der Constraint keine Wirkung — er zieht keine Dependency ein."
    />
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 10px; }
.scene-desc code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 4px; border-radius: 4px; }
.graph { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 0 0 10px; }
.g-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.g-gap { width: 24px; }
</style>
