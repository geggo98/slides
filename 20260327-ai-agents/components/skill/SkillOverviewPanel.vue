<script setup>
import CollapsibleSection from "./CollapsibleSection.vue";
</script>

<template>
  <div>
    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Plattformen (Skills)</div>
        <div class="metric-val hl">26+</div>
      </div>
      <div class="metric">
        <div class="metric-label">Tokens / Skill (Metadaten)</div>
        <div class="metric-val succ">~100</div>
      </div>
      <div class="metric">
        <div class="metric-label">AGENTS.md-Projekte</div>
        <div class="metric-val hl">60.000+</div>
      </div>
      <div class="metric">
        <div class="metric-label">Community-Schwachstellen</div>
        <div class="metric-val dng">36,8%</div>
      </div>
    </div>

    <CollapsibleSection
      id="what-are-skills"
      title="Was sind Agent Skills?"
      :open="false"
    >
      <b>Agent Skills</b> sind ein offener Standard (agentskills.io) für
      modulare, wiederverwendbare KI-Anweisungen. Im Kern: ein Verzeichnis mit
      einer <span class="hl">SKILL.md</span>-Datei plus optionalen Scripts,
      Referenzen und Assets. Skills laden <em>kontexteffizient on-demand</em> —
      im Gegensatz zu Projektanweisungen (CLAUDE.md / AGENTS.md), die dauerhaft
      geladen werden.
      <div class="flow">
        <div class="flow-box fb-purple">
          Metadaten<br /><span class="flow-sub">~100 Tokens</span>
        </div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-teal">
          Instruktionen<br /><span class="flow-sub">&lt;5k Tokens</span>
        </div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-amber">
          Ressourcen<br /><span class="flow-sub">unbegrenzt</span>
        </div>
      </div>
      <div class="note">
        Agent Skills und AGENTS.md wurden beide im Dez. 2025 an die Agentic AI
        Foundation (Linux Foundation) übergeben — zusammen mit MCP.
      </div>
    </CollapsibleSection>

    <CollapsibleSection id="three-files" title="Die drei Dateien im Ökosystem">
      <div class="tri-grid">
        <div class="tri-card">
          <h4 class="hl">AGENTS.md</h4>
          <p>
            <b>Offener Standard</b> für Projektanweisungen.
            Plattformübergreifend: Codex, Cursor, Gemini CLI, Devin Desktop,
            Aider, Zed, etc. Reines Markdown, kein Schema nötig. Das README für
            AI-Agents.
          </p>
        </div>
        <div class="tri-card">
          <h4 class="warn">CLAUDE.md</h4>
          <p>
            <b>Claude-Code-spezifisch.</b> Gleicher Zweck wie AGENTS.md, aber
            mit proprietären Features: @Import, path-scoped Rules,
            User/Local/Enterprise-Hierarchie.
          </p>
        </div>
        <div class="tri-card">
          <h4 class="succ">SKILL.md</h4>
          <p>
            <b>Offener Standard</b> für modulare Skills. On-demand geladen statt
            dauerhaft. YAML-Frontmatter + Markdown + Supporting Files. 26+
            Plattformen.
          </p>
        </div>
      </div>
      <hr class="sep" />
      <b>Wichtig:</b> AGENTS.md und CLAUDE.md lösen dasselbe Problem
      (Projektanweisungen), SKILL.md löst ein anderes (modulares Domänenwissen
      on-demand). Die Standards sind <em>komplementär</em>, nicht konkurrierend.
    </CollapsibleSection>

    <CollapsibleSection
      id="agent-vs-cc"
      title="Agent Skills vs. Claude Code Skills"
    >
      <span class="dng">Nicht dasselbe.</span> „Agent Skills" = der
      <b>offene Standard</b> (plattformübergreifend). „Claude Code Skills" =
      Anthropics <b>Implementierung</b> mit proprietären Erweiterungsfeldern.
      <table class="tbl">
        <thead>
          <tr>
            <th>Aspekt</th>
            <th>Agent Skills (offen)</th>
            <th>Claude Code Skills</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Frontmatter-Felder</td>
            <td>6 Standard</td>
            <td>6 Standard + 11 Erweiterungen</td>
          </tr>
          <tr>
            <td>Subagent-Execution</td>
            <td>—</td>
            <td>context: fork, agent: Explore</td>
          </tr>
          <tr>
            <td>Dynamic Context Injection</td>
            <td>—</td>
            <td>!`command` Syntax</td>
          </tr>
          <tr>
            <td>Hooks / Path-Activation</td>
            <td>—</td>
            <td>hooks, paths Felder</td>
          </tr>
          <tr>
            <td>Portabilität</td>
            <td>26+ Plattformen</td>
            <td>Nur Claude Code CLI</td>
          </tr>
        </tbody>
      </table>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 1.25rem;
}
.metric {
  background: var(--color-background-secondary);
  border-radius: var(--sk-radm);
  padding: 0.75rem 1rem;
}
.metric-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.metric-val {
  font-size: 20px;
  font-weight: 500;
}
.hl {
  color: var(--color-text-info);
  font-weight: 500;
}
.succ {
  color: var(--color-text-success);
}
.dng {
  color: var(--color-text-danger);
}
.warn {
  color: var(--color-text-warning);
}
.note {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: italic;
  margin-top: 6px;
}
.sep {
  border: none;
  border-top: 0.5px solid var(--color-border-tertiary);
  margin: 12px 0;
}
.flow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.flow-box {
  padding: 8px 14px;
  border-radius: var(--sk-radm);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  min-width: 80px;
}
.flow-sub {
  font-size: 10px;
  font-weight: 400;
}
.flow-arrow {
  color: var(--color-text-tertiary);
  font-size: 14px;
}
.fb-purple {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border: 0.5px solid var(--color-border-info);
}
.fb-teal {
  background: var(--color-background-success);
  color: var(--color-text-success);
  border: 0.5px solid var(--color-border-success);
}
.fb-amber {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
  border: 0.5px solid var(--color-border-warning);
}
.tri-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin: 10px 0;
}
.tri-card {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--sk-radm);
  padding: 10px;
}
.tri-card h4 {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}
.tri-card p {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
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
