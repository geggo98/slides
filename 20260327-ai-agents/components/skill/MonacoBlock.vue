<script setup>
import { ref, onMounted, onBeforeUnmount, watchEffect } from 'vue'
import { useDarkMode } from '@slidev/client'

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, default: 'yaml' },
  height: { type: String, default: '180px' },
})

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
      { token: 'keyword', foreground: 'f97583' },
      { token: 'string', foreground: '9ecbff' },
      { token: 'tag', foreground: '85e89d' },
      { token: 'type', foreground: '79b8ff' },
      { token: 'number', foreground: '79b8ff' },
    ],
    colors: {
      'editor.background': '#24292e',
      'editor.foreground': '#e1e4e8',
      'editorLineNumber.foreground': '#444d56',
      'editor.selectionBackground': '#3392FF44',
      'editor.lineHighlightBackground': '#2b3036',
      'editorGutter.background': '#24292e',
    },
  })

  monaco.editor.defineTheme('mb-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'constant', foreground: '005cc5' },
      { token: 'keyword', foreground: 'd73a49' },
      { token: 'string', foreground: '032f62' },
      { token: 'tag', foreground: '22863a' },
      { token: 'type', foreground: '005cc5' },
      { token: 'number', foreground: '005cc5' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#24292e',
      'editorLineNumber.foreground': '#1b1f234d',
      'editor.selectionBackground': '#0366d625',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editorGutter.background': '#ffffff',
    },
  })

  const lineCount = props.code.split('\n').length
  editor = monaco.editor.create(container.value, {
    value: props.code,
    language: props.language,
    theme: isDark.value ? 'mb-dark' : 'mb-light',
    readOnly: true,
    automaticLayout: true,
    fontSize: 12,
    lineHeight: 22,
    fontFamily: 'var(--font-mono)',
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
    lineDecorationsWidth: 0,
    bracketPairColorization: { enabled: false },
  })

  watchEffect(() => {
    monaco.editor.setTheme(isDark.value ? 'mb-dark' : 'mb-light')
  })
})

onBeforeUnmount(() => {
  editor?.dispose()
})
</script>

<template>
  <div class="monaco-block" :style="{ height }">
    <div ref="container" class="monaco-container" />
  </div>
</template>

<style scoped>
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
