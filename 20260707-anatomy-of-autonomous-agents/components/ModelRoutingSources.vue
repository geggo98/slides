<script setup lang="ts">
import BunPopover from "./BunPopover.vue";

// Gemeinsames (i)-Modal der beiden Modell-Routing-Folien: Quellen und
// Einschränkungen aus der vorbereiteten Infografik (Wortlaut übernommen).
defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const sources = [
  {
    href: "https://quesma.com/blog/custom-deep-research-pipeline/",
    label: "Quesma: deep-research-pipeline",
    note: "Orchestrierungsmuster, run-cli",
  },
  {
    href: "https://deepswe.datacurve.ai/",
    label: "DeepSWE v1.1",
    note: "Pareto-Daten, Kosten, Tokens, Steps",
  },
  {
    href: "https://www.tbench.ai/",
    label: "Terminal-Bench 2.1",
    note: "Terminal-/Tool-Arbeit",
  },
  {
    href: "https://benchlm.ai/benchmarks/browseComp",
    label: "BrowseComp (BenchLM)",
    note: "Web-Recherche",
  },
  {
    href: "https://scale.com/leaderboard/swe_bench_pro_public",
    label: "SWE-bench Pro (Scale)",
    note: "kontaminationsresistent, n=1.865",
  },
  {
    href: "https://arxiv.org/abs/2510.11977",
    label: "HAL (arXiv)",
    note: "Multi-Scaffold-Methodik",
  },
  {
    href: "https://artificialanalysis.ai/",
    label: "Artificial Analysis",
    note: "Preise × Leistung, breit",
  },
];

const caveats = [
  {
    lead: "Harness-Transfer:",
    text: "Scaffold-Wahl verschiebt Scores um 10–30 Punkte. mini-swe-agent-Zahlen ≠ Claude Code / Codex CLI. Anthropic-Modelle laufen im eigenen Harness typischerweise besser.",
  },
  {
    lead: "n = 113, CIs ±2–6 pt:",
    text: "Rangfolgen innerhalb von ~5 Punkten sind Rauschen. Nur die grobe Schichtung ist belastbar.",
  },
  {
    lead: "Effort [max]:",
    text: "Punkte zeigen das beste Effort-Level je Modell; niedrigere Level liegen anders (billiger, schwächer).",
  },
  {
    lead: "Interessenkonflikte:",
    text: "Datacurve und Scale sind kommerzielle Anbieter mit eigenen Agenden. Daten offen, unabhängige Reproduktion steht aus.",
  },
  {
    lead: "Kein Planungs-Benchmark:",
    text: "„Planen/Judge“ ist nicht isoliert messbar — Zuordnung ist Proxy-Schluss aus End-to-End-Ergebnissen.",
  },
  {
    lead: "Zielfunktion:",
    text: "API-Kosten ≠ Quota-Arbitrage über Abos. Optimales Routing unterscheidet sich je nach Ziel.",
  },
  {
    lead: "Verfallsdatum:",
    text: "Stand Juli 2026. Benchmarks + Preise ändern sich monatlich — als Prior nutzen, eigene Evals bauen.",
  },
];
</script>

<template>
  <BunPopover :open="open" wide @close="emit('close')">
    <div class="bun-pop-h">Quellen &amp; Einschränkungen</div>
    <div class="mrs-grid">
      <div>
        <div class="mrs-col-h">Quellen</div>
        <ul class="mrs-list">
          <li v-for="s in sources" :key="s.href">
            <a :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
            <span class="mrs-note"> — {{ s.note }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="mrs-col-h">Einschränkungen</div>
        <ul class="mrs-list">
          <li v-for="c in caveats" :key="c.lead">
            <strong>{{ c.lead }}</strong> {{ c.text }}
          </li>
        </ul>
      </div>
    </div>
  </BunPopover>
</template>

<style scoped>
.mrs-grid {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 22px;
}
.mrs-col-h {
  margin-bottom: 6px;
  padding-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.mrs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  list-style: none;
}
.mrs-list li {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-primary);
}
.mrs-list a {
  color: var(--slidev-theme-primary);
  text-decoration: none;
}
.mrs-list a:hover {
  text-decoration: underline;
}
.mrs-note {
  color: var(--color-text-tertiary);
  font-size: 10.5px;
}
</style>
