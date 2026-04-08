<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const props = defineProps({
  step: { type: Object, required: true },
  index: { type: Number, required: true },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(["toggle"]);

const isDanger = computed(
  () => props.step.phase === "INITIAL ACCESS" || props.step.phase === "IMPACT",
);

const P = computed(() => {
  const d = isDark.value;
  const danger = isDanger.value;
  return {
    cardBg: d ? "#1e1e1e" : "white",
    cardBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    hoverBorder: d ? "#555" : "#aaa",
    textPrimary: d ? "#e5e5e5" : "#1a1a18",
    textSecondary: d ? "#aaa" : "#555",
    textTertiary: d ? "#666" : "#888",
    accentColor: danger
      ? d
        ? "#f06060"
        : "#c04040"
      : d
        ? "#e0a030"
        : "#a07020",
    accentBg: danger
      ? d
        ? "rgba(240,96,96,0.12)"
        : "rgba(192,64,64,0.08)"
      : d
        ? "rgba(224,160,48,0.12)"
        : "rgba(160,112,32,0.08)",
    accentBorder: danger
      ? d
        ? "rgba(240,96,96,0.25)"
        : "rgba(192,64,64,0.25)"
      : d
        ? "rgba(224,160,48,0.25)"
        : "rgba(160,112,32,0.25)",
    activeShadow: danger
      ? d
        ? "rgba(240,96,96,0.08)"
        : "rgba(192,64,64,0.05)"
      : d
        ? "rgba(224,160,48,0.08)"
        : "rgba(160,112,32,0.05)",
    codeBg: d ? "#2a2a2e" : "#f5f5f5",
    prereqBg: d ? "#2a2a2e" : "#f5f5f5",
    prereqBorder: d ? "rgba(224,160,48,0.25)" : "rgba(160,112,32,0.25)",
    fontMono: "'Fira Code', 'JetBrains Mono', monospace",
  };
});

const truncated = computed(() => {
  const t = props.step.detail;
  return t.length > 100 ? t.slice(0, 100) + "\u2026" : t;
});
</script>

<template>
  <div class="step-card" :class="{ active }" @click="emit('toggle', step.id)">
    <div class="step-header">
      <div class="step-meta">
        <span class="step-num">{{ String(index + 1).padStart(2, "0") }}</span>
        <span class="phase-tag">{{ step.phase }}</span>
      </div>
      <span class="step-date">{{ step.date }}</span>
    </div>
    <div class="step-title">
      <span class="step-icon">{{ step.icon }}</span>
      {{ step.title }}
    </div>
    <p class="step-preview">
      {{ active ? "" : truncated }}
      <span v-if="!active" class="toggle-hint">&darr; mehr</span>
    </p>
    <div v-if="active" class="step-detail">
      <p class="step-detail-text">{{ step.detail }}</p>
      <div class="tech-label">Technische Details</div>
      <pre class="tech-block">{{ step.tech }}</pre>
      <div class="prereq-box">
        <span class="prereq-icon">&triangledown;</span>
        <strong>Voraussetzung:</strong> {{ step.prereq }}
      </div>
      <span class="toggle-hint">&uarr; weniger</span>
    </div>
  </div>
</template>

<style scoped>
.step-card {
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-left: 3px solid v-bind("P.accentColor");
  border-radius: 8px;
  padding: 8px 10px 6px 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.step-card:hover {
  border-color: v-bind("P.hoverBorder");
  border-left-color: v-bind("P.accentColor");
}
.step-card.active {
  border-color: v-bind("P.accentBorder");
  border-left-color: v-bind("P.accentColor");
  box-shadow: inset 0 0 20px v-bind("P.activeShadow");
}
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.step-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.step-num {
  font-size: 9px;
  font-weight: 700;
  color: v-bind("P.textTertiary");
  font-family: v-bind("P.fontMono");
}
.phase-tag {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 6px;
  color: v-bind("P.accentColor");
  background: v-bind("P.accentBg");
  border: 1px solid v-bind("P.accentBorder");
  font-family: v-bind("P.fontMono");
}
.step-date {
  font-size: 9px;
  color: v-bind("P.textTertiary");
  font-family: v-bind("P.fontMono");
}
.step-title {
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
  color: v-bind("P.textPrimary");
}
.step-icon {
  margin-right: 4px;
}
.step-preview {
  font-size: 9px;
  color: v-bind("P.textSecondary");
  line-height: 1.4;
  margin-top: 2px;
}
.toggle-hint {
  font-size: 8px;
  color: v-bind("P.accentColor");
  margin-left: 4px;
}
.step-detail {
  margin-top: 6px;
}
.step-detail-text {
  font-size: 10px;
  color: v-bind("P.textSecondary");
  line-height: 1.5;
  margin-bottom: 6px;
}
.tech-label {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: v-bind("P.textTertiary");
  margin-bottom: 3px;
}
.tech-block {
  background: v-bind("P.codeBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 9px;
  line-height: 1.4;
  font-family: v-bind("P.fontMono");
  color: v-bind("P.textSecondary");
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.prereq-box {
  margin-top: 6px;
  padding: 5px 8px;
  background: v-bind("P.prereqBg");
  border: 1px solid v-bind("P.prereqBorder");
  border-radius: 6px;
  font-size: 9px;
  color: v-bind("P.textSecondary");
  line-height: 1.4;
}
.prereq-box strong {
  color: v-bind("P.textPrimary");
}
.prereq-icon {
  color: v-bind("P.accentColor");
  margin-right: 4px;
}
</style>
