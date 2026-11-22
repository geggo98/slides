<script setup lang="ts">
/**
 * Interaktive Figur „Das Modell hat zwei Gesprächspartner“: Der User tippt
 * einmal und wartet, die Tools (lokal oder MCP-Server, beide führt das Harness
 * aus) antworten sofort, und jedes Tool-Ergebnis löst den nächsten Request
 * aus — ohne den User. Entwurf: Spec und Prototyp ToolLoop (mock.html).
 *
 * Klicks (`clicks: 2`): 0 Ruhezustand · 1 der Klick ist das „Senden“ des
 * Users und startet den Autoplay der Ereignisse 1–12 · 2 Kostenansicht
 * (Balken in drei Segmente, tools-Marker gerahmt, Fazit).
 * Rückwärts, Einsprung in die Folie und prefers-reduced-motion zeigen den
 * Endzustand sofort. Kein globaler Tastatur-Handler: Pfeiltasten und Leertaste
 * bleiben bei Slidev.
 *
 * Zahlen: die ROWS aus TokenAccumulation.vue, Summe der Balken 53.850. Der
 * schraffierte tools-Marker ist nicht maßstäblich: keine Quelle der Folien
 * trennt das tools-Array vom System-Prompt.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onSlideLeave, useDarkMode, useIsSlideActive } from "@slidev/client";
import { usePrefersReducedMotion } from "@shared/components/brainless/lib/usePrefersReducedMotion";
import { getCatColors } from "./simulationData";
import {
  CALLS,
  EVENTS,
  LAST,
  MAXV,
  ROUNDS,
  dwellOf,
  evIndex,
  fmt,
  highlightJson,
  inputSumAt,
  requestsAt,
  richParts,
  stepTitle,
  t,
  total,
  viewForClicks,
  wireFor,
  type Variant,
} from "./lib/toolLoopLogic";

const props = withDefaults(defineProps<{ clicks?: number }>(), { clicks: 0 });

const { isDark } = useDarkMode();
const reduced = usePrefersReducedMotion();

// ── Farben: Kategorien aus getCatColors, Rest wie TokenAccumulation ───────
const vars = computed(() => {
  const d = isDark.value;
  const c = getCatColors(d);
  return {
    "--slide-bg": d ? "#121212" : "#ffffff",
    "--bg": d ? "#14141c" : "#ffffff",
    "--border": d ? "#2a2a35" : "#e4e4e7",
    "--text": d ? "#e0e0e8" : "#18181b",
    "--sub": d ? "#9090a0" : "#71717a",
    "--hint": d ? "#6a6a80" : "#a1a1aa",
    "--accent": d ? "#a78bfa" : "#7c3aed",
    "--btn-bg": d ? "#2a2a3a" : "#e4e4e7",
    "--btn-border": d ? "#3a3a4a" : "#d4d4d8",
    "--btn-primary": d ? "#6d28d9" : "#7c3aed",
    "--person-f": c.person.fill,
    "--person-s": c.person.stroke,
    "--model-f": c.model.fill,
    "--model-s": c.model.stroke,
    "--tool-f": c.tool.fill,
    // Light: eine Stufe dunkler, die Kanten tragen 9-px-Text auf Weiß.
    "--tool-s": d ? c.tool.stroke : "#16a34a",
    "--harness-f": c.harness.fill,
    "--harness-s": d ? c.harness.stroke : "#ea580c",
    "--track": d ? "#24242e" : "#f1f5f9",
    "--bar-a": d ? "#818cf8" : "#6366f1",
    "--bar-b": d ? "#c084fc" : "#a855f7",
    "--seg-cached": d ? "#166534" : "#86efac",
    "--seg-out": d ? "#c084fc" : "#a855f7",
    "--seg-new": d ? "#818cf8" : "#6366f1",
    "--sum-bg": d ? "#3a2e12" : "#fffbeb",
    "--sum-b": "#f59e0b",
    "--sum-ink": d ? "#fbbf24" : "#92400e",
    "--code-key": d ? "#93c5fd" : "#1d4ed8",
    "--code-str": d ? "#fde047" : "#854d0e",
    "--code-com": d ? "#fb923c" : "#c2410c",
  } as Record<string, string>;
});

// ── Zustand ─────────────────────────────────────────────────────────────
const init = viewForClicks(props.clicks, null, false);
const ev = ref(init.ev);
const cost = ref(init.cost);
const playing = ref(false);
const inspect = ref<number | null>(null);
const variant = ref<Variant>("local");

let timer: ReturnType<typeof setTimeout> | undefined;
function stop() {
  playing.value = false;
  clearTimeout(timer);
  timer = undefined;
}
function tick() {
  if (ev.value >= LAST) {
    stop();
    return;
  }
  timer = setTimeout(() => {
    ev.value++;
    inspect.value = null;
    tick();
  }, dwellOf(ev.value));
}
function play() {
  if (ev.value >= LAST) ev.value = 0;
  cost.value = false;
  inspect.value = null;
  playing.value = true;
  if (ev.value === 0) ev.value = 1;
  tick();
}
function go(d: number) {
  stop();
  inspect.value = null;
  cost.value = false;
  ev.value = Math.max(0, Math.min(LAST, ev.value + d));
}
function reset() {
  stop();
  ev.value = 0;
  cost.value = false;
  inspect.value = null;
}
function pick(i: number) {
  stop();
  inspect.value = inspect.value === i ? null : i;
}

function applyClicks(c: number, prev: number | null) {
  stop();
  inspect.value = null;
  const v = viewForClicks(c, prev, reduced.value);
  cost.value = v.cost;
  ev.value = v.ev;
  if (v.autoplay) play();
}
watch(
  () => props.clicks,
  (c, p) => applyClicks(c, p),
);
// Bewusst `watch` auf useIsSlideActive statt onSlideEnter (siehe
// CodexEffortTui): so läuft beim Betreten nur der Endzustand, nie Autoplay.
const active = useIsSlideActive();
watch(active, (a) => {
  if (a) applyClicks(props.clicks, null);
});
onSlideLeave(stop);
onBeforeUnmount(stop);

// ── Abgeleitete Anzeige ─────────────────────────────────────────────────
const focus = computed(
  () => inspect.value ?? (cost.value ? evIndex("req", 3) : ev.value),
);
const kind = computed(() => EVENTS[ev.value]?.kind ?? "idle");
const wire = computed(() => wireFor(focus.value, variant.value));
const jsonTokens = computed(() =>
  wire.value ? highlightJson(wire.value.json) : [],
);
const calls = computed(() => CALLS[variant.value]);
const nReq = computed(() => requestsAt(ev.value));
const waiting = computed(() => ev.value >= 2 && ev.value < LAST);

const stateUser = computed(() =>
  ev.value === 0
    ? t("state.user.typing")
    : ev.value === LAST
      ? t("state.user.reading")
      : ev.value >= 2
        ? t("state.user.waiting")
        : "",
);
const stateModel = computed(() =>
  kind.value === "req"
    ? t("state.model.reading")
    : kind.value === "use" || kind.value === "final"
      ? t("state.model.generating")
      : "",
);
const stateTools = computed(() =>
  kind.value === "res"
    ? t("state.tools.auto")
    : waiting.value
      ? t("state.tools.idle")
      : "",
);
const liveUser = computed(
  () => !cost.value && (kind.value === "idle" || kind.value === "ask"),
);
const liveModel = computed(
  () => !cost.value && ["req", "use", "final"].includes(kind.value),
);
const liveTools = computed(() => !cost.value && kind.value === "res");

// ── Geometrie der Bühne (alle Maße fest, logische px) ───────────────────
// Spalten 150 / 310 / 372, Abstand 18; Kopfzeile 22, Zeilen 42, Abstand 12.
const rowY = (r: number) => 34 + r * 54;
const COL2 = 168;
const COL2_R = COL2 + 310;
const COL3 = 496;
const RES_X = COL3 + 372 - 156;
const mid = (r: number) => rowY(r) + 21;

const wires = computed(() => {
  const list: { d: string; cat: string; ev: number; auto?: boolean }[] = [
    { d: `M152 ${mid(0)} H165`, cat: "person", ev: evIndex("req", 0) },
    { d: `M${COL2 - 2} ${mid(3)} H153`, cat: "model", ev: evIndex("final", 3) },
  ];
  for (let r = 0; r < 3; r++) {
    list.push({
      d: `M${COL2_R + 2} ${mid(r)} H${COL3 - 3}`,
      cat: "model",
      ev: evIndex("use", r),
    });
    list.push({
      d: `M${COL3 + 190 + 2} ${mid(r)} H${RES_X - 3}`,
      cat: "tool",
      ev: evIndex("res", r),
    });
    // Rückweg des Ergebnisses: unten aus dem Chip, durch die Zeilenlücke
    // nach links, von oben in die nächste Request-Zelle.
    const sx = RES_X + 78;
    const yg = rowY(r) + 48;
    const xin = COL2_R - 26;
    list.push({
      d: `M${sx} ${rowY(r) + 40} V${yg - 5} Q${sx} ${yg} ${sx - 5} ${yg} H${xin + 4} Q${xin} ${yg} ${xin} ${yg + 3} V${rowY(r + 1) + 4}`,
      cat: "harness",
      ev: evIndex("req", r + 1),
      auto: true,
    });
  }
  return list;
});
const pills = [0, 1, 2].map((r) => ({
  top: rowY(r) + 41,
  left: COL3 + 40,
  ev: evIndex("req", r + 1),
}));
// Rahmen um die vier tools-Marker (x 205, Breite 14, Höhe 16 je Zeile).
const frame = {
  left: 201,
  top: rowY(0) + 13 - 6,
  width: 22,
  height: rowY(3) + 13 + 16 - (rowY(0) + 13) + 12,
};
const waitline = {
  top: rowY(0) + 43,
  height: rowY(3) + 2 - (rowY(0) + 40) - 6,
};
// Die Pille bleibt im Endbild stehen und nennt dann, wie lange der User
// gewartet hat (Titel der Folie).
const waitpillTop = (rowY(0) + 40 + rowY(3) + 2) / 2 - 9;

const widthOf = (r: number) =>
  ev.value >= evIndex("req", r) ? `${(total(ROUNDS[r]!) / MAXV) * 100}%` : "0";
const on = (i: number) => ev.value >= i;
const ring = (i: number) => !cost.value && focus.value === i && on(i);

const ariaPlay = computed(() => t(playing.value ? "ctl.pause" : "ctl.play"));
const takeParts = richParts(t("tally.takeaway"));
const endParts = richParts(t("end.note"));
</script>

<template>
  <div class="tl" :class="{ cost }" :style="vars">
    <!-- Steuerung -->
    <div class="bar">
      <button
        class="btn"
        :aria-label="t('ctl.prev')"
        :disabled="ev === 0"
        @click="go(-1)"
      >
        ◀
      </button>
      <button
        class="btn primary"
        :aria-label="ariaPlay"
        @click="playing ? stop() : play()"
      >
        {{ playing ? "⏸" : "▶" }}
      </button>
      <button
        class="btn"
        :aria-label="t('ctl.next')"
        :disabled="ev === LAST"
        @click="go(1)"
      >
        ▶|
      </button>
      <button class="btn" :aria-label="t('ctl.reset')" @click="reset">↻</button>
      <div class="status" aria-live="polite">
        <span v-if="cost" class="legend">
          <span><i class="s-c" />{{ t("legend.cached") }}</span>
          <span><i class="s-o" />{{ t("legend.prevOut") }}</span>
          <span><i class="s-n" />{{ t("legend.fresh") }}</span>
          <span><i class="s-t" />{{ t("legend.tools") }}</span>
        </span>
        <template v-else>
          <span class="n">{{ t("step.count", { i: focus, n: LAST }) }}</span>
          <span class="tt">{{ stepTitle(focus) }}</span>
        </template>
      </div>
      <div class="vseg" role="group" :aria-label="t('variant.group')">
        <button :aria-pressed="variant === 'local'" @click="variant = 'local'">
          {{ t("variant.local") }}
        </button>
        <button :aria-pressed="variant === 'mcp'" @click="variant = 'mcp'">
          {{ t("variant.mcp") }}
        </button>
      </div>
    </div>

    <!-- Bühne -->
    <div class="stage">
      <div class="lane user" :class="{ live: liveUser }">
        <span class="ico">🧑</span><span class="nm">{{ t("lane.user") }}</span>
        <span class="st">{{ stateUser }}</span>
      </div>
      <div class="lane model" :class="{ live: liveModel }">
        <span class="ico">🧠</span><span class="nm">{{ t("lane.model") }}</span>
        <span class="sub">{{ t("lane.model.sub") }}</span>
        <span class="st">{{ stateModel }}</span>
      </div>
      <div class="lane tools" :class="{ live: liveTools }">
        <span class="ico">🛠</span
        ><span class="nm">{{
          t(variant === "mcp" ? "lane.tools.mcp" : "lane.tools.local")
        }}</span>
        <span class="sub">{{ t("lane.tools.sub") }}</span>
        <span class="st">{{ stateTools }}</span>
      </div>

      <!-- User-Spalte -->
      <button
        class="bubble ap pick"
        :class="{ on: true, draft: ev === 0, act: ring(1) }"
        :style="{ gridColumn: 1, gridRow: 2 }"
        :tabindex="on(1) ? 0 : -1"
        @click="pick(1)"
      >
        <span class="who">{{ t("bubble.user.who") }}</span>
        <span class="txt">{{ t("bubble.user.text") }}</span>
      </button>
      <button
        class="bubble answer ap pick"
        :class="{ on: on(LAST), act: ring(LAST) }"
        :style="{ gridColumn: 1, gridRow: 5 }"
        :tabindex="on(LAST) ? 0 : -1"
        @click="pick(LAST)"
      >
        <span class="who">{{ t("bubble.answer.who") }}</span>
        <span class="txt">{{ t("bubble.answer.text") }}</span>
      </button>

      <!-- Modell- und Tool-Spalte, eine Zeile je Request -->
      <template v-for="(R, r) in ROUNDS" :key="r">
        <button
          class="req ap pick"
          :class="{ on: on(evIndex('req', r)), act: ring(evIndex('req', r)) }"
          :style="{ gridColumn: 2, gridRow: r + 2 }"
          :tabindex="on(evIndex('req', r)) ? 0 : -1"
          @click="pick(evIndex('req', r))"
        >
          <span class="rb">R{{ r + 1 }}</span>
          <span class="cap" />
          <span class="track">
            <span class="fill" :style="{ width: widthOf(r) }">
              <i class="s-c" :style="{ flexGrow: R.cached }" />
              <i class="s-o" :style="{ flexGrow: R.fromOut }" />
              <i class="s-n" :style="{ flexGrow: R.fresh }" />
            </span>
          </span>
          <span class="val">{{ fmt(total(R)) }}</span>
        </button>
        <div class="tcell" :style="{ gridColumn: 3, gridRow: r + 2 }">
          <template v-if="r < ROUNDS.length - 1">
            <button
              class="chip call ap pick"
              :class="{
                on: on(evIndex('use', r)),
                act: ring(evIndex('use', r)),
              }"
              :tabindex="on(evIndex('use', r)) ? 0 : -1"
              @click="pick(evIndex('use', r))"
            >
              <span class="tag">tool_use</span>
              <span class="body">{{ calls[r]!.short }}</span>
            </button>
            <button
              class="chip result ap pick"
              :class="{
                on: on(evIndex('res', r)),
                act: ring(evIndex('res', r)),
              }"
              :tabindex="on(evIndex('res', r)) ? 0 : -1"
              @click="pick(evIndex('res', r))"
            >
              <span class="tag">tool_result</span>
              <span class="body"
                >{{ calls[r]!.res }} · ~{{ calls[r]!.tok }} Tok.</span
              >
            </button>
          </template>
          <div v-else class="endnote ap" :class="{ on: on(LAST) }">
            <template v-for="(p, i) in endParts" :key="i"
              ><code v-if="p.tag === 'code'">{{ p.text }}</code
              ><template v-else>{{ p.text }}</template></template
            >
          </div>
        </div>
      </template>

      <!-- Wartelinie, tools-Rahmen, Pills -->
      <div
        class="waitline"
        :class="{ on: on(2) }"
        :style="{
          left: '74px',
          top: waitline.top + 'px',
          height: waitline.height + 'px',
        }"
      />
      <div
        class="waitpill"
        :class="{ on: on(2) }"
        :style="{ top: waitpillTop + 'px' }"
      >
        <span>{{
          waiting ? t("wait.pill") : t("wait.done", { n: ROUNDS.length })
        }}</span>
      </div>
      <div
        class="capframe"
        :style="{
          left: frame.left + 'px',
          top: frame.top + 'px',
          width: frame.width + 'px',
          height: frame.height + 'px',
        }"
      />
      <div
        v-for="(p, i) in pills"
        :key="i"
        class="autopill"
        :class="{ on: on(p.ev) }"
        :style="{ left: p.left + 'px', top: p.top + 'px' }"
      >
        {{ t("auto.pill") }}
      </div>

      <svg class="wires" viewBox="0 0 868 238" aria-hidden="true">
        <defs>
          <marker
            v-for="c in ['person', 'model', 'tool', 'harness']"
            :id="`tl-mh-${c}`"
            :key="c"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            :markerWidth="c === 'harness' ? 5 : 6"
            :markerHeight="c === 'harness' ? 5 : 6"
            orient="auto"
          >
            <path d="M0 0 8 4 0 8z" :style="{ fill: `var(--${c}-s)` }" />
          </marker>
        </defs>
        <path
          v-for="(w, i) in wires"
          :key="i"
          class="wire"
          :class="{ on: on(w.ev), auto: w.auto }"
          :d="w.d"
          pathLength="1"
          :style="{ stroke: `var(--${w.cat}-s)` }"
          :marker-end="`url(#tl-mh-${w.cat})`"
        />
      </svg>
    </div>

    <!-- Unten: Detail-Panel und Zähler -->
    <div class="bottom">
      <div class="panel">
        <template v-if="wire">
          <div class="wirehead">
            <span class="dir">{{ wire.dir }}</span>
            <span class="role">{{ wire.role }}</span>
            <span class="note">{{ wire.note }}</span>
          </div>
          <pre
            class="json"
          ><span v-for="(k, i) in jsonTokens" :key="i" :class="k.cls">{{ k.text }}</span></pre>
        </template>
        <div v-else class="idle">{{ t("wire.idle") }}</div>
      </div>
      <div class="panel tally">
        <div class="counters">
          <div class="ctr" style="--c: var(--person-s)">
            <div class="num">{{ ev >= 1 ? 1 : 0 }}</div>
            <div class="lab">{{ t("tally.userMsgs") }}</div>
          </div>
          <div class="ctr" style="--c: var(--model-s)">
            <div class="num">{{ nReq }}</div>
            <div class="lab">{{ t("tally.requests") }}</div>
          </div>
          <div class="ctr" style="--c: var(--sum-b)">
            <div class="num">{{ fmt(inputSumAt(ev)) }}</div>
            <div class="lab">{{ t("tally.inputSum") }}</div>
          </div>
        </div>
        <div class="take">
          <template v-for="(p, i) in takeParts" :key="i"
            ><b v-if="p.tag === 'b'">{{ p.text }}</b
            ><template v-else>{{ p.text }}</template></template
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl {
  --mono:
    var(--slidev-code-font-family, "0xProto"), ui-monospace, Menlo, monospace;
  width: 868px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--text);
}
.tl * {
  box-sizing: border-box;
}

/* Steuerzeile */
.bar {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn {
  width: 28px;
  height: 24px;
  display: grid;
  place-items: center;
  font: inherit;
  font-size: 12px;
  color: var(--text);
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: 5px;
  cursor: pointer;
  padding: 0;
}
.btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.btn.primary {
  background: var(--btn-primary);
  border-color: var(--btn-primary);
  color: #fff;
}
.btn:focus-visible,
.vseg button:focus-visible,
.pick:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.status {
  flex: 1;
  min-width: 0;
  margin-left: 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
}
.status .n {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  flex: none;
}
.status .tt {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vseg {
  display: flex;
  border: 1px solid var(--btn-border);
  border-radius: 5px;
  overflow: hidden;
  flex: none;
}
.vseg button {
  font: inherit;
  font-size: 10.5px;
  height: 22px;
  padding: 0 9px;
  border: 0;
  background: transparent;
  color: var(--sub);
  cursor: pointer;
}
.vseg button[aria-pressed="true"] {
  background: var(--tool-f);
  color: var(--tool-s);
  font-weight: 600;
}

/* Bühne */
.stage {
  position: relative;
  display: grid;
  grid-template-columns: 150px 310px 372px;
  column-gap: 18px;
  grid-template-rows: 22px repeat(4, 42px);
  row-gap: 12px;
  height: 238px;
}
.lane {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--c-s);
  background: var(--c-f);
  white-space: nowrap;
  overflow: hidden;
  transition: box-shadow 0.25s;
}
.lane.user {
  --c-s: var(--person-s);
  --c-f: var(--person-f);
}
.lane.model {
  --c-s: var(--model-s);
  --c-f: var(--model-f);
}
.lane.tools {
  --c-s: var(--tool-s);
  --c-f: var(--tool-f);
}
.lane .ico {
  font-size: 12px;
  flex: none;
}
.lane .nm {
  font-weight: 700;
  font-size: 11.5px;
  flex: none;
}
.lane .sub {
  color: var(--sub);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lane .st {
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 600;
  color: var(--c-s);
  flex: none;
}
.lane.live {
  box-shadow:
    0 0 0 1px var(--c-s),
    0 0 12px -2px var(--c-s);
}
.status .legend {
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: var(--sub);
}
.status .legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: -1px;
}
.cost .lane.model .st {
  display: none;
}

/* Erscheinen */
.ap {
  opacity: 0;
  transform: translateY(5px);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease,
    box-shadow 0.25s;
  pointer-events: none;
}
.ap.on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.pick {
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
}
.act {
  box-shadow:
    0 0 0 1.5px var(--c-s),
    0 0 14px -2px var(--c-s);
}

/* User-Spalte */
.bubble {
  --c-s: var(--person-s);
  --c-f: var(--person-f);
  align-self: center;
  height: 38px;
  padding: 4px 9px;
  border: 1px solid var(--c-s);
  background: var(--c-f);
  border-radius: 10px 10px 10px 2px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.bubble.answer {
  --c-s: var(--model-s);
  --c-f: var(--model-f);
  border-radius: 10px 10px 2px 10px;
}
.bubble .who {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--c-s);
}
.bubble .txt {
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bubble.draft {
  border-style: dashed;
}
.bubble.draft .txt::after {
  content: "▍";
  color: var(--person-s);
  animation: tl-blink 1s steps(2) infinite;
}
@keyframes tl-blink {
  50% {
    opacity: 0;
  }
}
.waitline {
  position: absolute;
  width: 0;
  border-left: 2px dashed var(--person-s);
  opacity: 0;
  transition: opacity 0.3s;
}
.waitpill {
  position: absolute;
  left: 0;
  width: 150px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s;
}
.waitpill span {
  display: inline-block;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--person-s);
  background: var(--slide-bg);
  border: 1px solid var(--person-s);
  border-radius: 999px;
}
.waitline.on {
  opacity: 0.85;
}
.waitpill.on {
  opacity: 1;
}

/* Modell-Spalte */
.req {
  --c-s: var(--model-s);
  --c-f: var(--model-f);
  display: flex;
  align-items: center;
  gap: 6px;
  height: 42px;
  padding: 0 8px;
  border: 1px solid var(--c-s);
  background: var(--c-f);
  border-radius: 7px;
}
.req .rb {
  flex: none;
  width: 22px;
  height: 18px;
  display: grid;
  place-items: center;
  font-size: 9.5px;
  font-weight: 700;
  border-radius: 4px;
  color: var(--c-s);
  border: 1px solid var(--c-s);
}
.req .cap {
  flex: none;
  width: 14px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--harness-s);
  background: repeating-linear-gradient(
    135deg,
    var(--harness-s) 0 2px,
    transparent 2px 5px
  );
}
.req .track {
  flex: 1;
  height: 16px;
  border-radius: 4px;
  background: var(--track);
  overflow: hidden;
}
.req .fill {
  display: flex;
  height: 100%;
  width: 0;
  border-radius: 4px;
  overflow: hidden;
  background: linear-gradient(90deg, var(--bar-a), var(--bar-b));
  transition: width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.req .fill i {
  height: 100%;
  opacity: 0;
  transition: opacity 0.4s;
}
.cost .req .fill {
  background: none;
  gap: 1px;
}
.cost .req .fill i {
  opacity: 1;
}
.s-c {
  background: var(--seg-cached);
}
.s-o {
  background: var(--seg-out);
}
.s-n {
  background: var(--seg-new);
}
.s-t {
  border: 1px solid var(--harness-s);
  background: repeating-linear-gradient(
    135deg,
    var(--harness-s) 0 1.5px,
    transparent 1.5px 4px
  );
}
.req .val {
  flex: none;
  width: 40px;
  text-align: right;
  font-family: var(--mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.capframe {
  position: absolute;
  border: 1.5px solid var(--harness-s);
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}
.cost .capframe {
  opacity: 1;
  animation: tl-pulse 1.6s ease-in-out 2;
}
@keyframes tl-pulse {
  50% {
    box-shadow: 0 0 12px 0 var(--harness-s);
  }
}

/* Tool-Spalte */
.tcell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
}
.chip {
  --c-s: var(--tool-s);
  --c-f: var(--tool-f);
  /* 36 statt 38: lässt zwischen den Zeilen 18 px für Rücklauflinie und Pille. */
  height: 36px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--c-s);
  background: var(--c-f);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.chip.call {
  width: 190px;
  --c-s: var(--model-s);
  --c-f: var(--model-f);
}
.chip.result {
  width: 156px;
}
.chip .tag {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--c-s);
}
.chip .body {
  font-family: var(--mono);
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.endnote {
  font-size: 10px;
  color: var(--sub);
  font-style: italic;
}
.endnote code {
  font-family: var(--mono);
  font-style: normal;
  font-size: 9.5px;
}

/* Pfeile */
svg.wires {
  position: absolute;
  inset: 0;
  width: 868px;
  height: 238px;
  pointer-events: none;
  overflow: visible;
}
.wire {
  fill: none;
  stroke-width: 1.5;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  transition:
    stroke-dashoffset 0.45s ease,
    opacity 0.1s;
}
.wire.on {
  stroke-dashoffset: 0;
  opacity: 1;
}
.wire.auto {
  stroke-width: 2.2;
}
.autopill {
  position: absolute;
  /* über der Rücklauflinie (svg.wires folgt im DOM), damit sie die Schrift
     nicht durchstreicht */
  z-index: 2;
  padding: 0 7px;
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
  color: var(--harness-s);
  background: var(--slide-bg);
  border: 1px solid var(--harness-s);
  border-radius: 999px;
  white-space: nowrap;
  font-variant-emoji: text;
  opacity: 0;
  transform: scale(0.8);
  transition:
    opacity 0.3s 0.2s,
    transform 0.3s 0.2s;
}
.autopill.on {
  opacity: 1;
  transform: none;
}

/* Unten */
.bottom {
  display: grid;
  grid-template-columns: 1fr 282px;
  gap: 10px;
  height: 106px;
}
.panel {
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 8px;
  padding: 7px 10px;
  min-width: 0;
  overflow: hidden;
}
.wirehead {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 16px;
  white-space: nowrap;
}
.wirehead .dir {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--sub);
}
.wirehead .role {
  font-family: var(--mono);
  font-size: 9.5px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--text);
}
.wirehead .note {
  font-size: 10px;
  color: var(--harness-s);
  overflow: hidden;
  text-overflow: ellipsis;
}
pre.json {
  margin: 5px 0 0;
  padding: 0;
  height: 70px;
  background: none;
  font-family: var(--mono);
  font-size: 9.3px;
  line-height: 11.6px;
  white-space: pre;
  overflow: hidden;
  color: var(--text);
}
pre.json .k {
  color: var(--code-key);
}
pre.json .s {
  color: var(--code-str);
}
pre.json .c {
  color: var(--code-com);
  font-family: Inter, system-ui, sans-serif;
  font-weight: 600;
}
.idle {
  margin-top: 26px;
  text-align: center;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}
.idle::before {
  content: "▶";
  margin-right: 7px;
  font-size: 11px;
  color: var(--accent);
}
.tally {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.counters {
  display: grid;
  grid-template-columns: 0.8fr 0.8fr 1.2fr;
  gap: 6px;
}
.ctr {
  border-left: 2px solid var(--c);
  padding-left: 6px;
}
.ctr .num {
  font-size: 19px;
  line-height: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--c);
}
.ctr .lab {
  font-size: 9.5px;
  color: var(--sub);
  white-space: nowrap;
}
.take {
  margin-top: 1px;
  padding: 4px 7px;
  font-size: 10px;
  line-height: 13px;
  border-radius: 5px;
  border-left: 3px solid var(--sum-b);
  background: var(--sum-bg);
  color: var(--text);
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.4s,
    transform 0.4s;
}
.take b {
  color: var(--sum-ink);
}
.cost .take {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .tl *,
  .tl *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
