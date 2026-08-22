<script setup lang="ts">
import { computed, ref } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";
import {
  CURRENT,
  anchor,
  fmt,
  leader,
  lx,
  ly,
  makeScale,
  movedSegments,
  paretoFront,
  tip,
  type Pt,
} from "./paretoData";

// DeepSWE-Score vs. €/Task als statisches Inline-SVG — kein Chart.js/echarts
// nötig. Farben über die Deck-Tokens. Bewusst ohne <defs>: keine IDs, die
// zwischen Nachbar-Slides kollidieren könnten.
//
// Daten, Umrechnung und die Herleitung der Sol-Preissenkung stehen in
// `paretoData.ts`; hier liegt nur die Darstellung.

const sourcesOpen = ref(false);

// Geometrie (logische Pixel im 932er-viewBox). Vorher 316/38: B um 5 gesenkt
// (schmaleres Band unter der X-Achse, Tick-Baseline H - B + 15 und Achsentitel
// H - 4 behalten 14 px Abstand), H um 10 — die Plotfläche H - T - B schrumpft
// dadurch von 268 auf 263. Beides zusammen schafft den Platz, den die um eine
// Zeile gewachsene Pointe unter dem Chart braucht.
const S = makeScale({
  W: 932,
  H: 306,
  L: 46,
  R: 10,
  T: 10,
  B: 33,
  xMax: 25,
  yMax: 80,
});
const { W, H, L, R, T, B, px, py } = S;
const QX = px(8); // Quadranten-Trennung: 8 € …
const QY = py(50); // … / 50 % (redaktionell, wie im Original)

// Optionales Overlay: Claude Code läuft vom 13.05. bis 31.08.2026 mit 50 %
// höherem Wochenlimit. Das ist kein API-Preis, sondern eine Kontingentrechnung
// (Abo-Preis fix, Wochenlimit bindend ⇒ €/Task ∝ 1/Kontingent ⇒ ×2/3), deshalb
// Default aus. An: die Claude-Punkte wandern auf ihre Kontingent-Kosten, am
// API-Preis bleibt ein Geisterring — das ist die Position ab 01.09.2026.
const subOn = ref(false);

const pts = computed<Pt[]>(() =>
  subOn.value
    ? CURRENT.map((p) =>
        p.sub
          ? {
              ...p,
              x: p.sub,
              eur: fmt(p.sub),
              old: {
                x: p.x,
                eur: p.eur,
                why: "ohne Kontingent-Aktion — Stand ab 01.09.2026",
              },
            }
          : p,
      )
    : CURRENT,
);

const front = computed(() => paretoFront(pts.value).front);
const dom = computed(() => paretoFront(pts.value).dom);
const allPts = computed(() => pts.value);
const frontPath = computed(() =>
  front.value.map((p) => `${px(p.x)},${py(p.y)}`).join(" "),
);

// Wanderungen: die Sol-Preissenkung vom 21.08. immer, die Kontingent-Rechnung
// nur bei eingeschaltetem Overlay (sie hängt am injizierten `old`).
const moved = computed(() => movedSegments(pts.value, S));

// Führungslinien für die weit abgesetzten Beschriftungen im 2–5-€-Gedränge.
const leaders = computed(() =>
  pts.value.flatMap((p) => {
    const l = leader(p, S);
    return l ? [{ label: p.label, ...l }] : [];
  }),
);
const LX = (p: Pt) => lx(p, S);
const LY = (p: Pt) => ly(p, S);

const chartLabel = computed(
  () =>
    "Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, unterteilt in vier Quadranten: " +
    "Sweet Spot (billig und stark), Leistung um jeden Preis (teuer und stark), Budget-Ecke " +
    "(billig und schwach), Geldverbrennung (teuer und schwach). Pareto-Front am 21.08.2026: " +
    front.value
      .map((p) => `${p.label} mit ${p.y} Prozent für ${p.eur} Euro`)
      .join(", ") +
    ". Claude Opus 5 führt, gpt-5.6-sol liegt einen Punkt dahinter — die Konfidenzintervalle " +
    "überlappen." +
    (subOn.value
      ? " Das Claude-Code-Kontingent-Overlay ist eingeschaltet: die Claude-Punkte stehen auf " +
        "zwei Dritteln ihrer API-Kosten, die Geisterringe zeigen die Position ab 01.09.2026."
      : ""),
);

const xTicks = [0, 5, 10, 15, 20, 25];
const yTicks = [0, 20, 40, 60, 80];

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
const byLabel = computed(() => new Map(pts.value.map((p) => [p.label, p])));
const hovered = ref<string | null>(null);
const pinned = ref<string[]>([]);

function togglePin(label: string) {
  const i = pinned.value.indexOf(label);
  if (i >= 0) pinned.value.splice(i, 1);
  else pinned.value.push(label);
}

// label → Farbklasse (Pin-Farbe aus dem Cycle, bzw. neutral beim Hover).
// Fadenkreuz UND Wanderung lesen dieselbe Quelle, damit Geisterpunkt und Pfeil
// im selben Ton mitleuchten wie das Fadenkreuz ihres Punkts.
const activeCls = computed(() => {
  const m = new Map<string, string>();
  pinned.value.forEach((label, i) => m.set(label, `mp-ch-${i % 4}`));
  if (hovered.value && !m.has(hovered.value)) {
    m.set(hovered.value, "mp-ch-hover");
  }
  return m;
});

// Zwei Pins mit einem Punkt Score-Unterschied liegen gut 3 px auseinander —
// ihre Achsen-Badges lägen übereinander. Deshalb werden sie beim Aufbau
// auseinandergeschoben (die Fadenkreuz-Linie bleibt exakt): 22 px, sobald ein
// Badge zweizeilig wird, sonst 11.
const crosshairs = computed(() => {
  const list = [...activeCls.value].flatMap(([label, cls]) => {
    const p = byLabel.value.get(label);
    return p ? [{ p, cls, badgeY: py(p.y) + 3 }] : [];
  });
  const gap = list.some((c) => c.p.ci && pinned.value.includes(c.p.label))
    ? 22
    : 11;
  let last = -Infinity;
  for (const c of [...list].sort((a, b) => a.badgeY - b.badgeY)) {
    c.badgeY = Math.max(c.badgeY, last + gap);
    last = c.badgeY;
  }
  return list;
});

// Fehlerbalken nur an gepinnten Punkten — beim bloßen Hover wäre das Flackern.
// Kernaussage der Folie: opus-5 74 ± 3,9 und sol 73 ± 2,8 überlappen deutlich,
// die Rangfolge an der Spitze ist Rauschen.
const whiskers = computed(() =>
  pinned.value.flatMap((label, i) => {
    const p = byLabel.value.get(label);
    return p?.ci ? [{ p, ci: p.ci, cls: `mp-ch-${i % 4}` }] : [];
  }),
);

// Leer, solange der zugehörige Punkt weder gehovt noch gepinnt ist.
const movedCls = (label: string) => {
  const cls = activeCls.value.get(label);
  return cls ? `mp-moved-on ${cls}` : "";
};
</script>

<template>
  <div class="mp-wrap">
    <div class="mp-legend">
      <span><i class="mp-sw mp-sw-front" />Pareto-Front</span>
      <span><i class="mp-sw mp-sw-dom" />dominiert</span>
      <span><i class="mp-sw mp-sw-old" />vor der Preisanpassung</span>
      <button
        class="mp-tg"
        :class="{ on: subOn }"
        :aria-pressed="subOn"
        @click="subOn = !subOn"
      >
        Claude-Code-Kontingent +50 %
        <span class="mp-tg-note">kein API-Preis</span>
      </button>
      <span class="mp-note">Punkt/Label klicken: Fehlerbalken</span>
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
      :aria-label="chartLabel"
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

      <!-- Preisanpassungen: Geisterpunkt an der alten Position, gestrichelte
           Wanderungslinie zur neuen. Vor den Front-Punkten gerendert, damit
           deren Kreise oben liegen. Pfeilspitze als <polygon> statt <marker> —
           die Komponente kommt bewusst ohne <defs> aus. -->
      <g
        v-for="m in moved"
        :key="`old-${m.label}`"
        class="mp-moved"
        :class="movedCls(m.label)"
      >
        <line :x1="m.x1" :y1="m.y1" :x2="m.x2" :y2="m.y2" />
        <polygon :points="m.head" />
        <circle :cx="m.gx" :cy="m.gy" r="4" class="mp-old-pt">
          <title>{{ m.label }}: vorher {{ m.eur }} €/Task — {{ m.why }}</title>
        </circle>
      </g>

      <!-- Führungslinien vor den Markern, damit deren Kreise oben liegen -->
      <line
        v-for="l in leaders"
        :key="`ld-${l.label}`"
        :x1="l.x1"
        :y1="l.y1"
        :x2="l.x2"
        :y2="l.y2"
        class="mp-leader"
      />

      <!-- Pareto-Front -->
      <polyline :points="frontPath" class="mp-front-line" />
      <g v-for="p in front" :key="p.label">
        <circle :cx="px(p.x)" :cy="py(p.y)" r="5.5" class="mp-front-pt">
          <title>{{ tip(p) }}</title>
        </circle>
        <text
          :x="LX(p)"
          :y="LY(p)"
          :text-anchor="anchor(p)"
          class="mp-label mp-label-front"
          :data-model="p.label"
          @mouseenter="hovered = p.label"
          @mouseleave="hovered = null"
          @click.stop="togglePin(p.label)"
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
          :x="LX(p)"
          :y="LY(p)"
          :text-anchor="anchor(p)"
          class="mp-label mp-label-dom"
          :data-model="p.label"
          @mouseenter="hovered = p.label"
          @mouseleave="hovered = null"
          @click.stop="togglePin(p.label)"
        >
          {{ p.label }}
        </text>
      </g>

      <!-- Fehlerbalken der gepinnten Punkte: senkrechter Whisker am Punkt plus
           zwei waagerechte Grenzlinien quer durch den Plot. Erst die Grenzlinien
           machen sichtbar, dass zwei Intervalle einander überlappen. -->
      <g
        v-for="w in whiskers"
        :key="`ci-${w.p.label}`"
        class="mp-ci"
        :class="w.cls"
      >
        <!-- Transluzentes Band zwischen den Intervallgrenzen: zwei gepinnte
             Punkte zeigen ihre Überlappung als dunklere Schnittfläche, ohne dass
             man Linien abzählen muss. -->
        <rect
          :x="L"
          :y="py(w.p.y + w.ci)"
          :width="W - R - L"
          :height="py(w.p.y - w.ci) - py(w.p.y + w.ci)"
          class="mp-ci-band"
        />
        <line
          :x1="L"
          :y1="py(w.p.y + w.ci)"
          :x2="W - R"
          :y2="py(w.p.y + w.ci)"
          class="mp-ci-bound"
        />
        <line
          :x1="L"
          :y1="py(w.p.y - w.ci)"
          :x2="W - R"
          :y2="py(w.p.y - w.ci)"
          class="mp-ci-bound"
        />
        <line
          :x1="px(w.p.x)"
          :y1="py(w.p.y - w.ci)"
          :x2="px(w.p.x)"
          :y2="py(w.p.y + w.ci)"
          class="mp-ci-bar"
        />
        <line
          :x1="px(w.p.x) - 5"
          :y1="py(w.p.y + w.ci)"
          :x2="px(w.p.x) + 5"
          :y2="py(w.p.y + w.ci)"
          class="mp-ci-bar"
        />
        <line
          :x1="px(w.p.x) - 5"
          :y1="py(w.p.y - w.ci)"
          :x2="px(w.p.x) + 5"
          :y2="py(w.p.y - w.ci)"
          class="mp-ci-bar"
        />
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
        <text :x="L - 7" :y="c.badgeY" text-anchor="end" class="mp-ch-badge">
          {{ c.p.y }} %
        </text>
        <!-- Das Konfidenzintervall in den linken Rand statt an den Whisker: im
             Chart selbst ist um die Spitzenmodelle herum keine Zeile mehr frei. -->
        <text
          v-if="c.p.ci && pinned.includes(c.p.label)"
          :x="L - 7"
          :y="c.badgeY + 10"
          text-anchor="end"
          class="mp-ch-badge mp-ci-badge"
        >
          ± {{ String(c.p.ci).replace(".", ",") }}
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
  margin-top: 0;
}
.mp-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 0;
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
.mp-sw-old {
  box-sizing: border-box;
  border: 1.4px solid var(--color-text-tertiary);
  border-radius: 50%;
  background: none;
  opacity: 0.75;
}
/* Opt-in-Overlay, deshalb als Schalter und nicht als Legenden-Swatch: der
   Kontingent-Wert ist eine Rechnung, kein gemessener Preis. */
.mp-tg {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 1px 7px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  background: none;
  font: inherit;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.mp-tg:hover {
  color: var(--color-text-secondary);
}
.mp-tg.on {
  border-color: var(--color-text-info);
  background: color-mix(in srgb, var(--color-text-info) 12%, transparent);
  color: var(--color-text-primary);
}
.mp-tg-note {
  font-size: 9.5px;
  opacity: 0.7;
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

/* Wanderung durch eine Preisanpassung: Geisterpunkt, Linie und Spitze in der
   „dominiert"-Farbe — die alte Position soll klar als überholt lesen und dem
   Front-Ton (Primary) nicht die Aufmerksamkeit wegnehmen. */
.mp-moved {
  opacity: 0.75;
  transition: opacity 120ms ease;
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
/* Punkt gehovt oder gepinnt → seine Herkunft leuchtet mit, im selben --ch-Ton
   wie das Fadenkreuz. Macht bei mehreren Pins zuordenbar, welcher Geisterpunkt
   zu welchem Modell gehört. */
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
/* Haarlinie zwischen Marker und abgesetzter Beschriftung — bewusst dünner als
   das Gitter, sie soll führen und nicht auffallen. */
.mp-leader {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.6;
  opacity: 0.7;
}
/* Die Beschriftung ist der zweite Griff an einem Punkt — und für gpt-5.6-terra
   der einzige: sein Marker liegt einen Pixel neben dem von glm-5.3, dessen
   Hit-Target ihn vollständig überdeckt. */
.mp-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 2.5px;
  cursor: pointer;
}
.mp-label-front {
  fill: var(--color-text-primary);
}
.mp-label-dom {
  fill: var(--color-text-tertiary);
}

/* Fehlerbalken: Whisker kräftig am Punkt, Grenzlinien quer durch den Plot nur
   angedeutet — zwei gepinnte Punkte zeigen so auf einen Blick, ob sich ihre
   Intervalle schneiden. */
.mp-ci {
  pointer-events: none;
}
.mp-ci-bar {
  stroke: var(--ch);
  stroke-width: 1.8;
}
.mp-ci-band {
  fill: var(--ch);
  opacity: 0.09;
}
.mp-ci-bound {
  stroke: var(--ch);
  stroke-width: 0.8;
  stroke-dasharray: 1 4;
  opacity: 0.55;
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
