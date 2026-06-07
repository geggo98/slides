<script setup>
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
import { jspecifyMixedCode, jspecifyMixedAnnotations } from "./slide-data.ts";
</script>

<template>
  <MonacoBlockAnnotated
    :code="jspecifyMixedCode"
    language="java"
    height="290px"
    :annotations="jspecifyMixedAnnotations"
  />
</template>
