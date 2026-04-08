<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const worktrees = computed(() => {
  const d = isDark.value;
  const erstklassig = {
    badgeBg: d ? "#1a2810" : "#EAF3DE",
    badgeColor: d ? "#80c050" : "#27500A",
  };
  const manuell = {
    badgeBg: d ? "#332810" : "#FAEEDA",
    badgeColor: d ? "#d4a050" : "#633806",
  };
  return [
    {
      tool: "Claude Code",
      level: "Erstklassig",
      desc: "claude --worktree name. Subagents: isolation: worktree. Auto-Cleanup.",
      ...erstklassig,
    },
    {
      tool: "Codex App",
      level: "Erstklassig",
      desc: 'Thread-Typ "Worktree". Handoff Local ↔ Worktree. Background-Automations.',
      ...erstklassig,
    },
    {
      tool: "Windsurf",
      level: "Erstklassig",
      desc: "Seit Wave 13. Side-by-side Cascade-Panes. Git Worktrees als Backend.",
      ...erstklassig,
    },
    {
      tool: "Junie / IntelliJ",
      level: "Nativ (ab 2026.1)",
      desc: "Nativer Worktree-Support seit IntelliJ IDEA 2026.1. Für AI-Agent-Workflows.",
      ...erstklassig,
    },
    {
      tool: "Gemini CLI",
      level: "Manuell",
      desc: "Kein --worktree-Flag. Manuell: git worktree add + cd + gemini.",
      ...manuell,
    },
    {
      tool: "OpenCode",
      level: "Manuell",
      desc: "Kein automatisches Management. Manuelles Setup funktioniert.",
      ...manuell,
    },
  ];
});

const combo = computed(() => {
  const d = isDark.value;
  return {
    subBg: d ? "#1a3028" : "#E1F5EE",
    subBorder: d ? "#40a080" : "#0F6E56",
    subName: d ? "#5cc0a0" : "#085041",
    subText: d ? "#ccc" : "#333",
    wtBg: d ? "#2a2640" : "#EEEDFE",
    wtBorder: d ? "#7c72d0" : "#534AB7",
    wtName: d ? "#a5a0e0" : "#3C3489",
    bothBg: d ? "#331810" : "#FAECE7",
    bothBorder: d ? "#e08050" : "#D85A30",
    bothName: d ? "#e09060" : "#712B13",
    bothText: d ? "#e09060" : "#712B13",
    codeBg: d ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    codeColor: d ? "#e09060" : "#4a1a0a",
  };
});

const C = computed(() => {
  const d = isDark.value;
  return {
    sectionLabelColor: d ? "#aaa" : "#888",
    cardBg: d ? "#1e1e1e" : "white",
    cardBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    cardColor: d ? "#e5e5e5" : "#1a1a18",
    cardH4: d ? "#e5e5e5" : "#1a1a18",
    cardP: d ? "#ccc" : "#333",
    comboSub: d ? "#ccc" : "#333",
    comboArrow: d ? "#aaa" : "#888",
    limitsColor: "#aaa",
  };
});

const orchestrators = [
  {
    name: "Baton",
    desc: "Desktop-App. Claude Code, Codex, OpenCode, Gemini CLI. Status-Badges, PR-Erstellung.",
  },
  {
    name: "Agentastic",
    desc: "macOS. 30+ Agenten. Worktree ODER Docker pro Agent. Built-in IDE.",
  },
  {
    name: "CCManager",
    desc: "CLI. 8 Agenten. Session-Daten kopierbar. Worktree-Hooks.",
  },
  {
    name: "agent-cli dev",
    desc: "CLI. Ein Befehl: Worktree + Deps + Env + Agent.",
  },
];
</script>

<template>
  <div class="scroll-area">
    <div class="section-label">Nativer Worktree-Support</div>
    <div class="wt-grid">
      <div v-for="w in worktrees" :key="w.tool" class="wt-card">
        <span
          class="wt-badge"
          :style="{ background: w.badgeBg, color: w.badgeColor }"
          >{{ w.level }}</span
        >
        <h4>{{ w.tool }}</h4>
        <p>{{ w.desc }}</p>
      </div>
    </div>

    <div class="section-label" style="margin-top: 8px">
      Subagent vs. Worktree vs. Beides
    </div>
    <div class="combo-row">
      <div
        class="combo-box"
        :style="{ background: combo.subBg, borderColor: combo.subBorder }"
      >
        <div class="combo-name" :style="{ color: combo.subName }">Subagent</div>
        <div class="combo-sub">
          Isoliert <strong>Kontext</strong><br />Selbes Verzeichnis
        </div>
      </div>
      <div class="combo-arrow">+</div>
      <div
        class="combo-box"
        :style="{ background: combo.wtBg, borderColor: combo.wtBorder }"
      >
        <div class="combo-name" :style="{ color: combo.wtName }">Worktree</div>
        <div class="combo-sub">
          Isoliert <strong>Dateisystem</strong><br />Eigener Branch
        </div>
      </div>
      <div class="combo-arrow">=</div>
      <div
        class="combo-box"
        :style="{ background: combo.bothBg, borderColor: combo.bothBorder }"
      >
        <div class="combo-name" :style="{ color: combo.bothName }">Beides</div>
        <div class="combo-sub" :style="{ color: combo.bothText }">
          <code
            :style="{
              fontSize: '9px',
              color: combo.codeColor,
              background: combo.codeBg,
              padding: '1px 4px',
              borderRadius: '3px',
            }"
            >isolation: worktree</code
          >
        </div>
      </div>
    </div>

    <div class="section-label" style="margin-top: 8px">
      Orchestrierungstools
    </div>
    <div class="wt-grid">
      <div v-for="o in orchestrators" :key="o.name" class="wt-card">
        <h4>{{ o.name }}</h4>
        <p>{{ o.desc }}</p>
      </div>
    </div>

    <div class="section-label" style="margin-top: 6px">Limits</div>
    <p :style="{ fontSize: '9px', color: C.limitsColor, lineHeight: '1.4' }">
      3-5 parallele Worktrees realistisch · Disk Space: Working-Tree dupliziert
      · Keine DB/Docker-Isolation
    </p>
  </div>
</template>

<style scoped>
.scroll-area {
  max-height: 400px;
  overflow-y: auto;
}
.section-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: v-bind("C.sectionLabelColor");
  margin-bottom: 4px;
}
.wt-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}
.wt-card {
  border-radius: 7px;
  padding: 6px 8px;
  border: 1px solid v-bind("C.cardBorder");
  background: v-bind("C.cardBg");
  color: v-bind("C.cardColor");
}
.wt-card h4 {
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 1px;
  color: v-bind("C.cardH4");
}
.wt-card p {
  font-size: 8px;
  color: v-bind("C.cardP");
  line-height: 1.3;
}
.wt-badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 6px;
  margin-bottom: 3px;
}
.combo-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.combo-box {
  flex: 1;
  min-width: 80px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid;
  text-align: center;
}
.combo-name {
  font-weight: 600;
  font-size: 10px;
}
.combo-sub {
  font-size: 8px;
  color: v-bind("C.comboSub");
}
.combo-arrow {
  display: flex;
  align-items: center;
  color: v-bind("C.comboArrow");
  font-size: 14px;
  flex-shrink: 0;
}
</style>
