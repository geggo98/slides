<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import ParetoChart from "./ParetoChart.vue";
import {
  DEFAULT_VARIANT,
  VARIANT_ORDER,
  VARIANTS,
  type VariantId,
} from "./paretoVariants";

// Folie „Welches Modell wofür?“: Menü, Chart, Empfehlungsabsatz, Fußzeile.
// Was sich zwischen den drei Ansichten unterscheidet, steht in
// `paretoVariants.ts`; gezeichnet wird in `ParetoChart.vue`, das pro Variante
// neu gemountet wird (`:key`) — Skala, Pfeilcluster und Entzerrung sind dort
// Setup-Konstanten. Filter, Pins und Schalter beginnen damit bei jedem Wechsel
// von vorn, was gewollt ist: Eine Auswahl aus „Anbieter“ oder „alle Namen“ hat
// in einer anderen Ansicht keine Bedeutung.

const variantId = ref<VariantId>(DEFAULT_VARIANT);
const V = () => VARIANTS[variantId.value];
const open = ref(false);

function pick(id: VariantId) {
  variantId.value = id;
  open.value = false;
}

const close = () => (open.value = false);
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") close();
};
onMounted(() => {
  window.addEventListener("click", close);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("click", close);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div class="mpv-root">
    <!-- Das Menü sitzt in der Überschriftenzeile der Folie: die Legendenzeile
         des Charts ist nowrap und voll (siehe ParetoChart.vue). -->
    <div class="mpv-menu" @click.stop>
      <button
        class="mpv-btn"
        aria-haspopup="listbox"
        :aria-expanded="open"
        title="Datenquelle und Achsen der Ansicht wechseln"
        @click="open = !open"
      >
        <span class="mpv-cap">Ansicht</span>
        {{ V().menu }}
        <span class="mpv-chev" aria-hidden="true">▾</span>
      </button>
      <ul v-if="open" class="mpv-list" role="listbox">
        <li v-for="id in VARIANT_ORDER" :key="id" role="option">
          <button
            class="mpv-opt"
            :class="{ on: id === variantId }"
            :aria-selected="id === variantId"
            @click="pick(id)"
          >
            <span class="mpv-t">{{ VARIANTS[id].menu }}</span>
            <span class="mpv-n">{{ VARIANTS[id].menuNote }}</span>
          </button>
        </li>
      </ul>
    </div>

    <ParetoChart :key="variantId" :variant="V()" />

    <div v-click class="text-sm mt-1">
      <template v-for="(s, i) in V().lead" :key="i">
        <strong v-if="s.b">{{ s.t }}</strong>
        <template v-else>{{ s.t }}</template>
      </template>
    </div>

    <div class="text-xs opacity-70 mt-1">
      <template v-for="(s, i) in V().footnote" :key="i">
        <strong v-if="s.b">{{ s.t }}</strong>
        <template v-else>{{ s.t }}</template>
      </template>
      <a
        v-if="V().attribution"
        :href="V().attribution!.href"
        target="_blank"
        rel="noopener"
        >{{ V().attribution!.label }}</a
      >
    </div>
  </div>
</template>

<style scoped>
.mpv-root {
  position: relative;
}
/* Rechts oben in der Überschriftenzeile; die Folie hat 40 px H1-Höhe darüber. */
.mpv-menu {
  position: absolute;
  right: 0;
  top: -38px;
  z-index: 20;
  font-size: 11px;
}
.mpv-btn {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 9px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 999px;
  background: var(--deck-surface, var(--color-background-primary));
  font: inherit;
  color: var(--color-text-primary);
  cursor: pointer;
}
.mpv-btn:hover {
  border-color: var(--color-text-info);
}
.mpv-cap {
  font-size: 9.5px;
  color: var(--color-text-tertiary);
}
.mpv-chev {
  font-size: 9px;
  color: var(--color-text-tertiary);
}
.mpv-list {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  min-width: 230px;
  margin: 0;
  padding: 3px;
  list-style: none;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--deck-surface, var(--color-background-primary));
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
}
.mpv-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  font: inherit;
  text-align: left;
  color: var(--color-text-primary);
  cursor: pointer;
}
.mpv-opt:hover {
  background: color-mix(in srgb, var(--color-text-info) 10%, transparent);
}
.mpv-opt.on {
  background: color-mix(in srgb, var(--color-text-info) 16%, transparent);
}
.mpv-n {
  font-size: 9.5px;
  color: var(--color-text-tertiary);
}
</style>
