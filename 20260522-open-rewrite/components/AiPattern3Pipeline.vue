<template>
  <svg
    viewBox="0 0 680 200"
    role="img"
    aria-label="Pattern 3: LLM in Recipe — non-deterministische Diffs"
  >
    <defs>
      <marker
        id="p3Arr"
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
      <rect x="20" y="78" width="100" height="44" rx="8" />
      <text x="70" y="104" text-anchor="middle" class="t-h">Quelle</text>
    </g>

    <rect x="160" y="50" width="340" height="100" rx="12" class="danger-box" />
    <text x="330" y="68" text-anchor="middle" class="t-danger">
      Recipe-Visitor mit LLM-Call
    </text>

    <g class="c-coral">
      <rect x="220" y="82" width="220" height="48" rx="8" />
      <text x="330" y="102" text-anchor="middle" class="t-h">OpenAI API</text>
      <text x="330" y="120" text-anchor="middle" class="t-s">
        non-deterministisch
      </text>
    </g>

    <g class="c-gray">
      <rect x="540" y="78" width="120" height="44" rx="8" />
      <text x="600" y="98" text-anchor="middle" class="t-h">Code</text>
      <text x="600" y="114" text-anchor="middle" class="t-s">variabel</text>
    </g>

    <line
      x1="120"
      y1="100"
      x2="160"
      y2="100"
      class="arr"
      marker-end="url(#p3Arr)"
    />
    <line
      x1="500"
      y1="100"
      x2="540"
      y2="100"
      class="arr"
      marker-end="url(#p3Arr)"
    />

    <text x="340" y="180" text-anchor="middle" class="t-danger">
      Bei jedem Lauf andere Diffs — at scale unreviewbar.
    </text>
  </svg>
</template>

<style scoped>
svg {
  width: 100%;
  height: auto;
  max-height: 170px;
}
.c-gray rect {
  fill: var(--color-background-secondary);
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.c-coral rect {
  fill: var(--color-background-warning);
  stroke: var(--color-border-warning);
  stroke-width: 0.5;
}
.danger-box {
  fill: none;
  stroke: var(--color-border-danger);
  stroke-width: 1;
  stroke-dasharray: 4 3;
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
.t-danger {
  font-size: 11.5px;
  fill: var(--color-text-danger);
}
.arr {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  fill: none;
}
</style>
