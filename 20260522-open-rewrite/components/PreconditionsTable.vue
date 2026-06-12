<script setup>
import "./data-table.css";
import { preconditionTypes } from "./slide-data.ts";
</script>

<template>
  <table class="or-table pc-table">
    <thead>
      <tr>
        <th>Precondition</th>
        <th>Zweck</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="p in preconditionTypes" :key="p.name">
        <td>
          <code>{{ p.name }}</code>
        </td>
        <td>{{ p.purpose }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.pc-table {
  /* Kompakter als die or-table-Defaults — Tabelle teilt sich die Folie
     mit einem Monaco-Block. */
  --or-table-th-pad: 4px 10px;
  --or-table-td-pad: 3px 10px;
}
.pc-table code {
  font-family: var(--font-mono);
  font-size: 11.5px;
}
</style>
