<script setup>
import AiPatternCard from "./AiPatternCard.vue";
import AiPattern2Pipeline from "./AiPattern2Pipeline.vue";
</script>

<template>
  <AiPatternCard
    tag="Der LLM schreibt eine Recipe — nutzt sie aber nicht selbst zum Refactoren. Determinismus-Boundary verlagert sich nach links."
    :badges="[
      { label: 'Determinismus: sehr hoch', tone: 'good' },
      { label: 'Reviewbar: exzellent', tone: 'good' },
      { label: 'Token-Kosten: einmalig', tone: 'good' },
      { label: 'Maturity: produktiv', tone: 'good' },
    ]"
    :apply="[
      'Migration wiederholt sich (Spring Boot 4 → 5 kommt)',
      'Eigene interne API-Migrationen in vielen Services',
      'Sinnvolle Recipe-Wiederverwendung über die Org',
    ]"
    :avoid="[
      'Einmalige Migration in einem einzelnen Repo',
      'Team hat keine LST/Visitor-Lernkurve geplant',
      'Wenn Refaster reicht',
    ]"
    verdict="Langfristig die nachhaltigste Investition. Token-Kosten fallen einmal an, nicht 200×."
    verdict-tone="success"
  >
    <template #pipeline>
      <AiPattern2Pipeline />
    </template>
  </AiPatternCard>
</template>
