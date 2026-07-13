<script setup>
/**
 * LittleLawDrill.vue — Rechen-Drills zu Little's Law auf Basis der
 * Kantinen-Mechanik: pro Runde sind zwei der drei Größen (λ, W, N — bzw.
 * Kapazität c) sichtbar, eine ist verdeckt. Erst schätzen (Slider optional,
 * Zuruf reicht), dann ▶ Messen: die Gauges konvergieren live auf die
 * Antwort, das Verdict zeigt Messwert, Theorie und Rechenweg.
 * Engine: lib/littleEngine.js (seeded M/M/c, Seit-Anker-Statistiken).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useIsSlideActive } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import QueueSlider from "./QueueSlider.vue";
import TheoryGauge from "./TheoryGauge.vue";
import InfoPopover from "./InfoPopover.vue";
import { LittleEngine } from "./lib/littleEngine.js";
import { theory } from "./lib/mmc.js";
import { fmtDe, randomSeed } from "./lib/rng.js";
import { useScopeColors } from "./lib/useScopeColors";
import { useInfoPopover } from "./lib/useInfoPopover";

const C = useScopeColors();
const { info, toggle } = useInfoPopover();
const isSlideActive = useIsSlideActive();
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const fmtMs = (s, d = 1) => fmtDe(s * 1000, d) + " ms";
const fmtS = (s) => fmtDe(s, 0) + " s";

/* ===== Die fünf Runden ===== */
const SLO_R3 = 0.01; // 10 ms Ziel-Wartezeit in Runde 3
const ROUNDS = {
  pool: {
    label: "1 · Thread-Pool",
    presetTitle: "N verdeckt: Wie viele Requests sind gleichzeitig offen?",
    scenario:
      "Ein Web-Service bekommt λ = 200 req/s; jede Anfrage dauert im Mittel W = 150 ms. Wie viele Requests sind gleichzeitig offen — wie groß muss der Thread-Pool mindestens sein?",
    seed: 4221,
    speed: 1.2,
    settle: 1500,
    warmup: 200,
    mk: () => ({ lambda: 200, mu: 1 / 0.15, c: 64 }),
    wKind: "w",
    hiddenLabel: "gleichzeitig offen N",
    cards: [
      {
        k: "lam",
        label: "Ankunftsrate λ",
        value: "200 req/s",
        sub: "LB-Dashboard",
      },
      {
        k: "w",
        label: "Verweilzeit W",
        value: "150 ms",
        sub: "mittlere Bearbeitung",
      },
      {
        k: "n",
        label: "gleichzeitig offen N",
        hidden: true,
        sub: "Runtime-Metrik",
      },
    ],
    est: {
      label: "Schätzung: N",
      min: 5,
      max: 100,
      step: 1,
      unit: " Req.",
      def: 20,
    },
    gmax: { thr: 260, w: 0.45, n: 60 },
    theo: () => ({ thr: 200, w: 0.15, n: 30 }),
    measured: (ro) => ro.n,
    ansNat: () => 30,
    ansFmt: (v) => fmtDe(v, 0) + " Requests",
    estNat: (e) => e,
    formula:
      "N = λ · W = 200/s · 0,15 s = 30 offene Requests (Pool ≥ 30, mit Puffer ≈ 2×).",
  },
  lag: {
    label: "2 · Consumer-Lag",
    presetTitle: "W verdeckt: Wie alt ist eine Nachricht bei der Verarbeitung?",
    scenario:
      "Ein Kafka-Topic hat konstant ≈ 3.000 Nachrichten Lag; der Consumer schafft λ = 25 msg/s. Wie alt ist eine Nachricht, wenn sie verarbeitet wird?",
    seed: 4202,
    speed: 3,
    settle: 300,
    warmup: 0,
    mk: () => ({ lambda: 25, mu: 25, c: 1, backlog0: 3000 }),
    wKind: "w",
    hiddenLabel: "Alter bei Verarbeitung W",
    cards: [
      { k: "n", label: "Lag N", value: "3.000 msg", sub: "Kafka-Dashboard" },
      {
        k: "lam",
        label: "Durchsatz λ",
        value: "25 msg/s",
        sub: "Consumer-Rate",
      },
      {
        k: "w",
        label: "Alter bei Verarbeitung W",
        hidden: true,
        sub: "sieht kein Dashboard",
      },
    ],
    est: {
      label: "Schätzung: W",
      min: 5,
      max: 300,
      step: 5,
      unit: " s",
      def: 30,
    },
    gmax: { thr: 40, w: 240, n: 4000 },
    theo: () => ({ thr: 25, w: 120, n: 3000 }),
    measured: (ro) => ro.w,
    ansNat: () => 120,
    ansFmt: (v) => fmtS(v) + " = " + fmtDe(v / 60, 0) + " min",
    estNat: (e) => e,
    formula:
      "W = N / λ = 3.000 msg / 25 msg/s = 120 s. Lag misst man in Sekunden, nicht in Messages.",
  },
  worker: {
    label: "3 · Worker-Pool",
    presetTitle: "c verdeckt: Wie viele Worker für das Latenz-SLO?",
    scenario:
      "λ = 120 req/s, Bedienzeit S = 25 ms (ein Worker schafft 40 req/s). SLO: mittlere Wartezeit Wq ≤ 10 ms. Wie viele Worker braucht der Pool? Wähle c und miss nach.",
    seed: 4204,
    speed: 1.5,
    settle: 800,
    warmup: 200,
    mk: (est) => ({ lambda: 120, mu: 40, c: est }),
    wKind: "wq",
    hiddenLabel: "Worker c",
    cards: [
      {
        k: "lam",
        label: "Last",
        value: "120 req/s · S = 25 ms",
        sub: "a = λ/μ = 3 Erlangs",
      },
      {
        k: "slo",
        label: "SLO",
        value: "Wq ≤ 10 ms",
        sub: "mittlere Wartezeit",
      },
      { k: "c", label: "Worker c", hidden: true, sub: "Slider wählt c" },
    ],
    est: { label: "Worker c", min: 3, max: 8, step: 1, unit: "", def: 4 },
    gmax: { thr: 160, w: 0.03, n: 12 },
    theo: (est) => {
      const t = theory("pool", 120, 40, est);
      return { thr: 120, w: t.Wq, n: t.L };
    },
    measured: (ro) => ro.w,
    ansNat: () => 5,
    ansFmt: (v) => "c = " + fmtDe(v, 0),
    estNat: (e) => e,
    formula:
      "Erlang-C bei a = 3: c=4 → Wq ≈ 12,7 ms ✗ · c=5 → ≈ 3,0 ms ✓ · c=6 → ≈ 0,8 ms. Antwort: c = 5 — Durchsatz-Headroom (c=4, ρ=0,75) reicht nicht fürs Latenz-SLO.",
  },
  headroom: {
    label: "4 · Headroom",
    presetTitle: "Wq′ verdeckt: Was machen +15 % Traffic mit der Wartezeit?",
    scenario:
      "Eine API läuft bei λ = 800 req/s auf Kapazität μ = 1.000 req/s (ρ = 0,80, Wq heute ≈ 4 ms). Marketing kündigt +15 % Traffic an. Erst heute messen, dann einspielen: Wie groß wird Wq?",
    seed: 4318,
    speed: 0.5,
    settle: 300,
    settle2: 1900,
    warmup: 200,
    bumpWarmup: 300,
    needsBump: true,
    bumpLambda: 920,
    mk: () => ({ lambda: 800, mu: 1000, c: 1 }),
    wKind: "wq",
    hiddenLabel: "Wq nach +15 %",
    cards: [
      {
        k: "now",
        label: "Heute",
        value: "ρ = 0,80 · Wq ≈ 4 ms",
        sub: "λ = 800/s · μ = 1.000/s",
      },
      {
        k: "bump",
        label: "Ankündigung",
        value: "+15 % Traffic",
        sub: "λ → 920/s (ρ = 0,92)",
      },
      {
        k: "w",
        label: "Wq nach +15 %",
        hidden: true,
        sub: "erst messen, dann einspielen",
      },
    ],
    est: {
      label: "Schätzung: Wq′",
      min: 4,
      max: 40,
      step: 0.5,
      unit: " ms",
      def: 8,
    },
    gmax: { thr: 1000, w: 0.02, n: 30 },
    theo: (est, bumped) =>
      bumped
        ? { thr: 920, w: 0.0115, n: 920 * 0.0125 }
        : { thr: 800, w: 0.004, n: 800 * 0.005 },
    measured: (ro) => ro.w,
    ansNat: () => 0.0115,
    ansFmt: (v) => fmtMs(v),
    estNat: (e) => e / 1000,
    formula:
      "Wq = ρ/(μ−λ): heute 0,80/200 = 4 ms → morgen 0,92/80 = 11,5 ms — fast 3×. „20 % Luft“ auf der CPU ist Faktor 3 auf der Hyperbel.",
  },
  check: {
    label: "5 · Konsistenz-Check",
    presetTitle: "λ verdeckt: Was muss das LB-Dashboard zeigen?",
    scenario:
      "Tracing zeigt im Mittel N = 24 offene Requests pro Instanz, mittlere Trace-Dauer W = 60 ms. Was muss das Load-Balancer-Dashboard als Rate pro Instanz zeigen — und was, wenn nicht?",
    seed: 4224,
    speed: 1.2,
    settle: 1500,
    warmup: 200,
    mk: () => ({ lambda: 400, mu: 1 / 0.06, c: 48 }),
    wKind: "w",
    hiddenLabel: "Rate λ",
    cards: [
      {
        k: "n",
        label: "in-flight N",
        value: "24 Requests",
        sub: "Runtime/Tracing",
      },
      {
        k: "w",
        label: "Trace-Dauer W",
        value: "60 ms",
        sub: "Tracing p50≈Mittel",
      },
      { k: "lam", label: "Rate λ", hidden: true, sub: "LB-Dashboard" },
    ],
    est: {
      label: "Schätzung: λ",
      min: 50,
      max: 1000,
      step: 10,
      unit: " req/s",
      def: 200,
    },
    gmax: { thr: 500, w: 0.12, n: 40 },
    theo: () => ({ thr: 400, w: 0.06, n: 24 }),
    measured: (ro) => ro.thr,
    ansNat: () => 400,
    ansFmt: (v) => fmtDe(v, 0) + " req/s",
    estNat: (e) => e,
    formula:
      "λ = N / W = 24 / 0,06 s = 400 req/s. Erfüllen LB-λ, Tracing-W und Runtime-N Little nicht, misst eine der drei Quellen falsch.",
  },
};
const ROUND_KEYS = ["pool", "lag", "worker", "headroom", "check"];
const presetList = ROUND_KEYS.map((k) => ({
  key: k,
  label: ROUNDS[k].label,
  title: ROUNDS[k].presetTitle,
}));
const TABS = [
  { key: "drill", label: "Drill" },
  { key: "model", label: "Erklärung & Modell" },
];

/* ===== Zustand ===== */
const activeKey = ref("pool");
const phase = ref("frage"); // frage | messen | fertig
const playing = ref(false);
const estimate = ref(ROUNDS.pool.est.def);
const estimateTouched = ref(false);
const bumped = ref(false);
const timeScale = ref(1);
const seedOverride = ref(0); // 0 = Runden-Seed
const verdict = shallowRef(null);
const readout = shallowRef(null);

/* nicht-reaktiv (Hot-Path) */
let engine = null;
let raf = 0;
let last = 0;
let lastSample = 0;
let graceAt = 0;

const R = computed(() => ROUNDS[activeKey.value]);
const theo = computed(() => R.value.theo(estimate.value, bumped.value));

function buildEngine() {
  const r = R.value;
  const p = r.mk(estimate.value);
  engine = new LittleEngine({ ...p, seed: seedOverride.value || r.seed });
  // Kurzer synchroner Warmlauf, dann Anker: die Messung startet ohne den
  // Leerstart-Transienten (sonst zieht der die kumulierten Mittel nach unten).
  let guard = 0;
  while (engine.depSince() < (r.warmup || 0) && guard++ < 2000)
    engine.advance(engine.clock + 0.5);
  engine.markChange();
}
function loadRound(key) {
  activeKey.value = key;
  seedOverride.value = 0;
  restartRound();
  estimate.value = ROUNDS[key].est.def;
  estimateTouched.value = false;
}
function restartRound() {
  engine = null;
  phase.value = "frage";
  playing.value = false;
  bumped.value = false;
  verdict.value = null;
  readout.value = null;
  graceAt = 0;
}
function startMeasure() {
  if (!engine) buildEngine();
  phase.value = "messen";
  playing.value = true;
  graceAt = 0;
}
function togglePlay() {
  if (phase.value === "fertig") return;
  if (phase.value === "frage") {
    if (REDUCED) {
      resolveNow();
      return;
    }
    startMeasure();
    return;
  }
  playing.value = !playing.value;
}
function curSettle() {
  const r = R.value;
  return bumped.value && r.settle2 ? r.settle2 : r.settle;
}
function resolveNow() {
  if (phase.value === "fertig") return;
  if (!engine) buildEngine();
  phase.value = "messen";
  const target = curSettle();
  let guard = 0;
  while (engine.depSince() < target && guard++ < 5000)
    engine.advance(engine.clock + 0.5);
  finish();
}
function finish() {
  playing.value = false;
  sampleReadout();
  verdict.value = makeVerdict();
  phase.value = "fertig";
}
function newSeed() {
  seedOverride.value = randomSeed();
  restartRound();
}

/* Kontext-Aktion (presets-extra): R4 Lastsprung · R3 Nachmessen mit c=5 */
const action = computed(() => {
  const k = activeKey.value;
  if (k === "headroom" && phase.value !== "frage" && !bumped.value)
    return { key: "bump", label: "⚡ +15 % Traffic einspielen" };
  const c = readout.value ? readout.value.c : 0;
  if (k === "worker" && phase.value === "fertig" && c !== 5)
    return { key: "c5", label: "Mit c = 5 nachmessen" };
  return null;
});
function doAction() {
  const a = action.value;
  if (!a) return;
  if (a.key === "bump") {
    engine.setLambda(R.value.bumpLambda);
    // Kurzer Warmlauf im neuen Regime, dann Anker — die Messung gehört
    // vollständig zur neuen Last (ohne Übergangs-Transienten).
    let guard = 0;
    while (engine.depSince() < (R.value.bumpWarmup || 0) && guard++ < 2000)
      engine.advance(engine.clock + 0.5);
    engine.markChange();
    bumped.value = true;
    verdict.value = null;
    phase.value = "messen";
    playing.value = true;
    graceAt = 0;
    if (REDUCED) resolveNow();
  } else if (a.key === "c5") {
    estimate.value = 5;
    estimateTouched.value = true;
    engine = null;
    verdict.value = null;
    startMeasure();
  }
}
function onEstimate(v) {
  estimate.value = v;
  estimateTouched.value = true;
}

/* ===== Verdict ===== */
function grade(est, ans) {
  const rel = Math.abs(est - ans) / ans;
  if (rel <= 0.2) return { t: "ok", txt: "Volltreffer" };
  if (rel <= 0.5) return { t: "warn", txt: "Größenordnung stimmt" };
  return { t: "bad", txt: "die Formel schlägt das Bauchgefühl" };
}
function makeVerdict() {
  const key = activeKey.value;
  const r = R.value;
  const ro = readout.value;
  if (key === "headroom" && !bumped.value) {
    return {
      tone: "info",
      head: `Heute bestätigt: Wq ≈ ${fmtMs(ro.w)} bei ρ = 0,80.`,
      lines: [
        "Jetzt „⚡ +15 % Traffic einspielen“ — erst schätzen: Was macht das mit Wq?",
      ],
    };
  }
  if (key === "worker") {
    const c = ro.c;
    const t = theory("pool", 120, 40, c);
    const lines = [r.formula];
    if (t.rho >= 1)
      return {
        tone: "bad",
        head: `c = ${c}: ρ = 1 — kein Gleichgewicht, die Schlange wächst unbegrenzt (Momentaufnahme Wq: ${fmtMs(ro.w)}).`,
        lines,
      };
    const ok = t.Wq <= SLO_R3;
    let tone = "warn";
    if (c === 5) tone = "ok";
    if (c > 5) lines.push("SLO hält, aber überprovisioniert — c = 5 reicht.");
    return {
      tone,
      head: `c = ${c}: Wq gemessen ${fmtMs(ro.w)} · Theorie ${fmtMs(t.Wq)} — SLO ≤ 10 ms ${ok ? "hält ✓" : "gerissen ✗"}.`,
      lines,
    };
  }
  const meas = r.measured(ro);
  const lines = [r.formula];
  let tone = "info";
  if (estimateTouched.value) {
    const g = grade(r.estNat(estimate.value), r.ansNat());
    tone = g.t;
    lines.push(
      `Deine Schätzung: ${fmtDe(estimate.value, 0)}${r.est.unit} — ${g.txt}.`,
    );
  }
  return {
    tone,
    head: `${r.hiddenLabel}: gemessen ${r.ansFmt(meas)} · Theorie ${r.ansFmt(r.ansNat())}.`,
    lines,
  };
}

/* ===== rAF-Loop ===== */
function sampleReadout() {
  if (!engine) return;
  const r = R.value;
  const w =
    (r.wKind === "wq" ? engine.meanWqSince() : engine.meanWSince()) ?? 0;
  readout.value = {
    thr: engine.thrSince(),
    w: w ?? 0,
    n: engine.LavgSince(),
    nNow: engine.N(),
    little: engine.littleSince(),
    served: engine.depSince(),
    queue: engine.queue.length,
    busy: engine.busy(),
    c: engine.c,
  };
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (phase.value !== "messen" || !engine) return;
  if (playing.value)
    engine.advance(engine.clock + dtReal * R.value.speed * timeScale.value);
  if (now - lastSample > 140) {
    lastSample = now;
    sampleReadout();
  }
  if (engine.depSince() >= curSettle()) {
    if (!graceAt) graceAt = now + 500;
    else if (now >= graceAt) finish();
  } else {
    graceAt = 0;
  }
}
watch(isSlideActive, (a) => {
  if (!a) playing.value = false;
});
onMounted(() => {
  last = performance.now();
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf);
});

/* ===== abgeleitete Anzeige ===== */
const playLabel = computed(() => {
  if (phase.value === "frage") return "▶ Messen";
  return playing.value ? "⏸ Pause" : "▶ Weiter";
});
const revealed = computed(
  () => phase.value === "fertig" && (!R.value.needsBump || bumped.value),
);
const cardViews = computed(() => {
  const r = R.value;
  const ro = readout.value;
  return r.cards.map((c) => {
    if (!c.hidden) return { ...c, isHidden: false };
    let value = "?";
    let sub = c.sub;
    if (activeKey.value === "worker" && ro) {
      value = phase.value === "fertig" ? "c = 5 nötig" : `c = ${ro.c}`;
      sub = phase.value === "fertig" ? `gewählt: c = ${ro.c}` : "Messung läuft";
    } else if (revealed.value && ro) {
      value = r.ansFmt(r.measured(ro));
      sub = "gemessen";
    } else if (phase.value === "messen") {
      value = "… misst";
    } else if (estimateTouched.value) {
      sub = `Schätzung: ${fmtDe(estimate.value, 0)}${r.est.unit}`;
    }
    return { k: c.k, label: c.label, value, sub, isHidden: true };
  });
});
const flowLine = computed(() => {
  const ro = readout.value;
  if (!ro)
    return "λ → 🧍 Warteschlange → 🧑‍🍳 Bedienung → ✓ Abgang — ▶ Messen startet den Strom";
  return `λ̂ ${fmtDe(ro.thr, 0)}/s → 🧍 ${fmtDe(ro.queue, 0)} wartend → 🧑‍🍳 ×${ro.c} (${ro.busy} aktiv) → ✓ ${fmtDe(ro.served, 0)} bedient`;
});
const estHint = computed(() => {
  if (activeKey.value === "worker") return "Slider wählt c — dann ▶ Messen.";
  if (phase.value === "frage") return "optional — Zuruf zählt auch";
  return "";
});

const HELP = {
  "g-thr":
    "Bediente pro Sekunde seit der letzten Änderung (gemessen). Strich = Soll-λ. In Runde 5 ist genau dieser Wert die gesuchte Größe.",
  "g-w":
    "Mittlere Zeit pro Auftrag seit der letzten Änderung — je nach Runde Verweilzeit W (warten + bedienen) oder reine Wartezeit Wq. Strich = Theorie.",
  "g-n":
    "Zeitgemittelte Anzahl im System (∫N dt / t) seit der letzten Änderung — das L aus L = λ·W. Sub-Zeile: momentaner Wert (springt).",
  "g-little":
    "Konsistenztest λ̂·Ŵ/L̂ = ΣW / ∫N dt. Muss gegen 1,0 gehen, wenn die Messung stimmt — Abweichung heißt: zu wenig Daten oder inkonsistente Quellen.",
  settle:
    "Messfortschritt in Abgängen seit der letzten Änderung. Voller Balken = genug Daten für ein stabiles Mittel; danach erscheint das Verdict.",
};
const gauges = computed(() => {
  const r = R.value;
  const t = theo.value;
  const ro = readout.value;
  const g = r.gmax;
  const wLabel = r.wKind === "wq" ? "Wartezeit Ŵq" : "Verweilzeit Ŵ";
  const fmtWv = (v) =>
    g.w >= 10 ? fmtDe(v, 0) : fmtDe(v * 1000, v * 1000 < 10 ? 1 : 0);
  const wUnit = g.w >= 10 ? "s" : "ms";
  const tW = Number.isFinite(t.w) ? t.w : null;
  if (!ro)
    return [
      {
        iid: "g-thr",
        label: "Durchsatz λ̂",
        value: "–",
        unit: "/s",
        frac: 0,
        markFrac: t.thr / g.thr,
        color: C.value.phosphor,
        sub: "▶ Messen",
      },
      {
        iid: "g-w",
        label: wLabel,
        value: "–",
        unit: wUnit,
        frac: 0,
        markFrac: tW != null ? tW / g.w : null,
        color: C.value.phosphor,
        sub: tW == null ? "→ ∞" : "",
      },
      {
        iid: "g-n",
        label: "im System L̂",
        value: "–",
        unit: "Mittel",
        frac: 0,
        markFrac: t.n / g.n,
        color: C.value.theory,
        sub: "",
      },
      {
        iid: "g-little",
        label: "Little-Check",
        value: "–",
        unit: "λŴ/L̂",
        frac: 0,
        markFrac: 1,
        color: C.value.phosphor,
        sub: "→ 1,0",
      },
    ];
  const littleOk = Math.abs(ro.little - 1) < 0.12;
  return [
    {
      iid: "g-thr",
      label: "Durchsatz λ̂",
      value: fmtDe(ro.thr, ro.thr < 50 ? 1 : 0),
      unit: "/s",
      frac: ro.thr / g.thr,
      markFrac: t.thr / g.thr,
      color: C.value.phosphor,
      sub: `Soll λ = ${fmtDe(t.thr, 0)}/s`,
    },
    {
      iid: "g-w",
      label: wLabel,
      value: fmtWv(ro.w),
      unit: wUnit,
      frac: ro.w / g.w,
      markFrac: tW != null ? tW / g.w : null,
      color: C.value.amber,
      sub: tW == null ? "Theorie → ∞" : `Theorie ${fmtWv(tW)} ${wUnit}`,
    },
    {
      iid: "g-n",
      label: "im System L̂",
      value: fmtDe(ro.n, ro.n < 50 ? 1 : 0),
      unit: "Mittel",
      frac: ro.n / g.n,
      markFrac: t.n / g.n,
      color: C.value.theory,
      sub: `jetzt: ${fmtDe(ro.nNow, 0)}`,
    },
    {
      iid: "g-little",
      label: "Little-Check",
      value: fmtDe(ro.little, 2),
      unit: "λŴ/L̂",
      frac: 1,
      markFrac: 1,
      color: littleOk ? C.value.phosphor : C.value.amber,
      sub: "→ 1,0 ✓",
    },
  ];
});
const settleView = computed(() => {
  const ro = readout.value;
  if (!ro) return null;
  const target = curSettle();
  const progress = Math.min(1, ro.served / target);
  return {
    served: ro.served,
    target,
    progress,
    done: progress >= 1,
    pct: Math.round(progress * 100),
  };
});
const footHint = computed(() => {
  if (phase.value === "frage")
    return "Erst schätzen (Zuruf oder Slider), dann ▶ Messen — die Simulation löst auf.";
  return "Messung läuft — ⏩ Auflösen springt ans Ende.";
});
</script>

<template>
  <SimShell
    eyebrow="Kapazitätsplanung · Little's Law"
    title="Rechen-Drill: zwei messen, die dritte schätzen"
    subtitle="L = λ·W gilt verteilungsfrei für jedes stabile System. Fünf Runden mit Zahlen aus echten Systemen — pro Runde ist eine Größe verdeckt."
    :presets="presetList"
    presets-label="Runde:"
    gear-title="Zeitraffer & Seed"
    :model-value="activeKey"
    @update:model-value="loadRound"
  >
    <template #transport>
      <button
        class="ll-btn ll-primary"
        :disabled="phase === 'fertig'"
        @click="togglePlay"
      >
        {{ playLabel }}
      </button>
      <button class="ll-btn" :disabled="phase === 'fertig'" @click="resolveNow">
        ⏩ Auflösen
      </button>
      <button class="ll-btn" @click="restartRound">↻ Runde</button>
    </template>

    <template #presets-extra>
      <button v-if="action" class="ll-btn ll-action" @click="doAction">
        {{ action.label }}
      </button>
    </template>

    <template #stage>
      <div class="ll-main">
        <Tabs :tabs="TABS" aria-label="Drill oder Erklärung">
          <template #drill>
            <div class="ll-scenario">{{ R.scenario }}</div>
            <div class="ll-flow">{{ flowLine }}</div>
            <div class="ll-cards">
              <div
                v-for="card in cardViews"
                :key="card.k"
                class="ll-card"
                :class="{ 'll-card-hidden': card.isHidden }"
              >
                <div class="ll-card-label">{{ card.label }}</div>
                <div class="ll-card-value">{{ card.value }}</div>
                <div class="ll-card-sub">{{ card.sub }}</div>
              </div>
            </div>
            <div class="ll-est">
              <QueueSlider
                class="ll-est-slider"
                :label="R.est.label"
                :model-value="estimate"
                :min="R.est.min"
                :max="R.est.max"
                :step="R.est.step"
                :unit="R.est.unit"
                @update:model-value="onEstimate"
              />
              <span class="ll-est-hint">{{ estHint }}</span>
            </div>
            <div class="ll-gauges" :class="{ 'll-dim': !readout }">
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
            <div v-if="settleView" class="ll-settle">
              <div class="ll-settle-row">
                <span class="ll-settle-left">
                  Messung {{ settleView.done ? "✓" : "" }} ·
                  {{ fmtDe(settleView.served, 0) }} / ~{{
                    fmtDe(settleView.target, 0)
                  }}
                  Abgänge
                  <InfoPopover
                    id="settle"
                    :active-id="info"
                    title="Messfortschritt"
                    @toggle="toggle('settle')"
                  >
                    {{ HELP.settle }}
                  </InfoPopover>
                </span>
                <span>{{ settleView.pct }} %</span>
              </div>
              <div class="ll-settle-track">
                <div
                  class="ll-settle-fill"
                  :class="{ 'll-settle-done': settleView.done }"
                  :style="{ width: settleView.progress * 100 + '%' }"
                />
              </div>
            </div>
          </template>

          <template #model>
            <div class="ll-explain">
              <p>
                <b>Warum L = λ·W gilt (Fluss-Argument):</b> Wer im Mittel W
                Sekunden im System verbringt, während λ pro Sekunde eintreffen,
                hinterlässt im Mittel λ·W Anwesende. Kein Wissen über
                Verteilungen nötig — nur Stabilität (rein = raus). Deshalb
                funktioniert es für Thread-Pools, Queues, Kassenschlangen und
                ganze Rechenzentren gleichermaßen.
              </p>
              <div class="ll-table">
                <div class="ll-tr">
                  <span class="ll-td-f">N = λ · W</span>
                  <span
                    >Pool-/Kapazitäts-Sizing: Wie viele gleichzeitig? (Runde
                    1)</span
                  >
                </div>
                <div class="ll-tr">
                  <span class="ll-td-f">W = N / λ</span>
                  <span>Backlog → Wartezeit: Wie alt wird das? (Runde 2)</span>
                </div>
                <div class="ll-tr">
                  <span class="ll-td-f">λ = N / W</span>
                  <span>Konsistenz-Check über Metrik-Quellen (Runde 5)</span>
                </div>
              </div>
              <p>
                <b>Kapazität ≠ Latenz (Runde 3):</b> c = 4 Worker tragen die
                Last (ρ = 0,75), aber Erlang-C sagt: die Hälfte der Anfragen
                wartet — Wq ≈ 12,7 ms reißt das 10-ms-SLO. Erst c = 5 (ρ = 0,60)
                drückt Wq auf ≈ 3 ms. Durchsatz-Headroom und Latenz-SLO sind
                zwei verschiedene Rechnungen.
              </p>
              <p>
                <b>Die Hyperbel (Runde 4):</b> Wq ∝ ρ/(1−ρ). Von ρ = 0,80 auf
                0,92 sind es nur 15 % mehr Last, aber fast 3× mehr Wartezeit —
                dieselbe Kurve wie im Phosphor-Scope der Kantine.
              </p>
              <p class="ll-foot">
                <b>Bewusste Vereinfachungen:</b> Alles Mittelwerte — Perzentile
                streuen deutlich stärker. Runde 2 nutzt Little als
                Fluss-Argument (FIFO: Alter ≈ Backlog/Durchsatz), kein
                Steady-State-Theorem — genau so nutzt man es im Alltag. Runde 4
                modelliert den Pool als eine schnelle Bedienstation (M/M/1),
                bewusst dieselbe Hyperbel wie im Kapitel. Seeds sind fest je
                Runde — „Gleicher Seed“ reproduziert die Messwerte exakt.
              </p>
            </div>
          </template>
        </Tabs>
      </div>
    </template>

    <template #gear>
      <div class="ll-gear">
        <QueueSlider
          label="Zeitraffer"
          :model-value="timeScale"
          :min="0.25"
          :max="4"
          :step="0.25"
          unit="×"
          @update:model-value="(v) => (timeScale = v)"
        />
        <div class="ll-gear-btns">
          <button class="ll-btn" @click="restartRound">↻ Gleicher Seed</button>
          <button class="ll-btn" @click="newSeed">🎲 Neuer Seed</button>
        </div>
        <p class="ll-gear-note">
          Jede Runde hat einen festen Seed — die Messwerte sind in jedem Vortrag
          identisch. „Neuer Seed“ zeigt: die Theorie-Striche bleiben, nur das
          Rauschen ändert sich.
        </p>
      </div>
    </template>

    <template #footer>
      <div v-if="verdict" class="ll-verdict" :class="'ll-tone-' + verdict.tone">
        <div class="ll-verdict-head">{{ verdict.head }}</div>
        <div v-for="(l, i) in verdict.lines" :key="i" class="ll-verdict-line">
          {{ l }}
        </div>
      </div>
      <div v-else class="ll-hint">{{ footHint }}</div>
    </template>
  </SimShell>
</template>

<style scoped>
.ll-main {
  --sk-tab-font-size: 10px;
  --sk-tab-pad: 3px 10px;
  --sk-tab-gap: 4px;
  --sk-tab-bar-mb: 6px;
  --sk-tab-border: 1px solid var(--c-border);
  --sk-tab-color: var(--c-textMid);
  --sk-tab-active-bg: var(--c-panelHi);
  --sk-tab-active-color: var(--c-textHi);
  --sk-tab-active-border: var(--c-phosphor);
  --sk-tab-hover-bg: var(--c-panelHi);
  color: var(--c-textHi);
}
.ll-scenario {
  font-size: 11px;
  line-height: 1.45;
  color: var(--c-textHi);
  margin-bottom: 5px;
}
.ll-flow {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  color: var(--c-textMid);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ll-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 6px;
}
.ll-card {
  background: var(--c-panel);
  border: 1px solid var(--c-border);
  border-radius: 9px;
  padding: 6px 10px 5px;
  min-width: 0;
}
.ll-card-hidden {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--c-phosphor) 60%, transparent);
}
.ll-card-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--c-textLow);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ll-card-value {
  font-family: var(--slidev-code-font-family);
  font-size: 16px;
  font-weight: 700;
  margin: 1px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ll-card-sub {
  font-size: 9px;
  color: var(--c-textLow);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ll-est {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.ll-est-slider {
  width: 300px;
  flex: none;
}
.ll-est-hint {
  font-size: 9.5px;
  color: var(--c-textLow);
}
.ll-gauges {
  display: flex;
  gap: 6px;
  justify-content: space-between;
  border-top: 1px solid var(--c-border);
  padding-top: 4px;
  transition: opacity 0.3s;
}
.ll-dim {
  opacity: 0.35;
}
.ll-settle {
  margin-top: 4px;
}
.ll-settle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  color: var(--c-textMid);
  margin-bottom: 3px;
}
.ll-settle-left {
  display: flex;
  align-items: center;
}
.ll-settle-track {
  position: relative;
  height: 8px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--c-panelHi);
}
.ll-settle-fill {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--c-phosphor) 55%, transparent);
  transition: width 0.2s linear;
}
.ll-settle-done {
  background: var(--c-phosphor);
}

/* Buttons */
.ll-btn {
  font-size: 10.5px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: var(--c-panelHi);
  color: var(--c-textHi);
  border-radius: 7px;
  padding: 4px 10px;
  white-space: nowrap;
}
.ll-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ll-primary {
  border-color: var(--c-phosphor);
  font-weight: 650;
}
.ll-action {
  border-color: var(--c-phosphor);
  font-weight: 650;
}

/* Verdict / Footer */
.ll-verdict {
  border: 1px solid var(--c-border);
  border-left-width: 3px;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 10.5px;
  line-height: 1.4;
  background: var(--c-panel);
}
.ll-tone-ok {
  border-left-color: var(--c-phosphor);
}
.ll-tone-warn {
  border-left-color: #d97706;
}
.ll-tone-bad {
  border-left-color: #dc2626;
}
.ll-tone-info {
  border-left-color: #0891b2;
}
.ll-verdict-head {
  font-weight: 650;
}
.ll-verdict-line {
  color: var(--c-textMid);
}
.ll-hint {
  font-size: 10px;
  color: var(--c-textLow);
  padding: 2px 2px 0;
}

/* Erklärung */
.ll-explain {
  max-height: 330px;
  overflow-y: auto;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--c-textHi);
  padding-right: 6px;
}
.ll-explain p {
  margin: 0 0 7px;
}
.ll-explain b {
  font-weight: 650;
}
.ll-table {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0 0 7px;
}
.ll-tr {
  display: flex;
  gap: 10px;
  align-items: baseline;
}
.ll-td-f {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  font-weight: 650;
  flex: none;
  width: 84px;
  color: var(--c-phosphor);
}
.ll-foot {
  color: var(--c-textMid);
  border-top: 1px solid var(--c-border);
  padding-top: 6px;
}

/* Gear */
.ll-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 280px;
}
.ll-gear-btns {
  display: flex;
  gap: 6px;
}
.ll-gear-note {
  font-size: 9.5px;
  line-height: 1.5;
  color: var(--c-textMid);
  margin: 0;
}
</style>
