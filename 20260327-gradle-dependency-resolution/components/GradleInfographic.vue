<script setup>
// Complete infographic: LayerStack left (narrow), Ecosystem + Table right (wide)
</script>

<template>
  <GradleVars>
    <div class="infographic">
      <div class="col-left">
        <LayerStack />
      </div>
      <div class="col-right">
        <EcosystemTabs />
        <CompareTable />
      </div>
    </div>
  </GradleVars>
</template>

<style scoped>
.infographic {
  width: 100%;
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.col-left {
  flex: 0 0 32%;
  min-width: 0;
}
.col-right {
  flex: 1;
  min-width: 0;
}
</style>
