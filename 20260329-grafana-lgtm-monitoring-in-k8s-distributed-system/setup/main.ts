// Load shared Slidev design tokens globally so every slide has the CSS
// variables (--color-text-primary, --color-background-info, etc.) without
// needing a wrapper component. Slidev runs setup/main.ts at app boot, so
// the side-effect import puts the tokens in the global stylesheet.
// Callout und TalkXref werden zusätzlich global registriert, weil sie direkt
// in slides.md (Markdown) verwendet werden — Slidev auto-importiert nur die
// lokalen components/, keine shared/ ones.
import { defineAppSetup } from "@slidev/types";
import "@shared/components/SlidevTokens.vue";
import Callout from "@shared/components/Callout.vue";
import TalkXref from "@shared/components/TalkXref.vue";

export default defineAppSetup(({ app }) => {
  app.component("Callout", Callout);
  app.component("TalkXref", TalkXref);
});
