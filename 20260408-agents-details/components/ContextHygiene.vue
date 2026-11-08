<script setup lang="ts">
// Folie „Kontext-Hygiene“: Java-Code aus Studie 3 in einem Monaco-Editor, der
// Schritt für Schritt schlechter wird. Nummerierte Marken sitzen an den
// Messstellen; ein Klick blendet den Rest aus und zeigt eine Completion-Box mit
// den Top-5-Tokens. Rechts steht, was Luna, Sol und Terra dort wählen.
// Info-Dialog und Live-Abfrage liegen hinter dem 🛠️-HUD.
//
// Daten: `data/contexthygiene/study3.json` (erzeugt von `build.ts`), erst beim
// Mount per `import()` geladen. Logik und Färbung: `lib/contextHygiene.ts`.
// Texte: `contextHygieneTexts.ts`.
//
// Monaco-Besonderheiten, die hier eine Rolle spielen:
// - Marken sind `injectedText`-Decorations. Den Klick fängt ein DOM-Listener
//   am Editor-Container ab (Klasse `ch-s-<id>`), weil Monacos eigene
//   Maus-Zuordnung unter dem CSS-Transform von Slidev danebenliegen kann.
// - Das Ausblenden ist eine Inline-Decoration mit `color: transparent`: der Text
//   bleibt im Layout, es springt nichts.
// - Kommentare sind View-Zones (kein Java-Text), damit klar ist, dass das
//   Modell sie nie sieht.
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useDarkMode } from "@slidev/client";
import type * as MonacoNs from "monaco-editor";
import MonacoBlock from "@shared/components/MonacoBlock.vue";
import Callout from "@shared/components/Callout.vue";
import {
  BUCKETS,
  DEFAULT_LIVE_MODELS,
  ENDPOINT,
  LADDERS,
  LADDER_NAME,
  MODELS,
  SCENARIO_ORDER,
  buildBody,
  commentProse,
  commentZones,
  measuredComments,
  commentedOffset,
  formatPercent,
  insertComments,
  isHit,
  keyType,
  measure,
  pBucket,
  showToken,
  type Ladder,
  type Level,
  type Site,
  type Study3,
  type TopList,
} from "./lib/contextHygiene";
import { TEXTS } from "./contextHygieneTexts";

// ── Hilfen ───────────────────────────────────────────────────────────────────
const { isDark } = useDarkMode();

/** `code` in Backticks wird zu <code>; sonst Text. */
function segs(s: string): { t: string; code: boolean }[] {
  return s.split("`").map((t, i) => ({ t, code: i % 2 === 1 }));
}
const Rich = defineComponent({
  props: { text: { type: String, required: true } },
  setup(p) {
    return () =>
      segs(p.text).map((x, i) => (x.code ? h("code", { key: i }, x.t) : x.t));
  },
});

const modelName = (m: string): string =>
  (MODELS as readonly string[]).includes(m)
    ? m.charAt(0).toUpperCase() + m.slice(1)
    : m.replace(/^live:/, "");

// ── Daten ────────────────────────────────────────────────────────────────────
const study = shallowRef<Study3 | null>(null);
const loadError = ref("");
onMounted(async () => {
  try {
    const mod = await import("../data/contexthygiene/study3.json");
    study.value = mod.default as unknown as Study3;
  } catch (e) {
    loadError.value = String(e);
  }
});

// ── Auswahl ──────────────────────────────────────────────────────────────────
const scenarioName = ref("ticketing");
const ladder = ref<Ladder>("dose");
const levelIdx = ref(0);
const selectedId = ref<string | null>(null);
const showComments = ref(false);
const boxModel = ref<string>("terra");

const levels = computed(() => LADDERS[ladder.value]);
const levelName = computed(
  () => levels.value[levelIdx.value] ?? levels.value[0]!,
);
const scenario = computed(
  () => study.value?.scenarios[scenarioName.value] ?? null,
);
const level = computed<Level | null>(
  () => scenario.value?.levels[levelName.value] ?? null,
);
const sites = computed<Site[]>(() =>
  level.value ? [...level.value.sites].sort((a, b) => a.pos - b.pos) : [],
);
const selected = computed<Site | null>(
  () => sites.value.find((s) => s.id === selectedId.value) ?? null,
);
const numberOf = (s: Site): number => sites.value.indexOf(s) + 1;
const zones = computed(() =>
  scenario.value ? commentZones(scenario.value, levelName.value) : null,
);
const commentsAvailable = computed(() => zones.value !== null);
/** Live mitsenden darf nur, was die Studie kannte (S0/D0–D4). */
const liveCommentsAvailable = computed(
  () =>
    !!scenario.value &&
    measuredComments(scenario.value, levelName.value) !== null,
);
const dev = computed(() => !!scenario.value?.dev);

const groups = computed(() => {
  const all = study.value
    ? SCENARIO_ORDER.filter((n) => study.value!.scenarios[n])
    : [];
  return {
    held: all.filter((n) => !study.value!.scenarios[n]!.dev),
    dev: all.filter((n) => study.value!.scenarios[n]!.dev),
  };
});

function pickScenario(n: string) {
  scenarioName.value = n;
  keepSelection();
}
function pickLadder(l: Ladder) {
  ladder.value = l;
  levelIdx.value = 0;
  keepSelection();
}
function pickLevel(i: number) {
  levelIdx.value = i;
  keepSelection();
}
function keepSelection() {
  // Dosis-Stufen messen an denselben Positionen (gleiche IDs). Sonst weg.
  nextTick(() => {
    if (
      selectedId.value &&
      !sites.value.some((s) => s.id === selectedId.value)
    ) {
      selectedId.value = null;
    }
  });
}
function select(id: string | null) {
  selectedId.value = id;
  if (id) nextTick(reveal);
}

// ── Messwerte (Studie und live) ──────────────────────────────────────────────
interface Shown {
  top: TopList;
  p1: number | null;
  hit: boolean;
  error?: string;
  usage?: string;
}
const live = reactive<Record<string, Record<string, Shown>>>({});
const liveOrder = ref<string[]>([]);
const allModels = computed<string[]>(() => [...MODELS, ...liveOrder.value]);
const liveKey = (sc: string, lv: string, id: string, withComments: boolean) =>
  `${sc}|${lv}|${id}|${withComments ? "c" : ""}`;

function resultFor(
  model: string,
  site: Site,
  lv = levelName.value,
): Shown | null {
  if ((MODELS as readonly string[]).includes(model)) {
    return site.m[model as (typeof MODELS)[number]];
  }
  return (
    live[model]?.[
      liveKey(scenarioName.value, lv, site.id, liveWithComments.value)
    ] ?? null
  );
}
const colorBucket = (s: Site): number =>
  pBucket(resultFor(boxModel.value, s)?.p1);

const boxRows = computed(() => {
  const s = selected.value;
  const r = s ? resultFor(boxModel.value, s) : null;
  if (!s || !r || r.error) return [];
  return r.top.map(([token, lp]) => ({
    token,
    p: Math.exp(lp),
    hit: isHit(token, s.gold),
  }));
});

/** P(top1) je Stufe für die gewählte Stelle (nur Stufen mit gleicher Stellen-ID). */
const across = computed(() => {
  const s = selected.value;
  const sc = scenario.value;
  if (!s || !sc) return [];
  return levels.value
    .map((lv) => ({
      lv,
      site: sc.levels[lv]?.sites.find((x) => x.id === s.id),
    }))
    .filter((x): x is { lv: string; site: Site } => !!x.site);
});

// ── Palette ──────────────────────────────────────────────────────────────────
const cssVars = computed(() => {
  const d = isDark.value;
  return {
    "--ch-text": d ? "#e0e0e8" : "#1f2937",
    "--ch-muted": d ? "#9ea0b0" : "#5b6472",
    "--ch-line": d ? "#2a2a35" : "#e5e7eb",
    "--ch-panel": d ? "#14141c" : "#ffffff",
    "--ch-panel2": d ? "#1a1a24" : "#f6f8fa",
    "--ch-edge": d ? "#e5e7eb" : "#1f2937",
    "--ch-accent": d ? "#60a5fa" : "#2563eb",
    "--ch-accent-bg": d ? "#1e2a4a" : "#dbeafe",
    "--ch-bar-hit": d ? "#60a5fa" : "#2563eb",
    "--ch-bar-miss": d ? "#6b7280" : "#94a3b8",
    "--ch-box-bg": d ? "#1f2428" : "#f6f8fa",
    "--ch-box-sel": d ? "#0b4a8f" : "#0b60c4",
    "--ch-box-wrong": d ? "#a32030" : "#b0212f",
    "--ch-warn-ink": d ? "#fbbf24" : "#92400e",
    ...Object.fromEntries(
      BUCKETS.flatMap((b, i) => [
        [`--ch-b${i}-bg`, b.bg],
        [`--ch-b${i}-fg`, b.fg],
      ]),
    ),
  } as Record<string, string>;
});

// ── Monaco ───────────────────────────────────────────────────────────────────
const rootEl = ref<HTMLElement | null>(null);
const editorHost = ref<HTMLElement | null>(null);
const hostEl = shallowRef<HTMLElement | null>(null); // Ziel des Teleports (Content-Widget)
let editor: MonacoNs.editor.IStandaloneCodeEditor | null = null;
let monaco: typeof MonacoNs | null = null;
let deco: MonacoNs.editor.IEditorDecorationsCollection | null = null;
let zoneIds: string[] = [];
let widget: MonacoNs.editor.IContentWidget | null = null;
let widgetAdded = false;

const EDITOR_OPTIONS: MonacoNs.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 12,
  lineHeight: 18,
  wordWrap: "on",
  wrappingStrategy: "advanced",
  glyphMargin: false,
  lineDecorationsWidth: 6,
  occurrencesHighlight: "off",
  selectionHighlight: false,
  matchBrackets: "never",
  hover: { enabled: false },
  stickyScroll: { enabled: false },
  scrollbar: { vertical: "auto", horizontal: "hidden" },
};

function onReady(p: {
  editor: MonacoNs.editor.IStandaloneCodeEditor;
  monaco: typeof MonacoNs;
}) {
  editor = p.editor;
  monaco = p.monaco;
  const node = document.createElement("div");
  node.className = "ch-widget-host";
  hostEl.value = node;
  widget = {
    getId: () => "ch.completion",
    getDomNode: () => node,
    getPosition: () => {
      const s = selected.value;
      if (!s || !editor || !monaco) return null;
      const pos = editor.getModel()!.getPositionAt(s.pos);
      return {
        position: pos,
        preference: [
          monaco.editor.ContentWidgetPositionPreference.BELOW,
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
        ],
      };
    },
  };
  sync();
}

/** Textlänge der Kommentare in Zeilenhöhe messen: Breite wie im Editor. */
function measureNote(node: HTMLElement): number {
  const width = editor
    ? Math.max(200, editor.getLayoutInfo().contentWidth - 16)
    : 400;
  node.style.cssText = `position:absolute;visibility:hidden;width:${width}px;`;
  rootEl.value?.appendChild(node);
  const height = node.offsetHeight;
  node.remove();
  node.style.cssText = "";
  return height;
}

function sync() {
  if (!editor || !monaco || !level.value || !scenario.value) return;
  const m = monaco;
  const model = editor.getModel()!;
  if (model.getValue() !== level.value.code) editor.setValue(level.value.code);

  const sel = selected.value;
  const marks: MonacoNs.editor.IModelDeltaDecoration[] = [];
  sites.value.forEach((s, i) => {
    if (sel && s.pos > sel.pos) return;
    const b = colorBucket(s);
    const bucket = BUCKETS[b];
    const pos = model.getPositionAt(s.pos);
    marks.push({
      range: new m.Range(
        pos.lineNumber,
        pos.column,
        pos.lineNumber,
        pos.column,
      ),
      options: {
        showIfCollapsed: true,
        before: {
          content: `${i + 1}${bucket?.sign ?? ""}`,
          inlineClassName: `ch-mark ch-b${b} ch-s-${s.id}${s.id === sel?.id ? " ch-sel" : ""}`,
          inlineClassNameAffectsLetterSpacing: true,
        },
      },
    });
  });
  if (sel) {
    const from = model.getPositionAt(sel.pos);
    const end = model.getFullModelRange().getEndPosition();
    marks.push({
      range: new m.Range(
        from.lineNumber,
        from.column,
        end.lineNumber,
        end.column,
      ),
      options: { inlineClassName: "ch-hidden" },
    });
  }
  if (deco) deco.set(marks);
  else deco = editor.createDecorationsCollection(marks);

  // Kommentare als View-Zones
  const selLine = sel ? model.getPositionAt(sel.pos).lineNumber : Infinity;
  const blocks = showComments.value && zones.value ? zones.value : [];
  editor.changeViewZones((acc) => {
    for (const id of zoneIds) acc.removeZone(id);
    zoneIds = [];
    for (const b of blocks) {
      if (b.beforeLine >= selLine) continue;
      const node = document.createElement("div");
      node.className = "ch-note";
      const badge = document.createElement("span");
      badge.className = "ch-note-badge ch-noai";
      badge.title = TEXTS.commentEmojiLabel;
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", TEXTS.commentEmojiLabel);
      const bot = document.createElement("span");
      bot.textContent = "🤖";
      const ban = document.createElement("span");
      ban.className = "ch-noai-ban";
      ban.textContent = "🚫";
      badge.append(bot, ban);
      const text = document.createElement("div");
      text.textContent = commentProse(b).join(" ");
      node.append(badge, text);
      const heightInPx = measureNote(node) + 6;
      zoneIds.push(
        acc.addZone({
          afterLineNumber: b.beforeLine,
          heightInPx,
          domNode: node,
        }),
      );
    }
  });

  // Completion-Box
  if (widget) {
    if (sel && !widgetAdded) {
      editor.addContentWidget(widget);
      widgetAdded = true;
    } else if (sel) {
      editor.layoutContentWidget(widget);
    } else if (widgetAdded) {
      editor.removeContentWidget(widget);
      widgetAdded = false;
    }
  }
}

function reveal() {
  const s = selected.value;
  if (!editor || !s) return;
  editor.revealLineInCenterIfOutsideViewport(
    editor.getModel()!.getPositionAt(s.pos).lineNumber,
  );
  if (widget && widgetAdded) editor.layoutContentWidget(widget);
}

watch(
  [level, selectedId, showComments, boxModel, () => live, liveOrder],
  () => nextTick(sync),
  { deep: true, flush: "post" },
);
watch(selected, () =>
  nextTick(() => widget && widgetAdded && editor?.layoutContentWidget(widget)),
);
watch(commentsAvailable, (ok) => {
  if (!ok) showComments.value = false;
});

/** Delegierter Mausklick (mousedown, Capture: Monaco fängt den Pointer ab, ein späteres click träfe nicht mehr die Marke): Marke wählt die Stelle, ein Klick daneben schließt die Box. */
function onEditorClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null;
  if (!t) return;
  const mark = t.closest<HTMLElement>(".ch-mark");
  if (mark) {
    const cls = [...mark.classList].find((c) => c.startsWith("ch-s-"));
    if (cls) {
      e.stopPropagation();
      select(cls.slice(5));
    }
    return;
  }
  if (!t.closest(".ch-box") && selectedId.value) select(null);
}

onBeforeUnmount(() => {
  abort?.abort();
  deco?.clear();
  deco = null;
  if (editor && widget && widgetAdded) editor.removeContentWidget(widget);
  editor = null;
  monaco = null;
});

// ── HUD ──────────────────────────────────────────────────────────────────────
const hudOpen = ref(false);
const hudTab = ref<"info" | "live">("info");
const hudBtn = ref<HTMLButtonElement | null>(null);
const hudEl = ref<HTMLElement | null>(null);

function toggleHud() {
  hudOpen.value = !hudOpen.value;
  if (hudOpen.value) nextTick(() => hudEl.value?.focus());
}

function onKeydown(e: KeyboardEvent) {
  if (!rootEl.value || rootEl.value.offsetParent === null) return; // nur wenn sichtbar
  if (e.key !== "Escape") return;
  if (hudOpen.value) {
    hudOpen.value = false;
    hudBtn.value?.focus();
  } else if (selectedId.value) {
    select(null);
  } else {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
}
/** Pfeiltasten in Slider, Auswahlfeldern und Eingaben gehören dem Feld, nicht Slidev. */
function onRootKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) {
    if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation();
  }
}
onMounted(() => document.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown, true));

// ── Live-Abfrage ─────────────────────────────────────────────────────────────
const apiKey = ref("");
const liveModelsText = ref("");
const noReasoning = ref(true);
const flex = ref(false);
const liveWithComments = ref(false);
const liveStatus = ref("");
const liveErrors = ref("");
const running = ref(false);
let abort: AbortController | null = null;

const kType = computed(() => keyType(apiKey.value));
const kLabel = computed(() =>
  kType.value === "openai"
    ? "OpenAI-Key erkannt"
    : kType.value === "openrouter"
      ? "OpenRouter-Key erkannt"
      : kType.value === "unknown"
        ? "Format unbekannt"
        : "kein Key",
);
const canRun = computed(
  () =>
    (kType.value === "openai" || kType.value === "openrouter") &&
    !running.value,
);
watch(kType, (t) => {
  if (t !== "openai" && t !== "openrouter") return;
  const cur = liveModelsText.value.trim();
  if (!cur || Object.values(DEFAULT_LIVE_MODELS).includes(cur as never)) {
    liveModelsText.value = DEFAULT_LIVE_MODELS[t];
  }
});
watch(liveCommentsAvailable, (ok) => {
  if (!ok) liveWithComments.value = false;
});

interface LiveJson {
  error?: { message?: string };
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  choices?: {
    logprobs?: {
      content?: { top_logprobs?: { token: string; logprob: number }[] }[];
    };
  }[];
}
interface Job {
  sc: string;
  lv: string;
  site: Site;
  prefix: string;
  model: string;
}
function prefixFor(sc: string, lv: string, site: Site): string {
  const level = study.value!.scenarios[sc]!.levels[lv]!;
  const cm = study.value!.scenarios[sc]!.comments;
  if (
    liveWithComments.value &&
    measuredComments(study.value!.scenarios[sc]!, lv)
  ) {
    const text = insertComments(level.code, cm);
    return text.slice(0, commentedOffset(level.code, cm, site.pos));
  }
  return level.code.slice(0, site.pos);
}

async function queryOne(
  type: "openai" | "openrouter",
  model: string,
  job: Job,
  signal: AbortSignal,
): Promise<Shown & { fatal?: boolean; retry?: boolean }> {
  const st = study.value!;
  const res = await fetch(`${ENDPOINT[type]}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.value.trim()}`,
    },
    body: JSON.stringify(
      buildBody(type, model, st.system, job.prefix, {
        noReasoning: noReasoning.value,
        flex: flex.value,
      }),
    ),
  });
  const text = await res.text();
  let json: LiveJson | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const empty: TopList = [];
  if (!res.ok || !json || json.error) {
    const msg = json?.error
      ? (json.error.message ?? JSON.stringify(json.error))
      : text.slice(0, 300);
    return {
      top: empty,
      p1: null,
      hit: false,
      error: `HTTP ${res.status}: ${msg}`,
      fatal: [400, 401, 403, 404].includes(res.status),
      retry: res.status === 429 || res.status >= 500,
    };
  }
  const lp = json.choices?.[0]?.logprobs?.content?.[0];
  const u = json.usage ?? {};
  const usage = `Modell laut Antwort: ${json.model ?? "?"} · Tokens ein/aus ${u.prompt_tokens ?? "?"}/${u.completion_tokens ?? "?"}`;
  if (!lp?.top_logprobs?.length) {
    return {
      top: empty,
      p1: null,
      hit: false,
      error: `keine Logprobs in der Antwort. ${usage}`,
    };
  }
  const top: TopList = lp.top_logprobs
    .filter((t) => t.logprob > -9000)
    .map((t): [string, number] => [t.token, Math.min(t.logprob, 0)]);
  const r = measure(top, job.site.gold, st.p_max);
  return { top, p1: r.p1, hit: r.hit, usage };
}

async function runLive(scope: "site" | "level") {
  const kind = kType.value;
  if ((kind !== "openai" && kind !== "openrouter") || !study.value) return;
  const type: "openai" | "openrouter" = kind;
  const names = liveModelsText.value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!names.length) return;
  const targets =
    scope === "site" ? (selected.value ? [selected.value] : []) : sites.value;
  const jobs: Job[] = targets.flatMap((site) =>
    names.map((model) => ({
      sc: scenarioName.value,
      lv: levelName.value,
      site,
      prefix: prefixFor(scenarioName.value, levelName.value, site),
      model,
    })),
  );
  if (!jobs.length) return;
  for (const n of names) {
    const k = `live:${n}`;
    if (!liveOrder.value.includes(k)) liveOrder.value.push(k);
    live[k] ??= {};
  }
  abort = new AbortController();
  running.value = true;
  liveErrors.value = "";
  let done = 0;
  let failed = 0;
  const dead = new Set<string>();
  const t0 = performance.now();
  const status = () => {
    liveStatus.value = `${done + failed}/${jobs.length} · ${failed} Fehler · ${((performance.now() - t0) / 1000).toFixed(0)} s`;
  };
  status();
  const queue = jobs.slice();
  const withC = liveWithComments.value;
  async function worker() {
    while (queue.length && !abort!.signal.aborted) {
      const job = queue.shift()!;
      const k = `live:${job.model}`;
      const slot = live[k]!;
      const key = liveKey(job.sc, job.lv, job.site.id, withC);
      if (dead.has(k)) {
        slot[key] = {
          top: [],
          p1: null,
          hit: false,
          error: "übersprungen: früherer Fehler wiederholt sich",
        };
        failed++;
        continue;
      }
      let r: Awaited<ReturnType<typeof queryOne>> | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          r = await queryOne(type, job.model, job, abort!.signal);
        } catch (e) {
          const aborted = (e as Error).name === "AbortError";
          r = {
            top: [],
            p1: null,
            hit: false,
            error: aborted ? "abgebrochen" : String(e),
            retry: !aborted,
          };
        }
        if (!r.retry) break;
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
      slot[key] = {
        top: r!.top,
        p1: r!.p1,
        hit: r!.hit,
        error: r!.error,
        usage: r!.usage,
      };
      if (r!.error) {
        failed++;
        liveErrors.value += `${job.model} ${job.site.id}: ${r!.error}\n`;
        if (r!.fatal) dead.add(k);
      } else {
        done++;
      }
      status();
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  const stopped = abort.signal.aborted;
  abort = null;
  running.value = false;
  liveStatus.value += stopped ? " · gestoppt" : " · fertig";
}
function stopLive() {
  abort?.abort();
}
function clearLive() {
  for (const k of liveOrder.value) delete live[k];
  liveOrder.value = [];
  liveStatus.value = "";
  liveErrors.value = "";
  if (!(MODELS as readonly string[]).includes(boxModel.value))
    boxModel.value = "terra";
}

// ── Anzeige ──────────────────────────────────────────────────────────────────
const note = computed(() =>
  levelName.value === "D0" || levelName.value === "S0"
    ? TEXTS.controlNote
    : TEXTS.degradedNote,
);
const announce = computed(() => {
  const s = selected.value;
  if (!s) return "";
  const r = resultFor(boxModel.value, s);
  const top = r?.top[0];
  return top && r?.p1 != null
    ? `Stelle ${numberOf(s)}: ${modelName(boxModel.value)} wählt ${top[0].trim() || "Leerraum"} mit P(top1) ${formatPercent(r.p1)}. Soll: ${s.gold}.`
    : `Stelle ${numberOf(s)}: nicht gemessen.`;
});
const pct = (p: number | null | undefined): string =>
  p == null ? "–" : formatPercent(p);
</script>

<template>
  <div ref="rootEl" class="ch-root" :style="cssVars" @keydown="onRootKey">
    <p v-if="loadError" class="ch-err">{{ loadError }}</p>
    <p v-else-if="!study" class="ch-muted">Lade Daten …</p>

    <template v-else>
      <!-- Werkzeugleiste -->
      <div class="ch-bar">
        <label class="ch-field">
          <span>Fachgebiet</span>
          <select
            :value="scenarioName"
            @change="pickScenario(($event.target as HTMLSelectElement).value)"
          >
            <optgroup label="Zurückgehalten (belastbar)">
              <option v-for="n in groups.held" :key="n" :value="n">
                {{ n }}
              </option>
            </optgroup>
            <optgroup label="⚠ Entwicklung (Luna eingestellt)">
              <option v-for="n in groups.dev" :key="n" :value="n">
                ⚠ {{ n }}
              </option>
            </optgroup>
          </select>
        </label>

        <div class="ch-seg" role="group" aria-label="Leiter">
          <button
            v-for="l in ['dose', 'steps'] as Ladder[]"
            :key="l"
            type="button"
            :class="{ on: ladder === l }"
            :aria-pressed="ladder === l"
            @click="pickLadder(l)"
          >
            {{ LADDER_NAME[l] }}
          </button>
        </div>

        <div class="ch-slider">
          <input
            type="range"
            min="0"
            :max="levels.length - 1"
            step="1"
            :value="levelIdx"
            :aria-label="`Stufe: ${levelName}`"
            :aria-valuetext="`${levelName}: ${TEXTS.levelInfo[levelName] ?? ''}`"
            :style="{
              margin: `0 calc(50% / ${levels.length})`,
              width: `calc(100% - 100% / ${levels.length})`,
            }"
            @input="pickLevel(+($event.target as HTMLInputElement).value)"
          />
          <div
            class="ch-ticks"
            :style="{ gridTemplateColumns: `repeat(${levels.length}, 1fr)` }"
          >
            <button
              v-for="(lv, i) in levels"
              :key="lv"
              type="button"
              :class="{ on: i === levelIdx }"
              :aria-label="`Stufe ${lv}`"
              @click="pickLevel(i)"
            >
              {{ lv }}
            </button>
          </div>
        </div>

        <label class="ch-toggle" :class="{ off: !commentsAvailable }">
          <input
            v-model="showComments"
            type="checkbox"
            :disabled="!commentsAvailable"
          />
          💬 {{ TEXTS.commentsToggle }}
        </label>

        <button
          ref="hudBtn"
          type="button"
          class="ch-hud-btn"
          :aria-expanded="hudOpen"
          aria-controls="ch-hud"
          title="Info und Live-Abfrage"
          aria-label="Info und Live-Abfrage"
          @click="toggleHud"
        >
          🛠️
        </button>
      </div>

      <!-- Stufentext und Warnung -->
      <div class="ch-infoline">
        <p class="ch-level">
          <b>{{ levelName }}</b>
          <Rich :text="TEXTS.levelInfo[levelName] ?? ''" />
          <span class="ch-muted"> {{ note }}</span>
        </p>
        <Callout v-if="dev" tone="warning" dense class="ch-warn">
          <b>⚠ {{ TEXTS.devWarningTitle }}.</b> {{ TEXTS.devWarningBody }}
        </Callout>
      </div>

      <!-- HUD -->
      <div
        v-if="hudOpen"
        id="ch-hud"
        ref="hudEl"
        class="ch-hud"
        role="dialog"
        aria-label="Info und Live-Abfrage"
        tabindex="-1"
      >
        <div class="ch-hud-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="hudTab === 'info'"
            :class="{ on: hudTab === 'info' }"
            @click="hudTab = 'info'"
          >
            (i) Info
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="hudTab === 'live'"
            :class="{ on: hudTab === 'live' }"
            @click="hudTab = 'live'"
          >
            {{ TEXTS.live.title }}
          </button>
          <button
            type="button"
            class="ch-x"
            aria-label="Schließen"
            @click="toggleHud"
          >
            ✕
          </button>
        </div>

        <div v-if="hudTab === 'info'" class="ch-hud-body">
          <h4>{{ TEXTS.info.title }}</h4>
          <p><Rich :text="TEXTS.info.question" /></p>
          <ol class="ch-flow">
            <li v-for="(f, i) in TEXTS.info.flow" :key="i">{{ f }}</li>
          </ol>
          <p><Rich :text="TEXTS.info.flowNote" /></p>
          <h5>Zeichen</h5>
          <p>
            <span class="ch-noai" role="img" aria-hidden="true"
              ><span>🤖</span><span class="ch-noai-ban">🚫</span></span
            >
            <Rich :text="TEXTS.info.commentEmojiInfo" />
          </p>
          <p><Rich :text="TEXTS.info.missInfo" /></p>
          <h5>Zwei Leitern</h5>
          <p>
            <b>{{ LADDER_NAME.dose }}.</b>
            <Rich :text="TEXTS.info.ladders.dose" />
          </p>
          <p>
            <b>{{ LADDER_NAME.steps }}.</b>
            <Rich :text="TEXTS.info.ladders.steps" />
          </p>
          <h5>Zurückgehalten und Entwicklung</h5>
          <p><Rich :text="TEXTS.info.sets.heldout" /></p>
          <p><Rich :text="TEXTS.info.sets.dev" /></p>
          <h5>Ergebnis</h5>
          <p><Rich :text="TEXTS.info.result" /></p>
          <h5>Grenzen</h5>
          <ul>
            <li v-for="(l, i) in TEXTS.info.limits" :key="i">
              <Rich :text="l" />
            </li>
          </ul>
          <p class="ch-muted"><Rich :text="TEXTS.info.source" /></p>
        </div>

        <div v-else class="ch-hud-body">
          <h4>{{ TEXTS.live.title }}</h4>
          <label class="ch-field col">
            <span
              >API-Key <em class="ch-pill">{{ kLabel }}</em></span
            >
            <input
              v-model="apiKey"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="sk-… oder sk-or-…"
            />
          </label>
          <p class="ch-muted"><Rich :text="TEXTS.live.keyNote" /></p>
          <label class="ch-field col">
            <span>Modelle (Komma)</span>
            <input v-model="liveModelsText" type="text" spellcheck="false" />
          </label>
          <div class="ch-checks">
            <label
              ><input v-model="noReasoning" type="checkbox" /> Reasoning
              aus</label
            >
            <label
              ><input
                v-model="flex"
                type="checkbox"
                :disabled="kType !== 'openai'"
              />
              Flex-Tier (nur OpenAI)</label
            >
            <label :class="{ off: !liveCommentsAvailable }">
              <input
                v-model="liveWithComments"
                type="checkbox"
                :disabled="!liveCommentsAvailable"
              />
              {{ TEXTS.live.withComments }}
            </label>
          </div>
          <div class="ch-actions">
            <button
              type="button"
              class="primary"
              :disabled="!canRun || !selected"
              @click="runLive('site')"
            >
              Diese Stelle
            </button>
            <button type="button" :disabled="!canRun" @click="runLive('level')">
              Alle Stellen dieser Stufe
            </button>
            <button type="button" :disabled="!running" @click="stopLive">
              Stopp
            </button>
            <button
              type="button"
              :disabled="!liveOrder.length"
              @click="clearLive"
            >
              Verwerfen
            </button>
          </div>
          <p class="ch-muted">{{ TEXTS.live.cost }}</p>
          <p v-if="liveStatus" role="status">{{ liveStatus }}</p>
          <pre v-if="liveErrors" class="ch-err">{{ liveErrors }}</pre>
        </div>
      </div>

      <!-- Editor und Infospalte -->
      <div class="ch-main">
        <div
          ref="editorHost"
          class="ch-editor"
          @mousedown.capture="onEditorClick"
        >
          <MonacoBlock
            :code="level?.code ?? ''"
            language="java"
            height="318px"
            :editor-options="EDITOR_OPTIONS"
            @ready="onReady"
          />
        </div>

        <aside class="ch-side" aria-label="Messwerte">
          <p class="ch-sr" role="status" aria-live="polite">{{ announce }}</p>

          <template v-if="selected">
            <div class="ch-side-head">
              <h4>
                Stelle {{ numberOf(selected) }}
                <span class="ch-pill">{{ selected.cls }}</span>
              </h4>
              <button
                type="button"
                class="ch-x"
                aria-label="Stelle abwählen"
                @click="select(null)"
              >
                ✕
              </button>
            </div>
            <p class="ch-gold">
              Soll: <code>{{ showToken(selected.gold) }}</code>
            </p>

            <div
              v-for="m in allModels"
              :key="m"
              class="ch-model"
              :class="{ cur: m === boxModel }"
            >
              <button
                type="button"
                class="ch-model-head"
                :aria-pressed="m === boxModel"
                @click="boxModel = m"
              >
                <b>{{ modelName(m) }}</b>
                <template v-if="resultFor(m, selected)">
                  <template v-if="resultFor(m, selected)!.error">
                    <span class="ch-err">Fehler</span>
                  </template>
                  <template v-else>
                    <span
                      >P(top1)
                      <b>{{ pct(resultFor(m, selected)!.p1) }}</b></span
                    >
                    <span
                      :class="
                        resultFor(m, selected)!.hit ? 'ch-hit' : 'ch-miss'
                      "
                    >
                      {{
                        resultFor(m, selected)!.hit ? "✓ trifft" : "✗ verfehlt"
                      }}
                    </span>
                  </template>
                </template>
                <span v-else class="ch-muted">nicht abgefragt</span>
              </button>
              <div
                v-for="(t, i) in resultFor(m, selected)?.top ?? []"
                :key="i"
                class="ch-brow"
              >
                <span
                  class="ch-btok"
                  :class="{ 'ch-hit': isHit(t[0], selected.gold) }"
                >
                  {{ showToken(t[0])
                  }}<template v-if="isHit(t[0], selected.gold)"> ✓</template>
                </span>
                <span class="ch-track">
                  <i
                    :class="isHit(t[0], selected.gold) ? 'hit' : 'miss'"
                    :style="{ width: Math.exp(t[1]) * 100 + '%' }"
                  />
                </span>
                <span class="ch-bnum">{{ pct(Math.exp(t[1])) }}</span>
              </div>
            </div>

            <div v-if="across.length > 1" class="ch-across">
              <b>Diese Position über die Leiter</b>
              <table>
                <thead>
                  <tr>
                    <th />
                    <th v-for="a in across" :key="a.lv">{{ a.lv }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in MODELS" :key="m">
                    <th>{{ modelName(m) }}</th>
                    <td v-for="a in across" :key="a.lv">
                      <span
                        class="ch-cell"
                        :class="`ch-b${pBucket(a.site.m[m].p1)}`"
                      >
                        {{
                          a.site.m[m].p1 == null
                            ? "–"
                            : a.site.m[m].p1!.toFixed(2).replace(".", ",")
                        }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="ch-muted">{{ TEXTS.probHint }}</p>
          </template>

          <template v-else>
            <p class="ch-muted">{{ TEXTS.pickHint }}</p>
            <p class="ch-summary">{{ scenario?.summary }}</p>
            <ul class="ch-sites">
              <li v-for="s in sites" :key="s.id">
                <button type="button" @click="select(s.id)">
                  <span class="ch-mark-static" :class="`ch-b${colorBucket(s)}`">
                    {{ numberOf(s) }}{{ BUCKETS[colorBucket(s)]?.sign ?? "" }}
                  </span>
                  <code>{{ showToken(s.gold) }}</code>
                  <span class="ch-muted">{{
                    s.cls === "syntax" ? "Kontrolle" : (s.stratum ?? s.cls)
                  }}</span>
                  <span class="ch-spct">{{
                    pct(resultFor(boxModel, s)?.p1)
                  }}</span>
                </button>
              </li>
            </ul>
          </template>

          <div class="ch-legend">
            <b>{{ TEXTS.legendTitle }} ({{ modelName(boxModel) }})</b>
            <div class="ch-chips">
              <span
                v-for="(b, i) in BUCKETS"
                :key="i"
                class="ch-mark-static"
                :class="`ch-b${i}`"
              >
                {{ i + 1 }}{{ b.sign }}
              </span>
            </div>
            <div class="ch-chips-l">
              <span v-for="b in BUCKETS" :key="b.label">{{ b.label }}</span>
            </div>
            <p class="ch-muted">{{ TEXTS.legendNote }}</p>
          </div>
        </aside>
      </div>

      <p class="ch-takeaway">{{ TEXTS.takeaway }}</p>
    </template>

    <!-- Completion-Box: wird in das Monaco-Content-Widget teleportiert -->
    <Teleport v-if="hostEl && selected" :to="hostEl">
      <div
        class="ch-box"
        :style="cssVars"
        role="group"
        :aria-label="`Completion an Stelle ${numberOf(selected)}`"
      >
        <div class="ch-box-head">
          <button
            v-for="m in allModels"
            :key="m"
            type="button"
            :class="{ on: m === boxModel }"
            :aria-pressed="m === boxModel"
            @mousedown.stop
            @click.stop="boxModel = m"
          >
            {{ modelName(m) }}
          </button>
          <button
            type="button"
            class="ch-x"
            aria-label="Box schließen"
            @mousedown.stop
            @click.stop="select(null)"
          >
            ✕
          </button>
        </div>
        <template v-if="boxRows.length">
          <div
            v-for="(r, i) in boxRows"
            :key="i"
            class="ch-row"
            :class="{ first: i === 0, hit: r.hit, wrong: i === 0 && !r.hit }"
          >
            <i class="ch-fill" :style="{ width: r.p * 100 + '%' }" />
            <span class="ch-ic" aria-hidden="true">abc</span>
            <span class="ch-tok">{{ showToken(r.token) }}</span>
            <span class="ch-ok">{{ r.hit ? "✓" : i === 0 ? "✗" : "" }}</span>
            <span class="ch-pct">{{ pct(r.p) }}</span>
          </div>
        </template>
        <div v-else class="ch-row ch-muted">
          {{
            resultFor(boxModel, selected)?.error ??
            "Für dieses Modell nicht abgefragt."
          }}
        </div>
        <div class="ch-box-foot">
          Soll: <code>{{ showToken(selected.gold) }}</code> · ✓ = trifft das
          Soll · ✗ = bester Vorschlag falsch
        </div>
      </div>
    </Teleport>
  </div>
</template>

<!-- Unscoped: Monaco hängt Klassen an eigene Elemente (Decorations, Widgets,
     View-Zones), und die Completion-Box wird in ein Monaco-Element teleportiert.
     Alle Selektoren tragen deshalb das Präfix `ch-`. Farben kommen aus den
     `--ch-*`-Variablen der Wurzel (hell/dunkel). -->
<style>
.ch-root {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ch-text);
  font-size: 12px;
  line-height: 1.35;
}
.ch-root code {
  font-family: var(--slidev-code-font-family, "0xProto", monospace);
  font-size: 0.95em;
  background: transparent;
  padding: 0;
  color: inherit;
}
.ch-muted {
  color: var(--ch-muted);
}
.ch-err {
  color: var(--ch-warn-ink);
  white-space: pre-wrap;
}
.ch-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.ch-root.ch-root p,
.ch-root.ch-root li {
  margin: 0;
  line-height: 1.35;
}
.ch-level b {
  margin-right: 6px;
}
.ch-level .ch-muted {
  margin-left: 4px;
}

/* Werkzeugleiste */
.ch-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: nowrap;
}
.ch-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--ch-muted);
  font-size: 10px;
}
.ch-field.col {
  margin: 4px 0;
}
.ch-root select,
.ch-root input[type="text"],
.ch-root input[type="password"],
.ch-root button {
  font: inherit;
  color: var(--ch-text);
  background: var(--ch-panel);
  border: 1px solid var(--ch-line);
  border-radius: 6px;
  padding: 3px 7px;
}
.ch-root button {
  cursor: pointer;
}
.ch-root button:focus-visible,
.ch-root select:focus-visible,
.ch-root input:focus-visible {
  outline: 2px solid var(--ch-accent);
  outline-offset: 1px;
}
.ch-root button:disabled {
  opacity: 0.5;
  cursor: default;
}
.ch-root button.primary {
  background: var(--ch-accent-bg);
  border-color: var(--ch-accent);
}
.ch-seg {
  display: inline-flex;
}
.ch-seg button {
  border-radius: 0;
  white-space: nowrap;
}
.ch-seg button:first-child {
  border-radius: 6px 0 0 6px;
}
.ch-seg button:last-child {
  border-radius: 0 6px 6px 0;
  border-left: 0;
}
.ch-seg button.on {
  background: var(--ch-accent-bg);
  border-color: var(--ch-accent);
  font-weight: 700;
}
.ch-slider {
  flex: 1 1 160px;
  min-width: 150px;
}
.ch-slider input[type="range"] {
  display: block;
  height: 14px;
  accent-color: var(--ch-accent);
}
.ch-ticks {
  display: grid;
}
.ch-ticks button {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 10px;
  color: var(--ch-muted);
}
.ch-ticks button.on {
  color: var(--ch-text);
  font-weight: 700;
}
.ch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  padding-bottom: 3px;
}
.ch-toggle.off,
.ch-checks label.off {
  opacity: 0.55;
}
.ch-hud-btn {
  margin-bottom: 1px;
}

/* Stufentext */
.ch-infoline {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 46px;
}
.ch-level {
  flex: 1 1 auto;
}
.ch-warn.ch-warn {
  flex: 0 0 390px;
  margin: 0;
  font-size: 11px;
  line-height: 1.3;
}
.ch-warn.ch-warn * {
  font-size: 11px;
  line-height: 1.3;
}

/* HUD */
.ch-hud {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 40;
  width: 430px;
  max-height: 360px;
  overflow: auto;
  background: var(--ch-panel);
  border: 1px solid var(--ch-edge);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.3);
}
.ch-hud:focus {
  outline: none;
}
.ch-hud-tabs {
  position: sticky;
  top: 0;
  display: flex;
  gap: 4px;
  padding: 6px;
  background: var(--ch-panel);
  border-bottom: 1px solid var(--ch-line);
}
.ch-hud-tabs .on {
  background: var(--ch-accent-bg);
  border-color: var(--ch-accent);
}
.ch-x {
  margin-left: auto;
}
.ch-hud-body {
  padding: 8px 12px 12px;
}
.ch-hud-body h4,
.ch-hud-body h5 {
  font-weight: 700;
  margin: 8px 0 3px;
  font-size: 12px;
}
.ch-hud-body p,
.ch-hud-body li {
  margin: 3px 0;
}
.ch-hud-body ul {
  padding-left: 16px;
  margin: 3px 0;
}
.ch-flow.ch-flow {
  display: flex;
  gap: 4px;
  list-style: none;
  padding: 0;
  margin: 6px 0;
}
.ch-flow li {
  list-style: none;
}
.ch-flow li {
  flex: 1;
  border: 1px solid var(--ch-line);
  border-radius: 6px;
  padding: 4px 6px;
  background: var(--ch-panel2);
  font-size: 11px;
}
.ch-checks {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 6px 0;
}
.ch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
}
.ch-pill {
  font-style: normal;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--ch-panel2);
  border: 1px solid var(--ch-line);
  color: var(--ch-muted);
}

/* Editor und Spalte */
.ch-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 10px;
  align-items: start;
}
.ch-editor .monaco-block {
  margin: 0;
}
.ch-side {
  max-height: 318px;
  overflow: auto;
  border: 1px solid var(--ch-line);
  border-radius: 8px;
  padding: 8px;
  background: var(--ch-panel);
}
.ch-side h4 {
  margin: 0;
  font-size: 13px;
}
.ch-side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ch-gold {
  margin: 2px 0 6px;
}
.ch-summary {
  margin: 6px 0;
  color: var(--ch-muted);
  font-size: 11px;
}
.ch-model {
  border-top: 1px solid var(--ch-line);
  padding: 4px 0;
}
.ch-model.cur {
  background: var(--ch-panel2);
}
.ch-model-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 2px 0;
  text-align: left;
}
.ch-hit {
  color: var(--ch-accent);
  font-weight: 700;
}
.ch-miss {
  color: var(--ch-muted);
}
.ch-brow {
  display: grid;
  grid-template-columns: 78px 1fr 56px;
  gap: 6px;
  align-items: center;
  margin: 1px 0;
}
.ch-btok {
  font-family: var(--slidev-code-font-family, "0xProto", monospace);
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-track {
  height: 9px;
  background: var(--ch-line);
  border-radius: 3px;
  overflow: hidden;
}
.ch-track i {
  display: block;
  height: 100%;
}
.ch-track i.hit {
  background: var(--ch-bar-hit);
}
.ch-track i.miss {
  background: var(--ch-bar-miss);
}
.ch-bnum {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ch-across table {
  border-collapse: collapse;
  width: 100%;
  margin-top: 3px;
}
.ch-across th,
.ch-across td {
  padding: 1px 2px;
  text-align: center;
  font-size: 10px;
  font-weight: 400;
  border: 0;
}
.ch-across tbody th {
  text-align: left;
}
.ch-cell {
  display: inline-block;
  min-width: 34px;
  border-radius: 4px;
  padding: 0 3px;
}
.ch-sites {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ch-sites button {
  display: grid;
  grid-template-columns: 34px 1fr auto 46px;
  gap: 6px;
  align-items: center;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--ch-line);
  border-radius: 0;
  background: transparent;
  text-align: left;
}
.ch-spct {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ch-legend {
  margin-top: 8px;
  border-top: 1px solid var(--ch-line);
  padding-top: 6px;
}
.ch-chips,
.ch-chips-l {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 3px;
}
.ch-chips-l {
  font-size: 10px;
  color: var(--ch-muted);
}
.ch-takeaway {
  font-weight: 600;
}

/* Marken: Farbe, gestrichelter Rand und Zeichen tragen dieselbe Stufe */
.ch-mark,
.ch-mark-static,
.ch-cell {
  font:
    600 10px/14px system-ui,
    sans-serif;
  border-radius: 8px;
  padding: 0 5px;
  margin: 0 2px;
  border: 1.5px solid transparent;
  box-shadow: 0 0 0 1px var(--ch-edge);
  white-space: nowrap;
}
.ch-mark {
  cursor: pointer;
}
.ch-mark.ch-sel {
  outline: 2px solid var(--ch-edge);
  outline-offset: 2px;
}
.ch-mark-static {
  display: inline-block;
  text-align: center;
  margin: 0;
}
.ch-cell {
  margin: 0;
  box-shadow: none;
}
.ch-b0 {
  background: var(--ch-b0-bg);
  color: var(--ch-b0-fg);
  border-style: dashed;
  border-color: currentColor;
}
.ch-b1 {
  background: var(--ch-b1-bg);
  color: var(--ch-b1-fg);
  border-style: dashed;
  border-color: currentColor;
}
.ch-b2 {
  background: var(--ch-b2-bg);
  color: var(--ch-b2-fg);
}
.ch-b3 {
  background: var(--ch-b3-bg);
  color: var(--ch-b3-fg);
}
.ch-b-1 {
  background: var(--ch-line);
  color: var(--ch-muted);
}
.ch-hidden {
  color: transparent !important;
}
.ch-hidden * {
  color: transparent !important;
}

/* Kommentar-Zone */
.ch-note {
  box-sizing: border-box;
  margin: 2px 8px;
  padding: 3px 8px;
  border: 1.5px dashed var(--ch-muted);
  border-radius: 6px;
  background: var(--ch-panel2);
  color: var(--ch-text);
  font:
    11px/1.35 system-ui,
    sans-serif;
}
.ch-note-badge {
  display: inline-block;
  margin-right: 6px;
  font-weight: 700;
  color: var(--ch-muted);
}
/* Eigenes Emoji: 🤖 mit 🚫 darüber */
.ch-noai {
  position: relative;
  display: inline-block;
  width: 1.5em;
  text-align: center;
  line-height: 1;
}
.ch-noai-ban {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(1.3);
  opacity: 0.55;
}
.ch-note > div {
  display: inline;
}

/* Completion-Box (wie das Suggest-Widget) */
.ch-widget-host {
  z-index: 50;
}
.ch-box {
  width: 330px;
  margin-top: 2px;
  background: var(--ch-box-bg);
  color: var(--ch-text);
  border: 1px solid var(--ch-edge);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.35);
  font:
    14px/1.3 system-ui,
    sans-serif;
  overflow: hidden;
}
.ch-box-head {
  display: flex;
  gap: 3px;
  padding: 4px;
  border-bottom: 1px solid var(--ch-line);
}
.ch-box-head button {
  font:
    11px/1.2 system-ui,
    sans-serif;
  color: var(--ch-text);
  background: transparent;
  border: 1px solid var(--ch-line);
  border-radius: 5px;
  padding: 2px 6px;
  cursor: pointer;
}
.ch-box-head button.on {
  background: var(--ch-accent-bg);
  border-color: var(--ch-accent);
  font-weight: 700;
}
.ch-box-head .ch-x {
  margin-left: auto;
}
.ch-row {
  position: relative;
  display: grid;
  grid-template-columns: 30px 1fr 18px 58px;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}
.ch-row.first {
  background: var(--ch-box-sel);
  color: #ffffff;
}
.ch-row.first.wrong {
  background: var(--ch-box-wrong);
}
.ch-row.first.wrong .ch-tok {
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}
.ch-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--ch-accent);
  opacity: 0.2;
}
.ch-row > :not(.ch-fill) {
  position: relative;
}
.ch-ic {
  font:
    600 9px/12px system-ui,
    sans-serif;
  text-align: center;
  border: 1px solid currentColor;
  border-radius: 3px;
  opacity: 0.8;
}
.ch-tok {
  font-family: var(--slidev-code-font-family, "0xProto", monospace);
  font-size: 15px;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-row.hit .ch-tok {
  font-weight: 700;
}
.ch-ok {
  font-weight: 700;
}
.ch-pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ch-box-foot {
  padding: 3px 8px;
  border-top: 1px solid var(--ch-line);
  font-size: 11px;
  color: var(--ch-muted);
}

@media (prefers-reduced-motion: no-preference) {
  .ch-track i {
    transition: width 0.25s ease;
  }
}
</style>
