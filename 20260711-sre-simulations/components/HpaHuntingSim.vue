<script setup>
/**
 * HpaHuntingSim.vue — „Der Autoscaler, der es gut meint" (Predict first),
 * portiert aus hpa-hunting-predict-first.html. Modell, Preset-Kurven,
 * Verdict-Logik und Canvas-Zeichencode verbatim übernommen; DOM-Plumbing →
 * Vue-Refs, Skizze → usePredictSketch, Labor-Slider hinter dem ⚙ der
 * SimShell, Erklärung/Modell als zweiter Tab (v-show, damit die Canvases
 * gemountet bleiben).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { fmtDe as fmt, mulberry32, randomSeed } from "./lib/rng.js";
import { usePredictSketch } from "./lib/usePredictSketch";

/* ===== Modell (identisch zum verifizierten Original) ===== */
const C = 100,
  TARGET = 0.6,
  T_END = 1200,
  DT = 1,
  STEP_T = 120,
  L0 = 400,
  L1 = 900,
  SYNC = 15,
  NMIN = 3,
  NMAX = 30,
  TOL = 0.1;
const N_AX = 32,
  IDEAL0 = L0 / (C * TARGET),
  IDEAL1 = L1 / (C * TARGET);
const P_STEP = 5;
function gauss(r) {
  let u = 0,
    v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const mmss = (s) =>
  Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

class Sim {
  constructor(seed, tStart, tau, stab) {
    this.rnd = mulberry32(seed);
    this.tStart = tStart;
    this.tau = tau;
    this.stab = stab;
    this.t = 0;
    this.nReady = 7;
    this.starting = [];
    this.uHat = L0 / (7 * C);
    this.recs = [];
    this.lastDesired = 7;
    this.pts = []; // {t,n,nr,st,u,uh,rec}
  }
  step() {
    const t = this.t;
    this.starting = this.starting.filter((rt) => {
      if (rt <= t) {
        this.nReady++;
        return false;
      }
      return true;
    });
    const L = (t < STEP_T ? L0 : L1) * (1 + 0.03 * gauss(this.rnd));
    const u = Math.min(1, L / (this.nReady * C));
    this.uHat += (DT / this.tau) * (u - this.uHat);
    if (t % SYNC === 0) {
      const nSpec = this.nReady + this.starting.length;
      const ratio = this.uHat / TARGET;
      let desired = nSpec;
      if (Math.abs(ratio - 1) > TOL)
        desired = Math.max(NMIN, Math.min(NMAX, Math.ceil(nSpec * ratio)));
      this.lastDesired = desired;
      this.recs.push({ t, d: desired });
      this.recs = this.recs.filter((x) => x.t > t - this.stab);
      let goal = desired;
      if (desired < nSpec && this.stab > 0)
        goal = Math.min(nSpec, Math.max(...this.recs.map((x) => x.d)));
      if (goal > nSpec) {
        for (let k = 0; k < goal - nSpec; k++)
          this.starting.push(t + this.tStart);
      } else if (goal < nSpec) {
        let rm = nSpec - goal;
        while (rm > 0 && this.starting.length) {
          this.starting.pop();
          rm--;
        }
        this.nReady = Math.max(NMIN, this.nReady - rm);
      }
    }
    this.t += DT;
    this.pts.push({
      t: this.t,
      n: this.nReady + this.starting.length,
      nr: this.nReady,
      st: this.starting.length,
      u,
      uh: this.uHat,
      rec: this.lastDesired,
    });
  }
  runTo(t) {
    while (this.t < t - 1e-9) this.step();
  }
}

/* Preset-Vorhersagen (verbatim) */
const PRESET_FNS = {
  smooth: (t) => (t < STEP_T ? 7 : Math.min(15, 7 + (t - STEP_T) / 30)),
  overshoot: (t) =>
    t < STEP_T
      ? 7
      : t < STEP_T + 180
        ? 7 + (t - STEP_T) / 12
        : Math.max(15, 22 - (t - STEP_T - 180) / 40),
  hunting: (t) => {
    if (t < STEP_T) return 7;
    const ph = (t - STEP_T) / 60;
    return Math.max(
      3,
      Math.min(30, 15 + 13 * Math.exp(-ph / 14) * Math.sin(ph / 1.5)),
    );
  },
};

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const TS = ref(60);
const TAU = ref(60);
const STAB = ref(false);
const phase = ref("sketch"); // sketch | running | done
let sim = null;
let oldRuns = [];
let animId = null;

const sketch = usePredictSketch({
  t0: 0,
  tEnd: T_END,
  step: P_STEP,
  vMax: N_AX,
  minLastT: 1100,
});
const {
  ready: sketchReady,
  hasInk: sketchHasInk,
  skipped: sketchSkipped,
} = sketch;

const activeTab = ref("sim");
const readout = shallowRef(null); // letzter Sim-Punkt
const verdict = shallowRef(null); // {tone, title, html}

/* Zusätzliches Gate des Originals: Skizze beginnt (fast) links (t ≤ 100). */
const firstOk = computed(() => {
  void sketch.version.value;
  if (sketchSkipped.value) return true;
  for (const p of sketch.points()) if (p.v != null) return p.t <= 100;
  return false;
});
const sketchCovWarn = computed(
  () => sketchHasInk.value && !(sketchReady.value && firstOk.value),
);
const canStart = computed(
  () => phase.value === "sketch" && sketchReady.value && firstOk.value,
);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);

/* ===== Canvas ===== */
const repCanvas = ref(null);
const utilCanvas = ref(null);
const chartWrap = ref(null);
const rH = 230,
  uH = 64;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 46, r: 12, t: 12, b: 22 },
  UPAD = { l: 46, r: 12, t: 6, b: 16 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (t) => PAD.l + (t / T_END) * (W - PAD.l - PAD.r);
const tOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T_END;
const yOf = (n) =>
  PAD.t + (1 - Math.min(n, N_AX) / N_AX) * (rH - PAD.t - PAD.b);
const nOfY = (y) => (1 - (y - PAD.t) / (rH - PAD.t - PAD.b)) * N_AX;
const yU = (u) =>
  UPAD.t + (1 - Math.min(u, 1.05) / 1.05) * (uH - UPAD.t - UPAD.b);

/* Palette aus den CSS-Variablen des Chart-Containers (Light/Dark via CSS). */
function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !repCanvas.value || !utilCanvas.value) return;
  W = wrap.clientWidth;
  // Slidev skaliert die Folie per CSS-Transform — Backing-Store zusätzlich
  // mit dem effektiven Scale multiplizieren, sonst wird der Canvas unscharf.
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [repCanvas.value, rH],
    [utilCanvas.value, uH],
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
  ctx.strokeStyle = cssVar("--hh-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 30) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--hh-grid-m");
  ctx.fillStyle = cssVar("--hh-muted");
  ctx.font = `10px ${MONO}`;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 120) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
    ctx.fillText(t / 60 + " min", x - 10, h - pad.b + 13);
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
function stepMarkerLine(ctx, h, pad, withLabel) {
  const x = Math.round(xOf(STEP_T)) + 0.5;
  ctx.save();
  ctx.strokeStyle = cssVar("--hh-mark");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, pad.t);
  ctx.lineTo(x, h - pad.b);
  ctx.stroke();
  if (withLabel) {
    ctx.fillStyle = cssVar("--hh-mark-lbl");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Last 400 → 900 req/s", x + 5, pad.t + 12);
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

function drawRep() {
  const c = repCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    rH,
    PAD,
    [
      [0, "0"],
      [5, "5"],
      [10, "10"],
      [15, "15"],
      [20, "20"],
      [25, "25"],
      [30, "30"],
    ],
    "Pods",
    yOf,
  );
  stepMarkerLine(ctx, rH, PAD, true);
  // Referenz: benoetigte Pods
  const refPts = [
    { t: 0, v: IDEAL0 },
    { t: STEP_T, v: IDEAL0 },
    { t: STEP_T, v: IDEAL1 },
    { t: T_END, v: IDEAL1 },
  ];
  plotLine(
    ctx,
    refPts,
    (p) => xOf(p.t),
    (p) => yOf(p.v),
    cssVar("--hh-ref"),
    1.4,
    [6, 4],
  );
  ctx.save();
  ctx.fillStyle = cssVar("--hh-muted");
  ctx.font = `10px ${MONO}`;
  ctx.fillText("benötigt: 6,7 → 15 Pods", xOf(STEP_T) + 8, yOf(IDEAL1) - 6);
  ctx.restore();
  for (const run of oldRuns)
    plotLine(
      ctx,
      run,
      (p) => xOf(p.t),
      (p) => yOf(p.n),
      cssVar("--hh-signal"),
      1.6,
      [],
      0.2,
    );
  if (sim)
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.n),
      cssVar("--hh-signal"),
      2.2,
    );
  const predPts = sketch.points();
  plotLine(
    ctx,
    predPts,
    (p) => (p.v == null ? null : xOf(p.t)),
    (p) => (p.v == null ? null : yOf(p.v)),
    cssVar("--hh-pencil"),
    2,
    [7, 5],
  );
}
function drawUtil() {
  const c = utilCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    uH,
    UPAD,
    [
      [0, "0 %"],
      [0.6, "60 %"],
      [1, "100 %"],
    ],
    "CPU (ready Pods)",
    yU,
  );
  stepMarkerLine(ctx, uH, UPAD, false);
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yU(TARGET),
    cssVar("--hh-ok"),
    1.2,
    [2, 4],
  );
  if (sim) {
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yU(p.u),
      cssVar("--hh-util"),
      1.6,
    );
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yU(p.uh),
      cssVar("--hh-pencil"),
      1.2,
      [4, 3],
    );
  }
}
function drawAll() {
  drawRep();
  drawUtil();
}

/* ===== Skizzieren (Pointer → usePredictSketch) ===== */
function evToTV(ev) {
  const c = repCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * rH;
  return { t: tOf(x), v: nOfY(y) };
}
function onRepDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  repCanvas.value.setPointerCapture(ev.pointerId);
  onRepMove(ev);
}
function onRepMove(ev) {
  if (!sketch.isDrawing()) return;
  const { t, v } = evToTV(ev);
  sketch.ink(t, v);
}
function onRepUp() {
  sketch.strokeEnd();
}
watch(sketch.version, () => {
  if (phase.value !== "running") drawRep();
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
  sim = new Sim(seed, TS.value, TAU.value, STAB.value ? 300 : 0);
  if (reduceMotion) {
    sim.runTo(T_END);
    finishRun();
    drawAll();
    updateReadout();
    return;
  }
  const stepsPerFrame = 5; // 1200 Schritte -> ~4 s
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
  readout.value = sim.pts[sim.pts.length - 1];
}

/* ===== Auswertung (verbatim) ===== */
function swingCount(vals) {
  // Richtungswechsel mit Amplitude >= 2 Pods (lokale Extrema)
  let flips = 0,
    dir = 0,
    extreme = vals[0];
  for (let i = 1; i < vals.length; i++) {
    const n = vals[i];
    if (dir >= 0 && n < extreme - 1.5) {
      if (dir > 0) flips++;
      dir = -1;
      extreme = n;
    } else if (dir <= 0 && n > extreme + 1.5) {
      if (dir < 0) flips++;
      dir = 1;
      extreme = n;
    } else if ((dir >= 0 && n > extreme) || (dir <= 0 && n < extreme))
      extreme = n;
  }
  return flips;
}
function classify(sw) {
  return sw === 0 ? "smooth" : sw <= 1 ? "overshoot" : "hunting";
}
const LABEL = {
  smooth: "eine glatte Anpassung",
  overshoot: "ein Überschwinger, dann Ruhe",
  hunting: "anhaltendes Schwingen (Hunting)",
};
function finishRun() {
  phase.value = "done";
  animId = null;
  const post = sim.pts.filter((p) => p.t > STEP_T);
  const nVals = post.map((p) => p.n);
  const sw = swingCount(nVals);
  const peak = Math.max(...nVals);
  let lastChange = 0;
  for (let i = 1; i < post.length; i++)
    if (post[i].n !== post[i - 1].n) lastChange = post[i].t;
  const satSec = post.filter((p) => p.u >= 0.999).length * DT;
  const rc = classify(sw);
  let pc = null,
    pSw = null,
    pPeak = null;
  if (!sketchSkipped.value) {
    const pv = sketch
      .points()
      .filter((x) => x.v != null && x.t > STEP_T)
      .map((x) => x.v);
    if (pv.length) {
      pSw = swingCount(pv);
      pPeak = Math.max(...pv);
      pc = classify(pSw);
    }
  }
  const settledTxt =
    lastChange > T_END - 60
      ? "<b>keine Ruhe bis Simulationsende</b> — der Grenzzyklus trägt sich selbst"
      : 'letzte Skalierung bei <b class="mono">' + mmss(lastChange) + "</b>";
  let t, b;
  if (pc == null) {
    t = "Ergebnis: " + LABEL[rc] + ".";
    b =
      'Keine Vorhersage abgegeben. Spitze: <b class="mono">' +
      peak +
      "</b> Pods (nötig: 15); " +
      settledTxt +
      ".";
  } else if (pc === rc) {
    t = "Deine Vorhersage trifft die Kategorie: " + LABEL[rc] + ".";
    b =
      'Deine Spitze: <b class="mono">' +
      fmt(pPeak) +
      '</b> · gemessen: <b class="mono">' +
      peak +
      "</b> Pods; " +
      settledTxt +
      ".";
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      'Deine Spitze: <b class="mono">' +
      fmt(pPeak) +
      '</b> · gemessen: <b class="mono">' +
      peak +
      "</b> Pods (nötig: 15); " +
      settledTxt +
      ". " +
      (rc === "hunting"
        ? "Der Regler reagiert auf eine Welt, die es nicht mehr gibt: Metrik-Lag + Pod-Startzeit bilden eine Totzeit, und ein voll reagierender Regler mit Totzeit schwingt."
        : "");
  }
  verdict.value = {
    tone: rc === "hunting" ? "bad" : pc === rc ? "ok" : "warn",
    title: t,
    html:
      b +
      ' <span class="hh-chip">Schwingungen (≥ 2 Pods): <b>' +
      sw +
      "</b></span>" +
      '<span class="hh-chip">Spitze: <b>' +
      peak +
      "</b> / nötig 15</span>" +
      '<span class="hh-chip">CPU-Sättigung (Nutzer leiden): <b>' +
      fmt(satSec) +
      " s</b></span>",
  };
}

/* ===== Experimentieren (⚙) ===== */
function archiveAndRun(newSeed) {
  if (phase.value === "running") return;
  if (sim) oldRuns.push(sim.pts.map((p) => ({ t: p.t, n: p.n })));
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  sim = null;
  phase.value = "sketch";
  drawAll();
  if (canStart.value) startRun();
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
  TS.value = 60;
  TAU.value = 60;
  STAB.value = false;
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
    eyebrow="Regelschwingung / Hunting · Predict first"
    title="Der Autoscaler, der es gut meint"
    :subtitle="`7 Pods à 100 req/s · Ziel-CPU 60 % · HPA alle 15 s: desired = ceil(current · CPU/Ziel) · Metrik-Lag ${TAU} s · Pod-Start ${TS} s — bei t = 2 min springt die Last dauerhaft 400 → 900 req/s (nötig: 15 Pods). Skizziere die Pod-Anzahl über die vollen 20 Minuten, dann starte.`"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'smooth', label: 'glatte Treppe' },
      { key: 'overshoot', label: 'Überschwingen, dann Ruhe' },
      { key: 'hunting', label: 'Dauerschwingen' },
    ]"
    gear-title="Experimentieren"
    @preset="applyPreset"
  >
    <template #presets-extra>
      <button class="hh-btn hh-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="hh-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="hh-btn hh-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="hh-stage">
        <Tabs
          class="hh-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="hh-charts">
          <div class="hh-chartbox">
            <canvas
              ref="repCanvas"
              class="hh-sketchable"
              aria-label="Pod-Anzahl über Zeit. Zeichenfläche für die Vorhersage."
              @pointerdown="onRepDown"
              @pointermove="onRepMove"
              @pointerup="onRepUp"
              @pointercancel="onRepUp"
            />
            <div v-if="showSketchNote" class="hh-note">
              <b>✏️ Skizziere hier</b> die Pod-Anzahl, Minute 0–20 — die
              gestrichelte Referenz zeigt den rechnerischen Bedarf (6,7 → 15).
            </div>
          </div>
          <div class="hh-chartbox">
            <canvas ref="utilCanvas" aria-label="CPU-Auslastung über Zeit" />
          </div>
          <div class="hh-strip">
            <span v-if="readout" class="hh-readouts">
              t <b>{{ mmss(readout.t) }}</b> · Pods ready + startend
              <b>{{ readout.nr }} + {{ readout.st }}</b> · CPU momentan
              <b
                :class="{
                  bad: readout.u >= 0.99,
                  good: Math.abs(readout.u - TARGET) < 0.05,
                }"
                >{{ fmt(readout.u * 100) }} %</b
              >
              · gemessen (träge) <b>{{ fmt(readout.uh * 100) }} %</b> ·
              HPA-Empfehlung <b>{{ readout.rec }}</b>
            </span>
            <span class="hh-legend">
              <span><i class="sw pred" /> deine Vorhersage</span>
              <span><i class="sw real" /> Simulation (Pods)</span>
              <span><i class="sw old" /> frühere Läufe</span>
              <span><i class="sw ut" /> CPU-Auslastung (ready Pods)</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="hh-explain">
          <div class="hh-sys" aria-label="Systemdiagramm">
            <span class="node"
              >Last<span class="lbl">400 → 900 req/s bei t = 2 min</span></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Pods<span class="lbl"
                >à 100 req/s · Start dauert {{ TS }} s</span
              ></span
            >
            <span class="arrow">◀──<span class="lbl">skaliert</span></span>
            <span class="node"
              >HPA<span class="lbl"
                >alle 15 s · Ziel-CPU 60 % · Metrik-Lag {{ TAU }} s</span
              ></span
            >
          </div>
          <p>
            Der Regler sieht die <b>alte Welt</b>: Die Metrik zeigt die
            Auslastung von vor ~1 Minute, und bereits bestellte Pods sind noch
            nicht ready — tragen also nicht, tauchen aber in
            <span class="mono">current</span> auf. Solange die trägen Zahlen „zu
            heiß“ melden, skaliert der HPA Tick für Tick weiter hoch. Verschärft
            wird das durch die <b>CPU-Sättigung</b>: Bei Überlast steht die
            Metrik bei 100 % fest — der Regler kann nicht sehen,
            <i>wie weit</i> er daneben liegt, nur <i>dass</i>. Wenn dann alle
            bestellten Pods gleichzeitig ready werden, bricht die Auslastung
            ein, der HPA skaliert massiv herunter — zu weit, denn auch dieses
            Signal ist veraltet. Das ist klassisches <b>Hunting</b>: ein Regler
            mit Totzeit (Pod-Start) und Messverzögerung (Metrik-Lag), der auf
            jede Abweichung voll reagiert.
          </p>
          <p>
            Genau hier liegt die Parallele zum <b>Bullwhip-Effekt</b>:
            Order-up-to mit Forecast-Updating ist strukturell derselbe Regler —
            eine Reaktion auf ein verzögertes, verrauschtes Signal, mit
            Nachschubverzögerung (Lieferzeit ↔ Pod-Startzeit). Der HPA ist ein
            einstufiger Bullwhip; verkettete Autoscaler über mehrere Services
            wären der volle.
          </p>
          <p>
            Gegenmittel: das <b>Stabilization Window</b> (Kubernetes-Default:
            300 s für Scale-Down — der HPA nimmt das Maximum der Empfehlungen
            der letzten 5 Minuten und bremst damit den Abbau). Genau deshalb
            existiert dieses Feature. Weitere Hebel: schnellere, glattere
            Metriken; kürzere Pod-Startzeiten (Images, Probes); konservativere
            Scaling-Policies; und grundsätzlich: je länger Totzeit und
            Messverzögerung, desto <i>träger</i> muss der Regler sein — nicht
            nervöser. Wer bei langsamen Pods die Reaktion beschleunigt,
            verstärkt die Schwingung. Regelungstechnisch ist das die alte
            Totzeit-Lektion (Stichwort Smith-Prädiktor).
          </p>
          <p class="hh-foot">
            <b>Bewusste Vereinfachungen dieses Modells:</b> CPU = Last/(ready
            Pods × Kapazität), gesättigt bei 100 %; Metrik-Trägheit als EMA
            (fasst Scrape-Intervall, Mittelungsfenster und Pipeline-Verzögerung
            zusammen); HPA-Formel und 10-%-Toleranzband nach
            Kubernetes-Dokumentation, Sync-Periode 15 s, Replicas 3–30;
            Scale-Down entfernt Pods sofort (startende zuerst); Stabilization
            Window als Maximum der Empfehlungen der letzten 300 s, nur für
            Scale-Down (K8s-Default); Lastrauschen ±3 %. Nicht modelliert:
            Warteschlangen/Latenz hinter der Sättigung, Pod-Kosten,
            Multi-Metrik-HPAs. Dauerschwingen im Default, Beruhigung durch
            Stabilization Window und glattes Verhalten bei kurzen Verzögerungen
            wurden numerisch verifiziert.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="hh-gear">
        <QueueSlider
          :model-value="TS"
          label="Pod-Startzeit"
          :min="10"
          :max="120"
          :step="5"
          unit=" s"
          @update:model-value="(v) => (TS = v)"
        />
        <QueueSlider
          :model-value="TAU"
          label="Metrik-Trägheit τ"
          :min="10"
          :max="120"
          :step="5"
          unit=" s"
          @update:model-value="(v) => (TAU = v)"
        />
        <label class="hh-stab">
          <input v-model="STAB" type="checkbox" />
          Stabilization Window 300 s (K8s-Default)
        </label>
        <p class="hh-gear-hint">
          Die Hunting-Grenze liegt zwischen ~30 s und ~60 s Verzögerung — finde
          sie. Und schalte dann das Stabilization Window ein (den
          Kubernetes-Default).
        </p>
        <div class="hh-gear-btns">
          <button
            class="hh-btn hh-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="hh-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="hh-btn"
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
        class="hh-banner hh-warnb"
      >
        Zeichne die Kurve über den ganzen Zeitraum — von (fast) links bis (fast)
        rechts.
      </div>
      <div v-else-if="verdict" class="hh-banner" :class="`hh-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette des Originals (Light verbatim), Dark-Variante daneben.
   Der Canvas-Code liest diese Variablen via getComputedStyle(chartWrap). */
.hh-stage,
.hh-charts,
.hh-explain {
  --hh-paper: #e9eeea;
  --hh-panel: #fcfdfc;
  --hh-ink: #16282c;
  --hh-muted: #5c6b6a;
  --hh-grid-f: #e2eae4;
  --hh-grid-m: #c6d3cb;
  --hh-pencil: #6a7480;
  --hh-signal: #0b7285;
  --hh-util: #a97c10;
  --hh-mark: #c8912f;
  --hh-mark-lbl: #8a6210;
  --hh-danger: #af3e1b;
  --hh-ok: #3d7a46;
  --hh-ref: #9fb4ac;
}
:global(html.dark) .hh-stage,
:global(html.dark) .hh-charts,
:global(html.dark) .hh-explain {
  --hh-paper: #101a1c;
  --hh-panel: #0d1517;
  --hh-ink: #dce8e6;
  --hh-muted: #8fa3a0;
  --hh-grid-f: #1b2a2c;
  --hh-grid-m: #2d4246;
  --hh-pencil: #93a1ad;
  --hh-signal: #37b6cf;
  --hh-util: #d9a62e;
  --hh-mark: #b98a2e;
  --hh-mark-lbl: #d9a62e;
  --hh-danger: #e0684a;
  --hh-ok: #69b877;
  --hh-ref: #4e6660;
}

.hh-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.hh-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hh-chartbox {
  position: relative;
  background: var(--hh-panel);
  border: 1px solid var(--hh-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.hh-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
}
.hh-chartbox canvas.hh-sketchable {
  cursor: crosshair;
}
.hh-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--hh-panel) 88%, transparent);
  border: 1px dashed var(--hh-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--hh-ink);
  pointer-events: none;
  text-align: center;
  max-width: 340px;
}
.hh-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.hh-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--hh-muted);
}
.hh-readouts b {
  color: var(--hh-ink);
  font-weight: 600;
}
.hh-readouts b.bad {
  color: var(--hh-danger);
}
.hh-readouts b.good {
  color: var(--hh-ok);
}
.hh-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--hh-muted);
}
.hh-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.hh-legend .sw.pred {
  background: var(--hh-pencil);
}
.hh-legend .sw.real {
  background: var(--hh-signal);
}
.hh-legend .sw.old {
  background: var(--hh-signal);
  opacity: 0.3;
}
.hh-legend .sw.ut {
  background: var(--hh-util);
}

/* Buttons in Preset-Zeile & ⚙ */
.hh-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--hh-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--hh-grid-m, #c6d3cb);
}
.hh-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.hh-primary {
  border-color: var(--hh-ok, #3d7a46);
  font-weight: 600;
}
.hh-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.hh-explain {
  max-height: 340px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--hh-ink);
  padding-right: 6px;
}
.hh-explain p {
  margin: 0 0 8px;
}
.hh-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.hh-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.hh-sys .node {
  border: 1px solid var(--hh-grid-m);
  background: var(--hh-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.hh-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--hh-muted);
  font-family: var(--slidev-code-font-family);
}
.hh-sys .arrow {
  color: var(--hh-muted);
  text-align: center;
}
.hh-sys .arrow .lbl {
  display: block;
  font-size: 9px;
}
.hh-foot {
  font-size: 9px;
  color: var(--hh-muted);
}

/* ⚙-Panel */
.hh-gear {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}
.hh-stab {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.hh-stab input {
  width: 14px;
  height: 14px;
  accent-color: #0b7285;
}
.hh-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.hh-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner */
.hh-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.hh-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.hh-banner :deep(.hh-chip) {
  display: inline-block;
  border: 1px solid;
  border-radius: 999px;
  padding: 0 7px;
  margin-left: 5px;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
  opacity: 0.85;
}
.hh-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark) .hh-warnb {
  color: #d9a62e;
}
.hh-ok {
  border-color: #3d7a46;
}
.hh-warn {
  border-color: #c8912f;
}
.hh-bad {
  border-color: #af3e1b;
}
</style>
