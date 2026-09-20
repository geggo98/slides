/**
 * breakeven-sync-qa.ts — prüft, dass opusplan- und Codex-Rechner dasselbe
 * Szenario teilen (components/lib/scenarioState.ts) und beide samt Chart in
 * die Folie passen.
 *
 * 1. Folie 34 (opusplan) öffnen, Exec-Read auf 60 ziehen, per Client-Routing
 *    (nav.go — KEIN page.goto, das lädt die App neu und setzt den
 *    Modul-Zustand zurück) zur Codex-Folie wechseln und prüfen, dass der
 *    Regler dort 60 zeigt; dann Kontext dort ändern und zurück prüfen.
 * 2. Klicker-Rückgabe: TTL-Button klicken, ArrowRight, $clicks muss steigen.
 * 3. Screenshots beider Folien im letzten Klick-Zustand, Light + Dark, und
 *    Unterkante der Komponente < 720 px (Viewport 1280×720, Canvas 980×552,
 *    Skalierung ≈ 1,306). Regler-Zeilen der Codex-Folie: kein horizontaler
 *    Überlauf.
 *
 * Die Codex-Folie wird über den routeAlias `codex-effort-wechsel` gefunden
 * (heute 35, nach dem Einfügen der Erklärfolie 36); Fallback: ab 34 nach der
 * Folie mit `div.ce` suchen.
 *
 *   bun run playwright-tests/breakeven-sync-qa.ts [port]
 */
import { chromium, type Page } from "playwright";

const PORT = process.argv[2] ?? "3041";
const BASE = `http://localhost:${PORT}`;
const OPUS = 34;
let fehler = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler += 1;
}

const NAV_OK = "window.__slidev__ && window.__slidev__.nav";

// Ein vite-error-overlay einer ANDEREN Folie (Kompilierfehler, z. B. eine
// noch nicht vom Server erfasste Komponente) fängt sonst jeden Klick ab.
async function overlayWeg(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("vite-error-overlay").forEach((o) => o.remove());
  });
}

async function go(page: Page, no: number, clicks = 0) {
  await page.evaluate(
    ([n, c]) => (window as any).__slidev__.nav.go(n, c),
    [no, clicks],
  );
  await page.waitForFunction(
    (n) => (window as any).__slidev__.nav.currentPage === n,
    no,
    { timeout: 15000 },
  );
  await page.waitForTimeout(700); // Folien-Transition (0,5 s) abwarten
  await overlayWeg(page);
}

async function currentClicks(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = (window as any).__slidev__.nav.clicks;
    return typeof c === "number" ? c : (c?.value ?? -1);
  });
}

async function findCodexSlide(page: Page): Promise<number> {
  await page.goto(`${BASE}/codex-effort-wechsel`, { waitUntil: "networkidle" });
  await page.waitForFunction(NAV_OK, undefined, { timeout: 20000 });
  await page.waitForTimeout(500);
  await overlayWeg(page);
  const viaAlias = await page.evaluate(
    () => (window as any).__slidev__.nav.currentPage as number,
  );
  const hatCe = await page
    .locator(`[data-slidev-no="${viaAlias}"] div.ce`)
    .count();
  if (hatCe > 0) return viaAlias;
  for (let n = OPUS + 1; n <= OPUS + 6; n++) {
    await go(page, n);
    if ((await page.locator(`[data-slidev-no="${n}"] div.ce`).count()) > 0)
      return n;
  }
  throw new Error("Codex-Rechnerfolie nicht gefunden");
}

async function scale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector(
      ".slidev-page.slidev-page-active, #slide-content, .slidev-layout",
    ) as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 ? r.width / 980 : window.innerWidth / 980;
  });
}

const browser = await chromium.launch();

// ── 1. Sync + 2. Klicker ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  const CODEX = await findCodexSlide(page);
  console.log(`Codex-Rechnerfolie: ${CODEX}`);

  // Codex-Notiz im Default-Zustand (30 MTok) merken — die spätere Notiz muss
  // sich davon unterscheiden, sonst rechnet sie mit den Defaults statt mit dem
  // geteilten Wert.
  await go(page, CODEX, 0);
  const ce = page.locator(`[data-slidev-no="${CODEX}"] div.ce`);
  await ce.waitFor({ state: "visible", timeout: 15000 });
  const ceNoteDefault = (await ce.locator(".ce-note p").textContent()) ?? "";

  await go(page, OPUS, 0);
  const ob = page.locator(`[data-slidev-no="${OPUS}"] div.ob`);
  await ob.waitFor({ state: "visible", timeout: 15000 });
  const obRead = ob.locator("label.ob-slider", { hasText: "Exec-Read" });
  await obRead.locator("input").fill("60");
  await page.waitForTimeout(100);
  check(
    "opusplan: Exec-Read-Regler zeigt 60 M",
    (await obRead.locator(".ob-val").textContent())?.trim() === "60 M",
  );
  // „opusplan spart hier … € (−45 %)“ — die Zahl, die die Codex-Notiz
  // gleich als „opusplan schafft hier −45 %“ wiederholen muss.
  const obNote60 = (await ob.locator(".ob-note p").textContent()) ?? "";
  const obProzent = /\(−(\d+) %\)/.exec(obNote60)?.[1] ?? null;
  check(
    "opusplan: Notiz nennt die Ersparnis in Prozent",
    obProzent !== null,
    obNote60.slice(0, 80),
  );

  await go(page, CODEX, 0);
  const ceRead = ce.locator("label.ce-slider", { hasText: "Exec-Read" });
  check(
    "Codex: Exec-Read folgt (60 M)",
    (await ceRead.locator("input").inputValue()) === "60" &&
      (await ceRead.locator(".ce-val").textContent())?.trim() === "60 M",
    await ceRead
      .locator(".ce-val")
      .textContent()
      .then((t) => t?.trim() ?? ""),
  );
  const ceNote = (await ce.locator(".ce-note p").textContent()) ?? "";
  check(
    "Codex: Notiz rechnet mit dem geteilten Wert (weicht von der Default-Notiz ab)",
    ceNote.length > 20 && ceNote !== ceNoteDefault,
    ceNote.slice(0, 80),
  );
  check(
    `Codex: Notiz vergleicht live mit opusplan (−${obProzent} % wie auf Folie ${OPUS})`,
    obProzent !== null &&
      ceNote.includes(`opusplan schafft hier −${obProzent} %`),
    /opusplan schafft hier [−+]\d+ %/.exec(ceNote)?.[0] ?? "kein Vergleich",
  );
  await go(page, CODEX, 1);
  const ceNote1 = (await ce.locator(".ce-note p").textContent()) ?? "";
  check(
    "Codex: Notiz bei Step 1 nennt den geteilten Regler (60 MTok)",
    ceNote1.includes("Dein Regler: 60 MTok"),
    ceNote1.slice(0, 80),
  );
  await go(page, CODEX, 0);

  const ceCtx = ce.locator("label.ce-slider", { hasText: "Kontext" });
  await ceCtx.locator("input").fill("300");
  const ceN = ce.locator("label.ce-slider", { hasText: "Re-Plans" });
  await ceN.locator("input").fill("5");
  await page.waitForTimeout(100);

  await go(page, OPUS, 0);
  const obCtx = ob.locator("label.ob-slider", { hasText: "Kontext" });
  const obN = ob.locator("label.ob-slider", { hasText: "Re-Plans" });
  check(
    "opusplan: Kontext folgt (300k) und Re-Plans (5×)",
    (await obCtx.locator("input").inputValue()) === "300" &&
      (await obN.locator("input").inputValue()) === "5",
    `${await obCtx.locator(".ob-val").textContent()} / ${await obN.locator(".ob-val").textContent()}`,
  );
  const obNote = (await ob.locator(".ob-note p").textContent()) ?? "";
  check(
    "opusplan: Notiz nennt den geteilten Regler (60 MTok) bei Step 1",
    (
      await (async () => {
        await go(page, OPUS, 1);
        return (await ob.locator(".ob-note p").textContent()) ?? "";
      })()
    ).includes("Dein Regler: 60 MTok"),
    obNote.slice(0, 60),
  );

  // Klicker-Rückgabe: TTL-Button (Maus) → ArrowRight muss $clicks bewegen
  await go(page, OPUS, 0);
  await ob.locator(".ob-ttl button", { hasText: "5 min" }).click();
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  check(
    "opusplan: nach TTL-Klick geht ArrowRight an Slidev ($clicks 0 → 1)",
    (await currentClicks(page)) === 1,
    `clicks=${await currentClicks(page)}`,
  );
  await ob
    .locator("label.ob-slider", { hasText: "Exec-Out" })
    .locator("input")
    .click();
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  check(
    "opusplan: nach Regler-Klick geht ArrowRight an Slidev ($clicks 1 → 2)",
    (await currentClicks(page)) === 2,
    `clicks=${await currentClicks(page)}`,
  );
  // Codex: Modell-Pille klicken, dann ArrowRight
  await go(page, CODEX, 0);
  await ce.locator(".ce-modell button", { hasText: "Terra" }).click();
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  check(
    "Codex: nach Pillen-Klick geht ArrowRight an Slidev ($clicks 0 → 1)",
    (await currentClicks(page)) === 1,
    `clicks=${await currentClicks(page)}`,
  );
  await ctx.close();
}

// ── 3. Screenshots + Höhen ──────────────────────────────────────────────────
for (const scheme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  const CODEX = await findCodexSlide(page);
  const k = await scale(page);

  for (const [no, sel, name] of [
    [OPUS, "div.ob", "opusplan"],
    [CODEX, "div.ce", "codex"],
  ] as const) {
    const total = await page.evaluate((n) => {
      const nav = (window as any).__slidev__.nav;
      const slide = nav.slides?.value?.[n - 1] ?? nav.slides?.[n - 1];
      return slide?.meta?.slide?.frontmatter?.clicks ?? null;
    }, no);
    // letzter Klick: Frontmatter `clicks`, sonst so weit wie möglich
    await go(page, no, 0);
    const last = typeof total === "number" ? total : 3;
    await go(page, no, last);
    const comp = page.locator(`[data-slidev-no="${no}"] ${sel}`);
    await comp.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(400);
    const m = await comp.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const zeilen = Array.from(
        el.querySelectorAll(".ce-zeile, .ob-controls"),
      ).map((z) => {
        const zr = z.getBoundingClientRect();
        const kinder = Array.from(z.children).map((c) =>
          Math.round(c.getBoundingClientRect().right),
        );
        return {
          scrollW: z.scrollWidth,
          clientW: z.clientWidth,
          right: Math.round(zr.right),
          maxChildRight: Math.max(...kinder),
        };
      });
      const note = el
        .querySelector(".ce-note, .ob-note")
        ?.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        noteBottom: note?.bottom ?? 0,
        zeilen,
      };
    });
    const pfad = `playwright-tests/qa/breakeven-${name}-${scheme}.png`;
    await page.screenshot({ path: pfad });
    check(
      `[${scheme}] ${name} (Folie ${no}, clicks=${last}): Unterkante ${Math.round(m.bottom)} px < 720`,
      m.bottom < 720,
      `Komponente ${Math.round(m.height)} px real = ${Math.round(m.height / k)} px logisch (Skalierung ${k.toFixed(3)}), Notiz-Unterkante ${Math.round(m.noteBottom)} px`,
    );
    for (const [i, z] of m.zeilen.entries()) {
      check(
        `[${scheme}] ${name}: Regler-Zeile ${i + 1} ohne horizontalen Überlauf`,
        z.scrollW <= z.clientW + 1 && z.maxChildRight <= z.right + 1,
        `scrollW ${z.scrollW} / clientW ${z.clientW}, rechtestes Kind ${z.maxChildRight} / Zeile ${z.right}`,
      );
    }
    console.log(`   Screenshot: ${pfad}`);
  }

  // Codex bei erzwungenem Step 2 (Anti-Pattern + Warnbox), falls die Folie
  // heute noch weniger Klicks hat: Prop direkt am Vue-Instanz-Objekt setzen.
  await go(page, CODEX, 0);
  const ceEl = page.locator(`[data-slidev-no="${CODEX}"] div.ce`);
  const forced = await ceEl.evaluate((el) => {
    const inst = (el as any).__vueParentComponent;
    if (!inst) return null;
    try {
      inst.props.step = 2;
      return true;
    } catch {
      return false;
    }
  });
  if (forced) {
    await page.waitForTimeout(400);
    const m = await ceEl.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const warn = el.querySelector(".ce-note.warn") !== null;
      const anti = el.querySelector(".ce-row.ce-versteckt") === null;
      return { bottom: r.bottom, height: r.height, warn, anti };
    });
    await page.screenshot({
      path: `playwright-tests/qa/breakeven-codex-step2-${scheme}.png`,
    });
    check(
      `[${scheme}] codex Step 2 (erzwungen): Warnbox + Anti-Pattern sichtbar, Unterkante ${Math.round(m.bottom)} px < 720`,
      m.warn && m.anti && m.bottom < 720,
      `Komponente ${Math.round(m.height)} px real = ${Math.round(m.height / k)} px logisch`,
    );
  } else {
    console.log(
      `   [${scheme}] Step 2 nicht erzwingbar (kein __vueParentComponent)`,
    );
  }
  await ctx.close();
}

await browser.close();
console.log(fehler ? `\n${fehler} Fehler` : "\nalles grün");
process.exit(fehler ? 1 : 0);
