<script setup lang="ts">
import { computed, ref } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip, resolveColor } from "./chartConfig";
import { MEMORY_APPROACHES } from "./chartData";
import SourcesPopover from "./SourcesPopover.vue";
import {
  line as sourceLine,
  scope as sourceScope,
  sources,
  caveats,
} from "./memoryScatterSources";

const { isDark } = useDarkMode();
const sourcesOpen = ref(false);
function openSources(e: MouseEvent) {
  (e.currentTarget as HTMLElement).blur();
  sourcesOpen.value = true;
}

const option = computed(() => ({
  tooltip: {
    trigger: "item",
    ...getTooltip(isDark),
    formatter: (p: any) =>
      `<strong>${p.data.name}</strong><br/>Komplexität: ${p.data.value[0]}/10<br/>Effektivität: ${p.data.value[1]}/10<br/>Token-Kosten: ${p.data.value[2]}/10`,
  },
  grid: {
    left: "8%",
    right: "8%",
    bottom: "10%",
    top: "5%",
    containLabel: true,
  },
  xAxis: {
    type: "value",
    min: 0,
    max: 10,
    name: "Setup-Komplexität →",
    nameLocation: "middle",
    nameGap: 30,
    nameTextStyle: {
      color: isDark.value ? "#8a8a9a" : "#71717a",
      fontSize: 12,
    },
    ...getAxis(isDark),
  },
  yAxis: {
    type: "value",
    min: 0,
    max: 10,
    name: "Effektivität für Coding →",
    nameLocation: "middle",
    nameGap: 40,
    nameTextStyle: {
      color: isDark.value ? "#8a8a9a" : "#71717a",
      fontSize: 12,
    },
    ...getAxis(isDark),
  },
  series: [
    {
      type: "scatter",
      data: MEMORY_APPROACHES.map((a) => ({
        value: [a.x, a.y, a.size],
        name: a.name,
        symbolSize: a.size * 5 + 18,
        itemStyle: {
          color: resolveColor(a.color, isDark),
          opacity: 0.7,
          borderColor: resolveColor(a.color, isDark),
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: a.name,
          position: "top",
          color: isDark.value ? "#e8e8f0" : "#18181b",
          fontSize: 10,
          backgroundColor: isDark.value ? "#0d0d14" : "#fafafa",
          padding: [3, 6],
          borderRadius: 3,
        },
      })),
    },
  ],
  graphic: [
    {
      type: "text",
      left: 30,
      top: 30,
      style: {
        text: "★ Sweet Spot",
        // Light-Mode: dunklerer Ton für Kontrast auf Weiß.
        fill: isDark.value ? "#4ade80" : "#16a34a",
        fontSize: 12,
        fontWeight: "bold",
      },
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="380" />
  <div class="ms-foot">
    <span>{{ sourceLine }}</span>
    <button
      class="ms-ib"
      aria-label="Quellen und Einschränkungen anzeigen"
      @click="openSources"
    >
      ⓘ Quellen
    </button>
  </div>
  <SourcesPopover
    :open="sourcesOpen"
    :scope="sourceScope"
    :sources="sources"
    :caveats="caveats"
    @close="sourcesOpen = false"
  />
</template>

<style scoped>
.ms-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.75;
}
.ms-ib {
  flex: none;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 5px;
  padding: 1px 8px;
  cursor: pointer;
}
</style>
