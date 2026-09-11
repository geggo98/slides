// Läuft zusätzlich zur setup/main.ts des Decks (Roots-Reihenfolge: Theme,
// dann Deck). Die drei Komponenten werden in slides.md als Markdown-HTML
// benutzt und müssen deshalb global registriert sein — Slidev auto-importiert
// nur components/ der Roots, keine beliebigen shared/-Pfade.
//
// Bewusst KEIN Import von @shared/components/SlidevTokens.vue: das Theme
// bringt in styles/tokens.css ein eigenes, vollständiges Token-Set mit. Ein
// Deck mit diesem Theme braucht daher keine eigene setup/main.ts mehr; hätte
// es eine mit denselben app.component-Aufrufen, warnte Vue vor der doppelten
// Registrierung.
import { defineAppSetup } from "@slidev/types";
import Callout from "@shared/components/Callout.vue";
import TalkXref from "@shared/components/TalkXref.vue";
import TalkXrefPanel from "@shared/components/TalkXrefPanel.vue";

export default defineAppSetup(({ app }) => {
  app.component("Callout", Callout);
  app.component("TalkXref", TalkXref);
  app.component("TalkXrefPanel", TalkXrefPanel);
});
