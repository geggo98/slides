<script setup>
import { computed } from 'vue'
import { useDarkMode } from '@slidev/client'

const { isDark } = useDarkMode()

const C = computed(() => isDark.value ? {
  surface: '#111621',
  border: '#1e2536',
  text: '#e2e8f0',
  muted: '#64748b',
  dim: '#3e4a63',
  red: '#ef4444',
  yellow: '#eab308',
  purple: '#a855f7',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.10)',
} : {
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  dim: '#94a3b8',
  red: '#dc2626',
  yellow: '#ca8a04',
  purple: '#9333ea',
  green: '#16a34a',
  greenDim: 'rgba(22,163,74,0.08)',
})

const steps = computed(() => [
  { from: 'RED', to: 'Duration\u2191', label: 'P99 springt auf 2s \u2014 Problem erkannt', color: C.value.red },
  { from: 'Golden', to: 'Saturation\u2191', label: 'Thread-Pool bei 95% \u2014 Engpass lokalisiert', color: C.value.yellow },
  { from: 'USE', to: 'CPU Throttle', label: 'CFS-Throttling 40% \u2014 Root Cause gefunden', color: C.value.purple },
])
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
    <div :style="{ fontSize: '8.4px', fontWeight: 700, color: C.text, marginBottom: '8px' }">
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
              fontFamily: `'JetBrains Mono', monospace`,
            }"
          >{{ step.from }}</span>
          <span :style="{ color: C.dim }">&rarr;</span>
          <span
            :style="{
              fontSize: '7.7px',
              fontWeight: 700,
              color: step.color,
              fontFamily: `'JetBrains Mono', monospace`,
            }"
          >{{ step.to }}</span>
          <span :style="{ fontSize: '7.7px', color: C.muted, marginLeft: '3px' }">{{ step.label }}</span>
        </div>
        <!-- "Warum?" connector -->
        <div v-if="i < steps.length - 1" :style="{ display: 'flex', justifyContent: 'center' }">
          <span :style="{ fontSize: '7px', color: C.dim, fontFamily: `'JetBrains Mono', monospace` }">&blacktriangledown; Warum?</span>
        </div>
      </template>
      <!-- Fix connector -->
      <div :style="{ display: 'flex', justifyContent: 'center' }">
        <span :style="{ fontSize: '7px', color: C.dim, fontFamily: `'JetBrains Mono', monospace` }">&blacktriangledown; Fix</span>
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
