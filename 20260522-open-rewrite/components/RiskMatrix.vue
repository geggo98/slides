<script setup>
const risks = [
  {
    risk: "Recipe wird umlizenziert (Apache → MSAL → MPL)",
    mitigation: "Versions-Pinning + jährliches Lizenz-Audit",
    severity: "high",
  },
  {
    risk: "Heap-Probleme bei großen Repos",
    mitigation: "JVM-Heap erhöhen; mittelfristig Moderne-Plattform evaluieren",
    severity: "med",
  },
  {
    risk: "Kotlin K2 nicht parsbar",
    mitigation: '<code>exclusion("**/*.kt")</code>; AI-Agent für Kotlin-Files',
    severity: "med",
  },
  {
    risk: "Spring-Recipe macht unerwünschte Property-Renames",
    mitigation:
      "<code>rewriteDryRun</code> + Diff-Review; ggf. eigene überschreibende Recipe",
    severity: "med",
  },
  {
    risk: "AI-Halluzinationen im Pattern-1-Loop",
    mitigation: "Iteration-Limit; menschliches Review vor PR-Merge",
    severity: "high",
  },
  {
    risk: "Token-Kosten eskalieren",
    mitigation: "Pro-Run-Budget; Pattern 2 bevorzugen",
    severity: "med",
  },
  {
    risk: "Type Attribution fehlt → Recipe tut nichts",
    mitigation: "<code>Find missing types</code>-Diagnostic-Recipe",
    severity: "low",
  },
  {
    risk: "Vendor-Lock-in zu Moderne",
    mitigation:
      "OSS-Anteile bevorzugen; Moderne-spezifische Features isolieren",
    severity: "high",
  },
];
</script>

<template>
  <table class="risk">
    <thead>
      <tr>
        <th>Risiko</th>
        <th>Mitigation</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(r, i) in risks" :key="i">
        <td>
          <span :class="['sev', `sev-${r.severity}`]" />
          {{ r.risk }}
        </td>
        <td v-html="r.mitigation" />
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.risk {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.risk th {
  text-align: left;
  font-weight: 500;
  padding: 8px 10px;
  border-bottom: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
}
.risk td {
  padding: 7px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
  line-height: 1.5;
}
.risk td :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-background-secondary);
  padding: 0 4px;
  border-radius: 3px;
}
.sev {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}
.sev-low {
  background: var(--color-text-success);
}
.sev-med {
  background: var(--color-text-warning);
}
.sev-high {
  background: var(--color-text-danger);
}
</style>
