<template>
  <div class="lst-wrap">
    <svg
      viewBox="0 0 680 280"
      role="img"
      aria-label="LST = CST + Type Attribution"
    >
      <defs>
        <marker
          id="lstArr"
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

      <!-- Top row: CST and Type Attribution as building blocks -->
      <g class="lst-card blue">
        <rect x="250" y="30" width="180" height="80" rx="10" />
        <text x="340" y="53" text-anchor="middle" class="t-h">CST</text>
        <text x="340" y="68" text-anchor="middle" class="t-expand">
          Concrete Syntax Tree
        </text>
        <text x="340" y="88" text-anchor="middle" class="t-s">
          behält Whitespace
        </text>
        <text x="340" y="103" text-anchor="middle" class="t-s">
          und Kommentare
        </text>
      </g>

      <g class="lst-card purple">
        <rect x="460" y="30" width="180" height="80" rx="10" />
        <text x="550" y="56" text-anchor="middle" class="t-h">
          Type Attribution
        </text>
        <text x="550" y="80" text-anchor="middle" class="t-s">
          Symbole, Resolved Types,
        </text>
        <text x="550" y="95" text-anchor="middle" class="t-s">
          Klassenhierarchie
        </text>
      </g>

      <!-- Composition arrows: CST + Type Attribution feed the LST -->
      <line
        x1="340"
        y1="110"
        x2="340"
        y2="180"
        class="lst-line"
        marker-end="url(#lstArr)"
      />
      <line
        x1="550"
        y1="110"
        x2="550"
        y2="180"
        class="lst-line"
        marker-end="url(#lstArr)"
      />

      <!-- AST: left, vertically centered — the implicit "vs" against LST -->
      <g class="lst-card gray">
        <rect x="40" y="100" width="180" height="80" rx="10" />
        <text x="130" y="123" text-anchor="middle" class="t-h">AST</text>
        <text x="130" y="138" text-anchor="middle" class="t-expand">
          Abstract Syntax Tree
        </text>
        <text x="130" y="158" text-anchor="middle" class="t-s">
          nur Syntax-Struktur
        </text>
        <text x="130" y="173" text-anchor="middle" class="t-s">
          verliert Trivia
        </text>
      </g>

      <!-- LST: bottom-right, spans CST and Type Attribution columns -->
      <g class="lst-card teal">
        <rect x="250" y="180" width="390" height="90" rx="10" />
        <text x="445" y="204" text-anchor="middle" class="t-h">
          LST — Lossless Semantic Tree
        </text>
        <text x="445" y="226" text-anchor="middle" class="t-s">
          CST + Type Attribution
        </text>
        <text x="445" y="244" text-anchor="middle" class="t-s t-eq">=</text>
        <text x="445" y="261" text-anchor="middle" class="t-s">
          format-erhaltender, typsicherer Round-Trip
        </text>
      </g>
    </svg>
    <p class="caption">
      Der AST-Ansatz (JavaParser, Spoon) verliert Formatierung beim Round-Trip.
      OpenRewrites LST behält Whitespace <em>und</em> Typinformation —
      Voraussetzung für reviewbare Diffs.
    </p>
  </div>
</template>

<style scoped>
.lst-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lst-wrap svg {
  width: 100%;
  height: auto;
  max-height: 320px;
}
.t-eq {
  font-weight: 500;
  fill: var(--color-text-tertiary);
}
.t-expand {
  font-size: 10px;
  fill: var(--color-text-tertiary);
  font-style: italic;
}
.lst-card rect {
  fill: var(--color-background-secondary);
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.lst-card.gray rect {
  fill: var(--color-background-tertiary);
}
.lst-card.blue rect {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
.lst-card.purple rect {
  fill: color-mix(
    in srgb,
    var(--color-background-info) 60%,
    var(--color-background-secondary) 40%
  );
  stroke: var(--color-border-info);
}
.lst-card.teal rect {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
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
.lst-line {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  fill: none;
}
.caption {
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-text-secondary);
  margin: 0;
}
</style>
