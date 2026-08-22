// Das ⓘ-Popup hängt an drei Folien (39 Rollen, 40 Pareto, 41 Historie). Dieses
// Skript öffnet es aus jeder heraus und schießt einen Screenshot, damit sich
// beurteilen lässt, welche Einträge im jeweiligen Kontext ins Leere greifen.
//
// Aufruf: bun run playwright-tests/sources-popover-context.ts [port]

import { chromium } from "playwright";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3031";
const BASE = `http://localhost:${PORT}`;

const SLIDES = [
  { n: 39, name: "rollen", btn: "button.mr-ib" },
  { n: 40, name: "pareto", btn: "button.mp-ib" },
  { n: 41, name: "historie", btn: "button.mh-ib" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let failures = 0;

for (const s of SLIDES) {
  await page.goto(`${BASE}/${s.n}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    `window.__slidev__ && window.__slidev__.nav.currentPage === ${s.n}`,
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);

  const hasBtn = await page.locator(s.btn).count();
  console.log(
    `\nFolie ${s.n} (${s.name}): ⓘ-Button ${hasBtn ? "da" : "FEHLT"}`,
  );
  if (!hasBtn) {
    failures++;
    continue;
  }

  await page.click(s.btn);
  await page.waitForTimeout(300);

  const items = await page.evaluate(`(() => {
    const card = document.querySelector(".bun-pop-card");
    if (!card) return null;
    const cols = card.querySelectorAll(".mrs-list");
    return {
      sources: [...(cols[0]?.querySelectorAll("li") ?? [])].map((e) => e.textContent.replace(/\\s+/g, " ").trim()),
      caveats: [...(cols[1]?.querySelectorAll("li") ?? [])].map((e) => e.textContent.replace(/\\s+/g, " ").trim()),
    };
  })()`);

  console.log(
    `  ${items.sources.length} Quellen, ${items.caveats.length} Einschränkungen`,
  );
  // Nur die Leads ausgeben — der Volltext steht in den Screenshots.
  for (const c of items.caveats) console.log(`   · ${c.slice(0, 90)}`);

  const scope = await page.evaluate(
    `document.querySelector(".mrs-scope")?.textContent?.trim() ?? ""`,
  );
  if (!scope.includes("drei")) {
    console.log("  FEHLER: Geltungsbereich fehlt im Modal-Kopf");
    failures++;
  }

  // Regressionsschutz gegen die Fehlerklasse, die diesen Check ausgelöst hat:
  // dasselbe Modal hängt an drei Folien, also darf kein Eintrag auf ein
  // Bedienelement oder eine Grafik zeigen, ohne die Folie zu benennen.
  const DEIXIS = [
    /\bist hier\b/i,
    /\bdiese[rn]? Folie\b/i,
    /\bDeshalb per Schalter\b/i,
    /\bDie Historien-Folie zeigt\b/i,
    /\bdas (Overlay|Chart)\b/i,
  ];
  for (const c of items.caveats) {
    for (const re of DEIXIS) {
      if (re.test(c)) {
        console.log(`  FEHLER: Deixis ${re} in „${c.slice(0, 70)}…“`);
        failures++;
      }
    }
  }

  await page.screenshot({
    path: `playwright-tests/qa/sources-from-${s.name}.png`,
  });
  await page.keyboard.press("Escape");
}

await browser.close();
console.log(failures === 0 ? "\nOK" : `\n${failures} PROBLEME`);
process.exit(failures === 0 ? 0 : 1);
