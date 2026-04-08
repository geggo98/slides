import type { Ref } from "vue";

export function getAxis(isDark: Ref<boolean> | { value: boolean }) {
  const d = typeof isDark === "object" ? isDark.value : isDark;
  return {
    axisLine: { lineStyle: { color: d ? "#3a3a4a" : "#d4d4d8" } },
    axisTick: { lineStyle: { color: d ? "#3a3a4a" : "#d4d4d8" } },
    axisLabel: { color: d ? "#8a8a9a" : "#71717a", fontSize: 11 },
    splitLine: { lineStyle: { color: d ? "#1f1f2a" : "#e4e4e7" } },
  };
}

export function getTooltip(isDark: Ref<boolean> | { value: boolean }) {
  const d = typeof isDark === "object" ? isDark.value : isDark;
  return {
    backgroundColor: d ? "#1a1a24" : "#ffffff",
    borderColor: d ? "#3a3a4a" : "#d4d4d8",
    textStyle: { color: d ? "#e8e8f0" : "#18181b", fontSize: 12 },
  };
}

export function getThemeName(isDark: Ref<boolean> | { value: boolean }) {
  const d = typeof isDark === "object" ? isDark.value : isDark;
  return d ? "agentDark" : "agentLight";
}

export function registerThemes(echarts: any) {
  echarts.registerTheme("agentDark", {
    backgroundColor: "transparent",
    textStyle: {
      color: "#c8c8d0",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    },
  });
  echarts.registerTheme("agentLight", {
    backgroundColor: "transparent",
    textStyle: {
      color: "#3f3f46",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    },
  });
}
