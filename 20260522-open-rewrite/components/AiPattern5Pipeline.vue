<script setup>
import "./svg-diagram.css";
</script>

<template>
  <svg
    class="or-diagram"
    viewBox="0 0 680 220"
    role="img"
    aria-label="Pattern 5: MCP-basierter Recipe-Call"
  >
    <defs>
      <marker
        id="p5Arr"
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

    <g class="c-coral">
      <rect x="20" y="60" width="160" height="100" rx="10" />
      <text x="100" y="94" text-anchor="middle" class="t-h">KI-Agent</text>
      <text x="100" y="116" text-anchor="middle" class="t-s">
        entscheidet dynamisch,
      </text>
      <text x="100" y="132" text-anchor="middle" class="t-s">
        welche Recipe wann
      </text>
    </g>

    <g class="c-purple">
      <rect x="220" y="50" width="240" height="120" rx="10" />
      <text x="340" y="74" text-anchor="middle" class="t-h">
        Moderne MCP Server
      </text>
      <text x="340" y="100" text-anchor="middle" class="t-s">run_recipe</text>
      <text x="340" y="118" text-anchor="middle" class="t-s">find_recipes</text>
      <text x="340" y="136" text-anchor="middle" class="t-s">
        analyze_impact
      </text>
    </g>

    <g class="c-blue">
      <rect x="500" y="60" width="160" height="100" rx="10" />
      <text x="580" y="94" text-anchor="middle" class="t-h">Recipes</text>
      <text x="580" y="116" text-anchor="middle" class="t-s">
        deterministisch,
      </text>
      <text x="580" y="132" text-anchor="middle" class="t-s">
        aber unter Agent-Kontrolle
      </text>
    </g>

    <line
      x1="180"
      y1="92"
      x2="220"
      y2="92"
      class="arr"
      marker-end="url(#p5Arr)"
    />
    <line
      x1="220"
      y1="128"
      x2="180"
      y2="128"
      class="arr"
      marker-end="url(#p5Arr)"
    />
    <line
      x1="460"
      y1="92"
      x2="500"
      y2="92"
      class="arr"
      marker-end="url(#p5Arr)"
    />
    <line
      x1="500"
      y1="128"
      x2="460"
      y2="128"
      class="arr"
      marker-end="url(#p5Arr)"
    />

    <text x="340" y="200" text-anchor="middle" class="t-foot">
      Agent entscheidet dynamisch — Recipe-Auswahl ist nicht reproduzierbar
      zwischen Läufen.
    </text>
  </svg>
</template>

<style scoped>
svg {
  /* Einziges Pipeline-Diagramm mit größerer Headline-Schrift. */
  --or-dia-h-size: 13px;
  max-height: 180px;
}
</style>
