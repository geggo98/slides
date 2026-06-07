// Shared colorblindness math + design-pattern co-occurrence data.
// Used by cvd-check.ts to validate the Monaco language-badge palette
// (see shared/components/MonacoBlock.vue -> LANGUAGE_META).

import { PATTERNS } from "../20260606-design-pattern/components/slide-data.ts";

export const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  rs: "rust",
  py: "python",
  golang: "go",
};
export const norm = (l: string) =>
  ALIASES[(l || "").toLowerCase()] || (l || "").toLowerCase();

// ---- co-occurrence from the real PatternTabs data ----
export const blocks: string[][] = [];
const langSet = new Set<string>();
for (const [, pat] of Object.entries<any>(PATTERNS)) {
  const langs = [
    ...new Set((pat.tabs || []).map((t: any) => norm(t.language || "java"))),
  ];
  langs.forEach((l) => langSet.add(l));
  if (langs.length > 1) blocks.push(langs);
}
export const LANGS = [...langSet].sort();
export const cooc = new Set<string>();
for (const b of blocks)
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++)
      cooc.add([b[i], b[j]].sort().join("|"));
export const isCooc = (a: string, b: string) =>
  cooc.has([a, b].sort().join("|"));

// ---- color math ----
export type RGB = [number, number, number];
export const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const srgbToLinear = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (x: number) => {
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

// Machado et al. 2009 matrices, severity 1.0, applied to LINEAR rgb.
export const MACHADO: Record<string, number[][]> = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export const simulate = (rgb: RGB, type: string): RGB => {
  const m = MACHADO[type];
  const lin = rgb.map(srgbToLinear);
  const out = m.map(
    (row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2],
  );
  return out.map((v) => linearToSrgb(Math.max(0, Math.min(1, v)))) as RGB;
};

export const rgbToLab = (rgb: RGB): [number, number, number] => {
  const [r, g, b] = rgb.map(srgbToLinear);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

export const ciede2000 = (l1: number[], l2: number[]): number => {
  const [L1, a1, b1] = l1,
    [L2, a2, b2] = l2;
  const rad = Math.PI / 180,
    deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1,
    a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1),
    C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * deg + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * deg + 360) % 360;
  const dLp = L2 - L1,
    dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2,
    Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp,
    Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
};

export const CVD = ["normal", "protan", "deutan", "tritan"];
export const minDistAcrossCVD = (hexA: string, hexB: string): number => {
  const a = hexToRgb(hexA),
    b = hexToRgb(hexB);
  return Math.min(
    ...CVD.map((t) =>
      ciede2000(rgbToLab(simulate(a, t)), rgbToLab(simulate(b, t))),
    ),
  );
};
export const perCVD = (hexA: string, hexB: string): Record<string, number> => {
  const a = hexToRgb(hexA),
    b = hexToRgb(hexB);
  return Object.fromEntries(
    CVD.map((t) => [
      t,
      ciede2000(rgbToLab(simulate(a, t)), rgbToLab(simulate(b, t))),
    ]),
  );
};

// relative luminance (WCAG) for picking white vs dark text on a badge
export const relLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrastRatio = (hexA: string, hexB: string): number => {
  const a = relLuminance(hexA),
    b = relLuminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};
// best of white/near-black text for a given background
export const bestText = (bg: string): string =>
  contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#1a1a1a")
    ? "#ffffff"
    : "#1a1a1a";
