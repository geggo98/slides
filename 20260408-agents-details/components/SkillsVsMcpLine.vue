<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip } from "./chartConfig";
import { SKILLS_VS_MCP } from "./chartData";

const { isDark } = useDarkMode();

const option = computed(() => ({
  tooltip: {
    trigger: "axis",
    ...getTooltip(isDark),
    formatter: (params: any) =>
      params[0].name +
      " Stk.<br/>" +
      params
        .map(
          (p: any) =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: <strong>${p.value.toLocaleString("de-DE")}</strong> Tokens`,
        )
        .join("<br/>"),
  },
  legend: {
    data: ["Skills (Progressive)", "MCP-Server (Static)"],
    textStyle: { color: isDark.value ? "#c8c8d0" : "#3f3f46" },
    top: 0,
  },
  grid: {
    left: "5%",
    right: "5%",
    bottom: "8%",
    top: "18%",
    containLabel: true,
  },
  xAxis: {
    type: "category",
    data: SKILLS_VS_MCP.categories,
    name: "Anzahl",
    nameTextStyle: { color: isDark.value ? "#8a8a9a" : "#71717a" },
    ...getAxis(isDark),
  },
  yAxis: {
    type: "log",
    name: "Tokens (log)",
    nameTextStyle: { color: isDark.value ? "#8a8a9a" : "#71717a" },
    ...getAxis(isDark),
    axisLabel: {
      ...getAxis(isDark).axisLabel,
      formatter: (v: number) => (v >= 1000 ? v / 1000 + "K" : v),
    },
  },
  series: [
    {
      name: "Skills (Progressive)",
      type: "line",
      data: SKILLS_VS_MCP.skills,
      // Light-Mode: dunklere Töne für Kontrast auf Weiß.
      itemStyle: { color: isDark.value ? "#4ade80" : "#16a34a" },
      lineStyle: { width: 3 },
      symbol: "circle",
      symbolSize: 8,
    },
    {
      name: "MCP-Server (Static)",
      type: "line",
      data: SKILLS_VS_MCP.mcp,
      itemStyle: { color: isDark.value ? "#f472b6" : "#db2777" },
      lineStyle: { width: 3 },
      symbol: "circle",
      symbolSize: 8,
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="320" />
</template>
