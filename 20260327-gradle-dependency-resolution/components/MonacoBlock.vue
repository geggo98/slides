<script setup>
import { ref, onMounted, onBeforeUnmount, watchEffect } from 'vue'
import { useDarkMode } from '@slidev/client'

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, default: 'yaml' },
  height: { type: String, default: '180px' },
  editorOptions: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['ready'])

const { isDark } = useDarkMode()
const container = ref(null)
let editor = null
let monaco = null

onMounted(async () => {
  const monacoModule = await import('monaco-editor')
  monaco = monacoModule
  if (!container.value) return

  monaco.editor.defineTheme('mb-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'constant', foreground: '79b8ff' },
      { token: 'entity.name', foreground: 'b392f0' },
      { token: 'keyword', foreground: 'f97583' },
      { token: 'storage', foreground: 'f97583' },
      { token: 'string', foreground: '9ecbff' },
      { token: 'support', foreground: '79b8ff' },
      { token: 'variable', foreground: 'ffab70' },
      { token: 'tag', foreground: '85e89d' },
      { token: 'type', foreground: '79b8ff' },
      { token: 'number', foreground: '79b8ff' },
    ],
    colors: {
      'editor.background': '#24292e',
      'editor.foreground': '#e1e4e8',
      'editorLineNumber.foreground': '#444d56',
      'editorLineNumber.activeForeground': '#e1e4e8',
      'editor.selectionBackground': '#3392FF44',
      'editor.lineHighlightBackground': '#2b3036',
      'editorWidget.background': '#1f2428',
      'editorGutter.background': '#24292e',
      'editorCodeLens.foreground': '#8b949e',
    },
  })

  monaco.editor.defineTheme('mb-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'constant', foreground: '005cc5' },
      { token: 'entity.name', foreground: '6f42c1' },
      { token: 'keyword', foreground: 'd73a49' },
      { token: 'storage', foreground: 'd73a49' },
      { token: 'string', foreground: '032f62' },
      { token: 'support', foreground: '005cc5' },
      { token: 'variable', foreground: 'e36209' },
      { token: 'tag', foreground: '22863a' },
      { token: 'type', foreground: '005cc5' },
      { token: 'number', foreground: '005cc5' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#24292e',
      'editorLineNumber.foreground': '#1b1f234d',
      'editorLineNumber.activeForeground': '#24292e',
      'editor.selectionBackground': '#0366d625',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editorWidget.background': '#f6f8fa',
      'editorGutter.background': '#ffffff',
      'editorCodeLens.foreground': '#6a737d',
    },
  })

  editor = monaco.editor.create(container.value, {
    value: props.code,
    language: props.language,
    theme: isDark.value ? 'mb-dark' : 'mb-light',
    readOnly: true,
    automaticLayout: true,
    fontSize: 12,
    fontFamily: "'0xProto', monospace",
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    glyphMargin: false,
    folding: false,
    renderLineHighlight: 'none',
    codeLens: false,
    scrollbar: { vertical: 'auto', horizontal: 'auto' },
    padding: { top: 6, bottom: 6 },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    contextmenu: false,
    wordWrap: 'off',
    lineDecorationsWidth: 8,
    bracketPairColorization: { enabled: false },
    ...props.editorOptions,
  })

  watchEffect(() => {
    monaco.editor.setTheme(isDark.value ? 'mb-dark' : 'mb-light')
  })

  document.fonts.ready.then(() => {
    editor?.remeasureFonts()
  })

  emit('ready', { editor, monaco })
})

onBeforeUnmount(() => {
  editor?.dispose()
})

defineExpose({
  getEditor: () => editor,
  getMonaco: () => monaco,
})
</script>

<template>
  <div class="monaco-block" :style="{ height }">
    <div ref="container" class="monaco-container" />
  </div>
</template>

<style scoped>
@font-face {
  font-family: '0xProto';
  src: url('/fonts/0xProto-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
.monaco-block {
  border-radius: var(--sk-radm);
  overflow: hidden;
  border: 0.5px solid var(--color-border-tertiary);
  margin: 8px 0;
}
.monaco-container {
  width: 100%;
  height: 100%;
}
</style>
