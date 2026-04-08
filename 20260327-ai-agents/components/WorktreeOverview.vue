<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const worktrees = computed(() =>
  isDark.value
    ? [
        {
          tool: "Claude Code",
          level: "Erstklassig",
          desc: "claude --worktree name. Subagents: isolation: worktree. Auto-Cleanup.",
          badgeBg: "#1a2810",
          badgeColor: "#80c050",
        },
        {
          tool: "Codex App",
          level: "Erstklassig",
          desc: 'Thread-Typ "Worktree". Handoff Local ↔ Worktree. Background-Automations.',
          badgeBg: "#1a2810",
          badgeColor: "#80c050",
        },
        {
          tool: "Windsurf",
          level: "Erstklassig",
          desc: "Seit Wave 13. Side-by-side Cascade-Panes. Git Worktrees als Backend.",
          badgeBg: "#1a2810",
          badgeColor: "#80c050",
        },
        {
          tool: "Junie / IntelliJ",
          level: "Nativ (ab 2026.1)",
          desc: "Nativer Worktree-Support seit IntelliJ IDEA 2026.1. Für AI-Agent-Workflows.",
          badgeBg: "#1a2810",
          badgeColor: "#80c050",
        },
        {
          tool: "Gemini CLI",
          level: "Manuell",
          desc: "Kein --worktree-Flag. Manuell: git worktree add + cd + gemini.",
          badgeBg: "#332810",
          badgeColor: "#d4a050",
        },
        {
          tool: "OpenCode",
          level: "Manuell",
          desc: "Kein automatisches Management. Manuelles Setup funktioniert.",
          badgeBg: "#332810",
          badgeColor: "#d4a050",
        },
      ]
    : [
        {
          tool: "Claude Code",
          level: "Erstklassig",
          desc: "claude --worktree name. Subagents: isolation: worktree. Auto-Cleanup.",
          badgeBg: "#EAF3DE",
          badgeColor: "#27500A",
        },
        {
          tool: "Codex App",
          level: "Erstklassig",
          desc: 'Thread-Typ "Worktree". Handoff Local ↔ Worktree. Background-Automations.',
          badgeBg: "#EAF3DE",
          badgeColor: "#27500A",
        },
        {
          tool: "Windsurf",
          level: "Erstklassig",
          desc: "Seit Wave 13. Side-by-side Cascade-Panes. Git Worktrees als Backend.",
          badgeBg: "#EAF3DE",
          badgeColor: "#27500A",
        },
        {
          tool: "Junie / IntelliJ",
          level: "Nativ (ab 2026.1)",
          desc: "Nativer Worktree-Support seit IntelliJ IDEA 2026.1. Für AI-Agent-Workflows.",
          badgeBg: "#EAF3DE",
          badgeColor: "#27500A",
        },
        {
          tool: "Gemini CLI",
          level: "Manuell",
          desc: "Kein --worktree-Flag. Manuell: git worktree add + cd + gemini.",
          badgeBg: "#FAEEDA",
          badgeColor: "#633806",
        },
        {
          tool: "OpenCode",
          level: "Manuell",
          desc: "Kein automatisches Management. Manuelles Setup funktioniert.",
          badgeBg: "#FAEEDA",
          badgeColor: "#633806",
        },
      ],
);

const combo = computed(() =>
  isDark.value
    ? {
        subBg: "#1a3028",
        subBorder: "#40a080",
        subName: "#5cc0a0",
        subText: "#ccc",
        wtBg: "#2a2640",
        wtBorder: "#7c72d0",
        wtName: "#a5a0e0",
        bothBg: "#331810",
        bothBorder: "#e08050",
        bothName: "#e09060",
        bothText: "#e09060",
        codeBg: "rgba(255,255,255,0.08)",
        codeColor: "#e09060",
      }
    : {
        subBg: "#E1F5EE",
        subBorder: "#0F6E56",
        subName: "#085041",
        subText: "#333",
        wtBg: "#EEEDFE",
        wtBorder: "#534AB7",
        wtName: "#3C3489",
        bothBg: "#FAECE7",
        bothBorder: "#D85A30",
        bothName: "#712B13",
        bothText: "#712B13",
        codeBg: "rgba(0,0,0,0.08)",
        codeColor: "#4a1a0a",
      },
);

const C = computed(() =>
  isDark.value
    ? {
        sectionLabelColor: "#aaa",
        cardBg: "#1e1e1e",
        cardBorder: "rgba(255,255,255,0.12)",
        cardColor: "#e5e5e5",
        cardH4: "#e5e5e5",
        cardP: "#ccc",
        comboSub: "#ccc",
        comboArrow: "#aaa",
        limitsColor: "#aaa",
      }
    : {
        sectionLabelColor: "#888",
        cardBg: "white",
        cardBorder: "rgba(0,0,0,0.1)",
        cardColor: "#1a1a18",
        cardH4: "#1a1a18",
        cardP: "#333",
        comboSub: "#333",
        comboArrow: "#888",
        limitsColor: "#aaa",
      },
);

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
