# Wöchentlicher AA-Snapshot für „Welches Modell wofür?“

Ablauf für die Cloud-Routine (und für jeden, der es von Hand macht). Ziel:
Die Folie `pareto-heute` steht auf dem neuesten Snapshot von
<https://artificialanalysis.ai/leaderboards/models>, und alles, was dort an
Zahlen und Texten hängt, stimmt dazu. Ergebnis ist **ein PR**, nie ein Push
auf `main` — gemergt wird von Hand, das Deployment folgt dann von selbst.

Arbeitsverzeichnis ist die Repo-Wurzel. Alle Pfade unten sind relativ zu ihr.

## 0. Werkzeuge

```sh
bun install --frozen-lockfile
```

In der Cloud gibt es kein devenv und damit **keine Git-Hooks**. Was die Hooks
lokal erzwingen (eslint, prettier, typecheck), läuft deshalb in Schritt 5 von
Hand. `bunfig.toml` nicht anfassen, keine Lifecycle-Scripts einschalten.

## 1. Abrufen

```sh
bun run 20260408-agents-details/data/artificialanalysis/fetch.ts
```

- `unverändert: …` — AA hat seit dem letzten Snapshot nichts geändert. Den
  Lauf **ohne Commit und ohne PR** beenden (`git checkout -- .`; das
  `seen`-Feld im Index ist kein Grund für einen PR).
- `neu: board-JJJJMMTT-xxxxxxxx.json — N Modelle, M mit Kosten` — weiter.
- Fehler (Seite nicht erreichbar, weniger als 200 Modelle, Format geändert):
  **keine** halben Daten committen. Ein GitHub-Issue mit Titel
  `AA-Snapshot: Abruf fehlgeschlagen (TT.MM.JJJJ)` und der Fehlermeldung
  öffnen (`gh issue create`), dann aufhören. Nicht versuchen, den Parser
  umzubauen.

## 2. Umstellen — eine Stelle

In `20260408-agents-details/components/aaData.ts` direkt unter dem Kopf:

- den Import `../data/artificialanalysis/board-….json` auf die neue Datei,
- `AA_BOARD` auf denselben Dateinamen,
- `AA_STAND` auf das Datum von `fetched_at` des neuen Index-Eintrags
  (`TT.MM.JJJJ`).

Sonst nichts an den Daten. `lib/codexEffortMath.ts` bleibt **absichtlich** auf
`board-20261001-ae520e03.json`, ältere Board-Dateien bleiben liegen (Archiv).

## 3. Testen und verstehen

```sh
bun run test
```

Die Tests rechnen Folie, Notizen und ⓘ-Dialog gegen die Daten nach. Was
rot wird, sagt, welcher Text nachgezogen werden muss. Vor jeder Änderung an
einem Test oder Text erst klären, **warum** er sich bewegt hat: neues Modell,
abgekündigtes Modell, korrigierter Index, geänderter Preis. Das gehört später
in die PR-Beschreibung.

Typische Fälle:

| Rot                                                                                 | Was tun                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paretoVariants.test.ts` „legt jeden Punkt … in den Plot“                           | Ein Punkt liegt außerhalb der Skala (`AA_COST_SCALE`/`AA_SPEED_SCALE` in `paretoVariants.ts`: 0,04–10 €, Index 28–62, 3–30 s je 1 000 Tokens). Grenze anpassen und Ticks prüfen.                                                                                                                                    |
| „beschriftet die Front und überschneidet nichts“                                    | Label-Kollision oder Pfeilcluster über einem Punkt. Pfeilziele (`arrows.target`/`hubY`, Kommentar nennt die Lücke, auf die sie zielen) so verschieben, dass sie wieder in einer Lücke liegen.                                                                                                                       |
| `AA_COST.length` / „N Modelle mit Index“ / „Einträge, aktive mit Kosten“            | Zahl in `components/ModelRoutingSources.vue` und im Test auf den neuen Wert setzen.                                                                                                                                                                                                                                 |
| `productCoverage.test.ts` „die Leiter in den Notizen ist die berechnete“, „N von M“ | Produktleitern in den Sprechernotizen von `pareto-heute` (`slides.md`, Absätze „Kostenansicht, die vier Produkte“ und „Tempoansicht“) und die erwarteten Zahlen im Test nachziehen. Die richtige Leiter steht in der Fehlermeldung.                                                                                 |
| `markerDodge.test.ts` „bewegt je Zustand genau diese Marker“                        | `bunx vitest run 20260408-agents-details/components/lib/__tests__/markerDodge.test.ts -u` aktualisiert den Inline-Snapshot; danach den Satz „Entzerrte Marker: …“ in den Notizen von `pareto-heute` an die Fehlermeldung von „Hauptfolie: nennt das gemessene Maximum“ anpassen und die betroffenen Modelle nennen. |
| „markiert als eingeschränkt verfügbar nur Modelle des Charts“                       | `NUR_EINGESCHRAENKT` in `paretoVariants.ts`: Modell entfernen, das nicht mehr im Chart steht.                                                                                                                                                                                                                       |
| Presets/Kataloge (`presetModels(…)` erwartet …)                                     | Ein neues Modell gehört zu einem Produkt-Katalog — Test an den neuen Snapshot anpassen. Die Kataloge selbst (`data/toolcatalogs/`) **nicht** neu abrufen; das ist ein eigener Lauf.                                                                                                                                 |

**Niemals** einen Wächter löschen, lockern oder `skip`pen, um grün zu
werden. Geht es ohne das nicht, PR trotzdem öffnen, den Test rot lassen und
in der Beschreibung erklären.

## 4. Texte nachziehen

In `20260408-agents-details/slides.md`, Folie mit `routeAlias: pareto-heute`,
Sprechernotizen (der Absatz unter dem Chart und die Fußzeile rechnen sich
selbst):

- „Beim Öffnen steht … (Artificial Analysis, Stand TT.MM.JJJJ)“.
- „Die AA-Kostenleiter hat N Sprossen: …“ — die Front von `aa-cost` mit
  € und Index, wie bisher formatiert (Komma, eine Nachkommastelle).
- Den Absatz „NEU AM TT.MM.JJJJ — …“ **ersetzen** durch das, was sich
  gegenüber dem Vorgänger-Snapshot an der Front geändert hat: neue Sprossen,
  weggefallene Sprossen, warum (neues Modell oder neue Messung). Ältere
  „NEU AM“-Absätze nicht stapeln — die Notiz beschreibt den aktuellen Stand.
  Vorbehalte daraus, die weiter gelten (etwa ein Einführungspreis oder
  eingeschränkte Verfügbarkeit eines Front-Modells), übernehmen.
- „Ansicht ‚Tempo‘: Front nach Output-Tokens/s — …“.
- Modelle ohne Tempo-Wert (`AA_NO_TPS`) und eingeschränkt verfügbare Modelle
  (`NUR_EINGESCHRAENKT`): Ist ein neues Front-Modell nicht allgemein
  verfügbar (Preview, Programm auf Einladung), es in `NUR_EINGESCHRAENKT`
  aufnehmen und die Quelle im Kommentar darüber nennen; ist eines dort
  inzwischen allgemein verfügbar, es entfernen. Nur mit Beleg (Herstellerseite,
  datiert), sonst unverändert lassen und im PR als offene Frage nennen.

Stil wie die bestehenden Notizen: Deutsch, Dezimalkomma, Datum TT.MM.JJJJ,
Modelle in Schreibweise der Labels (`gpt-6.1-sol`). Keine personenbezogenen
Daten, keine internen Namen.

## 5. Prüfen wie die Hooks

```sh
git status --porcelain | perl -lane 'print $F[-1] unless $F[0] eq "D"' > /tmp/changed.txt
grep '\.vue$' /tmp/changed.txt | xargs -r bun run eslint --fix
xargs bun run prettier --write < /tmp/changed.txt
bun run typecheck
bun run test
```

Alles muss grün sein (Ausnahme siehe Ende von Schritt 3).

## 6. Commit und PR

```sh
git switch -c claude/aa-snapshot-JJJJMMTT
git add -A
git commit
gh pr create --base main --fill-first
```

Commit-Nachricht nach `AGENTS.md`:

```text
feat(agents-details): update AA snapshot to TT.MM.JJJJ

<deutscher Body, ≤ 72 Zeichen je Zeile: was sich an Front und Leitern
geändert hat, und warum>

🤖 edited with the help of an LLM agent
```

PR-Beschreibung, mit TL;DR oben:

- **TL;DR**: eine Zeile, was sich an der Front geändert hat (oder „nur Zahlen
  bewegt, Front unverändert“).
- Front vorher → nachher, Kosten- und Tempoansicht.
- Neue, abgekündigte und korrigierte Modelle.
- Offene Fragen (Verfügbarkeit, rote Tests).
- **Vor dem Merge lokal prüfen**: Overflow-Check der Folie in drei Engines
  (`check-slide-overflow.sh <nr> <port>`, siehe `AGENTS.md`) und ein Blick
  auf Label-Überlappungen in beiden Ansichten — die Cloud hat dafür keinen
  Browser.

Nicht mergen, nicht auf `main` pushen. Ist `gh` nicht angemeldet, den Branch
pushen und im Abschlussbericht sagen, dass der PR von Hand angelegt werden
muss.
