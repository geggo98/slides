// Die Legendenzeile ist `flex-wrap: nowrap; white-space: nowrap`. Ein zusätzlicher
// Schalter kann sie über die Folienbreite schieben — der gebündelte
// Overflow-Checker misst nur nach UNTEN und sieht das nicht.
import { chromium } from "playwright";
const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3031";
const b = await chromium.launch();
let schlecht = 0;
for (const theme of ["light", "dark"] as const) {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/42`, { waitUntil: "networkidle" });
  await p.waitForFunction(
    "window.__slidev__ && window.__slidev__.nav.currentPage === 42",
    { timeout: 20000 },
  );
  await p.waitForTimeout(800);
  const r = (await p.evaluate(`(() => {
    const leg = document.querySelector(".mp-legend");
    if (!leg) return { fehler: "keine .mp-legend" };
    const lr = leg.getBoundingClientRect();
    const kinder = [...leg.children].map(c => ({ t: (c.textContent||"").trim().slice(0,28), r: Math.round(c.getBoundingClientRect().right) }));
    return {
      links: Math.round(lr.left), rechts: Math.round(lr.right),
      scrollW: leg.scrollWidth, clientW: leg.clientWidth,
      fensterW: window.innerWidth, kinder,
    };
  })()`)) as any;
  const ueber = r.rechts > r.fensterW || r.scrollW > r.clientW + 1;
  if (ueber) schlecht++;
  console.log(
    `[${theme}] Legende ${r.links}..${r.rechts} px (Fenster ${r.fensterW}), scrollW ${r.scrollW} vs clientW ${r.clientW} -> ${ueber ? "ÜBERLÄUFT" : "passt"}`,
  );
  console.log(
    `         letzte Elemente: ${r.kinder
      .slice(-3)
      .map((k: any) => `${k.t}@${k.r}`)
      .join("  ")}`,
  );
  await ctx.close();
}
await b.close();
process.exit(schlecht ? 1 : 0);
