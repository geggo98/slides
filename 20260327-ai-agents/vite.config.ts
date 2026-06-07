import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Slidev only merges a vite.config from each deck's own directory (roots =
// theme + addons + userRoot), never the workspace root — so every deck that
// wants the `@shared` runtime alias needs this file. It mirrors the editor
// alias in tsconfig.json so `import … from "@shared/components/…"` works at
// build/dev time instead of brittle "../../../shared/…" paths. The shared dir
// is one level up from this deck. Array form matches Slidev's own alias config
// so vite's mergeConfig concatenates rather than clobbers.
const shared = resolve(dirname(fileURLToPath(import.meta.url)), "../shared");

export default defineConfig({
  resolve: {
    alias: [{ find: "@shared", replacement: shared }],
  },
});
