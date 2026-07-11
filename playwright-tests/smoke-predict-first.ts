/**
 * Generischer Smoke-Test der Predict-first-Familie: Preset wählen → starten →
 * Verdict-Banner erscheint → ⚙ öffnet. Aufruf:
 *   bun run playwright-tests/smoke-predict-first.ts <alias> [port]
 */
import { chromium } from "playwright";

const alias = process.argv[2];
const port = process.argv[3] ?? "3040";
if (!alias) {
  console.error("usage: smoke-predict-first.ts <alias> [port]");
  process.exit(2);
}

function fail(msg: string): never {
  console.error(`FAIL [${alias}]: ${msg}`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/${alias}`, {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => (window as any).__slidev__?.nav?.currentPage);
const pageNo = await page.evaluate(
  () => (window as any).__slidev__.nav.currentPage,
);
const root = page.locator(`.slidev-page-${pageNo} .shell-root`);
await root.waitFor({ state: "visible", timeout: 15000 });

// Letztes Vorhersage-Preset wählen (i.d.R. der Worst Case), dann starten
const presetBtns = root.locator(".shell-preset-btn");
const nPresets = await presetBtns.count();
if (nPresets < 3) fail(`erwartete ≥3 Presets, fand ${nPresets}`);
await presetBtns.nth(nPresets - 1).dispatchEvent("click");
await page.waitForTimeout(300);

const startBtn = root.getByRole("button", { name: /Simulation starten/ });
if (!(await startBtn.isEnabled())) fail("Start trotz Preset gesperrt");
await startBtn.dispatchEvent("click");

// Verdict-Banner (Klassen-Suffix -banner, Familien-Präfix variiert)
await root
  .locator('[class*="-banner"]')
  .first()
  .waitFor({ state: "visible", timeout: 30000 });
const verdict = await root.locator('[class*="-banner"]').first().textContent();
console.log(`OK verdict [${alias}]: ${verdict?.slice(0, 100).trim()}…`);

// ⚙-Overlay öffnet und enthält Regler/Buttons
await root.locator(".shell-btn[aria-expanded]").dispatchEvent("click");
await root.locator(".shell-gear").waitFor({ state: "visible", timeout: 5000 });
const controls = await root
  .locator(".shell-gear input, .shell-gear button")
  .count();
if (controls < 2) fail(`⚙-Panel fast leer (${controls} Controls)`);
console.log(`OK gear [${alias}]: ${controls} Controls`);

// Tab Erklärung & Modell
await root.getByRole("tab", { name: /Erklärung/ }).dispatchEvent("click");
await page.waitForTimeout(300);
const explainVisible = await root
  .locator('[class*="-explain"]')
  .first()
  .isVisible();
if (!explainVisible) fail("Erklärung-Tab nicht sichtbar");
console.log(`PASS smoke-predict-first [${alias}]`);
await browser.close();
