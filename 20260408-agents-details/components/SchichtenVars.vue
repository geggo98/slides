<script setup>
// Shared CSS variables provider for the Engineering-Schichten infographic.
// Wrap panel content in this component to get theme-aware tokens.
</script>

<template>
  <div class="schichten-vars">
    <slot />
  </div>
</template>

<style>
.schichten-vars {
  /* Accent colors — gleicher Farbton wie im Dark-Mode, aber abgedunkelt:
     die hellen Töne erreichen auf dem warmen Off-White nur ~1.6–2.1:1
     Kontrast. Diese Varianten liegen bei ≥4.5:1 (Text & Borders). */
  --s-prompt: #9c620d;
  --s-context: #22776b;
  --s-harness: #b12547;
  --s-evolution: #577a1a;
  --s-intent: #6b6459;

  --s-prompt-soft: rgba(232, 162, 59, 0.12);
  --s-context-soft: rgba(95, 199, 184, 0.12);
  --s-harness-soft: rgba(232, 90, 124, 0.12);
  --s-evolution-soft: rgba(168, 213, 90, 0.14);
  --s-intent-soft: rgba(122, 115, 106, 0.1);

  /* Neutrals — light mode: warm off-white palette */
  --s-bg: #faf7f2;
  --s-bg-soft: #f3ede3;
  --s-bg-card: #ffffff;
  --s-bg-deep: #ece4d6;
  --s-fg: #2a241e;
  --s-fg-muted: #5a5148;
  --s-fg-dim: #8a7f72;
  --s-line: #e0d7c7;
  --s-line-strong: #c9bfae;

  --s-font-serif: var(--slidev-font-serif, "Georgia", serif);
  --s-font-body: var(--slidev-font-sans, system-ui, sans-serif);
  --s-font-mono:
    ui-monospace, "Cascadia Code", "JetBrains Mono", "Fira Code", monospace;
}

.dark .schichten-vars {
  /* Auf dunklem Grund haben die hellen Original-Akzente genug Kontrast. */
  --s-prompt: #e8a23b;
  --s-context: #5fc7b8;
  --s-harness: #e85a7c;
  --s-evolution: #a8d55a;
  --s-intent: #7a736a;

  --s-prompt-soft: rgba(232, 162, 59, 0.08);
  --s-context-soft: rgba(95, 199, 184, 0.08);
  --s-harness-soft: rgba(232, 90, 124, 0.08);
  --s-evolution-soft: rgba(168, 213, 90, 0.1);
  --s-intent-soft: rgba(122, 115, 106, 0.08);

  --s-bg: #14110e;
  --s-bg-soft: #1c1813;
  --s-bg-card: #1f1a14;
  --s-bg-deep: #0b0907;
  --s-fg: #f0e8dc;
  --s-fg-muted: #9a9086;
  --s-fg-dim: #6b6358;
  --s-line: #2a2520;
  --s-line-strong: #3a342d;
}

/* Shared primitives — used by all panels */
.schichten-vars .s-kicker {
  font-family: var(--s-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--s-fg-dim);
  margin-bottom: 8px;
}
.schichten-vars .s-h {
  font-family: var(--s-font-serif);
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: var(--s-fg);
  margin: 0 0 8px;
}
.schichten-vars .s-h em {
  font-style: italic;
  font-weight: 300;
  color: var(--s-fg-muted);
}
.schichten-vars .s-lead {
  font-size: 13px;
  line-height: 1.5;
  color: var(--s-fg-muted);
  margin: 0 0 14px;
}
.schichten-vars .s-lead em {
  font-style: italic;
  color: var(--s-fg);
}
.schichten-vars code {
  font-family: var(--s-font-mono);
  font-size: 0.88em;
  background: var(--s-bg-soft);
  padding: 1px 5px;
  border: 1px solid var(--s-line);
  color: var(--s-fg);
  border-radius: 3px;
}
.schichten-vars .accent-prompt {
  color: var(--s-prompt);
}
.schichten-vars .accent-context {
  color: var(--s-context);
}
.schichten-vars .accent-harness {
  color: var(--s-harness);
}
.schichten-vars .accent-evolution {
  color: var(--s-evolution);
}
.schichten-vars .accent-intent {
  color: var(--s-intent);
}
</style>
