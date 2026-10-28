# Wöchentlicher Lauf für „Welches Modell wofür?“

Ablauf für die Cloud-Routine (und für jeden, der es von Hand macht). Ziel:
Die Folie `pareto-heute` steht auf dem neuesten Snapshot von
<https://artificialanalysis.ai/leaderboards/models> und auf den neuesten
Modellkatalogen der Produkte (Cursor, Windsurf, JetBrains AI, Junie), und alles,
was dort an Zahlen und Texten hängt, stimmt dazu. Ergebnis ist **ein PR**, nie
ein Push auf `main` — gemergt wird von Hand, das Deployment folgt dann von
selbst.

Arbeitsverzeichnis ist die Repo-Wurzel. Alle Pfade unten sind relativ zu ihr.

## Hintergrund in drei Sätzen

AA rechnet seit Ende Oktober 2026 mit **Intelligence Index v5** und misst nur
einen Teil der Modelle neu. Was in v5 fehlt, rechnet `components/aaData.ts`
(`migrateV4`) aus dem letzten v4-Stand vom 01.10.2026 um — automatisch, der Fit
wird bei jedem Lauf neu bestimmt; diese Punkte stehen hohl mit „≈“. Je mehr AA
neu misst, desto weniger umgerechnete Punkte gibt es; daran ist nichts von Hand
zu tun.

## 0. Werkzeuge

```sh
bun install --frozen-lockfile
```

In der Cloud gibt es kein devenv und damit **keine Git-Hooks**. Was die Hooks
lokal erzwingen (eslint, prettier, typecheck), läuft deshalb in Schritt 6 von
Hand. `bunfig.toml` nicht anfassen, keine Lifecycle-Scripts einschalten.

## 1. AA abrufen

```sh
bun run 20260408-agents-details/data/artificialanalysis/fetch.ts
```

- `unverändert: …` — AA hat nichts geändert. Weiter mit Schritt 2 (Kataloge).
- `neu: board-JJJJMMTT-xxxxxxxx.json — N Modelle, M mit Kosten` — weiter.
- Fehler (Seite nicht erreichbar, zu wenige Modelle, Format geändert):
  **keine** halben AA-Daten committen, die AA-Schritte überspringen und den
  Fehler im PR bzw. Abschlussbericht nennen. Endet der ganze Lauf ohne
  Änderung, ein GitHub-Issue `Wochenlauf pareto-heute: Abruf fehlgeschlagen
(TT.MM.JJJJ)` mit der Fehlermeldung öffnen (`gh issue create` oder das
  GitHub-Werkzeug der Session) — vorher prüfen, ob schon eines offen ist, und
  dann dort kommentieren statt ein neues anzulegen. Den Parser nicht umbauen,
  und die verschlüsselte Datendatei der Seite (`/data/<hash>.txt`) **nie**
  lesen oder entschlüsseln.

## 2. Produktkataloge abrufen

```sh
bun run 20260408-agents-details/data/toolcatalogs/fetch.ts
```

Cursor, Windsurf und JetBrains AI kommen aus maschinenlesbaren Doku-Seiten.
Je Quelle steht `unverändert`, `neu …` oder `FEHLER`; eine gescheiterte Quelle
hält die anderen nicht auf, das Skript endet dann mit Exit 1.

**Gescheiterte Quelle** (seit 28.10.2026 regelmäßig Windsurf, das jetzt
„Devin Desktop“ heißt und seine Tabelle erst im Browser füllt): kurz von Hand
recherchieren — Herstellerseite, Changelog, Release-Notes, Blog, jeweils
datiert. Ausgangspunkt ist der **bisherige** Katalog (`components/toolCatalogs.ts`
nennt die Datei): Modelle bleiben, solange nichts ihre Entfernung belegt; neue
kommen nur mit Beleg dazu.

**Findet die Recherche nichts Neues, nichts archivieren** — der Katalog gilt
dann als unverändert. Sonst entstünde jede Woche ein neuer Katalog und damit
ein PR, nur weil die Quelle weiter scheitert. Nur bei einer echten Änderung die
Liste **außerhalb des Repos** schreiben und archivieren:

```sh
# /tmp/liste.json: {"source": "<URL(s)>", "models": [{"name": "GPT-6 Astra",
#   "evidence": ["<URL>: <wörtliches Zitat>"]}, …]}
# Übernommene Einträge: Belege wörtlich aus dem bisherigen Katalog übernehmen,
#   sonst "evidence": ["übernommen aus windsurf-…json"]
bun run 20260408-agents-details/data/toolcatalogs/fetch.ts --manual windsurf /tmp/liste.json
```

Die archivierten Dateien (`*-JJJJMMTT-<hash>.json`) stehen in
`.prettierignore`: ihr Inhalt ist per sha256 im Index festgehalten, eine
Umformatierung bräche den Hash.

Namen so schreiben, wie das Produkt sie zeigt — der Abgleich mit den AA-Labels
(`catalogMatch.ts`) normalisiert selbst.

**Junie** hat keine Quelle für das Skript und steht von Hand in
`data/toolcatalogs/junie.json`, mit Beleg je Eintrag. Kurz prüfen: Landingpage
<https://junie.jetbrains.com/> und <https://junie.jetbrains.com/whats-new>.
Nur wenn ein neues Modell belegt ist: es mit Beleg ergänzen und `retrieved` auf
das heutige Datum setzen. Ohne Neuzugang die Datei nicht anfassen (sonst
entsteht jede Woche ein PR nur wegen des Datums).

**Umstellen**, wenn ein Katalog neu ist: in
`20260408-agents-details/components/toolCatalogs.ts` den Import auf die neue
Datei und `retrieved` auf das Abrufdatum (`JJJJ-MM-TT`). Dann das Golden-File
der Katalogschlüssel neu erzeugen und den Unterschied lesen — jede Zeile, die
sich ändert, ist ein Name, der jetzt woanders landet:

```sh
bun -e '
import { CATALOGS } from "./20260408-agents-details/components/toolCatalogs.ts";
import { familyKey } from "./20260408-agents-details/components/catalogMatch.ts";
const out = {};
for (const [id, c] of Object.entries(CATALOGS))
  out[id] = Object.fromEntries(c.models.map((m) => [m.name, familyKey(m.name)]));
await Bun.write("20260408-agents-details/components/lib/__tests__/__fixtures__/catalog-keys.json", JSON.stringify(out, null, 2) + "\n");
'
git diff --no-ext-diff --no-color -- '*catalog-keys.json'
```

## 3. AA umstellen — eine Stelle

Nur wenn Schritt 1 `neu` meldete. In `20260408-agents-details/components/aaData.ts`
direkt unter dem Kopf:

- den Import `../data/artificialanalysis/board-….json` auf die neue Datei,
- `AA_BOARD` auf denselben Dateinamen,
- `AA_STAND` auf das Datum von `fetched_at` des neuen Index-Eintrags
  (`TT.MM.JJJJ`).

Sonst nichts an den Daten. `AA_V4_BOARD` (Quelle der Umrechnung) und
`lib/codexEffortMath.ts` bleiben **absichtlich** auf
`board-20261001-ae520e03.json`; ältere Board-Dateien bleiben liegen (Archiv).

Ist weder AA noch ein Katalog neu: den Lauf **ohne Commit und ohne PR**
beenden. Das geänderte `seen`-Feld der Indizes ist kein Grund für einen PR.
Den Arbeitsbaum dafür **nicht** zurücksetzen (`git checkout`/`git restore`
lehnt die Cloud-Session als Löschung ab) — der Container wird nach dem Lauf
verworfen, `main` bleibt unberührt. Meldet ein Stop-Hook „uncommitted
changes“, ist das in diesem Fall kein Auftrag zum Committen.

Scheitert eine Quelle mit `ERR_PROXY_TUNNEL`/`403` oder `ENOTFOUND`, fehlt
ihre Domain in den Netzwerkeinstellungen der Cloud-Umgebung — das im
Abschlussbericht nennen, nicht umgehen.

## 4. Testen und verstehen

```sh
bun run test
```

Die Tests rechnen Folie, Notizen und ⓘ-Dialog gegen die Daten nach. Was
rot wird, sagt, welcher Text nachgezogen werden muss. Vor jeder Änderung an
einem Test oder Text erst klären, **warum** er sich bewegt hat: neues Modell,
neu in v5 gemessen, abgekündigt, Katalog geändert, korrigierter Index,
geänderter Preis. Das gehört später in die PR-Beschreibung.

Typische Fälle:

| Rot                                                                                                 | Was tun                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paretoVariants.test.ts` „legt jeden Punkt … in den Plot“                                           | Ein Punkt liegt außerhalb der Skala (`AA_COST_SCALE`/`AA_SPEED_SCALE` in `paretoVariants.ts`: 0,04–10 €, Index 22–62, 3–30 s je 1 000 Tokens). Grenze anpassen und Ticks prüfen.                                                                                                                                    |
| „beschriftet die Front und überschneidet nichts“                                                    | Label-Kollision oder Pfeilcluster über einem Punkt. Pfeilziel und Knotenhöhe (`arrows.target`/`hubY`) verschieben, bis jedes Label Platz hat; am 28.10. wurde dafür ein kleines Gitter aus Knotenhöhe × Ziel durchprobiert (Kommentar dort).                                                                        |
| `AA_COST.length` / „N Modelle mit Index ≥ 25“ / „Einträge, aktive mit Kosten; … aus v4 umgerechnet“ | Zahlen in `components/ModelRoutingSources.vue` und im Test auf die neuen Werte setzen (die Fehlermeldung nennt sie).                                                                                                                                                                                                |
| „hat die Fronten, die die Speaker Notes nennen“                                                     | Erwartete Fronten im Test und die Leitern in den Notizen nachziehen (Schritt 5). Steht ein umgerechneter Punkt (≈) auf einer Front, schlägt der Test absichtlich fehl: das im PR nennen — eine Front aus Näherungen ist eine Aussage, die jemand ansehen muss.                                                      |
| `productCoverage.test.ts` „die Leiter in den Notizen ist die berechnete“, „N von M“                 | Produktleitern in den Sprechernotizen (Absätze „Kostenansicht, die vier Produkte“ und „Tempoansicht“) und die erwarteten Zahlen im Test nachziehen. Die richtige Leiter steht in der Fehlermeldung.                                                                                                                 |
| `aaExtras.test.ts`, `catalogMatch.test.ts` (Fronten je Produkt, Chart-Labels je Katalog)            | Erwartungen an den neuen Stand anpassen; bei Katalogänderungen die von Hand geprüften Listen in `catalogMatch.test.ts` mit dem neuen Katalog abgleichen.                                                                                                                                                            |
| `markerDodge.test.ts` „bewegt je Zustand genau diese Marker“                                        | `bunx vitest run 20260408-agents-details/components/lib/__tests__/markerDodge.test.ts -u` aktualisiert den Inline-Snapshot; danach den Satz „Entzerrte Marker: …“ in den Notizen von `pareto-heute` an die Fehlermeldung von „Hauptfolie: nennt das gemessene Maximum“ anpassen und die betroffenen Modelle nennen. |
| „markiert als eingeschränkt verfügbar nur Modelle des Charts“                                       | `NUR_EINGESCHRAENKT` in `paretoVariants.ts`: Modell entfernen, das nicht mehr im Chart steht.                                                                                                                                                                                                                       |
| „hat eindeutige Labels und für jedes ein bekanntes Lab“                                             | Neues Lab: in `paretoData.ts` den Typ `Lab` und `LAB_PREFIXES` ergänzen (Präfix des Labels → Lab).                                                                                                                                                                                                                  |

**Niemals** einen Wächter löschen, lockern oder `skip`pen, um grün zu
werden. Geht es ohne das nicht, PR trotzdem öffnen, den Test rot lassen und
in der Beschreibung erklären.

## 5. Texte nachziehen

In `20260408-agents-details/slides.md`, Folie mit `routeAlias: pareto-heute`,
Sprechernotizen (der Absatz unter dem Chart und die Fußzeile rechnen sich
selbst):

- „Beim Öffnen steht … (Artificial Analysis, Intelligence Index v5, Stand
  TT.MM.JJJJ)“.
- Absatz „INDEX v5“: wie viele Modelle AA in v5 mit Index und Kosten führt.
- Absatz zur Umrechnung: Zahl der Konfigurationen, R² und typische Abweichung
  aus `V4_MIGRATION` (`bun -e 'import {V4_MIGRATION} from
"./20260408-agents-details/components/aaData.ts"; console.log(V4_MIGRATION)'`),
  und welche Punkte im Kostenchart umgerechnet sind (`AA_COST` mit `mig`).
- „Die AA-Kostenleiter hat N Sprossen: …“ — die Front von `aa-cost` mit
  € und Index, wie bisher formatiert (Komma, eine Nachkommastelle), und was
  sich gegenüber dem Vorgänger-Stand an der Front geändert hat und warum.
- „Ansicht ‚Tempo‘: Front nach Output-Tokens/s — …“ und welche Modelle ohne
  Tempo-Wert fehlen (`AA_NO_TPS`).
- `PRODUKT-AUSWAHL`: Katalog- und AA-Datum.
- Eingeschränkt verfügbare Modelle (`NUR_EINGESCHRAENKT`): Ist ein neues
  Front-Modell nicht allgemein verfügbar (Preview, Programm auf Einladung), es
  aufnehmen und die Quelle im Kommentar darüber nennen; ist eines dort
  inzwischen allgemein verfügbar, es entfernen. Nur mit Beleg (Herstellerseite,
  datiert), sonst unverändert lassen und im PR als offene Frage nennen.

Stil wie die bestehenden Notizen: Deutsch, Dezimalkomma, Datum TT.MM.JJJJ,
Modelle in Schreibweise der Labels (`gpt-6.1-sol`). Keine personenbezogenen
Daten, keine internen Namen.

## 6. Prüfen wie die Hooks

```sh
git status --porcelain | perl -lane 'print $F[-1] unless $F[0] eq "D"' > /tmp/changed.txt
grep '\.vue$' /tmp/changed.txt | xargs -r bun run eslint --fix
xargs bun run prettier --ignore-unknown --write < /tmp/changed.txt
bun run typecheck
bun run test
```

Alles muss grün sein (Ausnahme siehe Ende von Schritt 4).

## 7. Commit und PR

```sh
git switch -c claude/pareto-weekly-JJJJMMTT
git add -A
git commit -F /tmp/commit-msg.txt     # Nachricht vorher nach der Vorlage unten schreiben
git push -u origin claude/pareto-weekly-JJJJMMTT
gh pr create --base main --head claude/pareto-weekly-JJJJMMTT --fill-first
# oder statt gh das GitHub-Werkzeug der Session (PR von diesem Branch gegen main)
```

Commit-Nachricht nach `AGENTS.md`:

```text
feat(agents-details): update AA snapshot and catalogs to TT.MM.JJJJ

<deutscher Body, ≤ 72 Zeichen je Zeile: was sich an Front, Leitern und
Katalogen geändert hat, und warum>

🤖 edited with the help of an LLM agent
```

PR-Beschreibung, mit TL;DR oben:

- **TL;DR**: eine Zeile, was sich an der Front geändert hat (oder „nur Zahlen
  bewegt, Front unverändert“).
- Front vorher → nachher, Kosten- und Tempoansicht.
- Neu in v5 gemessen, neue, abgekündigte und korrigierte Modelle.
- Katalogänderungen je Produkt; bei `--manual` die Belege.
- Offene Fragen (Verfügbarkeit, rote Tests, gescheiterte Quellen).
- **Vor dem Merge lokal prüfen**: Overflow-Check der Folie in drei Engines
  (`check-slide-overflow.sh <nr> <port>`, siehe `AGENTS.md`) und ein Blick
  auf Label-Überlappungen in beiden Ansichten und in den vier Presets — die
  Cloud hat dafür keinen Browser.

Nicht mergen, nicht auf `main` pushen. Lässt sich kein PR anlegen, den Branch
pushen und im Abschlussbericht sagen, dass der PR von Hand angelegt werden
muss.
