/**
 * QA harness for CodexEffortTui.vue + CodexConfigToml.vue (agents-details).
 *
 * Two modes:
 *   - "iso" (default while the slide does not exist yet): mounts the two
 *     components in isolation on top of a loaded deck page. Vite serves the
 *     deck's components by URL (`/components/<Name>.vue`), so the harness
 *     fetches the transformed module, reuses the very same `vue` and
 *     `@slidev/client` URLs the component imports (same module instances as
 *     the running app), provides the four Slidev injections that
 *     useIsSlideActive needs, and mounts into a fixed-width box.
 *   - "slide": drives the real slide (route alias codex-effort) through the
 *     clicks 0..6, light + dark, and reports the pane bottoms against 720.
 *
 *   bun run playwright-tests/codex-tui-qa.ts [iso|slide] [port] [widthPx] [fontPx]
 *
 * `fontPx` (iso only) sets --ctui-font-size on the TUI host, to measure a
 * font size other than the component's 10px default.
 *
 * Screenshots go to playwright-tests/qa/codex-tui/.
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const MODE = process.argv[2] ?? "iso";
const PORT = process.argv[3] ?? "3041";
const WIDTH = Number(process.argv[4] ?? "444");
const FONT_PX = process.argv[5] ? Number(process.argv[5]) : null;
const BASE = `http://localhost:${PORT}`;
const OUT = "playwright-tests/qa/codex-tui";
mkdirSync(OUT, { recursive: true });

declare global {
  interface Window {
    __qa: {
      setStep: (s: number) => void;
      setToml: (s: number) => void;
    };
  }
}

async function mountIso(page: Page, width: number, fontPx: number | null) {
  await page.goto(`${BASE}/1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.evaluate(
    async ({ w, fontPx }) => {
      const src = await (await fetch("/components/CodexEffortTui.vue")).text();
      const vueUrl = src.match(/from "([^"]*\/vue\.esm-bundler\.js[^"]*)"/)![1];
      const slidevUrl = src.match(
        /from "([^"]*@slidev\/client\/index\.ts[^"]*)"/,
      )![1];
      const vue = await import(/* @vite-ignore */ vueUrl);
      const slidev = await import(/* @vite-ignore */ slidevUrl);
      const Tui = (await import("/components/CodexEffortTui.vue")).default;
      const Toml = (await import("/components/CodexConfigToml.vue")).default;
      const step = vue.ref(0);
      const tomlStep = vue.ref(0);
      const host = document.createElement("div");
      host.id = "qa-host";
      host.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:var(--color-background-primary,#fff);padding:16px;display:flex;gap:24px;align-items:flex-start;font-family:system-ui";
      document.body.appendChild(host);
      // The stale dev server still resolves the new tags in slides.md to icons
      // (see openIssues); its error overlay would cover the harness.
      const killOverlay = () =>
        document
          .querySelectorAll("vite-error-overlay")
          .forEach((e) => e.remove());
      killOverlay();
      new MutationObserver(killOverlay).observe(document.body, {
        childList: true,
      });
      const app = vue.createApp({
        render: () =>
          vue.h(
            "div",
            { style: "display:flex;gap:24px;align-items:flex-start" },
            [
              vue.h("div", { id: "qa-toml", style: "width:360px;flex:none" }, [
                vue.h(Toml, { step: tomlStep.value }),
              ]),
              vue.h(
                "div",
                {
                  id: "qa-tui",
                  style: `width:${w}px;flex:none${fontPx ? `;--ctui-font-size:${fontPx}px` : ""}`,
                },
                [vue.h(Tui, { step: step.value })],
              ),
            ],
          ),
      });
      const nav = slidev.useNav();
      app.provide("$$slidev-context", { nav, configs: {}, themeConfigs: {} });
      app.provide("$$slidev-clicks-context", vue.ref({ current: 0 }));
      app.provide("$$slidev-page", vue.ref(nav.currentSlideNo.value));
      app.provide("$$slidev-render-context", vue.ref("slide"));
      app.mount(host);
      window.__qa = {
        setStep: (s) => (step.value = s),
        setToml: (s) => (tomlStep.value = s),
      };
    },
    { w: width, fontPx },
  );
  await page.waitForSelector("#qa-tui .ctui");
  await page.waitForSelector("#qa-toml .monaco-editor .view-line");
  await page.waitForTimeout(600);
}

async function isoRun(browser: Browser, dark: boolean) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error")
      errors.push(`${m.type()}: ${m.text()}`);
  });
  await mountIso(page, WIDTH, FONT_PX);
  const theme = dark ? "dark" : "light";
  for (let s = 0; s <= 6; s++) {
    await page.evaluate((s) => {
      window.__qa.setStep(s);
      window.__qa.setToml(s);
    }, s);
    // mid-animation snapshot for the typed steps and the cursor walk
    if (s === 1 || s === 2 || s === 4) {
      await page.waitForTimeout(s === 4 ? 300 : 260);
      await page
        .locator("#qa-host")
        .screenshot({ path: `${OUT}/${theme}-step${s}-mid.png` });
    }
    await page.waitForTimeout(1400);
    const info = await page.evaluate(() => {
      const pane = document.querySelector("#qa-tui .ctui") as HTMLElement;
      const bottom = document.querySelector(
        "#qa-tui .ctui-bottom",
      ) as HTMLElement;
      const status = document.querySelector(
        "#qa-tui .ctui-status",
      ) as HTMLElement;
      const p = pane.getBoundingClientRect();
      const b = bottom.getBoundingClientRect();
      const st = status.getBoundingClientRect();
      const text = (sel: string) =>
        (document.querySelector(sel) as HTMLElement | null)?.innerText ?? "";
      return {
        paneH: p.height,
        contentOverflow: pane.scrollHeight - pane.clientHeight,
        tipLines: Math.round(
          (
            document.querySelector("#qa-tui .ctui-tip") as HTMLElement
          ).getBoundingClientRect().height /
            parseFloat(getComputedStyle(pane).lineHeight),
        ),
        bottomTop: b.top - p.top,
        statusBottom: st.bottom - p.top,
        aria: pane.getAttribute("aria-label"),
        composer: text("#qa-tui .ctui-line"),
        slash: text("#qa-tui .ctui-slash"),
        status: text("#qa-tui .ctui-status"),
        dialog: text("#qa-tui .cxp-title"),
        selected: text("#qa-tui .cxp-sel .cxp-name"),
        transcript: text("#qa-tui .ctui-transcript"),
        tomlDeco: [...document.querySelectorAll("#qa-toml .cct-line")].map(
          (el) => el.className,
        ),
        tomlGlyph: document.querySelectorAll("#qa-toml .cct-glyph-changed")
          .length,
        tomlFont: getComputedStyle(
          document.querySelector("#qa-toml .view-lines") as HTMLElement,
        ).fontFamily,
        tomlLine1: (() => {
          const vl = document.querySelector(
            "#qa-toml .view-line",
          ) as HTMLElement;
          const r = vl.getBoundingClientRect();
          const span = vl.firstElementChild as HTMLElement;
          const s = span.getBoundingClientRect();
          const ed = (
            document.querySelector("#qa-toml .monaco-editor") as HTMLElement
          ).getBoundingClientRect();
          return {
            textLeft: s.left - ed.left,
            textRight: s.right - ed.left,
            editorW: ed.width,
            lineTop: r.top - ed.top,
          };
        })(),
      };
    });
    console.log(`[${theme}] step ${s}`, JSON.stringify(info));
    await page
      .locator("#qa-host")
      .screenshot({ path: `${OUT}/${theme}-step${s}.png` });
  }
  // backwards: 6 -> 3 must be instant final state
  await page.evaluate(() => window.__qa.setStep(3));
  await page.waitForTimeout(50);
  const back = await page.evaluate(
    () =>
      (document.querySelector("#qa-tui .cxp-sel .cxp-name") as HTMLElement)
        .innerText,
  );
  console.log(`[${theme}] back to 3 selected: ${back}`);
  await page.evaluate(() => window.__qa.setStep(4));
  await page.waitForTimeout(50);
  const back4 = await page.evaluate(
    () =>
      (document.querySelector("#qa-tui .cxp-sel .cxp-name") as HTMLElement)
        .innerText,
  );
  console.log(`[${theme}] forward 3->4 at 50ms selected: ${back4}`);
  await page.evaluate(() => window.__qa.setStep(1));
  await page.waitForTimeout(50);
  const jump = await page.evaluate(() => ({
    composer: (document.querySelector("#qa-tui .ctui-line") as HTMLElement)
      .innerText,
    plan: !!document.querySelector("#qa-tui .ctui-plan"),
  }));
  console.log(`[${theme}] jump 4->1 final: ${JSON.stringify(jump)}`);
  if (errors.length) console.log(`[${theme}] console/page errors:`, errors);
  await ctx.close();
}

async function slideRun(browser: Browser, dark: boolean) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/codex-effort`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const theme = dark ? "dark" : "light";
  const no = await page.evaluate(() => {
    const el = document.querySelector(
      ".slidev-page:not([style*='display: none']) [data-slidev-no]",
    ) as HTMLElement | null;
    return el?.dataset.slidevNo ?? location.pathname;
  });
  console.log(`[${theme}] slide route resolved to ${no}`);
  for (let s = 0; s <= 6; s++) {
    if (s > 0) {
      await page.keyboard.press("ArrowRight");
    }
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const pane = document.querySelector(".ctui") as HTMLElement | null;
      if (!pane) return null;
      const p = pane.getBoundingClientRect();
      const toml = document.querySelector(".mb-wrap") as HTMLElement | null;
      const t = toml?.getBoundingClientRect();
      return {
        paneBottom: p.bottom,
        paneW: p.width,
        tomlBottom: t?.bottom,
        tomlW: t?.width,
        overflow: pane.scrollHeight - pane.clientHeight,
      };
    });
    console.log(`[${theme}] click ${s}`, JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/slide-${theme}-click${s}.png` });
  }
  if (errors.length) console.log(`[${theme}] page errors:`, errors);
  await ctx.close();
}

const browser = await chromium.launch();
try {
  if (MODE === "slide") {
    await slideRun(browser, false);
    await slideRun(browser, true);
  } else {
    await isoRun(browser, false);
    await isoRun(browser, true);
  }
} finally {
  await browser.close();
}
