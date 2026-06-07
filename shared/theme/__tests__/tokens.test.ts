import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  CSS_VAR_NAME,
  LIGHT,
  DARK,
  RADII,
  semanticCssVars,
  type SemanticTokens,
} from "../tokens";
import { contrastRatio, parseHex } from "../../quiz/lib/__tests__/_colorMath";

// _colorMath.parseHex expects 6-digit hex; the token set uses some 3-digit
// shorthand (#fff, #aaa). Expand before parsing.
const hex = (c: string): ReturnType<typeof parseHex> => {
  const h = c.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((d) => d + d)
          .join("")
      : h;
  return parseHex("#" + full);
};

// --- Drift guard --------------------------------------------------------
// tokens.ts is the source of truth; SlidevTokens.vue keeps a static <style>
// block (bundled as CSS, so no flash-of-unstyled-content). This test asserts
// the two never drift apart — edit tokens.ts and this catches a stale .vue.

const here = dirname(fileURLToPath(import.meta.url));
// Scope to the <style> block — the doc-comment above it mentions "html.dark"
// and ":root", which would otherwise confuse the selector offsets below.
const vueFull = readFileSync(
  resolve(here, "../../components/SlidevTokens.vue"),
  "utf8",
);
const vueSrc = vueFull.slice(vueFull.indexOf("<style>"));

function parseVars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const lightBlock = vueSrc.slice(
  vueSrc.indexOf(":root {"),
  vueSrc.indexOf("html.dark"),
);
const darkBlock = vueSrc.slice(
  vueSrc.indexOf("html.dark"),
  vueSrc.indexOf(".slidev-tokens-marker"),
);
const lightVars = parseVars(lightBlock);
const darkVars = parseVars(darkBlock);

describe("SlidevTokens.vue drift guard", () => {
  it("light block matches tokens.ts semantic + radii values", () => {
    for (const [name, value] of Object.entries(semanticCssVars("light"))) {
      expect(lightVars[name], name).toBe(value);
    }
    for (const [name, value] of Object.entries(RADII)) {
      expect(lightVars[name], name).toBe(value);
    }
  });

  it("dark block matches tokens.ts semantic values", () => {
    for (const [name, value] of Object.entries(semanticCssVars("dark"))) {
      expect(darkVars[name], name).toBe(value);
    }
  });

  it("every --color-* var in the .vue is owned by tokens.ts", () => {
    const owned = new Set(Object.values(CSS_VAR_NAME));
    for (const name of Object.keys(lightVars)) {
      if (name.startsWith("--color-")) expect(owned.has(name), name).toBe(true);
    }
  });
});

// --- Contrast guard -----------------------------------------------------
// AA (4.5:1) for the text colours that carry real content against their
// surfaces. Tertiary/muted text is intentionally below AA and excluded.

const THEMES = [
  { name: "light", t: LIGHT },
  { name: "dark", t: DARK },
] as const;

const TEXT_ON_PRIMARY: (keyof SemanticTokens)[] = [
  "textPrimary",
  "textSecondary",
];
const STATUS = ["Info", "Success", "Warning", "Danger"] as const;

for (const { name, t } of THEMES) {
  describe(`contrast: ${name}`, () => {
    for (const key of TEXT_ON_PRIMARY) {
      it(`${key} on backgroundPrimary ≥ 4.5:1`, () => {
        const ratio = contrastRatio(hex(t[key]), hex(t.backgroundPrimary));
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const s of STATUS) {
      it(`text${s} on background${s} ≥ 4.5:1`, () => {
        const fg = t[`text${s}` as keyof SemanticTokens];
        const bg = t[`background${s}` as keyof SemanticTokens];
        expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
