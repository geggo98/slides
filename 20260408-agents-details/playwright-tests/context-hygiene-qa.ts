// QA der Folie „Kontext-Hygiene“ (Folie 12): Zustände durchklicken, Screenshots
// hell und dunkel, Konsolenfehler und Überlauf messen.
//   bun run 20260408-agents-details/playwright-tests/context-hygiene-qa.ts [port]
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const PORT = process.argv[2] ?? "3037";
const BASE = `http://localhost:${PORT}`;
const SLIDE = 12;
const OUT = new URL("./qa-context-hygiene/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

async function measure(page: Page, label: string) {
  const r = await page.evaluate(() => {
    const root = document.querySelector(".ch-root") as HTMLElement | null;
    const slide = root?.closest(".slidev-page") as HTMLElement | null;
    const q = (sel: string) => {
      const e = document.querySelector(sel) as HTMLElement | null;
      return e ? Math.round(e.getBoundingClientRect().bottom) : null;
    };
    return {
      slideBottom: slide
        ? Math.round(slide.getBoundingClientRect().bottom)
        : null,
      rootBottom: root ? Math.round(root.getBoundingClientRect().bottom) : null,
      takeawayBottom: q(".ch-takeaway"),
      sideBottom: q(".ch-side"),
      boxBottom: q(".ch-box"),
      hudBottom: q(".ch-hud"),
      marks: document.querySelectorAll(".ch-mark").length,
    };
  });
  console.log(label, JSON.stringify(r));
}

for (const scheme of ["light", "dark"] as const) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/${SLIDE}`, { waitUntil: "networkidle" });
  try {
    await page.waitForSelector(".ch-sites button", { timeout: 20000 });
  } catch (e) {
    await page.screenshot({ path: `${OUT}${scheme}-FEHLER.png` });
    console.log(scheme, "keine Marken. Konsole:", errors.slice(0, 10));
    console.log(
      await page.evaluate(() => ({
        root: !!document.querySelector(".ch-root"),
        monaco: document.querySelectorAll(".monaco-editor").length,
        text: document.querySelector(".ch-root")?.textContent?.slice(0, 200),
        url: location.href,
      })),
    );
    throw e;
  }
  await page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.ready;
  });
  await page.waitForTimeout(800);
  const shot = (n: string) =>
    page.screenshot({ path: `${OUT}${scheme}-${n}.png` });

  await shot("1-start");
  await measure(page, `${scheme} start`);

  // Stelle 3 über die Liste wählen (scrollt den Editor), Esc, dann eine sichtbare Marke anklicken
  await page.locator(".ch-sites button").nth(2).click();
  await page.waitForSelector(".ch-box", { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.locator(".ch-mark").last().click();
  await page.waitForSelector(".ch-box", { timeout: 5000 });
  await page.waitForTimeout(500);
  await shot("2-box");
  await measure(page, `${scheme} box`);
  const hidden = await page.evaluate(
    () => document.querySelectorAll(".ch-hidden").length,
  );
  console.log(scheme, "ausgeblendete Spans:", hidden);

  // Esc schließt
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  console.log(scheme, "Box nach Esc:", await page.locator(".ch-box").count());

  // Kommentare
  await page.getByLabel("Kommentare zeigen", { exact: false }).check();
  await page.waitForTimeout(600);
  await shot("3-kommentare");
  await measure(page, `${scheme} kommentare`);

  // Entwicklungsgebiet
  await page.selectOption("select", "warehouse");
  await page.waitForTimeout(600);
  await shot("4-dev");

  // Stufe D2 und Marke
  await page.locator(".ch-ticks button").nth(2).click();
  await page.waitForTimeout(600);
  await page.getByLabel("Kommentare zeigen", { exact: false }).uncheck();
  await page.waitForTimeout(400);
  await shot("5-d2");

  // Stufen-Leiter, S6
  await page.getByRole("button", { name: "Stufen: gemischte Mängel" }).click();
  await page.locator(".ch-ticks button").nth(6).click();
  await page.waitForTimeout(700);
  await shot("6-s6");
  await measure(page, `${scheme} s6`);

  // HUD
  await page.getByRole("button", { name: "Info und Live-Abfrage" }).click();
  await page.waitForTimeout(400);
  await shot("7-hud-info");
  await measure(page, `${scheme} hud`);
  await page.getByRole("tab", { name: "Live abfragen" }).click();
  await page.waitForTimeout(300);
  await shot("8-hud-live");

  console.log(
    scheme,
    "Konsole:",
    errors.length ? errors.slice(0, 8) : "keine Meldungen",
  );
  await browser.close();
}
