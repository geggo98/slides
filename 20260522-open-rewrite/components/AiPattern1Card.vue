<script setup>
import AiPatternCard from "./AiPatternCard.vue";
import AiPattern1Pipeline from "./AiPattern1Pipeline.vue";
</script>

<template>
  <AiPatternCard
    tag="Duolingo-Goldstandard. Deterministische Recipes laufen zuerst, KI fixt nur die Lücken im Build-Loop."
    :badges="[
      { label: 'Determinismus: hoch', tone: 'good' },
      { label: 'Reviewbar: gut', tone: 'good' },
      { label: 'Token-Kosten: mittel' },
      { label: 'Maturity: produktiv', tone: 'good' },
    ]"
    :apply="[
      'Mass-Migration über viele Repos',
      'Spring-Boot-Major-Upgrades mit JPA/Jackson/Security',
      'Existierendes deterministisches Gate (Build, Tests)',
    ]"
    :avoid="[
      'Kein verlässlicher Build als Gate',
      'Migration zu klein für CI-Setup',
      'Codebases ohne sinnvolle Test-Coverage',
    ]"
    verdict="Der einzige produktionserprobte Workflow für Migration-at-Scale. KI nur für die Lücken nutzen — Halluzinationen erkennt der Build."
  >
    <template #pipeline>
      <AiPattern1Pipeline />
    </template>
  </AiPatternCard>
</template>
