<script setup>
/**
 * NoisyNeighborSim.vue — „Latenz-Spikes — Noisy Neighbor, Batch-Job oder
 * GC?" (Diagnose-Drill), portiert aus noisy-neighbor-diagnose.html.
 * Daten-Generatoren, Bayes-Posterior, Kanal-/Hypothesen-Konfiguration und
 * D3-Rendering verbatim; Kanal-Gerüst + Aufdeck-Overlays + Hypothesen-Rail
 * als Vue-Template, D3 nur für Skalen/Pfade/Reveal-Animation in den per-Ref
 * gehaltenen SVGs. clipPath-Ids per Instanz-uid (mehrere Diagnose-Sims in
 * einer SPA).
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
    lat: S(11),
    ucS: S(21),
    ucB: S(22),
    ucG: S(23),
    stS: S(31),
    stB: S(32),
    stG: S(33),
    gcS: S(41),
    gcB: S(42),
    gcG: S(43),
  };
  const o = {
    lat: [],
    ucpu: { steal: [], batch: [], gc: [] },
    steal: { steal: [], batch: [], gc: [] },
    gcp: { steal: [], batch: [], gc: [] },
  };
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    o.lat.push(Math.max(5, 30 + 150 * ramp(t, INC_S, 20) + noise(r.lat, 9)));
    o.ucpu.steal.push(Math.max(0, 25 + noise(r.ucS, 3)));
    o.ucpu.batch.push(
      Math.max(0, 25 + 60 * ramp(t, INC_S, 12) + noise(r.ucB, 4)),
    );
    o.ucpu.gc.push(Math.max(0, 26 + noise(r.ucG, 3)));
    o.steal.steal.push(
      Math.max(0, 0.5 + 27 * ramp(t, INC_S, 10) + noise(r.stS, 1.6)),
    );
    o.steal.batch.push(Math.max(0, 0.5 + Math.abs(noise(r.stB, 0.4))));
    o.steal.gc.push(Math.max(0, 0.5 + Math.abs(noise(r.stG, 0.4))));
    o.gcp.steal.push(Math.max(0, 5 + Math.abs(noise(r.gcS, 2))));
    o.gcp.batch.push(Math.max(0, 5 + Math.abs(noise(r.gcB, 2))));
    o.gcp.gc.push(Math.max(0, 5 + 215 * ramp(t, INC_S, 14) + noise(r.gcG, 12)));
  }
  return o;
}
function muOf(key, h, t) {
  switch (key) {
    case "lat":
      return 30 + 150 * ramp(t, INC_S, 20);
    case "ucpu":
      return h === "batch"
        ? 25 + 60 * ramp(t, INC_S, 12)
        : h === "gc"
          ? 26
          : 25;
    case "steal":
      return h === "steal" ? 0.5 + 27 * ramp(t, INC_S, 10) : 0.5;
    case "gcp":
      return h === "gc" ? 5 + 215 * ramp(t, INC_S, 14) : 5;
  }
}
const SIGMA = { lat: null, ucpu: 4.5, steal: 1.8, gcp: 14 };
const CH = [
  {
    key: "lat",
    title: "App p99-Latenz",
    unit: "ms",
    color: "var(--nn-c0)",
    yMax: 220,
    yTicks: [0, 100, 200],
    lead: true,
    revealAt: 0,
    dep: false,
    badge: "Leitsignal · identisch",
  },
  {
    key: "ucpu",
    title: "Guest User-CPU",
    unit: "%",
    color: "var(--nn-c1)",
    yMax: 100,
    yTicks: [0, 50, 100],
    lead: false,
    revealAt: 1,
    dep: true,
    badge: "Diskriminator",
  },
  {
    key: "steal",
    title: "CPU Steal (%st)",
    unit: "%",
    color: "var(--nn-c3)",
    yMax: 32,
    yTicks: [0, 15, 30],
    lead: false,
    revealAt: 2,
    dep: true,
    badge: "Diskriminator · fehlt oft",
  },
  {
    key: "gcp",
    title: "GC-Pausenzeit",
    unit: "ms/s",
    color: "var(--nn-c2)",
    yMax: 250,
    yTicks: [0, 120, 240],
    lead: false,
    revealAt: 3,
    dep: true,
    badge: "Diskriminator",
  },
];
const HYPS = [
  { id: "steal", name: "Noisy Neighbor (Steal)", color: "var(--nn-c3)" },
  { id: "batch", name: "In-Guest Batch-Job", color: "var(--nn-c1)" },
  { id: "gc", name: "JVM GC-Druck", color: "var(--nn-c2)" },
];
const SHORT = { steal: "Steal", batch: "Batch", gc: "GC" };
const CAUSE = {
  steal: "Noisy Neighbor (CPU-Steal)",
  batch: "In-Guest Batch-Job",
  gc: "JVM GC-Druck",
};
const REASON = {
  0: "Nur die Latenz. Spürbar langsamer — aber Hypervisor, Nachbarprozess und GC sehen hier gleich aus.",
  steal1:
    "User-CPU <b>flach</b> → kein Prozess in der VM frisst CPU. Batch-Job raus. Bleibt: {Steal, GC} — beide unsichtbar in der CPU-Kurve.",
  batch1:
    "User-CPU <b>steigt stark</b> → irgendetwas <b>in</b> der VM rechnet. <b>Batch-Job</b>, praktisch eindeutig.",
  gc1: "User-CPU <b>flach</b> → kein Prozess in der VM frisst sichtbar CPU. Batch-Job raus. Bleibt: {Steal, GC}.",
  steal2:
    "%steal <b>steigt</b> → die vCPU war lauffähig, bekam aber keine physische CPU. Der Täter sitzt <b>außerhalb</b> der VM: <b>Noisy Neighbor</b>. Die VM tut nichts falsch.",
  batch2:
    "%steal flach — konsistent: der Täter sitzt in der VM. Diagnose bleibt <b>Batch-Job</b>.",
  gc2: "%steal <b>flach</b> → Hypervisor unschuldig. Steal raus — es bleibt nur noch <b>GC</b>. Das dritte Signal bestätigt.",
  steal3:
    "GC-Pausen flach — konsistent. Diagnose steht: <b>Noisy Neighbor</b>. Fix: anderer Host / dedizierte Instanz, nicht App-Tuning.",
  batch3:
    "GC-Pausen flach — konsistent. Diagnose steht: <b>Batch-Job</b> (cron? Backup? Log-Rotation?).",
  gc3: "GC-Pausenzeit <b>hoch</b> → Stop-the-World-Anteile fressen die Latenz. Eindeutig <b>GC-Druck</b> — Heap-Sizing/Collector prüfen.",
};

/* ===== Zustand ===== */
const TMAX = (N - 1) * DT;
const NREV = CH.filter((c) => !c.lead).length;
const SCEN = HYPS.map((h) => h.id);
const uid = "nn" + Math.random().toString(36).slice(2, 8);
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
    const w = c.svg.node().getBoundingClientRect().width || 600;
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
        .attr("stroke", "var(--nn-hair)");
      c.gA
        .append("text")
        .attr("x", M.l - 6)
        .attr("y", c.y(t))
        .attr("dy", ".32em")
        .attr("text-anchor", "end")
        .attr("font-family", "var(--slidev-code-font-family)")
        .attr("font-size", 8.5)
        .attr("fill", "var(--nn-muted)")
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
            .attr("fill", "var(--nn-muted)")
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
    title="Die App wird langsam — wer ist schuld: Hypervisor, Batch-Job oder GC?"
    subtitle="Das Leitsignal — App p99-Latenz — steigt in allen drei Szenarien identisch. Der Täter sitzt entweder außerhalb der VM (Noisy Neighbor / CPU-Steal), in der VM (Batch-Job) oder in der JVM (GC-Druck). Der Schlüssel-Kanal %steal fehlt in den meisten Default-Dashboards — genau deshalb wird dieser Fall real so oft falsch diagnostiziert."
    :presets="presets"
    presets-label="Szenario:"
    gear-title="Reset & Modell"
    :model-value="activeTab"
    @update:model-value="(v) => (activeTab = v)"
  >
    <template #transport>
      <button class="nn-btn nn-primary" @click="transport.toggle()">
        {{ transport.playing.value ? "⏸ Pause" : "▶ Abspielen" }}
      </button>
      <input
        class="nn-scrub"
        type="range"
        :min="0"
        :max="TMAX"
        :step="0.5"
        :value="transport.playhead.value"
        aria-label="Zeitpunkt"
        @input="(e) => transport.scrub(parseFloat(e.target.value))"
      />
      <span class="nn-time"
        >t = {{ transport.playhead.value.toFixed(0) }} s</span
      >
      <span class="nn-steplbl">Signale: {{ reveal }} / {{ NREV }}</span>
    </template>

    <template #stage>
      <div class="nn-main">
        <div ref="chansEl" class="nn-chans">
          <div
            v-for="(c, i) in CH"
            :key="c.key"
            class="nn-chan"
            :class="{ lead: c.lead }"
          >
            <div class="nn-chead">
              <div class="nn-clabel">
                <span
                  v-if="!c.lead"
                  class="nn-cnum"
                  :style="{ background: c.color }"
                  >{{ i }}</span
                >
                <span :style="{ color: c.color }">{{ c.title }}</span>
                <span class="nn-badge">{{ c.badge }}</span>
              </div>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                class="nn-readout"
                :style="{ color: c.color }"
                v-html="readouts[c.key] || ''"
              />
            </div>
            <div class="nn-plot">
              <svg :ref="(el) => (svgEls[c.key] = el)" :height="chanH(c)" />
              <div
                v-if="!c.lead && !isShown(c)"
                class="nn-ov"
                :class="{ locked: c.revealAt !== reveal + 1 }"
              >
                <button
                  v-if="c.revealAt === reveal + 1"
                  class="nn-unlock"
                  type="button"
                  @click="doReveal(c)"
                >
                  🔒 Aufdecken
                </button>
                <span v-else class="nn-lockmsg">🔒 gesperrt</span>
              </div>
            </div>
          </div>
        </div>

        <div class="nn-rail">
          <div class="nn-rail-head">
            <b>Hypothesen</b>
            <span class="nn-rnote"
              >P(Ursache | aufgedeckte Signale) · gefenstertes Gauss-Bayes,
              uniformer Prior</span
            >
          </div>
          <div v-for="h in hypView.rows" :key="h.id" class="nn-hyp">
            <div class="nn-htop">
              <span
                class="nn-hname"
                :style="{
                  color: h.win ? 'var(--nn-ink)' : 'var(--nn-muted)',
                  fontWeight: h.win ? 700 : 550,
                }"
              >
                <span class="nn-dot" :style="{ background: h.color }" />
                {{ h.name }}
                <span
                  v-if="h.win"
                  class="nn-wtag"
                  :style="{ background: h.color }"
                  >wahrscheinlich</span
                >
              </span>
              <span
                class="nn-hpct"
                :style="{ color: h.win ? h.color : 'var(--nn-muted)' }"
                >{{ Math.round(h.p * 100) }}%</span
              >
            </div>
            <div class="nn-track">
              <div
                class="nn-bar"
                :style="{
                  width: (h.p * 100).toFixed(0) + '%',
                  background: h.color,
                  opacity: h.win ? 1 : 0.5,
                }"
              />
            </div>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p v-if="hypView.tie" class="nn-tie" v-html="hypView.tie" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="nn-reason" v-html="reasonHtml" />
        </div>
      </div>
    </template>

    <template #gear>
      <div class="nn-gear">
        <button class="nn-btn" @click="doReset">
          Zurücksetzen &amp; neu mischen
        </button>
        <p class="nn-gear-note">
          Konvention wie gehabt: Leitsignal über Szenarien identisch generiert.
          <b>%steal</b> (aus <code>/proc/stat</code> bzw. <code>vmstat</code>)
          misst Zeit, in der die vCPU lauffähig war, aber vom Hypervisor keine
          physische CPU bekam — der einzige Kanal, der den Tatort
          <b>außerhalb</b> der VM lokalisiert. Idealisierung: GC-Druck erzeugt
          real auch etwas User-CPU (nebenläufige Collector-Threads); hier
          bewusst flach gehalten, damit jeder Kanal genau eine Hypothese trägt.
          Bayes: Illustration, kein Produktionsrezept.
        </p>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Palette des Originals (Light verbatim) + Dark-Overrides. */
.nn-main,
.nn-gear {
  --nn-field: #eef1f4;
  --nn-panel: #fff;
  --nn-ink: #14213d;
  --nn-muted: #6b7689;
  --nn-hair: #dde3ea;
  --nn-hair-strong: #c3ccd6;
  --nn-c0: #3b3f8f;
  --nn-c1: #c2773f;
  --nn-c2: #1f8a82;
  --nn-c3: #c23b58;
  --nn-c4: #2f6f9f;
}
:global(html.dark) .nn-main,
:global(html.dark) .nn-gear {
  --nn-field: #10151c;
  --nn-panel: #151b24;
  --nn-ink: #dee5f0;
  --nn-muted: #93a0b4;
  --nn-hair: #26303e;
  --nn-hair-strong: #3a4757;
  --nn-c0: #8d92e8;
  --nn-c1: #e0a06a;
  --nn-c2: #43c2b7;
  --nn-c3: #e8748d;
  --nn-c4: #6aabde;
}

.nn-main {
  display: grid;
  grid-template-columns: 1fr 268px;
  gap: 10px;
  align-items: start;
}
.nn-chans {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nn-chan {
  background: var(--nn-panel);
  border: 1px solid var(--nn-hair);
  border-radius: 9px;
  padding: 5px 9px 2px;
}
.nn-chan.lead {
  border-color: var(--nn-hair-strong);
}
.nn-chead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.nn-clabel {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.nn-cnum {
  font-size: 8px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
}
.nn-badge {
  font-family: var(--slidev-code-font-family);
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--nn-muted);
  border: 1px solid var(--nn-hair-strong);
  border-radius: 4px;
  padding: 0 4px;
}
.nn-readout {
  font-family: var(--slidev-code-font-family);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.nn-readout :deep(small) {
  font-size: 8px;
  color: var(--nn-muted);
  font-weight: 500;
  margin-left: 1px;
}
.nn-readout :deep(.mut) {
  color: var(--nn-muted);
}
.nn-plot {
  position: relative;
}
.nn-plot svg {
  display: block;
  width: 100%;
}
.nn-ov {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nn-field);
  border-radius: 7px;
  border: 1px dashed var(--nn-hair-strong);
  z-index: 2;
}
.nn-ov.locked {
  opacity: 0.75;
}
.nn-unlock {
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  color: var(--nn-panel);
  background: var(--nn-ink);
  border: none;
  border-radius: 7px;
  padding: 4px 11px;
}
.nn-lockmsg {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--nn-muted);
}

.nn-rail {
  background: var(--nn-panel);
  border: 1px solid var(--nn-hair);
  border-radius: 9px;
  padding: 9px 11px;
  font-size: 11px;
  color: var(--nn-ink);
}
.nn-rail-head {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.nn-rail-head b {
  font-size: 11px;
}
.nn-rnote {
  font-family: var(--slidev-code-font-family);
  font-size: 8px;
  color: var(--nn-muted);
}
.nn-hyp {
  margin-bottom: 8px;
}
.nn-htop {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}
.nn-hname {
  font-size: 10.5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.nn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.nn-wtag {
  font-family: var(--slidev-code-font-family);
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.nn-hpct {
  font-family: var(--slidev-code-font-family);
  font-size: 10.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.nn-track {
  height: 7px;
  background: var(--nn-field);
  border-radius: 4px;
  overflow: hidden;
}
.nn-bar {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  transition:
    width 0.28s linear,
    opacity 0.25s;
}
.nn-tie {
  font-family: var(--slidev-code-font-family);
  font-size: 8.5px;
  color: var(--nn-muted);
  margin: 0 0 6px;
  padding: 4px 6px;
  background: var(--nn-field);
  border-radius: 5px;
  border-left: 3px solid var(--nn-c4);
  line-height: 1.4;
}
.nn-reason {
  margin: 6px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--nn-hair);
  font-size: 10.5px;
  line-height: 1.45;
  min-height: 56px;
}
.nn-reason :deep(b) {
  font-weight: 650;
}

/* Transport & Buttons */
.nn-btn {
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  border: 1px solid var(--nn-hair-strong, #c3ccd6);
  background: var(--nn-panel, #fff);
  color: inherit;
  border-radius: 7px;
  padding: 4px 10px;
}
.nn-primary {
  font-weight: 650;
}
.nn-scrub {
  width: 130px;
  accent-color: var(--nn-c0, #3b3f8f);
  cursor: pointer;
  height: 4px;
}
.nn-time {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
}
.nn-steplbl {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
}

.nn-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.nn-gear-note {
  font-size: 9.5px;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0;
}
.nn-gear-note code {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
}
</style>
