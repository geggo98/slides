<script setup>
import { computed } from 'vue'
import { useDarkMode } from '@slidev/client'

const props = defineProps({
  color: String,
  colorDim: String,
  title: String,
  tag: String,
  signals: Array,
  description: String,
})

const { isDark } = useDarkMode()

const C = computed(() => isDark.value ? {
  surface: '#111621',
  border: '#1e2536',
  text: '#e2e8f0',
  muted: '#64748b',
} : {
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
})
</script>

<template>
  <div
    :style="{
      background: C.surface,
      border: `1px solid ${color}25`,
      borderRadius: '7px',
      overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }"
  >
    <div :style="{ padding: '10px 13px', borderBottom: `1px solid ${C.border}` }">
      <div :style="{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }">
        <span
          :style="{
            fontSize: '7px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '3px',
            background: colorDim,
            color: color,
            border: `1px solid ${color}30`,
            fontFamily: `'JetBrains Mono', monospace`,
            letterSpacing: '0.7px',
          }"
        >{{ tag }}</span>
        <span :style="{ fontSize: '10.5px', fontWeight: 800, color: C.text }">{{ title }}</span>
      </div>
      <div :style="{ fontSize: '8.4px', color: C.muted, lineHeight: 1.5 }">{{ description }}</div>
    </div>
    <div :style="{ padding: '10px 13px' }">
      <div :style="{ display: 'flex', flexDirection: 'column', gap: '7px' }">
        <div v-for="(s, i) in signals" :key="i">
          <div :style="{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }">
            <span
              :style="{
                width: '13px',
                height: '13px',
                borderRadius: '3px',
                background: s.color || colorDim,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '7px',
                fontWeight: 800,
                color: s.accent || color,
                border: `1px solid ${(s.accent || color)}30`,
              }"
            >{{ s.letter }}</span>
            <span :style="{ fontSize: '9px', fontWeight: 700, color: C.text }">{{ s.name }}</span>
          </div>
          <div :style="{ fontSize: '8.4px', color: C.muted, lineHeight: 1.5, paddingLeft: '17px' }">
            {{ s.desc }}
          </div>
          <div
            v-if="s.detail"
            :style="{
              fontSize: '7.7px',
              color: s.accent || color,
              lineHeight: 1.5,
              paddingLeft: '17px',
              marginTop: '2px',
              fontWeight: 500,
            }"
          >
            {{ s.detail }}
          </div>
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>
