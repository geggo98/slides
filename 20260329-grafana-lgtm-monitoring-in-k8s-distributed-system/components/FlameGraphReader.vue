<script setup>
import { computed, ref, shallowRef } from "vue";
import { useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

const ROOT = {
  name: "quote-service (all threads)",
  samples: 1.0,
  children: [
    {
      name: "Tomcat NioEndpoint.run",
      samples: 0.94,
      children: [
        {
          name: "DispatcherServlet.doDispatch",
          samples: 0.9,
          children: [
            {
              name: "QuoteController.calculate",
              samples: 0.72,
              children: [
                {
                  name: "JsonMapper.writeValue",
                  samples: 0.34,
                  children: [
                    {
                      name: "BeanSerializer.serialize",
                      samples: 0.3,
                      children: [
                        {
                          name: "StringBuilder.append",
                          samples: 0.22,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "QuoteService.compute",
                  samples: 0.28,
                  children: [
                    { name: "RateEngine.lookup", samples: 0.18, children: [] },
                    {
                      name: "TaxCalculator.apply",
                      samples: 0.1,
                      children: [],
                    },
                  ],
                },
                { name: "HttpClient.execute", samples: 0.08, children: [] },
              ],
            },
            { name: "HealthController.check", samples: 0.12, children: [] },
          ],
        },
      ],
    },
    { name: "GC.runFinalization", samples: 0.06, children: [] },
  ],
};

const zoom = shallowRef(ROOT);
const hovered = ref(null);

const HEIGHT = 170;
const ROW_H = 18;
const MIN_ROW_H = 14;

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const theme = computed(() => {
  const d = isDark.value;
  return {
    surface: d ? "#0b0f17" : "#f8fafc",
    text: d ? "#0f172a" : "#0f172a",
    tooltipBg: d ? "#111621" : "#ffffff",
    tooltipFg: d ? "#e2e8f0" : "#1e293b",
    tooltipBorder: d ? "#1e2536" : "#e2e8f0",
    stroke: d ? "#0b0f17" : "#ffffff",
  };
});

function frameColor(name) {
  const h = hash(name);
  const hue = h % 60;
  const sat = 72 + (h % 18);
  const light = isDark.value ? 52 + (h % 8) : 64 + (h % 8);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function maxDepth(node, d = 0) {
  if (!node.children.length) return d;
  return Math.max(...node.children.map((c) => maxDepth(c, d + 1)));
}

const layout = computed(() => {
  const frames = [];
  const totalDepth = maxDepth(zoom.value);
  const rowH = Math.max(
    MIN_ROW_H,
    Math.min(ROW_H, (HEIGHT - 4) / (totalDepth + 1)),
  );

  function walk(node, leftPct, widthPct, depth) {
    frames.push({
      id: `${depth}:${leftPct.toFixed(3)}:${node.name}`,
      name: node.name,
      pct: node.samples,
      leftPct,
      widthPct,
      bottomPx: depth * rowH,
      heightPx: rowH,
      depth,
      node,
    });
    if (!node.children.length) return;
    let cx = leftPct;
    for (const child of node.children) {
      const childW = widthPct * (child.samples / node.samples);
      walk(child, cx, childW, depth + 1);
      cx += childW;
    }
  }

  walk(zoom.value, 0, 100, 0);
  return frames;
});

const isZoomed = computed(() => zoom.value !== ROOT);

function onFrameClick(f) {
  if (f.node === zoom.value && zoom.value !== ROOT) {
    zoom.value = ROOT;
  } else {
    zoom.value = f.node;
  }
}
</script>

<template>
  <div :style="{ display: 'flex', flexDirection: 'column', gap: '6px' }">
    <div
      :style="{
        position: 'relative',
        width: '100%',
        height: `${HEIGHT}px`,
        background: theme.surface,
        borderRadius: '4px',
        overflow: 'hidden',
      }"
    >
      <div
        v-for="f in layout"
        :key="f.id"
        :style="{
          position: 'absolute',
          left: `${f.leftPct}%`,
          width: `${f.widthPct}%`,
          bottom: `${f.bottomPx}px`,
          height: `${f.heightPx}px`,
          background: frameColor(f.name),
          border: `0.5px solid ${theme.stroke}`,
          boxSizing: 'border-box',
          cursor: 'pointer',
          opacity: hovered && hovered.id !== f.id ? 0.55 : 1,
          transition: 'opacity 0.15s',
          display: 'flex',
          alignItems: 'center',
          padding: '0 5px',
          fontFamily: `'JetBrains Mono', monospace`,
          fontSize: '8.5px',
          color: theme.text,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'clip',
        }"
        @mouseenter="hovered = f"
        @mouseleave="hovered = null"
        @click="onFrameClick(f)"
      >
        <span
          :style="{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }"
        >
          {{ f.name }}
        </span>
      </div>
    </div>
    <div
      :style="{
        padding: '5px 9px',
        fontSize: '9px',
        fontFamily: `'JetBrains Mono', monospace`,
        background: theme.tooltipBg,
        color: theme.tooltipFg,
        border: `1px solid ${theme.tooltipBorder}`,
        borderRadius: '4px',
        minHeight: '22px',
        lineHeight: 1.4,
      }"
    >
      <template v-if="hovered">
        <strong>{{ hovered.name }}</strong> —
        {{ (hovered.pct * 100).toFixed(1) }} % Samples
      </template>
      <template v-else-if="isZoomed">
        Gezoomt auf <strong>{{ zoom.name }}</strong> · Klick auf den unteren
        Frame setzt zurück
      </template>
      <template v-else>
        Hover für Details · Klick auf einen Frame zoomt · Klick auf den unteren
        Frame setzt zurück
      </template>
    </div>
  </div>
</template>
