<script setup lang="ts">
import { computed } from "vue";
import { talkUrl, TALKS, type TalkSlug } from "@shared/talks";

// Geteilte Querverweis-Primitive: rendert den Vortragstitel als Link auf die
// kanonische GitHub-Pages-URL. Bewusst ohne festen Pfeil — Call-Sites setzen "→"
// selbst, wo gewünscht. Erbt Schriftgröße/-gewicht vom Kontext, damit die
// Komponente sowohl als Header-Link als auch inline im Fließtext passt.
// slug ist auf die bekannten Talk-Slugs typisiert: ein Tippfehler oder ein
// gelöschtes Deck failt beim Type-Check, statt stumm den Slug als Linktext zu
// rendern. Der Runtime-Guard bleibt, weil Markdown-Verwendungen in slides.md
// nicht von vue-tsc geprüft werden.
const props = defineProps<{ slug: TalkSlug }>();

const href = computed(() => talkUrl(props.slug));
// Fallback-Label aus der Registry, falls kein Slot-Inhalt übergeben wurde.
const fallback = computed(() =>
  props.slug in TALKS ? TALKS[props.slug] : props.slug,
);
</script>

<template>
  <a class="talk-xref" :href="href" target="_blank" rel="noopener">
    <slot>{{ fallback }}</slot>
  </a>
</template>

<style scoped>
/* Persistente, gepunktete Unterstreichung als Klickbarkeits-Hinweis (kein
 * hover-only): ein Querverweis muss auf der Folie und per Beamer auf einen
 * Blick als Link erkennbar sein. Die Unterstreichung nutzt currentColor, bleibt
 * also in Light + Dark lesbar — selbst wenn das Farb-Token in einem Deck ohne
 * SlidevTokens (z.B. ai-agents) nicht aufgelöst wird; dort greift der
 * Blau-Fallback statt der vom Body geerbten schwarzen Textfarbe.
 * font-size/-weight erben vom Kontext, damit der Link im <header> fett/groß
 * bleibt und inline die Fließtext-Größe trifft. */
.talk-xref {
  color: var(--color-text-info, #3b82f6);
  font-family: var(--font-sans);
  font-size: inherit;
  font-weight: inherit;
  cursor: pointer;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: currentColor;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
  transition:
    text-decoration-style 80ms ease,
    text-decoration-thickness 80ms ease;
}
.talk-xref:hover,
.talk-xref:focus-visible {
  /* Farbe explizit halten: sonst überschreibt eine geerbte a:hover-Regel des
   * Decks die Linkfarbe (z.B. Teal). Beim Hover verstärkt sich nur die
   * Unterstreichung (solid, dicker). */
  color: var(--color-text-info, #3b82f6);
  text-decoration-style: solid;
  text-decoration-thickness: 2px;
}
.talk-xref:focus-visible {
  outline: 2px solid var(--color-text-info, #3b82f6);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
