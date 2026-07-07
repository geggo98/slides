<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useDarkMode } from "@slidev/client";
import {
  STEPS,
  CTX,
  PROMPT,
  pick,
  type Mode,
  type Step,
  type TokenProb,
} from "./autoregressiveData";

const { isDark } = useDarkMode();

const TOPN = 7; // angezeigte Top-Token (Rest = langer Schwanz)
const EOS = "<|endoftext|>";

const MODES: { id: Mode; label: string }[] = [
  { id: "greedy", label: "Greedy" },
  { id: "sample", label: "Sampling" },
  { id: "topk", label: "Top-k" },
  { id: "topp", label: "Top-p" },
  { id: "minp", label: "Min-p" },
];

// ── Zustand ──────────────────────────────────────────────────────────────────
interface Hist {
  token: string;
  working: TokenProb[];
  step: Step;
  prefill: boolean;
}
const history = ref<Hist[]>([]);
const mode = ref<Mode>("greedy");
const T = ref(1);
const K = ref(5);
const P_ = ref(0.9);
const MP = ref(0.1);
const rootEl = ref<HTMLElement | null>(null);

const generated = computed(() => history.value.map((h) => h.token));
const current = computed(() => history.value[history.value.length - 1] ?? null);

function isDone() {
  const g = generated.value;
  return (
    (g.length > 0 && g[g.length - 1] === EOS) ||
    history.value.length >= STEPS.length
  );
}

function doStep() {
  if (isDone()) return;
  const idx = history.value.length;
  const step = STEPS[idx];
  const { token, working } = pick(
    step.dist,
    mode.value,
    T.value,
    K.value,
    P_.value,
    MP.value,
  );
  history.value = [
    ...history.value,
    { token, working, step, prefill: idx === 0 },
  ];
}

function reset() {
  history.value = [];
}

// ── abgeleitete Anzeige ──────────────────────────────────────────────────────
const phase = computed(() => {
  if (history.value.length === 0) return { cls: "idle", text: "Bereit" };
  if (isDone()) return { cls: "done", text: "FERTIG · Generierung gestoppt" };
  if (history.value.length === 1)
    return {
      cls: "prefill",
      text: "PREFILL · 1.103 Prompt-Token, 1 Forward-Pass",
    };
  return {
    cls: "decode",
    text: `DECODE · Schritt ${history.value.length} · 1 Token, KV-Cache genutzt`,
  };
});

const pickedTok = computed(() => {
  const c = current.value;
  if (!c) return "—";
  return c.token === EOS ? "⟨EOS⟩" : c.token === "\\n" ? "\\n" : c.token;
});

const pickedP = computed(() => {
  const c = current.value;
  if (!c) return "";
  const found = c.step.dist.find((d) => d[0] === c.token);
  return found != null
    ? `P = ${(found[1] * 100).toFixed(1)} %  (${mode.value})`
    : `(${mode.value})`;
});

const explain = computed(() => {
  if (history.value.length === 0)
    return 'Klicke „Nächster Schritt" (oder →), um mit dem Prefill zu beginnen.';
  if (isDone()) {
    const out = PROMPT.concat(generated.value.filter((t) => t !== EOS)).join(
      " ",
    );
    return `Ausgabe: „${out}". Gestoppt durch ⟨EOS⟩ bzw. Ende der Sequenz.`;
  }
  const word = history.value.length === 1 ? "Prefill" : "Decode";
  return `${word}: Verteilung berechnet, „${pickedTok.value}" gewählt und angehängt.`;
});

// Balken der aktuellen Verteilung (Top-N)
const bars = computed(() => {
  const c = current.value;
  if (!c) return null;
  const shown = [...c.step.dist].sort((a, b) => b[1] - a[1]).slice(0, TOPN);
  const maxP = shown[0][1];
  const cum = shown.reduce((a, d) => a + d[1], 0);
  const active = new Set(c.working.map((d) => d[0]));
  const dimMode =
    mode.value === "topk" || mode.value === "topp" || mode.value === "minp";
  const rows = shown.map(([tok, p]) => ({
    tok,
    disp: tok === EOS ? "⟨EOS⟩" : tok,
    p,
    pct: (p / maxP) * 100,
    hi: tok === c.token,
    dim: dimMode && !active.has(tok),
  }));
  const survivors = rows.filter((r) => !r.dim).length;
  const mass =
    mode.value === "minp"
      ? `Schwelle = ${MP.value.toFixed(2)}·p_max ≈ ${(MP.value * maxP * 100).toFixed(1)} % · ${survivors} Token`
      : `Top-${shown.length} ≈ ${(cum * 100).toFixed(1)} % der Masse`;
  return {
    rows,
    title: `P(nächstes Token) nach ${c.step.after}`,
    mass,
    cum,
    step: c.step,
  };
});

const barsNote = computed(() => {
  const b = bars.value;
  if (!b) return "";
  if (b.step.noun)
    return 'Greedy würde „floor" wählen — nicht „mat". Das Idiom-Token „mat" liegt bei einem echten Basismodell außerhalb der Top-20 (Rang ≈ 28, p ≈ 0,4 %). Auswendig-Gelerntes ≠ höchste Wahrscheinlichkeit.';
  if (b.step.eos)
    return "Ist ⟨EOS⟩ wahrscheinlich genug (bzw. wird es gesampelt), stoppt die Generierung — alternativ bei max_new_tokens.";
  return `Rest der Verteilung (~${((1 - b.cum) * 100).toFixed(0)} %) verteilt sich auf zehntausende seltene Token (langer Schwanz).`;
});

const done = computed(() => isDone());
const showCaret = computed(() => !done.value);

// ── Steuerung: Pfeiltasten / Space, nur solange nicht fertig ──────────────────
function onKeydown(e: KeyboardEvent) {
  if (!rootEl.value || rootEl.value.offsetParent === null) return; // nur wenn sichtbar
  if (e.key === "ArrowRight" || e.key === " ") {
    if (!done.value) {
      e.preventDefault();
      e.stopPropagation();
      doStep();
    }
  }
}
onMounted(() => document.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown, true));

// ── Farben (Light/Dark) ──────────────────────────────────────────────────────
const P = computed(() => {
  const d = isDark.value;
  return {
    text: d ? "#e0e0e8" : "#1f2937",
    muted: d ? "#9090a0" : "#6b7280",
    line: d ? "#2a2a35" : "#e5e7eb",
    cardBg: d ? "#14141c" : "#ffffff",
    ctlBg: d ? "#1a1a24" : "#fafafa",
    segBg: d ? "#1e1e2a" : "#ffffff",
    blueB: d ? "#60a5fa" : "#2563eb",
    blueBg: d ? "#1e2a4a" : "#eff6ff",
    blueInk: d ? "#bfdbfe" : "#1e3a8a",
    greenB: d ? "#4ade80" : "#16a34a",
    greenBg: d ? "#14321f" : "#f0fdf4",
    greenInk: d ? "#bbf7d0" : "#14532d",
    amberInk: d ? "#fbbf24" : "#92400e",
    bar: "#3b82f6",
    barHi: "#fb923c",
    grayBg: d ? "#24242e" : "#f3f4f6",
    grayInk: d ? "#b0b0bc" : "#4b5563",
    grayBd: d ? "#3a3a4a" : "#d1d5db",
    track: d ? "#24242e" : "#f1f5f9",
    prefillBg: d ? "#2a2340" : "#ede9fe",
    prefillInk: d ? "#c4b5fd" : "#5b21b6",
    btnPrimary: d ? "#15803d" : "#16a34a",
  };
});
</script>

<template>
  <div ref="rootEl" class="demo">
    <!-- Sequenz -->
    <div class="seq">
      <div v-for="c in CTX" :key="c.label" class="chip ctx">
        {{ c.label }} · <b>{{ c.n.toLocaleString("de-DE") }} Token</b>
      </div>
      <div v-for="t in PROMPT" :key="t" class="chip prompt">{{ t }}</div>
      <div
        v-for="(t, i) in generated"
        :key="'g' + i"
        class="chip gen"
        :class="{ new: i === generated.length - 1 }"
      >
        {{ t === "<|endoftext|>" ? "⟨EOS⟩" : t }}
      </div>
      <div v-if="showCaret" class="caret" />
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="seg">
        <button
          v-for="m in MODES"
          :key="m.id"
          :class="{ on: mode === m.id }"
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
      </div>
      <label class="slider" :class="{ disabled: mode === 'greedy' }">
        <span>Temp</span>
        <input v-model.number="T" type="range" min="0.1" max="2" step="0.05" />
        <span class="val">{{ T.toFixed(2) }}</span>
      </label>
      <label v-if="mode === 'topk'" class="slider">
        <span>k</span>
        <input v-model.number="K" type="range" min="1" max="12" step="1" />
        <span class="val">{{ K }}</span>
      </label>
      <label v-if="mode === 'topp'" class="slider">
        <span>p</span>
        <input v-model.number="P_" type="range" min="0.1" max="1" step="0.05" />
        <span class="val">{{ P_.toFixed(2) }}</span>
      </label>
      <label v-if="mode === 'minp'" class="slider">
        <span>min-p</span>
        <input
          v-model.number="MP"
          type="range"
          min="0.01"
          max="0.5"
          step="0.01"
        />
        <span class="val">{{ MP.toFixed(2) }}</span>
      </label>
      <div class="spacer" />
      <button class="btn primary" :disabled="done" @click="doStep">
        Nächster Schritt&nbsp;▶
      </button>
      <button class="btn ghost" @click="reset">↻</button>
    </div>

    <!-- Panels -->
    <div class="panels">
      <div class="card status">
        <span class="phase" :class="phase.cls">{{ phase.text }}</span>
        <div class="lbl">Ausgewähltes Token</div>
        <div class="picked">{{ pickedTok }}</div>
        <div class="picked-p">{{ pickedP }}</div>
        <div class="explain">{{ explain }}</div>
      </div>

      <div class="card bars-card">
        <div class="bars-head">
          <span class="t">{{
            bars ? bars.title : "Wahrscheinlichkeit des nächsten Tokens"
          }}</span>
          <span class="m">{{ bars ? bars.mass : "" }}</span>
        </div>
        <div v-if="!bars" class="placeholder">
          Noch keine Verteilung berechnet.
        </div>
        <div v-else :key="history.length" class="bars">
          <div
            v-for="r in bars.rows"
            :key="r.tok"
            class="row"
            :class="{ hi: r.hi }"
          >
            <div class="row-lbl" :title="r.disp">{{ r.disp }}</div>
            <div class="track">
              <div
                class="fill"
                :class="{ dim: r.dim }"
                :style="{ width: r.pct + '%' }"
              />
            </div>
            <div class="row-val">{{ (r.p * 100).toFixed(1) }}%</div>
          </div>
        </div>
        <div v-if="bars" class="note">{{ barsNote }}</div>
      </div>
    </div>

    <!-- Fußzeile: Compute vs. Abrechnung -->
    <p class="foot">
      <b>Prefill/Decode = Compute</b> (KV-Cache mildert). Die
      <b>Rechnung</b> explodiert erst, wenn jede Tool-Iteration den vollen
      Context erneut als <b>Input</b> schickt → nächste Slide.
      <span class="dim-foot">(KV-Cache-Details: Sektion 5)</span>
    </p>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: v-bind("P.text");
}

/* Sequenz */
.seq {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid v-bind("P.line");
  border-radius: 8px;
  min-height: 40px;
}
.chip {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1.5px solid;
  white-space: pre;
}
.chip.ctx {
  background: v-bind("P.grayBg");
  border-color: v-bind("P.grayBd");
  color: v-bind("P.grayInk");
  font-family: inherit;
  font-size: 11px;
}
.chip.ctx b {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.chip.prompt {
  background: v-bind("P.blueBg");
  border-color: v-bind("P.blueB");
  color: v-bind("P.blueInk");
}
.chip.gen {
  background: v-bind("P.greenBg");
  border-color: v-bind("P.greenB");
  color: v-bind("P.greenInk");
}
.chip.new {
  animation: pop 0.28s ease;
}
.caret {
  width: 2px;
  height: 22px;
  background: v-bind("P.text");
  animation: blink 1s steps(1) infinite;
  border-radius: 2px;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
@keyframes pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Controls */
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid v-bind("P.line");
  border-radius: 8px;
  background: v-bind("P.ctlBg");
}
.seg {
  display: inline-flex;
  border: 1px solid v-bind("P.line");
  border-radius: 7px;
  overflow: hidden;
  background: v-bind("P.segBg");
}
.seg button {
  border: 0;
  background: transparent;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  color: v-bind("P.text");
}
.seg button + button {
  border-left: 1px solid v-bind("P.line");
}
.seg button.on {
  background: v-bind("P.blueB");
  color: #fff;
}
.slider {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: v-bind("P.muted");
}
.slider.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.slider input[type="range"] {
  width: 90px;
}
.slider .val {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  min-width: 30px;
  text-align: right;
  color: v-bind("P.text");
}
.spacer {
  flex: 1 1 auto;
}
.btn {
  border: 0;
  border-radius: 7px;
  padding: 7px 12px;
  font: inherit;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
.btn.primary {
  background: v-bind("P.btnPrimary");
  color: #fff;
}
.btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.ghost {
  background: transparent;
  border: 1px solid v-bind("P.line");
  color: v-bind("P.text");
}

/* Panels */
.panels {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 10px;
}
.card {
  border: 1px solid v-bind("P.line");
  border-radius: 8px;
  padding: 10px 12px;
  background: v-bind("P.cardBg");
}
.phase {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  letter-spacing: 0.03em;
}
.phase.idle {
  background: v-bind("P.grayBg");
  color: v-bind("P.grayInk");
}
.phase.prefill {
  background: v-bind("P.prefillBg");
  color: v-bind("P.prefillInk");
}
.phase.decode {
  background: v-bind("P.blueBg");
  color: v-bind("P.blueInk");
}
.phase.done {
  background: v-bind("P.greenBg");
  color: v-bind("P.greenInk");
}
.lbl {
  font-size: 10px;
  color: v-bind("P.muted");
  margin: 12px 0 2px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.picked {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 22px;
  font-weight: 700;
  color: v-bind("P.amberInk");
}
.picked-p {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  color: v-bind("P.muted");
  font-size: 12px;
}
.explain {
  font-size: 12px;
  color: v-bind("P.muted");
  margin-top: 10px;
  line-height: 1.45;
}

.bars-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  gap: 8px;
}
.bars-head .t {
  font-weight: 600;
  font-size: 12.5px;
  color: v-bind("P.text");
}
.bars-head .m {
  font-size: 11px;
  color: v-bind("P.muted");
  white-space: nowrap;
}
.placeholder {
  color: v-bind("P.muted");
  font-size: 13px;
  text-align: center;
  padding: 30px 10px;
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: grid;
  grid-template-columns: 78px 1fr 46px;
  align-items: center;
  gap: 8px;
}
.row-lbl {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  text-align: right;
  color: v-bind("P.text");
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row.hi .row-lbl {
  color: v-bind("P.amberInk");
  font-weight: 700;
}
.track {
  background: v-bind("P.track");
  border-radius: 4px;
  height: 18px;
  position: relative;
  overflow: hidden;
}
.fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: v-bind("P.bar");
  border-radius: 4px;
  transform-origin: left;
  animation: grow 0.35s ease;
}
.fill.dim {
  opacity: 0.28;
}
.row.hi .fill {
  background: v-bind("P.barHi");
}
@keyframes grow {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
.row-val {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  color: v-bind("P.muted");
  text-align: left;
}
.note {
  font-size: 11.5px;
  color: v-bind("P.muted");
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed v-bind("P.line");
  line-height: 1.4;
}

.foot {
  font-size: 11.5px;
  color: v-bind("P.muted");
  margin: 0;
  line-height: 1.4;
}
.foot b {
  color: v-bind("P.text");
}
.dim-foot {
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
