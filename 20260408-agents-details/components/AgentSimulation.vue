<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useDarkMode, useNav, useSlideContext } from "@slidev/client";
import { NODES, EDGES, STEPS, DETAILS, getCatColors } from "./simulationData";
import type { SimNode } from "./simulationData";

const { isDark } = useDarkMode();
const nav = useNav();
// $page ist die Slide-Nummer DIESER Komponente; nav.currentPage die aktive.
// Nachbar-Slides bleiben gemountet, daher muss der globale keydown-Handler
// prüfen, ob diese Slide gerade sichtbar ist — sonst kapert Space/Pfeil die
// Slidev-Navigation auf anderen Folien.
const { $page } = useSlideContext();

const currentStep = ref(0);
const isPlaying = ref(false);
const panelMode = ref<"step" | "node">("step");
const selectedNode = ref<string | null>(null);
let playTimer: ReturnType<typeof setInterval> | null = null;

const step = computed(() => STEPS[currentStep.value]);
const catColors = computed(() => getCatColors(isDark.value));

const P = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#14141c" : "#ffffff",
    svgBg: d ? "#0d0d14" : "#f9fafb",
    border: d ? "#2a2a35" : "#e4e4e7",
    text: d ? "#e0e0e8" : "#18181b",
    textSub: d ? "#9090a0" : "#71717a",
    edgeColor: d ? "#2a2a3a" : "#d4d4d8",
    edgeLabelColor: d ? "#6a6a80" : "#a1a1aa",
    accentColor: d ? "#a78bfa" : "#7c3aed",
    panelBg: d ? "#14141c" : "#ffffff",
    panelText: d ? "#c8c8d0" : "#3f3f46",
    btnBg: d ? "#2a2a3a" : "#e4e4e7",
    btnBorder: d ? "#3a3a4a" : "#d4d4d8",
    btnText: d ? "#e8e8f0" : "#18181b",
    btnPrimaryBg: d ? "#6d28d9" : "#7c3aed",
    progressBg: d ? "#2a2a3a" : "#e4e4e7",
    badgeBg: d ? "#2a2a3a" : "#ede9fe",
    badgeText: d ? "#a78bfa" : "#7c3aed",
    hintColor: d ? "#6a6a80" : "#a1a1aa",
    nodeFill: d ? "#1e1e2a" : "#f4f4f5",
    nodeStroke: d ? "#3a3a4a" : "#d4d4d8",
  };
});

function center(n: SimNode) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function edgePoints(fromId: string, toId: string) {
  const from = NODES[fromId];
  const to = NODES[toId];
  const c1 = center(from);
  const c2 = center(to);
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  let p1, p2;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      p1 = { x: from.x + from.w, y: c1.y };
      p2 = { x: to.x, y: c2.y };
    } else {
      p1 = { x: from.x, y: c1.y };
      p2 = { x: to.x + to.w, y: c2.y };
    }
  } else {
    if (dy > 0) {
      p1 = { x: c1.x, y: from.y + from.h };
      p2 = { x: c2.x, y: to.y };
    } else {
      p1 = { x: c1.x, y: from.y };
      p2 = { x: c2.x, y: to.y + to.h };
    }
  }
  return { p1, p2 };
}

function isNodeActive(id: string) {
  return step.value.nodes.includes(id);
}

function isEdgeActive(edgeId: string) {
  return step.value.edges.includes(edgeId);
}

function nodeClass(id: string) {
  const cat = NODES[id].cat;
  return {
    active: isNodeActive(id),
    [`cat-${cat}`]: true,
  };
}

function nodeFill(id: string) {
  const cat = NODES[id].cat as keyof ReturnType<typeof getCatColors>;
  return catColors.value[cat]?.fill ?? P.value.nodeFill;
}

function nodeStroke(id: string) {
  const cat = NODES[id].cat as keyof ReturnType<typeof getCatColors>;
  return catColors.value[cat]?.stroke ?? P.value.nodeStroke;
}

function edgeLabelPos(e: { from: string; to: string }) {
  const { p1, p2 } = edgePoints(e.from, e.to);
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 - 5 };
}

function selectNode(id: string) {
  panelMode.value = "node";
  selectedNode.value = id;
}

function backToStep() {
  panelMode.value = "step";
  selectedNode.value = null;
}

function next() {
  if (currentStep.value < STEPS.length - 1) {
    currentStep.value++;
    panelMode.value = "step";
  } else {
    stop();
  }
}

function prev() {
  if (currentStep.value > 0) {
    currentStep.value--;
    panelMode.value = "step";
  }
}

function stop() {
  isPlaying.value = false;
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

function play() {
  if (currentStep.value === STEPS.length - 1) currentStep.value = 0;
  isPlaying.value = true;
  playTimer = setInterval(() => {
    if (currentStep.value < STEPS.length - 1) {
      currentStep.value++;
      panelMode.value = "step";
    } else {
      stop();
    }
  }, 2800);
}

function togglePlay() {
  if (isPlaying.value) stop();
  else play();
}

function reset() {
  stop();
  currentStep.value = 0;
  panelMode.value = "step";
}

function onKeydown(e: KeyboardEvent) {
  // Nur reagieren, wenn DIESE Slide aktiv ist — sonst hijackt der globale
  // Listener Space/Pfeiltasten auf den Nachbar-Folien.
  if (nav.currentPage.value !== $page.value) return;
  if (e.key === "ArrowRight") {
    stop();
    next();
  } else if (e.key === "ArrowLeft") {
    stop();
    prev();
  } else if (e.key === " ") {
    e.preventDefault();
    togglePlay();
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  stop();
  document.removeEventListener("keydown", onKeydown);
});

const progressWidth = computed(
  () => ((currentStep.value + 1) / STEPS.length) * 100 + "%",
);

const panelDetail = computed(() => {
  if (panelMode.value === "node" && selectedNode.value) {
    return DETAILS[selectedNode.value] ?? null;
  }
  return null;
});

const involvedNodes = computed(() =>
  step.value.nodes.map((id) => ({
    id,
    label: NODES[id].label,
    cat: NODES[id].cat,
  })),
);

const legendItems = [
  { cat: "person", label: "Person" },
  { cat: "client", label: "IDE / ACP" },
  { cat: "harness", label: "Harness" },
  { cat: "memory", label: "Files / Memory" },
  { cat: "tool", label: "Tools" },
  { cat: "infra", label: "Auth / API" },
  { cat: "model", label: "Modell-Backend" },
];
</script>

<template>
  <div class="sim-container">
    <div class="stage">
      <div class="step-header">
        <span class="step-num"
          >Schritt {{ currentStep + 1 }} / {{ STEPS.length }}</span
        >
        <span class="step-title">{{ step.title }}</span>
      </div>
      <p class="step-desc">{{ step.desc }}</p>

      <div class="controls">
        <button
          :disabled="currentStep === 0"
          @click="
            stop();
            prev();
          "
        >
          ◀
        </button>
        <button class="primary" @click="togglePlay">
          {{ isPlaying ? "⏸" : "▶" }}
        </button>
        <button
          :disabled="currentStep === STEPS.length - 1"
          @click="
            stop();
            next();
          "
        >
          ▶
        </button>
        <button @click="reset">↻</button>
        <div class="progress"><div :style="{ width: progressWidth }" /></div>
        <div class="legend">
          <span v-for="item in legendItems" :key="item.cat" class="legend-item">
            <span
              class="legend-dot"
              :style="{
                borderColor:
                  catColors[item.cat as keyof typeof catColors]?.stroke,
              }"
            />
            {{ item.label }}
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid meet"
        class="diagram"
      >
        <!-- Edges -->
        <line
          v-for="e in EDGES"
          :key="e.id"
          :x1="edgePoints(e.from, e.to).p1.x"
          :y1="edgePoints(e.from, e.to).p1.y"
          :x2="edgePoints(e.from, e.to).p2.x"
          :y2="edgePoints(e.from, e.to).p2.y"
          :class="[
            'edge',
            {
              active: isEdgeActive(e.id),
              reverse: step.reverse && isEdgeActive(e.id),
            },
          ]"
        />
        <!-- Edge labels -->
        <template v-for="e in EDGES" :key="'lbl-' + e.id">
          <text
            v-if="e.label"
            :x="edgeLabelPos(e).x"
            :y="edgeLabelPos(e).y"
            :class="['edge-label', { active: isEdgeActive(e.id) }]"
          >
            {{ e.label }}
          </text>
        </template>
        <!-- Nodes -->
        <g
          v-for="(n, id) in NODES"
          :key="id"
          :class="['node', nodeClass(id as string)]"
          @click="selectNode(id as string)"
        >
          <rect
            :x="n.x"
            :y="n.y"
            :width="n.w"
            :height="n.h"
            rx="6"
            :fill="nodeFill(id as string)"
            :stroke="nodeStroke(id as string)"
            :stroke-width="isNodeActive(id as string) ? 3 : 2"
          />
          <text
            v-if="n.sub"
            :x="n.x + n.w / 2"
            :y="n.y + n.h / 2 - 2"
            class="node-label"
          >
            {{ n.label }}
          </text>
          <text
            v-if="n.sub"
            :x="n.x + n.w / 2"
            :y="n.y + n.h / 2 + 12"
            class="node-sub"
          >
            {{ n.sub }}
          </text>
          <text
            v-if="!n.sub"
            :x="n.x + n.w / 2"
            :y="n.y + n.h / 2 + 4"
            class="node-label"
          >
            {{ n.label }}
          </text>
        </g>
      </svg>
    </div>

    <div class="panel">
      <template v-if="panelMode === 'node' && panelDetail">
        <span class="back" @click="backToStep">← Zurück</span>
        <span class="badge">Komponente</span>
        <h3>{{ panelDetail.title }}</h3>
        <pre class="body">{{ panelDetail.body }}</pre>
      </template>
      <template v-else>
        <span class="badge">Schritt {{ currentStep + 1 }}</span>
        <h3>{{ step.title }}</h3>
        <p class="body">{{ step.desc }}</p>
        <div class="section-title">Beteiligte Komponenten</div>
        <div class="chips">
          <span
            v-for="n in involvedNodes"
            :key="n.id"
            class="chip"
            :style="{
              borderColor: catColors[n.cat as keyof typeof catColors]?.stroke,
              color: catColors[n.cat as keyof typeof catColors]?.stroke,
            }"
            @click="selectNode(n.id)"
            >{{ n.label }}</span
          >
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sim-container {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 10px;
  height: 100%;
}
.stage {
  display: flex;
  flex-direction: column;
}
.step-header {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 4px;
}
.step-num {
  font-size: 10px;
  color: v-bind("P.accentColor");
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.step-title {
  font-size: 15px;
  font-weight: 600;
  color: v-bind("P.text");
}
.step-desc {
  font-size: 11px;
  color: v-bind("P.textSub");
  line-height: 1.5;
  margin: 0 0 6px 0;
  min-height: 32px;
}
.diagram {
  flex: 1;
  min-height: 0;
  background: v-bind("P.svgBg");
  border-radius: 6px;
  border: 1px solid v-bind("P.border");
}

/* Edges */
.edge {
  stroke: v-bind("P.edgeColor");
  stroke-width: 1.5;
  fill: none;
  transition: stroke 0.3s;
}
.edge.active {
  stroke: v-bind("P.accentColor");
  stroke-width: 2.5;
  stroke-dasharray: 8 4;
  animation: flow 1s linear infinite;
}
.edge.active.reverse {
  animation: flow-rev 1s linear infinite;
}
@keyframes flow {
  to {
    stroke-dashoffset: -12;
  }
}
@keyframes flow-rev {
  to {
    stroke-dashoffset: 12;
  }
}

.edge-label {
  fill: v-bind("P.edgeLabelColor");
  font-size: 9px;
  text-anchor: middle;
  pointer-events: none;
}
.edge-label.active {
  fill: v-bind("P.accentColor");
  font-weight: 600;
}

/* Nodes */
.node {
  cursor: pointer;
}
.node rect {
  transition: all 0.3s;
}
.node:hover rect {
  filter: brightness(1.15);
}
.node.active rect {
  filter: drop-shadow(0 0 6px var(--glow-color, #a78bfa));
}
.node-label {
  fill: v-bind("P.text");
  font-size: 12px;
  text-anchor: middle;
  font-weight: 500;
  pointer-events: none;
}
.node-sub {
  fill: v-bind("P.textSub");
  font-size: 9.5px;
  text-anchor: middle;
  pointer-events: none;
}

/* Controls */
.controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
.controls button {
  background: v-bind("P.btnBg");
  border: 1px solid v-bind("P.btnBorder");
  color: v-bind("P.btnText");
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}
.controls button:hover:not(:disabled) {
  filter: brightness(1.15);
}
.controls button.primary {
  background: v-bind("P.btnPrimaryBg");
  border-color: v-bind("P.btnPrimaryBg");
  color: #fff;
}
.controls button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.progress {
  flex: 1;
  height: 5px;
  background: v-bind("P.progressBg");
  border-radius: 3px;
  overflow: hidden;
}
.progress > div {
  height: 100%;
  background: linear-gradient(90deg, #a78bfa, #c084fc);
  transition: width 0.4s;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 9px;
  color: v-bind("P.hintColor");
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  border: 1.5px solid;
  display: inline-block;
}

/* Panel */
.panel {
  background: v-bind("P.panelBg");
  border: 1px solid v-bind("P.border");
  border-radius: 8px;
  padding: 12px;
  overflow-y: auto;
  max-height: 100%;
}
.panel h3 {
  margin: 6px 0 8px 0;
  font-size: 14px;
  color: v-bind("P.text");
}
.panel .body {
  font-size: 11px;
  line-height: 1.6;
  color: v-bind("P.panelText");
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  font-family: inherit;
}
pre.body {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10px;
}
.badge {
  display: inline-block;
  background: v-bind("P.badgeBg");
  color: v-bind("P.badgeText");
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.back {
  font-size: 11px;
  color: v-bind("P.hintColor");
  cursor: pointer;
  display: block;
  margin-bottom: 8px;
}
.back:hover {
  color: v-bind("P.accentColor");
}
.section-title {
  font-size: 9px;
  color: v-bind("P.hintColor");
  margin: 12px 0 6px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 10px;
  background: v-bind("P.svgBg");
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s;
}
.chip:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
}
</style>
