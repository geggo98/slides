{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.bun ];

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

  tasks."slides:spa-redirect" = {
    exec = ''
      # Inject SPA redirect script into each talk's index.html so that
      # GitHub Pages 404 → redirect → history.replaceState works.
      SPA_SCRIPT='<script>(function(){var q=new URLSearchParams(location.search).get("__spa");if(q){history.replaceState(null,"",q)}})()</script>'
      for dir in "$DEVENV_ROOT"/dist/*/; do
        idx="$dir/index.html"
        [ -f "$idx" ] || continue
        ${pkgs.gnused}/bin/sed -i "s|<head>|<head>$SPA_SCRIPT|" "$idx"
        echo "Patched: $idx"
      done

      # Create root 404.html that redirects /<base>/<talk>/<path> to
      # /<base>/<talk>/?__spa=/<path> so the SPA can pick it up.
      cat > "$DEVENV_ROOT/dist/404.html" << 'EOF404'
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Redirecting…</title></head><body><script>
      (function(){
        var segs = location.pathname.replace(/\/+$/,"").split("/").filter(Boolean);
        // segs: ["<base>", "<talk>", ...rest]
        if (segs.length >= 3) {
          var talkBase = "/" + segs.slice(0,2).join("/") + "/";
          var rest = "/" + segs.slice(2).join("/");
          location.replace(talkBase + "?__spa=" + encodeURIComponent(rest + location.search + location.hash));
        } else if (segs.length >= 1) {
          location.replace("/" + segs[0] + "/");
        } else {
          location.replace("/");
        }
      })();
      </script></body></html>
      EOF404
      echo "Created root 404.html"
    '';
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
    after = [ "slides:spa-redirect" ];
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
