<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip } from "./chartConfig";
import { TOOL_ACCURACY } from "./chartData";

const { isDark } = useDarkMode();

const option = computed(() => ({
  tooltip: {
    trigger: "axis",
    ...getTooltip(isDark),
    formatter: (params: any) =>
      params[0].axisValue +
      " Tools<br/>" +
      params
        .map(
          (p: any) =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: <strong>${p.value[1]}%</strong>`,
        )
        .join("<br/>"),
  },
  legend: {
    data: ["Standard", "Mit Tool Search"],
    textStyle: { color: isDark.value ? "#c8c8d0" : "#3f3f46" },
    top: 0,
  },
  grid: {
    left: "5%",
    right: "5%",
    bottom: "8%",
    top: "15%",
    containLabel: true,
  },
  xAxis: {
    type: "log",
    name: "Anzahl Tools (log)",
    nameTextStyle: { color: isDark.value ? "#8a8a9a" : "#71717a" },
    nameLocation: "middle",
    nameGap: 30,
    ...getAxis(isDark),
  },
  yAxis: {
    type: "value",
    max: 100,
    name: "Tool-Selection-Accuracy %",
    nameTextStyle: { color: isDark.value ? "#8a8a9a" : "#71717a" },
    ...getAxis(isDark),
    axisLabel: {
      ...getAxis(isDark).axisLabel,
      formatter: (v: number) => v + "%",
    },
  },
  series: [
    {
      name: "Standard",
      type: "line",
      data: TOOL_ACCURACY.standard,
      itemStyle: { color: "#f472b6" },
      lineStyle: { width: 3 },
      symbol: "circle",
      symbolSize: 8,
      markLine: {
        symbol: "none",
        silent: true,
        data: [
          {
            yAxis: 49,
            label: {
              formatter: "Opus 4 mit allen Tools: 49%",
              color: "#fb923c",
              fontSize: 10,
            },
            lineStyle: { color: "#fb923c", type: "dashed" },
          },
        ],
      },
    },
    {
      name: "Mit Tool Search",
      type: "line",
      data: TOOL_ACCURACY.withToolSearch,
      itemStyle: { color: "#4ade80" },
      lineStyle: { width: 3 },
      symbol: "circle",
      symbolSize: 8,
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="360" />
</template>
