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
      success: "#42be65",
      successBg: "rgba(66,190,101,0.18)",
      info: "#4589ff",
      infoBg: "rgba(69,137,255,0.16)",
      error: "#fa4d56",
      errorBg: "rgba(250,77,86,0.16)",
      warning: "#f1c21b",
      warningBg: "rgba(241,194,27,0.18)",
      tradeoff: "#a56eff",
      tradeoffBg: "rgba(165,110,255,0.18)",
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
    success: "#198038",
    successBg: "rgba(25,128,56,0.12)",
    info: "#0f62fe",
    infoBg: "rgba(15,98,254,0.10)",
    error: "#da1e28",
    errorBg: "rgba(218,30,40,0.10)",
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
