<script setup lang="ts">
/**
 * ~/.codex/config.toml auf der Codex-Erklärfolie, synchron zur TUI-Animation
 * (`CodexEffortTui.vue`, gleicher `step` = $clicks). Deck-lokaler Wrapper um
 * den shared MonacoBlock, weil slides.md shared-Komponenten nur über lokale
 * Wrapper erreicht (setup/main.ts registriert nur TalkXref global).
 *
 * Monaco kennt kein TOML; `ini` färbt `[features]`, `key = "…"` und
 * `#`-Kommentare (Präzedenz: gradle-Deck, JvmIdiomatic.vue). Die
 * Hervorhebung läuft über eine Decorations-Collection mit `isWholeLine` —
 * dieselbe Mechanik wie MonacoBlockAnnotated, nur ohne Detail-Popup. Welche
 * Zeile wann leuchtet, steht in HIGHLIGHTS; rückwärts gilt dasselbe Mapping.
 */
import { onBeforeUnmount, watch } from "vue";
import type * as MonacoNs from "monaco-editor";
import MonacoBlock from "@shared/components/MonacoBlock.vue";

const props = withDefaults(defineProps<{ step?: number }>(), { step: 0 });

const CODE = [
  'model = "gpt-6-sol"  # oder astra, luna',
  'model_reasoning_effort = "medium"',
  "# ⚠ Desktop-App ignoriert diesen Key (#18712)",
  'plan_mode_reasoning_effort = "xhigh"',
  "[features]",
  "# ⚠ experimentell, nur Astra",
  "reasoning_effort_override = true",
].join("\n");

// 1-basierte Zeilennummern der drei Keys, die die TUI-Dialoge berühren.
const ZEILE = { model: 1, effort: 2, planEffort: 4 } as const;

type Ton = "weak" | "strong" | "changed";
interface Markierung {
  line: number;
  tone: Ton;
  /** Zusätzlicher Marker in der Glyph-Spalte („diese Zeile wurde geschrieben“). */
  glyph?: boolean;
}

// Schritte wie in CodexEffortTui.vue. 1 = Modellwahl (Default-Mode) → model
// kräftig. 2 = Reasoning Level → model_reasoning_effort kräftig. 3 = „Model
// changed to gpt-6-sol medium“: beide Zeilen sind geschrieben (grün) und
// bleiben es. 4 = /plan: nichts Neues. 5 = Modellwahl im Plan-Mode, gleiches
// Modell — nichts wird geschrieben. 6 = Reasoning Level im Plan-Mode →
// plan_mode_reasoning_effort schwach (ob der Wert dorthin geht, entscheidet
// erst der nächste Dialog). 7 = „Apply reasoning change“, Cursor auf
// Option 1 → plan_mode_reasoning_effort kräftig. 8 = Ergebnis: auch der
// Plan-Override ist geschrieben, mit Rand-Marker.
const GESCHRIEBEN_GLOBAL: Markierung[] = [
  { line: ZEILE.model, tone: "changed" },
  { line: ZEILE.effort, tone: "changed" },
];
const HIGHLIGHTS: Record<number, Markierung[]> = {
  1: [{ line: ZEILE.model, tone: "strong" }],
  2: [{ line: ZEILE.effort, tone: "strong" }],
  3: GESCHRIEBEN_GLOBAL,
  4: GESCHRIEBEN_GLOBAL,
  5: GESCHRIEBEN_GLOBAL,
  6: [...GESCHRIEBEN_GLOBAL, { line: ZEILE.planEffort, tone: "weak" }],
  7: [...GESCHRIEBEN_GLOBAL, { line: ZEILE.planEffort, tone: "strong" }],
  8: [
    ...GESCHRIEBEN_GLOBAL,
    { line: ZEILE.planEffort, tone: "changed", glyph: true },
  ],
};

// 11 px / 15 px Zeilenhöhe wie der frühere Markdown-Fence der Folie. Die
// längste Zeile (47 Zeichen, der Desktop-App-Kommentar; 0xProto 0,62 em →
// 6,82 px je Zeichen bei 11 px) braucht mit Glyph-Spalte (14 px) und
// Dekorationsspalte (4 px) rund 340 px und passt so in die 360 px breite
// Folienspalte (Editor innen 358 px). Der Modell-Kommentar ist bewusst kurz
// („astra, luna“ statt der vollen IDs — die stehen im TUI-Dialog daneben);
// seit dem Wegfall von Terra (kein GPT-6 Terra) ist die Modellzeile ohnehin
// nicht mehr die längste (gemessen mit playwright-tests/codex-tui-qa.ts,
// tomlLine1).
// Sieben Zeilen à 15 px + Innenabstand 2 × 6 px = 117 px; 125 px lässt Luft,
// ohne dass Monaco eine vertikale Scrollbar einblendet.
const HEIGHT = "125px";
const EDITOR_OPTIONS: MonacoNs.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 11,
  lineHeight: 15,
  lineNumbers: "off",
  glyphMargin: true,
  lineDecorationsWidth: 4,
  // Der Rest (folding, minimap, scrollBeyondLastLine, renderLineHighlight)
  // ist in MonacoBlock schon so gesetzt. Scrollbars aus: die längste Zeile
  // läuft bei schmaler Spalte lieber unter den Rand als eine Zeile zu kosten.
  scrollbar: { vertical: "hidden", horizontal: "hidden" },
};

let editor: MonacoNs.editor.IStandaloneCodeEditor | null = null;
let monaco: typeof MonacoNs | null = null;
let collection: MonacoNs.editor.IEditorDecorationsCollection | null = null;

function applyHighlights() {
  if (!editor || !monaco) return;
  const m = monaco;
  const decos = (HIGHLIGHTS[props.step] ?? []).map((h) => ({
    range: new m.Range(h.line, 1, h.line, 1),
    options: {
      isWholeLine: true,
      className: `cct-line cct-${h.tone}`,
      glyphMarginClassName: h.glyph ? "cct-glyph-changed" : undefined,
    },
  }));
  if (collection) collection.set(decos);
  else collection = editor.createDecorationsCollection(decos);
}

function onReady(payload: {
  editor: MonacoNs.editor.IStandaloneCodeEditor;
  monaco: typeof MonacoNs;
}) {
  editor = payload.editor;
  monaco = payload.monaco;
  applyHighlights();
}

watch(() => props.step, applyHighlights);

onBeforeUnmount(() => {
  collection?.clear();
  collection = null;
  editor = null;
});
</script>

<template>
  <MonacoBlock
    :code="CODE"
    language="ini"
    filename="~/.codex/config.toml"
    :height="HEIGHT"
    :editor-options="EDITOR_OPTIONS"
    @ready="onReady"
  />
</template>

<!-- Unscoped: Monaco hängt die Klassen an seine eigenen Overlay-Elemente,
     die kein data-v-Attribut tragen. Töne nur aus den Theme-Tokens, damit
     beide Themes lesbar bleiben (Hintergrund- und Rand-Tokens sind je Theme
     definiert, s. shared/theme/tokens.ts). -->
<style>
.cct-line.cct-weak {
  background: var(--color-background-info) !important;
}
.cct-line.cct-strong {
  background: var(--color-background-info) !important;
  box-shadow: inset 3px 0 0 var(--color-border-info) !important;
}
.cct-line.cct-changed {
  background: var(--color-background-success) !important;
  box-shadow: inset 3px 0 0 var(--color-border-success) !important;
}
.cct-glyph-changed::before {
  content: "+";
  display: block;
  text-align: center;
  font-family: var(--slidev-code-font-family, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  color: var(--color-text-success);
}
</style>
