<script setup>
import { ref, computed } from "vue";
import { useDarkMode } from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import Callout from "@shared/components/Callout.vue";
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
// Slidevs eigene Mermaid-Pipeline (Singleton-Init, Cache, ShadowRoot) statt eines
// handgerollten Wrappers — Letzterer zog `mermaid` als bare-specifier (dayjs-UMD,
// kein ESM-default) und ließ das ganze Deck nicht mehr laden. Erwartet
// lz-komprimierten Code (`codeLz`). Zum #333-Crash in WebKit siehe `mermaidThemeVars`.
import Mermaid from "@slidev/client/builtin/Mermaid.vue";
import lz from "lz-string";
import { PATTERNS } from "./slide-data.ts";

// Tab-Block „Original vs. moderne Entsprechung". Entweder direkt `:tabs`
// übergeben oder per `name` aus der PATTERNS-Registry in slide-data.ts ziehen.
// tab = { label, code, language?, annotations?, note?, callout?, height? }
// Alternativ statt `code` ein Diagramm-Tab:
// tab = { label, note?, diagrams: [{ title, code }], caveat?, callout? }
const props = defineProps({
  name: { type: String, default: "" },
  tabs: { type: Array, default: null },
});

const tabs = computed(() => props.tabs ?? PATTERNS[props.name]?.tabs ?? []);
// Shared Tabs adressiert Tabs über String-Keys, die Pattern-Daten sind
// index-basiert — der Index dient als Key.
const tabDefs = computed(() =>
  tabs.value.map((t, i) => ({ key: String(i), label: t.label })),
);
const active = ref("0");
const current = computed(() => tabs.value[Number(active.value)] ?? {});

// Mermaid-Quelltext für Slidevs <Mermaid> base64-lz-komprimieren.
const toLz = (code) => lz.compressToBase64(code);

// Apple WebKit (Orion) crasht khroma mit „Unsupported color format: #333": mermaids
// DARK-Theme ruft schon im Konstruktor `invert(this.background="#333")` auf — VOR
// jedem themeVariables-Override, also nicht patchbar. Lösung: immer das (crash-freie)
// `default`-Theme erzwingen (siehe `theme="default"` an <Mermaid>) und Dark-Mode
// vollständig über ein 6-stelliges themeVariables-Palette nachbilden. Light braucht
// nur die zwei 3-stelligen Default-Literale in 6-stellig (Format, identische Farbe).
const { isDark } = useDarkMode();
const mermaidThemeVars = computed(() =>
  isDark.value
    ? {
        background: "#1b1f27",
        mainBkg: "#252a34",
        primaryColor: "#252a34",
        primaryBorderColor: "#4a5160",
        primaryTextColor: "#e2e8f0",
        lineColor: "#8b93a3",
        textColor: "#e2e8f0",
        // Sequenzdiagramm-spezifisch
        actorBkg: "#252a34",
        actorBorder: "#4a5160",
        actorTextColor: "#e2e8f0",
        actorLineColor: "#8b93a3",
        signalColor: "#b9c0cc",
        signalTextColor: "#cdd3dd",
        labelBoxBkgColor: "#252a34",
        labelBoxBorderColor: "#4a5160",
        labelTextColor: "#e2e8f0",
        loopTextColor: "#e2e8f0",
        noteBkgColor: "#3a3f2a",
        noteBorderColor: "#5f6a33",
        noteTextColor: "#f0ecd0",
        activationBkgColor: "#2f3540",
        activationBorderColor: "#566070",
        sequenceNumberColor: "#1b1f27",
      }
    : {
        textColor: "#333333", // war #333 (Format-Fix)
        activationBorderColor: "#666666", // war #666 (Format-Fix)
      },
);
</script>

<template>
  <div class="pt-wrap">
    <Tabs v-model="active" :tabs="tabDefs" aria-label="Pattern-Varianten">
      <div :key="active" class="panel">
        <p v-if="current.note" class="lead" v-html="current.note" />
        <div v-if="current.diagrams" class="diagram-grid">
          <figure
            v-for="(d, i) in current.diagrams"
            :key="i"
            class="diagram-col"
          >
            <figcaption v-if="d.title" v-html="d.title" />
            <Mermaid
              :key="isDark ? 'dark' : 'light'"
              :code-lz="toLz(d.code)"
              theme="default"
              v-bind="{ themeVariables: mermaidThemeVars }"
            />
          </figure>
        </div>
        <MonacoBlockAnnotated
          v-else
          :code="current.code"
          :language="current.language || 'java'"
          :height="current.height || '300px'"
          :annotations="current.annotations || []"
          show-language-badge
        />
        <Callout v-if="current.caveat" tone="warning" dense class="pt-caveat">
          <span v-html="current.caveat" />
        </Callout>
        <Callout v-if="current.callout" tone="info" dense class="pt-callout">
          <span v-html="current.callout" />
        </Callout>
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
.pt-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* Optik der ehemaligen lokalen Tab-Bar 1:1 über die --sk-tab-*-Hooks der
     shared Tabs.vue nachgebildet (visueller No-Op, gleiche Werte wie die
     Migration in 20260522-open-rewrite). */
  --sk-tab-gap: 6px;
  --sk-tab-bar-mb: 10px;
  --sk-tab-bar-pb: 8px;
  --sk-tab-bar-border-bottom: 0.5px solid var(--color-border-tertiary);
  /* Kein CSS-wide-Keyword (inherit) — das fiele auf den 500er-Fallback
     zurück; die alte Bar erbte das normale Gewicht via `font: inherit`. */
  --sk-tab-font-weight: 400;
  --sk-tab-pad: 6px 12px;
  --sk-tab-border: 0.5px solid var(--color-border-tertiary);
  --sk-tab-radius: var(--sk-rad);
  --sk-tab-hover-bg: transparent;
  --sk-tab-transition: none;
  --sk-tab-active-bg: var(--color-background-info);
  --sk-tab-active-color: var(--color-text-info);
  --sk-tab-active-border: var(--color-border-info);
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lead {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}
.lead :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-secondary);
  padding: 1px 5px;
  border-radius: 3px;
}
.diagram-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}
.diagram-col {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.diagram-col figcaption {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
}
.diagram-col figcaption :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-secondary);
  padding: 1px 5px;
  border-radius: 3px;
}
.diagram-col :deep(.mermaid) {
  display: flex;
  justify-content: center;
}
.diagram-col :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
}
/* Shared Callout liefert Ton & Akzent (caveat → warning, callout → info);
   die kompaktere Deck-Textmetrik (12/12.5px statt 14px) bleibt erhalten,
   sonst wachsen die Boxen auf den dichten Code-Folien in den Overflow.
   .sk-callout dazu, um die Schriftgröße der shared Komponente zu schlagen. */
.sk-callout.pt-caveat {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}
.sk-callout.pt-callout {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}
.pt-caveat :deep(strong),
.pt-callout :deep(strong) {
  color: var(--color-text-primary);
  font-weight: 500;
}
.pt-caveat :deep(code),
.pt-callout :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-primary);
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
