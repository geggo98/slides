<!--
  Agent-Lauf-Simulator: scripted Terminal-Replay des stündlichen Ticket-Test-
  Laufs, live umschaltbar zwischen Claude Code und Codex CLI. Zwei Views:
  "overview" (Hauptagent, 3 Tickets als Workflows) und "zoom" (ein Workflow
  von innen). Vendor-Wahl und Token-Zähler sind modul-global geteilt und
  überleben den Folienwechsel.
-->
<script setup lang="ts">
import { useIsSlideActive } from "@slidev/client";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { usePrefersReducedMotion } from "@shared/components/brainless/lib/usePrefersReducedMotion";
import AgentRunEvent from "./AgentRunEvent.vue";
import { SUBAGENT_COUNT, TOKEN_LABELS } from "./agentRunScript";
import {
  activeView,
  formatTokens,
  multiplierRevealed,
  playing,
  resetRun,
  stepRefFor,
  stepsFor,
  totals,
  vendor,
} from "./agentRunState";

const props = defineProps<{ view: "overview" | "zoom" }>();

const steps = stepsFor(props.view);
const stepCount = stepRefFor(props.view);
const isActive = useIsSlideActive();
const prefersReduced = usePrefersReducedMotion();

const pane = ref<HTMLElement>();

const events = computed(() =>
  steps.slice(0, stepCount.value).flatMap((s) => s[vendor.value]),
);
const lastEventIndex = computed(() => events.value.length - 1);
const atEnd = computed(() => stepCount.value >= steps.length);
const currentNote = computed(() => {
  for (let i = Math.min(stepCount.value, steps.length) - 1; i >= 0; i--) {
    if (steps[i].note) return steps[i].note;
  }
  return "";
});

let timer: ReturnType<typeof setTimeout> | undefined;
function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}
function scheduleNext() {
  clearTimer();
  if (!playing.value || !isActive.value) return;
  if (atEnd.value) {
    playing.value = false;
    return;
  }
  const dwell = steps[stepCount.value - 1]?.dwellMs ?? 2000;
  timer = setTimeout(() => {
    stepCount.value = Math.min(stepCount.value + 1, steps.length);
    scheduleNext();
  }, dwell);
}

function onPlay() {
  if (prefersReduced.value) {
    stepForward();
    return;
  }
  if (!playing.value && atEnd.value) resetRun(props.view);
  playing.value = !playing.value;
}
function stepForward() {
  playing.value = false;
  stepCount.value = Math.min(stepCount.value + 1, steps.length);
}
function stepBack() {
  playing.value = false;
  stepCount.value = Math.max(stepCount.value - 1, 1);
}
function restart() {
  resetRun(props.view);
}

watch(playing, (p) => (p && isActive.value ? scheduleNext() : clearTimer()));
watch(
  isActive,
  (active) => {
    clearTimer();
    if (active) {
      // immediate: auch bei Deep-Link direkt auf die Zoom-Folie muss
      // activeView stimmen (sonst zählt die Übersicht nicht als komplett).
      activeView.value = props.view;
      scheduleNext();
    } else if (activeView.value === props.view) {
      playing.value = false;
    }
  },
  { immediate: true },
);
onUnmounted(clearTimer);

// Alter Text scrollt aktiv weg: Das Pane hält immer die jüngsten Zeilen
// sichtbar (nextTick + rAF, damit Layout und Folien-Transition fertig sind).
watch([() => events.value.length, vendor, isActive], async () => {
  await nextTick();
  requestAnimationFrame(() => {
    if (pane.value) pane.value.scrollTop = pane.value.scrollHeight;
  });
});
</script>

<template>
  <div class="sim-root">
    <div class="sim-main">
      <div class="sim-controls">
        <div class="sim-toggle" role="group" aria-label="Anbieter umschalten">
          <button
            type="button"
            class="sim-toggle-btn sim-toggle-btn--claude"
            :class="{ 'sim-toggle-btn--on': vendor === 'claude' }"
            @click="vendor = 'claude'"
          >
            Claude Code
          </button>
          <button
            type="button"
            class="sim-toggle-btn sim-toggle-btn--codex"
            :class="{ 'sim-toggle-btn--on': vendor === 'codex' }"
            @click="vendor = 'codex'"
          >
            Codex CLI
          </button>
        </div>
        <div class="sim-transport">
          <button
            type="button"
            class="sim-btn"
            aria-label="Neustart"
            title="Neustart"
            @click="restart"
          >
            ↻
          </button>
          <button
            type="button"
            class="sim-btn"
            aria-label="Schritt zurück"
            title="Schritt zurück"
            :disabled="stepCount <= 1"
            @click="stepBack"
          >
            ◀
          </button>
          <button
            type="button"
            class="sim-btn sim-btn--play"
            :aria-label="playing ? 'Pause' : 'Abspielen'"
            :title="playing ? 'Pause' : 'Abspielen'"
            @click="onPlay"
          >
            {{ playing ? "⏸" : "▶" }}
          </button>
          <button
            type="button"
            class="sim-btn"
            aria-label="Schritt vor"
            title="Schritt vor"
            :disabled="atEnd"
            @click="stepForward"
          >
            ⏭
          </button>
          <span class="sim-progress">{{ stepCount }}/{{ steps.length }}</span>
        </div>
      </div>

      <div ref="pane" class="sim-pane">
        <AgentRunEvent
          v-for="(ev, i) in events"
          :key="`${vendor}-${i}`"
          :event="ev"
          :vendor="vendor"
          :running="i === lastEventIndex && isActive"
        />
      </div>
    </div>

    <aside class="sim-side" aria-label="Token-Zähler">
      <div class="sim-note">{{ currentNote }}</div>
      <div class="sim-tile">
        <div class="sim-tile-label">
          Hauptagent · {{ TOKEN_LABELS[vendor].main }}
        </div>
        <div class="sim-tile-value">{{ formatTokens(totals.main) }}</div>
      </div>
      <div class="sim-tile">
        <div class="sim-tile-label">
          Subagents ({{ SUBAGENT_COUNT }}×) · {{ TOKEN_LABELS[vendor].sub }}
        </div>
        <div class="sim-tile-value">{{ formatTokens(totals.sub) }}</div>
      </div>
      <div v-if="view === 'zoom'" class="sim-tile sim-tile--wf">
        <div class="sim-tile-label">Dieser Workflow · PROJ-1043</div>
        <div class="sim-tile-value">{{ formatTokens(totals.workflow) }}</div>
      </div>
      <div v-if="multiplierRevealed" class="sim-mult">
        <strong>×{{ SUBAGENT_COUNT }} Subagent-Multiplikator</strong> — jedes
        isolierte Kontextfenster liest Runbook-Modul + Ticket neu
      </div>
      <div class="sim-footnote">
        Token grob geschätzt — Messwerte aus echtem Lauf folgen
      </div>
    </aside>
  </div>
</template>

<style scoped>
.sim-root {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 236px;
  gap: 10px;
  height: 396px;
  margin-top: 4px;
}
.sim-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 6px;
}
.sim-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.sim-toggle {
  display: inline-flex;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 6px;
  overflow: hidden;
}
.sim-toggle-btn {
  font-size: 0.72rem;
  padding: 3px 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.55;
}
.sim-toggle-btn--on {
  opacity: 1;
  font-weight: 600;
  background: var(--color-background-secondary);
}
.sim-toggle-btn--claude.sim-toggle-btn--on {
  box-shadow: inset 0 -2px 0 #cd694a;
}
.sim-toggle-btn--codex.sim-toggle-btn--on {
  box-shadow: inset 0 -2px 0 #5cc2e0;
}
.sim-transport {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sim-btn {
  font-size: 0.72rem;
  line-height: 1;
  padding: 4px 8px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 5px;
  background: var(--color-background-secondary);
  color: inherit;
  cursor: pointer;
}
.sim-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.sim-btn--play {
  font-weight: 700;
  padding-inline: 12px;
}
.sim-progress {
  font-size: 0.68rem;
  opacity: 0.6;
  min-width: 2.8em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* Terminal-Pane: bewusst in BEIDEN Themes dunkel — ein Terminal ist dunkel. */
.sim-pane {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 8px 12px 10px;
}
.sim-side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.sim-note {
  font-size: 0.7rem;
  line-height: 1.35;
  min-height: 2.7em;
  opacity: 0.85;
  font-style: italic;
}
.sim-tile {
  border: 0.5px solid var(--color-border-tertiary);
  background: var(--color-background-secondary);
  border-radius: 6px;
  padding: 6px 10px;
}
.sim-tile--wf {
  border-left: 3px solid #7dcfff;
}
.sim-tile-label {
  font-size: 0.62rem;
  opacity: 0.7;
  line-height: 1.3;
}
.sim-tile-value {
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s;
}
.sim-mult {
  border-left: 3px solid #cd694a;
  background: var(--color-background-info);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 0.68rem;
  line-height: 1.4;
}
.sim-footnote {
  margin-top: auto;
  font-size: 0.62rem;
  opacity: 0.55;
}
</style>
