<script setup>
import { computed } from 'vue'
import { useDarkMode } from '@slidev/client'
import MethodBox from './MethodBox.vue'

const { isDark } = useDarkMode()

const C = computed(() => isDark.value ? {
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.10)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.10)',
  yellow: '#eab308',
  yellowDim: 'rgba(234,179,8,0.10)',
  blue: '#3b82f6',
  blueDim: 'rgba(59,130,246,0.12)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.10)',
} : {
  red: '#dc2626',
  redDim: 'rgba(220,38,38,0.08)',
  purple: '#9333ea',
  purpleDim: 'rgba(147,51,234,0.08)',
  yellow: '#ca8a04',
  yellowDim: 'rgba(202,138,4,0.08)',
  blue: '#2563eb',
  blueDim: 'rgba(37,99,235,0.08)',
  orange: '#ea580c',
  orangeDim: 'rgba(234,88,12,0.08)',
})

const methods = computed(() => [
  {
    color: C.value.red,
    colorDim: C.value.redDim,
    title: 'RED-Methode',
    tag: 'SERVICE',
    description: 'Für jeden Microservice. Misst, was der User erlebt.',
    signals: [
      { letter: 'R', name: 'Rate', desc: 'Requests pro Sekunde', accent: C.value.blue, color: C.value.blueDim },
      { letter: 'E', name: 'Errors', desc: 'Fehlgeschlagene Requests/s — User-Sicht', accent: C.value.red, color: C.value.redDim },
      { letter: 'D', name: 'Duration', desc: 'Latenz-Verteilung (p50, p95, p99)', accent: C.value.orange, color: C.value.orangeDim },
    ],
  },
  {
    color: C.value.purple,
    colorDim: C.value.purpleDim,
    title: 'USE-Methode',
    tag: 'RESOURCE',
    description: 'Für jede Ressource (CPU, Memory, Disk, Pools).',
    signals: [
      { letter: 'U', name: 'Utilization', desc: '% der genutzten Kapazität', accent: C.value.orange, color: C.value.orangeDim },
      { letter: 'S', name: 'Saturation', desc: 'Warteschlange / Backlog', accent: C.value.yellow, color: C.value.yellowDim },
      { letter: 'E', name: 'Errors', desc: 'Infrastruktur-Fehler (ECC, Packet Drops)', accent: C.value.red, color: C.value.redDim },
    ],
  },
  {
    color: C.value.yellow,
    colorDim: C.value.yellowDim,
    title: '4 Golden Signals',
    tag: 'HYBRID',
    description: 'Google SRE Book. RED + Saturation für kritische Pfade.',
    signals: [
      { letter: 'L', name: 'Latency', desc: '= RED Duration', accent: C.value.orange, color: C.value.orangeDim },
      { letter: 'T', name: 'Traffic', desc: '= RED Rate', accent: C.value.blue, color: C.value.blueDim },
      { letter: 'E', name: 'Errors', desc: '= RED Errors', accent: C.value.red, color: C.value.redDim },
      { letter: 'S', name: 'Saturation', desc: 'Das Extra gegenüber RED', accent: C.value.purple, color: C.value.purpleDim },
    ],
  },
])
</script>

<template>
  <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }">
    <div v-for="(m, i) in methods" :key="i">
      <MethodBox v-bind="m" :style="{ height: '100%' }" />
    </div>
  </div>
</template>
