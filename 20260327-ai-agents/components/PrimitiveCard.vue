<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const props = defineProps({
  icon: { type: String, default: "" },
  name: { type: String, required: true },
  analogy: { type: String, default: "" },
  purpose: { type: String, default: "" },
  type: { type: String, default: "" },
  context: { type: String, default: "" },
  bg: { type: String, default: "#EEEDFE" },
  color: { type: String, default: "#3C3489" },
  typeBg: { type: String, default: "#FAEEDA" },
  typeColor: { type: String, default: "#633806" },
  when: { type: String, default: "" },
  whenNot: { type: String, default: "" },
});

const P = computed(() => {
  const d = isDark.value;
  return {
    cardBg: d ? "#1e1e1e" : "white",
    cardBorder: d ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    cardColor: d ? "#e5e5e5" : "#1a1a18",
    hoverBorder: d ? "#aaa" : "#888",
    titleColor: d ? "#e5e5e5" : "#1a1a18",
    analogyColor: d ? "#aaa" : "#888",
    purposeColor: d ? "#999" : "#5f5e5a",
    neutralBg: d ? "#2a2a2e" : "#f3f2ee",
    neutralColor: d ? "#999" : "#5f5e5a",
    detailBg: d ? "#2a2a2e" : "#f3f2ee",
    detailColor: d ? "#e5e5e5" : "#1a1a18",
    strongColor: d ? "#e5e5e5" : "#1a1a18",
  };
});

const open = ref(false);
</script>

<template>
  <div class="prim-card" :class="{ open }" @click="open = !open">
    <div class="prim-header">
      <div class="prim-icon" :style="{ background: bg, color }">{{ icon }}</div>
      <div>
        <div class="prim-title">{{ name }}</div>
        <div class="prim-analogy">{{ analogy }}</div>
      </div>
    </div>
    <div class="prim-purpose">{{ purpose }}</div>
    <div class="prim-badges">
      <span
        class="prim-badge"
        :style="{ background: typeBg, color: typeColor }"
        >{{ type }}</span
      >
      <span class="prim-badge neutral">{{ context }}</span>
    </div>
    <div v-if="open" class="prim-detail">
      <div class="prim-detail-section">
        <strong>Wann verwenden</strong>
        <p v-html="when" />
      </div>
      <div class="prim-detail-section">
        <strong>Wann NICHT</strong>
        <p v-html="whenNot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.prim-card {
  background: v-bind("P.cardBg");
  border: 1px solid v-bind("P.cardBorder");
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.2s;
  color: v-bind("P.cardColor");
}
.prim-card:hover {
  border-color: v-bind("P.hoverBorder");
}
.prim-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.prim-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.prim-title {
  font-size: 11px;
  font-weight: 600;
  color: v-bind("P.titleColor");
}
.prim-analogy {
  font-size: 9px;
  color: v-bind("P.analogyColor");
}
.prim-purpose {
  font-size: 9px;
  color: v-bind("P.purposeColor");
  line-height: 1.3;
}
.prim-badges {
  margin-top: 3px;
}
.prim-badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 6px;
  margin-right: 2px;
}
.prim-badge.neutral {
  background: v-bind("P.neutralBg");
  color: v-bind("P.neutralColor");
}
.prim-detail {
  margin-top: 6px;
  padding: 6px 8px;
  background: v-bind("P.detailBg");
  border-radius: 6px;
  font-size: 9px;
  line-height: 1.4;
  color: v-bind("P.detailColor");
}
.prim-detail-section {
  margin-bottom: 4px;
}
.prim-detail-section:last-child {
  margin-bottom: 0;
}
.prim-detail-section strong {
  font-size: 9px;
  display: block;
  margin-bottom: 1px;
  color: v-bind("P.strongColor");
}
</style>
