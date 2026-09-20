<script setup lang="ts">
import SourcesPopover from "./SourcesPopover.vue";

// Eigenes ⓘ-Modal für die beiden HarnessTax-Folien (Pareto und Ausdauer) —
// ANDERE Studie als `ModelRoutingSources.vue` (DeepSWE), andere Benchmarks,
// andere Einschränkungen. Beide Modale teilen sich nur die Optik
// (`SourcesPopover.vue`), keine Zeile Inhalt.
defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const sources = [
  {
    href: "https://harnesstax.github.io/",
    label: "HarnessTax (Pan, Yang, Arabzadeh, Chiang, Stoica, Zaharia)",
    note: "UC Berkeley Sky Lab + Arena, Stand 16.09.2026",
  },
  {
    href: "https://www.swebench.com/lite",
    label: "SWE-bench Lite",
    note: "einer der beiden getesteten Benchmarks",
  },
  {
    href: "https://arxiv.org/abs/2601.11868",
    label: "Terminal-Bench 2.0 (arXiv:2601.11868)",
    note: "der andere getestete Benchmark",
  },
  {
    href: "https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md",
    label: "Pi (Coding-Agent-README)",
    note: "vier Werkzeuge: read, write, edit, bash",
  },
  {
    href: "https://news.ycombinator.com/item?id=49528037",
    label: "Erfahrungsbericht: Harness und Abbruch",
    note: "HN, 01.09.2026 — die Ausgangs-Hypothese, wörtlich auf der Folie „Die Abbruch-These“",
  },
  {
    href: "https://systima.ai/blog/claude-code-vs-opencode-token-overhead",
    label: "Systima: Claude Code vs. OpenCode (API-Grenze)",
    note: "unabhängige zweite Messung desselben Erstkontext-Effekts, Kap. 10",
  },
];

const caveats = [
  {
    lead: "Nicht vergleichbar mit „Welches Modell wofür?“:",
    text: "Gleiche Achsenbeschriftung (€/Task, log. Skala), andere Welt: anderer Benchmark (SWE-bench Lite / Terminal-Bench 2.0 statt DeepSWE v1.1), andere Harnesse (Pi/Codex CLI/Claude Code statt mini-swe-agent), andere Metrik (Mittel über drei Versuche je Task statt pass@1), 30 statt 113 Tasks, andere Preisliste (eingefroren zum 01.09.2026). Die beiden Fronten nebeneinanderzulegen wäre ein Kategorienfehler. Innerhalb von HarnessTax sind die Harness-Vergleiche je Benchmark konsistent (gleiche Methode), die absoluten Raten der beiden Benchmarks aber nicht mischbar.",
  },
  {
    lead: "30 Tasks × 3 Läufe:",
    text: "Jede Zelle beruht auf 30 zufällig gezogenen Tasks je Benchmark, dreimal wiederholt. Die meisten Harness-Unterschiede im Erfolg liegen innerhalb der 95-%-Konfidenzintervalle (Bootstrap, 10.000 Resamples) — belastbar ist die Kosten-Aussage, nicht jede einzelne Rangfolge.",
  },
  {
    lead: "Kosten sind kein Messwert:",
    text: "Sie entstehen aus Token-Verbrauch × einer am 01.09.2026 eingefrorenen Direct-API-Preisliste — nicht aus dem, was tatsächlich bezahlt wurde. Abo-Kontingente stecken nicht darin. Umgerechnet wird mit demselben Kurs wie auf den DeepSWE-Folien, 1 USD = 0,876 €.",
  },
  {
    lead: "100-Turn-Cap:",
    text: "Jeder Versuch war auf 100 Agenten-Turns gedeckelt. Auf Terminal-Bench 2.0 traf das Claude Code × Claude Haiku 4.5 viermal (4 von 30 Tasks ungelöst) — diese eine Zelle ist teils ein Cap-Artefakt, kein reiner Fähigkeits-Befund.",
  },
  {
    lead: "Claude Code lief nicht in seiner Alltagskonfiguration:",
    text: "Für SWE-bench Lite war externer Netzwerkzugriff aus den Task-Containern gesperrt, die Standard-Web-Tools in Claude Code und Codex waren deaktiviert, und gehostete Tool-Deklarationen wurden auf API-Ebene abgelehnt — damit alle drei Harnesse dieselben Werkzeuge sehen.",
  },
  {
    lead: "Pi ist nicht Default-Pi:",
    text: "Die Autoren ergänzten zwei Pakete für Subscription-Keys und Turn-Kontrolle. Kimi K3 lief über Fireworks AI, mit dem einzigen nativen Denkmodus dieses Modells über alle drei Harnesse hinweg.",
  },
  {
    lead: "Turn-Definitionen unterscheiden sich:",
    text: "Ein „Turn“ zählt je Harness nach dessen eigener Definition. Die Ausdauer-Folie vergleicht Schrittzahlen trotzdem harness-übergreifend — als Größenordnung, nicht als exakt gleiche Einheit.",
  },
  {
    lead: "Mögliche Benchmark-Kontamination:",
    text: "SWE-bench Lite und Terminal-Bench 2.0 sind öffentlich und könnten in den Trainingsdaten der getesteten Modelle stecken — ein Vorbehalt, den die Autoren selbst nennen.",
  },
  {
    lead: "Rohe Traces angekündigt, nicht veröffentlicht:",
    text: "Der Blogpost kündigt die Profiling-Traces öffentlich an; geprüft am 18.09.2026 existiert unter github.com/harnesstax kein öffentliches Repo, die Website liefert nur die aggregierten Dashboard-Zahlen. Nachrechenbar ist diese Ebene, nicht der Einzellauf.",
  },
  {
    lead: "Interessenkonflikte:",
    text: "Arena hat den API-Zugang für die Profiling-Läufe gesponsert, das Laude Institute stellte Anthropic-Guthaben, UC Berkeleys Sky Lab wird unter anderem aus Industriegaben finanziert (Accenture, AMD, Anyscale, Broadcom, Google, IBM, Intel, Intesa Sanpaolo, Lambda, Mibura, Samsung SDS, SAP) — dieselbe Vorbehalts-Klasse wie bei Datacurve/Scale auf den DeepSWE-Folien.",
  },
];
</script>

<template>
  <SourcesPopover
    :open="open"
    scope="Gilt für beide HarnessTax-Folien: Der Harness als zweite Achse und Die Abbruch-These, gemessen."
    :sources="sources"
    :caveats="caveats"
    @close="emit('close')"
  />
</template>
