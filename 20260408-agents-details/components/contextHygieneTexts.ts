export const TEXTS = {
  /** eine Zeile unter dem Editor, max. 140 Zeichen */
  takeaway:
    "Klare Namen und Typen sind Signal: Das Modell wählt das nächste Token sicherer. Schlechter Code ist Rauschen.",
  /** Tooltip/aria-label am 🚫🤖 der Kommentar-Zone, max. 40 Zeichen */
  commentEmojiLabel: "Das Modell sieht diesen Kommentar nicht",
  /** Beschriftung des Schalters */
  commentsToggle: "Kommentare zeigen",
  /** Tooltip, wenn der Schalter auf S1–S6 gesperrt ist */
  commentsDisabled: "Kommentare gibt es nur auf der Ausgangsstufe S0/D0.",
  /** Warnbox bei Entwicklungsgebiet: Titel (max. 30 Zeichen) und Text (max. 150 Zeichen) */
  devWarningTitle: "Entwicklungsgebiet",
  devWarningBody:
    "An diesem Gebiet entstanden die Hypothesen mit Luna. Luna-Werte zählen hier nicht als Beleg, Terra und Sol schon.",
  /** Tooltip am ⚠ in der Gebietsliste, max. 80 Zeichen */
  devMarkTitle: "Entwicklungsgebiet: Luna-Werte sind hier kein Beleg",
  /** Hinweis, wenn Stufe S1–S6 oder D1–D4 gewählt ist: absichtlich verschlechterter Code, kein Vorbild; max. 100 Zeichen */
  degradedNote:
    "Absichtlich verschlechterter Code für die Messung. Kein Vorbild.",
  /** Hinweis auf der Ausgangsstufe (D0/S0): Kontrollgruppe, sauberer Code; max. 100 Zeichen */
  controlNote: "Kontrollgruppe: sauberer Code mit fachlichen Namen.",
  /** je Stufe ein bis zwei kurze Sätze (max. 160 Zeichen), was an dieser Stufe schlechter wurde */
  levelInfo: {
    D0: "Alle Namen sind fachlich. Das ist die Kontrollgruppe.",
    D1: "Die Hälfte der Namen ist technisch, etwa `handle`, `input` oder `Data`.",
    D2: "Alle Namen sind technisch. Der Code sagt nicht mehr, was er fachlich tut.",
    D3: "Die Hälfte der Namen ist falsch, der Rest technisch.",
    D4: "Alle Namen sind falsch, etwa `harpooned` oder `windForce`. Die Struktur bleibt gleich.",
    S0: "Sauberer Code mit fachlichen Namen und klaren Typen. Das ist die Kontrollgruppe.",
    S1: "Generische Typen ersetzen die fachlichen Typen.",
    S2: "Dazu kommen eine lange Methode und Steuer-Flags. Hier fällt die Sicherheit am stärksten.",
    S3: "Dazu kommen veränderlicher Zustand und ein Thread.",
    S4: "Dazu kommt ein Big Ball of Mud. Die Sicherheit steigt hier wieder, der Grund ist ungeprüft.",
    S5: "Dazu kommen technische statt fachlicher Namen.",
    S6: "Dazu kommen falsche Namen. Die Sicherheit sinkt noch einmal.",
  } as Record<string, string>,
  /** Legende der Färbung: Überschrift (max. 40 Zeichen) und Satz zur Doppelkodierung (Rand/Zeichen, nicht nur Farbe; max. 110 Zeichen) */
  legendTitle: "Färbung nach P(top1)",
  legendNote:
    "Rand und Zeichen tragen dieselbe Information wie die Farbe. So bleibt sie auch ohne Farbsehen lesbar.",
  /** Hinweis in der Infospalte, solange keine Stelle gewählt ist, max. 90 Zeichen */
  pickHint:
    "Eine nummerierte Stelle anklicken: Top-5-Tokens und die Wahl der Modelle.",
  /** Kurzer Satz neben der Completion-Box, was P(top1) bedeutet, max. 110 Zeichen */
  probHint:
    "P(top1) ist die Wahrscheinlichkeit des besten Tokens. Je näher an 1, desto sicherer das Modell.",
  /** Info-Dialog im HUD (Knopf (i)) */
  info: {
    title: "Studie: Kontext-Hygiene",
    question:
      "Sinkt die Sicherheit beim nächsten Token, wenn der Code Schritt für Schritt schlechter wird?",
    flow: [
      "Datei bis zur Messstelle",
      "Modell: Luna, Sol oder Terra",
      "Erstes Token der Antwort",
      "P(top1): Wahrscheinlichkeit des besten",
    ] as [string, string, string, string],
    flowNote:
      "Hohe P(top1) heißt: Das Modell ist sich beim nächsten Token sicher. Die Auswertung deckelt P(top1) bei 0,999, sonst wäre der logit unendlich. Bei Sol liegen je nach Stufe 37 % bis 89 % der Stellen an dieser Grenze.",
    ladders: {
      dose: "Nur die Namen ändern sich, Position und Struktur bleiben gleich. D0 ist fachlich, D2 durchgehend technisch, D4 durchgehend falsch.",
      steps:
        "Jede Stufe fügt einen Mangel hinzu und behält die vorigen: generische Typen, lange Methode, Thread, Ball of Mud, technische und zuletzt falsche Namen.",
    },
    sets: {
      heldout:
        "Drei Gebiete blieben während der Entwicklung zurückgehalten. An ihnen wurde nichts angepasst, deshalb prüfen sie die Vorhersage unabhängig.",
      dev: "An drei Gebieten entstanden die Hypothesen mit Luna. Luna-Werte zählen dort nicht als Beleg.",
    },
    result:
      "Je Stufe der Dosis-Leiter sinkt logit(P(top1)) bei Terra um 0,30 und bei Sol um 0,24 (p < 0,001 und p = 0,0007). Der Effekt sitzt an Fachstellen: Auf der Stufenleiter fallen sie je Stufe um 0,26 (Terra) und 0,33 (Sol), Boilerplate-Stellen nur um 0,05 und 0,01. Nicht jeder Schritt fällt: S3→S4 wird bei Sol um 0,53 sicherer. Luna wiederholt beide Trends auf allen 3 zurückgehaltenen Gebieten.",
    limits: [
      "Nicht jeder Schritt senkt die Sicherheit, S3→S4 steigt.",
      "Die Beispielstelle `warehouse` D2 ist nachträglich ausgewählt, kein Beleg.",
      "Nur drei Modelle und sechs Fachgebiete.",
      "Eine KI schrieb den Korpus; Autor und Prüfer kannten die Hypothese.",
    ],
    commentEmojiInfo:
      "🚫🤖 markiert Kommentare für Menschen. Das Modell bekommt sie nie zu sehen, sie ändern seine Vorhersage nicht.",
    missInfo:
      "Oberste Zeile rot mit ✗: Der beste Vorschlag des Modells ist nicht das erwartete Token. Blau mit ✓: Er ist es.",
    source: "Studie 3, Daten vom 06.–08.11.2026, Bericht `REPORT.md`.",
  },
  /** HUD „Live abfragen“ */
  live: {
    title: "Live abfragen",
    keyNote:
      "Der Key bleibt im Speicher dieser Seite, der Browser schickt die Anfragen direkt an den Anbieter. Ein Key mit `sk-or-…` geht an OpenRouter, jeder andere `sk-…`-Key an OpenAI.",
    withComments: "Kommentare mitsenden (nur D0/S0)",
    cost: "Jede Anfrage erzeugt höchstens 4 Ausgabe-Tokens.",
  },
} as const;
