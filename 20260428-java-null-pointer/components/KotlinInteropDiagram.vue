<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#14141c" : "#ffffff",
    cardBg: d ? "#1a1a24" : "#f9fafb",
    border: d ? "#2a2a35" : "#e4e4e7",
    text: d ? "#c8c8d0" : "#3f3f46",
    muted: d ? "#7f7f8c" : "#71717a",
    label: d ? "#a78bfa" : "#7c3aed",
    arrow: d ? "#7f7f8c" : "#9ca3af",
    java: d ? "#fb923c" : "#ea580c",
    kotlin: d ? "#93c5fd" : "#1d4ed8",
    danger: d ? "#fca5a5" : "#dc2626",
    success: d ? "#86efac" : "#16a34a",
    code: d ? "#1f2428" : "#f4f4f5",
  };
});

type Scenario = {
  title: string;
  java: string;
  kotlinSees: string;
  outcome: "danger" | "success";
  outcomeText: string;
};

const scenarios: Scenario[] = [
  {
    title: "Ohne Annotationen",
    java: "public String fetchName(Long id)",
    kotlinSees: "fun fetchName(id: Long!): String!",
    outcome: "danger",
    outcomeText:
      "Platform-Type T! — Kotlin macht keine Null-Prüfung. NPE zur Laufzeit möglich.",
  },
  {
    title: "Mit JSR-305 / @Nonnull",
    java: "@Nonnull String fetchName(@Nonnull Long id)",
    kotlinSees: "fun fetchName(id: Long): String",
    outcome: "success",
    outcomeText:
      "Kotlin sieht non-null, aber JSR-305 ist tot. Migration empfohlen.",
  },
  {
    title: "Mit JSpecify @NullMarked",
    java: "@NullMarked\\npackage com.example;\\nString fetchName(Long id)",
    kotlinSees: "fun fetchName(id: Long): String",
    outcome: "success",
    outcomeText:
      "Kotlin 2.x liest JSpecify automatisch. Native non-null, ohne Klammeraffen an der Call-Site.",
  },
];
</script>

<template>
  <div class="diagram">
    <div v-for="s in scenarios" :key="s.title" class="row">
      <div class="label">{{ s.title }}</div>
      <div class="card java">
        <div class="lang">Java</div>
        <pre><code>{{ s.java.replace(/\\n/g, "\n") }}</code></pre>
      </div>
      <div class="arrow">→</div>
      <div class="card kotlin">
        <div class="lang">Kotlin sieht</div>
        <pre><code>{{ s.kotlinSees }}</code></pre>
      </div>
      <div class="outcome" :class="s.outcome">
        {{ s.outcomeText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.diagram {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 12px;
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr 24px 1fr 200px;
  align-items: center;
  gap: 10px;
}
.label {
  font-weight: 600;
  color: v-bind("P.label");
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.card {
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.border");
  border-radius: 6px;
  padding: 8px 10px;
  position: relative;
}
.card.java {
  border-left: 3px solid v-bind("P.java");
}
.card.kotlin {
  border-left: 3px solid v-bind("P.kotlin");
}
.lang {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: v-bind("P.muted");
  margin-bottom: 4px;
}
pre {
  margin: 0;
  font-family: "0xProto", monospace;
  font-size: 11px;
  white-space: pre-wrap;
  color: v-bind("P.text");
  line-height: 1.35;
}
.arrow {
  text-align: center;
  font-size: 18px;
  color: v-bind("P.arrow");
}
.outcome {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 4px;
  line-height: 1.3;
}
.outcome.danger {
  color: v-bind("P.danger");
  border: 1px solid v-bind("P.danger");
}
.outcome.success {
  color: v-bind("P.success");
  border: 1px solid v-bind("P.success");
}
</style>
