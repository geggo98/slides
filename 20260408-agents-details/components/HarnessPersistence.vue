<script setup lang="ts">
import { computed, ref } from "vue";
import { useDarkMode } from "@slidev/client";
import { useDeckPalette } from "./palette";
import { AGENT_COLORS } from "./chartData";
import { resolveColor } from "./chartConfig";
import HarnessTaxSources from "./HarnessTaxSources.vue";
import {
  eur,
  HARNESSES,
  holdsGiveUpThesis,
  MODEL_LABELS,
  STEPS_SWE,
  SWE,
  type Harness,
  type HModel,
} from "./harnessTaxData";

// Prüft die Abbruch-These („eigener Harness gibt nicht auf, probiert mehr
// Varianten, löst mehr") an drei Modellen, deren Muster sich unterscheiden —
// nicht an allen 21 Paaren, das wäre dieselbe Tabelle wie im Chart der
// Nachbarfolie, nur ohne Diagramm. Reines HTML-<table>, wie `HarnessTable.vue`.

const { isDark } = useDarkMode();
const P = useDeckPalette();
const sourcesOpen = ref(false);
const HARNESS_COLOR: Record<Harness, { light: string; dark: string }> = {
  pi: AGENT_COLORS.pi,
  codex: AGENT_COLORS.codex,
  cc: AGENT_COLORS.claudeCode,
};
const colorFor = (h: Harness) => resolveColor(HARNESS_COLOR[h], isDark);
const harnessLabel: Record<Harness, string> = Object.fromEntries(
  HARNESSES.map((h) => [h.key, h.label]),
) as Record<Harness, string>;

interface Row {
  model: HModel;
  harness: Harness;
  steps: number;
  tokens: number;
  eur: number;
  y: number;
  highlight: boolean;
}

const MODELS: readonly HModel[] = ["luna", "fable", "haiku"];
const HARNESS_ORDER: readonly Harness[] = ["pi", "codex", "cc"];

const rows = computed<Row[]>(() =>
  MODELS.flatMap((model) =>
    HARNESS_ORDER.map((harness) => {
      const step = STEPS_SWE.find(
        (r) => r.model === model && r.harness === harness,
      )!;
      const pt = SWE.find((p) => p.model === model && p.harness === harness)!;
      return {
        model,
        harness,
        steps: step.steps,
        tokens: step.tokens,
        eur: eur(pt.usd),
        y: pt.y,
        highlight: harness === "cc",
      };
    }),
  ),
);

// Data-Bars wie in Excel: ein Balken im Zellhintergrund, Länge = Wert ÷
// Spaltenmaximum (bei „Erfolg" = der Prozentwert selbst), Farbe = Harness wie
// der Marker im Chart der Nachbarfolie. Nur Orientierung („eher hoch, eher
// niedrig"), die Zahl bleibt die Aussage — deshalb blass (26 % Deckung) und
// ohne eigene Legende. Das Maximum läuft über die neun gezeigten Zeilen,
// nicht über alle 21 Paare.
const maxOf = computed(() => ({
  steps: Math.max(...rows.value.map((r) => r.steps)),
  tokens: Math.max(...rows.value.map((r) => r.tokens)),
  eur: Math.max(...rows.value.map((r) => r.eur)),
}));
const bar = (r: Row, wert: number, max: number) => ({
  "--bar": `${((100 * wert) / max).toFixed(1)}%`,
  "--sw": colorFor(r.harness),
});

const fmtTokens = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2).replace(".", ",")} Mio.`
    : `${(n / 1e3).toFixed(0)}k`;

const VERDICT: Record<HModel, string> = {
  luna: "Ausdauer ja, Ertrag kaum: 3,4× so viele Schritte, 5,1× so teuer, für +2,3 Punkte.",
  fable:
    "Gleiche Schrittzahl (15,3 gegen 15,4) — der Aufpreis ist Gewicht pro Schritt, nicht Ausdauer.",
  haiku: "Bricht FRÜHER ab als Pi und Codex (50,9 Schritte) und löst weniger.",
};

// Aus den Daten abgeleitet statt hartkodiert, damit die Marke nie von der
// Tabelle abdriftet, gegen die sie steht — siehe holdsGiveUpThesis().
const HOLDS: Record<HModel, boolean> = Object.fromEntries(
  MODELS.map((m) => [m, holdsGiveUpThesis(m)]),
) as Record<HModel, boolean>;
</script>

<template>
  <div class="hp-wrap">
    <button
      class="hp-ib"
      aria-label="Quellen und Einschränkungen anzeigen"
      @click="sourcesOpen = true"
    >
      ⓘ
    </button>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Modell</th>
            <th>Harness</th>
            <th class="num">Schritte/Versuch</th>
            <th class="num">Tokens/Versuch</th>
            <th class="num">€/Task</th>
            <th class="num">Erfolg</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="model in MODELS" :key="model">
            <tr
              v-for="(r, i) in rows.filter((x) => x.model === model)"
              :key="`${model}-${r.harness}`"
              :class="{ highlight: r.highlight }"
            >
              <td v-if="i === 0" :rowspan="3" class="model">
                {{ MODEL_LABELS[model] }}
              </td>
              <td>
                <span
                  class="hp-sw"
                  :style="{ '--sw': colorFor(r.harness) }"
                ></span
                >{{ harnessLabel[r.harness] }}
              </td>
              <td class="num mono hp-bar" :style="bar(r, r.steps, maxOf.steps)">
                {{ r.steps.toFixed(1).replace(".", ",") }}
              </td>
              <td
                class="num mono hp-bar"
                :style="bar(r, r.tokens, maxOf.tokens)"
              >
                {{ fmtTokens(r.tokens) }}
              </td>
              <td class="num mono hp-bar" :style="bar(r, r.eur, maxOf.eur)">
                {{ r.eur.toFixed(2).replace(".", ",") }}
              </td>
              <td class="num mono hp-bar" :style="bar(r, r.y, 100)">
                {{ r.y.toFixed(1).replace(".", ",") }} %
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div class="hp-verdicts">
      <div v-for="model in MODELS" :key="`v-${model}`" class="hp-verdict">
        <span class="hp-mark" :class="HOLDS[model] ? 'ok' : 'no'">{{
          HOLDS[model] ? "✓" : "✗"
        }}</span>
        <strong>{{ MODEL_LABELS[model] }}:</strong> {{ VERDICT[model] }}
      </div>
    </div>
    <HarnessTaxSources :open="sourcesOpen" @close="sourcesOpen = false" />
  </div>
</template>

<style scoped>
.hp-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hp-ib {
  align-self: flex-end;
  margin-bottom: -6px;
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 13px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.hp-ib:hover {
  color: var(--color-text-primary);
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
  border-radius: 8px;
  overflow: hidden;
  font-size: 11px;
}
th,
td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid v-bind("P.border");
}
th {
  background: v-bind("P.headerBg");
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
th.num,
td.num {
  text-align: right;
}
td {
  color: v-bind("P.text");
}
td.mono {
  font-family: var(--slidev-code-font-family, monospace);
}
/* Data-Bar: Verlauf mit hartem Ende bei --bar, 3 px Luft zu den Zeilenlinien,
   liegt über der Zeilenfarbe (background-color) der hervorgehobenen Zeilen. */
td.hp-bar {
  background-image: linear-gradient(
    to right,
    color-mix(in srgb, var(--sw) 26%, transparent) 0 var(--bar),
    transparent var(--bar) 100%
  );
  background-repeat: no-repeat;
  background-size: 100% calc(100% - 6px);
  background-position: 0 3px;
}
.model {
  font-weight: 600;
  vertical-align: middle;
}
tr:last-child td {
  border-bottom: none;
}
/* background-COLOR, nicht die Kurzform: die setzt background-image zurück
   und löscht die Data-Bars der Claude-Code-Zeilen (gemessen 20.09.2026). */
tr.highlight td {
  background-color: v-bind("P.hoverBg");
  font-weight: 600;
}
.hp-sw {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
  background: var(--sw);
  vertical-align: -1px;
}
.hp-verdicts {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hp-verdict {
  font-size: 11px;
  line-height: 1.35;
  color: v-bind("P.descColor");
}
.hp-verdict strong {
  color: v-bind("P.text");
}
.hp-mark {
  display: inline-block;
  width: 1.1em;
  font-weight: 700;
  text-align: center;
}
.hp-mark.ok {
  color: #2e9e5b;
}
.hp-mark.no {
  color: #c94a3f;
}
</style>
