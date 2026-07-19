// Interaktions-Test der Bun-Bonus-Slides (Folien 40–42): jedes Info-Popup
// öffnen, Sichtbarkeit + Geometrie (innerhalb 1280×720) prüfen, Inhalt
// stichprobenartig verifizieren, Schließen per Klick und Escape testen.
// Playwright 1.58, Ausführung: PORT=3032 bun run playwright-tests/bun-bonus-popups.ts
import { chromium } from "playwright";
import type { Page } from "playwright";

const PORT = process.env.PORT ?? "3032";
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

async function popupGeometry(page: Page, label: string) {
  const card = page.locator(".bun-pop-card");
  await card.waitFor({ state: "visible", timeout: 3000 });
  const box = await card.boundingBox();
  const inBounds =
    !!box &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= 1280 &&
    box.y + box.height <= 720;
  check(
    `${label}: Popup sichtbar & innerhalb 1280×720`,
    inBounds,
    box ? `bottom=${Math.round(box.y + box.height)}` : "keine Box",
  );
}

async function closeByClick(page: Page, label: string) {
  await page.locator(".bun-pop-overlay").click({ position: { x: 20, y: 20 } });
  await page
    .locator(".bun-pop-overlay")
    .waitFor({ state: "detached", timeout: 3000 });
  check(`${label}: Klick schließt`, true);
}

async function run(colorScheme: "light" | "dark") {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    colorScheme,
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  const tag = `[${colorScheme}]`;

  // — Folie 40: Overview — zahlen / rollen / kelley
  await page.goto(`${BASE}/40`, { waitUntil: "networkidle" });
  await page.locator(".bun-overview").waitFor({ timeout: 10000 });

  await page
    .getByRole("button", { name: "Hinweise zu den Kennzahlen" })
    .click();
  await popupGeometry(page, `${tag} 40 zahlen`);
  const popText = (await page.locator(".bun-pop-card").textContent()) ?? "";
  check(
    `${tag} 40 zahlen: Rechnung (165.500 $ ≈ 145.000 €) im Text`,
    popText.includes("165.500") && popText.includes("145.000 €"),
  );
  const xrefs = page.locator(".bun-pop-card a.talk-xref");
  check(`${tag} 40 zahlen: 2 TalkXref-Links`, (await xrefs.count()) === 2);
  const hrefs = await xrefs.evaluateAll((as) =>
    as.map((a) => (a as HTMLAnchorElement).href),
  );
  check(
    `${tag} 40 zahlen: Links auf agents-details (token-oekonomie, caching)`,
    hrefs.some((h) => h.includes("token-oekonomie")) &&
      hrefs.some((h) => h.includes("caching")) &&
      hrefs.every((h) => h.includes("20260408-agents-details")),
    hrefs.join(" "),
  );
  await closeByClick(page, `${tag} 40 zahlen`);

  await page
    .getByRole("button", { name: "Hinweise zu den Agentenrollen" })
    .click();
  await popupGeometry(page, `${tag} 40 rollen`);
  check(
    `${tag} 40 rollen: Inhalt`,
    ((await page.locator(".bun-pop-card").textContent()) ?? "").includes(
      "64 ist nicht die Teamgröße",
    ),
  );
  // Escape schließt ebenfalls
  await page.keyboard.press("Escape");
  await page
    .locator(".bun-pop-overlay")
    .waitFor({ state: "detached", timeout: 3000 });
  check(`${tag} 40 rollen: Escape schließt`, true);

  await page.locator(".bun-tl-clickable").click();
  await popupGeometry(page, `${tag} 40 kelley`);
  check(
    `${tag} 40 kelley: Inhalt`,
    ((await page.locator(".bun-pop-card").textContent()) ?? "").includes(
      "Andrew Kelley",
    ),
  );
  await closeByClick(page, `${tag} 40 kelley`);

  // — Folie 41: Gantt — Phasenzeile + Caveats
  await page.goto(`${BASE}/41`, { waitUntil: "networkidle" });
  await page.locator(".bun-gantt").waitFor({ timeout: 10000 });

  await page.locator(".bun-node").nth(2).click(); // Orchestrierung
  await popupGeometry(page, `${tag} 41 phase`);
  const phaseText = (await page.locator(".bun-pop-card").textContent()) ?? "";
  check(
    `${tag} 41 phase: Orchestrierung + Autonomie-Pill + Agenten-Zeile`,
    phaseText.includes("Orchestrierung") &&
      phaseText.includes("Human in the loop") &&
      phaseText.includes("Agenten:"),
  );
  await closeByClick(page, `${tag} 41 phase`);

  await page.getByRole("button", { name: "Caveats zu diesem Chart" }).click();
  await popupGeometry(page, `${tag} 41 caveat`);
  check(
    `${tag} 41 caveat: Inhalt`,
    ((await page.locator(".bun-pop-card").textContent()) ?? "").includes(
      "Restwert-Arithmetik",
    ),
  );
  await closeByClick(page, `${tag} 41 caveat`);

  // — Folie 42: Kritik — alle 4 Karten
  await page.goto(`${BASE}/42`, { waitUntil: "networkidle" });
  await page.locator(".bun-critique").waitFor({ timeout: 10000 });

  const expected = [
    "unsafe-Blöcke — was steckt dahinter",
    "Andrew Kelleys Replik",
    "Niemand hat den Code gelesen",
    "Wer hier wem die Rechnung stellt",
  ];
  for (let i = 0; i < 4; i++) {
    await page.locator(".bun-card").nth(i).click();
    await popupGeometry(page, `${tag} 42 Karte ${i + 1}`);
    const t = (await page.locator(".bun-pop-card").textContent()) ?? "";
    check(
      `${tag} 42 Karte ${i + 1}: "${expected[i]}" + Gegenposition/Einordnung`,
      t.includes(expected[i]) &&
        (t.includes("Gegenposition") || t.includes("Einordnung")),
    );
    await closeByClick(page, `${tag} 42 Karte ${i + 1}`);
  }
  check(
    `${tag} 42: Euro-Umrechnung im Interessenkonflikt-Popup`,
    await page
      .locator(".bun-card")
      .nth(3)
      .evaluate(() => true)
      .then(async () => {
        await page.locator(".bun-card").nth(3).click();
        const t = (await page.locator(".bun-pop-card").textContent()) ?? "";
        await page
          .locator(".bun-pop-overlay")
          .click({ position: { x: 20, y: 20 } });
        return t.includes("≈ 145.000 €");
      }),
  );

  await browser.close();
}

await run("light");
await run("dark");

console.log(failures === 0 ? "\nALLE CHECKS GRÜN" : `\n${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
