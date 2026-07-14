<script setup>
/**
 * BullwhipSim.vue — „Die Peitsche in der Lieferkette" (Predict first),
 * portiert aus bullwhip-predict-first.html. Modell (4-stufige Order-up-to-
 * Kette), Preset-Kurven, Verdict-Logik und Canvas-Zeichencode verbatim
 * übernommen; DOM-Plumbing → Vue-Refs, Skizze → usePredictSketch,
 * Labor-Slider hinter dem ⚙ der SimShell, Erklärung/Modell als zweiter Tab
 * (v-show, damit die Canvases gemountet bleiben). Die klickbaren Ketten-
 * Kästchen des Originals (Stufen ein-/ausblenden) leben platzsparend als
 * klickbare Legenden-Einträge weiter.
 */
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
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
  Chain,
  T,
  STEP_T,
  D0,
  D1,
  K,
  O_MAX,
  I_MIN,
  I_MAX,
  SHOCK_T,
  TIER_NAMES,
} from "./lib/bullwhipModel.js";

/* ===== Anzeige-Stile (Modellkern lebt in lib/bullwhipModel.js) =====
   Okabe-Ito-Farben (als CSS-Variablen, Light/Dark) + je Stufe eigenes
   Strichmuster (redundante Kodierung für Farbschwäche); identisch zu den
   SVG-Proben in der Legende. */
const TIER_STYLE = [
  { v: "--bw-t1", w: 1.6, d: [2, 3] }, // Lokales Inventar: gepunktet
  { v: "--bw-t2", w: 1.8, d: [9, 4] }, // Zentrallager: gestrichelt
  { v: "--bw-t3", w: 2.0, d: [10, 3, 2, 3] }, // DigiKey: Strich-Punkt
  { v: "--bw-fab", w: 2.8, d: [] }, // Micron: durchgezogen, dick
];
const DEM_STYLE = { v: "--bw-demand", w: 2, d: [] };

/* Preset-Vorhersagen. smooth/overshoot/whip: Grundszenario (verbatim).
   shockwave: Preisschock — Welle, dann Blackout ab SHOCK_T, dann Erholung. */
const PRESET_FNS = {
  smooth: (w) => (w < STEP_T ? 100 : Math.min(120, 100 + (w - STEP_T) * 6)),
  overshoot: (w) =>
    w < STEP_T
      ? 100
      : w < STEP_T + 5
        ? 100 + (w - STEP_T) * 24
        : Math.max(120, 220 - (w - STEP_T - 5) * 10),
  whip: (w) => {
    if (w < STEP_T) return 100;
    const ph = w - STEP_T;
    return Math.max(0, 120 + 380 * Math.exp(-ph / 12) * Math.sin(ph / 3));
  },
  shockwave: (w) => {
    if (w < STEP_T) return 100;
    if (w < SHOCK_T) {
      // Bestell-Peak am Sprung, tapert bis zum Preisschock ab
      const ph = (w - STEP_T) / Math.max(1, SHOCK_T - STEP_T);
      return 120 + 380 * Math.max(0, 1 - ph);
    }
    // Flaute: erst Blackout, dann Erholung der Rate auf ~120
    const bp = w - SHOCK_T;
    return bp < 6 ? 0 : Math.min(120, (bp - 6) * 40);
  },
};
const BASE_PRESETS = [
  { key: "smooth", label: "glatte Anpassung" },
  { key: "overshoot", label: "Überschwingen" },
  { key: "whip", label: "starke Oszillation" },
];
const SHOCK_PRESETS = [{ key: "shockwave", label: "Welle → Einbruch" }];

/* ===== Zustand ===== */
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
let seed = randomSeed();
const L = ref(2);
const alpha = ref(0.4);
const share = ref(false);
const scenario = ref("base"); // base | priceshock
const phase = ref("sketch"); // sketch | running | done
let sim = null;
let demandKnown = []; // vorab gezeigte Nachfrage (exakt der spätere Lauf)
let oldRuns = []; // frühere Micron-Order-Arrays
let animId = null;
const visible = reactive({ dem: true, 0: true, 1: true, 2: true, 3: true });

const sketch = usePredictSketch({
  t0: 0,
  tEnd: T,
  step: 1,
  vMax: O_MAX,
  minCoverage: 0.55,
  minLastT: 55,
});
const {
  ready: sketchReady,
  hasInk: sketchHasInk,
  skipped: sketchSkipped,
} = sketch;

const activeTab = ref("sim");
const readout = shallowRef(null); // {w, d, f, inv, z}
const verdict = shallowRef(null); // {tone, title, html, chips}

/* Zusätzliches Start-Gate des Originals: Skizze muss (fast) links beginnen
   (firstPredW() <= 5) — das deckt usePredictSketch nicht selbst ab. */
const firstOk = computed(() => {
  void sketch.version.value;
  if (sketchSkipped.value) return true;
  const first = sketch.points().find((p) => p.v != null);
  return first != null && first.t <= 5;
});
const canStart = computed(
  () => phase.value === "sketch" && sketchReady.value && firstOk.value,
);
const covWarnAll = computed(
  () =>
    phase.value === "sketch" &&
    sketchHasInk.value &&
    !(sketchReady.value && firstOk.value),
);
const showSketchNote = computed(
  () => phase.value === "sketch" && !sketchHasInk.value && !sketchSkipped.value,
);

/* Szenario 2 (Preisschock) schaltet Presets, Chain-Optionen und Untertitel um. */
const activePresets = computed(() =>
  scenario.value === "base" ? BASE_PRESETS : SHOCK_PRESETS,
);
const chainOpts = () => ({ priceShock: scenario.value === "priceshock" });
const subtitle = computed(() =>
  scenario.value === "priceshock"
    ? `Server verbrauchen ${fmt(D0)} → ${fmt(D1)} Riegel/Woche (Sprung in Woche ${STEP_T}). In Woche ${SHOCK_T} hebt Micron die Preise → alle Stufen bauen erst ihr Lager ab. Skizziere Microns Bestellungen (Woche 0–${T}), dann starte.`
    : `Server verbrauchen ${fmt(D0)} Riegel/Woche, ab Woche ${STEP_T} dauerhaft +20 % auf ${fmt(D1)} · Order-up-to-Kette über 4 Stufen, Lieferzeit ${L.value} Wo. je Stufe, α = ${fmt(alpha.value, 2)}. Skizziere Microns Bestellungen (Woche 0–${T}), dann starte.`,
);

/* ===== Canvas ===== */
const oCanvas = ref(null);
const iCanvas = ref(null);
const chartWrap = ref(null);
const oH = 180,
  iH = 58;
let W = 0,
  dpr = 1,
  resizeObs = null;
const PAD = { l: 56, r: 14, t: 12, b: 22 },
  IPAD = { l: 56, r: 14, t: 6, b: 16 };
const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";

const xOf = (w) => PAD.l + (w / T) * (W - PAD.l - PAD.r);
const wOf = (x) => ((x - PAD.l) / (W - PAD.l - PAD.r)) * T;
const yOf = (v) =>
  PAD.t + (1 - Math.min(v, O_MAX) / O_MAX) * (oH - PAD.t - PAD.b);
const vOf = (y) => (1 - (y - PAD.t) / (oH - PAD.t - PAD.b)) * O_MAX;
const yI = (v) =>
  IPAD.t +
  (1 - (Math.max(I_MIN, Math.min(v, I_MAX)) - I_MIN) / (I_MAX - I_MIN)) *
    (iH - IPAD.t - IPAD.b);

/* Palette aus den CSS-Variablen des Chart-Containers (Light/Dark via CSS). */
function cssVar(name) {
  if (!chartWrap.value) return "#888";
  return getComputedStyle(chartWrap.value).getPropertyValue(name).trim();
}

function sizeCanvases() {
  const wrap = chartWrap.value;
  if (!wrap || !oCanvas.value || !iCanvas.value) return;
  W = wrap.clientWidth;
  // Slidev skaliert die Folie per CSS-Transform — Backing-Store zusätzlich
  // mit dem effektiven Scale multiplizieren, sonst wird der Canvas unscharf.
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  for (const [c, h] of [
    [oCanvas.value, oH],
    [iCanvas.value, iH],
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
  ctx.strokeStyle = cssVar("--bw-grid-f");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let w = 0; w <= T; w += 2) {
    const x = Math.round(xOf(w)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar("--bw-grid-m");
  ctx.fillStyle = cssVar("--bw-muted");
  ctx.font = `10px ${MONO}`;
  ctx.beginPath();
  for (let w = 0; w <= T; w += 10) {
    const x = Math.round(xOf(w)) + 0.5;
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - pad.b);
    ctx.fillText("W" + w, x - 8, h - pad.b + 13);
  }
  for (const [val, lab] of yTicks) {
    const y = Math.round(yPos(val)) + 0.5;
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.fillText(lab, 6, y + 4);
  }
  ctx.stroke();
  // Achsen-Label oben links IM Plot (wie RetryStormSim — am linken Rand
  // kollidiert es mit dem obersten Y-Tick).
  ctx.fillText(yLabel, pad.l + 8, pad.t + 10);
  ctx.restore();
}
function stepMarker(ctx, h, pad, withLabel) {
  const x = xOf(STEP_T);
  ctx.save();
  ctx.strokeStyle = cssVar("--bw-step");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, pad.t);
  ctx.lineTo(x + 0.5, h - pad.b);
  ctx.stroke();
  if (withLabel) {
    ctx.fillStyle = cssVar("--bw-step-ink");
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("Nachfrage +20 % (dauerhaft)", x + 5, pad.t + 14);
  }
  ctx.restore();
}
/* Preisschock-Marker (nur Szenario 2): Micron hebt die Preise → Lagerabbau. */
function shockMarker(ctx, h, pad, withLabel) {
  if (scenario.value !== "priceshock") return;
  const x = xOf(SHOCK_T);
  ctx.save();
  ctx.strokeStyle = cssVar("--bw-danger");
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, pad.t);
  ctx.lineTo(x + 0.5, h - pad.b);
  ctx.stroke();
  if (withLabel) {
    ctx.fillStyle = cssVar("--bw-danger");
    ctx.font = `600 10px ${MONO}`;
    // eine Zeile tiefer als das Nachfrage-Sprung-Label (nur 5 Wochen entfernt)
    ctx.fillText("Preis ↑ → Lagerabbau", x + 5, pad.t + 28);
  }
  ctx.restore();
}
function stepLine(ctx, vals, getY, color, width, dash, alpha = 1, upTo = 1e9) {
  const n = Math.min(vals.length, upTo);
  if (n < 1) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  let started = false;
  for (let w = 0; w < n; w++) {
    const v = vals[w];
    if (v == null) {
      started = false;
      continue;
    }
    const x0 = xOf(w),
      x1 = xOf(Math.min(w + 1, T)),
      y = getY(v);
    if (!started) {
      ctx.moveTo(x0, y);
      started = true;
    } else ctx.lineTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawOrders() {
  const c = oCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    oH,
    PAD,
    [
      [0, "0"],
      [100, "100"],
      [200, "200"],
      [300, "300"],
      [400, "400"],
      [500, "500"],
      [600, "600"],
      [700, "700"],
    ],
    "Bestellungen [Riegel/Woche]",
    yOf,
  );
  stepMarker(ctx, oH, PAD, true);
  shockMarker(ctx, oH, PAD, true);
  // frühere Micron-Läufe
  if (visible[3])
    for (const run of oldRuns)
      stepLine(ctx, run, yOf, cssVar(TIER_STYLE[3].v), 1.6, [], 0.2);
  // Nachfrage (immer vollständig bekannt)
  if (visible.dem)
    stepLine(
      ctx,
      demandKnown,
      yOf,
      cssVar(DEM_STYLE.v),
      DEM_STYLE.w,
      DEM_STYLE.d,
    );
  // aktueller Lauf: Stufen 1..4
  if (sim) {
    for (let i = 0; i < K; i++)
      if (visible[i])
        stepLine(
          ctx,
          sim.orders[i],
          yOf,
          cssVar(TIER_STYLE[i].v),
          TIER_STYLE[i].w,
          TIER_STYLE[i].d,
        );
    // Overflow-Annotation Micron
    const mx = Math.max(0, ...sim.orders[3]);
    if (visible[3] && mx > O_MAX) {
      ctx.save();
      ctx.fillStyle = cssVar("--bw-danger");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "↑ Micron-Spitze: " + fmt(mx) + " — außerhalb der Skala",
        xOf(2),
        PAD.t + 24,
      );
      ctx.restore();
    }
  }
  // Vorhersage
  stepLine(
    ctx,
    sketch.points().map((p) => p.v),
    yOf,
    cssVar("--bw-pencil"),
    2,
    [7, 5],
  );
}
function drawInv() {
  const c = iCanvas.value;
  if (!c || !W) return;
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grid(
    ctx,
    iH,
    IPAD,
    [
      [0, "0"],
      [200, "200"],
      [400, "400"],
      [600, "600"],
    ],
    "Lagerbestand je Stufe [Riegel]",
    yI,
  );
  stepMarker(ctx, iH, IPAD, false);
  shockMarker(ctx, iH, IPAD, false);
  if (sim) {
    let mn = 0,
      mx = 0,
      any = false;
    for (let i = 0; i < K; i++)
      if (visible[i]) {
        // physisches On-hand-Lager: Netto-Bestand < 0 (Rückstand) zeigt sich als 0
        const oh = sim.inv[i].map((v) => Math.max(0, v));
        stepLine(
          ctx,
          oh,
          yI,
          cssVar(TIER_STYLE[i].v),
          Math.max(1.3, TIER_STYLE[i].w * 0.75),
          TIER_STYLE[i].d,
        );
        mn = Math.min(mn, ...oh);
        mx = Math.max(mx, ...oh);
        any = true;
      }
    if (any && (mx > I_MAX || mn < I_MIN)) {
      ctx.save();
      ctx.fillStyle = cssVar("--bw-scale-ink");
      ctx.font = `600 10px ${MONO}`;
      ctx.fillText(
        "Bestand (sichtbare Stufen): " +
          fmt(mn) +
          " … " +
          fmt(mx) +
          " (Skala begrenzt)",
        xOf(20),
        IPAD.t + 12,
      );
      ctx.restore();
    }
  }
}
function drawAll() {
  drawOrders();
  drawInv();
}

/* ===== Bekannte Nachfrage (vorab gezeigt, exakt der spätere Lauf) ===== */
function makeDemand() {
  const probe = new Chain(seed, L.value, alpha.value, share.value, chainOpts());
  probe.runTo(T);
  demandKnown = probe.demand; // gleicher Seed-Strom wie der spätere Lauf
}

/* ===== Skizzieren (Pointer → usePredictSketch) ===== */
function evToTV(ev) {
  const c = oCanvas.value;
  const rect = c.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * oH;
  return { t: wOf(x), v: vOf(y) };
}
function onOrdDown(ev) {
  if (phase.value !== "sketch") return;
  sketch.strokeStart();
  oCanvas.value.setPointerCapture(ev.pointerId);
  onOrdMove(ev);
}
function onOrdMove(ev) {
  if (!sketch.isDrawing()) return;
  const { t, v } = evToTV(ev);
  sketch.ink(t, v);
}
function onOrdUp() {
  sketch.strokeEnd();
}
watch(sketch.version, () => {
  if (phase.value !== "running") drawOrders();
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
function toggleTier(key) {
  visible[key] = !visible[key];
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
  sim = new Chain(seed, L.value, alpha.value, share.value, chainOpts());
  if (reduceMotion) {
    sim.runTo(T);
    drawAll();
    updateReadout();
    finishRun();
    return;
  }
  const framesPerWeek = 5;
  let frame = 0;
  const loop = () => {
    frame++;
    if (frame % framesPerWeek === 0 && sim.week < T) {
      sim.step();
      updateReadout();
    }
    drawAll();
    if (sim.week < T) animId = requestAnimationFrame(loop);
    else finishRun();
  };
  animId = requestAnimationFrame(loop);
}
function updateReadout() {
  if (!sim || !sim.week) return;
  const w = sim.week - 1;
  readout.value = {
    w,
    d: sim.demand[w],
    f: sim.orders[3][w],
    inv: Math.max(0, sim.inv[3][w]),
    z: sim.orders[3].filter((x) => x < 1).length,
  };
}

/* ===== Auswertung (verbatim) ===== */
const variance = (a) => {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length;
};
function classifyPeak(p) {
  return p == null ? null : p < 160 ? "smooth" : p <= 300 ? "over" : "whip";
}
const LABEL = {
  smooth: "eine glatte Anpassung",
  over: "moderates Überschwingen",
  whip: "starke Oszillation",
};
function finishRun() {
  phase.value = "done";
  animId = null;
  const top = sim.orders[3]; // Micron-Bestellungen (oberste Stufe)
  const realPeak = Math.max(...top);
  const zeroW = top.filter((x) => x < 1).length;
  // längste zusammenhängende Null-Serie (Blackout) bei Micron
  let blackout = 0,
    cur = 0;
  for (const x of top) {
    if (x < 1) blackout = Math.max(blackout, ++cur);
    else cur = 0;
  }
  const endOnHand = Math.max(0, sim.inv[3][sim.inv[3].length - 1]);
  let predPeak = null;
  if (!sketchSkipped.value) {
    const vals = sketch
      .points()
      .filter((p) => p.v != null)
      .map((p) => p.v);
    predPeak = vals.length ? Math.max(...vals) : null;
  }
  // Var-Ratio-Chips (beide Szenarien)
  const vd = variance(sim.demand);
  const chips =
    '<span class="chip">Varianz-Verstärkung vs. Nachfrage:</span>' +
    sim.orders
      .map(
        (o, i) =>
          '<span class="chip">' +
          TIER_NAMES[i] +
          " <b>×" +
          fmt(variance(o) / vd, 1) +
          "</b></span>",
      )
      .join("");

  if (scenario.value === "priceshock") {
    // Szenario 2: Fokus auf Blackout + Lagerabbau. Wichtig — die Bestell-Rate
    // erholt sich (jeder Riegel wird nachbestellt), nur der Bestand bleibt mager.
    const t =
      "Hoher Peak, dann Flaute — Micron " +
      blackout +
      " Wochen ohne Bestellung.";
    const b =
      'Micron bediente den Peak (<b class="mono">' +
      fmt(realPeak) +
      "</b>), hob dann die Preise → alle Stufen bauen Lager ab: <b>" +
      blackout +
      " Wochen ohne Bestellung</b> trotz konstantem Verbrauch. Danach erholt sich die Rate, doch der Puffer ist heruntergefahren — Bestand zum Schluss nur noch " +
      '<b class="mono">' +
      fmt(endOnHand) +
      "</b> Riegel (ohne Reserve) — Feast, dann Famine." +
      (predPeak != null
        ? ' (Vorhersage: <b class="mono">' + fmt(predPeak) + "</b>.)"
        : "");
    verdict.value = { tone: "bad", title: t, html: b, chips };
    return;
  }

  // Szenario 1 (Grundszenario): Vorhersage-Kategorie vs. gemessene Spitze.
  const rc = classifyPeak(realPeak),
    pc = classifyPeak(predPeak);
  const zeroTxt =
    zeroW > 0
      ? " Dazwischen bestellt Micron <b>" +
        zeroW +
        " Wochen lang nichts</b> — Bestellstopp, während Überbestände abgebaut werden."
      : "";
  let t, b;
  if (pc == null) {
    t =
      "Ergebnis: " +
      LABEL[rc] +
      " — Micron-Spitze " +
      fmt(realPeak) +
      " Riegel/Woche.";
    b =
      'Du hast keine Vorhersage abgegeben. Die Nachfrage stieg um 20 Riegel/Woche; die Micron-Bestellungen erreichten <b class="mono">' +
      fmt(realPeak) +
      "</b>." +
      zeroTxt;
  } else if (pc === rc) {
    t = "Deine Vorhersage trifft die Kategorie: " + LABEL[rc] + ".";
    b =
      'Deine Spitze: <b class="mono">' +
      fmt(predPeak) +
      '</b> · gemessen: <b class="mono">' +
      fmt(realPeak) +
      "</b> Riegel/Woche." +
      zeroTxt;
  } else {
    t = "Vorhersage: " + LABEL[pc] + " — tatsächlich: " + LABEL[rc] + ".";
    b =
      'Deine Spitze: <b class="mono">' +
      fmt(predPeak) +
      '</b> · gemessen: <b class="mono">' +
      fmt(realPeak) +
      "</b> Riegel/Woche — bei einer Nachfrageänderung von <b>+20</b>." +
      zeroTxt +
      (rc === "whip"
        ? " Beachte: Micron schwankt schon <b>vor</b> Woche 15 — der Bullwhip verstärkt auch reines Rauschen."
        : "");
  }
  verdict.value = {
    tone: rc === "whip" ? "bad" : pc === rc ? "ok" : "warn",
    title: t,
    html: b,
    chips,
  };
}

/* ===== Experimentieren (⚙) ===== */
function archiveAndRun(newSeed) {
  if (phase.value === "running") return;
  if (sim) oldRuns.push(sim.orders[3]);
  if (oldRuns.length > 6) oldRuns.shift();
  if (newSeed) seed = randomSeed();
  sim = null;
  phase.value = "sketch";
  makeDemand();
  drawAll();
  if (sketchReady.value && firstOk.value) startRun();
}
function softResetToSketch() {
  phase.value = "sketch";
  sim = null;
  verdict.value = null;
  readout.value = null;
  makeDemand();
}
function resetAll() {
  if (phase.value === "running") return;
  oldRuns = [];
  sketch.clear();
  L.value = 2;
  alpha.value = 0.4;
  share.value = false;
  scenario.value = "base";
  seed = randomSeed();
  readout.value = null;
  softResetToSketch();
  drawAll();
}

/* Szenario umschalten: laufenden Lauf abbrechen, zurück in die Skizze-Phase,
   alte Läufe verwerfen (stammen aus dem anderen Szenario), neu zeichnen. */
watch(scenario, () => {
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  oldRuns = [];
  softResetToSketch();
  drawAll();
});

/* ===== Lifecycle ===== */
watch(isDark, () => requestAnimationFrame(drawAll));
watch(isSlideActive, (active) => {
  // Folie verlassen während des Laufs: Animation abbrechen, Lauf synchron
  // zu Ende rechnen (Slidev hält Nachbar-Folien gemountet).
  if (!active && phase.value === "running" && sim) {
    if (animId) cancelAnimationFrame(animId);
    sim.runTo(T);
    finishRun();
    drawAll();
    updateReadout();
  }
});
onMounted(() => {
  makeDemand();
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
    eyebrow="Bullwhip-Effekt · Predict first"
    title="Die Peitsche in der Lieferkette"
    :subtitle="subtitle"
    presets-label="Vorhersage:"
    :presets="activePresets"
    gear-title="Experimentieren"
    show-reset
    show-rewind
    :reset-disabled="phase === 'running'"
    :rewind-disabled="phase === 'running' || !sketchHasInk"
    reset-title="Alles zurücksetzen: Kurve, Parameter und Lauf."
    rewind-title="Kurve behalten, Lauf zurücksetzen, Parameter wieder editierbar."
    @preset="applyPreset"
    @reset="resetAll"
    @rewind="softResetToSketch"
  >
    <template #transport>
      <div class="bw-seg" role="group" aria-label="Szenario wählen">
        <button
          class="bw-seg-btn"
          :class="{ 'bw-seg-on': scenario === 'base' }"
          :aria-pressed="scenario === 'base'"
          @click="scenario = 'base'"
        >
          Grundszenario
        </button>
        <button
          class="bw-seg-btn"
          :class="{ 'bw-seg-on': scenario === 'priceshock' }"
          :aria-pressed="scenario === 'priceshock'"
          @click="scenario = 'priceshock'"
        >
          Preisschock
        </button>
      </div>
    </template>

    <template #presets-extra>
      <button class="bw-btn bw-primary" :disabled="!canStart" @click="startRun">
        ▶ Simulation starten
      </button>
      <button
        class="bw-btn"
        :disabled="phase === 'running'"
        @click="clearSketch"
      >
        Skizze löschen
      </button>
      <button
        v-if="phase === 'sketch' && !sketchSkipped"
        class="bw-btn bw-linkish"
        @click="sketch.skip()"
      >
        ohne Vorhersage starten
      </button>
    </template>

    <template #stage>
      <div class="bw-stage">
        <Tabs
          class="bw-tabs"
          :tabs="[
            { key: 'sim', label: 'Simulation' },
            { key: 'erklaerung', label: 'Erklärung & Modell' },
          ]"
          :model-value="activeTab"
          aria-label="Ansicht wählen"
          @update:model-value="(v) => (activeTab = v)"
        />

        <div v-show="activeTab === 'sim'" ref="chartWrap" class="bw-charts">
          <div class="bw-chartbox">
            <canvas
              ref="oCanvas"
              aria-label="Bestellungen pro Woche. Zeichenfläche für die Vorhersage."
              @pointerdown="onOrdDown"
              @pointermove="onOrdMove"
              @pointerup="onOrdUp"
              @pointercancel="onOrdUp"
            />
            <div v-if="showSketchNote" class="bw-note">
              <b>✏️ Skizziere hier</b> die wöchentlichen Bestellungen von
              Micron, Woche 0–{{ T }} — oder wähle oben ein Preset.
            </div>
          </div>
          <div class="bw-chartbox">
            <canvas
              ref="iCanvas"
              aria-label="Lagerbestand der eingeblendeten Stufen über Zeit"
            />
          </div>
          <div class="bw-strip">
            <span v-if="readout" class="bw-readouts">
              Woche <b>{{ readout.w }}</b> · Nachfrage
              <b>{{ fmt(readout.d) }}</b> · Micron bestellt
              <b :class="{ bad: readout.f < 1 || readout.f > 300 }">{{
                fmt(readout.f)
              }}</b>
              · Micron-Bestand
              <b :class="{ bad: readout.inv < 1 }">{{ fmt(readout.inv) }}</b> ·
              {{ scenario === "priceshock" ? "Blackout" : "Bestell-Stopp" }}
              <b :class="{ bad: readout.z > 0 }">{{ readout.z }} Wo.</b>
            </span>
            <span class="bw-legend">
              <span class="lg">
                <svg width="18" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke-width="2"
                    stroke-dasharray="7 5"
                    style="stroke: var(--bw-pencil)"
                  />
                </svg>
                Vorhersage (Micron)
              </span>
              <button
                class="lg"
                :class="{ off: !visible.dem }"
                :aria-pressed="visible.dem"
                title="Linie ein-/ausblenden"
                @click="toggleTier('dem')"
              >
                <svg width="18" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke-width="2"
                    style="stroke: var(--bw-demand)"
                  />
                </svg>
                Nachfrage
              </button>
              <button
                class="lg"
                :class="{ off: !visible[0] }"
                :aria-pressed="visible[0]"
                title="Linien ein-/ausblenden"
                @click="toggleTier(0)"
              >
                <svg width="18" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke-width="2"
                    stroke-dasharray="2 3"
                    style="stroke: var(--bw-t1)"
                  />
                </svg>
                Lokales Inventar
              </button>
              <button
                class="lg"
                :class="{ off: !visible[1] }"
                :aria-pressed="visible[1]"
                title="Linien ein-/ausblenden"
                @click="toggleTier(1)"
              >
                <svg width="18" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke-width="2"
                    stroke-dasharray="9 4"
                    style="stroke: var(--bw-t2)"
                  />
                </svg>
                Zentrallager
              </button>
              <button
                class="lg"
                :class="{ off: !visible[2] }"
                :aria-pressed="visible[2]"
                title="Linien ein-/ausblenden"
                @click="toggleTier(2)"
              >
                <svg width="18" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke-width="2"
                    stroke-dasharray="10 3 2 3"
                    style="stroke: var(--bw-t3)"
                  />
                </svg>
                DigiKey
              </button>
              <button
                class="lg"
                :class="{ off: !visible[3] }"
                :aria-pressed="visible[3]"
                title="Linien ein-/ausblenden"
                @click="toggleTier(3)"
              >
                <svg width="18" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke-width="3.5"
                    style="stroke: var(--bw-fab)"
                  />
                </svg>
                Micron
              </button>
            </span>
          </div>
        </div>

        <div v-show="activeTab === 'erklaerung'" class="bw-explain">
          <div class="bw-sys" aria-label="RAM-Beschaffungskette">
            <span class="node"
              >Server / Workloads<span class="lbl"
                >{{ fmt(D0) }} → {{ fmt(D1) }} Riegel/Woche</span
              ></span
            >
            <span class="arrow">──▶<span class="lbl">Bestellung</span></span>
            <span class="node"
              >Lokales Inventar<span class="lbl">Stufe 1</span></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Zentrallager<span class="lbl">Stufe 2</span></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Distributor (z.&nbsp;B. DigiKey)<span class="lbl"
                >Stufe 3</span
              ></span
            >
            <span class="arrow">──▶</span>
            <span class="node"
              >Hersteller (z.&nbsp;B. Micron)<span class="lbl"
                >Lieferzeit je Stufe: {{ L }} Wochen</span
              ></span
            >
          </div>
          <p>
            Jede Stufe bestellt nach
            <span class="mono">q = d + (L+1)·α·(d − Prognose)</span>: Sie deckt
            die gesehene Nachfrage <b>und</b> korrigiert Ziel-Bestand plus
            Pipeline für <span class="mono">L+1</span> Wochen nach. Eine kleine
            Nachfrageänderung wird dadurch pro Stufe um den Faktor
            <span class="mono"
              >1 + (L+1)·α = 1 + {{ L + 1 }}·{{ fmt(alpha, 2) }} ≈
              {{ fmt(1 + (L + 1) * alpha, 2) }}</span
            >
            überzeichnet — und die nächste Stufe reagiert nicht auf die
            Nachfrage, sondern <b>auf diese Überzeichnung</b>. Vier Stufen
            verketten sich multiplikativ: aus +20 % Nachfrage werden
            Bestellspitzen vom Mehrfachen, gefolgt von Wochen mit
            <b>null</b> Bestellungen, während die Überbestände abgebaut werden.
          </p>
          <p>
            <b>Zweites Szenario (Preisschock):</b> Micron sieht die hohe
            Nachfrage, bedient noch den Bestell-Peak und hebt dann in Woche
            {{ SHOCK_T }} die Preise für Folgebestellungen leicht an. Jede Stufe
            senkt daraufhin ihr Ziel-Lager und fährt zuerst den Überbestand
            herunter — bei Micron kommen
            <b>wochenlang keine Bestellungen</b> an, obwohl die Server
            unverändert RAM verbrauchen: hoher Peak, unmittelbar gefolgt von der
            Flaute. Die Bestell-<b>Rate</b> erholt sich danach wieder (jeder
            verbrauchte Riegel wird nachbestellt), doch der Lagerbestand bleibt
            <b>dauerhaft magerer</b> — die Peitsche in Gegenrichtung.
          </p>
          <p>
            <b>Besonders fatal für den Hersteller:</b> Wer die Kapazität am
            Nachfrage-Peak ausrichtet — eine neue Fab, zusätzliche Linien —, hat
            <b>Kapital in Überkapazität gebunden</b>, wenn direkt danach die
            Flaute kommt: die Bestellungen brechen weg, die teure Kapazität
            steht leer, aus dem Peak wird ein finanzielles Problem. In der IT
            dasselbe Muster — Kapazität (Nodes, Reserved Instances, Committed
            Spend) auf einen Last-Peak dimensioniert, der sich als
            Bullwhip-Artefakt entpuppt.
          </p>
          <p>
            Das ist String-Instabilität in Reinform: Die Verstärkung jeder Stufe
            liegt über 1, also wächst jede Störung stromaufwärts — obwohl jede
            Stufe für sich „vernünftig" handelt. P&amp;G beobachtete genau das
            bei Pampers: Babys verbrauchen Windeln gleichmäßig, die
            Bestellschwankungen wuchsen trotzdem Stufe um Stufe (Lee,
            Padmanabhan &amp; Whang 1997). Beachte in der Simulation: Micron
            schwankt <b>schon vor</b> der Nachfrageänderung deutlich — reines
            Rauschen wird genauso verstärkt wie die Stufe.
          </p>
          <p>
            Dieses Modell isoliert bewusst nur <b>eine</b> der vier
            Bullwhip-Ursachen nach Lee et&nbsp;al. (Demand Signal Processing).
            Losgrößen, Preisaktionen und Rationierungs-Gaming kämen in der
            Realität noch obendrauf. Die Gegenmaßnahme im Experimentiermodus —
            alle Stufen sehen die
            <b>echte Server-Nachfrage</b> (POS-/Fleet-Daten) statt der
            Bestellungen ihrer Nachbarstufe — ist die klassische Empfehlung:
            Informationsteilung. IT-Übersetzung: verkettete Autoscaler, die auf
            die Last ihrer Nachbarstufe statt auf die echte Endlast reagieren,
            bauen dieselbe Peitsche.
          </p>
          <p class="bw-foot">
            <b>Bewusste Vereinfachungen dieses Modells:</b> Order-up-to-Politik
            mit exponentieller Glättung (nach Chen, Drezner, Ryan &amp;
            Simchi-Levi 2000); Grundszenario nur Ursache 1 nach Lee et&nbsp;al.
            (keine Losgrößen oder Rationierung), das Preisschock-Szenario
            ergänzt eine stilisierte Preisreaktion (abgesenktes Ziel-Lager →
            Lagerabbau); Bestellinformation erreicht die nächste Stufe noch in
            derselben Woche, nur Material braucht L Wochen; unbegrenzte
            Produktions- und Lieferkapazität; intern führt das Modell — wie in
            der Bestandstheorie üblich — den vorzeichenbehafteten Netto-Bestand
            (negativ = Rückstand/Backorder), der Chart zeigt daraus den
            physischen On-hand-Bestand ≥ 0 (0 = Stockout, der Fehlbetrag wird
            nachgeliefert); Bestellungen ≥ 0; Nachfragerauschen normalverteilt
            (σ = 2). Kaskaden-Verstärkung, Monotonie in L und α sowie die
            Wirkung der Informationsteilung wurden numerisch verifiziert.
          </p>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="bw-gear">
        <QueueSlider
          :model-value="L"
          label="Lieferzeit L je Stufe"
          :min="1"
          :max="3"
          :step="1"
          unit=" Wo."
          @update:model-value="(v) => (L = v)"
        />
        <QueueSlider
          :model-value="alpha"
          label="Prognose-Reaktionsfreude α"
          :min="0.2"
          :max="0.7"
          :step="0.05"
          unit=""
          @update:model-value="(v) => (alpha = v)"
        />
        <label class="bw-share">
          <input v-model="share" type="checkbox" />
          Alle Stufen sehen die echte Server-Nachfrage (POS-Sharing)
        </label>
        <p class="bw-gear-hint">
          Längere Lieferzeiten und nervösere Prognosen verstärken die Peitsche —
          Informationsteilung dämpft sie drastisch. Frühere Micron-Läufe bleiben
          blass sichtbar.
        </p>
        <div class="bw-gear-btns">
          <button
            class="bw-btn bw-primary"
            :disabled="phase === 'running'"
            @click="archiveAndRun(true)"
          >
            Nochmal (neuer Seed)
          </button>
          <button
            class="bw-btn"
            :disabled="phase === 'running'"
            @click="archiveAndRun(false)"
          >
            Gleicher Seed
          </button>
          <button
            class="bw-btn"
            :disabled="phase === 'running'"
            @click="resetAll"
          >
            Alles zurücksetzen
          </button>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="covWarnAll" class="bw-banner bw-warnb">
        Zeichne die Kurve über den ganzen Zeitraum — von (fast) links bis (fast)
        rechts.
      </div>
      <div v-else-if="verdict" class="bw-banner" :class="`bw-${verdict.tone}`">
        <b>{{ verdict.title }}</b>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="verdict.html" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="bw-chips" v-html="verdict.chips" />
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Papier-Palette des Originals (Light verbatim), Dark-Variante daneben.
   Der Canvas-Code liest diese Variablen via getComputedStyle(chartWrap). */
.bw-stage,
.bw-charts,
.bw-explain,
.bw-gear {
  --bw-paper: #e9eeea;
  --bw-panel: #fcfdfc;
  --bw-ink: #16282c;
  --bw-muted: #5c6b6a;
  --bw-grid-f: #e2eae4;
  --bw-grid-m: #c6d3cb;
  --bw-pencil: #6a7480;
  --bw-demand: #37424d;
  --bw-t1: #56b4e9;
  --bw-t2: #009e73;
  --bw-t3: #e69f00;
  --bw-fab: #d55e00;
  --bw-danger: #af3e1b;
  --bw-ok: #3d7a46;
  --bw-step: #c8912f;
  --bw-step-ink: #8a6210;
  --bw-scale-ink: #8a5f0c;
}
:global(html.dark .bw-stage),
:global(html.dark .bw-charts),
:global(html.dark .bw-explain),
:global(html.dark .bw-gear) {
  --bw-paper: #101a1c;
  --bw-panel: #0d1517;
  --bw-ink: #dce8e6;
  --bw-muted: #8fa3a0;
  --bw-grid-f: #1b2a2c;
  --bw-grid-m: #2d4246;
  --bw-pencil: #93a1ad;
  --bw-demand: #b9c7d3;
  --bw-t1: #6cc4f5;
  --bw-t2: #1fbd8e;
  --bw-t3: #f2b02e;
  --bw-fab: #f0762b;
  --bw-danger: #e0684a;
  --bw-ok: #69b877;
  --bw-step: #b98a2e;
  --bw-step-ink: #d9a62e;
  --bw-scale-ink: #d9a62e;
}

.bw-tabs {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-bar-mb: 6px;
}

.bw-charts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bw-chartbox {
  position: relative;
  background: var(--bw-panel);
  border: 1px solid var(--bw-grid-m);
  border-radius: 8px;
  padding: 4px;
}
.bw-chartbox canvas {
  display: block;
  width: 100%;
  touch-action: none;
  cursor: crosshair;
}
.bw-note {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--bw-panel) 88%, transparent);
  border: 1px dashed var(--bw-pencil);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--bw-ink);
  pointer-events: none;
  text-align: center;
}
.bw-strip {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.bw-readouts {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--bw-muted);
}
.bw-readouts b {
  color: var(--bw-ink);
  font-weight: 600;
}
.bw-readouts b.bad {
  color: var(--bw-danger);
}
.bw-legend {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 9px;
  color: var(--bw-muted);
}
.bw-legend .lg {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-family: inherit;
  color: var(--bw-muted);
  background: none;
  border: none;
  padding: 0;
}
.bw-legend button.lg {
  cursor: pointer;
}
.bw-legend .lg.off {
  opacity: 0.35;
  text-decoration: line-through;
}

/* Szenario-Umschalter (Header/Transport-Slot): über die theme-sicheren
   SimShell-Chrome-Variablen gefärbt — die scoped --bw-*-Papier-Palette greift
   im Header NICHT (Light-Fallback in Dark, wie bei Reset/⚙). */
.bw-seg {
  display: inline-flex;
  gap: 4px;
}
.bw-seg-btn {
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
  background: var(--c-panelHi);
  color: var(--c-textHi);
  border: 1px solid var(--c-border);
}
.bw-seg-on {
  background: var(--c-panel);
  border-color: var(--c-phosphor);
  box-shadow: inset 0 0 0 1px var(--c-phosphor);
}

/* Buttons in Preset-Zeile & ⚙ */
.bw-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  background: var(--bw-panel, #fcfdfc);
  color: inherit;
  border: 1px solid var(--bw-grid-m, #c6d3cb);
}
.bw-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.bw-primary {
  border-color: var(--bw-ok, #3d7a46);
  font-weight: 600;
}
.bw-linkish {
  border: none;
  background: none;
  text-decoration: underline;
  opacity: 0.7;
}

/* Erklärung-Tab */
.bw-explain {
  max-height: 340px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--bw-ink);
  padding-right: 6px;
}
.bw-explain p {
  margin: 0 0 8px;
}
.bw-explain .mono {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
}
.bw-sys {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 8px;
}
.bw-sys .node {
  border: 1px solid var(--bw-grid-m);
  background: var(--bw-panel);
  border-radius: 8px;
  padding: 5px 10px;
  display: inline-flex;
  flex-direction: column;
  font-weight: 600;
}
.bw-sys .node .lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--bw-muted);
  font-family: var(--slidev-code-font-family);
}
.bw-sys .arrow {
  color: var(--bw-muted);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}
.bw-sys .arrow .lbl {
  font-size: 8px;
  font-family: var(--slidev-code-font-family);
}
.bw-foot {
  font-size: 9px;
  color: var(--bw-muted);
}

/* ⚙-Panel */
.bw-gear {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}
.bw-share {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.bw-share input {
  accent-color: var(--bw-fab, #d55e00);
}
.bw-gear-hint {
  font-size: 10px;
  opacity: 0.7;
  margin: 0;
}
.bw-gear-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Footer-Banner (außerhalb der Palette-Container → Literalfarben wie im
   RetryStormSim-Footer) */
.bw-banner {
  font-size: 10px;
  line-height: 1.35;
  border: 1px solid;
  border-radius: 7px;
  padding: 3px 9px;
  margin-top: 4px;
}
.bw-banner :deep(.mono) {
  font-family: var(--slidev-code-font-family);
}
.bw-chips {
  display: block;
  margin-top: 2px;
}
.bw-banner :deep(.chip) {
  display: inline-block;
  border: 1px solid #c6d3cb;
  border-radius: 999px;
  padding: 0 7px;
  margin: 1px 3px 0 0;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
}
:global(html.dark .bw-banner .chip) {
  border-color: #2d4246;
}
.bw-warnb {
  border-color: #c8912f;
  color: #8a6210;
}
:global(html.dark .bw-warnb) {
  color: #d9a62e;
}
.bw-ok {
  border-color: #3d7a46;
}
.bw-warn {
  border-color: #c8912f;
}
.bw-bad {
  border-color: #af3e1b;
}
</style>
