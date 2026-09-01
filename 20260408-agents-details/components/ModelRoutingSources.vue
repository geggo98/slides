<script setup lang="ts">
import BunPopover from "./BunPopover.vue";

// Gemeinsames ⓘ-Modal von DREI Folien: ModelRoutingRoles (Rollen),
// ModelRoutingPareto (Datenlage), ModelRoutingHistory (Historie).
//
// Regel für jeden Eintrag: er muss auf allen drei Folien stimmen. Kein „hier",
// kein „diese Folie". Fehlerbalken und der Kontingent-Schalter existieren nur im
// Pareto-Chart, das Fadenkreuz zusätzlich im Historien-Chart (dort opt-in über
// „alle Namen + Fadenkreuz") — wer sie erwähnt, benennt die Folie dazu.
// Folienspezifisches gehört in die jeweilige Host-Komponente, nicht hierher.
//
// Falls das je zu eng wird: ein `chart?: boolean` je Eintrag (Chart-Folien vs.
// Rollen-Folie), keine Drei-Wege-Fallunterscheidung — die würde 11 Einträge ×
// 3 Folien zu pflegen geben und bei jeder Folienverschiebung verrotten.
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
    note: "Pareto-Daten, Tokens, Steps (26.08.)",
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
    href: "https://deepseek.ai/pricing",
    label: "DeepSeek-Preise ab 16.08.2026",
    note: "Peak/Off-Peak statt Flat — V4 Pro und Flash je rund 4×",
  },
  {
    href: "https://x.com/ClaudeDevs/status/2093742322525810912",
    label: "Claude-Code-Wochenlimits, 29.08.2026",
    note: "+50 % bis 13.09., ab 14.09. dauerhaft +25 % über der Basis",
  },
  {
    href: "https://support.claude.com/en/articles/15910845-claude-code-may-august-2026-weekly-limits-promotion",
    label: "Claude-Code-Aktion (Support)",
    note: "stand am 01.09.2026 noch auf „bis 31.08.“ — als Beleg überholt",
  },
  {
    href: "https://www.tbench.ai/",
    label: "Terminal-Bench 2.1",
    note: "Terminal-/Tool-Arbeit — belegt die Rollen-Karten",
  },
  {
    href: "https://benchlm.ai/benchmarks/browseComp",
    label: "BrowseComp (BenchLM)",
    note: "Web-Recherche — belegt die Rollen-Karten",
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
    lead: "Anderer Harness, andere Zahlen:",
    text: "Der Harness verschiebt Scores um 10–30 Punkte. Zahlen aus mini-swe-agent gelten nicht für Claude Code oder Codex CLI. Anthropic-Modelle laufen im eigenen Harness meist besser.",
  },
  {
    lead: "113 Tasks, Streuung ±2–6 Punkte:",
    text: "Die Spanne zeigt, wie stark ein Modell zwischen Wiederholungsläufen schwankt — nicht den Stichprobenfehler über die 113 Tasks; der läge bei rund ±8 Punkten. Zwei Modelle mit weniger als 5 Punkten Abstand sind gleichauf. Belastbar ist nur die grobe Schichtung.",
  },
  {
    lead: "Höchste Effort-Stufe:",
    text: "Jedes Modell zählt mit seiner höchsten Effort-Stufe, nicht mit seinem besten Score — je nach Modell max, xhigh, high oder medium. Niedrigere Stufen sind billiger und meist schwächer; grok-4.6 liegt auf medium sogar höher als auf xhigh.",
  },
  {
    lead: "Quadranten:",
    text: "Die Trennlinien in den Charts bei 8 €/Task und 50 % Pass@1 haben wir selbst gewählt. Sie stecken nicht in den Daten.",
  },
  {
    lead: "Board-Default:",
    text: "Das Board zeigt per Default 19 von 26 Modellen; sieben ältere blendet es aus. Auf der Folie „Welches Modell wofür?“ ist gpt-5.6-terra wieder dabei — es ist bestellbar und läge auf der Front. Im Historien-Chart bleibt jedes je gemessene Modell stehen.",
  },
  {
    lead: "Kosten sind kein Messwert:",
    text: "Sie entstehen aus Tokens × Listenpreis. Datacurve hat sie mehrfach nachträglich korrigiert (Token-Zählfehler 13.08., Doppelrabatt 14.08., DeepSeek-Preiserhöhung 21.08.). Die Sol-Senkung vom 21.08. hatten wir zuerst selbst eingerechnet; das Board rechnet sie inzwischen auch — auf den Cent gleich. Ältere Datenstände zeigen den damals veröffentlichten Wert; zwei davon sind rekonstruiert und im Chart markiert.",
  },
  {
    lead: "DeepSWE v1 war kontaminiert:",
    text: "In der ersten Runde lief die Verifikation im selben Container wie der Agent, und das Repo kam mit voller Git-Historie. Wer die Lösung las statt sie zu erarbeiten, holte sich Punkte, die er ohne sie vielleicht nicht bekommen hätte — und brauchte dafür kaum Tokens. Scores zu hoch, Kosten zu niedrig, beides nicht mit v1.1 vergleichbar. Im Historien-Chart ist das die erste Station.",
  },
  {
    lead: "Abo ist kein API-Preis:",
    text: "Der Abo-Preis ist fix, begrenzt wird die Arbeit über das Wochenlimit. Bis 13.09.2026 gibt Claude Code 50 % mehr Kontingent pro Woche, die Kosten pro Task sinken damit auf zwei Drittel; ab 14.09. ersetzt Anthropic die Aktion durch dauerhafte 25 % über der Basis, also vier Fünftel. Eine Rückkehr auf das Basislimit gibt es nicht. Das ist eine Kontingentrechnung, kein Listenpreis. Nur die Folie „Welches Modell wofür?“ kann sie zuschalten, normal ist sie aus; der Geisterring zeigt dort den Stand ab 14.09.",
  },
  {
    lead: "Peak-Raten und Aktionspreise:",
    text: "Zwei Punkte am billigen Ende stehen auf Preisen, die so nicht dauerhaft gelten. DeepSeek rechnet seit dem 16.08. nach Haupt- und Nebenzeit ab; das Board nimmt die Hauptzeit, off-peak ist die Hälfte — V4 Pro läge dann bei 0,73 € und wäre immer noch dominiert. Und glm-5.3-flash läuft auf einem befristeten 50-%-Aktionspreis; ohne ihn verdoppelt sich der Punkt auf rund 0,42 €.",
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
    text: "Optimierst Du API-Kosten oder das Kontingent eines Abos? Je nach Ziel sieht das beste Routing anders aus.",
  },
  {
    lead: "Verfallsdatum:",
    text: "Stand 26.08.2026 — und schon in sich veraltet: die Front hat sich seit Juni siebenmal verschoben, dreimal allein durch Preisanpassungen. Dieser Stand korrigiert obendrein den vorigen, der beim letzten Mal aktuell aussah. Nimm die Board-Zahlen als Startpunkt, nicht als Antwort. Wie die Modelle auf Deinen Aufgaben abschneiden, zeigen nur eigene Evals.",
  },
];
</script>

<template>
  <BunPopover :open="open" wide @close="emit('close')">
    <div class="bun-pop-h">Quellen &amp; Einschränkungen</div>
    <!-- Der Geltungsbereich muss dastehen: dasselbe Modal hängt an drei Folien,
         und einzelne Einträge benennen die Folie, für die sie gelten. -->
    <div class="mrs-scope">
      Gilt für alle drei Modell-Routing-Folien: Rollen, Datenlage, Historie.
    </div>
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
.mrs-scope {
  margin: -2px 0 10px;
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}
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
