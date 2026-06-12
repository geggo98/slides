import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TALKS, type TalkSlug } from "../talks";

// Repo-Root: dieses File liegt in shared/__tests__/, also zwei Ebenen hoch.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Ein "Talk-Verzeichnis" ist jeder Top-Level-Ordner mit einer slides.md.
// Konvention: datums-präfixiert (YYYYMMDD-…); so bleiben dist/, node_modules,
// playwright-tests, shared u.ä. außen vor, ohne sie einzeln auszuschließen.
const isTalkDir = (name: string): boolean =>
  /^\d{8}-/.test(name) &&
  statSync(resolve(repoRoot, name)).isDirectory() &&
  existsSync(resolve(repoRoot, name, "slides.md"));

const talkDirs = readdirSync(repoRoot).filter(isTalkDir).sort();
const talkSlugs = Object.keys(TALKS) as TalkSlug[];

describe("talks registry ↔ deck directories", () => {
  it.each(talkSlugs)(
    "TALKS-Key %s zeigt auf ein Deck mit slides.md",
    (slug) => {
      expect(existsSync(resolve(repoRoot, slug, "slides.md"))).toBe(true);
    },
  );

  it.each(talkDirs)("Deck-Verzeichnis %s hat einen TALKS-Eintrag", (dir) => {
    expect(talkSlugs).toContain(dir);
  });
});

// Jede <TalkXref slug="…">-Verwendung in irgendeiner slides.md muss auf einen
// bekannten Slug zeigen — fängt Tippfehler und umbenannte/gelöschte Decks ab,
// die sonst stumm den Slug als Linktext rendern.
const xrefSlugs: { file: string; slug: string }[] = [];
for (const dir of talkDirs) {
  const file = resolve(repoRoot, dir, "slides.md");
  const md = readFileSync(file, "utf8");
  for (const m of md.matchAll(/<TalkXref[^>]*\bslug=["']([^"']+)["']/g)) {
    xrefSlugs.push({ file: `${dir}/slides.md`, slug: m[1] });
  }
}

describe("TalkXref slug-Attribute", () => {
  if (xrefSlugs.length === 0) {
    it("noch keine TalkXref-Verwendung gefunden (Smoke)", () => {
      expect(xrefSlugs).toEqual([]);
    });
  }
  it.each(xrefSlugs)("$file: slug=$slug ist registriert", ({ slug }) => {
    expect(talkSlugs).toContain(slug);
  });
});
