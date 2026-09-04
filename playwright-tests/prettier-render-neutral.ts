// Belegt, dass die Prettier-3.8-Neuformatierung nichts am Gerenderten ändert:
// jede Datei wird in der HEAD-Fassung und in der Arbeitsbaum-Fassung durch
// dieselbe Render-Stufe geschickt und das Ergebnis verglichen.
//
//   .vue → @vue/compiler-sfc  (Render-Funktion)
//   .md  → markdown-it        (HTML)
//
// Jeder Lauf validiert zuerst seinen eigenen Vergleich an einer echten
// Inhaltsänderung. Ein Vergleich, der strukturell nichts finden kann, meldet
// sonst dasselbe wie ein sauberes Ergebnis.
//
//   bun run playwright-tests/prettier-render-neutral.ts <datei> [...]

import { parse, compileTemplate } from "@vue/compiler-sfc";
import MarkdownIt from "markdown-it";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const md = new MarkdownIt({ html: true, linkify: true }).enable("table");

const ausHead = (datei: string) =>
  execFileSync("git", ["show", `HEAD:${datei}`], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });

const rendern = (src: string, datei: string) => {
  if (datei.endsWith(".vue")) {
    const { descriptor } = parse(src, { filename: datei });
    if (!descriptor.template) throw new Error(`${datei}: kein <template>`);
    return compileTemplate({
      source: descriptor.template.content,
      filename: datei,
      id: datei,
    }).code;
  }
  return md.render(src);
};

// Kontrolle je Render-Stufe, bevor irgendein „identisch" gilt.
const kontrollen: [string, string, string][] = [
  [
    "markdown-it",
    "| a | b |\n| - | - |\n| x | y |\n",
    "| a | b |\n| - | - |\n| x | z |\n",
  ],
  [
    "@vue/compiler-sfc",
    "<template><p>hallo</p></template>",
    "<template><p>hallo!</p></template>",
  ],
];
let ok = true;
for (const [stufe, a, b] of kontrollen) {
  const datei = stufe === "markdown-it" ? "k.md" : "k.vue";
  const sieht = rendern(a, datei) !== rendern(b, datei);
  ok &&= sieht;
  console.log(
    `${sieht ? "✔" : "✘"} Kontrolle ${stufe}: Inhaltsänderung wird gesehen`,
  );
}

for (const datei of process.argv.slice(2)) {
  const vorher = ausHead(datei);
  const nachher = readFileSync(datei, "utf8");
  const geaendert = vorher !== nachher;
  const a = rendern(vorher, datei);
  const b = rendern(nachher, datei);
  const gleich = a === b;
  ok &&= gleich;
  console.log(
    `${gleich ? "✔" : "✘"} ${datei}: Quelltext ${geaendert ? "geändert" : "unverändert"}, ` +
      `Render ${a.length}→${b.length} Bytes, identisch: ${gleich}`,
  );
  if (!gleich) {
    const za = a.split("\n"),
      zb = b.split("\n");
    for (let i = 0; i < Math.max(za.length, zb.length); i++)
      if (za[i] !== zb[i]) console.log(`    - ${za[i]}\n    + ${zb[i]}`);
  }
}
process.exit(ok ? 0 : 1);
