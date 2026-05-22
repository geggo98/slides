<template>
  <svg
    viewBox="0 0 680 200"
    role="img"
    aria-label="Pattern 4: Prethink — OpenRewrite extrahiert Kontext, AI konsumiert ihn"
  >
    <defs>
      <marker
        id="p4Arr"
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
      <rect x="20" y="76" width="120" height="60" rx="10" />
      <text x="80" y="98" text-anchor="middle" class="t-h">Codebase</text>
      <text x="80" y="118" text-anchor="middle" class="t-s">N Repos</text>
    </g>
    <g class="c-blue">
      <rect x="170" y="76" width="140" height="60" rx="10" />
      <text x="240" y="98" text-anchor="middle" class="t-h">Prethink</text>
      <text x="240" y="118" text-anchor="middle" class="t-s">
        Recipes (LST → Kontext)
      </text>
    </g>
    <g class="c-purple">
      <rect x="340" y="76" width="160" height="60" rx="10" />
      <text x="420" y="98" text-anchor="middle" class="t-h">CALM + CSV</text>
      <text x="420" y="118" text-anchor="middle" class="t-s">
        .moderne/context/
      </text>
    </g>
    <g class="c-coral">
      <rect x="530" y="76" width="130" height="60" rx="10" />
      <text x="595" y="98" text-anchor="middle" class="t-h">AI Agent</text>
      <text x="595" y="118" text-anchor="middle" class="t-s">
        liest CLAUDE.md
      </text>
    </g>

    <line
      x1="140"
      y1="106"
      x2="170"
      y2="106"
      class="arr"
      marker-end="url(#p4Arr)"
    />
    <line
      x1="310"
      y1="106"
      x2="340"
      y2="106"
      class="arr"
      marker-end="url(#p4Arr)"
    />
    <line
      x1="500"
      y1="106"
      x2="530"
      y2="106"
      class="arr"
      marker-end="url(#p4Arr)"
    />

    <text x="340" y="172" text-anchor="middle" class="t-foot">
      Recipes produzieren Kontext — Agent reasoned über Architektur statt rohem
      Code-Grep.
    </text>
  </svg>
</template>

<style scoped>
svg {
  width: 100%;
  height: auto;
  max-height: 160px;
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
.c-purple rect {
  fill: color-mix(
    in srgb,
    var(--color-background-info) 60%,
    var(--color-background-secondary) 40%
  );
  stroke: var(--color-border-info);
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
.t-foot {
  font-size: 11.5px;
  fill: var(--color-text-tertiary);
  font-style: italic;
}
.arr {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  fill: none;
}
</style>
