<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { MAP, rectsIntersect, type Rect } from "./componentMapData";
import MapDetailPlate from "./MapDetailPlate.vue";
import MapEdges from "./MapEdges.vue";
import MapPillar from "./MapPillar.vue";

const props = withDefaults(
  defineProps<{
    /** Start-Zoomziel: "overview" | "pillar:<id>" | "detail:<id>". */
    initialFocus?: string;
    showButtons?: boolean;
    caption?: string;
  }>(),
  { initialFocus: "overview", showButtons: true, caption: "" },
);

const focus = ref<string>(
  props.initialFocus in MAP.targets ? props.initialFocus : "overview",
);
const root = ref<HTMLElement | null>(null);

const level = computed(() =>
  focus.value === "overview" ? 1 : focus.value.startsWith("pillar:") ? 2 : 3,
);

const W = 1000;
const H = 430;
const PAD = 14;

const camStyle = computed(() => {
  const r = MAP.targets[focus.value] ?? MAP.world;
  const s = Math.min(W / (r.w + 2 * PAD), H / (r.h + 2 * PAD));
  const tx = W / 2 - s * (r.x + r.w / 2);
  const ty = H / 2 - s * (r.y + r.h / 2);
  return { transform: `translate(${tx}px, ${ty}px) scale(${s})` };
});

// Sichtbarer Welt-Ausschnitt der Kamera. Elemente außerhalb verschwinden
// nach der Kamerafahrt per v-if KOMPLETT aus dem DOM: Off-Camera-SVG-Text
// hätte sonst Text-Rects unterhalb der Slide-Grenze — Range.getClientRects()
// ignoriert bei SVG-<text> sogar display:none auf Vorfahren, der
// Overflow-Check schlüge also trotzdem an. Während der Fahrt
// (settled=false) bleibt alles gerendert, damit die Animation nicht ruckt.
const settled = ref(true);
let settleTimer: ReturnType<typeof setTimeout> | undefined;
watch(focus, () => {
  settled.value = false;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => (settled.value = true), 750);
});

const viewRect = computed<Rect>(() => {
  const r = MAP.targets[focus.value] ?? MAP.world;
  const s = Math.min(W / (r.w + 2 * PAD), H / (r.h + 2 * PAD));
  const halfW = W / 2 / s;
  const halfH = H / 2 / s;
  return {
    x: r.x + r.w / 2 - halfW,
    y: r.y + r.h / 2 - halfH,
    w: 2 * halfW,
    h: 2 * halfH,
  };
});

// null während der Kamerafahrt (alles rendern), danach der Sichtausschnitt.
// Wird bis auf Gruppen-Ebene durchgereicht: auch eine nur ANGESCHNITTENE
// Säule darf keine Texte weit unterhalb des Ausschnitts im DOM behalten.
const clipRect = computed<Rect | null>(() =>
  settled.value ? viewRect.value : null,
);

function inView(r: Rect): boolean {
  return clipRect.value === null || rectsIntersect(r, clipRect.value);
}

function zoomTo(id: string) {
  if (id in MAP.targets) focus.value = id;
}

function up() {
  if (level.value === 3) {
    const plate = MAP.plates.find((p) => p.id === focus.value);
    focus.value = plate ? `pillar:${plate.parent}` : "overview";
  } else if (level.value === 2) {
    focus.value = "overview";
  }
}

// Escape = eine Ebene hoch — aber nur für die sichtbare Instanz: Slidev hält
// Nachbar-Slides gemountet (display:none), deren Karten sollen nicht springen.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const rect = root.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return;
  up();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(settleTimer);
});

const breadcrumb = computed(() => {
  if (level.value === 1) return "Übersicht";
  if (level.value === 2) {
    const p = MAP.pillars.find((p) => `pillar:${p.id}` === focus.value);
    return p ? `Übersicht › ${p.label}` : "Übersicht";
  }
  const plate = MAP.plates.find((p) => p.id === focus.value);
  const parent = MAP.pillars.find((p) => p.id === plate?.parent);
  return plate
    ? `Übersicht › ${parent?.label ?? "?"} › ${plate.title}`
    : "Übersicht";
});
</script>

<template>
  <div ref="root" class="cmap" :data-focus="focus" :data-level="level">
    <div
      v-if="showButtons"
      class="quick"
      role="toolbar"
      aria-label="Schnellwahl"
    >
      <button
        :class="{ active: focus === 'overview' }"
        :aria-pressed="focus === 'overview'"
        @click.stop="zoomTo('overview')"
      >
        Übersicht
      </button>
      <button
        v-for="p in MAP.pillars"
        :key="p.id"
        :class="{ active: focus === `pillar:${p.id}` }"
        :aria-pressed="focus === `pillar:${p.id}`"
        @click.stop="zoomTo(`pillar:${p.id}`)"
      >
        {{ p.short }}
      </button>
      <span class="sep" aria-hidden="true" />
      <button
        v-for="plate in MAP.plates"
        :key="plate.id"
        :class="{ active: focus === plate.id }"
        :aria-pressed="focus === plate.id"
        @click.stop="zoomTo(plate.id)"
      >
        {{ plate.short }}
      </button>
      <button class="back" :disabled="level === 1" @click.stop="up()">
        ← Zurück
      </button>
    </div>

    <svg
      class="stage"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="Komponenten-Landkarte des RNext-Vorschlags"
    >
      <rect class="bg" :width="W" :height="H" @click.stop="up()" />
      <g class="camera" :style="camStyle">
        <MapEdges :edges="MAP.edges" :level="level" />
        <template v-for="p in MAP.pillars" :key="p.id">
          <MapPillar
            v-if="inView(p.rect)"
            :pillar="p"
            :level="level"
            :clip-rect="clipRect"
            @zoom="zoomTo"
          />
        </template>
        <template v-for="plate in MAP.plates" :key="plate.id">
          <MapDetailPlate
            v-if="inView(plate.rect)"
            :plate="plate"
            :active="focus === plate.id"
          />
        </template>
      </g>
    </svg>

    <div class="foot">
      <span class="breadcrumb">{{ breadcrumb }}</span>
      <span class="legend" aria-hidden="true">
        <span class="dot dir-in" /> Eingabe <span class="dot dir-out" /> Ausgabe
        <span class="dot neutral" /> beide
        <span class="dot variant" /> Varianten
        <span class="dot warning" /> Prozess <span class="dot danger" /> Fehler
      </span>
      <span class="hint">Klick = Zoom · Esc/Hintergrund = zurück</span>
    </div>
    <p v-if="caption" class="caption">{{ caption }}</p>
  </div>
</template>

<style scoped>
.cmap {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.quick {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
}
.quick button {
  font-size: 11px;
  line-height: 1;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--color-border-tertiary);
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}
.quick button:hover:not(:disabled) {
  border-color: var(--color-border-primary);
  color: var(--color-text-primary);
}
.quick button.active {
  background: var(--color-background-info);
  border-color: var(--color-border-info);
  color: var(--color-text-info);
  font-weight: 600;
}
.quick button:disabled {
  opacity: 0.35;
  cursor: default;
}
.quick .back {
  margin-left: auto;
}
.sep {
  flex: 0 0 1px;
  align-self: stretch;
  margin: 2px 2px;
  background: var(--color-border-secondary);
}
.stage {
  width: 100%;
  max-height: 355px;
}
.bg {
  fill: transparent;
  cursor: zoom-out;
}
.camera {
  transition: transform 700ms cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: 0 0;
  will-change: transform;
}
.foot {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}
.breadcrumb {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 3px;
  margin-left: 6px;
}
.dot.dir-in {
  background: var(--color-background-info);
  border: 1px solid var(--color-border-info);
}
.dot.dir-out {
  background: var(--color-background-success);
  border: 1px solid var(--color-border-success);
}
.dot.neutral {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
}
.dot.variant {
  background: color-mix(
    in srgb,
    var(--color-background-info) 45%,
    var(--color-background-primary) 55%
  );
  border: 1px dashed var(--color-border-info);
}
.dot.warning {
  background: var(--color-background-warning);
  border: 1px solid var(--color-border-warning);
}
.dot.danger {
  background: var(--color-background-danger);
  border: 1px solid var(--color-border-danger);
}
.caption {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
