/**
 * wandering-bottleneck-qa.ts — QA für WanderingBottleneckSim (SRE-Deck,
 * Deep-Links wandernde-engpaesse / engpass-gegenmassnahmen) und, optional,
 * für die zwei Crosslinks im Monitoring-Deck (Folien 28/29).
 *
 *   bun run playwright-tests/wandering-bottleneck-qa.ts <port>
 *     [--monitoring=<port>] [--monitoring-slides=28,29]
 *     [--engines=chromium,firefox,webkit]
 *     [--only=start,drehbuch,bedienung,monitoring,sweep] [--schemes=light,dark]
 *
 * Prüft:
 *  - Deep-Links und Startzustand beider Folien (hell + dunkel)
 *  - Isolation der zwei gemounteten Instanzen; die inaktive steht still
 *  - Drehbuch jedes Gegenmaßnahmen-Szenarios (REMEDY_ORDER, Preset-Zeile in
 *    dieser Reihenfolge): data-bottleneck und data-overload gemäß SCRIPTS;
 *    eigene Fragen (step.ask): Tipp = step.answer, data-ask; „Empfehlungen
 *    hängen“ zusätzlich voller Pool (data-blocked) und Zustand der
 *    Empfehlungen (data-rec) je Schritt
 *  - Schalter-Leiste je Szenario = SCENARIOS[k].rail plus eingeschaltete;
 *    ⚙ „Alle Schalter zeigen“ schaltet jeden Schalter, Fremde erscheinen
 *    gedimmt in der Leiste; der Retry-Modus ist ein Segmentfeld
 *    (.wb-retrymode button[aria-pressed]) — jedes Segment einmal
 *  - „Retry-Sturm“ je Schritt: Segment bzw. Budget-Schalter gemäß Drehbuch,
 *    Verstärkung (data-amp) und Breaker (data-breaker) an der Kasse,
 *    Retries im Lastknoten, Legende „Zahlung/s“
 *  - „Kurze Spitzen“ je Schritt: vierte Karte Mailversand (data-mail
 *    sync/async, Puffer voll per data-full), Kette mit vier Stationen,
 *    Überlastvektor mit mail, Legende „Mails“, Antwort in der Fußzeile;
 *    die ⚙-Liste zeigt „Puffern & glätten“ nur dort (mit Mailversand)
 *  - „Bot-Ansturm“ je Schritt: Schalter laut Drehbuch (Shedding → Rate
 *    Limit statt Shedding → Admission → Back Pressure), IO-Schub an der
 *    DB-Karte (data-io), Bot und 429 im Lastknoten, Legende „Seiten/s“,
 *    Antwort in der Fußzeile, Fußzeile trennt Kunden und Bot; die ⚙-Liste
 *    zeigt „Rate Limit“ nur dort (mit Bot)
 *  - Preset-Zeile: eine Zeile, endet innerhalb der Stage (≤ 844 px)
 *  - jeder Schalter, der Scaling-Modus und das Tempo schalten um
 *  - Aufdecken: %steal und Disk-await sichtbar, nirgends „IO-Steal“
 *  - Chromium: echter Mausklick je Bedienelement-Typ, danach muss
 *    ArrowRight die Folie wechseln; ebenso ⚙ öffnen → Escape → ArrowRight
 *  - jeder UI-Zustand je Engine, hell + dunkel, über Element-Boxen:
 *    .shell-root und alle Kinder ≤ Folienunterkante, nichts ragt aus der
 *    festen .wb-stage, kein Bedienelement in der Nav-Zone (x < 518 und
 *    y > 455 logische px), kein abgeschnittener Text, keine Text- oder
 *    Badge-Kollision
 *  - Chromium dunkel: Kontrast jedes Knopfs ≥ 3:1
 *  - Kontrolle der Messung: frühere Fehlerbilder (Badge auf dem Titel,
 *    abgeschnittene Legende, Knopf in der Nav-Zone, Stage-Überlauf, blasser
 *    Knopf) per CSS nachgestellt — die Messung muss jedes finden
 *  - Konsolenfehler (Wake Lock ausgenommen)
 *  - mit --monitoring: .sim-xref der Folien 28/29 zielt auf die beiden
 *    Deep-Links und überdeckt in keinem Klick-Zustand einen Absatz oder die
 *    .pipeline-viz (hell + dunkel). Nur Play-Seiten, nie /presenter: Die
 *    Sonde sendet so keinen Nav-Zustand an andere Clients des Servers.
 *
 * Screenshots: playwright-tests/qa/wb-*.png. Exit 0 = alles grün,
 * 1 = mindestens ein Befund, 2 = falscher Aufruf.
 */
import { writeFileSync } from "node:fs";
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserType,
  type Locator,
  type Page,
} from "playwright";
import {
  REMEDY_ORDER,
  SCENARIOS,
  SCRIPTS,
} from "../20260711-sre-simulations/components/lib/wanderingBottleneckScenarios.js";

/* ===== Aufruf ===== */

const ARGS = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  ARGS.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const PORT = ARGS.find((a) => /^\d+$/.test(a));
const MON_PORT = flag("monitoring");
const MON_SLIDES = (flag("monitoring-slides") ?? "28,29")
  .split(",")
  .map(Number);
const ENGINE_NAMES = (flag("engines") ?? "chromium,firefox,webkit").split(",");
const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit };
const SECTIONS = ["start", "drehbuch", "bedienung", "monitoring", "sweep"];
const ONLY = (flag("only") ?? SECTIONS.join(",")).split(",");
const SCHEMES = (flag("schemes") ?? "light,dark").split(",") as Scheme[];
if (
  !PORT ||
  (MON_PORT !== undefined && !/^\d+$/.test(MON_PORT)) ||
  MON_SLIDES.some((n) => !Number.isInteger(n)) ||
  ENGINE_NAMES.some((e) => !(e in ENGINES)) ||
  ONLY.some((o) => !SECTIONS.includes(o)) ||
  SCHEMES.some((x) => x !== "light" && x !== "dark")
) {
  console.error(
    `usage: bun run playwright-tests/wandering-bottleneck-qa.ts <port> [--monitoring=<port>] [--monitoring-slides=28,29] [--engines=chromium,firefox,webkit] [--only=${SECTIONS.join(",")}] [--schemes=light,dark]`,
  );
  process.exit(2);
}
if (MON_PORT === PORT) {
  console.error("--monitoring muss ein anderer Server sein als <port>");
  process.exit(2);
}

const BASE = `http://localhost:${PORT}`;
const OUT = "playwright-tests/qa";
const CAUSE = "wandernde-engpaesse";
const REMEDIES = "engpass-gegenmassnahmen";
const NAV_X = 518; // Nav-Zone unten links, logische px
const NAV_Y = 455;
const STATIONS = ["web", "inv", "pay"] as const;
const IO_STEAL = /I\/?O[- ]?Steal/i;
const MON_EXPECT: Record<number, { alias: string; clicks: number }> = {
  28: { alias: CAUSE, clicks: 4 },
  29: { alias: REMEDIES, clicks: 3 },
};

type Scheme = "light" | "dark";
type Step = {
  key: string;
  event?: string;
  action: Record<string, unknown>;
  settle: number;
  expect: string | null;
  overload: Record<string, string>;
  ask?: string;
  answer?: string;
};
const SCRIPT_OF = SCRIPTS as Record<string, Step[]>;
const SCEN_OF = SCENARIOS as Record<
  string,
  {
    rail?: string[];
    cm: Record<string, unknown>;
    mail?: boolean;
    bot?: unknown;
  }
>;
/** Richtiger Tipp eines Schritts: eigene Frage → answer; Schritt 0 → Station
 * (oder „none“); sonst Station oder „bleibt“. */
const tipOf = (st: Step, i: number): string =>
  st.ask
    ? (st.answer ?? "")
    : i === 0
      ? (st.expect ?? "none")
      : st.expect === "bleibt"
        ? "bleibt"
        : (st.expect ?? "none");
/** „Empfehlungen hängen“: erwarteter voller Pool (data-blocked) und Zustand
 * der Empfehlungen (data-rec) je Schritt; beim Breaker darf die Auflösung
 * in eine Probe fallen (half-open). */
const EMPF_CARDS: [blocked: string | null, rec: string[]][] = [
  ["alle", ["haengt"]],
  ["seiten", ["haengt"]],
  [null, ["timeout"]],
  [null, ["open", "half"]],
];
/** „Retry-Sturm“ je Schritt: gedrückter Retry-Modus, Budget an, Versuche
 * je Zahlung (data-amp, letzte 10 s) als Bereich, Breaker-Zustand an der
 * Kasse (null = aus), Retries im Lastknoten sichtbar. */
const RETRY_CARDS: {
  mode: string;
  budget: boolean;
  amp: [number, number];
  breaker: (string | null)[];
  retries: boolean;
}[] = [
  {
    mode: "naiv",
    budget: false,
    amp: [1.8, 3.1],
    breaker: [null],
    retries: true,
  },
  {
    mode: "backoff",
    budget: false,
    amp: [1.8, 3.1],
    breaker: [null],
    retries: true,
  },
  {
    mode: "backoffJitter",
    budget: false,
    amp: [1.8, 3.1],
    breaker: [null],
    retries: true,
  },
  {
    mode: "backoffJitter",
    budget: true,
    amp: [0.99, 1.12],
    breaker: [null],
    retries: false,
  },
  {
    mode: "backoffJitter",
    budget: true,
    amp: [0.99, 1.12],
    breaker: ["open", "half"],
    retries: false,
  },
];
/** „Kurze Spitzen“ je Schritt: Modus des Mailversands (data-mail) und ob
 * der Puffer voll ist (data-full; synchron ohne Puffer: null). */
const SPITZEN_CARDS: { mail: string; full: string | null }[] = [
  { mail: "sync", full: null },
  { mail: "async", full: "false" },
  { mail: "async", full: "true" },
];
/** „Bot-Ansturm“ je Schritt: Schalter der Leiste (aria-checked), IO-Schub
 * an der DB-Karte (data-io), 429 im Lastknoten. */
const BOTS_CARDS: { on: Record<string, boolean>; io: string; r429: boolean }[] =
  [
    {
      on: {
        shedBrowse: false,
        rateLimit: false,
        admission: false,
        bpInv: false,
      },
      io: "false",
      r429: false,
    },
    {
      on: {
        shedBrowse: true,
        rateLimit: false,
        admission: false,
        bpInv: false,
      },
      io: "false",
      r429: false,
    },
    {
      on: {
        shedBrowse: false,
        rateLimit: true,
        admission: false,
        bpInv: false,
      },
      io: "false",
      r429: true,
    },
    {
      on: { shedBrowse: false, rateLimit: true, admission: true, bpInv: false },
      io: "true",
      r429: true,
    },
    {
      on: { shedBrowse: false, rateLimit: true, admission: true, bpInv: true },
      io: "true",
      r429: true,
    },
  ];
/** Schalter mit Segmenten statt role=switch (Retry-Modus). */
const SEGMENTED = new Set(["retry"]);
const RETRY_MODES = ["aus", "naiv", "backoff", "backoffJitter"];
/** Auswahl der Leiste eines Szenarios (SCENARIOS[k].rail). */
const SEN_RAIL = (key: string): string[] => SCEN_OF[key]?.rail ?? [];
/** Schalter der Leiste (data-rail) als sortierte Liste. */
const sorted = (xs: string[]) => [...xs].sort().join(",");

/* ===== Ergebnisse ===== */

type Row = {
  group: string;
  where: string;
  check: string;
  ok: boolean;
  detail: string;
};
const rows: Row[] = [];
function record(
  group: string,
  where: string,
  check: string,
  ok: boolean,
  detail = "",
): boolean {
  rows.push({ group, where, check, ok, detail });
  if (!ok) console.log(`FAIL [${group}] ${where} · ${check}: ${detail}`);
  return ok;
}

/** Fehlermeldung ohne Call-Log, aber mit dem Locator, auf den gewartet wurde. */
let lastStep = "";
function errText(e: unknown): string {
  const lines = String(e).split("\n");
  const loc = lines.find((l) => /waiting for/.test(l))?.trim() ?? "";
  return [lines[0] ?? "", loc, lastStep ? `nach „${lastStep}“` : ""]
    .filter(Boolean)
    .join(" — ");
}

/* ===== Slidev ===== */

type SlidevNav = {
  currentPage: number;
  clicks: number;
  clicksTotal: number;
  total: number;
};
type SlidevWin = Window & { __slidev__?: { nav: SlidevNav } };

async function currentPage(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as SlidevWin).__slidev__?.nav.currentPage ?? -1,
  );
}

async function waitPage(page: Page, no: number, timeout = 4000) {
  try {
    await page.waitForFunction(
      (n) => (window as SlidevWin).__slidev__?.nav.currentPage === n,
      no,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

/** Schriften laden, bevor gemessen wird (0xProto lädt erst auf Anforderung). */
async function fontsReady(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    await document.fonts.load('12px "0xProto"');
    await document.fonts.load('12px "Inter"');
    await document.fonts.ready;
    return [...document.fonts].some(
      (f) => f.family.includes("0xProto") && f.status === "loaded",
    );
  });
}

async function openPath(page: Page, base: string, path: string) {
  lastStep = `öffne /${path}`;
  // networkidle mit Obergrenze: Ein hängender Request darf den Lauf nicht
  // aufhalten — entscheidend ist, dass die Folie danach steht.
  await page.goto(`${base}/${path}`, { waitUntil: "load" });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);
  await page.waitForFunction(
    () => ((window as SlidevWin).__slidev__?.nav.total ?? 0) > 0,
  );
  // ein Alias wird erst nach dem Laden auf die Foliennummer aufgelöst
  if (!/^\d+$/.test(path.split("?")[0] ?? ""))
    await page.waitForFunction(
      () => ((window as SlidevWin).__slidev__?.nav.currentPage ?? 1) > 1,
    );
  const no = await currentPage(page);
  await page
    .locator(`[data-slidev-no="${no}"] .shell-root, [data-slidev-no="${no}"] p`)
    .first()
    .waitFor({ timeout: 15000 });
  await fontsReady(page);
  await page.waitForTimeout(300);
  return no;
}

type Session = { ctx: BrowserContext; page: Page; errors: string[] };
const openContexts = new Set<BrowserContext>();

/** Nach einem Fehler offen gebliebene Kontexte schließen — eine Seite mit
 * laufender Sim soll den nächsten Abschnitt nicht ausbremsen. */
async function closeLeftovers() {
  for (const c of openContexts)
    await withTimeout(c.close(), 10_000).catch(() => undefined);
  openContexts.clear();
}

/** Ein hängender Schritt wird zum Befund statt zum Abbruch von außen. */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, rej) => {
    timer = setTimeout(
      () => rej(new Error(`hängt — nach ${ms / 1000} s abgebrochen`)),
      ms,
    );
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(timer);
  }
}

async function session(
  browser: Browser,
  scheme: Scheme,
  opts: { reduced?: boolean; scale?: number } = {},
): Promise<Session> {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: scheme,
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
    deviceScaleFactor: opts.scale ?? 1,
  });
  openContexts.add(ctx);
  ctx.on("close", () => openContexts.delete(ctx));
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  // Slidev fordert einen Wake Lock an; headless wird er abgelehnt. WebKit
  // meldet das ohne das Wort („NotAllowedError: Permission was denied“ aus
  // request() in useWakeLock von @vueuse/core) — erkannt am Stack.
  const wakeLock = (e: Error) =>
    /wake ?lock/i.test(e.message) ||
    (/NotAllowedError/.test(`${e.name} ${e.message}`) &&
      /@vueuse\/core/.test(e.stack ?? ""));
  page.on("pageerror", (e) => {
    if (!wakeLock(e))
      errors.push(
        `pageerror: ${e.message} @ ${
          (e.stack ?? "")
            .split("\n")
            .find((l) => /http/.test(l))
            ?.trim() ?? "?"
        }`,
      );
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/Wake Lock/i.test(m.text()))
      errors.push(m.text());
  });
  return { ctx, page, errors };
}

function slideOf(page: Page, no: number): Locator {
  return page.locator(`[data-slidev-no="${no}"]`);
}

async function simT(S: Locator): Promise<number> {
  return Number(await S.locator("[data-sim-t]").getAttribute("data-sim-t"));
}

/* ===== Messung im Browser (eine Funktion, wird serialisiert) ===== */

type MeasureArg = { n: number; navX: number; navY: number; contrast: boolean };
type Measure = {
  err: string;
  slideH: number;
  rootBottom: number;
  over: string[];
  nav: string[];
  cut: string[];
  collide: string[];
  contrast: string[];
  nControls: number;
  nTexts: number;
  nContrast: number;
  minRatio: number;
};

function measureInPage(a: MeasureArg): Measure {
  const res: Measure = {
    err: "",
    slideH: 0,
    rootBottom: 0,
    over: [],
    nav: [],
    cut: [],
    collide: [],
    contrast: [],
    nControls: 0,
    nTexts: 0,
    nContrast: 0,
    minRatio: 99,
  };
  const slide = document.querySelector(`[data-slidev-no="${a.n}"]`);
  if (!(slide instanceof HTMLElement)) {
    res.err = `Folie ${a.n} fehlt`;
    return res;
  }
  const root = slide.querySelector(".shell-root");
  if (!(root instanceof HTMLElement)) {
    res.err = ".shell-root fehlt";
    return res;
  }
  type R = { l: number; t: number; r: number; b: number };
  const sr = slide.getBoundingClientRect();
  const sc = sr.width / 980;
  res.slideH = sr.height / sc;
  const L = (r: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): R => ({
    l: (r.left - sr.left) / sc,
    t: (r.top - sr.top) / sc,
    r: (r.right - sr.left) / sc,
    b: (r.bottom - sr.top) / sc,
  });
  const rd = (x: number) => Math.round(x * 10) / 10;
  const label = (el: Element): string => {
    const cn = el.getAttribute("class") ?? "";
    const cls = cn.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    const txt = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${txt ? ` „${txt}“` : ""}`;
  };
  const isClipper = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.overflowX !== "visible" || cs.overflowY !== "visible";
  };
  const shown = (el: Element) => {
    if (el.getClientRects().length === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && Number(cs.opacity) > 0;
  };
  /** sichtbarer Ausschnitt: Box ∩ alle abschneidenden Vorfahren */
  const visRect = (el: Element, r0: R): R | null => {
    let r = { ...r0 };
    for (let p = el.parentElement; p && p !== slide; p = p.parentElement) {
      if (!isClipper(p)) continue;
      const c = L(p.getBoundingClientRect());
      r = {
        l: Math.max(r.l, c.l),
        t: Math.max(r.t, c.t),
        r: Math.min(r.r, c.r),
        b: Math.min(r.b, c.b),
      };
      if (r.r - r.l <= 0.1 || r.b - r.t <= 0.1) return null;
    }
    return r;
  };
  const clippedBelow = (el: Element, stop: Element) => {
    for (let p = el.parentElement; p && p !== stop; p = p.parentElement)
      if (isClipper(p)) return true;
    return false;
  };
  const push = (list: string[], s: string) => {
    if (list.length < 10 && !list.includes(s)) list.push(s);
  };

  // 1 · Überlauf: Folie und feste .wb-stage
  const rb = L(root.getBoundingClientRect());
  res.rootBottom = rd(rb.b);
  if (rb.b > res.slideH + 0.5)
    push(res.over, `.shell-root unten ${rd(rb.b)} > ${rd(res.slideH)}`);
  const stage = root.querySelector(".wb-stage");
  const stR = stage ? L(stage.getBoundingClientRect()) : null;
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (!shown(el)) continue;
    const b = L(el.getBoundingClientRect());
    if (b.r - b.l <= 0 || b.b - b.t <= 0) continue;
    if (
      !clippedBelow(el, slide) &&
      (b.b > res.slideH + 0.5 || b.r > 980.5 || b.l < -0.5 || b.t < -0.5)
    )
      push(
        res.over,
        `${label(el)} [${rd(b.l)},${rd(b.t)} – ${rd(b.r)},${rd(b.b)}]`,
      );
    if (
      stage &&
      stR &&
      el !== stage &&
      stage.contains(el) &&
      !clippedBelow(el, stage) &&
      (b.b > stR.b + 0.5 || b.r > stR.r + 0.5)
    )
      push(
        res.over,
        `${label(el)} ragt aus .wb-stage (${rd(b.b)} > ${rd(stR.b)})`,
      );
  }

  // 2 · Nav-Zone: kein sichtbares Bedienelement unten links
  const ctrls = Array.from(
    root.querySelectorAll(
      "button, a[href], [role=switch], [role=tab], input, select",
    ),
  );
  for (const el of ctrls) {
    if (!shown(el)) continue;
    const v = visRect(el, L(el.getBoundingClientRect()));
    if (!v) continue;
    res.nControls++;
    if (v.l < a.navX && v.b > a.navY)
      push(res.nav, `${label(el)} (${rd(v.l)}, ${rd(v.b)})`);
  }

  // 3 · abgeschnittener Text (Ellipse, Zeilenklemme, overflow: hidden).
  // Nur in Richtungen, in denen das Element auch abschneidet — sonst ist
  // ein Überstand sichtbar und fällt unter Überlauf oder Kollision.
  const CUT =
    ".wb-card > div, .wb-host > div, .wb-legend, .wb-line, .wb-q, .wb-tip, .wb-tip-fb, .wb-chip, .wb-rail-k, .wb-banner, .wb-pill, .wb-sp-lab, .wb-badge, .wb-dirty, .wb-clock, .wb-scalemode, .wb-stepbtn, .wb-next, .wb-back, .wb-tip-skip, .shell-title, .shell-subtitle";
  for (const el of Array.from(root.querySelectorAll(CUT))) {
    if (!(el instanceof HTMLElement) || !shown(el) || el.clientWidth === 0)
      continue;
    const cs = getComputedStyle(el);
    if (
      (cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) ||
      (cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1)
    )
      push(
        res.cut,
        `${label(el)} (${el.scrollWidth}/${el.clientWidth} × ${el.scrollHeight}/${el.clientHeight})`,
      );
  }

  // 4 · Kollisionen: Textzeilen untereinander, Badges/Overlays über Text.
  // Das ⚙-Overlay liegt absichtlich über der Bühne: nur gleiche Ebene vergleichen.
  // Range-Rechtecke umfassen die Content-Area der Schrift (Ascent +
  // Descent) und ragen bei knapper line-height über die Zeile hinaus. Für
  // den Vergleich zählt die Glyphenfläche: oben 0,12 em (über Versalien und
  // Oberlängen), unten 0,05 em abziehen.
  type T = { el: Element; r: R; gear: boolean };
  const texts: T[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const par = node.parentElement;
    if (!par || !(node.textContent ?? "").trim() || !shown(par)) continue;
    const gear = !!par.closest(".shell-gear");
    const fs = parseFloat(getComputedStyle(par).fontSize) || 10;
    const rg = document.createRange();
    rg.selectNodeContents(node);
    for (const cr of Array.from(rg.getClientRects())) {
      if (cr.width < 0.5 || cr.height < 0.5) continue;
      const v = visRect(par, L(cr));
      if (v)
        texts.push({
          el: par,
          r: { l: v.l, r: v.r, t: v.t + 0.12 * fs, b: v.b - 0.05 * fs },
          gear,
        });
    }
  }
  res.nTexts = texts.length;
  const ovl = (p: R, q: R) => [
    Math.min(p.r, q.r) - Math.max(p.l, q.l),
    Math.min(p.b, q.b) - Math.max(p.t, q.t),
  ];
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const p = texts[i]!;
      const q = texts[j]!;
      if (p.el === q.el || p.gear !== q.gear) continue;
      const [ox, oy] = ovl(p.r, q.r);
      if (ox! > 1 && oy! > 1)
        push(
          res.collide,
          `Text ${label(p.el)} ∩ ${label(q.el)} (${rd(ox!)}×${rd(oy!)})`,
        );
    }
  // Overlays (Badges, Schloss, Sparkline-Label) halten 1,5 px Abstand zur
  // Glyphenfläche fremder Texte — Berühren gilt als Kollision.
  const CLEAR = 1.5;
  for (const el of Array.from(
    root.querySelectorAll(".wb-badge, .wb-host-lock, .wb-sp-lab"),
  )) {
    if (!shown(el)) continue;
    const b = visRect(el, L(el.getBoundingClientRect()));
    if (!b) continue;
    const gear = !!el.closest(".shell-gear");
    for (const t of texts) {
      if (el.contains(t.el) || t.gear !== gear) continue;
      const [ox, oy] = ovl(
        { l: b.l - CLEAR, t: b.t - CLEAR, r: b.r + CLEAR, b: b.b + CLEAR },
        t.r,
      );
      if (ox! > 0 && oy! > 0)
        push(
          res.collide,
          `${label(el)} überdeckt ${label(t.el)} (${rd(ox!)}×${rd(oy!)})`,
        );
    }
    // Badges: ganz auf ihrer Karte (waagerecht)
    const card = el.closest(".wb-card");
    if (card && el.classList.contains("wb-badge")) {
      const c = L(card.getBoundingClientRect());
      if (b.l < c.l - 0.5 || b.r > c.r + 0.5)
        push(res.collide, `${label(el)} breiter als die Karte`);
    }
  }

  // 5 · Kontrast der Knöpfe (WCAG 1.4.11: ≥ 3:1)
  if (a.contrast) {
    type C4 = [number, number, number, number];
    const parse = (s: string): C4 | null => {
      let m = /^rgba?\(([^)]+)\)$/.exec(s);
      if (m) {
        const p = m[1]!
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
      }
      m = /^color\(srgb\s+([^)]+)\)$/.exec(s);
      if (m) {
        const p = m[1]!
          .split(/[\s/]+/)
          .filter(Boolean)
          .map(Number);
        return [p[0]! * 255, p[1]! * 255, p[2]! * 255, p[3] ?? 1];
      }
      return null;
    };
    const lin = (c: number) => {
      const x = c / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c: number[]) =>
      0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
    const over = (top: C4, bot: number[]) =>
      [0, 1, 2].map((i) => top[i]! * top[3] + bot[i]! * (1 - top[3]));
    const mix = (p: number[], q: number[], o: number) =>
      [0, 1, 2].map((i) => p[i]! * o + q[i]! * (1 - o));
    for (const el of ctrls) {
      if (!(el instanceof HTMLElement) || !shown(el)) continue;
      if (el instanceof HTMLButtonElement && el.disabled) continue;
      if (!/[\p{L}\p{N}]/u.test(el.textContent ?? "")) continue; // nur Emoji
      if (!visRect(el, L(el.getBoundingClientRect()))) continue;
      const layers: C4[] = [];
      let base: number[] | null = null;
      let opacity = 1;
      let bad = "";
      for (let p: Element | null = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const bg = parse(cs.backgroundColor);
        if (!bg) {
          bad = `Hintergrund „${cs.backgroundColor}“ unlesbar`;
          break;
        }
        if (bg[3] >= 0.999) {
          base = [bg[0], bg[1], bg[2]];
          break;
        }
        opacity *= Number(cs.opacity);
        layers.push(bg);
      }
      const fg = parse(getComputedStyle(el).color);
      if (!fg) bad = `Textfarbe „${getComputedStyle(el).color}“ unlesbar`;
      if (!base) bad ||= "kein deckender Hintergrund";
      if (bad || !base || !fg) {
        push(res.contrast, `${label(el)}: ${bad}`);
        continue;
      }
      let bgc = base;
      for (const lay of layers.reverse()) bgc = over(lay, bgc);
      const txt = over(fg, bgc);
      const fT = mix(txt, base, opacity);
      const fB = mix(bgc, base, opacity);
      const l1 = lum(fT);
      const l2 = lum(fB);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      res.nContrast++;
      res.minRatio = Math.min(res.minRatio, Math.round(ratio * 100) / 100);
      if (ratio < 3)
        push(
          res.contrast,
          `${label(el)} ${ratio.toFixed(2)}:1 (Text ${fT.map(Math.round).join(",")} auf ${fB.map(Math.round).join(",")})`,
        );
    }
  }
  return res;
}

async function measure(page: Page, no: number, contrast: boolean) {
  const at = lastStep;
  lastStep = `${at} · Maus`;
  await page.mouse.move(2, 2); // kein Hover-Zustand in der Messung
  lastStep = `${at} · Messung`;
  const m = await page.evaluate(measureInPage, {
    n: no,
    navX: NAV_X,
    navY: NAV_Y,
    contrast,
  });
  lastStep = at;
  return m;
}

/** Einen UI-Zustand prüfen: Layout immer, Kontrast in Chromium dunkel. */
async function checkState(
  page: Page,
  no: number,
  engine: string,
  scheme: Scheme,
  state: string,
  shotAlways: boolean,
) {
  lastStep = state;
  const contrast = engine === "chromium" && scheme === "dark";
  const m = await measure(page, no, contrast);
  const where = `${engine}·${scheme}`;
  const layoutOk =
    !m.err &&
    m.nControls > 0 &&
    m.nTexts > 0 &&
    !m.over.length &&
    !m.nav.length &&
    !m.cut.length &&
    !m.collide.length;
  record(
    "Layout",
    where,
    state,
    layoutOk,
    m.err ||
      [
        m.nControls === 0 ? "keine Bedienelemente gemessen" : "",
        m.nTexts === 0 ? "keine Texte gemessen" : "",
        m.over.length ? `Überlauf: ${m.over.join("; ")}` : "",
        m.nav.length ? `Nav-Zone: ${m.nav.join("; ")}` : "",
        m.cut.length ? `abgeschnitten: ${m.cut.join("; ")}` : "",
        m.collide.length ? `Kollision: ${m.collide.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ") ||
      `unten ${m.rootBottom}/${Math.round(m.slideH)}, ${m.nControls} Bedienelemente, ${m.nTexts} Textzeilen`,
  );
  if (contrast)
    record(
      "Kontrast",
      where,
      state,
      m.nContrast > 0 && !m.contrast.length,
      m.contrast.length
        ? m.contrast.join("; ")
        : `${m.nContrast} Knöpfe, kleinstes Verhältnis ${m.minRatio}:1`,
    );
  if (shotAlways || !layoutOk) {
    lastStep = `${state} · Screenshot`;
    await page.screenshot({
      path: `${OUT}/wb-${engine}-${scheme}-${state.replace(/[^\w-]+/g, "_")}.png`,
    });
    lastStep = state;
  }
}

/* ===== 1 · Deep-Links und Startzustand ===== */

async function deepLinks(browser: Browser, scheme: Scheme) {
  const where = `chromium·${scheme}`;
  const { ctx, page, errors } = await session(browser, scheme);
  const nC = await openPath(page, BASE, CAUSE);
  const dark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  record(
    "Start",
    where,
    "Farbschema folgt colorScheme",
    dark === (scheme === "dark"),
    `html.dark=${dark}`,
  );
  const SC = slideOf(page, nC);
  const stC = SC.locator(".wb-stage");
  record(
    "Start",
    where,
    `/${CAUSE} → Folie ${nC}`,
    (await stC.getAttribute("data-variant")) === "cause" &&
      (await stC.getAttribute("data-scenario")) === "nachbar" &&
      (await stC.getAttribute("data-phase")) === "sandbox",
    `variant=${await stC.getAttribute("data-variant")} scenario=${await stC.getAttribute("data-scenario")}`,
  );
  record(
    "Start",
    where,
    "Ursache: drei Karten, Aufdecken-Knopf",
    (await SC.locator(".wb-card").count()) === 3 &&
      (await SC.locator("button.wb-unlock").count()) === 1,
  );
  const sw = await SC.locator(".shell-presets button.wb-cm").evaluateAll((bs) =>
    bs.map(
      (b) => `${b.getAttribute("data-cm")}=${b.getAttribute("aria-checked")}`,
    ),
  );
  record(
    "Start",
    where,
    "Ursache: Schalter aus",
    sw.length === 3 && sw.every((s) => s.endsWith("=false")),
    sw.join(" "),
  );
  const t0 = await simT(SC);
  await page.waitForTimeout(1500);
  const t1 = await simT(SC);
  record(
    "Start",
    where,
    "Ursache: Autoplay beim Deep-Link",
    t1 > t0 + 5,
    `t ${t0} → ${t1}`,
  );
  const foot = await SC.locator(".wb-banner").innerText();
  record(
    "Start",
    where,
    "Ursache: Fußzeile zählt Wechsel",
    /Engpass-Wechsel in \d+ min/.test(foot),
    foot.replace(/\n/g, " ⏎ "),
  );
  await page.screenshot({ path: `${OUT}/wb-start-${CAUSE}-${scheme}.png` });

  const nR = await openPath(page, BASE, REMEDIES);
  record(
    "Start",
    where,
    `/${REMEDIES} folgt direkt auf /${CAUSE}`,
    nR === nC + 1,
    `Folien ${nC}, ${nR}`,
  );
  const SR = slideOf(page, nR);
  const stR = SR.locator(".wb-stage");
  const attrs = await stR.evaluate((e) =>
    ["data-variant", "data-scenario", "data-step", "data-phase"].map((k) =>
      e.getAttribute(k),
    ),
  );
  record(
    "Start",
    where,
    "Gegenmaßnahmen: rabatt, Schritt 0, Frage",
    attrs.join(",") === "remedies,rabatt,0,ask",
    attrs.join(","),
  );
  const tips = await SR.locator("button.wb-tip").evaluateAll((bs) =>
    bs.map(
      (b) =>
        `${b.getAttribute("data-tip")}${(b as HTMLButtonElement).disabled ? "(aus)" : ""}`,
    ),
  );
  record(
    "Start",
    where,
    "Gegenmaßnahmen: vier Tipps aktiv",
    tips.join(",") === "web,inv,pay,none",
    tips.join(","),
  );
  const rail = await SR.locator(".wb-rail button.wb-cm").evaluateAll((bs) =>
    bs.map(
      (b) => `${b.getAttribute("data-cm")}=${b.getAttribute("aria-checked")}`,
    ),
  );
  record(
    "Start",
    where,
    "Gegenmaßnahmen: Schalter-Leiste aus",
    rail.length >= 7 && rail.every((s) => s.endsWith("=false")),
    rail.join(" "),
  );
  const r0 = await simT(SR);
  await page.waitForTimeout(800);
  record(
    "Start",
    where,
    "Gegenmaßnahmen: wartet auf den Tipp",
    (await simT(SR)) === r0,
    `t ${r0}`,
  );
  await page.screenshot({ path: `${OUT}/wb-start-${REMEDIES}-${scheme}.png` });
  // Jedes Gegenmaßnahmen-Szenario: Preset in REMEDY_ORDER-Reihenfolge,
  // Startzustand, Leiste = Auswahl des Szenarios, Start-Schalter an
  const presetNames = await SR.locator(".shell-preset-btn").allInnerTexts();
  // eine Zeile, und die letzte endet innerhalb der Stage (logische px:
  // Abstand der rechten Kante vom linken Rand der .shell-root, umgerechnet
  // über die Folien-Skalierung)
  const row = await SR.locator(".shell-presets").evaluate((e) => {
    const bs = [...e.querySelectorAll(".shell-preset-btn")];
    const tops = new Set(
      bs.map((b) => Math.round(b.getBoundingClientRect().top)),
    );
    const root = e.closest(".shell-root") as HTMLElement;
    const rr = root.getBoundingClientRect();
    const k = rr.width / root.offsetWidth;
    const last = bs[bs.length - 1]!.getBoundingClientRect();
    const st = getComputedStyle(root);
    const inner =
      root.offsetWidth -
      parseFloat(st.paddingLeft) -
      parseFloat(st.paddingRight);
    return {
      lines: tops.size,
      right: Math.round(
        (last.right - rr.left) / k - parseFloat(st.paddingLeft),
      ),
      inner: Math.round(inner),
    };
  });
  record(
    "Start",
    where,
    `Gegenmaßnahmen: ${REMEDY_ORDER.length} Presets in einer Zeile, innerhalb der Stage`,
    presetNames.length === REMEDY_ORDER.length &&
      row.lines === 1 &&
      row.right <= row.inner,
    `${presetNames.join(" · ")} — endet bei ${row.right} von ${row.inner} px`,
  );
  for (const [si, key] of REMEDY_ORDER.entries()) {
    if (si > 0) {
      await SR.locator(".shell-preset-btn").nth(si).click();
      await page.waitForTimeout(250);
    }
    const st = await stR.evaluate((e) =>
      ["data-scenario", "data-step", "data-phase"].map((k) =>
        e.getAttribute(k),
      ),
    );
    const railAttr =
      (await SR.locator(".wb-rail").getAttribute("data-rail")) ?? "";
    const on = await SR.locator(".wb-rail button.wb-cm").evaluateAll((bs) =>
      bs
        .filter((b) => b.getAttribute("aria-checked") === "true")
        .map((b) => b.getAttribute("data-cm") ?? ""),
    );
    const want = SEN_RAIL(key);
    const wantOn = Object.entries(SCEN_OF[key]!.cm)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    record(
      "Start",
      where,
      `${key}: Schritt 0, Frage; Leiste = Auswahl; Start-Schalter an`,
      st.join(",") === `${key},0,ask` &&
        sorted(railAttr.split(",")) === sorted(want) &&
        sorted(on) === sorted(wantOn),
      `${st.join(",")} · Leiste ${railAttr} · an: ${on.join(",") || "–"}`,
    );
    if (si > 0)
      await page.screenshot({
        path: `${OUT}/wb-start-${key}-${scheme}.png`,
      });
  }
  await SR.locator(".shell-preset-btn").nth(0).click();
  record(
    "Konsole",
    where,
    "Deep-Links",
    errors.length === 0,
    errors.join(" | "),
  );
  await ctx.close();
  return { nC, nR };
}

/* ===== 2 · Drehbücher gegen SCRIPTS (echte Zeit, ×60), je Szenario ===== */

async function drehbuch(browser: Browser, scheme: Scheme) {
  const where = `chromium·${scheme}`;
  const { ctx, page, errors } = await session(browser, scheme, { scale: 2 });
  const no = await openPath(page, BASE, REMEDIES);
  const S = slideOf(page, no);
  const stage = S.locator(".wb-stage");
  for (const [si, key] of REMEDY_ORDER.entries()) {
    const preset = S.locator(".shell-preset-btn").nth(si);
    if (si > 0) {
      await preset.click();
      await page.waitForTimeout(200);
    }
    // Ein Presetwechsel setzt das Tempo des Szenarios — danach ×60
    await S.locator(".wb-speed button", { hasText: "×60" }).click();
    const steps = SCRIPT_OF[key]!;
    let prev: string | null = null;
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i]!;
      const exp: string | null = st.expect === "bleibt" ? prev : st.expect;
      prev = exp;
      const ask = await stage.getAttribute("data-ask");
      if (i === 1) {
        // SimShell meldet auch den Klick auf das aktive Preset — er darf
        // weder Seed noch Schritt noch Trefferquote verwerfen
        const snap = async () =>
          [
            await stage.getAttribute("data-scenario"),
            await stage.getAttribute("data-step"),
            await stage.getAttribute("data-phase"),
            (await S.locator(".wb-score").textContent())?.trim(),
            await simT(S),
          ].join("|");
        const a = await snap();
        await preset.click();
        await page.waitForTimeout(200);
        const b = await snap();
        record(
          "Drehbuch",
          where,
          `${key}: Klick aufs aktive Preset behält Schritt, Trefferquote und Sim-Zeit`,
          a === b && a.startsWith(`${key}|1|ask|1/1 ✓`),
          `${a} → ${b}`,
        );
      }
      const phase0 = await stage.getAttribute("data-phase");
      const tip = tipOf(st, i);
      const tipKeys = await S.locator("button.wb-tip").evaluateAll((bs) =>
        bs.map((b) => b.getAttribute("data-tip") ?? ""),
      );
      await S.locator(`button.wb-tip[data-tip="${tip}"]`).click();
      const pending = await stage.getAttribute("data-phase");
      try {
        await S.locator('.wb-stage[data-phase="reveal"]').waitFor({
          timeout: 30000,
        });
      } catch {
        record(
          "Drehbuch",
          where,
          `${key} Schritt ${i} ${st.key}`,
          false,
          "keine Auflösung binnen 30 s",
        );
        break;
      }
      const bn = await stage.getAttribute("data-bottleneck");
      const ov: string[] = [];
      let ovOk = true;
      // Überlastvektor laut Drehbuch — mit Mailversand vier Stationen
      const want = Object.keys(st.overload);
      const cardKeys = await S.locator(".wb-card").evaluateAll((cs) =>
        cs.map((c) => c.getAttribute("data-station") ?? ""),
      );
      if (cardKeys.join(",") !== want.join(",")) {
        ovOk = false;
        ov.push(`Karten ${cardKeys.join(",")}`);
      }
      for (const k of want) {
        const v = await S.locator(`.wb-card[data-station="${k}"]`).getAttribute(
          "data-overload",
        );
        ov.push(`${k}=${v}`);
        if (v !== st.overload[k]) ovOk = false;
      }
      const okAttr = await S.locator(".wb-tip-fb").getAttribute("data-ok");
      record(
        "Drehbuch",
        where,
        `${key} Schritt ${i} ${st.key}`,
        phase0 === "ask" &&
          pending === "pending" &&
          bn === (exp ?? "none") &&
          ovOk &&
          okAttr === "true" &&
          ask === (st.ask ?? null) &&
          tipKeys.length === 4,
        `Phasen ${phase0}→${pending}→reveal, data-bottleneck=${bn} (soll ${exp ?? "none"}), ${ov.join(" ")} (soll ${want.map((k) => `${k}=${st.overload[k]}`).join(" ")}), data-ask=${ask} (soll ${st.ask ?? null}), Tipps ${tipKeys.join(",")}, Tipp ${tip} data-ok=${okAttr}`,
      );
      if (key === "empfehlung") {
        const [wantBlocked, wantRec] = EMPF_CARDS[i]!;
        const blocked = await S.locator(
          '.wb-card[data-station="web"]',
        ).getAttribute("data-blocked");
        const rec = await S.locator(
          '.wb-card[data-station="inv"]',
        ).getAttribute("data-rec");
        const lead = (
          await S.locator(".wb-banner b").first().innerText()
        ).trim();
        const legend = await S.locator(".wb-legend").innerText();
        record(
          "Drehbuch",
          where,
          `${key} Schritt ${i}: Pool, Empfehlungen, Antwort in der Fußzeile, Legende „ohne Empf.“`,
          blocked === wantBlocked &&
            wantRec.includes(rec ?? "") &&
            /^Antwort: .*[^.]\.$/.test(lead) &&
            /ohne Empf\./.test(legend),
          `data-blocked=${blocked} (soll ${wantBlocked}), data-rec=${rec} (soll ${wantRec.join("|")}), Fußzeile „${lead}“`,
        );
      }
      if (key === "spitzen") {
        const wantM = SPITZEN_CARDS[i]!;
        const mail = S.locator('.wb-card[data-station="mail"]');
        const mode = await mail.getAttribute("data-mail");
        const full = await mail.getAttribute("data-full");
        const chain4 = await S.locator(".wb-chain.wb-chain-4").count();
        const legend = await S.locator(".wb-legend").innerText();
        const foot = (await S.locator(".wb-banner").innerText()).replace(
          /\s+/g,
          " ",
        );
        const lead = (
          await S.locator(".wb-banner b").first().innerText()
        ).trim();
        const smooth = await S.locator(
          '.wb-rail button.wb-cm[data-cm="smoothing"]',
        ).getAttribute("aria-checked");
        record(
          "Drehbuch",
          where,
          `${key} Schritt ${i}: Mailversand als vierte Karte (Modus, Puffer), Puffer-Schalter, Legende „Mails“, Antwort in der Fußzeile`,
          chain4 === 1 &&
            mode === wantM.mail &&
            full === wantM.full &&
            smooth === String(wantM.mail === "async") &&
            /Mails/.test(legend) &&
            /^Antwort: .*[^.]\.$/.test(lead),
          `Kette-4 ${chain4}, data-mail=${mode} (soll ${wantM.mail}), data-full=${full} (soll ${wantM.full}), Puffer ${smooth}, Fußzeile „${foot.slice(0, 90)}…“`,
        );
      }
      if (key === "bots") {
        const want = BOTS_CARDS[i]!;
        const on = await S.locator(".wb-rail button.wb-cm").evaluateAll((bs) =>
          Object.fromEntries(
            bs.map((b) => [
              b.getAttribute("data-cm") ?? "",
              b.getAttribute("aria-checked") === "true",
            ]),
          ),
        );
        const sw = Object.entries(want.on).filter(([k, v]) => on[k] !== v);
        const io = await S.locator('.wb-card[data-station="inv"]').getAttribute(
          "data-io",
        );
        const r429 = await S.locator(".wb-load [data-r429]").count();
        const bot = await S.locator(".wb-load [data-bot]").count();
        const legend = await S.locator(".wb-legend").innerText();
        const lead = (
          await S.locator(".wb-banner b").first().innerText()
        ).trim();
        record(
          "Drehbuch",
          where,
          `${key} Schritt ${i}: Schalter laut Drehbuch, IO-Schub an der DB-Karte, Bot und 429 im Lastknoten, Legende „Seiten/s“, Antwort in der Fußzeile`,
          sw.length === 0 &&
            io === want.io &&
            r429 > 0 === want.r429 &&
            bot === 1 &&
            /Seiten\/s:/.test(legend) &&
            /^Antwort: .*[^.]\.$/.test(lead),
          `Schalter-Abweichung ${sw.map(([k, v]) => `${k}≠${v}`).join(",") || "–"}, data-io=${io} (soll ${want.io}), 429 ${r429}, Bot ${bot}, Fußzeile „${lead}“`,
        );
      }
      if (key === "retry") {
        const want = RETRY_CARDS[i]!;
        const pay = S.locator('.wb-card[data-station="pay"]');
        const amp = Number(
          ((await pay.getAttribute("data-amp")) ?? "NaN").replace(",", "."),
        );
        const brk = await pay.getAttribute("data-breaker");
        const mode = await S.locator(
          '.wb-rail .wb-retrymode button[aria-pressed="true"]',
        ).getAttribute("data-mode");
        const budget = await S.locator(
          '.wb-rail button.wb-cm[data-cm="retryBudget"]',
        ).getAttribute("aria-checked");
        const loadR = await S.locator(".wb-load-r").count();
        const legend = await S.locator(".wb-legend").innerText();
        record(
          "Drehbuch",
          where,
          `${key} Schritt ${i}: Retry-Modus, Budget, Verstärkung und Breaker an der Kasse, Retries im Lastknoten, Legende „Zahlung/s“`,
          mode === want.mode &&
            budget === String(want.budget) &&
            amp >= want.amp[0] &&
            amp <= want.amp[1] &&
            want.breaker.includes(brk) &&
            loadR > 0 === want.retries &&
            /Zahlung\/s:/.test(legend),
          `Modus ${mode} (soll ${want.mode}), Budget ${budget}, data-amp=${amp} (soll ${want.amp.join("–")}), data-breaker=${brk} (soll ${want.breaker.join("|")}), Lastknoten-Retries ${loadR}`,
        );
      }
      await page.screenshot({
        path: `${OUT}/wb-drehbuch-${key}-${scheme}-${i}.png`,
      });
      if (key === "rabatt" && i === 4)
        await S.locator(".wb-chartwrap").screenshot({
          path: `${OUT}/wb-markers-${scheme}.png`,
        });
      await S.locator("button.wb-next").click();
    }
    const bilanz = (await S.locator(".wb-banner").innerText()).replace(
      /\s+/g,
      " ",
    );
    const quote = (await S.locator(".wb-score").textContent())?.trim() ?? "";
    record(
      "Drehbuch",
      where,
      `${key}: Fazit am Ende — Karte mit Fazit, Fußzeile mit Bilanz, Quote mit ✓`,
      (await stage.getAttribute("data-phase")) === "done" &&
        bilanz.startsWith("Bilanz:") &&
        quote === `${steps.length}/${steps.length} ✓`,
      `${quote} · ${bilanz}`,
    );
  }
  record("Konsole", where, "Drehbuch", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

/* ===== 3 · Isolation, Schalter, Aufdecken, Tastatur (Chromium hell) ===== */

/** Escape schließt ⚙ und fokussiert dessen Knopf; die Komponente gibt den
 * Fokus per setTimeout(0) ab — erst danach darf eine Pfeiltaste kommen. */
async function escape(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

/** Folie per Pfeiltaste wechseln und prüfen, dass sie gewechselt hat. */
async function arrow(page: Page, key: "ArrowRight" | "ArrowLeft", to: number) {
  await page.keyboard.press(key);
  if (!(await waitPage(page, to)))
    throw new Error(
      `${key} erreicht Folie ${to} nicht (steht auf ${await currentPage(page)})`,
    );
  await page.waitForTimeout(300);
}

async function clickThenArrow(page: Page, what: string, target: Locator) {
  const from = await currentPage(page);
  await target.click();
  await page.waitForTimeout(250);
  const active = await page.evaluate(
    () => document.activeElement?.tagName ?? "null",
  );
  await page.keyboard.press("ArrowRight");
  const moved = await waitPage(page, from + 1, 3000);
  const to = await currentPage(page);
  record(
    "Tastatur",
    "chromium·light",
    what,
    moved && active === "BODY",
    `activeElement=${active}, ArrowRight ${from} → ${to}`,
  );
  if (to !== from) {
    await page.keyboard.press("ArrowLeft");
    await waitPage(page, from, 3000);
  }
}

async function interact(browser: Browser) {
  const where = "chromium·light";
  const { ctx, page, errors } = await session(browser, "light");
  const nC = await openPath(page, BASE, CAUSE);
  const nR = nC + 1;
  const SC = slideOf(page, nC);
  const SR = slideOf(page, nR);

  // Isolation: Schalter und Tempo auf der Ursache, Gegenmaßnahmen unberührt
  const rSpeed0 = await SR.locator(
    '.wb-speed button[aria-pressed="true"]',
  ).innerText();
  const rT0 = await simT(SR);
  await SC.locator('button.wb-cm[data-cm="headroom"]').click();
  await SC.locator(".wb-speed button", { hasText: "×5" }).click();
  await page.waitForTimeout(1000);
  record(
    "Isolation",
    where,
    "Ursache: Schutzkapazität an, ×5",
    (await SC.locator('button.wb-cm[data-cm="headroom"]').getAttribute(
      "aria-checked",
    )) === "true" &&
      (await SC.locator(
        '.wb-speed button[aria-pressed="true"]',
      ).innerText()) === "×5",
  );
  record(
    "Isolation",
    where,
    "Gegenmaßnahmen: Schalter unberührt",
    (await SR.locator('button.wb-cm[data-cm="headroom"]').getAttribute(
      "aria-checked",
    )) === "false",
  );
  const rSpeed1 = await SR.locator(
    '.wb-speed button[aria-pressed="true"]',
  ).innerText();
  record(
    "Isolation",
    where,
    "Gegenmaßnahmen: Tempo unberührt",
    rSpeed1 === rSpeed0,
    `${rSpeed0} → ${rSpeed1}`,
  );
  const rT1 = await simT(SR);
  record(
    "Isolation",
    where,
    "inaktive Gegenmaßnahmen-Instanz steht",
    rT1 === rT0,
    `t ${rT0} → ${rT1}`,
  );
  await SC.locator('button.wb-cm[data-cm="headroom"]').click();
  await SC.locator(".wb-speed button", { hasText: "×20" }).click();

  // Gegenmaßnahmen laufen lassen (Tipp), dann zurück: die Instanz muss stehen
  await arrow(page, "ArrowRight", nR);
  const cT0 = await simT(SC);
  await SR.locator('button.wb-tip[data-tip="web"]').click();
  await page.waitForTimeout(1000);
  const cT1 = await simT(SC);
  record(
    "Isolation",
    where,
    "inaktive Ursachen-Instanz steht",
    cT1 === cT0,
    `t ${cT0} → ${cT1}`,
  );
  const rRun = await simT(SR);
  await arrow(page, "ArrowLeft", nC);
  const rStop0 = await simT(SR);
  await page.waitForTimeout(1000);
  const rStop1 = await simT(SR);
  record(
    "Isolation",
    where,
    "laufende Gegenmaßnahmen stoppen beim Verlassen",
    rStop0 === rStop1 && rRun > 0,
    `t ${rStop0} → ${rStop1}`,
  );

  // Alle Schalter: hin und zurück
  const flip = async (S: Locator, sel: string, attr: string, what: string) => {
    const b = S.locator(sel);
    const a0 = await b.getAttribute(attr);
    await b.click();
    const a1 = await b.getAttribute(attr);
    await b.click();
    const a2 = await b.getAttribute(attr);
    record(
      "Schalter",
      where,
      what,
      a0 !== a1 && a2 === a0,
      `${attr}: ${a0} → ${a1} → ${a2}`,
    );
  };
  /** Segmentfeld (Retry-Modus): jedes Segment drücken — genau eines ist
   * gedrückt, data-mode stimmt —, dann den Ausgangsmodus zurück. */
  const segments = async (S: Locator, scope: string, what: string) => {
    const box = S.locator(`${scope} .wb-retrymode`);
    const pressed = async () =>
      box
        .locator("button[aria-pressed]")
        .evaluateAll((bs) =>
          bs
            .filter((b) => b.getAttribute("aria-pressed") === "true")
            .map((b) => b.getAttribute("data-mode") ?? ""),
        );
    const start = (await pressed())[0] ?? "";
    const seen: string[] = [];
    let ok = (await box.locator("button").count()) === RETRY_MODES.length;
    for (const m of RETRY_MODES) {
      await box.locator(`button[data-mode="${m}"]`).click();
      const p = await pressed();
      seen.push(p.join("+"));
      if (p.length !== 1 || p[0] !== m) ok = false;
    }
    if (start) await box.locator(`button[data-mode="${start}"]`).click();
    const back = (await pressed())[0] ?? "";
    record(
      "Schalter",
      where,
      what,
      ok && back === start,
      `gedrückt nacheinander ${seen.join(" → ")}, zurück auf ${back}`,
    );
  };
  for (const k of ["murphy", "headroom", "isolate"])
    await flip(
      SC,
      `.shell-presets button.wb-cm[data-cm="${k}"]`,
      "aria-checked",
      `Ursache ${k}`,
    );
  await SC.locator(".shell-btn[aria-expanded]").click();
  await flip(
    SC,
    '.wb-gear button[data-cm="headroomAll"]',
    "aria-checked",
    "Ursache ⚙ +20 % überall",
  );
  for (const lvl of ["gering", "stark", "mittel"]) {
    await SC.locator(".wb-gear .wb-gbtn", { hasText: lvl }).click();
    record(
      "Schalter",
      where,
      `Ursache ⚙ Schwankung ${lvl}`,
      (await SC.locator(".wb-gear .wb-gbtn", { hasText: lvl }).getAttribute(
        "aria-pressed",
      )) === "true",
    );
  }
  await escape(page);
  for (const s of ["×1", "×5", "×20", "×60"]) {
    await SC.locator(".wb-speed button", { hasText: s }).click();
    const on = await SC.locator(
      '.wb-speed button[aria-pressed="true"]',
    ).allInnerTexts();
    record(
      "Schalter",
      where,
      `Tempo ${s}`,
      on.length === 1 && on[0]!.trim() === s,
      on.join(","),
    );
  }
  await SC.locator(".wb-speed button", { hasText: "×20" }).click();
  await arrow(page, "ArrowRight", nR);
  await SR.locator('.wb-stepbtn[data-step="0"]').click();
  const railKeys = await SR.locator(".wb-rail button.wb-cm").evaluateAll((bs) =>
    bs.map((b) => b.getAttribute("data-cm") ?? ""),
  );
  for (const k of railKeys)
    await flip(
      SR,
      `.wb-rail button.wb-cm[data-cm="${k}"]`,
      "aria-checked",
      `Gegenmaßnahmen ${k}`,
    );
  await flip(
    SR,
    "button.wb-scalemode",
    "aria-pressed",
    "Scaling-Modus reaktiv ↔ vorgewärmt",
  );
  await SR.locator(".shell-btn[aria-expanded]").click();
  await flip(SR, ".wb-gear .wb-gsw", "aria-checked", "⚙ Tipps überspringen");
  await escape(page);
  await arrow(page, "ArrowLeft", nC);

  // Aufdecken
  await SC.locator(".shell-btn", { hasText: "Neu" }).click();
  await SC.locator("button.wb-unlock").click();
  await page.waitForTimeout(1500);
  const hostA = (
    await SC.locator('.wb-host[data-host="A"]').innerText()
  ).replace(/\n/g, " | ");
  const hostB = (
    await SC.locator('.wb-host[data-host="B"]').innerText()
  ).replace(/\n/g, " | ");
  record(
    "Aufdecken",
    where,
    "Host A zeigt %steal",
    /%steal/.test(hostA),
    hostA,
  );
  record(
    "Aufdecken",
    where,
    "Host B zeigt Disk-await",
    /Disk-await/.test(hostB),
    hostB,
  );
  record(
    "Aufdecken",
    where,
    "Fußzeile: Wechsel im Nachbar-Schub",
    /Nachbar-Schub/.test(await SC.locator(".wb-banner").innerText()),
  );
  for (const [no, nm] of [
    [nC, "Ursache"],
    [nR, "Gegenmaßnahmen"],
  ] as const) {
    const all = await slideOf(page, no).evaluate((s) => {
      const parts = [
        (s as HTMLElement).innerText,
        s.querySelector(".wb-explain")?.textContent ?? "",
      ];
      for (const e of Array.from(s.querySelectorAll("[title], [aria-label]")))
        parts.push(
          `${e.getAttribute("title") ?? ""} ${e.getAttribute("aria-label") ?? ""}`,
        );
      return parts.join("\n");
    });
    const hit = IO_STEAL.exec(all);
    record(
      "Aufdecken",
      where,
      `${nm}: nirgends „IO-Steal“ (Text, Erklär-Tab, title, aria-label)`,
      !hit && all.length > 2000,
      hit ? `Treffer „${hit[0]}“` : `${all.length} Zeichen geprüft`,
    );
  }

  // Tastatur: echter Klick je Bedienelement-Typ, dann ArrowRight.
  // ↺ Neu lässt das Aufdecken stehen — verdeckt wird über ⚙.
  await SC.locator(".shell-btn[aria-expanded]").click();
  await SC.locator(".wb-gear .wb-gbtn", {
    hasText: "Wieder verdecken",
  }).click();
  record(
    "Aufdecken",
    where,
    "⚙ „Wieder verdecken“ bringt den Aufdecken-Knopf zurück",
    (await SC.locator("button.wb-unlock").count()) === 1,
  );
  await escape(page);
  await SC.locator(".shell-btn", { hasText: "Neu" }).click();
  await clickThenArrow(
    page,
    "Ursache: Aufdecken-Knopf",
    SC.locator("button.wb-unlock"),
  );
  await clickThenArrow(
    page,
    "Ursache: Schalter (role=switch)",
    SC.locator('.shell-presets button.wb-cm[data-cm="headroom"]'),
  );
  await clickThenArrow(
    page,
    "Ursache: Preset",
    SC.locator(".shell-preset-btn", { hasText: "Nur Zufall" }),
  );
  await clickThenArrow(
    page,
    "Ursache: Tempo-Segment",
    SC.locator(".wb-speed button", { hasText: "×60" }),
  );
  await clickThenArrow(page, "Ursache: ⏩ +5 min", SC.locator("button.wb-ff"));
  await clickThenArrow(page, "Ursache: ⏸/▶", SC.locator("button.wb-play"));
  await clickThenArrow(
    page,
    "Ursache: Tab",
    SC.getByRole("tab", { name: "Erklärung & Modell" }),
  );
  await clickThenArrow(
    page,
    "Ursache: Tab zurück",
    SC.getByRole("tab", { name: "Simulation" }),
  );
  await clickThenArrow(
    page,
    "Ursache: ↺ Neu",
    SC.locator(".shell-btn", { hasText: "Neu" }),
  );
  {
    const from = await currentPage(page);
    await SC.locator(".shell-btn[aria-expanded]").click();
    await page.waitForTimeout(250);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const active = await page.evaluate(
      () => document.activeElement?.tagName ?? "null",
    );
    await page.keyboard.press("ArrowRight");
    const moved = await waitPage(page, from + 1, 3000);
    record(
      "Tastatur",
      where,
      "Ursache: ⚙ öffnen → Escape → ArrowRight",
      moved,
      `activeElement=${active}, ${from} → ${await currentPage(page)}`,
    );
    if (moved) {
      await page.keyboard.press("ArrowLeft");
      await waitPage(page, from);
    }
  }
  await SC.locator(".shell-btn[aria-expanded]").click();
  await clickThenArrow(
    page,
    "Ursache: ⚙-Knopf",
    SC.locator(".wb-gear .wb-gbtn", { hasText: "stark" }),
  );
  if (!(await SC.locator(".wb-gear").count()))
    await SC.locator(".shell-btn[aria-expanded]").click();
  await clickThenArrow(
    page,
    "Ursache: ⚙-Schalter",
    SC.locator('.wb-gear button[data-cm="headroomAll"]'),
  );
  if (await SC.locator(".wb-gear").count()) await escape(page);
  await SC.locator(".shell-btn", { hasText: "Neu" }).click();

  // „Nur Zufall“ ohne Aufdecken, aktives Preset ohne Neuaufbau, Erklär-Tab
  // hält an, Canvas-Auflösung folgt der Fenstergröße
  {
    if (
      (await SC.locator(".wb-stage").getAttribute("data-scenario")) !== "zufall"
    )
      await SC.locator(".shell-preset-btn", { hasText: "Nur Zufall" }).click();
    const hosts = (await SC.locator(".wb-hosts").innerText()).replace(
      /\s+/g,
      " ",
    );
    const legend = await SC.locator(".wb-legend").innerText();
    record(
      "Aufdecken",
      where,
      "„Nur Zufall“: kein Aufdecken-Knopf, Hosts „kein Nachbar“, keine Nachbar-Legende",
      (await SC.locator("button.wb-unlock").count()) === 0 &&
        /kein Nachbar/.test(hosts) &&
        !/Nachbar-VM/.test(hosts) &&
        !/Nachbar CPU/.test(legend),
      hosts,
    );
    const play = SC.locator("button.wb-play");
    if ((await play.getAttribute("aria-pressed")) !== "true")
      await play.click();
    await page.waitForTimeout(400);
    await play.click(); // anhalten: Die Sim-Zeit steht
    await page.waitForTimeout(200);
    const tP0 = await simT(SC);
    await SC.locator(".shell-preset-btn", { hasText: "Nur Zufall" }).click();
    await page.waitForTimeout(300);
    const tP1 = await simT(SC);
    record(
      "Schalter",
      where,
      "Ursache: Klick aufs aktive Preset baut nicht neu auf",
      tP1 === tP0 && tP0 > SCENARIOS.zufall.prerollS,
      `t ${tP0} → ${tP1}`,
    );
    await play.click(); // weiter
    await SC.getByRole("tab", { name: "Erklärung & Modell" }).click();
    await page.waitForTimeout(300);
    const tE0 = await simT(SC);
    await page.waitForTimeout(800);
    const tE1 = await simT(SC);
    await SC.getByRole("tab", { name: "Simulation" }).click();
    await page.waitForTimeout(800);
    const tE2 = await simT(SC);
    record(
      "Schalter",
      where,
      "Erklär-Tab hält die Sim an, „Simulation“ setzt fort",
      tE0 === tE1 && tE2 > tE1,
      `t ${tE0} → ${tE1} → ${tE2}`,
    );
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(700);
    const ratio = await SC.locator("canvas.wb-chart").evaluate(
      (c: HTMLCanvasElement) =>
        c.width / (c.getBoundingClientRect().width * window.devicePixelRatio),
    );
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    record(
      "Schalter",
      where,
      "Canvas-Auflösung folgt der Fenstergröße (1280 → 1920 px)",
      Math.abs(ratio - 1) < 0.03,
      `Puffer / Bildschirmbreite ${ratio.toFixed(2)}`,
    );
    await SC.locator(".shell-btn", { hasText: "Neu" }).click();
  }

  await arrow(page, "ArrowRight", nR);
  await SR.locator('.wb-stepbtn[data-step="0"]').click();
  await page.waitForTimeout(200);
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: Tipp-Knopf",
    SR.locator('button.wb-tip[data-tip="web"]'),
  );
  await SR.locator('.wb-stage[data-phase="reveal"]').waitFor({
    timeout: 30000,
  });
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: Weiter ▸",
    SR.locator("button.wb-next"),
  );
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: Schalter-Leiste",
    SR.locator('.wb-rail button.wb-cm[data-cm="bpInv"]'),
  );
  record(
    "Schalter",
    where,
    "Abweichung vom Drehbuch erkannt",
    (await SR.locator(".wb-dirty").count()) === 1 &&
      (await SR.locator("button.wb-tip").count()) === 0,
  );
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: Zurück zu Schritt k",
    SR.locator("button.wb-back"),
  );
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: Scaling-Modus",
    SR.locator("button.wb-scalemode"),
  );
  await SR.locator("button.wb-scalemode").click();
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: Schritt-Knopf",
    SR.locator('.wb-stepbtn[data-step="3"]'),
  );
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: ohne Tipp ▸",
    SR.locator("button.wb-tip-skip"),
  );
  {
    const from = await currentPage(page);
    await SR.locator(".shell-btn[aria-expanded]").click();
    await page.waitForTimeout(250);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.keyboard.press("ArrowRight");
    const moved = await waitPage(page, from + 1, 3000);
    record(
      "Tastatur",
      where,
      "Gegenmaßnahmen: ⚙ öffnen → Escape → ArrowRight",
      moved,
      `${from} → ${await currentPage(page)}`,
    );
    if (moved) {
      await page.keyboard.press("ArrowLeft");
      await waitPage(page, from);
    }
  }
  await SR.locator(".shell-btn[aria-expanded]").click();
  await clickThenArrow(
    page,
    "Gegenmaßnahmen: ⚙-Schalter",
    SR.locator(".wb-gear .wb-gsw"),
  );
  if (await SR.locator(".wb-gear").count()) await escape(page);
  // ⚙-Schalter (Tipps überspringen) wieder aus
  await SR.locator(".shell-btn[aria-expanded]").click();
  if (
    (await SR.locator(".wb-gear .wb-gsw").getAttribute("aria-checked")) ===
    "true"
  )
    await SR.locator(".wb-gear .wb-gsw").click();
  await escape(page);

  // Weitere Szenarios (REMEDY_ORDER ab 2): Preset, Leiste, ⚙-Liste
  for (const [si, key] of REMEDY_ORDER.entries()) {
    if (si === 0) continue;
    await clickThenArrow(
      page,
      `Gegenmaßnahmen: Preset ${key}`,
      SR.locator(".shell-preset-btn").nth(si),
    );
    const rail = (await SR.locator(".wb-rail").getAttribute("data-rail")) ?? "";
    record(
      "Schalter",
      where,
      `${key}: Leiste = Auswahl des Szenarios`,
      (await SR.locator(".wb-stage").getAttribute("data-scenario")) === key &&
        sorted(rail.split(",")) === sorted(SEN_RAIL(key)),
      rail,
    );
    for (const k of rail.split(","))
      if (SEGMENTED.has(k))
        await segments(SR, ".wb-rail", `${key}: Leiste ${k}`);
      else
        await flip(
          SR,
          `.wb-rail button.wb-cm[data-cm="${k}"]`,
          "aria-checked",
          `${key}: Leiste ${k}`,
        );
    if (rail.split(",").some((k) => SEGMENTED.has(k))) {
      // neuer Bedienelement-Typ: Segment (aria-pressed) — echter Klick, dann
      // muss ArrowRight die Folie wechseln; danach zurück auf den Start
      const start =
        (await SR.locator(
          '.wb-rail .wb-retrymode button[aria-pressed="true"]',
        ).getAttribute("data-mode")) ?? "naiv";
      await clickThenArrow(
        page,
        "Gegenmaßnahmen: Retry-Segment",
        SR.locator('.wb-rail .wb-retrymode button[data-mode="backoff"]'),
      );
      await SR.locator(
        `.wb-rail .wb-retrymode button[data-mode="${start}"]`,
      ).click();
    }
    await SR.locator(".shell-btn[aria-expanded]").click();
    // „Alle Schalter zeigen“ bleibt über Presetwechsel offen (Zustand der
    // Instanz) — zuklappen, damit der Klick unten es sicher öffnet
    if (
      (await SR.locator(".wb-allsw-toggle").getAttribute("aria-expanded")) ===
      "true"
    )
      await SR.locator(".wb-allsw-toggle").click();
    await clickThenArrow(
      page,
      "Gegenmaßnahmen: ⚙ Alle Schalter zeigen",
      SR.locator(".wb-allsw-toggle"),
    );
    if (!(await SR.locator(".wb-gear").count()))
      await SR.locator(".shell-btn[aria-expanded]").click();
    const all = await SR.locator(
      ".wb-allsw button.wb-cm, .wb-allsw .wb-retrymode",
    ).evaluateAll((bs) => bs.map((b) => b.getAttribute("data-cm") ?? ""));
    record(
      "Schalter",
      where,
      `${key}: ⚙-Liste zeigt alle Schalter (≥ Leiste), „Puffern & glätten“ nur mit Mailversand, „Rate Limit“ nur mit Bot`,
      (await SR.locator(".wb-allsw-toggle").getAttribute("aria-expanded")) ===
        "true" &&
        SEN_RAIL(key).every((k) => all.includes(k)) &&
        all.includes("smoothing") === !!SCEN_OF[key]!.mail &&
        all.includes("rateLimit") === !!SCEN_OF[key]!.bot &&
        all.includes("admission"),
      all.join(","),
    );
    for (const k of all)
      if (SEGMENTED.has(k))
        await segments(SR, ".wb-allsw", `${key}: ⚙-Liste ${k}`);
      else
        await flip(
          SR,
          `.wb-allsw button.wb-cm[data-cm="${k}"]`,
          "aria-checked",
          `${key}: ⚙-Liste ${k}`,
        );
    // Ein Schalter außerhalb der Auswahl erscheint eingeschaltet gedimmt in
    // der Leiste und verschwindet ausgeschaltet wieder
    const extra = all.find(
      (k) => !SEN_RAIL(key).includes(k) && !SEGMENTED.has(k),
    );
    if (extra) {
      const chip = SR.locator(`.wb-allsw button.wb-cm[data-cm="${extra}"]`);
      const inRail = SR.locator(`.wb-rail button.wb-cm[data-cm="${extra}"]`);
      await chip.click();
      const shownOn = await inRail.count();
      const dim = await inRail.getAttribute("data-off-rail").catch(() => null);
      await chip.click();
      const shownOff = await inRail.count();
      record(
        "Schalter",
        where,
        `${key}: ${extra} (fremd) an → gedimmt in der Leiste, aus → weg`,
        shownOn === 1 && dim === "true" && shownOff === 0,
        `an ${shownOn} (data-off-rail=${dim}), aus ${shownOff}`,
      );
      await clickThenArrow(
        page,
        "Gegenmaßnahmen: ⚙-Liste Schalter",
        SR.locator(`.wb-allsw button.wb-cm[data-cm="${extra}"]`),
      );
      if (!(await SR.locator(".wb-gear").count()))
        await SR.locator(".shell-btn[aria-expanded]").click();
      await SR.locator(`.wb-allsw button.wb-cm[data-cm="${extra}"]`).click();
    }
    await escape(page);
  }
  await SR.locator(".shell-preset-btn").nth(0).click();
  record(
    "Konsole",
    where,
    "Isolation, Schalter, Tastatur",
    errors.length === 0,
    errors.join(" | "),
  );
  await ctx.close();

  // Reduzierte Bewegung
  const rm = await session(browser, "dark", { reduced: true });
  const rn = await openPath(rm.page, BASE, CAUSE);
  const RC = slideOf(rm.page, rn);
  const lab = (await RC.locator("button.wb-play").innerText()).trim();
  record(
    "Reduziert",
    "chromium·dark",
    "Play-Knopf „▶ +1 min“",
    lab === "▶ +1 min",
    lab,
  );
  const clockRm = (await RC.locator(".wb-clock").innerText()).trim();
  record(
    "Reduziert",
    "chromium·dark",
    "kein Zeitraffer: Tempo-Knöpfe weg, Uhr „· Schritt 1 min“",
    (await RC.locator(".wb-speed").count()) === 0 &&
      /· Schritt 1 min$/.test(clockRm),
    clockRm,
  );
  const a = await simT(RC);
  await rm.page.waitForTimeout(1000);
  const b = await simT(RC);
  record(
    "Reduziert",
    "chromium·dark",
    "kein Autoplay",
    a === b,
    `t ${a} → ${b}`,
  );
  await RC.locator("button.wb-play").click();
  await rm.page.waitForTimeout(200);
  const c = await simT(RC);
  record(
    "Reduziert",
    "chromium·dark",
    "▶ rechnet 60 s",
    Math.abs(c - b - 60) < 0.01,
    `t ${b} → ${c}`,
  );
  await RC.locator("button.wb-unlock").click();
  await rm.page.waitForTimeout(150);
  const anim = await RC.locator(".wb-host-reveal")
    .first()
    .evaluate((e) => getComputedStyle(e).animationName);
  record(
    "Reduziert",
    "chromium·dark",
    "Aufdecken ohne Wipe",
    anim === "none",
    anim,
  );
  await checkState(
    rm.page,
    rn,
    "chromium",
    "dark",
    "reduziert-ursache-aufgedeckt",
    true,
  );
  await arrow(rm.page, "ArrowRight", rn + 1);
  const RR = slideOf(rm.page, rn + 1);
  await RR.locator('button.wb-tip[data-tip="web"]').click();
  await rm.page.waitForTimeout(200);
  const ph = await RR.locator(".wb-stage").getAttribute("data-phase");
  record(
    "Reduziert",
    "chromium·dark",
    "Tipp löst sofort auf",
    ph === "reveal",
    `Phase ${ph}`,
  );
  await checkState(
    rm.page,
    rn + 1,
    "chromium",
    "dark",
    "reduziert-gegenmassnahmen-aufloesung",
    true,
  );
  record(
    "Konsole",
    "chromium·dark",
    "reduzierte Bewegung",
    rm.errors.length === 0,
    rm.errors.join(" | "),
  );
  await rm.ctx.close();
}

/* ===== 4 · Zustands-Sweep je Engine und Farbschema ===== */

/** Kontrolle der Messung: die früheren Fehlerbilder per CSS nachstellen —
 * ein Scan, der sie nicht findet, meldet sonst dasselbe wie ein sauberer. */
async function controls(page: Page, no: number) {
  const where = "chromium·light";
  const cases: [string, string, (m: Measure) => boolean][] = [
    [
      "alte Badge-Lage (top −8, 14 px) berührt den Kartentitel",
      ".wb-badge { top: -8px !important; line-height: 14px !important; }",
      (m) =>
        m.collide.some((c) => /wb-badge/.test(c) && /wb-card-name/.test(c)),
    ],
    [
      "abgeschnittene Legende",
      ".wb-legend { max-width: 420px !important; }",
      (m) => m.cut.some((c) => /wb-legend/.test(c)),
    ],
    [
      "Knopf in der Nav-Zone",
      ".wb-side { transform: translate(-560px, 120px) !important; }",
      (m) => m.nav.length > 0,
    ],
    [
      "Stage-Überlauf",
      ".wb-v-remedies { height: 600px !important; }",
      (m) => m.over.length > 0,
    ],
  ];
  for (const [what, css, found] of cases) {
    const tag = await page.addStyleTag({ content: css });
    await page.waitForTimeout(150);
    const m = await measure(page, no, false);
    await tag.evaluate((e) => e.parentNode?.removeChild(e));
    record(
      "Kontrolle",
      where,
      `Messung erkennt: ${what}`,
      found(m),
      JSON.stringify({
        over: m.over.length,
        nav: m.nav.length,
        cut: m.cut.length,
        collide: m.collide.slice(0, 2),
      }),
    );
  }
  await page.waitForTimeout(150);
  const clean = await measure(page, no, false);
  record(
    "Kontrolle",
    where,
    "nach dem Entfernen wieder sauber",
    !clean.over.length &&
      !clean.nav.length &&
      !clean.cut.length &&
      !clean.collide.length,
    JSON.stringify(clean.collide.slice(0, 2)),
  );
}

async function sweep(browser: Browser, engine: string, scheme: Scheme) {
  const where = `${engine}·${scheme}`;
  const { ctx, page, errors } = await session(browser, scheme);
  const shot = engine === "chromium";
  const check = (no: number, state: string) =>
    checkState(page, no, engine, scheme, state, shot);

  /* Gegenmaßnahmen: jeder Schritt × {Frage, wirkt, Auflösung} */
  const nR = await openPath(page, BASE, REMEDIES);
  const R = slideOf(page, nR);
  await R.locator(".wb-speed button", { hasText: "×60" }).click();
  await check(nR, "gegen-start");
  if (engine === "chromium" && scheme === "dark") {
    // Kontrolle: ein absichtlich zu blasser Knopf muss auffallen
    const tag = await page.addStyleTag({
      content: ".wb-tip { color: #3a4152 !important; }",
    });
    const m = await measure(page, nR, true);
    await tag.evaluate((e) => e.parentNode?.removeChild(e));
    record(
      "Kontrolle",
      where,
      "Kontrastmessung erkennt blassen Tipp-Knopf",
      m.contrast.some((c) => /wb-tip/.test(c)),
      `${m.contrast.length} Befunde, kleinstes Verhältnis ${m.minRatio}:1`,
    );
  }
  const steps = SCRIPTS.rabatt;
  for (let i = 0; i < steps.length; i++) {
    await R.locator(`.wb-stepbtn[data-step="${i}"]`).click();
    await page.waitForTimeout(150);
    await check(nR, `gegen-${i}-frage`);
    // falscher Tipp: längster Rückmeldetext („✗ Getippt: …“)
    const wrong = steps[i]!.expect === "pay" ? "web" : "pay";
    await R.locator(`button.wb-tip[data-tip="${wrong}"]`).click();
    await page.waitForTimeout(250);
    await check(nR, `gegen-${i}-wirkt`);
    lastStep = `gegen-${i}: ⏩ bis zur Auflösung`;
    await R.locator("button.wb-ff").click(); // bis zur Auflösung vorspulen
    await R.locator('.wb-stage[data-phase="reveal"]').waitFor({
      timeout: 15000,
    });
    lastStep = `gegen-${i}: aufgelöst`;
    await page.waitForTimeout(150);
    await check(nR, `gegen-${i}-aufloesung`);
    if (i === 4 && engine === "chromium" && scheme === "light")
      await controls(page, nR);
  }
  await R.locator("button.wb-next").click();
  await page.waitForTimeout(150);
  await check(nR, "gegen-fazit");
  await R.locator('.wb-stepbtn[data-step="2"]').click();
  await R.locator('.wb-rail button.wb-cm[data-cm="bpPay"]').click();
  await page.waitForTimeout(150);
  await check(nR, "gegen-abweichung");
  await R.locator("button.wb-back").click();
  await R.locator(".shell-btn[aria-expanded]").click();
  await R.locator(".wb-gear .wb-gsw").click();
  await page.waitForTimeout(150);
  await check(nR, "gegen-zahnrad");
  await escape(page);
  await check(nR, "gegen-tipps-uebersprungen");
  await R.locator(".shell-btn[aria-expanded]").click();
  await R.locator(".wb-gear .wb-gsw").click();
  await escape(page);
  for (const b of await R.locator(".wb-rail button.wb-cm").all())
    if ((await b.getAttribute("aria-checked")) !== "true") await b.click();
  await R.locator("button.wb-scalemode").click();
  await R.locator("button.wb-play").click();
  await page.waitForTimeout(1500);
  await check(nR, "gegen-alles-an");
  await R.getByRole("tab", { name: "Erklärung & Modell" }).click();
  await page.waitForTimeout(150);
  await check(nR, "gegen-erklaerung");
  await R.locator(".wb-explain").evaluate(
    (e) => (e.scrollTop = e.scrollHeight),
  );
  await page.waitForTimeout(150);
  await check(nR, "gegen-erklaerung-ende");
  await R.getByRole("tab", { name: "Simulation" }).click();

  /* Weitere Gegenmaßnahmen-Szenarios: jeder Schritt × {Frage, wirkt,
   * Auflösung}, Fazit, ⚙ mit „Alle Schalter zeigen“, alles an (Leiste
   * neu verteilt), Erklär-Tab bei ihrem Abschnitt */
  for (const [si, key] of REMEDY_ORDER.entries()) {
    if (si === 0) continue;
    await R.locator(".shell-preset-btn").nth(si).click();
    await R.locator(".wb-speed button", { hasText: "×60" }).click();
    await page.waitForTimeout(150);
    const steps = SCRIPT_OF[key]!;
    for (let i = 0; i < steps.length; i++) {
      await R.locator(`.wb-stepbtn[data-step="${i}"]`).click();
      await page.waitForTimeout(150);
      await check(nR, `${key}-${i}-frage`);
      // falscher Tipp (längster Rückmeldetext „✗ Getippt: …“): irgendein
      // Knopf außer dem richtigen — auch bei eigenen Fragen
      const right = tipOf(steps[i]!, i);
      const wrong =
        (
          await R.locator("button.wb-tip").evaluateAll((bs) =>
            bs.map((b) => b.getAttribute("data-tip") ?? ""),
          )
        ).find((k) => k !== right && k !== "bleibt") ?? "pay";
      await R.locator(`button.wb-tip[data-tip="${wrong}"]`).click();
      await page.waitForTimeout(250);
      await check(nR, `${key}-${i}-wirkt`);
      lastStep = `${key}-${i}: ⏩ bis zur Auflösung`;
      await R.locator("button.wb-ff").click();
      await R.locator('.wb-stage[data-phase="reveal"]').waitFor({
        timeout: 15000,
      });
      lastStep = `${key}-${i}: aufgelöst`;
      await page.waitForTimeout(150);
      await check(nR, `${key}-${i}-aufloesung`);
    }
    await R.locator("button.wb-next").click();
    await page.waitForTimeout(150);
    await check(nR, `${key}-fazit`);
    await R.locator(".shell-btn[aria-expanded]").click();
    await R.locator(".wb-allsw-toggle").click();
    await page.waitForTimeout(150);
    await check(nR, `${key}-zahnrad-alle`);
    for (const b of await R.locator(".wb-allsw button.wb-cm").all())
      if ((await b.getAttribute("aria-checked")) !== "true") await b.click();
    // Retry-Modus mit an (Segmentfeld, kein Schalter): die vollste Leiste
    const aus = R.locator('.wb-allsw .wb-retrymode button[data-mode="aus"]');
    if ((await aus.getAttribute("aria-pressed")) === "true")
      await R.locator(
        '.wb-allsw .wb-retrymode button[data-mode="naiv"]',
      ).click();
    await page.waitForTimeout(150);
    await check(nR, `${key}-zahnrad-alle-an`);
    await R.locator(".wb-allsw-toggle").click(); // wieder zu
    await escape(page);
    await R.locator("button.wb-play").click();
    await page.waitForTimeout(1500);
    await R.locator("button.wb-play").click();
    await check(nR, `${key}-alles-an`);
    // Leiste zu voll: Scrollt sie, steht unten „▾ mehr“ — bis ans Ende
    // gescrollt, verschwindet der Hinweis
    {
      const rail = R.locator(".wb-rail");
      const over = await rail.evaluate(
        (e) => e.scrollHeight - e.clientHeight > 1,
      );
      const hint0 = await R.locator(".wb-rail-more").count();
      await rail.evaluate((e) => (e.scrollTop = e.scrollHeight));
      await page.waitForTimeout(100);
      const hint1 = await R.locator(".wb-rail-more").count();
      await rail.evaluate((e) => (e.scrollTop = 0));
      record(
        "Bedienung",
        where,
        `${key}: alles an — scrollt die Leiste, zeigt „▾ mehr“ verdeckte Schalter an`,
        over ? hint0 === 1 && hint1 === 0 : hint0 === 0,
        `scrollt ${over}, Hinweis oben ${hint0}, am Ende ${hint1}`,
      );
    }
    await R.getByRole("tab", { name: "Erklärung & Modell" }).click();
    await page.waitForTimeout(150);
    // Der Tab springt beim Öffnen zum Abschnitt des Szenarios
    {
      const top = await R.locator(".wb-explain").evaluate((e, k) => {
        const h = e.querySelector(`.wb-ex-h[data-scen="${k}"]`);
        return h ? (h as HTMLElement).offsetTop - e.scrollTop : null;
      }, key);
      record(
        "Bedienung",
        where,
        `${key}: Erklär-Tab öffnet beim eigenen Abschnitt`,
        top !== null && top >= 0 && top <= 20,
        `Abstand der Überschrift zur Oberkante ${top} px`,
      );
    }
    await R.locator(".wb-explain").evaluate((e, k) => {
      const h = e.querySelector(`.wb-ex-h[data-scen="${k}"]`);
      h?.scrollIntoView({ block: "start" });
    }, key);
    await page.waitForTimeout(150);
    await check(nR, `${key}-erklaerung`);
    await R.getByRole("tab", { name: "Simulation" }).click();
    await R.locator(".shell-btn", { hasText: "Neu" }).click();
  }

  /* Ursache: beide Presets × verdeckt/aufgedeckt × Schalter */
  const nC = await openPath(page, BASE, CAUSE);
  const C = slideOf(page, nC);
  await C.locator(".wb-speed button", { hasText: "×60" }).click();
  await check(nC, "ursache-start");
  for (const [preset, tag] of [
    ["Nachbar-VM", "nachbar"],
    ["Nur Zufall", "zufall"],
  ] as const) {
    await C.locator(".shell-preset-btn", { hasText: preset }).click();
    for (const rev of [false, true]) {
      if (rev && (await C.locator("button.wb-unlock").count())) {
        await C.locator("button.wb-unlock").click();
        await page.waitForTimeout(1400); // Wipe
      }
      for (const combo of [
        [],
        ["headroom"],
        ["murphy", "isolate"],
        ["headroom", "isolate", "murphy"],
      ]) {
        for (const k of combo) {
          const b = C.locator(`.shell-presets button.wb-cm[data-cm="${k}"]`);
          if (
            !(await b.isDisabled()) &&
            (await b.getAttribute("aria-checked")) !== "true"
          )
            await b.click();
        }
        await page.waitForTimeout(900);
        await check(
          nC,
          `ursache-${tag}-${rev ? "auf" : "zu"}-${combo.join("+") || "ohne"}`,
        );
        for (const k of combo) {
          const b = C.locator(`.shell-presets button.wb-cm[data-cm="${k}"]`);
          if ((await b.getAttribute("aria-checked")) === "true")
            await b.click();
        }
      }
    }
    await C.locator(".shell-btn[aria-expanded]").click();
    await C.locator(".wb-gear .wb-gbtn", { hasText: "stark" }).click();
    await C.locator('.wb-gear button[data-cm="headroomAll"]').click();
    await page.waitForTimeout(200);
    await check(nC, `ursache-${tag}-zahnrad`);
    await escape(page);
    await page.waitForTimeout(900);
    await check(nC, `ursache-${tag}-ueberall-stark`);
    await C.locator(".shell-btn", { hasText: "Neu" }).click();
  }
  await C.getByRole("tab", { name: "Erklärung & Modell" }).click();
  await page.waitForTimeout(150);
  await check(nC, "ursache-erklaerung");
  await C.locator(".wb-explain").evaluate(
    (e) => (e.scrollTop = e.scrollHeight),
  );
  await page.waitForTimeout(150);
  await check(nC, "ursache-erklaerung-ende");
  record(
    "Konsole",
    where,
    "Zustands-Sweep",
    errors.length === 0,
    errors.join(" | "),
  );
  await ctx.close();
}

/* ===== 5 · Monitoring-Deck: Crosslinks ===== */

type XrefInfo = {
  err: string;
  href: string;
  text: string;
  clicks: number;
  inSlide: boolean;
  hits: string[];
  nBoxes: number;
};

async function monitoring(browser: Browser, port: string) {
  const MBASE = `http://localhost:${port}`;
  for (const n of MON_SLIDES) {
    const want = MON_EXPECT[n];
    for (const scheme of SCHEMES) {
      const where = `chromium·${scheme} :${port}/${n}`;
      const { ctx, page, errors } = await session(browser, scheme);
      await openPath(page, MBASE, String(n));
      const total = await page.evaluate(
        () => (window as SlidevWin).__slidev__?.nav.clicksTotal ?? -1,
      );
      if (want)
        record(
          "Monitoring",
          where,
          `Klick-Zustände 0…${want.clicks}`,
          total === want.clicks,
          `clicksTotal=${total}`,
        );
      for (let k = 0; k <= Math.max(0, total); k++) {
        await page.goto(`${MBASE}/${n}?clicks=${k}`, { waitUntil: "load" });
        await page.waitForFunction(
          ([no, c]) => {
            const nav = (window as SlidevWin).__slidev__?.nav;
            return nav?.currentPage === no && nav.clicks === c;
          },
          [n, k] as const,
          { timeout: 10000 },
        );
        await fontsReady(page);
        await page.waitForTimeout(700); // v-click-Übergänge
        const info = await page.evaluate((no): XrefInfo => {
          const res: XrefInfo = {
            err: "",
            href: "",
            text: "",
            clicks: -1,
            inSlide: false,
            hits: [],
            nBoxes: 0,
          };
          res.clicks = (window as SlidevWin).__slidev__?.nav.clicks ?? -1;
          const slide = document.querySelector(`[data-slidev-no="${no}"]`);
          if (!slide) {
            res.err = "Folie fehlt";
            return res;
          }
          if (!slide.querySelector(".pipeline-viz")) {
            res.err =
              "keine .pipeline-viz — Foliennummer verschoben? (--monitoring-slides=)";
            return res;
          }
          const x = slide.querySelector(".sim-xref");
          if (!x) {
            res.err = ".sim-xref fehlt";
            return res;
          }
          res.href = x.querySelector("a")?.getAttribute("href") ?? "";
          res.text = (x.textContent ?? "").trim().replace(/\s+/g, " ");
          const xr = x.getBoundingClientRect();
          const sr = slide.getBoundingClientRect();
          res.inSlide =
            xr.top >= sr.top - 0.5 &&
            xr.bottom <= sr.bottom + 0.5 &&
            xr.left >= sr.left - 0.5 &&
            xr.right <= sr.right + 0.5;
          const boxes = Array.from(
            slide.querySelectorAll("p, .pipeline-viz"),
          ).filter((e) => {
            if (x.contains(e)) return false;
            const cs = getComputedStyle(e);
            return (
              e.getClientRects().length > 0 &&
              cs.visibility !== "hidden" &&
              Number(cs.opacity) > 0 &&
              !e.closest(".slidev-vclick-hidden")
            );
          });
          res.nBoxes = boxes.length;
          for (const e of boxes) {
            const r = e.getBoundingClientRect();
            const ox = Math.min(r.right, xr.right) - Math.max(r.left, xr.left);
            const oy = Math.min(r.bottom, xr.bottom) - Math.max(r.top, xr.top);
            if (ox > 0.5 && oy > 0.5)
              res.hits.push(
                `${e.tagName.toLowerCase()}${e.classList.length ? "." + Array.from(e.classList).join(".") : ""} „${(e.textContent ?? "").trim().slice(0, 40)}“ (${Math.round(ox)}×${Math.round(oy)})`,
              );
          }
          return res;
        }, n);
        const target = want ? `/20260711-sre-simulations/${want.alias}` : "";
        record(
          "Monitoring",
          where,
          `Klick ${k}: .sim-xref`,
          !info.err &&
            info.clicks === k &&
            info.inSlide &&
            info.nBoxes > 0 &&
            !info.hits.length &&
            (!want || info.href.endsWith(target)),
          info.err ||
            [
              info.clicks !== k ? `nav.clicks=${info.clicks}` : "",
              want && !info.href.endsWith(target)
                ? `href „${info.href}“ endet nicht auf ${target}`
                : "",
              info.inSlide ? "" : "Link ragt aus der Folie",
              info.nBoxes ? "" : "keine Absätze gemessen",
              info.hits.length ? `überdeckt: ${info.hits.join("; ")}` : "",
            ]
              .filter(Boolean)
              .join(" | ") ||
            `href ${info.href}, ${info.nBoxes} Boxen frei`,
        );
        await page.screenshot({
          path: `${OUT}/wb-monitoring-${n}-${scheme}-${k}.png`,
        });
      }
      record(
        "Konsole",
        where,
        "Monitoring",
        errors.length === 0,
        errors.join(" | "),
      );
      await ctx.close();
    }
  }
}

/* ===== Ablauf ===== */

/** Je Engine EIN Browser für den ganzen Lauf. Ein zweiter chromium.launch()
 * nach close() starb unter Bun mitten im Sweep, ohne dass Playwright das
 * meldete — jeder weitere Aufruf hing dann. Trennt sich ein Browser doch,
 * wird er neu gestartet und der Abschnitt als Befund verbucht. */
const browsers = new Map<string, Browser>();
let closing = false;
async function browserFor(name: string): Promise<Browser> {
  const b = browsers.get(name);
  if (b && b.isConnected()) return b;
  const nb = await ENGINES[name]!.launch();
  nb.on("disconnected", () => {
    if (!closing) console.log(`· ${name}: Browser unerwartet getrennt`);
  });
  browsers.set(name, nb);
  return nb;
}

async function main() {
  const t0 = Date.now();
  const chrome = await browserFor("chromium");
  const run = async (section: string, fn: () => Promise<void>) => {
    if (!ONLY.includes(section)) return;
    const ts = Date.now();
    try {
      await withTimeout(fn(), 300_000);
    } catch (e) {
      record("Ablauf", "chromium", section, false, errText(e));
    }
    await closeLeftovers();
    console.log(`· ${section}: ${Math.round((Date.now() - ts) / 1000)} s`);
  };
  await run("start", async () => {
    for (const scheme of SCHEMES) await deepLinks(chrome, scheme);
  });
  await run("drehbuch", async () => {
    for (const scheme of SCHEMES) await drehbuch(chrome, scheme);
  });
  await run("bedienung", () => interact(chrome));
  if (MON_PORT) await run("monitoring", () => monitoring(chrome, MON_PORT));
  for (const name of ONLY.includes("sweep") ? ENGINE_NAMES : []) {
    for (const scheme of SCHEMES) {
      const ts = Date.now();
      try {
        const browser = await browserFor(name);
        await withTimeout(sweep(browser, name, scheme), 240_000);
      } catch (e) {
        record(
          "Ablauf",
          `${name}·${scheme}`,
          "Zustands-Sweep",
          false,
          errText(e),
        );
      }
      await closeLeftovers();
      console.log(
        `· sweep ${name}·${scheme}: ${Math.round((Date.now() - ts) / 1000)} s`,
      );
    }
  }
  closing = true;
  for (const b of browsers.values())
    await withTimeout(b.close(), 30_000).catch(() => undefined);

  // Zusammenfassung
  const groups = [...new Set(rows.map((r) => r.group))];
  const w = Math.max(10, ...groups.map((g) => g.length));
  console.log(
    `\n${"Gruppe".padEnd(w)}  ${"ok".padStart(4)}  ${"FAIL".padStart(4)}`,
  );
  for (const g of groups) {
    const rs = rows.filter((r) => r.group === g);
    const bad = rs.filter((r) => !r.ok).length;
    console.log(
      `${g.padEnd(w)}  ${String(rs.length - bad).padStart(4)}  ${String(bad).padStart(4)}`,
    );
  }
  const fails = rows.filter((r) => !r.ok);
  console.log(
    `${"Summe".padEnd(w)}  ${String(rows.length - fails.length).padStart(4)}  ${String(fails.length).padStart(4)}`,
  );
  if (fails.length) {
    console.log("\nBefunde:");
    for (const f of fails)
      console.log(`- [${f.group}] ${f.where} · ${f.check}: ${f.detail}`);
  }
  // Alle Zeilen (auch die grünen) zum Nachprüfen, ob ein Abschnitt
  // überhaupt lief — „0 FAIL“ allein sagt das nicht
  writeFileSync(`${OUT}/wb-qa-rows.json`, JSON.stringify(rows, null, 1));
  console.log(
    `\n${Math.round((Date.now() - t0) / 1000)} s · Screenshots: ${OUT}/wb-*.png · Zeilen: ${OUT}/wb-qa-rows.json`,
  );
  process.exit(fails.length ? 1 : 0);
}

await main();
