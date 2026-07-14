/**
 * burnRate.js — pures Modell für die SLO-Burn-Rate-Simulation.
 * Google SRE Workbook, Multi-Window-Multi-Burn-Rate (Tabelle 5-6):
 * Fast Page 14,4× über 1 h (+5 min) · Slow Page 6× über 6 h (+30 min) ·
 * Ticket 1× über 3 d (+6 h) — bewusst auf einem 30-Tage-Budget, nur dort
 * stimmen die Schwellen exakt: Budget-Verbrauch beim Feuern = θ·W/720 h
 * ⇒ by design 2 % / 5 % / 10 %, unabhängig von der Burn-Höhe.
 * Ganze Läufe werden vorberechnet (Prefix-Integral, O(n)); Feuer-Regel:
 * langes UND kurzes Fenster ≥ θ.
 */
import { mulberry32, noise } from "./rng.js";

export const PERIOD_H = 720; // 30-Tage-Budgetfenster
export const PERIOD_S = PERIOD_H * 3600;
export const BASELINE = 0.00005; // 0,005 % Grundrauschen (Burn 0,05× bei 99,9 %)

export const ALERTS = [
  { key: "fast", label: "Notfall", theta: 14.4, longS: 3600, shortS: 300 },
  { key: "slow", label: "Warnung", theta: 6, longS: 21600, shortS: 1800 },
  { key: "ticket", label: "Aufgabe", theta: 1, longS: 259200, shortS: 21600 },
];
export const NAIVE = { key: "naive", theta: 14.4, windowS: 300 };

export const SCENARIOS = {
  spike: {
    label: "Spike",
    title: "100 % Fehler für 20 min",
    spanS: 5400, // 90 min
    dt: 2,
    onset: 600,
  },
  creep: {
    label: "Schleichend",
    title: "0,3 % Fehler dauerhaft (Burn 3× bei 99,9 %)",
    spanS: 259200, // 72 h
    dt: 20,
    onset: 21600,
  },
  flap: {
    label: "Flattern",
    title: "2-min-Bursts à 5 % alle 30 min",
    spanS: 259200,
    dt: 20,
    onset: 21600,
  },
};

/**
 * Kompletten Lauf vorberechnen. Liefert die Fehlerraten-Spur, das
 * Restbudget, je Alert die Burn-Kurve (langes Fenster) + Feuer-Segmente,
 * sowie firstAlert / remainingAtFire / naiveCount / reachS fürs Verdict.
 */
export function buildRun({
  scenario = "spike",
  slo = 0.999,
  intensity = 1,
  fastWinMin = 60,
  seed = 1,
} = {}) {
  const sc = SCENARIOS[scenario];
  const rng = mulberry32(seed);
  const budgetFrac = 1 - slo;
  const n = Math.round(sc.spanS / sc.dt) + 1;
  const dt = sc.dt;

  // Fehlerraten-Spur (Anteil 0..1) inkl. seeded Rauschen (±8 %).
  const err = new Float64Array(n);
  let bursts = null;
  if (scenario === "flap") {
    bursts = [];
    for (let s = sc.onset; s < sc.spanS; s += 1800) {
      bursts.push({
        start: s + noise(rng, 240), // ±2 min Jitter
        amp: 0.05 * (1 + noise(rng, 0.3)), // ±15 % Amplitude
      });
    }
  }
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    let e = BASELINE;
    if (scenario === "spike") {
      if (t >= sc.onset && t < sc.onset + 1200) e = 1.0 * intensity;
    } else if (scenario === "creep") {
      if (t >= sc.onset) e = 0.003 * intensity;
    } else {
      for (const b of bursts)
        if (t >= b.start && t < b.start + 120) e = b.amp * intensity;
    }
    if (e > BASELINE) e *= 1 + noise(rng, 0.16); // ±8 % multiplikativ
    err[i] = Math.max(0, Math.min(1, e));
  }

  // Prefix-Integral E [Fehler-Sekunden]; Vor-Historie = BASELINE.
  const E = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) E[i + 1] = E[i] + err[i] * dt;
  const winErr = (i, W) => {
    const t = i * dt;
    const j = Math.max(0, i - Math.round(W / dt));
    const pre = Math.max(0, W - t) * BASELINE;
    return E[i + 1] - E[j] + pre;
  };
  const burnAt = (i, W) => winErr(i, W) / (W * budgetFrac);

  // Budget-Verbrauch (Vor-Historie zählt nicht — Budget startet bei 100 %).
  const remaining = new Float64Array(n);
  for (let i = 0; i < n; i++)
    remaining[i] = Math.max(0, 100 * (1 - E[i + 1] / (budgetFrac * PERIOD_S)));

  // Alert-Lanes: langes Fenster fürs Plotten, Feuern = lang UND kurz ≥ θ.
  const fastLongS = fastWinMin * 60;
  const fastShortS = Math.max(60, Math.round(fastLongS / 12));
  const defs = ALERTS.map((a) =>
    a.key === "fast" ? { ...a, longS: fastLongS, shortS: fastShortS } : a,
  );
  const segmentsOf = (fire) => {
    const segs = [];
    let s = null;
    for (let i = 0; i < n; i++) {
      if (fire[i] && s == null) s = i * dt;
      if (!fire[i] && s != null) {
        segs.push([s, i * dt]);
        s = null;
      }
    }
    if (s != null) segs.push([s, (n - 1) * dt]);
    return segs;
  };
  const lanes = defs.map((a) => {
    const burn = new Float64Array(n);
    const fire = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      burn[i] = burnAt(i, a.longS);
      fire[i] = burn[i] >= a.theta && burnAt(i, a.shortS) >= a.theta ? 1 : 0;
    }
    return { ...a, burn, fire, segments: segmentsOf(fire) };
  });
  // Naiver Vergleichs-Alert: nur ein kurzes Fenster, kein UND.
  {
    const burn = new Float64Array(n);
    const fire = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      burn[i] = burnAt(i, NAIVE.windowS);
      fire[i] = burn[i] >= NAIVE.theta ? 1 : 0;
    }
    lanes.push({
      key: "naive",
      label: "naiv (nur 5 min)",
      theta: NAIVE.theta,
      longS: NAIVE.windowS,
      burn,
      fire,
      segments: segmentsOf(fire),
    });
  }

  // Ereignisse: erstes Feuern je Policy-Alert (naive separat gezählt).
  const events = [];
  for (const l of lanes) {
    if (!l.segments.length) continue;
    const t0 = l.segments[0][0];
    const i0 = Math.round(t0 / dt);
    events.push({
      key: l.key,
      label: l.label,
      t: t0,
      remaining: remaining[i0],
    });
  }
  const policy = events.filter((e) => e.key !== "naive");
  policy.sort((a, b) => a.t - b.t);
  const firstAlert = policy.length ? policy[0].key : "none";
  const remainingAtFire = policy.length
    ? policy[0].remaining
    : remaining[n - 1];
  const naiveLane = lanes.find((l) => l.key === "naive");
  const naiveCount = naiveLane.segments.length;

  // Reichweite: bei aktueller Burn-Rate (3-d-Fenster am Ende) ist das
  // Restbudget in reachS Sekunden aufgebraucht (Infinity bei ~0 Burn).
  const endBurn = burnAt(n - 1, 259200);
  const reachS =
    endBurn > 0.01
      ? ((remaining[n - 1] / 100) * budgetFrac * PERIOD_S) /
        (endBurn * budgetFrac)
      : Infinity;

  return {
    scenario,
    n,
    dt,
    spanS: sc.spanS,
    onset: sc.onset,
    budgetFrac,
    err,
    remaining,
    lanes,
    events,
    firstAlert,
    remainingAtFire,
    naiveCount,
    reachS,
  };
}
