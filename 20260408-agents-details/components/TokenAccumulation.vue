<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

// Reveal über Slidev-Clicks:  <TokenAccumulation :clicks="$clicks" />
const props = defineProps<{ clicks?: number }>();
const c = computed(() => props.clicks ?? 0);

const { isDark } = useDarkMode();

const MAXV = 21000; // Skalierung der Balken auf die größte Einzel-Iteration
// Jede Bar = Input von Request N: gecachter Kontext + Output der Vorrunde
// (Thinking + Tool-Call/Diff, jetzt wieder Input) + neues Tool-Ergebnis.
const ROWS = [
  {
    badge: "Start",
    desc: "System-Prompt 4.000 + Frage 200",
    cached: 0,
    fromOut: 0,
    fresh: 4200,
  },
  {
    badge: "1",
    desc: "+Denken ~2.000 → Tool-Call → Datei 1 (~5.000)",
    cached: 4200,
    fromOut: 2100,
    fresh: 5000,
  },
  {
    badge: "2",
    desc: "+Denken ~2.000 → Tool-Call → Datei 2 (~4.000)",
    cached: 11300,
    fromOut: 2100,
    fresh: 4000,
  },
  {
    badge: "3",
    desc: "+Denken ~2.000 → Diff ~1.500 → Erfolg ~50",
    cached: 17400,
    fromOut: 3500,
    fresh: 50,
  },
];

const total = (r: (typeof ROWS)[number]) => r.cached + r.fromOut + r.fresh;
// Output von Runde i landet als fromOut-Segment in Bar i+1
const outChip = (i: number) => (i < ROWS.length - 1 ? ROWS[i + 1].fromOut : 0);

// clicks 0 → Start; 1–3 → Zeilen 1–3; 4 → Segment-Split + Legende; 5 → Summe+$
const visibleCount = computed(() => Math.min(c.value + 1, ROWS.length));
const showSplit = computed(() => c.value >= 4);
const showSum = computed(() => c.value >= 5);

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
    segCached: d ? "#166534" : "#86efac",
    segOut: d ? "#c084fc" : "#a855f7",
    segNew: d ? "#818cf8" : "#6366f1",
    outInk: d ? "#c4b5fd" : "#7c3aed",
    outBorder: d ? "#4c3a70" : "#ddd6fe",
    outBg: d ? "#2a2340" : "#f5f3ff",
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
        <span v-if="outChip(i)" class="outchip" :class="{ on: showSplit }">
          Output ~{{ fmt(outChip(i)) }} (5×) ⤵
        </span>
      </div>
      <div class="bar-line">
        <div class="track">
          <div
            class="fillwrap"
            :class="{ split: showSplit }"
            :style="{ width: (total(r) / MAXV) * 100 + '%' }"
          >
            <div class="seg seg-cached" :style="{ flexGrow: r.cached }" />
            <div class="seg seg-out" :style="{ flexGrow: r.fromOut }" />
            <div class="seg seg-new" :style="{ flexGrow: r.fresh }" />
          </div>
        </div>
        <span class="val">{{ fmt(total(r)) }}</span>
      </div>
    </div>

    <div class="legend" :class="{ visible: showSplit }">
      <span class="lg"
        ><i class="sw sw-cached" /> Context — Cache-Read (0,1×)</span
      >
      <span class="lg"
        ><i class="sw sw-out" /> Vorrunden-Output → wieder Input (Thinking 🔒
        zählt trotzdem)</span
      >
      <span class="lg"
        ><i class="sw sw-new" /> neuer Input (Prompt, Tool-Ergebnis)</span
      >
    </div>

    <div class="sum" :class="{ visible: showSum }">
      <div class="sum-num">≈ 55.000–60.000 Input- + ~8.000 Output-Tokens</div>
      <div class="sum-cap">
        <b>Für nur zwei gelesene Dateien</b> — jede Runde schickt den vollen
        Context erneut als Input; Thinking & Antwort sind erst Output (5×), ab
        der Folgerunde zusätzlich Input. <b>Sonnet 4.6:</b> Input ≈ $0,17 ·
        Output ≈ $0,12 — mit Cache (→ Kap. 6) schrumpft der Input auf ≈ $0,05,
        <b>der Output bleibt</b>. <b>Token-Budget ist die echte Constraint</b>
        (Kernaussage&nbsp;#2).
      </div>
    </div>
  </div>
</template>

<style scoped>
.acc {
  display: flex;
  flex-direction: column;
  gap: 11px;
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
.outchip {
  margin-left: auto;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid v-bind("P.outBorder");
  background: v-bind("P.outBg");
  color: v-bind("P.outInk");
  opacity: 0;
  transition: opacity 0.35s ease;
}
.outchip.on {
  opacity: 1;
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
.fillwrap {
  height: 100%;
  display: flex;
  border-radius: 5px;
  overflow: hidden;
  background: linear-gradient(90deg, v-bind("P.barA"), v-bind("P.barB"));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.55s ease 0.1s;
}
.row.visible .fillwrap {
  transform: scaleX(1);
}
.seg {
  height: 100%;
  flex-basis: 0;
  background: transparent;
  transition: background-color 0.4s ease;
}
.fillwrap.split .seg-cached {
  background: v-bind("P.segCached");
}
.fillwrap.split .seg-out {
  background: v-bind("P.segOut");
}
.fillwrap.split .seg-new {
  background: v-bind("P.segNew");
}
.val {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  color: v-bind("P.val");
  min-width: 68px;
  text-align: right;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 16px;
  font-size: 11.5px;
  line-height: 1.35;
  color: v-bind("P.muted");
  opacity: 0;
  transition: opacity 0.35s ease;
}
.legend.visible {
  opacity: 1;
}
.sw {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 5px;
  vertical-align: -1px;
}
.sw-cached {
  background: v-bind("P.segCached");
}
.sw-out {
  background: v-bind("P.segOut");
}
.sw-new {
  background: v-bind("P.segNew");
}
.sum {
  margin-top: 2px;
  padding: 10px 16px;
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
  font-size: 18px;
  font-weight: 800;
  color: v-bind("P.sumInk");
}
.sum-cap {
  font-size: 12.5px;
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
