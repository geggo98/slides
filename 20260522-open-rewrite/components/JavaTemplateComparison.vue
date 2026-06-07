<script setup>
import MonacoBlock from "@shared/components/MonacoBlock.vue";
import { javaTemplateAntiCode, javaTemplateIdiomCode } from "./slide-data.ts";
</script>

<template>
  <div class="jt-grid">
    <div class="col anti">
      <header>
        <span class="dot" />
        Anfänger-Fehler
      </header>
      <MonacoBlock
        :code="javaTemplateAntiCode"
        language="java"
        height="150px"
      />
    </div>
    <div class="col idiom">
      <header>
        <span class="dot ok" />
        Idiomatisch
      </header>
      <MonacoBlock
        :code="javaTemplateIdiomCode"
        language="java"
        height="150px"
      />
    </div>
  </div>
</template>

<style scoped>
.jt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--sk-rad);
  border: 0.5px solid var(--color-border-tertiary);
}
.col.anti {
  background: var(--color-background-danger);
  border-color: var(--color-border-danger);
}
.col.idiom {
  background: var(--color-background-success);
  border-color: var(--color-border-success);
}
header {
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-danger);
}
.dot.ok {
  background: var(--color-text-success);
}
</style>
