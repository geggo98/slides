<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    surface: d ? "#111621" : "#ffffff",
    border: d ? "#1e2536" : "#e2e8f0",
    text: d ? "#e2e8f0" : "#1e293b",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    red: d ? "#ef4444" : "#dc2626",
    yellow: d ? "#eab308" : "#ca8a04",
    purple: d ? "#a855f7" : "#9333ea",
    green: d ? "#22c55e" : "#16a34a",
    greenDim: d ? "rgba(34,197,94,0.10)" : "rgba(22,163,74,0.08)",
  };
});

const steps = computed(() => [
  {
    from: "RED",
    to: "Duration\u2191",
    label: "P99 springt auf 2s \u2014 Problem erkannt",
    color: C.value.red,
  },
  {
    from: "Golden",
    to: "Saturation\u2191",
    label: "Thread-Pool bei 95% \u2014 Engpass lokalisiert",
    color: C.value.yellow,
  },
  {
    from: "USE",
    to: "CPU Throttle",
    label: "CFS-Throttling 40% \u2014 Root Cause gefunden",
    color: C.value.purple,
  },
]);
</script>

<template>
  <div
    :style="{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: '7px',
      padding: '13px 14px',
    }"
  >
    <div
      :style="{
        fontSize: '8.4px',
        fontWeight: 700,
        color: C.text,
        marginBottom: '8px',
      }"
    >
      Diagnostischer Trichter: RED &rarr; Golden &rarr; USE
    </div>
    <div :style="{ display: 'flex', flexDirection: 'column', gap: '4px' }">
      <template v-for="(step, i) in steps" :key="i">
        <!-- Relation arrow -->
        <div
          :style="{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: `${step.color}08`,
            borderRadius: '4px',
            border: `1px solid ${step.color}15`,
          }"
        >
          <span
            :style="{
              fontSize: '7.7px',
              fontWeight: 700,
              color: step.color,
              fontFamily: 'var(--slidev-code-font-family)',
            }"
            >{{ step.from }}</span
          >
          <span :style="{ color: C.dim }">&rarr;</span>
          <span
            :style="{
              fontSize: '7.7px',
              fontWeight: 700,
              color: step.color,
              fontFamily: 'var(--slidev-code-font-family)',
            }"
            >{{ step.to }}</span
          >
          <span
            :style="{ fontSize: '7.7px', color: C.muted, marginLeft: '3px' }"
            >{{ step.label }}</span
          >
        </div>
        <!-- "Warum?" connector -->
        <div
          v-if="i < steps.length - 1"
          :style="{ display: 'flex', justifyContent: 'center' }"
        >
          <span
            :style="{
              fontSize: '7px',
              color: C.dim,
              fontFamily: 'var(--slidev-code-font-family)',
            }"
            >&blacktriangledown; Warum?</span
          >
        </div>
      </template>
      <!-- Fix connector -->
      <div :style="{ display: 'flex', justifyContent: 'center' }">
        <span
          :style="{
            fontSize: '7px',
            color: C.dim,
            fontFamily: 'var(--slidev-code-font-family)',
          }"
          >&blacktriangledown; Fix</span
        >
      </div>
      <!-- Fix result -->
      <div
        :style="{
          padding: '6px 8px',
          background: C.greenDim,
          borderRadius: '4px',
          border: `1px solid ${C.green}15`,
          fontSize: '8.4px',
          color: C.green,
          fontWeight: 600,
        }"
      >
        CPU-Limit erh&ouml;hen: 500m &rarr; 1000m
      </div>
    </div>
  </div>
</template>
