<script setup lang="ts">
/**
 * BreakEvenChart — zwei Kostengeraden über dem Exec-Cache-Read (MTok) mit
 * Break-even-Marker, Erfolgs-Tönung rechts davon und einer gestrichelten
 * Linie für den eigenen Regler-Wert. Aus OpusplanBreakEven.vue herausgelöst,
 * damit die Codex-Folie dasselbe Chart mit anderen Geraden zeigt.
 *
 * Vertrag:
 * - `lines[0]` ist die Basislinie (opusplan: „Nur Opus“, Codex: „Nur xhigh“),
 *   `lines[1]` der Wechsel. Beide sind affin in x (MTok Exec-Cache-Read) und
 *   liefern Euro. Welches Label über und welches unter seiner Geraden
 *   sitzt, entscheidet die Geometrie am rechten Rand, nicht der Index: liegt
 *   der Break-even jenseits von `xMax` oder gibt es keinen (Codex, Faktor
 *   knapp über oder gleich 1), ist der Wechsel dort noch die obere Gerade —
 *   ein festes „Basis oben“ malte dann ein Label quer über die andere Linie.
 * - `breakEven` darf Infinity sein (kein Schnittpunkt, z. B. Faktor ≤ 1)
 *   oder jenseits von `xMax` liegen; beides zeigt das Chart als Hinweis
 *   statt Marker. Bei ≤ 0 (kein Bruch) sitzt der Marker auf der y-Achse und
 *   das Badge sagt `nullBreakEvenText` statt „Break-even ≈ 0,0 MTok“ —
 *   dieselbe Formulierung wie die Notiz der Folie.
 * - Die y-Skala kommt aus einer festen Leiter (`yLadder`), damit kleine
 *   Regler-Bewegungen die Skala nicht zittern lassen; Werte jenseits der
 *   Leiter runden auf die nächste glatte Zahl auf. 8 % Luft über der oberen
 *   Geraden, sonst sitzt deren Label außerhalb der viewBox (Herleitung in
 *   OpusplanBreakEven: trat bei 288 durchgefahrenen Reglerstellungen 8× auf).
 * - Farben nur über die Token-Klassen `warning` (Basis) und `info`
 *   (Wechsel), keine Hex-Werte.
 *
 * Das Chart ist rein darstellend (kein Fokus, keine Handler); `role="img"`
 * mit `ariaLabel` beschreibt es für Screenreader.
 */
import { computed } from "vue";

export interface BreakEvenLinie {
  label: string;
  /** Farb-Token: `warning` für die Basislinie, `info` für den Wechsel. */
  cls: "warning" | "info";
  /** Kosten in Euro bei x MTok Exec-Cache-Read. */
  at: (x: number) => number;
}

const props = withDefaults(
  defineProps<{
    lines: BreakEvenLinie[];
    /** eigener Regler-Wert, MTok */
    readM: number;
    /** Schnittpunkt der Geraden, MTok — Infinity, wenn es keinen gibt */
    breakEven: number;
    xMax: number;
    xTicks?: number[];
    yLadder?: number[];
    yTickMap?: Record<number, number[]>;
    xCaption?: string;
    reglerLabel?: string;
    /** Hinweis, wenn `breakEven` unendlich ist */
    keinBreakEvenText?: string;
    /** Badge, wenn `breakEven` ≤ 0 ist (kein Bruch, lohnt sofort) */
    nullBreakEvenText?: string;
    ariaLabel: string;
  }>(),
  {
    xTicks: undefined,
    yLadder: () => [15, 20, 25, 40, 60],
    yTickMap: () => ({
      15: [5, 10, 15],
      20: [10, 20],
      25: [10, 20],
      40: [20, 40],
      60: [30, 60],
    }),
    xCaption: "MTok Exec-Cache-Read",
    reglerLabel: "dein Regler",
    keinBreakEvenText: "kein Break-even",
    nullBreakEvenText: "lohnt ab 0 MTok",
  },
);

// ── Geometrie (logische Einheiten der viewBox 440×190) ──────────────────────
const XL = 36;
const XT = 10;
const XW = 394;
const XH = 156;
const Y_LUFT = 1.08;

const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");

/** Nächste glatte Zahl ≥ wert (1, 2, 5 × 10^k), falls die Leiter nicht reicht. */
function glatt(wert: number): number {
  if (!(wert > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(wert));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= wert) return m * pow;
  }
  return 10 * pow;
}
function sprosse(leiter: number[], wert: number): number {
  for (const s of leiter) {
    if (s >= wert) return s;
  }
  return glatt(wert);
}

const yMax = computed(() => {
  let top = 0;
  for (const l of props.lines) {
    top = Math.max(top, l.at(0), l.at(props.xMax));
  }
  return sprosse(props.yLadder, top * Y_LUFT);
});
const sx = (x: number) => XL + (x / props.xMax) * XW;
const sy = (v: number) => XT + XH - (v / yMax.value) * XH;

const xTicks = computed(() => {
  if (props.xTicks) return props.xTicks;
  const teile = 4;
  return Array.from({ length: teile + 1 }, (_, i) =>
    Math.round((i * props.xMax) / teile),
  );
});
const yTicks = computed(
  () => props.yTickMap[yMax.value] ?? [yMax.value / 2, yMax.value],
);
const tickText = (t: number) =>
  Number.isInteger(t) ? `${t} €` : `${fmt1(t)} €`;

// ── Break-even ──────────────────────────────────────────────────────────────
const beEndlich = computed(() => Number.isFinite(props.breakEven));
const beImBild = computed(
  () => beEndlich.value && props.breakEven <= props.xMax,
);
const schnittX = computed(() => sx(Math.max(0, props.breakEven)));
const schnittY = computed(() =>
  props.lines[0] ? sy(props.lines[0].at(Math.max(0, props.breakEven))) : XT,
);
// Beide Geraden steigen nach rechts: rechts UNTER dem Marker und links
// ÜBER ihm ist frei, dort kollidiert die Beschriftung mit keiner Linie.
// Steht der Marker in der rechten Plot-Hälfte, wandert sie nach links oben;
// sonst nach rechts unten — es sei denn, darunter ist kein Platz mehr bis
// zur x-Achse, dann rechts oben (wie ursprünglich in OpusplanBreakEven).
// „Platz“ heißt: Grundlinie 14 tiefer plus Unterlänge der 10-px-Schrift,
// sonst sitzen die Unterlängen auf der Achse (Luna · f 1,5 · 5 MTok).
const badgeLinks = computed(() => props.breakEven > props.xMax * 0.55);
const badgeUnten = computed(
  () => !badgeLinks.value && schnittY.value + 20 <= XT + XH,
);
const badgeY = computed(() =>
  badgeUnten.value ? schnittY.value + 14 : schnittY.value - 8,
);
const beText = computed(() =>
  props.breakEven <= 0
    ? props.nullBreakEvenText
    : `Break-even ≈ ${fmt1(props.breakEven)} MTok`,
);

// ── Linien-Labels ───────────────────────────────────────────────────────────
// Das Label der am rechten Rand oberen Geraden sitzt über ihr, das der
// unteren darunter — sonst läge ein Label quer über der anderen Linie
// (Kopfkommentar). Bei Gleichstand gewinnt lines[0], wie vor der Umstellung.
const obenIdx = computed(() => {
  const [a, b] = props.lines;
  if (!a || !b) return 0;
  return a.at(props.xMax) >= b.at(props.xMax) ? 0 : 1;
});

// ── eigener Regler ──────────────────────────────────────────────────────────
const reglerImBild = computed(() => props.readM <= props.xMax);
// Label links vom Marker, sobald er in der rechten Plot-Hälfte steht
const reglerRechts = computed(() => sx(props.readM) > XL + XW / 2);
</script>

<template>
  <svg class="bec" viewBox="0 0 440 190" role="img" :aria-label="ariaLabel">
    <!-- Erfolgs-Tönung rechts vom Break-even -->
    <rect
      v-if="beImBild"
      :x="schnittX"
      :y="XT"
      :width="sx(xMax) - schnittX"
      :height="XH"
      class="bec-ok"
    />
    <!-- Gitter + Achsen -->
    <g class="bec-grid">
      <line
        v-for="t in yTicks"
        :key="'y' + t"
        :x1="XL"
        :y1="sy(t)"
        :x2="sx(xMax)"
        :y2="sy(t)"
      />
      <line :x1="XL" :y1="XT" :x2="XL" :y2="XT + XH" class="bec-achse" />
      <line
        :x1="XL"
        :y1="XT + XH"
        :x2="sx(xMax)"
        :y2="XT + XH"
        class="bec-achse"
      />
    </g>
    <g class="bec-ticktext">
      <text
        v-for="t in yTicks"
        :key="'yt' + t"
        :x="XL - 4"
        :y="sy(t) + 3"
        text-anchor="end"
      >
        {{ tickText(t) }}
      </text>
      <text
        v-for="t in xTicks"
        :key="'xt' + t"
        :x="sx(t)"
        :y="XT + XH + 12"
        text-anchor="middle"
      >
        {{ t }}
      </text>
      <text
        :x="sx(xMax)"
        :y="XT + XH + 12"
        text-anchor="end"
        dy="10"
        class="bec-achslabel"
      >
        {{ xCaption }}
      </text>
    </g>
    <!-- eigener Regler-Wert -->
    <g v-if="reglerImBild">
      <line
        :x1="sx(readM)"
        :y1="XT"
        :x2="sx(readM)"
        :y2="XT + XH"
        class="bec-regler"
      />
      <text
        :x="reglerRechts ? sx(readM) - 4 : sx(readM) + 4"
        :y="XT + 10"
        :text-anchor="reglerRechts ? 'end' : 'start'"
        class="bec-reglertext"
      >
        {{ reglerLabel }}: {{ readM }} MTok
      </text>
    </g>
    <!-- Wert jenseits der Achse: Hinweis oben links (rechts sitzen die Linien-Labels) -->
    <text
      v-else
      :x="XL + 6"
      :y="XT + 10"
      text-anchor="start"
      class="bec-reglertext"
    >
      {{ reglerLabel }}: {{ readM }} MTok →
    </text>
    <!-- Kostengeraden -->
    <line
      v-for="l in lines"
      :key="'l' + l.label"
      :x1="sx(0)"
      :y1="sy(l.at(0))"
      :x2="sx(xMax)"
      :y2="sy(l.at(xMax))"
      class="bec-linie"
      :class="'bec-' + l.cls"
    />
    <text
      v-for="(l, i) in lines"
      :key="'t' + l.label"
      :x="sx(xMax) - 4"
      :y="i === obenIdx ? sy(l.at(xMax)) - 5 : sy(l.at(xMax)) + 12"
      text-anchor="end"
      class="bec-lt"
      :class="'bec-lt-' + l.cls"
    >
      {{ l.label }}
    </text>
    <!-- Break-even-Marker -->
    <g v-if="beImBild">
      <circle :cx="schnittX" :cy="schnittY" r="4" class="bec-punkt" />
      <text
        :x="badgeLinks ? schnittX - 8 : schnittX + 8"
        :y="badgeY"
        :text-anchor="badgeLinks ? 'end' : 'start'"
        class="bec-badge"
      >
        {{ beText }}
      </text>
    </g>
    <!-- Break-even jenseits der Achse oder gar nicht: Hinweis unten rechts, über der x-Achse -->
    <text
      v-else
      :x="sx(xMax) - 4"
      :y="XT + XH - 6"
      text-anchor="end"
      class="bec-badge"
    >
      {{ beEndlich ? beText + " →" : keinBreakEvenText }}
    </text>
  </svg>
</template>

<style scoped>
.bec {
  display: block;
  width: 100%;
  height: auto;
}
.bec-ok {
  fill: color-mix(in srgb, var(--color-text-success) 7%, transparent);
}
.bec-grid line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.bec-grid .bec-achse {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
}
.bec-ticktext text {
  font-size: 9px;
  fill: var(--color-text-tertiary);
}
.bec-achslabel {
  font-size: 9px;
}
.bec-regler {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.bec-reglertext {
  font-size: 9.5px;
  fill: var(--color-text-secondary);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3;
}
.bec-linie {
  stroke-width: 2;
}
.bec-warning {
  stroke: var(--color-text-warning);
}
.bec-info {
  stroke: var(--color-text-info);
}
.bec-lt {
  font-size: 10px;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3;
}
.bec-lt-warning {
  fill: var(--color-text-warning);
}
.bec-lt-info {
  fill: var(--color-text-info);
}
.bec-punkt {
  fill: var(--color-text-primary);
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 1.5;
}
.bec-badge {
  font-size: 10px;
  font-weight: 600;
  fill: var(--color-text-primary);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3;
}
</style>
