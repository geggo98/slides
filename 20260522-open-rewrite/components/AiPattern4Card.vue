<script setup>
import AiPatternCard from "./AiPatternCard.vue";
import AiPattern4Pipeline from "./AiPattern4Pipeline.vue";
</script>

<template>
  <AiPatternCard
    tag="OpenRewrite extrahiert strukturierten Kontext, KI-Agent konsumiert ihn. KI operiert auf Architektur-Beschreibung statt rohem Code-Grep."
    :badges="[
      { label: 'Determinismus: hoch', tone: 'good' },
      { label: 'Reviewbar: gut', tone: 'good' },
      { label: 'Token-Kosten: mittel' },
      { label: 'Maturity: neu', tone: 'warn' },
    ]"
    :apply="[
      'Komplexe Architekturen, viele Services, B2B-Integrationen',
      'Token-Budget für rohen Code-Grep zu knapp',
      'Cross-Repo-Impact-Analyse',
    ]"
    :avoid="[
      'Kleine, übersichtliche Codebases',
      'Architektur-Modelle nicht stabil',
      'Niemand maintained die Kontext-Files',
    ]"
    verdict="Konzeptuell unterschätzt — das wird sich durchsetzen, auch ohne Moderne-Branding. Achtung: vollständige Implementierung hinter MPL-Paywall."
  >
    <template #pipeline>
      <AiPattern4Pipeline />
    </template>
  </AiPatternCard>
</template>
