#!/usr/bin/env bun
//
// Archiviert veröffentlichte Zustände des DeepSWE-Boards als NDJSON.
//
// Warum es das gibt
// -----------------
// `paretoData.ts` trägt neun Stände von Hand abgeschriebener Zahlen. Jede
// Prüfung daran hing bisher an einem Ad-hoc-Abruf von web.archive.org — und
// zweimal ist dabei ein falscher Wert ins Deck gewandert, weil niemand die
// Rohdaten danebenlegen konnte (siehe den mean/median-Abschnitt im Kopf von
// `paretoData.ts`). Seit diesem Skript liegen die Rohdaten im Repo, und
// `boardArchive.test.ts` rechnet die Stände daraus nach.
//
// Aufruf
// ------
//   bun run 20260408-agents-details/data/deepswe/fetch.ts --live
//   bun run …/fetch.ts --wayback 20260826141301
//   bun run …/fetch.ts --backfill            # alle CDX-Crawls, sequenziell
//   bun run …/fetch.ts --list                # nur zeigen, was abrufbar ist
//
// Drei gemessene Fallen, die den Aufbau erklären
// ----------------------------------------------
// 1. **Parallelität.** Bei `-P 5` lieferte web.archive.org am 04.09.2026 für
//    28 von 43 Crawls eine 200-Antwort mit leerem Rumpf — kein Fehlercode,
//    keine Meldung. Ein Skript, das das nicht prüft, legt stillschweigend
//    leere Snapshots an. Deshalb: sequenziell, mit Pause, und JEDE Antwort
//    wird gegen `MIN_RECORDS` geprüft, bevor irgendetwas geschrieben wird.
// 2. **gzip.** Die `id_`-Antworten der Wayback Machine sind gzip-komprimiert
//    und werden ohne Dekompression als Binärmüll durchgereicht. `fetch()`
//    dekomprimiert anhand von `Content-Encoding`; wo der Header fehlt, greift
//    `gunzipSync` von Hand. Ohne das meldet der Parser „0 Datensätze" — und
//    das sieht genauso aus wie ein Snapshot ohne Daten.
// 3. **Die Objektliterale sind JavaScript, kein JSON.** Schlüssel stehen ohne
//    Anführungszeichen, verschachtelte Werte tragen ein `$R[n]=` davor, und
//    `cost_basis` enthält `:` und `,` in seinem Text:
//
//      cost_basis:"Expected launch pricing …: $12/M uncached input, …"
//
//    Ein Regex-Splitter zerlegt genau diesen Datensatz falsch. Deshalb unten
//    ein echter Parser — klein, aber er zählt Klammern und kennt Strings.
//    `eval` wäre kürzer und führt heruntergeladenen Code aus; das ist keine
//    Option für ein Skript, das fremde Seiten liest.
// 4. **`generated_at` ist KEINE Zustandskennung.** Gemessen am 04.09.2026:
//    Die Crawls vom 25.07. und vom 01.08.2026 tragen beide
//    `2026-07-25T03:13:49.273952+00:00` — und unterscheiden sich in 20 Feldern.
//    Dazwischen liegt die OpenAI-Preissenkung vom 30.07. (luna −80 %, terra
//    −20 %, siehe Stand 5 des Decks): Das Board rechnet Preise nach, ohne den
//    Stempel anzufassen; er datiert offenbar nur den Score-Lauf. Wer über
//    `generated_at` dedupliziert, verliert genau die Stände, in denen sich
//    ausschließlich Preise bewegt haben — und das ist ein Drittel der
//    Bewegungen dieser Zeitreihe. Der Schlüssel des Archivs ist deshalb der
//    INHALT (sha256); `generated_at` steht daneben, weil es trotzdem etwas
//    aussagt. Das ist die schärfere Fassung der CDN-Warnung im Kopf von
//    `paretoData.ts`: dort war der Stempel in einer Kopie irreführend, hier
//    ist er es auf dem Board selbst.

import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HIER = new URL(".", import.meta.url).pathname;
const INDEX = join(HIER, "index.ndjson");
const LIVE = "https://deepswe.datacurve.ai/";
const CDX =
  "https://web.archive.org/cdx/search/cdx?url=deepswe.datacurve.ai" +
  "&output=json&filter=statuscode:200&collapse=timestamp:8";

/** Weniger als das ist keine Board-Seite, sondern eine kaputte Antwort. */
const MIN_RECORDS = 15;
const PAUSE_MS = 1500;
const VERSUCHE = 4;

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Parser für das JS-Objektliteral-Subset der SSR-Payload
// ---------------------------------------------------------------------------

type JsWert =
  | string
  | number
  | boolean
  | null
  | JsWert[]
  | { [k: string]: JsWert };

class Leser {
  constructor(
    private s: string,
    private i = 0,
  ) {}

  private leer() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  /** `$R[12]=` vor einem Wert überspringen — die Payload teilt Werte so. */
  private ref() {
    const m = /^\$R\[\d+\]=/.exec(this.s.slice(this.i));
    if (m) this.i += m[0].length;
  }

  wert(): JsWert {
    this.leer();
    this.ref();
    this.leer();
    const c = this.s[this.i];
    if (c === "{") return this.objekt();
    if (c === "[") return this.feld();
    if (c === '"') return this.text();
    if (this.s.startsWith("null", this.i)) return ((this.i += 4), null);
    if (this.s.startsWith("true", this.i)) return ((this.i += 4), true);
    if (this.s.startsWith("false", this.i)) return ((this.i += 5), false);
    const m = /^-?(?:Infinity|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      this.s.slice(this.i),
    );
    if (!m)
      throw new Error(
        `Unlesbar bei ${this.i}: ${this.s.slice(this.i, this.i + 40)}`,
      );
    this.i += m[0].length;
    return m[0] === "Infinity" || m[0] === "-Infinity" ? m[0] : Number(m[0]);
  }

  private text(): string {
    this.i++; // "
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === '"') return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = this.s[this.i++];
      if (e === "u") {
        out += String.fromCharCode(
          parseInt(this.s.slice(this.i, this.i + 4), 16),
        );
        this.i += 4;
      } else {
        out += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[e] ?? e;
      }
    }
    throw new Error("String ohne Ende");
  }

  private feld(): JsWert[] {
    this.i++; // [
    const out: JsWert[] = [];
    for (;;) {
      this.leer();
      if (this.s[this.i] === "]") return (this.i++, out);
      out.push(this.wert());
      this.leer();
      if (this.s[this.i] === ",") this.i++;
    }
  }

  objekt(): { [k: string]: JsWert } {
    this.i++; // {
    const out: { [k: string]: JsWert } = {};
    for (;;) {
      this.leer();
      if (this.s[this.i] === "}") return (this.i++, out);
      const k = this.s[this.i] === '"' ? this.text() : this.schluessel();
      this.leer();
      if (this.s[this.i] !== ":") throw new Error(`":" erwartet bei ${this.i}`);
      this.i++;
      out[k] = this.wert();
      this.leer();
      if (this.s[this.i] === ",") this.i++;
    }
  }

  private schluessel(): string {
    const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.s.slice(this.i));
    if (!m) throw new Error(`Schlüssel erwartet bei ${this.i}`);
    this.i += m[0].length;
    return m[0];
  }
}

/** Alle Modell-Datensätze einer Board-Seite, in Reihenfolge des Vorkommens. */
export function parseBoard(html: string): Record<string, JsWert>[] {
  const out: Record<string, JsWert>[] = [];
  const start = /\$R\[\d+\]=\{model:/g;
  let m: RegExpExecArray | null;
  while ((m = start.exec(html))) {
    // Der Parser läuft bis zur schließenden Klammer und findet die selbst;
    // `lastIndex` wird nicht verschoben, verschachtelte $R-Werte tauchen
    // deshalb nicht als eigener Datensatz auf — sie beginnen nicht mit `model:`.
    const roh = html.slice(m.index + m[0].length - "{model:".length);
    out.push(new Leser(roh).objekt() as Record<string, JsWert>);
  }
  return out;
}

export function generatedAt(html: string): string | null {
  return /generated_at["':\s]+([0-9T:.+\-]+)/.exec(html)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Abruf
// ---------------------------------------------------------------------------

async function hole(url: string): Promise<string> {
  let letzter = "";
  for (let v = 1; v <= VERSUCHE; v++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      const roh = Buffer.from(await r.arrayBuffer());
      // gzip-Magic: fetch() dekomprimiert nur, wenn der Header es ankündigt.
      const text =
        roh[0] === 0x1f && roh[1] === 0x8b
          ? gunzipSync(roh).toString("utf8")
          : roh.toString("utf8");
      const n = parseBoard(text).length;
      if (n >= MIN_RECORDS) return text;
      letzter = `HTTP ${r.status}, ${roh.length} Bytes, ${n} Datensätze (< ${MIN_RECORDS})`;
    } catch (e) {
      letzter = String(e);
    }
    if (v < VERSUCHE) await schlaf(2000 * 2 ** (v - 1));
  }
  throw new Error(`${url}\n  nach ${VERSUCHE} Versuchen: ${letzter}`);
}

// ---------------------------------------------------------------------------
// Archiv
// ---------------------------------------------------------------------------

interface Sichtung {
  source: "live" | "wayback";
  timestamp?: string;
  fetched_at: string;
}
interface Eintrag {
  /** `generated_at` des Boards, wörtlich wie geliefert — oder null. */
  generated_at: string | null;
  /**
   * Wie `generated_at` gemeint ist. Das Board hat sein Format zwischen dem
   * 26.08. und dem 03.09.2026 geändert: davor `2026-09-02T15:18:19` ohne
   * Offset, danach `…+00:00`. `naiv` heißt: als UTC gelesen, weil alle
   * datierten Stände dazu passen — aber das Board sagt es nicht, und deshalb
   * steht es hier statt in einer stillen Annahme. `keins` sind die Mai-Stände,
   * die das Feld noch gar nicht hatten.
   */
  tz: "utc" | "naiv" | "keins";
  file: string;
  records: number;
  models: number;
  /** Der Schlüssel. Siehe Falle 4 im Kopf: `generated_at` taugt dafür nicht. */
  sha256: string;
  /** Jeder Abruf, der genau diesen Inhalt gesehen hat — chronologisch. */
  seen: Sichtung[];
}

const lesIndex = (): Eintrag[] => {
  try {
    return readFileSync(INDEX, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Eintrag);
  } catch {
    return [];
  }
};

/** Wann ein Zustand zuerst beobachtet wurde — die echte Chronologie. */
const zuerst = (e: Eintrag) =>
  e.seen.map((s) => s.timestamp ?? s.fetched_at.replace(/\D/g, "")).sort()[0] ??
  "";

const schreibIndex = (e: Eintrag[]) =>
  writeFileSync(
    INDEX,
    e
      .sort((a, b) => zuerst(a).localeCompare(zuerst(b)))
      .map((x) => JSON.stringify(x))
      .join("\n") + "\n",
  );

/**
 * `generated_at` in einen Dateinamen-Bestandteil. Ein anderer Offset als UTC
 * wird abgelehnt statt still als UTC abgelegt — er würde die Sortierung des
 * Archivs verfälschen, ohne dass es jemand sähe.
 */
function stempel(gen: string): { name: string; tz: "utc" | "naiv" } {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|\+00:00)?$/.exec(
      gen,
    );
  if (!m) throw new Error(`generated_at unbekannt geformt: ${gen}`);
  return {
    name: `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}Z`,
    tz: m[7] ? "utc" : "naiv",
  };
}

/** Schlüssel sortieren, damit ein erneuter Abruf byte-gleiche Zeilen liefert. */
const stabil = (o: Record<string, JsWert>) =>
  JSON.stringify(
    Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, o[k]]),
    ),
  );

function ablegen(
  html: string,
  sichtung: Sichtung,
): { neu: boolean; eintrag: Eintrag } {
  const roh = generatedAt(html);
  const saetze = parseBoard(html);
  const inhalt = saetze.map(stabil).join("\n") + "\n";
  const sha = createHash("sha256").update(inhalt).digest("hex");

  const index = lesIndex();
  const da = index.find((e) => e.sha256 === sha);
  if (da) {
    const doppelt = da.seen.some(
      (x) => x.source === sichtung.source && x.timestamp === sichtung.timestamp,
    );
    if (!doppelt) {
      da.seen.push(sichtung);
      da.seen.sort((x, y) =>
        (x.timestamp ?? x.fetched_at).localeCompare(
          y.timestamp ?? y.fetched_at,
        ),
      );
      schreibIndex(index);
    }
    return { neu: false, eintrag: da };
  }

  // Die Mai-Stände sind ein älteres Board-Schema: kein `generated_at`, kein
  // `harness`, keine Effort-Stufe, dafür `selection_notes`. Sie liegen vor dem
  // ersten Stand des Decks und werden trotzdem archiviert — es sind echte
  // Board-Zustände.
  const st = roh ? stempel(roh) : null;
  // Der Stempel steht im Namen, weil er nach Datum sortiert und lesbar macht,
  // worum es geht; die sha-Kurzform daneben, weil derselbe Stempel mehrere
  // Zustände tragen kann (Falle 4).
  const datei = `board-${st ? st.name : "ohne-stempel"}-${sha.slice(0, 8)}.ndjson`;

  writeFileSync(join(HIER, datei), inhalt);
  const eintrag: Eintrag = {
    generated_at: roh,
    tz: st ? st.tz : "keins",
    file: datei,
    records: saetze.length,
    models: new Set(saetze.map((r) => String(r.model))).size,
    sha256: sha,
    seen: [sichtung],
  };
  index.push(eintrag);
  schreibIndex(index);
  return { neu: true, eintrag };
}

const jetzt = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

/**
 * Die Crawl-Liste. Auch hier gilt Falle 1: Unter Last antwortet die CDX-API mit
 * einer HTML-Fehlerseite und Status 200. `JSON.parse` scheitert daran zwar
 * laut, aber erst mitten im Backfill — deshalb dieselbe Retry-Schleife wie beim
 * Seitenabruf, mit einer Meldung, die sagt, was tatsächlich ankam.
 */
async function crawls(): Promise<string[]> {
  let letzter = "";
  for (let v = 1; v <= VERSUCHE; v++) {
    const t = await fetch(CDX).then(
      (r) => r.text(),
      (e) => `FEHLER ${e}`,
    );
    try {
      const zeilen = JSON.parse(t) as string[][];
      if (Array.isArray(zeilen) && zeilen.length > 1)
        return zeilen
          .slice(1)
          .map((z) => z[1])
          .sort();
      letzter = `${zeilen.length} Zeilen`;
    } catch {
      letzter = `keine JSON-Antwort: ${t.slice(0, 120).replace(/\s+/g, " ")}`;
    }
    if (v < VERSUCHE) await schlaf(3000 * 2 ** (v - 1));
  }
  throw new Error(
    `CDX-Abfrage nach ${VERSUCHE} Versuchen erfolglos — ${letzter}`,
  );
}

// ---------------------------------------------------------------------------

// Nur als Programm, nicht beim Import: `boardArchive.test.ts` benutzt
// `parseBoard()` und darf davon nichts abrufen.
const argv = import.meta.main ? process.argv.slice(2) : ["--noop"];
const hat = (f: string) => argv.includes(f);

if (hat("--list")) {
  const ts = await crawls();
  console.log(`${ts.length} Crawls:\n${ts.join("\n")}`);
} else if (hat("--live")) {
  const html = await hole(LIVE);
  const { neu, eintrag } = ablegen(html, {
    source: "live",
    fetched_at: jetzt(),
  });
  console.log(
    `${neu ? "neu" : "bekannt"}  ${eintrag.file}  ${eintrag.records} Datensätze`,
  );
} else if (hat("--wayback")) {
  const ts = argv[argv.indexOf("--wayback") + 1];
  if (!/^\d{14}$/.test(ts ?? ""))
    throw new Error("--wayback braucht einen 14-stelligen Timestamp");
  const html = await hole(`https://web.archive.org/web/${ts}id_/${LIVE}`);
  const { neu, eintrag } = ablegen(html, {
    source: "wayback",
    timestamp: ts,
    fetched_at: jetzt(),
  });
  console.log(
    `${neu ? "neu" : "bekannt"}  ${eintrag.file}  ${eintrag.records} Datensätze`,
  );
} else if (hat("--backfill")) {
  const ts = await crawls();
  const fertig = new Set(
    lesIndex().flatMap(
      (e) => e.seen.map((s) => s.timestamp).filter(Boolean) as string[],
    ),
  );
  const offen = ts.filter((t) => !fertig.has(t));
  console.log(`${ts.length} Crawls, ${offen.length} offen`);
  const fehler: string[] = [];
  for (const [i, t] of offen.entries()) {
    try {
      const html = await hole(`https://web.archive.org/web/${t}id_/${LIVE}`);
      const { neu, eintrag } = ablegen(html, {
        source: "wayback",
        timestamp: t,
        fetched_at: jetzt(),
      });
      console.log(
        `[${i + 1}/${offen.length}] ${t}  ${neu ? "neu    " : "bekannt"}  ` +
          `${eintrag.file}  ${eintrag.records} Datensätze`,
      );
    } catch (e) {
      fehler.push(`${t}: ${e instanceof Error ? e.message : e}`);
      console.error(`[${i + 1}/${offen.length}] ${t}  FEHLGESCHLAGEN`);
    }
    await schlaf(PAUSE_MS);
  }
  // Laut scheitern: ein stillschweigend uebersprungener Crawl ist genau der
  // Fehler, gegen den dieses Skript geschrieben ist. Erneut aufrufen holt nur
  // die offenen nach.
  if (fehler.length) {
    console.error(`\n${fehler.length} fehlgeschlagen:\n${fehler.join("\n")}`);
    process.exit(1);
  }
} else if (import.meta.main) {
  console.log(
    readFileSync(new URL(import.meta.url).pathname, "utf8")
      .split("\n")
      .slice(1, 20)
      .join("\n"),
  );
}
