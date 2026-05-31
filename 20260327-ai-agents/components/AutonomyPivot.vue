<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useDarkMode } from "@slidev/client";
import pivot from "./autonomy-pivot.json";

// Daten vollständig aus autonomy-pivot.json (wiederverwendbar):
//   { dimensions:[{key,label,short}], tools:[{key,name,color,cells:{<dim>:{teaser,detail,mark}}}] }
const dims = pivot.dimensions;
const tools = pivot.tools;

const { isDark } = useDarkMode();

const rootEl = ref(null);
const bubbleEl = ref(null);
const anchorEl = ref(null); // aktuell verankerte Zelle
const pinned = ref(null); // {toolKey, dimKey} — per Klick fixiert
const hovered = ref(null); // {toolKey, dimKey} — transient (nur Zeigegeräte)
const canHover = ref(false);

const W = 290; // logische Breite der Sprechblase
const GAP = 8; // logischer Abstand Zelle ↔ Blase
const bubble = ref({
  left: 0,
  top: 0,
  caret: 24,
  placement: "below",
  ready: false,
});

const shown = computed(() => pinned.value ?? hovered.value);
const shownDetail = computed(() => {
  const s = shown.value;
  if (!s) return null;
  const tool = tools.find((t) => t.key === s.toolKey);
  const dim = dims.find((d) => d.key === s.dimKey);
  const cell = tool?.cells?.[s.dimKey];
  if (!tool || !dim || !cell) return null;
  return {
    tool: tool.name,
    dim: dim.label,
    detail: cell.detail,
    color: tool.color || accent.value,
  };
});

function hasDetail(cell) {
  return !!(cell && cell.detail && cell.detail.trim());
}

// Slidev skaliert die Slide per CSS-Transform. getBoundingClientRect() liefert
// reale (skalierte) Pixel, offsetWidth die logischen. Wir rechnen alles in
// LOGISCHE Koordinaten relativ zum Container um — sonst driftet die Blase.
function position() {
  const root = rootEl.value;
  const bub = bubbleEl.value;
  const cell = anchorEl.value;
  if (!root || !bub || !cell) return;

  const cr = root.getBoundingClientRect();
  const scale = cr.width / root.offsetWidth || 1;
  const rr = cell.getBoundingClientRect();
  const pad = 6;

  const contW = root.offsetWidth; // logisch
  const cellLeft = (rr.left - cr.left) / scale;
  const cellTop = (rr.top - cr.top) / scale;
  const cellW = rr.width / scale;
  const cellH = rr.height / scale;
  const w = Math.min(W, contW - 2 * pad);
  const bubH = bub.offsetHeight; // logisch

  // horizontal: an Zellmitte zentriert, in den Container geklemmt
  let left = cellLeft + cellW / 2 - w / 2;
  left = Math.max(pad, Math.min(left, contW - w - pad));

  // vertikal: "unten" bevorzugen; nur kippen, wenn real kein Platz ist
  const vh = window.innerHeight;
  const bubHReal = bubH * scale;
  const fitsBelow = vh - rr.bottom >= bubHReal + GAP * scale + 4;
  const placement = fitsBelow || vh - rr.bottom >= rr.top ? "below" : "above";
  let top =
    placement === "below" ? cellTop + cellH + GAP : cellTop - GAP - bubH;

  // im sichtbaren Canvas halten (reale Grenzen → logisch)
  const minTop = (4 - cr.top) / scale;
  const maxTop = (vh - 4 - bubHReal - cr.top) / scale;
  top = Math.max(minTop, Math.min(top, maxTop));

  // Caret zeigt auf die Zellmitte
  let caret = cellLeft + cellW / 2 - left;
  caret = Math.max(14, Math.min(caret, w - 14));

  bubble.value = { left, top, caret, placement, ready: true, w };
}

function openCell(ev, toolKey, dimKey, cell, pin) {
  if (!hasDetail(cell)) {
    if (pin) pinned.value = null;
    return;
  }
  if (
    pin &&
    pinned.value &&
    pinned.value.toolKey === toolKey &&
    pinned.value.dimKey === dimKey
  ) {
    close();
    return;
  }
  anchorEl.value = ev.currentTarget;
  if (pin) {
    pinned.value = { toolKey, dimKey };
    hovered.value = null;
  } else {
    hovered.value = { toolKey, dimKey };
  }
  bubble.value = { ...bubble.value, ready: false };
  nextTick(position);
}
function onClick(ev, t, d, cell) {
  openCell(ev, t, d, cell, true);
}
function onEnter(ev, t, d, cell) {
  if (!canHover.value || pinned.value) return;
  openCell(ev, t, d, cell, false);
}
function onLeave() {
  if (canHover.value) hovered.value = null;
}
function close() {
  pinned.value = null;
  hovered.value = null;
  anchorEl.value = null;
}
function onDocDown(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) close();
}
function onKey(e) {
  if (e.key === "Escape") close();
}
function onResize() {
  if (shown.value) nextTick(position);
}
onMounted(() => {
  canHover.value =
    window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
  document.addEventListener("mousedown", onDocDown, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
});
onUnmounted(() => {
  document.removeEventListener("mousedown", onDocDown, true);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
});

const MARK = { yes: "✓", no: "✗", partial: "◐", none: "" };
const accent = computed(() => (isDark.value ? "#7c72d0" : "#534AB7"));
const C = computed(() => {
  const d = isDark.value;
  return {
    yes: d ? "#80c050" : "#27500A",
    no: d ? "#f06060" : "#A32D2D",
    partial: d ? "#e0a030" : "#BA7517",
    headBg: d ? "#1a1a1a" : "#f4f4f6",
    rowHeadBg: d ? "#181826" : "#EEEDFE",
    rowHeadColor: d ? "#a5a0e0" : "#3C3489",
    cellBg: d ? "#1e1e1e" : "#ffffff",
    cellColor: d ? "#e5e5e5" : "#1a1a18",
    border: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    hint: d ? "#888" : "#999",
    bubbleBg: d ? "#202028" : "#ffffff",
    bubbleColor: d ? "#e9e9ee" : "#1a1a18",
    bubbleBorder: d ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
    info: d ? "#7c72d0" : "#534AB7",
  };
});
function markColor(m) {
  return m === "yes"
    ? C.value.yes
    : m === "no"
      ? C.value.no
      : m === "partial"
        ? C.value.partial
        : "transparent";
}
</script>

<template>
  <div ref="rootEl" class="pivot">
    <table class="pv">
      <colgroup>
        <col class="col-dim" />
        <col v-for="t in tools" :key="t.key" />
      </colgroup>
      <thead>
        <tr>
          <th class="corner"></th>
          <th v-for="t in tools" :key="t.key" class="tool-head">
            <span class="dot" :style="{ background: t.color || accent }"></span
            >{{ t.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in dims" :key="d.key">
          <th class="dim-head">
            <span class="dim-label">{{ d.label }}</span>
            <span v-if="d.short" class="dim-short">{{ d.short }}</span>
          </th>
          <td
            v-for="t in tools"
            :key="t.key"
            class="cell"
            :class="{
              clickable: hasDetail(t.cells[d.key]),
              active:
                shown && shown.toolKey === t.key && shown.dimKey === d.key,
            }"
            @click="onClick($event, t.key, d.key, t.cells[d.key])"
            @mouseenter="onEnter($event, t.key, d.key, t.cells[d.key])"
            @mouseleave="onLeave"
          >
            <span
              v-if="t.cells[d.key] && t.cells[d.key].mark !== 'none'"
              class="mark"
              :style="{ color: markColor(t.cells[d.key].mark) }"
              >{{ MARK[t.cells[d.key].mark] }}</span
            ><span class="teaser">{{
              t.cells[d.key] ? t.cells[d.key].teaser : "—"
            }}</span
            ><span v-if="hasDetail(t.cells[d.key])" class="info">ⓘ</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="shownDetail"
      ref="bubbleEl"
      class="bubble"
      :class="bubble.placement"
      :style="{
        left: bubble.left + 'px',
        top: bubble.top + 'px',
        width: bubble.w + 'px',
        visibility: bubble.ready ? 'visible' : 'hidden',
      }"
    >
      <span class="caret" :style="{ left: bubble.caret + 'px' }"></span>
      <div class="bub-head" :style="{ color: shownDetail.color }">
        {{ shownDetail.tool }} ·
        <span class="bub-dim">{{ shownDetail.dim }}</span>
        <button class="bub-x" @click="close">×</button>
      </div>
      <div class="bub-body">{{ shownDetail.detail }}</div>
    </div>

    <div class="legend">
      <span><span class="lg" :style="{ color: C.yes }">✓</span> ja / GA</span>
      <span
        ><span class="lg" :style="{ color: C.partial }">◐</span> teilweise /
        Preview</span
      >
      <span
        ><span class="lg" :style="{ color: C.no }">✗</span> nein /
        experimentell</span
      >
      <span class="hint">ⓘ = Klick (oder Hover) für Details</span>
    </div>
  </div>
</template>

<style scoped>
.pivot {
  position: relative;
  overflow: visible;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
}
.pv {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.col-dim {
  width: 15%;
}
.pv th,
.pv td {
  border: 1px solid v-bind("C.border");
  padding: 4px 6px;
  vertical-align: top;
  text-align: left;
  line-height: 1.25;
}
.corner {
  background: v-bind("C.headBg");
  border-top: none;
  border-left: none;
}
.tool-head {
  background: v-bind("C.headBg");
  color: v-bind("C.cellColor");
  font-size: 9.5px;
  font-weight: 700;
}
.tool-head .dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.dim-head {
  background: v-bind("C.rowHeadBg");
  color: v-bind("C.rowHeadColor");
}
.dim-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
}
.dim-short {
  display: block;
  font-size: 7.5px;
  font-weight: 500;
  color: v-bind("C.hint");
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.cell {
  background: v-bind("C.cellBg");
  color: v-bind("C.cellColor");
  font-size: 9px;
}
.cell.clickable {
  cursor: pointer;
}
.cell.clickable:hover {
  filter: brightness(1.08);
}
.cell.active {
  outline: 2px solid v-bind("C.info");
  outline-offset: -2px;
}
.mark {
  font-weight: 700;
  margin-right: 3px;
}
.info {
  margin-left: 3px;
  font-size: 8px;
  color: v-bind("C.info");
  opacity: 0.8;
}
.bubble {
  position: absolute;
  z-index: 50;
  background: v-bind("C.bubbleBg");
  color: v-bind("C.bubbleColor");
  border: 1px solid v-bind("C.bubbleBorder");
  border-radius: 9px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  padding: 8px 10px;
}
.caret {
  position: absolute;
  width: 10px;
  height: 10px;
  background: v-bind("C.bubbleBg");
  border: 1px solid v-bind("C.bubbleBorder");
  transform: rotate(45deg);
  margin-left: -5px;
}
.bubble.below .caret {
  top: -6px;
  border-right: none;
  border-bottom: none;
}
.bubble.above .caret {
  bottom: -6px;
  border-left: none;
  border-top: none;
}
.bub-head {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
  padding-right: 16px;
}
.bub-dim {
  font-weight: 600;
  opacity: 0.85;
}
.bub-x {
  position: absolute;
  top: 4px;
  right: 6px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
}
.bub-x:hover {
  opacity: 1;
}
.bub-body {
  font-size: 10.5px;
  line-height: 1.4;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
  font-size: 8.5px;
  color: v-bind("C.hint");
}
.legend .lg {
  font-weight: 700;
}
.legend .hint {
  margin-left: auto;
}
</style>
