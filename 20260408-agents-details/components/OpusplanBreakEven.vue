<script setup lang="ts">
/**
 * OpusplanBreakEven — interaktive Kostenrechnung zur opusplan-Folie.
 *
 * Klick-Vertrag (`clicks: 2` im Frontmatter, `:step="$clicks"`):
 *   Step 0 → Regler + Szenario-Balken (Nur Sonnet / Nur Opus / opusplan)
 *   Step 1 → + Break-even-Chart (rechte Hälfte, visibility-Toggle: kein Reflow)
 *   Step 2 → + Anti-Pattern-Balken und ⚠-Warnung (Re-Plans ohne /compact)
 * Die Regler sind orthogonal zu den Klick-Schritten (kein Override-Muster
 * nötig); `@click.stop` auf der Regler-Zeile verhindert Folienwechsel.
 *
 * Rechenmodell und Datenherkunft: ./lib/opusplanMath.ts (per vitest gepinnt).
 */
import { computed, ref } from "vue";
import { fmt } from "./paretoData";
import {
  OPUS,
  SONNET,
  kostenGerade,
  szenarien,
  toEur,
  DEFAULT_TTL,
  type Ttl,
} from "./lib/opusplanMath";

const props = defineProps<{ step?: number }>();
const step = computed(() => props.step ?? 0);

// ── Regler (Anzeige-Einheiten: kTok bzw. MTok) ──────────────────────────────
const ctxK = ref(180); // Kontext beim Wechsel, kTok (Median 177k)
const readM = ref(30); // Exec-Cache-Read, MTok (Median lange Läufe ~31M)
const outK = ref(150); // Exec-Output, kTok
const n = ref(2); // Re-Plans ohne /compact (beobachtetes Maximum: 13)
const ttl = ref<Ttl>(DEFAULT_TTL); // 1 h — Begründung in opusplanMath.ts

const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");

const erg = computed(() =>
  szenarien({
    ctx: ctxK.value / 1000,
    execRead: readM.value,
    execOut: outK.value / 1000,
    replans: n.value,
    ttl: ttl.value,
  }),
);

// ── Balken (Gesamtkosten in €) ──────────────────────────────────────────────
const eur = computed(() => ({
  s1: toEur(erg.value.nurSonnet),
  s2: toEur(erg.value.nurOpus),
  s3: toEur(erg.value.opusplan),
  s4: toEur(erg.value.antiPattern),
}));

// Feste Skalen-Leiter statt fließendem Maximum: kleine Regler-Bewegungen
// lassen die Skala nicht zittern; Sprünge glättet die CSS-Breiten-Transition.
const BALKEN_LEITER = [10, 15, 20, 30, 40, 60, 80, 120, 200];
function sprosse(leiter: number[], wert: number): number {
  for (const s of leiter) {
    if (s >= wert) return s;
  }
  return leiter[leiter.length - 1] ?? wert;
}
const balkenMax = computed(() => {
  const e = eur.value;
  return sprosse(BALKEN_LEITER, Math.max(e.s1, e.s2, e.s3, e.s4));
});
const pct = (v: number) => (v / balkenMax.value) * 100;

const showChart = computed(() => step.value >= 1);
const showAnti = computed(() => step.value >= 2);

const spart = computed(() => erg.value.ersparnis > 0);
const deltaOpusplan = computed(() => {
  const d = toEur(erg.value.ersparnis);
  return spart.value ? `−${fmt(d)} €` : `+${fmt(-d)} €`;
});
const deltaAnti = computed(() => `+${fmt(eur.value.s4 - eur.value.s3)} €`);
const prozent = computed(() =>
  Math.round(Math.abs(erg.value.ersparnisProzent)),
);

// ── Break-even-Chart (SVG, logische Einheiten 440×190) ──────────────────────
const XL = 36;
const XT = 10;
const XW = 394;
const XH = 156;
const ratio = computed(() => outK.value / 1000 / readM.value);
const xStar = computed(() => erg.value.breakEvenRead);
// x-Leiter {12, 20}: mit Sonnet 5 bleibt der Break-even überall unter
// 8,4 MTok (per Test gepinnt), die 20er-Sprosse ist also Reserve für den
// nächsten Preiswechsel — mit Sonnet 4.6 wurden es bis zu 18,9 MTok.
const xMax = computed(() => (xStar.value > 12 ? 20 : 12));
const yOpus = (x: number) =>
  toEur(kostenGerade(OPUS, OPUS, ttl.value, ratio.value, 0, x));
const yPlan = (x: number) =>
  toEur(
    kostenGerade(
      OPUS,
      SONNET,
      ttl.value,
      ratio.value,
      erg.value.bruchEinmal,
      x,
    ),
  );
// 8 % Luft über der oberen Geraden: ohne sie darf sie die Decke berühren, und
// das Label „Nur Opus" sitzt 5 px darüber — also außerhalb der viewBox. Trat
// bei 288 durchgefahrenen Reglerstellungen 8× auf, mit 1-h-TTL schon bei den
// Defaults (14,98 € gegen Sprosse 15). Die Sprosse 20 verhindert, dass die
// Luft direkt auf 25 springt und die Geraden im unteren Drittel kleben.
const Y_LEITER = [15, 20, 25, 40, 60];
const Y_LUFT = 1.08;
const yMax = computed(() =>
  sprosse(Y_LEITER, Math.max(yOpus(xMax.value), yPlan(xMax.value)) * Y_LUFT),
);
const sx = (x: number) => XL + (x / xMax.value) * XW;
const sy = (v: number) => XT + XH - (v / yMax.value) * XH;
const xTicks = computed(() =>
  xMax.value === 12 ? [0, 4, 8, 12] : [0, 5, 10, 15, 20],
);
const yTickMap: Record<number, number[]> = {
  15: [5, 10, 15],
  20: [10, 20],
  25: [10, 20],
  40: [20, 40],
  60: [30, 60],
};
const yTicks = computed(() => yTickMap[yMax.value] ?? [yMax.value]);
const schnittX = computed(() => sx(xStar.value));
const schnittY = computed(() => sy(yOpus(xStar.value)));
const badgeLinks = computed(() => xStar.value > xMax.value * 0.55);
const reglerImBild = computed(() => readM.value <= xMax.value);
// Label links vom Marker, sobald er in der rechten Plot-Hälfte steht
const reglerRechts = computed(() => sx(readM.value) > XL + XW / 2);

// ── Texte ───────────────────────────────────────────────────────────────────
const bruchEur = computed(() => fmt(toEur(erg.value.bruchEinmal)));
const proMtokEur = computed(() => fmt(toEur(erg.value.proMtokErsparnis)));
const bruchPaarEur = computed(() => fmt(toEur(erg.value.rueckkehrBrueche)));

const warnung = computed(() => showAnti.value && n.value >= 1);
const noteText = computed(() => {
  if (showAnti.value) {
    if (n.value === 0)
      return `Regler „Re-Plans“: jede Rückkehr in den Plan-Mode ohne /compact kostet 2 zusätzliche Cache-Brüche (≈ ${bruchPaarEur.value} €).`;
    const schluss =
      erg.value.ersparnisWegAb > 0
        ? `ab ${erg.value.ersparnisWegAb}× ist die gesamte Ersparnis weg`
        : `und schon ohne Rückkehr ist opusplan hier teurer als Nur Opus`;
    return `${n.value}× zurück in den Plan-Mode ohne /compact: je Rückkehr 2 Cache-Brüche ≈ ${bruchPaarEur.value} € oben drauf (einer als Opus-Write!) — ${schluss}. Vor erneutem Planen: /compact.`;
  }
  if (showChart.value)
    return `Break-even bei ~${fmt1(xStar.value)} MTok Exec-Cache-Read: der eine Bruch kostet ${bruchEur.value} €, jedes weitere MTok spart ${proMtokEur.value} €. Dein Regler: ${readM.value} MTok.`;
  if (spart.value)
    return `opusplan spart hier ${fmt(toEur(erg.value.ersparnis))} € (−${prozent.value} %) gegenüber durchgängig Opus — der faire Vergleich: beide planen mit Opus.`;
  return `opusplan kostet hier ${fmt(toEur(-erg.value.ersparnis))} € mehr als Nur Opus — das Exec-Volumen liegt unter dem Break-even.`;
});

const balkenLabel = computed(
  () =>
    `Gesamtkosten pro Session: Nur Sonnet ${fmt(eur.value.s1)} Euro, Nur Opus ${fmt(eur.value.s2)} Euro, opusplan ${fmt(eur.value.s3)} Euro, mit Anti-Pattern ${fmt(eur.value.s4)} Euro.`,
);
const chartLabel = computed(
  () =>
    `Kostengeraden über dem Exec-Volumen: Break-even bei etwa ${fmt1(xStar.value)} MTok Exec-Cache-Read, darüber ist opusplan billiger als durchgängig Opus.`,
);
</script>

<template>
  <div class="ob">
    <!-- Regler -->
    <div class="ob-controls" @click.stop>
      <label class="ob-slider">
        <span>Kontext</span>
        <input
          v-model.number="ctxK"
          type="range"
          min="80"
          max="700"
          step="10"
        />
        <span class="ob-val">{{ ctxK }}k</span>
      </label>
      <label class="ob-slider">
        <span>Exec-Read</span>
        <input v-model.number="readM" type="range" min="5" max="120" step="1" />
        <span class="ob-val">{{ readM }} M</span>
      </label>
      <label class="ob-slider">
        <span>Exec-Out</span>
        <input
          v-model.number="outK"
          type="range"
          min="80"
          max="400"
          step="10"
        />
        <span class="ob-val">{{ outK }}k</span>
      </label>
      <label class="ob-slider">
        <span>Re-Plans</span>
        <input v-model.number="n" type="range" min="0" max="13" step="1" />
        <span class="ob-val">{{ n }}×</span>
      </label>
      <div class="ob-ttl-wrap">
        <span id="ob-ttl-label" class="ob-ttl-label">TTL</span>
        <div class="ob-ttl" role="group" aria-labelledby="ob-ttl-label">
          <button
            :class="{ on: ttl === '5min' }"
            :aria-pressed="ttl === '5min'"
            @click="ttl = '5min'"
          >
            5 min
          </button>
          <button
            :class="{ on: ttl === '1h' }"
            :aria-pressed="ttl === '1h'"
            @click="ttl = '1h'"
          >
            1 h
          </button>
        </div>
      </div>
    </div>

    <div class="ob-main">
      <!-- Szenario-Balken -->
      <div>
        <div class="ob-h">Gesamtkosten pro Session</div>
        <div class="ob-bars" role="img" :aria-label="balkenLabel">
          <div class="ob-row">
            <span class="ob-name">Nur Sonnet ¹</span>
            <span class="ob-track"
              ><span
                class="ob-fill ob-f1"
                :style="{ width: pct(eur.s1) + '%' }"
            /></span>
            <span class="ob-eur">{{ fmt(eur.s1) }} €</span>
            <span class="ob-delta" />
          </div>
          <div class="ob-row">
            <span class="ob-name">Nur Opus</span>
            <span class="ob-track"
              ><span
                class="ob-fill ob-f2"
                :style="{ width: pct(eur.s2) + '%' }"
            /></span>
            <span class="ob-eur">{{ fmt(eur.s2) }} €</span>
            <span class="ob-delta" />
          </div>
          <div class="ob-row">
            <span class="ob-name">opusplan</span>
            <span class="ob-track"
              ><span
                class="ob-fill ob-f3"
                :style="{ width: pct(eur.s3) + '%' }"
            /></span>
            <span class="ob-eur">{{ fmt(eur.s3) }} €</span>
            <span class="ob-delta" :class="spart ? 'gut' : 'schlecht'">{{
              deltaOpusplan
            }}</span>
          </div>
          <div class="ob-row" :class="{ 'ob-versteckt': !showAnti }">
            <span class="ob-name ob-warnname">⚠ Anti-Pattern</span>
            <span class="ob-track"
              ><span
                class="ob-fill ob-f4"
                :style="{ width: pct(eur.s4) + '%' }"
            /></span>
            <span class="ob-eur">{{ fmt(eur.s4) }} €</span>
            <span class="ob-delta schlecht">{{ deltaAnti }}</span>
          </div>
        </div>
        <p class="ob-fuss">
          ¹ billiger, aber schwächerer Plan — Qualitäts-, kein Preisvergleich.
          Badge: Δ vs. Nur Opus bzw. durch Re-Plans.
        </p>
      </div>

      <!-- Break-even-Chart -->
      <div :class="{ 'ob-versteckt': !showChart }">
        <div class="ob-h">Ab wann lohnt der Cache-Bruch?</div>
        <svg
          class="ob-chart"
          viewBox="0 0 440 190"
          role="img"
          :aria-label="chartLabel"
        >
          <!-- Erfolgs-Tönung rechts vom Break-even -->
          <rect
            :x="schnittX"
            :y="XT"
            :width="sx(xMax) - schnittX"
            :height="XH"
            class="ob-ok"
          />
          <!-- Gitter + Achsen -->
          <g class="ob-grid">
            <line
              v-for="t in yTicks"
              :key="'y' + t"
              :x1="XL"
              :y1="sy(t)"
              :x2="sx(xMax)"
              :y2="sy(t)"
            />
            <line :x1="XL" :y1="XT" :x2="XL" :y2="XT + XH" class="ob-achse" />
            <line
              :x1="XL"
              :y1="XT + XH"
              :x2="sx(xMax)"
              :y2="XT + XH"
              class="ob-achse"
            />
          </g>
          <g class="ob-ticktext">
            <text
              v-for="t in yTicks"
              :key="'yt' + t"
              :x="XL - 4"
              :y="sy(t) + 3"
              text-anchor="end"
            >
              {{ t }} €
            </text>
            <text
              v-for="t in xTicks"
              :key="'xt' + t"
              :x="sx(t)"
              :y="XT + XH + 12"
              text-anchor="middle"
            >
              {{ t }}
            </text>
            <text
              :x="sx(xMax)"
              :y="XT + XH + 12"
              text-anchor="end"
              dy="10"
              class="ob-achslabel"
            >
              MTok Exec-Cache-Read
            </text>
          </g>
          <!-- eigener Regler-Wert -->
          <g v-if="reglerImBild">
            <line
              :x1="sx(readM)"
              :y1="XT"
              :x2="sx(readM)"
              :y2="XT + XH"
              class="ob-regler"
            />
            <text
              :x="reglerRechts ? sx(readM) - 4 : sx(readM) + 4"
              :y="XT + 10"
              :text-anchor="reglerRechts ? 'end' : 'start'"
              class="ob-reglertext"
            >
              dein Regler: {{ readM }} MTok
            </text>
          </g>
          <!-- Wert jenseits der Achse: Hinweis oben links (rechts sitzen die Linien-Labels) -->
          <text
            v-else
            :x="XL + 6"
            :y="XT + 10"
            text-anchor="start"
            class="ob-reglertext"
          >
            dein Regler: {{ readM }} MTok →
          </text>
          <!-- Kostengeraden -->
          <line
            :x1="sx(0)"
            :y1="sy(yOpus(0))"
            :x2="sx(xMax)"
            :y2="sy(yOpus(xMax))"
            class="ob-l-opus"
          />
          <line
            :x1="sx(0)"
            :y1="sy(yPlan(0))"
            :x2="sx(xMax)"
            :y2="sy(yPlan(xMax))"
            class="ob-l-plan"
          />
          <text
            :x="sx(xMax) - 4"
            :y="sy(yOpus(xMax)) - 5"
            text-anchor="end"
            class="ob-lt-opus"
          >
            Nur Opus
          </text>
          <text
            :x="sx(xMax) - 4"
            :y="sy(yPlan(xMax)) + 12"
            text-anchor="end"
            class="ob-lt-plan"
          >
            opusplan
          </text>
          <!-- Break-even-Marker -->
          <circle :cx="schnittX" :cy="schnittY" r="4" class="ob-punkt" />
          <text
            :x="badgeLinks ? schnittX - 8 : schnittX + 8"
            :y="schnittY - 8"
            :text-anchor="badgeLinks ? 'end' : 'start'"
            class="ob-badge"
          >
            Break-even ≈ {{ fmt1(xStar) }} MTok
          </text>
        </svg>
      </div>
    </div>

    <!-- Erklärungs- / Warn-Box -->
    <div class="ob-note" :class="{ warn: warnung }">
      <span v-if="warnung" class="ob-warnicon" aria-hidden="true">⚠</span>
      <p>{{ noteText }}</p>
    </div>
  </div>
</template>

<style scoped>
.ob {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text-primary);
}

/* Regler-Zeile */
.ob-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  padding: 6px 10px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 8px;
  background: var(--color-background-secondary);
}
.ob-slider {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.ob-slider input[type="range"] {
  width: 72px;
  accent-color: var(--color-text-info);
}
.ob-val {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11px;
  min-width: 34px;
  text-align: right;
  color: var(--color-text-primary);
}
.ob-ttl-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.ob-ttl-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.ob-ttl {
  display: inline-flex;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  overflow: hidden;
}
.ob-ttl button {
  padding: 1px 9px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 11px;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.ob-ttl button:hover {
  color: var(--color-text-secondary);
}
.ob-ttl button.on {
  background: color-mix(in srgb, var(--color-text-info) 12%, transparent);
  color: var(--color-text-primary);
}

/* zweispaltiger Hauptbereich */
.ob-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.ob-h {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.ob-versteckt {
  visibility: hidden;
}

/* Balken */
.ob-bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ob-row {
  display: grid;
  grid-template-columns: 96px 1fr 58px 58px;
  gap: 8px;
  align-items: center;
}
.ob-name {
  font-size: 11.5px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.ob-warnname {
  color: var(--color-text-danger);
}
.ob-track {
  height: 16px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 4px;
  background: var(--deck-surface, var(--color-background-primary));
  overflow: hidden;
  display: block;
}
.ob-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease;
}
.ob-f1 {
  background: color-mix(in srgb, var(--color-text-tertiary) 55%, transparent);
}
.ob-f2 {
  background: color-mix(in srgb, var(--color-text-warning) 75%, transparent);
}
.ob-f3 {
  background: color-mix(in srgb, var(--color-text-info) 75%, transparent);
}
.ob-f4 {
  background: color-mix(in srgb, var(--color-text-danger) 60%, transparent);
  border: 1px dashed var(--color-text-danger);
}
.ob-eur {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11.5px;
  text-align: right;
  color: var(--color-text-primary);
}
.ob-delta {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  text-align: right;
}
.ob-delta.gut {
  color: var(--color-text-success);
}
.ob-delta.schlecht {
  color: var(--color-text-danger);
}
.ob-fuss {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.35;
  color: var(--color-text-tertiary);
}

/* Chart */
.ob-chart {
  display: block;
  width: 100%;
  height: auto;
}
.ob-ok {
  fill: color-mix(in srgb, var(--color-text-success) 7%, transparent);
}
.ob-grid line {
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.ob-grid .ob-achse {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
}
.ob-ticktext text {
  font-size: 9px;
  fill: var(--color-text-tertiary);
}
.ob-achslabel {
  font-size: 9px;
}
.ob-regler {
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.ob-reglertext {
  font-size: 9.5px;
  fill: var(--color-text-secondary);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3;
}
.ob-l-opus {
  stroke: var(--color-text-warning);
  stroke-width: 2;
}
.ob-l-plan {
  stroke: var(--color-text-info);
  stroke-width: 2;
}
.ob-lt-opus,
.ob-lt-plan {
  font-size: 10px;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3;
}
.ob-lt-opus {
  fill: var(--color-text-warning);
}
.ob-lt-plan {
  fill: var(--color-text-info);
}
.ob-punkt {
  fill: var(--color-text-primary);
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 1.5;
}
.ob-badge {
  font-size: 10px;
  font-weight: 600;
  fill: var(--color-text-primary);
  paint-order: stroke;
  stroke: var(--deck-surface, var(--color-background-primary));
  stroke-width: 3;
}

/* Erklärungs-/Warn-Box */
.ob-note {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  min-height: 46px;
  padding: 7px 11px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 10px;
  background: var(--color-background-secondary);
}
.ob-note p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--color-text-primary);
}
.ob-note.warn {
  border-color: var(--color-text-danger);
  background: color-mix(in srgb, var(--color-text-danger) 8%, transparent);
}
.ob-warnicon {
  color: var(--color-text-danger);
  font-size: 14px;
  line-height: 1.3;
}

@media (prefers-reduced-motion: reduce) {
  .ob * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
