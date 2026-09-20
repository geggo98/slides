<script setup lang="ts">
/**
 * CodexEffortBreakEven — interaktive Kostenrechnung zur Codex-Rechnerfolie,
 * Schwester von ./OpusplanBreakEven.vue: Effort- statt Modellwechsel,
 * gleiches Layout (Regler, Balken links, Break-even-Chart rechts, Notiz).
 *
 * Klick-Vertrag wie opusplan (`clicks: 2` im Frontmatter, `:step="$clicks"`):
 *   Step 0 → Regler + Szenario-Balken (Nur medium / Nur xhigh / Effort-Wechsel)
 *   Step 1 → + Break-even-Chart (rechte Hälfte, visibility-Toggle: kein Reflow)
 *   Step 2 → + Anti-Pattern-Balken und ⚠-Warnung (Re-Plans ohne /compact)
 *
 * Regler in zwei Zeilen (sieben Bedienelemente passen nicht in 848 px):
 *   Zeile 1 — Codex-spezifisch: Modell-Pillen, Effort-Faktor, „Cache erhalten“
 *   Zeile 2 — das Szenario: Kontext, Exec-Read, Exec-Out, Re-Plans. Diese
 *   vier sind modul-globaler Zustand aus ./lib/scenarioState.ts, geteilt mit
 *   der opusplan-Folie — beide Rechner beschreiben dasselbe Szenario, sonst
 *   wären die Ersparnisse („opusplan −37 %“ gegen „Effort-Wechsel −40 %“)
 *   nicht vergleichbar. Darum rechnet auch die Notiz den opusplan-Vergleich
 *   live über den geteilten Reglern (`opusplanVergleich`, 1-h-TTL — der
 *   TTL-Schalter der opusplan-Folie ist dort lokal) statt gegen die
 *   Default-Konstante `OPUSPLAN_REF`. Eine TTL gibt es hier nicht (OpenAI
 *   kennt nur 30 min).
 *
 * Die Regler sind orthogonal zu den Klick-Schritten; `@click.stop` auf der
 * Regler-Zeile verhindert Folienwechsel. Ein fokussierter `<input type="range">`
 * fängt ArrowLeft/Right nativ ab (verändert den eigenen Wert statt die Folie
 * weiterzuschalten), und Slidev schaltet seine Shortcuts ab, solange ein
 * Button fokussiert ist — darum gibt die Regler-Zeile nach JEDER Zeiger-
 * bedienung den Fokus ab (`blurLater`), sonst steht die Folie im Vortrag
 * still, sobald nach einem Klick der Presenter-Klicker kommt.
 *
 * Das „⚠ vorläufig“-Badge bleibt bei jedem Reglerstand sichtbar: die Volumina
 * sind von der opusplan-Folie geliehen, der Effort-Faktor stammt aus der
 * DeepSWE-Leiter (siehe ./lib/codexEffortMath.ts, Kopfkommentar).
 *
 * Rechenmodell und Datenherkunft: ./lib/codexEffortMath.ts (per vitest gepinnt).
 * Chart: ./BreakEvenChart.vue (geteilt mit der opusplan-Folie).
 */
import { computed, ref, watch } from "vue";
import { fmt } from "./paretoData";
import {
  DEFAULT_MODELL,
  MODELLE,
  effortFaktorRegler,
  kostenGeraden,
  opusplanVergleich,
  szenarien,
  toCodexSzenario,
  toEur,
  type Eingaben,
  type ModellKey,
} from "./lib/codexEffortMath";
import {
  SZENARIO_BEREICHE as B,
  ctxK,
  n,
  outK,
  readM,
} from "./lib/scenarioState";
import BreakEvenChart, { type BreakEvenLinie } from "./BreakEvenChart.vue";

const props = defineProps<{ step?: number }>();
const step = computed(() => props.step ?? 0);

// ── Regler ──────────────────────────────────────────────────────────────────
const modellKey = ref<ModellKey>(DEFAULT_MODELL);
const faktor = ref(effortFaktorRegler(DEFAULT_MODELL)); // xhigh ÷ medium
// Solange niemand am Faktor gedreht hat, folgt er dem Modell (Leiter-Wert).
const faktorManuell = ref(false);
watch(modellKey, (key) => {
  if (!faktorManuell.value) faktor.value = effortFaktorRegler(key);
});
// Szenario-Regler (ctxK, readM, outK, n): siehe Kopfkommentar, geteilt.
// Default n = 3 wie auf der opusplan-Folie; der Balken kippt hier erst bei 6.
const cacheErhalten = ref(false); // configuration_update, experimentell

// Fokus abgeben, sobald Maus/Touch fertig sind — sonst frisst ein weiterhin
// fokussiertes Element den nächsten ArrowRight/ArrowLeft des Presenter-
// Klickers, statt ihn an Slidev durchzureichen. Zweimal: sofort, weil Thumb
// und Buttons schon beim mousedown fokussiert sind (ein Klick auf den Thumb
// ohne Bewegung oder auf das „exp.“-Span löst kein `change` aus und ließe
// den Fokus stehen); und verzögert (Makrotask), weil ein Klick auf den
// Label-Text den Range-Input erst NACH dem Klick fokussiert. `@change`
// bleibt für ein Ziehen, das außerhalb der Zeile losgelassen wird. Nur
// Zeigerbedienung — wer per Tab hineinfokussiert, behält den Fokus.
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();
const blurLater = () => {
  blurActive();
  setTimeout(blurActive, 0);
};
const waehleModell = (key: ModellKey) => {
  modellKey.value = key;
};
const toggleCache = () => {
  cacheErhalten.value = !cacheErhalten.value;
};

const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");

// Das geteilte Szenario ist Claude-seitig gemessen; `toCodexSzenario` ist
// heute die Identität und der Ort, an dem eine Codex-Umrechnung landet.
const eingaben = computed<Eingaben>(() => {
  const s = toCodexSzenario({
    ctxK: ctxK.value,
    readM: readM.value,
    outK: outK.value,
    n: n.value,
  });
  return {
    modell: modellKey.value,
    faktor: faktor.value,
    ctx: s.ctxK / 1000,
    execRead: s.readM,
    execOut: s.outK / 1000,
    replans: s.n,
    cacheErhalten: cacheErhalten.value,
  };
});
const erg = computed(() => szenarien(eingaben.value));

// ── Balken (Gesamtkosten in €) ──────────────────────────────────────────────
const eur = computed(() => ({
  s1: toEur(erg.value.nurMedium),
  s2: toEur(erg.value.nurXhigh),
  s3: toEur(erg.value.effortWechsel),
  s4: toEur(erg.value.antiPattern),
}));

// Feste Skalen-Leiter statt fließendem Maximum (wie OpusplanBreakEven): kleine
// Regler-Bewegungen lassen die Skala nicht zittern. Spannweite Luna (≈ 1 €)
// bis Astra × Faktor 8 × 120 MTok (≈ 1 160 €), gemessen in codexEffortMath.
const BALKEN_LEITER = [
  2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200, 300, 500, 800, 1200,
];
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
const deltaWechsel = computed(() => {
  const d = toEur(erg.value.ersparnis);
  return spart.value ? `−${fmt(d)} €` : `+${fmt(-d)} €`;
});
const deltaAnti = computed(() => `+${fmt(eur.value.s4 - eur.value.s3)} €`);
const prozent = computed(() =>
  Math.round(Math.abs(erg.value.ersparnisProzent)),
);

// ── Texte ───────────────────────────────────────────────────────────────────
const bruchEur = computed(() => fmt(toEur(erg.value.bruchEinmal)));
const bruchPaarEur = computed(() => fmt(toEur(erg.value.rueckkehrBrueche)));
// Der neue Plan auf xhigh je Rückkehr — im Anti-Pattern-Balken enthalten, im
// „Nur xhigh“-Balken nicht.
const replanEur = computed(() =>
  fmt(toEur(erg.value.rueckkehrGesamt - erg.value.rueckkehrBrueche)),
);
const breakEvenText = computed(() =>
  Number.isFinite(erg.value.breakEvenRead)
    ? `~${fmt1(erg.value.breakEvenRead)} MTok`
    : "nie",
);
// Aufgerundet auf zwei Stellen: sonst liest sich „1,1× liegt unter 1,10×“
// als Widerspruch, sobald der Regler knapp unter dem Break-even steht.
const breakEvenFaktorText = computed(
  () => `${fmt(Math.ceil(erg.value.breakEvenFaktor * 100) / 100)}×`,
);
// opusplan live über dem geteilten Szenario, nicht OPUSPLAN_REF (Kopfkommentar).
// Vorzeichen von Hand: unter dem Break-even kostet opusplan mehr als Nur Opus,
// dann steht „+3 %“ in der Notiz statt „−−3 %“ oder eines falschen „−3 %“.
const opusplanLive = computed(() =>
  opusplanVergleich({
    ctxK: ctxK.value,
    readM: readM.value,
    outK: outK.value,
    n: n.value,
  }),
);
const opusplanProzent = computed(() =>
  Math.round(Math.abs(opusplanLive.value.ersparnisProzent)),
);
const opusplanSchafft = computed(() =>
  opusplanLive.value.ersparnis >= 0
    ? `−${opusplanProzent.value} %`
    : `+${opusplanProzent.value} %`,
);
const proMtokEur = computed(() => fmt(toEur(erg.value.proMtokErsparnis)));

// ── Break-even-Chart (Geraden in €, Darstellung in ./BreakEvenChart.vue) ────
const xStar = computed(() => erg.value.breakEvenRead);
// x-Leiter {12, 20} wie opusplan: bei Regler-Faktor ≥ 1,5 liegt der Break-even
// unter 5 MTok (per Test gepinnt); knapp über 1,0× wandert er nach rechts
// hinaus, dann zeigt das Chart den Hinweis „→“ statt des Markers.
const xMax = computed(() => (xStar.value > 12 ? 20 : 12));
const xTicks = computed(() =>
  xMax.value === 12 ? [0, 4, 8, 12] : [0, 5, 10, 15, 20],
);
// y-Leiter über die ganze Spannweite der Modelle: Luna ≈ 1 € bis Astra ×
// Faktor 8 auf 20 MTok ≈ 200 € (bei 120 MTok wären es 1 160 €, die liegen
// aber rechts außerhalb der x-Achse).
const Y_LEITER = [5, 10, 15, 20, 25, 40, 60, 80, 120, 200, 300, 500];
const Y_TICKS: Record<number, number[]> = {
  5: [2.5, 5],
  10: [5, 10],
  15: [5, 10, 15],
  20: [10, 20],
  25: [10, 20],
  40: [20, 40],
  60: [30, 60],
  80: [40, 80],
  120: [60, 120],
  200: [100, 200],
  300: [150, 300],
  500: [250, 500],
};
const chartLines = computed<BreakEvenLinie[]>(() => {
  const g = kostenGeraden(eingaben.value);
  return [
    { label: "Nur xhigh", cls: "warning", at: (x) => toEur(g.nurXhigh(x)) },
    {
      label: "Effort-Wechsel",
      cls: "info",
      at: (x) => toEur(g.effortWechsel(x)),
    },
  ];
});
const chartLabel = computed(() =>
  Number.isFinite(xStar.value)
    ? `Kostengeraden über dem Exec-Volumen: Break-even bei etwa ${fmt1(xStar.value)} MTok Exec-Cache-Read, darüber ist der Effort-Wechsel billiger als durchgängig xhigh.`
    : `Kostengeraden über dem Exec-Volumen: bei Faktor ${fmt1(faktor.value)}× gibt es keinen Break-even, der Effort-Wechsel bleibt teurer als durchgängig xhigh.`,
);

const warnung = computed(() => showAnti.value && n.value >= 1);
const noteText = computed(() => {
  const e = erg.value;
  if (showAnti.value) {
    if (n.value === 0)
      return cacheErhalten.value
        ? `Regler „Re-Plans“: ohne Cache-Bruch (Zielzustand) kostet jede Rückkehr in den Plan-Mode nur den neuen Plan auf xhigh (≈ ${replanEur.value} €).`
        : `Regler „Re-Plans“: jede Rückkehr in den Plan-Mode ohne /compact kostet 2 zusätzliche Cache-Brüche (≈ ${bruchPaarEur.value} €) plus den neuen Plan auf xhigh (≈ ${replanEur.value} €).`;
    if (e.balkenUeberAb === 0)
      return `${n.value}× zurück in den Plan-Mode — und schon ohne Rückkehr ist der Effort-Wechsel hier teurer als „Nur xhigh“. Vor erneutem Planen: /compact.`;
    const brueche = cacheErhalten.value
      ? `je Rückkehr nur der neue Plan ≈ ${replanEur.value} € (ohne Bruch, Zielzustand)`
      : `je Rückkehr 2 Cache-Brüche ≈ ${bruchPaarEur.value} € + neuer Plan ≈ ${replanEur.value} €`;
    const schluss = Number.isFinite(e.ersparnisWegAb)
      ? `Ab ${e.balkenUeberAb}× liegt der Balken über „Nur xhigh“, allein die Brüche fressen die Ersparnis ab ${e.ersparnisWegAb}×`
      : `Ab ${e.balkenUeberAb}× liegt der Balken über „Nur xhigh“`;
    return `${n.value}× zurück in den Plan-Mode ohne /compact: ${brueche}. ${schluss}. Vor erneutem Planen: /compact.`;
  }
  if (showChart.value) {
    if (cacheErhalten.value)
      return `Ohne Cache-Bruch (Zielzustand) gibt es keinen Break-even: jedes MTok Exec-Cache-Read spart ${proMtokEur.value} €, der Wechsel lohnt ab dem ersten Token. Dein Regler: ${eingaben.value.execRead} MTok.`;
    if (!Number.isFinite(e.breakEvenRead))
      return `Faktor ${fmt1(faktor.value)}×: xhigh kostet nicht mehr als medium, der Wechsel bringt nichts und zahlt den Bruch (${bruchEur.value} €) obendrauf — kein Break-even.`;
    return `Break-even bei ${breakEvenText.value} Exec-Cache-Read: der eine Bruch kostet ${bruchEur.value} €, jedes weitere MTok spart ${proMtokEur.value} € (bei Faktor ${fmt1(faktor.value)}×). Dein Regler: ${eingaben.value.execRead} MTok.`;
  }
  if (cacheErhalten.value)
    return `Ohne Cache-Bruch (configuration_update, Zielzustand): Effort-Wechsel spart ${fmt(toEur(e.ersparnis))} € (−${prozent.value} %) gegenüber durchgängig xhigh, jeder Faktor über 1,0× lohnt sich. Laut API-Doku nur GPT-6 Astra; Codex setzt es erst ab 0.155 vollständig um.`;
  if (spart.value)
    return `Effort-Wechsel spart hier ${fmt(toEur(e.ersparnis))} € (−${prozent.value} %) gegenüber durchgängig xhigh — opusplan schafft hier ${opusplanSchafft.value} (1-h-TTL). Der eine Cache-Bruch kostet ${bruchEur.value} €, Break-even bei ${breakEvenText.value} Exec-Read.`;
  return `Effort-Wechsel kostet hier ${fmt(toEur(-e.ersparnis))} € mehr als „Nur xhigh“ — der Faktor ${fmt1(faktor.value)}× liegt unter dem Break-even ab ${breakEvenFaktorText.value}. Erst darüber zahlt sich der Cache-Bruch (${bruchEur.value} €) aus.`;
});

const balkenLabel = computed(
  () =>
    `Gesamtkosten pro Session: Nur medium ${fmt(eur.value.s1)} Euro, Nur xhigh ${fmt(eur.value.s2)} Euro, Effort-Wechsel ${fmt(eur.value.s3)} Euro, mit Anti-Pattern ${fmt(eur.value.s4)} Euro.`,
);
</script>

<template>
  <div class="ce">
    <!-- Regler -->
    <div class="ce-controls" @click.stop="blurLater" @change="blurLater">
      <div class="ce-zeile">
        <div class="ce-modell" role="group" aria-label="Modell">
          <button
            v-for="m in MODELLE"
            :key="m.key"
            :class="{ on: modellKey === m.key }"
            :aria-pressed="modellKey === m.key"
            @click="waehleModell(m.key)"
          >
            {{ m.label }}
          </button>
        </div>
        <label class="ce-slider">
          <span>Effort-Faktor</span>
          <input
            v-model.number="faktor"
            type="range"
            min="1"
            max="8"
            step="0.1"
            @input="faktorManuell = true"
          />
          <span class="ce-val">{{ fmt1(faktor) }}×</span>
        </label>
        <button
          class="ce-toggle"
          :class="{ on: cacheErhalten }"
          :aria-pressed="cacheErhalten"
          title="[features] reasoning_effort_override = true — configuration_update statt Prefix-Änderung; experimentell"
          @click="toggleCache"
        >
          Cache erhalten <span class="ce-exp">exp.</span>
        </button>
      </div>
      <div class="ce-zeile ce-szenario">
        <label class="ce-slider">
          <span>Kontext</span>
          <input
            v-model.number="ctxK"
            type="range"
            :min="B.ctxK.min"
            :max="B.ctxK.max"
            :step="B.ctxK.step"
          />
          <span class="ce-val">{{ ctxK }}k</span>
        </label>
        <label class="ce-slider">
          <span>Exec-Read</span>
          <input
            v-model.number="readM"
            type="range"
            :min="B.readM.min"
            :max="B.readM.max"
            :step="B.readM.step"
          />
          <span class="ce-val">{{ readM }} M</span>
        </label>
        <label class="ce-slider">
          <span>Exec-Out</span>
          <input
            v-model.number="outK"
            type="range"
            :min="B.outK.min"
            :max="B.outK.max"
            :step="B.outK.step"
          />
          <span class="ce-val">{{ outK }}k</span>
        </label>
        <label class="ce-slider">
          <span>Re-Plans</span>
          <input
            v-model.number="n"
            type="range"
            :min="B.n.min"
            :max="B.n.max"
            :step="B.n.step"
          />
          <span class="ce-val">{{ n }}×</span>
        </label>
        <span class="ce-geteilt">gekoppelt mit opusplan</span>
      </div>
    </div>

    <div class="ce-main">
      <!-- Szenario-Balken -->
      <div>
        <div class="ce-h">Gesamtkosten pro Session</div>
        <div class="ce-bars" role="img" :aria-label="balkenLabel">
          <div class="ce-row">
            <span class="ce-name">Nur medium ¹</span>
            <span class="ce-track"
              ><span
                class="ce-fill ce-f1"
                :style="{ width: pct(eur.s1) + '%' }"
            /></span>
            <span class="ce-eur">{{ fmt(eur.s1) }} €</span>
            <span class="ce-delta" />
          </div>
          <div class="ce-row">
            <span class="ce-name">Nur xhigh</span>
            <span class="ce-track"
              ><span
                class="ce-fill ce-f2"
                :style="{ width: pct(eur.s2) + '%' }"
            /></span>
            <span class="ce-eur">{{ fmt(eur.s2) }} €</span>
            <span class="ce-delta" />
          </div>
          <div class="ce-row">
            <span class="ce-name">Effort-Wechsel</span>
            <span class="ce-track"
              ><span
                class="ce-fill ce-f3"
                :style="{ width: pct(eur.s3) + '%' }"
            /></span>
            <span class="ce-eur">{{ fmt(eur.s3) }} €</span>
            <span class="ce-delta" :class="spart ? 'gut' : 'schlecht'">{{
              deltaWechsel
            }}</span>
          </div>
          <div class="ce-row" :class="{ 'ce-versteckt': !showAnti }">
            <span class="ce-name ce-warnname">⚠ Anti-Pattern</span>
            <span class="ce-track"
              ><span
                class="ce-fill ce-f4"
                :style="{ width: pct(eur.s4) + '%' }"
            /></span>
            <span class="ce-eur">{{ fmt(eur.s4) }} €</span>
            <span class="ce-delta schlecht">{{ deltaAnti }}</span>
          </div>
        </div>
        <p class="ce-fuss">
          ¹ billiger, aber schwächerer Plan — Qualitäts-, kein Preisvergleich.
          Badge: Δ vs. Nur xhigh bzw. durch Re-Plans.<br /><span
            class="ce-vorlaeufig"
            >⚠ vorläufige Zahlen — Token-Verbrauch aus Claude übernommen,
            Effort-Faktor geschätzt.</span
          >
        </p>
      </div>

      <!-- Break-even-Chart -->
      <div :class="{ 'ce-versteckt': !showChart }">
        <div class="ce-h">Ab wann lohnt der Cache-Bruch?</div>
        <BreakEvenChart
          class="ce-chart"
          :lines="chartLines"
          :read-m="eingaben.execRead"
          :break-even="xStar"
          :x-max="xMax"
          :x-ticks="xTicks"
          :y-ladder="Y_LEITER"
          :y-tick-map="Y_TICKS"
          kein-break-even-text="kein Break-even (Faktor ≤ 1)"
          null-break-even-text="lohnt ab dem ersten Token"
          :aria-label="chartLabel"
        />
      </div>
    </div>

    <!-- Erklärungs- / Warn-Box -->
    <div class="ce-note" :class="{ warn: warnung }">
      <span v-if="warnung" class="ce-warnicon" aria-hidden="true">⚠</span>
      <p>{{ noteText }}</p>
    </div>
  </div>
</template>

<style scoped>
.ce {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text-primary);
}

/* Regler — zwei Zeilen: Codex-spezifisch oben, das geteilte Szenario unten */
.ce-controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 10px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 8px;
  background: var(--color-background-secondary);
}
.ce-zeile {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px 12px;
  align-items: center;
}
.ce-szenario {
  padding-top: 5px;
  border-top: 0.5px solid var(--color-border-tertiary);
}
.ce-geteilt {
  margin-left: auto;
  font-size: 10px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
.ce-slider {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
.ce-slider input[type="range"] {
  width: 66px;
  accent-color: var(--color-text-info);
}
.ce-val {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11px;
  min-width: 30px;
  text-align: right;
  color: var(--color-text-primary);
}
.ce-modell,
.ce-toggle {
  display: inline-flex;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 999px;
  overflow: hidden;
}
.ce-modell button,
.ce-toggle {
  padding: 1px 9px;
  background: none;
  font: inherit;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
  cursor: pointer;
  white-space: nowrap;
}
.ce-modell button {
  border: 0; /* die Pille trägt den Rahmen, nicht die Knöpfe darin */
}
.ce-toggle {
  margin-left: auto;
}
/* Kein <sup>: das hebt die Zeile an und wird vom runden Pill abgeschnitten. */
.ce-exp {
  font-size: 8px;
  font-weight: 600;
  margin-left: 3px;
  vertical-align: 1px;
  color: var(--color-text-warning);
}
.ce-modell button:hover,
.ce-toggle:hover {
  color: var(--color-text-secondary);
}
.ce-modell button.on,
.ce-toggle.on {
  background: color-mix(in srgb, var(--color-text-info) 12%, transparent);
  color: var(--color-text-primary);
}

/* zweispaltiger Hauptbereich wie OpusplanBreakEven */
.ce-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.ce-h {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.ce-vorlaeufig {
  font-weight: 600;
  color: var(--color-text-warning);
}
.ce-versteckt {
  visibility: hidden;
}

/* Balken */
.ce-bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ce-row {
  display: grid;
  grid-template-columns: 96px 1fr 68px 58px; /* 68: vierstellige €-Beträge (Astra × 8 × 120 MTok) brechen sonst um */
  gap: 8px;
  align-items: center;
}
.ce-name {
  font-size: 11.5px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.ce-warnname {
  color: var(--color-text-danger);
}
.ce-track {
  height: 16px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 4px;
  background: var(--deck-surface, var(--color-background-primary));
  overflow: hidden;
  display: block;
}
.ce-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease;
}
.ce-f1 {
  background: color-mix(in srgb, var(--color-text-tertiary) 55%, transparent);
}
.ce-f2 {
  background: color-mix(in srgb, var(--color-text-warning) 75%, transparent);
}
.ce-f3 {
  background: color-mix(in srgb, var(--color-text-info) 75%, transparent);
}
.ce-f4 {
  background: color-mix(in srgb, var(--color-text-danger) 60%, transparent);
  border: 1px dashed var(--color-text-danger);
}
.ce-eur {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 11.5px;
  text-align: right;
  color: var(--color-text-primary);
}
.ce-delta {
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 10.5px;
  text-align: right;
}
.ce-delta.gut {
  color: var(--color-text-success);
}
.ce-delta.schlecht {
  color: var(--color-text-danger);
}
.ce-fuss {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.35;
  color: var(--color-text-tertiary);
}

/* Erklärungs-/Warn-Box */
.ce-note {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  min-height: 46px;
  padding: 7px 11px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 10px;
  background: var(--color-background-secondary);
}
.ce-note p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--color-text-primary);
}
.ce-note.warn {
  border-color: var(--color-text-danger);
  background: color-mix(in srgb, var(--color-text-danger) 8%, transparent);
}
.ce-warnicon {
  color: var(--color-text-danger);
  font-size: 14px;
  line-height: 1.3;
}

@media (prefers-reduced-motion: reduce) {
  .ce * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
