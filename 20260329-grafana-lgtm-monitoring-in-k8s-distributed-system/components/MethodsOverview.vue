<script setup>
import MethodBox from './MethodBox.vue'

const C = {
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
}

const methods = [
  {
    color: C.red,
    colorDim: C.redDim,
    title: 'RED-Methode',
    tag: 'SERVICE',
    description: 'Für jeden Microservice. Misst, was der User erlebt.',
    signals: [
      { letter: 'R', name: 'Rate', desc: 'Requests pro Sekunde', accent: C.blue, color: C.blueDim },
      { letter: 'E', name: 'Errors', desc: 'Fehlgeschlagene Requests/s — User-Sicht', accent: C.red, color: C.redDim },
      { letter: 'D', name: 'Duration', desc: 'Latenz-Verteilung (p50, p95, p99)', accent: C.orange, color: C.orangeDim },
    ],
  },
  {
    color: C.purple,
    colorDim: C.purpleDim,
    title: 'USE-Methode',
    tag: 'RESOURCE',
    description: 'Für jede Ressource (CPU, Memory, Disk, Pools).',
    signals: [
      { letter: 'U', name: 'Utilization', desc: '% der genutzten Kapazität', accent: C.orange, color: C.orangeDim },
      { letter: 'S', name: 'Saturation', desc: 'Warteschlange / Backlog', accent: C.yellow, color: C.yellowDim },
      { letter: 'E', name: 'Errors', desc: 'Infrastruktur-Fehler (ECC, Packet Drops)', accent: C.red, color: C.redDim },
    ],
  },
  {
    color: C.yellow,
    colorDim: C.yellowDim,
    title: '4 Golden Signals',
    tag: 'HYBRID',
    description: 'Google SRE Book. RED + Saturation für kritische Pfade.',
    signals: [
      { letter: 'L', name: 'Latency', desc: '= RED Duration', accent: C.orange, color: C.orangeDim },
      { letter: 'T', name: 'Traffic', desc: '= RED Rate', accent: C.blue, color: C.blueDim },
      { letter: 'E', name: 'Errors', desc: '= RED Errors', accent: C.red, color: C.redDim },
      { letter: 'S', name: 'Saturation', desc: 'Das Extra gegenüber RED', accent: C.purple, color: C.purpleDim },
    ],
  },
]
</script>

<template>
  <div :style="{ display: 'flex', gap: '8px', height: '100%' }">
    <div v-for="(m, i) in methods" :key="i" :style="{ flex: 1 }">
      <MethodBox v-bind="m" />
    </div>
  </div>
</template>
