<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getTooltip } from "./chartConfig";
import { TREEMAP_DATA } from "./chartData";

const { isDark } = useDarkMode();

const option = computed(() => ({
  tooltip: {
    ...getTooltip(isDark),
    formatter: (info: any) => {
      const count = info.data.children ? info.data.children.length : 0;
      return `<strong>${info.name}</strong>${count ? "<br/>" + count + " Varianten" : ""}`;
    },
  },
  series: [
    {
      type: "treemap",
      data: TREEMAP_DATA,
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: {
        show: true,
        formatter: "{b}",
        color: "#fff",
        fontSize: 11,
        lineHeight: 14,
        // Dunkler Halo, damit weiße Labels auch auf helleren Zellen
        // (Gelb/Grün/Blau-400) lesbar bleiben — sonst nur ~2:1 Kontrast.
        textBorderColor: "rgba(0,0,0,0.55)",
        textBorderWidth: 2,
      },
      upperLabel: {
        show: true,
        height: 28,
        color: "#fff",
        fontSize: 14,
        fontWeight: 700,
        textBorderColor: "rgba(0,0,0,0.55)",
        textBorderWidth: 2,
      },
      itemStyle: {
        borderColor: isDark.value ? "#0a0a0f" : "#ffffff",
        borderWidth: 1,
        gapWidth: 2,
      },
      levels: [
        {
          itemStyle: {
            borderColor: isDark.value ? "#0a0a0f" : "#ffffff",
            borderWidth: 0,
            gapWidth: 4,
          },
          upperLabel: { show: false },
        },
        {
          itemStyle: {
            borderColor: isDark.value ? "#0a0a0f" : "#ffffff",
            borderWidth: 4,
            gapWidth: 2,
          },
          upperLabel: { show: true, height: 28 },
        },
      ],
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="460" />
</template>
