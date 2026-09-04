// Textmaße der Label-Schrift (0xProto) im Browser messen — NACH dem Laden.
//
// Gemessen am 04.09.2026: Der Deck-Font 0xProto lädt erst, wenn ein Text ihn
// braucht, und braucht dafür auf dem Dev-Server ~2 s. Wer direkt nach
// `networkidle` misst, vermisst die Fallback-Monospace (Menlo/SF Mono): 12,3 px
// statt 17,3 px Zellhöhe bei 11 px Schrift. Deshalb hier `document.fonts.load`
// und erst dann messen — Zelle (fontBoundingBox) und Tinte (actualBoundingBox)
// je Schriftgröße, dazu der Vorschub je Zeichen.
//
//   bun run playwright-tests/font-metrics.ts [port]
import { chromium } from "playwright";

const port = process.argv[2] ?? "3031";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/42?clicks=1`, {
  waitUntil: "networkidle",
});
await page.waitForSelector("svg.mp-chart text.mp-label");
const status = await page.evaluate(`(async () => {
  await document.fonts.load('12px "0xProto"');
  await document.fonts.ready;
  return [...document.fonts].map((f) => f.family + ":" + f.status).join(" ");
})()`);
console.log("Fonts:", status);

interface CanvasRow {
  px: number;
  s: string;
  adv: number;
  cellA: number;
  cellD: number;
  inkA: number;
  inkD: number;
}
interface SvgRow {
  s: string;
  f: number;
  adv: number;
  top: number;
  bottom: number;
}
const rows: { canvas: CanvasRow[]; svg: SvgRow[] } =
  await page.evaluate(`(() => {
  const c = document.createElement("canvas").getContext("2d");
  const out = [];
  for (const px of [10, 11, 12]) {
    c.font = px + 'px "0xProto"';
    for (const s of ["claude-opus-5", "gpt-5.6-luna", "gemini-3.8-flash", "glm-5.3", "x", "M"]) {
      const m = c.measureText(s);
      out.push({ px, s, adv: m.width / s.length / px,
        cellA: m.fontBoundingBoxAscent / px, cellD: m.fontBoundingBoxDescent / px,
        inkA: m.actualBoundingBoxAscent / px, inkD: m.actualBoundingBoxDescent / px });
    }
  }
  // Zum Vergleich: dieselben Zahlen für die SVG-Labels im Chart (getBBox).
  const svg = [...document.querySelectorAll("svg.mp-chart")].find((e) => e.getBoundingClientRect().height > 0);
  const lbl = [...svg.querySelectorAll("text.mp-label")].slice(0, 3).map((t) => {
    const bb = t.getBBox(); const y = +t.getAttribute("y"); const f = parseFloat(getComputedStyle(t).fontSize);
    return { s: t.textContent.trim(), f, adv: bb.width / t.textContent.trim().length / f, top: (y - bb.y) / f, bottom: (bb.y + bb.height - y) / f };
  });
  return { canvas: out, svg: lbl };
})()`);
console.log("\nCanvas (em): Vorschub, Zelle oben/unten, Tinte oben/unten");
for (const r of rows.canvas)
  console.log(
    `${String(r.px).padStart(3)}px ${r.s.padEnd(18)} adv ${r.adv.toFixed(3)}  cell ${r.cellA.toFixed(3)}/${r.cellD.toFixed(3)}  ink ${r.inkA.toFixed(3)}/${r.inkD.toFixed(3)}`,
  );
console.log("\nSVG-Labels (em): Vorschub, Zelle über/unter der Grundlinie");
for (const r of rows.svg)
  console.log(
    `${r.f}px ${r.s.padEnd(18)} adv ${r.adv.toFixed(3)}  cell ${r.top.toFixed(3)}/${r.bottom.toFixed(3)}`,
  );
await b.close();
