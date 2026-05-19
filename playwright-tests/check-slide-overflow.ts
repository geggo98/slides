#!/usr/bin/env bun
// Overflow-check a Slidev slide: verify nothing renders below the 720px
// viewport boundary (the scaled slide-canvas height). Cycles through every
// tab button on the visible slide (.tab-bar / .tabs / .ct-tabs / .eco-tabs
// / .info-tabs / .sc-tabs / [role=tablist]) and through light+dark themes,
// scrolls any scrollable container to the bottom, then reports elements
// whose bottom > 720.
//
// Tab discovery, clicking, and overflow measurement are all scoped to the
// visible .slidev-page so Slidev's prerendered adjacent slides don't
// pollute the results.
//
// Usage:
//   bun run playwright-tests/check-slide-overflow.ts <slide> [port]
//
// Port is auto-detected via find-slidev-port.sh if omitted. Exits non-zero
// on overflow.

import { chromium } from "playwright";
import { execSync } from "node:child_process";

const slideArg = process.argv[2];
if (!slideArg || !/^\d+$/.test(slideArg)) {
  console.error(
    "Usage: bun run playwright-tests/check-slide-overflow.ts <slide> [port]",
  );
  process.exit(2);
}
const slide = parseInt(slideArg, 10);

let port = process.argv[3] ? parseInt(process.argv[3], 10) : 0;
if (!port) {
  try {
    const out = execSync(
      "zsh $HOME/.claude/skills/slidev/scripts/find-slidev-port.sh",
      { encoding: "utf-8" },
    );
    const ports = [...out.matchAll(/port (\d+)/g)].map((m) =>
      parseInt(m[1], 10),
    );
    if (ports.length === 1) port = ports[0];
    else if (ports.length > 1) {
      console.error(
        `Multiple Slidev servers running on ports: ${ports.join(", ")}. Pass the correct port as 2nd arg.`,
      );
      process.exit(2);
    }
  } catch {
    // ignore
  }
  if (!port) {
    console.error(
      "No Slidev dev server detected. Start one first or pass --port explicitly.",
    );
    process.exit(2);
  }
}

const BASE = `http://localhost:${port}`;
const VIEWPORT_H = 720;
const TOLERANCE = 2;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: VIEWPORT_H },
});

try {
  const resp = await page.goto(`${BASE}/${slide}`, {
    waitUntil: "networkidle",
  });
  if (!resp || !resp.ok()) {
    console.error(`Failed to load ${BASE}/${slide}: HTTP ${resp?.status()}`);
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(400);
} catch (e) {
  console.error(`Failed to load ${BASE}/${slide}: ${e}`);
  await browser.close();
  process.exit(2);
}

const TAB_SELECTOR = [
  ".tab-bar button",
  ".tabs button",
  ".ct-tabs button",
  ".eco-tabs button",
  ".info-tabs button",
  ".sc-tabs button",
  "[role='tablist'] [role='tab']",
].join(", ");

// Identify the visible .slidev-page so all further queries can be scoped
// to it. Slidev keeps adjacent slides in the DOM, and unscoped queries
// would click hidden buttons (each click times out after 30s) and count
// off-screen overflows.
const slideClass = await page.evaluate(() => {
  const pages = [...document.querySelectorAll<HTMLElement>(".slidev-page")];
  const visible = pages.find((p) => p.offsetParent !== null);
  return visible
    ? ([...visible.classList].find((c) => /^slidev-page-\d+$/.test(c)) ?? null)
    : null;
});
if (!slideClass) {
  console.error(`No visible .slidev-page found at ${BASE}/${slide}`);
  await browser.close();
  process.exit(2);
}
const slideLoc = page.locator(`.${slideClass}`);
const tabsLoc = slideLoc.locator(TAB_SELECTOR);
const tabCount = await tabsLoc.count();

type Finding = {
  tab: string;
  mode: string;
  overflow: number;
  bottom: number;
  sel: string;
  text: string;
};
const findings: Finding[] = [];

async function setMode(mode: "light" | "dark") {
  await page.evaluate((m) => {
    document.documentElement.classList.toggle("dark", m === "dark");
    document.documentElement.classList.toggle("light", m === "light");
  }, mode);
  await page.waitForTimeout(150);
}

async function scrollScrollablesToBottom() {
  await page.evaluate((slideCls) => {
    const slide = document.querySelector(`.${slideCls}`);
    if (!slide) return;
    slide.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const cs = getComputedStyle(el);
      const oy = cs.overflowY;
      if (
        (oy === "auto" || oy === "scroll") &&
        el.scrollHeight > el.clientHeight + 1
      ) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, slideClass);
  await page.waitForTimeout(150);
}

async function collectOverflow(tab: string, mode: string) {
  const rows = await page.evaluate(
    ({ viewportH, tolerance, slideCls }) => {
      const slide = document.querySelector(`.${slideCls}`);
      if (!slide) return [];
      const violations: Array<{ bottom: number; sel: string; text: string }> =
        [];
      slide.querySelectorAll<HTMLElement>("*").forEach((el) => {
        // Only count leaf-ish elements with visible text, so we don't double-count wrappers
        const text = (el.textContent || "").trim();
        if (!text) return;
        if (el.children.length > 0) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.bottom <= viewportH + tolerance) return;
        // Skip elements inside an ancestor that has `overflow: hidden/clip`
        // on the axis — those are already clipped by intent.
        let clipped = false;
        let p: Element | null = el.parentElement;
        while (p) {
          const pcs = getComputedStyle(p);
          if (pcs.overflowY === "hidden" || pcs.overflowY === "clip") {
            const pr = p.getBoundingClientRect();
            if (r.bottom <= pr.bottom + tolerance) {
              clipped = true;
              break;
            }
          }
          p = p.parentElement;
        }
        if (clipped) return;
        const cls =
          typeof el.className === "string"
            ? "." +
              el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
            : "";
        violations.push({
          bottom: Math.round(r.bottom),
          sel: el.tagName.toLowerCase() + (cls === "." ? "" : cls),
          text: text.slice(0, 60),
        });
      });
      return violations;
    },
    { viewportH: VIEWPORT_H, tolerance: TOLERANCE, slideCls: slideClass },
  );

  for (const v of rows) {
    findings.push({
      tab,
      mode,
      overflow: v.bottom - VIEWPORT_H,
      bottom: v.bottom,
      sel: v.sel,
      text: v.text,
    });
  }
}

for (const mode of ["light", "dark"] as const) {
  await setMode(mode);

  if (tabCount === 0) {
    await scrollScrollablesToBottom();
    await collectOverflow("(no tabs)", mode);
  } else {
    for (let i = 0; i < tabCount; i++) {
      const btn = tabsLoc.nth(i);
      const label = (await btn.textContent())?.trim() || `tab${i}`;
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(250);
      await scrollScrollablesToBottom();
      await collectOverflow(label, mode);
    }
  }
}

await browser.close();

if (findings.length === 0) {
  const combos = (tabCount || 1) * 2;
  console.log(
    `✓ Slide ${slide} fits within ${VIEWPORT_H}px viewport across ${combos} tab × theme combos.`,
  );
  process.exit(0);
}

console.log(
  `✗ Slide ${slide}: ${findings.length} elements overflow the ${VIEWPORT_H}px boundary`,
);
const grouped = new Map<string, Finding[]>();
for (const f of findings) {
  const key = `${f.tab} · ${f.mode}`;
  const arr = grouped.get(key) ?? [];
  arr.push(f);
  grouped.set(key, arr);
}
for (const [key, fs] of grouped) {
  const worst = fs.sort((a, b) => b.overflow - a.overflow);
  const max = worst[0].overflow;
  console.log(`  ${key}: ${fs.length} violations, max +${max}px`);
  for (const f of worst.slice(0, 3)) {
    console.log(
      `    +${String(f.overflow).padStart(4)}px  ${f.sel}  "${f.text}"`,
    );
  }
}
process.exit(1);
