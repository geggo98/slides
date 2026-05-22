<script setup>
import { methodMatcherPatterns } from "./slide-data.ts";
</script>

<template>
  <table class="mm-table">
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
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.mm-table th {
  text-align: left;
  font-weight: 500;
  padding: 4px 10px;
  border-bottom: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
}
.mm-table td {
  padding: 3px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
}
.mm-table code {
  font-family: var(--font-mono);
  font-size: 11.5px;
}
</style>
