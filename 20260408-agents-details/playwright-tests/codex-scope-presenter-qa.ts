/**
 * codex-scope-presenter-qa.ts — Presenter-Modus der Codex-Effort-Folie:
 * Die „Next“-Vorschau (render context previewNext) zeigt bei Klick 0 den
 * Dialog von Klick 1 und darf weder auf Escape noch auf das ⓘ reagieren; die
 * Hauptansicht (presenter) reagiert auf beides. Presenter-Seiten senden
 * Nav-Zustand und Cursor an ALLE Clients desselben Dev-Servers — deshalb nur
 * gegen einen eigenen Server laufen lassen (nie gegen den, den ein Mensch
 * gerade offen hat), z. B.:
 *
 *   bun run dev -- --port 3043 ./20260408-agents-details/slides.md
 *   bun run 20260408-agents-details/playwright-tests/codex-scope-presenter-qa.ts 3043
 */
import { chromium } from "playwright";

const PORT = process.argv[2] ?? "3043";
const BASE = `http://localhost:${PORT}`;
const SLIDE = 35;
const MAIN = `.slidev-presenter .grid-section.main [data-slidev-no="${SLIDE}"]`;
const NEXT = `.slidev-presenter .grid-section.next [data-slidev-no="${SLIDE}"]`;

let failures = 0;
function check(ok: boolean, label: string, extra = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? `  ${extra}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) =>
  console.log(`  pageerror: ${e.message.slice(0, 120)}`),
);
await page.goto(`${BASE}/presenter/${SLIDE}?clicks=0`, {
  waitUntil: "networkidle",
});
await page.waitForSelector(`${MAIN} .ce-controls`, { state: "visible" });
await page.waitForTimeout(500);

const mainOpen = () => page.locator(`${MAIN} .bun-pop-overlay`).isVisible();
const nextOpen = () => page.locator(`${NEXT} .bun-pop-overlay`).isVisible();

check(!(await mainOpen()), "Klick 0: Hauptansicht ohne Popup");
check(await nextOpen(), "Klick 0: Vorschau zeigt das Popup von Klick 1");

await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check(
  await nextOpen(),
  "Escape: Vorschau behält das Popup (previewNext ist nicht interaktiv)",
);

await page.locator(`${NEXT} .crs-ib`).click({ force: true });
await page.waitForTimeout(300);
check(await nextOpen(), "ⓘ in der Vorschau ändert nichts");

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
check(await mainOpen(), "Klick 1: Hauptansicht zeigt das Popup");
check(!(await nextOpen()), "Klick 1: Vorschau (Klick 2) ohne Popup");

await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check(!(await mainOpen()), "Escape in der Hauptansicht schließt");

await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
check(
  !(await mainOpen()) &&
    (await page.locator(`${MAIN} .ce-row.ce-versteckt`).count()) === 0,
  "Klick 3: Anti-Pattern in der Hauptansicht, Popup zu",
);

// Cursor-Zustand nicht hinterlassen: Maus aus der Folie bewegen
await page.mouse.move(5, 5);
await page.waitForTimeout(300);
await browser.close();
console.log(failures ? `\n✗ ${failures} Befund(e)` : "\n✓ Presenter-QA sauber");
process.exit(failures ? 1 : 0);
