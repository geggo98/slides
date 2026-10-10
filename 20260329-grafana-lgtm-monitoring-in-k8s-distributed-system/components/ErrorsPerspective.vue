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
    red: d ? "#ef4444" : "#dc2626",
    redDim: d ? "rgba(239,68,68,0.10)" : "rgba(220,38,38,0.08)",
    purple: d ? "#a855f7" : "#9333ea",
    purpleDim: d ? "rgba(168,85,247,0.10)" : "rgba(147,51,234,0.08)",
  };
});

const redErrors = [
  "HTTP 5xx Responses",
  "Request-Timeouts",
  "Business-Logic-Failures",
  "Unvollständige Quotes",
];
const useErrors = [
  "ECC Memory Corrections",
  "Network Packet Drops/CRC",
  "Disk I/O Errors",
  "NIC Receive/Transmit Errors",
];
</script>

<template>
  <div
    :style="{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: '7px',
      padding: '16px 18px',
    }"
  >
    <div
      :style="{
        fontSize: '13px',
        fontWeight: 700,
        color: C.text,
        marginBottom: '12px',
      }"
    >
      Errors &ne; Errors: Zwei Perspektiven
    </div>
    <div
      :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }"
    >
      <!-- RED / Golden Signals errors -->
      <div
        :style="{
          padding: '12px 14px',
          borderRadius: '6px',
          background: C.redDim,
          border: `1px solid ${C.red}20`,
        }"
      >
        <div
          :style="{
            fontSize: '12px',
            fontWeight: 700,
            color: C.red,
            marginBottom: '4px',
            fontFamily: 'var(--slidev-code-font-family)',
          }"
        >
          RED / Golden Signals — Errors
        </div>
        <div
          :style="{
            fontSize: '13px',
            color: C.text,
            lineHeight: 1.5,
            marginBottom: '8px',
          }"
        >
          Perspektive: User
        </div>
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '4px' }">
          <div
            v-for="(e, i) in redErrors"
            :key="i"
            :style="{
              fontSize: '12px',
              color: C.muted,
              paddingLeft: '10px',
              position: 'relative',
            }"
          >
            <span :style="{ position: 'absolute', left: 0, color: C.red }"
              >&rsaquo;</span
            >{{ e }}
          </div>
        </div>
      </div>
      <!-- USE errors -->
      <div
        :style="{
          padding: '12px 14px',
          borderRadius: '6px',
          background: C.purpleDim,
          border: `1px solid ${C.purple}20`,
        }"
      >
        <div
          :style="{
            fontSize: '12px',
            fontWeight: 700,
            color: C.purple,
            marginBottom: '4px',
            fontFamily: 'var(--slidev-code-font-family)',
          }"
        >
          USE — Errors
        </div>
        <div
          :style="{
            fontSize: '13px',
            color: C.text,
            lineHeight: 1.5,
            marginBottom: '8px',
          }"
        >
          Perspektive: Maschine
        </div>
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '4px' }">
          <div
            v-for="(e, i) in useErrors"
            :key="i"
            :style="{
              fontSize: '12px',
              color: C.muted,
              paddingLeft: '10px',
              position: 'relative',
            }"
          >
            <span :style="{ position: 'absolute', left: 0, color: C.purple }"
              >&rsaquo;</span
            >{{ e }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
