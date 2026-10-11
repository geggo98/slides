// QA für die Folie „Wandernde Engpässe und Schutzkapazität“ (PipelineViz):
// klickt per ArrowRight durch die fünf Zustände, liest Engpass-Badge, Reserve
// und Füllgrad aus dem DOM, misst die Unterkante aller Elemente gegen den
// 720-px-Viewport und legt Screenshots unter playwright-tests/qa ab.
//
//   bun run playwright-tests/pipelineviz-clicks-qa.ts [port] [slide]
import { chromium } from "playwright";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3030";
const N = Number(process.argv.filter((a) => /^\d+$/.test(a))[1] ?? 28);
const OUT = "playwright-tests/qa";
const STEPS = 4;
// erwartet je Klick: Station mit Engpass-Badge (null = keine) und volle Puffer
const EXPECT: { bottleneck: string | null; full: string[] }[] = [
  { bottleneck: null, full: [] },
  { bottleneck: "Quote-Service", full: ["Quote-Service"] },
  { bottleneck: "Provider-Adapter", full: ["Provider-Adapter"] },
  { bottleneck: "API Gateway", full: [] },
  { bottleneck: null, full: [] },
];

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
  await page.waitForSelector(`.slidev-page-${N} .pipeline-viz`);
  for (let step = 0; step <= STEPS; step++) {
    if (step > 0) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(400);
    const r = (await page.evaluate(`(() => {
      const root = document.querySelector(".slidev-page-${N}");
      const nodes = [...root.querySelectorAll(".pipeline-viz .node:not(.input-node)")];
      // Unterkante des letzten Inhalts (Schlusssatz) — nicht aller Elemente:
      // ein Wrapper reicht immer bis 720 und machte die Messung wirkungslos.
      const bottoms = [...root.querySelectorAll("p")]
        .map((e) => e.getBoundingClientRect().bottom)
        .filter((v) => Number.isFinite(v));
      return {
        title: root.querySelector(".state-title")?.textContent?.trim(),
        clicks: window.__slidev__.nav.clicks,
        bottleneck: nodes.filter((n) => n.querySelector(".badge")).map((n) => n.querySelector(".name").textContent.trim()),
        full: nodes.filter((n) => /voll/.test(n.querySelector(".buf").textContent)).map((n) => n.querySelector(".name").textContent.trim()),
        caps: nodes.map((n) => n.querySelector(".cap").textContent.replace(/\\s+/g, " ").trim()),
        reserve: nodes.map((n) => n.querySelector(".reserve").textContent.replace(/\\s+/g, " ").trim()),
        buf: nodes.map((n) => n.querySelector(".buf").textContent.replace(/\\s+/g, " ").trim()),
        chainRight: Math.round(root.querySelector(".chain").getBoundingClientRect().right),
        chainScroll: root.querySelector(".chain").scrollWidth > root.querySelector(".chain").clientWidth + 1,
        maxUnten: Math.round(Math.max(...bottoms)),
      };
    })()`)) as {
      title: string;
      bottleneck: string[];
      full: string[];
      maxUnten: number;
      chainScroll: boolean;
      chainRight: number;
    };
    const want = EXPECT[step]!;
    const okBottleneck =
      (want.bottleneck === null && r.bottleneck.length === 0) ||
      (r.bottleneck.length === 1 && r.bottleneck[0] === want.bottleneck);
    const okFull = JSON.stringify(r.full) === JSON.stringify(want.full);
    // Messung validieren: ein Wert von genau 720 wäre der Viewport, nicht der Text.
    const ueber =
      r.maxUnten >= 700 ||
      r.maxUnten < 400 ||
      r.chainScroll ||
      r.chainRight > 1280;
    const bad = !okBottleneck || !okFull || ueber;
    if (bad) schlecht++;
    console.log(
      `[${theme}] Klick ${step}: ${JSON.stringify(r)}${bad ? "  <-- ABWEICHUNG" : ""}`,
    );
    await page.screenshot({ path: `${OUT}/pipelineviz-${theme}-${step}.png` });
  }
  await ctx.close();
}

await b.close();
console.log(schlecht ? `\n${schlecht} Abweichung(en)` : "\nalles ok");
process.exit(schlecht ? 1 : 0);
