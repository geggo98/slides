<!--
  Zeitbudget und Footer über jeder Inhaltsfolie.

  Der Fortschrittsbalken zeigt, wie weit der Vortrag ist — bei zwölf Folien in
  acht Minuten ist das die ehrlichste Uhr, die das Publikum sehen darf. Er
  endet auf der ersten Folie mit `layout: end`; ein Anhang dahinter zählt
  nicht zum Budget. Der Zähler rechts zeigt trotzdem alle Folien.

  Warum useSlideContext() statt useNav(): beim `slidev export` rendert
  PrintSlideClick.vue alle Folien gleichzeitig und stellt je Seite einen
  festen Nav-Kontext bereit — nur darüber stimmt die Seitenzahl im PDF. Im
  Vortrag liefert derselbe Aufruf den globalen Kontext aus setup/root.ts.

  pointer-events: none ist Pflicht: darunter liegen Slider, Tabs und
  Radiogroups der interaktiven Folien.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useSlideContext } from "@slidev/client";
import LtBolt from "./components/LtBolt.vue";

const { $slidev } = useSlideContext();

const page = computed(() => $slidev.nav.currentPage);
const total = computed(() => $slidev.nav.total);
const layout = computed(() => $slidev.nav.currentLayout);
const hidden = computed(
  () => layout.value === "cover" || layout.value === "end",
);

const budgetEnd = computed(() => {
  const slides = $slidev.nav.slides as { meta?: { layout?: string } }[];
  const end = slides.findIndex((slide) => slide.meta?.layout === "end");
  return end >= 0 ? end + 1 : total.value;
});

const progress = computed(() => {
  const span = Math.max(1, budgetEnd.value - 1);
  const done = Math.min(Math.max(page.value - 1, 0), span);
  return (done / span) * 100;
});

const label = computed(() => {
  const value = (
    $slidev.configs.themeConfig as Record<string, unknown> | undefined
  )?.badge;
  if (value === false) return "";
  return typeof value === "string" ? value : "Lightning Talk";
});
</script>

<template>
  <div v-if="!hidden" class="lt-chrome" aria-hidden="true">
    <div class="lt-progress" :style="{ width: `${progress}%` }" />
    <div v-if="label" class="lt-foot lt-foot-l"><LtBolt /> {{ label }}</div>
    <div class="lt-foot lt-foot-r">{{ page }} / {{ total }}</div>
  </div>
</template>
