<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

// Klick-Popup für die Bun-Bonus-Slides: Overlay über dem ganzen Slide-Canvas,
// Klick irgendwohin oder Escape schließt (wie in den HTML-Originalen).
// position:fixed wird durch den CSS-Transform des Slidev-Scalers zum
// Containing-Block "Slide-Canvas" — deckt also genau die Folie ab.
// `wide` für zweispaltige Inhalte (Modell-Routing-Quellen).
const props = defineProps<{ open: boolean; wide?: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

function onKey(ev: KeyboardEvent) {
  if (ev.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener("keydown", onKey);
    else window.removeEventListener("keydown", onKey);
  },
);

onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div v-if="open" class="bun-pop-overlay" @click="emit('close')">
    <div class="bun-pop-card" :class="{ 'bun-pop-wide': wide }">
      <slot />
      <div class="bun-pop-hint">Klick irgendwohin schließt</div>
    </div>
  </div>
</template>

<style>
.bun-pop-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.bun-pop-card {
  max-width: 500px;
  padding: 14px 16px;
  background: var(--color-background-tertiary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-lg, 12px);
}
.bun-pop-card.bun-pop-wide {
  max-width: 800px;
  max-height: 480px;
  overflow-y: auto;
}
.bun-pop-card .bun-pop-h {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.bun-pop-card .bun-pop-t {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.bun-pop-card .bun-pop-t + .bun-pop-t {
  margin-top: 8px;
}
.bun-pop-card .bun-pop-sep {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 0.5px solid var(--color-border-tertiary);
}
.bun-pop-card .bun-pop-meta {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.bun-pop-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
