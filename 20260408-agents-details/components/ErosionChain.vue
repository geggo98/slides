<script setup lang="ts">
// Folie „Luna schreibt die Regeln um“ (pages/erosion-luna.md).
//
// Zeigt die aufgezeichneten Ketten von Studie 9: Ein Modell schreibt seine
// eigene Regelliste sechsmal um, danach misst die Studie das erste Token an
// den testbaren Stellen. Die Folie ruft kein Modell auf. Alle Messwerte kommen
// aus data/erosion/study9-chain.json (gebaut von data/erosion/build.ts, dort
// gegen den Bericht der Studie geprüft); die Rechenhilfen stehen in
// lib/erosionChainLogic.ts.
//
// Fest im Text stehen nur die Zahlen der fremden Arbeiten. Sie stammen aus dem
// Faktencheck vom 22.11.2026 (Belegzeilen aus den Primärquellen):
// arXiv 2602.11988 „reduced by 0.5% and 2%“ für LLM-erzeugte Kontextdateien,
// „improve agent performance by 2.4% on average (p=21%), significantly
// outperforming LLM-generated ones (p=3.8%)“ für die von Entwicklern.
//
// Der Leitsatz unten ist eine Empfehlung des Vortrags, kein Messergebnis. Die
// Folie kennzeichnet ihn so, und das ⓘ-Modal nennt die Gegenseite.
import { computed, ref, watch } from "vue";
import { useDarkMode } from "@slidev/client";
import study from "../data/erosion/study9-chain.json";
import labels from "../data/erosion/chain-labels.json";
import SourcesPopover from "./SourcesPopover.vue";
import { useDeckPalette } from "./palette";
import {
  aggregateSeries,
  chainSeries,
  codeSegments,
  diffRules,
  formatDe,
  formatShare,
  isPresent,
  lossSummary,
  testRows,
  type Arm,
  type ModelId,
  type Study9,
} from "./lib/erosionChainLogic";

const data = study as unknown as Study9;
const ex = data.example;
const P = useDeckPalette();
const { isDark } = useDarkMode();
const sourcesOpen = ref(false);

const MODELS: readonly ModelId[] = ["luna", "terra"];
const ARMS: readonly Arm[] = ["F", "C", "D", "N"];
const MODEL_LABEL: Record<ModelId, string> = { luna: "Luna", terra: "Terra" };
// Sprechende Namen der Arme und Stichworte der Ketten aus
// data/erosion/chain-labels.json. Die Datenschlüssel F/C/D/N bleiben im Code,
// auf der Folie stehen sie nicht: Dort heißen A bis D die vier Gebote. Ein Arm
// heißt auf der Folie „Auftrag“, weil er die Anweisung ist, nach der das Modell
// umschreibt.
const ARM_SHORT = (a: Arm): string => labels.arms[a].short;
/** Name für den Knopf; die Kopierkontrolle trägt dort den Zusatz „(Kontrolle)“. */
const ARM_BUTTON = (a: Arm): string => {
  const { short, tag } = labels.arms[a];
  return tag ? `${short} (${tag})` : short;
};
const ARM_LONG = (a: Arm): string => labels.arms[a].long;
const chainKeyword = (id: string): string =>
  (labels.chains as Record<string, Record<string, Record<string, string>>>)[
    model.value
  ]?.[arm.value]?.[chainNo(id)] ?? "";
const ROUNDS = data.spec.design.rounds;

// Start: die Beispielkette in der ersten Runde, in der Luna an keiner der
// testbaren Stellen mehr folgt, obwohl alle Gebote in der Liste stehen
// (Runde 2). So zeigt die Folie beim Öffnen den Verlust, den der Titel nennt.
// Gibt es keine solche Runde, startet sie nach der letzten.
const model = ref<ModelId>(ex.model);
const arm = ref<Arm>(ex.arm);
const chainIdx = ref(
  Math.max(
    0,
    data.chains[ex.model][ex.arm]?.findIndex((c) => c.id === ex.chain) ?? 0,
  ),
);
const round = ref(
  data.chains[ex.model][ex.arm]?.[chainIdx.value]?.rounds.find(
    (r) => r.round > 0 && r.obeyTestable === 0,
  )?.round ?? ROUNDS,
);

/** Ketten der Auswahl. Für Terra enthalten die Daten nur den Arm „Neu schreiben“ (F). */
const chains = computed(() => data.chains[model.value][arm.value] ?? []);
watch(chains, (list) => {
  if (chainIdx.value >= list.length) chainIdx.value = 0;
});
const chain = computed(() => chains.value[chainIdx.value] ?? null);
const cur = computed(() => chain.value?.rounds[round.value] ?? null);
const prev = computed(() =>
  round.value > 0 ? (chain.value?.rounds[round.value - 1] ?? null) : null,
);
const chainNo = (id: string) => id.slice(-2);
const chainOption = (id: string) => {
  const base = `${chainNo(id)} · ${chainKeyword(id)}`;
  return model.value === ex.model && arm.value === ex.arm && id === ex.chain
    ? `${base} (Beispiel)`
    : base;
};
const isExample = computed(
  () =>
    model.value === ex.model &&
    arm.value === ex.arm &&
    chain.value?.id === ex.chain,
);

const roundLabel = computed(() =>
  round.value === 0 ? "am Start (Original)" : `nach Runde ${round.value}`,
);

// ── Regelliste und Diff zur Vorrunde ────────────────────────────────────
const listOf = (key: string | undefined) =>
  key === undefined ? null : (data.lists[key] ?? null);

const diff = computed(() => {
  const c = cur.value;
  const list = listOf(c?.list);
  if (!c || !list) return null;
  return diffRules(listOf(prev.value?.list), list, c.present);
});

/** Vergleich mit der Vorrunde in drei kurzen Teilen; `null` für die Originalliste. */
const diffLine = computed(() => {
  const d = diff.value;
  if (!d || round.value === 0) return null;
  const abs = Math.abs(d.net);
  return {
    kept: `${d.kept} wörtlich wie ${round.value === 1 ? "im Original" : `in Runde ${round.value - 1}`}`,
    changed: `${d.changed} umformuliert oder neu`,
    net:
      d.net === 0
        ? "gleich viele Regeln"
        : `${abs} ${abs === 1 ? "Regel" : "Regeln"} ${d.net < 0 ? "weniger" : "mehr"}`,
  };
});

const chips = computed(() =>
  data.spec.behaviours.map((b) => ({
    id: b.id,
    cue: b.cue.trim(),
    token: b.token,
    present: cur.value ? isPresent(cur.value.present[b.id]) : false,
  })),
);

// ── Test am ersten Token ────────────────────────────────────────────────
const rows = computed(() => {
  const c = cur.value;
  if (!c || model.value !== "luna") return null;
  return testRows(data.chains.lunaTestSites, c.tests, c.present);
});
const obeyedLine = computed(() => {
  const r = rows.value;
  if (!r) return null;
  const n = r.filter((x) => x.state === "obeyed").length;
  return `${n} von ${r.length} befolgt`;
});
/** Der Befund der gewählten Runde in einem Satz, mit der Farbe des Zustands. */
const verdict = computed(() => {
  const r = rows.value;
  if (!r) return null;
  const count = (s: (typeof r)[number]["state"]) =>
    r.filter((x) => x.state === s).length;
  const notObeyed = count("present-not-obeyed");
  const removed = count("removed");
  if (notObeyed > 0) {
    return {
      state: "present-not-obeyed",
      text: `Steht da, wird aber nicht befolgt: ${notObeyed} von ${r.length}`,
    };
  }
  if (removed > 0) {
    return {
      state: "removed",
      text: `Regel fehlt in der Liste: ${removed} von ${r.length}`,
    };
  }
  return { state: "obeyed", text: `An allen ${r.length} Stellen befolgt` };
});
const STATE_TEXT = {
  obeyed: "✓ befolgt",
  "present-not-obeyed": "✗ da, nicht befolgt",
  removed: "– gestrichen",
} as const;
const testedRounds = computed(() =>
  data.spec.design.testedRounds[model.value].join(", "),
);

const agg = computed(() => data.aggregate[model.value].arms[arm.value]);
/** Zahl der testbaren Stellen des gewählten Modells (Luna 4, Terra 17). */
const nSites = computed(() => data.aggregate[model.value].testableSites.length);
const aggRound = computed(() => agg.value[round.value] ?? null);
const summary = computed(() => lossSummary(agg.value));

const pct = (p: number): string => `${Math.round(p * 100)} %`;
/** Wahrscheinlichkeiten an der Beispielstelle; nur für die Beispielkette. */
const exampleLine = computed(() => {
  if (!isExample.value) return null;
  const t = ex.rounds.find((r) => r.round === round.value)?.test[0];
  if (!t) return null;
  // Das Beispiel nennt eines der vier Gebote aus spec.behaviours.
  const wanted = data.spec.behaviours.find((b) => b.id === ex.behaviour)!.token;
  const pOf = (tok: string) => t.top5.find(([k]) => k === tok)?.[1];
  const pGold = pOf(ex.noRules.top1);
  const pWanted = pOf(wanted);
  return {
    site: ex.site.id,
    wanted,
    pWanted: pWanted === undefined ? null : pct(pWanted),
    gold: ex.noRules.top1,
    pGold: pGold === undefined ? null : pct(pGold),
    pNoRules: pct(ex.noRules.p1),
  };
});

// ── Diagramm: Mittel über alle Ketten, Band, gewählte Kette ──────────────
const W = 245;
// Höhe passend zum Platz im Feld: Sonst verkleinert das SVG sich und mit ihm
// die Achsenschrift.
const H = 82;
const M = { l: 25, r: 8, t: 6, b: 15 };
const x = (r: number) => M.l + (r / ROUNDS) * (W - M.l - M.r);
const y = (v: number) => M.t + (1 - v) * (H - M.t - M.b);
const pts = (p: readonly { round: number; v: number }[]) =>
  p.map((q) => `${x(q.round).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ");

const series = computed(() => aggregateSeries(agg.value));
const meanPts = computed(() =>
  pts(series.value.map((p) => ({ round: p.round, v: p.mean }))),
);
const bandPts = computed(() =>
  pts([
    ...series.value.map((p) => ({ round: p.round, v: p.hi })),
    ...[...series.value].reverse().map((p) => ({ round: p.round, v: p.lo })),
  ]),
);
const otherModel = computed<ModelId>(() =>
  model.value === "luna" ? "terra" : "luna",
);
const otherPts = computed(() =>
  pts(
    aggregateSeries(data.aggregate[otherModel.value].arms[arm.value]).map(
      (p) => ({ round: p.round, v: p.mean }),
    ),
  ),
);
const chainDots = computed(() =>
  chain.value
    ? chainSeries(chain.value).map((p) => ({
        cx: x(p.round),
        cy: y(p.value),
        current: p.round === round.value,
      }))
    : [],
);
const chainPts = computed(() =>
  chainDots.value.map((d) => `${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(" "),
);
const Y_TICKS = [0, 0.5, 1];
const X_TICKS = Array.from({ length: ROUNDS + 1 }, (_, i) => i);
const chainColor = computed(() => (isDark.value ? "#fbbf24" : "#b45309"));

const moveLine = computed(() => {
  const s = summary.value;
  return `Start → Runde ${s.lastRound}: ${formatDe(s.from)} → ${formatDe(s.to)}`;
});
const lossLine = computed(() => {
  const s = summary.value;
  return `Verlust in ${formatShare(s.chainsWithLoss, s.chains, "Ketten")}`;
});

// ── Zahlen für die Begründung und die Grenzen ────────────────────────────
const lunaErosion = (a: Arm) =>
  formatDe(lossSummary(data.aggregate.luna.arms[a]).erosion);
const terraWorst = formatDe(
  Math.max(
    ...ARMS.map((a) =>
      Math.abs(lossSummary(data.aggregate.terra.arms[a]).erosion),
    ),
  ),
);
const lunaSites = formatShare(
  data.aggregate.luna.testableSites.length,
  Object.keys(data.spec.sites).length,
);
const fLoss = lossSummary(data.aggregate.luna.arms.F);
const fLossShare = formatShare(fLoss.chainsWithLoss, fLoss.chains, "Ketten");
// Befolgung über alle 18 Gebotsstellen; Runde 0 und die letzte Runde sind bei
// Luna getestet (spec.design.testedRounds), die Werte sind dort nie null.
const fAll = data.aggregate.luna.arms.F;
const lunaAllSites = `${formatDe(fAll[0]!.obeyAll!)} auf ${formatDe(fAll[ROUNDS]!.obeyAll!)}`;

const sources = [
  {
    href: "https://arxiv.org/abs/2602.11988",
    label: "Evaluating AGENTS.md (arXiv 2602.11988)",
    note: "v3 vom 29.09.2026; SWE-bench Lite mit LLM-erzeugten Dateien, 138 Instanzen mit Entwickler-Dateien, je ein Lauf",
  },
  {
    href: "https://arxiv.org/abs/2610.30571",
    label: "Stale Instruction Files Override the Code (arXiv 2610.30571)",
    note: "22.10.2026; 40 konstruierte Python-Projekte, 90,1 % der Entscheidungen folgen der veralteten Datei",
  },
  {
    href: "https://arxiv.org/abs/2404.03114",
    label:
      "Effect of Code Documentation on LLM Code Understanding (arXiv 2404.03114)",
    note: "03.04.2024; falsche Docstrings schaden, fehlende kaum; GPT-3.5 und GPT-4",
  },
  {
    href: "https://arxiv.org/abs/2510.04618",
    label: "ACE: Agentic Context Engineering (arXiv 2510.04618)",
    note: "Preprint; Context Collapse beim vollständigen Neuschreiben, Abhilfe: inkrementelle Updates mit getrennten Rollen",
  },
  {
    href: "https://arxiv.org/abs/2604.28031",
    label: "DriftBench (arXiv 2604.28031)",
    note: "Preprint; Modelle geben eine Vorgabe richtig wieder und verletzen sie trotzdem. Nur eine Analogie zu „da, aber nicht befolgt“",
  },
];

const caveats = [
  {
    lead: "Eigene Studie 9, aufgezeichnet:",
    text: `Luna ist ${data.source.models.luna}, Terra ${data.source.models.terra}. Jedes Modell schreibt seine eigene Liste um und wird danach mit ihr getestet. Zwischen den Regeln steht in jeder Runde frischer Fülltext. Die Originalliste (auf der Folie „Start“) hat 20 Regeln: vier Gebote in je zwei Formulierungen und 12 allgemeine Richtlinien. Die Folie ruft kein Modell auf.`,
  },
  {
    lead: "Nur 4 testbare Luna-Stellen:",
    text: `Testbar ist eine Stelle, an der das Modell die Originalliste in mindestens 2 von 3 Seeds befolgt. Bei Luna sind das ${lunaSites}, nur für die Gebote B und D. Die Stellen sind mit denselben drei Seeds ausgewählt, die den Ausgangswert liefern; der Verlust ist deshalb eher überschätzt. Über alle 18 Stellen fällt Luna beim Auftrag „${ARM_SHORT("F")}“ nur von ${lunaAllSites}.`,
  },
  {
    lead: "Eine Messung je Liste und Stelle:",
    text: "Jede umgeschriebene Liste wurde einmal getestet (Seed 1000), einzelne Ketten sind deshalb grob. Der Start einer Kette zeigt ebenfalls Seed 1000; der Ausgangswert im Diagramm ist das Mittel über drei Seeds. Luna wurde nach den Runden 1, 2, 4 und 6 getestet, Terra nach 3 und 6.",
  },
  {
    lead: "Nur das erste Token:",
    text: "Gemessen ist, mit welchem Token das Modell die Fortsetzung beginnt. Ob es danach Regeln befolgt, ist nicht gemessen.",
  },
  {
    lead: "Regeln aus Vorlagen:",
    text: "Vier Gebote der Form „nach X beginne mit T“. Echte Regeldateien klingen anders und enthalten andere Regelarten.",
  },
  {
    lead: "Dasselbe Modell schreibt um und wird getestet:",
    text: "Ein Modell, das die Liste eines anderen umschreibt, ist nicht untersucht. Wenige Ketten: Luna 10, Terra 6 je Auftrag, zwei Modelle eines Herstellers.",
  },
  {
    lead: "„Steht in der Liste“ ist nur Text:",
    text: "Ein Gebot gilt als vorhanden, wenn eine Regel Auslöser und Token nennt (reguläre Ausdrücke). Ob Luna die Regel wiedergeben kann, ist nicht geprüft. Die Markierung „umformuliert oder neu“ vergleicht den Wortlaut mit der Vorrunde.",
  },
  {
    lead: "Band im Diagramm:",
    text: "95-%-Intervall der Erosion aus 10 000 Bootstrap-Ziehungen über die Ketten, verschoben um den Ausgangswert der Originalliste.",
  },
  {
    lead: "Beispielkette:",
    text: `Kette 00 des Auftrags „Neu schreiben“ ist die erste der zehn Ketten und nachträglich als Beispiel gewählt, nicht nach dem Ergebnis. Ihr Verlust ist typisch: ${fLossShare} verlieren an den vier testbaren Stellen.`,
  },
  {
    lead: "Auftrag „Nur Änderungen“ und ACE:",
    text: "Der Auftrag „Nur Änderungen“ ist eine vereinfachte Form der ACE-Abhilfe: ein einzelnes Modell entscheidet selbst, was überflüssig ist, ohne getrennte Rollen. Inhalte und Maß unterscheiden sich von ACE. ACE ist damit weder reproduziert noch widerlegt.",
  },
  {
    lead: "Der Leitsatz ist eine Empfehlung:",
    text: "Keine Arbeit misst, ob der Autor „an der Quelle sitzt“. In arXiv 2602.11988 liegen Entwickler-Dateien vor den LLM-erzeugten (p = 3,8 %); gegenüber gar keiner Datei ist keiner der beiden Effekte signifikant, und für Claude Code helfen auch die Entwickler-Dateien nicht. Gegenbeispiel aus der Praxis: OpenAI beschreibt im Bericht „Harness Engineering“ (11.02.2026), dass Codex die Doku schreibt und Linter und ein Pflege-Agent sie aktuell halten.",
  },
];
</script>

<template>
  <div class="ec">
    <div class="ec-controls">
      <div class="ec-ctl">
        <span class="ec-ctl-l">Modell</span>
        <div class="ec-seg" role="group" aria-label="Modell">
          <button
            v-for="m in MODELS"
            :key="m"
            :class="{ on: model === m }"
            :aria-pressed="model === m"
            @click="model = m"
          >
            {{ MODEL_LABEL[m] }}
          </button>
        </div>
      </div>
      <div class="ec-ctl">
        <span class="ec-ctl-l">Auftrag</span>
        <div
          class="ec-seg"
          role="group"
          aria-label="Auftrag an das Modell beim Umschreiben"
        >
          <button
            v-for="a in ARMS"
            :key="a"
            :class="{ on: arm === a }"
            :aria-pressed="arm === a"
            :title="ARM_LONG(a)"
            :aria-label="ARM_LONG(a)"
            @click="arm = a"
          >
            {{ ARM_BUTTON(a) }}
          </button>
        </div>
      </div>
      <label class="ec-ctl ec-ctl-round">
        <span class="ec-ctl-l">Runde</span>
        <input
          v-model.number="round"
          class="ec-range"
          type="range"
          min="0"
          :max="ROUNDS"
          step="1"
          aria-label="Runde, 0 ist die Originalliste"
        />
        <span class="ec-ctl-v ec-round-v">{{
          round === 0 ? "Start" : `${round} von ${ROUNDS}`
        }}</span>
      </label>
    </div>
    <!-- Zweite Zeile: Die Kettenauswahl ist zu breit für die erste. -->
    <div class="ec-controls">
      <label class="ec-ctl">
        <span class="ec-ctl-l">Kette</span>
        <select
          v-model.number="chainIdx"
          class="ec-select"
          :disabled="chains.length === 0"
        >
          <option
            v-for="(c, i) in chains"
            :key="c.id"
            :value="i"
            :title="chainOption(c.id)"
          >
            {{ chainOption(c.id) }}
          </option>
        </select>
      </label>
      <span class="ec-hint">
        <b>x von {{ nSites }}:</b> an so vielen der {{ nSites }} Teststellen
        befolgt · <b>„ohne Gebote“:</b> die Regeln fehlen in der Liste ·
        <b>„bei 0 von {{ nSites }}“:</b> die Regeln stehen da, befolgt wird
        keine
      </span>
    </div>

    <div class="ec-main">
      <!-- Regelliste der gewählten Runde -->
      <section class="ec-panel ec-list-panel">
        <div class="ec-h">
          <span>Regelliste {{ roundLabel }}</span>
          <span v-if="cur" class="ec-h-v">
            {{ cur.rules }} {{ cur.rules === 1 ? "Regel" : "Regeln" }}
            <template v-if="cur.wordsPerRule !== null">
              · {{ formatDe(cur.wordsPerRule, 1) }} Wörter je Regel
            </template>
          </span>
        </div>
        <template v-if="cur">
          <div class="ec-chips" aria-label="Gebote in der Liste">
            <span class="ec-chips-l">In der Liste:</span>
            <span
              v-for="c in chips"
              :key="c.id"
              class="ec-chip"
              :class="{ gone: !c.present }"
              :title="c.present ? 'steht in der Liste' : 'gestrichen'"
            >
              <b>{{ c.id }}</b> {{ c.cue }}→{{ c.token }}
            </span>
          </div>
          <template v-if="diff">
            <div v-if="diffLine" class="ec-diff">
              {{ diffLine.kept }} · <span class="ec-mark" />
              {{ diffLine.changed }} · {{ diffLine.net }}
            </div>
            <div v-else class="ec-diff">
              Ausgangsliste vor dem ersten Umschreiben
            </div>
            <ol class="ec-rules">
              <li
                v-for="r in diff.rows"
                :key="r.n"
                :class="{ changed: r.changed, cmd: r.behaviour !== null }"
              >
                <span class="ec-n">{{ r.n }}</span>
                <span class="ec-b">{{ r.behaviour ?? "" }}</span>
                <span class="ec-t"
                  ><template v-for="(s, i) in codeSegments(r.text)" :key="i"
                    ><code v-if="s.code">{{ s.text }}</code
                    ><template v-else>{{ s.text }}</template></template
                  ></span
                >
              </li>
              <li v-if="diff.rows.length === 0" class="ec-empty">
                Die Liste ist leer: Das Modell hat alle Regeln gestrichen.
              </li>
            </ol>
          </template>
          <div v-else class="ec-nolist">
            <p>
              Den Wortlaut der Listen enthält die Aufzeichnung nur für Luna,
              Auftrag „Neu schreiben“. Hier: Regelzahl, Wörter je Regel und
              welche Gebote noch stehen.
            </p>
            <p class="ec-instr-h">
              Anweisung „{{ ARM_SHORT(arm) }}“, wörtlich:
            </p>
            <p class="ec-instr">{{ data.spec.arms[arm].instruction }}</p>
          </div>
        </template>
        <div v-else class="ec-nolist">
          <p>
            Für {{ MODEL_LABEL[model] }} enthält die Aufzeichnung nur die Ketten
            des Auftrags „Neu schreiben“. Das Diagramm rechts zeigt das Mittel
            über alle {{ agg[0]!.chains }} Ketten dieses Auftrags.
          </p>
        </div>
      </section>

      <!-- Test am ersten Token -->
      <section class="ec-panel ec-test-panel">
        <div class="ec-h">
          <span>Test: erstes Token</span>
          <span v-if="obeyedLine" class="ec-h-v">{{ obeyedLine }}</span>
        </div>
        <template v-if="rows">
          <div v-if="verdict" class="ec-verdict" :class="verdict.state">
            {{ verdict.text }}
          </div>
          <table class="ec-tests">
            <thead>
              <tr>
                <th>Stelle</th>
                <th>verlangt</th>
                <th>Top-1</th>
                <th>Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.site">
                <td>{{ r.site }}</td>
                <td>
                  {{ r.behaviour }} <code>{{ r.token }}</code>
                </td>
                <td>
                  <code>{{ r.top1 }}</code>
                </td>
                <td>
                  <span class="ec-state" :class="r.state">{{
                    STATE_TEXT[r.state]
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
        <div v-else-if="cur && model === 'luna'" class="ec-line ec-dim">
          Nach Runde {{ round }} nicht getestet. Luna: getestet nach den Runden
          {{ testedRounds }}.
        </div>
        <div v-else-if="cur" class="ec-line">
          <template v-if="cur.obeyTestable !== null">
            Befolgung an den
            {{ data.aggregate[model].testableSites.length }} testbaren Stellen:
            <b>{{ formatDe(cur.obeyTestable) }}</b
            >. Einzelwerte je Stelle enthält die Aufzeichnung nur für Luna.
          </template>
          <span v-else class="ec-dim">
            Nach Runde {{ round }} nicht getestet. {{ MODEL_LABEL[model] }}:
            getestet nach den Runden {{ testedRounds }}.
          </span>
        </div>
        <div v-if="isExample" class="ec-example">
          <b>Beispielkette, nachträglich gewählt.</b>
          <template v-if="exampleLine">
            Stelle {{ exampleLine.site }}: Luna beginnt
            <template v-if="exampleLine.pGold"
              >zu {{ exampleLine.pGold }}</template
            >
            mit <code>{{ exampleLine.gold }}</code
            ><template v-if="exampleLine.pWanted"
              >, zu {{ exampleLine.pWanted }} mit dem verlangten
              <code>{{ exampleLine.wanted }}</code></template
            >. Ganz ohne Regeln: zu {{ exampleLine.pNoRules }} mit
            <code>{{ exampleLine.gold }}</code
            >.
          </template>
        </div>
      </section>

      <!-- Mittel über alle Ketten -->
      <section class="ec-panel ec-chart-panel">
        <div class="ec-h">
          <span
            >Befolgung · {{ MODEL_LABEL[model] }}, {{ ARM_SHORT(arm) }}</span
          >
        </div>
        <svg
          class="ec-svg"
          :viewBox="`0 0 ${W} ${H}`"
          role="img"
          :aria-label="`Befolgung testbar je Runde, ${MODEL_LABEL[model]}, ${ARM_SHORT(arm)}. ${moveLine}. ${lossLine}.`"
        >
          <g v-for="t in Y_TICKS" :key="`y${t}`">
            <line
              class="ec-grid"
              :x1="M.l"
              :x2="W - M.r"
              :y1="y(t)"
              :y2="y(t)"
            />
            <text class="ec-axis" :x="M.l - 4" :y="y(t) + 3" text-anchor="end">
              {{ formatDe(t, t === 0.5 ? 1 : 0) }}
            </text>
          </g>
          <text
            v-for="t in X_TICKS"
            :key="`x${t}`"
            class="ec-axis"
            :class="{ cur: t === round }"
            :x="x(t)"
            :y="H - 2"
            text-anchor="middle"
          >
            {{ t === 0 ? "Start" : t }}
          </text>
          <line
            class="ec-cursor"
            :x1="x(round)"
            :x2="x(round)"
            :y1="M.t"
            :y2="H - M.b"
          />
          <polygon class="ec-band" :points="bandPts" />
          <polyline class="ec-other" :points="otherPts" />
          <polyline class="ec-mean" :points="meanPts" />
          <circle
            v-for="p in series"
            :key="`m${p.round}`"
            class="ec-mean-dot"
            :cx="x(p.round)"
            :cy="y(p.mean)"
            r="2"
          />
          <polyline
            v-if="chainDots.length"
            class="ec-chain"
            :points="chainPts"
          />
          <circle
            v-for="(d, i) in chainDots"
            :key="`c${i}`"
            class="ec-chain-dot"
            :class="{ cur: d.current }"
            :cx="d.cx"
            :cy="d.cy"
            :r="d.current ? 4 : 2"
          />
        </svg>
        <div class="ec-legend">
          <span><i class="ec-sw ec-sw-mean" />Mittel</span>
          <span><i class="ec-sw ec-sw-band" />95-%-Intervall</span>
          <span v-if="chain"
            ><i class="ec-sw ec-sw-chain" />Kette {{ chainNo(chain.id) }}</span
          >
          <span
            ><svg class="ec-sw-svg" viewBox="0 0 16 6" aria-hidden="true">
              <line class="ec-other" x1="0" y1="3" x2="16" y2="3" /></svg
            >{{ MODEL_LABEL[otherModel] }}</span
          >
        </div>
        <div class="ec-sum">{{ moveLine }}</div>
        <div class="ec-sum">{{ lossLine }}</div>
        <div
          v-if="aggRound && aggRound.presentNotObeyed !== null"
          class="ec-line"
        >
          Runde {{ round }}, Anteil „da, nicht befolgt“:
          <b>{{ formatDe(aggRound.presentNotObeyed) }}</b>
        </div>
      </section>
    </div>

    <div class="ec-thesis">
      <div class="ec-thesis-q">
        „Doku, auch Regeln, sollte schreiben, wer an der Quelle sitzt. Aktuell
        ist das der Mensch.“
      </div>
      <div class="ec-thesis-row">
        <span class="ec-thesis-q"
          >„Keine Doku ist besser als falsche Doku.“</span
        >
        <span class="ec-thesis-tag"
          >Schlussfolgerung und Empfehlung, kein Studienergebnis</span
        >
      </div>
    </div>

    <div class="ec-cards">
      <div class="ec-card">
        <div class="ec-card-h">Begründung</div>
        <ul>
          <li>
            <b>Studie 9:</b> Umschreiben kostet Luna die Befolgung:
            {{ ARM_SHORT("F") }} {{ lunaErosion("F") }}, {{ ARM_SHORT("C") }}
            {{ lunaErosion("C") }}, {{ ARM_SHORT("D") }} {{ lunaErosion("D") }}.
          </li>
          <li>
            <b>arXiv 2602.11988:</b> LLM-erzeugte Kontextdateien senken den
            Erfolg leicht (−0,5 % und −2 %), von Entwicklern geschriebene heben
            ihn leicht (+2,4 %, p = 0,21). Beides nicht signifikant.
          </li>
          <li>
            <b>Forschung:</b> Veraltete Regeldateien überstimmen den Code
            (2610.30571, Vorfolie); falsche Doku schadet, fehlende kaum
            (2404.03114, GPT-3.5 und GPT-4).
          </li>
        </ul>
      </div>
      <div class="ec-card">
        <div class="ec-card-h">Gegenseite und Grenzen</div>
        <ul>
          <li>
            Doku-Entwürfe vom Agenten sind sinnvoll, wenn ein Mensch an der
            Quelle sitzt und freigibt.
          </li>
          <li>
            Terra erodiert nicht (Verlust höchstens {{ terraWorst }}). ACE ist
            weder reproduziert noch widerlegt.
          </li>
          <li>
            Kleine Studie: nur {{ lunaSites }} Luna-Stellen testbar, ausgewählt
            nach Befolgung der Originalliste; nur erstes Token; Regeln aus
            Vorlagen; dasselbe Modell schreibt um und wird getestet.
          </li>
        </ul>
      </div>
    </div>

    <div class="ec-foot">
      <span
        >Eigene Studie 9: Das Modell schreibt seine Regelliste sechsmal um ·
        aufgezeichnete Daten, kein Live-Aufruf · Stand 22.11.2026</span
      >
      <button
        class="ec-ib"
        aria-label="Quellen und Einschränkungen anzeigen"
        @click="sourcesOpen = true"
      >
        ⓘ Quellen
      </button>
    </div>

    <SourcesPopover
      :open="sourcesOpen"
      scope="Gilt für die Folie Luna schreibt die Regeln um. Messwerte: eigene Studie 9, aufgezeichnet. Fremde Arbeiten: Faktencheck vom 22.11.2026."
      :sources="sources"
      :caveats="caveats"
      @close="sourcesOpen = false"
    />
  </div>
</template>

<style scoped>
.ec {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: v-bind("P.text");
  font-size: 10.5px;
  line-height: 1.3;
}
.ec code {
  padding: 0 2px;
  font-family: var(--slidev-code-font-family, ui-monospace, Menlo, monospace);
  font-size: 0.95em;
  border-radius: 3px;
  background: v-bind("P.headerBg");
  color: var(--color-text-primary);
  white-space: pre;
}

/* ── Bedienung ── */
.ec-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 24px;
}
.ec-ctl {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.ec-ctl-round {
  flex: 1;
  min-width: 0;
}
.ec-hint {
  flex: 1;
  min-width: 0;
  font-size: 9.5px;
  line-height: 12px;
  color: v-bind("P.descColor");
}
.ec-hint b {
  font-weight: 600;
  color: var(--color-text-primary);
}
.ec-ctl-l {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
}
.ec-ctl-v {
  font-size: 10.5px;
  color: v-bind("P.descColor");
}
.ec-round-v {
  min-width: 44px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.ec-seg {
  display: inline-flex;
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  overflow: hidden;
}
.ec-seg button {
  padding: 2px 8px;
  border: none;
  border-right: 1px solid v-bind("P.border");
  background: v-bind("P.bg");
  font-size: 10.5px;
  line-height: 1.3;
  color: v-bind("P.text");
  cursor: pointer;
}
.ec-seg button:last-child {
  border-right: none;
}
.ec-seg button.on {
  background: v-bind("P.accentViolet");
  color: v-bind("P.bg");
  font-weight: 600;
}
.ec-seg button:focus-visible,
.ec-select:focus-visible,
.ec-range:focus-visible,
.ec-ib:focus-visible {
  outline: 2px solid v-bind("P.accentViolet");
  outline-offset: 1px;
}
.ec-select {
  max-width: 330px;
  padding: 1px 4px;
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  background: v-bind("P.bg");
  font-size: 10.5px;
  color: v-bind("P.text");
}
.ec-range {
  flex: 1;
  min-width: 60px;
  accent-color: v-bind("P.accentViolet");
}

/* ── Drei Felder; feste Höhe, damit die Folie nicht mit dem Inhalt wächst
   (Overflow-Budget). Die Regelliste scrollt in ihrem Feld. ── */
.ec-main {
  display: grid;
  grid-template-columns: minmax(0, 1.44fr) minmax(0, 0.92fr) minmax(0, 1fr);
  gap: 8px;
  height: 172px;
}
.ec-panel {
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
.ec-h {
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
.ec-h-v {
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-text-primary);
}
.ec-chips {
  display: flex;
  align-items: center;
  gap: 3px;
}
.ec-chips-l {
  margin-right: 1px;
  font-size: 9.5px;
  white-space: nowrap;
  color: v-bind("P.descColor");
}
.ec-chip {
  padding: 0 4px;
  font-family: var(--slidev-code-font-family, ui-monospace, Menlo, monospace);
  font-size: 9px;
  line-height: 1.5;
  white-space: nowrap;
  border: 1px solid v-bind("P.accentViolet");
  border-radius: 9px;
  color: var(--color-text-primary);
}
.ec-chip b {
  color: v-bind("P.accentViolet");
}
.ec-chip.gone {
  border-style: dashed;
  border-color: v-bind("P.border");
  color: v-bind("P.labelColor");
  text-decoration: line-through;
}
.ec-chip.gone b {
  color: v-bind("P.badgeRedText");
}
.ec-diff {
  font-size: 9.5px;
  color: v-bind("P.descColor");
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ec-mark {
  display: inline-block;
  width: 3px;
  height: 9px;
  vertical-align: -1px;
  background: v-bind(chainColor);
}
/* Höhe auf ganze Zeilen gerastet (8 Zeilen à 13 px plus Trennlinie), damit
   keine Regel mitten in der Zeile abgeschnitten wird; beim Rollen rastet die
   Liste ebenfalls auf Zeilen. */
.ec-rules {
  flex: none;
  height: calc(8 * 13px + 1px);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  list-style: none;
  border-top: 1px solid v-bind("P.border");
}
.ec-rules li {
  display: grid;
  grid-template-columns: 14px 10px minmax(0, 1fr);
  gap: 3px;
  margin: 0;
  padding: 0 0 0 4px;
  font-size: 9.5px;
  line-height: 13px;
  color: v-bind("P.descColor");
  border-left: 3px solid transparent;
  scroll-snap-align: start;
}
/* Code-Stücke dürfen die Zeile nicht über 13 px heben, sonst stimmt das
   Raster der Listenhöhe nicht. */
.ec-rules code {
  line-height: 0;
}
.ec-rules li.changed {
  border-left-color: v-bind(chainColor);
}
.ec-rules li.cmd {
  color: var(--color-text-primary);
  background: v-bind("P.hoverBg");
}
.ec-rules li.ec-empty {
  display: block;
  padding-top: 4px;
}
.ec-n {
  text-align: right;
  color: v-bind("P.labelColor");
}
.ec-b {
  font-weight: 700;
  color: v-bind("P.accentViolet");
}
.ec-nolist {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 10px;
  color: v-bind("P.descColor");
}
.ec-nolist p {
  margin: 0 0 3px;
  line-height: 1.35;
}
.ec-instr-h {
  font-weight: 600;
  color: var(--color-text-primary);
}
.ec-instr {
  font-size: 9.5px;
  font-style: italic;
}

.ec-tests {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5px;
  line-height: 1.3;
}
.ec-tests th {
  padding: 0 4px 1px 0;
  text-align: left;
  font-size: 9px;
  font-weight: 600;
  color: v-bind("P.labelColor");
  border-bottom: 1px solid v-bind("P.border");
}
.ec-tests td {
  padding: 1px 4px 1px 0;
  white-space: nowrap;
  border-bottom: 1px solid v-bind("P.border");
}
.ec-verdict {
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.ec-verdict.obeyed {
  color: v-bind("P.badgeGreenText");
}
.ec-verdict.present-not-obeyed {
  color: v-bind("P.badgeRedText");
}
.ec-verdict.removed {
  color: v-bind("P.badgeGrayText");
}
.ec-state {
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 600;
}
.ec-state.obeyed {
  background: v-bind("P.badgeGreenBg");
  color: v-bind("P.badgeGreenText");
}
.ec-state.present-not-obeyed {
  background: v-bind("P.badgeRedBg");
  color: v-bind("P.badgeRedText");
}
.ec-state.removed {
  background: v-bind("P.badgeGrayBg");
  color: v-bind("P.badgeGrayText");
}
.ec-line {
  font-size: 9.5px;
  color: v-bind("P.descColor");
}
.ec-chart-panel .ec-line {
  white-space: nowrap;
}
.ec-line b {
  color: var(--color-text-primary);
}
.ec-dim {
  color: v-bind("P.labelColor");
}
.ec-example {
  margin-top: auto;
  padding-top: 2px;
  font-size: 9.5px;
  line-height: 1.3;
  color: v-bind("P.descColor");
  border-top: 1px dashed v-bind("P.border");
}
.ec-example b {
  color: v-bind(chainColor);
}

/* ── Diagramm. Schriftgrößen nur per CSS: ein font-size-Attribut am SVG-Text
   würde UnoCSS als Attributify-Regel lesen. ── */
.ec-svg {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 0;
}
.ec-grid {
  stroke: v-bind("P.border");
  stroke-width: 0.6;
}
.ec-axis {
  font-size: 9.5px;
  fill: v-bind("P.labelColor");
}
.ec-axis.cur {
  font-weight: 700;
  fill: v-bind(chainColor);
}
.ec-cursor {
  stroke: v-bind(chainColor);
  stroke-width: 0.8;
  stroke-dasharray: 2 2;
  opacity: 0.7;
}
.ec-band {
  fill: v-bind("P.accentViolet");
  opacity: 0.18;
}
.ec-mean {
  fill: none;
  stroke: v-bind("P.accentViolet");
  stroke-width: 1.8;
}
.ec-mean-dot {
  fill: v-bind("P.accentViolet");
}
.ec-other {
  fill: none;
  stroke: v-bind("P.labelColor");
  stroke-width: 1.2;
  stroke-dasharray: 4 3;
}
.ec-chain {
  fill: none;
  stroke: v-bind(chainColor);
  stroke-width: 1;
}
.ec-chain-dot {
  fill: v-bind(chainColor);
}
.ec-chain-dot.cur {
  stroke: v-bind("P.bg");
  stroke-width: 1.2;
}
.ec-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0 6px;
  font-size: 9px;
  color: v-bind("P.labelColor");
  white-space: nowrap;
}
.ec-sw {
  display: inline-block;
  width: 12px;
  height: 0;
  margin-right: 3px;
  vertical-align: middle;
  border-top: 2px solid v-bind("P.accentViolet");
}
.ec-sw-band {
  height: 7px;
  border-top: none;
  background: v-bind("P.accentViolet");
  opacity: 0.25;
}
.ec-sw-chain {
  border-top-color: v-bind(chainColor);
}
/* Vergleichsmodell: dieselbe gestrichelte Linie wie im Diagramm. */
.ec-sw-svg {
  display: inline-block;
  width: 16px;
  height: 6px;
  margin-right: 3px;
  vertical-align: middle;
}
.ec-sum {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Leitsatz ── */
.ec-thesis {
  padding: 4px 12px 5px;
  border-left: 4px solid v-bind("P.accentViolet");
  border-radius: 6px;
  background: v-bind("P.headerBg");
}
.ec-thesis-q {
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text-primary);
}
.ec-thesis-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.ec-thesis-tag {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  white-space: nowrap;
  color: v-bind("P.accentViolet");
}

.ec-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ec-card {
  padding: 4px 10px 5px;
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
}
.ec-card-h {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
}
.ec-card ul {
  margin: 0;
  padding-left: 13px;
  list-style: disc;
}
.ec-card li {
  margin: 0;
  padding: 0;
  font-size: 10px;
  line-height: 1.3;
  color: v-bind("P.descColor");
}
.ec-card li b {
  color: var(--color-text-primary);
}

.ec-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9.5px;
  color: v-bind("P.labelColor");
}
.ec-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.ec-ib:hover {
  color: var(--color-text-primary);
}
</style>
