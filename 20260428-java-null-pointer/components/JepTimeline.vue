<script setup lang="ts">
import { usePalette } from "@shared/composables/usePalette";

// Carbon-Familie des Decks (vgl. shared/quiz/lib/carbonTokens.ts) als exakte
// Overrides — die Migration auf usePalette ist ein visueller No-Op.
const P = usePalette({
  light: {
    bg: "#ffffff",
    track: "#e4e4e7",
    text: "#3f3f46",
    muted: "#71717a",
    accent: "#ea580c",
    nowBg: "rgba(234,88,12,0.10)",
    boxBg: "#f9fafb",
    border: "#e4e4e7",
    blue: "#1d4ed8",
    green: "#16a34a",
    purple: "#7c3aed",
    yellow: "#a16207",
  },
  dark: {
    bg: "#14141c",
    track: "#2a2a35",
    text: "#c8c8d0",
    muted: "#7f7f8c",
    accent: "#fb923c",
    nowBg: "rgba(251,146,60,0.18)",
    boxBg: "#1a1a24",
    border: "#2a2a35",
    blue: "#93c5fd",
    green: "#86efac",
    purple: "#c4b5fd",
    yellow: "#fde68a",
  },
});

type Color = "blue" | "green" | "purple" | "yellow";

const milestones: Array<{
  release: string;
  date: string;
  lts?: boolean;
  current?: boolean;
  events: Array<{ label: string; color: Color }>;
}> = [
  {
    release: "JDK 25",
    date: "Sep 2025",
    lts: true,
    events: [{ label: "Nichts zu Null-Sicherheit", color: "yellow" }],
  },
  {
    release: "JDK 26",
    date: "Mär 2026",
    current: true,
    events: [{ label: "JEP 401 EA-Build", color: "purple" }],
  },
  {
    release: "JDK 27",
    date: "Sep 2026",
    events: [{ label: "JEP 401 noch kein Target", color: "purple" }],
  },
  {
    release: "JDK 28",
    date: "Mär 2027",
    events: [
      { label: "JEP 401 Preview", color: "purple" },
      { label: "JEP 8303099 Preview?", color: "blue" },
    ],
  },
  {
    release: "JDK 29",
    date: "Sep 2027",
    lts: true,
    events: [
      { label: "JEP 401 (preview iter.)", color: "purple" },
      { label: "JEP 8303099 (preview)", color: "blue" },
    ],
  },
  {
    release: "JDK 30",
    date: "Mär 2028",
    events: [{ label: "Stabilisierung möglich", color: "blue" }],
  },
  {
    release: "JDK 33",
    date: "Sep 2029",
    lts: true,
    events: [{ label: "Frühestens stable (nächstes LTS)", color: "green" }],
  },
];
</script>

<template>
  <div class="timeline-root">
    <div class="legend">
      <span class="dot purple" /> JEP 401 (Value Classes)
      <span class="dot blue" /> JEP 8303099 (Null-Restricted Types)
      <span class="dot green" /> Stable <span class="dot yellow" /> Nichts neues
    </div>
    <div class="timeline">
      <div
        v-for="m in milestones"
        :key="m.release"
        class="step"
        :class="{ now: m.current, lts: m.lts }"
      >
        <div class="release">
          {{ m.release }}
          <span v-if="m.lts" class="lts-tag">LTS</span>
        </div>
        <div class="date">{{ m.date }}</div>
        <div class="track">
          <div class="dot-now" />
        </div>
        <div class="events">
          <div
            v-for="(e, idx) in m.events"
            :key="idx"
            class="event"
            :class="e.color"
          >
            {{ e.label }}
          </div>
        </div>
      </div>
    </div>
    <div class="footnote">
      LTS: 25 (2025), 29 (2027), 33 (2029) — JDK 31 (2028) ist kein LTS.
      &middot; Quelle: openjdk.org/projects/jdk &middot; Sébastien Deleuze
      (Spring, März 2025): „JSpecify + NullAway sind heute der pragmatische
      Pfad.“
    </div>
  </div>
</template>

<style scoped>
.timeline-root {
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
  border-radius: 12px;
  padding: 18px 18px 14px;
  font-size: 12px;
  color: v-bind("P.text");
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 11px;
  color: v-bind("P.muted");
  margin-bottom: 14px;
}
.legend .dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: -1px;
}
.legend .dot.blue {
  background: v-bind("P.blue");
}
.legend .dot.green {
  background: v-bind("P.green");
}
.legend .dot.purple {
  background: v-bind("P.purple");
}
.legend .dot.yellow {
  background: v-bind("P.yellow");
}

.timeline {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  position: relative;
}
.timeline::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 64px;
  height: 2px;
  background: v-bind("P.track");
  z-index: 0;
}
.step {
  position: relative;
  z-index: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.release {
  font-weight: 700;
  font-size: 13px;
  color: v-bind("P.text");
}
.lts-tag {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  background: v-bind("P.green");
  color: v-bind("P.bg");
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: 1px;
}
.date {
  font-size: 11px;
  color: v-bind("P.muted");
  margin: 2px 0 8px;
}
.track {
  width: 100%;
  height: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.dot-now {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: v-bind("P.track");
  border: 2px solid v-bind("P.bg");
  box-shadow: 0 0 0 2px v-bind("P.track");
}
.step.now .dot-now {
  background: v-bind("P.accent");
  box-shadow:
    0 0 0 2px v-bind("P.accent"),
    0 0 0 6px v-bind("P.nowBg");
}
.events {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.event {
  font-size: 10px;
  padding: 4px 6px;
  border-radius: 4px;
  text-align: center;
  background: v-bind("P.boxBg");
  border: 1px solid v-bind("P.border");
  line-height: 1.25;
}
.event.blue {
  color: v-bind("P.blue");
  border-color: v-bind("P.blue");
}
.event.green {
  color: v-bind("P.green");
  border-color: v-bind("P.green");
}
.event.purple {
  color: v-bind("P.purple");
  border-color: v-bind("P.purple");
}
.event.yellow {
  color: v-bind("P.yellow");
  border-color: v-bind("P.yellow");
}
.footnote {
  margin-top: 14px;
  font-size: 10px;
  color: v-bind("P.muted");
  text-align: center;
}
</style>
