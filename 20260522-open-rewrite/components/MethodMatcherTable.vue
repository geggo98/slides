<script setup>
import "./data-table.css";
import { methodMatcherPatterns } from "./slide-data.ts";
</script>

<template>
  <table class="or-table mm-table">
    <thead>
      <tr>
        <th>Pattern</th>
        <th>Bedeutung</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="p in methodMatcherPatterns" :key="p.pattern">
        <td>
          <code>{{ p.pattern }}</code>
        </td>
        <td>{{ p.meaning }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.mm-table {
  /* Kompakter als die or-table-Defaults — Tabelle teilt sich die Folie
     mit einem Monaco-Block. */
  --or-table-th-pad: 4px 10px;
  --or-table-td-pad: 3px 10px;
}
.mm-table code {
  font-family: var(--font-mono);
  font-size: 11.5px;
}
</style>
