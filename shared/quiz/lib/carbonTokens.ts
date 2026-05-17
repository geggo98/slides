/**
 * Carbon-inspired status tokens for the five feedback states + neutral
 * surface colors. Mapped to CSS custom properties at component scope so a
 * single `style="--qz-success: …"` block flips both light and dark.
 */

export interface StatusPalette {
  success: string;
  successBg: string;
  info: string;
  infoBg: string;
  error: string;
  errorBg: string;
  warning: string;
  warningBg: string;
  tradeoff: string;
  tradeoffBg: string;
}

export interface SurfacePalette {
  bg: string;
  panelBg: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  focus: string;
}

export interface QuizPalette extends StatusPalette, SurfacePalette {}

// Success uses IBM blue (not green) so deuteranopia/protanopia don't collapse
// success/error onto the same red-green axis. Blue + red are distinguishable
// in all three CVD types (blue-yellow axis preserved under deutero/protan,
// red-green axis preserved under tritan) and have clear L* separation.
// Pairwise CVD ΔE and WCAG contrast are gated by carbonTokens.test.ts.
export function makePalette(isDark: boolean): QuizPalette {
  if (isDark) {
    return {
      bg: "#14141c",
      panelBg: "#1a1a24",
      border: "#2a2a35",
      text: "#e0e0e6",
      textMuted: "rgba(224,224,230,0.65)",
      accent: "#fb923c",
      accentBg: "rgba(251,146,60,0.14)",
      focus: "#fb923c",
      success: "#4589ff",
      successBg: "rgba(69,137,255,0.18)",
      info: "#4589ff",
      infoBg: "rgba(69,137,255,0.16)",
      error: "#ff8389",
      errorBg: "rgba(255,131,137,0.16)",
      warning: "#f1c21b",
      warningBg: "rgba(241,194,27,0.18)",
      tradeoff: "#8a3ffc",
      tradeoffBg: "rgba(138,63,252,0.18)",
    };
  }
  return {
    bg: "#ffffff",
    panelBg: "#f4f4f5",
    border: "#d0d0d6",
    text: "#262626",
    textMuted: "rgba(38,38,38,0.65)",
    accent: "#ea580c",
    accentBg: "rgba(234,88,12,0.10)",
    focus: "#ea580c",
    success: "#0f62fe",
    successBg: "rgba(15,98,254,0.10)",
    info: "#0f62fe",
    infoBg: "rgba(15,98,254,0.10)",
    error: "#a2191f",
    errorBg: "rgba(162,25,31,0.10)",
    warning: "#b28600",
    warningBg: "rgba(241,194,27,0.18)",
    tradeoff: "#6929c4",
    tradeoffBg: "rgba(105,41,196,0.10)",
  };
}

export function paletteToCssVars(p: QuizPalette): Record<string, string> {
  return {
    "--qz-bg": p.bg,
    "--qz-panel-bg": p.panelBg,
    "--qz-border": p.border,
    "--qz-text": p.text,
    "--qz-text-muted": p.textMuted,
    "--qz-accent": p.accent,
    "--qz-accent-bg": p.accentBg,
    "--qz-focus": p.focus,
    "--qz-success": p.success,
    "--qz-success-bg": p.successBg,
    "--qz-info": p.info,
    "--qz-info-bg": p.infoBg,
    "--qz-error": p.error,
    "--qz-error-bg": p.errorBg,
    "--qz-warning": p.warning,
    "--qz-warning-bg": p.warningBg,
    "--qz-tradeoff": p.tradeoff,
    "--qz-tradeoff-bg": p.tradeoffBg,
  };
}
