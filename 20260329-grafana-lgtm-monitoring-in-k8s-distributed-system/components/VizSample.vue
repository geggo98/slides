<script setup>
import { computed } from "vue";

const props = defineProps({
  type: { type: String, required: true },
  color: { type: String, required: true },
  palette: { type: Object, required: true },
  label: { type: String, default: "" },
});

// Heatmap: Zeit (Spalten) × Latenz-Bucket (Zeilen, 0 = schnell, unten).
// Bimodal: ein schneller Gipfel bei Bucket 1, ein langsamer bei Bucket 4.
const HEAT_COLS = 20;
const HEAT_ROWS = 6;
const heatCells = computed(() => {
  const cells = [];
  const peak = (r, mid, w) => Math.exp(-(((r - mid) / w) ** 2));
  for (let c = 0; c < HEAT_COLS; c++) {
    for (let r = 0; r < HEAT_ROWS; r++) {
      const jitter = ((c * 7 + r * 3) % 5) * 0.04;
      const v = Math.min(
        1,
        Math.max(peak(r, 1, 0.9), 0.65 * peak(r, 4, 0.7)) + jitter - 0.08,
      );
      cells.push({
        x: 10 + c * 8,
        y: 4 + (HEAT_ROWS - 1 - r) * 7,
        o: (0.08 + 0.92 * Math.max(0, v)).toFixed(2),
      });
    }
  }
  return cells;
});

// State Timeline: Segmente als Bruchteile von 24 h.
const STATE_X0 = 34;
const STATE_W = 138;
const stateBands = computed(() => {
  const p = props.palette;
  const col = { g: p.green, y: p.yellow, r: p.red };
  const rows = [
    {
      name: "API",
      y: 8,
      seg: [
        ["g", 0.4],
        ["y", 0.1],
        ["g", 0.3],
        ["r", 0.06],
        ["g", 0.14],
      ],
    },
    {
      name: "DB",
      y: 28,
      seg: [
        ["g", 0.6],
        ["r", 0.1],
        ["y", 0.05],
        ["g", 0.25],
      ],
    },
  ];
  return rows.map((row) => {
    let acc = 0;
    return {
      name: row.name,
      y: row.y,
      rects: row.seg.map(([k, len]) => {
        const rect = {
          x: STATE_X0 + acc * STATE_W,
          w: len * STATE_W,
          c: col[k],
        };
        acc += len;
        return rect;
      }),
    };
  });
});

const tableRows = computed(() => [
  { name: "/api/search", ms: "840 ms", w: 60, o: 0.95 },
  { name: "/api/orders", ms: "610 ms", w: 44, o: 0.75 },
  { name: "/api/login", ms: "340 ms", w: 24, o: 0.55 },
  { name: "/health", ms: "12 ms", w: 4, o: 0.4 },
]);

const traceSpans = computed(() => {
  const p = props.palette;
  return [
    { name: "gateway 240 ms", x: 10, w: 160, y: 5, c: p.accent },
    { name: "order-svc 190 ms", x: 22, w: 128, y: 19, c: p.orange },
    { name: "payment 120 ms", x: 40, w: 80, y: 33, c: p.purple },
    { name: "db 18 ms", x: 50, w: 40, y: 47, c: p.cyan },
  ];
});

const alerts = computed(() => {
  const p = props.palette;
  return [
    { name: "HighErrorRate · checkout", c: p.red, y: 4 },
    { name: "SLOBurnRate · payment", c: p.red, y: 24 },
    { name: "LatencyP99 · search", c: p.orange, y: 44 },
  ];
});

const label = computed(() => props.label || props.type);
</script>

<template>
  <svg
    class="viz-sample"
    viewBox="0 0 180 64"
    role="img"
    :aria-label="`Beispiel: ${label}`"
  >
    <rect
      x="0.5"
      y="0.5"
      width="179"
      height="63"
      rx="4"
      :fill="palette.surface"
      :stroke="palette.border"
    />

    <!-- Time Series: Latenz-Perzentile + SLO-Schwelle -->
    <g v-if="type === 'timeseries'">
      <line x1="10" y1="54" x2="172" y2="54" :stroke="palette.border" />
      <line
        x1="10"
        y1="14"
        x2="172"
        y2="14"
        :stroke="palette.red"
        stroke-width="0.8"
        stroke-dasharray="3 2"
      />
      <text x="12" y="11" class="s-xs" :fill="palette.red">SLO 500 ms</text>
      <polyline
        points="10,46 30,44 50,46 70,41 90,43 110,38 130,41 150,39 172,40"
        fill="none"
        :stroke="palette.textMuted"
        stroke-width="1.2"
      />
      <polyline
        points="10,36 30,33 50,37 70,29 90,32 110,24 130,30 150,26 172,28"
        fill="none"
        :stroke="palette.accent"
        stroke-width="1.2"
      />
      <polyline
        points="10,27 30,24 50,28 70,20 90,24 110,10 130,20 150,16 172,18"
        fill="none"
        :stroke="color"
        stroke-width="1.6"
      />
      <text x="12" y="61" class="s-xs" :fill="palette.textMuted">
        p50 · p95 · p99
      </text>
    </g>

    <!-- Stat: große Zahl + Sparkline -->
    <g v-else-if="type === 'stat'">
      <text x="10" y="13" class="s-xs" :fill="palette.textMuted">
        SLO-Compliance
      </text>
      <text x="10" y="38" class="s-big" :fill="color">99.7%</text>
      <polyline
        points="10,58 30,56 50,57 70,53 90,55 110,50 130,52 150,47 170,49"
        fill="none"
        :stroke="color"
        stroke-width="1.2"
      />
      <polyline
        points="10,58 30,56 50,57 70,53 90,55 110,50 130,52 150,47 170,49 170,62 10,62"
        :fill="color"
        opacity="0.15"
      />
    </g>

    <!-- Gauge: Halbbogen mit Schwellen bei 70 % / 90 % -->
    <g v-else-if="type === 'gauge'">
      <path
        d="M52,52 A38,38 0 0 1 112.3,21.3"
        fill="none"
        :stroke="palette.green"
        stroke-width="8"
      />
      <path
        d="M112.3,21.3 A38,38 0 0 1 126.1,40.3"
        fill="none"
        :stroke="palette.yellow"
        stroke-width="8"
      />
      <path
        d="M126.1,40.3 A38,38 0 0 1 128,52"
        fill="none"
        :stroke="palette.red"
        stroke-width="8"
      />
      <line
        x1="90"
        y1="52"
        x2="113.1"
        y2="32.9"
        :stroke="palette.text"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="90" cy="52" r="3.5" :fill="palette.text" />
      <text x="40" y="62" class="s-xs" :fill="palette.textMuted">0</text>
      <text x="90" y="62" class="s-sm" text-anchor="middle" :fill="color">
        78 %
      </text>
      <text x="140" y="62" class="s-xs" :fill="palette.textMuted">100</text>
    </g>

    <!-- Heatmap: bimodale Latenz-Verteilung -->
    <g v-else-if="type === 'heatmap'">
      <rect
        v-for="(cell, i) in heatCells"
        :key="i"
        :x="cell.x"
        :y="cell.y"
        width="7"
        height="6"
        rx="1"
        :fill="color"
        :opacity="cell.o"
      />
      <text x="10" y="59" class="s-xs" :fill="palette.textMuted">Zeit →</text>
      <text
        x="170"
        y="59"
        class="s-xs"
        text-anchor="end"
        :fill="palette.textMuted"
      >
        Latenz-Buckets ↑
      </text>
    </g>

    <!-- Table: Top-N langsamste Endpoints mit Balken in der Zelle -->
    <g v-else-if="type === 'table'">
      <text x="8" y="10" class="s-xs" :fill="palette.textDim">ENDPOINT</text>
      <text
        x="172"
        y="10"
        class="s-xs"
        text-anchor="end"
        :fill="palette.textDim"
      >
        p99
      </text>
      <line x1="6" y1="13" x2="174" y2="13" :stroke="palette.border" />
      <g v-for="(row, i) in tableRows" :key="row.name">
        <text x="8" :y="24 + i * 12" class="s-sm" :fill="palette.text">
          {{ row.name }}
        </text>
        <rect
          x="76"
          :y="18 + i * 12"
          :width="row.w"
          height="6"
          rx="1"
          :fill="color"
          :opacity="row.o"
        />
        <text
          x="172"
          :y="24 + i * 12"
          class="s-sm mono"
          text-anchor="end"
          :fill="palette.textMuted"
        >
          {{ row.ms }}
        </text>
      </g>
    </g>

    <!-- Logs: Loki-Zeilen -->
    <g v-else-if="type === 'logs'">
      <text x="6" y="12" class="s-mono">
        <tspan :fill="palette.textDim">12:04:11</tspan>
        <tspan class="bold" :fill="palette.red" dx="4">ERROR</tspan>
        <tspan :fill="palette.text" dx="4">NullPointerException</tspan>
      </text>
      <text x="6" y="26" class="s-mono">
        <tspan :fill="palette.textDim">12:04:11</tspan>
        <tspan class="bold" :fill="palette.yellow" dx="4">WARN</tspan>
        <tspan :fill="palette.text" dx="4">retry 2/3 carrier-api</tspan>
      </text>
      <text x="6" y="40" class="s-mono">
        <tspan :fill="palette.textDim">12:04:12</tspan>
        <tspan class="bold" :fill="color" dx="4">INFO</tspan>
        <tspan :fill="palette.text" dx="4">trace_id=4bf9…</tspan>
      </text>
      <text x="6" y="54" class="s-mono">
        <tspan :fill="palette.textDim">12:04:12</tspan>
        <tspan class="bold" :fill="palette.red" dx="4">ERROR</tspan>
        <tspan :fill="palette.text" dx="4">at OrderService:88</tspan>
      </text>
    </g>

    <!-- Traces: Gantt über Services -->
    <g v-else-if="type === 'traces'">
      <g v-for="s in traceSpans" :key="s.name">
        <rect
          :x="s.x"
          :y="s.y"
          :width="s.w"
          height="11"
          rx="2"
          :fill="s.c"
          opacity="0.28"
          :stroke="s.c"
        />
        <text :x="s.x + 3" :y="s.y + 8" class="s-xs" :fill="palette.text">
          {{ s.name }}
        </text>
      </g>
    </g>

    <!-- State Timeline: Verfügbarkeit über 24 h -->
    <g v-else-if="type === 'statetimeline'">
      <g v-for="band in stateBands" :key="band.name">
        <text :x="8" :y="band.y + 10" class="s-sm" :fill="palette.textMuted">
          {{ band.name }}
        </text>
        <rect
          v-for="(r, i) in band.rects"
          :key="i"
          :x="r.x"
          :y="band.y"
          :width="r.w"
          height="14"
          :fill="r.c"
          opacity="0.75"
        />
      </g>
      <text x="34" y="58" class="s-xs" :fill="palette.textMuted">−24 h</text>
      <text
        x="172"
        y="58"
        class="s-xs"
        text-anchor="end"
        :fill="palette.textMuted"
      >
        jetzt
      </text>
    </g>

    <!-- Alert List -->
    <g v-else-if="type === 'alertlist'">
      <g v-for="a in alerts" :key="a.name">
        <rect
          x="4"
          :y="a.y"
          width="172"
          height="16"
          rx="3"
          :fill="a.c"
          opacity="0.12"
        />
        <circle cx="14" :cy="a.y + 8" r="3" :fill="a.c" />
        <text x="22" :y="a.y + 11" class="s-sm" :fill="palette.text">
          {{ a.name }}
        </text>
        <text
          x="170"
          :y="a.y + 11"
          class="s-xs bold"
          text-anchor="end"
          :fill="a.c"
        >
          FIRING
        </text>
      </g>
    </g>

    <!-- Text Panel: Markdown-Mock -->
    <g v-else-if="type === 'text'">
      <text x="8" y="14" class="s-md bold" :fill="palette.text">
        Runbook: checkout
      </text>
      <line x1="8" y1="19" x2="172" y2="19" :stroke="palette.border" />
      <text x="8" y="31" class="s-sm" :fill="palette.text">
        SLO 99.9 % · Owner: Team Orders
      </text>
      <text x="8" y="43" class="s-sm underline" :fill="palette.accent">
        → Eskalationspfad &amp; Runbook
      </text>
      <text x="8" y="57" class="s-mono" :fill="palette.textDim">
        $service = checkout
      </text>
    </g>

    <!-- Dashboard Links: Overview → Service → Pod -->
    <g v-else-if="type === 'dashlink'">
      <rect
        x="4"
        y="6"
        width="48"
        height="22"
        rx="3"
        :fill="palette.red"
        opacity="0.15"
        :stroke="palette.red"
      />
      <text
        x="28"
        y="20"
        class="s-sm"
        text-anchor="middle"
        :fill="palette.text"
      >
        Overview
      </text>
      <rect
        x="66"
        y="6"
        width="48"
        height="22"
        rx="3"
        :fill="palette.accent"
        opacity="0.15"
        :stroke="palette.accent"
      />
      <text
        x="90"
        y="20"
        class="s-sm"
        text-anchor="middle"
        :fill="palette.text"
      >
        Service
      </text>
      <rect
        x="128"
        y="6"
        width="48"
        height="22"
        rx="3"
        :fill="palette.orange"
        opacity="0.15"
        :stroke="palette.orange"
      />
      <text
        x="152"
        y="20"
        class="s-sm"
        text-anchor="middle"
        :fill="palette.text"
      >
        Pod
      </text>
      <line
        x1="53"
        y1="17"
        x2="62"
        y2="17"
        :stroke="color"
        stroke-width="1.4"
      />
      <polygon points="65,17 61,14.5 61,19.5" :fill="color" />
      <line
        x1="115"
        y1="17"
        x2="124"
        y2="17"
        :stroke="color"
        stroke-width="1.4"
      />
      <polygon points="127,17 123,14.5 123,19.5" :fill="color" />
      <text x="6" y="45" class="s-mono" :fill="palette.textMuted">
        Overview → Service: ?var-service=X
      </text>
      <text x="6" y="57" class="s-mono" :fill="palette.textMuted">
        Service → Pod: ?var-pod=X
      </text>
    </g>
  </svg>
</template>

<style scoped>
.viz-sample {
  display: block;
  width: 180px;
  height: 64px;
  flex-shrink: 0;
}

.s-xs {
  font-size: 6px;
}

.s-sm {
  font-size: 7px;
}

.s-md {
  font-size: 9px;
}

.s-big {
  font-size: 24px;
  font-weight: 800;
}

.s-mono {
  font-size: 6.5px;
  font-family: monospace;
}

.bold {
  font-weight: 700;
}

.underline {
  text-decoration: underline;
}

.mono {
  font-family: monospace;
}
</style>
