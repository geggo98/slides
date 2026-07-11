/**
 * useInfoPopover — Zustand für die (i)-Erklär-Popovers, geteilt von beiden Sims.
 * Genau ein Popover offen (per id); Klick außerhalb eines `[data-info]`-Elements
 * schließt. Listener wird in onMounted registriert und in onUnmounted entfernt.
 */
import { ref, onMounted, onUnmounted } from "vue";

export function useInfoPopover() {
  const info = ref<string | null>(null);

  function toggle(id: string) {
    info.value = info.value === id ? null : id;
  }

  function onDocClick(e: MouseEvent) {
    const t = e.target as Element | null;
    // SVG-/Text-Targets haben kein closest → Guard behalten.
    if (!(t && t.closest && t.closest("[data-info]"))) info.value = null;
  }

  onMounted(() => document.addEventListener("click", onDocClick));
  onUnmounted(() => document.removeEventListener("click", onDocClick));

  return { info, toggle };
}
