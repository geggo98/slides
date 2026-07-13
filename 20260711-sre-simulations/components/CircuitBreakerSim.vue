<script setup>
/**
 * CircuitBreakerSim.vue — „Der Circuit Breaker" (Predict first). Zwei Läufe
 * aus demselben Seed im selben Chart: Lane A = ungebremst (RetryStorm-
 * Modellkern), Lane B = mit Breaker (Closed → Open → Half-Open, Modell in
 * lib/breakerModel.js). Skizziert wird der Goodput MIT Breaker; das
 * Zustandsband oben zeigt Open/Half-Open — gewollte Hysterese als Werkzeug.
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
  B1,
  BreakerSim,
  GP_MAX,
  HALF_FAIL,
  HALF_OK,
  LAMBDA0,
  MU,
  Q_MAX,
  T_END,
  TAU_ERR,
  recoveryTime,
} from "./lib/breakerModel.js";

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const amp = ref(2.0);
const R = ref(2);
const eTrip = ref(0.5);
const tOpen = ref(5);
const phase = ref("sketch"); // sketch | running | done
let simA = null; // ohne Breaker
let simB = null; // mit Breaker
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
const readout = shallowRef(null);
const verdict = shallowRef(null);
const forcedAt = ref(null);

const canStart = computed(() => phase.value === "sketch" && sketchReady.value);
const canForce = computed(
  () =>
    phase.value === "running" &&
    forcedAt.value === null &&
    readout.value &&
    readout.value.state === "closed",
);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);
const subtitle = computed(
  () =>
    `Gleiches Szenario wie der Retry-Sturm: μ = ${MU} · λ = ${LAMBDA0} req/s (ρ = 0,7) · Timeout 1 s · ≤ ${R.value} Retries · Burst ×${fmt(amp.value, 2)} für 10 s — diesmal mit Breaker (kippt bei ${fmt(eTrip.value * 100)} % Fehlerrate, Cooldown ${fmt(tOpen.value, 1)} s, Half-Open-Proben). Skizziere den Goodput MIT Breaker ab t = 20 s; die rote Kurve läuft ungebremst mit.`,
);

/* Preset-Vorhersagen */
const PRESET_FNS = {
  painless: (t) =>
    t < 30 ? 70 - 25 * Math.sin((Math.PI * (t - 20)) / 10) : 70,
  sacrifice: (t) =>
    t < 22 ? 70 - 33 * (t - 20) : t < 33 ? 3 : Math.min(70, 3 + (t - 33) * 6),
  nohelp: (t) => (t < 24 ? Math.max(0, 70 - 17 * (t - 20)) : 0),
};

/* ===== Canvas ===== */
const gpCanvas = ref(null);
const qCanvas = ref(null);
const chartWrap = ref(null);
const gpH = 162,
  qH = 46;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 46, r: 12, t: 14, b: 20 },
  QPAD = { l: 46, r: 12, t: 5, b: 14 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (t) => PAD.l + (t / T_END) * (W - PAD.l - PAD.r);
const tOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T_END;
const yOf = (g) =>
  PAD.t + (1 - Math.min(g, GP_MAX) / GP_MAX) * (gpH - PAD.t - PAD.b);
const gOf = (y) => (1 - (y - PAD.t) / (gpH - PAD.t - PAD.b)) * GP_MAX;
const yQ = (q) =>
  QPAD.t + (1 - Math.min(q, Q_MAX) / Q_MAX) * (qH - QPAD.t - QPAD.b);

function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !gpCanvas.value || !qCanvas.value) return;
  W = wrap.clientWidth;
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
  ctx.strokeStyle = cssVar("--cb-grid-f");
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
  ctx.strokeStyle = cssVar("--cb-grid-m");
  ctx.fillStyle = cssVar("--cb-muted");
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
function burstBand(ctx, h, pad, labelShow) {
  ctx.save();
  ctx.fillStyle = cssVar("--cb-burst-fill");
  ctx.fillRect(xOf(B0), pad.t, xOf(B1) - xOf(B0), h - pad.t - pad.b);
  ctx.strokeStyle = cssVar("--cb-burst-edge");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    xOf(B0) + 0.5,
    pad.t + 0.5,
    xOf(B1) - xOf(B0) - 1,
    h - pad.t - pad.b - 1,
  );
  if (labelShow) {
    ctx.fillStyle = cssVar("--cb-burst-edge");
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
/* Zustandsband: Open (rot) / Half-Open (amber) als Streifen oben im Plot. */
function stateBand(ctx, pts) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  const y = PAD.t + 1;
  const seg = (from, to, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(xOf(from), y, Math.max(1, xOf(to) - xOf(from)), 5);
  };
  let cur = null;
  let curStart = 0;
  for (const p of pts) {
    if (p.state !== cur) {
      if (cur === "open") seg(curStart, p.t, cssVar("--cb-danger"));
      if (cur === "half") seg(curStart, p.t, cssVar("--cb-burst-edge"));
      cur = p.state;
      curStart = p.t;
    }
  }
  const tEnd = pts[pts.length - 1].t;
  if (cur === "open") seg(curStart, tEnd, cssVar("--cb-danger"));
  if (cur === "half") seg(curStart, tEnd, cssVar("--cb-burst-edge"));
  ctx.restore();
}

function drawGoodput() {
  const c = gpCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(ctx, gpH, PAD, GP_MAX, 40, "Goodput [req/s]");
  burstBand(ctx, gpH, PAD, true);
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yOf(LAMBDA0),
    cssVar("--cb-ref"),
    1,
    [2, 4],
  );
  for (const run of oldRuns)
    plotLine(
      ctx,
      run,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--cb-signal"),
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
      cssVar("--cb-signal"),
      2.2,
    );
  if (simA)
    plotLine(
      ctx,
      simA.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--cb-nobrake"),
      1.6,
      [],
      0.6,
    );
  if (simB) {
    plotLine(
      ctx,
      simB.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.g),
      cssVar("--cb-signal"),
      2.2,
    );
    stateBand(ctx, simB.pts);
  }
  const predPts = sketch.points();
  plotLine(
    ctx,
    predPts,
    (p) => (p.v == null ? null : xOf(p.t)),
    (p) => (p.v == null ? null : yOf(p.v)),
    cssVar("--cb-pencil"),
    2,
    [7, 5],
  );
  if (simB && forcedAt.value !== null) {
    const x = xOf(forcedAt.value);
    ctx.save();
    ctx.strokeStyle = cssVar("--cb-shed");
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, PAD.t);
    ctx.lineTo(x, gpH - PAD.b);
    ctx.stroke();
    ctx.fillStyle = cssVar("--cb-shed");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("manuell geöffnet", x + 4, PAD.t + 22);
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
  if (history)
    plotLine(
      ctx,
      history.pts,
      (p) => xOf(p.t),
      (p) => yQ(p.q),
      cssVar("--cb-queue"),
      1.8,
    );
  if (simA) {
    plotLine(
      ctx,
      simA.pts,
      (p) => xOf(p.t),
      (p) => yQ(p.q),
      cssVar("--cb-nobrake"),
      1.2,
      [],
      0.6,
    );
    const last = simA.pts[simA.pts.length - 1];
    if (last && last.q > Q_MAX) {
      ctx.save();
      ctx.fillStyle = cssVar("--cb-nobrake");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "↑ ohne Breaker: q = " + fmt(last.q) + " — wächst unbegrenzt (→ OOM)",
        xOf(45),
        QPAD.t + 12,
      );
      ctx.restore();
    }
  }
  if (simB)
    plotLine(
      ctx,
      simB.pts,
      (p) => xOf(p.t),
      (p) => yQ(p.q),
      cssVar("--cb-queue"),
      1.8,
    );
}
function drawAll() {
  drawGoodput();
  drawQueue();
}

/* ===== Historie (t < 20 s) ===== */
function makeHistory() {
  history = new BreakerSim(seed, amp.value, R.value, { enabled: false });
  history.runTo(B0);
}

/* ===== Skizzieren ===== */
function evToTV(ev) {
  const c = gpCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * gpH;
  return { t: tOf(x), v: gOf(y) };
}
function onDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  gpCanvas.value.setPointerCapture(ev.pointerId);
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
  simA = new BreakerSim(seed, amp.value, R.value, { enabled: false });
  simB = new BreakerSim(seed, amp.value, R.value, {
    enabled: true,
    eTrip: eTrip.value,
    tOpen: tOpen.value,
  });
  simA.runTo(B0);
  simB.runTo(B0);
  history = { pts: simB.pts.slice() };
  simA.pts = [];
  simB.pts = [];
  if (reduceMotion) {
    simA.runTo(T_END);
    simB.runTo(T_END);
    finishRun();
    drawAll();
    updateReadout();
    return;
  }
  const stepsPerFrame = 5;
  const loop = () => {
    for (let k = 0; k < stepsPerFrame && simB.t < T_END; k++) {
      simA.step();
      simB.step();
    }
    drawAll();
    updateReadout();
    if (simB.t < T_END) animId = requestAnimationFrame(loop);
    else finishRun();
  };
  animId = requestAnimationFrame(loop);
}
function triggerForce() {
  if (!canForce.value || !simB) return;
  simB.forceOpen();
  forcedAt.value = simB.t;
}
function updateReadout() {
  if (!simB || !simB.pts.length) return;
  const b = simB.pts[simB.pts.length - 1];
  const a = simA.pts[simA.pts.length - 1];
  readout.value = {
    t: b.t,
    state: b.state,
    err: simB.errEMA,
    q: b.q,
    g: b.g,
    gA: a ? a.g : 0,
    rejected: simB.rejected,
  };
}

/* ===== Auswertung ===== */
const tailMeanRun = (pts, t0 = 90) => {
  const c = pts.filter((x) => x.t >= t0);
  return c.length ? c.reduce((a, x) => a + x.g, 0) / c.length : null;
};
const dipOf = (pts) => {
  let m = Infinity;
  for (const p of pts) if (p.t >= B0 && p.t <= 50 && p.g < m) m = p.g;
  return m;
};
function classify(tail, dip) {
  if (tail == null) return null;
  if (tail <= 8) return "nohelp";
  if (tail > 45 && dip < 20) return "sacrifice";
  if (tail > 45) return "painless";
  return "partial";
}
const LABEL = {
  painless: "rettet ohne Einbruch",
  sacrifice: "kurzes Opfer, dann volle Erholung",
  nohelp: "hilft nicht (Kollaps)",
  partial: "dauerhaft reduzierter Goodput",
};
function sketchDip() {
  let m = Infinity;
  for (const p of sketch.points())
    if (p.v != null && p.t >= B0 && p.t <= 50 && p.v < m) m = p.v;
  return m;
}
function finishRun() {
  phase.value = "done";
  animId = null;
  const tailB = tailMeanRun(simB.pts);
  const dipB = dipOf(simB.pts);
  const rc = classify(tailB, dipB);
  const predTail = sketch.tailMean(90);
  const pc = predTail == null ? null : classify(predTail, sketchDip());
  const recA = recoveryTime(simA.pts);
  const recB = recoveryTime(simB.pts);
  const cheap = simB.rejected;
  const dearB = Math.max(0, Math.round(simB.lostTotal - cheap));
  const dearA = Math.round(simA.lostTotal);
  const chips =
    `Recovery: <b class="mono">${recB != null ? fmt(recB - B0) + " s" : "keine"}</b> (mit) vs. <b class="mono">${recA != null ? fmt(recA - B0) + " s" : "keine bis t = 120 s"}</b> (ohne)` +
    ` · billig verworfen: <b class="mono">${fmt(cheap)}</b>` +
    ` · teuer verloren: <b class="mono">${fmt(dearB)}</b> (mit) vs. <b class="mono">${fmt(dearA)}${simA.q > Q_MAX ? " ↗" : ""}</b> (ohne)` +
    ` · Trips: <b class="mono">${simB.trips}</b>`;
  let t, b;
  if (pc == null) {
    t = "Ergebnis mit Breaker: " + LABEL[rc] + ".";
    b = `Keine Vorhersage abgegeben. Goodput (Mittel t ≥ 90 s): <b class="mono">${fmt(tailB)} req/s</b>.`;
  } else if (pc === rc) {
    t = "Deine Vorhersage stimmt: " + LABEL[rc] + ".";
    b = `Vorhergesagt: <b class="mono">${fmt(predTail)}</b> · gemessen: <b class="mono">${fmt(tailB)} req/s</b> (Mittel t ≥ 90 s).`;
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      `Vorhergesagt: <b class="mono">${fmt(predTail)}</b> · gemessen: <b class="mono">${fmt(tailB)} req/s</b>. ` +
      (pc === "painless" && rc === "sacrifice"
        ? "Der Breaker rettet nicht den Moment — er <b>opfert ihn kontrolliert</b>: Goodput ≈ 0 während Open, dafür volle Erholung. Ohne Breaker: Kollaps ohne Ende."
        : "");
  }
  verdict.value = {
    tone: rc === "nohelp" ? "bad" : pc === rc ? "ok" : "warn",
    title: t,
    html: b + "<br>" + chips,
  };
}

/* ===== Experimentieren (⚙) ===== */
function archiveAndRun(newSeed) {
  if (phase.value === "running") return;
  if (simB) oldRuns.push(simB.pts);
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  simA = null;
  simB = null;
  forcedAt.value = null;
  makeHistory();
  drawAll();
  phase.value = "sketch";
  if (sketchReady.value) startRun();
}
function softResetToSketch() {
  phase.value = "sketch";
  simA = null;
  simB = null;
  forcedAt.value = null;
  verdict.value = null;
  makeHistory();
}
function resetAll() {
  if (phase.value === "running") return;
  oldRuns = [];
  sketch.clear();
  amp.value = 2.0;
  R.value = 2;
  eTrip.value = 0.5;
  tOpen.value = 5;
  seed = randomSeed();
  readout.value = null;
  softResetToSketch();
  drawAll();
}
watch([amp, R, eTrip, tOpen], () => {
  if (phase.value === "running") return;
  makeHistory();
  drawAll();
});

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
watch(isSlideActive, (active) => {
  if (!active && phase.value === "running" && simB) {
    if (animId) cancelAnimationFrame(animId);
    simA.runTo(T_END);
    simB.runTo(T_END);
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

const STATE_LABEL = { closed: "CLOSED", open: "OPEN", half: "HALF-OPEN" };
</script>

<template>
  <SimShell
    eyebrow="Gegenmaßnahmen · Predict first"
    title="Der Circuit Breaker"
    :subtitle="subtitle"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'painless', label: 'rettet ohne Einbruch' },
      { key: 'sacrifice', label: 'kurzes Opfer' },
      { key: 'nohelp', label: 'hilft nicht' },
    ]"
    gear-title="Experimentieren"
    @preset="applyPreset"
  >
    <template #presets-extra>
      <button class="cb-btn cb-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="cb-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        class="cb-btn cb-forcebtn"
        :disabled="!canForce"
        title="Operator-Kill-Switch: den Breaker sofort öffnen, bevor das Fehlerraten-Fenster kippt — je früher, desto weniger Timeout-Verschwendung."
        @click="triggerForce"
      >
        {{
          forcedAt !== null
            ? `manuell geöffnet ab t = ${fmt(forcedAt, 1)} s`
            : "Breaker manuell öffnen"
        }}
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="cb-btn cb-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="cb-stage">
        <Tabs
          class="cb-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="cb-charts">
          <div class="cb-chartbox">
            <canvas
              ref="gpCanvas"
              aria-label="Goodput über Zeit, mit und ohne Breaker. Zeichenfläche für die Vorhersage."
              @pointerdown="onDown"
              @pointermove="onMove"
              @pointerup="onUp"
              @pointercancel="onUp"
            />
            <div v-if="showSketchNote" class="cb-note">
              <b>✏️ Skizziere hier</b> den Goodput <b>mit Breaker</b> ab t = 20
              s — oder wähle oben ein Preset.
            </div>
          </div>
          <div class="cb-chartbox">
            <canvas ref="qCanvas" aria-label="Queue-Tiefe über Zeit" />
          </div>
          <div class="cb-strip">
            <span v-if="readout" class="cb-readouts">
              t <b>{{ fmt(readout.t, 1) }} s</b> · Zustand
              <b class="cb-state" :class="`cb-state-${readout.state}`">{{
                STATE_LABEL[readout.state]
              }}</b>
              · Fehlerrate <b>{{ fmt(readout.err * 100) }} %</b> · Queue
              <b>{{ fmt(readout.q) }}</b> · Goodput
              <b :class="{ bad: readout.g < 10, good: readout.g > 55 }">{{
                fmt(Math.max(0, readout.g))
              }}</b>
              <span class="cb-vs"
                >(ohne: {{ fmt(Math.max(0, readout.gA)) }})</span
              >
              · verworfen <b>{{ fmt(readout.rejected) }}</b>
            </span>
            <span class="cb-legend">
              <span><i class="sw pred" /> Vorhersage</span>
              <span><i class="sw real" /> mit Breaker</span>
              <span><i class="sw nob" /> ohne Breaker</span>
              <span><i class="sw band" /> Open/Half-Open</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="cb-explain">
          <div class="cb-sys" aria-label="Breaker-Zustandsmaschine">
            <span class="node"
              >Closed<span class="lbl"
                >Fehler-EMA &gt; {{ fmt(eTrip * 100) }} % → Open</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Open<span class="lbl"
                >fast-fail · Queue draint · nach {{ fmt(tOpen, 1) }} s →
                Half-Open</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Half-Open<span class="lbl"
                >10 % Proben · {{ HALF_FAIL }} Fails → Open · {{ HALF_OK }} OKs
                → Closed</span
              ></span
            >
          </div>
          <p>
            <b>Warum das funktioniert:</b> Der Breaker verwandelt teure Fehler
            (1 s Timeout + Queue-Arbeit + Retries) in billige (sofortige
            Ablehnung, kein Retry). Während <b>Open</b> draint die Queue mit
            voller Kapazität <span class="mono">μ</span> — genau das, was der
            metastabile Zustand sonst verhindert: Der Retry-Sturm lebt davon,
            dass die Queue nie leer wird.
          </p>
          <p>
            <b>Gewollte Hysterese:</b> Kippen bei
            <span class="mono">{{ fmt(eTrip * 100) }} %</span> Fehlerrate,
            zurück erst nach Cooldown <b>plus</b> bestandener Probe-Phase (≈
            {{ HALF_OK }} OKs bei ≤ {{ HALF_FAIL }} Fails ≈ 13 % toleriert) —
            getrennte Kipp- und Rückkehr-Schwellen plus Totzone, dieselbe
            Doppelschwellen-Mechanik, die im Kapitel „Systeme mit Gedächtnis“
            als Problem auftrat. Cooldown 1 s im ⚙ zeigt das Gegenteil: der
            Zustand flattert (Band oben), jeder verfrühte Close-Versuch slammt
            die Queue erneut.
          </p>
          <p>
            <b>Der Handel:</b> Der Breaker rettet nicht den Burst — er opfert
            ihn kontrolliert. Typischer Lauf (×2, R = 2): ≈ 900 billig
            verworfene Requests kaufen die volle Erholung nach ≈ 10–20 s;
            ungebremst sind es ≈ 7.800 teuer verlorene — Tendenz steigend, Queue
            → OOM.
            <b
              >Ein Breaker kauft Zukunft mit absichtlichem Verzicht im Jetzt.</b
            >
          </p>
          <p class="cb-foot">
            <b>Bewusste Vereinfachungen:</b> Modellkern identisch zum
            Retry-Sturm (Sigmoid-Timeout, Poisson, EMA-Goodput τ ≈ 0,8 s);
            fast-failed Requests werden nicht retried (Client sieht sofort einen
            Fehler und nutzt den Fallback); Probe-Erfolg wird bei Zulassung
            statt nach Antwortzeit bewertet; Fehlerfenster als EMA (τ =
            {{ TAU_ERR }} s) statt Sliding Window; beide Lanes starten mit
            demselben Seed — identische Ströme bis zur ersten Divergenz.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="cb-gear">
        <QueueSlider
          :model-value="eTrip"
          label="Kipp-Schwelle (Fehlerrate)"
          :min="0.2"
          :max="0.9"
          :step="0.05"
          unit=""
          @update:model-value="(v) => (eTrip = v)"
        />
        <QueueSlider
          :model-value="tOpen"
          label="Cooldown (Open)"
          :min="1"
          :max="15"
          :step="0.5"
          unit=" s"
          @update:model-value="(v) => (tOpen = v)"
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
        <QueueSlider
          :model-value="amp"
          label="Burst-Amplitude"
          :min="1.0"
          :max="3.0"
          :step="0.05"
          unit="×"
          @update:model-value="(v) => (amp = v)"
        />
        <p class="cb-gear-hint">
          Cooldown 1 s → das Zustandsband flattert. Späte Kipp-Schwelle (0,85) →
          mehr Timeout-Verschwendung vor dem Öffnen. Amplitude ×1,2 → der
          Breaker kippt nie, beide Kurven identisch (gleicher Seed).
        </p>
        <div class="cb-gear-btns">
          <button
            class="cb-btn cb-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="cb-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="cb-btn"
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
        class="cb-banner cb-warnb"
      >
        Zeichne die Kurve bis (fast) zum rechten Rand — die Vorhersage soll den
        ganzen Zeitraum abdecken.
      </div>
      <div v-else-if="verdict" class="cb-banner" :class="`cb-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette wie RetryStormSim; Lane „ohne Breaker" in Rot. */
.cb-stage,
.cb-charts,
.cb-explain,
.cb-gear {
  --cb-paper: #e9eeea;
  --cb-panel: #fcfdfc;
  --cb-ink: #16282c;
  --cb-muted: #5c6b6a;
  --cb-grid-f: #e2eae4;
  --cb-grid-m: #c6d3cb;
  --cb-pencil: #6a7480;
  --cb-signal: #0b7285;
  --cb-nobrake: #c0392b;
  --cb-queue: #a97c10;
  --cb-burst-fill: rgba(226, 163, 60, 0.16);
  --cb-burst-edge: #c8912f;
  --cb-danger: #af3e1b;
  --cb-ok: #3d7a46;
  --cb-shed: #7048a8;
  --cb-ref: #9fb4ac;
}
:global(html.dark .cb-stage),
:global(html.dark .cb-charts),
:global(html.dark .cb-explain),
:global(html.dark .cb-gear) {
  --cb-paper: #101a1c;
  --cb-panel: #0d1517;
  --cb-ink: #dce8e6;
  --cb-muted: #8fa3a0;
  --cb-grid-f: #1b2a2c;
  --cb-grid-m: #2d4246;
  --cb-pencil: #93a1ad;
  --cb-signal: #37b6cf;
  --cb-nobrake: #e06a5a;
  --cb-queue: #d9a62e;
  --cb-burst-fill: rgba(226, 163, 60, 0.1);
  --cb-burst-edge: #b98a2e;
  --cb-danger: #e0684a;
  --cb-ok: #69b877;
  --cb-shed: #a884e0;
  --cb-ref: #4e6660;
}

.cb-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.cb-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cb-chartbox {
  position: relative;
  background: var(--cb-panel);
  border: 1px solid var(--cb-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.cb-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.cb-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--cb-panel) 88%, transparent);
  border: 1px dashed var(--cb-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--cb-ink);
  pointer-events: none;
  text-align: center;
}
.cb-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.cb-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--cb-muted);
}
.cb-readouts b {
  color: var(--cb-ink);
  font-weight: 600;
}
.cb-readouts b.bad {
  color: var(--cb-danger);
}
.cb-readouts b.good {
  color: var(--cb-ok);
}
.cb-vs {
  color: var(--cb-nobrake);
}
.cb-state {
  border-radius: 4px;
  padding: 0 4px;
}
.cb-state-closed {
  color: var(--cb-ok);
}
.cb-state-open {
  color: var(--cb-danger);
}
.cb-state-half {
  color: var(--cb-burst-edge);
}
.cb-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--cb-muted);
}
.cb-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.cb-legend .sw.pred {
  background: var(--cb-pencil);
}
.cb-legend .sw.real {
  background: var(--cb-signal);
}
.cb-legend .sw.nob {
  background: var(--cb-nobrake);
}
.cb-legend .sw.band {
  background: var(--cb-danger);
}

/* Buttons */
.cb-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--cb-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--cb-grid-m, #c6d3cb);
}
.cb-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.cb-primary {
  border-color: var(--cb-ok, #3d7a46);
  font-weight: 600;
}
.cb-forcebtn {
  border-color: var(--cb-shed, #7048a8);
}
.cb-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.cb-explain {
  max-height: 380px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--cb-ink);
  padding-right: 6px;
}
.cb-explain p {
  margin: 0 0 8px;
}
.cb-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.cb-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.cb-sys .node {
  border: 1px solid var(--cb-grid-m);
  background: var(--cb-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.cb-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--cb-muted);
  font-family: var(--slidev-code-font-family);
}
.cb-sys .arrow {
  color: var(--cb-muted);
}
.cb-foot {
  font-size: 9px;
  color: var(--cb-muted);
}

/* ⚙-Panel */
.cb-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 280px;
}
.cb-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.cb-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner */
.cb-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.cb-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.cb-banner > b {
  margin-right: 5px;
}
.cb-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark .cb-warnb) {
  color: #d9a62e;
}
.cb-ok {
  border-color: #3d7a46;
}
.cb-warn {
  border-color: #c8912f;
}
.cb-bad {
  border-color: #af3e1b;
}
</style>
