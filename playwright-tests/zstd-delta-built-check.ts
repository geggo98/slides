/**
 * Prueft das GEBAUTE Deck unter dem Basispfad der veroeffentlichten Seite.
 *
 * Warum eigens: Die Live-Demo laedt ihre wasm-Datei ueber
 * `import.meta.env.BASE_URL`. Im Dev-Server ist der Basispfad "/", auf GitHub
 * Pages "/slides/<deck>/". Ein Fehler darin faellt im Dev-Server nie auf und
 * erst im Vortrag — dann fehlt genau die Folie, die live rechnen soll.
 *
 * Das Skript startet einen kleinen statischen Server ueber einer Ablage, die
 * den veroeffentlichten Pfad nachbildet, laedt das Deck, laesst die Demo
 * rechnen und ihre Pruefsumme bilden, und meldet jeden 404 unterwegs.
 *
 * Zwei Eigenheiten des Produktions-Builds, beide hier gemessen:
 * - `__slidev__` gibt es nur im Dev-Server. Navigiert wird deshalb ueber die
 *   URL, nicht ueber die Slidev-Navigation.
 * - Der Build legt ALLE Folien ins DOM. Ein Locator ohne Folienbezug findet
 *   die Demo deshalb auf jeder Folie; gearbeitet wird nur im Ausschnitt
 *   `[data-slidev-no="N"]`.
 *
 * Aufruf:
 *   bun run build -- --base /slides/<deck>/ --out <out> ./<deck>/slides.md
 *   bun run playwright-tests/zstd-delta-built-check.ts <gebautes-verzeichnis> <deck>
 */
import { chromium } from "playwright";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Bun-Globals ohne @types/bun im Repo.
const bun = (globalThis as unknown as { Bun: any }).Bun;

const built = resolve(process.argv[2] ?? "");
const deck = process.argv[3] ?? "";
if (!process.argv[2] || !deck || !existsSync(built)) {
  console.error(
    "Aufruf: bun run playwright-tests/zstd-delta-built-check.ts <gebautes-verzeichnis> <deck-name>",
  );
  process.exit(2);
}

const prefix = `/slides/${deck}/`;
const server = bun.serve({
  port: 0,
  fetch(request: Request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(prefix))
      return new Response("nicht gefunden", { status: 404 });
    const rest = url.pathname.slice(prefix.length) || "index.html";
    const candidate = join(built, rest);
    if (existsSync(candidate) && statSync(candidate).isFile())
      return new Response(bun.file(candidate));
    // Deep Links faengt auf GitHub Pages die generierte 404.html ab; hier
    // genuegt es, die index.html auszuliefern.
    return new Response(bun.file(join(built, "index.html")), {
      headers: { "content-type": "text/html" },
    });
  },
});

const origin = `http://localhost:${server.port}`;
const base = origin + prefix;
console.log(`Gebautes Deck unter ${base}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const problems: string[] = [];
const wasmRequests: string[] = [];
page.on("pageerror", (error) => {
  if (!/Wake Lock/.test(error.message))
    problems.push("pageerror: " + error.message.slice(0, 160));
});
page.on("response", (response) => {
  const path = response.url().replace(origin, "");
  if (response.url().endsWith(".wasm"))
    wasmRequests.push(`${response.status()} ${path}`);
  if (response.status() >= 400) problems.push(`${response.status()} ${path}`);
});

await page.goto(base, { waitUntil: "networkidle" });

// Wie viele Folien im DOM stehen, haengt am Renderfortschritt: an der Wurzel
// waren es 2, auf einer spaeten Folie alle 14. Deshalb nicht zaehlen, sondern
// Folie fuer Folie nachsehen, ob es sie ueberhaupt gibt.
const MAX_FOLIEN = 40;
let gesehen = 0;
let demoSeen = false;

for (let slide = 1; slide <= MAX_FOLIEN; slide++) {
  await page.goto(base + slide, { waitUntil: "networkidle" });
  const scope = page.locator(`[data-slidev-no="${slide}"]`);
  if ((await scope.count()) === 0) break;
  gesehen = slide;
  if ((await scope.locator(".demo").count()) === 0) continue;
  demoSeen = true;
  console.log(`Demo auf Folie ${slide}.`);

  const loaded = await scope
    .locator(".demo-bars")
    .waitFor({ timeout: 45_000 })
    .then(() => true)
    .catch(() => false);
  if (!loaded) {
    const message = await scope
      .locator(".demo-failed")
      .innerText()
      .catch(() => "(keine Meldung, die Komponente haengt im Ladezustand)");
    problems.push(`Demo lud nicht: ${message}`);
    continue;
  }
  console.log(
    `  Balken: ${(await scope.locator(".demo-value").allInnerTexts()).join(" | ")}`,
  );

  await scope.getByRole("button", { name: /SHA-256/ }).click();
  const verified = await scope
    .locator(".demo-ok")
    .waitFor({ timeout: 45_000 })
    .then(() => true)
    .catch(() => false);
  if (!verified) problems.push("SHA-256-Pruefung blieb im gebauten Deck aus");
  else console.log(`  ${await scope.locator(".demo-ok").innerText()}`);
}

await browser.close();
server.stop();

console.log(`\nDeck hat ${gesehen} Folien.`);
if (!demoSeen) problems.push("Keine Demo-Folie gefunden");
console.log(
  `\nwasm-Abrufe: ${wasmRequests.length ? wasmRequests.join(", ") : "keine"}`,
);
if (!wasmRequests.some((entry) => entry.startsWith("200"))) {
  problems.push("Keine erfolgreich geladene wasm-Datei gesehen");
}

if (problems.length === 0) {
  console.log("\nDas gebaute Deck rechnet unter dem Basispfad.");
  process.exit(0);
}
console.log(`\n${problems.length} Befunde:`);
for (const problem of problems) console.log("  " + problem);
process.exit(1);
