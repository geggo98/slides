<script setup lang="ts">
import { computed, ref } from "vue";
import BunIcon from "./BunIcon.vue";
import BunPopover from "./BunPopover.vue";

// Bonus-Slide 2: Gantt der 11 Rewrite-Tage mit klickbaren Phasenzeilen
// (Popup: Details, Agentenrollen, Parallelität) plus log-skalierter
// Concurrency-Linie. Autonomiegrade farbcodiert über die Token-Tripel
// info (Human in the loop) / success (Human on the loop) / warning
// (vollautonom).
type Autonomy = "hitl" | "hotl" | "auto";

const phases: {
  n: string;
  d: string;
  a: Autonomy;
  al: string;
  t: string;
  ag: string;
  c: string;
}[] = [
  {
    n: "Vorbereitung",
    d: "~3 Std.",
    a: "hitl",
    al: "Human in the loop",
    t: "3 Stunden Diskussion mit Claude über Zig-nach-Rust-Muster, serialisiert als PORTING.md (600 Zeilen, ~300 Regeln): kein tokio/rayon/hyper, kein async fn — Callbacks und State Machines wie im Zig-Original.",
    ag: "1 Planungs-Session in Claude Code",
    c: "1 (dokumentiert)",
  },
  {
    n: "Probelauf",
    d: "Stunden",
    a: "hitl",
    al: "Human in the loop",
    t: "3 von 1.448 Dateien als Test portiert. Danach 2 adversarielle Reviews in Sessions, die von der schreibenden Session getrennt waren.",
    ag: "1 Porter, 2 adversarielle Reviewer",
    c: "3 (dokumentiert)",
  },
  {
    n: "Orchestrierung",
    d: "~1 Tag",
    a: "hitl",
    al: "Human in the loop",
    t: "Skalierung schlug zunächst fehl: Agenten führten git stash, stash pop und reset --hard aus und zerstörten sich gegenseitig die Arbeit. Fix: nur Einzeldatei-Commits, kein cargo, keine langsamen Befehle — und 4 Worktrees mit je 16 Claudes, weil der Plattenplatz für 64 Worktrees nicht reichte.",
    ag: "Meta-Workflows: Claude editiert die eigenen Regeln",
    c: "instabil, geschätzt",
  },
  {
    n: "Port-Lauf",
    d: "~2 Tage",
    a: "hotl",
    al: "Human on the loop",
    t: "535.496 Zeilen Zig in 1.448 Dateien portiert. Jeder Commit muss vor dem Commit 2 adversarielle Reviews passieren. Peak ~1.300 Zeilen Rust pro Minute.",
    ag: "4 Shards × 16 Porter, je 2 Reviewer pro Commit",
    c: "64 (dokumentiert)",
  },
  {
    n: "Compilerfehler",
    d: "~12 Std.",
    a: "auto",
    al: "Vollautonom",
    t: "Nach dem Port kompilierte nichts. Zyklische Crate-Abhängigkeiten legten ~16.000 Compilerfehler frei. Loop pro Crate: cargo check, Fehler gruppieren, fixen, 2 Reviewer, 1 Fixer. Lief von Mitternacht bis 11:30 Uhr, während das Team schlief.",
    ag: "Fixer plus 2 adversarielle Reviewer pro Crate",
    c: "64 (dokumentiert)",
  },
  {
    n: "Tests lokal",
    d: "~2 Tage",
    a: "hotl",
    al: "Human on the loop",
    t: "Buns Testsuite mit über 1 Mio. Assertions musste erst überhaupt lauffähig werden — starten ohne Kompilierfehler, Failures einsammeln.",
    ag: "Test-Fix-Workflows",
    c: "nicht dokumentiert",
  },
  {
    n: "CI grün",
    d: "~3 Tage",
    a: "hotl",
    al: "Human on the loop",
    t: "Loop pro Plattform, bis keine Testfehler mehr auftraten. Linux (60 Shards) war fast einen Tag vor Windows grün (11. Mai, 6:23 Uhr PDT). Finaler All-Green-Build #54202 nach 135 Test-Builds.",
    ag: "CI-Fix-Loops und Cleanup-Workflows",
    c: "nicht dokumentiert",
  },
  {
    n: "Merge und Verifikation",
    d: "~2 Tage (Restwert)",
    a: "hitl",
    al: "Human in the loop",
    t: "Jarred verifiziert manuell und merged über 1 Mio. Zeilen Rust in einem PR. v1.3.14 vom 13. Mai war die letzte Zig-Version.",
    ag: "Mensch als finales Gate",
    c: "nicht dokumentiert",
  },
];

// Gantt-Zeilen: Balken-Geometrie aus der Original-Vorlage (viewBox 650×290).
const rows: {
  label: string;
  x: number;
  w: number;
  dur: string;
  durX?: number;
}[] = [
  { label: "Vorbereitung", x: 110, w: 8, dur: "~3 h" },
  { label: "Probelauf", x: 117, w: 18, dur: "Stunden" },
  { label: "Orchestrierung", x: 134, w: 48, dur: "~1 Tag" },
  { label: "Port-Lauf", x: 182, w: 97, dur: "~2 Tage" },
  { label: "Compilerfehler", x: 279, w: 24, dur: "~12 h" },
  { label: "Tests lokal", x: 303, w: 96, dur: "~2 Tage" },
  { label: "CI grün", x: 399, w: 145, dur: "~3 Tage" },
  { label: "Merge, Verif.", x: 544, w: 96, dur: "~2 Tage*", durX: 538 },
];

const phaseIdx = ref<number | null>(null);
const caveat = ref(false);
const popOpen = computed(() => phaseIdx.value !== null || caveat.value);
const phase = computed(() =>
  phaseIdx.value === null ? null : phases[phaseIdx.value],
);

function closePop() {
  phaseIdx.value = null;
  caveat.value = false;
}
</script>

<template>
  <div class="bun-gantt">
    <div class="bun-legend">
      <span class="bun-pill bun-a-hitl">Human in the loop</span>
      <span class="bun-pill bun-a-hotl">Human on the loop</span>
      <span class="bun-pill bun-a-auto">Vollautonom</span>
      <button
        class="bun-ib"
        aria-label="Caveats zu diesem Chart"
        @click="caveat = true"
      >
        <BunIcon name="info-circle" :size="15" />
      </button>
    </div>

    <div class="bun-gantt-wrap">
      <svg width="100%" viewBox="0 0 650 290" role="img">
        <title>Gantt und Agenten-Concurrency</title>
        <desc>
          Acht klickbare Phasen über 11 Tage, farbcodiert nach Autonomiegrad,
          darunter parallele Claude-Instanzen auf logarithmischer Skala
        </desc>
        <g
          v-for="(r, i) in rows"
          :key="r.label"
          class="bun-node"
          @click="phaseIdx = i"
        >
          <rect :y="2 + i * 22" x="0" width="650" height="22" class="bun-hit" />
          <text
            class="bun-ts"
            x="104"
            :y="13 + i * 22"
            text-anchor="end"
            dominant-baseline="central"
          >
            {{ r.label }}
          </text>
          <rect
            :class="`bun-c-${phases[i].a}`"
            :x="r.x"
            :y="6 + i * 22"
            :width="r.w"
            height="14"
            rx="3"
            stroke-width="0.5"
          />
          <text
            class="bun-ts"
            :x="r.durX ?? r.x + r.w + 6"
            :y="13 + i * 22"
            :text-anchor="r.durX ? 'end' : 'start'"
            dominant-baseline="central"
          >
            {{ r.dur }}
          </text>
        </g>

        <line class="bun-axis" x1="110" y1="186" x2="640" y2="186" />
        <text class="bun-ts" x="110" y="200" text-anchor="middle">0</text>
        <text class="bun-ts" x="206" y="200" text-anchor="middle">2</text>
        <text class="bun-ts" x="303" y="200" text-anchor="middle">4</text>
        <text class="bun-ts" x="399" y="200" text-anchor="middle">6</text>
        <text class="bun-ts" x="495" y="200" text-anchor="middle">8</text>
        <text class="bun-ts" x="592" y="200" text-anchor="middle">10</text>
        <text class="bun-ts" x="634" y="200" text-anchor="middle">Tag</text>

        <text class="bun-ts" x="110" y="212" dominant-baseline="central">
          Parallele Claudes (log-Skala)
        </text>
        <line class="bun-cline" x1="420" y1="212" x2="444" y2="212" />
        <text class="bun-ts" x="450" y="212" dominant-baseline="central">
          dokumentiert
        </text>
        <line
          class="bun-cline"
          x1="540"
          y1="212"
          x2="564"
          y2="212"
          stroke-dasharray="4 3"
        />
        <text class="bun-ts" x="570" y="212" dominant-baseline="central">
          geschätzt
        </text>

        <line
          class="bun-axis"
          x1="110"
          y1="222"
          x2="640"
          y2="222"
          stroke-dasharray="2 4"
        />
        <line
          class="bun-axis"
          x1="110"
          y1="240"
          x2="640"
          y2="240"
          stroke-dasharray="2 4"
        />
        <line
          class="bun-axis"
          x1="110"
          y1="258"
          x2="640"
          y2="258"
          stroke-dasharray="2 4"
        />
        <line class="bun-axis" x1="110" y1="276" x2="640" y2="276" />
        <text
          class="bun-ts"
          x="104"
          y="222"
          text-anchor="end"
          dominant-baseline="central"
        >
          64
        </text>
        <text
          class="bun-ts"
          x="104"
          y="240"
          text-anchor="end"
          dominant-baseline="central"
        >
          16
        </text>
        <text
          class="bun-ts"
          x="104"
          y="258"
          text-anchor="end"
          dominant-baseline="central"
        >
          4
        </text>
        <text
          class="bun-ts"
          x="104"
          y="276"
          text-anchor="end"
          dominant-baseline="central"
        >
          1
        </text>

        <path class="bun-cline" d="M110 276 L117 276 L117 262 L134 262" />
        <path
          class="bun-cline"
          d="M134 262 L134 240 L182 240"
          stroke-dasharray="4 3"
        />
        <path class="bun-cline" d="M182 240 L182 222 L303 222" />
        <path
          class="bun-cline"
          d="M303 222 L303 240 L544 240 L544 258 L640 258"
          stroke-dasharray="4 3"
        />
      </svg>
    </div>

    <div class="bun-hint">
      Zeile anklicken für Phasendetails und beteiligte Agenten · ⓘ für Caveats
    </div>

    <BunPopover :open="popOpen" @close="closePop">
      <template v-if="phase">
        <div class="bun-pop-head">
          <span class="bun-pop-h bun-pop-h-inline">{{ phase.n }}</span>
          <span class="bun-pop-dur">{{ phase.d }}</span>
          <span class="bun-pill" :class="`bun-a-${phase.a}`">{{
            phase.al
          }}</span>
        </div>
        <div class="bun-pop-t">{{ phase.t }}</div>
        <div class="bun-pop-meta">
          Agenten: {{ phase.ag }} · Parallelität: {{ phase.c }}
        </div>
      </template>
      <template v-else-if="caveat">
        <div class="bun-pop-h">Caveats zu diesem Chart</div>
        <div class="bun-pop-t">
          Die dokumentierten Phasendauern ergeben nur ~8,6 von 11 Tagen — der
          Merge-Block ist Restwert-Arithmetik, keine Quellenangabe. Die
          Concurrency-Achse ist logarithmisch, sonst wären 1 und 3 unsichtbar;
          der Sprung auf 64 wirkt dadurch optisch kleiner, als er ist.
          Gestrichelte Segmente sind Schätzungen — belegt sind nur 1, 3 und 64.
          Und: Der Newsletter nennt in der Überschrift ~1.600 Compilerfehler,
          das eigene Jarred-Zitat darin sagt ~16.000 — Letzteres stimmt.
        </div>
      </template>
    </BunPopover>
  </div>
</template>

<style scoped>
.bun-gantt {
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}
.bun-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.bun-ib {
  padding: 0 2px;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  line-height: 1;
}
.bun-ib:hover {
  color: var(--color-text-primary);
}
.bun-gantt-wrap {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
}
.bun-hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.bun-pill {
  padding: 2px 8px;
  border: 0.5px solid;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.bun-a-hitl {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-color: var(--color-border-info);
}
.bun-a-hotl {
  background: var(--color-background-success);
  color: var(--color-text-success);
  border-color: var(--color-border-success);
}
.bun-a-auto {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
  border-color: var(--color-border-warning);
}

.bun-node {
  cursor: pointer;
}
.bun-hit {
  fill: transparent;
}
.bun-node:hover .bun-hit {
  fill: var(--color-background-secondary);
}
.bun-ts {
  font-size: 11px;
  fill: var(--color-text-secondary);
}
.bun-axis {
  stroke: var(--color-border-secondary);
  stroke-width: 0.5;
}
.bun-cline {
  fill: none;
  stroke: var(--color-text-tertiary);
  stroke-width: 1.5;
  stroke-linecap: round;
}
svg .bun-c-hitl {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
svg .bun-c-hotl {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
}
svg .bun-c-auto {
  fill: var(--color-background-warning);
  stroke: var(--color-border-warning);
}

.bun-pop-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.bun-pop-h-inline {
  margin-bottom: 0;
}
.bun-pop-dur {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
