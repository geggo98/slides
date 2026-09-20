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
  'model = "gpt-5.6-sol"  # oder astra, terra, luna',
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

// step 0–2: nichts. 3 = Modellwahl → model kräftig. 4 = Reasoning Level →
// beide Effort-Keys schwach (wohin der Wert geht, entscheidet erst der
// nächste Dialog). 5 = „Apply reasoning change“, Cursor auf Option 1 →
// plan_mode_reasoning_effort kräftig. 6 = Ergebnis: Codex hat Modell,
// Default-Effort und Plan-Override geschrieben; der Plan-Override bekommt
// zusätzlich den Rand-Marker.
const HIGHLIGHTS: Record<number, Markierung[]> = {
  3: [{ line: ZEILE.model, tone: "strong" }],
  4: [
    { line: ZEILE.effort, tone: "weak" },
    { line: ZEILE.planEffort, tone: "weak" },
  ],
  5: [{ line: ZEILE.planEffort, tone: "strong" }],
  6: [
    { line: ZEILE.model, tone: "changed" },
    { line: ZEILE.effort, tone: "changed" },
    { line: ZEILE.planEffort, tone: "changed", glyph: true },
  ],
};

// 11 px / 15 px Zeilenhöhe wie der frühere Markdown-Fence der Folie. Die
// längste Zeile (47 Zeichen; 0xProto 0,62 em → 6,82 px je Zeichen bei 11 px)
// braucht mit Glyph-Spalte (14 px) und Dekorationsspalte (4 px) rund 340 px
// und passt so in die 360 px breite Folienspalte (Editor innen 358 px). Der
// Modell-Kommentar ist deshalb bewusst kurz („astra, terra, luna“ statt der
// vollen IDs — die stehen im TUI-Dialog daneben); mit den vollen IDs fehlten
// bei 11 px 9 px und „-luna“ wurde abgeschnitten (gemessen mit
// playwright-tests/codex-tui-qa.ts, tomlLine1).
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
