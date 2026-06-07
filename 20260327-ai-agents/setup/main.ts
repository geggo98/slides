// Register shared components that are used directly in slides.md markdown.
// Slidev auto-imports a deck's local components/, but not shared/ ones, so
// markdown-facing shared components are registered globally here.
import { defineAppSetup } from "@slidev/types";
import Callout from "@shared/components/Callout.vue";

export default defineAppSetup(({ app }) => {
  app.component("Callout", Callout);
});
