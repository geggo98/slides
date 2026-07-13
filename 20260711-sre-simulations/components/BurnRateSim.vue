<script setup>
/**
 * BurnRateSim.vue — „SLO, Error-Budget & Burn-Rate" (Predict first, diskret).
 * Fehlerraten-Szenarien gegen die Multi-Window-Alert-Policy des SRE Workbook.
 * Vorhersage per Tipp-Chips (Wer feuert zuerst? Budget beim 1. Alarm?) statt
 * Skizze — die gefragten Größen sind diskret. Reveal per Transport-Playhead:
 * die Fehlerraten-Kurve ist die Aufgabe (sofort sichtbar), Burn-Raten,
 * Alert-Lanes und Budget decken sich erst beim Abspielen auf.
 * Modell in lib/burnRate.js (Vitest-geprüft gegen die Soll-Tabelle).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { fmtDe as fmt, randomSeed } from "./lib/rng.js";
import { useSimTransport } from "./lib/useSimTransport";
import { ALERTS, NAIVE, SCENARIOS, buildRun } from "./lib/burnRate.js";

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = 20260711;
const scenario = ref("spike");
const sloPct = ref(99.9); // ⚙ SLO-Ziel in %
const intensity = ref(1);
const fastWinMin = ref(60);
const phase = ref("predict"); // predict | revealed
const guessFirst = ref(null);
const guessBudget = ref(null);
const guessSkipped = ref(false);
const activeTab = ref("sim");
const readout = shallowRef(null);
const verdict = shallowRef(null);

let data = null; // buildRun-Ergebnis, bewusst nicht-reaktiv
const dataVersion = ref(0);

const T_NORM = 1000; // normalisierter Playhead (Spannen wechseln je Szenario)
const transport = useSimTransport({
  tMax: T_NORM,
  runSeconds: 20,
  startAtEnd: false,
  onChange: () => {
    updateReadout();
    drawAll();
  },
});
const { playhead, playing } = transport;

const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const presets = Object.entries(SCENARIOS).map(([key, s]) => ({
  key,
  label: s.label,
  title: s.title,
}));
const Q1 = [
  { key: "fast", label: "Fast Page" },
  { key: "slow", label: "Slow Page" },
  { key: "ticket", label: "Ticket" },
  { key: "none", label: "keiner" },
];
const Q2 = [
  { key: "98", label: "≈ 98 %" },
  { key: "95", label: "≈ 95 %" },
  { key: "90", label: "≈ 90 %" },
  { key: "80", label: "< 80 %" },
];

const guessReady = computed(
  () =>
    guessSkipped.value ||
    (guessFirst.value !== null && guessBudget.value !== null),
);
const canPlay = computed(() => phase.value === "revealed" || guessReady.value);
const speedLabel = computed(() =>
  data ? `Zeitraffer ≈ ×${fmt(data.spanS / 20)}` : "",
);
const subtitle = computed(() => {
  void dataVersion.value;
  const s = SCENARIOS[scenario.value];
  return `SLO ${fmt(sloPct.value, 1)} % (30-Tage-Budget ≙ ${fmt((100 - sloPct.value) * 0.01 * 720 * 60)} min Totalausfall) · Policy: Fast Page 14,4× über ${fmt(fastWinMin.value)} min (+ Kurzfenster) · Slow Page 6× über 6 h (+ 30 min) · Ticket 1× über 3 d (+ 6 h) — Szenario: ${s.title}. Erst tippen, dann ▶.`;
});

/* Sim-Zeit aus normalisiertem Playhead */
const simT = () => (data ? (playhead.value / T_NORM) * data.spanS : 0);
function fmtT(t) {
  if (!data) return "";
  if (data.spanS <= 7200) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")} min`;
  }
  if (t < 86400) return `${fmt(t / 3600, 1)} h`;
  return `${Math.floor(t / 86400)} d ${fmt((t % 86400) / 3600, 0)} h`;
}

/* ===== Daten ===== */
function recompute() {
  data = buildRun({
    scenario: scenario.value,
    slo: sloPct.value / 100,
    intensity: intensity.value,
    fastWinMin: fastWinMin.value,
    seed,
  });
  dataVersion.value++;
  updateReadout();
  drawAll();
}
function selectScenario(key) {
  scenario.value = key;
  phase.value = "predict";
  guessFirst.value = null;
  guessBudget.value = null;
  guessSkipped.value = false;
  verdict.value = null;
  transport.stop();
  transport.scrub(0);
  recompute();
}
function onPlay() {
  if (!canPlay.value) return;
  if (phase.value === "predict") phase.value = "revealed";
  if (reduceMotion) {
    transport.jumpToEnd();
    return;
  }
  transport.toggle();
}
function skipGuess() {
  guessSkipped.value = true;
}
function rerun(newSeed) {
  if (newSeed) seed = randomSeed();
  verdict.value = null;
  transport.stop();
  transport.scrub(0);
  recompute();
}

watch([sloPct, intensity, fastWinMin], () => {
  verdict.value = null;
  recompute();
});
watch(playhead, (v) => {
  if (v >= T_NORM - 1e-6 && phase.value === "revealed" && !verdict.value)
    makeVerdict();
});
watch(isSlideActive, (a) => {
  if (!a) transport.stop();
});

/* ===== Verdict ===== */
const bandOf = (r) =>
  r >= 96.5 ? "98" : r >= 92.5 ? "95" : r >= 85 ? "90" : "80";
const ALERT_LABEL = {
  fast: "die Fast Page",
  slow: "die Slow Page",
  ticket: "das Ticket",
  none: "keiner",
};
function makeVerdict() {
  const first = data.firstAlert;
  const rem = data.remainingAtFire;
  const band = bandOf(rem);
  const facts =
    first === "none"
      ? `Kein Policy-Alert feuert — Restbudget am Ende: <b class="mono">${fmt(data.remaining[data.n - 1], 1)} %</b>.`
      : `Zuerst feuert <b>${ALERT_LABEL[first]}</b> bei <b class="mono">${fmt(rem, 1)} %</b> Restbudget (t = ${fmtT(data.events.find((e) => e.key === first).t)}).`;
  const insight = {
    spike:
      "Die 2 % beim Feuern sind by design: θ·W/720 h = 14,4 · 1 h / 720 h. Teuer ist nicht die Erkennung, sondern die Dauer — 20 min Totalausfall = 46 % des Monatsbudgets.",
    creep: `Burn 3× ist zu leise für beide Pages (< 6×) — genau dafür gibt es das Ticket (10 % verbraucht). Reichweite: Budget leer in ~${Number.isFinite(data.reachS) ? fmt(data.reachS / 86400, 0) + " Tagen" : "∞"}.`,
    flap: `Der naive 5-min-Alert hätte <b class="mono">${fmt(data.naiveCount)}</b>-mal gefeuert — die Policy macht daraus genau <b class="mono">${data.lanes.find((l) => l.key === "ticket").segments.length}</b> Ticket. Langes Fenster integriert (feuern), kurzes setzt schnell zurück: gewollte Hysterese.`,
  }[scenario.value];
  if (guessSkipped.value) {
    verdict.value = {
      tone: "info",
      title: "Ergebnis (ohne Tipp):",
      html: `${facts}<br>${insight}`,
    };
    return;
  }
  const ok1 = guessFirst.value === first;
  const ok2 = guessBudget.value === band;
  const score = (ok1 ? 1 : 0) + (ok2 ? 1 : 0);
  const title =
    score === 2
      ? "Beide Tipps richtig."
      : score === 1
        ? ok1
          ? "Der Alert stimmt — das Budget nicht."
          : "Das Budget stimmt — der Alert nicht."
        : "Beide Tipps daneben — die Tabelle unten erklärt warum.";
  verdict.value = {
    tone: score === 2 ? "ok" : score === 1 ? "warn" : "bad",
    title,
    html: `${facts}<br>${insight}`,
  };
}

/* ===== Canvas ===== */
const errCanvas = ref(null);
const burnCanvas = ref(null);
const budCanvas = ref(null);
const chartWrap = ref(null);
const errH = 44,
  burnH = 136,
  budH = 50;
const LANE_H = 9;
const LANES_H = 4 * LANE_H + 4;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 52, r: 12 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}
const laneColor = (key) =>
  cssVar(
    {
      fast: "--br-fast",
      slow: "--br-slow",
      ticket: "--br-ticket",
      naive: "--br-naive",
    }[key],
  );

const xOf = (t) => PAD.l + (t / data.spanS) * (W - PAD.l - PAD.r);
/* log-Skalen */
const yLog = (v, lo, hi, top, bot) => {
  const f =
    (Math.log10(Math.max(v, lo)) - Math.log10(lo)) /
    (Math.log10(hi) - Math.log10(lo));
  return bot - Math.min(1, Math.max(0, f)) * (bot - top);
};

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap) return;
  W = wrap.clientWidth;
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [errCanvas.value, errH],
    [burnCanvas.value, burnH],
    [budCanvas.value, budH],
  ]) {
    if (!c) continue;
    c.width = Math.round(W * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = h + "px";
  }
  drawAll();
}

function xGrid(ctx, h, labels) {
  ctx.strokeStyle = cssVar("--br-grid-m");
  ctx.fillStyle = cssVar("--br-muted");
  ctx.font = `9px ${MONO}`;
  ctx.beginPath();
  const step = data.spanS / 6;
  for (let k = 0; k <= 6; k++) {
    const t = k * step;
    const x = Math.round(xOf(t)) + 0.5;
    ctx.moveTo(x, 2);
    ctx.lineTo(x, h - (labels ? 12 : 2));
    if (labels && k > 0 && k < 6) ctx.fillText(fmtT(t), x - 16, h - 2);
  }
  ctx.stroke();
}
function playheadLine(ctx, h) {
  const t = simT();
  if (t <= 0) return;
  const x = xOf(t);
  ctx.save();
  ctx.strokeStyle = cssVar("--br-ink");
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(x, 2);
  ctx.lineTo(x, h - 2);
  ctx.stroke();
  ctx.restore();
}
function hintText(ctx, h, msg) {
  ctx.fillStyle = cssVar("--br-muted");
  ctx.font = `10px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText(msg, (PAD.l + W - PAD.r) / 2, h / 2 + 3);
  ctx.textAlign = "left";
}
const strideOf = () => Math.max(1, Math.floor(data.n / 1800));
const iMax = () =>
  Math.min(data.n - 1, Math.round((simT() / data.spanS) * (data.n - 1)));

function drawErr() {
  const c = errCanvas.value;
  if (!c || !W || !data) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, errH);
  xGrid(ctx, errH, false);
  const top = 6,
    bot = errH - 6;
  ctx.fillStyle = cssVar("--br-muted");
  ctx.font = `9px ${MONO}`;
  for (const [v, lbl] of [
    [1, "100 %"],
    [0.01, "1 %"],
    [0.0001, "0,01 %"],
  ]) {
    const y = yLog(v, 1e-5, 1, top, bot);
    ctx.fillText(lbl, 4, y + 3);
  }
  ctx.fillText("Fehlerrate (log)", PAD.l + 6, 10);
  // Die Aufgabe: Fehlerraten-Spur ist IMMER komplett sichtbar.
  ctx.strokeStyle = cssVar("--br-err");
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const st = strideOf();
  for (let i = 0; i < data.n; i += st) {
    const x = xOf(i * data.dt);
    const y = yLog(data.err[i], 1e-5, 1, top, bot);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  playheadLine(ctx, errH);
}

function drawBurn() {
  const c = burnCanvas.value;
  if (!c || !W || !data) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, burnH);
  const plotBot = burnH - LANES_H - 14;
  const top = 8;
  xGrid(ctx, burnH, true);
  ctx.fillStyle = cssVar("--br-muted");
  ctx.font = `9px ${MONO}`;
  ctx.fillText("Burn-Rate (log)", PAD.l + 6, 10);
  // Schwellen-Hairlines
  for (const [v, lbl] of [
    [14.4, "14,4×"],
    [6, "6×"],
    [1, "1×"],
  ]) {
    const y = yLog(v, 0.05, 2000, top, plotBot);
    ctx.strokeStyle = cssVar("--br-grid-m");
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(W - PAD.r, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(lbl, 4, y + 3);
  }
  if (phase.value === "predict") {
    hintText(ctx, plotBot, "Erst tippen: Wer feuert zuerst? — dann ▶");
    return;
  }
  const st = strideOf();
  const im = iMax();
  const keys = ["ticket", "slow", "fast", "naive"];
  for (const key of keys) {
    const lane = data.lanes.find((l) => l.key === key);
    ctx.strokeStyle = laneColor(key);
    ctx.lineWidth = key === "naive" ? 1 : 1.7;
    ctx.globalAlpha = key === "naive" ? 0.45 : 1;
    ctx.setLineDash(key === "naive" ? [4, 3] : []);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= im; i += st) {
      const x = xOf(i * data.dt);
      const y = yLog(lane.burn[i], 0.05, 2000, top, plotBot);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  // Alert-Lanes: Feuer-Segmente als Balken (bis Playhead geklippt)
  const tCut = simT();
  const laneOrder = ["fast", "slow", "ticket", "naive"];
  laneOrder.forEach((key, k) => {
    const lane = data.lanes.find((l) => l.key === key);
    const y = plotBot + 6 + k * LANE_H;
    ctx.fillStyle = cssVar("--br-muted");
    ctx.font = `8px ${MONO}`;
    ctx.fillText(key === "naive" ? "naiv" : lane.label, 4, y + 7);
    ctx.fillStyle = laneColor(key);
    for (const [s0, s1] of lane.segments) {
      if (s0 > tCut) break;
      ctx.fillRect(
        xOf(s0),
        y,
        Math.max(1.2, xOf(Math.min(s1, tCut)) - xOf(s0)),
        LANE_H - 3,
      );
    }
  });
  playheadLine(ctx, plotBot);
}

function drawBudget() {
  const c = budCanvas.value;
  if (!c || !W || !data) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, budH);
  xGrid(ctx, budH, false);
  const top = 6,
    bot = budH - 8;
  const yOf100 = (v) => bot - (v / 100) * (bot - top);
  ctx.fillStyle = cssVar("--br-muted");
  ctx.font = `9px ${MONO}`;
  ctx.fillText("100 %", 4, yOf100(100) + 3);
  ctx.fillText("50 %", 4, yOf100(50) + 3);
  ctx.fillText("Error-Budget übrig", PAD.l + 6, 10);
  if (phase.value === "predict") {
    hintText(ctx, budH, "…und wie viel Budget ist dann noch übrig?");
    return;
  }
  const st = strideOf();
  const im = iMax();
  ctx.strokeStyle = cssVar("--br-budget");
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= im; i += st) {
    const x = xOf(i * data.dt);
    const y = yOf100(data.remaining[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Feuer-Marker der Policy-Alerts
  const tCut = simT();
  for (const ev of data.events) {
    if (ev.key === "naive" || ev.t > tCut) continue;
    const x = xOf(ev.t);
    ctx.strokeStyle = laneColor(ev.key);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = laneColor(ev.key);
    ctx.font = `600 9px ${MONO}`;
    ctx.fillText(`${fmt(ev.remaining, 1)} %`, x + 3, top + 8);
  }
  playheadLine(ctx, budH);
}
function drawAll() {
  drawErr();
  drawBurn();
  drawBudget();
}

function updateReadout() {
  if (!data) return;
  const i = iMax();
  const fast = data.lanes.find((l) => l.key === "fast");
  const ticket = data.lanes.find((l) => l.key === "ticket");
  readout.value = {
    t: simT(),
    err: data.err[i],
    burnFast: fast.burn[i],
    burnTicket: ticket.burn[i],
    remaining: data.remaining[i],
  };
}

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
onMounted(() => {
  recompute();
  sizeCanvases();
  resizeObs = new ResizeObserver(sizeCanvases);
  if (chartWrap.value) resizeObs.observe(chartWrap.value);
});
onUnmounted(() => {
  resizeObs?.disconnect();
});
</script>

<template>
  <SimShell
    eyebrow="SLO & Error-Budget · Predict first"
    title="Burn-Rate-Alerts: drei Fehlerbilder, eine Policy"
    :subtitle="subtitle"
    presets-label="Szenario:"
    :presets="presets"
    gear-title="Experimentieren"
    :model-value="scenario"
    @update:model-value="selectScenario"
  >
    <template #transport>
      <button class="br-btn br-primary" :disabled="!canPlay" @click="onPlay">
        {{ playing ? "⏸ Pause" : "▶ Abspielen" }}
      </button>
      <input
        class="br-scrub"
        type="range"
        min="0"
        :max="1000"
        step="1"
        :value="playhead"
        :disabled="phase === 'predict'"
        aria-label="Zeit scrubben"
        @input="(e) => transport.scrub(+e.target.value)"
      />
      <span class="br-clock" :title="speedLabel">t = {{ fmtT(simT()) }}</span>
    </template>

    <template #stage>
      <div class="br-stage">
        <Tabs
          class="br-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="br-charts">
          <div
            class="br-quiz"
            :class="{ 'br-quiz-locked': phase !== 'predict' }"
          >
            <span class="br-q">1 · Wer feuert zuerst?</span>
            <button
              v-for="o in Q1"
              :key="o.key"
              class="br-chip"
              :class="{ 'br-chip-on': guessFirst === o.key }"
              :disabled="phase !== 'predict'"
              :aria-pressed="guessFirst === o.key"
              @click="guessFirst = o.key"
            >
              {{ o.label }}
            </button>
            <span class="br-q br-q2">2 · Budget beim 1. Alarm?</span>
            <button
              v-for="o in Q2"
              :key="o.key"
              class="br-chip"
              :class="{ 'br-chip-on': guessBudget === o.key }"
              :disabled="phase !== 'predict'"
              :aria-pressed="guessBudget === o.key"
              @click="guessBudget = o.key"
            >
              {{ o.label }}
            </button>
            <button
              v-if="phase === 'predict' && !guessSkipped"
              class="br-btn br-linkish"
              @click="skipGuess"
            >
              ohne Tipp abspielen
            </button>
          </div>
          <div class="br-chartbox">
            <canvas ref="errCanvas" aria-label="Fehlerrate über Zeit (log)" />
          </div>
          <div class="br-chartbox">
            <canvas
              ref="burnCanvas"
              aria-label="Burn-Raten je Alert-Fenster (log) und Feuer-Segmente"
            />
          </div>
          <div class="br-chartbox">
            <canvas ref="budCanvas" aria-label="Error-Budget übrig über Zeit" />
          </div>
          <div class="br-strip">
            <span v-if="readout" class="br-readouts">
              Fehler <b>{{ fmt(readout.err * 100, 2) }} %</b> · Burn
              <b>{{ fmt(readout.burnFast, 1) }}×</b> (1 h) ·
              <b>{{ fmt(readout.burnTicket, 1) }}×</b> (3 d) · Budget
              <b :class="{ bad: readout.remaining < 60 }"
                >{{ fmt(readout.remaining, 1) }} %</b
              >
            </span>
            <span class="br-legend">
              <span><i class="sw f" /> Fast Page</span>
              <span><i class="sw s" /> Slow Page</span>
              <span><i class="sw t" /> Ticket</span>
              <span><i class="sw n" /> naiv (5 min)</span>
              <span><i class="sw b" /> Budget</span>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="br-explain">
          <div class="br-table">
            <div class="br-tr br-th">
              <span>Alert</span><span>Schwelle</span
              ><span>Fenster (lang + kurz)</span><span>Budget beim Feuern</span
              ><span>Detektion bei 1000× / 3×</span>
            </div>
            <div class="br-tr">
              <span>Fast Page</span><span class="mono">14,4×</span
              ><span class="mono">1 h + 5 min</span><span class="mono">2 %</span
              ><span class="mono">52 s / nie</span>
            </div>
            <div class="br-tr">
              <span>Slow Page</span><span class="mono">6×</span
              ><span class="mono">6 h + 30 min</span
              ><span class="mono">5 %</span
              ><span class="mono">2,2 min / nie</span>
            </div>
            <div class="br-tr">
              <span>Ticket</span><span class="mono">1×</span
              ><span class="mono">3 d + 6 h</span><span class="mono">10 %</span
              ><span class="mono">4,3 min / 24 h</span>
            </div>
          </div>
          <p>
            <b>Die Invariante:</b> Bei konstantem Burn B ≥ θ bindet das lange
            Fenster — Detektionszeit = <span class="mono">θ·W/B</span>, also
            Budget-Verbrauch beim Feuern = <span class="mono">θ·W/720 h</span> —
            <b>unabhängig von B</b>: 2 % / 5 % / 10 % by design. Deshalb sind
            die Antwort-Chips oben genau diese Werte.
          </p>
          <p>
            <b>Warum zwei Fenster (gewollte Hysterese):</b> das lange Fenster
            <b>integriert</b> (feuern ohne Flattern — der naive 5-min-Alert
            zeigt das Gegenteil), das kurze setzt <b>schnell zurück</b>: Beim
            Spike wäre die Fast Page ohne Kurzfenster noch ≈ 59 min nach dem
            Ende aktiv, mit Kurzfenster ≈ 5 min. Dieselbe
            Doppelschwellen-Mechanik wie der Recovery Threshold im Kapitel
            „Systeme mit Gedächtnis" — hier als Alerting-Werkzeug.
          </p>
          <p class="br-foot">
            <b>Bewusste Vereinfachungen:</b> Zeitraffer ×270 (Spike) bzw. ×12
            960 (72-h-Szenarien); ideal berechnete rollende Fenster
            (Prometheus-Recording-Rules nähern das an); gleichmäßiger Traffic —
            kein Tagesgang, kein Low-Traffic-Problem; rollierendes 30-d-Budget,
            Start bei 100 %; Fehlerraten seeded verrauscht (±8 %), das Verdict
            nutzt die berechneten Ereignisse.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="br-gear">
        <QueueSlider
          :model-value="sloPct"
          label="SLO-Ziel"
          :min="99.0"
          :max="99.9"
          :step="0.1"
          unit=" %"
          @update:model-value="(v) => (sloPct = v)"
        />
        <QueueSlider
          :model-value="intensity"
          label="Intensität"
          :min="0.25"
          :max="2"
          :step="0.25"
          unit="×"
          @update:model-value="(v) => (intensity = v)"
        />
        <QueueSlider
          :model-value="fastWinMin"
          label="Fast-Fenster (lang)"
          :min="5"
          :max="120"
          :step="5"
          unit=" min"
          @update:model-value="(v) => (fastWinMin = v)"
        />
        <p class="br-gear-hint">
          SLO 99 % auf „Schleichend“: dieselbe Störung, totale Stille (Burn
          ÷10). Fast-Fenster 5 min: die „richtige“ Page flattert wie die naive.
          Intensität ×2 auf „Flattern“: die Slow Page kommt dazu — wieder bei ≈
          95 % (Invariante!).
        </p>
        <div class="br-gear-btns">
          <button class="br-btn br-primary" @click="rerun(true)">
            Nochmal (neuer Seed)
          </button>
          <button class="br-btn" @click="rerun(false)">Gleicher Seed</button>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="verdict" class="br-banner" :class="`br-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
      </div>
      <div v-else-if="phase === 'predict'" class="br-hint">
        Zwei Tipps oben abgeben (oder „ohne Tipp abspielen“), dann ▶ — die
        Fehlerraten-Kurve ist die Aufgabe, der Rest deckt sich beim Abspielen
        auf.
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette im Deck-Stil; Lane-Farben für Fast/Slow/Ticket/naiv. */
.br-stage,
.br-charts,
.br-explain {
  --br-paper: #e9eeea;
  --br-panel: #fcfdfc;
  --br-ink: #16282c;
  --br-muted: #5c6b6a;
  --br-grid-m: #c6d3cb;
  --br-err: #16282c;
  --br-fast: #c0392b;
  --br-slow: #c8912f;
  --br-ticket: #0b7285;
  --br-naive: #8a97a5;
  --br-budget: #3d7a46;
}
:global(html.dark .br-stage),
:global(html.dark .br-charts),
:global(html.dark .br-explain) {
  --br-paper: #101a1c;
  --br-panel: #0d1517;
  --br-ink: #dce8e6;
  --br-muted: #8fa3a0;
  --br-grid-m: #2d4246;
  --br-err: #dce8e6;
  --br-fast: #e06a5a;
  --br-slow: #d9a62e;
  --br-ticket: #37b6cf;
  --br-naive: #7d8b99;
  --br-budget: #69b877;
}

.br-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.br-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.br-chartbox {
  background: var(--br-panel);
  border: 1px solid var(--br-grid-m);
  border-radius: 8px;
  padding: 3px;
}
.br-chartbox canvas {
  display: block;
  width: 100%;
}

/* Tipp-Chips */
.br-quiz {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 10px;
}
.br-q {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--br-muted);
  font-weight: 600;
}
.br-q2 {
  margin-left: 10px;
}
.br-chip {
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--br-panel);
  color: inherit;
  border: 1px solid var(--br-grid-m);
}
.br-chip-on {
  border-color: var(--br-ticket);
  box-shadow: inset 0 0 0 1px var(--br-ticket);
  font-weight: 650;
}
.br-quiz-locked .br-chip:not(.br-chip-on) {
  opacity: 0.45;
}
.br-chip:disabled {
  cursor: default;
}

.br-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.br-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--br-muted);
}
.br-readouts b {
  color: var(--br-ink);
  font-weight: 600;
}
.br-readouts b.bad {
  color: var(--br-fast);
}
.br-legend {
  display: flex;
  gap: 9px;
  font-size: 9px;
  color: var(--br-muted);
}
.br-legend .sw {
  display: inline-block;
  width: 13px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.br-legend .sw.f {
  background: var(--br-fast);
}
.br-legend .sw.s {
  background: var(--br-slow);
}
.br-legend .sw.t {
  background: var(--br-ticket);
}
.br-legend .sw.n {
  background: var(--br-naive);
}
.br-legend .sw.b {
  background: var(--br-budget);
}

/* Transport */
.br-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--br-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--br-grid-m, #c6d3cb);
}
.br-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.br-primary {
  border-color: var(--br-budget, #3d7a46);
  font-weight: 600;
}
.br-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}
.br-scrub {
  width: 130px;
  accent-color: var(--br-ticket, #0b7285);
}
.br-clock {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  opacity: 0.8;
  white-space: nowrap;
}

/* Erklärung */
.br-explain {
  max-height: 380px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--br-ink);
  padding-right: 6px;
}
.br-explain p {
  margin: 0 0 8px;
}
.br-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.br-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  font-size: 10px;
}
.br-tr {
  display: grid;
  grid-template-columns: 1fr 0.8fr 1.4fr 1.2fr 1.4fr;
  gap: 8px;
  padding: 2px 6px;
  border-radius: 5px;
}
.br-tr:nth-child(even) {
  background: var(--br-panel);
}
.br-th {
  font-weight: 650;
  color: var(--br-muted);
}
.br-foot {
  font-size: 9px;
  color: var(--br-muted);
}

/* ⚙ */
.br-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 280px;
}
.br-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.br-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer */
.br-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.br-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.br-banner > b {
  margin-right: 5px;
}
.br-ok {
  border-color: #3d7a46;
}
.br-warn {
  border-color: #c8912f;
}
.br-bad {
  border-color: #af3e1b;
}
.br-info {
  border-color: #0891b2;
}
.br-hint {
  font-size: 10px;
  opacity: 0.7;
  padding: 2px 2px 0;
}
</style>
