# Quiz-Engine — Autoren-Konventionen

Wiederverwendbare, adaptive Quiz-Infrastruktur (`shared/quiz/`). Jeder Talk
liefert die Fragen als `<deck>/components/quiz-questions.json` und bindet sie
über einen dünnen `<Deck>Quiz.vue`-Wrapper um `QuizApp` ein. Diese Datei hält
die Konventionen fest, an die sich **alle** Deck-Quizze halten sollen, damit
der adaptive Sampler sauber funktioniert und die Decks untereinander stimmig
bleiben.

## Datenschema (`quiz-questions.json`)

```jsonc
{
  "id": "kebab-case-quiz-id",
  "title": "… Selbsttest",
  "questions": [
    {
      "id": "kebab-id",
      "question": "Welche Aussagen … treffen zu?",
      "difficulty": "easy" | "medium" | "hard",
      "section": "Thema",            // siehe Sections
      "explanation": "Kontext nach dem Submit (1+ ganzer Satz).",
      "options": [ /* siehe Options-Schema */ ]
    }
  ]
}
```

## Options-Schema: **t:3 / f:3 / d:2**

Pro Frage **8 Optionen**: 3 `verdict:"true"`, 3 `verdict:"false"`, 2
`verdict:"depends"`. Der Sampler zieht pro Lauf `optionsPerQuestion` (Default
**4**) Optionen — deshalb gilt:

- **Mindestens 2 `false`** und **mindestens 2 `true`**. Mit nur einer
  `false`-Option erscheint dieselbe falsche Aussage in _jedem_ Sample und wird
  vorhersagbar (`ai-agents transfer-mcp-spec-2025-11` war genau dieser Fehler).
- **2 `depends`** geben dem 4-aus-N-Sampler echte Varianz. `d:0` lässt die
  Frage im Pool leichter wiegen — wo fachlich tragfähig, mindestens **1
  `depends`** ergänzen.
- Das `java-null`-Quiz ist die Referenz für dieses Schema.

Jede Option: `{ id, text, verdict, explanation }`. Die `explanation` erklärt
**warum** das Verdict gilt — nicht nur „Richtig"/„Falsch".

## Difficulty-Pyramide

Mehr `easy` als `hard`, sonst bricht die adaptive Engine: Wer auf `medium`
scheitert, fällt auf `easy` zurück — ist der `easy`-Pool zu klein, wird er nach
wenigen Fragen erschöpft und der Lernende zurück auf `medium` gezwungen.

- Saubere Verteilungen: **4/8/4**, **5/7/4** (easy/medium/hard).
- **Nicht** 2/13/20 — die Spitze muss schmaler sein als die Basis.

## Sections

- **5–9 thematische Sections** pro Quiz (keine 20+ Mikro-Sections). Beispiel:
  „JSpecify", „Optional", „Refinement", „Build & Lombok".
- Die Transfer-Section (Brückenfragen zu Nachbar-Decks) heißt **einheitlich
  klein `"transfer"`** — nicht „Transfer · X".

## Stil

- **Anrede: Du** (passt zum Vortragsstil) — deckweit konsistent.
- **Deutsche Typografie**: Umlaute ausschreiben (nicht „fuer"/„haette"),
  typografische Anführungszeichen „…".
- **Feedback-Texte**: mindestens **ein ganzer Satz mit Begründung**, keine
  Zwei-Wort-Labels („Standard-Architektur.").
- Keine Authoring-Lecks: nicht „laut Presenter-Notes" / „aus den slide-data-
  Notizen", sondern „aus dem Talk".

## Konfiguration (`QuizConfig`, Defaults in `lib/types.ts`)

`maxQuestions: 8`, `optionsPerQuestion: 4`, `seedDifficulty: "medium"`.
Abweichungen nur bewusst und pro Deck dokumentieren.
