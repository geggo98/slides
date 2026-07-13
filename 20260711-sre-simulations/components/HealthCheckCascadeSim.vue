<script setup>
/**
 * HealthCheckCascadeSim.vue — „Die Health-Check-Spirale" (Predict first).
 * Gerüst wie RetryStormSim (Skizze, Presets, ⚙-Labor, Verdict); Modellkern
 * in lib/cascadeModel.js: N Instanzen hinter einem LB, Health-Checks mit
 * Envoy-artigem Auswurf-Backoff — der Load Balancer als Verstärker.
 * Skizziert wird die Zahl der Instanzen in Rotation (0…10).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { fmtDe as fmt, randomSeed } from "./lib/rng.js";
import { usePredictSketch } from "./lib/usePredictSketch";
import {
  B0,
  CascadeSim,
  D_SLOW,
  E_BASE,
  H_AX,
  MU,
  RHO,
  T_END,
  T_HC,
} from "./lib/cascadeModel.js";

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const N = ref(8);
const m = ref(3);
const F = ref(2);
const P = ref(1);
const phase = ref("sketch"); // sketch | running | done
let sim = null;
let history = null;
let oldRuns = [];
let animId = null;

const sketch = usePredictSketch({
  t0: B0,
  tEnd: T_END,
  step: 0.5,
  vMax: H_AX,
});
const {
  ready: sketchReady,
  covWarn: sketchCovWarn,
  hasInk: sketchHasInk,
  skipped: sketchSkipped,
} = sketch;

const activeTab = ref("sim");
const readout = shallowRef(null); // letzter Sim-Punkt
const instView = shallowRef([]); // Instanzen-Reihe
const verdict = shallowRef(null); // {tone, title, html}
const panicAt = ref(null);

const lambdaNow = computed(() => RHO * N.value * MU);
const canStart = computed(() => phase.value === "sketch" && sketchReady.value);
const canPanic = computed(
  () => phase.value === "running" && panicAt.value === null,
);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);
const subtitle = computed(
  () =>
    `${N.value} Instanzen à μ = ${MU} req/s · λ = ${fmt(lambdaNow.value)} req/s (ρ = 0,7) · Probe alle ${fmt(P.value, 1)} s, Timeout 0,4 s, ${F.value} Fails → raus (Auswurf Nr. k hält k·${E_BASE} s) — bei t = 20 s werden ${m.value} Instanzen 15 s lang langsam (×0,4). Skizziere die Zahl der Instanzen in Rotation ab t = 20 s.`,
);

/* Preset-Vorhersagen — lesen N/m zur Klickzeit */
const PRESET_FNS = {
  dip: (t) => {
    const n = N.value;
    if (t < 22) return n;
    if (t < 38) return n - m.value;
    return n;
  },
  flap: (t) => {
    const n = N.value;
    if (t < 24) return n;
    return Math.max(
      1,
      0.5 * n + 0.22 * n * Math.sin((2 * Math.PI * (t - 24)) / 15),
    );
  },
  cascade: (t) => {
    const n = N.value;
    if (t < 22) return n;
    return Math.max(0.7, n - (t - 22) * 0.9);
  },
};

/* ===== Canvas ===== */
const hCanvas = ref(null);
const gCanvas = ref(null);
const chartWrap = ref(null);
const hH = 162,
  gH = 46;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 46, r: 12, t: 10, b: 20 },
  GPAD = { l: 46, r: 12, t: 5, b: 14 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (t) => PAD.l + (t / T_END) * (W - PAD.l - PAD.r);
const tOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T_END;
const yOf = (h) =>
  PAD.t + (1 - Math.min(h, H_AX) / H_AX) * (hH - PAD.t - PAD.b);
const hOf = (y) => (1 - (y - PAD.t) / (hH - PAD.t - PAD.b)) * H_AX;
const yG = (g) =>
  GPAD.t + (1 - Math.min(g, 100) / 100) * (gH - GPAD.t - GPAD.b);

function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !hCanvas.value || !gCanvas.value) return;
  W = wrap.clientWidth;
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [hCanvas.value, hH],
    [gCanvas.value, gH],
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
  ctx.strokeStyle = cssVar("--hc-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 2) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
  }
  const fineY = yStepMaj / 2;
  for (let g = 0; g <= yMax; g += fineY) {
    const y = Math.round(pad.t + (1 - g / yMax) * (h - pad.t - pad.b)) + 0.5;
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--hc-grid-m");
  ctx.fillStyle = cssVar("--hc-muted");
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
  ctx.fillText(yLabel, pad.l + 8, pad.t + 10);
  ctx.restore();
}
function disturbBand(ctx, h, pad, labelShow) {
  ctx.save();
  ctx.fillStyle = cssVar("--hc-burst-fill");
  ctx.fillRect(xOf(B0), pad.t, xOf(B0 + D_SLOW) - xOf(B0), h - pad.t - pad.b);
  ctx.strokeStyle = cssVar("--hc-burst-edge");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    xOf(B0) + 0.5,
    pad.t + 0.5,
    xOf(B0 + D_SLOW) - xOf(B0) - 1,
    h - pad.t - pad.b - 1,
  );
  if (labelShow) {
    ctx.fillStyle = cssVar("--hc-burst-edge");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText(`Störung: ${m.value} Instanzen ×0,4`, xOf(B0) + 5, pad.t + 14);
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

function drawMain() {
  const c = hCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(ctx, hH, PAD, H_AX, 2, "Instanzen in Rotation");
  disturbBand(ctx, hH, PAD, true);
  // Referenz: N (alle gesund) und Kipp-Kante λ/μ = 0,7·N
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yOf(N.value),
    cssVar("--hc-ref"),
    1,
    [2, 4],
  );
  const tip = RHO * N.value;
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yOf(tip),
    cssVar("--hc-danger"),
    1.2,
    [6, 4],
    0.8,
  );
  ctx.save();
  ctx.fillStyle = cssVar("--hc-danger");
  ctx.font = `600 9px ${MONO}`;
  ctx.fillText(
    `Kipp-Kante λ/μ = ${fmt(tip, 1)} — darunter ist der Rest überlastet`,
    xOf(46),
    yOf(tip) - 4,
  );
  ctx.restore();
  for (const run of oldRuns)
    plotLine(
      ctx,
      run,
      (p) => xOf(p.t),
      (p) => yOf(p.h),
      cssVar("--hc-signal"),
      1.6,
      [],
      0.22,
    );
  if (history)
    plotLine(
      ctx,
      history.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.h),
      cssVar("--hc-signal"),
      2.2,
    );
  if (sim)
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.h),
      cssVar("--hc-signal"),
      2.2,
    );
  const predPts = sketch.points();
  plotLine(
    ctx,
    predPts,
    (p) => (p.v == null ? null : xOf(p.t)),
    (p) => (p.v == null ? null : yOf(p.v)),
    cssVar("--hc-pencil"),
    2,
    [7, 5],
  );
  // Panic-Mode: Marker + aktive Segmente als Band am oberen Rand
  if (sim && sim.panicAt < Infinity && sim.t >= sim.panicAt) {
    const x = xOf(sim.panicAt);
    ctx.save();
    ctx.strokeStyle = cssVar("--hc-panic");
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, PAD.t);
    ctx.lineTo(x, hH - PAD.b);
    ctx.stroke();
    ctx.fillStyle = cssVar("--hc-panic");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Panic-Mode", x + 4, PAD.t + 12);
    ctx.globalAlpha = 0.55;
    let segStart = null;
    for (const p of sim.pts) {
      if (p.panic && segStart == null) segStart = p.t;
      if (!p.panic && segStart != null) {
        ctx.fillRect(xOf(segStart), PAD.t, xOf(p.t) - xOf(segStart), 4);
        segStart = null;
      }
    }
    if (segStart != null)
      ctx.fillRect(xOf(segStart), PAD.t, xOf(sim.t) - xOf(segStart), 4);
    ctx.restore();
  }
}
function drawGoodput() {
  const c = gCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(ctx, gH, GPAD, 100, 50, "Goodput [% von λ]");
  disturbBand(ctx, gH, GPAD, false);
  const col = cssVar("--hc-queue");
  if (history)
    plotLine(
      ctx,
      history.pts,
      (p) => xOf(p.t),
      (p) => yG(p.g),
      col,
      1.8,
    );
  if (sim)
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yG(p.g),
      col,
      1.8,
    );
}
function drawAll() {
  drawMain();
  drawGoodput();
}

/* ===== Historie (t < 20 s) ===== */
function makeHistory() {
  history = new CascadeSim(seed, N.value, m.value, F.value, P.value);
  history.runTo(B0);
}

/* ===== Skizzieren ===== */
function evToTV(ev) {
  const c = hCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * hH;
  return { t: tOf(x), v: hOf(y) };
}
function onDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  hCanvas.value.setPointerCapture(ev.pointerId);
  onMove(ev);
}
function onMove(ev) {
  if (!sketch.isDrawing()) return;
  const { t, v } = evToTV(ev);
  sketch.ink(t, v);
}
function onUp() {
  sketch.strokeEnd();
}
watch(sketch.version, () => {
  if (phase.value !== "running") drawMain();
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
  sim = new CascadeSim(seed, N.value, m.value, F.value, P.value);
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
function triggerPanic() {
  if (!canPanic.value || !sim || sim.panicAt < Infinity) return;
  sim.panicAt = sim.t;
  panicAt.value = sim.panicAt;
}
function updateReadout() {
  if (!sim || !sim.pts.length) return;
  readout.value = sim.pts[sim.pts.length - 1];
  const view = [];
  for (let i = 0; i < sim.N; i++) {
    const cap = sim.capOf(i);
    const w = sim.q[i] / cap;
    view.push({
      i,
      state: sim.inRot[i] ? (w > T_HC ? "warn" : "ok") : "out",
      slow: i < sim.m && sim.disturbed(),
      fill: Math.min(1, sim.q[i] / 60),
      ej: sim.ejCount[i],
    });
  }
  instView.value = view;
}

/* ===== Auswertung ===== */
const tailMeanRun = (pts, t0 = 90) => {
  const c = pts.filter((x) => x.t >= t0);
  return c.length ? c.reduce((a, x) => a + x.h, 0) / c.length : null;
};
function classify(h) {
  if (h == null) return null;
  const n = N.value;
  return h >= 0.85 * n ? "dip" : h >= 0.35 * n ? "flap" : "cascade";
}
const LABEL = {
  dip: "kurzer Dip mit Erholung",
  flap: "dauerhaftes Flattern (rotierende Überlast)",
  cascade: "Kaskade — die Rotation bricht zusammen",
};
function chipRow() {
  const tailG = sim.pts.filter((x) => x.t >= 90);
  const g = tailG.length
    ? tailG.reduce((a, x) => a + x.g, 0) / tailG.length
    : 0;
  const parts = [
    `Minimum in Rotation: <b class="mono">${sim.minH}/${sim.N}</b>`,
    `Goodput &lt; 50 %: <b class="mono">${fmt(sim.lowSec)} s</b>`,
    `verloren: <b class="mono">${fmt(Math.round(sim.lost))} Requests</b>`,
  ];
  if (sim.panicAt < Infinity)
    parts.push(
      `Panic-Mode ab <b class="mono">t = ${fmt(sim.panicAt, 1)} s</b> → Goodput-Endwert <b class="mono">${fmt(g)} %</b>`,
    );
  return parts.join(" · ");
}
function finishRun() {
  phase.value = "done";
  animId = null;
  const realTail = tailMeanRun(sim.pts);
  const predTail = sketch.tailMean(90);
  const rc = classify(realTail),
    pc = classify(predTail == null ? null : Math.min(predTail, N.value));
  let t, b;
  if (pc == null) {
    t = "Ergebnis: " + LABEL[rc] + ".";
    b = `Keine Vorhersage abgegeben. In Rotation (Mittel t ≥ 90 s): <b class="mono">${fmt(realTail, 1)}/${sim.N}</b>.`;
  } else if (pc === rc) {
    t = "Deine Vorhersage stimmt: " + LABEL[rc] + ".";
    b = `Vorhergesagt: <b class="mono">${fmt(predTail, 1)}</b> · gemessen: <b class="mono">${fmt(realTail, 1)}</b> Instanzen in Rotation (Mittel t ≥ 90 s).`;
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      `Vorhergesagt: <b class="mono">${fmt(predTail, 1)}</b> · gemessen: <b class="mono">${fmt(realTail, 1)}</b> Instanzen. ` +
      (rc === "cascade"
        ? "Die Störung ist seit t = 35 s vorbei — die Kaskade <b>erhält sich selbst</b>: Wer in der Rotation ist, ist überlastet; wer zurückkommt, fliegt sofort wieder raus (und bleibt mit jedem Auswurf länger draußen)."
        : "Das System ist der Spirale entkommen. Ob das Glück oder Struktur war: gleiches Setup, neuer Seed — ⚙.");
  }
  verdict.value = {
    tone: rc === "cascade" ? "bad" : pc === rc ? "ok" : "warn",
    title: t,
    html: b + "<br>" + chipRow(),
  };
}

/* ===== Experimentieren (⚙) ===== */
function archiveAndRun(newSeed) {
  if (phase.value === "running") return;
  if (sim) oldRuns.push(sim.pts);
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  sim = null;
  panicAt.value = null;
  makeHistory();
  drawAll();
  phase.value = "sketch";
  if (sketchReady.value) startRun();
}
function softResetToSketch() {
  phase.value = "sketch";
  sim = null;
  panicAt.value = null;
  verdict.value = null;
  makeHistory();
}
function resetAll() {
  if (phase.value === "running") return;
  oldRuns = [];
  sketch.clear();
  N.value = 8;
  m.value = 3;
  F.value = 2;
  P.value = 1;
  seed = randomSeed();
  readout.value = null;
  instView.value = [];
  softResetToSketch();
  drawAll();
}
watch([N, m, F, P], () => {
  if (phase.value === "running") return;
  if (m.value > N.value - 1) m.value = N.value - 1;
  makeHistory();
  drawAll();
});

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
watch(isSlideActive, (active) => {
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
    eyebrow="Kaskadierender Ausfall · Predict first"
    title="Die Health-Check-Spirale"
    :subtitle="subtitle"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'dip', label: 'kurzer Dip' },
      { key: 'flap', label: 'Dauer-Flattern' },
      { key: 'cascade', label: 'Kaskade' },
    ]"
    gear-title="Experimentieren"
    @preset="applyPreset"
  >
    <template #presets-extra>
      <button class="hc-btn hc-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="hc-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        class="hc-btn hc-panicbtn"
        :disabled="!canPanic"
        title="Envoy-Panic-Mode (Fail-Open): Sobald weniger als 50 % der Instanzen als gesund gelten, ignoriert der LB den Health-Status und routet an ALLE — die Lastumverteilung (der Verstärker) ist durchbrochen."
        @click="triggerPanic"
      >
        {{
          panicAt !== null
            ? `Panic ab t = ${fmt(panicAt, 1)} s`
            : "Panic-Mode (Fail-Open)"
        }}
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="hc-btn hc-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="hc-stage">
        <Tabs
          class="hc-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="hc-charts">
          <div class="hc-chartbox">
            <canvas
              ref="hCanvas"
              aria-label="Instanzen in Rotation über Zeit. Zeichenfläche für die Vorhersage."
              @pointerdown="onDown"
              @pointermove="onMove"
              @pointerup="onUp"
              @pointercancel="onUp"
            />
            <div v-if="showSketchNote" class="hc-note">
              <b>✏️ Skizziere hier</b>, wie viele Instanzen ab t = 20 s in der
              Rotation bleiben — oder wähle oben ein Preset.
            </div>
          </div>
          <div class="hc-chartbox">
            <canvas ref="gCanvas" aria-label="Goodput über Zeit" />
          </div>
          <div class="hc-instrow" aria-label="Instanzen-Status">
            <span
              v-for="v in instView"
              :key="v.i"
              class="hc-inst"
              :class="`hc-inst-${v.state}`"
            >
              <i class="hc-inst-fill" :style="{ height: v.fill * 100 + '%' }" />
              <span class="hc-inst-label"
                >{{ v.slow ? "🐌" : "" }}{{ v.ej > 1 ? "×" + v.ej : "" }}</span
              >
            </span>
            <span v-if="!instView.length" class="hc-instrow-hint"
              >Instanzen-Status erscheint beim Lauf — Füllstand = Queue, Rand =
              Rotation (grün rein · amber Probe-Fail · rot raus)</span
            >
          </div>
          <div class="hc-strip">
            <span v-if="readout" class="hc-readouts">
              t <b>{{ fmt(readout.t, 1) }} s</b> · in Rotation
              <b :class="{ bad: readout.h < 0.7 * N }"
                >{{ readout.h }}/{{ N }}</b
              >
              · Goodput
              <b :class="{ bad: readout.g < 50, good: readout.g > 85 }"
                >{{ fmt(Math.min(100, readout.g)) }} %</b
              >
              · verloren <b>{{ fmt(Math.round(sim ? sim.lost : 0)) }}</b>
            </span>
            <span class="hc-legend">
              <span><i class="sw pred" /> Vorhersage</span>
              <span><i class="sw real" /> in Rotation</span>
              <span><i class="sw old" /> frühere Läufe</span>
              <span><i class="sw q" /> Goodput</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="hc-explain">
          <div class="hc-sys" aria-label="Systemdiagramm">
            <span class="node"
              >Clients<span class="lbl"
                >λ = {{ fmt(lambdaNow) }} req/s · Deadline 1 s</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Load Balancer<span class="lbl"
                >Probe {{ fmt(P, 1) }} s · Timeout 0,4 s · {{ F }} Fails → raus
                (k·{{ E_BASE }} s)</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >{{ N }} × Instanz<span class="lbl">μ = 100 req/s</span></span
            >
          </div>
          <p>
            Der Auswurf verteilt um: nach k Auswürfen trägt jeder Überlebende
            <span class="mono">λ/(N−k)</span> — bei λ = 560, N = 8: k=1 →
            <span class="mono">80</span>, k=2 →
            <span class="mono">93</span> (die Kante, der Seed entscheidet), k=3
            → <span class="mono">112 &gt; μ = 100</span>. Und der Auswurf
            <b>beschleunigt sich</b>: je größer die Überlast δ, desto schneller
            überschreitet die Wartezeit den Probe-Timeout (<span class="mono"
              >T ≈ 40/δ + F·P</span
            >).
          </p>
          <p>
            <b>Warum sie sich selbst erhält:</b> Wer zurückkommt, bekommt sofort
            wieder <span class="mono">λ/(N−k)</span> und fliegt erneut — und
            Auswurf Nr. k hält
            <span class="mono">k · {{ E_BASE }} s</span> (Envoy-Backoff:
            <span class="mono">base_ejection_time × ejection count</span>). Mit
            jeder Runde ist mehr Kapazität geparkt, obwohl die Störung seit t =
            35 s vorbei ist. Der Health-Check misst genau die Latenz, die seine
            eigenen Auswürfe verursachen — derselbe Kreis wie beim Retry-Sturm,
            eine Ebene höher.
          </p>
          <p>
            <b>Gegenmittel:</b> <b>Panic-Mode / Fail-Open</b> (Envoy: unter 50 %
            healthy an alle routen — Knopf oben, durchbricht den Verstärker
            sofort), <b>Mindest-Quorum</b> (<span class="mono"
              >max_ejection_percent</span
            >: nie mehr als X % auswerfen) und <b>langsamere Auswurf-Regeln</b>:
            F·P ≳ Störungsdauer (⚙: F = 5, P = 3) — dann übersteht die Rotation
            die Störung, und 15 s Langsamkeit kosten weniger als eine Kaskade.
            <b>Besser kurz langsam als kaskadiert.</b>
          </p>
          <p class="hc-foot">
            <b>Bewusste Vereinfachungen:</b> LB verteilt gleichmäßig (keine
            Sessions); Probe misst die momentane Wartezeit deterministisch;
            keine Client-Retries (die kämen on top); Poisson-Ankünfte und
            -Bedienung; Goodput über die Client-Deadline (Sigmoid) bewertet und
            exponentiell geglättet (τ ≈ 0,8 s); Rückkehr erst nach Ablauf der
            Auswurfzeit und mit leerer Queue.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="hc-gear">
        <QueueSlider
          :model-value="m"
          label="Störung trifft m Instanzen"
          :min="1"
          :max="4"
          :step="1"
          unit=""
          @update:model-value="(v) => (m = v)"
        />
        <QueueSlider
          :model-value="F"
          label="Auswurf nach F Fails"
          :min="1"
          :max="5"
          :step="1"
          unit=""
          @update:model-value="(v) => (F = v)"
        />
        <QueueSlider
          :model-value="P"
          label="Probe-Intervall P"
          :min="0.5"
          :max="3"
          :step="0.5"
          unit=" s"
          @update:model-value="(v) => (P = v)"
        />
        <QueueSlider
          :model-value="N"
          label="Instanzen N"
          :min="4"
          :max="10"
          :step="1"
          unit=""
          @update:model-value="(v) => (N = v)"
        />
        <p class="hc-gear-hint">
          Finde die Kipp-Kante: bei m = 2 entscheidet der Seed. Langsamere
          Auswürfe (F·P ≳ 15 s) retten das System — besser kurz langsam als
          kaskadiert.
        </p>
        <div class="hc-gear-btns">
          <button
            class="hc-btn hc-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="hc-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="hc-btn"
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
        class="hc-banner hc-warnb"
      >
        Zeichne die Kurve bis (fast) zum rechten Rand — die Vorhersage soll den
        ganzen Zeitraum abdecken.
      </div>
      <div v-else-if="verdict" class="hc-banner" :class="`hc-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette wie RetryStormSim (Canvas liest via getComputedStyle). */
.hc-stage,
.hc-charts,
.hc-explain {
  --hc-paper: #e9eeea;
  --hc-panel: #fcfdfc;
  --hc-ink: #16282c;
  --hc-muted: #5c6b6a;
  --hc-grid-f: #e2eae4;
  --hc-grid-m: #c6d3cb;
  --hc-pencil: #6a7480;
  --hc-signal: #0b7285;
  --hc-queue: #a97c10;
  --hc-burst-fill: rgba(226, 163, 60, 0.16);
  --hc-burst-edge: #c8912f;
  --hc-danger: #af3e1b;
  --hc-ok: #3d7a46;
  --hc-panic: #7048a8;
  --hc-ref: #9fb4ac;
}
:global(html.dark .hc-stage),
:global(html.dark .hc-charts),
:global(html.dark .hc-explain) {
  --hc-paper: #101a1c;
  --hc-panel: #0d1517;
  --hc-ink: #dce8e6;
  --hc-muted: #8fa3a0;
  --hc-grid-f: #1b2a2c;
  --hc-grid-m: #2d4246;
  --hc-pencil: #93a1ad;
  --hc-signal: #37b6cf;
  --hc-queue: #d9a62e;
  --hc-burst-fill: rgba(226, 163, 60, 0.1);
  --hc-burst-edge: #b98a2e;
  --hc-danger: #e0684a;
  --hc-ok: #69b877;
  --hc-panic: #a884e0;
  --hc-ref: #4e6660;
}

.hc-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.hc-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hc-chartbox {
  position: relative;
  background: var(--hc-panel);
  border: 1px solid var(--hc-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.hc-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.hc-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--hc-panel) 88%, transparent);
  border: 1px dashed var(--hc-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--hc-ink);
  pointer-events: none;
  text-align: center;
}

/* Instanzen-Reihe */
.hc-instrow {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 22px;
}
.hc-inst {
  position: relative;
  width: 28px;
  height: 20px;
  border: 2px solid var(--hc-ok);
  border-radius: 5px;
  background: var(--hc-panel);
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.hc-inst-warn {
  border-color: var(--hc-burst-edge);
}
.hc-inst-out {
  border-color: var(--hc-danger);
  opacity: 0.55;
}
.hc-inst-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--hc-queue) 45%, transparent);
  pointer-events: none;
}
.hc-inst-label {
  position: relative;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  color: var(--hc-ink);
  line-height: 1;
}
.hc-instrow-hint {
  font-size: 9px;
  color: var(--hc-muted);
}

.hc-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.hc-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--hc-muted);
}
.hc-readouts b {
  color: var(--hc-ink);
  font-weight: 600;
}
.hc-readouts b.bad {
  color: var(--hc-danger);
}
.hc-readouts b.good {
  color: var(--hc-ok);
}
.hc-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--hc-muted);
}
.hc-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.hc-legend .sw.pred {
  background: var(--hc-pencil);
}
.hc-legend .sw.real {
  background: var(--hc-signal);
}
.hc-legend .sw.old {
  background: var(--hc-signal);
  opacity: 0.3;
}
.hc-legend .sw.q {
  background: var(--hc-queue);
}

/* Buttons */
.hc-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--hc-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--hc-grid-m, #c6d3cb);
}
.hc-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.hc-primary {
  border-color: var(--hc-ok, #3d7a46);
  font-weight: 600;
}
.hc-panicbtn {
  border-color: var(--hc-panic, #7048a8);
}
.hc-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.hc-explain {
  max-height: 380px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--hc-ink);
  padding-right: 6px;
}
.hc-explain p {
  margin: 0 0 8px;
}
.hc-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.hc-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.hc-sys .node {
  border: 1px solid var(--hc-grid-m);
  background: var(--hc-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.hc-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--hc-muted);
  font-family: var(--slidev-code-font-family);
}
.hc-sys .arrow {
  color: var(--hc-muted);
}
.hc-foot {
  font-size: 9px;
  color: var(--hc-muted);
}

/* ⚙-Panel */
.hc-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 280px;
}
.hc-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.hc-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner */
.hc-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.hc-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.hc-banner > b {
  margin-right: 5px;
}
.hc-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark .hc-warnb) {
  color: #d9a62e;
}
.hc-ok {
  border-color: #3d7a46;
}
.hc-warn {
  border-color: #c8912f;
}
.hc-bad {
  border-color: #af3e1b;
}
</style>
