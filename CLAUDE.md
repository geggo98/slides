# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-presentation Slidev setup. Each talk lives in its own top-level directory (e.g. `talk-a/`, `talk-b/`) containing a `slides.md`. Built presentations are deployed to GitHub Pages with a generated landing page.

## Development Environment

Uses **devenv** (Nix-based) to provide Bun. Enter the shell with `devenv shell` or use direnv.

## Common Commands

```sh
bun install                          # install dependencies
bun run dev                          # start Slidev dev server (interactive, picks slides.md)
bun run slidev talk-a/slides.md      # dev server for a specific talk
bun run slidev build talk-a/slides.md --out dist/talk-a  # build a single talk
devenv tasks run slides:deploy       # full build pipeline: install → build all talks → landing page
```

## Architecture

- **Talk directories**: Any top-level directory containing a `slides.md` is treated as a presentation. The build script in `devenv.nix` auto-discovers them.
- **devenv.nix**: Defines the build pipeline as chained devenv tasks (`slides:install` → `slides:build` → `slides:landing-page` → `slides:deploy`). `SLIDES_BASE_PATH` env var controls the URL base path (defaults to `slides`, overridden in CI to the repo name).
- **CI**: `.github/workflows/deploy.yml` builds via `devenv tasks run slides` and deploys to GitHub Pages.

## Adding a New Talk

Create a new top-level directory with a `slides.md` file. It will be automatically discovered by the build pipeline. The frontmatter `title:` field is used for the landing page link text.

## Tooling Preferences

Default to **Bun** over Node.js for all tasks (install, run, test, build).
