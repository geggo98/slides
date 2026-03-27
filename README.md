# Slides

Multi-Präsentations-Setup mit [Slidev](https://sli.dev/).

**Veröffentlichte Präsentationen:** https://geggo98.github.io/slides/

## Neue Präsentation anlegen

Neues Verzeichnis mit einer `slides.md` erstellen – wird automatisch beim Build erkannt.

## Entwicklung

```sh
devenv shell                         # Entwicklungsumgebung starten
bun install                          # Abhängigkeiten installieren
devenv tasks run slides:dev --input dir=20260327-gradle-dependency-resolution  # Dev-Server für eine Präsentation
devenv tasks run slides:deploy       # Alle Präsentationen bauen
```
