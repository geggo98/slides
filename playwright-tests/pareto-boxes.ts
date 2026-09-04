// Dumpt Label-Boxen und Marker-Positionen eines Modell-Routing-Charts in
// SVG-Koordinaten — damit Label-Offsets gerechnet statt geraten werden.
//
// `pareto-label-qa.ts` sagt, DASS zwei Dinge kollidieren; dieses Skript sagt,
// wohin das Label statt dessen soll. Zusammen sind es zwei Werkzeuge für einen
// Arbeitsgang: erst messen, dann die Zahl in `P(...)` schreiben, dann prüfen.
//
// Achtung beim Übertragen: `P()` nimmt **dy vor dx**. Ein vertauschtes Paar
// verschiebt das Label sauber in die falsche Richtung und sieht nach einem
// Rechenfehler aus.
//
//   bun run playwright-tests/pareto-boxes.ts [port] [pfad] [praefix] [klick]
//   bun run playwright-tests/pareto-boxes.ts 3031                      # Folie 42
//   bun run playwright-tests/pareto-boxes.ts 3031 "43?clicks=8" mh     # Historie
//   bun run playwright-tests/pareto-boxes.ts 3031 "42?clicks=1" mp button.mp-tg
//                                                    # mit Kontingent-Overlay
import { chromium } from "playwright";

const port = process.argv[2] ?? "3031";
const url = process.argv[3] ?? "42?clicks=1";
const sel = process.argv[4] ?? "mp";
const klick = process.argv[5];
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/${url}`, {
  waitUntil: "networkidle",
});
await page.waitForSelector(`svg.${sel}-chart text.${sel}-label`);
if (klick) {
  await page.click(klick);
  await page.waitForTimeout(400);
}

const daten = await page.evaluate(
  `(() => {
  const svg = document.querySelector("svg.SEL-chart");
  const m = svg.getScreenCTM().inverse();
  const zu = (r) => {
    const p1 = svg.createSVGPoint(); p1.x = r.left; p1.y = r.top;
    const p2 = svg.createSVGPoint(); p2.x = r.right; p2.y = r.bottom;
    const a = p1.matrixTransform(m), c = p2.matrixTransform(m);
    return { x1: +a.x.toFixed(1), y1: +a.y.toFixed(1), x2: +c.x.toFixed(1), y2: +c.y.toFixed(1) };
  };
  const labels = [...svg.querySelectorAll("text.SEL-label")].map((t) => ({
    model: t.getAttribute("data-model"), ...zu(t.getBoundingClientRect()),
  }));
  const marker = [...svg.querySelectorAll("circle.mp-hit")].map((c) => ({
    model: c.getAttribute("aria-label").replace("Fadenkreuz für ", ""),
    cx: +(+c.getAttribute("cx")).toFixed(1), cy: +(+c.getAttribute("cy")).toFixed(1),
  }));
  return { labels, marker };
})()`.replaceAll("SEL", sel),
);

const M = new Map(daten.marker.map((m) => [m.model, m]));
console.log(
  "Modell                  Marker        Label-Box (x1,y1)-(x2,y2)   Breite",
);
for (const l of daten.labels.sort((a, b) => a.x1 - b.x1)) {
  const m = M.get(l.model);
  console.log(
    `${l.model.padEnd(22)} ${String(m?.cx).padStart(6)},${String(m?.cy).padStart(5)}   ` +
      `(${String(l.x1).padStart(6)},${String(l.y1).padStart(5)})-(${String(l.x2).padStart(6)},${String(l.y2).padStart(5)})  ${(l.x2 - l.x1).toFixed(0)}`,
  );
}
console.log("\nMarker ohne Label:");
for (const m of daten.marker.filter(
  (m) => !daten.labels.some((l) => l.model === m.model),
))
  console.log(`  ${m.model.padEnd(22)} ${m.cx},${m.cy}`);
await b.close();
