<script setup lang="ts">
// Deko-Stempel: markiert jede Inhaltsfolie als unverbindlichen Vorschlag —
// kein offizielles BiPRO-Dokument. Slidev lädt global-top.vue automatisch aus
// dem Deck-Root und rendert es ÜBER dem Folien-Content (Z-Order 2); global-
// bottom läge hinter dem opaken Theme-Hintergrund und wäre unsichtbar.
//
// pointer-events:none ist Pflicht — sonst würde der über der Folie liegende
// Layer Klicks auf die interaktive ComponentMap abfangen.
//
// Sichtbar nur auf Inhaltsfolien: nicht auf der Titelfolie (Seite 1), nicht
// auf Sektionstrennern (layout: section) und nicht auf der Ende-Folie
// (layout: end). $nav ist im globalen Slidev-Kontext verfügbar.
</script>

<template>
  <div
    v-if="
      $nav.currentPage > 1 && !['section', 'end'].includes($nav.currentLayout)
    "
    class="proposal-stamp"
    aria-hidden="true"
  >
    <span class="line1">VORSCHLAG</span>
    <span class="line2">kein offizielles Dokument</span>
  </div>
</template>

<style scoped>
.proposal-stamp {
  position: absolute;
  right: 18px;
  bottom: 16px;
  z-index: 5;
  pointer-events: none;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 11px 5px;
  border: 2px solid var(--color-border-danger, #a32d2d);
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-danger, #a32d2d);
  transform: rotate(-8deg);
  opacity: 0.42;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.line1 {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  line-height: 1;
}
.line2 {
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.1;
}
</style>
