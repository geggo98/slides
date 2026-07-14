/**
 * Smoke-Test der Sentry-Vergleichsmatrix (MatrixPivot-Erstverwendung).
 *   bun run playwright-tests/smoke-sentry-compare.ts [port]
 * Navigiert über den routeAlias `sentry-vergleich` (Divider), wechselt zur
 * Matrix-Folie, klickt Zellen an (Bubble unten/oben, Escape schließt) und
 * prüft den TalkXref-Deep-Link auf der "Besser zusammen"-Folie.
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "3037";

function fail(msg: string): never {
  console.error(`FAIL [sentry-compare]: ${msg}`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/sentry-vergleich`, {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => (window as any).__slidev__?.nav?.currentPage);
const dividerPage = await page.evaluate(
  () => (window as any).__slidev__.nav.currentPage,
);

// Matrix-Folie liegt direkt hinter dem Divider.
const matrixPage = dividerPage + 1;
await page.goto(`http://localhost:${port}/${matrixPage}`, {
  waitUntil: "networkidle",
});
const root = page.locator(`.slidev-page-${matrixPage} .sentry-compare`);
await root.waitFor({ state: "visible", timeout: 15000 });

// Legende: drei Marks (stark / teilweise / fehlt)
const legendEntries = root.locator(".legend > span:not(.hint)");
const nLegend = await legendEntries.count();
if (nLegend !== 3) fail(`erwartete 3 Legenden-Einträge, fand ${nLegend}`);

// Klick auf die Sentry-Metriken-Zelle → Bubble mit Detailtext
const metricsCell = root.getByRole("cell", {
  name: /keine General-Purpose-Metriken/,
});
await metricsCell.dispatchEvent("click");
const bubble = root.locator(".bubble");
await bubble.waitFor({ state: "visible", timeout: 5000 });
const head = await bubble.locator(".bub-head").textContent();
const body = await bubble.locator(".bub-body").textContent();
if (!head?.includes("Sentry")) fail(`Bubble-Titel ohne "Sentry": ${head}`);
if (!body?.includes("Burn-Rate")) fail(`Bubble-Body ohne "Burn-Rate": ${body}`);
const box1 = await bubble.boundingBox();
if (!box1 || box1.y + box1.height > 720)
  fail(`Bubble ragt unter den Canvas: bottom=${box1 && box1.y + box1.height}`);

// Unterste Zeile → Bubble muss sichtbar im Canvas bleiben (Placement-Flip)
const bottomCell = root.getByRole("cell", { name: /FSL · schwergewichtig/ });
await bottomCell.dispatchEvent("click");
await bubble.waitFor({ state: "visible", timeout: 5000 });
const placement = await bubble.getAttribute("class");
const box2 = await bubble.boundingBox();
if (!box2 || box2.y < 0 || box2.y + box2.height > 720)
  fail(`Bubble (unterste Zeile) außerhalb: ${JSON.stringify(box2)}`);

// Escape schließt die Bubble
await page.keyboard.press("Escape");
await bubble.waitFor({ state: "hidden", timeout: 5000 });

// "Besser zusammen"-Folie: TalkXref-Deep-Link prüfen
const xrefPage = matrixPage + 1;
await page.goto(`http://localhost:${port}/${xrefPage}`, {
  waitUntil: "networkidle",
});
const xref = page.locator(`.slidev-page-${xrefPage} a.talk-xref`);
await xref.waitFor({ state: "visible", timeout: 15000 });
const href = await xref.getAttribute("href");
if (!href?.endsWith("/20260711-sre-simulations/slo-burn-rate"))
  fail(`TalkXref-href unerwartet: ${href}`);

console.log(
  `OK sentry-compare: Divider=${dividerPage}, Bubble unten ok (${Math.round(
    box1.y,
  )}..${Math.round(box1.y + box1.height)}), unterste Zeile ${
    placement?.includes("above") ? "above" : "below"
  } (${Math.round(box2.y)}..${Math.round(box2.y + box2.height)}), Xref=${href}`,
);
await browser.close();
