# Delta-Kodierung im Vergleich: rdiff, xdelta3, bsdiff und zstd --patch-from

Referenz zum Lightning Talk in `slides.md` (gleiches Verzeichnis). Der Talk zeigt eine Datenbankdatei. Dieser Bericht vergleicht die Werkzeuge dahinter an öffentlichen Korpora.

Stand der Messungen: 11. September 2026, Linux-Container mit zstd 1.5.5, librsync 2.3.4, xdelta3 3.0.11 (Ubuntu-Paket) und bsdiff 4.3. Einzelläufe ohne Wiederholung. Laufzeiten sind grob, Größen exakt. Alle Roundtrips wurden mit `cmp` geprüft.

Faktencheck: 11. September 2026 gegen zstd 1.5.7 (Quelltext `programs/fileio.c`, `lib/zstd.h`, `lib/zdict.h`, man page, Wiki, Release-Notes, Issues #4093 und #4182), das xdelta-Repository, librsync `NEWS.md`, das HDiffPatch-README, den Chromium-Quelltext zu Zucchini, RFC 3284 und RFC 9842, die zitierten Papiere und die Größen der requests-Tarballs. Die Korrekturen stehen im Text, §13 listet sie mit Quelle.

Kennzeichnung: **Verifiziert** heißt gemessen oder aus der Primärquelle entnommen, mit Fundstelle. **Interpretation** heißt Lesart der Daten. **Nicht geprüft** heißt: aus Sekundärquellen übernommen, hier nicht belegt.

## TL;DR

Die vier Werkzeuge lösen dasselbe Problem mit drei Familien von Match-Findern. xdelta3 und `zstd --patch-from` gehören zur selben Familie (LZ77 mit externer Referenz). bsdiff nutzt ein Suffix-Array mit approximativem Matching und liefert bei Executables Deltas, die um Faktor 3 kleiner sind. rdiff arbeitet blockweise mit einem Rolling Hash und löst ein anderes Problem: ein Delta ohne Zugriff auf die Basis.

Drei Folgefragen wurden gemessen:

1. `rdiff` plus Nachkompression ist `--patch-from` unterlegen, sobald beide Dateien vorliegen. Gemessen: Faktor 2,6 bis 19 größere Deltas.
2. Ein trainiertes zstd-Dictionary lässt sich mit `--patch-from` nur durch Aneinanderhängen kombinieren. Bei Versionsfolgen bringt es 0,5 %.
3. Bei fester Basis und wandernden Zielen bringt ein Dictionary aus Delta-Residuen Faktor 3 bis 4. Die Basis nachzuziehen schlägt es trotzdem.

Zwei Befunde aus dem Faktencheck gehen über Stilfragen hinaus: Das Fenster von `--patch-from` richtet sich nach der Zieldatei, nicht nach der Basis (§3.4). Und die Kosten von Multithreading hängen von Stufe und Daten ab und reichen von "marginal" bis Faktor 5,4 (§9).

## 1. Kernbegriffe

- **Basis** und **Ziel**: die alte Datei mit n Byte und die neue Datei mit m Byte.
- **Delta**: ein Programm, das das Ziel aus der Basis rekonstruiert. Andere Werkzeuge sagen Patch, dieser Bericht sagt Delta, außer in Formatnamen wie `--patch-from`.
- **Edit-Script**: eine Folge aus COPY(Offset, Länge) aus der Basis und ADD(Bytes). Alle vier Werkzeuge erzeugen im Kern ein solches Programm.
- **Match-Finder**: die Strategie, gleiche Bereiche in Basis und Ziel zu finden. Hier liegt der Unterschied zwischen den Werkzeugen.
- **Encoder**: die Serialisierung des Edit-Scripts plus Entropiekodierung. Zweitrangig, außer bei bsdiff.
- **Rolling Hash**: ein Hash über ein Fenster, der sich in O(1) um ein Byte verschieben lässt. Beispiele: die Adler-32-Variante von rsync, Rabin-Karp.
- **Suffix-Array**: die sortierte Liste aller Suffixe der Basis. Sie erlaubt die Suche des längsten exakten Matches per Binärsuche.
- **LZ77-Fenster** und **Präfix**: Der Kompressor darf auf vorangegangene Bytes verweisen. Steht die Basis als Präfix vor dem Ziel, wird Kompression zur Delta-Kodierung.
- **Approximatives Matching**: Bereiche mit vielen, aber nicht allen gleichen Bytes gelten als Match. Die Restdifferenz wandert in einen eigenen Strom.
- **Residuum**: der Teil des Ziels, den der Match-Finder nicht in der Basis findet. Er bestimmt die Größe des Deltas.
- **Symmetrisch** und **asymmetrisch**: ob beide Dateien beim Erzeugen des Deltas vorliegen müssen.
- **Granularität**: Block (rdiff) oder Byte (alle anderen).
- **Dictionary** (auf den Folien: Wörterbuch): bei zstd ein Datenblock, auf den der Kompressor verweisen darf, bevor die Eingabe beginnt. Ein **trainiertes Dictionary** besteht aus Header (Magic Number, Dictionary-ID, Entropietabellen) und Content (häufige Fragmente aus vielen Samples). Ein **Raw-Content-Dictionary** ist nur Bytes, ohne Header, ohne ID, ohne Tabellen. Jeder Puffer ist ein gültiges Raw-Content-Dictionary (zdict.h 1.5.7, Z. 86–97).
- **‖**: aneinanderhängen, wie `cat a b > ab`.

## 2. Taxonomie

Drei Familien von Match-Findern, dazu eine orthogonale Schicht:

| Familie                                      | Prinzip                                                           | Vertreter                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| A: Rolling Hash über feste Blöcke            | Basis in Blöcke schneiden, Ziel byteweise abrollen                | rdiff/librsync, rsync, zsync, hsynz                                |
| B: LZ77 mit externer Referenz                | hash-indizierte n-Gramme, Greedy oder Optimal Parsing             | xdelta3, zstd `--patch-from`, open-vcdiff, git-Packfiles, RFC 9842 |
| C: Suffix-Array plus approximatives Matching | exakte längste Matches, Erweiterung über Near-Matches, Diff-Strom | bsdiff, HDiffPatch, Courgette, Zucchini, deltarpm                  |
| Orthogonal: formatbewusste Vorverarbeitung   | auspacken, disassemblieren, Adressen normalisieren, dann A bis C  | Courgette, Zucchini, Puffin, archive-patcher, OSTree, debdelta     |

Verwandt, aber kein Delta: Content-Defined Chunking (casync, desync, borg, restic, zchunk, bita). Das ist Deduplikation variabler Chunks und oft die bessere Antwort auf die Frage, wie Updates verteilt werden.

## 3. Die vier Kandidaten

### 3.1 rdiff (librsync)

Stand: stabil, aktuell 2.3.4 (Februar 2023).

Verifiziert: Der rsync-Algorithmus braucht beim Erzeugen des Deltas nicht beide Dateien, sondern nur eine Signatur aus Block-Prüfsummen der Basis. Der Ablauf hat drei Schritte: `signature` über die Basis, `delta` aus Signatur und Ziel, `patch` aus Basis und Delta.

Match-Finder: rdiff zerlegt die Basis in feste Blöcke, Standard 2048 Byte. Für jeden Block speichert die Signatur einen schwachen Hash (4 Byte) und einen starken Hash. Der starke Hash ist seit librsync 1.0.0 BLAKE2, MD4 bleibt für alte Signaturen. Über das Ziel läuft ein Rolling Hash byteweise. Trifft der schwache Hash, prüft rdiff den starken. Seit librsync 2.2.0 (Oktober 2019) ist Rabin-Karp der Standard-Rolling-Hash. Laut `NEWS.md` ist er "a much better rolling hash, which reduces the risk of hash collision corruption and speeds up delta calculations".

Encoder: COPY und LITERAL, keine Kompression.

Grenzen: Jede Änderung kostet mindestens einen ganzen Block als Literal. Ein Zielblock, der aus dem Ende von Basisblock A und dem Anfang von Block B besteht, ist ein Literal. `rdiff patch` prüft nicht, ob die Basis stimmt.

Nicht benutzen, wenn beide Dateien vorliegen und die Größe des Deltas zählt.

### 3.2 xdelta3

Stand: stabil. Die Serie 3.2.x ist die gepflegte Linie (github.com/jmacd/xdelta). Version 3.2.0 vom 21. Juni 2026 bringt einen modernisierten Build, den Modus "Armor" mit BLAKE3-Prüfung der ganzen Datei, eine Obergrenze für das Source-Window und eine MkDocs-Site. Davor war 3.1.0 vom 8. Januar 2016 der Stand. Ubuntu liefert 3.0.11.

Match-Finder: Hashtabellen über gesampelte n-Gramme der Basis plus ein kleinerer Hash für Matches innerhalb des Ziels, Greedy mit Lazy Matching. Die Idee stammt aus xdelta1: eine Näherung in linearer Zeit und linearem Platz an die quadratischen Greedy-Verfahren. Die Prüfsummen eines Quellblocks trägt xdelta3 rückwärts ein, vom Blockende zum Blockanfang. Bei einer Kollision innerhalb eines Blocks gewinnt deshalb die frühere Position, spätere Blöcke überschreiben ältere Einträge (xdelta3.c, `xd3_srcwin_move_point`).

Encoder: VCDIFF (RFC 3284) mit ADD, COPY und RUN. COPY-Adressen laufen über zwei Caches. NEAR merkt sich die letzten vier Adressen und kodiert die Differenz als Varint. SAME hält 3 × 256 = 768 Adressen, indiziert über `addr mod 768`, und kodiert einen Treffer in einem Byte (RFC 3284 §5.1). Sekundärkompression: lzma (mit liblzma) sowie die eingebauten djw und fgk.

Grenzen: Das Source-Window (`-B`, Standard 64 MiB) begrenzt, wie weit zurück Matches gefunden werden. Bei großen Dateien mit umsortiertem Inhalt verpasst xdelta3 Matches, wenn `-B` nicht auf die Basisgröße steht. Ohne Armor prüft xdelta3 die Integrität nur je Window (Adler-32, abschaltbar mit `-n`). Ein Decoder mit falscher Basis dekodiert teilweise, bevor eine Window-Prüfsumme fehlschlägt.

### 3.3 bsdiff

Stand: stabil, aber eingefroren. Colin Percivals Version 4.3 stammt von 2005. Die Forks (Chromium, Android, HDiffPatch `-BSD`, deltarpm) leben.

Match-Finder: Suffix-Sortierung mit qsufsort von Larsson und Sadakane. Für jede Position im Ziel sucht bsdiff per Binärsuche im Suffix-Array den längsten exakten Match. Dann verlängert es den Match vorwärts und rückwärts, solange mehr als die Hälfte der Bytes übereinstimmt.

Encoder: drei Ströme. Ungefähr passende Byte-Differenzen landen im Diff-Block, neue Bytes im Extra-Block. Der Control-Block enthält je Eintrag Diff-Länge, Extra-Länge und Seek-Offset in der Basis. Alle drei Blöcke komprimiert bzip2.

Warum bsdiff bei Executables gewinnt: Ein COPY/ADD-Werkzeug kodiert jede verschobene Adresse als neue Daten. bsdiff kodiert sie als Strom aus fast nur Nullen mit einem wiederkehrenden Differenzmuster, und dieser Strom komprimiert auf fast nichts. Laut Percival sind die Deltas 50 bis 80 % kleiner als bei Xdelta (daemonology.net/bsdiff).

Grenzen: Speicher max(17n, 9n + m), Zeit O((n + m) log n) (ebd.). Wegen des Speichers skaliert bsdiff nicht auf große Dateien. bzip2 ist fest verdrahtet. bspatch prüft nicht, ob die richtige Basis benutzt wird. Der Vorteil verschwindet bei Text, Tarballs und komprimierten Daten.

### 3.4 zstd --patch-from

Stand: stabil seit zstd 1.4.5 (2020). Kein eigener Delta-Algorithmus, sondern ein Modus des Kompressors. Aktuell ist 1.5.7 (Februar 2025).

Verifiziert: `--patch-from` ist Dictionary-Kompression mit passender Parameterwahl. Die Basis wird als Raw-Content-Präfix geladen, und das Fenster wird größer als die Zieldatei (man page: "windowSize > srcSize"). Genau: `fileWindowLog = FIO_highbit64(maxSrcFileSize) + 1`, also die nächste Zweierpotenz über der Zielgröße (fileio.c, `FIO_adjustParamsForPatchFromMode`, in 1.5.5 und 1.5.7 gleich). So bleibt die ganze Basis bis zum letzten Byte des Ziels erreichbar (zstd.h, Z. 1135–1137: "ensure that the window size is large enough to contain the entire source"). Dafür hob 1.4.5 die Grenze für Dictionaries von 32 MB auf 2 GB (Wiki). Der Long-Distance-Matcher schaltet sich ein, sobald dieses Fenster die Reichweite der Hash-Kette der Stufe übersteigt (`fileWindowLog > ZSTD_cycleLog(chainLog, strategy)`, ebd., die man page sagt "chainLog < fileLog").

Match-Finder: Der normale Match-Finder der Stufe sucht im Fenster (Hash-Kette, Binärbaum, Optimal Parsing ab etwa Stufe 17). Der Long-Distance-Matcher findet zusätzlich weit entfernte lange Matches über gesampelte Hashes (Gear-Hash, `zstd_ldm.c`).

Encoder: ein normaler zstd-Frame. Jede libzstd ab 1.4.0 wendet ihn mit `ZSTD_DCtx_refPrefix` an (zstd.h, Z. 1182).

Benchmark laut Wiki: Ab 1.4.7 ist Stufe 19 bei der Größe des Deltas mit bsdiff vergleichbar und bei großen Deltas besser. Stufe 1 und 3 sind mehr als 200-mal beziehungsweise 100-mal schneller als bsdiff (gemessen mit 1.4.6). Gegen Xdelta: Xdelta erstellt Deltas aus Text am schnellsten, zstd Deltas aus Binärdaten. Beim Anwenden ist zstd überall am schnellsten. Xdeltas Deltas sind etwas größer.

Interpretation: Der Korpus des Wikis besteht aus Quelltext-Tarballs: zstd (31 MB), WordPress (273 MB), LLVM (1,66 GB) und Linux (1 GB). Das ist Text, also der Fall, in dem bsdiffs Diff-Strom nichts bringt. Der Vergleich beweist nicht, dass zstd bsdiff bei Executables ersetzt. Messung 1 bestätigt das.

Multithreading: Das Wiki verspricht für die Kombination mit Multithreading "a very minimal compression ratio loss". Die man page von 1.5.7 sagt, `--single-thread` verbessere die Ratio bis Stufe 15 "marginally" und verschlechtere sie darüber (Issue #4093, Doku-Änderung #4094). Gemessen ist der Verlust weder minimal noch marginal, siehe §9.

Grenzen: Basis und Ziel müssen je unter 2 GiB bleiben, sonst bricht die CLI ab ("Can't handle files larger than 2 GB", fileio.c). Für Executables fehlt der Diff-Strom: Ein exakter LZ-Match zerfällt bei verschobenen Zeigern in viele kurze Matches. Eine falsche Basis fällt erst nach dem Dekodieren an der Content-Prüfsumme auf.

### 3.5 Vergleichstabelle

|                        | rdiff                  | xdelta3                   | bsdiff          | zstd --patch-from                  |
| ---------------------- | ---------------------- | ------------------------- | --------------- | ---------------------------------- |
| Familie                | A: Block, Rolling Hash | B: LZ77 mit Referenz      | C: Suffix-Array | B: LZ77 mit Referenz               |
| Beide Dateien nötig?   | nein (Signatur reicht) | ja                        | ja              | ja                                 |
| Granularität           | Block (2 KiB)          | Byte                      | Byte            | Byte                               |
| Near-Matches           | nein                   | nein                      | ja (Diff-Strom) | nein                               |
| Format                 | eigenes                | VCDIFF, RFC 3284          | BSDIFF40        | zstd-Frame                         |
| Kompression im Delta   | keine                  | djw, fgk, lzma            | bzip2, fest     | zstd, Stufe wählbar                |
| Speicher beim Erzeugen | Signatur               | Source-Window             | rund 17n        | Basis im Fenster, je Datei ≤ 2 GiB |
| Prüfung der Basis      | keine                  | BLAKE3 (3.2, Armor)       | keine           | nur Content-Prüfsumme              |
| Stärke                 | Netzwerk-Sync, Backups | Streaming, Standardformat | Executables     | Geschwindigkeit, Text, Tarballs    |

## 4. Weitere Werkzeuge

Familie C (bsdiff-Linie):

- **HDiffPatch**: Der Modus `-BSD` erzeugt etwas kleinere Deltas als bsdiff (7,74 % gegen 8,17 % der Zielgröße) bei 5,7-mal schnellerem Diff mit einem Thread und 13,5-mal mit acht Threads. Das Diff braucht 676 MB statt 2773 MB, das Anwenden 19 MB statt 637 MB (README-Tabelle). Das native Format mit zstd liefert die kleinsten Deltas. Kompatibel mit den Formaten von bsdiff4, endsley/bsdiff, open-vcdiff und xdelta3. HPatchLite läuft mit dem Dekompressor tinyuz auf Geräten mit 1 KB RAM. hsynz ist ein zsync-Äquivalent mit zstd. Stand: stabil. Der ernsthafteste Kandidat neben den vier.
- **Courgette und Zucchini (Chromium)**: Courgette disassembliert Executables, normalisiert relative Adressen und wendet dann bsdiff an (nicht geprüft). Zucchini ist der Nachfolger für Archive mit gängigen Executable-Formaten. Es nutzt Suffix-Arrays und eine Equivalence Map. Eine Quota begrenzt die Seed-Auswahl, weil sie sonst in Sonderfällen O(n²) läuft (`components/zucchini/equivalence_map.cc`). Stand: stabil im Chromium-Updater.
- **deltarpm**: eigenes Delta über bsdiff-Code. `delta.c` ist laut Header von Michael Schroeder "rewritten from bsdiff.c" und trägt Percivals BSD-2-Klausel-Lizenz.

Familie B (LZ77 mit Referenz):

- **open-vcdiff** (Google, nach Bentley und McIlroy, aus SDCH). Stand: inaktiv (nicht geprüft).
- **git-Packfile-Deltas**: `diff-delta.c` ist laut Header "greatly inspired by parts of LibXDiff from Davide Libenzi": Rabin-Fingerprint über 16-Byte-Fenster der Basis, höchstens 64 Einträge je Hash-Bucket. Ketten mit Tiefenlimit und regelmäßigem Neupacken.
- **RFC 9842 Compression Dictionary Transport**: dieselbe Idee wie `--patch-from` über HTTP. Eine frühere Version einer Ressource dient als Dictionary für die neue. Content-Encodings `dcb` (Brotli) und `dcz` (Zstandard), Header `Use-As-Dictionary`, `Available-Dictionary` und `Dictionary-ID`. Der Client bietet je Anfrage genau ein Dictionary an, den besten Treffer. Bei mehreren Treffern gewinnt erst ein passendes `match-dest`, dann das längste `match`, dann das jüngste Dictionary. Stand: Proposed Standard seit September 2025.
- **MSDelta** (Windows Update, PA30). Closed Source, formatbewusst für Executables (nicht geprüft).

Familie A (Rolling Hash, Sync):

- **zsync und hsynz**: rsync invertiert. Die Signatur der neuen Datei liegt auf dem Server, der Client rechnet.
- **casync, desync, borg, restic, zchunk, bita**: Content-Defined Chunking, kein Delta.

Orthogonale Schicht (nicht geprüft):

- **Puffin** (Android OTA, deflate-bewusst), **archive-patcher** (Google Play, Datei für Datei innerhalb von Zips), **OSTree static deltas**, **debdelta**, **pristine-tar**. Alle vier Kandidaten versagen auf komprimierten Eingaben. Diese Werkzeuge packen vorher aus oder rekonstruieren die Kompression.

## 5. Messung 1: --patch-from gegen rdiff + zstd

### Fragestellung

Wie verhält sich `zstd --patch-from` zur Pipeline `rdiff delta` plus Nachkompression des Deltas mit `zstd -19`?

### Mechanik der beiden Pipelines

`rdiff + zstd` hat eine Informationsbarriere. Schritt 1: `rdiff signature` über die Basis. Schritt 2: `rdiff delta` mit Rolling Hash über das Ziel, Blocktreffer werden COPY, alles andere LITERAL. Schritt 3: `zstd -19` komprimiert den Delta-Strom. zstd sieht dabei nur den Delta-Strom, nie die Basis.

`zstd --patch-from` ist eine Stufe. Die Basis liegt als Präfix im Fenster. Der Match-Finder verweist byteweise auf Basis und bereits kodiertes Ziel. Literale und Sequenzen werden gemeinsam entropiekodiert.

Vier Effekte erzeugen den Unterschied:

1. **Granularität.** Ein geändertes Byte kostet bei rdiff den ganzen Block als Literal. zstd kodiert ein Literal plus zwei Matches. Die Nachkompression komprimiert den Block nur gegen sich selbst.
2. **Blockgrenzen.** Jede Einfügung oder Löschung erzeugt an ihrer Kante einen Block, der zwei Basisblöcke überlappt. Für rdiff ist das ein Literal, für zstd zwei Matches.
3. **Kein Selbstbezug.** rdiff findet keine Wiederholungen innerhalb des Ziels. Die Nachkompression holt das nur innerhalb ihres Fensters zurück.
4. **Entropiekodierung mit Kontext.** zstd kodiert Offsets und Längen als Sequenzen mit FSE. rdiffs COPY-Kommandos sind für die Nachkompression generische Bytes.

Interpretation: Die Nachkompression komprimiert die Symptome der groben Granularität, nicht deren Ursache.

### Korpora

- **text**: `requests` sdist 2.32.3 nach 2.32.4 als tar. Basis 655.360 Byte, Ziel 665.600 Byte.
- **bin**: numpy `_multiarray_umath.cpython-312-x86_64-linux-gnu.so` 2.2.5 nach 2.2.6. Beide 10.510.625 Byte, 7.291.572 Byte verschieden (69 %).
- **synth**: dieselbe .so mit 20 zufälligen Ein-Byte-Änderungen. Isoliert Effekt 1.

### Ergebnisse

Größe des Deltas in Byte. Die Signatur der Basis steht in Klammern, sie fällt nur bei rdiff an.

| Methode                                 | text             | bin                 | synth             |
| --------------------------------------- | ---------------- | ------------------- | ----------------- |
| zstd -19, kein Delta                    | 109.074          | 2.326.568           | 2.327.332         |
| zstd -3 --patch-from                    | 13.520           | 716.414             | 1.303             |
| zstd -19 --patch-from                   | **12.152**       | **228.155**         | **989**           |
| zstd --ultra -22 --long=27 --patch-from | 11.893           | 227.787             | 989               |
| rdiff -b 2048, roh                      | 264.531          | 6.218.046           | 41.901            |
| rdiff -b 2048 + zstd -19                | 32.087 (11.532)  | 1.621.265 (184.800) | 19.175 (184.800)  |
| rdiff -b 512, roh                       | 158.123          | 4.816.801           | 14.126            |
| rdiff -b 512 + zstd -19                 | 18.881 (46.092)  | 1.295.077 (739.056) | 6.944 (739.056)   |
| rdiff -b 128, roh                       | 92.919           | 3.211.450           | 23.907            |
| rdiff -b 128 + zstd -19                 | 16.035 (184.332) | 944.860 (2.956.152) | 6.985 (2.956.152) |
| xdelta3 -9 -S lzma                      | 14.124           | 339.451             | 346               |
| bsdiff                                  | 16.110           | 70.371              | 253               |

Laufzeit in Sekunden, grob:

| Methode                  | text | bin  | synth |
| ------------------------ | ---- | ---- | ----- |
| zstd -3 --patch-from     | 0,01 | 0,09 | 0,05  |
| zstd -19 --patch-from    | 0,10 | 3,4  | 2,0   |
| rdiff -b 2048 + zstd -19 | 0,05 | 2,1  | 0,06  |
| xdelta3 -9 -S lzma       | 0,30 | 0,74 | 0,17  |
| bsdiff                   | 0,17 | 3,3  | 2,7   |

### Interpretation

- Bei der Standard-Blockgröße liegt `--patch-from` vorn: Faktor 2,6 (text), 7 (bin) und 19 (synth).
- synth zeigt Effekt 1 isoliert. 20 Byte sind geändert, rdiff liefert 41.901 Byte roh: 20 mal 2048 plus Kommandos. Nach zstd bleiben 19 KB, weil Maschinencode schlecht komprimiert. zstd braucht 989 Byte.
- Kleinere Blöcke helfen wenig und kosten viel. Von 2048 auf 128 wächst die Signatur um Faktor 16 auf 28 % der Basis. Das Delta schrumpft nur um Faktor 1,7 bis 2,8.
- Nicht monoton: rdiff -b 128 roh (23.907) ist größer als -b 512 roh (14.126). Interpretation: Bei kleinen Blöcken gibt es viele identische Blöcke im Binary (Padding, Tabellen). rdiff verweist auf das erste Vorkommen. Die COPYs sind dann nicht zusammenhängend und werden nicht verschmolzen.
- zstd -3 schlägt rdiff in jeder Konfiguration, auch die beste rdiff-Variante (-b 128 + zstd -19: 944.860 Byte bei bin) mit 716.414 Byte in 0,09 s.
- bsdiff bleibt bei Executables Faktor 3 vor zstd. Bei Text liegt zstd vorn.

### Wann rdiff + zstd trotzdem richtig ist

1. Die Basis liegt nicht auf der Erzeugerseite. Das ist der Backup- und Sync-Fall (rdiff-backup, Duplicity). zstd hat hier keine Antwort.
2. Basis oder Ziel sind größer als 2 GiB. rdiff hält bei 2-KiB-Blöcken eine Signatur von rund 1,8 % der Basis im RAM, sonst nichts. Alternative: die Basis in 1-GiB-Stücke schneiden und je Stück `--patch-from`. Das kostet Matches über Stückgrenzen.
3. Beim Anwenden fehlt der RAM für die Basis. `rdiff patch` liest die Basis per Seek von der Platte. Auf kleinen Geräten ist HPatchLite die bessere Antwort.
4. Blockstrukturierte Daten. Bei Images mit 4-KiB-Seiten und Blockgröße 4096 schrumpft der Nachteil deutlich. Er verschwindet nicht, weil zstd innerhalb geänderter Seiten weiter Matches findet.

## 6. Messung 2: trainiertes Dictionary plus --patch-from

### Fragestellung

Lässt sich `--patch-from` mit einem per `zstd --train` erzeugten Dictionary kombinieren? Und lohnt es sich?

### Verifizierte Fakten

- CLI: `-D` und `--patch-from` schließen sich aus. Die man page verbietet die Kombination, und zstd 1.5.7 antwortet "can't use -D and --patch-from=# at the same time" (nachgestellt am 11.09.2026).
- API: Der Kontext verwaltet nur ein Dictionary. Ein neues Dictionary verwirft das vorherige. Jedes Setzen eines Präfixes, auch NULL, verwirft jedes vorherige Präfix oder Dictionary (zstd.h 1.5.7, Z. 1090 und 1132).
- `--patch-from` ist intern selbst nur ein Dictionary: die alte Version als Raw-Content-Präfix.
- Ein zstd-Dictionary hat zwei Teile. Der Header enthält Magic Number, Dictionary-ID und Entropietabellen. Die Tabellen sparen Header-Kosten im Frame, was bei kleinen Daten zählt. Der Content ist nur Bytes (zdict.h, Z. 86–90).
- `ZDICT_finalizeDictionary()` macht aus beliebigem Raw-Content ein zstd-Dictionary. Es braucht Samples und fügt Dictionary-ID und Entropietabellen hinzu (zdict.h, Z. 159–176).
- Ein Präfix mit vollem Dictionary-Header lässt sich nur über das experimentelle `ZSTD_CCtx_refPrefix_advanced()` referenzieren (zstd.h, Z. 1142 und 2024).
- `-D` ist in der CLI auf 32 MiB begrenzt (`DICTSIZE_MAX`, fileio.c). `--patch-from` hebt das Limit für sich auf das Speicherlimit, höchstens 2 GiB.

### Was beide Dictionaries beitragen

| Beitrag                | Trainiertes Dictionary                 | Alte Version als Präfix      |
| ---------------------- | -------------------------------------- | ---------------------------- |
| Content                | domänentypische Fragmente, rund 110 KB | exakt diese Datei, bis 2 GiB |
| Entropietabellen       | ja                                     | nein                         |
| Dictionary-ID im Frame | ja                                     | nein                         |

Interpretation: Der Content-Beitrag des trainierten Dictionaries ist nur der Teil, der typisch für die Domäne ist, aber in der alten Version fehlt. Bei Versionsfolgen ist das fast nichts, denn die alte Version ist selbst ein perfekt domänenspezifisches Sample.

### Setup

`requests` sdist 2.32.3 nach 2.32.4, 83 nicht-leere Dateien, 32 davon geändert. Jede Datei einzeln mit `zstd -19`. Das Dictionary wurde mit `--train --maxdict=65536` auf den alten Versionen trainiert. zstd warnte, dass der Korpus mit 362.973 Byte zu klein ist.

### Ergebnisse

Summe der Ausgabegrößen in Byte:

| Kontext                                     | Byte        | Delta                                          |
| ------------------------------------------- | ----------- | ---------------------------------------------- |
| kein Kontext                                | 142.267     |                                                |
| `-D trainiert` (Tabellen + Content)         | 102.404     | −28 %                                          |
| `--patch-from=trainiert` (nur Content)      | 103.061     | Tabellen sparen 657 Byte, etwa 8 Byte je Datei |
| `--patch-from=alt`                          | 19.773      | −86 %                                          |
| `--patch-from=(trainiert ‖ alt)`            | 19.665      | −0,5 % gegenüber nur alt                       |
| `--single-thread`, beide Varianten          | unverändert |                                                |
| eine unveränderte Datei, `--patch-from=alt` | 24          | Frame-Overhead                                 |

### Interpretation

- Die Entropietabellen bringen 8 Byte je Frame. Der zusätzliche Content bringt 108 Byte über 83 Dateien. Beides ist Rauschen.
- `--patch-from` über das gesamte tar lieferte 12.152 Byte (Messung 1). Das schlägt jede Variante je Datei, weil das größere Präfix alle dateiübergreifenden Inhalte enthält. Mehr Kontext gewinnt gegen ein Dictionary.
- Entscheidungsregel: Ist die alte Version auf beiden Seiten verfügbar? Ja: `--patch-from`, ein Dictionary addiert nichts Messbares. Nein: trainiertes Dictionary, hier −28 %. Teilweise (die "alte Version" ist ein verwandter Datensatz, kein Vorgänger): erst messen, wie viele der neuen Bytes im Präfix fehlen.
- Ein theoretischer Gewinn bleibt bei Millionen winziger Frames, wo 8 Byte Tabellenersparnis relativ auffallen. Obergrenze etwa 10 % bei 80-Byte-Deltas. Die Tabellen wären zudem auf ganze Datensätze trainiert, nicht auf Delta-Residuen.

### Wer es trotzdem baut

1. **Rohes Aneinanderhängen**: `cat dict old > prefix`, dann `--patch-from=prefix`. Verliert die Tabellen, behält den Content. Kostet je Frame den Tabellenaufbau über das ganze Präfix. Das Referenzieren eines Präfixes ist laut Header "a CPU consuming operation, with non-negligible impact on latency" (zstd.h, Z. 1139).
2. **Volles Dictionary bauen**: `ZDICT_finalizeDictionary` mit Content = alt ‖ trainierter Content und Samples = Ziele. Referenzieren über `ZSTD_CCtx_refPrefix_advanced`. Finalize komprimiert alle Samples gegen den Content, also je alter Version ein Trainingslauf. Einziger echter Nebeneffekt: Die Dictionary-ID im Frame-Header prüft mit 4 Byte vor dem Dekodieren, ob die Basis stimmt.

## 7. Messung 3: feste Basis, wandernde Ziele

### Fragestellung

Bringt ein Dictionary etwas, wenn viele Deltas gegen dieselbe Basis erstellt werden und die Ziele ähnlichen Inhalt teilen, zum Beispiel Header-Blöcke?

### Theorie

Feste Basis B, Ziele T1, T2, T3 und so weiter. Jedes Delta P_i kodiert alles, was T_i gegenüber B neu ist. Spätere Ziele enthalten die früheren Änderungen, also steckt in P_3 der Inhalt von P_2 noch einmal. Die Deltas wachsen monoton und wiederholen sich gegenseitig.

Ein Dictionary S kann davon nur den Teil sparen, der drei Bedingungen erfüllt: nicht in B, in vielen Zielen wiederkehrend, beim Bau von S bekannt. Der Gewinn ist die Information, die S über T_i jenseits von B trägt. Für Inhalt in B ist er null. Für Inhalt, der erst nach dem Bau des Dictionaries auftaucht, ebenfalls.

### Setup

`requests` sdist-Tars, Basis 2.31.0 (522.240 Byte), Ziele 2.32.0 (542.720), 2.32.1 (655.360), 2.32.2 (655.360), 2.32.3 (655.360) und 2.32.4 (665.600 Byte), `zstd -19`. Statisches Wissen für alle Dictionaries: nur T1 (2.32.0) und T2 (2.32.1).

Die Residuen wurden mit einem eigenen Greedy-Matcher extrahiert: 32-Byte-Fenster der Basis indiziert, Ziel abgelaufen, Matches verlängert, nicht abgedeckte Spans ab 16 Byte gesammelt. Das ist eine Näherung an zstds echten Parse. Residuen: 14.986 Byte (T1), 51.807 (T2), 53.272 (T3), 56.928 (T4), 66.290 (T5).

Varianten:

- Rohe Residuen von T1 und T2 aneinandergehängt, 66.793 Byte, an B angehängt.
- `zstd --train --maxdict=32768` auf den Residuen-Spans von T1 und T2, an B angehängt.
- `zstd --train --maxdict=32768` naiv auf 2-KB-Chunks der vollen T1 und T2, an B angehängt.
- B ‖ T1 ‖ T2 als Präfix (1.720.320 Byte, rund 1,7 MB).
- Zum Vergleich dynamisch: B ‖ vorheriges Ziel, und reine Kette (vorheriges Ziel als Basis).

### Ergebnisse

Größe des Deltas in Byte. Das Präfix steht in der Spaltenüberschrift.

| Ziel   | B      | B ‖ vorheriges T | Kette  | B ‖ Roh-Residuen T1,T2 | B ‖ trainiert aus Residuen | B ‖ trainiert naiv | B ‖ T1 ‖ T2 |
| ------ | ------ | ---------------- | ------ | ---------------------- | -------------------------- | ------------------ | ----------- |
| 2.32.0 | 5.556  | 5.638            | 5.556  | _2.565_                | _3.267_                    | _5.223_            | _83_        |
| 2.32.1 | 16.804 | 12.018           | 11.990 | _3.582_                | _6.134_                    | _15.611_           | _88_        |
| 2.32.2 | 17.259 | 1.939            | 1.914  | **4.185**              | **6.732**                  | 16.160             | 1.962       |
| 2.32.3 | 18.247 | 2.461            | 2.438  | **5.255**              | **7.760**                  | 17.145             | 3.068       |
| 2.32.4 | 20.420 | 12.280           | 12.152 | 15.397                 | 16.748                     | 19.779             | 13.987      |

Kursiv: In-Sample, das Dictionary kennt das Ziel selbst. Nur die Zeilen 2.32.2 bis 2.32.4 zählen.

### Interpretation

1. Die Hypothese stimmt. Für 2.32.2 und 2.32.3 fällt das Delta von 17 bis 18 KB auf 4 bis 5 KB, mit 67 KB statischem Residuen-Präfix.
2. Der Gewinn verfällt. 2.32.4 brachte neue Inhalte, das Dictionary hilft nur noch 25 %. Ein statisches Dictionary altert so schnell wie die feste Basis.
3. Naives Training ist wertlos: 16.160 statt 17.259. Der Trainer wählt häufige Segmente über alle Samples. Die häufigsten Segmente sind Inhalte von B, die das Präfix schon hat. Kein Werkzeug trainiert "häufig, aber nicht in B". Das muss man selbst bauen.
4. Training verliert gegen rohe Residuen: 6.732 gegen 4.185. Der Trainer ist ein Subset-Selektor unter Größenbudget. Bei 67 KB Residuen und 32 KB Budget wirft er Information weg.
5. Die alten Ziele als Präfix sind besser als jedes Dictionary: 1.962 statt 4.185, ohne Werkzeugbau. Kosten: 1,7 MB Präfix statt 590 KB, also mehr Tabellenaufbau je Frame und mehr RAM beim Client.
6. Rebase schlägt alle Varianten. Wer dem Client ein Dictionary von 67 KB schicken kann, kann ihm auch das Delta von 16,8 KB auf T2 schicken. Danach kettet er von T2: 1.914, 2.438, 12.152. Das ist kleiner als jede Dictionary-Spalte, bei einem Viertel der Einmalkosten. Ein Residuen-Dictionary ist ein Rebase ohne Positionsinformation.

### Wann es sich lohnt

Alle drei Bedingungen müssen gelten:

1. Die Basis darf sich nicht bewegen: Golden Image, ROM, signiertes Artefakt, ein geteiltes Dictionary nach RFC 9842, oder Clients, die jedes Delta unabhängig von einer beglaubigten Basis anwenden müssen.
2. Der Client kann trotzdem einmalig einen zweiten Blob erhalten. Wer einen Blob nachladen kann, kann meist auch die Basis wechseln. Dieser Widerspruch muss aufgelöst sein.
3. Der wiederkehrende Inhalt ist beim Bau des Dictionaries bekannt und bleibt über viele Ziele stabil: feste Header-Blöcke, Templates, Boilerplate.

Wenn Bedingung 1 nicht gilt, ist die Antwort Kette oder Multi-Basis, kein Dictionary.

### Wer es baut

- Sind die Header-Blöcke bekannt: kein Training. `cat B headers > prefix`. Das ist die vollständige Lösung für den Beispielfall.
- Sind sie nicht bekannt: Residuen gegen B extrahieren (Matcher wie oben oder ADD-Daten aus `xdelta3 printdelta` parsen), dann roh aneinanderhängen. Erst trainieren, wenn die Residuen das Budget deutlich übersteigen.
- Innerhalb eines Ziels wiederholte Header-Blöcke findet zstd per Selbstreferenz. Das Dictionary spart je Frame nur das erste Vorkommen. Das begrenzt den Gewinn je Delta auf einen komprimierten Block.
- Entropietabellen und Dictionary-ID nur über `ZDICT_finalizeDictionary` mit Content = B ‖ Residuen und Samples = Ziele. Gewinn etwa 8 Byte je Frame.

### Einordnung

Das Szenario ist die klassische Topologiefrage für Deltas: Stern (feste Basis, wachsende Deltas, wahlfreier Zugriff), Kette (kleine Deltas, sequenzielles Anwenden), Skip-Deltas (logarithmische Kettenlänge, RCS und SVN), Multi-Basis (Präfix aus den letzten N Versionen). Das Dictionary ist eine fünfte Option. Nur in der Nische "Basis unveränderlich, Blob nachladbar" wird sie nicht von einer anderen geschlagen.

## 8. Entscheidungsregeln

### Werkzeugwahl

| Situation                                                    | Wahl                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| Executables, Größe des Deltas zählt                          | HDiffPatch, bsdiff oder Zucchini                      |
| Text, Tarballs, Dumps, beide Dateien lokal, je Datei ≤ 2 GiB | zstd `--patch-from` (Stufe 3 für Tempo, 19 für Größe) |
| Standardformat oder Streaming nötig                          | xdelta3 3.2 mit Armor, `-B` auf Basisgröße            |
| Basis nicht auf der Erzeugerseite                            | rdiff, zsync, hsynz                                   |
| Basis über 2 GiB, kein Chunking möglich                      | rdiff mit passender Blockgröße                        |
| Anwenden auf MCU oder Mobilgerät                             | HPatchLite, HDiffPatch                                |
| Komprimierte Eingaben (gz, zip, apk, Container-Layer)        | erst auspacken, oder Puffin, archive-patcher          |
| Updates über HTTP an Browser                                 | RFC 9842 mit `dcz` oder `dcb`                         |

### Dictionary ja oder nein

| Alte Version auf beiden Seiten?           | Wahl                                               |
| ----------------------------------------- | -------------------------------------------------- |
| ja                                        | `--patch-from`, kein Dictionary                    |
| nein                                      | trainiertes Dictionary                             |
| teilweise, verwandter Datensatz           | messen, wie viele der neuen Bytes im Präfix fehlen |
| feste, unveränderliche Basis, viele Ziele | Header-Blöcke oder Residuen an die Basis hängen    |

### Topologie bei Versionsfolgen

| Bedingung                             | Wahl                                            |
| ------------------------------------- | ----------------------------------------------- |
| Basis darf wandern                    | Kette mit periodischem Rebase                   |
| Clients auf verschiedenen Ständen     | Multi-Basis: Präfix aus den letzten N Versionen |
| Wahlfreier Zugriff auf alte Stände    | Skip-Deltas                                     |
| Basis unveränderlich, Blob nachladbar | Residuen-Dictionary, periodisch erneuert        |

## 9. Operative Fallstricke

- **Fenster beim Entpacken.** Der Frame verlangt als Fenster die nächste Zweierpotenz über der Zielgröße (§3.4). Der Decoder erlaubt ohne Flag nur `max(128 MiB, Basisgröße)`, weil `zstd -d --patch-from` das Speicherlimit nur auf die Basisgröße hebt (fileio.c, `FIO_adjustMemLimitForPatchFromMode(prefs, dictSize, 0)`). Bei gleich großen Dateien über 128 MiB scheitert das Entpacken deshalb mit "Frame requires too much memory for decoding". Die Empfängerseite setzt `--memory=` oder `--long=`. Der Talk nimmt `--long=30` für ein Ziel von 1 GB.
- **Falsche Basis.** Keine der Pipelines prüft vor dem Anwenden, ob die Basis stimmt. zstd erkennt eine falsche Basis nach dem Dekodieren an der Content-Prüfsumme. Die CLI schreibt sie standardmäßig, libzstd nicht (`ZSTD_c_checksumFlag` ist aus). rdiff und bsdiff liefern stillschweigend Müll. xdelta3 3.2 mit Armor prüft per BLAKE3. Der Hash der Basis gehört deshalb in ein Manifest außerhalb des Deltas.
- **Dictionary-ID.** Bei `-D` steht die Dictionary-ID im Frame, und der Decoder weist ein falsches Dictionary zurück. Bei `--patch-from` steht dort nichts.
- **Seekbare Basis.** `rdiff patch` braucht eine seekbare Basis. Streaming gilt nur für Delta und Ausgabe.
- **Leere Zieldatei.** `FIO_adjustParamsForPatchFromMode` ruft `FIO_highbit64(maxSrcFileSize)` ohne Prüfung auf null auf, und die Funktion beginnt mit `assert(v != 0)`; das gilt in 1.5.5 wie in 1.5.7. Ob der Aufruf abbricht, entscheidet der Build: Ubuntus zstd 1.5.5 bricht mit Exit-Code 134 ab, und in Pipelines ohne `set -e` bleibt die alte Ausgabedatei stehen. Ein erster Messlauf von Messung 2 lieferte deshalb falsche Summen und wurde wiederholt. zstd 1.5.7 aus nixpkgs (macOS) liefert für dieselbe Eingabe Exit-Code 0 und einen leeren Frame von 13 Byte (nachgestellt am 11.09.2026).
- **Multithreading.** Seit 1.5.7 komprimiert die CLI standardmäßig mit bis zu vier Threads, und `-T1` ist nicht `--single-thread` (man page). Wie viel Ratio das kostet, hängt von Stufe und Daten ab, und die Quellen widersprechen sich:
  - Wiki: "a very minimal compression ratio loss".
  - man page 1.5.7: `--single-thread` bringt bis Stufe 15 "marginally" mehr. Über Stufe 15 verschlechtert es die Ratio (Issue #4093: zstd 1.5.6, `--ultra -22`, 1,09 GiB ISO, 517 MiB einthreadig gegen 280 MiB mit `-T8`, Doku-Änderung #4094).
  - Talk, Folie 8: 1 GB DuckDB-Datei, Stufe 3, zstd 1.5.7: das Delta mit Multithreading war in drei Messungen bis zu 5,4-mal so groß wie mit `--single-thread`.
  - Nachgestellt am 11.09.2026 mit zstd 1.5.7 aus nixpkgs: 256 MiB Zufallsdaten, 200 geänderte 4-KiB-Seiten, Stufe 3. `-T0` und `-T1` je 1.144.853 Byte, `--single-thread` 878.498 Byte, Faktor 1,3.
  - Messung 2 (Dateien unter 100 KB, Stufe 19): kein Unterschied. Eine so kleine Eingabe ist ein einziger Job.
  - Regel: je Stufe und Korpus messen. Bis Stufe 15 `--single-thread` setzen, darüber nicht.
- **Anbindung statt Algorithmus.** Dieselbe libzstd liefert je nach Aufrufpfad Faktor 60 Unterschied. python-zstandard lädt die Basis über `ZSTD_CCtx_loadDictionary` als CDict. zstd.h, Z. 1104: "This method does not benefit from LDM". Für die DuckDB-Datei des Talks ergab das 111 MiB statt 1,8 MiB. `compression.zstd` aus Python 3.14 (davor `backports.zstd`) übergibt `ZstdDict(basis, is_raw=True).as_prefix` über `ZSTD_CCtx_refPrefix`. zstd.h, Z. 1130: "compatible with LDM". Die Codeblöcke stehen auf der Anhangsfolie `anhang-anbindung` des Talks. Die Kommandozeile setzt Fenster und LDM bei `--patch-from` selbst, in einer Bibliothek setzt man beides von Hand.
- **Source-Window von xdelta3.** `-B` steht standardmäßig auf 64 MiB. Bei größeren Basen `-B` auf die Basisgröße setzen.

## 10. Grenzen der Messungen

- Einzelläufe in einem Container. Laufzeiten sind nicht belastbar, Größen schon. Die Messungen wurden für den Faktencheck nicht wiederholt. Geprüft wurden die Arithmetik der Interpretationen, die Tar-Größen der requests-Versionen und die zstd-Kommandos aus §11.
- Kleine Korpora: 655 KB tar, 10,5 MB .so. Das Verhalten oberhalb von 128 MiB (Fenster beim Entpacken) wurde nicht gemessen.
- Ubuntu-Pakete: xdelta3 3.0.11 statt 3.2.x, bsdiff 4.3 mit bzip2. HDiffPatch, Zucchini und xdelta3 3.2 wurden nicht selbst gemessen.
- Messung 2 und 3 nutzen einen Text-Korpus (Python-Quelltext im tar). Für Executables gelten die Dictionary-Aussagen nur qualitativ.
- Die Residuen-Extraktion in Messung 3 ist ein 32-Byte-Greedy-Matcher, kein zstd-Parse. Die echten Residuen sind kleiner.
- Der trainierte Korpus in Messung 2 war laut zstd zu klein für ein gutes Dictionary.

## 11. Reproduktion

Kernkommandos der Messungen. Die zstd-Zeilen liefen am 11.09.2026 mit zstd 1.5.7 auf kleinen Testdateien durch, Roundtrip mit `cmp` geprüft. Beim Entpacken funktionieren `--memory=2047MB` und `--long=30` gleichermaßen. rdiff, xdelta3 und bsdiff wurden nicht neu ausgeführt, nur ihre Syntax geprüft.

```bash
# Messung 1
zstd -19 --patch-from=old new -o patch.zst
zstd -d --memory=2047MB --patch-from=old patch.zst -o new
rdiff -b 2048 signature old old.sig
rdiff delta old.sig new delta && zstd -19 delta
xdelta3 -e -9 -S lzma -s old new patch.vcdiff
bsdiff old new patch.bs

# Messung 2
zstd --train --maxdict=65536 -o dict.zd old-files/*
zstd -19 -D dict.zd new            # Header + Content
zstd -19 --patch-from=dict.zd new  # nur Content
cat dict.zd old > prefix && zstd -19 --patch-from=prefix new

# Messung 3
cat base residues-t1-t2 > prefix && zstd -19 --patch-from=prefix target
cat base t1 t2 > prefix && zstd -19 --patch-from=prefix target
```

Korpora: `pip download --no-deps --no-binary :all: requests==<version>` und `pip download --no-deps --only-binary :all: --platform manylinux2014_x86_64 --python-version 3.12 numpy==<version>`.

## 12. Lesestoff

- Percival, "Naive differences of executable code" (2003): http://www.daemonology.net/bsdiff/
- Tridgell, "Efficient Algorithms for Sorting and Synchronization", Dissertation (1999): https://www.samba.org/~tridge/phd_thesis.pdf
- MacDonald, "File System Support for Delta Compression" (2000), die xdelta-Thesis
- RFC 3284 (VCDIFF): https://www.rfc-editor.org/rfc/rfc3284 und RFC 9842 (Compression Dictionary Transport): https://www.rfc-editor.org/rfc/rfc9842
- Bentley und McIlroy, "Data Compression Using Long Common Strings" (DCC 1999), Grundlage von open-vcdiff. xdelta3 und zstds Long-Distance-Matcher zitieren die Arbeit nicht.
- Hunt, Vo und Tichy, "Delta algorithms: an empirical analysis", ACM Transactions on Software Engineering and Methodology 7(2), 1998, S. 192–214: https://dl.acm.org/doi/10.1145/279310.279321
- zstd-Wiki "Zstandard as a patching engine": https://github.com/facebook/zstd/wiki/Zstandard-as-a-patching-engine
- zstd `zdict.h`, Abschnitt "What is a zstd dictionary?" und `ZDICT_finalizeDictionary`
- zstd Issue #4093 (Multithreading gegen `--single-thread`): https://github.com/facebook/zstd/issues/4093
- xdelta3-Dokumentation 3.2.x: https://jmacd.github.io/xdelta/
- Geldreich, "More on bsdiff and delta compression" (2015): https://richg42.blogspot.com/2015/11/more-on-bsdiff.html
- Ready, "Visualizing bsdiff" mit interaktiver Demo: https://jonready.com/blog/posts/visualizing-bsdiff.html
- HDiffPatch-README mit Benchmark-Tabellen: https://github.com/sisong/HDiffPatch
- Zucchini-README in Chromium: https://chromium.googlesource.com/chromium/src/+/main/components/zucchini/README.md
- librsync-Dokumentation: https://librsync.github.io/

## 13. Faktencheck vom 11.09.2026

Geändert gegenüber der Fassung vom selben Tag:

| Nr. | Aussage vorher                                                                                                | Befund                                                                                                                                               | Quelle                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | LDM aktiviert, wenn chainLog kleiner als der windowLog, "der die Basis abdeckt"                               | Das Fenster deckt die Zieldatei ab: `fileWindowLog = FIO_highbit64(maxSrcFileSize) + 1`; LDM ab `fileWindowLog > ZSTD_cycleLog(chainLog, strategy)`. | fileio.c 1.5.5 und 1.5.7, `FIO_adjustParamsForPatchFromMode`              |
| 2   | "Multi-Threading kostet nur minimal Ratio"; `--single-thread` verbessere laut man page die Ratio auf Stufe 19 | man page 1.5.7: bis Stufe 15 "marginally" besser, darüber schlechter. Gemessen: Faktor 5,4 (Talk, Stufe 3) und 1,3 (Zufallsdaten, Stufe 3).          | zstd.1.md 1.5.7, Issue #4093, PR #4094, Folie 8, eigene Messung §9        |
| 3   | "Die Basis muss ... maximal 2 GiB"                                                                            | Basis und Ziel je höchstens 2 GiB: `MAX(dictSize, maxSrcFileSize)` über `1 << ZSTD_WINDOWLOG_MAX` bricht ab.                                         | fileio.c, `FIO_adjustMemLimitForPatchFromMode`                            |
| 4   | "Bei Basis über 128 MiB muss die Empfängerseite das setzen"                                                   | Regel: Frame-Fenster = nächste Zweierpotenz über der Zielgröße, Decoder erlaubt `max(128 MiB, Basisgröße)`.                                          | fileio.c, Aufruf `FIO_adjustMemLimitForPatchFromMode(prefs, dictSize, 0)` |
| 5   | "bricht bei leerer Eingabe per Assertion ab"                                                                  | Leere Zieldatei; ob die Assertion greift, hängt vom Build ab (Ubuntu 1.5.5: Exit 134, nixpkgs 1.5.7: Exit 0).                                        | fileio.c `FIO_highbit64`, eigene Messung                                  |
| 6   | xdelta3: "bei Kollision bleibt der ältere Eintrag"                                                            | Innerhalb eines Quellblocks ja, weil die Prüfsummen rückwärts eingetragen werden; spätere Blöcke überschreiben.                                      | xdelta3.c, `xd3_srcwin_move_point`, Kommentar "in reverse"                |
| 7   | "SAME ist ein 3-fach assoziativer Cache mit 256 Einträgen. Ein Treffer kostet null oder ein Adressbyte"       | SAME hat 768 Plätze, Index `addr mod 768`, ein Byte je Treffer; NEAR kodiert ein Varint.                                                             | RFC 3284 §5.1                                                             |
| 8   | HDiffPatch `-BSD` "12x schnellerem Diff"                                                                      | 5,7-mal mit einem Thread, 13,5-mal mit acht; 7,74 % gegen 8,17 %; 676 MB gegen 2773 MB beim Diff.                                                    | HDiffPatch-README, Benchmark-Tabelle                                      |
| 9   | git-Deltas "xdelta1-artig"                                                                                    | Nach LibXDiff (Libenzi), Rabin-Fenster 16 Byte, `HASH_LIMIT 64`.                                                                                     | git `diff-delta.c`                                                        |
| 10  | deltarpm: "die Option `BSDIFF_SIZET`"                                                                         | Nicht auffindbar, gestrichen. Belegt: "rewritten from bsdiff.c", BSD-2-Klausel.                                                                      | deltarpm `delta.c`, Header                                                |
| 11  | "B ‖ T1 ‖ T2 als Prefix (1,2 MB)"                                                                             | 522.240 + 542.720 + 655.360 = 1.720.320 Byte, rund 1,7 MB.                                                                                           | Tar-Größen der sdists, nachgemessen                                       |
| 12  | "kettet er von T2: 1.939, 2.461, 12.280"                                                                      | Das sind die Werte der Spalte "B ‖ vorheriges T"; die Kette steht bei 1.914, 2.438, 12.152.                                                          | Tabelle in §7                                                             |
| 13  | "1,1 s ... bei rdiff -b 128 + zstd -19"                                                                       | Laufzeit in keiner Tabelle belegt, gestrichen.                                                                                                       | Tabellen in §5                                                            |
| 14  | Rabin-Karp-Grund: "starkes Clustering und Kollisionen bei kleinen ASCII-Blöcken"                              | So nicht belegt; NEWS 2.2.0 nennt bessere Kollisionsfestigkeit und Tempo.                                                                            | librsync `NEWS.md`, 2.2.0                                                 |
| 15  | Hunt, Vo, Tichy "ACM TOIS 1998"                                                                               | ACM TOSEM 7(2), 1998.                                                                                                                                | dl.acm.org/doi/10.1145/279310.279321                                      |
| 16  | Bentley-McIlroy "Basis für xdelta, open-vcdiff und zstds LDM"                                                 | Nur open-vcdiff; xdelta3.c nennt sie nicht, zstds LDM nutzt einen Gear-Hash.                                                                         | xdelta3.c, `zstd_ldm.c`                                                   |
| 17  | RFC 9842: "Genau eine Dictionary-Quelle pro Response"                                                         | Je Anfrage ein Dictionary: "The client MUST only send a single 'Available-Dictionary' request header with a single hash value".                      | RFC 9842                                                                  |
| 18  | "(URL nicht verifiziert)" bei Tridgell und Zucchini                                                           | Beide erreichbar, Vermerke entfernt.                                                                                                                 | HTTP 200 am 11.09.2026                                                    |

Bestätigt ohne Änderung:

- `--patch-from` seit 1.4.5 und die Anhebung von 32 MB auf 2 GB (Wiki), die Wiki-Benchmarks samt Korpus
- `DICTSIZE_MAX` 32 MiB, die zitierten Zeilen aus zstd.h und zdict.h, die Verbote und Defaults der man page
- 1.5.7 als aktuelle Version, Multithreading als Default
- xdelta 3.2.0 vom 21.06.2026 samt Armor, Clamping und MkDocs
- librsync 2.2.0 und 2.3.4, BLAKE2 seit 1.0.0, Blocklänge 2048
- bsdiffs Speicher- und Zeitformeln und "50-80 %"
- RFC 9842 als Proposed Standard vom September 2025 mit `dcb`, `dcz` und den drei Headern
- Zucchinis Suffix-Array und Quota, HPatchLite mit 1 KB RAM
- alle URLs in §12

Die Arithmetik der Interpretationen in §5 bis §7 stimmt (Faktoren 2,6/7/19, Signatur 1,8 %, −28 %, −86 %, −0,5 %, 657 Byte, 66.793 Byte, 590 KB).
