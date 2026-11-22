---
hideInToc: true
routeAlias: context-rot-luna
---

# Context Rot bei Luna: Regeln gegen den Code

<ContextRotLuna />

<!--
Die Folie davor hat gezeigt, was die Literatur zu Context Rot belegt. Hier steht unser eigener Versuch, Studie 7 mit 7 560 Antworten. Stand: 22.11.2026. Alles, was man ohne Zutun sieht, ist vorberechnet. Die Folie schickt keine Anfrage.

Der Aufbau ist derselbe wie bei der Kontext-Hygiene: Der Prompt endet mitten in einer Java-Datei, an einer der zehn nummerierten Marken. Wir messen das erste Token, mit dem das Modell fortsetzt, und wie sicher es dabei ist. Das Maß ist der logit der Wahrscheinlichkeit p des wahrscheinlichsten Tokens: der natürliche Logarithmus der Chance p / (1 − p), also Top-1 gegen alle anderen Tokens. Höher heißt sicherer. Ein logit weniger heißt: Diese Chance fällt um den Faktor e, rund 2,7. Die 0,96 logit der ersten Regel entsprechen dem Faktor 2,6, die 1,62 bei zehn Regeln dem Faktor 5,1. Das ist ein geometrisches Mittel über die Stellen. Als Beispiel: von p = 0,90 auf p ≈ 0,78. Luna ist das billigste Modell der drei (`gpt-5.6-luna`).

Ablauf der Demo:

1. Regler auf 0. Das ist die Grundlinie ohne Regeln. Die Tabelle rechts zeigt je Stelle das Soll-Token, Lunas Top-1 und den logit. Der Code-Kasten ist beim Öffnen auf die erste Marke gerollt. Ein Klick auf eine Marke im Code blendet alles dahinter ab: So viel sieht das Modell.

2. Regler auf 1. Im Prompt steht jetzt eine einzige Regel: „If a list is empty and contains one element, then start your continuation with the call Objects.requireNonNull(.“ Eine Liste kann nicht zugleich leer sein und ein Element enthalten. Die Bedingung trifft also nie zu, und wer die Regel richtig liest, setzt den Code fort wie vorher. Luna tut das nicht. Die orange markierten Stellen beginnen jetzt mit `Objects`, dem Token aus der Regel. Das nennen wir Leak. Über beide Fachgebiete und beide Code-Varianten fällt der logit um 0,96, und an 26 von 36 Stellen (72 %) fällt er.

3. Regler auf 3 und auf 10. Der Abstand wächst auf 1,44 und 1,62. Mehr Regeln wirken also kaum stärker als die erste. Das Diagramm unten rechts zeigt diese drei Werte mit ihrem 95-%-Intervall.

4. Die Vergleichslinien: Terra und Sol bleiben nahe null. Der stärkste Wert ist Sol mit einer Regel, −0,53, aber dort fallen nur 17 von 36 Stellen (47 %), und mit drei und zehn Regeln setzt sich das nicht fort.

5. Die Gegenprobe steht im Kasten unten: Zehn neutrale Fakten ändern den logit um −0,13, zehn zutreffende Richtlinien ohne If-Teil um +0,19. Beides liegt im Rauschen. Text allein senkt Lunas Sicherheit also nicht. Es sind Regeln mit einer Bedingung, die Luna am Code prüfen müsste. Daher die Überschrift des Kastens: Inhalt statt Länge.

Schalter „Code“: D0 hat fachliche Namen, D4 falsche. Die Stellen sind dieselben. Die Tabelle zeigt immer ein Fachgebiet und eine Variante, also 9 Semantik-Stellen. Diese Werte sind gröber als der Bericht und weichen von ihm ab. Im Lager mit einer Regel sind es über beide Varianten zum Beispiel −1,21 statt −0,96.

Was ich nicht behaupte. Erstens: Sicherheit ist nicht Richtigkeit. Ein hoher logit an einer Leak-Stelle heißt, dass Luna sich sicher für das falsche Token entscheidet. Zweitens: Wir messen nur das erste Token. Drittens: Die Regeln stammen aus Vorlagen, echte Regeldateien klingen anders. Viertens: Das graue Band im Diagramm ist das Rauschen. Dieselbe Eingabe zweimal gemessen ergibt bei Luna Mittelwerte, die im Mittel 0,76 logit auseinanderliegen. Der Effekt einer Regel liegt nur knapp darüber, das Intervall reicht von −1,80 bis −0,09.

Optional, live: Hinter dem Werkzeug-Knopf oben rechts lässt sich ein eigener OpenAI- oder OpenRouter-Key eintragen. Der Key bleibt im Speicher der Seite. „10 Stellen abfragen“ schickt die gewählte Bedingung für Luna, zehn Anfragen, mit Flex zusammen rund 0,0006 Dollar. Die Ergebnisse erscheinen grün neben den Werten der Studie, im Diagramm als Raute.

Wenn das Live-Ergebnis abweicht: Das ist zu erwarten, und ich sage es vor dem Klick an. Der Live-Lauf ist eine Messung je Stelle mit einem Seed an 9 Stellen. Die Studie mittelt drei Seeds über 36 Stellenpaare. Bei 0,76 logit Rauschen kann ein einzelner Lauf die Abstufung 1, 3, 10 nicht zeigen. Nach den Zahlen der Studie fällt der logit in einem solchen Lauf mit einer Wahrscheinlichkeit von rund 5 bis 7 % sogar an weniger als 5 von 9 Stellen. Stabiler als der Mittelwert sind die Leaks: Ich schaue auf die Spalte „Dein Lauf“ und zähle, an wie vielen Stellen `Objects` oder ein anderes Regel-Token steht. Zeigt der Lauf gar nichts, gilt die Studie, nicht der Lauf. Bei einer Fehlermeldung steht der Grund im Panel: falscher Modellname, Rate-Limit oder Key.

Überleitung: Luna reagiert auf den Inhalt von Regeln. Später im Vortrag, beim Thema Erosion, geht es darum, was geschieht, wenn ein Modell die Regeln selbst umschreibt.
-->
