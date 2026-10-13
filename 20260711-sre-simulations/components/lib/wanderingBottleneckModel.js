/**
 * wanderingBottleneckModel.js — Flussmodell „Wandernde Engpässe“:
 * Online-Shop mit Lastknoten → Webserver → Bestandsprüfung (DB) →
 * Zahlungsdienst (extern), dazu eine verdeckte Nachbar-VM.
 *
 * Zwei Fragen, eine Engine:
 *  - Ursache (Szenarien `nachbar`, `zufall`): bei KONSTANTER Last wandert der
 *    Engpass zwischen Webserver und DB — durch einen Nachbarn auf dem Host
 *    (CPU → %steal im Web-Gast) und am geteilten Storage (IO → Disk-await der
 *    DB), oder ganz ohne Auslöser durch Zufall (Roser et al.).
 *  - Gegenmaßnahmen (Szenario `rabatt`): Rabattaktion 100 → 1.000 req/s; jede
 *    Gegenmaßnahme verschiebt den Engpass oder fängt ihn ab (Drehbuch in
 *    wanderingBottleneckScenarios.js). Zusatzszenario `teuer` (Arbeit
 *    reduzieren): DB-gebunden bei 900 req/s; Scaling hilft nicht, Batching
 *    spart nur den Overhead, Cache + Coalescing die Empfehlungen — dann
 *    wandert der Engpass über den Funnel zur Kasse. Zusatzszenario `retry`
 *    (Verstärkung verhindern): Retries am Zahlungsdienst halten ihn nach
 *    einer kurzen Störung unten; Backoff, Jitter, Budget, Breaker.
 *    Zusatzszenario `bots` (Zufluss bremsen): Ein Scraper-Bot überlastet
 *    die DB; Load Shedding trifft Kunden wie Bot, das Rate Limit je Client
 *    nur den Bot, ein statisches globales Limit (Admission) passt nicht
 *    mehr, sobald ein IO-Schub der Nachbar-VM die DB bremst — Back
 *    Pressure folgt der echten Kapazität.
 *
 * Flussmodell mit festem DT = 0,1 s. Requests sind Fluid-Mengen je Klasse
 * (B = Produktseite, C = Checkout). OU-Prozesse (Ornstein-Uhlenbeck) auf den
 * Kapazitäten von web/inv/pay und auf den Ankünften; drei getrennte
 * mulberry32-Ströme (Kapazität, Ankünfte, Nachbar). Schalter ziehen KEINE
 * Zufallszahlen: A/B mit gleichem Seed sieht dieselbe Umwelt.
 *
 * ─── Zwei Zeitskalen ────────────────────────────────────────────────────────
 * Gestreckt (realistisch, ≈ ×10 gegenüber dem Prototyp mit τ = 4 s):
 *   OU_TAU_S 30 s · Nachbar-Phasen 25–45 s, Pausen 40–120 s · NB_RAMP_TAU_S 3 s
 *   Scaling reaktiv: Erkennen 30 s + Kaltstart 60 s + Aufwärmen 30 s
 *   (40 → 100 %) · vorgewärmt 10 s
 *   FUNNEL_TAU_S 30 s · RES_TAU_S 5 s · Murphy (Abstand 20 s, Schlag 35 s)
 * Echte Sekunden (bleiben, wie sie sind):
 *   DEADLINE_S 2 s („zu spät“) · ABANDON_S / PAY_GIVEUP_S 10 s ·
 *   EDGE_BOUND_S 0,5 s · SHED_TARGET_S 0,2 s · DB_PERMIT_S 0,1 s ·
 *   PAY_PERMIT_S 0,3 s · COLLAPSE_WAIT_S 1 s · Basislatenzen (20–250 ms)
 * Szenarien tragen eigenes Tempo und Fenster (Scenarios-Datei).
 *
 * ─── Engpass-Semantik (eine Regel, überall gleich benannt) ──────────────────
 *  Nachfrage = was ankäme, wenn nichts abgewiesen würde: Ankünfte, nur durch
 *    die KAPAZITÄT der Vorstufen begrenzt. Abweisen, Back Pressure, Shedding
 *    senken sie nicht. Mit shedBrowse haben Checkouts beim Bearbeitungsstart
 *    Vorrang und passieren Webserver und DB zuerst; ohne teilen sich beide
 *    Klassen eine knappe Vorstufe anteilig. Am Zahlungsdienst gilt zusätzlich
 *    die gemessene Ankunftsrate als Untergrenze (was ankommt, ist Nachfrage).
 *    Damit gilt Nachfrage ≥ Durchsatz an jeder Station (Test).
 *  Reserve = Kapazität / Nachfrage − 1 (EMA, τ = RES_TAU_S).
 *  Knappste Station = argmin Reserve mit HYST = 3 % Hysterese, immer definiert.
 *  Engpass = knappste Station, falls ihre Reserve < 0.
 *  Überlast je Station (Reserve < 0): „kollabiert“ = ungeschützt oder Warte-
 *    zeit an der Station > COLLAPSE_WAIT_S (Arbeit kommt zu spät);
 *    „abgefangen“ = geschützt (begrenzt + abgewiesen) und kurze Wartezeit.
 *    Geschützt heißt: web = begrenzte Eingangs-Queue (bpInv/bpPay) oder
 *    shedBrowse; inv = bpInv, Timeouts oder shedBrowse (sieht ohne Back
 *    Pressure die Wartezeit der DB); pay = bpPay, shedCheckout, Timeouts
 *    oder Breaker; web und inv auch rateLimit und admission (weisen am Rand
 *    ab — statisch, also nur „abgefangen“, solange die Wartezeit kurz
 *    bleibt). Auch geschützt
 *    kollabiert eine Station, wenn die Wartezeit trotzdem wächst — etwa wenn
 *    schon die Checkouts allein die Webserver überlasten (Shedding trifft
 *    nur Produktseiten).
 *  Engpass-Wechsel = Wechsel zwischen Überlast-Episoden an VERSCHIEDENEN
 *    Stationen. Daneben: Engpass-Zeit (Anteil mit Engpass) und, getrennt,
 *    Wechsel der knappsten Station (auch ohne Überlast).
 *  „+20 % überall“ (⚙ headroomAll), bei „Nur Zufall“: die Überlast
 *    verschwindet, die knappste Station wandert aber weiter wie vorher —
 *    Reserve überall verschiebt nur das Niveau, nicht die Reihenfolge. Gegen
 *    die Nachbar-VM reicht sie nicht: Ein Schub (25–40 % Steal) frisst sie
 *    auf, Überlast und Wechsel bleiben.
 *
 * ─── Messgrößen je Klasse (B = Produktseite, C = Checkout) ──────────────────
 *  Rechtzeitig (okB/okC), früh abgewiesen (shed*, r503*, r429* → rejected*),
 *  verloren (abandoned* + zu spät → lost*), verschwendete Arbeit (waste* =
 *  zu spät beantwortet). Jeweils mit Suffix B/C in Fluss (`f`), 1-s-Proben,
 *  kumulierten Zählern, summarize() und snapshot().outcome; die Summenfelder
 *  ohne Suffix bleiben.
 *
 * ─── Nachbar: Murphy ────────────────────────────────────────────────────────
 *  Murphy (nur Demo, ohne RNG) schlägt zu, sobald (1) im vorigen Schritt kein
 *  Engpass bestand, (2) MURPHY_GAP_S seit dem letzten Schlag vergangen sind,
 *  und trifft (3) die ANDERE Station als die letzte Engpass-Station, (4)
 *  sobald deren Eigenrauschen im Tief ist (z ≤ MURPHY_LOW_Z). Fallback: Kommt
 *  dieses Tief nicht binnen MURPHY_MAX_WAIT_S nach dem letzten Schlag, schlägt
 *  Murphy trotzdem zu, damit die Demo nicht stehen bleibt. Diese Schläge sind
 *  im Schlag-Log mit `fallback: true` markiert und in stats.murphyFallbacks
 *  gezählt (gemessen ≈ 9 % der Schläge, 100 Seeds × beide Ursachen).
 *
 * ─── Startfenster (bewusste Demo-Entscheidung) ──────────────────────────────
 *  „Nur Zufall“ schwankt stark zwischen 10-min-Fenstern (OU-τ = 30 s); etwa
 *  jedes siebte erste Fenster zeigt gar keinen Engpass-Wechsel, über ein
 *  Drittel weniger als zwei (400 Seeds). pickStartSeed()
 *  zieht deshalb für die Ursachen-Szenarien Seeds, bis das erste angezeigte
 *  Fenster (Vorlauf) mindestens START_MIN_SHIFTS Wechsel zeigt — höchstens
 *  START_MAX_TRIES Versuche, deterministisch bei gegebenem rng. Das ist eine
 *  Auswahl, keine Kalibrierung; der Erklär-Tab legt sie offen.
 *
 * ─── Arbeit reduzieren (Phase 2, Szenario `teuer`) ──────────────────────────
 *  cache: Cache + Coalescing für die Empfehlungen, Schlüssel je Produkt
 *    (personalisiert wird danach nur sortiert) — CACHE_HIT der Seiten
 *    bekommen ihre Empfehlungen ohne DB-Arbeit
 *    (Treffer, dazu gleichzeitige Fehltreffer zu EINER Anfrage
 *    zusammengelegt); 1,2 E → 0,24 E je Seite, der Aufruf der Empfehlungen
 *    entfällt bei Treffern (Latenz sinkt). Die Funktion bleibt. Die
 *    Checkout-Reservierung kommt nie aus dem Cache (sonst Überverkauf).
 *  batch: Verfügbarkeitsabfragen eines Sammelfensters (BATCH_WINDOW_S) gehen
 *    als ein Bündel an die DB; der Overhead 0,2 E teilt sich auf k = Rate ×
 *    Fenster Abfragen (≥ 1), je Artikel bleibt 0,1 E. Kostet im Mittel ein
 *    halbes Fenster Latenz — auch ohne Last, wo k ≈ 1 nichts spart. Die
 *    Reservierung bleibt einzeln. Bündelgröße aus der Nachfrage-Rate der
 *    Produktseiten an der DB (vereinfacht).
 *  Beide Schalter wirken nur auf die Kosten je Produktseite (cB) in
 *  `_compute()` und auf die geschätzte Latenz in `_flow()`; sie ziehen
 *  keine Zufallszahlen.
 *
 * ─── Überlast isolieren, Verstärkung verhindern (Szenario `empfehlung`) ─────
 *  Der Empfehlungsdienst (Seitenknoten `rec`) antwortet nach recLat(t) —
 *  Profil des Szenarios, sonst REC_LAT_S. Jede Produktseite, die ihn
 *  aufruft, hält ihren Web-Thread recLat − REC_LAT_S länger (Basislatenzen
 *  halten im Modell keinen Thread, wie DB_LAT_S und PAY_LAT_S; Checkouts
 *  halten Threads nur in DB- und Zahlungs-Queue — die zählen dort). Little:
 *  Threads = Seiten/s × Zusatz-Haltezeit. Reicht der Pool nicht, begrenzt
 *  er die Starts: Die Webserver werden zum Engpass („Threads voll“), auch
 *  für Checkouts, obwohl DB und Kasse gesund sind. Kapazität der Webserver
 *  = min(CPU, was die Threads tragen) — ohne Zusatz-Haltezeit genau die CPU.
 *  bulkhead: getrennte Pools, Checkout BULKHEAD_CHECKOUT, Rest den Seiten.
 *  timeouts: Empfehlungen nach REC_TIMEOUT_S abbrechen → Seite ohne sie
 *    („degradiert“, trotzdem rechtzeitig); DB: Arbeit in der DB höchstens
 *    DB_TIMEOUT_S, was darüber käme, scheitert sofort mit 504 (vereinfacht:
 *    ohne die Wartezeit davor); Zahlung: Abbruch nach PAY_TIMEOUT_S statt
 *    nach PAY_GIVEUP_S — die Threads werden früher frei.
 *  breaker: Circuit Breaker vor Empfehlungen und Zahlung. Fehleranteil der
 *    Aufrufe als EMA (BREAKER_TAU_S) über BREAKER_TRIP → offen für
 *    BREAKER_OPEN_S, dann half-open: HALF_ADMIT der Aufrufe als Probe;
 *    scheitert sie, wieder offen, sonst nach BREAKER_CLOSE_S geschlossen.
 *    Fehler = Abbruch (Timeout, Abbruch des Zahlungsdienstes) — ein
 *    langsamer Aufruf ohne Timeout ist kein Fehler, den sieht der Breaker
 *    nicht. Half-open schließt er erst, wenn die Ergebnisse der ersten
 *    Proben da sein können (nach ihrer Wartezeit). Offen vor den
 *    Empfehlungen: Seiten ohne Aufruf, sofort und ohne DB-Arbeit für
 *    Empfehlungen (automatisches Feature Shedding, gezählt als
 *    „degradiert“); offen vor der Zahlung: Checkouts sofort 503.
 *  Feature Shedding zählt NICHT als degradiert: Das ist eine bewusste
 *  Abschaltung, kein Rückfall.
 *
 * ─── Verstärkung verhindern: Retries (Szenario `retry`) ──────────────────────
 *  Zahlung als Versuche (_payLayer), aktiv im Szenario `retry` (retryLayer)
 *  oder sobald cm.retry nicht „aus“ ist; sonst der alte Pfad, bitgleich.
 *  Ein Versuch scheitert, wenn er hinter der Queue des Anbieters den
 *  Timeout des Clients reißt (FIFO, auch innerhalb eines Schritts); der
 *  Anbieter rechnet ihn trotzdem fertig (verschwendet). Retries laufen als
 *  Verzögerungsleitung (Ringpuffer je 0,1 s): naiv sofort, Backoff
 *  2 s / 4 s, mit Jitter gleichverteilt bis dahin, höchstens
 *  RETRY_MAX_ATTEMPTS Versuche; Budget als Token Bucket (≤ 10 %); offener
 *  Breaker sagt sofort ab (503 am Rand, Retries scheitern). Die Frist
 *  DEADLINE_S gilt wie überall für den ganzen Checkout: Eine Zahlung, die
 *  erst im zweiten Versuch gelingt, kommt fast immer zu spät (verloren).
 *  Den Breaker füttern nur Ausgänge, die der Client kennt (erkannte
 *  Timeouts, gelungene Zahlungen); scheitert die Mehrheit der Versuche,
 *  heißt die Kasse „kollabiert“, auch geschützt. Störung
 *  (trigger("stoerung")): Brownout PAY_BROWNOUT für PAY_BROWNOUT_S, dann
 *  Neustart — alle offenen Aufrufe scheitern im selben Moment und
 *  synchronisieren die Retries.
 *
 * ─── Spitzen verteilen: Mailversand (Szenario `spitzen`) ────────────────────
 *  Blitzangebote bringen Wellen von Checkouts (SCENARIOS.spitzen.waves:
 *  alle SPITZEN_PERIOD_S für SPITZEN_ON_S auf SPITZEN_PEAK statt
 *  SPITZEN_BASE) — im Mittel unter MAIL_CAP, in der Spitze darüber. Nach
 *  jeder bedienten Zahlung geht eine Bestätigungsmail an den Mailversand,
 *  die vierte Station (nur in diesem Szenario; Überlastvektor mit `mail`).
 *  Synchron (Default) wartet der Checkout auf die Mail: Ihre Wartezeit
 *  zählt zur Latenz und hält den Thread; nach MAIL_GIVEUP_S bricht der Shop
 *  ab. Nachfrage = was jetzt ankommt. Ungeschützt ⇒ „kollabiert“.
 *  smoothing: Bestellung sofort, Mail in einen Puffer — höchstens
 *    MAIL_Q_MAX Mails und keine älter als MAIL_MAX_AGE_S (die engere Grenze
 *    zählt); was darüber liegt, geht verloren, die Bestellung gilt. Wird
 *    der Puffer abgeschaltet, verschickt der Mailversand seinen Rest im
 *    Hintergrund (mqBg) mit der Kapazität, die die synchronen Mails übrig
 *    lassen — darauf wartet niemand, es hält keinen Thread; was binnen
 *    MAIL_MAX_AGE_S nicht rausgeht, verfällt. Hinter
 *    dem Puffer zählt als Nachfrage der Zufluss geglättet über
 *    MAIL_SMOOTH_TAU_S (EMA): Lastglättung hilft genau dann, wenn dieses
 *    Mittel unter der Kapazität liegt. Begrenzt und ohne wartenden Kunden ⇒
 *    Überlast heißt „abgefangen“.
 *  trigger("dauerlast"): Die Welle endet nicht mehr — das Mittel liegt
 *    über MAIL_CAP, der Puffer läuft voll.
 *  Eigener Zufallsstrom für die Kapazität des Mailversands, nur in diesem
 *  Szenario: Die drei Ströme der anderen Szenarien bleiben unberührt.
 *
 * ─── Zufluss bremsen: Bot, Rate Limit, Admission (Szenario `bots`) ─────────
 *  Dritte Verkehrsklasse „Bot“ (SCENARIOS.bots.bot): EIN Client, der
 *  Produktseiten abfragt — gleicher Weg, gleiche DB-Arbeit wie eine
 *  Kundenseite, ohne Rauschen. Im Fluss läuft er in der Klasse B mit;
 *  eigene Zähler verfolgen seinen Anteil (Eingangs-Queue gemischt, FIFO).
 *  Kein Funnel: Bots kaufen nicht. Der Bot ist Nachfrage — abgewiesen oder
 *  nicht (Rate Limit senkt die Nachfrage nicht).
 *  Am Rand, vor allem anderen und ohne Arbeit:
 *  rateLimit: Token Bucket je Client (RL_RATE/s, Vorrat RL_BURST), 429.
 *    Kunden bleiben je Client weit darunter — getroffen wird nur der Bot.
 *  admission: globales, statisches Limit ADMISSION_RPS über alle Klassen
 *    (503, anteilig) — es kennt die Kapazität der Kette nicht.
 *  Load Shedding (shedBrowse) reagiert auf den Zustand des Servers: auf die
 *    Eingangs-Queue (SHED_TARGET_S) und, ohne Back Pressure, auf die
 *    Wartezeit der DB — ab SHED_DB_S weist es Produktseiten anteilig früh
 *    ab, ab SHED_DB_S + SHED_DB_BAND_S alle. Wer fragt, sieht es nicht:
 *    Kunden und Bot gleich. Mit Back Pressure bleibt die DB unter
 *    DB_PERMIT_S, dieser Teil ruht.
 *  trigger("ioSchub"): erzwungener IO-Schub der Nachbar-VM auf das Storage
 *    der DB — wie eine IO-Phase des Zufalls-Zyklus (Disk-await ×
 *    NB_AWAIT_MAX, IO_BURST_S lang), nur zu fester Zeit; zieht keine
 *    Zufallszahlen.
 */
import { HALF_ADMIT } from "./breakerModel.js";
import { mulberry32, noise, randomSeed } from "./rng.js";
import {
  BOT_RATE,
  BOT_START_S,
  BOTS_CHECKOUTS,
  BOTS_LOAD,
  CAMPAIGN_START_S,
  CAUSE_ORDER,
  EMPF_CHECKOUTS,
  EMPF_LOAD,
  LOAD_CAMPAIGN,
  LOAD_NORMAL,
  LOAD_RAMP_S,
  NACHBAR_LOAD,
  N_WEB_CAUSE,
  N_WEB_EMPF,
  N_WEB_START,
  N_WEB_TEUER,
  REC_SLOW_AT_S,
  REC_SLOW_S,
  REMEDY_ORDER,
  RETRY_CHECKOUTS,
  RETRY_LOAD,
  RETRY_START_S,
  N_WEB_RETRY,
  SCALE_TARGET_EMPF,
  SCALE_TARGET_RETRY,
  SCALE_TARGET_TEUER,
  SCALE_TARGET_SPITZEN,
  SCENARIOS,
  SCRIPTS,
  SCRIPT_FIGURES,
  SPITZEN_BASE,
  SPITZEN_ON_S,
  SPITZEN_PAGES,
  SPITZEN_PEAK,
  SPITZEN_PERIOD_S,
  SPITZEN_START_S,
  N_WEB_SPITZEN,
  N_WEB_BOTS,
  SCALE_TARGET_BOTS,
  TEUER_LOAD,
  THREADS_EMPF,
  ZUFALL_LOAD,
} from "./wanderingBottleneckScenarios.js";

export {
  BOT_RATE,
  BOT_START_S,
  BOTS_CHECKOUTS,
  BOTS_LOAD,
  CAMPAIGN_START_S,
  CAUSE_ORDER,
  EMPF_CHECKOUTS,
  EMPF_LOAD,
  HALF_ADMIT,
  LOAD_CAMPAIGN,
  LOAD_NORMAL,
  LOAD_RAMP_S,
  NACHBAR_LOAD,
  N_WEB_CAUSE,
  N_WEB_EMPF,
  N_WEB_START,
  N_WEB_TEUER,
  REC_SLOW_AT_S,
  REC_SLOW_S,
  REMEDY_ORDER,
  RETRY_CHECKOUTS,
  RETRY_LOAD,
  RETRY_START_S,
  N_WEB_RETRY,
  SCALE_TARGET_EMPF,
  SCALE_TARGET_RETRY,
  SCALE_TARGET_TEUER,
  SCALE_TARGET_SPITZEN,
  SCENARIOS,
  SCRIPTS,
  SCRIPT_FIGURES,
  SPITZEN_BASE,
  SPITZEN_ON_S,
  SPITZEN_PAGES,
  SPITZEN_PEAK,
  SPITZEN_PERIOD_S,
  SPITZEN_START_S,
  N_WEB_SPITZEN,
  N_WEB_BOTS,
  SCALE_TARGET_BOTS,
  TEUER_LOAD,
  THREADS_EMPF,
  ZUFALL_LOAD,
};

/* ===== Engine ===== */

export const DT = 0.1; // s, fester Schritt
export const STEPS_PER_S = 10;
export const HIST_MAX = 3600; // 1-s-Proben im Ringpuffer (1 h)

/* ===== Topologie (illustrativ; alle Zahlen, die auf Folien stehen) ===== */

export const WEB_PER_INSTANCE = 100; // req/s CPU je Webserver-Instanz
export const THREADS_PER_INSTANCE = 200; // Threads je Instanz (gehalten bis Antwort)
export const INV_CAP_E = 450; // E/s: Bestands-DB (1 E = eine Bestandsprüfung)
export const INV_OVERHEAD_E = 0.2; // E je Verfügbarkeitsabfrage (fix)
export const INV_PER_ITEM_E = 0.1; // E je Artikel
export const INV_AVAIL_E = 0.3; // = Overhead 0,2 + 1 Artikel · 0,1
export const INV_RECO_E = 1.2; // E: personalisierte Empfehlungen (gleiche DB)
export const INV_PAGE_E = INV_AVAIL_E + INV_RECO_E; // 1,5 E je Produktseite
export const INV_RESERVE_E = 1.0; // E je Checkout-Reservierung, nie gecacht
export const INV_PAGES_PER_S = Math.round(INV_CAP_E / INV_PAGE_E); // 300
export const INV_PAGES_PER_S_FS = Math.round(INV_CAP_E / INV_AVAIL_E); // 1.500 ohne Empfehlungen
export const PAY_CAP = 70; // req/s, externer Zahlungsdienst
export const REC_CAP = 2000; // req/s, Empfehlungsdienst (Seitenknoten)
export const CONV = 0.1; // Funnel: Checkouts je rechtzeitig ausgelieferter Produktseite
export const CONV_PCT = Math.round(CONV * 100); // 10
export const HEADROOM = 0.2; // Schutzkapazität
export const HEADROOM_PCT = Math.round(HEADROOM * 100); // 20

/* ===== Arbeit reduzieren: Cache + Coalescing, Batching ===== */

// Cache + Coalescing für die personalisierten Empfehlungen: Anteil der
// Seiten, deren Empfehlungen ohne DB-Arbeit kommen (Cache-Treffer, dazu
// gleichzeitige Fehltreffer zum selben Schlüssel, zusammengelegt zu EINER
// DB-Anfrage). Die Funktion bleibt; die Reservierung nie aus dem Cache.
export const CACHE_HIT = 0.8;
export const CACHE_HIT_PCT = Math.round(CACHE_HIT * 100); // 80
export const INV_RECO_CACHED_E = INV_RECO_E * (1 - CACHE_HIT); // 0,24 E
export const INV_PAGE_CACHED_E = INV_AVAIL_E + INV_RECO_CACHED_E; // 0,54 E
// Batching der Verfügbarkeitsabfragen: Alle Abfragen eines Sammelfensters
// gehen als EIN Bündel an die DB — der Overhead (INV_OVERHEAD_E) verteilt
// sich auf k = Rate × Fenster Abfragen (mindestens 1), je Artikel bleibt
// INV_PER_ITEM_E. Kosten: im Mittel ein halbes Fenster Wartezeit, auch ohne
// Last (dann k ≈ 1 und kein Gewinn).
export const BATCH_WINDOW_S = 0.05; // Sammelfenster (vgl. Kafka linger.ms = 50)
export const BATCH_WINDOW_MS = Math.round(BATCH_WINDOW_S * 1000); // 50
export const BATCH_LAT_S = BATCH_WINDOW_S / 2; // mittlere Zusatzlatenz
export const BATCH_LAT_MS = Math.round(BATCH_LAT_S * 1000); // 25
// Grenzwerte bei großem Bündel (k → ∞, nur noch die Kosten je Artikel) —
// bei 900 req/s ist k ≈ 41, also je Seite ≈ 0,005 E mehr
export const INV_PAGE_BATCHED_E = INV_PER_ITEM_E + INV_RECO_E; // ≈ 1,3 E
export const INV_PAGE_LEAN_E = INV_PER_ITEM_E + INV_RECO_CACHED_E; // ≈ 0,34 E

/* ===== Überlast isolieren, Verstärkung verhindern (echte Sekunden) ===== */

export const REC_RAMP_S = 2; // Übergang der Antwortzeit des Empfehlungsdienstes
export const BULKHEAD_CHECKOUT = 0.25; // Anteil der Threads im Checkout-Pool
export const BULKHEAD_CHECKOUT_PCT = Math.round(BULKHEAD_CHECKOUT * 100); // 25
export const BULKHEAD_REST_PCT = 100 - BULKHEAD_CHECKOUT_PCT; // 75
export const REC_TIMEOUT_S = 0.3; // Empfehlungen: danach Seite ohne sie (degradiert)
export const REC_TIMEOUT_MS = Math.round(REC_TIMEOUT_S * 1000); // 300
export const DB_TIMEOUT_S = 0.5; // DB: Arbeit darüber scheitert sofort (504)
export const PAY_TIMEOUT_S = 2; // Zahlung: Abbruch nach 2 s statt PAY_GIVEUP_S
export const BREAKER_TAU_S = 1; // Fehleranteil als EMA
export const BREAKER_TRIP = 0.5; // ab diesem Fehleranteil öffnet der Breaker
export const BREAKER_TRIP_PCT = Math.round(BREAKER_TRIP * 100); // 50
export const BREAKER_OPEN_S = 3; // so lange offen, dann half-open
export const BREAKER_CLOSE_S = 1.5; // half-open ohne Fehler → geschlossen
export const HALF_ADMIT_PCT = Math.round(HALF_ADMIT * 100); // 10 % Proben
// „Empfehlungen hängen“: Kopfrechnen (Little) — Threads und was sie tragen
export const EMPF_PAGES = EMPF_LOAD - EMPF_CHECKOUTS; // 200 Produktseiten/s
export const THREADS_EMPF_TOTAL = N_WEB_EMPF * THREADS_EMPF; // 400
export const THREADS_EMPF_REST = Math.round(
  THREADS_EMPF_TOTAL * (1 - BULKHEAD_CHECKOUT),
); // 300 im Pool der Seiten
export const THREADS_EMPF_CHECKOUT = THREADS_EMPF_TOTAL - THREADS_EMPF_REST; // 100
// Little: Seiten/s × Wartezeit = belegte Threads — beim Hänger 600 nötig,
// 400 da; mit Timeout 200 × 0,3 = 60
export const EMPF_THREADS_NEEDED = EMPF_PAGES * REC_SLOW_S; // 600
export const EMPF_THREADS_TIMEOUT = Math.round(EMPF_PAGES * REC_TIMEOUT_S); // 60

/* ===== Verstärkung verhindern: Retries (echte Sekunden) ===== */

// Störung beim Zahlungsdienst (sim.trigger): Brownout, dann Neustart — alle
// offenen Aufrufe brechen im selben Moment ab (synchronisiert die Retries)
export const PAY_BROWNOUT = 0.35; // Kapazität im Brownout (Anteil)
export const PAY_BROWNOUT_PCT = Math.round(PAY_BROWNOUT * 100); // 35
export const PAY_BROWNOUT_S = 15; // Dauer des Brownouts
export const PAY_CAP_BROWNOUT = PAY_CAP * PAY_BROWNOUT; // 24,5 req/s
// Retries: höchstens 3 Versuche je Zahlung (SRE Book: „up to three
// attempts“); Backoff exponentiell 2 s, 4 s; mit Jitter gleichverteilt in
// [0, Backoff] („full jitter“); Budget: Retries ≤ 10 % der Erstversuche
// (SRE Book), Token-Vorrat höchstens RETRY_BURST_S Sekunden Budget
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_S = 2; // Backoff vor dem 2. Versuch, dann ×2 (2 s, 4 s)
export const RETRY_BUDGET = 0.1; // Retries je Erstversuch
export const RETRY_BUDGET_PCT = Math.round(RETRY_BUDGET * 100); // 10
export const RETRY_BUDGET_AMP = 1 + RETRY_BUDGET; // höchstens ×1,1 Versuche je Zahlung
export const RETRY_BURST_S = 1; // Token-Vorrat: Budget von 1 s
export const RETRY_SLOTS = 256; // Verzögerungsleitung: 25,6 s in DT-Slots
// „Retry-Sturm“: Kopfrechnen — naiv scheitert jeder Versuch: 3 × 50 = 150
// Versuche/s gegen 70; mit Budget höchstens 50 × 1,1 = 55
export const RETRY_PAGES = RETRY_LOAD - RETRY_CHECKOUTS; // 150 Produktseiten/s
export const RETRY_STORM_LOAD = RETRY_MAX_ATTEMPTS * RETRY_CHECKOUTS; // 150
export const RETRY_BUDGET_LOAD = Math.round(
  RETRY_CHECKOUTS * (1 + RETRY_BUDGET),
); // 55

/* ===== Spitzen verteilen: Mailversand (echte Sekunden) ===== */

// Bestätigungsmail nach jeder Zahlung (Szenario `spitzen`). Synchron im
// Checkout: Der Kunde wartet auf die Mail, der Shop gibt nach MAIL_GIVEUP_S
// auf. smoothing: Bestellung sofort annehmen, Mail in einen Puffer mit
// Größen- UND Altersgrenze — was darüber liegt, geht verloren.
export const MAIL_CAP = 45; // Mails/s, Mailversand (extern, SMTP-Relay)
export const MAIL_LAT_S = 0.1; // s: Basislatenz einer Mail (synchron im Checkout)
export const MAIL_GIVEUP_S = 10; // synchron: Shop bricht den Versand ab
export const MAIL_Q_MAX = 1000; // Puffer: höchstens so viele Mails
export const MAIL_MAX_AGE_S = 20; // Puffer: keine Mail älter als 20 s
export const MAIL_Q_EFF = Math.min(MAIL_Q_MAX, MAIL_CAP * MAIL_MAX_AGE_S); // 900: hier greift das Alter
// Hinter dem Puffer sieht der Mailversand den Zufluss geglättet: als
// Nachfrage zählt das gleitende Mittel (EMA) über MAIL_SMOOTH_TAU_S —
// Lastglättung hilft genau dann, wenn dieses Mittel unter der Kapazität
// liegt (Azure: Queue-Based Load Leveling)
export const MAIL_SMOOTH_TAU_S = 60;
export const WAVE_RAMP_S = 3; // s: Flanke einer Welle (Blitzangebot)
// „Kurze Spitzen“: Kopfrechnen — Mittel, Überschuss und Rückstand je Welle
export const SPITZEN_AVG =
  SPITZEN_BASE +
  ((SPITZEN_PEAK - SPITZEN_BASE) * SPITZEN_ON_S) / SPITZEN_PERIOD_S; // 30 Checkouts/s
export const SPITZEN_LOAD = SPITZEN_PAGES + SPITZEN_BASE; // 220 req/s zwischen den Angeboten
export const SPITZEN_PEAK_LOAD = SPITZEN_PAGES + SPITZEN_PEAK; // 260 req/s im Angebot
export const MAIL_EXCESS = SPITZEN_PEAK - MAIL_CAP; // 15 Mails/s zu viel in der Spitze
export const MAIL_WAVE_BACKLOG = MAIL_EXCESS * SPITZEN_ON_S; // 450 Mails Rückstand je Welle
export const MAIL_WAVE_DELAY_S = MAIL_WAVE_BACKLOG / MAIL_CAP; // 10 s Verzögerung am Wellenende
// Eigene Frage „mails“: über eine Angebotsperiode; „verspätet“ ab
// MAIL_LATE_S Verzögerung, „verloren“ ab MAIL_LOST_SHARE der Mails
export const MAIL_TIP_WINDOW_S = SPITZEN_PERIOD_S;
export const MAIL_LATE_S = 5;
export const MAIL_LOST_SHARE = 0.05;

/* ===== Scaling (gestreckt) ===== */

export const SCALE_TARGET = 12; // Instanzen, deterministisch
export const SCALE_DETECT_S = 30; // reaktiv: Autoscaler bemerkt die Last
export const SCALE_COLD_S = 60; // reaktiv: Kaltstart (Image, JVM, Caches)
export const SCALE_WARMUP_S = 30; // reaktiv: Aufwärmen 40 → 100 %
export const SCALE_WARM_START = 0.4; // Kapazität einer frisch gestarteten Instanz
export const SCALE_WARM_START_PCT = Math.round(SCALE_WARM_START * 100); // 40
export const SCALE_PREWARM_S = 10; // vorgewärmt (Warm Pool): bis volle Kapazität
export const SCALE_REACTIVE_S = SCALE_DETECT_S + SCALE_COLD_S + SCALE_WARMUP_S; // 120

/* ===== Abgeleitete Zahlen (Kopfrechnen auf der Setup-Folie) ===== */

export const WEB_CAP_START = N_WEB_START * WEB_PER_INSTANCE; // 200 req/s zu Aktionsbeginn
export const WEB_CAP_CAUSE = N_WEB_CAUSE * WEB_PER_INSTANCE; // 300 req/s in den Ursachen
export const WEB_CAP_SCALED = SCALE_TARGET * WEB_PER_INSTANCE; // 1.200 req/s nach Scaling
// Funnel im Gleichgewicht bei 1.000 req/s: λ_C = 0,1 · Seiten, Seiten + λ_C = 1.000
export const CAMPAIGN_CHECKOUTS = Math.round(
  (LOAD_CAMPAIGN * CONV) / (1 + CONV),
); // 91
export const CAMPAIGN_PAGES = LOAD_CAMPAIGN - CAMPAIGN_CHECKOUTS; // 909
// „Teure Abfragen“: Funnel im Gleichgewicht bei 900 req/s, wenn die DB
// nicht mehr begrenzt (nach dem Cache)
export const TEUER_CHECKOUTS = Math.round((TEUER_LOAD * CONV) / (1 + CONV)); // 82
export const TEUER_PAGES = TEUER_LOAD - TEUER_CHECKOUTS; // 818
export const WEB_CAP_TEUER = N_WEB_TEUER * WEB_PER_INSTANCE; // 1.200 req/s
export const WEB_CAP_TEUER_SCALED = SCALE_TARGET_TEUER * WEB_PER_INSTANCE; // 2.000

/* ===== Nachbar-VM (gestreckt) ===== */

export const NB_STEAL_MIN = 0.25; // CPU-Phase: gestohlener Anteil der Web-CPU
export const NB_STEAL_MAX = 0.4;
export const NB_AWAIT_MIN = 1.5; // IO-Phase: Faktor auf die Disk-Wartezeit der DB
export const NB_AWAIT_MAX = 2.0;
export const NB_PHASE_MIN_S = 25;
export const NB_PHASE_MAX_S = 45;
export const NB_IDLE_MIN_S = 40;
export const NB_IDLE_MAX_S = 120;
export const NB_RAMP_TAU_S = 3; // Ein-/Ausschwingen der Wirkung
export const DB_IO_SHARE = 0.75; // Anteil IO an der DB-Bedienzeit
export const MURPHY_STRIKE_S = 35; // Murphy: Dauer eines Schlags
export const MURPHY_GAP_S = 20; // Murphy: Mindestabstand nach Schlagende
export const MURPHY_MAX_WAIT_S = 90; // Murphy: ab Schlagende spätestens dann, auch ohne Tief (sobald kein Engpass)
export const MURPHY_LOW_Z = -0.3; // Murphy: „Tief“ = Eigenrauschen < −0,3 σ
export const NB_HIT_GRACE_S = 10; // Wechsel zählt bis 10 s nach Schlagende

/* ===== Startfenster der Ursachen-Szenarien (Demo-Auswahl, pickStartSeed) ===== */

export const START_MIN_SHIFTS = 2; // Engpass-Wechsel im ersten angezeigten Fenster
export const START_MAX_TRIES = 20; // höchstens so viele Seeds ziehen

/* ===== Gast-Beobachtungen ===== */

export const DB_AWAIT_BASE_MS = 1.2; // Disk-await der DB ohne Nachbarn
export const STEAL_BASE_PCT = 0.3; // %steal-Grundrauschen
export const IOWAIT_BASE_PCT = 4;

/* ===== Zeitkonstanten (gestreckt) ===== */

export const OU_TAU_S = 30;
export const FUNNEL_TAU_S = 30;
export const RES_TAU_S = 5;
export const HYST = 0.03; // Hysterese der knappsten Station
export const RES_MAX = 3; // Reserve-Deckel (+300 %)

/* ===== Echte Sekunden ===== */

export const DEADLINE_S = 2; // Antwort danach = zu spät = verschwendete Arbeit
export const LATE_SIG_S = 0.25; // Breite des Übergangs rechtzeitig → zu spät
export const ABANDON_S = 10; // Client gibt in der Eingangs-Queue auf (504)
export const PAY_GIVEUP_S = 10; // Zahlungsdienst bricht intern ab
export const EDGE_BOUND_S = 0.5; // begrenzte Eingangs-Queue (mit Back Pressure)
export const EDGE_MIN = 5; // Mindestgröße einer begrenzten Queue [req]
export const SHED_TARGET_S = 0.2; // Load Shedding: Ziel-Wartezeit Produktseiten
export const SHED_C_TARGET_S = 0.5; // Checkout-Shedding: Ziel-Rückstau zur Kasse
export const DB_PERMIT_S = 0.1; // Back Pressure DB: Arbeit in der DB ≤ 0,1 s
export const PAY_PERMIT_S = 0.3; // Back Pressure Zahlung: ≤ 0,3 s
export const COLLAPSE_WAIT_S = 1; // Wartezeit an der Station → „kollabiert“
export const DRAIN_TAU_S = 1; // Messung der Abflussrate einer Queue
export const WEB_LAT_S = 0.02;
export const DB_LAT_S = 0.01;
export const REC_LAT_S = 0.05;
export const REC_LAT_MS = Math.round(REC_LAT_S * 1000); // 50
export const PAY_LAT_S = 0.25;

/* ===== Zufluss bremsen: Rate Limit, Admission (Szenario bots) ===== */

// Rate Limit je Client (Token Bucket, 429): Nachfüllrate und Vorrat. Ein
// Kunde liegt weit darunter, ein Scraper weit darüber.
export const RL_RATE = 10; // req/s je Client
export const RL_BURST = 20; // Token: 2 s Vorrat
// Admission Control: global, statisch — auf die Nennkapazität der DB in
// Produktseiten ausgelegt (503 für den Überschuss, alle Klassen anteilig)
export const ADMISSION_RPS = INV_PAGES_PER_S; // 300 req/s
// Load Shedding sieht ohne Back Pressure die Wartezeit der DB: ab SHED_DB_S
// anteilig, ab SHED_DB_S + SHED_DB_BAND_S alle neuen Produktseiten
export const SHED_DB_S = SHED_TARGET_S; // 0,2 s wie das Ziel am Rand
export const SHED_DB_BAND_S = 0.5;
// Erzwungener IO-Schub der Nachbar-VM (trigger("ioSchub")): so lang und so
// stark wie die längste IO-Phase des Zufalls-Zyklus
export const IO_BURST_S = NB_PHASE_MAX_S; // 45 s (gestreckt)
export const IO_BURST_AWAIT = NB_AWAIT_MAX; // Disk-await × 2
export const INV_CAP_IO_E =
  INV_CAP_E / (1 - DB_IO_SHARE + DB_IO_SHARE * IO_BURST_AWAIT); // ≈ 257 E/s
export const INV_PAGES_PER_S_IO = Math.round(INV_CAP_IO_E / INV_PAGE_E); // ≈ 171
// „Bot-Ansturm“: Kopfrechnen — Kunden und Bot an der DB
export const BOTS_PAGES = BOTS_LOAD - BOTS_CHECKOUTS; // 230 Kundenseiten/s
export const BOTS_TOTAL = BOTS_LOAD + BOT_RATE; // 750 req/s am Lastknoten
export const BOTS_CUST_E =
  BOTS_PAGES * INV_PAGE_E + BOTS_CHECKOUTS * INV_RESERVE_E; // 365 E/s
export const BOTS_DB_E = BOTS_CUST_E + BOT_RATE * INV_PAGE_E; // 1.115 E/s
export const BOT_DB_PCT = Math.round((100 * BOT_RATE * INV_PAGE_E) / BOTS_DB_E); // 67 % der DB-Arbeit
export const BOT_429 = BOT_RATE - RL_RATE; // 490/s abgewiesen (429)
// mit Rate Limit: was am Rand durchkommt, und die Auslastung der DB
export const BOTS_RL_LOAD = BOTS_LOAD + RL_RATE; // 260 req/s
export const BOTS_RL_DB_PCT = Math.round(
  (100 * (BOTS_CUST_E + RL_RATE * INV_PAGE_E)) / INV_CAP_E,
); // 84 %
export const WEB_CAP_BOTS = N_WEB_BOTS * WEB_PER_INSTANCE; // 1.200 req/s
// Eigene Frage „wen“: getroffen, wer mindestens WEN_SHARE seiner Anfragen
// abgewiesen bekommt; „seiten“: „teils“ ab TIP_PART_SHARE rechtzeitig
export const WEN_SHARE = 0.05;
export const TIP_PART_SHARE = 0.3;

export const NOISE_LEVELS = { gering: 0.5, mittel: 1, stark: 1.5 };
export const STATIONS = ["web", "inv", "pay"];
export const OVERLOAD_STATES = ["ok", "kollabiert", "abgefangen"];
/** Stationen eines Szenarios in Kettenreihenfolge — der Mailversand nur,
 * wo das Szenario ihn hat (spitzen). */
export function stationsOf(scenarioKey) {
  return SCENARIOS[scenarioKey]?.mail ? [...STATIONS, "mail"] : STATIONS;
}

/* Schalter mit implementierter Wirkung (Phase 1) und ihre Defaults. */
export const CM_DEFAULTS = {
  nb: "aus", // Nachbar-Modus: "aus" | "zufall" | "murphy"
  isolate: false, // 🏠 Eigener Host: Wirkung des Nachbarn entfällt
  noise: "mittel", // ⚙ Schwankung: "gering" | "mittel" | "stark"
  headroom: false, // Schutzkapazität an den Nicht-Engpässen: Web +20 %
  headroomAll: false, // ⚙ Schutzkapazität +20 % überall (web + inv)
  scale: false, // Webserver skalieren auf scaleTarget
  scaleMode: "reaktiv", // "reaktiv" | "vorgewaermt"
  bpInv: false, // Back Pressure DB: Concurrency-Limit + begrenzte Eingangs-Queue
  bpPay: false, // Back Pressure Zahlung
  shedBrowse: false, // Load Shedding früh, Produktseiten zuerst (Priorität)
  shedCheckout: false, // „Kasse ausgelastet — Warenkorb bleibt“
  featureShed: false, // Empfehlungen aus: Seite 0,3 E statt 1,5 E
  cache: false, // Cache + Coalescing für Empfehlungen: 1,2 E → 0,24 E je Seite
  batch: false, // Verfügbarkeitsabfragen bündeln: Overhead / k, +½ Fenster Latenz
  bulkhead: false, // getrennte Thread-Pools: Checkout 25 %, Rest 75 %
  timeouts: false, // Empfehlungen 0,3 s (degradiert), DB 0,5 s, Zahlung 2 s (504)
  breaker: false, // Circuit Breaker vor Empfehlungen und Zahlung
  retry: "aus", // Zahlungs-Retries: "aus" | "naiv" | "backoff" | "backoffJitter"
  retryBudget: false, // Retries ≤ 10 % der Erstversuche (Token Bucket)
  smoothing: false, // Mail asynchron über einen Puffer (Größe + Alter); nur mit Mailversand
  rateLimit: false, // Rate Limit je Client (Token Bucket, 429) — trifft nur den Bot
  admission: false, // Admission Control: global, statisch ADMISSION_RPS (503)
};
export const RETRY_MODES = ["aus", "naiv", "backoff", "backoffJitter"];
/* Phase 2: Schlüssel ohne Wirkung — set() lehnt sie ab, die UI rendert sie
 * nicht. Seit dem Bot-Ansturm leer; der Mechanismus bleibt für Neues. */
export const CM_PHASE2 = [];

const SQ12 = Math.sqrt(12); // noise(r, SQ12) hat Standardabweichung 1
const OU_A = Math.exp(-DT / OU_TAU_S);
const OU_B = Math.sqrt(1 - OU_A * OU_A);
const K_RES = 1 - Math.exp(-DT / RES_TAU_S);
const K_FUN = 1 - Math.exp(-DT / FUNNEL_TAU_S);
const K_NB = 1 - Math.exp(-DT / NB_RAMP_TAU_S);
const K_DRAIN = 1 - Math.exp(-DT / DRAIN_TAU_S);
const K_BR = 1 - Math.exp(-DT / BREAKER_TAU_S);
const K_MAIL = 1 - Math.exp(-DT / MAIL_SMOOTH_TAU_S);
const K_MAIL_AGE = 1 - Math.exp(-DT / MAIL_MAX_AGE_S);

const sig = (x) => 1 / (1 + Math.exp(-x));
const uni = (r, a, b) => a + (b - a) * r();
const reserveOf = (cap, d) =>
  d > 1e-9 ? Math.min(RES_MAX, cap / d - 1) : RES_MAX;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const softplus = (z) =>
  z > 30 ? z : z < -30 ? Math.exp(z) : Math.log1p(Math.exp(z));
/** Anteil von x Aufrufen, die hinter einer Queue q (FIFO, Kapazität mu)
 * ihren Timeout tc reißen: Mittel von sig((Wartezeit + PAY_LAT_S − tc) /
 * LATE_SIG_S) über den Stapel — der i-te wartet (q + i) / mu. Für x → 0
 * der Wert des ersten. */
export function fifoFailShare(q, x, mu, tc) {
  const a0 = (q / mu + PAY_LAT_S - tc) / LATE_SIG_S;
  if (!(x > 1e-6)) return sig(a0);
  const b = 1 / (mu * LATE_SIG_S);
  const a1 = a0 + b * x;
  return Math.min(1, Math.max(0, (softplus(a1) - softplus(a0)) / (b * x)));
}

/* Anteil der Aufrufe, den ein Circuit Breaker durchlässt. */
const admitOf = (b) =>
  b.state === "open" ? 0 : b.state === "half" ? HALF_ADMIT : 1;

/* Last eines Szenarios zur Zeit t: Stufen, weich über LOAD_RAMP_S (bzw.
 * `ramp`, etwa die Antwortzeit des Empfehlungsdienstes über REC_RAMP_S). */
export function loadAt(sched, t, ramp = LOAD_RAMP_S) {
  let L = sched[0][1];
  for (let i = 1; i < sched.length; i++) {
    const [ti, Li] = sched[i];
    L += (Li - sched[i - 1][1]) * smooth((t - ti) / ramp);
  }
  return L;
}

/** Form der Wellen (Blitzangebote, Szenario spitzen) zur Zeit t, 0 … 1: ab
 * w.t0 je Periode w.on s oben, Flanken weich über WAVE_RAMP_S; nach
 * „dauerlast“ (dauerAt) dauerhaft oben. Checkouts/s = base + (peak − base) ·
 * Form.
 * @param {{ t0: number, period: number, on: number }} w
 * @param {number} t
 * @param {number | null} [dauerAt]
 * @returns {number}
 */
export function waveShape(w, t, dauerAt = null) {
  let x = 0;
  if (t >= w.t0 - 1e-9) {
    const ph = (t - w.t0) % w.period;
    x = smooth(ph / WAVE_RAMP_S) * (1 - smooth((ph - w.on) / WAVE_RAMP_S));
  }
  if (dauerAt !== null && t >= dauerAt - 1e-9)
    x = Math.max(x, smooth((t - dauerAt) / WAVE_RAMP_S));
  return x;
}

function zeroCum() {
  return {
    engpass: 0, // s mit Engpass
    overWeb: 0, // s mit Überlast je Station
    overInv: 0,
    overPay: 0,
    knappWeb: 0, // s als knappste Station
    knappInv: 0,
    knappPay: 0,
    shifts: 0, // Engpass-Wechsel
    knappShifts: 0, // Wechsel der knappsten Station
    shiftsInStrike: 0, // davon während/kurz nach einem Nachbar-Schub
    strikes: 0,
    strikeHits: 0,
    murphyFallbacks: 0, // Murphy-Schläge ohne Tief, nach MURPHY_MAX_WAIT_S
    load: 0, // req (Summen; Differenz / Dauer = req/s)
    okB: 0,
    okC: 0,
    shed: 0,
    r503: 0,
    r429: 0,
    lost: 0,
    abandoned: 0,
    waste: 0,
    ...zeroClass(),
    demWeb: 0, // req Nachfrage je Station (∫ Nachfrage dt)
    demInv: 0,
    demPay: 0,
    thrWeb: 0, // req Durchsatz je Station (gestartet, DB fertig, Zahlung fertig)
    thrInv: 0,
    thrPay: 0,
    utilWeb: 0, // ∫ Auslastung dt
    utilInv: 0,
    utilPay: 0,
    latB: 0, // ∫ geschätzte Latenz je Klasse dt [s·s]
    latC: 0,
    arrB: 0, // req Ankünfte je Klasse (Nachfrage am Eingang)
    arrC: 0,
    startB: 0, // req gestartete Produktseiten
    degB: 0, // req rechtzeitige Produktseiten OHNE Empfehlungen (Timeout, Breaker)
    noRecB: 0, // dito, dazu Feature Shedding (was der Kunde sieht)
    recWaitB: 0, // ∫ gestartete Seiten × Wartezeit auf die Empfehlungen [req·s]
    tripsRec: 0, // Breaker öffnet (Empfehlungen, Zahlung)
    tripsPay: 0,
    tryP: 0, // req Versuche am Zahlungsdienst (Erstversuche + Retries)
    firstP: 0, // req davon Erstversuche
    retryP: 0, // req davon Retries
    wasteP: 0, // req vom Anbieter bearbeitet, auf die niemand mehr wartet
    deniedP: 0, // req Retries, die das Budget verweigert hat
    brownout: 0, // s im Brownout des Zahlungsdienstes
    // Mailversand (Szenario spitzen); sonst 0
    overMail: 0, // s mit Überlast
    knappMail: 0, // s als knappste Station
    mailIn: 0, // Mails in den Versand (je bediente Zahlung eine)
    mailSent: 0, // Mails verschickt
    mailLost: 0, // Mails verloren (Abbruch bzw. Puffer voll oder zu alt)
    demMail: 0, // ∫ Nachfrage dt (asynchron: geglättet)
    utilMail: 0, // ∫ Auslastung dt
    // Bot (Szenario bots, Teil der Klasse B); sonst 0
    arrBot: 0, // req Ankünfte (vor dem Rate Limit)
    okBot: 0, // req rechtzeitig
    rejBot: 0, // req früh abgewiesen (429, Admission, Shedding, Tail-Drop)
    lostBot: 0, // req verloren (aufgegeben, zu spät, 504)
    adm: 0, // req von Admission Control abgewiesen (alle Klassen, in r503)
    io: 0, // s im erzwungenen IO-Schub der Nachbar-VM
  };
}

/* Zähler je Klasse: B = Produktseite, C = Checkout. */
function zeroClass() {
  return {
    shedB: 0, // früh abgewiesen (Load Shedding)
    shedC: 0,
    r503B: 0, // Tail-Drop der begrenzten Eingangs-Queue
    r503C: 0,
    r429B: 0, // Rate Limit je Client (429): nur der Bot
    r429C: 0,
    r504B: 0, // Timeout der DB: scheitert sofort (verloren)
    r504C: 0,
    abandonedB: 0, // in der Eingangs-Queue aufgegeben
    abandonedC: 0,
    wasteB: 0, // zu spät beantwortet = verschwendete Arbeit
    wasteC: 0,
    failC: 0, // Zahlung endgültig gescheitert (alle Versuche, Budget) — verloren
    lostB: 0, // verloren = aufgegeben + zu spät + Timeout (504) + gescheitert
    lostC: 0,
  };
}

/* Klassenzähler eines Schritts (f) auf Akkumulator bzw. Summen addieren. */
function addClass(o, f) {
  o.shedB += f.shedB;
  o.shedC += f.shedC;
  o.r503B += f.r503B;
  o.r503C += f.r503C;
  o.r429B += f.r429B;
  o.r429C += f.r429C;
  o.r504B += f.r504B;
  o.r504C += f.r504C;
  o.abandonedB += f.abandonedB;
  o.abandonedC += f.abandonedC;
  o.wasteB += f.lateB;
  o.wasteC += f.lateC;
  o.failC += f.failC;
  o.lostB += f.abandonedB + f.lateB + f.r504B;
  o.lostC += f.abandonedC + f.lateC + f.r504C + f.failC;
}

export class BottleneckSim {
  /**
   * @param seed        PRNG-Seed (Default: zufällig)
   * @param scenarioKey Schlüssel aus SCENARIOS
   * @param overrides   { cm?, load?, nWeb?, scaleTarget?, sigma?, conv?, cFix?,
   *                      funnel?, threadsPerInstance?, recLat?, retryLayer? }
   *                    — z. B. { scaleTarget: 20 } für den 12-vs-20-Vergleich;
   *                    funnel: false ⇒ fester Checkout-Mix statt Funnel
   */
  constructor(seed = randomSeed(), scenarioKey = "nachbar", overrides = {}) {
    const def = SCENARIOS[scenarioKey];
    if (!def) throw new Error(`unbekanntes Szenario: ${scenarioKey}`);
    this.seed = seed;
    this.scenario = scenarioKey;
    this.variant = def.variant;
    this.overrides = overrides;
    this.p = {
      load: overrides.load ?? def.load,
      nWeb: overrides.nWeb ?? def.nWeb,
      scaleTarget: overrides.scaleTarget ?? def.scaleTarget ?? SCALE_TARGET,
      conv: overrides.conv ?? def.conv ?? CONV,
      cFix: overrides.cFix ?? def.cFix ?? 0,
      funnel: overrides.funnel ?? def.funnel ?? true,
      sigma: { ...def.sigma, ...(overrides.sigma ?? {}) },
      windowS: def.windowS,
      threadsPer:
        overrides.threadsPerInstance ??
        def.threadsPerInstance ??
        THREADS_PER_INSTANCE,
      // Antwortzeit des Empfehlungsdienstes: REC_LAT_S, dann Profil
      recLat: [[0, REC_LAT_S], ...(overrides.recLat ?? def.recLat ?? [])],
      // Zahlung als Versuche (Retries), auch bei Retry-Modus „aus“
      retryLayer: overrides.retryLayer ?? def.retryLayer ?? false,
      // Checkouts in Wellen (Blitzangebote) und Mailversand (spitzen)
      waves: overrides.waves ?? def.waves ?? null,
      mail: overrides.mail ?? def.mail ?? false,
      // dritte Verkehrsklasse: Scraper-Bot, ein Client (bots)
      bot: overrides.bot ?? def.bot ?? null,
    };
    this.cm = { ...CM_DEFAULTS };
    this._checkPatch(def.cm);
    Object.assign(this.cm, def.cm);
    if (overrides.cm) {
      this._checkPatch(overrides.cm);
      Object.assign(this.cm, overrides.cm);
    }
    this.log = [];
    this.n = 0;

    // Drei getrennte Ströme (feste Zahl von Ziehungen je Schritt)
    this.rCap = mulberry32(seed);
    this.rArr = mulberry32(seed ^ 0x5bd1e995);
    this.rNb = mulberry32((seed + 0x9e3779b9) | 0);
    this.zW = noise(this.rCap, SQ12);
    this.zI = noise(this.rCap, SQ12);
    this.zP = noise(this.rCap, SQ12);
    this.zA = noise(this.rArr, SQ12);
    // Mailversand: eigener Strom, nur wo es ihn gibt — die drei Ströme oben
    // bleiben in allen Szenarien gleich
    this.rMail = this.p.mail ? mulberry32(seed ^ 0x2545f491) : null;
    this.zM = this.rMail ? noise(this.rMail, SQ12) : 0;

    // Nachbar: Zufalls-Zyklus läuft immer mit; Murphy ohne RNG
    this.nbPhase = "idle";
    this.nbEnd = uni(this.rNb, NB_IDLE_MIN_S, NB_IDLE_MAX_S) / 2;
    this.nbSteal = 0;
    this.nbAwait = 1;
    this.mPhase = "idle";
    this.mEnd = 0;
    this.mLastEnd = -MURPHY_GAP_S;
    this.mTarget = null;
    this.steal = 0;
    this.awaitM = 1;
    this.phaseNow = "idle";
    this.strikeLog = [];
    this.curStrike = null;

    // Scaling
    this.scaleOnAt = this.cm.scale ? 0 : null;

    // Fluid-Zustand (Requests bzw. E)
    const L0 = loadAt(this.p.load, 0);
    this.pagesEma = Math.max(0, (L0 - this.p.cFix) / (1 + this.p.conv));
    const lamC0 = Math.min(L0, this.p.cFix + this.p.conv * this.pagesEma);
    this.eb = 0; // Eingangs-Queue Produktseiten
    this.ec = 0; // Eingangs-Queue Checkouts
    this.drB = L0 - lamC0; // gemessene Abflussrate (EMA)
    this.drC = lamC0;
    this.dbEB = 0; // Arbeit in der DB [E] je Klasse
    this.dbEC = 0;
    this.dbNB = 0; // Requests in der DB je Klasse
    this.dbNC = 0;
    this.pq = 0; // Checkouts beim Zahlungsdienst
    this.arrP = 0; // Ankunftsrate am Zahlungsdienst im letzten Schritt [req/s]
    this.webOnCpu = 0; // Requests auf der Web-CPU (halten je einen Thread)
    this.edgeBounded = this.cm.bpInv || this.cm.bpPay;
    this.ebMax = null;
    this.ecMax = null;
    this.permLimited = { inv: false, pay: false };
    this.latB = 0;
    this.latC = 0;
    // Empfehlungen und Threads (Überlast isolieren, Verstärkung verhindern)
    this.recN = 0; // Seiten, die über die Basislatenz hinaus auf die Empfehlungen warten (je ein Thread)
    this.recLat = REC_LAT_S; // s: Antwortzeit des Empfehlungsdienstes jetzt
    this.recWait = REC_LAT_S; // s: was eine aufrufende Seite wartet (Timeout)
    this.recHoldX = 0; // s: Zusatz-Haltezeit eines Threads je aufrufender Seite
    this.recCall = 1; // Anteil der Seiten, die die Empfehlungen aufrufen
    this.recAdmit = 1; // vom Breaker durchgelassener Anteil der Aufrufe
    this.recFail = 0; // Fehleranteil der Aufrufe (Timeout) in diesem Schritt
    this.recDeg = 0; // Anteil der Seiten ohne Empfehlungen (Timeout, Breaker)
    this.recAvgWait = REC_LAT_S; // s: mittlere Wartezeit je Seite auf Empfehlungen
    this.payAdmit = 1; // vom Breaker durchgelassener Anteil der Checkouts
    this.payFail = 0; // Fehleranteil am Zahlungsdienst (Abbruch) im letzten Schritt
    this.brRec = { state: "closed", err: 0, t: 0 };
    this.brPay = { state: "closed", err: 0, t: 0 };
    // Zahlung mit Versuchen (Retries als Verzögerungsleitung, siehe _payLayer)
    this.retryLayer = this.p.retryLayer || this.cm.retry !== "aus";
    this.pqOk = [0, 0, 0]; // beim Anbieter, wird rechtzeitig fertig — je Versuch 1…3
    this.pqOrph = 0; // beim Anbieter, aber der Client wartet nicht mehr (verschwendet)
    this.rFq = new Float64Array(RETRY_SLOTS * 3); // Timeouts, die der Client im Slot erkennt, je Versuch
    this.rRq = new Float64Array(RETRY_SLOTS * 3); // Retries, fällig im Slot, je Versuch (2., 3.)
    // Zeit seit dem Start des Checkouts, als Summe Menge × s (Mittel =
    // Summe / Menge): beim Anbieter (altert je Schritt), beim Erkennen des
    // Timeouts bzw. beim Senden des Retrys — die Frist DEADLINE_S gilt für
    // den ganzen Checkout, nicht je Versuch
    this.pqOkE = [0, 0, 0];
    this.pqOkL = [0, 0, 0]; // davon gelingen, aber nach der Frist (zu spät)
    this.rFqE = new Float64Array(RETRY_SLOTS * 3);
    this.rRqE = new Float64Array(RETRY_SLOTS * 3);
    this.dbPreC = 0; // s: Zeit bis zum Aufruf der Zahlung, Mittel der Checkouts in der DB
    this.payOutcomes = 0; // req/s Ausgänge, die der Client im letzten Schritt kannte (Breaker)
    this.payFailEma = 0; // Fehleranteil dieser Ausgänge, EMA über BREAKER_TAU_S (Überlastzustand)
    this.fqSum = 0; // Σ rFq: Aufrufe, auf die der Client noch wartet (scheitern)
    this.rqSum = 0; // Σ rRq: Checkouts im Backoff
    this.payHeld = 0; // Checkouts in der Zahlung beim Shop (je ein Thread)
    this.retryTokens = 0; // Retry-Budget (Token Bucket)
    this.payF = 1; // Kapazitätsfaktor des Zahlungsdienstes (Brownout)
    this.incidents = []; // Störungen: { t0, t1, reset } (Brownout bis t1, dann Neustart)
    this.payTC = PAY_GIVEUP_S; // s: Timeout eines Versuchs beim Client
    this.payPF = 0; // Anteil der jetzt gesendeten Versuche, die scheitern (Timeout)
    this.paySent = 0; // req/s Versuche am Zahlungsdienst im letzten Schritt
    this.payInflight = 0; // Aufrufe, auf deren Ergebnis der Client wartet
    this.firstEma = 0; // req/s Erstversuche (Deckel des Token-Vorrats)
    this._pendOk = 0; // beim Umschalten der Zahlungs-Ebene gutgeschrieben
    this._pendLate = 0;
    this._pendFail = 0;
    this.thrCapB = Infinity; // Produktseiten/s, die die Threads tragen
    this.webCapEff = 0; // req/s: min(CPU, Threads) beim aktuellen Mix
    // Wellen und Mailversand (Szenario spitzen)
    this.waveX = 0; // Form der Welle jetzt, 0 … 1
    this.dauerAt = null; // Sim-s: ab hier Dauerlast (trigger)
    this.mq = 0; // Mails im Versand (synchron) bzw. im Puffer (asynchron)
    this.mqBg = 0; // Rest des Puffers nach dem Abschalten: niemand wartet darauf
    this.mqBgExp = 0; // Mails/s davon, die zu alt werden
    this.mailAsync = !!this.cm.smoothing; // Puffer im letzten Schritt an
    this.mailCap = MAIL_CAP; // Mails/s jetzt
    this.mailRate = MAIL_CAP; // Mails/s, geglättet über MAIL_MAX_AGE_S (Alter der Queue)
    this.arrM = 0; // Mails/s, die im letzten Schritt ankamen
    this.dMi = 0; // Nachfrage am Mailversand jetzt (ungeglättet)
    this.mailDemEma = this.p.cFix; // geglätteter Zufluss (Puffer)
    this.dM = 0; // Nachfrage am Mailversand (asynchron: geglättet)
    this.resM = RES_MAX;
    // Bot und Zufluss bremsen (Szenario bots)
    this.aBot = 0; // req/s Bot-Anfragen jetzt (in aB enthalten)
    this.dBot = 0; // req/s Bot-Seiten an der DB (Nachfrage, in dIR enthalten)
    this.ebBot = 0; // Bot-Anteil der Eingangs-Queue der Produktseiten
    this.rlTokens = RL_BURST; // Token Bucket des Rate Limits (der Bot)
    this.ioBursts = []; // erzwungene IO-Schübe: { t0, t1 }
    this.ioNow = false; // gerade ein erzwungener IO-Schub
    this.f = {
      sB: 0,
      sC: 0,
      okB: 0,
      okC: 0,
      shed: 0,
      r503: 0,
      abandoned: 0,
      late: 0,
      shedB: 0, // je Klasse: req in diesem Schritt
      shedC: 0,
      r503B: 0,
      r503C: 0,
      abandonedB: 0,
      abandonedC: 0,
      lateB: 0,
      lateC: 0,
      r504B: 0, // Timeout der DB (verloren)
      r504C: 0,
      degB: 0, // rechtzeitige Seiten ohne Empfehlungen
      failC: 0, // Zahlung endgültig gescheitert (alle Versuche, Budget)
      tryP: 0, // Versuche am Zahlungsdienst (Erst- und Wiederholungsversuche)
      firstP: 0, // davon Erstversuche
      retryP: 0, // davon Wiederholungen
      wasteP: 0, // vom Anbieter bearbeitet, aber niemand wartet mehr
      deniedP: 0, // Retries, die das Budget verweigert
      doneI: 0, // req, die die DB in diesem Schritt fertig bearbeitet hat
      doneP: 0, // req, die der Zahlungsdienst fertig bearbeitet hat
      utilW: 0,
      utilI: 0,
      utilP: 0,
      utilM: 0, // Mailversand
      mailIn: 0, // Mails in diesem Schritt: angekommen, verschickt, verloren
      mailSent: 0,
      mailLost: 0,
      r429B: 0, // Rate Limit je Client (nur der Bot)
      r429C: 0,
      arrBot: 0, // Bot: Ankünfte, rechtzeitig, abgewiesen, verloren
      okBot: 0,
      rejBot: 0,
      lostBot: 0,
      adm: 0, // Admission Control (alle Klassen, in r503B/r503C)
    };
    this._carry = 0;

    // Engpass-Auswertung
    this.resW = 0;
    this.resI = 0;
    this.resP = 0;
    this.knapp = "web";
    this.bottleneck = null;
    this.lastOver = null;
    this.ov = { web: "ok", inv: "ok", pay: "ok" };
    if (this.p.mail) this.ov.mail = "ok";
    this.shiftLog = [];
    this._resInit = false;

    // Kumulierte Zähler + Ringpuffer
    this.c = zeroCum();
    this.hist = new Array(HIST_MAX);
    this.hHead = 0;
    this.hCount = 0;
    this._acc = this._zeroAcc();
    this._marks = [];

    // Momentwerte, gesetzt in _compute() — hier deklariert, damit TS-Verbraucher
    // (Komponente, Tests) sie als number sehen statt als number | undefined
    this.nRun = this.p.nWeb;
    this.nStarting = 0;
    this.warm = 1;
    this.webNom = 0;
    this.webCap = 0;
    this.invNomE = 0;
    this.invCapE = 0;
    this.payCap = 0;
    this.threads = 0;
    this.cB = INV_PAGE_E;
    this.cC = INV_RESERVE_E;
    this.recoE = INV_RECO_E; // E je Seite für Empfehlungen (0 bei featureShed)
    this.batchK = 1; // Verfügbarkeitsabfragen je Bündel (1 = ungebündelt)
    this.Lnom = 0;
    this.L = 0;
    this.aB = 0;
    this.aC = 0;
    this.dW = 0;
    this.dIE = 0;
    this.dIR = 0;
    this.dP = 0;
    this.dRec = 0; // req/s Produktseiten, die die Empfehlungen aufrufen
    this.lastSample = null;

    this._compute(0); // Momentaufnahme t = 0 (ohne Fluss)
    this._pushSample();
  }

  /* ---------- Steuerung ---------- */

  get t() {
    return this.n / STEPS_PER_S;
  }

  /** Stationen dieses Laufs in Kettenreihenfolge (mit Mailversand: vier). */
  get stations() {
    return this.p.mail ? [...STATIONS, "mail"] : STATIONS;
  }

  _checkPatch(patch) {
    for (const k of Object.keys(patch)) {
      if (!(k in CM_DEFAULTS)) {
        const why = CM_PHASE2.includes(k)
          ? " (Phase 2, noch ohne Wirkung)"
          : "";
        throw new Error(`unbekannter Schalter: ${k}${why}`);
      }
      if (k === "retry" && !RETRY_MODES.includes(patch[k]))
        throw new Error(`unbekannter Retry-Modus: ${patch[k]}`);
    }
  }

  /** Schalter live setzen; wird geloggt (replay). Zieht keine Zufallszahlen. */
  set(patch) {
    this._checkPatch(patch);
    this.log.push({ n: this.n, patch: { ...patch } });
    const wasScale = this.cm.scale;
    const wasNb = this.cm.nb;
    Object.assign(this.cm, patch);
    const t = this.t;
    // Eigener Host mitten im Schub: dieser Schub wirkt ab jetzt nicht mehr —
    // und wieder, sobald der Schalter zurückgeht (Wechsel zählen dann wieder
    // als „im Schub“)
    if (this.curStrike) this.curStrike.affects = !this.cm.isolate;
    if (this.cm.scale && !wasScale) this.scaleOnAt = t;
    if (!this.cm.scale) this.scaleOnAt = null;
    if (this.cm.nb !== wasNb) {
      if (wasNb === "murphy" || wasNb === "zufall") this._strikeEnd(t);
      if (this.cm.nb === "murphy") {
        this.mPhase = "idle";
        this.mLastEnd = t - MURPHY_GAP_S;
      }
      if (this.cm.nb === "zufall" && this.nbPhase !== "idle") {
        this._strikeStart(
          t,
          this.nbPhase === "cpu" ? "web" : "inv",
          this.nbEnd,
        );
      }
    }
    for (const k of Object.keys(patch)) this._marks.push(k);
  }

  /**
   * Ereignis auslösen, wird geloggt (replay). Zieht keine Zufallszahlen.
   * "stoerung": Störung beim Zahlungsdienst ab Sim-Zeit `at` (Default:
   * jetzt, nie früher) — Brownout auf PAY_BROWNOUT der Kapazität für
   * PAY_BROWNOUT_S, dann Neustart: Alle offenen Aufrufe brechen im selben
   * Moment ab.
   * "dauerlast" (nur mit Wellen, Szenario spitzen): Die Welle endet ab
   * `at` nicht mehr — Checkouts dauerhaft auf `peak`.
   * "ioSchub" (Szenario bots): Die Nachbar-VM schreibt ab `at` IO_BURST_S
   * lang auf das Storage der DB — Disk-await × IO_BURST_AWAIT, wie eine
   * IO-Phase des Zufalls-Zyklus. Überlappende Schübe verlängern sich.
   */
  trigger(event, at = this.t) {
    if (event !== "stoerung" && event !== "dauerlast" && event !== "ioSchub")
      throw new Error(`unbekanntes Ereignis: ${event}`);
    if (event === "dauerlast" && !this.p.waves)
      throw new Error("Dauerlast nur mit Wellen (Szenario spitzen)");
    const t0 = Math.max(at, this.t);
    this.log.push({ n: this.n, event, at: t0 });
    if (event === "dauerlast") {
      // Die Welle endet nicht mehr — die früheste Dauerlast gilt
      this.dauerAt = this.dauerAt === null ? t0 : Math.min(this.dauerAt, t0);
      return;
    }
    if (event === "ioSchub") {
      this.ioBursts.push({ t0, t1: t0 + IO_BURST_S });
      if (this.ioBursts.length > 50) this.ioBursts.shift();
      return;
    }
    this.incidents.push({ t0, t1: t0 + PAY_BROWNOUT_S, reset: false });
    if (this.incidents.length > 50) this.incidents.shift();
  }

  /** Sim-Zeit dtSim [s] vorrücken; Rest unter DT wird mitgenommen. */
  advance(dtSim) {
    this._carry += dtSim * STEPS_PER_S;
    const k = Math.floor(this._carry + 1e-9);
    this._carry -= k;
    for (let i = 0; i < k; i++) this._step();
  }

  /** Bis Sim-Zeit t [s] rechnen (auf DT gerundet). */
  runTo(t) {
    const target = Math.round(t * STEPS_PER_S);
    while (this.n < target) this._step();
  }

  runSteps(k) {
    for (let i = 0; i < k; i++) this._step();
  }

  /* ---------- Nachbar ---------- */

  _strikeStart(t, target, t1, fallback = false) {
    this._strikeEnd(t);
    const s = {
      t0: t,
      t1,
      target,
      affects: !this.cm.isolate,
      hit: false,
      fallback, // Murphy: ohne Tief, nach MURPHY_MAX_WAIT_S
    };
    this.curStrike = s;
    this.strikeLog.push(s);
    if (this.strikeLog.length > 500) this.strikeLog.shift();
    this.c.strikes++;
  }

  _strikeEnd(t) {
    if (this.curStrike) {
      this.curStrike.t1 = Math.min(this.curStrike.t1, t);
      this.curStrike = null;
    }
  }

  /* Zufalls-Zyklus idle → CPU → IO → idle. Läuft in JEDEM Modus weiter und
   * zieht genau zwei Zahlen je Übergang — Schalter ändern die Umwelt nicht. */
  _nbSchedule(t) {
    if (t < this.nbEnd) return;
    const r = this.rNb;
    const live = this.cm.nb === "zufall";
    if (this.nbPhase === "idle") {
      this.nbPhase = "cpu";
      this.nbEnd = t + uni(r, NB_PHASE_MIN_S, NB_PHASE_MAX_S);
      this.nbSteal = uni(r, NB_STEAL_MIN, NB_STEAL_MAX);
      if (live) this._strikeStart(t, "web", this.nbEnd);
    } else if (this.nbPhase === "cpu") {
      this.nbPhase = "io";
      this.nbEnd = t + uni(r, NB_PHASE_MIN_S, NB_PHASE_MAX_S);
      this.nbAwait = uni(r, NB_AWAIT_MIN, NB_AWAIT_MAX);
      if (live) this._strikeStart(t, "inv", this.nbEnd);
    } else {
      this.nbPhase = "idle";
      this.nbEnd = t + uni(r, NB_IDLE_MIN_S, NB_IDLE_MAX_S);
      r();
      if (live) this._strikeEnd(t);
    }
  }

  /* Murphy (nur Demo, ohne RNG): schlägt zu, sobald sich die letzte Engpass-
   * Station erholt hat UND das Eigenrauschen der ANDEREN Station (web ↔ inv)
   * im Tief ist — und trifft genau diese andere Station. Fallback (gezählt):
   * nach MURPHY_MAX_WAIT_S auch ohne Tief. */
  _murphy(t) {
    if (this.mPhase !== "idle") {
      if (t >= this.mEnd) {
        this.mPhase = "idle";
        this.mLastEnd = t;
        this._strikeEnd(t);
      }
      return;
    }
    if (t - this.mLastEnd < MURPHY_GAP_S || this.bottleneck !== null) return;
    const last = this.lastOver;
    const target =
      last === "web"
        ? "inv"
        : last === "inv"
          ? "web"
          : this.resW >= this.resI
            ? "web"
            : "inv";
    const z = target === "web" ? this.zW : this.zI;
    const low = z <= MURPHY_LOW_Z;
    if (!low && t - this.mLastEnd < MURPHY_MAX_WAIT_S) return;
    this.mPhase = target === "web" ? "cpu" : "io";
    this.mTarget = target;
    this.mEnd = t + MURPHY_STRIKE_S;
    this._strikeStart(t, target, this.mEnd, !low);
    if (!low) this.c.murphyFallbacks++;
  }

  /* ---------- Circuit Breaker ---------- */

  /* Ein Schritt eines Breakers (b = brRec bzw. brPay): closed → open, wenn
   * der Fehleranteil der Aufrufe (EMA über BREAKER_TAU_S) BREAKER_TRIP
   * übersteigt; nach BREAKER_OPEN_S half-open mit HALF_ADMIT Proben — eine
   * gescheiterte Probe (bekannt nach probeS) öffnet wieder, sonst schließt
   * er nach BREAKER_CLOSE_S, frühestens aber, wenn die Ergebnisse der
   * ersten Proben da sind (probeS) — mit closeNeedsCalls nur in einem
   * Schritt, der Ausgänge kennt (ohne Ausgang kein Beleg). Abgeschaltet:
   * geschlossen, ohne Gedächtnis. Zieht keine Zufallszahlen. */
  _breakerStep(
    b,
    on,
    fail,
    calls,
    probeS,
    t,
    tripKey,
    closeNeedsCalls = false,
  ) {
    if (!on) {
      b.state = "closed";
      b.err = 0;
      b.t = t;
      return;
    }
    if (b.state === "closed") {
      if (calls) b.err += (fail - b.err) * K_BR;
      if (b.err > BREAKER_TRIP) {
        b.state = "open";
        b.t = t;
        this.c[tripKey]++;
      }
    } else if (b.state === "open") {
      if (t - b.t >= BREAKER_OPEN_S - 1e-9) {
        b.state = "half";
        b.t = t;
      }
    } else if (calls && fail > BREAKER_TRIP && t - b.t >= probeS - 1e-9) {
      b.state = "open";
      b.t = t;
      this.c[tripKey]++;
    } else if (
      !(fail > BREAKER_TRIP) &&
      (calls || !closeNeedsCalls) &&
      t - b.t >= Math.max(BREAKER_CLOSE_S, probeS) - 1e-9
    ) {
      b.state = "closed";
      b.err = 0;
    }
  }

  /* ---------- Zahlung mit Versuchen (Retries) ---------- */

  /**
   * Ein Schritt am Zahlungsdienst mit Versuchen — Szenario `retry`, sonst
   * nur, solange cm.retry nicht „aus“ ist. first = Checkouts, die jetzt ihre
   * Reservierung fertig haben (Erstversuche); preFirst = ihre Zeit seit dem
   * Start [s] (geschätzt beim Start, Mittel über die DB); postS = was der
   * Kunde nach der Zahlung noch wartet (synchrone Mail). Zieht keine
   * Zufallszahlen.
   *
   * Ausgang eines Versuchs, entschieden beim Senden (FIFO-Schätzung, wie die
   * Latenz beim Start): Wartezeit w = Queue / Kapazität; der Versuch
   * scheitert mit sig((w + PAY_LAT_S − Timeout) / LATE_SIG_S). Was
   * rechtzeitig fertig wird, bedient der Anbieter zuerst — Erfolg beim
   * Abschluss. Für den Kunden zählt aber die Frist DEADLINE_S über den
   * ganzen Checkout wie im Pfad ohne Versuche: Zeit bis zur Zahlung,
   * frühere Versuche und Pausen, Wartezeit beim Anbieter, PAY_LAT_S und
   * postS — beim Senden geschätzt wie ein engerer Timeout. Was danach
   * gelingt, ist „zu spät“ (verloren, verschwendet); mit Timeouts ist das
   * fast jeder Retry. Was scheitert, bearbeitet der
   * Anbieter trotzdem (verschwendete Arbeit, bis zu PAY_GIVEUP_S), und der
   * Client erkennt den Timeout nach payTC. Dann plant er den nächsten
   * Versuch in die Verzögerungsleitung (rRq): naiv sofort (nächster
   * Schritt), Backoff nach RETRY_BASE_S · 2^(k−1), mit Jitter
   * gleichverteilt über (0, Backoff] — als Mittelwert verteilt, ohne
   * Zufallszahlen. Nach RETRY_MAX_ATTEMPTS Versuchen (ohne Retries: nach
   * einem) ist die Zahlung gescheitert. Budget: Token Bucket mit
   * RETRY_BUDGET Token je Erstversuch, Vorrat höchstens RETRY_BURST_S
   * Sekunden; ohne Token entfällt der Retry (gescheitert). Breaker offen:
   * Retries entfallen sofort (gescheitert — der Kunde hat schon einen
   * Timeout gewartet); Erstversuche hält er schon am Rand auf (_flow, 503).
   * Den Breaker füttern nur Ausgänge, die der Client kennt: erkannte
   * Timeouts gegen gelungene Zahlungen (payFail, payOutcomes).
   * Neustart (reset, Ende einer Störung): Alle offenen Aufrufe scheitern im
   * selben Moment — das synchronisiert die Retries; der Anbieter beginnt
   * mit leerer Queue.
   *
   * @returns {{ ok: number, late: number, fail: number, sent: number,
   *   first: number, retries: number, waste: number, denied: number,
   *   served: number }} Mengen dieses Schritts [req]
   */
  _payLayer(first, reset, preFirst, postS) {
    const cm = this.cm;
    const S = RETRY_SLOTS;
    const slot = this.n % S;
    const fq = this.rFq;
    const rq = this.rRq;
    const ok3 = this.pqOk;
    const okL = this.pqOkL;
    const fqE = this.rFqE;
    const rqE = this.rRqE;
    const okE = this.pqOkE;
    const mode = cm.retry;
    const maxK = mode === "aus" ? 1 : RETRY_MAX_ATTEMPTS;
    const payCap = this.payCap;
    let fail = 0;
    // 1) Timeouts, die der Client jetzt erkennt — mit ihrer Zeit seit dem
    // Start (gespeichert für den geplanten Zeitpunkt des Erkennens)
    const i0 = slot * 3;
    const det = [fq[i0], fq[i0 + 1], fq[i0 + 2]];
    const detE = [fqE[i0], fqE[i0 + 1], fqE[i0 + 2]];
    this.fqSum -= det[0] + det[1] + det[2];
    for (let k = 0; k < 3; k++) {
      fq[i0 + k] = 0;
      fqE[i0 + k] = 0;
    }
    if (reset) {
      // Neustart: Alle offenen Aufrufe scheitern JETZT — so viel früher als
      // geplant, wie ihr Slot noch entfernt war
      for (let s = 0; s < S; s++) {
        const early = ((s - slot + S) % S) * DT;
        for (let k = 0; k < 3; k++) {
          const i = s * 3 + k;
          const x = fq[i];
          if (x > 0) {
            det[k] += x;
            detE[k] += fqE[i] - x * early;
          }
          fq[i] = 0;
          fqE[i] = 0;
        }
      }
      this.fqSum = 0;
      for (let k = 0; k < 3; k++) {
        det[k] += ok3[k];
        detE[k] += okE[k];
        ok3[k] = 0;
        okL[k] = 0;
        okE[k] = 0;
      }
      this.pqOrph = 0;
      this.pq = 0; // der Anbieter beginnt mit leerer Queue
    }
    const detF = det[0] + det[1] + det[2];
    // 2) nächsten Versuch planen — oder endgültig gescheitert
    for (let k = 0; k < 3; k++) {
      const d = det[k];
      if (!(d > 0)) continue;
      if (k + 1 >= maxK) {
        fail += d;
        continue;
      }
      const e = detE[k] / d; // mittlere Zeit seit dem Start
      const lane = k + 1; // Index des nächsten Versuchs (2. bzw. 3.)
      const back = Math.round((RETRY_BASE_S * 2 ** k) / DT); // Slots
      // gespeichert: Zeit seit dem Start, wenn der Retry fällig ist
      const put = (j, x) => {
        const i = ((slot + j) % S) * 3 + lane;
        rq[i] += x;
        rqE[i] += x * (e + j * DT);
      };
      if (mode === "naiv") put(1, d);
      else if (mode === "backoff") put(back, d);
      else {
        const per = d / back; // full jitter, gleichverteilt
        for (let j = 1; j <= back; j++) put(j, per);
      }
      this.rqSum += d;
    }
    // 3) fällige Retries; ohne Retries entfallen alle wartenden sofort
    let due1 = rq[i0 + 1];
    let due2 = rq[i0 + 2];
    let dueE1 = rqE[i0 + 1];
    let dueE2 = rqE[i0 + 2];
    rq[i0 + 1] = 0;
    rq[i0 + 2] = 0;
    rqE[i0 + 1] = 0;
    rqE[i0 + 2] = 0;
    this.rqSum -= due1 + due2;
    if (mode === "aus") {
      fail += due1 + due2 + Math.max(0, this.rqSum);
      due1 = 0;
      due2 = 0;
      dueE1 = 0;
      dueE2 = 0;
      if (this.rqSum > 0) {
        rq.fill(0);
        rqE.fill(0);
      }
      this.rqSum = 0;
    }
    // 4) Retry-Budget (Token Bucket)
    let denied = 0;
    if (cm.retryBudget) {
      this.retryTokens = Math.min(
        this.retryTokens + RETRY_BUDGET * first,
        Math.max(1, RETRY_BUDGET * RETRY_BURST_S * this.firstEma),
      );
      const want = due1 + due2;
      if (want > 0) {
        const allow = Math.min(want, this.retryTokens);
        this.retryTokens -= allow;
        denied = want - allow;
        const g = allow / want;
        due1 *= g;
        due2 *= g;
        dueE1 *= g;
        dueE2 *= g;
        fail += denied;
      }
    } else this.retryTokens = 0;
    // 5) Breaker offen bzw. half-open: Retries entfallen sofort (fail fast) —
    // der Kunde hat schon einen Timeout gewartet, die Zahlung ist
    // gescheitert. Erstversuche hat der Breaker schon am Rand gefiltert.
    const adm = this.payAdmit;
    const blocked = (due1 + due2) * (1 - adm);
    fail += blocked;
    const sv = [first, due1 * adm, due2 * adm];
    const svE = [first * preFirst, dueE1 * adm, dueE2 * adm];
    const sent = sv[0] + sv[1] + sv[2];
    // 6) senden: scheitert, wer hinter der Queue den Timeout reißt — FIFO
    // auch innerhalb dieses Schritts (ein Retry-Puls steht hinter sich
    // selbst). Rechtzeitig für den Kunden ist, wer auch die Frist hält: Sie
    // wirkt wie ein engerer Timeout (Rest der Frist nach e und postS) —
    // dieselbe FIFO-Schätzung beim Senden, wie die Latenz beim Start im
    // Pfad ohne Versuche
    const pF = fifoFailShare(this.pq, sent, payCap, this.payTC);
    const fs = ((slot + Math.round(this.payTC / DT)) % S) * 3;
    for (let k = 0; k < 3; k++) {
      const x = sv[k];
      if (!(x > 0)) continue;
      const e = svE[k] / x;
      const bad = x * pF;
      const left = DEADLINE_S - e - postS;
      const pOn =
        left < this.payTC
          ? 1 - fifoFailShare(this.pq, sent, payCap, left)
          : 1 - pF;
      ok3[k] += x - bad;
      okL[k] += Math.max(0, x - bad - x * pOn);
      okE[k] += (x - bad) * e;
      this.pqOrph += bad;
      fq[fs + k] += bad;
      fqE[fs + k] += bad * (e + this.payTC);
      this.fqSum += bad;
    }
    // 7) Anbieter: zuerst, was rechtzeitig fertig wird, dann Verwaistes.
    // Gelungen; für den Kunden rechtzeitig nur, was die Frist hält (okL:
    // gelingt, aber zu spät)
    let room = payCap * DT;
    const okQ = ok3[0] + ok3[1] + ok3[2];
    let ok = 0;
    let late = 0;
    let done = 0;
    if (okQ > 0) {
      const g = Math.min(1, room / okQ);
      for (let k = 0; k < 3; k++) {
        const d = ok3[k] * g;
        if (!(d > 0)) continue;
        const dL = okL[k] * g;
        ok3[k] -= d;
        okL[k] -= dL;
        okE[k] -= okE[k] * g;
        late += dL;
        ok += d - dL;
        done += d;
      }
      room -= done;
    }
    const waste = Math.min(this.pqOrph, Math.max(0, room));
    this.pqOrph -= waste;
    // 8) Anbieter bricht intern ab: Queue höchstens PAY_GIVEUP_S — zuerst
    // Verwaistes; trifft es Wartende, scheitern sie (Timeout im nächsten
    // Schritt erkannt)
    let over = this.pqOrph + ok3[0] + ok3[1] + ok3[2] - PAY_GIVEUP_S * payCap;
    if (over > 0) {
      const dO = Math.min(this.pqOrph, over);
      this.pqOrph -= dO;
      over -= dO;
      const okQ2 = ok3[0] + ok3[1] + ok3[2];
      if (over > 0 && okQ2 > 0) {
        const n1 = ((slot + 1) % S) * 3;
        for (let k = 0; k < 3; k++) {
          const d = (ok3[k] * over) / okQ2;
          const dE = (okE[k] * over) / okQ2;
          ok3[k] -= d;
          okL[k] -= (okL[k] * over) / okQ2;
          okE[k] -= dE;
          fq[n1 + k] += d;
          fqE[n1 + k] += dE + d * DT;
          this.fqSum += d;
        }
      }
    }
    // Wer beim Anbieter wartet, wartet einen Schritt länger
    for (let k = 0; k < 3; k++) okE[k] += ok3[k] * DT;
    if (this.fqSum < 1e-9) this.fqSum = Math.max(0, this.fqSum);
    if (this.rqSum < 1e-9) this.rqSum = Math.max(0, this.rqSum);
    this.pq = this.pqOrph + ok3[0] + ok3[1] + ok3[2];
    this.payInflight = ok3[0] + ok3[1] + ok3[2] + this.fqSum;
    this.payHeld = this.payInflight + this.rqSum;
    this.arrP = sent / DT;
    this.paySent = sent / DT;
    this.payPF = sent > 1e-9 ? pF : 0;
    // Fehleranteil für den Breaker im nächsten Schritt: nur Ausgänge, die
    // der Client jetzt kennt — erkannte Timeouts (beim Neustart alle offenen
    // Aufrufe) gegen gelungene Zahlungen. Ein Versuch, der den Timeout erst
    // reißen wird, ist noch kein Fehler.
    const outc = detF + done;
    this.payOutcomes = outc / DT;
    this.payFail = outc > 1e-9 ? detF / outc : 0;
    if (outc > 1e-9) this.payFailEma += (this.payFail - this.payFailEma) * K_BR;
    this.firstEma += (first / DT - this.firstEma) * K_DRAIN;
    return {
      ok,
      late,
      fail,
      sent,
      first: sv[0],
      retries: sv[1] + sv[2],
      waste,
      denied,
      served: done + waste,
    };
  }

  /* Zahlungs-Ebene live an- oder abschalten (Retry-Modus in einem Szenario
   * ohne retryLayer). An: Was der Anbieter schon hat, wurde beim Start
   * gezählt — es wird Verwaistes. Aus: Wartende Erfolge zählen jetzt
   * (rechtzeitig oder zu spät nach ihrer Zeit seit dem Start), offene
   * Timeouts und Retries als gescheitert; der Anbieter rechnet weiter. */
  _switchPayLayer(on) {
    if (on) {
      this.pqOrph = this.pq;
    } else {
      for (let k = 0; k < 3; k++) {
        this._pendLate += this.pqOkL[k];
        this._pendOk += this.pqOk[k] - this.pqOkL[k];
      }
      this._pendFail += this.fqSum + this.rqSum;
      this.pqOrph = 0;
    }
    this.pqOk = [0, 0, 0];
    this.pqOkL = [0, 0, 0];
    this.pqOkE = [0, 0, 0];
    this.rFq.fill(0);
    this.rRq.fill(0);
    this.rFqE.fill(0);
    this.rRqE.fill(0);
    this.fqSum = 0;
    this.rqSum = 0;
    this.payHeld = 0;
    this.payInflight = 0;
    this.retryTokens = 0;
    this.payOutcomes = 0;
    this.payFailEma = 0;
    this.retryLayer = on;
  }

  /* ---------- Ein Schritt ---------- */

  _step() {
    const t = this.n / STEPS_PER_S; // wie der Getter t: exakte Sekundengrenzen
    const cm = this.cm;

    // 1) OU-Rauschen: feste Zahl von Ziehungen je Schritt und Strom
    this.zW = this.zW * OU_A + OU_B * noise(this.rCap, SQ12);
    this.zI = this.zI * OU_A + OU_B * noise(this.rCap, SQ12);
    this.zP = this.zP * OU_A + OU_B * noise(this.rCap, SQ12);
    this.zA = this.zA * OU_A + OU_B * noise(this.rArr, SQ12);
    if (this.rMail) this.zM = this.zM * OU_A + OU_B * noise(this.rMail, SQ12);

    // 2) Nachbar: Zyklus immer, Wirkung je Modus
    this._nbSchedule(t);
    let stealT = 0;
    let awaitT = 1;
    let phase = "idle";
    if (cm.nb === "zufall") {
      phase = this.nbPhase;
      if (phase === "cpu") stealT = this.nbSteal;
      else if (phase === "io") awaitT = this.nbAwait;
    } else if (cm.nb === "murphy") {
      this._murphy(t);
      phase = this.mPhase;
      if (phase === "cpu") stealT = NB_STEAL_MAX;
      else if (phase === "io") awaitT = NB_AWAIT_MAX;
    }
    // Erzwungener IO-Schub (trigger("ioSchub")): die IO-Phase der
    // Nachbar-VM zu fester Zeit, in jedem Nachbar-Modus
    this.ioNow = false;
    for (const b of this.ioBursts)
      if (t >= b.t0 - 1e-9 && t < b.t1 - 1e-9) this.ioNow = true;
    if (this.ioNow) {
      phase = "io";
      awaitT = Math.max(awaitT, IO_BURST_AWAIT);
    }
    this.phaseNow = phase;
    if (cm.isolate) {
      stealT = 0;
      awaitT = 1;
    }
    this.steal += (stealT - this.steal) * K_NB;
    this.awaitM += (awaitT - this.awaitM) * K_NB;

    this._compute(t);
    this._flow(t);
    this._evaluate(t);

    this.n++;
    if (this.n % STEPS_PER_S === 0) this._pushSample();
  }

  /* Kapazitäten, Last, Nachfrage, Reserve — reine Funktion des Zustands. */
  _compute(t) {
    const cm = this.cm;
    const p = this.p;
    const sg = p.sigma;
    const amp = NOISE_LEVELS[cm.noise] ?? 1;

    // Scaling: deterministisch auf scaleTarget
    const n0 = p.nWeb;
    const extra = Math.max(0, p.scaleTarget - n0);
    let nNew = 0;
    let starting = 0;
    let warm = 1;
    if (cm.scale && this.scaleOnAt !== null) {
      const e = t - this.scaleOnAt;
      if (cm.scaleMode === "vorgewaermt") {
        if (e >= SCALE_PREWARM_S) nNew = extra;
        else starting = extra;
      } else {
        const tr = SCALE_DETECT_S + SCALE_COLD_S;
        if (e >= tr) {
          nNew = extra;
          warm =
            SCALE_WARM_START +
            (1 - SCALE_WARM_START) * Math.min(1, (e - tr) / SCALE_WARMUP_S);
        } else if (e >= SCALE_DETECT_S) starting = extra;
      }
    }
    this.nRun = n0 + nNew;
    this.nStarting = starting;
    this.warm = nNew > 0 ? warm : 1;
    const hW = cm.headroom || cm.headroomAll ? 1 + HEADROOM : 1;
    const hI = cm.headroomAll ? 1 + HEADROOM : 1;
    this.webNom = (n0 + nNew * warm) * WEB_PER_INSTANCE * hW;
    this.webCap =
      this.webNom *
      Math.max(0.05, 1 + amp * sg.web * this.zW) *
      (1 - this.steal);
    this.invNomE = INV_CAP_E * hI;
    this.invCapE =
      (this.invNomE * Math.max(0.05, 1 + amp * sg.inv * this.zI)) /
      (1 - DB_IO_SHARE + DB_IO_SHARE * this.awaitM);
    // Störung beim Zahlungsdienst: Brownout zwischen t0 und t1 (trigger)
    let brown = false;
    for (const inc of this.incidents)
      if (t >= inc.t0 - 1e-9 && t < inc.t1 - 1e-9) brown = true;
    this.payF = brown ? PAY_BROWNOUT : 1;
    this.payCap =
      PAY_CAP * Math.max(0.05, 1 + amp * sg.pay * this.zP) * this.payF;
    this.threads = this.nRun * p.threadsPer;
    // Zahlung mit Versuchen: Timeout eines Versuchs beim Client — mit
    // Timeouts PAY_TIMEOUT_S, sonst wartet er, bis der Anbieter abbricht
    const retryL = p.retryLayer || cm.retry !== "aus";
    this.payTC = cm.timeouts ? PAY_TIMEOUT_S : PAY_GIVEUP_S;

    // Empfehlungsdienst: Antwortzeit nach Profil, Breaker, wer ihn aufruft
    // und wie lange eine Seite (und ihr Thread) wartet. Ohne Profil, Timeouts
    // und Breaker: genau REC_LAT_S, alle Seiten rufen auf (Cache-Treffer nicht).
    this.recLat = loadAt(p.recLat, t, REC_RAMP_S);
    const hit = cm.cache && !cm.featureShed ? CACHE_HIT : 0;
    const timedOut = cm.timeouts && this.recLat > REC_TIMEOUT_S;
    this.recWait = cm.timeouts
      ? Math.min(this.recLat, REC_TIMEOUT_S)
      : this.recLat;
    // Fehler = Abbruch durch den Timeout; langsam allein ist kein Fehler.
    // Das Ergebnis einer Probe kennt der Breaker erst nach ihrer Wartezeit.
    this.recFail = timedOut ? 1 : 0;
    const recCalls = !cm.featureShed && hit < 1 && this.aB > 0;
    this._breakerStep(
      this.brRec,
      cm.breaker,
      this.recFail,
      recCalls,
      this.recWait,
      t,
      "tripsRec",
    );
    // Mit Versuchen zählen nur Ausgänge, die der Client kennt (_payLayer).
    // Das Ergebnis einer Probe kennt der Breaker erst nach dem Timeout des
    // Versuchs: Erstversuche als Probe gehen frühestens einen Schritt nach
    // Beginn der Probe-Phase raus (der Rand lässt sie durch), und payFail
    // stammt aus dem letzten Schritt — daher payTC + 2 DT
    this._breakerStep(
      this.brPay,
      cm.breaker,
      this.payFail,
      retryL ? this.payOutcomes > 0 : this.arrP > 0,
      retryL ? this.payTC + 2 * DT : 0,
      t,
      "tripsPay",
      retryL,
    );
    this.recAdmit = admitOf(this.brRec);
    this.payAdmit = admitOf(this.brPay);
    this.recCall = cm.featureShed ? 0 : (1 - hit) * this.recAdmit;
    this.recHoldX = Math.max(0, this.recWait - REC_LAT_S);
    this.recAvgWait = this.recCall * this.recWait;
    // degradiert: Seiten, die Empfehlungen wollten und keine bekamen —
    // Breaker offen (nicht aufgerufen) oder Timeout. Feature Shedding nicht.
    this.recDeg = cm.featureShed
      ? 0
      : (1 - hit) * (1 - this.recAdmit + (timedOut ? this.recAdmit : 0));
    // Threads: Zusatz-Haltezeit je Produktseite; was der Pool der Seiten
    // trägt (∞ ohne Zusatz-Haltezeit — dann zählt allein die CPU)
    const hB = this.recCall * this.recHoldX;
    const poolB = cm.bulkhead
      ? (1 - BULKHEAD_CHECKOUT) * this.threads
      : this.threads;
    this.thrCapB = hB > 1e-9 ? poolB / hB : Infinity;

    // Last = Gesamtnachfrage; Checkouts aus dem Funnel, der Bot (bots)
    // unten dazu — Retries kommen erst an der Zahlung dazu (_payLayer);
    // die Kosten je Klasse — cache, batch — folgen unten nach wB
    this.Lnom = loadAt(p.load, t);
    // Blitzangebote (spitzen): Wellen zusätzlicher Checkouts über der
    // Grundlast (cFix = base); die Schwankung der Ankünfte tragen die Seiten
    let wX = 0;
    if (p.waves) {
      this.waveX = waveShape(p.waves, t, this.dauerAt);
      wX = (p.waves.peak - p.waves.base) * this.waveX;
      this.Lnom += wX;
    }
    const L = this.Lnom * Math.max(0, 1 + amp * sg.arr * this.zA);
    // Funnel: Checkouts folgen den rechtzeitig ausgelieferten Produktseiten;
    // ohne Funnel (konstante Last) fester Mix im Gleichgewicht des Funnels
    let lamC = p.funnel
      ? p.cFix + p.conv * this.pagesEma
      : p.cFix + (p.conv / (1 + p.conv)) * (L - p.cFix);
    if (p.waves) lamC += wX;
    if (lamC > L) lamC = L;
    this.L = L;
    this.aC = lamC;
    this.aB = L - lamC;
    // Bot (Szenario bots): ein Client, Produktseiten wie die Kunden, ohne
    // Rauschen — Teil der Klasse B und der Gesamtnachfrage
    if (p.bot) {
      this.aBot = loadAt(p.bot, t);
      this.Lnom += this.aBot;
      this.L += this.aBot;
      this.aB += this.aBot;
    }

    // Nachfrage: nur durch die Kapazität der Vorstufen begrenzt. Mit
    // shedBrowse starten Checkouts zuerst (Vorrang an Webserver und DB),
    // sonst teilen sich beide Klassen eine knappe Vorstufe anteilig. Die
    // Threads begrenzen nur Produktseiten (thrCapB); im gemeinsamen Pool
    // ohne Vorrang bremsen knappe Threads beide Klassen anteilig (FIFO).
    const prio = cm.shedBrowse;
    const dW = this.aB + this.aC;
    const tB = this.thrCapB;
    let wB;
    let wC;
    if (prio) {
      wC = Math.min(this.aC, this.webCap);
      wB = Math.min(this.aB, this.webCap - wC, tB);
    } else if (cm.bulkhead) {
      const fW = dW > 0 ? Math.min(1, this.webCap / dW) : 1;
      wB = Math.min(this.aB * fW, tB);
      wC = this.aC * fW;
    } else {
      const fT = tB < Infinity && this.aB > 0 ? tB / this.aB : Infinity;
      const fW = dW > 0 ? Math.min(1, this.webCap / dW, fT) : 1;
      wB = this.aB * fW;
      wC = this.aC * fW;
    }
    // Kapazität der Webserver beim aktuellen Mix: CPU oder, was die Threads
    // tragen — mit Vorrang oder eigenem Pool kommen Checkouts immer durch
    let capT = Infinity;
    if (tB < Infinity)
      capT =
        prio || cm.bulkhead
          ? this.aC + tB
          : this.aB > 0
            ? (tB * dW) / this.aB
            : Infinity;
    this.webCapEff = Math.min(this.webCap, capT);
    // Kosten je Klasse [E]. Die Reservierung (cC) bleibt immer live und
    // ungebündelt. Cache + Coalescing: Empfehlungen zu CACHE_HIT ohne DB-
    // Arbeit. Batching: Das Bündel füllt sich mit der Rate der Produktseiten
    // an der DB (Nachfrage wB) über BATCH_WINDOW_S; der Overhead teilt sich.
    // Offener Breaker vor den Empfehlungen: keine DB-Arbeit für sie
    // (automatisches Feature Shedding), half-open nur für die Proben.
    this.recoE = cm.featureShed
      ? 0
      : (cm.cache ? INV_RECO_CACHED_E : INV_RECO_E) * this.recAdmit;
    this.batchK = cm.batch ? Math.max(1, wB * BATCH_WINDOW_S) : 1;
    this.cB =
      cm.cache || cm.batch || this.recAdmit < 1
        ? INV_OVERHEAD_E / this.batchK + INV_PER_ITEM_E + this.recoE
        : cm.featureShed
          ? INV_AVAIL_E
          : INV_PAGE_E;
    this.cC = INV_RESERVE_E;
    const dIE = wB * this.cB + wC * this.cC;
    let iC;
    if (prio) {
      iC = Math.min(wC, this.invCapE / this.cC);
    } else {
      const fI = dIE > 0 ? Math.min(1, this.invCapE / dIE) : 1;
      iC = wC * fI;
    }
    this.dW = dW;
    this.dIE = dIE;
    this.dIR = wB + wC; // req/s an der DB
    // Bot-Anteil der Produktseiten an der DB (Nachfrage, anteilig)
    if (p.bot) this.dBot = this.aB > 0 ? (this.aBot / this.aB) * wB : 0;
    // nur Produktseiten rufen die Empfehlungen auf — mit Cache nur die
    // Fehltreffer (zusammengelegt), mit offenem Breaker keine
    this.dRec = wB * this.recCall;
    // Zahlung: was ankommt, ist Nachfrage (Ankünfte im letzten Schritt als
    // Untergrenze) — die Formel unterschätzt sie, wenn die begrenzten
    // Eingangs-Queues die Klassen nicht exakt anteilig kappen (EDGE_MIN) oder
    // die DB einen Rückstau abbaut
    this.dP = Math.max(iC, this.arrP);
    const rW = reserveOf(this.webCapEff, dW);
    const rI = reserveOf(this.invCapE, dIE);
    const rP = reserveOf(this.payCap, this.dP);
    // Mailversand (spitzen): je bediente Zahlung eine Mail. Synchron ist
    // die Nachfrage, was jetzt ankommt (Zahlung, nur durch deren Kapazität
    // begrenzt; Ankünfte im letzten Schritt als Untergrenze). Hinter dem
    // Puffer (smoothing) sieht der Mailversand den Zufluss geglättet über
    // MAIL_SMOOTH_TAU_S — die EMA läuft immer mit, damit das Umschalten
    // stetig ist.
    let rM = RES_MAX;
    if (p.mail) {
      this.mailCap =
        MAIL_CAP * Math.max(0.05, 1 + amp * (sg.mail ?? 0) * this.zM);
      // Alter einer Mail ≈ Queue / Abflussrate der letzten MAIL_MAX_AGE_S —
      // geglättet, sonst sprängen Altersgrenze und Verluste mit jedem
      // Rauschschritt der Kapazität
      this.mailRate += (this.mailCap - this.mailRate) * K_MAIL_AGE;
      this.dMi = Math.max(Math.min(this.dP, this.payCap), this.arrM);
      this.mailDemEma += (this.dMi - this.mailDemEma) * K_MAIL;
      this.dM = cm.smoothing ? this.mailDemEma : this.dMi;
      rM = reserveOf(this.mailCap, this.dM);
    }
    if (!this._resInit) {
      this.resW = rW;
      this.resI = rI;
      this.resP = rP;
      this.resM = rM;
      this._resInit = true;
      this.knapp = rW <= rI && rW <= rP ? "web" : rI <= rP ? "inv" : "pay";
      if (p.mail && rM < Math.min(rW, rI, rP)) this.knapp = "mail";
    } else {
      this.resW += (rW - this.resW) * K_RES;
      this.resI += (rI - this.resI) * K_RES;
      this.resP += (rP - this.resP) * K_RES;
      if (p.mail) this.resM += (rM - this.resM) * K_RES;
    }
  }

  /* Fluss: Starts aus den Eingangs-Queues → DB → Zahlung; danach Ankünfte. */
  _flow(t) {
    const cm = this.cm;
    const cB = this.cB;
    const cC = this.cC;
    const invCapE = this.invCapE;
    const payCap = this.payCap;
    // Zahlung mit Versuchen an- oder abgeschaltet (Retry-Modus live)
    const retryL = this.p.retryLayer || cm.retry !== "aus";
    if (retryL !== this.retryLayer) this._switchPayLayer(retryL);
    // Puffer aus (spitzen): Was schon im Puffer liegt, verschickt der
    // Mailversand im Hintergrund weiter (mqBg) — kein Kunde wartet darauf,
    // es hält keinen Thread; Puffer wieder an: alles zurück in den Puffer
    if (this.p.mail && !!cm.smoothing !== this.mailAsync) {
      if (cm.smoothing) {
        this.mq += this.mqBg;
        this.mqBg = 0;
      } else {
        this.mqBg += this.mq;
        this.mq = 0;
        this.mqBgExp = this.mqBg / MAIL_MAX_AGE_S; // Mails/s, die verfallen
      }
      this.mailAsync = !!cm.smoothing;
    }
    // Neustart des Zahlungsdienstes am Ende einer Störung (einmal je Störung)
    let reset = false;
    for (const inc of this.incidents)
      if (!inc.reset && t >= inc.t1 - 1e-9) {
        inc.reset = true;
        reset = true;
      }
    // Checkouts in der Zahlung, wie der Shop sie sieht (je ein Thread): mit
    // Versuchen die, auf die er wartet oder die im Backoff stehen — ohne die
    // verwaisten Aufrufe, an denen nur noch der Anbieter rechnet
    // Synchroner Mailversand (spitzen): Checkouts warten im Shop auf die
    // Mail und halten so lange ihren Thread
    const mailSync = this.p.mail && !cm.smoothing;
    let pqT = retryL ? this.payHeld : this.pq;
    if (mailSync) pqT += this.mq;
    const pqP = retryL ? this.payInflight : this.pq;

    // Wartezeiten der jetzt startenden Requests (Ist-Zustand)
    const wEB = this.eb / Math.max(this.drB, 1e-3);
    const wEC = this.ec / Math.max(this.drC, 1e-3);
    const wDb = (this.dbEB + this.dbEC) / invCapE;
    const wPay = this.pq / payCap;
    const wMail = mailSync ? this._waitMail() : 0;

    // Startgrenzen: CPU, Threads, DB-Permits, Zahlungs-Permits. Threads
    // halten Requests in DB und Zahlung und Seiten, die auf die Empfehlungen
    // warten; mit Bulkheads je Pool (Checkout BULKHEAD_CHECKOUT, Rest Seiten).
    const cpu = this.webCap * DT;
    let thr = this.threads - (this.dbNB + this.dbNC + pqT + this.recN);
    if (thr < 0) thr = 0;
    const bulk = cm.bulkhead;
    const thrB = bulk
      ? Math.max(
          0,
          (1 - BULKHEAD_CHECKOUT) * this.threads - (this.dbNB + this.recN),
        )
      : thr;
    const thrC = bulk
      ? Math.max(0, BULKHEAD_CHECKOUT * this.threads - (this.dbNC + pqT))
      : thr;
    const permE = cm.bpInv
      ? Math.max(0, DB_PERMIT_S * invCapE - (this.dbEB + this.dbEC))
      : Infinity;
    const permP = cm.bpPay
      ? Math.max(0, PAY_PERMIT_S * payCap - (this.dbNC + pqP))
      : Infinity;
    const EB = this.eb;
    const EC = this.ec;
    let sB;
    let sC;
    if (cm.shedBrowse) {
      // Priorität: Checkouts zuerst, Produktseiten bekommen den Rest
      sC = Math.min(EC, cpu, thrC, permE / cC, permP);
      sB = Math.min(
        EB,
        cpu - sC,
        bulk ? thrB : thr - sC,
        (permE - sC * cC) / cB,
      );
    } else if (bulk) {
      // Getrennte Pools mit eigener Queue; die CPU teilen sich beide anteilig
      const capB = Math.min(EB, thrB);
      const capC = Math.min(EC, thrC, permP);
      const tot = capB + capC;
      let x = tot > 0 ? Math.min(1, cpu / tot) : 1;
      const e = capB * cB + capC * cC;
      if (e > 0) x = Math.min(x, permE / e);
      sB = x * capB;
      sC = x * capC;
    } else {
      // FIFO über beide Klassen: gemeinsamer Anteil x
      const tot = EB + EC;
      let x = 1;
      if (tot > 0) {
        x = Math.min(1, cpu / tot, thr / tot);
        const e = EB * cB + EC * cC;
        if (e > 0) x = Math.min(x, permE / e);
      }
      sB = x * EB;
      sC = x * EC;
      if (sC > permP) {
        sC = permP;
        sB = Math.min(EB, cpu - sC, thr - sC, (permE - sC * cC) / cB);
      }
    }
    if (!(sB > 0)) sB = 0;
    if (!(sC > 0)) sC = 0;
    this.eb = EB - sB;
    this.ec = EC - sC;
    // Bot-Anteil der gestarteten Produktseiten (Eingangs-Queue gemischt)
    let sBot = 0;
    if (this.ebBot > 0) {
      sBot = EB > 1e-12 ? Math.min(this.ebBot, (sB * this.ebBot) / EB) : 0;
      this.ebBot = Math.max(0, this.ebBot - sBot);
    }
    // „bremst Vorstufe“: Permits sind die bindende Grenze, Arbeit wartet
    this.permLimited.inv =
      cm.bpInv &&
      permE < (sB * cB + sC * cC) * 1.05 + 1e-9 &&
      EB + EC > sB + sC + 1e-6;
    this.permLimited.pay = cm.bpPay && permP <= sC + 1e-9 && EC > sC + 1e-6;

    // Timeouts an der DB: Arbeit in der DB höchstens DB_TIMEOUT_S — was
    // darüber käme, scheitert sofort mit 504 (verloren; vereinfacht ohne
    // die Wartezeit davor). gB/gC = was in die DB geht.
    let r504B = 0;
    let r504C = 0;
    if (cm.timeouts) {
      const room = Math.max(
        0,
        DB_TIMEOUT_S * invCapE - (this.dbEB + this.dbEC),
      );
      const e = sB * cB + sC * cC;
      if (e > room + 1e-12) {
        const keep = room / e;
        r504B = sB * (1 - keep);
        r504C = sC * (1 - keep);
      }
    }
    const gB = sB - r504B;
    const gC = sC - r504C;
    const r504Bot = sB > 1e-12 ? (r504B * sBot) / sB : 0;
    const gBot = sBot - r504Bot;

    // Rechtzeitig oder zu spät? (Latenz geschätzt beim Start). Empfehlungen:
    // mittlere Wartezeit je Seite (Cache-Treffer und offener Breaker rufen
    // nicht auf, Timeouts kappen); ein Bündel wartet im Mittel ein halbes
    // Sammelfenster.
    const latB =
      WEB_LAT_S +
      wEB +
      wDb +
      DB_LAT_S +
      (cm.featureShed ? 0 : this.recAvgWait) +
      (cm.batch ? BATCH_LAT_S : 0);
    let latC = WEB_LAT_S + wEC + wDb + DB_LAT_S + wPay + PAY_LAT_S;
    if (mailSync) latC += wMail + MAIL_LAT_S; // der Kunde wartet auf die Mail
    const pLateB = sig((latB - DEADLINE_S) / LATE_SIG_S);
    const pLateC = sig((latC - DEADLINE_S) / LATE_SIG_S);
    const okB = gB * (1 - pLateB);
    const okBot = gBot * (1 - pLateB); // Bot: gleicher Weg, gleiche Latenz
    // Mit Versuchen entscheidet erst die Zahlung über den Checkout (unten)
    const okC0 = retryL ? 0 : gC * (1 - pLateC);
    const degB = okB * this.recDeg; // rechtzeitig, aber ohne Empfehlungen
    this.latB = latB;
    this.latC = latC;

    // Zeit bis zum Aufruf der Zahlung (geschätzt beim Start) als Mittel über
    // die Checkouts in der DB — mit Versuchen gilt die Frist erst danach
    if (gC > 0)
      this.dbPreC =
        (this.dbPreC * this.dbNC + gC * (WEB_LAT_S + wEC + wDb + DB_LAT_S)) /
        (this.dbNC + gC);

    // DB: Processor Sharing über die Arbeit in der DB
    this.dbEB += gB * cB;
    this.dbNB += gB;
    this.dbEC += gC * cC;
    this.dbNC += gC;
    const qE = this.dbEB + this.dbEC;
    const servE = Math.min(qE, invCapE * DT);
    let doneB = 0;
    let doneC = 0;
    if (qE > 0) {
      const f = servE / qE;
      doneB = this.dbNB * f;
      doneC = this.dbNC * f;
      this.dbEB -= this.dbEB * f;
      this.dbNB -= doneB;
      this.dbEC -= this.dbEC * f;
      this.dbNC -= doneC;
    }

    // Empfehlungen: Seiten, die sie aufrufen, warten recHoldX über der
    // Basislatenz und halten so lange ihren Thread — Verzögerung 1. Ordnung,
    // Faktor hx/(hx + DT) je Schritt, damit im Gleichgewicht genau Little
    // gilt: recN = Rate × recHoldX. Ohne Zusatz-Haltezeit genau 0.
    const hx = this.recHoldX;
    this.recN =
      hx > 1e-9 ? ((this.recN + doneB * this.recCall) * hx) / (hx + DT) : 0;

    // Zahlungsdienst (extern): eigener Abbruch nach PAY_GIVEUP_S, mit
    // Timeouts schon nach PAY_TIMEOUT_S (Threads werden früher frei)
    // Danach der Mailversand (spitzen). Mit Versuchen (Retries): _payLayer.
    let servP;
    let okP = 0; // Zahlungen, die jetzt rechtzeitig gelingen (mit Versuchen)
    let lateP = 0; // dito, aber nach der Frist (zu spät)
    let failC = 0; // endgültig gescheitert
    let pay = null;
    if (retryL) {
      pay = this._payLayer(
        doneC,
        reset,
        this.dbPreC,
        mailSync ? wMail + MAIL_LAT_S : 0,
      );
      servP = pay.served;
      okP = pay.ok + this._pendOk;
      lateP = pay.late + this._pendLate;
      failC = pay.fail + this._pendFail;
      this._pendOk = 0;
      this._pendLate = 0;
      this._pendFail = 0;
    } else {
      this.pq += doneC;
      this.arrP = doneC / DT;
      servP = Math.min(this.pq, payCap * DT);
      this.pq -= servP;
      const capPQ = (cm.timeouts ? PAY_TIMEOUT_S : PAY_GIVEUP_S) * payCap;
      let dropP = 0;
      if (this.pq > capPQ) {
        // Abbruch; beim Start schon als zu spät gezählt
        dropP = this.pq - capPQ;
        this.pq = capPQ;
      }
      // Fehleranteil am Zahlungsdienst (für den Breaker im nächsten Schritt)
      this.payFail = doneC > 1e-9 ? Math.min(1, dropP / doneC) : 0;
      // Neustart: offene Aufrufe brechen ab (beim Start schon gezählt)
      if (reset) {
        this.pq = 0;
        this.payFail = 1;
      }
      okP = this._pendOk;
      lateP = this._pendLate;
      failC = this._pendFail;
      this._pendOk = 0;
      this._pendLate = 0;
      this._pendFail = 0;
    }
    const okC = okC0 + okP;

    // Mailversand (spitzen): je bediente Zahlung eine Bestätigungsmail.
    // Synchron gibt der Shop nach MAIL_GIVEUP_S auf; asynchron hält der
    // Puffer höchstens MAIL_Q_MAX Mails, keine älter als MAIL_MAX_AGE_S —
    // was darüber liegt, geht verloren (die Bestellung gilt trotzdem).
    let inM = 0;
    let servM = 0;
    let dropM = 0;
    if (this.p.mail) {
      inM = servP;
      this.mq += inM;
      servM = Math.min(this.mq, this.mailCap * DT);
      this.mq -= servM;
      const qMax = this._mailQMax();
      if (this.mq > qMax) {
        dropM = this.mq - qMax;
        this.mq = qMax;
      }
      // Rest des abgeschalteten Puffers: mit der Kapazität, die die
      // synchronen Mails übrig lassen. Er war beim Abschalten 0 …
      // MAIL_MAX_AGE_S alt und verfällt gleichmäßig (zu alt, verloren)
      if (this.mqBg > 0) {
        const bg = Math.min(this.mqBg, this.mailCap * DT - servM);
        this.mqBg -= bg;
        servM += bg;
        const old = Math.min(this.mqBg, this.mqBgExp * DT);
        this.mqBg -= old;
        dropM += old;
        if (this.mqBg < 1e-9) this.mqBg = 0;
      }
      this.arrM = inM / DT;
    }

    // Ankünfte. Am Rand zuerst das Rate Limit je Client (429; nur der Bot
    // ist ein schwerer Client), dann Admission Control global über alle
    // Klassen (503, anteilig) — beides ohne Arbeit. Offener Breaker vor der
    // Zahlung: Checkouts sofort 503, vor jeder DB-Arbeit (zählt als früh
    // abgewiesen, r503).
    let inB = this.aB * DT;
    let inC = this.aC * DT;
    let inBot = this.aBot * DT; // Bot-Anteil von inB
    let r429B = 0;
    let admB = 0;
    let admC = 0;
    let admBot = 0;
    if (cm.rateLimit) {
      this.rlTokens = Math.min(RL_BURST, this.rlTokens + RL_RATE * DT);
      const pass = Math.min(inBot, this.rlTokens);
      this.rlTokens -= pass;
      r429B = inBot - pass;
      inBot = pass;
      inB -= r429B;
    } else this.rlTokens = RL_BURST;
    if (cm.admission) {
      const room = ADMISSION_RPS * DT;
      const tot = inB + inC;
      if (tot > room) {
        const keep = room / tot;
        admB = inB * (1 - keep);
        admC = inC * (1 - keep);
        admBot = inBot * (1 - keep);
        inB -= admB;
        inC -= admC;
        inBot -= admBot;
      }
    }
    // (mit Versuchen: die Erstversuche — Retries hält er in _payLayer auf)
    let ffC = 0;
    if (this.payAdmit < 1) {
      ffC = inC * (1 - this.payAdmit);
      inC -= ffC;
    }
    let shedB = 0;
    let shedC = 0;
    // Bot-Anteil der Produktseiten vor dem Shedding — der Shedder sieht den
    // Zustand des Servers, nicht, wer fragt: Bot und Kunden anteilig
    const botFrac = inB > 1e-12 ? inBot / inB : 0;
    if (cm.shedBrowse) {
      const room = Math.max(
        0,
        Math.max(EDGE_MIN, SHED_TARGET_S * this.drB) - this.eb,
      );
      if (inB > room) {
        shedB = inB - room;
        inB = room;
      }
      // Ohne Back Pressure staut es sich in der DB, nicht am Rand: ab
      // SHED_DB_S Wartezeit Produktseiten anteilig abweisen. Mit Back
      // Pressure bleibt die DB unter DB_PERMIT_S — dann ruht dieser Teil.
      const wDbNow = (this.dbEB + this.dbEC) / invCapE;
      if (wDbNow > SHED_DB_S) {
        const d = inB * Math.min(1, (wDbNow - SHED_DB_S) / SHED_DB_BAND_S);
        shedB += d;
        inB -= d;
      }
    }
    const shedBot = shedB * botFrac;
    inBot -= shedBot;
    if (cm.shedCheckout) {
      const backlog = this.ec + this.dbNC + (retryL ? this.payHeld : this.pq);
      const room = Math.max(0, SHED_C_TARGET_S * payCap - backlog);
      if (inC > room) {
        shedC = inC - room;
        inC = room;
      }
    }
    this.eb += inB;
    this.ec += inC;
    if (inBot > 0) this.ebBot += inBot;
    this.drB += (sB / DT - this.drB) * K_DRAIN;
    this.drC += (sC / DT - this.drC) * K_DRAIN;

    // Grenzen der Eingangs-Queue: mit Back Pressure begrenzt (Tail-Drop 503),
    // sonst unbegrenzt — Clients geben nach ABANDON_S auf (verloren)
    this.edgeBounded = cm.bpInv || cm.bpPay;
    let r503B = 0;
    let r503C = 0;
    let abandonedB = 0;
    let abandonedC = 0;
    if (this.edgeBounded) {
      this.ebMax = Math.max(EDGE_MIN, EDGE_BOUND_S * this.drB);
      this.ecMax = Math.max(EDGE_MIN, EDGE_BOUND_S * this.drC);
      if (this.eb > this.ebMax) {
        r503B = this.eb - this.ebMax;
        this.eb = this.ebMax;
      }
      if (this.ec > this.ecMax) {
        r503C = this.ec - this.ecMax;
        this.ec = this.ecMax;
      }
    } else {
      this.ebMax = null;
      this.ecMax = null;
      const capB = ABANDON_S * Math.max(this.drB, 1);
      const capC = ABANDON_S * Math.max(this.drC, 1);
      if (this.eb > capB) {
        abandonedB = this.eb - capB;
        this.eb = capB;
      }
      if (this.ec > capC) {
        abandonedC = this.ec - capC;
        this.ec = capC;
      }
    }
    // Bot-Anteil von Tail-Drop und Aufgeben (Queue gemischt)
    let dropBot = 0;
    let abandonedBot = 0;
    if (this.ebBot > 0) {
      const pre = this.eb + r503B + abandonedB;
      const frac = pre > 1e-12 ? Math.min(1, this.ebBot / pre) : 0;
      dropBot = r503B * frac;
      abandonedBot = abandonedB * frac;
      this.ebBot = this.eb * frac;
    }
    // Admission Control weist mit 503 ab (zählt bei r503)
    r503B += admB;
    r503C += admC;

    // Requests auf der Web-CPU: in Bearbeitung (Little: Rate × WEB_LAT_S);
    // ist die CPU die bindende Grenze, teilen sich auch die wartenden
    // Requests die CPU und halten je einen Thread (Thread je Request)
    const cpuBound = sB + sC >= cpu - 1e-9 && this.eb + this.ec > 1e-6;
    this.webOnCpu =
      ((sB + sC) / DT) * WEB_LAT_S + (cpuBound ? this.eb + this.ec : 0);

    // Funnel: rechtzeitig ausgelieferte Produktseiten → spätere Checkouts
    // (nur die der Kunden — Bots kaufen nicht)
    this.pagesEma += ((okB - okBot) / DT - this.pagesEma) * K_FUN;

    // Momentwerte für Auswertung, Snapshot und Probe
    r503C += ffC; // offener Breaker vor der Zahlung: sofort 503
    const lateB = gB - okB;
    // mit Versuchen: erst beim Abschluss der Zahlung bekannt (_payLayer)
    const lateC = retryL ? lateP : gC - okC0 + lateP;
    const shed = shedB + shedC;
    const r503 = r503B + r503C;
    const abandoned = abandonedB + abandonedC;
    const late = lateB + lateC;
    const r504 = r504B + r504C;
    const recPart = cm.featureShed ? 0 : this.recAvgWait;
    const f = this.f;
    f.sB = sB;
    f.sC = sC;
    f.okB = okB;
    f.okC = okC;
    f.shed = shed;
    f.r503 = r503;
    f.abandoned = abandoned;
    f.late = late;
    f.shedB = shedB;
    f.shedC = shedC;
    f.r503B = r503B;
    f.r503C = r503C;
    f.abandonedB = abandonedB;
    f.abandonedC = abandonedC;
    f.lateB = lateB;
    f.lateC = lateC;
    f.r504B = r504B;
    f.r504C = r504C;
    f.failC = failC;
    f.tryP = pay ? pay.sent : 0;
    f.firstP = pay ? pay.first : 0;
    f.retryP = pay ? pay.retries : 0;
    f.wasteP = pay ? pay.waste : 0;
    f.deniedP = pay ? pay.denied : 0;
    f.degB = degB;
    f.doneI = doneB + doneC;
    f.doneP = servP;
    f.utilW = this.webCap > 0 ? (sB + sC) / (this.webCap * DT) : 0;
    f.utilI = invCapE > 0 ? servE / (invCapE * DT) : 0;
    f.utilP = payCap > 0 ? servP / (payCap * DT) : 0;
    f.utilM = this.p.mail ? servM / (this.mailCap * DT) : 0;
    f.mailIn = inM;
    f.mailSent = servM;
    f.mailLost = dropM;
    f.r429B = r429B;
    f.r429C = 0;
    // Bot (Szenario bots, Teil der Klasse B): sein Anteil je Ausgang
    f.arrBot = this.aBot * DT;
    f.okBot = okBot;
    f.rejBot = r429B + admBot + shedBot + dropBot;
    f.lostBot = abandonedBot + (gBot - okBot) + r504Bot;
    f.adm = admB + admC;
    const a = this._acc;
    a.load += this.L * DT;
    a.okB += okB;
    a.okC += okC;
    a.shed += shed;
    a.r503 += r503;
    a.lost += abandoned + late + r504 + failC;
    a.abandoned += abandoned;
    a.waste += late;
    addClass(a, f);
    a.tryP += f.tryP;
    a.firstP += f.firstP;
    a.retryP += f.retryP;
    a.wasteP += f.wasteP;
    a.deniedP += f.deniedP;
    if (this.payF < 1) a.brown++;
    a.degB += degB;
    a.startB += sB;
    a.recWaitB += sB * recPart;
    a.lamC += this.aC * DT;
    a.utilW += f.utilW;
    a.utilI += f.utilI;
    a.utilP += f.utilP;
    a.utilM += f.utilM;
    a.mailIn += inM;
    a.mailSent += servM;
    a.mailLost += dropM;
    a.latB += latB;
    a.latC += latC;
    a.r429 += r429B;
    a.arrB += this.aB * DT;
    a.arrBot += f.arrBot;
    a.okBot += okBot;
    a.rejBot += f.rejBot;
    a.lostBot += f.lostBot;
    a.adm += f.adm;
    if (this.ioNow) a.io++;
    a.k++;
    const c = this.c;
    c.load += this.L * DT;
    c.okB += okB;
    c.okC += okC;
    c.shed += shed;
    c.r503 += r503;
    c.lost += abandoned + late + r504 + failC;
    c.abandoned += abandoned;
    c.waste += late;
    addClass(c, f);
    c.tryP += f.tryP;
    c.firstP += f.firstP;
    c.retryP += f.retryP;
    c.wasteP += f.wasteP;
    c.deniedP += f.deniedP;
    if (this.payF < 1) c.brownout += DT;
    c.arrB += this.aB * DT;
    c.arrC += this.aC * DT;
    c.startB += sB;
    c.degB += degB;
    c.noRecB += cm.featureShed ? okB : degB;
    c.recWaitB += sB * recPart;
    c.demWeb += this.dW * DT;
    c.demInv += this.dIR * DT;
    c.demPay += this.dP * DT;
    c.thrWeb += sB + sC;
    c.thrInv += f.doneI;
    c.thrPay += f.doneP;
    c.utilWeb += f.utilW * DT;
    c.utilInv += f.utilI * DT;
    c.utilPay += f.utilP * DT;
    if (this.p.mail) {
      c.utilMail += f.utilM * DT;
      c.mailIn += inM;
      c.mailSent += servM;
      c.mailLost += dropM;
      c.demMail += this.dM * DT;
    }
    c.latB += latB * DT;
    c.latC += latC * DT;
    c.r429 += r429B;
    c.adm += f.adm;
    if (this.ioNow) c.io += DT;
    if (this.p.bot) {
      c.arrBot += f.arrBot;
      c.okBot += okBot;
      c.rejBot += f.rejBot;
      c.lostBot += f.lostBot;
    }
  }

  /* Wartezeiten an den Stationen nach dem Schritt [s]. */
  _waitWeb() {
    if (this.eb + this.ec <= 1e-6) return 0;
    // Abfluss ≈ 0 (eine Klasse verhungert) ⇒ Wartezeit bis zum Aufgeben
    return Math.min(
      ABANDON_S,
      Math.max(
        this.eb / Math.max(this.drB, 1e-3),
        this.ec / Math.max(this.drC, 1e-3),
      ),
    );
  }
  _waitInv() {
    return (this.dbEB + this.dbEC) / this.invCapE;
  }
  _waitPay() {
    return this.pq / this.payCap;
  }
  /** Verzögerung einer Mail, die jetzt ankommt: Queue / Abflussrate. */
  _waitMail() {
    return this.p.mail ? this.mq / this.mailRate : 0;
  }
  /** Grenze der Mail-Queue: synchron Abbruch nach MAIL_GIVEUP_S, asynchron
   * der Puffer — Größe MAIL_Q_MAX und Alter MAIL_MAX_AGE_S (bei der
   * geglätteten Abflussrate), die engere zählt. */
  _mailQMax() {
    return this.cm.smoothing
      ? Math.min(MAIL_Q_MAX, this.mailRate * MAIL_MAX_AGE_S)
      : this.mailRate * MAIL_GIVEUP_S;
  }

  /* Knappste Station, Engpass, Überlastzustand, Wechsel. */
  _evaluate(t) {
    const cm = this.cm;
    const rW = this.resW;
    const rI = this.resI;
    const rP = this.resP;
    const rM = this.resM;
    const mail = this.p.mail;
    const resOf = (s) =>
      s === "web" ? rW : s === "inv" ? rI : s === "pay" ? rP : rM;
    let arg = "web";
    let rMin = rW;
    if (rI < rMin) {
      arg = "inv";
      rMin = rI;
    }
    if (rP < rMin) {
      arg = "pay";
      rMin = rP;
    }
    if (mail && rM < rMin) {
      arg = "mail";
      rMin = rM;
    }
    if (arg !== this.knapp && rMin < resOf(this.knapp) - HYST) {
      this.knapp = arg;
      this.c.knappShifts++;
    }
    const bn = resOf(this.knapp) < 0 ? this.knapp : null;
    this.bottleneck = bn;

    // Überlastzustand: geschützt (begrenzt + abgewiesen) UND kurze Wartezeit
    // ⇒ „abgefangen“, sonst „kollabiert“
    const ovState = (r, prot, wait) =>
      r >= 0
        ? "ok"
        : prot && wait <= COLLAPSE_WAIT_S
          ? "abgefangen"
          : "kollabiert";
    // Rate Limit und Admission weisen am Rand ab (begrenzt + abgewiesen) —
    // „abgefangen“ aber nur, solange die Wartezeit dahinter kurz bleibt: Ein
    // statisches Limit, das die Kapazität nicht kennt, kollabiert trotzdem
    const edgeLimit = cm.rateLimit || cm.admission;
    this.ov.web = ovState(
      rW,
      this.edgeBounded || cm.shedBrowse || edgeLimit,
      this._waitWeb(),
    );
    // Timeouts begrenzen DB- und Zahlungs-Queue (Überlauf scheitert schnell),
    // ein Breaker weist vor der Zahlung früh ab; Load Shedding sieht die
    // Wartezeit der DB (ohne Back Pressure)
    this.ov.inv = ovState(
      rI,
      cm.bpInv || cm.timeouts || cm.shedBrowse || edgeLimit,
      this._waitInv(),
    );
    // Mit Versuchen: Scheitert die Mehrheit der Versuche (erkannte
    // Timeouts, beim Neustart alle offenen Aufrufe; EMA über
    // BREAKER_TAU_S), geht Arbeit verloren — „kollabiert“, auch wenn die
    // Queue gerade leer ist (nach dem Neustart, vor dem nächsten Retry-Puls)
    const payLost = this.retryLayer && this.payFailEma > BREAKER_TRIP;
    this.ov.pay = ovState(
      rP,
      (cm.bpPay || cm.shedCheckout || cm.timeouts || cm.breaker) && !payLost,
      this._waitPay(),
    );
    // Mailversand: synchron ungeschützt (der Kunde wartet mit); hinter dem
    // Puffer begrenzt (Größe, Alter) — und niemand wartet auf die Mail,
    // also zählt keine Wartezeit: Überlast heißt dort „abgefangen“
    if (mail)
      this.ov.mail = ovState(
        rM,
        cm.smoothing,
        cm.smoothing ? 0 : this._waitMail(),
      );

    const c = this.c;
    if (bn) c.engpass += DT;
    if (this.ov.web !== "ok") c.overWeb += DT;
    if (this.ov.inv !== "ok") c.overInv += DT;
    if (this.ov.pay !== "ok") c.overPay += DT;
    if (mail && this.ov.mail !== "ok") c.overMail += DT;
    if (this.knapp === "web") c.knappWeb += DT;
    else if (this.knapp === "inv") c.knappInv += DT;
    else if (this.knapp === "pay") c.knappPay += DT;
    else c.knappMail += DT;

    if (bn && bn !== this.lastOver) {
      if (this.lastOver !== null) {
        c.shifts++;
        let inStrike = false;
        for (let i = this.strikeLog.length - 1; i >= 0; i--) {
          const s = this.strikeLog[i];
          if (t > s.t1 + NB_HIT_GRACE_S) break;
          if (s.affects && s.target === bn && t >= s.t0) {
            inStrike = true;
            if (!s.hit) {
              s.hit = true;
              c.strikeHits++;
            }
            break;
          }
        }
        if (inStrike) c.shiftsInStrike++;
        this.shiftLog.push({ t, from: this.lastOver, to: bn, inStrike });
        if (this.shiftLog.length > 500) this.shiftLog.shift();
      }
      this.lastOver = bn;
    }
  }

  /* ---------- Historie ---------- */

  _zeroAcc() {
    return {
      k: 0,
      load: 0,
      okB: 0,
      okC: 0,
      shed: 0,
      r503: 0,
      lost: 0,
      abandoned: 0,
      waste: 0,
      ...zeroClass(),
      lamC: 0,
      utilW: 0,
      utilI: 0,
      utilP: 0,
      latB: 0,
      latC: 0,
      degB: 0,
      startB: 0,
      recWaitB: 0,
      tryP: 0,
      firstP: 0,
      retryP: 0,
      wasteP: 0,
      deniedP: 0,
      brown: 0,
      utilM: 0,
      mailIn: 0,
      mailSent: 0,
      mailLost: 0,
      r429: 0,
      arrB: 0,
      arrBot: 0,
      okBot: 0,
      rejBot: 0,
      lostBot: 0,
      adm: 0,
      io: 0,
    };
  }

  _pushSample() {
    const a = this._acc;
    const k = Math.max(1, a.k);
    const sample = {
      t: Math.round(this.n / STEPS_PER_S), // s
      bn: this.bottleneck, // "web" | "inv" | "pay" | null
      kn: this.knapp, // knappste Station
      ovWeb: this.ov.web, // "ok" | "kollabiert" | "abgefangen"
      ovInv: this.ov.inv,
      ovPay: this.ov.pay,
      resWeb: this.resW, // Reserve (Anteil, EMA)
      resInv: this.resI,
      resPay: this.resP,
      utilWeb: a.utilW / k, // Auslastung 0..1 (1-s-Mittel)
      utilInv: a.utilI / k,
      utilPay: a.utilP / k,
      latB: a.latB / k, // s geschätzte Latenz Produktseite (1-s-Mittel)
      latC: a.latC / k, // s Checkout
      costB: this.cB, // E je Produktseite an der DB (Cache, Batching)
      load: a.k ? a.load : this.L, // req/s Gesamtnachfrage
      demandC: a.k ? a.lamC : this.aC, // req/s Checkout-Nachfrage
      okB: a.okB, // req/s rechtzeitige Produktseiten
      okC: a.okC, // req/s rechtzeitige Bestellungen
      shed: a.shed, // req/s früh abgewiesen (Shedding)
      r503: a.r503, // req/s Tail-Drop der begrenzten Queue
      r429: a.r429, // req/s Rate Limit je Client (429; nur der Bot)
      lost: a.lost, // req/s verloren (aufgegeben + zu spät)
      waste: a.waste, // req/s zu spät beantwortet (verschwendete Arbeit)
      // dieselben Größen je Klasse (B = Produktseite, C = Checkout), req/s
      shedB: a.shedB,
      shedC: a.shedC,
      r503B: a.r503B,
      r503C: a.r503C,
      r429B: a.r429B,
      r429C: a.r429C,
      lostB: a.lostB,
      lostC: a.lostC,
      wasteB: a.wasteB,
      wasteC: a.wasteC,
      r504B: a.r504B, // req/s Timeout der DB (in lost enthalten)
      r504C: a.r504C,
      degB: a.degB, // req/s rechtzeitige Seiten ohne Empfehlungen (in okB)
      // s: mittlere Wartezeit einer gestarteten Seite auf die Empfehlungen
      recWait: a.startB > 1e-9 ? a.recWaitB / a.startB : this.recAvgWait,
      recLat: this.recLat, // s: Antwortzeit des Empfehlungsdienstes
      brRec: this.brRec.state, // Breaker: "closed" | "open" | "half"
      brPay: this.brPay.state,
      // Zahlung mit Versuchen (Retries), req/s im 1-s-Mittel
      failC: a.failC, // endgültig gescheitert (in lostC)
      tryP: a.tryP, // Versuche am Zahlungsdienst
      firstP: a.firstP, // davon Erstversuche
      retryP: a.retryP, // davon Retries
      wasteP: a.wasteP, // vom Anbieter bearbeitet, niemand wartet mehr
      deniedP: a.deniedP, // vom Budget verweigerte Retries
      payCap: this.payCap, // req/s Kapazität des Zahlungsdienstes jetzt
      brown: a.brown > 0, // Brownout in dieser Sekunde
      // Mailversand (spitzen; sonst 0): Mails/s im 1-s-Mittel, Queue jetzt
      resMail: this.resM,
      ovMail: this.ov.mail ?? "ok",
      utilMail: a.utilM / k,
      mailIn: a.mailIn, // angekommen (je bediente Zahlung)
      mailSent: a.mailSent, // verschickt
      mailLost: a.mailLost, // verloren (Abbruch, Puffer voll oder zu alt)
      mailQ: this.mq + this.mqBg, // Mails in Queue bzw. Puffer (mit Rest)
      mailWait: this._waitMail(), // s: Verzögerung einer Mail jetzt
      mailCap: this.mailCap,
      wave: this.waveX, // Form der Welle (Blitzangebot), 0 … 1
      // Bot-Ansturm (bots; sonst 0): req/s im 1-s-Mittel. Kunden = Klasse B
      // ohne den Bot
      botIn: a.arrBot, // Bot-Anfragen (vor dem Rate Limit)
      botOk: a.okBot, // davon rechtzeitig
      botRej: a.rejBot, // früh abgewiesen (429, Admission, Shedding, 503)
      botLost: a.lostBot, // verloren
      custDemB: a.k ? a.arrB - a.arrBot : this.aB - this.aBot, // Kundenseiten (Nachfrage)
      custOkB: a.okB - a.okBot, // Kundenseiten rechtzeitig
      adm: a.adm, // von Admission Control abgewiesen (alle Klassen)
      admOn: this.cm.admission, // Admission Control an
      io: a.io > 0, // erzwungener IO-Schub der Nachbar-VM in dieser Sekunde
      // Produktseiten/s, die die DB jetzt schafft (bei den Kosten je Seite
      // jetzt — Feature Shedding, Cache, Batching machen sie billiger)
      invPages: this.invCapE / this.cB,
      nbPhase: this.phaseNow, // Wahrheit: "idle" | "cpu" | "io"
      nbAffects: !this.cm.isolate,
      webSteal: this._stealPct(), // Gast-Sicht
      dbAwaitMs: DB_AWAIT_BASE_MS * this.awaitM,
      nRun: this.nRun,
      nStart: this.nStarting,
      marks: this._marks.length ? this._marks : null, // set()-Schlüssel dieser Sekunde
      env: [this.zW, this.zI, this.zP, this.zA], // OU-Zustand (Determinismus-Test)
      c: { ...this.c }, // kumulierte Zähler (summarize)
    };
    this._marks = [];
    this._acc = this._zeroAcc();
    this.hist[this.hHead] = sample;
    this.hHead = (this.hHead + 1) % HIST_MAX;
    if (this.hCount < HIST_MAX) this.hCount++;
    this.lastSample = sample;
  }

  get histLen() {
    return this.hCount;
  }

  /** i = 0 älteste … histLen − 1 neueste Probe. */
  histAt(i) {
    return this.hist[(this.hHead - this.hCount + i + HIST_MAX * 2) % HIST_MAX];
  }

  /** Proben im Rollfenster [t − windowS, t], älteste zuerst (fürs Zeichnen). */
  history(windowS = this.p.windowS) {
    const out = [];
    const tMin = this.t - windowS;
    for (let i = 0; i < this.hCount; i++) {
      const s = this.histAt(i);
      if (s.t >= tMin) out.push(s);
    }
    return out;
  }

  _sampleAt(t) {
    const newest = this.histAt(this.hCount - 1);
    const oldest = this.histAt(0);
    const ti = Math.max(oldest.t, Math.min(newest.t, Math.floor(t + 1e-9)));
    return this.histAt(this.hCount - 1 - (newest.t - ti));
  }

  /** Kennzahlen zwischen zwei vollen Sekunden (aus kumulierten Zählern). */
  summarize(t0, t1) {
    const a = this._sampleAt(t0);
    const b = this._sampleAt(t1);
    const d = Math.max(1e-9, b.t - a.t);
    const D = (k) => b.c[k] - a.c[k];
    const over = {
      web: D("overWeb") / d,
      inv: D("overInv") / d,
      pay: D("overPay") / d,
    };
    const knapp = {
      web: D("knappWeb") / d,
      inv: D("knappInv") / d,
      pay: D("knappPay") / d,
    };
    if (this.p.mail) {
      over.mail = D("overMail") / d;
      knapp.mail = D("knappMail") / d;
    }
    let dominant = "web";
    for (const s of this.stations) if (knapp[s] > knapp[dominant]) dominant = s;
    const retryStats = this._retryStats(a, b, d, D);
    return {
      t0: a.t,
      t1: b.t,
      dur: b.t - a.t,
      shifts: D("shifts"),
      knappShifts: D("knappShifts"),
      shiftsInStrike: D("shiftsInStrike"),
      strikes: D("strikes"),
      strikeHits: D("strikeHits"),
      murphyFallbacks: D("murphyFallbacks"),
      engpassZeit: D("engpass") / d,
      overShare: over,
      knappShare: knapp,
      dominant,
      load: D("load") / d,
      okBrowse: D("okB") / d,
      okCheckout: D("okC") / d,
      rejected: (D("shed") + D("r503") + D("r429")) / d,
      shed: D("shed") / d,
      r503: D("r503") / d,
      r429: D("r429") / d,
      lost: D("lost") / d,
      abandoned: D("abandoned") / d,
      waste: D("waste") / d,
      // je Klasse (B = Produktseite, C = Checkout), req/s
      rejectedB: (D("shedB") + D("r503B") + D("r429B")) / d,
      rejectedC: (D("shedC") + D("r503C") + D("r429C")) / d,
      shedB: D("shedB") / d,
      shedC: D("shedC") / d,
      r503B: D("r503B") / d,
      r503C: D("r503C") / d,
      r429B: D("r429B") / d,
      r429C: D("r429C") / d,
      lostB: D("lostB") / d,
      lostC: D("lostC") / d,
      abandonedB: D("abandonedB") / d,
      abandonedC: D("abandonedC") / d,
      wasteB: D("wasteB") / d,
      wasteC: D("wasteC") / d,
      r504B: D("r504B") / d,
      r504C: D("r504C") / d,
      // Ankünfte je Klasse, req/s (was ankäme, wenn nichts abgewiesen würde)
      arrivals: {
        browse: D("arrB") / d,
        checkout: D("arrC") / d,
      },
      // rechtzeitige Produktseiten ohne Empfehlungen (Timeout, Breaker), req/s
      degraded: D("degB") / d,
      // dito, dazu Feature Shedding — was der Kunde sieht, req/s
      withoutRec: D("noRecB") / d,
      // mittlere Wartezeit einer gestarteten Seite auf die Empfehlungen [s]
      recWait: D("startB") > 1e-9 ? D("recWaitB") / D("startB") : 0,
      tripsRec: D("tripsRec"),
      tripsPay: D("tripsPay"),
      // Zahlung mit Versuchen: req/s, Verstärkung = Versuche je Erstversuch
      // und Spitze der Retries (1-s-Probe) zu ihrem Mittel im Fenster
      failC: D("failC") / d,
      ...retryStats,
      // Nachfrage und Durchsatz je Station, req/s (Durchsatz: web gestartet,
      // inv von der DB fertig bearbeitet, pay vom Zahlungsdienst bearbeitet)
      demand: {
        web: D("demWeb") / d,
        inv: D("demInv") / d,
        pay: D("demPay") / d,
      },
      throughput: {
        web: D("thrWeb") / d,
        inv: D("thrInv") / d,
        pay: D("thrPay") / d,
      },
      util: {
        web: D("utilWeb") / d,
        inv: D("utilInv") / d,
        pay: D("utilPay") / d,
      },
      // geschätzte Latenz beim Start, Zeitmittel [s]
      latency: {
        browse: D("latB") / d,
        checkout: D("latC") / d,
      },
      // Mailversand (spitzen): Mails/s, größte Verzögerung im Fenster
      mail: this._mailStats(a, b, d, D),
      // Bot-Ansturm (bots): der Bot und die Kunden getrennt, req/s
      ...this._botStats(D, d),
      admission: D("adm") / d, // von Admission Control abgewiesen
      ioShare: D("io") / d, // Anteil der Zeit im erzwungenen IO-Schub
    };
  }

  /* Bot und Kunden zwischen zwei Proben (req/s). Der Bot ist Teil der
   * Klasse B; Kunden = alles ohne ihn (Produktseiten und Checkouts),
   * Kundenseiten = Klasse B ohne ihn. Ohne Bot ist er 0. */
  _botStats(D, d) {
    // Differenzen von Summen: Rundungsreste unter 0 kappen
    const r = (x) => Math.max(0, x / d);
    const rejB = D("shedB") + D("r503B") + D("r429B");
    const rejC = D("shedC") + D("r503C") + D("r429C");
    const bot = {
      arrivals: r(D("arrBot")),
      ok: r(D("okBot")),
      rejected: r(D("rejBot")),
      r429: r(D("r429B")),
      lost: r(D("lostBot")),
    };
    const pages = {
      arrivalsB: r(D("arrB") - D("arrBot")),
      okB: r(D("okB") - D("okBot")),
      rejectedB: r(rejB - D("rejBot")),
      lostB: r(D("lostB") - D("lostBot")),
    };
    return {
      bot,
      customers: {
        ...pages,
        arrivals: pages.arrivalsB + r(D("arrC")),
        ok: pages.okB + r(D("okC")),
        rejected: pages.rejectedB + r(rejC),
        lost: pages.lostB + r(D("lostC")),
      },
    };
  }

  /* Mailversand zwischen den Proben a und b: Mails/s (angekommen,
   * verschickt, verloren), Anteil verloren, größte Verzögerung einer Mail
   * (1-s-Proben), Nachfrage und Auslastung. Ohne Mailversand alles 0. */
  _mailStats(a, b, d, D) {
    let maxWait = 0;
    let maxQ = 0;
    if (this.p.mail)
      for (let i = this.hCount - 1; i >= 0; i--) {
        const s = this.histAt(i);
        if (s.t < a.t) break;
        if (s.t > b.t) continue;
        if (s.mailWait > maxWait) maxWait = s.mailWait;
        if (s.mailQ > maxQ) maxQ = s.mailQ;
      }
    const inM = D("mailIn");
    return {
      in: inM / d,
      sent: D("mailSent") / d,
      lost: D("mailLost") / d,
      lostShare: inM > 1e-9 ? D("mailLost") / inM : 0,
      maxWait, // s
      maxQueue: maxQ, // Mails
      demand: D("demMail") / d,
      util: D("utilMail") / d,
    };
  }

  /* Retries am Zahlungsdienst zwischen den Proben a und b: Versuche,
   * Verstärkung (Versuche / Erstversuche) und Spitze-zu-Mittel der Retries
   * über die 1-s-Proben (Wellen vs. glatt). */
  _retryStats(a, b, d, D) {
    let peak = 0;
    let sum = 0;
    let cnt = 0;
    for (let i = this.hCount - 1; i >= 0; i--) {
      const s = this.histAt(i);
      if (s.t <= a.t) break;
      if (s.t > b.t) continue;
      const r = s.retryP ?? 0;
      if (r > peak) peak = r;
      sum += r;
      cnt++;
    }
    const mean = cnt ? sum / cnt : 0;
    const first = D("firstP");
    return {
      tries: D("tryP") / d, // Versuche/s am Zahlungsdienst
      firsts: first / d, // Erstversuche/s
      retries: D("retryP") / d, // Retries/s
      payWaste: D("wasteP") / d, // bearbeitet, aber niemand wartet mehr
      retryDenied: D("deniedP") / d, // vom Budget verweigert
      amp: first > 1e-9 ? D("tryP") / first : 1, // Versuche je Erstversuch
      retryPeak: peak, // req/s: größte 1-s-Probe der Retries
      retryPeakRatio: mean > 1e-9 ? peak / mean : 0, // Spitze / Mittel
      brownout: D("brownout") / d, // Anteil der Zeit im Brownout
    };
  }

  /** Kumulierte Zähler seit t = 0 (Kopie). */
  get stats() {
    return { t: this.t, ...this.c };
  }

  /* ---------- Beobachtung ---------- */

  /* %steal eines Gasts: gestohlener Anteil (Nachbar auf demselben Host) plus
   * Grundrauschen — beides zählt nur, wenn der Gast rechnen will (runnable,
   * nicht idle). IO-Wartezeit ist idle, also nie steal. */
  _stealPctOf(steal, util) {
    return (100 * steal + STEAL_BASE_PCT) * Math.min(1, util / 0.5);
  }
  _stealPct() {
    return this._stealPctOf(this.steal, this.f.utilW);
  }

  /* Laufende oder letzte Störung: { t0, t1, phase } — phase "brownout",
   * "danach" (seit dem Neustart) oder "geplant"; null ohne Störung. */
  _incidentNow() {
    const t = this.t;
    let cur = null;
    for (const inc of this.incidents) if (inc.t0 <= t + 1e-9) cur = inc;
    if (!cur) {
      const next = this.incidents.find((i) => i.t0 > t + 1e-9);
      return next ? { t0: next.t0, t1: next.t1, phase: "geplant" } : null;
    }
    return {
      t0: cur.t0,
      t1: cur.t1,
      phase: t < cur.t1 - 1e-9 ? "brownout" : "danach",
    };
  }

  snapshot() {
    const cm = this.cm;
    const f = this.f;
    const ls = this.lastSample;
    const w = {
      web: this._waitWeb(),
      inv: this._waitInv(),
      pay: this._waitPay(),
      mail: this._waitMail(),
    };
    const mixReq = this.aB + this.aC;
    const avgE =
      mixReq > 0 ? (this.aB * this.cB + this.aC * this.cC) / mixReq : this.cB;
    const badge = (s) =>
      s === this.knapp
        ? this.bottleneck === s
          ? "engpass"
          : "knappste"
        : null;
    // Threads: gehalten von Requests in DB und Zahlung, von Seiten, die auf
    // die Empfehlungen warten (bremst die Starts), und von Requests auf der
    // Web-CPU (nur Anzeige). Mit Bulkheads je Pool.
    let pqT = this.retryLayer ? this.payHeld : this.pq;
    if (this.p.mail && !cm.smoothing) pqT += this.mq; // synchron: Kunde wartet
    const inflight = this.dbNB + this.dbNC + pqT + this.recN;
    const busy = Math.min(this.threads, inflight + this.webOnCpu);
    // Pools (nur Anzeige): dazu die Basislatenzen der laufenden Requests
    // (Little: Starts/s × Basislatenz), sonst stünde die Kasse bei 0 %
    const poolMaxC = BULKHEAD_CHECKOUT * this.threads;
    const baseB = (f.sB / DT) * (WEB_LAT_S + DB_LAT_S);
    const baseC = (f.sC / DT) * (WEB_LAT_S + DB_LAT_S + PAY_LAT_S);
    const pools = cm.bulkhead
      ? {
          browse: {
            busy: Math.min(
              this.threads - poolMaxC,
              this.dbNB + this.recN + baseB,
            ),
            max: this.threads - poolMaxC,
          },
          checkout: {
            busy: Math.min(poolMaxC, this.dbNC + pqT + baseC),
            max: poolMaxC,
          },
        }
      : null;
    // Welcher Pool ist (fast) voll? „alle“ = gemeinsamer Pool
    const blockedPool = pools
      ? pools.browse.busy >= pools.browse.max * 0.95
        ? "seiten"
        : pools.checkout.busy >= pools.checkout.max * 0.95
          ? "kasse"
          : null
      : inflight >= this.threads * 0.95
        ? "alle"
        : null;
    const win = this.summarize(this.t - this.p.windowS, this.t);
    const nbMode = cm.nb;
    const phase = this.phaseNow;
    return {
      t: this.t,
      n: this.n,
      scenario: this.scenario,
      variant: this.variant,
      cm: { ...cm },
      load: {
        total: this.L, // req/s Gesamtnachfrage (Lastknoten)
        nominal: this.Lnom,
        wave: this.waveX, // Blitzangebot: Form der Welle jetzt, 0 … 1 (spitzen)
        dauer: this.dauerAt !== null && this.t >= this.dauerAt - 1e-9,
        browse: this.aB,
        checkout: this.aC,
        bot: this.aBot, // req/s Bot-Anfragen jetzt (in browse enthalten; bots)
        shed: ls.shed, // req/s (1-s-Mittel)
        r503: ls.r503,
        r429: ls.r429,
        adm: ls.adm, // davon Admission Control (in r503)
      },
      stations: {
        web: {
          cap: this.webCapEff, // req/s: min(CPU, was die Threads tragen)
          capCpu: this.webCap, // req/s CPU allein
          capNominal: this.webNom,
          demand: this.dW,
          reserve: this.resW,
          util: f.utilW,
          queue: this.eb + this.ec, // req in der Eingangs-Queue
          queueMax: this.edgeBounded ? this.ebMax + this.ecMax : null,
          wait: w.web, // s
          overload: this.ov.web,
          badge: badge("web"),
          throttling: false,
          // blockiert: Downstream (DB, Zahlung, Empfehlungen) hält fast alle
          // Threads (eines Pools)
          blocked: blockedPool !== null,
          blockedPool, // "alle" | "seiten" | "kasse" | null
          threads: {
            busy, // inkl. Requests auf der Web-CPU
            max: this.threads,
            perInstance: this.p.threadsPer,
            waitRec: this.recN, // davon warten auf die Empfehlungen
            pools, // mit Bulkheads: { browse, checkout } je { busy, max }
          },
          instances: {
            running: this.nRun,
            starting: this.nStarting,
            warmPct: Math.round(this.warm * 100),
          },
        },
        inv: {
          cap: this.invCapE / avgE, // req/s beim aktuellen Mix
          capNominal: this.invNomE / avgE,
          demand: this.dIR,
          capE: this.invCapE, // E/s
          demandE: this.dIE,
          reserve: this.resI,
          util: f.utilI,
          queue: this.dbNB + this.dbNC,
          queueMax: cm.bpInv ? (DB_PERMIT_S * this.invCapE) / avgE : null,
          wait: w.inv,
          overload: this.ov.inv,
          badge: badge("inv"),
          throttling: this.permLimited.inv,
          recoShare: cm.featureShed
            ? 0
            : (this.aB * this.recoE) / Math.max(1e-9, mixReq * avgE),
          // Kosten je Klasse [E] und Arbeit reduzieren (Cache, Batching)
          costPage: this.cB,
          costCheckout: this.cC,
          recoE: this.recoE,
          cacheHit: cm.cache && !cm.featureShed ? CACHE_HIT : 0,
          batchK: this.batchK, // Abfragen je Bündel (1 = ungebündelt)
          batchLatS: cm.batch ? BATCH_LAT_S : 0,
          // Nachbar-VM am Storage: Disk-await-Faktor, Kapazitätsfaktor; ein
          // erzwungener IO-Schub (bots) gerade aktiv?
          awaitMult: this.awaitM,
          capFactor: 1 / (1 - DB_IO_SHARE + DB_IO_SHARE * this.awaitM),
          ioBurst: this.ioNow,
          // Anteil des Bots an der Nachfrage der DB (Arbeit; bots)
          botShare:
            this.dBot > 0 && this.dIE > 0
              ? (this.dBot * this.cB) / this.dIE
              : 0,
        },
        pay: {
          cap: this.payCap,
          capNominal: PAY_CAP,
          demand: this.dP,
          reserve: this.resP,
          util: f.utilP,
          queue: this.pq,
          queueMax: cm.bpPay ? PAY_PERMIT_S * this.payCap : null,
          wait: w.pay,
          overload: this.ov.pay,
          badge: badge("pay"),
          throttling: this.permLimited.pay,
          breaker: cm.breaker ? this.brPay.state : null,
          capFactor: this.payF, // < 1 im Brownout
          brownout: this.payF < 1,
        },
        // Mailversand nur im Szenario mit Mail (spitzen)
        ...(this.p.mail
          ? {
              mail: {
                cap: this.mailCap, // Mails/s jetzt
                capNominal: MAIL_CAP,
                rate: this.mailRate, // Mails/s geglättet (Alter der Queue)
                // asynchron: geglätteter Zufluss (Puffer), sonst jetzt
                demand: this.dM,
                demandNow: this.dMi,
                reserve: this.resM,
                util: f.utilM,
                queue: this.mq + this.mqBg,
                queueMax: this._mailQMax(),
                wait: w.mail, // s: Verzögerung einer Mail, die jetzt ankommt
                overload: this.ov.mail,
                badge: badge("mail"),
                throttling: false,
                mode: cm.smoothing ? "async" : "sync",
                in: ls.mailIn, // Mails/s (1-s-Mittel)
                sent: ls.mailSent,
                lost: ls.mailLost,
              },
            }
          : {}),
      },
      // Zahlung mit Versuchen (Retries): Zustand jetzt; Raten im 1-s-Mittel
      retry: {
        layer: this.retryLayer,
        mode: cm.retry,
        budget: cm.retryBudget,
        tokens: this.retryTokens,
        timeoutS: this.payTC, // Timeout eines Versuchs beim Client
        maxAttempts: cm.retry === "aus" ? 1 : RETRY_MAX_ATTEMPTS,
        tries: ls.tryP, // req/s Versuche am Zahlungsdienst
        firsts: ls.firstP,
        retries: ls.retryP,
        waste: ls.wasteP, // req/s bearbeitet, aber niemand wartet mehr
        denied: ls.deniedP,
        failShare: this.payPF, // Anteil der jetzt gesendeten, die scheitern
        held: this.payHeld, // Checkouts in der Zahlung beim Shop
        backoff: this.rqSum, // davon im Backoff
        orphaned: this.pqOrph, // beim Anbieter, niemand wartet mehr
        incident: this._incidentNow(),
      },
      rec: {
        on: !cm.featureShed,
        cached: cm.cache && !cm.featureShed, // Funktion bleibt, aus dem Cache
        cap: REC_CAP,
        demand: cm.featureShed ? 0 : this.dRec, // nur Produktseiten (Fehltreffer, Breaker)
        latS: this.recLat, // Antwortzeit des Dienstes jetzt
        baseS: REC_LAT_S,
        waitS: this.recWait, // was eine aufrufende Seite wartet (Timeout)
        timedOut: cm.timeouts && this.recLat > REC_TIMEOUT_S,
        callShare: this.recCall, // Anteil der Seiten mit Aufruf
        degShare: this.recDeg, // Anteil der Seiten ohne Empfehlungen
        breaker: cm.breaker ? this.brRec.state : null,
      },
      outcome: {
        okBrowse: ls.okB, // req/s rechtzeitig
        okCheckout: ls.okC,
        rejected: ls.shed + ls.r503 + ls.r429, // früh abgewiesen, ohne Arbeit
        lost: ls.lost, // aufgegeben + zu spät
        waste: ls.waste, // zu spät beantwortet = verschwendete Arbeit
        // je Klasse (B = Produktseite, C = Checkout), 1-s-Mittel
        rejectedB: ls.shedB + ls.r503B + ls.r429B,
        rejectedC: ls.shedC + ls.r503C + ls.r429C,
        // Bot (bots; Teil von B): rechtzeitig, abgewiesen, verloren
        okBot: ls.botOk,
        rejectedBot: ls.botRej,
        lostBot: ls.botLost,
        shedB: ls.shedB,
        shedC: ls.shedC,
        r503B: ls.r503B,
        r503C: ls.r503C,
        r429B: ls.r429B,
        r429C: ls.r429C,
        lostB: ls.lostB,
        lostC: ls.lostC,
        wasteB: ls.wasteB,
        wasteC: ls.wasteC,
      },
      latency: { browse: this.latB, checkout: this.latC }, // s, beim Start geschätzt
      // Bot-Ansturm (bots): der Bot und die Kunden, Rate Limit, Admission —
      // Raten im 1-s-Mittel; ohne Bot null
      bots: this.p.bot
        ? {
            rate: this.aBot, // req/s Bot-Anfragen jetzt
            rateLimit: cm.rateLimit,
            rlRate: RL_RATE, // req/s je Client
            tokens: this.rlTokens,
            admission: cm.admission,
            admRps: ADMISSION_RPS, // statisches globales Limit
            ok: ls.botOk,
            rejected: ls.botRej,
            r429: ls.r429,
            lost: ls.botLost,
            custOkB: ls.custOkB, // Kundenseiten rechtzeitig
            custDemB: ls.custDemB, // Kundenseiten (Nachfrage)
            invPages: ls.invPages, // Produktseiten/s, die die DB jetzt schafft
          }
        : null,
      hosts: {
        web: {
          stealPct: this._stealPct(),
          cpuPct: 100 * f.utilW * (1 - this.steal),
        },
        db: {
          awaitMs: DB_AWAIT_BASE_MS * this.awaitM,
          iowaitPct: IOWAIT_BASE_PCT + 30 * (this.awaitM - 1) * f.utilI,
          // eigener Host ohne CPU-Nachbarn: nur Grundrauschen, solange die DB
          // rechnet — der Nachbar teilt mit ihr nur das Storage
          stealPct: this._stealPctOf(0, f.utilI),
        },
      },
      hidden: {
        mode: nbMode,
        phase, // "idle" | "cpu" | "io"
        target: phase === "cpu" ? "web" : phase === "io" ? "inv" : null,
        affects: !cm.isolate,
        nbCpuPct:
          phase === "cpu"
            ? 100 * (nbMode === "murphy" ? NB_STEAL_MAX : this.nbSteal)
            : 3,
        nbIoMBs:
          phase === "io"
            ? Math.round(
                400 *
                  ((nbMode === "murphy" || this.ioNow
                    ? NB_AWAIT_MAX
                    : this.nbAwait) -
                    1),
              )
            : 5,
        forced: this.ioNow, // erzwungener IO-Schub (bots)
      },
      bottleneck: this.bottleneck,
      knappste: this.knapp,
      overloaded: { ...this.ov },
      shifts: this.c.shifts,
      knappShifts: this.c.knappShifts,
      engpassZeit: this.t > 0 ? this.c.engpass / this.t : 0,
      win, // dieselben Kennzahlen über das Rollfenster des Szenarios
    };
  }
}

/** Lauf aus Seed, Szenario und set()-Log bitgenau bis Schritt n nachrechnen. */
export function replay(seed, scenarioKey, log, n, overrides = {}) {
  const sim = new BottleneckSim(seed, scenarioKey, overrides);
  for (const e of log) {
    sim.runSteps(e.n - sim.n);
    if (e.event) sim.trigger(e.event, e.at);
    else sim.set(e.patch);
  }
  sim.runSteps(n - sim.n);
  return sim;
}

/* ===== Eigene Fragen im Drehbuch (step.ask) ===== */

export const TIP_WINDOW_S = 10; // s: Kennzahlen der Antwort, Mittel davor
export const TIP_OK_SHARE = 0.8; // „laufen“ / „schnell“: ≥ 80 % rechtzeitig
/** Ausgänge je Frage-Art, in der Reihenfolge der Tipp-Knöpfe (2 × 2).
 *  checkout: Was passiert mit den Checkouts?
 *  browse:   Was zeigen die Produktseiten?
 *  recWait:  Wie lange wartet eine Seite auf die Empfehlungen? */
export const ASK_KINDS = {
  checkout: ["laufen", "haengen", "abgewiesen", "kasse"],
  browse: ["haengen", "degradiert", "fehler", "normal"],
  recWait: ["lang", "timeout", "keine", "kurz"],
  retryShape: ["wellen", "glatt", "wenige", "keine"],
  payLoad: ["x3", "x2", "x11", "x1"],
  kunden: ["warten", "sofort", "teils", "klappt"],
  mails: ["sofort", "verspaetet", "verloren", "kasse"],
  wen: ["bot", "beide", "kunden", "keiner"],
  seiten: ["laden", "teils", "abgewiesen", "warten"],
};
/* Retry-Fragen: Schwellen. Wellen = größte 1-s-Probe der Retries mindestens
 * RETRY_WAVE_RATIO-mal ihr Mittel — nach dem Neustart, ohne dessen erste
 * RETRY_WAVE_SKIP_S (dort trifft der Neustart selbst jeden Modus, auch den
 * mit Jitter, als Buckel); „wenige“ = höchstens RETRY_FEW_SHARE
 * Retries je Erstversuch (Budget); Verstärkung (Versuche je Erstversuch)
 * ≥ 2,5 „≈ ×3“, ≥ 1,5 „≈ ×2“, ≥ 1,02 „≈ ×1,1“, sonst „×1“. */
export const RETRY_WAVE_RATIO = 1.6;
export const RETRY_WAVE_SKIP_S = 2; // Wellen erst ab 2 s nach dem Neustart messen
export const RETRY_FEW_SHARE = 0.15;
export const AMP_X3 = 2.5;
export const AMP_X2 = 1.5;
export const AMP_X11 = 1.02;

/**
 * Beobachteter Ausgang einer eigenen Frage — über die letzten TIP_WINDOW_S
 * vor sim.t (wie die Auflösung in UI und playScript):
 *  checkout: ≥ TIP_OK_SHARE der Checkouts rechtzeitig → „laufen“; sonst
 *    Kasse überlastet → „kasse“; sonst mehr abgewiesen als verloren →
 *    „abgewiesen“, sonst „haengen“ (zu spät, aufgegeben).
 *  browse: ≥ TIP_OK_SHARE der Seiten rechtzeitig → mindestens die Hälfte
 *    davon ohne Empfehlungen (auch Feature Shedding) „degradiert“, sonst
 *    „normal“; sonst mehr
 *    Fehlerantworten (früh abgewiesen, 504) als hängende → „fehler“, sonst
 *    „haengen“.
 *  recWait: mittlere Wartezeit einer gestarteten Seite auf die Empfehlungen
 *    ≥ 1 s „lang“, ≥ ½ REC_TIMEOUT_S „timeout“, ≥ ½ REC_LAT_S „kurz“, sonst
 *    „keine“ (Breaker offen: kein Aufruf).
 * Retry-Fragen (Szenario `retry`) — über die ganze letzte Störung, von
 * ihrem Beginn bis sim.t (ohne Störung: die letzten TIP_WINDOW_S):
 *  retryShape: Wie kommen die Retries beim Zahlungsdienst an? Fast keine
 *    (< 1 % der Erstversuche) „keine“; höchstens RETRY_FEW_SHARE „wenige“;
 *    Spitze ≥ RETRY_WAVE_RATIO × Mittel „wellen“, sonst „glatt“ — nach dem
 *    Neustart ab RETRY_WAVE_SKIP_S, im Brownout seit dessen Beginn.
 *  payLoad: Versuche je Erstversuch (Verstärkung), Schwellen AMP_*.
 *  kunden: Was sehen Kunden an der Kasse? ≥ TIP_OK_SHARE der Checkouts
 *    rechtzeitig „klappt“; sonst mehr sofort abgewiesen als gescheitert
 *    „sofort“; sonst mindestens 30 % rechtzeitig „teils“, sonst „warten“
 *    (Fehler erst nach Timeouts und Retries).
 * Mail-Frage (Szenario `spitzen`) — über die letzte Angebotsperiode
 * (MAIL_TIP_WINDOW_S), damit sie nicht an der Phase der Welle hängt:
 *  mails: Was passiert mit den Bestätigungsmails? Mehr als MAIL_LOST_SHARE
 *    verloren „verloren“; sonst keine länger als MAIL_LATE_S verzögert
 *    „sofort“; sonst kamen weniger als TIP_OK_SHARE der Checkouts
 *    rechtzeitig — die Kasse wartet auf die Mail — „kasse“, sonst
 *    „verspaetet“ (später, aber alle).
 * Bot-Fragen (Szenario `bots`) — über die letzten TIP_WINDOW_S:
 *  wen: Wen trifft das Abweisen? Getroffen ist, wer mindestens WEN_SHARE
 *    seiner Anfragen früh abgewiesen bekommt (429, 503, Shedding) — die
 *    Kunden (Seiten und Checkouts) bzw. der Bot: „beide“, „bot“, „kunden“,
 *    sonst „keiner“.
 *  seiten: Was sehen Kunden auf den Produktseiten? ≥ TIP_OK_SHARE
 *    rechtzeitig „laden“; sonst mehr sofort abgewiesen als verloren:
 *    mindestens TIP_PART_SHARE rechtzeitig „teils“, sonst „abgewiesen“;
 *    sonst „warten“ (zu spät, aufgegeben — Fehler nach Warten).
 */
/** Spitze / Mittel der Retries (1-s-Proben) seit der letzten Störung: nach
 * dem Neustart ab RETRY_WAVE_SKIP_S, im Brownout seit seinem Beginn; ohne
 * Störung über die letzten TIP_WINDOW_S. 0 ohne Retries. */
export function retryWaveRatio(sim) {
  const inc = sim._incidentNow();
  let t0 = Math.max(0, sim.t - TIP_WINDOW_S);
  if (inc && inc.phase === "brownout") t0 = inc.t0;
  else if (inc && inc.phase === "danach")
    t0 = Math.min(inc.t1 + RETRY_WAVE_SKIP_S, sim.t - 1);
  return sim.summarize(t0, sim.t).retryPeakRatio;
}

export function observeTip(sim, kind) {
  if (kind === "mails") {
    const m = sim.summarize(Math.max(0, sim.t - MAIL_TIP_WINDOW_S), sim.t);
    if (m.mail.lostShare > MAIL_LOST_SHARE) return "verloren";
    if (m.mail.maxWait < MAIL_LATE_S) return "sofort";
    return m.okCheckout < TIP_OK_SHARE * m.arrivals.checkout
      ? "kasse"
      : "verspaetet";
  }
  if (kind === "retryShape" || kind === "payLoad" || kind === "kunden") {
    const inc = sim._incidentNow();
    const t0 =
      inc && inc.phase !== "geplant"
        ? inc.t0
        : Math.max(0, sim.t - TIP_WINDOW_S);
    const r = sim.summarize(t0, sim.t);
    if (kind === "retryShape") {
      const share = r.firsts > 1e-9 ? r.retries / r.firsts : 0;
      if (share < 0.01) return "keine";
      if (share <= RETRY_FEW_SHARE) return "wenige";
      return retryWaveRatio(sim) >= RETRY_WAVE_RATIO ? "wellen" : "glatt";
    }
    if (kind === "payLoad")
      return r.amp >= AMP_X3
        ? "x3"
        : r.amp >= AMP_X2
          ? "x2"
          : r.amp >= AMP_X11
            ? "x11"
            : "x1";
    const arr = r.arrivals.checkout;
    if (r.okCheckout >= TIP_OK_SHARE * arr) return "klappt";
    if (r.rejectedC > r.lostC) return "sofort";
    return r.okCheckout >= 0.3 * arr ? "teils" : "warten";
  }
  const s = sim.summarize(Math.max(0, sim.t - TIP_WINDOW_S), sim.t);
  if (kind === "wen") {
    const k = s.customers;
    const b = s.bot;
    const hitK = k.arrivals > 1e-9 && k.rejected >= WEN_SHARE * k.arrivals;
    const hitB = b.arrivals > 1e-9 && b.rejected >= WEN_SHARE * b.arrivals;
    return hitK && hitB ? "beide" : hitB ? "bot" : hitK ? "kunden" : "keiner";
  }
  if (kind === "seiten") {
    const k = s.customers;
    if (k.okB >= TIP_OK_SHARE * k.arrivalsB) return "laden";
    if (k.rejectedB > k.lostB)
      return k.okB >= TIP_PART_SHARE * k.arrivalsB ? "teils" : "abgewiesen";
    return "warten";
  }
  if (kind === "checkout") {
    if (s.okCheckout >= TIP_OK_SHARE * s.arrivals.checkout) return "laufen";
    if (sim.ov.pay !== "ok") return "kasse";
    return s.rejectedC > s.lostC ? "abgewiesen" : "haengen";
  }
  if (kind === "browse") {
    if (s.okBrowse >= TIP_OK_SHARE * s.arrivals.browse)
      return s.withoutRec >= 0.5 * s.okBrowse ? "degradiert" : "normal";
    const fehler = s.rejectedB + s.r504B;
    return fehler > s.lostB - s.r504B ? "fehler" : "haengen";
  }
  if (kind === "recWait") {
    const w = s.recWait;
    return w >= 1
      ? "lang"
      : w >= REC_TIMEOUT_S / 2
        ? "timeout"
        : w >= REC_LAT_S / 2
          ? "kurz"
          : "keine";
  }
  throw new Error(`unbekannte Frage: ${kind}`);
}

/**
 * Ein Drehbuch live durchspielen (ein Lauf, alle Schritte), wie die UI:
 * Vorlauf, dann je Schritt set(action) und Auflösung bei appliedAt + settle.
 * Ereignisse (step.event) löst er mit dem Zug aus, zur Zeit appliedAt.
 * Rückgabe je Schritt: erwartete und beobachtete Station, Überlastvektor,
 * Ausgang der eigenen Frage (`tip`, nur mit step.ask), Spitze / Mittel der
 * Retries nach dem Neustart (`wave`, retryWaveRatio), Kennzahlen der
 * letzten 20 s vor der Auflösung (`sum`; Szenarien im Sekundentakt:
 * SCENARIOS[k].figWindowS; höchstens seit dem Zug — ein kürzerer Schritt
 * mittelt nicht über den vorigen) und des ganzen Schritts von appliedAt bis
 * zur Auflösung (`full`).
 */
export function playScript(seed, scenarioKey, opts = {}) {
  const def = SCENARIOS[scenarioKey];
  const steps = opts.steps ?? SCRIPTS[scenarioKey];
  const sim = new BottleneckSim(seed, scenarioKey, opts.overrides ?? {});
  sim.runTo(def.prerollS);
  const out = [];
  let prev = null;
  for (const st of steps) {
    if (Object.keys(st.action).length) sim.set(st.action);
    const appliedAt = sim.t;
    if (st.event) sim.trigger(st.event, appliedAt);
    sim.runTo(appliedAt + st.settle);
    const expect = st.expect === "bleibt" ? prev : st.expect;
    prev = expect;
    const snap = sim.snapshot();
    out.push({
      key: st.key,
      appliedAt,
      expect,
      bottleneck: snap.bottleneck,
      overload: { ...snap.overloaded },
      overloadExpected: st.overload,
      tip: st.ask ? observeTip(sim, st.ask) : null,
      wave: retryWaveRatio(sim),
      sum: sim.summarize(
        Math.max(appliedAt, sim.t - (def.figWindowS ?? 20)),
        sim.t,
      ),
      full: sim.summarize(appliedAt, sim.t),
      snap,
    });
  }
  return { sim, steps: out };
}

/**
 * Start-Seed für die UI (bewusste Demo-Entscheidung, siehe Modulkopf).
 * Ursachen-Szenarien (CAUSE_ORDER): zieht Seeds aus rng, bis das erste
 * angezeigte Fenster — Vorlauf prerollS, Statistik wie snapshot().win —
 * mindestens minShifts Engpass-Wechsel zeigt; nach maxTries Versuchen der
 * Seed mit den meisten Wechseln. Andere Szenarien: der erste gezogene Seed.
 * Deterministisch bei gegebenem rng. Kosten je Versuch: prerollS · 10
 * Schritte (≈ 2 ms bei 600 s).
 *
 * @param scenarioKey Schlüssel aus SCENARIOS
 * @param rng         () => [0, 1), Default Math.random
 * @param opts        { overrides?, minShifts?, maxTries? } — overrides wie im
 *                    Konstruktor, damit die Prüfung die aktuellen Schalter sieht
 * @returns {number}  Seed
 */
export function pickStartSeed(scenarioKey, rng = Math.random, opts = {}) {
  const def = SCENARIOS[scenarioKey];
  if (!def) throw new Error(`unbekanntes Szenario: ${scenarioKey}`);
  const draw = () => Math.floor(rng() * 1e9) + 1;
  if (!CAUSE_ORDER.includes(scenarioKey)) return draw();
  const minShifts = opts.minShifts ?? START_MIN_SHIFTS;
  const maxTries = opts.maxTries ?? START_MAX_TRIES;
  let best = 0;
  let bestShifts = -1;
  for (let i = 0; i < maxTries; i++) {
    const seed = draw();
    const sim = new BottleneckSim(seed, scenarioKey, opts.overrides ?? {});
    sim.runTo(def.prerollS);
    const shifts = sim.summarize(sim.t - def.windowS, sim.t).shifts;
    if (shifts >= minShifts) return seed;
    if (shifts > bestShifts) {
      best = seed;
      bestShifts = shifts;
    }
  }
  return best;
}
