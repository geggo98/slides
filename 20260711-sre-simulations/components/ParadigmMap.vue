<script setup>
// Paradigmen-Landkarte fürs Making-of: verortet alle Simulationen des
// Decks auf den zwei Achsen deterministisch↔stochastisch (x) und
// aggregiert↔individuell (y). Nicht-dynamische Artefakte (Formel, Keyframe,
// Skript-Trace) wandern in ein Sockel-Band unter der Ebene — dort gibt es
// keine sinnvolle y-Position. Klick auf Punkt/Pill → Detail-Karte rechts.
// Bewusst ohne SimShell (kein Transport, keine Presets, kein Verdict) und
// ohne d3 (21 handplatzierte Punkte, lineare Skalen).
import { ref, computed } from "vue";
import { useDarkMode, useNav } from "@slidev/client";

const { isDark } = useDarkMode();
const { go } = useNav();

const C = computed(() => {
  const d = isDark.value;
  return {
    surface: d ? "#111621" : "#ffffff",
    surfaceAlt: d ? "#161c2a" : "#f1f5f9",
    border: d ? "#1e2536" : "#e2e8f0",
    text: d ? "#e2e8f0" : "#1e293b",
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    blue: d ? "#3b82f6" : "#2563eb",
    green: d ? "#22c55e" : "#16a34a",
    orange: d ? "#f97316" : "#ea580c",
    purple: d ? "#a855f7" : "#9333ea",
    cyan: d ? "#06b6d4" : "#0891b2",
    pink: d ? "#ec4899" : "#db2777",
    amber: d ? "#f59e0b" : "#d97706",
  };
});

const FAMILIES = computed(() => [
  { id: "des", label: "DES", long: "Next-Event-DES", color: C.value.blue },
  {
    id: "fluid",
    label: "Fluid",
    long: "Fluid · fester Takt",
    color: C.value.green,
  },
  { id: "loop", label: "Regelkreis", long: "Regelkreis", color: C.value.cyan },
  {
    id: "analytic",
    label: "Analytisch",
    long: "deterministisch / analytisch",
    color: C.value.purple,
  },
  {
    id: "mc",
    label: "Monte-Carlo",
    long: "Monte-Carlo-Sampling",
    color: C.value.pink,
  },
  {
    id: "script",
    label: "Skript-Trace",
    long: "Skript-Trace + Seed-Rauschen",
    color: C.value.orange,
  },
  {
    id: "catalog",
    label: "Katalog",
    long: "Katalog / statisch",
    color: C.value.muted,
  },
]);

// x: 0 = deterministisch … 1 = stochastisch · y: 0 = aggregiert … 1 = individuell.
// band: true → Sockel „kein dynamisches Modell" (nur qualitativ gruppiert).
const SIMS = [
  {
    id: "mm1",
    name: "M/M/1-Kantine",
    label: "M/M/1",
    family: "des",
    x: 0.92,
    y: 0.9,
    labelPos: "left",
    engine: "lib/mm1Engine.js · Next-Event-DES — min(Ankunft, Abgang)",
    takt: "ereignisbasiert (exponentielle Zwischenzeiten)",
    rng: "Math.random — ohne Seed!",
    unseeded: true,
    rendering: "Canvas-Scope + SVG-Kantine",
    archetyp: "✏️ Predict-first",
    slide: "mm1-simulator",
    note: "Theorie-Overlay Wq = ρ/(1−ρ), Little-Ratio läuft live mit.",
  },
  {
    id: "mmc",
    name: "M/M/c: Pool vs. Tempo",
    label: "M/M/c",
    family: "des",
    x: 0.87,
    y: 0.83,
    labelPos: "left",
    engine: "lib/mmc.js · Zwillings-DES — ein Ankunftsstrom, zwei Systeme",
    takt: "ereignisbasiert",
    rng: "Math.random — ohne Seed!",
    unseeded: true,
    rendering: "Canvas-Scope + 2× SVG-Kantine",
    archetyp: "✏️ Predict-first",
    slide: "mmc-vergleich",
    note: "Erlang-C-Theoriekurven liegen über den Live-Punkten.",
  },
  {
    id: "little",
    name: "Little's-Law-Drill",
    label: "Little-Drill",
    family: "des",
    x: 0.78,
    y: 0.76,
    labelPos: "left",
    engine: "lib/littleEngine.js · M/M/c-DES mit Backlog-Vorfüllung",
    takt: "ereignisbasiert",
    rng: "mulberry32 — Seed teilbar",
    rendering: "SVG",
    archetyp: "✏️ Predict-first",
    slide: "littles-law",
    note: "Verankerte Zwei-Phasen-Statistik: λ̂·Ŵ gegen L̂.",
  },
  {
    id: "latency",
    name: "Latenz: Loss vs. App",
    label: "Latenz-Sampling",
    family: "mc",
    x: 0.9,
    y: 0.66,
    labelPos: "left",
    engine: "Monte-Carlo: RTO-Backoff-Kette vs. Summe zweier Exponentialer",
    takt: "keine Zeitachse — Verteilung statt Verlauf",
    rng: "mulberry32, Seed aus Date.now()",
    rendering: "d3 (scale/selection) → SVG-Heatmap",
    archetyp: "🔍 Diagnose-Drill",
    slide: "latenz-verteilung",
    note: "p50/p99 verstecken die Multimodalität — darum die Heatmap.",
  },
  {
    id: "cascade",
    name: "Cascading Failure",
    label: "Kaskade",
    family: "fluid",
    x: 0.75,
    y: 0.41,
    labelPos: "right",
    engine: "lib/cascadeModel.js · Fluid pro Instanz + Outlier-Ejection",
    takt: "Δt = 0,05 s, fester Takt",
    rng: "mulberry32 + Knuth-Poisson",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "cascading-failure",
    note: "Envoy-Muster: Ejection mit Backoff und Panic-Threshold.",
  },
  {
    id: "stampede",
    name: "Cache-Stampede",
    label: "Stampede",
    family: "fluid",
    x: 0.73,
    y: 0.33,
    labelPos: "right",
    engine: "Fluid-Queue + Rebuild-Kosten (im SFC)",
    takt: "Δt = 0,02 s, fester Takt",
    rng: "mulberry32 + Knuth-Poisson",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "cache-stampede",
    note: "Ein Cache-Miss kostet C Rebuild-Äquivalente.",
  },
  {
    id: "retry",
    name: "Retry-Sturm",
    label: "Retry-Sturm",
    family: "fluid",
    x: 0.68,
    y: 0.26,
    labelPos: "right",
    engine: "Fluid-Queue + Retry-Verstärkung (im SFC)",
    takt: "Δt = 0,05 s, fester Takt",
    rng: "mulberry32 + Knuth-Poisson",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "retry-sturm",
    note: "Sigmoid-Deadline koppelt Queue → Timeouts → Retries.",
  },
  {
    id: "bufferbloat",
    name: "Bufferbloat",
    label: "Bufferbloat",
    family: "fluid",
    x: 0.62,
    y: 0.19,
    labelPos: "right",
    engine: "Fluid-Queue, Puffer B + CoDel-artiger Age-Drop (im SFC)",
    takt: "Δt = 0,05 s, fester Takt",
    rng: "mulberry32 + Knuth-Poisson",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "bufferbloat",
    note: "FIFO gegen Age-Drop: gleicher Zufall, andere Latenz.",
  },
  {
    id: "breaker",
    name: "Circuit Breaker & Shedding",
    label: "Breaker",
    family: "fluid",
    x: 0.57,
    y: 0.35,
    labelPos: "left",
    engine: "lib/breakerModel.js · Fluid + FSM Closed→Open→Half-Open",
    takt: "Δt = 0,05 s, fester Takt",
    rng: "mulberry32 + Knuth-Poisson",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "circuit-breaker",
    note: "Zwei Bahnen mit gleichem Seed — Divergenz ab dem Trip.",
  },
  {
    id: "metastable",
    name: "Metastabilität: MTTF-Klippe",
    label: "MTTF-Klippe",
    family: "fluid",
    x: 0.86,
    y: 0.24,
    labelPos: "right",
    engine:
      "lib/metastableModel.js · Fluid-Skelett (q*, Falte, Potential) + Poisson-Zwilling — Gleichungen per Import aus breakerModel",
    takt: "Δt = 0,05 s + analytisches Skelett",
    rng: "mulberry32 + Knuth-Poisson",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "mttf-klippe",
    note: "Beide Hälften derselben Gleichung: Mittelwert-Falte vs. stochastisches Entkommen.",
  },
  {
    id: "hpa",
    name: "Autoscaler-Hunting",
    label: "HPA-Hunting",
    family: "loop",
    x: 0.5,
    y: 0.16,
    labelPos: "left",
    engine: "HPA-Regelkreis: EMA, Totband, Stabilisierungsfenster (im SFC)",
    takt: "Δt = 1 s, fester Takt",
    rng: "mulberry32 + Box-Muller",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "hpa-hunting",
    note: "Die Pod-Startverzögerung erzeugt das Hunting.",
  },
  {
    id: "bullwhip",
    name: "Bullwhip-Effekt",
    label: "Bullwhip",
    family: "loop",
    x: 0.42,
    y: 0.1,
    labelPos: "right",
    engine: "lib/bullwhipModel.js · Order-up-to-Kette (Chen et al. 2000)",
    takt: "Wochen-Takt",
    rng: "mulberry32 + Box-Muller",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "bullwhip",
    note: "Nachfrage-Rauschen unten, Ordervolumen schaukelt nach oben auf.",
  },
  {
    id: "burnrate",
    name: "SLO-Burn-Rate-Alerts",
    label: "Burn-Rate",
    family: "analytic",
    x: 0.28,
    y: 0.06,
    labelPos: "right",
    engine: "lib/burnRate.js · Präfix-Integral, ganzer Lauf O(n) vorab",
    takt: "vorberechnet — Playhead scrubbt (useSimTransport)",
    rng: "mulberry32 — nur Trace-Rauschen",
    rendering: "Canvas",
    archetyp: "✏️ Predict-first",
    slide: "slo-burn-rate",
    note: "Multi-Window-Multi-Burn-Rate nach SRE Workbook.",
  },
  {
    id: "sysdyn",
    name: "Systemdynamik-Pipeline",
    label: "Systemdynamik",
    family: "analytic",
    x: 0.04,
    y: 0.12,
    labelPos: "right",
    engine: "Leaky-Bucket-Pipeline, 3 Stufen in Serie (im SFC)",
    takt: "Vorwärts-Euler — Lauf komplett als computed",
    rng: "— deterministisch",
    rendering: "SVG aus dem Template",
    archetyp: "✏️ Predict-first",
    slide: "systemdynamik",
    note: "Eingang analytisch: Sprung, Puls oder Sinus.",
  },
  // ── Sockel-Band: kein dynamisches Modell ──────────────────────────────
  {
    id: "backpressure",
    name: "Back-Pressure-Quadrant",
    label: "Quadrant",
    family: "catalog",
    band: "det",
    engine: "statisches Poster — hartkodierte Punkte",
    takt: "—",
    rng: "—",
    rendering: "CSS/HTML",
    archetyp: "🖱️ interaktiver Katalog",
    slide: "backpressure-quadrant",
  },
  {
    id: "mm1chart",
    name: "M/M/1-Theoriekurve",
    label: "M/M/1-Formel",
    family: "catalog",
    band: "det",
    engine: "geschlossene Formel T = 1/(1−ρ)",
    takt: "—",
    rng: "—",
    rendering: "SVG mit Hover-Readout",
    archetyp: "— Theorie-Folie",
    slide: "mm1-theorie",
  },
  {
    id: "saturation",
    name: "Sättigungs-Szenarien",
    label: "Sättigung",
    family: "catalog",
    band: "det",
    engine: "Keyframe-Player: Phasen-Timeline, lerp dazwischen",
    takt: "rAF-Playhead",
    rng: "—",
    rendering: "GaugeRing + SVG-Sparklines",
    archetyp: "🖱️ interaktiver Katalog",
    slide: "saturation-szenarien",
  },
  {
    id: "hysterese",
    name: "Hysterese-Katalog",
    label: "Hysterese",
    family: "catalog",
    band: "det",
    engine: "handgezeichnete Loops, Marker läuft die Kurve ab",
    takt: "rAF-Animation",
    rng: "—",
    rendering: "SVG",
    archetyp: "🖱️ interaktiver Katalog",
    slide: "hysterese-katalog",
  },
  {
    id: "rabbit",
    name: "RabbitMQ: Queue wächst",
    label: "RabbitMQ",
    family: "script",
    band: "noise",
    engine: "Skript-Trace: analytische Mittelwertkurve + Seed-Rauschen",
    takt: "Playhead (useSimTransport)",
    rng: "mulberry32",
    rendering: "d3 → SVG",
    archetyp: "🔍 Diagnose-Drill",
    slide: "rabbitmq-queue",
    note: "μ(t) liegt analytisch über der verrauschten Spur.",
  },
  {
    id: "crashloop",
    name: "CrashLoopBackOff",
    label: "CrashLoop",
    family: "script",
    band: "noise",
    engine: "Skript-Trace: Sägezahn + Ereignis-Skript (Exit 137/143/1)",
    takt: "Ereignis-Skript",
    rng: "mulberry32",
    rendering: "d3 → SVG",
    archetyp: "🔍 Diagnose-Drill",
    slide: "k8s-crashloop",
  },
  {
    id: "memleak",
    name: "Heap: Leak vs. Cache",
    label: "Memory-Leak",
    family: "script",
    band: "noise",
    engine: "Skript-Trace: Heap-Sägezahn, Leak vs. Cache-Warmup",
    takt: "Trace-Raster Δt = 0,25 s",
    rng: "mulberry32",
    rendering: "d3 → SVG",
    archetyp: "🔍 Diagnose-Drill",
    slide: "memory-leak",
  },
  {
    id: "noisy",
    name: "Noisy Neighbor",
    label: "Noisy Neighbor",
    family: "script",
    band: "noise",
    engine: "Skript-Trace: analytische Mittelwertkurve + Seed-Rauschen",
    takt: "Trace-Raster Δt = 1 s",
    rng: "mulberry32",
    rendering: "d3 → SVG",
    archetyp: "🔍 Diagnose-Drill",
    slide: "noisy-neighbor",
  },
];

const planeSims = SIMS.filter((s) => !s.band);
const bandDet = SIMS.filter((s) => s.band === "det");
const bandNoise = SIMS.filter((s) => s.band === "noise");

const filter = ref("all");
const selectedId = ref(null);
const hoveredId = ref(null);

const selected = computed(
  () => SIMS.find((s) => s.id === selectedId.value) ?? null,
);

function famOf(s) {
  return FAMILIES.value.find((f) => f.id === s.family);
}
function famCount(id) {
  return SIMS.filter((s) => s.family === id).length;
}
function dimmed(s) {
  return filter.value !== "all" && s.family !== filter.value;
}
function pick(s) {
  selectedId.value = selectedId.value === s.id ? null : s.id;
}

// Plot-Geometrie (viewBox 0 0 560 294). Flach genug, damit das Sockel-Band
// über Slidevs unsichtbarer Nav-Leiste (unten links, ~57 logische px) endet.
const PLOT = { x0: 26, x1: 546, yTop: 14, yBot: 268 };
function px(s) {
  return PLOT.x0 + s.x * (PLOT.x1 - PLOT.x0);
}
function py(s) {
  return PLOT.yBot - s.y * (PLOT.yBot - PLOT.yTop);
}
</script>

<template>
  <div
    class="pm-root"
    :style="{
      '--c-surface': C.surface,
      '--c-surfaceAlt': C.surfaceAlt,
      '--c-border': C.border,
      '--c-text': C.text,
      '--c-muted': C.muted,
      '--c-dim': C.dim,
      '--c-amber': C.amber,
    }"
  >
    <div class="pm-header">
      <div>
        <div class="pm-eyebrow">Making of · unter der Motorhaube</div>
        <div class="pm-title">
          Paradigmen-Landkarte — {{ SIMS.length }} Simulationen, zwei Achsen
        </div>
      </div>
      <div class="pm-chips">
        <button
          :class="{ active: filter === 'all' }"
          :style="{
            borderColor: filter === 'all' ? C.text : C.border,
            color: filter === 'all' ? C.text : C.muted,
          }"
          @click="filter = 'all'"
        >
          Alle
        </button>
        <button
          v-for="f in FAMILIES"
          :key="f.id"
          :class="{ active: filter === f.id }"
          :style="{
            borderColor: filter === f.id ? f.color : C.border,
            background: filter === f.id ? f.color + '12' : 'transparent',
            color: filter === f.id ? f.color : C.muted,
          }"
          @click="filter = filter === f.id ? 'all' : f.id"
        >
          <span class="pm-chip-dot" :style="{ background: f.color }" />
          {{ f.label }} <span class="pm-chip-count">{{ famCount(f.id) }}</span>
        </button>
      </div>
    </div>

    <div class="pm-main">
      <div class="pm-left">
        <svg viewBox="0 0 560 294" class="pm-svg">
          <!-- Ebene -->
          <rect
            :x="PLOT.x0"
            :y="PLOT.yTop"
            :width="PLOT.x1 - PLOT.x0"
            :height="PLOT.yBot - PLOT.yTop"
            fill="none"
            :stroke="C.border"
            stroke-width="1"
            rx="4"
          />
          <line
            :x1="(PLOT.x0 + PLOT.x1) / 2"
            :y1="PLOT.yTop"
            :x2="(PLOT.x0 + PLOT.x1) / 2"
            :y2="PLOT.yBot"
            :stroke="C.border"
            stroke-width="0.6"
            stroke-dasharray="3,4"
          />
          <line
            :x1="PLOT.x0"
            :y1="(PLOT.yTop + PLOT.yBot) / 2"
            :x2="PLOT.x1"
            :y2="(PLOT.yTop + PLOT.yBot) / 2"
            :stroke="C.border"
            stroke-width="0.6"
            stroke-dasharray="3,4"
          />
          <!-- Achsen-Beschriftung -->
          <text :x="PLOT.x0" :y="288" class="pm-axis" :fill="C.dim">
            ← deterministisch
          </text>
          <text
            :x="PLOT.x1"
            :y="288"
            class="pm-axis"
            text-anchor="end"
            :fill="C.dim"
          >
            stochastisch →
          </text>
          <text
            :x="10"
            :y="PLOT.yTop + 4"
            class="pm-axis"
            :fill="C.dim"
            text-anchor="end"
            :transform="`rotate(-90 10 ${PLOT.yTop + 4})`"
          >
            individuell — einzelne Jobs ↑
          </text>
          <text
            :x="10"
            :y="PLOT.yBot"
            class="pm-axis"
            :fill="C.dim"
            :transform="`rotate(-90 10 ${PLOT.yBot})`"
          >
            ↓ aggregiert — Flüsse
          </text>

          <!-- Punkte -->
          <g
            v-for="s in planeSims"
            :key="s.id"
            role="button"
            tabindex="0"
            :aria-label="`Details zu ${s.name}`"
            class="pm-dot"
            :style="{ opacity: dimmed(s) ? 0.15 : 1 }"
            @click="pick(s)"
            @keydown.enter.prevent="pick(s)"
            @keydown.space.prevent="pick(s)"
            @mouseenter="hoveredId = s.id"
            @mouseleave="hoveredId = null"
          >
            <!-- unsichtbare Hit-Fläche: schließt die Lücke zwischen Punkt und Label -->
            <circle
              :cx="px(s)"
              :cy="py(s)"
              r="12"
              fill="transparent"
              stroke="none"
            />
            <circle
              :cx="px(s)"
              :cy="py(s)"
              :r="selectedId === s.id || hoveredId === s.id ? 8 : 6"
              :fill="famOf(s).color + '2a'"
              :stroke="famOf(s).color"
              :stroke-width="selectedId === s.id ? 2.2 : 1.4"
              :stroke-dasharray="s.unseeded ? '3,2' : undefined"
            />
            <text
              :x="s.labelPos === 'left' ? px(s) - 11 : px(s) + 11"
              :y="py(s) + 3"
              class="pm-label"
              :text-anchor="s.labelPos === 'left' ? 'end' : 'start'"
              :fill="selectedId === s.id ? famOf(s).color : C.muted"
            >
              {{ s.label }}
            </text>
          </g>
        </svg>

        <!-- Sockel-Band: kein dynamisches Modell -->
        <div class="pm-band">
          <div class="pm-band-title">
            Sockel: kein dynamisches Modell — die Kurve ist Formel, Keyframe
            oder Skript
          </div>
          <div class="pm-band-rows">
            <div class="pm-band-row">
              <span class="pm-band-tag" :style="{ color: C.dim }"
                >deterministisch:</span
              >
              <button
                v-for="s in bandDet"
                :key="s.id"
                class="pm-pill"
                :aria-label="`Details zu ${s.name}`"
                :style="{
                  borderColor: selectedId === s.id ? famOf(s).color : C.border,
                  color: selectedId === s.id ? famOf(s).color : C.muted,
                  background:
                    selectedId === s.id ? famOf(s).color + '12' : 'transparent',
                  opacity: dimmed(s) ? 0.15 : 1,
                }"
                @click="pick(s)"
              >
                <span
                  class="pm-chip-dot"
                  :style="{ background: famOf(s).color }"
                />{{ s.label }}
              </button>
            </div>
            <div class="pm-band-row">
              <span class="pm-band-tag" :style="{ color: C.dim }"
                >+ Seed-Rauschen:</span
              >
              <button
                v-for="s in bandNoise"
                :key="s.id"
                class="pm-pill"
                :aria-label="`Details zu ${s.name}`"
                :style="{
                  borderColor: selectedId === s.id ? famOf(s).color : C.border,
                  color: selectedId === s.id ? famOf(s).color : C.muted,
                  background:
                    selectedId === s.id ? famOf(s).color + '12' : 'transparent',
                  opacity: dimmed(s) ? 0.15 : 1,
                }"
                @click="pick(s)"
              >
                <span
                  class="pm-chip-dot"
                  :style="{ background: famOf(s).color }"
                />{{ s.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail-Karte -->
      <div class="pm-card">
        <template v-if="selected">
          <div class="pm-card-head">
            <div class="pm-card-name">{{ selected.name }}</div>
            <span
              class="pm-card-fam"
              :style="{
                color: famOf(selected).color,
                borderColor: famOf(selected).color + '55',
              }"
            >
              {{ famOf(selected).long }}
            </span>
          </div>
          <dl class="pm-card-rows">
            <div>
              <dt>Modell</dt>
              <dd>{{ selected.engine }}</dd>
            </div>
            <div>
              <dt>Zeit</dt>
              <dd>{{ selected.takt }}</dd>
            </div>
            <div>
              <dt>Zufall</dt>
              <dd
                :style="
                  selected.unseeded
                    ? { color: C.amber, fontWeight: 600 }
                    : undefined
                "
              >
                {{ selected.rng }}
              </dd>
            </div>
            <div>
              <dt>Bild</dt>
              <dd>{{ selected.rendering }}</dd>
            </div>
            <div>
              <dt>Mechanik</dt>
              <dd>{{ selected.archetyp }}</dd>
            </div>
            <div v-if="selected.note">
              <dt>Detail</dt>
              <dd>{{ selected.note }}</dd>
            </div>
          </dl>
          <button
            class="pm-goto"
            :style="{ borderColor: C.border, color: C.muted }"
            @click="go(selected.slide)"
          >
            → Folie öffnen
            <span class="pm-goto-alias">/{{ selected.slide }}</span>
          </button>
        </template>
        <template v-else>
          <div class="pm-card-name">Legende</div>
          <div class="pm-legend">
            <div v-for="f in FAMILIES" :key="f.id" class="pm-legend-item">
              <span class="pm-chip-dot" :style="{ background: f.color }" />
              <span :style="{ color: C.muted }">{{ f.long }}</span>
            </div>
          </div>
          <div class="pm-hint">
            <span class="pm-hint-dashed" :style="{ borderColor: C.amber }" />
            gestrichelt = läuft <b>ohne Seed</b>
            (Math.random)
          </div>
          <div class="pm-hint">
            Punkt oder Pill anklicken für Engine, Zeitschritt, Zufall &amp;
            Rendering.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pm-root {
  font-family: inherit;
  color: var(--c-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  line-height: 1.35;
}

.pm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.pm-eyebrow {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--c-dim);
}

.pm-title {
  font-size: 15px;
  font-weight: 700;
}

.pm-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pm-chips button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  background: transparent;
  transition: all 0.15s ease;
  outline: none;
  font-family: inherit;
}

.pm-chip-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pm-chip-count {
  opacity: 0.5;
}

.pm-main {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.pm-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pm-svg {
  width: 100%;
  display: block;
}

.pm-axis {
  font-size: 9px;
  letter-spacing: 0.04em;
}

.pm-dot {
  cursor: pointer;
  outline: none;
  transition: opacity 0.15s ease;
}

.pm-dot circle {
  transition:
    r 0.15s ease,
    stroke-width 0.15s ease;
}

.pm-dot:focus-visible circle {
  stroke-width: 2.6;
}

.pm-label {
  font-size: 8.5px;
  font-weight: 600;
}

.pm-band {
  border-top: 1px dashed var(--c-dim);
  padding-top: 4px;
}

.pm-band-title {
  font-size: 9px;
  color: var(--c-dim);
  margin-bottom: 3px;
}

.pm-band-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pm-band-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.pm-band-tag {
  font-size: 9px;
  width: 88px;
  flex-shrink: 0;
  text-align: right;
}

.pm-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  background: transparent;
  transition: all 0.15s ease;
  outline: none;
  font-family: inherit;
}

.pm-card {
  width: 268px;
  flex-shrink: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 10.5px;
}

.pm-card-head {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-start;
}

.pm-card-name {
  font-size: 13px;
  font-weight: 700;
}

.pm-card-fam {
  font-size: 9px;
  font-weight: 700;
  border: 1px solid;
  border-radius: 999px;
  padding: 1px 8px;
  letter-spacing: 0.03em;
}

.pm-card-rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
}

.pm-card-rows > div {
  display: flex;
  gap: 8px;
}

.pm-card-rows dt {
  width: 52px;
  flex-shrink: 0;
  color: var(--c-dim);
  font-weight: 600;
}

.pm-card-rows dd {
  margin: 0;
  color: var(--c-text);
}

.pm-goto {
  margin-top: auto;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  background: transparent;
  outline: none;
  font-family: inherit;
}

.pm-goto-alias {
  opacity: 0.5;
  font-weight: 400;
}

.pm-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pm-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pm-hint {
  font-size: 9.5px;
  color: var(--c-dim);
}

.pm-hint-dashed {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 1.5px dashed;
  border-radius: 50%;
  vertical-align: -2px;
}
</style>
