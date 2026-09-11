<!--
  Der Blitz als Inline-SVG (Feather „zap", MIT), nicht als Emoji: ein
  Farb-Emoji ignoriert `color` und Deckkraft nur halb und sieht je nach
  Engine anders aus — Apple Color Emoji im Saal, Noto im PDF-Export auf dem
  Linux-Runner. Der Pfad füllt sich mit currentColor.

  Die Größe steht als SVG-Attribut (1em), nicht als scoped CSS: Attribute
  verlieren gegen jede CSS-Regel, sodass Layouts und Footer den Blitz über
  eine Klasse frei skalieren können.
-->
<template>
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    class="lt-bolt-svg"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M13 2 3 14h9l-1 8 10-12h-9z" fill="currentColor" />
  </svg>
</template>

<style scoped>
.lt-bolt-svg {
  display: inline-block;
  vertical-align: -0.1em;
}
</style>
