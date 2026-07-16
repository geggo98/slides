<!--
  Ported from "brainless" — https://github.com/theswerd/brainless
  Original file: registry/brainless/claude/claude-header.tsx (ClaudeLogo export)
  Copyright (c) 2026 Ben Swerdlow — MIT License (copy: shared/components/brainless/LICENSE)
  Port: React/TSX + Tailwind → Vue 3 SFC with scoped CSS; sprite bitmap and
  proportions kept faithful to the original.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{ scale?: number; color?: string }>(), {
  scale: 4,
  color: "#cd694a",
});

// Claude's launch sprite as a 1-bit bitmap (decoded from the terminal glyphs).
const LOGO_BITS = [
  "000111111111111000",
  "000110111111011000",
  "011111111111111110",
  "000111111111111000",
  "000010100001010000",
];

const W = LOGO_BITS[0].length;
const H = LOGO_BITS.length;
// Terminal char cells are taller than wide, so each sprite pixel is stretched
// vertically (PH) to keep the logo's proportions instead of looking squat.
const PH = 2.4;

const rects: { x: number; y: number; w: number }[] = [];
LOGO_BITS.forEach((row, y) => {
  let x = 0;
  while (x < W) {
    if (row[x] === "1") {
      let end = x;
      while (end < W && row[end] === "1") end += 1;
      rects.push({ x, y, w: end - x });
      x = end;
    } else {
      x += 1;
    }
  }
});
</script>

<template>
  <svg
    aria-hidden="true"
    :width="W * props.scale"
    :height="H * PH * props.scale"
    :viewBox="`0 0 ${W} ${H * PH}`"
    shape-rendering="crispEdges"
    :fill="props.color"
  >
    <rect
      v-for="r in rects"
      :key="`${r.x}-${r.y}`"
      :x="r.x"
      :y="r.y * PH"
      :width="r.w"
      :height="PH"
    />
  </svg>
</template>
