/**
 * Screenshots des Lightning-Talk-Decks fuer die Sichtpruefung — je Folie der
 * Zustand, den das Publikum am laengsten sieht, nicht der leere Anfang.
 *
 * Die Zahl der Klicks je Folie wird NICHT geraten, sondern aus
 * `__slidev__.nav.clicksTotal` gelesen. Ein geratener Wert drueckt einmal zu
 * oft und die Aufnahme faellt mitten in den Folienuebergang — hier zweimal
 * passiert, beide Male sah es nach einem Layout-Fehler aus.
 *
 * Aufruf:  bun run playwright-tests/zstd-delta-shots.ts [port] [light|dark]
 */
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const port = process.argv[2] ?? "3040";
const theme = (process.argv[3] ?? "light") as "light" | "dark";
const base = `http://localhost:${port}`;
const out = `./playwright-tests/qa-${theme}`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: theme,
});
const page = await context.newPage();

const scoped = (slide: number): Locator =>
  page.locator(`[data-slidev-no="${slide}"]`);

/** Alle Klick-Schritte der aktuellen Folie durchgehen, keinen darueber hinaus. */
async function revealAll(p: Page): Promise<void> {
  const total = await p.evaluate(() => {
    const nav = (window as unknown as Record<string, any>).__slidev__?.nav;
    return Number(nav?.clicksTotal?.value ?? nav?.clicksTotal ?? 0);
  });
  for (let i = 0; i < total; i++) {
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(160);
  }
  // Rueckgabewert bewusst keiner: shot() erwartet Promise<void>.
}

async function shot(
  slide: number,
  name: string,
  prepare?: (p: Page) => Promise<void>,
) {
  await page.goto(`${base}/${slide}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.ready;
  });
  if (prepare) await prepare(page);
  await page.screenshot({
    path: `${out}/${String(slide).padStart(2, "0")}-${name}.png`,
  });
  console.log(`  ${slide} ${name}`);
}

async function guess(slide: number, option: number) {
  await scoped(slide).getByRole("radio").nth(option).click();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1300);
}

await shot(1, "titel");
await shot(2, "problem", revealAll);
await shot(3, "dateisystem", revealAll);
await shot(4, "und-jetzt", revealAll);
await shot(5, "frage-rdiff", () => guess(5, 0));
await shot(6, "kandidaten", revealAll);
await shot(7, "restore-kette", async (p) => {
  const s = scoped(7);
  await s.getByRole("button", { name: /Aufbewahrung/ }).click();
  await s.getByRole("button", { name: /Aufbewahrung/ }).click();
  await p.waitForTimeout(250);
});
await shot(7, "restore-differenz", async (p) => {
  const s = scoped(7);
  await s.getByRole("button", { name: /Aufbewahrung/ }).click();
  await s.getByRole("button", { name: /Aufbewahrung/ }).click();
  await s.getByRole("button", { name: "Differenz", exact: true }).click();
  await p.waitForTimeout(250);
});
await shot(8, "patch-from", revealAll);
await shot(9, "frage-bibliothek", () => guess(9, 0));
await shot(10, "zahlen-bibliothek", async (p) => {
  await scoped(10).getByRole("tab").nth(2).click();
  await p.waitForTimeout(700);
});
await shot(11, "demo", async () => {
  const s = scoped(11);
  await s.locator(".demo-bars").waitFor({ timeout: 45_000 });
  await s.getByRole("button", { name: /SHA-256/ }).click();
  await s.locator(".demo-ok").waitFor({ timeout: 45_000 });
});
await shot(11, "demo-falle", async (p) => {
  const s = scoped(11);
  await s.locator(".demo-bars").waitFor({ timeout: 45_000 });
  await s.getByRole("button", { name: /Stufe 3/ }).click();
  await p.waitForTimeout(1300);
});
await shot(12, "lessons", revealAll);
await shot(13, "danke");
await shot(14, "anhang");
await shot(15, "anhang-anbindung");

await browser.close();
console.log(`\nScreenshots in ${out}`);
