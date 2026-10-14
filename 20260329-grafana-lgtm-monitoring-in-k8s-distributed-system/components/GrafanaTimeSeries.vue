<script setup lang="ts">
/**
 * GrafanaTimeSeries.vue — Grafana-Time-Series-Panel als Small Multiples: eine
 * Zeile je Metrik, gemeinsame (lineare) Zeitachse. Unterschiedliche Einheiten
 * bekommen eigene Zeilen statt einer Doppelachse; ab `maxRows` Zeilen wird
 * zweispaltig umgebrochen, damit Zeilen lesbar hoch bleiben.
 *
 * Je Zeile: links Titel + Y-Skala, Mitte Linie (Bucket-Mittel) mit blassem
 * Min/Max-Band und gestrichelter Theorie-Linie, rechts aktueller Wert und
 * Theorie-Mittel. Ein Schalter „Y: log“ im Kopf skaliert alle Zeilen mit
 * `logAllowed` logarithmisch (wie Grafanas Axis → Scale). Parameter-
 * änderungen erscheinen als Annotation; `markers` (z. B. „3τ“) auch rechts
 * von „jetzt“, die Zukunft ist dann grau hinterlegt. Kopf: Zeitbereich-Picker
 * „1m · 5m · seit Änderung“, Slot `info` daneben.
 */
import { computed } from "vue";
import { useGrafanaPalette } from "./lib/grafanaPalette";
import { withAlpha } from "./lib/queueing.js";
import {
  RANGES,
  type Annotation,
  type Bucket,
  type RangeKey,
} from "./lib/metricHistory";

export interface TsSeries {
  name: string;
  color: string;
  pts: Bucket[];
}
export interface TsRow {
  key: string;
  title: string;
  unit: string;
  series: TsSeries[];
  theory?: { value: number | null; color?: string; label?: string }[];
  /** Feste Obergrenze (z. B. Auslastung 1,0), sonst automatisch. */
  fixedMax?: number;
  logAllowed?: boolean;
  fmt?: (v: number) => string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    rows: TsRow[];
    range: [number, number];
    rangeKey: RangeKey;
    annotations?: Annotation[];
    /** Hervorgehobene Zeitmarken, z. B. „3τ ≈ eingeschwungen“ (auch in der Zukunft). */
    markers?: Annotation[];
    /** „jetzt“ — Bezug der X-Beschriftung; Standard ist das Fensterende. */
    now?: number;
    /** Log-Skala für Zeilen mit `logAllowed`. */
    logY?: boolean;
    /** Höhe der Plotfläche in viewBox-Einheiten (≈ CSS-px bei voller Breite). */
    plotHeight?: number;
    /** Ab mehr Zeilen zweispaltig. */
    maxRows?: number;
  }>(),
  {
    annotations: () => [],
    markers: () => [],
    now: undefined,
    logY: false,
    plotHeight: 120,
    maxRows: 3,
  },
);
const emit = defineEmits<{
  "update:rangeKey": [RangeKey];
  "toggle-log": [];
}>();
const C = useGrafanaPalette();

const W = 900;
const COL_GAP = 18;
const GUTTER = 118;
const VALUE_W = 58;
const PAD_T = 3;
const AXIS_H = 13;
const ROW_GAP = 6;
const H = computed(() => PAD_T + props.plotHeight + AXIS_H);

function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10])
    if (m * p >= v) return m * p;
  return 10 * p;
}
const defaultFmt = (v: number) =>
  v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);

/** Spalten: Plot-Bereich [x0, x1] je Spalte, plus Zeitskala. */
const cols = computed(() => {
  const n = props.rows.length;
  const ncol = n > props.maxRows ? 2 : 1;
  const perCol = Math.max(1, Math.ceil(n / ncol));
  const colW = (W - COL_GAP * (ncol - 1)) / ncol;
  return Array.from({ length: ncol }, (_, c) => {
    const left = c * (colW + COL_GAP);
    const x0 = left + GUTTER;
    const x1 = left + colW - VALUE_W;
    const tx = (t: number) =>
      x0 +
      ((t - props.range[0]) / Math.max(1e-9, props.range[1] - props.range[0])) *
        (x1 - x0);
    return { c, left, x0, x1, tx, perCol };
  });
});

const layout = computed(() => {
  const n = props.rows.length;
  if (!n) return [];
  const perCol = cols.value[0]!.perCol;
  const rh = (props.plotHeight - ROW_GAP * (perCol - 1)) / perCol;
  return props.rows.map((row, i) => {
    const col = cols.value[Math.floor(i / perCol)]!;
    const top = PAD_T + (i % perCol) * (rh + ROW_GAP);
    const bottom = top + rh;
    const log = !!row.logAllowed && props.logY;
    let hi = 0;
    let lo = Infinity;
    for (const s of row.series)
      for (const b of s.pts) {
        hi = Math.max(hi, b.max);
        if (b.min > 0) lo = Math.min(lo, b.min);
      }
    for (const th of row.theory ?? [])
      if (th.value != null && Number.isFinite(th.value)) {
        hi = Math.max(hi, th.value);
        if (th.value > 0) lo = Math.min(lo, th.value);
      }
    const fmt = row.fmt ?? defaultFmt;
    let y: (v: number) => number;
    let scaleText: [string, string];
    if (log) {
      const dLo = Math.floor(Math.log10(Number.isFinite(lo) ? lo : 0.1));
      const dHi = Math.max(dLo + 1, Math.ceil(Math.log10(Math.max(hi, 1e-9))));
      y = (v) => {
        const c = Math.max(Math.pow(10, dLo), Math.min(Math.pow(10, dHi), v));
        return bottom - ((Math.log10(c) - dLo) / (dHi - dLo)) * (rh - 2);
      };
      scaleText = [fmt(Math.pow(10, dLo)), fmt(Math.pow(10, dHi))];
    } else {
      const max = row.fixedMax ?? niceMax(hi * 1.08);
      y = (v) => bottom - (Math.max(0, Math.min(max, v)) / max) * (rh - 2);
      scaleText = [fmt(0), fmt(max)];
    }
    const { tx } = col;
    const lines = row.series.map((s) => {
      // Lücke im Pfad, wo Buckets fehlen (mehr als 1,5 Bucketbreiten Abstand).
      let d = "";
      let prevT = -Infinity;
      const step =
        s.pts.length > 1
          ? (s.pts[s.pts.length - 1]!.t - s.pts[0]!.t) / (s.pts.length - 1)
          : 0;
      for (const b of s.pts) {
        const gap = step > 0 && b.t - prevT > step * 1.5;
        d += `${d === "" || gap ? "M" : "L"}${tx(b.t).toFixed(1)} ${y(b.avg).toFixed(1)} `;
        prevT = b.t;
      }
      let band = "";
      if (s.pts.length > 1) {
        const up = s.pts.map(
          (b) => `${tx(b.t).toFixed(1)} ${y(b.max).toFixed(1)}`,
        );
        const dn = [...s.pts]
          .reverse()
          .map((b) => `${tx(b.t).toFixed(1)} ${y(b.min).toFixed(1)}`);
        band = `M${up.join(" L")} L${dn.join(" L")} Z`;
      }
      const last = s.pts[s.pts.length - 1];
      return {
        name: s.name,
        color: s.color,
        d,
        band,
        fill: withAlpha(s.color, 0.14),
        lastText: last ? fmt(last.avg) : "–",
      };
    });
    const theory = (row.theory ?? [])
      .filter((th) => th.value != null && Number.isFinite(th.value))
      .map((th) => ({
        y: y(th.value!),
        color: th.color ?? C.value.theory,
        text: fmt(th.value!),
      }));
    const theoryInf = (row.theory ?? []).some(
      (th) => th.value == null || !Number.isFinite(th.value),
    );
    return {
      key: row.key,
      title: row.title,
      unit: row.unit,
      col,
      top,
      bottom,
      log,
      logAllowed: !!row.logAllowed,
      scaleText,
      lines,
      theory,
      // Bei zwei Serien zeigen die farbigen Strichlinien die Theorie; Text nur bei einer.
      theoryText:
        row.series.length > 1
          ? ""
          : theoryInf && !theory.length
            ? "Th. ∞"
            : theory.length
              ? `Th. ${theory[0]!.text}`
              : "",
    };
  });
});

const xTicks = computed(() => {
  const [t0, t1] = props.range;
  const now = Math.min(t1, Math.max(t0, props.now ?? t1));
  const plotW = cols.value[0] ? cols.value[0].x1 - cols.value[0].x0 : W;
  const span = t1 - t0;
  const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  const maxTicks = Math.max(3, Math.floor(plotW / 70));
  const step = steps.find((s) => span / s <= maxTicks) ?? 7200;
  const ts: { t: number; text: string }[] = [];
  // Ticks relativ zu „jetzt“, wie Grafanas „now-5m“ bzw. „now+1h“.
  for (let k = 0; now - k * step >= t0 - 1e-9; k++)
    ts.push({ t: now - k * step, text: k ? `−${k * step} s` : "jetzt" });
  for (let k = 1; now + k * step <= t1 + 1e-9; k++)
    ts.push({ t: now + k * step, text: `+${k * step} s` });
  return cols.value.flatMap((col) =>
    ts
      .map((tk) => ({ x: col.tx(tk.t), text: tk.text }))
      .filter((tk) => tk.x >= col.x0 + 14 || tk.text === "jetzt"),
  );
});
const inRange = (a: Annotation) =>
  a.t >= props.range[0] && a.t <= props.range[1];
const colMarks = computed(() =>
  cols.value.map((col) => ({
    ...col,
    annos: props.annotations
      .filter(inRange)
      .map((a) => ({ x: col.tx(a.t), label: a.label })),
    marks: props.markers
      .filter(inRange)
      .map((a) => ({ x: col.tx(a.t), label: a.label })),
    nowX:
      props.now != null && props.now < props.range[1] - 1e-9
        ? col.tx(props.now)
        : null,
  })),
);
</script>

<template>
  <div class="ts" :style="{ background: C.panel, borderColor: C.border }">
    <div class="ts-head">
      <span class="ts-title" :style="{ color: C.textMid }">{{ title }}</span>
      <div class="ts-right">
        <slot name="info" />
        <button
          v-if="rows.some((r) => r.logAllowed)"
          type="button"
          class="ts-logbtn"
          data-log
          :aria-pressed="logY"
          title="Y-Achse der Zeiten und Queue-Länge logarithmisch"
          :style="{
            borderColor: logY ? C.accent : C.border,
            background: logY ? C.panelHi : 'transparent',
            color: logY ? C.textHi : C.textLow,
          }"
          @click="emit('toggle-log')"
        >
          Y: {{ logY ? "log" : "lin" }}
        </button>
        <div
          class="ts-picker"
          role="group"
          aria-label="Zeitbereich"
          :style="{ borderColor: C.border }"
        >
          <span class="ts-clock" :style="{ color: C.textLow }">⏱</span>
          <button
            v-for="r in RANGES"
            :key="r.key"
            type="button"
            class="ts-range"
            :data-range="r.key"
            :aria-pressed="rangeKey === r.key"
            :style="
              rangeKey === r.key
                ? { background: C.panelHi, color: C.textHi }
                : { background: 'transparent', color: C.textLow }
            "
            @click="emit('update:rangeKey', r.key)"
          >
            {{ r.label }}
          </button>
        </div>
      </div>
    </div>

    <svg
      v-if="rows.length"
      :viewBox="`0 0 ${W} ${H}`"
      class="ts-svg"
      role="img"
      :aria-label="`${title}: ${rows.map((r) => r.title).join(', ')}`"
    >
      <!-- Zukunft rechts von „jetzt“ (bis zur Einschwing-Marke) -->
      <template v-for="cm in colMarks" :key="'f' + cm.c">
        <rect
          v-if="cm.nowX != null"
          :x="cm.nowX"
          :y="PAD_T"
          :width="Math.max(0, cm.x1 - cm.nowX)"
          :height="plotHeight"
          :fill="C.panelHi"
          opacity="0.7"
        />
      </template>

      <g
        v-for="row in layout"
        :key="row.key"
        :data-row="row.key"
        class="ts-row"
      >
        <!-- Plotfläche -->
        <rect
          :x="row.col.x0"
          :y="row.top"
          :width="row.col.x1 - row.col.x0"
          :height="row.bottom - row.top"
          fill="none"
          :stroke="C.grid"
        />
        <!-- Theorie -->
        <line
          v-for="(th, i) in row.theory"
          :key="'th' + i"
          :x1="row.col.x0"
          :x2="row.col.x1"
          :y1="th.y"
          :y2="th.y"
          :stroke="th.color"
          stroke-width="1.2"
          stroke-dasharray="5 4"
        />
        <!-- Serien -->
        <g v-for="ln in row.lines" :key="ln.name">
          <path v-if="ln.band" :d="ln.band" :fill="ln.fill" />
          <path :d="ln.d" fill="none" :stroke="ln.color" stroke-width="1.6" />
        </g>

        <!-- links: Titel, Einheit, Skala -->
        <text
          :x="row.col.left"
          :y="row.top + 9"
          class="ts-rowtitle"
          :fill="C.textHi"
        >
          {{ row.title }}
        </text>
        <text
          :x="row.col.left"
          :y="row.top + 20"
          class="ts-tick"
          :fill="C.textLow"
        >
          {{ row.unit }}
        </text>
        <text
          :x="row.col.x0 - 3"
          :y="row.top + 6"
          text-anchor="end"
          class="ts-tick"
          :fill="C.textLow"
        >
          {{ row.scaleText[1] }}
        </text>
        <text
          :x="row.col.x0 - 3"
          :y="row.bottom - 1"
          text-anchor="end"
          class="ts-tick"
          :fill="C.textLow"
        >
          {{ row.scaleText[0] }}
        </text>
        <!-- rechts: aktuelle Werte + Theorie -->
        <text
          v-for="(ln, i) in row.lines"
          :key="'lv' + ln.name"
          :x="row.col.x1 + 5"
          :y="row.top + 10 + i * 11"
          class="ts-last"
          :fill="ln.color"
        >
          {{ ln.lastText }}
        </text>
        <text
          :x="row.col.x1 + 5"
          :y="Math.min(row.bottom - 1, row.top + 9 + row.lines.length * 11)"
          class="ts-tick"
          :fill="C.theory"
        >
          {{ row.theoryText }}
        </text>
      </g>

      <template v-for="cm in colMarks" :key="'m' + cm.c">
        <!-- Annotationen (Parameteränderungen) -->
        <g v-for="(a, i) in cm.annos" :key="'an' + i">
          <line
            :x1="a.x"
            :x2="a.x"
            :y1="PAD_T"
            :y2="PAD_T + plotHeight"
            :stroke="C.accent"
            stroke-width="1"
            stroke-dasharray="2 3"
          />
          <text
            :x="a.x + 3"
            :y="PAD_T + plotHeight - 3"
            class="ts-tick"
            :fill="C.accent"
          >
            {{ a.label }}
          </text>
        </g>
        <!-- Marken wie „3τ“ -->
        <g v-for="(m, i) in cm.marks" :key="'mk' + i">
          <line
            :x1="m.x"
            :x2="m.x"
            :y1="PAD_T"
            :y2="PAD_T + plotHeight"
            :stroke="C.warn"
            stroke-width="1.4"
            stroke-dasharray="6 3"
          />
          <text
            :x="m.x - 3"
            :y="PAD_T + plotHeight - 3"
            text-anchor="end"
            class="ts-mark"
            :fill="C.warn"
          >
            {{ m.label }}
          </text>
        </g>
      </template>

      <!-- X-Achse -->
      <text
        v-for="(tk, i) in xTicks"
        :key="'x' + i"
        :x="tk.x"
        :y="H - 2"
        text-anchor="middle"
        class="ts-tick"
        :fill="C.textLow"
      >
        {{ tk.text }}
      </text>
    </svg>
    <div
      v-else
      class="ts-empty"
      :style="{ color: C.textLow, height: H * 0.6 + 'px' }"
    >
      Keine Metrik gewählt — oben eine anklicken.
    </div>
  </div>
</template>

<style scoped>
.ts {
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 6px 2px;
}
.ts-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 1px;
}
.ts-title {
  font-size: 9.5px;
  font-weight: 600;
}
.ts-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ts-picker {
  display: flex;
  align-items: center;
  border: 1px solid;
  border-radius: 4px;
  overflow: hidden;
}
.ts-clock {
  font-size: 9px;
  padding: 0 3px 0 5px;
}
.ts-range {
  border: none;
  padding: 1px 7px;
  font-size: 9px;
  font-family: inherit;
  cursor: pointer;
}
.ts-svg {
  width: 100%;
  height: auto;
  display: block;
}
.ts-tick {
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
}
.ts-mark {
  font-size: 9.5px;
  font-weight: 700;
}
.ts-rowtitle {
  font-size: 10px;
  font-weight: 600;
}
.ts-last {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--slidev-code-font-family);
}
.ts-logbtn {
  border: 1px solid;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 9px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
}
.ts-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}
</style>
