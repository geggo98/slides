<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";
import ClinejectionThwartedCard from "./ClinejectionThwartedCard.vue";
import { TIMELINE, THWARTED } from "./data";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    textPrimary: d ? "#e5e5e5" : "#1a1a18",
    textSecondary: d ? "#aaa" : "#555",
    textTertiary: d ? "#666" : "#888",
    textDanger: d ? "#f06060" : "#c04040",
    textSuccess: d ? "#5cc0a0" : "#308060",
    textWarning: d ? "#e0a030" : "#a07020",
    textInfo: d ? "#7c9fff" : "#4a6fd0",
    bgPrimary: d ? "#1e1e1e" : "white",
    bgSecondary: d ? "#2a2a2e" : "#f5f5f5",
    borderTertiary: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    bgAttack: d ? "rgba(240,96,96,0.06)" : "rgba(192,64,64,0.04)",
    bgDefense: d ? "rgba(92,192,160,0.06)" : "rgba(48,128,96,0.04)",
    bgFail: d ? "rgba(224,160,48,0.06)" : "rgba(160,112,32,0.04)",
    bgVuln: d ? "rgba(124,159,255,0.06)" : "rgba(74,111,208,0.04)",
    fontSans: "'DM Sans', sans-serif",
    fontMono: "'Fira Code', 'JetBrains Mono', monospace",
  };
});

const activeThwarted = ref(null);

function toggleThwarted(id) {
  activeThwarted.value = activeThwarted.value === id ? null : id;
}

function dotColor(type) {
  const map = {
    attack: "textDanger",
    defense: "textSuccess",
    fail: "textWarning",
    vuln: "textInfo",
  };
  return P.value[map[type] || "textTertiary"];
}

function itemBg(type) {
  const map = {
    attack: "bgAttack",
    defense: "bgDefense",
    fail: "bgFail",
    vuln: "bgVuln",
  };
  return P.value[map[type] || "bgSecondary"];
}
</script>

<template>
  <div class="timeline-slide">
    <div class="section-label">Timeline</div>
    <div class="timeline-bar">
      <div
        v-for="(t, i) in TIMELINE"
        :key="i"
        class="timeline-item"
        :style="{ background: itemBg(t.type) }"
      >
        <div
          class="dot"
          :style="{
            background: dotColor(t.type),
            boxShadow: `0 0 4px ${dotColor(t.type)}`,
          }"
        />
        <div class="tl-date">{{ t.date }}</div>
        <div class="tl-event">{{ t.event }}</div>
      </div>
    </div>
    <div class="legend">
      <span
        ><span class="legend-dot" :style="{ background: P.textDanger }" />
        Angriff</span
      >
      <span
        ><span class="legend-dot" :style="{ background: P.textSuccess }" />
        Verteidigung</span
      >
      <span
        ><span class="legend-dot" :style="{ background: P.textWarning }" />
        Fehlgeschlagen</span
      >
      <span
        ><span class="legend-dot" :style="{ background: P.textInfo }" />
        Schwachstelle</span
      >
    </div>

    <div class="section-label thwarted-label">Vereitelte Eskalation</div>
    <p class="thwarted-intro">
      Der Angreifer besa&szlig; zeitweise Zugang zu allen drei Publish-Tokens.
      Nur rechtzeitige Rotation und schnelle Erkennung verhinderten eine
      Eskalation um Gr&ouml;&szlig;enordnungen.
    </p>
    <div class="thwarted-grid">
      <ClinejectionThwartedCard
        v-for="t in THWARTED"
        :key="t.id"
        :item="t"
        :active="activeThwarted === t.id"
        @toggle="toggleThwarted"
      />
    </div>
  </div>
</template>

<style scoped>
.timeline-slide {
  font-family: v-bind("P.fontSans");
  max-height: 430px;
  overflow-y: auto;
}
.section-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: v-bind("P.textTertiary");
  margin-bottom: 6px;
}
.thwarted-label {
  margin-top: 14px;
  color: v-bind("P.textSuccess");
}
.thwarted-intro {
  font-size: 9px;
  color: v-bind("P.textSecondary");
  line-height: 1.4;
  margin-bottom: 6px;
}
.timeline-bar {
  display: flex;
  align-items: stretch;
  gap: 0;
  border: 1px solid v-bind("P.borderTertiary");
  border-radius: 8px;
  overflow: hidden;
  overflow-x: auto;
}
.timeline-item {
  flex: 1;
  min-width: 80px;
  padding: 6px 6px;
  border-right: 1px solid v-bind("P.borderTertiary");
  font-size: 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.timeline-item:last-child {
  border-right: none;
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tl-date {
  font-weight: 600;
  color: v-bind("P.textSecondary");
  font-size: 8px;
  font-family: v-bind("P.fontMono");
}
.tl-event {
  color: v-bind("P.textTertiary");
  line-height: 1.3;
  font-size: 8px;
}
.legend {
  display: flex;
  gap: 10px;
  margin-top: 5px;
  font-size: 8px;
  color: v-bind("P.textTertiary");
}
.legend-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 2px;
  vertical-align: middle;
}
.thwarted-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
</style>
