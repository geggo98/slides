<template>
  <div class="rcp-tree">
    <svg
      viewBox="0 0 680 240"
      role="img"
      aria-label="Drei Recipe-Typen Entscheidungsbaum"
    >
      <defs>
        <marker
          id="rcpArr"
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
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </marker>
      </defs>

      <g class="card neutral">
        <rect x="180" y="20" width="320" height="48" rx="10" />
        <text x="340" y="48" text-anchor="middle" class="t-h">
          Was soll die Recipe leisten?
        </text>
      </g>

      <line
        x1="280"
        y1="68"
        x2="130"
        y2="120"
        class="arr"
        marker-end="url(#rcpArr)"
      />
      <line
        x1="340"
        y1="68"
        x2="340"
        y2="120"
        class="arr"
        marker-end="url(#rcpArr)"
      />
      <line
        x1="400"
        y1="68"
        x2="550"
        y2="120"
        class="arr"
        marker-end="url(#rcpArr)"
      />

      <g class="card blue">
        <rect x="40" y="120" width="180" height="72" rx="10" />
        <text x="130" y="142" text-anchor="middle" class="t-h">
          Declarative YAML
        </text>
        <text x="130" y="160" text-anchor="middle" class="t-s">
          Recipes komponieren
        </text>
        <text x="130" y="178" text-anchor="middle" class="t-pct">~ 60 %</text>
      </g>

      <g class="card purple">
        <rect x="250" y="120" width="180" height="72" rx="10" />
        <text x="340" y="142" text-anchor="middle" class="t-h">
          Refaster-style
        </text>
        <text x="340" y="160" text-anchor="middle" class="t-s">
          Pattern-Ersetzung mit Typ
        </text>
        <text x="340" y="178" text-anchor="middle" class="t-pct">~ 25 %</text>
      </g>

      <g class="card coral">
        <rect x="460" y="120" width="180" height="72" rx="10" />
        <text x="550" y="142" text-anchor="middle" class="t-h">
          Imperative Java
        </text>
        <text x="550" y="160" text-anchor="middle" class="t-s">
          Cross-File-Logik, Visitor
        </text>
        <text x="550" y="178" text-anchor="middle" class="t-pct">~ 15 %</text>
      </g>

      <text x="340" y="218" text-anchor="middle" class="t-foot">
        Schreib in dieser Reihenfolge. Imperative Java erst, wenn YAML und
        Refaster nicht reichen.
      </text>
    </svg>
  </div>
</template>

<style scoped>
.rcp-tree {
  width: 100%;
}
.rcp-tree svg {
  width: 100%;
  height: auto;
  max-height: 320px;
}
.card rect {
  stroke-width: 0.5;
  stroke: var(--color-border-tertiary);
  fill: var(--color-background-secondary);
}
.card.neutral rect {
  fill: var(--color-background-secondary);
}
.card.blue rect {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
.card.purple rect {
  fill: color-mix(
    in srgb,
    var(--color-background-info) 60%,
    var(--color-background-secondary) 40%
  );
  stroke: var(--color-border-info);
}
.card.coral rect {
  fill: var(--color-background-warning);
  stroke: var(--color-border-warning);
}
.t-h {
  font-size: 14px;
  font-weight: 500;
  fill: var(--color-text-primary);
}
.t-s {
  font-size: 12px;
  fill: var(--color-text-secondary);
}
.t-pct {
  font-size: 11px;
  fill: var(--color-text-tertiary);
}
.t-foot {
  font-size: 12px;
  fill: var(--color-text-secondary);
}
.arr {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  fill: none;
}
</style>
