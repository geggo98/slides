// QA für das HarnessTax-Chart (Folie `harness-tax`, `HarnessTaxPareto.vue`):
// steppt die vier Klickschritte per ArrowRight durch, beide Benchmarks, Light
// und Dark, macht Screenshots nach playwright-tests/qa/ und misst
//   * Label-Überschneidungen (Label↔Label, Label↔Marker, Label↔Pfeiltext),
//     Tinte statt Glyphzelle wie pareto-label-qa.ts,
//   * Legendenbreite (nowrap — der Overflow-Checker sieht die Richtung nicht),
//   * Chart-Unterkante und Folien-Unterkante gegen 720 px,
//   * dass jede Pfeilspitze und jeder Pfeilanfang außerhalb der Marker liegt,
//   * dass die vorhergesagten `data-box`-Boxen die gemessene Tinte treffen.
//
// Aufruf: bun run playwright-tests/harness-chart-qa.ts [port] [--all]
//   --all  zusätzlich den Schalter „alle Namen" prüfen (Überlappungen dort
//          sind „weich": der Preis der Vollständigkeit, nur berichtet)

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { TEXT } from "../20260408-agents-details/components/labelLayout";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3041";
const ALL = process.argv.includes("--all");
const BASE = `http://localhost:${PORT}`;
const OUT = "playwright-tests/qa";
mkdirSync(OUT, { recursive: true });

type Box = {
  label: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pass?: string;
  forced?: string;
  leader?: string;
};
const tag = (b: Box) =>
  `${b.label}${b.pass ? ` [${b.pass}${b.forced === "yes" ? ",forced" : ""}${b.leader === "yes" ? ",leader" : ""}]` : ""}`;
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const collect = `(() => {
  const no = window.__slidev__.nav.currentPage;
  // Ein Vite-Fehler-Overlay (fremde Baustelle im selben Dev-Server) fängt
  // Klicks ab: Text merken, Overlay entfernen, weitermessen.
  let overlay = null;
  const ov = document.querySelector("vite-error-overlay");
  if (ov) { overlay = (ov.shadowRoot ? ov.shadowRoot.textContent : ov.textContent).replace(/\\s+/g, " ").slice(0, 200); ov.remove(); }
  const slide = document.querySelector('[data-slidev-no="' + no + '"]');
  const svg = slide && slide.querySelector("svg.ht-chart");
  if (!svg) return { fehler: "kein svg.ht-chart auf Folie " + no };
  const CA = ${TEXT.cellAscentEm}, CD = ${TEXT.cellDescentEm}, IA = ${TEXT.ascentEm}, ID = ${TEXT.descentEm};
  const boxes = [];
  const ctm = svg.getScreenCTM();
  const toScreen = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(ctm); return { x: p.x, y: p.y }; };
  const scale = ctm.a;
  let boxMiss = [];
  for (const t of svg.querySelectorAll("text.ht-label, text.ht-arrow-label")) {
    const r = t.getBoundingClientRect();
    const font = r.height / (CA + CD);
    const baseline = r.y + CA * font;
    const ink = { x: r.x, y: baseline - IA * font, w: r.width, h: (IA + ID) * font };
    const own = [...t.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    boxes.push({ label: own, kind: t.classList.contains("ht-arrow-label") ? "arrowlabel" : "label", ...ink, pass: t.getAttribute("data-pass"), forced: t.getAttribute("data-forced"), leader: t.getAttribute("data-leader") });
    // Vorhersage (data-box, viewBox-px) gegen Messung: die Tinte muss in der
    // vorhergesagten Box liegen (die hat 2 px Rand), sonst rechnet der
    // Platzierer mit einer anderen Schrift als der Browser.
    const db = (t.getAttribute("data-box") || "").split(" ").map(Number);
    if (db.length === 4) {
      const a = toScreen(db[0], db[1]); const b = toScreen(db[0] + db[2], db[1] + db[3]);
      const tol = 1.5;
      if (ink.x < a.x - tol || ink.y < a.y - tol || ink.x + ink.w > b.x + tol || ink.y + ink.h > b.y + tol)
        boxMiss.push(own + " ink=" + [ink.x, ink.y, ink.w, ink.h].map(v => v.toFixed(1)).join(",") + " box=" + [a.x, a.y, b.x - a.x, b.y - a.y].map(v => v.toFixed(1)).join(","));
    }
  }
  const markers = [];
  for (const g of svg.querySelectorAll("g.ht-pt")) {
    const p = g.querySelector("path");
    const r = p.getBoundingClientRect();
    const name = g.getAttribute("data-key");
    const m = { label: name, kind: "marker", x: r.x, y: r.y, w: r.width, h: r.height, dim: g.classList.contains("ht-dim") };
    boxes.push(m); markers.push(m);
  }
  // Pfeile: Spitze (erster Punkt des Kopf-Polygons) und Schaftanfang (M des
  // Pfads) müssen außerhalb jedes Markers liegen — gemessen als Abstand zur
  // Markermitte gegen das halbe Maß seiner Bounding-Box plus 1 px (die
  // Formen sind konvex und füllen die Box nur an den Achsen aus).
  const arrowHits = [];
  const arrowGaps = [];
  let arrows = 0;
  for (const g of svg.querySelectorAll("g.ht-arrow")) {
    arrows++;
    const poly = g.querySelector("polygon").getAttribute("points").trim().split(/\\s+/)[0].split(",").map(Number);
    const tip = toScreen(poly[0], poly[1]);
    const m = /^M([-\\d.]+),([-\\d.]+)/.exec(g.querySelector("path").getAttribute("d"));
    const start = toScreen(Number(m[1]), Number(m[2]));
    let nearest = Infinity;
    for (const mk of markers) {
      const cx = mk.x + mk.w / 2, cy = mk.y + mk.h / 2, half = Math.max(mk.w, mk.h) / 2;
      const dTip = Math.hypot(tip.x - cx, tip.y - cy), dStart = Math.hypot(start.x - cx, start.y - cy);
      nearest = Math.min(nearest, dTip - half);
      if (dTip < half + 1) arrowHits.push("Spitze in " + mk.label + " (" + (dTip - half).toFixed(1) + " px)");
      if (dStart < half + 1) arrowHits.push("Anfang in " + mk.label + " (" + (dStart - half).toFixed(1) + " px)");
    }
    arrowGaps.push((nearest / scale).toFixed(1));
  }
  // Legende: clientWidth/scrollWidth sind CSS-px OHNE die Folien-Skalierung,
  // also logische px; die Kinder summiert plus Lücken ergeben den Bedarf.
  const leg = slide.querySelector(".ht-legend");
  const lr = leg.getBoundingClientRect();
  const kids = [...leg.children];
  const gap = parseFloat(getComputedStyle(leg).columnGap) || 0;
  const need = kids.reduce((a, k) => a + k.getBoundingClientRect().width, 0) / (lr.width / leg.clientWidth) + gap * (kids.length - 1);
  const chart = svg.getBoundingClientRect();
  let bottom = 0;
  for (const el of slide.querySelectorAll(".slidev-layout > *")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && getComputedStyle(el).visibility !== "hidden") bottom = Math.max(bottom, r.bottom);
  }
  return {
    boxes, boxMiss, arrows, arrowHits, arrowGaps, scale, overlay,
    step: svg.getAttribute("data-step"), bench: svg.getAttribute("data-bench"),
    dropped: svg.getAttribute("data-dropped"),
    note: (slide.querySelector(".ht-note") || {}).textContent,
    legend: { left: lr.left, right: lr.right, scrollW: leg.scrollWidth, clientW: leg.clientWidth, need },
    chartBottom: chart.bottom, slideBottom: bottom, win: window.innerWidth,
    clicks: window.__slidev__.nav.clicks,
    dimmed: markers.filter(m => m.dim).length,
  };
})()`;

function report(where: string, boxes: Box[], soft: boolean): number {
  const labels = boxes.filter(
    (b) => b.kind === "label" || b.kind === "arrowlabel",
  );
  const marks = boxes.filter((b) => b.kind === "marker");
  const hits: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (overlap(labels[i], labels[j]))
        hits.push(`  label/label  ${tag(labels[i])}  ×  ${tag(labels[j])}`);
    }
    for (const m of marks) {
      // Das eigene Klickziel: der Marker, dessen Modell·Harness das Label trägt,
      // ist im Default nicht erkennbar (Label = Modell). Ein Label DARF seinen
      // eigenen Marker nicht überdecken — also zählen alle.
      if (overlap(labels[i], m))
        hits.push(`  label/marker ${tag(labels[i])}  ×  ${m.label}`);
    }
  }
  for (let i = 0; i < marks.length; i++) {
    for (let j = i + 1; j < marks.length; j++) {
      if (overlap(marks[i], marks[j]))
        hits.push(`  marker/marker ${marks[i].label}  ×  ${marks[j].label}`);
    }
  }
  console.log(`${where}: ${labels.length} Labels, ${marks.length} Marker`);
  if (!hits.length) console.log("  OK — keine Überschneidung");
  else if (soft)
    console.log(
      `  ${hits.length} Überschneidungen (weich, „alle Namen")\n${hits.join("\n")}`,
    );
  else console.log(hits.join("\n"));
  return soft ? 0 : hits.length;
}

const browser = await chromium.launch();
let problems = 0;
const LOG = 900; // logische Breite, die die Legende nicht überschreiten darf

for (const theme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) =>
    console.log(`  [pageerror ${theme}] ${e.message}`),
  );
  await page.goto(`${BASE}/harness-tax`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    "window.__slidev__ && window.__slidev__.nav.total > 0",
    { timeout: 20000 },
  );
  const fonts: string = await page.evaluate(
    `document.fonts.load('12px "0xProto"').then(() => document.fonts.ready).then(() => [...document.fonts].filter((f) => f.family.includes("0xProto")).map((f) => f.status).join(","))`,
  );
  if (!fonts.includes("loaded"))
    throw new Error(`0xProto nicht geladen (${fonts})`);
  await page.waitForTimeout(700);
  const no = await page.evaluate("window.__slidev__.nav.currentPage");
  console.log(`\n===== ${theme} — Folie ${no} =====`);

  for (const bench of ["swe", "tb"] as const) {
    if (bench === "tb") {
      await page.getByRole("button", { name: "Terminal-Bench 2.0" }).click();
      await page.waitForTimeout(250);
    }
    // Zurück auf Klick 0 (die Folie bleibt), dann vorwärts.
    await page.evaluate(`window.__slidev__.nav.go(${no}, 0)`);
    await page.waitForTimeout(250);
    for (let step = 0; step <= 4; step++) {
      if (step > 0) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(350);
      }
      const r = (await page.evaluate(collect)) as any;
      if (r.fehler) throw new Error(r.fehler);
      if (r.overlay)
        console.log(`  (vite-error-overlay entfernt: ${r.overlay})`);
      const where = `${bench} step ${step} (${theme})`;
      if (r.clicks !== step)
        console.log(`  !! clicks=${r.clicks}, erwartet ${step}`);
      if (String(r.step) !== String(Math.min(step, 4)))
        console.log(`  !! data-step=${r.step}`);
      problems += report(where, r.boxes, false);
      if (r.boxMiss.length) {
        console.log(
          `  data-box passt nicht zur Tinte:\n    ${r.boxMiss.join("\n    ")}`,
        );
        problems += r.boxMiss.length;
      }
      if (r.arrowHits.length) {
        console.log(`  Pfeile in Markern: ${r.arrowHits.join("; ")}`);
        problems += r.arrowHits.length;
      }
      const legOver =
        r.legend.right > r.win ||
        r.legend.scrollW > r.legend.clientW + 1 ||
        r.legend.need > LOG;
      if (legOver) problems++;
      console.log(
        `  Pfeile ${r.arrows} (Abstand Spitze→Marker min ${r.arrowGaps.join("/")} px), gedimmt ${r.dimmed}, Note „${(r.note || "").trim()}", ohne Namen: ${r.dropped ? r.dropped.split(" | ").length : 0}` +
          `\n  Legende braucht ${r.legend.need.toFixed(0)} von ${r.legend.clientW} logischen px (scroll ${r.legend.scrollW}) ${legOver ? "ÜBERLÄUFT" : "passt"}` +
          `, Chart-Unterkante ${r.chartBottom.toFixed(0)} px, Folien-Unterkante ${r.slideBottom.toFixed(0)} px${r.slideBottom > 720 ? " ÜBERLÄUFT" : ""}`,
      );
      if (r.slideBottom > 720) problems++;
      await page.screenshot({
        path: `${OUT}/harness-${bench}-step${step}-${theme}.png`,
      });
    }

    if (ALL) {
      // „alle Namen" bleibt über die Klickschritte an — Schritt 2 dimmt Codex
      // und nimmt den gedimmten Punkten das Label; die Kostenfaktoren dürfen
      // dann nicht unter einem Modellnamen liegen.
      await page.evaluate(`window.__slidev__.nav.go(${no}, 1)`);
      await page.waitForTimeout(250);
      await page.getByRole("button", { name: "alle Namen" }).click();
      await page.waitForTimeout(350);
      for (const step of [1, 2, 3]) {
        await page.evaluate(`window.__slidev__.nav.go(${no}, ${step})`);
        await page.waitForTimeout(350);
        const r = (await page.evaluate(collect)) as any;
        if (r.fehler) throw new Error(r.fehler);
        report(`${bench} alle Namen step ${step} (${theme})`, r.boxes, true);
        console.log(
          `  Pfeile ${r.arrows}, gedimmt ${r.dimmed}, ohne Namen: ${r.dropped ? r.dropped.split(" | ").length : 0}`,
        );
        if (r.boxMiss.length)
          console.log(
            `  data-box passt nicht zur Tinte:\n    ${r.boxMiss.join("\n    ")}`,
          );
        // Ein Kostenfaktor unter einem Modellnamen ist auch hier hart.
        const al = r.boxes.filter((b: Box) => b.kind === "arrowlabel");
        const lb = r.boxes.filter((b: Box) => b.kind === "label");
        for (const a of al)
          for (const l of lb)
            if (overlap(a, l)) {
              console.log(`  !! Pfeiltext ${a.label} unter Label ${l.label}`);
              problems++;
            }
        await page.screenshot({
          path: `${OUT}/harness-${bench}-allnames-step${step}-${theme}.png`,
        });
      }
      await page.getByRole("button", { name: "alle Namen" }).click();
      await page.waitForTimeout(200);
    }

    // Harness-Hervorhebung: Swatch-Klick dimmt die anderen, ArrowRight hebt auf.
    await page.evaluate(`window.__slidev__.nav.go(${no}, 1)`);
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /^Pi$/ }).click();
    await page.waitForTimeout(300);
    let r = (await page.evaluate(collect)) as any;
    console.log(
      `  Hervorhebung Pi: gedimmt ${r.dimmed} (erwartet 14), Note „${(r.note || "").trim()}"`,
    );
    if (r.dimmed !== 14) problems++;
    await page.screenshot({
      path: `${OUT}/harness-${bench}-hl-pi-${theme}.png`,
    });
    const focused = await page.evaluate(
      "document.activeElement && document.activeElement.tagName",
    );
    if (focused === "BUTTON") {
      console.log(
        "  !! Button behält den Fokus nach dem Klick (Klicker-Falle)",
      );
      problems++;
    }
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    r = (await page.evaluate(collect)) as any;
    console.log(
      `  nach ArrowRight: clicks ${r.clicks}, gedimmt ${r.dimmed} (erwartet 7 = Codex in Schritt 2)`,
    );
    if (r.clicks !== 2 || r.dimmed !== 7) problems++;
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${problems ? `${problems} Probleme` : "alles sauber"}`);
process.exit(problems ? 1 : 0);
