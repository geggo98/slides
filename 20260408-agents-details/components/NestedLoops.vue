<script setup lang="ts">
import { computed, ref } from "vue";
import { useDarkMode } from "@slidev/client";
import TalkXref from "@shared/components/TalkXref.vue";
import { useDeckPalette } from "./palette";

// Fünf geschachtelte Schleifen als Kosten-Modell. Reveal über Slidev-Clicks
// (<NestedLoops :clicks="$clicks" /> mit clicks: 6 im Frontmatter):
// Klick 0 = alle Ebenen neutral, 1–5 = Ebene innen→außen aktiv + Hebel-Panel,
// 6 = Formel-Streifen + Merksatz. Zusätzlich sind die Kästen selbst klickbar
// (Selbststudium) — eine manuelle Auswahl überlagert den Klick-Zustand.
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

const manual = ref<number | null>(null);
const clickLevel = computed(() =>
  c.value >= 1 && c.value <= 5 ? c.value - 1 : null,
);
const active = computed(() => manual.value ?? clickLevel.value);
const activeLevel = computed(() =>
  active.value === null ? null : LEVELS[active.value],
);
// Finale: alle Ebenen eingefärbt + Formel sichtbar (manuelle Auswahl gewinnt).
const finale = computed(() => c.value >= 6 && manual.value === null);
const showFormula = computed(() => c.value >= 6);

function select(i: number) {
  manual.value = manual.value === i ? null : i;
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
  ];
});

function ringStyle(i: number) {
  const on = active.value === i || finale.value;
  const a = ACCENTS.value[i];
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
  return { color: on ? ACCENTS.value[i].ink : pal.value.text };
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
      <template v-for="(i, k) in [4, 3, 2, 1, 0]" :key="i">
        <span v-if="k > 0" class="f-op">×</span>
        <span
          class="chip"
          :style="{ color: ACCENTS[i].ink, borderColor: ACCENTS[i].ink }"
        >
          {{ LEVELS[i].emoji }} {{ LEVELS[i].mult.replace("× ", "") }}
        </span>
      </template>
      <span class="chip cache">Cache: −90 % auf den Prefix</span>
    </div>
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
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
