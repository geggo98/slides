/**
 * Prueft das Lightning-Talk-Deck in genau den Zustaenden, die der gebuendelte
 * Overflow-Checker nicht sieht.
 *
 * Der Checker aus dem /slidev-Skill misst jede Folie im UNgeklickten Zustand.
 * Dieses Deck hat vier Komponenten, die erst auf Klick etwas zeigen: die beiden
 * Schaetzfragen loesen ueber die Weiter-Taste auf, der Zeitstrahl wechselt das
 * Verfahren und loescht Objekte, die Balken haben Reiter, und die Live-Demo
 * rechnet erst nach dem Laden von libzstd. Jeder dieser Zustaende kann die
 * Folie ueber die Kante schieben, ohne dass es jemand bemerkt — abgeschnitten
 * wird im Praesentationsmodus ohne Scrollbalken und ohne Warnung.
 *
 * Ausserdem belegt das Skript, dass die Demo im Browser wirklich rechnet:
 * ohne echte Zahlen in den Balken waere die Folie eine Attrappe.
 *
 * ZWEI FALLEN, beide hier gemessen und beide teuer:
 *
 * - Slidev haelt die NACHBARFOLIEN gemountet. Ein Locator ohne Folienbezug
 *   trifft deshalb Elemente, die gar nicht sichtbar sind: auf Folie 1 fand
 *   sich die Schaetzfrage von Folie 4, und der Klick lief in einen Timeout.
 *   Alles laeuft deshalb ueber `[data-slidev-no="N"]`.
 * - Die Zahl der Folien steht in `__slidev__.nav.total`. Ueber /print zu
 *   zaehlen ergab 2 statt 14, weil der Selektor beim ersten Treffer zuschlaegt,
 *   waehrend die uebrigen Folien noch rendern.
 *
 * Aufruf:  bun run playwright-tests/zstd-delta-interactive-check.ts [port]
 */
import { chromium, type Browser, type Locator, type Page } from "playwright";

const PORT = process.argv[2] ?? "3040";
const BASE = `http://localhost:${PORT}`;
const SLIDE_HEIGHT = 720;
const SLIDE_WIDTH = 1280;

/**
 * Mit `--offline` werden die Google-Schriften blockiert. Das Headmatter zieht
 * Inter zur Laufzeit; faellt sie aus, rendert der Saal mit einer System-Schrift
 * anderer Metrik — und die Overflow-Abnahme von vorhin gilt nicht mehr. Der
 * Lauf beantwortet, ob das Deck auch ohne Netz in die Kante passt.
 */
const OFFLINE = process.argv.includes("--offline");

interface Finding {
  slide: number;
  state: string;
  theme: string;
  detail: string;
}

const findings: Finding[] = [];
const notes: string[] = [];

function report(slide: number, state: string, theme: string, detail: string) {
  findings.push({ slide, state, theme, detail });
}

/** Misst die sichtbaren Elemente GENAU DIESER Folie gegen die Kante. */
async function measure(
  page: Page,
  slide: number,
  state: string,
  theme: string,
) {
  const overflow = await page.evaluate(
    ({ limit, width, no }) => {
      const root = document.querySelector(`[data-slidev-no="${no}"]`);
      if (!root) return [{ tag: "fehlt", cls: "", bottom: 0, right: 0 }];
      const out: { tag: string; cls: string; bottom: number; right: number }[] =
        [];
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (box.bottom > limit + 1 || box.right > width + 1) {
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className ?? "").slice(0, 60),
            bottom: Math.round(box.bottom),
            right: Math.round(box.right),
          });
        }
      }
      return out.slice(0, 4);
    },
    { limit: SLIDE_HEIGHT, width: SLIDE_WIDTH, no: slide },
  );

  for (const item of overflow) {
    report(
      slide,
      state,
      theme,
      `${item.tag}.${item.cls} bottom=${item.bottom} right=${item.right}`,
    );
  }
}

async function gotoSlide(page: Page, slide: number) {
  await page.goto(`${BASE}/${slide}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.ready;
  });
}

/**
 * Rohe Markdown-Zeichen im gerenderten Text.
 *
 * markdown-it parst KEIN Inline-Markdown, wenn es in einer einzeiligen
 * HTML-Zeile steht: `<div v-click>**fett**</div>` landet unveraendert auf der
 * Folie. Mit einer Leerzeile nach dem oeffnenden Tag wird es geparst, ohne
 * nicht. Der Overflow-Checker sieht das nie, denn die Geometrie stimmt ja —
 * gefunden hat es ein Mensch beim Ansehen der Folie. Deshalb diese Pruefung.
 */
async function checkRawMarkdown(page: Page, slide: number, theme: string) {
  const strays = await page.evaluate((no) => {
    const root = document.querySelector(`[data-slidev-no="${no}"]`);
    if (!root) return [];
    const text = (root as HTMLElement).innerText ?? "";
    const found: string[] = [];
    for (const pattern of [
      /\*\*[^*\n]+\*\*/g,
      /(?:^|\s)_[^_\n]+_(?:\s|$)/g,
      /`[^`\n]+`/g,
    ]) {
      for (const hit of text.matchAll(pattern))
        found.push(hit[0].trim().slice(0, 50));
    }
    return found.slice(0, 4);
  }, slide);

  for (const stray of strays) {
    report(
      slide,
      "markdown",
      theme,
      `unverarbeitetes Markdown im Text: ${stray}`,
    );
  }
}

async function checkGuess(
  page: Page,
  scope: Locator,
  slide: number,
  theme: string,
) {
  await scope.getByRole("radio").nth(0).click();
  await measure(page, slide, "getippt", theme);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  const value = await scope.locator(".guess-value").innerText();
  if (!value || Number(value.replace(",", ".")) === 0) {
    report(slide, "aufgeloest", theme, `Zaehler blieb bei ${value}`);
  }
  notes.push(`Folie ${slide}: Aufloesung zeigt ${value} (${theme})`);
  await measure(page, slide, "aufgeloest", theme);
}

async function checkTimeline(
  page: Page,
  scope: Locator,
  slide: number,
  theme: string,
) {
  const expire = scope.getByRole("button", { name: /Aufbewahrung/ });
  await expire.click();
  await expire.click();
  await measure(page, slide, "kette-geloescht", theme);
  const brokenInChain = await scope.locator(".rpt-broken").count();

  await scope.getByRole("button", { name: "Differenz", exact: true }).click();
  await page.waitForTimeout(200);
  await measure(page, slide, "differenz", theme);
  const brokenInDiff = await scope.locator(".rpt-broken").count();

  notes.push(
    `Folie ${slide}: nach zwei Loeschungen Kette gebrochen=${brokenInChain}, Differenz gebrochen=${brokenInDiff} (${theme})`,
  );
  if (brokenInChain === 0) {
    report(
      slide,
      "kette",
      theme,
      "Kette meldet nach zwei Loeschungen keinen Bruch — die Aussage der Folie traegt nicht",
    );
  }
  await scope.getByRole("button", { name: /Zurücksetzen/ }).click();
}

async function checkBars(
  page: Page,
  scope: Locator,
  slide: number,
  theme: string,
) {
  const tabs = scope.getByRole("tab");
  const count = await tabs.count();
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(320);
    await measure(page, slide, `reiter-${i}`, theme);
  }
  notes.push(`Folie ${slide}: ${count} Reiter geprueft (${theme})`);
}

async function checkDemo(
  page: Page,
  scope: Locator,
  slide: number,
  theme: string,
) {
  await scope.locator(".demo-bars").waitFor({ timeout: 30_000 });
  const sizes = await scope.locator(".demo-value").allInnerTexts();
  if (sizes.length === 0 || sizes.some((text) => !text.trim())) {
    report(slide, "demo", theme, `Balken ohne Zahlen: ${sizes.join(" | ")}`);
  }
  notes.push(`Folie ${slide}: Demo rechnet [${sizes.join(" | ")}] (${theme})`);
  await measure(page, slide, "demo-geladen", theme);

  const slider = scope.locator(".demo-slider input");
  await slider.fill("320");
  await page.waitForTimeout(900);

  // Der Regler darf den Presenter-Klicker nicht behalten: ein
  // input[type=range] reagiert selbst auf die Pfeiltasten, und dann steht die
  // Folie still, waehrend der Vortragende drueckt. Genau dieser Fehler war
  // schon einmal in GuessReveal.
  const focused = await page.evaluate(
    () => document.activeElement?.tagName ?? "",
  );
  if (focused === "INPUT") {
    report(
      slide,
      "demo-fokus",
      theme,
      "Der Schieberegler behaelt den Fokus und verschluckt die Weiter-Taste",
    );
  }

  const viel = await scope.locator(".demo-value").allInnerTexts();
  notes.push(`Folie ${slide}: 320 Seiten -> [${viel.join(" | ")}] (${theme})`);
  await measure(page, slide, "demo-viel", theme);

  await slider.fill("12");
  await page.waitForTimeout(900);
  const gut = await scope.locator(".demo-value").last().innerText();
  await scope.getByRole("button", { name: /Stufe 3/ }).click();
  await page.waitForTimeout(1200);
  const falle = await scope.locator(".demo-value").last().innerText();
  notes.push(`Folie ${slide}: Stufe 9 ${gut} -> Stufe 3 ${falle} (${theme})`);
  if (gut === falle) {
    report(
      slide,
      "demo-falle",
      theme,
      "Die Falle zeigt keinen Unterschied — die Pointe der Folie faellt aus",
    );
  }
  await measure(page, slide, "demo-falle", theme);

  await scope.getByRole("button", { name: /Stufe 9/ }).click();
  await page.waitForTimeout(900);
  await scope.getByRole("button", { name: /SHA-256/ }).click();
  const ok = await scope
    .locator(".demo-ok")
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!ok)
    report(slide, "demo", theme, "SHA-256-Pruefung meldete kein Ergebnis");
  else notes.push(`Folie ${slide}: Rueckrechnung byteidentisch (${theme})`);
  await measure(page, slide, "demo-geprueft", theme);
}

async function checkDeck(
  browser: Browser,
  theme: "light" | "dark",
  total: number,
) {
  const context = await browser.newContext({
    viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    colorScheme: theme,
  });
  const page = await context.newPage();
  if (OFFLINE) {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
      route.abort(),
    );
  }
  // Slidev fordert im Headless-Chromium ein Wake Lock an, das dort nie gewaehrt
  // wird. Der Fehler stammt aus dem Rahmen, nicht aus dem Deck.
  const harmlos = OFFLINE
    ? /Wake Lock|ResizeObserver loop|ERR_FAILED|Failed to load resource/
    : /Wake Lock|ResizeObserver loop/;
  page.on("pageerror", (error) => {
    if (!harmlos.test(error.message))
      report(0, "pageerror", theme, error.message.slice(0, 160));
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !harmlos.test(message.text())) {
      report(0, "console", theme, message.text().slice(0, 160));
    }
  });

  for (let slide = 1; slide <= total; slide++) {
    await gotoSlide(page, slide);
    const scope = page.locator(`[data-slidev-no="${slide}"]`);
    await measure(page, slide, "ruhend", theme);
    await checkRawMarkdown(page, slide, theme);

    if ((await scope.locator(".guess").count()) > 0)
      await checkGuess(page, scope, slide, theme);
    if ((await scope.locator(".rpt").count()) > 0)
      await checkTimeline(page, scope, slide, theme);
    if ((await scope.locator(".bars").count()) > 0)
      await checkBars(page, scope, slide, theme);
    if ((await scope.locator(".demo").count()) > 0)
      await checkDemo(page, scope, slide, theme);
  }

  await context.close();
}

const browser = await chromium.launch();

// Wie viele Folien hat das Deck? Slidev fuehrt die Zahl selbst.
const probe = await browser.newPage();
await probe.goto(`${BASE}/1`, { waitUntil: "networkidle" });
const total = await probe.evaluate(() => {
  const nav = (window as unknown as Record<string, any>).__slidev__?.nav;
  return Number(nav?.total?.value ?? nav?.total ?? 0);
});
await probe.close();
if (!total) throw new Error("Slidev meldet keine Folienzahl");
console.log(`Deck auf ${BASE}, ${total} Folien.\n`);

for (const theme of ["light", "dark"] as const) {
  await checkDeck(browser, theme, total);
}
await browser.close();

for (const note of notes) console.log("  " + note);

if (findings.length === 0) {
  console.log(
    `\nKeine Befunde. ${total} Folien, beide Themes, alle Klickzustaende.`,
  );
  process.exit(0);
}

console.log(`\n${findings.length} Befunde:`);
for (const f of findings) {
  console.log(`  Folie ${f.slide} [${f.state}/${f.theme}] ${f.detail}`);
}
process.exit(1);
