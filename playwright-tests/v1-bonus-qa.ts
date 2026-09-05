// QA für die Bonusfolie „DeepSWE v1 gegen v1.1" (Folie 60) und die erste
// Station der Historie (Folie 43): rendert beide in Light und Dark, klickt
// per ArrowRight durch die Schritte, zählt Warnhinweis, Kreuze, Geisterringe
// und Labels, misst die Legendenbreite und die Unterkante der Lehren-Zeile
// gegen den 720-px-Viewport und legt Screenshots unter playwright-tests/qa ab.
//
//   bun run playwright-tests/v1-bonus-qa.ts [port]
import { chromium } from "playwright";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3031";
const OUT = "playwright-tests/qa";
const SLIDES: { n: number; steps: number; name: string }[] = [
  { n: 60, steps: 2, name: "v1-bonus" },
  { n: 43, steps: 10, name: "historie" },
];

const b = await chromium.launch();
let schlecht = 0;

for (const theme of ["light", "dark"] as const) {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  for (const s of SLIDES) {
    await page.goto(`http://localhost:${PORT}/${s.n}`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(
      `window.__slidev__ && window.__slidev__.nav.currentPage === ${s.n}`,
      { timeout: 20000 },
    );
    await page.waitForSelector(`.slidev-page-${s.n} svg.mh-chart`);
    await page.evaluate(
      `document.fonts.load('12px "0xProto"').then(() => document.fonts.ready)`,
    );
    for (let step = 0; step <= s.steps; step++) {
      if (step > 0) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(300);
      const r = (await page.evaluate(`(() => {
        const root = document.querySelector(".slidev-page-${s.n}");
        const svg = root.querySelector("svg.mh-chart");
        const leg = root.querySelector(".mh-legend");
        const lr = leg.getBoundingClientRect();
        const note = root.querySelector(".mh-note");
        const lessons = [...root.querySelectorAll(".text-xs")].pop();
        const bottoms = [...root.querySelectorAll("*")]
          .map((e) => e.getBoundingClientRect().bottom)
          .filter((v) => Number.isFinite(v));
        return {
          station: root.querySelector(".mh-tl-item.active .mh-tl-date")?.textContent?.trim(),
          stations: root.querySelectorAll(".mh-tl-item").length,
          warn: svg.querySelectorAll(".mh-warn").length,
          kreuze: svg.querySelectorAll(".mh-gone-pt").length,
          ringe: svg.querySelectorAll("circle.mp-old-pt").length,
          labels: svg.querySelectorAll("text.mh-label").length,
          front: svg.querySelectorAll("circle.mh-front-pt").length,
          dom: svg.querySelectorAll("rect.mh-dom-pt").length,
          detail: !!root.querySelector("button.mh-tg.on"),
          lens: !!svg.querySelector(".mh-lens"),
          legendeRechts: Math.round(lr.right),
          legendeScroll: leg.scrollWidth > leg.clientWidth + 1,
          legende: [...leg.children].map((c) => (c.textContent || "").trim()).join(" | "),
          noteUnten: Math.round(note.getBoundingClientRect().bottom),
          lessonsUnten: lessons ? Math.round(lessons.getBoundingClientRect().bottom) : null,
          maxUnten: Math.round(Math.max(...bottoms)),
          noteText: (note.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 90),
        };
      })()`)) as Record<string, unknown>;
      const ueber =
        (r.legendeRechts as number) > 1280 ||
        r.legendeScroll === true ||
        (r.maxUnten as number) > 720;
      if (ueber) schlecht++;
      console.log(
        `[${theme}] Folie ${s.n} Schritt ${step}: ${JSON.stringify(r)}${ueber ? "  <-- ÜBERLÄUFT" : ""}`,
      );
      await page.screenshot({
        path: `${OUT}/${s.name}-${theme}-c${step}.png`,
      });
    }
  }
  await ctx.close();
}
await b.close();
console.log(schlecht ? `\n${schlecht} Zustände laufen über` : "\nOK");
process.exit(schlecht ? 1 : 0);
