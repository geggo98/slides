<script setup>
import Tabs from "@shared/components/Tabs.vue";

const tabs = [
  { key: "terms", label: "Begriffe" },
  { key: "core", label: "Kernproblem" },
  { key: "evolution", label: "Evolution" },
  { key: "idiomatic", label: "Idiomatisch" },
  { key: "pitfalls", label: "Fallstricke" },
  { key: "matrix", label: "Matrix" },
];
</script>

<template>
  <GradleVars>
    <div class="jv-infographic">
      <Tabs :tabs="tabs" aria-label="Java-Versionen">
        <template #terms><JvmTerms /></template>
        <template #core><JvmCoreProblem /></template>
        <template #evolution><JvmEvolution /></template>
        <template #idiomatic><JvmIdiomatic /></template>
        <template #pitfalls><JvmPitfalls /></template>
        <template #matrix><JvmMatrix /></template>
      </Tabs>
    </div>
  </GradleVars>
</template>

<style scoped>
.jv-infographic {
  width: 100%;
}
</style>
