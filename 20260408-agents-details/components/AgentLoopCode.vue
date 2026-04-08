<script setup lang="ts">
import MonacoBlock from "./MonacoBlock.vue";

const code = `while (true) {
  response = llm.call(systemPrompt + tools + conversationHistory)

  if (response.hasToolCalls()) {
    for (call of response.toolCalls) {
      result = executeTool(call)          // Bash, Read, Write, MCP, ...
      conversationHistory.append(call, result)
    }
  } else {
    display(response.text)
    break  // oder: warte auf nächsten User-Input
  }
}`;
</script>

<template>
  <MonacoBlock :code="code" language="typescript" height="280px" />
</template>
