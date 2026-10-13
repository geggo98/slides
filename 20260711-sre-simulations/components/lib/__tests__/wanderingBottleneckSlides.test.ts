/**
 * wanderingBottleneckSlides.test.ts — Drift-Wächter zwischen den Folien der
 * Sim „Wandernde Engpässe“ (SRE-Deck: Setup-Folie, Ursache, Gegenmaßnahmen)
 * und dem Modell.
 *
 *  1. Jede Zahl im Folientext der Setup-Folie und in den Notizen der drei
 *     Folien steht in einer Allow-List: alle exportierten Zahlen des Modells
 *     (rekursiv, also auch SCENARIOS, SCRIPTS und SCRIPT_FIGURES), wenige
 *     abgeleitete Formen (Prozent, Minuten, Schrittnummern) und eine kurze,
 *     begründete Ausnahmeliste (Quellenjahre, HTTP-Status).
 *  2. Schlüsselstellen nennen die RICHTIGE Konstante. Die Allow-List allein
 *     prüft nur Werte: „2 Webserver“ bliebe erlaubt, solange irgendeine
 *     Konstante 2 ist.
 *  3. Drehbücher in den Notizen (Rabattaktion, Kurze Spitzen, Teure
 *     Abfragen, Empfehlungen hängen, Retry-Sturm, Bot-Ansturm): je Schritt
 *     Ziel-Station
 *     (auch Mailversand, oder „kein Engpass“),
 *     Überlastzustand, die Kennzahlen aus SCRIPT_FIGURES und bei eigenen
 *     Fragen (step.ask) Frage und Antwort der Karte wörtlich.
 *  4. routeAliases und Position der drei Folien und der Folie
 *     „Gegenmaßnahmen aus Kundensicht“ dahinter (DeadlineOutcomeViz, eine
 *     Kopie der Monitoring-Folie). Ihre Bezüge auf die Sim (Drehbuch,
 *     Ursachen-Folie) laufen durch die Allow-List und gegen das Drehbuch
 *     der Rabattaktion. Die übrigen Sim-Zahlen der kopierten Notizen
 *     (Zahlungsdienst, Webserver zu Beginn, Kapazität ohne Empfehlungen)
 *     prüft der Test wörtlich in BEIDEN Decks, den Retry-Sturm nur im
 *     SRE-Deck (nur dort gibt es die Jitter-Zeile); der Rest der
 *     Notizen zitiert Quellen, die Zahlen der Grafik selbst prüft
 *     shared/__tests__/deadlineOutcomes.test.ts.
 *  5. „IO-Steal“ gibt es nicht: IO-Konkurrenz zeigt sich im Gast als
 *     Disk-await, nie als steal (KVM: IO-Wartezeit zählt als idle).
 *
 * Jede Prüfung validiert zuerst ihren Filter (Positiv-Kontrolle, Mindestzahl
 * gesehener Treffer) — ein Filter, der strukturell nichts finden kann,
 * meldet sonst dasselbe wie ein sauberer Text.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import * as Modell from "../wanderingBottleneckModel.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import * as StepUi from "../wanderingBottleneckStepUi.js";
import { ROW_KEYS } from "../../../../shared/components/lib/deadlineOutcomes";

const hier = dirname(fileURLToPath(import.meta.url));
const libDir = resolve(hier, "..");
const deckDir = resolve(hier, "..", "..", "..");
const md = readFileSync(resolve(deckDir, "slides.md"), "utf8");
const mdMonitoring = readFileSync(
  resolve(
    deckDir,
    "..",
    "20260329-grafana-lgtm-monitoring-in-k8s-distributed-system",
    "slides.md",
  ),
  "utf8",
);

type Station = "web" | "inv" | "pay" | "mail";
type Schritt = {
  key: string;
  action: Record<string, unknown>;
  expect: Station | "bleibt" | null;
  overload: Partial<Record<Station, string>>; // mail nur mit Mailversand
  ask?: string;
  answer?: string;
};
type Kennzahlen = { key: string; [k: string]: string | number };

const SKRIPTE_ALLE = Modell.SCRIPTS as Record<string, Schritt[]>;
const FIGUREN_ALLE = Modell.SCRIPT_FIGURES as Record<string, Kennzahlen[]>;
const KARTEN = StepUi.STEP_UI as Record<
  string,
  Record<string, { title: string; question: string }>
>;
const SCHRITTE = SKRIPTE_ALLE.rabatt!;
// Texte der Drehbuch-Karte, die die Notizen wörtlich zitieren
const KARTE = KARTEN.rabatt!;
// Tipps der eigenen Fragen (Antwort-Texte der Karte)
const TIPPS = StepUi.TIP_SETS as Record<string, Record<string, string>>;

/* Drehbücher, deren Ablauf die Notizen der Gegenmaßnahmen-Folie zitieren:
 * je Szenario der Kopf seines Stichpunkts und die Kennzahlen, die dort
 * stehen müssen. „teuer“ ohne waste: ≈ 1–2/s Ausläufer der Latenz-
 * Schätzung, kein Lehrpunkt. */
const DREHBUECHER: { sc: string; kopf: string; kennzahlen: string[] }[] = [
  {
    sc: "rabatt",
    kopf: "- Drehbuch (",
    kennzahlen: ["pages", "orders", "rejected", "waste"],
  },
  // Bestellungen, verlorene Bestellungen, Mails verschickt / verloren und
  // die größte Verzögerung einer Mail; Seiten unverändert, kein Lehrpunkt
  {
    sc: "spitzen",
    kopf: "- Drehbuch „Kurze Spitzen“",
    kennzahlen: ["orders", "lost", "mailSent", "mailLost", "delay"],
  },
  {
    sc: "teuer",
    kopf: "- Drehbuch „Teure Abfragen“",
    kennzahlen: ["pages", "orders", "rejected"],
  },
  // ohne rejected (0) und waste (= lost bzw. Teil davon)
  {
    sc: "empfehlung",
    kopf: "- Drehbuch „Empfehlungen hängen“",
    kennzahlen: ["pages", "orders", "lost"],
  },
  // Bestellungen, Abgewiesene, Verlorene; Versuche je Zahlung (amp) und
  // Spitze / Mittel der Retries (wave); Seiten unverändert, kein Lehrpunkt
  {
    sc: "retry",
    kopf: "- Drehbuch „Retry-Sturm“",
    kennzahlen: ["orders", "rejected", "lost", "amp", "wave"],
  },
  // Kundenseiten rechtzeitig, Kunden abgewiesen, Bestellungen, Verlorene
  // und was der Bot abgewiesen bekommt; die Seiten insgesamt (Kunden + Bot)
  // und die rechtzeitigen Bot-Seiten sind kein Lehrpunkt
  {
    sc: "bots",
    kopf: "- Drehbuch „Bot-Ansturm“",
    kennzahlen: ["custPages", "custRej", "orders", "lost", "botRej"],
  },
];
const STATIONSNAME: Record<Station, string> = {
  web: "Webserver",
  inv: "Bestandsprüfung",
  pay: "Zahlungsdienst",
  mail: "Mailversand",
};

/* ===== Folien zerlegen ===== */

type Folie = { frontmatter: string; inhalt: string };

/** Zerlegt eine Slidev-slides.md in Folien (Folie 0 = Headmatter). Ein `---`
 * außerhalb von Code-Fences beginnt eine neue Folie; stehen bis zum nächsten
 * `---` nur YAML-Zeilen, ist das ihr Frontmatter. */
function zerlege(text: string): Folie[] {
  const z = text.split("\n");
  const istSchluessel = (zeile: string) => /^[A-Za-z][\w-]*:(\s|$)/.test(zeile);
  const istYaml = (zeile: string) =>
    istSchluessel(zeile) || /^\s+\S/.test(zeile) || zeile.trim() === "";
  const folien: Folie[] = [];
  let fm: string[] = [];
  let inhalt: string[] = [];
  let fence = false;
  const abschliessen = () =>
    folien.push({ frontmatter: fm.join("\n"), inhalt: inhalt.join("\n") });
  for (let i = 0; i < z.length; i++) {
    const zeile = z[i]!;
    if (/^\s*```/.test(zeile)) fence = !fence;
    if (fence || zeile !== "---") {
      inhalt.push(zeile);
      continue;
    }
    if (i > 0) abschliessen();
    fm = [];
    inhalt = [];
    const ende = z.indexOf("---", i + 1);
    const block = ende > i ? z.slice(i + 1, ende) : [];
    if (block.some(istSchluessel) && block.every(istYaml)) {
      fm = block;
      i = ende;
    }
  }
  abschliessen();
  return folien;
}

/** Notizen = der letzte HTML-Kommentar am Ende der Folie. */
function notizen(f: Folie): string {
  const m = f.inhalt.trimEnd().match(/<!--([\s\S]*?)-->$/);
  return m ? m[1]! : "";
}

/** Sichtbarer Folientext: ohne Notizen, ohne HTML-Tags (mt-4 o. ä.). */
function folientext(f: Folie): string {
  return f.inhalt
    .trimEnd()
    .replace(/<!--[\s\S]*?-->$/, "")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ");
}

/** Whitespace und Notiz-Umbrüche glätten, damit Phrasen über Zeilen gehen. */
const flach = (s: string) => s.replace(/\s+/g, " ");

/** Ein Stichpunkt der Notizen (ab „- <kopf>“ bis zum nächsten „- “ am
 * Zeilenanfang); leer, wenn es ihn nicht gibt. */
function stichpunkt(notiz: string, kopf: string): string {
  const z = notiz.split("\n");
  const a = z.findIndex((x) => x.startsWith(`- ${kopf}`));
  if (a < 0) return "";
  const rest = z.slice(a + 1).findIndex((x) => x.startsWith("- "));
  return z.slice(a, rest < 0 ? undefined : a + 1 + rest).join("\n");
}

const folien = zerlege(md);
const idx = (pred: (f: Folie) => boolean) => folien.findIndex(pred);
const iSetup = idx((f) =>
  f.inhalt.includes("# Setup: Der wandernde Engpass im Online-Shop"),
);
const iUrsache = idx((f) =>
  /^routeAlias: wandernde-engpaesse$/m.test(f.frontmatter),
);
const iGegen = idx((f) =>
  /^routeAlias: engpass-gegenmassnahmen$/m.test(f.frontmatter),
);
const iBreaker = idx((f) =>
  /^routeAlias: circuit-breaker$/m.test(f.frontmatter),
);
const iKunden = idx((f) => /^routeAlias: kundensicht$/m.test(f.frontmatter));
const monFolien = zerlege(mdMonitoring);
const monKunden =
  monFolien.find((f) =>
    /^routeAlias: kundensicht-deadline$/m.test(f.frontmatter),
  ) ?? null;

// Fehlt eine Folie, bleibt sie leer: Dann scheitern die Tests unten mit
// klarer Meldung, statt dass schon das Einsammeln der Tests abbricht.
const LEER: Folie = { frontmatter: "", inhalt: "" };
const setup = folien[iSetup] ?? LEER;
const ursache = folien[iUrsache] ?? LEER;
const gegen = folien[iGegen] ?? LEER;
const kunden = folien[iKunden] ?? LEER;

/* ===== Zahlen lesen ===== */

// Deutsche Schreibweise: 1.000 · 0,5 · 1,5 · 25–40 % · −0,3 (Vorzeichen
// zählt nicht). Ziffern direkt hinter einem Buchstaben (EC2, mulberry32)
// sind Bezeichner, keine Zahlen.
const ZAHL = /(?<![\p{L}\d.,])(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/gu;

function zahlen(text: string): { wert: number; zeile: string }[] {
  const out: { wert: number; zeile: string }[] = [];
  for (const zeile of text.split("\n")) {
    for (const m of zeile.matchAll(ZAHL)) {
      const wert = Number(m[0].replace(/\./g, "").replace(",", "."));
      out.push({ wert, zeile: zeile.trim() });
    }
  }
  return out;
}

/** Zahl deutsch formatieren: 1000 → „1.000“, 1.5 → „1,5“, (2, 1) → „2,0“. */
function de(x: number, nachkomma = -1): string {
  const s = nachkomma >= 0 ? x.toFixed(nachkomma) : String(x);
  const [ganz, rest] = s.split(".");
  const g = ganz!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return rest === undefined ? g : `${g},${rest}`;
}

const norm = (x: number) => Math.round(Math.abs(x) * 1e6) / 1e6;

/* ===== Allow-List ===== */

function sammle(wert: unknown, ziel: Set<number>, tiefe = 0): void {
  if (typeof wert === "number" && Number.isFinite(wert)) ziel.add(norm(wert));
  else if (Array.isArray(wert))
    for (const w of wert) sammle(w, ziel, tiefe + 1);
  else if (wert !== null && typeof wert === "object" && tiefe < 6)
    for (const w of Object.values(wert)) sammle(w, ziel, tiefe + 1);
}

const ERLAUBT = new Set<number>();
sammle({ ...Modell }, ERLAUBT);
// Abgeleitete Formen, die die Folien zitieren:
//  - %steal einer CPU-Phase = Anteil × 100
for (const x of [Modell.NB_STEAL_MIN, Modell.NB_STEAL_MAX] as number[])
  ERLAUBT.add(norm(x * 100));
//  - Rollfenster der Szenarien in Minuten („10-min-Fenster“)
for (const sc of Object.values(Modell.SCENARIOS) as { windowS: number }[])
  ERLAUBT.add(norm(sc.windowS / 60));
//  - Schrittnummern der Drehbücher (0 … n−1)
for (const sk of Object.values(SKRIPTE_ALLE))
  sk.forEach((_, i) => ERLAUBT.add(i));

// Bewusst kurze Ausnahmeliste: Zahlen, die nicht aus dem Modell stammen.
const AUSNAHMEN: Record<string, number[]> = {
  "Quellenjahre: Roser, Nakano & Tanaka 2003; Lawrence & Buss 1994": [
    2003, 1994,
  ],
  "HTTP-Status beim Überlauf der begrenzten Queue": [503],
  "HTTP-Status beim Rate Limit je Client": [429],
};
for (const liste of Object.values(AUSNAHMEN))
  for (const x of liste) ERLAUBT.add(norm(x));

const GEPRUEFT: { wo: string; text: string }[] = [
  { wo: "Setup-Folie (Folientext)", text: folientext(setup) },
  { wo: "Setup-Folie (Notizen)", text: notizen(setup) },
  { wo: "Ursache (Notizen)", text: notizen(ursache) },
  { wo: "Gegenmaßnahmen (Notizen)", text: notizen(gegen) },
];
// Kundensicht-Folie: Kopie der Monitoring-Folie. Durch die Allow-List
// gehen nur die Stichpunkte, die sich auf die Sim beziehen; der Rest zitiert
// Quellen (Timeout-Defaults, RFC, Messungen), die Zahlen der Grafik prüft
// shared/__tests__/deadlineOutcomes.test.ts.
const KUNDEN_BEZUEGE = [
  "Bezug zum Drehbuch der Rabattaktion",
  "Bezug zur Ursachen-Folie",
];
const GEPRUEFT_KUNDEN: { wo: string; text: string }[] = KUNDEN_BEZUEGE.map(
  (kopf) => ({
    wo: `Kundensicht (Notizen, „${kopf}“)`,
    text: stichpunkt(notizen(kunden), kopf),
  }),
);

describe("Folien finden: Position und routeAlias", () => {
  it("alle drei Folien gefunden, direkt hintereinander nach circuit-breaker", () => {
    expect(folien.length).toBeGreaterThan(50); // Zerleger sieht das Deck
    expect(iBreaker).toBeGreaterThan(0);
    expect(iSetup).toBe(iBreaker + 1);
    expect(iUrsache).toBe(iSetup + 1);
    expect(iGegen).toBe(iUrsache + 1);
  });

  it("danach „Gegenmaßnahmen aus Kundensicht“, dann die Section „Diagnose“", () => {
    expect(iKunden).toBe(iGegen + 1);
    const naechste = folien[iKunden + 1]!;
    expect(naechste.frontmatter).toMatch(/^layout: section$/m);
    expect(naechste.inhalt).toMatch(/^# Diagnose/m);
  });

  it("Kundensicht: kundensicht, DeadlineOutcomeViz mit $clicks, Link zur Monitoring-Folie", () => {
    // clicks prüft shared/__tests__/deadlineOutcomes.test.ts
    expect(kunden.frontmatter).toMatch(/^hideInToc: true$/m);
    expect(kunden.inhalt).toMatch(
      /^# Gegenmaßnahmen aus Kundensicht: die Deadline$/m,
    );
    expect(kunden.inhalt).toContain('<DeadlineOutcomeViz :step="$clicks" />');
    expect(kunden.inhalt).toContain('anchor="kundensicht-deadline"');
    for (const g of GEPRUEFT_KUNDEN)
      expect(g.text.length, g.wo).toBeGreaterThan(80);
  });

  it("die Monitoring-Folie „kundensicht-deadline“ gibt es (Linkziel)", () => {
    expect(monFolien.length).toBeGreaterThan(30); // Zerleger sieht das Deck
    expect(monKunden).not.toBeNull();
  });

  it("Ursache: wandernde-engpaesse, ohne Klicks, Komponente ohne variant", () => {
    expect(ursache.frontmatter).toMatch(/^clicks: false$/m);
    expect(ursache.frontmatter).toMatch(/^hideInToc: true$/m);
    expect(ursache.inhalt).toContain("<WanderingBottleneckSim />");
  });

  it("Gegenmaßnahmen: engpass-gegenmassnahmen, variant=remedies", () => {
    expect(gegen.frontmatter).toMatch(/^clicks: false$/m);
    expect(gegen.frontmatter).toMatch(/^hideInToc: true$/m);
    expect(gegen.inhalt).toContain(
      '<WanderingBottleneckSim variant="remedies" />',
    );
  });

  it.each(["wandernde-engpaesse", "engpass-gegenmassnahmen", "kundensicht"])(
    "routeAlias %s kommt im Deck genau einmal vor",
    (alias) => {
      const n = md.match(new RegExp(`^routeAlias: ${alias}$`, "gm"))?.length;
      expect(n).toBe(1);
    },
  );

  it("Setup-Folie hat Folientext, Callout „Die Frage“ und Notizen", () => {
    expect(setup.frontmatter).toMatch(/^hideInToc: true$/m);
    expect(setup.inhalt).toContain(
      '<Callout tone="warning" title="Die Frage">',
    );
    for (const g of GEPRUEFT) expect(g.text.length, g.wo).toBeGreaterThan(300);
    expect(md).not.toContain("ENTWURF");
  });
});

describe("Zahlen auf den Folien ↔ Modell", () => {
  it("Zahlenleser: deutsche Schreibweise, Bereiche, Bezeichner (Kontrolle)", () => {
    const probe = "1.000 req/s, 0,5 s, −0,3 σ, 25–40 %, ×20, EC2, 2003.";
    expect(zahlen(probe).map((z) => z.wert)).toEqual([
      1000, 0.5, 0.3, 25, 40, 20, 2003,
    ]);
    expect(de(1000)).toBe("1.000");
    expect(de(1.5)).toBe("1,5");
    expect(de(2, 1)).toBe("2,0");
  });

  it("Allow-List enthält die Kernkonstanten (Kontrolle)", () => {
    for (const x of [
      Modell.WEB_PER_INSTANCE,
      Modell.INV_PAGES_PER_S,
      Modell.PAY_CAP,
      Modell.LOAD_CAMPAIGN,
      Modell.NACHBAR_LOAD,
    ] as number[])
      expect(ERLAUBT.has(norm(x))).toBe(true);
    expect(ERLAUBT.has(4711)).toBe(false);
  });

  it("jede Zahl stammt aus dem Modell oder der Ausnahmeliste", () => {
    const alle = [...GEPRUEFT, ...GEPRUEFT_KUNDEN].flatMap((g) =>
      zahlen(g.text).map((z) => ({ ...z, wo: g.wo })),
    );
    // auch die Bezüge der Kundensicht müssen Zahlen liefern, sonst prüft
    // die Liste dort nichts
    expect(
      alle.filter((z) => z.wo.startsWith("Kundensicht")).length,
    ).toBeGreaterThan(9);
    // Der Leser muss überhaupt etwas sehen, sonst ist „keine Abweichung“ leer.
    expect(alle.length).toBeGreaterThan(100);
    const fremd = alle
      .filter((z) => !ERLAUBT.has(norm(z.wert)))
      .map((z) => `${z.wo}: ${z.wert} in „${z.zeile}“`);
    expect(fremd).toEqual([]);
  });
});

describe("Kundensicht ↔ Drehbuch der Rabattaktion", () => {
  const M = Modell;
  const i = (k: string) => SCHRITTE.findIndex((s) => s.key === k);
  const fig = (sc: string, k: string) => {
    const f = FIGUREN_ALLE[sc]!.find((x) => x.key === k)!;
    return (name: string) => f[name] as number;
  };
  const notiz = flach(stichpunkt(notizen(kunden), KUNDEN_BEZUEGE[0]!));
  const notizAlle = flach(notizen(kunden));

  it("Schrittnummern im Drehbuch-Bezug der Notizen", () => {
    for (const k of ["scale", "bpInv", "shedBrowse", "featureShed"])
      expect(i(k), k).toBeGreaterThan(0);
    expect(notiz).toContain(`ohne Maßnahme ≙ Schritt ${i("scale")}`);
    expect(notiz).toContain(
      `≙ Schritte ${i("bpInv")}–${i("shedBrowse")}: ${de(M.INV_PAGES_PER_S)} rechtzeitig, ${de(fig("rabatt", "bpInv")("rejected"))} sofort abgewiesen`,
    );
    expect(notiz).toContain(
      `Feature Shedding ≙ Schritt ${i("featureShed")}: Die DB schafft ${de(M.INV_PAGES_PER_S_FS)}`,
    );
  });

  it("die Schritte zeigen, was die Zeilen der Grafik behaupten", () => {
    // ohne Maßnahme: nichts rechtzeitig, die DB rechnet für den Papierkorb
    const s = fig("rabatt", "scale");
    expect(s("pages") + s("orders")).toBe(0);
    expect(s("waste")).toBe(M.INV_PAGES_PER_S);
    expect(notiz).toContain(`${de(s("waste"))}/s Arbeit für den Papierkorb`);
    // Back Pressure / Shedding: ≈ Kapazität rechtzeitig, Rest abgewiesen
    for (const k of ["bpInv", "shedBrowse"]) {
      const f = fig("rabatt", k);
      expect(
        Math.abs(f("pages") + f("orders") - M.INV_PAGES_PER_S),
        k,
      ).toBeLessThanOrEqual(0.05 * M.INV_PAGES_PER_S);
      expect(
        Math.abs(f("rejected") - (M.LOAD_CAMPAIGN - M.INV_PAGES_PER_S)),
        k,
      ).toBeLessThanOrEqual(0.05 * M.LOAD_CAMPAIGN);
      expect(f("waste"), k).toBe(0);
    }
    // Feature Shedding: alle Produktseiten kommen durch, die Kasse klemmt
    const fs = fig("rabatt", "featureShed");
    expect(fs("pages")).toBeGreaterThanOrEqual(M.CAMPAIGN_PAGES);
    expect(SCHRITTE[i("featureShed")]!.expect).toBe("pay");
    expect(notiz).toContain(
      `${M.CAMPAIGN_CHECKOUTS} Checkouts/s gegen ${de(M.PAY_CAP)}`,
    );
    expect(notizAlle).toContain(
      `${de(M.LOAD_CAMPAIGN)} req/s, die Bestands-DB schafft ${de(M.INV_PAGES_PER_S)} Produktseiten/s`,
    );
  });

  it.each([
    { deck: "SRE", f: kunden },
    { deck: "Monitoring", f: monKunden ?? LEER },
  ])("$deck: Klick-Notizen nennen die Sim-Konstanten", ({ f }) => {
    const n = flach(notizen(f));
    expect(n).toContain(`ohne Empfehlungen ${de(M.INV_PAGES_PER_S_FS)}.`);
    expect(n).toContain(`begrenzen sie bei ${de(M.WEB_CAP_START)} req/s`);
    expect(n).toContain(`Zahlungsdienst (${de(M.PAY_CAP)} req/s)`);
  });

  it("SRE: Bezug zur Ursachen-Folie nennt die richtigen Klicks", () => {
    const b = flach(stichpunkt(notizen(kunden), KUNDEN_BEZUEGE[1]!));
    expect(b).toContain(`(Klick ${ROW_KEYS.indexOf("mixedShared")})`);
    expect(b).toContain(`(Klick ${ROW_KEYS.indexOf("mixedSeparated")})`);
  });

  it("SRE: Retry-Sturm liegt auf der vorigen Folie", () => {
    expect(iGegen).toBe(iKunden - 1);
    expect(notizAlle).toContain(
      "zeigt die Sim auf der vorigen Folie (Preset „Retry-Sturm“)",
    );
  });

  // Nur im SRE-Deck: Die Monitoring-Fassung zeigt keine Jitter-Zeile.
  it.each([{ deck: "SRE", f: kunden }])(
    "$deck: Jitter-Punkt zitiert die aktuellen Zahlen des Retry-Sturms",
    ({ f }) => {
      const b = fig("retry", "backoff");
      const j = fig("retry", "jitter");
      const n = flach(notizen(f));
      expect(n).toContain(
        `Spitze/Mittel etwa ${de(b("wave"))} → ${de(j("wave"))}`,
      );
      expect(n).toContain(
        `etwa ${de(b("amp"))} Versuche je Zahlung mit Backoff, ${de(j("amp"))} mit Jitter`,
      );
      expect(n).toContain(
        `Retry-Budget nimmt die Verstärkung heraus (×${de(M.RETRY_BUDGET_AMP)})`,
      );
    },
  );
});

describe("Schlüsselstellen nennen die richtige Konstante", () => {
  const M = Modell;
  const text = {
    setup: flach(folientext(setup)),
    setupNotiz: flach(notizen(setup)),
    ursache: flach(notizen(ursache)),
    gegen: flach(notizen(gegen)),
  };
  const fenster = (k: string) =>
    (
      M.SCENARIOS as Record<
        string,
        { windowS: number; prerollS: number; tempo: number }
      >
    )[k]!;
  // Tempo, wie die Notizen es nennen: ×1 ist Echtzeit, kein Zeitraffer
  const tempoText = (k: string) =>
    fenster(k).tempo === 1
      ? "Echtzeit (×1)"
      : `Zeitraffer ×${fenster(k).tempo}`;
  const iScale = SCHRITTE.findIndex((s) => s.key === "scale");

  const PFLICHT: [keyof typeof text, string][] = [
    // Setup-Folie: Kette und Stichpunkte
    ["setup", `${de(M.WEB_PER_INSTANCE)} req/s je Instanz`],
    ["setup", `${de(M.INV_PAGES_PER_S)} Produktseiten/s`],
    ["setup", `extern, ${de(M.PAY_CAP)} req/s`],
    ["setup", `konstant **${de(M.NACHBAR_LOAD)} req/s**`],
    ["setup", `**${M.N_WEB_CAUSE} Webserver**`],
    ["setup", `**${de(M.LOAD_NORMAL)} → ${de(M.LOAD_CAMPAIGN)} req/s**`],
    ["setup", `**${M.N_WEB_START} Webservern**`],
    ["setup", `${M.CONV_PCT} % der Produktseiten`],
    // Setup-Notizen: Kopfrechnen
    [
      "setupNotiz",
      `${M.N_WEB_CAUSE} × ${M.WEB_PER_INSTANCE} = ${de(M.WEB_CAP_CAUSE)} req/s Webserver gegen ${de(M.NACHBAR_LOAD)}`,
    ],
    [
      "setupNotiz",
      `kostet ${de(M.INV_PAGE_E)} E (Bestand ${de(M.INV_AVAIL_E)} + Empfehlungen ${de(M.INV_RECO_E)})`,
    ],
    [
      "setupNotiz",
      `schafft ${de(M.INV_CAP_E)} E/s, also ${de(M.INV_PAGES_PER_S)} Produktseiten/s`,
    ],
    [
      "setupNotiz",
      `${M.N_WEB_START} × ${M.WEB_PER_INSTANCE} = ${de(M.WEB_CAP_START)} req/s Webserver gegen ${de(M.LOAD_CAMPAIGN)}`,
    ],
    [
      "setupNotiz",
      `${M.CONV_PCT} % von ${de(M.CAMPAIGN_PAGES)} Produktseiten ≈ ${M.CAMPAIGN_CHECKOUTS} Checkouts/s gegen ${de(M.PAY_CAP)}`,
    ],
    ["setupNotiz", `das ist Schritt ${iScale} im Drehbuch`],
    ["setupNotiz", `Schritt 0 fragt nur „${KARTE.start!.question}“`],
    // Ursache-Notizen
    [
      "ursache",
      `konstant ${de(M.NACHBAR_LOAD)} req/s, ${M.N_WEB_CAUSE} Webserver, Zeitraffer ×${fenster("nachbar").tempo}`,
    ],
    ["ursache", `im ${fenster("nachbar").windowS / 60}-min-Fenster`],
    [
      "ursache",
      `${de(Math.round(M.NB_STEAL_MIN * 100))}–${de(Math.round(M.NB_STEAL_MAX * 100))} %`,
    ],
    [
      "ursache",
      `${de(M.NB_AWAIT_MIN, 1)}- bis ${de(M.NB_AWAIT_MAX, 1)}-Fache von ${de(M.DB_AWAIT_BASE_MS)} ms`,
    ],
    ["ursache", `„Nur Zufall“: Nachbar aus, ${de(M.ZUFALL_LOAD)} req/s`],
    ["ursache", `z ≤ −${de(Math.abs(M.MURPHY_LOW_Z))} σ`],
    ["ursache", `nach ${fenster("nachbar").prerollS / 60} min Vorlauf`],
    ["ursache", `mindestens ${M.START_MIN_SHIFTS} Engpass-Wechsel zeigt`],
    ["ursache", `höchstens ${M.START_MAX_TRIES} Versuche`],
    ["ursache", `mit voller Stärke für ${M.MURPHY_STRIKE_S} s`],
    ["ursache", `Frühestens ${M.MURPHY_GAP_S} s nach Ende des letzten Schlags`],
    ["ursache", `spätestens ${M.MURPHY_MAX_WAIT_S} s nach diesem Ende`],
    ["ursache", `hier den Webservern +${M.HEADROOM_PCT} %`],
    [
      "ursache",
      `„Schutzkapazität +${M.HEADROOM_PCT} % überall“, im Preset „Nur Zufall“`,
    ],
    // Gegenmaßnahmen-Notizen (ohne die Drehbuch-Kennzahlen, siehe unten)
    ["gegen", `Zeitraffer ×${fenster("rabatt").tempo}`],
    [
      "gegen",
      `Frage (Schritt 0 „${KARTE.start!.question}“, danach „${KARTE.scale!.question}“)`,
    ],
    ["gegen", `Knöpfe 0 … ${SCHRITTE.length - 1} im Kopf der Karte`],
    ["gegen", `„Scaling ${M.N_WEB_START}→${M.SCALE_TARGET}“`],
    ["gegen", `„Schutzkap. +${M.HEADROOM_PCT} %“`],
    ["gegen", `Kunden geben nach ${M.ABANDON_S} s auf`],
    ["gegen", `nach mehr als ${M.DEADLINE_S} s — zu spät`],
    ["gegen", `Scaling ${M.N_WEB_START} → ${M.SCALE_TARGET}, reaktiv`],
    [
      "gegen",
      `Erkennen ${M.SCALE_DETECT_S} s + Kaltstart ${M.SCALE_COLD_S} s + Aufwärmen ${M.SCALE_WARMUP_S} s`,
    ],
    ["gegen", `starten bei ${M.SCALE_WARM_START_PCT} %`],
    ["gegen", `volle Kapazität nach ${M.SCALE_REACTIVE_S} s`],
    [
      "gegen",
      `${M.SCALE_TARGET} × ${M.WEB_PER_INSTANCE} = ${de(M.WEB_CAP_SCALED)} req/s gegen ${de(M.LOAD_CAMPAIGN)}`,
    ],
    ["gegen", `höchstens ${de(M.DB_PERMIT_S)} s Arbeit in der DB`],
    ["gegen", `Eingangs-Queue (${de(M.EDGE_BOUND_S)} s)`],
    [
      "gegen",
      `kostet ${de(M.INV_AVAIL_E)} E statt ${de(M.INV_PAGE_E)} E, die DB schafft ${de(M.INV_PAGES_PER_S_FS)} Seiten/s`,
    ],
    [
      "gegen",
      `${M.CONV_PCT} % davon wollen zahlen: ${M.CAMPAIGN_CHECKOUTS} Checkouts/s gegen ${de(M.PAY_CAP)} extern`,
    ],
    ["gegen", `Mehr als ${M.SCALE_TARGET} Webserver ändern daran nichts`],
    [
      "gegen",
      `${M.SCALE_DETECT_S} + ${M.SCALE_COLD_S} + ${M.SCALE_WARMUP_S} = ${M.SCALE_REACTIVE_S} s bis volle Kapazität, vorgewärmt (Warm Pool) ${M.SCALE_PREWARM_S} s`,
    ],
    ["gegen", `Reservierung im Checkout (${de(M.INV_RESERVE_E, 1)} E)`],
    // Teure Abfragen
    [
      "gegen",
      `${M.N_WEB_TEUER} Webserver, Back Pressure an DB und Kasse ist an`,
    ],
    ["gegen", `${de(M.LOAD_NORMAL)} → ${de(M.TEUER_LOAD)} req/s`],
    [
      "gegen",
      `${M.SCALE_TARGET_TEUER} × ${M.WEB_PER_INSTANCE} = ${de(M.WEB_CAP_TEUER_SCALED)} req/s`,
    ],
    ["gegen", `aus ${M.BATCH_WINDOW_MS} ms als ein Bündel`],
    [
      "gegen",
      `Overhead (${de(M.INV_OVERHEAD_E)} E) teilt sich, je Artikel bleiben ${de(M.INV_PER_ITEM_E)} E`,
    ],
    ["gegen", `jede Seite wartet +${M.BATCH_LAT_MS} ms`],
    [
      "gegen",
      `${M.CACHE_HIT_PCT} % der Empfehlungen ohne DB-Arbeit, ${de(M.INV_RECO_E)} → ${de(M.INV_RECO_CACHED_E, 2)} E`,
    ],
    [
      "gegen",
      `${M.CONV_PCT} % davon wollen zahlen: ${M.TEUER_CHECKOUTS} Checkouts/s gegen ${de(M.PAY_CAP)}`,
    ],
    // Empfehlungen hängen
    ["gegen", `${tempoText("empfehlung")} — ein Vorfall`],
    ["gegen", `das Diagramm zeigt ${fenster("empfehlung").windowS / 60} min`],
    [
      "gegen",
      `Konstant ${de(M.EMPF_LOAD)} req/s, davon ${M.EMPF_CHECKOUTS} Checkouts, auf ${M.N_WEB_EMPF} Webservern mit je ${M.THREADS_EMPF} Threads`,
    ],
    ["gegen", `„Scaling ${M.N_WEB_EMPF}→${M.SCALE_TARGET_EMPF}“`],
    ["gegen", `antwortet nach ${de(M.REC_SLOW_S)} s statt ${M.REC_LAT_MS} ms`],
    [
      "gegen",
      `${M.EMPF_PAGES} × ${de(M.REC_SLOW_S)} = ${M.EMPF_THREADS_NEEDED} Threads nötig, ${M.N_WEB_EMPF} × ${M.THREADS_EMPF} = ${M.THREADS_EMPF_TOTAL} da`,
    ],
    [
      "gegen",
      `Checkout ${M.BULKHEAD_CHECKOUT_PCT} % der Threads (${M.THREADS_EMPF_CHECKOUT}), Rest ${M.BULKHEAD_REST_PCT} % (${M.THREADS_EMPF_REST})`,
    ],
    ["gegen", `Empfehlungen nach ${M.REC_TIMEOUT_MS} ms abbrechen`],
    [
      "gegen",
      `${M.EMPF_PAGES} × ${de(M.REC_TIMEOUT_S)} = ${M.EMPF_THREADS_TIMEOUT} Threads statt ${M.EMPF_THREADS_NEEDED}`,
    ],
    [
      "gegen",
      `ab ${M.BREAKER_TRIP_PCT} % Fehlern ${M.BREAKER_OPEN_S} s offen, dann ${M.HALF_ADMIT_PCT} % Proben`,
    ],
    ["gegen", `die DB spart ${de(M.INV_RECO_E)} E je Seite`],
    // Retry-Sturm
    [
      "gegen",
      `eigenes Drehbuch 0 … ${SKRIPTE_ALLE.retry!.length - 1}, ${tempoText("retry")} — das Diagramm zeigt ${fenster("retry").windowS / 60} min`,
    ],
    [
      "gegen",
      `Konstant ${de(M.RETRY_LOAD)} req/s, davon ${M.RETRY_CHECKOUTS} Checkouts, gegen einen Zahlungsdienst mit ${M.PAY_CAP}/s`,
    ],
    [
      "gegen",
      `${M.PAY_BROWNOUT_S} s Brownout auf ${M.PAY_BROWNOUT_PCT} %, dann ein Neustart`,
    ],
    [
      "gegen",
      `Timeouts (${M.PAY_TIMEOUT_S} s) sind an, Retries naiv: bis zu ${M.RETRY_MAX_ATTEMPTS} Versuche, sofort`,
    ],
    [
      "gegen",
      `${M.RETRY_MAX_ATTEMPTS} × ${M.RETRY_CHECKOUTS} = ${M.RETRY_STORM_LOAD} Versuche/s gegen ${M.PAY_CAP}`,
    ],
    ["gegen", `${M.RETRY_BASE_S} s, dann ${2 * M.RETRY_BASE_S} s Pause`],
    [
      "gegen",
      `höchstens ${M.RETRY_BUDGET_LOAD} statt ${M.RETRY_STORM_LOAD} Versuche/s`,
    ],
    ["gegen", `solange ihr Anteil unter ${M.RETRY_BUDGET_PCT} % liegt`],
    ["gegen", `„Scaling ${M.N_WEB_RETRY}→${M.SCALE_TARGET_RETRY}“`],
    // Kurze Spitzen
    [
      "gegen",
      `eigenes Drehbuch 0 … ${SKRIPTE_ALLE.spitzen!.length - 1}, ${tempoText("spitzen")} — das Diagramm zeigt ${fenster("spitzen").windowS / 60} min`,
    ],
    [
      "gegen",
      `${de(M.SPITZEN_PAGES)} Produktseiten/s und ${M.SPITZEN_BASE} Checkouts/s`,
    ],
    [
      "gegen",
      `alle ${M.SPITZEN_PERIOD_S / 60} min für ${M.SPITZEN_ON_S} s ${M.SPITZEN_PEAK} Checkouts/s, im Mittel ${M.SPITZEN_AVG}`,
    ],
    ["gegen", `Mailversand (${M.MAIL_CAP} Mails/s), synchron im Checkout`],
    [
      "gegen",
      `${M.MAIL_EXCESS} Mails/s zu viel, nach ${M.SPITZEN_ON_S} s ${M.MAIL_WAVE_BACKLOG} im Rückstau, bis zu ${M.MAIL_WAVE_DELAY_S} s Wartezeit`,
    ],
    [
      "gegen",
      `höchstens ${de(M.MAIL_Q_MAX)} Mails, keine älter als ${M.MAIL_MAX_AGE_S} s`,
    ],
    ["gegen", `bei ${M.MAIL_CAP}/s greift das Alter: ${M.MAIL_Q_EFF} Mails`],
    [
      "gegen",
      `dauerhaft ${M.SPITZEN_PEAK} Checkouts/s gegen ${M.MAIL_CAP} Mails/s`,
    ],
    ["gegen", `„Scaling ${M.N_WEB_SPITZEN}→${M.SCALE_TARGET_SPITZEN}“`],
    // Bot-Ansturm
    [
      "gegen",
      `eigenes Drehbuch 0 … ${SKRIPTE_ALLE.bots!.length - 1}, Zeitraffer ×${fenster("bots").tempo} — das Diagramm zeigt ${fenster("bots").windowS / 60} min`,
    ],
    [
      "gegen",
      `${de(M.BOTS_LOAD)} req/s Kunden (davon ${M.BOTS_CHECKOUTS} Checkouts) auf ${M.N_WEB_BOTS} Webservern`,
    ],
    ["gegen", `${de(M.BOT_RATE)} Produktseiten/s ab`],
    [
      "gegen",
      `${de(M.BOTS_DB_E)} E/s gegen ${de(M.INV_CAP_E)}, ${M.BOT_DB_PCT} % davon vom Bot`,
    ],
    ["gegen", `Token Bucket, ${M.RL_RATE} req/s je Client`],
    ["gegen", `${M.BOT_429}/s bekommen 429`],
    ["gegen", `${M.BOTS_RL_DB_PCT} % ausgelastet`],
    ["gegen", `IO-Schub der Nachbar-VM (Disk-await ×${de(M.IO_BURST_AWAIT)})`],
    ["gegen", `noch ≈ ${M.INV_PAGES_PER_S_IO} Seiten/s`],
    ["gegen", `lässt ${M.BOTS_RL_LOAD} req/s durch`],
    ["gegen", `„Scaling ${M.N_WEB_BOTS}→${M.SCALE_TARGET_BOTS}“`],
    ["gegen", `„Rate Limit ${M.RL_RATE}/s“ gibt es nur hier`],
    // Verlorene genau beim Schritt — „260“ steht dort auch als Durchlass
    // des Limits (alles Durchgelassene geht verloren)
    ...[0, 3].map(
      (i) =>
        [
          "gegen",
          `keine Kundenseite rechtzeitig, ${de(Number(FIGUREN_ALLE.bots![i]!.lost))}/s verloren`,
        ] as [keyof typeof text, string],
    ),
  ];

  it.each(PFLICHT)("%s enthält „%s“", (wo, phrase) => {
    expect(text[wo]).toContain(phrase);
  });
});

/** Absätze „  k Titel …“ (mit Fortsetzungszeilen „    …“) im Stichpunkt,
 * der mit `kopf` beginnt. Andere Stichpunkte dürfen Zeilen haben, die mit
 * einer Zahl beginnen (z. B. „  30 + 60 + 30 = …“). */
function absaetzeVon(kopf: string): Map<number, string> {
  const absaetze = new Map<number, string>();
  let drin = false;
  let k = -1;
  for (const zeile of notizen(gegen).split("\n")) {
    if (zeile.startsWith("- ")) {
      drin = zeile.startsWith(kopf);
      k = -1;
      continue;
    }
    if (!drin) continue;
    const kopfZeile = zeile.match(/^ {2}(\d+) (.*)$/);
    if (kopfZeile) {
      k = Number(kopfZeile[1]);
      absaetze.set(k, kopfZeile[2]!);
    } else if (k >= 0 && /^ {4}\S/.test(zeile)) {
      absaetze.set(k, `${absaetze.get(k)!} ${zeile.trim()}`);
    }
  }
  return absaetze;
}

describe.each(DREHBUECHER)(
  "Drehbuch „$sc“ in den Notizen ↔ SCRIPTS / SCRIPT_FIGURES",
  ({ sc, kopf, kennzahlen }) => {
    const schritte = SKRIPTE_ALLE[sc] ?? [];
    const figuren = FIGUREN_ALLE[sc] ?? [];
    const karte = KARTEN[sc] ?? {};
    const absaetze = absaetzeVon(kopf);
    // Engpass-Station nach jedem Schritt („bleibt“ = wie vorher, null =
    // kein Engpass)
    const ziel: (Station | null)[] = [];
    schritte.forEach((s, i) => {
      ziel.push(s.expect === "bleibt" ? ziel[i - 1]! : s.expect);
    });

    it("ein Absatz je Drehbuch-Schritt, in Reihenfolge", () => {
      expect(schritte.length).toBeGreaterThan(1);
      expect([...absaetze.keys()]).toEqual(schritte.map((_, i) => i));
      expect(figuren.length).toBe(schritte.length);
    });

    it.each(schritte.map((s, i) => [i, s.key] as const))(
      "Schritt %i (%s): Ziel, Überlastzustand und Kennzahlen",
      (i) => {
        const s = schritte[i]!;
        const absatz = absaetze.get(i) ?? "";
        const station = ziel[i] ?? null;
        if (station === null) {
          expect(absatz).toMatch(/→ kein Engpass/);
        } else {
          const name = s.expect === "bleibt" ? "bleibt" : STATIONSNAME[station];
          const zustand = s.overload[station];
          expect(absatz).toMatch(new RegExp(`→ ${name},? ${zustand}`));
        }
        // eigene Frage: Frage und Antwort der Karte wörtlich
        if (s.ask) {
          const antwort = TIPPS[s.ask]?.[s.answer ?? ""];
          expect(antwort, `${s.ask}.${s.answer}`).toBeDefined();
          expect(flach(absatz)).toContain(
            `Frage „${karte[s.key]!.question}“ — Antwort „${antwort}“`,
          );
        }
        // Absatz beginnt mit dem Titel des Schritt-Knopfs der Karte
        expect(absatz.startsWith(`${karte[s.key]!.title} `), absatz).toBe(true);
        const gesehen = new Set(zahlen(absatz).map((z) => norm(z.wert)));
        const fig = figuren[i]!;
        expect(fig.key).toBe(s.key);
        for (const k of kennzahlen) {
          const v = fig[k];
          if (typeof v !== "number" || v === 0) continue;
          expect(gesehen.has(norm(v)), `${k} = ${v}`).toBe(true);
        }
      },
    );
  },
);

describe("Notizen: Karte und Schalter-Leiste ↔ Drehbuch und Komponente", () => {
  const komponente = readFileSync(
    resolve(deckDir, "components", "WanderingBottleneckSim.vue"),
    "utf8",
  );
  const zuege = flach(notizen(gegen));
  // Labels der Schalter-Leiste (CM_GROUPS in der Komponente), wie die
  // Notizen sie zitieren, und ihre Quelltextstelle; „Scaling“ setzt die
  // Komponente aus den Modellkonstanten zusammen.
  // „Scaling“ setzt die Komponente je Szenario aus nWeb und scaleTarget
  // zusammen (itemLabel); in CM_GROUPS steht die Rabattaktion
  const szen = Modell.SCENARIOS as Record<
    string,
    { nWeb: number; scaleTarget?: number }
  >;
  const scaleLabel = (sc: string) =>
    `Scaling ${szen[sc]!.nWeb}→${szen[sc]!.scaleTarget ?? Modell.SCALE_TARGET}`;
  const LEISTE: Record<string, [label: string, quelle: string]> = {
    scale: [
      `Scaling ${Modell.N_WEB_START}→${Modell.SCALE_TARGET}`,
      "label: `Scaling ${N_WEB_START}→${SCALE_TARGET}`",
    ],
    bpInv: ["BP → Bestand", 'label: "BP → Bestand"'],
    bpPay: ["BP → Zahlung", 'label: "BP → Zahlung"'],
    shedBrowse: ["Shed: Produktseiten", 'label: "Shed: Produktseiten"'],
    shedCheckout: ["Shed: Checkouts", 'label: "Shed: Checkouts"'],
    featureShed: ["Feature Shedding", 'label: "Feature Shedding"'],
    cache: ["Cache + Coalescing", 'label: "Cache + Coalescing"'],
    batch: ["Batching", 'label: "Batching"'],
    bulkhead: ["Bulkheads", 'label: "Bulkheads"'],
    timeouts: ["Timeouts", 'label: "Timeouts"'],
    breaker: ["Circuit Breaker", 'label: "Circuit Breaker"'],
    retryBudget: [
      `Retry-Budget ${Modell.RETRY_BUDGET_PCT} %`,
      "label: `Retry-Budget ${RETRY_BUDGET_PCT} %`",
    ],
    smoothing: ["Puffern & glätten", 'label: "Puffern & glätten"'],
    rateLimit: [
      `Rate Limit ${Modell.RL_RATE}/s`,
      "label: `Rate Limit ${RL_RATE}/s`",
    ],
    admission: [
      `Admission ${Modell.ADMISSION_RPS}/s`,
      "label: `Admission ${ADMISSION_RPS}/s`",
    ],
    // segmentiert: das Label hängt am Wert (SEGMENTE)
    retry: ["Retries", 'label: "Retries"'],
  };
  // Segmente des Retry-Modus (Leiste und ⚙), wie die Notizen sie zitieren
  const SEGMENTE: Record<string, [label: string, quelle: string]> = {
    aus: ["aus", 'v: "aus",\n            label: "aus"'],
    naiv: ["naiv", 'v: "naiv",\n            label: "naiv"'],
    backoff: ["Backoff", 'v: "backoff",\n            label: "Backoff"'],
    backoffJitter: [
      "+Jitter",
      'v: "backoffJitter",\n            label: "+Jitter"',
    ],
  };
  const labelVon = (sc: string, k: string, v?: unknown) =>
    k === "scale"
      ? scaleLabel(sc)
      : k === "retry"
        ? SEGMENTE[String(v)]![0]
        : LEISTE[k]![0];

  it("die Labels stehen so in der Komponente (Kontrolle)", () => {
    for (const [, quelle] of Object.values(LEISTE))
      expect(komponente).toContain(quelle);
    for (const [, quelle] of Object.values(SEGMENTE))
      expect(komponente).toContain(quelle);
    expect(Object.keys(SEGMENTE)).toEqual(Modell.RETRY_MODES);
    expect(komponente).toContain(
      "`Scaling ${def.value.nWeb}→${def.value.scaleTarget ?? SCALE_TARGET}`",
    );
    expect(scaleLabel("rabatt")).toBe(LEISTE.scale![0]);
  });

  it.each(DREHBUECHER.map((d) => d.sc))(
    "%s: ab Schritt 1 fragt die Karte dasselbe („danach …“ in den Notizen) — außer bei eigenen Fragen",
    (sc) => {
      const schritte = SKRIPTE_ALLE[sc]!;
      const karte = KARTEN[sc]!;
      expect(schritte.length).toBeGreaterThan(1);
      const eigene = schritte.filter((s) => s.ask);
      if (eigene.length) {
        // jede eigene Frage ist eine andere als die Standardfrage
        const fragen = eigene.map((s) => karte[s.key]!.question);
        expect(new Set(fragen).size).toBe(fragen.length);
        expect(fragen).not.toContain("Wohin wandert der Engpass?");
        expect(schritte[0]!.ask).toBeUndefined(); // Schritt 0 fragt nach der Station
        return;
      }
      for (const s of schritte.slice(1))
        expect(karte[s.key]!.question).toBe(karte[schritte[1]!.key]!.question);
    },
  );

  const mitZug = DREHBUECHER.flatMap(({ sc }) =>
    SKRIPTE_ALLE[sc]!.map((s, i) => [sc, i, s.key] as const).filter(
      ([, i]) => Object.keys(SKRIPTE_ALLE[sc]![i]!.action).length > 0,
    ),
  );
  it("Drehbücher haben Züge mit Schaltern (Kontrolle)", () => {
    expect(mitZug.filter(([sc]) => sc === "rabatt").length).toBeGreaterThan(3);
    expect(mitZug.filter(([sc]) => sc === "teuer").length).toBeGreaterThan(2);
    expect(mitZug.filter(([sc]) => sc === "empfehlung").length).toBe(3);
    expect(mitZug.filter(([sc]) => sc === "retry").length).toBe(4);
    // Kurze Spitzen: ein Schalter-Zug, der zweite ist ein Lastwechsel
    expect(mitZug.filter(([sc]) => sc === "spitzen").length).toBe(1);
    expect(mitZug.filter(([sc]) => sc === "bots").length).toBe(4);
  });
  it.each(mitZug)(
    "%s Schritt %i (%s): Notiz nennt die umgelegten Schalter",
    (sc, i) => {
      const action = SKRIPTE_ALLE[sc]![i]!.action;
      const alle = Object.keys(action).filter((k) => k !== "scaleMode");
      for (const k of alle) expect(LEISTE[k], k).toBeDefined();
      // ausgeschaltete Schalter (Bot-Ansturm: Rate Limit statt Shedding)
      // nennt die Notiz als „Label“ aus
      const keys = alle.filter((k) => action[k] !== false);
      const aus = alle.filter((k) => action[k] === false);
      const labels = keys.map((k) => labelVon(sc, k, action[k]));
      // die Rabattaktion zählt ihre Züge im Stichpunkt „Schalter-Leiste“,
      // die Teuren Abfragen im Absatz ihres Drehbuchs
      const text =
        sc === "rabatt"
          ? zuege
          : flach(
              [...absaetzeVon(DREHBUECHER.find((d) => d.sc === sc)!.kopf)]
                .map(([, a]) => a)
                .join(" "),
            );
      expect(text).toContain(`Schritt ${i} „${labels.join("“ und „")}“`);
      for (const k of aus)
        expect(text).toContain(`„${labelVon(sc, k, action[k])}“ aus`);
    },
  );
});

describe("Begriff „IO-Steal“ ist verboten", () => {
  const VERBOTEN = /I\/?O[- ]?Steal/i;
  // Die Komponente liest der Test als Quelltext: Das deckt auch title-
  // Tooltips, den Erklär-Tab (v-show) und das ⚙-Panel (v-if) ab, die ein
  // innerText-Check im Browser nie sieht.
  const KOMPONENTE = resolve(
    deckDir,
    "components",
    "WanderingBottleneckSim.vue",
  );
  const IO_STEAL_DATEIEN = [
    resolve(libDir, "wanderingBottleneckModel.js"),
    resolve(libDir, "wanderingBottleneckScenarios.js"),
    resolve(libDir, "wanderingBottleneckStepUi.js"),
    KOMPONENTE,
  ];
  const quellen = [
    ...IO_STEAL_DATEIEN.map((p) => ({
      wo: p.slice(deckDir.length + 1),
      text: readFileSync(p, "utf8"),
    })),
    ...[setup, ursache, gegen].map((f, i) => ({
      wo: `slides.md, neue Folie ${i + 1}`,
      text: f.inhalt,
    })),
  ];

  it("Muster greift (Kontrolle)", () => {
    for (const s of ["IO-Steal", "I/O steal", "io steal", "IOSteal"])
      expect(s).toMatch(VERBOTEN);
    expect("IO-Konkurrenz zeigt KEIN steal").not.toMatch(VERBOTEN);
  });

  it.each(quellen.map((q) => [q.wo, q.text] as const))(
    "%s: kein „IO-Steal“",
    (_wo, text) => {
      expect(text.length).toBeGreaterThan(1000);
      expect(text).not.toMatch(VERBOTEN);
    },
  );

  it("Komponente: der Scan sieht die Gast-Metriken (Kontrolle)", () => {
    // Liest der Scan die richtige Datei? Dann stehen dort die erlaubten
    // Begriffe für CPU- und IO-Konkurrenz.
    const text = readFileSync(KOMPONENTE, "utf8");
    expect(text).toContain("%steal");
    expect(text).toContain("Disk-await");
    expect(text).toMatch(/keinen Steal-Zähler/);
  });
});

describe("STEP_UI: Drehbuch-Texte passen in die feste Karte", () => {
  type Felder = Record<string, string>;
  const STEP_UI = StepUi.STEP_UI as Record<string, Record<string, Felder>>;
  const MAX = StepUi.STEP_UI_MAX as Record<string, number>;
  const FAZIT = StepUi.FAZIT as Record<string, string>;
  const FAZIT_MAX = StepUi.FAZIT_MAX as number;
  const SKRIPTE = Modell.SCRIPTS as Record<string, { key: string }[]>;
  const FELDER = Object.keys(MAX);

  /** Verstöße eines Eintrags: fehlende, leere oder zu lange Felder, Felder
   * ohne Grenze, ASCII-Anführungszeichen (deutsche Texte nutzen „…“). */
  function verstoesse(wo: string, u: Felder | undefined): string[] {
    if (!u) return [`${wo}: Eintrag fehlt`];
    const out: string[] = [];
    for (const f of FELDER) {
      const s = u[f];
      if (typeof s !== "string" || !s.trim()) out.push(`${wo}.${f}: leer`);
      else {
        if (s.length > MAX[f]!)
          out.push(`${wo}.${f}: ${s.length} > ${MAX[f]} Zeichen`);
        if (s.includes('"')) out.push(`${wo}.${f}: ASCII-Anführungszeichen`);
      }
    }
    for (const f of Object.keys(u))
      if (!FELDER.includes(f)) out.push(`${wo}.${f}: Feld ohne Grenze`);
    return out;
  }

  it("Prüfung greift (Kontrolle)", () => {
    expect(FELDER).toEqual(
      expect.arrayContaining(["situation", "move", "question", "explain"]),
    );
    const gut: Felder = Object.fromEntries(FELDER.map((f) => [f, "x"]));
    expect(verstoesse("gut", gut)).toEqual([]);
    const lang = { ...gut, explain: "x".repeat(MAX.explain! + 1) };
    expect(verstoesse("lang", lang)).toHaveLength(1);
    expect(verstoesse("quote", { ...gut, move: 'a "b" c' })).toHaveLength(1);
    expect(verstoesse("extra", { ...gut, neu: "x" })).toHaveLength(1);
    expect(verstoesse("fehlt", undefined)).toHaveLength(1);
  });

  it("jedes Drehbuch hat Texte, und nur diese", () => {
    expect(Object.keys(SKRIPTE).length).toBeGreaterThan(0);
    expect(Object.keys(STEP_UI).sort()).toEqual(Object.keys(SKRIPTE).sort());
  });

  it.each(Object.keys(SKRIPTE))(
    "%s: ein Eintrag je Schritt, Feldlängen und Fazit passen",
    (sc) => {
      const schritte = SKRIPTE[sc]!;
      const texte = STEP_UI[sc] ?? {};
      expect(Object.keys(texte).sort()).toEqual(
        schritte.map((s) => s.key).sort(),
      );
      const fehler = schritte.flatMap((s) =>
        verstoesse(`${sc}.${s.key}`, texte[s.key]),
      );
      expect(fehler).toEqual([]);
      const fazit = FAZIT[sc] ?? "";
      expect(fazit.length).toBeGreaterThan(20);
      expect(fazit.length).toBeLessThanOrEqual(FAZIT_MAX);
      expect(fazit).not.toContain('"');
    },
  );

  it("eigene Fragen: Tipps je Ausgang (ASK_KINDS, gleiche Reihenfolge), kurz genug, Antwort vorhanden", () => {
    const ART = Modell.ASK_KINDS as Record<string, string[]>;
    const TIP_MAX = StepUi.TIP_MAX as number;
    expect(Object.keys(TIPPS).sort()).toEqual(Object.keys(ART).sort());
    const fehler: string[] = [];
    for (const [art, ausgaenge] of Object.entries(ART)) {
      // 2 × 2-Raster der Karte
      expect(ausgaenge).toHaveLength(4);
      expect(Object.keys(TIPPS[art]!)).toEqual(ausgaenge);
      for (const [k, t] of Object.entries(TIPPS[art]!)) {
        if (!t.trim()) fehler.push(`${art}.${k}: leer`);
        if (t.length > TIP_MAX)
          fehler.push(`${art}.${k}: ${t.length} > ${TIP_MAX} Zeichen`);
        if (t.includes('"'))
          fehler.push(`${art}.${k}: ASCII-Anführungszeichen`);
      }
    }
    let fragen = 0;
    for (const [sc, schritte] of Object.entries(SKRIPTE_ALLE))
      for (const s of schritte) {
        if (!s.ask) continue;
        fragen++;
        if (!ART[s.ask]) fehler.push(`${sc}.${s.key}: Frage-Art ${s.ask}`);
        else if (!ART[s.ask]!.includes(s.answer ?? ""))
          fehler.push(`${sc}.${s.key}: Antwort ${s.answer}`);
      }
    expect(fragen).toBeGreaterThanOrEqual(3);
    expect(fehler).toEqual([]);
  });
});
