<script setup lang="ts">
/**
 * CodexEffortBreakEven — interaktive Kostenrechnung zur Codex-Effort-Folie,
 * Schwester von ./OpusplanBreakEven.vue: Effort- statt Modellwechsel, ohne
 * Break-even-Chart (die Folie trägt zusätzlich den Config-Block, der Platz
 * reicht nur für die Balken).
 *
 * Klick-Vertrag (Folie: `clicks: 3`, `:step="$clicks >= 3 ? 1 : 0"` — die
 * Klicks 1–2 gehören dem ⓘ-Popup in ./CodexReasoningScopeInfo.vue):
 *   Step 0 → Regler + Szenario-Balken (Nur medium / Nur xhigh / Effort-Wechsel)
 *   Step 1 → + Anti-Pattern-Balken und ⚠-Warnung (Re-Plans ohne /compact)
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
 */
import { computed, ref, watch } from "vue";
import { fmt } from "./paretoData";
import {
  DEFAULT_MODELL,
  MODELLE,
  OPUSPLAN_REF,
  effortFaktorRegler,
  szenarien,
  toEur,
  type ModellKey,
} from "./lib/codexEffortMath";

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
const readM = ref(30); // Exec-Cache-Read, MTok (opusplan-Median)
// Default 3 wie auf der opusplan-Folie; der Balken kippt hier erst bei 6.
const n = ref(3); // Re-Plans ohne /compact
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

const erg = computed(() =>
  szenarien({
    modell: modellKey.value,
    faktor: faktor.value,
    execRead: readM.value,
    replans: n.value,
    cacheErhalten: cacheErhalten.value,
  }),
);

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

const showAnti = computed(() => step.value >= 1);

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
const opusplanProzent = Math.round(OPUSPLAN_REF.ersparnisProzent);

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
  if (cacheErhalten.value)
    return `Ohne Cache-Bruch (configuration_update, Zielzustand): Effort-Wechsel spart ${fmt(toEur(e.ersparnis))} € (−${prozent.value} %) gegenüber durchgängig xhigh, jeder Faktor über 1,0× lohnt sich. Laut API-Doku nur GPT-6 Astra; Codex setzt es erst ab 0.155 vollständig um.`;
  if (spart.value)
    return `Effort-Wechsel spart hier ${fmt(toEur(e.ersparnis))} € (−${prozent.value} %) gegenüber durchgängig xhigh — opusplan schafft −${opusplanProzent} %. Der eine Cache-Bruch kostet ${bruchEur.value} €, Break-even bei ${breakEvenText.value} Exec-Read.`;
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
      <label class="ce-slider">
        <span>Exec-Read</span>
        <input v-model.number="readM" type="range" min="5" max="120" step="1" />
        <span class="ce-val">{{ readM }} M</span>
      </label>
      <label class="ce-slider">
        <span>Re-Plans</span>
        <input v-model.number="n" type="range" min="0" max="13" step="1" />
        <span class="ce-val">{{ n }}×</span>
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

    <div class="ce-main">
      <div class="ce-headrow">
        <span class="ce-h">Gesamtkosten pro Session</span>
        <span class="ce-vorlaeufig"
          >⚠ vorläufige Zahlen — Token-Verbrauch aus Claude übernommen,
          geschätzter Effort-Faktor</span
        >
      </div>
      <div class="ce-bars" role="img" :aria-label="balkenLabel">
        <div class="ce-row">
          <span class="ce-name">Nur medium ¹</span>
          <span class="ce-track"
            ><span class="ce-fill ce-f1" :style="{ width: pct(eur.s1) + '%' }"
          /></span>
          <span class="ce-eur">{{ fmt(eur.s1) }} €</span>
          <span class="ce-delta" />
        </div>
        <div class="ce-row">
          <span class="ce-name">Nur xhigh</span>
          <span class="ce-track"
            ><span class="ce-fill ce-f2" :style="{ width: pct(eur.s2) + '%' }"
          /></span>
          <span class="ce-eur">{{ fmt(eur.s2) }} €</span>
          <span class="ce-delta" />
        </div>
        <div class="ce-row">
          <span class="ce-name">Effort-Wechsel</span>
          <span class="ce-track"
            ><span class="ce-fill ce-f3" :style="{ width: pct(eur.s3) + '%' }"
          /></span>
          <span class="ce-eur">{{ fmt(eur.s3) }} €</span>
          <span class="ce-delta" :class="spart ? 'gut' : 'schlecht'">{{
            deltaWechsel
          }}</span>
        </div>
        <div class="ce-row" :class="{ 'ce-versteckt': !showAnti }">
          <span class="ce-name ce-warnname">⚠ Anti-Pattern</span>
          <span class="ce-track"
            ><span class="ce-fill ce-f4" :style="{ width: pct(eur.s4) + '%' }"
          /></span>
          <span class="ce-eur">{{ fmt(eur.s4) }} €</span>
          <span class="ce-delta schlecht">{{ deltaAnti }}</span>
        </div>
      </div>
      <p class="ce-fuss">
        ¹ billiger, aber schwächerer Plan — Qualitäts-, kein Preisvergleich.
        Badge: Δ vs. Nur xhigh bzw. durch Re-Plans.
      </p>
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

/* Regler-Zeile — fünf Bedienelemente auf einer Zeile (848 px nutzbar) */
.ce-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  padding: 6px 10px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 8px;
  background: var(--color-background-secondary);
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
  width: 62px;
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

.ce-main {
  display: flex;
  flex-direction: column;
}
.ce-headrow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.ce-h {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
}
.ce-vorlaeufig {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--color-text-warning);
  white-space: nowrap;
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
  grid-template-columns: 108px 1fr 72px 62px; /* 72: vierstellige €-Beträge (Astra × 8 × 120 MTok) brechen sonst um */
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
