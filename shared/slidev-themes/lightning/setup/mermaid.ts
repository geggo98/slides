// Mermaid rendert in einen Shadow-Root mit Inline-Farben; CSS des Themes
// erreicht das nicht. Slidev initialisiert Mermaid mit dieser Konfiguration
// und legt je Render nur `theme: "dark"` im Dunkelmodus darüber — die
// themeVariables gelten also in BEIDEN Modi und müssen modusneutral sein.
//
// Gemessen am 11.09.2026: `primaryColor` überschreibt im Dunkelmodus nichts
// (das dark-Theme leitet seine Knotenfarbe nicht davon ab), `primaryTextColor`
// aber schon — das Ergebnis waren dunkle Knoten mit dunkler Schrift. Deshalb
// stehen hier die konkreten Flowchart-Variablen (mainBkg, nodeBorder,
// nodeTextColor …), die beide Themes direkt lesen: warm getönte helle Karten
// mit dunkler Schrift und Amber-Rand — auf Papier Karten, auf Graphit helle
// Kacheln — statt Mermaids Lavendel, dem einzigen kühlen Element im Deck.
//
// Die Schrift folgt dem Fließtext. Slidev skaliert ein `{scale: 0.62}`-Diagramm
// samt Text: 20 px werden dort 12,4 px logisch — knapp über `text-xs` (12 px)
// und damit nicht mehr die kleinste Schrift der Folie; 16 px wären 9,9 px.
//
// Kein `textColor`/`titleColor`: die schreibt Mermaid an die SVG-Wurzel und
// an Diagrammtitel, also direkt auf den Folienhintergrund — dort muss die
// Farbe modusabhängig bleiben und kommt vom jeweiligen Mermaid-Theme.
import { defineMermaidSetup } from "@slidev/types";

const INK = "#1c1917";
const CARD = "#fcf2e4";
const CARD_ALT = "#f6f2e8";
const ACCENT = "#d97706";
const LINE = "#8a847e";

export default defineMermaidSetup(() => ({
  theme: "base",
  themeVariables: {
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "20px",
    primaryColor: CARD,
    primaryTextColor: INK,
    primaryBorderColor: ACCENT,
    secondaryColor: CARD_ALT,
    secondaryTextColor: INK,
    secondaryBorderColor: ACCENT,
    tertiaryColor: CARD_ALT,
    tertiaryTextColor: INK,
    tertiaryBorderColor: LINE,
    lineColor: LINE,
    // Flowchart liest diese direkt — auch im dark-Theme.
    mainBkg: CARD,
    nodeBorder: ACCENT,
    nodeTextColor: INK,
    edgeLabelBackground: CARD_ALT,
    clusterBkg: CARD_ALT,
    clusterBorder: ACCENT,
  },
  flowchart: { useMaxWidth: true, htmlLabels: true },
}));
