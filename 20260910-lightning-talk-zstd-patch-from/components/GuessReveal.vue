<!--
  Schätzfrage mit Auflösung.

  Der Vortrag lebt davon, dass das Publikum dreimal daneben tippt: bei der
  Größe eines rdiff-Deltas, beim Speicherbedarf von bsdiff und beim
  Unterschied zwischen zwei Bibliotheken derselben C-Bibliothek. Erst die
  eigene falsche Schätzung macht die Zahl merkwürdig genug, um zu bleiben.

  Bedienung: Ein Klick auf eine Option markiert nur den Tipp des Publikums.
  Aufgelöst wird über die Weiter-Taste, also über `clicks` aus dem
  Folien-Frontmatter (`clicks: 1`) — der Vortragende steht am Klicker und
  nicht an der Maus. Der Knopf daneben ist der Rückfall für Maus und Touch.

  Die Auflösung liegt von Anfang an im Layout und ist nur unsichtbar, damit
  die Folie beim Auflösen nicht springt. Der Zähler läuft über
  requestAnimationFrame und wird übersprungen, wenn das System weniger
  Bewegung wünscht oder die Folie gar nicht sichtbar ist — Nachbarfolien
  bleiben in Slidev gemountet.
-->
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useIsSlideActive } from "@slidev/client";
import { usePrefersReducedMotion } from "@shared/components/brainless/lib/usePrefersReducedMotion";

interface GuessOption {
  label: string;
  hint?: string;
}

interface RevealSpec {
  number: number;
  unit: string;
  note: string;
  decimals?: number;
}

const props = withDefaults(
  defineProps<{
    question: string;
    options: GuessOption[];
    answerIndex: number;
    reveal: RevealSpec;
    clicks?: number;
    revealLabel?: string;
  }>(),
  { clicks: 0, revealLabel: "Auflösen" },
);

const guess = ref<number | null>(null);
const forced = ref(false);
const focusIndex = ref(0);
const shown = ref(0);

const isActive = useIsSlideActive();
const reducedMotion = usePrefersReducedMotion();

const revealed = computed(() => props.clicks >= 1 || forced.value);
const decimals = computed(() => props.reveal.decimals ?? 2);

const formatter = computed(
  () =>
    new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: decimals.value,
      maximumFractionDigits: decimals.value,
    }),
);

const shownText = computed(() => formatter.value.format(shown.value));

const missed = computed(
  () => guess.value !== null && guess.value !== props.answerIndex,
);

let frame = 0;

function stopCounter() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

function runCounter() {
  stopCounter();
  const target = props.reveal.number;
  if (reducedMotion.value || !isActive.value) {
    shown.value = target;
    return;
  }
  const duration = 900;
  let started = 0;
  const step = (now: number) => {
    if (!started) started = now;
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    shown.value = target * eased;
    if (progress < 1) frame = requestAnimationFrame(step);
    else frame = 0;
  };
  frame = requestAnimationFrame(step);
}

watch(revealed, (open) => {
  if (open) runCounter();
  else {
    stopCounter();
    shown.value = 0;
  }
});

watch(isActive, (active) => {
  if (!active) stopCounter();
});

onUnmounted(stopCounter);

function pick(index: number, event: MouseEvent) {
  guess.value = index;
  focusIndex.value = index;
  // Fokus sofort wieder abgeben, sonst landet die nächste Taste hier statt
  // beim Vortrag. Siehe die Anmerkung an onKeydown.
  (event.currentTarget as HTMLElement | null)?.blur();
}

/**
 * Die Pfeiltasten nach links und rechts gehören dem Vortrag, nicht dieser
 * Komponente. Wer eine Option anklickt, hat sie danach fokussiert; fange ich
 * hier ArrowRight ab, drückt der Vortragende am Klicker und auf der Folie
 * passiert nichts. Genau das ist am 10.09.2026 im Prüflauf passiert, und es
 * wäre im Vortrag passiert.
 *
 * Für die Bedienung ohne Maus bleiben Hoch, Runter, Pos1 und Ende.
 */
function onKeydown(event: KeyboardEvent) {
  const last = props.options.length - 1;
  const moves: Record<string, number> = {
    ArrowDown: Math.min(last, focusIndex.value + 1),
    ArrowUp: Math.max(0, focusIndex.value - 1),
    Home: 0,
    End: last,
  };
  const next = moves[event.key];
  if (next === undefined) return;
  event.preventDefault();
  focusIndex.value = next;
  const group = event.currentTarget as HTMLElement;
  const buttons = group.querySelectorAll<HTMLButtonElement>("[role='radio']");
  buttons[next]?.focus();
}

function optionClass(index: number) {
  if (!revealed.value) return guess.value === index ? "is-guess" : "";
  if (index === props.answerIndex) return "is-correct";
  if (guess.value === index) return "is-wrong";
  return "is-dim";
}
</script>

<template>
  <div class="guess">
    <p class="guess-question">{{ question }}</p>

    <div
      class="guess-options"
      role="radiogroup"
      :aria-label="question"
      @keydown="onKeydown"
    >
      <button
        v-for="(option, index) in options"
        :key="option.label"
        type="button"
        role="radio"
        :aria-checked="guess === index"
        :tabindex="focusIndex === index ? 0 : -1"
        :class="['guess-option', optionClass(index)]"
        @click.stop="pick(index, $event)"
      >
        <span class="guess-option-label">{{ option.label }}</span>
        <span v-if="option.hint" class="guess-option-hint">{{
          option.hint
        }}</span>
      </button>
    </div>

    <div class="guess-reveal" :class="{ 'is-open': revealed }">
      <div class="guess-number">
        <span class="guess-value">{{ shownText }}</span>
        <span class="guess-unit">{{ reveal.unit }}</span>
      </div>
      <p class="guess-note">{{ reveal.note }}</p>
      <p v-if="missed" class="guess-missed">
        Danebengetippt ist hier die Regel, nicht die Ausnahme.
      </p>
    </div>

    <button
      v-if="!revealed"
      type="button"
      class="guess-force"
      @click.stop="forced = true"
    >
      {{ revealLabel }}
    </button>
  </div>
</template>

<style scoped>
.guess {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 380px;
  font-variant-numeric: tabular-nums;
}

.guess-question {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-text-primary);
}

.guess-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.guess-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.6rem 0.4rem;
  border: 2px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    opacity 180ms ease;
}

.guess-option:focus-visible {
  outline: 2px solid var(--color-text-info);
  outline-offset: 2px;
}

.guess-option-hint {
  font-size: 0.7rem;
  color: var(--color-text-tertiary);
}

.guess-option.is-guess {
  border-color: var(--color-border-info);
  background: var(--color-background-info);
}

.guess-option.is-correct {
  border-color: var(--color-border-success);
  background: var(--color-background-success);
  color: var(--color-text-success);
}

.guess-option.is-wrong {
  border-color: var(--color-border-danger);
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}

.guess-option.is-dim {
  opacity: 0.45;
}

.guess-reveal {
  min-height: 132px;
  visibility: hidden;
}

.guess-reveal.is-open {
  visibility: visible;
}

.guess-number {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.guess-value {
  font-size: 2.6rem;
  line-height: 1.1;
  font-weight: 600;
  color: var(--color-text-success);
}

.guess-unit {
  font-size: 1.2rem;
  color: var(--color-text-secondary);
}

.guess-note {
  margin: 0.3rem 0 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.guess-missed {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
}

.guess-force {
  align-self: flex-start;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--sk-rad);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
