<script setup lang="ts">
/**
 * Query code highlighted at runtime with the deck's own Shiki setup, for
 * strings that live in component data and never pass through a markdown fence
 * (`<pre>{{ query }}</pre>` before).
 *
 * The language has to be registered in the deck's `setup/shiki.ts`
 * (`queryLangs` from `@shared/shiki`). Until the highlighter has loaded, and
 * for an unknown language, the plain text stays — `codeToHtml` would throw.
 *
 * The root is a plain `<div>`: the caller's class (`class="promql-code"`)
 * supplies box, font size and wrapping; the inner `<pre>` only inherits them.
 * Import it explicitly — a shared component is not auto-registered.
 */
import { ref, watchEffect } from "vue";

const props = defineProps<{ code: string; lang: string }>();

const html = ref("");

watchEffect(async (onCleanup) => {
  let stale = false;
  onCleanup(() => (stale = true));
  const { code, lang } = props;
  const setup = await (await import("@slidev/client/setup/shiki.ts")).default();
  if (!setup.languageNames.has(lang)) return;
  const highlighter = await setup.getEagerHighlighter();
  const out = highlighter.codeToHtml(code, {
    ...setup.defaultHighlightOptions,
    lang,
  });
  if (!stale) html.value = out;
});
</script>

<template>
  <div class="query-code">
    <div v-if="html" v-html="html" />
    <pre v-else class="query-code-plain">{{ code }}</pre>
  </div>
</template>

<style scoped>
.query-code :deep(pre),
.query-code-plain {
  margin: 0;
  padding: 0;
  background: transparent !important;
  font: inherit;
  line-height: inherit;
  white-space: pre-wrap;
  word-break: inherit;
}
.query-code :deep(code) {
  font: inherit;
  line-height: inherit;
}
</style>
