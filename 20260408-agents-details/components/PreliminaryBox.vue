<script setup lang="ts">
import {
  PRELIMINARY_SELF_REPORTED,
  type Preliminary,
} from "./lib/preliminaryDeepSWE";

// Geteilter Baustein für „vorläufig, selbstberichtet" — bislang auf
// `EffortFalle.vue` (Klick 3) und der Folie „Welches Modell wofür?"
// (`ModelRoutingPareto.vue`, zweiter Klick in slides.md). Kein Prop: der
// Inhalt ist an beiden Stellen derselbe, siehe `lib/preliminaryDeepSWE.ts`
// für Herkunft und Quellen der drei Zahlen.

const fmtPct = (v: number) => v.toFixed(2).replace(".", ",");
const trialsNote = (p: Preliminary) =>
  [
    p.effort ? `bei ${p.effort} effort` : null,
    p.trials ? `Ø ${p.trials} Durchläufe` : null,
  ]
    .filter(Boolean)
    .join(", ");
</script>

<template>
  <div class="pb-box">
    <div class="pb-badge">vorläufig · selbstberichtet</div>
    <strong>Drei neue Modelle, noch nicht von DeepSWE gemessen</strong>
    — beide Tracking-Issues enden mit „Please test“:
    <span
      v-for="(p, i) in PRELIMINARY_SELF_REPORTED"
      :key="p.label"
      class="pb-item"
    >
      <strong>{{ p.displayName }}</strong> {{ fmtPct(p.y) }} %<span
        v-if="trialsNote(p)"
        class="pb-meta"
      >
        ({{ trialsNote(p) }})</span
      >
      (<a :href="p.href" target="_blank" rel="noopener">Quelle</a>){{
        i < PRELIMINARY_SELF_REPORTED.length - 1 ? " · " : ""
      }}
    </span>
    <span class="pb-meta">
      — die Zahlen kommen von Anthropic bzw. OpenAI selbst, nicht von Datacurve;
      kein Preis pro Task (Opus 5.5 nennt keinen, aus dem OpenAI-Chart lässt
      sich keiner belastbar ablesen).</span
    >
  </div>
</template>

<style scoped>
.pb-box {
  position: relative;
  font-size: 12.5px;
  line-height: 1.38;
  padding: 18px 12px 7px;
  border-radius: 8px;
  background: var(--color-background-secondary, rgba(128, 128, 128, 0.08));
  border: 1.5px dashed var(--color-border-secondary);
}
.pb-item {
  display: inline;
}
.pb-meta {
  opacity: 0.7;
  font-size: 12px;
}
.pb-badge {
  position: absolute;
  top: -9px;
  left: 10px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-text-warning);
  color: var(--deck-surface, var(--color-background-primary));
}
</style>
