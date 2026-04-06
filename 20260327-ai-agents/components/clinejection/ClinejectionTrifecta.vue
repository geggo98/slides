<script setup>
import { computed } from 'vue'
import { useDarkMode } from '@slidev/client'
import { TRIFECTA } from './data'

const { isDark } = useDarkMode()

const P = computed(() => isDark.value ? {
  textPrimary: '#e5e5e5',
  textSecondary: '#aaa',
  textTertiary: '#666',
  textSuccess: '#5cc0a0',
  textWarning: '#e0a030',
  bgPrimary: '#1e1e1e',
  bgSecondary: '#2a2a2e',
  borderTertiary: 'rgba(255,255,255,0.12)',
  bgSuccess: 'rgba(92,192,160,0.12)',
  bgWarning: 'rgba(224,160,48,0.12)',
  borderSuccess: 'rgba(92,192,160,0.25)',
  borderWarning: 'rgba(224,160,48,0.25)',
  fontSans: "'DM Sans', sans-serif",
  fontMono: "'Fira Code', 'JetBrains Mono', monospace",
} : {
  textPrimary: '#1a1a18',
  textSecondary: '#555',
  textTertiary: '#888',
  textSuccess: '#308060',
  textWarning: '#a07020',
  bgPrimary: 'white',
  bgSecondary: '#f5f5f5',
  borderTertiary: 'rgba(0,0,0,0.1)',
  bgSuccess: 'rgba(48,128,96,0.08)',
  bgWarning: 'rgba(160,112,32,0.08)',
  borderSuccess: 'rgba(48,128,96,0.25)',
  borderWarning: 'rgba(160,112,32,0.25)',
  fontSans: "'DM Sans', sans-serif",
  fontMono: "'Fira Code', 'JetBrains Mono', monospace",
})

function cellBorder(t) {
  return t.extended ? P.value.borderWarning : P.value.borderTertiary
}
function cellBorderStyle(t) {
  return t.extended ? 'dashed' : 'solid'
}
function badgeColor(t) {
  return t.extended ? P.value.textWarning : P.value.textSuccess
}
function badgeBg(t) {
  return t.extended ? P.value.bgWarning : P.value.bgSuccess
}
function badgeBorder(t) {
  return t.extended ? P.value.borderWarning : P.value.borderSuccess
}
function badgeText(t) {
  return t.extended ? 'ERWEITERUNG' : 'ERF\u00dcLLT'
}
</script>

<template>
  <div class="trifecta-slide">
    <p class="intro">
      Simon Willison identifiziert drei F&auml;higkeiten, deren Kombination KI-Agenten verwundbar macht:
      <strong>Zugang zu privaten Daten</strong>, <strong>Kontakt mit nicht-vertrauensw&uuml;rdigen Inhalten</strong>
      und <strong>externe Kommunikation</strong>.
      Clinejection erf&uuml;llt alle drei &mdash; und offenbart ein viertes Element, das im Modell fehlt.
    </p>

    <div class="trifecta-grid">
      <div
        v-for="t in TRIFECTA"
        :key="t.label"
        class="trifecta-cell"
        :style="{
          borderColor: cellBorder(t),
          borderStyle: cellBorderStyle(t),
        }"
      >
        <div class="cell-header">
          <span class="cell-label" :style="{ color: t.extended ? P.textWarning : P.textPrimary }">
            {{ t.label }}
          </span>
          <span
            class="cell-badge"
            :style="{
              color: badgeColor(t),
              background: badgeBg(t),
              borderColor: badgeBorder(t),
            }"
          >
            {{ badgeText(t) }}
          </span>
        </div>
        <p class="cell-desc">{{ t.desc }}</p>
      </div>
    </div>

    <div class="sources">
      Quellen: Adnan Khan, Snyk, Cline Post-Mortem, StepSecurity, Socket.dev, Simon Willison
    </div>
  </div>
</template>

<style scoped>
.trifecta-slide {
  font-family: v-bind('P.fontSans');
  max-height: 430px; overflow-y: auto;
}
.intro {
  font-size: 11px; color: v-bind('P.textSecondary');
  line-height: 1.5; margin-bottom: 12px;
}
.intro strong { color: v-bind('P.textPrimary'); }
.trifecta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.trifecta-cell {
  border-width: 1px;
  border-radius: 8px;
  padding: 10px 12px;
  background: v-bind('P.bgPrimary');
}
.cell-header {
  display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 6px; gap: 6px;
}
.cell-label {
  font-size: 12px; font-weight: 700;
}
.cell-badge {
  font-size: 7px; font-weight: 600;
  letter-spacing: 1px;
  padding: 1px 6px; border-radius: 6px;
  border: 1px solid; flex-shrink: 0;
}
.cell-desc {
  font-size: 10px; color: v-bind('P.textSecondary');
  line-height: 1.5;
}
.sources {
  margin-top: 14px;
  font-size: 8px; color: v-bind('P.textTertiary');
  letter-spacing: 0.3px;
}
</style>
