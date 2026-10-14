<script setup>
/**
 * MM1Simulator.vue — M/M/1-„Kantine“ als Grafana-Dashboard: Welche Metrik
 * zeigt das Problem? Kantine (Illustration) + XY-Chart (Phasenraum, Wq über ρ)
 * + Gauge/Stat-Panels + Zeitreihen. Metriken nach Golden Signals an-/abwählbar
 * (MetricPicker); Zeitbereich „1m · 5m · seit Änderung“ macht das lange
 * Einschwingen sichtbar, die Marke „3τ“ zeigt, wie weit es noch ist.
 * Engine bleibt außerhalb der Vue-Reaktivität; eine RAF-Loop liest
 * paused/speed live und schreibt alle 140 ms eine Probe in die MetricHistory.
 * Szenario-Modus (Default): nur die Kantine und ihre Steuerung sind aktiv, das
 * Dashboard steht als Skelett da — erst das Szenario erklären, dann aufdecken.
 * Gemessen wird trotzdem, beim Aufdecken sind die Zeitreihen schon gefüllt.
 */
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from "vue";
import { foodFor } from "./lib/queueing.js";
import {
  MM1Engine,
  MM1_WINDOW,
  XY,
  ST,
  drawXY,
  spawn,
} from "./lib/mm1Engine.js";
import { useGrafanaPalette } from "./lib/grafanaPalette";
import { useInfoPopover } from "./lib/useInfoPopover";
import { MetricHistory } from "./lib/metricHistory";
import { CounterRate } from "./lib/counterRate";
import { METRICS } from "./lib/metrics";
import QueueSlider from "./QueueSlider.vue";
import InfoPopover from "./InfoPopover.vue";
import MetricPicker from "./MetricPicker.vue";
import GrafanaGauge from "./GrafanaGauge.vue";
import GrafanaStat from "./GrafanaStat.vue";
import GrafanaTimeSeries from "./GrafanaTimeSeries.vue";

const props = defineProps({
  /** Beim Laden aktive Metriken: Auslastung und Durchsatz sehen harmlos aus. */
  initialMetrics: { type: Array, default: () => ["thr", "rho"] },
  /** Start im Szenario-Modus: Dashboard als Skelett, nur die Kantine aktiv. */
  initialScenario: { type: Boolean, default: true },
});

const C = useGrafanaPalette();
const { info, toggle } = useInfoPopover();

const FONTS = {
  MONO: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  SANS: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
};
const RHO_PRESETS = [0.5, 0.8, 0.9, 0.95, 1.05];
const SPEED_PRESETS = [2, 10, 50, 100];
const AVAILABLE = ["wq", "t", "thr", "rho", "queue"];

/* ---- reaktiver Zustand (UI-Wahrheit) ---- */
const lambda = ref(0.6);
const mu = ref(1.0);
const speed = ref(2);
const paused = ref(true);
const controlsOpen = ref(false);
const active = ref(AVAILABLE.filter((k) => props.initialMetrics.includes(k)));
const scenario = ref(props.initialScenario);
const rangeKey = ref("since");
const logY = ref(false);

const entities = shallowRef([]);
const live = shallowRef({
  inService: false,
  food: "",
  remaining: 0,
  overflow: 0,
  lqTheory: null,
});
const readout = shallowRef({
  rho: 0.6,
  rhoMeas: 0,
  thr: 0,
  wqN: 0,
  tN: 0,
  queue: 0,
  settleTarget: 0,
  served: 0,
  progress: 0,
  stable: true,
});
/** Zählt Proben hoch; die Dashboard-Computeds hängen daran. */
const sampleTick = ref(0);

/* ---- nicht-reaktive Holder (niemals ref/reactive — 1e6 Mutationen/s) ---- */
const engine = new MM1Engine(0.6, 1.0);
const history = new MetricHistory(AVAILABLE);
/** Zähler wie ein Exporter; Durchsatz/Auslastung = rate(…[5m]). */
const rates = new CounterRate();
const RATE_WINDOW = 300;
const vis = new Map();
let trail = [];
const xyCanvas = ref(null);
let ctx = null;
let raf = 0;
let last = 0;
let lastSample = 0;

const fmtRho = (r) => r.toFixed(2).replace(".", ",");
/** Annotation je Parameteränderung; Slider-Ziehen erzeugt nur eine. */
function markChange() {
  const rho = engine.lambda / engine.mu;
  const label = `ρ → ${fmtRho(rho)}`;
  const a = history.annotations[history.annotations.length - 1];
  if (a && engine.clock - a.t < 2) {
    a.label = label;
    a.t = engine.clock;
  } else history.annotate(engine.clock, label);
  engine.markChange();
}
watch(lambda, (v) => {
  engine.lambda = v;
  engine.nextArrival = engine.clock + engine.expo(v);
  markChange();
});
watch(mu, (v) => {
  engine.mu = v;
  markChange();
});

function reset() {
  engine.reset();
  history.reset();
  rates.reset();
  vis.clear();
  trail = [];
  sampleTick.value++;
}
function setRho(rr) {
  lambda.value = +(rr * mu.value).toFixed(3);
}

/* ---- Theorie je Metrik (null = kein Gleichgewicht) ---- */
function theoryOf(key, rho, lam, m) {
  if (rho >= 1) return key === "rho" ? 1 : key === "thr" ? m : null;
  switch (key) {
    case "rho":
      return rho;
    case "thr":
      return lam;
    case "queue":
      return (rho * rho) / (1 - rho);
    case "wq":
      return rho / (1 - rho);
    case "t":
      return 1 / (1 - rho);
  }
  return null;
}

const fmt1 = (v) =>
  !Number.isFinite(v)
    ? "∞"
    : v >= 99.5
      ? v.toFixed(0)
      : v >= 9.95
        ? v.toFixed(0)
        : v.toFixed(1);
const FMT = {
  rho: (v) => (v * 100).toFixed(0) + " %",
  thr: (v) => v.toFixed(2),
  queue: (v) => (Number.isInteger(v) ? v.toFixed(0) : fmt1(v)),
  wq: fmt1,
  t: fmt1,
};

/* ---- Dashboard-Daten (aus der History, je Probe neu) ---- */
const dash = computed(() => {
  void sampleTick.value;
  const r = readout.value;
  const rho = r.rho;
  const lam = lambda.value;
  const m = mu.value;
  const now = history.lastT;
  let [t0, t1] = history.window(rangeKey.value, now);
  // „seit Änderung“: Fenster reicht bis zur Einschwing-Marke 3τ, damit man
  // sieht, wie viel Weg noch vor einem liegt (Grafana: „now+…“).
  const settleT = settleTime.value;
  const markers = [];
  if (rangeKey.value === "since" && settleT != null) {
    const tm = history.lastChange() + settleT;
    t1 = Math.max(t1, tm);
    markers.push({ t: tm, label: "3τ ≈ eingeschwungen" });
  }
  // Im Szenario-Modus zeigen die Panels nur das Skelett — nichts zu rechnen.
  const skip = scenario.value;
  const panels = {};
  for (const key of AVAILABLE) {
    const th = theoryOf(key, rho, lam, m);
    panels[key] = {
      key,
      theory: th,
      spark: skip ? [] : history.series(key, t0, Math.min(t1, now), 40),
      rows: skip ? [] : history.series(key, t0, t1, 200),
    };
  }
  return { t0, t1, now, markers, panels };
});

const values = computed(() => {
  const r = readout.value;
  return { rho: r.rhoMeas, thr: r.thr, queue: r.queue, wq: r.wqN, t: r.tN };
});

function theoryText(key) {
  const th = dash.value.panels[key].theory;
  if (th == null) return "Theorie → ∞";
  return `Theorie ${FMT[key](th)}`;
}

const statPanels = computed(() =>
  AVAILABLE.filter((k) => k !== "rho").map((key) => {
    const p = dash.value.panels[key];
    const def = METRICS[key];
    return {
      key,
      title: def.label,
      help: def.help,
      unit: def.unit,
      dim: !active.value.includes(key),
      values: [
        { text: FMT[key](values.value[key]), color: C.value.series[key] },
      ],
      sparks: [{ pts: p.spark, color: C.value.series[key] }],
      theory: p.theory,
      sub: theoryText(key),
    };
  }),
);

const tsRows = computed(() =>
  active.value.map((key) => {
    const p = dash.value.panels[key];
    const def = METRICS[key];
    return {
      key,
      title: def.label,
      unit: def.unit === "%" ? def.signal : `${def.signal} · ${def.unit}`,
      series: [{ name: def.label, color: C.value.series[key], pts: p.rows }],
      theory: [{ value: p.theory, label: theoryText(key) }],
      fixedMax: key === "rho" ? 1 : undefined,
      logAllowed: key === "wq" || key === "t" || key === "queue",
      fmt: FMT[key],
    };
  }),
);

const HELP = {
  kantine:
    "Gäste kommen links an (Rate λ), warten in der Schlange, werden vom einen 🧑‍🍳 bedient (Rate μ) und gehen rechts. Essen-Emoji = Bedienlänge (🍎 kurz … 🍱 lang), „Xs“ = Restzeit am Koch, „+N“ = zusätzlich Wartende über die gezeichneten hinaus. Die cyan gestrichelte Marke „Lq≈“ ist die theoretische mittlere Schlangenlänge ρ²/(1−ρ).",
  xy: "XY-Chart (Phasenraum) wie in Grafana: zwei Metriken gegeneinander statt gegen die Zeit. Cyan = Theorie Wq = ρ/(1−ρ), glatt, keine Klippe bei 80 %. Der Punkt ist der aktuelle Messwert bei deinem ρ, mit verblassender Spur. Nach einer Änderung springt er seitlich (neues ρ) und klettert dann langsam zur Kurve. Bei ρ ≥ 1 verlässt er das Feld nach oben: kein Gleichgewicht.",
  ts: "Zeitreihen der gewählten Metriken (Small Multiples, je Einheit eine Zeile). Linie = Mittel je Pixel, Band = Min/Max, gestrichelt = Theorie-Mittel. Die blaue Annotation markiert die letzte Parameteränderung. „seit Änderung“ reicht bis zur gelben Marke 3τ: Erst dort ist das System praktisch eingeschwungen. τ wächst dramatisch nahe ρ = 1: bei 0,9 etwa 340 Gäste, bei 0,95 etwa 1500. „Y: log“ skaliert Zeiten und Queue-Länge logarithmisch, wie Grafanas Axis → Scale. Ältere Werte werden wie bei RRDtool zusammengefasst (Min/Max/Mittel), damit lange Läufe flüssig bleiben.",
  settle:
    "Einschwing-Fortschritt seit der letzten Änderung: bediente Gäste gegen ~3τ (Relaxationszeit τ ≈ ρ/(1−√ρ)² Gäste). Bis dahin weicht der Messwert systematisch vom Theorie-Mittel ab — ein Dashboard, das direkt nach einer Änderung abgelesen wird, zeigt die alte Welt.",
};

/* ---- Lq-Theorie-Marker an der Schlange ---- */
const lqMarker = computed(() => {
  const lq = live.value.lqTheory;
  if (lq === Infinity) return { inf: true };
  if (lq != null && lq > 0.05) {
    const rawX = ST.qFrontX - lq * ST.qSlot;
    const x = Math.max(ST.qLeft, rawX);
    return {
      inf: false,
      x,
      off: rawX < ST.qLeft,
      label: `Lq≈${lq.toFixed(1)}${rawX < ST.qLeft ? " ⟵" : ""}`,
    };
  }
  return null;
});

// „+N“-Badge sitzt mittig zwischen vorderen (Slot 0–4) und hinteren (Slot 8–12) Emojis.
const badgeX = ST.qFrontX - 6 * ST.qSlot;
const lineY = ST.lineY;

/* ---- Einschwingen ---- */
/** Sim-Zeit bis 3τ ab der letzten Änderung, oder null bei ρ ≥ 1. */
const settleTime = computed(() => {
  const r = readout.value;
  if (!r.stable || !Number.isFinite(r.settleTarget)) return null;
  return r.settleTarget / Math.max(1e-9, lambda.value);
});
const settle = computed(() => {
  const r = readout.value;
  if (!r.stable) return { stable: false };
  return {
    stable: true,
    done: r.progress >= 1,
    target: Math.round(r.settleTarget),
    served: r.served,
    progress: r.progress,
  };
});

function btnStyle(border) {
  return {
    background: C.value.panelHi,
    color: C.value.textHi,
    border: `1px solid ${border}`,
  };
}
function presetStyle(rr) {
  const border =
    rr >= 1 ? C.value.crit : rr >= 0.9 ? C.value.warn : C.value.border;
  return btnStyle(border);
}
function speedStyle(s) {
  return btnStyle(speed.value === s ? C.value.accent : C.value.border);
}

/* ---- RAF-Loop ---- */
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused.value) engine.advance(engine.clock + dtReal * speed.value);

  // Visuelle Reconciliation — „+N“ mittig: vordere 5 + hintere 5 mit Lücke.
  const present = new Set();
  const meanS = 1 / engine.mu;
  const qlen = engine.queue.length;
  const FRONT = 5,
    BACK = 5,
    drawCap = ST.qMaxDraw;
  const hiddenCount = Math.max(0, qlen - (FRONT + BACK)) + engine.overflow;
  const place = (c, slot) => {
    present.add(c.id);
    let v = vis.get(c.id);
    if (!v) {
      v = spawn(c.id);
      vis.set(c.id, v);
    }
    v.tx = ST.qFrontX - slot * ST.qSlot;
    v.ty = ST.lineY;
    v.draw = true;
    v.state = "queue";
  };
  if (hiddenCount > 0) {
    for (let i = 0; i < FRONT; i++) place(engine.queue[i], i);
    for (let p = 0; p < BACK; p++)
      place(engine.queue[qlen - BACK + p], drawCap - BACK + p);
  } else {
    const cap = Math.min(qlen, drawCap);
    for (let i = 0; i < cap; i++) place(engine.queue[i], i);
  }
  if (engine.inService) {
    const c = engine.inService;
    present.add(c.id);
    let v = vis.get(c.id);
    if (!v) {
      v = spawn(c.id);
      vis.set(c.id, v);
    }
    v.tx = ST.serviceX;
    v.ty = ST.serviceY;
    v.draw = true;
    v.state = "service";
  }
  for (const [id, v] of vis) {
    if (!present.has(id) && v.state !== "leaving") {
      v.state = "leaving";
      v.tx = ST.W + 60;
      v.ty = 120 + Math.random() * 150;
      v.draw = true;
    }
  }
  // Bei hohem Zeitraffer ohne Flug-Animation: Gäste springen an ihren Platz,
  // Gehende verschwinden sofort — sonst wimmelt die Bühne vor Emojis.
  const instant = speed.value > 10;
  const k = instant ? 1 : 1 - Math.exp(-6 * dtReal);
  const out = [];
  for (const [id, v] of vis) {
    v.x += (v.tx - v.x) * k;
    v.y += (v.ty - v.y) * k;
    if (v.state === "leaving" && (instant || v.x > ST.W + 40)) {
      vis.delete(id);
      continue;
    }
    v.opacity = v.state === "leaving" ? Math.max(0, 1 - (v.x - ST.W) / 100) : 1;
    if (v.draw)
      out.push({ id, x: v.x, y: v.y, emoji: v.emoji, opacity: v.opacity });
  }

  // XY-Chart
  const rhoSet = engine.lambda / engine.mu;
  const wq = engine.meanWq(MM1_WINDOW);
  const yMeas = wq == null ? null : wq * engine.mu;
  const over = yMeas != null && yMeas > XY.YMAX;
  if (!paused.value && yMeas != null)
    trail.push({ rho: rhoSet, y: yMeas, ts: now });
  for (let i = trail.length - 1; i >= 0; i--)
    trail[i].alpha = Math.max(0, 1 - (now - trail[i].ts) / 2200);
  while (trail.length && now - trail[0].ts > 2200) trail.shift();
  if (ctx && !scenario.value)
    drawXY(ctx, C.value, FONTS, trail, rhoSet, yMeas, over);

  const lqTheory = rhoSet < 1 ? (rhoSet * rhoSet) / (1 - rhoSet) : Infinity;
  entities.value = out;
  live.value = {
    inService: !!engine.inService,
    food: engine.inService ? foodFor(engine.inService.serviceTime, meanS) : "",
    remaining: engine.inService
      ? Math.max(0, engine.nextDeparture - engine.clock)
      : 0,
    overflow: hiddenCount,
    lqTheory,
  };

  if (now - lastSample > 140) {
    lastSample = now;
    rates.push(engine.clock, {
      dep: engine.numDepartures,
      busy: engine.busyTime,
    });
    const thr = rates.rate("dep", RATE_WINDOW) ?? 0;
    const rhoMeas = Math.min(1, rates.rate("busy", RATE_WINDOW) ?? 0);
    const w = engine.meanW(MM1_WINDOW);
    const tN = w == null ? null : w * engine.mu;
    const sqrtRho = Math.sqrt(rhoSet);
    const Ntau = rhoSet < 1 ? rhoSet / Math.pow(1 - sqrtRho, 2) : Infinity;
    const settleTarget = Ntau === Infinity ? Infinity : 3 * Ntau;
    const served = engine.numDepartures - engine.settleAnchorDep;
    const progress =
      settleTarget === Infinity ? 0 : Math.min(1, served / settleTarget);
    const queue = engine.Nq();
    readout.value = {
      rho: rhoSet,
      rhoMeas,
      thr,
      wqN: yMeas ?? 0,
      tN: tN ?? 0,
      queue,
      settleTarget,
      served,
      progress,
      stable: rhoSet < 1,
    };
    if (!paused.value && engine.numDepartures > 0) {
      history.push(engine.clock, {
        rho: rhoMeas,
        thr,
        queue,
        wq: yMeas,
        t: tN,
      });
    }
    sampleTick.value++;
  }
}

onMounted(() => {
  const cv = xyCanvas.value;
  if (cv) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = XY.W * dpr;
    cv.height = XY.H * dpr;
    ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
  }
  last = performance.now();
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <div
    class="sim-root"
    :style="{
      '--c-bg': C.bg,
      '--c-panel': C.panel,
      '--c-panelHi': C.panelHi,
      '--c-border': C.border,
      '--c-textHi': C.textHi,
      '--c-textMid': C.textMid,
      '--c-textLow': C.textLow,
    }"
  >
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="title">M/M/1 · Welche Metrik zeigt das Problem?</div>
        <div class="subtitle">
          Auslastung und Durchsatz bleiben ruhig — die Wartezeit explodiert nahe
          ρ = 1 und braucht lange, bis sie stimmt.
        </div>
      </div>
      <div class="header-btns">
        <button
          class="btn"
          data-scenario
          :aria-pressed="scenario"
          :style="btnStyle(scenario ? C.accent : C.border)"
          :title="
            scenario
              ? 'Graphen und Kennzahlen einblenden'
              : 'Nur die Kantine zeigen, Dashboard als Skelett'
          "
          @click="scenario = !scenario"
        >
          {{ scenario ? "📊 Dashboard" : "🎬 Szenario" }}
        </button>
        <button
          class="btn"
          :style="btnStyle(paused ? C.accent : C.border)"
          @click="paused = !paused"
        >
          {{ paused ? "▶ Weiter" : "⏸ Pause" }}
        </button>
        <button class="btn" :style="btnStyle(C.border)" @click="reset">
          ↻ Reset
        </button>
        <button
          class="btn"
          :style="btnStyle(controlsOpen ? C.accent : C.border)"
          :aria-expanded="controlsOpen"
          aria-controls="mm1-ctl"
          title="Regler ein-/ausblenden"
          @click="controlsOpen = !controlsOpen"
        >
          🛠️
        </button>
      </div>
    </div>

    <!-- Toolbar: ρ-Schnellwahl, Zeitraffer, Metriken — immer sichtbar -->
    <div class="toolbar">
      <div class="presets">
        <span class="presets-label">ρ:</span>
        <button
          v-for="rr in RHO_PRESETS"
          :key="rr"
          class="preset-btn"
          :data-rho="rr"
          :style="presetStyle(rr)"
          @click="setRho(rr)"
        >
          {{ rr.toFixed(2) }}
        </button>
        <span class="presets-label sep">Zeitraffer:</span>
        <button
          v-for="s in SPEED_PRESETS"
          :key="s"
          class="preset-btn"
          :data-speed="s"
          :style="speedStyle(s)"
          @click="speed = s"
        >
          {{ s }}×
        </button>
      </div>
      <div
        class="picker-wrap"
        :class="{ 'psk psk-flat': scenario }"
        :inert="scenario || undefined"
      >
        <MetricPicker v-model="active" :available="AVAILABLE" />
      </div>
    </div>

    <!-- Regler hinter 🛠️ (Overlay, verschiebt nichts) -->
    <div
      v-show="controlsOpen"
      id="mm1-ctl"
      class="controls"
      :style="{ background: C.panel, borderColor: C.border }"
    >
      <QueueSlider
        :model-value="lambda"
        label="Ankunftsrate λ"
        :min="0.05"
        :max="1.6"
        :step="0.01"
        unit="/s"
        @update:model-value="(v) => (lambda = v)"
      />
      <QueueSlider
        :model-value="mu"
        label="Bedienrate μ (Kapazität)"
        :min="0.3"
        :max="2.0"
        :step="0.01"
        unit="/s"
        @update:model-value="(v) => (mu = v)"
      />
      <QueueSlider
        :model-value="speed"
        label="Zeitraffer"
        :min="0.5"
        :max="100"
        :step="0.5"
        unit="×"
        @update:model-value="(v) => (speed = v)"
      />
    </div>

    <div class="top">
      <!-- links: Kantine + aktuelle Werte -->
      <div class="left">
        <div
          class="panel"
          :style="{ background: C.panel, borderColor: C.border }"
        >
          <div class="panel-head">
            <span class="panel-title">Kantine (Illustration)</span>
            <InfoPopover
              id="kantine"
              :active-id="info"
              title="Kantine (Illustration)"
              @toggle="toggle('kantine')"
            >
              {{ HELP.kantine }}
            </InfoPopover>
          </div>
          <svg :viewBox="`0 108 ${ST.W} 186`" class="stage-svg">
            <text
              v-for="lb in [
                [150, 'Ankunft (λ)'],
                [500, 'Warteschlange'],
                [790, 'Bedienung (μ)'],
                [935, 'Abgang'],
              ]"
              :key="lb[1]"
              :x="lb[0]"
              y="286"
              :fill="C.textLow"
              style="font-size: 17px"
              text-anchor="middle"
            >
              {{ lb[1] }}
            </text>

            <line
              x1="300"
              :y1="lineY + 26"
              x2="700"
              :y2="lineY + 26"
              :stroke="C.border"
              stroke-width="2"
            />
            <rect
              x="710"
              y="150"
              width="120"
              height="84"
              rx="8"
              :fill="C.panelHi"
              :stroke="live.inService ? C.accent : C.border"
            />
            <text x="790" y="205" style="font-size: 34px" text-anchor="middle">
              🧑‍🍳
            </text>

            <!-- Lq-Marker -->
            <text
              v-if="!scenario && lqMarker && lqMarker.inf"
              x="320"
              y="146"
              style="font-size: 15px"
              :fill="C.theory"
              class="sim-mono"
            >
              Lq → ∞
            </text>
            <g v-else-if="!scenario && lqMarker">
              <line
                :x1="lqMarker.x"
                y1="150"
                :x2="lqMarker.x"
                y2="236"
                :stroke="C.theory"
                stroke-width="1.5"
                stroke-dasharray="4 4"
                opacity="0.8"
              />
              <text
                :x="lqMarker.x"
                y="144"
                style="font-size: 15px"
                :fill="C.theory"
                class="sim-mono"
                :text-anchor="lqMarker.off ? 'start' : 'middle'"
              >
                {{ lqMarker.label }}
              </text>
            </g>

            <!-- Gäste -->
            <text
              v-for="e in entities"
              :key="e.id"
              :x="e.x"
              :y="e.y"
              style="font-size: 30px"
              text-anchor="middle"
              :style="{ opacity: e.opacity }"
            >
              {{ e.emoji }}
            </text>

            <!-- „+N“-Badge mittig in der Schlange, hervorgehoben -->
            <g v-if="live.overflow > 0">
              <rect
                :x="badgeX - 26"
                :y="lineY - 16"
                width="52"
                height="32"
                rx="9"
                :fill="C.warn"
              />
              <text
                :x="badgeX"
                :y="lineY + 6"
                text-anchor="middle"
                font-weight="700"
                :fill="C.bg"
                style="font-size: 17px"
                class="sim-mono"
              >
                +{{ live.overflow }}
              </text>
            </g>

            <!-- in Bedienung: Essen + Restzeit -->
            <template v-if="live.inService">
              <text
                x="790"
                y="142"
                style="font-size: 30px"
                text-anchor="middle"
              >
                {{ live.food }}
              </text>
              <text
                x="790"
                y="256"
                style="font-size: 16px"
                :fill="C.accent"
                text-anchor="middle"
                class="sim-mono"
              >
                {{ live.remaining.toFixed(1) }} s
              </text>
            </template>
          </svg>
        </div>

        <!-- aktuelle Werte: Gauge (begrenzt) + Stat (unbegrenzt) -->
        <div class="stats" :inert="scenario || undefined">
          <GrafanaStat
            v-for="p in statPanels.filter((x) => x.key !== 'queue')"
            :key="p.key"
            :data-panel="p.key"
            :title="p.title"
            :values="p.values"
            :unit="p.unit"
            :sparks="p.sparks"
            :range="[dash.t0, Math.min(dash.t1, dash.now)]"
            :theory="p.theory"
            :sub="p.sub"
            :dim="p.dim"
            :skeleton="scenario"
          >
            <template #info>
              <InfoPopover
                :id="'st-' + p.key"
                :active-id="info"
                :title="p.title"
                @toggle="toggle('st-' + p.key)"
                >{{ p.help }}</InfoPopover
              >
            </template>
          </GrafanaStat>
          <GrafanaGauge
            data-panel="rho"
            :title="METRICS.rho.label"
            :frac="values.rho"
            :text="(values.rho * 100).toFixed(0)"
            unit="%"
            :mark="Math.min(1, readout.rho)"
            :sub="`Soll ρ = ${fmtRho(readout.rho)}`"
            :dim="!active.includes('rho')"
            :skeleton="scenario"
          >
            <template #info>
              <InfoPopover
                id="st-rho"
                :active-id="info"
                :title="METRICS.rho.label"
                @toggle="toggle('st-rho')"
                >{{ METRICS.rho.help }}</InfoPopover
              >
            </template>
          </GrafanaGauge>
          <GrafanaStat
            v-for="p in statPanels.filter((x) => x.key === 'queue')"
            :key="p.key"
            :data-panel="p.key"
            :title="p.title"
            :values="p.values"
            :unit="p.unit"
            :sparks="p.sparks"
            :range="[dash.t0, Math.min(dash.t1, dash.now)]"
            :theory="p.theory"
            :sub="p.sub"
            :dim="p.dim"
            :skeleton="scenario"
          >
            <template #info>
              <InfoPopover
                :id="'st-' + p.key"
                :active-id="info"
                :title="p.title"
                @toggle="toggle('st-' + p.key)"
                >{{ p.help }}</InfoPopover
              >
            </template>
          </GrafanaStat>
        </div>
      </div>

      <!-- rechts: XY-Chart (Phasenraum) -->
      <div
        class="panel"
        :class="{ psk: scenario }"
        :inert="scenario || undefined"
        :style="{ background: C.panel, borderColor: C.border }"
      >
        <div class="panel-head">
          <span class="panel-title">
            XY-Chart (Phasenraum) · Wq über ρ:
            <span :style="{ color: C.theory }">Theorie</span> +
            <span :style="{ color: C.series.wq }">Messung</span>
          </span>
          <InfoPopover
            id="xy"
            :active-id="info"
            title="XY-Chart (Phasenraum)"
            @toggle="toggle('xy')"
          >
            {{ HELP.xy }}
          </InfoPopover>
        </div>
        <canvas ref="xyCanvas" class="xy-canvas" />
      </div>
    </div>

    <!-- Zeitreihen -->
    <GrafanaTimeSeries
      class="ts-panel"
      title="Time Series · gewählte Metriken"
      :skeleton="scenario"
      :inert="scenario || undefined"
      :rows="tsRows"
      :range="[dash.t0, dash.t1]"
      :now="dash.now"
      :range-key="rangeKey"
      :annotations="history.annotations"
      :markers="dash.markers"
      :log-y="logY"
      :plot-height="128"
      @update:range-key="(k) => (rangeKey = k)"
      @toggle-log="logY = !logY"
    >
      <template #info>
        <span
          class="settle"
          :style="{ color: settle.stable ? C.textMid : C.crit }"
          data-settle
        >
          <template v-if="!settle.stable"
            >ρ ≥ 1: kein Gleichgewicht, Schlange wächst unbegrenzt</template
          >
          <template v-else>
            Einschwingen {{ (settle.progress * 100).toFixed(0) }} %
            <span
              class="settle-bar"
              :style="{ background: C.panelHi }"
              aria-hidden="true"
              ><span
                :style="{
                  width: settle.progress * 100 + '%',
                  background: settle.done ? C.ok : C.warn,
                }"
            /></span>
            {{ settle.served }} / ~{{ settle.target }} Gäste (3τ)
          </template>
        </span>
        <InfoPopover
          id="ts"
          :active-id="info"
          title="Zeitverlauf & Einschwingen"
          @toggle="toggle('ts')"
        >
          {{ HELP.ts }} {{ HELP.settle }}
        </InfoPopover>
      </template>
    </GrafanaTimeSeries>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.sim-root {
  position: relative;
  background: var(--c-bg);
  color: var(--c-textHi);
  font-family: inherit;
  padding: 6px 10px 6px;
  max-width: 960px;
  margin: 0 auto;
  max-height: 540px;
  overflow-y: auto;
  border-radius: 6px;
}
.sim-root ::-webkit-scrollbar {
  width: 4px;
}
.sim-root ::-webkit-scrollbar-thumb {
  background: var(--c-border);
  border-radius: 2px;
}
.sim-mono {
  font-family: var(--slidev-code-font-family);
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.subtitle {
  font-size: 9.5px;
  color: var(--c-textMid);
  line-height: 1.35;
  max-width: 640px;
}
.header-btns {
  display: flex;
  gap: 6px;
}
.btn {
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
}

/* Toolbar */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}
.presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.presets-label {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textLow);
}
.presets-label.sep {
  margin-left: 10px;
}
.preset-btn {
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 10.5px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}

/* Controls — Overlay, belegt keinen Flussplatz */
.controls {
  position: absolute;
  left: 10px;
  right: 10px;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  border: 1px solid;
  border-radius: 6px;
  padding: 10px 14px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
}

/* Oben: links Kantine + Werte, rechts XY-Chart */
.top {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.panel {
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 6px 4px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.panel-title {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--c-textMid);
}
.stage-svg {
  width: 100%;
  height: auto;
  display: block;
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}
.xy-canvas {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 440 / 236;
}

/* Szenario-Modus: Größe bleibt, Inhalt unsichtbar, grauer Platzhalter. */
.psk {
  position: relative;
}
.psk > :not(.panel-head) {
  visibility: hidden;
}
.psk::after {
  content: "";
  position: absolute;
  inset: 18px 6px 5px;
  border-radius: 3px;
  background: var(--c-panelHi);
}
.psk.psk-flat::after {
  inset: 0;
}
.psk .panel-head :deep(.ip) {
  visibility: hidden;
}

/* Einschwingen im Kopf des Zeitreihen-Panels */
.settle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  font-family: var(--slidev-code-font-family);
  white-space: nowrap;
}
.settle-bar {
  display: inline-block;
  width: 60px;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
}
.settle-bar > span {
  display: block;
  height: 100%;
  transition: width 0.2s linear;
}
</style>
