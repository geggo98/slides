<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useDarkMode } from "@slidev/client";
import { getThemeName, registerThemes } from "./chartConfig";

const props = defineProps<{
  option: Record<string, any>;
  height?: number;
}>();

const { isDark } = useDarkMode();
const container = ref<HTMLDivElement | null>(null);
let chart: any = null;
let echarts: any = null;
let ro: ResizeObserver | null = null;

async function initChart() {
  if (!container.value) return;
  if (chart) {
    chart.dispose();
    chart = null;
  }
  if (!echarts) {
    echarts = await import("echarts");
    registerThemes(echarts);
  }
  chart = echarts.init(container.value, getThemeName(isDark), {
    renderer: "svg",
  });
  chart.setOption(props.option, true);
}

onMounted(async () => {
  await initChart();
  if (container.value) {
    ro = new ResizeObserver(() => chart?.resize());
    ro.observe(container.value);
  }
});

watch(isDark, async () => {
  await initChart();
});

watch(
  () => props.option,
  (opt) => {
    if (chart) chart.setOption(opt, true);
  },
  { deep: true },
);

onBeforeUnmount(() => {
  ro?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div
    ref="container"
    :style="{ width: '100%', height: (height ?? 400) + 'px' }"
  />
</template>
