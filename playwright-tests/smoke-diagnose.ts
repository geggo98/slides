/**
 * Generischer Smoke-Test der Diagnose-Familie.
 *   bun run playwright-tests/smoke-diagnose.ts <alias> [port]
 * Reveal-Variante (crashloop, memory-leak, noisy-neighbor): alle Signale
 * aufdecken → Ursache-Suffix an den Szenario-Buttons.
 * Latenz-Variante: ▶ startet den (pausiert startenden) Stream, ⚙ hat Slider.
 */
import { chromium } from "playwright";

const alias = process.argv[2];
const port = process.argv[3] ?? "3040";
if (!alias) {
  console.error("usage: smoke-diagnose.ts <alias> [port]");
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

const presetBtns = root.locator(".shell-preset-btn");
const nPresets = await presetBtns.count();
if (nPresets < 2) fail(`erwartete ≥2 Szenario-Buttons, fand ${nPresets}`);
await presetBtns.nth(nPresets - 1).dispatchEvent("click");
await page.waitForTimeout(700);

const unlocks = root.locator('[class*="-unlock"]');
if ((await unlocks.count()) > 0) {
  // Reveal-Variante: nacheinander alle Signale aufdecken
  let guard = 0;
  while ((await unlocks.count()) > 0 && guard++ < 6) {
    await unlocks.first().dispatchEvent("click");
    await page.waitForTimeout(1800);
  }
  const lastLabel = await presetBtns.nth(nPresets - 1).textContent();
  if (!lastLabel?.includes("—"))
    fail(`Ursache-Suffix fehlt nach vollem Aufdecken: ${lastLabel}`);
  console.log(`OK reveal [${alias}]: ${lastLabel?.trim()}`);
} else {
  // Transport-Variante (latenz): ▶ starten, dann pausieren — nach dem
  // Start heißt der Knopf „⏸ Pause", also zweiter Klick mit anderem Namen.
  await root
    .getByRole("button", { name: /Abspielen/ })
    .first()
    .dispatchEvent("click");
  await page.waitForTimeout(1500);
  await root
    .getByRole("button", { name: /Pause/ })
    .first()
    .dispatchEvent("click");
  console.log(`OK transport [${alias}]: Stream lief an`);
}

// ⚙ öffnet und enthält Controls
await root.locator(".shell-btn[aria-expanded]").dispatchEvent("click");
await root.locator(".shell-gear").waitFor({ state: "visible", timeout: 5000 });
const controls = await root
  .locator(".shell-gear input, .shell-gear button")
  .count();
if (controls < 1) fail("⚙-Panel leer");
console.log(`PASS smoke-diagnose [${alias}] (⚙: ${controls} Controls)`);
await browser.close();
