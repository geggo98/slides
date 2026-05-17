// Color math used by carbonTokens.test.ts. Not a vitest spec (no .test.ts
// suffix). References:
//   - IEC 61966-2-1 (sRGB transfer function)
//   - CIE 15:2004 (Lab, D65 white)
//   - Machado, Oliveira, Fernandes 2009 (CVD simulation matrices, severity 1)
//   - WCAG 2.1 §1.4.3 (relative-luminance contrast ratio)
//
// ΔE is CIE76 (Euclidean Lab distance) — sufficient for the "obviously
// different" gates used here. ΔE2000 would be more perceptually uniform but
// the threshold cost outweighs the precision gain for hue-vs-hue checks.

export type Rgb = readonly [number, number, number];
export type CvdType = "normal" | "protan" | "deutan" | "tritan";

export function parseHex(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [
    ((n >> 16) & 0xff) / 255,
    ((n >> 8) & 0xff) / 255,
    (n & 0xff) / 255,
  ] as const;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const CVD_MATRIX: Record<
  Exclude<CvdType, "normal">,
  ReadonlyArray<ReadonlyArray<number>>
> = {
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

export function simulate(rgbSrgb: Rgb, type: CvdType): Rgb {
  if (type === "normal") return rgbSrgb;
  const lin = rgbSrgb.map(srgbToLinear);
  const m = CVD_MATRIX[type];
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    let s = 0;
    for (let j = 0; j < 3; j++) s += (m[i]?.[j] ?? 0) * (lin[j] ?? 0);
    out.push(clamp01(s));
  }
  return [
    clamp01(linearToSrgb(out[0] ?? 0)),
    clamp01(linearToSrgb(out[1] ?? 0)),
    clamp01(linearToSrgb(out[2] ?? 0)),
  ] as const;
}

export function relativeLuminance(rgbSrgb: Rgb): number {
  const r = srgbToLinear(rgbSrgb[0]);
  const g = srgbToLinear(rgbSrgb[1]);
  const b = srgbToLinear(rgbSrgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToLab(rgbSrgb: Rgb): readonly [number, number, number] {
  const r = srgbToLinear(rgbSrgb[0]);
  const g = srgbToLinear(rgbSrgb[1]);
  const b = srgbToLinear(rgbSrgb[2]);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const Xn = 0.95047,
    Yn = 1.0,
    Zn = 1.08883;
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const f = (t: number) =>
    t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116;
  const fx = f(X / Xn),
    fy = f(Y / Yn),
    fz = f(Z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)] as const;
}

export function lightnessL(rgbSrgb: Rgb): number {
  return rgbToLab(rgbSrgb)[0];
}

export function deltaE(a: Rgb, b: Rgb): number {
  const la = rgbToLab(a);
  const lb = rgbToLab(b);
  const dL = la[0] - lb[0];
  const da = la[1] - lb[1];
  const db = la[2] - lb[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}
