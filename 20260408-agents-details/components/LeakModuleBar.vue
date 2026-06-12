<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode, useNav } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip } from "./chartConfig";
import { MODULE_SIZES } from "./chartData";

const { isDark } = useDarkMode();
const nav = useNav();
const showPiLine = computed(() => nav.clicks.value >= 1);

const option = computed(() => ({
  tooltip: {
    trigger: "axis",
    ...getTooltip(isDark),
    formatter: (params: any) =>
      `${params[0].name}<br/><strong>${params[0].value.toLocaleString("de-DE")}</strong> Zeilen`,
  },
  grid: {
    left: "5%",
    right: "12%",
    bottom: "5%",
    top: "5%",
    containLabel: true,
  },
  xAxis: {
    type: "value",
    ...getAxis(isDark),
    axisLabel: {
      ...getAxis(isDark).axisLabel,
      formatter: (v: number) => v.toLocaleString("de-DE"),
    },
  },
  yAxis: {
    type: "category",
    data: [...MODULE_SIZES].reverse().map((m) => m.name),
    ...getAxis(isDark),
  },
  series: [
    {
      type: "bar",
      data: [...MODULE_SIZES].reverse().map((m) => m.lines),
      barMaxWidth: 28,
      itemStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            // Light-Mode: dunklere Töne für Kontrast auf Weiß.
            { offset: 0, color: isDark.value ? "#fb923c" : "#ea580c" },
            { offset: 1, color: isDark.value ? "#f472b6" : "#db2777" },
          ],
        },
      },
      label: {
        show: true,
        position: "right",
        color: isDark.value ? "#c8c8d0" : "#3f3f46",
        fontSize: 12,
        formatter: (p: any) => p.value.toLocaleString("de-DE"),
      },
      markLine: {
        symbol: "none",
        silent: true,
        animationDuration: 600,
        data: showPiLine.value
          ? [
              {
                xAxis: 3000,
                label: {
                  formatter: "Pi (gesamt) ~3K",
                  color: isDark.value ? "#a78bfa" : "#7c3aed",
                  position: "insideStartTop",
                  fontSize: 12,
                  fontWeight: "bold",
                },
                lineStyle: {
                  color: isDark.value ? "#a78bfa" : "#7c3aed",
                  type: "dashed",
                  width: 2,
                },
              },
            ]
          : [],
      },
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="400" />
</template>
