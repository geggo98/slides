<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import MonacoBlock from "./MonacoBlock.vue";

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, default: "java" },
  height: { type: String, default: "320px" },
  annotations: { type: Array, default: () => [] },
  editorOptions: { type: Object, default: () => ({}) },
  defaultDetail: { type: [String, Number, null], default: null },
  showLanguageBadge: { type: Boolean, default: false },
  badgePosition: { type: String, default: "top-right" },
});

const emit = defineEmits(["activate"]);

const TONES = ["info", "success", "warning", "danger"];

const normalized = computed(() =>
  props.annotations.map((a, i) => {
    const range = Array.isArray(a.lines) ? a.lines : [a.lines, a.lines];
    const tone = TONES.includes(a.tone) ? a.tone : "info";
    return {
      id: a.id ?? `ann-${i}`,
      startLine: range[0],
      endLine: range[1],
      label: a.label ?? "",
      detail: a.detail ?? null,
      tone,
    };
  }),
);

// Hinweis nur zeigen, wenn es echt klickbare Annotationen MIT Details gibt.
// klickbar = hat ein `label` (nur dann wird eine View-Zone erzeugt, s. u.);
// nützlich  = hat ein `detail` (nur dann erscheint beim Klick ein Panel).
const hasClickableDetails = computed(() =>
  normalized.value.some((a) => a.label && a.detail),
);

const activeId = ref(props.defaultDetail);

const currentDetail = computed(() => {
  if (activeId.value == null) return null;
  const ann = normalized.value.find((a) => a.id === activeId.value);
  return ann?.detail ? { ...ann.detail, tone: ann.tone } : null;
});

let editor = null;
let monaco = null;
let decoCollection = null;
let viewZoneIds = [];
let scrollSub = null;

// Höhe der 💡-View-Zone (s. applyAnnotations: heightInPx). Die Zone sitzt
// ÜBER der Startzeile, die visuelle Oberkante der Annotation liegt also um
// diesen Betrag höher als der Top der Startzeile.
const VIEWZONE_H = 20;

// Template-Ref auf das Detail-Popup + reaktive Inline-Styles für die
// Positionierung (oberhalb der Annotation, s. positionDetail).
const detailEl = ref(null);
const detailStyle = ref({});
const arrowStyle = ref({});
const arrowDir = ref("down"); // "down" = oberhalb mit Pfeil, "none" = Overlap

function classFor(tone, kind) {
  return `ann-${kind} ann-tone-${tone}`;
}

function applyAnnotations() {
  if (!editor || !monaco) return;
  const decos = [];
  for (const ann of normalized.value) {
    const { startLine, endLine, tone, id } = ann;
    if (startLine === endLine) {
      decos.push({
        range: new monaco.Range(startLine, 1, startLine, 1),
        options: {
          isWholeLine: true,
          className: `${classFor(tone, "block-single")} ann-id-${id}`,
        },
      });
    } else {
      decos.push({
        range: new monaco.Range(startLine, 1, startLine, 1),
        options: {
          isWholeLine: true,
          className: `${classFor(tone, "block-top")} ann-id-${id}`,
        },
      });
      for (let i = startLine + 1; i < endLine; i++) {
        decos.push({
          range: new monaco.Range(i, 1, i, 1),
          options: {
            isWholeLine: true,
            className: `${classFor(tone, "block-mid")} ann-id-${id}`,
          },
        });
      }
      decos.push({
        range: new monaco.Range(endLine, 1, endLine, 1),
        options: {
          isWholeLine: true,
          className: `${classFor(tone, "block-bottom")} ann-id-${id}`,
        },
      });
    }
  }
  decoCollection?.clear();
  decoCollection = editor.createDecorationsCollection(decos);

  editor.changeViewZones((accessor) => {
    viewZoneIds.forEach((id) => accessor.removeZone(id));
    viewZoneIds = [];
    for (const ann of normalized.value) {
      if (!ann.label) continue;
      const dom = document.createElement("div");
      dom.className = `ann-viewzone-label ann-tone-${ann.tone}`;
      dom.textContent = `\u{1F4A1} ${ann.label}`;
      dom.dataset.id = ann.id;
      dom.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDetail(ann.id);
      });
      const id = accessor.addZone({
        afterLineNumber: ann.startLine - 1,
        heightInPx: 20,
        domNode: dom,
      });
      viewZoneIds.push(id);
    }
  });
}

function toggleDetail(id) {
  activeId.value = activeId.value === id ? null : id;
  emit("activate", activeId.value);
}

function closeDetail() {
  activeId.value = null;
  emit("activate", null);
}

const clamp = (lo, v, hi) => Math.min(Math.max(lo, v), hi);

// Positioniert das Detail-Popup als Sprechblase OBERHALB der aktiven
// Annotation (Pfeil zeigt nach unten auf sie). Reicht der Platz oberhalb nicht,
// wird oben angepinnt und überlappt Annotation/Code (dann ohne Pfeil).
function positionDetail() {
  if (!editor || activeId.value == null || !detailEl.value) return;
  const ann = normalized.value.find((a) => a.id === activeId.value);
  if (!ann) return;

  const stage = detailEl.value.parentElement; // .mba-stage
  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  const GAP = 8;
  const MARGIN = 6;
  const ARROW = 7;

  // Stage-relative Position der Startzeile; null, wenn rausgescrollt.
  const pos = editor.getScrolledVisiblePosition({
    lineNumber: ann.startLine,
    column: 1,
  });
  const annTop = pos ? Math.max(0, pos.top - VIEWZONE_H) : null;
  const annLeft = pos ? pos.left : MARGIN;

  const h = detailEl.value.offsetHeight;
  const w = detailEl.value.offsetWidth;

  // Vertikal: bevorzugt komplett oberhalb der Annotation.
  let top = annTop == null ? MARGIN : annTop - GAP - ARROW - h;
  let dir = "down";
  if (top < MARGIN) {
    // Zu wenig Platz oben → oben anpinnen, Annotation/Code überlappen.
    top = MARGIN;
    dir = "none";
  }

  // Horizontal: Box an der Annotation ausrichten, im Stage halten.
  const left = clamp(
    MARGIN,
    annLeft - 16,
    Math.max(MARGIN, stageW - w - MARGIN),
  );

  detailStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    maxHeight: `${stageH - 2 * MARGIN}px`,
  };
  // Pfeilspitze (translateX(-50%)) auf den Annotations-Anker, in der Box halten.
  arrowStyle.value = {
    left: `${clamp(2 * ARROW, annLeft - left, w - 2 * ARROW)}px`,
  };
  arrowDir.value = dir;
}

// Jeder Klick schließt — Label-Klicks rufen e.stopPropagation() (s.
// applyAnnotations) und erreichen diesen Listener nicht, Öffnen/Wechseln
// bleibt also intakt.
function onDocClick() {
  if (activeId.value != null) closeDetail();
}

function onKey(e) {
  if (e.key === "Escape" && activeId.value != null) closeDetail();
}

function onResize() {
  if (activeId.value != null) nextTick(positionDetail);
}

function onReady(payload) {
  editor = payload.editor;
  monaco = payload.monaco;
  applyAnnotations();
  scrollSub = editor.onDidScrollChange(() => {
    if (activeId.value != null) positionDetail();
  });
  // defaultDetail kann das Popup schon vor Editor-Bereitschaft aktiv haben.
  if (activeId.value != null) nextTick(positionDetail);
}

watch(
  () => props.annotations,
  () => applyAnnotations(),
  { deep: true },
);

watch(activeId, (id) => {
  if (id != null) nextTick(positionDetail);
});

onMounted(() => {
  document.addEventListener("click", onDocClick);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  scrollSub?.dispose();
  decoCollection?.clear();
  viewZoneIds = [];
});
</script>

<template>
  <div class="mba">
    <div v-if="hasClickableDetails" class="mba-hint">
      <span class="dot" />
      &#x1F4A1; Annotationen sind klickbar und zeigen Details
    </div>
    <div class="mba-stage" :style="{ height }">
      <MonacoBlock
        :code="code"
        :language="language"
        :height="height"
        :editor-options="editorOptions"
        :show-language-badge="showLanguageBadge"
        :badge-position="badgePosition"
        @ready="onReady"
      />
      <div
        v-if="currentDetail"
        ref="detailEl"
        :class="[
          'mba-detail',
          `ann-tone-${currentDetail.tone}`,
          { 'mba-overlap': arrowDir === 'none' },
        ]"
        :style="detailStyle"
      >
        <div class="mba-detail-title">{{ currentDetail.title }}</div>
        <div class="mba-detail-body" v-html="currentDetail.body" />
        <slot name="detail" :detail="currentDetail" />
        <span
          v-if="arrowDir === 'down'"
          class="mba-detail-arrow"
          :style="arrowStyle"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mba {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mba-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-background-info);
  border: 0.5px solid var(--color-border-info);
  flex-shrink: 0;
}
.mba-stage {
  position: relative;
}
.mba-detail {
  position: absolute;
  /* top/left/max-height kommen inline aus positionDetail() */
  width: max-content;
  max-width: min(60%, 30rem);
  overflow-y: auto;
  z-index: 30;
  padding: 10px 14px;
  border-radius: var(--sk-rad);
  border: 0.5px solid var(--color-border-tertiary);
  font-size: 13px;
  line-height: 1.55;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.22);
}
/* Nach unten zeigender Pfeil — gefülltes Dreieck in der Tone-Hintergrundfarbe.
   Farbe pro Tone weiter unten gesetzt. */
.mba-detail-arrow {
  position: absolute;
  bottom: -7px;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid transparent;
}
.mba-detail-title {
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 13px;
}
.mba-detail.ann-tone-info {
  background: var(--color-background-info);
  border-color: var(--color-border-info);
}
.mba-detail.ann-tone-success {
  background: var(--color-background-success);
  border-color: var(--color-border-success);
}
.mba-detail.ann-tone-warning {
  background: var(--color-background-warning);
  border-color: var(--color-border-warning);
}
.mba-detail.ann-tone-danger {
  background: var(--color-background-danger);
  border-color: var(--color-border-danger);
}
.mba-detail.ann-tone-info .mba-detail-arrow {
  border-top-color: var(--color-background-info);
}
.mba-detail.ann-tone-success .mba-detail-arrow {
  border-top-color: var(--color-background-success);
}
.mba-detail.ann-tone-warning .mba-detail-arrow {
  border-top-color: var(--color-background-warning);
}
.mba-detail.ann-tone-danger .mba-detail-arrow {
  border-top-color: var(--color-background-danger);
}
</style>

<!-- Global styles for Monaco decorations (cannot be scoped) -->
<style>
.ann-block-top.ann-tone-info,
.ann-block-mid.ann-tone-info,
.ann-block-bottom.ann-tone-info,
.ann-block-single.ann-tone-info {
  background: var(--color-background-info) !important;
}
.ann-block-top.ann-tone-success,
.ann-block-mid.ann-tone-success,
.ann-block-bottom.ann-tone-success,
.ann-block-single.ann-tone-success {
  background: var(--color-background-success) !important;
}
.ann-block-top.ann-tone-warning,
.ann-block-mid.ann-tone-warning,
.ann-block-bottom.ann-tone-warning,
.ann-block-single.ann-tone-warning {
  background: var(--color-background-warning) !important;
}
.ann-block-top.ann-tone-danger,
.ann-block-mid.ann-tone-danger,
.ann-block-bottom.ann-tone-danger,
.ann-block-single.ann-tone-danger {
  background: var(--color-background-danger) !important;
}

.ann-block-top.ann-tone-info {
  box-shadow:
    inset 0 2px 0 var(--color-border-info),
    inset 2px 0 0 var(--color-border-info),
    inset -2px 0 0 var(--color-border-info) !important;
}
.ann-block-mid.ann-tone-info {
  box-shadow:
    inset 2px 0 0 var(--color-border-info),
    inset -2px 0 0 var(--color-border-info) !important;
}
.ann-block-bottom.ann-tone-info {
  box-shadow:
    inset 0 -2px 0 var(--color-border-info),
    inset 2px 0 0 var(--color-border-info),
    inset -2px 0 0 var(--color-border-info) !important;
}
.ann-block-single.ann-tone-info {
  box-shadow:
    inset 0 2px 0 var(--color-border-info),
    inset 0 -2px 0 var(--color-border-info),
    inset 2px 0 0 var(--color-border-info),
    inset -2px 0 0 var(--color-border-info) !important;
}

.ann-block-top.ann-tone-success {
  box-shadow:
    inset 0 2px 0 var(--color-border-success),
    inset 2px 0 0 var(--color-border-success),
    inset -2px 0 0 var(--color-border-success) !important;
}
.ann-block-mid.ann-tone-success {
  box-shadow:
    inset 2px 0 0 var(--color-border-success),
    inset -2px 0 0 var(--color-border-success) !important;
}
.ann-block-bottom.ann-tone-success {
  box-shadow:
    inset 0 -2px 0 var(--color-border-success),
    inset 2px 0 0 var(--color-border-success),
    inset -2px 0 0 var(--color-border-success) !important;
}
.ann-block-single.ann-tone-success {
  box-shadow:
    inset 0 2px 0 var(--color-border-success),
    inset 0 -2px 0 var(--color-border-success),
    inset 2px 0 0 var(--color-border-success),
    inset -2px 0 0 var(--color-border-success) !important;
}

.ann-block-top.ann-tone-warning {
  box-shadow:
    inset 0 2px 0 var(--color-border-warning),
    inset 2px 0 0 var(--color-border-warning),
    inset -2px 0 0 var(--color-border-warning) !important;
}
.ann-block-mid.ann-tone-warning {
  box-shadow:
    inset 2px 0 0 var(--color-border-warning),
    inset -2px 0 0 var(--color-border-warning) !important;
}
.ann-block-bottom.ann-tone-warning {
  box-shadow:
    inset 0 -2px 0 var(--color-border-warning),
    inset 2px 0 0 var(--color-border-warning),
    inset -2px 0 0 var(--color-border-warning) !important;
}
.ann-block-single.ann-tone-warning {
  box-shadow:
    inset 0 2px 0 var(--color-border-warning),
    inset 0 -2px 0 var(--color-border-warning),
    inset 2px 0 0 var(--color-border-warning),
    inset -2px 0 0 var(--color-border-warning) !important;
}

.ann-block-top.ann-tone-danger {
  box-shadow:
    inset 0 2px 0 var(--color-border-danger),
    inset 2px 0 0 var(--color-border-danger),
    inset -2px 0 0 var(--color-border-danger) !important;
}
.ann-block-mid.ann-tone-danger {
  box-shadow:
    inset 2px 0 0 var(--color-border-danger),
    inset -2px 0 0 var(--color-border-danger) !important;
}
.ann-block-bottom.ann-tone-danger {
  box-shadow:
    inset 0 -2px 0 var(--color-border-danger),
    inset 2px 0 0 var(--color-border-danger),
    inset -2px 0 0 var(--color-border-danger) !important;
}
.ann-block-single.ann-tone-danger {
  box-shadow:
    inset 0 2px 0 var(--color-border-danger),
    inset 0 -2px 0 var(--color-border-danger),
    inset 2px 0 0 var(--color-border-danger),
    inset -2px 0 0 var(--color-border-danger) !important;
}

.ann-viewzone-label {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-tertiary);
  padding: 2px 8px 0 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 18px;
  pointer-events: auto !important;
  position: relative;
  z-index: 10;
  transition: color 0.15s;
}
.ann-viewzone-label:hover {
  color: var(--color-text-info);
}
.ann-viewzone-label.ann-tone-success:hover {
  color: var(--color-text-success);
}
.ann-viewzone-label.ann-tone-warning:hover {
  color: var(--color-text-warning);
}
.ann-viewzone-label.ann-tone-danger:hover {
  color: var(--color-text-danger);
}

.mba .monaco-editor .view-zones {
  pointer-events: none !important;
}
.mba .monaco-editor .view-zones > * {
  pointer-events: auto !important;
}
</style>
