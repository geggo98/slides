<script setup>
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
import { jspecifyRecipeYaml, jspecifyRecipeAnnotations } from "./slide-data.ts";
</script>

<template>
  <MonacoBlockAnnotated
    :code="jspecifyRecipeYaml"
    language="yaml"
    height="320px"
    :annotations="jspecifyRecipeAnnotations"
  />
</template>
