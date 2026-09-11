<!--
  Live-Demo: ein echtes Delta, im Browser gerechnet.

  Die Folie zeigt vier Größen für denselben Zyklus: das ganze Ziel
  komprimiert, ein naives Seiten-Diff, das Delta gegen die Basis, und
  daneben, was bei einer zu niedrigen Kompressionsstufe passiert. Die Zahlen entstehen
  während des Vortrags aus echten Aufrufen von libzstd, nicht aus einer
  Tabelle. Der Knopf am Ende rechnet das Ziel aus Basis und Delta zurück und
  vergleicht die SHA-256 — das ist die Zusage, die das ganze Verfahren trägt.

  Warum das überhaupt geht: Ein Wörterbuch ohne Kennung ist ein Präfix, und
  genau das macht `zstd --patch-from`. Am 10.09.2026 wurde in beide Richtungen
  geprüft, dass die Kommandozeile und dieses Paket dieselben Deltas lesen.

  Die Basis wird erst erzeugt, wenn die Folie sichtbar ist. Nachbarfolien
  bleiben in Slidev gemountet, und niemand soll beim Durchblättern zwei
  Megabyte Testdaten bauen.
-->
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useIsSlideActive } from "@slidev/client";
import {
  DEMO_BASE_BYTES,
  SAFE_LEVEL,
  TRAP_LEVEL,
  buildDelta,
  applyDelta,
  compressWhole,
  initZstd,
  sha256Hex,
  windowLogFor,
} from "./lib/zstdRuntime";
import {
  PAGE_BYTES,
  makeBase,
  mutate,
  naivePageDiffBytes,
} from "./lib/syntheticDb";

const APPEND_KIB = 48;
const DEBOUNCE_MS = 120;

const changedPages = ref(12);
const level = ref(SAFE_LEVEL);
const ready = ref(false);
const busy = ref(false);
const failed = ref("");
const verified = ref("");

const wholeBytes = ref(0);
const naiveBytes = ref(0);
const deltaBytes = ref(0);
const deltaMs = ref(0);

const isActive = useIsSlideActive();

let base: Uint8Array | null = null;
let target: Uint8Array | null = null;
let delta: Uint8Array | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const kib = (bytes: number) => number.format(bytes / 1024) + " KiB";
const changedKib = computed(() =>
  kib(changedPages.value * PAGE_BYTES + APPEND_KIB * 1024),
);
const windowLog = computed(() => windowLogFor(DEMO_BASE_BYTES));

/**
 * Werte fuer den Fall, dass libzstd nicht laedt — gemessen am 10.09.2026 mit
 * denselben Daten und denselben Einstellungen. Ohne sie zeigt die Folie im
 * Fehlerfall nur eine Meldung, und die Aussage des Vortrags faellt aus.
 */
const FALLBACK = {
  whole: 620.4 * 1024,
  naive: 96.1 * 1024,
  delta: 22.5 * 1024,
};

const bars = computed(() => {
  const live = ready.value && !failed.value;
  const whole = live ? wholeBytes.value : FALLBACK.whole;
  const naive = live ? naiveBytes.value : FALLBACK.naive;
  const deltaSize = live ? deltaBytes.value : FALLBACK.delta;
  const largest = Math.max(whole, naive, deltaSize, 1);
  const row = (label: string, bytes: number, tone: string) => ({
    label,
    tone,
    text: kib(bytes),
    width: Math.max(0.6, (bytes / largest) * 100) + "%",
  });
  return [
    row("ganzes Ziel gepackt", whole, "muted"),
    row("naives Seiten-Diff", naive, "mid"),
    row(
      "Delta gegen die Basis",
      deltaSize,
      level.value === SAFE_LEVEL ? "good" : "bad",
    ),
  ];
});

async function ensureReady() {
  if (ready.value || failed.value) return;
  try {
    await initZstd(import.meta.env.BASE_URL + "zstd.wasm");
    base = makeBase(DEMO_BASE_BYTES);
    ready.value = true;
    recompute();
  } catch (error) {
    failed.value = String((error as Error)?.message ?? error);
  }
}

function recompute() {
  if (!ready.value || !base) return;
  busy.value = true;
  verified.value = "";
  try {
    target = mutate(base, {
      changedPages: changedPages.value,
      appendKib: APPEND_KIB,
    }).target;
    naiveBytes.value = naivePageDiffBytes(base, target);
    const built = buildDelta(base, target, level.value);
    delta = built.bytes;
    deltaBytes.value = built.bytes.length;
    deltaMs.value = built.milliseconds;
    wholeBytes.value = compressWhole(target, SAFE_LEVEL).bytes.length;
  } catch (error) {
    failed.value = String((error as Error)?.message ?? error);
  } finally {
    busy.value = false;
  }
}

function scheduleRecompute() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(recompute, DEBOUNCE_MS);
}

async function verify() {
  if (!base || !delta || !target) return;
  busy.value = true;
  try {
    const restored = applyDelta(base, delta);
    const [a, b] = await Promise.all([
      sha256Hex(restored.bytes),
      sha256Hex(target),
    ]);
    verified.value = a === b ? a.slice(0, 12) : "";
    if (!verified.value) failed.value = "Die Prüfsummen weichen ab";
  } catch (error) {
    failed.value = String((error as Error)?.message ?? error);
  } finally {
    busy.value = false;
  }
}

/**
 * Ein Bedienelement, das den Fokus behält, verschluckt die nächste Taste vom
 * Presenter-Klicker: ein `input[type=range]` reagiert selbst auf die
 * Pfeiltasten. Deshalb gibt es den Fokus nach jeder Eingabe wieder ab —
 * dasselbe Muster wie in GuessReveal.vue.
 */
function releaseFocus(event: Event) {
  (event.currentTarget as HTMLElement | null)?.blur();
}

function setLevel(next: number, event: MouseEvent) {
  level.value = next;
  releaseFocus(event);
}

watch(isActive, (active) => active && ensureReady(), { immediate: true });
watch([changedPages, level], scheduleRecompute);
onUnmounted(() => timer && clearTimeout(timer));
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <label class="demo-slider">
        <span>geänderte Seiten</span>
        <input
          v-model.number="changedPages"
          type="range"
          min="0"
          max="320"
          step="4"
          :disabled="!ready"
          @pointerup="releaseFocus"
          @change="releaseFocus"
        />
        <span class="demo-slider-value">{{ changedPages }}</span>
      </label>
      <div class="demo-toggle" role="group" aria-label="Kompressionsstufe">
        <button
          type="button"
          :class="{ 'is-on': level === SAFE_LEVEL }"
          @click.stop="setLevel(SAFE_LEVEL, $event)"
        >
          Stufe {{ SAFE_LEVEL }}
        </button>
        <button
          type="button"
          :class="{ 'is-on': level === TRAP_LEVEL }"
          @click.stop="setLevel(TRAP_LEVEL, $event)"
        >
          Stufe {{ TRAP_LEVEL }}
        </button>
      </div>
    </div>

    <p v-if="failed" class="demo-failed">
      Gerechnet wird hier nichts mehr, die Zahlen stammen aus der Messung vom
      10.09.2026: {{ failed }}
    </p>
    <!-- Nur auf der aktiven Folie: im PDF-Export ist keine Folie aktiv, dort
         stehen die Rückfallwerte, und ein „wird geladen" wäre eine Lüge. -->
    <p v-else-if="!ready && isActive" class="demo-loading">
      libzstd wird geladen …
    </p>

    <div class="demo-bars">
      <div v-for="bar in bars" :key="bar.label" class="demo-row">
        <span class="demo-label">{{ bar.label }}</span>
        <span class="demo-track"
          ><span
            :class="['demo-fill', 'tone-' + bar.tone]"
            :style="{ width: bar.width }"
        /></span>
        <span class="demo-value">{{ bar.text }}</span>
      </div>
    </div>

    <p class="demo-status">
      <span>{{ changedKib }} geändert</span>
      <template v-if="ready">
        <span class="demo-sep">·</span>
        <span>Delta in {{ number.format(deltaMs) }} ms</span>
      </template>
      <span class="demo-sep">·</span>
      <button
        type="button"
        class="demo-btn"
        :disabled="!ready || busy"
        @click.stop="verify"
      >
        Zurückrechnen und SHA-256 prüfen
      </button>
      <span v-if="verified" class="demo-ok"
        >byteidentisch · {{ verified }} …</span
      >
    </p>

    <p class="demo-cli">
      zstd -d --long={{ windowLog }} --patch-from=basis.duckdb delta.zst -o
      ziel.duckdb
    </p>

    <p class="demo-note">
      Auf Stufe {{ TRAP_LEVEL }} wirken zwei Deckel: das Fenster begrenzt das
      Ziel, und ein zweiter begrenzt, wie viel von der Basis überhaupt indiziert
      wird. Die Kommandozeile setzt beide selbst.
    </p>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-height: 330px;
  font-variant-numeric: tabular-nums;
}

.demo-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.demo-slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.demo-slider input {
  width: 16rem;
  accent-color: var(--color-border-info);
}

.demo-slider-value {
  min-width: 2.5rem;
  color: var(--color-text-primary);
}

.demo-toggle {
  display: inline-flex;
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--sk-rad);
  overflow: hidden;
}

.demo-toggle button {
  padding: 0.25rem 0.7rem;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
}

.demo-toggle button.is-on {
  background: var(--color-background-info);
  color: var(--color-text-info);
  font-weight: 600;
}

.demo-bars {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.demo-row {
  display: grid;
  grid-template-columns: 12rem 1fr 5.5rem;
  align-items: center;
  gap: 0.6rem;
}

.demo-label {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  text-align: right;
}

.demo-track {
  height: 18px;
  border-radius: 3px;
  background: var(--color-background-tertiary);
}

.demo-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 250ms ease;
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

.demo-value {
  font-size: 0.82rem;
  color: var(--color-text-primary);
}

.demo-status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.demo-sep {
  color: var(--color-text-tertiary);
}

.demo-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border-tertiary);
  border-radius: var(--sk-rad);
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
}

.demo-ok {
  padding: 0.05rem 0.4rem;
  border-radius: var(--sk-rad);
  background: var(--color-background-success);
  color: var(--color-text-success);
  font-weight: 600;
}

.demo-cli {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
}

.demo-loading,
.demo-failed {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.demo-note {
  margin: 0;
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
}

.demo-failed {
  color: var(--color-text-danger);
}

@media (prefers-reduced-motion: reduce) {
  .demo-fill {
    transition: none;
  }
}
</style>
