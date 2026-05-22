<script setup>
import AiPatternCard from "./AiPatternCard.vue";
import AiPattern3Pipeline from "./AiPattern3Pipeline.vue";
</script>

<template>
  <AiPatternCard
    tag="rewrite-generative-ai: Recipe ruft an Decision-Points die OpenAI-API. Non-deterministische Diffs."
    :badges="[
      { label: 'Determinismus: niedrig', tone: 'bad' },
      { label: 'Reviewbar: schlecht', tone: 'bad' },
      { label: 'Token-Kosten: hoch', tone: 'bad' },
      { label: 'Maturity: experimentell', tone: 'warn' },
    ]"
    :apply="[
      'Einmalige Spielereien, Prototypen, Forschung',
      'Wenn dem Team egal ist, was der Diff macht',
    ]"
    :avoid="[
      'Produktive Pipelines',
      'Mass-Migration',
      'Wenn ein deterministischer Visitor das Gleiche täte (fast immer der Fall)',
    ]"
    verdict="Hebt den fundamentalen Vorteil von OpenRewrite auf. Hände weg — die OpenRewrite-Maintainer selbst warnen vor Produktiveinsatz."
    verdict-tone="danger"
  >
    <template #pipeline>
      <AiPattern3Pipeline />
    </template>
  </AiPatternCard>
</template>
