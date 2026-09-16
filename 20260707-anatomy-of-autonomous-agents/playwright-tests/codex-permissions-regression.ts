/**
 * codex-permissions-regression.ts — Regressionsschutz für die geteilte
 * Komponente CodexPermissions.vue (brainless-Port): rendert das Freigabe-
 * Event des Codex-Laufs in AgentRunSim (Schritt „guard“) und legt ein
 * Element-Screenshot der Dialogbox ab. Zweimal laufen lassen — einmal mit
 * dem alten Stand von CodexPermissions.vue (vor der Änderung, nicht per
 * git stash), einmal danach — und die beiden PNGs mit `cmp` vergleichen:
 * der Standardpfad (ohne `columns`) muss byteidentisch bleiben.
 *
 *   bun run 20260707-anatomy-of-autonomous-agents/playwright-tests/codex-permissions-regression.ts <label> [port]
 *
 * Schreibt playwright-tests/qa/codex-permissions-<label>.png (Dialog) und
 * codex-permissions-<label>-slide.png (ganze Folie) und druckt Maße und
 * berechnete Farben der Dialogzeilen, damit ein Unterschied benannt werden
 * kann und nicht nur „Pixel weichen ab“.
 */
import { chromium } from "playwright";

const LABEL = process.argv[2] ?? "run";
const PORT = process.argv[3] ?? "3042";
const BASE = `http://localhost:${PORT}`;
const OUT = "20260707-anatomy-of-autonomous-agents/playwright-tests/qa";
const GUARD_STEP = 6; // Index von id "guard" in agentRunScript.ts (1-basiert)

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: "light",
});
const page = await ctx.newPage();
page.on("pageerror", (e) =>
  console.log(`  pageerror: ${e.message.slice(0, 120)}`),
);

// Folie finden: nav.total abwarten, dann Folie für Folie nach dem Simulator suchen
await page.goto(`${BASE}/1`, { waitUntil: "networkidle" });
const total = await page.evaluate(
  () => (window as any).__slidev__?.nav?.total ?? 0,
);
let slideNo = 0;
for (let n = 1; n <= total; n++) {
  await page.goto(`${BASE}/${n}`, { waitUntil: "domcontentloaded" });
  const found = await page
    .locator(`[data-slidev-no="${n}"] .sim-toggle-btn--codex`)
    .waitFor({ state: "visible", timeout: 800 })
    .then(() => true)
    .catch(() => false);
  if (found) {
    slideNo = n;
    break;
  }
}
if (!slideNo) {
  console.log("✗ keine Folie mit AgentRunSim gefunden");
  process.exit(1);
}
console.log(`Folie ${slideNo} von ${total}`);

await page.goto(`${BASE}/${slideNo}`, { waitUntil: "networkidle" });
const root = page.locator(`[data-slidev-no="${slideNo}"]`);
await root.locator(".sim-toggle-btn--codex").click();
// Neustart, dann bis zum guard-Schritt vorspulen (Schritt 1 ist schon da)
await root.getByRole("button", { name: "Neustart" }).click();
for (let i = 1; i < GUARD_STEP; i++) {
  await root.getByRole("button", { name: "Schritt vor" }).click();
}
const dialog = root.locator(".ev-approval .cxp-root");
await dialog.waitFor({ state: "visible", timeout: 5000 });
await page.evaluate(async () => {
  await document.fonts.ready;
});
await page.waitForTimeout(600);

const facts = await dialog.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const rows = [...el.querySelectorAll<HTMLElement>(".cxp-option")].map((o) => {
    const marker = o.querySelector<HTMLElement>(".cxp-marker")!;
    const name = o.querySelector<HTMLElement>(".cxp-body > div")!;
    const desc = o.querySelector<HTMLElement>(".cxp-desc")!;
    const g = (x: HTMLElement) => getComputedStyle(x);
    return {
      marker: g(marker).color,
      name: g(name).color,
      nameWeight: g(name).fontWeight,
      desc: g(desc).color,
      descSize: g(desc).fontSize,
      descMargin: g(desc).marginTop,
      descHeight: Math.round(desc.getBoundingClientRect().height),
      nameHeight: Math.round(name.getBoundingClientRect().height),
      display: g(o.querySelector<HTMLElement>(".cxp-body")!).display,
    };
  });
  return {
    w: Math.round(r.width),
    h: Math.round(r.height),
    fontSize: getComputedStyle(el).fontSize,
    titleMargin: getComputedStyle(el.querySelector(".cxp-title")!).marginBottom,
    rows,
  };
});
console.log(JSON.stringify(facts, null, 1));
await dialog.screenshot({ path: `${OUT}/codex-permissions-${LABEL}.png` });
await page.screenshot({ path: `${OUT}/codex-permissions-${LABEL}-slide.png` });
console.log(`✓ ${OUT}/codex-permissions-${LABEL}.png`);
await browser.close();
