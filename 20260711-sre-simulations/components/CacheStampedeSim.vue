<script setup>
/**
 * CacheStampedeSim.vue — „Die Cache-Stampede" (Predict first), portiert aus
 * cache-stampede-predict-first.html. Modell, Preset-Kurven, Verdict-Logik und
 * Canvas-Zeichencode verbatim übernommen; DOM-Plumbing → Vue-Refs, Skizze →
 * usePredictSketch, Labor-Regler hinter dem ⚙ der SimShell, Erklärung/Modell
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
const MU = 200,
  BASE = 100,
  TTL = 20,
  T_END = 90,
  DT = 0.02,
  FIRST_EXP = 20;
const W_MAX = 30,
  Q_MAX = 8000;

class Sim {
  constructor(seed, lamV, CV, sfV) {
    this.rnd = mulberry32(seed);
    this.lam = lamV;
    this.C = CV;
    this.sf = sfV;
    this.t = 0;
    this.q = 0;
    this.valid = true;
    this.ahead = 0;
    this.nextExp = FIRST_EXP;
    this.dups = 0;
    this.expiries = [];
    this.pts = []; // {t,w,q,valid}
  }
  step() {
    if (this.valid && this.t >= this.nextExp) {
      this.valid = false;
      this.ahead = this.q + this.C;
      this.q += this.C;
      this.expiries.push(this.t);
    }
    this.q += pois(BASE * DT, this.rnd);
    if (!this.valid && !this.sf) {
      const d = pois(this.lam * DT, this.rnd);
      this.q += d * this.C;
      this.dups += d;
    }
    this.q = Math.max(0, this.q - MU * DT);
    if (!this.valid) {
      this.ahead -= MU * DT;
      if (this.ahead <= 0) {
        this.valid = true;
        this.nextExp = this.t + TTL;
      }
    }
    this.t += DT;
    this.pts.push({ t: this.t, w: this.q / MU, q: this.q, valid: this.valid });
  }
  runTo(t) {
    while (this.t < t - 1e-9) this.step();
  }
}

/* Preset-Vorhersagen (verbatim) */
const PRESET_FNS = {
  blip: (t) =>
    t >= FIRST_EXP && t < FIRST_EXP + 2
      ? 1.5
      : t >= 40 && t < 42
        ? 1.5
        : t >= 60 && t < 62
          ? 1.5
          : t >= 80 && t < 82
            ? 1.5
            : 0.05,
  spike: (t) => {
    if (t < FIRST_EXP) return 0.05;
    const d = t - FIRST_EXP;
    return Math.max(0.05, 15 * Math.exp(-d / 10));
  },
  collapse: (t) => {
    if (t < FIRST_EXP) return 0.05;
    return Math.min(W_MAX, (t - FIRST_EXP) * 0.9);
  },
};

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const lam = ref(400);
const cc = ref(40);
const sf = ref(false);
const phase = ref("sketch"); // sketch | running | done
let sim = null;
let oldRuns = [];
let animId = null;

const sketch = usePredictSketch({
  t0: 0,
  tEnd: T_END,
  step: 0.5,
  vMax: W_MAX,
  minCoverage: 0.55,
  minLastT: 82,
});
const {
  ready: sketchReady,
  covWarn: sketchCovWarn,
  hasInk: sketchHasInk,
  skipped: sketchSkipped,
} = sketch;

const activeTab = ref("sim");
const readout = shallowRef(null); // letzter Sim-Punkt + Duplikat-Zähler
const verdict = shallowRef(null); // {tone, title, html}

const canStart = computed(() => phase.value === "sketch" && sketchReady.value);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);

/* ===== Canvas ===== */
const latCanvas = ref(null);
const blCanvas = ref(null);
const chartWrap = ref(null);
const latH = 230,
  blH = 64;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 46, r: 12, t: 12, b: 22 },
  BPAD = { l: 46, r: 12, t: 6, b: 16 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (t) => PAD.l + (t / T_END) * (W - PAD.l - PAD.r);
const tOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T_END;
const yOf = (w) =>
  PAD.t + (1 - Math.min(w, W_MAX) / W_MAX) * (latH - PAD.t - PAD.b);
const wOfY = (y) => (1 - (y - PAD.t) / (latH - PAD.t - PAD.b)) * W_MAX;
const yB = (q) =>
  BPAD.t + (1 - Math.min(q, Q_MAX) / Q_MAX) * (blH - BPAD.t - BPAD.b);

/* Palette aus den CSS-Variablen des Chart-Containers (Light/Dark via CSS). */
function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !latCanvas.value || !blCanvas.value) return;
  W = wrap.clientWidth;
  // Slidev skaliert die Folie per CSS-Transform — Backing-Store zusätzlich
  // mit dem effektiven Scale multiplizieren, sonst wird der Canvas unscharf.
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [latCanvas.value, latH],
    [blCanvas.value, blH],
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
  ctx.strokeStyle = cssVar("--cs-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 2) {
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--cs-grid-m");
  ctx.fillStyle = cssVar("--cs-muted");
  ctx.font = `10px ${MONO}`;
  ctx.beginPath();
  for (let t = 0; t <= T_END; t += 10) {
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
function expiryMarkers(ctx, h, pad, times, withLabel) {
  ctx.save();
  ctx.strokeStyle = cssVar("--cs-mark");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  for (const te of times) {
    const x = Math.round(xOf(te)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
    ctx.stroke();
  }
  if (withLabel && times.length) {
    ctx.fillStyle = cssVar("--cs-marklbl");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Key läuft ab", xOf(times[0]) + 5, pad.t + 14);
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

function drawLat() {
  const c = latCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    latH,
    PAD,
    [
      [0, "0"],
      [2, "2"],
      [5, "5"],
      [10, "10"],
      [20, "20"],
      [30, "30"],
    ],
    "DB-Latenz [s]",
    yOf,
  );
  // Client-Timeout-Referenz
  plotLine(
    ctx,
    [{ t: 0 }, { t: T_END }],
    (p) => xOf(p.t),
    () => yOf(2),
    cssVar("--cs-ref"),
    1.2,
    [2, 4],
  );
  ctx.save();
  ctx.fillStyle = cssVar("--cs-marklbl");
  ctx.font = `10px ${MONO}`;
  ctx.fillText("typ. Client-Timeout 2 s", W - PAD.r - 150, yOf(2) - 5);
  ctx.restore();
  const expTimes = sim ? sim.expiries : [FIRST_EXP];
  expiryMarkers(ctx, latH, PAD, expTimes, true);
  for (const run of oldRuns)
    plotLine(
      ctx,
      run,
      (p) => xOf(p.t),
      (p) => yOf(p.w),
      cssVar("--cs-signal"),
      1.6,
      [],
      0.2,
    );
  if (sim) {
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yOf(p.w),
      cssVar("--cs-signal"),
      2.2,
    );
    const mx = Math.max(...sim.pts.map((p) => p.w));
    if (mx > W_MAX) {
      ctx.save();
      ctx.fillStyle = cssVar("--cs-danger");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "↑ Latenz-Spitze: " + fmt(mx) + " s — außerhalb der Skala",
        xOf(2),
        PAD.t + 24,
      );
      ctx.restore();
    }
  }
  const predPts = sketch.points();
  plotLine(
    ctx,
    predPts,
    (p) => (p.v == null ? null : xOf(p.t)),
    (p) => (p.v == null ? null : yOf(p.v)),
    cssVar("--cs-pencil"),
    2,
    [7, 5],
  );
}
function drawBacklog() {
  const c = blCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    blH,
    BPAD,
    [
      [0, "0"],
      [4000, "4000"],
      [8000, "8000"],
    ],
    "Backlog [Äq]",
    yB,
  );
  expiryMarkers(ctx, blH, BPAD, sim ? sim.expiries : [FIRST_EXP], false);
  if (sim) {
    plotLine(
      ctx,
      sim.pts,
      (p) => xOf(p.t),
      (p) => yB(p.q),
      cssVar("--cs-backlog"),
      1.8,
    );
    const mx = Math.max(...sim.pts.map((p) => p.q));
    if (mx > Q_MAX) {
      ctx.save();
      ctx.fillStyle = cssVar("--cs-blnote");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "Backlog bis " + fmt(mx) + " Äq (Skala begrenzt)",
        xOf(45),
        BPAD.t + 12,
      );
      ctx.restore();
    }
  }
}
function drawAll() {
  drawLat();
  drawBacklog();
}

/* ===== Skizzieren (Pointer → usePredictSketch) ===== */
function evToTV(ev) {
  const c = latCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * latH;
  return { t: tOf(x), v: wOfY(y) };
}
function onLatDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  latCanvas.value.setPointerCapture(ev.pointerId);
  onLatMove(ev);
}
function onLatMove(ev) {
  if (!sketch.isDrawing()) return;
  const { t, v } = evToTV(ev);
  sketch.ink(t, v);
}
function onLatUp() {
  sketch.strokeEnd();
}
watch(sketch.version, () => {
  if (phase.value !== "running") drawLat();
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
  sim = new Sim(seed, lam.value, cc.value, sf.value);
  if (reduceMotion) {
    sim.runTo(T_END);
    finishRun();
    drawAll();
    updateReadout();
    return;
  }
  const stepsPerFrame = 10; // 4500 Schritte -> ~7,5 s
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
  readout.value = { ...sim.pts[sim.pts.length - 1], dups: sim.dups };
}

/* ===== Auswertung (verbatim) ===== */
function classify(wMax, wEnd) {
  if (wMax < 3) return "blip";
  if (wEnd < 1) return "spike";
  return "collapse";
}
const LABEL = {
  blip: "ein kurzer Blip",
  spike: "ein Berg mit Erholung",
  collapse: "Eskalation ohne Erholung",
};
function finishRun() {
  phase.value = "done";
  animId = null;
  const wMax = Math.max(...sim.pts.map((p) => p.w));
  const wEnd = sim.pts[sim.pts.length - 1].w;
  const rc = classify(wMax, wEnd);
  let predMax = null,
    predEnd = null,
    pc = null;
  if (!sketchSkipped.value) {
    const vals = sketch
      .points()
      .map((p) => p.v)
      .filter((v) => v != null);
    if (vals.length) {
      predMax = Math.max(...vals);
      predEnd = vals[vals.length - 1];
      pc = classify(predMax, predEnd);
    }
  }
  const wasted = sim.dups * cc.value;
  const wastedTxt =
    sim.dups > 0
      ? ' Verschwendete DB-Arbeit: <b class="mono">' +
        fmt(sim.dups) +
        '</b> Duplikat-Rebuilds = <b class="mono">' +
        fmt(wasted) +
        "</b> Query-Äquivalente — für ein Ergebnis, das <b>einer</b> hätte liefern können."
      : "";
  let t, b;
  if (pc == null) {
    t = "Ergebnis: " + LABEL[rc] + ".";
    b =
      'Keine Vorhersage abgegeben. Latenz-Spitze: <b class="mono">' +
      fmt(wMax, 1) +
      ' s</b>, Endwert: <b class="mono">' +
      fmt(wEnd, 1) +
      " s</b>." +
      wastedTxt;
  } else if (pc === rc) {
    t = "Deine Vorhersage trifft die Kategorie: " + LABEL[rc] + ".";
    b =
      'Deine Spitze: <b class="mono">' +
      fmt(predMax, 1) +
      ' s</b> · gemessen: <b class="mono">' +
      fmt(wMax, 1) +
      " s</b>." +
      wastedTxt;
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      'Deine Spitze: <b class="mono">' +
      fmt(predMax, 1) +
      ' s</b> · gemessen: <b class="mono">' +
      fmt(wMax, 1) +
      ' s</b>, Endwert <b class="mono">' +
      fmt(wEnd, 1) +
      " s</b>. " +
      (rc === "collapse"
        ? "Der entscheidende Mechanismus ist nicht der erste Spike, sondern der <b>zweite Ablauf</b>: Er trifft auf den noch nicht abgebauten Backlog, das Miss-Fenster wird um ein Vielfaches länger — und jedes Fenster füttert das nächste."
        : rc === "blip"
          ? ""
          : "Das System erholt sich — die freie Kapazität baut den Duplikat-Backlog vor dem nächsten Ablauf ab. Die Schwelle liegt beim Produkt aus Anfragerate und Rebuild-Kosten.") +
      wastedTxt;
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
  if (sim) oldRuns.push(sim.pts.map((p) => ({ t: p.t, w: p.w })));
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  sim = null;
  phase.value = "sketch";
  drawAll();
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
  lam.value = 400;
  cc.value = 40;
  sf.value = false;
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
    eyebrow="Thundering Herd / Dogpile · Predict first"
    title="Die Cache-Stampede"
    :subtitle="`Heißer Key: ${fmt(lam)} req/s · TTL ${TTL} s (erster Ablauf bei t = 20 s) · DB: ${MU} Äq/s, Grundlast ${BASE} Äq/s · Rebuild = ${fmt(cc)} Äq — jeder Miss startet einen eigenen Neuaufbau. Skizziere die DB-Latenz einer einfachen Query über 0–90 s, dann starte.`"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'blip', label: 'kurzer Blip' },
      { key: 'spike', label: 'ein Berg, dann Erholung' },
      { key: 'collapse', label: 'Eskalation' },
    ]"
    gear-title="Experimentieren"
    @preset="applyPreset"
  >
    <template #presets-extra>
      <button class="cs-btn cs-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="cs-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="cs-btn cs-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="cs-stage">
        <Tabs
          class="cs-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="cs-charts">
          <div class="cs-chartbox">
            <canvas
              ref="latCanvas"
              aria-label="DB-Latenz über Zeit. Zeichenfläche für die Vorhersage."
              @pointerdown="onLatDown"
              @pointermove="onLatMove"
              @pointerup="onLatUp"
              @pointercancel="onLatUp"
            />
            <div v-if="showSketchNote" class="cs-note">
              <b>✏️ Skizziere hier</b> die DB-Latenz, Sekunde 0–90 — vor dem
              ersten Ablauf liegt sie nahe null. Oder wähle oben ein Preset.
            </div>
          </div>
          <div class="cs-chartbox">
            <canvas
              ref="blCanvas"
              aria-label="Ausstehende DB-Arbeit über Zeit"
            />
          </div>
          <div class="cs-strip">
            <span v-if="readout" class="cs-readouts">
              t <b>{{ fmt(readout.t) }} s</b> · Cache
              <b :class="readout.valid ? 'good' : 'bad'">{{
                readout.valid ? "gültig" : "MISS"
              }}</b>
              · DB-Latenz
              <b :class="{ bad: readout.w > 2 }">{{ fmt(readout.w, 2) }} s</b>
              · Backlog <b>{{ fmt(readout.q) }}</b> · Duplikat-Rebuilds
              <b :class="{ bad: readout.dups > 100 }">{{
                fmt(readout.dups)
              }}</b>
            </span>
            <span class="cs-legend">
              <span><i class="sw pred" /> deine Vorhersage</span>
              <span><i class="sw real" /> Simulation (DB-Latenz)</span>
              <span><i class="sw bl" /> DB-Backlog (Arbeit)</span>
              <span class="cs-legend-mark">┊ Key-Ablauf</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="cs-explain">
          <div class="cs-sys" aria-label="Systemdiagramm">
            <span class="node"
              >Clients<span class="lbl"
                >{{ fmt(lam) }} req/s auf einen Key</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Cache<span class="lbl"
                >TTL {{ TTL }} s · 1 heißer Key</span
              ></span
            >
            <span class="arrow">──▶<span class="lbl">nur bei Miss</span></span>
            <span class="node"
              >Datenbank<span class="lbl"
                >{{ MU }} Äq/s · Grundlast {{ BASE }} Äq/s · Rebuild =
                {{ fmt(cc) }} Äq</span
              ></span
            >
          </div>
          <p>
            Zwei Zutaten, keine davon ist eine Kette: <b>Synchronisation</b>
            (alle Requests missen im selben Moment) als Auslöser, und
            <b>Arbeitsduplikation</b> als Verstärker — jeder Miss startet
            denselben teuren Neuaufbau, obwohl <i>einer</i> genügen würde. Dazu
            kommt die Rückkopplung über das <b>Miss-Fenster</b>: Je voller die
            DB, desto später ist der erste Neuaufbau fertig, desto länger
            strömen weitere Duplikate herein. Reicht die freie DB-Kapazität
            nicht, um den Duplikat-Backlog vor dem <i>nächsten</i> TTL-Ablauf
            abzubauen, gräbt jeder Ablauf tiefer — die Eskalation läuft über
            wiederholte Abläufe, nicht über einen einzelnen.
          </p>
          <p>
            Einordnung: Das ist <b>kein Bullwhip</b> — es gibt keine mehrstufige
            Kette und kein Forecast-Updating. Strukturell ist es ein Verwandter
            des <b>Retry-Sturms</b>: positive Rückkopplung durch
            Arbeitsvervielfachung. Der Kollateralschaden trifft dabei alle
            <i>anderen</i> Endpoints, deren Queries hinter den nutzlosen
            Duplikaten warten.
          </p>
          <p>
            Gegenmittel, vom stärksten abwärts:
            <b>Request-Coalescing / Single-Flight</b> (genau ein Neuaufbau pro
            Ablauf, alle anderen warten auf dasselbe Ergebnis — Go
            <span class="mono">singleflight</span>, Caffeine
            <span class="mono">refreshAfterWrite</span>);
            <b>probabilistische frühe Erneuerung</b> (XFetch: Erneuern kurz
            <i>vor</i> Ablauf mit zufälligem Vorlauf);
            <b>stale-while-revalidate</b> (alten Wert servieren, während einer
            erneuert); bei vielen Keys zusätzlich <b>TTL-Jitter</b> gegen
            synchronisierte Abläufe nach einem Deploy.
          </p>
          <p class="cs-foot">
            <b>Bewusste Vereinfachungen dieses Modells:</b> Die DB ist eine
            FIFO-Fluid-Warteschlange in „Query-Äquivalenten" (1 Äq = eine
            einfache Query; ein Rebuild = C Äq am Stück); Ankünfte Poisson; ein
            einziger heißer Key; Rebuild-Kosten konstant; das Miss-Fenster
            endet, sobald der <i>erste</i> Neuaufbau fertig ist (FIFO-Position
            bei Ablauf). Nicht modelliert: Client-Timeouts auf den Rebuilds
            selbst — real brächen die ab und würden wiederholt, was die Lage
            weiter verschlimmert (siehe Retry-Sturm-Widget). Eskalations- und
            Erholungsregime sowie der Single-Flight-Kontrast wurden numerisch
            verifiziert.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="cs-gear">
        <QueueSlider
          :model-value="lam"
          label="Anfragerate auf den Key"
          :min="100"
          :max="800"
          :step="25"
          unit=" req/s"
          @update:model-value="(v) => (lam = v)"
        />
        <QueueSlider
          :model-value="cc"
          label="Rebuild-Kosten"
          :min="10"
          :max="80"
          :step="5"
          unit=" Äq"
          @update:model-value="(v) => (cc = v)"
        />
        <label class="cs-share">
          <input v-model="sf" type="checkbox" />
          Single-Flight: nur ein Neuaufbau pro Ablauf
        </label>
        <p class="cs-gear-hint">
          Finde die Eskalationsschwelle: Sie hängt vom Produkt aus Anfragerate
          und Rebuild-Kosten ab. Und schalte dann Single-Flight ein. Frühere
          Läufe bleiben blass sichtbar.
        </p>
        <div class="cs-gear-btns">
          <button
            class="cs-btn cs-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="cs-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="cs-btn"
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
        class="cs-banner cs-warnb"
      >
        Zeichne die Kurve über den ganzen Zeitraum — von (fast) links bis (fast)
        rechts.
      </div>
      <div v-else-if="verdict" class="cs-banner" :class="`cs-${verdict.tone}`">
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
.cs-stage,
.cs-charts,
.cs-explain,
.cs-gear {
  --cs-paper: #e9eeea;
  --cs-panel: #fcfdfc;
  --cs-ink: #16282c;
  --cs-muted: #5c6b6a;
  --cs-grid-f: #e2eae4;
  --cs-grid-m: #c6d3cb;
  --cs-pencil: #6a7480;
  --cs-signal: #0b7285;
  --cs-backlog: #a97c10;
  --cs-mark: #c8912f;
  --cs-danger: #af3e1b;
  --cs-ok: #3d7a46;
  --cs-ref: #b08015;
  --cs-marklbl: #8a6210;
  --cs-blnote: #8a5f0c;
}
:global(html.dark .cs-stage),
:global(html.dark .cs-charts),
:global(html.dark .cs-explain),
:global(html.dark .cs-gear) {
  --cs-paper: #101a1c;
  --cs-panel: #0d1517;
  --cs-ink: #dce8e6;
  --cs-muted: #8fa3a0;
  --cs-grid-f: #1b2a2c;
  --cs-grid-m: #2d4246;
  --cs-pencil: #93a1ad;
  --cs-signal: #37b6cf;
  --cs-backlog: #d9a62e;
  --cs-mark: #b98a2e;
  --cs-danger: #e0684a;
  --cs-ok: #69b877;
  --cs-ref: #c99b2c;
  --cs-marklbl: #d9a62e;
  --cs-blnote: #d9a62e;
}

.cs-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.cs-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cs-chartbox {
  position: relative;
  background: var(--cs-panel);
  border: 1px solid var(--cs-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.cs-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.cs-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--cs-panel) 88%, transparent);
  border: 1px dashed var(--cs-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--cs-ink);
  pointer-events: none;
  text-align: center;
}
.cs-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.cs-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--cs-muted);
}
.cs-readouts b {
  color: var(--cs-ink);
  font-weight: 600;
}
.cs-readouts b.bad {
  color: var(--cs-danger);
}
.cs-readouts b.good {
  color: var(--cs-ok);
}
.cs-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--cs-muted);
}
.cs-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.cs-legend .sw.pred {
  background: var(--cs-pencil);
}
.cs-legend .sw.real {
  background: var(--cs-signal);
}
.cs-legend .sw.bl {
  background: var(--cs-backlog);
}
.cs-legend-mark {
  font-family: var(--slidev-code-font-family);
  color: var(--cs-mark);
}

/* Buttons in Preset-Zeile & ⚙ */
.cs-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--cs-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--cs-grid-m, #c6d3cb);
}
.cs-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.cs-primary {
  border-color: var(--cs-ok, #3d7a46);
  font-weight: 600;
}
.cs-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.cs-explain {
  max-height: 340px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--cs-ink);
  padding-right: 6px;
}
.cs-explain p {
  margin: 0 0 8px;
}
.cs-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.cs-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.cs-sys .node {
  border: 1px solid var(--cs-grid-m);
  background: var(--cs-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.cs-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--cs-muted);
  font-family: var(--slidev-code-font-family);
}
.cs-sys .arrow {
  color: var(--cs-muted);
  text-align: center;
}
.cs-sys .arrow .lbl {
  display: block;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
}
.cs-foot {
  font-size: 9px;
  color: var(--cs-muted);
}

/* ⚙-Panel */
.cs-gear {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}
.cs-share {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.cs-share input {
  accent-color: #0b7285;
}
:global(html.dark .cs-share input) {
  accent-color: #37b6cf;
}
.cs-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.cs-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner */
.cs-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.cs-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.cs-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark .cs-warnb) {
  color: #d9a62e;
}
.cs-ok {
  border-color: #3d7a46;
}
.cs-warn {
  border-color: #c8912f;
}
.cs-bad {
  border-color: #af3e1b;
}
</style>
