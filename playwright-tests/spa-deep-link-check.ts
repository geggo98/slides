/**
 * End-to-end check for the GitHub Pages SPA fallback (deploy/spa-scripts.ts).
 *
 * Serves dist/ the way GitHub Pages serves a project site: the repo is mounted at
 * /slides/, a missing path below it gets dist/404.html, and anything outside it
 * gets a bare 404 (that is GitHub's own error page — the reason a base-less URL
 * such as /pareto-historie is a dead end).
 *
 * Deep links are loaded with every .js request aborted. Without the app bundle,
 * Vue Router can't boot — and therefore can't paper over a wrong URL with its own
 * first `history.replace`. Whatever the address bar shows is purely the work of
 * the 404 → `?__spa` → replaceState handoff.
 *
 * Usage: bun run playwright-tests/spa-deep-link-check.ts
 */
import { file } from "bun";
import { join } from "node:path";
import { chromium } from "playwright";

const DIST = join(import.meta.dir, "..", "dist");
const BASE = "/slides";
const DECK = "20260408-agents-details";

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path !== BASE && !path.startsWith(`${BASE}/`))
      return new Response("Not Found — outside the project site", {
        status: 404,
      });

    const relative = path.slice(BASE.length) || "/";
    for (const candidate of [
      join(DIST, relative),
      join(DIST, relative, "index.html"),
    ]) {
      const hit = file(candidate);
      if (await hit.exists()) return new Response(hit);
    }
    return new Response(file(join(DIST, "404.html")), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  },
});

const origin = `http://127.0.0.1:${server.port}`;
const paths = [
  `${BASE}/${DECK}/41`,
  `${BASE}/${DECK}/pareto-historie`,
  `${BASE}/${DECK}/41?clicks=3`,
  `${BASE}/${DECK}/pareto-historie?clicks=3#note`,
  `${BASE}/${DECK}/presenter/41`,
  `${BASE}/${DECK}/overview`,
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/*.js", (route) => route.abort());

let failed = 0;
function check(label: string, actual: string, expected: string) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `\n       got ${actual}`}`,
  );
}

async function open(path: string) {
  await page.goto(origin + path, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(150); // let a late redirect settle
  return page.url().slice(origin.length);
}

for (const path of paths) check(path, await open(path), path);

// An unknown deck must end on the landing page instead of looping.
check(`${BASE}/typo-deck/41`, await open(`${BASE}/typo-deck/41`), `${BASE}/`);

await browser.close();
server.stop(true);
console.log(
  failed === 0
    ? "\nAll deep links kept their base path."
    : `\n${failed} failed`,
);
process.exit(failed === 0 ? 0 : 1);
