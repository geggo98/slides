<script setup lang="ts">
// Deck-lokale Badge-Pille — dedupliziert das Badge-CSS von HarnessTable
// und McpOptTable (Farben aus der gemeinsamen Deck-Palette).
import { useDeckPalette } from "./palette";

defineProps<{ tone: "green" | "yellow" | "red" | "gray" }>();

const P = useDeckPalette();
</script>

<template>
  <span class="badge" :class="tone"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}
.badge.green {
  background: v-bind("P.badgeGreenBg");
  color: v-bind("P.badgeGreenText");
}
.badge.yellow {
  background: v-bind("P.badgeYellowBg");
  color: v-bind("P.badgeYellowText");
}
.badge.red {
  background: v-bind("P.badgeRedBg");
  color: v-bind("P.badgeRedText");
}
.badge.gray {
  background: v-bind("P.badgeGrayBg");
  color: v-bind("P.badgeGrayText");
}
</style>
