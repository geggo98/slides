<script setup>
/**
 * InfoPopover.vue — (i)-Knopf + Erklär-Popover, geteilt von beiden Sims.
 * Offen-Zustand wird vom Parent gehalten (useInfoPopover): `activeId` = aktuell
 * offene id, `id` = diese. Klick togglet via emit; Klick außerhalb schließt
 * (Parent-Listener prüft `[data-info]`) — daher `data-info` auf Knopf UND Popover.
 */
import { computed, ref, watch, nextTick } from "vue";
import { useScopeColors } from "./lib/useScopeColors";

const props = defineProps({
  id: { type: String, required: true },
  activeId: { type: String, default: null },
  title: { type: String, default: "" },
});
const emit = defineEmits(["toggle"]);
const C = useScopeColors();
const open = computed(() => props.activeId === props.id);

// Auto-Ausrichtung: das Popover öffnet sich immer zur Bildmitte hin — horizontal
// (wächst nach links, wenn der Knopf rechts der Mitte ist, sonst nach rechts) und
// vertikal (nach oben, wenn unterhalb der Mitte, sonst nach unten). Gemessen an
// der Viewport-Position des (i)-Knopfs, daher robust gegen Layout-Änderungen.
const btnEl = ref(null);
const side = ref("left"); // left = wächst nach rechts · right = wächst nach links
const vert = ref("down"); // down = öffnet nach unten · up = öffnet nach oben
watch(open, (v) => {
  if (!v) return;
  nextTick(() => {
    const el = btnEl.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    side.value =
      r.left + r.width / 2 > window.innerWidth / 2 ? "right" : "left";
    vert.value = r.top + r.height / 2 > window.innerHeight / 2 ? "up" : "down";
  });
});
</script>

<template>
  <span class="ip" data-info>
    <button
      ref="btnEl"
      data-info
      type="button"
      class="ip-btn"
      aria-label="Erklärung"
      :style="{
        borderColor: open ? C.theory : C.border,
        background: open ? C.panelHi : 'transparent',
        color: open ? C.theory : C.textLow,
      }"
      @click="emit('toggle')"
    >
      i
    </button>
    <div
      v-if="open"
      data-info
      class="ip-pop"
      :class="[`side-${side}`, `vert-${vert}`]"
      :style="{
        background: C.panelHi,
        borderColor: C.theory,
        color: C.textMid,
      }"
    >
      <div class="ip-title" :style="{ color: C.textHi }">{{ title }}</div>
      <div><slot /></div>
    </div>
  </span>
</template>

<style scoped>
.ip {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  flex: none;
}
.ip-btn {
  width: 16px;
  height: 16px;
  line-height: 14px;
  font-size: 10px;
  font-family: var(--slidev-code-font-family);
  font-style: italic;
  border-radius: 50%;
  border: 1px solid;
  cursor: pointer;
  padding: 0;
  margin-left: 5px;
  flex: none;
}
.ip-pop {
  position: absolute;
  width: 250px;
  z-index: 60;
  border: 1px solid;
  border-radius: 8px;
  padding: 9px 11px;
  font-size: 11px;
  line-height: 1.5;
  text-align: left;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}
.side-left {
  left: 0;
}
.side-right {
  right: 0;
}
.vert-down {
  top: 150%;
}
.vert-up {
  bottom: 150%;
}
.ip-title {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
