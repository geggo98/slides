<script setup>
/**
 * MetastabilitySim.vue — „Die Naht live": der stochastische Zwilling der
 * Retry-Sturm-ODE (Making-of-Bonus).
 *
 * Drei Ansichten über EIN Modell (lib/metastableModel.js, Gleichungen per
 * Import aus breakerModel.js — identisch mit RetryStormSim):
 *  1. MTTF-Klippe (Predict first): Überlebenszeit je Last ρ skizzieren,
 *     dann misst ein Monte-Carlo-Sweep die echte Kurve — Klippe vor der
 *     Fluid-Falte.
 *  2. Die Naht: Potential-Becken mit Ball (Fluid-Skelett) neben der live
 *     zappelnden Poisson-Trajektorie, die über den Kipppunkt entkommt;
 *     Histogramm der Entkommens-Zeiten.
 *  3. Erklärung & Modell.
 */
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { fmtDe as fmt, randomSeed } from "./lib/rng.js";
import { usePredictSketch } from "./lib/usePredictSketch";
import {
  MU,
  MttfSweep,
  Q_COLLAPSE,
  TwinSim,
  barrier,
  cliffLambda,
  foldLambda,
  potential,
  tippingPoint,
} from "./lib/metastableModel.js";

/* ===== Konstanten ===== */
const RHO_MIN = 0.8,
  RHO_MAX = 1.05,
  T_CAP = 300, // Deckel der Überlebenszeit [s]
  CLIFF_T = 60, // Klippen-Schwelle fürs Verdict [s]
  Q_VIEW = 180, // q-Bereich der Potential-/Strip-Ansicht
  STRIP_WIN = 60; // Sichtfenster der Live-Trajektorie [s]
const RHOS = [];
for (let r = RHO_MIN; r <= RHO_MAX + 1e-9; r += 0.025)
  RHOS.push(Math.round(r * 1000) / 1000);
// Falte folgt dem ⚙-Regler R (für R ≥ 1 praktisch konstant ≈ 0,9987)
const foldRho = computed(() => foldLambda(R.value) / MU);

/* Preset-Vorhersagen: Überlebenszeit(ρ) */
const PRESET_FNS = {
  meanfield: (r) => (r < 0.995 ? 292 : 8),
  early: (r) =>
    r < 0.9 ? 292 : r < 0.96 ? 292 - ((r - 0.9) / 0.06) * 277 : 15,
  linear: (r) => 292 - ((r - RHO_MIN) / (RHO_MAX - RHO_MIN)) * 282,
};

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const R = ref(2);
const runsN = ref(24);
const phase = ref("sketch"); // sketch | running | done  (Sweep-Lebenszyklus)
let sweep = null;
let sweepAnim = null;
const sweepResults = shallowRef(null);
const progress = ref(0);
const verdict = shallowRef(null); // {tone, title, html}
const activeTab = ref("klippe");

const sketch = usePredictSketch({
  t0: RHO_MIN,
  tEnd: RHO_MAX,
  step: 0.0125,
  vMax: T_CAP,
  minLastT: RHO_MAX - 0.03,
});
const {
  ready: sketchReady,
  covWarn: sketchCovWarn,
  hasInk: sketchHasInk,
  skipped: sketchSkipped,
} = sketch;

const canStart = computed(() => phase.value === "sketch" && sketchReady.value);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);

/* Live-Ansicht („Die Naht") */
const rho = ref(0.94);
const liveRunning = ref(false);
let liveSim = null;
let liveAnim = null;
let liveOffset = 0; // globale Zeitachse über Auto-Restarts hinweg
let liveTrace = []; // {gt, q}
let liveMarks = []; // globale Zeitpunkte der Kollapse
const escapes = ref([]); // Entkommens-Zeiten [s] (je Lauf)
const liveNow = shallowRef(null); // {t, q, p}

const quStar = computed(() => tippingPoint(rho.value * MU, R.value));
const dU = computed(() => {
  const qu = quStar.value;
  if (qu == null) return 0;
  if (!isFinite(qu)) return Infinity;
  return barrier(rho.value * MU, R.value);
});
const mttfLive = computed(() => {
  const n = escapes.value.length;
  if (!n) return null;
  return escapes.value.reduce((a, x) => a + x, 0) / n;
});

/* ===== Canvas-Plumbing ===== */
const cliffCanvas = ref(null);
const potCanvas = ref(null);
const stripCanvas = ref(null);
const histCanvas = ref(null);
const stageWrap = ref(null);
const H = { cliff: 262, pot: 194, strip: 118, hist: 56 };
const dims = { cliff: 0, pot: 0, strip: 0, hist: 0 };
let dpr = 1,
  resizeObs = null;
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";
const PADC = { l: 48, r: 12, t: 12, b: 20 };
const PADP = { l: 12, r: 12, t: 16, b: 18 };
const PADS = { l: 36, r: 10, t: 8, b: 16 };
const PADH = { l: 10, r: 10, t: 12, b: 14 };

function cssVar(name) {
  if (!stageWrap.value) return "#888";
  return getComputedStyle(stageWrap.value).getPropertyValue(name).trim();
}
function sizeCanvases() {
  const pairs = [
    ["cliff", cliffCanvas.value],
    ["pot", potCanvas.value],
    ["strip", stripCanvas.value],
    ["hist", histCanvas.value],
  ];
  const wrap = stageWrap.value;
  if (!wrap) return;
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [key, c] of pairs) {
    if (!c) continue;
    const w = c.parentElement.clientWidth - 10;
    if (w <= 0) continue; // Tab gerade versteckt (v-show) — alte Größe behalten
    dims[key] = w;
    c.width = Math.round(w * dpr);
    c.height = Math.round(H[key] * dpr);
    c.style.height = H[key] + "px";
  }
  drawAll();
}

/* Klippen-Chart-Transformationen */
const xR = (r) =>
  PADC.l +
  ((r - RHO_MIN) / (RHO_MAX - RHO_MIN)) * (dims.cliff - PADC.l - PADC.r);
const rOfX = (x) =>
  RHO_MIN +
  ((x - PADC.l) / (dims.cliff - PADC.l - PADC.r)) * (RHO_MAX - RHO_MIN);
const yT = (v) =>
  PADC.t + (1 - Math.min(v, T_CAP) / T_CAP) * (H.cliff - PADC.t - PADC.b);
const tOfY = (y) => (1 - (y - PADC.t) / (H.cliff - PADC.t - PADC.b)) * T_CAP;

/* ===== Zeichnen: MTTF-Klippe ===== */
function drawCliff() {
  const c = cliffCanvas.value;
  const w = dims.cliff;
  if (!c || !w) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, H.cliff);
  ctx.save();
  // Raster
  ctx.strokeStyle = cssVar("--ms-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = RHO_MIN; r <= RHO_MAX + 1e-9; r += 0.0125) {
    const x = Math.round(xR(r)) + 0.5;
    ctx.moveTo(x, PADC.t);
    ctx.lineTo(x, H.cliff - PADC.b);
  }
  for (let v = 0; v <= T_CAP; v += 30) {
    const y = Math.round(yT(v)) + 0.5;
    ctx.moveTo(PADC.l, y);
    ctx.lineTo(w - PADC.r, y);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--ms-grid-m");
  ctx.fillStyle = cssVar("--ms-muted");
  ctx.font = `10px ${MONO}`;
  ctx.beginPath();
  for (let r = RHO_MIN; r <= RHO_MAX + 1e-9; r += 0.05) {
    const x = Math.round(xR(r)) + 0.5;
    ctx.moveTo(x, PADC.t);
    ctx.lineTo(x, H.cliff - PADC.b);
    ctx.fillText(fmt(r, 2), x - 12, H.cliff - PADC.b + 13);
  }
  for (let v = 0; v <= T_CAP; v += 60) {
    const y = Math.round(yT(v)) + 0.5;
    ctx.moveTo(PADC.l, y);
    ctx.lineTo(w - PADC.r, y);
    ctx.fillText(v + " s", 8, y + 4);
  }
  ctx.stroke();
  ctx.fillText(
    "Überlebenszeit [s] · Deckel 300 s",
    PADC.l + 8,
    H.cliff - PADC.b - 8,
  );
  ctx.fillText("Last ρ = λ/μ →", w - PADC.r - 92, H.cliff - 4);
  // Fluid-Falte
  const xf = xR(foldRho.value);
  ctx.strokeStyle = cssVar("--ms-danger");
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xf, PADC.t);
  ctx.lineTo(xf, H.cliff - PADC.b);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = cssVar("--ms-danger");
  ctx.font = `600 10px ${MONO}`;
  ctx.fillText("Fluid-Falte", xf - 74, yT(160));
  ctx.fillText(`ρc ≈ ${fmt(foldRho.value, 3)}`, xf - 74, yT(160) + 12);
  ctx.restore();

  // Vorhersage-Skizze (Bleistift)
  const pts = sketch.points().filter((p) => p.v != null);
  if (pts.length > 1) {
    ctx.save();
    ctx.strokeStyle = cssVar("--ms-pencil");
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xR(p.t),
        y = yT(p.v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Gemessene Punkte (nur fertige λ; während des Sweeps progressiv)
  const done = sweep
    ? sweep.results.slice(0, sweep.i)
    : (sweepResults.value ?? []);
  if (done.length) {
    const eff = (res) => (res.mttf == null ? T_CAP : Math.min(res.mttf, T_CAP));
    ctx.save();
    ctx.strokeStyle = cssVar("--ms-signal");
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    done.forEach((res, i) => {
      const x = xR(res.lam / MU),
        y = yT(eff(res));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = cssVar("--ms-signal");
    for (const res of done) {
      const x = xR(res.lam / MU),
        y = yT(eff(res));
      const capped = res.mttf == null || res.mttf > T_CAP;
      if (capped) {
        ctx.beginPath(); // Dreieck: zensiert, echte MTTF liegt höher
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x - 4.5, y + 3);
        ctx.lineTo(x + 4.5, y + 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // Gemessene Klippe markieren
  if (phase.value === "done" && sweepResults.value) {
    const cl = cliffLambda(sweepResults.value, CLIFF_T, T_CAP);
    if (cl != null) {
      const x = xR(cl / MU);
      ctx.save();
      ctx.strokeStyle = cssVar("--ms-signal");
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, PADC.t);
      ctx.lineTo(x, H.cliff - PADC.b);
      ctx.stroke();
      ctx.fillStyle = cssVar("--ms-signal");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText("Klippe", x + 4, PADC.t + 36);
      ctx.restore();
    }
  }
}

/* ===== Zeichnen: Potential-Becken ===== */
function drawPot() {
  const c = potCanvas.value;
  const w = dims.pot;
  if (!c || !w) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, H.pot);
  const lam = rho.value * MU;
  const { qs, U } = potential(lam, R.value, Q_VIEW, 240);
  let uMin = 0,
    uMax = 1;
  for (const u of U) {
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
  }
  const xQ = (q) => PADP.l + (q / Q_VIEW) * (w - PADP.l - PADP.r);
  const yU = (u) =>
    PADP.t + (1 - (u - uMin) / (uMax - uMin)) * (H.pot - PADP.t - PADP.b);
  ctx.save();
  // Kollaps-Zone
  ctx.fillStyle = cssVar("--ms-burst-fill");
  ctx.fillRect(
    xQ(Q_COLLAPSE),
    PADP.t,
    w - PADP.r - xQ(Q_COLLAPSE),
    H.pot - PADP.t - PADP.b,
  );
  // Potential-Kurve
  ctx.strokeStyle = cssVar("--ms-ink");
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < qs.length; i++) {
    const x = xQ(qs[i]),
      y = yU(U[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Kipppunkt
  const qu = quStar.value;
  ctx.font = `600 10px ${MONO}`;
  if (qu != null && isFinite(qu) && qu <= Q_VIEW) {
    const x = xQ(qu);
    ctx.strokeStyle = cssVar("--ms-danger");
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, PADP.t);
    ctx.lineTo(x, H.pot - PADP.b);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cssVar("--ms-danger");
    ctx.fillText(
      `Kipppunkt q* ≈ ${fmt(qu)}`,
      Math.min(x + 5, w - 130),
      PADP.t + 10,
    );
  } else if (qu == null) {
    ctx.fillStyle = cssVar("--ms-danger");
    ctx.fillText(
      "Falte überschritten — kein Becken mehr, nur noch bergab",
      PADP.l + 6,
      H.pot - PADP.b - 14,
    );
  }
  ctx.fillStyle = cssVar("--ms-muted");
  ctx.font = `10px ${MONO}`;
  ctx.fillText("Tal (stabil)", xQ(2) + 4, yU(0) - 8);
  ctx.fillText(
    "Potential U(q) — Fluid-Skelett · Ball = Live-Queue",
    PADP.l + 4,
    H.pot - 4,
  );
  // Ball an der aktuellen Live-Position
  const qNow = liveNow.value ? liveNow.value.q : 2;
  const qb = Math.min(qNow, Q_VIEW);
  const idx = Math.min(240, Math.max(0, Math.round((qb / Q_VIEW) * 240)));
  ctx.fillStyle = cssVar("--ms-ball");
  ctx.beginPath();
  ctx.arc(xQ(qb), yU(U[idx]) - 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ===== Zeichnen: Live-Trajektorie ===== */
function drawStrip() {
  const c = stripCanvas.value;
  const w = dims.strip;
  if (!c || !w) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, H.strip);
  const gtNow = liveTrace.length ? liveTrace[liveTrace.length - 1].gt : 0;
  const t0 = Math.max(0, gtNow - STRIP_WIN);
  const xT = (gt) => PADS.l + ((gt - t0) / STRIP_WIN) * (w - PADS.l - PADS.r);
  const yQ = (q) =>
    PADS.t + (1 - Math.min(q, Q_VIEW) / Q_VIEW) * (H.strip - PADS.t - PADS.b);
  ctx.save();
  ctx.strokeStyle = cssVar("--ms-grid-m");
  ctx.fillStyle = cssVar("--ms-muted");
  ctx.font = `9px ${MONO}`;
  ctx.beginPath();
  for (const q of [0, 60, 120, 180]) {
    const y = Math.round(yQ(q)) + 0.5;
    ctx.moveTo(PADS.l, y);
    ctx.lineTo(w - PADS.r, y);
    ctx.fillText(String(q), 6, y + 3);
  }
  ctx.stroke();
  // Kipppunkt-Linie
  const qu = quStar.value;
  if (qu != null && isFinite(qu)) {
    ctx.strokeStyle = cssVar("--ms-danger");
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(PADS.l, yQ(qu));
    ctx.lineTo(w - PADS.r, yQ(qu));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Fluid-Vorhersage (q bleibt ≈ 0)
  ctx.strokeStyle = cssVar("--ms-ref");
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(PADS.l, yQ(2));
  ctx.lineTo(w - PADS.r, yQ(2));
  ctx.stroke();
  ctx.setLineDash([]);
  // Kollaps-Marker
  ctx.strokeStyle = cssVar("--ms-queue");
  for (const m of liveMarks) {
    if (m < t0) continue;
    const x = xT(m);
    ctx.beginPath();
    ctx.moveTo(x, PADS.t);
    ctx.lineTo(x, H.strip - PADS.b);
    ctx.stroke();
    ctx.fillStyle = cssVar("--ms-queue");
    ctx.fillText("⚡", x - 4, PADS.t + 9);
  }
  // Trajektorie
  ctx.strokeStyle = cssVar("--ms-signal");
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  let started = false;
  for (const p of liveTrace) {
    if (p.gt < t0) continue;
    const x = xT(p.gt),
      y = yQ(p.q);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = cssVar("--ms-muted");
  ctx.fillText("Queue q(t) — letzte 60 s", PADS.l + 4, PADS.t - 1);
  ctx.restore();
}

/* ===== Zeichnen: Histogramm der Entkommens-Zeiten ===== */
function drawHist() {
  const c = histCanvas.value;
  const w = dims.hist;
  if (!c || !w) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, H.hist);
  const es = escapes.value;
  ctx.save();
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = cssVar("--ms-muted");
  if (!es.length) {
    ctx.fillText("Zeit bis Kollaps: noch keine Ereignisse", PADH.l, H.hist / 2);
    ctx.restore();
    return;
  }
  const tMaxH = Math.max(60, Math.ceil(Math.max(...es) / 30) * 30);
  const nb = 12;
  const bins = new Array(nb).fill(0);
  for (const t of es) bins[Math.min(nb - 1, Math.floor((t / tMaxH) * nb))]++;
  const bMax = Math.max(...bins);
  const bw = (w - PADH.l - PADH.r) / nb;
  ctx.fillStyle = cssVar("--ms-queue");
  bins.forEach((b, i) => {
    const hgt = (b / bMax) * (H.hist - PADH.t - PADH.b);
    ctx.fillRect(PADH.l + i * bw + 1, H.hist - PADH.b - hgt, bw - 2, hgt);
  });
  ctx.fillStyle = cssVar("--ms-muted");
  ctx.fillText("0", PADH.l, H.hist - 3);
  ctx.fillText(fmt(tMaxH) + " s", w - PADH.r - 34, H.hist - 3);
  ctx.fillText(
    `Zeit bis Kollaps · n = ${es.length} · MTTF ≈ ${fmt(mttfLive.value)} s`,
    PADH.l,
    PADH.t - 3,
  );
  ctx.restore();
}

function drawAll() {
  drawCliff();
  drawPot();
  drawStrip();
  drawHist();
}

/* ===== Skizzieren (Pointer → usePredictSketch) ===== */
function evToRV(ev) {
  const c = cliffCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * dims.cliff;
  const y = ((ev.clientY - rect.top) / rect.height) * H.cliff;
  return { r: rOfX(x), v: tOfY(y) };
}
function onCliffDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  cliffCanvas.value.setPointerCapture(ev.pointerId);
  onCliffMove(ev);
}
function onCliffMove(ev) {
  if (!sketch.isDrawing()) return;
  const { r, v } = evToRV(ev);
  sketch.ink(r, v);
}
function onCliffUp() {
  sketch.strokeEnd();
}
watch(sketch.version, () => {
  if (phase.value !== "running") drawCliff();
});
function applyPreset(key) {
  if (phase.value !== "sketch") return;
  sketch.applyPreset(PRESET_FNS[key]);
}
function clearSketch() {
  if (phase.value === "running") return;
  sketch.clear();
  if (phase.value === "done") softResetToSketch();
  drawCliff();
}

/* ===== Sweep ===== */
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function startSweep() {
  if (!canStart.value) return;
  sketch.fillGaps();
  phase.value = "running";
  activeTab.value = "klippe";
  sweep = new MttfSweep({
    lambdas: RHOS.map((r) => r * MU),
    runs: runsN.value,
    tMax: T_CAP,
    seed,
    R: R.value,
  });
  if (reduceMotion) {
    while (!sweep.work(2000000)) {
      /* synchron zu Ende */
    }
    finishSweep();
    return;
  }
  const loop = () => {
    const done = sweep.work(70000);
    progress.value = sweep.progress();
    drawCliff();
    if (!done) sweepAnim = requestAnimationFrame(loop);
    else finishSweep();
  };
  sweepAnim = requestAnimationFrame(loop);
}

function predictedCliff() {
  const pts = sketch.points().filter((p) => p.v != null);
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].v < CLIFF_T) {
      if (i === 0) return pts[0].t;
      const a = pts[i - 1],
        b = pts[i];
      const f = a.v === b.v ? 0 : (a.v - CLIFF_T) / (a.v - b.v);
      return a.t + f * (b.t - a.t);
    }
  }
  return null;
}

function finishSweep() {
  phase.value = "done";
  sweepAnim = null;
  progress.value = 1;
  sweepResults.value = sweep.results;
  const clMeas = cliffLambda(sweep.results, CLIFF_T, T_CAP);
  const rMeas = clMeas == null ? null : clMeas / MU;
  const rPred = sketchSkipped.value ? undefined : predictedCliff();
  const r90 = sweep.results.find((res) => Math.abs(res.lam / MU - 0.9) < 1e-6);
  const t90 =
    r90 && r90.mttf != null && r90.mttf <= T_CAP
      ? `Bei ρ = 0,90 überlebt es im Mittel nur ≈ ${fmt(r90.mttf / 60, 1)} min.`
      : "";
  const gap =
    rMeas == null
      ? null
      : Math.max(0, Math.round((foldRho.value - rMeas) * 100));
  const base =
    `Gemessene Klippe (MTTF &lt; ${CLIFF_T} s): <b class="mono">ρ ≈ ${rMeas == null ? "—" : fmt(rMeas, 2)}</b>` +
    ` · Fluid-Falte: <b class="mono">ρc ≈ ${fmt(foldRho.value, 3)}</b>.` +
    (gap != null
      ? ` Die letzten ≈ <b>${gap} % Kapazität</b> vor der Falte gehören dem Rauschen. ${t90}`
      : ` ${t90}`);
  let tone, title;
  if (rPred === undefined) {
    tone = "warn";
    title = "Ohne Vorhersage gestartet — die Klippe liegt weit vor der Falte.";
  } else if (rMeas == null) {
    tone = "warn";
    title = `Kurios: im Raster fiel die gemessene Kurve nie unter ${CLIFF_T} s — extremer Seed, würfle neu.`;
  } else if (rPred == null) {
    tone = "bad";
    title = "Deine Kurve hält durch — die Realität nicht.";
  } else {
    const d = Math.abs(rPred - rMeas);
    tone = d <= 0.03 ? "ok" : d <= 0.07 ? "warn" : "bad";
    title =
      tone === "ok"
        ? `Treffer: deine Klippe bei ρ ≈ ${fmt(rPred, 2)} — gemessen ρ ≈ ${fmt(rMeas, 2)}.`
        : `Deine Klippe: ρ ≈ ${fmt(rPred, 2)} — gemessen: ρ ≈ ${fmt(rMeas, 2)}.`;
  }
  verdict.value = {
    tone,
    title,
    html:
      " " +
      base +
      " Der Mittelwert verschweigt die Gefahr — der Fluid-Fixpunkt existiert, aber seine Lebensdauer fällt exponentiell mit der Barriere (Freidlin-Wentzell).",
  };
  drawCliff();
}

/* ===== Live-Lauf („Die Naht") ===== */
function ensureLiveSim() {
  if (!liveSim) {
    liveSim = new TwinSim(
      (seed + escapes.value.length * 977) >>> 0 || 1,
      rho.value * MU,
      R.value,
    );
  }
}
function liveStepChunk(steps) {
  ensureLiveSim();
  liveSim.lam = rho.value * MU; // Regler wirken live —
  liveSim.R = R.value; // Skelett und Zwilling bleiben dasselbe Modell
  for (let k = 0; k < steps; k++) {
    const p = liveSim.step();
    const gt = liveOffset + liveSim.t;
    liveTrace.push({ gt, q: liveSim.q });
    if (liveSim.collapsed()) {
      escapes.value = [...escapes.value, liveSim.t];
      liveMarks.push(gt);
      liveOffset = gt;
      liveSim = null;
      ensureLiveSim();
      continue;
    }
    if (k === steps - 1) liveNow.value = { t: liveSim.t, q: liveSim.q, p };
  }
  const gtNow = liveOffset + (liveSim ? liveSim.t : 0);
  const cutoff = gtNow - STRIP_WIN - 2;
  while (liveTrace.length && liveTrace[0].gt < cutoff) liveTrace.shift();
  while (liveMarks.length && liveMarks[0] < cutoff) liveMarks.shift();
}
function toggleLive() {
  if (reduceMotion) {
    // Ohne Animation: pro Klick 30 s Simulationszeit am Stück
    liveStepChunk(Math.round(30 / 0.05));
    drawPot();
    drawStrip();
    drawHist();
    return;
  }
  if (liveRunning.value) {
    if (liveAnim) cancelAnimationFrame(liveAnim);
    liveAnim = null;
    liveRunning.value = false;
    return;
  }
  liveRunning.value = true;
  const loop = () => {
    liveStepChunk(7); // ≈ 20× Echtzeit bei 60 fps
    drawPot();
    drawStrip();
    drawHist();
    if (liveRunning.value) liveAnim = requestAnimationFrame(loop);
  };
  liveAnim = requestAnimationFrame(loop);
}
function setRho(v) {
  if (v !== rho.value) {
    // MTTF-Statistik gilt pro Last — bei ρ-Wechsel neu ansetzen
    escapes.value = [];
    liveMarks = [];
  }
  rho.value = v;
  if (!liveRunning.value) {
    drawPot();
    drawStrip();
    drawHist();
  }
}
function resetLive() {
  if (liveAnim) cancelAnimationFrame(liveAnim);
  liveAnim = null;
  liveRunning.value = false;
  liveSim = null;
  liveOffset = 0;
  liveTrace = [];
  liveMarks = [];
  escapes.value = [];
  liveNow.value = null;
  drawPot();
  drawStrip();
  drawHist();
}

/* ===== Reset / Rewind / ⚙ ===== */
function softResetToSketch() {
  if (sweepAnim) cancelAnimationFrame(sweepAnim);
  sweepAnim = null;
  sweep = null;
  sweepResults.value = null;
  progress.value = 0;
  verdict.value = null;
  phase.value = "sketch";
  drawCliff();
}
function resetAll() {
  if (phase.value === "running") return;
  sketch.clear();
  R.value = 2;
  runsN.value = 24;
  rho.value = 0.94;
  seed = randomSeed();
  resetLive();
  softResetToSketch();
}
function resweep(newSeed) {
  if (phase.value === "running") return;
  if (newSeed) seed = randomSeed();
  softResetToSketch();
  if (sketchReady.value) startSweep();
}

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
watch(activeTab, () => nextTick(sizeCanvases));
watch([rho, R], () => {
  if (!liveRunning.value) {
    drawPot();
    drawStrip();
  }
  if (phase.value !== "running") drawCliff(); // Falte-Linie folgt R
});
watch(isSlideActive, (active) => {
  if (active) return;
  // Folie verlassen: Sweep synchron zu Ende rechnen, Live-Lauf pausieren
  if (phase.value === "running" && sweep) {
    if (sweepAnim) cancelAnimationFrame(sweepAnim);
    while (!sweep.work(2000000)) {
      /* fertig rechnen */
    }
    finishSweep();
  }
  if (liveRunning.value) {
    if (liveAnim) cancelAnimationFrame(liveAnim);
    liveAnim = null;
    liveRunning.value = false;
  }
});
onMounted(() => {
  sizeCanvases();
  // rAF-Defer: sizeCanvases ändert Canvas-Maße im Wrap — direkt im
  // RO-Callback provoziert das WebKits „undelivered notifications"-Fehler.
  resizeObs = new ResizeObserver(() => requestAnimationFrame(sizeCanvases));
  if (stageWrap.value) resizeObs.observe(stageWrap.value);
});
onUnmounted(() => {
  if (sweepAnim) cancelAnimationFrame(sweepAnim);
  if (liveAnim) cancelAnimationFrame(liveAnim);
  resizeObs?.disconnect();
});
</script>

<template>
  <SimShell
    eyebrow="Making of · Die Naht live"
    title="Metastabilität: die MTTF-Klippe"
    :subtitle="`Gleiche Gleichungen wie der Retry-Sturm (μ = 100 req/s · Timeout 1 s · ≤ ${R} Retries) — aber OHNE Burst: konstante Last ρ = λ/μ, nur das Poisson-Rauschen arbeitet. Skizziere, wie lange das System je Last überlebt, dann miss nach.`"
    presets-label="Vorhersage:"
    :presets="[
      { key: 'meanfield', label: 'Klippe erst bei ρ = 1' },
      { key: 'early', label: 'Klippe früher' },
      { key: 'linear', label: 'gleitender Abfall' },
    ]"
    gear-title="Experimentieren"
    show-reset
    show-rewind
    :reset-disabled="phase === 'running'"
    :rewind-disabled="phase === 'running' || !sketchHasInk"
    reset-title="Alles zurücksetzen: Kurve, Parameter, Sweep und Live-Lauf."
    rewind-title="Kurve behalten, Sweep verwerfen, Parameter wieder editierbar."
    @preset="applyPreset"
    @reset="resetAll"
    @rewind="softResetToSketch"
  >
    <template #presets-extra>
      <button
        class="ms-btn ms-primary"
        :disabled="!canStart"
        @click="startSweep"
      >
        ▶ Sweep starten
      </button>
      <button
        class="ms-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="ms-btn ms-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div ref="stageWrap" class="ms-stage">
        <Tabs
          class="ms-tabs"
          :tabs="[
            { key: 'klippe', label: 'MTTF-Klippe (Vorhersage)' },
            { key: 'naht', label: 'Die Naht: Becken & Entkommen' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <!-- Tab 1: MTTF-Klippe -->
        <div v-show="activeTab === 'klippe'" class="ms-charts">
          <div class="ms-chartbox">
            <canvas
              ref="cliffCanvas"
              aria-label="Überlebenszeit über Last. Zeichenfläche für die Vorhersage."
              @pointerdown="onCliffDown"
              @pointermove="onCliffMove"
              @pointerup="onCliffUp"
              @pointercancel="onCliffUp"
            />
            <div v-if="showSketchNote" class="ms-note">
              <b>✏️ Skizziere hier</b>, wie lange das System bei jeder Last ρ
              überlebt (Deckel 300 s) — oder wähle oben ein Preset.
            </div>
            <div
              v-if="phase === 'running'"
              class="ms-progress"
              role="progressbar"
              :aria-valuenow="Math.round(progress * 100)"
            >
              <div
                class="ms-progress-fill"
                :style="{ width: progress * 100 + '%' }"
              />
            </div>
          </div>
          <div class="ms-strip">
            <span class="ms-readouts">
              {{ RHOS.length }} Lastpunkte × {{ runsN }} Läufe · Deckel
              {{ T_CAP }} s · MTTF = Gesamtzeit/Ereignisse (zensiert)
            </span>
            <span class="ms-legend">
              <span><i class="sw pred" /> Vorhersage</span>
              <span><i class="sw real" /> gemessen</span>
              <span>▲ zensiert (≥ {{ T_CAP }} s)</span>
              <span><i class="sw fold" /> Fluid-Falte</span>
            </span>
          </div>
        </div>

        <!-- Tab 2: Die Naht -->
        <div v-show="activeTab === 'naht'" class="ms-naht">
          <div class="ms-naht-controls">
            <QueueSlider
              class="ms-rho"
              :model-value="rho"
              label="Last ρ = λ/μ"
              :min="0.8"
              :max="1.05"
              :step="0.01"
              unit=""
              @update:model-value="setRho"
            />
            <div class="ms-naht-presets">
              <button class="ms-btn" @click="setRho(0.85)">
                ρ = 0,85 · ruhig
              </button>
              <button class="ms-btn" @click="setRho(0.94)">
                ρ = 0,94 · nahe der Klippe
              </button>
              <button class="ms-btn" @click="setRho(1.01)">
                ρ = 1,01 · hinter der Falte
              </button>
              <button class="ms-btn ms-primary" @click="toggleLive">
                {{
                  reduceMotion ? "+30 s" : liveRunning ? "⏸ Pause" : "▶ Live"
                }}
              </button>
              <button class="ms-btn" @click="resetLive">↺ Live-Reset</button>
            </div>
          </div>
          <div class="ms-naht-grid">
            <div class="ms-chartbox">
              <canvas ref="potCanvas" aria-label="Potential-Becken mit Ball" />
            </div>
            <div class="ms-naht-right">
              <div class="ms-chartbox">
                <canvas ref="stripCanvas" aria-label="Live-Queue über Zeit" />
              </div>
              <div class="ms-chartbox">
                <canvas
                  ref="histCanvas"
                  aria-label="Histogramm der Zeit bis Kollaps"
                />
              </div>
            </div>
          </div>
          <div class="ms-strip">
            <span v-if="liveNow" class="ms-readouts">
              t <b>{{ fmt(liveNow.t, 1) }} s</b> · q
              <b>{{ fmt(liveNow.q) }}</b> · p(Timeout)
              <b>{{ fmt(liveNow.p * 100, 1) }} %</b> · q*
              <b>{{
                quStar == null ? "—" : isFinite(quStar) ? fmt(quStar) : "∞"
              }}</b>
              · ΔU
              <b>{{ dU === Infinity ? "∞" : fmt(dU) }}</b>
              · Entkommen <b>{{ escapes.length }}</b>
              <template v-if="mttfLive != null">
                · MTTF ≈ <b>{{ fmt(mttfLive) }} s</b>
              </template>
            </span>
            <span v-else class="ms-readouts">
              ▶ Live starten: die Formel parkt im Tal — die Realität zittert und
              entkommt.
            </span>
          </div>
        </div>

        <!-- Tab 3: Erklärung -->
        <div v-show="activeTab === 'erklaerung'" class="ms-explain">
          <p>
            <b>Ein Modell, zwei Lesarten.</b> Dieses Widget importiert
            <span class="mono">pT</span>, <span class="mono">att</span>,
            <span class="mono">μ</span> und <span class="mono">Δt</span> direkt
            aus dem Retry-Sturm-Modell (<span class="mono"
              >lib/breakerModel.js</span
            >) — es sind buchstäblich dieselben Gleichungen. Einziger
            Unterschied: kein Burst. Die Last ist konstant, und trotzdem kippt
            das System — irgendwann. <b>Kollabiert</b> heißt hier
            <span class="mono">q ≥ {{ Q_COLLAPSE }}</span> (p(Timeout) &gt; 98
            %, Goodput ≈ 0).
          </p>
          <p>
            <b>Fluid-Skelett (Mittelwert):</b>
            <span class="mono">dq/dt = λ·att(p(q), R) − μ</span>. Für
            <span class="mono">ρ &lt; ρc ≈ {{ fmt(foldRho, 3) }}</span> hat es
            ein stabiles Tal bei q ≈ 0 und einen Kipppunkt q* — dazwischen die
            Barriere ΔU. An der <b>Falte</b> ρc verschwindet das Tal
            (Sattel-Knoten-Bifurkation): erst dort sagt der Mittelwert
            „instabil". Die Poisson-Realität würfelt aber in jedem Zeitschritt —
            und nach Freidlin-Wentzell/Kramers fällt die mittlere Entkommenszeit
            <b>exponentiell mit der Barriere</b>:
            <span class="mono">MTTF ~ e^ΔU/Rauschen</span>. Exponentiell heißt:
            keine sanfte Degradation, sondern eine <b>Klippe</b>.
          </p>
          <p>
            <b>Die Zahlen (R = 2, Seed-abhängig ±):</b> Klippe (MTTF &lt; 60 s)
            bei <span class="mono">ρ ≈ 0,96</span>, bei
            <span class="mono">ρ = 0,90</span> nur noch Minuten Lebenszeit,
            Plateau (≥ Deckel) erst ab <span class="mono">ρ ≲ 0,85</span>. Die
            letzten ~10–15 % Kapazität vor der Falte gehören dem Rauschen — das
            ist die Metastabilitäts-Begründung der 80-%-Regel aus dem
            Warteschlangen-Kapitel.
          </p>
          <p class="ms-foot">
            <b>Bewusste Vereinfachungen:</b> Entkommen = erste Passage bis q =
            {{ Q_COLLAPSE }} (statt formaler Sattel-Passage); MTTF als
            Exponential-MLE mit Zensierung (Gesamtzeit/Ereignisse, Läufe ohne
            Kollaps zählen nur als Beobachtungszeit); Deckel {{ T_CAP }} s;
            Poisson-Ankünfte/-Bedienung und Sigmoid-Deadline wie im Retry-Sturm;
            Retries ohne Backoff. Skelett-Größen (q*, ρc, ΔU) per
            Bisektion/Trapezregel, in Vitest gegen Handrechnung gepinnt.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="ms-gear">
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
          :model-value="runsN"
          label="Läufe pro Lastpunkt"
          :min="8"
          :max="48"
          :step="8"
          unit=""
          @update:model-value="(v) => (runsN = v)"
        />
        <p class="ms-gear-hint">
          R verschiebt vor allem die Klippe — die Falte hängt kaum an R
          (Sweep-Parameter wirken ab dem nächsten Lauf, im Live-Tab sofort).
          Mehr Läufe = glattere MTTF-Kurve, längerer Sweep.
        </p>
        <div class="ms-gear-btns">
          <button
            class="ms-btn ms-primary"
            :disabled="phase === 'running'"
            @click="resweep(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="ms-btn"
            :disabled="phase === 'running'"
            @click="resweep(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="ms-btn"
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
        class="ms-banner ms-warnb"
      >
        Zeichne die Kurve über (fast) den ganzen Lastbereich — von ρ = 0,80 bis
        ρ = 1,05.
      </div>
      <div v-else-if="verdict" class="ms-banner" :class="`ms-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Palette wie RetryStormSim (Papier-Look), gelesen via getComputedStyle. */
.ms-stage,
.ms-gear {
  --ms-paper: #e9eeea;
  --ms-panel: #fcfdfc;
  --ms-ink: #16282c;
  --ms-muted: #5c6b6a;
  --ms-grid-f: #e2eae4;
  --ms-grid-m: #c6d3cb;
  --ms-pencil: #6a7480;
  --ms-signal: #0b7285;
  --ms-queue: #a97c10;
  --ms-burst-fill: rgba(226, 163, 60, 0.16);
  --ms-danger: #af3e1b;
  --ms-ok: #3d7a46;
  --ms-ref: #9fb4ac;
  --ms-ball: #7048a8;
}
:global(html.dark .ms-stage),
:global(html.dark .ms-gear) {
  --ms-paper: #101a1c;
  --ms-panel: #0d1517;
  --ms-ink: #dce8e6;
  --ms-muted: #8fa3a0;
  --ms-grid-f: #1b2a2c;
  --ms-grid-m: #2d4246;
  --ms-pencil: #93a1ad;
  --ms-signal: #37b6cf;
  --ms-queue: #d9a62e;
  --ms-burst-fill: rgba(226, 163, 60, 0.1);
  --ms-danger: #e0684a;
  --ms-ok: #69b877;
  --ms-ref: #4e6660;
  --ms-ball: #a884e0;
}

.ms-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.ms-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ms-chartbox {
  position: relative;
  background: var(--ms-panel);
  border: 1px solid var(--ms-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.ms-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.ms-naht .ms-chartbox canvas {
  cursor: default;
}
.ms-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--ms-panel) 88%, transparent);
  border: 1px dashed var(--ms-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--ms-ink);
  pointer-events: none;
  text-align: center;
}
.ms-progress {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 6px;
  height: 4px;
  border-radius: 2px;
  background: var(--ms-grid-m);
  overflow: hidden;
}
.ms-progress-fill {
  height: 100%;
  background: var(--ms-signal);
  transition: width 0.1s linear;
}

.ms-naht {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ms-naht-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ms-rho {
  min-width: 210px;
}
.ms-naht-presets {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.ms-naht-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 4px;
}
.ms-naht-right {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ms-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.ms-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--ms-muted);
}
.ms-readouts b {
  color: var(--ms-ink);
  font-weight: 600;
}
.ms-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--ms-muted);
}
.ms-legend .sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.ms-legend .sw.pred {
  background: var(--ms-pencil);
}
.ms-legend .sw.real {
  background: var(--ms-signal);
}
.ms-legend .sw.fold {
  background: var(--ms-danger);
}

.ms-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--ms-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--ms-grid-m, #c6d3cb);
}
.ms-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.ms-primary {
  border-color: var(--ms-ok, #3d7a46);
  font-weight: 600;
}
.ms-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

.ms-explain {
  max-height: 380px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--ms-ink);
  padding-right: 6px;
}
.ms-explain p {
  margin: 0 0 8px;
}
.ms-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.ms-foot {
  font-size: 9px;
  color: var(--ms-muted);
}

.ms-gear {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}
.ms-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.ms-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ms-banner {
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
}
.ms-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.ms-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark .ms-warnb) {
  color: #d9a62e;
}
.ms-ok {
  border-color: #3d7a46;
}
.ms-warn {
  border-color: #c8912f;
}
.ms-bad {
  border-color: #af3e1b;
}
</style>
