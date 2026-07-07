// ── Autoregressive-Token-Demo: Daten + reine Funktionen ──────────────────────
// Portiert aus der vom Autor vorbereiteten `autoregressive.html`.
//
// Die Verteilungen sind illustrativ, an eine reale GPT-2-Ausgabe angelehnt
// (erzeugt via `generate_probs.py`, siehe Deck-Ordner). Summe je Schritt < 1;
// der Rest ist der lange Schwanz aus zehntausenden seltenen Token.

export type TokenProb = [string, number];

export interface Step {
  after: string;
  dist: TokenProb[];
  noun?: boolean;
  eos?: boolean;
}

// Kontext vor dem sichtbaren Prompt (abstrahiert) und der sichtbare Prompt.
export const CTX = [
  { label: "System-Prompt", n: 1000 },
  { label: "User-Frage", n: 100 },
] as const;

export const PROMPT = ["The", "cat", "sat"] as const;

// Pro Decode-Schritt eine Verteilung: [token, wahrscheinlichkeit].
export const STEPS: Step[] = [
  {
    after: '"The cat sat"',
    dist: [
      ["on", 0.34],
      ["down", 0.09],
      ["in", 0.07],
      ["there", 0.05],
      ["up", 0.04],
      ["quietly", 0.035],
      ["and", 0.03],
      ["at", 0.03],
      ["still", 0.02],
      ["next", 0.02],
      ["on top", 0.015],
      ["beside", 0.012],
    ],
  },
  {
    after: '"… on"',
    dist: [
      ["the", 0.62],
      ["a", 0.11],
      ["top", 0.05],
      ["its", 0.03],
      ["my", 0.025],
      ["his", 0.02],
      ["one", 0.015],
      ["her", 0.015],
      ["that", 0.01],
      ["this", 0.01],
      ["some", 0.008],
      ["their", 0.007],
    ],
  },
  {
    after: '"… the"',
    noun: true,
    dist: [
      ["floor", 0.076],
      ["bed", 0.065],
      ["couch", 0.054],
      ["ground", 0.052],
      ["edge", 0.048],
      ["bench", 0.032],
      ["table", 0.031],
      ["sofa", 0.029],
      ["other", 0.02],
      ["back", 0.019],
      ["side", 0.017],
      ["chair", 0.012],
    ],
  },
  {
    after: '"… <Substantiv>"',
    dist: [
      [".", 0.38],
      [",", 0.12],
      ["and", 0.06],
      ["of", 0.04],
      ["in", 0.035],
      ["near", 0.03],
      ["with", 0.025],
      ["beside", 0.02],
      ["\\n", 0.02],
      ["while", 0.015],
      ["as", 0.012],
      ["for", 0.01],
    ],
  },
  {
    after: '"… ."',
    eos: true,
    dist: [
      ["<|endoftext|>", 0.28],
      ["\\n", 0.14],
      ["The", 0.05],
      ["It", 0.03],
      ["He", 0.02],
      ["She", 0.02],
      ['"', 0.02],
      ["A", 0.015],
      ["Then", 0.012],
      ["I", 0.01],
      ["This", 0.009],
      ["There", 0.008],
    ],
  },
];

export type Mode = "greedy" | "sample" | "topk" | "topp" | "minp";

// ── reine Funktionen (auch separat testbar) ──────────────────────────────────
export function applyTemperature(dist: TokenProb[], T: number): TokenProb[] {
  // q_i ~ p_i^(1/T)
  if (T === 1) return dist.map((d) => [d[0], d[1]]);
  const inv = 1 / T;
  const w: TokenProb[] = dist.map((d) => [d[0], Math.pow(d[1], inv)]);
  const s = w.reduce((a, d) => a + d[1], 0);
  return w.map((d) => [d[0], d[1] / s]);
}

export function renorm(dist: TokenProb[]): TokenProb[] {
  const s = dist.reduce((a, d) => a + d[1], 0) || 1;
  return dist.map((d) => [d[0], d[1] / s]);
}

export function topK(dist: TokenProb[], k: number): TokenProb[] {
  return renorm([...dist].sort((a, b) => b[1] - a[1]).slice(0, k));
}

export function topP(dist: TokenProb[], p: number): TokenProb[] {
  const s = [...dist].sort((a, b) => b[1] - a[1]);
  let c = 0;
  const out: TokenProb[] = [];
  for (const d of s) {
    out.push(d);
    c += d[1];
    if (c >= p) break;
  }
  return renorm(out);
}

export function minP(dist: TokenProb[], mp: number): TokenProb[] {
  // Konfidenz-relative Schwelle: behalte Token mit p_i >= min_p * p_max.
  // p_max ist immer >= der Schwelle (für mp <= 1), also überlebt es stets.
  const pmax = Math.max(...dist.map((d) => d[1]));
  const thr = mp * pmax;
  return renorm(dist.filter((d) => d[1] >= thr));
}

export function sampleFrom(dist: TokenProb[]): string {
  // multinomial
  const n = renorm(dist);
  const r = Math.random();
  let c = 0;
  for (const d of n) {
    c += d[1];
    if (r <= c) return d[0];
  }
  return n[n.length - 1][0];
}

export function argmax(dist: TokenProb[]): string {
  return dist.reduce((m, d) => (d[1] > m[1] ? d : m))[0];
}

// Wählt Token gemäß Modus. Gibt {token, working} zurück
// (working = tatsächlich genutzte Verteilung).
export function pick(
  dist: TokenProb[],
  mode: Mode,
  T: number,
  k: number,
  p: number,
  mp: number,
): { token: string; working: TokenProb[] } {
  if (mode === "greedy") return { token: argmax(dist), working: renorm(dist) };
  let w = applyTemperature(renorm(dist), T);
  if (mode === "topk") w = topK(w, k);
  if (mode === "topp") w = topP(w, p);
  if (mode === "minp") w = minP(w, mp);
  return { token: sampleFrom(w), working: w };
}
