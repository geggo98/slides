<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";
import ClinejectionStepCard from "./ClinejectionStepCard.vue";
import { STEPS } from "./data";

const { isDark } = useDarkMode();

const P = computed(() =>
  isDark.value
    ? {
        textPrimary: "#e5e5e5",
        textSecondary: "#aaa",
        textTertiary: "#666",
        textDanger: "#f06060",
        textWarning: "#e0a030",
        bgSecondary: "#2a2a2e",
        borderTertiary: "rgba(255,255,255,0.12)",
        connectorColor: "rgba(255,255,255,0.08)",
        fontSans: "'DM Sans', sans-serif",
        fontMono: "'Fira Code', 'JetBrains Mono', monospace",
        statBg: "#2a2a2e",
      }
    : {
        textPrimary: "#1a1a18",
        textSecondary: "#555",
        textTertiary: "#888",
        textDanger: "#c04040",
        textWarning: "#a07020",
        bgSecondary: "#f5f5f5",
        borderTertiary: "rgba(0,0,0,0.1)",
        connectorColor: "rgba(0,0,0,0.06)",
        fontSans: "'DM Sans', sans-serif",
        fontMono: "'Fira Code', 'JetBrains Mono', monospace",
        statBg: "#f5f5f5",
      },
);

const activeStep = ref(null);

function toggleStep(id) {
  activeStep.value = activeStep.value === id ? null : id;
}

const STATS = [
  ["~4.000", "Downloads"],
  ["8 Std.", "Exposure-Fenster"],
  ["5", "Verkettete Schwachstellen"],
  ["47 Tage", "Disclosure \u2192 Angriff"],
  ["14 Min.", "Erkennungszeit"],
];
</script>

<template>
  <div class="attack-chain">
    <div class="intro">
      <span class="ghsa">GHSA-9PPG-JX86-FQW7</span>
      <span class="separator">&middot;</span>
      <span class="subtitle">
        Ein GitHub-Issue-Titel kompromittiert eine KI-gest&uuml;tzte
        CI/CD-Pipeline &rarr;
        <code class="pkg">cline@2.3.0</code> mit OpenClaw als Payload
      </span>
    </div>

    <div class="stats">
      <div v-for="[val, label] in STATS" :key="label" class="stat">
        <span class="stat-val">{{ val }}</span>
        <span class="stat-label">{{ label }}</span>
      </div>
    </div>

    <div class="chain-scroll">
      <template v-for="(step, i) in STEPS" :key="step.id">
        <ClinejectionStepCard
          :step="step"
          :index="i"
          :active="activeStep === step.id"
          @toggle="toggleStep"
        />
        <div v-if="i < STEPS.length - 1" class="connector" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.attack-chain {
  font-family: v-bind("P.fontSans");
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 430px;
  overflow-y: auto;
}
.intro {
  font-size: 10px;
  color: v-bind("P.textSecondary");
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.ghsa {
  font-family: v-bind("P.fontMono");
  font-size: 9px;
  font-weight: 600;
  color: v-bind("P.textTertiary");
  letter-spacing: 0.5px;
}
.separator {
  color: v-bind("P.textTertiary");
}
.subtitle {
  line-height: 1.4;
}
.pkg {
  font-family: v-bind("P.fontMono");
  font-size: 9px;
  color: v-bind("P.textWarning");
  background: v-bind("P.statBg");
  padding: 0 4px;
  border-radius: 3px;
}
.stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.stat {
  display: flex;
  flex-direction: column;
  background: v-bind("P.statBg");
  border-radius: 6px;
  padding: 4px 8px;
  min-width: 80px;
}
.stat-val {
  font-size: 14px;
  font-weight: 700;
  color: v-bind("P.textPrimary");
}
.stat-label {
  font-size: 8px;
  color: v-bind("P.textTertiary");
  letter-spacing: 0.3px;
}
.chain-scroll {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.connector {
  width: 2px;
  height: 10px;
  background: v-bind("P.connectorColor");
  margin: 0 auto;
  border-radius: 1px;
}
</style>
