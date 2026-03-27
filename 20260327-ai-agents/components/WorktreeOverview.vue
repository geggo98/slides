<script setup>
const worktrees = [
  { tool: 'Claude Code', level: 'Erstklassig', desc: 'claude --worktree name. Subagents: isolation: worktree. Auto-Cleanup.', badgeBg: '#EAF3DE', badgeColor: '#27500A' },
  { tool: 'Codex App', level: 'Erstklassig', desc: 'Thread-Typ "Worktree". Handoff Local ↔ Worktree. Background-Automations.', badgeBg: '#EAF3DE', badgeColor: '#27500A' },
  { tool: 'Windsurf', level: 'Erstklassig', desc: 'Seit Wave 13. Side-by-side Cascade-Panes. Git Worktrees als Backend.', badgeBg: '#EAF3DE', badgeColor: '#27500A' },
  { tool: 'Junie / IntelliJ', level: 'Nativ (ab 2026.1)', desc: 'Nativer Worktree-Support seit IntelliJ IDEA 2026.1. Für AI-Agent-Workflows.', badgeBg: '#EAF3DE', badgeColor: '#27500A' },
  { tool: 'Gemini CLI', level: 'Manuell', desc: 'Kein --worktree-Flag. Manuell: git worktree add + cd + gemini.', badgeBg: '#FAEEDA', badgeColor: '#633806' },
  { tool: 'OpenCode', level: 'Manuell', desc: 'Kein automatisches Management. Manuelles Setup funktioniert.', badgeBg: '#FAEEDA', badgeColor: '#633806' },
]

const orchestrators = [
  { name: 'Baton', desc: 'Desktop-App. Claude Code, Codex, OpenCode, Gemini CLI. Status-Badges, PR-Erstellung.' },
  { name: 'Agentastic', desc: 'macOS. 30+ Agenten. Worktree ODER Docker pro Agent. Built-in IDE.' },
  { name: 'CCManager', desc: 'CLI. 8 Agenten. Session-Daten kopierbar. Worktree-Hooks.' },
  { name: 'agent-cli dev', desc: 'CLI. Ein Befehl: Worktree + Deps + Env + Agent.' },
]
</script>

<template>
  <div class="scroll-area">
    <div class="section-label">Nativer Worktree-Support</div>
    <div class="wt-grid">
      <div v-for="w in worktrees" :key="w.tool" class="wt-card">
        <span class="wt-badge" :style="{ background: w.badgeBg, color: w.badgeColor }">{{ w.level }}</span>
        <h4>{{ w.tool }}</h4>
        <p>{{ w.desc }}</p>
      </div>
    </div>

    <div class="section-label" style="margin-top: 8px;">Subagent vs. Worktree vs. Beides</div>
    <div class="combo-row">
      <div class="combo-box" style="background: #E1F5EE; border-color: #0F6E56;">
        <div class="combo-name" style="color: #085041;">Subagent</div>
        <div class="combo-sub">Isoliert <strong>Kontext</strong><br>Selbes Verzeichnis</div>
      </div>
      <div class="combo-arrow">+</div>
      <div class="combo-box" style="background: #EEEDFE; border-color: #534AB7;">
        <div class="combo-name" style="color: #3C3489;">Worktree</div>
        <div class="combo-sub">Isoliert <strong>Dateisystem</strong><br>Eigener Branch</div>
      </div>
      <div class="combo-arrow">=</div>
      <div class="combo-box" style="background: #FAECE7; border-color: #D85A30;">
        <div class="combo-name" style="color: #712B13;">Beides</div>
        <div class="combo-sub" style="color: #712B13;"><code style="font-size: 9px; color: #4a1a0a; background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 3px;">isolation: worktree</code></div>
      </div>
    </div>

    <div class="section-label" style="margin-top: 8px;">Orchestrierungstools</div>
    <div class="wt-grid">
      <div v-for="o in orchestrators" :key="o.name" class="wt-card">
        <h4>{{ o.name }}</h4>
        <p>{{ o.desc }}</p>
      </div>
    </div>

    <div class="section-label" style="margin-top: 6px;">Limits</div>
    <p style="font-size: 9px; color: #aaa; line-height: 1.4;">
      3-5 parallele Worktrees realistisch · Disk Space: Working-Tree dupliziert · Keine DB/Docker-Isolation
    </p>
  </div>
</template>

<style scoped>
.scroll-area { max-height: 400px; overflow-y: auto; }
.section-label {
  font-size: 9px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.8px; color: #888; margin-bottom: 4px;
}
.wt-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;
}
.wt-card {
  border-radius: 7px; padding: 6px 8px; border: 1px solid rgba(0,0,0,0.1);
  background: white; color: #1a1a18;
}
.wt-card h4 { font-size: 10px; font-weight: 600; margin-bottom: 1px; color: #1a1a18; }
.wt-card p { font-size: 8px; color: #333; line-height: 1.3; }
.wt-badge {
  display: inline-block; font-size: 8px; font-weight: 700;
  padding: 1px 5px; border-radius: 6px; margin-bottom: 3px;
}
.combo-row { display: flex; gap: 6px; align-items: stretch; }
.combo-box {
  flex: 1; min-width: 80px; padding: 6px 8px; border-radius: 7px;
  border: 1px solid; text-align: center;
}
.combo-name { font-weight: 600; font-size: 10px; }
.combo-sub { font-size: 8px; color: #333; }
.combo-arrow { display: flex; align-items: center; color: #888; font-size: 14px; flex-shrink: 0; }
</style>
