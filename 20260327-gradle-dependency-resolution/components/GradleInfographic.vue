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
  width: 154%;
  transform: scale(0.65);
  transform-origin: top left;
  overflow: visible;
}
.spacer { height: 1rem; }
</style>
