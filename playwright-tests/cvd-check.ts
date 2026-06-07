#!/usr/bin/env bun
// Evaluate a language→hex badge assignment for colorblind-safety.
//
// Usage:
//   bun run playwright-tests/cvd-check.ts '<json>'        # inline JSON
//   bun run playwright-tests/cvd-check.ts path/to.json    # JSON file
//   echo '<json>' | bun run playwright-tests/cvd-check.ts # stdin
//
// JSON shape: { "java": "#RRGGBB", "typescript": "#RRGGBB", ... } for all 9
// languages: go java javascript jsx kotlin python rust scala typescript.
//
// Floors (accessibility hard requirements):
//   - every CO-OCCURRING pair (langs sharing a PatternTabs block): ΔE2000 ≥ 14
//   - every pair anywhere (global):                                ΔE2000 ≥ 11
// Distances are the WORST case across normal/protan/deutan/tritan vision.
// Exits non-zero if any floor is violated or a language is missing.

import {
  LANGS,
  cooc,
  isCooc,
  minDistAcrossCVD,
  perCVD,
  bestText,
  contrastRatio,
} from "./cvd-core.ts";

const COOC_FLOOR = 14;
const GLOBAL_FLOOR = 11;

let raw = process.argv[2];
if (raw && !raw.trim().startsWith("{")) raw = await Bun.file(raw).text();
if (!raw) raw = await Bun.stdin.text();
let map: Record<string, string>;
try {
  map = JSON.parse(raw);
} catch (e) {
  console.error(`Could not parse assignment JSON: ${e}`);
  process.exit(2);
}

const missing = LANGS.filter((l) => !map[l]);
if (missing.length) {
  console.error(`Missing languages: ${missing.join(", ")}`);
  process.exit(2);
}

let coocMin = Infinity,
  coocWorst = "",
  globalMin = Infinity,
  globalWorst = "";
const violations: string[] = [];
for (let i = 0; i < LANGS.length; i++)
  for (let j = i + 1; j < LANGS.length; j++) {
    const a = LANGS[i],
      b = LANGS[j];
    const d = minDistAcrossCVD(map[a], map[b]);
    if (d < globalMin) {
      globalMin = d;
      globalWorst = `${a}/${b}`;
    }
    if (d < GLOBAL_FLOOR)
      violations.push(`GLOBAL ${a}/${b} ΔE=${d.toFixed(1)} < ${GLOBAL_FLOOR}`);
    if (isCooc(a, b)) {
      if (d < coocMin) {
        coocMin = d;
        coocWorst = `${a}/${b}`;
      }
      if (d < COOC_FLOOR)
        violations.push(`CO-OCC ${a}/${b} ΔE=${d.toFixed(1)} < ${COOC_FLOOR}`);
    }
  }

console.log(`languages: ${LANGS.length}, co-occurring pairs: ${cooc.size}`);
console.log(
  `co-occurring min ΔE2000 (worst CVD): ${coocMin.toFixed(1)}  (${coocWorst})`,
);
const pc = perCVD(map[coocWorst.split("/")[0]], map[coocWorst.split("/")[1]]);
console.log(
  `  └ per-CVD: ${Object.entries(pc)
    .map(([k, v]) => `${k}=${v.toFixed(0)}`)
    .join(" ")}`,
);
console.log(
  `global       min ΔE2000 (worst CVD): ${globalMin.toFixed(1)}  (${globalWorst})`,
);

// text-contrast check (WCAG): badge text on each background should be ≥ 4.5:1
console.log(`\ntext contrast (auto-picked white/dark):`);
const lowContrast: string[] = [];
for (const l of LANGS) {
  const fg = bestText(map[l]);
  const cr = contrastRatio(map[l], fg);
  if (cr < 4.5) lowContrast.push(`${l} ${map[l]} cr=${cr.toFixed(1)}`);
  console.log(
    `  ${l.padEnd(11)} ${map[l]} text ${fg} contrast ${cr.toFixed(1)}:1`,
  );
}

console.log("");
if (violations.length) {
  console.log(`✗ FAIL: ${violations.length} floor violation(s):`);
  for (const v of violations) console.log(`   - ${v}`);
  process.exit(1);
}
if (lowContrast.length) {
  console.log(`⚠ floors OK but low text contrast: ${lowContrast.join("; ")}`);
}
console.log(
  `✓ PASS: co-occurring ≥ ${COOC_FLOOR}, global ≥ ${GLOBAL_FLOOR} across all CVD types.`,
);
