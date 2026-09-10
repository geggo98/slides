// Verifiziert den GitHub-Pages-Deploy der Modell-Routing-Folien im echten
// Browser: rendert das Xref-Ziel, stimmen die Preise, steht die Pareto-Front,
// klickt sich die Historien-Folie durch alle Datenstände aus `SNAPSHOTS`, und
// rendert die Bonusfolie v1 gegen v1.1?
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
import {
  CURRENT,
  SNAPSHOTS,
  tip,
  V1_COMPARE,
} from "../20260408-agents-details/components/paretoData";

const BASE = process.env.BASE ?? "https://geggo98.github.io/slides";
const DECK = `${BASE}/20260408-agents-details`;

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// `ModelRoutingHistory` steht auf ZWEI Folien — `pareto-historie` (SNAPSHOTS,
// Folie 43) und `pareto-v1-bonus` (V1_COMPARE, Folie 60). Beide rendern
// `.mh-tl-item`, `.mh-note`, `button.mh-tg` und `svg.mh-chart`; die
// Historien-Folie liegt in DOM-Reihenfolge davor. Solange nur die Nachbarn
// gemountet sind, geht eine dokumentweite Suche gut — bis Slidev nachlädt.
// Gemessen am 10.09.2026 gegen die veröffentlichte Seite (6f534c1): bis 2 s
// liegen 3 Folien im DOM, ab 4 s alle 63, und dann liest die Bonusfolie
//
//   Stationen  dokumentweit 11 statt 2
//   aktiv      „03.09.“ aus der Historien-Folie statt „v1 · 11.06.“
//   mh-tg.on   true, obwohl der Schalter DIESER Folie aus ist
//
// — zweimal falsch rot, einmal falsch grün. Deshalb vor jedem `evaluate` die
// sichtbare Folie bestimmen und alles darüber suchen. Ein Klassenmarker für
// „aktiv“ existiert nicht: Slidev versteckt per `v-show`, die verborgenen
// Wrapper tragen also ein inline `display: none`, die sichtbare nicht.
const visibleSlideNo = async (): Promise<string> => {
  const handle = await page.waitForFunction(
    () => {
      const vis = Array.from(
        document.querySelectorAll("[data-slidev-no]"),
      ).filter((el) => getComputedStyle(el).display !== "none");
      // Während eines Folienübergangs sind kurz zwei sichtbar; erst bei genau
      // einer steht die Antwort fest.
      return vis.length === 1 ? vis[0]!.getAttribute("data-slidev-no") : null;
    },
    null,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as string;
};

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
  // Slidev hält Nachbarfolien gemountet — die nächste sofort, nach 3 s alle
  // 63, per v-show versteckt. Dokumentweit sah die Fußzeilensuche dann neun
  // Kandidaten, drei davon Container des ganzen Decks (gemessen 07.09.2026
  // gegen die veröffentlichte Seite); nur die Kürzeste-gewinnt-Regel traf
  // noch das Richtige. Legende und Fußzeile deshalb in der eigenen Folie
  // suchen: `data-slidev-no` sitzt auf jedem Wrapper, in /print wie im
  // Vortragsmodus.
  const slide = svg?.closest("[data-slidev-no]") ?? document;
  const q = (sel: string) =>
    Array.from(svg?.querySelectorAll(sel) ?? []).map(
      (e) => e.textContent?.trim() ?? "",
    );
  return {
    titles: q("title"),
    frontLabels: q("text.mp-label-front"),
    frontPts: svg?.querySelectorAll("circle.mp-front-pt").length ?? 0,
    ghosts: svg?.querySelectorAll("circle.mp-old-pt").length ?? 0,
    hits: svg?.querySelectorAll("circle.mp-hit").length ?? 0,
    legend:
      slide.querySelector(".mp-legend")?.textContent?.replace(/\s+/g, " ") ??
      "",
    // Kürzester Treffer: `textContent` matcht sonst auch jeden Eltern-
    // Container, und die Meldung spuckt die halbe Folie aus.
    footer:
      Array.from(slide.querySelectorAll("p, div"))
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
// Und in beide Richtungen: Ein Deploy, der einen Punkt zeigt, den das Repo
// nicht mehr führt, hätte alle Tooltips des Repos und käme trotzdem durch.
// Jeder gezeichnete Punkt trägt genau ein Klickziel (`circle.mp-hit`).
check(
  `genau die ${CURRENT.length} Punkte aus paretoData.ts, mit Preis und Score`,
  missing.length === 0 && chart.hits === CURRENT.length,
  [
    missing.length ? `fehlt: ${missing.map((p) => tip(p)).join(" · ")}` : "",
    `${chart.hits} Klickziele gerendert`,
  ]
    .filter(Boolean)
    .join(" · "),
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
// damit der `querySelector` oben nicht hier landet). Wie viele Stationen es
// sind und wo sie beginnt, sagt `SNAPSHOTS` — „sieben“ und „neun“ standen hier
// je einmal als Zahl und waren beim nächsten Stand falsch. Die Timeline muss
// die Stationen in derselben Reihenfolge führen wie der Datensatz.
const histDates = SNAPSHOTS.map((s) => s.date);
const last = SNAPSHOTS[SNAPSHOTS.length - 1];
if (!last) throw new Error("SNAPSHOTS ist leer");
await page.goto(`${DECK}/pareto-historie`, { waitUntil: "networkidle" });
await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
await page.waitForTimeout(500);
const histNo = await visibleSlideNo();
const hist = await page.evaluate((no) => {
  const slide = document.querySelector(`[data-slidev-no="${no}"]`) ?? document;
  return {
    dates: Array.from(slide.querySelectorAll(".mh-tl-item .mh-tl-date")).map(
      (e) => e.textContent?.trim() ?? "",
    ),
    active:
      slide
        .querySelector(".mh-tl-item.active .mh-tl-date")
        ?.textContent?.trim() ?? "",
    note:
      slide
        .querySelector(".mh-note")
        ?.textContent?.replace(/\s+/g, " ")
        .trim() ?? "",
  };
}, histNo);
check(
  `Historien-Folie führt alle ${SNAPSHOTS.length} Stationen in Reihenfolge`,
  hist.dates.join("|") === histDates.join("|"),
  hist.dates.join(" · "),
);
check(
  `startet auf „${histDates[0]}“ mit Schritt 1/${SNAPSHOTS.length}`,
  hist.active === histDates[0] && hist.note.includes(`1/${SNAPSHOTS.length}`),
  `${hist.active} · ${hist.note.slice(0, 60)}`,
);
await page.screenshot({ path: "playwright-tests/qa/deployed-history.png" });

// (4b) Der Klick nach der letzten Station ist die Lupe, sofern der letzte
// Stand eine trägt (`ModelRoutingHistory.vue`: Schritt `list.length`). Sie
// zeigt einen Punkt je Stufe der Leiter und ihren eigenen Titel im Kasten.
const lensData = last.lens;
const lensClick = SNAPSHOTS.length;
if (lensData) {
  await page.goto(`${DECK}/pareto-historie?clicks=${lensClick}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
  await page.waitForTimeout(500);
  const lensNo = await visibleSlideNo();
  const lens = await page.evaluate((no) => {
    const slide =
      document.querySelector(`[data-slidev-no="${no}"]`) ?? document;
    return {
      panel: !!slide.querySelector("svg.mh-chart .mh-lens"),
      steps: slide.querySelectorAll("svg.mh-chart .mh-lens-dot").length,
      note:
        slide
          .querySelector(".mh-note")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "",
    };
  }, lensNo);
  check(
    `Lupe (Klick ${lensClick}) zeigt ${lensData.ladder.length} Stufen von ${lensData.focus} und ihren Titel`,
    lens.panel &&
      lens.steps === lensData.ladder.length &&
      lens.note.includes(lensData.title),
    `panel=${lens.panel} · ${lens.steps} Stufen · ${lens.note.slice(0, 50)}`,
  );
  await page.screenshot({
    path: "playwright-tests/qa/deployed-history-lens.png",
  });
}

// (4c) Der Klick danach ist der Detailmodus mit dem Schlusstext, der die
// Klammer zur Hauptfolie schließt — Lupe aus, Namen-Schalter an.
const closingData = last.closing;
const closingClick = SNAPSHOTS.length + (lensData ? 1 : 0);
if (closingData) {
  await page.goto(`${DECK}/pareto-historie?clicks=${closingClick}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
  await page.waitForTimeout(500);
  const closingNo = await visibleSlideNo();
  const closing = await page.evaluate((no) => {
    const slide =
      document.querySelector(`[data-slidev-no="${no}"]`) ?? document;
    return {
      panel: !!slide.querySelector("svg.mh-chart .mh-lens"),
      toggleOn: !!slide.querySelector("button.mh-tg.on"),
      note:
        slide
          .querySelector(".mh-note")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "",
    };
  }, closingNo);
  check(
    `Schlusstext „${closingData.title}“ (Klick ${closingClick}) im Detailmodus, Lupe aus`,
    !closing.panel &&
      closing.toggleOn &&
      closing.note.includes(closingData.title),
    `panel=${closing.panel} · Schalter ${closing.toggleOn ? "an" : "aus"} · ${closing.note.slice(0, 50)}`,
  );
  await page.screenshot({
    path: "playwright-tests/qa/deployed-history-closing.png",
  });
}

// (5) Die Bonusfolie v1 gegen v1.1: dieselbe Komponente über `V1_COMPARE`;
// Stationen, Startstand und Warnhinweis kommen von dort.
const bonusDates = V1_COMPARE.map((s) => s.date);
const bonusFirst = V1_COMPARE[0];
if (!bonusFirst) throw new Error("V1_COMPARE ist leer");
await page.goto(`${DECK}/pareto-v1-bonus`, { waitUntil: "networkidle" });
await page.waitForSelector("svg.mh-chart", { timeout: 30_000 });
await page.waitForTimeout(500);
const bonusNo = await visibleSlideNo();
// Die Wache, die diese Fehlerklasse überhaupt erst gefangen hätte: Sobald
// beide Aliase auf derselben Folie landen, wäre das Scoping oben still
// wirkungslos — und alle Checks blieben grün.
check(
  "Historien- und Bonusfolie sind verschiedene Folien",
  histNo !== bonusNo,
  `pareto-historie = ${histNo}, pareto-v1-bonus = ${bonusNo}`,
);
const bonus = await page.evaluate((no) => {
  const slide = document.querySelector(`[data-slidev-no="${no}"]`) ?? document;
  return {
    dates: Array.from(slide.querySelectorAll(".mh-tl-item .mh-tl-date")).map(
      (e) => e.textContent?.trim() ?? "",
    ),
    active:
      slide
        .querySelector(".mh-tl-item.active .mh-tl-date")
        ?.textContent?.trim() ?? "",
    warn: !!slide.querySelector("svg.mh-chart .mh-warn"),
  };
}, bonusNo);
check(
  `Bonusfolie führt ${V1_COMPARE.length} Stationen, startet auf „${bonusFirst.date}“${bonusFirst.warn ? " mit Warnhinweis" : ""}`,
  bonus.dates.join("|") === bonusDates.join("|") &&
    bonus.active === bonusFirst.date &&
    bonus.warn === !!bonusFirst.warn,
  `${bonus.dates.join(" · ")} · aktiv ${bonus.active} · warn=${bonus.warn}`,
);
await page.screenshot({ path: "playwright-tests/qa/deployed-v1-bonus.png" });

await browser.close();
console.log(failures === 0 ? "\nDEPLOY OK" : `\n${failures} FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
