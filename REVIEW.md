# Slide-Review 2026-06 — offene Punkte

> Stand 2026-06-13. Der Großteil des Reviews vom 2026-06-12 ist umgesetzt und
> committet (alle Fakten-, Sprach-, Querverweis-, Struktur- und Overflow-Fixes
> der sieben Decks + Shared, plus vier neue Quizze) — Details in
> `git log --oneline`. Dieses Dokument listet nur noch die **offenen** Punkte:
> überwiegend optionale Komponenten-Refactors (kein nutzersichtbarer Gewinn),
> breitere Notes-/Accessibility-Abdeckung, ein paar Quiz-Ergänzungen — und als
> Abschluss der Cross-Engine-Overflow-Check.
> Aufwand: **S** < 30 min, **M** < 2 h, **L** > 2 h.

---

## Abschluss-Task

- [ ] **(M) Cross-Engine-Overflow-Check aller geänderten Slides mit dem /slidev-Skill.** Die Zwischenprüfung lief nur über **Chromium**; der gebündelte Skill-Checker deckt **chromium + firefox + webkit**, Light **und echtes Dark** (Monaco-Theme!) sowie Code unter der Monaco-Fold ab. Pro Deck einen Dev-Server starten und:

  ```sh
  CHECK="$HOME/.claude/skills/slidev/scripts/check-slide-overflow.sh"
  # Port via find-slidev-port.sh; je Deck über den vollen Folienbereich:
  zsh "$CHECK" 1-<N> <port>
  ```

  Decks: ai-agents, gradle, grafana, agents-details, java-null, open-rewrite, design-pattern. Besonders die ursprünglich **engine-spezifischen** Stellen, die im Chromium-Sweep nicht sichtbar waren, gegenprüfen — z. B. ai-agents S11 (WebKit), gradle S15 (firefox), agents-details S33 (firefox-dark) — sowie die **vier neuen Quiz-Slides**.
