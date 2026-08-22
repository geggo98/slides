/**
 * Post-build step for the GitHub Pages deploy: writes `dist/404.html` and injects
 * the SPA path-restore script into every built deck's `index.html`.
 *
 * Run by the `slides:spa-redirect` devenv task. See `spa-scripts.ts` for why the
 * two scripts belong together.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  deckBase,
  make404Html,
  makeRestoreTag,
  RESTORE_TAG_PATTERN,
} from "./spa-scripts";

const root = process.env.DEVENV_ROOT ?? process.cwd();
const basePath = process.env.SLIDES_BASE_PATH ?? "slides";
const dist = join(root, "dist");

const entries = await readdir(dist, { withFileTypes: true }).catch(() => {
  throw new Error(`No build output at ${dist} — run slides:build first`);
});

let patched = 0;
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const indexPath = join(dist, entry.name, "index.html");
  const html = await readFile(indexPath, "utf-8").catch(() => null);
  if (html === null) continue;

  const stripped = html.replace(RESTORE_TAG_PATTERN, "");
  if (!stripped.includes("<head>"))
    throw new Error(
      `${indexPath} has no <head> to inject the SPA restore script into`,
    );

  const tag = makeRestoreTag(deckBase(basePath, entry.name));
  await writeFile(indexPath, stripped.replace("<head>", `<head>${tag}`));
  console.log(`Patched: ${indexPath}`);
  patched++;
}

if (patched === 0) throw new Error(`No deck index.html found below ${dist}`);

const notFoundPath = join(dist, "404.html");
await writeFile(notFoundPath, make404Html(basePath));
console.log(`Created: ${notFoundPath}`);
