/**
 * wanderingBottleneckStepUi.js — deutsche Texte der Drehbuch-Karte in
 * WanderingBottleneckSim.vue, je Szenario und `step.key` aus SCRIPTS.
 *
 * Eigene Datei statt Konstante in der Komponente, damit ein Vitest sie
 * prüfen kann (Vitest lädt keine .vue-Dateien): Die Drehbuch-Karte hat eine
 * FESTE Höhe, und die Fußzeile ist auf zwei Zeilen geklemmt. Jedes Feld hat
 * deshalb eine Höchstlänge in Zeichen (STEP_UI_MAX), gemessen in Chromium mit
 * Inter bei 1280×720 — längere Texte würden abgeschnitten, statt die Karte
 * wachsen zu lassen. Geprüft in __tests__/wanderingBottleneckSlides.test.ts.
 *
 * Zahlen kommen aus dem Modell (Konstanten bzw. SCRIPT_FIGURES), damit die
 * Karte nicht von Modell und Folien-Notizen abdriftet.
 */
import { fmtDe as fmt } from "./rng.js";
import {
  ADMISSION_RPS,
  BOT_429,
  BOT_DB_PCT,
  BOT_RATE,
  BOTS_DB_E,
  BOTS_LOAD,
  BOTS_PAGES,
  BOTS_RL_DB_PCT,
  BOTS_RL_LOAD,
  IO_BURST_AWAIT,
  INV_PAGES_PER_S_IO,
  N_WEB_BOTS,
  RL_RATE,
  BATCH_LAT_MS,
  BATCH_WINDOW_MS,
  BREAKER_OPEN_S,
  BREAKER_TRIP_PCT,
  BULKHEAD_CHECKOUT_PCT,
  BULKHEAD_REST_PCT,
  CACHE_HIT_PCT,
  CAMPAIGN_CHECKOUTS,
  CONV_PCT,
  EDGE_BOUND_S,
  EMPF_LOAD,
  EMPF_PAGES,
  EMPF_THREADS_NEEDED,
  EMPF_THREADS_TIMEOUT,
  HALF_ADMIT_PCT,
  INV_AVAIL_E,
  INV_CAP_E,
  INV_OVERHEAD_E,
  INV_PAGE_BATCHED_E,
  INV_PAGE_E,
  INV_PAGE_LEAN_E,
  INV_PAGES_PER_S,
  INV_PAGES_PER_S_FS,
  INV_PER_ITEM_E,
  INV_RECO_CACHED_E,
  INV_RECO_E,
  LOAD_CAMPAIGN,
  LOAD_NORMAL,
  MAIL_CAP,
  MAIL_EXCESS,
  MAIL_MAX_AGE_S,
  MAIL_Q_MAX,
  MAIL_WAVE_BACKLOG,
  MAIL_WAVE_DELAY_S,
  N_WEB_EMPF,
  N_WEB_START,
  N_WEB_TEUER,
  PAY_BROWNOUT_PCT,
  PAY_BROWNOUT_S,
  PAY_CAP,
  PAY_TIMEOUT_S,
  REC_LAT_MS,
  REC_SLOW_S,
  REC_TIMEOUT_MS,
  REC_TIMEOUT_S,
  RETRY_BASE_S,
  RETRY_BUDGET_AMP,
  RETRY_BUDGET_LOAD,
  RETRY_BUDGET_PCT,
  RETRY_CHECKOUTS,
  RETRY_MAX_ATTEMPTS,
  RETRY_STORM_LOAD,
  SCALE_PREWARM_S,
  SCALE_REACTIVE_S,
  SCALE_TARGET,
  SCALE_TARGET_TEUER,
  SCRIPT_FIGURES,
  SPITZEN_AVG,
  SPITZEN_BASE,
  SPITZEN_ON_S,
  SPITZEN_PEAK,
  SPITZEN_PERIOD_S,
  TEUER_CHECKOUTS,
  TEUER_LOAD,
  THREADS_EMPF,
  THREADS_EMPF_CHECKOUT,
  THREADS_EMPF_REST,
  THREADS_EMPF_TOTAL,
  WEB_CAP_SCALED,
  WEB_CAP_START,
  WEB_CAP_TEUER_SCALED,
  WEB_PER_INSTANCE,
} from "./wanderingBottleneckModel.js";

/** Höchstlängen je Feld (Zeichen). Karte: 280 px breit, Lage und Zug je
 * höchstens zwei Zeilen, Frage eine Zeile; Fußzeile: zwei Zeilen über die
 * ganze Breite, davor „Antwort: <Station> · <Zustand>.“ (≤ 40 Zeichen). */
export const STEP_UI_MAX = {
  title: 20, // Marker-Tooltip und Schritt-Knopf-Titel
  situation: 92, // „Lage: …“
  move: 92, // „Zug: …“
  question: 32, // fett, eine Zeile
  explain: 235, // Fußzeile nach der Auflösung
};
export const FAZIT_MAX = 200;
export const TIP_MAX = 20; // Tipp-Knopf: halbe Kartenbreite, eine Zeile

const fig = Object.fromEntries(SCRIPT_FIGURES.rabatt.map((f) => [f.key, f]));
const figT = Object.fromEntries(SCRIPT_FIGURES.teuer.map((f) => [f.key, f]));
const figE = Object.fromEntries(
  SCRIPT_FIGURES.empfehlung.map((f) => [f.key, f]),
);
const figR = Object.fromEntries(SCRIPT_FIGURES.retry.map((f) => [f.key, f]));
const figS = Object.fromEntries(SCRIPT_FIGURES.spitzen.map((f) => [f.key, f]));
const figB = Object.fromEntries(SCRIPT_FIGURES.bots.map((f) => [f.key, f]));
/** Verstärkung „×2,6“ bzw. Faktor „2,6×“ (eine Nachkommastelle, ganze ohne). */
const num1 = (x) => fmt(x, Number.isInteger(x) ? 0 : 1);
const times = (x) => `×${num1(x)}`;
const fold = (x) => `${num1(x)}×`;
const pct = (x) => Math.round(x * 100);
/**
 * Geschützte Leerzeichen zwischen Zahl und Einheit (%, s, ms, E, Threads):
 * Die Karte ist schmal, ein Umbruch vor „%“ liest sich schlecht.
 * @template T
 * @param {T} entries
 * @returns {T}
 */
const keepUnits = (entries) =>
  Object.fromEntries(
    Object.entries(entries).map(([k, ui]) => [
      k,
      Object.fromEntries(
        Object.entries(ui).map(([f, t]) => [
          f,
          t.replace(/(\d) (?=%|s\b|ms\b|E\b|Threads\b)/g, "$1\u00a0"),
        ]),
      ),
    ]),
  );

/**
 * Dazu „req/s“ (Bot-Ansturm: „300 req/s“ soll nicht umbrechen).
 * @template T
 * @param {T} entries
 * @returns {T}
 */
const keepReq = (entries) =>
  Object.fromEntries(
    Object.entries(entries).map(([k, ui]) => [
      k,
      Object.fromEntries(
        Object.entries(ui).map(([f, t]) => [
          f,
          t.replace(/(\d) (?=req\/s)/g, "$1\u00a0"),
        ]),
      ),
    ]),
  );

export const STEP_UI = {
  rabatt: {
    start: {
      title: "Aktionsstart",
      situation: `Ruhiger Betrieb: ${fmt(LOAD_NORMAL)} req/s auf ${N_WEB_START} Webservern, alle Stationen mit Reserve.`,
      move: `Die Rabattaktion startet: ${fmt(LOAD_CAMPAIGN)} req/s.`,
      question: "Wo klemmt es zuerst?",
      explain: `${N_WEB_START} × ${WEB_PER_INSTANCE} = ${fmt(WEB_CAP_START)} req/s gegen ${fmt(LOAD_CAMPAIGN)}: Die Eingangs-Queue wächst, Kunden geben auf, Antworten kommen zu spät. Die Bestandsprüfung dahinter wirkt gesund — sie sieht nur, was durchkommt.`,
    },
    scale: {
      title: "Scaling",
      situation:
        "Die Webserver kollabieren: Die Eingangs-Queue wächst, Kunden geben auf.",
      move: `Scaling: ${N_WEB_START} → ${SCALE_TARGET} Webserver, reaktiv — volle Kapazität nach ${SCALE_REACTIVE_S} s.`,
      question: "Wohin wandert der Engpass?",
      explain: `${SCALE_TARGET} × ${WEB_PER_INSTANCE} = ${fmt(WEB_CAP_SCALED)} req/s lassen die volle Last zur DB durch, und die schafft ${fmt(INV_PAGES_PER_S)} Produktseiten/s. Ohne Schutz kollabiert sie: Antworten kommen zu spät, die Arbeit ist verloren.`,
    },
    bpInv: {
      title: "Back Pressure",
      situation:
        "Die DB ist überlastet, Antworten kommen zu spät — die Arbeit ist verloren.",
      move: `Back Pressure: Limit vor der DB, begrenzte Eingangs-Queue (${fmt(EDGE_BOUND_S, 1)} s), Überlauf → 503.`,
      question: "Wohin wandert der Engpass?",
      explain: `Back Pressure schafft keine Kapazität: Die DB bleibt voll ausgelastet. Aber keine Arbeit geht mehr verloren — ${fmt(fig.bpInv.pages)} Produktseiten/s kommen rechtzeitig, ${fmt(fig.bpInv.rejected)}/s werden an der vollen Queue abgewiesen (503).`,
    },
    shedBrowse: {
      title: "Load Shedding",
      situation:
        "Abgewiesen wird erst an der vollen Queue — Checkouts wie Produktseiten.",
      move: "Load Shedding: früh abweisen, Produktseiten zuerst, Checkouts zuletzt.",
      question: "Wohin wandert der Engpass?",
      explain: `Die DB bleibt der Engpass, jetzt mit Priorität: ${fmt(fig.shedBrowse.orders)} statt ${fmt(fig.bpInv.orders)} Bestellungen/s kommen durch, ${fmt(fig.shedBrowse.rejected)}/s Anfragen werden sofort abgewiesen statt erst an der vollen Queue.`,
    },
    featureShed: {
      title: "Feature Shedding",
      situation: `Personalisierte Empfehlungen kosten ${pct(INV_RECO_E / INV_PAGE_E)} % der DB-Arbeit jeder Produktseite.`,
      move: `Feature Shedding: Empfehlungen aus — eine Produktseite kostet ${fmt(INV_AVAIL_E, 1)} E statt ${fmt(INV_PAGE_E, 1)} E.`,
      question: "Wohin wandert der Engpass?",
      explain: `Die DB schafft jetzt ${fmt(INV_PAGES_PER_S_FS)} Seiten/s, ${fmt(fig.featureShed.pages)} kommen durch. ${CONV_PCT} % wollen zahlen: ${CAMPAIGN_CHECKOUTS} Checkouts/s gegen ${PAY_CAP} beim externen Zahlungsdienst — Checkouts hängen, ${fmt(fig.featureShed.waste)}/s kommen zu spät.`,
    },
    payProtect: {
      title: "Kasse schützen",
      situation: `Der Zahlungsdienst schafft ${PAY_CAP} Checkouts/s; davor staut es sich, alle kommen zu spät.`,
      move: "Back Pressure + Shedding am Zahlungsdienst: Aufrufe aufs Limit, Rest sofort abweisen.",
      question: "Wohin wandert der Engpass?",
      explain: `${fmt(fig.payProtect.orders)} Bestellungen/s kommen durch, ${fmt(fig.payProtect.rejected)}/s sehen „Kasse ausgelastet — Warenkorb bleibt“. Mehr als ${SCALE_TARGET} Webserver ändern daran nichts: Die Grenze liegt außerhalb des Shops.`,
    },
  },
  // Arbeit reduzieren: Batching VOR dem Cache (Begründung in
  // wanderingBottleneckScenarios.js bei SCRIPTS.teuer)
  teuer: keepUnits({
    start: {
      title: "Newsletter",
      situation: `Ruhig: ${LOAD_NORMAL} req/s, ${N_WEB_TEUER} Webserver. Eine Produktseite kostet die DB ${fmt(INV_PAGE_E, 1)} E.`,
      move: `Der Newsletter geht raus: ${fmt(TEUER_LOAD)} req/s.`,
      question: "Wo klemmt es zuerst?",
      explain: `${fmt(INV_RECO_E, 1)} der ${fmt(INV_PAGE_E, 1)} E je Seite gehen an personalisierte Empfehlungen: ${INV_CAP_E} E/s reichen für ${INV_PAGES_PER_S} Seiten/s. Die Webserver haben Reserve, Back Pressure fängt die DB ab — ${fmt(figT.start.pages)} Seiten/s rechtzeitig, ${fmt(figT.start.rejected)}/s abgewiesen (503).`,
    },
    scale: {
      title: "Scaling",
      situation: `Die DB ist der Engpass, abgefangen: ${fmt(figT.start.rejected)} von ${fmt(TEUER_LOAD)} req/s werden abgewiesen.`,
      move: `Scaling: ${N_WEB_TEUER} → ${SCALE_TARGET_TEUER} Webserver, vorgewärmt (Warm Pool, ${SCALE_PREWARM_S} s).`,
      question: "Wohin wandert der Engpass?",
      explain: `${SCALE_TARGET_TEUER} × ${WEB_PER_INSTANCE} = ${fmt(WEB_CAP_TEUER_SCALED)} req/s an den Webservern — die DB bleibt bei ${INV_CAP_E} E/s, sie skaliert nicht horizontal. Weiter ${fmt(figT.scale.pages)} Seiten/s rechtzeitig: Mehr Webserver ändern daran nichts.`,
    },
    batch: {
      title: "Batching",
      situation: `Jede Verfügbarkeitsabfrage zahlt ${fmt(INV_OVERHEAD_E, 1)} E Overhead, dazu ${fmt(INV_PER_ITEM_E, 1)} E je Artikel.`,
      move: `Batching: Abfragen aus ${BATCH_WINDOW_MS} ms bündeln — der Overhead teilt sich auf das Bündel.`,
      question: "Wohin wandert der Engpass?",
      explain: `Die Verfügbarkeit sinkt von ${fmt(INV_AVAIL_E, 1)} auf ≈ ${fmt(INV_PER_ITEM_E, 1)} E, eine Seite von ${fmt(INV_PAGE_E, 1)} auf ≈ ${fmt(INV_PAGE_BATCHED_E, 1)} E — die Empfehlungen bleiben teuer. ${fmt(figT.batch.pages)} statt ${fmt(figT.scale.pages)} Seiten/s, dafür wartet jede Seite +${BATCH_LAT_MS} ms.`,
    },
    cache: {
      title: "Cache",
      situation: `Die Empfehlungen kosten weiter ${fmt(INV_RECO_E, 1)} E — ${pct(INV_RECO_E / INV_PAGE_BATCHED_E)} % der DB-Arbeit einer Seite.`,
      move: `Cache + Coalescing, Schlüssel je Produkt: ${CACHE_HIT_PCT} % der Empfehlungen ohne DB-Arbeit.`,
      question: "Wohin wandert der Engpass?",
      explain: `Empfehlungen ${fmt(INV_RECO_E, 1)} → ${fmt(INV_RECO_CACHED_E, 2)} E, eine Seite ≈ ${fmt(INV_PAGE_LEAN_E, 2)} E: ${fmt(figT.cache.pages)} Seiten/s, die DB hat Reserve. ${CONV_PCT} % wollen zahlen — ${TEUER_CHECKOUTS} Checkouts/s gegen ${PAY_CAP}: Back Pressure an der Kasse fängt ab, ${fmt(figT.cache.orders)} Bestellungen/s.`,
    },
  }),
  // Spitzen zeitlich verteilen: vierte Station Mailversand; ab Schritt 1
  // eigene Fragen (TIP_SETS.mails), Schritt 2 ist ein Lastwechsel (event)
  spitzen: keepUnits({
    start: {
      title: "Blitzangebote",
      situation: `Ruhig: ${SPITZEN_BASE} Checkouts/s, Mailversand ${MAIL_CAP}/s — die Bestätigung geht synchron im Checkout raus.`,
      move: `Blitzangebote: alle ${SPITZEN_PERIOD_S / 60} min, je ${SPITZEN_ON_S} s lang, ${SPITZEN_PEAK} Checkouts/s — im Mittel ${SPITZEN_AVG}.`,
      question: "Wo klemmt es zuerst?",
      explain: `Im Mittel reichen ${MAIL_CAP} Mails/s, in der Spitze nicht: ${MAIL_EXCESS} Mails/s zu viel, nach ${SPITZEN_ON_S} s ${MAIL_WAVE_BACKLOG} im Rückstau. Synchron wartet jeder Kunde auf seine Mail — ${figS.start.orders} von ${SPITZEN_PEAK} Bestellungen/s kommen rechtzeitig.`,
    },
    smoothing: {
      title: "Puffern & glätten",
      situation: `In jeder Welle warten Kunden bis zu ${MAIL_WAVE_DELAY_S} s auf ihre Bestätigungsmail und geben auf.`,
      move: `Puffer: Bestellung sofort bestätigen, Mail später — höchstens ${fmt(MAIL_Q_MAX)} Mails, ${MAIL_MAX_AGE_S} s alt.`,
      question: "Was passiert mit den Mails?",
      explain: `Der Puffer fängt die Spitze auf (bis ≈ ${MAIL_WAVE_BACKLOG} Mails, ${MAIL_WAVE_DELAY_S} s Verzug) und läuft in der Pause leer. ${figS.smoothing.orders} Bestellungen/s kommen durch, keine Mail geht verloren — im Mittel ${SPITZEN_AVG} gegen ${MAIL_CAP}, das trägt.`,
    },
    dauerlast: {
      title: "Dauerlast",
      situation: `Der Puffer glättet: Mails kommen bis zu ${MAIL_WAVE_DELAY_S} s später, aber alle — im Mittel ${SPITZEN_AVG}/s.`,
      move: `Die Aktion wird verlängert: dauerhaft ${SPITZEN_PEAK} Checkouts/s gegen ${MAIL_CAP} Mails/s.`,
      question: "Und jetzt die Mails?",
      explain: `Das Mittel liegt jetzt über der Kapazität: Der Puffer läuft voll, Mails, die ${MAIL_MAX_AGE_S} s warten, fliegen raus — ${figS.dauerlast.mailLost}/s. Die Bestellungen kommen durch. Glätten hilft nur, wenn das Mittel unter der Kapazität liegt.`,
    },
  }),
  // Überlast isolieren + Verstärkung verhindern; ab Schritt 1 eigene Fragen
  // (step.ask, Tipps aus TIP_SETS)
  empfehlung: keepUnits({
    start: {
      title: "Hänger",
      situation: `Ruhig: ${EMPF_LOAD} req/s auf ${N_WEB_EMPF} Webservern mit je ${THREADS_EMPF} Threads, alle Stationen mit Reserve.`,
      move: `Der Empfehlungsdienst hängt: ${fmt(REC_SLOW_S)} s statt ${REC_LAT_MS} ms je Aufruf.`,
      question: "Wo klemmt es zuerst?",
      explain: `Jede Produktseite hält ihren Web-Thread ${fmt(REC_SLOW_S)} s: ${EMPF_PAGES} × ${fmt(REC_SLOW_S)} = ${EMPF_THREADS_NEEDED} Threads nötig, ${THREADS_EMPF_TOTAL} da. Der Pool läuft leer — auch Checkouts bekommen keinen Thread, obwohl DB und Zahlungsdienst gesund sind.`,
    },
    bulkhead: {
      title: "Bulkheads",
      situation: `Threads voll: Seiten hängen, Checkouts warten mit — ${fmt(figE.start.orders)} Bestellungen/s.`,
      move: `Bulkheads: getrennte Thread-Pools — Checkout ${BULKHEAD_CHECKOUT_PCT} %, Rest ${BULKHEAD_REST_PCT} %.`,
      question: "Was passiert mit den Checkouts?",
      explain: `Der Checkout-Pool (${THREADS_EMPF_CHECKOUT} Threads) bleibt frei: ${fmt(figE.bulkhead.orders)} Bestellungen/s wie vor dem Hänger. Die Seiten hängen weiter, im eigenen Pool (${THREADS_EMPF_REST}) erst recht — der Engpass bleibt. Bulkheads begrenzen den Schaden.`,
    },
    timeouts: {
      title: "Timeouts",
      situation: `Die Seiten hängen weiter: ${THREADS_EMPF_REST} Threads warten je ${fmt(REC_SLOW_S)} s auf die Empfehlungen.`,
      move: `Timeouts: Empfehlungen nach ${REC_TIMEOUT_MS} ms abbrechen, die Seite ohne sie ausliefern.`,
      question: "Was zeigen die Produktseiten?",
      explain: `Degradiert, aber rechtzeitig: ${fmt(figE.timeouts.pages)} Seiten/s. Höchstens ${EMPF_PAGES} × ${fmt(REC_TIMEOUT_S, 1)} s = ${EMPF_THREADS_TIMEOUT} Threads statt ${EMPF_THREADS_NEEDED} — kein Engpass mehr. Der hängende Dienst bekommt weiter jeden Aufruf.`,
    },
    breaker: {
      title: "Circuit Breaker",
      situation: `Jede Seite wartet ${REC_TIMEOUT_MS} ms auf den Timeout, der hängende Dienst bekommt alle Aufrufe.`,
      move: `Circuit Breaker: ab ${BREAKER_TRIP_PCT} % Fehlern ${BREAKER_OPEN_S} s offen, dann ${HALF_ADMIT_PCT} % Proben.`,
      question: "Wartezeit auf Empfehlungen?",
      explain: `Der Breaker ist offen: Seiten kommen sofort ohne Empfehlungen — automatisches Feature Shedding. Threads frei, die DB spart ${fmt(INV_RECO_E, 1)} E je Seite, der Dienst bekommt nur noch vereinzelt Proben.`,
    },
  }),
  // Verstärkung verhindern: jeder Schritt spielt dieselbe Störung ab (Brownout,
  // dann Neustart); ab Schritt 1 eigene Fragen (TIP_SETS)
  retry: keepUnits({
    start: {
      title: "Störung",
      situation: `Ruhig: ${RETRY_CHECKOUTS} Checkouts/s gegen ${PAY_CAP}. Timeout ${PAY_TIMEOUT_S} s, bis zu ${RETRY_MAX_ATTEMPTS} Versuche, sofort.`,
      move: `Der Zahlungsdienst schafft ${PAY_BROWNOUT_S} s lang nur ${PAY_BROWNOUT_PCT} %, dann startet er neu.`,
      question: "Wo klemmt es zuerst?",
      explain: `Jeder Versuch reißt den Timeout und wird sofort wiederholt: ${RETRY_MAX_ATTEMPTS} × ${RETRY_CHECKOUTS} = ${RETRY_STORM_LOAD} Versuche/s gegen ${PAY_CAP}. Der Brownout ist vorbei, der Sturm bleibt: ${times(figR.start.amp)} Last, ${figR.start.orders} Bestellungen/s — der Anbieter rechnet für Clients, die längst aufgegeben haben.`,
    },
    backoff: {
      title: "Backoff",
      situation: `Der Sturm hält an: ${times(figR.start.amp)} Versuche je Zahlung, kaum eine gelingt.`,
      move: `Backoff: ${RETRY_BASE_S} s, dann ${2 * RETRY_BASE_S} s Pause vor dem nächsten Versuch — dieselbe Störung noch einmal.`,
      question: "Wie kommen die Retries an?",
      explain: `In Wellen: Der Neustart lässt alle offenen Aufrufe im selben Moment scheitern, ihre Retries kommen gemeinsam ${RETRY_BASE_S} s und ${2 * RETRY_BASE_S} s später — Spitze ≈ ${fold(figR.backoff.wave)} Mittel. Die Menge bleibt: ${times(figR.backoff.amp)}, der Sturm hält an.`,
    },
    jitter: {
      title: "Jitter",
      situation:
        "Die Retries kommen gebündelt: Wer gleichzeitig scheitert, versucht es gleichzeitig wieder.",
      move: `Jitter: Pause zufällig zwischen 0 und dem Backoff (${RETRY_BASE_S} s, ${2 * RETRY_BASE_S} s) — dieselbe Störung.`,
      question: "Und jetzt die Retries?",
      explain: `Gleichmäßig: Jitter verteilt die Retries, Spitze nur noch ≈ ${fold(figR.jitter.wave)} Mittel. Glatter, aber nicht besser: ${times(figR.jitter.amp)} Versuche je Zahlung halten die Queue ständig voll. Backoff und Jitter verteilen, sie deckeln nicht.`,
    },
    budget: {
      title: "Retry-Budget",
      situation: `Gleichmäßiger Sturm: ${times(figR.jitter.amp)} Versuche je Zahlung, kaum eine Bestellung rechtzeitig.`,
      move: `Retry-Budget: Retries höchstens ${RETRY_BUDGET_PCT} % der Erstversuche — dieselbe Störung.`,
      question: "Versuche je Zahlung?",
      explain: `≈ ${times(RETRY_BUDGET_AMP)}: höchstens ${RETRY_BUDGET_LOAD} statt ${RETRY_STORM_LOAD} Versuche/s. Im Brownout scheitern Zahlungen weiter — nach dem Neustart erholt sich der Dienst sofort, alle ${figR.budget.orders} Bestellungen/s. Kein Engpass mehr.`,
    },
    breaker: {
      title: "Circuit Breaker",
      situation: `Im Brownout warten Kunden ${PAY_TIMEOUT_S} s je Versuch — und bekommen dann einen Fehler.`,
      move: `Circuit Breaker vor der Zahlung: ab ${BREAKER_TRIP_PCT} % Fehlern ${BREAKER_OPEN_S} s offen, dann ${HALF_ADMIT_PCT} % Proben.`,
      question: "Was sehen Kunden an der Kasse?",
      explain: `Sofort „Kasse ausgelastet — Warenkorb bleibt“: ${figR.breaker.rejected}/s abgewiesen statt nach Timeouts gescheitert, der Anbieter bekommt nur Proben. Gelingen sie, schließt er — und die volle Last reißt ihn wieder auf.`,
    },
  }),
  // Zufluss bremsen: Die DB bleibt der Engpass, gefragt wird ab Schritt 1,
  // wen das Abweisen trifft und was Kunden sehen (TIP_SETS.wen / .seiten);
  // Schritte 3 und 4 spielen denselben IO-Schub der Nachbar-VM ab
  bots: keepReq(
    keepUnits({
      start: {
        title: "Bot-Ansturm",
        situation: `Ruhig: ${BOTS_LOAD} req/s Kunden auf ${N_WEB_BOTS} Webservern, die DB mit Reserve.`,
        move: `Ein Scraper-Bot — ein einziger Client — fragt ${BOT_RATE} Produktseiten/s ab.`,
        question: "Wo klemmt es zuerst?",
        explain: `Jede Bot-Seite kostet die DB ${fmt(INV_PAGE_E, 1)} E wie eine Kundenseite: ${fmt(BOTS_DB_E)} E/s gegen ${INV_CAP_E}, ${BOT_DB_PCT} % davon vom Bot. Die Webserver haben Reserve. Ohne Schutz kollabiert die DB — Kunden wie Bot warten, ${fmt(figB.start.lost)}/s gehen verloren.`,
      },
      shed: {
        title: "Load Shedding",
        situation: `Die DB kollabiert: Kein Kunde bekommt rechtzeitig eine Seite, ${fmt(figB.start.lost)}/s gehen verloren.`,
        move: "Load Shedding: Produktseiten früh abweisen, sobald sich die DB staut — Checkouts zuletzt.",
        question: "Wen trifft das Abweisen?",
        explain: `Abgefangen: Die DB bleibt voll, aber die Wartezeit kurz. Der Shedder sieht den Zustand, nicht, wer fragt — Kunden wie Bot: nur ${fmt(figB.shed.custPages)} von ${BOTS_PAGES} Kundenseiten/s kommen, ${fmt(figB.shed.custRej)} Kundenanfragen/s abgewiesen; der Bot bekommt ${fmt(figB.shed.botOk)}.`,
      },
      rateLimit: {
        title: "Rate Limit",
        situation: `${fmt(figB.shed.custRej)} Kundenanfragen/s werden abgewiesen, obwohl der Bot ${BOT_DB_PCT} % der Last macht.`,
        move: `Rate Limit je Client statt Shedding: Token Bucket, ${RL_RATE} req/s je Client, darüber 429.`,
        question: "Und jetzt — wen trifft es?",
        explain: `Nur den Bot: ${BOT_429}/s bekommen 429, ohne Arbeit. Jeder Kunde bleibt weit unter ${RL_RATE}/s — alle ${BOTS_PAGES} Kundenseiten/s kommen. Der Engpass bleibt auf dem Papier: Das Rate Limit senkt die Nachfrage nicht und schafft keine Kapazität.`,
      },
      admission: {
        title: "Admission Control",
        situation: `Der Bot ist gebremst, die DB zu ${BOTS_RL_DB_PCT} % ausgelastet — alle Kundenseiten kommen rechtzeitig.`,
        move: `Dazu ein globales Limit: Admission, statisch ${ADMISSION_RPS} req/s. Dann ein IO-Schub der Nachbar-VM.`,
        question: "Was sehen Kunden jetzt?",
        explain: `Disk-await ×${IO_BURST_AWAIT}: Die DB schafft nur noch ≈ ${INV_PAGES_PER_S_IO} Seiten/s. Das Limit lässt ${BOTS_RL_LOAD} req/s durch und greift gar nicht — ${ADMISSION_RPS} galt für die volle DB. Sie kollabiert: Kunden warten, dann Fehler, ${fmt(figB.admission.lost)}/s verloren.`,
      },
      bpInv: {
        title: "Back Pressure",
        situation: `Das statische Limit passt nicht mehr: ${ADMISSION_RPS} req/s erlaubt, im IO-Schub schafft die DB ≈ ${INV_PAGES_PER_S_IO}.`,
        move: "Back Pressure an der DB: Limit vor der DB, begrenzte Eingangs-Queue — derselbe IO-Schub.",
        question: "Und mit Back Pressure?",
        explain: `Die Rückmeldung kommt aus der Kette und folgt der echten Kapazität: ${fmt(figB.bpInv.custPages)} von ${BOTS_PAGES} Kundenseiten/s kommen rechtzeitig, ${fmt(figB.bpInv.custRej)} Kundenanfragen/s sehen sofort 503 statt Fehler nach Warten. Kapazität schafft auch sie nicht.`,
      },
    }),
  ),
};

/**
 * Tipps der eigenen Fragen (SCRIPTS[k][i].ask), je Ausgang von
 * observeTip() im Modell — gleiche Schlüssel und Reihenfolge wie ASK_KINDS
 * (2 × 2 im Raster der Karte; geprüft im Folien-Test). Höchstens TIP_MAX
 * Zeichen.
 */
export const TIP_SETS = {
  checkout: {
    laufen: "laufen wieder",
    haengen: "hängen weiter",
    abgewiesen: "werden abgewiesen",
    kasse: "Kasse überlastet",
  },
  browse: {
    haengen: "hängen weiter",
    degradiert: "schnell, ohne Empf.",
    fehler: "Fehlerseite (5xx)",
    normal: "schnell, mit Empf.",
  },
  recWait: {
    lang: `≈ ${fmt(REC_SLOW_S)} s`,
    timeout: `≈ ${REC_TIMEOUT_MS} ms (Timeout)`,
    keine: "gar nicht",
    kurz: `≈ ${REC_LAT_MS} ms wie vorher`,
  },
  retryShape: {
    wellen: "in Wellen",
    glatt: "gleichmäßig",
    wenige: "nur noch wenige",
    keine: "gar keine",
  },
  payLoad: {
    x3: `≈ ×${RETRY_MAX_ATTEMPTS}`,
    x2: "≈ ×2",
    x11: `≈ ${times(RETRY_BUDGET_AMP)}`,
    x1: "genau ×1",
  },
  kunden: {
    warten: "Fehler nach Warten",
    sofort: "sofort abgewiesen",
    teils: "teils, teils",
    klappt: "Zahlung klappt",
  },
  mails: {
    sofort: "sofort raus",
    verspaetet: "später, aber alle",
    verloren: "gehen verloren",
    kasse: "Kasse wartet mit",
  },
  wen: {
    bot: "nur den Bot",
    beide: "Kunden und Bot",
    kunden: "nur Kunden",
    keiner: "niemanden",
  },
  seiten: {
    laden: "laden normal",
    teils: "teils sofort 503",
    abgewiesen: "fast alle 503",
    warten: "warten, dann Fehler",
  },
};

/** Fazit nach dem letzten Schritt, je Szenario. */
export const FAZIT = {
  bots: "Rate Limit entscheidet, wen es trifft: nur den Verursacher. Ein statisches Limit kennt die Kapazität nicht; Shedding und Back Pressure folgen dem Zustand. Kapazität schafft keiner der vier.",
  spitzen:
    "Ein Puffer verteilt Spitzen über die Zeit: Bestellung sofort, Mail später. Kapazität schafft er nicht — liegt das Mittel darüber, läuft er voll. Synchron gehört nur, was der Kunde braucht.",
  retry:
    "Retries sind egoistisch: Naiv verdreifachen sie die Last und halten den Dienst nach der Störung unten. Backoff und Jitter verteilen nur, erst das Budget deckelt; der Breaker sagt sofort ab.",
  empfehlung:
    "Ein hängender Nebendienst blockiert über geteilte Threads die Kasse. Bulkheads begrenzen den Schaden, Timeouts das Warten, der Breaker spart den Aufruf — die Seite kommt degradiert.",
  teuer:
    "Arbeit reduzieren wirkt am teuren Teil: Batching spart nur den Overhead, der Cache die Empfehlungen — die Funktion bleibt. Scaling half nicht. Jetzt begrenzt die Kasse, extern.",
  rabatt:
    "Beseitigen legt den nächsten Engpass frei, Abfangen verliert weniger Arbeit, schafft aber keine Kapazität. Die ganze Kette beobachten, nicht nur die Station, die gerade brennt.",
};
