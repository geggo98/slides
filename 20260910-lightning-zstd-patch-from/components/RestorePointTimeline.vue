<!--
  Kette gegen Differenz, an einem Tagesraster.

  Die Folie beantwortet die Frage, warum das Verfahren differenziell ist und
  nicht inkrementell. Ein Klick wählt den Zeitpunkt, auf den zurückgestellt
  werden soll. Die Leiste zeigt daraufhin, welche Objekte dafür aus dem
  Speicher geholt werden müssen: in der Kette alle Glieder seit dem
  Vollbackup, in der Differenz genau zwei.

  Der Knopf "Aufbewahrung löscht ein Objekt" macht den Unterschied sichtbar.
  Im Kettenmodus reißt ein fehlendes Glied alles ab, was danach kam. In der
  Differenz kostet dasselbe Löschen genau einen Wiederherstellungspunkt.

  Welches Objekt der Knopf trifft, steht fest und ist nicht zufällig — der
  Vortrag soll jedes Mal dasselbe zeigen. Wer ein bestimmtes Objekt treffen
  will, klickt es mit gedrückter Umschalttaste an.

  Kein Zeitgeber, keine Animationsschleife: die Komponente braucht deshalb
  keine Bindung an die Sichtbarkeit der Folie.
-->
<script setup lang="ts">
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{
    /** Sekunden je Kettenglied. Gemessen: 97 Objekte brauchten rund 67 Sekunden. */
    secondsPerLink?: number;
    /** Sekunden für einen differenziellen Restore: Vollbackup plus ein Delta. */
    secondsDifferential?: number;
  }>(),
  { secondsPerLink: 0.7, secondsDifferential: 2.5 },
);

const TICKS = 24;
const START_MINUTES = 6 * 60 + 20;
const STEP_MINUTES = 45;
const LABEL_EVERY = 4;

// Feste Reihenfolge, in der die Aufbewahrungsregel zuschlägt. Bewusst keine
// Zufallszahl: derselbe Vortrag soll denselben Verlauf zeigen.
const LIFECYCLE_ORDER = [7, 15, 3, 20, 11, 18, 5, 22, 9, 13];

type Mode = "chain" | "differential";

const mode = ref<Mode>("chain");
const selected = ref(TICKS - 1);
const deleted = ref<number[]>([]);

function clockAt(tick: number): string {
  const minutes = START_MINUTES + tick * STEP_MINUTES;
  const hh = Math.floor(minutes / 60) % 24;
  const mm = minutes % 60;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

const ticks = computed(() =>
  Array.from({ length: TICKS }, (_, tick) => ({
    tick,
    clock: clockAt(tick),
    isFull: tick === 0,
    showLabel: tick % LABEL_EVERY === 0,
  })),
);

const needed = computed(() => {
  if (selected.value === 0) return [0];
  if (mode.value === "differential") return [0, selected.value];
  return Array.from({ length: selected.value + 1 }, (_, i) => i);
});

const missing = computed(() =>
  needed.value.filter((tick) => deleted.value.includes(tick)),
);
const isBroken = computed(() => missing.value.length > 0);

const seconds = computed(() => {
  if (mode.value === "differential") return props.secondsDifferential;
  return needed.value.length * props.secondsPerLink;
});

const secondsText = computed(() =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(seconds.value),
);

/**
 * Ausgewählt und gebraucht schließen sich nicht aus. Eine frühere Fassung gab
 * genau eine Klasse zurück und "is-selected" gewann — der gewählte Punkt stand
 * dann grau in einer sonst durchweg roten Leiste und sah aus, als sei er der
 * einzige heile. Deshalb eine Liste statt eines Wertes.
 */
function stateOf(tick: number): string[] {
  const classes: string[] = [];
  if (tick === selected.value) classes.push("is-selected");
  if (deleted.value.includes(tick)) classes.push("is-deleted");
  else if (needed.value.includes(tick))
    classes.push(isBroken.value ? "is-broken" : "is-needed");
  return classes;
}

/**
 * Ein zweites, farbunabhaengiges Merkmal. Die Pointe der Folie haengt daran,
 * dass man gebrochene Punkte erkennt — wer Rot und Blau nicht unterscheidet,
 * saehe sonst nur gleich gefuellte Kaesten.
 */
function glyphFor(tick: number): string {
  if (deleted.value.includes(tick)) return "×";
  if (needed.value.includes(tick)) return isBroken.value ? "!" : "✓";
  return "";
}

function ariaFor(tick: number): string {
  const parts = [clockAt(tick), tick === 0 ? "Vollbackup" : "Delta"];
  if (deleted.value.includes(tick)) parts.push("gelöscht");
  else if (needed.value.includes(tick))
    parts.push(isBroken.value ? "nicht wiederherstellbar" : "wird geladen");
  return parts.join(", ");
}

function onTick(tick: number, event: MouseEvent) {
  if (event.shiftKey) toggleDeleted(tick);
  else selected.value = tick;
}

function toggleDeleted(tick: number) {
  const at = deleted.value.indexOf(tick);
  if (at >= 0) deleted.value.splice(at, 1);
  else deleted.value.push(tick);
}

function expire() {
  const next = LIFECYCLE_ORDER.find((tick) => !deleted.value.includes(tick));
  if (next !== undefined) deleted.value.push(next);
}

function reset() {
  deleted.value = [];
  selected.value = TICKS - 1;
  mode.value = "chain";
}
</script>

<template>
  <div class="rpt">
    <div class="rpt-controls">
      <div class="rpt-toggle" role="group" aria-label="Verfahren">
        <button
          type="button"
          :class="{ 'is-on': mode === 'chain' }"
          @click.stop="mode = 'chain'"
        >
          Kette
        </button>
        <button
          type="button"
          :class="{ 'is-on': mode === 'differential' }"
          @click.stop="mode = 'differential'"
        >
          Differenz
        </button>
      </div>
      <button type="button" class="rpt-btn" @click.stop="expire">
        Aufbewahrung löscht ein Objekt
      </button>
      <button type="button" class="rpt-btn" @click.stop="reset">
        Zurücksetzen
      </button>
    </div>

    <div
      class="rpt-track"
      role="radiogroup"
      aria-label="Wiederherstellungspunkt"
    >
      <button
        v-for="item in ticks"
        :key="item.tick"
        type="button"
        role="radio"
        :aria-checked="selected === item.tick"
        :aria-label="ariaFor(item.tick)"
        :tabindex="selected === item.tick ? 0 : -1"
        :class="['rpt-tick', ...stateOf(item.tick), { 'is-full': item.isFull }]"
        @click.stop="onTick(item.tick, $event)"
      >
        <span class="rpt-bar">
          <span class="rpt-glyph" aria-hidden="true">{{
            glyphFor(item.tick)
          }}</span>
        </span>
        <span v-if="item.showLabel" class="rpt-clock">{{ item.clock }}</span>
      </button>
    </div>

    <p class="rpt-status">
      <span>Stand {{ clockAt(selected) }}</span>
      <span class="rpt-sep">·</span>
      <span
        >Objekte: <strong>{{ needed.length }}</strong></span
      >
      <span class="rpt-sep">·</span>
      <span
        >Restore <strong>{{ secondsText }} s</strong></span
      >
      <span class="rpt-sep">·</span>
      <span>gelöscht: {{ deleted.length }}</span>
      <span v-if="isBroken" class="rpt-broken">nicht wiederherstellbar</span>
    </p>

    <p class="rpt-hint">
      Ein Vollbackup um 06:20, danach je Takt ein Delta. Ein Takt entspricht
      drei Zyklen. Umschalttaste plus Klick löscht ein einzelnes Objekt.
    </p>
  </div>
</template>

<style scoped>
.rpt {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 280px;
  font-variant-numeric: tabular-nums;
}

.rpt-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rpt-toggle {
  display: inline-flex;
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--sk-rad);
  overflow: hidden;
}

.rpt-toggle button {
  padding: 0.25rem 0.7rem;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
}

.rpt-toggle button.is-on {
  background: var(--color-background-info);
  color: var(--color-text-info);
  font-weight: 600;
}

.rpt-btn {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--color-border-tertiary);
  border-radius: var(--sk-rad);
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
}

.rpt-track {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 3px;
  align-items: end;
  height: 96px;
}

.rpt-tick {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.rpt-tick:focus-visible {
  outline: 2px solid var(--color-text-info);
  outline-offset: 2px;
}

.rpt-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 34px;
  border: 1px solid var(--color-border-tertiary);
  border-radius: 3px;
  background: var(--color-background-tertiary);
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    height 160ms ease;
}

.rpt-glyph {
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary);
}

.rpt-tick.is-deleted .rpt-glyph {
  color: var(--color-text-danger);
}

.rpt-tick.is-full .rpt-bar {
  height: 64px;
  border-color: var(--color-border-info);
  background: var(--color-background-info);
}

.rpt-tick.is-needed .rpt-bar {
  border-color: var(--color-border-info);
  background: var(--color-border-info);
}

.rpt-tick.is-broken .rpt-bar {
  border-color: var(--color-border-danger);
  background: var(--color-border-danger);
}

.rpt-tick.is-deleted .rpt-bar {
  border-style: dashed;
  border-color: var(--color-border-danger);
  background: transparent;
  opacity: 0.5;
}

.rpt-tick.is-selected .rpt-bar {
  box-shadow: 0 0 0 2px var(--color-text-primary);
}

.rpt-clock {
  font-size: 0.6rem;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.rpt-status {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.rpt-status strong {
  color: var(--color-text-primary);
}

.rpt-sep {
  color: var(--color-text-tertiary);
}

.rpt-broken {
  padding: 0.05rem 0.4rem;
  border-radius: var(--sk-rad);
  background: var(--color-background-danger);
  color: var(--color-text-danger);
  font-weight: 600;
}

.rpt-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
}
</style>
