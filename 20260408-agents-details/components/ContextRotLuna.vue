<script setup lang="ts">
// Folie „Context Rot bei Luna“ (pages/context-rot-luna.md): der Regel-Regler aus
// Studie 7. Wählbar sind die Zahl der Regeln (0, 1, 3, 10), die Code-Variante
// (D0, D4) und das Fachgebiet. Links stehen der Regeltext und der Code mit den
// zehn Messstellen, rechts je Stelle Top-1, logit und Leak und darunter der
// mittlere Abstand je Regelzahl für Luna, Terra und Sol.
//
// Ohne Zutun zeigt die Folie nur vorberechnete Werte aus
// `data/contextrot/study7-luna.json` (3 Seeds je Stelle) und schickt keine
// Anfrage. Die Live-Abfrage liegt hinter dem 🛠️-Knopf: eigener Key, nur Luna,
// zehn Anfragen für die gewählte Bedingung. Ihre Werte stehen neben den
// vorberechneten und sind als Einzelmessung beschriftet.
//
// Logik und Anfragebau: `lib/contextRotLive.ts` (Tests daneben). Die Zahlen im
// Fließtext kommen aus der JSON. Zwei Ausnahmen stehen nur im Gesamtbericht der
// Studien, Teil 1.2, und sind unten als Konstanten eingetragen: die Kontrollen
// `guide-10` und `facts-10` und die Zahl der Antworten.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  watchEffect,
} from "vue";
import { useDarkMode, useIsSlideActive } from "@slidev/client";
import Callout from "@shared/components/Callout.vue";
import raw from "../data/contextrot/study7-luna.json";
import { ENDPOINT, isHit, keyType } from "./lib/contextHygiene";
import { sliceRuns, toRuns, type Run } from "./lib/codeRuns";
import {
  DEFAULT_LUNA,
  RULE_COUNTS,
  SCENARIOS,
  VARIANTS,
  codeSegments,
  conditionOf,
  estimateCostUsd,
  formatDelta,
  formatNumber,
  formatUsd,
  liveBody,
  parseRule,
  redactKeys,
  ruleLines,
  runJobs,
  series,
  sitePrefix,
  siteRows,
  summarize,
  summarizeLive,
  userPrompt,
  type LiveJob,
  type LiveResult,
  type ModelName,
  type Provider,
  type RuleCount,
  type ScenarioName,
  type SiteRow,
  type Study7,
  type Variant,
} from "./lib/contextRotLive";

const study = raw as unknown as Study7;
const { isDark } = useDarkMode();

// Gesamtbericht Teil 1.2, Absatz „Studie 7“: „Zehn zutreffende Richtlinien ohne
// If-Teil (guide-10, +0,19) und zehn neutrale Fakten (facts-10, −0,13) wirken
// nicht“; „7 560 Antworten mit 3 Seeds“. Beides steht nicht in der JSON.
const CONTROL_GUIDE_10 = 0.19;
const CONTROL_FACTS_10 = -0.13;
const STUDY_ANSWERS = "7 560";
/** Lauf-zu-Lauf-Rauschen der Zellmittel bei Luna (Studie 6), `notes.noise` der JSON. */
const NOISE = 0.76;

// ── Auswahl ──────────────────────────────────────────────────────────────────
const rules = ref<RuleCount>(0);
const variant = ref<Variant>("D0");
const scenario = ref<ScenarioName>("warehouse");
const selectedId = ref<string | null>(null);

const VARIANT_LABEL: Record<Variant, string> = {
  D0: "D0 fachliche Namen",
  D4: "D4 falsche Namen",
};
const MODEL_LABEL: Record<ModelName, string> = {
  luna: "Luna",
  terra: "Terra",
  sol: "Sol",
};

const cond = computed(() => conditionOf(rules.value));
const condition = computed(() => study.conditions[cond.value]!);
const block = computed(() => study.sites[scenario.value][variant.value]);
const rows = computed(() =>
  siteRows(study, scenario.value, variant.value, cond.value),
);
const baseRows = computed(() =>
  siteRows(study, scenario.value, variant.value, "none"),
);
const summary = computed(() => summarize(rows.value));
const selected = computed<SiteRow | null>(
  () => rows.value.find((r) => r.site.id === selectedId.value) ?? null,
);
const scopeLabel = computed(
  () => `${study.sites[scenario.value].label}, ${variant.value}`,
);

const ruleParts = computed(() =>
  ruleLines(condition.value.rules).map((line) => ({
    line,
    parts: parseRule(line),
  })),
);

// ── Code mit Marken ──────────────────────────────────────────────────────────
type MarkState = "leak" | "hit" | "miss";
const markState = (r: SiteRow): MarkState =>
  r.cell.leak >= 0.5
    ? "leak"
    : isHit(r.cell.top1, r.site.gold)
      ? "hit"
      : "miss";

// Syntaxfarben: Shiki aus Slidev, erst bei Bedarf geladen. Bis dahin (und
// falls es fehlschlägt) steht der Code ungefärbt da; Maße und Marken ändern
// sich nicht, weil nur Farben dazukommen.
const runs = ref<{ code: string; runs: Run[] } | null>(null);
watchEffect(async (onCleanup) => {
  let stale = false;
  onCleanup(() => (stale = true));
  const code = block.value.code;
  try {
    const setup = await (
      await import("@slidev/client/setup/shiki.ts")
    ).default();
    const hl = await setup.getEagerHighlighter();
    // Java steht nicht in `languageNames` (kein Java-Block in den Folien), die
    // Grammatik lässt sich aber nachladen.
    await hl.loadLanguage("java");
    const { tokens } = hl.codeToTokens(code, {
      ...setup.defaultHighlightOptions,
      lang: "java",
    });
    if (!stale) runs.value = { code, runs: toRuns(code, tokens) };
  } catch {
    if (!stale) runs.value = null;
  }
});

const segments = computed(() => {
  const byId = new Map(rows.value.map((r) => [r.site.id, r]));
  const sel = selected.value?.n ?? Infinity;
  // Läufe gelten nur für den Code, für den sie berechnet wurden.
  const colored =
    runs.value?.code === block.value.code ? runs.value.runs : null;
  let from = 0;
  return codeSegments(block.value).map((s, i) => {
    const to = from + s.text.length;
    const parts: Run[] = colored
      ? sliceRuns(colored, from, to)
      : [{ text: s.text }];
    from = to;
    return {
      text: s.text,
      parts,
      hidden: i + 1 > sel,
      row: s.mark ? byId.get(s.mark.site.id)! : null,
    };
  });
});

// Anzeige in Zeilen: Jede Codezeile ist ein eigener Block mit hängendem
// Einzug, damit eine umbrochene Zeile nicht auf Spalte 0 weiterläuft. Der Text
// bleibt Zeichen für Zeichen der aus den Daten; der live gesendete Prompt
// entsteht aus `block.code` (sitePrefix) und nicht aus dieser Anzeige.
interface CodeItem {
  /** Textstück; fehlt bei einer Marke */
  text?: string;
  style?: Record<string, string>;
  hidden: boolean;
  /** Marke einer Messstelle */
  row?: SiteRow;
}
interface CodeLine {
  /** führende Leerzeichen der Zeile */
  indent: number;
  items: CodeItem[];
}
const codeLines = computed<CodeLine[]>(() => {
  let cur: CodeLine = { indent: 0, items: [] };
  const lines = [cur];
  for (const s of segments.value) {
    for (const p of s.parts) {
      p.text.split("\n").forEach((piece, i) => {
        if (i > 0) {
          cur = { indent: 0, items: [] };
          lines.push(cur);
        }
        if (piece) {
          cur.items.push({ text: piece, style: p.style, hidden: s.hidden });
        }
      });
    }
    if (s.row) cur.items.push({ hidden: false, row: s.row });
  }
  for (const l of lines) {
    for (const it of l.items) {
      if (it.text === undefined) break;
      const blanks = it.text.length - it.text.trimStart().length;
      l.indent += blanks;
      if (blanks < it.text.length) break;
    }
  }
  return lines;
});

const codeEl = ref<HTMLElement | null>(null);
function select(id: string | null) {
  selectedId.value = selectedId.value === id ? null : id;
  if (selectedId.value) nextTick(revealSelected);
}
/** Rollt nur den Code-Kasten; `scrollIntoView` würde auch die Folie verschieben. */
function revealSelected() {
  const box = codeEl.value;
  const mark = box?.querySelector<HTMLElement>(".crl-mark.sel");
  if (!box || !mark) return;
  box.scrollTop = Math.max(0, mark.offsetTop - box.clientHeight / 2);
}
/** Rollt den Code so, dass die erste Marke mit etwas Vorlauf sichtbar ist.
 * Ohne das zeigt der Kasten beim Öffnen nur Code ohne Messstelle. */
function revealFirst() {
  const box = codeEl.value;
  const mark = box?.querySelector<HTMLElement>(".crl-mark");
  if (!box || !mark) return;
  box.scrollTop = Math.max(0, mark.offsetTop - 34);
}
const reveal = () => nextTick(selectedId.value ? revealSelected : revealFirst);
watch([variant, scenario], reveal);
// Eine nicht aktive Folie hat kein Layout (offsetTop ist 0); deshalb beim
// Betreten der Folie erneut rollen.
const slideActive = useIsSlideActive();
watch(slideActive, (a) => a && reveal());
onMounted(reveal);

const percent = (x: number): string => `${Math.round(x * 100)} %`;
const seedTops = (r: SiteRow): string =>
  r.cell.seeds.map(([, top1]) => top1).join(", ");

// ── Diagramm: Δ gepoolt je Regelzahl ─────────────────────────────────────────
/** Faktor, um den die Chance p / (1 − p) bei einem Abstand von `delta` logit
 * fällt: e hoch Betrag. Über mehrere Stellen ist das ein geometrisches Mittel. */
const oddsFactor = (delta: number): string =>
  formatNumber(Math.exp(Math.abs(delta)), 1);

const CHART = { w: 450, h: 116, top: 6, max: 1, min: -2.6, plot: 92 };
const X: Record<RuleCount, number> = { 0: 58, 1: 170, 3: 282, 10: 394 };
const y = (d: number): number =>
  CHART.top +
  ((CHART.max - Math.max(CHART.min, Math.min(CHART.max, d))) /
    (CHART.max - CHART.min)) *
    CHART.plot;

const lines = computed(() =>
  (["terra", "sol", "luna"] as ModelName[]).map((model) => {
    const pts = series(study, model);
    return {
      model,
      pts,
      path: pts.map((p) => `${X[p.rules]},${y(p.delta).toFixed(1)}`).join(" "),
    };
  }),
);
const luna = computed(() => lines.value.find((l) => l.model === "luna")!.pts);
const lunaAt = (n: RuleCount) => luna.value.find((p) => p.rules === n)!;
const TICKS = [0, -1, -2];
const chartLabel = computed(() => {
  const list = (model: ModelName) =>
    lines.value
      .find((l) => l.model === model)!
      .pts.filter((p) => p.rules > 0)
      .map((p) => `${p.rules}: ${formatDelta(p.delta)}`)
      .join(", ");
  return `Mittlerer Abstand des logit zur Grundlinie je Regelzahl. Luna ${list("luna")}. Terra ${list("terra")}. Sol ${list("sol")}. Rauschen ${formatNumber(NOISE)} logit.`;
});

// ── Live-Abfrage ─────────────────────────────────────────────────────────────
const hudOpen = ref(false);
/** Erklärung zur Spalte „Fehler“ (befolgt unzutreffende Regel). */
const ruleInfoOpen = ref(false);
const hudTab = ref<"info" | "live">("info");
const apiKey = ref("");
const liveModel = ref("");
const noReasoning = ref(true);
const flex = ref(true);
const running = ref(false);
const liveStatus = ref("");
const liveErrors = ref<string[]>([]);
const live = reactive<Record<string, LiveResult>>({});
let abort: AbortController | null = null;

const kType = computed(() => keyType(apiKey.value));
const provider = computed<Provider | null>(() =>
  kType.value === "openai" || kType.value === "openrouter" ? kType.value : null,
);
const kLabel = computed(() =>
  kType.value === "openai"
    ? "OpenAI-Key erkannt"
    : kType.value === "openrouter"
      ? "OpenRouter-Key erkannt"
      : kType.value === "unknown"
        ? "Format unbekannt"
        : "kein Key",
);
watch(provider, (p) => {
  if (!p) return;
  const cur = liveModel.value.trim();
  if (!cur || Object.values(DEFAULT_LUNA).includes(cur)) {
    liveModel.value = DEFAULT_LUNA[p];
  }
});
const canRun = computed(
  () => !!provider.value && !!liveModel.value.trim() && !running.value,
);

const liveKey = (sc: ScenarioName, v: Variant, c: string, id: string): string =>
  `${sc}|${v}|${c}|${id}`;
const liveFor = (id: string, c: string = cond.value): LiveResult | undefined =>
  live[liveKey(scenario.value, variant.value, c, id)];
const hasLive = computed(() => rows.value.some((r) => liveFor(r.site.id)));
const liveSummary = computed(() =>
  summarizeLive(rows.value, baseRows.value, (id) => liveFor(id)),
);
/** Live-Mittel je Regelzahl für die gewählte Variante und das Fachgebiet. */
const livePoints = computed(() =>
  RULE_COUNTS.flatMap((n) => {
    const c = conditionOf(n);
    const s = summarizeLive(
      siteRows(study, scenario.value, variant.value, c),
      baseRows.value,
      (id) => liveFor(id, c),
    );
    return s ? [{ rules: n, delta: s.delta }] : [];
  }),
);
const hasAnyLive = computed(() => Object.keys(live).length > 0);

const costLine = computed(() => {
  const per = study.notes.cost.luna.perCondition[cond.value]!;
  const n = rows.value.length;
  return `${n} Anfragen, rund ${formatUsd(estimateCostUsd(study, cond.value, n))} (Luna mit Flex, gemessen in Studie 7; ohne Flex etwa das Doppelte, Preise über OpenRouter nicht geprüft). Dauer in der Studie: im Mittel ${formatNumber(per.latencyMsMean / 1000, 1)} s je Anfrage, höchstens ${formatNumber(per.latencyMsMax / 1000, 1)} s.`;
});

async function runLive() {
  const p = provider.value;
  const model = liveModel.value.trim();
  if (!p || !model || running.value) return;
  const sc = scenario.value;
  const v = variant.value;
  const c = cond.value;
  const cur = condition.value;
  const code = block.value;
  const jobs: LiveJob[] = rows.value.map((r) => ({
    key: liveKey(sc, v, c, r.site.id),
    label: `Stelle ${r.n}`,
    gold: r.site.gold,
    body: liveBody(
      p,
      model,
      study.request,
      userPrompt(study.request, cur.rules, sitePrefix(code, r.site)),
      { noReasoning: noReasoning.value, flex: flex.value && p === "openai" },
    ),
  }));
  for (const j of jobs) delete live[j.key];
  const key = apiKey.value.trim();
  const ctl = new AbortController();
  abort = ctl;
  running.value = true;
  liveErrors.value = [];
  let seen = 0;
  const t0 = performance.now();
  const status = (tail = "") => {
    liveStatus.value = `${seen} von ${jobs.length} · ${liveErrors.value.length} Fehler · ${((performance.now() - t0) / 1000).toFixed(0)} s${tail}`;
  };
  status();
  const sum = await runJobs(jobs, {
    signal: ctl.signal,
    leaks: cur.leaks,
    sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
    send: async (body, signal) => {
      const res = await fetch(`${ENDPOINT[p]}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
      return { status: res.status, text: await res.text() };
    },
    onResult: (job, r) => {
      // Fehlermeldungen des Anbieters können Teile des Keys zitieren.
      const clean = r.error ? { ...r, error: redactKeys(r.error) } : r;
      live[job.key] = clean;
      seen++;
      if (clean.error) {
        liveErrors.value = [
          ...liveErrors.value,
          `${job.label}: ${clean.error}`,
        ];
      }
      status();
    },
  });
  if (abort === ctl) abort = null;
  running.value = false;
  status(
    sum.stopped
      ? " · gestoppt"
      : sum.skipped
        ? ` · abgebrochen, ${sum.skipped} nicht gesendet`
        : " · fertig",
  );
}
function stopLive() {
  abort?.abort();
}
function clearLive() {
  for (const k of Object.keys(live)) delete live[k];
  liveStatus.value = "";
  liveErrors.value = [];
}
// Nach dem Klick auf (i) gibt der Knopf den Fokus ab (blur), damit Slidev die
// Pfeiltasten behält. Escape hört darum am document, solange die Erklärung offen ist.
function onDocEscape(e: KeyboardEvent) {
  if (e.key === "Escape" && ruleInfoOpen.value) {
    ruleInfoOpen.value = false;
    e.stopPropagation();
  }
}
watch(ruleInfoOpen, (open) => {
  if (open) document.addEventListener("keydown", onDocEscape, true);
  else document.removeEventListener("keydown", onDocEscape, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocEscape, true);
  abort?.abort();
});

// ── Tastatur ─────────────────────────────────────────────────────────────────
/** Tasten in Eingabefeldern gehören dem Feld, nicht Slidev; Escape schließt das Panel. */
function onRootKey(e: KeyboardEvent) {
  if (e.key === "Escape" && (hudOpen.value || ruleInfoOpen.value)) {
    hudOpen.value = false;
    ruleInfoOpen.value = false;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && e.key !== "Tab") {
    e.stopPropagation();
  }
}

// ── Palette ──────────────────────────────────────────────────────────────────
const cssVars = computed(() => {
  const d = isDark.value;
  return {
    "--crl-text": d ? "#e0e0e8" : "#1f2937",
    "--crl-muted": d ? "#9ea0b0" : "#5b6472",
    "--crl-line": d ? "#2a2a35" : "#e4e4e7",
    "--crl-panel": d ? "#14141c" : "#ffffff",
    "--crl-halo": d ? "#121212" : "#ffffff",
    "--crl-panel2": d ? "#1a1a24" : "#f4f4f5",
    "--crl-edge": d ? "#e5e7eb" : "#1f2937",
    "--crl-luna": d ? "#a78bfa" : "#7c3aed",
    "--crl-luna-bg": d ? "rgba(167,139,250,0.18)" : "rgba(124,58,237,0.1)",
    "--crl-terra": d ? "#8a8a9a" : "#71717a",
    "--crl-sol": d ? "#b4b4c0" : "#52525b",
    "--crl-leak": d ? "#fbbf24" : "#b45309",
    "--crl-leak-bg": d ? "#92400e" : "#fde68a",
    "--crl-leak-fg": d ? "#ffffff" : "#1c1917",
    "--crl-hit": d ? "#60a5fa" : "#2563eb",
    "--crl-live": d ? "#34d399" : "#047857",
    "--crl-noise": d ? "rgba(140,140,160,0.16)" : "rgba(113,113,122,0.12)",
  } as Record<string, string>;
});

const LIMITS: readonly string[] = [
  "Sicherheit ist nicht Richtigkeit: Der logit sagt, wie entschieden das Modell wählt, nicht, ob die Wahl stimmt.",
  "Gemessen ist nur das erste Token der Fortsetzung. Ob Luna danach eine Regel befolgt, ist nicht gemessen.",
  "Die Regeln stammen aus wenigen Vorlagen. Echte Regeldateien klingen anders.",
  "Ein Korpus: Java, zwei Fachgebiete (Lager und Spesen), 40 Stellen. Jede Stelle lief je Bedingung und Seed einmal.",
  `Rauschen: Dieselbe Eingabe zweimal gemessen ergibt bei Luna Zellmittel, die im Mittel ${formatNumber(NOISE)} logit auseinanderliegen (Studie 6). Einzelne Stellen sind deshalb grob.`,
  "Die Werte je Fachgebiet und Variante (9 Semantik-Stellen) weichen vom Gesamtwert des Diagramms ab, bei Luna um bis zu rund 0,66 logit.",
  "Terra und Sol liegen ohne Regeln in D0 nahe der Obergrenze 6,91. Ein Anstieg ist dort kaum messbar, ein Abfall schon.",
  "Positivkontrolle: Eine Regel, die immer zutrifft, befolgte Luna an ca. 87 % der Messungen, knapp unter der vorab gesetzten Schwelle von 90 %.",
  "Live-Lauf: eine Anfrage je Stelle mit einem Seed, verglichen mit der Grundlinie der Studie. Bei diesem Rauschen kann ein einzelner Lauf vom Bericht abweichen.",
];
</script>

<template>
  <div class="crl" :style="cssVars" @keydown="onRootKey">
    <!-- Regler -->
    <div class="crl-bar">
      <div class="crl-seg" role="group" aria-label="Zahl der Regeln im Prompt">
        <span class="crl-seg-l">Regeln</span>
        <button
          v-for="n in RULE_COUNTS"
          :key="n"
          type="button"
          :class="{ on: rules === n }"
          :aria-pressed="rules === n"
          @click="rules = n"
        >
          {{ n }}
        </button>
      </div>
      <div class="crl-seg" role="group" aria-label="Code-Variante">
        <span class="crl-seg-l">Code</span>
        <button
          v-for="v in VARIANTS"
          :key="v"
          type="button"
          :class="{ on: variant === v }"
          :aria-pressed="variant === v"
          @click="variant = v"
        >
          {{ VARIANT_LABEL[v] }}
        </button>
      </div>
      <div class="crl-seg" role="group" aria-label="Fachgebiet">
        <span class="crl-seg-l">Fachgebiet</span>
        <button
          v-for="s in SCENARIOS"
          :key="s"
          type="button"
          :class="{ on: scenario === s }"
          :aria-pressed="scenario === s"
          @click="scenario = s"
        >
          {{ study.sites[s].label }}
        </button>
      </div>
      <span class="crl-bar-note">Luna · vorberechnet, 3 Seeds</span>
      <button
        type="button"
        class="crl-hud-btn"
        :aria-expanded="hudOpen"
        aria-controls="crl-hud"
        title="Info, Grenzen und Live-Abfrage"
        aria-label="Info, Grenzen und Live-Abfrage"
        @click="hudOpen = !hudOpen"
      >
        🛠️ Info · Live
      </button>
    </div>

    <div class="crl-main">
      <!-- Links: Regeltext, Code, gewählte Stelle -->
      <div class="crl-left">
        <div class="crl-rules">
          <div class="crl-h">
            Regeln im Prompt
            <span v-if="rules > 0" class="crl-h-note">
              {{ condition.ruleTokens }} Tokens · keine Bedingung trifft je zu
            </span>
          </div>
          <div v-if="rules === 0" class="crl-rules-none">
            Keine Regeln: die Grundlinie. Der Prompt enthält nur Aufgabe und
            Code.
          </div>
          <div v-else class="crl-rules-list">
            <div v-for="r in ruleParts" :key="r.line" class="crl-rule">
              <template v-if="r.parts">
                <span class="crl-rule-id">{{ r.parts.id }}</span> If
                <span class="crl-rule-if">{{ r.parts.condition }}</span
                >, then start your continuation with
                <span class="crl-rule-tok">{{ r.parts.start }}</span
                >.
              </template>
              <template v-else>{{ r.line }}</template>
            </div>
          </div>
        </div>

        <div ref="codeEl" class="crl-code" aria-label="Code mit Messstellen">
          <div
            v-for="(l, i) in codeLines"
            :key="i"
            class="crl-ln"
            :style="{ '--ind': String(l.indent) }"
          >
            <template v-for="(it, j) in l.items" :key="j"
              ><button
                v-if="it.row"
                type="button"
                class="crl-mark"
                :class="[
                  markState(it.row),
                  { sel: it.row.site.id === selectedId },
                ]"
                :aria-pressed="it.row.site.id === selectedId"
                :aria-label="`Stelle ${it.row.n}, Soll ${it.row.site.gold}, Top-1 ${it.row.cell.top1}`"
                @click="select(it.row.site.id)"
              >
                {{ it.row.n
                }}{{ markState(it.row) === "leak" ? "!" : "" }}</button
              ><span
                v-else
                :class="{ tok: it.style, after: it.hidden }"
                :style="it.style"
                >{{ it.text }}</span
              ></template
            >
          </div>
        </div>

        <div class="crl-detail" aria-live="polite">
          <template v-if="selected">
            <div>
              <b>Stelle {{ selected.n }}</b> · Soll
              <span class="crl-mono">{{ selected.site.gold }}</span> · Studie:
              <span
                v-for="([tok, p], i) in selected.cell.top5.slice(0, 3)"
                :key="tok"
                class="crl-mono"
                >{{ i ? " · " : "" }}{{ tok }} {{ percent(p) }}</span
              >
              <span class="crl-muted">
                · Top-1 je Seed: {{ seedTops(selected) }}</span
              >
            </div>
            <div v-if="liveFor(selected.site.id)" class="crl-live-ink">
              Dein Lauf (1 Seed):
              <template v-if="liveFor(selected.site.id)!.error">
                {{ liveFor(selected.site.id)!.error }}
              </template>
              <template v-else>
                <span
                  v-for="([tok, p], i) in liveFor(selected.site.id)!.top.slice(
                    0,
                    3,
                  )"
                  :key="tok"
                  class="crl-mono"
                  >{{ i ? " · " : "" }}{{ tok }} {{ percent(p) }}</span
                >
              </template>
            </div>
          </template>
          <template v-else>
            <span class="crl-chip leak">n!</span> Stellennummer mit !: befolgt
            unzutreffende Regel in mindestens 2 von 3 Seeds
            <span class="crl-chip hit">n</span> Top-1 trifft das Soll
            <span class="crl-chip miss">n</span> anderes Token ·
            <span class="crl-muted"
              >Klick auf eine Marke zeigt, was Luna dort sieht.</span
            >
          </template>
        </div>
      </div>

      <!-- Rechts: Tabelle je Stelle und Diagramm -->
      <div class="crl-right">
        <table class="crl-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Soll</th>
              <th>Top-1</th>
              <th class="num">logit</th>
              <th class="num">Δ</th>
              <th class="num">
                Fehler
                <button
                  type="button"
                  class="crl-i"
                  :aria-expanded="ruleInfoOpen"
                  aria-controls="crl-rule-info"
                  title="Was heißt „Fehler“?"
                  aria-label="Was heißt „Fehler“?"
                  @click="
                    ruleInfoOpen = !ruleInfoOpen;
                    ($event.currentTarget as HTMLElement).blur();
                  "
                >
                  i
                </button>
              </th>
              <template v-if="hasLive">
                <th class="live">Dein Lauf</th>
                <th class="num live">logit</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.site.id"
              :class="{ sel: r.site.id === selectedId, ctl: !r.semantic }"
              @click="select(r.site.id)"
            >
              <td class="num">{{ r.n }}</td>
              <td class="tok" :title="r.site.gold">
                {{ r.site.gold
                }}<span v-if="!r.semantic" class="crl-muted"> Kontrolle</span>
              </td>
              <td class="tok" :class="markState(r)">
                {{ r.cell.top1 }}{{ markState(r) === "hit" ? " ✓" : "" }}
              </td>
              <td class="num">{{ formatNumber(r.cell.logit, 1) }}</td>
              <td class="num" :class="{ neg: rules > 0 && r.delta < 0 }">
                {{ rules === 0 ? "–" : formatDelta(r.delta, 1) }}
              </td>
              <td class="num" :class="{ leak: r.cell.leak > 0 }">
                {{
                  rules === 0
                    ? "–"
                    : `${Math.round(r.cell.leak * r.cell.n)}/${r.cell.n}`
                }}
              </td>
              <template v-if="hasLive">
                <td
                  class="tok live"
                  :class="{ leak: liveFor(r.site.id)?.leak }"
                  :title="liveFor(r.site.id)?.error"
                >
                  <template v-if="liveFor(r.site.id)?.error"
                    >API-Fehler</template
                  >
                  <template v-else-if="liveFor(r.site.id)">
                    {{ liveFor(r.site.id)!.top1
                    }}{{
                      liveFor(r.site.id)!.leak
                        ? " !"
                        : liveFor(r.site.id)!.hit
                          ? " ✓"
                          : ""
                    }}
                  </template>
                  <template v-else>…</template>
                </td>
                <td class="num live">
                  {{
                    liveFor(r.site.id)?.logit != null
                      ? formatNumber(liveFor(r.site.id)!.logit!, 1)
                      : "–"
                  }}
                </td>
              </template>
            </tr>
          </tbody>
        </table>
        <div
          v-if="ruleInfoOpen"
          id="crl-rule-info"
          class="crl-rule-info"
          role="note"
        >
          <b>„Fehler“ heißt:</b> Luna befolgt eine unzutreffende Regel und
          beginnt ihre Fortsetzung des Codes mit dem Anfang der Regelanweisung
          statt mit dem Token aus dem Code. Beispiel: Die Regel „If a list is
          empty and contains one element, then start your continuation with the
          call Objects.requireNonNull(“ trifft nie zu, und Luna beginnt trotzdem
          mit <code>Objects</code>. Jede Stelle wird dreimal gemessen, jedes Mal
          mit einem anderen Zufallswert (Seed); k/3 heißt: in k dieser 3
          Messungen. Ab 2/3 trägt die Stelle im Code die Marke mit !.
        </div>

        <div class="crl-sum">
          <b>{{ summary.sites }} Semantik-Stellen ({{ scopeLabel }}):</b>
          logit {{ formatNumber(summary.logit) }}
          <template v-if="rules > 0">
            · Δ <b>{{ formatDelta(summary.delta) }}</b> · unzutreffende Regel
            befolgt in {{ percent(summary.leak) }} der Messungen · fallend
            {{ summary.falling }} von {{ summary.sites }} ({{
              percent(summary.falling / summary.sites)
            }})
          </template>
        </div>
        <div v-if="liveSummary" class="crl-sum crl-live-ink">
          <b>Dein Lauf, 1 Seed, Einzelmessung:</b>
          logit {{ formatNumber(liveSummary.logit) }} · Δ
          {{ formatDelta(liveSummary.delta) }} gegen die Studien-Grundlinie ·
          unzutreffende Regel befolgt: {{ liveSummary.leaks }} von
          {{ liveSummary.measured }} Stellen ({{
            percent(liveSummary.leaks / liveSummary.measured)
          }})
        </div>

        <div class="crl-legend">
          <b>Δ logit gegen 0 Regeln</b>
          <span class="crl-muted"
            >Mittel über beide Fachgebiete, D0 und D4 (36 Stellenpaare)</span
          >
        </div>
        <div class="crl-legend">
          <span><i class="sw luna" /> Luna, 95-%-Intervall</span>
          <span><i class="sw terra" /> Terra</span>
          <span><i class="sw sol" /> Sol</span>
          <span v-if="livePoints.length" class="crl-live-ink">◆ dein Lauf</span>
        </div>
        <svg
          class="crl-chart"
          :viewBox="`0 0 ${CHART.w} ${CHART.h}`"
          role="img"
          :aria-label="chartLabel"
        >
          <rect
            class="noise"
            x="34"
            :y="y(NOISE)"
            :width="CHART.w - 40"
            :height="y(-NOISE) - y(NOISE)"
          />
          <text class="lbl noise-lbl" :x="CHART.w - 8" :y="y(NOISE) + 9">
            Rauschen ±{{ formatNumber(NOISE) }} (Studie 6)
          </text>
          <g v-for="t in TICKS" :key="t">
            <line
              class="gl"
              :class="{ zero: t === 0 }"
              x1="34"
              :x2="CHART.w - 6"
              :y1="y(t)"
              :y2="y(t)"
            />
            <text class="lbl tick" x="30" :y="y(t) + 3">
              {{ formatNumber(t, 0) }}
            </text>
          </g>
          <rect
            class="pick"
            :x="X[rules] - 30"
            :y="CHART.top - 4"
            width="60"
            :height="CHART.plot + 20"
            rx="4"
          />
          <template v-for="l in lines" :key="l.model">
            <polyline class="line" :class="l.model" :points="l.path" />
            <template v-if="l.model !== 'luna'">
              <circle
                v-for="p in l.pts"
                :key="p.rules"
                class="dot"
                :class="l.model"
                :cx="X[p.rules]"
                :cy="y(p.delta)"
                r="2"
              />
            </template>
          </template>
          <g v-for="p in luna" :key="p.rules">
            <line
              v-if="p.ci"
              class="ci"
              :x1="X[p.rules]"
              :x2="X[p.rules]"
              :y1="y(p.ci[1])"
              :y2="y(p.ci[0])"
            />
            <circle
              class="dot luna"
              :cx="X[p.rules]"
              :cy="y(p.delta)"
              r="3.5"
            />
            <text
              v-if="p.rules > 0"
              class="lbl val"
              :x="X[p.rules] - 7"
              :y="y(p.delta) + 13"
            >
              {{ formatDelta(p.delta) }}
            </text>
          </g>
          <g v-for="p in livePoints" :key="`live-${p.rules}`">
            <path
              class="live"
              :d="`M ${X[p.rules] - 14} ${y(p.delta)} l 5 -5 l 5 5 l -5 5 z`"
            />
          </g>
          <text
            v-for="n in RULE_COUNTS"
            :key="n"
            class="lbl xl"
            :class="{ on: rules === n }"
            :x="X[n]"
            :y="CHART.h - 3"
          >
            {{ n === 1 ? "1 Regel" : `${n} Regeln` }}
          </text>
        </svg>
      </div>
    </div>

    <Callout tone="info" dense class="crl-callout">
      <b>Inhalt statt Länge:</b> Schon <b>eine</b> Regel, deren Bedingung Luna
      am Code prüfen muss, kostet
      <b>{{ formatNumber(Math.abs(lunaAt(1).delta)) }} logit</b>: Die Chance
      p&nbsp;/&nbsp;(1&nbsp;−&nbsp;p) des wahrscheinlichsten Tokens gegen alle
      anderen fällt im Mittel um den Faktor {{ oddsFactor(lunaAt(1).delta) }}.
      Drei Regeln kosten {{ formatNumber(Math.abs(lunaAt(3).delta)) }} logit,
      zehn {{ formatNumber(Math.abs(lunaAt(10).delta)) }} (Faktor
      {{ oddsFactor(lunaAt(10).delta) }}). Zehn neutrale Fakten ({{
        formatDelta(CONTROL_FACTS_10)
      }}) oder zehn zutreffende Richtlinien ohne If-Teil ({{
        formatDelta(CONTROL_GUIDE_10)
      }}) bewirken nichts. Terra und Sol reagieren kaum.
    </Callout>

    <div class="crl-foot">
      <span>
        Sicherheit ist nicht Richtigkeit · nur das erste Token · Regeln aus
        Vorlagen · Rauschen {{ formatNumber(NOISE) }} logit
      </span>
      <span>
        Eigene Studie 7: {{ STUDY_ANSWERS }} Antworten, 3 Seeds · Stand
        22.11.2026
      </span>
    </div>

    <!-- Info und Live-Abfrage -->
    <div
      v-if="hudOpen"
      id="crl-hud"
      class="crl-hud"
      role="dialog"
      aria-label="Info, Grenzen und Live-Abfrage"
    >
      <div class="crl-hud-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="hudTab === 'info'"
          :class="{ on: hudTab === 'info' }"
          @click="hudTab = 'info'"
        >
          ⓘ Messung und Grenzen
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="hudTab === 'live'"
          :class="{ on: hudTab === 'live' }"
          @click="hudTab = 'live'"
        >
          Live-Abfrage
        </button>
        <button
          type="button"
          class="crl-x"
          aria-label="Schließen"
          @click="hudOpen = false"
        >
          ✕
        </button>
      </div>

      <div v-if="hudTab === 'info'" class="crl-hud-body">
        <div class="crl-hud-h">Was gemessen wird</div>
        <div class="crl-hud-p">
          Der Prompt endet mitten in einer Java-Datei, an einer der zehn Marken.
          Gemessen wird das erste Token, mit dem Luna fortsetzt, samt den fünf
          wahrscheinlichsten Alternativen. Der logit ist ln(p / (1 − p)) der
          Wahrscheinlichkeit p des wahrscheinlichsten Tokens; p ist bei 0,999
          gedeckelt, der höchste logit ist daher 6,91. Höher heißt sicherer. Δ
          ist der logit mit Regeln minus der logit derselben Stelle ohne Regeln.
          Ein Δ von {{ formatDelta(lunaAt(1).delta) }} heißt: Die Chance p / (1
          − p) des wahrscheinlichsten Tokens gegen alle anderen fällt um den
          Faktor e<sup>{{ formatNumber(Math.abs(lunaAt(1).delta)) }}</sup> ≈
          {{ oddsFactor(lunaAt(1).delta) }}, als geometrisches Mittel über die
          Stellen. Als Beispiel: von p = 0,90 auf p ≈ 0,78.
        </div>
        <div class="crl-hud-h">Die Regeln</div>
        <div class="crl-hud-p">
          Jede Regel hat die Form „If Bedingung, then start your continuation
          with Token“. Die Bedingung trifft nie zu, meist widerspricht sie sich
          selbst. Wer die Regel richtig liest, setzt den Code so fort wie ohne
          Regel. Luna befolgt trotzdem manchmal eine unzutreffende Regel: Sie
          beginnt mit einem Token, das die Regeln nennen, statt mit dem Token
          aus dem Code.
        </div>
        <div class="crl-hud-h">Aufbau</div>
        <div class="crl-hud-p">
          Luna ist <span class="crl-mono">gpt-5.6-luna</span>, Terra
          <span class="crl-mono">gpt-6.1-terra</span>, Sol
          <span class="crl-mono">gpt-6-sol</span>. Je Fachgebiet und
          Code-Variante 9 Semantik-Stellen und 1 Syntax-Stelle als Kontrolle;
          {{ study.source.seeds.length }} Seeds je Stelle, Reasoning aus,
          Flex-Tarif. Das Diagramm zeigt die Werte des Berichts über beide
          Fachgebiete und beide Varianten, die Tabelle die gewählte Auswahl.
        </div>
        <div class="crl-hud-h">Grenzen</div>
        <ul class="crl-hud-list">
          <li v-for="l in LIMITS" :key="l">{{ l }}</li>
        </ul>
        <div class="crl-hud-h">Quelle</div>
        <div class="crl-hud-p">
          Eigene Studie 7 „Anzahl oder Inhalt?“ mit
          {{ STUDY_ANSWERS }} Antworten; Zahlen aus dem Gesamtbericht der
          Studien, Teil 1.2, und aus den Rohdaten nachgerechnet. Die Kontrollen
          mit Richtlinien und Fakten stammen aus derselben Studie. Stand
          22.11.2026.
        </div>
      </div>

      <div v-else class="crl-hud-body">
        <div class="crl-hud-p">
          Fragt die gewählte Bedingung für Luna an den zehn Stellen ab:
          <b
            >{{ rules }} {{ rules === 1 ? "Regel" : "Regeln" }},
            {{ scopeLabel }}</b
          >. Die Anfrage ist die der Studie: gleicher Prompt, 4 Ausgabe-Tokens,
          Top-5-Logprobs, Seed {{ study.source.seeds[0] }}.
        </div>
        <label class="crl-field">
          <span
            >API-Key <em class="crl-pill">{{ kLabel }}</em></span
          >
          <input
            v-model="apiKey"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="sk-… oder sk-or-…"
          />
        </label>
        <div class="crl-hud-p crl-muted">
          Der Key bleibt im Speicher dieser Seite. Er wird nicht gespeichert und
          nicht protokolliert und geht nur an OpenAI oder OpenRouter.
        </div>
        <label class="crl-field">
          <span>Modell</span>
          <input v-model="liveModel" type="text" spellcheck="false" />
        </label>
        <div class="crl-checks">
          <label
            ><input v-model="noReasoning" type="checkbox" /> Reasoning
            aus</label
          >
          <label :class="{ off: provider !== 'openai' }"
            ><input
              v-model="flex"
              type="checkbox"
              :disabled="provider !== 'openai'"
            />
            Flex (nur OpenAI)</label
          >
        </div>
        <div class="crl-hud-p crl-muted">{{ costLine }}</div>
        <div class="crl-actions">
          <button
            type="button"
            class="primary"
            :disabled="!canRun"
            @click="runLive"
          >
            10 Stellen abfragen
          </button>
          <button type="button" :disabled="!running" @click="stopLive">
            Abbrechen
          </button>
          <button
            type="button"
            :disabled="!hasAnyLive || running"
            @click="clearLive"
          >
            Verwerfen
          </button>
        </div>
        <div v-if="liveStatus" class="crl-hud-p" role="status">
          {{ liveStatus }}
        </div>
        <div v-if="liveErrors.length" class="crl-err" role="alert">
          <div v-for="(e, i) in liveErrors" :key="i">{{ e }}</div>
        </div>
        <div class="crl-hud-p crl-muted">
          Das Ergebnis steht in der Tabelle neben den Werten der Studie und im
          Diagramm als Raute: ein Seed, eine Messung je Stelle. Bei
          {{ formatNumber(NOISE) }} logit Rauschen kann ein einzelner Lauf vom
          Bericht abweichen.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crl {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  height: 432px;
  color: var(--crl-text);
  font-size: 11px;
  line-height: 1.3;
}
.crl-muted {
  color: var(--crl-muted);
}
.crl-mono,
.crl-code,
.crl-rule,
.crl-table .tok {
  font-family: var(--slidev-code-font-family, ui-monospace, Menlo, monospace);
}
.crl-live-ink {
  color: var(--crl-live);
}
.crl button,
.crl input[type="text"],
.crl input[type="password"] {
  font: inherit;
  color: var(--crl-text);
  background: var(--crl-panel);
  border: 1px solid var(--crl-line);
  border-radius: 6px;
  padding: 2px 7px;
}
.crl button {
  cursor: pointer;
}
.crl button:disabled {
  opacity: 0.5;
  cursor: default;
}
.crl button:focus-visible,
.crl input:focus-visible {
  outline: 2px solid var(--crl-luna);
  outline-offset: 1px;
}

/* Regler */
.crl-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.crl-seg {
  display: flex;
  align-items: center;
}
.crl-seg-l {
  margin-right: 5px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--crl-muted);
}
.crl-seg button {
  min-width: 26px;
  white-space: nowrap;
  border-radius: 0;
  margin-left: -1px;
}
.crl-seg button:first-of-type {
  margin-left: 0;
  border-radius: 6px 0 0 6px;
}
.crl-seg button:last-of-type {
  border-radius: 0 6px 6px 0;
}
.crl-seg button.on {
  position: relative;
  font-weight: 700;
  color: var(--crl-luna);
  background: var(--crl-luna-bg);
  border-color: var(--crl-luna);
}
.crl-bar-note {
  margin-left: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--crl-muted);
}
.crl .crl-hud-btn {
  flex: none;
  white-space: nowrap;
}

/* Zwei Spalten */
.crl-main {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 46fr 54fr;
  gap: 10px;
}
.crl-left,
.crl-right {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crl-h {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--crl-muted);
}
.crl-h-note {
  margin-left: 6px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

/* Regeltext */
.crl-rules {
  /* 78 px für 0 oder 1 Regel, höchstens 128 px für 3 oder 10: Ohne die
     Obergrenze wächst der Kasten auf seine Inhaltshöhe und verdrängt den Code;
     die Liste rollt stattdessen. */
  flex: 0 0 auto;
  min-height: 78px;
  max-height: 128px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px;
  background: var(--crl-panel);
  border: 1px solid var(--crl-line);
  border-radius: 6px;
}
.crl-rules-none {
  color: var(--crl-muted);
}
.crl-rules-list {
  min-height: 0;
  overflow-y: auto;
}
.crl-rule {
  font-size: 9.5px;
  line-height: 1.35;
}
.crl-rule-id {
  color: var(--crl-muted);
}
.crl-rule-if {
  color: var(--crl-luna);
}
.crl-rule-tok {
  font-weight: 700;
  color: var(--crl-leak);
}

/* Code */
.crl-code {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 5px 8px;
  font-size: 9.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--crl-panel2);
  border: 1px solid var(--crl-line);
  border-radius: 6px;
}
.crl-code .tok {
  color: var(--shiki-light);
}
.dark .crl-code .tok {
  color: var(--shiki-dark);
}
.crl-code .after {
  opacity: 0.28;
}
/* Eine Codezeile: hängender Einzug. Die führenden Leerzeichen stehen weiter im
   Text; Fortsetzungszeilen beginnen zwei Zeichen hinter der Einrückung. */
.crl-ln {
  min-height: 1.5em;
  padding-left: calc(var(--ind) * 1ch + 2ch);
  text-indent: calc(var(--ind) * -1ch - 2ch);
}
.crl .crl-mark {
  display: inline-block;
  min-width: 15px;
  margin: 0 1px;
  padding: 0 3px;
  font-family: inherit;
  font-size: 9px;
  font-weight: 700;
  line-height: 13px;
  text-align: center;
  text-indent: 0;
  white-space: nowrap;
  border-radius: 7px;
  border: 1px solid transparent;
}
.crl .crl-mark.leak,
.crl-chip.leak {
  color: var(--crl-leak-fg);
  background: var(--crl-leak-bg);
  border: 1px dashed var(--crl-leak);
}
.crl .crl-mark.hit,
.crl-chip.hit {
  color: #ffffff;
  background: #1d4ed8;
}
.crl .crl-mark.miss,
.crl-chip.miss {
  color: var(--crl-text);
  background: var(--crl-panel);
  border-color: var(--crl-muted);
}
.crl .crl-mark.sel {
  outline: 2px solid var(--crl-edge);
  outline-offset: 1px;
}
.crl-chip {
  display: inline-block;
  min-width: 15px;
  margin: 0 2px 0 6px;
  padding: 0 3px;
  font-size: 9px;
  font-weight: 700;
  line-height: 13px;
  text-align: center;
  border-radius: 7px;
  border: 1px solid transparent;
}
.crl-chip:first-child {
  margin-left: 0;
}

/* Gewählte Stelle */
.crl-detail {
  flex: 0 0 44px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.45;
}

/* Tabelle: eigene Regeln statt der Tabellen-Styles des Themes, damit die
   Zeilenhöhe fest bleibt (Overflow-Budget der Folie). */
.crl-table {
  flex: 0 0 auto;
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  line-height: 1.15;
  background: var(--crl-panel);
  border: 1px solid var(--crl-line);
}
.crl-table th {
  padding: 1px 6px;
  text-align: left;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--crl-muted);
  background: var(--crl-panel2);
  border-bottom: 1px solid var(--crl-line);
}
.crl-table td {
  padding: 0 6px;
  border-bottom: 1px solid var(--crl-line);
  white-space: nowrap;
}
.crl-table tbody tr {
  cursor: pointer;
}
.crl-table tbody tr:last-child td {
  border-bottom: none;
}
.crl-table tbody tr.sel td {
  background: var(--crl-luna-bg);
}
.crl-table tbody tr.ctl td {
  color: var(--crl-muted);
}
.crl-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.crl-table .tok {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 9.5px;
}
.crl-table td.leak {
  font-weight: 700;
  color: var(--crl-leak);
}
.crl-table td.hit {
  color: var(--crl-hit);
}
.crl-table td.neg {
  color: var(--crl-leak);
}
.crl-table .crl-i {
  margin-left: 3px;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: none;
  color: inherit;
  font: italic 700 8px/10px serif;
  text-transform: none;
  cursor: pointer;
  vertical-align: 1px;
}
.crl-right {
  position: relative;
}
.crl-rule-info {
  position: absolute;
  z-index: 5;
  top: 22px;
  right: 0;
  width: min(300px, 92%);
  padding: 6px 8px;
  border: 1px solid var(--crl-leak);
  border-radius: 6px;
  background: var(--crl-panel2);
  color: var(--crl-text, inherit);
  font-size: 10.5px;
  line-height: 1.35;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.crl-table .live {
  color: var(--crl-live);
  border-left: 1px solid var(--crl-line);
}
.crl-table th.live {
  color: var(--crl-live);
}

.crl-sum {
  flex: 0 0 auto;
  font-size: 10px;
  line-height: 1.3;
}

/* Diagramm */
.crl-legend {
  flex: 0 0 auto;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 9.5px;
  white-space: nowrap;
}
.crl-legend > * {
  flex: none;
  white-space: nowrap;
}
.crl-legend .sw {
  display: inline-block;
  width: 16px;
  height: 0;
  margin-right: 3px;
  vertical-align: middle;
  border-top: 2px solid var(--crl-terra);
}
.crl-legend .sw.luna {
  border-top: 3px solid var(--crl-luna);
}
.crl-legend .sw.terra {
  border-top-style: dashed;
}
.crl-legend .sw.sol {
  border-top-style: dotted;
  border-top-color: var(--crl-sol);
}
.crl-chart {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
.crl-chart .noise {
  fill: var(--crl-noise);
}
.crl-chart .gl {
  stroke: var(--crl-line);
  stroke-width: 1;
}
.crl-chart .gl.zero {
  stroke: var(--crl-muted);
}
.crl-chart .pick {
  fill: var(--crl-luna-bg);
}
.crl-chart .line {
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.crl-chart .line.luna {
  stroke: var(--crl-luna);
  stroke-width: 2.5;
}
.crl-chart .line.terra {
  stroke: var(--crl-terra);
  stroke-dasharray: 5 3;
}
.crl-chart .line.sol {
  stroke: var(--crl-sol);
  stroke-dasharray: 1.5 3;
}
.crl-chart .dot.luna {
  fill: var(--crl-luna);
  stroke: var(--crl-panel);
  stroke-width: 1;
}
.crl-chart .dot.terra {
  fill: var(--crl-terra);
}
.crl-chart .dot.sol {
  fill: var(--crl-sol);
}
.crl-chart .ci {
  stroke: var(--crl-luna);
  stroke-width: 1;
  opacity: 0.6;
}
.crl-chart .live {
  fill: var(--crl-live);
  stroke: var(--crl-panel);
  stroke-width: 1;
}
.crl-chart .lbl {
  font-size: 9px;
  fill: var(--crl-muted);
}
.crl-chart .tick {
  text-anchor: end;
}
.crl-chart .noise-lbl {
  text-anchor: end;
}
/* Wert links unter dem Punkt, abseits von Linie und Fehlerbalken; der Hof in
   der Farbe des Hintergrunds hält das Minuszeichen lesbar. */
.crl-chart .val {
  text-anchor: end;
  font-size: 10px;
  font-weight: 700;
  fill: var(--crl-luna);
  stroke: var(--crl-halo);
  stroke-width: 3px;
  stroke-linejoin: round;
  paint-order: stroke;
}
.crl-chart .xl {
  text-anchor: middle;
}
.crl-chart .xl.on {
  font-weight: 700;
  fill: var(--crl-luna);
}
.crl .crl-callout {
  flex: 0 0 auto;
  margin: 0;
  font-size: 11.5px;
  line-height: 1.35;
}
.crl-foot {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 9.5px;
  white-space: nowrap;
  color: var(--crl-muted);
}

/* Info und Live-Abfrage */
.crl-hud {
  position: absolute;
  top: 28px;
  right: 0;
  z-index: 40;
  width: 440px;
  max-height: 394px;
  overflow: auto;
  background: var(--crl-panel);
  border: 1px solid var(--crl-edge);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.3);
}
.crl-hud-tabs {
  position: sticky;
  top: 0;
  display: flex;
  gap: 4px;
  padding: 6px;
  background: var(--crl-panel);
  border-bottom: 1px solid var(--crl-line);
}
.crl-hud-tabs .on {
  background: var(--crl-luna-bg);
  border-color: var(--crl-luna);
}
.crl-x {
  margin-left: auto;
}
.crl-hud-body {
  padding: 6px 12px 12px;
  font-size: 11px;
  line-height: 1.4;
}
.crl-hud-h {
  margin: 7px 0 2px;
  font-weight: 700;
}
.crl-hud-p {
  margin: 3px 0;
}
.crl-hud-list {
  margin: 2px 0;
  padding-left: 16px;
  list-style: disc;
}
.crl-hud-list li {
  margin: 2px 0;
  padding: 0;
  font-size: 11px;
  line-height: 1.4;
}
.crl-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 5px 0;
  font-size: 10px;
  color: var(--crl-muted);
}
.crl-pill {
  margin-left: 4px;
  padding: 0 5px;
  font-style: normal;
  border: 1px solid var(--crl-line);
  border-radius: 8px;
}
.crl-checks {
  display: flex;
  gap: 14px;
  margin: 5px 0;
}
.crl-checks label.off {
  opacity: 0.55;
}
.crl-actions {
  display: flex;
  gap: 6px;
  margin: 6px 0;
}
.crl-actions .primary {
  font-weight: 700;
  border-color: var(--crl-luna);
  background: var(--crl-luna-bg);
}
.crl-err {
  margin: 4px 0;
  padding: 4px 6px;
  font-size: 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--crl-leak);
  border: 1px solid var(--crl-leak);
  border-radius: 6px;
}
</style>
