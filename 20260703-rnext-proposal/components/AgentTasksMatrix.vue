<script setup lang="ts">
import MatrixPivot from "@shared/components/MatrixPivot.vue";
import {
  AGENT_TASKS_LEGEND,
  AGENT_TASKS_MARKSCHEME,
  AGENT_TASKS_MATRIX,
} from "./slide-data";
</script>

<template>
  <MatrixPivot
    :data="AGENT_TASKS_MATRIX"
    :legend="AGENT_TASKS_LEGEND"
    :mark-scheme="AGENT_TASKS_MARKSCHEME"
    hint="ⓘ Klick für Details · Ein Agent fragt bei Unklarheit nach — ein Code-Generator rät"
  />
</template>
