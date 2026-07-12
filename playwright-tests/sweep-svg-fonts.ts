/**
 * Sweep: alle Folien eines Decks durchgehen und jedes svg <text> auf
 * plausible computed font-size prüfen (Attributify-Regression-Wächter).
 * Aufruf: bun run playwright-tests/sweep-svg-fonts.ts [port] [maxPx]
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "3040";
const maxPx = parseFloat(process.argv[3] ?? "24");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/1`, { waitUntil: "networkidle" });
await page.waitForFunction(() => (window as any).__slidev__?.nav?.total);
const total = await page.evaluate(() => (window as any).__slidev__.nav.total);

let bad = 0;
for (let n = 1; n <= total; n++) {
  await page.evaluate((slide) => (window as any).__slidev__.nav.go(slide), n);
  await page.waitForTimeout(350);
  const offenders = await page.evaluate((limit) => {
    const cur = (window as any).__slidev__.nav.currentPage;
    const el = document.querySelector(`.slidev-page-${cur}`);
    if (!el) return [];
    return (
      [...el.querySelectorAll("svg text")]
        .map((t) => ({
          text: t.textContent?.trim().slice(0, 14) ?? "",
          px: parseFloat(getComputedStyle(t).fontSize),
        }))
        // Reine Emoji-Texte (Kantinen-Gäste, Koch, Bus) sind absichtlich groß —
        // nur Texte mit Buchstaben/Ziffern/#-Markern prüfen.
        .filter((x) => x.px > limit && /[0-9A-Za-z#%]/.test(x.text))
    );
  }, maxPx);
  if (offenders.length) {
    bad++;
    console.log(
      `slide ${n}: ${offenders.length} zu große svg-Texte:`,
      offenders
        .slice(0, 5)
        .map((o) => `"${o.text}"@${o.px}px`)
        .join(" "),
    );
  }
}
console.log(
  bad === 0
    ? `PASS sweep-svg-fonts: ${total} Folien, alle svg-Texte ≤ ${maxPx}px`
    : `FAIL: ${bad} Folien mit übergroßen svg-Texten`,
);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
