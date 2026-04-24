# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-presentation Slidev setup. Each talk lives in its own top-level directory (e.g. `talk-a/`, `talk-b/`) containing a `slides.md`. Built presentations are deployed to GitHub Pages with a generated landing page.

## Development Environment

Uses **devenv** (Nix-based) to provide Bun. Enter the shell with `devenv shell` or use direnv.

## Common Commands

Prefer **devenv tasks** over direct `bun run` commands — they handle dependencies automatically and simplify the Claude Code allow-list.

```sh
devenv tasks run slides:deploy       # full build pipeline: install → build all talks → landing page
```

### Starting the Dev Server

The Slidev dev server requires a full TTY and **will not start as a sub-process of the agent**. Use this workflow instead:

1. **Check for a running server** using the `find-slidev-port.sh` script from the **/slidev** skill.
2. **If no server is running**, use the **/tmux** skill to start one in a persistent tmux session:
   ```sh
   bun run dev -- --port 3031 ./<talk-directory>/slides.md
   ```
   Always specify `--port` so the server URL is known.

**Dev console**: In the devenv tasks TUI, select a task with the cursor keys and press **Ctrl-e** to expand its logs.

## Architecture

- **Talk directories**: Any top-level directory containing a `slides.md` is treated as a presentation. The build script in `devenv.nix` auto-discovers them.
- **`playwright-tests/`**: Scratch directory for Playwright debug scripts and screenshots. Git-ignored by default; `git add -f` individual files to keep them.
- **devenv.nix**: Defines the build pipeline as chained devenv tasks (`slides:install` → `slides:build` → `slides:landing-page` → `slides:deploy`). `SLIDES_BASE_PATH` env var controls the URL base path (defaults to `slides`, overridden in CI to the repo name).
- **CI**: `.github/workflows/deploy.yml` builds via `devenv tasks run slides` and deploys to GitHub Pages.

## Adding a New Talk

Create a new top-level directory with a `slides.md` file. It will be automatically discovered by the build pipeline. The frontmatter `title:` field is used for the landing page link text.

## Debugging with Playwright

Follow the guidelines in the **/slidev** skill for Playwright testing. Key rule: use the **Write tool** to create scripts in `playwright-tests/` and run them with `bun run` — never use heredocs, shell redirects, or `/tmp`.

### Slide-Canvas-Skalierung und Overflow-Checks

Slidev rendert jede Slide auf einem **logischen Canvas** (Default `980×552` CSS-Pixel) und skaliert diesen per CSS-Transform auf die Viewport-Größe. Bei einem 1280×720-Viewport beträgt der Skalierungsfaktor ≈ **1.3** — d.h. `max-height: 480px` in einer Komponente wird real als `~624px` gerendert.

**Konsequenzen:**

- Vertikale `max-height`-Werte müssen in **logischen Pixeln** gerechnet werden, nicht in Viewport-Pixeln. Für den Default-Canvas stehen nach Abzug von Titel + Padding meist nur **~400px** für den Body zur Verfügung.
- `element.getBoundingClientRect()` liefert **reale** Pixel (post-scale); `getComputedStyle().maxHeight` liefert **logische**. Für Overflow-Debugging beide vergleichen.
- Content jenseits der Slide-Boundary wird im Präsentationsmodus **abgeschnitten** — ohne Scrollbar, ohne Warnung.

**Pflicht-Check für neue oder geänderte Slides mit viel Inhalt:**

Nutze das dedizierte Skript:

```sh
bun run playwright-tests/check-slide-overflow.ts <slide-nummer> [port]
```

Es cycled durch alle Tabs (`.tab-bar button`, `.tabs button`, `.eco-tabs button`, `[role=tab]`), togglet Light + Dark, scrollt interne Container ans Ende und meldet jedes Element mit `bottom > 720`. Exit-Code ≠ 0 bei Overflow. Port wird via `find-slidev-port.sh` auto-detektiert, wenn nicht übergeben.

Bei komplexeren Szenarien (spezifische Tab-Navigation, eigene Scroll-Logik) stattdessen ein Ad-hoc-Playwright-Script in `playwright-tests/` schreiben, das die Slide auf `http://localhost:<port>/<n>` öffnet, in beiden Themes screenshottet und Panel-Bottoms gegen `720px` prüft.

### Hook: Stop-Reminder

`.claude/hooks/slide-overflow-reminder.sh` (konfiguriert in `.claude/settings.json` als `Stop`-Hook) erinnert am Turn-Ende daran, den Overflow-Check zu fahren, sobald unstaged Änderungen an `<talk>/slides.md`, `<talk>/components/*.vue` oder `<talk>/layouts/*.vue` existieren. Der Hook läuft Playwright **nicht** selbst (zu langsam, braucht laufenden Server) — er zeigt nur den konkreten `bun run`-Aufruf pro betroffenem Talk an.

## Tooling Preferences

Default to **Bun** over Node.js for all tasks (install, run, test, build).
