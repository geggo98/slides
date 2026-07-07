<script setup lang="ts">
// Wiederkehrendes Anatomie-Motiv des Decks: sechs Organe, ein Kreislauf.
// `highlight` hebt ein Organ oder eine Komma-Liste von Organen hervor (die
// übrigen werden gedimmt), `mini` ist die kompakte Variante für
// Section-Divider. Bewusst CSS-only statt SVG: keine defs-IDs, die zwischen
// Nachbar-Slides kollidieren könnten; Light/Dark über die SlidevTokens.
type OrganKey =
  | "orchestrierung"
  | "runbook"
  | "skills"
  | "zustand"
  | "notizen"
  | "mensch";

interface Organ {
  key: OrganKey;
  label: string;
  sub: string;
}

const props = withDefaults(
  defineProps<{ highlight?: string; mini?: boolean }>(),
  { highlight: undefined, mini: false },
);

// Hauptkette: jeder Lauf fließt von der Schleife über das Runbook in die
// Werkzeuge und hinterlässt seinen Zustand im Ticketsystem.
const chain: Organ[] = [
  { key: "orchestrierung", label: "Orchestrierung", sub: "stumpfe Schleife" },
  { key: "runbook", label: "Runbook", sub: "Programm in Prosa" },
  { key: "skills", label: "Skills", sub: "die Hände" },
  { key: "zustand", label: "Zustand", sub: "Ticket-Gedächtnis" },
];

// Lern-Schleife: Beobachtungen fließen über den Menschen zurück ins Runbook.
const feedback: Organ[] = [
  { key: "notizen", label: "Notizen", sub: "Agent schreibt" },
  { key: "mensch", label: "Mensch", sub: "kuratiert" },
];

const organClass = (key: OrganKey) => {
  const hl = props.highlight?.split(",").includes(key) ?? false;
  return { organ: true, hl, dim: props.highlight !== undefined && !hl };
};
</script>

<template>
  <div class="anatomy" :class="{ mini }">
    <div class="chain">
      <template v-for="(o, i) in chain" :key="o.key">
        <span v-if="i > 0" class="arrow">→</span>
        <div :class="organClass(o.key)">
          <span class="label">{{ o.label }}</span>
          <span class="sub">{{ o.sub }}</span>
        </div>
      </template>
    </div>
    <div class="feedback">
      <span class="fb-caption">Lern-Schleife</span>
      <span class="arrow">⤷</span>
      <template v-for="(o, i) in feedback" :key="o.key">
        <span v-if="i > 0" class="arrow">→</span>
        <div :class="organClass(o.key)">
          <span class="label">{{ o.label }}</span>
          <span class="sub">{{ o.sub }}</span>
        </div>
      </template>
      <span class="arrow back">→ zurück ins Runbook</span>
    </div>
  </div>
</template>

<style scoped>
.anatomy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 100%;
  font-family: var(--font-sans);
}
.chain {
  display: flex;
  align-items: center;
  gap: 8px;
}
.organ {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--sk-rad, 10px);
  border: 0.5px solid var(--color-border-tertiary);
  background: var(--color-background-secondary);
  transition: opacity 0.2s;
}
.organ .label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}
.organ .sub {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
.organ.hl {
  background: var(--color-background-info);
  border-color: var(--color-border-info);
}
.organ.hl .label {
  color: var(--color-text-info);
}
.organ.dim {
  opacity: 0.5;
}
.arrow {
  color: var(--color-text-tertiary);
  font-size: 15px;
  flex-shrink: 0;
}
/* Lern-Schleife: gestrichelte Rückkopplung unterhalb der Hauptkette. */
.feedback {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-left: 40px;
  border: 1px dashed var(--color-border-tertiary);
  border-radius: var(--sk-rad, 10px);
  width: fit-content;
  max-width: 100%;
}
.fb-caption {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-tertiary);
}
.arrow.back {
  font-size: 12px;
  white-space: nowrap;
}
/* Kompakte Variante für Section-Divider. */
.anatomy.mini {
  gap: 6px;
}
.anatomy.mini .organ {
  padding: 4px 10px;
}
.anatomy.mini .organ .label {
  font-size: 11.5px;
}
.anatomy.mini .organ .sub {
  display: none;
}
.anatomy.mini .arrow {
  font-size: 12px;
}
.anatomy.mini .feedback {
  padding: 3px 10px;
  margin-left: 24px;
}
.anatomy.mini .arrow.back {
  font-size: 10.5px;
}
</style>
