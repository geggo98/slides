<script setup>
/**
 * RabbitQueueSim.vue — „Die Queue wächst — warum?" (Diagnose-Drill),
 * portiert aus rabbitmq-queue-diagnose.html. Daten-Generatoren, Bayes-
 * Posterior, Kanal-/Hypothesen-Konfiguration und D3-Rendering verbatim;
 * Kanal-Gerüst + Aufdeck-Overlays + Hypothesen-Rail als Vue-Template,
 * D3 nur für Skalen/Pfade/Reveal-Animation in den per-Ref gehaltenen SVGs.
 * clipPath-Ids per Instanz-uid (mehrere Diagnose-Sims in einer SPA).
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
import { useIsSlideActive } from "@slidev/client";
import { easeCubicInOut, line as d3line, scaleLinear, select } from "d3";
import SimShell from "./SimShell.vue";
import { mulberry32, noise, ramp } from "./lib/rng.js";
import { useSimTransport } from "./lib/useSimTransport";

/* ===== Fall-spezifisch (verbatim) ===== */
const DT = 1,
  N = 121,
  INC_S = 30,
  W_WIN = 12;
function genData() {
  const S = mulberry32;
  const r = {
    qd: S(11),
    ackS: S(21),
    ackP: S(22),
    ackD: S(23),
    prS: S(31),
    prP: S(32),
    prD: S(33),
    unS: S(41),
    unP: S(42),
    unD: S(43),
  };
  const o = {
    qd: [],
    ack: { spike: [], poison: [], dead: [] },
    prod: { spike: [], poison: [], dead: [] },
    unacked: { spike: [], poison: [], dead: [] },
  };
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    o.qd.push(Math.max(0, 40 + 3800 * ramp(t, INC_S, 60) + noise(r.qd, 90)));
    o.ack.spike.push(Math.max(0, 100 + noise(r.ackS, 6)));
    o.ack.poison.push(
      Math.max(0, 100 * (1 - ramp(t, INC_S, 10)) + noise(r.ackP, 5)),
    );
    o.ack.dead.push(
      Math.max(0, 100 * (1 - ramp(t, INC_S, 6)) + noise(r.ackD, 4)),
    );
    o.prod.spike.push(
      Math.max(0, 100 + 62 * ramp(t, INC_S, 8) + noise(r.prS, 7)),
    );
    o.prod.poison.push(Math.max(0, 100 + noise(r.prP, 7)));
    o.prod.dead.push(Math.max(0, 100 + noise(r.prD, 7)));
    o.unacked.spike.push(Math.max(0, 20 + noise(r.unS, 4)));
    o.unacked.poison.push(
      Math.max(0, 20 + 230 * ramp(t, INC_S, 12) + noise(r.unP, 10)),
    );
    o.unacked.dead.push(
      Math.max(0, 20 * (1 - ramp(t, INC_S, 8)) + Math.max(0, noise(r.unD, 2))),
    );
  }
  return o;
}
function muOf(key, h, t) {
  switch (key) {
    case "qd":
      return 40 + 3800 * ramp(t, INC_S, 60);
    case "ack":
      return h === "spike"
        ? 100
        : 100 * (1 - ramp(t, INC_S, h === "dead" ? 6 : 10));
    case "prod":
      return h === "spike" ? 100 + 62 * ramp(t, INC_S, 8) : 100;
    case "unacked":
      return h === "spike"
        ? 20
        : h === "poison"
          ? 20 + 230 * ramp(t, INC_S, 12)
          : 20 * (1 - ramp(t, INC_S, 8));
  }
}
const SIGMA = { qd: null, ack: 8, prod: 9, unacked: 16 };
const CH = [
  {
    key: "qd",
    title: "Queue Depth",
    unit: " msg",
    color: "var(--rq-c0)",
    yMax: 4200,
    yTicks: [0, 2000, 4000],
    lead: true,
    revealAt: 0,
    dep: false,
    badge: "Leitsignal · identisch",
  },
  {
    key: "ack",
    title: "Consumer Ack-Rate",
    unit: "/s",
    color: "var(--rq-c2)",
    yMax: 130,
    yTicks: [0, 60, 120],
    lead: false,
    revealAt: 1,
    dep: true,
    badge: "Diskriminator",
  },
  {
    key: "prod",
    title: "Producer-Rate",
    unit: "/s",
    color: "var(--rq-c1)",
    yMax: 180,
    yTicks: [0, 90, 180],
    lead: false,
    revealAt: 2,
    dep: true,
    badge: "Diskriminator",
  },
  {
    key: "unacked",
    title: "Unacked (in-flight)",
    unit: " msg",
    color: "var(--rq-c3)",
    yMax: 270,
    yTicks: [0, 130, 260],
    lead: false,
    revealAt: 3,
    dep: true,
    badge: "Diskriminator · Schlüssel",
  },
];
const HYPS = [
  { id: "spike", name: "Producer-Spike", color: "var(--rq-c1)" },
  { id: "poison", name: "Vergifteter Consumer", color: "var(--rq-c3)" },
  { id: "dead", name: "Toter Consumer", color: "var(--rq-c4)" },
];
const SHORT = { spike: "Spike", poison: "Poison", dead: "Tot" };
const CAUSE = {
  spike: "Producer-Spike",
  poison: "Vergifteter Consumer",
  dead: "Toter Consumer",
};
const REASON = {
  0: "Nur die Queue-Tiefe. Sie wächst — aber Producer-Überschuss und Consumer-Ausfall sehen hier identisch aus.",
  spike1:
    "Ack-Rate <b>konstant</b> → der Consumer arbeitet normal weiter. Nur ein Producer-Überschuss erklärt dann die wachsende Queue: <b>Producer-Spike</b>, schon eindeutig.",
  poison1:
    "Ack-Rate <b>→ 0</b> → der Consumer verarbeitet nichts mehr. Aber warum? Vergiftet/blockiert oder tot — <b>nicht trennbar</b>.",
  dead1:
    "Ack-Rate <b>→ 0</b> → der Consumer verarbeitet nichts mehr. Vergiftet/blockiert oder tot — <b>nicht trennbar</b>.",
  spike2:
    "Producer-Rate hoch — konsistent mit der Diagnose. Skalierungsproblem, kein Consumer-Bug.",
  poison2:
    "Producer-Rate <b>flach</b> → kein Last-Problem. Immer noch: vergiftet oder tot?",
  dead2:
    "Producer-Rate <b>flach</b> → kein Last-Problem. Immer noch: vergiftet oder tot?",
  spike3:
    "Unacked klein und stabil — der Consumer zieht und quittiert normal. Diagnose steht: <b>Producer-Spike</b>.",
  poison3:
    "Unacked <b>hoch und stabil</b> → der Consumer hat den vollen Prefetch gezogen, quittiert aber nichts: er <b>hängt</b> (Poison Message, Deadlock, blockierender Call). Eindeutig <b>vergifteter Consumer</b>.",
  dead3:
    "Unacked <b>→ 0</b> → nichts mehr in-flight: der Consumer ist <b>weg</b> (Crash/Disconnect gibt unacked an die Queue zurück). Eindeutig <b>toter Consumer</b>.",
};

/* ===== Zustand ===== */
const TMAX = (N - 1) * DT;
const NREV = CH.filter((c) => !c.lead).length;
const SCEN = HYPS.map((h) => h.id);
const uid = "rq" + Math.random().toString(36).slice(2, 8);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let DATA = genData();
let mapping = [];
const activeTab = ref("0"); // Szenario-Index als String (SimShell v-model)
const scenario = ref(null);
const reveal = ref(0);
const readouts = reactive({}); // key → HTML-Readout (von sync() geschrieben)
const posterior = shallowRef(null);
const isSlideActive = useIsSlideActive();

function shuffle() {
  const a = [...SCEN];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  mapping = a;
  scenario.value = a[Number(activeTab.value)];
}
shuffle();

function seriesFor(ch) {
  return ch.dep ? DATA[ch.key][scenario.value] : DATA[ch.key];
}
function isShown(ch) {
  return reveal.value >= ch.revealAt;
}
const allRevealed = computed(() => reveal.value >= NREV);

const presets = computed(() =>
  SCEN.map((_, i) => ({
    key: String(i),
    label:
      "Szenario " +
      "ABC"[i] +
      (allRevealed.value ? " — " + CAUSE[mapping[i]] : ""),
  })),
);

/* Bayes (verbatim) */
function computePosterior() {
  const iEnd = Math.max(0, Math.round(transport.playhead.value / DT)),
    iStart = Math.max(0, iEnd - W_WIN + 1);
  const lp = {};
  SCEN.forEach((h) => (lp[h] = Math.log(1 / SCEN.length)));
  CH.forEach((ch) => {
    if (!isShown(ch) || !SIGMA[ch.key]) return;
    const obs = seriesFor(ch),
      s = SIGMA[ch.key],
      inv = 1 / (2 * s * s);
    for (let i = iStart; i <= iEnd; i++) {
      const x = obs[i],
        t = i * DT;
      SCEN.forEach((h) => {
        const d = x - muOf(ch.key, h, t);
        lp[h] -= d * d * inv;
      });
    }
  });
  const m = Math.max(...SCEN.map((h) => lp[h]));
  let sum = 0;
  const e = {};
  SCEN.forEach((h) => {
    e[h] = Math.exp(lp[h] - m);
    sum += e[h];
  });
  const p = {};
  SCEN.forEach((h) => (p[h] = e[h] / sum));
  return p;
}

const hypView = computed(() => {
  const post = posterior.value;
  if (!post) return { rows: [], tie: null };
  const sorted = SCEN.map((h) => [h, post[h]]).sort((a, b) => b[1] - a[1]);
  const win =
    sorted[0][1] > 0.55 && sorted[0][1] - sorted[1][1] > 0.2
      ? sorted[0][0]
      : null;
  const tie =
    !win &&
    sorted[0][1] > 1 / SCEN.length + 0.02 &&
    sorted[0][1] - sorted[1][1] < 0.15 &&
    reveal.value >= 1
      ? `<b>${SHORT[sorted[0][0]]}</b> und <b>${SHORT[sorted[1][0]]}</b> sind auf den aufgedeckten Signalen nicht trennbar.`
      : null;
  return {
    rows: HYPS.map((h) => ({ ...h, p: post[h.id], win: h.id === win })),
    tie,
  };
});
const reasonHtml = computed(() => {
  void posterior.value;
  const key = reveal.value === 0 ? "0" : scenario.value + reveal.value;
  return REASON[key] || REASON[String(reveal.value)] || "";
});

/* ===== D3-Rendering (verbatim, an Refs gebunden) ===== */
const M = { t: 11, r: 56, b: 15, l: 44 };
const H_LEAD = 90,
  H_SUB = 50;
const svgEls = reactive({});
const chansEl = ref(null);
const charts = {};
let resizeObs = null;

function chanH(ch) {
  return ch.lead ? H_LEAD : H_SUB;
}
function buildCharts() {
  CH.forEach((c0) => {
    const el = svgEls[c0.key];
    if (!el) return;
    const svg = select(el);
    svg.selectAll("*").remove();
    const h = chanH(c0);
    const clip = svg
      .append("defs")
      .append("clipPath")
      .attr("id", `cl-${uid}-${c0.key}`)
      .append("rect")
      .attr("y", 0)
      .attr("height", h);
    const gA = svg.append("g");
    const path = svg
      .append("path")
      .attr("fill", "none")
      .attr("stroke", c0.color)
      .attr("stroke-width", c0.lead ? 2 : 1.6)
      .attr("stroke-linejoin", "round")
      .attr("clip-path", `url(#cl-${uid}-${c0.key})`);
    const pl = svg
      .append("line")
      .attr("y1", M.t)
      .attr("y2", h - M.b)
      .attr("stroke", c0.color)
      .attr("stroke-width", 1)
      .attr("opacity", 0);
    const dot = svg
      .append("circle")
      .attr("r", 3)
      .attr("fill", c0.color)
      .attr("opacity", 0);
    charts[c0.key] = {
      cfg: c0,
      svg,
      clip,
      gA,
      path,
      pl,
      dot,
      h,
      clipT: c0.lead ? TMAX : 0,
      anim: false,
    };
  });
}
function lineGen(c) {
  return d3line()
    .x((v, i) => c.x(i * DT))
    .y((v) => c.y(Math.max(c.cfg.yMin || 0, Math.min(c.cfg.yMax, v))));
}
function applyScales() {
  CH.forEach((cf) => {
    const c = charts[cf.key];
    if (!c) return;
    const w = c.svg.node().parentNode.clientWidth || 600; // logische px — rect.width wäre post-CSS-Transform (~1.3×) und würde rechts clippen
    c.svg.attr("width", w);
    c.w = w;
    c.x = scaleLinear()
      .domain([0, TMAX])
      .range([M.l, w - M.r]);
    c.y = scaleLinear()
      .domain([cf.yMin || 0, cf.yMax])
      .range([c.h - M.b, M.t]);
    c.clip.attr("x", M.l);
    c.gA.selectAll("*").remove();
    cf.yTicks.forEach((t) => {
      c.gA
        .append("line")
        .attr("x1", M.l)
        .attr("x2", w - M.r)
        .attr("y1", c.y(t))
        .attr("y2", c.y(t))
        .attr("stroke", "var(--rq-hair)");
      c.gA
        .append("text")
        .attr("x", M.l - 6)
        .attr("y", c.y(t))
        .attr("dy", ".32em")
        .attr("text-anchor", "end")
        .attr("font-family", "var(--slidev-code-font-family)")
        .attr("font-size", 8.5)
        .attr("fill", "var(--rq-muted)")
        .text(t);
    });
    if (cf.lead || cf === CH[CH.length - 1])
      [0, 30, 60, 90, 120].forEach((xt) => {
        if (xt <= TMAX)
          c.gA
            .append("text")
            .attr("x", c.x(xt))
            .attr("y", c.h - M.b + 11)
            .attr("text-anchor", "middle")
            .attr("font-family", "var(--slidev-code-font-family)")
            .attr("font-size", 8)
            .attr("fill", "var(--rq-muted)")
            .text(xt + "s");
      });
    if (cf.lead) {
      c.gA
        .append("line")
        .attr("x1", c.x(INC_S))
        .attr("x2", c.x(INC_S))
        .attr("y1", M.t)
        .attr("y2", c.h - M.b)
        .attr("stroke", "#c23b5833")
        .attr("stroke-dasharray", "3 3");
      c.gA
        .append("text")
        .attr("x", c.x(INC_S) + 3)
        .attr("y", M.t + 9)
        .attr("font-family", "var(--slidev-code-font-family)")
        .attr("font-size", 8)
        .attr("fill", "#c23b58aa")
        .text("Incident");
    }
  });
  setPaths(false);
  CH.forEach((cf) => sync(charts[cf.key]));
}
function setPaths(tr) {
  CH.forEach((cf) => {
    const c = charts[cf.key];
    if (!c || !c.x) return;
    const d = lineGen(c)(seriesFor(cf));
    if (tr && cf.dep && !REDUCED)
      c.path.transition().duration(700).ease(easeCubicInOut).attr("d", d);
    else c.path.attr("d", d);
  });
}
function sync(c) {
  if (!c || !c.x) return;
  const t = c.clipT,
    i = Math.max(0, Math.min(N - 1, Math.round(t / DT))),
    px = c.x(t),
    sh = isShown(c.cfg) || c.anim;
  c.clip.attr("width", Math.max(0, px - M.l));
  c.pl
    .attr("x1", px)
    .attr("x2", px)
    .attr("opacity", sh ? 0.5 : 0);
  const v = seriesFor(c.cfg)[i];
  c.dot
    .attr("cx", px)
    .attr("cy", c.y(Math.max(c.cfg.yMin || 0, Math.min(c.cfg.yMax, v))))
    .attr("opacity", sh ? 0.9 : 0);
  readouts[c.cfg.key] = sh
    ? v.toFixed(0) + "<small>" + (c.cfg.unit || "") + "</small>"
    : '<small class="mut">verdeckt</small>';
}
function updateGlobal() {
  CH.forEach((cf) => {
    const c = charts[cf.key];
    if (!c || c.anim) return;
    c.clipT = isShown(cf) ? transport.playhead.value : 0;
    sync(c);
  });
  posterior.value = computePosterior();
}
function playReveal(c) {
  if (REDUCED) {
    c.clipT = transport.playhead.value;
    sync(c);
    return;
  }
  c.anim = true;
  const target = transport.playhead.value,
    dur = 1600,
    t0 = performance.now();
  c.clipT = 0;
  sync(c);
  (function step(now) {
    if (!c.anim) return;
    let k = Math.min(1, (now - t0) / dur);
    k = k * k * (3 - 2 * k);
    c.clipT = target * k;
    sync(c);
    if (k < 1) requestAnimationFrame(step);
    else {
      c.anim = false;
      c.clipT = target;
      sync(c);
    }
  })(t0);
}
function doReveal(cf) {
  if (cf.revealAt !== reveal.value + 1) return;
  reveal.value++;
  posterior.value = computePosterior();
  playReveal(charts[cf.key]);
}

/* ===== Transport ===== */
const transport = useSimTransport({
  tMax: TMAX,
  runSeconds: 11,
  onChange: updateGlobal,
});

function switchTab(i) {
  scenario.value = mapping[Number(i)];
  setPaths(true);
  CH.forEach((cf) => {
    const c = charts[cf.key];
    if (c && !c.anim) sync(c);
  });
  posterior.value = computePosterior();
}
watch(activeTab, switchTab);

function doReset() {
  transport.stop();
  reveal.value = 0;
  CH.forEach((cf) => {
    if (charts[cf.key]) charts[cf.key].anim = false;
  });
  shuffle();
  DATA = genData();
  transport.jumpToEnd();
  setPaths(false);
  updateGlobal();
}

watch(isSlideActive, (a) => {
  if (!a) transport.stop();
});

onMounted(() => {
  buildCharts();
  applyScales();
  updateGlobal();
  resizeObs = new ResizeObserver(() => {
    applyScales();
    updateGlobal();
  });
  if (chansEl.value) resizeObs.observe(chansEl.value);
});
onUnmounted(() => {
  CH.forEach((cf) => {
    if (charts[cf.key]) charts[cf.key].anim = false;
  });
  resizeObs?.disconnect();
});
</script>

<template>
  <SimShell
    eyebrow="Diagnose durch Konjunktion · Raten Sie mit"
    title="Die Queue wächst — Producer-Spike, vergifteter Consumer oder toter Consumer?"
    subtitle="Das Leitsignal — Queue Depth — steigt in allen drei Szenarien identisch. Die Zuordnung wird erst nach Aufdecken aller drei Signale verraten. Beachte die Asymmetrie: ein Szenario ist schon nach dem ersten Signal eindeutig, die anderen zwei erst nach dem dritten."
    :presets="presets"
    presets-label="Szenario:"
    gear-title="Reset & Modell"
    :model-value="activeTab"
    @update:model-value="(v) => (activeTab = v)"
  >
    <template #transport>
      <button class="rq-btn rq-primary" @click="transport.toggle()">
        {{ transport.playing.value ? "⏸ Pause" : "▶ Abspielen" }}
      </button>
      <input
        class="rq-scrub"
        type="range"
        :min="0"
        :max="TMAX"
        :step="0.5"
        :value="transport.playhead.value"
        aria-label="Zeitpunkt"
        @input="(e) => transport.scrub(parseFloat(e.target.value))"
      />
      <span class="rq-time"
        >t = {{ transport.playhead.value.toFixed(0) }} s</span
      >
      <span class="rq-steplbl">Signale: {{ reveal }} / {{ NREV }}</span>
    </template>

    <template #stage>
      <div class="rq-main">
        <div ref="chansEl" class="rq-chans">
          <div
            v-for="(c, i) in CH"
            :key="c.key"
            class="rq-chan"
            :class="{ lead: c.lead }"
          >
            <div class="rq-chead">
              <div class="rq-clabel">
                <span
                  v-if="!c.lead"
                  class="rq-cnum"
                  :style="{ background: c.color }"
                  >{{ i }}</span
                >
                <span :style="{ color: c.color }">{{ c.title }}</span>
                <span class="rq-badge">{{ c.badge }}</span>
              </div>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                class="rq-readout"
                :style="{ color: c.color }"
                v-html="readouts[c.key] || ''"
              />
            </div>
            <div class="rq-plot">
              <svg :ref="(el) => (svgEls[c.key] = el)" :height="chanH(c)" />
              <div
                v-if="!c.lead && !isShown(c)"
                class="rq-ov"
                :class="{ locked: c.revealAt !== reveal + 1 }"
              >
                <button
                  v-if="c.revealAt === reveal + 1"
                  class="rq-unlock"
                  type="button"
                  @click="doReveal(c)"
                >
                  🔒 Aufdecken
                </button>
                <span v-else class="rq-lockmsg">🔒 gesperrt</span>
              </div>
            </div>
          </div>
        </div>

        <div class="rq-rail">
          <div class="rq-rail-head">
            <b>Hypothesen</b>
            <span class="rq-rnote"
              >P(Ursache | Signale) · Gauss-Bayes, uniformer Prior</span
            >
          </div>
          <div v-for="h in hypView.rows" :key="h.id" class="rq-hyp">
            <div class="rq-htop">
              <span
                class="rq-hname"
                :style="{
                  color: h.win ? 'var(--rq-ink)' : 'var(--rq-muted)',
                  fontWeight: h.win ? 700 : 550,
                }"
              >
                <span class="rq-dot" :style="{ background: h.color }" />
                {{ h.name }}
                <span
                  v-if="h.win"
                  class="rq-wtag"
                  :style="{ background: h.color }"
                  >wahrscheinlich</span
                >
              </span>
              <span
                class="rq-hpct"
                :style="{ color: h.win ? h.color : 'var(--rq-muted)' }"
                >{{ Math.round(h.p * 100) }}%</span
              >
            </div>
            <div class="rq-track">
              <div
                class="rq-bar"
                :style="{
                  width: (h.p * 100).toFixed(0) + '%',
                  background: h.color,
                  opacity: h.win ? 1 : 0.5,
                }"
              />
            </div>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p v-if="hypView.tie" class="rq-tie" v-html="hypView.tie" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="rq-reason" v-html="reasonHtml" />
        </div>
      </div>
    </template>

    <template #gear>
      <div class="rq-gear">
        <button class="rq-btn" @click="doReset">
          Zurücksetzen &amp; neu mischen
        </button>
        <p class="rq-gear-note">
          Konvention: das Leitsignal ist über die Szenarien identisch generiert
          (Idealisierung zugunsten der Didaktik). <b>unacked</b> ist der
          Schlüssel-Kanal, der in Standard-Dashboards oft fehlt: ein toter
          Consumer hält <b>nichts</b> in-flight (unacked → 0), ein
          vergifteter/blockierter hält den <b>vollen Prefetch</b> (unacked hoch,
          stabil). Bayes-Balken = Illustration der Belief-Richtung, kein
          Produktionsrezept.
        </p>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Palette des Originals (Light verbatim) + Dark-Overrides. */
.rq-main,
.rq-gear {
  --rq-field: #eef1f4;
  --rq-panel: #fff;
  --rq-ink: #14213d;
  --rq-muted: #6b7689;
  --rq-hair: #dde3ea;
  --rq-hair-strong: #c3ccd6;
  --rq-c0: #3b3f8f;
  --rq-c1: #c2773f;
  --rq-c2: #1f8a82;
  --rq-c3: #c23b58;
  --rq-c4: #2f6f9f;
}
:global(html.dark .rq-main),
:global(html.dark .rq-gear) {
  --rq-field: #10151c;
  --rq-panel: #151b24;
  --rq-ink: #dee5f0;
  --rq-muted: #93a0b4;
  --rq-hair: #26303e;
  --rq-hair-strong: #3a4757;
  --rq-c0: #8d92e8;
  --rq-c1: #e0a06a;
  --rq-c2: #43c2b7;
  --rq-c3: #e8748d;
  --rq-c4: #6aabde;
}

.rq-main {
  display: grid;
  grid-template-columns: 1fr 268px;
  gap: 10px;
  align-items: start;
}
.rq-chans {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rq-chan {
  background: var(--rq-panel);
  border: 1px solid var(--rq-hair);
  border-radius: 9px;
  padding: 5px 9px 2px;
}
.rq-chan.lead {
  border-color: var(--rq-hair-strong);
}
.rq-chead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.rq-clabel {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rq-cnum {
  font-size: 8px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
}
.rq-badge {
  font-family: var(--slidev-code-font-family);
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--rq-muted);
  border: 1px solid var(--rq-hair-strong);
  border-radius: 4px;
  padding: 0 4px;
}
.rq-readout {
  font-family: var(--slidev-code-font-family);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.rq-readout :deep(small) {
  font-size: 8px;
  color: var(--rq-muted);
  font-weight: 500;
  margin-left: 1px;
}
.rq-readout :deep(.mut) {
  color: var(--rq-muted);
}
.rq-plot {
  position: relative;
}
.rq-plot svg {
  display: block;
  width: 100%;
}
.rq-ov {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rq-field);
  border-radius: 7px;
  border: 1px dashed var(--rq-hair-strong);
  z-index: 2;
}
.rq-ov.locked {
  opacity: 0.75;
}
.rq-unlock {
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  color: var(--rq-panel);
  background: var(--rq-ink);
  border: none;
  border-radius: 7px;
  padding: 4px 11px;
}
.rq-lockmsg {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--rq-muted);
}

.rq-rail {
  background: var(--rq-panel);
  border: 1px solid var(--rq-hair);
  border-radius: 9px;
  padding: 9px 11px;
  font-size: 11px;
  color: var(--rq-ink);
}
.rq-rail-head {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.rq-rail-head b {
  font-size: 11px;
}
.rq-rnote {
  font-family: var(--slidev-code-font-family);
  font-size: 8px;
  color: var(--rq-muted);
}
.rq-hyp {
  margin-bottom: 8px;
}
.rq-htop {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}
.rq-hname {
  font-size: 10.5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.rq-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.rq-wtag {
  font-family: var(--slidev-code-font-family);
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.rq-hpct {
  font-family: var(--slidev-code-font-family);
  font-size: 10.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.rq-track {
  height: 7px;
  background: var(--rq-field);
  border-radius: 4px;
  overflow: hidden;
}
.rq-bar {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  transition:
    width 0.28s linear,
    opacity 0.25s;
}
.rq-tie {
  font-family: var(--slidev-code-font-family);
  font-size: 8.5px;
  color: var(--rq-muted);
  margin: 0 0 6px;
  padding: 4px 6px;
  background: var(--rq-field);
  border-radius: 5px;
  border-left: 3px solid var(--rq-c4);
  line-height: 1.4;
}
.rq-reason {
  margin: 6px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--rq-hair);
  font-size: 10.5px;
  line-height: 1.45;
  min-height: 56px;
}
.rq-reason :deep(b) {
  font-weight: 650;
}

/* Transport & Buttons */
.rq-btn {
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  border: 1px solid var(--rq-hair-strong, #c3ccd6);
  background: var(--rq-panel, #fff);
  color: inherit;
  border-radius: 7px;
  padding: 4px 10px;
}
.rq-primary {
  font-weight: 650;
}
.rq-scrub {
  width: 130px;
  accent-color: var(--rq-c0, #3b3f8f);
  cursor: pointer;
  height: 4px;
}
.rq-time {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
}
.rq-steplbl {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
}

.rq-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.rq-gear-note {
  font-size: 9.5px;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0;
}
</style>
