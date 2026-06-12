#!/usr/bin/env bash
# Stop hook: remind about the Slidev overflow check when slide files were
# modified in this session. Does not run the check itself — a dev server
# might not be running, and Playwright takes too long to block every turn.
#
# Considers a file "slide-affecting" if it matches:
#   <talk-dir>/slides.md
#   <talk-dir>/components/*.vue
#   <talk-dir>/layouts/*.vue

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

CHANGED="$(git diff --name-only HEAD 2>/dev/null \
  | grep -E '^[0-9]{8}-[^/]+/(slides\.md|components/.*\.vue|layouts/.*\.vue)$' \
  || true)"

if [ -z "$CHANGED" ]; then
  exit 0
fi

TALKS="$(echo "$CHANGED" | cut -d/ -f1 | sort -u)"

cat >&2 <<EOF

⚠ Slide files modified — overflow check recommended:
$(echo "$CHANGED" | sed 's/^/    /')

Run the /slidev-skill overflow checker against a dev server (one per affected talk):
$(echo "$TALKS" | sed 's|^|    zsh "$HOME/.claude/skills/slidev/scripts/check-slide-overflow.sh" <range> <port>   # |')

Find the port with:
    zsh \$HOME/.claude/skills/slidev/scripts/find-slidev-port.sh

EOF

exit 0
