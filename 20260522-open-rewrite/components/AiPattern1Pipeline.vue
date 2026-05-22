<template>
  <svg
    viewBox="0 0 680 240"
    role="img"
    aria-label="Pattern 1: Recipes first, AI im Build-Loop"
  >
    <defs>
      <marker
        id="p1Arr"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path
          d="M2 1L8 5L2 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </marker>
    </defs>

    <g class="c-gray">
      <rect x="20" y="90" width="100" height="44" rx="8" />
      <text x="70" y="116" text-anchor="middle" class="t-h">Quelle</text>
    </g>
    <g class="c-blue">
      <rect x="160" y="90" width="140" height="44" rx="8" />
      <text x="230" y="116" text-anchor="middle" class="t-h">Recipes</text>
    </g>
    <g class="c-blue">
      <rect x="340" y="90" width="100" height="44" rx="8" />
      <text x="390" y="116" text-anchor="middle" class="t-h">Build</text>
    </g>
    <g class="c-teal">
      <rect x="500" y="90" width="100" height="44" rx="8" />
      <text x="550" y="116" text-anchor="middle" class="t-h">PR</text>
    </g>
    <g class="c-coral">
      <rect x="320" y="180" width="140" height="44" rx="8" />
      <text x="390" y="206" text-anchor="middle" class="t-h">
        AI fixt Fehler
      </text>
    </g>

    <line
      x1="120"
      y1="112"
      x2="160"
      y2="112"
      class="arr"
      marker-end="url(#p1Arr)"
    />
    <line
      x1="300"
      y1="112"
      x2="340"
      y2="112"
      class="arr"
      marker-end="url(#p1Arr)"
    />
    <line
      x1="440"
      y1="112"
      x2="500"
      y2="112"
      class="arr"
      marker-end="url(#p1Arr)"
    />
    <text x="470" y="103" text-anchor="middle" class="t-s">pass</text>

    <line
      x1="390"
      y1="134"
      x2="390"
      y2="180"
      class="arr"
      marker-end="url(#p1Arr)"
    />
    <text x="408" y="160" class="t-s">fail</text>

    <path
      d="M320 202 L280 202 L280 70 L390 70 L390 90"
      fill="none"
      class="arr"
      marker-end="url(#p1Arr)"
    />
    <text x="300" y="62" class="t-s">retry</text>
  </svg>
</template>

<style scoped>
svg {
  width: 100%;
  height: auto;
  max-height: 180px;
}
.c-gray rect {
  fill: var(--color-background-secondary);
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.c-blue rect {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
  stroke-width: 0.5;
}
.c-teal rect {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
  stroke-width: 0.5;
}
.c-coral rect {
  fill: var(--color-background-warning);
  stroke: var(--color-border-warning);
  stroke-width: 0.5;
}
.t-h {
  font-size: 12.5px;
  font-weight: 500;
  fill: var(--color-text-primary);
}
.t-s {
  font-size: 11px;
  fill: var(--color-text-secondary);
}
.arr {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  fill: none;
}
</style>
