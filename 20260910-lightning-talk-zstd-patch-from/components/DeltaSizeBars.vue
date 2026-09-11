<!--
  Die Messwerte als Balken.

  Alle Zahlen stammen aus Messungen, nicht aus Schätzungen; die Herkunft
  steht je Paar in der Bildunterschrift. Die Skala ist bewusst linear und
  nicht logarithmisch: dass der letzte Balken fast verschwindet, IST die
  Aussage der Folie. Eine Log-Skala würde sie wegbügeln.

  Die Balkenbreite hängt an einer CSS-Transition. Wer weniger Bewegung
  eingestellt hat, bekommt sie ohne Übergang — dafür sorgt die Medienregel
  am Ende, ohne eine Zeile JavaScript.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import Tabs from "@shared/components/Tabs.vue";

interface Bar {
  label: string;
  mib: number;
  tone: "muted" | "mid" | "good" | "bad";
}

interface Pair {
  key: string;
  label: string;
  caption: string;
  /** Woher die Zahlen stammen. Steht als Fußzeile am Balkensatz, weil jede
   *  Reihe eine einzelne Messung an einer einzelnen Datei ist. */
  provenance: string;
  bars: Bar[];
}

const PAIRS: Pair[] = [
  {
    key: "tag",
    label: "1 Tag",
    caption:
      "Zwei Stände einer Datenbankdatei im Abstand von einem Tag, 465 auf 476 MiB.",
    provenance: "gemessen 07.09.2026 · zstd 1.5.7 · eine Datei, ein Rechner",
    bars: [
      { label: "Seiten-Diff, roh", mib: 28.9, tone: "muted" },
      { label: "Seiten-Diff, gepackt", mib: 8.3, tone: "mid" },
      { label: "Delta gegen die Basis", mib: 1.8, tone: "good" },
    ],
  },
  {
    key: "neuntage",
    label: "9 Tage",
    caption:
      "Dieselbe Mechanik über neun Tage, 405 auf 465 MiB. Das Verfahren trägt auch über längere Wege.",
    provenance: "gemessen 07.09.2026 · zstd 1.5.7 · eine Datei, ein Rechner",
    bars: [
      { label: "Seiten-Diff, roh", mib: 112, tone: "muted" },
      { label: "Delta gegen die Basis", mib: 22.5, tone: "good" },
    ],
  },
  {
    key: "bibliothek",
    label: "Bibliothek",
    caption:
      "Dieselbe C-Bibliothek, dieselben Dateien, dieselben Einstellungen, beide Male aus Python. Nur der Ladeweg der Basis ist ein anderer.",
    provenance: "gemessen 07.09.2026 · libzstd 1.5.7 · zwei Python-Pakete",
    bars: [
      { label: "als Wörterbuch geladen", mib: 111, tone: "bad" },
      { label: "als Präfix übergeben", mib: 1.8, tone: "good" },
    ],
  },
  {
    key: "browser",
    label: "Im Browser",
    caption:
      "Dieselbe Falle, dieselbe Größenordnung — und auf der nächsten Folie live vorführbar.",
    provenance:
      "gemessen 10.09.2026 · libzstd 1.5.6 als WebAssembly · 2,5 MiB Basis, 12 geänderte Seiten",
    bars: [
      { label: "ganzes Ziel gepackt", mib: 0.606, tone: "muted" },
      { label: "Delta auf Stufe 3", mib: 0.505, tone: "bad" },
      { label: "naives Seiten-Diff", mib: 0.094, tone: "mid" },
      { label: "Delta auf Stufe 9", mib: 0.022, tone: "good" },
    ],
  },
];

const pairKey = ref(PAIRS[0].key);
const tabs = computed(() =>
  PAIRS.map((pair) => ({ key: pair.key, label: pair.label })),
);
const current = computed(
  () => PAIRS.find((pair) => pair.key === pairKey.value) ?? PAIRS[0],
);
const largest = computed(() =>
  Math.max(...current.value.bars.map((bar) => bar.mib)),
);

const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const small = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function sizeText(mib: number): string {
  if (mib >= 1) return number.format(mib) + " MiB";
  return small.format(mib * 1024) + " KiB";
}

function widthOf(mib: number): string {
  return Math.max(0.6, (mib / largest.value) * 100) + "%";
}

/**
 * Der Faktor wird gerundet und als „rund" ausgewiesen. Exakt gerechnet stünde
 * bei der Bibliothek 62 auf der Folie, während der Vortrag von Faktor 60
 * spricht — zwei Zahlen für dieselbe Sache lenken ab. Ab 40 wird deshalb auf
 * Zehner gerundet, darunter auf ganze Zahlen, damit 16 und 5 scharf bleiben.
 */
const factor = computed(() => {
  const values = current.value.bars.map((bar) => bar.mib);
  const exact = Math.max(...values) / Math.min(...values);
  return exact >= 40 ? Math.round(exact / 10) * 10 : Math.round(exact);
});
</script>

<template>
  <div class="bars">
    <Tabs v-model="pairKey" :tabs="tabs" aria-label="Messpaar" />

    <div class="bars-list">
      <div v-for="bar in current.bars" :key="bar.label" class="bars-row">
        <span class="bars-label">{{ bar.label }}</span>
        <span class="bars-track">
          <span
            :class="['bars-fill', 'tone-' + bar.tone]"
            :style="{ width: widthOf(bar.mib) }"
          />
        </span>
        <span class="bars-value">{{ sizeText(bar.mib) }}</span>
      </div>
    </div>

    <p class="bars-caption">
      <span class="bars-factor">Faktor rund {{ factor }}</span>
      {{ current.caption }}
    </p>

    <p class="bars-provenance">{{ current.provenance }}</p>
  </div>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 300px;
  font-variant-numeric: tabular-nums;
}

.bars-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.bars-row {
  display: grid;
  grid-template-columns: 15rem 1fr 6rem;
  align-items: center;
  gap: 0.6rem;
}

.bars-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  text-align: right;
}

.bars-track {
  height: 20px;
  border-radius: 3px;
  background: var(--color-background-tertiary);
}

.bars-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 600ms ease;
}

.tone-muted {
  background: var(--color-text-tertiary);
}

.tone-mid {
  background: var(--color-border-info);
}

.tone-good {
  background: var(--color-border-success);
}

.tone-bad {
  background: var(--color-border-danger);
}

.bars-value {
  font-size: 0.85rem;
  color: var(--color-text-primary);
}

.bars-caption {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-tertiary);
}

.bars-provenance {
  margin: 0;
  font-size: 0.68rem;
  color: var(--color-text-tertiary);
}

.bars-factor {
  padding: 0.05rem 0.4rem;
  border-radius: var(--sk-rad);
  background: var(--color-background-success);
  color: var(--color-text-success);
  font-weight: 600;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .bars-fill {
    transition: none;
  }
}
</style>
