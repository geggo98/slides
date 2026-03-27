<script setup>
// Scene: Spring Boot BOM pins version
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      Die Spring Boot BOM pinnt jackson auf eine feste Version. Auch wenn keine Dependency eine höhere Version anfordert, übersteuert die BOM die transitive Auflösung.
    </div>
    <div class="graph">
      <div class="g-row">
        <GraphNode name="Your project" version="+ Spring BOM 3.4.4" variant="source" />
      </div>
      <TreeConnector type="fork" :width="180" />
      <div class="g-row">
        <GraphNode name="starter-web" version="keine Version" />
        <div class="g-gap" />
        <GraphNode name="BOM" version="jackson = 2.17.2" variant="bom-node" />
      </div>
      <TreeConnector type="single" />
      <div class="g-row">
        <GraphNode name="jackson" version="2.17.2" variant="winner" />
      </div>
    </div>
    <ResultBox
      value="jackson:2.17.2"
      explain="Starter-web wird ohne Version deklariert. Die BOM liefert die Version. So ist es für ~300 Dependencies. Version Catalog würde hier ignoriert werden."
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
