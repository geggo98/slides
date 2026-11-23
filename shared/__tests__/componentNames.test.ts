// Namenskonflikte zwischen Dateien unter `components/`.
//
// Slidev registriert jede Datei unter `<root>/components/` rekursiv als
// Komponente, nicht nur `.vue` (unplugin-vue-components mit den Endungen
// vue, md, js, ts, jsx, tsx; siehe `createComponentsPlugin` in @slidev/cli).
// Der Name ist der Dateiname ohne Endung in PascalCase. Heißen
// `components/ContextHygiene.vue` und `components/lib/contextHygiene.ts`
// gleich, meldet das Plugin beim Start
//   component "ContextHygiene"(…/lib/contextHygiene.ts) has naming conflicts
//   with other components, ignored.
// und verwirft eine der beiden still. Gemessen am 23.11.2026: Slidev wählt die
// `.vue`-Datei, die Reihenfolge ist aber nicht zugesichert.
//
// Regel: Logik-Module neben Komponenten heißen anders als jede Komponente,
// üblich `<name>Logic.ts` oder `<name>Math.ts`.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Endungen, die Slidev als Komponenten einliest. */
const EXTENSIONS = new Set([".vue", ".md", ".js", ".ts", ".jsx", ".tsx"]);

/** `ContextHygiene.vue`, `contextHygiene.ts` und `context-hygiene.ts` ergeben denselben Schlüssel. */
export function nameKey(file: string): string {
  return basename(file, extname(file))
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

/** Gruppen von Dateien mit gleichem Namensschlüssel; nur Gruppen mit Konflikt. */
export function collisions(files: readonly string[]): string[][] {
  const byKey = new Map<string, string[]>();
  for (const f of files) {
    if (!EXTENSIONS.has(extname(f))) continue;
    const key = nameKey(f);
    byKey.set(key, [...(byKey.get(key) ?? []), f]);
  }
  return [...byKey.values()].filter((g) => g.length > 1);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".")) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Jede Wurzel, deren `components/` Slidev einliest: Decks und lokale Themes. */
function componentDirs(): string[] {
  const decks = readdirSync(repoRoot).filter(
    (n) =>
      /^\d{8}-/.test(n) &&
      existsSync(join(repoRoot, n, "slides.md")) &&
      existsSync(join(repoRoot, n, "components")),
  );
  const themesDir = join(repoRoot, "shared", "slidev-themes");
  const themes = existsSync(themesDir)
    ? readdirSync(themesDir)
        .map((t) => join("shared", "slidev-themes", t))
        .filter((t) => existsSync(join(repoRoot, t, "components")))
    : [];
  return [...decks, ...themes].map((r) => join(repoRoot, r, "components"));
}

describe("Hilfsfunktion collisions", () => {
  it("findet .vue und .ts mit gleichem Namen", () => {
    expect(
      collisions(["c/ContextHygiene.vue", "c/lib/contextHygiene.ts"]),
    ).toEqual([["c/ContextHygiene.vue", "c/lib/contextHygiene.ts"]]);
  });

  it("findet auch Kebab-Schreibweise", () => {
    expect(
      collisions(["c/ContextHygiene.vue", "c/context-hygiene.ts"]),
    ).toHaveLength(1);
  });

  it("meldet keinen Konflikt bei anderem Namen oder Test-Datei", () => {
    expect(
      collisions(["c/ContextHygiene.vue", "c/lib/contextHygieneLogic.ts"]),
    ).toEqual([]);
    expect(
      collisions(["c/ContextHygiene.vue", "c/lib/contextHygiene.test.ts"]),
    ).toEqual([]);
  });

  it("ignoriert Endungen, die Slidev nicht einliest", () => {
    expect(collisions(["c/Foo.vue", "c/foo.json", "c/foo.css"])).toEqual([]);
  });
});

describe("Komponenten-Verzeichnisse", () => {
  const dirs = componentDirs();

  it("findet Decks und Dateien, sonst prüfte der Test nichts", () => {
    expect(dirs.length).toBeGreaterThan(5);
    const total = dirs.reduce((n, d) => n + walk(d).length, 0);
    expect(total).toBeGreaterThan(100);
  });

  it.each(dirs.map((d) => [relative(repoRoot, d), d] as const))(
    "%s: kein Dateiname kollidiert mit einer anderen Komponente",
    (_label, dir) => {
      const found = collisions(walk(dir)).map((g) =>
        g.map((f) => relative(dir, f)),
      );
      expect(found).toEqual([]);
    },
  );
});
