import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CSS_VAR_NAME, FONTS, RADII } from "../../../theme/tokens";
import {
  contrastRatio,
  parseHex,
} from "../../../quiz/lib/__tests__/_colorMath";

// Wächter für styles/tokens.css: Das Theme ersetzt shared/components/
// SlidevTokens.vue vollständig. Fehlt eine Variable, fällt eine token-
// getriebene Komponente still auf den Browser-Default zurück — unsichtbar,
// bis jemand die Folie im anderen Modus ansieht. Deshalb (1) Vollständigkeit
// gegen das Vokabular aus shared/theme/tokens.ts und (2) dieselben
// Kontrastregeln wie dort, plus die Paare, die das Theme selbst einführt.
//
// Muster übernommen aus shared/theme/__tests__/tokens.test.ts.

const here = dirname(fileURLToPath(import.meta.url));
// Kommentare vorher entfernen: eine auskommentierte Variable darf nicht als
// vorhanden zählen, und ein Kommentar mit „}" darf den Block nicht verkürzen.
const css = readFileSync(resolve(here, "../styles/tokens.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function block(selector: string): string {
  const marker = `${selector} {`;
  const count = css.split(marker).length - 1;
  expect(count, `Block „${marker}" muss genau einmal vorkommen`).toBe(1);
  const start = css.indexOf(marker);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

function parseVars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const light = parseVars(block("html:not(.dark)"));
const dark = parseVars(block("html.dark.dark"));
const shared = parseVars(block("html:root"));

const SEMANTIC = Object.values(CSS_VAR_NAME);
// Slidev-Variablen, die das Theme je Modus setzt; fehlt eine, fällt Slidevs
// vars.css still auf Grau ein.
const SLIDEV_PER_MODE = [
  "--slidev-code-background",
  "--slidev-code-foreground",
  "--slidev-theme-primary",
];

describe("tokens.css: Vollständigkeit", () => {
  it("liefert jede semantische Variable in Light und Dark", () => {
    for (const name of SEMANTIC) {
      expect(light[name], `${name} (light)`).toBeTruthy();
      expect(dark[name], `${name} (dark)`).toBeTruthy();
    }
  });

  it("liefert die Slidev-Variablen in beiden Modi", () => {
    for (const name of SLIDEV_PER_MODE) {
      expect(light[name], `${name} (light)`).toBeTruthy();
      expect(dark[name], `${name} (dark)`).toBeTruthy();
    }
  });

  it("schreibt jede Hex-Farbe sechsstellig", () => {
    for (const vars of [light, dark, shared]) {
      for (const [name, value] of Object.entries(vars)) {
        if (value.startsWith("#"))
          expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("liefert jede Theme-Variable (--lt-*) in beiden Modi", () => {
    const lt = new Set(
      [...Object.keys(light), ...Object.keys(dark)].filter((n) =>
        n.startsWith("--lt-"),
      ),
    );
    expect(lt.size).toBeGreaterThan(0);
    for (const name of lt) {
      expect(light[name], `${name} (light)`).toBeTruthy();
      expect(dark[name], `${name} (dark)`).toBeTruthy();
    }
  });

  it("liefert Radien und --font-mono modusfrei", () => {
    for (const name of Object.keys(RADII)) {
      expect(shared[name], name).toBeTruthy();
    }
    for (const name of Object.keys(FONTS)) {
      expect(shared[name], name).toBeTruthy();
    }
  });

  it("erfindet keine --color-*-Variable außerhalb des Vokabulars", () => {
    const owned = new Set(SEMANTIC);
    for (const name of [...Object.keys(light), ...Object.keys(dark)]) {
      if (name.startsWith("--color-")) expect(owned.has(name), name).toBe(true);
    }
  });
});

// --- Kontrast ------------------------------------------------------------

const hex = (value: string, name: string) => {
  expect(value, `${name} ist kein 6-stelliges Hex: ${value}`).toMatch(
    /^#[0-9a-f]{6}$/i,
  );
  return parseHex(value);
};

const ratio = (vars: Record<string, string>, fg: string, bg: string) =>
  contrastRatio(hex(vars[fg]!, fg), hex(vars[bg]!, bg));

const STATUS = ["info", "success", "warning", "danger"] as const;

for (const [mode, vars] of [
  ["light", light],
  ["dark", dark],
] as const) {
  describe(`tokens.css: Kontrast ${mode}`, () => {
    for (const fg of ["--color-text-primary", "--color-text-secondary"]) {
      it(`${fg} auf background-primary ≥ 4,5`, () => {
        expect(
          ratio(vars, fg, "--color-background-primary"),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const s of STATUS) {
      it(`text-${s} auf background-${s} ≥ 4,5`, () => {
        expect(
          ratio(vars, `--color-text-${s}`, `--color-background-${s}`),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
    it("--lt-accent-ink als Text ≥ 4,5 auf Fläche und Badge", () => {
      expect(
        ratio(vars, "--lt-accent-ink", "--color-background-primary"),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(vars, "--lt-accent-ink", "--lt-accent-soft"),
      ).toBeGreaterThanOrEqual(4.5);
    });
    it("Code-Vordergrund und Zeilennummern ≥ 4,5 auf dem Codegrund", () => {
      expect(
        ratio(vars, "--slidev-code-foreground", "--slidev-code-background"),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(vars, "--color-text-secondary", "--slidev-code-background"),
      ).toBeGreaterThanOrEqual(4.5);
    });
    it("--lt-accent als Grafik ≥ 3 auf der Fläche", () => {
      expect(
        ratio(vars, "--lt-accent", "--color-background-primary"),
      ).toBeGreaterThanOrEqual(3);
    });
    for (const s of ["info", "success", "danger"] as const) {
      it(`border-${s} (Balken) ≥ 3 auf background-tertiary (Track)`, () => {
        expect(
          ratio(vars, `--color-border-${s}`, "--color-background-tertiary"),
        ).toBeGreaterThanOrEqual(3);
      });
    }
  });
}
