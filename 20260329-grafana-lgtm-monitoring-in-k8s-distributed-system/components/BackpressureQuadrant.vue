<script setup>
/**
 * Back-Pressure als Regelkreise — Magic-Quadrant-Streudiagramm.
 *
 * Zwei Achsen ordnen jeden Back-Pressure-Mechanismus ein und quantifizieren
 * seine Ausprägung *relativ* über die Position:
 *   X (Bremsform):  binär · Bang-Bang  →  proportional
 *   Y (Gedächtnis): zustandsarm · Rate →  zustandsbehaftet · Pegel
 *
 * Jeder der vier Quadranten trägt einen Namen. Der „Metastabile Fehler“ ist
 * kein eigener Punkt, sondern eine Eskalation aus dem Schwellwert-Wehr heraus
 * (super-lineare Rückkopplung = effektiv unendliche Hysterese) und wird als
 * roter Pfeil über die obere-linke Ecke hinaus markiert.
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

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

// Mechanismen mit *relativer* Ausprägung auf beiden Achsen (0..1).
// s = Seite des Labels relativ zum Punkt ('r' rechts, 'l' links) — Labels
// wachsen zur Mitte, damit die Plot-Ränder frei bleiben.
const POINTS = [
  // Schwellwert-Wehr — zustandsbehaftet + binär
  { l: "OOM-Kill", x: 0.07, y: 0.93, q: "wehr", s: "r" },
  { l: "ZGC-Stall", x: 0.13, y: 0.84, q: "wehr", s: "r" },
  { l: "RabbitMQ-Block", x: 0.21, y: 0.76, q: "wehr", s: "r" },
  { l: "Galera-FC", x: 0.32, y: 0.69, q: "wehr", s: "r" },
  { l: "Kafka-Buffer", x: 0.18, y: 0.61, q: "wehr", s: "r" },
  // Pegel-Regler — zustandsbehaftet + proportional
  { l: "InnoDB-Checkpoint", x: 0.67, y: 0.87, q: "regler", s: "l" },
  { l: "cgroup memory.high", x: 0.87, y: 0.79, q: "regler", s: "l" },
  { l: "CockroachDB", x: 0.74, y: 0.7, q: "regler", s: "l" },
  { l: "MongoDB-FC", x: 0.62, y: 0.62, q: "regler", s: "l" },
  // Stop-and-Go-Reflex — zustandsarm + binär
  { l: "TCP Zero-Window", x: 0.1, y: 0.34, q: "reflex", s: "r" },
  { l: "Netty isWritable", x: 0.22, y: 0.25, q: "reflex", s: "r" },
  { l: "RabbitMQ credit_flow", x: 0.34, y: 0.15, q: "reflex", s: "r" },
  // Mitlauf-Dämpfer — zustandsarm + proportional
  { l: "Shenandoah-Pacing", x: 0.7, y: 0.35, q: "daempfer", s: "l" },
  { l: "Go GC-assist", x: 0.88, y: 0.27, q: "daempfer", s: "l" },
  { l: "HTTP/2", x: 0.65, y: 0.18, q: "daempfer", s: "l" },
  { l: "Reactive Streams", x: 0.82, y: 0.1, q: "daempfer", s: "l" },
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
</script>

<template>
  <div class="bpq" :style="cssVars">
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
        <span class="qname-t">{{ q.name }}</span>
        <span class="qname-s">{{ q.sub }}</span>
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
  flex-direction: column;
  max-width: 47%;
  color: var(--c);
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
  align-items: flex-end;
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
  align-items: flex-end;
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
