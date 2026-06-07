<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watchEffect } from "vue";
import { useDarkMode } from "@slidev/client";

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, default: "yaml" },
  height: { type: String, default: "180px" },
  editorOptions: { type: Object, default: () => ({}) },
  // Optionales Sprach-Badge in einer Editor-Ecke. Default aus; wird derzeit
  // nur in der Design-Pattern-Präsentation (über PatternTabs) eingeschaltet.
  showLanguageBadge: { type: Boolean, default: false },
  badgePosition: { type: String, default: "top-right" },
});

// Marken-Label + farbenblind-sichere Badge-Farbe je Sprache. Die Farben sind
// KEINE reinen Marken-Farben: reine Marken-Farben kollabieren unter Rot-Grün-
// Schwäche (z.B. Rust/Scala ΔE2000 ≈ 1.2 — für Betroffene identisch). Diese
// Palette ist gegen Protan/Deutan/Tritan optimiert (Machado 2009 + CIEDE2000):
// jedes Sprachpaar, das je in einem PatternTabs-Block zusammen auftritt, hat
// ΔE2000 ≥ 17, global ≥ 15 — Marken-Anker bleiben dennoch erkennbar (TS blau,
// JS gelb, Kotlin violett, Go cyan, Java orange, Rust terrakotta). `fg` ist
// auf ≥ 4.5:1 Kontrast gewählt. NICHT von Hand anpassen, ohne
// `bun run playwright-tests/cvd-check.ts '<json>'` erneut grün zu sehen.
const LANGUAGE_META = {
  java: { label: "Java", bg: "#A1520C", fg: "#fff" },
  kotlin: { label: "Kotlin", bg: "#652AEF", fg: "#fff" },
  typescript: { label: "TypeScript", bg: "#1E4267", fg: "#fff" },
  javascript: { label: "JavaScript", bg: "#E8D54A", fg: "#1a1a1a" },
  jsx: { label: "JSX", bg: "#1B747E", fg: "#fff" },
  go: { label: "Go", bg: "#52E8FF", fg: "#1a1a1a" },
  rust: { label: "Rust", bg: "#D57C6D", fg: "#1a1a1a" },
  python: { label: "Python", bg: "#2599F8", fg: "#1a1a1a" },
  scala: { label: "Scala", bg: "#602424", fg: "#fff" },
  yaml: { label: "YAML", bg: "#6b7280", fg: "#fff" },
};

// Aliase auf die kanonischen Keys normalisieren. Stellt u.a. sicher, dass
// TypeScript als "TypeScript" und nicht als "JavaScript" erscheint.
const LANGUAGE_ALIASES = {
  ts: "typescript",
  js: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  rs: "rust",
  py: "python",
  golang: "go",
};

const badge = computed(() => {
  const raw = (props.language || "").toLowerCase();
  const key = LANGUAGE_ALIASES[raw] || raw;
  return (
    LANGUAGE_META[key] || {
      label: (props.language || "").toUpperCase() || "?",
      bg: "#6b7280",
      fg: "#fff",
    }
  );
});

const emit = defineEmits(["ready"]);

const { isDark } = useDarkMode();
const container = ref(null);
let editor = null;
let monaco = null;

onMounted(async () => {
  const monacoModule = await import("monaco-editor");
  monaco = monacoModule;
  if (!container.value) return;

  monaco.editor.defineTheme("mb-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d", fontStyle: "italic" },
      { token: "constant", foreground: "79b8ff" },
      { token: "entity.name", foreground: "b392f0" },
      { token: "keyword", foreground: "f97583" },
      { token: "storage", foreground: "f97583" },
      { token: "string", foreground: "9ecbff" },
      { token: "support", foreground: "79b8ff" },
      { token: "variable", foreground: "ffab70" },
      { token: "tag", foreground: "85e89d" },
      { token: "type", foreground: "79b8ff" },
      { token: "number", foreground: "79b8ff" },
    ],
    colors: {
      "editor.background": "#24292e",
      "editor.foreground": "#e1e4e8",
      "editorLineNumber.foreground": "#444d56",
      "editorLineNumber.activeForeground": "#e1e4e8",
      "editor.selectionBackground": "#3392FF44",
      "editor.lineHighlightBackground": "#2b3036",
      "editorWidget.background": "#1f2428",
      "editorGutter.background": "#24292e",
      "editorCodeLens.foreground": "#8b949e",
    },
  });

  monaco.editor.defineTheme("mb-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d", fontStyle: "italic" },
      { token: "constant", foreground: "005cc5" },
      { token: "entity.name", foreground: "6f42c1" },
      { token: "keyword", foreground: "d73a49" },
      { token: "storage", foreground: "d73a49" },
      { token: "string", foreground: "032f62" },
      { token: "support", foreground: "005cc5" },
      { token: "variable", foreground: "e36209" },
      { token: "tag", foreground: "22863a" },
      { token: "type", foreground: "005cc5" },
      { token: "number", foreground: "005cc5" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292e",
      "editorLineNumber.foreground": "#1b1f234d",
      "editorLineNumber.activeForeground": "#24292e",
      "editor.selectionBackground": "#0366d625",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editorWidget.background": "#f6f8fa",
      "editorGutter.background": "#ffffff",
      "editorCodeLens.foreground": "#6a737d",
    },
  });

  editor = monaco.editor.create(container.value, {
    value: props.code,
    language: props.language,
    theme: isDark.value ? "mb-dark" : "mb-light",
    readOnly: true,
    automaticLayout: true,
    fontSize: 12,
    fontFamily: "'0xProto', monospace",
    lineNumbers: "on",
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    glyphMargin: false,
    folding: false,
    renderLineHighlight: "none",
    codeLens: false,
    scrollbar: { vertical: "auto", horizontal: "auto" },
    padding: { top: 6, bottom: 6 },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    contextmenu: false,
    wordWrap: "off",
    lineDecorationsWidth: 8,
    bracketPairColorization: { enabled: false },
    ...props.editorOptions,
  });

  watchEffect(() => {
    monaco.editor.setTheme(isDark.value ? "mb-dark" : "mb-light");
  });

  // `remeasureFonts` ist eine statische Funktion im `monaco.editor`-Namespace,
  // KEINE Editor-Instanz-Methode (`editor.remeasureFonts` ist undefined). Nach
  // dem Laden der Custom-Font ('0xProto') müssen die Zeichenbreiten neu
  // vermessen werden, damit das Layout nicht verrutscht.
  document.fonts.ready.then(() => {
    monaco?.editor.remeasureFonts();
  });

  emit("ready", { editor, monaco });
});

onBeforeUnmount(() => {
  editor?.dispose();
});

defineExpose({
  getEditor: () => editor,
  getMonaco: () => monaco,
});
</script>

<template>
  <div class="monaco-block" :style="{ height }">
    <div ref="container" class="monaco-container" />
    <div
      v-if="showLanguageBadge"
      class="mb-lang-badge"
      :class="`mb-pos-${badgePosition}`"
      :style="{ background: badge.bg, color: badge.fg }"
    >
      {{ badge.label }}
    </div>
  </div>
</template>

<style scoped>
@font-face {
  font-family: "0xProto";
  src: url("/fonts/0xProto-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
.monaco-block {
  position: relative;
  border-radius: var(--sk-radm);
  overflow: hidden;
  border: 0.5px solid var(--color-border-tertiary);
  margin: 8px 0;
}
.monaco-container {
  width: 100%;
  height: 100%;
}
.mb-lang-badge {
  position: absolute;
  z-index: 20;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  padding: 2px 7px;
  border-radius: var(--sk-rad);
  pointer-events: none;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 0 0 0.5px rgba(255, 255, 255, 0.25);
}
.mb-pos-top-right {
  top: 6px;
  right: 8px;
}
.mb-pos-top-left {
  top: 6px;
  left: 8px;
}
.mb-pos-bottom-right {
  bottom: 6px;
  right: 8px;
}
.mb-pos-bottom-left {
  bottom: 6px;
  left: 8px;
}
</style>
