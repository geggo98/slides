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
 * Die Volumina sind Claude-Code-Mediane (42 802 Requests, siehe
 * ./opusplanMath.ts). Für Codex gelten sie vorläufig unverändert; die
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
  /** Kontext beim Wechsel Plan → Exec, kTok (Median 177k). */
  ctxK: number;
  /** Exec-Cache-Read, MTok (Median langer Läufe ≈ 31 M). */
  readM: number;
  /** Exec-Output, kTok. */
  outK: number;
  /**
   * Re-Plans ohne /compact. Default 3: dort liegen Anti-Pattern und
   * „Nur Opus“ praktisch gleichauf (Schnittpunkt der Balken bei 3,05), die
   * vierte Rückkehr schiebt den Balken klar darüber. Beobachtetes Maximum
   * der eigenen Historie: 13.
   */
  n: number;
}

export const SZENARIO_DEFAULTS: Readonly<Szenario> = Object.freeze({
  ctxK: 180,
  readM: 30,
  outK: 150,
  n: 3,
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
