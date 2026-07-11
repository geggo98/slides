<script setup>
/**
 * MemoryLeakSim.vue — „Heap wächst — Leak oder Cache-Warmup?" (Diagnose-
 * Drill), portiert aus memory-leak-vs-cache.html. Daten-Generatoren, Bayes-
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
const DT = 0.25,
  N = 481,
  W_WIN = 48; // 120s bei 4 Samples/s — noetig, um den Saegezahn aufzuloesen
const HEAP_MAX = 3.4,
  ALLOC = 0.35;
function floorOf(h, t) {
  return h === "leak" ? 0.5 + 2.7 * (t / 120) : 0.5 + 1.1 * ramp(t, 0, 60);
}
function genData() {
  const S = mulberry32;
  const r = {
    hL: S(11),
    hC: S(12),
    gfL: S(21),
    gfC: S(22),
    rcL: S(31),
    rcC: S(32),
  };
  const o = {
    heap: { leak: [], cache: [] },
    gcf: { leak: [], cache: [] },
    reclaim: { leak: [], cache: [] },
    postgc: { leak: [], cache: [] },
  };
  ["leak", "cache"].forEach((h) => {
    let cur = 0.55,
      lastMin = 0.55;
    const rng = h === "leak" ? r.hL : r.hC;
    for (let i = 0; i < N; i++) {
      const t = i * DT,
        fl = floorOf(h, t);
      cur += ALLOC * DT * (1 + noise(rng, 0.35));
      if (cur >= HEAP_MAX) {
        cur = fl + Math.abs(noise(rng, 0.06));
        lastMin = cur;
      }
      if (cur < fl) cur = fl;
      o.heap[h].push(cur);
      o.postgc[h].push(lastMin);
      const period = (HEAP_MAX - fl) / ALLOC;
      o.gcf[h].push(
        Math.max(0.5, 60 / period + noise(h === "leak" ? r.gfL : r.gfC, 1.2)),
      );
      o.reclaim[h].push(
        Math.max(
          0.05,
          HEAP_MAX - fl + noise(h === "leak" ? r.rcL : r.rcC, 0.18),
        ),
      );
    }
  });
  return o;
}
function muOf(key, h, t) {
  const fl = floorOf(h, t);
  switch (key) {
    case "heap":
      return (HEAP_MAX + fl) / 2;
    case "gcf": {
      const p = (HEAP_MAX - fl) / ALLOC;
      return 60 / p;
    }
    case "reclaim":
      return HEAP_MAX - fl;
    case "postgc":
      return fl;
  }
}
const SIGMA = { heap: null, gcf: null, reclaim: 0.22, postgc: 0.18 }; // gcf nicht inferenzwirksam: konfundiert real mit Last
const CH = [
  {
    key: "heap",
    title: "Heap Used (roh)",
    unit: " GB",
    color: "var(--ml-c0)",
    yMax: 3.8,
    yTicks: [0, 1, 2, 3],
    lead: true,
    revealAt: 0,
    dep: true,
    badge: "Leitsignal · Sägezahn",
    fmt: (v) => v.toFixed(2),
  },
  {
    key: "gcf",
    title: "GC-Frequenz",
    unit: "/min",
    color: "var(--ml-c1)",
    yMax: 14,
    yTicks: [0, 6, 12],
    lead: false,
    revealAt: 1,
    dep: true,
    badge: "konfundiert mit Last · nicht inferenzwirksam",
    fmt: (v) => v.toFixed(1),
  },
  {
    key: "reclaim",
    title: "Reclaim pro GC",
    unit: " GB",
    color: "var(--ml-c2)",
    yMax: 3.2,
    yTicks: [0, 1.5, 3],
    lead: false,
    revealAt: 2,
    dep: true,
    badge: "Diskriminator",
    fmt: (v) => v.toFixed(2),
  },
  {
    key: "postgc",
    title: "Post-GC-Minimum",
    unit: " GB",
    color: "var(--ml-c3)",
    yMax: 3.8,
    yTicks: [0, 1, 2, 3],
    lead: false,
    revealAt: 3,
    dep: true,
    badge: "abgeleitet aus Signal 0",
    fmt: (v) => v.toFixed(2),
  },
];
const HYPS = [
  { id: "leak", name: "Memory-Leak", color: "var(--ml-c3)" },
  { id: "cache", name: "Cache-Warmup", color: "var(--ml-c2)" },
];
const SHORT = { leak: "Leak", cache: "Cache" };
const CAUSE = { leak: "Memory-Leak", cache: "Cache-Warmup (gesund)" };
const REASON = {
  0: "Nur der rohe Heap. Sägezahn, steigend, GCs werden hektischer — sieht bedrohlich aus. Aber ein Cache, der sein Sollmaß noch nicht erreicht hat, sieht <b>genauso</b> aus.",
  leak1:
    "GC-Frequenz steigt — <b>grenzt nichts ein</b>: sie konfundiert mit Last und Sockel gleichermaßen; ohne Last-Modell nicht attribuierbar.",
  cache1:
    "GC-Frequenz steigt — <b>grenzt nichts ein</b>: sie konfundiert mit Last und Sockel gleichermaßen; ohne Last-Modell nicht attribuierbar.",
  leak2:
    "Reclaim pro GC <b>fällt gegen null</b> → jede GC gewinnt weniger zurück, der unfreigebbare Anteil wächst unbegrenzt. Starkes Leak-Indiz.",
  cache2:
    "Reclaim pro GC fällt anfangs, <b>stabilisiert sich</b> dann → der unfreigebbare Anteil (der Cache) hat ein Sollmaß erreicht. Warmup-Indiz.",
  leak3:
    "Post-GC-Minimum <b>steigt monoton</b> ohne Plateau — das ist die Signatur, die kein gesunder Zustand erzeugt. <b>Memory-Leak.</b> Beachte: diese Achse wurde aus Signal 0 <b>berechnet</b>, nicht gemessen.",
  cache3:
    "Post-GC-Minimum läuft in ein <b>Plateau</b> (~1,6 GB) — der Cache ist warm, der Sockel stabil. <b>Kein Leak.</b> Der Alarm auf dem Roh-Heap wäre ein False Positive gewesen.",
};

/* ===== Zustand ===== */
const TMAX = (N - 1) * DT;
const NREV = CH.filter((c) => !c.lead).length;
const SCEN = HYPS.map((h) => h.id);
const uid = "ml" + Math.random().toString(36).slice(2, 8);
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

/* Bayes (verbatim, gefenstert) */
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
        .attr("stroke", "var(--ml-hair)");
      c.gA
        .append("text")
        .attr("x", M.l - 6)
        .attr("y", c.y(t))
        .attr("dy", ".32em")
        .attr("text-anchor", "end")
        .attr("font-family", "var(--slidev-code-font-family)")
        .attr("font-size", 8.5)
        .attr("fill", "var(--ml-muted)")
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
            .attr("fill", "var(--ml-muted)")
            .text(xt + "s");
      });
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
    ? (c.cfg.fmt ? c.cfg.fmt(v) : v.toFixed(0)) +
      "<small>" +
      (c.cfg.unit || "") +
      "</small>"
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
    title="Der Heap wächst — Memory-Leak oder gesunder Cache-Warmup?"
    subtitle="Der rohe Heap-Sägezahn sieht in beiden Szenarien lange gleich aus: steigend, hektischer werdende GCs. Die Diagnose steckt nicht im Roh-Signal, sondern in einer abgeleiteten Achse: dem Heap-Stand nach jeder Full GC. Signal 3 ist kein neuer Messwert — es wird aus Signal 0 berechnet (untere Hüllkurve des Sägezahns). Die richtige Achse zu wählen ist selbst Signalkombination."
    :presets="presets"
    presets-label="Szenario:"
    gear-title="Reset & Modell"
    :model-value="activeTab"
    @update:model-value="(v) => (activeTab = v)"
  >
    <template #transport>
      <button class="ml-btn ml-primary" @click="transport.toggle()">
        {{ transport.playing.value ? "⏸ Pause" : "▶ Abspielen" }}
      </button>
      <input
        class="ml-scrub"
        type="range"
        :min="0"
        :max="TMAX"
        :step="0.5"
        :value="transport.playhead.value"
        aria-label="Zeitpunkt"
        @input="(e) => transport.scrub(parseFloat(e.target.value))"
      />
      <span class="ml-time"
        >t = {{ transport.playhead.value.toFixed(0) }} s</span
      >
      <span class="ml-steplbl">Signale: {{ reveal }} / {{ NREV }}</span>
    </template>

    <template #stage>
      <div class="ml-main">
        <div ref="chansEl" class="ml-chans">
          <div
            v-for="(c, i) in CH"
            :key="c.key"
            class="ml-chan"
            :class="{ lead: c.lead }"
          >
            <div class="ml-chead">
              <div class="ml-clabel">
                <span
                  v-if="!c.lead"
                  class="ml-cnum"
                  :style="{ background: c.color }"
                  >{{ i }}</span
                >
                <span :style="{ color: c.color }">{{ c.title }}</span>
                <span class="ml-badge">{{ c.badge }}</span>
              </div>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                class="ml-readout"
                :style="{ color: c.color }"
                v-html="readouts[c.key] || ''"
              />
            </div>
            <div class="ml-plot">
              <svg :ref="(el) => (svgEls[c.key] = el)" :height="chanH(c)" />
              <div
                v-if="!c.lead && !isShown(c)"
                class="ml-ov"
                :class="{ locked: c.revealAt !== reveal + 1 }"
              >
                <button
                  v-if="c.revealAt === reveal + 1"
                  class="ml-unlock"
                  type="button"
                  @click="doReveal(c)"
                >
                  🔒 Aufdecken
                </button>
                <span v-else class="ml-lockmsg">🔒 gesperrt</span>
              </div>
            </div>
          </div>
        </div>

        <div class="ml-rail">
          <div class="ml-rail-head">
            <b>Hypothesen</b>
            <span class="ml-rnote"
              >P(Ursache | aufgedeckte Signale) · gefenstertes Gauss-Bayes,
              uniformer Prior</span
            >
          </div>
          <div v-for="h in hypView.rows" :key="h.id" class="ml-hyp">
            <div class="ml-htop">
              <span
                class="ml-hname"
                :style="{
                  color: h.win ? 'var(--ml-ink)' : 'var(--ml-muted)',
                  fontWeight: h.win ? 700 : 550,
                }"
              >
                <span class="ml-dot" :style="{ background: h.color }" />
                {{ h.name }}
                <span
                  v-if="h.win"
                  class="ml-wtag"
                  :style="{ background: h.color }"
                  >wahrscheinlich</span
                >
              </span>
              <span
                class="ml-hpct"
                :style="{ color: h.win ? h.color : 'var(--ml-muted)' }"
                >{{ Math.round(h.p * 100) }}%</span
              >
            </div>
            <div class="ml-track">
              <div
                class="ml-bar"
                :style="{
                  width: (h.p * 100).toFixed(0) + '%',
                  background: h.color,
                  opacity: h.win ? 1 : 0.5,
                }"
              />
            </div>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p v-if="hypView.tie" class="ml-tie" v-html="hypView.tie" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="ml-reason" v-html="reasonHtml" />
        </div>
      </div>
    </template>

    <template #gear>
      <div class="ml-gear">
        <button class="ml-btn" @click="doReset">
          Zurücksetzen &amp; neu mischen
        </button>
        <p class="ml-gear-note">
          Roh-Heap und GC-Frequenz sind bewusst <b>nicht inferenzwirksam</b>:
          der Sägezahn ist phasenverrauscht, und GC-Frequenz konfundiert in
          Realität mit der Last (mehr Traffic → mehr Allokation → mehr GCs) —
          ohne Last-Modell nicht attribuierbar. Das
          <b>Post-GC-Minimum</b> (untere Hüllkurve) ist beim Leak monoton
          steigend, beim Cache-Warmup ein Plateau; der <b>Reclaim pro GC</b>
          fällt beim Leak gegen null. Idealisierung: ein realer LRU-Cache am
          Sollmaß und ein langsames Leak können sich überlagern — dann braucht
          es längere Fenster oder Histogramm über Post-GC-Minima.
        </p>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Palette des Originals (Light verbatim) + Dark-Overrides. */
.ml-main,
.ml-gear {
  --ml-field: #eef1f4;
  --ml-panel: #fff;
  --ml-ink: #14213d;
  --ml-muted: #6b7689;
  --ml-hair: #dde3ea;
  --ml-hair-strong: #c3ccd6;
  --ml-c0: #3b3f8f;
  --ml-c1: #c2773f;
  --ml-c2: #1f8a82;
  --ml-c3: #c23b58;
  --ml-c4: #2f6f9f;
}
:global(html.dark) .ml-main,
:global(html.dark) .ml-gear {
  --ml-field: #10151c;
  --ml-panel: #151b24;
  --ml-ink: #dee5f0;
  --ml-muted: #93a0b4;
  --ml-hair: #26303e;
  --ml-hair-strong: #3a4757;
  --ml-c0: #8d92e8;
  --ml-c1: #e0a06a;
  --ml-c2: #43c2b7;
  --ml-c3: #e8748d;
  --ml-c4: #6aabde;
}

.ml-main {
  display: grid;
  grid-template-columns: 1fr 268px;
  gap: 10px;
  align-items: start;
}
.ml-chans {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ml-chan {
  background: var(--ml-panel);
  border: 1px solid var(--ml-hair);
  border-radius: 9px;
  padding: 5px 9px 2px;
}
.ml-chan.lead {
  border-color: var(--ml-hair-strong);
}
.ml-chead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ml-clabel {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ml-cnum {
  font-size: 8px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
}
.ml-badge {
  font-family: var(--slidev-code-font-family);
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ml-muted);
  border: 1px solid var(--ml-hair-strong);
  border-radius: 4px;
  padding: 0 4px;
}
.ml-readout {
  font-family: var(--slidev-code-font-family);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.ml-readout :deep(small) {
  font-size: 8px;
  color: var(--ml-muted);
  font-weight: 500;
  margin-left: 1px;
}
.ml-readout :deep(.mut) {
  color: var(--ml-muted);
}
.ml-plot {
  position: relative;
}
.ml-plot svg {
  display: block;
  width: 100%;
}
.ml-ov {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ml-field);
  border-radius: 7px;
  border: 1px dashed var(--ml-hair-strong);
  z-index: 2;
}
.ml-ov.locked {
  opacity: 0.75;
}
.ml-unlock {
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  color: var(--ml-panel);
  background: var(--ml-ink);
  border: none;
  border-radius: 7px;
  padding: 4px 11px;
}
.ml-lockmsg {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--ml-muted);
}

.ml-rail {
  background: var(--ml-panel);
  border: 1px solid var(--ml-hair);
  border-radius: 9px;
  padding: 9px 11px;
  font-size: 11px;
  color: var(--ml-ink);
}
.ml-rail-head {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.ml-rail-head b {
  font-size: 11px;
}
.ml-rnote {
  font-family: var(--slidev-code-font-family);
  font-size: 8px;
  color: var(--ml-muted);
}
.ml-hyp {
  margin-bottom: 8px;
}
.ml-htop {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}
.ml-hname {
  font-size: 10.5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.ml-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.ml-wtag {
  font-family: var(--slidev-code-font-family);
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.ml-hpct {
  font-family: var(--slidev-code-font-family);
  font-size: 10.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.ml-track {
  height: 7px;
  background: var(--ml-field);
  border-radius: 4px;
  overflow: hidden;
}
.ml-bar {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  transition:
    width 0.28s linear,
    opacity 0.25s;
}
.ml-tie {
  font-family: var(--slidev-code-font-family);
  font-size: 8.5px;
  color: var(--ml-muted);
  margin: 0 0 6px;
  padding: 4px 6px;
  background: var(--ml-field);
  border-radius: 5px;
  border-left: 3px solid var(--ml-c4);
  line-height: 1.4;
}
.ml-reason {
  margin: 6px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--ml-hair);
  font-size: 10.5px;
  line-height: 1.45;
  min-height: 56px;
}
.ml-reason :deep(b) {
  font-weight: 650;
}

/* Transport & Buttons */
.ml-btn {
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  border: 1px solid var(--ml-hair-strong, #c3ccd6);
  background: var(--ml-panel, #fff);
  color: inherit;
  border-radius: 7px;
  padding: 4px 10px;
}
.ml-primary {
  font-weight: 650;
}
.ml-scrub {
  width: 130px;
  accent-color: var(--ml-c0, #3b3f8f);
  cursor: pointer;
  height: 4px;
}
.ml-time {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
}
.ml-steplbl {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
}

.ml-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.ml-gear-note {
  font-size: 9.5px;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0;
}
</style>
