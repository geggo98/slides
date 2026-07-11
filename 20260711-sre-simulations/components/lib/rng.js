/**
 * rng.js — deterministische Zufalls- und Signal-Helfer der portierten Sims.
 * In allen zehn Original-HTML-Dateien identisch dupliziert; hier einmal
 * extrahiert. Seeded PRNG, damit „Gleicher Seed" reproduzierbare Läufe gibt.
 */

/* Mulberry32: kleiner, schneller seeded PRNG (32-bit state). */
export function mulberry32(s) {
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Poisson-Ziehung mit Erwartungswert m (Knuth); r = PRNG aus mulberry32. */
export function pois(m, r) {
  if (m <= 0) return 0;
  const L = Math.exp(-m);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

/* Symmetrisches Rauschen (Summe von 4 Uniforms, ~dreieckig), Skala sc. */
export function noise(rng, sc) {
  return ((rng() + rng() + rng() + rng() - 2) / 2) * sc;
}

/* Smoothstep-Rampe: 0 vor a, 1 nach a+d, dazwischen 3x²−2x³. */
export function ramp(t, a, d) {
  const x = (t - a) / d;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/* Zahlformat der Originale (de-DE, feste Nachkommastellen). */
export function fmtDe(x, d = 0) {
  return x.toLocaleString("de-DE", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function randomSeed() {
  return Math.floor(Math.random() * 1e9) + 1;
}
