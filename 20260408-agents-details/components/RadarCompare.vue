<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getTooltip } from "./chartConfig";
import { HARNESSES, RADAR_INDICATORS } from "./chartData";

const { isDark } = useDarkMode();

const option = computed(() => ({
  tooltip: { trigger: "item", ...getTooltip(isDark) },
  legend: {
    data: HARNESSES.map((h) => h.name),
    bottom: 0,
    type: "scroll",
    textStyle: { color: isDark.value ? "#c8c8d0" : "#3f3f46" },
    icon: "circle",
    itemWidth: 10,
    itemHeight: 10,
  },
  radar: {
    indicator: RADAR_INDICATORS,
    shape: "polygon",
    center: ["50%", "48%"],
    radius: "62%",
    splitArea: {
      areaStyle: {
        color: isDark.value
          ? ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"]
          : ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.04)"],
      },
    },
    axisLine: { lineStyle: { color: isDark.value ? "#3a3a4a" : "#d4d4d8" } },
    splitLine: { lineStyle: { color: isDark.value ? "#3a3a4a" : "#d4d4d8" } },
    axisName: { color: isDark.value ? "#c8c8d0" : "#3f3f46", fontSize: 11 },
  },
  series: [
    {
      type: "radar",
      data: HARNESSES.map((h) => ({
        value: h.values,
        name: h.name,
        lineStyle: { color: h.color, width: 2 },
        itemStyle: { color: h.color },
        areaStyle: { color: h.color, opacity: 0.08 },
      })),
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="410" />
</template>
