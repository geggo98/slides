<script setup lang="ts">
// Folie „Context Rot: Stand der Forschung“ (pages/context-rot-forschung.md).
// Drei Blöcke: Tabelle der belegten Faktoren, zwei Karten (Kompaktierung,
// nicht belegt), Callout mit der Einordnung des eigenen Experiments.
//
// Jede Zahl stammt aus dem Faktencheck vom 22.11.2026 (Belegzeilen wörtlich
// aus den Abstracts beziehungsweise HTML-Fassungen) oder aus dem
// Gesamtbericht der eigenen Studien, Teil 1.2 und 1.3 (Studie 4: Fülltext bis
// 128k, Studie 7: `contra-1` −0,96 logit). Die Einschränkungen im ⓘ-Modal
// gehören zu den Zahlen: ohne sie liest sich die Tabelle allgemeiner, als die
// Arbeiten es hergeben.
import { ref } from "vue";
import Callout from "@shared/components/Callout.vue";
import SourcesPopover from "./SourcesPopover.vue";
import { useDeckPalette } from "./palette";

const P = useDeckPalette();
const sourcesOpen = ref(false);

interface Row {
  factor: string;
  value: string;
  finding: string;
  ref: string;
  /** Zeile ohne tragende Zahl: Wert gedimmt statt in Akzentfarbe. */
  muted?: boolean;
}

const rows: Row[] = [
  {
    factor: "Länge",
    value: "11 von 13",
    finding: "Modellen fallen bei 32K unter 50 % ihrer Kurzkontext-Leistung",
    ref: "NoLiMa, ICML 2025",
  },
  {
    factor: "Position",
    value: "ohne Zahl",
    finding: "Information in der Mitte wird schlechter genutzt als am Rand",
    ref: "Lost in the Middle, 2024",
    muted: true,
  },
  {
    factor: "Distraktoren",
    value: "0,16–0,33",
    finding:
      "Trefferquote mit formatgleichen Rivalen; neutraler Fülltext 0,97–1,00",
    ref: "2611.04169, kleine Modelle",
  },
  {
    factor: "Anweisungsdichte",
    value: "68 %",
    finding:
      "erreichen die besten von 20 Modellen bei 500 Anweisungen zugleich",
    ref: "IFScale, 2025",
  },
  {
    factor: "Mehrrunden",
    value: "−39 %",
    finding: "im Mittel, wenn die Aufgabe über mehrere Runden verteilt kommt",
    ref: "2505.06120, simuliert",
  },
  {
    factor: "Aktuelle Modelle",
    value: "31 → 24 %",
    finding:
      "GPT-5.6 Sol bei 250k Vorkontext; Opus 5 nur bei passendem: 50 → 40 %",
    ref: "Boolean-Blog, 20 Aufgaben",
  },
];

const sources = [
  {
    href: "https://www.trychroma.com/research/context-rot",
    label: "Chroma: Context Rot",
    note: "14.07.2025, 18 Modelle; Industriebericht ohne Peer Review",
  },
  {
    href: "https://arxiv.org/abs/2502.05167",
    label: "NoLiMa (arXiv 2502.05167)",
    note: "ICML 2025; Suche ohne wörtliche Übereinstimmung, 13 Modelle",
  },
  {
    href: "https://arxiv.org/abs/2404.06654",
    label: "RULER (arXiv 2404.06654)",
    note: "COLM 2024; nur die Hälfte von 17 Modellen arbeitet bei 32K zufriedenstellend",
  },
  {
    href: "https://arxiv.org/abs/2307.03172",
    label: "Lost in the Middle (arXiv 2307.03172)",
    note: "TACL 2024; im Abstract steht keine Zahl",
  },
  {
    href: "https://arxiv.org/abs/2611.04169",
    label: "Length Is Cheap, Competition Is Not (arXiv 2611.04169)",
    note: "03.11.2026; fünf offene Modelle, 0,5B bis 3B Parameter, bis 32K Tokens",
  },
  {
    href: "https://arxiv.org/abs/2507.11538",
    label: "IFScale (arXiv 2507.11538)",
    note: "15.07.2025, Preprint; 20 Modelle, bis 500 Anweisungen",
  },
  {
    href: "https://arxiv.org/abs/2505.06120",
    label: "arXiv 2505.06120",
    note: "09.05.2025, Preprint; über 200 000 simulierte Unterhaltungen",
  },
  {
    href: "https://boolean.ai/blog/context-rot-quantified",
    label: "Boolean: Context Rot Quantified",
    note: "15.09.2026, Firmenblog; 20 Aufgaben aus terminal-bench",
  },
  {
    href: "https://arxiv.org/abs/2608.11242",
    label: "Lost in Context Compaction (arXiv 2608.11242)",
    note: "v2 vom 11.10.2026; 17 % Retention, Postfach-Test 30 von 100",
  },
  {
    href: "https://arxiv.org/abs/2603.17781",
    label: "Facts as First Class Objects (arXiv 2603.17781)",
    note: "18.03.2026; Quelle der Drei-Runden-Zahl, Table 4",
  },
  {
    href: "https://arxiv.org/abs/2608.22752",
    label: "The Compaction Cliff (arXiv 2608.22752)",
    note: "24.08.2026; /compact auf Sonnet 4.6 über fünf Runden",
  },
  {
    href: "https://www.anthropic.com/research/effective-context-engineering-for-ai-agents",
    label: "Anthropic: Effective context engineering for AI agents",
    note: "29.09.2025; Herstellerblog ohne eigene Zahlen",
  },
];

const caveats = [
  {
    lead: "Die Modelle sind älter:",
    text: "Lost in the Middle misst Modelle von 2023, RULER von 2024, Chroma und NoLiMa von Mitte 2025. Die einzige gefundene Messung an Claude Opus 5 und GPT-5.6 Sol ist ein Firmenblog mit 20 Aufgaben; Zahl der Läufe und Streuung nennt er nicht. Zu GPT-6.x und Gemini 3.x fand die Recherche keine belastbaren Zahlen.",
  },
  {
    lead: "Einfache, synthetische Aufgaben:",
    text: "Chroma, RULER und NoLiMa messen Suche und Abruf in langem Text. NoLiMa prüft Suche ohne wörtliche Übereinstimmung. Auf die Arbeit eines Coding-Agenten lassen sich die Zahlen nicht direkt übertragen.",
  },
  {
    lead: "Distraktoren, zwei Quellen:",
    text: "Chroma zeigt an großen Modellen, dass schon ein Distraktor die Leistung senkt und vier sie weiter senken. Die Werte 0,16 bis 0,33 gegen 0,97 bis 1,00 stammen aus fünf offenen Modellen mit 0,5B bis 3B Parametern. Sie zeigen den Mechanismus, kein Frontier-Modell.",
  },
  {
    lead: "IFScale:",
    text: "Die Anweisungen verlangen nur, ein Stichwort aufzunehmen. Verbote sind nicht getestet. Frühe Anweisungen werden bevorzugt.",
  },
  {
    lead: "Mehrrunden:",
    text: "Der Abfall von 39 % ist relativ und entsteht vor allem durch Unzuverlässigkeit. Es geht um eine Aufgabe, die über mehrere Runden verteilt gestellt wird, nicht um lange Kontexte.",
  },
  {
    lead: "17 % sind ein Mittelwert über sehr verschiedene Verfahren:",
    text: "Zwei Verfahren ohne LLM behalten 0 % und drücken das Mittel. GPT-5.4-mini liegt je nach Aufbau zwischen 6,7 % und 98 %. Gemessen wurde eine Runde bei 100K Tokens. Mit einem eigenen Extraktor steigt die Retention auf über 90 %.",
  },
  {
    lead: "Postfach-Test:",
    text: "Ein Modell (gpt-oss-120b), eine Kompaktierung bei 100K Tokens, 20 Seeds mal 5 Fortsetzungssätze. Wird die Regel nach der Kompaktierung wiederholt, sinkt die Rate auf 13 von 100.",
  },
  {
    lead: "Drei Runden, über die Hälfte weg:",
    text: "Die Zahl hat eine Quelle: 53 % verloren nach drei Runden. Der Aufbau: 20 erfundene Regeln, eine simulierte Unterhaltung mit 88 Turns, Kompression 31-fach, 5 Seeds. Eine andere Arbeit misst für /compact auf Sonnet 4.6 nach einer Runde 53 % erhaltene Sicherheitsregeln und nach fünf Runden 10 %. Die Kurve hängt also vom Aufbau ab.",
  },
  {
    lead: "Eigenes Experiment:",
    text: "Sicherheit am ersten Token einer Java-Vervollständigung, nicht Richtigkeit. Der relevante Code steht immer direkt vor der Messstelle, eine Suche im Fülltext ist nicht nötig. Fülltext bis 128k Tokens nur bei Luna, ein Request je Stelle. Die −0,96 logit gelten für eine Regel mit widersprüchlicher Bedingung (eigene Experimente, 3 Seeds).",
  },
];
</script>

<template>
  <div class="crf">
    <p class="crf-lead">
      Groß im Fenster heißt nicht zuverlässig genutzt: Bei
      <b>18 Modellen</b> wird die Leistung mit wachsender Eingabe
      unzuverlässiger (Chroma, 07/2025).
    </p>

    <table class="crf-table">
      <thead>
        <tr>
          <th>Gut belegt</th>
          <th>Zahl</th>
          <th>Befund</th>
          <th>Beleg</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.factor">
          <td class="crf-factor">{{ r.factor }}</td>
          <td class="crf-value" :class="{ muted: r.muted }">{{ r.value }}</td>
          <td>{{ r.finding }}</td>
          <td class="crf-ref">{{ r.ref }}</td>
        </tr>
      </tbody>
    </table>

    <div class="crf-cards">
      <div class="crf-card crf-card-warn">
        <div class="crf-card-h">Kompaktierung verliert Nebenbedingungen</div>
        <ul>
          <li>
            <b>17 %</b> der eingefügten Nebenbedingungen bleiben im Mittel
            erhalten (eine Runde, 100K Tokens)
          </li>
          <li>
            <b>30 von 100</b> Sitzungen: Agent löscht Mails ohne Freigabe,
            vorher in keiner (ein Modell)
          </li>
        </ul>
        <div class="crf-card-ref">arXiv 2608.11242, v2 vom 11.10.2026</div>
      </div>
      <div class="crf-card">
        <div class="crf-card-h">Nicht belegt</div>
        <ul>
          <li>
            „Nach drei Runden ist über die Hälfte der Regeln weg“ als Gesetz:
            ein Versuch, 20 Regeln, Kompression 31-fach
          </li>
          <li>
            „Länge allein ist die Ursache“: Chroma erklärt den Mechanismus nicht
          </li>
          <li>
            „Neue Modelle haben das gelöst“: zu GPT-6.x und Gemini 3.x keine
            belastbaren Zahlen
          </li>
        </ul>
      </div>
    </div>

    <Callout tone="info" dense class="crf-callout">
      <b>Eigenes Experiment:</b> misst Sicherheit am ersten Token, nicht
      Richtigkeit. Es kann die Literatur weder bestätigen noch widerlegen. Luna:
      kein Abfall bis 128k Tokens Fülltext, aber <b>eine</b> am Code zu prüfende
      Regel kostet 0,96 logit. Der Inhalt wirkt, nicht die Länge.
    </Callout>

    <div class="crf-foot">
      <span
        >Recherche-Stand 22.11.2026 · Modelle der Arbeiten: 2023 bis 2026</span
      >
      <button
        class="crf-ib"
        aria-label="Quellen und Einschränkungen anzeigen"
        @click="sourcesOpen = true"
      >
        ⓘ Quellen
      </button>
    </div>

    <SourcesPopover
      :open="sourcesOpen"
      scope="Gilt für die Folie Context Rot: Stand der Forschung. Recherche-Stand 22.11.2026; jede Zahl ist an der Primärquelle nachgelesen."
      :sources="sources"
      :caveats="caveats"
      @close="sourcesOpen = false"
    />
  </div>
</template>

<style scoped>
.crf {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: v-bind("P.text");
}
.crf-lead {
  margin: 0;
  font-size: 13px;
  line-height: 1.35;
  color: var(--color-text-primary);
}

/* Tabelle: eigene Regeln statt der Markdown-Tabellen-Styles des Themes,
   damit die Zeilenhöhe fest bleibt (Overflow-Budget der Folie). */
.crf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  line-height: 1.3;
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
}
.crf-table th {
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
.crf-table td {
  padding: 3px 8px;
  vertical-align: baseline;
  border-bottom: 1px solid v-bind("P.border");
}
.crf-table tr:last-child td {
  border-bottom: none;
}
.crf-factor {
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-text-primary);
}
.crf-value {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-weight: 700;
  white-space: nowrap;
  color: v-bind("P.accentViolet");
}
.crf-value.muted {
  font-weight: 400;
  color: v-bind("P.labelColor");
}
.crf-ref {
  white-space: nowrap;
  font-size: 10px;
  color: v-bind("P.labelColor");
}

.crf-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.crf-card {
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.35;
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
}
.crf-card-warn {
  border-color: var(--color-border-warning);
}
.crf-card-h {
  margin-bottom: 2px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: v-bind("P.labelColor");
}
.crf-card ul {
  margin: 0;
  padding-left: 14px;
  list-style: disc;
}
.crf-card li {
  margin: 0;
  padding: 0;
  font-size: 11px;
  line-height: 1.35;
  color: v-bind("P.descColor");
}
.crf-card li b {
  color: var(--color-text-primary);
}
.crf-card-warn li b {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  color: v-bind("P.accentViolet");
}
.crf-card-ref {
  margin-top: 2px;
  font-size: 10px;
  color: v-bind("P.labelColor");
}

.crf-callout {
  font-size: 12px;
  line-height: 1.4;
}

.crf-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: v-bind("P.labelColor");
}
.crf-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.crf-ib:hover {
  color: var(--color-text-primary);
}
</style>
