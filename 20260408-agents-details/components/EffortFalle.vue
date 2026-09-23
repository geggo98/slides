<script setup lang="ts">
import { computed, ref } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";
import { ASTRA_LENS_TODAY, CURRENT_ASTRA_TODAY, fmt } from "./paretoData";
import { HISTORY_SCALE, LENS, lensView, tickLabel } from "./paretoChrome";
import {
  PRELIMINARY_SELF_REPORTED,
  type Preliminary,
} from "./lib/preliminaryDeepSWE";

// Eigenständige Folie, herausgelöst aus dem neunten Klick der Historie
// (`ModelRoutingHistory.vue`, bis 22.09.2026). Dieselbe Panel-Geometrie
// (`lensView` aus paretoChrome.ts), aber ohne das große Hauptchart dahinter —
// hier gibt es nichts, aus dem herausgezoomt wird, also auch kein
// Quellrechteck (`view.src`) und keine Verbindungslinien. `main` (dritter
// Parameter von `lensView`) wird trotzdem gebraucht (Typ-Vertrag), aber sein
// Ergebnis (`view.src`) bleibt ungerendert — jede gültige Scale genügt,
// `HISTORY_SCALE` ist einfach die vorhandene.
const props = defineProps<{ step?: number }>();
const step = computed(() => props.step ?? 0);

const view = computed(() =>
  lensView(ASTRA_LENS_TODAY, CURRENT_ASTRA_TODAY, HISTORY_SCALE),
);
const rows = computed(() =>
  view.value.ladder
    .map((l) => {
      const pl = view.value.labels.get(l.c.effort);
      return pl ? { l, pl } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null),
);

// Eigene Tick-Achsen: die Region ist etwas breiter als bei `ASTRA_LENS`
// (1–14 € statt 1,5–13 €, siehe paretoData.ts — mehr Platz gegen die
// dichteren Nachbarn), `LENS.xTicks`/`yTicks` sind auf den alten Bereich
// zugeschnitten und werden hier nicht mehr benutzt.
const X_TICKS = [1, 2, 3, 5, 10, 14];
const Y_TICKS = [65, 70, 75];

// Panel um 12px Rand herum in ein eigenes viewBox packen — dieselbe
// Box-Größe wie im Historien-Chart (LENS.w × LENS.h), nur ohne das
// umgebende 940px-Chart drumherum.
const PAD = 12;
const viewBox = `0 0 ${LENS.w + 2 * PAD} ${LENS.h + 2 * PAD}`;

const fmtPct = (v: number) => v.toFixed(2).replace(".", ",");
// Direkt aus der Leiter statt aus `view.bracket.text` zurückgerechnet — der
// Text ist fürs SVG-Label optimiert ("×1,9 Preis, gleicher Score"), hier wird
// er in einen Fließtextsatz eingebettet.
const bracketFactor = computed(() => {
  const high = view.value.ladder.find((l) => l.c.effort === "high");
  const max = view.value.ladder.find((l) => l.c.effort === "max");
  if (!high || !max) return null;
  return (max.c.x / high.c.x).toFixed(1).replace(".", ",");
});

const sourcesOpen = ref(false);

const trialsNote = (p: Preliminary) =>
  [
    p.effort ? `bei ${p.effort} effort` : null,
    p.trials ? `Ø ${p.trials} Durchläufe` : null,
  ]
    .filter(Boolean)
    .join(", ");
</script>

<template>
  <div class="ef-wrap">
    <svg
      class="ef-chart"
      :viewBox="viewBox"
      role="img"
      aria-label="Effort-Leiter von GPT-6 Astra, fünf Stufen von low bis max"
    >
      <g :transform="`translate(${PAD} ${PAD})`">
        <rect
          x="0"
          y="0"
          :width="LENS.w"
          :height="LENS.h"
          rx="8"
          class="ef-bg"
        />
        <text :x="LENS.L" y="13" class="ef-title">
          gpt-6-astra — alle gemessenen Effort-Stufen, Preis von heute
        </text>
        <g class="ef-ticks">
          <line
            v-for="t in Y_TICKS"
            :key="`efy${t}`"
            :x1="LENS.L"
            :y1="view.scale.py(t)"
            :x2="LENS.w - LENS.R"
            :y2="view.scale.py(t)"
          />
          <text
            v-for="t in X_TICKS"
            :key="`efx${t}`"
            :x="view.scale.px(t)"
            :y="LENS.h - 6"
            text-anchor="middle"
          >
            {{ tickLabel(t) }}
          </text>
          <text
            v-for="t in Y_TICKS"
            :key="`efty${t}`"
            :x="LENS.L - 5"
            :y="view.scale.py(t) + 3"
            text-anchor="end"
          >
            {{ t }} %
          </text>
        </g>
        <g class="ef-ctx">
          <template v-for="c in view.ctx" :key="`ctx-${c.p.label}`">
            <circle
              v-if="c.front"
              :cx="c.px"
              :cy="c.py"
              :r="LENS.ctxR"
              class="ef-front-pt"
            >
              <title>
                {{ c.p.label }}: {{ c.p.y }} % · {{ c.p.eur }} €/Task
              </title>
            </circle>
            <rect
              v-else
              :x="c.px - LENS.ctxR"
              :y="c.py - LENS.ctxR"
              :width="2 * LENS.ctxR"
              :height="2 * LENS.ctxR"
              class="ef-dom-pt"
            >
              <title>
                {{ c.p.label }}: {{ c.p.y }} % · {{ c.p.eur }} €/Task
              </title>
            </rect>
          </template>
        </g>
        <polyline :points="view.path" class="ef-path" />
        <g
          v-for="l in view.ladder"
          :key="`step-${l.c.effort}`"
          :class="{ 'ef-shown': l.shown, 'ef-max': l.c.effort === 'max' }"
        >
          <line
            :x1="l.px"
            :y1="view.scale.py(l.c.y - l.c.ci)"
            :x2="l.px"
            :y2="view.scale.py(l.c.y + l.c.ci)"
            class="ef-ci"
          />
          <circle :cx="l.px" :cy="l.py" :r="LENS.dotR" class="ef-dot">
            <title>
              gpt-6-astra {{ l.c.effort }}: {{ fmtPct(l.c.y) }} % ±
              {{ fmtPct(l.c.ci) }} · {{ fmt(l.c.x) }} €/Task
            </title>
          </circle>
        </g>
        <template v-if="step >= 1 && view.bracket">
          <line
            :x1="view.bracket.x1"
            :y1="view.bracket.y"
            :x2="view.bracket.x2"
            :y2="view.bracket.y"
            class="ef-bracket"
          />
          <line
            :x1="view.bracket.x1"
            :y1="view.bracket.y - 4"
            :x2="view.bracket.x1"
            :y2="view.bracket.y"
            class="ef-bracket"
          />
          <line
            :x1="view.bracket.x2"
            :y1="view.bracket.y - 4"
            :x2="view.bracket.x2"
            :y2="view.bracket.y"
            class="ef-bracket"
          />
          <text
            :x="(view.bracket.x1 + view.bracket.x2) / 2"
            :y="view.bracket.y + 11"
            text-anchor="middle"
            class="ef-bracket-text"
          >
            {{ view.bracket.text }}
          </text>
        </template>
        <template v-for="{ l, pl } in rows" :key="`ll-${l.c.effort}`">
          <line
            v-if="pl.leader"
            :x1="pl.leader.x1"
            :y1="pl.leader.y1"
            :x2="pl.leader.x2"
            :y2="pl.leader.y2"
            class="ef-leader"
          />
          <text
            :x="pl.x"
            :y="pl.y"
            :text-anchor="pl.ax"
            class="ef-label"
            :class="{ 'ef-shown': l.shown, 'ef-max': l.c.effort === 'max' }"
          >
            {{ l.text }}
          </text>
        </template>
      </g>
    </svg>

    <!-- Fester Slot statt gestapelter Boxen: Jeder Klick ERSETZT die Notiz
         der Slide bleibt so unabhängig von der Klicktiefe innerhalb der
         552-logische-px-Canvas (siehe AGENTS.md „Slide-Canvas-Skalierung").
         Dasselbe Muster wie `.mh-note` in ModelRoutingHistory.vue: eine
         Notiz je Schritt, nicht alle gleichzeitig sichtbar. -->
    <div class="ef-note">
      <div v-if="step === 1" class="ef-callout ef-callout-warn">
        <strong>high und max lösen beide 331 von 452 Aufgaben</strong> — max
        kostet das {{ bracketFactor }}-Fache von high. Höherer Effort ist hier
        nicht besser, nur teurer.
      </div>

      <div v-else-if="step === 2" class="ef-callout">
        <strong>Und der Preis selbst bewegt sich.</strong> Board-Stand
        03.09.2026 führte astra noch als „expected launch pricing“ (12 $/M
        Input, 15 $/M Cache-Write, 2 $/M compute units) — der einzige Punkt des
        ganzen Boards mit dieser Klausel. Zwischen dem 17.09. und dem 22.09.2026
        wurde daraus „current pricing“ (10 $/M Input, 12,50 $/M Cache-Write,
        keine Compute-Unit-Gebühr): astra ist 27–39 % billiger (am wenigsten auf
        low, am meisten auf max) — bei gleichem Score.
      </div>

      <div v-else-if="step >= 3" class="ef-callout ef-prelim">
        <div class="ef-prelim-badge">vorläufig · selbstberichtet</div>
        <strong>Drei neue Modelle, noch nicht von DeepSWE gemessen</strong>
        — beide Tracking-Issues enden mit „Please test“:
        <span
          v-for="(p, i) in PRELIMINARY_SELF_REPORTED"
          :key="p.label"
          class="ef-prelim-item"
        >
          <strong>{{ p.displayName }}</strong> {{ fmtPct(p.y) }} %<span
            v-if="trialsNote(p)"
            class="ef-prelim-meta"
          >
            ({{ trialsNote(p) }})</span
          >
          (<a :href="p.href" target="_blank" rel="noopener">Quelle</a>){{
            i < PRELIMINARY_SELF_REPORTED.length - 1 ? " · " : ""
          }}
        </span>
        <span class="ef-prelim-meta">
          — die Zahlen kommen von Anthropic bzw. OpenAI selbst, nicht von
          Datacurve; kein Preis pro Task (Opus 5.5 nennt keinen, aus dem
          OpenAI-Chart lässt sich keiner belastbar ablesen).</span
        >
      </div>
    </div>

    <button
      class="ef-ib"
      aria-label="Quellen und Einschränkungen anzeigen"
      @click="sourcesOpen = true"
    >
      ⓘ
    </button>

    <ModelRoutingSources :open="sourcesOpen" @close="sourcesOpen = false" />
  </div>
</template>

<style scoped>
.ef-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ef-chart {
  width: 100%;
  height: auto;
}
.ef-bg {
  fill: var(--deck-surface, var(--color-background-primary));
  stroke: var(--color-border-secondary);
  stroke-width: 1;
}
.ef-title {
  font-size: 11px;
  font-weight: 600;
  fill: var(--color-text-secondary);
}
.ef-ticks text {
  font-size: 9.5px;
  fill: var(--color-text-tertiary);
}
.ef-ticks line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.ef-ctx {
  opacity: 0.45;
}
.ef-front-pt {
  fill: var(--slidev-theme-primary);
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 2;
}
.ef-dom-pt {
  fill: var(--color-text-tertiary);
  opacity: 0.75;
}
.ef-path {
  fill: none;
  stroke: var(--color-text-warning);
  stroke-width: 1.4;
  stroke-dasharray: 2 3;
}
.ef-ci {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  opacity: 0.7;
}
.ef-dot {
  fill: var(--deck-surface, var(--color-background-primary));
  stroke: var(--color-text-warning);
  stroke-width: 1.8;
}
.ef-shown .ef-dot {
  fill: var(--color-text-warning);
}
.ef-max .ef-dot {
  stroke: var(--color-text-danger);
  stroke-width: 2.2;
}
.ef-bracket {
  stroke: var(--color-text-danger);
  stroke-width: 1.4;
}
.ef-bracket-text,
.ef-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
}
.ef-bracket-text {
  font-weight: 700;
  fill: var(--color-text-danger);
}
.ef-label {
  fill: var(--color-text-secondary);
}
.ef-label.ef-shown {
  fill: var(--color-text-primary);
  font-weight: 700;
}
.ef-label.ef-max {
  fill: var(--color-text-danger);
}
.ef-leader {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.9;
}

.ef-note {
  /* Fest, damit die Slide beim Durchklicken nicht springt — bemessen am
     größten Inhalt (Schritt 3, Vorläufig-Box, zwei Zeilen Fließtext). */
  min-height: 74px;
}
.ef-callout {
  font-size: 12.5px;
  line-height: 1.38;
  padding: 7px 12px;
  border-radius: 8px;
  background: var(--color-background-secondary, rgba(128, 128, 128, 0.08));
  border: 1px solid var(--color-border-secondary);
}
.ef-callout-warn {
  border-color: var(--color-text-danger);
}
.ef-prelim {
  position: relative;
  border-style: dashed;
  border-width: 1.5px;
  padding-top: 18px;
}
.ef-prelim-item {
  display: inline;
}
.ef-prelim-meta {
  opacity: 0.7;
  font-size: 12px;
}
.ef-prelim-badge {
  position: absolute;
  top: -9px;
  left: 10px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-text-warning);
  color: var(--deck-surface, var(--color-background-primary));
}

.ef-ib {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.ef-ib:hover {
  color: var(--color-text-primary);
}
</style>
