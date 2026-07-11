/**
 * usePredictSketch — Zustand der „Predict first"-Mechanik: eine mit dem
 * Zeiger skizzierte Vorhersage-Kurve auf einem Zeitraster [t0..tEnd].
 *
 * Der Host besitzt die Chart-Geometrie und übersetzt Pointer-Events selbst
 * in (t, v)-Paare; diese Composable übernimmt Raster, Lücken-Interpolation
 * beim Zeichnen, Coverage-Gate, Preset-Füllung und Auswertung (tailMean).
 * Das Vorhersage-Array selbst bleibt bewusst NICHT-reaktiv (Hot-Path beim
 * Zeichnen); `version` tickt nach jeder Änderung für computeds/Redraws.
 */
import { computed, ref } from "vue";

export interface PredictSketchOptions {
  t0: number; // Rasterstart (z.B. 20 s — ab hier wird vorhergesagt)
  tEnd: number; // Rasterende (z.B. 120 s)
  step: number; // Rasterschritt (z.B. 0.5 s)
  vMax: number; // Wertebereich [0..vMax] (Werte werden geklemmt)
  minCoverage?: number; // Anteil belegter Rasterpunkte fürs Start-Gate (0.55)
  minLastT?: number; // Skizze muss mindestens bis hierhin reichen (tEnd − 10)
}

export function usePredictSketch(opts: PredictSketchOptions) {
  const n = Math.round((opts.tEnd - opts.t0) / opts.step) + 1;
  const minCoverage = opts.minCoverage ?? 0.55;
  const minLastT = opts.minLastT ?? opts.tEnd - 10;

  let pred: (number | null)[] = new Array(n).fill(null);
  const version = ref(0);
  const skipped = ref(false);

  let lastIdx: number | null = null;
  let lastVal = 0;
  let drawing = false;

  const idxOfT = (t: number) => Math.round((t - opts.t0) / opts.step);
  const tOfIdx = (i: number) => opts.t0 + i * opts.step;
  const clampV = (v: number) => Math.max(0, Math.min(opts.vMax, v));
  const set = (i: number, v: number) => {
    if (i >= 0 && i < n) pred[i] = clampV(v);
  };

  function coverage(): number {
    let count = 0;
    for (const v of pred) if (v != null) count++;
    return count / n;
  }
  function lastPredT(): number | null {
    for (let i = n - 1; i >= 0; i--) if (pred[i] != null) return tOfIdx(i);
    return null;
  }

  /* Strichführung: pointerdown → strokeStart, pointermove → ink(t, v),
     pointerup/-cancel → strokeEnd. Sprünge zwischen Rasterpunkten werden
     linear interpoliert (schnelle Mausbewegung reißt sonst Lücken). */
  function strokeStart() {
    drawing = true;
    lastIdx = null;
  }
  function strokeEnd() {
    drawing = false;
    lastIdx = null;
  }
  function isDrawing() {
    return drawing;
  }
  function ink(t: number, v: number) {
    if (t < opts.t0 - 1 || t > opts.tEnd) {
      lastIdx = null;
      return;
    }
    const i = Math.max(0, Math.min(n - 1, idxOfT(Math.max(t, opts.t0))));
    if (lastIdx !== null && Math.abs(i - lastIdx) > 1) {
      const step = i > lastIdx ? 1 : -1;
      for (let k = lastIdx; k !== i; k += step) {
        const f = (k - lastIdx) / (i - lastIdx);
        set(k, lastVal + (v - lastVal) * f);
      }
    }
    set(i, v);
    lastIdx = i;
    lastVal = v;
    version.value++;
  }

  /* Preset-Kurve übernehmen (f: t → Wert). */
  function applyPreset(f: (t: number) => number) {
    for (let i = 0; i < n; i++) pred[i] = clampV(f(tOfIdx(i)));
    version.value++;
  }

  /* Vor dem Lauf: Lücken linear schließen, Ränder konstant fortsetzen. */
  function fillGaps() {
    let firstI: number | null = null;
    let lastI: number | null = null;
    for (let i = 0; i < n; i++)
      if (pred[i] != null) {
        if (firstI == null) firstI = i;
        lastI = i;
      }
    if (firstI == null || lastI == null) return;
    for (let i = 0; i < firstI; i++) pred[i] = pred[firstI];
    for (let i = lastI + 1; i < n; i++) pred[i] = pred[lastI];
    let i = firstI;
    while (i < lastI) {
      if (pred[i + 1] == null) {
        let j = i + 1;
        while (pred[j] == null) j++;
        for (let k = i + 1; k < j; k++)
          pred[k] = pred[i]! + (pred[j]! - pred[i]!) * ((k - i) / (j - i));
        i = j;
      } else i++;
    }
    version.value++;
  }

  function clear() {
    pred = new Array(n).fill(null);
    skipped.value = false;
    lastIdx = null;
    version.value++;
  }
  function skip() {
    skipped.value = true;
    version.value++;
  }

  /* Start-Gate: Skizze deckt genug ab UND reicht (fast) bis zum rechten
     Rand — oder die Vorhersage wurde explizit übersprungen. */
  const ready = computed(() => {
    void version.value;
    if (skipped.value) return true;
    const lt = lastPredT();
    return coverage() >= minCoverage && lt !== null && lt >= minLastT;
  });
  const covWarn = computed(() => {
    void version.value;
    return !ready.value && coverage() > 0;
  });
  const hasInk = computed(() => {
    void version.value;
    return pred.some((v) => v != null);
  });

  /* Punkte fürs Zeichnen: {t, v|null} — null-Segmente unterbrechen die Linie. */
  function points(): { t: number; v: number | null }[] {
    return pred.map((v, i) => ({ t: tOfIdx(i), v }));
  }

  /* Mittelwert der Vorhersage ab t ≥ from (für das Verdict). */
  function tailMean(from: number): number | null {
    if (skipped.value) return null;
    const idx0 = Math.max(0, idxOfT(from));
    let sum = 0;
    let count = 0;
    for (let i = idx0; i < n; i++)
      if (pred[i] != null) {
        sum += pred[i]!;
        count++;
      }
    return count ? sum / count : null;
  }

  return {
    version,
    skipped,
    ready,
    covWarn,
    hasInk,
    strokeStart,
    strokeEnd,
    isDrawing,
    ink,
    applyPreset,
    fillGaps,
    clear,
    skip,
    points,
    tailMean,
  };
}
