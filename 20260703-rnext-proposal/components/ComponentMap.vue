<script lang="ts">
import { ref } from "vue";

// Modul-Scope (läuft einmal, nicht pro Instanz): Zähler für dokumentweit
// eindeutige SVG-Def-IDs über alle gemounteten Map-Instanzen hinweg.
let instanceCounter = 0;

// Geteiltes Kamera-Gedächtnis: EIN Fokus-Zustand für ALLE Map-Instanzen.
// Lebt im Modul-Scope, überlebt also Folienwechsel — jede Karten-Folie zeigt
// beim Aktivwerden noch den Endzustand der vorigen und fährt von dort aufs
// Ziel. Nur die aktive Folie ist sichtbar, die geteilte Kamera bleibt also
// unsichtbar, bis eine Folie sie via onSlideEnter bewegt.
const sharedFocus = ref<string>("overview");
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import { onSlideEnter } from "@slidev/client";
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

// SVG-Defs (pattern/marker) brauchen dokumentweit eindeutige IDs: Slidev
// hält Nachbar-Slides gemountet (display:none), und url(#…) löst auf die
// ERSTE ID im Dokument auf — Referenzen in versteckte Instanzen rendern
// als nichts.
const uid = ++instanceCounter;
const hatchId = `cmap-hatch-${uid}`;

// Alle Instanzen teilen sich EINEN Fokus (Modul-Scope) → Kamera-Gedächtnis
// über Folien hinweg. Das Ziel dieser Folie wird beim Eintritt angefahren
// (onSlideEnter), nicht statisch beim Mounten gesetzt.
const focus = sharedFocus;
const root = ref<HTMLElement | null>(null);

// Ziel dieser Folie (verfremdeter Fokus-String); Fallback: Übersicht.
const target = () =>
  props.initialFocus in MAP.targets ? props.initialFocus : "overview";

// Beim Aktivwerden der Folie von der gemerkten (geteilten) Kamera auf das
// Ziel dieser Folie fahren. nextTick + rAF stellt sicher, dass der „Von"-
// Zustand nach dem Slide-Wechsel gerendert ist, damit die CSS-Transition
// (.camera, 700ms) sichtbar losläuft statt zu springen.
onSlideEnter(() => {
  nextTick(() => requestAnimationFrame(() => (sharedFocus.value = target())));
});

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

// Recovery: Ansicht UND geteiltes Gedächtnis auf die Ausgangslage zurück,
// falls die Kamera durch Navigation/Interaktion mal „verrutscht".
function reset() {
  sharedFocus.value = "overview";
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
      <button class="reset" @click.stop="reset()">↺ Reset</button>
    </div>

    <svg
      class="stage"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="Komponenten-Landkarte des RNext-Vorschlags"
    >
      <defs>
        <!-- Diagonal-Schraffur als Nicht-Farb-Kanal für Fehler-Gruppen:
             Grün/Orange/Rot kollabieren unter Rot-Grün-Schwäche (ΔE2000
             teils < 5), daher tragen Prozess (gepunktet), Varianten
             (gestrichelt) und Fehler (Schraffur) eigene Muster. -->
        <pattern
          :id="hatchId"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line class="hatch-line" x1="0" y1="0" x2="0" y2="6" />
        </pattern>
      </defs>
      <rect class="bg" :width="W" :height="H" @click.stop="up()" />
      <g class="camera" :style="camStyle">
        <MapEdges :edges="MAP.edges" :level="level" :uid="uid" />
        <template v-for="p in MAP.pillars" :key="p.id">
          <MapPillar
            v-if="inView(p.rect)"
            :pillar="p"
            :level="level"
            :clip-rect="clipRect"
            :hatch-id="hatchId"
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
.quick .reset {
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
.hatch-line {
  stroke: var(--color-border-danger);
  stroke-width: 1.1;
  opacity: 0.45;
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
  border: 1px dotted var(--color-border-warning);
}
.dot.danger {
  background: repeating-linear-gradient(
    45deg,
    var(--color-background-danger),
    var(--color-background-danger) 2px,
    var(--color-border-danger) 2px,
    var(--color-border-danger) 3px
  );
  border: 1px solid var(--color-border-danger);
}
.caption {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
