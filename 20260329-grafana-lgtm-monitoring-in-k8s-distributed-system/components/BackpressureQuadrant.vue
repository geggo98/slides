<script setup>
/**
 * Back-Pressure als Regelkreise — Magic-Quadrant-Streudiagramm.
 *
 * Zwei Achsen ordnen jeden Back-Pressure-Mechanismus ein und quantifizieren
 * seine Ausprägung *relativ* über die Position:
 *   X (Bremsform):  binär · Bang-Bang  →  proportional
 *   Y (Gedächtnis): zustandsarm · Rate →  zustandsbehaftet · Pegel
 *
 * Y-Leitlinie: zustandsbehaftet ist ein Mechanismus, dessen Auslöser ein
 * gespeicherter Zähler oder Füllstand ist (Puffer, Heap, Lag, Credit- oder
 * Fensterzähler, Token-Bucket, In-Flight-Zahl). Zustandsarm ist er nur, wenn
 * der Auslöser ein Momentanwert ist (Zeit pro Request, CPU-Rate, Erfolgsquote
 * im kurzen Fenster). Je länger das Glättungsfenster, desto höher der Punkt.
 *
 * Jeder der vier Quadranten trägt einen Namen. Der „Metastabile Fehler“ ist
 * kein eigener Punkt, sondern eine Eskalation aus dem Schwellwert-Wehr heraus
 * (super-lineare Rückkopplung = effektiv unendliche Hysterese) und wird als
 * roter Pfeil über die obere-linke Ecke hinaus markiert.
 *
 * In jeder Ecke läuft zusätzlich eine kleine Spur (grau = Last, Farbe =
 * Reaktion), die das typische Verhalten des Quadranten zeigt. Ein Klick auf
 * die Spur (ⓘ) hält alle Spuren an, dimmt die Folie und öffnet einen Dialog
 * mit der vergrößerten Spur und einer Abgrenzung zu den anderen Quadranten;
 * Klick irgendwohin oder Escape schließt und setzt die Animationen fort.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onSlideLeave, useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

// Quadranten-Akzentfarben (heller im Dark-Mode für Kontrast auf dunklem Grund).
const QUAD_COLORS = {
  wehr: { dark: "#fb923c", light: "#ea580c" }, // orange
  regler: { dark: "#4ade80", light: "#16a34a" }, // grün
  reflex: { dark: "#c084fc", light: "#9333ea" }, // violett
  daempfer: { dark: "#22d3ee", light: "#0891b2" }, // cyan
};

const cssVars = computed(() => {
  const d = isDark.value;
  const c = (k) => QUAD_COLORS[k][d ? "dark" : "light"];
  return {
    "--bpq-text": d ? "#e2e8f0" : "#1e293b",
    "--bpq-muted": d ? "#94a3b8" : "#64748b",
    "--bpq-dim": d ? "#64748b" : "#94a3b8",
    "--bpq-card": d ? "#0f172a" : "#ffffff",
    "--bpq-line": d ? "rgba(148,163,184,0.28)" : "rgba(100,116,139,0.32)",
    "--bpq-frame": d ? "rgba(148,163,184,0.22)" : "rgba(100,116,139,0.22)",
    "--bpq-danger": d ? "#f87171" : "#dc2626",
    "--bpq-wehr": c("wehr"),
    "--bpq-regler": c("regler"),
    "--bpq-reflex": c("reflex"),
    "--bpq-daempfer": c("daempfer"),
  };
});

// Vier Quadranten: corner steuert die Platzierung des Namens-Chips.
const QUADS = [
  {
    key: "wehr",
    name: "Schwellwert-Wehr",
    sub: "hohe Hysterese · gut vorhersagbar",
    corner: "tl",
  },
  {
    key: "regler",
    name: "Pegel-Regler",
    sub: "vorhersagbar · sanft",
    corner: "tr",
  },
  {
    key: "reflex",
    name: "Stop-and-Go-Reflex",
    sub: "schnell · nur detektierbar",
    corner: "bl",
  },
  {
    key: "daempfer",
    name: "Mitlauf-Dämpfer",
    sub: "selbststabilisierend",
    corner: "br",
  },
];

// Eck-Animationen: je Quadrant eine winzige, endlos scrollende Spur. Grau =
// Last (Zufluss), Quadrantenfarbe = Reaktion. Fläche = Pegel (Gedächtnis),
// Linie = Rate; harte Kanten = binär, glatte Kurve = proportional.
// Alle Folgen sind periodisch mit Periode PERIOD; der Pfad deckt zwei
// Perioden ab und wird per CSS um genau eine verschoben (nahtlose Schleife).
const PERIOD = 64;
const TH = 24; // Spurhöhe
const yOf = (v) => (TH - 1 - v * (TH - 2)).toFixed(1);
const linePath = (vals) =>
  vals.map((v, i) => `${i ? "L" : "M"}${i},${yOf(v)}`).join("");
const areaPath = (vals) =>
  `M0,${TH}${vals.map((v, i) => `L${i},${yOf(v)}`).join("")}L${vals.length - 1},${TH}Z`;
const samples = (f) => Array.from({ length: 2 * PERIOD + 1 }, (_, i) => f(i));
const phase = (i) => i % PERIOD;
const TAU = 2 * Math.PI;

// Wehr: Pegel steigt bis zur Set-Schwelle, Bremse an, fällt bis zur
// Reset-Schwelle (Sägezahn im Hystereseband).
const WEHR = { set: 0.8, reset: 0.3 };
const wehr = {
  level: samples((i) => {
    const p = phase(i);
    return p < 38
      ? WEHR.reset + ((WEHR.set - WEHR.reset) * p) / 38
      : WEHR.set - ((WEHR.set - WEHR.reset) * (p - 38)) / 26;
  }),
  load: samples(() => 0.92),
};

// Regler: Zufluss ∝ Abstand zum Sollwert — Pegel nähert sich exponentiell.
const regler = (() => {
  const load = (p) => (p < 32 ? 0.9 : 0.4);
  const out = [];
  let level = 0.4;
  for (let i = 0; i < 4 * PERIOD + 1; i++) {
    level += (load(phase(i)) - level) * 0.09;
    out.push(level);
  }
  return {
    level: out.slice(2 * PERIOD),
    load: samples((i) => load(phase(i))),
  };
})();

// Reflex: sobald die Last die Grenze reißt, fällt die Rate sofort auf 0 und
// kehrt ebenso sofort zurück — kein Gedächtnis, kein Band.
const REFLEX_LIMIT = 0.68;
const reflexLoad = (i) => {
  const p = phase(i);
  const spike = p >= 20 && p < 28 ? 0.3 : 0;
  return 0.42 + 0.14 * Math.sin((TAU * p) / 16) + spike;
};
const reflex = {
  load: samples(reflexLoad),
  rate: samples((i) => (reflexLoad(i) > REFLEX_LIMIT ? 0.04 : reflexLoad(i))),
};

// Dämpfer: Rate folgt der welligen Last, oberhalb des Knies weich gestaucht.
const daempferLoad = (i) => {
  const p = phase(i);
  return (
    0.55 +
    0.3 * Math.sin((TAU * p) / PERIOD) +
    0.12 * Math.sin((TAU * 3 * p) / PERIOD)
  );
};
const daempfer = {
  load: samples(daempferLoad),
  rate: samples((i) => 0.65 * Math.tanh(daempferLoad(i) / 0.65)),
};

const TRACES = {
  wehr: {
    dur: 5.2,
    fill: areaPath(wehr.level),
    line: linePath(wehr.level),
    load: linePath(wehr.load),
    marks: [WEHR.set, WEHR.reset],
  },
  regler: {
    dur: 6.4,
    fill: areaPath(regler.level),
    line: linePath(regler.level),
    load: linePath(regler.load),
    marks: [0.65],
  },
  reflex: {
    dur: 4.4,
    line: linePath(reflex.rate),
    load: linePath(reflex.load),
    marks: [REFLEX_LIMIT],
  },
  daempfer: {
    dur: 5.8,
    line: linePath(daempfer.rate),
    load: linePath(daempfer.load),
    marks: [],
  },
};

// Mechanismen mit *relativer* Ausprägung auf beiden Achsen (0..1).
// s = Seite des Labels relativ zum Punkt ('r' rechts, 'l' links) — Labels
// wachsen zur Mitte, damit die Plot-Ränder frei bleiben.
const POINTS = [
  // Schwellwert-Wehr — zustandsbehaftet + binär
  { l: "OOM-Kill", x: 0.07, y: 0.93, q: "wehr", s: "r" },
  { l: "ZGC-Stall", x: 0.14, y: 0.886, q: "wehr", s: "r" },
  { l: "RabbitMQ-Block", x: 0.24, y: 0.842, q: "wehr", s: "r" },
  { l: "Netty Watermark", x: 0.08, y: 0.798, q: "wehr", s: "r" },
  { l: "Galera-FC", x: 0.2, y: 0.754, q: "wehr", s: "r" },
  { l: "Kafka-Buffer", x: 0.29, y: 0.71, q: "wehr", s: "r" },
  { l: "TCP Zero-Window", x: 0.07, y: 0.666, q: "wehr", s: "r" },
  { l: "HTTP/2", x: 0.22, y: 0.622, q: "wehr", s: "r" },
  { l: "RabbitMQ credit_flow", x: 0.12, y: 0.578, q: "wehr", s: "r" },
  { l: "Reactive Streams", x: 0.24, y: 0.534, q: "wehr", s: "r" },
  // Pegel-Regler — zustandsbehaftet + proportional
  { l: "InnoDB-Checkpoint", x: 0.78, y: 0.92, q: "regler", s: "l" },
  { l: "cgroup memory.high", x: 0.9, y: 0.86, q: "regler", s: "l" },
  { l: "CockroachDB", x: 0.7, y: 0.8, q: "regler", s: "l" },
  { l: "MongoDB-FC", x: 0.7, y: 0.68, q: "regler", s: "l" },
  { l: "Shenandoah ≤ JDK 25", x: 0.86, y: 0.74, q: "regler", s: "l" },
  { l: "Go GC-assist", x: 0.88, y: 0.62, q: "regler", s: "l" },
  // Stop-and-Go-Reflex — zustandsarm + binär
  { l: "gRPC-Deadline", x: 0.07, y: 0.16, q: "reflex", s: "r" },
  { l: "Readiness-Probe", x: 0.22, y: 0.24, q: "reflex", s: "r" },
  { l: "Envoy CPU-Schwelle", x: 0.09, y: 0.32, q: "reflex", s: "r" },
  { l: "Mimir CPU-Limit", x: 0.24, y: 0.41, q: "reflex", s: "r" },
  // Mitlauf-Dämpfer — zustandsarm + proportional
  { l: "Envoy Admission", x: 0.76, y: 0.34, q: "daempfer", s: "l" },
  { l: "Envoy CPU-Rampe", x: 0.88, y: 0.16, q: "daempfer", s: "l" },
  { l: "Adaptive Throttling", x: 0.84, y: 0.43, q: "daempfer", s: "l" },
  { l: "Kafka Quotas", x: 0.7, y: 0.25, q: "daempfer", s: "l" },
];

// Datenkoordinaten in die um INSET eingerückte Plotfläche abbilden, damit die
// Ecken Platz für die Quadranten-Chips und die Achsenpole lassen.
const INSET = 12; // %
const span = 100 - 2 * INSET;
const px = (x) => INSET + x * span;
const py = (y) => 100 - (INSET + y * span); // y=0 unten → top=hoch
const dotStyle = (p) => ({
  left: px(p.x) + "%",
  top: py(p.y) + "%",
  "--c": `var(--bpq-${p.q})`,
});

// ⓘ-Dialog: Text je Quadrant. Absatz = Liste von Segmenten, b = fett.
// `marks` benennt die gestrichelten Linien von oben nach unten.
const INFO = {
  wehr: {
    axes: "zustandsbehaftet · binär",
    marks: "gestrichelt: Set-Schwelle (oben), Reset-Schwelle (unten)",
    paras: [
      [
        { t: "Ein Pegel (Puffer, Heap, Queue) läuft bis zur " },
        { t: "Set-Schwelle", b: true },
        {
          t: " voll. Dann bremst das Wehr ganz und hält, bis der Pegel unter die ",
        },
        { t: "Reset-Schwelle", b: true },
        { t: " gefallen ist. Das Band dazwischen ist die Hysterese." },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "harte Kanten wie der Reflex, aber mit Gedächtnis. Es flattert nicht, dafür gibt es einen Sägezahn und lange Stopp-Phasen. Kippt die Bremse in positive Rückkopplung, wird daraus der metastabile Fehler.",
        },
      ],
    ],
  },
  regler: {
    axes: "zustandsbehaftet · proportional",
    marks: "gestrichelt: Sollwert",
    paras: [
      [
        { t: "Der Zufluss wird proportional zum Abstand vom " },
        { t: "Sollwert", b: true },
        {
          t: " gedrosselt. Nach einem Lastsprung nähert sich der Pegel exponentiell an, ohne Überschwingen und ohne Stopp.",
        },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "hat einen Pegel wie das Wehr, bremst aber stufenlos. Der Dämpfer hat keinen Pegel. Er hält den Sollwert auch bei dauerhaft hoher Last und ist darum am besten vorhersagbar.",
        },
      ],
    ],
  },
  reflex: {
    axes: "zustandsarm · binär",
    marks: "gestrichelt: Grenze",
    paras: [
      [
        { t: "Reißt die momentane Last die " },
        { t: "Grenze", b: true },
        {
          t: ", fällt die durchgelassene Rate sofort auf 0 und kommt ebenso sofort zurück.",
        },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "kein Band und kein Gedächtnis, nur der Momentanwert. Der Reflex reagiert am schnellsten, flattert aber bei Last nahe der Grenze. Man sieht ihn nur an seiner Wirkung: detektierbar, nicht vorhersagbar.",
        },
      ],
    ],
  },
  daempfer: {
    axes: "zustandsarm · proportional",
    marks: "",
    paras: [
      [
        { t: "Die Rate folgt der Last. Oberhalb eines Knies wird sie " },
        { t: "weich gestaucht", b: true },
        { t: ": Spitzen werden abgeflacht statt abgeschnitten." },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "weder Stopp (Reflex, Wehr) noch Pegel (Regler). Die Bremskraft wächst mit der Last, deshalb stabilisiert sich das System selbst.",
        },
      ],
    ],
  },
};

// Welcher Quadrant ist im Dialog offen (null = keiner)?
const open = ref(null);
const openQ = computed(() => QUADS.find((q) => q.key === open.value));
const examples = computed(() =>
  POINTS.filter((p) => p.q === open.value)
    .map((p) => p.l)
    .join(" · "),
);

function onKey(ev) {
  if (ev.key === "Escape") open.value = null;
}
watch(open, (o) => {
  if (o) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
onSlideLeave(() => {
  open.value = null;
});
</script>

<template>
  <div class="bpq" :class="{ paused: open }" :style="cssVars">
    <div class="bpq-plot">
      <!-- Quadranten-Tönung -->
      <div class="quad q-tl" />
      <div class="quad q-tr" />
      <div class="quad q-bl" />
      <div class="quad q-br" />
      <!-- Achsenkreuz -->
      <div class="axis axis-v" />
      <div class="axis axis-h" />

      <!-- Achsenpole -->
      <div class="pole pole-top">zustandsbehaftet · Pegel</div>
      <div class="pole pole-bottom">zustandsarm · Rate</div>
      <div class="pole pole-left">binär ·<br />Bang-Bang</div>
      <div class="pole pole-right">propor-<br />tional</div>

      <!-- Quadranten-Namen -->
      <div
        v-for="q in QUADS"
        :key="q.key"
        class="qname"
        :class="'c-' + q.corner"
        :style="{ '--c': `var(--bpq-${q.key})` }"
      >
        <span class="qtext">
          <span class="qname-t">{{ q.name }}</span>
          <span class="qname-s">{{ q.sub }}</span>
        </span>
        <button
          type="button"
          class="trace-btn"
          :aria-label="`${q.name}: Verhalten vergrößert erklären`"
          @click.stop="open = q.key"
        >
          <svg
            class="trace"
            :viewBox="`0 0 ${PERIOD} ${TH}`"
            :width="PERIOD"
            :height="TH"
            aria-hidden="true"
          >
            <line
              v-for="m in TRACES[q.key].marks"
              :key="m"
              class="t-mark"
              x1="0"
              :x2="PERIOD"
              :y1="yOf(m)"
              :y2="yOf(m)"
            />
            <g class="t-scroll" :style="{ '--dur': TRACES[q.key].dur + 's' }">
              <path class="t-load" :d="TRACES[q.key].load" />
              <path
                v-if="TRACES[q.key].fill"
                class="t-fill"
                :d="TRACES[q.key].fill"
              />
              <path class="t-line" :d="TRACES[q.key].line" />
            </g>
          </svg>
          <span class="info-badge" aria-hidden="true">i</span>
        </button>
      </div>

      <!-- Metastabiler Fehler: Eskalation aus dem Schwellwert-Wehr -->
      <div class="meta">↖ metastabil · ∞&nbsp;Hysterese</div>

      <!-- Datenpunkte -->
      <div v-for="p in POINTS" :key="p.l" class="pt" :style="dotStyle(p)">
        <span class="dot" />
        <span class="lab" :class="p.s === 'l' ? 'lab-l' : 'lab-r'">{{
          p.l
        }}</span>
      </div>
    </div>

    <!-- ⓘ-Dialog: dimmt die Folie, zeigt die Spur groß; Klick schließt -->
    <div v-if="openQ" class="bpq-overlay" @click="open = null">
      <div
        class="bpq-card"
        :style="{ '--c': `var(--bpq-${openQ.key})` }"
        role="dialog"
        :aria-label="openQ.name"
      >
        <div class="card-h">
          <span class="card-t">{{ openQ.name }}</span>
          <span class="card-axes">{{ INFO[openQ.key].axes }}</span>
        </div>
        <svg
          class="trace big"
          :viewBox="`0 0 ${PERIOD} ${TH}`"
          :width="PERIOD * 6"
          :height="TH * 6"
          aria-hidden="true"
        >
          <line
            v-for="m in TRACES[openQ.key].marks"
            :key="m"
            class="t-mark"
            x1="0"
            :x2="PERIOD"
            :y1="yOf(m)"
            :y2="yOf(m)"
          />
          <g class="t-scroll" :style="{ '--dur': TRACES[openQ.key].dur + 's' }">
            <path class="t-load" :d="TRACES[openQ.key].load" />
            <path
              v-if="TRACES[openQ.key].fill"
              class="t-fill"
              :d="TRACES[openQ.key].fill"
            />
            <path class="t-line" :d="TRACES[openQ.key].line" />
          </g>
        </svg>
        <div class="card-legend">
          grau: Last · Farbe: Reaktion ·
          {{ TRACES[openQ.key].fill ? "Fläche: Pegel" : "Linie: Rate" }}
          <template v-if="INFO[openQ.key].marks">
            · {{ INFO[openQ.key].marks }}
          </template>
        </div>
        <p v-for="(para, i) in INFO[openQ.key].paras" :key="i" class="card-p">
          <template v-for="(s, j) in para" :key="j">
            <strong v-if="s.b">{{ s.t }}</strong>
            <template v-else>{{ s.t }}</template>
          </template>
        </p>
        <div class="card-ex">Beispiele: {{ examples }}</div>
        <div class="card-hint">Klick irgendwohin schließt</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bpq {
  font-size: 0.72em;
  color: var(--bpq-text);
}
.bpq-plot {
  position: relative;
  width: 100%;
  height: 322px;
  border: 1px solid var(--bpq-frame);
  border-radius: 8px;
}
.quad {
  position: absolute;
  width: 50%;
  height: 50%;
}
.q-tl {
  top: 0;
  left: 0;
  background: var(--bpq-wehr);
  opacity: 0.05;
  border-top-left-radius: 8px;
}
.q-tr {
  top: 0;
  right: 0;
  background: var(--bpq-regler);
  opacity: 0.05;
  border-top-right-radius: 8px;
}
.q-bl {
  bottom: 0;
  left: 0;
  background: var(--bpq-reflex);
  opacity: 0.05;
  border-bottom-left-radius: 8px;
}
.q-br {
  bottom: 0;
  right: 0;
  background: var(--bpq-daempfer);
  opacity: 0.05;
  border-bottom-right-radius: 8px;
}
.axis {
  position: absolute;
  background: var(--bpq-line);
}
.axis-v {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed var(--bpq-line);
  background: none;
}
.axis-h {
  top: 50%;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed var(--bpq-line);
  background: none;
}

.pole {
  position: absolute;
  font-size: 0.74em;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--bpq-muted);
  text-transform: uppercase;
  text-align: center;
  line-height: 1.15;
}
.pole-top {
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.pole-bottom {
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.pole-left {
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
}
.pole-right {
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.qname {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 47%;
  color: var(--c);
}
.qtext {
  display: flex;
  flex-direction: column;
}
/* Spur sitzt zur Plotmitte hin: links neben dem Text bei rechten Ecken. */
.c-tr .qtext,
.c-br .qtext {
  align-items: flex-end;
}
.trace {
  flex: none;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--c) 8%, transparent);
}
.t-scroll {
  animation: bpq-scroll var(--dur, 5s) linear infinite;
}
@keyframes bpq-scroll {
  to {
    transform: translateX(-64px);
  }
}
.t-mark {
  stroke: var(--bpq-muted);
  stroke-width: 0.6;
  stroke-dasharray: 2 2;
}
.t-load,
.t-line {
  fill: none;
  stroke-linejoin: round;
}
.t-load {
  stroke: var(--bpq-dim);
  stroke-width: 1;
}
.t-line {
  stroke: var(--c);
  stroke-width: 1.6;
}
.t-fill {
  fill: color-mix(in srgb, var(--c) 28%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .t-scroll {
    animation: none;
  }
}

/* ⓘ-Knopf: die ganze Spur ist Klickfläche, das Badge sitzt an der äußeren
   oberen Ecke (weg von den Datenpunkt-Labels). */
.trace-btn {
  position: relative;
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  line-height: 0;
  cursor: pointer;
  order: 0;
}
.c-tr .trace-btn,
.c-br .trace-btn {
  order: -1;
}
.trace-btn:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 2px;
}
.info-badge {
  position: absolute;
  top: -5px;
  left: -5px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--c);
  color: var(--bpq-card);
  font-size: 8px;
  font-weight: 800;
  font-style: italic;
  line-height: 11px;
  text-align: center;
}
.c-tr .info-badge,
.c-br .info-badge {
  left: auto;
  right: -5px;
}
.trace-btn:hover .trace {
  background: color-mix(in srgb, var(--c) 18%, transparent);
}

/* Angehalten, solange der Dialog offen ist; die große Spur im Dialog liegt
   außerhalb von .bpq-plot und läuft weiter. */
.bpq.paused .bpq-plot .t-scroll {
  animation-play-state: paused;
}

/* position:fixed bezieht sich wegen des Slidev-Scaler-Transforms auf den
   Folien-Canvas (siehe BunPopover). */
.bpq-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.bpq-card {
  width: 420px;
  max-width: 100%;
  padding: 14px 18px;
  background: var(--bpq-card);
  color: var(--bpq-text);
  border: 1px solid var(--c);
  border-radius: 12px;
  line-height: 1.45;
}
.card-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.card-t {
  font-size: 1.25em;
  font-weight: 800;
  color: var(--c);
}
.card-axes {
  font-size: 0.85em;
  color: var(--bpq-muted);
}
.trace.big {
  display: block;
  margin: 0 auto;
  border-radius: 6px;
}
.big .t-load {
  stroke-width: 0.3;
}
.big .t-line {
  stroke-width: 0.5;
}
.big .t-mark {
  stroke-width: 0.15;
  stroke-dasharray: 0.8 0.8;
}
.card-legend {
  margin: 6px 0 8px;
  font-size: 0.85em;
  color: var(--bpq-muted);
}
.card-p {
  margin: 0 0 6px;
}
.card-ex {
  margin-top: 8px;
  font-size: 0.85em;
  color: var(--bpq-muted);
}
.card-hint {
  margin-top: 8px;
  font-size: 0.8em;
  color: var(--bpq-dim);
}
.qname-t {
  font-weight: 800;
  font-size: 0.84em;
  line-height: 1.1;
}
.qname-s {
  font-size: 0.66em;
  color: var(--bpq-muted);
  line-height: 1.1;
}
.c-tl {
  top: 18px;
  left: 8px;
  text-align: left;
}
.c-tr {
  top: 18px;
  right: 8px;
  text-align: right;
}
.c-bl {
  bottom: 18px;
  left: 8px;
  text-align: left;
}
.c-br {
  bottom: 18px;
  right: 8px;
  text-align: right;
}

.meta {
  position: absolute;
  top: 2px;
  left: 6px;
  font-size: 0.66em;
  font-weight: 700;
  color: var(--bpq-danger);
  white-space: nowrap;
}

.pt {
  position: absolute;
  width: 0;
  height: 0;
  line-height: 0;
}
.dot {
  position: absolute;
  left: 0;
  top: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  border: 1.5px solid var(--bpq-text);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent);
}
.lab {
  position: absolute;
  top: 0;
  transform: translateY(-50%);
  font-size: 0.72em;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  color: var(--bpq-text);
}
.lab-r {
  left: 9px;
}
.lab-l {
  right: 9px;
}
</style>
