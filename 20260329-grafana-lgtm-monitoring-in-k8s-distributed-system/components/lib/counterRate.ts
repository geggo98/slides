/**
 * counterRate — Raten aus monotonen Zählern, wie Prometheus' `rate(x[1m])`.
 *
 * Die Simulatoren zählen wie ein Exporter: abgearbeitete Gäste
 * (`departures_total`) und belegte Bediensekunden (`busy_seconds_total`).
 * Durchsatz und Auslastung sind dann Zuwachs pro Sekunde über ein Fenster —
 * statt eines Zählers über wenige Sekunden, der in Stufen von 1/Fenster
 * springt und die Auslastung zittern lässt, obwohl sie es nicht tut.
 */

export class CounterRate {
  private snaps: { t: number; c: Record<string, number> }[] = [];

  constructor(readonly maxSnaps = 4000) {}

  reset(): void {
    this.snaps = [];
  }

  push(t: number, counters: Record<string, number>): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && t <= last.t) return;
    this.snaps.push({ t, c: { ...counters } });
    if (this.snaps.length > this.maxSnaps * 1.25)
      this.snaps.splice(0, this.snaps.length - this.maxSnaps);
  }

  /**
   * Zuwachs pro Sekunde über die letzten `window` Sekunden. Liegt weniger
   * Historie vor, zählt der vorhandene Zeitraum (wie `rate()` am Serienanfang).
   * null, solange es keine zwei Stützpunkte gibt.
   */
  rate(key: string, window: number): number | null {
    const n = this.snaps.length;
    if (n < 2) return null;
    const cur = this.snaps[n - 1]!;
    const lo = cur.t - window;
    // Ältester Stützpunkt, der noch im Fenster liegt (Zeiten sind monoton).
    let i = n - 2;
    while (i > 0 && this.snaps[i - 1]!.t >= lo) i--;
    const old = this.snaps[i]!;
    const dt = cur.t - old.t;
    if (!(dt > 0)) return null;
    return ((cur.c[key] ?? 0) - (old.c[key] ?? 0)) / dt;
  }
}
