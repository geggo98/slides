<script setup>
const events = [
  {
    tag: "prompt",
    date: "Juni 2020",
    title: "GPT-3 · In-Context-Learning wird Ding",
    actor: "// Prompt Engineering entsteht als Praxis-Begriff",
  },
  {
    tag: "prompt",
    date: "Januar 2022",
    title: "Chain-of-Thought (Wei et al.)",
    actor: "„Let's think step by step\" · Prompt-Hype beginnt",
  },
  {
    tag: "prompt",
    date: "März 2023",
    title: "Lilian Wengs kanonischer Lil'Log-Post",
    actor: "Prompt Engineering als Disziplin definiert",
  },
  {
    tag: "context",
    date: "18. Juni 2025",
    title: 'Tobi Lütke prägt „Context Engineering"',
    actor: "// the art of providing all the context",
  },
  {
    tag: "context",
    date: "25. Juni 2025",
    title: "Karpathy verstärkt den Begriff",
    actor: 'Willison prognostiziert „sticking power" — zu Recht',
  },
  {
    tag: "context",
    date: "29. September 2025",
    title: 'Anthropic: „Effective context engineering for AI agents"',
    actor: "// Sonnet 4.5 + Memory Tool · Industrie-Adoption",
  },
  {
    tag: "harness",
    date: "Februar 2026",
    title: "OpenAI Codex-Team · Harness Engineering Report",
    actor: "// 1M+ LoC ohne manuellen Code · „it's all about the harness\"",
  },
  {
    tag: "harness",
    date: "Februar 2026",
    title: "Mitchell Hashimoto · Leitmaxime",
    actor: '„engineer a solution so it can never make that mistake again"',
  },
  {
    tag: "harness",
    date: "März 2026",
    title: "LangChain · Deep Agents Harness Engineering",
    actor: "// Terminal Bench 2.0: Platz 30 → Platz 5 ohne Modellwechsel",
  },
  {
    tag: "evolution",
    date: "April 2026",
    title: "Hermes Agent v0.10 · skill_manage in der Wildnis",
    actor: "// prozedurales Memory als erste produktive Self-Evolution",
  },
];
</script>

<template>
  <div class="timeline-panel">
    <p class="s-kicker">02 · Zeitachse</p>
    <h3 class="s-h">Fünfeinhalb Jahre, <em>drei Verschiebungen.</em></h3>
    <p class="s-lead">
      Von GPT-3 zum selbstverbessernden Agenten. Jede Schicht folgt einem
      Muster: empirischer Schmerzpunkt, Begriffsprägung, Industrie-Adoption.
    </p>

    <div class="timeline">
      <div
        v-for="(e, i) in events"
        :key="i"
        class="tl-event"
        :class="`tl-event--${e.tag}`"
      >
        <div class="tl-date">{{ e.date }}</div>
        <div class="tl-title">{{ e.title }}</div>
        <div class="tl-actor" :class="`tag-${e.tag}`">{{ e.actor }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-panel {
  width: 100%;
}
.timeline {
  position: relative;
  padding-left: 24px;
  border-left: 1px solid var(--s-line);
}
.tl-event {
  position: relative;
  padding: 8px 0 8px 22px;
  border-bottom: 1px solid var(--s-line);
}
.tl-event:last-child {
  border-bottom: none;
}
.tl-event::before {
  content: "";
  position: absolute;
  left: -28px;
  top: 18px;
  width: 14px;
  height: 1px;
  background: var(--s-line-strong);
}
.tl-event::after {
  content: "";
  position: absolute;
  left: -26px;
  top: 13px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--s-bg);
  border: 1px solid var(--s-fg-dim);
}
.tl-event--prompt::after {
  border-color: var(--s-prompt);
  box-shadow: 0 0 0 2.5px var(--s-prompt-soft);
}
.tl-event--context::after {
  border-color: var(--s-context);
  box-shadow: 0 0 0 2.5px var(--s-context-soft);
}
.tl-event--harness::after {
  border-color: var(--s-harness);
  box-shadow: 0 0 0 2.5px var(--s-harness-soft);
}
.tl-event--evolution::after {
  border-color: var(--s-evolution);
  box-shadow: 0 0 0 2.5px var(--s-evolution-soft);
}
.tl-date {
  font-family: var(--s-font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--s-fg-dim);
  text-transform: uppercase;
  margin-bottom: 2px;
}
.tl-title {
  font-family: var(--s-font-serif);
  font-size: 14px;
  color: var(--s-fg);
  line-height: 1.25;
  margin-bottom: 2px;
}
.tl-actor {
  font-family: var(--s-font-mono);
  font-size: 10px;
  color: var(--s-fg-muted);
}
.tag-prompt {
  color: var(--s-prompt);
}
.tag-context {
  color: var(--s-context);
}
.tag-harness {
  color: var(--s-harness);
}
.tag-evolution {
  color: var(--s-evolution);
}
</style>
