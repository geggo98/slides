<script setup lang="ts">
import { computed, ref } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";

// Port von Tab 2 der Infografik: DeepSWE-Score vs. €/Task als statisches
// Inline-SVG (18 fixe Punkte — kein Chart.js/echarts nötig). Farben über die
// Deck-Tokens, Werte bereits in EUR (1 USD = 0,876 €, 21.07.2026). Bewusst
// ohne <defs> — keine IDs, die zwischen Nachbar-Slides kollidieren könnten.
interface Pt {
  x: number; // €/Task
  y: number; // Pass@1 %
  label: string;
  eur: string; // deutsches Zahlenformat für den Tooltip
  ax: "left" | "right" | "center";
  dy: number;
}

const sourcesOpen = ref(false);

// Geometrie (logische Pixel im 932er-viewBox)
const W = 932;
const H = 316;
const L = 46;
const R = 10;
const T = 10;
const B = 38;
const px = (v: number) => L + (v / 25) * (W - L - R);
const py = (v: number) => H - B - (v / 80) * (H - T - B);
const QX = px(8); // Quadranten-Trennung: 8 € …
const QY = py(50); // … / 50 % (redaktionell, wie im Original)

const front: Pt[] = [
  { x: 2.07, y: 53, label: "muse-spark-1.1", eur: "2,07", ax: "right", dy: 8 },
  { x: 2.12, y: 54, label: "grok-4.5", eur: "2,12", ax: "right", dy: -6 },
  { x: 2.65, y: 67, label: "gpt-5.6-luna", eur: "2,65", ax: "center", dy: 18 },
  { x: 4.07, y: 69, label: "kimi-k3", eur: "4,07", ax: "right", dy: 12 },
  {
    x: 4.34,
    y: 70,
    label: "gpt-5.6-terra",
    eur: "4,34",
    ax: "center",
    dy: -11,
  },
  { x: 7.35, y: 73, label: "gpt-5.6-sol", eur: "7,35", ax: "right", dy: -8 },
  { x: 10.37, y: 74, label: "claude-opus-5", eur: "10,37", ax: "right", dy: 4 },
];

const dom: Pt[] = [
  { x: 6.33, y: 67, label: "gpt-5.5", eur: "6,33", ax: "right", dy: 4 },
  { x: 18.95, y: 70, label: "claude-fable-5", eur: "18,95", ax: "left", dy: 4 },
  {
    x: 11.58,
    y: 59,
    label: "claude-opus-4.8",
    eur: "11,58",
    ax: "right",
    dy: 4,
  },
  {
    x: 23.13,
    y: 54,
    label: "claude-sonnet-5",
    eur: "23,13",
    ax: "left",
    dy: 4,
  },
  { x: 4.95, y: 52, label: "gpt-5.4", eur: "4,95", ax: "right", dy: -8 },
  { x: 3.43, y: 44, label: "glm-5.2", eur: "3,43", ax: "right", dy: 4 },
  {
    x: 3.09,
    y: 49,
    label: "gemini-3.6-flash",
    eur: "3,09",
    ax: "left",
    dy: 16,
  },
  {
    x: 6.43,
    y: 37,
    label: "gemini-3.5-flash",
    eur: "6,43",
    ax: "right",
    dy: 4,
  },
  {
    x: 2.47,
    y: 31,
    label: "kimi-k2.7-code",
    eur: "2,47",
    ax: "right",
    dy: -10,
  },
  {
    x: 4.84,
    y: 30,
    label: "claude-sonnet-4.6",
    eur: "4,84",
    ax: "right",
    dy: 12,
  },
  { x: 8.3, y: 12, label: "gemini-3.1-pro", eur: "8,30", ax: "right", dy: 4 },
];

const xTicks = [0, 5, 10, 15, 20, 25];
const yTicks = [0, 20, 40, 60, 80];

const frontPath = front.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");

const anchor = (p: Pt) =>
  p.ax === "center" ? "middle" : p.ax === "left" ? "end" : "start";
const ldx = (p: Pt) => (p.ax === "center" ? 0 : p.ax === "left" ? -9 : 9);
const tip = (p: Pt) => `${p.label}: ${p.y} % · ${p.eur} €/Task`;

// Pfeil „Besseres Preis-Leistungs-Verhältnis" von (20,5 € / 20 %) nach
// (12 € / 44 %) — Polygon in Pfeil-Koordinaten, per Gruppe rotiert.
const ax1 = px(20.5);
const ay1 = py(20);
const ax2 = px(12);
const ay2 = py(44);
const aAng = (Math.atan2(ay2 - ay1, ax2 - ax1) * 180) / Math.PI;
const aLen = Math.hypot(ax2 - ax1, ay2 - ay1);
const aW = 12; // halbe Schaftbreite
const aHW = 24; // halbe Spitzenbreite
const aHL = 34; // Spitzenlänge
const arrowPoly = (len: number, w: number, hw: number, hl: number) =>
  [
    [0, -w],
    [len - hl, -w],
    [len - hl, -hw],
    [len, 0],
    [len - hl, hw],
    [len - hl, w],
    [0, w],
  ]
    .map((p) => p.join(","))
    .join(" ");
const aBody = arrowPoly(aLen, aW, aHW, aHL);
const aMid = (aLen - aHL) / 2;

// Zwei Komponenten-Pfeile vom selben Ursprung (ax1,ay1): waagerecht nach links
// („Billiger" = niedrigere Kosten) und senkrecht nach oben („Leistungsfähiger"
// = höherer Pass@1). Bewusst dünner/heller als der Resultierende — sie zerlegen
// den Diagonalpfeil in seine zwei Achsen-Komponenten.
const cW = 9; // halbe Schaftbreite (Komponenten)
const cHW = 17; // halbe Spitzenbreite
const cHL = 24; // Spitzenlänge
const bLen = 250; // „Billiger" nach links
const cLen = 150; // „Leistungsfähiger" nach oben
const bBody = arrowPoly(bLen, cW, cHW, cHL);
const cBody = arrowPoly(cLen, cW, cHW, cHL);
const bMid = (bLen - cHL) / 2;
const cMid = (cLen - cHL) / 2;

// Fadenkreuz-Vergleichsmodus: Hover zeigt temporär, Klick pinnt permanent
// (erneuter Klick löst). Mehrere Pins gleichzeitig — die Einfüge-Reihenfolge
// bestimmt die Farbe (Cycle über die Deck-Töne).
const allPts = [...front, ...dom];
const byLabel = new Map(allPts.map((p) => [p.label, p]));
const hovered = ref<string | null>(null);
const pinned = ref<string[]>([]);

function togglePin(label: string) {
  const i = pinned.value.indexOf(label);
  if (i >= 0) pinned.value.splice(i, 1);
  else pinned.value.push(label);
}

const crosshairs = computed(() => {
  const active = pinned.value.map((label, i) => ({
    label,
    cls: `mp-ch-${i % 4}`,
  }));
  if (hovered.value && !pinned.value.includes(hovered.value)) {
    active.push({ label: hovered.value, cls: "mp-ch-hover" });
  }
  return active.flatMap(({ label, cls }) => {
    const p = byLabel.get(label);
    return p ? [{ p, cls }] : [];
  });
});
</script>

<template>
  <div class="mp-wrap">
    <div class="mp-legend">
      <span><i class="mp-sw mp-sw-front" />Pareto-Front</span>
      <span><i class="mp-sw mp-sw-dom" />dominiert</span>
      <span class="mp-note">
        Best Effort pro Modell · Hover: Fadenkreuz, Klick: fixieren
      </span>
      <button
        class="mp-ib"
        aria-label="Quellen und Einschränkungen anzeigen"
        @click="sourcesOpen = true"
      >
        ⓘ
      </button>
    </div>

    <svg
      class="mp-chart"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, unterteilt in vier Quadranten: Sweet Spot (billig und stark), Leistung um jeden Preis (teuer und stark), Budget-Ecke (billig und schwach), Geldverbrennung (teuer und schwach). Pareto-Front: muse-spark-1.1, grok-4.5, gpt-5.6-luna, kimi-k3, gpt-5.6-terra, gpt-5.6-sol, claude-opus-5. Claude Opus 5 ist das erste Claude-Modell auf der Front."
    >
      <!-- Quadranten-Tints -->
      <rect
        :x="L"
        :y="T"
        :width="QX - L"
        :height="QY - T"
        class="mp-q mp-q-sweet"
      />
      <rect
        :x="QX"
        :y="T"
        :width="W - R - QX"
        :height="QY - T"
        class="mp-q mp-q-price"
      />
      <rect
        :x="L"
        :y="QY"
        :width="QX - L"
        :height="H - B - QY"
        class="mp-q mp-q-budget"
      />
      <rect
        :x="QX"
        :y="QY"
        :width="W - R - QX"
        :height="H - B - QY"
        class="mp-q mp-q-burn"
      />

      <!-- Gitter + Achsen -->
      <g class="mp-grid">
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
      <g class="mp-qline">
        <line :x1="QX" :y1="T" :x2="QX" :y2="H - B" />
        <line :x1="L" :y1="QY" :x2="W - R" :y2="QY" />
      </g>
      <g class="mp-ticks">
        <text
          v-for="t in xTicks"
          :key="`xl${t}`"
          :x="px(t)"
          :y="H - B + 15"
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
        <text
          :x="L + (W - L - R) / 2"
          :y="H - 4"
          text-anchor="middle"
          class="mp-axis-title"
        >
          Ø Kosten pro Task (EUR) — DeepSWE Pass@1 (%)
        </text>
      </g>

      <!-- Quadranten-Labels -->
      <g class="mp-qlabel">
        <text :x="L + 10" :y="T + 16" class="mp-ql-sweet">Sweet Spot</text>
        <text :x="W - R - 10" :y="T + 16" text-anchor="end" class="mp-ql-price">
          Leistung um jeden Preis
        </text>
        <text :x="L + 10" :y="H - B - 8" class="mp-ql-budget">Budget-Ecke</text>
        <text
          :x="W - R - 10"
          :y="H - B - 8"
          text-anchor="end"
          class="mp-ql-burn"
        >
          Geldverbrennung
        </text>
      </g>

      <!-- Formen-Cluster der drei Blockpfeile: EIN opacity (auf
           .mp-arrow-cluster), Füllungen intern voll deckend & gleichfarbig →
           interne Überlappungen verschmelzen im Offscreen-Buffer nahtlos (keine
           dunklen Flecken, keine Nähte). Der Hub-Kreis (r ≥ größte Schaft-
           Halbbreite aW) schluckt die überstehenden Schaftecken → runder Knoten.
           Z-Order innerhalb egal (vereinte Silhouette). -->
      <g class="mp-arrow-cluster">
        <circle :cx="ax1" :cy="ay1" :r="aW + 2" />
        <g :transform="`translate(${ax1},${ay1}) rotate(180)`">
          <polygon :points="bBody" />
        </g>
        <g :transform="`translate(${ax1},${ay1}) rotate(-90)`">
          <polygon :points="cBody" />
        </g>
        <g :transform="`translate(${ax1},${ay1}) rotate(${aAng})`">
          <polygon :points="aBody" />
        </g>
      </g>

      <!-- Labels separat gerendert: erben NICHT die Cluster-Opacity, bleiben
           crisp. Jedes Label behält den Transform seines Pfeils. -->
      <g class="mp-arrow-labels">
        <g :transform="`translate(${ax1},${ay1}) rotate(180)`">
          <g :transform="`translate(${bMid},0) rotate(180)`">
            <text text-anchor="middle" dominant-baseline="middle">
              Billiger
            </text>
          </g>
        </g>
        <g :transform="`translate(${ax1},${ay1}) rotate(-90)`">
          <text :x="cMid" y="0" text-anchor="middle" dominant-baseline="middle">
            Leistungsfähiger
          </text>
        </g>
        <g :transform="`translate(${ax1},${ay1}) rotate(${aAng})`">
          <g :transform="`translate(${aMid},0) rotate(180)`">
            <text
              class="mp-label-lead"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              Besseres Preis-Leistungs-Verhältnis
            </text>
          </g>
        </g>
      </g>

      <!-- Pareto-Front -->
      <polyline :points="frontPath" class="mp-front-line" />
      <g v-for="p in front" :key="p.label">
        <circle :cx="px(p.x)" :cy="py(p.y)" r="5.5" class="mp-front-pt">
          <title>{{ tip(p) }}</title>
        </circle>
        <text
          :x="px(p.x) + ldx(p)"
          :y="py(p.y) + p.dy"
          :text-anchor="anchor(p)"
          class="mp-label mp-label-front"
        >
          {{ p.label }}
        </text>
      </g>

      <!-- Dominierte Modelle -->
      <g v-for="p in dom" :key="p.label">
        <rect
          :x="px(p.x) - 4.5"
          :y="py(p.y) - 4.5"
          width="9"
          height="9"
          class="mp-dom-pt"
        >
          <title>{{ tip(p) }}</title>
        </rect>
        <text
          :x="px(p.x) + ldx(p)"
          :y="py(p.y) + p.dy"
          :text-anchor="anchor(p)"
          class="mp-label mp-label-dom"
        >
          {{ p.label }}
        </text>
      </g>

      <!-- Fadenkreuze: Hover temporär, Klick fixiert (Vergleichsmodus) -->
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
          :y="H - B + 15"
          text-anchor="middle"
          class="mp-ch-badge"
        >
          {{ c.p.eur }} €
        </text>
        <text
          :x="L - 7"
          :y="py(c.p.y) + 3"
          text-anchor="end"
          class="mp-ch-badge"
        >
          {{ c.p.y }} %
        </text>
      </g>

      <!-- Unsichtbare Hit-Targets — zuletzt gerendert, fangen also die Events -->
      <circle
        v-for="p in allPts"
        :key="`hit-${p.label}`"
        :cx="px(p.x)"
        :cy="py(p.y)"
        r="11"
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
    </svg>

    <ModelRoutingSources :open="sourcesOpen" @close="sourcesOpen = false" />
  </div>
</template>

<style scoped>
.mp-wrap {
  margin-top: 4px;
}
.mp-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.mp-sw {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 5px;
  vertical-align: -1px;
}
.mp-sw-front {
  border-radius: 50%;
  background: var(--slidev-theme-primary);
}
.mp-sw-dom {
  border-radius: 2px;
  background: var(--color-text-tertiary);
}
.mp-note {
  margin-left: auto;
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.mp-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.mp-ib:hover {
  color: var(--color-text-primary);
}
.mp-chart {
  display: block;
  width: 100%;
  height: auto;
}

.mp-q-sweet {
  fill: color-mix(in srgb, var(--color-text-success) 7%, transparent);
}
.mp-q-price {
  fill: color-mix(in srgb, var(--color-text-warning) 6%, transparent);
}
.mp-q-budget {
  fill: color-mix(in srgb, var(--color-text-tertiary) 6%, transparent);
}
.mp-q-burn {
  fill: color-mix(in srgb, var(--color-text-danger) 7%, transparent);
}

.mp-grid line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.mp-qline line {
  stroke: var(--color-border-secondary);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.mp-ticks text {
  font-size: 10px;
  fill: var(--color-text-tertiary);
}
.mp-axis-title {
  font-size: 10px;
  fill: var(--color-text-tertiary);
}

.mp-qlabel text {
  font-size: 12px;
  font-weight: 600;
}
.mp-ql-sweet {
  fill: color-mix(in srgb, var(--color-text-success) 65%, transparent);
}
.mp-ql-price {
  fill: color-mix(in srgb, var(--color-text-warning) 65%, transparent);
}
.mp-ql-budget {
  fill: color-mix(in srgb, var(--color-text-tertiary) 75%, transparent);
}
.mp-ql-burn {
  fill: color-mix(in srgb, var(--color-text-danger) 65%, transparent);
}

/* Ein Alpha für den ganzen Pfeil-Cluster (nicht pro Polygon): SVG komponiert die
   Gruppe erst in einen Offscreen-Buffer und blendet dann als Ganzes — gleich-
   farbige, intern voll deckende Überlappungen verschwinden dabei nahtlos (kein
   Alpha-Stacking, keine Nähte). fill wird an Kreis + Polygone vererbt. */
.mp-arrow-cluster {
  fill: var(--color-text-success);
  opacity: 0.38;
}
/* Labels außerhalb der Opacity-Gruppe, damit sie crisp bleiben; grüner Text auf
   grüner Transluzenz + Gitter braucht ein Surface-Halo (wie .mp-ch-badge). */
.mp-arrow-labels text {
  font-size: 11px;
  fill: color-mix(in srgb, var(--color-text-success) 85%, transparent);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
}
.mp-label-lead {
  font-size: 12px;
}

.mp-front-line {
  fill: none;
  stroke: var(--slidev-theme-primary);
  stroke-width: 2;
  stroke-dasharray: 5 4;
}
.mp-front-pt {
  fill: var(--slidev-theme-primary);
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 2;
}
.mp-dom-pt {
  fill: var(--color-text-tertiary);
  opacity: 0.8;
}
.mp-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
}
.mp-label-front {
  fill: var(--color-text-primary);
}
.mp-label-dom {
  fill: var(--color-text-tertiary);
}

/* Fadenkreuze: --ch trägt die Farbe pro Pin (Cycle) bzw. neutral beim Hover. */
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
</style>
