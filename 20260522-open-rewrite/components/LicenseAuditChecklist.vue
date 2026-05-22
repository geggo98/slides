<script setup>
const items = [
  {
    head: "Plugin-Version pinnen",
    body: "Niemals <code>latest.release</code>. Major-Bumps brechen Recipe-Signaturen.",
  },
  {
    head: "Recipe-JAR-Versionen pinnen",
    body: "Lock-File oder Renovate-PR. Apache→MSAL-Sprünge sollen in einer PR sichtbar werden.",
  },
  {
    head: "Lizenz-Header der Recipe-JARs prüfen",
    body: "<code>META-INF/LICENSE</code> kann Apache <em>oder</em> MSAL stehen — pro JAR.",
  },
  {
    head: "rewriteDryRun ist Pflicht vor rewriteRun",
    body: "Patch-Datei, manuelles Diff-Review, dann erst Apply. Niemals direkt auf <code>main</code>.",
  },
  {
    head: "Rechtsabteilung konsultieren bei Beratung/SaaS",
    body: "MSAL erlaubt eigene Anwendung, verbietet Weiterverkauf. Grauzone bei Consulting-Mandaten.",
  },
  {
    head: "Eigene Recipes außerhalb der Moderne-Repos halten",
    body: "Eigenes <code>company-rewrite</code>-Modul, eigene Lizenz, eigenes Maven-Coord.",
  },
];
</script>

<template>
  <ul class="audit">
    <li v-for="it in items" :key="it.head">
      <div class="check">☐</div>
      <div>
        <div class="head">{{ it.head }}</div>
        <div class="body" v-html="it.body" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.audit {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}
li {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 8px;
  align-items: start;
  padding: 10px 12px;
  background: var(--color-background-secondary);
  border-radius: var(--sk-rad);
  border: 0.5px solid var(--color-border-tertiary);
}
.check {
  font-size: 16px;
  line-height: 1;
  color: var(--color-text-tertiary);
}
.head {
  font-size: 13px;
  font-weight: 500;
}
.body {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.55;
  margin-top: 2px;
}
.body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-primary);
  padding: 0 4px;
  border-radius: 3px;
}
</style>
