<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { Pt } from "./paretoData";
import {
  PRESETS,
  labRows,
  matchingPreset,
  presetModels,
  toggleLab,
  type LabRow,
  type ModelSet,
  type Preset,
} from "./providerFilter";
import { LOGOS, LOGO_VIEWBOX } from "./providerLogos";

// Anbieter-Auswahl für das Pareto-Chart: Auslöser-Pille plus aufklappendes Menü
// mit zwei Sorten Einträgen.
//
//   Werkzeuge = Presets. Ein Klick überschreibt die Auswahl und SCHLIESST das
//               Menü — das ist eine fertige Aussage, das Chart soll sofort zu
//               sehen sein.
//   Labs      = Checkboxen. Ein Klick schaltet um und lässt das Menü OFFEN,
//               denn hier stellt man etwas zusammen. Esc oder Klick daneben
//               beendet. Die linke Chart-Hälfte bleibt dabei sichtbar, man sieht
//               die Front also mitwandern.
//
// Ein Lab kann „teilweise" enthalten sein, weil Presets Modellmengen schreiben
// und nicht Lab-Häkchen (die Begründung steht in `providerFilter.ts`). Der
// dritte Zustand wird deshalb auch dargestellt: Strich statt Haken und der
// Zähler als „2/4".
//
// Warum kein <select>: die Einträge tragen Marken-Glyphen und Checkboxen,
// <option> nimmt keine Bilder. Der Preis dafür sind Tastatur und ARIA von Hand
// — und die Falle, die man im Slidev-Kontext übersieht:
//
//   Slidev hört Pfeiltasten auf `window` ab. Solange das Menü offen ist, MUSS
//   es seine Tasten mit stopPropagation() abfangen, sonst blättert jeder Druck
//   auf ↓ gleichzeitig die Folie weiter.
//
// Das Menü klappt nach unten ins Chart hinein (die Legende sitzt oben), braucht
// deshalb einen deckenden Hintergrund und z-index.

const props = defineProps<{ modelValue: ModelSet; pts: Pt[] }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: ReadonlySet<string>): void;
}>();

const open = ref(false);
const menuEl = ref<HTMLElement | null>(null);
const active = ref(0);

interface PresetZeile {
  preset: Preset;
  anzahl: number;
}
/** Für die Tastatur: eine flache Folge über beide Gruppen. */
type Zeile = { art: "preset"; z: PresetZeile } | { art: "lab"; z: LabRow };

const presets = computed<PresetZeile[]>(() =>
  PRESETS.map((preset) => ({
    preset,
    anzahl: presetModels(preset.id, props.pts).length,
  })),
);
const labs = computed<LabRow[]>(() => labRows(props.modelValue, props.pts));

const flat = computed<Zeile[]>(() => [
  ...presets.value.map((z) => ({ art: "preset" as const, z })),
  ...labs.value.map((z) => ({ art: "lab" as const, z })),
]);

/** Deckt sich die Auswahl mit einem Preset, trägt der Auslöser dessen Namen. */
const treffer = computed(() => matchingPreset(props.modelValue, props.pts));
const gefiltert = computed(() => props.modelValue.size !== props.pts.length);

function waehlePreset(z: PresetZeile) {
  emit("update:modelValue", new Set(presetModels(z.preset.id, props.pts)));
  open.value = false; // fertige Aussage — Chart soll sofort zu sehen sein
}

function schalteLab(l: LabRow) {
  emit("update:modelValue", toggleLab(props.modelValue, l.lab, props.pts));
  // Menü bleibt offen: hier stellt man etwas zusammen.
}

function aktivieren(z: Zeile) {
  if (z.art === "preset") waehlePreset(z.z);
  else schalteLab(z.z);
}

function toggleMenu() {
  open.value = !open.value;
  if (open.value) {
    const i = flat.value.findIndex(
      (r) => r.art === "preset" && r.z.preset.id === treffer.value?.id,
    );
    active.value = Math.max(0, i);
    nextTick(() => menuEl.value?.focus());
  }
}

// Alle hier behandelten Tasten werden geschluckt, damit Slidev nicht mitblättert.
function onKey(e: KeyboardEvent) {
  const last = flat.value.length - 1;
  if (
    !["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(
      e.key,
    )
  )
    return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") return void (open.value = false);
  if (e.key === "Enter" || e.key === " ")
    return aktivieren(flat.value[active.value]);
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
  toggleMenu();
}

// Sauber an- und abmelden. Vorher stand hier `{ once: true }` — der erste
// Mausklick IRGENDWO verbrauchte den Handler, auch einer im Menü selbst.
// Solange jeder Klick das Menü ohnehin schloss, fiel das nicht auf; mit
// Checkboxen bleibt es offen, und danach schloss Klicken daneben nicht mehr.
function onDocDown(e: MouseEvent) {
  if (!(e.target as Element)?.closest?.(".pp")) open.value = false;
}
watch(open, (v) => {
  if (v) document.addEventListener("mousedown", onDocDown);
  else document.removeEventListener("mousedown", onDocDown);
});
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocDown));

const idFor = (i: number) => `pp-opt-${i}`;
const kuerzel = (name: string) => name.slice(0, 2);
const ariaChecked = (l: LabRow) =>
  l.zustand === "an" ? "true" : l.zustand === "teilweise" ? "mixed" : "false";
</script>

<template>
  <div class="pp">
    <button
      class="pp-trigger"
      :class="{ on: gefiltert }"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="`Anbieter filtern, aktuell ${treffer?.label ?? 'eigene Auswahl'}`"
      @click="toggleMenu"
      @keydown="onTriggerKey"
    >
      <svg
        v-if="treffer?.logo && LOGOS[treffer.logo]"
        class="pp-logo"
        :viewBox="LOGO_VIEWBOX"
        aria-hidden="true"
      >
        <path :d="LOGOS[treffer.logo]" />
      </svg>
      {{ treffer?.label ?? "Auswahl" }}
      <span class="pp-note">{{ modelValue.size }} ▾</span>
    </button>

    <ul
      v-if="open"
      ref="menuEl"
      class="pp-list"
      role="menu"
      tabindex="-1"
      :aria-activedescendant="idFor(active)"
      aria-label="Anbieter"
      @keydown="onKey"
    >
      <li class="pp-grp" role="presentation">Werkzeuge</li>
      <li
        v-for="(z, i) in presets"
        :id="idFor(i)"
        :key="z.preset.id"
        class="pp-opt"
        :class="{ sel: treffer?.id === z.preset.id, act: active === i }"
        role="menuitem"
        :title="z.preset.caveat"
        @click="waehlePreset(z)"
        @mousemove="active = i"
      >
        <span class="pp-box pp-box-leer" aria-hidden="true" />
        <svg
          v-if="z.preset.logo && LOGOS[z.preset.logo]"
          class="pp-logo"
          :viewBox="LOGO_VIEWBOX"
          aria-hidden="true"
        >
          <path :d="LOGOS[z.preset.logo]" />
        </svg>
        <span
          v-else-if="z.preset.logo"
          class="pp-logo pp-mono"
          aria-hidden="true"
          >{{ kuerzel(z.preset.label) }}</span
        >
        <span v-else class="pp-logo pp-logo-leer" aria-hidden="true" />
        <span class="pp-name">{{ z.preset.label }}</span>
        <span class="pp-n">{{ z.anzahl }}</span>
      </li>

      <li class="pp-grp" role="presentation">Labs</li>
      <li
        v-for="(l, i) in labs"
        :id="idFor(presets.length + i)"
        :key="l.lab"
        class="pp-opt"
        :class="{
          sel: l.zustand !== 'aus',
          act: active === presets.length + i,
        }"
        role="menuitemcheckbox"
        :aria-checked="ariaChecked(l)"
        @click="schalteLab(l)"
        @mousemove="active = presets.length + i"
      >
        <svg class="pp-box" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="0.7" y="0.7" width="10.6" height="10.6" rx="2.6" />
          <path v-if="l.zustand === 'an'" d="M3.1 6.2 5.2 8.3 9 4.2" />
          <path v-else-if="l.zustand === 'teilweise'" d="M3.4 6h5.2" />
        </svg>
        <svg
          v-if="LOGOS[l.logo]"
          class="pp-logo"
          :viewBox="LOGO_VIEWBOX"
          aria-hidden="true"
        >
          <path :d="LOGOS[l.logo]" />
        </svg>
        <span v-else class="pp-logo pp-mono" aria-hidden="true">{{
          kuerzel(l.lab)
        }}</span>
        <span class="pp-name">{{ l.lab }}</span>
        <span class="pp-n">{{ l.drin }}/{{ l.gesamt }}</span>
      </li>
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

.pp-logo-leer {
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

/* Tri-State-Kästchen. Als SVG statt CSS-Pseudoelement, weil ein Haken bei 10 px
   Kantenlänge sonst zur Pixelfrage wird. */
.pp-box {
  width: 10px;
  height: 10px;
  flex: none;
  opacity: 0.75;
}

.pp-box rect {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
}

.pp-box path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pp-box-leer {
  display: inline-block;
}

.pp-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  max-height: 400px;
  min-width: 196px;
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
