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
  // `@bokuweb/zstd-wasm` resolves its binary with `new URL("./zstd.wasm",
  // import.meta.url)`. Vite's dependency pre-bundling rewrites that URL into
  // the .vite/deps cache, where the file does not exist (vitejs/vite#8427), so
  // the module is excluded and served from source. The binary itself is loaded
  // from public/ via an explicit path — see components/lib/zstdRuntime.ts.
  optimizeDeps: {
    exclude: ["@bokuweb/zstd-wasm"],
  },
});
