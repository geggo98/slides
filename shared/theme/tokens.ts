/**
 * Single source of truth for the shared "semantic" design palette.
 *
 * These values mirror the CSS custom properties emitted by
 * shared/components/SlidevTokens.vue 1:1. SlidevTokens.vue keeps a static
 * <style> block (so the vars are bundled as CSS — no flash-of-unstyled-
 * content), and shared/theme/__tests__/tokens.test.ts asserts that the .vue
 * source and this module never drift apart. Edit values HERE; the test will
 * flag the .vue file if it falls out of sync.
 *
 * Consumed two ways:
 *   - As CSS vars: components/slides reference `var(--color-text-primary)` etc.
 *   - As JS values: components call usePalette() (shared/composables) to get
 *     this palette as a reactive object, instead of hand-rolling an
 *     `isDark.value ? dark : light` ternary block.
 *
 * NOTE: this is the *semantic* family (warm neutrals + info/success/warning/
 * danger). Several decks also hand-roll a "slate" family (#0a0d12 surfaces +
 * Tailwind-500 accents) and a "cool/carbon" family (#14141c, see
 * shared/quiz/lib/carbonTokens.ts). Those are intentionally NOT collapsed into
 * this set — preserving each deck's exact look. The Tailwind category accents
 * below are exported for charts/categorical fills that want a shared scale.
 */

export interface SemanticTokens {
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  backgroundInfo: string;
  backgroundSuccess: string;
  backgroundWarning: string;
  backgroundDanger: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInfo: string;
  textSuccess: string;
  textWarning: string;
  textDanger: string;
  borderTertiary: string;
  borderSecondary: string;
  borderPrimary: string;
  borderInfo: string;
  borderSuccess: string;
  borderWarning: string;
  borderDanger: string;
}

export const LIGHT: SemanticTokens = {
  backgroundPrimary: "#fff",
  backgroundSecondary: "#f5f5f3",
  backgroundTertiary: "#ececea",
  backgroundInfo: "#e6f1fb",
  backgroundSuccess: "#eaf3de",
  backgroundWarning: "#faeeda",
  backgroundDanger: "#fcebeb",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b6b6b",
  textTertiary: "#999",
  textInfo: "#0c447c",
  textSuccess: "#27500a",
  textWarning: "#633806",
  textDanger: "#791f1f",
  borderTertiary: "rgba(0, 0, 0, 0.12)",
  borderSecondary: "rgba(0, 0, 0, 0.2)",
  borderPrimary: "rgba(0, 0, 0, 0.35)",
  borderInfo: "#85b7eb",
  borderSuccess: "#97c459",
  borderWarning: "#ef9f27",
  borderDanger: "#f09595",
};

export const DARK: SemanticTokens = {
  backgroundPrimary: "#1e1e1e",
  backgroundSecondary: "#2a2a2a",
  backgroundTertiary: "#333",
  backgroundInfo: "#042c53",
  backgroundSuccess: "#173404",
  backgroundWarning: "#412402",
  backgroundDanger: "#501313",
  textPrimary: "#e5e5e5",
  textSecondary: "#aaa",
  textTertiary: "#777",
  textInfo: "#85b7eb",
  textSuccess: "#97c459",
  textWarning: "#ef9f27",
  textDanger: "#f09595",
  borderTertiary: "rgba(255, 255, 255, 0.1)",
  borderSecondary: "rgba(255, 255, 255, 0.18)",
  borderPrimary: "rgba(255, 255, 255, 0.3)",
  borderInfo: "#185fa5",
  borderSuccess: "#3b6d11",
  borderWarning: "#854f0b",
  borderDanger: "#a32d2d",
};

/** Radii — theme-independent. */
export const RADII = {
  "--sk-rad": "6px",
  "--sk-radm": "8px",
  "--border-radius-md": "8px",
  "--border-radius-lg": "12px",
} as const;

/**
 * Fonts — theme-independent. Defined globally (lifted from the old
 * GradleVars) so inline `var(--font-mono)` renders monospace in every deck;
 * previously only the gradle deck defined it, so open-rewrite / design-pattern
 * inline code silently fell back to the sans body font.
 */
export const FONTS = {
  "--font-mono": 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
} as const;

/**
 * Maps each SemanticTokens key to its CSS custom-property name. The drift
 * guard in tokens.test.ts uses this to compare against SlidevTokens.vue.
 */
export const CSS_VAR_NAME: Record<keyof SemanticTokens, string> = {
  backgroundPrimary: "--color-background-primary",
  backgroundSecondary: "--color-background-secondary",
  backgroundTertiary: "--color-background-tertiary",
  backgroundInfo: "--color-background-info",
  backgroundSuccess: "--color-background-success",
  backgroundWarning: "--color-background-warning",
  backgroundDanger: "--color-background-danger",
  textPrimary: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  textTertiary: "--color-text-tertiary",
  textInfo: "--color-text-info",
  textSuccess: "--color-text-success",
  textWarning: "--color-text-warning",
  textDanger: "--color-text-danger",
  borderTertiary: "--color-border-tertiary",
  borderSecondary: "--color-border-secondary",
  borderPrimary: "--color-border-primary",
  borderInfo: "--color-border-info",
  borderSuccess: "--color-border-success",
  borderWarning: "--color-border-warning",
  borderDanger: "--color-border-danger",
};

/** Builds the `--color-*` map for a theme (used by the drift guard). */
export function semanticCssVars(
  theme: "light" | "dark",
): Record<string, string> {
  const t = theme === "dark" ? DARK : LIGHT;
  const out: Record<string, string> = {};
  for (const key of Object.keys(CSS_VAR_NAME) as (keyof SemanticTokens)[]) {
    out[CSS_VAR_NAME[key]] = t[key];
  }
  return out;
}

/**
 * Tailwind-500/600 categorical accents (light = 600, dark = 500). Exported for
 * charts and categorical fills that want a single shared scale. Decks that
 * deviate keep their own values via usePalette overrides.
 */
export interface AccentTokens {
  red: string;
  orange: string;
  yellow: string;
  green: string;
  cyan: string;
  blue: string;
  purple: string;
}

export const ACCENTS_LIGHT: AccentTokens = {
  red: "#dc2626",
  orange: "#ea580c",
  yellow: "#ca8a04",
  green: "#16a34a",
  cyan: "#0891b2",
  blue: "#2563eb",
  purple: "#9333ea",
};

export const ACCENTS_DARK: AccentTokens = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  purple: "#a855f7",
};
