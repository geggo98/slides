<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onSlideEnter, onSlideLeave, useSlideContext } from "@slidev/client";
import BunPopover from "./BunPopover.vue";
import CodexPermissions from "@shared/components/brainless/codex/CodexPermissions.vue";

// ⓘ neben „Von Hand (TUI)“ auf der Codex-Effort-Folie: zeigt den Dialog, den
// Codex im Plan-Mode nach `/model` öffnet, nachgebaut mit dem brainless-Port.
//
// Klick-Schritt der Folie: 1 = Popup offen, alles andere = zu. So erscheint
// der Dialog im Vortrag über den Klicker im Presenter- UND im Publikums-
// fenster (`$clicks` läuft synchron). Das ⓘ, Escape und der Overlay-Klick
// wirken nur im eigenen Fenster — fürs Publikum also mit dem Klicker öffnen
// und schließen. Der Schritt hat Vorrang: `watch` für Klicks auf der Folie,
// `onSlideEnter` für die Rückkehr auf Klick 1 nach einem Sprung (der Watcher
// feuert dann nicht, weil der Schritt sich nicht geändert hat),
// `onSlideLeave` schließt, damit kein Popup auf einer verlassenen Folie
// stehen bleibt.
const props = withDefaults(defineProps<{ step?: number }>(), { step: 0 });
const open = ref(false);

// Nur die Hauptansicht (Publikum "slide", Presenter "presenter") reagiert auf
// Hand, Escape und Overlay-Klick. Die „Next“-Vorschau des Presenters
// ("previewNext") hört sonst denselben window-keydown von BunPopover mit und
// zeigt nach Escape (= Slidevs hide_overview) Klick 1 ohne den Dialog.
const { $renderContext } = useSlideContext();
const interactive = computed(() =>
  ["slide", "presenter"].includes($renderContext.value),
);
watch(
  () => props.step,
  (s) => {
    open.value = s === 1;
  },
  { immediate: true },
);
onSlideEnter(() => {
  open.value = props.step === 1;
});
onSlideLeave(() => {
  open.value = false;
});

// Strings wörtlich aus openai/codex rust-v0.154.0: tui/src/chatwidget.rs
// L184-186 (PLAN_MODE_REASONING_SCOPE_*) und chatwidget/model_popups.rs
// open_plan_reasoning_scope_prompt. Ausgangslage VOR dem Dialog: noch kein
// Plan-Override (plan_mode_reasoning_effort unset), im Plan-Mode `/model` →
// xhigh; die TOML-Zeile auf der Folie ist das Ergebnis von Option 1. Das
// „(medium)“ der zweiten Beschreibung ist der fest eingebaute Plan-Preset-
// Wert (models-manager/src/collaboration_mode_presets.rs), den die TUI per
// collaborationMode/list erhält — unabhängig vom globalen
// model_reasoning_effort und vom Modell (Test
// plan_reasoning_scope_popup_mentions_built_in_plan_default_when_no_override).
const OPTIONS = [
  {
    label: "Apply to Plan mode override",
    description: "Always use extra high reasoning in Plan mode.",
  },
  {
    label: "Apply to global default and Plan mode override",
    description:
      "Set the global default reasoning level and the Plan mode override. This replaces the current built-in Plan default (medium).",
  },
];

// Fokus abgeben, sonst frisst der fokussierte Button den nächsten Klicker-
// Pfeil (Slidev schaltet Shortcuts ab, solange ein Button fokussiert ist).
// Sofort und verzögert, wie in CodexEffortBreakEven.vue.
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();
function toggle() {
  if (!interactive.value) return;
  open.value = !open.value;
  blurActive();
  setTimeout(blurActive, 0);
}
function onClose() {
  if (interactive.value) open.value = false;
}
</script>

<template>
  <span class="crs-root">
    <button
      class="crs-ib"
      type="button"
      aria-label="Codex-Dialog „Apply reasoning change“ anzeigen"
      @click="toggle"
    >
      ⓘ
    </button>
    <BunPopover :open="open" wide @close="onClose">
      <div class="bun-pop-h">
        Codex TUI · Plan-Mode · <code>/model</code> → xhigh
      </div>
      <!-- inert: der Nachbau ist eine Abbildung, kein Bedienelement — seine
           Radio-Zeilen dürfen weder Fokus noch Enter/Space vom Klicker
           abfangen. Ein Klick darauf trifft die Karte darunter und schließt
           das Popup wie jeder andere Klick. -->
      <div class="crs-pane" inert>
        <CodexPermissions
          title="Apply reasoning change"
          subtitle="Choose where to apply extra high reasoning."
          columns
          :options="OPTIONS"
        />
      </div>
      <div class="bun-pop-meta">
        Enter übernimmt Option 1: Codex schreibt
        <code>plan_mode_reasoning_effort = "xhigh"</code> in die config.toml,
        <code>model_reasoning_effort</code> bleibt medium.
      </div>
    </BunPopover>
  </span>
</template>

<style scoped>
.crs-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  vertical-align: -1px;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.crs-ib:hover {
  color: var(--color-text-primary);
}
/* Terminal-Pane wie .sim-pane im Anatomy-Deck: dunkel in beiden Themes. */
.crs-pane {
  --cxp-font-size: 12px;
  padding: 8px 12px 10px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
}
</style>
