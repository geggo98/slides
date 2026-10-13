<script setup lang="ts">
/**
 * DeadlineOutcomeViz.vue — Überlast aus Kundensicht: Was wird aus den
 * Anfragen, je nach Gegenmaßnahme? Eine Zeile je Situation, per Klick
 * aufgedeckt (Prop `step`, aus der Folie `:step="$clicks"`; ohne Prop sind
 * alle Zeilen sichtbar).
 *
 *   0 Online, ohne Maßnahme      alles im Timeout
 *   1 Back Pressure / Shedding   Kapazitätsanteil rechtzeitig, Rest abgewiesen
 *   2 Feature Shedding …         alles rechtzeitig, wenn es reicht
 *   3 Batch, gedrosselt          Kapazitätsanteil sofort, Rest später
 *   4 Online + Batch gemeinsam   Online im Timeout, Batch verdrängt Online
 *   5 Workload Separation        Online rechtzeitig, nur Batch gedrosselt
 *   6 Jitter für Batch-Starts    gleiche Arbeit, kleinere Spitze
 *
 * Alle Zahlen kommen aus lib/deadlineOutcomes.ts (Fluid-Rechnung, getestet
 * in shared/__tests__/deadlineOutcomes.test.ts). Die Online-Zahlen sind die
 * der Rabattaktion aus der SRE-Simulation „Wandernde Engpässe“.
 *
 * Alle Balken stehen auf einer Skala (barScale: volle Breite = 1.000
 * req/s), der Kapazitätsstrich für 300 liegt also in jeder Zeile an
 * derselben Stelle. Die gemischten Zeilen (400 req/s) sind entsprechend
 * kürzer; ihre Segmente tragen nur die Klasse, die Ausgänge stehen rechts
 * neben dem Balken.
 *
 * Farbfamilien wie PipelineViz im Monitoring-Deck (grün, orange, rot,
 * blau), die Töne aber für Text auf der Füllung angepasst: hell 700er-Töne
 * mit weißer Schrift, dunkel 400er-Töne mit dunkler Schrift (Kontrast
 * jeweils ≥ 4,5:1). Die Bedeutung ist eine eigene, siehe Legende. Timeout
 * ist zusätzlich schraffiert, damit Rot/Grün nicht allein über die Farbe
 * getrennt wird (Streifen gemessen: hell 5,2:1, dunkel 4,6:1). Die
 * Jitter-Spuren sind neutral grau: Blau heißt in der Legende „später“.
 *
 * Aufdecken per v-show: Die Erläuterung steht unter der zuletzt
 * aufgedeckten Zeile, der Endzustand ist also der höchste — dort auf
 * Überlauf prüfen. Einbinden: im Deck global registrieren (setup/main.ts,
 * Slidev auto-importiert shared/ nicht); die Folie braucht `clicks: 6` und
 * `:step="$clicks"`, das prüft shared/__tests__/deadlineOutcomes.test.ts.
 */
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import {
  JITTER_JOB_MIN,
  JITTER_JOBS,
  MIXED_BATCH,
  MIXED_CAPACITY,
  MIXED_ONLINE,
  ROW_KEYS,
  SIM_CAPACITY,
  SIM_CAPACITY_FS,
  SIM_DEMAND,
  barScale,
  jitterProfiles,
  mixedShared,
  outcomeRows,
  type Outcome,
  type RowKey,
  type Segment,
} from "./lib/deadlineOutcomes";

const props = withDefaults(defineProps<{ step?: number }>(), {
  step: Number.POSITIVE_INFINITY,
});

const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

type CaptionPart = string | { code: string };
interface RowText {
  title: string;
  sub: string;
  lead: string;
  caption: CaptionPart[];
}

const shared = mixedShared(MIXED_ONLINE, MIXED_BATCH, MIXED_CAPACITY);

// Formulierungen aus dem Faktencheck („Formulierungsvorschläge“); Zahlen aus
// der Rechnung, damit Text und Balken nicht auseinanderlaufen.
const TEXT: Record<RowKey, RowText> = {
  unprotected: {
    title: "Online, ohne Maßnahme",
    sub: `${fmt(SIM_DEMAND)} req/s auf ${fmt(SIM_CAPACITY)} Kapazität`,
    lead: "Ohne Maßnahme:",
    caption: [
      "Die Wartezeit wächst über die Deadline. Der Server arbeitet weiter, aber für Antworten, auf die niemand mehr wartet. Bei genug Überlast kommt keine Anfrage mehr durch.",
    ],
  },
  shed: {
    title: "Back Pressure / Load Shedding",
    sub: `Annahme begrenzt auf ${fmt(SIM_CAPACITY)} req/s`,
    lead: "Back Pressure / Load Shedding:",
    caption: [
      "Was angenommen wird, ist schnell fertig; der Überschuss wird sofort abgewiesen (429/503), statt in den Timeout zu laufen.",
    ],
  },
  enough: {
    title: "Feature Shedding, Cache, Scaling",
    sub: `${fmt(SIM_DEMAND)} req/s auf ${fmt(SIM_CAPACITY_FS)} Kapazität`,
    lead: "Alle Kunden in der Deadline",
    caption: [
      `nur, wenn die Arbeit pro Anfrage sinkt (Feature Shedding, Cache), die Kapazität steigt (Scaling) oder andere Last weicht (etwa Batch) – und nur, wenn das reicht und rechtzeitig greift. Hier: Seiten ohne Empfehlungen, die DB schafft ${fmt(SIM_CAPACITY_FS)} statt ${fmt(SIM_CAPACITY)}\u00a0req/s.`,
    ],
  },
  batch: {
    title: "Batch, gedrosselt",
    sub: `${fmt(SIM_DEMAND)} req/s auf ${fmt(SIM_CAPACITY)} Kapazität`,
    lead: "Batch:",
    caption: [
      "Kein Mensch wartet, aber es gibt ein Fertigstellungsfenster: drosseln statt abweisen und den Rückstand später abarbeiten.",
    ],
  },
  mixedShared: {
    title: "Online + Batch, gemeinsam",
    sub: `${fmt(MIXED_ONLINE)} + ${fmt(MIXED_BATCH)} req/s auf ${fmt(MIXED_CAPACITY)}`,
    lead: "Mixed Load ohne Trennung:",
    caption: [
      `Online allein (${fmt(MIXED_ONLINE)}\u00a0req/s) passt in die Kapazität (${fmt(MIXED_CAPACITY)}). Mit Batch wächst die gemeinsame Queue: Alle Online-Anfragen laufen in den Timeout, ${fmt(shared.onlineServedLate)}\u00a0req/s Kapazität gehen an Antworten, auf die niemand mehr wartet.`,
    ],
  },
  mixedSeparated: {
    title: "Workload Separation",
    sub: "Online zuerst, Batch nimmt den Rest",
    lead: "Workload Separation:",
    caption: [
      "Online und Batch getrennt behandeln – logisch (Priorität je Anfrage, eigene Thread-Pools und Limits) oder physisch (eigene, anders konfigurierte Instanzen). Gedrosselt oder abgewiesen wird nur Batch.",
    ],
  },
  jitter: {
    title: "Jitter für Batch-Starts",
    sub: `${JITTER_JOBS.length} Jobs à ${JITTER_JOB_MIN} min`,
    lead: "Jitter:",
    caption: [
      "Batch-Starts verteilen (Jenkins ",
      { code: "H" },
      ", systemd ",
      { code: "RandomizedDelaySec" },
      "): gleiche Arbeit, kleinere Spitze – aber keine zusätzliche Kapazität. Online wählt der Kunde den ersten Zeitpunkt; Jitter bleibt dort für Retries und Arbeit, auf die er nicht wartet.",
    ],
  },
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  ontime: "rechtzeitig",
  rejected: "abgewiesen",
  timeout: "Timeout",
  later: "später",
};
const LEGEND: { outcome: Outcome; label: string }[] = [
  { outcome: "ontime", label: "rechtzeitig / sofort erledigt" },
  { outcome: "rejected", label: "schnell abgewiesen (429/503)" },
  { outcome: "timeout", label: "Timeout: Antwort zu spät" },
  { outcome: "later", label: "später erledigt (Batch)" },
];
const CLASS_LABEL = { online: "Online", batch: "Batch" } as const;

const BAR_ROWS = outcomeRows();
const SCALE = barScale(BAR_ROWS); // req/s bei voller Balkenbreite
const JITTER = jitterProfiles();
const ROW_COUNT = ROW_KEYS.length; // Balkenzeilen + Jitter-Zeile

const cur = computed(() =>
  Math.min(ROW_COUNT - 1, Math.max(0, Math.floor(props.step))),
);

const { isDark } = useDarkMode();
const C = computed(() => {
  const d = isDark.value;
  return {
    // hell slate-600: ≥ 4,5:1 auch auf dem Hintergrund der aktiven Zeile
    muted: d ? "#94a3b8" : "#475569",
    track: d ? "#1e2536" : "#e2e8f0",
    highlight: d ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.08)",
    capLine: d ? "#e2e8f0" : "#0f172a",
    fillText: d ? "#111827" : "#ffffff",
    jitterBar: d ? "#94a3b8" : "#475569",
    fill: {
      ontime: d ? "#4ade80" : "#15803d",
      rejected: d ? "#fbbf24" : "#b45309",
      timeout: d ? "#f87171" : "#b91c1c",
      later: d ? "#60a5fa" : "#1d4ed8",
    } as Record<Outcome, string>,
  };
});
// Strichelung als Verlauf statt `border: dashed`: Chromium zeichnet einen
// kurzen gestrichelten Rand durchgezogen, WebKit gestrichelt.
const capDash = computed(
  () =>
    `repeating-linear-gradient(to bottom, ${C.value.capLine} 0 4px, transparent 4px 7px)`,
);

function fillOf(outcome: Outcome) {
  const base = C.value.fill[outcome];
  const stripe = isDark.value ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.14)";
  return outcome === "timeout"
    ? `repeating-linear-gradient(135deg, ${base} 0 6px, ${stripe} 6px 9px), ${base}`
    : base;
}

// Balken einer Zeile: Breiten exakt proportional zu req/s auf der
// gemeinsamen Skala. Zwischen Online und Batch steht eine Lücke von GAP px;
// sie geht vom folgenden Segment ab, damit jede Segmentgrenze und der
// Kapazitätsstrich genau bei ihrem Anteil liegen.
const GAP = 3;
const pct = (v: number) => `${(v / SCALE) * 100}%`;
function barLayout(segs: readonly Segment[], capacity: number) {
  const parts = segs.map((seg, k) => {
    const gap = k > 0 && segs[k - 1]!.cls !== seg.cls;
    const first = k === 0 || gap;
    const last = k === segs.length - 1 || segs[k + 1]!.cls !== seg.cls;
    const r = (on: boolean) => (on ? "4px" : "0");
    return {
      seg,
      style: {
        width: gap ? `calc(${pct(seg.value)} - ${GAP}px)` : pct(seg.value),
        marginLeft: gap ? `${GAP}px` : "0",
        background: fillOf(seg.outcome),
        color: C.value.fillText,
        borderRadius: `${r(first)} ${r(last)} ${r(last)} ${r(first)}`,
      },
    };
  });
  // Kapazität innerhalb der Skala: Strich; darüber: Hinweis am Balkenende.
  return {
    parts,
    capLeft: capacity < SCALE ? pct(capacity) : null,
    capBeyond: capacity >= SCALE ? capacity : null,
  };
}

const outcomeLabel = (s: Segment) =>
  s.outcome === "ontime" && s.cls === "batch"
    ? "sofort"
    : OUTCOME_LABEL[s.outcome];

// Im Segment: ungemischt Menge und Ausgang; gemischt nur die Klasse, weil
// 100 req/s auf der gemeinsamen Skala zu schmal für mehr sind.
function segText(seg: Segment, mixed: boolean) {
  if (mixed) return CLASS_LABEL[seg.cls];
  const label =
    seg.outcome === "rejected" ? "abgewiesen (429/503)" : outcomeLabel(seg);
  return `${fmt(seg.value)} ${label}`;
}

// Rechts neben einem gemischten Balken: die Ausgänge je Klasse in Worten.
function mixedSummary(segs: readonly Segment[]) {
  return (["online", "batch"] as const)
    .map((cls) => {
      const own = segs.filter((s) => s.cls === cls);
      if (own.length === 0) return "";
      if (own.length === 1)
        return `${CLASS_LABEL[cls]} ${fmt(own[0]!.value)}: ${outcomeLabel(own[0]!)}`;
      return `${CLASS_LABEL[cls]}: ${own.map((s) => `${fmt(s.value)} ${outcomeLabel(s)}`).join(", ")}`;
    })
    .filter(Boolean)
    .join(" · ");
}

const rows = computed(() => [
  ...BAR_ROWS.map((r) => {
    const mixed =
      r.segments.some((s) => s.cls === "online") &&
      r.segments.some((s) => s.cls === "batch");
    return {
      kind: "bar" as const,
      key: r.key as RowKey,
      text: TEXT[r.key],
      mixed,
      summary: mixed ? mixedSummary(r.segments) : "",
      ...barLayout(r.segments, r.capacity),
    };
  }),
  { kind: "jitter" as const, key: "jitter" as RowKey, text: TEXT.jitter },
]);

// Jitter-Spuren: gleiche Skala (Spitze ohne Jitter = volle Höhe), je Profil
// ein Pfad (Einzelrechtecke zeigen Antialiasing-Nähte).
const J_W = 650;
const J_H = 32;
const jScale = J_H / JITTER.peakFixed;
const jColW = J_W / JITTER.fixed.length;
const r2 = (n: number) => Math.round(n * 100) / 100;
function profilePath(profile: readonly number[]) {
  let d = `M0 ${J_H}`;
  profile.forEach((n, m) => {
    const y = r2(J_H - n * jScale);
    d += ` L${r2(m * jColW)} ${y} L${r2((m + 1) * jColW)} ${y}`;
  });
  return `${d} L${J_W} ${J_H} Z`;
}
const jTracks = [
  {
    label: "0 0 * * *",
    path: profilePath(JITTER.fixed),
    peak: JITTER.peakFixed,
    work: JITTER.workFixed,
  },
  {
    label: "H 0 * * *",
    path: profilePath(JITTER.hashed),
    peak: JITTER.peakHashed,
    work: JITTER.workHashed,
  },
];
// Zeitachse: Minute m liegt bei m / Profillänge der Spurbreite.
const J_TICKS = [0, 30, 60].map((m) => ({
  label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
  left: `${(m / JITTER.fixed.length) * 100}%`,
}));

const current = computed(() => rows.value[cur.value]!.text);
</script>

<template>
  <div class="dov">
    <div class="legend" :style="{ color: C.muted }">
      <span v-for="l in LEGEND" :key="l.outcome" class="lg">
        <i class="sw" :style="{ background: fillOf(l.outcome) }" />{{ l.label }}
      </span>
      <span class="lg"
        ><i class="sw-cap" :style="{ background: capDash }" />Kapazität</span
      >
    </div>

    <div class="rows">
      <div
        v-for="(r, i) in rows"
        v-show="i <= cur"
        :key="r.key"
        class="row"
        :data-row="r.key"
        :style="{ background: i === cur ? C.highlight : 'transparent' }"
      >
        <div class="label">
          <div class="t">{{ r.text.title }}</div>
          <div class="s" :style="{ color: C.muted }">{{ r.text.sub }}</div>
        </div>

        <div v-if="r.kind === 'bar'" class="bar">
          <div
            v-for="(p, k) in r.parts"
            :key="k"
            class="seg"
            :data-outcome="p.seg.outcome"
            :data-cls="p.seg.cls"
            :style="p.style"
          >
            {{ segText(p.seg, r.mixed) }}
          </div>
          <div v-if="r.mixed" class="out">{{ r.summary }}</div>
          <div
            v-if="r.capLeft !== null"
            class="cap"
            :style="{ left: r.capLeft, background: capDash }"
          />
          <div
            v-if="r.capBeyond !== null"
            class="cap-beyond"
            :style="{ color: C.fillText }"
          >
            Kapazität {{ fmt(r.capBeyond) }} →
          </div>
        </div>

        <div v-else class="jitter">
          <div v-for="t in jTracks" :key="t.label" class="jtrack">
            <code class="jlabel" :style="{ color: C.muted }">{{
              t.label
            }}</code>
            <svg
              class="jsvg"
              :style="{ height: `${J_H}px` }"
              :viewBox="`0 0 ${J_W} ${J_H}`"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`${t.label}: höchstens ${t.peak} Jobs gleichzeitig, ${t.work} Job-Minuten`"
            >
              <rect :width="J_W" :height="J_H" :fill="C.track" rx="2" ry="2" />
              <path :d="t.path" :fill="C.jitterBar" />
            </svg>
            <span class="jpeak" :style="{ color: C.muted }"
              >Spitze <b>{{ t.peak }}</b
              ><br />{{ t.work }} Job-Minuten</span
            >
          </div>
          <div class="jaxis" :style="{ color: C.muted }">
            <span
              v-for="tk in J_TICKS"
              :key="tk.label"
              :style="{ left: tk.left }"
              >{{ tk.label }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <div class="caption">
      <b>{{ current.lead }}</b>
      <template v-for="(p, k) in current.caption" :key="k"
        ><code v-if="typeof p !== 'string'">{{ p.code }}</code
        ><template v-else>{{ (k === 0 ? " " : "") + p }}</template></template
      >
    </div>
  </div>
</template>

<style scoped>
.dov {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: inherit;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 11.5px;
  padding-left: 6px;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.sw {
  display: inline-block;
  width: 12px;
  height: 10px;
  border-radius: 2px;
}
.sw-cap {
  display: inline-block;
  width: 2px;
  height: 14px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  transition: background 0.3s ease;
  /* läuft bei jedem Aufdecken an (display: none → sichtbar) */
  animation: dov-in 0.3s ease;
}
@keyframes dov-in {
  from {
    opacity: 0;
  }
}
.label {
  flex: 0 0 212px;
  min-width: 0;
  line-height: 1.15;
}
/* 600, nicht 700: Slidev lädt per Default nur Inter 200/400/600, das
 * SRE-Deck zusätzlich 700. Mit 700 wäre der Titel dort breiter und bräche
 * „Feature Shedding, Cache, Scaling“ in der 212-px-Spalte um; 600 sieht in
 * jedem Deck gleich aus. */
.t {
  font-size: 13px;
  font-weight: 600;
}
.s {
  font-size: 11px;
}
.bar {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  height: 26px;
  border-radius: 4px;
  overflow: visible;
}
.seg {
  flex: none;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  line-height: 26px;
  padding: 0 8px;
  box-sizing: border-box;
}
.out {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 26px;
  padding-left: 10px;
}
.cap {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  pointer-events: none;
}
.cap-beyond {
  position: absolute;
  top: 0;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 26px;
  white-space: nowrap;
  pointer-events: none;
}
.jitter {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.jtrack {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jlabel {
  flex: 0 0 72px;
  font-size: 11px;
  white-space: nowrap;
}
.jsvg {
  flex: 1 1 0;
  min-width: 0;
}
.jpeak {
  flex: 0 0 82px;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}
.jaxis {
  position: relative;
  height: 13px;
  margin: 0 90px 0 80px; /* jlabel + gap | gap + jpeak */
  font-size: 11px;
  line-height: 13px;
}
.jaxis span {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;
}
.caption {
  font-size: 13px;
  line-height: 1.35;
  min-height: 2.7em;
  margin-top: 2px;
}
.caption code {
  font-size: 0.92em;
  padding: 0 2px;
}
</style>
