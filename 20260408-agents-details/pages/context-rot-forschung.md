---
hideInToc: true
routeAlias: context-rot-forschung
---

# Context Rot: Stand der Forschung

<ContextRotForschung />

<!--
Kompaktierung braucht man, weil das Fenster voll läuft. Es gibt einen zweiten Grund: Ein Modell nutzt ein volles Fenster schlechter als ein leeres. Die Literatur nennt das Context Rot. Stand der Recherche: 22.11.2026.

Die Tabelle zeigt, was gut belegt ist. Länge: Im Benchmark NoLiMa fallen bei 32K Tokens 11 von 13 Modellen unter die Hälfte ihrer Leistung im kurzen Kontext. Position: Information in der Mitte wird schlechter genutzt als am Rand. Dafür nenne ich keine Zahl, im Abstract der Arbeit steht keine. Distraktoren: Neutraler Fülltext kostet beim Abruf nichts, die Trefferquote bleibt bei 0,97 bis 1,00. Rivalen im gleichen Format drücken sie auf 0,16 bis 0,33. Das ist an kleinen offenen Modellen gemessen, es zeigt den Mechanismus. Anweisungsdichte: Bei 500 Anweisungen zugleich erreichen die besten von 20 Modellen 68 %. Mehrrunden: Kommt eine Aufgabe über mehrere Runden verteilt, fällt die Leistung im Mittel um 39 %.

Wichtig für die Einordnung: Die meisten Modelle in diesen Arbeiten sind von 2023 bis Mitte 2025. Für aktuelle Modelle habe ich eine einzige Messung gefunden, einen Firmenblog mit 20 Aufgaben. GPT-5.6 Sol fällt dort bei 250k Tokens Vorkontext von 31 auf 24 % gelöste Aufgaben. Opus 5 fällt nur, wenn der Vorkontext zur Aufgabe passt, von 50 auf 40 %.

Zur Folie davor: Kompaktierung löst das Platzproblem und verliert dabei Nebenbedingungen. In einer Arbeit von 2026 bleiben im Mittel 17 % der eingefügten Nebenbedingungen erhalten. Im Postfach-Test löscht der Agent danach in 30 von 100 Sitzungen Mails ohne Freigabe, vorher in keiner. Die 17 % sind ein Mittelwert über sehr verschiedene Verfahren, zwei davon behalten gar nichts. Details stehen hinter dem Info-Knopf.

Rechts steht, was ich nicht behaupte. Der Satz „nach drei Runden ist über die Hälfte der Regeln weg“ hat eine Quelle: einen synthetischen Versuch mit 20 Regeln und 31-facher Kompression, dort gehen 53 % verloren. Ein Gesetz ist das nicht, andere Arbeiten messen andere Kurven. Ebenso wenig belegt ist, dass die Länge allein die Ursache ist, oder dass neue Modelle das Problem gelöst haben.

Unser eigenes Experiment von der Folie Kontext-Hygiene misst etwas anderes: die Sicherheit am ersten Token, nicht die Richtigkeit. Es kann die Literatur deshalb weder bestätigen noch widerlegen. Bei Luna fiel die Sicherheit bis 128k Tokens Fülltext nicht ab. Eine einzige Regel, die das Modell gegen den Code prüfen muss, senkt sie dagegen um 0,96 logit. Der Inhalt wirkt also, nicht die Länge. Das probieren wir auf der nächsten Folie live aus.
-->
