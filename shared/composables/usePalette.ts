/**
 * usePalette — the shared replacement for the hand-rolled
 *
 *   const { isDark } = useDarkMode()
 *   const P = computed(() => { const d = isDark.value; return { … } })
 *
 * block duplicated across ~57 components. Returns the canonical semantic
 * palette (shared/theme/tokens.ts) as a reactive object keyed off Slidev's
 * dark mode, so the light/dark pairs live in exactly one place.
 *
 * Colours are preserved, not unified: where a component deliberately deviates
 * from a token (e.g. a 2-digit-off text colour, or a cooler surface), pass the
 * exact values via `overrides` so the migration is a guaranteed visual no-op:
 *
 *   const P = usePalette({
 *     light: { cardColor: "#1a1a18" },   // kept verbatim, differs from token
 *     dark:  { cardColor: "#e5e5e5" },
 *   })
 *
 * Set `accents: true` to also merge the Tailwind categorical scale
 * (red/orange/yellow/green/cyan/blue/purple).
 */
import { computed, type ComputedRef } from "vue";
import { useDarkMode } from "@slidev/client";
import {
  LIGHT,
  DARK,
  ACCENTS_LIGHT,
  ACCENTS_DARK,
  type SemanticTokens,
  type AccentTokens,
} from "../theme/tokens";

export interface PaletteOptions<E extends Record<string, string>> {
  /** Extra/override values applied in light mode. */
  light?: Partial<SemanticTokens> & E;
  /** Extra/override values applied in dark mode. */
  dark?: Partial<SemanticTokens> & E;
  /** Merge the Tailwind categorical accent scale into the result. */
  accents?: boolean;
}

export function usePalette<
  E extends Record<string, string> = Record<never, string>,
>(
  options: PaletteOptions<E> = {},
): ComputedRef<SemanticTokens & Partial<AccentTokens> & E> {
  const { isDark } = useDarkMode();
  return computed(() => {
    const base = isDark.value ? DARK : LIGHT;
    const accents = options.accents
      ? isDark.value
        ? ACCENTS_DARK
        : ACCENTS_LIGHT
      : undefined;
    const override = (isDark.value ? options.dark : options.light) ?? {};
    return {
      ...base,
      ...(accents ?? {}),
      ...override,
    } as SemanticTokens & Partial<AccentTokens> & E;
  });
}
