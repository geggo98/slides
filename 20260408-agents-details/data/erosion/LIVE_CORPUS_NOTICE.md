# Fülltext des Live-Nachlaufs: Herkunft und Lizenzen

**TL;DR:** `study9-live.json` enthält den Fülltext von Studie 9 unverändert: 150 Stücke Prosa, 150 Stücke Mathematik, 150 Stücke Apache-Commons-Lang-Code und 26 Stücke eigenen Java-Codes. Prosa und Mathematik sind gemeinfrei, der Code steht unter Apache-2.0, der eigene Java-Code unter CC0. Dieser Hinweis erfüllt die Bedingungen der Apache-Lizenz (Lizenzverweis und NOTICE-Text).

## Herkunft

Die Folie `erosion-luna-live` lässt eine Regelkette von Luna live nachlaufen (Code: `components/ErosionLive.vue`, `components/lib/erosionLiveLogic.ts`). Zwischen die Regeln stellt der Lauf Fülltext, wie es Studie 9 getan hat. Dazu zieht er Stücke aus diesem Korpus.

- Quelle: <https://github.com/geggo98/context-rot-experiments>, Stand: Commit `7e5e7c7` vom 26.11.2026.
- Dateien dort: `study9/corpus/pieces/prose.json`, `math.json`, `code.json`, `foreign.json`.
- Ein Stück hat rund 250 Tokens. Die vier Arrays stehen in `study9-live.json` unter `corpus.prose`, `corpus.math`, `corpus.code` und `corpus.foreign`, Byte für Byte wie im Original. Nur der Rahmen (`source`, `note`, `licences`) ist neu.
- Das Original führt die Dateien und ihre Lizenzen in `THIRD_PARTY_NOTICES.md` und `REUSE.toml`. Alles, was der Autor der Studie selbst erstellt hat, steht dort unter CC0 1.0 (`LICENSE`).

Grund der Übernahme: Ein Nachlauf mit anderem Fülltext lässt sich nicht mit der aufgezeichneten Kette vergleichen. Grenze: Die Ziehung ist trotzdem nicht die der Studie. Die Studie zog mit dem Mersenne-Twister von Python, der Nachlauf nutzt einen kleinen eigenen Zufallszähler (mulberry32). Dieselbe Kette zieht also andere Stücke. Verteilung und Regel der Ziehung sind gleich: Die Arten wechseln sich ab (Prosa, Mathematik, Code, fremder Code), das Anfangsstück ist zufällig, jedes Stück wird mit Zurücklegen gezogen.

## Lizenzen je Art

| Art            | Inhalt                                                                                                                 | Lizenz                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `prose` (150)  | Auszüge aus Herman Melville, _Moby-Dick_ (1851), Project Gutenberg eBook #2701                                         | gemeinfrei (`LicenseRef-Public-Domain`) |
| `math` (150)   | Auszüge aus Silvanus P. Thompson, _Calculus Made Easy_ (2. Auflage 1914), Project Gutenberg eBook #33283, LaTeX-Quelle | gemeinfrei (`LicenseRef-Public-Domain`) |
| `code` (150)   | Auszüge aus dem Java-Quelltext von Apache Commons Lang 3.17.0                                                          | Apache License 2.0                      |
| `foreign` (26) | Java-Code des Autors der Studie aus deren Studien 1 und 3                                                              | CC0 1.0, keine fremde Lizenz            |

### Prosa und Mathematik: Project Gutenberg

Beide Werke sind gemeinfrei. Die Auszüge aus _Calculus Made Easy_ enthalten noch Hinweise und Danksagungen von Project Gutenberg aus dem LaTeX-Vorspann. Das Original hat sie nicht entfernt, weil die Dateien so bleiben müssen, wie sie gemessen wurden; hier bleiben sie aus demselben Grund. Die Stücke sind keine offiziellen Ausgaben von Project Gutenberg. Die Lizenz von Project Gutenberg steht unter <https://www.gutenberg.org/policy/license.html>.

### Code: Apache Commons Lang 3.17.0 (Apache-2.0)

Copyright 2001-2024 The Apache Software Foundation. Lizenz: Apache License, Version 2.0, <https://www.apache.org/licenses/LICENSE-2.0>. Den vollständigen Lizenztext liefert das Original unter `LICENSES/Apache-2.0.txt`.

Quelle laut Original: das Archiv <https://codeload.github.com/apache/commons-lang/tar.gz/refs/tags/rel/commons-lang-3.17.0> (Tag `rel/commons-lang-3.17.0`), SHA-256 `ed10ddc68d04ec24eeb76a93b2f03b152d855a9ff65e8ce48967180ba3d597f4`.

Änderungen laut Original: Das Skript der Studie nimmt die 45 `.java`-Dateien aus `src/main/java/org/apache/commons/lang3/`, sortiert sie nach Dateinamen, ersetzt Zeilenenden CRLF durch LF, entfernt Leerzeilen am Anfang und Ende jeder Datei und teilt das Ganze an Zeilengrenzen in Stücke von rund 250 Tokens. Sonst ist der Quelltext unverändert, auch die Lizenzköpfe. Der Lizenzkopf einer Datei steht in jedem Stück, das den Anfang dieser Datei enthält; ein Stück aus der Mitte einer Datei enthält ihn nicht. Die Stücke in `study9-live.json` sind gegenüber dem Original nicht weiter geändert.

NOTICE-Datei von Apache Commons Lang, wörtlich:

```text
Apache Commons Lang
Copyright 2001-2024 The Apache Software Foundation

This product includes software developed at
The Apache Software Foundation (https://www.apache.org/).
```

### Eigener Java-Code (`foreign`)

Der Autor der Studie hat diesen Code selbst geschrieben. Er fällt unter dieselbe CC0-1.0-Widmung wie der Rest des Originals.

## Grenzen

- Dieser Hinweis gilt nur für die Datei `study9-live.json`. Die Modellausgaben und Anbieterdaten der Studie stehen nicht darin; für sie gilt Abschnitt 4 von `THIRD_PARTY_NOTICES.md` im Original.
- Wer den Korpus an anderer Stelle weitergibt, legt diesen Hinweis bei, vor allem den NOTICE-Text der Apache Software Foundation.
- Der Stand der Lizenzangaben ist der des Commits `7e5e7c7`. Ändert das Original seine Angaben, ist dieser Hinweis nachzuführen. Ablauf: keiner; der Hinweis gilt, solange `study9-live.json` Auszüge enthält.
