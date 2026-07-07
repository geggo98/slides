<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

// Reveal über Slidev-Clicks:  <TokenAccumulation :clicks="$clicks" />
const props = defineProps<{ clicks?: number }>();
const c = computed(() => props.clicks ?? 0);

const { isDark } = useDarkMode();

const MAXV = 21000; // Skalierung der Balken auf die größte Einzel-Iteration
const ROWS = [
  { badge: "Start", desc: "System-Prompt 4.000 + Frage 200", v: 4200 },
  {
    badge: "1",
    desc: "+Denken ~2.000 → Tool-Call → Datei 1 (~5.000)",
    v: 11300,
  },
  {
    badge: "2",
    desc: "+Denken ~2.000 → Tool-Call → Datei 2 (~4.000)",
    v: 17400,
  },
  { badge: "3", desc: "+Denken ~2.000 → Diff ~1.500 → Erfolg ~50", v: 20950 },
];

// clicks 0 → Start sichtbar; 1 → +Zeile 1 … 3 → alle vier; 4 → Summe
const visibleCount = computed(() => Math.min(c.value + 1, ROWS.length));
const showSum = computed(() => c.value >= ROWS.length);

const fmt = (n: number) => n.toLocaleString("de-DE");

const P = computed(() => {
  const d = isDark.value;
  return {
    text: d ? "#e0e0e8" : "#1f2937",
    muted: d ? "#9090a0" : "#6b7280",
    line: d ? "#2a2a35" : "#e5e7eb",
    badgeBg: d ? "#2a2340" : "#ede9fe",
    badgeInk: d ? "#c4b5fd" : "#5b21b6",
    track: d ? "#24242e" : "#f1f5f9",
    barA: d ? "#818cf8" : "#6366f1",
    barB: d ? "#c084fc" : "#a855f7",
    val: d ? "#e0e0e8" : "#1f2937",
    sumBg: d ? "#3a2e12" : "#fffbeb",
    sumB: d ? "#f59e0b" : "#f59e0b",
    sumInk: d ? "#fbbf24" : "#92400e",
    sumText: d ? "#e0e0e8" : "#3f3f46",
  };
});
</script>

<template>
  <div class="acc">
    <div
      v-for="(r, i) in ROWS"
      :key="r.badge"
      class="row"
      :class="{ visible: i < visibleCount }"
    >
      <div class="top">
        <span class="badge">{{ r.badge }}</span>
        <span class="desc">{{ r.desc }}</span>
      </div>
      <div class="bar-line">
        <div class="track">
          <div class="fill" :style="{ width: (r.v / MAXV) * 100 + '%' }" />
        </div>
        <span class="val">{{ fmt(r.v) }}</span>
      </div>
    </div>

    <div class="sum" :class="{ visible: showSum }">
      <div class="sum-num">≈ 55.000–60.000 Input-Tokens</div>
      <div class="sum-cap">
        + einige Tausend Output — <b>für nur zwei gelesene Dateien</b>, weil
        jede Iteration den vollen Context erneut mitschickt. →
        <b>Token-Budget ist die echte Constraint</b> (Kernaussage&nbsp;#2).
      </div>
    </div>
  </div>
</template>

<style scoped>
.acc {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: v-bind("P.text");
  max-width: 900px;
}
.row {
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.row.visible {
  opacity: 1;
  transform: none;
}
.top {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 5px;
}
.badge {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: v-bind("P.badgeBg");
  color: v-bind("P.badgeInk");
  min-width: 46px;
  text-align: center;
}
.desc {
  font-size: 14px;
  color: v-bind("P.text");
}
.bar-line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.track {
  flex: 1;
  height: 22px;
  background: v-bind("P.track");
  border-radius: 5px;
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, v-bind("P.barA"), v-bind("P.barB"));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.55s ease 0.1s;
}
.row.visible .fill {
  transform: scaleX(1);
}
.val {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  color: v-bind("P.val");
  min-width: 68px;
  text-align: right;
}
.sum {
  margin-top: 4px;
  padding: 12px 16px;
  border: 1.5px solid v-bind("P.sumB");
  border-radius: 10px;
  background: v-bind("P.sumBg");
  opacity: 0;
  transform: scale(0.97);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.sum.visible {
  opacity: 1;
  transform: none;
}
.sum-num {
  font-size: 20px;
  font-weight: 800;
  color: v-bind("P.sumInk");
}
.sum-cap {
  font-size: 13px;
  color: v-bind("P.sumText");
  line-height: 1.45;
  margin-top: 4px;
}
.sum-cap b {
  color: v-bind("P.text");
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
