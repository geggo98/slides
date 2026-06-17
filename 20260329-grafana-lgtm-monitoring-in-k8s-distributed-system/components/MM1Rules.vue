<script setup>
/**
 * MM1Rules.vue — die „Einschränkungen“ der 80%-Regel und die „Drei Regeln aus
 * der Systemdynamik“. Inhalt aus SystemDynamicsSimulator (Tab 2) hierher
 * verschoben, damit M/M/1 auf einer Folie zusammengeführt werden kann.
 * `part`: "caveats" | "rules" — erlaubt getrenntes Klick-Reveal in der Folie.
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";

defineProps({ part: { type: String, default: "caveats" } });

const { isDark } = useDarkMode();
const C = computed(() => {
  const d = isDark.value;
  return {
    text: d ? "#e2e8f0" : "#1e293b",
    muted: d ? "#94a3b8" : "#64748b",
    blue: d ? "#3b82f6" : "#2563eb",
    green: d ? "#22c55e" : "#16a34a",
    yellow: d ? "#eab308" : "#ca8a04",
    orange: d ? "#f97316" : "#ea580c",
    red: d ? "#ef4444" : "#dc2626",
  };
});

const caveats = computed(() => [
  {
    t: "Bursty Traffic",
    d: "Verschiebt den Knick nach links. Versicherungs-Peaks (November) sind bursty.",
    c: C.value.orange,
  },
  {
    t: "Parallelisierung (M/M/c)",
    d: "200 Tomcat-Threads verschieben den Knick nach rechts (~90–95%), aber der Absturz ist steiler.",
    c: C.value.blue,
  },
  {
    t: "CFS-Throttling",
    d: "Binär, nicht graduell. 80% CPU kann bei Bursts plötzlich 40% Throttling bedeuten.",
    c: C.value.red,
  },
  {
    t: "Trotzdem: 80% ist gut",
    d: "Genug Headroom für Schwankungen. Lieber bei 80% warnen als bei 95% überrascht werden.",
    c: C.value.green,
  },
]);

const takeaways = computed(() => [
  {
    title: "Excess Capacity ist Pflicht",
    desc: "Systeme brauchen Headroom (~20%), um Puffer nach Schwankungen wieder aufzufüllen. Ohne Headroom kaskadieren Rolling Bottlenecks.",
    icon: "🏋️",
    color: C.value.green,
  },
  {
    title: "Gleichmäßiger Flow statt Batches",
    desc: "Große Batches = Dirac-Impuls = maximale Oszillation. TTL+Jitter, Leaky Bucket, Staggered Rollout vermeiden Resonanz.",
    icon: "🌊",
    color: C.value.yellow,
  },
  {
    title: "Hysterese einplanen",
    desc: "Systeme kehren nicht sofort zurück. Cache-Warmup, Queue-Drain, GC-Recovery brauchen Zeit → Alerting mit asymmetrischen Schwellen (Grafana Recovery Threshold).",
    icon: "🔄",
    color: C.value.red,
  },
]);
</script>

<template>
  <div class="mm1-rules" :style="{ color: C.text }">
    <template v-if="part === 'caveats'">
      <div class="rules-title">Einschränkungen der 80%-Regel</div>
      <div class="caveats">
        <div
          v-for="(c, i) in caveats"
          :key="i"
          class="caveat"
          :style="{ background: c.c + '0e', borderColor: c.c + '33' }"
        >
          <div class="caveat-t" :style="{ color: c.c }">{{ c.t }}</div>
          <div class="caveat-d" :style="{ color: C.muted }">{{ c.d }}</div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="rules-title">Drei Regeln aus der Systemdynamik</div>
      <div class="takeaways">
        <div
          v-for="(r, i) in takeaways"
          :key="i"
          class="takeaway"
          :style="{ background: r.color + '0e', borderColor: r.color + '33' }"
        >
          <div class="takeaway-t">
            {{ r.icon }} <span :style="{ color: r.color }">{{ r.title }}</span>
          </div>
          <div class="takeaway-d" :style="{ color: C.muted }">{{ r.desc }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mm1-rules {
  font-family: inherit;
}
.rules-title {
  font-size: 0.72em;
  font-weight: 700;
  margin-bottom: 0.35em;
  opacity: 0.9;
}
.caveats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.caveat {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid;
}
.caveat-t {
  font-size: 0.68em;
  font-weight: 700;
}
.caveat-d {
  font-size: 0.62em;
  line-height: 1.35;
  margin-top: 1px;
}
.takeaways {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.takeaway {
  padding: 7px 9px;
  border-radius: 7px;
  border: 1px solid;
}
.takeaway-t {
  font-size: 0.74em;
  font-weight: 700;
  margin-bottom: 2px;
}
.takeaway-d {
  font-size: 0.64em;
  line-height: 1.4;
}
</style>
