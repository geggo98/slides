---
hideInToc: true
routeAlias: erosion-luna
---

# Luna schreibt die Regeln um

<ErosionChain />

<!--
Die Folie davor zeigt, was die Forschung über Erosion weiß. Hier kommen eigene Experimente dazu, Daten vom 22.11.2026. Die Folie zeigt aufgezeichnete Daten und ruft kein Modell auf.

Der Aufbau: Eine Regelliste mit 20 Regeln für eine Code-Vervollständigung. Vier davon sind Gebote der Form „endet der Code auf X, beginne mit Token T“, jedes in zwei Formulierungen. Dazu kommen 12 allgemeine Richtlinien. Zum Beispiel Gebot D: Nach `new` beginne mit `static`. Das Modell bekommt die Liste mit frischem Fülltext zwischen den Regeln und soll sie umschreiben und vereinfachen. Das wiederholen wir sechsmal, das ist eine Kette. Danach testen wir das Modell mit seiner eigenen Liste: Mit welchem Token beginnt es an einer Stelle, an der ein Gebot greift?

Die Folie öffnet nach Runde 2, und das ist die Pointe: Links stehen alle vier Gebote in der Liste, in den ersten vier Zeilen. In der Mitte befolgt Luna trotzdem an keiner der vier Teststellen das Gebot: „Steht da, wird aber nicht befolgt: 4 von 4“. Gebot D lautet jetzt „After new, begin with static“, und Luna beginnt an der Stelle c025 zu 96 % mit `Money`, dem Token aus dem Originalcode.

Dann den Regler „Runde“ ganz nach links auf „Start“ ziehen: die Originalliste mit 20 Regeln. Luna beginnt an allen vier Teststellen mit dem verlangten Token. Dann auf Runde 1: Luna hat die 20 Regeln auf 16 gekürzt, und schon hier folgt sie nur noch an einer von vier Stellen. Zum Schluss auf Runde 6: Es sind wieder 2 von 4, an c025 bleibt es bei `Money`. Der Wert einer einzelnen Kette schwankt, jede Liste wurde nur einmal getestet.

Die vier Aufträge oben sind die Anweisungen, nach denen das Modell umschreibt. „Neu schreiben“: die ganze Liste neu, ohne Auflage. „Neu mit Auflage“: ebenso, aber Auslöser und Token jeder Regel müssen wörtlich bleiben. „Nur Änderungen“: Das Modell liefert nur Änderungen, ein Skript wendet sie an. „Abschreiben“ ist die Kontrolle: Das Modell gibt die Liste unverändert wieder.

Die Stichworte in der Kettenauswahl: „x von 4“ heißt, an so vielen der vier Teststellen befolgt. „Ohne Gebote“ heißt, die Regeln fehlen in der Liste. „Bei 0 von 4“ heißt, die Regeln stehen da, und Luna befolgt keine.

Diese Kette habe ich nachträglich als Beispiel ausgewählt. Sie ist die erste der zehn Ketten und nicht nach dem Ergebnis gewählt. Einen Verlust zeigen 8 von 10 Ketten (80 %). Rechts steht das Mittel über alle zehn: Die Befolgung fällt von 0,92 am Start auf 0,38 nach Runde 6. Den größten Teil verliert Luna schon in Runde 1. Der Anteil „da, nicht befolgt“ steigt von 0,44 nach Runde 1 auf 0,65 nach Runde 6.

Jetzt Terra wählen: Terra kürzt die Liste auch, auf 16 Regeln mit 7,9 Wörtern je Regel statt 11. Es behält aber Auslöser und Token, und es verliert höchstens 0,01. Gegen diesen einfachen Versuch ist Terra also robust. Ob Terra in komplexeren Szenarien erodiert, habe ich aus Kostengründen nicht getestet. In diesem Versuch hängt die Erosion stark vom Modell ab.

Der Auftrag „Nur Änderungen“ ist der Versuch einer Abhilfe: Das Modell liefert nur die Änderungen, ein Skript wendet sie an. Das ähnelt den inkrementellen Updates aus der ACE-Arbeit, ist aber stark vereinfacht. Bei Luna half es nicht: Nach Runde 6 steht in keiner der 10 Ketten noch ein Gebot. Eine Kette strich in Runde 2 alle 13 übrigen Regeln. ACE ist damit weder reproduziert noch widerlegt, dort arbeiten getrennte Rollen an anderen Inhalten.

Die Grenzen sind eng. Luna hat nur 4 testbare Stellen von 18, rund 22 %, und nur für zwei der vier Gebote. Die Stellen sind danach ausgewählt, dass Luna die Originalliste dort befolgt; der Verlust ist deshalb eher überschätzt. Gemessen ist nur das erste Token. Die Regeln stammen aus Vorlagen. Dasselbe Modell schreibt um und wird getestet. Es sind zwei Modelle eines Herstellers.

Unten steht meine Schlussfolgerung. Sie ist eine Empfehlung und kein Ergebnis der Experimente: Doku, auch Regeln, sollte schreiben, wer an der Quelle sitzt. Aktuell ist das der Mensch. Und: Keine Doku ist besser als falsche Doku. Dafür sprechen drei Dinge. Erstens die eigenen Experimente: Schon das Umschreiben kostet Luna die Befolgung. Zweitens eine Arbeit zu Kontextdateien wie AGENTS.md: LLM-erzeugte Dateien senken den Erfolg leicht, um 0,5 und 2 %, von Entwicklern geschriebene heben ihn um 2,4 %. Beides ist nicht signifikant; nur im direkten Vergleich liegen die Entwickler-Dateien vorn. Drittens die Forschung: Veraltete Regeldateien überstimmen den Code, das stand auf der Folie davor. Und in einer Arbeit von 2024 schadet falsche Doku dem Codeverständnis, fehlende kaum; gemessen an GPT-3.5 und GPT-4.

Die Gegenseite gehört dazu. Ein Entwurf vom Agenten ist sinnvoll, wenn ein Mensch an der Quelle sitzt, ihn prüft und freigibt. Terra blieb in diesem einfachen Versuch stabil; komplexere Szenarien habe ich aus Kostengründen nicht getestet. Und keine Arbeit misst, ob der Autor „an der Quelle sitzt“. Die Quellen und alle Einschränkungen stehen hinter dem Info-Knopf.

Wer es selbst sehen will: Die versteckte Folie danach (Alias `erosion-luna-live`) stellt eine Kette live nach, mit eigenem OpenAI-Key. Sie nutzt den Code der Studie, zieht den Fülltext aber anders und zeigt nur eine einzelne Kette; ihre Zahlen sind deshalb nicht direkt mit dieser Folie vergleichbar.
-->
