// Deck-lokale Light/Dark-Palette für Tabellen, Badges und Stat-Cards —
// dedupliziert die zuvor hand-gerollten isDark-Paletten von HarnessTable,
// McpOptTable, LeakStatsGrid und ToolSearchImpact. Das shared
// usePalette.ts greift hier bewusst nicht: dieses Deck nutzt eine eigene,
// kühlere Flächenpalette (#14141c statt der Token-Surfaces).
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

export function useDeckPalette() {
  const { isDark } = useDarkMode();
  return computed(() => {
    const d = isDark.value;
    return {
      // Tabellen-Flächen
      bg: d ? "#14141c" : "#ffffff",
      headerBg: d ? "#1a1a24" : "#f4f4f5",
      border: d ? "#2a2a35" : "#e4e4e7",
      text: d ? "#c8c8d0" : "#3f3f46",
      hoverBg: d ? "#181820" : "#f9fafb",
      // Akzente (Light-Mode dunkler für Kontrast auf Weiß)
      accentViolet: d ? "#a78bfa" : "#7c3aed",
      accentGreen: d ? "#4ade80" : "#16a34a",
      // Badges
      badgeGreenBg: d ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.1)",
      badgeGreenText: d ? "#86efac" : "#16a34a",
      badgeYellowBg: d ? "rgba(250,204,21,0.15)" : "rgba(202,138,4,0.1)",
      badgeYellowText: d ? "#fde047" : "#ca8a04",
      badgeRedBg: d ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.1)",
      badgeRedText: d ? "#fca5a5" : "#dc2626",
      badgeGrayBg: d ? "rgba(140,140,160,0.15)" : "rgba(113,113,122,0.1)",
      badgeGrayText: d ? "#8a8a9a" : "#71717a",
      // Stat-Cards
      cardBg: d
        ? "linear-gradient(135deg, #14141c, #1a1a24)"
        : "linear-gradient(135deg, #ffffff, #f9fafb)",
      cardBorder: d ? "#2a2a35" : "#e4e4e7",
      labelColor: d ? "#8a8a9a" : "#71717a",
      descColor: d ? "#b4b4c0" : "#52525b",
    };
  });
}
