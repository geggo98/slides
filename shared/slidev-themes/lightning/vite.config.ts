import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Das Theme registriert in setup/main.ts Komponenten aus shared/ über den
// `@shared`-Alias. Slidev vereint die vite.config aller Roots (Theme, Addons,
// Deck) per mergeConfig; Alias-Arrays werden dabei konkateniert, ein zweiter
// gleicher Eintrag aus dem Deck ist harmlos. So funktioniert das Theme auch
// in einem Deck, das keine eigene vite.config.ts mitbringt.
//
// Vite liest für diese Datei das nächste package.json — deshalb steht dort
// "type": "module", sonst würde sie als CommonJS geladen.
const shared = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  resolve: {
    alias: [{ find: "@shared", replacement: shared }],
  },
});
