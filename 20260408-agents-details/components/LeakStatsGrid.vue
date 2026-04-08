<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { LEAK_STATS } from "./chartData";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    cardBg: d
      ? "linear-gradient(135deg, #14141c, #1a1a24)"
      : "linear-gradient(135deg, #ffffff, #f9fafb)",
    cardBorder: d ? "#2a2a35" : "#e4e4e7",
    valueColor: d ? "#a78bfa" : "#7c3aed",
    labelColor: d ? "#8a8a9a" : "#71717a",
    descColor: d ? "#b4b4c0" : "#52525b",
    piColor: d ? "#a78bfa" : "#7c3aed",
    piBorder: d ? "#2a2a35" : "#e4e4e7",
  };
});
</script>

<template>
  <div class="stats-grid">
    <div v-for="s in LEAK_STATS" :key="s.label" class="stat-card">
      <div class="stat-value">{{ s.value }}</div>
      <div class="stat-label">{{ s.label }}</div>
      <div class="stat-desc">{{ s.desc }}</div>
      <div v-if="s.pi" class="stat-pi">
        Pi: <strong>{{ s.pi }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stat-card {
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
  padding: 10px;
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: v-bind("P.valueColor");
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.stat-label {
  font-size: 9px;
  color: v-bind("P.labelColor");
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}
.stat-desc {
  font-size: 10px;
  color: v-bind("P.descColor");
  margin-top: 4px;
  line-height: 1.4;
}
.stat-pi {
  font-size: 10px;
  color: v-bind("P.piColor");
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid v-bind("P.piBorder");
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.stat-pi strong {
  color: v-bind("P.piColor");
}
</style>
