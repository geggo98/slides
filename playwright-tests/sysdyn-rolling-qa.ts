// QA für das Szenario „Wandernder Engpass“ auf der Folie „Systemdynamik —
// Interaktiv“: wählt das vierte Szenario, prüft, dass Beschreibung und
// Insight vollständig im Slide-Canvas stehen, und legt Screenshots ab.
//
//   bun run playwright-tests/sysdyn-rolling-qa.ts [port] [slide]
import { chromium } from "playwright";

const nums = process.argv.filter((a) => /^\d+$/.test(a));
const PORT = nums[0] ?? "3030";
const N = Number(nums[1] ?? 33);

const b = await chromium.launch();
let schlecht = 0;
for (const theme of ["light", "dark"] as const) {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/${N}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    `window.__slidev__ && window.__slidev__.nav.currentPage === ${N}`,
    { timeout: 20000 },
  );
  await page.waitForSelector(`.slidev-page-${N} .scenario-btn`);
  await page.locator(`.slidev-page-${N} .scenario-btn`).nth(3).click();
  await page.waitForTimeout(600);
  const r = (await page.evaluate(`(() => {
    const root = document.querySelector(".slidev-page-${N}");
    const el = (s) => root.querySelector(s);
    const bottom = (e) => Math.round(e.getBoundingClientRect().bottom);
    return {
      aktiv: el(".scenario-btn.active .scenario-name").textContent.trim(),
      sub: el(".scenario-btn.active .scenario-sub").textContent.trim(),
      subZeilen: Math.round(el(".scenario-btn.active .scenario-sub").getBoundingClientRect().height / 8),
      descUnten: bottom(el(".sim-desc")),
      insightUnten: bottom(el(".insight-text")),
      slideUnten: bottom(root),
    };
  })()`)) as {
    aktiv: string;
    insightUnten: number;
    slideUnten: number;
  };
  const bad =
    !/Wandernder Engpass/.test(r.aktiv) || r.insightUnten > r.slideUnten;
  if (bad) schlecht++;
  console.log(
    `[${theme}] ${JSON.stringify(r)}${bad ? "  <-- ABWEICHUNG" : ""}`,
  );
  await page.screenshot({
    path: `playwright-tests/qa/sysdyn-rolling-${theme}.png`,
  });
  await ctx.close();
}
await b.close();
console.log(schlecht ? `\n${schlecht} Abweichung(en)` : "\nalles ok");
process.exit(schlecht ? 1 : 0);
