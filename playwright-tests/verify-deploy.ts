// Verifiziert den GitHub-Pages-Deploy der Modell-Routing-Folien im echten
// Browser: rendert das Xref-Ziel, stimmen die Preise, steht die Pareto-Front,
// klickt sich die Historien-Folie durch ihre neun Datenstände, und rendert die
// Bonusfolie v1 gegen v1.1?
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
import { CURRENT, tip } from "../20260408-agents-details/components/paretoData";

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
    frontPts: svg?.querySelectorAll("circle.mp-front-pt").length ?? 0,
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

// Preise abzuschreiben ging hier zweimal daneben: sol stand bei 5,67 € und ist
// seit dem 26.08. bei 5,66 €, deepseek-v4-flash bei 0,09 € und seit dem 21.08.
// bei 0,41 €. Beide Checks meldeten danach eine Abweichung, die es nicht gab.
// Maßgeblich ist deshalb `paretoData.ts` selbst: Der Tooltip jedes Punkts muss
// zeichengleich das sein, was `tip()` aus dem Datensatz baut — die Komponente
// rendert genau diese Funktion. Geprüft wird damit, ob der Deploy den Stand
// des Repos zeigt, und das bleibt über jeden künftigen Board-Stand richtig.
const rendered = new Set(chart.titles.map((t) => t.replace(/\s+/g, " ")));
const missing = CURRENT.filter(
  (p) => !rendered.has(tip(p).replace(/\s+/g, " ")),
);
check(
  `alle ${CURRENT.length} Punkte tragen Preis und Score aus paretoData.ts`,
  missing.length === 0,
  missing.map((p) => tip(p)).join(" · "),
);

// Die Front ändert sich mit jedem Board-Stand; fest verdrahtet war hier „6“,
// und das war seit Stand 8 falsch. Verlangt wird, was stabil gilt: jede
// Sprosse trägt einen Namen.
check(
  "jede Front-Sprosse trägt einen Namen",
  chart.frontPts > 0 && chart.frontLabels.length === chart.frontPts,
  `${chart.frontLabels.length} Labels / ${chart.frontPts} Sprossen: ${chart.frontLabels.join(", ")}`,
);
// Seit Stand 8 zeigt der Ring ausschließlich KÜNFTIGE Preise — ohne Overlay
// den Listenpreis von gemini-3.8-flash ab 01.01.2027. Sols alter Ring ist mit
// dem Stand vom 02.09. weggefallen und lebt nur noch auf der Historien-Folie.
// Wie viele Ringe zu erwarten sind, sagt deshalb der Datensatz.
const ghosts = CURRENT.filter((p) => p.old);
check(
  `${ghosts.length} Geisterring(e): ${ghosts
    .map((p) => `${p.label} ${p.old?.pre ?? "vorher"} ${p.old?.eur} €`)
    .join(", ")}`,
  chart.ghosts === ghosts.length,
  `${chart.ghosts} gerendert`,
);
// Der Text des Ring-Eintrags wandert mit der Erzählung („vor der
// Preisanpassung“ → „Preis ab 01.01.2027“), das Datum mit dem Preis. Verlangt
// wird deshalb nur, was strukturell gilt: ein Ring-Eintrag mit Datum und die
// beiden Schalter der Legendenzeile.
check(
  "Legende: Ring-Eintrag mit Datum, Kontingent- und Namen-Schalter",
  /Preis ab \d{2}\.\d{2}\.\d{4}/.test(chart.legend) &&
    chart.legend.includes("Claude-Code-Kontingent") &&
    chart.legend.includes("alle Namen"),
  chart.legend,
);
// Benchmark- und Preis-Stand fielen bis zum 21.08. auseinander und trugen zwei
// Daten; seit dem 26.08. ist es wieder eines. Stabil ist, dass die Fußzeile
// einen Datacurve-Stand nennt und den festen Umrechnungskurs — der ist über
// alle Stände konstant, damit die Zeitreihe Preise zeigt und kein
// Wechselkurs-Rauschen (siehe Kopf von `paretoData.ts`).
check(
  "Fußzeile nennt Datenstand und festen Umrechnungskurs",
  /Datacurve \d{2}\.\d{2}\./.test(chart.footer) &&
    chart.footer.includes("1 USD = 0,876 €"),
  chart.footer || "keine Fußzeile gefunden",
);

await page.screenshot({ path: "playwright-tests/qa/deployed-pareto.png" });

// (4) Die Historien-Folie: eigener Alias, eigene Chart-Klasse (`.mh-chart`,
// damit der `querySelector` oben nicht hier landet), neun Stationen ab v1.1.
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
  "Historien-Folie hat neun Stationen",
  hist.stations === 9,
  `${hist.stations}`,
);
check(
  "startet auf dem v1.1-Stand vom 15.06.",
  hist.active.startsWith("15.06.") && hist.note.includes("1/9"),
  `${hist.active} · ${hist.note.slice(0, 60)}`,
);
await page.screenshot({ path: "playwright-tests/qa/deployed-history.png" });

// (4b) Neunter Klick: die Lupe „Die Effort-Falle“ mit astras fünf Stufen.
await page.goto(`${DECK}/pareto-historie?clicks=9`, {
  waitUntil: "networkidle",
});
await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
await page.waitForTimeout(500);
const lens = await page.evaluate(() => ({
  panel: !!document.querySelector("svg.mh-chart .mh-lens"),
  steps: document.querySelectorAll("svg.mh-chart .mh-lens-dot").length,
  note:
    document
      .querySelector(".mh-note")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? "",
}));
check(
  "Lupe zeigt fünf Effort-Stufen und die eigene Notiz",
  lens.panel && lens.steps === 5 && lens.note.includes("Effort-Falle"),
  `panel=${lens.panel} · ${lens.steps} Stufen · ${lens.note.slice(0, 50)}`,
);
await page.screenshot({
  path: "playwright-tests/qa/deployed-history-lens.png",
});

// (4c) Zehnter Klick: Detailmodus mit dem Schlusstext „Aktueller Stand“, der
// die Klammer zur Hauptfolie schließt — Lupe aus, Namen-Schalter an.
await page.goto(`${DECK}/pareto-historie?clicks=10`, {
  waitUntil: "networkidle",
});
await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
await page.waitForTimeout(500);
const closing = await page.evaluate(() => ({
  panel: !!document.querySelector("svg.mh-chart .mh-lens"),
  toggleOn: !!document.querySelector("button.mh-tg.on"),
  note:
    document
      .querySelector(".mh-note")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? "",
}));
check(
  "Schlusstext „Aktueller Stand“ im Detailmodus, Lupe aus",
  !closing.panel &&
    closing.toggleOn &&
    closing.note.includes("Aktueller Stand"),
  `panel=${closing.panel} · Schalter ${closing.toggleOn ? "an" : "aus"} · ${closing.note.slice(0, 50)}`,
);
await page.screenshot({
  path: "playwright-tests/qa/deployed-history-closing.png",
});

// (5) Die Bonusfolie v1 gegen v1.1: dieselbe Komponente, zwei Stationen, der
// v1-Stand trägt den Warnhinweis im Chart.
await page.goto(`${DECK}/pareto-v1-bonus`, { waitUntil: "networkidle" });
await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
await page.waitForTimeout(500);
const bonus = await page.evaluate(() => ({
  stations: document.querySelectorAll(".mh-tl-item").length,
  active:
    document
      .querySelector(".mh-tl-item.active .mh-tl-date")
      ?.textContent?.trim() ?? "",
  warn: !!document.querySelector("svg.mh-chart .mh-warn"),
}));
check(
  "Bonusfolie hat zwei Stationen und startet auf v1 mit Warnhinweis",
  bonus.stations === 2 && bonus.active.startsWith("v1") && bonus.warn,
  `${bonus.stations} · ${bonus.active} · warn=${bonus.warn}`,
);
await page.screenshot({ path: "playwright-tests/qa/deployed-v1-bonus.png" });

await browser.close();
console.log(failures === 0 ? "\nDEPLOY OK" : `\n${failures} FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
