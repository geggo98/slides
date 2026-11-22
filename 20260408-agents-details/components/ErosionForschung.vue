<script setup lang="ts">
// Folie „Strukturelle Erosion: Stand der Forschung“ (pages/erosion-forschung.md).
// Drei Blöcke: Tabelle der belegten Befunde, zwei Karten (Gegenbelege, nicht
// belegt), Callout als Brücke zur Folgefolie über Doku und Regeln.
//
// Jede Zahl stammt aus dem Faktencheck vom 22.11.2026 einer eingefügten
// Kurzrecherche. Der Faktencheck hat jede Zahl an der Primärquelle
// nachgelesen (arXiv-Abstract oder HTML-Fassung, Seiten von OpenAI und METR).
// Auf der Folie stehen nur Aussagen, die er als bestätigt führt. Die
// Einschränkungen im ⓘ-Modal gehören zu den Zahlen: ohne sie liest sich die
// Tabelle allgemeiner, als die Arbeiten es hergeben.
//
// Aufbau und Maße folgen `ContextRotForschung.vue` (gleiches Overflow-Budget).
import { ref } from "vue";
import Callout from "@shared/components/Callout.vue";
import SourcesPopover from "./SourcesPopover.vue";
import { useDeckPalette } from "./palette";

const P = useDeckPalette();
const sourcesOpen = ref(false);

interface Row {
  topic: string;
  value: string;
  finding: string;
  ref: string;
  /** Zeile ohne tragende Zahl: Wert gedimmt statt in Akzentfarbe. */
  muted?: boolean;
}

const rows: Row[] = [
  {
    topic: "Erosion wächst",
    value: "77 %",
    finding: "der Agenten-Trajektorien; bei Menschen 53 % der Repositories",
    ref: "SlopCodeBench, 2603.24755",
  },
  {
    topic: "Langstrecke",
    value: "0 von 36",
    finding: "Aufgaben löst ein Agent über alle 196 Checkpoints",
    ref: "SlopCodeBench, 2603.24755",
  },
  {
    topic: "Bessere Prompts",
    value: "ohne Zahl",
    finding: "senken den Startwert der Erosion, nicht die Verfallsrate",
    ref: "SlopCodeBench, 2603.24755",
    muted: true,
  },
  {
    topic: "Folgeaufgaben",
    value: "−13,1 Pp.",
    finding: "Lösungsrate auf Agenten- statt Menschencode, im Maximum",
    ref: "CodeThread, 2606.21804",
  },
  {
    topic: "Tests grün",
    value: "64 von 483",
    finding: "Ergebnissen (13,3 %) verletzen trotzdem die Strukturvorgabe",
    ref: "Needle in the Repo, 2603.27745",
  },
  {
    topic: "Duplikate",
    value: "50,8 %",
    finding: "der Aufgabenketten bis Runde 5, Bestehensrate fast gleich",
    ref: "RepoReuse, 2609.35357",
  },
];

const sources = [
  {
    href: "https://arxiv.org/abs/2603.24755",
    label: "SlopCodeBench (arXiv 2603.24755)",
    note: "v2 vom 07.05.2026, Preprint; 36 Aufgaben, 196 Checkpoints, 15 Agenten",
  },
  {
    href: "https://arxiv.org/abs/2606.21804",
    label: "CodeThread (arXiv 2606.21804)",
    note: "v2 vom 29.09.2026; Folgeaufgaben auf Agenten- und Menschencode, Table 2",
  },
  {
    href: "https://arxiv.org/abs/2610.14768",
    label: "arXiv 2610.14768",
    note: "10.10.2026; 50 Repositories, 1 996 Paare; Einschränkung zu CodeThread",
  },
  {
    href: "https://arxiv.org/abs/2603.27745",
    label: "Needle in the Repo (arXiv 2603.27745)",
    note: "29.03.2026; 23 Konfigurationen, gezielt konstruierte Proben",
  },
  {
    href: "https://arxiv.org/abs/2609.35357",
    label: "RepoReuse (arXiv 2609.35357)",
    note: "28.09.2026; doppelte Logik in Aufgabenketten über fünf Runden",
  },
  {
    href: "https://arxiv.org/abs/2609.17598",
    label: "Not All Agents Are Equal (arXiv 2609.17598)",
    note: "12.09.2026; 37 623 Pull Requests, Daten 12/2024 bis 07/2025",
  },
  {
    href: "https://arxiv.org/abs/2610.30571",
    label: "Stale Instruction Files (arXiv 2610.30571)",
    note: "22.10.2026; 40 synthetische Python-Projekte, 320 Läufe",
  },
  {
    href: "https://openai.com/index/harness-engineering/",
    label: "OpenAI: Harness Engineering",
    note: "11.02.2026; Erfahrungsbericht eines Teams, keine kontrollierte Studie",
  },
  {
    href: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/",
    label: "METR: Entwicklerstudie (arXiv 2507.09089)",
    note: "10.07.2025; misst Produktivität, nicht Wartbarkeit",
  },
  {
    href: "https://metr.org/blog/2026-02-24-uplift-update/",
    label: "METR: Update",
    note: "24.02.2026; beide Konfidenzintervalle schließen 0 ein",
  },
];

const caveats = [
  {
    lead: "SlopCodeBench, Vergleichsbasis:",
    text: "473 offene Python-Repositories mit je bis zu 30 Commits. Gegen sie ist Agentencode 2,3-mal redundanter und 2,0-mal stärker erodiert. Die Erosion steigt auch bei Menschen, in 103 von 196 Repositories (ca. 53 %).",
  },
  {
    lead: "SlopCodeBench, 0 von 36:",
    text: "Gemessen ist die strenge Lösungsrate, die beste Konfiguration erreicht 14,8 % der Checkpoints. Die Kernfunktion gelingt öfter, die beste Rate dort ist 67,3 %.",
  },
  {
    lead: "Bessere Prompts:",
    text: "Abstract und Haupttext der Arbeit nennen verschiedene Größen für den Startwert, deshalb steht keine Zahl auf der Folie. Die Prompts kosten 12,1 % mehr pro Checkpoint, und die strenge Lösungsrate sinkt um 2,4 bis 3,6 Prozentpunkte.",
  },
  {
    lead: "CodeThread, −13,1 Prozentpunkte:",
    text: "Das Maximum stammt vom offenen Modell GLM 4.7 auf SWE-Bench Pro: 45,2 % auf menschlichem, 32,0 % auf Agentencode. In 4 von 16 Paaren aus Modell und Benchmark (25 %) ist der Agenten-Vorgänger gleich gut oder besser. Jeder Lauf einmal.",
  },
  {
    lead: "CodeThread, Ursache:",
    text: "Klassische Wartbarkeitsmetriken erklären den Unterschied nicht. Die klarsten Signale sind Änderungen an Eingabeprüfung und Fehlerbehandlung. Diese Kategorien vergibt ein LLM-Richter, 50 Labels sind von Hand geprüft.",
  },
  {
    lead: "Needle in the Repo:",
    text: "Die Fälle sind gezielt konstruiert, eine Abkürzung ist absichtlich möglich. Die 13,3 % sind deshalb keine Rate für realen Code.",
  },
  {
    lead: "Rücknahmen von Pull Requests:",
    text: "Beobachtungsstudie, die Agenten wurden den Aufgaben nicht zufällig zugeteilt. Die Daten enden im Juli 2025 und zeigen ältere Agentenversionen. Die übrigen drei Agenten unterscheiden sich nicht signifikant von Menschen.",
  },
  {
    lead: "Veraltete Instruktionsdateien:",
    text: "Die 40 Projekte sind konstruiert, ein Vergleich ohne Datei fehlt. Die Autoren haben die veralteten Dateien konstruiert, nicht der Agent geschrieben. Ein Satz Vorrangregel hebt die Code-Treue von 4,2 % auf 91,4 %.",
  },
  {
    lead: "METR:",
    text: "2025 brauchten 16 erfahrene Entwickler mit KI-Werkzeugen 19 % länger. Das Update von 2026 deutet auf eine Beschleunigung, METR nennt die eigenen Daten dafür einen sehr schwachen Beleg. Beide Arbeiten messen Produktivität und belegen keine Erosion.",
  },
  {
    lead: "Modelle der Arbeiten:",
    text: "Die Arbeiten zur Erosion stammen von 2026, ihre Modelle reichen von GPT-5 und Claude 4.5 Sonnet bis GPT-6 Sol und Claude Sonnet 5.5. Die Benchmarks messen Ketten von Aufgaben und Checkpoints. Wie sich die Architektur einer vollständig von Agenten erzeugten Codebasis über Jahre entwickelt, nennt der Erfahrungsbericht von OpenAI ausdrücklich offen.",
  },
];
</script>

<template>
  <div class="erf">
    <p class="erf-lead">
      Agenten lösen einzelne Aufgaben und verschlechtern zugleich die
      Voraussetzungen für spätere. Agentencode ist <b>2,3-mal</b> redundanter
      und <b>2,0-mal</b> stärker erodiert als 473 Python-Repositories
      (SlopCodeBench).
    </p>

    <table class="erf-table">
      <thead>
        <tr>
          <th>Gut belegt</th>
          <th>Zahl</th>
          <th>Befund</th>
          <th>Beleg (arXiv)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.topic">
          <td class="erf-topic">{{ r.topic }}</td>
          <td class="erf-value" :class="{ muted: r.muted }">{{ r.value }}</td>
          <td>{{ r.finding }}</td>
          <td class="erf-ref">{{ r.ref }}</td>
        </tr>
      </tbody>
    </table>

    <div class="erf-cards">
      <div class="erf-card erf-card-ok">
        <div class="erf-card-h">Gegenbelege</div>
        <ul>
          <li>
            Der Nachteil bei Folgeaufgaben verschwindet, wenn der geerbte Code
            die früheren Tests besteht: <b>+2,7</b> Punkte (arXiv 2610.14768)
          </li>
          <li>
            Zurückgesetzte PRs: Codex <b>6,1 %</b>, Menschen <b>11,5 %</b>,
            Devin <b>14,5 %</b> (arXiv 2609.17598, Daten bis 07/2025)
          </li>
        </ul>
      </div>
      <div class="erf-card">
        <div class="erf-card-h">Nicht belegt</div>
        <ul>
          <li>
            „Jede autonome Codebasis degeneriert zwangsläufig“: gemessen sind
            Aufgabenketten, keine Jahre
          </li>
          <li>
            „Der Agent glaubt später seine eigene falsche Doku“: plausibel,
            nicht gemessen
          </li>
          <li>METR, 19 % langsamer: misst Produktivität, nicht Wartbarkeit</li>
        </ul>
      </div>
    </div>

    <Callout tone="warning" dense class="erf-callout">
      <b>Grüne Tests ersetzen keine Wartbarkeit.</b> Auch Doku und Regeln
      veralten: Bei veralteten Instruktionsdateien folgen <b>90,1 %</b> der
      Entscheidungen der Datei und nicht dem Code (arXiv 2610.30571,
      konstruierte Projekte). Nächste Folie: Ein Modell schreibt die Regeln
      selbst um.
    </Callout>

    <div class="erf-foot">
      <span>Recherche-Stand 22.11.2026 · Pp. = Prozentpunkte</span>
      <button
        class="erf-ib"
        aria-label="Quellen und Einschränkungen anzeigen"
        @click="sourcesOpen = true"
      >
        ⓘ Quellen
      </button>
    </div>

    <SourcesPopover
      :open="sourcesOpen"
      scope="Gilt für die Folie Strukturelle Erosion: Stand der Forschung. Recherche-Stand 22.11.2026; jede Zahl ist an der Primärquelle nachgelesen."
      :sources="sources"
      :caveats="caveats"
      @close="sourcesOpen = false"
    />
  </div>
</template>

<style scoped>
.erf {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: v-bind("P.text");
}
.erf-lead {
  margin: 0;
  font-size: 13px;
  line-height: 1.35;
  color: var(--color-text-primary);
}

/* Tabelle: eigene Regeln statt der Markdown-Tabellen-Styles des Themes,
   damit die Zeilenhöhe fest bleibt (Overflow-Budget der Folie). */
.erf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  line-height: 1.3;
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
}
.erf-table th {
  padding: 3px 8px;
  text-align: left;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
  background: v-bind("P.headerBg");
  border-bottom: 1px solid v-bind("P.border");
}
.erf-table td {
  padding: 3px 8px;
  vertical-align: baseline;
  border-bottom: 1px solid v-bind("P.border");
}
.erf-table tr:last-child td {
  border-bottom: none;
}
.erf-topic {
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-text-primary);
}
.erf-value {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-weight: 700;
  white-space: nowrap;
  color: v-bind("P.accentViolet");
}
.erf-value.muted {
  font-weight: 400;
  color: v-bind("P.labelColor");
}
.erf-ref {
  white-space: nowrap;
  font-size: 10px;
  color: v-bind("P.labelColor");
}

.erf-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.erf-card {
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.35;
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
}
.erf-card-ok {
  border-color: v-bind("P.accentGreen");
}
.erf-card-h {
  margin-bottom: 2px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
}
.erf-card ul {
  margin: 0;
  padding-left: 14px;
  list-style: disc;
}
.erf-card li {
  margin: 0;
  padding: 0;
  font-size: 11px;
  line-height: 1.35;
  color: v-bind("P.descColor");
}
.erf-card li b {
  color: var(--color-text-primary);
}
.erf-card-ok li b {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  color: v-bind("P.accentGreen");
}

.erf-callout {
  font-size: 12px;
  line-height: 1.4;
}

.erf-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: v-bind("P.labelColor");
}
.erf-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.erf-ib:hover {
  color: var(--color-text-primary);
}
</style>
