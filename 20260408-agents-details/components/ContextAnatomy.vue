<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { useDeckPalette } from "./palette";

// Grafik 1 der Geschwister-Grafiken "Layered Stack Card":
// Context-Window als Container, der von oben nach unten gefüllt wird.
// Gemeinsame visuelle Sprache mit PromptOrdering.vue — gleiche
// Zeilen-Bausteine, gleiche Kategorie-Töne: Violett = statisch/gecacht,
// Rot = Schockwert, Amber = wächst, Grau = session-/turn-spezifisch.
const P = useDeckPalette();
const { isDark } = useDarkMode();

// Zusatztöne im Muster von useDeckPalette
const E = computed(() => {
  const d = isDark.value;
  return {
    frameBg: d ? "#17171f" : "#fcfcfd",
    caption: d ? "#9a9aaa" : "#63636b",
    dirColor: d ? "#b4b4c0" : "#52525b",
    // statisch / kühl (Violett)
    coolBg: d ? "rgba(167,139,250,0.10)" : "rgba(124,58,237,0.06)",
    coolBorder: d ? "rgba(167,139,250,0.32)" : "rgba(124,58,237,0.26)",
    coolAccent: d ? "#a78bfa" : "#7c3aed",
    // wächst (Amber)
    warmBg: d ? "rgba(250,204,21,0.08)" : "rgba(202,138,4,0.06)",
    warmBgStrong: d ? "rgba(250,204,21,0.18)" : "rgba(202,138,4,0.16)",
    warmBorder: d ? "rgba(250,204,21,0.32)" : "rgba(202,138,4,0.30)",
    warmAccent: d ? "#fbbf24" : "#b45309",
    // Alarm (MCP-Schockwert)
    alertBg: d ? "rgba(248,113,113,0.14)" : "rgba(220,38,38,0.07)",
    alertBorder: d ? "rgba(248,113,113,0.50)" : "rgba(220,38,38,0.38)",
    alertAccent: d ? "#fca5a5" : "#dc2626",
    // neutral
    neutralBg: d ? "rgba(140,140,160,0.08)" : "rgba(113,113,122,0.05)",
    neutralBorder: d ? "#2a2a35" : "#e4e4e7",
    neutralAccent: d ? "#8a8a9a" : "#a1a1aa",
  };
});

type Kind = "cool" | "alert" | "grow" | "neutral";
interface Row {
  label: string;
  ann: string;
  kind: Kind;
}

const ROWS: Row[] = [
  {
    label: "Tool-Definitionen",
    ann: "Request-Prefix, 19+ Tools",
    kind: "cool",
  },
  {
    label: "System-Prompt (statisch)",
    ann: "CLAUDE.md, Skills, Rules",
    kind: "cool",
  },
  {
    label: "MCP-Tool-Definitionen",
    ann: "17K–126K pro Server!",
    kind: "alert",
  },
  {
    label: "Conversation-History",
    ann: "wächst mit jeder Iteration",
    kind: "grow",
  },
  { label: "Memory (MEMORY.md)", ann: "max 200 Zeilen", kind: "neutral" },
  { label: "User-Message", ann: "ganz am Ende", kind: "neutral" },
];
</script>

<template>
  <div class="ctx">
    <div class="head">
      <span class="cap">Context-Window</span>
      <span class="dir">füllt sich von oben&ensp;↓</span>
    </div>
    <div class="frame">
      <div v-for="r in ROWS" :key="r.label" class="row" :class="r.kind">
        <span class="lbl">{{ r.label }}</span>
        <span class="ann">
          <svg
            v-if="r.kind === 'grow'"
            class="grow-glyph"
            viewBox="0 0 38 14"
            width="38"
            height="14"
            aria-hidden="true"
          >
            <rect
              x="0"
              y="9"
              width="6"
              height="5"
              rx="1"
              fill="currentColor"
              opacity="0.45"
            />
            <rect
              x="8"
              y="5.5"
              width="6"
              height="8.5"
              rx="1"
              fill="currentColor"
              opacity="0.65"
            />
            <rect
              x="16"
              y="2"
              width="6"
              height="12"
              rx="1"
              fill="currentColor"
              opacity="0.85"
            />
            <path
              d="M26 11.5 L34 3.5 M34 3.5 h-5 M34 3.5 v5"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ r.ann }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctx {
  width: 100%;
  max-width: 418px;
  box-sizing: border-box;
}
.ctx * {
  box-sizing: border-box;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 0 2px 6px;
}
.cap {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: v-bind("E.caption");
}
.dir {
  font-size: 11px;
  font-weight: 700;
  color: v-bind("E.dirColor");
}
.frame {
  border: 1.5px solid v-bind("P.border");
  background: v-bind("E.frameBg");
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid v-bind("E.neutralBorder");
  border-left-width: 3px;
  line-height: 1.25;
}
.lbl {
  font-size: 13px;
  font-weight: 700;
  color: v-bind("P.text");
  white-space: nowrap;
}
.ann {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-align: right;
  color: v-bind("E.caption");
}
.grow-glyph {
  flex: none;
}

/* Kategorie-Töne — identisch in PromptOrdering.vue */
.cool {
  background: v-bind("E.coolBg");
  border-color: v-bind("E.coolBorder");
  border-left-color: v-bind("E.coolAccent");
}
.alert {
  background: v-bind("E.alertBg");
  border-color: v-bind("E.alertBorder");
  border-left-color: v-bind("E.alertAccent");
}
.alert .ann {
  color: v-bind("E.alertAccent");
  font-size: 12.5px;
  font-weight: 800;
}
.grow {
  background: linear-gradient(
    90deg,
    v-bind("E.warmBg"),
    v-bind("E.warmBgStrong")
  );
  border-color: v-bind("E.warmBorder");
  border-left-color: v-bind("E.warmAccent");
}
.grow .ann {
  color: v-bind("E.warmAccent");
  font-size: 11.5px;
  font-weight: 700;
}
.neutral {
  background: v-bind("E.neutralBg");
  border-left-color: v-bind("E.neutralAccent");
}
</style>
