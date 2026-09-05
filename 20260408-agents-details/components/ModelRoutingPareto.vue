<script setup lang="ts">
import { computed, ref } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";
import ProviderPicker from "./ProviderPicker.vue";
import { matchingPreset, presetModels } from "./providerFilter";
import {
  CURRENT,
  fmt,
  movedSegments,
  paretoFront,
  tip,
  type Pt,
} from "./paretoData";
import {
  labelBox,
  layoutLabels,
  type Obstacle,
  type Placed,
  type XY,
} from "./labelLayout";
import {
  arrowCluster,
  dodgeDetailed,
  frontUnion,
  HIT_R,
  LABEL_FONT,
  PARETO_SCALE,
  plotBounds,
  QUADRANTS,
  quadrantBoxes,
  tickLabel,
  toLayoutPoints,
  visiblePoints,
  X_TICKS_LOG,
  Y_TICKS,
} from "./paretoChrome";
import { useCrosshairs } from "./useCrosshairs";

// DeepSWE-Score vs. €/Task als statisches Inline-SVG — kein Chart.js/echarts
// nötig. Farben über die Deck-Tokens. Bewusst ohne <defs>: keine IDs, die
// zwischen Nachbar-Slides kollidieren könnten.
//
// Daten und die Herleitung der Preisänderungen stehen in `paretoData.ts`, die
// Geometrie (Skala, Ticks, Quadranten, Pfeile) in `paretoChrome.ts`, und wo
// eine Beschriftung steht, rechnet `labelLayout.ts`. Hier liegt nur die
// Darstellung.

const sourcesOpen = ref(false);

// Skala geteilt mit der Historien-Folie und den Tests: x logarithmisch von
// 0,08 € bis 30 €. Linear lagen 17 von 22 Markern auf einem Viertel der
// Breite, und die Sprossen 1 und 2 der Leiter waren 11 px auseinander.
const S = PARETO_SCALE;
const { W, H, L, R, T, B, px, py } = S;
const QX = px(8); // Quadranten-Trennung: 8 € …
const QY = py(50); // … / 50 % (redaktionell, wie im Original)
const xTicks = X_TICKS_LOG;
const yTicks = Y_TICKS;

// Optionales Overlay auf das Claude-Code-Wochenkontingent. Kein API-Preis,
// sondern eine Kontingentrechnung (Abo-Preis fix, Wochenlimit bindend ⇒
// €/Task ∝ 1/Kontingent), deshalb Default aus. An: die Claude-Punkte stehen auf
// den Kosten unter der +50-%-Aktion (×2/3, läuft bis 13.09.2026), der
// Geisterring auf denen ab 14.09., wenn Anthropic sie durch dauerhafte +25 %
// ersetzt (×0,8). Eine Rückkehr auf das Basislimit gibt es nicht — der Ring
// zeigt deshalb einen künftigen Stand, nicht den API-Preis.
const subOn = ref(false);

// Anbieter-Filter. Der Zustand ist eine Modellmenge (warum, steht in
// `providerFilter.ts`); Default ist alles. Jede Teilmenge blendet Punkte aus und
// die Front wird über den Rest neu gerechnet. Achsen und Quadranten bleiben fest
// — sonst wären die gefilterten Ansichten nicht miteinander vergleichbar.
//
// Der Filter greift VOR dem Kontingent-Overlay, damit sich beide kombinieren
// lassen: nur Anthropic plus Overlay zeigt die Claude-Kurve zum Abo-Preis.
const sel = ref<ReadonlySet<string>>(new Set(presetModels("all", CURRENT)));
const preset = computed(() => matchingPreset(sel.value, CURRENT));
const pts = computed<Pt[]>(() =>
  visiblePoints(CURRENT, sel.value, subOn.value),
);

const front = computed(() => paretoFront(pts.value).front);
const dom = computed(() => paretoFront(pts.value).dom);
const allPts = computed(() => pts.value);

// Entzerrung: Marker, die einander verdecken (sol/astra, terra/glm-5.3,
// muse-spark-1.2/qwen3.8-max), rücken bis 8 px auseinander — gerechnet auf
// dem VOLLEN Satz, damit der Anbieter-Filter nur ausblendet und nichts
// verschiebt; das Overlay bewegt nur die Claude-Punkte (`dodgeMarkers`).
// `at()` ist die angezeigte Lage für Marker, Sprossennummer, Front-Polyline,
// Klickziele, Fadenkreuz-Ring und Pfeilende. Fadenkreuz-Linien, Badges,
// Fehlerbalken und Geisterringe bleiben am wahren Wert.
const ALL = new Set(presetModels("all", CURRENT));
// Punkte, die in irgendeinem Preset auf der Front stehen, rücken nur
// waagerecht: Die Front darf in keiner Ansicht in der Höhe lügen.
const FRONT_UNION = frontUnion(CURRENT);
const dodge = computed(() =>
  dodgeDetailed(
    visiblePoints(CURRENT, ALL, subOn.value),
    S,
    "pareto",
    (p) => p.sub !== undefined,
    { horizontalOnly: FRONT_UNION },
  ),
);
const at = (p: Pt): XY =>
  dodge.value.pos.get(p.label) ?? { px: px(p.x), py: py(p.y) };
const dodgedMax = computed(() =>
  Math.max(0, ...dodge.value.moved.map((m) => Math.hypot(m.dx, m.dy))),
);

const frontPath = computed(() =>
  front.value.map((p) => `${at(p).px},${at(p).py}`).join(" "),
);

// Wanderungen: die gemini-Preiserhöhung zum 01.01. immer, die Kontingent-
// Rechnung nur bei eingeschaltetem Overlay (sie hängt am injizierten `old`).
// Der Pfeil endet an der angezeigten Lage, der Ring bleibt an der wahren.
const moved = computed(() => movedSegments(pts.value, S, undefined, at));

// Beschriftung. Gerechnet aus dem VOLLEN Datensatz, nicht aus `pts`: Der
// Filter blendet Labels nur aus, das Overlay bewegt nur die Claude-Labels mit
// ihren Markern — alles andere bleibt stehen, wo es war. Was das im Detail
// heißt, steht in `labelLayout.ts`; Hindernisse sind hier die Quadranten-
// Überschriften und der Pfeilcluster.
const cluster = arrowCluster(S);
const obstacles: Obstacle[] = [...quadrantBoxes(S), ...cluster.boxes];
const layoutOpts = {
  font: LABEL_FONT.pareto,
  bounds: plotBounds(S),
  hitR: HIT_R,
  obstacles,
};
const layoutPts = computed(() =>
  toLayoutPoints(CURRENT, S, {
    overlay: true,
    subOn: subOn.value,
    story: (p) => p.story === true,
    presets: true,
    pos: dodge.value.pos,
  }),
);
const layout = computed(() => layoutLabels(layoutPts.value, layoutOpts));

// „Alle Namen“: der zweite Durchgang des Platzierers. Er legt die im Default
// weggelassenen Namen mit Führungslinie nach und lässt jedes vorhandene Label,
// wo es ist — der Schalter fügt hinzu, er sortiert nicht um. Wo auch mit
// Linie kein Platz ist, überlappt das Label (`forced`); das ist der Preis der
// Vollständigkeit, und die QA zählt es dort als „weich“.
const allOn = ref(false);
const placed = computed(() =>
  allOn.value ? layout.value.all : layout.value.core,
);

interface LabelView {
  p: Pt;
  pl: Placed;
  front: boolean;
  /** Vorhergesagte Box (x y w h) — die Browser-QA hält sie gegen die gemessene. */
  box: string;
}
const boxAttr = (p: Pt, pl: Placed) => {
  const b = labelBox(p.label, pl.x, pl.y, pl.ax, LABEL_FONT.pareto);
  return [b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(" ");
};
const frontSet = computed(() => new Set(front.value.map((p) => p.label)));
const labels = computed<LabelView[]>(() =>
  pts.value.flatMap((p) => {
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
// Sichtbare Punkte ohne Namen — für die QA (`data-dropped`) und den Hover-Namen.
const unnamed = computed(() =>
  pts.value.filter((p) => !placed.value.has(p.label)).map((p) => p.label),
);

// Fadenkreuz-Vergleichsmodus: Hover zeigt temporär, Klick pinnt permanent
// (erneuter Klick löst). Mechanik im Composable, weil die Historien-Folie
// dasselbe kann; `ciBadge` schaltet die zweizeilige Badge-Entzerrung ein, die
// nur hier gebraucht wird (Fehlerbalken sind Sache dieser Folie).
const { byLabel, hovered, pinned, togglePin, activeCls, crosshairs, movedCls } =
  useCrosshairs(pts, S, { ciBadge: true });

// Hover-Name: Ein namenloser Punkt zeigt seinen Namen, solange er gehovt oder
// gepinnt ist — mit demselben Platzierer gegen die gesetzten Labels gerechnet,
// damit er keines verdeckt. Gerendert nach allem anderen, vor den Klickzielen.
const hoverLabels = computed<LabelView[]>(() => {
  const want = new Set([
    ...pinned.value,
    ...(hovered.value ? [hovered.value] : []),
  ]);
  const taken: Obstacle[] = [...placed.value.values()].map((v) => ({
    ...v.box,
    name: v.id,
  }));
  const out: LabelView[] = [];
  for (const id of want) {
    if (placed.value.has(id)) continue;
    const p = byLabel.value.get(id);
    const lp = layoutPts.value.find((q) => q.id === id);
    if (!p || !lp) continue;
    const pl = layoutLabels([lp], {
      ...layoutOpts,
      obstacles: [...obstacles, ...taken],
    }).all.get(id);
    if (pl) out.push({ p, pl, front: false, box: boxAttr(p, pl) });
  }
  return out;
});

const chartLabel = computed(
  () =>
    "Streudiagramm DeepSWE-Score gegen Kosten pro Task in Euro, x-Achse logarithmisch " +
    "von 0,1 bis 30 Euro, unterteilt in vier Quadranten: " +
    "Sweet Spot (billig und stark), Leistung um jeden Preis (teuer und stark), Budget-Ecke " +
    "(billig und schwach), Geldverbrennung (teuer und schwach). Stand 03.09.2026" +
    (sel.value.size === CURRENT.length
      ? ""
      : `, gefiltert auf ${preset.value?.label ?? "eine eigene Auswahl"} mit ${pts.value.length} von ${CURRENT.length} Modellen`) +
    `. Die Pareto-Front ist eine Leiter mit ${front.value.length} Sprossen; ` +
    "nimm die billigste, die Deine Aufgaben löst, und geh bei einem Fehlschlag eine höher. " +
    front.value
      .map(
        (p, i) =>
          `Sprosse ${i + 1}: ${p.label} mit ${p.y} Prozent für ${p.eur} Euro`,
      )
      .join(". ") +
    `. Zusammen kosten alle Sprossen ${fmt(front.value.reduce((s, p) => s + p.x, 0))} Euro. ` +
    "Alles rechts der Front ist dominiert: Es gibt dort einen Punkt, der mindestens " +
    "so gut und billiger ist. gpt-6-astra mit 5,71 Euro hat mit " +
    "74,12 Prozent den höchsten Rohwert des Boards und liegt trotzdem nicht auf der " +
    "Front — gemini-3.8-flash erreicht denselben gerundeten Wert für 2,07 Euro." +
    (allOn.value
      ? " Alle Namen sind eingeblendet, die nachgeholten mit Führungslinie."
      : unnamed.value.length
        ? ` ${unnamed.value.length} Punkte tragen keinen Namen, weil dort kein Platz ist; Hover oder Pin zeigt ihn, der Schalter „alle Namen“ alle.`
        : "") +
    (dodge.value.moved.length
      ? ` ${dodge.value.moved.length} Marker sind bis ${dodgedMax.value.toFixed(1).replace(".", ",")} Pixel auseinandergerückt, damit sie sich nicht verdecken; Fadenkreuz und Tooltip zeigen den wahren Wert.`
      : "") +
    (subOn.value
      ? " Das Claude-Code-Kontingent-Overlay ist eingeschaltet: die Claude-Punkte stehen auf " +
        "zwei Dritteln ihrer API-Kosten, wie es die Aktion bis 13.09.2026 hergibt; die " +
        "Geisterringe zeigen mit vier Fünfteln die Position ab 14.09.2026."
      : "") +
    " Der Geisterring an gemini-3.8-flash markiert 4,14 Euro — den Listenpreis ab dem " +
    "1. Januar 2027, wenn Googles Einführungspreis ausläuft." +
    ".",
);

// Fehlerbalken nur an gepinnten Punkten — beim bloßen Hover wäre das Flackern.
// Kernaussage der Folie: opus-5 74 ± 3,9 und sol 73 ± 2,8 überlappen deutlich,
// die Rangfolge an der Spitze ist Rauschen.
const whiskers = computed(() =>
  pinned.value.flatMap((label, i) => {
    const p = byLabel.value.get(label);
    return p?.ci ? [{ p, ci: p.ci, cls: `mp-ch-${i % 4}` }] : [];
  }),
);
</script>

<template>
  <div class="mp-wrap">
    <div class="mp-legend">
      <span><i class="mp-sw mp-sw-front" />Pareto-Front</span>
      <span><i class="mp-sw mp-sw-dom" />dominiert</span>
      <!-- Seit Stand 8 zeigt der Ring ausschließlich KÜNFTIGE Preise, nie mehr
           vergangene: ohne Overlay den Listenpreis von gemini-3.8-flash ab
           01.01.2027, mit Overlay zusätzlich den Kontingent-Stand der
           Claude-Punkte ab 14.09. Der Sol-Ring („vorher 7,35 €") ist mit dem
           Stand vom 02.09. weggefallen und lebt nur noch auf der
           Historien-Folie. Der Text wird getauscht statt ergänzt, sonst bricht
           die Legendenzeile um; ausführlich steht es im Tooltip und im ⓘ. -->
      <span>
        <i class="mp-sw mp-sw-old" />{{
          subOn ? "künftig: ab 01.01. / 14.09." : "Preis ab 01.01.2027"
        }}
      </span>
      <button
        class="mp-tg"
        :class="{ on: subOn }"
        :aria-pressed="subOn"
        title="Kontingentrechnung, kein API-Preis: ×2/3 bis 13.09., ab 14.09. ×0,8"
        @click="subOn = !subOn"
      >
        Claude-Code-Kontingent
        <span class="mp-tg-note">kein API-Preis</span>
      </button>
      <button
        class="mp-tg mp-tg-all"
        :class="{ on: allOn }"
        :aria-pressed="allOn"
        title="Auch die Namen zeigen, für die direkt am Marker kein Platz war — mit Führungslinie"
        @click="allOn = !allOn"
      >
        alle Namen
      </button>
      <!-- Die Legendenzeile ist nowrap und war mit zwei Schaltern und der
           langen Kontingent-Notiz exakt voll (scrollWidth == clientWidth ==
           868 px). Für „alle Namen“ ist die Notiz auf „kein API-Preis“
           gekürzt, der Rest steht im title und im ⓘ. Der gebündelte
           Overflow-Checker sieht diese Richtung NICHT — er misst nur nach
           unten. Wer hier Text ergänzt, prüft mit
           playwright-tests/legend-width-check.ts. -->
      <ProviderPicker v-model="sel" :pts="CURRENT" />
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
      :data-dropped="unnamed.join(' ')"
      :data-all="allOn ? 'on' : 'off'"
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
        <text
          :x="L + (W - L - R) / 2"
          :y="H - 4"
          text-anchor="middle"
          class="mp-axis-title"
        >
          Ø Kosten pro Task (EUR, log. Skala) — DeepSWE Pass@1 (%)
        </text>
      </g>

      <!-- Quadranten-Überschriften — Texte und Lage aus `paretoChrome.ts`, weil
           der Platzierer sie als Hindernis kennt. -->
      <g class="mp-qlabel">
        <text
          v-for="q in QUADRANTS"
          :key="q.key"
          :x="q.x(S)"
          :y="q.y(S)"
          :text-anchor="q.ax"
          :class="`mp-ql-${q.key}`"
        >
          {{ q.text }}
        </text>
      </g>

      <!-- Formen-Cluster der drei Blockpfeile: EIN opacity (auf
           .mp-arrow-cluster), Füllungen intern voll deckend & gleichfarbig →
           interne Überlappungen verschmelzen im Offscreen-Buffer nahtlos (keine
           dunklen Flecken, keine Nähte). Der Hub-Kreis (r ≥ größte Schaft-
           Halbbreite aW) schluckt die überstehenden Schaftecken → runder Knoten.
           Z-Order innerhalb egal (vereinte Silhouette). -->
      <g class="mp-arrow-cluster">
        <circle :cx="cluster.hub.x" :cy="cluster.hub.y" :r="cluster.hub.r" />
        <g
          v-for="a in cluster.arrows"
          :key="a.key"
          :transform="`translate(${cluster.hub.x},${cluster.hub.y}) rotate(${a.rot})`"
        >
          <polygon :points="a.poly" />
        </g>
      </g>

      <!-- Labels separat gerendert: erben NICHT die Cluster-Opacity, bleiben
           crisp. Jedes Label behält den Transform seines Pfeils; `flip` dreht
           den Text zurück, wo er sonst kopfstünde. -->
      <g class="mp-arrow-labels">
        <g
          v-for="a in cluster.arrows"
          :key="`t-${a.key}`"
          :transform="`translate(${cluster.hub.x},${cluster.hub.y}) rotate(${a.rot})`"
        >
          <g :transform="`translate(${a.mid},0) rotate(${a.flip ? 180 : 0})`">
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              :class="{ 'mp-label-lead': a.key === 'better' }"
            >
              {{ a.text }}
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
        <circle :cx="m.gx" :cy="m.gy" r="5" class="mp-old-pt">
          <title>
            {{ m.label }}: {{ m.pre }} {{ m.eur }} €/Task — {{ m.why }}
          </title>
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

      <!-- Leere Auswahl. Achsen und Quadranten bleiben stehen, damit sichtbar
           bleibt, dass hier nichts fehlt, sondern nichts gewählt ist. Der
           Hinweis sitzt oben links im Sweet-Spot-Quadranten: mittig liefe er
           quer durch die beiden Richtungspfeile und wäre unlesbar. -->
      <text v-if="!pts.length" :x="L + 12" :y="T + 52" class="mp-leer">
        Kein Modell ausgewählt — im Anbieter-Menü mindestens ein Lab anhaken
      </text>

      <!-- Pareto-Front -->
      <polyline :points="frontPath" class="mp-front-line" />
      <!-- Sprossennummer IM Marker: Die Folie empfiehlt, unten anzufangen und
           bei einem Fehlschlag eine Sprosse höher zu gehen. Als Präfix am Label
           kostete die Nummer 12 px Breite in der dichtesten Zone; im Marker
           kostet sie nichts. Die Zählung folgt dem Anbieter-Filter. -->
      <g v-for="(p, i) in front" :key="p.label">
        <circle :cx="at(p).px" :cy="at(p).py" r="7" class="mp-front-pt">
          <title>{{ tip(p) }}</title>
        </circle>
        <text
          :x="at(p).px"
          :y="at(p).py"
          class="mp-front-num"
          aria-hidden="true"
        >
          {{ i + 1 }}
        </text>
      </g>

      <!-- Dominierte Modelle -->
      <g v-for="p in dom" :key="p.label">
        <rect
          :x="at(p).px - 5"
          :y="at(p).py - 5"
          width="10"
          height="10"
          class="mp-dom-pt"
        >
          <title>{{ tip(p) }}</title>
        </rect>
      </g>

      <!-- Beschriftungen als eigene Schicht nach allen Markern, damit ihr Halo
           über den Punkten liegt. Wo sie stehen, sagt `labelLayout.ts`; die
           Beschriftung ist zugleich der zweite Griff an einem Punkt. Zwillinge
           wie gpt-5.6-sol und gpt-6-astra rückt die Entzerrung auseinander,
           seither trifft auch das Klickziel den richtigen Punkt. -->
      <text
        v-for="l in labels"
        :key="`lbl-${l.p.label}`"
        :x="l.pl.x"
        :y="l.pl.y"
        :text-anchor="l.pl.ax"
        class="mp-label"
        :class="l.front ? 'mp-label-front' : 'mp-label-dom'"
        :data-model="l.p.label"
        :data-box="l.box"
        @mouseenter="hovered = l.p.label"
        @mouseleave="hovered = null"
        @click.stop="togglePin(l.p.label)"
      >
        {{ l.p.label }}
      </text>

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
        <circle :cx="at(c.p).px" :cy="at(c.p).py" r="9.5" class="mp-ch-ring" />
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

      <!-- Hover-Name für Punkte ohne Beschriftung: transient, zuoberst. -->
      <text
        v-for="l in hoverLabels"
        :key="`hover-${l.p.label}`"
        :x="l.pl.x"
        :y="l.pl.y"
        :text-anchor="l.pl.ax"
        class="mp-label mp-label-hover"
        :data-model="l.p.label"
        :data-box="l.box"
      >
        {{ l.p.label }}
      </text>

      <!-- Unsichtbare Hit-Targets — zuletzt gerendert, fangen also die Events.
           Ihr Radius ist zugleich das Hindernis des Platzierers: kein Label
           liegt unter einem fremden Klickziel. Sie sitzen auf der angezeigten
           Lage, damit ein Klick auf einen entzerrten Marker diesen trifft. -->
      <circle
        v-for="p in allPts"
        :key="`hit-${p.label}`"
        :cx="at(p).px"
        :cy="at(p).py"
        :r="HIT_R"
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
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
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
  font-size: 11px;
  fill: var(--color-text-tertiary);
}
.mp-axis-title {
  font-size: 11px;
  fill: var(--color-text-tertiary);
}

/* Schriftgröße auch in `paretoChrome.ts` (QUADRANT_FONT): der Platzierer kennt
   die Überschriften als Hindernis und rechnet ihre Box daraus. */
.mp-qlabel text {
  font-size: 13px;
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

.mp-leer {
  font-size: 12px;
  fill: var(--color-text-tertiary);
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
.mp-front-num {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  font-weight: 700;
  fill: var(--deck-surface, var(--color-background-primary));
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.mp-dom-pt {
  fill: var(--color-text-tertiary);
  opacity: 0.8;
}
/* Haarlinie zwischen Marker und abgesetzter Beschriftung — bewusst dünner als
   das Gitter, sie soll führen und nicht auffallen. */
.mp-leader {
  stroke: var(--color-text-tertiary);
  stroke-width: 0.9;
  opacity: 0.7;
}
/* Schriftgröße auch in `paretoChrome.ts` (LABEL_FONT.pareto): daraus rechnet
   der Platzierer die Box, und die Browser-QA misst nach, ob sie stimmt. */
.mp-label {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 12px;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3px;
  cursor: pointer;
}
.mp-label-front {
  fill: var(--color-text-primary);
}
.mp-label-dom {
  fill: var(--color-text-tertiary);
}
.mp-label-hover {
  fill: var(--color-text-primary);
  font-weight: 700;
  pointer-events: none;
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
</style>
