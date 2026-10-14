/**
 * grafanaPalette — die Grafana-artige Palette des Decks.
 *
 * Quelle für den Visualisierungs-Katalog (`VizGuide.vue`) und die beiden
 * Queue-Simulatoren (`MM1Simulator.vue`, `MMcCompare.vue`), damit Simulatoren
 * und Katalog wie dasselbe Dashboard aussehen. `useGrafanaPalette()` liefert
 * zusätzlich die semantischen Rollen der Simulatoren (Panel, Theorie,
 * Serienfarben); das Canvas-Zeichnen liest `C.value` pro Frame, ein
 * Theme-Wechsel wirkt daher sofort.
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

export const DARK_PALETTE = {
  bg: "#0b0e14",
  surface: "#131720",
  surfaceHover: "#1a1f2e",
  border: "#1e2536",
  text: "#e2e8f0",
  // #64748b erreichte auf dunkler Surface nur ~4:1 — heller abgestuft.
  textMuted: "#94a3b8",
  textDim: "#475569",
  accent: "#3b82f6",
  accentGlow: "rgba(59,130,246,0.15)",
  green: "#22c55e",
  greenDim: "rgba(34,197,94,0.15)",
  yellow: "#eab308",
  yellowDim: "rgba(234,179,8,0.15)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.15)",
  orange: "#f97316",
  orangeDim: "rgba(249,115,22,0.15)",
  purple: "#a855f7",
  purpleDim: "rgba(168,85,247,0.15)",
  cyan: "#06b6d4",
  cyanDim: "rgba(6,182,212,0.15)",
};

export const LIGHT_PALETTE: typeof DARK_PALETTE = {
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  accent: "#2563eb",
  accentGlow: "rgba(37,99,235,0.12)",
  green: "#16a34a",
  greenDim: "rgba(22,163,74,0.10)",
  yellow: "#ca8a04",
  yellowDim: "rgba(202,138,4,0.10)",
  red: "#dc2626",
  redDim: "rgba(220,38,38,0.10)",
  orange: "#ea580c",
  orangeDim: "rgba(234,88,12,0.10)",
  purple: "#9333ea",
  purpleDim: "rgba(147,51,234,0.10)",
  cyan: "#0891b2",
  cyanDim: "rgba(8,145,178,0.10)",
};

export type GrafanaPalette = typeof DARK_PALETTE;

/** Rollen der Simulatoren — Namen nach Funktion, Werte aus der Palette. */
export interface SimColors {
  bg: string;
  panel: string;
  panelHi: string;
  border: string;
  textHi: string;
  textMid: string;
  textLow: string;
  grid: string;
  gridStrong: string;
  /** UI-Akzent (aktiver Knopf, Slider). */
  accent: string;
  /** Theorie-/Sollwert: gestrichelte Linien, Gauge-Marke. */
  theory: string;
  /** Grafana-Thresholds. */
  ok: string;
  warn: string;
  crit: string;
  /** M/M/c: Alternative (links) und Pool (rechts). */
  alt: string;
  pool: string;
  /** Serienfarbe je Metrik-Schlüssel (siehe `lib/metrics.ts`). */
  series: Record<string, string>;
}

export function simColors(p: GrafanaPalette, dark: boolean): SimColors {
  return {
    bg: p.bg,
    panel: p.surface,
    panelHi: p.surfaceHover,
    border: p.border,
    textHi: p.text,
    textMid: p.textMuted,
    // textDim ist im Dunkeln zu kontrastarm für Achsenbeschriftung.
    textLow: dark ? "#64748b" : "#94a3b8",
    grid: dark ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.14)",
    gridStrong: dark ? "rgba(226,232,240,0.30)" : "rgba(30,41,59,0.30)",
    accent: p.accent,
    theory: p.cyan,
    ok: p.green,
    warn: p.yellow,
    crit: p.red,
    alt: p.orange,
    pool: p.green,
    series: {
      rho: p.orange,
      queue: dark ? "#f472b6" : "#db2777",
      thr: p.green,
      wq: p.accent,
      t: p.purple,
      pw: p.yellow,
    },
  };
}

export function useGrafanaPalette() {
  const { isDark } = useDarkMode();
  return computed<SimColors>(() =>
    simColors(isDark.value ? DARK_PALETTE : LIGHT_PALETTE, isDark.value),
  );
}
