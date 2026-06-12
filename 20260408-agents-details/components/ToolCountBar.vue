<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip, resolveColor } from "./chartConfig";
import { HARNESSES } from "./chartData";

const { isDark } = useDarkMode();

const option = computed(() => ({
  tooltip: { trigger: "axis", ...getTooltip(isDark) },
  grid: {
    left: "5%",
    right: "5%",
    bottom: "8%",
    top: "8%",
    containLabel: true,
  },
  xAxis: {
    type: "category",
    data: HARNESSES.map((h) => h.name),
    ...getAxis(isDark),
  },
  yAxis: {
    type: "value",
    name: "Tools",
    nameTextStyle: {
      color: isDark.value ? "#8a8a9a" : "#71717a",
      fontSize: 11,
    },
    ...getAxis(isDark),
  },
  series: [
    {
      type: "bar",
      data: HARNESSES.map((h) => ({
        value: h.tools,
        itemStyle: { color: resolveColor(h.color, isDark) },
      })),
      barMaxWidth: 50,
      label: {
        show: true,
        position: "top",
        color: isDark.value ? "#c8c8d0" : "#3f3f46",
        fontSize: 12,
      },
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="300" />
</template>
