<script setup>
/**
 * LatencyRtoSim.vue — „Gleiche p99 — völlig andere Krankheit" (Verteilung
 * schlägt Perzentil), portiert aus latenz-verteilung-rto.html. Sample-Modell
 * (TCP-RTO-Backoff vs. Gamma-Slow-App, p99-kalibrierte LUT), Bins, Rolling-
 * Fenster und REASON-Texte verbatim; Panel-Gerüst als Vue-Template, D3 nur
 * für Skalen/Achsen/Zellen in den per-Ref gehaltenen SVGs (keine svg-Ids →
 * kein uid nötig). Der frei laufende rAF-Loop des Originals läuft hier NICHT
 * frei: er startet pausiert, ▶/⏸ sitzt im Transport-Slot, cancelt bei
 * Unmount und pausiert beim Folienwechsel (Slidev hält Nachbar-Folien
 * gemountet). Szenario-Tabs → SimShell-Presets, Schweregrad + Reset → ⚙.
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useIsSlideActive } from "@slidev/client";
import { scaleLinear, scaleLog, select } from "d3";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { mulberry32 } from "./lib/rng.js";

/* ===== Fall-spezifisch (verbatim) ===== */
const RTO = [200, 400, 800, 1600],
  RTT = 40;
/* Node-kalibrierte LUT: theta(s) so, dass p99_app == p99_loss */
const LUT = [
  null,
  { p: 0.03, th: 30.8 },
  { p: 0.06, th: 31.6 },
  { p: 0.09, th: 32.2 },
  { p: 0.12, th: 89.4 },
  { p: 0.15, th: 91.6 },
  { p: 0.18, th: 93.1 },
  { p: 0.21, th: 95.1 },
  { p: 0.24, th: 208.9 },
  { p: 0.27, th: 213.2 },
  { p: 0.3, th: 217.9 },
];

let rng = mulberry32(Date.now() & 0xffff);

/* ===== Zustand ===== */
const activeTab = ref("loss"); // Szenario (SimShell v-model): loss | app
const sev = ref(6); // Schweregrad 1..10 (⚙)
const playing = ref(false);
const p50Txt = ref("–");
const p99Txt = ref("–");
const isSlideActive = useIsSlideActive();
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const presets = [
  { key: "loss", label: "Packet Loss" },
  { key: "app", label: "Langsame Anwendung" },
];

function sample() {
  const c = LUT[sev.value];
  if (activeTab.value === "loss") {
    let lat = RTT + (rng() - 0.5) * 10,
      k = 0;
    while (k < 4 && rng() < c.p) {
      lat += RTO[k] * (1 + (rng() - 0.5) * 0.12);
      k++;
    }
    return lat;
  }
  return RTT - c.th * (Math.log(1 - rng()) + Math.log(1 - rng()));
}

/* Bins: log-uniform 25..3200ms */
const NB = 26,
  BMIN = 25,
  BMAX = 3200,
  LR = Math.log(BMAX / BMIN);
const binOf = (v) =>
  Math.max(0, Math.min(NB - 1, Math.floor((NB * Math.log(v / BMIN)) / LR)));
const binLo = (i) => BMIN * Math.exp((LR * i) / NB);
const PLATEAUS = [40, 240, 640, 1440];

/* Rolling-Strukturen */
const COLS = 120;
let hmCols = []; // je Spalte: Float32Array(NB) Anteile
const RES_N = 4000;
let res = [],
  resI = 0;

const REASON = {
  loss: '<b>Packet Loss.</b> Die Masse sammelt sich in <b>diskreten Banden</b>: RTT (~40 ms), RTT+200, RTT+600, RTT+1400 — jede Bande ist „k Retransmissions in Folge", geometrisch dünner werdend (p, p², p³). Kein Anwendungsverhalten erzeugt diese Quantisierung. Diagnose ohne einen einzigen weiteren Kanal — aber nur, wenn man die Verteilung ansieht statt p50/p99.',
  app: "<b>Langsame Anwendung.</b> Gleiche p99, aber die Masse ist ein <b>Kontinuum</b> — Bearbeitungszeiten verschmieren, keine Banden. Der Vergleich mit dem Loss-Szenario (Tab) bei identischem Schweregrad ist der Kernmoment: identische Perzentil-Zahlen, unverwechselbar verschiedene Form. <b>Der Mittelwert/das Perzentil vernichtet genau die Information, die diagnostiziert.</b>",
};
const reasonHtml = computed(() => REASON[activeTab.value]);
const sevLabel = computed(() => {
  const c = LUT[sev.value];
  return (
    sev.value +
    (activeTab.value === "loss"
      ? " · Loss " + (c.p * 100).toFixed(0) + "%"
      : " · θ=" + c.th)
  );
});

/* ===== D3-Rendering (verbatim, an Refs gebunden) ===== */
const SVG_H = 208;
const M = { t: 12, r: 14, b: 24, l: 52 };
const hmEl = ref(null);
const histEl = ref(null);
const panelsEl = ref(null);
const ch = {};
let resizeObs = null;

function yPos(c, v) {
  return c.y(Math.max(BMIN, Math.min(BMAX, v)));
}
function mk(id, el) {
  const svg = select(el);
  svg.selectAll("*").remove();
  const c = { svg, h: SVG_H, g: svg.append("g"), gf: svg.append("g") };
  ch[id] = c;
  layout(c, id);
}
function layout(c, id) {
  /* clientWidth statt getBoundingClientRect: Slidev skaliert die Folie per
     CSS-Transform, die SVG-Koordinaten brauchen aber logische Pixel. */
  const w = c.svg.node().parentNode.clientWidth || 400;
  c.w = w;
  c.svg.attr("width", w);
  c.y = scaleLog()
    .domain([BMIN, BMAX])
    .range([c.h - M.b, M.t]);
  c.x =
    id === "hm"
      ? scaleLinear()
          .domain([0, COLS])
          .range([M.l, w - M.r])
      : scaleLinear()
          .domain([0, 0.6])
          .range([M.l, w - M.r]);
  c.g.selectAll("*").remove();
  [40, 100, 240, 640, 1440, 3000].forEach((v) => {
    c.g
      .append("line")
      .attr("x1", M.l)
      .attr("x2", w - M.r)
      .attr("y1", c.y(v))
      .attr("y2", c.y(v))
      .attr(
        "stroke",
        PLATEAUS.includes(v) ? "var(--lr-band)" : "var(--lr-hair)",
      )
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", PLATEAUS.includes(v) ? "4 3" : null)
      .attr("opacity", PLATEAUS.includes(v) ? 0.75 : 1);
    c.g
      .append("text")
      .attr("x", M.l - 6)
      .attr("y", c.y(v))
      .attr("dy", ".32em")
      .attr("text-anchor", "end")
      .style("font-family", "var(--slidev-code-font-family)")
      .style("font-size", "9px")
      .attr("fill", PLATEAUS.includes(v) ? "var(--lr-band)" : "var(--lr-muted)")
      .text(v);
  });
  c.g
    .append("text")
    .attr("x", M.l - 6)
    .attr("y", M.t - 2)
    .attr("text-anchor", "end")
    .style("font-family", "var(--slidev-code-font-family)")
    .style("font-size", "9px")
    .attr("fill", "var(--lr-muted)")
    .text("ms");
}

function renderHM() {
  const c = ch.hm;
  if (!c || !c.x) return;
  const cw = (c.w - M.l - M.r) / COLS;
  const cells = [];
  hmCols.forEach((col, ci) => {
    for (let b = 0; b < NB; b++) {
      const v = col[b];
      if (v > 0.004) cells.push({ ci, b, v });
    }
  });
  const sel = c.gf.selectAll("rect.c").data(cells, (d, i) => i);
  sel
    .enter()
    .append("rect")
    .attr("class", "c")
    .merge(sel)
    .attr("x", (d) => c.x(d.ci))
    .attr("width", Math.ceil(cw))
    .attr("y", (d) => c.y(binLo(d.b + 1)))
    .attr("height", (d) => c.y(binLo(d.b)) - c.y(binLo(d.b + 1)))
    .attr("fill", "var(--lr-x)")
    .attr("opacity", (d) => Math.min(0.92, 0.12 + 2.2 * d.v));
  sel.exit().remove();
}
function renderHist() {
  const c = ch.hist;
  if (!c || !c.x) return;
  const counts = new Float32Array(NB);
  let n = 0;
  res.forEach((v) => {
    counts[binOf(v)]++;
    n++;
  });
  if (!n) return;
  const bars = [];
  for (let b = 0; b < NB; b++) bars.push({ b, f: counts[b] / n });
  const sel = c.gf.selectAll("rect.b").data(bars, (d) => d.b);
  sel
    .enter()
    .append("rect")
    .attr("class", "b")
    .attr("fill", "var(--lr-x)")
    .attr("opacity", 0.75)
    .merge(sel)
    .attr("x", M.l)
    .attr("width", (d) => Math.max(0, c.x(d.f) - M.l))
    .attr("y", (d) => c.y(binLo(d.b + 1)))
    .attr("height", (d) =>
      Math.max(1, c.y(binLo(d.b)) - c.y(binLo(d.b + 1)) - 1),
    );
  sel.exit().remove();
  // Perzentile
  const a = [...res].sort((x, y) => x - y);
  const p50 = a[Math.floor(0.5 * (a.length - 1))],
    p99 = a[Math.floor(0.99 * (a.length - 1))];
  p50Txt.value = p50.toFixed(0) + " ms";
  p99Txt.value = p99.toFixed(0) + " ms";
  ["p50v", "p99v"].forEach((cls, i) => {
    const v = i ? p99 : p50;
    let l = c.gf.select("line." + cls);
    if (l.empty())
      l = c.gf
        .append("line")
        .attr("class", cls)
        .attr("stroke", i ? "var(--lr-warn)" : "var(--lr-ok)")
        .attr("stroke-width", 1.4)
        .attr("stroke-dasharray", "3 3");
    l.attr("x1", M.l)
      .attr("x2", c.w - M.r)
      .attr("y1", yPos(c, v))
      .attr("y2", yPos(c, v));
  });
}

/* ===== rAF-Loop (Original frei laufend — hier ▶/⏸-gegatet) ===== */
let rafId = 0;
function stepBatch() {
  const batch = 110,
    col = new Float32Array(NB);
  for (let i = 0; i < batch; i++) {
    const v = sample();
    col[binOf(v)] += 1 / batch;
    if (res.length < RES_N) res.push(v);
    else {
      res[resI] = v;
      resI = (resI + 1) % RES_N;
    }
  }
  hmCols.push(col);
  if (hmCols.length > COLS) hmCols.shift();
}
function frame() {
  if (!playing.value) return;
  stepBatch();
  renderHM();
  renderHist();
  rafId = requestAnimationFrame(frame);
}
function pause() {
  playing.value = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}
function togglePlay() {
  if (playing.value) {
    pause();
    return;
  }
  if (REDUCED) {
    /* prefers-reduced-motion: statt Dauerlauf einmalig das volle Fenster. */
    for (let j = 0; j < COLS; j++) stepBatch();
    renderHM();
    renderHist();
    return;
  }
  playing.value = true;
  rafId = requestAnimationFrame(frame);
}

function resetData() {
  hmCols = [];
  res = [];
  resI = 0;
}
function clearRender() {
  if (!ch.hm || !ch.hist) return;
  renderHM();
  ch.hist.gf.selectAll("*").remove();
  p50Txt.value = "–";
  p99Txt.value = "–";
}
function doReset() {
  pause();
  rng = mulberry32(Date.now() & 0xffff);
  resetData();
  clearRender();
}

/* Original: Tab-/Slider-Wechsel leert die Rolling-Fenster (reset+apply),
   ein laufender Strom läuft mit dem neuen Szenario weiter. */
watch([activeTab, sev], () => {
  resetData();
  clearRender();
});
watch(isSlideActive, (a) => {
  if (!a) pause();
});

onMounted(() => {
  mk("hm", hmEl.value);
  mk("hist", histEl.value);
  resizeObs = new ResizeObserver(() => {
    layout(ch.hm, "hm");
    layout(ch.hist, "hist");
    renderHM();
    renderHist();
  });
  if (panelsEl.value) resizeObs.observe(panelsEl.value);
});
onUnmounted(() => {
  pause();
  resizeObs?.disconnect();
});
</script>

<template>
  <SimShell
    eyebrow="Verteilung schlägt Perzentil"
    title="Gleiche p99 — völlig andere Krankheit"
    subtitle="Beide Szenarien sind so kalibriert, dass die p99 identisch ist. In Perzentil-Charts sehen sie gleich krank aus. Die Form der Verteilung trennt sie: Packet Loss erzeugt diskrete Banden auf den TCP-RTO-Backoff-Stufen, eine langsame Anwendung ein Kontinuum."
    :presets="presets"
    presets-label="Szenario:"
    gear-title="Schweregrad & Modell"
    :model-value="activeTab"
    @update:model-value="(v) => (activeTab = v)"
  >
    <template #transport>
      <button class="lr-btn lr-primary" @click="togglePlay">
        {{ playing ? "⏸ Pause" : "▶ Abspielen" }}
      </button>
      <span class="lr-stat"
        >p50 = <b>{{ p50Txt }}</b></span
      >
      <span class="lr-stat"
        >p99 = <b class="lr-p99">{{ p99Txt }}</b></span
      >
    </template>

    <template #stage>
      <div class="lr-main">
        <div ref="panelsEl" class="lr-panels">
          <div class="lr-panel">
            <div class="lr-phead">
              <span class="lr-ptitle">Latenz-Heatmap</span>
              <span class="lr-psub"
                >Zeit → · Latenz (log) ↑ · Farbe = Anteil der Requests</span
              >
            </div>
            <svg ref="hmEl" :height="SVG_H" />
            <div class="lr-legend">
              <span
                ><i class="lr-key lr-key-band" />RTO-Stufen: 40 / 240 / 640 /
                1440 ms (RTT + kumulierte Backoffs 200·2ᵏ)</span
              >
            </div>
          </div>
          <div class="lr-panel">
            <div class="lr-phead">
              <span class="lr-ptitle">Histogramm</span>
              <span class="lr-psub">letzte ~4000 Requests</span>
            </div>
            <svg ref="histEl" :height="SVG_H" />
            <div class="lr-legend">
              <span
                ><i class="lr-key lr-key-x" />Anteil pro Bin (log-Achse)</span
              >
            </div>
          </div>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <p class="lr-reason" v-html="reasonHtml" />
      </div>
    </template>

    <template #gear>
      <div class="lr-gear">
        <QueueSlider
          label="Schweregrad"
          :model-value="sev"
          :min="1"
          :max="10"
          :step="1"
          @update:model-value="(v) => (sev = v)"
        />
        <div class="lr-sevval">{{ sevLabel }}</div>
        <button class="lr-btn" @click="doReset">Zurücksetzen</button>
        <p class="lr-gear-note">
          Modell: Loss-Pfad <code>lat = RTT + Σ RTOₖ</code> mit RTO-Backoff
          200/400/800/1600 ms und Verlustwahrscheinlichkeit p pro Übertragung;
          Slow-App <code>lat = RTT + Gamma(2, θ)</code>. θ ist pro Schweregrad
          numerisch so kalibriert, dass beide p99 übereinstimmen (Monte-Carlo,
          Abweichung &lt;1%). <b>Ehrlichkeitshinweis 1:</b> der <b>Median</b>
          unterscheidet sich (Loss bleibt bimodal bei ~RTT, Slow-App wandert) —
          auch das ist Verteilungsform-Information, die p99 allein wegwirft.
          <b>Ehrlichkeitshinweis 2:</b> die konkreten Stufen (200 ms initial,
          Verdopplung) sind Modellannahmen im Stil gängiger Stacks; reale RTOs
          hängen von RTT-Schätzer und OS ab. Universell ist die
          <b>Struktur</b> — diskrete, geometrisch wachsende Banden — nicht die
          Millisekunden.
        </p>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Palette des Originals (Light verbatim) + Dark-Overrides. */
.lr-main,
.lr-gear {
  --lr-field: #eef1f4;
  --lr-panel: #fff;
  --lr-ink: #14213d;
  --lr-muted: #6b7689;
  --lr-hair: #dde3ea;
  --lr-hair-strong: #c3ccd6;
  --lr-x: #3b3f8f;
  --lr-warn: #c23b58;
  --lr-ok: #1f8a82;
  --lr-band: #b08247;
}
:global(html.dark .lr-main),
:global(html.dark .lr-gear) {
  --lr-field: #10151c;
  --lr-panel: #151b24;
  --lr-ink: #dee5f0;
  --lr-muted: #93a0b4;
  --lr-hair: #26303e;
  --lr-hair-strong: #3a4757;
  --lr-x: #8d92e8;
  --lr-warn: #e8748d;
  --lr-ok: #43c2b7;
  --lr-band: #d9a860;
}

.lr-main {
  color: var(--lr-ink);
}
.lr-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 10px;
  align-items: stretch;
}
.lr-panel {
  background: var(--lr-panel);
  border: 1px solid var(--lr-hair);
  border-radius: 9px;
  min-width: 0;
}
.lr-phead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 7px 11px 0;
}
.lr-ptitle {
  font-family: var(--slidev-code-font-family);
  font-size: 10.5px;
  font-weight: 600;
}
.lr-psub {
  font-family: var(--slidev-code-font-family);
  font-size: 8px;
  color: var(--lr-muted);
  text-align: right;
}
.lr-panel svg {
  display: block;
  width: 100%;
}
.lr-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 2px 11px 7px;
  font-family: var(--slidev-code-font-family);
  font-size: 8px;
  color: var(--lr-muted);
}
.lr-key {
  width: 16px;
  height: 0;
  border-top: 2px solid;
  display: inline-block;
  margin-right: 5px;
}
.lr-key-band {
  border-color: var(--lr-band);
}
.lr-key-x {
  border-color: var(--lr-x);
}
.lr-reason {
  margin: 8px 0 0;
  background: var(--lr-panel);
  border: 1px solid var(--lr-hair);
  border-radius: 9px;
  padding: 8px 12px;
  font-size: 10.5px;
  line-height: 1.5;
  min-height: 62px;
}
.lr-reason :deep(b) {
  font-weight: 650;
}

/* Transport & Buttons */
.lr-btn {
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  border: 1px solid var(--lr-hair-strong, #c3ccd6);
  background: var(--lr-panel, #fff);
  color: inherit;
  border-radius: 7px;
  padding: 4px 10px;
}
.lr-primary {
  font-weight: 650;
}
.lr-stat {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.lr-stat b {
  font-weight: 650;
}
.lr-p99 {
  color: var(--lr-warn, #c23b58);
}

.lr-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.lr-gear .lr-btn {
  align-self: flex-start;
}
.lr-sevval {
  font-family: var(--slidev-code-font-family);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--lr-x);
  font-variant-numeric: tabular-nums;
}
.lr-gear-note {
  font-size: 9.5px;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0;
}
.lr-gear-note code {
  font-family: var(--slidev-code-font-family);
  font-size: 8.5px;
  background: var(--lr-field);
  padding: 1px 4px;
  border-radius: 3px;
}
.lr-gear-note b {
  font-weight: 650;
}
</style>
