<script setup>
import MatrixPivot from "../../shared/components/MatrixPivot.vue";
import data from "./autonomy-pivot.json";

// Daten + Interaktion in der wiederverwendbaren shared/MatrixPivot-Komponente;
// hier nur Datensatz + Legende dieses Vortrags.
const legend = [
  { mark: "yes", label: "ja / GA" },
  { mark: "partial", label: "teilweise / Preview" },
  { mark: "no", label: "nein / experimentell" },
];
</script>

<template>
  <MatrixPivot :data="data" :legend="legend" />
</template>
