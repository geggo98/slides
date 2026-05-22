<script setup>
const phases = [
  {
    n: "0",
    title: "Vor-Bewertung",
    bullets: [
      "Codebase-Inventory: Spring-Boot-/Java-Versionen, Hibernate, Jackson, Kotlin-Anteil",
      "Lizenz-Audit: welche Recipes sind Apache, welche MSAL?",
      "Tool-Evaluation: OpenRewrite vs. Refaster für den konkreten Use Case",
    ],
  },
  {
    n: "1",
    title: "Erste Migration mit existierenden Recipes",
    bullets: [
      "Spring-Boot-Upgrade-Recipe auf einem mittelgroßen Microservice testen",
      "<code>rewriteDryRun</code> + manuelles Diff-Review",
      "Build- und Test-Erfolg als deterministisches Gate",
    ],
  },
  {
    n: "2",
    title: "Pattern 1 als CI-Workflow",
    bullets: [
      "Duolingo-Style: YAML-Konfig, OpenRewrite zuerst, AI-Agent fixt Lücken",
      "Coding-Agent integrieren (Claude Code, Codex …)",
      "Token-Budget und Eskalations-Pfade definieren",
    ],
  },
  {
    n: "3",
    title: "Eigene Recipes",
    bullets: [
      "Internes <code>company-rewrite</code>-Modul aufsetzen",
      "Erst YAML-Wrapper, dann Refaster, dann Imperative",
      "AI-Agent (Pattern 2) zum Authoring — mit Moderne-Skills als Anleitung",
      "Tests mit <code>@DocumentExample</code> als Doku-Quelle",
    ],
  },
  {
    n: "4",
    title: "Skalierung",
    bullets: [
      "Recipe-Modul in internem Maven-Mirror publishen",
      "Konsumer-Repos pinnen Versionen",
      "Pattern 4 (Prethink) experimentell für Cross-Repo-Impact",
      "Bei kritischer Masse: Moderne-Plattform-Evaluation",
    ],
  },
];
</script>

<template>
  <div class="timeline">
    <div v-for="p in phases" :key="p.n" class="phase">
      <div class="dot">{{ p.n }}</div>
      <div class="body">
        <h4>{{ p.title }}</h4>
        <ul>
          <li v-for="(b, i) in p.bullets" :key="i" v-html="b" />
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.phase {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--color-background-secondary);
  border-radius: var(--sk-rad);
  border: 0.5px solid var(--color-border-tertiary);
}
.dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-background-info);
  color: var(--color-text-info);
  font-weight: 500;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.5px solid var(--color-border-info);
}
h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}
ul {
  margin: 4px 0 0;
  padding-left: 1.1rem;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
li {
  margin: 0.15rem 0;
}
ul :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-background-primary);
  padding: 0 3px;
  border-radius: 3px;
}
</style>
