<script setup>
const cells = [
  {
    cls: "bleibt",
    accent: "context",
    stamp: "Bleibt",
    title: "Context Engineering",
    body: "Benennt präzise eine Systemebene, die Prompt Engineering strukturell nicht erreicht. Industrie-Adoption (Anthropic, LangChain, Shopify), empirische Grundlage (Context Rot), klare Abgrenzung.",
  },
  {
    cls: "etabliert",
    accent: "harness",
    stamp: "Etabliert sich",
    title: "Harness Engineering",
    body: "Benennt, was Cursor, Claude Code und SWE-agent tatsächlich tun — Systems Engineering ums Modell. Jung, aber fundiert. Mit stärkeren Modellen wird Harness dünner, nicht null.",
  },
  {
    cls: "offen",
    accent: "evolution",
    stamp: "Offen · Potentiell",
    title: "Evolution Engineering",
    body: "Ernst zu nehmende Richtung, aber noch kein etabliertes Feld. Hermes zeigt den konservativen Weg (Markdown-Skills, PR-Gate), DGM und AlphaEvolve den ambitionierten. Für Produktion: Harness mit Disziplin vor Self-Evolution mit Hoffnung.",
  },
  {
    cls: "marketing",
    accent: "intent",
    stamp: "Marketing",
    title: "Intent Engineering",
    body: "Wird als Vendor-Vokabel überleben, ohne eigenständig zu werden. Wer es nutzt, meint meistens Spec-driven Development oder Requirements Engineering — dann sollte man das auch so nennen.",
  },
];
</script>

<template>
  <div class="verdict-panel">
    <p class="s-kicker">05 · Fazit</p>
    <h3 class="s-h">Was bleibt, <em>was fällt.</em></h3>
    <p class="s-lead">
      Das idiomatische Denken: Probleme der richtigen Schicht zuordnen.
      Tool-Fehlauswahl ist selten ein Prompt-Problem, häufiger Context, manchmal
      Harness.
    </p>

    <div class="verdict-grid">
      <div
        v-for="c in cells"
        :key="c.title"
        class="cell"
        :class="[`cell--${c.cls}`, `cell-accent-${c.accent}`]"
      >
        <div class="stamp">{{ c.stamp }}</div>
        <div class="title">{{ c.title }}</div>
        <p>{{ c.body }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verdict-panel {
  width: 100%;
}
.verdict-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--s-line);
  border: 1px solid var(--s-line);
}
.cell {
  background: var(--s-bg);
  padding: 14px 16px;
  border-top: 2px solid;
}
.cell-accent-context {
  border-top-color: var(--s-context);
}
.cell-accent-harness {
  border-top-color: var(--s-harness);
}
.cell-accent-evolution {
  border-top-color: var(--s-evolution);
}
.cell-accent-intent {
  border-top-color: var(--s-intent);
  opacity: 0.85;
}

.stamp {
  font-family: var(--s-font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--s-fg-dim);
  margin-bottom: 8px;
}
.cell-accent-context .stamp {
  color: var(--s-context);
}
.cell-accent-harness .stamp {
  color: var(--s-harness);
}
.cell-accent-evolution .stamp {
  color: var(--s-evolution);
}
.cell-accent-intent .stamp {
  color: var(--s-intent);
}

.title {
  font-family: var(--s-font-serif);
  font-size: 16px;
  font-weight: 500;
  color: var(--s-fg);
  font-style: italic;
  line-height: 1.15;
  margin-bottom: 6px;
}
.cell p {
  font-size: 11px;
  line-height: 1.5;
  color: var(--s-fg-muted);
  margin: 0;
}
</style>
