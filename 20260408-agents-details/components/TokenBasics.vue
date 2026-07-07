<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

// Reveal wird über Slidev-Clicks gesteuert:  <TokenBasics :clicks="$clicks" />
const props = defineProps<{ clicks?: number }>();
const c = computed(() => props.clicks ?? 0);

const { isDark } = useDarkMode();

// Token-Zerlegung von  "if (x) { return; }"  — Leerzeichen & Klammern inklusive.
type Tok = { t: string; sym: boolean };
const TOKENS: Tok[] = [
  { t: "if", sym: false },
  { t: " (", sym: true },
  { t: "x", sym: false },
  { t: ")", sym: true },
  { t: " {", sym: true },
  { t: " return", sym: false },
  { t: ";", sym: true },
  { t: " }", sym: true },
];

// Choreografie: 1 = Chips, 2 = Symbole hervorheben, 3 = Cluster, 4 = banana
const showChips = computed(() => c.value >= 1);
const hiSym = computed(() => c.value >= 2);
const showCluster = computed(() => c.value >= 3);
const showBanana = computed(() => c.value >= 4);

// Embedding-Punkte (SVG-Koordinaten im 320×190-Feld)
const CLUSTER = [
  { label: "cat", x: 110, y: 96 },
  { label: "kitten", x: 138, y: 116 },
  { label: "dog", x: 96, y: 130 },
];
const BANANA = { label: "banana", x: 268, y: 52 };

const P = computed(() => {
  const d = isDark.value;
  return {
    text: d ? "#e0e0e8" : "#1f2937",
    muted: d ? "#9090a0" : "#6b7280",
    line: d ? "#2a2a35" : "#e5e7eb",
    cardBg: d ? "#14141c" : "#ffffff",
    wordBg: d ? "#1e2a4a" : "#eff6ff",
    wordB: d ? "#60a5fa" : "#2563eb",
    wordInk: d ? "#bfdbfe" : "#1e3a8a",
    symBg: d ? "#3a2e12" : "#fffbeb",
    symB: d ? "#f59e0b" : "#f59e0b",
    symInk: d ? "#fbbf24" : "#92400e",
    svgBg: d ? "#0d0d14" : "#f9fafb",
    axis: d ? "#2a2a3a" : "#e5e7eb",
    clusterDot: d ? "#4ade80" : "#16a34a",
    clusterInk: d ? "#bbf7d0" : "#14532d",
    bananaDot: d ? "#fb923c" : "#ea580c",
    bananaInk: d ? "#fdba74" : "#9a3412",
    codeBg: d ? "#1a1a24" : "#f3f4f6",
  };
});
</script>

<template>
  <div class="tb">
    <!-- Links: Tokenizer -->
    <div class="col">
      <div class="head">Wort oder Wortteil</div>
      <div class="src">"if (x) &lbrace; return; &rbrace;"</div>
      <div class="arrow">↓ Tokenizer</div>
      <div class="chips" :class="{ shown: showChips }">
        <span
          v-for="(tok, i) in TOKENS"
          :key="i"
          class="chip"
          :class="[tok.sym ? 'sym' : 'word', { hi: hiSym && tok.sym }]"
          :style="{ transitionDelay: showChips ? i * 55 + 'ms' : '0ms' }"
          >{{ tok.t }}</span
        >
      </div>
      <p class="cap">
        <span :class="{ faint: !hiSym }"
          >Auch <b>Leerzeichen</b> & <b>Klammern</b> sind eigene Tokens.</span
        >
        Der Tokenizer legt sie <b>vorab nach Häufigkeit</b> fest — ~100.000 im
        Vokabular, nicht emergent.
      </p>
    </div>

    <!-- Rechts: Embedding -->
    <div class="col">
      <div class="head">Token → Vektor (Embedding)</div>
      <svg viewBox="0 0 320 190" class="scatter">
        <line
          x1="24"
          y1="166"
          x2="308"
          y2="166"
          :stroke="P.axis"
          stroke-width="1"
        />
        <line
          x1="24"
          y1="24"
          x2="24"
          y2="166"
          :stroke="P.axis"
          stroke-width="1"
        />
        <g v-if="showCluster" class="grp">
          <circle
            v-for="p in CLUSTER"
            :key="p.label"
            :cx="p.x"
            :cy="p.y"
            r="7"
            :fill="P.clusterDot"
          />
          <text
            v-for="p in CLUSTER"
            :key="p.label + 't'"
            :x="p.x + 11"
            :y="p.y + 4"
            :fill="P.clusterInk"
            class="pt-label"
          >
            {{ p.label }}
          </text>
        </g>
        <g v-if="showBanana" class="grp">
          <circle :cx="BANANA.x" :cy="BANANA.y" r="7" :fill="P.bananaDot" />
          <text
            :x="BANANA.x - 8"
            :y="BANANA.y - 12"
            :fill="P.bananaInk"
            class="pt-label"
            text-anchor="end"
          >
            {{ BANANA.label }}
          </text>
        </g>
      </svg>
      <p class="cap">
        Jedes Token → <b>gelernter Vektor</b> (modellspezifisch). Ähnliche
        Wörter liegen <b>nah</b> beieinander,
        <span :class="{ faint: !showBanana }">Unverwandtes weit weg</span>.
        Nebeneffekt: für das Modell ist <b>alles</b> nur Input — sogar Base64.
      </p>
    </div>
  </div>
</template>

<style scoped>
.tb {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  color: v-bind("P.text");
}
.head {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}
.src {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 15px;
  background: v-bind("P.codeBg");
  border: 1px solid v-bind("P.line");
  border-radius: 6px;
  padding: 8px 12px;
  display: inline-block;
}
.arrow {
  font-size: 12px;
  color: v-bind("P.muted");
  margin: 6px 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 34px;
}
.chip {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1.5px solid;
  white-space: pre;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.25s ease,
    transform 0.25s ease,
    box-shadow 0.2s ease;
}
.chips.shown .chip {
  opacity: 1;
  transform: scale(1);
}
.chip.word {
  background: v-bind("P.wordBg");
  border-color: v-bind("P.wordB");
  color: v-bind("P.wordInk");
}
.chip.sym {
  background: v-bind("P.symBg");
  border-color: v-bind("P.symB");
  color: v-bind("P.symInk");
}
.chip.hi {
  box-shadow: 0 0 0 3px v-bind("P.symB") inset;
  font-weight: 700;
}
.cap {
  font-size: 12.5px;
  color: v-bind("P.muted");
  line-height: 1.5;
  margin-top: 12px;
}
.cap b {
  color: v-bind("P.text");
}
.faint {
  opacity: 0.4;
}
.scatter {
  width: 100%;
  max-width: 340px;
  background: v-bind("P.svgBg");
  border: 1px solid v-bind("P.line");
  border-radius: 8px;
}
.pt-label {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
}
.grp {
  animation: fade 0.3s ease;
}
@keyframes fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
