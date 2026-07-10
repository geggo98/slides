<script setup lang="ts">
// Dark-Mode-Overlay für die Poster-Folie: zeigt eine eigens gezeichnete dunkle
// Fassung des Anatomie-Posters (statt die helle per CSS-Filter zu verfremden).
//
// GitHub Pages deployt jeden Talk unter /slides/<talk>/. Rohe „/…"-URLs in CSS
// bekämen diesen Base-Pfad NICHT vorangestellt — nur Slidevs Frontmatter-`image:`
// (via resolveAssetUrl) tut das. Deshalb hier BASE_URL selbst voranstellen.
const src = `${import.meta.env.BASE_URL}anatomie-autonomer-agenten-dark.webp`;
</script>

<template>
  <div
    class="anatomy-poster-dark"
    :style="{ backgroundImage: `url('${src}')` }"
  />
</template>

<!-- Unscoped: alle Selektoren nutzen eindeutige Klassen, daher global unbedenklich.
     (Slidev-Slide-`<style>` scheidet aus — neben Komponenten-Inhalt bricht es den
     Vue-Compiler; und scoped `:global(.dark) …` platziert das Scope-Attribut
     unzuverlässig, sodass der Dark-Swap nicht greift.) -->
<style>
/* Elternfolie: `.anatomie-poster` ist die `.slidev-layout` dieser einen Folie
   (per `class:`-Frontmatter gesetzt). */
.anatomie-poster {
  position: relative; /* Containing Block fürs absolute Overlay */
  background-color: #e9ddc4; /* Letterbox-Ränder in Light Mode */
}

/* Light Mode: unsichtbar — dort greift das helle `layout: image`-Poster. */
.anatomy-poster-dark {
  display: none;
}

/* Dark Mode: das dunkle Poster deckend über die helle Fassung legen. */
.dark .anatomy-poster-dark {
  display: block;
  position: absolute;
  inset: 0;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #010104; /* Letterbox-Ränder, an den Poster-Rand angepasst */
}
</style>
