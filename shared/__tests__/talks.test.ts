import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TALK_BASE_URL, TALKS, talkUrl, type TalkSlug } from "../talks";

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

describe("talkUrl", () => {
  it("ohne anchor: kanonische Deck-URL mit Trailing-Slash", () => {
    expect(talkUrl("20260428-java-null-pointer")).toBe(
      `${TALK_BASE_URL}20260428-java-null-pointer/`,
    );
  });

  it("mit anchor: routeAlias als Pfad-Segment (kein Hash — history-Mode)", () => {
    expect(talkUrl("20260428-java-null-pointer", "jspecify")).toBe(
      `${TALK_BASE_URL}20260428-java-null-pointer/jspecify`,
    );
  });

  it("mit numerischem anchor: Folien-Nummer als Pfad-Segment", () => {
    expect(talkUrl("20260522-open-rewrite", 12)).toBe(
      `${TALK_BASE_URL}20260522-open-rewrite/12`,
    );
  });

  it("normalisiert führende Slashes im anchor (kein Doppel-Slash)", () => {
    expect(talkUrl("20260522-open-rewrite", "/recipe-mechanik")).toBe(
      `${TALK_BASE_URL}20260522-open-rewrite/recipe-mechanik`,
    );
  });

  it("leerer anchor verhält sich wie kein anchor", () => {
    expect(talkUrl("20260606-design-pattern", "")).toBe(
      `${TALK_BASE_URL}20260606-design-pattern/`,
    );
  });
});

// Anker-Robustheit: Jeder Cross-Deck-Anker in einer slides.md muss im
// Ziel-Deck existieren — als `routeAlias:`-Frontmatter (Konvention) oder als
// nackte Folien-Nummer. Erfasst werden beide Verwendungsformen:
//   <TalkXref slug="…" anchor="…">            (direkte Links)
//   { slug: "…", …, anchor: "…" }             (TalkXrefPanel-:refs-Literale)
// Aliasse in Deck-eigenen .vue-Komponenten sieht der Scan – wie schon der
// Slug-Scan oben – nicht; die Konsolidierung auf TalkXrefPanel verlagert die
// Daten aber gerade in slides.md, wo dieser Test greift.
const routeAliasesByDeck = new Map<string, Set<string>>();
for (const dir of talkDirs) {
  const md = readFileSync(resolve(repoRoot, dir, "slides.md"), "utf8");
  routeAliasesByDeck.set(
    dir,
    new Set(
      [...md.matchAll(/^routeAlias:\s*["']?([\w-]+)["']?\s*$/gm)].map(
        (m) => m[1],
      ),
    ),
  );
}

const xrefAnchors: { file: string; slug: string; anchor: string }[] = [];
for (const dir of talkDirs) {
  const file = `${dir}/slides.md`;
  const md = readFileSync(resolve(repoRoot, dir, "slides.md"), "utf8");
  // Form 1: <TalkXref … slug="…" … anchor="…" …>
  for (const m of md.matchAll(/<TalkXref\b[^>]*>/g)) {
    const slug = /\bslug=["']([^"']+)["']/.exec(m[0])?.[1];
    const anchor = /\banchor=["']([^"']+)["']/.exec(m[0])?.[1];
    if (slug && anchor) xrefAnchors.push({ file, slug, anchor });
  }
  // Form 2: Objekt-Literale mit slug+anchor (z.B. in :refs von TalkXrefPanel).
  for (const m of md.matchAll(/\{[^{}]*\bslug:\s*["']([^"']+)["'][^{}]*\}/g)) {
    const anchor = /\banchor:\s*["']([^"']+)["']/.exec(m[0])?.[1];
    if (anchor) xrefAnchors.push({ file, slug: m[1], anchor });
  }
}

describe("TalkXref/TalkXrefPanel anchor-Attribute", () => {
  if (xrefAnchors.length === 0) {
    it("noch keine anchor-Verwendung gefunden (Smoke)", () => {
      expect(xrefAnchors).toEqual([]);
    });
  }
  it.each(xrefAnchors)(
    "$file: anchor=$anchor existiert in $slug",
    ({ slug, anchor }) => {
      if (/^\d+$/.test(anchor)) return; // Folien-Nummer: kein Alias nötig
      expect([...(routeAliasesByDeck.get(slug) ?? [])]).toContain(anchor);
    },
  );
});
