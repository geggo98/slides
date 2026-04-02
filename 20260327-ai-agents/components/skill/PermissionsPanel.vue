<script setup>
import CollapsibleSection from './CollapsibleSection.vue'
</script>

<template>
  <div>
    <CollapsibleSection id="permission-hierarchy" title="Permission-Hierarchie" :open="false">
      Claude Code evaluiert: <span class="dng">deny</span> → <span class="warn">ask</span> → <span class="succ">allow</span> (deny gewinnt immer).
      <div class="flow">
        <div class="flow-box fb-purple">User Settings<br><span class="flow-sub">~/.claude/settings.json</span></div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-teal">Project Settings<br><span class="flow-sub">.claude/settings.json</span></div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-amber">Local Settings<br><span class="flow-sub">settings.local.json</span></div>
        <span class="flow-arrow">&rarr;</span>
        <div class="flow-box fb-red">Enterprise<br><span class="flow-sub">nicht überschreibbar</span></div>
      </div>
      <hr class="sep">
      <b>Skill-spezifische Kontrolle:</b> <code>Skill(name)</code> exakter Match | <code>Skill(name *)</code> Präfix | <code>Skill</code> in Deny = alle deaktiviert
    </CollapsibleSection>

    <CollapsibleSection id="toxic-skills" title="Sicherheitsrisiken — ToxicSkills-Audit">
      <div class="metrics">
        <div class="metric"><div class="metric-label">Kritische Probleme</div><div class="metric-val dng">13,4%</div></div>
        <div class="metric"><div class="metric-label">Mind. 1 Schwachstelle</div><div class="metric-val warn">36,8%</div></div>
        <div class="metric"><div class="metric-label">Getestete Skills</div><div class="metric-val">~4.000</div></div>
        <div class="metric"><div class="metric-label">CVEs in Claude Code</div><div class="metric-val dng">2</div></div>
      </div>
      <b>Empfehlungen:</b> Skills wie Software-Installation behandeln — alle Dateien auditieren. Sandbox (macOS Seatbelt, Linux bubblewrap) reduziert Permission-Prompts um 84%. API-Skills: <span class="succ">kein Netzwerk</span>. Claude-Code-Skills: <span class="dng">voller Netzwerkzugang</span>.
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 12px 0; }
.flow-box { padding: 8px 14px; border-radius: var(--sk-radm); font-size: 12px; font-weight: 500; text-align: center; min-width: 90px; }
.flow-sub { font-size: 10px; font-weight: 400; }
.flow-arrow { color: var(--color-text-tertiary); font-size: 14px; }
.fb-purple { background: var(--color-background-info); color: var(--color-text-info); border: 0.5px solid var(--color-border-info); }
.fb-teal { background: var(--color-background-success); color: var(--color-text-success); border: 0.5px solid var(--color-border-success); }
.fb-amber { background: var(--color-background-warning); color: var(--color-text-warning); border: 0.5px solid var(--color-border-warning); }
.fb-red { background: var(--color-background-danger); color: var(--color-text-danger); border: 0.5px solid var(--color-border-danger); }
.sep { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 12px 0; }
.dng { color: var(--color-text-danger); }
.warn { color: var(--color-text-warning); }
.succ { color: var(--color-text-success); }
.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 1rem; }
.metric { background: var(--color-background-secondary); border-radius: var(--sk-radm); padding: 0.75rem 1rem; }
.metric-label { font-size: 11px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
.metric-val { font-size: 20px; font-weight: 500; }
</style>
