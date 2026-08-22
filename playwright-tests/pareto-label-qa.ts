// Label-Kollisionen auf den beiden Modell-Routing-Charts finden.
//
// Von Hand lassen sich 19 bzw. 25 Punktbeschriftungen nicht zuverlässig
// platzieren — das Skript misst stattdessen die echten Bounding-Boxen im
// Browser und meldet jede Überschneidung Label↔Label und Label↔Marker.
//
// Aufruf: bun run playwright-tests/pareto-label-qa.ts [port] [--shot]

import { chromium } from "playwright";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3031";
const SHOT = process.argv.includes("--shot");
const BASE = `http://localhost:${PORT}`;
const OUT = "playwright-tests/qa";

type Box = {
  label: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function report(where: string, boxes: Box[]) {
  const labels = boxes.filter((b) => b.kind === "label");
  const marks = boxes.filter((b) => b.kind !== "label");
  const hits: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (overlap(labels[i], labels[j]))
        hits.push(`  label/label  ${labels[i].label}  ×  ${labels[j].label}`);
    }
    for (const m of marks) {
      if (m.label === labels[i].label) continue;
      if (overlap(labels[i], m))
        hits.push(`  label/marker ${labels[i].label}  ×  ${m.label}`);
    }
  }
  console.log(`\n${where}: ${labels.length} Labels, ${marks.length} Marker`);
  if (hits.length === 0) console.log("  OK — keine Überschneidung");
  else console.log(hits.join("\n"));
  return hits.length;
}

const collect = (sel: string) =>
  `(() => {
    const svg = document.querySelector("${sel}");
    if (!svg) return null;
    const out = [];
    for (const t of svg.querySelectorAll("text.mp-label, text.mh-label, text.mp-ci-badge")) {
      const r = t.getBoundingClientRect();
      out.push({ label: t.textContent.trim(), kind: "label", x: r.x, y: r.y, w: r.width, h: r.height });
    }
    for (const m of svg.querySelectorAll("circle[class*='front-pt'], rect[class*='dom-pt'], circle[class*='old-pt']")) {
      const r = m.getBoundingClientRect();
      const title = m.querySelector("title");
      const name = (title ? title.textContent : "").split(":")[0].trim() || "marker";
      out.push({ label: name, kind: "marker", x: r.x, y: r.y, w: r.width, h: r.height });
    }
    // Quadranten- und Achsenbeschriftung zählen als Hindernis: ein Modell-Label
    // darüber ist genauso unlesbar wie eines auf einem Marker.
    for (const q of svg.querySelectorAll("text[class*='-ql-'], text[class*='axis-title']")) {
      const r = q.getBoundingClientRect();
      out.push({ label: "«" + q.textContent.trim() + "»", kind: "chrome", x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  })()`;

const goto = async (page: any, n: number) => {
  await page.goto(`${BASE}/${n}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    `window.__slidev__ && window.__slidev__.nav.currentPage === ${n}`,
    { timeout: 15000 },
  );
  await page.waitForTimeout(600);
};

const browser = await chromium.launch();
let problems = 0;

for (const theme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();

  // --- Folie 40: Pareto, aktueller Stand -----------------------------------
  await goto(page, 40);
  problems += report(
    `[${theme}] Folie 40`,
    await page.evaluate(collect("svg.mp-chart")),
  );
  if (SHOT) await page.screenshot({ path: `${OUT}/pareto-40-${theme}.png` });

  // Pin auf claude-opus-5 und gpt-5.6-sol → Fehlerbalken müssen überlappen
  for (const label of ["claude-opus-5", "gpt-5.6-sol"]) {
    await page.click(
      `svg.mp-chart circle.mp-hit[aria-label="Fadenkreuz für ${label}"]`,
    );
  }
  await page.waitForTimeout(250);
  const bars = await page.evaluate(`(() => {
    const g = [...document.querySelectorAll("svg.mp-chart g.mp-ci")];
    return g.map((x) => {
      const bar = x.querySelector("line.mp-ci-bar");
      return { y1: +bar.getAttribute("y1"), y2: +bar.getAttribute("y2") };
    });
  })()`);
  console.log(
    `  Fehlerbalken (SVG-y, kleiner = höherer Score):`,
    JSON.stringify(bars),
  );
  if (bars.length !== 2) {
    console.log("  FEHLER: erwartet zwei Fehlerbalken");
    problems++;
  } else {
    const [a, b] = bars.map((v: any) => [
      Math.min(v.y1, v.y2),
      Math.max(v.y1, v.y2),
    ]);
    const ok = a[0] < b[1] && b[0] < a[1];
    console.log(`  Intervalle überlappen: ${ok ? "ja" : "NEIN"}`);
    if (!ok) problems++;
  }
  problems += report(
    `[${theme}] Folie 40 + Fehlerbalken`,
    await page.evaluate(collect("svg.mp-chart")),
  );
  if (SHOT) await page.screenshot({ path: `${OUT}/pareto-40-ci-${theme}.png` });

  // Abo-Overlay
  await page.click("button.mp-tg");
  await page.waitForTimeout(300);
  const ghosts = await page.evaluate(
    `document.querySelectorAll("svg.mp-chart circle.mp-old-pt").length`,
  );
  console.log(`  Geisterringe mit Abo-Overlay: ${ghosts} (erwartet 5)`);
  if (ghosts !== 5) problems++;
  problems += report(
    `[${theme}] Folie 40 + Abo-Overlay`,
    await page.evaluate(collect("svg.mp-chart")),
  );
  if (SHOT)
    await page.screenshot({ path: `${OUT}/pareto-40-sub-${theme}.png` });

  // Quellen-Popover: scrollt bei Bedarf, darf aber nicht leer bleiben.
  await page.click("button.mp-tg"); // Overlay wieder aus
  await page.click("button.mp-ib");
  await page.waitForTimeout(250);
  const pop = await page.evaluate(`(() => {
    const card = document.querySelector(".bun-pop-card");
    if (!card) return null;
    const li = [...card.querySelectorAll("li")].map((e) => e.textContent.trim());
    return { count: li.length, links: [...card.querySelectorAll("a")].map((a) => a.getAttribute("href")) };
  })()`);
  console.log(`  Quellen-Popover: ${pop?.count ?? 0} Einträge`);
  for (const want of ["/changelog", "gpt-5.6-sol", "support.claude.com"]) {
    const hit = pop?.links?.some((h: string) => h.includes(want));
    console.log(`  Quelle ${want}: ${hit ? "da" : "FEHLT"}`);
    if (!hit) problems++;
  }
  if (SHOT)
    await page.screenshot({ path: `${OUT}/pareto-40-sources-${theme}.png` });
  await page.keyboard.press("Escape");

  // --- Folie 41: Historie, sieben Stationen --------------------------------
  await goto(page, 41);
  for (let step = 0; step <= 6; step++) {
    if (step > 0) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(450);
    }
    const boxes = await page.evaluate(collect("svg.mh-chart"));
    const date = await page.evaluate(
      `document.querySelector("svg.mh-chart") ? document.querySelector(".mh-tl-item.active .mh-tl-date").textContent.trim() : "?"`,
    );
    const ghost = await page.evaluate(
      `document.querySelectorAll("svg.mh-chart circle.mp-old-pt").length`,
    );
    problems += report(
      `[${theme}] Folie 41 · Station ${step} (${date}, ${ghost} Geister)`,
      boxes,
    );
    if (SHOT)
      await page.screenshot({ path: `${OUT}/history-41-${theme}-${step}.png` });
  }

  await ctx.close();
}

await browser.close();
console.log(`\n=== ${problems} Probleme ===`);
process.exit(problems > 0 ? 1 : 0);
