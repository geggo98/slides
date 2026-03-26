{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.bun ];

  enterShell = ''
    echo "Bun $(bun --version) ready"
  '';

  enterTest = ''
    bun --version
  '';
}
