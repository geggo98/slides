<script setup>
/**
 * BufferbloatSim.vue — „Der Puffer, der alles rettet" (Predict first),
 * portiert aus bufferbloat-predict-first.html. Modell, Preset-Kurven,
 * Verdict-Logik und Canvas-Zeichencode verbatim übernommen; DOM-Plumbing →
 * Vue-Refs, Skizze → usePredictSketch, Labor-Regler hinter dem ⚙ der
 * SimShell, Erklärung/Modell als zweiter Tab (v-show, damit die Canvases
 * gemountet bleiben).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import { fmtDe as fmt, mulberry32, pois, randomSeed } from "./lib/rng.js";
import { usePredictSketch } from "./lib/usePredictSketch";

/* ===== Modell (identisch zum verifizierten Original) ===== */
const MU = 100,
  D = 1.0,
  S = 0.1,
  DT = 0.05,
  T_END = 120,
  O0 = 20,
  O1 = 50,
  L0 = 70,
  L1 = 140;
const GP_MAX = 120,
  WT_MAX = 12;
const B_STEPS = [25, 50, 100, 200, 400, 800, 2000, 3200];
const sig = (x) => 1 / (1 + Math.exp(-x));

class Sim {
  constructor(seed, B, ageDrop) {
    this.rnd = mulberry32(seed);
    this.B = B;
    this.ageDrop = ageDrop;
    this.t = 0;
    this.q = 2;
    this.rej = 0;
    this.exp = 0;
    this.ema = L0;
    this.goodSum = 0;
    this.servedDead = 0;
    this.pts = []; // {t,q,w,g}
  }
  step() {
    const lam = this.t >= O0 && this.t < O1 ? L1 : L0;
    const a = pois(lam * DT, this.rnd);
    const admitted = Math.min(a, Math.max(0, this.B - this.q));
    this.rej += a - admitted;
    this.q += admitted;
    if (this.ageDrop && this.q > MU * D) {
      this.exp += this.q - MU * D;
      this.q = MU * D;
    }
    const w = this.q / MU;
    const c = Math.min(this.q, pois(MU * DT, this.rnd));
    this.q -= c;
    const pDead = sig((w - D) / S);
    const g = (c * (1 - pDead)) / DT;
    this.goodSum += c * (1 - pDead);
    this.servedDead += c * pDead;
    this.ema += (DT / 0.8) * (g - this.ema);
    this.t += DT;
    this.pts.push({ t: this.t, q: this.q, w, g: this.ema });
  }
  runTo(t) {
    while (this.t < t - 1e-9) this.step();
  }
}

/* Preset-Vorhersagen (verbatim) */
const PRESET_FNS = {
  full: (t) => (t >= O0 && t < O1 ? 100 : 70),
  dip: (t) =>
    t < O0
      ? 70
      : t < O1
        ? Math.max(20, 100 - (t - O0) * 3)
        : Math.min(70, 20 + (t - O1) * 5),
  dead: (t) =>
    t < O0
      ? 70
      : t < O0 + 8
        ? Math.max(0, 70 - (t - O0) * 10)
        : t < 85
          ? 0
          : Math.min(70, (t - 85) * 10),
};

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const bIdx = ref(6); // Index in B_STEPS → 2 000 Plätze
const ageDrop = ref(false);
const bufSize = computed(() => B_STEPS[bIdx.value]);
const phase = ref("sketch"); // sketch | running | done
let sim = null;
let oldRuns = [];
let animId = null;

const sketch = usePredictSketch({
  t0: 0,
  tEnd: T_END,
  step: 0.5,
  vMax: GP_MAX,
});
const {
  ready: sketchReady,
  covWarn: sketchCovWarn,
  hasInk: sketchHasInk,
  skipped: sketchSkipped,
} = sketch;

const activeTab = ref("sim");
const readout = shallowRef(null); // letzter Sim-Punkt + Zähler
const verdict = shallowRef(null); // {tone, title, html, chips}

const canStart = computed(() => phase.value === "sketch" && sketchReady.value);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);

/* ===== Canvas ===== */
const gpCanvas = ref(null);
const wtCanvas = ref(null);
const chartWrap = ref(null);
const gpH = 230,
  wtH = 64;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 46, r: 12, t: 12, b: 22 },
  WPAD = { l: 46, r: 12, t: 6, b: 16 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (t) => PAD.l + (t / T_END) * (W - PAD.l - PAD.r);
const tOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T_END;
const yOf = (g) =>
  PAD.t + (1 - Math.min(g, GP_MAX) / GP_MAX) * (gpH - PAD.t - PAD.b);
const gOf = (y) => (1 - (y - PAD.t) / (gpH - PAD.t - PAD.b)) * GP_MAX;
const yW = (w) =>
  WPAD.t + (1 - Math.min(w, WT_MAX) / WT_MAX) * (wtH - WPAD.t - WPAD.b);

/* Palette aus den CSS-Variablen des Chart-Containers (Light/Dark via CSS). */
function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !gpCanvas.value || !wtCanvas.value) return;
  W = wrap.clientWidth;
  // Slidev skaliert die Folie per CSS-Transform — Backing-Store zusätzlich
  // mit dem effektiven Scale multiplizieren, sonst wird der Canvas unscharf.
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [gpCanvas.value, gpH],
    [wtCanvas.value, wtH],
  ]) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = h + "px";
  }
  drawAll();
}

function grid(ctx, h, pad, yTicks, yLabel, yPos) {
  ctx.clearRect(0, 0, W, h);
  ctx.save();
  ctx.strokeStyle = cssVar("--bb-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 2) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--bb-grid-m");
  ctx.fillStyle = cssVar("--bb-muted");
  ctx.font = `10px ${MONO}`;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 20) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
    ctx.fillText(t + " s", x - 8, h - pad.b + 13);
  }
  for (const [val, lab] of yTicks) {
    const y = Math.round(yPos(val)) + 0.5;
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.fillText(lab, 6, y + 4);
  }
  ctx.stroke();
  // Achsen-Label oben links IM Plot (links kollidiert es mit dem Top-Tick)
  ctx.fillText(yLabel, pad.l + 8, pad.t + 10);
  ctx.restore();
}
function burstBand(ctx, h, pad, withLabel) {
  ctx.save();
  ctx.fillStyle = cssVar("--bb-burst-fill");
  ctx.fillRect(xOf(O0), pad.t, xOf(O1) - xOf(O0), h - pad.t - pad.b);
  ctx.strokeStyle = cssVar("--bb-burst-edge");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    xOf(O0) + 0.5,
    pad.t + 0.5,
    xOf(O1) - xOf(O0) - 1,
    h - pad.t - pad.b - 1,
  );
  if (withLabel) {
    ctx.fillStyle = cssVar("--bb-burst-edge");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Überlast 140 req/s", xOf(O0) + 5, pad.t + 14);
  }
  ctx.restore();
}
function plotLine(ctx, pts, getX, getY, color, width, dash, alpha = 1) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  let started = false;
  for (const p of pts) {
    const x = getX(p),
      y = getY(p);
    if (x == null || y == null) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawGood() {
  const c = gpCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    gpH,
    PAD,
    [
      [0, "0"],
      [20, "20"],
      [40, "40"],
      [60, "60"],
      [80, "80"],
      [100, "100"],
      [120, "120"],
    ],
    "Goodput [req/s]",
    yOf,
  );
  burstBand(ctx, gpH, PAD, true);
  // Referenzen: Angebot lambda(t) und Kapazitaet mu
  const lamPts = [
    { t: 0, v: L0 },
    { t: O0, v: L0 },
    { t: O0, v: L1 },
    { t: O1, v: L1 },
    { t: O1, v: L0 },
    { t: T_END, v: L0 },
  ];
  plotLine(
    ctx,
    lamPts,
    (p) => xOf(p.t),
    (p) => yOf(p.v),
    cssVar("--bb-ref"),
    1.4,
    [6, 4],
  );
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yOf(MU),
    cssVar("--bb-ref-mu"),
    1.2,
    [2, 4],
  );
  ctx.save();
  ctx.fillStyle = cssVar("--bb-muted");
  ctx.font = `10px ${MONO}`;
  ctx.fillText("Angebot λ", xOf(2), yOf(L0) - 5);
  ctx.fillText("Kapazität μ = 100", W - PAD.r - 118, yOf(MU) - 5);
  ctx.restore();
  for (const run of oldRuns)
    plotLine(
      ctx,
      run,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--bb-signal"),
      1.6,
      [],
      0.2,
    );
  if (sim)
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--bb-signal"),
      2.2,
    );
  const predPts = sketch.points();
  plotLine(
    ctx,
    predPts,
    (p) => (p.v == null ? null : xOf(p.t)),
    (p) => (p.v == null ? null : yOf(p.v)),
    cssVar("--bb-pencil"),
    2,
    [7, 5],
  );
}
function drawWait() {
  const c = wtCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    wtH,
    WPAD,
    [
      [0, "0"],
      [6, "6"],
      [12, "12"],
    ],
    "Wartezeit [s]",
    yW,
  );
  burstBand(ctx, wtH, WPAD, false);
  // Deadline-Linie
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yW(D),
    cssVar("--bb-danger"),
    1.2,
    [2, 4],
  );
  ctx.save();
  ctx.fillStyle = cssVar("--bb-danger");
  ctx.font = `10px ${MONO}`;
  ctx.fillText("Deadline 1 s", W - WPAD.r - 80, yW(D) - 3);
  ctx.restore();
  if (sim) {
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yW(p.w),
      cssVar("--bb-wait"),
      1.8,
    );
    const mx = Math.max(...sim.pts.map((p) => p.w));
    if (mx > WT_MAX) {
      ctx.save();
      ctx.fillStyle = cssVar("--bb-wait");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "Wartezeit bis " + fmt(mx, 1) + " s (Skala begrenzt)",
        xOf(45),
        WPAD.t + 12,
      );
      ctx.restore();
    }
  }
}
function drawAll() {
  drawGood();
  drawWait();
}

/* ===== Skizzieren (Pointer → usePredictSketch) ===== */
function evToTV(ev) {
  const c = gpCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * gpH;
  return { t: tOf(x), v: gOf(y) };
}
function onGpDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  gpCanvas.value.setPointerCapture(ev.pointerId);
  onGpMove(ev);
}
function onGpMove(ev) {
  if (!sketch.isDrawing()) return;
  const { t, v } = evToTV(ev);
  sketch.ink(t, v);
}
function onGpUp() {
  sketch.strokeEnd();
}
watch(sketch.version, () => {
  if (phase.value !== "running") drawGood();
});

function applyPreset(key) {
  if (phase.value !== "sketch") return;
  sketch.applyPreset(PRESET_FNS[key]);
}
function clearSketch() {
  if (phase.value === "running") return;
  sketch.clear();
  if (phase.value === "done") softResetToSketch();
  drawAll();
}

/* ===== Lauf ===== */
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function startRun() {
  if (!canStart.value) return;
  sketch.fillGaps();
  phase.value = "running";
  sim = new Sim(seed, bufSize.value, ageDrop.value);
  if (reduceMotion) {
    sim.runTo(T_END);
    finishRun();
    drawAll();
    updateReadout();
    return;
  }
  const stepsPerFrame = 5; // 2400 Schritte -> ~8 s
  const loop = () => {
    for (let k = 0; k < stepsPerFrame && sim.t < T_END; k++) sim.step();
    drawAll();
    updateReadout();
    if (sim.t < T_END) animId = requestAnimationFrame(loop);
    else finishRun();
  };
  animId = requestAnimationFrame(loop);
}
function updateReadout() {
  if (!sim || !sim.pts.length) return;
  readout.value = { ...sim.pts[sim.pts.length - 1], rej: sim.rej };
}

/* ===== Auswertung (verbatim) ===== */
function classify(minG) {
  return minG >= 60 ? "full" : minG >= 10 ? "dip" : "dead";
}
const LABEL = {
  full: "volle Auslastung ohne Einbruch",
  dip: "ein begrenzter Einbruch",
  dead: "Goodput ≈ 0",
};
function finishRun() {
  phase.value = "done";
  animId = null;
  const during = sim.pts.filter((p) => p.t > 25 && p.t < 50);
  const realMin = Math.min(...during.map((p) => p.g));
  const rec = sim.pts.find((p) => p.t > O1 && p.g > 60);
  const recT = rec ? rec.t : Infinity;
  const totalArr = Math.round(L0 * (T_END - 30) + L1 * 30);
  const errPct = (100 * sim.rej) / totalArr;
  const rc = classify(realMin);
  let predMin = null,
    pc = null;
  if (!sketchSkipped.value) {
    const pv = sketch
      .points()
      .filter((p) => p.v != null && p.t > 25 && p.t < 50)
      .map((p) => p.v);
    predMin = pv.length ? Math.min(...pv) : null;
    pc = predMin == null ? null : classify(predMin);
  }
  let t, b;
  const recTxt =
    recT === Infinity
      ? "keine Erholung im Zeitfenster"
      : 'Erholung erst bei <b class="mono">t = ' +
        fmt(recT) +
        " s</b>" +
        (recT > O1 + 5
          ? " — <b>" + fmt(recT - O1) + " s nach Ende der Überlast</b>"
          : "");
  if (pc == null) {
    t = "Ergebnis: " + LABEL[rc] + ".";
    b =
      'Keine Vorhersage abgegeben. Minimaler Goodput während der Überlast: <b class="mono">' +
      fmt(realMin) +
      " req/s</b>; " +
      recTxt +
      ".";
  } else if (pc === rc) {
    t = "Deine Vorhersage trifft die Kategorie: " + LABEL[rc] + ".";
    b =
      'Dein Minimum: <b class="mono">' +
      fmt(predMin) +
      ' req/s</b> · gemessen: <b class="mono">' +
      fmt(realMin) +
      " req/s</b>; " +
      recTxt +
      ".";
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      'Dein Minimum: <b class="mono">' +
      fmt(predMin) +
      ' req/s</b> · gemessen: <b class="mono">' +
      fmt(realMin) +
      " req/s</b>; " +
      recTxt +
      ". " +
      (rc === "dead"
        ? "Der Server war die ganze Zeit zu 100 % ausgelastet — er hat nur Antworten für Clients produziert, die längst weg waren."
        : "");
  }
  const chips =
    "Fehlerrate (abgewiesen): <b>" +
    fmt(errPct, 1) +
    " %</b> · tote Antworten (Deadline gerissen): <b>" +
    fmt(sim.servedDead) +
    "</b>" +
    (sim.exp > 0
      ? " · per Age-Drop verworfen: <b>" + fmt(sim.exp) + "</b>"
      : "") +
    " · Goodput gesamt: <b>" +
    fmt(sim.goodSum) +
    "</b> Antworten";
  verdict.value = {
    tone: rc === "dead" ? "bad" : pc === rc ? "ok" : "warn",
    title: t,
    html: b,
    chips,
  };
}

/* ===== Experimentieren (⚙) ===== */
function archiveAndRun(newSeed) {
  if (phase.value === "running") return;
  if (sim) oldRuns.push(sim.pts.map((p) => ({ t: p.t, g: p.g })));
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  sim = null;
  drawAll();
  phase.value = "sketch";
  if (sketchReady.value) startRun();
}
function softResetToSketch() {
  phase.value = "sketch";
  sim = null;
  verdict.value = null;
}
function resetAll() {
  if (phase.value === "running") return;
  oldRuns = [];
  sketch.clear();
  bIdx.value = 6;
  ageDrop.value = false;
  seed = randomSeed();
  readout.value = null;
  softResetToSketch();
  drawAll();
}

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
watch(isSlideActive, (active) => {
  // Folie verlassen während des Laufs: Animation abbrechen, Lauf synchron
  // zu Ende rechnen (Slidev hält Nachbar-Folien gemountet).
  if (!active && phase.value === "running" && sim) {
    if (animId) cancelAnimationFrame(animId);
    sim.runTo(T_END);
    finishRun();
    drawAll();
    updateReadout();
  }
});
onMounted(() => {
  sizeCanvases();
  resizeObs = new ResizeObserver(sizeCanvases);
  if (chartWrap.value) resizeObs.observe(chartWrap.value);
});
onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId);
  resizeObs?.disconnect();
});
</script>

<template>
  <SimShell
    eyebrow="Bufferbloat · Predict first"
    title="Der Puffer, der alles rettet"
    :subtitle="`μ = 100 req/s · Deadline 1 s · Puffer ${fmt(bufSize)} Plätze (FIFO) · keine Retries — von t = 20 s bis t = 50 s liegt die Last mit 140 req/s über der Kapazität (sonst 70 req/s). Skizziere den Goodput — Antworten innerhalb der Deadline — über die vollen 120 s, dann starte.`"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'full', label: 'volle Auslastung' },
      { key: 'dip', label: 'Einbruch, dann Erholung' },
      { key: 'dead', label: 'Einbruch weit über die Überlast hinaus' },
    ]"
    gear-title="Experimentieren"
    @preset="applyPreset"
  >
    <template #presets-extra>
      <button class="bb-btn bb-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="bb-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="bb-btn bb-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="bb-stage">
        <Tabs
          class="bb-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="bb-charts">
          <div class="bb-chartbox">
            <canvas
              ref="gpCanvas"
              aria-label="Goodput über Zeit. Zeichenfläche für die Vorhersage."
              @pointerdown="onGpDown"
              @pointermove="onGpMove"
              @pointerup="onGpUp"
              @pointercancel="onGpUp"
            />
            <div v-if="showSketchNote" class="bb-note">
              <b>✏️ Skizziere hier</b> den Goodput, Sekunde 0–120 — oder wähle
              oben ein Preset.
            </div>
          </div>
          <div class="bb-chartbox">
            <canvas
              ref="wtCanvas"
              aria-label="Wartezeit in der Queue über Zeit"
            />
          </div>
          <div class="bb-strip">
            <span v-if="readout" class="bb-readouts">
              t <b>{{ fmt(readout.t) }} s</b> · Queue
              <b>{{ fmt(readout.q) }}</b> · Wartezeit
              <b :class="{ bad: readout.w > D }">{{ fmt(readout.w, 2) }} s</b>
              · Abgewiesen (503) <b>{{ fmt(readout.rej) }}</b> · Goodput
              <b
                :class="{
                  bad: readout.g < 10,
                  good: readout.g > 55,
                }"
                >{{ fmt(Math.max(0, readout.g)) }}</b
              >
            </span>
            <span class="bb-legend">
              <span><i class="sw pred" /> Vorhersage</span>
              <span><i class="sw real" /> Simulation (Goodput)</span>
              <span><i class="sw old" /> frühere Läufe</span>
              <span><i class="sw wt" /> Wartezeit</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="bb-explain">
          <div class="bb-sys" aria-label="Systemdiagramm">
            <span class="node"
              >Clients<span class="lbl"
                >70 → 140 → 70 req/s · Deadline 1 s</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node qbox"
              >Queue<span class="lbl"
                >Puffer: {{ fmt(bufSize) }} Plätze (FIFO)</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Service<span class="lbl">μ = 100 req/s</span></span
            >
          </div>
          <p>
            Little bzw. FIFO: Die Wartezeit ist
            <span class="mono">w = Queue-Tiefe / μ</span>. Sobald mehr als
            <span class="mono">μ·D = 100</span> Anfragen warten, überschreitet
            <i>jede</i> weitere die Deadline — alles, was der Server ab dann
            serviert, ist <b>tote Arbeit</b>: Der Server läuft mit 100 %
            Auslastung und produziert Antworten für Clients, die längst weg
            sind. Der große Puffer hat keine einzige Anfrage „gerettet“, er hat
            <b>Fehler in Latenz umgewandelt</b> — aus sichtbaren 503ern werden
            unsichtbare Timeouts beim Client. Und weil der Backlog nach dem
            Überlastende nur mit <span class="mono">μ − λ = 30 req/s</span>
            abfließt, bleibt der Goodput noch lange danach bei null.
          </p>
          <p>
            Ein kleiner Puffer (≈ Kapazität × Deadline oder darunter) weist den
            Überschuss sofort ab: ehrliche Fehler, aber alles Servierte ist
            frisch — und die Erholung ist augenblicklich. Noch besser ist
            <b>deadline-bewusstes Verwerfen</b>: beim Herausnehmen alles
            wegwerfen, was seine Deadline schon gerissen hat. Das ist die
            Kernidee hinter CoDel — auf die <i>Verweilzeit</i> regeln, nicht auf
            die Queue-Länge.
          </p>
          <p>
            Abgrenzung: Hier gibt es <b>bewusst keine Retries</b>. Die
            selbstverstärkende Schleife (Timeout → Retry → mehr Last → mehr
            Timeouts) ist der Retry-Sturm — eine eigene Simulation. Bufferbloat
            ist der Verstärker <i>darunter</i>: Der aufgeblähte Puffer erzeugt
            genau die Timeouts, die den Retry-Sturm dann füttern. Kleine Puffer
            sind auch deshalb die Vorstufe jeder Retry-Hygiene. Und der ehrliche
            Gegenpunkt: Puffer sind nicht nutzlos — sie absorbieren
            <i>kurze</i> Bursts. Bei <i>anhaltender</i> Überlast wie hier
            absorbieren sie nichts, sie verzögern nur.
          </p>
          <p class="bb-foot">
            <b>Bewusste Vereinfachungen dieses Modells:</b> Wartezeit als
            Fluid-Näherung <span class="mono">w = q/μ</span> (FIFO);
            Deadline-Überschreitung als glatte Funktion der Wartezeit;
            Poisson-Ankünfte und -Bedienung; Goodput-Anzeige exponentiell
            geglättet (τ ≈ 0,8 s); Age-Drop kappt die Queue beim Bedienen auf
            <span class="mono">μ·D</span> (Verwerfen kostet nichts). Keine
            Retries — bewusst, siehe Abgrenzung. Die monotone Verschlechterung
            des Gesamt-Goodputs mit der Puffergröße in diesem Szenario, das „0 %
            Fehler, 0 Goodput“-Regime und die Age-Drop-Wirkung wurden numerisch
            verifiziert.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="bb-gear">
        <div class="bb-sl">
          <div class="bb-sl-row">
            <span class="bb-sl-label">Puffergröße</span>
            <span class="bb-sl-val">{{ fmt(bufSize) }} Plätze</span>
          </div>
          <input
            type="range"
            min="0"
            max="7"
            step="1"
            :value="bIdx"
            aria-label="Puffergröße"
            @input="bIdx = parseInt($event.target.value, 10)"
          />
        </div>
        <label class="bb-share">
          <input v-model="ageDrop" type="checkbox" />
          Deadline-bewusstes Verwerfen (Age-Drop, CoDel-Idee)
        </label>
        <p class="bb-gear-hint">
          Verkleinere den Puffer schrittweise und beobachte den Gesamt-Goodput —
          oder schalte deadline-bewusstes Verwerfen ein und lass den Puffer
          groß.
        </p>
        <div class="bb-gear-btns">
          <button
            class="bb-btn bb-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="bb-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="bb-btn"
            :disabled="phase === 'running'"
            @click="resetAll"
          >
            Alles zurücksetzen
          </button>
        </div>
      </div>
    </template>

    <template #footer>
      <div
        v-if="sketchCovWarn && phase === 'sketch'"
        class="bb-banner bb-warnb"
      >
        Zeichne die Kurve über den ganzen Zeitraum — von (fast) links bis (fast)
        rechts.
      </div>
      <div v-else-if="verdict" class="bb-banner" :class="`bb-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="bb-chips" v-html="verdict.chips" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette des Originals (Light verbatim), Dark-Variante daneben.
   Der Canvas-Code liest diese Variablen via getComputedStyle(chartWrap). */
.bb-stage,
.bb-charts,
.bb-explain,
.bb-gear {
  --bb-paper: #e9eeea;
  --bb-panel: #fcfdfc;
  --bb-ink: #16282c;
  --bb-muted: #5c6b6a;
  --bb-grid-f: #e2eae4;
  --bb-grid-m: #c6d3cb;
  --bb-pencil: #6a7480;
  --bb-signal: #0b7285;
  --bb-wait: #a97c10;
  --bb-burst-fill: rgba(226, 163, 60, 0.16);
  --bb-burst-edge: #c8912f;
  --bb-danger: #af3e1b;
  --bb-ok: #3d7a46;
  --bb-ref: #9fb4ac;
  --bb-ref-mu: #7a8c86;
}
:global(html.dark) .bb-stage,
:global(html.dark) .bb-charts,
:global(html.dark) .bb-explain,
:global(html.dark) .bb-gear {
  --bb-paper: #101a1c;
  --bb-panel: #0d1517;
  --bb-ink: #dce8e6;
  --bb-muted: #8fa3a0;
  --bb-grid-f: #1b2a2c;
  --bb-grid-m: #2d4246;
  --bb-pencil: #93a1ad;
  --bb-signal: #37b6cf;
  --bb-wait: #d9a62e;
  --bb-burst-fill: rgba(226, 163, 60, 0.1);
  --bb-burst-edge: #b98a2e;
  --bb-danger: #e0684a;
  --bb-ok: #69b877;
  --bb-ref: #4e6660;
  --bb-ref-mu: #5c7570;
}

.bb-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.bb-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bb-chartbox {
  position: relative;
  background: var(--bb-panel);
  border: 1px solid var(--bb-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.bb-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.bb-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--bb-panel) 88%, transparent);
  border: 1px dashed var(--bb-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--bb-ink);
  pointer-events: none;
  text-align: center;
}
.bb-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.bb-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--bb-muted);
}
.bb-readouts b {
  color: var(--bb-ink);
  font-weight: 600;
}
.bb-readouts b.bad {
  color: var(--bb-danger);
}
.bb-readouts b.good {
  color: var(--bb-ok);
}
.bb-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--bb-muted);
}
.bb-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.bb-legend .sw.pred {
  background: var(--bb-pencil);
}
.bb-legend .sw.real {
  background: var(--bb-signal);
}
.bb-legend .sw.old {
  background: var(--bb-signal);
  opacity: 0.3;
}
.bb-legend .sw.wt {
  background: var(--bb-wait);
}

/* Buttons in Preset-Zeile & ⚙ */
.bb-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--bb-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--bb-grid-m, #c6d3cb);
}
.bb-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.bb-primary {
  border-color: var(--bb-ok, #3d7a46);
  font-weight: 600;
}
.bb-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.bb-explain {
  max-height: 340px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--bb-ink);
  padding-right: 6px;
}
.bb-explain p {
  margin: 0 0 8px;
}
.bb-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.bb-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.bb-sys .node {
  border: 1px solid var(--bb-grid-m);
  background: var(--bb-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.bb-sys .node.qbox {
  border-style: dashed;
}
.bb-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--bb-muted);
  font-family: var(--slidev-code-font-family);
}
.bb-sys .arrow {
  color: var(--bb-muted);
}
.bb-foot {
  font-size: 9px;
  color: var(--bb-muted);
}

/* ⚙-Panel */
.bb-gear {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}
.bb-sl {
  font-family: var(--slidev-code-font-family);
}
.bb-sl-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 4px;
}
.bb-sl-val {
  white-space: nowrap;
}
.bb-sl input[type="range"] {
  width: 100%;
  accent-color: var(--bb-signal, #0b7285);
}
.bb-share {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.bb-share input {
  accent-color: var(--bb-signal, #0b7285);
}
.bb-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.bb-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner */
.bb-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.bb-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.bb-chips {
  display: block;
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  opacity: 0.85;
  margin-top: 2px;
}
.bb-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark) .bb-warnb {
  color: #d9a62e;
}
.bb-ok {
  border-color: #3d7a46;
}
.bb-warn {
  border-color: #c8912f;
}
.bb-bad {
  border-color: #af3e1b;
}
</style>
