<script setup>
/**
 * DrillDownWorkflow.vue — Vertikaler Drill-Down-Fluss als getönte Node-Kette.
 * Ersetzt die ASCII-Art der Korrelations-/Span-Profile-Folien. Optik wie
 * PipelineViz (Farben/Dark-Mode) + DiagnosticFunnel (nummerierte Schritte,
 * Konnektor-Labels, grüne Result-Box).
 *
 * Prop `variant`: "lgtm" (default) — Dashboard → Trace → Logs → Root Cause;
 *                 "pyroscope"      — Dashboard → Trace → Span Profile → Root Cause.
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

const props = defineProps({
  variant: { type: String, default: "lgtm" },
});

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    text: d ? "#e2e8f0" : "#1e293b",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    blue: d ? "#3b82f6" : "#2563eb",
    orange: d ? "#f97316" : "#ea580c",
    purple: d ? "#a855f7" : "#9333ea",
    cyan: d ? "#06b6d4" : "#0891b2",
    green: d ? "#22c55e" : "#16a34a",
  };
});

const PRESETS = {
  lgtm: [
    {
      name: "Dashboard",
      desc: "Anomalie in Metrik (P99-Spike)",
      tool: "Mimir",
      via: "Exemplar-Diamond klicken",
    },
    {
      name: "Trace-View",
      desc: "langsamer Span identifiziert",
      tool: "Tempo",
      via: "Trace-to-Logs klicken",
    },
    { name: "Logs", desc: "Fehlermeldung lesen", tool: "Loki" },
    {
      name: "Root Cause",
      desc: "dieser PostgreSQL-Query ist der Bottleneck",
      result: true,
    },
  ],
  pyroscope: [
    { name: "Dashboard", desc: "P99-Spike", tool: "Mimir" },
    { name: "Trace", desc: "langsamer Span", tool: "Tempo" },
    {
      name: "Span Profile",
      desc: "Hot Function im Flamegraph",
      tool: "Pyroscope",
    },
    { name: "Root Cause", desc: "konkrete Datei:Zeile", result: true },
  ],
};

const rows = computed(() => {
  const palette = [C.value.blue, C.value.orange, C.value.purple, C.value.cyan];
  const list = PRESETS[props.variant] ?? PRESETS.lgtm;
  let k = 0;
  return list.map((s, i) => ({
    ...s,
    color: s.result ? C.value.green : palette[k % palette.length],
    num: s.result ? null : ++k,
    isLast: i === list.length - 1,
  }));
});
</script>

<template>
  <div class="drilldown">
    <template v-for="(r, i) in rows" :key="i">
      <div
        class="dd-node"
        :class="{ 'dd-result': r.result }"
        :style="{
          background: r.color + (r.result ? '1c' : '14'),
          borderColor: r.color + '2e',
        }"
      >
        <span
          class="dd-badge"
          :style="{ background: r.color + '26', color: r.color }"
        >
          <span v-if="r.result">&check;</span>
          <span v-else>{{ r.num }}</span>
        </span>
        <span class="dd-name" :style="{ color: r.color }">{{ r.name }}</span>
        <span class="dd-desc" :style="{ color: C.muted }">{{ r.desc }}</span>
        <span
          v-if="r.tool"
          class="dd-tool"
          :style="{ background: r.color + '1c', color: r.color }"
          >{{ r.tool }}</span
        >
      </div>

      <div v-if="!r.isLast" class="dd-connector">
        <span class="dd-arrow" :style="{ color: C.dim }">&#8595;</span>
        <span v-if="r.via" class="dd-via" :style="{ color: C.muted }">{{
          r.via
        }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.drilldown {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  max-width: 560px;
  margin: 0.4em auto;
  font-family: inherit;
}
.dd-node {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 12px;
  border: 1px solid;
  border-radius: 7px;
}
.dd-badge {
  flex: 0 0 auto;
  width: 19px;
  height: 19px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
}
.dd-name {
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 700;
}
.dd-desc {
  flex: 1 1 auto;
  font-size: 12.5px;
  line-height: 1.25;
}
.dd-tool {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--slidev-code-font-family);
}
.dd-result .dd-name {
  font-size: 14.5px;
}
.dd-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 16px;
}
.dd-arrow {
  font-size: 15px;
  line-height: 1;
}
.dd-via {
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
}
</style>
