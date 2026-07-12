/**
 * Smoke-Test P1b: MM1Simulator-Fork im sre-sim-Deck — Burst- & Shed-Knopf.
 * Erwartung: 🚌-Burst injiziert 12 🤖 (N-Gauge springt), ✂️ Load-Shed leert
 * die Schlange (N fällt, Zähler „verworfen" erscheint).
 * Aufruf: bun run playwright-tests/smoke-mm1-burst-shed.ts [port]
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "3040";
const url = `http://localhost:${port}/mm1-simulator`;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: "networkidle" });

// Nachbar-Folien bleiben gemountet (MMcCompare hat auch .sim-root) —
// auf die aktuelle Slidev-Page scopen.
await page.waitForFunction(() => (window as any).__slidev__?.nav?.currentPage);
const pageNo = await page.evaluate(
  () => (window as any).__slidev__.nav.currentPage,
);
const root = page.locator(`.slidev-page-${pageNo} .sim-root`);
await root.waitFor({ state: "visible", timeout: 15000 });

// Sim starten (▶ Weiter) und auf ρ=0.80 stellen
await root.getByRole("button", { name: "▶ Weiter" }).click();
await root.getByRole("button", { name: "0.80" }).click();
await page.waitForTimeout(1500);

const readN = async (): Promise<number> => {
  const t = await root.textContent();
  const m = t?.match(/(\d+)\s*Pers\./);
  if (!m) fail(`N-Gauge nicht lesbar in: ${t?.slice(0, 200)}`);
  return parseInt(m[1], 10);
};

const nBefore = await readN();

// Burst: Bus erscheint, nach der Haltephase sind 12 🤖 im System
await root.getByRole("button", { name: /Burst \+12/ }).click();
await page.waitForTimeout(1300); // Bus anfahren + Injektion
const busVisible = await root.locator("svg text", { hasText: "🚌" }).count();
if (busVisible === 0) fail("Bus 🚌 nicht sichtbar nach Burst-Klick");
const robots = await root.locator("svg text", { hasText: "🤖" }).count();
if (robots < 5) fail(`zu wenige 🤖 nach Burst: ${robots}`);
const nAfterBurst = await readN();
if (nAfterBurst < nBefore + 8)
  fail(`N-Gauge nach Burst zu klein: ${nBefore} → ${nAfterBurst}`);
console.log(
  `OK burst: N ${nBefore} → ${nAfterBurst}, 🤖 sichtbar: ${robots}, Bus da`,
);

// Shed: Schlange leert sich, Zähler erscheint
await root.getByRole("button", { name: /Load-Shed/ }).click();
await page.waitForTimeout(400);
const nAfterShed = await readN();
if (nAfterShed > 2)
  fail(`N-Gauge nach Shed zu groß: ${nAfterBurst} → ${nAfterShed}`);
const counter = await root
  .locator("svg text", { hasText: "verworfen" })
  .textContent();
if (!counter || !/verworfen:\s*\d+/.test(counter))
  fail(`Shed-Zähler fehlt: ${counter}`);
console.log(
  `OK shed: N ${nAfterBurst} → ${nAfterShed}, Zähler „${counter?.trim()}"`,
);

// Feature-Shed: Zähler erscheint sofort, 🥛 landet beim Koch
await root.getByRole("button", { name: /Feature-Shed/ }).dispatchEvent("click");
await page.waitForTimeout(300);
const waterLbl = await root
  .locator("svg text", { hasText: "nur Wasser" })
  .textContent();
if (!waterLbl || !/noch \d+/.test(waterLbl))
  fail(`Wasser-Zähler fehlt: ${waterLbl}`);
let waterServed = 0;
for (let i = 0; i < 20 && waterServed === 0; i++) {
  await page.waitForTimeout(400);
  waterServed = await root.locator("svg text", { hasText: "🥛" }).count();
}
if (waterServed === 0) fail("kein 🥛 beim Koch nach Feature-Shed");
console.log(`OK feature-shed: „${waterLbl.trim()}", 🥛 serviert`);

// Screenshot für Vision-QA
await page.screenshot({
  path: "playwright-tests/qa-p1b-mm1-burst-shed.png",
  fullPage: false,
});
await browser.close();
console.log("PASS smoke-mm1-burst-shed");
