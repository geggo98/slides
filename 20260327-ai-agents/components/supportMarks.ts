// Gemeinsamer Y/N/Partial-Span-Generator für die Support-Tabellen in
// ComparisonMatrix.vue und ProtocolCards.vue (vorher dort dupliziert).
// Liefert fertige HTML-Snippets (per v-html gerendert) mit theme-abhängiger
// Farbe: ✓ grün, ✗ rot, ◐ gelb/orange.
import { computed, type ComputedRef } from "vue";
import { useDarkMode } from "@slidev/client";

export interface SupportMarks {
  /** Grünes ✓ — voller Support. */
  Y: ComputedRef<string>;
  /** Rotes ✗ — kein Support. */
  N: ComputedRef<string>;
  /** Gelbes ◐ — teilweiser Support. */
  Partial: ComputedRef<string>;
}

export function useSupportMarks(): SupportMarks {
  const { isDark } = useDarkMode();
  const Y = computed(() => {
    const c = isDark.value ? "#80c050" : "#639922";
    return `<span style="color:${c};font-weight:600">✓</span>`;
  });
  const N = computed(() => {
    const c = isDark.value ? "#f06060" : "#A32D2D";
    return `<span style="color:${c}">✗</span>`;
  });
  const Partial = computed(() => {
    const c = isDark.value ? "#e0a030" : "#BA7517";
    return `<span style="color:${c};font-weight:500">◐</span>`;
  });
  return { Y, N, Partial };
}
