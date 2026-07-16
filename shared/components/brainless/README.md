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

## Component index

| Family    | Components                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `claude/` | `ClaudeLogo`, `ClaudeHeader`, `ClaudeMessage`, `ClaudeThinking`, `ClaudeToolCall`, `ClaudeTodoList`, `ClaudeDiff`, `ClaudePermission`, `ClaudePrompt`, `ClaudeSlashMenu` |
| `codex/`  | `CodexHeader`, `CodexMessage`, `CodexWorking`, `CodexExec`, `CodexDiff`, `CodexPermissions`, `CodexPrompt`, `CodexSlashMenu`                                             |

Import them directly where needed, e.g.

```ts
import ClaudeToolCall from "@shared/components/brainless/claude/ClaudeToolCall.vue";
```
