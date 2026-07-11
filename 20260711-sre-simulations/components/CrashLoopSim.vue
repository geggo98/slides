<script setup>
/**
 * CrashLoopSim.vue — „CrashLoopBackOff — aber warum stirbt der Pod?"
 * (Diagnose-Drill), portiert aus k8s-crashloop-diagnose.html. Lebenszyklus-,
 * Memory- und Event-Generatoren sowie Hypothesen-/REASON-Konfiguration
 * verbatim; Spur-Gerüst + Aufdeck-Overlays + Hypothesen-Rail als
 * Vue-Template, D3 nur für Skalen/Marks/Reveal-Sweep in den per-Ref
 * gehaltenen SVGs. Anders als RabbitQueueSim ist dieser Drill reveal-only:
 * kein Transport, kategorialer Ausschluss statt Bayes-Posterior.
 * clipPath-Ids per Instanz-uid (mehrere Diagnose-Sims in einer SPA).
 */
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useIsSlideActive } from "@slidev/client";
import { line as d3line, scaleLinear, select } from "d3";
import SimShell from "./SimShell.vue";
import { mulberry32 } from "./lib/rng.js";

/* ===== Fall-spezifisch (verbatim) ===== */
const T_END = 300,
  LIMIT = 512;
const SCEN = ["oom", "liveness", "crash"];
const CAUSE = {
  oom: "OOMKilled (Memory-Limit)",
  liveness: "Zu aggressive Liveness-Probe",
  crash: "App-Crash (Exception)",
};
/* Lebenszyklen: Starts + Sterbezeitpunkte, BackOff 10/20/40/80s — Kadenz bewusst gleich */
function buildRuns(sc) {
  const runs = [];
  let t = 0;
  const back = [10, 20, 40, 80, 80];
  const life = sc === "oom" ? 46 : sc === "liveness" ? 40 : 27; // Lebensdauer pro Lauf
  let i = 0;
  while (t + life < T_END && runs.length < 6) {
    runs.push({ start: t, die: t + life });
    t = t + life + back[Math.min(i, 4)];
    i++;
  }
  return runs;
}
function memSeries(sc, runs) {
  const rng = mulberry32(sc === "oom" ? 7 : sc === "liveness" ? 8 : 9),
    pts = [];
  for (let t = 0; t <= T_END; t += 1) {
    const run = runs.find((r) => t >= r.start && t <= r.die);
    if (!run) {
      pts.push({ t, v: 0 });
      continue;
    }
    const a = t - run.start,
      life = run.die - run.start;
    let v;
    if (sc === "oom") v = 60 + (LIMIT - 60) * Math.pow(a / life, 0.9);
    else if (sc === "liveness") v = 40 + 150 * (1 - Math.exp(-a / 14));
    else v = 40 + 85 * (1 - Math.exp(-a / 8));
    pts.push({ t, v: Math.max(0, v + (rng() - 0.5) * 14) });
  }
  return pts;
}
function events(sc, runs) {
  const ev = [];
  runs.forEach((r) => {
    ev.push({ t: r.start, lane: 0, kind: "start", txt: "Started" });
    if (sc === "oom") {
      ev.push({ t: r.die, lane: 1, kind: "kill", txt: "OOMKilled" });
      ev.push({ t: r.die, lane: 2, kind: "code", txt: "137" });
    } else if (sc === "liveness") {
      [10, 20, 30].forEach((d) =>
        ev.push({
          t: r.start + d,
          lane: 1,
          kind: "probe",
          txt: "Liveness probe failed",
        }),
      );
      ev.push({ t: r.die, lane: 1, kind: "kill", txt: "Killing" });
      ev.push({ t: r.die, lane: 2, kind: "code", txt: "143" });
    } else {
      ev.push({ t: r.die, lane: 1, kind: "crash", txt: "Back-off restarting" });
      ev.push({ t: r.die, lane: 2, kind: "code", txt: "1" });
    }
  });
  return ev;
}
const HY = [
  { id: "oom", nm: "OOMKilled (Limit erreicht)" },
  { id: "liveness", nm: "Liveness-Probe killt langsamen Start" },
  { id: "crash", nm: "App-Crash (Exception)" },
];
const REASON = {
  1: "Nur der Restart-Zähler. Er steigt mit BackOff-Kadenz — <b>dass</b> der Pod stirbt ist klar, <b>warum</b> nicht. Alle drei Hypothesen offen.",
  oom2: "Memory-Sägezahn <b>küsst das Limit</b> und bricht ab — jeder Lauf endet exakt an der 512-Mi-Decke. Praktisch eindeutig <b>OOM</b>; Spur 3 liefert den Beweis.",
  liveness2:
    "Memory <b>moderat</b> (~190 Mi), weit unter dem Limit. OOM raus — aber Probe-Kill und App-Crash sehen hier gleich aus.",
  crash2:
    "Memory <b>moderat</b> (~125 Mi), weit unter dem Limit. OOM raus — aber Probe-Kill und App-Crash sehen hier gleich aus.",
  oom3: "Exit-Code <b>137</b> (= 128+SIGKILL) + Event <code>OOMKilled</code>: der Kernel killt hart am cgroup-Limit. Fix: Limit/Heap-Verhältnis, nicht App-Logik.",
  liveness3:
    "Exit-Code <b>143</b> (= 128+SIGTERM) + Events <code>Liveness probe failed</code> ×3 <b>vor</b> jedem Kill: das Kubelet beendet kontrolliert einen Pod, der nur <b>langsam startet</b>. Fix: <code>startupProbe</code> / initialDelay — kein App-Bug.",
  crash3:
    "Exit-Code <b>1</b>, keine Probe-Events, Event <code>Back-off restarting</code>: die Anwendung terminiert <b>selbst</b> mit Fehler. Jetzt — und erst jetzt — sind die App-Logs der richtige Ort.",
};

/* Spur-Konfiguration: Titel/Badges verbatim aus den Panel-Köpfen des
 * Originals; Höhen für den Folien-Kanvas komprimiert (96/150/126 → 74/96/104). */
const CH = [
  {
    key: "lane1",
    title: "Spur 1 — Restarts & Pod-Phase",
    badge: "Leitsignal · fast identisch",
    color: "var(--cl-c0)",
    h: 74,
    lead: true,
    revealAt: 1,
  },
  {
    key: "lane2",
    title: "Spur 2 — Container Memory vs. Limit",
    badge: "Diskriminator",
    color: "var(--cl-ok)",
    h: 96,
    lead: false,
    revealAt: 2,
  },
  {
    key: "lane3",
    title: "Spur 3 — Events & Exit-Codes",
    badge: "Diskriminator · kategorial",
    color: "var(--cl-ev)",
    h: 104,
    lead: false,
    revealAt: 3,
  },
];
const NREV = CH.length;

/* ===== Zustand ===== */
const uid = "cl" + Math.random().toString(36).slice(2, 8);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let mapping = [];
const activeTab = ref("0"); // Szenario-Index als String (SimShell v-model)
const scenario = ref(null);
const reveal = ref(1); // Spur 1 ist immer offen
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

/* Kategoriale Ausschluss-Logik (verbatim) */
const aliveSet = computed(() => {
  const sc = scenario.value;
  if (reveal.value < 2) return new Set(SCEN);
  if (reveal.value === 2)
    return sc === "oom" ? new Set(["oom"]) : new Set(["liveness", "crash"]);
  return new Set([sc]);
});
const hypRows = computed(() => {
  const alive = aliveSet.value;
  return HY.map((h) => {
    const a = alive.has(h.id);
    const win = a && alive.size === 1;
    return { ...h, alive: a, dead: !a, win, st: a ? (win ? "✓" : "?") : "✗" };
  });
});
const reasonHtml = computed(() => {
  const key = reveal.value === 1 ? "1" : scenario.value + reveal.value;
  return REASON[key] || "";
});

/* ===== D3-Rendering (verbatim, an Refs gebunden) ===== */
const M = { t: 10, r: 14, b: 20, l: 44 };
const MONO = "var(--slidev-code-font-family)";
const svgEls = reactive({});
const chansEl = ref(null);
const charts = {};
let resizeObs = null;

function buildCharts() {
  CH.forEach((cf) => {
    const el = svgEls[cf.key];
    if (!el) return;
    const svg = select(el);
    svg.selectAll("*").remove();
    const clip = svg
      .append("defs")
      .append("clipPath")
      .attr("id", `clp-${uid}-${cf.key}`)
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", cf.h);
    const g = svg.append("g");
    const gf = svg.append("g").attr("clip-path", `url(#clp-${uid}-${cf.key})`);
    charts[cf.key] = { cfg: cf, svg, clip, g, gf, h: cf.h, anim: false };
  });
}
function applyScales() {
  CH.forEach((cf) => {
    const c = charts[cf.key];
    if (!c) return;
    const w = c.svg.node().getBoundingClientRect().width || 600;
    c.w = w;
    c.svg.attr("width", w);
    c.x = scaleLinear()
      .domain([0, T_END])
      .range([M.l, w - M.r]);
    c.g.selectAll("*").remove();
    [0, 60, 120, 180, 240, 300].forEach((t) => {
      c.g
        .append("text")
        .attr("x", c.x(t))
        .attr("y", c.h - 6)
        .attr("text-anchor", "middle")
        .attr("font-family", MONO)
        .attr("font-size", 9)
        .attr("fill", "var(--cl-muted)")
        .text(t + "s");
    });
  });
  render();
  syncClips();
}
function render() {
  const sc = scenario.value,
    runs = buildRuns(sc);
  /* Spur 1: Laufbalken + Restart-Zähler */
  {
    const c = charts.lane1;
    if (c && c.x) {
      const y = 34;
      c.gf.selectAll("*").remove();
      runs.forEach((r, i) => {
        c.gf
          .append("rect")
          .attr("x", c.x(r.start))
          .attr("width", Math.max(2, c.x(r.die) - c.x(r.start)))
          .attr("y", y - 9)
          .attr("height", 18)
          .attr("rx", 4)
          .attr("fill", "var(--cl-c0)")
          .attr("opacity", 0.25);
        c.gf
          .append("line")
          .attr("x1", c.x(r.die))
          .attr("x2", c.x(r.die))
          .attr("y1", y - 13)
          .attr("y2", y + 13)
          .attr("stroke", "var(--cl-warn)")
          .attr("stroke-width", 1.6);
        c.gf
          .append("text")
          .attr("x", c.x(r.die))
          .attr("y", y + 27)
          .attr("text-anchor", "middle")
          .attr("font-family", MONO)
          .attr("font-size", 9)
          .attr("fill", "var(--cl-warn)")
          .text("#" + (i + 1));
      });
      c.gf
        .append("text")
        .attr("x", M.l)
        .attr("y", 14)
        .attr("font-family", MONO)
        .attr("font-size", 10)
        .attr("fill", "var(--cl-muted)")
        .text(
          "Running-Phasen · rote Marken = Terminierung · CrashLoopBackOff-Pausen dazwischen",
        );
    }
  }
  /* Spur 2: Memory */
  {
    const c = charts.lane2;
    if (c && c.x) {
      c.gf.selectAll("*").remove();
      const y = scaleLinear()
        .domain([0, 560])
        .range([c.h - M.b, M.t]);
      [0, 256, 512].forEach((v) => {
        c.gf
          .append("line")
          .attr("x1", M.l)
          .attr("x2", c.w - M.r)
          .attr("y1", y(v))
          .attr("y2", y(v))
          .attr("stroke", v === 512 ? "var(--cl-warn)" : "var(--cl-hair)")
          .attr("stroke-dasharray", v === 512 ? "4 3" : null);
        c.gf
          .append("text")
          .attr("x", M.l - 6)
          .attr("y", y(v))
          .attr("dy", ".32em")
          .attr("text-anchor", "end")
          .attr("font-family", MONO)
          .attr("font-size", 9)
          .attr("fill", v === 512 ? "var(--cl-warn)" : "var(--cl-muted)")
          .text(v);
      });
      c.gf
        .append("text")
        .attr("x", c.w - M.r)
        .attr("y", y(512) - 5)
        .attr("text-anchor", "end")
        .attr("font-family", MONO)
        .attr("font-size", 9)
        .attr("fill", "var(--cl-warn)")
        .text("Limit 512 Mi");
      const pts = memSeries(sc, runs);
      const line = d3line()
        .defined((d) => d.v > 0)
        .x((d) => c.x(d.t))
        .y((d) => y(Math.min(555, d.v)));
      c.gf
        .append("path")
        .attr("d", line(pts))
        .attr("fill", "none")
        .attr("stroke", "var(--cl-ok)")
        .attr("stroke-width", 1.7);
    }
  }
  /* Spur 3: Events + Exit-Codes */
  {
    const c = charts.lane3;
    if (c && c.x) {
      c.gf.selectAll("*").remove();
      const laneY = [20, 48, 80];
      ["Lifecycle", "Events", "Exit-Code"].forEach((n, i) =>
        c.gf
          .append("text")
          .attr("x", M.l - 6)
          .attr("y", laneY[i])
          .attr("dy", ".32em")
          .attr("text-anchor", "end")
          .attr("font-family", MONO)
          .attr("font-size", 9)
          .attr("fill", "var(--cl-muted)")
          .text(n),
      );
      events(sc, runs).forEach((e) => {
        const y = laneY[e.lane];
        if (e.kind === "code") {
          const col =
            e.txt === "137"
              ? "var(--cl-warn)"
              : e.txt === "143"
                ? "var(--cl-probe)"
                : "var(--cl-muted)";
          c.gf
            .append("rect")
            .attr("x", c.x(e.t) - 13)
            .attr("y", y - 9)
            .attr("width", 26)
            .attr("height", 16)
            .attr("rx", 4)
            .attr("fill", col);
          c.gf
            .append("text")
            .attr("x", c.x(e.t))
            .attr("y", y + 3)
            .attr("text-anchor", "middle")
            .attr("font-family", MONO)
            .attr("font-size", 10)
            .attr("font-weight", 700)
            .attr("fill", "#fff")
            .text(e.txt);
        } else {
          const col =
            e.kind === "probe"
              ? "var(--cl-probe)"
              : e.kind === "kill"
                ? "var(--cl-warn)"
                : e.kind === "crash"
                  ? "var(--cl-warn)"
                  : "var(--cl-ok)";
          c.gf
            .append("circle")
            .attr("cx", c.x(e.t))
            .attr("cy", y)
            .attr("r", 4)
            .attr("fill", col);
          if (e.kind !== "start" && e.t < 80)
            c.gf
              .append("text")
              .attr("x", c.x(e.t) + 7)
              .attr("y", y + 3)
              .attr("font-family", MONO)
              .attr("font-size", 8.5)
              .attr("fill", col)
              .text(e.txt);
        }
      });
    }
  }
}
function syncClips() {
  CH.forEach((cf) => {
    const c = charts[cf.key];
    if (!c || c.anim || !c.w) return;
    c.clip.attr("width", reveal.value >= cf.revealAt ? c.w : 0);
  });
}
function playReveal(c) {
  if (!c || !c.w) return;
  if (REDUCED) {
    c.clip.attr("width", c.w);
    return;
  }
  c.anim = true;
  const dur = 1100,
    t0 = performance.now();
  c.clip.attr("width", 0);
  (function step(now) {
    if (!c.anim) return;
    let k = Math.min(1, (now - t0) / dur);
    k = k * k * (3 - 2 * k);
    c.clip.attr("width", c.w * k);
    if (k < 1) requestAnimationFrame(step);
    else {
      c.anim = false;
      c.clip.attr("width", c.w);
    }
  })(t0);
}
function doReveal(cf) {
  if (cf.revealAt !== reveal.value + 1) return;
  reveal.value++;
  playReveal(charts[cf.key]);
}

function switchTab(i) {
  scenario.value = mapping[Number(i)];
  render();
}
watch(activeTab, switchTab);

function doReset() {
  reveal.value = 1;
  CH.forEach((cf) => {
    if (charts[cf.key]) charts[cf.key].anim = false;
  });
  shuffle();
  render();
  syncClips();
}

watch(isSlideActive, (a) => {
  if (!a) {
    CH.forEach((cf) => {
      if (charts[cf.key]) charts[cf.key].anim = false;
    });
    syncClips();
  }
});

onMounted(() => {
  buildCharts();
  applyScales();
  resizeObs = new ResizeObserver(() => {
    applyScales();
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
    eyebrow="Kategoriale Evidenz · Raten Sie mit"
    title="CrashLoopBackOff — aber warum stirbt der Pod?"
    subtitle="Der Restart-Zähler steigt in allen drei Szenarien fast identisch (gleiche BackOff-Kadenz). Die Diagnose steckt nicht in einer Kurve, sondern in kategorialer Evidenz: Exit-Codes und Events — die stehen nicht im CPU/Memory-Dashboard, sondern in kubectl describe pod. Spur 2 (Memory) trennt ein Szenario ab; erst Spur 3 trennt die letzten beiden — mit einem einzigen Byte: 137 vs. 143."
    :presets="presets"
    presets-label="Szenario:"
    gear-title="Reset & Modell"
    :model-value="activeTab"
    @update:model-value="(v) => (activeTab = v)"
  >
    <template #transport>
      <span class="cl-steplbl">Spuren: {{ reveal }} / {{ NREV }}</span>
    </template>

    <template #stage>
      <div class="cl-main">
        <div ref="chansEl" class="cl-chans">
          <div
            v-for="c in CH"
            :key="c.key"
            class="cl-chan"
            :class="{ lead: c.lead }"
          >
            <div class="cl-chead">
              <div class="cl-clabel">
                <span :style="{ color: c.color }">{{ c.title }}</span>
                <span class="cl-badge">{{ c.badge }}</span>
              </div>
            </div>
            <div class="cl-plot">
              <svg :ref="(el) => (svgEls[c.key] = el)" :height="c.h" />
              <div
                v-if="!c.lead && reveal < c.revealAt"
                class="cl-ov"
                :class="{ locked: c.revealAt !== reveal + 1 }"
              >
                <button
                  v-if="c.revealAt === reveal + 1"
                  class="cl-unlock"
                  type="button"
                  @click="doReveal(c)"
                >
                  🔒 Aufdecken
                </button>
                <span v-else class="cl-lockmsg">🔒 gesperrt</span>
              </div>
            </div>
          </div>
        </div>

        <div class="cl-rail">
          <div class="cl-rail-head">
            <b>Hypothesen</b>
            <span class="cl-rnote"
              >kategorialer Ausschluss — kein Bayes nötig</span
            >
          </div>
          <div
            v-for="h in hypRows"
            :key="h.id"
            class="cl-hy"
            :class="{ alive: h.alive, dead: h.dead, win: h.win }"
          >
            <span class="cl-st">{{ h.st }}</span>
            <span class="cl-nm">{{ h.nm }}</span>
            <span v-if="h.win" class="cl-wtag">Diagnose</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="cl-reason" v-html="reasonHtml" />
        </div>
      </div>
    </template>

    <template #gear>
      <div class="cl-gear">
        <button class="cl-btn" @click="doReset">
          Zurücksetzen &amp; neu mischen
        </button>
        <p class="cl-gear-note">
          Exit-Code-Semantik: <code>137 = 128+SIGKILL(9)</code> — der
          Kernel-OOM-Killer bzw. das cgroup-Limit killt hart;
          <code>143 = 128+SIGTERM(15)</code> — Kubelet beendet kontrolliert,
          z.B. nach fehlgeschlagener Liveness-Probe; <code>1</code> — die
          Anwendung selbst terminiert mit Fehler. Der Liveness-Fall ist die
          häufigste reale Fehldiagnose: ein Pod, der nur <b>langsam startet</b>,
          wird von einer zu aggressiven Probe gekillt und sieht aus wie ein
          Absturz — Fix ist eine <code>startupProbe</code>, kein App-Debugging.
          Idealisierung: Restart-Kadenzen sind hier auf gleiche BackOff-Zeiten
          synchronisiert; real verschieben sich die Zyklen je nach
          Sterbezeitpunkt.
        </p>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* Palette des Originals (Light verbatim) + Dark-Overrides. */
.cl-main,
.cl-gear {
  --cl-field: #eef1f4;
  --cl-panel: #fff;
  --cl-ink: #14213d;
  --cl-muted: #6b7689;
  --cl-hair: #dde3ea;
  --cl-hair-strong: #c3ccd6;
  --cl-c0: #3b3f8f;
  --cl-warn: #c23b58;
  --cl-ok: #1f8a82;
  --cl-ev: #b08247;
  --cl-probe: #6d5bd0;
}
:global(html.dark) .cl-main,
:global(html.dark) .cl-gear {
  --cl-field: #10151c;
  --cl-panel: #151b24;
  --cl-ink: #dee5f0;
  --cl-muted: #93a0b4;
  --cl-hair: #26303e;
  --cl-hair-strong: #3a4757;
  --cl-c0: #8d92e8;
  --cl-warn: #e8748d;
  --cl-ok: #43c2b7;
  --cl-ev: #dfa858;
  --cl-probe: #a394f0;
}

.cl-main {
  display: grid;
  grid-template-columns: 1fr 268px;
  gap: 10px;
  align-items: start;
}
.cl-chans {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cl-chan {
  background: var(--cl-panel);
  border: 1px solid var(--cl-hair);
  border-radius: 9px;
  padding: 5px 9px 2px;
}
.cl-chan.lead {
  border-color: var(--cl-hair-strong);
}
.cl-chead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.cl-clabel {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cl-badge {
  font-family: var(--slidev-code-font-family);
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cl-muted);
  border: 1px solid var(--cl-hair-strong);
  border-radius: 4px;
  padding: 0 4px;
}
.cl-plot {
  position: relative;
}
.cl-plot svg {
  display: block;
  width: 100%;
}
.cl-ov {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cl-field);
  border-radius: 7px;
  border: 1px dashed var(--cl-hair-strong);
  z-index: 2;
}
.cl-ov.locked {
  opacity: 0.75;
}
.cl-unlock {
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  color: var(--cl-panel);
  background: var(--cl-ink);
  border: none;
  border-radius: 7px;
  padding: 4px 11px;
}
.cl-lockmsg {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--cl-muted);
}

.cl-rail {
  background: var(--cl-panel);
  border: 1px solid var(--cl-hair);
  border-radius: 9px;
  padding: 9px 11px;
  font-size: 11px;
  color: var(--cl-ink);
}
.cl-rail-head {
  display: flex;
  flex-direction: column;
  margin-bottom: 4px;
}
.cl-rail-head b {
  font-size: 11px;
}
.cl-rnote {
  font-family: var(--slidev-code-font-family);
  font-size: 8px;
  color: var(--cl-muted);
}
.cl-hy {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  padding: 5px 0;
  border-bottom: 1px solid var(--cl-hair);
}
.cl-hy:last-of-type {
  border-bottom: none;
}
.cl-st {
  font-family: var(--slidev-code-font-family);
  font-size: 10px;
  font-weight: 700;
  width: 14px;
  text-align: center;
  flex: none;
}
.cl-hy.alive .cl-st {
  color: var(--cl-ok);
}
.cl-hy.dead .cl-st {
  color: var(--cl-warn);
}
.cl-hy.dead .cl-nm {
  color: var(--cl-muted);
  text-decoration: line-through;
}
.cl-hy.win .cl-nm {
  font-weight: 700;
}
.cl-wtag {
  font-family: var(--slidev-code-font-family);
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  background: var(--cl-warn);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
  flex: none;
}
.cl-reason {
  margin: 4px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--cl-hair);
  font-size: 10.5px;
  line-height: 1.45;
  min-height: 72px;
}
.cl-reason :deep(b) {
  font-weight: 650;
}
.cl-reason :deep(code) {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  background: var(--cl-field);
  padding: 1px 3px;
  border-radius: 3px;
}

/* Transport-Slot & Buttons */
.cl-btn {
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  border: 1px solid var(--cl-hair-strong, #c3ccd6);
  background: var(--cl-panel, #fff);
  color: inherit;
  border-radius: 7px;
  padding: 4px 10px;
}
.cl-steplbl {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  opacity: 0.7;
}

.cl-gear {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.cl-gear-note {
  font-size: 9.5px;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0;
}
.cl-gear-note code {
  font-family: var(--slidev-code-font-family);
  font-size: 8.5px;
  background: var(--cl-field);
  padding: 1px 3px;
  border-radius: 3px;
}
</style>
