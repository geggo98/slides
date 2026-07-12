<script setup>
/**
 * CanteenStage.vue — eine Kantine (SVG-Bühne) für MMcCompare: Ankunft →
 * Schlange(n) → Köche → Abgang. Port des React-`Stage`. „+N“-Badges kommen
 * fertig positioniert aus reconcile() und sitzen mittig in der Schlange.
 */
import { useScopeColors } from "./lib/useScopeColors";
import { SV } from "./lib/mmc.js";

defineProps({
  accent: { type: String, required: true },
  caption: { type: String, default: "" },
  layout: { type: Object, required: true },
  servers: { type: Array, default: () => [] },
  entities: { type: Array, default: () => [] },
  badges: { type: Array, default: () => [] },
  fast: { type: Boolean, default: false },
  bus: { type: Object, default: null }, // {x, y, opacity} — Burst-Bus
  shedTotal: { type: Number, default: 0 }, // ✂️ verworfene Gäste dieser Seite
  waterLeft: { type: Number, default: 0 }, // 🥛 Feature-Shed: verbleibende Wasser-Gäste
});
const C = useScopeColors();
</script>

<template>
  <svg :viewBox="`0 0 ${SV.W} ${SV.H}`" class="stage-svg">
    <text
      x="14"
      y="22"
      :fill="accent"
      style="font-size: 13px; font-weight: 600"
    >
      {{ caption }}
    </text>
    <text
      x="60"
      y="44"
      :fill="C.textLow"
      style="font-size: 12px"
      text-anchor="middle"
    >
      Ankunft
    </text>

    <!-- Queue-Leitlinien -->
    <template v-for="(y, qi) in layout.ys" :key="'q' + qi">
      <line
        v-if="layout.nQueues > 1 || qi === 0"
        x1="96"
        :y1="layout.nQueues === 1 ? layout.qy1 : y"
        :x2="layout.xServer - 34"
        :y2="layout.nQueues === 1 ? layout.qy1 : y"
        :stroke="C.border"
        stroke-width="1.5"
        stroke-dasharray="3 5"
        opacity="0.6"
      />
    </template>

    <!-- Kochstationen + Countdown -->
    <g v-for="(p, i) in layout.serverPos" :key="'s' + i">
      <rect
        :x="p.x - 26"
        :y="p.y - 26"
        width="74"
        height="52"
        rx="7"
        :fill="C.panelHi"
        :stroke="servers[i] && servers[i].busy ? accent : C.border"
      />
      <text
        :x="p.x + 4"
        :y="p.y + 9"
        style="font-size: 26px"
        text-anchor="middle"
      >
        🧑‍🍳
      </text>
      <text
        v-if="fast"
        :x="p.x + 30"
        :y="p.y - 14"
        style="font-size: 15px"
        text-anchor="middle"
      >
        ⚡
      </text>
      <template v-if="servers[i] && servers[i].busy">
        <text
          :x="p.x + 4"
          :y="p.y - 30"
          style="font-size: 20px"
          text-anchor="middle"
        >
          {{ servers[i].food }}
        </text>
        <text
          :x="p.x + 4"
          :y="p.y + 40"
          style="font-size: 11px"
          :fill="accent"
          text-anchor="middle"
          class="sim-mono"
        >
          {{ servers[i].remaining.toFixed(1) }}s
        </text>
      </template>
    </g>

    <!-- Bus (Burst-Ankunft) -->
    <text
      v-if="bus"
      :x="bus.x"
      :y="bus.y"
      style="font-size: 30px"
      text-anchor="middle"
      :style="{ opacity: bus.opacity }"
    >
      🚌
    </text>

    <!-- Gäste -->
    <text
      v-for="e in entities"
      :key="e.id"
      :x="e.x"
      :y="e.y"
      style="font-size: 26px"
      text-anchor="middle"
      :style="{ opacity: e.opacity }"
    >
      {{ e.emoji }}
    </text>

    <!-- Feature-Shed: Wasser-Modus aktiv -->
    <text
      v-if="waterLeft > 0"
      :x="SV.W / 2"
      :y="SV.H - (shedTotal > 0 ? 22 : 6)"
      text-anchor="middle"
      :fill="C.theory"
      style="font-size: 12px"
      class="sim-mono"
    >
      🥛 nur Wasser: noch {{ waterLeft }}
    </text>

    <!-- Shedding-Zähler: verworfene Gäste dieser Seite -->
    <text
      v-if="shedTotal > 0"
      :x="SV.W / 2"
      :y="SV.H - 6"
      text-anchor="middle"
      :fill="C.red"
      style="font-size: 12px"
      class="sim-mono"
    >
      ✂️ verworfen: {{ shedTotal }}
    </text>

    <!-- „+N“-Badges mittig in der Schlange, hervorgehoben -->
    <g v-for="(b, bi) in badges" :key="'b' + bi">
      <rect
        :x="b.x - 20"
        :y="b.y - 13"
        width="40"
        height="26"
        rx="8"
        :fill="accent"
      />
      <text
        :x="b.x"
        :y="b.y + 5"
        text-anchor="middle"
        :fill="C.bg"
        style="font-size: 13px; font-weight: 700"
        class="sim-mono"
      >
        +{{ b.n }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.stage-svg {
  width: 100%;
  height: auto;
  display: block;
}
.sim-mono {
  font-family: var(--slidev-code-font-family);
}
</style>
