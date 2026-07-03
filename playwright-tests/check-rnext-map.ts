/**
 * Interaktions-Check für die ComponentMap des rnext-proposal-Talks.
 *
 *   bun run playwright-tests/check-rnext-map.ts [port] [slide]
 *
 * Prüft: Schnellwahl-Button → Detail-Zoom, Esc → Ebene hoch,
 * Hintergrund-Klick → Übersicht, Region-Klick (Säule → Gruppe → Detail).
 * Screenshots (light + dark) landen in playwright-tests/.
 */
import { chromium } from "playwright";

const port = Number(process.argv[2] ?? 3032);
const slide = Number(process.argv[3] ?? 8);
const base = `http://localhost:${port}`;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`${base}/${slide}`, { waitUntil: "networkidle" });
const map = page.locator(".cmap").first();
await map.waitFor({ state: "visible", timeout: 15_000 });

const focusOf = () => map.getAttribute("data-focus");
const levelOf = () => map.getAttribute("data-level");

// Ebene 1: Übersicht
check(
  "Start = Übersicht (Ebene 1)",
  (await levelOf()) === "1",
  `focus=${await focusOf()}`,
);
await page.screenshot({
  path: "playwright-tests/rnext-map-overview-light.png",
});

// Schnellwahl-Button → Detail-Platte
await map.getByRole("button", { name: "In/Out Produkt" }).click();
await page.waitForTimeout(900);
check(
  "Button 'In/Out Produkt' → detail:produkt",
  (await focusOf()) === "detail:produkt",
);
check("… Ebene 3", (await levelOf()) === "3");
const produktText = await map.locator("text=Preise (je Zahlweise)").count();
check("Detail-Attribut sichtbar", produktText > 0);
await page.screenshot({
  path: "playwright-tests/rnext-map-detail-produkt-light.png",
});

// Esc → eine Ebene hoch (zur Eltern-Säule)
await page.keyboard.press("Escape");
await page.waitForTimeout(900);
check("Esc → pillar:tarif (Ebene 2)", (await focusOf()) === "pillar:tarif");

// Hintergrund-Klick → Übersicht
await map
  .locator("svg.stage rect.bg")
  .click({ position: { x: 5, y: 5 }, force: true });
await page.waitForTimeout(900);
check("Hintergrund-Klick → Übersicht", (await focusOf()) === "overview");

// Region-Klick: Säule "Antrag & eVB" (zweite pillar-box)
await map.locator(".pillar-box").nth(1).click();
await page.waitForTimeout(900);
check("Säulen-Klick → pillar:antrag", (await focusOf()) === "pillar:antrag");

// Region-Klick: klickbare Gruppe (mit detailId) innerhalb der fokussierten Säule
await map.locator('.group[data-group-id="antrag-in"] .group-box').click();
await page.waitForTimeout(900);
check(
  "Gruppen-Klick → Detail-Platte",
  ((await focusOf()) ?? "").startsWith("detail:"),
);

// Slide darf durch die Klicks NICHT weitergeschaltet worden sein
check("Slide unverändert", page.url().endsWith(`/${slide}`), page.url());

// Dark-Mode-Screenshots
await page.emulateMedia({ colorScheme: "dark" });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.waitForTimeout(400);
await page.screenshot({ path: "playwright-tests/rnext-map-detail-dark.png" });
await map.getByRole("button", { name: "Übersicht" }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: "playwright-tests/rnext-map-overview-dark.png" });

await browser.close();
console.log(
  failures === 0 ? "\nOK — alle Map-Checks bestanden" : `\n${failures} FEHLER`,
);
process.exit(failures === 0 ? 0 : 1);
