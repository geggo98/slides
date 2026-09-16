/**
 * codex-scope-popup-qa.ts — prüft das ⓘ-Popup mit dem Codex-Dialog „Apply
 * reasoning change“ auf der Codex-Effort-Folie (routeAlias codex-effort-
 * wechsel), Light und Dark, chromium + firefox + webkit (wie der Checker;
 * `--browsers a,b` grenzt ein):
 *   - Klick-Choreografie per ArrowRight: 1 öffnet, 2 schließt, 3 Anti-Pattern,
 *     4 nächste Folie; zurück auf 1 öffnet wieder; Deep-Links ?clicks=1/2/3.
 *   - Escape schließt auch, wenn das Popup schon offen MOUNTET (Deep-Link auf
 *     Klick 1, Reload) — BunPopover braucht dafür den `immediate`-Watcher.
 *   - ⓘ-Handschalter: öffnet bei Klick 0, Fokus liegt danach nicht auf dem
 *     Button, ArrowRight schaltet weiter; Escape, Klick auf Karte, Klick auf
 *     den Nachbau schließen.
 *   - Geometrie: Karte und Pane innerhalb 1280×720; erste Beschreibung ein-
 *     zeilig mit ≥ 1 ch Reserve (je Engine neu gemessen, damit eine Textände-
 *     rung die schrumpfende Reserve zeigt statt gleich umzubrechen), zweite
 *     dreizeilig; Zeilen per Range gezählt (skalierungsunabhängig);
 *     Beschreibungsspalten beider Zeilen bündig; Farben der Zeilen.
 *   - Sprung nach /36 und zurück: Folie steht auf Klick 3, Popup zu.
 * Nur Publikumsansicht (Play-Seiten senden keinen Nav-Zustand an andere
 * Clients). Die Presenter-Vorschau prüft codex-scope-presenter-qa.ts auf
 * einem eigenen Server.
 *
 *   bun run 20260408-agents-details/playwright-tests/codex-scope-popup-qa.ts [port] [--browsers chromium,webkit]
 */
import { chromium, firefox, webkit, type Page } from "playwright";

const args = process.argv.slice(2);
const PORT = args.find((a) => /^\d+$/.test(a)) ?? "3041";
const bflag = args.find((a) => a.startsWith("--browsers"));
const ENGINES = (
  bflag
    ? bflag.includes("=")
      ? bflag.split("=")[1]
      : args[args.indexOf(bflag) + 1]
    : "chromium,firefox,webkit"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LAUNCHERS = { chromium, firefox, webkit } as const;
const BASE = `http://localhost:${PORT}`;
const SLIDE = 35;
const SHOTS = "20260408-agents-details/playwright-tests/qa";
const ROOT = `[data-slidev-no="${SLIDE}"]`;

let failures = 0;
function check(ok: boolean, label: string, extra = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? `  ${extra}` : ""}`);
}

async function gotoSlide(page: Page, clicks: number) {
  await page.goto(`${BASE}/${SLIDE}?clicks=${clicks}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(`${ROOT} .ce-controls`, { state: "visible" });
  await page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.ready;
  });
  await page.waitForTimeout(150);
}

const overlay = (page: Page) => page.locator(`${ROOT} .bun-pop-overlay`);
const isOpen = (page: Page) => overlay(page).isVisible();
const antiHidden = (page: Page) =>
  page
    .locator(`${ROOT} .ce-row.ce-versteckt`)
    .count()
    .then((n) => n > 0);

async function geometry(page: Page) {
  return page.evaluate((root) => {
    const q = (s: string) =>
      document.querySelector<HTMLElement>(`${root} ${s}`);
    const card = q(".bun-pop-card")!.getBoundingClientRect();
    const pane = q(".crs-pane")!.getBoundingClientRect();
    const descs = [
      ...document.querySelectorAll<HTMLElement>(`${root} .crs-pane .cxp-desc`),
    ];
    const names = [
      ...document.querySelectorAll<HTMLElement>(`${root} .crs-pane .cxp-name`),
    ];
    const markers = [
      ...document.querySelectorAll<HTMLElement>(
        `${root} .crs-pane .cxp-marker`,
      ),
    ];
    const cs = (el: HTMLElement) => getComputedStyle(el);
    // Zeilen über die Zeilenboxen des Textes zählen — unabhängig von Slidevs
    // Canvas-Skalierung und von WebKits etwas kürzeren Zeilenboxen.
    const lines = (el: HTMLElement) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const tops = new Set<number>();
      for (const rc of Array.from(r.getClientRects()))
        if (rc.width > 0) tops.add(Math.round(rc.top));
      return tops.size;
    };
    // Reserve der ersten Beschreibung in ch: Zellenbreite minus Tintenbreite,
    // ch aus einem 100×"0"-Probe-Span in derselben Schrift.
    const probe = document.createElement("span");
    probe.textContent = "0".repeat(100);
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap";
    descs[0].appendChild(probe);
    const ch = probe.getBoundingClientRect().width / 100;
    probe.remove();
    const ink = document.createRange();
    ink.selectNodeContents(descs[0]);
    const inkW = Array.from(ink.getClientRects()).reduce(
      (w, rc) => w + rc.width,
      0,
    );
    const slackCh =
      Math.round(((descs[0].getBoundingClientRect().width - inkW) / ch) * 100) /
      100;
    return {
      card: {
        l: Math.round(card.left),
        t: Math.round(card.top),
        r: Math.round(card.right),
        b: Math.round(card.bottom),
      },
      pane: { r: Math.round(pane.right), b: Math.round(pane.bottom) },
      desc0Lines: lines(descs[0]),
      desc1Lines: lines(descs[1]),
      slackCh,
      descX: descs.map((d) => Math.round(d.getBoundingClientRect().left)),
      nameX: names.map((d) => Math.round(d.getBoundingClientRect().left)),
      rowTop: names.map((n, i) =>
        Math.round(
          n.getBoundingClientRect().top - descs[i].getBoundingClientRect().top,
        ),
      ),
      colors: names.map((n, i) => ({
        marker: cs(markers[i]).color,
        name: cs(n).color,
        nameWeight: cs(n).fontWeight,
        desc: cs(descs[i]).color,
        descWeight: cs(descs[i]).fontWeight,
      })),
      fontSize: cs(q(".crs-pane .cxp-root")!).fontSize,
      subtitle: q(".crs-pane .cxp-subtitle")?.textContent?.trim() ?? "",
      title: q(".crs-pane .cxp-title")?.textContent?.trim() ?? "",
      footer: q(".crs-pane .cxp-footer")?.textContent?.trim() ?? "",
      inert: q(".crs-pane")!.hasAttribute("inert"),
      texts: descs.map((d) => d.textContent?.trim() ?? ""),
    };
  }, ROOT);
}

for (const engine of ENGINES) {
  const launcher = LAUNCHERS[engine as keyof typeof LAUNCHERS];
  if (!launcher) throw new Error(`unbekannte Engine ${engine}`);
  const browser = await launcher.launch();
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: scheme,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) =>
      console.log(`  pageerror: ${e.message.slice(0, 120)}`),
    );
    console.log(`\n[${engine}·${scheme}]`);

    // --- Klick-Choreografie ---
    await gotoSlide(page, 0);
    check(
      !(await isOpen(page)) && (await antiHidden(page)),
      "Klick 0: Popup zu, Anti-Pattern versteckt",
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    check(await isOpen(page), "Klick 1: Popup offen");
    const g = await geometry(page);
    check(
      g.card.l >= 0 && g.card.t >= 0 && g.card.r <= 1280 && g.card.b <= 720,
      "Karte innerhalb 1280×720",
      JSON.stringify(g.card),
    );
    check(
      g.pane.r <= g.card.r && g.pane.b <= g.card.b,
      "Pane innerhalb der Karte",
    );
    check(
      g.desc0Lines === 1,
      "erste Beschreibung einzeilig",
      `${g.desc0Lines} Zeile(n), font ${g.fontSize}`,
    );
    check(g.slackCh >= 1, "Beschreibung 1 Reserve ≥ 1 ch", `${g.slackCh} ch`);
    check(
      g.desc1Lines === 3,
      "zweite Beschreibung dreizeilig",
      `${g.desc1Lines} Zeile(n)`,
    );
    check(
      g.descX[0] === g.descX[1] && g.nameX[0] === g.nameX[1],
      "Spalten bündig",
      `desc x ${g.descX}, name x ${g.nameX}`,
    );
    check(
      Math.abs(g.rowTop[0]) <= 1 && Math.abs(g.rowTop[1]) <= 1,
      "Name und Beschreibung auf gleicher Höhe",
      `Δtop ${g.rowTop}`,
    );
    const CYAN = "rgb(92, 194, 224)";
    check(
      g.colors[0].marker === CYAN &&
        g.colors[0].name === CYAN &&
        g.colors[0].desc === CYAN &&
        g.colors[0].nameWeight === "600" &&
        g.colors[0].descWeight === "600",
      "Zeile 1 komplett cyan, fett",
      JSON.stringify(g.colors[0]),
    );
    check(
      g.colors[1].marker === "rgba(0, 0, 0, 0)" &&
        g.colors[1].name === "rgb(237, 237, 237)" &&
        g.colors[1].desc === "rgb(122, 122, 122)" &&
        g.colors[1].nameWeight === "400",
      "Zeile 2 Name hell, Beschreibung dim, Marker unsichtbar",
      JSON.stringify(g.colors[1]),
    );
    check(g.title === "Apply reasoning change", "Titel", g.title);
    check(
      g.subtitle === "Choose where to apply extra high reasoning.",
      "Untertitel",
      g.subtitle,
    );
    check(
      g.footer === "Press enter to confirm or esc to go back",
      "Fußzeile",
      g.footer,
    );
    check(
      g.texts[0] === "Always use extra high reasoning in Plan mode.",
      "Beschreibung 1",
      g.texts[0],
    );
    check(
      g.texts[1] ===
        "Set the global default reasoning level and the Plan mode override. This replaces the current built-in Plan default (medium).",
      "Beschreibung 2",
      g.texts[1],
    );
    check(g.inert, "Pane ist inert");
    await page.screenshot({
      path: `${SHOTS}/codex-scope-popup-${engine}-${scheme}.png`,
    });
    await page.locator(`${ROOT} .crs-pane`).screenshot({
      path: `${SHOTS}/codex-scope-popup-pane-${engine}-${scheme}.png`,
    });

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    check(
      !(await isOpen(page)) && (await antiHidden(page)),
      "Klick 2: Popup zu, Anti-Pattern noch versteckt",
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    check(
      !(await isOpen(page)) && !(await antiHidden(page)),
      "Klick 3: Anti-Pattern sichtbar, Popup zu",
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    check(/\/36(\?|$)/.test(page.url()), "Klick 4: nächste Folie", page.url());
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    await page.waitForSelector(`${ROOT} .ce-controls`, { state: "visible" });
    // Slidev routet den Alias als Pfad: /codex-effort-wechsel statt /35.
    check(
      /\/(35|codex-effort-wechsel)(\?|$)/.test(page.url()) &&
        !(await isOpen(page)) &&
        !(await antiHidden(page)),
      "zurück: Folie 35 auf Klick 3, Popup zu",
      page.url(),
    );
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    check(
      await isOpen(page),
      "zwei Klicks zurück: Klick 1, Popup wieder offen",
    );

    // --- Deep-Links ---
    await gotoSlide(page, 1);
    check(await isOpen(page), "Deep-Link ?clicks=1 offen");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check(
      !(await isOpen(page)),
      "Escape schließt ein offen gemountetes Popup (Deep-Link)",
    );
    await gotoSlide(page, 1);
    await page.reload({ waitUntil: "networkidle" });
    await page
      .waitForSelector(`${ROOT} .bun-pop-overlay`, {
        state: "visible",
        timeout: 5000,
      })
      .catch(() => {});
    check(await isOpen(page), "nach Reload auf Klick 1 offen");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check(!(await isOpen(page)), "Escape schließt nach Reload");
    await gotoSlide(page, 2);
    check(
      !(await isOpen(page)) && (await antiHidden(page)),
      "Deep-Link ?clicks=2 zu",
    );
    await gotoSlide(page, 3);
    check(
      !(await isOpen(page)) && !(await antiHidden(page)),
      "Deep-Link ?clicks=3 Anti-Pattern",
    );

    // --- ⓘ-Handschalter ---
    await gotoSlide(page, 0);
    const ib = page.locator(`${ROOT} .crs-ib`);
    await ib.click();
    await page.waitForTimeout(100);
    const active = await page.evaluate(
      () => document.activeElement?.tagName ?? "",
    );
    check(await isOpen(page), "ⓘ bei Klick 0 öffnet");
    check(active !== "BUTTON", "Fokus nach ⓘ-Klick nicht auf Button", active);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    check(
      await isOpen(page),
      "ArrowRight nach ⓘ: Klick 1 erreicht, Popup bleibt offen (Schritt hat Vorrang)",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check(!(await isOpen(page)), "Escape schließt");
    // Klick auf ⓘ-Position bei offenem Popup: trifft das Overlay → schließt
    await ib.click({ force: true });
    await page.waitForTimeout(150);
    check(await isOpen(page), "ⓘ öffnet erneut (bei Klick 1)");
    // Overlay links neben der Karte — NICHT unten: dort liegt Slidevs
    // unsichtbare Nav-Leiste und frisst den Klick.
    await page.mouse.click(60, 360);
    await page.waitForTimeout(150);
    check(!(await isOpen(page)), "Klick aufs Overlay schließt");
    await gotoSlide(page, 1);
    check(await isOpen(page), "wieder offen (Deep-Link Klick 1)");
    await page
      .locator(`${ROOT} .crs-pane .cxp-option`)
      .first()
      .click({ force: true });
    await page.waitForTimeout(150);
    check(!(await isOpen(page)), "Klick auf den Nachbau (inert) schließt");
    await gotoSlide(page, 1);
    await page.locator(`${ROOT} .bun-pop-h`).click();
    await page.waitForTimeout(150);
    check(!(await isOpen(page)), "Klick auf die Karte schließt");
    await gotoSlide(page, 1);
    await ib.click({ force: true }); // liegt unter dem Overlay → Overlay-Klick
    await page.waitForTimeout(150);
    check(
      !(await isOpen(page)),
      "Klick auf die ⓘ-Position bei offenem Popup schließt",
    );

    await ctx.close();
  }
  await browser.close();
}
console.log(failures ? `\n✗ ${failures} Befund(e)` : "\n✓ Popup-QA sauber");
process.exit(failures ? 1 : 0);
