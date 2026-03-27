<script setup>
// Scene: Overview / Gesamtbild
const legend = [
  { color: 'var(--color-text-tertiary)', text: 'Transitive Deps liefern angeforderte Versionen' },
  { color: 'var(--color-text-tertiary)', text: 'Gradle wählt die höchste (highest wins)' },
  { color: 'var(--color-text-info)', text: 'Catalog / direkte Version setzen einen Request' },
  { color: 'var(--color-text-warning)', text: 'BOM / Spring-Plugin überschreibt den Request' },
  { color: 'var(--color-text-danger)', text: 'force() / strictly() übersteuert alles' },
]
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      <strong>Gesamtbild:</strong>
      Resolution als Trichter. Oben kommen alle Versionsanforderungen rein. Unten kommt genau eine Version raus. Je höher die Priorität, desto später greift sie.
    </div>

    <div class="legend">
      <div v-for="l in legend" :key="l.text" class="legend-row">
        <div class="legend-dot" :style="{ background: l.color }" />
        <span>{{ l.text }}</span>
      </div>
    </div>

    <ResultBox label="Praxis-Checkliste">
      <div class="checklist">
        <code>./gradlew dependencies --configuration compileClasspath</code> zeigt Konflikte<br>
        <code>./gradlew dependencies --write-locks</code> fixiert das Ergebnis<br>
        <code>git diff gradle.lockfile</code> macht Änderungen sichtbar<br>
        <code>failOnVersionConflict()</code> erzwingt bewusste Auflösung
      </div>
    </ResultBox>
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 10px; }
.scene-desc strong { color: var(--color-text-primary); font-weight: 500; }
.legend { background: var(--color-background-secondary); border-radius: var(--border-radius-lg); padding: 0.75rem 1rem; margin: 0 0 10px; display: flex; flex-direction: column; gap: 4px; }
.legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-secondary); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.checklist { font-size: 12px; color: var(--color-text-secondary); line-height: 1.7; }
.checklist code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 4px; border-radius: 4px; }
</style>
