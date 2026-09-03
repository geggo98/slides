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
// `--clicks=N` für die Historien-Folie: dort ist jede Station ein eigener
// Klick-Stand mit eigener Punktmenge und eigenen Platzierungen.
const clicks =
  process.argv.find((a) => a.startsWith("--clicks="))?.split("=")[1] ?? "1";
await page.goto(`http://localhost:${port}/${slide}?clicks=${clicks}`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(2000);
// Auf den Webfont warten, SONST MISST DIESES SKRIPT DANEBEN. Die
// Beschriftungen stehen in 0xProto; solange der Fallback greift, sind die
// Textboxen rund 5 px flacher (14 statt 19), und Überlappungen von wenigen
// Pixeln verschwinden aus dem Ergebnis. Genau daran lag es, dass diese Folie
// „sauber" gemeldet wurde und mit Kontingent-Toggle — der einen Klick und damit
// Wartezeit mehr braucht — plötzlich sechs Überlappungen hatte.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

// Drittes Argument: den Kontingent-Toggle umlegen. Mit Overlay wandern die vier
// Claude-Punkte nach links — dort kann es anders eng werden als im Default.
if (process.argv[4] === "toggle") {
  await page.getByRole("button", { name: /Claude-Code-Kontingent/ }).click();
  await page.waitForTimeout(800);
}

// `--pick=<Name>` wählt vorher im Anbieter-Filter aus (nur Pareto-Folie). Beim
// Filtern werden dominierte Punkte zu Frontpunkten und tauschen ihr 9×9-Quadrat
// gegen einen Kreis mit r=5.5 — der Marker wächst also — und unterdrückte
// Beschriftungen kommen zurück. Beides kann neu kollidieren, deshalb prüfbar.
const pick = process.argv.find((a) => a.startsWith("--pick="))?.split("=")[1];
// `--untick=<Lab>` haakt danach ein Lab AB. Damit erreicht man den dichtesten
// beschrifteten Zustand überhaupt: fast alle Punkte, und weil ein Filter aktiv
// ist, zusätzlich die sonst unterdrückten DeepSeek-Beschriftungen.
const untick = process.argv
  .find((a) => a.startsWith("--untick="))
  ?.split("=")[1];
// `--only=<Lab>` lässt genau ein Lab stehen. `--pick` trifft nur Presets
// (Werkzeuge und „Alle"); Labs sind Checkboxen, kein Einzelziel.
const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
if (pick || untick || only) {
  const oeffnen = async () => {
    await page.getByRole("button", { name: /Anbieter filtern/ }).click();
    await page.waitForTimeout(250);
  };
  if (pick) {
    await oeffnen();
    await page.getByRole("menuitem", { name: new RegExp(`^${pick} `) }).click();
    await page.waitForTimeout(400);
  }
  if (untick) {
    await oeffnen();
    await page
      .getByRole("menuitemcheckbox", { name: new RegExp(`^${untick} `) })
      .click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  if (only) {
    // Ein einzelnes Lab ist kein Preset — es entsteht, indem man von „Alle"
    // aus alle anderen abwählt. Genau so muss es auch geprüft werden.
    await oeffnen();
    const boxen = await page.getByRole("menuitemcheckbox").all();
    for (const b of boxen) {
      const name = (await b.textContent())?.trim() ?? "";
      if (!name.startsWith(only)) await b.click();
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
}

const boxes = await page.evaluate(() => {
  // Nachbarfolien sind mitgemountet — deshalb auf das sichtbare Chart der
  // Pareto-Folie einschränken, sonst mischen sich fremde Beschriftungen ein.
  const chart = document.querySelector("svg.mp-chart, svg.mh-chart")!;
  const els = Array.from(chart.querySelectorAll("text[data-model]"));
  // getBoundingClientRect() liefert bei <text> die EM-BOX samt Durchschuss —
  // bei 10px 0xProto sind das 19px, während die Glyphen nur rund 7px hoch sind.
  // Damit meldete dieses Skript Zeilen als „überlappend", die auf dem Schirm
  // sichtbar auseinanderliegen. Für die Höhe zählt deshalb die Tinte:
  // measureText() gibt Ober- und Unterlänge der konkreten Zeichenkette, die
  // Grundlinie steht im y-Attribut und wird über die CTM auf den Schirm gerechnet.
  // Nebeneffekt: das Ergebnis hängt nicht mehr davon ab, ob der Webfont beim
  // Messen schon geladen war.
  // Marker mitnehmen: eine Beschriftung, auf der ein Punkt oder Quadrat sitzt,
  // ist genauso unlesbar wie zwei Beschriftungen übereinander — der Checker sah
  // das bisher nicht, weil er nur Text gegen Text prüfte.
  (window as unknown as Record<string, unknown>).__marker = [
    ...chart.querySelectorAll(
      "circle.mp-front-pt, rect.mp-dom-pt, circle.mh-front-pt, rect.mh-dom-pt",
    ),
  ].map((m) => {
    const r = m.getBoundingClientRect();
    return { x1: r.left, x2: r.right, y1: r.top, y2: r.bottom };
  });
  const ctm = (chart as SVGGraphicsElement).getScreenCTM()!;
  const cv = document.createElement("canvas").getContext("2d")!;
  return els.map((e) => {
    const t = e as SVGTextElement;
    const r = t.getBoundingClientRect();
    const cs = getComputedStyle(t);
    cv.font = `${cs.fontSize} ${cs.fontFamily}`;
    const m = cv.measureText(t.textContent?.trim() ?? "");
    const grundlinie = Number(t.getAttribute("y")) * ctm.d + ctm.f;
    return {
      label: t.getAttribute("data-model")!,
      x1: r.left,
      x2: r.right,
      y1: grundlinie - m.actualBoundingBoxAscent * ctm.d,
      y2: grundlinie + m.actualBoundingBoxDescent * ctm.d,
    };
  });
});

console.log(`${boxes.length} Beschriftungen auf Folie ${slide}`);

// `--dump` listet alle Boxen nach y sortiert. Beim Umplatzieren eines Labels ist
// Raten teuer: so sieht man, wo im Gedränge tatsächlich Platz frei ist.
if (process.argv.includes("--dump")) {
  for (const b of [...boxes].sort((p, q) => p.y1 - q.y1)) {
    console.log(
      `  ${b.label.padEnd(18)} x ${b.x1.toFixed(0).padStart(4)}–${b.x2
        .toFixed(0)
        .padStart(
          4,
        )}   y ${b.y1.toFixed(0).padStart(3)}–${b.y2.toFixed(0).padStart(3)}`,
    );
  }
}
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

// Text gegen Marker. Ein Marker ist 9–11 px groß; überlappt er eine
// Beschriftung um mehr als 2 px in beiden Achsen, steht er sichtbar im Wort.
const marker = await page.evaluate(
  () =>
    (window as unknown as Record<string, unknown>).__marker as {
      x1: number;
      x2: number;
      y1: number;
      y2: number;
    }[],
);
for (const b of boxes) {
  for (const m of marker) {
    const ox = Math.min(b.x2, m.x2) - Math.max(b.x1, m.x1);
    const oy = Math.min(b.y2, m.y2) - Math.max(b.y1, m.y1);
    if (ox > 2 && oy > 2) {
      n++;
      console.log(
        `  MARKER AUF TEXT ${ox.toFixed(0)}×${oy.toFixed(0)} px: ${b.label}`,
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
