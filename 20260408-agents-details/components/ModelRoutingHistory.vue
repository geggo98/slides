<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";
import {
  SNAPSHOTS,
  anchor,
  leader,
  lx,
  ly,
  makeScale,
  movedSegments,
  paretoFront,
  tip,
  type Pt,
} from "./paretoData";

// Dieselbe Achsenlage wie `ModelRoutingPareto.vue`, nur flacher und ohne
// Pfeil-Cluster/Quadranten-Labels — darunter brauchen Timeline und Erklärtext
// Platz. Wurzelklasse bewusst `.mh-chart` statt `.mp-chart`: `verify-deploy.ts`
// findet die Pareto-Folie per `querySelector("svg.mp-chart")` und würde sonst
// hier hängenbleiben.
//
// Klick-Vertrag: `step` kommt aus `$clicks` (Frontmatter `clicks: 6`), 0 = erste
// Station. Ein Klick auf einen Timeline-Punkt übersteuert; der nächste
// Pfeiltastendruck holt die Kontrolle zurück (Muster aus ModelRoutingRoles.vue).
const props = defineProps<{ step?: number }>();

const override = ref<number | null>(null);
watch(
  () => props.step,
  () => {
    override.value = null;
  },
);

const idx = computed(() => {
  const raw = override.value ?? props.step ?? 0;
  return Math.max(0, Math.min(SNAPSHOTS.length - 1, raw));
});
const snap = computed(() => SNAPSHOTS[idx.value]);

const sourcesOpen = ref(false);

const S = makeScale({
  W: 932,
  H: 250,
  L: 46,
  R: 10,
  T: 10,
  B: 30,
  xMax: 25,
  yMax: 80,
});
const { W, H, L, R, T, B, px, py } = S;
const QX = px(8);
const QY = py(50);

const xTicks = [0, 5, 10, 15, 20, 25];
const yTicks = [0, 20, 40, 60, 80];

const split = computed(() => paretoFront(snap.value.pts));
const frontPath = computed(() =>
  split.value.front.map((p) => `${px(p.x)},${py(p.y)}`).join(" "),
);
const moved = computed(() => movedSegments(snap.value.pts, S));

// Beschriftet werden die Front, alles gerade Gewanderte und was `lbl: true`
// ausdrücklich verlangt (die im Erklärtext genannten Modelle) — bei bis zu 25
// Punkten wäre eine Vollbeschriftung auf dieser Höhe unlesbar. Der Rest bleibt
// graues Quadrat mit Tooltip. `lbl: false` unterdrückt auch auf der Front, dort
// wo Punkte so dicht liegen, dass keine Zuordnung mehr möglich wäre.
const named = computed(() => {
  const s = new Set<string>();
  for (const p of split.value.front) s.add(p.label);
  for (const p of snap.value.pts) {
    if (p.old || p.lbl === true) s.add(p.label);
    if (p.lbl === false) s.delete(p.label);
  }
  return s;
});
const isNamed = (p: Pt) => named.value.has(p.label);

const leaders = computed(() =>
  snap.value.pts.flatMap((p) => {
    if (!isNamed(p)) return [];
    const l = leader(p, S);
    return l ? [{ label: p.label, ...l }] : [];
  }),
);
const LX = (p: Pt) => lx(p, S);
const LY = (p: Pt) => ly(p, S);

const chartLabel = computed(
  () =>
    `Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, Datenstand ${snap.value.date}. ` +
    `${snap.value.title}. ${snap.value.note} Auf der Pareto-Front: ` +
    split.value.front
      .map((p) => `${p.label} mit ${p.y} Prozent für ${p.eur} Euro`)
      .join(", ") +
    ".",
);

function pick(i: number) {
  override.value = i;
}

// Die Erklärtexte enthalten Bezeichner in Backticks. Vue rendert den String
// roh, also hier von Hand in Text- und Code-Stücke zerlegen statt Markdown
// mitzuschleppen.
const noteParts = computed(() =>
  snap.value.note.split("`").map((text, i) => ({ text, code: i % 2 === 1 })),
);
</script>

<template>
  <div class="mh-wrap">
    <!-- Timeline: sieben Stationen auf einer Schiene, aktive hervorgehoben.
         Zurückliegende Stationen bleiben kräftiger als kommende, damit die
         Leserichtung ohne Pfeil klar ist. -->
    <ol class="mh-tl" :style="{ '--n': SNAPSHOTS.length }">
      <li
        v-for="(s, i) in SNAPSHOTS"
        :key="s.id"
        class="mh-tl-item"
        :class="{ active: i === idx, past: i < idx }"
      >
        <button
          class="mh-tl-btn"
          :aria-current="i === idx ? 'step' : undefined"
          :aria-label="`Datenstand ${s.date}: ${s.title}`"
          @click="pick(i)"
        >
          <span class="mh-tl-date">{{ s.date }}</span>
          <span class="mh-tl-dot" />
        </button>
      </li>
    </ol>

    <div class="mh-legend">
      <span><i class="mh-sw mh-sw-front" />Pareto-Front</span>
      <span><i class="mh-sw mh-sw-dom" />dominiert</span>
      <span><i class="mh-sw mh-sw-old" />vor der Preisanpassung</span>
      <span class="mh-note-hint">Station anklicken oder →</span>
      <button
        class="mh-ib"
        aria-label="Quellen und Einschränkungen anzeigen"
        @click="sourcesOpen = true"
      >
        ⓘ
      </button>
    </div>

    <svg
      class="mh-chart"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="chartLabel"
    >
      <rect
        :x="L"
        :y="T"
        :width="QX - L"
        :height="QY - T"
        class="mh-q mh-q-sweet"
      />
      <rect
        :x="QX"
        :y="T"
        :width="W - R - QX"
        :height="QY - T"
        class="mh-q mh-q-price"
      />
      <rect
        :x="L"
        :y="QY"
        :width="QX - L"
        :height="H - B - QY"
        class="mh-q mh-q-budget"
      />
      <rect
        :x="QX"
        :y="QY"
        :width="W - R - QX"
        :height="H - B - QY"
        class="mh-q mh-q-burn"
      />

      <g class="mh-grid">
        <line
          v-for="t in xTicks"
          :key="`x${t}`"
          :x1="px(t)"
          :y1="T"
          :x2="px(t)"
          :y2="H - B"
        />
        <line
          v-for="t in yTicks"
          :key="`y${t}`"
          :x1="L"
          :y1="py(t)"
          :x2="W - R"
          :y2="py(t)"
        />
      </g>
      <g class="mh-qline">
        <line :x1="QX" :y1="T" :x2="QX" :y2="H - B" />
        <line :x1="L" :y1="QY" :x2="W - R" :y2="QY" />
      </g>
      <g class="mh-ticks">
        <text
          v-for="t in xTicks"
          :key="`xl${t}`"
          :x="px(t)"
          :y="H - B + 14"
          text-anchor="middle"
        >
          {{ t }} €
        </text>
        <text
          v-for="t in yTicks"
          :key="`yl${t}`"
          :x="L - 7"
          :y="py(t) + 3"
          text-anchor="end"
        >
          {{ t }} %
        </text>
      </g>

      <!-- Datenschicht: eigener key pro Station, damit der Wechsel als kurzer
           Fade liest statt als harter Sprung. -->
      <g :key="snap.id" class="mh-data">
        <g v-for="m in moved" :key="`old-${m.label}`" class="mp-moved">
          <line :x1="m.x1" :y1="m.y1" :x2="m.x2" :y2="m.y2" />
          <polygon :points="m.head" />
          <circle :cx="m.gx" :cy="m.gy" r="4" class="mp-old-pt">
            <title>
              {{ m.label }}: vorher {{ m.eur }} €/Task — {{ m.why }}
            </title>
          </circle>
        </g>

        <line
          v-for="l in leaders"
          :key="`ld-${l.label}`"
          :x1="l.x1"
          :y1="l.y1"
          :x2="l.x2"
          :y2="l.y2"
          class="mh-leader"
        />

        <polyline :points="frontPath" class="mh-front-line" />
        <g v-for="p in split.front" :key="`f-${p.label}`">
          <circle :cx="px(p.x)" :cy="py(p.y)" r="5" class="mh-front-pt">
            <title>{{ tip(p) }}</title>
          </circle>
          <text
            v-if="isNamed(p)"
            :x="LX(p)"
            :y="LY(p)"
            :text-anchor="anchor(p)"
            class="mh-label mh-label-front"
          >
            {{ p.label }}
          </text>
        </g>

        <g v-for="p in split.dom" :key="`d-${p.label}`">
          <rect
            :x="px(p.x) - 4"
            :y="py(p.y) - 4"
            width="8"
            height="8"
            class="mh-dom-pt"
          >
            <title>{{ tip(p) }}</title>
          </rect>
          <text
            v-if="isNamed(p)"
            :x="LX(p)"
            :y="LY(p)"
            :text-anchor="anchor(p)"
            class="mh-label mh-label-dom"
          >
            {{ p.label }}
          </text>
        </g>
      </g>
    </svg>

    <!-- Feste Mindesthöhe: der Text ist je Station unterschiedlich lang, das
         Layout darf beim Durchklicken nicht springen. -->
    <div class="mh-note">
      <span class="mh-note-step">{{ idx + 1 }}/{{ SNAPSHOTS.length }}</span>
      <p>
        <strong>{{ snap.title }}</strong>
        <span
          v-if="snap.reconstructed"
          class="mh-recon"
          title="Aus Changelog und Nachbarständen rekonstruiert, nicht 1:1 archiviert"
          >rekonstruiert</span
        >
        —
        <template v-for="(part, i) in noteParts" :key="i">
          <code v-if="part.code">{{ part.text }}</code>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>
    </div>

    <ModelRoutingSources :open="sourcesOpen" @close="sourcesOpen = false" />
  </div>
</template>

<style scoped>
.mh-wrap {
  margin-top: 2px;
}

/* --- Timeline ----------------------------------------------------------- */
.mh-tl {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  position: relative;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
}
/* Schiene auf Höhe der Punkte; 1/(2n) Einrückung, damit sie genau an den
   äußeren Punkten endet statt über sie hinauszuragen. */
.mh-tl::before {
  content: "";
  position: absolute;
  right: calc(100% / (2 * var(--n)));
  bottom: 4px;
  left: calc(100% / (2 * var(--n)));
  height: 1px;
  background: var(--color-border-tertiary);
}
.mh-tl-item {
  position: relative;
  z-index: 1;
}
.mh-tl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}
.mh-tl-date {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
.mh-tl-dot {
  width: 9px;
  height: 9px;
  border: 1.4px solid var(--color-border-secondary);
  border-radius: 50%;
  background: var(--deck-surface, var(--color-background-primary));
}
.mh-tl-item.past .mh-tl-date {
  color: var(--color-text-secondary);
}
.mh-tl-item.past .mh-tl-dot {
  border-color: var(--color-text-tertiary);
  background: var(--color-text-tertiary);
}
.mh-tl-item.active .mh-tl-date {
  font-weight: 700;
  color: var(--color-text-primary);
}
.mh-tl-item.active .mh-tl-dot {
  width: 13px;
  height: 13px;
  margin-bottom: -2px;
  border-color: var(--slidev-theme-primary);
  background: var(--slidev-theme-primary);
  box-shadow: 0 0 0 3px
    color-mix(in srgb, var(--slidev-theme-primary) 22%, transparent);
}
.mh-tl-btn:hover .mh-tl-date {
  color: var(--color-text-primary);
}

/* --- Legende ------------------------------------------------------------ */
.mh-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.mh-sw {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 5px;
  vertical-align: -1px;
}
.mh-sw-front {
  border-radius: 50%;
  background: var(--slidev-theme-primary);
}
.mh-sw-dom {
  border-radius: 2px;
  background: var(--color-text-tertiary);
}
.mh-sw-old {
  box-sizing: border-box;
  border: 1.4px solid var(--color-text-tertiary);
  border-radius: 50%;
  background: none;
  opacity: 0.75;
}
.mh-note-hint {
  margin-left: auto;
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.mh-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.mh-ib:hover {
  color: var(--color-text-primary);
}

/* --- Chart -------------------------------------------------------------- */
.mh-chart {
  display: block;
  width: 100%;
  height: auto;
}
.mh-data {
  animation: mh-fade 220ms ease;
}
@keyframes mh-fade {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

.mh-q-sweet {
  fill: color-mix(in srgb, var(--color-text-success) 7%, transparent);
}
.mh-q-price {
  fill: color-mix(in srgb, var(--color-text-warning) 6%, transparent);
}
.mh-q-budget {
  fill: color-mix(in srgb, var(--color-text-tertiary) 6%, transparent);
}
.mh-q-burn {
  fill: color-mix(in srgb, var(--color-text-danger) 7%, transparent);
}
.mh-grid line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.mh-qline line {
  stroke: var(--color-border-secondary);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.mh-ticks text {
  font-size: 10px;
  fill: var(--color-text-tertiary);
}

/* Wanderungs-Optik identisch zur Hauptfolie — dasselbe Zeichen soll überall
   dasselbe heißen. Klassennamen deshalb bewusst mit `mp-`-Präfix übernommen. */
.mp-moved {
  opacity: 0.8;
}
.mp-moved line {
  stroke: var(--color-text-tertiary);
  stroke-width: 1.2;
  stroke-dasharray: 3 3;
}
.mp-moved polygon {
  fill: var(--color-text-tertiary);
}
.mp-old-pt {
  fill: none;
  stroke: var(--color-text-tertiary);
  stroke-width: 1.4;
}

.mh-front-line {
  fill: none;
  stroke: var(--slidev-theme-primary);
  stroke-width: 2;
  stroke-dasharray: 5 4;
}
.mh-front-pt {
  fill: var(--slidev-theme-primary);
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 2;
}
.mh-dom-pt {
  fill: var(--color-text-tertiary);
  opacity: 0.75;
}
.mh-leader {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.6;
  opacity: 0.7;
}
.mh-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 2.5px;
}
.mh-label-front {
  fill: var(--color-text-primary);
}
.mh-label-dom {
  fill: var(--color-text-tertiary);
}

/* --- Erklärtext --------------------------------------------------------- */
.mh-note {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  min-height: 52px;
  margin-top: 4px;
  padding: 7px 11px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 10px;
  background: var(--color-background-secondary);
}
.mh-note p {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-text-primary);
}
.mh-note code {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--color-background-tertiary);
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11.5px;
}
.mh-note-step {
  flex: none;
  padding-top: 1px;
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--slidev-theme-primary);
}
.mh-recon {
  margin-left: 6px;
  padding: 0 5px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  font-size: 10px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
</style>
