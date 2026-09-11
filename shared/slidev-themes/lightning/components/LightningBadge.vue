<!--
  Das Abzeichen der Titelfolie: „⚡ LIGHTNING TALK · 8 MIN · <Zusatz>".

  Die Minuten kommen aus `duration:` des Decks (Theme-Default 8min) und werden
  mit derselben Funktion gelesen wie Slidevs Presenter-Timer — Badge und
  Countdown können sich so nicht widersprechen. Das Label kommt aus
  themeConfig.badge; ein Deck, das `themeConfig:` im Headmatter setzt,
  ersetzt damit das ganze Theme-Objekt (Slidev merged nicht tief), deshalb
  gibt es hier einen Fallback.
-->
<script setup lang="ts">
import { computed, useSlots } from "vue";
import { configs } from "@slidev/client";
import { parseTimeString } from "@slidev/parser/utils";
import LtBolt from "./LtBolt.vue";

// `minutes` erlaubt false, und ein Prop mit Boolean im Typ setzt Vue bei
// Abwesenheit auf false statt undefined — ohne ausdrücklichen Default wären
// die Minuten nie zu sehen.
const props = withDefaults(
  defineProps<{
    /** Text vor den Minuten; Default themeConfig.badge, sonst „Lightning Talk". */
    label?: string;
    /** Minuten; Default aus `duration:`; `false` blendet die Angabe aus. */
    minutes?: number | false;
    /** Zusatz nach dem zweiten Punkt, z. B. „DuckDB als Beispiel". */
    note?: string;
  }>(),
  { label: undefined, minutes: undefined, note: undefined },
);

const slots = useSlots();

const themeBadge = computed(() => {
  const value = (configs.themeConfig as Record<string, unknown> | undefined)
    ?.badge;
  return typeof value === "string" ? value : "Lightning Talk";
});

const label = computed(() => props.label ?? themeBadge.value);

const minutes = computed<number | null>(() => {
  if (props.minutes === false) return null;
  if (typeof props.minutes === "number") return props.minutes;
  try {
    const seconds = parseTimeString(
      configs.duration as string | number,
    ).seconds;
    return seconds > 0 ? Math.round(seconds / 60) : null;
  } catch {
    return null;
  }
});

const hasNote = computed(() => Boolean(props.note) || Boolean(slots.default));

const title = computed(() =>
  minutes.value ? `${label.value} · ${minutes.value} Minuten` : label.value,
);
</script>

<template>
  <span class="lt-badge" :title="title">
    <LtBolt class="lt-badge-bolt" />
    <span>{{ label }}</span>
    <template v-if="minutes">
      <span class="lt-badge-sep" aria-hidden="true">·</span>
      <span>{{ minutes }} Min</span>
    </template>
    <template v-if="hasNote">
      <span class="lt-badge-sep" aria-hidden="true">·</span>
      <span class="lt-badge-note"
        ><slot>{{ note }}</slot></span
      >
    </template>
  </span>
</template>

<style scoped>
.lt-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1.5px solid var(--lt-accent);
  background: var(--lt-accent-soft);
  color: var(--lt-accent-ink);
  font-size: 0.7rem;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.lt-badge-bolt {
  width: 1.1em;
  height: 1.1em;
  color: var(--lt-accent);
}
.lt-badge-sep {
  opacity: 0.55;
}
.lt-badge-note {
  font-weight: 500;
  letter-spacing: 0.08em;
}
</style>
