# Slide-Review 2026-06 — abgeschlossen

> Stand 2026-06-13. Alle Punkte des Reviews sind umgesetzt und pro
> Foliensatz committet (Details: `git log --oneline`), inklusive des
> abschließenden Cross-Engine-Overflow-Checks aller sieben Decks mit dem
> /slidev-Skill-Checker (chromium + firefox + webkit, Light + echtes
> Dark, alle Tabs gecycelt) — auch der früher engine-spezifischen
> Stellen (ai-agents S11 WebKit, gradle S15 Firefox, agents-details S33
> firefox-dark) und der Quiz-Folien.

## Bewusste Entscheidungen / bekannt offen

- **gradle — MatrixPivot-Migration verworfen:** `CompareTable`/`JvmMatrix`
  bleiben eigenständig. `MatrixPivot` rendert Zell-Details nur als
  Plaintext (die 21 JvmMatrix-Detailtexte sind HTML-reich), hartkodiert
  eine deck-fremde Optik (DM Sans, Violett-Palette), und das persistente
  Detail-Panel mit Default-Selektion ist präsentationsfreundlicher als
  transiente Klick-Blasen.
- **Bewusst scrollbare Monaco-Editoren** (Checker meldet „code below
  fold"; vorbestehend und per Presenter-Note als Absicht dokumentiert):
  ai-agents S38 (Example Explorer), java-null S19/S24/S26,
  open-rewrite F10/F11/F23–F25. Checker-clean nur durch Folien-Split
  oder Kürzung des kanonischen Codes erreichbar — Autor-Entscheidung.
- **gradle S43 (Tab „Evolution"):** kosmetisches horizontales Clipping
  einer Monaco-Zeile innerhalb des Editor-Scrollbereichs (Folge der
  50/50-Spaltenbreite, vorbestehend, kein Slide-Overflow).
