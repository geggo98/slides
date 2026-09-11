// Reihenfolge ist Absicht: erst Slidevs Basistypografie und die Layout-Regeln
// des Default-Themes (das Default-Theme ist bei einem eigenen Theme kein Root
// mehr, seine CSS-Datei lässt sich aber per Deep-Import weiterverwenden —
// das Paket hat kein exports-Feld), danach das Eigene, das dieselben
// Selektoren mit späterer Position überschreibt.
import "@slidev/client/styles/layouts-base.css";
import "@slidev/theme-default/styles/layouts.css";
import "./fonts.css";
import "./tokens.css";
import "./base.css";
import "./layouts.css";
import "./chrome.css";
