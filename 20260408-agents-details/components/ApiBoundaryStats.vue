<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import StatGrid from "./StatGrid.vue";
import { AGENT_COLORS, SYSTIMA_STATS } from "./chartData";
import { useDeckPalette } from "./palette";

// Kartenwerte = Claude-Code-Messwerte (Orange-Akzent), Footer-Zeile = der
// OpenCode-Vergleichswert in dessen Amber-Ton — analog zur Pi-Zeile im
// LeakStatsGrid.
const { isDark } = useDarkMode();
const P = useDeckPalette();
const ocColor = computed(() =>
  isDark.value ? AGENT_COLORS.opencode.dark : AGENT_COLORS.opencode.light,
);
</script>

<template>
  <StatGrid
    :stats="SYSTIMA_STATS"
    :cols="2"
    :accent="AGENT_COLORS.claudeCode"
    class="api-grid"
  >
    <template #footer="{ stat }">
      <div class="stat-oc">
        OpenCode: <strong>{{ stat.oc }}</strong>
      </div>
    </template>
  </StatGrid>
</template>

<style scoped>
.api-grid {
  /* Vier Karten in 2×2 — etwas kompakter als die StatGrid-Defaults. */
  --stat-gap: 10px;
  --stat-pad: 12px;
  --stat-value-size: 20px;
  --stat-label-size: 10px;
  --stat-desc-size: 11px;
  --stat-desc-mt: 4px;
}
.stat-oc {
  font-size: 10px;
  color: v-bind(ocColor);
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid v-bind("P.cardBorder");
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
</style>
