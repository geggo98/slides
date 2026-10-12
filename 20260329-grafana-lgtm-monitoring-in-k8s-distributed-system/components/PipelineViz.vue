<script setup>
/**
 * PipelineViz.vue — Wandernder Engpass in einer Service-Kette, per Klick.
 *
 * Dieselbe Kette wie im Szenario „Wandernder Engpass“ des
 * SystemDynamicsSimulator (80/75/70 req/s, Last ~62 req/s). Jeder Klick ist
 * ein Zustand. Die Füllgrade der Ereignis-Zustände stammen aus dem
 * Simulatorlauf desselben Szenarios (Sekunde 3, 8, 13, 20) — Nachweis:
 * playwright-tests/rolling-bottleneck-check.ts. Die übrigen sind aus dem
 * Modell abgeleitet: Der Rückstau wächst mit (Last − Kapazität), der Puffer
 * fasst `buf`.
 *
 * Engpass = Station, deren aktuelle Kapazität unter der Last liegt, die sie
 * erreicht (Last minus am Eingang Verworfenes). Nur dort baut sich ein
 * Rückstau auf; volle Puffer verwerfen Requests (503).
 *
 * Prop `variant`:
 * - "cause" (Default): 0 Normalbetrieb · 1 nur Schwankung, kein Ereignis
 *   · 2 GC-Pause im Quote-Service · 3 langsamer Provider · 4 Gateway-Neustart.
 * - "remedies": dieselbe GC-Pause, dann 0 ohne Gegenmaßnahme · 1 Back
 *   Pressure · 2 Load Shedding · 3 (Auto-)Scaling mit Vorlauf (~20 %
 *   Schutzkapazität, alle drei Einbrüche gleichzeitig).
 *
 * Optionale Felder je Zustand: `shed` (am Eingang verworfene req/s), `edge`
 * (Hinweis am Last-Knoten), `throttle` (Index der Station, die ihre Vorstufe
 * bremst).
 */
import { computed } from "vue";
import { useDarkMode, useNav } from "@slidev/client";

const STATIONS = [
  { name: "API Gateway", buf: 25 },
  { name: "Quote-Service", buf: 20 },
  { name: "Provider-Adapter", buf: 15 },
];

const STATES_BY_VARIANT = {
  cause: [
    {
      title: "Normalbetrieb",
      text: "Alle Stationen liegen über der Last, aber die Reserve ist schmal.",
      load: 62,
      caps: [80, 75, 70],
      nominal: [80, 75, 70],
      fill: [0, 0, 0],
    },
    {
      title: "Nur Schwankung, kein Ereignis",
      text: "Die Last steigt um 8 %, der Provider-Adapter ist 10 % langsamer. Jede Abweichung für sich fällt nicht auf, zusammen liegt seine Kapazität unter der Last: Der Engpass entsteht ohne Auslöser.",
      load: 67,
      caps: [80, 75, 63],
      nominal: [80, 75, 70],
      fill: [0, 0, 0.5],
      edge: "+8 %",
    },
    {
      title: "GC-Pause im Quote-Service",
      text: "Seine Kapazität fällt unter die Last: davor staut es, der Puffer läuft voll (503). Dahinter kommen nur noch 53 req/s an.",
      load: 62,
      caps: [80, 53, 70],
      nominal: [80, 75, 70],
      fill: [0, 1, 0],
    },
    {
      title: "Provider wird langsam",
      text: "Der Engpass ist nach hinten gewandert. Der Quote-Service ist wieder frei, jetzt staut es sich vor dem Provider-Adapter.",
      load: 62,
      caps: [80, 75, 53],
      nominal: [80, 75, 70],
      fill: [0, 0, 1],
    },
    {
      title: "Pod-Neustart am Gateway",
      text: "Nun ist das Gateway der Engpass; dahinter laufen Quote-Service und Provider-Adapter leer (Starvation).",
      load: 62,
      caps: [56, 75, 70],
      nominal: [80, 75, 70],
      fill: [0.7, 0, 0],
    },
  ],
  remedies: [
    {
      title: "Ohne Gegenmaßnahme",
      text: "GC-Pause im Quote-Service: Sein Puffer läuft voll und verwirft Requests (503). Die Arbeit des Gateways an ihnen ist verloren.",
      load: 62,
      caps: [80, 53, 70],
      nominal: [80, 75, 70],
      fill: [0, 1, 0],
    },
    {
      title: "Back Pressure",
      text: "Der Quote-Service meldet dem Gateway „langsamer“. Der Stau wandert an den Rand: Das Gateway puffert, bald muss es den Client warten lassen oder abweisen (429). Mitten in der Kette geht nichts verloren.",
      load: 62,
      caps: [80, 53, 70],
      nominal: [80, 75, 70],
      fill: [0.7, 0.4, 0],
      throttle: 1,
      edge: "wartet",
    },
    {
      title: "Load Shedding",
      text: "Das Gateway weist früh 10 req/s mit niedriger Priorität ab. Die übrigen 52 req/s passen durch den Quote-Service; kein Puffer läuft voll.",
      load: 62,
      shed: 10,
      caps: [80, 53, 70],
      nominal: [80, 75, 70],
      fill: [0, 0, 0],
      edge: "−10 abgewiesen",
    },
    {
      title: "(Auto-)Scaling mit Vorlauf",
      text: "Die Kapazität stand schon vorher bereit (~20 % mehr: 96/90/84). Dann bleibt jede Station über der Last, selbst wenn alle drei Einbrüche zusammenfallen. Ein Autoscaler reagiert erst nach Sekunden bis Minuten.",
      load: 62,
      caps: [67, 63, 63],
      nominal: [96, 90, 84],
      fill: [0, 0, 0],
    },
  ],
};

const props = defineProps({
  variant: { type: String, default: "cause" },
});
const STATES = STATES_BY_VARIANT[props.variant] ?? STATES_BY_VARIANT.cause;

const nav = useNav();
const state = computed(() =>
  Math.min(STATES.length - 1, Math.max(0, nav.clicks.value)),
);
const cur = computed(() => STATES[state.value]);
// Last, die die Kette erreicht: am Eingang Abgewiesenes zählt nicht mit.
const admitted = computed(() => cur.value.load - (cur.value.shed ?? 0));

const { isDark } = useDarkMode();

const C = computed(() => {
  const d = isDark.value;
  return {
    track: d ? "#1e2536" : "#e2e8f0",
    // Dark: #64748b erreicht auf dunkler Surface nur ~4:1 — heller abgestuft.
    muted: d ? "#94a3b8" : "#64748b",
    dim: d ? "#3e4a63" : "#94a3b8",
    blue: d ? "#3b82f6" : "#2563eb",
    orange: d ? "#f97316" : "#ea580c",
    purple: d ? "#a855f7" : "#9333ea",
    green: d ? "#22c55e" : "#16a34a",
    red: d ? "#ef4444" : "#dc2626",
  };
});

const STAGE_COLORS = computed(() => [
  C.value.blue,
  C.value.orange,
  C.value.purple,
]);

const cards = computed(() =>
  STATIONS.map((st, i) => {
    const cap = cur.value.caps[i];
    const nominal = cur.value.nominal[i];
    const reserve = Math.round((cap / admitted.value - 1) * 100);
    const fill = cur.value.fill[i];
    return {
      name: st.name,
      buf: st.buf,
      cap,
      dipped: cap < nominal,
      nominal,
      reserve,
      bottleneck: cap < admitted.value,
      throttles: cur.value.throttle === i,
      fill,
      full: fill >= 0.95,
      color: STAGE_COLORS.value[i],
    };
  }),
);
</script>

<template>
  <div class="pipeline-viz">
    <div class="state-line">
      <span class="state-step" :style="{ color: C.muted }"
        >Schritt {{ state }}/{{ STATES.length - 1 }}</span
      >
      <span class="state-title">{{ cur.title }}</span>
    </div>

    <div class="chain">
      <div
        class="node input-node"
        :style="{
          background: C.green + '12',
          borderColor: C.green + '25',
          color: C.green,
        }"
      >
        Last
        <span class="big">{{ cur.load }}</span>
        <span class="unit">req/s</span>
        <span v-if="cur.edge" class="edge" :style="{ color: C.orange }">{{
          cur.edge
        }}</span>
      </div>

      <template v-for="(c, i) in cards" :key="i">
        <span
          class="arrow"
          :style="{ color: c.throttles ? C.orange : C.dim }"
          >{{ c.throttles ? "◀" : "→" }}</span
        >
        <div
          class="node"
          :style="{
            background: c.color + '10',
            borderColor: c.bottleneck ? C.red : c.color + '25',
            borderWidth: c.bottleneck ? '2px' : '1px',
            color: c.color,
          }"
        >
          <span
            v-if="c.bottleneck"
            class="badge"
            :style="{ background: C.red, color: '#ffffff' }"
            >Engpass</span
          >
          <span
            v-if="c.throttles"
            class="badge badge-left"
            :style="{ background: C.orange, color: '#ffffff' }"
            >bremst Vorstufe</span
          >
          <div class="name">{{ c.name }}</div>
          <div class="cap">
            <template v-if="c.dipped"
              ><s :style="{ color: C.muted }">{{ c.nominal }}</s> &#8594;
              <b :style="c.bottleneck ? { color: C.red } : {}">{{
                c.cap
              }}</b></template
            >
            <template v-else
              ><b>{{ c.cap }}</b></template
            >
            <span class="unit"> req/s</span>
          </div>
          <div
            class="reserve"
            :style="{ color: c.reserve < 0 ? C.red : C.muted }"
          >
            Reserve {{ c.reserve >= 0 ? "+" : "−" }}{{ Math.abs(c.reserve) }} %
          </div>
          <div class="bar" :style="{ background: C.track }">
            <div
              class="bar-fill"
              :style="{
                width: Math.round(c.fill * 100) + '%',
                background: c.full ? C.red : c.color,
              }"
            />
          </div>
          <div class="buf" :style="{ color: c.full ? C.red : C.muted }">
            buf {{ Math.round(c.fill * c.buf) }}/{{ c.buf
            }}<template v-if="c.full"> · voll, 503</template>
          </div>
        </div>
      </template>
    </div>

    <div class="state-text">{{ cur.text }}</div>
    <div class="legend" :style="{ color: C.muted }">
      req/s = aktuelle Bedienrate · Reserve = Kapazität / Last − 1 (Last: was
      die Kette erreicht) · buf = Warteschlange vor der Station
    </div>
  </div>
</template>

<style scoped>
.pipeline-viz {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: inherit;
}
.state-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 14px;
}
.state-step {
  font-size: 12px;
}
.state-title {
  font-weight: 700;
}
.chain {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
.node {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid;
  font-size: 13px;
  text-align: center;
  box-sizing: border-box;
}
.input-node {
  flex: 0 0 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.big {
  font-size: 22px;
  line-height: 1.1;
}
.unit {
  font-size: 11px;
  opacity: 0.8;
}
.arrow {
  align-self: center;
  font-size: 16px;
  line-height: 1;
}
.badge {
  position: absolute;
  top: -9px;
  right: 8px;
  padding: 1px 7px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
}
.badge-left {
  right: auto;
  left: 8px;
}
.edge {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
}
.name {
  font-weight: 700;
  margin-bottom: 2px;
}
.cap {
  font-size: 14px;
}
.reserve {
  font-size: 11px;
  margin-bottom: 4px;
}
.bar {
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.buf {
  font-size: 11px;
  margin-top: 2px;
}
.state-text {
  font-size: 13px;
  line-height: 1.35;
  min-height: 2.7em;
}
.legend {
  font-size: 10px;
}
</style>
