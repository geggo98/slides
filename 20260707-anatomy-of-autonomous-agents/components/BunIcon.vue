<script setup lang="ts">
// Inline-SVG-Icons für die Bun-Bonus-Slides. Pfade aus Tabler Icons (MIT,
// https://tabler.io/icons) — im Repo ist kein Iconify-Paket installiert,
// Inline-SVG mit currentColor ist dependency-frei und theme-sicher.
const PATHS: Record<string, string[]> = {
  "info-circle": [
    "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0",
    "M12 9h.01",
    "M11 12h1v4h1",
  ],
  code: ["M7 8l-4 4l4 4", "M17 8l4 4l-4 4", "M14 4l-4 16"],
  eye: [
    "M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
    "M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6",
  ],
  tool: [
    "M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5",
  ],
  refresh: [
    "M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4",
    "M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
  ],
  "alert-triangle": [
    "M12 9v4",
    "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z",
    "M12 16h.01",
  ],
  "message-2": [
    "M8 9h8",
    "M8 13h6",
    "M12.01 18.594l-4.01 2.406v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5.99z",
  ],
  "git-pull-request": [
    "M4 18a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
    "M4 6a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
    "M16 18a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
    "M6 8v8",
    "M11 6h5a2 2 0 0 1 2 2v8",
    "M14 9l-3 -3l3 -3",
  ],
  scale: [
    "M7 20h10",
    "M6 6l6 -1l6 1",
    "M12 3v17",
    "M9 12l-3 -6l-3 6a3 3 0 0 0 6 0",
    "M21 12l-3 -6l-3 6a3 3 0 0 0 6 0",
  ],
};

withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });
</script>

<template>
  <svg
    class="bun-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in PATHS[name] ?? []" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.bun-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: -0.15em;
}
</style>
