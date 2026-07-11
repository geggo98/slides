/**
 * Smoke-Test P3: RetryStormSim — Preset wählen, starten, Verdict prüfen,
 * ⚙-Overlay öffnen/schließen. Aufruf: bun run playwright-tests/smoke-retry-storm.ts [port]
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "3040";
const url = `http://localhost:${port}/retry-sturm`;

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
const root = page.locator(`.slidev-page-${pageNo} .shell-root`);
await root.waitFor({ state: "visible", timeout: 15000 });

// Start-Knopf muss ohne Vorhersage gesperrt sein
const startBtn = root.getByRole("button", { name: /Simulation starten/ });
if (await startBtn.isEnabled()) fail("Start ohne Vorhersage nicht gesperrt");

// Preset „Kollaps" → Start wird frei
await root.getByRole("button", { name: "Kollaps", exact: true }).click();
await page.waitForTimeout(200);
if (!(await startBtn.isEnabled())) fail("Start trotz Preset gesperrt");

await page.screenshot({ path: "playwright-tests/qa-p3/retry-sketch.png" });

// Lauf starten, auf Verdict-Banner warten (Lauf dauert ~2-3 s)
await startBtn.click();
await root
  .locator(".rs-banner")
  .filter({ hasText: /Vorhersage|Ergebnis/ })
  .waitFor({ state: "visible", timeout: 20000 });
const verdictText = await root.locator(".rs-banner").textContent();
console.log(`OK verdict: ${verdictText?.slice(0, 110).trim()}…`);

// ⚙-Overlay: öffnen, Slider sichtbar, Escape schließt
await root.locator(".shell-btn[aria-expanded]").click();
await root.locator(".shell-gear").waitFor({ state: "visible", timeout: 5000 });
const sliders = await root.locator(".shell-gear input[type=range]").count();
if (sliders < 2) fail(`⚙-Panel: erwartete 2 Slider, fand ${sliders}`);
await page.screenshot({ path: "playwright-tests/qa-p3/retry-gear.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
if (await root.locator(".shell-gear").isVisible())
  fail("⚙-Overlay schließt nicht auf Escape");
console.log(`OK gear: ${sliders} Slider, Escape schließt`);

// Tab „Erklärung & Modell" wechselt
await root.getByRole("tab", { name: /Erklärung/ }).click();
await root.locator(".rs-explain").waitFor({ state: "visible", timeout: 5000 });
console.log("OK tabs: Erklärung sichtbar");

await browser.close();
console.log("PASS smoke-retry-storm");
