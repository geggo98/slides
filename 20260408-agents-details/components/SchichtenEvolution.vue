<script setup>
const rows = [
  {
    system: "AutoGPT",
    year: "April 2023",
    mod: "Plan, Memory",
    mech: "GPT-4-Loop · Vector-DB",
    gate: { label: "Keines", cls: "none" },
    status: "Gescheitert · infinite loops, halluzinierte Capabilities",
  },
  {
    system: "Voyager",
    year: "Mai 2023 · NVIDIA",
    mod: "Skills-Library (JS)",
    mech: "Auto-Curriculum · Self-Verification-Critic",
    gate: { label: "Minecraft", cls: "sandbox" },
    status: "Konzeptueller Großvater von Hermes",
  },
  {
    system: "Letta / MemGPT",
    year: "Oktober 2023",
    mod: "Eigener Memory-State",
    mech: "Self-editing via memory_replace",
    gate: { label: "Tool-API fix", cls: "sandbox" },
    status: "Nächster Verwandter von Hermes · file-based memory",
  },
  {
    system: "Gödel Agent",
    year: "Oktober 2024",
    mod: "Python-Code (Monkey-Patching)",
    mech: "LLM-Reflection · echte Selbst-Referenz",
    gate: { label: "Minimal", cls: "none" },
    status: "Akademisch · Proof-of-Concept",
  },
  {
    system: "Darwin Gödel Machine",
    year: "Mai 2025 · Sakana",
    mod: "Agent-Code",
    mech: "Evolutionäres Archiv · SWE-bench als Fitness",
    gate: { label: "Sandbox + Web-Limits", cls: "sandbox" },
    status: "SWE-bench 20→50% · Goodhart-Fälle dokumentiert",
  },
  {
    system: "DSPy + GEPA",
    year: "2024–2025 · Stanford/MIT",
    mod: "Prompts, Few-Shots, Weights",
    mech: "Compiler: MIPROv2, GEPA, SIMBA",
    gate: { label: "Offline · testbasiert", cls: "offline" },
    status: "GEPA: ICLR-2026-Oral",
  },
  {
    system: "AlphaEvolve",
    year: "Mai 2025 · DeepMind",
    mod: "Ziel-Algorithmen (nicht Agent selbst)",
    mech: "Gemini-Ensemble · MAP-Elites · Evaluators",
    gate: { label: "Offline · Benchmark", cls: "offline" },
    status: "Borg +0,7% · Matrix-Mul 4×4 in 48 muls",
  },
  {
    system: "Hermes Agent",
    year: "Februar 2026 · Nous Research",
    mod: "Skills, Memory-Files · Prompts/Tools (Schwester-Repo)",
    mech: "skill_manage · FTS5 · Honcho · DSPy+GEPA",
    gate: { label: "PR-Gate + Sandbox", cls: "pr" },
    status: "Pragmatisches Self-Improvement-Light · Produktionstauglich",
    highlight: true,
  },
];
</script>

<template>
  <div class="evo-panel">
    <p class="s-kicker">04 · Evolution im Detail</p>
    <h3 class="s-h">Sieben Systeme, <em>zwei Achsen.</em></h3>
    <p class="s-lead">
      <em>Was wird modifiziert?</em> (Prompts → Memory → Skills → Code) und
      <em>wie streng ist das Gate?</em> (none → sandbox → PR → offline).
    </p>

    <div class="evo-scroll">
      <table class="evo-table">
        <thead>
          <tr>
            <th>System</th>
            <th>Modifiziert</th>
            <th>Mechanismus</th>
            <th>Safety-Gate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in rows"
            :key="i"
            :class="{ highlight: r.highlight }"
          >
            <td>
              <div class="sys" :class="{ 'accent-evolution': r.highlight }">
                {{ r.system }}
              </div>
              <div class="year">{{ r.year }}</div>
            </td>
            <td>{{ r.mod }}</td>
            <td
              v-html="
                r.mech.replace(
                  /skill_manage|memory_replace/g,
                  '<code>$&</code>',
                )
              "
            ></td>
            <td>
              <span class="gate" :class="`gate--${r.gate.cls}`">{{
                r.gate.label
              }}</span>
            </td>
            <td>
              <strong v-if="r.highlight" class="accent-evolution">{{
                r.status
              }}</strong>
              <template v-else>{{ r.status }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary">
      <div class="summary-label">// HERMES · ZUSAMMENGEFASST</div>
      <p>
        Der Agent schreibt sich
        <strong class="accent-evolution">Markdown-Prozeduren</strong>, nicht
        seinen Python-Code. Skills entstehen nach komplexen Tasks (typisch ≥5
        Tool-Calls), landen in <code>~/.hermes/skills/</code>, werden bei
        erneuter Nutzung verfeinert. Radikale Code-Modifikation durchläuft
        PR-Gate plus menschliches Review.
      </p>
    </div>
  </div>
</template>

<style scoped>
.evo-panel {
  width: 100%;
}
.evo-scroll {
  overflow-x: auto;
  border: 1px solid var(--s-line);
}
.evo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  min-width: 640px;
}
.evo-table thead {
  background: var(--s-bg-soft);
}
.evo-table th {
  text-align: left;
  padding: 8px 10px;
  font-family: var(--s-font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--s-fg-dim);
  text-transform: uppercase;
  font-weight: 500;
  border-bottom: 1px solid var(--s-line-strong);
}
.evo-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--s-line);
  vertical-align: top;
  color: var(--s-fg-muted);
  font-size: 11px;
  line-height: 1.4;
}
.evo-table tr:last-child td {
  border-bottom: none;
}
.evo-table tr.highlight {
  background: var(--s-evolution-soft);
}
.evo-table tr.highlight td:first-child {
  border-left: 2px solid var(--s-evolution);
}

.sys {
  font-family: var(--s-font-serif);
  font-size: 13px;
  font-weight: 500;
  color: var(--s-fg);
  line-height: 1.15;
}
.year {
  font-family: var(--s-font-mono);
  font-size: 9px;
  color: var(--s-fg-dim);
  letter-spacing: 0.06em;
}

.gate {
  font-family: var(--s-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 6px;
  display: inline-block;
  border: 1px solid;
  white-space: nowrap;
}
.gate--none {
  color: var(--s-harness);
  border-color: var(--s-harness);
}
.gate--sandbox {
  color: var(--s-prompt);
  border-color: var(--s-prompt);
}
.gate--pr {
  color: var(--s-context);
  border-color: var(--s-context);
}
.gate--offline {
  color: var(--s-evolution);
  border-color: var(--s-evolution);
}

.summary {
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid var(--s-line);
  background: var(--s-bg-soft);
}
.summary-label {
  font-family: var(--s-font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--s-evolution);
  margin-bottom: 6px;
}
.summary p {
  color: var(--s-fg);
  font-size: 11px;
  line-height: 1.5;
  margin: 0;
}
</style>
