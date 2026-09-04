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
    note: "Pareto-Daten, Tokens, Steps (Stand 03.09.)",
  },
  {
    href: "https://deepswe.datacurve.ai/changelog",
    label: "DeepSWE-Changelog",
    note: "Neuzugänge und Preiskorrekturen je Datum",
  },
  {
    href: "https://ai.google.dev/gemini-api/docs/pricing",
    label: "Google-Preisliste (Gemini)",
    note: "3.8 Flash 0,75/3,75 $ bis 31.12.2026, danach das Doppelte",
  },
  {
    href: "https://cursor.com/docs/models",
    label: "Cursor: unterstützte Modelle",
    note: "Modell-Liste des Anbieter-Filters, abgerufen 03.09.2026",
  },
  {
    href: "https://docs.devin.ai/desktop/models",
    label: "Windsurf: unterstützte Modelle",
    note: "dito; docs.windsurf.com leitet seit der Übernahme hierher",
  },
  {
    href: "https://www.jetbrains.com/ai-ides/buy/",
    label: "JetBrains AI: Preisseite",
    note: "nennt nur Anbieter (OpenAI, Anthropic, Google, xAI), keine Modelle",
  },
  {
    href: "https://news.ycombinator.com/item?id=49528037",
    label: "Erfahrungsbericht: Harness und Abbruch",
    note: "HN, 01.09.2026 — eigener Harness statt Claude Code, 200+ Versuche",
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
    text: "Der Harness verschiebt Scores um 10–30 Punkte. Zahlen aus mini-swe-agent gelten nicht für Claude Code oder Codex CLI. Anthropic-Modelle laufen im eigenen Harness meist besser. Der Hebel ist dabei nicht nur Werkzeug und Prompt, sondern die Abbruch-Option: Wer dem Agenten erlaubt aufzugeben, bekommt irgendwann ein „geht nicht“; nimmt man sie ihm, probiert dasselbe Modell dreistellig viele Varianten durch — Erfahrungsbericht, keine Messung. Der Score misst also Modell und Harness gemeinsam, nie das Modell allein.",
  },
  {
    lead: "113 Tasks, Streuung ±1,4–6,5 Punkte:",
    text: "Die Spanne zeigt, wie stark ein Modell zwischen Wiederholungsläufen schwankt — nicht den Stichprobenfehler über die 113 Tasks; der läge bei rund ±8 Punkten. Zwei Modelle mit weniger als 5 Punkten Abstand sind gleichauf. Belastbar ist nur die grobe Schichtung.",
  },
  {
    lead: "Höchste Effort-Stufe:",
    text: "Jedes Modell zählt hier mit seiner BESTEN gemessenen Konfiguration: höchster pass@1, bei Gleichstand die billigere Stufe. Das Board macht es anders — es nimmt je Modell die höchste Effort-Stufe. Das war dieselbe Sache, solange mehr Aufwand mehr Ergebnis hieß; bei vier der 22 Modelle stimmt das nicht mehr. gpt-6-astra löst auf high dieselben 331 von 452 Aufgaben wie auf max, für 5,01 € statt 10,84 €, und auf xhigh sogar 335 — den höchsten Rohwert des Boards — für 5,71 €. claude-fable-5 kostet auf max 18,95 € gegenüber 11,75 € auf xhigh, bei gleichem Score; grok-4.6 liegt auf medium höher als auf xhigh und kostet dort 3,02 € statt 4,82 €; gemini-3.7-flash entsprechend 1,77 € statt 1,91 €. Die Front ändert das in keinem der neun Stände — alle vier Punkte rücken nach links, keiner erreicht dabei eine Front. Nachgerechnet wird beides bei jedem Testlauf gegen die archivierten Board-Rohdaten unter data/deepswe.",
  },
  {
    lead: "Quadranten:",
    text: "Die Trennlinien in den Charts bei 8 €/Task und 50 % Pass@1 haben wir selbst gewählt. Sie stecken nicht in den Daten.",
  },
  {
    lead: "Board-Default:",
    text: "Das Board zeigt per Default 21 von 28 Modellen; sieben ältere blendet es aus — die Liste steckt hartcodiert im Board-Bundle. Auf der Folie „Welches Modell wofür?“ ist gpt-5.6-terra wieder dabei — es ist bestellbar und läge auf der Front. Im Historien-Chart bleibt jedes je gemessene Modell stehen.",
  },
  {
    lead: "Anbieter-Filter:",
    text: "Nur auf der Folie „Welches Modell wofür?“. Die Labs sind Checkboxen und beliebig kombinierbar — einzeln sagt ein Lab wenig, interessant wird „bei uns sind OpenAI und Anthropic freigegeben“. Die Werkzeuge sind Presets und überschreiben die Auswahl. Sie setzen dabei Modelle, nicht Lab-Häkchen, und das ist wesentlich: Windsurf führt von Google nur 3.5 und 3.6 Flash. Über Lab-Häkchen bekäme es das ganze Google-Lab und damit gemini-3.8-flash, das es gar nicht anbietet — seine Front wäre dann die von „Alle“. Ein nur teilweise abgedecktes Lab steht deshalb auf „teilweise“ (2/4), nicht auf „an“. Die Labs kommen aus der Zuordnung des Boards selbst; die drei Werkzeuge aus der jeweiligen Hersteller-Doku, abgerufen am 03.09.2026 — solche Kataloge ändern sich monatlich. Der Filter zeigt Verfügbarkeit, nicht Preis: Cursor und Windsurf rechnen nach eigenen Tarifen ab, geplottet bleibt der API-Listenpreis. Das jeweils eigene Modell fehlt jeder Werkzeug-Ansicht, weil DeepSWE es nicht misst — Cursors Composer so wenig wie Windsurfs SWE-1.x. JetBrains AI ist nur auf Providerebene belegt (OpenAI, Anthropic, Google, xAI) und deshalb eine Obergrenze; Junie fehlt ganz, dort veröffentlicht JetBrains keinen Modellkatalog. Achsen und Quadranten bleiben in jeder Auswahl gleich, nur die Front wird neu gerechnet.",
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
    text: "Der Abo-Preis ist fix, begrenzt wird die Arbeit über das Wochenlimit. Bis 13.09.2026 gibt Claude Code 50 % mehr Kontingent pro Woche, die Kosten pro Task sinken damit auf zwei Drittel; ab 14.09. ersetzt Anthropic die Aktion durch dauerhafte 25 % über der Basis, also vier Fünftel. Eine Rückkehr auf das Basislimit gibt es nicht. Das ist eine Kontingentrechnung, kein Listenpreis. Nur die Folie „Welches Modell wofür?“ kann sie zuschalten, normal ist sie aus; der Geisterring zeigt dort den Stand ab 14.09. Seit dem 02.09. dreht der Schalter die Front nicht mehr: Opus 5 ist auch zum Kontingentpreis von 6,91 € dominiert, weil gemini-3.8-flash denselben Score für 2,07 € liefert.",
  },
  {
    lead: "Peak-Raten und Aktionspreise:",
    text: "Das betrifft seit dem 02.09. auch den obersten Frontpunkt: gemini-3.8-flash läuft auf Googles Einführungspreis bis 31.12.2026 — Input, Output und Cache verdoppeln sich am 01.01.2027, der Punkt also von 2,07 € auf 4,14 €. Er bliebe auf der Front, dann hinter gpt-5.6-terra, das zurückkäme. Dieselbe Aktion tragen gemini-3.7-flash und -3.6-flash. Dazu zwei Punkte am billigen Ende. DeepSeek rechnet seit dem 16.08. nach Haupt- und Nebenzeit ab; das Board nimmt die Hauptzeit, off-peak ist die Hälfte — V4 Pro läge dann bei 0,73 € und wäre immer noch dominiert. Und glm-5.3-flash läuft auf einem befristeten 50-%-Aktionspreis; ohne ihn verdoppelt sich der Punkt auf rund 0,42 €.",
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
    text: "Stand 03.09.2026 — und schon in sich veraltet: die Front hat sich seit Juni in acht Übergängen siebenmal verschoben, dreimal allein durch Preisanpassungen. Wie schnell das geht, zeigt der Stand davor: Ende August sagte diese Folie noch „Opus 5 führt mit 74 %“, dann kam ein einziger Board-Eintrag dazu und die Aussage war hinfällig. Die Gegenprobe steht daneben: Am 03.09. kam mit gpt-6-astra der höchste Rohwert des ganzen Boards dazu — und die Front blieb, weil derselbe gerundete Score woanders ein Drittel kostet. Nicht die Modellnamen sind die Empfehlung dieser Folie, sondern die Regel: der billigste Frontpunkt, der Deine Aufgaben löst. Die überlebt den nächsten Board-Eintrag, die Namen nicht. Wie die Modelle auf Deinen Aufgaben abschneiden, zeigen ohnehin nur eigene Evals.",
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
