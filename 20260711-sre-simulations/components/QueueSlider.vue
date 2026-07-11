<script setup>
/**
 * QueueSlider.vue — beschrifteter Range-Slider, geteilt von MM1Simulator und
 * MMcCompare. Emittiert `update:modelValue` als **Number** (range liefert sonst
 * String). Wert-Anzeige rechts, Accent adaptiv.
 */
import { computed } from "vue";
import { useScopeColors } from "./lib/useScopeColors";

const props = defineProps({
  label: { type: String, default: "" },
  modelValue: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 0.01 },
  unit: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);
const C = useScopeColors();

const display = computed(() => {
  const v = props.modelValue;
  return v % 1 !== 0 ? v.toFixed(2) : String(v);
});
function onInput(e) {
  emit("update:modelValue", parseFloat(e.target.value));
}
</script>

<template>
  <div class="qs" :style="{ '--qs-accent': C.phosphor }">
    <div class="qs-row">
      <span class="qs-label" :style="{ color: C.textMid }">{{ label }}</span>
      <span class="qs-val" :style="{ color: C.textHi }"
        >{{ display }}{{ unit }}</span
      >
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.qs {
  font-family: var(--slidev-code-font-family);
}
.qs-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 4px;
}
.qs-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qs-val {
  white-space: nowrap;
}
.qs input[type="range"] {
  width: 100%;
  accent-color: var(--qs-accent);
}
</style>
