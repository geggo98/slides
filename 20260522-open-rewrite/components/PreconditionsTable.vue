<script setup>
import { preconditionTypes } from "./slide-data.ts";
</script>

<template>
  <table class="pc-table">
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
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.pc-table th {
  text-align: left;
  font-weight: 500;
  padding: 4px 10px;
  border-bottom: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
}
.pc-table td {
  padding: 3px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
}
.pc-table code {
  font-family: var(--font-mono);
  font-size: 11.5px;
}
</style>
