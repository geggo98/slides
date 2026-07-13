<script setup>
/**
 * RetryStormSim.vue — „Der Retry-Sturm" (Predict first), portiert aus
 * retry-sturm-predict-first.html. Modell, Preset-Kurven, Verdict-Logik und
 * Canvas-Zeichencode verbatim übernommen; DOM-Plumbing → Vue-Refs, Skizze →
 * usePredictSketch, Labor-Slider hinter dem ⚙ der SimShell, Erklärung/Modell
 * als zweiter Tab (v-show, damit die Canvases gemountet bleiben).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { fmtDe as fmt, mulberry32, pois, randomSeed } from "./lib/rng.js";
import { usePredictSketch } from "./lib/usePredictSketch";

/* ===== Modell (identisch zum verifizierten Original) ===== */
const MU = 100,
  LAMBDA0 = 70,
  D = 1.0,
  S = 0.15,
  DT = 0.05,
  T_END = 120,
  B0 = 20,
  B1 = 30,
  SHED_Q = 50;
const GP_MAX = 120,
  Q_MAX = 1200;
const sig = (x) => 1 / (1 + Math.exp(-x));
const pT = (q) => sig((q / MU - D) / S);
const att = (p, R) =>
  R === 0 ? 1 : p > 0.999999 ? R + 1 : (1 - Math.pow(p, R + 1)) / (1 - p);

class Sim {
  constructor(seed, ampV, RV) {
    this.rnd = mulberry32(seed);
    this.amp = ampV;
    this.R = RV;
    this.t = 0;
    this.q = 2;
    this.ema = LAMBDA0;
    this.shedAt = Infinity;
    this.shedFlushed = false;
    this.pts = []; // {t,q,g,p,leff,lam}
  }
  lam(t) {
    return t >= B0 && t < B1 ? LAMBDA0 * this.amp : LAMBDA0;
  }
  step() {
    if (this.t >= this.shedAt && !this.shedFlushed) {
      this.q = Math.min(this.q, SHED_Q);
      this.shedFlushed = true;
    }
    const p = pT(this.q);
    const lamNow = this.lam(this.t);
    let lin = lamNow * att(p, this.R);
    if (this.t >= this.shedAt && this.q >= SHED_Q) lin = 0;
    const arr = pois(lin * DT, this.rnd);
    const comp = Math.min(this.q, pois(MU * DT, this.rnd));
    this.q = this.q + arr - comp;
    const g = (comp * (1 - p)) / DT;
    this.ema = this.ema + (DT / 0.8) * (g - this.ema);
    this.t += DT;
    this.pts.push({
      t: this.t,
      q: this.q,
      g: this.ema,
      p,
      leff: lin,
      lam: lamNow,
    });
  }
  runTo(t) {
    while (this.t < t - 1e-9) this.step();
  }
}

/* Preset-Vorhersagen (verbatim) */
const PRESET_FNS = {
  recover: (t) =>
    t < B1
      ? 70 - 40 * Math.sin((Math.PI * (t - B0)) / (B1 - B0))
      : Math.min(70, 30 + (t - B1) * 4),
  partial: (t) =>
    t < B1
      ? 70 - 55 * ((t - B0) / (B1 - B0))
      : Math.max(30, 15 + 90 / (1 + (t - B1) / 4)),
  collapse: (t) => (t < B0 + 4 ? Math.max(0, 70 - 25 * (t - B0)) : 0),
};

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const amp = ref(2.0);
const R = ref(2);
const phase = ref("sketch"); // sketch | running | done
let sim = null;
let history = null;
let oldRuns = [];
let animId = null;

const sketch = usePredictSketch({
  t0: B0,
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
const readout = shallowRef(null); // letzter Sim-Punkt
const verdict = shallowRef(null); // {tone, title, html}
const shedAt = ref(null); // Anzeige-Label des Shed-Buttons

const canStart = computed(() => phase.value === "sketch" && sketchReady.value);
const canShed = computed(
  () => phase.value === "running" && shedAt.value === null,
);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);

/* ===== Canvas ===== */
const gpCanvas = ref(null);
const qCanvas = ref(null);
const chartWrap = ref(null);
const gpH = 230,
  qH = 64;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 46, r: 12, t: 12, b: 22 },
  QPAD = { l: 46, r: 12, t: 6, b: 16 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (t) => PAD.l + (t / T_END) * (W - PAD.l - PAD.r);
const tOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T_END;
const yOf = (g) =>
  PAD.t + (1 - Math.min(g, GP_MAX) / GP_MAX) * (gpH - PAD.t - PAD.b);
const gOf = (y) => (1 - (y - PAD.t) / (gpH - PAD.t - PAD.b)) * GP_MAX;
const yQ = (q) =>
  QPAD.t + (1 - Math.min(q, Q_MAX) / Q_MAX) * (qH - QPAD.t - QPAD.b);

/* Palette aus den CSS-Variablen des Chart-Containers (Light/Dark via CSS). */
function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !gpCanvas.value || !qCanvas.value) return;
  W = wrap.clientWidth;
  // Slidev skaliert die Folie per CSS-Transform — Backing-Store zusätzlich
  // mit dem effektiven Scale multiplizieren, sonst wird der Canvas unscharf.
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [gpCanvas.value, gpH],
    [qCanvas.value, qH],
  ]) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = h + "px";
  }
  drawAll();
}

function grid(ctx, h, pad, yMax, yStepMaj, yLabel) {
  ctx.clearRect(0, 0, W, h);
  ctx.save();
  ctx.strokeStyle = cssVar("--rs-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 2) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
  }
  const fineY = yStepMaj / 4;
  for (let g = 0; g <= yMax; g += fineY) {
    const y = Math.round(pad.t + (1 - g / yMax) * (h - pad.t - pad.b)) + 0.5;
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--rs-grid-m");
  ctx.fillStyle = cssVar("--rs-muted");
  ctx.font = `10px ${MONO}`;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 20) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
    ctx.fillText(t + " s", x - 8, h - pad.b + 13);
  }
  for (let g = 0; g <= yMax; g += yStepMaj) {
    const y = Math.round(pad.t + (1 - g / yMax) * (h - pad.t - pad.b)) + 0.5;
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.fillText(String(g), 6, y + 4);
  }
  ctx.stroke();
  // Achsen-Label oben links IM Plot (links kollidiert es mit dem Top-Tick)
  ctx.fillText(yLabel, pad.l + 8, pad.t + 10);
  ctx.restore();
}
function burstBand(ctx, h, pad, ampShow) {
  ctx.save();
  ctx.fillStyle = cssVar("--rs-burst-fill");
  ctx.fillRect(xOf(B0), pad.t, xOf(B1) - xOf(B0), h - pad.t - pad.b);
  ctx.strokeStyle = cssVar("--rs-burst-edge");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    xOf(B0) + 0.5,
    pad.t + 0.5,
    xOf(B1) - xOf(B0) - 1,
    h - pad.t - pad.b - 1,
  );
  if (ampShow) {
    ctx.fillStyle = cssVar("--rs-burst-edge");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Burst ×" + fmt(amp.value, 2), xOf(B0) + 5, pad.t + 14);
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

function drawGoodput() {
  const c = gpCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(ctx, gpH, PAD, GP_MAX, 20, "Goodput [req/s]");
  burstBand(ctx, gpH, PAD, true);
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yOf(70),
    cssVar("--rs-ref"),
    1,
    [2, 4],
  );
  for (const run of oldRuns)
    plotLine(
      ctx,
      run,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--rs-signal"),
      1.6,
      [],
      0.22,
    );
  if (history)
    plotLine(
      ctx,
      history.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--rs-signal"),
      2.2,
    );
  if (sim)
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--rs-signal"),
      2.2,
    );
  const predPts = sketch.points();
  plotLine(
    ctx,
    predPts,
    (p) => (p.v == null ? null : xOf(p.t)),
    (p) => (p.v == null ? null : yOf(p.v)),
    cssVar("--rs-pencil"),
    2,
    [7, 5],
  );
  if (sim && sim.shedAt < Infinity && sim.t >= sim.shedAt) {
    const x = xOf(sim.shedAt);
    ctx.save();
    ctx.strokeStyle = cssVar("--rs-shed");
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, PAD.t);
    ctx.lineTo(x, gpH - PAD.b);
    ctx.stroke();
    ctx.fillStyle = cssVar("--rs-shed");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Shedding", x + 4, PAD.t + 12);
    ctx.restore();
  }
}
function drawQueue() {
  const c = qCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(ctx, qH, QPAD, Q_MAX, 600, "Queue [req]");
  burstBand(ctx, qH, QPAD, false);
  const col = cssVar("--rs-queue");
  if (history)
    plotLine(
      ctx,
      history.pts,
      (p) => xOf(p.t),
      (p) => yQ(p.q),
      col,
      1.8,
    );
  if (sim) {
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yQ(p.q),
      col,
      1.8,
    );
    const last = sim.pts[sim.pts.length - 1];
    if (last && last.q > Q_MAX) {
      ctx.save();
      ctx.fillStyle = col;
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "↑ q = " + fmt(last.q) + " — wächst unbegrenzt (→ OOM)",
        xOf(45),
        QPAD.t + 12,
      );
      ctx.restore();
    }
  }
}
function drawAll() {
  drawGoodput();
  drawQueue();
}

/* ===== Historie (t < 20 s) ===== */
function makeHistory() {
  history = new Sim(seed, amp.value, R.value);
  history.runTo(B0);
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
  if (phase.value !== "running") drawGoodput();
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
  sim = new Sim(seed, amp.value, R.value);
  sim.runTo(B0);
  history = { pts: sim.pts.slice() };
  sim.pts = [];
  if (reduceMotion) {
    sim.runTo(T_END);
    finishRun();
    drawAll();
    updateReadout();
    return;
  }
  const stepsPerFrame = 5;
  const loop = () => {
    for (let k = 0; k < stepsPerFrame && sim.t < T_END; k++) sim.step();
    drawAll();
    updateReadout();
    if (sim.t < T_END) animId = requestAnimationFrame(loop);
    else finishRun();
  };
  animId = requestAnimationFrame(loop);
}
function triggerShed() {
  if (!canShed.value || !sim || sim.shedAt < Infinity) return;
  sim.shedAt = sim.t;
  shedAt.value = sim.shedAt;
}
function updateReadout() {
  if (!sim || !sim.pts.length) return;
  readout.value = sim.pts[sim.pts.length - 1];
}

/* ===== Auswertung (verbatim) ===== */
const tailMeanRun = (pts, t0 = 90) => {
  const c = pts.filter((x) => x.t >= t0);
  return c.length ? c.reduce((a, x) => a + x.g, 0) / c.length : null;
};
const classify = (g) =>
  g == null ? null : g > 45 ? "recover" : g >= 8 ? "partial" : "collapse";
const LABEL = {
  recover: "Erholung auf Normalniveau",
  partial: "dauerhaft reduzierter Goodput",
  collapse: "Kollaps (Goodput ≈ 0)",
};
function finishRun() {
  phase.value = "done";
  animId = null;
  const realTail = tailMeanRun(sim.pts);
  const predTail = sketch.tailMean(90);
  const rc = classify(realTail),
    pc = classify(predTail);
  const shedUsed = sim.shedAt < Infinity;
  let t, b;
  if (pc == null) {
    t = "Ergebnis: " + LABEL[rc] + ".";
    b =
      'Keine Vorhersage abgegeben. Endzustand (Mittel t ≥ 90 s): <b class="mono">' +
      fmt(realTail) +
      " req/s</b>" +
      (shedUsed ? " — nach deinem Load-Shedding." : ".");
  } else if (pc === rc) {
    t = "Deine Vorhersage stimmt: " + LABEL[rc] + ".";
    b =
      'Vorhergesagt: <b class="mono">' +
      fmt(predTail) +
      ' req/s</b> · gemessen: <b class="mono">' +
      fmt(realTail) +
      " req/s</b> (Mittel t ≥ 90 s)." +
      (shedUsed ? " Load-Shedding war aktiv." : "");
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      'Vorhergesagt: <b class="mono">' +
      fmt(predTail) +
      ' req/s</b> · gemessen: <b class="mono">' +
      fmt(realTail) +
      " req/s</b>. " +
      (rc === "collapse"
        ? "Die Lastspitze ist seit t = 30 s vorbei — der Ausfall <b>erhält sich selbst</b>: Timeouts erzeugen Retries, Retries erzeugen Timeouts."
        : "Das System ist dem Kipp-Punkt entkommen. Ob das Glück oder Struktur war, verrät ein zweiter Lauf mit gleichem Setup und neuem Seed.");
  }
  verdict.value = {
    tone: rc === "collapse" ? "bad" : pc === rc ? "ok" : "warn",
    title: t,
    html: b,
  };
}

/* ===== Experimentieren (⚙) ===== */
function archiveAndRun(newSeed) {
  if (phase.value === "running") return;
  if (sim) oldRuns.push(sim.pts);
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  sim = null;
  shedAt.value = null;
  makeHistory();
  drawAll();
  phase.value = "sketch";
  if (sketchReady.value) startRun();
}
function softResetToSketch() {
  phase.value = "sketch";
  sim = null;
  shedAt.value = null;
  verdict.value = null;
  makeHistory();
}
function resetAll() {
  if (phase.value === "running") return;
  oldRuns = [];
  sketch.clear();
  amp.value = 2.0;
  R.value = 2;
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
  makeHistory();
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
    eyebrow="Metastabile Ausfälle · Predict first"
    title="Der Retry-Sturm"
    :subtitle="`μ = 100 req/s · λ = 70 req/s (ρ = 0,7) · Timeout 1 s · ≤ ${R} Retries — bei t = 20 s trifft ein 10-s-Burst ×${fmt(amp, 2)}. Skizziere den Goodput ab t = 20 s, dann starte.`"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'recover', label: 'Erholung' },
      { key: 'partial', label: 'teilweise' },
      { key: 'collapse', label: 'Kollaps' },
    ]"
    gear-title="Experimentieren"
    @preset="applyPreset"
  >
    <template #presets-extra>
      <button class="rs-btn rs-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="rs-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        class="rs-btn rs-shed"
        :disabled="!canShed"
        title="Verwirft alle Anfragen, die ihre Deadline ohnehin nicht mehr halten können, und begrenzt danach die Annahme."
        @click="triggerShed"
      >
        {{
          shedAt !== null
            ? `Shedding ab t = ${fmt(shedAt, 1)} s`
            : "Load-Shedding auslösen"
        }}
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="rs-btn rs-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="rs-stage">
        <Tabs
          class="rs-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="rs-charts">
          <div class="rs-chartbox">
            <canvas
              ref="gpCanvas"
              aria-label="Goodput über Zeit. Zeichenfläche für die Vorhersage."
              @pointerdown="onGpDown"
              @pointermove="onGpMove"
              @pointerup="onGpUp"
              @pointercancel="onGpUp"
            />
            <div v-if="showSketchNote" class="rs-note">
              <b>✏️ Skizziere hier</b> deine Vermutung für den Goodput ab t = 20
              s — oder wähle oben ein Preset.
            </div>
          </div>
          <div class="rs-chartbox">
            <canvas ref="qCanvas" aria-label="Queue-Tiefe über Zeit" />
          </div>
          <div class="rs-strip">
            <span v-if="readout" class="rs-readouts">
              t <b>{{ fmt(readout.t, 1) }} s</b> · λ
              <b>{{ fmt(readout.lam) }}</b> · λ_eff
              <b :class="{ bad: readout.leff > MU }">{{ fmt(readout.leff) }}</b>
              · p(Timeout)
              <b :class="{ bad: readout.p > 0.5 }"
                >{{ fmt(readout.p * 100) }} %</b
              >
              · Queue <b>{{ fmt(readout.q) }}</b> · Goodput
              <b
                :class="{
                  bad: readout.g < 10,
                  good: readout.g > 55,
                }"
                >{{ fmt(Math.max(0, readout.g)) }}</b
              >
            </span>
            <span class="rs-legend">
              <span><i class="sw pred" /> Vorhersage</span>
              <span><i class="sw real" /> Simulation</span>
              <span><i class="sw old" /> frühere Läufe</span>
              <span><i class="sw q" /> Queue</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="rs-explain">
          <div class="rs-sys" aria-label="Systemdiagramm">
            <span class="node"
              >Clients<span class="lbl"
                >λ = 70 req/s · Timeout 1 s · ≤ {{ R }} Retries</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Queue<span class="lbl">unbegrenzt (FIFO)</span></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Service<span class="lbl">μ = 100 req/s</span></span
            >
          </div>
          <div class="rs-states">
            <span class="state s1">stabil (t &lt; 20 s)</span>
            <span class="state s2">verwundbar (Burst)</span>
            <span
              class="state s3"
              :style="{ opacity: verdict && verdict.tone === 'bad' ? 1 : 0.4 }"
              >metastabiler Ausfall (t &gt; 30 s)</span
            >
          </div>
          <p>
            Sobald die Wartezeit <span class="mono">w = q/μ</span> die Deadline
            von 1 s übersteigt, läuft (fast) jede Anfrage in den Timeout — und
            wird wiederholt. Mit bis zu <span class="mono">{{ R }}</span>
            Retries erzeugt jede Original-Anfrage bis zu
            <span class="mono">{{ R + 1 }}</span> Versuche:
            <span class="mono"
              >λ_eff ≈ 70 × {{ R + 1 }} = {{ fmt(LAMBDA0 * (R + 1)) }} req/s
              &gt; μ = 100 req/s</span
            >. Die Überlast <b>erhält sich selbst</b> — auch nachdem die
            Lastspitze längst vorbei ist. Der Server arbeitet mit 100 %
            Auslastung, aber jede fertige Antwort kommt zu spät: Goodput ≈ 0
            („busy doing useless work"). Das ist der metastabile Ausfallzustand
            nach Bronson et&nbsp;al. (HotOS ’21).
          </p>
          <p>
            Kritische Schwelle: Selbsterhaltung ab
            <span class="mono">R + 1 &gt; μ/λ = 1,43</span>, also bereits ab
            <span class="mono">R = 1</span>. Ohne Retries (<span class="mono"
              >R = 0</span
            >) bricht der Goodput während des Backlogs genauso ein — aber die
            Queue leert sich mit <span class="mono">μ − λ = 30 req/s</span> von
            selbst. Der Unterschied ist nicht der Einbruch, sondern die
            <b>Selbstheilung</b>.
          </p>
          <p>
            Und der Zufall: Im Fluid-Mittel kippt dieses System erst ab etwa
            <span class="mono">×1,6</span> Burst-Amplitude. Stochastisch kippt
            es je nach Rauschen schon ab etwa <span class="mono">×1,4</span> —
            mal ja, mal nein. <b>Der Mittelwert verschweigt die Gefahr.</b>
            Probiere es im ⚙-Labor aus.
          </p>
          <p class="rs-foot">
            <b>Bewusste Vereinfachungen:</b> Timeout-Anteil als glatte Funktion
            der Wartezeit; Retries ohne Backoff-Verzögerung; unbegrenzte
            FIFO-Queue; Poisson-Ankünfte/-Bedienung; Goodput exponentiell
            geglättet (τ ≈ 0,8 s). Bistabilität und Kipp-Schwellen numerisch
            gegen ein Fluid-Modell verifiziert. Load-Shedding: Backlog jenseits
            <span class="mono">μ·D</span> verwerfen + Annahmebegrenzung.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="rs-gear">
        <QueueSlider
          :model-value="amp"
          label="Burst-Amplitude"
          :min="1.0"
          :max="3.0"
          :step="0.05"
          unit="×"
          @update:model-value="(v) => (amp = v)"
        />
        <QueueSlider
          :model-value="R"
          label="Max. Retries R"
          :min="0"
          :max="3"
          :step="1"
          unit=""
          @update:model-value="(v) => (R = v)"
        />
        <p class="rs-gear-hint">
          Finde die Kipp-Schwelle — nahe der Schwelle entscheidet der Seed.
          Frühere Läufe bleiben blass sichtbar.
        </p>
        <div class="rs-gear-btns">
          <button
            class="rs-btn rs-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="rs-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="rs-btn"
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
        class="rs-banner rs-warnb"
      >
        Zeichne die Kurve bis (fast) zum rechten Rand — die Vorhersage soll den
        ganzen Zeitraum abdecken.
      </div>
      <div v-else-if="verdict" class="rs-banner" :class="`rs-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette der Originale (Light verbatim), Dark-Variante daneben.
   Der Canvas-Code liest diese Variablen via getComputedStyle(chartWrap). */
.rs-stage,
.rs-charts,
.rs-explain,
.rs-gear {
  --rs-paper: #e9eeea;
  --rs-panel: #fcfdfc;
  --rs-ink: #16282c;
  --rs-muted: #5c6b6a;
  --rs-grid-f: #e2eae4;
  --rs-grid-m: #c6d3cb;
  --rs-pencil: #6a7480;
  --rs-signal: #0b7285;
  --rs-queue: #a97c10;
  --rs-burst-fill: rgba(226, 163, 60, 0.16);
  --rs-burst-edge: #c8912f;
  --rs-danger: #af3e1b;
  --rs-ok: #3d7a46;
  --rs-shed: #7048a8;
  --rs-ref: #9fb4ac;
}
:global(html.dark .rs-stage),
:global(html.dark .rs-charts),
:global(html.dark .rs-explain),
:global(html.dark .rs-gear) {
  --rs-paper: #101a1c;
  --rs-panel: #0d1517;
  --rs-ink: #dce8e6;
  --rs-muted: #8fa3a0;
  --rs-grid-f: #1b2a2c;
  --rs-grid-m: #2d4246;
  --rs-pencil: #93a1ad;
  --rs-signal: #37b6cf;
  --rs-queue: #d9a62e;
  --rs-burst-fill: rgba(226, 163, 60, 0.1);
  --rs-burst-edge: #b98a2e;
  --rs-danger: #e0684a;
  --rs-ok: #69b877;
  --rs-shed: #a884e0;
  --rs-ref: #4e6660;
}

.rs-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.rs-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rs-chartbox {
  position: relative;
  background: var(--rs-panel);
  border: 1px solid var(--rs-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.rs-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.rs-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--rs-panel) 88%, transparent);
  border: 1px dashed var(--rs-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--rs-ink);
  pointer-events: none;
  text-align: center;
}
.rs-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.rs-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--rs-muted);
}
.rs-readouts b {
  color: var(--rs-ink);
  font-weight: 600;
}
.rs-readouts b.bad {
  color: var(--rs-danger);
}
.rs-readouts b.good {
  color: var(--rs-ok);
}
.rs-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--rs-muted);
}
.rs-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.rs-legend .sw.pred {
  background: var(--rs-pencil);
}
.rs-legend .sw.real {
  background: var(--rs-signal);
}
.rs-legend .sw.old {
  background: var(--rs-signal);
  opacity: 0.3;
}
.rs-legend .sw.q {
  background: var(--rs-queue);
}

/* Buttons in Preset-Zeile & ⚙ */
.rs-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--rs-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--rs-grid-m, #c6d3cb);
}
.rs-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.rs-primary {
  border-color: var(--rs-ok, #3d7a46);
  font-weight: 600;
}
.rs-shed {
  border-color: var(--rs-shed, #7048a8);
}
.rs-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.rs-explain {
  max-height: 380px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--rs-ink);
  padding-right: 6px;
}
.rs-explain p {
  margin: 0 0 8px;
}
.rs-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.rs-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.rs-sys .node {
  border: 1px solid var(--rs-grid-m);
  background: var(--rs-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.rs-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--rs-muted);
  font-family: var(--slidev-code-font-family);
}
.rs-sys .arrow {
  color: var(--rs-muted);
}
.rs-states {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.rs-states .state {
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid var(--rs-grid-m);
}
.rs-states .s1 {
  border-color: var(--rs-ok);
  color: var(--rs-ok);
}
.rs-states .s2 {
  border-color: var(--rs-burst-edge);
  color: var(--rs-burst-edge);
}
.rs-states .s3 {
  border-color: var(--rs-danger);
  color: var(--rs-danger);
}
.rs-foot {
  font-size: 9px;
  color: var(--rs-muted);
}

/* ⚙-Panel */
.rs-gear {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}
.rs-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.rs-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner */
.rs-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.rs-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.rs-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark .rs-warnb) {
  color: #d9a62e;
}
.rs-ok {
  border-color: #3d7a46;
}
.rs-warn {
  border-color: #c8912f;
}
.rs-bad {
  border-color: #af3e1b;
}
</style>
