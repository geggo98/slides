<script setup>
/**
 * MMcCompare.vue — derselbe Ankunftsstrom in zwei Subsysteme: Pool (rechts)
 * gegen Alternative (links: 1 schneller Koch „Tempo“ oder c getrennte Schlangen
 * „Pooling“). Port von mmc-compare.jsx. Race-Bar prominent zentriert unter den
 * Kantinen; Slider hinter 🛠️; Mode/Metrik-Toggle + ρ-Presets immer sichtbar.
 */
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from "vue";
import { expo } from "./lib/queueing.js";
import {
  World,
  theory,
  makeLayout,
  reconcile,
  drawScope,
  SC,
  SV,
  BUS_STOP,
} from "./lib/mmc.js";
import { useScopeColors } from "./lib/useScopeColors";
import { useInfoPopover } from "./lib/useInfoPopover";
import QueueSlider from "./QueueSlider.vue";
import InfoPopover from "./InfoPopover.vue";
import CanteenStage from "./CanteenStage.vue";

const C = useScopeColors();
const { info, toggle } = useInfoPopover();

const FONTS = {
  MONO: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  SANS: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
};
// Kurz-Labels ohne „vs Pool" (der Vergleichspartner steht im Titel) —
// sonst bricht die Toolbar in Firefox in zwei Zeilen und die Folie läuft über.
const MODES = [
  { key: "tempo", label: "Tempo: 1 schneller Koch" },
  { key: "pooling", label: "Pooling: getrennte Schlangen" },
];
const METRICS = [
  { key: "Wq", label: "Wq" },
  { key: "T", label: "T" },
  { key: "pw", label: "P(warten)" },
];
const RHO_PRESETS = [0.5, 0.7, 0.85, 0.95];

/* ---- reaktiver Zustand ---- */
const mode = ref("tempo");
const lambda = ref(1.6);
const mu = ref(1.0);
const c = ref(3);
const speed = ref(3);
const paused = ref(true);
const metric = ref("T");
const controlsOpen = ref(false);
const scopeZoomed = ref(false);

/* ---- nicht-reaktive Holder ---- */
const world = new World(1.6, 1.0, 3, "tempo");
const visL = new Map();
const visR = new Map();
const scopeCanvas = ref(null);
let ctx = null;
let raf = 0;
let last = 0;
let lastSample = 0;

const zMetrics = () => ({ pw: 0, Wq: 0, T: 0, N: 0, L: 0 });
const leftView = shallowRef({
  entities: [],
  badges: [],
  servers: [],
  queueLens: [],
  layout: makeLayout(world.left),
  fast: world.mode === "tempo",
});
const rightView = shallowRef({
  entities: [],
  badges: [],
  servers: [],
  queueLens: [],
  layout: makeLayout(world.right),
});
const score = shallowRef({
  l: zMetrics(),
  r: zMetrics(),
  lt: zMetrics(),
  rt: zMetrics(),
});
const race = shallowRef({ n: 0, lPct: 0, rPct: 0, lLead: 0, rLead: 0 });

watch(lambda, (v) => {
  world.lambda = v;
  world.nextArrival = world.clock + expo(v);
});
watch(mu, (v) => {
  world.mu = v;
});
watch([mode, c], () => {
  world.mode = mode.value;
  world.c = c.value;
  world.configure();
  visL.clear();
  visR.clear();
});

function reset() {
  world.configure();
  visL.clear();
  visR.clear();
  busAnim = null;
  busView.value = null;
}
function setRhoMMc(rr) {
  lambda.value = +(rr * c.value * mu.value).toFixed(3);
}

/* ---- Burst (Bus) & Load-Shedding — wie im MM1Simulator, aber gekoppelt:
   derselbe Bus liefert dieselben 🤖-Zwillinge in BEIDE Kantinen. ---- */
const BURST_N = 12;
const busView = shallowRef(null); // {x, y, opacity} — in beiden Stages gerendert
let busAnim = null; // {t0, injected} — Realzeit-Timeline

function burst() {
  if (busAnim) return; // ein Bus reicht
  busAnim = { t0: performance.now(), injected: false };
}
function shed() {
  const { l, r } = world.shedQueues();
  const markShed = (dropped, vis) => {
    for (const cust of dropped) {
      const v = vis.get(cust.id);
      if (!v) continue;
      v.state = "shed";
      v.tx = v.x + (Math.random() * 40 - 20);
      v.ty = SV.H + 30; // nach unten aus dem Bild
    }
  };
  markShed(l.dropped, visL);
  markShed(r.dropped, visR);
}

/* Bus-Timeline: anfahren (0–0,9 s) → halten & Zwillinge injizieren
   (0,9–1,9 s) → zurück nach links (1,9–2,8 s). */
function tickBus(now) {
  if (!busAnim) return;
  const t = (now - busAnim.t0) / 1000;
  if (t < 0.9) {
    const e = 1 - Math.pow(1 - t / 0.9, 3);
    busView.value = {
      x: -40 + (BUS_STOP.x + 40) * e,
      y: BUS_STOP.y,
      opacity: 1,
    };
  } else if (t < 1.9) {
    if (!busAnim.injected) {
      busAnim.injected = true;
      world.injectBurst(BURST_N);
    }
    busView.value = { x: BUS_STOP.x, y: BUS_STOP.y, opacity: 1 };
  } else if (t < 2.8) {
    const p = (t - 1.9) / 0.9;
    busView.value = {
      x: BUS_STOP.x - (BUS_STOP.x + 40) * p * p,
      y: BUS_STOP.y,
      opacity: 1 - p * 0.3,
    };
  } else {
    busAnim = null;
    busView.value = null;
  }
}

const rho = computed(() => lambda.value / (c.value * mu.value));
const rhoColor = computed(() =>
  rho.value < 0.7 ? C.value.pool : rho.value < 0.9 ? C.value.alt : C.value.red,
);
const leftCaption = computed(() =>
  mode.value === "tempo"
    ? `1 Koch @ ${(c.value * mu.value).toFixed(1)}/s ⚡`
    : `${c.value} Köche @ ${mu.value.toFixed(1)}/s · je eigene Schlange`,
);

const HELP = {
  "kantine-r":
    "Eine gemeinsame Schlange für alle c Köche: Der vorderste Gast geht zum nächsten freien Koch. Essen-Emoji = Bedienlänge, „Xs“ = Restzeit, „+N“ = zusätzlich Wartende. Diese Kantine ist in beiden Modi identisch — die Referenz, gegen die links verglichen wird.",
  race: "Beide Seiten bekommen denselben Gast (gleiche Ankunft, gleicher Arbeitsbedarf — gekoppelte Zufallsströme). Der Balken zeigt, wie oft derselbe Zwilling links bzw. im Pool zuerst fertig wird; Ø-Vorsprung in Bedienzeiten. Der ehrlichste Vergleich, weil dieselbe Realisierung beide Systeme durchläuft.",
  scope:
    "Theoriekurven über der Auslastung ρ: Amber = Alternative, Grün = Pool. Die leuchtenden Punkte sind die aktuellen Messwerte bei deinem ρ (gestrichelte Linie). Schalte zwischen Wq, T und P(warten) um: Im Tempo-Modus tauschen die Kurven die Führung; im Pooling-Modus liegt der Pool immer unten.",
  "sb-pw":
    "Anteil der Gäste, die überhaupt warten müssen (kein Koch sofort frei). Amber = Alternative, Grün = Pool, cyan Strich = exakte Theorie (Erlang-C bzw. ρ). Niedriger ist besser.",
  "sb-wq":
    "Mittlere reine Wartezeit vor der Bedienung, in Vielfachen einer Bedienzeit am langsamen Koch (×Bed). Im Tempo-Modus gewinnt hier der Pool (Pooling-Effekt: eine Schlange für alle).",
  "sb-t":
    "Verweildauer gesamt = Warten + Bedienung (×Bed). Im Tempo-Modus gewinnt hier oft die Alternative, weil der eine schnelle Koch c-fach kürzer bedient. Der Gegensatz zu Wq ist die Pointe.",
  "sb-n":
    "Mittlere Anzahl Gäste im System (wartend + in Bedienung). Strich = Theorie L = λ·T (Little). Der gemessene Wert springt; der Strich ist der Langzeitmittelwert.",
};
const kantineLHelp = computed(
  () =>
    "Gäste kommen links an, stellen sich an, werden vom 🧑‍🍳 bedient und gehen rechts. Essen-Emoji = Bedienlänge, „Xs“ = Restzeit, „+N“ = zusätzlich Wartende. " +
    (mode.value === "tempo"
      ? "⚡ = ein einzelner, c-fach schnellerer Koch."
      : "Jeder Koch hat seine eigene Schlange — die Spur wird bei Ankunft zufällig gewählt, daher mögliches Head-of-Line-Blocking."),
);

/* ---- Scoreboard ---- */
function barGeom(val, theo, scale) {
  const w =
    Math.max(0, Math.min(1, (Number.isFinite(val) ? val : scale) / scale)) *
    100;
  const tx = Number.isFinite(theo) ? Math.min(1, theo / scale) * 100 : null;
  return { w, tx };
}
const sbRows = computed(() => {
  const { l, r, lt, rt } = score.value;
  const m = mu.value;
  const fin = (x) => (Number.isFinite(x) ? x : 0);
  const defs = [
    {
      label: "P(warten)",
      iid: "sb-pw",
      lv: l.pw,
      rv: r.pw,
      lT: lt.pw,
      rT: rt.pw,
      fmt: (x) => (x * 100).toFixed(0) + " %",
    },
    {
      label: "Wartezeit Wq",
      iid: "sb-wq",
      lv: l.Wq * m,
      rv: r.Wq * m,
      lT: lt.Wq * m,
      rT: rt.Wq * m,
      fmt: (x) => x.toFixed(2) + "×",
    },
    {
      label: "Gesamtzeit T",
      iid: "sb-t",
      lv: l.T * m,
      rv: r.T * m,
      lT: lt.T * m,
      rT: rt.T * m,
      fmt: (x) => x.toFixed(2) + "×",
    },
    {
      label: "im System N",
      iid: "sb-n",
      lv: l.N,
      rv: r.N,
      lT: lt.L,
      rT: rt.L,
      fmt: (x) => x.toFixed(1),
    },
  ];
  return defs.map((row) => {
    const scale =
      Math.max(fin(row.lv), fin(row.rv), fin(row.lT), fin(row.rT), 1e-6) * 1.12;
    const lWin = row.lv <= row.rv;
    return {
      label: row.label,
      iid: row.iid,
      lWin,
      lBar: barGeom(row.lv, row.lT, scale),
      rBar: barGeom(row.rv, row.rT, scale),
      lText:
        (lWin ? "✓ " : "") +
        row.fmt(Number.isFinite(row.lv) ? row.lv : Infinity),
      rText:
        (!lWin ? "✓ " : "") +
        row.fmt(Number.isFinite(row.rv) ? row.rv : Infinity),
    };
  });
});

function btnStyle(border) {
  return {
    background: C.value.panelHi,
    color: C.value.textHi,
    border: `1px solid ${border}`,
  };
}
function modeStyle(key) {
  return mode.value === key
    ? { background: C.value.panelHi, color: C.value.textHi }
    : { background: "transparent", color: C.value.textLow };
}
function presetStyle(rr) {
  return btnStyle(rr >= 0.9 ? C.value.alt : C.value.border);
}

/* ---- RAF-Loop ---- */
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  tickBus(now);
  if (!paused.value) world.advance(world.clock + dtReal * speed.value);

  const layL = makeLayout(world.left);
  const layR = makeLayout(world.right);
  const recL = reconcile(world.left, visL, layL, dtReal);
  const recR = reconcile(world.right, visR, layR, dtReal);
  const sv = (sub) =>
    sub.servers.map((s) => ({
      busy: s.busy,
      food: s.food,
      remaining: s.busy ? Math.max(0, s.depart - world.clock) : 0,
    }));
  leftView.value = {
    entities: recL.entities,
    badges: recL.badges,
    servers: sv(world.left),
    queueLens: world.left.queues.map((q) => q.length),
    layout: layL,
    fast: world.mode === "tempo",
    shedTotal: world.left.numShed,
  };
  rightView.value = {
    entities: recR.entities,
    badges: recR.badges,
    servers: sv(world.right),
    queueLens: world.right.queues.map((q) => q.length),
    layout: layR,
    shedTotal: world.right.numShed,
  };

  if (ctx) {
    const liveL = world.left.metrics();
    const liveR = world.right.metrics();
    drawScope(
      ctx,
      C.value,
      FONTS,
      metric.value,
      world.mu,
      world.c,
      world.mode,
      liveL,
      liveR,
      world.lambda / (world.c * world.mu),
    );
  }

  if (now - lastSample > 140) {
    lastSample = now;
    const lm = world.left.metrics();
    const rm = world.right.metrics();
    const leftSys = world.mode === "tempo" ? "tempo" : "pooling";
    score.value = {
      l: lm,
      r: rm,
      lt: theory(leftSys, world.lambda, world.mu, world.c),
      rt: theory("pool", world.lambda, world.mu, world.c),
    };
    race.value = world.raceSummary();
  }
}

onMounted(() => {
  const cv = scopeCanvas.value;
  if (cv) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = SC.W * dpr;
    cv.height = SC.H * dpr;
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
      '--c-pool': C.pool,
    }"
  >
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="title">M/M/c · derselbe Pool gegen zwei Alternativen</div>
        <div class="subtitle">
          Gleiche Gesamtkapazität cμ, gleiches ρ, gekoppelter Ankunftsstrom. Was
          „besser“ ist, hängt von der Metrik ab.
        </div>
      </div>
      <div class="header-btns">
        <span class="rho-badge" :style="{ color: C.textLow }"
          >ρ=<b :style="{ color: rhoColor }">{{ rho.toFixed(2) }}</b> · cμ={{
            (c * mu).toFixed(1)
          }}</span
        >
        <button
          class="btn"
          :style="btnStyle(paused ? C.pool : C.border)"
          @click="paused = !paused"
        >
          {{ paused ? "▶ Weiter" : "⏸ Pause" }}
        </button>
        <button class="btn" :style="btnStyle(C.border)" @click="reset">
          ↻ Reset
        </button>
        <button
          class="btn"
          :style="btnStyle(controlsOpen ? C.pool : C.border)"
          :aria-expanded="controlsOpen"
          aria-controls="mmc-ctl"
          title="Regler ein-/ausblenden"
          @click="controlsOpen = !controlsOpen"
        >
          🛠️
        </button>
      </div>
    </div>

    <!-- Mode-Toggle + ρ-Presets: immer sichtbar -->
    <div class="toolbar">
      <div class="mode-toggle" :style="{ borderColor: C.border }">
        <button
          v-for="m in MODES"
          :key="m.key"
          class="mode-btn"
          :style="modeStyle(m.key)"
          @click="mode = m.key"
        >
          {{ m.label }}
        </button>
      </div>
      <div class="presets">
        <span class="presets-label" :style="{ color: C.textLow }">ρ:</span>
        <button
          v-for="rr in RHO_PRESETS"
          :key="rr"
          class="preset-btn"
          :style="presetStyle(rr)"
          @click="setRhoMMc(rr)"
        >
          {{ rr.toFixed(2) }}
        </button>
        <span class="presets-sep" />
        <button
          class="preset-btn"
          :style="btnStyle(C.alt)"
          title="Batch-Ankunft: derselbe Bus liefert 12 🤖-Zwillinge gleichzeitig in beide Kantinen (gleiche Ankunft, gleicher Arbeitsbedarf). Beobachte, welche Seite den Spike schneller abbaut."
          @click="burst"
        >
          🚌 Burst +12
        </button>
        <button
          class="preset-btn"
          :style="btnStyle(C.red)"
          title="Load-Shedding: verwirft alle Wartenden in beiden Kantinen (nicht die in Bedienung). Die Zähler zeigen, wie viele Gäste jede Seite verwirft — der Pool hält typischerweise weniger Wartende vor."
          @click="shed"
        >
          ✂️ Load-Shed
        </button>
      </div>
    </div>

    <!-- Regler hinter 🛠️ -->
    <div
      v-show="controlsOpen"
      id="mmc-ctl"
      class="controls"
      :style="{ background: C.panel, borderColor: C.border }"
    >
      <QueueSlider
        :model-value="lambda"
        label="Ankunftsrate λ"
        :min="0.1"
        :max="c * mu * 1.05"
        :step="0.01"
        unit="/s"
        @update:model-value="(v) => (lambda = v)"
      />
      <QueueSlider
        :model-value="mu"
        label="Bedienrate μ (je Koch)"
        :min="0.3"
        :max="2.0"
        :step="0.01"
        unit="/s"
        @update:model-value="(v) => (mu = v)"
      />
      <QueueSlider
        :model-value="c"
        label="Anzahl Köche c"
        :min="2"
        :max="6"
        :step="1"
        unit=""
        @update:model-value="(v) => (c = Math.round(v))"
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

    <!-- Kantinen -->
    <div class="canteens">
      <div
        class="canteen"
        :style="{ background: C.panel, borderColor: C.alt + '33' }"
      >
        <div class="canteen-info">
          <InfoPopover
            id="kantine-l"
            :active-id="info"
            title="Kantine — Alternative (links)"
            @toggle="toggle('kantine-l')"
            >{{ kantineLHelp }}</InfoPopover
          >
        </div>
        <CanteenStage
          :accent="C.alt"
          :caption="`◄ Alternative · ${leftCaption}`"
          :layout="leftView.layout"
          :servers="leftView.servers"
          :entities="leftView.entities"
          :badges="leftView.badges"
          :fast="leftView.fast"
          :bus="busView"
          :shed-total="leftView.shedTotal || 0"
        />
      </div>
      <div
        class="canteen"
        :style="{ background: C.panel, borderColor: C.pool + '33' }"
      >
        <div class="canteen-info">
          <InfoPopover
            id="kantine-r"
            :active-id="info"
            title="Kantine — Pool (rechts)"
            @toggle="toggle('kantine-r')"
            >{{ HELP["kantine-r"] }}</InfoPopover
          >
        </div>
        <CanteenStage
          :accent="C.pool"
          :caption="`Pool · ${c} Köche @ ${mu.toFixed(1)}/s · eine Schlange ►`"
          :layout="rightView.layout"
          :servers="rightView.servers"
          :entities="rightView.entities"
          :badges="rightView.badges"
          :bus="busView"
          :shed-total="rightView.shedTotal || 0"
        />
      </div>
    </div>

    <!-- Race-Bar: prominent, zentriert, direkt unter den Kantinen -->
    <div class="race" :style="{ background: C.panel, borderColor: C.border }">
      <div class="race-head" :style="{ color: C.textMid }">
        <span>Wettrennen identischer Zwillinge — wer ist zuerst fertig?</span>
        <InfoPopover
          id="race"
          :active-id="info"
          title="Wettrennen der Zwillinge"
          @toggle="toggle('race')"
          >{{ HELP.race }}</InfoPopover
        >
        <span class="race-n" :style="{ color: C.textLow }"
          >(n={{ race.n }})</span
        >
      </div>
      <div class="race-bar" :style="{ background: C.panelHi }">
        <div
          class="race-seg"
          :style="{ width: race.lPct * 100 + '%', background: C.alt }"
        >
          {{
            race.lPct * 100 >= 12 ? `⬅ ${(race.lPct * 100).toFixed(0)}%` : ""
          }}
        </div>
        <div
          class="race-seg"
          :style="{ width: race.rPct * 100 + '%', background: C.pool }"
        >
          {{
            race.rPct * 100 >= 12 ? `${(race.rPct * 100).toFixed(0)}% ➡` : ""
          }}
        </div>
      </div>
      <div class="race-foot">
        <span :style="{ color: C.alt }"
          >Alternative Ø-Vorsprung {{ race.lLead.toFixed(2) }}× Bed.</span
        >
        <span :style="{ color: C.pool }"
          >Pool Ø-Vorsprung {{ race.rLead.toFixed(2) }}× Bed.</span
        >
      </div>
    </div>

    <!-- Scoreboard + Scope -->
    <div class="lower">
      <div
        class="scoreboard"
        :style="{ background: C.panel, borderColor: C.border }"
      >
        <div class="sbv-title" :style="{ color: C.textMid }">
          Kennzahlen · niedriger = besser
        </div>
        <div class="sbv-grid">
          <div v-for="row in sbRows" :key="row.iid" class="sbv-metric">
            <div class="sbv-plot">
              <div class="sbv-bar-wrap" :style="{ background: C.panelHi }">
                <div
                  class="sbv-bar"
                  :style="{ height: row.lBar.w + '%', background: C.alt }"
                />
                <div
                  v-if="row.lBar.tx != null"
                  class="sbv-theo"
                  :style="{ bottom: row.lBar.tx + '%', background: C.theory }"
                />
              </div>
              <div class="sbv-bar-wrap" :style="{ background: C.panelHi }">
                <div
                  class="sbv-bar"
                  :style="{ height: row.rBar.w + '%', background: C.pool }"
                />
                <div
                  v-if="row.rBar.tx != null"
                  class="sbv-theo"
                  :style="{ bottom: row.rBar.tx + '%', background: C.theory }"
                />
              </div>
            </div>
            <div class="sbv-label" :style="{ color: C.textMid }">
              <span>{{ row.label }}</span>
              <InfoPopover
                :id="row.iid"
                :active-id="info"
                :title="row.label"
                @toggle="toggle(row.iid)"
                >{{ HELP[row.iid] }}</InfoPopover
              >
            </div>
            <div class="sbv-vals">
              <span :style="{ color: row.lWin ? C.alt : C.textLow }">{{
                row.lText
              }}</span>
              <span :style="{ color: !row.lWin ? C.pool : C.textLow }">{{
                row.rText
              }}</span>
            </div>
          </div>
        </div>
        <div class="sb-legend" :style="{ color: C.textLow }">
          <span :style="{ color: C.alt }">▇</span> Alt ·
          <span :style="{ color: C.pool }">▇</span> Pool ·
          <span :style="{ color: C.theory }">▏</span> Theorie · ✓ besser
        </div>
      </div>

      <div
        class="scope-panel"
        :class="{ zoomed: scopeZoomed }"
        :style="{ background: C.panel, borderColor: C.border }"
      >
        <div class="scope-head">
          <div class="scope-title" :style="{ color: C.textMid }">
            Crossover <span :style="{ color: C.alt }">Alt</span>/<span
              :style="{ color: C.pool }"
              >Pool</span
            >
            <InfoPopover
              id="scope"
              :active-id="info"
              title="Crossover-Scope"
              @toggle="toggle('scope')"
              >{{ HELP.scope }}</InfoPopover
            >
          </div>
          <div class="metric-toggle">
            <button
              v-for="mt in METRICS"
              :key="mt.key"
              class="btn-sm"
              :style="btnStyle(metric === mt.key ? C.pool : C.border)"
              @click="metric = mt.key"
            >
              {{ mt.label }}
            </button>
          </div>
        </div>
        <canvas ref="scopeCanvas" class="scope-canvas" />
        <button
          class="zoom-btn"
          :style="{
            background: C.panelHi,
            borderColor: C.border,
            color: C.textMid,
          }"
          :title="scopeZoomed ? 'Scope zurücksetzen' : 'Scope vergrößern'"
          @click="scopeZoomed = !scopeZoomed"
        >
          {{ scopeZoomed ? "⤡" : "⤢" }}
        </button>
      </div>
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
  position: relative;
  background: var(--c-bg);
  color: var(--c-textHi);
  font-family: inherit;
  padding: 6px 12px 6px;
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
  max-width: 560px;
}
.header-btns {
  display: flex;
  gap: 6px;
  align-items: center;
}
.rho-badge {
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  white-space: nowrap;
}
.btn {
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
}

/* Toolbar: mode + presets */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.mode-toggle {
  display: flex;
  border: 1px solid;
  border-radius: 8px;
  overflow: hidden;
}
.mode-btn {
  border: none;
  padding: 6px 9px;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.presets {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
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
.presets-sep {
  width: 4px;
}

/* Controls — HUD-Overlay: position:absolute ohne top (Static-Position) → schwebt
   an seiner natürlichen Stelle (unter der Toolbar, über den Kantinen) und belegt
   keinen Flussplatz, daher springen Race-Bar/Scoreboard/Scope beim Öffnen nicht. */
.controls {
  position: absolute;
  left: 12px;
  right: 12px;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  border: 1px solid;
  border-radius: 8px;
  padding: 10px 14px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
}

/* Canteens */
.canteens {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  max-width: 580px;
  margin: 0 auto 6px;
}
.canteen {
  position: relative;
  border: 1px solid;
  border-radius: 10px;
  padding: 6px;
}
.canteen-info {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
}

/* Race bar — prominent */
.race {
  border: 1px solid;
  border-radius: 10px;
  padding: 8px 12px;
  max-width: 720px;
  margin: 0 auto 8px;
}
.race-head {
  display: flex;
  align-items: center;
  font-size: 12px;
  margin-bottom: 6px;
}
.race-n {
  margin-left: 6px;
  font-family: var(--slidev-code-font-family);
}
.race-bar {
  display: flex;
  height: 24px;
  border-radius: 6px;
  overflow: hidden;
}
.race-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
  color: rgba(0, 0, 0, 0.72);
  transition: width 0.2s linear;
}
.race-foot {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  margin-top: 5px;
}

/* Lower grid */
.lower {
  display: grid;
  grid-template-columns: 1fr 175px;
  gap: 10px;
  align-items: start;
}
.scoreboard {
  border: 1px solid;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}
.sbv-title {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
}
/* Gedrehte (vertikale) Vergleichsbalken: spart Höhe gegenüber 8 gestapelten
   Horizontalbalken, damit alles auf eine Folie passt. */
.sbv-grid {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  gap: 6px;
}
.sbv-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 0;
  min-width: 0;
}
.sbv-plot {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 42px;
}
.sbv-bar-wrap {
  position: relative;
  width: 15px;
  height: 100%;
  display: flex;
  align-items: flex-end;
  border-radius: 3px 3px 0 0;
}
.sbv-bar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  opacity: 0.85;
  transition: height 0.18s linear;
}
.sbv-theo {
  position: absolute;
  left: -2px;
  right: -2px;
  height: 2px;
}
.sbv-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 9px;
  margin-top: 4px;
  text-align: center;
  line-height: 1.1;
}
.sbv-vals {
  display: flex;
  gap: 6px;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
}
.sb-legend {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
}

/* Scope */
.scope-panel {
  position: relative;
  border: 1px solid;
  border-radius: 10px;
  padding: 6px 8px;
}
/* Zoom: schwebt über der Simulation und füllt deren Fläche (eine Achse). */
.scope-panel.zoomed {
  position: absolute;
  inset: 6px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
}
.scope-panel.zoomed .scope-head {
  flex: 0 0 auto;
}
.scope-panel.zoomed .scope-canvas {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: contain;
}
.zoom-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 2;
  border: 1px solid;
  border-radius: 6px;
  padding: 1px 6px;
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
  opacity: 0.85;
}
.scope-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 4px;
  gap: 4px;
}
.scope-title {
  display: flex;
  align-items: center;
  font-size: 10px;
}
.metric-toggle {
  display: flex;
  gap: 3px;
}
.btn-sm {
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.scope-canvas {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 560 / 300;
}
</style>
