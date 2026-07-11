/**
 * useScopeColors — adaptive Oszilloskop-Palette für die zwei Queue-Simulatoren.
 *
 * Die React-Originale waren fest dunkel (Neon-auf-Schwarz). Hier gemappt auf
 * hell/dunkel im Deck-Stil: Dark = Quellwerte verbatim, Light neu hergeleitet
 * (Neon ist auf Weiß unsichtbar → 600er-Töne). Das Canvas-`drawScope` liest
 * `C.value` pro Frame, daher wirkt ein Theme-Wechsel sofort.
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

export interface ScopeColors {
  bg: string;
  panel: string;
  panelHi: string;
  border: string;
  phosphor: string;
  phosphorD: string;
  theory: string;
  amber: string;
  red: string;
  textHi: string;
  textMid: string;
  textLow: string;
  grid: string;
  gridStrong: string;
  // MMc-Aliase: Pool (rechts) = phosphor, Alternative (links) = amber.
  pool: string;
  alt: string;
}

export function useScopeColors() {
  const { isDark } = useDarkMode();
  return computed<ScopeColors>(() => {
    const d = isDark.value;
    return {
      bg: d ? "#0a0e0c" : "#f3f7f4",
      panel: d ? "#0f1714" : "#ffffff",
      panelHi: d ? "#15211c" : "#eef3f0",
      border: d ? "#23362e" : "#cdd9d2",
      phosphor: d ? "#39ff8a" : "#16a34a",
      phosphorD: d ? "#1f7a47" : "#86c79f",
      theory: d ? "#5cc8ff" : "#0891b2",
      amber: d ? "#ffb454" : "#d97706",
      red: d ? "#ff5c5c" : "#dc2626",
      textHi: d ? "#e8f5ee" : "#0f1a14",
      textMid: d ? "#9fb3aa" : "#4b5b53",
      textLow: d ? "#5f7269" : "#8a978f",
      grid: d ? "rgba(57,255,138,0.10)" : "rgba(22,163,74,0.12)",
      gridStrong: d ? "rgba(255,255,255,0.18)" : "rgba(15,26,20,0.15)",
      pool: d ? "#39ff8a" : "#16a34a",
      alt: d ? "#ffb454" : "#d97706",
    };
  });
}
