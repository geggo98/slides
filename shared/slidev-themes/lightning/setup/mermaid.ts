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
// Die Schrift folgt dem Fließtext; 16 px liegen nach der Skalierung eines
// {scale: 0.62}-Diagramms noch über der kleinsten Folienschrift.
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
    fontSize: "16px",
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
    textColor: INK,
    // Flowchart liest diese direkt — auch im dark-Theme.
    mainBkg: CARD,
    nodeBorder: ACCENT,
    nodeTextColor: INK,
    edgeLabelBackground: CARD_ALT,
    clusterBkg: CARD_ALT,
    clusterBorder: ACCENT,
    titleColor: INK,
  },
  flowchart: { useMaxWidth: true, htmlLabels: true },
}));
