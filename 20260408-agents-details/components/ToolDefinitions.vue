<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#14141c" : "#ffffff",
    border: d ? "#2a2a35" : "#e4e4e7",
    text: d ? "#c8c8d0" : "#3f3f46",
    textSub: d ? "#8a8a9a" : "#71717a",
    codeBg: d ? "#0d0d14" : "#f4f4f5",
    codeText: d ? "#fde047" : "#854d0e",
    headerBg: d ? "#1a1a24" : "#f9fafb",
    headerText: d ? "#a78bfa" : "#7c3aed",
    tableBorder: d ? "#2a2a35" : "#e4e4e7",
  };
});

const providers = [
  {
    name: "Anthropic Claude",
    color: "#fb923c",
    code: `{
  "name": "get_weather",
  "description": "...",
  "input_schema": {
    "type": "object",
    "properties": { ... }
  }
}`,
    note: "Top-Level tools-Param. JSON-Schema 2020-12. Parallele Tool-Calls per Default.",
  },
  {
    name: "OpenAI",
    color: "#10b981",
    code: `{
  "type": "function",
  "function": {
    "name": "get_weather",
    "parameters": {
      "type": "object",
      "properties": { ... }
    }
  }
}`,
    note: "Wrapper mit function-Objekt. Strict Mode garantiert Schema via Constrained Decoding.",
  },
  {
    name: "Google Gemini",
    color: "#60a5fa",
    code: `{
  "functionDeclarations": [{
    "name": "get_weather",
    "parameters": {
      "type": "object",
      "properties": { ... }
    }
  }]
}`,
    note: "OpenAPI-Subset (kein default, oneOf etc.). Echte Einschränkung bei komplexen Schemas.",
  },
];
</script>

<template>
  <div class="grid">
    <div v-for="p in providers" :key="p.name" class="card">
      <h4 :style="{ color: p.color }">{{ p.name }}</h4>
      <pre><code>{{ p.code }}</code></pre>
      <p class="note">{{ p.note }}</p>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.card {
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
  border-radius: 8px;
  padding: 12px;
}
.card h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
}
.card pre {
  background: v-bind("P.codeBg");
  border: 1px solid v-bind("P.border");
  border-radius: 4px;
  padding: 8px;
  font-size: 10px;
  line-height: 1.5;
  overflow-x: auto;
  margin: 0;
  color: v-bind("P.text");
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.note {
  margin: 8px 0 0 0;
  font-size: 11px;
  color: v-bind("P.textSub");
  line-height: 1.5;
}
</style>
