/**
 * Prüft das Lightning-Theme an einem laufenden Deck, in Hell und Dunkel:
 *
 *   - 0xProto ist als Schrift geladen (kommt jetzt vom Theme, nicht vom Deck)
 *   - die Token-Variablen auf <html> tragen die Theme-Werte
 *   - Cover (Folie 1) und Ende (erste Folie mit layout: end) zeigen kein
 *     Chrome, jede Folie dazwischen zeigt Fortschrittsbalken und Footer
 *   - der Balken wächst linear mit der Foliennummer bis zur Ende-Folie
 *   - das Abzeichen auf dem Cover nennt die Minuten aus `duration:`
 *   - keine HTTP-Antworten ≥ 400, keine pageerror außer der bekannten
 *     Wake-Lock-Meldung
 *
 * Aufruf:  bun run playwright-tests/lightning-theme-check.ts [port]
 */
import { chromium, type Page } from "playwright";

const port = process.argv[2] ?? "3041";
const base = `http://localhost:${port}`;

const EXPECTED_BG: Record<"light" | "dark", string> = {
  light: "#fffdf7",
  dark: "#0f1115",
};

let failures = 0;
function check(ok: boolean, message: string) {
  console.log(`  ${ok ? "ok " : "FAIL"} ${message}`);
  if (!ok) failures++;
}

async function slideTotal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = (window as unknown as Record<string, any>).__slidev__?.nav;
    return Number(nav?.total ?? 0);
  });
}

async function endSlide(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = (window as unknown as Record<string, any>).__slidev__?.nav;
    const slides = (nav?.slides ?? []) as { meta?: { layout?: string } }[];
    const i = slides.findIndex((s) => s.meta?.layout === "end");
    return i >= 0 ? i + 1 : Number(nav?.total ?? 0);
  });
}

const browser = await chromium.launch();

for (const theme of ["light", "dark"] as const) {
  console.log(`\n== ${theme}`);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  const badResponses: string[] = [];
  page.on("pageerror", (e) => {
    if (!/wake ?lock/i.test(e.message)) errors.push(e.message);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(`${base}/1`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.ready;
  });

  const fontLoaded = await page.evaluate(() =>
    Array.from(document.fonts as unknown as Iterable<FontFace>).some(
      (f) => f.family.includes("0xProto") && f.status === "loaded",
    ),
  );
  check(fontLoaded, "0xProto geladen");

  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-background-primary")
      .trim(),
  );
  check(bg === EXPECTED_BG[theme], `--color-background-primary = ${bg}`);

  const total = await slideTotal(page);
  const end = await endSlide(page);
  check(total > 0 && end > 1, `Folien: ${total}, Ende-Folie: ${end}`);

  const cover = page.locator('[data-slidev-no="1"]');
  const badgeText = (await cover.locator(".lt-badge").textContent()) ?? "";
  check(/8 Min/i.test(badgeText), `Cover-Badge: „${badgeText.trim()}"`);
  check(
    (await page.locator(".lt-chrome").count()) === 0,
    "Folie 1: kein Chrome",
  );

  // Balken und Overlay in denselben (realen) Pixeln messen: clientWidth des
  // Canvas wäre logisch (980), getBoundingClientRect skaliert (× ≈ 1,3).
  const chromeWidth = async () =>
    page
      .locator(".lt-chrome")
      .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);
  const probes = [2, Math.ceil(end / 2), end - 1, end];
  for (const n of probes) {
    await page.goto(`${base}/${n}`, { waitUntil: "networkidle" });
    const chrome = page.locator(".lt-chrome");
    if (n === end) {
      check((await chrome.count()) === 0, `Folie ${n} (end): kein Chrome`);
      continue;
    }
    const width = await page
      .locator(".lt-progress")
      .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);
    const expected = ((n - 1) / (end - 1)) * (await chromeWidth());
    check(
      Math.abs(width - expected) <= 2,
      `Folie ${n}: Balken ${width.toFixed(1)} px ≈ ${expected.toFixed(1)} px`,
    );
    const foot = (await page.locator(".lt-foot-r").textContent()) ?? "";
    check(
      foot.trim() === `${n} / ${total}`,
      `Folie ${n}: Footer „${foot.trim()}"`,
    );
  }

  // Anhang hinter der Ende-Folie: Chrome zurück, Balken voll.
  if (total > end) {
    await page.goto(`${base}/${total}`, { waitUntil: "networkidle" });
    const width = await page
      .locator(".lt-progress")
      .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);
    const full = await chromeWidth();
    check(
      Math.abs(width - full) <= 2,
      `Folie ${total} (Anhang): Balken voll (${width.toFixed(1)} px)`,
    );
  }

  check(errors.length === 0, `pageerror: ${errors.join(" | ") || "keine"}`);
  check(
    badResponses.length === 0,
    `Antworten ≥ 400: ${badResponses.join(" | ") || "keine"}`,
  );
  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} Befund(e)` : "\nalles sauber");
process.exit(failures ? 1 : 0);
