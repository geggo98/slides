<script setup lang="ts">
/**
 * Codex-TUI-Nachbau für die Erklärfolie „xhigh plant, medium führt aus“:
 * zeigt in acht Klick-Schritten (`step` = $clicks), wie man erst das Modell
 * (global) und dann im Plan-Mode per `/model` den Reasoning-Effort nur für
 * Plan-Mode setzt. Gebaut aus dem brainless-Port
 * (shared/components/brainless/codex/); Composer, Slash-Zeile und
 * Statuszeile sind hier nachgezeichnet, weil CodexPrompt/CodexSlashMenu ein
 * echtes <input> mitbringen und der Nachbau nur Abbildung ist (`inert`).
 *
 * Schritte (Texte wörtlich aus fünf Screenshots Codex CLI 0.156.1,
 * 23.09.2026, Katalog-Erweiterung um GPT-6 Sol/Luna vom selben Tag):
 *   0 leerer Composer, GPT-5.6-Sol medium (das ALTE Sol) · 1 „/model“ wird
 *   getippt, dann die Modellwahl — Cursor auf Zeile 1, GPT-6-Sol (default);
 *   GPT-5.6-Sol trägt „(current)“ · 2 Reasoning Level für GPT-6-Sol, Cursor
 *   bleibt auf Medium (default) · 3 „Model changed to gpt-6-sol medium“ —
 *   das schreibt model und model_reasoning_effort GLOBAL (Meldung bleibt
 *   der Slug, nicht der Anzeigename — Header/Status zeigen „GPT-6-Sol“, die
 *   Meldung „gpt-6-sol“, beides belegt) · 4 „/plan“ wird getippt, danach
 *   „Plan mode“ · 5 „/model“ erneut, GPT-6-Sol ist jetzt current und bleibt
 *   es · 6 Reasoning Level, Cursor wandert Medium → Extra high · 7 „Apply
 *   reasoning change“ · 8 „… xhigh for Plan mode.“
 *
 * Warum GPT-5.6-Sol → GPT-6-Sol statt (wie bis 22.09.) Terra → Sol: die
 * Screenshots zeigen echten Katalogstand vom Erscheinungstag — GPT-6-Sol
 * steht als Default an Position 1 (das Backend-Ranking weicht vom
 * gebündelten Fallback-Katalog ab, der Astra zuerst listet; Ground Truth
 * ist der Screenshot), GPT-5.6-Sol war schon vorher aktiv. Der Umstieg auf
 * das neue Sol ist die naheliegendere Erzählung als ein Sprung über zwei
 * Generationen; GPT-6 Terra existiert nicht (Faktencheck auf der
 * codex-effort-Folie).
 *
 * Anzeigenamen statt Slugs (seit PR openai/codex#46503, 18.09.2026, in
 * 0.156): Picker, Reasoning-Titel, Header und Statuszeile zeigen
 * „GPT-6-Sol“ — nur die Ergebnis-Meldungen („Model changed to …“) bleiben
 * beim Slug `gpt-6-sol`. Der Untertitel „Access legacy models…“ unter
 * „Select Model and Effort“ ist mit derselben PR weggefallen (Screenshots
 * zeigen keinen mehr). Die Fußzeile variiert seit PR #45831/#46697 je
 * Dialogtyp: „enter select · esc back“ für Modell- und Scope-Dialog,
 * „enter default · s session · esc back“ für die Reasoning-Wahl (der neue
 * `s`-Weg wendet die Wahl nur für diese Session an) — siehe FOOTER_PICKER/
 * FOOTER_REASONING unten und die Deviation-Notiz in
 * shared/components/brainless/README.md.
 *
 * Warum zweimal /model: Die TUI fragt nach dem Plan-Override nur, wenn im
 * Plan-Mode das AKTUELLE Modell gewählt wird und sich nur der Effort ändert
 * (should_prompt_plan_mode_reasoning_scope, tui/src/chatwidget/
 * model_popups.rs, rust-v0.156.1: `selected_model != self.current_model()`
 * → kein Dialog). Ein Modellwechsel im Plan-Mode schreibt stattdessen
 * model und model_reasoning_effort global (Issue openai/codex#38236).
 *
 * Animation nur bei Vorwärtsklick um genau einen Schritt; Rückwärts, Sprung
 * (onSlideEnter) und prefers-reduced-motion zeigen den Endzustand sofort.
 * Timer werden beim Verlassen der Folie gelöscht (Port-Regel des
 * brainless-README). Wie die Spinner in AgentRunSim läuft die Tipp-
 * Animation je Fenster; synchron über Presenter und Publikum sind nur die
 * Klicks.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onSlideLeave, useIsSlideActive } from "@slidev/client";
import CodexHeader from "@shared/components/brainless/codex/CodexHeader.vue";
import CodexMessage from "@shared/components/brainless/codex/CodexMessage.vue";
import CodexPermissions from "@shared/components/brainless/codex/CodexPermissions.vue";
import { usePrefersReducedMotion } from "@shared/components/brainless/lib/usePrefersReducedMotion";

const props = withDefaults(defineProps<{ step?: number }>(), { step: 0 });

const VERSION = "v0.156.1";
// Easter Egg fürs Publikum: das Verzeichnis dieses Decks.
const DIRECTORY = "~/slides";
// Anzeigenamen (Header/Status, seit #46503); die Ergebnis-Meldungen
// unten bleiben beim Slug, s. ERGEBNIS.
const MODEL_VORHER = "GPT-5.6-Sol medium";
const MODEL_GLOBAL = "GPT-6-Sol medium";
const MODEL_NACHHER = "GPT-6-Sol xhigh";
const PLACEHOLDER = "Ask Codex to do anything";

// Slash-Zeile unter dem Composer, Optik wie CodexSlashMenu (aktive Zeile).
const SLASH = {
  name: "/model",
  description: "choose what model and reasoning effort to use",
};

// Dialoge je Schritt. `Select Model and Effort` und `Select Reasoning Level`
// nach fünf Screenshots der TUI 0.156.1 (23.09.2026); die Scope-Optionen
// wörtlich aus openai/codex rust-v0.156.1 (tui/src/chatwidget.rs L181-183,
// PLAN_MODE_REASONING_SCOPE_*, unverändert seit 0.154.0). Das „(medium)“
// der zweiten Beschreibung ist der eingebaute Plan-Preset-Wert
// (collaboration_mode_presets.rs), den die TUI unabhängig vom globalen
// model_reasoning_effort meldet — der Screenshot dieser Session zeigte hier
// „user-chosen Plan override (extra high)“ statt dessen, weil das
// Test-Verzeichnis den Ablauf für die Screenshots zuvor schon einmal
// durchlaufen hatte (die Beschreibung ist dynamisch,
// model_popups.rs L381-403); die Folie zeigt bewusst den Erststand.
// `current` wandert nach der ersten Wahl von GPT-5.6-Sol zu GPT-6-Sol. Die
// TUI zeigt je Zeile nur EINEN Marker, „(current)“ schlägt „(default)“
// (tui/src/bottom_pane/list_selection_view.rs, rust-v0.156.1: `if
// item.is_current { " (current)" } else if item.is_default { " (default)" }`)
// — in der zweiten Modellwahl heißt GPT-6-Sol also nur noch „(current)“.
// Reihenfolge und Default-Markierung sind Backend-Zustand vom
// Erscheinungstag (Screenshot), nicht der gebündelte Fallback-Katalog, der
// Astra zuerst listet.
const modelOptions = (current: "gpt-5.6-sol" | "gpt-6-sol") => [
  {
    label: current === "gpt-6-sol" ? "GPT-6-Sol" : "GPT-6-Sol (default)",
    current: current === "gpt-6-sol",
    description: "Workhorse model for coding and everyday work.",
  },
  {
    label: "GPT-6-Astra",
    description: "Frontier intelligence for the most demanding work.",
  },
  {
    label: "GPT-6-Luna",
    description: "Fast and affordable model for easier tasks.",
  },
  {
    label: "GPT-5.6-Sol",
    current: current === "gpt-5.6-sol",
    description: "Older coding model for complex work.",
  },
  {
    label: "GPT-5.6-Terra",
    description: "Older balanced model for straightforward work.",
  },
  {
    label: "GPT-5.6-Luna",
    description: "Older fast and efficient model.",
  },
  {
    label: "GPT-5.5",
    description: "Legacy coding model.",
  },
];
const MODEL_OPTIONS = modelOptions("gpt-5.6-sol");
const MODEL_OPTIONS_2 = modelOptions("gpt-6-sol");
const REASONING_OPTIONS = [
  { label: "Low", description: "Fast responses with lighter reasoning" },
  {
    label: "Medium (default)",
    description: "Balances speed and reasoning depth for everyday tasks",
  },
  {
    label: "High",
    description: "Greater reasoning depth for complex problems",
  },
  {
    label: "Extra high",
    description: "Extra high reasoning depth for complex problems",
  },
  {
    label: "More reasoning…",
    description: "Max and Ultra consume usage limits faster",
  },
];
const SCOPE_OPTIONS = [
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
// Cursorlauf im Reasoning-Dialog: Start Medium (1), Ziel Extra high (3).
const REASONING_START = 1;
const REASONING_ZIEL = 3;
const REASONING_HOP_MS = 260;

// Schritt 0 (leerer Composer) hat keinen eigenen Eintrag: er ist der
// Endzustand ohne Dialog, Eingabe und Plan-Mode (s. zeigeEndzustand).
const STEP = {
  modelTippen1: 1,
  reasoning1: 2,
  ergebnis1: 3,
  planTippen: 4,
  modelTippen2: 5,
  reasoning2: 6,
  scope: 7,
  ergebnis2: 8,
} as const;

// Fußzeilen je Dialogtyp (Screenshots 0.156.1, 23.09.2026) — s. Deviation-
// Notiz in shared/components/brainless/README.md.
const FOOTER_PICKER = "enter select · esc back";
const FOOTER_REASONING = "enter default · s session · esc back";

// Der Untertitel „Access legacy models by running codex -m …“ ist mit
// PR #46503 (18.09.2026) weggefallen — die Screenshots zeigen keinen mehr.
const MODELLWAHL = {
  title: "Select Model and Effort",
  subtitle: "",
  footer: FOOTER_PICKER,
};
const REASONING = {
  title: "Select Reasoning Level for GPT-6-Sol",
  subtitle: "",
  footer: FOOTER_REASONING,
  options: REASONING_OPTIONS,
};
const DIALOGE: Record<
  number,
  {
    title: string;
    subtitle: string;
    footer: string;
    options: typeof MODEL_OPTIONS;
  }
> = {
  [STEP.modelTippen1]: { ...MODELLWAHL, options: MODEL_OPTIONS },
  [STEP.reasoning1]: REASONING,
  [STEP.modelTippen2]: { ...MODELLWAHL, options: MODEL_OPTIONS_2 },
  [STEP.reasoning2]: REASONING,
  [STEP.scope]: {
    title: "Apply reasoning change",
    subtitle: "Choose where to apply extra high reasoning.",
    footer: FOOTER_PICKER,
    options: SCOPE_OPTIONS,
  },
};

// Anzeigenamen im Picker, aber der Slug in der Meldung (s. Kopfkommentar).
const ERGEBNIS = [
  "Model changed to gpt-6-sol medium",
  "Model changed to gpt-6-sol xhigh for Plan mode.",
];

// ---- Zustand -------------------------------------------------------------
const typed = ref("");
const planMode = ref(false);
const reasoningSel = ref(REASONING_ZIEL);
// In den beiden /model-Schritten erscheint der Dialog erst, wenn das Tippen
// fertig ist (die TUI öffnet ihn mit Enter); bis dahin Composer + Slash-Zeile.
const dialogOffen = ref(false);
const reduced = usePrefersReducedMotion();

const tippSchritt = (s: number) =>
  s === STEP.modelTippen1 || s === STEP.modelTippen2;
const dialog = computed(() => {
  const d = DIALOGE[props.step] ?? null;
  if (d && tippSchritt(props.step) && !dialogOffen.value) return null;
  return d;
});
const dialogSel = computed(() =>
  props.step === STEP.reasoning1 || props.step === STEP.reasoning2
    ? reasoningSel.value
    : 0,
);
const slashSichtbar = computed(
  () => tippSchritt(props.step) && typed.value.startsWith("/"),
);
const statusModel = computed(() =>
  props.step >= STEP.ergebnis2
    ? MODEL_NACHHER
    : props.step >= STEP.ergebnis1
      ? MODEL_GLOBAL
      : MODEL_VORHER,
);
const messages = computed(() =>
  props.step >= STEP.ergebnis2
    ? ERGEBNIS
    : props.step >= STEP.ergebnis1
      ? ERGEBNIS.slice(0, 1)
      : [],
);

const ariaLabel = computed(() => {
  const d = dialog.value;
  if (d)
    return `Codex-TUI, Dialog „${d.title}“, Cursor auf Option ${dialogSel.value + 1}`;
  const eingabe = typed.value ? `Eingabe „${typed.value}“` : "leerer Composer";
  const meldungen = messages.value.length ? ` ${messages.value.join(" ")}` : "";
  return `Codex-TUI, ${eingabe}, ${statusModel.value}${planMode.value ? ", Plan mode" : ""}.${meldungen}`;
});

// ---- Timer / Typewriter --------------------------------------------------
let timer: ReturnType<typeof setTimeout> | null = null;
function clearTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

// Basis 60 ms ± 35 ms, deterministischer Jitter aus dem Zeichenindex (kein
// Math.random, damit Presenter und Publikum wenigstens gleich lang tippen);
// nach dem „/“ eine längere Pause (die TUI öffnet dort das Slash-Popup).
const TIPP_BASIS_MS = 60;
const TIPP_JITTER_MS = 35;
const TIPP_NACH_SLASH_MS = 140;
function tippPause(text: string, i: number) {
  const jitter = ((i * 7919) % (2 * TIPP_JITTER_MS + 1)) - TIPP_JITTER_MS;
  const basis = text[i - 1] === "/" ? TIPP_NACH_SLASH_MS : TIPP_BASIS_MS;
  return basis + jitter;
}

function tippe(text: string, danach?: () => void) {
  clearTimer();
  typed.value = "";
  let i = 0;
  const tick = () => {
    i += 1;
    typed.value = text.slice(0, i);
    if (i < text.length) {
      timer = setTimeout(tick, tippPause(text, i));
    } else if (danach) {
      timer = setTimeout(() => {
        timer = null;
        danach();
      }, 3 * TIPP_BASIS_MS);
    } else {
      timer = null;
    }
  };
  timer = setTimeout(tick, 2 * TIPP_BASIS_MS);
}

// Endzustand eines Schritts ohne Animation.
function zeigeEndzustand(s: number) {
  clearTimer();
  typed.value = "";
  dialogOffen.value = tippSchritt(s);
  planMode.value = s >= STEP.planTippen;
  reasoningSel.value = s >= STEP.reasoning2 ? REASONING_ZIEL : REASONING_START;
}

function wandereCursor(von: number, bis: number) {
  reasoningSel.value = von;
  const hop = () => {
    reasoningSel.value += 1;
    if (reasoningSel.value < bis) timer = setTimeout(hop, REASONING_HOP_MS);
    else timer = null;
  };
  timer = setTimeout(hop, REASONING_HOP_MS);
}

function wechsle(s: number, vorher: number | undefined) {
  const animiert = !reduced.value && vorher !== undefined && s === vorher + 1;
  if (!animiert) return zeigeEndzustand(s);
  switch (s) {
    case STEP.modelTippen1:
    case STEP.modelTippen2:
      clearTimer();
      dialogOffen.value = false;
      tippe(SLASH.name, () => {
        typed.value = "";
        dialogOffen.value = true;
      });
      break;
    case STEP.planTippen:
      clearTimer();
      dialogOffen.value = false;
      planMode.value = false;
      tippe("/plan", () => {
        typed.value = "";
        planMode.value = true;
      });
      break;
    case STEP.reasoning2:
      clearTimer();
      typed.value = "";
      dialogOffen.value = false;
      wandereCursor(REASONING_START, REASONING_ZIEL);
      break;
    default:
      zeigeEndzustand(s);
  }
}

watch(() => props.step, wechsle, { immediate: true });

// Rückkehr auf die Folie (auch per Sprung): Endzustand des aktuellen Schritts.
// Bewusst `watch` auf useIsSlideActive statt onSlideEnter: das ist intern ein
// watchEffect und würde `props.step` mit-tracken — dann liefe bei jedem Klick
// zusätzlich der Endzustand und keine Animation käme je zum Zug.
const active = useIsSlideActive();
watch(active, (a) => {
  if (a) zeigeEndzustand(props.step);
});
onSlideLeave(clearTimer);
onBeforeUnmount(clearTimer);
</script>

<template>
  <div class="ctui" inert :aria-label="ariaLabel" role="img">
    <CodexHeader
      :version="VERSION"
      :model="MODEL_VORHER"
      :directory="DIRECTORY"
    />
    <div class="ctui-tip">
      <b>Tip:</b> Start a fresh idea with <b>/new</b>; the previous session
      stays in history.
    </div>

    <div class="ctui-transcript">
      <CodexMessage v-for="m in messages" :key="m" class="ctui-msg">
        <span class="ctui-bullet">•</span> {{ m }}
      </CodexMessage>
    </div>

    <div class="ctui-bottom">
      <CodexPermissions
        v-if="dialog"
        :title="dialog.title"
        :subtitle="dialog.subtitle || undefined"
        :options="dialog.options"
        :default-selected="dialogSel"
        :footer="dialog.footer"
        columns
      />
      <template v-else>
        <div class="ctui-surface">
          <div class="ctui-line">
            <span aria-hidden="true" class="ctui-marker">›</span>
            <span v-if="typed" class="ctui-text">{{ typed }}</span>
            <span class="ctui-caret">{{ typed ? "" : PLACEHOLDER[0] }}</span>
            <span v-if="!typed" class="ctui-placeholder">{{
              PLACEHOLDER.slice(1)
            }}</span>
          </div>
        </div>
        <div v-if="slashSichtbar" class="ctui-slash">
          <span class="ctui-slash-name">{{ SLASH.name }}</span
          >{{ SLASH.description }}
        </div>
      </template>

      <div class="ctui-status">
        <span class="ctui-status-main">
          <span class="ctui-ready">Ready</span>
          <span class="ctui-dim"> · </span>
          <span class="ctui-model">{{ statusModel }}</span>
          <span class="ctui-dim"> · </span>
          <span class="ctui-cwd">{{ DIRECTORY }}</span>
          <span class="ctui-dim"> · </span>
          <span class="ctui-context">Context 0% used</span>
        </span>
        <span v-if="planMode" class="ctui-plan">Plan mode</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Terminal-Pane wie .crs-pane / .sim-pane: dunkel in beiden Themes. Feste
   Höhe, Transkript wächst nach unten, Composer bzw. Dialog + Status bleiben
   unten verankert — so springt zwischen den Schritten nur der Slot, den
   Composer und Dialog sich teilen.
   Schriftgröße 10 px (überschreibbar per --ctui-font-size): in der
   484 px breiten Folienspalte sind das 80 Zeichen — ein Standard-Terminal.
   Bei 12 px wären es 61, und „Apply reasoning change“ (51 Zeichen Name +
   Beschreibung) bricht dann auf sieben Zeilen um; auch 11 px reichen nicht
   (Schritt 3 ragt 73 px, Schritt 5 106 px über das Pane). Gemessen mit
   playwright-tests/codex-tui-qa.ts iso 3041 484 <fontPx>. */
.ctui {
  --cxp-font-size: var(--ctui-font-size, 10px);
  --ctui-lh: 1.5;
  display: flex;
  flex-direction: column;
  /* 5 px, nicht 6: mit umgebrochener Tip-Zeile stand der Scope-Dialog
     (Schritt 5) sonst 1 px über dem Pane-Rand. */
  gap: 5px;
  box-sizing: border-box;
  height: var(--ctui-height, 330px);
  min-width: 0;
  overflow: hidden;
  padding: 8px 12px 10px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--cxp-font-size);
  line-height: var(--ctui-lh);
  color: #ededed;
}
/* Der Port setzt 13 px fest; im 330-px-Pane gilt die Pane-Größe. */
.ctui :deep(.cxh-root) {
  font-size: inherit;
  line-height: inherit;
  padding: 6px 10px;
}
.ctui :deep(.cxh-grid) {
  margin-top: 4px;
}
.ctui :deep(.cxm-root) {
  font-size: inherit;
  line-height: inherit;
}
.ctui :deep(.cxp-root) {
  line-height: inherit;
}
.ctui :deep(.cxp-footer) {
  margin-top: 8px;
  font-size: inherit;
}
/* Umbrechen wie die echte TUI (zwei Zeilen bei 80 Spalten); der Platz geht
   vom Transkript ab, das in den Schritten 0–5 leer ist. */
.ctui-tip {
  color: #7a7a7a;
  flex-shrink: 0;
}
.ctui-tip b {
  font-weight: 700;
}
.ctui-transcript {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.ctui-msg + .ctui-msg {
  margin-top: 2px;
}
.ctui-bullet {
  color: #7a7a7a;
}
.ctui-bottom {
  flex: 0 0 auto;
  min-width: 0;
}
/* Composer wie CodexPrompt (.cxpr-surface): user_message_bg #353535. */
.ctui-surface {
  min-width: 0;
  padding-block: 1lh;
  padding-right: 1ch;
  background: #353535;
  color: #ededed;
}
.ctui-line {
  display: flex;
  min-width: 0;
  align-items: center;
  white-space: pre;
}
.ctui-marker {
  display: inline-block;
  width: 2ch;
  flex-shrink: 0;
  font-weight: 700;
}
.ctui-text {
  color: #ededed;
}
/* Block-Cursor: 1ch breit, im leeren Composer über dem ersten Buchstaben des
   Platzhalters (der steht dann invers im Block), sonst hinter dem Text. */
.ctui-caret {
  display: inline-block;
  width: 1ch;
  min-width: 1ch;
  /* Ohne Inhalt hätte der Block keine Höhe — auf Zeilenhöhe strecken. */
  align-self: stretch;
  background: #ededed;
  color: #353535;
}
.ctui-placeholder {
  color: #7a7a7a;
}
/* Slash-Zeile wie CodexSlashMenu (.cxs-row--active, .cxs-name 16ch),
   Farben der aktiven Zeile: Name cyan fett, Beschreibung cyan. */
.ctui-slash {
  margin-top: 4px;
  padding-left: 2ch;
  color: #5cc2e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ctui-slash-name {
  display: inline-block;
  width: 16ch;
  font-weight: 700;
}
/* Statuszeile wie CodexPrompt (.cxpr-status). */
.ctui-status {
  display: flex;
  min-width: 0;
  align-items: baseline;
  column-gap: 12px;
  margin-top: 4px;
  padding-left: 2ch;
  white-space: nowrap;
}
.ctui-status-main {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ctui-ready {
  color: #bb9af7;
}
.ctui-model {
  color: #f6e2b7;
}
.ctui-dim {
  color: #7a7a7a;
}
.ctui-cwd {
  color: #abdfa7;
}
/* Kein Wert aus dem brainless-Port (der kennt keine Statuszeile): das
   gedimmte Orange der Codex-TUI für die Kontextanzeige, als Mittelton
   zwischen Modell-Gelb #f6e2b7 und Dim-Grau #7a7a7a gewählt. */
.ctui-context {
  color: #b5874f;
}
.ctui-plan {
  margin-left: auto;
  flex-shrink: 0;
  color: #bb9af7;
}
</style>
