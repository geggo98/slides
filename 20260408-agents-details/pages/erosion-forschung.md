---
hideInToc: true
routeAlias: erosion-forschung
---

# Strukturelle Erosion: Stand der Forschung

<ErosionForschung />

<!--
Die Rechnung auf der Folie davor gilt für einen Tag. Diese Folie fragt, was passiert, wenn Agenten dauerhaft an derselben Codebasis arbeiten. Stand der Recherche: 22.11.2026. Grundlage ist eine Kurzrecherche, deren Aussagen einzeln an den Primärquellen geprüft wurden. Auf der Folie steht nur, was diese Prüfung bestätigt hat.

Die Kernaussage: Agenten lösen einzelne Aufgaben und verschlechtern zugleich die Voraussetzungen für spätere. Funktionale Korrektheit ersetzt weder Wartbarkeit noch Architektur noch den Erfolg auf lange Sicht.

Zur Tabelle. SlopCodeBench lässt Agenten über viele Checkpoints am eigenen Code weiterbauen. Die strukturelle Erosion steigt in 77 % der Trajektorien. Bei Menschen steigt sie auch, in 53 % der Repositories. Der Unterschied ist also graduell. Gegen 473 offene Python-Repositories ist Agentencode 2,3-mal redundanter und 2,0-mal stärker erodiert. Kein Agent löst eine der 36 Aufgaben über alle 196 Checkpoints. Das ist die strenge Wertung, die beste Konfiguration besteht dort 14,8 % der Checkpoints. Die Kernfunktion gelingt öfter, die beste Rate ist 67,3 %. Bessere Prompts senken den Startwert und lassen die Verfallsrate gleich. Eine Zahl nenne ich dazu nicht, weil Abstract und Haupttext der Arbeit verschiedene Größen angeben.

CodeThread: Agenten lösen Folgeaufgaben auf Agentencode seltener als auf menschlichem Code, im Maximum um 13,1 Prozentpunkte. Das Maximum stammt von einem offenen Modell, GLM 4.7, auf SWE-Bench Pro: 45,2 % gegen 32,0 %. In 4 von 16 Paaren aus Modell und Benchmark (25 %) ist der Agenten-Vorgänger gleich gut oder besser. Klassische Wartbarkeitsmetriken erklären den Unterschied nicht, eher Eingabeprüfung und Fehlerbehandlung.

Needle in the Repo: 64 von 483 Ergebnissen (13,3 %) bestehen alle Funktionstests und verletzen trotzdem die Strukturvorgabe. Die Proben sind gezielt konstruiert, eine Abkürzung ist absichtlich möglich. Die Zahl ist keine Rate für realen Code. RepoReuse: In 50,8 % der Aufgabenketten liegt bis Runde 5 doppelte Logik im Code, bei fast gleicher Bestehensrate.

Links unten die Gegenbelege. Eine spätere Arbeit schränkt CodeThread ein: Besteht der geerbte Code die früheren Tests, verschwindet der Nachteil. Der Wert ist +2,7 Punkte, das Intervall reicht von −0,5 bis +6,1. Der Schaden kommt dort aus geerbten Testfehlern. Und eine Beobachtungsstudie über 37 623 Pull Requests zeigt große Unterschiede zwischen Agenten: Codex-PRs wurden seltener zurückgesetzt als menschliche, 6,1 % gegen 11,5 %, Devin-PRs häufiger, 14,5 %. Die Daten enden im Juli 2025, und die Agenten wurden den Aufgaben nicht zufällig zugeteilt.

Rechts unten steht, was ich nicht behaupte. Erstens: dass jede autonome Codebasis zwangsläufig degeneriert. Die Benchmarks messen Aufgabenketten, keine Jahre. OpenAI schreibt im eigenen Erfahrungsbericht, man wisse noch nicht, wie sich die Architektur einer vollständig von Agenten erzeugten Codebasis über Jahre entwickelt. Zweitens: den Kreislauf, in dem ein Agent eine falsche Annahme dokumentiert und sie später als Wahrheit liest. Er ist plausibel, gemessen hat ihn niemand. Drittens: Die METR-Studie von 2025, nach der erfahrene Entwickler mit KI-Werkzeugen 19 % länger brauchten, misst Produktivität. Sie belegt keine Erosion. Das Update von 2026 deutet auf eine Beschleunigung, METR nennt die eigenen Daten dafür einen sehr schwachen Beleg.

Die Brücke zur nächsten Folie: Auch Doku und Regeln veralten, und dann schaden sie. In einem Versuch mit 40 konstruierten Projekten verlangt die Instruktionsdatei eine veraltete Konvention. 90,1 % der Entscheidungen der Agenten folgen der Datei. Claude Code weist in 79 von 80 Läufen (ca. 99 %) auf den Konflikt hin und folgt der Datei trotzdem. Einschränkung: Ein Vergleich ohne Datei fehlt, und die Autoren haben die veralteten Dateien konstruiert, nicht der Agent geschrieben. Dass der Mensch die Doku schreiben soll, belegt keine Arbeit kausal. Was passiert, wenn ein Modell die Regelliste selbst immer wieder umschreibt, zeigt die nächste Folie mit einem eigenen Experiment.
-->
