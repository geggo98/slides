// QA für Folie 40 „Visualisierungstypen“ (monitoring-Deck): klickt alle Karten
// der VizGuide durch, in Light und Dark, und prüft je Typ
//   - das Beispiel-SVG im Detail-Panel existiert und hat eine Größe,
//   - die Unterkante des Panels liegt innerhalb der Slide (720 px),
//   - kein Text im SVG ragt über den Rahmen des SVG hinaus.
// Screenshots: playwright-tests/monitoring-qa/vizguide-<id>-<theme>.png
//
//   bun run playwright-tests/monitoring-vizguide-samples.ts [port]
import { chromium } from "playwright";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3031";
const OUT = "playwright-tests/monitoring-qa";
const SLIDE = 40;
const IDS = [
  "timeseries",
  "stat",
  "gauge",
  "heatmap",
  "table",
  "logs",
  "traces",
  "statetimeline",
  "alertlist",
  "text",
  "dashlink",
];

const b = await chromium.launch();
let schlecht = 0;

for (const theme of ["light", "dark"] as const) {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/${SLIDE}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    `window.__slidev__ && window.__slidev__.nav.currentPage === ${SLIDE}`,
    { timeout: 20000 },
  );
  await page.waitForSelector(`.slidev-page-${SLIDE} .viz-card`);
  await page.evaluate(
    `document.fonts.load('12px "0xProto"').then(() => document.fonts.ready)`,
  );
  const cards = await page.$$(`.slidev-page-${SLIDE} .viz-card`);
  if (cards.length !== IDS.length) {
    console.log(`FEHLER: ${cards.length} Karten statt ${IDS.length}`);
    schlecht++;
  }
  for (const [i, id] of IDS.entries()) {
    await cards[i]!.click();
    await page.waitForTimeout(450);
    const r = (await page.evaluate(`(() => {
      const root = document.querySelector(".slidev-page-${SLIDE}");
      const det = root.querySelector(".viz-detail");
      const svg = det?.querySelector(".viz-detail-left svg.viz-sample");
      const sr = svg?.getBoundingClientRect();
      const stray = svg
        ? [...svg.querySelectorAll("text")].filter((t) => {
            const r = t.getBoundingClientRect();
            return r.right > sr.right + 0.5 || r.left < sr.left - 0.5 ||
                   r.bottom > sr.bottom + 0.5 || r.top < sr.top - 0.5;
          }).map((t) => t.textContent.trim())
        : [];
      const ex = det?.querySelector(".viz-detail-examples")?.getBoundingClientRect();
      const slide = root.getBoundingClientRect();
      return {
        svgW: sr ? Math.round(sr.width) : 0,
        svgH: sr ? Math.round(sr.height) : 0,
        exLeft: ex ? Math.round(ex.left - slide.left) : null,
        panelUnten: det ? Math.round(det.getBoundingClientRect().bottom) : null,
        slideUnten: Math.round(slide.bottom),
        stray,
      };
    })()`)) as {
      svgW: number;
      svgH: number;
      exLeft: number | null;
      panelUnten: number | null;
      slideUnten: number;
      stray: string[];
    };
    const ok =
      r.svgW > 0 &&
      r.svgH > 0 &&
      r.panelUnten !== null &&
      r.panelUnten <= r.slideUnten &&
      r.stray.length === 0;
    if (!ok) schlecht++;
    console.log(
      `${ok ? "ok  " : "FEHL"} ${theme.padEnd(5)} ${id.padEnd(13)} svg=${r.svgW}x${r.svgH} beispiele.x=${r.exLeft} unten=${r.panelUnten}/${r.slideUnten}` +
        (r.stray.length ? ` ausserhalb=${JSON.stringify(r.stray)}` : ""),
    );
    await page.screenshot({ path: `${OUT}/vizguide-${id}-${theme}.png` });
  }
  await ctx.close();
}

await b.close();
console.log(schlecht ? `${schlecht} Problem(e)` : "alles ok");
process.exit(schlecht ? 1 : 0);
