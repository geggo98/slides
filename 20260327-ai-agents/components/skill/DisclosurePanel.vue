<script setup>
import CollapsibleSection from './CollapsibleSection.vue'
import MonacoBlock from './MonacoBlock.vue'

const scriptTrickCode = `# Dynamic Context Injection (Claude Code only)
---
name: pr-summary
context: fork
agent: Explore
---
## Kontext
- PR diff: !\`gh pr diff\`
- Geänderte Dateien: !\`gh pr diff --name-only\``
</script>

<template>
  <div>
    <CollapsibleSection id="load-system" title="Dreistufiges Ladesystem" :open="false">
      <div class="flow">
        <div class="flow-box fb-purple">Level 1<br><span class="flow-sub">Metadaten</span></div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-teal">Level 2<br><span class="flow-sub">Instruktionen</span></div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-amber">Level 3+<br><span class="flow-sub">Ressourcen</span></div>
      </div>
      <hr class="sep">
      <table class="tbl">
        <tr><th>Level</th><th>Was wird geladen</th><th>Tokens</th><th>Wann</th></tr>
        <tr><td><span class="hl">1 — Metadaten</span></td><td>Name + Description aller Skills</td><td>~100 pro Skill</td><td>Immer beim Sitzungsstart</td></tr>
        <tr><td><span class="succ">2 — Instruktionen</span></td><td>SKILL.md Body (Markdown)</td><td>&lt;5.000</td><td>Bei Relevanz oder /slash-Aufruf</td></tr>
        <tr><td><span class="warn">3+ — Ressourcen</span></td><td>Scripts, Referenzen, Assets</td><td>Unbegrenzt (nur Output)</td><td>Bei Bedarf im Skill-Workflow</td></tr>
      </table>
      <hr class="sep">
      <b>Rechenbeispiel:</b> 50 installierte Skills × ~100 Tokens = <span class="hl">~5.000 Tokens Overhead</span>.
      <hr class="sep">
      <b>Kontrast:</b> Projektanweisungen (CLAUDE.md / AGENTS.md) werden <span class="dng">immer vollständig</span> beim Sitzungsstart geladen und belegen dauerhaft Tokens. Skills laden on-demand.
    </CollapsibleSection>

    <CollapsibleSection id="script-trick" title="Script-Trick: nur Output in Kontext">
      Claude führt Skripte via Bash aus. Der <b>Quellcode</b> des Skripts wird <span class="succ">nicht in den Kontext geladen</span> — nur sein <b>Output</b>. Ein 2.000-Zeilen Python-Skript verbraucht null Kontextbudget.
      <MonacoBlock :code="scriptTrickCode" language="yaml" height="220px" />
      <div class="note">Die !`command`-Syntax ist eine Claude-Code-Erweiterung und nicht Teil des offenen Standards.</div>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 12px 0; }
.flow-box { padding: 8px 14px; border-radius: var(--sk-radm); font-size: 12px; font-weight: 500; text-align: center; min-width: 100px; }
.flow-sub { font-size: 10px; font-weight: 400; }
.flow-arrow { color: var(--color-text-tertiary); font-size: 14px; }
.fb-purple { background: var(--color-background-info); color: var(--color-text-info); border: 0.5px solid var(--color-border-info); }
.fb-teal { background: var(--color-background-success); color: var(--color-text-success); border: 0.5px solid var(--color-border-success); }
.fb-amber { background: var(--color-background-warning); color: var(--color-text-warning); border: 0.5px solid var(--color-border-warning); }
.sep { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 12px 0; }
.hl { color: var(--color-text-info); font-weight: 500; }
.succ { color: var(--color-text-success); }
.warn { color: var(--color-text-warning); }
.dng { color: var(--color-text-danger); }
.note { font-size: 12px; color: var(--color-text-tertiary); font-style: italic; margin-top: 6px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
.tbl th { text-align: left; padding: 6px 10px; border-bottom: 0.5px solid var(--color-border-tertiary); color: var(--color-text-tertiary); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
.tbl td { padding: 6px 10px; border-bottom: 0.5px solid var(--color-border-tertiary); vertical-align: top; }
.tbl tr:last-child td { border-bottom: none; }
</style>
