<script setup>
// „Test Coverage als Ziel“: befürchtete Folge → passende Ergänzung, die
// Grenzen der Ergänzungen hinter (i)-Popovers. Stand der Belege: 11.10.2026
// (Faktencheck mit Rohtext-Prüfung der Zitate, Quellen in den Speaker Notes).
// Bewusst nicht belegt: dass ein Coverage-Ziel die Flaky-Rate oder die CI-Dauer
// erhöht — keine Studie misst das, es ist die Befürchtung. „Viele Tests je
// Änderung“ bei Agenten ist Praxiserfahrung; in GitHub-Daten fassen Agenten nur
// in etwa 40–50 % ihrer PRs Tests an (arXiv 2601.21194, 2607.18057). Belegt ist
// das schwache Signal „grün“: rund die Hälfte der testbestandenen SWE-bench-
// PRs hätten Maintainer nicht gemergt (METR, 10.03.2026; die Tests stammen dort
// von Menschen). „Eigenes Beispiel“ ist die Berechtigungsprüfung, nicht Google.
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import InfoPopover from "./InfoPopover.vue";
import { useInfoPopover } from "./lib/useInfoPopover";

const { isDark } = useDarkMode();
const { info, toggle } = useInfoPopover();

const rows = [
  {
    fear: "Tests führen Code aus, prüfen aber wenig",
    counter: "Mutation Score",
    detail: "Anteil künstlich eingebauter Fehler, den die Tests erkennen",
    info: {
      id: "mutation",
      title: "Auch der Mutation Score lässt sich schönen",
      text: "Tests, die nur die Implementierung festnageln, töten Mutanten, ohne das Produkt sicherer zu machen. Ausschlüsse und ignorierte Mutanten verkleinern den Nenner. Überlebende Mutanten sind Anlass zum Nachsehen; manche ändern das Verhalten gar nicht (äquivalente Mutanten). Operatoren und Ausschlüsse stabil und sichtbar halten.",
    },
  },
  {
    fear: "Viele Tests machen Änderungen langsam",
    counter: "Feedbackzeit der Tests",
    detail: "CI-Testdauer, Median und p90/p95",
  },
  {
    fear: "Tests liefern bei gleichem Code mal Grün, mal Rot",
    counter: "Flaky-Test-Rate",
    detail: "Anteil der Läufe mit wechselndem Ergebnis",
  },
  {
    fear: "Trotz guter Zahlen entgehen relevante Fehler",
    counter: "Produktionsregressionen",
    detail: "nach Schwere und Ursache auswerten",
    info: {
      id: "prod",
      title: "Rückkopplung, kein Testziel",
      text: "Produktionsfehler kommen spät und hängen von Nutzung und Änderungsumfang ab. Eine rohe Bug-Anzahl taugt deshalb nicht als unmittelbares Ziel für Tests.",
    },
  },
  {
    agent: true,
    fear: "Viele neue Tests je Änderung, alle grün, und das Ergebnis fällt trotzdem durch die QA",
    counter: "Abnahme außerhalb des Agenten-Loops",
    detail:
      "fachliche Prüfung, Mutation Score auf dem Diff, Tests nur per Review änderbar",
    info: {
      id: "agent",
      title: "Grün ist ein schwaches Signal",
      text: "Rund die Hälfte der testbestandenen SWE-bench-PRs hätten Maintainer nicht gemergt (METR, 2026; die Tests stammen dort von Menschen). Agenten passen Tests auch an: Claude 3.7 Sonnet System Card (2025) beschreibt Special-Casing; in ImpossibleBench (2025) brachte GPT-5 unlösbare Aufgaben in 54 % der Fälle auf Grün. „Viele Tests je Änderung“ ist unsere Erfahrung, keine Studienlage.",
    },
  },
];

const footers = [
  {
    label: "Gemeinsamer blinder Fleck",
    id: "blind",
    title: "Fehlender Code",
    text: "Eine ganz fehlende Anforderung hat keinen Code, den man abdecken oder mutieren könnte. Marick zitiert Studien: 22–54 % der Fehler waren Auslassungen. Fachliche Szenarien, Integration und reale Fehlerbilder brauchen eigene Aufmerksamkeit.",
  },
  {
    label: "Risiko vor Durchschnitt",
    id: "risk",
    title: "Gewichten statt mitteln",
    text: "Eine ungetestete Berechtigungsprüfung wiegt schwerer als viele ungetestete Logzeilen (eigenes Beispiel). Je Komponente und je Änderung ansehen, keine Rangliste zwischen Teams daraus bauen.",
  },
];

const vars = computed(() => {
  const d = isDark.value;
  return {
    "--cc-surface": d ? "#111621" : "#ffffff",
    "--cc-alt": d ? "#161c2a" : "#f1f5f9",
    "--cc-border": d ? "#1e2536" : "#e2e8f0",
    "--cc-text": d ? "#e2e8f0" : "#1e293b",
    "--cc-muted": d ? "#94a3b8" : "#475569",
    "--cc-red": d ? "#f87171" : "#dc2626",
    "--cc-green": d ? "#4ade80" : "#15803d",
    "--cc-purple": d ? "#c084fc" : "#7e22ce",
  };
});
</script>

<template>
  <div class="cc" :style="vars">
    <div class="cc-head">
      <span style="color: var(--cc-red)"
        >Befürchtete Folge des Coverage-Ziels</span
      >
      <span style="color: var(--cc-green)">Passende Ergänzung</span>
    </div>
    <div v-for="r in rows" :key="r.counter" class="cc-row">
      <div class="cc-fear">
        <span v-if="r.agent" class="cc-tag">Agent</span>
        <span>{{ r.fear }}</span>
      </div>
      <div class="cc-counter">
        <span class="cc-counter-line">
          <b>{{ r.counter }}</b>
          <InfoPopover
            v-if="r.info"
            :id="r.info.id"
            :active-id="info"
            :title="r.info.title"
            @toggle="toggle(r.info.id)"
          >
            {{ r.info.text }}
          </InfoPopover>
        </span>
        <span class="cc-detail">{{ r.detail }}</span>
      </div>
    </div>
    <div class="cc-foot">
      <span v-for="f in footers" :key="f.id" class="cc-foot-item">
        {{ f.label }}
        <InfoPopover
          :id="f.id"
          :active-id="info"
          :title="f.title"
          @toggle="toggle(f.id)"
        >
          {{ f.text }}
        </InfoPopover>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cc {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 0.3em;
  color: var(--cc-text);
  font-size: 14px;
  line-height: 1.35;
}
.cc-head,
.cc-row {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 10px;
}
.cc-head {
  padding: 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.cc-row {
  padding: 6px 10px;
  background: var(--cc-surface);
  border: 1px solid var(--cc-border);
  border-radius: 6px;
}
.cc-fear {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.cc-counter {
  display: flex;
  flex-direction: column;
}
.cc-counter-line {
  display: flex;
  align-items: center;
}
.cc-detail {
  font-size: 12px;
  color: var(--cc-muted);
}
.cc-tag {
  flex: none;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--cc-purple);
  border: 1px solid var(--cc-purple);
  border-radius: 4px;
}
.cc-foot {
  display: flex;
  gap: 22px;
  margin-top: 4px;
  padding: 0 10px;
  font-size: 12.5px;
  color: var(--cc-muted);
}
.cc-foot-item {
  display: inline-flex;
  align-items: center;
}
</style>
