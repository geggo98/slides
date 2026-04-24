<script setup></script>

<template>
  <div class="disc-panel">
    <p class="s-kicker">03 · Die Disziplinen</p>
    <h3 class="s-h">Was jede Schicht <em>wirklich leistet.</em></h3>
    <p class="s-lead">
      <span class="mono accent-context">●●●</span> solide ·
      <span class="mono accent-prompt">●●○</span> Handwerks-Teilmenge ·
      <span class="mono accent-evolution">●○○</span> experimentell ·
      <span class="mono" style="color: var(--s-intent)">○○○</span> Marketing.
    </p>

    <div class="disciplines">
      <article class="disc-card disc-card--prompt">
        <div class="disc-head">
          <div class="disc-number">/01 · PROMPT</div>
          <div class="dots">
            <span class="dot on"></span><span class="dot on"></span
            ><span class="dot off"></span>
          </div>
        </div>
        <div class="disc-title">Prompt <em>Engineering</em></div>
        <div class="disc-subtitle">
          // Als Jobtitel tot — als Handwerk lebt es weiter
        </div>
        <div class="disc-body">
          <p>
            Arbeitet mit einem <em>diskreten String</em>. Klare Instruktionen,
            XML-Tags, Few-Shot-Kuration, strukturierte CoT, Response-Prefilling.
          </p>
          <p>
            Anthropic: Prompt Engineering ist nicht tot, sondern
            <strong style="color: var(--s-prompt)">echte Teilmenge</strong>
            von Context Engineering.
          </p>
        </div>
      </article>

      <article class="disc-card disc-card--context">
        <div class="disc-head">
          <div class="disc-number">/02 · CONTEXT</div>
          <div class="dots">
            <span class="dot on"></span><span class="dot on"></span
            ><span class="dot on"></span>
          </div>
        </div>
        <div class="disc-title">Context <em>Engineering</em></div>
        <div class="disc-subtitle">
          // Der einzige Begriff mit klarer Neuheit
        </div>
        <div class="disc-body">
          <p>
            Iterative Kuration aller Token pro Turn. Das Window ist endliche
            Ressource —
            <strong style="color: var(--s-context)">Context Rot</strong>
            ist empirisch messbar.
          </p>
          <p>
            Kernpraktiken: Compaction, Structured Note-Taking,
            Sub-Agent-Isolation · Write/Select/Compress/Isolate · Just-in-Time
            Retrieval.
          </p>
        </div>
      </article>

      <article class="disc-card disc-card--harness">
        <div class="disc-head">
          <div class="disc-number">/03 · HARNESS</div>
          <div class="dots">
            <span class="dot on"></span><span class="dot on"></span
            ><span class="dot on"></span>
          </div>
        </div>
        <div class="disc-title">Harness <em>Engineering</em></div>
        <div class="disc-subtitle">
          // Die jüngste, aber sauber motivierte Ebene
        </div>
        <div class="disc-body">
          <p>
            Modell = CPU · Context = RAM ·
            <strong style="color: var(--s-harness)">Harness = OS</strong> ·
            Agent = Applikation.
          </p>
          <p>
            LangChains <code>deepagents-cli</code>: Platz 30 → 5 auf Terminal
            Bench 2.0
            <strong style="color: var(--s-harness)">ohne Modellwechsel</strong>.
          </p>
        </div>
      </article>

      <article class="disc-card disc-card--intent">
        <div class="disc-head">
          <div class="disc-number" style="color: var(--s-intent)">
            /04 · INTENT <span class="disc-badge">Marketing</span>
          </div>
          <div class="dots">
            <span class="dot off"></span><span class="dot off"></span
            ><span class="dot off"></span>
          </div>
        </div>
        <div class="disc-title" style="color: var(--s-fg-muted)">
          Intent <em style="color: var(--s-intent)">Engineering</em>
        </div>
        <div class="disc-subtitle">// Kein eigenständiges Feld</div>
        <div class="disc-body">
          <p>
            Taucht auf bei Cloud-Vendors, in GitHub Spec-Kit-Kontext. Fehlt
            alles, was Context und Harness tragen: Abgrenzung, Community,
            empirische Evidenz.
          </p>
          <p>
            Substanziell sind die Nachbarn: <em>Spec-driven Development</em>,
            Requirements Engineering, Willisons Kritik am „vibe coding".
          </p>
        </div>
      </article>

      <article class="disc-card disc-card--evolution">
        <div class="disc-head">
          <div class="disc-number">
            /05 · EVOLUTION
            <span
              class="disc-badge"
              style="
                border-color: var(--s-evolution);
                color: var(--s-evolution);
              "
              >Potentieller Nächster Schritt</span
            >
          </div>
          <div class="dots">
            <span class="dot on"></span><span class="dot off"></span
            ><span class="dot off"></span>
          </div>
        </div>
        <div class="disc-title">Evolution <em>Engineering</em></div>
        <div class="disc-subtitle">
          // Wenn der Agent zum Harness-Engineer wird
        </div>
        <div class="disc-body evo-columns">
          <p>
            Sobald der Agent Teile seines Harness anpasst, wird er selbst zum
            Harness-Engineer — bei
            <span class="accent-evolution">Hermes</span> auf Skills- und
            Memory-Ebene, bei <span class="accent-evolution">DGM</span>
            auf Python-Code-Ebene.
          </p>
          <p>
            Dokumentierte Failure-Modes:
            <strong style="color: var(--s-evolution)">Reward Hacking</strong>,
            <strong style="color: var(--s-evolution)">Skill-Junk-Drawer</strong
            >, Goodhart-Effekte. Safety-Gates sind nur so gut wie die Metriken
            dahinter.
          </p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.disc-panel {
  width: 100%;
}

.disciplines {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--s-line);
  border: 1px solid var(--s-line);
}

.disc-card {
  background: var(--s-bg);
  padding: 10px 12px;
  position: relative;
}
.disc-card--prompt {
  color: var(--s-prompt);
}
.disc-card--context {
  color: var(--s-context);
}
.disc-card--harness {
  color: var(--s-harness);
}
.disc-card--intent {
  color: var(--s-intent);
  opacity: 0.85;
}
.disc-card--evolution {
  border: 1px dashed var(--s-evolution);
  grid-column: span 2;
  background: linear-gradient(180deg, var(--s-evolution-soft), transparent 60%);
  color: var(--s-evolution);
}

.disc-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  gap: 10px;
  flex-wrap: wrap;
}
.disc-number {
  font-family: var(--s-font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--s-fg-dim);
}
.disc-title {
  font-family: var(--s-font-serif);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.1;
  color: var(--s-fg);
  margin-bottom: 2px;
}
.disc-title em {
  font-style: italic;
  font-weight: 300;
  color: currentColor;
}
.disc-subtitle {
  font-family: var(--s-font-mono);
  font-size: 10px;
  color: var(--s-fg-muted);
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}
.disc-body {
  font-size: 11px;
  line-height: 1.5;
  color: var(--s-fg-muted);
}
.disc-body p {
  margin: 0 0 6px;
}
.disc-body p:last-child {
  margin-bottom: 0;
}
.disc-body em {
  font-style: italic;
  color: var(--s-fg);
}
.evo-columns {
  columns: 2;
  column-gap: 24px;
  column-rule: 1px dashed var(--s-line-strong);
}

.dots {
  display: flex;
  gap: 3px;
  align-items: center;
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.dot.on {
  background: currentColor;
}
.dot.off {
  background: transparent;
  border: 1px solid var(--s-fg-dim);
}

.disc-badge {
  display: inline-block;
  padding: 1px 6px;
  font-family: var(--s-font-mono);
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border: 1px solid currentColor;
  margin-left: 6px;
  vertical-align: 2px;
}

.mono {
  font-family: var(--s-font-mono);
  font-size: 0.9em;
}
</style>
