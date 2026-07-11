/**
 * queueing.js — framework-agnostische Helfer, geteilt von MM1Simulator und
 * MMcCompare (1:1 aus mm1-simulator.jsx / mmc-compare.jsx übernommen).
 */

// Gäste-Emoji mit Hauttönen; rein illustrativ.
export const ROLES = [
  ["🧑‍🚀", "🧑🏻‍🚀", "🧑🏽‍🚀", "🧑🏾‍🚀"],
  ["🧛", "🧛🏻", "🧛🏽", "🧛🏾"],
  ["🧑‍⚕️", "🧑🏻‍⚕️", "🧑🏽‍⚕️", "🧑🏿‍⚕️"],
  ["🧗", "🧗🏻", "🧗🏽", "🧗🏾"],
];

export const randomPerson = () => {
  const r = ROLES[(Math.random() * 4) | 0];
  return r[(Math.random() * 4) | 0];
};

// Essen-Emoji = Bedienlänge relativ zur mittleren Bedienzeit (🍎 kurz … 🍱 lang).
export function foodFor(t, mean) {
  const r = t / mean;
  if (r < 0.5) return "🍎";
  if (r < 1.0) return "🥪";
  if (r < 1.8) return "🍔";
  if (r < 3.0) return "🍜";
  return "🍱";
}

// Exponentiell verteilte Zwischenzeit (inverse CDF).
export const expo = (rate) => -Math.log(1 - Math.random()) / rate;

/**
 * withAlpha("#39ff8a", 0.05) → "rgba(57, 255, 138, 0.05)".
 * Macht die Canvas-Zonenfüllungen/Trails theme-fähig (statt hartkodierter rgba).
 */
export function withAlpha(hex, a) {
  let h = String(hex).replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
