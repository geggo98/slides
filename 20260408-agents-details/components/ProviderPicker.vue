<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { LOGOS, LOGO_VIEWBOX } from "./providerLogos";
import type { Option, Selection } from "./providerFilter";

// Anbieter-Auswahl für das Pareto-Chart: Auslöser-Pille plus aufklappende
// Listbox, gruppiert in Labs und Werkzeuge.
//
// Warum kein <select>: die Einträge tragen Marken-Glyphen, und <option> nimmt
// keine Bilder. Der Preis dafür sind Tastaturbedienung und ARIA von Hand — und
// die eine Falle, die man im Slidev-Kontext übersieht:
//
//   Slidev hört Pfeiltasten auf `window` ab. Solange die Liste offen ist, MUSS
//   sie ihre Tasten mit stopPropagation() abfangen, sonst blättert jeder Druck
//   auf ↓ gleichzeitig die Folie weiter.
//
// Die Liste klappt nach unten ins Chart hinein (die Legende sitzt oben), braucht
// deshalb einen deckenden Hintergrund und z-index. Höhe ist gedeckelt: bei zwölf
// Einträgen scrollt sie lieber, als unter die Folienkante zu laufen.

const props = defineProps<{
  modelValue: Selection;
  labs: Option[];
  tools: Option[];
  total: number;
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: Selection): void }>();

const open = ref(false);
const listEl = ref<HTMLElement | null>(null);
const active = ref(0);

const allOption = computed<Option>(() => ({
  value: "all",
  label: "Alle",
  count: props.total,
}));

/** Flache Liste in Menü-Reihenfolge — die Tastatur läuft über genau diese. */
const flat = computed<Option[]>(() => [
  allOption.value,
  ...props.tools,
  ...props.labs,
]);

const current = computed(
  () => flat.value.find((o) => o.value === props.modelValue) ?? allOption.value,
);

function choose(o: Option) {
  emit("update:modelValue", o.value);
  open.value = false;
}

function toggle() {
  open.value = !open.value;
  if (open.value) {
    active.value = Math.max(
      0,
      flat.value.findIndex((o) => o.value === props.modelValue),
    );
    nextTick(() => listEl.value?.focus());
  }
}

// Alle hier behandelten Tasten werden geschluckt, damit Slidev nicht mitblättert.
function onKey(e: KeyboardEvent) {
  const last = flat.value.length - 1;
  const keys = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") return void (open.value = false);
  if (e.key === "Enter" || e.key === " ")
    return choose(flat.value[active.value]);
  if (e.key === "Home") active.value = 0;
  else if (e.key === "End") active.value = last;
  else if (e.key === "ArrowDown")
    active.value = active.value >= last ? 0 : active.value + 1;
  else active.value = active.value <= 0 ? last : active.value - 1;
}

// Auf dem Auslöser: ↓ öffnet. Auch das muss geschluckt werden.
function onTriggerKey(e: KeyboardEvent) {
  if (e.key !== "ArrowDown" || open.value) return;
  e.preventDefault();
  e.stopPropagation();
  toggle();
}

watch(open, (v) => {
  const off = (e: MouseEvent) => {
    if (!(e.target as Element)?.closest?.(".pp")) open.value = false;
  };
  if (v) document.addEventListener("mousedown", off, { once: true });
});

const idFor = (i: number) => `pp-opt-${i}`;
const indexOf = (o: Option) => flat.value.indexOf(o);
</script>

<template>
  <div class="pp">
    <button
      class="pp-trigger"
      :class="{ on: modelValue !== 'all' }"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="`Anbieter filtern, aktuell ${current.label}`"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <svg
        v-if="current.logo && LOGOS[current.logo]"
        class="pp-logo"
        :viewBox="LOGO_VIEWBOX"
        aria-hidden="true"
      >
        <path :d="LOGOS[current.logo]" />
      </svg>
      {{ current.label }}
      <span class="pp-note">{{ current.count }} ▾</span>
    </button>

    <ul
      v-if="open"
      ref="listEl"
      class="pp-list"
      role="listbox"
      tabindex="-1"
      :aria-activedescendant="idFor(active)"
      aria-label="Anbieter"
      @keydown="onKey"
    >
      <li
        :id="idFor(0)"
        class="pp-opt"
        :class="{ sel: modelValue === 'all', act: active === 0 }"
        role="option"
        :aria-selected="modelValue === 'all'"
        @click="choose(allOption)"
        @mousemove="active = 0"
      >
        <span class="pp-logo pp-logo-empty" />
        <span class="pp-name">Alle</span>
        <span class="pp-n">{{ total }}</span>
      </li>

      <template v-for="(grp, gi) in [tools, labs]" :key="gi">
        <li class="pp-grp" role="presentation">
          {{ gi === 0 ? "Werkzeuge" : "Labs" }}
        </li>
        <li
          v-for="o in grp"
          :id="idFor(indexOf(o))"
          :key="String(o.value)"
          class="pp-opt"
          :class="{ sel: modelValue === o.value, act: active === indexOf(o) }"
          role="option"
          :aria-selected="modelValue === o.value"
          :title="o.caveat"
          @click="choose(o)"
          @mousemove="active = indexOf(o)"
        >
          <svg
            v-if="o.logo && LOGOS[o.logo]"
            class="pp-logo"
            :viewBox="LOGO_VIEWBOX"
            aria-hidden="true"
          >
            <path :d="LOGOS[o.logo]" />
          </svg>
          <span v-else class="pp-logo pp-mono" aria-hidden="true">{{
            o.label.slice(0, 2)
          }}</span>
          <span class="pp-name">{{ o.label }}</span>
          <span class="pp-n">{{ o.count }}</span>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
.pp {
  position: relative;
}

/* Bewusst eigene Regeln statt der `.mp-tg` aus ModelRoutingPareto.vue: Vue
   gibt scoped CSS nur an das Wurzelelement einer Kindkomponente weiter, nicht
   an deren Inneres. Der Knopf trug die Klasse `mp-tg` und bekam trotzdem NICHTS
   davon — kein Rahmen, kein Padding, `inline-block` statt `inline-flex`. Mit
   Logo brach der Inhalt dadurch auf zwei Zeilen (22 px auf 36 px).
   Die Werte spiegeln `.mp-tg`, damit beide Bedienelemente gleich aussehen; eine
   Änderung dort muss hier nachgezogen werden. `align-items` weicht ab: `.mp-tg`
   richtet an der Grundlinie aus, hier muss das Glyph mittig zur Schrift sitzen. */
.pp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  background: none;
  font: inherit;
  white-space: nowrap;
  color: var(--color-text-tertiary);
  cursor: pointer;
}

.pp-trigger:hover {
  color: var(--color-text-secondary);
}

.pp-trigger.on {
  border-color: var(--color-text-info);
  background: color-mix(in srgb, var(--color-text-info) 12%, transparent);
  color: var(--color-text-primary);
}

.pp-note {
  font-size: 9.5px;
  opacity: 0.7;
}

.pp-logo {
  width: 11px;
  height: 11px;
  flex: none;
  fill: currentColor;
  fill-rule: evenodd;
}

.pp-logo-empty {
  display: inline-block;
}

/* Kein Glyph vorhanden (JetBrains) — lieber ein ehrliches Kürzel als ein
   nachgebautes Logo. */
.pp-mono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0.5px solid currentColor;
  border-radius: 2px;
  font-size: 6.5px;
  font-weight: 600;
  letter-spacing: -0.02em;
  opacity: 0.8;
}

.pp-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  max-height: 400px;
  min-width: 176px;
  overflow-y: auto;
  margin: 0;
  padding: 3px;
  list-style: none;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 7px;
  background: var(--color-background-tertiary);
  box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
}

.pp-grp {
  padding: 5px 7px 2px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.pp-opt {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.pp-opt.act {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
}

.pp-opt.sel {
  color: var(--color-text-primary);
  font-weight: 600;
}

.pp-name {
  flex: 1;
}

.pp-n {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 9.5px;
  color: var(--color-text-tertiary);
}
</style>
