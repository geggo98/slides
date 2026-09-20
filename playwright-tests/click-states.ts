// Steppt eine Folie durch alle Klick-Zustände und legt je Zustand einen
// Screenshot (Light + echtes Dark) ab. Zusätzlich misst es je Zustand den
// tiefsten sichtbaren Element-Rand innerhalb der Folie gegen 720 px — der
// Overflow-Checker des Skills sieht nur den UNgeklickten Zustand.
//
//   bun run playwright-tests/click-states.ts <slide|alias> [port] [--max N] [--out dir]
//
// <slide> ist eine Nummer oder ein routeAlias. Ohne --max wird die Klickzahl
// aus window.__slidev__.nav.clicksTotal gelesen.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const target = args[0];
const port = Number(args[1] && !args[1].startsWith("--") ? args[1] : 3041);
const maxArg = args.indexOf("--max");
const outArg = args.indexOf("--out");
const outDir =
  (outArg >= 0 ? args[outArg + 1] : undefined) ?? "playwright-tests/qa/clicks";
mkdirSync(outDir, { recursive: true });
if (!target) {
  console.error("usage: click-states.ts <slide|alias> [port] [--max N]");
  process.exit(2);
}

const browser = await chromium.launch();
for (const theme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/${target}?clicks=0`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForFunction(() => (window as any).__slidev__?.nav?.total > 0);
  await page.evaluate(async () => {
    await (document as any).fonts.load('12px "0xProto"');
    await (document as any).fonts.ready;
  });
  await page.waitForTimeout(600);
  const no: number = await page.evaluate(
    () => (window as any).__slidev__.nav.currentPage,
  );
  const total: number =
    maxArg >= 0
      ? Number(args[maxArg + 1])
      : await page.evaluate(
          () => (window as any).__slidev__.nav.clicksTotal ?? 0,
        );
  console.log(`[${theme}] slide ${no} (${target}) clicksTotal=${total}`);
  for (let c = 0; c <= total; c++) {
    if (c > 0) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1400);
    }
    const m = await page.evaluate((n) => {
      const root = document.querySelector(
        `[data-slidev-no="${n}"]`,
      ) as HTMLElement | null;
      if (!root) return { bottom: -1, right: -1, worst: "no slide root" };
      let bottom = 0;
      let right = 0;
      let worst = "";
      const layout = root.querySelector(".slidev-layout") as HTMLElement | null;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        if (el === layout || el.classList.contains("slidev-page")) continue;
        // Monacos interne Layer (lines-content, overflow-guard …) sind
        // virtuell riesig; der Editor selbst wird über .monaco-block gemessen.
        if (el.closest(".monaco-editor")) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (Number(cs.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom > bottom) {
          bottom = r.bottom;
          worst = `${el.tagName.toLowerCase()}.${el.className && typeof el.className === "string" ? el.className.split(" ")[0] : ""}`;
        }
        if (r.right > right) right = r.right;
      }
      return { bottom: Math.round(bottom), right: Math.round(right), worst };
    }, no);
    const flag = m.bottom > 720 || m.right > 1280 ? "  <-- OVERFLOW" : "";
    console.log(
      `  click ${c}: bottom=${m.bottom} right=${m.right} (${m.worst})${flag}`,
    );
    await page.screenshot({
      path: `${outDir}/${target}-c${c}-${theme}.png`,
    });
  }
  if (errors.length) console.log(`  pageerrors: ${errors.join(" | ")}`);
  await ctx.close();
}
await browser.close();
