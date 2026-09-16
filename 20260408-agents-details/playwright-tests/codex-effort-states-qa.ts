/**
 * codex-effort-states-qa.ts — prüft die Codex-Effort-Folie (routeAlias
 * codex-effort-wechsel) in den Zuständen, die der Overflow-Checker nicht
 * sieht: Klick 3 (Anti-Pattern; Klick 1 = Codex-Popup, 2 = zu), Regler-
 * Extreme, Cache-Schalter, alle vier Modelle — je Light und Dark, chromium. Misst wie der Checker: kein
 * Element der Folie darf unter 720 px oder rechts von 1280 px liegen.
 * Außerdem: der Link von Folie 33 landet auf der Folie, und nach einem
 * Regler-Klick schaltet ArrowRight die Folie weiter (Klicker-Test).
 *
 *   bun run 20260408-agents-details/playwright-tests/codex-effort-states-qa.ts [port]
 */
import { chromium, type Page } from "playwright";

const PORT = process.argv[2] ?? "3041";
const BASE = `http://localhost:${PORT}`;
const SLIDE = 35;
const SHOTS = "20260408-agents-details/playwright-tests/qa";

type State = {
  name: string;
  clicks: 0 | 3;
  model?: "Astra" | "Sol" | "Terra" | "Luna";
  faktor?: number;
  read?: number;
  replans?: number;
  cache?: boolean;
};

const STATES: State[] = [
  { name: "default-click3", clicks: 3 },
  { name: "sol-n0-click3", clicks: 3, replans: 0 },
  { name: "sol-n13-click3", clicks: 3, replans: 13 },
  { name: "sol-f1-click0", clicks: 0, faktor: 1 },
  { name: "sol-f1-click3", clicks: 3, faktor: 1 },
  { name: "cache-click0", clicks: 0, cache: true },
  { name: "cache-n0-click3", clicks: 3, cache: true, replans: 0 },
  { name: "cache-n13-click3", clicks: 3, cache: true, replans: 13 },
  { name: "astra-click0", clicks: 0, model: "Astra" },
  {
    name: "astra-f8-r120-n13-click3",
    clicks: 3,
    model: "Astra",
    faktor: 8,
    read: 120,
    replans: 13,
  },
  { name: "terra-click3", clicks: 3, model: "Terra" },
  { name: "luna-click0", clicks: 0, model: "Luna" },
  {
    name: "luna-f8-r5-click3",
    clicks: 3,
    model: "Luna",
    faktor: 8,
    read: 5,
    replans: 13,
  },
  {
    name: "luna-cache-f1-click3",
    clicks: 3,
    model: "Luna",
    cache: true,
    faktor: 1,
  },
];

async function gotoSlide(page: Page, clicks: number) {
  await page.goto(`${BASE}/${SLIDE}?clicks=${clicks}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(`[data-slidev-no="${SLIDE}"] .ce-controls`, {
    state: "visible",
  });
  await page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.ready;
  });
}

async function setRange(page: Page, label: string, value: number) {
  const input = page
    .locator(`[data-slidev-no="${SLIDE}"] .ce-slider`, { hasText: label })
    .locator("input");
  await input.evaluate((el, v) => {
    const i = el as HTMLInputElement;
    i.value = String(v);
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function measure(page: Page) {
  return page.evaluate((no) => {
    const root = document.querySelector(`[data-slidev-no="${no}"]`);
    if (!root) throw new Error("slide root missing");
    let maxBottom = 0;
    let maxRight = 0;
    let worst = "";
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom > maxBottom) {
        maxBottom = r.bottom;
        worst = `${el.tagName.toLowerCase()}.${el.className.toString().split(" ")[0]} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
      }
      if (r.right > maxRight) maxRight = r.right;
    }
    const note = root.querySelector<HTMLElement>(".ce-note p");
    const controls = root.querySelector<HTMLElement>(".ce-controls");
    const anti = root.querySelector<HTMLElement>(".ce-row.ce-versteckt");
    return {
      maxBottom: Math.round(maxBottom),
      maxRight: Math.round(maxRight),
      worst,
      noteHeight: note ? Math.round(note.getBoundingClientRect().height) : -1,
      noteText: note?.textContent?.trim() ?? "",
      controlsHeight: controls
        ? Math.round(controls.getBoundingClientRect().height)
        : -1,
      antiHidden: !!anti,
    };
  }, SLIDE);
}

let failures = 0;
const browser = await chromium.launch();
for (const scheme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) =>
    console.log(`  pageerror: ${e.message.slice(0, 120)}`),
  );

  for (const st of STATES) {
    await gotoSlide(page, st.clicks);
    if (st.model) {
      await page
        .locator(`[data-slidev-no="${SLIDE}"] .ce-modell button`, {
          hasText: st.model,
        })
        .click();
    }
    if (st.faktor !== undefined) await setRange(page, "Faktor", st.faktor);
    if (st.read !== undefined) await setRange(page, "Exec-Read", st.read);
    if (st.replans !== undefined) await setRange(page, "Re-Plans", st.replans);
    if (st.cache)
      await page.locator(`[data-slidev-no="${SLIDE}"] .ce-toggle`).click();
    await page.waitForTimeout(400); // Balken-Transition
    const m = await measure(page);
    // Note-Box: 12,5 px × 1,45 × 1,3 Skalierung ≈ 23,6 px je Zeile → 2 Zeilen ≈ 47, 3 Zeilen ≈ 71
    const noteLines = Math.round(m.noteHeight / 23.6);
    const bad =
      m.maxBottom > 720 ||
      m.maxRight > 1280 ||
      noteLines > 2 ||
      m.controlsHeight > 60;
    if (bad) failures++;
    console.log(
      `${bad ? "✗" : "✓"} [${scheme}] ${st.name.padEnd(26)} bottom=${m.maxBottom} right=${m.maxRight} note=${noteLines}L(${m.noteHeight}px) controls=${m.controlsHeight}px antiHidden=${m.antiHidden}${bad ? `  worst: ${m.worst}` : ""}`,
    );
    if (st.clicks === 3 && m.antiHidden) {
      failures++;
      console.log(`    ✗ Anti-Pattern-Zeile ist bei Klick 3 noch versteckt`);
    }
    if (st.clicks === 0 && !m.antiHidden) {
      failures++;
      console.log(`    ✗ Anti-Pattern-Zeile ist bei Klick 0 schon sichtbar`);
    }
    if (noteLines > 2) console.log(`    note: ${m.noteText}`);
    await page.screenshot({
      path: `${SHOTS}/codex-effort-${st.name}-${scheme}.png`,
    });
  }

  // Link von Folie 33 → Folie 35
  await page.goto(`${BASE}/33`, { waitUntil: "networkidle" });
  await page
    .locator('[data-slidev-no="33"] a', { hasText: "übernächste Folie" })
    .click();
  // Slidev routet den Alias als Pfad: /codex-effort-wechsel, nicht /35.
  await page
    .waitForURL(/\/(35|codex-effort-wechsel)(\?|$)/, { timeout: 5000 })
    .catch(() => {});
  const url33 = page.url();
  // Die slide-left-Transition läuft nach dem Routenwechsel noch — auf das Element warten.
  const mounted = await page
    .locator(`[data-slidev-no="${SLIDE}"] .ce-controls`)
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  const linkOk = /\/(35|codex-effort-wechsel)(\?|$)/.test(url33) && mounted;
  if (!linkOk) failures++;
  console.log(`${linkOk ? "✓" : "✗"} [${scheme}] Link Folie 33 → ${url33}`);

  // Klicker-Test: bei Klick 3 Regler anklicken, dann ArrowRight → nächste Folie (36), nicht Regler-Wert
  await gotoSlide(page, 3);
  const slider = page
    .locator(`[data-slidev-no="${SLIDE}"] .ce-slider`, { hasText: "Re-Plans" })
    .locator("input");
  await slider.click(); // setzt den Wert auf die Klickposition — das ist gewollt
  const before = await slider.inputValue(); // erst DANACH messen: ArrowRight darf ihn nicht ändern
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  const after = await slider.inputValue().catch(() => "n/a");
  const urlAfter = page.url();
  const klickerOk = /\/36(\?|$)/.test(urlAfter) && before === after;
  if (!klickerOk) failures++;
  console.log(
    `${klickerOk ? "✓" : "✗"} [${scheme}] Klicker: nach Regler-Klick ArrowRight → ${urlAfter} (Regler ${before}→${after})`,
  );

  await ctx.close();
}
await browser.close();
console.log(
  failures ? `\n✗ ${failures} Befund(e)` : "\n✓ alle Zustände sauber",
);
process.exit(failures ? 1 : 0);
