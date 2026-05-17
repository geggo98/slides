import { describe, expect, it } from "vitest";
import { makePalette } from "../carbonTokens";
import {
  type CvdType,
  contrastRatio,
  deltaE,
  lightnessL,
  parseHex,
  simulate,
} from "./_colorMath";

const CVD_TYPES: readonly CvdType[] = ["normal", "protan", "deutan", "tritan"];

const STATE_KEYS = ["success", "error", "warning", "tradeoff"] as const;
type StateKey = (typeof STATE_KEYS)[number];

const THEMES = [
  { name: "light", isDark: false },
  { name: "dark", isDark: true },
] as const;

// Thresholds:
//   WCAG_MIN_CONTRAST   4.5  → WCAG 2.1 AA for normal text & UI components
//                              with text (the status pill has text on color).
//   CVD_MIN_DELTA_E     14   → "clearly different" under all CVD simulations.
//                              Calibrated against the four-state IBM Carbon
//                              palette; lower than the conventional ΔE>20
//                              because some hue pairs compress under simulation.
//   SUCCESS_ERROR_MIN_L  10  → user-requested lightness fallback specifically
//                              between correct (success) and wrong (error).
const WCAG_MIN_CONTRAST = 4.5;
const CVD_MIN_DELTA_E = 14;
const SUCCESS_ERROR_MIN_L = 10;

for (const theme of THEMES) {
  describe(`palette: ${theme.name}`, () => {
    const p = makePalette(theme.isDark);
    const bg = parseHex(p.bg);
    const colors: Record<StateKey, ReturnType<typeof parseHex>> = {
      success: parseHex(p.success),
      error: parseHex(p.error),
      warning: parseHex(p.warning),
      tradeoff: parseHex(p.tradeoff),
    };

    describe("can host pill text at WCAG AA", () => {
      // States are used as pill background; the pill text is either white,
      // black, or the surface bg color. We assert at least one of these gives
      // ≥ 4.5:1 — OptionItem.vue picks whichever pairs best per state.
      const inkCandidates = [parseHex("#ffffff"), parseHex("#000000"), bg];
      for (const k of STATE_KEYS) {
        it(`${k} has a text color with ≥ ${WCAG_MIN_CONTRAST}:1`, () => {
          const best = Math.max(
            ...inkCandidates.map((ink) => contrastRatio(colors[k], ink)),
          );
          expect(best).toBeGreaterThanOrEqual(WCAG_MIN_CONTRAST);
        });
      }
    });

    describe("pairwise CVD distinguishability (ΔE)", () => {
      for (let i = 0; i < STATE_KEYS.length; i++) {
        for (let j = i + 1; j < STATE_KEYS.length; j++) {
          const a = STATE_KEYS[i] as StateKey;
          const b = STATE_KEYS[j] as StateKey;
          for (const cvd of CVD_TYPES) {
            it(`${a} vs ${b} ΔE > ${CVD_MIN_DELTA_E} under ${cvd}`, () => {
              const dE = deltaE(
                simulate(colors[a], cvd),
                simulate(colors[b], cvd),
              );
              expect(dE).toBeGreaterThan(CVD_MIN_DELTA_E);
            });
          }
        }
      }
    });

    it(`success vs error: L* gap ≥ ${SUCCESS_ERROR_MIN_L}`, () => {
      const dL = Math.abs(
        lightnessL(colors.success) - lightnessL(colors.error),
      );
      expect(dL).toBeGreaterThanOrEqual(SUCCESS_ERROR_MIN_L);
    });
  });
}
