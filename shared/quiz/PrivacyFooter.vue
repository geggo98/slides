<script setup lang="ts">
/**
 * Compact privacy notice with a "Daten löschen" link. The link triggers a
 * confirm-dialog and emits `clear-all` so the parent owns the state wipe.
 */

defineProps<{ compact?: boolean }>();
const emit = defineEmits<{ (e: "clear-all"): void }>();

function onClearAll(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
  if (
    typeof window !== "undefined" &&
    window.confirm(
      "Wirklich alle Quiz-Daten in diesem Browser löschen (Verlauf, Statistik)?",
    )
  ) {
    emit("clear-all");
  }
}
</script>

<template>
  <p class="privacy-footer" :class="{ compact }">
    <span>
      Alle Antworten und Verläufe bleiben in deinem Browser; nichts wird
      übertragen.
    </span>
    <a
      href="#"
      class="privacy-link"
      title="Setzt Verlauf, Statistik und gespeicherten Lauf-Status zurück."
      @click="onClearAll"
      @keydown.space.stop
      @keydown.enter.stop
    >
      Alle Daten löschen
    </a>
  </p>
</template>

<style scoped>
.privacy-footer {
  margin: 0;
  font-size: 10px;
  color: var(--qz-text-muted);
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}
.privacy-footer.compact {
  font-size: 9.5px;
}
.privacy-link {
  color: var(--qz-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.privacy-link:hover {
  color: var(--qz-accent);
  filter: brightness(1.1);
}
.privacy-link:focus-visible {
  outline: 2px solid var(--qz-focus);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
