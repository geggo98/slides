/**
 * scenarioState.ts — das EINE Szenario, das beide Rechner-Folien beschreiben.
 *
 * Warum geteilt: die opusplan-Folie (Modellwechsel Opus → Sonnet) und die
 * Codex-Folie (Effort-Wechsel xhigh → medium) rechnen dieselbe Session
 * durch — Kontext beim Wechsel, Exec-Volumen, Rückkehren in den Plan-Modus.
 * Nur wenn beide Folien dasselbe Szenario zeigen, ist die Ersparnis
 * vergleichbar („opusplan schafft −37 %, der Effort-Wechsel −40 %“). Dreht
 * der Vortragende auf der einen Folie am Regler, muss die andere folgen.
 *
 * Darum liegen die Regler-Werte hier im Modul-Scope statt als `ref` in der
 * Komponente: Slidev hält Nachbarfolien gemountet, jede Folie hat ihre
 * eigene Komponenten-Instanz, und nur ein modul-globaler `ref` überlebt den
 * Folienwechsel (Muster: 20260707-…/components/agentRunState.ts).
 *
 * Die Volumina sind Mediane echter Opus→Sonnet-Sessions (57 Sessions, Archiv
 * data/opusplan-sessions/, siehe ./opusplanMath.ts). Für Codex gelten sie vorläufig unverändert; die
 * spätere Umrechnung Claude → Codex (anderer Tokenizer, andere Schrittzahl)
 * wird eine reine Funktion zwischen diesem Zustand und `codexSzenarien()` —
 * Platzhalter `toCodexSzenario()` in ./codexEffortMath.ts. Der Zustand
 * selbst bleibt dabei Claude-seitig, damit die opusplan-Folie nichts merkt.
 *
 * Einheiten sind Anzeige-Einheiten der Regler (kTok bzw. MTok); die
 * Rechenmodelle bekommen MTok.
 */
import { ref } from "vue";

export interface Szenario {
  /** Kontext beim ersten Wechsel Plan → Exec, kTok (Median 179k). */
  ctxK: number;
  /** Exec-Cache-Read je Session, MTok (Median 21 M, Quartile 8 / 56). */
  readM: number;
  /** Exec-Output je Session, kTok (Median 76k, Quartile 31k / 135k). */
  outK: number;
  /**
   * Rückkehren in den Plan-Modus, im Worst Case mit kaltem Cache (zwei volle
   * Brüche je Rückkehr). Default 2: Median der 25 Sessions mit Rückkehr;
   * beobachtetes Maximum 9. Dass ein Bruch voll ausfällt, ist die Ausnahme
   * (12 von 81 Rückkehren) — der Regler zeigt die Obergrenze, nicht den Normalfall.
   */
  n: number;
}

export const SZENARIO_DEFAULTS: Readonly<Szenario> = Object.freeze({
  ctxK: 180,
  readM: 21,
  outK: 80,
  n: 2,
});

/** Regler-Bereiche, auf beiden Folien identisch. */
export const SZENARIO_BEREICHE = Object.freeze({
  ctxK: { min: 80, max: 700, step: 10 },
  readM: { min: 5, max: 120, step: 1 },
  outK: { min: 80, max: 400, step: 10 },
  n: { min: 0, max: 13, step: 1 },
} as const);

export const ctxK = ref(SZENARIO_DEFAULTS.ctxK);
export const readM = ref(SZENARIO_DEFAULTS.readM);
export const outK = ref(SZENARIO_DEFAULTS.outK);
export const n = ref(SZENARIO_DEFAULTS.n);

export function resetSzenario(): void {
  ctxK.value = SZENARIO_DEFAULTS.ctxK;
  readM.value = SZENARIO_DEFAULTS.readM;
  outK.value = SZENARIO_DEFAULTS.outK;
  n.value = SZENARIO_DEFAULTS.n;
}

/** Momentaufnahme der Regler als reines Objekt (für Rechenmodelle und Tests). */
export function szenarioSnapshot(): Szenario {
  return {
    ctxK: ctxK.value,
    readM: readM.value,
    outK: outK.value,
    n: n.value,
  };
}
