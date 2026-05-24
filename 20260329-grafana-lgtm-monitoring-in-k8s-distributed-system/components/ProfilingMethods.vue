<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import MethodBox from "./MethodBox.vue";

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    blue: d ? "#3b82f6" : "#2563eb",
    blueDim: d ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.08)",
    orange: d ? "#f97316" : "#ea580c",
    orangeDim: d ? "rgba(249,115,22,0.10)" : "rgba(234,88,12,0.08)",
    red: d ? "#ef4444" : "#dc2626",
    redDim: d ? "rgba(239,68,68,0.10)" : "rgba(220,38,38,0.08)",
    purple: d ? "#a855f7" : "#9333ea",
    purpleDim: d ? "rgba(168,85,247,0.10)" : "rgba(147,51,234,0.08)",
  };
});

const profiles = computed(() => [
  {
    color: C.value.blue,
    colorDim: C.value.blueDim,
    title: "CPU",
    tag: "HOT PATH",
    description: "Wer verbrennt die meisten Zyklen?",
    signals: [
      {
        letter: "S",
        name: "Sampling",
        desc: "async-profiler (itimer / cpu / wall) oder eBPF",
      },
      {
        letter: "U",
        name: "Use Case",
        desc: "Hot Functions: JSON-Parse, Crypto, Regex",
      },
    ],
  },
  {
    color: C.value.orange,
    colorDim: C.value.orangeDim,
    title: "Allocation",
    tag: "GC-DRUCK",
    description: "Wo entstehen Objekte? Was treibt den GC?",
    signals: [
      {
        letter: "S",
        name: "Sampling",
        desc: "TLAB-Events (async-profiler --alloc)",
      },
      {
        letter: "U",
        name: "Use Case",
        desc: "Allokations-Hotspots, GC-Pausen-Wurzel",
      },
    ],
  },
  {
    color: C.value.red,
    colorDim: C.value.redDim,
    title: "Lock Contention",
    tag: "WAIT",
    description: "Wo blockieren Threads aufeinander?",
    signals: [
      {
        letter: "S",
        name: "Sampling",
        desc: "synchronized / ReentrantLock-Wait-Events",
      },
      {
        letter: "U",
        name: "Use Case",
        desc: "Thread-Pool-Saturation, JVM-Stalls",
      },
    ],
  },
  {
    color: C.value.purple,
    colorDim: C.value.purpleDim,
    title: "In-Use Heap",
    tag: "MEMORY",
    description: "Wer hält Live-Objekte fest?",
    signals: [
      {
        letter: "S",
        name: "Sampling",
        desc: "Live-Allocation-Profile pro Call-Site",
      },
      {
        letter: "U",
        name: "Use Case",
        desc: "Memory-Leak-Hunt ohne Heap-Dump",
      },
    ],
  },
]);
</script>

<template>
  <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }">
    <div v-for="(p, i) in profiles" :key="i">
      <MethodBox v-bind="p" :style="{ height: '100%' }" />
    </div>
  </div>
</template>
