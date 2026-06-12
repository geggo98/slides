<script setup lang="ts">
import StatGrid from "./StatGrid.vue";
import { TOOLSEARCH_STATS, type ThemedColor } from "./chartData";

// Grün = Erfolgs-Akzent für die ToolSearch-Kennzahlen.
const ACCENT: ThemedColor = { light: "#16a34a", dark: "#4ade80" };
</script>

<template>
  <StatGrid :stats="TOOLSEARCH_STATS" :cols="2" :accent="ACCENT" />
</template>
