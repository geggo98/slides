<script setup></script>

<template>
  <div class="stack-panel">
    <p class="s-kicker">01 · Die Schichtung</p>
    <h3 class="s-h">
      Jede Schicht löst, <em>was die darunter nicht mehr greift.</em>
    </h3>

    <div class="stack-grid">
      <div class="stack-viz">
        <div class="layer layer--evolution">
          <span class="badge-experimental">Experimentell</span>
          <div class="layer-head">
            <div class="layer-title">Evolution Engineering</div>
            <div class="layer-scope">Das Meta-System</div>
          </div>
          <div class="layer-desc">
            Agent verändert sich selbst — Skills, Prompts, Memory, Loop-Code.
          </div>

          <div class="layer layer--harness">
            <div class="layer-head">
              <div class="layer-title">Harness Engineering</div>
              <div class="layer-scope">Das System</div>
            </div>
            <div class="layer-desc">
              Agent-Loop, Tools, Sandboxing, Middleware, HITL-Gates.
            </div>

            <div class="layer layer--context">
              <div class="layer-head">
                <div class="layer-title">Context Engineering</div>
                <div class="layer-scope">Das Fenster</div>
              </div>
              <div class="layer-desc">
                Kuration aller Token pro Turn — System-Prompt, Tools, Memory.
              </div>

              <div class="layer layer--prompt">
                <div class="layer-head">
                  <div class="layer-title">Prompt Engineering</div>
                  <div class="layer-scope">Der String</div>
                </div>
                <div class="layer-desc">
                  Input-Struktur: Few-Shot, CoT, XML-Tags, Prefill.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="stack-formula">
          <strong class="accent-prompt">Prompt</strong> ⊂
          <strong class="accent-context">Context</strong> ⊂
          <strong class="accent-harness">Harness</strong> ·
          <strong class="accent-evolution">Evolution</strong>
          <span style="color: var(--s-fg-dim)">umschließt (exp.)</span>
        </div>
      </div>

      <aside class="intent-sidebar">
        <div class="intent-title">Intent Engineering</div>
        <div class="intent-scope">⚠ Marketing · nicht in der Schichtung</div>
        <p>
          Vendor-Vokabel ohne eigenständige Methode. Meint praktisch
          <em>Spec-driven Development</em> oder Requirements Engineering — ohne
          empirische Evidenz oder kanonische Referenz.
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.stack-panel {
  width: 100%;
}
.stack-grid {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 20px;
  align-items: start;
}

.stack-viz {
  position: relative;
}

.layer {
  position: relative;
  border: 1px solid;
  padding: 8px 12px;
  background: var(--s-bg-card);
}
.layer--evolution {
  border-color: var(--s-evolution);
  border-style: dashed;
  background: linear-gradient(180deg, var(--s-evolution-soft), transparent);
  padding: 14px 14px 10px;
}
.layer--harness {
  border-color: var(--s-harness);
  background: var(--s-harness-soft);
  margin: 8px 18px 0;
}
.layer--context {
  border-color: var(--s-context);
  background: var(--s-context-soft);
  margin: 6px 18px 0;
}
.layer--prompt {
  border-color: var(--s-prompt);
  background: var(--s-prompt-soft);
  margin: 6px 18px 0;
}

.layer-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}
.layer-title {
  font-family: var(--s-font-serif);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--s-fg);
}
.layer--evolution .layer-title {
  color: var(--s-evolution);
}
.layer--harness .layer-title {
  color: var(--s-harness);
}
.layer--context .layer-title {
  color: var(--s-context);
}
.layer--prompt .layer-title {
  color: var(--s-prompt);
}

.layer-scope {
  font-family: var(--s-font-mono);
  font-size: 8px;
  letter-spacing: 0.14em;
  color: var(--s-fg-dim);
  text-transform: uppercase;
}
.layer-desc {
  color: var(--s-fg-muted);
  font-size: 10px;
  line-height: 1.4;
}

.badge-experimental {
  position: absolute;
  top: 5px;
  right: 8px;
  font-family: var(--s-font-mono);
  font-size: 7px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--s-evolution);
  background: var(--s-bg);
  padding: 1px 5px;
  border: 1px solid var(--s-evolution);
}

.stack-formula {
  text-align: center;
  margin-top: 12px;
  font-family: var(--s-font-mono);
  font-size: 10px;
  color: var(--s-fg-muted);
  letter-spacing: 0.06em;
}
.stack-formula strong {
  font-weight: 500;
}

.intent-sidebar {
  padding: 10px 12px;
  border: 1px dashed var(--s-line-strong);
  background: var(--s-bg-soft);
  opacity: 0.88;
}
.intent-title {
  font-family: var(--s-font-serif);
  font-size: 13px;
  color: var(--s-intent);
  font-style: italic;
  font-weight: 400;
  margin-bottom: 2px;
}
.intent-scope {
  font-family: var(--s-font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--s-fg-dim);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.intent-sidebar p {
  font-size: 10px;
  line-height: 1.45;
  color: var(--s-fg-muted);
  margin: 0;
}
.intent-sidebar em {
  font-style: italic;
  color: var(--s-fg);
}
</style>
