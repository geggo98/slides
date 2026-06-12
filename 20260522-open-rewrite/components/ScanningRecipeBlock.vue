<script setup>
import MonacoBlock from "@shared/components/MonacoBlock.vue";
import { scanningRecipeSnippet } from "./slide-data.ts";
</script>

<template>
  <MonacoBlock :code="scanningRecipeSnippet" language="java" height="190px" />
</template>
