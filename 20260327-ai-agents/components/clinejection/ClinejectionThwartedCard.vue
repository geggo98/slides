<script setup>
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const props = defineProps({
  item: { type: Object, required: true },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(["toggle"]);

const P = computed(() => {
  const d = isDark.value;
  return {
    cardBg: d ? "#1e1e1e" : "white",
    cardBorder: d ? "rgba(92,192,160,0.18)" : "rgba(48,128,96,0.18)",
    hoverBorder: d ? "rgba(92,192,160,0.35)" : "rgba(48,128,96,0.35)",
    textPrimary: d ? "#e5e5e5" : "#1a1a18",
    textSecondary: d ? "#aaa" : "#555",
    textDanger: d ? "#f06060" : "#c04040",
    textSuccess: d ? "#5cc0a0" : "#308060",
    bgSuccess: d ? "rgba(92,192,160,0.08)" : "rgba(48,128,96,0.04)",
    badgeBg: d ? "rgba(92,192,160,0.12)" : "rgba(48,128,96,0.08)",
    badgeBorder: d ? "rgba(92,192,160,0.25)" : "rgba(48,128,96,0.25)",
    reasonBg: d ? "rgba(92,192,160,0.08)" : "rgba(48,128,96,0.06)",
    reasonBorder: d ? "rgba(92,192,160,0.2)" : "rgba(48,128,96,0.2)",
  };
});
</script>

<template>
  <div
    class="thwarted-card"
    :class="{ active }"
    @click="emit('toggle', item.id)"
  >
    <div class="thwarted-header">
      <div class="thwarted-title">
        <span class="thwarted-icon">{{ item.icon }}</span>
        {{ item.title }}
      </div>
      <span class="thwarted-badge">VEREITELT</span>
    </div>
    <div class="thwarted-impact">Potenzielle Reichweite: {{ item.impact }}</div>
    <template v-if="active">
      <p class="thwarted-detail">{{ item.detail }}</p>
      <div class="thwarted-reason">
        <span class="reason-check">&check;</span> Verhindert: {{ item.reason }}
      </div>
    </template>
    <span v-else class="toggle-hint">&darr; Details</span>
  </div>
</template>

<style scoped>
.thwarted-card {
  background: v-bind("P.bgSuccess");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.thwarted-card:hover {
  border-color: v-bind("P.hoverBorder");
}
.thwarted-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
}
.thwarted-title {
  font-size: 11px;
  font-weight: 600;
  color: v-bind("P.textPrimary");
}
.thwarted-icon {
  margin-right: 4px;
}
.thwarted-badge {
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 6px;
  flex-shrink: 0;
  color: v-bind("P.textSuccess");
  background: v-bind("P.badgeBg");
  border: 1px solid v-bind("P.badgeBorder");
}
.thwarted-impact {
  font-size: 9px;
  color: v-bind("P.textDanger");
  margin-top: 2px;
}
.thwarted-detail {
  font-size: 9px;
  color: v-bind("P.textSecondary");
  line-height: 1.4;
  margin-top: 4px;
}
.thwarted-reason {
  margin-top: 4px;
  padding: 4px 8px;
  font-size: 9px;
  background: v-bind("P.reasonBg");
  border: 1px solid v-bind("P.reasonBorder");
  border-radius: 6px;
  color: v-bind("P.textSuccess");
}
.reason-check {
  font-weight: 700;
  margin-right: 2px;
}
.toggle-hint {
  font-size: 8px;
  color: v-bind("P.textSuccess");
  margin-top: 2px;
  display: inline-block;
  opacity: 0.7;
}
</style>
