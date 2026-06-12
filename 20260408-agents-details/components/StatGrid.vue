<script setup lang="ts" generic="T extends StatItem">
// Deck-lokales Stat-Card-Grid — dedupliziert das Karten-Layout von
// LeakStatsGrid (3 Spalten, kompakt) und ToolSearchImpact (2 Spalten).
// Größen sind über --stat-*-Custom-Properties auf dem Host überschreibbar
// (Defaults = ToolSearchImpact-Optik); Zusatzinhalt pro Karte über den
// scoped Slot "footer".
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { useDeckPalette } from "./palette";
import type { ThemedColor } from "./chartData";

interface StatItem {
  value: string;
  label: string;
  desc: string;
  highlight?: boolean;
}

const props = defineProps<{
  stats: T[];
  cols?: number;
  /** Wert-Farbe und Highlight-Border (Light/Dark-Paar). */
  accent: ThemedColor;
}>();

defineSlots<{ footer?: (props: { stat: T }) => unknown }>();

const { isDark } = useDarkMode();
const P = useDeckPalette();
const accentColor = computed(() =>
  isDark.value ? props.accent.dark : props.accent.light,
);
const gridCols = computed(() => `repeat(${props.cols ?? 2}, 1fr)`);
</script>

<template>
  <div class="stats-grid">
    <div
      v-for="s in stats"
      :key="s.label"
      class="stat-card"
      :class="{ highlight: s.highlight }"
    >
      <div class="stat-value">{{ s.value }}</div>
      <div class="stat-label">{{ s.label }}</div>
      <div class="stat-desc">{{ s.desc }}</div>
      <slot name="footer" :stat="s" />
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: v-bind(gridCols);
  gap: var(--stat-gap, 10px);
}
.stat-card {
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
  padding: var(--stat-pad, 14px);
}
.stat-card.highlight {
  border-color: v-bind(accentColor);
}
.stat-value {
  font-size: var(--stat-value-size, 22px);
  font-weight: 700;
  color: v-bind(accentColor);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.stat-label {
  font-size: var(--stat-label-size, 10px);
  color: v-bind("P.labelColor");
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-top: var(--stat-label-mt, 2px);
}
.stat-desc {
  font-size: var(--stat-desc-size, 11px);
  color: v-bind("P.descColor");
  margin-top: var(--stat-desc-mt, 6px);
  line-height: 1.4;
}
</style>
