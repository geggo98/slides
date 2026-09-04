// Vorhergesagte gegen gemessene Label-Boxen — das Textmaß des Platzierers
// (`labelLayout.ts`, TEXT) im Browser nachmessen.
//
// Jedes Label trägt in `data-box` die Box, die der Platzierer angenommen hat
// (x y w h in SVG-Koordinaten, inklusive 2 px Rand). Hier wird sie mit der
// `getBoundingClientRect()` des Textes verglichen, zurückgerechnet in
// SVG-Koordinaten. Liegt das Modell daneben, sind die Unit-Tests wertlos —
// deshalb misst dieses Skript, statt zu vertrauen.
//
//   bun run playwright-tests/label-box-check.ts [port] [pfad] [praefix]
//   bun run playwright-tests/label-box-check.ts 3031 "42?clicks=1" mp
//   bun run playwright-tests/label-box-check.ts 3031 "43?clicks=8" mh
import { chromium } from "playwright";
import {
  inkFromCell,
  TEXT,
} from "../20260408-agents-details/components/labelLayout";

const port = process.argv[2] ?? "3031";
const url = process.argv[3] ?? "42?clicks=1";
const sel = process.argv[4] ?? "mp";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/${url}`, {
  waitUntil: "networkidle",
});
await page.waitForSelector(`svg.${sel}-chart text.${sel}-label`);
// 0xProto lädt asynchron; vor dem Laden misst man die Fallback-Monospace.
const fonts: string = await page.evaluate(
  `document.fonts.load('12px "0xProto"').then(() => document.fonts.ready).then(() => [...document.fonts].filter((f) => f.family.includes("0xProto")).map((f) => f.status).join(","))`,
);
if (!fonts.includes("loaded")) {
  console.log(
    `✗ 0xProto ist nicht geladen (${fonts || "kein @font-face"}) — Messung wäre die Fallback-Schrift`,
  );
  process.exit(2);
}
await page.waitForTimeout(300);

type Quad = [number, number, number, number];
type Row = {
  model: string;
  font: string;
  pred: Quad;
  meas: Quad;
};
const rows: Row[] = await page.evaluate(
  `(() => {
  const svg = [...document.querySelectorAll("svg.SEL-chart")]
    .find((e) => e.getBoundingClientRect().height > 0);
  const m = svg.getScreenCTM().inverse();
  const zu = (r) => {
    const p1 = svg.createSVGPoint(); p1.x = r.left; p1.y = r.top;
    const p2 = svg.createSVGPoint(); p2.x = r.right; p2.y = r.bottom;
    const a = p1.matrixTransform(m), c = p2.matrixTransform(m);
    return [a.x, a.y, c.x - a.x, c.y - a.y];
  };
  return [...svg.querySelectorAll("text.SEL-label")].map((t) => ({
    model: t.getAttribute("data-model"),
    font: getComputedStyle(t).fontSize,
    pred: (t.getAttribute("data-box") ?? "").split(" ").map(Number),
    meas: zu(t.getBoundingClientRect()),
  }));
})()`.replaceAll("SEL", sel),
);

// Die Vorhersage ist die Tintenbox plus 2 px Rand; gemessen wird die
// Glyphzelle — `inkFromCell()` rechnet sie mit denselben Konstanten zurück.
const PAD = TEXT.pad;
let worst = 0;
console.log(
  "Modell                 font   Δlinks  Δoben  Δbreite  Δhöhe   (gemessen minus vorhergesagt, ohne Rand)",
);
for (const r of rows.sort((a, b) => a.model.localeCompare(b.model))) {
  if (r.pred.length !== 4 || Number.isNaN(r.pred[0])) {
    console.log(`${r.model.padEnd(22)} ohne data-box`);
    continue;
  }
  const ink = inkFromCell({
    x: r.meas[0],
    y: r.meas[1],
    w: r.meas[2],
    h: r.meas[3],
  });
  const dl = ink.x - (r.pred[0] + PAD);
  const dt = ink.y - (r.pred[1] + PAD);
  const dw = ink.w - (r.pred[2] - 2 * PAD);
  const dh = ink.h - (r.pred[3] - 2 * PAD);
  worst = Math.max(worst, ...[dl, dt, dw, dh].map(Math.abs));
  const f = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1);
  console.log(
    `${r.model.padEnd(22)} ${r.font.padEnd(6)} ${f(dl).padStart(6)} ${f(dt).padStart(6)} ${f(dw).padStart(8)} ${f(dh).padStart(6)}`,
  );
}
console.log(`\ngrößte Abweichung: ${worst.toFixed(2)} px (Toleranz 1,5)`);
await b.close();
process.exit(worst > 1.5 ? 1 : 0);
