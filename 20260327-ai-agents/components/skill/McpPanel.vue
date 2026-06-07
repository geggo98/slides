<script setup>
import CollapsibleSection from "./CollapsibleSection.vue";
import MonacoBlock from "@shared/components/MonacoBlock.vue";

const codeMcp = `---
name: issue-workflow
allowed-tools:
  - mcp__jira__create_issue
  - mcp__github__create_branch
---
## Workflow
1. Sammle Issue-Details vom Nutzer
2. Nutze mcp__jira__create_issue
3. Erstelle Branch mit mcp__github__create_branch`;
</script>

<template>
  <div>
    <CollapsibleSection
      id="skills-mcp"
      title="Skills + MCP = Rezept + Küche"
      :open="false"
    >
      <b>MCP</b> stellt Werkzeuge bereit. <b>Skills</b> definieren,
      <em>wie</em> diese eingesetzt werden. Die Kombination ist das
      leistungsfähigste Pattern für agentenbasierte Workflows.
      <MonacoBlock :code="codeMcp" language="yaml" height="240px" />
      <b>Namenskonvention:</b>
      <code>mcp__&lt;server_name&gt;__&lt;tool_name&gt;</code>
    </CollapsibleSection>

    <CollapsibleSection
      id="token-comparison"
      title="Token-Vergleich: Skills vs. MCP"
    >
      <table class="tbl">
        <thead>
          <tr>
            <th>Mechanismus</th>
            <th>Token-Kosten</th>
            <th>Reduktion</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>MCP-Tools (ohne Optimierung)</td>
            <td><span class="dng">50.000+ Tokens</span></td>
            <td>—</td>
          </tr>
          <tr>
            <td>MCP + Tool Search (default on)</td>
            <td>~7.500 Tokens</td>
            <td>~85%</td>
          </tr>
          <tr>
            <td>Skill-Metadaten (Level 1)</td>
            <td><span class="succ">~100 Tokens</span></td>
            <td>—</td>
          </tr>
          <tr>
            <td>Skill aktiviert (Level 2)</td>
            <td>&lt;5.000 Tokens</td>
            <td>On-demand</td>
          </tr>
        </tbody>
      </table>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.dng {
  color: var(--color-text-danger);
}
.succ {
  color: var(--color-text-success);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin: 8px 0;
}
.tbl th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-tertiary);
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.tbl td {
  padding: 6px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
}
.tbl tr:last-child td {
  border-bottom: none;
}
</style>
