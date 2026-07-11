/**
 * Smoke-Test P4: RabbitQueueSim — Szenario wechseln, 3× aufdecken,
 * Hypothese wird eindeutig, Play/Scrub, Reset über ⚙.
 * Aufruf: bun run playwright-tests/smoke-rabbit-queue.ts [port]
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "3040";
const url = `http://localhost:${port}/rabbitmq-queue`;

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

// Szenario B wählen
await root.getByRole("button", { name: /^Szenario B/ }).click();
await page.waitForTimeout(900);

// Vor dem Aufdecken: alle Hypothesen ~33 %
const pcts = await root.locator(".rq-hpct").allTextContents();
console.log(`OK initial posteriors: ${pcts.join(" ")}`);

// 3× aufdecken (nur der jeweils nächste Kanal ist freigeschaltet).
// dispatchEvent statt click: Slidevs unsichtbare Dev-Toolbar (bottom-left,
// opacity-0) fängt sonst den Pointer ab — reines Dev-Mode-Artefakt.
for (let i = 1; i <= 3; i++) {
  const unlock = root.locator(".rq-unlock");
  if ((await unlock.count()) !== 1)
    fail(
      `erwartete genau 1 freigeschalteten Kanal, fand ${await unlock.count()}`,
    );
  await unlock.dispatchEvent("click");
  await page.waitForTimeout(1900); // Reveal-Animation
}

// Nach vollem Aufdecken: eine Hypothese dominiert, Tabs zeigen Ursachen
const winTag = await root.locator(".rq-wtag").count();
if (winTag !== 1) fail(`kein eindeutiger Gewinner (wtag=${winTag})`);
const finalPcts = await root.locator(".rq-hpct").allTextContents();
const maxPct = Math.max(...finalPcts.map((s) => parseInt(s, 10)));
if (maxPct < 90) fail(`Gewinner-Posterior zu schwach: ${finalPcts.join(" ")}`);
const tabLabel = await root
  .getByRole("button", { name: /^Szenario B/ })
  .textContent();
if (!tabLabel?.includes("—")) fail(`Tab zeigt Ursache nicht: ${tabLabel}`);
console.log(`OK reveal: ${finalPcts.join(" ")} · Tab: ${tabLabel?.trim()}`);

// Play + Scrub
await root.getByRole("button", { name: /Abspielen/ }).click();
await page.waitForTimeout(700);
const t1 = await root.locator(".rq-time").textContent();
await root.getByRole("button", { name: /Pause/ }).click();
if (!t1 || !/t = \d+ s/.test(t1)) fail(`Transport läuft nicht: ${t1}`);
console.log(`OK transport: ${t1?.trim()}`);

// ⚙ Reset & neu mischen → Reveal wieder 0
await root.locator(".shell-btn[aria-expanded]").click();
await root.getByRole("button", { name: /neu mischen/ }).click();
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const lbl = await root.locator(".rq-steplbl").textContent();
if (!lbl?.includes("0 / 3")) fail(`Reset setzt Signale nicht zurück: ${lbl}`);
console.log(`OK reset: ${lbl?.trim()}`);

await page.screenshot({ path: "playwright-tests/qa-p4/rabbit-final.png" });
await browser.close();
console.log("PASS smoke-rabbit-queue");
