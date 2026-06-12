<script setup>
import "./svg-diagram.css";
</script>

<template>
  <svg
    class="or-diagram"
    viewBox="0 0 680 250"
    role="img"
    aria-label="Pattern 2: KI autoriert Recipe einmal, Recipe läuft deterministisch beliebig oft"
  >
    <defs>
      <marker
        id="p2Arr"
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

    <text x="20" y="20" class="t-section">Einmalig</text>
    <g class="c-coral">
      <rect x="60" y="32" width="200" height="58" rx="10" />
      <text x="160" y="55" text-anchor="middle" class="t-h">
        KI + Moderne Skills
      </text>
      <text x="160" y="74" text-anchor="middle" class="t-s">
        Recipe authoring
      </text>
    </g>
    <line
      x1="260"
      y1="61"
      x2="320"
      y2="61"
      class="arr"
      marker-end="url(#p2Arr)"
    />
    <g class="c-blue">
      <rect x="320" y="32" width="220" height="58" rx="10" />
      <text x="430" y="55" text-anchor="middle" class="t-h">
        Recipe Artifact
      </text>
      <text x="430" y="74" text-anchor="middle" class="t-s">
        getestet, versioniert
      </text>
    </g>

    <text x="20" y="125" class="t-section">Dann beliebig oft</text>
    <line
      x1="430"
      y1="90"
      x2="430"
      y2="150"
      class="arr"
      marker-end="url(#p2Arr)"
    />

    <g class="c-teal">
      <rect x="60" y="160" width="120" height="44" rx="8" />
      <text x="120" y="186" text-anchor="middle" class="t-h">Repo 1</text>
    </g>
    <g class="c-teal">
      <rect x="200" y="160" width="120" height="44" rx="8" />
      <text x="260" y="186" text-anchor="middle" class="t-h">Repo 2</text>
    </g>
    <g class="c-teal">
      <rect x="340" y="160" width="120" height="44" rx="8" />
      <text x="400" y="186" text-anchor="middle" class="t-h">Repo 3</text>
    </g>
    <g class="c-teal">
      <rect x="480" y="160" width="140" height="44" rx="8" />
      <text x="550" y="186" text-anchor="middle" class="t-h">Repo N</text>
    </g>

    <path
      d="M430 150 L120 150 L120 160"
      fill="none"
      class="arr"
      marker-end="url(#p2Arr)"
    />
    <path
      d="M430 150 L260 150 L260 160"
      fill="none"
      class="arr"
      marker-end="url(#p2Arr)"
    />
    <path
      d="M430 150 L400 150 L400 160"
      fill="none"
      class="arr"
      marker-end="url(#p2Arr)"
    />
    <path
      d="M430 150 L550 150 L550 160"
      fill="none"
      class="arr"
      marker-end="url(#p2Arr)"
    />

    <text x="340" y="230" text-anchor="middle" class="t-foot">
      Deterministisch, reviewt, idempotent — Token-Kosten fallen einmal an,
      nicht 200×.
    </text>
  </svg>
</template>

<style scoped>
svg {
  max-height: 200px;
}
.t-section {
  font-size: 11.5px;
  font-weight: 500;
  fill: var(--color-text-secondary);
}
</style>
