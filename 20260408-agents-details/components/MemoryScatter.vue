<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip } from "./chartConfig";
import { MEMORY_APPROACHES } from "./chartData";

const { isDark } = useDarkMode();

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
          color: a.color,
          opacity: 0.7,
          borderColor: a.color,
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
        fill: "#4ade80",
        fontSize: 12,
        fontWeight: "bold",
      },
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="420" />
</template>
