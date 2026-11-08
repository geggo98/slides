// Sichtprüfung der Kommentare auf der Folie „Kontext-Hygiene“ (Folie 12): Kopfzeile auf S0,
// Kommentare auf S3 und S6.
//   bun run 20260408-agents-details/playwright-tests/context-hygiene-comments-qa.ts [port]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PORT = process.argv[2] ?? "3037";
const OUT = new URL("./qa-context-hygiene/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await (
  await browser.newContext({ viewport: { width: 1280, height: 720 } })
).newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/12`, { waitUntil: "networkidle" });
await page.waitForSelector(".ch-sites button", { timeout: 20000 });
await page.evaluate(async () => {
  await document.fonts.load('12px "0xProto"');
  await document.fonts.ready;
});
await page.getByLabel("Kommentare zeigen", { exact: false }).check();
await page.waitForTimeout(600);
const notes = async (label: string) =>
  console.log(
    label,
    await page.evaluate(() => ({
      notes: document.querySelectorAll(".ch-note").length,
      first: document.querySelector(".ch-note")?.textContent,
    })),
  );
await notes("S0");
await page.screenshot({ path: `${OUT}comments-s0.png` });

await page.getByRole("button", { name: "Stufen: gemischte Mängel" }).click();
for (const n of [3, 6]) {
  await page.locator(".ch-ticks button").nth(n).click();
  await page.waitForTimeout(700);
  await notes(`S${n}`);
  await page.screenshot({ path: `${OUT}comments-s${n}.png` });
}
console.log("Fehler:", errors.length ? errors : "keine");
await browser.close();
