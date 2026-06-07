// Load shared Slidev design tokens globally so every slide has the CSS
// variables (--color-text-primary, --color-background-info, etc.) without
// needing a wrapper component. Slidev runs setup/main.ts at app boot, so
// the side-effect import puts the tokens in the global stylesheet.
import { defineAppSetup } from "@slidev/types";
import "@shared/components/SlidevTokens.vue";

export default defineAppSetup(() => {});
