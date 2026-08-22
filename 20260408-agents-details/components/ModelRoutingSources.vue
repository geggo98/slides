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
    note: "Pareto-Daten, Tokens, Steps (20.08.)",
  },
  {
    href: "https://deepswe.datacurve.ai/changelog",
    label: "DeepSWE-Changelog",
    note: "Neuzugänge und Preiskorrekturen je Datum",
  },
  {
    href: "https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/",
    label: "OpenAI-Preise, 30.07.2026",
    note: "Luna −80 %, Terra −20 %",
  },
  {
    href: "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
    label: "OpenAI-Preise, 21.08.2026",
    note: "Sol $5/$30 → $4/$20, befristet bis 21.11.",
  },
  {
    href: "https://support.claude.com/en/articles/15910845-claude-code-may-august-2026-weekly-limits-promotion",
    label: "Claude-Code-Wochenlimits",
    note: "+50 % vom 13.05. bis 31.08.2026",
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
    lead: "Quadranten:",
    text: "Die Trennlinien bei 8 €/Task und 50 % Pass@1 sind redaktionell gesetzt, nicht aus den Daten abgeleitet.",
  },
  {
    lead: "Board-Default:",
    text: "Das Leaderboard zeigt 18 von 25 Modellen; sieben ältere sind ausgeblendet. gpt-5.6-terra ist hier wieder eingeblendet — es ist bestellbar und läge auf der Front. Die Historien-Folie zeigt alle je gemessenen Modelle.",
  },
  {
    lead: "Kosten sind kein Messwert:",
    text: "Sie entstehen aus Tokens × Listenpreis. Datacurve hat sie mehrfach nachträglich korrigiert (Token-Zählfehler 13.08., Doppelrabatt 14.08.), die Sol-Senkung vom 21.08. rechnen wir selbst ein. Historische Stände zeigen den damals veröffentlichten Wert.",
  },
  {
    lead: "Abo ≠ API:",
    text: "Das Claude-Code-Overlay ist eine Kontingentrechnung, kein Preis: Abo-Preis fix, Wochenlimit bindend ⇒ €/Task ∝ 1/Kontingent ⇒ ×2/3 bis 31.08.2026. Deshalb per Schalter, Default aus.",
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
    text: "Stand 21.08.2026 — und schon in sich veraltet: die Front hat sich seit Juni sechsmal verschoben, zweimal ohne ein einziges neues Modell. Als Prior nutzen, eigene Evals bauen.",
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
