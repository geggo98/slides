<script setup lang="ts">
import StatGrid from "./StatGrid.vue";
import { AGENT_COLORS, LEAK_STATS } from "./chartData";
import { useDeckPalette } from "./palette";

// Violett = Pi-Akzent (AGENT_COLORS.pi): Wertfarbe der Karten und Farbe
// der Pi-Vergleichszeile im Karten-Footer.
const P = useDeckPalette();
</script>

<template>
  <StatGrid
    :stats="LEAK_STATS"
    :cols="3"
    :accent="AGENT_COLORS.pi"
    class="leak-grid"
  >
    <template #footer="{ stat }">
      <div v-if="stat.pi" class="stat-pi">
        Pi: <strong>{{ stat.pi }}</strong>
      </div>
    </template>
  </StatGrid>
</template>

<style scoped>
.leak-grid {
  /* Kompakter als die StatGrid-Defaults — 9 Karten in 3 Spalten. */
  --stat-gap: 8px;
  --stat-pad: 10px;
  --stat-value-size: 18px;
  --stat-label-size: 9px;
  --stat-label-mt: 0px;
  --stat-desc-size: 10px;
  --stat-desc-mt: 4px;
  margin-bottom: 12px;
}
.stat-pi {
  font-size: 10px;
  color: v-bind("P.accentViolet");
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid v-bind("P.cardBorder");
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
</style>
