// Globale Mermaid-Konfiguration für diesen Talk. Slidev mergt setup/mermaid.ts in
// die Mermaid-Initialisierung (Theme/Dark bleibt von Slidev gesteuert). Wir schalten
// nur die gespiegelten Akteur-Boxen am unteren Rand ab — sie kosten in den
// Sequenzdiagrammen auf Folie „Self-Invocation" unnötig vertikale Höhe.
import { defineMermaidSetup } from "@slidev/types";

export default defineMermaidSetup(() => ({
  sequence: { mirrorActors: false, useMaxWidth: true },
}));
