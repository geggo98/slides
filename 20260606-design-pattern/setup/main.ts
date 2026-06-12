// Load shared Slidev design tokens globally so every slide has the CSS
// variables (--color-text-primary, --color-background-info, etc.) without
// needing a wrapper component. Slidev runs setup/main.ts at app boot, so
// the side-effect import puts the tokens in the global stylesheet.
// TalkXref/TalkXrefPanel werden zusätzlich global registriert, weil sie
// direkt in slides.md (Markdown) verwendet werden — Slidev auto-importiert
// nur die lokalen components/, keine shared/ ones.
import { defineAppSetup } from "@slidev/types";
import "@shared/components/SlidevTokens.vue";
import TalkXref from "@shared/components/TalkXref.vue";
import TalkXrefPanel from "@shared/components/TalkXrefPanel.vue";

export default defineAppSetup(({ app }) => {
  app.component("TalkXref", TalkXref);
  app.component("TalkXrefPanel", TalkXrefPanel);
});
