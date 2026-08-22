import { describe, expect, it } from "vitest";

import {
  deckBase,
  make404Html,
  make404Script,
  makeRestoreScript,
  makeRestoreTag,
  normalizeBase,
  RESTORE_TAG_PATTERN,
} from "../spa-scripts";

const ORIGIN = "https://geggo98.github.io";
const BASE = "slides";
const DECK = "20260408-agents-details";

/**
 * The tests below evaluate the *shipped* script sources — not a re-implementation —
 * against a stub `location`/`history`, so a regression in the emitted JS fails here.
 */
function evaluate(
  source: string,
  url: string,
  onNavigate: (next: string) => void,
): void {
  const current = new URL(url, ORIGIN);
  const location = {
    get pathname() {
      return current.pathname;
    },
    get search() {
      return current.search;
    },
    get hash() {
      return current.hash;
    },
    replace: onNavigate,
  };
  const history = {
    replaceState: (_state: unknown, _title: string, next: string) =>
      onNavigate(next),
  };
  new Function("location", "history", "URLSearchParams", source)(
    location,
    history,
    URLSearchParams,
  );
}

/** Step 1: what `404.html` redirects a requested path to. */
function redirect(path: string, basePath = BASE): string {
  let target: string | undefined;
  evaluate(make404Script(basePath), path, (next) => {
    target ??= next;
  });
  if (target === undefined)
    throw new Error(`404 script did not navigate for ${path}`);
  return target;
}

/** Step 2: the URL the deck's index.html restores from `?__spa=…`. */
function restore(url: string, base = deckBase(BASE, DECK)): string {
  const current = new URL(url, ORIGIN);
  let final = current.pathname + current.search + current.hash;
  evaluate(makeRestoreScript(base), url, (next) => {
    final = next;
  });
  return final;
}

/** The full handoff a reload on a deep link goes through. */
function reload(path: string): string {
  return restore(redirect(path));
}

describe("normalizeBase", () => {
  it("normalizes every spelling of the site base", () => {
    for (const raw of ["slides", "/slides", "slides/", "/slides/", " slides "])
      expect(normalizeBase(raw)).toBe("/slides/");
    expect(normalizeBase("")).toBe("/");
    expect(deckBase("slides", DECK)).toBe(`/slides/${DECK}/`);
  });
});

describe("deep-link reload", () => {
  it.each([
    ["numeric slide", `/slides/${DECK}/41`],
    ["routeAlias slide", `/slides/${DECK}/pareto-historie`],
    ["slide with clicks", `/slides/${DECK}/41?clicks=3`],
    [
      "slide with query and hash",
      `/slides/${DECK}/pareto-historie?clicks=3#note`,
    ],
    ["presenter route", `/slides/${DECK}/presenter/41`],
    ["overview route", `/slides/${DECK}/overview`],
  ])("restores the original path for a %s", (_label, path) => {
    expect(reload(path)).toBe(path);
  });

  it("never drops the base — the bug this guards against", () => {
    // Was: /slides/<deck>/pareto-historie → ?__spa=%2Fpareto-historie → /pareto-historie
    const redirected = redirect(`/slides/${DECK}/pareto-historie`);
    expect(redirected).toBe(
      `/slides/${DECK}/?__spa=${encodeURIComponent(`/slides/${DECK}/pareto-historie`)}`,
    );
    expect(
      reload(`/slides/${DECK}/pareto-historie`).startsWith(`/slides/${DECK}/`),
    ).toBe(true);
  });

  it("works for the base path CI uses (the repo name)", () => {
    const path = `/my-repo/${DECK}/pareto-historie`;
    const redirected = redirect(path, "my-repo");
    expect(restore(redirected, deckBase("my-repo", DECK))).toBe(path);
  });
});

describe("404 fallbacks", () => {
  it.each([
    ["a path without a deck segment", `/slides/${DECK}`],
    ["the bare base", "/slides"],
    ["an unknown deck root", "/slides/typo-deck"],
  ])("sends %s to the landing page", (_label, path) => {
    expect(redirect(path)).toBe("/slides/");
  });

  it("sends paths outside the base to the landing page", () => {
    expect(redirect("/pareto-historie")).toBe("/slides/");
    expect(redirect("/")).toBe("/slides/");
  });

  it("keeps bouncing an unknown deck's deep link until it reaches the landing page", () => {
    // /slides/typo-deck/41 → /slides/typo-deck/?__spa=… → (404 again) → /slides/
    const first = redirect("/slides/typo-deck/41");
    expect(first.startsWith("/slides/typo-deck/?__spa=")).toBe(true);
    expect(redirect(new URL(first, ORIGIN).pathname)).toBe("/slides/");
  });
});

describe("restore guard", () => {
  it("passes through a path inside this deck", () => {
    const url = `/slides/${DECK}/?__spa=${encodeURIComponent(`/slides/${DECK}/41`)}`;
    expect(restore(url)).toBe(`/slides/${DECK}/41`);
  });

  it.each([
    ["a protocol-relative host", "//evil.example/pwned"],
    ["another deck", "/slides/20260327-ai-agents/1"],
    ["a base-less path", "/pareto-historie"],
    ["junk", "not-a-path"],
  ])("drops %s and falls back to the deck root", (_label, spa) => {
    const url = `/slides/${DECK}/?__spa=${encodeURIComponent(spa)}`;
    expect(restore(url)).toBe(`/slides/${DECK}/`);
  });

  it("leaves an ordinary deck URL untouched", () => {
    expect(restore(`/slides/${DECK}/`)).toBe(`/slides/${DECK}/`);
    expect(restore(`/slides/${DECK}/?print`)).toBe(`/slides/${DECK}/?print`);
  });
});

describe("emitted artifacts", () => {
  it("wraps the 404 script in a complete document", () => {
    const html = make404Html(BASE);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain(make404Script(BASE));
  });

  it("emits a tag the injector can find and replace", () => {
    const tag = makeRestoreTag(deckBase(BASE, DECK));
    expect(tag.match(RESTORE_TAG_PATTERN)).toEqual([tag]);
    expect(`<head>${tag}<meta>`.replace(RESTORE_TAG_PATTERN, "")).toBe(
      "<head><meta>",
    );
  });

  it("strips the legacy unmarked tag out of a stale build", () => {
    const legacy =
      '<script>(function(){var q=new URLSearchParams(location.search).get("__spa");if(q){history.replaceState(null,"",q)}})()</script>';
    expect(`<head>${legacy}<meta>`.replace(RESTORE_TAG_PATTERN, "")).toBe(
      "<head><meta>",
    );
  });
});
