/**
 * Smoke-Test: MMcCompare — Burst- & Shed-Knopf (gekoppelte Zwillinge).
 * Erwartung: 🚌-Burst injiziert 🤖 in BEIDE Kantinen (Bus sichtbar),
 * ✂️ Load-Shed leert beide Schlangen und zeigt je Seite einen Zähler.
 * Aufruf: bun run playwright-tests/smoke-mmc-burst-shed.ts [port]
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "3040";
const url = `http://localhost:${port}/mmc-vergleich`;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => (window as any).__slidev__?.nav?.currentPage);
const pageNo = await page.evaluate(
  () => (window as any).__slidev__.nav.currentPage,
);
const root = page.locator(`.slidev-page-${pageNo} .sim-root`);
await root.waitFor({ state: "visible", timeout: 15000 });

// Sim starten, moderates ρ
await root.getByRole("button", { name: "▶ Weiter" }).dispatchEvent("click");
await root
  .getByRole("button", { name: "0.70", exact: true })
  .dispatchEvent("click");
await page.waitForTimeout(800);

// Burst: Bus erscheint in beiden Stages, danach 🤖 in beiden Kantinen
await root.getByRole("button", { name: /Burst \+12/ }).dispatchEvent("click");
await page.waitForTimeout(1300); // Bus anfahren + Injektion
const buses = await root.locator("svg text", { hasText: "🚌" }).count();
if (buses !== 2) fail(`erwartete 🚌 in beiden Kantinen, fand ${buses}`);
// Injektion erfolgt bei t≈0,9 s der Bus-Timeline; bei schnellem Abfluss oder
// trägem Server-Start (HMR) kurz nachfassen statt fix zu warten.
let robots = 0;
for (let i = 0; i < 10 && robots < 6; i++) {
  await page.waitForTimeout(300);
  robots = await root.locator("svg text", { hasText: "🤖" }).count();
}
if (robots < 6) fail(`zu wenige 🤖 nach Burst: ${robots}`);
await page.screenshot({ path: "playwright-tests/qa-mmc-burst.png" });
console.log(`OK burst: 🚌 ×${buses}, 🤖 sichtbar: ${robots}`);

// Shed: beide Zähler erscheinen
await root.getByRole("button", { name: /Load-Shed/ }).dispatchEvent("click");
await page.waitForTimeout(500);
const counters = await root
  .locator("svg text", { hasText: "verworfen" })
  .allTextContents();
if (counters.length !== 2)
  fail(`erwartete 2 Shed-Zähler (je Kantine), fand ${counters.length}`);
console.log(`OK shed: ${counters.map((c) => c.trim()).join(" · ")}`);
await page.screenshot({ path: "playwright-tests/qa-mmc-shed.png" });

await browser.close();
console.log("PASS smoke-mmc-burst-shed");
