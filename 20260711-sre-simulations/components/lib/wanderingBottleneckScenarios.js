/**
 * wanderingBottleneckScenarios.js — Szenarien und Drehbücher der Sim
 * „Wandernde Engpässe“ als reine Daten.
 *
 * Bewusst OHNE Import: wanderingBottleneckModel.js importiert diese Datei
 * und exportiert die Zahlen weiter. Ein Import in die Gegenrichtung wäre ein
 * ESM-Zyklus, der je nach Ladereihenfolge an der TDZ scheitert.
 *
 * Die deutschen UI-Texte stehen in der Komponente, verknüpft über
 * `step.key` bzw. den Szenario-Schlüssel. Hier stehen nur Zahlen, Schalter
 * und kurze Schlüssel.
 *
 * Zeiten in Sim-Sekunden. `tempo` = Sim-s je Wand-s (Default im Transport),
 * `windowS` = Rollfenster des Diagramms und der Fußzeilen-Statistik,
 * `prerollS` = Vorlauf vor der ersten Anzeige.
 */

/* ===== Lastniveaus und Instanzzahlen (erscheinen in Folientexten) ===== */

export const LOAD_NORMAL = 100; // req/s, ruhiger Nachmittag
export const LOAD_CAMPAIGN = 1000; // req/s während der Aktion = Produktseiten + Checkouts
export const CAMPAIGN_START_S = 60; // Sim-s: Start der Aktion im Vorlauf
export const LOAD_RAMP_S = 10; // Sim-s: Übergang zwischen zwei Lastniveaus
export const N_WEB_START = 2; // Webserver zu Beginn der Aktion (kein Patt mit inv)
export const N_WEB_CAUSE = 3; // Webserver in den Ursachen-Szenarien
export const NACHBAR_LOAD = 270; // req/s, konstant: knappe Reserven, Nachbar-VM verdeckt
export const ZUFALL_LOAD = 275; // req/s, konstant: Zufall allein reicht für Überlast
// „Teure Abfragen“: Newsletter-Spitze auf die DB-gebundene Kette; 12 Webserver
// (Stand nach der Rabattaktion) haben Reserve, Scaling geht auf 20
export const TEUER_LOAD = 900; // req/s nach dem Lastsprung (bei CAMPAIGN_START_S)
export const N_WEB_TEUER = 12; // Webserver zu Beginn
export const SCALE_TARGET_TEUER = 20; // Scaling-Ziel in diesem Szenario
// „Empfehlungen hängen“: konstante Last, kein Funnel; ab REC_SLOW_AT_S
// antwortet der Empfehlungsdienst nach REC_SLOW_S statt nach REC_LAT_S (Modell)
export const EMPF_LOAD = 220; // req/s konstant = Produktseiten + Checkouts
export const EMPF_CHECKOUTS = 20; // Checkouts/s, fest
export const N_WEB_EMPF = 4; // Webserver
export const THREADS_EMPF = 100; // Threads je Webserver in diesem Szenario
export const SCALE_TARGET_EMPF = 8; // Scaling-Ziel (Ablenker: mehr Threads)
export const REC_SLOW_S = 3; // s: Antwortzeit des hängenden Empfehlungsdienstes
export const REC_SLOW_AT_S = 30; // Sim-s: Beginn des Hängers
// „Retry-Sturm“: konstante Last, fester Checkout-Strom, Webserver und DB mit
// Reserve. Jeder Drehbuch-Schritt spielt dieselbe Störung beim Zahlungs-
// dienst ab (Brownout, dann Neustart mit Verbindungsabbruch — Modell)
export const RETRY_LOAD = 200; // req/s konstant = Produktseiten + Checkouts
export const RETRY_CHECKOUTS = 50; // Checkouts/s, fest
export const N_WEB_RETRY = 4; // Webserver
export const SCALE_TARGET_RETRY = 8; // Scaling-Ziel (Ablenker: extern)
export const RETRY_START_S = 30; // Sim-s: erste Störung (Schritt 0)
// „Kurze Spitzen“: Blitzangebote bringen Wellen von Checkouts — im Mittel
// unter der Kapazität des Mailversands (Modell: MAIL_CAP), in der Spitze
// darüber. Die Bestätigungsmail hängt synchron im Checkout. Produktseiten
// konstant, kein Funnel.
export const SPITZEN_PAGES = 200; // Produktseiten/s konstant
export const SPITZEN_BASE = 20; // Checkouts/s zwischen den Angeboten
export const SPITZEN_PEAK = 60; // Checkouts/s im Blitzangebot (und bei Dauerlast)
export const SPITZEN_ON_S = 30; // s: so lange läuft ein Blitzangebot
export const SPITZEN_PERIOD_S = 120; // s: alle 2 min ein Angebot
export const SPITZEN_START_S = 60; // Sim-s: erstes Angebot (Schritt 0)
export const N_WEB_SPITZEN = 4; // Webserver
export const SCALE_TARGET_SPITZEN = 8; // Scaling-Ziel (Ablenker: Mail ist extern)
// „Bot-Ansturm“: Kunden konstant (Produktseiten + fester Checkout-Strom, kein
// Funnel); ab BOT_START_S fragt ein Scraper-Bot — EIN Client — BOT_RATE
// Produktseiten/s ab: gleicher Weg, gleiche DB-Arbeit wie eine Kundenseite.
// Die Webserver (Stand nach der Rabattaktion) haben Reserve, die DB nicht.
export const BOTS_LOAD = 250; // req/s Kunden = Produktseiten + Checkouts
export const BOTS_CHECKOUTS = 20; // Checkouts/s, fest
export const BOT_RATE = 500; // req/s des Scrapers (ein Client)
export const BOT_START_S = 60; // Sim-s: der Bot legt los (Schritt 0)
export const N_WEB_BOTS = 12; // Webserver
export const SCALE_TARGET_BOTS = 20; // Scaling-Ziel (Ablenker: die DB skaliert nicht)

/* ===== Szenarien ===== */

/**
 * load:   [[tStart, req/s], …] — Stufen, weich verbunden über LOAD_RAMP_S
 * nWeb:   Webserver-Instanzen zu Beginn
 * funnel: true ⇒ Checkouts = 10 % der rechtzeitig ausgelieferten
 *         Produktseiten (Rabattaktion); false ⇒ fester Mix im Gleichgewicht
 *         des Funnels (konstante Last in den Ursachen-Szenarien)
 * sigma:  stationäre Standardabweichung der OU-Schwankung (Anteil) je
 *         Station und für die Ankünfte; ⚙ „Schwankung“ skaliert sie
 * cm:     Start-Schalter (Gegenmaßnahmen, Nachbar-Modus)
 * figWindowS: Mittelungsfenster der SCRIPT_FIGURES (Default 20 s)
 * scaleTarget: Ziel des Schalters `scale` (Default SCALE_TARGET im Modell)
 * conv, cFix: Funnel-Anteil und fester Checkout-Strom (Default CONV bzw. 0)
 * threadsPerInstance: Threads je Webserver (Default THREADS_PER_INSTANCE)
 * recLat: [[tStart, s], …] — Antwortzeit des Empfehlungsdienstes ab tStart
 *         (vorher REC_LAT_S im Modell), weich über REC_RAMP_S
 * retryLayer: true ⇒ Zahlung als Versuche mit Ausgang beim Zahlungsdienst
 *         (Timeout, Retries, Neustart), auch wenn der Retry-Modus „aus“ ist;
 *         sonst nur, solange cm.retry nicht „aus“ ist
 * waves:  { t0, period, on, base, peak } — Checkouts in Wellen: ab t0 je
 *         Periode `on` s auf `peak` statt `base` (Blitzangebote); die Last
 *         `load` enthält die Grundlast (Produktseiten + base), cFix = base.
 *         trigger("dauerlast") hält ab dann dauerhaft `peak`
 * mail:   true ⇒ Mailversand als vierte Station hinter der Zahlung
 *         (Bestätigungsmail; ohne smoothing synchron im Checkout)
 * bot:    [[tStart, req/s], …] — dritte Verkehrsklasse „Bot“: ein einzelner
 *         Client, der Produktseiten abfragt (gleicher Weg, gleiche Kosten
 *         wie Kundenseiten, ohne Rauschen), zusätzlich zur Last `load`; weich
 *         über LOAD_RAMP_S. Nur dort trifft das Rate Limit je Client jemanden
 * tipStations: Stationen der Tipp-Knöpfe bei der Standardfrage (Default
 *         web, inv, pay; das 2 × 2-Raster hat Platz für drei plus
 *         „nirgends“/„bleibt“)
 * rail:   nur Gegenmaßnahmen — die Schalter, die die Leiste in diesem
 *         Szenario zeigt: die Züge des Drehbuchs plus wenige plausible
 *         Ablenker, damit Tippen ehrlich bleibt. Eingeschaltete Schalter
 *         zeigt die Leiste immer; alle stehen im ⚙ („Alle Schalter zeigen“).
 */
export const SCENARIOS = {
  nachbar: {
    variant: "cause",
    tempo: 20,
    windowS: 600,
    prerollS: 600,
    load: [[0, NACHBAR_LOAD]],
    nWeb: N_WEB_CAUSE,
    funnel: false,
    sigma: { web: 0.035, inv: 0.035, pay: 0.03, arr: 0.02 },
    cm: { nb: "zufall" },
  },
  zufall: {
    variant: "cause",
    tempo: 20,
    windowS: 600,
    prerollS: 600,
    load: [[0, ZUFALL_LOAD]],
    nWeb: N_WEB_CAUSE,
    funnel: false,
    sigma: { web: 0.06, inv: 0.09, pay: 0.03, arr: 0.03 },
    cm: { nb: "aus" },
  },
  rabatt: {
    variant: "remedies",
    tempo: 20,
    windowS: 600,
    prerollS: 90,
    load: [
      [0, LOAD_NORMAL],
      [CAMPAIGN_START_S, LOAD_CAMPAIGN],
    ],
    nWeb: N_WEB_START,
    sigma: { web: 0.03, inv: 0.03, pay: 0.03, arr: 0.02 },
    cm: { nb: "aus" },
    rail: [
      "bpInv",
      "bpPay",
      "shedBrowse",
      "shedCheckout",
      "featureShed",
      "scale",
      "headroom",
    ],
  },
  // Familie „Last vermeiden / Arbeit reduzieren“: Die DB ist der Engpass
  // (Produktseite 1,5 E, davon 1,2 E Empfehlungen), Back Pressure an DB und
  // Kasse läuft schon. Scaling hilft nicht, Cache + Coalescing und Batching
  // sparen Arbeit je Seite — bis die Kasse (Funnel) zum Engpass wird.
  teuer: {
    variant: "remedies",
    tempo: 20,
    windowS: 600,
    prerollS: 90,
    load: [
      [0, LOAD_NORMAL],
      [CAMPAIGN_START_S, TEUER_LOAD],
    ],
    nWeb: N_WEB_TEUER,
    scaleTarget: SCALE_TARGET_TEUER,
    sigma: { web: 0.03, inv: 0.03, pay: 0.03, arr: 0.02 },
    cm: { nb: "aus", bpInv: true, bpPay: true },
    rail: [
      "bpInv",
      "bpPay",
      "featureShed",
      "cache",
      "batch",
      "scale",
      "headroom",
    ],
  },
  // Familie „Überlast isolieren + Verstärkung verhindern“: Der Empfehlungs-
  // dienst hängt (REC_SLOW_S statt 50 ms), jede Produktseite hält so lange
  // ihren Web-Thread. Der gemeinsame Pool läuft leer, Checkouts blockieren,
  // obwohl DB und Kasse gesund sind. Ein Vorfall im Sekundentakt: Tempo ×1,
  // Fenster 2 min. Fester Checkout-Strom (conv 0), damit die Checkouts allein
  // an den Threads hängen und nicht am Funnel.
  empfehlung: {
    variant: "remedies",
    tempo: 1,
    windowS: 120,
    prerollS: REC_SLOW_AT_S,
    figWindowS: 10, // Kennzahlen: Mittel der letzten 10 s vor der Auflösung
    load: [[0, EMPF_LOAD]],
    nWeb: N_WEB_EMPF,
    threadsPerInstance: THREADS_EMPF,
    scaleTarget: SCALE_TARGET_EMPF,
    conv: 0,
    cFix: EMPF_CHECKOUTS,
    recLat: [[REC_SLOW_AT_S, REC_SLOW_S]],
    sigma: { web: 0.03, inv: 0.03, pay: 0.03, arr: 0.02 },
    cm: { nb: "aus" },
    rail: ["bulkhead", "timeouts", "breaker", "featureShed", "scale"],
  },
  // Familie „Verstärkung verhindern“: Der Zahlungsdienst hat eine Störung
  // (Brownout, dann Neustart — alle offenen Aufrufe brechen gleichzeitig
  // ab). Der Checkout-Client hat Timeouts und versucht es bis zu dreimal
  // (ein Versuch, zwei Retries), anfangs sofort (naiv). Die Retries laufen als Verzögerungsleitung; jeder
  // Drehbuch-Schritt spielt die Störung erneut ab (step.event). Ein Vorfall
  // im Sekundentakt: Tempo ×1, Fenster 2 min.
  retry: {
    variant: "remedies",
    tempo: 1,
    windowS: 120,
    prerollS: RETRY_START_S,
    figWindowS: 10, // Kennzahlen: Mittel der letzten 10 s vor der Auflösung
    load: [[0, RETRY_LOAD]],
    nWeb: N_WEB_RETRY,
    scaleTarget: SCALE_TARGET_RETRY,
    conv: 0,
    cFix: RETRY_CHECKOUTS,
    retryLayer: true, // Zahlung mit Versuchen, auch bei Retry-Modus „aus“
    sigma: { web: 0.03, inv: 0.03, pay: 0.03, arr: 0.02 },
    cm: { nb: "aus", retry: "naiv", timeouts: true },
    rail: ["retry", "retryBudget", "breaker", "timeouts", "bpPay", "scale"],
  },
  // Familie „Spitzen zeitlich verteilen“: Blitzangebote bringen alle 2 min
  // für 30 s dreimal so viele Checkouts. Im Mittel reicht der Mailversand,
  // in der Spitze nicht — und synchron im Checkout wartet jeder Kunde auf
  // seine Bestätigungsmail. Gestreckte Zeit wie die Rabattaktion (×20,
  // 10 min), Wartezeiten in echten Sekunden.
  spitzen: {
    variant: "remedies",
    tempo: 20,
    windowS: 600,
    prerollS: SPITZEN_START_S,
    load: [[0, SPITZEN_PAGES + SPITZEN_BASE]],
    waves: {
      t0: SPITZEN_START_S,
      period: SPITZEN_PERIOD_S,
      on: SPITZEN_ON_S,
      base: SPITZEN_BASE,
      peak: SPITZEN_PEAK,
    },
    nWeb: N_WEB_SPITZEN,
    scaleTarget: SCALE_TARGET_SPITZEN,
    conv: 0,
    cFix: SPITZEN_BASE,
    mail: true,
    tipStations: ["inv", "pay", "mail"],
    sigma: { web: 0.03, inv: 0.03, pay: 0.03, arr: 0.02, mail: 0.03 },
    cm: { nb: "aus" },
    rail: ["bpPay", "shedCheckout", "scale", "headroom", "smoothing"],
  },
  // Familie „Zufluss bremsen“: Ein Scraper-Bot verdreifacht die Last an der
  // DB. Load Shedding fängt ab, trifft aber Kunden wie Bot; das Rate Limit je
  // Client nur den Bot. Ein statisches globales Limit (Admission) passt nicht
  // mehr, sobald ein IO-Schub der Nachbar-VM (trigger("ioSchub")) die DB
  // bremst — Back Pressure folgt der echten Kapazität. Gestreckte Zeit wie
  // die Rabattaktion (×20, 10 min), Wartezeiten in echten Sekunden.
  bots: {
    variant: "remedies",
    tempo: 20,
    windowS: 600,
    prerollS: BOT_START_S,
    load: [[0, BOTS_LOAD]],
    bot: [
      [0, 0],
      [BOT_START_S, BOT_RATE],
    ],
    nWeb: N_WEB_BOTS,
    scaleTarget: SCALE_TARGET_BOTS,
    conv: 0,
    cFix: BOTS_CHECKOUTS,
    sigma: { web: 0.03, inv: 0.03, pay: 0.03, arr: 0.02 },
    cm: { nb: "aus" },
    rail: [
      "bpInv",
      "rateLimit",
      "admission",
      "shedBrowse",
      "featureShed",
      "scale",
    ],
  },
};

export const CAUSE_ORDER = ["nachbar", "zufall"];
export const REMEDY_ORDER = [
  "rabatt",
  "spitzen",
  "teuer",
  "empfehlung",
  "retry",
  "bots",
];

/* ===== Drehbücher =====
 *
 * Je Schritt:
 *  key      Schlüssel der UI-Texte in der Komponente
 *  action   Schalter-Patch für sim.set() (leer = nur „Lage ansehen“)
 *  settle   Sim-s nach dem Anwenden bis zur Auflösung ✓/✗
 *  expect   Engpass-Station danach: "web" | "inv" | "pay" | "bleibt" | null
 *           ("bleibt" = dieselbe Station wie im vorigen Schritt, null =
 *           kein Engpass)
 *  overload Überlastzustand je Station zum Auflösungszeitpunkt:
 *           "ok" | "kollabiert" | "abgefangen"
 *  ask      optional: eigene Frage statt „Wohin wandert der Engpass?“ — die
 *           Art der Beobachtung (ASK_KINDS im Modell, observeTip()); die
 *           Tipps sind dann deren Ausgänge (Texte: wanderingBottleneckStepUi)
 *  answer   der Ausgang, den observeTip() bei der Auflösung liefert
 *  event    optional: Ereignis, das der Schritt mit dem Zug auslöst
 *           (sim.trigger(event, appliedAt)) — „stoerung“ = Störung beim
 *           Zahlungsdienst (Brownout, dann Neustart); „dauerlast“ = die
 *           Welle endet nicht mehr (Szenario spitzen); „ioSchub“ = ein
 *           erzwungener IO-Schub der Nachbar-VM auf das Storage der DB
 *           (Szenario bots)
 *
 * Gepinnt in __tests__/wanderingBottleneckModel.test.ts: ein Live-Lauf je
 * Seed durch alle Schritte, Auflösung genau bei appliedAt + settle, 50 Seeds.
 */
export const SCRIPTS = {
  rabatt: [
    {
      key: "start",
      action: {},
      settle: 30,
      expect: "web",
      overload: { web: "kollabiert", inv: "ok", pay: "ok" },
    },
    {
      key: "scale",
      action: { scale: true, scaleMode: "reaktiv" },
      settle: 150,
      expect: "inv",
      overload: { web: "ok", inv: "kollabiert", pay: "ok" },
    },
    {
      key: "bpInv",
      action: { bpInv: true },
      settle: 60,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    },
    {
      key: "shedBrowse",
      action: { shedBrowse: true },
      settle: 60,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    },
    {
      key: "featureShed",
      action: { featureShed: true },
      settle: 120,
      expect: "pay",
      overload: { web: "ok", inv: "ok", pay: "kollabiert" },
    },
    {
      key: "payProtect",
      action: { bpPay: true, shedCheckout: true },
      settle: 60,
      expect: "bleibt",
      overload: { web: "ok", inv: "ok", pay: "abgefangen" },
    },
  ],
  // Reihenfolge Batching → Cache (nicht umgekehrt): Batching spart je Seite
  // höchstens den Overhead (0,2 E). Käme der Cache zuerst, stünde die DB nur
  // knapp über, die Kasse knapp unter ihrer Grenze (gemessen: Reserve der
  // Kasse +8 % im Mittel, 4 von 50 Seeds schon überlastet) — kein
  // eindeutiger Schritt. So: Batching → DB bleibt (−61 %), Cache → Kasse.
  teuer: [
    {
      key: "start",
      action: {},
      settle: 30,
      expect: "inv",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    },
    {
      key: "scale",
      action: { scale: true, scaleMode: "vorgewaermt" },
      settle: 30,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    },
    {
      key: "batch",
      action: { batch: true },
      settle: 60,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    },
    {
      key: "cache",
      action: { cache: true },
      settle: 120,
      expect: "pay",
      overload: { web: "ok", inv: "ok", pay: "abgefangen" },
    },
  ],
  // Ab Schritt 1 eigene Fragen: Nach den Bulkheads bleibt der Engpass, die
  // Pointe sind die Checkouts; nach Timeouts und Breaker gibt es keinen
  // Engpass mehr — gefragt wird, was Kunden und Threads davon merken.
  empfehlung: [
    {
      key: "start",
      action: {},
      settle: 20,
      expect: "web",
      overload: { web: "kollabiert", inv: "ok", pay: "ok" },
    },
    {
      key: "bulkhead",
      action: { bulkhead: true },
      settle: 15,
      expect: "bleibt",
      overload: { web: "kollabiert", inv: "ok", pay: "ok" },
      ask: "checkout",
      answer: "laufen",
    },
    {
      key: "timeouts",
      action: { timeouts: true },
      settle: 20,
      expect: null,
      overload: { web: "ok", inv: "ok", pay: "ok" },
      ask: "browse",
      answer: "degradiert",
    },
    {
      key: "breaker",
      action: { breaker: true },
      settle: 15,
      expect: null,
      overload: { web: "ok", inv: "ok", pay: "ok" },
      ask: "recWait",
      answer: "keine",
    },
  ],
  // Jeder Schritt spielt dieselbe Störung ab (event): Brownout, dann
  // Neustart. Naive Retries halten den Zahlungsdienst danach unten
  // (metastabil); Backoff und Jitter ändern die Form, nicht die Menge —
  // erst das Budget deckelt sie; der Breaker sagt in der Störung sofort ab.
  // Der Breaker-Schritt löst in seiner ersten Probe-Phase auf (half-open,
  // die Queue beim Anbieter abgebaut): Er öffnet ≈ 4 s nach Beginn (erst
  // erkannte Timeouts zählen), bleibt BREAKER_OPEN_S offen, und gelingen
  // die Proben (35 % Kapazität reichen dafür), schließt er ≈ 9 s nach
  // Beginn wieder — dann reißt ihn die volle Last erneut auf (er flattert).
  // „abgefangen“ in 1.000/1.000 Seeds zwischen 8,2 und 9,8 s.
  retry: [
    {
      key: "start",
      action: {},
      event: "stoerung",
      settle: 27,
      expect: "pay",
      overload: { web: "ok", inv: "ok", pay: "kollabiert" },
    },
    {
      key: "backoff",
      action: { retry: "backoff" },
      event: "stoerung",
      settle: 27,
      expect: "bleibt",
      overload: { web: "ok", inv: "ok", pay: "kollabiert" },
      ask: "retryShape",
      answer: "wellen",
    },
    {
      key: "jitter",
      action: { retry: "backoffJitter" },
      event: "stoerung",
      settle: 27,
      expect: "bleibt",
      overload: { web: "ok", inv: "ok", pay: "kollabiert" },
      ask: "retryShape",
      answer: "glatt",
    },
    {
      key: "budget",
      action: { retryBudget: true },
      event: "stoerung",
      settle: 27,
      expect: null,
      overload: { web: "ok", inv: "ok", pay: "ok" },
      ask: "payLoad",
      answer: "x11",
    },
    {
      key: "breaker",
      action: { breaker: true },
      event: "stoerung",
      settle: 8.7,
      expect: "pay",
      overload: { web: "ok", inv: "ok", pay: "abgefangen" },
      ask: "kunden",
      answer: "sofort",
    },
  ],
  // Überlastvektor mit vierter Station (mail). Schritt 0 löst mitten im
  // zweiten Blitzangebot auf (25 s nach seinem Beginn) — Schritt 0 beginnt
  // in der UI immer genau beim Vorlauf, die Phase der Welle steht also
  // fest. Danach eigene Fragen über eine ganze Angebotsperiode: Mit Puffer
  // gibt es in jeder Phase keinen Engpass; bei Dauerlast läuft er voll —
  // beides hängt nicht an der Phase der Welle.
  spitzen: [
    {
      key: "start",
      action: {},
      settle: SPITZEN_PERIOD_S + 25,
      expect: "mail",
      overload: { web: "ok", inv: "ok", pay: "ok", mail: "kollabiert" },
    },
    {
      key: "smoothing",
      action: { smoothing: true },
      settle: 2 * SPITZEN_PERIOD_S,
      expect: null,
      overload: { web: "ok", inv: "ok", pay: "ok", mail: "ok" },
      ask: "mails",
      answer: "verspaetet",
    },
    {
      key: "dauerlast",
      action: {},
      event: "dauerlast",
      settle: 180,
      expect: "mail",
      overload: { web: "ok", inv: "ok", pay: "ok", mail: "abgefangen" },
      ask: "mails",
      answer: "verloren",
    },
  ],
  // Die DB bleibt der Engpass — Zufluss bremsen schafft keine Kapazität, und
  // der Bot bleibt Nachfrage (Rate Limit senkt sie nicht). Gefragt wird ab
  // Schritt 1, wen das Abweisen trifft und was Kunden sehen. Schritt 2
  // ersetzt das Shedding durch das Rate Limit: Sonst finge der Shedder (er
  // reagiert auf die Wartezeit der DB) auch den IO-Schub in Schritt 3 ab,
  // und die Lehre des statischen Limits bliebe unsichtbar. Schritte 3 und 4
  // spielen denselben IO-Schub der Nachbar-VM ab (event), Auflösung mitten
  // darin.
  bots: [
    {
      key: "start",
      action: {},
      settle: 30,
      expect: "inv",
      overload: { web: "ok", inv: "kollabiert", pay: "ok" },
    },
    {
      key: "shed",
      action: { shedBrowse: true },
      settle: 60,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
      ask: "wen",
      answer: "beide",
    },
    {
      key: "rateLimit",
      action: { rateLimit: true, shedBrowse: false },
      settle: 60,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
      ask: "wen",
      answer: "bot",
    },
    {
      key: "admission",
      action: { admission: true },
      event: "ioSchub",
      settle: 30,
      expect: "bleibt",
      overload: { web: "ok", inv: "kollabiert", pay: "ok" },
      ask: "seiten",
      answer: "warten",
    },
    {
      key: "bpInv",
      action: { bpInv: true },
      event: "ioSchub",
      settle: 40,
      expect: "bleibt",
      overload: { web: "ok", inv: "abgefangen", pay: "ok" },
      ask: "seiten",
      answer: "teils",
    },
  ],
};

/* Zitierfähige Kennzahlen je Drehbuch-Schritt (gerundet; req/s im Mittel der
 * letzten 20 s vor der Auflösung — bzw. figWindowS des Szenarios, höchstens
 * seit dem Zug —, Mittel über 50 Seeds). Gemessen, nicht
 * gesetzt — der Test prüft sie gegen das Modell, die Folien dürfen sie
 * zitieren. pages = rechtzeitige Produktseiten, orders = rechtzeitige
 * Bestellungen, rejected = früh abgewiesen, lost = verloren (in der
 * Eingangs-Queue aufgegeben + zu spät), waste = zu spät beantwortet. */
export const SCRIPT_FIGURES = {
  rabatt: [
    { key: "start", pages: 0, orders: 0, rejected: 0, lost: 1000, waste: 200 },
    { key: "scale", pages: 0, orders: 0, rejected: 0, lost: 1000, waste: 300 },
    { key: "bpInv", pages: 290, orders: 10, rejected: 700, lost: 1, waste: 0 },
    {
      key: "shedBrowse",
      pages: 280,
      orders: 28,
      rejected: 690,
      lost: 0,
      waste: 0,
    },
    {
      key: "featureShed",
      pages: 910,
      orders: 0,
      rejected: 0,
      lost: 90,
      waste: 90,
    },
    {
      key: "payProtect",
      pages: 910,
      orders: 70,
      rejected: 20,
      lost: 1,
      waste: 0,
    },
  ],
  teuer: [
    { key: "start", pages: 290, orders: 10, rejected: 600, lost: 1, waste: 1 },
    { key: "scale", pages: 290, orders: 10, rejected: 590, lost: 1, waste: 1 },
    { key: "batch", pages: 330, orders: 12, rejected: 550, lost: 1, waste: 1 },
    { key: "cache", pages: 820, orders: 70, rejected: 10, lost: 2, waste: 2 },
  ],
  // Mittel der letzten figWindowS = 10 s; degraded = rechtzeitige Seiten
  // ohne Empfehlungen (Timeout, offener Breaker), in pages enthalten
  empfehlung: [
    {
      key: "start",
      pages: 0,
      orders: 0,
      rejected: 0,
      lost: 140,
      waste: 140,
      degraded: 0,
    },
    {
      key: "bulkhead",
      pages: 0,
      orders: 20,
      rejected: 0,
      lost: 200,
      waste: 100,
      degraded: 0,
    },
    {
      key: "timeouts",
      pages: 200,
      orders: 20,
      rejected: 0,
      lost: 0,
      waste: 0,
      degraded: 200,
    },
    {
      key: "breaker",
      pages: 200,
      orders: 20,
      rejected: 0,
      lost: 0,
      waste: 0,
      degraded: 200,
    },
  ],
  // Mittel der letzten figWindowS = 10 s (der Breaker-Schritt ist kürzer:
  // seit dem Zug); amp = Versuche je Erstversuch am Zahlungsdienst im selben
  // Fenster — über den ganzen Schritt gezählt, kämen Retries des vorigen
  // Sturms ohne ihre Erstversuche dazu (Jitter: > 3); wave = Spitze / Mittel
  // der Retries je Sekunde nach dem Neustart (ab 2 s danach). Bestellungen
  // zählen nur rechtzeitig (Frist 2 s über den ganzen Checkout): Ein Retry
  // nach einem Timeout von 2 s kommt fast immer zu spät.
  retry: [
    { key: "start", pages: 150, orders: 0, rejected: 0, lost: 37, amp: 2.8 },
    {
      key: "backoff",
      pages: 150,
      orders: 2,
      rejected: 0,
      lost: 41,
      amp: 2.6,
      wave: 2,
    },
    {
      key: "jitter",
      pages: 150,
      orders: 1,
      rejected: 0,
      lost: 35,
      amp: 2.5,
      wave: 1.3,
    },
    { key: "budget", pages: 150, orders: 50, rejected: 0, lost: 1, amp: 1 },
    { key: "breaker", pages: 150, orders: 10, rejected: 24, lost: 16, amp: 1 },
  ],
  // Mittel der letzten 20 s vor der Auflösung — mitten in der Welle bzw. in
  // der Dauerlast; mailSent / mailLost = Mails/s verschickt / verloren,
  // delay = größte Verzögerung einer Mail über den ganzen Schritt [s]
  spitzen: [
    {
      key: "start",
      pages: 200,
      orders: 6,
      rejected: 0,
      lost: 54,
      mailSent: 45,
      mailLost: 0,
      delay: 10,
    },
    {
      key: "smoothing",
      pages: 200,
      orders: 60,
      rejected: 0,
      lost: 0,
      mailSent: 45,
      mailLost: 0,
      delay: 10,
    },
    {
      key: "dauerlast",
      pages: 200,
      orders: 60,
      rejected: 0,
      lost: 0,
      mailSent: 45,
      mailLost: 15,
      delay: 20,
    },
  ],
  // Mittel der letzten 20 s vor der Auflösung; pages = alle rechtzeitigen
  // Produktseiten (Kunden + Bot), custPages / custRej = Kundenseiten
  // rechtzeitig / Kunden früh abgewiesen (Seiten und Checkouts), botOk /
  // botRej = Bot rechtzeitig / früh abgewiesen (429, 503, Shedding)
  bots: [
    {
      key: "start",
      pages: 0,
      orders: 0,
      rejected: 0,
      lost: 600,
      custPages: 0,
      custRej: 0,
      botOk: 0,
      botRej: 0,
    },
    {
      key: "shed",
      pages: 280,
      orders: 20,
      rejected: 440,
      lost: 1,
      custPages: 90,
      custRej: 140,
      botOk: 195,
      botRej: 305,
    },
    {
      key: "rateLimit",
      pages: 240,
      orders: 20,
      rejected: 490,
      lost: 0,
      custPages: 230,
      custRej: 0,
      botOk: 10,
      botRej: 490,
    },
    {
      key: "admission",
      pages: 0,
      orders: 0,
      rejected: 490,
      lost: 260,
      custPages: 0,
      custRej: 0,
      botOk: 0,
      botRej: 490,
    },
    {
      key: "bpInv",
      pages: 160,
      orders: 18,
      rejected: 570,
      lost: 1,
      custPages: 150,
      custRej: 80,
      botOk: 7,
      botRej: 490,
    },
  ],
};
