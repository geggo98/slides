/**
 * GitHub Pages can't rewrite URLs, so a deep link like
 * `/slides/<deck>/pareto-historie` is a hard 404 on the server. The workaround is
 * a two-step client-side handoff:
 *
 *   1. the site-wide `404.html` bounces to the deck's `index.html`, carrying the
 *      originally requested path in the `__spa` query parameter, and
 *   2. a script in that `index.html`'s `<head>` restores the path via
 *      `history.replaceState` before the app bundle boots.
 *
 * Both halves must agree on one thing: `__spa` carries the **full** path,
 * including the base. A root-relative remainder (`/pareto-historie`) would be
 * restored as `https://<host>/pareto-historie` — the base silently dropped, the
 * URL unshareable, and a reload of it a hard 404 outside the project site.
 *
 * The scripts are generated here (rather than inlined into `devenv.nix`) so the
 * round trip is unit-testable — see `__tests__/spa-redirect.test.ts`.
 */

/** Normalizes `slides`, `/slides`, `slides/` … to `/slides/`; empty input to `/`. */
export function normalizeBase(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

/** Base of a single deck below the site base, e.g. `/slides/20260408-agents-details/`. */
export function deckBase(basePath: string, deck: string): string {
  return `${normalizeBase(basePath)}${deck}/`;
}

/**
 * Body of the site-wide 404 handler: `/<base>/<deck>/<rest>` becomes
 * `/<base>/<deck>/?__spa=<full original path>`. Anything without a deck segment
 * (or outside the base) falls back to the landing page.
 */
export function make404Script(basePath: string): string {
  const base = JSON.stringify(normalizeBase(basePath));
  return `(function () {
  var BASE = ${base};
  var path = location.pathname;
  if (path.indexOf(BASE) !== 0) {
    location.replace(BASE);
    return;
  }
  var segs = path.slice(BASE.length).split("/").filter(Boolean);
  if (segs.length < 2) {
    location.replace(BASE);
    return;
  }
  var deckBase = BASE + segs[0] + "/";
  var target = deckBase + segs.slice(1).join("/") + location.search + location.hash;
  location.replace(deckBase + "?__spa=" + encodeURIComponent(target));
})();`;
}

/** Complete `dist/404.html`. */
export function make404Html(basePath: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Redirecting…</title></head><body><script>
${make404Script(basePath)}
</script></body></html>
`;
}

/**
 * Body of the per-deck restore script. Only paths inside this deck's own base are
 * restored — that rejects protocol-relative forms (`//host/…`), other decks, and
 * hand-crafted junk; those merely lose the `__spa` query.
 */
export function makeRestoreScript(base: string): string {
  const deck = JSON.stringify(base);
  return `(function(){var BASE=${deck};var q=new URLSearchParams(location.search).get("__spa");if(q)history.replaceState(null,"",q.indexOf(BASE)===0?q:BASE)})();`;
}

/** Marker attribute that makes the injection idempotent across repeated builds. */
export const RESTORE_MARKER = "data-spa-restore";

/** `<script>` tag injected into a deck's `index.html`. */
export function makeRestoreTag(base: string): string {
  return `<script ${RESTORE_MARKER}>${makeRestoreScript(base)}</script>`;
}

/**
 * Matches a previously injected tag, so a re-run replaces instead of stacking.
 * The second alternative catches the unmarked tag shipped before this module
 * existed — it would otherwise survive in a stale `dist/` and consume the
 * `__spa` query with the old, base-dropping logic.
 */
export const RESTORE_TAG_PATTERN = new RegExp(
  `<script ${RESTORE_MARKER}>[\\s\\S]*?</script>|<script>[^<]*__spa[^<]*</script>`,
  "g",
);
