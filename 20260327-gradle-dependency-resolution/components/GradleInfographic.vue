<script setup>
// Complete infographic combining all sub-components
</script>

<template>
  <GradleVars>
    <div class="infographic">
      <LayerStack />
      <div class="spacer" />
      <EcosystemTabs />
      <CompareTable />
    </div>
  </GradleVars>
</template>

<style scoped>
.infographic {
  width: 100%;
  overflow-y: auto;
  max-height: 100%;
}
.spacer { height: 1.5rem; }
</style>
