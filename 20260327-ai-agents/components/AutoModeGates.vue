<script setup>
import MatrixPivot from "@shared/components/MatrixPivot.vue";
import data from "./auto-mode-gates.json";

// Daten + Interaktion in der wiederverwendbaren shared/MatrixPivot-Komponente;
// hier nur Datensatz + Legende dieses Vortrags.
const legend = [
  { mark: "yes", label: "ja / vorhanden" },
  { mark: "partial", label: "teilweise / hybrid" },
  { mark: "no", label: "nein / kein Boundary" },
];
</script>

<template>
  <MatrixPivot :data="data" :legend="legend" />
</template>
