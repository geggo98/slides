# brainless — Vue port

Vue 3 ports of the terminal-UI components from
**[brainless](https://github.com/theswerd/brainless)** by
**Ben Swerdlow** ([brainless.swerdlow.dev](https://brainless.swerdlow.dev)),
a shadcn/ui registry that recreates the terminal UIs of coding agents
(Claude Code, OpenAI Codex, Grok) with high fidelity against real captures.

- **Source repo:** <https://github.com/theswerd/brainless>
- **Ported from commit:** `4c5d5ab65ff6cfa8dbb6f27cb8c88d9092a48deb`
- **License:** MIT, Copyright (c) 2026 Ben Swerdlow — see [`LICENSE`](./LICENSE)
  (verbatim copy of the upstream license). Every ported file carries an
  attribution header pointing at its original source file.
- **Scope:** the `claude` and `codex` families. The upstream `grok` family and
  the `blocks` compositions were deliberately not ported (unused here).

## Port rules

- **React/TSX + Tailwind → Vue 3 `<script setup lang="ts">` + scoped CSS.**
  UnoCSS only reliably scans deck markdown in this repo, so all Tailwind
  utilities were translated to equivalent scoped CSS.
- **Colors, glyph grammar (⏺/⎿, ❯, ›, •) and ARIA semantics are kept faithful**
  to the original. Colors stay hardcoded on purpose: a terminal is dark in both
  slide themes; these components do not adapt to light mode.
- React `useState`/`useEffect` intervals → `ref` + `setInterval` armed/cleared
  by a `watch` on the `running` prop, so a host can freeze animations when a
  slide is inactive. `prefers-reduced-motion` is honored like upstream
  (`lib/usePrefersReducedMotion.ts`).
- Controlled inputs (`value`/`onChange`) → `defineModel`; callbacks
  (`onChoose`, `onKeyDown`) → Vue emits (`choose`, `keydown`).

### Deviations from upstream

- `ClaudeHeader` gained a `compact` prop (drops the tips/what's-new column and
  shrinks the logo) so the header fits a 980×552 Slidev canvas.
- Components with a conditional root (`ClaudeMessage`, `CodexMessage`) render a
  single root element with a class switch so Vue attribute fallthrough works.
- `CodexExec` wraps long results onto their own row (`flex-wrap`) instead of
  upstream's `shrink-0`, which assumes short results like "(3 files)" and would
  crush a long command to one character per line.
- `CodexPermissions` gained two opt-in props, `subtitle` (dim line under the
  title) and `columns` (marker | name | description in one row, name cell sized
  to the widest row, selected row in cyan), plus a `--cxp-font-size` hook.
  They reproduce Codex CLI's two-column list-selection popup
  (`codex-rs/tui/src/bottom_pane/list_selection_view.rs` and
  `selection_popup_common.rs`): strings and row grammar from the
  `rust-v0.154.0` source, layout and colours checked against a screenshot of
  the "Apply reasoning change" dialog in Plan mode (Codex CLI 0.113.0,
  16.09.2026). Codex rendered columns already at v0.132, the version upstream
  captured; the stacked layout is upstream's own simplification, and without
  the props the rendering stays upstream's.
- `CodexPermissions` also watches `defaultSelected` after mount, so a host can
  move the cursor from outside (the agents-details deck walks it through the
  reasoning levels in `CodexEffortTui.vue`). Upstream reads the prop once as
  the initial state; with a constant prop the watch never fires, so the
  default path is unchanged and the regression harness
  `20260707-anatomy-of-autonomous-agents/playwright-tests/codex-permissions-regression.ts`
  is expected to stay byte-identical (not re-run for this change).
- `CodexPermissions` gained a third opt-in prop, `footer` (defaults to
  upstream's "Press enter to confirm or esc to go back"). Codex CLI 0.156.1
  (screenshots, 23.09.2026) varies this line per popup type — "enter select
  · esc back" for plain pickers, "enter default · s session · esc back" for
  a reasoning-level picker — composed dynamically from the active keymap and
  each item's `secondary_action` (`list_selection_view.rs`
  `active_footer_hint`), too deep to port; a host passes the literal string
  instead (`CodexEffortTui.vue`).

## Component index

| Family    | Components                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `claude/` | `ClaudeLogo`, `ClaudeHeader`, `ClaudeMessage`, `ClaudeThinking`, `ClaudeToolCall`, `ClaudeTodoList`, `ClaudeDiff`, `ClaudePermission`, `ClaudePrompt`, `ClaudeSlashMenu` |
| `codex/`  | `CodexHeader`, `CodexMessage`, `CodexWorking`, `CodexExec`, `CodexDiff`, `CodexPermissions`, `CodexPrompt`, `CodexSlashMenu`                                             |

Import them directly where needed, e.g.

```ts
import ClaudeToolCall from "@shared/components/brainless/claude/ClaudeToolCall.vue";
```
