<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";
import {
  SNAPSHOTS,
  anchor,
  leader,
  leaderLine,
  lx,
  ly,
  makeScale,
  movedSegments,
  paretoFront,
  tip,
  type Ax,
  type Pt,
} from "./paretoData";
import { useCrosshairs } from "./useCrosshairs";

// Dieselbe Achsenlage wie `ModelRoutingPareto.vue`, nur flacher und ohne
// Pfeil-Cluster/Quadranten-Labels — darunter brauchen Timeline und Erklärtext
// Platz. Wurzelklasse bewusst `.mh-chart` statt `.mp-chart`: `verify-deploy.ts`
// findet die Pareto-Folie per `querySelector("svg.mp-chart")` und würde sonst
// hier hängenbleiben.
//
// Klick-Vertrag: `step` kommt aus `$clicks` (Frontmatter `clicks: 7`).
//
//   Schritt 0…6 → Station 1…7, Detailmodus aus
//   Schritt 7   → Station bleibt 7, Detailmodus an (← schaltet ihn wieder aus)
//
// Ein Klick auf einen Timeline-Punkt bzw. auf den Legenden-Schalter übersteuert;
// der nächste Pfeiltastendruck holt die Kontrolle zurück (Muster aus
// ModelRoutingRoles.vue).
const props = defineProps<{ step?: number }>();

const override = ref<number | null>(null);
const detailOverride = ref<boolean | null>(null);
watch(
  () => props.step,
  () => {
    override.value = null;
    detailOverride.value = null;
  },
);

const idx = computed(() => {
  const raw = override.value ?? props.step ?? 0;
  return Math.max(0, Math.min(SNAPSHOTS.length - 1, raw));
});
const snap = computed(() => SNAPSHOTS[idx.value]);

// Detailmodus: alle Modellnamen plus Fadenkreuz-Vergleich. Default aus — bei bis
// zu 25 Punkten auf dieser Höhe ist die Vollbeschriftung dicht, sie beantwortet
// aber die Zwischenfrage „welches graue Quadrat ist wer".
const detail = computed(
  () => detailOverride.value ?? (props.step ?? 0) >= SNAPSHOTS.length,
);

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
//
// Im Detailmodus fällt beides weg: dann steht ausdrücklich jeder Name da, auch
// die per `lbl: false` unterdrückten.
const named = computed(() => {
  const s = new Set<string>();
  if (detail.value) {
    for (const p of snap.value.pts) s.add(p.label);
    return s;
  }
  for (const p of split.value.front) s.add(p.label);
  for (const p of snap.value.pts) {
    if (p.old || p.lbl === true) s.add(p.label);
    if (p.lbl === false) s.delete(p.label);
  }
  return s;
});
const isNamed = (p: Pt) => named.value.has(p.label);

// Im Detailmodus platziert die Komponente selbst: die von Hand gesetzten dx/dy
// in `paretoData.ts` sind für die Handvoll Labels des Normalmodus austariert,
// alle 25 auf einmal würden damit übereinanderfallen. Greedy-Layout — Front
// zuerst (sie trägt die Aussage), dann von oben nach unten; jedes Label nimmt
// die erste Kandidatenposition, die weder ein schon gesetztes Label noch einen
// Marker schneidet. Findet sich keine, gilt die Position aus den Daten.
const LBL_PX = 9; // Schriftgröße im Detailmodus, siehe `.mh-all .mh-label`
// Vorschub plus das 2,5-px-Halo links und rechts (`paint-order: stroke`) — lieber
// großzügig schätzen, sonst rutschen zwei Kästen ineinander, die real kollidieren.
const CHAR_W = LBL_PX * 0.63;
const PAD_X = 6;
const PAD_Y = 3;
// Kandidaten von nah nach fern: erst dicht am Marker (Ring 0), dann in Stufen
// nach außen. Weit abgesetzte Labels bekommen über `leaderLine()` automatisch
// eine Führungslinie — im Gedränge zwischen 2 € und 5 € ist das der einzige Weg,
// überhaupt alle 25 Namen unterzubringen.
const RINGS = [0, 28, 58, 92, 130, 170, 220, 280];
const DYS = [3, -8, 13, -18, 23, -28, 33];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const hits = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const placed = computed(() => {
  const out = new Map<string, { x: number; y: number; ax: Ax }>();
  if (!detail.value) return out;

  // Marker und Geisterringe sind tabu, die Front-Linie bewusst nicht: sie ist
  // gestrichelt und liegt unter dem Halo der Beschriftung.
  const marks: Box[] = snap.value.pts.map((p) => ({
    x: px(p.x) - 6,
    y: py(p.y) - 6,
    w: 12,
    h: 12,
  }));
  for (const m of moved.value) {
    marks.push({ x: m.gx - 6, y: m.gy - 6, w: 12, h: 12 });
  }

  const taken: Box[] = [];
  const order = [
    ...split.value.front,
    ...[...split.value.dom].sort((a, b) => b.y - a.y),
  ];

  for (const p of order) {
    const w = p.label.length * CHAR_W + PAD_X;
    const ox = px(p.x);
    const oy = py(p.y);
    let best: { x: number; y: number; ax: Ax; box: Box } | null = null;
    for (const r of RINGS) {
      for (const dy of DYS) {
        for (const ax of ["right", "left"] as const) {
          const x = ox + (ax === "right" ? 9 + r : -9 - r);
          const y = oy + dy;
          const box = {
            x: ax === "right" ? x - PAD_X / 2 : x - w + PAD_X / 2,
            y: y - 7 - PAD_Y / 2,
            w,
            h: LBL_PX + PAD_Y,
          };
          const fits =
            box.x >= L + 1 &&
            box.x + box.w <= W - R - 1 &&
            box.y >= T &&
            box.y + box.h <= H - B &&
            !taken.some((t) => hits(box, t)) &&
            !marks.some((m) => hits(box, m));
          if (fits) {
            best = { x, y, ax, box };
            break;
          }
        }
        if (best) break;
      }
      if (best) break;
    }
    if (best) {
      taken.push(best.box);
      out.set(p.label, { x: best.x, y: best.y, ax: best.ax });
    }
  }
  return out;
});

const LX = (p: Pt) => placed.value.get(p.label)?.x ?? lx(p, S);
const LY = (p: Pt) => placed.value.get(p.label)?.y ?? ly(p, S);
const AX = (p: Pt) => {
  const pl = placed.value.get(p.label);
  return pl ? anchor({ ...p, ax: pl.ax }) : anchor(p);
};

const leaders = computed(() =>
  snap.value.pts.flatMap((p) => {
    if (!isNamed(p)) return [];
    const pl = placed.value.get(p.label);
    const l = pl ? leaderLine(px(p.x), py(p.y), pl.x, pl.y) : leader(p, S);
    return l ? [{ label: p.label, ...l }] : [];
  }),
);

const chartLabel = computed(
  () =>
    `Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, Datenstand ${snap.value.date}. ` +
    `${snap.value.title}. ${snap.value.note} Auf der Pareto-Front: ` +
    split.value.front
      .map((p) => `${p.label} mit ${p.y} Prozent für ${p.eur} Euro`)
      .join(", ") +
    "." +
    (detail.value
      ? " Detailmodus: alle Modellnamen sind eingeblendet, Punkte lassen sich " +
        "für ein Fadenkreuz mit Kosten- und Score-Badge anklicken."
      : ""),
);

function pick(i: number) {
  override.value = i;
}

// Fadenkreuz-Vergleich wie auf der Pareto-Folie, hier aber nur im Detailmodus:
// solange er aus ist, gibt es keine Hit-Targets, und ein Klick ins Chart bleibt
// ein normaler Slidev-Klick. Beim Ausschalten fallen die Pins weg, damit der
// nächste Durchlauf sauber anfängt.
const {
  hovered,
  pinned,
  togglePin,
  crosshairs,
  clear: clearPins,
  movedCls,
} = useCrosshairs(
  computed(() => snap.value.pts),
  S,
);
watch(detail, (on) => {
  if (!on) clearPins();
});

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
      <!-- Opt-in, weil die Vollbeschriftung auf dieser Höhe dicht wird. Der
           achte Klick-Schritt schaltet dasselbe, der Schalter geht zusätzlich
           auf jeder Station. -->
      <button
        class="mh-tg"
        :class="{ on: detail }"
        :aria-pressed="detail"
        @click="detailOverride = !detail"
      >
        alle Namen + Fadenkreuz
      </button>
      <span class="mh-note-hint">{{
        detail ? "Punkt/Label klicken: Fadenkreuz" : "Station anklicken oder →"
      }}</span>
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
      <g :key="snap.id" class="mh-data" :class="{ 'mh-all': detail }">
        <g
          v-for="m in moved"
          :key="`old-${m.label}`"
          class="mp-moved"
          :class="movedCls(m.label)"
        >
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
            :text-anchor="AX(p)"
            class="mh-label mh-label-front"
            :data-model="p.label"
            @mouseenter="hovered = p.label"
            @mouseleave="hovered = null"
            @click.stop="togglePin(p.label)"
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
            :text-anchor="AX(p)"
            class="mh-label mh-label-dom"
            :data-model="p.label"
            @mouseenter="hovered = p.label"
            @mouseleave="hovered = null"
            @click.stop="togglePin(p.label)"
          >
            {{ p.label }}
          </text>
        </g>

        <!-- Fadenkreuze: Hover temporär, Klick fixiert (Vergleichsmodus). Die
             €-Badge sitzt auf der Tick-Grundlinie und überschreibt die Tick-
             Beschriftung dank Halo, die %-Badge ebenso am linken Rand. Ohne
             ±-Badge: Konfidenzintervalle stehen nur für die letzte Station in
             den Daten, die zeigt die Pareto-Folie. -->
        <g
          v-for="c in crosshairs"
          :key="`ch-${c.p.label}`"
          class="mp-ch"
          :class="c.cls"
        >
          <line :x1="px(c.p.x)" :y1="T" :x2="px(c.p.x)" :y2="H - B" />
          <line :x1="L" :y1="py(c.p.y)" :x2="W - R" :y2="py(c.p.y)" />
          <circle :cx="px(c.p.x)" :cy="py(c.p.y)" r="8" class="mp-ch-ring" />
          <text
            :x="px(c.p.x)"
            :y="H - B + 14"
            text-anchor="middle"
            class="mp-ch-badge"
          >
            {{ c.p.eur }} €
          </text>
          <text :x="L - 7" :y="c.badgeY" text-anchor="end" class="mp-ch-badge">
            {{ c.p.y }} %
          </text>
        </g>

        <!-- Unsichtbare Hit-Targets, zuletzt gerendert: sie fangen die Events.
             Nur im Detailmodus — sonst bliebe ein Klick ins Chart hängen, statt
             die Folie weiterzuschalten. Im Cent-Cluster überdecken sie einander;
             dort ist die Beschriftung der zweite Griff. -->
        <template v-if="detail">
          <circle
            v-for="p in snap.pts"
            :key="`hit-${p.label}`"
            :cx="px(p.x)"
            :cy="py(p.y)"
            r="10"
            class="mp-hit"
            role="button"
            tabindex="0"
            :aria-pressed="pinned.includes(p.label)"
            :aria-label="`Fadenkreuz für ${p.label}`"
            @mouseenter="hovered = p.label"
            @mouseleave="hovered = null"
            @click.stop="togglePin(p.label)"
            @keydown.enter.prevent="togglePin(p.label)"
          >
            <title>{{ tip(p) }}</title>
          </circle>
        </template>
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
/* Opt-in-Schalter, Optik wie der Kontingent-Schalter auf der Pareto-Folie —
   derselbe Griff soll überall gleich aussehen. */
.mh-tg {
  padding: 1px 7px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  background: none;
  font: inherit;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.mh-tg:hover {
  color: var(--color-text-secondary);
}
.mh-tg.on {
  border-color: var(--color-text-info);
  background: color-mix(in srgb, var(--color-text-info) 12%, transparent);
  color: var(--color-text-primary);
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
/* Punkt gehovt oder gepinnt → seine Herkunft leuchtet im Fadenkreuz-Ton mit. */
.mp-moved-on {
  opacity: 1;
}
.mp-moved-on line {
  stroke: var(--ch);
  stroke-width: 1.6;
}
.mp-moved-on polygon {
  fill: var(--ch);
}
.mp-moved-on .mp-old-pt {
  stroke: var(--ch);
  stroke-width: 2;
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
/* Klickbar erst im Detailmodus: sonst soll ein Klick auf die Beschriftung die
   Folie weiterschalten wie jeder andere Klick ins Chart. */
.mh-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 2.5px;
  pointer-events: none;
}
.mh-all .mh-label {
  font-size: 9px;
  pointer-events: auto;
  cursor: pointer;
}
.mh-label-front {
  fill: var(--color-text-primary);
}
.mh-label-dom {
  fill: var(--color-text-tertiary);
}

/* --- Fadenkreuz (nur Detailmodus) --------------------------------------- */
/* Wie die Wanderungs-Optik bewusst mit `mp-`-Präfix von der Pareto-Folie
   übernommen: dasselbe Zeichen bedeutet auf beiden Folien dasselbe. `--ch`
   trägt die Farbe pro Pin (Cycle) bzw. neutral beim Hover. */
.mp-ch {
  pointer-events: none;
}
.mp-ch line {
  stroke: var(--ch);
  stroke-width: 1.2;
  stroke-dasharray: 2 3;
}
.mp-ch-ring {
  fill: none;
  stroke: var(--ch);
  stroke-width: 1.5;
}
.mp-ch-badge {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 9.5px;
  font-weight: 700;
  fill: var(--ch);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
}
.mp-ch-0 {
  --ch: var(--color-text-info);
}
.mp-ch-1 {
  --ch: var(--color-text-danger);
}
.mp-ch-2 {
  --ch: var(--color-text-warning);
}
.mp-ch-3 {
  --ch: var(--color-text-success);
}
.mp-ch-hover {
  --ch: var(--color-text-secondary);
  opacity: 0.55;
}
.mp-hit {
  fill: transparent;
  cursor: pointer;
}
.mp-hit:focus-visible {
  outline: none;
  stroke: var(--slidev-theme-primary);
  stroke-width: 1.5;
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
