// Überlappen sich Modell-Beschriftungen im Pareto-Chart? Der Overflow-Checker
// sieht das nicht — er prüft nur die Folienkante. Hier werden die echten
// Text-Bounding-Boxen gegeneinander geschnitten, dazu die Marker.
//
//   bun run 20260408-agents-details/playwright-tests/label-overlaps.ts [port] [slide]
import { chromium } from "playwright";

const port = process.argv[2] ?? "3031";
const slide = process.argv[3] ?? "42";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/${slide}?clicks=1`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(2000);

// Drittes Argument: den Kontingent-Toggle umlegen. Mit Overlay wandern die vier
// Claude-Punkte nach links — dort kann es anders eng werden als im Default.
if (process.argv[4] === "toggle") {
  await page.getByRole("button", { name: /Claude-Code-Kontingent/ }).click();
  await page.waitForTimeout(800);
}

const boxes = await page.evaluate(() => {
  // Nachbarfolien sind mitgemountet — deshalb auf das sichtbare Chart der
  // Pareto-Folie einschränken, sonst mischen sich fremde Beschriftungen ein.
  const chart = document.querySelector("svg.mp-chart, svg.mh-chart")!;
  const els = Array.from(chart.querySelectorAll("text[data-model]"));
  return els.map((e) => {
    const r = e.getBoundingClientRect();
    return {
      label: e.getAttribute("data-model")!,
      x1: r.left,
      x2: r.right,
      y1: r.top,
      y2: r.bottom,
    };
  });
});

console.log(`${boxes.length} Beschriftungen auf Folie ${slide}`);
let n = 0;
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i];
    const b = boxes[j];
    const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
    const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
    if (ox > 0 && oy > 0) {
      n++;
      console.log(
        `  ÜBERLAPPUNG ${ox.toFixed(0)}×${oy.toFixed(0)} px: ` +
          `${a.label} ⇄ ${b.label}`,
      );
    }
  }
}

// Knapp daneben ist auch schlecht: alles unter 6 px Abstand liest sich als ein
// Wort. Nur Paare melden, die sich auf derselben Zeile berühren.
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i];
    const b = boxes[j];
    const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
    if (oy <= 0) continue;
    const gap = Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2);
    if (gap > 0 && gap < 6) {
      console.log(`  ENG ${gap.toFixed(1)} px: ${a.label} ⇄ ${b.label}`);
    }
  }
}

console.log(n === 0 ? "✓ keine Überlappung" : `✗ ${n} Überlappung(en)`);
await browser.close();
process.exit(n === 0 ? 0 : 1);
