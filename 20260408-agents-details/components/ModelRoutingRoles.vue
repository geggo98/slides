<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ModelRoutingSources from "./ModelRoutingSources.vue";

// Port von Tab 1 der vorbereiteten Infografik „Modell-Routing: Agenten
// kombinieren": Orchestrator (Claude Code) → Rollen-Karten mit Detail-Panel.
// Beträge auf Euro vereinheitlicht (1 USD = 0,876 €, 21.07.2026 — dieselben
// Werte wie im Pareto-Chart). Steuerung doppelt: `active`-Prop vom Slide
// ($clicks cycelt die Rollen durch) plus Karten-Klick als lokaler Override.
type RoleKey = "plan" | "exec" | "res" | "ver" | "ext";

interface Role {
  key: RoleKey;
  title: string;
  models: string;
  cost: string;
  freq: number;
  detailTitle: string;
  detailText: string;
  ev: string;
}

const props = defineProps<{ active?: string | null }>();

const roles: Role[] = [
  {
    key: "plan",
    title: "Planen & Judge",
    models: "gpt-5.6-sol · fable-5",
    cost: "Preis egal — 1× pro Task",
    freq: 1,
    detailTitle: "Planen & Judge — Premium trotz Kosten, nicht wegen",
    detailText:
      "Niedrigfrequent (1× pro Task) → Kostendruck hier ist irrational. Es existiert kein Benchmark, der Planungsqualität isoliert misst; die Wahl stützt sich auf End-to-End-Spitzen (DeepSWE: sol 73 %, Terminal-Bench 2.1: sol 88,8 %) und HLE als Reasoning-Proxy.",
    ev: "Evidenz: schwach — Proxy-Schluss, kein isolierter Planungs-Benchmark",
  },
  {
    key: "exec",
    title: "Umsetzung",
    models: "gpt-5.6-terra · kimi-k3",
    cost: "~4 €/Task @ ~70 %",
    freq: 3,
    detailTitle: "Umsetzung — der Ort für Kostendruck",
    detailText:
      "DeepSWE v1.1 (ein Harness, CIs): terra 70 % / 4,34 € · kimi-k3 69 % / 4,07 € · luna 67 % / 2,65 €. Gegenbeispiel Sonnet 5 [max]: 54 % für 23,13 € (214k Tokens, 268 Steps) — strikt dominiert. €/Mtok ist nicht die Kostenmetrik, Frugalität ist es.",
    ev: "Evidenz: gut — konsistenter Harness, Konfidenzintervalle ausgewiesen",
  },
  {
    key: "res",
    title: "Recherche",
    models: "sol · kimi-k3",
    cost: "Bulk → billig + frugal",
    freq: 3,
    detailTitle: "Recherche — Front nahe Sättigung",
    detailText:
      "BrowseComp 07/2026: sol 92,2 % · kimi-k3 91,2 % · gpt-5.5-pro 90,1 % — Spitze innerhalb von 2,1 Punkten. Gemini ist dort nicht vorn. Für Bulk-Suche zählt Frugalität mehr als der Spitzenplatz; das genaueste Modell gehört in die Verifikation.",
    ev: "Evidenz: mittel — Benchmark nähert sich der Sättigung",
  },
  {
    key: "ver",
    title: "Verifikation",
    models: "andere Familie (gemini)",
    cost: "Finder ≠ Verifier",
    freq: 2,
    detailTitle: "Verifikation — Diversität schlägt Ranking",
    detailText:
      "Wer findet, verifiziert nicht. Eine andere Modellfamilie teilt nicht dieselben blinden Flecken — das ist der eigentliche Grund für Gemini in diesem Slot, nicht ein Benchmark-Platz. Nichts landet ohne Primärquelle und Zitat in der Wissensbasis.",
    ev: "Evidenz: Prinzip (Quesma-Regeln), kein Benchmark",
  },
  {
    key: "ext",
    title: "Extraktion",
    models: "haiku-4.5 · flash",
    cost: "billigstes brauchbares",
    freq: 4,
    detailTitle: "Extraktion & Formatierung — Massengeschäft",
    detailText:
      "Höchste Frequenz, triviale Aufgaben: billigstes brauchbares Modell (haiku, flash, lokales Qwen). Zu schwach für Multi-Step-Arbeit — dafür sind die anderen Rollen da. Benchmark-Recherche ist hier Zeitverschwendung.",
    ev: "Evidenz: trivial — kein Benchmark nötig",
  },
];

const harnessBullets = [
  [
    "Shared memory",
    "über alle CLIs (claude-mem), sonst zahlst du Kontext doppelt",
  ],
  [
    "run-cli-Wrapper:",
    "Limit-Erkennung per Exit-Code, Fallback auf eigene Modelle",
  ],
  [
    "Modell-Pinning pro Rolle",
    "— Sub-Agenten erben sonst das teure Parent-Modell",
  ],
  ["Zielfunktion klären:", "API-Kosten oder Quota-Arbitrage über Abos"],
];

const override = ref<RoleKey | null>(null);
const sourcesOpen = ref(false);

// Ein $clicks-Schritt übernimmt wieder die Führung nach einem Karten-Klick.
watch(
  () => props.active,
  () => {
    override.value = null;
  },
);

const activeKey = computed(() => override.value ?? props.active ?? null);
const activeRole = computed(
  () => roles.find((r) => r.key === activeKey.value) ?? null,
);
</script>

<template>
  <div class="mr-roles">
    <div class="mr-layout">
      <div class="mr-harness">
        <div class="mr-harness-head">
          <div>
            <div class="mr-harness-title">Orchestrator</div>
            <div class="mr-harness-tag">claude code</div>
          </div>
          <button
            class="mr-ib"
            aria-label="Quellen und Einschränkungen anzeigen"
            @click="sourcesOpen = true"
          >
            ⓘ
          </button>
        </div>
        <ul class="mr-harness-list">
          <li v-for="[lead, rest] in harnessBullets" :key="lead">
            <b>{{ lead }}</b> {{ rest }}
          </li>
        </ul>
      </div>

      <div class="mr-connector" aria-hidden="true">→</div>

      <div class="mr-grid">
        <button
          v-for="r in roles"
          :key="r.key"
          class="mr-card"
          :class="[`role-${r.key}`, { active: r.key === activeKey }]"
          @click="override = r.key"
        >
          <div class="mr-card-head">
            <span class="mr-card-title">{{ r.title }}</span>
            <span class="mr-dot" />
          </div>
          <div class="mr-models">{{ r.models }}</div>
          <div class="mr-cost">{{ r.cost }}</div>
          <div class="mr-freq">
            <span>Frequenz</span>
            <span class="mr-bars">
              <i v-for="n in 4" :key="n" :class="{ on: n <= r.freq }" />
            </span>
          </div>
        </button>

        <div class="mr-card mr-evals">
          <div class="mr-card-head">
            <span class="mr-card-title">Eigene Evals</span>
          </div>
          <div class="mr-models">50–100 Tasks loggen</div>
          <div class="mr-cost">Benchmarks = Prior</div>
        </div>
      </div>
    </div>

    <div class="mr-detail" :class="activeKey ? `role-${activeKey}` : undefined">
      <div class="mr-detail-marker" />
      <div v-if="activeRole">
        <div class="mr-detail-title">{{ activeRole.detailTitle }}</div>
        <p class="mr-detail-text">{{ activeRole.detailText }}</p>
        <div class="mr-detail-ev">{{ activeRole.ev }}</div>
      </div>
      <div v-else>
        <div class="mr-detail-title">Rolle anklicken (oder →-Taste)</div>
        <p class="mr-detail-text">
          Jede Karte zeigt die Begründung der Modellwahl und die Qualität der
          Evidenz dahinter.
        </p>
      </div>
    </div>

    <ModelRoutingSources :open="sourcesOpen" @close="sourcesOpen = false" />
  </div>
</template>

<style scoped>
/* Rollen-Akzente auf die Deck-Töne gemappt (Light Pergament / Dark Neon
   folgen automatisch aus style.css). */
.role-plan {
  --role: var(--color-text-info);
}
.role-exec {
  --role: var(--color-text-success);
}
.role-res {
  --role: var(--color-text-warning);
}
.role-ver {
  --role: var(--color-text-danger);
}
.role-ext {
  --role: var(--color-text-secondary);
}

.mr-roles {
  margin-top: 6px;
}
.mr-layout {
  display: grid;
  grid-template-columns: 224px 22px 1fr;
  align-items: stretch;
}

.mr-harness {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 12px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 10px;
}
.mr-harness-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.mr-harness-title {
  font-size: 13px;
  font-weight: 600;
}
.mr-harness-tag {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  color: var(--slidev-theme-primary);
}
.mr-ib {
  padding: 0 2px;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.mr-ib:hover {
  color: var(--color-text-primary);
}
.mr-harness-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mr-harness-list li {
  position: relative;
  padding-left: 12px;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--color-text-secondary);
}
.mr-harness-list li::before {
  content: "→";
  position: absolute;
  left: 0;
  color: var(--color-text-tertiary);
}
.mr-harness-list b {
  font-weight: 600;
  color: var(--color-text-primary);
}

.mr-connector {
  align-self: center;
  font-size: 14px;
  text-align: center;
  color: var(--color-text-tertiary);
}

.mr-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 7px;
}
.mr-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 9px;
  text-align: left;
  font-family: inherit;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.12s;
}
.mr-card:hover {
  border-color: var(--color-border-primary);
}
.mr-card.active {
  border-color: var(--role);
  box-shadow: inset 0 0 0 1px var(--role);
}
.mr-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.mr-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.mr-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--role);
}
.mr-models {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  line-height: 1.4;
  color: var(--color-text-secondary);
}
.mr-cost {
  align-self: flex-start;
  padding: 1px 6px;
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 9.5px;
  color: var(--role, var(--color-text-secondary));
  background: color-mix(
    in srgb,
    var(--role, var(--color-text-tertiary)) 12%,
    transparent
  );
  border-radius: 4px;
}
.mr-freq {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: auto;
}
.mr-freq span:first-child {
  font-size: 9px;
  color: var(--color-text-tertiary);
}
.mr-bars {
  display: flex;
  gap: 2px;
}
.mr-bars i {
  width: 9px;
  height: 4px;
  border-radius: 1px;
  background: var(--color-border-tertiary);
}
.mr-bars i.on {
  background: var(--role);
}
.mr-evals {
  border-style: dashed;
  cursor: default;
}
.mr-evals .mr-card-title,
.mr-evals .mr-models {
  color: var(--color-text-tertiary);
}
.mr-evals .mr-cost {
  color: var(--color-text-tertiary);
  background: color-mix(in srgb, var(--color-text-tertiary) 10%, transparent);
}

.mr-detail {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-height: 84px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 10px;
}
.mr-detail-marker {
  flex-shrink: 0;
  align-self: stretch;
  width: 4px;
  border-radius: 2px;
  background: var(--role, var(--color-border-tertiary));
}
.mr-detail-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.mr-detail-text {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--color-text-secondary);
}
.mr-detail-ev {
  margin-top: 3px;
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10px;
  font-weight: 600;
  color: var(--role, var(--color-text-tertiary));
}
</style>
