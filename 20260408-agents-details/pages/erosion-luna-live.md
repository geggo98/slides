---
hideInToc: true
routeAlias: erosion-luna-live
title: "Luna schreibt die Regeln um: live"
---

# Luna schreibt die Regeln um: live

<ErosionLive />

<!--
Diese Folie ist versteckt und folgt auf „Luna schreibt die Regeln um“. Sie stellt eine Kette aus Studie 9 live nach, mit meinem eigenen OpenAI-Key.

Das Wichtigste zuerst: Das ist ein Nachbau. Den Originalcode der Studie habe ich hier nicht. Fülltext und Antwort-Parser sind neu gebaut, der Fülltext ist ein eigener, kleinerer Satz. Prompts, Originalliste, Teststellen und Parameter stammen aus der Aufzeichnung. Die Zahlen sind deshalb nicht direkt mit der vorigen Folie vergleichbar.

Zweitens: Ein Lauf ist eine einzelne Kette ohne Wiederholung, mit einer Messung je Stelle. Einzelne Ketten streuen stark. In der Aufzeichnung, Luna mit dem Auftrag „Neu schreiben“, verlieren 8 von 10 Ketten (80 %). Im Mittel fällt die Befolgung von 0,92 am Start auf 0,38 nach Runde 6. Geht der Live-Lauf gut aus, widerlegt das die Studie nicht; geht er schlecht aus, bestätigt er sie nicht.

Drittens: Der Fülltext wird in jeder Runde neu gezogen. Die Aufzeichnung ist vom 22.11.2026, und OpenAI kann das Modell hinter dem Namen seitdem geändert haben.

Bedienung: Key eintragen, Auftrag wählen, Start. Zuerst testet die Folie die Originalliste an den vier Stellen, dann schreibt das Modell die Liste sechsmal um, und nach jeder Runde folgt der Test. Die Studie testete Luna nur nach den Runden 1, 2, 4 und 6; deshalb hat die aufgezeichnete Kurve rechts nur dort Punkte. Insgesamt sind es 6 Umschreib- und 28 Testanfragen.

Die Kosten oben sind eine Schätzung: Gesamtkosten der Studie, 1,1830 $ mit Flex, geteilt durch ihre 64 Ketten. Ohne Flex ist der doppelte Preis angesetzt, das ist meine Annahme. Eine Dauer schätzt die Folie nicht. Flex ist aus, weil es live zu langsam und zu oft ausgelastet ist.

Der Key bleibt im Browser. Er geht nur an api.openai.com, wird nicht gespeichert und in Fehlermeldungen geschwärzt. Kann der Parser eine Antwort nicht lesen, bleibt die Liste der Vorrunde stehen, und über der Liste steht der Grund.

Die Parameter wie in der Studie: Umschreiben über Chat Completions mit reasoning_effort none, Seed 1000 plus Runde, höchstens 1 500 Ausgabe-Tokens. Test mit höchstens 4 Ausgabe-Tokens, logprobs an, top_logprobs 5, Seed 1000. Laut API-Doku macht der Seed Antworten nur nach Möglichkeit wiederholbar.

Quellen, abgerufen am 26.11.2026:
https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
https://developers.openai.com/api/docs/guides/flex-processing
-->
