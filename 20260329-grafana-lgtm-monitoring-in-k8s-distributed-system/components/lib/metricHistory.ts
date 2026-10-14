/**
 * metricHistory — Zeitreihen-Speicher für die Simulator-Dashboards.
 *
 * Speichert Proben `(Sim-Zeit, Wert)` je Serie plus Annotationen
 * (Parameteränderungen). Liefert Grafana-artige Zeitfenster („1m“, „5m“,
 * „seit Änderung“) und ein Downsampling auf Pixel-Buckets, das Minimum und
 * Maximum je Bucket behält: Spitzen verschwinden nicht.
 *
 * Speicher mit fester Obergrenze wie RRDtool bzw. Prometheus-Downsampling:
 * Läuft er voll, werden alle Punkte paarweise zusammengefasst (Min, Max,
 * Mittel) — die Auflösung halbiert sich, der ganze Zeitraum bleibt erhalten,
 * und der Aufwand pro Bild bleibt konstant, egal wie lange die Simulation
 * läuft. Neue Proben werden bis zur nächsten Runde in gleicher Auflösung
 * gesammelt (`stride` Proben je Punkt).
 */

export type RangeKey = "1m" | "5m" | "since";

export const RANGES: { key: RangeKey; label: string; seconds: number }[] = [
  { key: "1m", label: "1m", seconds: 60 },
  { key: "5m", label: "5m", seconds: 300 },
  { key: "since", label: "seit Änderung", seconds: Infinity },
];

export interface Annotation {
  t: number;
  label: string;
}

export interface Bucket {
  /** Bucket-Mitte (Sim-Zeit). */
  t: number;
  min: number;
  max: number;
  avg: number;
}

interface Column {
  min: (number | null)[];
  max: (number | null)[];
  avg: (number | null)[];
}

const MAX_ANNOTATIONS = 50;

export class MetricHistory {
  readonly capacity: number;
  private t: number[] = [];
  private cols = new Map<string, Column>();
  /** Proben je gespeichertem Punkt; verdoppelt sich je Zusammenfassung. */
  private stride = 1;
  /** Proben im jüngsten, noch offenen Punkt. */
  private open = 0;
  annotations: Annotation[] = [];

  constructor(keys: string[], capacity = 2400) {
    this.capacity = Math.max(8, capacity);
    for (const k of keys) this.cols.set(k, { min: [], max: [], avg: [] });
  }

  get size(): number {
    return this.t.length;
  }

  get lastT(): number {
    return this.t.length ? this.t[this.t.length - 1]! : 0;
  }

  reset(): void {
    this.t = [];
    this.stride = 1;
    this.open = 0;
    for (const c of this.cols.values()) {
      c.min = [];
      c.max = [];
      c.avg = [];
    }
    this.annotations = [];
  }

  /** Eine Probe; fehlende oder nicht-endliche Werte werden als Lücke gespeichert. */
  push(t: number, values: Record<string, number | null | undefined>): void {
    const n = this.t.length;
    // Offener Punkt nimmt Proben auf, bis er `stride` Proben enthält.
    const join = n > 0 && this.open > 0 && this.open < this.stride;
    const k = this.open;
    if (join) this.t[n - 1] = (this.t[n - 1]! * k + t) / (k + 1);
    else this.t.push(t);
    for (const [key, c] of this.cols) {
      const x = values[key];
      const v = x != null && Number.isFinite(x) ? x : null;
      if (!join) {
        c.min.push(v);
        c.max.push(v);
        c.avg.push(v);
      } else if (v != null) {
        const i = n - 1;
        const a = c.avg[i];
        c.min[i] = a == null ? v : Math.min(c.min[i]!, v);
        c.max[i] = a == null ? v : Math.max(c.max[i]!, v);
        // Näherung: Lücken im Punkt zählen nicht mit.
        c.avg[i] = a == null ? v : (a * k + v) / (k + 1);
      }
    }
    this.open = join ? k + 1 : 1;
    if (this.t.length > this.capacity) this.consolidate();
  }

  /** Alle Punkte paarweise zusammenfassen: Auflösung halbiert sich. */
  private consolidate(): void {
    const pairs = Math.floor(this.t.length / 2);
    const merge = <T>(arr: T[], f: (a: T, b: T) => T) => {
      const out: T[] = new Array(pairs);
      for (let i = 0; i < pairs; i++) out[i] = f(arr[2 * i]!, arr[2 * i + 1]!);
      arr.splice(0, pairs * 2, ...out);
    };
    const nn =
      (f: (a: number, b: number) => number) =>
      (a: number | null, b: number | null) =>
        a == null ? b : b == null ? a : f(a, b);
    merge(this.t, (a, b) => (a + b) / 2);
    for (const c of this.cols.values()) {
      merge(c.min, nn(Math.min));
      merge(c.max, nn(Math.max));
      merge(
        c.avg,
        nn((a, b) => (a + b) / 2),
      );
    }
    this.stride *= 2;
    // Ein übrig gebliebener Einzelpunkt am Ende bleibt offen.
    this.open = this.t.length > pairs ? this.open : this.stride;
  }

  annotate(t: number, label: string): void {
    this.annotations.push({ t, label });
    if (this.annotations.length > MAX_ANNOTATIONS)
      this.annotations.splice(0, this.annotations.length - MAX_ANNOTATIONS);
  }

  /** Zeitpunkt der letzten Annotation, sonst 0 (Start). */
  lastChange(): number {
    const a = this.annotations[this.annotations.length - 1];
    return a ? a.t : 0;
  }

  /** Fenster [t0, t1] für einen Zeitbereich, bezogen auf `now`. */
  window(range: RangeKey, now = this.lastT): [number, number] {
    if (range === "since") {
      const t0 = this.lastChange();
      // Mindestbreite, damit direkt nach einer Änderung nicht durch 0 geteilt wird.
      return [t0, Math.max(now, t0 + 1)];
    }
    const sec = RANGES.find((r) => r.key === range)!.seconds;
    return [now - sec, now];
  }

  /** Letzter vorhandener Wert einer Serie. */
  last(key: string): number | null {
    const arr = this.cols.get(key)?.avg;
    if (!arr) return null;
    for (let i = arr.length - 1; i >= 0; i--)
      if (arr[i] != null) return arr[i]!;
    return null;
  }

  /**
   * Downsampling von [t0, t1] auf `buckets` gleich breite Buckets.
   * Leere Buckets fehlen im Ergebnis (Lücke statt erfundener Wert).
   */
  series(key: string, t0: number, t1: number, buckets: number): Bucket[] {
    const c = this.cols.get(key);
    if (!c || buckets < 1 || !(t1 > t0)) return [];
    const width = (t1 - t0) / buckets;
    const mins = new Array<number>(buckets).fill(Infinity);
    const maxs = new Array<number>(buckets).fill(-Infinity);
    const sums = new Array<number>(buckets).fill(0);
    const cnts = new Array<number>(buckets).fill(0);
    const ts = this.t;
    // Erste Probe im Fenster per Binärsuche (Zeiten sind monoton).
    let lo = 0;
    let hi = ts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ts[mid]! < t0) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < ts.length; i++) {
      const t = ts[i]!;
      if (t > t1) break;
      const a = c.avg[i];
      if (a == null) continue;
      const b = Math.min(buckets - 1, Math.floor((t - t0) / width));
      const mn = c.min[i]!;
      const mx = c.max[i]!;
      if (mn < mins[b]!) mins[b] = mn;
      if (mx > maxs[b]!) maxs[b] = mx;
      sums[b] = sums[b]! + a;
      cnts[b] = cnts[b]! + 1;
    }
    const out: Bucket[] = [];
    for (let b = 0; b < buckets; b++) {
      const n = cnts[b]!;
      if (!n) continue;
      out.push({
        t: t0 + (b + 0.5) * width,
        min: mins[b]!,
        max: maxs[b]!,
        avg: sums[b]! / n,
      });
    }
    return out;
  }
}
