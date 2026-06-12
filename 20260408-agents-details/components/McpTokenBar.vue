<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode, useNav } from "@slidev/client";
import EChartWrapper from "./EChartWrapper.vue";
import { getAxis, getTooltip } from "./chartConfig";
import { MCP_DATA } from "./chartData";

const { isDark } = useDarkMode();
const nav = useNav();
const showCost = computed(() => nav.clicks.value >= 1);

// Claude Opus 4.6 (1M context): $5 / MTok input
const PRICE_PER_MTOK = 5.0;
const MODEL_LABEL = "Claude Opus 4.6 (1M)";

function formatCost(tokens: number) {
  const usd = (tokens * PRICE_PER_MTOK) / 1_000_000;
  return "$" + usd.toFixed(2);
}

const option = computed(() => ({
  tooltip: {
    trigger: "axis",
    ...getTooltip(isDark),
    formatter: (p: any) => {
      const tokens = p[0].value;
      let s = `${p[0].name}<br/><strong>${tokens.toLocaleString("de-DE")}</strong> Tokens`;
      if (showCost.value)
        s += `<br/>Kosten: <strong>${formatCost(tokens)}</strong> / Request`;
      return s;
    },
  },
  grid: {
    left: "5%",
    right: "18%",
    bottom: "5%",
    top: "5%",
    containLabel: true,
  },
  xAxis: {
    type: "value",
    ...getAxis(isDark),
    axisLabel: {
      ...getAxis(isDark).axisLabel,
      formatter: (v: number) =>
        showCost.value ? formatCost(v) : v / 1000 + "K",
    },
    name: showCost.value
      ? `Kosten / Request (${MODEL_LABEL}, $${PRICE_PER_MTOK}/MTok)`
      : undefined,
    nameTextStyle: {
      color: isDark.value ? "#8a8a9a" : "#71717a",
      fontSize: 10,
    },
    nameLocation: "middle",
    nameGap: 25,
  },
  yAxis: {
    type: "category",
    data: MCP_DATA.map((d) => d.name),
    ...getAxis(isDark),
  },
  series: [
    {
      type: "bar",
      data: MCP_DATA.map((d) => ({
        value: d.tokens,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              // Light-Mode: dunklere Töne für Kontrast auf Weiß.
              { offset: 0, color: isDark.value ? "#a78bfa" : "#7c3aed" },
              { offset: 1, color: isDark.value ? "#fb923c" : "#c2410c" },
            ],
          },
        },
      })),
      barMaxWidth: 28,
      label: {
        show: true,
        position: "right",
        color: isDark.value ? "#c8c8d0" : "#3f3f46",
        fontSize: 11,
        formatter: (p: any) =>
          showCost.value
            ? `${p.value.toLocaleString("de-DE")}  ·  ${formatCost(p.value)}`
            : p.value.toLocaleString("de-DE"),
      },
    },
  ],
}));
</script>

<template>
  <EChartWrapper :option="option" :height="320" />
</template>
