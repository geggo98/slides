#!/usr/bin/env bash
# Stop hook: remind about the Slidev overflow check when slide files were
# modified in this session. Does not run the check itself — a dev server
# might not be running, and Playwright takes too long to block every turn.
#
# Considers a file "slide-affecting" if it matches:
#   <talk-dir>/slides.md
#   <talk-dir>/components/*.vue
#   <talk-dir>/layouts/*.vue
#   shared/slidev-themes/<theme>/**   (affects every deck using that theme)

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

ALL="$(git diff --name-only HEAD 2>/dev/null || true)"

CHANGED="$(echo "$ALL" \
  | grep -E '^[0-9]{8}-[^/]+/(slides\.md|components/.*\.vue|layouts/.*\.vue)$' \
  || true)"

THEME_FILES="$(echo "$ALL" | grep -E '^shared/slidev-themes/[^/]+/' || true)"

if [ -z "$CHANGED" ] && [ -z "$THEME_FILES" ]; then
  exit 0
fi

TALKS="$(echo "$CHANGED" | cut -d/ -f1)"

# A theme change hits every deck whose headmatter points at that theme.
for theme in $(echo "$THEME_FILES" | cut -d/ -f3 | sort -u); do
  [ -n "$theme" ] || continue
  TALKS="$TALKS"$'\n'"$(grep -lE "^theme:[[:space:]]*[\"']?\.\./shared/slidev-themes/$theme/?[\"']?[[:space:]]*(#.*)?$" [0-9]*/slides.md 2>/dev/null | cut -d/ -f1 || true)"
done

TALKS="$(echo "$TALKS" | sed '/^$/d' | sort -u)"

cat >&2 <<EOF

⚠ Slide files modified — overflow check recommended:
$(printf '%s\n%s\n' "$CHANGED" "$THEME_FILES" | sed '/^$/d' | sed 's/^/    /')

Run the /slidev-skill overflow checker against a dev server (one per affected talk):
$(echo "$TALKS" | sed 's|^|    zsh "$HOME/.claude/skills/slidev/scripts/check-slide-overflow.sh" <range> <port>   # |')

Find the port with:
    zsh \$HOME/.claude/skills/slidev/scripts/find-slidev-port.sh

EOF

exit 0
