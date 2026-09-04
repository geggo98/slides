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

// `soft`: Kollisionen nur berichten, nicht zählen. Gilt für den Detailmodus der
// Historien-Folie — dort sind alle 25 Namen ausdrücklich gewollt, und dass sie
// sich auf 250 px Höhe berühren, ist der Preis dafür, kein Fehler.
function report(where: string, boxes: Box[], soft = false) {
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
  else if (soft) console.log(`  ${hits.length} Überschneidungen (erwartet)`);
  else console.log(hits.join("\n"));
  return soft ? 0 : hits.length;
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

// Foliennummern sind nicht stabil: eine eingeschobene Folie verschiebt alles
// dahinter. Dieses Skript stand auf 40/41, während die Charts längst auf 42/43
// lagen — es brach dann mit „null is not an object" ab, weil `svg.mp-chart` auf
// der falschen Folie fehlt. Laut, aber die Meldung nennt die Ursache nicht.
// Deshalb steht die erwartete Überschrift daneben und wird geprüft.
const PARETO = Number(process.env.PARETO_SLIDE ?? 42);
const HISTORIE = Number(process.env.HISTORIE_SLIDE ?? 43);
const TITEL: Record<number, string> = {
  [PARETO]: "Welches Modell wofür? Die Datenlage",
  [HISTORIE]: "Zwei Monate Pareto-Front",
};

const goto = async (page: any, n: number) => {
  await page.goto(`${BASE}/${n}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    `window.__slidev__ && window.__slidev__.nav.currentPage === ${n}`,
    { timeout: 15000 },
  );
  await page.waitForTimeout(600);
  // Auf die SICHTBARE Folie scopen — Nachbarfolien sind mitgemountet, ein
  // globales `.slidev-layout h1` liefert die Überschrift der falschen.
  const h = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll(".slidev-layout")]
      .find((e) => e.offsetParent !== null);
    return el ? (el.querySelector("h1")?.textContent ?? "").trim() : null;
  })()`);
  const erwartet = TITEL[n];
  if (erwartet && h !== erwartet) {
    throw new Error(
      `Folie ${n} zeigt „${h}", erwartet „${erwartet}" — die Nummerierung hat sich verschoben. ` +
        `Mit PARETO_SLIDE=… HISTORIE_SLIDE=… überschreiben oder die Konstanten anpassen.`,
    );
  }
};

const browser = await chromium.launch();
let problems = 0;

for (const theme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();

  // --- Pareto-Folie (PARETO), aktueller Stand ---------------------------
  await goto(page, PARETO);
  problems += report(
    `[${theme}] Folie ${PARETO}`,
    await page.evaluate(collect("svg.mp-chart")),
  );
  if (SHOT)
    await page.screenshot({ path: `${OUT}/pareto-${PARETO}-${theme}.png` });

  // Pin auf claude-opus-5 und gpt-5.6-sol → Fehlerbalken müssen überlappen.
  //
  // Über das LABEL geklickt, nicht über das Hit-Target: Wo zwei Marker fast
  // aufeinanderliegen, verdeckt das später gerenderte Hit-Target (r=11) das
  // frühere vollständig, und der Klick landet beim Nachbarn. Das trifft
  // gpt-5.6-sol (5,66 €/73 %) unter gpt-6-astra (5,71 €/74 %) genauso wie
  // gpt-5.6-terra unter glm-5.3. Die Beschriftung ist für diese Punkte der
  // vorgesehene Griff — so steht es auch im CSS von ModelRoutingPareto.vue —,
  // und genau den prüft dieser Klick.
  //
  // Ein blockierter Klick ist ein BEFUND, kein Abbruchgrund: Genau so sieht es
  // aus, wenn ein Marker über einer fremden Beschriftung liegt. Deshalb kurzer
  // Timeout, Fehler zählen und weitermachen — sonst verdeckt der erste Treffer
  // alle übrigen Messungen dieses Laufs.
  for (const label of ["claude-opus-5", "gpt-5.6-sol"]) {
    try {
      await page.click(`svg.mp-chart text.mp-label[data-model="${label}"]`, {
        timeout: 4000,
      });
    } catch {
      const drueber = await page.evaluate(`(() => {
        const t = document.querySelector('svg.mp-chart text.mp-label[data-model="${label}"]');
        const b = t.getBoundingClientRect();
        const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return el?.getAttribute("aria-label") ?? el?.tagName ?? "?";
      })()`);
      console.log(
        `  ✗ Label ${label} nicht klickbar — verdeckt von: ${drueber}`,
      );
      problems++;
    }
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
    `[${theme}] Folie ${PARETO} + Fehlerbalken`,
    await page.evaluate(collect("svg.mp-chart")),
  );
  if (SHOT)
    await page.screenshot({ path: `${OUT}/pareto-${PARETO}-ci-${theme}.png` });

  // Abo-Overlay
  await page.click("button.mp-tg");
  await page.waitForTimeout(300);
  const ghosts = await page.evaluate(
    `document.querySelectorAll("svg.mp-chart circle.mp-old-pt").length`,
  );
  console.log(`  Geisterringe mit Abo-Overlay: ${ghosts} (erwartet 5)`);
  if (ghosts !== 5) problems++;
  problems += report(
    `[${theme}] Folie ${PARETO} + Abo-Overlay`,
    await page.evaluate(collect("svg.mp-chart")),
  );
  if (SHOT)
    await page.screenshot({ path: `${OUT}/pareto-${PARETO}-sub-${theme}.png` });

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
    await page.screenshot({
      path: `${OUT}/pareto-${PARETO}-sources-${theme}.png`,
    });
  await page.keyboard.press("Escape");

  // --- Historien-Folie (HISTORIE), alle Stationen -----------------------
  await goto(page, HISTORIE);
  // Die Stationszahl stand hier fest auf 7 und war seit Stand 8 falsch: der
  // Detailmodus-Teil unten lief dann auf der letzten STATION statt im
  // Detailmodus und meldete „nicht jeder Punkt ist beschriftet". Die Folie
  // weiß es selbst — `clicks:` im Frontmatter ist die Stationszahl, der letzte
  // Klick schaltet den Detailmodus.
  const stationen: number = await page.evaluate(
    `window.__slidev__.nav.clicksTotal?.value ?? window.__slidev__.nav.clicksTotal`,
  );
  console.log(`\n[${theme}] Historie: ${stationen} Stationen + Detailmodus`);
  for (let step = 0; step < stationen; step++) {
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
      `[${theme}] Folie ${HISTORIE} · Station ${step} (${date}, ${ghost} Geister)`,
      boxes,
    );
    if (SHOT)
      await page.screenshot({
        path: `${OUT}/history-${HISTORIE}-${theme}-${step}.png`,
      });
  }

  // Achter Klick: Detailmodus — alle Namen plus Fadenkreuz. Die Beschriftung
  // muss dann jeden Punkt der Station treffen, und zwei Pins müssen zwei
  // Fadenkreuze ergeben.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(450);
  const detail = await page.evaluate(`(() => {
    const svg = document.querySelector("svg.mh-chart");
    const pts = svg.querySelectorAll("circle[class*='front-pt'], rect[class*='dom-pt']").length;
    return {
      labels: svg.querySelectorAll("text.mh-label").length,
      pts,
      hits: svg.querySelectorAll("circle.mp-hit").length,
      toggleOn: !!document.querySelector("button.mh-tg.on"),
    };
  })()`);
  console.log(
    `\n[${theme}] Folie ${HISTORIE} · Detailmodus: ${detail.labels} Labels / ${detail.pts} Punkte, ` +
      `${detail.hits} Hit-Targets, Schalter ${detail.toggleOn ? "an" : "AUS"}`,
  );
  if (detail.labels !== detail.pts || detail.hits !== detail.pts) {
    console.log("  FEHLER: nicht jeder Punkt ist beschriftet/anklickbar");
    problems++;
  }
  if (!detail.toggleOn) {
    console.log("  FEHLER: Legenden-Schalter zeigt den Detailmodus nicht an");
    problems++;
  }

  for (const label of ["claude-opus-5", "gpt-5.6-luna"]) {
    await page.click(
      `svg.mh-chart circle.mp-hit[aria-label="Fadenkreuz für ${label}"]`,
    );
  }
  await page.waitForTimeout(250);
  const chs = await page.evaluate(
    `document.querySelectorAll("svg.mh-chart g.mp-ch").length`,
  );
  console.log(`  Fadenkreuze nach zwei Pins: ${chs} (erwartet 2)`);
  if (chs !== 2) problems++;
  problems += report(
    `[${theme}] Folie ${HISTORIE} · Detailmodus + 2 Pins`,
    await page.evaluate(collect("svg.mh-chart")),
    true,
  );
  if (SHOT)
    await page.screenshot({
      path: `${OUT}/history-${HISTORIE}-${theme}-detail.png`,
    });

  // Zurück: der Detailmodus muss wieder aus sein, die Pins weg.
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  const off = await page.evaluate(`(() => {
    const svg = document.querySelector("svg.mh-chart");
    return {
      ch: svg.querySelectorAll("g.mp-ch").length,
      hits: svg.querySelectorAll("circle.mp-hit").length,
      toggleOn: !!document.querySelector("button.mh-tg.on"),
    };
  })()`);
  console.log(
    `  Nach ←: ${off.ch} Fadenkreuze, ${off.hits} Hit-Targets, Schalter ${off.toggleOn ? "AN" : "aus"}`,
  );
  if (off.ch !== 0 || off.hits !== 0 || off.toggleOn) {
    console.log("  FEHLER: Detailmodus bleibt hängen");
    problems++;
  }

  // Zweiter Weg: Legenden-Schalter auf einer anderen Station. Das Label-Layout
  // wird je Station neu gerechnet, also muss auch v1 (21 Punkte) aufgehen.
  await page.click(".mh-tl-item:first-child .mh-tl-btn");
  await page.click("button.mh-tg");
  await page.waitForTimeout(400);
  const v1 = await page.evaluate(`(() => {
    const svg = document.querySelector("svg.mh-chart");
    return {
      date: document.querySelector(".mh-tl-item.active .mh-tl-date").textContent.trim(),
      labels: svg.querySelectorAll("text.mh-label").length,
      pts: svg.querySelectorAll("circle[class*='front-pt'], rect[class*='dom-pt']").length,
    };
  })()`);
  console.log(
    `  Schalter auf Station „${v1.date}": ${v1.labels} Labels / ${v1.pts} Punkte`,
  );
  if (v1.labels !== v1.pts) {
    console.log("  FEHLER: Detailmodus greift nur auf der letzten Station");
    problems++;
  }
  problems += report(
    `[${theme}] Folie ${HISTORIE} · Detailmodus Station 1`,
    await page.evaluate(collect("svg.mh-chart")),
    true,
  );
  if (SHOT)
    await page.screenshot({
      path: `${OUT}/history-${HISTORIE}-${theme}-detail-v1.png`,
    });

  await ctx.close();
}

await browser.close();
console.log(`\n=== ${problems} Probleme ===`);
process.exit(problems > 0 ? 1 : 0);
