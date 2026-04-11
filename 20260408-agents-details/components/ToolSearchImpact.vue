<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { TOOLSEARCH_STATS } from "./chartData";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    cardBg: d
      ? "linear-gradient(135deg, #14141c, #1a1a24)"
      : "linear-gradient(135deg, #ffffff, #f9fafb)",
    cardBorder: d ? "#2a2a35" : "#e4e4e7",
    highlightBorder: d ? "#4ade80" : "#16a34a",
    valueColor: d ? "#4ade80" : "#16a34a",
    labelColor: d ? "#8a8a9a" : "#71717a",
    descColor: d ? "#b4b4c0" : "#52525b",
  };
});
</script>

<template>
  <div class="stats-grid">
    <div
      v-for="s in TOOLSEARCH_STATS"
      :key="s.label"
      class="stat-card"
      :class="{ highlight: s.highlight }"
    >
      <div class="stat-value">{{ s.value }}</div>
      <div class="stat-label">{{ s.label }}</div>
      <div class="stat-desc">{{ s.desc }}</div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.stat-card {
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
  padding: 14px;
}
.stat-card.highlight {
  border-color: v-bind("P.highlightBorder");
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: v-bind("P.valueColor");
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.stat-label {
  font-size: 10px;
  color: v-bind("P.labelColor");
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-top: 2px;
}
.stat-desc {
  font-size: 11px;
  color: v-bind("P.descColor");
  margin-top: 6px;
  line-height: 1.4;
}
</style>
