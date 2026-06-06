<script setup>
import CollapsibleSection from "./CollapsibleSection.vue";
</script>

<template>
  <div>
    <CollapsibleSection
      id="platform-overview"
      title="Plattform-Übersicht"
      :open="false"
    >
      <table class="tbl">
        <thead>
          <tr>
            <th>Plattform</th>
            <th>Bereitstellung</th>
            <th>Features</th>
            <th>Einschränkungen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Claude Code (CLI)</b></td>
            <td>~/.claude/skills/ oder .claude/skills/</td>
            <td>Auto-Discovery, Slash-Commands, Subagents, Hooks</td>
            <td>
              <span class="dng">Kein AGENTS.md-Support (Stand April 2026)</span>
            </td>
          </tr>
          <tr>
            <td><b>claude.ai (Web)</b></td>
            <td>.zip-Upload über Settings</td>
            <td>Vorgefertigte + Partner-Skills</td>
            <td>Kein CLI-Zugriff</td>
          </tr>
          <tr>
            <td><b>Claude API</b></td>
            <td>container-Parameter</td>
            <td>Max 8 Skills/Request</td>
            <td>
              <span class="dng">Kein Netzwerk, keine Runtime-Pakete</span>
            </td>
          </tr>
          <tr>
            <td><b>OpenAI Codex</b></td>
            <td>SKILL.md + AGENTS.md im Repo</td>
            <td>Standard-Felder, AGENTS.override.md</td>
            <td>Keine CC-Erweiterungen</td>
          </tr>
          <tr>
            <td><b>Cursor</b></td>
            <td>SKILL.md + AGENTS.md + .cursorrules</td>
            <td>Standard-Felder</td>
            <td>Keine CC-Erweiterungen</td>
          </tr>
          <tr>
            <td><b>Gemini CLI</b></td>
            <td>SKILL.md + AGENTS.md im Repo</td>
            <td>Standard-Felder</td>
            <td>Keine CC-Erweiterungen</td>
          </tr>
        </tbody>
      </table>
    </CollapsibleSection>

    <CollapsibleSection
      id="cc-storage"
      title="Claude Code — Speicherorte & Priorität"
    >
      <div class="flow">
        <div class="flow-box fb-red">
          Enterprise<br /><span class="flow-sub">Managed Settings</span>
        </div>
        <span class="flow-arrow">&#9656;</span>
        <div class="flow-box fb-purple">
          Persönlich<br /><span class="flow-sub">~/.claude/skills/</span>
        </div>
        <span class="flow-arrow">&#9656;</span>
        <div class="flow-box fb-teal">
          Projekt<br /><span class="flow-sub">.claude/skills/</span>
        </div>
        <span class="flow-arrow">&#9656;</span>
        <div class="flow-box fb-amber">
          Plugin<br /><span class="flow-sub">plugin/skills/</span>
        </div>
      </div>
      <div class="callout">
        <b>AGENTS.md-Notlösung für Claude Code:</b> Da Claude Code AGENTS.md
        nicht nativ liest, kann man es per <code>@Import</code> in die CLAUDE.md
        einbinden: <code>See @AGENTS.md for cross-tool conventions.</code>
      </div>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
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
.fb-red {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
  border: 0.5px solid var(--color-border-danger);
}
.dng {
  color: var(--color-text-danger);
}
.callout {
  border-left: 3px solid var(--color-border-warning);
  background: var(--color-background-warning);
  padding: 10px 14px;
  border-radius: 0 var(--sk-radm) var(--sk-radm) 0;
  margin: 10px 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-warning);
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
