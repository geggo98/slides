/**
 * winners — wer ist bei einer Metrik besser: Alternative oder Pool?
 *
 * Kleiner ist besser (Wartezeit, Gesamtzeit). Der Kern der M/M/c-Folie: Im
 * Tempo-Modus küren Wartezeit Wq und Gesamtzeit T verschiedene Sieger, weil
 * T = Wq + Bedienzeit und die Bedienzeit 1/(cμ) gegen 1/μ beträgt.
 *
 * Messwerte rauschen, daher `WinnerTracker`: erst nach genügend Abgängen ein
 * Urteil, und ein Wechsel des Siegers nur bei deutlichem Vorsprung
 * (Hysterese). Sonst flackert die Anzeige bei fast gleichen Werten.
 */

export type Side = "alt" | "pool";
export type Verdict = Side | "tie" | "pending";

/** Relativer Abstand |a−b| / max(a, b); 0 bei zwei Nullen. */
export function relGap(a: number, b: number): number {
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m > 0 ? Math.abs(a - b) / m : 0;
}

/** Sieger nach reinem Vergleich, mit Toleranz für „gleich“. */
export function winner(alt: number, pool: number, tol = 0): Side | "tie" {
  if (!Number.isFinite(alt) && !Number.isFinite(pool)) return "tie";
  if (relGap(alt, pool) <= tol) return "tie";
  return alt < pool ? "alt" : "pool";
}

export class WinnerTracker {
  private current: Verdict = "pending";

  constructor(
    /** Mindestzahl Abgänge je Seite vor dem ersten Urteil. */
    readonly minSamples = 40,
    /** Unterhalb dieses relativen Abstands gilt „≈ gleich“. */
    readonly tieBand = 0.03,
    /** Ein amtierender Sieger fällt erst bei diesem Vorsprung des anderen. */
    readonly switchGap = 0.08,
  ) {}

  get verdict(): Verdict {
    return this.current;
  }

  reset(): void {
    this.current = "pending";
  }

  update(alt: number, pool: number, samples: number): Verdict {
    if (samples < this.minSamples) {
      this.current = "pending";
      return this.current;
    }
    const raw = winner(alt, pool, 0);
    const gap = relGap(alt, pool);
    const cur = this.current;
    if (cur === "alt" || cur === "pool") {
      // Amtierender Sieger bleibt, bis der andere deutlich vorne liegt.
      if (raw !== cur && raw !== "tie" && gap > this.switchGap)
        this.current = raw;
    } else {
      this.current = gap <= this.tieBand ? "tie" : raw;
    }
    return this.current;
  }
}
