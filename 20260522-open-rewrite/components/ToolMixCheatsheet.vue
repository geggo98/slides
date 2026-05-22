<script setup>
const tools = [
  {
    tool: "OpenRewrite",
    use: "Mass-Migration, Framework-Upgrades (Spring Boot, Hibernate), javax → jakarta",
    not: "Einmalige Refactorings in einem Repo",
    nl: "JVM (Java, Groovy; Kotlin eingeschränkt)",
  },
  {
    tool: "Refaster / Error Prone",
    use: "1:1-Idiom-Migrationen, interne Code-Konventionen, Schnell-Refactorings",
    not: "Cross-File-Logik, komplexe Synthese",
    nl: "Java",
  },
  {
    tool: "Spoon",
    use: "Code-Analyse mit voller Type-API, akademische Use Cases",
    not: "Format-erhaltende Mass-Migration",
    nl: "Java",
  },
  {
    tool: "Semgrep",
    use: "Security-Sweeps, Linter-Regeln, Quick-Wins über viele Sprachen",
    not: "Format-erhaltende Refactorings",
    nl: "Polyglott (30+ Sprachen)",
  },
  {
    tool: "ast-grep",
    use: "Pattern-Matching + Auto-Fix für kleine Sweeps, Compliance-Checks",
    not: "Type-aware Refactorings",
    nl: "Polyglott",
  },
  {
    tool: "IntelliJ SSR",
    use: "Lokales Refactoring per IDE, schneller Einstieg",
    not: "CI-Integration, reproduzierbare Diffs",
    nl: "JVM",
  },
];
</script>

<template>
  <table class="cheat">
    <thead>
      <tr>
        <th>Werkzeug</th>
        <th>Wann anwenden</th>
        <th>Wann nicht</th>
        <th>Sprachen</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="t in tools" :key="t.tool">
        <td>
          <strong>{{ t.tool }}</strong>
        </td>
        <td>{{ t.use }}</td>
        <td class="not">{{ t.not }}</td>
        <td class="nl">{{ t.nl }}</td>
      </tr>
    </tbody>
  </table>
  <p class="hint">
    Tool-Mix statt Tool-Monokultur. Die Werkzeuge schließen sich nicht aus —
    Refaster für interne Schnellschüsse, OpenRewrite für Mass-Migration, Semgrep
    für Compliance.
  </p>
</template>

<style scoped>
.cheat {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cheat th {
  text-align: left;
  font-weight: 500;
  padding: 8px 10px;
  border-bottom: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
}
.cheat td {
  padding: 7px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
  line-height: 1.5;
}
.cheat td.not {
  color: var(--color-text-tertiary);
}
.cheat td.nl {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
}
.hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 10px 0 0;
  line-height: 1.55;
  font-style: italic;
}
</style>
