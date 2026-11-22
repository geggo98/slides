/**
 * mwmbrMath — pures Modell für Multi-Window, Multi-Burn-Rate Alerting.
 *
 * Quelle: Google SRE Workbook, Kapitel 5 „Alerting on SLOs“, Table 5-8
 * (abgerufen 22.11.2026). Drei Regeln auf einem 30-Tage-Budget:
 * 14,4× über 1 h + 5 min (Alarm), 6× über 6 h + 30 min (Alarm),
 * 1× über 3 d + 6 h (Ticket). Die vierte Bedingung 3× über 24 h + 2 h steht
 * nur im PromQL-Beispiel des SRE Workbooks, nicht in der Tabelle, und fehlt hier.
 *
 * Verglichen wird strikt (`>`), wie im PromQL des SRE Workbooks. Die Zeit vor dem
 * Diagramm gilt als fehlerfrei. Alle Funktionen sind deterministisch: kein
 * Zufall, keine Uhr.
 */

/** Budgetperiode: 30 Tage. Nur dafür stimmen die Faktoren 14,4 / 6 / 1. */
export const PERIOD_H = 720;
export const PERIOD_MIN = PERIOD_H * 60;

export type Severity = "page" | "ticket";
export type GateMode = "and" | "long" | "short";

export interface Rule {
  key: string;
  severity: Severity;
  /** Burn-Rate-Schwelle θ. */
  theta: number;
  longMin: number;
  shortMin: number;
}

export const RULES: readonly Rule[] = [
  { key: "fast", severity: "page", theta: 14.4, longMin: 60, shortMin: 5 },
  { key: "slow", severity: "page", theta: 6, longMin: 360, shortMin: 30 },
  { key: "ticket", severity: "ticket", theta: 1, longMin: 4320, shortMin: 360 },
];

export const SLOS: readonly number[] = [0.995, 0.999, 0.9995];

/** Burn Rate = Fehlerquote / (1 − SLO). */
export function burnRate(errorRate: number, slo: number): number {
  return errorRate / (1 - slo);
}

/** Schwelle θ, bei der ein Alarm nach `longMin` den Budgetanteil verbraucht hat. */
export function thresholdFromBudget(
  budgetShare: number,
  longMin: number,
  periodMin: number = PERIOD_MIN,
): number {
  return (budgetShare * periodMin) / longMin;
}

/** Budgetanteil, der beim Feuern verbraucht ist: θ · Fenster / Periode. */
export function budgetShareAtFire(
  theta: number,
  longMin: number,
  periodMin: number = PERIOD_MIN,
): number {
  return (theta * longMin) / periodMin;
}

/** Minuten, bis ein volles Budget bei konstanter Burn Rate leer ist. */
export function minutesToExhaustion(
  burn: number,
  periodMin: number = PERIOD_MIN,
): number {
  return burn > 0 ? periodMin / burn : Infinity;
}

/**
 * Detektionszeit bei einem Sprung von 0 auf Burn `burn`: θ/B · langes Fenster.
 * Das lange Fenster bestimmt sie, das kurze überschreitet die Schwelle früher.
 */
export function detectionMin(
  theta: number,
  burn: number,
  longMin: number,
): number {
  return burn > theta ? (theta / burn) * longMin : Infinity;
}

/** Abschnitt mit konstanter Fehlerquote, `fromMin` inklusive, `toMin` exklusive. */
export interface Phase {
  fromMin: number;
  toMin: number;
  /** Fehlerquote als Anteil 0..1. */
  rate: number;
}

export interface Scenario {
  key: string;
  label: string;
  title: string;
  spanMin: number;
  /** Schrittweite in Sekunden. */
  stepS: number;
  /** Beginn der Störung; Zeiten in der Anzeige zählen ab hier. */
  onsetMin: number;
  /** Startposition des Zeitzeigers. */
  cursorMin: number;
  phases: Phase[];
}

/** Gleichmäßige Bursts: alle `everyMin` einer von `lengthMin` Länge. */
export function bursts(
  fromMin: number,
  toMin: number,
  everyMin: number,
  lengthMin: number,
  rate: number,
): Phase[] {
  const out: Phase[] = [];
  for (let t = fromMin; t < toMin; t += everyMin)
    out.push({ fromMin: t, toMin: Math.min(toMin, t + lengthMin), rate });
  return out;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    key: "spike",
    label: "Kurzer Spike",
    title: "15 % Fehler für 10 min",
    spanMin: 120,
    stepS: 1,
    onsetMin: 20,
    cursorMin: 28,
    phases: [{ fromMin: 20, toMin: 30, rate: 0.15 }],
  },
  {
    key: "outage",
    label: "Harter Ausfall",
    title: "100 % Fehler für 30 min",
    spanMin: 480,
    stepS: 1,
    onsetMin: 30,
    cursorMin: 45,
    phases: [{ fromMin: 30, toMin: 60, rate: 1 }],
  },
  {
    key: "past",
    label: "Schon vorbei",
    title: "20 % Fehler für 15 min, seit 15 min behoben",
    spanMin: 480,
    stepS: 1,
    onsetMin: 30,
    cursorMin: 60,
    phases: [{ fromMin: 30, toMin: 45, rate: 0.2 }],
  },
  {
    key: "creep",
    label: "Schleichend",
    title: "0,4 % Fehler dauerhaft",
    spanMin: 4320,
    stepS: 5,
    onsetMin: 120,
    cursorMin: 1440,
    phases: [{ fromMin: 120, toMin: 4320, rate: 0.004 }],
  },
  {
    key: "flap",
    label: "Flattern",
    title: "alle 30 min ein Burst: 2 min mit 5 % Fehlern",
    spanMin: 4320,
    stepS: 5,
    onsetMin: 120,
    cursorMin: 1800,
    phases: bursts(120, 4320, 30, 2, 0.05),
  },
];

/** Fehlerquote je Schritt. Überlappen sich Phasen, gilt die erste. */
export function errorTrace(sc: Scenario): Float64Array {
  const n = Math.round((sc.spanMin * 60) / sc.stepS);
  const err = new Float64Array(n);
  for (let p = sc.phases.length - 1; p >= 0; p--) {
    const ph = sc.phases[p]!;
    const from = Math.max(0, Math.ceil((ph.fromMin * 60) / sc.stepS));
    const to = Math.min(n, Math.ceil((ph.toMin * 60) / sc.stepS));
    for (let i = from; i < to; i++) err[i] = ph.rate;
  }
  return err;
}

/** P[i] = Fehler-Sekunden bis zum Zeitpunkt i · stepS; Länge n + 1. */
export function prefixSums(err: Float64Array, stepS: number): Float64Array {
  const P = new Float64Array(err.length + 1);
  for (let i = 0; i < err.length; i++) P[i + 1] = P[i]! + err[i]! * stepS;
  return P;
}

/**
 * Mittlere Fehlerquote im Fenster (t − W, t] am Zeitpunkt i. Reicht das
 * Fenster vor den Anfang, zählt die Vorgeschichte als fehlerfrei.
 */
export function windowMean(
  P: Float64Array,
  i: number,
  windowS: number,
  stepS: number,
): number {
  const j = Math.max(0, i - Math.round(windowS / stepS));
  return (P[i]! - P[j]!) / windowS;
}

export interface RuleWindows {
  rule: Rule;
  /** Burn Rate im langen bzw. kurzen Fenster je Zeitpunkt, Länge n + 1. */
  long: Float64Array;
  short: Float64Array;
}

export interface Run {
  scenario: Scenario;
  slo: number;
  /** Anzahl Schritte; Zeitpunkte laufen von 0 bis n. */
  n: number;
  stepS: number;
  err: Float64Array;
  /** Verbrauchter Anteil des 30-Tage-Budgets je Zeitpunkt (1 = leer). */
  consumed: Float64Array;
  rules: RuleWindows[];
  peakBurn: number;
}

export function simulate(
  sc: Scenario,
  slo: number,
  rules: readonly Rule[] = RULES,
): Run {
  const err = errorTrace(sc);
  const n = err.length;
  const P = prefixSums(err, sc.stepS);
  const budget = 1 - slo;
  const consumed = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) consumed[i] = P[i]! / (budget * PERIOD_MIN * 60);
  let peak = 0;
  for (let i = 0; i < n; i++) if (err[i]! > peak) peak = err[i]!;
  const windows = rules.map((rule) => {
    const long = new Float64Array(n + 1);
    const short = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      long[i] = windowMean(P, i, rule.longMin * 60, sc.stepS) / budget;
      short[i] = windowMean(P, i, rule.shortMin * 60, sc.stepS) / budget;
    }
    return { rule, long, short };
  });
  return {
    scenario: sc,
    slo,
    n,
    stepS: sc.stepS,
    err,
    consumed,
    rules: windows,
    peakBurn: peak / budget,
  };
}

/**
 * Mittlere Burn Rate vom Störungsbeginn bis zum Ende der letzten Phase.
 * Bei Bursts ist das der Wert, der über die Dringlichkeit entscheidet, nicht
 * die Spitze.
 */
export function sustainedBurn(run: Run): number {
  const sc = run.scenario;
  const end = sc.phases.reduce((m, p) => Math.max(m, p.toMin), sc.onsetMin);
  const activeMin = Math.min(end, sc.spanMin) - sc.onsetMin;
  return activeMin > 0 ? (run.consumed[run.n]! * PERIOD_MIN) / activeMin : 0;
}

/** Feuert die Regel? `and` = MWMBR, `long`/`short` = nur ein Fenster. */
export function gate(
  long: number,
  short: number,
  theta: number,
  mode: GateMode,
): boolean {
  if (mode === "long") return long > theta;
  if (mode === "short") return short > theta;
  return long > theta && short > theta;
}

export interface FireSegment {
  fromMin: number;
  toMin: number;
  /** Feuert am Ende des Diagramms noch. */
  open: boolean;
}

export function segmentsOf(
  fire: ArrayLike<number>,
  stepS: number,
): FireSegment[] {
  const segs: FireSegment[] = [];
  const min = (i: number) => (i * stepS) / 60;
  let start = -1;
  for (let i = 0; i < fire.length; i++) {
    const on = fire[i]! > 0;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      segs.push({ fromMin: min(start), toMin: min(i), open: false });
      start = -1;
    }
  }
  if (start >= 0)
    segs.push({ fromMin: min(start), toMin: min(fire.length - 1), open: true });
  return segs;
}

export interface RuleOutcome {
  segments: FireSegment[];
  count: number;
  firstFireMin: number | null;
  /** Ende des ersten Alarms; null, wenn er nie feuert oder nicht endet. */
  resetMin: number | null;
  /** Verbrauchter Budgetanteil beim ersten Feuern. */
  budgetAtFire: number | null;
}

/** Nächster Zeitpunkt-Index zu einer Minute, auf 0..n begrenzt. */
export function indexAt(run: Run, tMin: number): number {
  return Math.min(run.n, Math.max(0, Math.round((tMin * 60) / run.stepS)));
}

export function outcome(
  run: Run,
  ruleIdx: number,
  mode: GateMode,
): RuleOutcome {
  const w = run.rules[ruleIdx]!;
  const fire = new Uint8Array(run.n + 1);
  for (let i = 0; i <= run.n; i++)
    fire[i] = gate(w.long[i]!, w.short[i]!, w.rule.theta, mode) ? 1 : 0;
  const segments = segmentsOf(fire, run.stepS);
  const first = segments[0];
  return {
    segments,
    count: segments.length,
    firstFireMin: first ? first.fromMin : null,
    resetMin: first && !first.open ? first.toMin : null,
    budgetAtFire: first ? run.consumed[indexAt(run, first.fromMin)]! : null,
  };
}

/** Höchste Stufe, die gefeuert hat: Alarm vor Ticket. */
export function severityOf(
  fired: readonly { severity: Severity; count: number }[],
): Severity | "none" {
  if (fired.some((f) => f.severity === "page" && f.count > 0)) return "page";
  if (fired.some((f) => f.count > 0)) return "ticket";
  return "none";
}

export interface Point {
  i: number;
  v: number;
}

/**
 * Ausdünnen fürs Zeichnen: je Eimer erster, kleinster, größter und letzter
 * Wert in Index-Reihenfolge. So bleiben 2-Minuten-Bursts in einem
 * 3-Tage-Diagramm sichtbar.
 */
export function decimate(arr: ArrayLike<number>, buckets: number): Point[] {
  const n = arr.length;
  const out: Point[] = [];
  if (n <= buckets * 4) {
    for (let i = 0; i < n; i++) out.push({ i, v: arr[i]! });
    return out;
  }
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor((b * n) / buckets);
    const to = Math.floor(((b + 1) * n) / buckets);
    let lo = from;
    let hi = from;
    for (let i = from; i < to; i++) {
      if (arr[i]! < arr[lo]!) lo = i;
      if (arr[i]! > arr[hi]!) hi = i;
    }
    const idx = [...new Set([from, lo, hi, to - 1])].sort((a, c) => a - c);
    for (const i of idx) out.push({ i, v: arr[i]! });
  }
  return out;
}

/** Zahl mit Dezimalkomma. */
export function fmtNum(v: number, digits: number): string {
  return v.toFixed(digits).replace(".", ",");
}

/** Burn Rate: zwei Stellen unter 10, eine unter 100, sonst keine. */
export function fmtBurn(v: number): string {
  const s =
    v >= 99.95 ? fmtNum(v, 0) : v >= 9.995 ? fmtNum(v, 1) : fmtNum(v, 2);
  return `${s.includes(",") ? s.replace(/,?0+$/, "") : s}×`;
}

/** Dauer in Minuten als „52 s“, „5,8 min“, „18 h“ oder „7,5 d“. */
export function fmtDuration(min: number): string {
  if (!Number.isFinite(min)) return "nie";
  const trim = (v: number) => fmtNum(v, 1).replace(/,0$/, "");
  if (min < 1) return `${Math.round(min * 60)} s`;
  if (min < 90) return `${trim(min)} min`;
  if (min < 2880) return `${trim(min / 60)} h`;
  return `${trim(min / 1440)} d`;
}
