<script setup>
/**
 * MM1Simulator.vue — M/M/1 „Kantine“: Stage (Gäste + Koch) + 5 Gauges
 * (Bogen=Messung, Strich=Theorie) + Phosphor-Scope (canvas) + Einschwing-Balken.
 * Port von mm1-simulator.jsx. Engine bleibt OUT of Vue-Reaktivität; eine RAF-Loop
 * liest paused/speed live. Slider hinter 🛠️, ρ-Presets immer sichtbar, „+N“ mittig.
 */
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from "vue";
import { foodFor } from "./lib/queueing.js";
import {
  MM1Engine,
  MM1_WINDOW,
  SCOPE,
  ST,
  drawScope,
  spawn,
} from "./lib/mm1Engine.js";
import { useScopeColors } from "./lib/useScopeColors";
import { useInfoPopover } from "./lib/useInfoPopover";
import QueueSlider from "./QueueSlider.vue";
import TheoryGauge from "./TheoryGauge.vue";
import InfoPopover from "./InfoPopover.vue";

const C = useScopeColors();
const { info, toggle } = useInfoPopover();

const FONTS = {
  MONO: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  SANS: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
};
const RHO_PRESETS = [0.5, 0.8, 0.9, 0.95, 1.0, 1.05];

/* ---- reaktiver Zustand (UI-Wahrheit) ---- */
const lambda = ref(0.6);
const mu = ref(1.0);
const speed = ref(2);
const paused = ref(true);
const controlsOpen = ref(false);

const entities = shallowRef([]);
const live = shallowRef({
  inService: false,
  food: "",
  remaining: 0,
  overflow: 0,
  lqTheory: null,
  shedTotal: 0,
  waterLeft: 0,
});
const readout = shallowRef({
  rho: 0.6,
  rhoMeas: 0,
  thr: 0,
  wqN: 0,
  wqTheo: null,
  N: 0,
  L: 0,
  little: 1,
  settleTarget: 0,
  served: 0,
  progress: 0,
  stable: true,
});

/* ---- nicht-reaktive Holder (niemals ref/reactive — 1e6 Mutationen/s) ---- */
const engine = new MM1Engine(0.6, 1.0);
const vis = new Map();
let trail = [];
const scopeCanvas = ref(null);
let ctx = null;
let raf = 0;
let last = 0;
let lastSample = 0;

/* ---- Fast-Forward: „Vorspulen“ bis zum Gleichgewicht ----
   Treibt die echte Engine über ein festes ~2,5-s-Fenster bis zum
   Einschwing-Horizont (3τ) — ρ-unabhängig, kein künstliches Random-Init. */
const ffActive = ref(false);
const ffSpeed = ref(0); // gemessene effektive Beschleunigung (× Echtzeit)
const ffBadge = shallowRef(null); // {label, opacity} — Overlay-Indikator
const canFF = computed(() => lambda.value / mu.value < 1); // ρ<1 nötig
let ffFrom = 0,
  ffTo = 0,
  ffStart = 0,
  ffFadeUntil = 0,
  ffSmooth = 0;
const FF_DUR = 2500;
function fmtSpeed(v) {
  // „19.800“ (de-DE), grob auf 3 signifikante Stellen gerundet
  if (v >= 1000) return (Math.round(v / 100) * 100).toLocaleString("de-DE");
  return Math.round(v).toLocaleString("de-DE");
}
function fastForward() {
  if (ffActive.value) return;
  const rho = engine.lambda / engine.mu;
  if (rho >= 1) return; // kein Gleichgewicht
  const Ntau = rho / (1 - Math.sqrt(rho)) ** 2;
  const horizon = (3 * Ntau) / Math.max(engine.lambda, 1e-3); // Sim-Sekunden
  ffFrom = engine.clock;
  ffTo = engine.clock + horizon;
  ffStart = performance.now();
  ffSpeed.value = 0;
  ffSmooth = 0;
  engine.markChange(); // Einschwing-Anker → Fortschrittsbalken füllt sich mit
  paused.value = true; // während FF steuern wir advance() selbst
  ffActive.value = true;
}

watch(lambda, (v) => {
  engine.lambda = v;
  engine.nextArrival = engine.clock + engine.expo(v);
  engine.markChange();
  ffActive.value = false; // Parameterwechsel bricht ein laufendes Vorspulen ab
});
watch(mu, (v) => {
  engine.mu = v;
  engine.markChange();
  ffActive.value = false;
});

function reset() {
  engine.reset();
  vis.clear();
  trail = [];
  busAnim = null;
  busView.value = null;
  ffActive.value = false;
  ffBadge.value = null;
}
function setRho(rr) {
  lambda.value = +(rr * mu.value).toFixed(3);
}

/* ---- Burst (Bus), Load- & Feature-Shedding — didaktische Aktionen ---- */
const BURST_N = 12;
const FEATURE_SHED_N = 30;
const BUS_STOP = { x: 150, y: 96 };
const busView = shallowRef(null); // {x, y, opacity} für die SVG-Anzeige
let busAnim = null; // {t0, injected} — Zeitachse in Realzeit, unabhängig vom Sim-Takt

function burst() {
  if (busAnim) return; // ein Bus reicht
  busAnim = { t0: performance.now(), injected: false };
}
function shed() {
  const { dropped } = engine.shedQueue();
  for (const c of dropped) {
    const v = vis.get(c.id);
    if (!v) continue;
    v.state = "shed";
    v.tx = v.x + (Math.random() * 60 - 30);
    v.ty = ST.H + 70; // nach unten aus dem Bild
  }
}
function featureShed() {
  engine.featureShed(FEATURE_SHED_N);
}

/* Bus-Zeitachse: anfahren (0–0,9 s) → halten & 🤖 aussteigen lassen
   (0,9–1,9 s, Injektion beim Halt) → zurück nach links (1,9–2,8 s). */
function tickBus(now) {
  if (!busAnim) return;
  const t = (now - busAnim.t0) / 1000;
  if (t < 0.9) {
    const e = 1 - Math.pow(1 - t / 0.9, 3);
    busView.value = {
      x: -80 + (BUS_STOP.x + 80) * e,
      y: BUS_STOP.y,
      opacity: 1,
    };
  } else if (t < 1.9) {
    if (!busAnim.injected) {
      busAnim.injected = true;
      engine.injectBurst(BURST_N, { robot: true });
    }
    busView.value = { x: BUS_STOP.x, y: BUS_STOP.y, opacity: 1 };
  } else if (t < 2.8) {
    const p = (t - 1.9) / 0.9;
    busView.value = {
      x: BUS_STOP.x - (BUS_STOP.x + 80) * p * p,
      y: BUS_STOP.y,
      opacity: 1 - p * 0.3,
    };
  } else {
    busAnim = null;
    busView.value = null;
  }
}

/* ---- abgeleitete Anzeige ---- */
const rhoColor = computed(() => {
  const r = readout.value.rho;
  return r < 0.7 ? C.value.phosphor : r < 0.9 ? C.value.amber : C.value.red;
});
const wqColor = computed(() => {
  const w = readout.value.wqN;
  return w < 4 ? C.value.phosphor : w < 9 ? C.value.amber : C.value.red;
});
const littleOk = computed(() => Math.abs(readout.value.little - 1) < 0.12);

const HELP = {
  kantine:
    "Gäste kommen links an (Rate λ), warten in der Schlange, werden vom einen 🧑‍🍳 bedient (Rate μ) und gehen rechts. Essen-Emoji = Bedienlänge (🍎 kurz … 🍱 lang), „Xs“ = Restzeit am Koch, „+N“ = zusätzlich Wartende über die gezeichneten hinaus. Die cyan gestrichelte Marke „Lq≈“ ist die theoretische mittlere Schlangenlänge ρ²/(1−ρ).",
  scope:
    "Wartezeit Wq über der Auslastung ρ. Cyan Kurve = Theorie ρ/(1−ρ) (glatt — keine Klippe bei 80 %!), leuchtender Punkt = aktueller Messwert bei deinem ρ, mit nachleuchtender Spur. Bei ρ≥1 verlässt er das Feld nach oben — kein Gleichgewicht.",
  settle:
    "Wie weit das System seit der letzten Parameteränderung eingependelt ist, gemessen in bedienten Kunden gegen ~3τ (Relaxationszeit). τ wächst dramatisch nahe ρ=1: ρ=0,9 ≈ 340 Kunden, 0,95 ≈ 1500. Voller Balken ≈ praktisch eingeschwungen; die Amber-Marke ist 1τ (≈63 %).",
  "g-rho":
    "Anteil der Zeit, in der der Koch beschäftigt ist (gemessen). Bogen = Messung, cyan Strich = Sollwert ρ = λ/μ. Bei ρ<1 pendelt sich der Bogen auf den Strich ein.",
  "g-thr":
    "Tatsächlich bediente Gäste pro Sekunde (gemessen). Im Gleichgewicht (ρ<1) gleich der Ankunftsrate λ — der Koch schafft genau das, was reinkommt. Strich = ρ als Anteil der Kapazität μ.",
  "g-wq":
    "Mittlere reine Wartezeit vor der Bedienung, in Vielfachen einer Bedienzeit (×Bed.). Strich = Theorie ρ/(1−ρ). Hyperbolisch: ρ=0,8 → 4×, 0,9 → 9×, 0,95 → 19×. Bei hohem ρ schwankt der Messwert stark.",
  "g-n":
    "Momentane Anzahl Gäste im System (wartend + in Bedienung). Strich = Theorie-Mittelwert L = ρ/(1−ρ) (Little). Die Zahl springt; der Strich ist der Langzeitschnitt.",
  "g-little":
    "Konsistenztest λ·W / L. Muss gegen 1,0 gehen, wenn die Simulation korrekt misst — Abweichung heißt nur: noch nicht genug Daten (oder ρ≥1, kein Gleichgewicht). Kein Parameter, sondern ein Selbsttest.",
};

const gauges = computed(() => {
  const r = readout.value;
  return [
    {
      iid: "g-rho",
      label: "Auslastung",
      value: r.rhoMeas.toFixed(2),
      unit: "gem.",
      frac: r.rhoMeas,
      markFrac: r.rho,
      color: rhoColor.value,
      sub: `Soll ρ=${r.rho.toFixed(2)}`,
    },
    {
      iid: "g-thr",
      label: "Durchsatz",
      value: r.thr.toFixed(2),
      unit: "/s",
      frac: r.thr / mu.value,
      markFrac: r.rho <= 1 ? r.rho : null,
      color: C.value.phosphor,
      sub: `Kap. μ=${mu.value.toFixed(2)}`,
    },
    {
      iid: "g-wq",
      label: "Wartezeit Wq",
      value: r.wqN > 99 ? "99+" : r.wqN.toFixed(1),
      unit: "×Bed.",
      frac: r.wqN / 20,
      markFrac: r.wqTheo != null ? r.wqTheo / 20 : null,
      color: wqColor.value,
      sub: r.wqTheo != null ? `Theorie ${r.wqTheo.toFixed(1)}×` : "→ ∞",
    },
    {
      iid: "g-n",
      label: "im System N",
      value: r.N,
      unit: "Pers.",
      frac: r.N / 30,
      markFrac: r.stable ? r.L / 30 : null,
      color: C.value.theory,
      sub: r.stable ? `Theorie L=${(r.rho / (1 - r.rho)).toFixed(1)}` : "→ ∞",
    },
    {
      iid: "g-little",
      label: "Little-Check",
      value: r.little.toFixed(2),
      unit: "λW/L",
      frac: 1,
      markFrac: 1,
      color: littleOk.value ? C.value.phosphor : C.value.amber,
      sub: "→ 1.0 ✓",
    },
  ];
});

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

/* ---- Einschwing-Balken ---- */
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
const stripedStyle = computed(() => ({
  background: `repeating-linear-gradient(45deg, ${C.value.panelHi}, ${C.value.panelHi} 6px, ${C.value.red}44 6px, ${C.value.red}44 12px)`,
}));

function btnStyle(border) {
  return {
    background: C.value.panelHi,
    color: C.value.textHi,
    border: `1px solid ${border}`,
  };
}
function presetStyle(rr) {
  const border =
    rr >= 1 ? C.value.red : rr >= 0.9 ? C.value.amber : C.value.border;
  return btnStyle(border);
}

/* ---- RAF-Loop ---- */
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  tickBus(now);
  if (ffActive.value) {
    // Vorspulen: Sim-Uhr per easeOutCubic über das FF-Fenster zum Horizont ziehen
    const p = Math.min(1, (now - ffStart) / FF_DUR);
    const e = 1 - Math.pow(1 - p, 3);
    const simBefore = engine.clock;
    engine.advance(ffFrom + (ffTo - ffFrom) * e);
    const inst = dtReal > 0 ? (engine.clock - simBefore) / dtReal : 0;
    ffSmooth = ffSmooth * 0.7 + inst * 0.3; // geglättet gegen Jitter
    if (ffSmooth > ffSpeed.value) ffSpeed.value = ffSmooth; // Spitzenwert halten (nicht auf 0 abklingen)
    ffFadeUntil = now + 800;
    if (p >= 1) {
      engine.snapToSteadyState(); // definierter, reproduzierbarer Stand (≈ Lq)
      ffActive.value = false;
      paused.value = false; // danach normal weiterlaufen (Streuung um L sichtbar)
    }
  } else if (!paused.value) {
    engine.advance(engine.clock + dtReal * speed.value);
  }
  // Indikator-Badge: während FF sichtbar, danach ~0,8 s ausklingend
  const ffOp = ffActive.value ? 1 : Math.max(0, (ffFadeUntil - now) / 800);
  ffBadge.value =
    ffOp > 0
      ? { opacity: ffOp, label: `⏩ ${fmtSpeed(ffSpeed.value)}×` }
      : null;

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
      if (c.robot) {
        // Burst-Gäste sind Roboter und steigen am Bus aus (statt links zu spawnen)
        v.emoji = "🤖";
        v.x = busView.value ? busView.value.x : BUS_STOP.x;
        v.y = (busView.value ? busView.value.y : BUS_STOP.y) + 22;
      }
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
      if (c.robot) v.emoji = "🤖";
      vis.set(c.id, v);
    }
    v.tx = ST.serviceX;
    v.ty = ST.serviceY;
    v.draw = true;
    v.state = "service";
  }
  for (const [id, v] of vis) {
    if (!present.has(id) && v.state !== "leaving" && v.state !== "shed") {
      v.state = "leaving";
      v.tx = ST.W + 60;
      v.ty = 60 + Math.random() * 240;
      v.draw = true;
    }
  }
  const k = 1 - Math.exp(-6 * dtReal);
  const out = [];
  for (const [id, v] of vis) {
    v.x += (v.tx - v.x) * k;
    v.y += (v.ty - v.y) * k;
    if (v.state === "leaving" && v.x > ST.W + 40) {
      vis.delete(id);
      continue;
    }
    if (v.state === "shed" && v.y > ST.H + 50) {
      vis.delete(id);
      continue;
    }
    v.opacity =
      v.state === "leaving"
        ? Math.max(0, 1 - (v.x - ST.W) / 100)
        : v.state === "shed"
          ? Math.max(0.15, 1 - (v.y - ST.lineY) / 220)
          : 1;
    if (v.draw)
      out.push({ id, x: v.x, y: v.y, emoji: v.emoji, opacity: v.opacity });
  }

  // Phosphor-Scope
  const rhoSet = engine.lambda / engine.mu;
  const wq = engine.meanWq(MM1_WINDOW);
  const yMeas = wq == null ? null : wq * engine.mu;
  const over = yMeas != null && yMeas > SCOPE.YMAX;
  if (!paused.value && yMeas != null)
    trail.push({ rho: rhoSet, y: yMeas, ts: now });
  for (let i = trail.length - 1; i >= 0; i--)
    trail[i].alpha = Math.max(0, 1 - (now - trail[i].ts) / 2200);
  while (trail.length && now - trail[0].ts > 2200) trail.shift();
  if (ctx) drawScope(ctx, C.value, FONTS, trail, rhoSet, yMeas, over);

  const lqTheory = rhoSet < 1 ? (rhoSet * rhoSet) / (1 - rhoSet) : Infinity;
  entities.value = out;
  live.value = {
    inService: !!engine.inService,
    food: engine.inService
      ? engine.inService.water
        ? "🥛"
        : foodFor(engine.inService.serviceTime, meanS)
      : "",
    remaining: engine.inService
      ? Math.max(0, engine.nextDeparture - engine.clock)
      : 0,
    overflow: hiddenCount,
    lqTheory,
    shedTotal: engine.numShed,
    waterLeft: engine.waterLeft,
  };

  if (now - lastSample > 140) {
    lastSample = now;
    const thr = engine.throughput(3.0);
    const rhoMeas = thr * engine.meanSt(MM1_WINDOW);
    const wqTheo = rhoSet < 1 ? rhoSet / (1 - rhoSet) : null;
    const sqrtRho = Math.sqrt(rhoSet);
    const Ntau = rhoSet < 1 ? rhoSet / Math.pow(1 - sqrtRho, 2) : Infinity;
    const settleTarget = Ntau === Infinity ? Infinity : 3 * Ntau;
    const served = engine.numDepartures - engine.settleAnchorDep;
    const progress =
      settleTarget === Infinity ? 0 : Math.min(1, served / settleTarget);
    readout.value = {
      rho: rhoSet,
      rhoMeas,
      thr,
      wqN: yMeas ?? 0,
      wqTheo,
      N: engine.N(),
      L: engine.Lavg(),
      little: engine.littleRatio(),
      settleTarget,
      served,
      progress,
      stable: rhoSet < 1,
    };
  }
}

onMounted(() => {
  const cv = scopeCanvas.value;
  if (cv) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = SCOPE.W * dpr;
    cv.height = SCOPE.H * dpr;
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
      '--c-phosphor': C.phosphor,
    }"
  >
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="title">M/M/1 · Schlange &amp; Kapazität</div>
        <div class="subtitle">
          Die „80 %“ sind ein Punkt auf der Hyperbel 1/(1−ρ), keine Klippe.
          Echte Instabilität erst bei ρ = 1.
        </div>
      </div>
      <div class="header-btns">
        <button
          class="btn"
          :style="btnStyle(paused ? C.phosphor : C.border)"
          @click="paused = !paused"
        >
          {{ paused ? "▶ Weiter" : "⏸ Pause" }}
        </button>
        <button class="btn" :style="btnStyle(C.border)" @click="reset">
          ↻ Reset
        </button>
        <button
          class="btn"
          :style="btnStyle(canFF ? C.phosphor : C.border)"
          :disabled="!canFF"
          title="Vorspulen: beschleunigt bis zum Gleichgewicht (≈ vorhergesagte Schlangenlänge L = ρ/(1−ρ)). Bei ρ≥1 gibt es kein Gleichgewicht."
          @click="fastForward"
        >
          ⏩ Vorspulen
        </button>
        <button
          class="btn"
          :style="btnStyle(controlsOpen ? C.phosphor : C.border)"
          :aria-expanded="controlsOpen"
          aria-controls="mm1-ctl"
          title="Regler ein-/ausblenden"
          @click="controlsOpen = !controlsOpen"
        >
          🛠️
        </button>
      </div>
    </div>

    <!-- ρ-Schnellwahl: immer sichtbar -->
    <div class="presets">
      <span class="presets-label" :style="{ color: C.textLow }"
        >ρ schnell:</span
      >
      <button
        v-for="rr in RHO_PRESETS"
        :key="rr"
        class="preset-btn"
        :style="presetStyle(rr)"
        @click="setRho(rr)"
      >
        {{ rr.toFixed(2) }}
      </button>
      <span class="presets-gap" />
      <button
        class="preset-btn"
        :style="btnStyle(C.amber)"
        title="Batch-Ankunft: ein Bus bringt 12 Gäste auf einen Schlag (Dirac-Impuls). Beobachte den Wq-Spike und die Re-Konvergenz im Scope."
        @click="burst"
      >
        🚌 Burst +12
      </button>
      <button
        class="preset-btn"
        :style="btnStyle(C.red)"
        title="Load-Shedding: verwirft alle Wartenden (nicht den Gast in Bedienung). Wq sinkt sofort — aber die Requests sind weg; der Little-Check weicht danach kurz ab."
        @click="shed"
      >
        ✂️ Load-Shed
      </button>
      <button
        class="preset-btn"
        :style="btnStyle(C.theory)"
        title="Feature-Shedding (Graceful Degradation): jeder Wartende wird bedient, aber die nächsten 30 Gäste bekommen nur ein Glas Wasser — 10× schnellere Bedienung, kein verworfener Request."
        @click="featureShed"
      >
        🥛 Feature-Shed
      </button>
    </div>

    <!-- Regler hinter 🛠️ -->
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
        :max="20"
        :step="0.5"
        unit="×"
        @update:model-value="(v) => (speed = v)"
      />
    </div>

    <!-- Kantine + Scope -->
    <div class="grid">
      <!-- Kantine + Gauges -->
      <div
        class="panel"
        :style="{ background: C.panel, borderColor: C.border }"
      >
        <div class="panel-head">
          <span class="panel-title" :style="{ color: C.textMid }">Kantine</span>
          <InfoPopover
            id="kantine"
            :active-id="info"
            title="Kantine (Illustration)"
            @toggle="toggle('kantine')"
          >
            {{ HELP.kantine }}
          </InfoPopover>
        </div>

        <svg :viewBox="`0 0 ${ST.W} ${ST.H}`" class="stage-svg">
          <text
            x="150"
            y="26"
            :fill="C.textLow"
            style="font-size: 13px"
            text-anchor="middle"
          >
            Ankunft (λ)
          </text>
          <text
            x="500"
            y="26"
            :fill="C.textLow"
            style="font-size: 13px"
            text-anchor="middle"
          >
            Warteschlange
          </text>
          <text
            x="760"
            y="26"
            :fill="C.textLow"
            style="font-size: 13px"
            text-anchor="middle"
          >
            Bedienung (μ)
          </text>
          <text
            x="920"
            y="26"
            :fill="C.textLow"
            style="font-size: 13px"
            text-anchor="middle"
          >
            Abgang
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
            :stroke="C.border"
          />
          <text x="790" y="205" style="font-size: 34px" text-anchor="middle">
            🧑‍🍳
          </text>

          <!-- Lq-Marker -->
          <text
            v-if="lqMarker && lqMarker.inf"
            x="320"
            y="146"
            style="font-size: 13px"
            :fill="C.theory"
            class="sim-mono"
          >
            Lq → ∞
          </text>
          <g v-else-if="lqMarker">
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
              y="146"
              style="font-size: 12px"
              :fill="C.theory"
              class="sim-mono"
              :text-anchor="lqMarker.off ? 'start' : 'middle'"
            >
              {{ lqMarker.label }}
            </text>
          </g>

          <!-- Bus (Burst-Ankunft) -->
          <text
            v-if="busView"
            :x="busView.x"
            :y="busView.y"
            style="font-size: 40px"
            text-anchor="middle"
            :style="{ opacity: busView.opacity }"
          >
            🚌
          </text>

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

          <!-- Shedding-Zähler: verworfene Requests -->
          <text
            v-if="live.shedTotal > 0"
            :x="badgeX"
            :y="lineY + 92"
            text-anchor="middle"
            :fill="C.red"
            style="font-size: 13px"
            class="sim-mono"
          >
            ✂️ verworfen: {{ live.shedTotal }}
          </text>

          <!-- Feature-Shed: Wasser-Modus aktiv -->
          <text
            v-if="live.waterLeft > 0"
            :x="badgeX"
            :y="lineY + 112"
            text-anchor="middle"
            :fill="C.theory"
            style="font-size: 13px"
            class="sim-mono"
          >
            🥛 nur Wasser: noch {{ live.waterLeft }} Gäste
          </text>

          <!-- „+N“-Badge mittig in der Schlange, hervorgehoben -->
          <g v-if="live.overflow > 0">
            <rect
              :x="badgeX - 24"
              :y="lineY - 15"
              width="48"
              height="30"
              rx="9"
              :fill="C.amber"
            />
            <text
              :x="badgeX"
              :y="lineY + 6"
              text-anchor="middle"
              font-weight="700"
              :fill="C.bg"
              style="font-size: 16px"
              class="sim-mono"
            >
              +{{ live.overflow }}
            </text>
          </g>

          <!-- in Bedienung: Essen + Restzeit -->
          <template v-if="live.inService">
            <text x="790" y="138" style="font-size: 30px" text-anchor="middle">
              {{ live.food }}
            </text>
            <text
              x="790"
              y="252"
              style="font-size: 14px"
              :fill="C.phosphor"
              text-anchor="middle"
              class="sim-mono"
            >
              {{ live.remaining.toFixed(1) }} s
            </text>
          </template>

          <!-- Fast-Forward-Indikator: macht das Spulen + die Beschleunigung sichtbar -->
          <text
            v-if="ffBadge"
            x="500"
            y="78"
            text-anchor="middle"
            :fill="C.phosphor"
            :stroke="C.bg"
            stroke-width="5"
            paint-order="stroke"
            :opacity="ffBadge.opacity"
            style="font-size: 36px; font-weight: 700"
            class="sim-mono"
          >
            {{ ffBadge.label }}
          </text>
        </svg>

        <!-- Gauges -->
        <div class="gauges" :style="{ borderColor: C.border }">
          <TheoryGauge
            v-for="g in gauges"
            :key="g.iid"
            :label="g.label"
            :value="g.value"
            :unit="g.unit"
            :frac="g.frac"
            :mark-frac="g.markFrac"
            :color="g.color"
            :sub="g.sub"
          >
            <template #info>
              <InfoPopover
                :id="g.iid"
                :active-id="info"
                :title="g.label"
                @toggle="toggle(g.iid)"
              >
                {{ HELP[g.iid] }}
              </InfoPopover>
            </template>
          </TheoryGauge>
        </div>
        <div class="gauge-caption" :style="{ color: C.textLow }">
          Bogen = gemessen · <span :style="{ color: C.theory }">▏</span> =
          Theorie/Sollwert
        </div>
      </div>

      <!-- Scope + Einschwing-Balken -->
      <div
        class="panel"
        :style="{ background: C.panel, borderColor: C.border }"
      >
        <div class="panel-head">
          <span class="panel-title" :style="{ color: C.textMid }">
            Phosphor-Scope · Wq(ρ) —
            <span :style="{ color: C.theory }">Theorie</span> +
            <span :style="{ color: C.phosphor }">Live</span>
          </span>
          <InfoPopover
            id="scope"
            :active-id="info"
            title="Phosphor-Scope"
            @toggle="toggle('scope')"
          >
            {{ HELP.scope }}
          </InfoPopover>
        </div>
        <canvas ref="scopeCanvas" class="scope-canvas" />

        <!-- Einschwing-Balken -->
        <div class="settle" :style="{ borderColor: C.border }">
          <template v-if="!settle.stable">
            <div class="settle-row" :style="{ color: C.red }">
              <span
                >Einschwingen · ρ ≥ 1 → kein Gleichgewicht (Schlange wächst
                unbegrenzt)</span
              >
              <InfoPopover
                id="settle"
                :active-id="info"
                title="Einschwing-Fortschritt"
                @toggle="toggle('settle')"
              >
                {{ HELP.settle }}
              </InfoPopover>
            </div>
            <div class="settle-striped" :style="stripedStyle" />
          </template>
          <template v-else>
            <div class="settle-row">
              <span class="settle-left">
                Einschwingen {{ settle.done ? "✓" : "" }} ·
                {{ settle.served }} / ~{{ settle.target }} Kunden (3τ)
                <InfoPopover
                  id="settle"
                  :active-id="info"
                  title="Einschwing-Fortschritt"
                  @toggle="toggle('settle')"
                >
                  {{ HELP.settle }}
                </InfoPopover>
              </span>
              <span :style="{ color: settle.done ? C.phosphor : C.textLow }"
                >{{ (settle.progress * 100).toFixed(0) }} %</span
              >
            </div>
            <div class="settle-track" :style="{ background: C.panelHi }">
              <div
                class="settle-fill"
                :style="{
                  width: settle.progress * 100 + '%',
                  background: settle.done ? C.phosphor : C.phosphorD,
                }"
              />
              <div class="settle-tau" :style="{ background: C.amber }" />
            </div>
            <div class="settle-foot" :style="{ color: C.textLow }">
              <span :style="{ color: C.amber }">▏</span> 1τ ≈ 63 % abgeklungen ·
              voller Balken ≈ praktisch eingependelt
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="footnote" :style="{ color: C.textLow }">
      Kantine = Illustration; Scope, Gauges &amp; Balken = quantitative
      Wahrheit. λ bewegen: der Punkt springt seitlich (neues ρ) und
      <em>klettert</em> zur Kurve. Erst ab ρ≥1 verlässt er das Feld nach oben —
      kein Gleichgewicht. 🚌 Burst = Dirac-Impuls: Wq springt, klingt bei ρ&lt;1
      wieder ab. ✂️ Load-Shed leert die Schlange nach unten — sofortige
      Entlastung, aber die Requests sind verworfen. 🥛 Feature-Shed bedient
      alle, aber 30 Gäste lang nur Wasser (10× schneller) — Degradation statt
      Verlust.
    </div>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.sim-root {
  background: var(--c-bg);
  color: var(--c-textHi);
  font-family: inherit;
  padding: 8px 12px 10px;
  max-width: 960px;
  margin: 0 auto;
  max-height: 540px;
  overflow-y: auto;
  border-radius: 8px;
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
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.subtitle {
  font-size: 9px;
  color: var(--c-textMid);
  line-height: 1.4;
  max-width: 620px;
}
.header-btns {
  display: flex;
  gap: 6px;
}
.btn {
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Presets */
.presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 6px;
}
.presets-label {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
}
.preset-btn {
  border-radius: 7px;
  padding: 3px 8px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.presets-gap {
  flex: 1;
}

/* Controls */
.controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  border: 1px solid;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 10px;
}
.panel {
  border: 1px solid;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}
.panel-head {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.panel-title {
  font-size: 11px;
}
.stage-svg {
  width: 100%;
  height: auto;
  display: block;
}

/* Gauges */
.gauges {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid;
}
.gauge-caption {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  text-align: center;
  margin-top: 5px;
}

/* Scope */
.scope-canvas {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 660 / 380;
}

/* Settle bar */
.settle {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid;
}
.settle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textMid);
  margin-bottom: 4px;
}
.settle-left {
  display: flex;
  align-items: center;
}
.settle-striped {
  height: 10px;
  border-radius: 6px;
}
.settle-track {
  position: relative;
  height: 10px;
  border-radius: 6px;
  overflow: hidden;
}
.settle-fill {
  position: absolute;
  inset: 0;
  transition: width 0.2s linear;
}
.settle-tau {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 33.3%;
  width: 2px;
}
.settle-foot {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  margin-top: 2px;
}

.footnote {
  font-size: 9px;
  line-height: 1.45;
  margin-top: 5px;
}
</style>
