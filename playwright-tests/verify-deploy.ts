// Verifiziert den GitHub-Pages-Deploy der Modell-Routing-Folien im echten
// Browser: rendert das Xref-Ziel, stimmen die Preise, steht die Pareto-Front,
// und klickt sich die Historien-Folie durch ihre sieben Datenstände?
//
//   bun run playwright-tests/verify-deploy.ts
//   BASE=https://geggo98.github.io/slides bun run playwright-tests/verify-deploy.ts
//
// Exit-Code ≠ 0, wenn ein Check fehlschlägt.
//
// --- Warum nicht einfach curl? ---------------------------------------------
// Auf GitHub Pages liefert JEDER Deep-Link HTTP 404 — `/40`, `/modell-routing`,
// `/skills`, alles. Das ist kein Fehler, sondern das SPA-auf-statischem-Host-
// Muster: Pages liefert `404.html` aus, die die App bootet, welche dann client-
// seitig auf die richtige Folie routet. Statuscodes sagen hier also nichts.
// Genauso wenig hilft ein grep im Entry-Chunk (`assets/index-*.js`, ~160 KB):
// die Folien-Komponenten liegen in separaten Lazy-Chunks. Nur ein echter
// Browser beantwortet die Frage.
//
// --- Bekannte, unkritische Warnung im Deploy-Log ---------------------------
// Der `build`-Job produziert bei JEDEM Lauf die Annotation
//
//   FlakeHub Login failure: The process '/usr/local/bin/determinate-nixd'
//   failed with exit code 1
//
// Sie ist vorbestehend (nachgeprüft über die Runs 30024834496, 30155208442 und
// 30650135579 — wortgleich, alle drei erfolgreich) und ohne Einfluss auf das
// Ergebnis: der Nix-Installer fällt auf den anonymen FlakeHub-Zugriff zurück.
// Der Deploy gilt trotz dieser Annotation als grün; sie ist KEIN Grund, ein
// Rollback zu fahren. Sie verschwindet erst mit einem FlakeHub-Token in der
// Workflow-Konfiguration — eigene Baustelle.
//
// --- Warum der /print-Wait anders ist als in mr-crosshair-qa.ts ------------
// Im Dev-Server hängt /print ~3 s auf einer 2-Folien-Hülle; dort wartet man
// exakt auf `window.__slidev__.nav.total`. Im Production-Build gibt es dieses
// Objekt NICHT (dev-only) — hier wird deshalb direkt auf den gesuchten
// Selektor gewartet, was ohnehin die präzisere Bedingung ist.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "https://geggo98.github.io/slides";
const DECK = `${BASE}/20260408-agents-details`;

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// (1) Das Xref-Ziel aus dem Anatomie-Deck muss auf der Rollen-Folie landen.
await page.goto(`${DECK}/modell-routing`, { waitUntil: "networkidle" });
await page.waitForSelector("h1:visible", { timeout: 30_000 });
const h1 = (await page.locator("h1:visible").first().textContent())?.trim();
check(
  "Xref-Ziel /modell-routing rendert die Modell-Routing-Folie",
  h1?.includes("Modell-Routing") ?? false,
  `h1 = ${JSON.stringify(h1)}`,
);

// (2) Foliennummer der Pareto-Folie über /print bestimmen statt sie zu raten —
// dort liegen alle Folien gleichzeitig im DOM, jede mit `data-slidev-no`.
await page.goto(`${DECK}/print`, { waitUntil: "load" });
// `attached`, nicht `visible`: in /print liegen alle Folien im DOM, sind aber
// bis auf die erste ausgeblendet. Für `data-slidev-no` reicht die Existenz.
await page.waitForSelector("svg.mp-chart", {
  state: "attached",
  timeout: 60_000,
});
const chartSlide = await page.evaluate(
  () =>
    document
      .querySelector("svg.mp-chart")
      ?.closest("[data-slidev-no]")
      ?.getAttribute("data-slidev-no") ?? null,
);
check(
  "Pareto-Folie in /print gefunden",
  chartSlide !== null,
  `Folie ${chartSlide}`,
);
if (chartSlide === null) {
  await browser.close();
  process.exit(1);
}

// (3) Inhalte auf der real gerouteten Folie prüfen, so wie ein Gast sie sieht.
await page.goto(`${DECK}/${chartSlide}`, { waitUntil: "networkidle" });
await page.waitForSelector("svg.mp-chart", { timeout: 30_000 });
await page.waitForTimeout(800);

const chart = await page.evaluate(() => {
  const svg = document.querySelector("svg.mp-chart");
  const q = (sel: string) =>
    Array.from(svg?.querySelectorAll(sel) ?? []).map(
      (e) => e.textContent?.trim() ?? "",
    );
  return {
    titles: q("title"),
    frontLabels: q("text.mp-label-front"),
    ghosts: svg?.querySelectorAll("circle.mp-old-pt").length ?? 0,
    legend:
      document.querySelector(".mp-legend")?.textContent?.replace(/\s+/g, " ") ??
      "",
    // Kürzester Treffer: `textContent` matcht sonst auch jeden Eltern-
    // Container, und die Meldung spuckt die halbe Folie aus.
    footer:
      Array.from(document.querySelectorAll("p, div"))
        .map((e) => e.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter((t) => t.includes("DeepSWE v1.1") && t.includes("Datacurve"))
        .sort((a, b) => a.length - b.length)[0] ?? "",
  };
});

// Die Punkt-Tooltips tragen den aktuellen Preis, die Geister-Tooltips den
// alten — hier ist bewusst der Punkt gemeint (enthält BEIDE Beträge).
const pointTip = (model: string, now: string) =>
  chart.titles.find((t) => t.startsWith(`${model}:`) && t.includes(now));

for (const [model, now] of [
  ["gpt-5.6-sol", "5,67 €"],
  ["gpt-5.6-terra", "3,47 €"],
  ["deepseek-v4-flash", "0,09 €"],
] as const) {
  const tip = pointTip(model, now);
  check(`${model} steht bei ${now}`, tip !== undefined, tip ?? "kein Treffer");
}

check(
  "Front = 2× deepseek, luna, terra, sol, opus-5 (glm-5.3 dominiert)",
  chart.frontLabels.length === 6 &&
    chart.frontLabels.includes("claude-opus-5") &&
    chart.frontLabels.includes("deepseek-v4-flash") &&
    !chart.frontLabels.includes("glm-5.3"),
  chart.frontLabels.join(", "),
);
check(
  "ein Geisterpunkt (sol vor der Senkung vom 21.08.)",
  chart.ghosts === 1,
  `${chart.ghosts}`,
);
check(
  "Legende nennt Preisanpassung und Kontingent-Schalter",
  chart.legend.includes("vor der Preisanpassung") &&
    chart.legend.includes("Claude-Code-Kontingent"),
  chart.legend,
);
check(
  "Fußzeile trennt Benchmark- und Preis-Stand",
  chart.footer.includes("Datacurve 20.08.") &&
    chart.footer.includes("Preise 21.08."),
  chart.footer || "keine Fußzeile gefunden",
);

await page.screenshot({ path: "playwright-tests/qa/deployed-pareto.png" });

// (4) Die Historien-Folie: eigener Alias, eigene Chart-Klasse (`.mh-chart`,
// damit der `querySelector` oben nicht hier landet), sieben Stationen.
await page.goto(`${DECK}/pareto-historie`, { waitUntil: "networkidle" });
await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
await page.waitForTimeout(500);
const hist = await page.evaluate(() => ({
  stations: document.querySelectorAll(".mh-tl-item").length,
  active:
    document
      .querySelector(".mh-tl-item.active .mh-tl-date")
      ?.textContent?.trim() ?? "",
  note:
    document
      .querySelector(".mh-note")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? "",
}));
check(
  "Historien-Folie hat sieben Stationen",
  hist.stations === 7,
  `${hist.stations}`,
);
check(
  "startet auf dem v1-Stand",
  hist.active.startsWith("v1") && hist.note.includes("1/7"),
  `${hist.active} · ${hist.note.slice(0, 60)}`,
);
await page.screenshot({ path: "playwright-tests/qa/deployed-history.png" });

await browser.close();
console.log(failures === 0 ? "\nDEPLOY OK" : `\n${failures} FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
