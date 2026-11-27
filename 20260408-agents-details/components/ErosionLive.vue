<script setup lang="ts">
// Folie „Luna schreibt die Regeln um: live“ (pages/erosion-luna-live.md).
//
// Live-Lauf einer einzelnen Kette aus Studie 9, mit dem eigenen OpenAI-Key
// des Vortragenden. Ablauf und Prompts stehen in lib/erosionLiveLogic.ts
// (Tests daneben); diese Datei ist nur Bedienung und Anzeige.
//
// Die Logik ist aus dem Original-Runner von Studie 9 portiert, der Fülltext ist
// der Original-Korpus (data/erosion/study9-live.json, Herkunft und Lizenzen in
// data/erosion/LIVE_CORPUS_NOTICE.md). Nur die Ziehung nutzt einen eigenen
// Zufallszähler.
//
// Der Key liegt nur in `apiKey` (Speicher dieser Seite). Er wird nicht
// gespeichert und nicht protokolliert und geht nur an api.openai.com. Jede
// Fehlermeldung läuft durch `redactKeys`.
//
// Alle sichtbaren Texte stehen in TEXTS, SOURCES und CAVEATS; geschrieben von
// Opus (AGENTS.md, „Which Model Does What on Slides“).
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { useDarkMode } from "@slidev/client";
import study from "../data/erosion/study9-chain.json";
import labels from "../data/erosion/chain-labels.json";
import SourcesPopover from "./SourcesPopover.vue";
import { useDeckPalette } from "./palette";
import { ENDPOINT, keyType } from "./lib/contextHygieneLogic";
import { formatUsd, redactKeys } from "./lib/contextRotLive";
import {
  BEHAVIOUR_IDS,
  chainSeries,
  codeSegments,
  diffRules,
  obeys,
  type Arm,
  type BehaviourId,
  type Study9,
} from "./lib/erosionChainLogic";
import {
  LIVE_SITES,
  ORIGINAL_ITEMS,
  ROUNDS,
  estimateChainCost,
  loadCorpus,
  runChain,
  type RoundEvent,
} from "./lib/erosionLiveLogic";

// ── Texte ────────────────────────────────────────────────────────────────
const TEXTS = {
  keyLabel: "Key",
  keyPlaceholder: "sk-…",
  keyAria:
    "OpenAI-API-Key. Er bleibt im Speicher dieser Seite und geht nur an api.openai.com.",
  keyPillOpenai: "OpenAI-Key",
  keyPillOther: "kein OpenAI-Key",
  keyPillNone: "kein Key",
  keyNote: "nicht gespeichert, nur an api.openai.com",
  modelLabel: "Modell",
  modelAria: "Modell, das umschreibt und getestet wird",
  flexLabel: "Flex",
  flexTitle:
    "Flex-Tarif wie in der Studie: billiger, aber langsamer und öfter ausgelastet",
  start: "Start",
  restart: "Neu starten",
  abort: "Abbrechen",
  armLabel: "Auftrag",
  armAria: "Auftrag an das Modell beim Umschreiben",
  armTag: (short: string, tag: string) => (tag ? `${short} (${tag})` : short),
  cost: (rewrites: number, tests: number, usd: string) =>
    `${rewrites} + ${tests} Anfragen · geschätzt ${usd}`,
  statusIdle: "Bereit. Key eintragen, Auftrag wählen, starten.",
  statusStart: (s: number) => `Start: Test der Originalliste · ${s} s`,
  statusRound: (r: number, of: number, s: number) =>
    `Runde ${r} von ${of}: umschreiben, dann testen · ${s} s`,
  statusDone: (s: number) => `Fertig nach ${s} s · eine einzelne Kette`,
  statusStopped: (r: number) => `Abgebrochen, zuletzt fertig: Runde ${r}`,
  statusFailed: (r: number) =>
    `Abbruch durch Fehler, zuletzt fertig: Runde ${r}`,
  errorLead: "Fehler:",
  roundLabel: "Runde",
  stepsAria: "Runde wählen; Start ist die Originalliste",
  stepStart: "Start",
  stepAria: (label: string, obeyed: number, of: number) =>
    `${label}: befolgt ${obeyed} von ${of}`,
  stepPending: (label: string) => `${label}: noch nicht gelaufen`,
  obeyed: (x: number, of: number) => `befolgt ${x} von ${of}`,
  present: (y: number, of: number) => `Gebote da ${y} von ${of}`,
  notMeasured: "noch nicht gemessen",
  listTitleStart: "Originalliste",
  listTitleRound: (r: number) => `Liste nach Runde ${r}`,
  listPreview: "Originalliste der Studie, noch nicht getestet",
  listOriginal: "Ausgangsliste vor dem ersten Umschreiben",
  rules: (n: number) => `${n} ${n === 1 ? "Regel" : "Regeln"}`,
  chipsLabel: "In der Liste:",
  chipPresent: "steht in der Liste: Auslöser und Token gefunden",
  chipGone: "nicht mehr in der Liste",
  diffKept: (n: number) => `${n} wörtlich`,
  diffChanged: (n: number) => `${n} umformuliert oder neu`,
  diffNet: (net: number) =>
    net === 0
      ? "gleich viele"
      : `${Math.abs(net)} ${net < 0 ? "weniger" : "mehr"}`,
  listEmpty: "Die Liste ist leer: Das Modell hat alle Regeln gestrichen.",
  parseFailed: "Antwort nicht wie verlangt lesbar:",
  parseNote: "Hinweis:",
  testTitle: "Test: erstes Token je Stelle",
  thSite: "Stelle",
  thWanted: "verlangt",
  thTop1: "Top-1",
  thP: "P",
  thResult: "Ergebnis",
  stateObeyed: "✓ befolgt",
  stateNotObeyed: "✗ da, nicht befolgt",
  stateRemoved: "– gestrichen",
  stateError: "! Fehler",
  statePending: "…",
  testNote: "Eine Messung je Stelle (Seed 1000), nach jeder Runde.",
  chartTitle: "Befolgte Stellen je Runde",
  chartAria: (liveList: string, recorded: string) =>
    `Befolgte Stellen je Runde. Live: ${liveList || "noch keine Werte"}. Aufzeichnung: ${recorded}.`,
  legendLive: "live: befolgt",
  legendPresent: "live: Gebote da",
  legendRecorded: (id: string) => `Aufzeichnung ${id}`,
  chartNote:
    "Aufzeichnung nur nach Runde 1, 2, 4 und 6 getestet, live jede Runde.",
  foot: "Code und Fülltext aus Studie 9 · eine Kette, eine Messung je Stelle · nicht direkt mit der Aufzeichnung vergleichbar",
  sourcesButton: "ⓘ Quellen",
  sourcesAria: "Quellen und Einschränkungen anzeigen",
  sourcesScope: "Gilt für die Folie „Luna schreibt die Regeln um: live“.",
} as const;

/** Quellen und Einschränkungen des ⓘ-Modals. */
const SOURCES: readonly { href: string; label: string; note: string }[] = [
  {
    href: "https://github.com/geggo98/context-rot-experiments/tree/7e5e7c7/study9",
    label: "context-rot-experiments, Ordner study9",
    note: "Code der Studie, Commit 7e5e7c7 vom 26.11.2026 (https://github.com/geggo98/context-rot-experiments). Daraus stammen Prompts, Fülltext-Stücke, Antwort-Parser und Anfrage-Parameter des Live-Laufs",
  },
  {
    href: "https://github.com/geggo98/context-rot-experiments/blob/7e5e7c7/THIRD_PARTY_NOTICES.md",
    label: "context-rot-experiments: THIRD_PARTY_NOTICES.md",
    note: "Lizenzen des Fülltexts: Auszüge aus Apache Commons Lang (Apache-2.0), Texte von Project Gutenberg (gemeinfrei), eigener Java-Code des Studienautors (CC0). Hinweise im Deck: data/erosion/LIVE_CORPUS_NOTICE.md",
  },
  {
    href: "https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create",
    label: "OpenAI API: Create chat completion",
    note: "abgerufen 26.11.2026; Parameter reasoning_effort (Wert none), seed, logprobs, top_logprobs und service_tier. Laut Doku macht seed die Antworten nur nach Möglichkeit wiederholbar",
  },
  {
    href: "https://developers.openai.com/api/docs/guides/flex-processing",
    label: "OpenAI API: Flex processing",
    note: "abgerufen 26.11.2026; der Tarif hinter dem Haken „Flex“ (service_tier: flex)",
  },
];
const CAVEATS: readonly { lead: string; text: string }[] = [
  {
    lead: "Code der Studie, eigene Ziehung:",
    text: "Prompts, Fülltext-Stücke, Antwort-Parser und Anfrage-Parameter stammen aus dem Code von Studie 9 (context-rot-experiments, Commit 7e5e7c7 vom 26.11.2026, Ordner study9). Nur die Fülltext-Stücke zieht die Folie mit einem anderen Zufallsgenerator. Eine Live-Kette wiederholt deshalb keine aufgezeichnete Kette, und ihre Zahlen sind nicht direkt mit der Aufzeichnung vergleichbar.",
  },
  {
    lead: "Eine Kette, keine Wiederholung:",
    text: "Ein Lauf ist eine einzelne Kette mit einer Messung je Stelle. Einzelne Ketten streuen stark. In der Aufzeichnung (Luna, Auftrag „Neu schreiben“) verlieren 8 von 10 Ketten (80 %) an den vier testbaren Stellen. Im Mittel über die zehn Ketten fällt die Befolgung von 0,92 am Start auf 0,38 nach Runde 6. Ein einzelner Live-Lauf kann deutlich besser oder schlechter ausgehen.",
  },
  {
    lead: "Andere Stücke, vielleicht anderes Modell:",
    text: "Die Fülltext-Stücke werden in jeder Runde neu gezogen; ein fester Seed macht die Ziehung wiederholbar, aber nicht gleich der Studie. Die Studie lief immer mit Flex, live ist Flex wählbar. Die Aufzeichnung stammt vom 22.11.2026. Seitdem kann OpenAI das Modell hinter demselben Namen geändert haben.",
  },
  {
    lead: "Kosten sind geschätzt:",
    text: "Grundlage sind die Gesamtkosten der Studie laut Bericht, 1,1830 $ mit Flex, geteilt durch ihre 64 Ketten (Luna und Terra). Für Luna allein liegt die Schätzung eher zu hoch, weil Terra je Anfrage mehr kostet und die Studie je Kette mehr Stellen testete. Ohne Flex setzt die Folie den doppelten Preis an; das ist eine eigene Annahme, nicht gemessen. Die Dauer schätzt die Folie nicht.",
  },
  {
    lead: "Der Key bleibt im Browser:",
    text: "Der Key liegt nur im Speicher dieser Seite und geht nur an api.openai.com. Er wird nicht gespeichert und in Fehlermeldungen geschwärzt. Nach dem Neuladen der Seite ist er weg.",
  },
  {
    lead: "Nicht lesbare Antwort:",
    text: "Findet der Parser keine Nummern oder Spiegelstriche, wird wie in der Studie jede nicht leere Zeile zu einer Regel, und über der Liste steht ein Hinweis. Beim Auftrag „Nur Änderungen“ bleibt die Liste bei unlesbarem JSON unverändert; unbekannte Regelnummern ignoriert der Parser und nennt sie.",
  },
  {
    lead: "Test nach jeder Runde:",
    text: `Live wird die Liste nach jeder Runde getestet, zusammen ${(ROUNDS + 1) * LIVE_SITES.length} Testanfragen. Die Studie testete Luna nur nach den Runden 1, 2, 4 und 6; nur dort hat die aufgezeichnete Kurve Punkte.`,
  },
  {
    lead: "Nur vier Stellen, nur das erste Token:",
    text: `Getestet werden 4 der 18 Gebotsstellen (ca. 22 %): die, an denen Luna in der Studie die Originalliste befolgt (${LIVE_SITES.map((s) => s.id).join(", ")}), nur für die Gebote B und D. Die zwei Kontrollstellen fehlen. Gemessen ist nur das erste Token. „Gebote da“ heißt: Reguläre Ausdrücke finden Auslöser und Token in einer Regel.`,
  },
];

// ── Daten ────────────────────────────────────────────────────────────────
const data = study as unknown as Study9;
const P = useDeckPalette();
const { isDark } = useDarkMode();

const ARMS: readonly Arm[] = ["F", "C", "D", "N"];
const DEFAULT_MODEL = "gpt-5.6-luna";
/** Fester Seed der Fülltext-Ziehung, damit eine Kette wiederholbar ist. */
const CHAIN_SEED = 1000;
const N_SITES = LIVE_SITES.length;
const N_BEHAVIOURS = BEHAVIOUR_IDS.length;
const REWRITE_REQUESTS = ROUNDS;
const TEST_REQUESTS = (ROUNDS + 1) * N_SITES;

const armButton = (a: Arm): string =>
  TEXTS.armTag(labels.arms[a].short, labels.arms[a].tag);
const armLong = (a: Arm): string => labels.arms[a].long;

/** Erkennungs-Ausdrücke je Gebot, wie in `presentBehaviours` der Logik. */
const PRESENT_RE = (
  data.spec.behaviours as unknown as { id: BehaviourId; present: string[] }[]
).map((b) => ({ id: b.id, res: b.present.map((p) => new RegExp(p, "i")) }));
/** Nummern (ab 1) der Regeln, die ein Gebot tragen; für die Marke in der Liste. */
function presenceByRule(
  items: readonly string[],
): Record<BehaviourId, number[]> {
  const out = { A: [], B: [], C: [], D: [] } as Record<BehaviourId, number[]>;
  items.forEach((t, i) => {
    for (const b of PRESENT_RE) {
      if (b.res.every((r) => r.test(t))) out[b.id].push(i + 1);
    }
  });
  return out;
}

// ── Bedienung ────────────────────────────────────────────────────────────
const apiKey = ref("");
const model = ref(DEFAULT_MODEL);
const arm = ref<Arm>("F");
const flex = ref(false);
const sourcesOpen = ref(false);

const kType = computed(() => keyType(apiKey.value));
const keyPill = computed(() =>
  kType.value === "openai"
    ? TEXTS.keyPillOpenai
    : kType.value === null
      ? TEXTS.keyPillNone
      : TEXTS.keyPillOther,
);
const cost = computed(() => estimateChainCost({ flex: flex.value }));
const costLine = computed(() =>
  TEXTS.cost(REWRITE_REQUESTS, TEST_REQUESTS, formatUsd(cost.value.usd)),
);

// ── Lauf ─────────────────────────────────────────────────────────────────
type Phase = "idle" | "running" | "done" | "stopped" | "failed";
const phase = ref<Phase>("idle");
const events = shallowRef<RoundEvent[]>([]);
/** Auftrag des gezeigten Laufs; `arm` darf danach schon anders stehen. */
const runArm = ref<Arm>("F");
const errorText = ref("");
const seconds = ref(0);
const sel = ref(0);
/** Die Anzeige folgt der neuesten Runde, bis jemand eine Runde wählt. */
const follow = ref(true);
let abort: AbortController | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

const running = computed(() => phase.value === "running");
const canRun = computed(
  () => kType.value === "openai" && !!model.value.trim() && !running.value,
);
const lastRound = computed(() => Math.max(0, events.value.length - 1));

function stopTicker() {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
}

async function start() {
  if (!canRun.value) return;
  const key = apiKey.value.trim();
  const ctl = new AbortController();
  abort = ctl;
  events.value = [];
  errorText.value = "";
  seconds.value = 0;
  sel.value = 0;
  follow.value = true;
  runArm.value = arm.value;
  phase.value = "running";
  const t0 = performance.now();
  stopTicker();
  ticker = setInterval(() => {
    seconds.value = Math.round((performance.now() - t0) / 1000);
  }, 1000);
  let outcome: Phase = "done";
  try {
    // Der Korpus (450 KB) lädt erst hier, beim ersten Start; der Browser
    // hält ihn danach im Modul-Cache.
    const corpus = await loadCorpus();
    const sum = await runChain({
      provider: "openai",
      model: model.value.trim(),
      arm: runArm.value,
      flex: flex.value,
      seed: CHAIN_SEED,
      corpus,
      signal: ctl.signal,
      sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
      send: async (body, signal) => {
        const res = await fetch(`${ENDPOINT.openai}/chat/completions`, {
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
      onRound: (e) => {
        if (abort !== ctl) return;
        events.value = [...events.value, e];
        if (follow.value) sel.value = e.round;
      },
    });
    if (sum.error) {
      outcome = "failed";
      errorText.value = redactKeys(sum.error);
    } else if (sum.stopped) {
      outcome = "stopped";
    }
  } catch (e) {
    outcome = "failed";
    errorText.value = redactKeys((e as Error).message || String(e));
  }
  // Ein neuerer Lauf oder das Verlassen der Folie hat diesen abgelöst.
  if (abort !== ctl) return;
  abort = null;
  stopTicker();
  seconds.value = Math.round((performance.now() - t0) / 1000);
  phase.value = outcome;
}
function stop() {
  abort?.abort();
}
onBeforeUnmount(() => {
  const ctl = abort;
  abort = null;
  ctl?.abort();
  stopTicker();
});

const statusLine = computed(() => {
  switch (phase.value) {
    case "idle":
      return TEXTS.statusIdle;
    case "running":
      return events.value.length === 0
        ? TEXTS.statusStart(seconds.value)
        : TEXTS.statusRound(events.value.length, ROUNDS, seconds.value);
    case "done":
      return TEXTS.statusDone(seconds.value);
    case "stopped":
      return TEXTS.statusStopped(lastRound.value);
    default:
      return TEXTS.statusFailed(lastRound.value);
  }
});
const progress = computed(() =>
  phase.value === "idle" ? 0 : events.value.length / (ROUNDS + 1),
);

// ── Gewählte Runde ───────────────────────────────────────────────────────
type SiteState =
  | "obeyed"
  | "present-not-obeyed"
  | "removed"
  | "error"
  | "pending";
const STATE_TEXT: Record<SiteState, string> = {
  obeyed: TEXTS.stateObeyed,
  "present-not-obeyed": TEXTS.stateNotObeyed,
  removed: TEXTS.stateRemoved,
  error: TEXTS.stateError,
  pending: TEXTS.statePending,
};

function siteStates(e: RoundEvent): SiteState[] {
  return LIVE_SITES.map((s): SiteState => {
    const r = e.tests.find((t) => t.site === s.id)?.result;
    if (!r || r.top1 === null) return "error";
    if (obeys(r.top1, s.token)) return "obeyed";
    return e.present[s.behaviour] ? "present-not-obeyed" : "removed";
  });
}

const stepLabel = (r: number): string =>
  r === 0 ? TEXTS.stepStart : String(r);
const steps = computed(() =>
  Array.from({ length: ROUNDS + 1 }, (_, r) => {
    const e = events.value[r];
    const label = stepLabel(r);
    if (e) {
      return {
        round: r,
        label,
        status: "done" as const,
        dots: siteStates(e),
        aria: TEXTS.stepAria(label, e.obeyedCount, N_SITES),
      };
    }
    const active = running.value && r === events.value.length;
    return {
      round: r,
      label,
      status: active ? ("active" as const) : ("todo" as const),
      dots: LIVE_SITES.map((): SiteState => "pending"),
      aria: TEXTS.stepPending(label),
    };
  }),
);

/** Mausklick: Fokus abgeben, damit Slidev die Pfeiltasten behält. */
function release(e: Event) {
  if ((e as MouseEvent).detail > 0) {
    (e.currentTarget as HTMLElement | null)?.blur();
  }
}
function pick(r: number, e: Event) {
  sel.value = r;
  // Wer die neueste Runde wählt, folgt dem Lauf weiter.
  follow.value = r === lastRound.value;
  release(e);
}

const cur = computed(() => events.value[sel.value] ?? null);
const prev = computed(() =>
  sel.value > 0 ? (events.value[sel.value - 1] ?? null) : null,
);
/** Ohne Lauf zeigt die Liste die Originalliste als Vorschau. */
const items = computed(() => cur.value?.items ?? ORIGINAL_ITEMS);
const presence = computed(() => presenceByRule(items.value));
const diff = computed(() =>
  diffRules(prev.value?.items ?? null, items.value, presence.value),
);
const chips = computed(() =>
  data.spec.behaviours.map((b) => ({
    id: b.id,
    cue: b.cue.trim(),
    token: b.token,
    present: presence.value[b.id].length > 0,
  })),
);
const listTitle = computed(() =>
  sel.value === 0 ? TEXTS.listTitleStart : TEXTS.listTitleRound(sel.value),
);
const diffLine = computed(() => {
  if (!cur.value) return TEXTS.listPreview;
  if (sel.value === 0) return TEXTS.listOriginal;
  return null;
});
const parseLine = computed(() => {
  const p = cur.value?.parse;
  if (!p || (p.ok && !p.note)) return null;
  return {
    bad: !p.ok,
    text: `${p.ok ? TEXTS.parseNote : TEXTS.parseFailed} ${redactKeys(p.note)}`,
  };
});

const percent = (p: number): string => `${Math.round(p * 100)} %`;
const rows = computed(() => {
  const e = cur.value;
  const states = e ? siteStates(e) : null;
  return LIVE_SITES.map((s, i) => {
    const r = e?.tests.find((t) => t.site === s.id)?.result;
    return {
      site: s.id,
      behaviour: s.behaviour,
      token: s.token,
      top1: r?.top1 ?? null,
      p1: r?.p1 ?? null,
      error: r?.error ? redactKeys(r.error) : undefined,
      state: states ? states[i]! : ("pending" as SiteState),
    };
  });
});
const verdict = computed(() => {
  const e = cur.value;
  if (!e) return null;
  const states = siteStates(e);
  const state: SiteState = states.includes("present-not-obeyed")
    ? "present-not-obeyed"
    : states.includes("removed")
      ? "removed"
      : states.includes("error")
        ? "error"
        : "obeyed";
  return {
    state,
    obeyed: TEXTS.obeyed(e.obeyedCount, N_SITES),
    present: TEXTS.present(e.presentCount, N_BEHAVIOURS),
  };
});

// ── Diagramm: befolgte Stellen je Runde, live neben der Aufzeichnung ─────
const ex = data.example;
const recorded = data.chains[ex.model][ex.arm]?.find((c) => c.id === ex.chain);
const recordedSeries = recorded
  ? chainSeries(recorded).map((p) => ({
      round: p.round,
      v: p.value * N_SITES,
    }))
  : [];
const W = 250;
const H = 150;
const M = { l: 18, r: 8, t: 8, b: 16 };
const x = (r: number) => M.l + (r / ROUNDS) * (W - M.l - M.r);
const y = (v: number) => M.t + (1 - v / N_SITES) * (H - M.t - M.b);
const pts = (p: readonly { round: number; v: number }[]) =>
  p.map((q) => `${x(q.round).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ");
const Y_TICKS = Array.from({ length: N_SITES + 1 }, (_, i) => i);
const X_TICKS = Array.from({ length: ROUNDS + 1 }, (_, i) => i);
const recordedPts = pts(recordedSeries);
const liveSeries = computed(() =>
  events.value.map((e) => ({ round: e.round, v: e.obeyedCount })),
);
const livePts = computed(() => pts(liveSeries.value));
// Gebote und Stellen teilen die Achse nur, weil es von beiden vier gibt.
const presentPts = computed(() =>
  pts(
    events.value.map((e) => ({
      round: e.round,
      v: (e.presentCount / N_BEHAVIOURS) * N_SITES,
    })),
  ),
);
const chartAria = computed(() =>
  TEXTS.chartAria(
    liveSeries.value.map((p) => `${stepLabel(p.round)}: ${p.v}`).join(", "),
    recordedSeries
      .map((p) => `${stepLabel(p.round)}: ${Math.round(p.v)}`)
      .join(", "),
  ),
);
const recordedColor = computed(() => (isDark.value ? "#fbbf24" : "#b45309"));

// ── Tastatur ─────────────────────────────────────────────────────────────
/** Tasten in Textfeldern gehören dem Feld, nicht Slidev. Escape und Enter
 * geben den Fokus ab, damit die Pfeiltasten danach wieder blättern. */
function onRootKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (!(t instanceof HTMLInputElement)) return;
  if (t.type !== "text" && t.type !== "password") return;
  if (e.key === "Tab") return;
  if (e.key === "Escape" || e.key === "Enter") t.blur();
  e.stopPropagation();
}
</script>

<template>
  <div class="el" @keydown="onRootKey">
    <!-- Zeile 1: Key, Modell, Flex, Start -->
    <div class="el-bar">
      <label class="el-ctl">
        <span class="el-ctl-l">{{ TEXTS.keyLabel }}</span>
        <input
          v-model="apiKey"
          class="el-in el-key"
          type="password"
          autocomplete="off"
          spellcheck="false"
          data-lpignore="true"
          data-1p-ignore
          :placeholder="TEXTS.keyPlaceholder"
          :aria-label="TEXTS.keyAria"
          :disabled="running"
        />
      </label>
      <span class="el-pill" :class="{ ok: kType === 'openai' }">{{
        keyPill
      }}</span>
      <span class="el-key-note">{{ TEXTS.keyNote }}</span>
      <label class="el-ctl">
        <span class="el-ctl-l">{{ TEXTS.modelLabel }}</span>
        <input
          v-model="model"
          class="el-in el-model"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :aria-label="TEXTS.modelAria"
          :disabled="running"
        />
      </label>
      <label class="el-ctl el-check" :title="TEXTS.flexTitle">
        <input
          v-model="flex"
          type="checkbox"
          :disabled="running"
          @click="release"
        />
        {{ TEXTS.flexLabel }}
      </label>
      <span class="el-grow" />
      <button
        type="button"
        class="el-btn primary"
        :disabled="!canRun"
        @click="
          start();
          release($event);
        "
      >
        {{ phase === "idle" ? TEXTS.start : TEXTS.restart }}
      </button>
      <button
        type="button"
        class="el-btn"
        :disabled="!running"
        @click="
          stop();
          release($event);
        "
      >
        {{ TEXTS.abort }}
      </button>
    </div>

    <!-- Zeile 2: Auftrag und Kosten -->
    <div class="el-bar">
      <div class="el-ctl">
        <span class="el-ctl-l">{{ TEXTS.armLabel }}</span>
        <div class="el-seg" role="group" :aria-label="TEXTS.armAria">
          <button
            v-for="a in ARMS"
            :key="a"
            type="button"
            :class="{ on: arm === a }"
            :aria-pressed="arm === a"
            :title="armLong(a)"
            :disabled="running"
            @click="
              arm = a;
              release($event);
            "
          >
            {{ armButton(a) }}
          </button>
        </div>
      </div>
      <span class="el-cost" :title="cost.basis">{{ costLine }}</span>
    </div>

    <!-- Zeile 3: Stand oder Fehler; feste Höhe, damit nichts springt -->
    <div class="el-strip" :class="phase">
      <div v-if="errorText" class="el-err" role="alert">
        <b>{{ TEXTS.errorLead }}</b> {{ errorText }}
      </div>
      <div v-else class="el-status" role="status">{{ statusLine }}</div>
      <div class="el-prog" aria-hidden="true">
        <i :style="{ width: `${progress * 100}%` }" />
      </div>
    </div>

    <!-- Zeile 4: Runden, füllen sich im Lauf -->
    <div class="el-steps">
      <span class="el-ctl-l">{{ TEXTS.roundLabel }}</span>
      <div class="el-step-row" role="group" :aria-label="TEXTS.stepsAria">
        <button
          v-for="s in steps"
          :key="s.round"
          type="button"
          class="el-step"
          :class="[s.status, { on: s.round === sel && s.status === 'done' }]"
          :disabled="s.status !== 'done'"
          :aria-pressed="s.round === sel && s.status === 'done'"
          :aria-label="s.aria"
          @click="pick(s.round, $event)"
        >
          <span class="el-step-n">{{ s.label }}</span>
          <span class="el-dots">
            <i v-for="(d, i) in s.dots" :key="i" :class="d" />
          </span>
        </button>
      </div>
      <span v-if="verdict" class="el-verdict" :class="verdict.state">
        <b>{{ verdict.obeyed }}</b> · {{ verdict.present }}
      </span>
      <span v-else class="el-verdict pending">{{ TEXTS.notMeasured }}</span>
    </div>

    <div class="el-main">
      <!-- Regelliste der gewählten Runde -->
      <section class="el-panel">
        <div class="el-h">
          <span>{{ listTitle }}</span>
          <span class="el-h-v"
            >{{ TEXTS.rules(items.length) }} ·
            {{ labels.arms[runArm].short }}</span
          >
        </div>
        <div class="el-chips">
          <span class="el-chips-l">{{ TEXTS.chipsLabel }}</span>
          <span
            v-for="c in chips"
            :key="c.id"
            class="el-chip"
            :class="{ gone: !c.present }"
            :title="c.present ? TEXTS.chipPresent : TEXTS.chipGone"
          >
            <b>{{ c.id }}</b> {{ c.cue }}→{{ c.token }}
          </span>
        </div>
        <div v-if="diffLine" class="el-diff">{{ diffLine }}</div>
        <div v-else class="el-diff">
          {{ TEXTS.diffKept(diff.kept) }} · <span class="el-mark" />
          {{ TEXTS.diffChanged(diff.changed) }} · {{ TEXTS.diffNet(diff.net) }}
        </div>
        <div
          v-if="parseLine"
          class="el-parse"
          :class="{ bad: parseLine.bad }"
          :title="parseLine.text"
        >
          {{ parseLine.text }}
        </div>
        <ol class="el-rules">
          <li
            v-for="r in diff.rows"
            :key="r.n"
            :class="{ changed: r.changed, cmd: r.behaviour !== null }"
          >
            <span class="el-n">{{ r.n }}</span>
            <span class="el-b">{{ r.behaviour ?? "" }}</span>
            <span class="el-t"
              ><template v-for="(s, i) in codeSegments(r.text)" :key="i"
                ><code v-if="s.code">{{ s.text }}</code
                ><template v-else>{{ s.text }}</template></template
              ></span
            >
          </li>
          <li v-if="diff.rows.length === 0" class="el-empty">
            {{ TEXTS.listEmpty }}
          </li>
        </ol>
      </section>

      <!-- Test am ersten Token -->
      <section class="el-panel">
        <div class="el-h">
          <span>{{ TEXTS.testTitle }}</span>
        </div>
        <div class="el-tests" role="table">
          <div class="el-trow el-thead" role="row">
            <span role="columnheader">{{ TEXTS.thSite }}</span>
            <span role="columnheader">{{ TEXTS.thWanted }}</span>
            <span role="columnheader">{{ TEXTS.thTop1 }}</span>
            <span role="columnheader" class="num">{{ TEXTS.thP }}</span>
            <span role="columnheader" class="el-sr">{{ TEXTS.thResult }}</span>
          </div>
          <div v-for="r in rows" :key="r.site" class="el-site" role="row">
            <div class="el-trow">
              <span role="cell">{{ r.site }}</span>
              <span role="cell"
                >{{ r.behaviour }} <code>{{ r.token }}</code></span
              >
              <span role="cell" class="tok">
                <code v-if="r.top1 !== null">{{ r.top1 }}</code>
                <span v-else class="el-dim">–</span>
              </span>
              <span role="cell" class="num">{{
                r.p1 === null ? "–" : percent(r.p1)
              }}</span>
            </div>
            <div class="el-res" role="cell">
              <span class="el-pbar" aria-hidden="true">
                <i
                  :class="r.state"
                  :style="{ width: `${(r.p1 ?? 0) * 100}%` }"
                />
              </span>
              <span class="el-state" :class="r.state" :title="r.error">{{
                STATE_TEXT[r.state]
              }}</span>
            </div>
          </div>
        </div>
        <div class="el-note">{{ TEXTS.testNote }}</div>
      </section>

      <!-- Befolgt je Runde: live und Aufzeichnung -->
      <section class="el-panel">
        <div class="el-h">
          <span>{{ TEXTS.chartTitle }}</span>
        </div>
        <svg
          class="el-svg"
          :viewBox="`0 0 ${W} ${H}`"
          role="img"
          :aria-label="chartAria"
        >
          <g v-for="t in Y_TICKS" :key="`y${t}`">
            <line
              class="el-grid"
              :x1="M.l"
              :x2="W - M.r"
              :y1="y(t)"
              :y2="y(t)"
            />
            <text class="el-axis" :x="M.l - 5" :y="y(t) + 3" text-anchor="end">
              {{ t }}
            </text>
          </g>
          <text
            v-for="t in X_TICKS"
            :key="`x${t}`"
            class="el-axis"
            :class="{ cur: t === sel }"
            :x="x(t)"
            :y="H - 3"
            text-anchor="middle"
          >
            {{ stepLabel(t) }}
          </text>
          <line
            class="el-cursor"
            :x1="x(sel)"
            :x2="x(sel)"
            :y1="M.t"
            :y2="H - M.b"
          />
          <polyline class="el-rec" :points="recordedPts" />
          <circle
            v-for="p in recordedSeries"
            :key="`r${p.round}`"
            class="el-rec-dot"
            :cx="x(p.round)"
            :cy="y(p.v)"
            r="2"
          />
          <polyline class="el-pres" :points="presentPts" />
          <polyline class="el-live" :points="livePts" />
          <circle
            v-for="p in liveSeries"
            :key="`l${p.round}`"
            class="el-live-dot"
            :class="{ cur: p.round === sel }"
            :cx="x(p.round)"
            :cy="y(p.v)"
            :r="p.round === sel ? 4.5 : 3"
          />
        </svg>
        <div class="el-legend">
          <span><i class="el-sw live" />{{ TEXTS.legendLive }}</span>
          <span><i class="el-sw pres" />{{ TEXTS.legendPresent }}</span>
          <span
            ><i class="el-sw rec" />{{ TEXTS.legendRecorded(ex.chain) }}</span
          >
        </div>
        <div class="el-note">{{ TEXTS.chartNote }}</div>
      </section>
    </div>

    <div class="el-foot">
      <span>{{ TEXTS.foot }}</span>
      <button
        type="button"
        class="el-ib"
        :aria-label="TEXTS.sourcesAria"
        @click="
          sourcesOpen = true;
          release($event);
        "
      >
        {{ TEXTS.sourcesButton }}
      </button>
    </div>

    <SourcesPopover
      :open="sourcesOpen"
      :scope="TEXTS.sourcesScope"
      :sources="SOURCES"
      :caveats="CAVEATS"
      @close="sourcesOpen = false"
    />
  </div>
</template>

<style scoped>
/* Feste Gesamthöhe: Die Folie wächst weder mit der Liste noch mit einer
   Fehlermeldung (Overflow-Budget). Liste und Fehler rollen in ihrem Feld. */
.el {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 424px;
  color: v-bind("P.text");
  font-size: 10.5px;
  line-height: 1.3;
}
.el code {
  padding: 0 2px;
  font-family: var(--slidev-code-font-family, ui-monospace, Menlo, monospace);
  font-size: 0.95em;
  border-radius: 3px;
  background: v-bind("P.headerBg");
  color: var(--color-text-primary);
  white-space: pre;
}
.el-dim {
  color: v-bind("P.labelColor");
}
.el-grow {
  flex: 1;
}

/* ── Bedienung ── */
.el-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 24px;
  min-width: 0;
}
.el-ctl {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.el-ctl-l {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
}
.el-in {
  height: 20px;
  padding: 0 6px;
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  background: v-bind("P.bg");
  font: inherit;
  color: var(--color-text-primary);
}
.el-in:disabled,
.el-seg button:disabled,
.el-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.el-key {
  width: 120px;
}
.el-model {
  width: 128px;
  font-family: var(--slidev-code-font-family, ui-monospace, Menlo, monospace);
  font-size: 9.5px;
}
.el-pill {
  padding: 0 6px;
  font-size: 9.5px;
  line-height: 15px;
  white-space: nowrap;
  border: 1px solid v-bind("P.border");
  border-radius: 9px;
  color: v-bind("P.labelColor");
}
.el-pill.ok {
  border-color: v-bind("P.badgeGreenText");
  background: v-bind("P.badgeGreenBg");
  color: v-bind("P.badgeGreenText");
}
.el-key-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.5px;
  color: v-bind("P.labelColor");
}
.el-check input {
  accent-color: v-bind("P.accentViolet");
}
.el-btn {
  flex: none;
  height: 20px;
  padding: 0 10px;
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  background: v-bind("P.bg");
  font: inherit;
  color: v-bind("P.text");
  white-space: nowrap;
  cursor: pointer;
}
.el-btn.primary {
  border-color: v-bind("P.accentViolet");
  background: v-bind("P.accentViolet");
  font-weight: 600;
  color: v-bind("P.bg");
}
.el-seg {
  display: inline-flex;
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  overflow: hidden;
}
.el-seg button {
  padding: 2px 8px;
  border: none;
  border-right: 1px solid v-bind("P.border");
  background: v-bind("P.bg");
  font-size: 10.5px;
  line-height: 1.3;
  color: v-bind("P.text");
  white-space: nowrap;
  cursor: pointer;
}
.el-seg button:last-child {
  border-right: none;
}
.el-seg button.on {
  background: v-bind("P.accentViolet");
  color: v-bind("P.bg");
  font-weight: 600;
}
.el-cost {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  white-space: nowrap;
  font-size: 9.5px;
  color: v-bind("P.descColor");
}
.el-in:focus-visible,
.el-btn:focus-visible,
.el-seg button:focus-visible,
.el-step:focus-visible,
.el-ib:focus-visible,
.el-check input:focus-visible {
  outline: 2px solid v-bind("P.accentViolet");
  outline-offset: 1px;
}

/* ── Stand oder Fehler: immer 30 px, eine Fehlermeldung rollt darin ── */
.el-strip {
  flex: none;
  position: relative;
  height: 30px;
  padding: 2px 8px 5px;
  overflow: hidden;
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 6px;
  background: v-bind("P.headerBg");
}
.el-strip.failed {
  border-color: v-bind("P.badgeRedText");
  background: v-bind("P.badgeRedBg");
}
.el-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 22px;
  color: var(--color-text-primary);
}
.el-err {
  height: 100%;
  overflow-y: auto;
  overflow-wrap: anywhere;
  font-size: 9.5px;
  line-height: 11.5px;
  color: v-bind("P.badgeRedText");
}
.el-prog {
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  background: v-bind("P.border");
}
.el-prog i {
  display: block;
  height: 100%;
  background: v-bind("P.accentViolet");
  transition: width 0.3s ease;
}
.el-strip.failed .el-prog i {
  background: v-bind("P.badgeRedText");
}

/* ── Runden ── */
.el-steps {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
}
.el-step-row {
  display: flex;
  gap: 4px;
}
.el-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 58px;
  height: 32px;
  padding: 0;
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  background: v-bind("P.bg");
  font: inherit;
  color: var(--color-text-primary);
  cursor: pointer;
}
.el-step-n {
  font-size: 10px;
  font-weight: 600;
  line-height: 11px;
}
.el-step.todo,
.el-step.active {
  border-style: dashed;
  color: v-bind("P.labelColor");
  cursor: default;
}
.el-step.active {
  border-color: v-bind("P.accentViolet");
  animation: el-pulse 1.2s ease-in-out infinite;
}
.el-step.on {
  border-color: v-bind("P.accentViolet");
  box-shadow: inset 0 0 0 1px v-bind("P.accentViolet");
  background: v-bind("P.headerBg");
}
@keyframes el-pulse {
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .el-step.active {
    animation: none;
  }
  .el-prog i {
    transition: none;
  }
}
/* Ein Punkt je Teststelle. Form und Farbe tragen den Zustand gemeinsam:
   voll = befolgt, Ring = da und nicht befolgt, Strich = gestrichen. */
.el-dots {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 8px;
}
.el-dots i {
  box-sizing: border-box;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.el-dots .obeyed {
  background: v-bind("P.accentGreen");
}
.el-dots .present-not-obeyed {
  border: 2px solid v-bind("P.badgeRedText");
}
.el-dots .removed {
  height: 2px;
  border-radius: 1px;
  background: v-bind("P.badgeGrayText");
}
.el-dots .error {
  border-radius: 1px;
  background: v-bind("P.badgeYellowText");
}
.el-dots .pending {
  border: 1px dotted v-bind("P.labelColor");
}
.el-verdict {
  margin-left: auto;
  font-size: 11.5px;
  white-space: nowrap;
  color: v-bind("P.descColor");
}
.el-verdict.obeyed b {
  color: v-bind("P.badgeGreenText");
}
.el-verdict.present-not-obeyed b {
  color: v-bind("P.badgeRedText");
}
.el-verdict.removed b {
  color: v-bind("P.badgeGrayText");
}
.el-verdict.error b {
  color: v-bind("P.badgeYellowText");
}
.el-verdict.pending {
  font-size: 10px;
  color: v-bind("P.labelColor");
}

/* ── Drei Felder ── */
.el-main {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.9fr) minmax(0, 1fr);
  gap: 8px;
}
.el-panel {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  min-height: 0;
  padding: 5px 8px;
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
  overflow: hidden;
}
.el-h {
  flex: none;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
  white-space: nowrap;
}
.el-h-v {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-text-primary);
}
.el-chips {
  flex: none;
  display: flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
}
.el-chips-l {
  margin-right: 1px;
  font-size: 9.5px;
  white-space: nowrap;
  color: v-bind("P.descColor");
}
.el-chip {
  padding: 0 4px;
  font-family: var(--slidev-code-font-family, ui-monospace, Menlo, monospace);
  font-size: 9px;
  line-height: 1.5;
  white-space: nowrap;
  border: 1px solid v-bind("P.accentViolet");
  border-radius: 9px;
  color: var(--color-text-primary);
}
.el-chip b {
  color: v-bind("P.accentViolet");
}
.el-chip.gone {
  border-style: dashed;
  border-color: v-bind("P.border");
  color: v-bind("P.labelColor");
  text-decoration: line-through;
}
.el-chip.gone b {
  color: v-bind("P.badgeRedText");
}
.el-diff,
.el-parse {
  flex: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.5px;
  color: v-bind("P.descColor");
}
.el-parse {
  color: v-bind("P.badgeYellowText");
}
.el-parse.bad {
  color: v-bind("P.badgeRedText");
}
.el-mark {
  display: inline-block;
  width: 3px;
  height: 9px;
  vertical-align: -1px;
  background: v-bind(recordedColor);
}
.el-rules {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  border-top: 1px solid v-bind("P.border");
}
.el-rules li {
  display: grid;
  grid-template-columns: 14px 10px minmax(0, 1fr);
  gap: 3px;
  margin: 0;
  padding: 0 0 0 4px;
  font-size: 9.5px;
  line-height: 13px;
  color: v-bind("P.descColor");
  border-left: 3px solid transparent;
}
.el-rules code {
  line-height: 0;
}
.el-rules li.changed {
  border-left-color: v-bind(recordedColor);
}
.el-rules li.cmd {
  color: var(--color-text-primary);
  background: v-bind("P.hoverBg");
}
.el-rules li.el-empty {
  display: block;
  padding-top: 4px;
}
.el-n {
  text-align: right;
  color: v-bind("P.labelColor");
}
.el-b {
  font-weight: 700;
  color: v-bind("P.accentViolet");
}

/* ── Test: je Stelle eine Zeile mit Werten und eine mit Balken und Zustand.
   Raster aus div statt table, damit die Tabellen-Styles des Themes nicht
   greifen und die Zeilenhöhe fest bleibt. ── */
.el-tests {
  flex: none;
  font-size: 9.5px;
  line-height: 15px;
}
.el-trow {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) minmax(0, 1fr) 34px;
  gap: 4px;
  white-space: nowrap;
}
.el-thead {
  padding-bottom: 1px;
  font-size: 9px;
  font-weight: 600;
  color: v-bind("P.labelColor");
  border-bottom: 1px solid v-bind("P.border");
}
.el-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.el-site {
  padding: 2px 0 3px;
  border-bottom: 1px solid v-bind("P.border");
}
.el-tests .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.el-tests .tok {
  overflow: hidden;
  text-overflow: ellipsis;
}
.el-res {
  display: flex;
  align-items: center;
  gap: 6px;
}
.el-pbar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: v-bind("P.border");
  overflow: hidden;
}
.el-pbar i {
  display: block;
  height: 100%;
  background: v-bind("P.badgeGrayText");
  transition: width 0.3s ease;
}
.el-pbar i.obeyed {
  background: v-bind("P.accentGreen");
}
.el-pbar i.present-not-obeyed {
  background: v-bind("P.badgeRedText");
}
.el-state {
  flex: none;
  min-width: 96px;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 600;
  line-height: 13px;
  text-align: center;
  color: v-bind("P.labelColor");
}
.el-state.obeyed {
  background: v-bind("P.badgeGreenBg");
  color: v-bind("P.badgeGreenText");
}
.el-state.present-not-obeyed {
  background: v-bind("P.badgeRedBg");
  color: v-bind("P.badgeRedText");
}
.el-state.removed {
  background: v-bind("P.badgeGrayBg");
  color: v-bind("P.badgeGrayText");
}
.el-state.error {
  background: v-bind("P.badgeYellowBg");
  color: v-bind("P.badgeYellowText");
}
.el-note {
  flex: none;
  margin-top: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  color: v-bind("P.labelColor");
}

/* ── Diagramm. Schriftgrößen nur per CSS: ein font-size-Attribut am SVG-Text
   würde UnoCSS als Attributify-Regel lesen. ── */
.el-svg {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 0;
}
.el-grid {
  stroke: v-bind("P.border");
  stroke-width: 0.6;
}
.el-axis {
  font-size: 9.5px;
  fill: v-bind("P.labelColor");
}
.el-axis.cur {
  font-weight: 700;
  fill: v-bind("P.accentViolet");
}
.el-cursor {
  stroke: v-bind("P.accentViolet");
  stroke-width: 0.8;
  stroke-dasharray: 2 2;
  opacity: 0.6;
}
.el-rec {
  fill: none;
  stroke: v-bind(recordedColor);
  stroke-width: 1.2;
  stroke-dasharray: 4 3;
}
.el-rec-dot {
  fill: v-bind(recordedColor);
}
.el-pres {
  fill: none;
  stroke: v-bind("P.labelColor");
  stroke-width: 1.2;
  stroke-dasharray: 1.5 2.5;
}
.el-live {
  fill: none;
  stroke: v-bind("P.accentViolet");
  stroke-width: 2.2;
  stroke-linejoin: round;
}
.el-live-dot {
  fill: v-bind("P.accentViolet");
  stroke: v-bind("P.bg");
  stroke-width: 1.2;
}
.el-legend {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: 9px;
  color: v-bind("P.labelColor");
  white-space: nowrap;
}
.el-sw {
  display: inline-block;
  width: 14px;
  height: 0;
  margin-right: 3px;
  vertical-align: middle;
  border-top: 2px solid v-bind("P.accentViolet");
}
.el-sw.pres {
  border-top: 2px dotted v-bind("P.labelColor");
}
.el-sw.rec {
  border-top: 2px dashed v-bind(recordedColor);
}

.el-foot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 14px;
  font-size: 9.5px;
  white-space: nowrap;
  color: v-bind("P.labelColor");
}
.el-foot > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.el-ib {
  flex: none;
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.el-ib:hover {
  color: var(--color-text-primary);
}
</style>
