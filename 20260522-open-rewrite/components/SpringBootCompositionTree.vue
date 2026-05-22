<template>
  <div class="sb-wrap">
    <svg
      viewBox="0 0 680 280"
      role="img"
      aria-label="UpgradeSpringBoot_4_0 als Composite Recipe"
    >
      <defs>
        <marker
          id="sbArr"
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

      <g class="card teal">
        <rect x="220" y="20" width="240" height="60" rx="10" />
        <text x="340" y="44" text-anchor="middle" class="t-h">
          UpgradeSpringBoot_4_0
        </text>
        <text x="340" y="64" text-anchor="middle" class="t-s">
          Composite Recipe
        </text>
      </g>

      <line x1="340" y1="80" x2="340" y2="110" class="line" />
      <line x1="107" y1="110" x2="573" y2="110" class="line" />
      <line
        x1="107"
        y1="110"
        x2="107"
        y2="150"
        class="line"
        marker-end="url(#sbArr)"
      />
      <line
        x1="262"
        y1="110"
        x2="262"
        y2="150"
        class="line"
        marker-end="url(#sbArr)"
      />
      <line
        x1="418"
        y1="110"
        x2="418"
        y2="150"
        class="line"
        marker-end="url(#sbArr)"
      />
      <line
        x1="573"
        y1="110"
        x2="573"
        y2="150"
        class="line"
        marker-end="url(#sbArr)"
      />

      <g class="card blue">
        <rect x="40" y="158" width="135" height="46" rx="10" />
        <text x="107" y="184" text-anchor="middle" class="t-h">Boot 3.5</text>
      </g>
      <g class="card blue">
        <rect x="195" y="158" width="135" height="46" rx="10" />
        <text x="262" y="184" text-anchor="middle" class="t-h">
          Framework 7.0
        </text>
      </g>
      <g class="card blue">
        <rect x="350" y="158" width="135" height="46" rx="10" />
        <text x="418" y="184" text-anchor="middle" class="t-h">
          Security 7.0
        </text>
      </g>
      <g class="card blue">
        <rect x="505" y="158" width="135" height="46" rx="10" />
        <text x="573" y="184" text-anchor="middle" class="t-h">
          Hibernate 7.1
        </text>
      </g>

      <text x="340" y="232" text-anchor="middle" class="t-pct">
        + Spring Cloud 2025.1, Batch 5→6, SpringBoot-Properties 4.0,
      </text>
      <text x="340" y="250" text-anchor="middle" class="t-pct">
        Testcontainers 2, SpringDoc 3.0, Dependency-Version-Bump
      </text>
      <text x="340" y="270" text-anchor="middle" class="t-foot">
        Rekursiv: Boot 4.0 → 3.5 → 3.4 … → 2.0. Property-Migration zuletzt, dann
        Version-Bump.
      </text>
    </svg>
  </div>
</template>

<style scoped>
.sb-wrap svg {
  width: 100%;
  height: auto;
  max-height: 340px;
}
.card rect {
  stroke-width: 0.5;
  stroke: var(--color-border-tertiary);
}
.card.teal rect {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
}
.card.blue rect {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
.t-h {
  font-size: 13px;
  font-weight: 500;
  fill: var(--color-text-primary);
}
.t-s {
  font-size: 11.5px;
  fill: var(--color-text-secondary);
}
.t-pct {
  font-size: 12px;
  fill: var(--color-text-secondary);
}
.t-foot {
  font-size: 11.5px;
  fill: var(--color-text-tertiary);
  font-style: italic;
}
.line {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  fill: none;
}
</style>
