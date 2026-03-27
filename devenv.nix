{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.bun pkgs.tmux ];

  tasks."slides:dev" = {
    exec = ''
      dir="$(echo "$DEVENV_TASK_INPUT" | ${pkgs.jq}/bin/jq -r '.dir // empty')"
      if [ -z "$dir" ]; then
        echo "Usage: devenv tasks run slides:dev --input dir=<talk-directory>"
        echo "Example: devenv tasks run slides:dev --input dir=20260327-gradle-dependency-resolution"
        exit 1
      fi
      if [ ! -f "$DEVENV_ROOT/$dir/slides.md" ]; then
        echo "Error: $dir/slides.md not found"
        exit 1
      fi
      exec bun run slidev "$DEVENV_ROOT/$dir/slides.md"
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
          a { display: block; padding: 0.5rem 0; }
        </style>
      </head>
      <body>
        <h1>Präsentationen</h1>
        <ul>
      HEADER

      for dir in "$DEVENV_ROOT"/*/; do
        [ -f "$dir/slides.md" ] || continue
        name="$(basename "$dir")"
        title=$(grep -m1 '^title:' "$dir/slides.md" | sed 's/^title: *//' || echo "$name")
        [ -z "$title" ] && title="$name"
        echo "      <li><a href=\"./$name/\">$title</a></li>" >> "$DEVENV_ROOT/dist/index.html"
      done

      cat >> "$DEVENV_ROOT/dist/index.html" << 'FOOTER'
        </ul>
      </body>
      </html>
      FOOTER
    '';
    after = [ "slides:build" ];
  };

  tasks."slides:deploy" = {
    exec = "echo 'Build complete. Output in dist/'";
    after = [ "slides:landing-page" ];
  };

  env.SLIDES_BASE_PATH = "slides";

  enterShell = ''
    echo "Bun $(bun --version) ready"
  '';

  enterTest = ''
    bun --version
  '';
}
