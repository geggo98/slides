<script setup>
// Scene: Overview / Gesamtbild
const legend = [
  { color: 'var(--color-text-tertiary)', text: 'Transitive Deps liefern angeforderte Versionen' },
  { color: 'var(--color-text-tertiary)', text: 'Gradle wählt die höchste (highest wins)' },
  { color: 'var(--color-text-info)', text: 'Catalog / direkte Version setzen einen Request' },
  { color: 'var(--color-text-warning)', text: 'BOM / Spring-Plugin überschreibt den Request' },
  { color: 'var(--color-text-danger)', text: 'force() / strictly() übersteuert alles' },
]

const prioRows = [
  { rank: 9, name: 'strictly() — übersteuert alles, Fehler bei Konflikt' },
  { rank: 8, name: 'force() — übersteuert alles, still' },
  { rank: 7, name: 'enforcedPlatform() — erzwungene BOM' },
  { rank: 6, name: 'Spring dependency-management plugin' },
  { rank: 5, name: 'platform() (BOM als Constraints)' },
  { rank: 4, name: 'Dependency constraints { }' },
  { rank: 3, name: 'Direkte Version / Catalog (Textersatz)' },
  { rank: 2, name: 'Highest version wins (Default-Strategie)' },
  { rank: 1, name: 'Transitive Version (niedrigste Prio)' },
]
</script>

<template>
  <div class="scene-wrap">
    <div class="scene-desc">
      <strong>Gesamtbild:</strong>
      Resolution als Trichter. Oben kommen alle Versionsanforderungen rein. Unten kommt genau eine Version raus. Je höher die Priorität, desto später greift sie — und übersteuert alles darunter.
    </div>

    <div class="legend">
      <div v-for="l in legend" :key="l.text" class="legend-row">
        <div class="legend-dot" :style="{ background: l.color }" />
        <span>{{ l.text }}</span>
      </div>
    </div>

    <ResultBox label="Praxis-Checkliste">
      <div class="checklist">
        <code>./gradlew dependencies --configuration compileClasspath</code> zeigt Konflikte (<code>-&gt;</code>)<br>
        <code>./gradlew dependencies --write-locks</code> fixiert das Ergebnis<br>
        <code>git diff gradle.lockfile</code> macht Änderungen sichtbar<br>
        <code>failOnVersionConflict()</code> erzwingt bewusste Auflösung
      </div>
    </ResultBox>

    <div class="prio-bar">
      <div
        v-for="r in prioRows" :key="r.rank"
        class="prio-row" :class="{ active: r.rank >= 8 }"
      >
        <div class="prio-rank">{{ r.rank }}</div>
        <div class="prio-name">{{ r.name }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-wrap { width: 100%; }
.scene-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 12px; }
.scene-desc strong { color: var(--color-text-primary); font-weight: 500; }
.legend { background: var(--color-background-secondary); border-radius: var(--border-radius-lg); padding: 0.75rem 1rem; margin: 0 0 12px; display: flex; flex-direction: column; gap: 4px; }
.legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-secondary); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.checklist { font-size: 12px; color: var(--color-text-secondary); line-height: 1.7; }
.checklist code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 4px; border-radius: 4px; }
.prio-bar { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.prio-row { display: flex; align-items: center; gap: 8px; padding: 3px 10px; border-radius: var(--border-radius-md); font-size: 11px; transition: all 0.3s; }
.prio-row .prio-rank { font-weight: 500; min-width: 18px; color: var(--color-text-tertiary); }
.prio-row .prio-name { flex: 1; color: var(--color-text-secondary); }
.prio-row.active { background: var(--color-background-success); }
.prio-row.active .prio-name { color: var(--color-text-success); font-weight: 500; }
.prio-row.active .prio-rank { color: var(--color-text-success); }
</style>
