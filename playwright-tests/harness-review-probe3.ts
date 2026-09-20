// Review-Sonde 3: verdeckt eine deckende Label-Fläche (.ht-label-bg) einen
// Pfeil (Pfad oder Spitze) oder die Frontlinie? Schritte 1–3, beide
// Benchmarks, Default-Beschriftung. Abtastung entlang der Pfade in SVG-Einheiten.
import { chromium } from "playwright";

const BASE = "http://localhost:3041";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}/harness-tax`, { waitUntil: "networkidle" });
await page.waitForFunction(
  "window.__slidev__ && window.__slidev__.nav.total > 0",
  { timeout: 20000 },
);
await page.waitForTimeout(600);
const no = await page.evaluate("window.__slidev__.nav.currentPage");

const collect = `(() => {
  document.querySelector("vite-error-overlay")?.remove();
  const svg = document.querySelector("svg.ht-chart");
  const rects = [...svg.querySelectorAll("rect.ht-label-bg")].map((r, i) => ({
    x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height"),
    name: svg.querySelectorAll("text.ht-label")[i]?.getAttribute("data-model"),
  }));
  const inR = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  const out = [];
  const paths = [...svg.querySelectorAll(".ht-arrow path")];
  for (const p of paths) {
    const L = p.getTotalLength();
    const id = p.parentNode.querySelector("title")?.textContent?.slice(0, 25);
    for (let s = 0; s <= L; s += 2) {
      const pt = p.getPointAtLength(s);
      for (const r of rects) if (inR(pt.x, pt.y, r)) { out.push("Pfeil " + id + " unter Label " + r.name + " bei " + Math.round(100 * s / L) + "%"); s = L + 1; break; }
    }
  }
  const front = svg.querySelector(".ht-front-line");
  if (front && front.classList.contains("ht-front-on")) {
    const L = front.getTotalLength();
    for (let s = 0; s <= L; s += 2) {
      const pt = front.getPointAtLength(s);
      for (const r of rects) if (inR(pt.x, pt.y, r)) { out.push("Front unter Label " + r.name); s = L + 1; break; }
    }
  }
  return { rects: rects.length, out };
})()`;

for (const bench of ["swe", "tb"] as const) {
  if (bench === "tb") {
    await page.getByRole("button", { name: "Terminal-Bench 2.0" }).click();
    await page.waitForTimeout(250);
  }
  for (const step of [1, 2, 3]) {
    await page.evaluate(`window.__slidev__.nav.go(${no}, ${step})`);
    await page.waitForTimeout(350);
    const r = await page.evaluate(collect);
    console.log(bench, "step", step, JSON.stringify(r));
  }
}
await browser.close();
