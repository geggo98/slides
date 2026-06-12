<script setup>
import AiPatternCard from "./AiPatternCard.vue";
import AiPattern5Pipeline from "./AiPattern5Pipeline.vue";
</script>

<template>
  <AiPatternCard
    tag="Recipes werden als MCP-Tools exponiert. KI-Agent ist Dirigent, OpenRewrite ist Orchester."
    :badges="[
      { label: 'Determinismus: mittel', tone: 'warn' },
      { label: 'Reviewbar: mittel', tone: 'warn' },
      { label: 'Token-Kosten: hoch', tone: 'bad' },
      { label: 'Maturity: neu, interaktiv', tone: 'warn' },
    ]"
    :apply="[
      'Exploratives Refactoring am eigenen Repo',
      'Unklar, welche Recipes wann passen',
      'Interaktive Recipe-Auswahl im Chat-Workflow',
    ]"
    :avoid="[
      'CI-getriebene Mass-Migration über das Inventory',
      'Reproduzierbarkeit zwischen Läufen kritisch',
      'Token-Budget knapp',
    ]"
    verdict="Für Exploration brauchbar, für CI gefährlich. Mehr Flexibilität bedeutet hier weniger Determinismus zwischen Läufen."
    verdict-tone="warning"
  >
    <template #pipeline>
      <AiPattern5Pipeline />
    </template>
  </AiPatternCard>
</template>
