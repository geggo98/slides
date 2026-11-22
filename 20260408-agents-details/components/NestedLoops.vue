<script setup lang="ts">
import { computed, ref } from "vue";
import { useDarkMode } from "@slidev/client";
import TalkXref from "@shared/components/TalkXref.vue";
import SourcesPopover from "./SourcesPopover.vue";
import { useDeckPalette } from "./palette";

// Fünf geschachtelte Schleifen als Kosten-Modell. Reveal über Slidev-Clicks
// (<NestedLoops :clicks="$clicks" /> mit clicks: 6 im Frontmatter):
// Klick 0 = alle Ebenen neutral, 1–5 = Ebene innen→außen aktiv + Hebel-Panel,
// 6 = Formel-Streifen + Merksatz. Zusätzlich sind die Kästen selbst klickbar
// (Selbststudium) — eine manuelle Auswahl überlagert den Klick-Zustand.
//
// Klick 7 (optional, `clicks: 7`) blendet eine SECHSTE Schicht ein: Workflows,
// also der Fan-out auf Subagenten. Die Folie heißt weiter „Die fünf
// Schleifen“: Bis Klick 6 ist die Schicht nicht im Layout (kein Rahmen, kein
// Padding, kein Header), die Folie sieht aus wie vor der Erweiterung. Wer den
// Zusatz nicht zeigen will, hört nach Klick 6 auf.
//
// Wo die Schicht sitzt: zwischen /goal und Agent-Loop.
//  - INNERHALB von /goal, /loop und Nutzer-Versuchen, weil der Agent den
//    Fan-out selbst mitten in einem Turn auslöst. Kein Timer und kein Mensch
//    startet ihn, und jeder weitere Turn, Run oder Versuch kann ihn erneut
//    auslösen. Die drei äußeren Schleifen multiplizieren ihn also.
//  - AUSSERHALB des Agent-Loops, weil jeder Subagent eine vollständige eigene
//    Agent-Schleife fährt, mit eigenem Kontextfenster und eigenem Bootstrap.
//    Der Fan-out vervielfacht ganze Agent-Loops, nicht einzelne Iterationen.
// Vereinfachung des Bildes: Genau genommen ist es Rekursion. Der Agent-Loop
// des Hauptagenten ruft den Fan-out als Tool auf, und Subagenten dürfen selbst
// wieder Subagenten starten. Die Kästen falten das zu einem Faktor auf den
// Agent-Loop; die Formel bleibt so ein Produkt.
// Die Zahlen der Schicht stammen aus der Recherche vom 22.11.2026 (Quellen und
// Grenzen der Vergleichbarkeit: `WF_SOURCES`, `WF_CAVEATS`).
const props = defineProps<{ clicks?: number }>();
const c = computed(() => props.clicks ?? 0);

const { isDark } = useDarkMode();
const pal = useDeckPalette();

// Reihenfolge: innen → außen (Index 0 = innerste Schleife).
const LEVELS = [
  {
    id: "token",
    emoji: "⚡",
    name: "Token-Loop",
    code: "while (!EOS) nextToken()",
    mult: "Ø-Tokens",
    driver:
      "Autoregression: jedes Token ein Forward-Pass. Je länger Frage, Denken und Antwort, desto mehr Tokens.",
    lever:
      "Knappe Prompts, fokussierte Antworten, Thinking-Budget bewusst setzen.",
    ref: "Kap. 2 — Autoregression",
  },
  {
    id: "agent",
    emoji: "🔄",
    name: "Agent-Loop",
    code: "while (toolCalls) {",
    mult: "× Iterationen",
    driver:
      "Jede Iteration schickt den kompletten Context erneut — und er wächst mit jedem Tool-Ergebnis.",
    lever: "Cache (90 % Discount), Context-Hygiene, Skills statt MCP-Bloat.",
    ref: "Kap. 3, 4 & 6",
  },
  {
    id: "goal",
    emoji: "🎯",
    name: "/goal (Bedingung)",
    code: "until (goalErreicht) {",
    mult: "× Turns",
    driver:
      "Wiederholt Turns, bis das Ziel erreicht ist — Haiku prüft nach jedem Turn.",
    lever:
      "Präzise, konkrete, überschaubare, erreichbare Ziele → weniger Turns bis „done“.",
    ref: "",
  },
  {
    id: "loop",
    emoji: "⏱",
    name: "/loop (Zeit)",
    code: "loop (alle <intervall>) {",
    mult: "× Runs",
    driver:
      "Cron-artiges Wiederauslösen: Anzahl und Frequenz der Runs multiplizieren alles darunter.",
    lever:
      "Frequenz bewusst wählen — Intervall über der Cache-TTL (5 min) heißt: jeder Run startet cache-kalt.",
    ref: "",
  },
  {
    id: "user",
    emoji: "👤",
    name: "Nutzer-Versuche",
    code: "for (versuch of versuche) {",
    mult: "× Versuche",
    driver:
      "Der teuerste Loop läuft am Schreibtisch: jeder verworfene Durchlauf zahlt alles darunter noch einmal.",
    lever:
      "Klare Aufgabenstellung + Plan-Mode (opusplan): das erste Ergebnis verwertbar machen.",
    ref: "Kap. 6 — opusplan",
  },
] as const;

// Zusatzschicht (Klick 7). Bewusst nicht in LEVELS: Sie ist keine der fünf
// Kernschleifen und hat ein eigenes Panel (Hebel als Liste, Belegzeile).
const WF_INDEX = 5;
const WF = {
  emoji: "🧩",
  name: "Workflows (Fan-out)",
  code: "parallel (sub of subagenten) {",
  mult: "× Fan-out",
  driver:
    "Der Agent startet selbst Subagenten. Jeder fährt eine eigene Agent-Schleife mit eigenem Bootstrap-Context: System-Prompt, Tools und CLAUDE.md lädt er in der Regel neu.",
  levers: [
    "Fan-out nur für unabhängige Teilaufgaben",
    "Kleines Modell für Subagenten",
    "Knappe Rückgabe: Summary statt Protokoll",
    "Obergrenze für Anzahl und Parallelität",
    "Bootstrap klein halten, Cache nutzen",
  ],
} as const;

const WF_SOURCES = [
  {
    href: "https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them",
    label: "Anthropic: When to use multi-agent systems",
    note: "23.01.2026 — 3–10× mehr Token als ein Einzelagent bei gleicher Aufgabe",
  },
  {
    href: "https://code.claude.com/docs/en/costs.md",
    label: "Claude-Code-Doku: Manage costs effectively",
    note: "abgerufen 22.11.2026 — Agent Teams ≈ 7× einer normalen Sitzung, im Plan Mode",
  },
  {
    href: "https://www.castaldosolutions.it/articles/en/blog/subagenti-claude-code-consumo-e-limiti",
    label: "Castaldo Solutions: Claude Code Subagents",
    note: "05.09.2026 — 858 Läufe, 94,4 % der Token sind erneut gelesener Kontext",
  },
  {
    href: "https://www.anthropic.com/engineering/multi-agent-research-system",
    label: "Anthropic Engineering: Multi-agent research system",
    note: "13.06.2025 — 15× gegenüber Chat, 4× für einen Einzelagenten",
  },
  {
    href: "https://arxiv.org/html/2606.05670v2",
    label: "Do More Agents Help? (arXiv:2606.05670)",
    note: "v2 vom 09.10.2026 — sechs Frameworks, 0,33× bis 4,34× des Einzelagenten",
  },
  {
    href: "https://arxiv.org/html/2512.08296v2",
    label: "Towards a Science of Scaling Agent Systems (arXiv:2512.08296)",
    note: "v2 vom 17.12.2025 — 1,6–6,2× Token-Budget bei gleicher Leistung",
  },
  {
    href: "https://code.claude.com/docs/en/workflows.md",
    label: "Claude-Code-Doku: Dynamic workflows",
    note: "abgerufen 22.11.2026 — 16 Agenten gleichzeitig, 1 000 je Lauf, Warnung ab 25",
  },
] as const;

const WF_CAVEATS = [
  {
    lead: "Vergleichbar (Baseline Einzelagent, gleiche Aufgabe):",
    text: "Anthropic 3–10×, Agent Teams ≈ 7×, die beiden Preprints 1,6–6,2× und 1,27–4,34×. Typisch sind also rund 3- bis 7-mal so viele Token.",
  },
  {
    lead: "Nicht vergleichbar:",
    text: "Die oft zitierten 15× messen gegen einen Chat, nicht gegen einen Einzelagenten. Die 94 % sind ein Anteil, kein Faktor.",
  },
  {
    lead: "Kein Faktor für Coding-Subagenten:",
    text: "Weder Claude Code noch Codex beziffern Subagenten oder Workflows. Die ≈ 7× gelten für Agent Teams im Plan Mode, ohne Angabe der Teamgröße. Anthropic legt zu den 3–10× weder Aufgaben noch Modelle offen.",
  },
  {
    lead: "Nicht immer mehr:",
    text: "Im Preprint „Do More Agents Help?“ brauchen 3 von 6 Frameworks (50 %) weniger Token als der Einzelagent, ein Claude-Code-Workflow auf GAIA ca. 0,12×, dort mit GPT-4.1 und unter anderen Laufzeitbedingungen. Die Architektur entscheidet, die Agentenzahl allein nicht.",
  },
  {
    lead: "Token sind nicht Kosten:",
    text: "Die 94 % sind Cache-Reads und kosten ca. ein Zehntel des Input-Preises. Ein Token-Faktor von 4× ist deshalb kein Kostenfaktor von 4×. Die Messung stammt von einer Person an einem Rechner.",
  },
] as const;

const manual = ref<number | null>(null);
const sourcesOpen = ref(false);
const clickLevel = computed(() =>
  c.value >= 1 && c.value <= 5 ? c.value - 1 : null,
);
// Die Workflow-Schicht existiert erst ab Klick 7 — vorher ist sie weder
// sichtbar noch anklickbar.
const wfShown = computed(() => c.value >= 7);
const active = computed(() => {
  const m = manual.value;
  if (m !== null && (m !== WF_INDEX || wfShown.value)) return m;
  return clickLevel.value;
});
const activeLevel = computed(() => {
  const a = active.value;
  return a === null || a === WF_INDEX ? null : LEVELS[a]!;
});
// Finale: alle Ebenen eingefärbt + Formel sichtbar (manuelle Auswahl gewinnt).
const finale = computed(() => c.value >= 6 && active.value === null);
const showFormula = computed(() => c.value >= 6);
// Workflow-Panel: per Klick 7 (solange nichts manuell gewählt ist) oder per
// Tipp auf den Workflow-Kasten.
const wfPanel = computed(
  () => active.value === WF_INDEX || (wfShown.value && active.value === null),
);

function select(i: number) {
  manual.value = manual.value === i ? null : i;
}
function selectWf(ev: MouseEvent) {
  // Eingeklappt gehört der Klick dem umgebenden /goal-Kasten.
  if (!wfShown.value) return;
  ev.stopPropagation();
  select(WF_INDEX);
}

// Level-Akzente (innen → außen): violett → indigo → sky → smaragd → amber.
const ACCENTS = computed(() => {
  const d = isDark.value;
  return [
    {
      ink: d ? "#a78bfa" : "#7c3aed",
      tint: d ? "rgba(167,139,250,0.10)" : "rgba(124,58,237,0.07)",
    },
    {
      ink: d ? "#818cf8" : "#4f46e5",
      tint: d ? "rgba(129,140,248,0.10)" : "rgba(79,70,229,0.07)",
    },
    {
      ink: d ? "#38bdf8" : "#0284c7",
      tint: d ? "rgba(56,189,248,0.10)" : "rgba(2,132,199,0.07)",
    },
    {
      ink: d ? "#34d399" : "#059669",
      tint: d ? "rgba(52,211,153,0.10)" : "rgba(5,150,105,0.07)",
    },
    {
      ink: d ? "#fbbf24" : "#d97706",
      tint: d ? "rgba(251,191,36,0.10)" : "rgba(217,119,6,0.07)",
    },
    // Workflow-Zusatzschicht (WF_INDEX): rosé, damit sie sich von den fünf
    // Kernschleifen abhebt.
    {
      ink: d ? "#fb7185" : "#e11d48",
      tint: d ? "rgba(251,113,133,0.10)" : "rgba(225,29,72,0.06)",
    },
  ] as const;
});

// Formel-Glieder außen → innen; der Fan-out-Faktor rückt ab Klick 7 zwischen
// Turns und Iterationen, an dieselbe Stelle wie der Kasten.
const formulaTerms = computed(() => {
  const term = (i: number) => ({
    key: LEVELS[i]!.id as string,
    label: `${LEVELS[i]!.emoji} ${LEVELS[i]!.mult.replace("× ", "")}`,
    ink: ACCENTS.value[i]!.ink,
    extra: false,
  });
  const wf = {
    key: "wf",
    label: `${WF.emoji} ${WF.mult.replace("× ", "")}`,
    ink: ACCENTS.value[WF_INDEX].ink,
    extra: true,
  };
  return [
    term(4),
    term(3),
    term(2),
    ...(wfShown.value ? [wf] : []),
    term(1),
    term(0),
  ];
});

function ringStyle(i: number) {
  const on = active.value === i || finale.value;
  const a = ACCENTS.value[i]!;
  return {
    borderColor: on ? a.ink : pal.value.border,
    background: on ? a.tint : "transparent",
  };
}
// Dimmen nur über die Header-Zeile — opacity auf dem Ring-Container würde
// auf alle verschachtelten Kinder kaskadieren (0.45 × 0.45 × …).
function hdrStyle(i: number) {
  const on = active.value === null || active.value === i || finale.value;
  return { opacity: on ? 1 : 0.5 };
}
function inkStyle(i: number) {
  const on = active.value === i || finale.value;
  return { color: on ? ACCENTS.value[i]!.ink : pal.value.text };
}

const P = computed(() => {
  const d = isDark.value;
  return {
    code: d ? "#9090a0" : "#6b7280",
    cacheInk: d ? "#4ade80" : "#16a34a",
    cacheBg: d ? "rgba(74,222,128,0.12)" : "rgba(22,163,74,0.08)",
  };
});
</script>

<template>
  <div class="nl">
    <div class="main">
      <!-- Geschachtelte Kästen, außen (Index 4) → innen (Index 0) -->
      <div class="rings">
        <div class="ring" :style="ringStyle(4)" @click.stop="select(4)">
          <div class="hdr" :style="hdrStyle(4)">
            <span class="emoji">{{ LEVELS[4].emoji }}</span>
            <span class="name" :style="inkStyle(4)">{{ LEVELS[4].name }}</span>
            <span class="code">{{ LEVELS[4].code }}</span>
            <span class="mult" :style="inkStyle(4)">{{ LEVELS[4].mult }}</span>
          </div>
          <div class="ring" :style="ringStyle(3)" @click.stop="select(3)">
            <div class="hdr" :style="hdrStyle(3)">
              <span class="emoji">{{ LEVELS[3].emoji }}</span>
              <span class="name" :style="inkStyle(3)">{{
                LEVELS[3].name
              }}</span>
              <span class="code">{{ LEVELS[3].code }}</span>
              <span class="mult" :style="inkStyle(3)">{{
                LEVELS[3].mult
              }}</span>
            </div>
            <div class="ring" :style="ringStyle(2)" @click.stop="select(2)">
              <div class="hdr" :style="hdrStyle(2)">
                <span class="emoji">{{ LEVELS[2].emoji }}</span>
                <span class="name" :style="inkStyle(2)">{{
                  LEVELS[2].name
                }}</span>
                <span class="code">{{ LEVELS[2].code }}</span>
                <span class="mult" :style="inkStyle(2)">{{
                  LEVELS[2].mult
                }}</span>
              </div>
              <!-- Workflow-Zusatzschicht: bis Klick 6 ohne Rahmen, Padding und
                   Header, also ohne Einfluss aufs Layout -->
              <div
                class="ring wf"
                :class="{ shown: wfShown }"
                :style="wfShown ? ringStyle(WF_INDEX) : undefined"
                @click="selectWf"
              >
                <div v-if="wfShown" class="hdr" :style="hdrStyle(WF_INDEX)">
                  <span class="emoji">{{ WF.emoji }}</span>
                  <span class="name" :style="inkStyle(WF_INDEX)">{{
                    WF.name
                  }}</span>
                  <span class="code">{{ WF.code }}</span>
                  <span class="mult" :style="inkStyle(WF_INDEX)">{{
                    WF.mult
                  }}</span>
                </div>
                <div class="ring" :style="ringStyle(1)" @click.stop="select(1)">
                  <div class="hdr" :style="hdrStyle(1)">
                    <span class="emoji">{{ LEVELS[1].emoji }}</span>
                    <span class="name" :style="inkStyle(1)">{{
                      LEVELS[1].name
                    }}</span>
                    <span class="code">{{ LEVELS[1].code }}</span>
                    <span class="mult" :style="inkStyle(1)">{{
                      LEVELS[1].mult
                    }}</span>
                  </div>
                  <div
                    class="ring inner"
                    :style="ringStyle(0)"
                    @click.stop="select(0)"
                  >
                    <div class="hdr" :style="hdrStyle(0)">
                      <span class="emoji">{{ LEVELS[0].emoji }}</span>
                      <span class="name" :style="inkStyle(0)">{{
                        LEVELS[0].name
                      }}</span>
                      <span class="code">{{ LEVELS[0].code }}</span>
                      <span class="mult" :style="inkStyle(0)">{{
                        LEVELS[0].mult
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Hebel-Panel -->
      <div class="panel">
        <template v-if="activeLevel">
          <div class="p-head" :style="inkStyle(active!)">
            {{ activeLevel.emoji }} {{ activeLevel.name }}
          </div>
          <div class="p-label">Kostentreiber</div>
          <div class="p-text">{{ activeLevel.driver }}</div>
          <div class="p-label">Hebel</div>
          <div class="p-text">{{ activeLevel.lever }}</div>
          <div v-if="activeLevel.ref" class="p-ref">
            → {{ activeLevel.ref }}
          </div>
          <div v-if="activeLevel.id === 'goal'" class="p-ref">
            →
            <TalkXref slug="20260327-ai-agents" anchor="autonomie-primitive"
              >AI Coding Agents</TalkXref
            >
          </div>
          <div v-if="activeLevel.id === 'loop'" class="p-ref">
            →
            <TalkXref slug="20260327-ai-agents" anchor="autonomie-primitive"
              >AI Coding Agents</TalkXref
            >
            ·
            <TalkXref slug="20260707-anatomy-of-autonomous-agents"
              >Anatomie Autonomer Agenten</TalkXref
            >
          </div>
        </template>
        <template v-else-if="wfPanel">
          <div class="p-head" :style="{ color: ACCENTS[WF_INDEX].ink }">
            {{ WF.emoji }} {{ WF.name }}
          </div>
          <div class="p-label">Kostentreiber</div>
          <div class="p-text">{{ WF.driver }}</div>
          <div class="p-label">Hebel</div>
          <ul class="p-levers">
            <li v-for="l in WF.levers" :key="l">{{ l }}</li>
          </ul>
        </template>
        <template v-else-if="finale">
          <div class="p-head" :style="{ color: ACCENTS[4].ink }">Merksatz</div>
          <div class="p-text big">
            Je weiter außen die Schleife, desto größer der Hebel — ein
            verworfener Versuch multipliziert <b>alles</b> darunter.
          </div>
        </template>
        <template v-else>
          <div class="p-hint">
            Jede Ebene ist ein <b>Kosten-Multiplikator</b>.<br />
            Klick dich von innen nach außen — oder tippe direkt auf eine
            Schleife.
          </div>
        </template>
      </div>
    </div>

    <!-- Formel-Streifen -->
    <div class="formula" :class="{ visible: showFormula }">
      <span class="f-lead">Tokens ≈</span>
      <template v-for="(t, k) in formulaTerms" :key="t.key">
        <span v-if="k > 0" class="f-op">×</span>
        <span
          class="chip"
          :class="{ extra: t.extra }"
          :style="{ color: t.ink, borderColor: t.ink }"
        >
          {{ t.label }}
        </span>
      </template>
      <!-- Mit dem sechsten Glied passt der lange Cache-Text nicht mehr in
           eine Zeile (Folienbreite 868 px), deshalb ab Klick 7 die Kurzform. -->
      <span class="chip cache">{{
        wfShown ? "Cache: −90 %" : "Cache: −90 % auf den Prefix"
      }}</span>
    </div>

    <!-- Belegzeile zum Fan-out-Faktor, nur mit der Workflow-Schicht -->
    <div v-if="wfShown" class="evidence">
      <div class="ev-line">
        <span class="ev-lead" :style="{ color: ACCENTS[WF_INDEX].ink }"
          >Belegt:</span
        >
        <span><b>3–10×</b> Token ggü. Einzelagent (Anthropic)</span>
        <span class="ev-sep">·</span>
        <span><b>≈ 7×</b> Agent Teams, Plan Mode (Claude-Code-Doku)</span>
        <span class="ev-sep">·</span>
        <span><b>94 %</b> Subagenten-Token erneut gelesen (858 Läufe)</span>
      </div>
      <div class="ev-line ev-caveat">
        <span
          >Bedingt vergleichbar: Kein Hersteller beziffert Coding-Subagenten;
          unabhängige Messungen reichen von 0,1× bis 6×.</span
        >
        <span class="ev-sep">·</span>
        <span>Stand 22.11.2026</span>
        <button
          class="ev-ib"
          aria-label="Quellen und Einschränkungen anzeigen"
          @click.stop="sourcesOpen = true"
        >
          Quellen ⓘ
        </button>
      </div>
    </div>

    <SourcesPopover
      :open="sourcesOpen"
      scope="Gilt für die Workflow-Schicht dieser Folie (Fan-out auf Subagenten). Recherche vom 22.11.2026."
      :sources="WF_SOURCES"
      :caveats="WF_CAVEATS"
      @close="sourcesOpen = false"
    />
  </div>
</template>

<style scoped>
.nl {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 940px;
  color: v-bind("pal.text");
}
.main {
  display: flex;
  gap: 14px;
  align-items: stretch;
}
.rings {
  flex: 1.45;
  min-width: 0;
}
.ring {
  border: 1.5px solid;
  border-radius: 10px;
  padding: 7px 9px 9px;
  cursor: pointer;
  transition:
    border-color 0.3s ease,
    background 0.3s ease,
    opacity 0.3s ease;
}
.ring + .ring,
.hdr + .ring {
  margin-top: 6px;
}
.ring.inner {
  cursor: pointer;
}
/* Workflow-Zusatzschicht: eingeklappt ein reiner Durchreich-Container (der
   6-px-Abstand zum /goal-Header bleibt, der Agent-Loop-Kasten sitzt exakt wie
   vor der Erweiterung). Gestrichelt = Zusatz, keine der fünf Kernschleifen. */
.ring.wf {
  border-width: 0;
  padding: 0;
  cursor: inherit;
}
.ring.wf.shown {
  border-width: 1.5px;
  border-style: dashed;
  padding: 7px 9px 9px;
  cursor: pointer;
  animation: wf-in 0.4s ease;
}
@keyframes wf-in {
  from {
    opacity: 0.3;
  }
  to {
    opacity: 1;
  }
}
.hdr {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
}
.emoji {
  font-size: 12px;
}
.name {
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  transition: color 0.3s ease;
}
.code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  color: v-bind("P.code");
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}
.mult {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  transition: color 0.3s ease;
}
.panel {
  flex: 1;
  min-width: 0;
  border: 1.5px solid v-bind("pal.border");
  border-radius: 10px;
  background: v-bind("pal.bg");
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.p-head {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 2px;
}
.p-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: v-bind("pal.labelColor");
  margin-top: 4px;
}
.p-text {
  font-size: 12.5px;
  line-height: 1.45;
  color: v-bind("pal.descColor");
}
.p-text.big {
  font-size: 14px;
  line-height: 1.55;
  margin-top: 4px;
}
.p-text b {
  color: v-bind("pal.text");
}
.p-ref {
  font-size: 11px;
  color: v-bind("pal.labelColor");
  margin-top: 4px;
}
.p-levers {
  margin: 0;
  padding: 0 0 0 14px;
  list-style: disc;
  font-size: 12px;
  line-height: 1.4;
  color: v-bind("pal.descColor");
}
.p-levers li {
  margin: 0;
  padding: 0;
  font-size: inherit;
  line-height: inherit;
}
.p-hint {
  font-size: 12.5px;
  line-height: 1.55;
  color: v-bind("pal.descColor");
  margin: auto 0;
}
.p-hint b {
  color: v-bind("pal.text");
}
.formula {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.formula.visible {
  opacity: 1;
  transform: none;
}
.f-lead {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 13px;
  font-weight: 800;
}
.f-op {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: v-bind("pal.labelColor");
}
.chip {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  border: 1.5px solid;
  border-radius: 999px;
  padding: 1px 9px;
  white-space: nowrap;
}
.chip.cache {
  margin-left: auto;
  color: v-bind("P.cacheInk");
  border-color: v-bind("P.cacheInk");
  background: v-bind("P.cacheBg");
}
.chip.extra {
  border-style: dashed;
}
.evidence {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  line-height: 1.45;
  color: v-bind("pal.descColor");
}
.ev-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 6px;
}
.ev-line b {
  color: v-bind("pal.text");
  font-weight: 800;
}
.ev-lead {
  font-weight: 700;
}
.ev-sep {
  color: v-bind("pal.labelColor");
}
.ev-caveat {
  font-size: 10.5px;
  color: v-bind("pal.labelColor");
}
.ev-ib {
  margin-left: auto;
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 10.5px;
  line-height: 1;
  color: v-bind("pal.descColor");
  cursor: pointer;
}
.ev-ib:hover {
  color: v-bind("pal.text");
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
