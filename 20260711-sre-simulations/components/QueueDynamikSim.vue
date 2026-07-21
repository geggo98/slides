<script setup>
/**
 * QueueDynamikSim.vue — „Queue-Dynamik: voll ODER leer?" (Predict first),
 * portiert aus queue-dynamik-sim.html. Antwort auf den Publikums-Einwand,
 * eine Queue sei in echt immer fast voll oder fast leer: vier Szenarien,
 * exakte stationäre Verteilung (Hülle) vs. laufende Gillespie-Simulation
 * (Balken). Engine in lib/queueDynamikModel.js (Vitest-gepinnt); Maske mit
 * 2-Wahl-Vorhersage statt Skizze, Labor-Regler hinter dem ⚙ der SimShell.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import { fmtDe as fmt, randomSeed } from "./lib/rng.js";
import {
  GillespieSim,
  K,
  PRESETS,
  TRACE_LEN,
  ZB,
  classify,
  makeParams,
  mfptEmptyToFull,
  nStar,
  solveStationary,
  tvDistance,
} from "./lib/queueDynamikModel.js";

/* ===== Szenario-Texte (Maske + Erklärungs-Tab) ===== */
const SCEN = {
  0: {
    tag: "Fall 0 · Poisson · M/M/1/K",
    desc: "Aufträge kommen gleichmäßig zufällig herein — kein Muster, keine Klumpen. Bearbeitet wird konstant schnell, es ist ziemlich voll (90 % Auslastung), aber nichts schaukelt sich auf. Wie eine Supermarktkasse mit stetigem Kundenstrom an einem normal belebten Tag.",
    exact:
      "Poisson-Ankünfte mit konstanter Rate, exponentielle Bedienzeiten (M/M/1/K), Auslastung ρ = λ/μ = 0,9, kein Burst (b = 0), kein Feedback (r = 0). Stationär geometrisch verteilt: π(n) ∝ ρⁿ, monoton fallend, Modus bei n = 0. Erwartung: unimodal, meist leer — die Referenz für die anderen Fälle.",
    resolve:
      "Poisson bei ρ̄ = 0,9: geometrisch fallend, meist leer — vom „voll ODER leer“ keine Spur.",
  },
  B1: {
    tag: "Fall B1 · MMPP, schnell schaltend",
    desc: "Die Last kommt in Schüben — mal viel, mal wenig —, aber die Schübe sind extrem kurz und wechseln blitzschnell. Im Schnitt wieder 90 % Auslastung. Wie eine Straße, auf der sich dichter und lockerer Verkehr im Sekundentakt abwechselt.",
    exact:
      "2-Phasen-MMPP: Die Ankunftsrate springt zwischen λ_high = 1,6 (> μ) und λ_low = 0,2, mittlere Last 0,9. Umschaltrate q = 10, also Korrelationszeit τ_c = 1/(2q) = 0,05 — viel kürzer als die Füllzeit der Queue. Die Bursts mitteln sich weg; die Queue sieht praktisch die Durchschnittslast. Gleiche marginale Ankunfts-Varianz wie „Lange Phasen“, nur die Zeitskala unterscheidet sich. Erwartung: unimodal — Burstiness allein erzeugt keine Bimodalität.",
    resolve:
      "τ_c = 0,05 ≪ Füllzeit — die Schübe mitteln sich weg. Burstiness allein erzeugt keine Bimodalität.",
  },
  B2: {
    tag: "Fall B2 · MMPP, langsam schaltend",
    desc: "Dieselben Schübe wie eben — mal viel, mal wenig —, aber jetzt halten die Phasen lange an: erst eine lange Hochlast-Phase (mehr kommt rein, als rausgeht), dann eine lange ruhige Phase. Schnitt wieder 90 %. Wie Stoßzeit gegen tiefe Nacht.",
    exact:
      "Identischer Ankunfts-Mix wie „Kurze Schübe“ (λ_high = 1,6, λ_low = 0,2, mittlere Last 0,9), aber q = 0,01 → τ_c = 50, viel länger als die Füllzeit. In der Hochlast-Phase (ρ_on = 1,6 > 1) läuft die Queue voll und bleibt dort; in der Ruhephase leert sie sich. Quasi-stationäre Regime an beiden Rändern → bimodal. Treiber ist die Korrelationszeit, nicht die Varianz. Die Barriere ist der Phasenwechsel → häufige Übertritte, schnelle Konvergenz.",
    resolve:
      "τ_c = 50 ≫ Füllzeit — Stoßzeit füllt, Ruhephase leert: beide Ränder werden Attraktoren.",
  },
  C: {
    tag: "Fall C · Feedback / Retry-Sturm",
    desc: "Die Grundlast ist niedrig (60 %, viel Luft nach oben), Aufträge kommen gleichmäßig. Aber je länger die Schlange, desto mehr Wiederholungen (Retries) — und jeder Retry macht zusätzliche Arbeit. Die Schlange heizt sich selbst an. Wie eine Hotline, bei der genervte Anrufer auflegen und sofort neu anrufen.",
    exact:
      "Poisson-Grundlast ρ̄ = 0,6 (unterkritisch), aber zustandsabhängige Ankunftsrate λ(n) = 0,6 + r·n mit r = 0,02: je länger die Schlange, desto mehr Retries, desto mehr Last. Der Drift λ(n) − μ kreuzt bei n* ≈ 20 von negativ nach positiv → innerer Repeller, Masse sammelt sich an beiden Rändern → bimodal. Aber die Barriere ist dynamisch (Kramers): MFPT(leer→voll) ≈ 6 900 Zeiteinheiten — der volle Mode wird spontan fast nie besucht (Metastabilität). Nutze ⚡ Laststoß, um den Trigger zu simulieren.",
    resolve:
      "Feedback kippt den Drift bei n* ≈ 20 — bimodal und metastabil: MFPT→voll ≈ 6 900, spontan fast nie. ⚡ Laststoß oder ⏩ Batch zeigen den vollen Ast.",
  },
};
const RESOLVE_CUSTOM =
  "Eigene ⚙-Parameter — die Hülle ist die exakte stationäre Verteilung der Kette.";
const WAIT_ZONES = [
  { name: "kurze Wartezeit", varName: "--qd-signal" },
  { name: "mittlere Wartezeit", varName: "--qd-steel" },
  { name: "lange Wartezeit", varName: "--qd-amber" },
  { name: "Überlast", varName: "--qd-danger" },
];
const freqWord = (m) =>
  m >= 0.5
    ? "meistens"
    : m >= 0.2
      ? "oft"
      : m >= 0.05
        ? "manchmal"
        : m >= 0.01
          ? "selten"
          : "fast nie";

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let seed = randomSeed();
let P = null; // aktuelle Modellparameter (nicht-reaktiv)
let exactPi = null; // exakte stationäre Verteilung
let sim = null; // GillespieSim-Instanz
let animId = null;
let phaseEMA = 1;
let batchLeft = 0; // ⏩-Batch: verbleibende Zeiteinheiten (rAF-Chunks)

const activeTab = ref("sim");
const activePreset = ref("");
const hasScenario = ref(false);
const running = ref(false);
const masked = ref(false);
const predictMode = ref(true);
const showAid = ref(true);
const speedMult = ref(4);
const rho = ref(0.9);
const bAmp = ref(0.0);
const qLog = ref(0.0); // log₁₀ der Umschaltrate q
const rMil = ref(0.0); // Feedback r in Einheiten von 10⁻³
const verdict = shallowRef(null); // {cls,label} aus classify()
const readout = shallowRef(null);
const guessFb = ref(null); // {ok, text} nach dem Tipp
const nudging = ref(false);
const batching = ref(false);
const phaseView = shallowRef({ bursty: false, hi: 1 });

const qVal = computed(() => Math.pow(10, qLog.value));
const scen = computed(() => SCEN[activePreset.value] || null);
const playLabel = computed(() =>
  reduceMotion ? "▶ +200 ZE" : running.value ? "⏸ Pause" : "▶ Play",
);
const playTitle = reduceMotion
  ? "Simulation um 200 Zeiteinheiten fortschreiben"
  : "Simulation anhalten / fortsetzen";
const footerState = computed(() => {
  if (!hasScenario.value) return "idle";
  if (masked.value) return "masked";
  return "verdict";
});
const resolveText = computed(() =>
  scen.value ? scen.value.resolve : RESOLVE_CUSTOM,
);
const legendExactClass = computed(() => {
  const v = verdict.value;
  return v && v.cls === "bi"
    ? "ex-bi"
    : v && v.cls === "uni"
      ? "ex-uni"
      : "ex-n";
});
const bannerClass = computed(() => {
  if (footerState.value !== "verdict") return "qd-neutral";
  const v = verdict.value;
  return v && v.cls === "bi"
    ? "qd-bi"
    : v && v.cls === "uni"
      ? "qd-uni"
      : "qd-neutral";
});
const phaseWrapStyle = computed(() => ({
  opacity: hasScenario.value ? (phaseView.value.bursty ? 1 : 0.4) : 0,
}));
function pdotStyle(hiDot) {
  const pv = phaseView.value;
  if (!pv.bursty) return {};
  const strength = hiDot ? pv.hi : 1 - pv.hi;
  const colorVar = hiDot ? "var(--qd-danger)" : "var(--qd-signal)";
  return {
    background: colorVar,
    opacity: 0.18 + 0.82 * strength,
    boxShadow: strength > 0.55 ? `0 0 6px ${colorVar}` : "none",
  };
}
const pdotLoStyle = computed(() => pdotStyle(false));
const pdotHiStyle = computed(() => pdotStyle(true));

/* ===== Canvas ===== */
const scopeCanvas = ref(null);
const histCanvas = ref(null);
const chartWrap = ref(null);
const scopeH = 94,
  histH = 168;
let W = 0,
  dpr = 1,
  resizeObs = null;
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}
function hexA(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !scopeCanvas.value || !histCanvas.value) return;
  if (wrap.clientWidth <= 0) return; // Tab per v-show versteckt
  W = wrap.clientWidth;
  // Slidev skaliert die Folie per CSS-Transform — Backing-Store zusätzlich
  // mit dem effektiven Scale multiplizieren, sonst wird der Canvas unscharf.
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [scopeCanvas.value, scopeH],
    [histCanvas.value, histH],
  ]) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = h + "px";
  }
  drawAll();
}
function drawPlaceholder(ctx, h, txt) {
  ctx.fillStyle = hexA(cssVar("--qd-muted") || "#888888", 0.5);
  ctx.font = `12px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, W / 2, h / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawScope() {
  const c = scopeCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, scopeH);
  if (!hasScenario.value) {
    drawPlaceholder(ctx, scopeH, "▲ Wähle oben ein Szenario");
    return;
  }
  const pad = { l: 34, r: 8, t: 8, b: 14 };
  const IW = W - pad.l - pad.r,
    IH = scopeH - pad.t - pad.b;
  const y = (v) => pad.t + IH - (v / K) * IH;
  // Attraktor-Bänder: oben fast voll (danger), unten fast leer (signal)
  ctx.fillStyle = hexA(cssVar("--qd-danger"), 0.08);
  ctx.fillRect(pad.l, y(K), IW, y(0.82 * K) - y(K));
  ctx.fillStyle = hexA(cssVar("--qd-signal"), 0.08);
  ctx.fillRect(pad.l, y(0.15 * K), IW, y(0) - y(0.15 * K));
  ctx.strokeStyle = cssVar("--qd-grid-m");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, y(K / 2));
  ctx.lineTo(pad.l + IW, y(K / 2));
  ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = hexA(cssVar("--qd-danger"), 0.5);
  ctx.beginPath();
  ctx.moveTo(pad.l, y(K) + 0.5);
  ctx.lineTo(pad.l + IW, y(K) + 0.5);
  ctx.stroke();
  ctx.strokeStyle = hexA(cssVar("--qd-signal"), 0.5);
  ctx.beginPath();
  ctx.moveTo(pad.l, y(0) - 0.5);
  ctx.lineTo(pad.l + IW, y(0) - 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  const ns = nStar(P);
  if (ns != null && ns > 0 && ns < K) {
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = hexA(cssVar("--qd-amber"), 0.7);
    ctx.beginPath();
    ctx.moveTo(pad.l, y(ns));
    ctx.lineTo(pad.l + IW, y(ns));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cssVar("--qd-amber");
    ctx.font = `9px ${MONO}`;
    ctx.fillText("n* Barriere", pad.l + 4, y(ns) - 3);
  }
  ctx.fillStyle = cssVar("--qd-muted");
  ctx.font = `9px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText("K=" + K, pad.l - 4, y(K) + 3);
  ctx.fillText(String(K / 2), pad.l - 4, y(K / 2) + 3);
  ctx.fillText("0", pad.l - 4, y(0) + 3);
  ctx.textAlign = "left";
  const tr = sim ? sim.trace : [];
  if (tr.length > 1) {
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = cssVar("--qd-signal");
    ctx.beginPath();
    for (let i = 0; i < tr.length; i++) {
      const x = pad.l + (i / (TRACE_LEN - 1)) * IW;
      const yy = y(tr[i]);
      if (i) ctx.lineTo(x, yy);
      else ctx.moveTo(x, yy);
    }
    ctx.stroke();
    const lx = pad.l + ((tr.length - 1) / (TRACE_LEN - 1)) * IW;
    const ly = y(tr[tr.length - 1]);
    ctx.fillStyle = cssVar(sim.ph === 1 ? "--qd-danger" : "--qd-signal");
    ctx.beginPath();
    ctx.arc(lx, ly, 2.6, 0, 7);
    ctx.fill();
  }
  const v = verdict.value;
  if (
    v &&
    v.cls === "bi" &&
    P.r > 1e-9 &&
    sim &&
    sim.upCross === 0 &&
    sim.n < (ns != null ? ns : K)
  ) {
    ctx.fillStyle = cssVar("--qd-amber");
    ctx.font = `10px ${MONO}`;
    ctx.fillText(
      "metastabil — voller Mode spontan selten:  ⚡ Laststoß  /  ⏩ Batch",
      pad.l + 6,
      pad.t + 11,
    );
  }
}

function drawHist() {
  const c = histCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, histH);
  if (!hasScenario.value) {
    drawPlaceholder(ctx, histH, "Verteilung erscheint nach der Auswahl");
    return;
  }
  if (masked.value || !exactPi || !sim) return;
  const pad = { l: 34, r: 8, t: 6, b: 16 };
  const IW = W - pad.l - pad.r,
    IH = histH - pad.t - pad.b;
  const emp = sim.empirical();
  let mx = 0;
  for (let i = 0; i <= K; i++) mx = Math.max(mx, exactPi[i], emp[i]);
  mx = Math.max(mx * (showAid.value ? 1.34 : 1.12), 1e-3);
  const bw = IW / (K + 1),
    yb = pad.t + IH;
  const v = verdict.value;
  const vc = cssVar(
    v && v.cls === "bi"
      ? "--qd-danger"
      : v && v.cls === "uni"
        ? "--qd-signal"
        : "--qd-muted",
  );
  // Lesehilfe: Wartezeit-Zonen als Hintergrund-Bänder, an Balken ausgerichtet
  let zm = null,
    dom = -1;
  if (showAid.value) {
    zm = [];
    let domM = -1;
    for (let i = 0; i < 4; i++) {
      let m = 0;
      for (let nn = ZB[i]; nn < ZB[i + 1]; nn++) m += emp[nn];
      zm.push(m);
      if (m > domM) {
        domM = m;
        dom = i;
      }
    }
    for (let i = 0; i < 4; i++) {
      const xl = pad.l + ZB[i] * bw,
        xr = pad.l + ZB[i + 1] * bw;
      ctx.fillStyle = hexA(
        cssVar(WAIT_ZONES[i].varName),
        i === dom ? 0.1 : 0.04,
      );
      ctx.fillRect(xl, pad.t, xr - xl, IH);
      if (i > 0) {
        ctx.strokeStyle = hexA(cssVar("--qd-ink"), 0.05);
        ctx.beginPath();
        ctx.moveTo(xl, pad.t);
        ctx.lineTo(xl, yb);
        ctx.stroke();
      }
    }
  }
  // Exakte Hülle (Fläche + Linie)
  ctx.beginPath();
  ctx.moveTo(pad.l, yb);
  for (let i = 0; i <= K; i++)
    ctx.lineTo(pad.l + i * bw + bw / 2, yb - (exactPi[i] / mx) * IH);
  ctx.lineTo(pad.l + IW, yb);
  ctx.closePath();
  ctx.fillStyle = hexA(vc, 0.16);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= K; i++) {
    const x = pad.l + i * bw + bw / 2,
      yy = yb - (exactPi[i] / mx) * IH;
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  }
  ctx.strokeStyle = vc;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Empirische Balken
  ctx.fillStyle = hexA(cssVar("--qd-steel"), 0.82);
  for (let i = 0; i <= K; i++) {
    const barH = (emp[i] / mx) * IH;
    if (barH > 0.3)
      ctx.fillRect(pad.l + i * bw + 0.8, yb - barH, bw - 1.6, barH);
  }
  ctx.strokeStyle = cssVar("--qd-grid-m");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, yb + 0.5);
  ctx.lineTo(pad.l + IW, yb + 0.5);
  ctx.stroke();
  ctx.fillStyle = cssVar("--qd-muted");
  ctx.font = `9px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText("0", pad.l + bw / 2, yb + 12);
  ctx.fillText(String(K / 2), pad.l + (K / 2) * bw + bw / 2, yb + 12);
  ctx.fillText("K=" + K, pad.l + K * bw + bw / 2, yb + 12);
  ctx.textAlign = "left";
  ctx.fillText("n →", pad.l + IW - 58, yb + 12);
  if (showAid.value && zm) {
    const CONF_MIN = 15;
    for (let i = 0; i < 4; i++) {
      const z = WAIT_ZONES[i];
      const col = cssVar(z.varName);
      const xl = pad.l + ZB[i] * bw,
        xr = pad.l + ZB[i + 1] * bw;
      let cx = (xl + xr) / 2;
      const fw = freqWord(zm[i]);
      const confident = sim.zoneVisits[i] >= CONF_MIN || i === dom;
      ctx.font = `600 9.5px ${MONO}`;
      const w1 = ctx.measureText(fw).width;
      ctx.font = `9.5px ${MONO}`;
      const w2 = ctx.measureText(z.name).width;
      const hw = Math.max(w1, w2) / 2;
      cx = Math.max(pad.l + 2 + hw, Math.min(pad.l + IW - 2 - hw, cx));
      ctx.globalAlpha = confident ? 1 : 0.32;
      ctx.fillStyle = col;
      ctx.textAlign = "center";
      ctx.font = `600 9.5px ${MONO}`;
      ctx.fillText(fw, cx, pad.t + 28);
      ctx.font = `9.5px ${MONO}`;
      ctx.fillText(z.name, cx, pad.t + 39);
      if (i === dom) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - hw, pad.t + 43);
        ctx.lineTo(cx + hw, pad.t + 43);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
  if (sim.totalT > 0) {
    const conv = Math.max(0, Math.min(1, 1 - tvDistance(emp, exactPi)));
    const barW = 124,
      bx = pad.l + IW - barW,
      by = pad.t + 1;
    ctx.textAlign = "right";
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = cssVar("--qd-muted");
    ctx.fillText(`Konvergenz ${(conv * 100).toFixed(0)} %`, pad.l + IW, by + 8);
    ctx.fillStyle = hexA(cssVar("--qd-ink"), 0.09);
    ctx.fillRect(bx, by + 12, barW, 5);
    ctx.fillStyle = cssVar("--qd-signal");
    ctx.fillRect(bx, by + 12, barW * conv, 5);
    ctx.textAlign = "left";
  }
}
function drawAll() {
  drawScope();
  drawHist();
}

/* ===== Parameter-Fluss ===== */
function applyChange(fromPreset) {
  const wasBlank = !hasScenario.value;
  hasScenario.value = true;
  P = makeParams({
    rho: rho.value,
    b: bAmp.value,
    q: qVal.value,
    r: rMil.value / 1000,
  });
  exactPi = solveStationary(P);
  verdict.value = classify(exactPi);
  sim = new GillespieSim(P, seed);
  guessFb.value = null;
  if (wasBlank) running.value = !reduceMotion;
  masked.value = Boolean(fromPreset && predictMode.value);
  updateReadout();
  drawAll();
}
function selectPreset(key) {
  activePreset.value = key;
  const pr = PRESETS[key];
  rho.value = pr.rho;
  bAmp.value = pr.b;
  qLog.value = Math.log10(pr.q);
  rMil.value = pr.r * 1000;
  applyChange(true);
}
/* Template entpackt Refs — Zugriff daher über den Namen, nicht die Ref. */
const paramRefs = { rho, bAmp, qLog, rMil };
function onSlider(name, v) {
  paramRefs[name].value = v;
  activePreset.value = "";
  applyChange(false);
}

/* ===== Vorhersage (2-Wahl-Maske) ===== */
function guess(g) {
  const v = verdict.value;
  const truth = v && v.cls === "bi" ? "bi" : "uni";
  const ok = g === truth;
  guessFb.value = {
    ok,
    text: ok ? "✓ richtig — aufgedeckt." : "✗ daneben — die Hülle zeigt es.",
  };
  setTimeout(() => {
    masked.value = false;
    drawAll();
  }, 650);
}

/* ===== Transport ===== */
function togglePlay() {
  if (!hasScenario.value) return;
  if (reduceMotion) {
    sim.stepTo(sim.tsim + 200, true);
    updateReadout();
    drawAll();
    return;
  }
  running.value = !running.value;
}
function resetRun() {
  if (!sim) return;
  sim.reset(seed);
  updateReadout();
  drawAll();
}
function rerun(newSeed) {
  if (!sim) return;
  if (newSeed) seed = randomSeed();
  sim.reset(seed);
  updateReadout();
  drawAll();
}
function triggerLoad() {
  if (!sim) return;
  sim.triggerLoad();
}
function startBatch() {
  if (!sim || batchLeft > 0) return;
  batchLeft = 300000;
  batching.value = true;
  if (reduceMotion || !isSlideActive.value) finishBatchSync();
}
function finishBatchSync() {
  if (!sim || batchLeft <= 0) return;
  sim.batch(batchLeft);
  batchLeft = 0;
  batching.value = false;
  updateReadout();
  drawAll();
}

function updateReadout() {
  if (!P || !sim) {
    readout.value = null;
    return;
  }
  const baseMean = (P.lamLow + P.lamHigh) / 2;
  const tau = 1 / (2 * P.q);
  readout.value = {
    lamLow: P.lamLow,
    lamHigh: P.lamHigh,
    baseMean,
    tau: tau < 100 ? fmt(tau, 1) : fmt(tau, 0),
    nStar: nStar(P),
    mfpt: mfptEmptyToFull(P),
    upCross: sim.upCross,
    tsim: sim.tsim,
    events: sim.events,
  };
}

/* ===== rAF-Loop ===== */
let lastT = 0;
function frame(now) {
  animId = null;
  const dtReal = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
  lastT = now;
  if (sim && hasScenario.value) {
    if (batchLeft > 0) {
      const chunk = Math.min(30000, batchLeft);
      sim.batch(chunk);
      batchLeft -= chunk;
      if (batchLeft <= 0) batching.value = false;
    } else if (running.value && !reduceMotion) {
      sim.stepTo(sim.tsim + dtReal * 20 * speedMult.value, true);
    }
    // Phasen-Indikator (EMA gegen Flackern)
    const bursty = Math.abs(P.lamHigh - P.lamLow) > 1e-6;
    phaseEMA += (sim.ph - phaseEMA) * 0.12;
    phaseView.value = { bursty, hi: phaseEMA };
    updateReadout();
    const v = verdict.value;
    const ns = nStar(P);
    const stuck =
      v &&
      v.cls === "bi" &&
      P.r > 1e-9 &&
      sim.upCross === 0 &&
      sim.tsim > 800 &&
      !masked.value &&
      sim.n < (ns != null ? ns : K);
    if (stuck !== nudging.value) nudging.value = stuck;
    drawAll();
  }
  if (isSlideActive.value) animId = requestAnimationFrame(frame);
}
function startLoop() {
  if (animId == null && !reduceMotion) {
    lastT = 0;
    animId = requestAnimationFrame(frame);
  }
}
function stopLoop() {
  if (animId != null) cancelAnimationFrame(animId);
  animId = null;
}

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
watch(isSlideActive, (active) => {
  // Slidev hält Nachbar-Folien gemountet: rAF nur auf der aktiven Folie;
  // ein laufender ⏩-Batch wird beim Verlassen synchron zu Ende gerechnet.
  if (active) {
    requestAnimationFrame(sizeCanvases);
    startLoop();
  } else {
    stopLoop();
    finishBatchSync();
  }
});
watch(predictMode, (on) => {
  if (!on && masked.value) {
    masked.value = false;
    drawAll();
  }
});
watch(showAid, () => requestAnimationFrame(drawAll));
onMounted(() => {
  sizeCanvases();
  resizeObs = new ResizeObserver(() => requestAnimationFrame(sizeCanvases));
  if (chartWrap.value) resizeObs.observe(chartWrap.value);
  if (isSlideActive.value) startLoop();
});
onUnmounted(() => {
  stopLoop();
  resizeObs?.disconnect();
});
</script>

<template>
  <SimShell
    eyebrow="Warteschlangen · Publikums-Einwand"
    title="Queue-Dynamik: Was erzeugt „fast voll ODER fast leer“?"
    subtitle="μ = 1 · Puffer K = 40 · vier Verkehrsmuster — pro Szenario erst tippen (unimodal oder bimodal?), dann zeigt die exakte Verteilung die Wahrheit."
    presets-label="Szenario:"
    :presets="[
      { key: '0', label: 'Gleichmäßiger Strom' },
      { key: 'B1', label: 'Kurze Schübe' },
      { key: 'B2', label: 'Lange Phasen' },
      { key: 'C', label: 'Heizt sich selbst auf' },
    ]"
    :model-value="activePreset"
    gear-title="Detail-Regler"
    show-reset
    :reset-disabled="!hasScenario"
    reset-title="Statistik und Trace zurücksetzen (gleicher Seed)."
    @update:model-value="selectPreset"
    @reset="resetRun"
  >
    <template #transport>
      <button
        class="qd-btn"
        :disabled="!hasScenario"
        :title="playTitle"
        @click="togglePlay"
      >
        {{ playLabel }}
      </button>
    </template>

    <template #presets-extra>
      <button
        class="qd-btn qd-amberbtn"
        :class="{ 'qd-nudge': nudging }"
        :disabled="!hasScenario"
        title="Sprung über die Barriere: Belegung auf n = K setzen."
        @click="triggerLoad"
      >
        ⚡ Laststoß
      </button>
      <button
        class="qd-btn"
        :disabled="!hasScenario || batching"
        title="300 000 Zeiteinheiten im Schnelldurchlauf simulieren."
        @click="startBatch"
      >
        {{ batching ? "⏳ rechnet …" : "⏩ π auffüllen" }}
      </button>
    </template>

    <template #stage>
      <div class="qd-stage">
        <Tabs
          class="qd-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="qd-charts">
          <div class="qd-panelhead">
            <span class="qd-paneltitle"
              ><b>Belegung N(t)</b> — live · Rand K oben, leer unten</span
            >
            <span class="qd-phase" :style="phaseWrapStyle">
              <span class="qd-phase-lab">Phase</span>
              <i class="qd-pdot" :style="pdotLoStyle" />
              <span class="qd-pdot-t">niedrig</span>
              <i class="qd-pdot" :style="pdotHiStyle" />
              <span class="qd-pdot-t">hoch</span>
            </span>
          </div>
          <div class="qd-chartbox">
            <canvas
              ref="scopeCanvas"
              aria-label="Belegung der Warteschlange über die Zeit"
            />
          </div>

          <div class="qd-panelhead">
            <span class="qd-paneltitle"
              ><b>Verteilung π(n)</b> — empirisch vs. exakt</span
            >
            <span class="qd-legend">
              <span><i class="sw emp" /> empirisch (Simulation)</span>
              <span
                ><i class="sw" :class="legendExactClass" /> exakt (Hülle)</span
              >
            </span>
          </div>
          <div class="qd-chartbox">
            <canvas
              ref="histCanvas"
              aria-label="Verteilung der Belegung: empirisch und exakt"
            />
            <div v-if="masked" class="qd-mask">
              <div class="qd-mask-scn">
                <span class="qd-mask-tag">{{
                  scen ? scen.tag : "Szenario"
                }}</span>
                <p class="qd-mask-desc">{{ scen ? scen.desc : "" }}</p>
              </div>
              <p class="qd-mask-q">Was erwartest du für diese Dynamik?</p>
              <div class="qd-guessrow">
                <button
                  class="qd-guess uni"
                  aria-label="unimodal — nur leer"
                  @click="guess('uni')"
                >
                  <svg
                    class="qd-sketch"
                    viewBox="0 0 116 46"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line
                      x1="2"
                      y1="42.5"
                      x2="114"
                      y2="42.5"
                      stroke="currentColor"
                      stroke-opacity="0.3"
                      stroke-width="1"
                    />
                    <g fill="currentColor" fill-opacity="0.85">
                      <rect x="4" y="8" width="6" height="34" rx="0.8" />
                      <rect x="12" y="21" width="6" height="21" rx="0.8" />
                      <rect x="20" y="27.7" width="6" height="14.3" rx="0.8" />
                      <rect x="28" y="32.5" width="6" height="9.5" rx="0.8" />
                      <rect x="36" y="35.5" width="6" height="6.5" rx="0.8" />
                      <rect x="44" y="37.6" width="6" height="4.4" rx="0.8" />
                      <rect x="52" y="38.9" width="6" height="3.1" rx="0.8" />
                      <rect x="60" y="40" width="6" height="2" rx="0.8" />
                      <rect x="68" y="40.6" width="6" height="1.4" rx="0.8" />
                      <rect x="76" y="41" width="6" height="1" rx="0.8" />
                      <rect x="84" y="41.3" width="6" height="0.7" rx="0.8" />
                      <rect x="92" y="41.5" width="6" height="0.5" rx="0.8" />
                      <rect x="100" y="41.7" width="6" height="0.3" rx="0.8" />
                      <rect
                        x="108"
                        y="41.75"
                        width="6"
                        height="0.25"
                        rx="0.8"
                      />
                    </g>
                  </svg>
                  <span class="qd-glabel">unimodal · nur leer</span>
                </button>
                <button
                  class="qd-guess bi"
                  aria-label="bimodal — voll ODER leer"
                  @click="guess('bi')"
                >
                  <svg
                    class="qd-sketch"
                    viewBox="0 0 116 46"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line
                      x1="2"
                      y1="42.5"
                      x2="114"
                      y2="42.5"
                      stroke="currentColor"
                      stroke-opacity="0.3"
                      stroke-width="1"
                    />
                    <g fill="currentColor" fill-opacity="0.85">
                      <rect x="4" y="8" width="6" height="34" rx="0.8" />
                      <rect x="12" y="23.3" width="6" height="18.7" rx="0.8" />
                      <rect x="20" y="32.5" width="6" height="9.5" rx="0.8" />
                      <rect x="28" y="38" width="6" height="4" rx="0.8" />
                      <rect x="36" y="40.3" width="6" height="1.7" rx="0.8" />
                      <rect x="44" y="41" width="6" height="1" rx="0.8" />
                      <rect x="52" y="41.3" width="6" height="0.7" rx="0.8" />
                      <rect x="60" y="41.3" width="6" height="0.7" rx="0.8" />
                      <rect x="68" y="41" width="6" height="1" rx="0.8" />
                      <rect x="76" y="40.3" width="6" height="1.7" rx="0.8" />
                      <rect x="84" y="38.6" width="6" height="3.4" rx="0.8" />
                      <rect x="92" y="34.5" width="6" height="7.5" rx="0.8" />
                      <rect x="100" y="25" width="6" height="17" rx="0.8" />
                      <rect x="108" y="11.4" width="6" height="30.6" rx="0.8" />
                    </g>
                  </svg>
                  <span class="qd-glabel">bimodal · voll ODER leer</span>
                </button>
              </div>
              <div
                class="qd-fb"
                :class="guessFb ? (guessFb.ok ? 'ok' : 'no') : ''"
              >
                {{ guessFb ? guessFb.text : "" }}
              </div>
            </div>
          </div>

          <div class="qd-strip">
            <span v-if="readout" class="qd-readouts">
              λ
              <b
                >{{ fmt(readout.lamLow, 2) }} / {{ fmt(readout.lamHigh, 2) }}</b
              >
              · ρ̄ <b>{{ fmt(readout.baseMean, 2) }}</b> · τ_c
              <b>{{ readout.tau }}</b>
              <template v-if="readout.nStar != null">
                · n* <b>≈ {{ fmt(readout.nStar, 0) }}</b></template
              >
              <template v-if="readout.mfpt != null">
                · MFPT→voll <b>≈ {{ fmt(readout.mfpt, 0) }}</b> · Füll.
                <b>{{ readout.upCross }}</b></template
              >
              · T <b>{{ fmt(readout.tsim, 0) }}</b> · Ereign.
              <b>{{ fmt(readout.events / 1000, 0) }}k</b>
            </span>
            <span v-else class="qd-readouts">— kein Szenario gewählt —</span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="qd-explain">
          <p>
            Der Einwand „eine Queue ist doch immer fast voll oder fast leer“
            beschreibt eine <b>bimodale</b> Verteilung: Masse an beiden Rändern,
            Loch in der Mitte. Die vier Szenarien zeigen, welche Dynamik das
            wirklich erzeugt — bei (fast) identischer mittlerer Last.
          </p>
          <div v-for="key in ['0', 'B1', 'B2', 'C']" :key="key" class="qd-scen">
            <p class="qd-scen-tag">{{ SCEN[key].tag }}</p>
            <p>{{ SCEN[key].desc }}</p>
            <p class="qd-scen-exact">{{ SCEN[key].exact }}</p>
          </div>
          <p class="qd-scen-tag">Ablesen</p>
          <p>
            <b>Belegung N(t):</b> Füllstand wie auf einem Oszilloskop — oben der
            Puffer-Rand <span class="mono">K = 40</span>, unten leer. Die Bänder
            markieren die Attraktoren (rot fast voll, blau fast leer), die
            gestrichelte Amber-Linie die Feedback-Barriere
            <span class="mono">n*</span>. <b>Verteilung π(n):</b> graue Balken =
            empirisch aus der laufenden Simulation; farbige Hülle = exakte
            stationäre Verteilung, per Gauß-Elimination direkt aus dem Generator
            der Markov-Kette (blau = unimodal, rot = bimodal).
            <b>Konvergenz</b> = 1 − Total-Variation-Distanz: der Anteil der
            Wahrscheinlichkeitsmasse, den die Simulation schon korrekt trifft —
            bei metastabilen Fällen plateaut er, solange der volle Mode nicht
            besucht wurde. Kennzahlen:
            <span class="mono">τ_c = 1/(2q)</span> Korrelationszeit der Schübe ·
            <span class="mono">MFPT→voll</span>
            mittlere Zeit bis zum spontanen Übertritt ·
            <span class="mono">Füll.</span> gezählte Übertritte leer→voll.
          </p>
          <p class="qd-foot">
            <b>Ehrliche Vereinfachungen:</b> M/M/1/K-Kette mit exponentiellen
            Zwischenankunfts- und Bedienzeiten — reale Bedienzeiten sind oft
            schwerschwänzig (längere Tails, ohne Feedback aber weiterhin
            unimodal). Burstiness als 2-Zustands-MMPP: echte Selbstähnlichkeit
            wirkt über viele Zeitskalen; zwei Zustände genügen für den Punkt —
            nicht die Varianz (b), sondern die Korrelationszeit erzeugt
            Bimodalität. Feedback linear
            <span class="mono">λ(n) = λ̄ + r·n</span> als Minimalmodell für
            Retries; echte Retry-Stürme haben Sättigung, Timeouts und
            Backpressure. Metastabilität: Die Barriere ist dynamisch (Kramers),
            <span class="mono">MFPT(leer→voll) ≈ 6 900</span> — das Histogramm
            füllt den oberen Ast spontan nicht in Demo-Zeit; die Hülle ist stets
            die exakte stationäre Verteilung (per Vitest gegen die geschlossene
            M/M/1/K-Form gepinnt, MFPT gegen unabhängige Rechnung).
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="qd-gear">
        <QueueSlider
          :model-value="rho"
          label="Grundlast ρ̄"
          :min="0.3"
          :max="0.98"
          :step="0.01"
          unit=""
          @update:model-value="(v) => onSlider('rho', v)"
        />
        <QueueSlider
          :model-value="bAmp"
          label="Burst-Amplitude b"
          :min="0"
          :max="0.9"
          :step="0.01"
          unit=""
          @update:model-value="(v) => onSlider('bAmp', v)"
        />
        <QueueSlider
          :model-value="qLog"
          label="Umschaltrate q (log₁₀)"
          :min="-2.3"
          :max="1.3"
          :step="0.02"
          unit=""
          @update:model-value="(v) => onSlider('qLog', v)"
        />
        <QueueSlider
          :model-value="rMil"
          label="Feedback r (Retries, ×10⁻³)"
          :min="0"
          :max="30"
          :step="0.5"
          unit=""
          @update:model-value="(v) => onSlider('rMil', v)"
        />
        <p class="qd-gear-hint">
          q = {{ fmt(qVal, qVal < 0.1 ? 3 : 2) }} → τ_c =
          {{ fmt(1 / (2 * qVal), 1) }} · r = {{ fmt(rMil / 1000, 3) }} — Regler
          deaktivieren das Preset und rechnen die exakte Hülle sofort neu.
        </p>
        <div class="qd-gear-row">
          <span class="qd-gear-lab">Tempo</span>
          <button
            v-for="s in [1, 4, 16]"
            :key="s"
            class="qd-btn"
            :class="{ 'qd-on': speedMult === s }"
            @click="speedMult = s"
          >
            {{ s }}×
          </button>
        </div>
        <label class="qd-chk">
          <input v-model="predictMode" type="checkbox" />
          Vorhersage-Modus (erst tippen)
        </label>
        <label class="qd-chk">
          <input v-model="showAid" type="checkbox" />
          Lesehilfe: Wartezeit-Zonen
        </label>
        <div class="qd-gear-row">
          <button
            class="qd-btn qd-primary"
            :disabled="!hasScenario"
            @click="rerun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button class="qd-btn" :disabled="!hasScenario" @click="rerun(false)">
            Gleicher Seed
          </button>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="qd-banner" :class="bannerClass">
        <template v-if="footerState === 'idle'">
          Wähle ein Szenario — die Frage ist immer dieselbe:
          <b>unimodal</b> (nur leer) oder <b>bimodal</b> (voll ODER leer)?
        </template>
        <template v-else-if="footerState === 'masked'">
          Deine Einschätzung: <b>…</b> — erst tippen: unimodal oder bimodal? Der
          Live-Verlauf oben läuft schon.
        </template>
        <template v-else>
          <b v-if="guessFb">{{
            guessFb.ok ? "✓ richtig · " : "✗ daneben · "
          }}</b>
          <b>{{ verdict ? verdict.label : "—" }}</b> — {{ resolveText }}
        </template>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette (Light) + Dark-Variante; Canvas liest sie via
   getComputedStyle(chartWrap). Akzente gemappt aus dem Original:
   blue→signal · brick→danger · amber→amber · steel→steel. */
.qd-stage,
.qd-charts,
.qd-explain,
.qd-gear,
.qd-banner {
  --qd-paper: #e9eeea;
  --qd-panel: #fcfdfc;
  --qd-ink: #16282c;
  --qd-muted: #5c6b6a;
  --qd-grid-f: #e2eae4;
  --qd-grid-m: #c6d3cb;
  --qd-signal: #0b7285;
  --qd-danger: #af3e1b;
  --qd-amber: #a97c10;
  --qd-steel: #5f7d92;
  --qd-ok: #3d7a46;
}
:global(html.dark .qd-stage),
:global(html.dark .qd-charts),
:global(html.dark .qd-explain),
:global(html.dark .qd-gear),
:global(html.dark .qd-banner) {
  --qd-paper: #101a1c;
  --qd-panel: #0d1517;
  --qd-ink: #dce8e6;
  --qd-muted: #8fa3a0;
  --qd-grid-f: #1b2a2c;
  --qd-grid-m: #2d4246;
  --qd-signal: #37b6cf;
  --qd-danger: #e0684a;
  --qd-amber: #d9a62e;
  --qd-steel: #7fa3bd;
  --qd-ok: #69b877;
}

.qd-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.qd-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.qd-panelhead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  min-height: 14px;
}
.qd-paneltitle {
  font-size: 10px;
  color: var(--qd-muted);
}
.qd-paneltitle b {
  color: var(--qd-ink);
  font-weight: 600;
}
.qd-phase {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  color: var(--qd-muted);
  transition: opacity 0.2s;
}
.qd-pdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--qd-grid-m);
  opacity: 0.5;
  transition:
    opacity 0.12s,
    box-shadow 0.12s;
}
.qd-legend {
  display: flex;
  gap: 10px;
  font-size: 9px;
  color: var(--qd-muted);
}
.qd-legend .sw {
  display: inline-block;
  width: 11px;
  height: 7px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
.qd-legend .sw.emp {
  background: var(--qd-steel);
  opacity: 0.82;
}
.qd-legend .sw.ex-uni {
  background: var(--qd-signal);
}
.qd-legend .sw.ex-bi {
  background: var(--qd-danger);
}
.qd-legend .sw.ex-n {
  background: var(--qd-muted);
}
.qd-chartbox {
  position: relative;
  background: var(--qd-panel);
  border: 1px solid var(--qd-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.qd-chartbox canvas {
  display: block;
  width: 100%;
}

/* Predict-Maske über dem Histogramm; der Live-Verlauf oben bleibt sichtbar. */
.qd-mask {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--qd-paper) 94%, transparent);
  border: 1px dashed var(--qd-muted);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 16px;
  text-align: center;
  overflow: hidden;
}
.qd-mask-scn {
  max-width: 640px;
}
.qd-mask-tag {
  display: inline-block;
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--qd-signal);
  border: 1px solid var(--qd-grid-m);
  border-radius: 5px;
  padding: 2px 8px;
  margin-bottom: 4px;
}
.qd-mask-desc {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--qd-ink);
}
.qd-mask-q {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--qd-ink);
}
.qd-guessrow {
  display: flex;
  gap: 10px;
}
.qd-guess {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 168px;
  padding: 6px 10px 7px;
  font-family: var(--slidev-code-font-family);
  border: 1px solid var(--qd-grid-m);
  border-radius: 8px;
  background: var(--qd-panel);
  cursor: pointer;
  transition: 0.12s;
}
.qd-guess.uni {
  color: var(--qd-signal);
}
.qd-guess.bi {
  color: var(--qd-danger);
}
.qd-guess:hover {
  transform: translateY(-1px);
  border-color: currentColor;
}
.qd-sketch {
  width: 100%;
  height: 26px;
  display: block;
}
.qd-glabel {
  font-size: 10px;
  line-height: 1.15;
}
.qd-fb {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  min-height: 13px;
}
.qd-fb.ok {
  color: var(--qd-ok);
}
.qd-fb.no {
  color: var(--qd-danger);
}

.qd-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.qd-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--qd-muted);
}
.qd-readouts b {
  color: var(--qd-ink);
  font-weight: 600;
}

/* Buttons */
.qd-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--qd-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--qd-grid-m, #c6d3cb);
}
.qd-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.qd-btn.qd-on {
  border-color: var(--qd-signal, #0b7285);
  color: var(--qd-signal, #0b7285);
  font-weight: 600;
}
.qd-primary {
  border-color: var(--qd-ok, #3d7a46);
  font-weight: 600;
}
.qd-amberbtn {
  border-color: var(--qd-amber, #a97c10);
}
@keyframes qd-nudge-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(217, 150, 47, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(217, 150, 47, 0.25);
  }
}
.qd-nudge {
  animation: qd-nudge-pulse 1.35s ease-in-out infinite;
  color: var(--qd-amber, #a97c10);
}
@media (prefers-reduced-motion: reduce) {
  .qd-nudge {
    animation: none;
    box-shadow: 0 0 0 2px rgba(217, 150, 47, 0.28);
  }
}

/* Erklärung-Tab */
.qd-explain {
  max-height: 380px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--qd-ink);
  padding-right: 6px;
}
.qd-explain p {
  margin: 0 0 7px;
}
.qd-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.qd-scen {
  border-left: 2px solid var(--qd-grid-m);
  padding-left: 8px;
  margin: 0 0 8px;
}
.qd-scen-tag {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--qd-signal);
  margin: 0 0 2px;
}
.qd-scen-exact {
  font-size: 10px;
  color: var(--qd-muted);
}
.qd-foot {
  font-size: 9px;
  color: var(--qd-muted);
}

/* ⚙-Panel */
.qd-gear {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 290px;
}
.qd-gear-hint {
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
  opacity: 0.75;
  margin: 0;
}
.qd-gear-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.qd-gear-lab {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  color: var(--qd-muted);
}
.qd-chk {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  color: var(--qd-muted);
  cursor: pointer;
}
.qd-chk input {
  accent-color: var(--qd-signal);
  width: 12px;
  height: 12px;
}

/* Footer-Banner: feste Mindesthöhe — der Overflow-Checker sieht nur den
   Initialzustand, spätere Verdicts dürfen das Layout nicht verschieben. */
.qd-banner {
  box-sizing: border-box;
  font-size: 10px;
  line-height: 1.45;
  border: 1px solid;
  border-radius: 7px;
  padding: 4px 9px;
  margin-top: 6px;
  min-height: 40px;
  color: var(--qd-ink);
}
.qd-neutral {
  border-color: var(--qd-grid-m);
}
.qd-uni {
  border-color: var(--qd-signal);
}
.qd-bi {
  border-color: var(--qd-danger);
}
</style>
