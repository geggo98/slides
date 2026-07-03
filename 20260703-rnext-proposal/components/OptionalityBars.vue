<script setup lang="ts">
// Aggregierte Kennzahlen aus dem RClassic-Release-Paket (nur Statistik,
// keine Norm-Inhalte): Anteil optionaler Elemente je Schema.
interface Bar {
  label: string;
  pct: number;
  detail: string;
}

const bars: Bar[] = [
  { label: "Fahrzeug-Schema", pct: 94, detail: "236 optionale Felder" },
  { label: "Partner-Schema", pct: 89, detail: "206 optionale Felder" },
  {
    label: "Ein einzelner Personen-Typ",
    pct: 97,
    detail: "35 von 36 Feldern optional",
  },
];
</script>

<template>
  <div class="opt-wrap">
    <p class="context">
      Zentrales Datentypen-Schema: <strong>1,5 MB</strong> ·
      <strong>31.470 Zeilen</strong> · <strong>474 Typen</strong> — und in den
      Fach-Schemas ist fast jedes Element <code>minOccurs="0"</code>:
    </p>
    <div v-for="b in bars" :key="b.label" class="row">
      <span class="label">{{ b.label }}</span>
      <span class="bar">
        <span class="fill" :style="{ width: `${b.pct}%` }" />
        <span class="pct">{{ b.pct }} % optional</span>
      </span>
      <span class="detail">{{ b.detail }}</span>
    </div>
    <p class="conclusion">
      Ein schema-valides Dokument kann trotzdem völlig unbrauchbar sein — die
      Validierung lebt in Geschäftslogik und Norm-Prosa.
    </p>
  </div>
</template>

<style scoped>
.opt-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
}
.context {
  margin: 0;
  font-size: 15px;
  color: var(--color-text-secondary);
}
.context code {
  font-size: 13px;
}
.row {
  display: grid;
  grid-template-columns: 200px 1fr 210px;
  align-items: center;
  gap: 14px;
}
.label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: right;
}
.bar {
  position: relative;
  height: 26px;
  border-radius: 6px;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-tertiary);
  overflow: hidden;
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--color-background-danger);
  border-right: 2px solid var(--color-border-danger);
}
.pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding-left: 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text-danger);
}
.detail {
  font-size: 12.5px;
  color: var(--color-text-tertiary);
}
.conclusion {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-primary);
}
</style>
