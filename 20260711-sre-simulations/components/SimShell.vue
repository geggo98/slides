<script setup>
/**
 * SimShell.vue — gemeinsamer Folien-Rahmen der portierten Simulationen:
 * Header (Eyebrow/Titel · Transport-Slot · ⚙), immer sichtbare Preset-Zeile,
 * Stage-Slot mit ⚙-Overlay für Detail-Regler, optionaler Footer-Streifen
 * (Verdict-Banner). Optik folgt dem 🛠️-Muster des MM1Simulator, damit alte
 * und portierte Sims kohärent aussehen.
 *
 * Presets: [{ key, label, title?, tone? }] — tone: "warn" | "danger" färbt den
 * Rand. Mit v-model wirken sie als exklusive Szenario-Auswahl (aktives Preset
 * hervorgehoben); ohne modelValue sind es reine Aktions-Knöpfe (emit "preset").
 */
import { onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useScopeColors } from "./lib/useScopeColors";

const props = defineProps({
  eyebrow: { type: String, default: "" },
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  presets: { type: Array, default: () => [] },
  presetsLabel: { type: String, default: "" },
  modelValue: { type: String, default: null },
  gearTitle: { type: String, default: "Detail-Regler" },
});
const emit = defineEmits(["update:modelValue", "preset"]);

const C = useScopeColors();
const gearOpen = ref(false);
const gearPanel = ref(null);
const gearBtn = ref(null);

function clickPreset(p) {
  if (props.modelValue !== null) emit("update:modelValue", p.key);
  emit("preset", p.key);
}
function presetStyle(p) {
  const active = props.modelValue !== null && props.modelValue === p.key;
  const border =
    p.tone === "danger"
      ? C.value.red
      : p.tone === "warn"
        ? C.value.amber
        : active
          ? C.value.phosphor
          : C.value.border;
  return {
    background: active ? C.value.panel : C.value.panelHi,
    color: C.value.textHi,
    border: `1px solid ${border}`,
    boxShadow: active ? `inset 0 0 0 1px ${C.value.phosphor}` : "none",
  };
}
function btnStyle(border) {
  return {
    background: C.value.panelHi,
    color: C.value.textHi,
    border: `1px solid ${border}`,
  };
}

/* ⚙-Overlay: schließt auf Escape und Klick außerhalb; Fokus in den Dialog. */
function onKeydown(e) {
  if (e.key === "Escape" && gearOpen.value) {
    gearOpen.value = false;
    gearBtn.value?.focus();
  }
}
function onDocPointerDown(e) {
  if (!gearOpen.value) return;
  const panel = gearPanel.value;
  const btn = gearBtn.value;
  if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target))
    gearOpen.value = false;
}
watch(gearOpen, async (open) => {
  if (open) {
    await nextTick();
    gearPanel.value?.focus();
  }
});
onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onDocPointerDown, true);
});
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("pointerdown", onDocPointerDown, true);
});

defineExpose({ gearOpen });
</script>

<template>
  <div
    class="shell-root"
    :style="{
      '--c-bg': C.bg,
      '--c-panel': C.panel,
      '--c-panelHi': C.panelHi,
      '--c-border': C.border,
      '--c-textHi': C.textHi,
      '--c-textMid': C.textMid,
      '--c-textLow': C.textLow,
      '--c-phosphor': C.phosphor,
    }"
  >
    <!-- Header -->
    <div class="shell-header">
      <div class="shell-titles">
        <div v-if="eyebrow" class="shell-eyebrow">{{ eyebrow }}</div>
        <div class="shell-title">{{ title }}</div>
        <div v-if="subtitle" class="shell-subtitle">{{ subtitle }}</div>
      </div>
      <div class="shell-actions">
        <slot name="transport" />
        <button
          ref="gearBtn"
          class="shell-btn"
          :style="btnStyle(gearOpen ? C.phosphor : C.border)"
          :aria-expanded="gearOpen"
          :title="gearTitle"
          @click="gearOpen = !gearOpen"
        >
          ⚙️
        </button>
      </div>
    </div>

    <!-- Presets: immer sichtbar -->
    <div class="shell-presets">
      <span
        v-if="presetsLabel"
        class="shell-presets-label"
        :style="{ color: C.textLow }"
        >{{ presetsLabel }}</span
      >
      <button
        v-for="p in presets"
        :key="p.key"
        class="shell-preset-btn"
        :style="presetStyle(p)"
        :title="p.title"
        :aria-pressed="modelValue !== null ? modelValue === p.key : undefined"
        @click="clickPreset(p)"
      >
        {{ p.label }}
      </button>
      <slot name="presets-extra" />
    </div>

    <!-- Stage + ⚙-Overlay -->
    <div class="shell-stage">
      <slot name="stage" />
      <div
        v-if="gearOpen"
        ref="gearPanel"
        class="shell-gear"
        role="dialog"
        :aria-label="gearTitle"
        tabindex="-1"
        :style="{ background: C.panel, borderColor: C.border }"
      >
        <div class="shell-gear-head">
          <span :style="{ color: C.textMid }">{{ gearTitle }}</span>
          <button
            class="shell-gear-close"
            :style="{ color: C.textMid }"
            aria-label="Schließen"
            @click="gearOpen = false"
          >
            ✕
          </button>
        </div>
        <slot name="gear" />
      </div>
    </div>

    <!-- Footer (Verdict-Banner etc.) -->
    <div class="shell-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.shell-root {
  background: var(--c-bg);
  color: var(--c-textHi);
  font-family: inherit;
  padding: 8px 12px 8px;
  max-width: 960px;
  margin: 0 auto;
  max-height: 540px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}
.shell-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 5px;
}
.shell-eyebrow {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-textLow);
}
.shell-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.shell-subtitle {
  font-size: 9px;
  color: var(--c-textMid);
  line-height: 1.4;
  max-width: 640px;
}
.shell-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
.shell-btn {
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
}
.shell-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 6px;
}
.shell-presets-label {
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
}
.shell-preset-btn {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.shell-stage {
  position: relative;
  min-height: 0;
}
.shell-gear {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 30;
  min-width: 300px;
  max-width: 420px;
  border: 1px solid;
  border-radius: 10px;
  padding: 10px 14px 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  outline: none;
}
.shell-gear-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  margin-bottom: 8px;
}
.shell-gear-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}
.shell-footer:empty {
  display: none;
}
</style>
