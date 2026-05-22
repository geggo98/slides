<script setup>
const tiers = [
  {
    name: "Apache 2.0",
    sub: "Echtes Open Source",
    tone: "success",
    items: [
      "rewrite-core, alle Sprach-LSTs",
      "rewrite-migrate-java, rewrite-testing-*",
      "Gradle-/Maven-Plugin",
      "Eigene Recipes ohne Restriktion erlaubt",
    ],
    verdict: "Kommerziell unbedenklich.",
  },
  {
    name: "MSAL",
    sub: "Moderne Source Available",
    tone: "warning",
    items: [
      "rewrite-spring (seit 13.12.2024)",
      'rewrite-hibernate, weitere „CE"-Recipes',
      "Anwendung auf eigenen Code: OK",
      "Weiterverkauf als Tool: verboten",
    ],
    verdict: '„Community Edition" ≠ OSS — Marketing-Falle.',
  },
  {
    name: "MPL",
    sub: "Moderne Proprietary License",
    tone: "danger",
    items: [
      "Multi-Repo-Impact, Prethink, AI-Recipes",
      "Spring-Boot-Recipes mit Tiefen-Coverage",
      "Nur über Moderne-Subscription",
      "DX Edition für regulierte Industrien",
    ],
    verdict: "Proprietär. Vendor-Lock-in.",
  },
];
</script>

<template>
  <div class="matrix">
    <div v-for="t in tiers" :key="t.name" :class="['col', `tone-${t.tone}`]">
      <header>
        <div class="name">{{ t.name }}</div>
        <div class="sub">{{ t.sub }}</div>
      </header>
      <ul>
        <li v-for="i in t.items" :key="i">{{ i }}</li>
      </ul>
      <div class="verdict">{{ t.verdict }}</div>
    </div>
  </div>
</template>

<style scoped>
.matrix {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}
.col {
  display: flex;
  flex-direction: column;
  border-radius: var(--sk-rad);
  padding: 14px 16px;
  border: 0.5px solid var(--color-border-tertiary);
  background: var(--color-background-secondary);
}
.col.tone-success {
  background: var(--color-background-success);
  border-color: var(--color-border-success);
}
.col.tone-warning {
  background: var(--color-background-warning);
  border-color: var(--color-border-warning);
}
.col.tone-danger {
  background: var(--color-background-danger);
  border-color: var(--color-border-danger);
}
.name {
  font-size: 15px;
  font-weight: 500;
}
.sub {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
ul {
  margin: 6px 0;
  padding-left: 1.2rem;
  font-size: 12.5px;
  line-height: 1.6;
}
li {
  margin: 0.1rem 0;
}
.verdict {
  margin-top: auto;
  padding-top: 10px;
  font-size: 12px;
  font-style: italic;
  border-top: 0.5px solid currentColor;
  opacity: 0.85;
}
</style>
