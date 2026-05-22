<script setup>
const patterns = [
  { id: 1, label: "Pattern 1", det: 80, cost: 50, tone: "good" },
  { id: 2, label: "Pattern 2", det: 95, cost: 20, tone: "good" },
  { id: 3, label: "Pattern 3", det: 10, cost: 90, tone: "bad" },
  { id: 4, label: "Pattern 4", det: 80, cost: 50, tone: "warn" },
  { id: 5, label: "Pattern 5", det: 50, cost: 80, tone: "warn" },
];

const W = 680;
const H = 360;
const padL = 70;
const padR = 30;
const padT = 30;
const padB = 60;

function x(cost) {
  return padL + ((W - padL - padR) * cost) / 100;
}
function y(det) {
  return H - padB - ((H - padT - padB) * det) / 100;
}
</script>

<template>
  <div class="axis-wrap">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="Determinismus vs. Token-Kosten"
    >
      <line
        :x1="padL"
        :y1="H - padB"
        :x2="W - padR"
        :y2="H - padB"
        class="axis"
      />
      <line :x1="padL" :y1="padT" :x2="padL" :y2="H - padB" class="axis" />

      <text
        :x="(W - padR + padL) / 2"
        :y="H - 16"
        text-anchor="middle"
        class="label"
      >
        Token-Kosten →
      </text>
      <text
        :x="-(H - padB + padT) / 2"
        :y="20"
        text-anchor="middle"
        class="label"
        transform="rotate(-90)"
      >
        ↑ Determinismus
      </text>

      <text :x="padL - 6" :y="y(0) + 4" text-anchor="end" class="tick">
        0 %
      </text>
      <text :x="padL - 6" :y="y(50) + 4" text-anchor="end" class="tick">
        50 %
      </text>
      <text :x="padL - 6" :y="y(100) + 4" text-anchor="end" class="tick">
        100 %
      </text>
      <text :x="x(0)" :y="H - padB + 16" text-anchor="middle" class="tick">
        niedrig
      </text>
      <text :x="x(50)" :y="H - padB + 16" text-anchor="middle" class="tick">
        mittel
      </text>
      <text :x="x(100)" :y="H - padB + 16" text-anchor="middle" class="tick">
        hoch
      </text>

      <line :x1="padL" :y1="y(60)" :x2="W - padR" :y2="y(60)" class="grid" />
      <text :x="W - padR" :y="y(60) - 4" text-anchor="end" class="hint">
        Reviewbar-Schwelle
      </text>

      <g v-for="p in patterns" :key="p.id">
        <circle
          :cx="x(p.cost)"
          :cy="y(p.det)"
          r="18"
          :class="`dot t-${p.tone}`"
        />
        <text
          :x="x(p.cost)"
          :y="y(p.det) + 4"
          text-anchor="middle"
          class="dot-label"
        >
          {{ p.id }}
        </text>
        <text
          :x="x(p.cost)"
          :y="y(p.det) - 28"
          text-anchor="middle"
          class="dot-name"
        >
          {{ p.label }}
        </text>
      </g>
    </svg>

    <p class="caption">
      Je näher der LLM-Output zur PR-Boundary kommt, desto schmerzhafter die
      Verletzung des Determinismus. Pattern 1 und 2 sind die einzigen
      produktionsreifen Zonen.
    </p>
  </div>
</template>

<style scoped>
.axis-wrap svg {
  width: 100%;
  height: auto;
  max-height: 380px;
}
.axis {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
}
.grid {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.5;
  stroke-dasharray: 4 3;
  opacity: 0.4;
}
.label {
  font-size: 12px;
  fill: var(--color-text-secondary);
  font-weight: 500;
}
.tick {
  font-size: 11px;
  fill: var(--color-text-tertiary);
}
.hint {
  font-size: 10px;
  fill: var(--color-text-tertiary);
}
.dot {
  stroke-width: 1;
}
.dot.t-good {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
}
.dot.t-bad {
  fill: var(--color-background-danger);
  stroke: var(--color-border-danger);
}
.dot.t-warn {
  fill: var(--color-background-warning);
  stroke: var(--color-border-warning);
}
.dot-label {
  font-size: 13px;
  font-weight: 500;
  fill: var(--color-text-primary);
}
.dot-name {
  font-size: 11px;
  fill: var(--color-text-secondary);
}
.caption {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.55;
  margin: 6px 0 0;
}
</style>
