<script setup>
import { ref } from 'vue'

const activeLayer = ref(-1)

const layers = [
  { num: 1, pill: 'pill-blue', title: 'Version catalog', sub: 'Zentrale Deklaration aller Koordinaten und Versionen', file: 'gradle/libs.versions.toml',
    detail: 'Version catalog deklariert Koordinaten und Versionen in einer TOML-Datei. Erzeugt typsichere Accessors (libs.jackson.databind). Hat keinen Einfluss auf Resolution — rein deklarativ. Wenn die BOM eine andere Version vorgibt, gewinnt die BOM stillschweigend.' },
  { num: 2, pill: 'pill-blue', title: 'Build script', sub: 'Deps deklarieren via Catalog-Accessors oder direkt', file: 'build.gradle.kts',
    detail: 'Build script referenziert Deps via implementation(libs.xyz) oder direkt per String. Hier werden auch force() und ext["..."]-Overrides gesetzt. Achtung: Doppelte Wahrheitsquellen (Catalog + ext-Properties) vermeiden.' },
  { num: 3, pill: 'pill-green', title: 'BOM / Platform', sub: 'Spring Boot BOM pinnt ~300 transitive Versionen', file: 'spring-boot-dependencies POM',
    detail: 'Spring Boot BOM ist ein Resolution-Constraint: sie gibt feste Versionen vor, die Gradle bei der Auflösung anwendet. Der Catalog deklariert, die BOM entscheidet. Bei einem Spring-Boot-Versionsupgrade ändern sich potenziell Dutzende transitive Versionen.' },
  { num: 4, pill: 'pill-green', title: 'Lock-file', sub: 'Fixiert den aufgelösten Baum, Input für Scanner', file: 'gradle.lockfile',
    detail: 'Lock-file fixiert das Ergebnis der Resolution (inkl. aller transitiven Deps). Dependency-Scanner lesen es als Single Source of Truth. Muss bei jeder Dep-Änderung mit --write-locks neu generiert und committet werden.' },
  { num: 5, pill: 'pill-amber', title: 'Verification metadata', sub: 'SHA-256 + PGP pro Artefakt', file: 'gradle/verification-metadata.xml',
    detail: 'Verification metadata speichert SHA-256-Checksums und PGP-Key-IDs für jedes Artefakt. Schützt gegen Re-Upload der gleichen Version mit verändertem Inhalt. Erzeugen mit --write-verification-metadata sha256,pgp.' },
  { num: 6, pill: 'pill-red', title: 'Repository filtering', sub: 'Schutz gegen dependency confusion', file: 'build.gradle.kts (repositories { })',
    detail: 'Repository content filtering schränkt ein, welche Gruppen von welchem Repository aufgelöst werden dürfen. Verhindert, dass interne Paketnamen von Maven Central gezogen werden (Dependency Confusion Attack).' },
]

function toggleLayer(i) {
  activeLayer.value = activeLayer.value === i ? -1 : i
}
</script>

<template>
  <GradleVars>
    <div class="layer-stack-wrap">
      <p class="section-label">Gradle dependency stack</p>
      <p class="section-hint">Klick auf eine Schicht für Details. Oben Deklaration, unten Schutz.</p>

      <div class="layer-stack">
        <div
          v-for="(l, i) in layers" :key="i"
          class="layer" :class="{ active: activeLayer === i }"
          @click.stop="toggleLayer(i)"
        >
          <div class="layer-icon"><span class="pill" :class="l.pill">{{ l.num }}</span></div>
          <div class="layer-content">
            <div class="layer-title">{{ l.title }}</div>
            <div class="layer-sub">{{ l.sub }}</div>
            <div class="layer-file">{{ l.file }}</div>
          </div>
        </div>
      </div>

      <Transition name="fade">
        <div v-if="activeLayer >= 0" class="detail-panel">
          <strong>{{ layers[activeLayer].title }}:</strong> {{ layers[activeLayer].detail }}
        </div>
      </Transition>
    </div>
  </GradleVars>
</template>

<style scoped>
.layer-stack-wrap { width: 100%; }
.section-label { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px; }
.section-hint { font-size: 12px; color: var(--color-text-tertiary); margin: 0 0 12px; }
.layer-stack { display: flex; flex-direction: column; gap: 0; }
.layer { display: flex; align-items: stretch; min-height: 38px; border: 0.5px solid var(--color-border-tertiary); cursor: pointer; transition: background 0.15s; }
.layer:first-child { border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0; }
.layer:last-child { border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg); }
.layer:not(:first-child) { border-top: none; }
.layer:hover { background: var(--color-background-secondary); }
.layer.active { background: var(--color-background-secondary); }
.layer-icon { width: 40px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; flex-shrink: 0; }
.layer-content { flex: 1; padding: 5px 10px 5px 0; display: flex; flex-direction: column; justify-content: center; }
.layer-title { font-size: 12px; font-weight: 500; color: var(--color-text-primary); }
.layer-sub { font-size: 10px; color: var(--color-text-secondary); margin-top: 1px; }
.layer-file { font-size: 9px; font-family: var(--font-mono); color: var(--color-text-tertiary); margin-top: 1px; }
.detail-panel { background: var(--color-background-secondary); border-radius: var(--border-radius-lg); padding: 0.5rem 0.75rem; margin-top: 6px; font-size: 11px; line-height: 1.4; color: var(--color-text-secondary); }
.detail-panel strong { color: var(--color-text-primary); font-weight: 500; }
.pill { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: var(--border-radius-md); font-weight: 500; }
.pill-blue { background: var(--color-background-info); color: var(--color-text-info); }
.pill-green { background: var(--color-background-success); color: var(--color-text-success); }
.pill-amber { background: var(--color-background-warning); color: var(--color-text-warning); }
.pill-red { background: var(--color-background-danger); color: var(--color-text-danger); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
