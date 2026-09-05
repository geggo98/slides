<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";
import {
  SNAPSHOTS,
  V1_COMPARE,
  fmt,
  movedSegments,
  paretoFront,
  tip,
  type Pt,
  type Snapshot,
} from "./paretoData";
import { labelBox, layoutLabels, type Placed, type XY } from "./labelLayout";
import {
  dodgeDetailed,
  HISTORY_SCALE,
  HIT_R_HISTORY,
  historyObstacles,
  LABEL_FONT,
  LENS,
  lensView,
  plotBounds,
  tickLabel,
  toLayoutPoints,
  WARN,
  X_TICKS_LOG,
  Y_TICKS,
} from "./paretoChrome";
import { useCrosshairs } from "./useCrosshairs";

// Dieselbe Achse wie `ModelRoutingPareto.vue` (geteilt über `paretoChrome.ts`,
// x logarithmisch), nur flacher und ohne Pfeil-Cluster/Quadranten-Labels —
// darunter brauchen Timeline und Erklärtext Platz. Wurzelklasse bewusst `.mh-chart` statt `.mp-chart`: `verify-deploy.ts`
// findet die Pareto-Folie per `querySelector("svg.mp-chart")` und würde sonst
// hier hängenbleiben.
//
// Klick-Vertrag: `step` kommt aus `$clicks`, das Frontmatter setzt `clicks`
// auf die Stationszahl n plus 1, wenn der letzte Stand eine Lupe trägt
// (Historie: 9 Stationen + Lupe = 10, Bonusfolie 2).
//
//   Schritt 0…n−1 → Station 1…n, Detailmodus aus
//   Schritt n     → Lupe (nur wenn Stand n eine hat), Station bleibt n
//   danach        → Station bleibt n, Detailmodus an (← schaltet zurück)
//
// Die Logik liest `list.length` und `hasLens`, die Timeline `--n`. Beim
// Anlegen einer Station also nur das Frontmatter nachziehen.
//
// `series` wählt die Stationsliste: die Historie (`SNAPSHOTS`) oder der
// Vergleich v1 gegen v1.1 auf der Bonusfolie (`V1_COMPARE`). `oldLegend` und
// `goneLegend` beschriften dort Geisterring und Kreuze, die auf der Bonusfolie
// keinen alten Preis zeigen, sondern den v1-Wert und die nie neu gemessenen
// v1-Modelle.
//
// Ein Klick auf einen Timeline-Punkt bzw. auf den Legenden-Schalter übersteuert;
// der nächste Pfeiltastendruck holt die Kontrolle zurück (Muster aus
// ModelRoutingRoles.vue).
const props = defineProps<{
  step?: number;
  series?: "history" | "v1";
  oldLegend?: string;
  goneLegend?: string;
}>();

const list = computed<Snapshot[]>(() =>
  props.series === "v1" ? V1_COMPARE : SNAPSHOTS,
);

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
  return Math.max(0, Math.min(list.value.length - 1, raw));
});
const snap = computed(() => list.value[idx.value]);

// Detailmodus: alle Modellnamen plus Fadenkreuz-Vergleich. Default aus — bei bis
// zu 25 Punkten auf dieser Höhe ist die Vollbeschriftung dicht, sie beantwortet
// aber die Zwischenfrage „welches graue Quadrat ist wer".
const hasLens = computed(() => !!list.value[list.value.length - 1]?.lens);
const detail = computed(
  () =>
    detailOverride.value ??
    (props.step ?? 0) >= list.value.length + (hasLens.value ? 1 : 0),
);
// Lupe: genau der Schritt nach der letzten Station, solange kein Klick auf die
// Timeline oder den Legenden-Schalter übersteuert hat.
const lensOn = computed(
  () =>
    hasLens.value &&
    override.value === null &&
    detailOverride.value === null &&
    (props.step ?? 0) === list.value.length &&
    !!snap.value.lens,
);

const sourcesOpen = ref(false);

const S = HISTORY_SCALE;
const { W, H, L, R, T, B, px, py } = S;
const QX = px(8);
const QY = py(50);

const xTicks = X_TICKS_LOG;
const yTicks = Y_TICKS;

const split = computed(() => paretoFront(snap.value.pts));

// Entzerrung: Marker, die einander verdecken, rücken bis 8 px auseinander
// (`dodgeMarkers` in paretoChrome.ts). `at()` ist die angezeigte Lage — für
// Marker, Front-Polyline, Klickziele, Fadenkreuz-Ring und Pfeilende.
// Fadenkreuz-Linien, Badges, Geisterringe und Kreuze bleiben am wahren Wert.
const dodge = computed(() => dodgeDetailed(snap.value.pts, S, "history"));
const at = (p: Pt): XY =>
  dodge.value.pos.get(p.label) ?? { px: px(p.x), py: py(p.y) };
const dodgedMax = computed(() =>
  Math.max(0, ...dodge.value.moved.map((m) => Math.hypot(m.dx, m.dy))),
);

const frontPath = computed(() =>
  split.value.front.map((p) => `${at(p).px},${at(p).py}`).join(" "),
);
const moved = computed(() => movedSegments(snap.value.pts, S, undefined, at));

// Kreuze: Modelle des Vorstands ohne Wert in diesem Stand (nur Bonusfolie).
const gone = computed(() => snap.value.gone ?? []);
// Warnhinweis oben links, nur für Stände mit `warn` (Bonusfolie, v1).
const warnAt = WARN.at(S);

// Beschriftung je Station aus `labelLayout.ts`: Front, Gewandertes und
// `story: true` immer, der Rest nur, wo direkt am Marker Platz ist. Der
// Detailmodus ist der Durchgang „alle Namen“ — er legt nach, ohne die
// vorhandenen Labels zu verschieben. Hindernisse sind nur Kreuze und
// Warnhinweis (`historyObstacles`, dieselbe Rechnung wie im Test).
const layout = computed(() =>
  layoutLabels(
    toLayoutPoints(snap.value.pts, S, {
      overlay: false,
      story: (p) => p.story === true,
      pos: dodge.value.pos,
    }),
    {
      font: LABEL_FONT.history,
      allFont: LABEL_FONT.historyAll,
      bounds: plotBounds(S),
      hitR: HIT_R_HISTORY,
      obstacles: historyObstacles(snap.value, S),
    },
  ),
);
const placed = computed(() =>
  detail.value ? layout.value.all : layout.value.core,
);
const font = computed(() =>
  detail.value ? LABEL_FONT.historyAll : LABEL_FONT.history,
);

interface LabelView {
  p: Pt;
  pl: Placed;
  front: boolean;
  /** Vorhergesagte Box (x y w h) — die Browser-QA hält sie gegen die gemessene. */
  box: string;
}
const boxAttr = (p: Pt, pl: Placed) => {
  const b = labelBox(p.label, pl.x, pl.y, pl.ax, font.value);
  return [b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(" ");
};
const frontSet = computed(() => new Set(split.value.front.map((p) => p.label)));
const labels = computed<LabelView[]>(() =>
  snap.value.pts.flatMap((p) => {
    const pl = placed.value.get(p.label);
    return pl
      ? [{ p, pl, front: frontSet.value.has(p.label), box: boxAttr(p, pl) }]
      : [];
  }),
);
const leaders = computed(() =>
  labels.value.flatMap(({ p, pl }) =>
    pl.leader ? [{ label: p.label, ...pl.leader }] : [],
  ),
);
const unnamed = computed(() =>
  snap.value.pts.filter((p) => !placed.value.has(p.label)).map((p) => p.label),
);

const chartLabel = computed(
  () =>
    `Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, x-Achse logarithmisch von 0,1 bis 30 Euro, Datenstand ${snap.value.date}. ` +
    `${snap.value.title}. ${snap.value.note} Auf der Pareto-Front: ` +
    split.value.front
      .map((p) => `${p.label} mit ${p.y} Prozent für ${p.eur} Euro`)
      .join(", ") +
    "." +
    (snap.value.warn ? ` Warnung: ${snap.value.warn}` : "") +
    (gone.value.length
      ? ` ${gone.value.length} Kreuze markieren Modelle des vorigen Stands, die hier keinen Wert haben.`
      : "") +
    (dodge.value.moved.length
      ? ` ${dodge.value.moved.length} Marker sind bis ${dodgedMax.value.toFixed(1).replace(".", ",")} Pixel auseinandergerückt, damit sie sich nicht verdecken; Fadenkreuz und Tooltip zeigen den wahren Wert.`
      : "") +
    (lensOn.value && snap.value.lens
      ? ` Lupe: ${snap.value.lens.title}. ${snap.value.lens.note}`
      : "") +
    (detail.value
      ? " Detailmodus: alle Modellnamen sind eingeblendet, Punkte lassen sich " +
        "für ein Fadenkreuz mit Kosten- und Score-Badge anklicken."
      : unnamed.value.length
        ? ` ${unnamed.value.length} Punkte tragen keinen Namen, weil dort kein Platz ist; der Detailmodus zeigt alle.`
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
const noteTitle = computed(() =>
  lensOn.value && snap.value.lens ? snap.value.lens.title : snap.value.title,
);
const noteParts = computed(() =>
  (lensOn.value && snap.value.lens ? snap.value.lens.note : snap.value.note)
    .split("`")
    .map((text, i) => ({ text, code: i % 2 === 1 })),
);

// Lupe: Panel-Geometrie aus `lensView` (paretoChrome.ts), dieselbe Rechnung
// wie im Test. Labels der Stufen stammen aus dem Platzierer.
const lens = computed(() =>
  lensOn.value && snap.value.lens
    ? lensView(snap.value.lens, snap.value.pts, S)
    : null,
);
const lensLabels = computed(() =>
  lens.value
    ? lens.value.ladder.flatMap((l) => {
        const pl = lens.value!.labels.get(l.c.effort);
        return pl ? [{ l, pl }] : [];
      })
    : [],
);
const fmtPct = (v: number) => v.toFixed(2).replace(".", ",");
</script>

<template>
  <div class="mh-wrap">
    <!-- Timeline: eine Station je Stand auf einer Schiene, aktive hervorgehoben.
         Zurückliegende Stationen bleiben kräftiger als kommende, damit die
         Leserichtung ohne Pfeil klar ist. -->
    <ol class="mh-tl" :style="{ '--n': list.length }">
      <li
        v-for="(s, i) in list"
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
      <span
        ><i class="mh-sw mh-sw-old" />{{
          oldLegend ?? "vor der Preisanpassung"
        }}</span
      >
      <span v-if="gone.length"
        ><b class="mh-sw-x">×</b>{{ goneLegend ?? "nicht neu gemessen" }}</span
      >
      <!-- Opt-in, weil die Vollbeschriftung auf dieser Höhe dicht wird. Der
           letzte Klick-Schritt schaltet dasselbe, der Schalter geht zusätzlich
           auf jeder Station. Er legt Namen nach, ohne die vorhandenen zu
           verschieben (siehe `labelLayout.ts`). -->
      <button
        class="mh-tg"
        :class="{ on: detail }"
        :aria-pressed="detail"
        @click="detailOverride = !detail"
      >
        alle Namen + Fadenkreuz
      </button>
      <span class="mh-note-hint">{{
        detail
          ? "Punkt/Label klicken: Fadenkreuz"
          : lensOn
            ? "→ alle Namen + Fadenkreuz"
            : "Station anklicken oder →"
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
      :data-dropped="unnamed.join(' ')"
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
          {{ tickLabel(t) }}
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
      <g
        :key="snap.id"
        class="mh-data"
        :class="{ 'mh-all': detail, 'mh-dim': lensOn }"
      >
        <!-- Warnhinweis: nur, wenn der Stand einen trägt (Bonusfolie, v1). -->
        <g v-if="snap.warn" class="mh-warn">
          <title>{{ snap.warn }}</title>
          <text :x="warnAt.x" :y="warnAt.y" class="mh-warn-icon">⚠️</text>
          <text :x="warnAt.x + WARN.iconW" :y="warnAt.y">{{ WARN.text }}</text>
        </g>

        <!-- Kreuze: Modelle des vorigen Stands ohne Wert hier. Kein Label,
             kein Klickziel, nur der Tooltip. Der unsichtbare Kreis macht die
             dünnen Linien hoverbar. -->
        <g v-for="p in gone" :key="`gone-${p.label}`" class="mh-gone-pt">
          <title>
            {{ p.label }}: {{ p.y }} % · {{ p.eur }} €/Task im vorigen Stand,
            hier nicht gemessen
          </title>
          <line
            :x1="px(p.x) - 4"
            :y1="py(p.y) - 4"
            :x2="px(p.x) + 4"
            :y2="py(p.y) + 4"
          />
          <line
            :x1="px(p.x) - 4"
            :y1="py(p.y) + 4"
            :x2="px(p.x) + 4"
            :y2="py(p.y) - 4"
          />
          <circle :cx="px(p.x)" :cy="py(p.y)" r="6" />
        </g>

        <g
          v-for="m in moved"
          :key="`old-${m.label}`"
          class="mp-moved"
          :class="movedCls(m.label)"
        >
          <line :x1="m.x1" :y1="m.y1" :x2="m.x2" :y2="m.y2" />
          <polygon :points="m.head" />
          <circle :cx="m.gx" :cy="m.gy" r="4.5" class="mp-old-pt">
            <title>
              {{ m.label }}: {{ m.pre }}
              {{ m.y !== undefined ? `${m.y} % · ` : "" }}{{ m.eur }} €/Task —
              {{ m.why }}
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
          <circle :cx="at(p).px" :cy="at(p).py" r="6" class="mh-front-pt">
            <title>{{ tip(p) }}</title>
          </circle>
        </g>

        <g v-for="p in split.dom" :key="`d-${p.label}`">
          <rect
            :x="at(p).px - 4.5"
            :y="at(p).py - 4.5"
            width="9"
            height="9"
            class="mh-dom-pt"
            :class="{ 'mh-focus': lensOn && p.label === snap.lens?.focus }"
          >
            <title>{{ tip(p) }}</title>
          </rect>
        </g>

        <!-- Beschriftungen als eigene Schicht nach allen Markern; Lage aus
             `labelLayout.ts`, `data-box` ist die vorhergesagte Box für die QA. -->
        <text
          v-for="l in labels"
          :key="`lbl-${l.p.label}`"
          :x="l.pl.x"
          :y="l.pl.y"
          :text-anchor="l.pl.ax"
          class="mh-label"
          :class="l.front ? 'mh-label-front' : 'mh-label-dom'"
          :data-model="l.p.label"
          :data-box="l.box"
          @mouseenter="hovered = l.p.label"
          @mouseleave="hovered = null"
          @click.stop="togglePin(l.p.label)"
        >
          {{ l.p.label }}
        </text>

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
          <circle
            :cx="at(c.p).px"
            :cy="at(c.p).py"
            r="8.5"
            class="mp-ch-ring"
          />
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
             die Folie weiterzuschalten. Sie sitzen auf der ANGEZEIGTEN Lage,
             damit ein Klick auf einen entzerrten Marker diesen trifft; wo sie
             sich noch überdecken, ist die Beschriftung der zweite Griff. -->
        <template v-if="detail">
          <circle
            v-for="p in snap.pts"
            :key="`hit-${p.label}`"
            :cx="at(p).px"
            :cy="at(p).py"
            :r="HIT_R_HISTORY"
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
      <!-- Lupe: eigener Klickschritt nach der letzten Station. Das Hauptchart
           dimmt (`mh-dim`), der Fokus-Marker bleibt voll, und das Panel zeigt
           die Region vergrößert mit allen Effort-Stufen des Modells. Ohne
           <defs> und clipPath — die Punktmenge ist per Region gefiltert. -->
      <g v-if="lens && snap.lens" class="mh-lens">
        <rect
          :x="lens.src.x"
          :y="lens.src.y"
          :width="lens.src.w"
          :height="lens.src.h"
          class="mh-lens-src"
        />
        <line
          :x1="lens.src.x"
          :y1="lens.src.y + lens.src.h"
          :x2="lens.box.x"
          :y2="lens.box.y"
          class="mh-lens-link"
        />
        <line
          :x1="lens.src.x + lens.src.w"
          :y1="lens.src.y + lens.src.h"
          :x2="lens.box.x + lens.box.w"
          :y2="lens.box.y"
          class="mh-lens-link"
        />
        <template v-for="p in snap.pts" :key="`focus-${p.label}`">
          <circle
            v-if="p.label === snap.lens.focus"
            :cx="at(p).px"
            :cy="at(p).py"
            r="8"
            class="mh-focus-ring"
          />
        </template>
        <g :transform="`translate(${lens.box.x} ${lens.box.y})`">
          <rect
            x="0"
            y="0"
            :width="lens.box.w"
            :height="lens.box.h"
            rx="6"
            class="mh-lens-bg"
          />
          <text :x="LENS.L" y="11" class="mh-lens-title">
            Lupe: {{ snap.lens.focus }}, alle gemessenen Effort-Stufen
          </text>
          <g class="mh-lens-ticks">
            <line
              v-for="t in LENS.yTicks"
              :key="`lgy${t}`"
              :x1="LENS.L"
              :y1="lens.scale.py(t)"
              :x2="lens.box.w - LENS.R"
              :y2="lens.scale.py(t)"
            />
            <text
              v-for="t in LENS.xTicks"
              :key="`lx${t}`"
              :x="lens.scale.px(t)"
              :y="lens.box.h - 6"
              text-anchor="middle"
            >
              {{ tickLabel(t) }}
            </text>
            <text
              v-for="t in LENS.yTicks"
              :key="`ly${t}`"
              :x="LENS.L - 5"
              :y="lens.scale.py(t) + 3"
              text-anchor="end"
            >
              {{ t }} %
            </text>
          </g>
          <g class="mh-lens-ctx">
            <template v-for="c in lens.ctx" :key="`ctx-${c.p.label}`">
              <circle
                v-if="c.front"
                :cx="c.px"
                :cy="c.py"
                :r="LENS.ctxR"
                class="mh-front-pt"
              >
                <title>{{ tip(c.p) }}</title>
              </circle>
              <rect
                v-else
                :x="c.px - LENS.ctxR"
                :y="c.py - LENS.ctxR"
                :width="2 * LENS.ctxR"
                :height="2 * LENS.ctxR"
                class="mh-dom-pt"
              >
                <title>{{ tip(c.p) }}</title>
              </rect>
            </template>
          </g>
          <polyline :points="lens.path" class="mh-lens-path" />
          <g
            v-for="l in lens.ladder"
            :key="`step-${l.c.effort}`"
            :class="{
              'mh-lens-shown': l.shown,
              'mh-lens-max': l.c.effort === 'max',
            }"
          >
            <line
              :x1="l.px"
              :y1="lens.scale.py(l.c.y - l.c.ci)"
              :x2="l.px"
              :y2="lens.scale.py(l.c.y + l.c.ci)"
              class="mh-lens-ci"
            />
            <circle :cx="l.px" :cy="l.py" :r="LENS.dotR" class="mh-lens-dot">
              <title>
                {{ snap.lens.focus }} {{ l.c.effort }}: {{ fmtPct(l.c.y) }} % ±
                {{ fmtPct(l.c.ci) }} · {{ fmt(l.c.x) }} €/Task
              </title>
            </circle>
          </g>
          <template v-if="lens.bracket">
            <line
              :x1="lens.bracket.x1"
              :y1="lens.bracket.y"
              :x2="lens.bracket.x2"
              :y2="lens.bracket.y"
              class="mh-lens-bracket"
            />
            <line
              :x1="lens.bracket.x1"
              :y1="lens.bracket.y - 4"
              :x2="lens.bracket.x1"
              :y2="lens.bracket.y"
              class="mh-lens-bracket"
            />
            <line
              :x1="lens.bracket.x2"
              :y1="lens.bracket.y - 4"
              :x2="lens.bracket.x2"
              :y2="lens.bracket.y"
              class="mh-lens-bracket"
            />
            <text
              :x="(lens.bracket.x1 + lens.bracket.x2) / 2"
              :y="lens.bracket.y + 11"
              text-anchor="middle"
              class="mh-lens-bracket-text"
            >
              {{ lens.bracket.text }}
            </text>
          </template>
          <template v-for="{ l, pl } in lensLabels" :key="`ll-${l.c.effort}`">
            <line
              v-if="pl.leader"
              :x1="pl.leader.x1"
              :y1="pl.leader.y1"
              :x2="pl.leader.x2"
              :y2="pl.leader.y2"
              class="mh-lens-leader"
            />
            <text
              :x="pl.x"
              :y="pl.y"
              :text-anchor="pl.ax"
              class="mh-lens-label"
              :class="{
                'mh-lens-shown': l.shown,
                'mh-lens-max': l.c.effort === 'max',
              }"
            >
              {{ l.text }}
            </text>
          </template>
        </g>
      </g>
    </svg>

    <!-- Feste Mindesthöhe: der Text ist je Station unterschiedlich lang, das
         Layout darf beim Durchklicken nicht springen. -->
    <div class="mh-note">
      <span class="mh-note-step">{{ idx + 1 }}/{{ list.length }}</span>
      <p>
        <strong>{{ noteTitle }}</strong>
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
.mh-sw-x {
  display: inline-block;
  width: 9px;
  margin-right: 5px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-tertiary);
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
  font-size: 11px;
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

/* Kreuze: nicht gemessen, weder Front noch dominiert. Der Kreis ist nur das
   Hover-Ziel für den Tooltip. */
.mh-gone-pt line {
  stroke: var(--color-text-tertiary);
  stroke-width: 1.4;
  opacity: 0.6;
}
.mh-gone-pt circle {
  fill: transparent;
}

/* Warnhinweis in der Warnfarbe der Quadranten, mit Halo wie die Labels. */
.mh-warn text {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  fill: var(--color-text-warning);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
}
.mh-warn .mh-warn-icon {
  font-size: 12px;
  stroke: none;
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
  stroke-width: 0.9;
  opacity: 0.7;
}
/* Klickbar erst im Detailmodus: sonst soll ein Klick auf die Beschriftung die
   Folie weiterschalten wie jeder andere Klick ins Chart. Schriftgrößen auch
   in `paretoChrome.ts` (LABEL_FONT.history / historyAll): daraus rechnet der
   Platzierer die Box, die Browser-QA misst nach. */
.mh-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
  pointer-events: none;
}
.mh-all .mh-label {
  font-size: 10px;
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
  font-size: 10.5px;
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

/* --- Lupe --------------------------------------------------------------- */
/* Das Hauptchart tritt zurück, der Fokus-Marker bleibt; alles andere im
   Panel. Warnfarbe für die Leiter, Gefahrfarbe für die höchste Stufe. */
.mh-dim
  :is(
    .mh-front-line,
    .mh-front-pt,
    .mh-dom-pt,
    .mh-label,
    .mh-leader,
    .mp-moved
  ) {
  opacity: 0.22;
}
.mh-dim .mh-focus {
  opacity: 1;
}
.mh-focus-ring {
  fill: none;
  stroke: var(--color-text-warning);
  stroke-width: 2;
}
.mh-lens-src {
  fill: none;
  stroke: var(--color-text-secondary);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.mh-lens-link {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.8;
  stroke-dasharray: 3 3;
}
.mh-lens-bg {
  fill: var(--deck-surface, var(--color-background-primary));
  stroke: var(--color-border-secondary);
  stroke-width: 1;
  opacity: 0.97;
}
.mh-lens-title {
  font-size: 10.5px;
  font-weight: 600;
  fill: var(--color-text-secondary);
}
.mh-lens-ticks text {
  font-size: 9px;
  fill: var(--color-text-tertiary);
}
.mh-lens-ticks line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.mh-lens-ctx {
  opacity: 0.45;
}
.mh-lens-path {
  fill: none;
  stroke: var(--color-text-warning);
  stroke-width: 1.2;
  stroke-dasharray: 2 3;
}
.mh-lens-ci {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  opacity: 0.7;
}
.mh-lens-dot {
  fill: var(--deck-surface, var(--color-background-primary));
  stroke: var(--color-text-warning);
  stroke-width: 1.6;
}
.mh-lens-shown .mh-lens-dot {
  fill: var(--color-text-warning);
}
.mh-lens-max .mh-lens-dot {
  stroke: var(--color-text-danger);
  stroke-width: 2;
}
.mh-lens-bracket {
  stroke: var(--color-text-danger);
  stroke-width: 1.2;
}
.mh-lens-bracket-text,
.mh-lens-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
}
.mh-lens-bracket-text {
  font-weight: 700;
  fill: var(--color-text-danger);
}
.mh-lens-label {
  fill: var(--color-text-secondary);
}
.mh-lens-label.mh-lens-shown {
  fill: var(--color-text-primary);
  font-weight: 700;
}
.mh-lens-label.mh-lens-max {
  fill: var(--color-text-danger);
}
.mh-lens-leader {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.9;
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
</style>
