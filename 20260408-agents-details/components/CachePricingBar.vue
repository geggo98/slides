<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip } from "./chartConfig";
import { CACHE_PRICING } from "./chartData";

const { isDark } = useDarkMode();

const option = computed(() => ({
  tooltip: { trigger: "axis", ...getTooltip(isDark) },
  legend: {
    data: ["Cache-Write", "Cache-Read"],
    textStyle: { color: isDark.value ? "#c8c8d0" : "#3f3f46" },
    top: 0,
  },
  grid: {
    left: "5%",
    right: "5%",
    bottom: "5%",
    top: "18%",
    containLabel: true,
  },
  xAxis: {
    type: "category",
    data: CACHE_PRICING.providers,
    ...getAxis(isDark),
  },
  yAxis: {
    type: "value",
    max: 1.5,
    name: "× Base-Preis",
    nameTextStyle: { color: isDark.value ? "#8a8a9a" : "#71717a" },
    ...getAxis(isDark),
  },
  series: [
    {
      name: "Cache-Write",
      type: "bar",
      data: CACHE_PRICING.cacheWrite,
      itemStyle: { color: "#fb923c" },
      barMaxWidth: 32,
      label: {
        show: true,
        position: "top",
        color: isDark.value ? "#c8c8d0" : "#3f3f46",
        fontSize: 11,
        formatter: (p: any) => p.value + "×",
      },
    },
    {
      name: "Cache-Read",
      type: "bar",
      data: CACHE_PRICING.cacheRead,
      itemStyle: { color: "#4ade80" },
      barMaxWidth: 32,
      label: {
        show: true,
        position: "top",
        color: isDark.value ? "#c8c8d0" : "#3f3f46",
        fontSize: 11,
        formatter: (p: any) => p.value + "×",
      },
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="300" />
</template>
