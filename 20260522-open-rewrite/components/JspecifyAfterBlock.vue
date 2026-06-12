<script setup>
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
import { jspecifyAfterCode, jspecifyAfterAnnotations } from "./slide-data.ts";
</script>

<template>
  <MonacoBlockAnnotated
    :code="jspecifyAfterCode"
    language="java"
    height="230px"
    :annotations="jspecifyAfterAnnotations"
  />
</template>
