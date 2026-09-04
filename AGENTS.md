# Repository Guide for Coding Agents

**This is the repo-wide source.** `CLAUDE.md` is a one-line `@AGENTS.md`
include, so Claude Code, the Codex CLI and anything else that looks for one of
the two conventional names reads the same text. Put new guidance **here**, never
into `CLAUDE.md`.

One subtree carries its own, in the same shape: `shared/quiz/AGENTS.md` holds
the quiz-authoring conventions (option schema, difficulty pyramid, section
naming) and `shared/quiz/CLAUDE.md` includes it. Read it before touching a
deck's `components/quiz-questions.json`. Any further nested guidance follows the
same pattern — content in `AGENTS.md`, a one-line `CLAUDE.md` beside it.

## Project Overview

Multi-presentation Slidev setup. Each talk lives in its own top-level directory (e.g. `talk-a/`, `talk-b/`) containing a `slides.md`. Built presentations are deployed to GitHub Pages with a generated landing page.

## Development Environment

Uses **devenv** (Nix-based) to provide Bun. Enter the shell with `devenv shell`
or use direnv.

**Then run `devenv tasks run slides:install` once.** Both git hooks execute out
of `node_modules` (`bun run prettier`, `bun run eslint`), so on a fresh clone
every commit fails until it exists. That is the first thing to check when a
commit fails right after cloning.

### The `devenv` Input Is Pinned

`devenv.yaml` pins the devenv modules to a release tag:

```yaml
devenv:
  url: github:cachix/devenv/v2.2.2?dir=src/modules
```

Without that entry devenv injects `github:cachix/devenv?dir=src/modules` — no
ref, so every `devenv update` jumps to `main` HEAD. Modules from `main` may
call CLI primops (`loadDotenv`, for one) that an older installed CLI does not
provide, and evaluation then fails with an undefined-variable error. Modules
older than the CLI are the supported direction, so a release tag is the safe
pin: the tag must be **≤** the installed CLI (`devenv version`) and ≤ whatever
`nix profile add nixpkgs#devenv` gives CI.

To raise it: put the new tag in `devenv.yaml`, then `devenv update devenv` —
naming the input keeps the bump to that one node.

Run **`devenv update` without an argument only deliberately**: it also moves
`nixpkgs`, which changes `pkgs.playwright-driver` and silently breaks its
pairing with the pinned `playwright` npm version (see the Playwright section
below). It does **not** move the formatter — the prettier hook runs the repo's
own binary, so a `nixpkgs` bump can no longer reformat the tree behind your
back (see Formatting).

## Common Commands

**For anything the build pipeline does, prefer devenv tasks** over direct
`bun run` — they resolve their own dependencies and keep the Claude Code
allow-list small. Tests, linting and formatting have no task; call those
through `bun run`, which is what the git hooks do too.

```sh
devenv tasks run slides:deploy       # full build pipeline: install → build all talks → landing page
bun run test                         # vitest: shared/, deploy/ and the decks' components/lib/
bun run eslint --fix <files>         # same linter the pre-commit hook runs on *.vue
```

Run `bun run test` before committing anything under `shared/`, `deploy/` or a
deck's `components/lib/`. It takes seconds; the slide overflow check is the one
that needs a running dev server, these do not.

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
- **`deploy/`**: Post-build step for GitHub Pages, run by the `slides:spa-redirect` task. `spa-scripts.ts` generates `dist/404.html` plus the per-deck restore script injected into each `index.html`; `inject-spa.ts` writes them out. Together they make a reload of a deep link (`/<base>/<talk>/41`, a `routeAlias`, `presenter/…`) survive on a host that can't rewrite URLs. The contract: the `__spa` parameter carries the **full** path including the base — `deploy/__tests__/spa-redirect.test.ts` round-trips it, `playwright-tests/spa-deep-link-check.ts` checks the built `dist/` end-to-end.
- **devenv.nix**: Defines the build pipeline as chained devenv tasks (`slides:install` → `slides:build` → `slides:spa-redirect` → `slides:landing-page` → `slides:deploy`). `SLIDES_BASE_PATH` env var controls the URL base path (defaults to `slides`, overridden in CI to the repo name).
- **CI**: `.github/workflows/deploy.yml` builds via `devenv tasks run slides` and deploys to GitHub Pages.

## Adding a New Talk

Create a new top-level directory with a `slides.md` file. It will be automatically discovered by the build pipeline. The frontmatter `title:` field is used for the landing page link text.

To use shared components via the `@shared/*` alias (e.g. `import MonacoBlock from "@shared/components/MonacoBlock.vue"`), **copy a `vite.config.ts` from an existing talk** into the new directory. Slidev only merges a `vite.config.ts` from each deck's own directory — never the repo root — so without it the alias won't resolve at build/dev time. The file is identical across talks (it points `@shared` one level up to `shared/`).

## Debugging with Playwright

Follow the guidelines in the **/slidev** skill for Playwright testing. Key rule: use the **Write tool** to create scripts in `playwright-tests/` and run them with `bun run` — never use heredocs, shell redirects, or `/tmp`.

### Slide-Canvas-Skalierung und Overflow-Checks

Slidev rendert jede Slide auf einem **logischen Canvas** (Default `980×552` CSS-Pixel) und skaliert diesen per CSS-Transform auf die Viewport-Größe. Bei einem 1280×720-Viewport beträgt der Skalierungsfaktor ≈ **1.3** — d.h. `max-height: 480px` in einer Komponente wird real als `~624px` gerendert.

**Konsequenzen:**

- Vertikale `max-height`-Werte müssen in **logischen Pixeln** gerechnet werden, nicht in Viewport-Pixeln. Für den Default-Canvas stehen nach Abzug von Titel + Padding meist nur **~400px** für den Body zur Verfügung.
- `element.getBoundingClientRect()` liefert **reale** Pixel (post-scale); `getComputedStyle().maxHeight` liefert **logische**. Für Overflow-Debugging beide vergleichen.
- Content jenseits der Slide-Boundary wird im Präsentationsmodus **abgeschnitten** — ohne Scrollbar, ohne Warnung.

**Pflicht-Check für neue oder geänderte Slides mit viel Inhalt:**

Nutze den gebündelten Cross-Browser-Checker aus dem **/slidev**-Skill (die maßgebliche Quelle — bewusst **nicht** im Repo dupliziert). Er rendert jede Folie über **chromium + firefox + webkit** (Clipping ist layout-engine-spezifisch), prüft Light **und echtes Dark** (eigener `colorScheme:'dark'`-Browser-Context, den Monaco respektiert — ein bloßer `.dark`-Klassen-Toggle kippt Monaco **nicht**), cycelt alle Tabs, misst auch nackte Text-Nodes (Range-Geometrie) und meldet Code unter der Monaco-Fold:

```sh
CHECK="$HOME/.claude/skills/slidev/scripts/check-slide-overflow.sh"
zsh "$CHECK" 1-59 3037                                  # ganzes Deck, alle drei Engines, Light+Dark
zsh "$CHECK" 23 3037 --shot ./playwright-tests/qa       # eine Folie + Screenshots (Vision-QA)
zsh "$CHECK" 1-59 3037 --browsers chromium              # schnelle Iteration, nur eine Engine
```

`<range>` ist `23` oder `1-59`; Port default `3030`, via `find-slidev-port.sh` ermittelbar; Exit-Code ≠ 0 bei Overflow. Braucht `deno` (+ `nix` für die gepinnten Browser). Hintergrund & Technik: `references/testing-overflow.md` im Skill.

Bei komplexeren Szenarien (eigene Tab-/Scroll-Logik) ein Ad-hoc-Playwright-Script in `playwright-tests/` schreiben (via **Write tool**, mit `bun run`), das die Slide auf `http://localhost:<port>/<n>` öffnet, in beiden Themes screenshottet und Panel-Bottoms gegen `720px` prüft.

### Claude-Code-Stop-Hook: Overflow-Reminder

`.claude/hooks/slide-overflow-reminder.sh` (konfiguriert in `.claude/settings.json` als `Stop`-Hook) erinnert am Turn-Ende daran, den Overflow-Check zu fahren, sobald unstaged Änderungen an `<talk>/slides.md`, `<talk>/components/*.vue` oder `<talk>/layouts/*.vue` existieren. Der Hook läuft Playwright **nicht** selbst (zu langsam, braucht laufenden Server) — er zeigt nur den konkreten `bun run`-Aufruf pro betroffenem Talk an.

## Commit Conventions

### What Runs on Every Commit

Three hooks, declared in `devenv.nix` under `git-hooks.hooks` and executed by
`prek`: `check-merge-conflicts`, then `eslint --fix` on `*.vue`, then
`prettier --write` on text files. Two of them **rewrite** rather than complain,
so a failing commit usually arrives with the fix already applied in the working
tree — inspect it, stage it, commit again.

**They only ever see the files you staged** (`pass_filenames: true`,
`always_run: false`). A tracked file that nobody has staged since the hooks went
in is unchecked, however long it has been in the repo — that is what produced
the two catch-up commits `e02a545` and `3c584e9`. To judge the whole tree you
have to sweep it yourself; see Formatting.

**Never `git commit --no-verify`.** If a hook rewrote something, that rewrite
_is_ the finding.

`.pre-commit-config.yaml` is generated and git-ignored — a symlink into the Nix
store. **After changing `git-hooks.hooks` in `devenv.nix`, re-enter the shell**
(`devenv shell true`; a direnv setup does it on `direnv reload`) before you test
anything: the symlink is rewritten on shell entry, not on commit, so until then
you are still running the old hook.

### Message Format

Commits follow **Conventional Commits** (roughly): `type(scope): subject`.

- **Type**: one of `feat`, `fix`, `refactor`, `docs`, `style`, `ci`, `build`, `chore`.
- **Scope** (almost always present): the talk short-name from the table below,
  or a cross-cutting area — `shared`, `playwright`, `deploy`, `repo`, `claude`,
  `devenv`, `deps`. Combine multiple scopes comma-separated with no space
  (`shared,java-null`).
- **Subject**: English, imperative mood, lowercase first word (the verb). Proper nouns and product/tech names keep their case (Claude Code, OpenRewrite, JSpecify, MCP). No trailing period. Aim for ≤ 72 chars.
- **Body** (optional — add it for the what-and-why, omit it for trivial changes): one blank line after the subject, then **hard-wrap every line at ≤ 72 chars**. Body language may be English or German — match the talk's slide-content language (German talks such as `ai-agents` and `open-rewrite` routinely have German bodies). Use `-` bullets for multi-part changes and backtick inline identifiers.
- **Trailer** on Claude-assisted commits, after a blank line: `🤖 edited with the help of an LLM agent`

The talk short-names are not derivable from the dated directory names:

| scope            | directory                                                    |
| ---------------- | ------------------------------------------------------------ |
| `ai-agents`      | `20260327-ai-agents`                                         |
| `gradle`         | `20260327-gradle-dependency-resolution`                      |
| `monitoring`     | `20260329-grafana-lgtm-monitoring-in-k8s-distributed-system` |
| `agents-details` | `20260408-agents-details`                                    |
| `java-null`      | `20260428-java-null-pointer`                                 |
| `open-rewrite`   | `20260522-open-rewrite`                                      |
| `design-pattern` | `20260606-design-pattern`                                    |
| `rnext`          | `20260703-rnext-proposal`                                    |
| `anatomy`        | `20260707-anatomy-of-autonomous-agents`                      |
| `sre-sim`        | `20260711-sre-simulations`                                   |

A new deck picks its own short-name and gets a row here in the same commit.

Example:

```text
feat(open-rewrite): add OpenRewrite presentation with JSpecify walkthrough

34 Slides in sieben Sektionen, deutsch, mit Inhaltsverzeichnis, das nur
die Section-Divider listet. Praxis-Sektion nutzt `MonacoBlockAnnotated`
für die JSpecify-Migration.
```

## Tooling Preferences

Default to **Bun** over Node.js for all tasks (install, run, test, build).

**Where a tool exists on both sides — nixpkgs and `package.json` — the repo's
copy wins, and the Nix side is wired to it.** That is why both git hooks call
`bun run prettier` and `bun run eslint` instead of the nixpkgs binaries: one
version, pinned by `bun.lock`, for the hook and for you alike.

**Playwright is the deliberate exception, and it runs the other way.** There Nix
owns the browser binaries, so the npm `playwright` and `playwright-chromium`
versions are pinned to follow `pkgs.playwright-driver`. Do not "harmonise" the
three — flipping Playwright to a caret range breaks the PDF export (see below).

### Install Policy (`bunfig.toml`)

The repo ships a `bunfig.toml`: a 14-day release cooldown, an exemption for the
pinned Playwright trio, and no lifecycle scripts. Two consequences worth knowing
before touching dependencies:

**Do not enable lifecycle scripts here.** The slidev skill tells you to opt out
of a machine-wide `ignoreScripts` so `playwright-chromium` can download its
browser — that advice does not apply to this repo. Browsers come from Nix
(`PLAYWRIGHT_BROWSERS_PATH`, `devenv.nix`), and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
suppresses that download on purpose. The only other dependency with an install
script is `esbuild`, which resolves its native binary from `@esbuild/<platform>`
at runtime and does not need one. If a PDF export fails, the cause is the
Playwright/nixpkgs version pairing below, not a missing script.

**Bumping the Playwright pin.** `playwright` and `playwright-chromium` must match
`pkgs.playwright-driver` exactly — no caret (see the comment in `devenv.nix`):

1. update `devenv.lock`, then read the version Nix now ships:
   `nix eval --raw github:cachix/devenv-nixpkgs/rolling#playwright-driver.version`
   (that flake ref is the `nixpkgs` input from `devenv.yaml`)
2. `bun add -E playwright@X.Y.Z playwright-chromium@X.Y.Z`
3. confirm the pairing — the browser revisions on both sides must be identical:
   ```sh
   bun -e 'console.log(require("./node_modules/playwright-core/browsers.json").browsers.map(b=>b.name+"-"+b.revision).join("\n"))'
   ls "$PLAYWRIGHT_BROWSERS_PATH"
   ```
4. verify the export still works: `devenv tasks run slides:export`

The cooldown exemption in `bunfig.toml` covers step 2 even for a same-week
Playwright release. Should a bump still be refused with
`blocked by minimum-release-age`, re-run that one command with
`--minimum-release-age=0` rather than weakening the policy file.

### Formatting (`prettier`)

**Format only with `bun run prettier`.** Not `npx prettier`, not a bare
`prettier`, not whatever an editor bundles. A bare `prettier` is not
hypothetical here — enabling the hook still pulls `pkgs.prettier` into the
devenv shell, so inside it the two disagree (measured 04.09.2026):

```console
$ command -v prettier && prettier --version
/nix/store/…-prettier-3.6.2/bin/prettier
3.6.2
$ bun run prettier --version
3.8.1
```

`devenv.nix` points the hook at the second one with
`git-hooks.hooks.prettier.settings.binPath = "bun run prettier"`, so hook,
command line and `prettier-plugin-slidev` all come from `package.json` +
`bun.lock`.

That is a deliberate departure from the built-in hook, which formats with
`pkgs.prettier` from `devenv.lock`. Those two drift: measured on 03.09.2026 the
hook was 3.6.2 while `node_modules` held 3.8.1, and the two disagree on the
column width of characters such as `↔` (U+2194) and `▶` (U+25B6). A
`bunx prettier --write` therefore produced exactly the edits the hook reverted
on commit, and the commit failed with nothing on screen to explain it — both
sides considered the file correctly formatted.

**The hook needs `node_modules`.** On a fresh clone, every commit touching a
text file fails until `devenv tasks run slides:install` has run — not only
`.vue` commits as with the eslint hook, because prettier runs on
`types: ["text"]`. The symptom is
`[error] Cannot find package 'prettier-plugin-slidev'`, which `.prettierrc`
requires; it means "run `bun install`", not "the plugin is broken".

Since the hook only sees staged files, sweeping the whole tree is a separate
job. Do it before you commit:

```sh
git ls-files -s | perl -lane 'print $F[3] unless $F[0] eq "120000"' \
  | xargs bun run prettier --ignore-unknown --list-different
```

**The symlink filter is not decoration.** 15 of the tracked files are
symlinks (each deck's `layouts/end.vue` and `public/fonts/0xProto-Regular.woff2`).
Without the filter prettier prints `… is a symbolic link` fifteen times and the
pipeline exits **123 even on a clean tree** — the file names on stdout stay
correct, but the exit code stops meaning anything. With the filter a clean tree
is exit 0 and silence, and a dirty one names its files. The hook never trips
over this: a symlink is not `text`.

**Count what the sweep saw before believing "no hits"** — append `| wc -l` and
expect `git ls-files | wc -l` minus those 15, on the order of 430. A sweep that
structurally cannot find anything reports exactly what a clean tree does.

`prek run prettier --all-files` is **not** a preview: the generated entry ends
in `--write`, so it reformats the whole tree in place. Run it when you mean to
fix, then read `git status`.

**Never mix a reformat into a feature commit.** Bumping prettier is an ordinary
`bun add` and `bun.lock` is the pin; a minor bump reformatting files is normal,
and it goes in its own `style(...)` commit. If the reformat touches rendered
files, show that it is render-neutral rather than asserting it:

```sh
bun run playwright-tests/prettier-render-neutral.ts <file> [...]
```

It renders each file from `HEAD` and from the working tree through the same
stage — `@vue/compiler-sfc` for `.vue`, `markdown-it` for `.md` — and diffs the
result, after validating both comparisons against a real content change. That
control matters: Vue condenses whitespace, so a rewrapped template line is
invisible by design, and a comparison that cannot see anything reports the same
thing as a clean one.
