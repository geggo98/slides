{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.bun pkgs.playwright-driver.browsers ];

  tasks."local:dev" = {
    exec = ''
      dir="$(echo "$DEVENV_TASK_INPUT" | ${pkgs.jq}/bin/jq -r '.dir // empty')"
      port="$(echo "$DEVENV_TASK_INPUT" | ${pkgs.jq}/bin/jq -r '.port // empty')"
      if [ -z "$dir" ]; then
        echo "Usage: devenv tasks run local:dev --input dir=<talk-directory> [--input port=<port>]"
        echo "Example: devenv tasks run local:dev --input dir=20260327-gradle-dependency-resolution --input port=3030"
        exit 1
      fi
      if [ ! -f "$DEVENV_ROOT/$dir/slides.md" ]; then
        echo "Error: $dir/slides.md not found"
        exit 1
      fi
      port_args=""
      if [ -n "$port" ]; then
        port_args="--port $port"
      fi
      exec bun run slidev $port_args "$DEVENV_ROOT/$dir/slides.md"
    '';
    after = [ "slides:install" ];
  };

  tasks."slides:install" = {
    exec = "bun install";
    status = "test -d $DEVENV_ROOT/node_modules";
  };

  tasks."slides:build" = {
    exec = ''
      mkdir -p "$DEVENV_ROOT/dist"
      for dir in "$DEVENV_ROOT"/*/; do
        [ -f "$dir/slides.md" ] || continue
        name="$(basename "$dir")"
        echo "Building: $name"
        bun run slidev build "$dir/slides.md" \
          --base "/$SLIDES_BASE_PATH/$name/" \
          --out "$DEVENV_ROOT/dist/$name"
      done
    '';
    after = [ "slides:install" ];
  };

  tasks."slides:export" = {
    exec = ''
      # Export each deck to a light and a dark PDF alongside its built SPA, so the
      # PDFs deploy as part of dist/. Fail-soft: a failed export logs a warning and
      # continues (a missing PDF must not break the whole Pages deploy; the landing
      # page only links PDFs that actually exist). Collapsed (one page per slide,
      # final revealed state) — no --with-clicks.
      for dir in "$DEVENV_ROOT"/*/; do
        [ -f "$dir/slides.md" ] || continue
        name="$(basename "$dir")"
        echo "Exporting PDF: $name"
        bun run slidev export "$dir/slides.md" \
          --output "$DEVENV_ROOT/dist/$name/$name.pdf" \
          --timeout 60000 \
          || echo "WARN: light PDF export failed for $name"
        bun run slidev export "$dir/slides.md" --dark \
          --output "$DEVENV_ROOT/dist/$name/$name-dark.pdf" \
          --timeout 60000 \
          || echo "WARN: dark PDF export failed for $name"
      done
    '';
    after = [ "slides:build" ];
  };

  tasks."slides:spa-redirect" = {
    # Writes dist/404.html and injects the path-restore script into each talk's
    # index.html, so GitHub Pages 404 → redirect → history.replaceState works for
    # deep links. Both scripts live in deploy/spa-scripts.ts — they have to agree
    # on the `__spa` payload, and that contract is unit-tested there.
    exec = "bun run $DEVENV_ROOT/deploy/inject-spa.ts";
    after = [ "slides:build" ];
  };

  tasks."slides:landing-page" = {
    exec = ''
      cat > "$DEVENV_ROOT/dist/index.html" << 'HEADER'
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Slides</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
          ul { list-style: none; padding: 0; }
          li { padding: 0.5rem 0; }
          a.title { display: block; padding: 0.25rem 0; }
          .pdf { font-size: 0.85em; }
          .pdf a { display: inline; padding: 0; margin-right: 0.75rem; color: #06c; }
        </style>
      </head>
      <body>
        <h1>Präsentationen</h1>
        <ul>
      HEADER

      for dir in "$DEVENV_ROOT"/*/; do
        [ -f "$dir/slides.md" ] || continue
        name="$(basename "$dir")"
        title=$(grep -m1 '^title:' "$dir/slides.md" | sed 's/^title: *//; s/^"\(.*\)"$/\1/' || echo "$name")
        [ -z "$title" ] && title="$name"
        pdfs=""
        [ -f "$DEVENV_ROOT/dist/$name/$name.pdf" ]      && pdfs="$pdfs<a href=\"./$name/$name.pdf\">PDF (hell)</a>"
        [ -f "$DEVENV_ROOT/dist/$name/$name-dark.pdf" ] && pdfs="$pdfs<a href=\"./$name/$name-dark.pdf\">PDF (dunkel)</a>"
        [ -n "$pdfs" ] && pdfs=" <span class=\"pdf\">$pdfs</span>"
        echo "      <li><a class=\"title\" href=\"./$name/\">$title</a>$pdfs</li>" >> "$DEVENV_ROOT/dist/index.html"
      done

      cat >> "$DEVENV_ROOT/dist/index.html" << 'FOOTER'
        </ul>
      </body>
      </html>
      FOOTER
    '';
    after = [ "slides:spa-redirect" "slides:export" ];
  };

  tasks."slides:deploy" = {
    exec = "echo 'Build complete. Output in dist/'";
    after = [ "slides:landing-page" ];
  };

  git-hooks.hooks = {
    # Formatter — custom binary so the repo's own prettier (package.json +
    # bun.lock) formats, together with prettier-plugin-slidev from the same
    # tree. The nixpkgs prettier drifts against it: at the last lock it was
    # 3.6.2 against 3.8.1 in node_modules, and the two disagree on the column
    # width of characters such as ↔ and ▶ — so `bunx prettier --write` produced
    # exactly the edits this hook then reverted, and the commit failed with no
    # visible reason.
    #
    # `bun run` rather than ./node_modules/.bin/prettier: that script's shebang
    # is `#!/usr/bin/env node`, and devenv ships bun, not node.
    #
    # The price: this hook needs node_modules. On a fresh clone, every commit
    # fails until `devenv tasks run slides:install` has run.
    prettier = {
      enable = true;
      settings.binPath = "bun run prettier";
    };

    # Linter — custom hook so eslint-plugin-vue from node_modules is used
    eslint = {
      enable = true;
      name = "eslint";
      entry = "bun run eslint --fix";
      files = "\\.vue$";
      language = "system";
      pass_filenames = true;
    };

    check-merge-conflicts.enable = true;
  };

  env.SLIDES_BASE_PATH = "slides";

  # Chromium for `slidev export` (PDF). Use the Nix-provided browsers so the build
  # is reproducible and offline — matches the nixpkgs `playwright-driver` version
  # against the `playwright-chromium` npm dep (both 1.58.2). The skip flags keep
  # `bun install` from downloading a redundant browser via postinstall.
  env.PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
  env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";

  enterShell = ''
    echo "Bun $(bun --version) ready"
  '';

  enterTest = ''
    bun --version
  '';
}
