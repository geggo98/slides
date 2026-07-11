<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { useDeckPalette } from "./palette";

// Grafik 2 der Geschwister-Grafiken "Layered Stack Card":
// Request-Prefix von oben (stabil, global gecacht) nach unten (volatil).
// Gleiche Zeilen-Bausteine und Kategorie-Töne wie ContextAnatomy.vue
// (Violett = stabil/gecacht, Amber = wächst, Grau = session-spezifisch),
// plus die CACHE BOUNDARY als grün gestrichelte Trennlinie — der Held.
const P = useDeckPalette();
const { isDark } = useDarkMode();

// Zusatztöne im Muster von useDeckPalette
const E = computed(() => {
  const d = isDark.value;
  return {
    frameBg: d ? "#17171f" : "#fcfcfd",
    caption: d ? "#9a9aaa" : "#63636b",
    dirColor: d ? "#b4b4c0" : "#52525b",
    // statisch / kühl-eingefroren (Violett)
    coolBg: d ? "rgba(167,139,250,0.12)" : "rgba(124,58,237,0.07)",
    coolBorder: d ? "rgba(167,139,250,0.32)" : "rgba(124,58,237,0.26)",
    coolAccent: d ? "#a78bfa" : "#7c3aed",
    // wächst (Amber)
    warmBg: d ? "rgba(250,204,21,0.08)" : "rgba(202,138,4,0.06)",
    warmBgStrong: d ? "rgba(250,204,21,0.18)" : "rgba(202,138,4,0.16)",
    warmBorder: d ? "rgba(250,204,21,0.32)" : "rgba(202,138,4,0.30)",
    warmAccent: d ? "#fbbf24" : "#b45309",
    // neutral (session-spezifisch)
    neutralBg: d ? "rgba(140,140,160,0.08)" : "rgba(113,113,122,0.05)",
    neutralBorder: d ? "#2a2a35" : "#e4e4e7",
    neutralAccent: d ? "#8a8a9a" : "#a1a1aa",
    // Boundary (kräftiger als die Badge-Töne der Palette, v.a. im Light-Mode)
    boundaryLine: d ? "#4ade80" : "#16a34a",
    boundaryBg: d ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.14)",
    boundaryText: d ? "#86efac" : "#15803d",
  };
});

type Kind = "frozen" | "neutral" | "grow";
interface Row {
  label: string;
  ann: string;
  kind: Kind;
}

const ABOVE: Row[] = [
  { label: "tools-Array", ann: "stabil, global gecacht", kind: "frozen" },
  {
    label: "System-Prompt (statisch)",
    ann: "Verhaltensregeln",
    kind: "frozen",
  },
];

const BELOW: Row[] = [
  { label: "CLAUDE.md / Skills", ann: "session-spezifisch", kind: "neutral" },
  {
    label: "Git-Status / Datum",
    ann: "bricht Cache nicht global",
    kind: "neutral",
  },
  { label: "Conversation-History", ann: "wächst", kind: "grow" },
  { label: "User-Message", ann: "ganz am Ende", kind: "neutral" },
];
</script>

<template>
  <div class="ord">
    <div class="head">
      <span class="cap">Request-Prefix</span>
      <span class="dir">stabil → volatil&ensp;↓</span>
    </div>
    <div class="frame">
      <div v-for="r in ABOVE" :key="r.label" class="row" :class="r.kind">
        <span class="lbl">{{ r.label }}</span>
        <span class="ann">
          <svg
            class="flake"
            viewBox="0 0 12 12"
            width="11"
            height="11"
            aria-hidden="true"
          >
            <path
              d="M6 1v10M1.7 3.5l8.6 5M10.3 3.5l-8.6 5"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
          {{ r.ann }}
        </span>
      </div>

      <div class="boundary">
        <span class="dash" />
        <span class="blabel">CACHE BOUNDARY</span>
        <span class="dash" />
      </div>

      <div v-for="r in BELOW" :key="r.label" class="row" :class="r.kind">
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
.ord {
  width: 100%;
  max-width: 418px;
  box-sizing: border-box;
}
.ord * {
  box-sizing: border-box;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 0 2px 5px;
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
  padding: 9px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 11px;
  border-radius: 7px;
  border: 1px solid v-bind("E.neutralBorder");
  border-left-width: 3px;
  line-height: 1.25;
}
.lbl {
  font-size: 12.5px;
  font-weight: 700;
  color: v-bind("P.text");
  white-space: nowrap;
}
.ann {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  text-align: right;
  color: v-bind("E.caption");
}
.grow-glyph {
  flex: none;
}

/* Kategorie-Töne — identisch in ContextAnatomy.vue */
.frozen {
  background: v-bind("E.coolBg");
  border-color: v-bind("E.coolBorder");
  border-left-color: v-bind("E.coolAccent");
}
.frozen .ann {
  color: v-bind("E.coolAccent");
}
.flake {
  flex: none;
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
  font-size: 11px;
  font-weight: 700;
}
.neutral {
  background: v-bind("E.neutralBg");
  border-left-color: v-bind("E.neutralAccent");
}

/* Herzstück: die Cache-Grenze */
.boundary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
}
.dash {
  flex: 1;
  border-top: 2.5px dashed v-bind("E.boundaryLine");
  opacity: 0.9;
}
.blabel {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 2.5px 11px;
  border-radius: 999px;
  border: 1.5px dashed v-bind("E.boundaryLine");
  background: v-bind("E.boundaryBg");
  color: v-bind("E.boundaryText");
  white-space: nowrap;
}
</style>
