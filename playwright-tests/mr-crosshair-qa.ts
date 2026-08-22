// QA für die Modell-Routing-Infografik:
//   (1) Cross-Deck-Xref Anatomie → agents-details/modell-routing
//   (2) Fadenkreuz-Vergleichsmodus im Pareto-Chart
//
// Nichts ist fest verdrahtet: Dev-Server-Ports werden über den <title> der
// laufenden Server gefunden, Foliennummern über Slidevs /print-Route (dort
// liegen alle Folien gleichzeitig im DOM, jede mit `data-slidev-no`). Beides
// überlebt damit Port-Wechsel und Folien-Umsortierungen.
import { chromium, type Page } from "playwright";

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
}

// Seit dem Umzug der Sektion (972770a) besitzt agents-details das Kapitel;
// die Anatomie verlinkt hinein. Vorher lief der Verweis andersherum.
const EXPECTED_XREF =
  "https://geggo98.github.io/slides/20260408-agents-details/modell-routing";

// --- Laufende Slidev-Server finden -----------------------------------------

// Slidev vergibt ab 3030 aufsteigend; 3000–3100 deckt das ab, notfalls per
// PORT_FROM/PORT_TO verschieben. `localhost` statt `127.0.0.1`: Slidev/Vite
// bindet hier auf ::1, gegen die IPv4-Adresse läuft man in ConnectionRefused.
const PORT_FROM = Number(process.env.PORT_FROM ?? 3000);
const PORT_TO = Number(process.env.PORT_TO ?? 3100);
const PORTS = Array.from(
  { length: PORT_TO - PORT_FROM + 1 },
  (_, i) => PORT_FROM + i,
);

async function discoverDecks(): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  await Promise.all(
    PORTS.map(async (port) => {
      try {
        const res = await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(1500),
        });
        const title = (await res.text())
          .match(/<title>([^<]*)<\/title>/i)?.[1]
          ?.trim();
        if (title) found.set(title, port);
      } catch {
        // Port zu oder kein HTTP — nicht interessant.
      }
    }),
  );
  return found;
}

const decks = await discoverDecks();
const portFor = (fragment: string) => {
  for (const [title, port] of decks) if (title.includes(fragment)) return port;
  return null;
};

const ANATOMY = portFor("Anatomie Autonomer Agenten");
const DETAILS = portFor("Wie funktioniert ein Coding-Agent");
console.log(
  `Gefundene Decks: ${[...decks].map(([t, p]) => `${p}=${t.replace(" - Slidev", "")}`).join(", ") || "(keine)"}\n`,
);

// --- /print laden und warten, bis alle Folien samt Inhalt stehen -----------

// /print hängt ~3 s auf einer 2-Folien-Hülle und springt dann in einem Rutsch
// aufs volle Deck. Jede Zähl-Heuristik fällt auf dieses Plateau herein — also
// die App nach der Wahrheit fragen: window.__slidev__.nav.total (ggf. ein Ref)
// und warten, bis so viele Folien wirklich im DOM stehen.
async function openPrint(page: Page, port: number): Promise<number> {
  await page.goto(`http://localhost:${port}/print`, { waitUntil: "load" });

  const handle = await page.waitForFunction(() => {
    const nav = (
      window as unknown as { __slidev__?: { nav?: Record<string, unknown> } }
    ).__slidev__?.nav;
    const raw = nav?.total;
    const val =
      raw && typeof raw === "object" && "value" in raw
        ? (raw as { value: unknown }).value
        : raw;
    return typeof val === "number" && val > 0 ? val : null;
  });
  const total = (await handle.jsonValue()) as number;

  // Beide Bedingungen nötig: die Container erscheinen ~0,5 s vor ihrem Inhalt
  // (gemessen: 41 von 43 noch leer, wenn die Zahl schon stimmt).
  await page.waitForFunction(
    (t) => {
      const els = Array.from(document.querySelectorAll("[data-slidev-no]"));
      return els.length >= t && els.every((e) => e.children.length > 0);
    },
    total,
    { timeout: 60_000 },
  );
  return total;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// --- (1) Anatomie: Xref zeigt auf agents-details ---------------------------

if (ANATOMY === null) {
  check(
    "Anatomie-Deck erreichbar",
    false,
    "kein Dev-Server mit passendem Titel",
  );
} else {
  const total = await openPrint(page, ANATOMY);
  // Wie beim Chart weiter unten: die Xref-Komponente steckt in einem Lazy-Chunk
  // und ist noch nicht da, wenn die Folien-Container schon Inhalt haben.
  await page
    .waitForSelector("a.talk-xref", { state: "attached", timeout: 30_000 })
    .catch(() => null);
  const xrefs = await page.$$eval(
    'a.talk-xref[href*="modell-routing"]',
    (els) =>
      els.map((e) => ({
        href: e.getAttribute("href") ?? "",
        slide:
          e.closest("[data-slidev-no]")?.getAttribute("data-slidev-no") ?? "?",
      })),
  );
  check(
    `Anatomie (Port ${ANATOMY}, ${total} Folien): Modell-Routing-Xref vorhanden`,
    xrefs.length > 0,
    xrefs.map((x) => `Folie ${x.slide}`).join(", ") || "keiner gefunden",
  );
  // Der eigentliche Regressionsschutz: kein Verweis darf noch auf die alte
  // Adresse in der Anatomie selbst zeigen — die Seite gibt es nicht mehr.
  check(
    "alle Modell-Routing-Xrefs zeigen auf agents-details",
    xrefs.length > 0 && xrefs.every((x) => x.href === EXPECTED_XREF),
    [...new Set(xrefs.map((x) => x.href))].join(" | ") || "n/a",
  );
}

// --- (2) agents-details: Fadenkreuz im Pareto-Chart ------------------------

if (DETAILS === null) {
  check(
    "agents-details erreichbar",
    false,
    "kein Dev-Server mit passendem Titel",
  );
} else {
  const total = await openPrint(page, DETAILS);
  // `openPrint` wartet nur darauf, dass alle Folien-Container Inhalt haben —
  // die Chart-Komponente selbst kommt aus einem Lazy-Chunk und kann noch
  // fehlen. `attached` reicht: in /print sind alle Folien bis auf die erste
  // ausgeblendet.
  await page
    .waitForSelector("svg.mp-chart", { state: "attached", timeout: 30_000 })
    .catch(() => null);
  const chartSlide = await page.evaluate(
    () =>
      document
        .querySelector("svg.mp-chart")
        ?.closest("[data-slidev-no]")
        ?.getAttribute("data-slidev-no") ?? null,
  );
  check(
    `agents-details (Port ${DETAILS}, ${total} Folien): Pareto-Folie gefunden`,
    chartSlide !== null,
    chartSlide ? `Folie ${chartSlide}` : "svg.mp-chart nirgends im Print-DOM",
  );

  if (chartSlide) {
    const url = `http://localhost:${DETAILS}/${chartSlide}`;
    await page.goto(url);
    await page.waitForSelector(".mp-chart");
    await page.waitForTimeout(400);

    const ch = page.locator(".mp-ch");
    const fable = page.getByRole("button", {
      name: "Fadenkreuz für claude-fable-5",
    });
    const sol = page.getByRole("button", {
      name: "Fadenkreuz für gpt-5.6-sol",
    });

    await fable.hover();
    await page.waitForTimeout(150);
    check("Hover → 1 temporäres Fadenkreuz", (await ch.count()) === 1);

    await page.mouse.move(640, 60);
    await page.waitForTimeout(150);
    check("Maus weg → 0 Fadenkreuze", (await ch.count()) === 0);

    await fable.click();
    await page.mouse.move(640, 60);
    await page.waitForTimeout(150);
    check("Klick fable-5 → 1 permanentes Fadenkreuz", (await ch.count()) === 1);

    await sol.click();
    await page.mouse.move(640, 60);
    await page.waitForTimeout(150);
    check("Klick sol → 2 permanente Fadenkreuze", (await ch.count()) === 2);
    check(
      "aria-pressed auf fable-5",
      (await fable.getAttribute("aria-pressed")) === "true",
    );
    const badges = await page
      .locator(".mp-ch-badge:visible")
      .evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));
    check(
      "Achsen-Badges zeigen Werte",
      badges.join(" ").includes("18,95 €") && badges.join(" ").includes("73 %"),
      badges.join(" | "),
    );

    // Preisrunden 30.07. (luna, terra) und 21.08. (sol): die Badges lesen
    // p.eur, die Punkte p.x — beide Felder müssen synchron sein, sonst zeigt
    // das Fadenkreuz alte Preise an. `eur` wird in paretoData.ts aus `x`
    // abgeleitet, dieser Check bewacht genau das.
    await fable.click();
    await sol.click();
    for (const [name, want] of [
      ["gpt-5.6-luna", "0,53 €"],
      ["gpt-5.6-terra", "3,47 €"],
      ["gpt-5.6-sol", "5,67 €"],
    ] as const) {
      // Über die Beschriftung statt über den Marker: terras Hit-Target liegt
      // vollständig unter dem von glm-5.3 (die Punkte trennt ein Pixel), der
      // Klick auf den Marker landet dort. Das Label ist der zweite Griff.
      const btn = page.locator(`text.mp-label[data-model="${name}"]`);
      await btn.click();
      await page.mouse.move(640, 60);
      await page.waitForTimeout(150);
      const b = await page
        .locator(".mp-ch-badge:visible")
        .evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));
      check(
        `Badge ${name} = ${want}`,
        b.join(" ").includes(want),
        b.join(" | "),
      );
      await btn.click();
    }

    await fable.click();
    await sol.click();
    await page.mouse.move(640, 60);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: "playwright-tests/mr-qa/crosshair-2pins-light.png",
    });

    await fable.click();
    await page.mouse.move(640, 60);
    await page.waitForTimeout(150);
    check("Re-Klick fable-5 → 1 Fadenkreuz", (await ch.count()) === 1);

    // Dark-Screenshot mit 2 Pins (echtes prefers-color-scheme: dark)
    const darkCtx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: "dark",
    });
    const darkPage = await darkCtx.newPage();
    await darkPage.goto(url);
    await darkPage.waitForSelector(".mp-chart");
    await darkPage.waitForTimeout(300);
    await darkPage
      .getByRole("button", { name: "Fadenkreuz für claude-fable-5" })
      .click();
    await darkPage
      .getByRole("button", { name: "Fadenkreuz für gpt-5.6-sol" })
      .click();
    await darkPage.mouse.move(640, 60);
    await darkPage.waitForTimeout(150);
    await darkPage.screenshot({
      path: "playwright-tests/mr-qa/crosshair-2pins-dark.png",
    });
    await darkCtx.close();
  }
}

await browser.close();
console.log(
  failures === 0 ? "\nALLE CHECKS OK" : `\n${failures} CHECKS FEHLGESCHLAGEN`,
);
process.exit(failures === 0 ? 0 : 1);
