<script setup>
import { computed } from 'vue'
import { useDarkMode } from '@slidev/client'

const { isDark } = useDarkMode()

const C = computed(() => isDark.value ? {
  surface: '#111621',
  border: '#1e2536',
  text: '#e2e8f0',
  muted: '#64748b',
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.10)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.10)',
} : {
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  red: '#dc2626',
  redDim: 'rgba(220,38,38,0.08)',
  purple: '#9333ea',
  purpleDim: 'rgba(147,51,234,0.08)',
})

const redErrors = ['HTTP 5xx Responses', 'Request-Timeouts', 'Business-Logic-Failures', 'Unvollständige Quotes']
const useErrors = ['ECC Memory Corrections', 'Network Packet Drops/CRC', 'Disk I/O Errors', 'NIC Receive/Transmit Errors']
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
      Errors &ne; Errors: Zwei Perspektiven
    </div>
    <div :style="{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }">
      <!-- RED / Golden Signals errors -->
      <div :style="{ padding: '8px 10px', borderRadius: '6px', background: C.redDim, border: `1px solid ${C.red}20` }">
        <div
          :style="{
            fontSize: '7.7px',
            fontWeight: 700,
            color: C.red,
            marginBottom: '4px',
            fontFamily: `'JetBrains Mono', monospace`,
          }"
        >RED / Golden Signals — Errors</div>
        <div :style="{ fontSize: '8.4px', color: C.text, lineHeight: 1.5, marginBottom: '6px' }">Perspektive: User</div>
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '2px' }">
          <div
            v-for="(e, i) in redErrors"
            :key="i"
            :style="{ fontSize: '7.7px', color: C.muted, paddingLeft: '7px', position: 'relative' }"
          >
            <span :style="{ position: 'absolute', left: 0, color: C.red }">&rsaquo;</span>{{ e }}
          </div>
        </div>
      </div>
      <!-- USE errors -->
      <div :style="{ padding: '8px 10px', borderRadius: '6px', background: C.purpleDim, border: `1px solid ${C.purple}20` }">
        <div
          :style="{
            fontSize: '7.7px',
            fontWeight: 700,
            color: C.purple,
            marginBottom: '4px',
            fontFamily: `'JetBrains Mono', monospace`,
          }"
        >USE — Errors</div>
        <div :style="{ fontSize: '8.4px', color: C.text, lineHeight: 1.5, marginBottom: '6px' }">Perspektive: Maschine</div>
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '2px' }">
          <div
            v-for="(e, i) in useErrors"
            :key="i"
            :style="{ fontSize: '7.7px', color: C.muted, paddingLeft: '7px', position: 'relative' }"
          >
            <span :style="{ position: 'absolute', left: 0, color: C.purple }">&rsaquo;</span>{{ e }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
