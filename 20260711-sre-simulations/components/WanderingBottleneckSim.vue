<script setup>
/**
 * WanderingBottleneckSim.vue — „Wandernde Engpässe“ im Online-Shop:
 * Last → Webserver → Bestandsprüfung (DB) → Zahlungsdienst (extern).
 * Sandbox mit Drehbuch, eine Komponente auf zwei Folien (Prop `variant`):
 *
 *  - "cause" (Deep-Link wandernde-engpaesse): konstante Last, der Engpass
 *    wandert trotzdem — durch eine verdeckte Nachbar-VM (ein Aufdecken-Knopf,
 *    Clip-Wipe) oder ganz ohne Auslöser („Nur Zufall“). Schalter: Murphy (nur
 *    Demo), Schutzkapazität an den Nicht-Engpässen, Eigener Host.
 *  - "remedies" (Deep-Link engpass-gegenmassnahmen): Presets in
 *    REMEDY_ORDER (Rabattaktion, Teure Abfragen …), je mit Drehbuch (Lage →
 *    Zug → Tipp → Auflösung bei appliedAt + settle) und Schalter-Leiste nach
 *    den sechs Grundrichtungen. Die Leiste zeigt die Auswahl des Szenarios
 *    (SCENARIOS[k].rail) plus alles Eingeschaltete und verteilt die Gruppen
 *    neu, wenn die feste Spaltenwahl nicht passt; alle Schalter stehen im ⚙
 *    („Alle Schalter zeigen“).
 *
 * Modell: lib/wanderingBottleneckModel.js (Flussmodell, geseedet, Vitest-
 * gepinnt; dieselbe Drehbuch-Zeitachse wie playScript()). Drehbuch-Texte mit
 * Längengrenzen: lib/wanderingBottleneckStepUi.js. Schalter ohne
 * implementierte Wirkung (CM_PHASE2) werden nicht gerendert.
 *
 * Pflichtregeln (siehe Plan): kein Fokus nach Zeigerbedienung (Klicker!),
 * keine Bedienelemente in der Nav-Zone unten links, rAF/Autoplay nur auf der
 * aktiven Folie im Kontext slide/presenter, Zustand nur pro Instanz.
 */
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  nextTick,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  useDarkMode,
  useIsSlideActive,
  useNav,
  useSlideContext,
} from "@slidev/client";
import Tabs from "@shared/components/Tabs.vue";
import SimShell from "./SimShell.vue";
import { useScopeColors } from "./lib/useScopeColors";
import { fmtDe as fmt } from "./lib/rng.js";
import {
  ABANDON_S,
  ADMISSION_RPS,
  BOT_429,
  BOT_DB_PCT,
  BOT_RATE,
  BOT_START_S,
  BOTS_DB_E,
  BOTS_LOAD,
  BOTS_PAGES,
  BOTS_RL_LOAD,
  INV_PAGES_PER_S_IO,
  IO_BURST_AWAIT,
  IO_BURST_S,
  N_WEB_BOTS,
  RL_BURST,
  RL_RATE,
  SHED_DB_BAND_S,
  SHED_DB_S,
  SHED_TARGET_S,
  BATCH_LAT_MS,
  BATCH_WINDOW_MS,
  BREAKER_CLOSE_S,
  BREAKER_OPEN_S,
  BREAKER_TAU_S,
  BREAKER_TRIP_PCT,
  BULKHEAD_CHECKOUT_PCT,
  BULKHEAD_REST_PCT,
  BottleneckSim,
  CACHE_HIT_PCT,
  CAUSE_ORDER,
  CM_DEFAULTS,
  COLLAPSE_WAIT_S,
  CONV_PCT,
  DB_AWAIT_BASE_MS,
  DB_TIMEOUT_S,
  DEADLINE_S,
  EMPF_CHECKOUTS,
  EMPF_LOAD,
  EMPF_PAGES,
  EMPF_THREADS_NEEDED,
  EMPF_THREADS_TIMEOUT,
  FUNNEL_TAU_S,
  HALF_ADMIT_PCT,
  HEADROOM_PCT,
  HYST,
  INV_AVAIL_E,
  INV_CAP_E,
  INV_OVERHEAD_E,
  INV_PAGE_E,
  INV_PAGES_PER_S,
  INV_PER_ITEM_E,
  INV_RECO_CACHED_E,
  INV_RECO_E,
  INV_RESERVE_E,
  LOAD_CAMPAIGN,
  LOAD_NORMAL,
  MAIL_CAP,
  MAIL_EXCESS,
  MAIL_GIVEUP_S,
  MAIL_LAT_S,
  MAIL_MAX_AGE_S,
  MAIL_Q_EFF,
  MAIL_Q_MAX,
  MAIL_SMOOTH_TAU_S,
  MAIL_WAVE_BACKLOG,
  MAIL_WAVE_DELAY_S,
  MURPHY_GAP_S,
  MURPHY_MAX_WAIT_S,
  MURPHY_STRIKE_S,
  NACHBAR_LOAD,
  NB_AWAIT_MAX,
  NB_AWAIT_MIN,
  NB_STEAL_MAX,
  NB_STEAL_MIN,
  N_WEB_CAUSE,
  N_WEB_EMPF,
  N_WEB_START,
  OU_TAU_S,
  PAY_BROWNOUT_PCT,
  PAY_BROWNOUT_S,
  PAY_CAP,
  PAY_GIVEUP_S,
  PAY_TIMEOUT_S,
  REC_LAT_MS,
  REC_SLOW_AT_S,
  REC_SLOW_S,
  REC_TIMEOUT_MS,
  REMEDY_ORDER,
  RES_MAX,
  RETRY_BASE_S,
  RETRY_BUDGET,
  RETRY_BUDGET_LOAD,
  RETRY_BUDGET_PCT,
  RETRY_CHECKOUTS,
  RETRY_LOAD,
  RETRY_MAX_ATTEMPTS,
  RETRY_START_S,
  RETRY_STORM_LOAD,
  RES_TAU_S,
  SCALE_COLD_S,
  SCALE_DETECT_S,
  SCALE_PREWARM_S,
  SCALE_REACTIVE_S,
  SCALE_TARGET,
  SCALE_WARMUP_S,
  SCALE_WARM_START_PCT,
  SCENARIOS,
  SCRIPTS,
  SCRIPT_FIGURES,
  SPITZEN_AVG,
  SPITZEN_BASE,
  SPITZEN_ON_S,
  SPITZEN_PAGES,
  SPITZEN_PEAK,
  SPITZEN_PERIOD_S,
  START_MAX_TRIES,
  START_MIN_SHIFTS,
  STATIONS,
  TEUER_LOAD,
  THREADS_EMPF,
  THREADS_EMPF_CHECKOUT,
  THREADS_EMPF_REST,
  THREADS_EMPF_TOTAL,
  WEB_PER_INSTANCE,
  ZUFALL_LOAD,
  observeTip,
  pickStartSeed,
  retryWaveRatio,
} from "./lib/wanderingBottleneckModel.js";
import { FAZIT, STEP_UI, TIP_SETS } from "./lib/wanderingBottleneckStepUi.js";

const props = defineProps({
  variant: { type: String, default: "cause" },
});

/* ===== 1 · UI-Texte ===== */

const isCause = props.variant !== "remedies";
const ORDER = isCause ? CAUSE_ORDER : REMEDY_ORDER;
const NAME = {
  web: "Webserver",
  inv: "Bestandsprüfung",
  pay: "Zahlungsdienst",
  mail: "Mailversand", // nur „Kurze Spitzen“
};
const SPEEDS = [1, 5, 20, 60];
const FF_S = 300; // ⏩ +5 min
const RM_STEP_S = 60; // reduzierte Bewegung: ▶ +1 min
const MIN_WAIT_S = 0.15; // darunter: Rest des 0,1-s-Fluss-Schritts, keine Queue
// Reihenfolge der Kette, mit Mailversand hinter der Kasse („läuft leer“)
const CHAIN = [...STATIONS, "mail"];
/* Drehbuch Schritt 0: Die Lage gilt VOR dem Lastsprung des Szenarios
 * (Aktionsstart, Newsletter); gefragt wird eine halbe Sekunde Wandzeit
 * davor — bei ×20 also 10 s Sim-Zeit, bei ×1 eine halbe. */
const loadStepT = (d) => (d.load.length > 1 ? d.load[1][0] : d.prerollS);
const ask0T = (d) => loadStepT(d) - 0.5 * d.tempo;
/* Wiederholte Störung (Retry-Sturm ab Schritt 1): Der Brownout ist schon
 * bekannt — er läuft im Zeitraffer BOOST_SPEED, bis BOOST_LEAD_S vor dem
 * Neustart; was neu ist (Wellen, Budget), wieder im gewählten Tempo. Nur
 * für Schritte, die nach dem Neustart auflösen (nicht den Breaker). */
const BOOST_SPEED = 5;
const BOOST_LEAD_S = 2;
const TABS = [
  { key: "sim", label: "Simulation" },
  { key: "explain", label: "Erklärung & Modell" },
];
const pct = (x) => Math.round(x * 100);

const SCEN_UI = {
  nachbar: {
    label: "Nachbar-VM (verdeckt)",
    title: `Konstant ${NACHBAR_LOAD} req/s, ${N_WEB_CAUSE} Webserver. Eine fremde VM teilt Host und Storage — von innen unsichtbar.`,
  },
  zufall: {
    label: "Nur Zufall",
    title: `Nachbar aus, konstant ${ZUFALL_LOAD} req/s, stärkere Eigenschwankungen: nur Zufall bei knappen Reserven — „Ein Auslöser ist nicht nötig“.`,
  },
  rabatt: {
    label: "Rabattaktion",
    title: `${LOAD_NORMAL} → ${fmt(LOAD_CAMPAIGN)} req/s bei ${N_WEB_START} Webservern; Drehbuch mit ${SCRIPTS.rabatt.length} Schritten.`,
    bilanzRef: "beim Aktionsstart",
  },
  spitzen: {
    label: "Kurze Spitzen",
    title: `Spitzen zeitlich verteilen: ${SPITZEN_PAGES} Produktseiten/s und ${SPITZEN_BASE} Checkouts/s; Blitzangebote bringen alle ${SPITZEN_PERIOD_S / 60} min für ${SPITZEN_ON_S} s ${SPITZEN_PEAK} Checkouts/s — im Mittel ${SPITZEN_AVG}. Die Bestätigungsmail geht synchron im Checkout raus, der Mailversand schafft ${MAIL_CAP}/s. Puffern & glätten, dann Dauerlast; Drehbuch mit ${SCRIPTS.spitzen.length} Schritten.`,
    bilanzRef: "in einer Spitze ohne Puffer",
    headline: "Wer wartet auf die Mail?",
  },
  teuer: {
    label: "Teure Abfragen",
    title: `Arbeit verwerfen / reduzieren: ${LOAD_NORMAL} → ${fmt(TEUER_LOAD)} req/s, die DB ist der Engpass — eine Produktseite kostet ${fmt(INV_PAGE_E, 1)} E, davon ${fmt(INV_RECO_E, 1)} E Empfehlungen. Scaling, Batching, Cache + Coalescing; Drehbuch mit ${SCRIPTS.teuer.length} Schritten.`,
    bilanzRef: "nach dem Newsletter",
  },
  empfehlung: {
    label: "Empfehlungen hängen",
    title: `Überlast isolieren / Verstärkung verhindern: konstant ${EMPF_LOAD} req/s (${EMPF_CHECKOUTS} davon Checkouts) auf ${N_WEB_EMPF} Webservern mit je ${THREADS_EMPF} Threads. Ab t = ${REC_SLOW_AT_S} s antwortet der Empfehlungsdienst nach ${fmt(REC_SLOW_S)} s statt ${REC_LAT_MS} ms. Bulkheads, Timeouts, Circuit Breaker; ein Vorfall im Sekundentakt, Echtzeit (×1); Drehbuch mit ${SCRIPTS.empfehlung.length} Schritten.`,
    bilanzRef: "im Hänger",
    headline: "Was legt die Kasse lahm?",
  },
  bots: {
    label: "Bot-Ansturm",
    title: `Zufluss bremsen: ${BOTS_LOAD} req/s Kunden auf ${N_WEB_BOTS} Webservern; ab t = ${BOT_START_S} s fragt ein Scraper-Bot — ein einziger Client — ${BOT_RATE} Produktseiten/s ab, jede so teuer für die DB wie eine Kundenseite. Load Shedding, Rate Limit je Client, Admission Control (statisch), dazu ein IO-Schub der Nachbar-VM, dann Back Pressure; Drehbuch mit ${SCRIPTS.bots.length} Schritten.`,
    bilanzRef: "beim Bot-Ansturm",
    headline: "Wen trifft das Abweisen?",
  },
  retry: {
    label: "Retry-Sturm",
    title: `Verstärkung verhindern: konstant ${RETRY_LOAD} req/s (${RETRY_CHECKOUTS} davon Checkouts) gegen einen Zahlungsdienst mit ${PAY_CAP}/s. Ab t = ${RETRY_START_S} s eine Störung: ${PAY_BROWNOUT_S} s Brownout auf ${PAY_BROWNOUT_PCT} %, dann Neustart — alle offenen Aufrufe brechen ab. Der Checkout versucht es bis zu ${RETRY_MAX_ATTEMPTS}-mal, erst sofort, dann mit Backoff, Jitter, Budget und Breaker; jeder Schritt spielt dieselbe Störung ab. Echtzeit (×1); Drehbuch mit ${SCRIPTS.retry.length} Schritten.`,
    bilanzRef: "im ersten Sturm",
    headline: "Wer hält den Dienst unten?",
  },
};

/* Schalter der Ursachen-Folie (Preset-Zeile). „murphy“ ist kein cm-Schlüssel,
 * sondern cm.nb = "murphy" (nur im Szenario nachbar). */
const CAUSE_SW = [
  {
    key: "murphy",
    label: "🎯 Murphy · nur Demo",
    title: `🎯 Murphy · nur Demo: schlägt immer dann und dort zu, wo es den Engpass verschiebt — sobald sich die letzte Engpass-Station erholt hat und die andere Station (Webserver ↔ DB) im Tief ist; frühestens ${MURPHY_GAP_S} s nach Ende des letzten Schlags, ohne Tief spätestens ${MURPHY_MAX_WAIT_S} s danach. ${MURPHY_STRIKE_S} s mit voller Stärke. Der Worst Case, kein realistisches Verhalten.`,
  },
  {
    key: "headroom",
    label: "🛡️ Schutzkapazität",
    title: `Schutzkapazität: den Engpass festlegen (die DB, nicht horizontal skalierbar) und den Webservern +${HEADROOM_PCT} % Reserve geben. Bei „Nur Zufall“ hört das Wandern auf (Lawrence & Buss 1994); gegen die Nachbar-VM hilft das nur halb. Die Variante „+${HEADROOM_PCT} % überall“ steht im ⚙.`,
  },
  {
    key: "isolate",
    label: "🏠 Eigener Host",
    title:
      "Isolation: dedizierter Host und eigenes Storage — die Wirkung der Nachbar-VM entfällt.",
  },
];

function scaleTitle(n0, n1) {
  return `Webserver skalieren ${n0} → ${n1}. Reaktiv ≈ ${SCALE_REACTIVE_S} s (Erkennen ${SCALE_DETECT_S} s + Kaltstart ${SCALE_COLD_S} s + Aufwärmen ${SCALE_WARMUP_S} s ab ${SCALE_WARM_START_PCT} %), vorgewärmt (Warm Pool) ≈ ${SCALE_PREWARM_S} s. Hilft nur, wenn der Engpass horizontal skalierbar ist.`;
}

/* Schalter der Gegenmaßnahmen, gruppiert nach den sechs Grundrichtungen.
 * Gerendert wird nur, was das Modell kann (CM_DEFAULTS); Phase-2-Schlüssel
 * stehen schon hier und erscheinen, sobald das Modell sie implementiert.
 * Die Leiste zeigt je Szenario nur dessen Auswahl (SCENARIOS[k].rail) plus
 * alle eingeschalteten Schalter; alle stehen im ⚙ („Alle Schalter zeigen“).
 * Leere Gruppen entfallen. `col` = Spalte der Leiste, solange sie passt. */
const CM_GROUPS = [
  {
    key: "zufluss",
    label: "Zufluss bremsen",
    col: 1,
    items: [
      {
        key: "bpInv",
        label: "BP → Bestand",
        title:
          "Back Pressure an der Bestandsprüfung: Concurrency-Limit vor der DB plus BEGRENZTE Eingangs-Queue, Überlauf → 503. Schafft keine Kapazität — der Stau wandert an den Rand.",
      },
      {
        key: "bpPay",
        label: "BP → Zahlung",
        title:
          "Back Pressure am Zahlungsdienst: Aufrufe auf das Limit des Anbieters begrenzen, wartende Checkouts in begrenzter Queue. Schafft keine Kapazität.",
      },
      {
        key: "rateLimit",
        label: `Rate Limit ${RL_RATE}/s`,
        needs: "bot", // trifft nur schwere Clients: ohne Bot wirkungslos
        title: `Rate Limit je Client: Token Bucket mit ${RL_RATE} req/s je Client (Vorrat ${RL_BURST}), darüber sofort 429 — ohne Arbeit. Eine Regel je Client, Fairness: Kunden bleiben weit darunter, getroffen wird nur der Verursacher (hier der Bot). Senkt die Nachfrage nicht und schafft keine Kapazität. Stripe: „every Stripe user has a bucket“.`,
      },
      {
        key: "admission",
        label: `Admission ${ADMISSION_RPS}/s`,
        title: `Admission Control: ein globales, statisches Limit am Eingang — höchstens ${ADMISSION_RPS} req/s für alle zusammen (so viele Produktseiten schafft die DB normal), der Rest sofort 503, anteilig über alle Klassen. Kennt weder Clients noch die Kapazität der Kette: Sinkt sie (IO-Schub der Nachbar-VM), passt die Zahl nicht mehr.`,
      },
    ],
  },
  {
    key: "verwerfen",
    label: "Arbeit verwerfen / reduzieren",
    col: 1,
    items: [
      {
        key: "shedBrowse",
        label: "Shed: Produktseiten",
        title: `Load Shedding: früh abweisen, Produktseiten zuerst, Checkouts zuletzt (Priorität). Reagiert auf den Zustand des Servers — die Eingangs-Queue (Ziel ${fmt(SHED_TARGET_S, 1)} s) und, ohne Back Pressure, die Wartezeit der DB (ab ${fmt(SHED_DB_S, 1)} s anteilig, ab ${fmt(SHED_DB_S + SHED_DB_BAND_S, 1)} s alle). Wer fragt, sieht es nicht: Kunden und Bot gleich. Abgewiesene sehen sofort „Bitte später erneut versuchen“.`,
      },
      {
        key: "shedCheckout",
        label: "Shed: Checkouts",
        title:
          "Kassen-Limit: nur so viele Checkouts annehmen, wie der Zahlungsdienst schafft; der Rest sofort „Kasse ausgelastet — Warenkorb bleibt“.",
      },
      {
        key: "featureShed",
        label: "Feature Shedding",
        title: `Feature Shedding: personalisierte Empfehlungen aus — eine Produktseite kostet ${fmt(INV_AVAIL_E, 1)} E statt ${fmt(INV_PAGE_E, 1)} E DB-Arbeit. Die Funktion fällt weg, DB-Kapazität wird frei.`,
      },
      {
        key: "cache",
        label: "Cache + Coalescing",
        title: `Cache + Coalescing für die Empfehlungen, Schlüssel je Produkt (personalisiert wird danach nur sortiert): ${CACHE_HIT_PCT} % der Seiten bekommen sie ohne DB-Arbeit — Cache-Treffer, und gleichzeitige Fehltreffer zum selben Produkt gehen als EINE Anfrage an die DB (im Newsletter öffnen alle dieselben Produkte; sonst stürmt beim leeren Cache jede Anfrage los: „thundering herd“). ${fmt(INV_RECO_E, 1)} → ${fmt(INV_RECO_CACHED_E, 2)} E je Seite, die Funktion bleibt. Die Reservierung im Checkout kommt nie aus dem Cache — sonst wird überverkauft.`,
      },
      {
        key: "batch",
        label: "Batching",
        title: `Batching: Verfügbarkeitsabfragen aus ${BATCH_WINDOW_MS} ms gehen als ein Bündel an die DB — der Overhead (${fmt(INV_OVERHEAD_E, 1)} E je Abfrage) teilt sich auf das Bündel, je Artikel bleiben ${fmt(INV_PER_ITEM_E, 1)} E. Kostet im Mittel +${BATCH_LAT_MS} ms je Seite, auch ohne Last (dann spart es nichts); dazu Teilfehler und ein größerer Blast-Radius: Ein fehlerhaftes Bündel trifft viele Anfragen.`,
      },
    ],
  },
  {
    key: "kapazitaet",
    label: "Kapazität erhöhen",
    col: 2,
    items: [
      {
        key: "scale",
        // je Szenario aus nWeb und scaleTarget (itemLabel/itemTitle)
        label: `Scaling ${N_WEB_START}→${SCALE_TARGET}`,
        mode: true,
        title: scaleTitle(N_WEB_START, SCALE_TARGET),
      },
      {
        key: "headroom",
        label: `Schutzkap. +${HEADROOM_PCT} %`,
        title: `Schutzkapazität: Webserver dauerhaft +${HEADROOM_PCT} %. Wirkt an den Nicht-Engpässen (Lawrence & Buss 1994) — und hilft nur, wenn horizontal skalierbar.`,
      },
    ],
  },
  {
    key: "spitzen",
    label: "Spitzen verteilen",
    col: 2,
    items: [
      {
        key: "smoothing",
        label: "Puffern & glätten",
        needs: "mail", // nur mit Mailversand (Kurze Spitzen)
        title: `Puffern & glätten: Bestellung sofort bestätigen, die Bestätigungsmail kommt aus einem Puffer — höchstens ${fmt(MAIL_Q_MAX)} Mails und keine älter als ${MAIL_MAX_AGE_S} s; was darüber liegt, geht verloren. Glättet Spitzen über die Zeit und schafft keine Kapazität: Hilft nur, wenn das Mittel unter der Kapazität des Mailversands (${MAIL_CAP}/s) liegt — sonst läuft der Puffer voll.`,
      },
    ],
  },
  {
    key: "isolieren",
    label: "Überlast isolieren",
    col: 2,
    items: [
      {
        key: "bulkhead",
        label: "Bulkheads",
        title: `Bulkheads: getrennte Thread-Pools — Checkout ${BULKHEAD_CHECKOUT_PCT} %, Rest ${BULKHEAD_REST_PCT} % der Threads. Hängt ein Teil (hier die Produktseiten), bleiben Threads für die Kasse frei. Schafft keine Kapazität und verliert den Pooling-Effekt: Freie Threads des einen Pools helfen dem anderen nicht.`,
      },
    ],
  },
  {
    key: "verstaerkung",
    label: "Verstärkung verhindern",
    col: 2,
    items: [
      {
        key: "timeouts",
        label: "Timeouts",
        title: `Timeouts: Empfehlungen nach ${REC_TIMEOUT_MS} ms abbrechen — die Seite kommt ohne sie (degradiert, trotzdem ein Erfolg). DB nach ${fmt(DB_TIMEOUT_S, 1)} s, Zahlung nach ${PAY_TIMEOUT_S} s statt ${PAY_GIVEUP_S} s: schneller Fehler (504). Begrenzt, wie lange ein Thread wartet — der hängende Dienst bekommt aber weiter jeden Aufruf.`,
      },
      {
        key: "breaker",
        label: "Circuit Breaker",
        title: `Circuit Breaker vor Empfehlungen und Zahlung: Ab ${BREAKER_TRIP_PCT} % Fehlern (gemittelt über ${BREAKER_TAU_S} s) öffnet er für ${BREAKER_OPEN_S} s — Aufrufe entfallen sofort (fail fast); danach lässt er ${HALF_ADMIT_PCT} % als Probe durch und schließt, sobald die Proben ohne Fehler zurück sind (frühestens nach ${fmt(BREAKER_CLOSE_S, 1)} s). Offen vor den Empfehlungen = automatisches Feature Shedding. Er zählt nur Abbrüche: Ohne Timeouts sieht er hier einen hängenden Dienst nicht.`,
      },
      {
        key: "retry",
        label: "Retries",
        // segmentiert (aria-pressed), keine Radiogroup, keine Pfeiltasten
        seg: [
          {
            v: "aus",
            label: "aus",
            title: `Keine Retries: ein Versuch je Zahlung; scheitert er (Timeout — mit Timeouts nach ${PAY_TIMEOUT_S} s, sonst bricht der Anbieter nach ${PAY_GIVEUP_S} s ab), ist die Zahlung gescheitert.`,
          },
          {
            v: "naiv",
            label: "naiv",
            title: `Naive Retries: bis zu ${RETRY_MAX_ATTEMPTS} Versuche, sofort nach dem Timeout. Scheitert alles, verdreifacht das die Last am Zahlungsdienst — im Retry-Sturm ${RETRY_MAX_ATTEMPTS} × ${RETRY_CHECKOUTS} = ${RETRY_STORM_LOAD} Versuche/s gegen ${PAY_CAP}.`,
          },
          {
            v: "backoff",
            label: "Backoff",
            title: `Exponentielles Backoff ohne Jitter: ${RETRY_BASE_S} s Pause vor dem 2., ${2 * RETRY_BASE_S} s vor dem 3. Versuch. Wer gleichzeitig scheitert, kommt gleichzeitig wieder — Wellen. Die Menge bleibt.`,
          },
          {
            v: "backoffJitter",
            label: "+Jitter",
            title: `Backoff mit Jitter: Pause zufällig zwischen 0 und ${RETRY_BASE_S} s bzw. ${2 * RETRY_BASE_S} s — die Retries verteilen sich, die Spitzen verschwinden. Die Menge bleibt.`,
          },
        ],
        title: `Retries am Zahlungsdienst: bis zu ${RETRY_MAX_ATTEMPTS} Versuche je Zahlung (SRE Book: „up to three attempts“). Timeout je Versuch ${PAY_TIMEOUT_S} s mit Timeouts, sonst wartet der Client, bis der Anbieter nach ${PAY_GIVEUP_S} s abbricht. Für die Frist (${DEADLINE_S} s) zählt der ganze Checkout — ein Retry nach einem Timeout kommt zu spät. Sicher nur mit Idempotency Key — sonst wird doppelt abgebucht.`,
      },
      {
        key: "retryBudget",
        label: `Retry-Budget ${RETRY_BUDGET_PCT} %`,
        title: `Retry-Budget: Retries nur, solange ihr Anteil an den Requests unter ${RETRY_BUDGET_PCT} % bleibt (SRE Book, per-client retry budget) — hier als Token Bucket, ${fmt(RETRY_BUDGET, 1)} Retry je Erstversuch. Deckelt im Retry-Sturm die Last auf ≈ ${RETRY_BUDGET_LOAD} statt ${RETRY_STORM_LOAD} Versuche/s. Envoy nimmt 20 % der aktiven Requests als Default, Finagle etwa 20 %: Die Zahl ist eine Wahl, keine Konstante.`,
      },
    ],
  },
];
/* Retry-Modus: als Schalter „an“, sobald nicht „aus“ (Leiste, Dimmen). */
const cmOn = (cm, key) => (key === "retry" ? cm.retry !== "aus" : !!cm[key]);
const RETRY_SEG = CM_GROUPS.flatMap((g) => g.items).find(
  (i) => i.key === "retry",
).seg;
const retryLabel = (v) => RETRY_SEG.find((x) => x.v === v)?.label ?? v;
// Alle Schalter mit Wirkung im Modell, gruppiert (⚙-Liste und Leiste)
const ALL_GROUPS = CM_GROUPS.map((g) => ({
  ...g,
  items: g.items.filter((i) => i.key in CM_DEFAULTS),
})).filter((g) => g.items.length > 0);
const ALL_KEYS = ALL_GROUPS.flatMap((g) => g.items.map((i) => i.key));
/** Schalter, die im Szenario d wirken: `needs` nennt eine Station, ohne die
 * der Schalter nichts tut (smoothing nur mit Mailversand). */
const groupsFor = (d) =>
  ALL_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.needs || !!d[i.needs]),
  })).filter((g) => g.items.length > 0);
// Schlüssel, deren Abweichung das Drehbuch „schmutzig“ macht
const SCRIPT_KEYS = [...ALL_KEYS, "scaleMode"];

/* Höhe der Leiste (logische px, aus dem CSS unten): Gruppen-Label 11,
 * je Schalter 2 + 18, Abstand zwischen Gruppen 4. Platz: Seitenspalte 315
 * − Drehbuch-Karte 160 − Abstand 6 = 149. Passt die feste Spaltenwahl
 * (`col`) nicht, verteilt railLayout() die Gruppen neu; passt auch das
 * nicht, wird die Leiste dicht (Schalter 15 px) und notfalls scrollbar. */
const RAIL_H = 149;
const RAIL_GAP = 4;
const groupH = (n, dense) => (dense ? 10 + n * 16 : 11 + n * 20);
const colH = (gs, dense = false) =>
  gs.reduce(
    (h, g, i) => h + (i ? RAIL_GAP : 0) + groupH(g.items.length, dense),
    0,
  );
/** Spalten der Leiste: zuerst die feste Wahl (`col`), sonst die Verteilung
 * mit der kleinsten Höhe — Gruppen mit Modus-Knopf (Scaling) oder Segmenten
 * (Retries) bleiben in der breiteren Spalte 2, die Reihenfolge innerhalb
 * einer Spalte bleibt. */
function railLayout(groups) {
  const fixed = [1, 2].map((c) => groups.filter((g) => g.col === c));
  if (Math.max(colH(fixed[0]), colH(fixed[1])) <= RAIL_H)
    return { cols: fixed, dense: false };
  let best = fixed;
  let bestH = Infinity;
  for (let m = 0; m < 1 << groups.length; m++) {
    const cols = [[], []];
    groups.forEach((g, i) => cols[(m >> i) & 1].push(g));
    if (cols[0].some((g) => g.items.some((it) => it.mode || it.seg))) continue;
    const h = Math.max(colH(cols[0]), colH(cols[1]));
    if (h < bestH) {
      best = cols;
      bestH = h;
    }
  }
  return { cols: best, dense: bestH > RAIL_H };
}

// Kurzlabels für die ±-Marker im Diagramm
const MARK = {
  headroom: "Schutzkap.",
  headroomAll: `+${HEADROOM_PCT} % überall`,
  isolate: "Eigener Host",
  bpInv: "BP Bestand",
  bpPay: "BP Zahlung",
  shedBrowse: "Shed Seiten",
  shedCheckout: "Shed Kasse",
  featureShed: "Feature Shed",
  cache: "Cache",
  batch: "Batching",
  scale: "Scaling",
  bulkhead: "Bulkheads",
  timeouts: "Timeouts",
  breaker: "Breaker",
  retryBudget: "Retry-Budget",
  smoothing: "Puffer",
  rateLimit: "Rate Limit",
  admission: "Admission",
};

/* Die sechs Grundrichtungen (Erklär-Tab): Beispiele mit Schaltern, ● = in
 * dieser Folie als Schalter vorhanden. */
const DIRECTIONS = [
  {
    dir: "Zufluss bremsen",
    ex: [
      ["Back Pressure", ["bpInv", "bpPay"]],
      ["Rate Limit pro Client", ["rateLimit"]],
      ["Admission Control", ["admission"]],
    ],
    cap: "nein — verlegt den Stau an den Rand",
  },
  {
    dir: "Arbeit verwerfen / reduzieren",
    ex: [
      ["Load Shedding", ["shedBrowse", "shedCheckout"]],
      ["Feature Shedding", ["featureShed"]],
      ["Cache + Coalescing", ["cache"]],
      ["Batching", ["batch"]],
    ],
    cap: "Shedding nein; weniger Arbeit je Anfrage: ja",
  },
  {
    dir: "Kapazität erhöhen",
    ex: [
      ["Scaling", ["scale"]],
      ["Schutzkapazität", ["headroom", "headroomAll"]],
    ],
    cap: "ja — wenn der Engpass horizontal skalierbar ist",
  },
  {
    dir: "Spitzen verteilen",
    ex: [["Puffern & glätten", ["smoothing"]]],
    cap: "nein — hilft nur, wenn das Mittel unter der Kapazität liegt",
  },
  {
    dir: "Überlast isolieren",
    ex: [
      ["Bulkheads", ["bulkhead"]],
      ["Eigener Host", ["isolate"]],
    ],
    cap: "nein — begrenzt den Schaden",
  },
  {
    dir: "Verstärkung verhindern",
    ex: [
      ["Timeouts", ["timeouts"]],
      ["Circuit Breaker", ["breaker"]],
      ["Backoff + Jitter", ["retry"]],
      ["Retry-Budget", ["retryBudget"]],
    ],
    cap: "nein — verhindert, dass Last sich vervielfacht",
  },
];
const HERE = new Set(
  isCause ? ["headroom", "headroomAll", "isolate"] : ALL_KEYS,
);
const directionsView = DIRECTIONS.map((d) => ({
  ...d,
  ex: d.ex.map(([label, keys]) => ({
    label,
    here: keys.some((k) => HERE.has(k)),
  })),
}));

// Kennzahlen des Bot-Ansturms (Erklär-Tab)
const FIG_BOTS = Object.fromEntries(SCRIPT_FIGURES.bots.map((f) => [f.key, f]));

const RELATED = [
  ["systemdynamik", "Systemdynamik"],
  ["noisy-neighbor", "Noisy Neighbor"],
  ["circuit-breaker", "Circuit Breaker"],
  ["retry-sturm", "Retry-Sturm"],
  ["bufferbloat", "Bufferbloat"],
  ["hpa-hunting", "HPA-Hunting"],
  ["cache-stampede", "Cache-Stampede"],
];

/* ===== 2 · Zustand (nur pro Instanz — Slidev hält Nachbarfolien gemountet) ===== */

const C = useScopeColors();
const { isDark } = useDarkMode();
const isSlideActive = useIsSlideActive();
const slideCtx = useSlideContext();
const renderCtx = slideCtx ? slideCtx.$renderContext : null;
const nav = useNav();
const reduceMotion =
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let sim = null;
let seed = 1;
let markers = []; // [{ t, text }] — Drehbuch-Züge ①… und ±Schalter
let animId = null;
let rafDraw = null;
let lastTs = 0;
let frameNo = 0;
let autoplayed = false;
let resizeObs = null;
let pal = null;
let wipeTimer = null;
let pulseTimer = null;
let W = 0;
let H = 0;
let dpr = 1;

const scenario = ref(ORDER[0]);
const playing = ref(false);
const speed = ref(SCENARIOS[ORDER[0]].tempo);
const activeTab = ref("sim");
const view = shallowRef(null);
const cmView = shallowRef({ ...CM_DEFAULTS });
const simT = ref(0);
const seedView = ref(0);
const revealed = ref(false);
const wiping = ref(false);
const spark = shallowRef(null);
const skipTips = ref(false);
const showAll = ref(false); // ⚙ „Alle Schalter zeigen“
const pulse = ref([]);
const scr = reactive({
  idx: 0,
  phase: "ask", // ask | pending | reveal | done
  tip: null,
  appliedAt: 0,
  tainted: false,
});
const results = ref([]);

const shellRef = ref(null);
const stageEl = ref(null);
const chartWrap = ref(null);
const canvasEl = ref(null);
const explainEl = ref(null);

/* rAF und Autoplay nur auf der aktiven Folie UND im Kontext slide/presenter:
 * die Übersichtskopie der aktuellen Folie gilt sonst auch als „aktiv“.
 * Hinter dem Erklär-Tab steht die Sim still — sonst wechseln Pill und
 * Fußzeile, während jemand liest. */
const canRun = computed(
  () =>
    isSlideActive.value &&
    activeTab.value === "sim" &&
    (!renderCtx || ["slide", "presenter"].includes(renderCtx.value)),
);

/* ===== 3 · Abgeleitet ===== */

const def = computed(() => SCENARIOS[scenario.value]);
const winMin = computed(() => Math.round(def.value.windowS / 60));
const presets = ORDER.map((k) => ({
  key: k,
  label: SCEN_UI[k].label,
  title: SCEN_UI[k].title,
}));
const eyebrow = isCause
  ? "Wandernde Engpässe · Ursache · Sandbox"
  : "Wandernde Engpässe · Gegenmaßnahmen · Zahlen illustrativ";
const title = computed(() =>
  isCause
    ? "Wandernde Engpässe: Wer klaut die Kapazität?"
    : `${SCEN_UI[scenario.value].label}: ${SCEN_UI[scenario.value].headline ?? "Wohin wandert der Engpass?"}`,
);
const subtitle = computed(() =>
  isCause
    ? `Konstant ${fmt(def.value.load[0][1])} req/s, ${N_WEB_CAUSE} Webserver, knappe Reserven — nichts im Log.`
    : "",
);
const clock = computed(() => {
  const t = Math.floor(simT.value);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
});
// Reduzierte Bewegung: kein Zeitraffer, ▶ rechnet in festen Schritten
const clockTempo = reduceMotion ? "Schritt 1 min" : null;
/* Die Nachbar-VM gibt es nur im Preset „Nachbar-VM“; unter „Nur Zufall“ ist
 * nichts zu verdecken und nichts aufzudecken. */
const nbScen = computed(() => scenario.value === "nachbar");
const nbShown = computed(() => revealed.value && nbScen.value);
const playLabel = computed(() =>
  reduceMotion ? "▶ +1 min" : playing.value ? "⏸ Pause" : "▶ Weiter",
);
const askPhase = computed(
  () => !isCause && scr.phase === "ask" && !scriptDirty.value,
);
const playTitle = computed(() =>
  askPhase.value
    ? "Zug ohne Tipp starten"
    : reduceMotion
      ? "Simulation um 1 Minute fortschreiben"
      : "Simulation anhalten / fortsetzen",
);
const ffTitle = computed(() =>
  askPhase.value
    ? "Zug ohne Tipp starten und bis zur Auflösung vorspulen"
    : !isCause && scr.phase === "pending"
      ? "Bis zur Auflösung vorspulen"
      : "5 Minuten Sim-Zeit sofort rechnen",
);

const pill = computed(() => {
  const v = view.value;
  if (!v) return { st: "web", lead: "", name: "", state: "", cls: "" };
  if (v.bottleneck) {
    const ov = v.overloaded[v.bottleneck];
    return {
      st: v.bottleneck,
      lead: "Engpass jetzt",
      name: NAME[v.bottleneck],
      state: ov,
      cls: `wb-pill-bn wb-pill-${ov}`,
    };
  }
  return {
    st: v.knappste,
    lead: "kein Engpass · knappste Reserve",
    name: NAME[v.knappste],
    state: "",
    cls: "",
  };
});

/* --- Drehbuch (remedies) --- */
const steps = computed(() => SCRIPTS[scenario.value] ?? []);
const stepUi = computed(() => {
  const st = steps.value[Math.min(scr.idx, steps.value.length - 1)];
  return (st && STEP_UI[scenario.value]?.[st.key]) || null;
});
function expectOf(i) {
  let prev = null;
  for (let k = 0; k <= i && k < steps.value.length; k++) {
    const e = steps.value[k].expect;
    prev = e === "bleibt" ? prev : e;
  }
  return prev;
}
function expectedCm() {
  const base = { ...CM_DEFAULTS, ...def.value.cm };
  const upto = scr.phase === "ask" ? scr.idx - 1 : scr.idx;
  for (let k = 0; k <= upto && k < steps.value.length; k++)
    Object.assign(base, steps.value[k].action);
  return base;
}
const scriptDirty = computed(() => {
  if (isCause || scr.phase === "done") return false;
  const exp = expectedCm();
  const cur = cmView.value;
  return SCRIPT_KEYS.some((k) => exp[k] !== cur[k]);
});
watch(scriptDirty, (d) => {
  if (d && scr.phase === "pending") scr.tainted = true;
});
/** Engpass-Station vor Schritt i: beobachtet, sonst laut Drehbuch. Ein
 * beobachtetes `null` („kein Engpass“) gilt — es darf nicht auf das Drehbuch
 * zurückfallen. */
function prevStation(i) {
  if (i <= 0) return null;
  const r0 = results.value[i - 1];
  return r0 ? r0.observed : expectOf(i - 1);
}
/* Eigene Frage des Schritts (step.ask): Tipps sind deren Ausgänge
 * (TIP_SETS), gewertet gegen observeTip() bei der Auflösung. */
const curAsk = computed(() => steps.value[scr.idx]?.ask ?? null);
const tipOptions = computed(() => {
  const set = curAsk.value ? TIP_SETS[curAsk.value] : null;
  if (set) return Object.entries(set).map(([key, label]) => ({ key, label }));
  // Standardfrage: drei Stationen (je Szenario, Kurze Spitzen mit
  // Mailversand) plus „nirgends“ bzw. „bleibt“ — das 2 × 2-Raster
  const sts = def.value.tipStations ?? STATIONS;
  return [
    ...sts.map((k) => ({ key: k, label: NAME[k] })),
    scr.idx === 0
      ? { key: "none", label: "nirgends" }
      : { key: "bleibt", label: "bleibt" },
  ];
});
const curResult = computed(() => results.value[scr.idx] ?? null);
function tipClass(key) {
  const r = curResult.value;
  if (scr.phase === "reveal" && r) {
    const correct = r.ask
      ? key === r.observedTip
      : key === r.observed ||
        (key === "bleibt" && r.stays) ||
        (key === "none" && r.observed === null);
    return {
      "wb-tip-correct": correct,
      "wb-tip-wrong": scr.tip === key && !correct,
      "wb-tip-chosen": scr.tip === key,
    };
  }
  return { "wb-tip-chosen": scr.tip === key };
}
const tipFeedback = computed(() => {
  const r = curResult.value;
  if (scr.phase === "pending") {
    const st = steps.value[scr.idx];
    const left = Math.max(0, scr.appliedAt + st.settle - simT.value);
    return { ok: "", text: `⏳ Einschwingen … noch ${fmt(left)} s Sim-Zeit` };
  }
  if (scr.phase !== "reveal" || !r) return { ok: "", text: "" };
  if (r.tainted)
    return { ok: "na", text: "nicht gewertet — Schalter wichen ab" };
  if (r.tip == null) return { ok: "", text: "ohne Tipp" };
  return r.ok
    ? { ok: "true", text: "✓ Richtig getippt" }
    : {
        ok: "false",
        text: `✗ Getippt: ${tipOptions.value.find((o) => o.key === r.tip)?.label ?? r.tip}`,
      };
});
const score = computed(() => {
  const rs = results.value.filter((r) => r && r.ok !== null);
  return { hit: rs.filter((r) => r.ok).length, n: rs.length };
});

/* --- Fußzeile (nicht interaktiv, zwei Zeilen) --- */
const foot = computed(() => {
  const v = view.value;
  if (!v) return { tone: "", lead: "", text: "", l2: "" };
  if (isCause) {
    const w = v.win;
    const cm = cmView.value;
    const inStrike = `${w.shiftsInStrike} von ${w.shifts} Wechseln fallen in einen Nachbar-Schub.`;
    let l2;
    if (cm.isolate && scenario.value === "nachbar")
      l2 =
        "🏠 Eigener Host: Die Nachbar-VM wirkt nicht mehr — übrig bleibt die Eigenschwankung, und die reicht hier kaum für Überlast." +
        (cm.nb === "murphy" ? " Auch Murphy trifft nicht mehr." : "");
    else if (cm.nb === "murphy")
      l2 =
        "🎯 Murphy · nur Demo: schlägt immer dann und dort zu, wo es den Engpass verschiebt." +
        (revealed.value ? ` ${inStrike}` : "");
    else if (cm.headroomAll)
      // Nur bei „Nur Zufall“ verschwindet die Überlast; ein Nachbar-Schub
      // (25–40 % Steal) frisst auch +20 % auf.
      l2 =
        scenario.value === "zufall"
          ? `+${HEADROOM_PCT} % überall: Die Überlast verschwindet, aber die knappste Station wandert weiter (${w.knappShifts} Wechsel in ${winMin.value} min).`
          : `+${HEADROOM_PCT} % überall: Ein Nachbar-Schub frisst auch diese Reserve auf — Überlast und Wechsel bleiben.` +
            (revealed.value ? ` ${inStrike}` : "");
    else if (scenario.value === "nachbar")
      l2 =
        (revealed.value
          ? inStrike
          : "Von innen ist kein Auslöser zu sehen — 🔒 Nachbar-VM aufdecken?") +
        (cm.headroom
          ? ` 🛡️ Webserver +${HEADROOM_PCT} %: weniger Überlast am Webserver, kaum weniger Wechsel.`
          : "");
    else
      l2 = cm.headroom
        ? `🛡️ Webserver +${HEADROOM_PCT} %: Die DB wird zum festen Engpass, das Wandern hört auf (Lawrence & Buss 1994).`
        : "Kein Nachbar, kein Auslöser: nur Zufall bei knappen Reserven (Roser et al.).";
    return {
      tone: w.shifts > 0 ? "warn" : "",
      lead: `${w.shifts} Engpass-Wechsel in ${winMin.value} min · Engpass-Zeit ${pct(w.engpassZeit)} %`,
      text: "— konstante Last, kein Deploy, kein Fehler im Log.",
      l2,
    };
  }
  if (scr.phase === "reveal" && curResult.value) {
    const r = curResult.value;
    const tipLabel = r.ask
      ? (TIP_SETS[r.ask]?.[r.observedTip] ?? String(r.observedTip))
      : "";
    const lead = r.ask
      ? `Antwort: ${tipLabel}${tipLabel.endsWith(".") ? "" : "."}`
      : r.observed
        ? `Antwort: ${NAME[r.observed]} · ${r.overload}${r.stays ? " (bleibt)" : ""}.`
        : "Antwort: kein Engpass.";
    const text =
      r.asExpected && !r.tainted
        ? (stepUi.value?.explain ?? "")
        : `Diesmal anders als im Drehbuch — ${r.tainted ? "die Schalter wichen ab" : "Zufall dieses Seeds"}. „Zurück zu Schritt ${scr.idx}“ wiederholt den Zug.`;
    return { tone: r.observed ? "bad" : "ok", lead, text, l2: "" };
  }
  const k = v.kpi;
  if (scr.phase === "done") {
    // Das Fazit steht in der Karte; die Fußzeile zieht die Bilanz in Zahlen.
    const f0 = SCRIPT_FIGURES[scenario.value]?.[0];
    // Retry-Sturm: Die Bilanz steckt in den Schritten (Versuche je Zahlung,
    // Bestellungen nach dem Neustart, sofort abgewiesen statt Timeout) — der
    // Endstand mitten im Brownout sagte wenig
    if (scenario.value === "retry") {
      const fr = Object.fromEntries(
        SCRIPT_FIGURES.retry.map((f) => [f.key, f]),
      );
      const x = (a) => `×${fmt(a, Number.isInteger(a) ? 0 : 1)}`;
      return {
        tone: "ok",
        lead: "Bilanz:",
        text: `Versuche je Zahlung ${x(fr.start.amp)} → ${x(fr.budget.amp)}; nach dem Neustart ${fmt(fr.start.orders)} → ${fmt(fr.budget.orders)} Bestellungen/s rechtzeitig.`,
        l2: `Breaker im Brownout: ${fmt(fr.breaker.rejected)}/s sofort abgewiesen statt Fehler nach Timeouts. Jetzt: ${fmt(k.okC)} Bestellungen/s, verloren ${fmt(k.lost)}/s.`,
      };
    }
    // Bot-Ansturm: Kunden und Bot getrennt — die Bilanz zählt die Kunden
    if (def.value.bot)
      return {
        tone: "ok",
        lead: "Bilanz:",
        text: `rechtzeitig jetzt ${fmt(k.custOk)} Kundenseiten/s und ${fmt(k.okC)} Bestellungen/s — ${SCEN_UI[scenario.value]?.bilanzRef ?? "zu Beginn"} ${fmt(f0?.custPages ?? 0)} und ${fmt(f0?.orders ?? 0)}.`,
        l2: `Früh abgewiesen: Kunden ${fmt(k.custRej)}/s, Bot ${fmt(k.botRej)}/s · verloren ${fmt(k.lost)}/s.`,
      };
    return {
      tone: "ok",
      lead: "Bilanz:",
      text:
        `rechtzeitig jetzt ${fmt(k.okB)} Produktseiten/s und ${fmt(k.okC)} Bestellungen/s` +
        (f0
          ? ` — ${SCEN_UI[scenario.value]?.bilanzRef ?? "zu Beginn"} ${fmt(f0.pages)} und ${fmt(f0.orders)}.`
          : "."),
      l2:
        `Früh abgewiesen ${fmt(k.rej)}/s · verloren ${fmt(k.lost)}/s` +
        (k.deg >= 0.5
          ? ` · ${fmt(k.deg)} Produktseiten/s ohne Empfehlungen (degradiert).`
          : def.value.mail
            ? ` · Mails ${fmt(k.mailSent)}/s verschickt, ${fmt(k.mailLost)}/s verloren.`
            : "."),
    };
  }
  const st = steps.value[scr.idx];
  // Retry-Sturm: wo die Störung gerade steht
  const inc = v.rv?.incident ?? null;
  const incTxt = !inc
    ? ""
    : inc.phase === "geplant"
      ? `Störung in ${fmt(Math.max(0, inc.t0 - v.t))} s`
      : inc.phase === "brownout"
        ? `Brownout noch ${fmt(Math.max(0, inc.t1 - v.t))} s, dann Neustart` +
          ((boostEnd() ?? -1) > v.t && speed.value < BOOST_SPEED
            ? ` · Wiederholung im Zeitraffer ×${BOOST_SPEED}`
            : "")
        : `nach dem Neustart: ×${fmt(v.rv.amp, 1)} Versuche je Zahlung`;
  // Kurze Spitzen: wo die Welle gerade steht
  const waveTxt = !def.value.waves
    ? ""
    : v.load.dauer
      ? "Dauerlast"
      : v.load.wave > 0.5
        ? "Blitzangebot läuft"
        : "Pause zwischen den Angeboten";
  // Bot-Ansturm: der IO-Schub der Nachbar-VM
  const ioTxt = v.io ? "IO-Schub der Nachbar-VM läuft" : "";
  const lageTxt = incTxt || waveTxt || ioTxt;
  const l2 = scriptDirty.value
    ? `Schalter weichen vom Drehbuch ab — freie Sandbox, bis „Zurück zu Schritt ${scr.idx}“.`
    : scr.phase === "pending"
      ? `Der Zug wirkt${lageTxt ? ` — ${lageTxt}` : ""} — Auflösung nach ${st ? st.settle : 0} s Sim-Zeit.`
      : `Lage lesen, dann tippen: ${curAsk.value ? stepUi.value?.question : "Wohin wandert der Engpass?"} — oder ▶ ohne Tipp.`;
  if (def.value.bot)
    return {
      tone: "",
      lead: "Rechtzeitig:",
      text: `Kunden ${fmt(k.custOk)} Seiten/s · ${fmt(k.okC)} Bestellungen/s · Bot ${fmt(k.botOk)}/s · früh abgewiesen: Kunden ${fmt(k.custRej)}/s, Bot ${fmt(k.botRej)}/s · verloren ${fmt(k.lost)}/s`,
      l2,
    };
  return {
    tone: "",
    lead: "Rechtzeitig:",
    text:
      `${fmt(k.okB)} Produktseiten/s` +
      (k.deg >= 0.5 ? ` (${fmt(k.deg)} ohne Empf.)` : "") +
      ` · ${fmt(k.okC)} Bestellungen/s · früh abgewiesen ${fmt(k.rej)}/s · verloren ${fmt(k.lost)}/s` +
      (def.value.mail
        ? ` · Mails ${fmt(k.mailSent)}/s raus` +
          (k.mailLost >= 0.5 ? `, ${fmt(k.mailLost)}/s verloren` : "")
        : ""),
    l2,
  };
});

/* --- Hosts-Leiste (cause) --- */
const hostsView = computed(() => {
  const v = view.value;
  if (!v || !v.hosts) return null;
  const h = v.hosts;
  // Ohne Nachbarn gibt es nichts zu verdecken: Gast-Metriken direkt zeigen
  const open = revealed.value || !nbScen.value;
  const dipped = h.webPer < h.webNomPer * 0.9;
  const slow = h.awaitMs > DB_AWAIT_BASE_MS * 1.3;
  const effA = open
    ? `Gast: %steal ${fmt(h.steal, h.steal < 10 ? 1 : 0)} % · je ${fmt(h.webPer)} statt ${fmt(h.webNomPer)} req/s`
    : dipped
      ? `je ${fmt(h.webPer)} statt ${fmt(h.webNomPer)} req/s — Ursache unbekannt`
      : `je ${fmt(h.webPer)} req/s (Nennwert ${fmt(h.webNomPer)})`;
  const effB = open
    ? `Gast: Disk-await ${fmt(h.awaitMs, 1)} ms · %steal ${fmt(h.dbSteal, 1)} %`
    : slow
      ? `Disk-await ↑ ${fmt(h.awaitMs, 1)} ms — Ursache unbekannt`
      : `Abfragen normal (Disk-await ${fmt(h.awaitMs, 1)} ms)`;
  const hid = h.hidden;
  const isoTxt = hid.affects ? "" : " · isoliert";
  // Kurz: steht links über dem ältesten Teil der Sparkline, die jüngsten
  // Minuten rechts bleiben frei. „+ Nachbar-VM“ steht schon im Host-Namen.
  const nbA =
    hid.mode === "aus"
      ? "nichts los"
      : hid.phase === "cpu"
        ? `CPU-Schub ${fmt(hid.nbCpuPct)} %${isoTxt}`
        : "CPU ruhig";
  const nbB =
    hid.mode === "aus"
      ? "nichts los"
      : hid.phase === "io"
        ? `IO-Schub ${fmt(hid.nbIoMBs)} MB/s${isoTxt}`
        : "IO ruhig";
  const nbTxt = nbScen.value
    ? revealed.value
      ? " + Nachbar-VM"
      : ""
    : " · kein Nachbar";
  return {
    effA,
    effB,
    nbA,
    nbB,
    nameA: `Host A · web-1…${h.n}${nbTxt}`,
    nameB: `Storage · db-1${nbTxt}`,
    state: nbScen.value
      ? revealed.value
        ? "aufgedeckt"
        : "verdeckt"
      : "ohne Nachbar",
  };
});
const HOST_TITLE_A = `Was der Gast sieht: CPU-Konkurrenz als %steal (st in top/vmstat, Spalte steal in /proc/stat). Ein CPU-Schub der Nachbar-VM nimmt ${pct(NB_STEAL_MIN)}–${pct(NB_STEAL_MAX)} % der Web-CPU. %steal entsteht auch durch leere CPU-Credits oder einen überlasteten Hypervisor.`;
const HOST_TITLE_B = `Was der Gast sieht: Die Disk-Wartezeit (iostat r_await/w_await) steigt auf das ${fmt(NB_AWAIT_MIN, 1)}- bis ${fmt(NB_AWAIT_MAX, 1)}-Fache von ${fmt(DB_AWAIT_BASE_MS, 1)} ms; %iowait gilt als unzuverlässig. %steal bleibt ≈ 0: Warten auf IO zählt als idle, und idle ist nie steal.`;

/* ===== 4 · Fokus: Klicker-Tasten gehören dem Deck ===== */

// Nach Zeigerbedienung den Fokus abgeben (sofort und nach dem Klick), sonst
// schluckt der fokussierte Knopf den nächsten ArrowRight des Klickers. Muster
// aus 20260408-agents-details/components/CodexEffortBreakEven.vue.
const blurActive = () => document.activeElement?.blur?.();
const blurLater = () => {
  blurActive();
  setTimeout(blurActive, 0);
};
/* Erklär-Tab: beim Öffnen zum Abschnitt des aktuellen Szenarios springen —
 * der Text ist rund acht Bildschirme lang; ohne eigenen Abschnitt
 * (Rabattaktion, Ursachen) von oben. */
watch(activeTab, (tab) => {
  if (tab !== "explain") return;
  nextTick(() => {
    const box = explainEl.value;
    if (!box) return;
    const h = isCause
      ? null
      : box.querySelector(`.wb-ex-h[data-scen="${scenario.value}"]`);
    box.scrollTop = h ? Math.max(0, h.offsetTop - 4) : 0;
  });
});
// Escape im ⚙ fokussiert den ⚙-Knopf (SimShell) — danach wieder abgeben.
watch(
  () => shellRef.value?.gearOpen,
  (o, prev) => {
    if (prev === true && o === false) blurLater();
  },
);

/* ===== 5 · Sim ===== */

function userCmFor(key) {
  // Live-Schalter übernehmen, die im neuen Szenario Sinn haben
  const cur = cmView.value;
  const cm = {
    headroom: !!cur.headroom,
    isolate: !!cur.isolate,
    headroomAll: !!cur.headroomAll,
    noise: cur.noise ?? CM_DEFAULTS.noise,
  };
  if (key === "nachbar" && cur.nb === "murphy") cm.nb = "murphy";
  return cm;
}

function buildCause(cm) {
  const key = scenario.value;
  sim = new BottleneckSim(seed, key, { cm });
  sim.runTo(SCENARIOS[key].prerollS);
  markers = [];
  seedView.value = seed;
  cmView.value = { ...sim.cm };
  refresh();
}

/** Drehbuch: neu aufbauen und bis zur Frage von Schritt k vorrechnen —
 * dieselbe Zeitachse wie playScript() im Modell (Vorlauf, je Schritt
 * set(action) und settle). Schritt 0 fragt VOR dem Aktionsstart. */
function jumpToStep(k) {
  const key = scenario.value;
  const d = SCENARIOS[key];
  const sts = SCRIPTS[key];
  sim = new BottleneckSim(seed, key);
  markers = [];
  if (k <= 0) sim.runTo(ask0T(d));
  else {
    sim.runTo(d.prerollS);
    for (let i = 0; i < k && i < sts.length; i++) {
      const st = sts[i];
      if (Object.keys(st.action).length) sim.set(st.action);
      if (st.event) sim.trigger(st.event, sim.t);
      addMarker(i === 0 ? loadStepT(d) : sim.t, "", i);
      sim.runTo(sim.t + st.settle);
    }
  }
  results.value = results.value.slice(0, Math.max(0, k));
  scr.idx = Math.max(0, Math.min(k, sts.length - 1));
  scr.phase = "ask";
  scr.tip = null;
  scr.tainted = false;
  scr.appliedAt = sim.t;
  playing.value = false;
  seedView.value = seed;
  cmView.value = { ...sim.cm };
  refresh();
}

function selectScenario(key) {
  // SimShell meldet auch den Klick auf das aktive Preset — der darf weder
  // Seed noch Drehbuch-Fortschritt verwerfen (dafür gibt es ↺ Neu und ⚙).
  if (!SCENARIOS[key] || key === scenario.value) return;
  scenario.value = key;
  speed.value = SCENARIOS[key].tempo;
  seed = pickStartSeed(key);
  if (isCause) buildCause(userCmFor(key));
  else {
    results.value = [];
    jumpToStep(0);
  }
}

/** ↺ Neu: gleiches Szenario, gleicher Seed, Schalter zurück. */
function resetScenario() {
  if (isCause) buildCause({});
  else {
    results.value = [];
    jumpToStep(0);
  }
}
function newSeed() {
  seed = pickStartSeed(scenario.value);
  rebuildSameSwitches();
}
function rebuildSameSwitches() {
  if (isCause) buildCause(userCmFor(scenario.value));
  else {
    results.value = [];
    jumpToStep(0);
  }
}

function addMarker(t, text, step = null) {
  markers.push({ t, text, step });
  if (markers.length > 40) markers.shift();
}

function setCm(patch, label) {
  if (!sim) return;
  sim.set(patch);
  cmView.value = { ...sim.cm };
  if (label) addMarker(sim.t, label);
  refresh();
}
function toggleCm(key) {
  const on = !cmView.value[key];
  setCm({ [key]: on }, `${on ? "+" : "−"}${MARK[key] ?? key}`);
}
/** Retry-Modus (Segmente): eine Wahl, kein Umschalten per Pfeiltaste. */
function setRetry(v) {
  if (cmView.value.retry === v) return;
  setCm({ retry: v }, `Retry ${retryLabel(v)}`);
}
function toggleScaleMode() {
  const next = cmView.value.scaleMode === "reaktiv" ? "vorgewaermt" : "reaktiv";
  setCm(
    { scaleMode: next },
    next === "reaktiv" ? "Scaling reaktiv" : "Warm Pool",
  );
}
function swOn(key) {
  return key === "murphy" ? cmView.value.nb === "murphy" : !!cmView.value[key];
}
function swDisabled(key) {
  return key === "murphy" && scenario.value !== "nachbar";
}
function swDim(key) {
  return key === "isolate" && scenario.value !== "nachbar";
}
function swTitle(s) {
  return swDisabled(s.key) ? `Nur mit Nachbar-VM. ${s.title}` : s.title;
}
function toggleCauseSwitch(key) {
  if (key === "murphy") {
    if (scenario.value !== "nachbar") return;
    const on = cmView.value.nb !== "murphy";
    setCm({ nb: on ? "murphy" : "zufall" }, `${on ? "+" : "−"}Murphy`);
    return;
  }
  toggleCm(key);
}
function setNoise(lvl) {
  if (cmView.value.noise === lvl) return;
  setCm({ noise: lvl }, `Schwankung ${lvl}`);
}
/* Schalter-Leiste: Auswahl des Szenarios plus alles, was an ist. Was nicht
 * zur Auswahl gehört (nur eingeschaltet sichtbar), ist gedimmt, bleibt aber
 * klickbar. */
const scenGroups = computed(() => groupsFor(def.value));
const railSet = computed(() => new Set(def.value.rail ?? ALL_KEYS));
const railView = computed(() => {
  const set = railSet.value;
  const cm = cmView.value;
  return railLayout(
    scenGroups.value
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => set.has(i.key) || cmOn(cm, i.key)),
      }))
      .filter((g) => g.items.length > 0),
  );
});
/* Dichte Leiste, die trotzdem scrollt: „▾ mehr“, solange unten noch
 * Schalter verdeckt sind (keine sichtbare Scrollbar bei Overlay-Scrollbars). */
const railEl = ref(null);
const railMore = ref(false);
function checkRailMore() {
  const el = railEl.value;
  railMore.value =
    !!el &&
    el.scrollHeight - el.clientHeight > 1 &&
    el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}
watch(railView, () => nextTick(checkRailMore));
function railDim(key) {
  return !railSet.value.has(key);
}
// QA-Haken: Schalter der Leiste in Anzeige-Reihenfolge
const railKeys = computed(() =>
  railView.value.cols
    .flat()
    .flatMap((g) => g.items.map((i) => i.key))
    .join(","),
);
/** Scaling: Start und Ziel des aktuellen Szenarios (rabatt 2→12, teuer 12→20). */
function itemLabel(it) {
  return it.key === "scale"
    ? `Scaling ${def.value.nWeb}→${def.value.scaleTarget ?? SCALE_TARGET}`
    : it.label;
}
function itemTitle(it) {
  return it.key === "scale"
    ? scaleTitle(def.value.nWeb, def.value.scaleTarget ?? SCALE_TARGET)
    : it.title;
}

/* Takt der Sim-Zeit, an der Drehbuch-Auflösung exakt angehalten. */
function stepSim(dt) {
  if (!sim || dt <= 0) return;
  if (!isCause && scr.phase === "pending") {
    const tRes = scr.appliedAt + steps.value[scr.idx].settle;
    if (sim.t + dt >= tRes - 1e-9) {
      sim.runTo(tRes);
      resolveStep();
      return;
    }
  }
  sim.advance(dt);
}

function togglePlay() {
  if (!sim) return;
  if (askPhase.value) {
    giveTip(null);
    return;
  }
  if (reduceMotion) {
    stepSim(RM_STEP_S);
    refresh();
    return;
  }
  playing.value = !playing.value;
}
function fastForward() {
  if (!sim) return;
  if (askPhase.value) {
    giveTip(null);
    if (scr.phase !== "pending") return; // reduzierte Bewegung: schon aufgelöst
  }
  if (!isCause && scr.phase === "pending") {
    const st = steps.value[scr.idx];
    sim.runTo(scr.appliedAt + st.settle);
    resolveStep();
    return;
  }
  stepSim(FF_S);
  refresh();
}

/* ===== 6 · Drehbuch ===== */

function pulseKeys(keys) {
  if (reduceMotion) return;
  pulse.value = keys;
  clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => (pulse.value = []), 1600);
}

function giveTip(tip) {
  if (isCause || !sim || scr.phase !== "ask" || scriptDirty.value) return;
  const i = scr.idx;
  const st = steps.value[i];
  if (!st) return;
  scr.tip = tip;
  scr.tainted = false;
  const keys = Object.keys(st.action);
  if (keys.length) {
    sim.set(st.action);
    cmView.value = { ...sim.cm };
    pulseKeys(keys);
  }
  // Schritt 0 hat keinen Schalter-Zug: Der Lastsprung steht im Lastprofil
  // (loadStepT); aufgelöst wird wie in playScript nach dem Vorlauf.
  scr.appliedAt = i === 0 ? Math.max(sim.t, def.value.prerollS) : sim.t;
  // Ereignis des Schritts (Störung) zur selben Sim-Zeit wie in playScript
  if (st.event) sim.trigger(st.event, scr.appliedAt);
  addMarker(i === 0 ? Math.max(sim.t, loadStepT(def.value)) : sim.t, "", i);
  scr.phase = "pending";
  if (reduceMotion) {
    sim.runTo(scr.appliedAt + st.settle);
    resolveStep();
    return;
  }
  playing.value = true;
  refresh();
}

function resolveStep() {
  const i = scr.idx;
  const st = steps.value[i];
  const snap = sim.snapshot();
  const observed = snap.bottleneck;
  const prevSt = prevStation(i);
  // Eigene Frage: Ausgang über die letzten TIP_WINDOW_S (wie playScript)
  const ask = st?.ask ?? null;
  const observedTip = ask ? observeTip(sim, ask) : null;
  let ok = null;
  if (scr.tip != null && !scr.tainted) {
    if (ask) ok = scr.tip === observedTip;
    else {
      const tipSt =
        scr.tip === "bleibt" ? prevSt : scr.tip === "none" ? null : scr.tip;
      ok = tipSt === observed;
    }
  }
  const r = results.value.slice();
  r[i] = {
    tip: scr.tip,
    ask,
    observedTip,
    observed,
    overload: observed ? snap.overloaded[observed] : "ok",
    stays: i > 0 && observed !== null && observed === prevSt,
    asExpected: observed === expectOf(i) && (!ask || observedTip === st.answer),
    ok,
    tainted: scr.tainted,
  };
  results.value = r;
  scr.phase = "reveal";
  playing.value = false;
  refresh();
}

function nextStep() {
  if (scr.phase !== "reveal") return;
  playing.value = false;
  if (scr.idx >= steps.value.length - 1) scr.phase = "done";
  else {
    scr.idx++;
    scr.phase = "ask";
    scr.tip = null;
    scr.tainted = false;
  }
  refresh();
}
function restartScript() {
  results.value = [];
  jumpToStep(0);
}

/* ===== 7 · Aufdecken (cause) ===== */

function reveal() {
  if (revealed.value) return;
  revealed.value = true;
  if (!reduceMotion) {
    wiping.value = true;
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => (wiping.value = false), 1300);
  }
  refresh();
}
function hideAll() {
  revealed.value = false;
  wiping.value = false;
  refresh();
}

/* ===== 8 · Ansicht und Canvas ===== */

function signPct(x) {
  if (x >= RES_MAX - 0.01) return `≥ +${pct(RES_MAX)} %`;
  const r = Math.round(x * 100);
  return r > 0 ? `+${r} %` : r < 0 ? `−${-r} %` : "±0 %";
}

function cardOf(k, x, s, util, rv = null) {
  const isBn = s.bottleneck === k;
  // Vier Stationen (Mailversand): schmale Karten, kurze Zeilen
  const four = !!s.stations.mail;
  const ov = x.overload;
  let badge = null;
  let badgeText = "";
  if (ov !== "ok") {
    badge = ov;
    badgeText =
      ov === "abgefangen"
        ? isBn
          ? // schmale Karte (vier Stationen): ohne 🛡️ — der rote Rahmen
            // ohne Füllung sagt „abgefangen“ schon
            four
            ? "Engpass · abgefangen"
            : "🛡️ Engpass · abgefangen"
          : "🛡️ abgefangen"
        : isBn
          ? "Engpass · kollabiert"
          : "überlastet · kollabiert";
  } else if (x.badge === "knappste") {
    badge = "knappste";
    badgeText = "knappste Reserve";
  }
  const wait = x.wait;
  // Reserve der Karte aus denselben Momentwerten, die die Karte zeigt
  // (Kapazität / Last − 1) — sonst geht die Rechnung vor Publikum nicht
  // auf. Band, Badge und Pill entscheiden über die geglättete Reserve.
  const reserve =
    x.demand > 1e-6 ? Math.min(RES_MAX, x.cap / x.demand - 1) : RES_MAX;
  // Kein Engpass an dieser Station, aber noch Rückstau aus der letzten
  // Überlast: Er baut sich ab — orange statt rot (die Pill sagt dann zu
  // Recht „kein Engpass“).
  const draining = ov === "ok" && !(k === "web" && x.blocked);
  let bar = 0;
  let qText = "";
  let qBad = false;
  let qWarn = false;
  if (k === "web" && x.queueMax != null) {
    bar = x.queueMax > 0 ? Math.min(1, x.queue / x.queueMax) : 0;
    const full = bar >= 0.9;
    qText = `Queue ${fmt(x.queue)}/${fmt(x.queueMax)}${full ? " · voll, 503" : ""}`;
    qBad = full;
  } else if (k === "mail" && x.mode === "async") {
    // Mailversand mit Puffer: Füllstand und Verzögerung; voll heißt, Mails
    // gehen verloren (Größe oder Alter) — die Bestellungen nicht
    bar = x.queueMax > 0 ? Math.min(1, x.queue / x.queueMax) : 0;
    const full = bar >= 0.97 || x.lost >= 0.5;
    if (full) qText = `Puffer voll · −${fmt(x.lost)} Mails/s`;
    else if (x.queue >= 1)
      qText = `Puffer ${fmt(x.queue)} · ${fmt(wait, wait < 10 ? 1 : 0)} s`;
    qBad = full;
    qWarn = !full && x.queue >= 1;
  } else if (wait > MIN_WAIT_S) {
    const lim =
      k === "web"
        ? ABANDON_S
        : k === "inv"
          ? DEADLINE_S
          : k === "mail"
            ? MAIL_GIVEUP_S
            : PAY_GIVEUP_S;
    bar = Math.min(1, wait / lim);
    if (draining && wait > DEADLINE_S) {
      qText = `Rückstau baut ab ${fmt(wait, 1)} s`;
      qWarn = true;
    } else {
      const tail =
        k === "web"
          ? x.blocked // DB, Zahlung, Empfehlungen halten die Threads: Rückstau bis zum Rand
            ? x.blockedPool === "seiten"
              ? " · Pool Seiten voll"
              : x.blockedPool === "kasse"
                ? " · Pool Kasse voll"
                : " · Threads voll"
            : wait >= ABANDON_S * 0.9
              ? " · Kunden geben auf"
              : ""
          : wait > DEADLINE_S
            ? " · zu spät"
            : "";
      qText = `${k === "web" ? "Stau" : "Wartezeit"} ${fmt(wait, 1)} s${tail}`;
      qBad = wait > DEADLINE_S;
    }
  }
  let qIdle = false;
  if (!qText) {
    // „läuft leer“ nur HINTER dem Engpass (Starvation), nicht davor
    const behind =
      !!s.bottleneck && CHAIN.indexOf(k) > CHAIN.indexOf(s.bottleneck);
    if (behind && util < 0.85) {
      qText = "läuft leer";
      qIdle = true;
    } else if (draining && util >= 0.97 && reserve > 0.03) {
      // voll ausgelastet bei positiver Reserve: arbeitet Rückstau ab
      qText = `Rückstau baut ab · ${pct(util)} %`;
      qWarn = true;
    } else qText = `Auslastung ${pct(util)} %`;
  }
  // Back Pressure greift: die Station bremst ihre Vorstufe (Pfeil ◀)
  if (x.throttling) qText = "◀ bremst Vorstufe";
  const card = {
    key: k,
    name: NAME[k],
    suffix:
      k === "inv" ? " 🗄️" : k === "pay" ? " ☁️" : k === "mail" ? " ✉️" : "",
    unit: k === "mail" ? " Mails/s" : " req/s",
    resLabel: four ? "Res." : "Reserve",
    // gekappt (≥ +300 %) auf der schmalen Karte ohne „+“ und Leerzeichen
    resPct:
      four && reserve >= RES_MAX - 0.01
        ? `≥${pct(RES_MAX)} %`
        : signPct(reserve),
    isBn,
    overload: ov,
    badge,
    badgeText,
    throttling: !!x.throttling,
    cap: x.cap,
    nom: x.capNominal,
    // Nennwert → Ist; auf der schmalen Karte nur bis drei Stellen
    // („1.388 → 1.334 req/s“ passt nicht, der Ist-Wert allein schon)
    dipped: x.cap < x.capNominal * 0.97 && !(four && x.capNominal >= 1000),
    reserve,
    demand: x.demand,
    bar: Math.round(bar * 100),
    barBad: ov === "kollabiert" || (k === "mail" && qBad),
    qText,
    qBad,
    qWarn,
    qIdle,
    dots: [],
    dotsMore: "",
    extra: "",
    blocked: null, // QA: voller Thread-Pool am Webserver ("alle" | "seiten" | "kasse")
    rec: null, // QA: Zustand der Empfehlungen an der DB-Karte
    amp: null, // QA: Versuche je Erstversuch am Zahlungsdienst (mit Retries)
    brownout: null, // QA: Zahlungsdienst im Brownout
    breaker: null, // QA: Breaker vor der Zahlung ("closed" | "open" | "half")
    mail: null, // QA: Mailversand "sync" | "async"
    full: null, // QA: Puffer des Mailversands voll ("true" | "false")
    io: null, // QA: IO-Schub der Nachbar-VM an der DB ("true" | "false"; Bot-Ansturm)
  };
  if (k === "web") {
    const n = x.instances.running;
    const sN = x.instances.starting;
    const warmPct = x.instances.warmPct;
    const total = n + sN;
    // Die Zeile ist ≈ 138 px breit: 10 Punkte nur, solange der Text kurz
    // ist („12 laufen“); beim Starten/Aufwärmen 5, bei zweistelligem Rest 8.
    // Vier Karten (Kurze Spitzen) sind schmaler: 5, beim Starten 3
    const four = !!s.stations.mail;
    const busyText = sN || warmPct < 100;
    const maxDots = four
      ? busyText
        ? 3
        : 5
      : busyText
        ? 5
        : total > 12
          ? 8
          : 10;
    const shown = Math.min(maxDots, total);
    card.dots = Array.from({ length: shown }, (_, i) => ({
      i,
      starting: i >= n,
    }));
    card.dotsMore = total > shown ? `+${total - shown}` : "";
    // Threads im Blick (Empfehlungen hängen, Bulkheads): Belegung statt
    // „n laufen“ — die Punkte zeigen die Instanzen schon
    const th = x.threads;
    const thrStory =
      scenario.value === "empfehlung" || !!th.pools || th.waitRec > 1;
    const pctOf = (b, m) => (m > 0 ? Math.min(100, pct(b / m)) : 0);
    card.blocked = x.blockedPool;
    // zwei Pools: der Text braucht die ganze Zeile, die Instanzen stehen im
    // Tooltip (beim Starten wieder die Punkte)
    if (thrStory && th.pools && !sN) {
      card.dots = [];
      card.dotsMore = "";
    }
    card.extra = sN
      ? `${n} + ${sN} starten`
      : thrStory
        ? th.pools
          ? `Seiten ${pctOf(th.pools.browse.busy, th.pools.browse.max)} % · Kasse ${pctOf(th.pools.checkout.busy, th.pools.checkout.max)} %`
          : `Threads ${pctOf(th.busy, th.max)} %`
        : `${n} laufen${warmPct < 100 ? ` · ${warmPct} %` : ""}`;
    card.title = thrStory
      ? `Webserver: ${WEB_PER_INSTANCE} req/s je Instanz (CPU), ${th.perInstance} Threads je Instanz. Kapazität jetzt ${fmt(x.cap)} von ${fmt(x.capNominal)} req/s — CPU ${fmt(x.capCpu)}, darunter begrenzen die Threads. Nachfrage ${fmt(x.demand)} req/s. Threads: ${fmt(th.busy)} von ${fmt(th.max)} belegt, ${fmt(th.waitRec)} davon warten auf Empfehlungen` +
        (th.pools
          ? ` — Bulkheads: Seiten ${fmt(th.pools.browse.busy)}/${fmt(th.pools.browse.max)}, Kasse ${fmt(th.pools.checkout.busy)}/${fmt(th.pools.checkout.max)}.`
          : ".")
      : `Webserver: ${WEB_PER_INSTANCE} req/s je Instanz (CPU). Kapazität jetzt ${fmt(x.cap)} von ${fmt(x.capNominal)} req/s, Nachfrage ${fmt(x.demand)} req/s. Startende Instanzen hohl.`;
  } else if (k === "inv") {
    // Empfehlungen hängen (oder Timeouts/Breaker an): Zustand des
    // Empfehlungsdienstes, der an dieser DB hängt. Arbeit reduzieren (Teure
    // Abfragen, oder Cache/Batching an): Kosten je Produktseite. Sonst
    // Anteil der Empfehlungen an der DB.
    const r = s.rec;
    const recStory =
      scenario.value === "empfehlung" ||
      r.breaker !== null ||
      r.timedOut ||
      r.latS > r.baseS * 2;
    const lean = scenario.value === "teuer" || x.cacheHit > 0 || x.batchK > 1;
    // Bot-Ansturm (oder ein IO-Schub): Anteil des Bots an der Nachfrage,
    // im Schub die Disk-Wartezeit der Nachbar-VM
    const botStory = !!s.bots || x.ioBurst;
    if (botStory) {
      card.io = String(!!x.ioBurst);
      card.extra = x.ioBurst
        ? `↳ IO-Schub: Disk-await ×${fmt(x.awaitMult, 1)}`
        : x.botShare > 0.005
          ? `↳ Bot: ${pct(x.botShare)} % der Last`
          : "↳ Nachbar-VM ruhig";
      card.title = `Bestandsprüfung: eine DB mit ${INV_CAP_E} E/s. Eine Produktseite kostet ${fmt(x.costPage, 2)} E — für Kunden wie für den Bot; der Bot macht ${pct(x.botShare)} % der Nachfrage (abgewiesen oder nicht). Die Nachbar-VM teilt das Storage: Disk-await ×${fmt(x.awaitMult, 2)}, Kapazität ${pct(x.capFactor)} %${x.ioBurst ? ` — IO-Schub läuft (${IO_BURST_S} s, bis ×${fmt(IO_BURST_AWAIT, 1)}), die DB schafft ≈ ${INV_PAGES_PER_S_IO} Seiten/s` : ""}. Kapazität in req/s beim aktuellen Mix.`;
    } else if (recStory) {
      card.rec = !r.on
        ? "aus"
        : r.breaker === "open" || r.breaker === "half"
          ? r.breaker
          : r.timedOut
            ? "timeout"
            : r.latS > r.baseS * 2
              ? "haengt"
              : "ok";
      card.extra = !r.on
        ? "↳ Empfehlungen aus"
        : r.breaker === "open"
          ? "↳ Empf.: Breaker offen"
          : r.breaker === "half"
            ? "↳ Empf.: Breaker prüft"
            : r.timedOut
              ? `↳ Empf. ${fmt(r.latS, 1)} s → Timeout`
              : r.latS > r.baseS * 2
                ? `↳ Empf. hängen: ${fmt(r.latS, 1)} s`
                : `↳ Empf. ${fmt(r.latS * 1000)} ms`;
      card.title = `Bestandsprüfung: eine DB mit ${INV_CAP_E} E/s. Produktseite jetzt ${fmt(x.costPage, 2)} E (Bestand ${fmt(INV_AVAIL_E, 1)} + Empfehlungen ${fmt(x.recoE, 2)}). Der Empfehlungsdienst fragt dieselbe DB ab; er antwortet jetzt nach ${fmt(r.latS, 2)} s (normal ${fmt(r.baseS, 2)} s)${r.breaker ? `, Breaker ${r.breaker === "open" ? "offen" : r.breaker === "half" ? "halb offen (Proben)" : "geschlossen"}` : ""}. Kapazität in req/s beim aktuellen Mix.`;
    } else if (lean) {
      card.extra =
        `↳ ${fmt(x.costPage, 2)} E/Seite` +
        (x.batchLatS > 0
          ? ` · +${BATCH_LAT_MS} ms`
          : x.cacheHit > 0
            ? ` · Cache ${CACHE_HIT_PCT} %`
            : x.recoE > 0
              ? ` · Empf. ${fmt(x.recoE, 1)} E`
              : " · Empf. aus");
      const avail = x.costPage - x.recoE;
      card.title = `Bestandsprüfung: eine DB mit ${INV_CAP_E} E/s. Produktseite jetzt ${fmt(x.costPage, 3)} E: Verfügbarkeit ${fmt(avail, 3)}${x.batchK > 1 ? ` (Bündel ≈ ${fmt(x.batchK)} Abfragen, +${BATCH_LAT_MS} ms)` : ""} + Empfehlungen ${fmt(x.recoE, 2)}${x.cacheHit > 0 ? ` (${CACHE_HIT_PCT} % aus dem Cache)` : ""}. Checkout-Reservierung ${fmt(INV_RESERVE_E, 1)} E — nie aus dem Cache, nie gebündelt. Kapazität in req/s beim aktuellen Mix.`;
    } else {
      card.extra =
        x.recoShare > 0
          ? `↳ ${four ? "Empf." : "Empfehlungen"}: ${pct(x.recoShare)} % der DB`
          : "↳ Empfehlungen aus";
      card.title = `Bestandsprüfung: eine DB mit ${INV_CAP_E} E/s. Produktseite ${fmt(INV_PAGE_E, 1)} E (Bestand ${fmt(INV_AVAIL_E, 1)} + Empfehlungen ${fmt(INV_RECO_E, 1)}), Checkout-Reservierung ${fmt(INV_RESERVE_E, 1)} E. Kapazität in req/s beim aktuellen Mix.`;
    }
  } else if (k === "mail") {
    card.mail = x.mode;
    const async = x.mode === "async";
    card.full = async ? String(qBad) : null;
    card.extra = async ? "↳ asynchron (Puffer)" : "↳ Kunde wartet mit";
    card.title = async
      ? `Mailversand mit Puffer: Die Bestellung ist sofort bestätigt, die Mail kommt später. Puffer ${fmt(x.queue)} von höchstens ${fmt(MAIL_Q_MAX)} Mails, keine älter als ${MAIL_MAX_AGE_S} s — bei ${fmt(x.rate)} Mails/s (Mittel über ${MAIL_MAX_AGE_S} s) also ${fmt(x.queueMax)}; verloren jetzt ${fmt(x.lost)} Mails/s. Als Nachfrage zählt der Zufluss geglättet über ${MAIL_SMOOTH_TAU_S} s: ${fmt(x.demand)} Mails/s (gerade ${fmt(x.demandNow)}).`
      : `Mailversand: eine Bestätigungsmail je Zahlung, ${MAIL_CAP} Mails/s (extern, SMTP-Relay). Synchron im Checkout: Der Kunde wartet auf seine Mail (Basis ${fmt(MAIL_LAT_S * 1000)} ms), nach ${MAIL_GIVEUP_S} s bricht der Shop ab. Jetzt ${fmt(x.cap)} Mails/s, Nachfrage ${fmt(x.demand)}, Wartezeit ${fmt(x.wait, 1)} s.`;
  } else if (rv) {
    // Zahlung mit Versuchen (Retry-Sturm): Verstärkung und Spitze der
    // Retries, Breaker, Brownout
    card.amp = fmt(rv.amp, 1);
    card.brownout = String(rv.brown);
    card.breaker = x.breaker;
    card.extra =
      x.breaker === "open"
        ? `↻ ×${fmt(rv.amp, 1)} · Breaker offen`
        : x.breaker === "half"
          ? `↻ ×${fmt(rv.amp, 1)} · Breaker prüft`
          : rv.storm
            ? `↻ ×${fmt(rv.amp, 1)} · Spitze ${fmt(rv.wave, 1)}×`
            : rv.budget
              ? `↻ ×${fmt(rv.amp, 1)} · Budget ${RETRY_BUDGET_PCT} %`
              : rv.brown
                ? `Brownout ${PAY_BROWNOUT_PCT} % · ↻ ×${fmt(rv.amp, 1)}`
                : `extern · Vertrag ${PAY_CAP}/s`;
    card.title = `Zahlungsdienst: extern, ${PAY_CAP}/s laut Vertrag${rv.brown ? `, jetzt im Brownout (${PAY_BROWNOUT_PCT} %)` : ""}. Letzte 10 s: ${fmt(rv.tries)} Versuche/s, davon ${fmt(rv.retries)} Retries — ×${fmt(rv.amp, 2)} je Zahlung; Spitze der Retries ${fmt(rv.wave, 2)}× ihr Mittel. Der Anbieter rechnet ${fmt(rv.waste)}/s für Clients, die nicht mehr warten. Retries: ${retryLabel(rv.mode)}, bis zu ${rv.maxAttempts} Versuche, Timeout ${fmt(rv.timeoutS)} s${rv.budget ? `, Budget ${RETRY_BUDGET_PCT} %` : ""}${x.breaker ? `, Breaker ${x.breaker === "open" ? "offen" : x.breaker === "half" ? "halb offen (Proben)" : "geschlossen"}` : ""}.`;
  } else {
    card.extra = `extern · Vertrag ${PAY_CAP}/s`;
    card.title = `Zahlungsdienst: extern, ${PAY_CAP} Checkouts/s laut Vertrag, eigene Schwankungen. Nicht horizontal skalierbar.`;
  }
  return card;
}

function pushView() {
  if (!sim) return;
  const s = sim.snapshot();
  const ls = sim.lastSample || {};
  const util = {
    web: ls.utilWeb ?? s.stations.web.util,
    inv: ls.utilInv ?? s.stations.inv.util,
    pay: ls.utilPay ?? s.stations.pay.util,
    mail: ls.utilMail ?? s.stations.mail?.util ?? 0,
  };
  // Zahlung mit Versuchen: Verstärkung über 10 s, Spitze wie die Frage
  // „Wie kommen die Retries an?“ (retryWaveRatio)
  let rv = null;
  if (s.retry.layer) {
    const m = sim.summarize(Math.max(0, sim.t - 10), sim.t);
    rv = {
      amp: m.amp,
      tries: m.tries,
      retries: m.retries,
      // Spitze nur, wenn es einen Sturm gibt — bei einer Handvoll Retries
      // (Budget) wäre jede einzelne Sekunde eine „Spitze“
      storm: m.retries > 0.15 * Math.max(1, m.firsts),
      waste: m.payWaste,
      wave: retryWaveRatio(sim),
      brown: s.stations.pay.brownout,
      mode: s.retry.mode,
      maxAttempts: s.retry.maxAttempts,
      timeoutS: s.retry.timeoutS,
      budget: s.retry.budget,
      incident: s.retry.incident,
    };
  }
  // Kette: drei Stationen, mit Mailversand vier (Kurze Spitzen)
  const cards = sim.stations.map((k) =>
    cardOf(k, s.stations[k], s, util[k], k === "pay" ? rv : null),
  );
  let kpi = {
    okB: 0,
    okC: 0,
    rej: 0,
    lost: 0,
    deg: 0,
    mailSent: 0,
    mailLost: 0,
    custOk: 0,
    custRej: 0,
    botOk: 0,
    botRej: 0,
  };
  if (!isCause && sim.t >= 2) {
    const m = sim.summarize(Math.max(0, sim.t - 10), sim.t);
    kpi = {
      okB: m.okBrowse,
      okC: m.okCheckout,
      rej: m.rejected,
      lost: m.lost,
      deg: m.degraded,
      mailSent: m.mail.sent,
      mailLost: m.mail.lost,
      // Bot-Ansturm: Kundenseiten und Kunden (Seiten + Checkouts) getrennt
      custOk: m.customers.okB,
      custRej: m.customers.rejected,
      botOk: m.bot.ok,
      botRej: m.bot.rejected,
    };
  }
  let hosts = null;
  if (isCause) {
    const web = s.stations.web;
    const n = Math.max(1, web.instances.running);
    hosts = {
      n,
      webPer: web.cap / n,
      webNomPer: web.capNominal / n,
      steal: s.hosts.web.stealPct,
      awaitMs: s.hosts.db.awaitMs,
      dbSteal: s.hosts.db.stealPct,
      hidden: s.hidden,
    };
  }
  view.value = {
    t: s.t,
    load: s.load,
    io: s.stations.inv.ioBurst, // Bot-Ansturm: IO-Schub der Nachbar-VM
    bots: s.bots, // Bot-Ansturm: Bot, Rate Limit, Admission (sonst null)
    retries: s.retry.layer ? s.retry.retries : 0, // req/s Retries (Lastknoten)
    rv,
    cards,
    bottleneck: s.bottleneck,
    knappste: s.knappste,
    overloaded: s.overloaded,
    win: s.win,
    kpi,
    hosts,
  };
}

/* Sparklines der Nachbar-VM (Wahrheit) mit Gast-Spur darüber, 4 Hz. */
function computeSpark() {
  if (!isCause || !sim || !nbShown.value) return;
  const win = def.value.windowS;
  const hist = sim.history(win);
  const t0 = sim.t - win;
  const Y = 16;
  let cpu = `M0 ${Y}`;
  let io = `M0 ${Y}`;
  let st = "";
  let aw = "";
  for (const s of hist) {
    const x1 = Math.max(0, s.t - t0);
    const x0 = Math.max(0, x1 - 1);
    const yc = s.nbPhase === "cpu" ? 3 : Y - 1;
    const yi = s.nbPhase === "io" ? 3 : Y - 1;
    cpu += ` L${x0} ${yc} L${x1} ${yc}`;
    io += ` L${x0} ${yi} L${x1} ${yi}`;
    const ys = Y - 1 - Math.min(1, s.webSteal / 50) * (Y - 2);
    const ya =
      Y -
      1 -
      Math.min(1, Math.max(0, s.dbAwaitMs / DB_AWAIT_BASE_MS - 1) / 1.2) *
        (Y - 2);
    st += `${st ? " L" : "M"}${x1} ${ys.toFixed(1)}`;
    aw += `${aw ? " L" : "M"}${x1} ${ya.toFixed(1)}`;
  }
  cpu += ` L${win} ${Y} Z`;
  io += ` L${win} ${Y} Z`;
  spark.value = { cpu, io, st, aw, w: win };
}

function refresh() {
  if (!sim) return;
  pushView();
  simT.value = sim.t;
  computeSpark();
  requestDraw();
}

function requestDraw() {
  if (rafDraw != null) return;
  rafDraw = requestAnimationFrame(() => {
    rafDraw = null;
    drawAll();
  });
}

function sizeCanvas() {
  const wrap = chartWrap.value;
  const c = canvasEl.value;
  if (!wrap || !c) return;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w < 10 || h < 10) return; // verborgene Folie: clientWidth = 0
  W = w;
  H = h;
  const scale = wrap.offsetWidth
    ? wrap.getBoundingClientRect().width / wrap.offsetWidth
    : 1;
  dpr = (window.devicePixelRatio || 1) * (scale || 1);
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  drawAll();
}
/* Slidev skaliert die Folie per CSS-Transform: Fenstergröße, Vollbild oder
 * Pixeldichte ändern die Bildschirmauflösung des Canvas, ohne dass sich seine
 * Layout-Box ändert — der ResizeObserver sieht das nie. */
const onWinResize = () => requestAnimationFrame(sizeCanvas);
let dprMq = null;
function watchDpr() {
  dprMq?.removeEventListener?.("change", onDprChange);
  dprMq =
    window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ??
    null;
  dprMq?.addEventListener?.("change", onDprChange);
}
function onDprChange() {
  watchDpr();
  onWinResize();
}
/** Weicht die Pufferbreite um mehr als 3 % vom Soll ab (etwa nach einer
 * Größenänderung des Presenter-Layouts)? Dann neu dimensionieren. */
function canvasStale() {
  const wrap = chartWrap.value;
  const c = canvasEl.value;
  if (!wrap || !c || !c.width) return false;
  const want =
    wrap.getBoundingClientRect().width * (window.devicePixelRatio || 1);
  return want > 10 && Math.abs(want - c.width) > 0.03 * c.width;
}

function readPal() {
  const el = stageEl.value;
  const cs = el ? getComputedStyle(el) : null;
  const v = (n, d) => (cs ? cs.getPropertyValue(n).trim() : "") || d;
  return {
    ink: v("--wb-ink", "#14213d"),
    muted: v("--wb-muted", "#5a6878"),
    hair: v("--wb-hair", "#e2e8f0"),
    hairS: v("--wb-hair-strong", "#cbd5e1"),
    panel: v("--wb-panel", "#ffffff"),
    web: v("--wb-web", "#2563eb"),
    inv: v("--wb-inv", "#ea580c"),
    pay: v("--wb-pay", "#9333ea"),
    mail: v("--wb-mail", "#0e7490"),
    bad: v("--wb-bad", "#dc2626"),
    ok: v("--wb-ok", "#15803d"),
    shed: v("--wb-shed", "#94a3b8"),
    nbCpu: v("--wb-nb-cpu", "#be185d"),
    nbIo: v("--wb-nb-io", "#0f766e"),
    wait: v("--wb-wait", "#fcd34d"),
  };
}
/** Hex-Farbe a zu Anteil t über b gemischt (deckend, damit sich die
 * überlappenden Sekundenstreifen nicht zu dunkleren Streifen addieren). */
function mixHex(a, b, t) {
  const re = /^#([0-9a-f]{6})$/i;
  const ma = re.exec(a);
  const mb = re.exec(b);
  if (!ma || !mb) return a;
  const ca = parseInt(ma[1], 16);
  const cb = parseInt(mb[1], 16);
  const ch = (c, sh) => (c >> sh) & 255;
  const out = [16, 8, 0].map((sh) =>
    Math.round(ch(ca, sh) * t + ch(cb, sh) * (1 - t)),
  );
  return `#${out.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const MONO = "'0xProto', ui-monospace, Menlo, Consolas, monospace";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
/** Proben zu Läufen gleichen Schlüssels zusammenfassen: [tStart, tEnd, key].
 * Eine Fläche je Lauf statt je Sekunde — überlappende Halbtransparenz
 * ergäbe sonst Streifen. key(s) = null überspringt die Probe. */
function runs(hist, t0, key) {
  const out = [];
  let cur = null;
  for (const s of hist) {
    if (s.t <= t0) continue;
    const k = key(s);
    if (cur && k === cur[2] && s.t - 1 <= cur[1] + 1e-6) cur[1] = s.t;
    else {
      if (cur && cur[2] != null) out.push(cur);
      cur = [s.t - 1, s.t, k];
    }
  }
  if (cur && cur[2] != null) out.push(cur);
  return out;
}

/** Gleichzeitige Schalter-Marker (≤ 2 s) zu einem Label zusammenfassen. */
function groupMarkers(list) {
  const out = [];
  for (const m of list) {
    const last = out[out.length - 1];
    if (m.step == null && last && last.step == null && m.t - last.t <= 2) {
      last.n++;
      last.text = last.n > 2 ? `${last.n} Schalter` : `${last.text} ${m.text}`;
    } else out.push({ ...m, n: 1 });
  }
  return out;
}

// Linker Rand: Achsenbeschriftung; bei den Gegenmaßnahmen zusätzlich die
// gedrehten Achsentitel der beiden Felder.
const PAD = { l: isCause ? 40 : 50, r: 8, t: 3, b: 14 };
const BAND_H = 9;
const NB_H = 6; // Nachbar-Streifen (cause) unter dem Engpass-Band
const FONT_PX = 9; // kleinste Canvas-Schrift, logische px

function drawAll() {
  const c = canvasEl.value;
  if (!c || !sim || W < 10 || H < 20) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!pal) pal = readPal();
  const P = pal;
  const win = def.value.windowS;
  const t1 = Math.max(sim.t, win);
  const t0 = t1 - win;
  const xL = PAD.l;
  const xR = W - PAD.r;
  const x = (t) => xL + ((t - t0) / win) * (xR - xL);
  const hist = sim.history(win + 1);
  const yBand = PAD.t;
  // cause: Platz für den Nachbar-Streifen immer frei halten, sonst springt
  // das Diagramm beim Aufdecken
  const yNb = yBand + BAND_H + 2;
  const yTop = isCause ? yNb + NB_H + 6 : yBand + BAND_H + 7;
  const yBot = H - PAD.b;

  // Engpass-Band: satt = Engpass, blass = knappste Station. Im Dark Mode
  // braucht „blass“ mehr Deckung, sonst wird es dunkler als der Grund.
  ctx.save();
  ctx.fillStyle = P.hair;
  ctx.fillRect(xL, yBand, xR - xL, BAND_H);
  const paleA = isDark.value ? 0.55 : 0.3;
  for (const [ta, tb, k] of runs(hist, t0, (s) => (s.bn ? `!${s.bn}` : s.kn))) {
    const bn = k.startsWith("!");
    ctx.globalAlpha = bn ? 1 : paleA;
    ctx.fillStyle = P[bn ? k.slice(1) : k];
    ctx.fillRect(x(ta), yBand, x(tb) - x(ta), BAND_H);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.muted;
  ctx.font = `${FONT_PX}px ${SANS}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Engpass", 2, yBand + BAND_H / 2 + 0.5);
  // Nachbar-Streifen (nur aufgedeckt): Schübe direkt unter dem Band — Schub
  // und Engpass stehen übereinander. Isoliert (🏠): blass, ohne Wirkung.
  if (isCause && nbShown.value) {
    ctx.fillStyle = P.hair;
    ctx.fillRect(xL, yNb, xR - xL, NB_H);
    const key = (s) =>
      s.nbPhase === "idle" ? null : `${s.nbPhase}${s.nbAffects ? "" : "~"}`;
    for (const [ta, tb, k] of runs(hist, t0, key)) {
      ctx.globalAlpha = k.endsWith("~") ? 0.35 : 1;
      ctx.fillStyle = k.startsWith("cpu") ? P.nbCpu : P.nbIo;
      ctx.fillRect(x(ta), yNb, x(tb) - x(ta), NB_H);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.muted;
    ctx.fillText("Nachbar", 2, yNb + NB_H / 2 + 1);
  }
  ctx.restore();

  if (isCause) drawCause(ctx, P, hist, x, t0, yTop, yBot, xL, xR);
  else drawRemedies(ctx, P, hist, x, t0, yTop, yBot, xL, xR);

  // Marker: Drehbuch-Züge ①… und ±Schalter
  ctx.save();
  ctx.font = `600 ${FONT_PX}px ${SANS}`;
  ctx.textBaseline = "top";
  const rowEnd = [-1e9, -1e9]; // zwei Zeilen, damit dichte Marker lesbar bleiben
  for (const m of groupMarkers(markers)) {
    if (m.t < t0 || m.t > t1) continue;
    const mx = Math.round(x(m.t)) + 0.5;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1; // der Ring der Drehbuch-Scheibe setzt 1,5
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, yTop);
    ctx.lineTo(mx, yBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (m.step != null) {
      // Drehbuch-Zug: Ziffer in einer gefüllten Scheibe (Unicode-Kreisziffern
      // sind bei 9 px unleserlich, ein hohler Kreis verschwindet im Dunkeln).
      // Der Ring in Panel-Farbe trennt die Scheibe von Gitter und Kurven.
      const cy = yTop + 6.5;
      ctx.fillStyle = P.ink;
      ctx.strokeStyle = P.panel;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, cy, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = P.panel;
      ctx.font = `700 9px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(m.step), mx, cy + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `600 ${FONT_PX}px ${SANS}`;
      rowEnd[0] = Math.max(rowEnd[0], mx + 8);
      continue;
    }
    const tw = ctx.measureText(m.text).width;
    const lx = Math.min(mx + 2, xR - tw - 1);
    const row = lx > rowEnd[0] + 3 ? 0 : lx > rowEnd[1] + 3 ? 1 : -1;
    if (row < 0) continue; // beide Zeilen belegt: nur die Linie
    rowEnd[row] = lx + tw;
    const ly = yTop + 1 + row * 11;
    ctx.fillStyle = P.panel;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(lx - 1, ly - 1, tw + 2, 11);
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.ink;
    ctx.fillText(m.text, lx, ly);
  }
  ctx.restore();

  // Zeitachse
  ctx.save();
  ctx.fillStyle = P.muted;
  ctx.strokeStyle = P.hairS;
  ctx.font = `${FONT_PX}px ${MONO}`;
  ctx.textBaseline = "alphabetic";
  ctx.beginPath();
  // Kurze Fenster (Vorfall im Sekundentakt): Striche je 10 s, Beschriftung
  // je 30 s; sonst je Minute bzw. 2 Minuten
  const short = win <= 180;
  const tick = short ? 10 : 60;
  for (let t = Math.ceil(t0 / tick) * tick; t <= t1 + 1e-6; t += tick) {
    const tx = Math.round(x(t)) + 0.5;
    ctx.moveTo(tx, yBot);
    ctx.lineTo(tx, yBot + 3);
  }
  ctx.stroke();
  const lab = (t, s) => {
    const tx = x(t);
    const tw = ctx.measureText(s).width;
    ctx.fillText(s, Math.max(xL, Math.min(xR - tw, tx - tw / 2)), H - 2);
  };
  if (isCause) {
    lab(t1 - win, `−${winMin.value} min`);
    lab(t1 - win / 2, `−${winMin.value / 2} min`);
    lab(t1, "jetzt");
  } else {
    const step = short ? 30 : 120;
    for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-6; t += step)
      lab(t, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
  }
  ctx.restore();
}

function drawCause(ctx, P, hist, x, t0, yTop, yBot, xL, xR) {
  // 60 … 160 %: Ein Nachbar-Schub (bis 40 % Steal) treibt Nachfrage /
  // Kapazität auf ≈ 150 % — bei 130 % gekappt sähe das wie eine Grenze aus.
  // Unter 60 % liegt nur der Zahlungsdienst (≈ 25–40 %), flach am Boden.
  const lo = 60;
  const hi = 160;
  const y = (v) =>
    yBot - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (yBot - yTop);
  ctx.save();
  // Überlast-Zone über 100 % (Legende: „über 100 % = Überlast“)
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = P.bad;
  ctx.fillRect(xL, y(hi), xR - xL, y(100) - y(hi));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const g of [80, 130]) {
    const gy = Math.round(y(g)) + 0.5;
    ctx.moveTo(xL, gy);
    ctx.lineTo(xR, gy);
  }
  ctx.stroke();
  ctx.strokeStyle = P.bad;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  const y100 = Math.round(y(100)) + 0.5;
  ctx.moveTo(xL, y100);
  ctx.lineTo(xR, y100);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = P.muted;
  ctx.font = `${FONT_PX}px ${MONO}`;
  ctx.textBaseline = "middle";
  for (const g of [80, 100, 130]) ctx.fillText(`${g} %`, 2, y(g));
  ctx.fillText(`${hi} %`, 2, y(hi) + 4);
  ctx.fillText(`≤${lo} %`, 2, yBot - 4);
  // Nachfrage / Kapazität je Station (aus der geglätteten Reserve)
  const key = { web: "resWeb", inv: "resInv", pay: "resPay" };
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  for (const st of ["pay", "inv", "web"]) {
    ctx.strokeStyle = P[st];
    ctx.beginPath();
    let started = false;
    for (const s of hist) {
      if (s.t < t0) continue;
      const v = 100 / (1 + s[key[st]]);
      const px = x(s.t);
      const py = y(v);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = P.muted;
  ctx.font = `600 ${FONT_PX}px ${SANS}`;
  ctx.textBaseline = "top";
  ctx.fillText("Nachfrage / Kapazität", xL + 4, yBot - 12);
  ctx.restore();
}

/** Gedrehter Achsentitel links neben einem Feld. */
function axisTitle(ctx, text, yA, yB) {
  ctx.save();
  ctx.translate(7, (yA + yB) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawRemedies(ctx, P, hist, x, t0, yTop, yBot, xL, xR) {
  const yMid = yTop + Math.round((yBot - yTop) * 0.6);
  const aTop = yTop;
  const aBot = yMid - 4;
  const bTop = yMid + 6;
  const bBot = yBot;
  // Skala des oberen Felds je Szenario: 300 / 600 / 1.200 req/s (Rabattaktion
  // und Teure Abfragen 1.200, Empfehlungen hängen 300; der Bot zählt mit)
  const peak =
    Math.max(...def.value.load.map((l) => l[1])) +
    (def.value.bot ? Math.max(...def.value.bot.map((b) => b[1])) : 0);
  const A_MAX = [300, 600, 1200].find((m) => m >= 1.15 * peak) ?? 1200;
  // Retry-Sturm: unten die Versuche am Zahlungsdienst (bis zu 3 × 50 und
  // Spitzen darüber, oben gekappt); Kurze Spitzen: Checkouts und Mails
  // gegen den Mailversand; sonst die Checkouts
  // Bot-Ansturm: unten die Produktseiten — Kunden (Nachfrage, rechtzeitig),
  // Bot (rechtzeitig), was die DB schafft, und das statische Limit
  const retryL = !!def.value.retryLayer;
  const mailL = !!def.value.mail;
  const botL = !!def.value.bot;
  const B_MAX = retryL ? 200 : mailL ? 100 : botL ? 400 : 150;
  const ya = (v) =>
    aBot - (Math.min(A_MAX, Math.max(0, v)) / A_MAX) * (aBot - aTop);
  const yb = (v) =>
    bBot - (Math.min(B_MAX, Math.max(0, v)) / B_MAX) * (bBot - bTop);
  ctx.save();
  /* Beschriftung hinterlegter Bänder (IO-Schub, Blitzangebot, Admission) im
   * Feld, mit Schrift und Farbe des Aufrufers: in jedem Band, das breit
   * genug ist; ein schmales letztes Band (gerade erst begonnen, oder 30 s in
   * 10 min) bekommt sie trotzdem, rechtsbündig an seinem Ende. */
  const bandLabels = (text, bands, y, right = false) => {
    const lw = ctx.measureText(text).width;
    bands.forEach(([ta, tb], i) => {
      const xa = x(ta);
      const xb = Math.min(xR, x(tb));
      if (xb - xa > lw + 6) ctx.fillText(text, right ? xb - lw - 3 : xa + 3, y);
      else if (i === bands.length - 1 && xb - lw - 3 >= xL)
        ctx.fillText(text, xb - lw - 3, y);
    });
  };
  // Brownout des Zahlungsdienstes (Störung): blass hinterlegt, über beide
  // Felder — darin und danach spielt der Retry-Sturm
  if (retryL) {
    const brown = runs(hist, t0, (s) => (s.brown ? 1 : null));
    ctx.fillStyle = P.pay;
    ctx.globalAlpha = isDark.value ? 0.16 : 0.09;
    for (const [ta, tb] of brown)
      ctx.fillRect(x(ta), yTop, x(tb) - x(ta), yBot - yTop);
    // Beschriftung im Feld statt in der Legende (die ist voll): unter dem
    // Kreis des Drehbuch-Zugs, über den Stapeln
    ctx.globalAlpha = 1;
    ctx.font = `600 ${FONT_PX}px ${SANS}`;
    ctx.textBaseline = "top";
    const lw = ctx.measureText("Brownout").width + 4;
    for (const [ta, tb] of brown)
      if (x(tb) - x(ta) > lw && x(ta) + lw <= xR)
        ctx.fillText("Brownout", x(ta) + 3, yTop + 16);
  }
  // Bot-Ansturm: IO-Schub der Nachbar-VM blass hinterlegt (Farbe wie
  // „Nachbar IO“ auf der Ursachen-Folie), beschriftet im Feld
  if (botL) {
    const io = runs(hist, t0, (s) => (s.io ? 1 : null));
    ctx.fillStyle = P.nbIo;
    ctx.globalAlpha = isDark.value ? 0.16 : 0.1;
    for (const [ta, tb] of io)
      ctx.fillRect(x(ta), yTop, x(tb) - x(ta), yBot - yTop);
    ctx.globalAlpha = 1;
    ctx.font = `600 ${FONT_PX}px ${SANS}`;
    ctx.textBaseline = "top";
    bandLabels("IO-Schub", io, yTop + 16);
  }
  // Kurze Spitzen: Blitzangebote (und Dauerlast) blass hinterlegt, über
  // beide Felder; beschriftet das letzte, rechtsbündig (30 s in 10 min)
  if (mailL) {
    ctx.fillStyle = P.mail;
    ctx.globalAlpha = isDark.value ? 0.16 : 0.08;
    const waves = runs(hist, t0, (s) => (s.wave > 0.5 ? 1 : null));
    for (const [ta, tb] of waves)
      ctx.fillRect(x(ta), yTop, x(tb) - x(ta), yBot - yTop);
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.mail;
    ctx.font = `600 ${FONT_PX}px ${SANS}`;
    ctx.textBaseline = "top";
    // im unteren Feld oben: über 60 Checkouts/s ist es frei, oben reichen
    // die Stapel in der Welle bis an den Rand
    bandLabels("Blitzangebot", waves, bTop + 1);
  }
  // Gitter
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const g of [A_MAX / 2, A_MAX]) {
    const gy = Math.round(ya(g)) + 0.5;
    ctx.moveTo(xL, gy);
    ctx.lineTo(xR, gy);
  }
  for (const gy of [Math.round(aBot) + 0.5, Math.round(yb(0)) + 0.5]) {
    ctx.moveTo(xL, gy);
    ctx.lineTo(xR, gy);
  }
  ctx.stroke();
  /* Gestapelt nach dem Verbleib der Nachfrage: rechtzeitig / früh
   * abgewiesen / verloren, gezählt beim Abschluss. Was noch in einer Queue
   * wartet, füllt die Lücke bis zur Nachfrage („wartet“). Baut sich ein
   * Rückstau ab (mehr Abschlüsse als Ankünfte), wird der Stapel auf die
   * Nachfrage gedeckelt und im Verhältnis der Abschlüsse aufgeteilt — sonst
   * zeigte das Diagramm beim Wechsel des Engpasses erst eine Kerbe, dann
   * eine Spitze über der Nachfrage. Die Höhe des Stapels IST die Nachfrage.
   * Rechtzeitig ohne Empfehlungen (degradiert: Timeout, offener Breaker)
   * steht blass über dem vollen Grün (wie in der Legende: 45 % Deckung). */
  const okDeg = mixHex(P.ok, P.panel, 0.45);
  for (const s of hist) {
    if (s.t <= t0) continue;
    const xa = x(s.t - 1);
    const w = x(s.t) - xa + 0.6;
    const ok = s.okB + s.okC;
    const deg = Math.min(ok, s.degB ?? 0);
    const rej = s.shed + s.r503 + s.r429;
    const done = ok + rej + s.lost;
    const dem = Math.max(0, s.load);
    const f = done > dem && done > 0 ? dem / done : 1;
    let base = 0;
    for (const [val, col] of [
      [(ok - deg) * f, P.ok],
      [deg * f, okDeg],
      [rej * f, P.shed],
      [s.lost * f, P.bad],
      [dem - done * f, P.wait],
    ]) {
      if (val <= 0.5) continue;
      ctx.fillStyle = col;
      const yA = ya(base + val);
      ctx.fillRect(xa, yA, w, ya(base) - yA);
      base += val;
    }
  }
  ctx.globalAlpha = 1;
  const line = (pick, yf, col, dash, lw) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    for (const s of hist) {
      if (s.t < t0) continue;
      const px = x(s.t);
      const py = yf(pick(s));
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (retryL) {
    // Zahlung: Kapazität jetzt (Brownout sichtbar), Erstversuche (=
    // Checkout-Nachfrage), alle Versuche mit Retries, Bestellungen
    line((s) => s.payCap, yb, P.pay, [1.5, 2.5], 1.2);
    line((s) => s.demandC, yb, P.pay, [4, 3], 1.2);
    line((s) => s.tryP, yb, P.pay, [], 1.8);
    line((s) => Math.min(s.okC, s.demandC), yb, P.ok, [], 1.6);
  } else if (botL) {
    // Produktseiten: was die DB jetzt schafft (im IO-Schub weniger), das
    // statische Limit (solange Admission an ist), Kunden-Nachfrage,
    // Kundenseiten rechtzeitig, Bot rechtzeitig
    line((s) => s.invPages, yb, P.inv, [1.5, 2.5], 1.2);
    ctx.strokeStyle = P.muted;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([1, 2]);
    const yA = Math.round(yb(ADMISSION_RPS)) + 0.5;
    const adm = runs(hist, t0, (s) => (s.admOn ? 1 : null));
    ctx.beginPath();
    for (const [ta, tb] of adm) {
      ctx.moveTo(x(ta), yA);
      ctx.lineTo(x(tb), yA);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    line((s) => s.custDemB, yb, P.ok, [4, 3], 1.2);
    // rechtzeitig höchstens die Nachfrage (wie der Stapel oben): Baut sich
    // ein Rückstau ab, zählte die Schätzung der Wartezeit ihn sonst als
    // Spitze über der Nachfrage
    line((s) => Math.min(s.custOkB, s.custDemB), yb, P.ok, [], 1.6);
    line((s) => Math.min(s.botOk, s.botIn), yb, P.ink, [], 1.4);
    // Beschriftung des Limits im Feld, über der Linie
    ctx.fillStyle = P.muted;
    ctx.font = `${FONT_PX}px ${SANS}`;
    ctx.textBaseline = "bottom";
    bandLabels(`Admission ${ADMISSION_RPS}/s`, adm, yA - 2, true);
  } else if (mailL) {
    // Mailversand: Kapazität jetzt, Checkouts (Nachfrage), Bestellungen,
    // verschickte Mails — mit Puffer laufen sie über die Welle hinaus
    // weiter; verlorene Mails rot
    line((s) => s.mailCap, yb, P.mail, [1.5, 2.5], 1.2);
    line((s) => s.demandC, yb, P.pay, [4, 3], 1.2);
    line((s) => Math.min(s.okC, s.demandC), yb, P.ok, [], 1.6);
    line((s) => s.mailSent, yb, P.mail, [], 1.8);
    line((s) => s.mailLost, yb, P.bad, [], 1.4);
  } else {
    // Checkouts: Limit, Nachfrage, rechtzeitig
    ctx.strokeStyle = P.pay;
    ctx.setLineDash([1.5, 2.5]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const yL = Math.round(yb(PAY_CAP)) + 0.5;
    ctx.moveTo(xL, yL);
    ctx.lineTo(xR, yL);
    ctx.stroke();
    ctx.setLineDash([]);
    line((s) => s.demandC, yb, P.pay, [4, 3], 1.2);
    // rechtzeitig höchstens die Nachfrage, wie der Stapel oben (nach einem
    // Zug, der einen Rückstau löst — etwa Bulkheads —, sonst eine Spitze)
    line((s) => Math.min(s.okC, s.demandC), yb, P.ok, [], 1.6);
  }
  // Achsen: gedrehte Titel ganz links, Werte daneben. Das untere Feld
  // beginnt sichtbar neu (eigener Titel, keine „150“ direkt unter der „0“).
  ctx.fillStyle = P.muted;
  ctx.font = `600 ${FONT_PX}px ${SANS}`;
  axisTitle(ctx, "Anfragen/s", aTop, aBot);
  axisTitle(
    ctx,
    retryL ? "Zahlung/s" : botL ? "Seiten/s" : "Checkouts/s",
    bTop,
    bBot,
  );
  ctx.font = `${FONT_PX}px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.fillText(fmt(A_MAX), 14, ya(A_MAX) + 4);
  ctx.fillText(fmt(A_MAX / 2), 14, ya(A_MAX / 2));
  ctx.fillText("0", 14, ya(0) - 3);
  if (retryL || mailL || botL) ctx.fillText(fmt(B_MAX), 14, yb(B_MAX) + 4);
  const mid = mailL ? MAIL_CAP : botL ? ADMISSION_RPS : PAY_CAP;
  ctx.fillText(String(mid), 14, yb(mid));
  ctx.fillText("0", 14, yb(0) - 3);
  ctx.restore();
}

/* ===== 9 · Schleife und Lebenszyklus ===== */

/** Ende des Zeitraffers der wiederholten Störung (Sim-s), sonst null. */
function boostEnd() {
  if (isCause || scr.phase !== "pending" || scr.idx < 1) return null;
  const st = steps.value[scr.idx];
  if (st?.event !== "stoerung" || st.settle <= PAY_BROWNOUT_S) return null;
  return scr.appliedAt + PAY_BROWNOUT_S - BOOST_LEAD_S;
}
function frame(ts) {
  animId = null;
  if (!sim || !playing.value || !canRun.value) return;
  const dtWall = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  const bEnd = boostEnd();
  const fast = bEnd !== null && sim.t < bEnd && speed.value < BOOST_SPEED;
  stepSim(
    fast
      ? Math.min(
          dtWall * BOOST_SPEED,
          Math.max(dtWall * speed.value, bEnd - sim.t),
        )
      : dtWall * speed.value,
  );
  frameNo++;
  // Karten, Pill und Fußzeile ≈ 2,5 Hz: Zahlen, die jeden Frame springen,
  // kann niemand lesen. Das Canvas läuft weiter mit voller Rate.
  if (frameNo % 24 === 0) pushView();
  if (frameNo % 15 === 0) {
    simT.value = sim.t; // ≈ 4 Hz ([data-sim-t], Uhr)
    computeSpark();
  }
  if (frameNo % 60 === 0 && canvasStale()) sizeCanvas();
  drawAll();
  if (playing.value && canRun.value) animId = requestAnimationFrame(frame);
}
function startLoop() {
  if (animId != null || !sim || !playing.value || !canRun.value) return;
  if (reduceMotion) return;
  lastTs = 0;
  animId = requestAnimationFrame(frame);
}
function stopLoop() {
  if (animId != null) cancelAnimationFrame(animId);
  animId = null;
}
function activate() {
  requestAnimationFrame(sizeCanvas);
  if (isCause && !autoplayed && !reduceMotion) {
    autoplayed = true;
    playing.value = true;
  }
  startLoop();
}

watch(playing, (p) => {
  if (p) startLoop();
  else {
    stopLoop();
    refresh();
  }
});
watch(canRun, (on) => {
  if (on) activate();
  else {
    stopLoop();
    if (sim) simT.value = sim.t;
  }
});
watch(isDark, () => {
  pal = null;
  requestAnimationFrame(() => drawAll());
});
watch(nbShown, () => {
  computeSpark();
  requestDraw();
});

// Startzustand synchron (vor dem ersten Rendern), Canvas nach dem Mount
seed = pickStartSeed(scenario.value);
if (isCause) buildCause({});
else jumpToStep(0);

onMounted(() => {
  sizeCanvas();
  resizeObs = new ResizeObserver(() => requestAnimationFrame(sizeCanvas));
  if (chartWrap.value) resizeObs.observe(chartWrap.value);
  window.addEventListener("resize", onWinResize);
  watchDpr();
  if (canRun.value) activate();
});
onUnmounted(() => {
  stopLoop();
  window.removeEventListener("resize", onWinResize);
  dprMq?.removeEventListener?.("change", onDprChange);
  dprMq = null;
  if (rafDraw != null) cancelAnimationFrame(rafDraw);
  rafDraw = null;
  resizeObs?.disconnect();
  clearTimeout(wipeTimer);
  clearTimeout(pulseTimer);
  sim = null;
});

/* Knöpfe in Header und Preset-Zeile: Farben inline (style.css überschreibt
 * dort Hintergrund und Rand im Dark Mode mit hoher Spezifität). */
function tStyle(on) {
  const c = C.value;
  return {
    background: on ? c.panel : c.panelHi,
    color: c.textHi,
    border: `1px solid ${on ? c.phosphor : c.border}`,
    boxShadow: on ? `inset 0 0 0 1px ${c.phosphor}` : "none",
  };
}
</script>

<template>
  <SimShell
    ref="shellRef"
    :eyebrow="eyebrow"
    :title="title"
    :subtitle="subtitle"
    :presets="presets"
    :presets-label="isCause ? 'Ursache:' : 'Szenario:'"
    :model-value="scenario"
    gear-title="Experimentieren"
    show-reset
    reset-label="↺ Neu"
    reset-title="Szenario neu starten: gleicher Zufall (Seed), Schalter zurück"
    @pointerup.capture="blurLater"
    @update:model-value="selectScenario"
    @reset="resetScenario"
  >
    <template #transport>
      <button
        class="wb-tbtn wb-play"
        :style="tStyle(playing)"
        :aria-pressed="playing"
        :title="playTitle"
        @click="togglePlay"
      >
        {{ playLabel }}
      </button>
      <span
        v-if="!reduceMotion"
        class="wb-speed"
        role="group"
        aria-label="Zeitraffer"
      >
        <button
          v-for="s in SPEEDS"
          :key="s"
          class="wb-tbtn wb-seg"
          :style="tStyle(speed === s)"
          :aria-pressed="speed === s"
          :title="`Zeitraffer: ${s} Sim-Sekunden je Sekunde`"
          @click="speed = s"
        >
          ×{{ s }}
        </button>
      </span>
      <button
        class="wb-tbtn wb-ff"
        :style="tStyle(false)"
        :title="ffTitle"
        @click="fastForward"
      >
        ⏩ +5 min
      </button>
    </template>

    <template v-if="isCause" #presets-extra>
      <span class="wb-sep" aria-hidden="true" />
      <button
        v-for="s in CAUSE_SW"
        :key="s.key"
        class="wb-cm wb-sw"
        :class="{ 'wb-dim': swDim(s.key) }"
        role="switch"
        :data-cm="s.key"
        :aria-checked="swOn(s.key)"
        :disabled="swDisabled(s.key)"
        :title="swTitle(s)"
        :style="tStyle(swOn(s.key))"
        @click="toggleCauseSwitch(s.key)"
      >
        {{ s.label }}
      </button>
    </template>

    <template #stage>
      <div
        ref="stageEl"
        class="wb-stage"
        :class="isCause ? 'wb-v-cause' : 'wb-v-remedies'"
        :data-variant="variant"
        :data-scenario="scenario"
        :data-bottleneck="view?.bottleneck ?? 'none'"
        :data-step="isCause ? '' : String(scr.idx)"
        :data-phase="isCause ? 'sandbox' : scr.phase"
        :data-ask="curAsk"
      >
        <div class="wb-top">
          <Tabs
            class="wb-tabs"
            :tabs="TABS"
            :model-value="activeTab"
            aria-label="Ansicht wählen"
            @update:model-value="(v) => (activeTab = v)"
          />
          <span class="wb-pill" :class="pill.cls">
            <span class="wb-pill-k">{{ pill.lead }}</span>
            <i class="wb-sq" :class="`wb-st-${pill.st}`" />
            <b>{{ pill.name }}</b>
            <template v-if="pill.state"> · {{ pill.state }}</template>
          </span>
          <span
            class="wb-clock"
            :data-sim-t="simT.toFixed(1)"
            title="Sim-Zeit (Minuten:Sekunden) · Zeitraffer"
            >t = {{ clock }} · {{ clockTempo ?? `×${speed}` }}</span
          >
        </div>

        <div
          v-show="activeTab === 'sim'"
          class="wb-body"
          :class="isCause ? 'wb-body-cause' : 'wb-body-remedies'"
        >
          <div class="wb-main">
            <!-- Kette: Last → drei Stationen -->
            <div
              v-if="view"
              class="wb-chain wb-grid"
              :class="{ 'wb-chain-4': view.cards.length > 3 }"
            >
              <div
                class="wb-load"
                :title="`Last = Gesamtnachfrage: Produktseiten + Checkouts (${CONV_PCT} % der rechtzeitig ausgelieferten Produktseiten)${isCause ? '. Konstant im Mittel; „Ist“ = Ankünfte gerade' : ''}`"
              >
                <div class="wb-load-k">Last</div>
                <!-- Ursache: angebotene Last konstant, die Ankünfte schwanken
                     um diesen Wert („Ist“) — wie „Last …“ auf den Karten -->
                <div class="wb-load-n">
                  {{ fmt(isCause ? view.load.nominal : view.load.total) }}
                </div>
                <div class="wb-load-u">req/s{{ isCause ? " konst." : "" }}</div>
                <div
                  v-if="isCause"
                  class="wb-load-ist"
                  title="Ankünfte gerade (schwanken um den konstanten Mittelwert)"
                >
                  Ist {{ fmt(view.load.total) }}
                </div>
                <div
                  v-if="view.load.shed >= 1"
                  class="wb-load-e"
                  title="früh abgewiesen (Load Shedding)"
                >
                  ✂ −{{ fmt(view.load.shed) }}/s
                </div>
                <div
                  v-if="view.load.r503 >= 1"
                  class="wb-load-e"
                  title="abgewiesen an der vollen, begrenzten Eingangs-Queue, an Admission Control oder am offenen Breaker (503)"
                >
                  503 −{{ fmt(view.load.r503) }}/s
                </div>
                <div
                  v-if="view.load.r429 >= 1"
                  class="wb-load-e"
                  :data-r429="fmt(view.load.r429)"
                  title="Rate Limit je Client: 429 für den Bot, ohne Arbeit"
                >
                  429 −{{ fmt(view.load.r429) }}/s
                </div>
                <div
                  v-if="view.bots && view.load.bot >= 1"
                  class="wb-load-b"
                  :data-bot="fmt(view.load.bot)"
                  title="Scraper-Bot: ein einziger Client, Produktseiten wie die Kunden — in der Last enthalten"
                >
                  🤖 {{ fmt(view.load.bot) }}/s
                </div>
                <div
                  v-if="view.retries >= 1"
                  class="wb-load-r"
                  :data-retries="fmt(view.retries)"
                  title="Retries: Wiederholungen am Zahlungsdienst, zusätzlich zur Nachfrage"
                >
                  ↻ +{{ fmt(view.retries) }}/s
                </div>
              </div>
              <template v-for="c in view.cards" :key="c.key">
                <span
                  class="wb-arrow"
                  :class="{ 'wb-arrow-brake': c.throttling }"
                  aria-hidden="true"
                  >{{ c.throttling ? "◀" : "→" }}</span
                >
                <div
                  class="wb-card"
                  :class="`wb-st-${c.key}`"
                  :data-station="c.key"
                  :data-bottleneck="String(c.isBn)"
                  :data-overload="c.overload"
                  :data-blocked="c.blocked"
                  :data-rec="c.rec"
                  :data-amp="c.amp"
                  :data-brownout="c.brownout"
                  :data-breaker="c.breaker"
                  :data-mail="c.mail"
                  :data-full="c.full"
                  :data-io="c.io"
                  :title="c.title"
                >
                  <span
                    v-if="c.badge"
                    class="wb-badge"
                    :class="[
                      `wb-badge-${c.badge}`,
                      { 'wb-badge-bottleneck': c.isBn },
                    ]"
                    >{{ c.badgeText }}</span
                  >
                  <div class="wb-card-name">
                    {{ c.name }}<span class="wb-card-sfx">{{ c.suffix }}</span>
                  </div>
                  <div class="wb-card-cap">
                    <template v-if="c.dipped"
                      ><s>{{ fmt(c.nom) }}</s> →
                    </template>
                    <b :class="{ 'wb-red': c.isBn }">{{ fmt(c.cap) }}</b>
                    <span class="wb-unit">{{ c.unit }}</span>
                  </div>
                  <div class="wb-card-res" :class="{ 'wb-red': c.reserve < 0 }">
                    {{ c.resLabel }} {{ c.resPct }} · Last
                    {{ fmt(c.demand) }}
                  </div>
                  <div class="wb-bar">
                    <div
                      class="wb-bar-fill"
                      :class="{ 'wb-bar-bad': c.barBad }"
                      :style="{ width: c.bar + '%' }"
                    />
                  </div>
                  <div
                    class="wb-card-q"
                    :class="{
                      'wb-red': c.qBad,
                      'wb-warn-t': c.qWarn && !c.throttling,
                      'wb-idle': c.qIdle && !c.throttling,
                      'wb-brake-t': c.throttling,
                    }"
                  >
                    {{ c.qText }}
                  </div>
                  <div class="wb-card-x">
                    <template v-if="c.key === 'web'"
                      ><span
                        v-for="d in c.dots"
                        :key="d.i"
                        class="wb-dot"
                        :class="{ 'wb-dot-start': d.starting }"
                      /><span v-if="c.dotsMore" class="wb-dot-more">{{
                        c.dotsMore
                      }}</span></template
                    >
                    {{ c.extra }}
                  </div>
                </div>
              </template>
            </div>

            <!-- Hosts (cause): Wirkung immer, Nachbar erst nach dem Aufdecken -->
            <div
              v-if="isCause && hostsView"
              class="wb-hosts wb-grid"
              :class="{ 'wb-hosts-open': revealed }"
            >
              <div class="wb-hosts-k">
                Hosts<span>{{ hostsView.state }}</span>
              </div>
              <div class="wb-host" data-host="A" :title="HOST_TITLE_A">
                <div class="wb-host-name">{{ hostsView.nameA }}</div>
                <div class="wb-host-eff">{{ hostsView.effA }}</div>
                <div class="wb-host-spark">
                  <template v-if="nbShown && spark">
                    <svg
                      class="wb-host-reveal"
                      :class="{ 'wb-wipe': wiping }"
                      :viewBox="`0 0 ${spark.w} 16`"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path :d="spark.cpu" class="wb-sp-cpu" />
                      <path :d="spark.st" class="wb-sp-trace" />
                    </svg>
                    <span
                      class="wb-host-reveal wb-sp-lab"
                      :class="{ 'wb-wipe': wiping }"
                      >{{ hostsView.nbA }}</span
                    >
                  </template>
                </div>
              </div>
              <div class="wb-host" data-host="B" :title="HOST_TITLE_B">
                <div class="wb-host-name">{{ hostsView.nameB }}</div>
                <div class="wb-host-eff">{{ hostsView.effB }}</div>
                <div class="wb-host-spark">
                  <template v-if="nbShown && spark">
                    <svg
                      class="wb-host-reveal"
                      :class="{ 'wb-wipe': wiping }"
                      :viewBox="`0 0 ${spark.w} 16`"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path :d="spark.io" class="wb-sp-io" />
                      <path :d="spark.aw" class="wb-sp-trace" />
                    </svg>
                    <span
                      class="wb-host-reveal wb-sp-lab"
                      :class="{ 'wb-wipe': wiping }"
                      >{{ hostsView.nbB }}</span
                    >
                  </template>
                </div>
              </div>
              <div
                class="wb-host wb-host-ext"
                data-host="ext"
                title="Der Zahlungsdienst läuft beim Anbieter: eigene Schwankungen, kein gemeinsamer Host mit dem Shop."
              >
                <div class="wb-host-name">☁️ extern</div>
                <div class="wb-host-eff">eigene Schwankungen</div>
                <div class="wb-host-eff wb-idle">kein gemeinsamer Host</div>
              </div>
              <div v-if="nbScen && !revealed" class="wb-host-lock">
                <button
                  class="wb-unlock"
                  type="button"
                  title="Die Nachbar-VM aufdecken: ihre CPU- und IO-Schübe und die Spur im Gast (%steal bzw. Disk-await)"
                  @click="reveal"
                >
                  🔒 Nachbar-VM aufdecken
                </button>
              </div>
            </div>

            <div ref="chartWrap" class="wb-chartwrap">
              <canvas
                ref="canvasEl"
                class="wb-chart"
                :aria-label="
                  isCause
                    ? 'Engpass-Band und Nachfrage/Kapazität je Station über die letzten 10 Minuten'
                    : 'Engpass-Band, Anfragen pro Sekunde (rechtzeitig, abgewiesen, verloren) und Checkouts gegen das Limit'
                "
              />
            </div>

            <div v-if="isCause" class="wb-legend">
              <span><i class="wb-lg wb-st-web" />Webserver</span>
              <span><i class="wb-lg wb-st-inv" />Bestandsprüfung</span>
              <span><i class="wb-lg wb-st-pay" />Zahlungsdienst</span>
              <span
                ><i class="wb-lg wb-lg-box wb-lg-over" />über 100 % =
                Überlast</span
              >
              <span class="wb-lg-note"
                >Band: satt = Engpass, blass = knappste Station</span
              >
              <template v-if="nbShown">
                <span><i class="wb-lg wb-lg-cpu" />Nachbar CPU</span>
                <span><i class="wb-lg wb-lg-io" />Nachbar IO</span>
              </template>
            </div>
            <div v-else class="wb-legend">
              <span class="wb-lg-k">Anfragen/s:</span>
              <span><i class="wb-lg wb-lg-box wb-lg-ok" />rechtzeitig</span>
              <span
                v-if="scenario === 'empfehlung'"
                title="rechtzeitig, aber ohne Empfehlungen (Timeout oder offener Breaker)"
                ><i class="wb-lg wb-lg-box wb-lg-deg" />ohne Empf.</span
              >
              <span title="früh abgewiesen: ohne Arbeit, sofort beantwortet"
                ><i class="wb-lg wb-lg-box wb-lg-shed" />abgewiesen</span
              >
              <span><i class="wb-lg wb-lg-box wb-lg-bad" />verloren</span>
              <span
                title="noch in einer Queue, nicht abgeschlossen; Stapelhöhe = Nachfrage"
                ><i class="wb-lg wb-lg-box wb-lg-wait" />wartet</span
              >
              <!-- Retry-Sturm: unten die Zahlung — Versuche (mit Retries),
                   Erstversuche, Bestellungen, Kapazität; Brownout hinterlegt -->
              <template v-if="def.retryLayer">
                <span class="wb-lg-k">Zahlung/s:</span>
                <span title="alle Versuche am Zahlungsdienst, mit Retries"
                  ><i class="wb-lg wb-lg-try wb-st-pay" />Versuche</span
                >
                <span title="Erstversuche = Checkouts"
                  ><i class="wb-lg wb-lg-dash wb-st-pay" />erste</span
                >
                <span><i class="wb-lg wb-lg-okl" />rechtzeitig</span>
                <span
                  title="Kapazität des Zahlungsdienstes jetzt; im Brownout (blass hinterlegt) 35 %"
                  ><i class="wb-lg wb-lg-dot wb-st-pay" />Kapazität</span
                >
              </template>
              <!-- Kurze Spitzen: unten Checkouts und Mails gegen den
                   Mailversand; Blitzangebote blass hinterlegt -->
              <template v-else-if="def.mail">
                <span class="wb-lg-k">Checkouts/s:</span>
                <span><i class="wb-lg wb-lg-okl" />rechtzeitig</span>
                <span><i class="wb-lg wb-lg-dash wb-st-pay" />Nachfrage</span>
                <span
                  title="verschickte Bestätigungsmails/s; rot darunter: verlorene"
                  ><i class="wb-lg wb-st-mail" />Mails</span
                >
                <span
                  :title="`Kapazität des Mailversands jetzt (Nennwert ${MAIL_CAP} Mails/s)`"
                  ><i class="wb-lg wb-lg-dot wb-st-mail" />{{
                    MAIL_CAP
                  }}/s</span
                >
              </template>
              <!-- Bot-Ansturm: unten die Produktseiten — Kunden, ihre
                   Nachfrage, der Bot, was die DB schafft; IO-Schub blass -->
              <template v-else-if="def.bot">
                <span class="wb-lg-k">Seiten/s:</span>
                <span title="Kundenseiten rechtzeitig"
                  ><i class="wb-lg wb-lg-okl" />Kunden</span
                >
                <span title="Kundenseiten: Nachfrage"
                  ><i class="wb-lg wb-lg-dash wb-lg-okc" />Nachfrage</span
                >
                <span title="Bot-Seiten rechtzeitig"
                  ><i class="wb-lg wb-lg-ink" />Bot</span
                >
                <span
                  :title="`Produktseiten/s, die die DB jetzt schafft (Nennwert ${INV_PAGES_PER_S}, im IO-Schub ≈ ${INV_PAGES_PER_S_IO})`"
                  ><i class="wb-lg wb-lg-dot wb-st-inv" />DB schafft</span
                >
              </template>
              <template v-else>
                <span class="wb-lg-k">Checkouts/s:</span>
                <span><i class="wb-lg wb-lg-okl" />rechtzeitig</span>
                <span><i class="wb-lg wb-lg-dash wb-st-pay" />Nachfrage</span>
                <!-- Empfehlungen hängen: Platz für „ohne Empf.“; das Limit
                     steht an der Achse („70“), die Kasse ist nicht das Thema -->
                <span v-if="scenario !== 'empfehlung'"
                  ><i class="wb-lg wb-lg-dot wb-st-pay" />Limit
                  {{ PAY_CAP }}/s</span
                >
              </template>
            </div>
          </div>

          <!-- Rechte Spalte (remedies): Drehbuch-Karte + Schalter-Leiste -->
          <div v-if="!isCause" class="wb-side">
            <div
              class="wb-script"
              :class="{ 'wb-script-dirty': scriptDirty }"
              aria-label="Drehbuch"
            >
              <div class="wb-script-head">
                <span class="wb-script-k">Drehbuch</span>
                <button
                  v-for="(st, i) in steps"
                  :key="st.key"
                  class="wb-stepbtn"
                  :class="{
                    'wb-step-done': !!results[i],
                    'wb-step-cur': i === scr.idx && scr.phase !== 'done',
                  }"
                  :data-step="i"
                  :aria-pressed="i === scr.idx && scr.phase !== 'done'"
                  :title="`Zu Schritt ${i}: ${STEP_UI[scenario]?.[st.key]?.title ?? st.key} (rechnet neu, gleicher Seed)`"
                  @click="jumpToStep(i)"
                >
                  {{ i }}
                </button>
                <span
                  class="wb-score"
                  :class="{ 'wb-score-hit': score.hit > 0 }"
                  :title="`${score.hit} von ${score.n} Tipps richtig`"
                  >{{
                    score.n
                      ? `${score.hit}/${score.n}${score.hit ? " ✓" : ""}`
                      : ""
                  }}</span
                >
              </div>

              <template v-if="scr.phase !== 'done' && stepUi">
                <div class="wb-line"><b>Lage:</b> {{ stepUi.situation }}</div>
                <div class="wb-line"><b>Zug:</b> {{ stepUi.move }}</div>
                <div class="wb-q">{{ stepUi.question }}</div>
                <div v-if="scriptDirty" class="wb-dirty">
                  <span
                    >⚠ Schalter weichen vom Drehbuch ab — Tipps gesperrt.</span
                  >
                  <button
                    class="wb-back"
                    type="button"
                    @click="jumpToStep(scr.idx)"
                  >
                    Zurück zu Schritt {{ scr.idx }}
                  </button>
                </div>
                <div
                  v-else-if="skipTips && scr.phase === 'ask'"
                  class="wb-tips wb-tips-skip"
                >
                  <button
                    class="wb-tip-skip wb-tip-go"
                    type="button"
                    @click="giveTip(null)"
                  >
                    Zug ausführen ▸
                  </button>
                </div>
                <div v-else class="wb-tips">
                  <button
                    v-for="o in tipOptions"
                    :key="o.key"
                    class="wb-tip"
                    :class="tipClass(o.key)"
                    type="button"
                    :data-tip="o.key"
                    :disabled="scr.phase !== 'ask'"
                    @click="giveTip(o.key)"
                  >
                    {{ o.label }}
                  </button>
                </div>
                <div class="wb-script-foot">
                  <span
                    class="wb-tip-fb"
                    :data-ok="tipFeedback.ok"
                    aria-live="polite"
                    >{{ tipFeedback.text }}</span
                  >
                  <button
                    v-if="scr.phase === 'ask' && !scriptDirty && !skipTips"
                    class="wb-tip-skip"
                    type="button"
                    @click="giveTip(null)"
                  >
                    ohne Tipp ▸
                  </button>
                  <button
                    v-if="scr.phase === 'reveal'"
                    class="wb-next"
                    type="button"
                    @click="nextStep"
                  >
                    {{ scr.idx >= steps.length - 1 ? "Fazit ▸" : "Weiter ▸" }}
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="wb-q">Fazit</div>
                <div class="wb-line wb-fazit">{{ FAZIT[scenario] }}</div>
                <div class="wb-script-foot">
                  <span class="wb-tip-fb" data-ok="" aria-live="polite">{{
                    score.n
                      ? `${score.hit} von ${score.n} Tipps richtig`
                      : "ohne Tipps durchgespielt"
                  }}</span>
                  <button class="wb-next" type="button" @click="restartScript">
                    ↺ Von vorn
                  </button>
                </div>
              </template>
            </div>

            <div
              ref="railEl"
              class="wb-rail"
              :class="{ 'wb-rail-dense': railView.dense }"
              :data-rail="railKeys"
              @scroll.passive="checkRailMore"
            >
              <div
                v-for="(col, ci) in railView.cols"
                :key="ci"
                class="wb-rail-col"
              >
                <div
                  v-for="g in col"
                  :key="g.key"
                  class="wb-rail-group"
                  role="group"
                  :aria-label="g.label"
                >
                  <div class="wb-rail-k">{{ g.label }}</div>
                  <div v-for="it in g.items" :key="it.key" class="wb-rail-row">
                    <div
                      v-if="it.seg"
                      class="wb-retrymode"
                      :class="{
                        'wb-dim': railDim(it.key),
                        'wb-pulse': pulse.includes(it.key),
                      }"
                      role="group"
                      :aria-label="it.label"
                      :data-cm="it.key"
                      :data-off-rail="railDim(it.key) ? 'true' : null"
                      :title="it.title"
                    >
                      <span class="wb-seg-k" aria-hidden="true">↻</span>
                      <button
                        v-for="o in it.seg"
                        :key="o.v"
                        class="wb-segbtn"
                        type="button"
                        :data-mode="o.v"
                        :aria-pressed="cmView.retry === o.v"
                        :title="o.title"
                        @click="setRetry(o.v)"
                      >
                        {{ o.label }}
                      </button>
                    </div>
                    <button
                      v-else
                      class="wb-cm wb-chip"
                      :class="{
                        'wb-dim': railDim(it.key),
                        'wb-pulse': pulse.includes(it.key),
                        'wb-chip-mode': !!it.mode,
                      }"
                      role="switch"
                      type="button"
                      :data-cm="it.key"
                      :data-off-rail="railDim(it.key) ? 'true' : null"
                      :aria-checked="!!cmView[it.key]"
                      :title="itemTitle(it)"
                      @click="toggleCm(it.key)"
                    >
                      <i class="wb-knob" aria-hidden="true" />{{
                        itemLabel(it)
                      }}
                    </button>
                    <button
                      v-if="it.mode"
                      class="wb-scalemode"
                      :class="{ 'wb-pulse': pulse.includes('scaleMode') }"
                      type="button"
                      :aria-pressed="cmView.scaleMode === 'vorgewaermt'"
                      :title="`Scaling-Modus umschalten — jetzt ${cmView.scaleMode === 'vorgewaermt' ? `vorgewärmt ≈ ${SCALE_PREWARM_S} s` : `reaktiv ≈ ${SCALE_REACTIVE_S} s`}`"
                      @click="toggleScaleMode"
                    >
                      {{
                        cmView.scaleMode === "vorgewaermt"
                          ? "vorgew."
                          : "reaktiv"
                      }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Leiste scrollt (alle Schalter an): Hinweis, solange unten
                 noch Schalter verdeckt sind — kein Bedienelement -->
            <span v-if="railMore" class="wb-rail-more" aria-hidden="true"
              >▾ mehr</span
            >
          </div>
        </div>

        <!-- Erklärung & Modell -->
        <div
          v-show="activeTab === 'explain'"
          ref="explainEl"
          class="wb-explain"
        >
          <div class="wb-ex-sys" aria-label="Die Kette">
            <span class="wb-ex-node"
              >Kunden<span class="wb-ex-lbl">{{
                isCause
                  ? `konstant ${NACHBAR_LOAD} bzw. ${ZUFALL_LOAD} req/s`
                  : def.load.length > 1
                    ? `${fmt(def.load[0][1])} → ${fmt(def.load[def.load.length - 1][1])} req/s`
                    : `konstant ${fmt(def.load[0][1])} req/s${def.bot ? ` + Bot ${BOT_RATE}` : ""}`
              }}</span></span
            >
            <span class="wb-ex-arrow">→</span>
            <span class="wb-ex-node wb-st-web"
              >Webserver<span class="wb-ex-lbl"
                >{{ WEB_PER_INSTANCE }} req/s je Instanz · CPU</span
              ></span
            >
            <span class="wb-ex-arrow">→</span>
            <span class="wb-ex-node wb-st-inv"
              >Bestandsprüfung<span class="wb-ex-lbl"
                >eine DB, {{ INV_CAP_E }} E/s =
                {{ INV_PAGES_PER_S }} Produktseiten/s</span
              ></span
            >
            <span class="wb-ex-arrow">→</span>
            <span class="wb-ex-node wb-st-pay"
              >Zahlungsdienst<span class="wb-ex-lbl"
                >extern, {{ PAY_CAP }} req/s, nur Checkouts</span
              ></span
            >
            <template v-if="def.mail">
              <span class="wb-ex-arrow">→</span>
              <span class="wb-ex-node wb-st-mail"
                >Mailversand<span class="wb-ex-lbl"
                  >{{ MAIL_CAP }} Mails/s, je Zahlung eine</span
                ></span
              >
            </template>
          </div>
          <div class="wb-ex-p">
            Eine Produktseite kostet die DB {{ fmt(INV_PAGE_E, 1) }} E (Bestand
            {{ fmt(INV_AVAIL_E, 1) }} + personalisierte Empfehlungen
            {{ fmt(INV_RECO_E, 1) }}), die Reservierung im Checkout
            {{ fmt(INV_RESERVE_E, 1) }} E.
            <template v-if="def.conv === 0"
              >Checkouts kommen hier als fester Strom ({{ def.cFix }}/s<template
                v-if="def.waves"
                >, in den Blitzangeboten {{ def.waves.peak }}/s</template
              >), ohne Funnel.</template
            ><template v-else
              >Checkouts kommen aus dem Funnel: {{ CONV_PCT }} % der rechtzeitig
              ausgelieferten Produktseiten.</template
            >
            <template v-if="isCause">
              Die Webserver-VMs teilen die CPU eines Hosts mit einer fremden VM;
              die DB teilt mit ihr das Storage-Backend. Der Zahlungsdienst läuft
              extern.</template
            >
          </div>

          <div class="wb-ex-h">
            Engpass — eine Regel, überall gleich benannt
          </div>
          <div class="wb-ex-p">
            <b>Nachfrage</b> ist, was an einer Station ankäme, wenn nichts
            abgewiesen würde — Abweisen (Back Pressure, Load Shedding, Rate
            Limit, Admission) senkt sie nicht, weniger Arbeit je Anfrage
            (Feature Shedding, Cache, Batching) schon. Hinter dem Puffer der
            Kurzen Spitzen zählt das gleitende Mittel (s. Vereinfachungen).
            <b>Reserve</b> = Kapazität / Nachfrage − 1. Die
            <b>knappste Station</b> hat die kleinste Reserve (geglättet über
            {{ RES_TAU_S }} s, {{ pct(HYST) }} % Hysterese); sie ist immer
            definiert und erscheint im Band blass. Der <b>Engpass</b> ist die
            knappste Station, sobald ihre Reserve unter 0 fällt — im Band satt,
            auf der Karte rot: <b>kollabiert</b> (ungeschützt — Warteschlange
            ohne Grenze, Antworten zu spät, Arbeit verloren — oder trotz Schutz
            mit Wartezeit über {{ COLLAPSE_WAIT_S }} s) oder
            <b>🛡️ abgefangen</b> (begrenzt, Überlauf früh abgewiesen, kurze
            Wartezeit). <b>Engpass-Wechsel</b> zählt nur Wechsel zwischen
            Überlast-Episoden an verschiedenen Stationen. Die Karten zeigen
            Momentwerte (Reserve = Kapazität / Last − 1 der Karte); Band, Badge
            und Pill entscheiden über die geglättete Reserve. „Rückstau baut ab“
            (orange): keine Überlast mehr, aber die Queue aus der letzten leert
            sich noch.
          </div>
          <div class="wb-ex-p wb-ex-note">
            Ehrlich: Nach Goldratt ist jede Ressource mit Kapazität ≤ Nachfrage
            ein Engpass — es kann mehrere zugleich geben; die Sim hebt die
            knappste hervor. Roser et al. bestimmen den momentanen Engpass über
            die längste aktive Periode ohne Unterbrechung; die Sim nimmt
            stattdessen die geglättete Reserve. Die Klickfolge im
            Monitoring-Talk (PipelineViz) setzt ihr Badge, sobald die Kapazität
            unter der zugelassenen Last liegt — dort senkt Abweisen die Last,
            hier nicht. Deshalb unterscheidet die Sim „kollabiert“ und
            „abgefangen“.
          </div>

          <div class="wb-ex-h">Ablesen</div>
          <div class="wb-ex-p">
            Band oben: satt = Engpass, blass = knappste Station.
            <template v-if="isCause"
              >Nach dem Aufdecken darunter ein Streifen mit den Schüben der
              Nachbar-VM (Farben wie in der Legende: Nachbar CPU, Nachbar IO) —
              Schub und Engpass stehen übereinander. Darunter Nachfrage /
              Kapazität je Station (über 100 % = Überlast, rot
              hinterlegt).</template
            ><template v-else
              >Darunter die Anfragen/s gestapelt — rechtzeitig, früh abgewiesen,
              verloren, noch wartend; die Höhe des Stapels ist die Nachfrage.
              Blasses Grün: rechtzeitig, aber ohne Empfehlungen (Timeout oder
              offener Breaker). Gezählt wird beim Abschluss, ein abgebauter
              Rückstau wird auf die Nachfrage gedeckelt — oben wie unten. Unten
              die Bestellungen gegen das Limit des Zahlungsdienstes<template
                v-if="def.retryLayer"
              >
                — im Retry-Sturm die Versuche am Zahlungsdienst (mit Retries)
                gegen seine Kapazität, blass hinterlegt der Brownout</template
              ><template v-if="def.mail">
                — bei den Kurzen Spitzen gegen den Mailversand: verschickte
                Mails, rot verlorene, gepunktet seine Kapazität; blass
                hinterlegt die Blitzangebote</template
              ><template v-if="def.bot">
                — beim Bot-Ansturm die Produktseiten: Kunden rechtzeitig (grün),
                ihre Nachfrage (gestrichelt), der Bot (dunkel), gepunktet, was
                die DB jetzt schafft, und das statische Limit; blass hinterlegt
                der IO-Schub der Nachbar-VM</template
              >. Die Kreise 0 … {{ steps.length - 1 }} markieren die Züge des
              Drehbuchs.</template
            >
          </div>

          <div class="wb-ex-h">Die sechs Grundrichtungen</div>
          <div class="wb-ex-table">
            <div class="wb-ex-th">Richtung</div>
            <div class="wb-ex-th">Beispiele (● hier als Schalter)</div>
            <div class="wb-ex-th">schafft Kapazität?</div>
            <template v-for="d in directionsView" :key="d.dir">
              <div class="wb-ex-td">
                <b>{{ d.dir }}</b>
              </div>
              <div class="wb-ex-td">
                <template v-for="(e, ei) in d.ex" :key="e.label"
                  >{{ ei ? ", " : "" }}{{ e.here ? "● " : ""
                  }}{{ e.label }}</template
                >
              </div>
              <div class="wb-ex-td">{{ d.cap }}</div>
            </template>
          </div>

          <div class="wb-ex-h">Präzisierungen</div>
          <div class="wb-ex-li">
            <b>Back Pressure schafft keine Kapazität.</b> Sie verlegt den Stau
            an den Rand — in eine begrenzte Queue, deren Überlauf abgewiesen
            wird. Hebert: „You'll have to pick between blocking on input
            (back-pressure), or dropping data on the floor (load-shedding).“
          </div>
          <div class="wb-ex-li">
            <b>Jede Queue braucht eine Grenze</b>, danach abweisen oder
            degradieren. SRE Book: „Usually, if the queue is full, the server
            will reject new requests.“
          </div>
          <div class="wb-ex-li">
            <b>Scaling reaktiv vs. vorgewärmt:</b> reaktiv ≈
            {{ SCALE_REACTIVE_S }} s (Erkennen {{ SCALE_DETECT_S }} s +
            Kaltstart {{ SCALE_COLD_S }} s + Aufwärmen {{ SCALE_WARMUP_S }} s ab
            {{ SCALE_WARM_START_PCT }} %), vorgewärmt (Warm Pool) ≈
            {{ SCALE_PREWARM_S }} s — und nur, wenn der Engpass horizontal
            skalierbar ist. Die Bestands-DB und der externe Zahlungsdienst sind
            es nicht.
          </div>
          <div class="wb-ex-li">
            <b>Lastglättung</b> (Puffern) hilft nur, wenn das Mittel unter der
            Kapazität liegt — sonst läuft der Puffer voll.
          </div>
          <div class="wb-ex-li">
            <b>Rate Limit pro Client</b> (Fairness, 429) ≠
            <b>Admission Control</b> (global, statisch oder adaptiv) ≠
            <b>Load Shedding</b> (nach Priorität, wenn es eng wird — am Rand
            und, ohne Back Pressure, an der Wartezeit der DB) ≠
            <b>Back Pressure</b> (Rückmeldung aus der Kette).
          </div>
          <div class="wb-ex-li">
            <b>Batching</b> spart Overhead je Anfrage und kostet Latenz bis zu
            einem Sammelfenster (Kafka linger.ms, DataLoader); dazu kommen
            Teilfehler und ein größerer Blast-Radius.
          </div>
          <div class="wb-ex-li">
            <b>Arbeit reduzieren statt abschalten:</b> Cache + Coalescing spart
            DB-Arbeit, die Funktion bleibt — anders als Feature Shedding, das
            sie streicht.
          </div>
          <div class="wb-ex-li">
            <b>Gecachte Verfügbarkeit ist Degradation:</b> Die Produktseite darf
            leicht veraltet sein, die Reservierung im Checkout läuft immer live
            — sonst wird überverkauft.
          </div>

          <template v-if="!isCause">
            <div class="wb-ex-h" data-scen="spitzen">
              Kurze Spitzen: Spitzen zeitlich verteilen
            </div>
            <div class="wb-ex-li">
              <b>Die Lage:</b> {{ SPITZEN_PAGES }} Produktseiten/s und
              {{ SPITZEN_BASE }} Checkouts/s; alle
              {{ SPITZEN_PERIOD_S / 60 }} min bringt ein Blitzangebot
              {{ SPITZEN_ON_S }} s lang {{ SPITZEN_PEAK }} Checkouts/s — im
              Mittel {{ SPITZEN_AVG }}. Nach jeder Zahlung geht eine
              Bestätigungsmail an den Mailversand ({{ MAIL_CAP }} Mails/s).
              Synchron im Checkout wartet der Kunde darauf: In der Spitze kommen
              {{ MAIL_EXCESS }} Mails/s zu viel, nach {{ SPITZEN_ON_S }} s
              stehen {{ MAIL_WAVE_BACKLOG }} im Rückstau —
              {{ MAIL_WAVE_DELAY_S }} s Wartezeit, die Bestellungen kommen zu
              spät.
            </div>
            <div class="wb-ex-li">
              <b>Puffern &amp; glätten</b> entkoppelt Annahme und Versand: Die
              Bestellung ist sofort bestätigt, die Mail kommt aus einem Puffer.
              Er fängt die Spitze auf und läuft in der Pause leer — die Mails
              kommen später, aber alle. Azure, Queue-Based Load Leveling: „The
              approach that this pattern describes can provide resilience
              against sudden spikes in demand by decoupling the arrival of tasks
              from their processing.“
            </div>
            <div class="wb-ex-li">
              <b
                >Präzisierung: Lastglättung hilft nur, wenn das Mittel unter der
                Kapazität liegt.</b
              >
              Bei Dauerlast ({{ SPITZEN_PEAK }} gegen {{ MAIL_CAP }} Mails/s)
              läuft jeder Puffer voll. Azure: „If your average producer rate
              exceeds the consumer rate, the queue continues to grow and latency
              increases.“ Darum braucht er Grenzen — hier höchstens
              {{ fmt(MAIL_Q_MAX) }} Mails und keine älter als
              {{ MAIL_MAX_AGE_S }} s (bei {{ MAIL_CAP }}/s greift das Alter
              zuerst: {{ MAIL_Q_EFF }}); was darüber liegt, geht verloren.
              Glätten schafft keine Kapazität: Der Mailversand schickt nie mehr
              als {{ MAIL_CAP }}/s, er schiebt Arbeit in die Pausen.
            </div>
            <div class="wb-ex-li">
              <b>Nicht für alles:</b> Was der Kunde in der Antwort braucht,
              bleibt synchron — Azure nennt als Gegenanzeige: „The caller
              requires a low-latency, synchronous response.“ Hier wandert nur
              die Mail in den Puffer, die Zahlung bleibt im Checkout; sie
              aufzuschieben hieße, Bestellungen anzunehmen, deren Zahlung später
              scheitern kann.
            </div>

            <div class="wb-ex-h" data-scen="teuer">
              Teure Abfragen: Arbeit reduzieren
            </div>
            <div class="wb-ex-li">
              <b>Die Lage:</b> Eine Produktseite kostet die DB
              {{ fmt(INV_PAGE_E, 1) }} E — Verfügbarkeit
              {{ fmt(INV_AVAIL_E, 1) }} E (Overhead
              {{ fmt(INV_OVERHEAD_E, 1) }} + {{ fmt(INV_PER_ITEM_E, 1) }} je
              Artikel) und personalisierte Empfehlungen
              {{ fmt(INV_RECO_E, 1) }} E. Mehr Webserver ändern daran nichts:
              Die DB skaliert nicht horizontal.
            </div>
            <div class="wb-ex-li">
              <b>Batching</b> schickt alle Verfügbarkeitsabfragen aus
              {{ BATCH_WINDOW_MS }} ms als ein Bündel: Der Overhead teilt sich
              auf k = Rate × Fenster Abfragen, je Artikel bleiben
              {{ fmt(INV_PER_ITEM_E, 1) }} E. Im Mittel wartet jede Seite
              {{ BATCH_LAT_MS }} ms länger — auch ohne Last, wo k ≈ 1 nichts
              spart. Kafka zu linger.ms=50: „would add up to 50ms of latency to
              records sent in the absence of load“.
            </div>
            <div class="wb-ex-li">
              <b>Cache + Coalescing</b> für die Empfehlungen, Schlüssel je
              Produkt (personalisiert wird danach nur sortiert):
              {{ CACHE_HIT_PCT }} % kommen ohne DB-Arbeit,
              {{ fmt(INV_RECO_E, 1) }} → {{ fmt(INV_RECO_CACHED_E, 2) }} E je
              Seite. Coalescing legt gleichzeitige Fehltreffer zum selben
              Produkt zu einer Anfrage zusammen — im Newsletter öffnen alle
              dieselben Produkte; ohne es stürmt beim leeren Cache jede Anfrage
              zur DB. AWS Builders' Library: „To remedy this issue we use
              request coalescing, where the servers or external cache ensure
              that only one pending request is out for uncached resources.“
            </div>
            <div class="wb-ex-li">
              <b>Reihenfolge:</b> Batching kommt im Drehbuch zuerst und reicht
              nicht — es spart nur den Overhead, die Empfehlungen bleiben der
              teure Teil. Erst der Cache entlastet die DB; dann liefert sie so
              viele Seiten, dass der Funnel die Kasse überlastet (Back Pressure
              fängt dort ab).
            </div>

            <div class="wb-ex-h" data-scen="empfehlung">
              Empfehlungen hängen: Überlast isolieren, Verstärkung verhindern
            </div>
            <div class="wb-ex-li">
              <b>Die Lage:</b> Ab t = {{ REC_SLOW_AT_S }} s antwortet der
              Empfehlungsdienst nach {{ fmt(REC_SLOW_S) }}&nbsp;s statt
              {{ REC_LAT_MS }} ms. Jede Produktseite hält so lange ihren
              Web-Thread — Little's Law: {{ EMPF_PAGES }} Seiten/s ×
              {{ fmt(REC_SLOW_S) }} s = {{ EMPF_THREADS_NEEDED }} belegte
              Threads, die {{ N_WEB_EMPF }} Webserver haben {{ N_WEB_EMPF }} ×
              {{ THREADS_EMPF }} = {{ THREADS_EMPF_TOTAL }}. Der gemeinsame Pool
              läuft leer, und auch Checkouts finden keinen Thread mehr, obwohl
              DB und Zahlungsdienst Reserve haben. Azure, Bulkhead pattern: „As
              requests to the service continue, those resources might be
              exhausted. For example, the client's connection pool might be
              exhausted. At that point, the consumer's requests to other
              services are affected.“
            </div>
            <div class="wb-ex-li">
              <b>Bulkheads</b> trennen die Pools: Checkout
              {{ BULKHEAD_CHECKOUT_PCT }} % ({{
                THREADS_EMPF_CHECKOUT
              }}
              Threads), Rest {{ BULKHEAD_REST_PCT }} % ({{
                THREADS_EMPF_REST
              }}). Die Kasse bleibt erreichbar, die Seiten hängen weiter. Azure:
              „Isolate the elements of an application into pools so that if one
              element fails, the others continue to function.“ Überlast
              isolieren schafft keine Kapazität, es begrenzt den Schaden — und
              verliert den Pooling-Effekt: Freie Threads des einen Pools helfen
              dem anderen nicht.
            </div>
            <div class="wb-ex-li">
              <b>Timeouts</b> begrenzen das Warten: nach {{ REC_TIMEOUT_MS }} ms
              ohne Empfehlungen ausliefern — degradiert, aber rechtzeitig. Eine
              Grenze, danach degradieren, wie bei jeder Queue. Höchstens
              {{ EMPF_PAGES }} × {{ fmt(REC_TIMEOUT_MS / 1000, 1) }} s =
              {{ EMPF_THREADS_TIMEOUT }} Threads statt
              {{ EMPF_THREADS_NEEDED }}. Der hängende Dienst bekommt aber weiter
              jeden Aufruf. Im Modell begrenzen Timeouts auch DB ({{
                fmt(DB_TIMEOUT_S, 1)
              }}
              s) und Zahlung ({{ PAY_TIMEOUT_S }} s statt
              {{ PAY_GIVEUP_S }}&nbsp;s): schneller Fehler statt langem Warten.
            </div>
            <div class="wb-ex-li">
              <b>Circuit Breaker</b> zählt die Abbrüche: ab
              {{ BREAKER_TRIP_PCT }} % (gemittelt über {{ BREAKER_TAU_S }} s)
              offen für {{ BREAKER_OPEN_S }} s, dann {{ HALF_ADMIT_PCT }} %
              Proben; ohne Fehler nach {{ fmt(BREAKER_CLOSE_S, 1) }} s wieder zu
              — frühestens, wenn die Ergebnisse der Proben da sind. Offen spart
              er den Aufruf ganz — automatisches Feature Shedding: keine
              Wartezeit, keine DB-Arbeit für Empfehlungen, der Dienst bekommt
              nur Proben. Ohne Timeouts sieht er einen hängenden Dienst nicht:
              Langsam ist im Modell kein Fehler. Nygard, Release It! (2. Aufl.),
              Kap. 5 „Stability Patterns“: Timeouts, Circuit Breaker, Bulkheads.
            </div>
            <div class="wb-ex-li">
              <b>Präzisierung:</b> Bulkheads isolieren Überlast, Timeouts und
              Breaker verhindern, dass sie sich ausbreitet — keines schafft
              Kapazität. Der Engpass verschwindet hier nur, weil das Warten auf
              einen Nebendienst keine echte Arbeit war: Degradieren tauscht die
              Empfehlungen gegen Threads.
            </div>

            <div class="wb-ex-h" data-scen="retry">
              Retry-Sturm: Verstärkung verhindern
            </div>
            <div class="wb-ex-li">
              <b>Die Lage:</b> {{ RETRY_CHECKOUTS }} Checkouts/s gegen einen
              Zahlungsdienst mit {{ PAY_CAP }}/s. Die Störung:
              {{ PAY_BROWNOUT_S }} s Brownout auf {{ PAY_BROWNOUT_PCT }} %, dann
              ein Neustart — alle offenen Aufrufe brechen im selben Moment ab.
              Der Checkout gibt jedem Versuch {{ PAY_TIMEOUT_S }} s und versucht
              es bis zu {{ RETRY_MAX_ATTEMPTS }}-mal (SRE Book: „up to three
              attempts“). Jeder Schritt des Drehbuchs spielt dieselbe Störung
              ab. Rechtzeitig ist eine Bestellung wie überall in der Sim nur,
              wenn der ganze Checkout binnen {{ DEADLINE_S }} s fertig ist — ein
              Retry nach einem Timeout kommt also praktisch immer zu spät. Für
              den Kunden helfen Retries nur gegen kurze Aussetzer; hier halten
              sie den Dienst unten.
            </div>
            <div class="wb-ex-li">
              <b>Naiv</b> scheitert im Brownout jeder Versuch, und jeder wird
              sofort wiederholt: {{ RETRY_MAX_ATTEMPTS }} ×
              {{ RETRY_CHECKOUTS }} = {{ RETRY_STORM_LOAD }} Versuche/s gegen
              {{ PAY_CAP }}. Der Anbieter rechnet weiter an Aufrufen, auf die
              niemand mehr wartet — der Brownout ist vorbei, der Sturm bleibt
              (metastabil). SRE Book: „If the backend spends a significant
              amount of resources processing requests that will ultimately fail
              due to overload, then the retries themselves may be keeping the
              backend in an overloaded mode.“
            </div>
            <div class="wb-ex-li">
              <b>Backoff ohne Jitter</b> ({{ RETRY_BASE_S }} s, dann
              {{ 2 * RETRY_BASE_S }} s) verschiebt die Retries, aber im
              Gleichtakt: Wer beim Neustart gemeinsam scheitert, kommt gemeinsam
              wieder — Wellen. Brooker (AWS Builders' Library): „If all the
              failed calls back off to the same time, they cause contention or
              overload again when they are retried.“ <b>Jitter</b> verteilt sie
              zufällig über das Fenster. SRE Book: „If retries aren’t randomly
              distributed over the retry window, a small perturbation (e.g., a
              network blip) can cause retry ripples to schedule at the same
              time, which can then amplify themselves.“ Beides ändert die Menge
              nicht.
            </div>
            <div class="wb-ex-li">
              <b>Retry-Budget</b> deckelt die Menge — SRE Book, per-client retry
              budget: „A request will only be retried as long as this ratio is
              below 10%.“ Hier als Token Bucket: höchstens
              {{ RETRY_BUDGET_LOAD }} statt {{ RETRY_STORM_LOAD }} Versuche/s.
              Die {{ RETRY_BUDGET_PCT }}&nbsp;% sind eine Wahl, keine Konstante:
              Envoy setzt 20&nbsp;% als Default (bezogen auf gleichzeitig aktive
              Requests), Finagle etwa 20&nbsp;% plus 10 Retries/s.
            </div>
            <div class="wb-ex-li">
              <b>Circuit Breaker</b> sagt in der Störung sofort ab — „Kasse
              ausgelastet — Warenkorb bleibt“ statt eines Fehlers nach mehreren
              Timeouts; der Anbieter bekommt nur Proben. Er öffnet erst, wenn
              der Client Timeouts erkennt, und schließt, sobald die Proben
              gelingen. Im Brownout gelingen sie ({{ PAY_BROWNOUT_PCT }} %
              Kapazität reichen dafür) — dann reißt ihn die volle Last wieder
              auf: Er flattert, dosieren kann er nicht. Brooker warnt: „circuit
              breakers introduce modal behavior into systems that can be
              difficult to test, and can introduce significant addition time to
              recovery.“ Amazon begrenzt Retries deshalb lieber lokal mit einem
              Token Bucket.
            </div>
            <div class="wb-ex-li">
              <b>Präzisierung:</b> Verstärkung verhindern schafft keine
              Kapazität — es verhindert, dass ein kurzer Ausfall sich selbst am
              Leben hält. Backoff und Jitter verteilen, erst ein Budget (oder
              der Breaker) deckelt. Retries nur auf einer Ebene (SRE Book:
              „avoid amplifying retries by issuing retries at multiple levels“),
              und Zahlungen nur mit Idempotency Key — Stripe: „if a connection
              error occurs, you can safely repeat the request without risk of
              creating a second object or performing the update twice.“
            </div>

            <div class="wb-ex-h" data-scen="bots">
              Bot-Ansturm: Zufluss bremsen
            </div>
            <div class="wb-ex-li">
              <b>Die Lage:</b> {{ BOTS_LOAD }} req/s Kunden, dazu ein
              Scraper-Bot — ein einziger Client — mit
              {{ BOT_RATE }} Produktseiten/s. Jede kostet die DB
              {{ fmt(INV_PAGE_E, 1) }} E wie eine Kundenseite:
              {{ fmt(BOTS_DB_E) }} E/s gegen {{ INV_CAP_E }}, {{ BOT_DB_PCT }} %
              davon vom Bot. Die Webserver haben Reserve. Vier Mechanismen
              weisen ab oder bremsen — sie unterscheiden sich darin,
              <b>wen</b> sie treffen und <b>woran</b> sie sich ausrichten.
              Keiner schafft Kapazität.
            </div>
            <div class="wb-ex-li">
              <b>Load Shedding</b> reagiert auf den Zustand des Servers — hier
              die Wartezeit der DB — und weist nach Priorität ab: Produktseiten
              zuerst, Checkouts zuletzt. Wer fragt, sieht es nicht: Kunden wie
              Bot. Stripe: „A load shedder makes its decisions based on the
              whole state of the system rather than the user who is making the
              request.“
            </div>
            <div class="wb-ex-li">
              <b>Rate Limit je Client</b> ist eine Regel je Verursacher: Token
              Bucket, {{ RL_RATE }} req/s je Client, darüber sofort 429 —
              Fairness, Kunden bleiben weit darunter. Stripe: „every Stripe user
              has a bucket, and every time they make a request we remove a token
              from that bucket.“ Die Nachfrage des Bots bleibt: Auf dem Papier
              bleibt die DB der Engpass ({{ BOT_429 }}/s 429), nur trifft das
              Abweisen jetzt den Verursacher.
            </div>
            <div class="wb-ex-li">
              <b>Admission Control</b> begrenzt global, für alle zusammen —
              statisch (hier {{ ADMISSION_RPS }} req/s, die Nennkapazität der
              DB) oder adaptiv. Statisch kennt sie die Kapazität der Kette
              nicht: Im IO-Schub der Nachbar-VM (Disk-await ×{{
                fmt(IO_BURST_AWAIT)
              }}) schafft die DB nur ≈ {{ INV_PAGES_PER_S_IO }} Seiten/s, das
              Limit lässt {{ BOTS_RL_LOAD }} req/s durch und greift gar nicht.
              Netflix (concurrency-limits): „RPS limits are then set somewhere
              below this tipping point (say 75% of this value) and enforced via
              a token bucket. However, in large distributed systems that
              auto-scale this value quickly goes out of date“ — stattdessen
              gleichzeitige Requests nach Little's Law: „Limit = Average RPS *
              Average Latency“.
            </div>
            <div class="wb-ex-li">
              <b>Back Pressure</b> ist die Rückmeldung aus der Kette: Das Limit
              vor der DB folgt ihrer echten Kapazität, der Stau wandert in eine
              begrenzte Eingangs-Queue, der Überlauf bekommt sofort 503. Im
              IO-Schub kommen so ≈ {{ FIG_BOTS.bpInv.custPages }} von
              {{ BOTS_PAGES }} Kundenseiten/s rechtzeitig statt keiner.
            </div>
            <div class="wb-ex-li">
              <b>Präzisierung:</b> Rate Limit (wen: je Client) ≠ Admission
              Control (wie viel: global, statisch oder adaptiv) ≠ Load Shedding
              (reagiert auf den Zustand, nach Priorität) ≠ Back Pressure
              (Rückmeldung von stromab). Im Drehbuch löst das Rate Limit das
              Shedding ab — der Shedder hätte auch den IO-Schub abgefangen, er
              folgt ja der Wartezeit der DB.
            </div>
          </template>

          <div class="wb-ex-h">Noisy Neighbor, gemessen</div>
          <div class="wb-ex-li">
            <b>CPU-Konkurrenz zeigt sich als %steal</b> im Gast: st in
            top/vmstat, Spalte steal in /proc/stat; node_exporter:
            node_cpu_seconds_total{mode="steal"}. Im Modell nimmt ein CPU-Schub
            {{ pct(NB_STEAL_MIN) }}–{{ pct(NB_STEAL_MAX) }} % der Web-CPU.
          </div>
          <div class="wb-ex-li">
            <b>IO-Konkurrenz hat keinen Steal-Zähler:</b> Warten auf IO zählt
            als idle, und idle ist nie steal. Sie zeigt sich als längere
            Disk-Wartezeit (await in iostat: r_await/w_await, inklusive
            Queue-Zeit) und größere aqu-sz; %iowait ist laut proc_stat(5) „not
            reliable“. Druck von innen: PSI in /proc/pressure/io
            (node_pressure_io_waiting_seconds_total). Im Modell steigt die
            Disk-Wartezeit der DB auf das {{ fmt(NB_AWAIT_MIN, 1) }}- bis
            {{ fmt(NB_AWAIT_MAX, 1) }}-Fache von
            {{ fmt(DB_AWAIT_BASE_MS, 1) }} ms.
          </div>
          <div class="wb-ex-li">
            <b>%steal heißt nicht zwingend Nachbar:</b> Auch leere CPU-Credits
            (burstable Instanzen) oder ein überlasteter Hypervisor erzeugen ihn.
            Den Nachbarn selbst sieht nur der Provider — von innen bleibt die
            Korrelation: Schübe in %steal bzw. Disk-await fallen mit den
            Engpass-Wechseln zusammen.
          </div>

          <template v-if="isCause">
            <div class="wb-ex-h">Murphy, Schutzkapazität, Eigener Host</div>
            <div class="wb-ex-li">
              <b>🎯 Murphy · nur Demo</b> schlägt zu, sobald sich die letzte
              Engpass-Station erholt hat und das Eigenrauschen der anderen
              Station (Webserver ↔ DB) im Tief ist — und trifft genau diese,
              {{ MURPHY_STRIKE_S }} s mit voller Stärke; frühestens
              {{ MURPHY_GAP_S }} s nach Ende des letzten Schlags, ohne Tief
              spätestens {{ MURPHY_MAX_WAIT_S }} s danach (sobald gerade kein
              Engpass besteht). Adversarial, kein realistisches Verhalten.
            </div>
            <div class="wb-ex-li">
              <b>🛡️ Schutzkapazität</b>: den Engpass festlegen (die DB, nicht
              horizontal skalierbar) und den übrigen Stationen Reserve geben
              (Webserver +{{ HEADROOM_PCT }} %). Bei „Nur Zufall“ bleibt dann
              die DB der feste Engpass — das Wandern hört auf (Lawrence & Buss).
              <b>+{{ HEADROOM_PCT }} % überall</b> (⚙) nimmt bei „Nur Zufall“
              die Überlast weg, aber die knappste Station wandert weiter. Gegen
              den Nachbarn hilft beides nur halb — ein Schub frisst die Reserve
              auf; erst <b>🏠 Eigener Host</b> (Isolation) beseitigt die
              Wechsel.
            </div>
            <div class="wb-ex-li">
              <b>Startfenster:</b> Die Sim zieht Start-Seeds, bis das erste
              {{ winMin }}-min-Fenster mindestens
              {{ START_MIN_SHIFTS }} Engpass-Wechsel zeigt (höchstens
              {{ START_MAX_TRIES }} Versuche). Das ist eine Auswahl für die
              Demo, keine Kalibrierung — ohne sie bliebe bei „Nur Zufall“ etwa
              jedes siebte Fenster ruhig. Seed jetzt: {{ seedView }}.
            </div>
          </template>

          <div class="wb-ex-h">Bewusste Vereinfachungen</div>
          <div class="wb-ex-li">
            <b>Flussmodell:</b> Mengen statt einzelner Requests, fester Schritt
            0,1 s; Schwankungen als Ornstein-Uhlenbeck-Prozess (τ =
            {{ OU_TAU_S }} s) auf Kapazitäten und Ankünften.
          </div>
          <div class="wb-ex-li">
            <b>Funnel:</b> Checkouts folgen den rechtzeitig ausgelieferten
            Produktseiten (geglättet über {{ FUNNEL_TAU_S }} s); bei konstanter
            Last ein fester Mix.
          </div>
          <div class="wb-ex-li">
            <b>Zwei Zeitskalen:</b> Schwankungen, Nachbar-Phasen und Scaling
            laufen gestreckt (Minuten); Latenzen, Timeouts (Antwort nach mehr
            als {{ DEADLINE_S }} s = zu spät) und Aufgeben ({{ ABANDON_S }} s)
            in echten Sekunden. Der Zeitraffer im Kopf rafft beides.
          </div>
          <div v-if="isCause" class="wb-ex-li">
            <b>„Nur Zufall“</b> läuft mit stärkerer Schwankung (σ Webserver
            {{ pct(SCENARIOS.zufall.sigma.web) }} %, DB
            {{ pct(SCENARIOS.zufall.sigma.inv) }} % statt
            {{ fmt(SCENARIOS.nachbar.sigma.web * 100, 1) }} %) und
            {{ ZUFALL_LOAD }} statt {{ NACHBAR_LOAD }} req/s — mit den Werten
            des Nachbar-Presets bliebe der Engpass ohne Nachbarn fast immer aus.
          </div>
          <div v-if="!isCause" class="wb-ex-li">
            <b>Puffer:</b> Hinter dem Puffer zählt als Nachfrage am Mailversand
            der Zufluss im gleitenden Mittel über {{ MAIL_SMOOTH_TAU_S }} s — so
            lange trägt er eine Spitze ab. Mails über seiner Grenze gehen im
            Modell einfach verloren. Azure rät, die Grenzen der eigenen Queue zu
            kennen: „understand its size quotas and retention limits“.
          </div>
          <div v-if="!isCause" class="wb-ex-li">
            <b>Retries:</b> als Verzögerungsleitung in Mengen je 0,1 s; Jitter
            verteilt sie als Mittelwert, ohne Zufallszahlen. Ob ein Versuch
            scheitert und ob er die Frist hält, entscheidet die Queue beim
            Senden (FIFO-Schätzung) — mit der Zeit seit dem Start des Checkouts,
            frühere Versuche und Pausen eingerechnet. Der Anbieter rechnet
            Gescheitertes trotzdem fertig, bis {{ PAY_GIVEUP_S }}&nbsp;s. Den
            Breaker füttern nur Ausgänge, die der Client kennt: erkannte
            Timeouts und gelungene Zahlungen.
          </div>
          <div v-if="!isCause" class="wb-ex-li">
            <b>Cache:</b> sofort warm, mit festen {{ CACHE_HIT_PCT }} %
            Treffern; Coalescing steckt darin und wird nicht eigens gerechnet.
            Den leeren Cache und seinen Sturm zeigt die Sim „Cache-Stampede“.
          </div>
          <div class="wb-ex-li">
            <b>Sonst:</b> der Zahlungsdienst als harte Rate; die Nachbar-VM als
            Schübe mit festen Effekten; Murphy adversarial; der Engpass über die
            geglättete Reserve statt über Rosers aktive Perioden.
          </div>

          <div class="wb-ex-h">Quellen</div>
          <div class="wb-ex-p wb-ex-src">
            Goldratt, The Goal (Kap. 18) · Lawrence & Buss 1994, „Shifting
            Production Bottlenecks“, POM 3(1), Abstract: „shiftiness declines
            when the capacity of nonbottleneck resources is increased“ · Roser,
            Nakano & Tanaka 2003, JSME Int. J. C 46(1): „the bottleneck shifts
            between different machines, depending on the preceding random
            events“; dieselben, „Shifting Bottleneck Detection“, WSC 2002 ·
            Hebert 2014, „Queues Don't Fix Overload“ · Google SRE Book, Kap. 21
            „Handling Overload“ und Kap. 22 „Addressing Cascading Failures“ ·
            Nygard, Release It! (2. Aufl. 2018), Kap. 5 „Stability Patterns“ ·
            AWS: EC2 Auto Scaling Warm Pools; Knowledge Center zu CPU steal time
            · AWS Builders' Library, „Caching challenges and strategies“ und
            Brooker, „Timeouts, retries, and backoff with jitter“ · Stripe API
            Reference, „Idempotent requests“; Stripe Engineering, „Scaling your
            API with rate limiters“ (2017) · Netflix concurrency-limits (README)
            · Envoy, circuit_breaker.proto (retry_budget) · Finagle,
            Clients-Guide (RetryBudget) · Azure Architecture Center, „Bulkhead
            pattern“ und „Queue-Based Load Leveling pattern“ · DataLoader
            (README) · Apache Kafka, Producer-Konfiguration linger.ms · man
            pages top(1), vmstat(8), proc_stat(5), iostat(1); Kernel-Doku PSI.
          </div>
          <div class="wb-ex-h">Verwandte Sims</div>
          <div class="wb-ex-rel">
            <button
              v-for="[alias, label] in RELATED"
              :key="alias"
              class="wb-xref"
              type="button"
              :title="`Zur Folie ${alias}`"
              @click="nav.go(alias)"
            >
              {{ label }} ↗
            </button>
          </div>
        </div>
      </div>
    </template>

    <template #gear>
      <div class="wb-gear">
        <div class="wb-gear-row">
          <span class="wb-gear-lab">Zufall</span>
          <button class="wb-gbtn" type="button" @click="newSeed">
            Neuer Seed
          </button>
          <button class="wb-gbtn" type="button" @click="rebuildSameSwitches">
            Gleicher Seed
          </button>
          <span class="wb-gear-seed">Seed {{ seedView }}</span>
        </div>
        <template v-if="isCause">
          <div class="wb-gear-row">
            <span class="wb-gear-lab">Nachbar-VM</span>
            <button
              class="wb-gbtn"
              type="button"
              :disabled="revealed || !nbScen"
              @click="reveal"
            >
              Alle aufdecken
            </button>
            <button
              class="wb-gbtn"
              type="button"
              :disabled="!revealed || !nbScen"
              @click="hideAll"
            >
              Wieder verdecken
            </button>
          </div>
          <div class="wb-gear-row" role="group" aria-label="Schwankung">
            <span class="wb-gear-lab">Schwankung</span>
            <button
              v-for="lvl in ['gering', 'mittel', 'stark']"
              :key="lvl"
              class="wb-gbtn"
              :class="{ 'wb-gbtn-on': cmView.noise === lvl }"
              type="button"
              :aria-pressed="cmView.noise === lvl"
              @click="setNoise(lvl)"
            >
              {{ lvl }}
            </button>
          </div>
          <div class="wb-gear-row">
            <button
              class="wb-cm wb-chip wb-gsw"
              role="switch"
              type="button"
              data-cm="headroomAll"
              :aria-checked="!!cmView.headroomAll"
              :title="`Gegenprobe: Webserver UND DB +${HEADROOM_PCT} %. Bei „Nur Zufall“ verschwindet die Überlast, die knappste Station wandert weiter; gegen die Nachbar-VM reicht die Reserve nicht.`"
              @click="toggleCm('headroomAll')"
            >
              <i class="wb-knob" aria-hidden="true" />Schutzkapazität +{{
                HEADROOM_PCT
              }}
              % überall
            </button>
          </div>
          <div class="wb-gear-note">
            Start-Seed gewählt: erstes Fenster mit mindestens
            {{ START_MIN_SHIFTS }} Engpass-Wechseln (Auswahl, keine Kalibrierung
            — siehe Erklärung). „+{{ HEADROOM_PCT }} % überall“: Bei „Nur
            Zufall“ verschwindet die Überlast, die knappste Station wandert
            weiter.
          </div>
        </template>
        <template v-else>
          <div class="wb-gear-row">
            <button
              class="wb-chip wb-gsw"
              role="switch"
              type="button"
              :aria-checked="skipTips"
              title="Drehbuch ohne Tipp-Abfrage: nur Zug ausführen und auflösen"
              @click="skipTips = !skipTips"
            >
              <i class="wb-knob" aria-hidden="true" />Tipps überspringen
            </button>
            <button
              class="wb-gbtn wb-allsw-toggle"
              type="button"
              :aria-expanded="showAll"
              title="Alle Gegenmaßnahmen mit Wirkung im Modell, nach Grundrichtung — die Leiste zeigt nur die Auswahl des Szenarios"
              @click="showAll = !showAll"
            >
              {{ showAll ? "▾" : "▸" }} Alle Schalter zeigen
            </button>
          </div>
          <div v-if="showAll" class="wb-allsw">
            <div
              v-for="g in scenGroups"
              :key="g.key"
              class="wb-allsw-g"
              :class="{ 'wb-allsw-one': g.items.length === 1 }"
              role="group"
              :aria-label="g.label"
            >
              <div class="wb-allsw-k">{{ g.label }}</div>
              <div class="wb-allsw-row">
                <template v-for="it in g.items" :key="it.key">
                  <div
                    v-if="it.seg"
                    class="wb-retrymode wb-allsw-seg"
                    role="group"
                    :aria-label="it.label"
                    :data-cm="it.key"
                    :title="it.title"
                  >
                    <span class="wb-seg-k" aria-hidden="true">↻ Retries</span>
                    <button
                      v-for="o in it.seg"
                      :key="o.v"
                      class="wb-segbtn"
                      type="button"
                      :data-mode="o.v"
                      :aria-pressed="cmView.retry === o.v"
                      :title="o.title"
                      @click="setRetry(o.v)"
                    >
                      {{ o.label }}
                    </button>
                  </div>
                  <button
                    v-else
                    class="wb-cm wb-chip wb-allsw-chip"
                    role="switch"
                    type="button"
                    :data-cm="it.key"
                    :aria-checked="!!cmView[it.key]"
                    :title="itemTitle(it)"
                    @click="toggleCm(it.key)"
                  >
                    <i class="wb-knob" aria-hidden="true" />{{ itemLabel(it) }}
                  </button>
                </template>
              </div>
            </div>
          </div>
          <div class="wb-gear-note">
            Zahlen illustrativ; Flussmodell. Jeder Schritt-Knopf rechnet das
            Drehbuch mit gleichem Seed bis zu diesem Schritt neu.
            {{
              showAll
                ? "Eingeschaltete Schalter erscheinen auch in der Leiste — gedimmt, wenn sie nicht zum Szenario gehören."
                : ""
            }}
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="wb-foot">
        <div class="wb-banner" :class="foot.tone ? `wb-tone-${foot.tone}` : ''">
          <b v-if="foot.lead">{{ foot.lead }}</b> {{ foot.text
          }}<template v-if="foot.l2"><br />{{ foot.l2 }}</template>
        </div>
      </div>
    </template>
  </SimShell>
</template>

<style scoped>
/* ===== Palette (design-ui §8): auf jedem Slot-Wurzelknoten ===== */
.wb-stage,
.wb-gear,
.wb-foot {
  --wb-panel: #ffffff;
  --wb-ink: #14213d;
  --wb-muted: #5a6878; /* ≥ 4,8:1 auch auf getönten Karten (9 px) */
  --wb-hair: #e2e8f0;
  --wb-hair-strong: #cbd5e1;
  --wb-load: #15803d;
  --wb-web: #2563eb;
  --wb-inv: #c2410c;
  --wb-pay: #9333ea;
  --wb-mail: #0e7490;
  --wb-bad: #dc2626;
  --wb-bad-fill: #dc2626;
  --wb-ok: #15803d;
  --wb-shed: #94a3b8;
  --wb-wait: #fcd34d;
  --wb-brake: #c2410c;
  --wb-nb-cpu: #be185d;
  --wb-nb-io: #0f766e;
}
:global(html.dark .wb-stage),
:global(html.dark .wb-gear),
:global(html.dark .wb-foot) {
  --wb-panel: #151b24;
  --wb-ink: #dee5f0;
  --wb-muted: #94a3b8;
  --wb-hair: #1e2536;
  --wb-hair-strong: #3e4a63;
  --wb-load: #22c55e;
  --wb-web: #3b82f6;
  --wb-inv: #f97316;
  --wb-pay: #a855f7;
  --wb-mail: #22d3ee;
  --wb-bad: #ef4444;
  --wb-bad-fill: #b91c1c;
  --wb-ok: #22c55e;
  --wb-shed: #64748b;
  --wb-wait: #a16207;
  --wb-brake: #fb923c;
  --wb-nb-cpu: #f472b6;
  --wb-nb-io: #2dd4bf;
}

/* Slot-Inhalte erben SimShells Reset nicht: eigene Box-Regeln */
.wb-stage,
.wb-stage *,
.wb-gear,
.wb-gear *,
.wb-foot,
.wb-foot * {
  box-sizing: border-box;
}

.wb-st-web {
  --wb-c: var(--wb-web);
}
.wb-st-inv {
  --wb-c: var(--wb-inv);
}
.wb-st-pay {
  --wb-c: var(--wb-pay);
}
.wb-st-mail {
  --wb-c: var(--wb-mail);
}
.wb-red {
  color: var(--wb-bad) !important;
}
.wb-idle {
  color: var(--wb-muted);
  font-style: italic;
}

/* ===== Header- und Preset-Knöpfe (Farben inline, siehe tStyle) ===== */
.wb-tbtn,
.wb-sw {
  border-radius: 7px;
  font-size: 11px;
  font-family: var(--slidev-code-font-family);
  cursor: pointer;
  white-space: nowrap;
  line-height: 1.2;
}
.wb-tbtn {
  padding: 5px 9px;
}
.wb-sw {
  padding: 3px 9px;
}
.wb-sw:disabled {
  opacity: 0.45;
  cursor: default;
}
.wb-speed {
  display: inline-flex;
  gap: 2px;
}
.wb-seg {
  padding: 5px 6px;
}
.wb-sep {
  display: inline-block;
  width: 1px;
  height: 16px;
  margin: 0 3px;
  background: var(--c-border);
}
.wb-dim {
  opacity: 0.7; /* gedimmt, aber lesbar: Schrift ≈ 5,9:1 */
}

/* ===== Stage: feste Höhe — wächst Text, schrumpft das Diagramm ===== */
.wb-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  color: var(--wb-ink);
  font-size: 10px;
  line-height: 1.3;
}
.wb-v-cause {
  height: 326px;
}
.wb-v-remedies {
  height: 339px;
}
.wb-top {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 20px;
  margin-bottom: 4px;
}
.wb-top .wb-tabs {
  width: auto;
  flex: none;
  --sk-tab-font-size: 9.5px;
  --sk-tab-pad: 2px 8px;
  --sk-tab-bar-mb: 0;
  --sk-tab-radius: 6px;
  --sk-tab-border: 1px solid var(--wb-hair-strong);
  --sk-tab-color: var(--wb-muted);
  --sk-tab-active-color: var(--wb-ink);
  --sk-tab-active-bg: var(--wb-panel);
  --sk-tab-active-border: var(--wb-muted);
  --sk-tab-hover-bg: var(--wb-panel);
}
.wb-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  white-space: nowrap;
}
.wb-pill-k {
  color: var(--wb-muted);
}
.wb-pill-bn {
  border-color: var(--wb-bad);
}
.wb-pill-kollabiert {
  box-shadow: inset 0 0 0 1px var(--wb-bad);
}
.wb-sq {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--wb-c);
}
.wb-clock {
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--wb-muted);
  white-space: nowrap;
  min-width: 92px;
  text-align: right;
}

.wb-body {
  flex: 1 1 0;
  min-height: 0;
}
.wb-body-remedies {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 8px;
}
.wb-main {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ===== Kette ===== */
.wb-grid {
  display: grid;
  align-items: stretch;
}
.wb-body-cause .wb-grid {
  grid-template-columns: 66px 16px 1fr 16px 1fr 16px 1fr;
}
.wb-body-remedies .wb-grid {
  grid-template-columns: 58px 12px 1fr 12px 1fr 12px 1fr;
}
/* Vier Stationen (Kurze Spitzen: Mailversand hinter der Kasse) in 556 px:
 * schmalerer Lastknoten, engere Pfeile und Karten-Ränder */
.wb-body-remedies .wb-chain-4 {
  grid-template-columns: 48px 9px 1fr 9px 1fr 9px 1fr 9px 1fr;
}
.wb-chain-4 .wb-card {
  padding: 7px 5px 4px;
}
.wb-chain-4 .wb-badge {
  right: 2px;
  padding: 0 4px;
}
.wb-chain {
  flex: none;
  padding-top: 9px; /* Platz für die Badges (top: -9px) */
}
.wb-load {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--wb-load) 30%, transparent);
  background: color-mix(in srgb, var(--wb-load) 8%, var(--wb-panel));
  color: var(--wb-load);
  font-weight: 600;
  padding: 3px 2px;
  min-width: 0;
}
.wb-load-k {
  font-size: 9px;
}
.wb-load-n {
  font-size: 15px;
  line-height: 1.1;
}
.wb-load-u {
  font-size: 9.5px;
  font-weight: 500;
}
.wb-load-ist {
  font-size: 9px;
  font-weight: 500;
  color: var(--wb-muted);
  white-space: nowrap;
}
.wb-load-e,
.wb-load-r {
  font-size: 9.5px;
  color: var(--wb-brake);
  white-space: nowrap;
}
.wb-load-r {
  color: var(--wb-pay);
}
.wb-load-b {
  font-size: 9.5px;
  font-weight: 500;
  color: var(--wb-ink);
  white-space: nowrap;
}
.wb-arrow {
  align-self: center;
  justify-self: center;
  font-size: 13px;
  line-height: 1;
  color: var(--wb-muted);
}
.wb-arrow-brake {
  color: var(--wb-brake);
}
.wb-card {
  position: relative;
  min-width: 0;
  padding: 7px 7px 4px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--wb-c) 35%, transparent);
  background: color-mix(in srgb, var(--wb-c) 6%, var(--wb-panel));
}
.wb-card[data-bottleneck="true"] {
  border-color: var(--wb-bad);
  box-shadow: inset 0 0 0 1px var(--wb-bad);
}
.wb-card > div {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-card-name {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wb-c);
  line-height: 13px;
}
.wb-card-sfx {
  font-weight: 400;
  font-size: 9px; /* Emoji-Zeilenbox in Firefox sonst 15 px */
}
.wb-card-cap {
  font-size: 12.5px;
  line-height: 16px;
}
.wb-card-cap s {
  color: var(--wb-muted);
}
.wb-unit {
  font-size: 9px;
  color: var(--wb-muted);
}
.wb-card-res {
  font-size: 9px;
  line-height: 12px;
  color: var(--wb-muted);
}
.wb-bar {
  height: 4px;
  margin: 2px 0 1px;
  border-radius: 2px;
  background: var(--wb-hair);
  overflow: hidden;
}
.wb-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--wb-c);
}
.wb-bar-bad {
  background: var(--wb-bad);
}
.wb-card-q,
.wb-card-x {
  font-size: 9px;
  line-height: 12px;
  color: var(--wb-ink);
}
.wb-card-x {
  color: var(--wb-muted);
}
.wb-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 2px;
  border-radius: 50%;
  background: var(--wb-web);
  vertical-align: 0;
}
.wb-dot-start {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--wb-web);
}
.wb-dot-more {
  font-size: 9px;
  margin-right: 3px;
  color: var(--wb-web);
}
/* Badge auf der Oberkante: 14 px hoch (−9 … +5), der Titel beginnt bei 7 —
 * auf den schmalen Karten (Gegenmaßnahmen) reicht es sonst bis in den Titel. */
.wb-badge {
  position: absolute;
  top: -9px;
  right: 6px;
  padding: 0 6px;
  border-radius: 7px;
  font-size: 9px;
  line-height: 12px;
  font-weight: 700;
  white-space: nowrap;
  background: var(--wb-panel);
  border: 1px solid var(--wb-hair-strong);
  color: var(--wb-muted);
}
.wb-badge-kollabiert {
  background: var(--wb-bad-fill);
  border-color: var(--wb-bad-fill);
  color: #ffffff;
}
.wb-badge-abgefangen {
  border-color: var(--wb-bad);
  color: var(--wb-bad);
  box-shadow: inset 0 0 0 1px var(--wb-bad);
}
.wb-badge-knappste {
  border-color: var(--wb-c);
  color: var(--wb-c);
}
.wb-brake-t,
.wb-warn-t {
  color: var(--wb-brake);
}

/* ===== Hosts (cause) ===== */
.wb-hosts {
  position: relative;
  flex: none;
  height: 52px;
}
.wb-hosts-k {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wb-muted);
  text-align: center;
}
.wb-hosts-k span {
  display: block;
  font-weight: 400;
  font-size: 9px;
}
.wb-host {
  grid-row: 1;
  min-width: 0;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px dashed var(--wb-hair-strong);
  background: var(--wb-panel);
  overflow: hidden;
}
.wb-host[data-host="A"] {
  grid-column: 3;
}
.wb-host[data-host="B"] {
  grid-column: 5;
}
.wb-host-ext {
  grid-column: 7;
}
.wb-host > div {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-host-name {
  font-size: 9px;
  line-height: 12px;
  color: var(--wb-muted);
  font-weight: 600;
}
.wb-host-eff {
  font-size: 9.5px;
  line-height: 13px;
}
.wb-host-spark {
  position: relative;
  height: 17px;
  margin-top: 1px;
}
.wb-host-spark svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.wb-sp-cpu {
  fill: color-mix(in srgb, var(--wb-nb-cpu) 30%, transparent);
  stroke: var(--wb-nb-cpu);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.wb-sp-io {
  fill: color-mix(in srgb, var(--wb-nb-io) 30%, transparent);
  stroke: var(--wb-nb-io);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.wb-sp-trace {
  fill: none;
  stroke: var(--wb-ink);
  stroke-width: 1;
  opacity: 0.75;
  vector-effect: non-scaling-stroke;
}
/* links über dem ältesten Teil: die jüngsten Minuten rechts bleiben frei */
.wb-sp-lab {
  position: absolute;
  left: 2px;
  top: 2px;
  font-size: 9px;
  line-height: 12px;
  padding: 0 3px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--wb-panel) 85%, transparent);
  color: var(--wb-ink);
  white-space: nowrap;
}
/* Unterkante der Hosts: 52 − 2 − 19 = 31 px, die Wirkungszeile endet bei 28 —
 * sonst berühren die Unterlängen („req/s“) das Streifenband. */
.wb-host-lock {
  grid-column: 3 / 6;
  grid-row: 1;
  align-self: end;
  height: 19px;
  margin: 0 4px 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--wb-muted) 14%, transparent) 0 5px,
    transparent 5px 10px
  );
}
.wb-unlock {
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 10px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid var(--wb-nb-cpu);
  color: var(--wb-ink);
  background: var(--wb-panel);
}
.wb-wipe {
  animation: wb-wipe 1.2s ease-out both;
}
@keyframes wb-wipe {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

/* ===== Diagramm: füllt den Rest ===== */
.wb-chartwrap {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  border: 1px solid var(--wb-hair-strong);
  border-radius: 6px;
  background: var(--wb-panel);
  overflow: hidden;
}
.wb-chart {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.wb-legend {
  flex: none;
  display: flex;
  gap: 10px;
  height: 13px;
  font-size: 9px;
  line-height: 13px;
  color: var(--wb-muted);
  white-space: nowrap;
  overflow: hidden;
}
.wb-lg {
  display: inline-block;
  width: 12px;
  height: 3px;
  margin-right: 3px;
  vertical-align: middle;
  border-radius: 2px;
  background: var(--wb-c);
}
.wb-lg-cpu {
  height: 6px;
  background: var(--wb-nb-cpu);
}
.wb-lg-io {
  height: 6px;
  background: var(--wb-nb-io);
}
.wb-lg-over {
  background: color-mix(in srgb, var(--wb-bad) 18%, transparent);
  box-shadow: inset 0 1px 0 var(--wb-bad);
}
.wb-lg-wait {
  background: var(--wb-wait);
}
.wb-lg-note {
  font-style: italic;
}
.wb-lg-k {
  font-weight: 700;
}
.wb-body-remedies .wb-legend {
  gap: 5px;
}
.wb-body-remedies .wb-lg {
  width: 10px;
}
.wb-lg-box {
  width: 8px;
  height: 8px;
  border-radius: 1px;
}
.wb-lg-ok {
  background: var(--wb-ok);
}
.wb-lg-deg {
  background: var(--wb-ok);
  opacity: 0.45;
}
.wb-lg-shed {
  background: var(--wb-shed);
}
.wb-lg-bad {
  background: var(--wb-bad);
}
.wb-lg-okl {
  background: var(--wb-ok);
}
.wb-lg-try {
  height: 2px;
}
.wb-lg-ink {
  --wb-c: var(--wb-ink);
}
.wb-lg-okc {
  --wb-c: var(--wb-ok);
}
.wb-lg-dash,
.wb-lg-dot {
  height: 0;
  background: none;
  border-top: 2px dashed var(--wb-c);
}
.wb-lg-dot {
  border-top-style: dotted;
}

/* ===== Rechte Spalte (remedies) ===== */
.wb-side {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* eigene Zeile unter der Leiste (kein Overlay über einem Schalter): die
 * dichte Leiste gibt dafür 9 px ab */
.wb-rail-more {
  flex: none;
  align-self: flex-end;
  height: 11px;
  margin-top: -4px;
  padding: 0 5px;
  font-size: 9px;
  line-height: 11px;
  font-weight: 700;
  color: var(--wb-ink);
  border-bottom: 1px solid var(--wb-hair-strong);
  pointer-events: none;
}
.wb-script {
  flex: none;
  height: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px 5px;
  border-radius: 7px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  overflow: hidden;
}
.wb-script-dirty {
  border-color: var(--wb-brake);
}
.wb-script-head {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 18px;
  flex: none;
}
.wb-script-k {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wb-muted);
  margin-right: 4px;
}
.wb-stepbtn {
  width: 18px;
  height: 17px;
  padding: 0;
  font-size: 9.5px;
  line-height: 15px;
  font-family: var(--slidev-code-font-family);
  border-radius: 4px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-muted);
  cursor: pointer;
}
.wb-step-done {
  color: var(--wb-ink);
  background: var(--wb-hair);
}
.wb-step-cur {
  color: var(--wb-ink);
  border-color: var(--wb-ink);
  box-shadow: inset 0 0 0 1px var(--wb-ink);
  font-weight: 700;
}
.wb-score {
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wb-muted);
}
.wb-score-hit {
  color: var(--wb-ok);
}
.wb-line {
  font-size: 9.5px;
  line-height: 12.5px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 25px;
}
.wb-line b {
  color: var(--wb-muted);
  font-weight: 600;
}
.wb-fazit {
  -webkit-line-clamp: 5;
  min-height: 0;
}
.wb-q {
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-tips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 18px 18px;
  gap: 3px;
  flex: none;
}
.wb-tips-skip {
  grid-template-columns: 1fr;
  grid-template-rows: 39px;
}
.wb-tip {
  font-size: 9.5px;
  line-height: 14px;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-ink);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-tip:disabled {
  cursor: default;
}
.wb-tip-chosen {
  border-color: var(--wb-ink);
  box-shadow: inset 0 0 0 1px var(--wb-ink);
  font-weight: 700;
}
.wb-tip-correct {
  border-color: var(--wb-ok);
  background: color-mix(in srgb, var(--wb-ok) 14%, var(--wb-panel));
  box-shadow: inset 0 0 0 1px var(--wb-ok);
}
.wb-tip-wrong {
  border-color: var(--wb-bad);
  box-shadow: inset 0 0 0 1px var(--wb-bad);
  text-decoration: line-through;
}
.wb-dirty {
  flex: none;
  height: 39px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  font-size: 9.5px;
  line-height: 12px;
  color: var(--wb-brake);
}
.wb-back,
.wb-next,
.wb-tip-skip {
  font-size: 9.5px;
  line-height: 13px;
  padding: 1px 8px;
  border-radius: 5px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-ink);
  cursor: pointer;
  white-space: nowrap;
}
.wb-back {
  border-color: var(--wb-brake);
}
.wb-next {
  margin-left: auto;
  border-color: var(--wb-ok);
  font-weight: 700;
}
.wb-tip-go {
  font-size: 10.5px;
  font-weight: 700;
  border-color: var(--wb-ok);
}
.wb-script-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 17px;
  flex: none;
}
.wb-tip-fb {
  font-size: 9.5px;
  line-height: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--wb-muted);
}
.wb-tip-fb[data-ok="true"] {
  color: var(--wb-ok);
  font-weight: 700;
}
.wb-tip-fb[data-ok="false"] {
  color: var(--wb-bad);
  font-weight: 700;
}
.wb-tip-skip:not(.wb-tip-go) {
  margin-left: auto;
  border-style: dashed;
}

/* Schalter-Leiste */
/* Spalte 2 etwas breiter: „Scaling 2→12“ bzw. „12→20“ teilt sich die Zeile
 * mit dem Modus-Knopf und wird angeschaltet fett. */
.wb-rail {
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 130fr) minmax(0, 142fr);
  gap: 6px;
}
.wb-rail-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wb-rail-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wb-rail-k {
  font-size: 9px;
  line-height: 11px;
  font-weight: 700;
  color: var(--wb-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-rail-row {
  display: flex;
  gap: 3px;
  min-width: 0;
}
.wb-chip {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 5px;
  font-size: 9.5px;
  line-height: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-ink);
  cursor: pointer;
}
.wb-knob {
  flex: none;
  width: 14px;
  height: 8px;
  border-radius: 4px;
  background: var(--wb-hair-strong);
  position: relative;
}
.wb-knob::after {
  content: "";
  position: absolute;
  top: 1px;
  left: 1px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wb-panel);
}
.wb-chip[aria-checked="true"] {
  border-color: var(--wb-ok);
  background: color-mix(in srgb, var(--wb-ok) 12%, var(--wb-panel));
  box-shadow: inset 0 0 0 1px var(--wb-ok);
  font-weight: 600;
}
.wb-chip[aria-checked="true"] .wb-knob {
  background: var(--wb-ok);
}
.wb-chip[aria-checked="true"] .wb-knob::after {
  left: 7px;
}
/* Dicht (mehr Schalter, als in die 149 px passen; Höhen wie groupH): Label
 * 10, je Schalter 1 + 15; reicht auch das nicht, scrollt die Leiste. */
.wb-rail-dense {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
.wb-rail-dense .wb-rail-group {
  gap: 1px;
}
.wb-rail-dense .wb-rail-k {
  line-height: 10px;
}
.wb-rail-dense .wb-chip,
.wb-rail-dense .wb-scalemode {
  height: 15px;
}
/* Zeile mit Modus-Knopf: „Scaling 12→20“ (fett) braucht jeden Pixel */
.wb-chip-mode {
  gap: 3px;
  padding: 0 4px;
}
.wb-scalemode {
  flex: none;
  height: 18px;
  padding: 0 4px;
  font-size: 9px;
  line-height: 1;
  border-radius: 5px;
  border: 1px dashed var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-muted);
  cursor: pointer;
}
.wb-scalemode[aria-pressed="true"] {
  border-style: solid;
  border-color: var(--wb-ok);
  color: var(--wb-ink);
}
/* Retry-Modus: Segmente in einer Zeile (aria-pressed, keine Radiogroup —
 * die Pfeiltasten gehören dem Klicker) */
.wb-retrymode {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: stretch;
  height: 18px;
  border-radius: 5px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  overflow: hidden;
}
.wb-seg-k {
  flex: none;
  align-self: center;
  padding: 0 3px 0 4px;
  font-size: 9.5px;
  line-height: 1;
  color: var(--wb-muted);
  white-space: nowrap;
}
.wb-segbtn {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 3px;
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  border: none;
  border-left: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-ink);
  cursor: pointer;
}
.wb-segbtn[aria-pressed="true"] {
  background: color-mix(in srgb, var(--wb-ok) 14%, var(--wb-panel));
  box-shadow: inset 0 0 0 1px var(--wb-ok);
  font-weight: 700;
}
.wb-rail-dense .wb-retrymode {
  height: 15px;
}
.wb-pulse {
  animation: wb-pulse 0.8s ease-in-out 2;
}
@keyframes wb-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--wb-ok) 0%, transparent);
  }
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--wb-ok) 35%, transparent);
  }
}

/* ===== Erklär-Tab ===== */
.wb-explain {
  position: relative; /* offsetTop der Abschnitte (Sprung beim Öffnen) */
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding-right: 6px;
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--wb-ink);
}
.wb-ex-sys {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.wb-ex-node {
  display: inline-flex;
  flex-direction: column;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  font-weight: 700;
  color: var(--wb-c, var(--wb-load));
}
.wb-ex-lbl {
  font-weight: 400;
  font-size: 9px;
  color: var(--wb-muted);
  font-family: var(--slidev-code-font-family);
}
.wb-ex-arrow {
  color: var(--wb-muted);
}
.wb-ex-h {
  margin: 8px 0 3px;
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--wb-web);
}
.wb-ex-p {
  margin: 0 0 5px;
}
.wb-ex-note,
.wb-ex-src {
  font-size: 9.5px;
  color: var(--wb-muted);
}
.wb-ex-li {
  position: relative;
  padding-left: 11px;
  margin: 0 0 3px;
}
.wb-ex-li::before {
  content: "▪";
  position: absolute;
  left: 0;
  color: var(--wb-muted);
}
.wb-ex-table {
  display: grid;
  grid-template-columns: 170px 1fr 1fr;
  border-top: 1px solid var(--wb-hair-strong);
  margin-bottom: 4px;
}
.wb-ex-th,
.wb-ex-td {
  padding: 2px 6px 2px 0;
  border-bottom: 1px solid var(--wb-hair);
}
.wb-ex-th {
  font-size: 9px;
  font-weight: 700;
  color: var(--wb-muted);
}
.wb-ex-rel {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-bottom: 6px;
}
.wb-xref {
  font-size: 9.5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-ink);
  cursor: pointer;
}

/* ===== ⚙ ===== */
.wb-gear {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 300px;
  color: var(--wb-ink);
  font-size: 10px;
}
.wb-gear-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.wb-gear-lab {
  width: 70px;
  font-family: var(--slidev-code-font-family);
  font-size: 9.5px;
  color: var(--wb-muted);
}
.wb-gear-seed {
  font-family: var(--slidev-code-font-family);
  font-size: 9px;
  color: var(--wb-muted);
}
.wb-gbtn {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--wb-hair-strong);
  background: var(--wb-panel);
  color: var(--wb-ink);
  cursor: pointer;
}
.wb-gbtn:disabled {
  opacity: 0.45;
  cursor: default;
}
.wb-gbtn-on {
  border-color: var(--wb-ok);
  box-shadow: inset 0 0 0 1px var(--wb-ok);
  font-weight: 700;
}
.wb-gsw {
  flex: none;
  height: 20px;
  font-size: 10px;
}
.wb-gear-note {
  font-size: 9.5px;
  line-height: 1.4;
  color: var(--wb-muted);
  max-width: 380px;
}
/* ⚙ „Alle Schalter zeigen“: kompakt, je Grundrichtung eine Zeile Chips */
.wb-allsw {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 390px;
}
.wb-allsw-k {
  font-size: 9px;
  line-height: 11px;
  font-weight: 700;
  color: var(--wb-muted);
}
.wb-allsw-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 1px;
}
.wb-allsw-chip,
.wb-allsw-seg {
  flex: none;
}
/* Gruppen mit einem Schalter: Label und Chip in einer Zeile — sonst reicht
 * die Liste mit „Puffern & glätten“ (Kurze Spitzen) in die Nav-Zone */
.wb-allsw-one {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wb-allsw-one .wb-allsw-row {
  margin-top: 0;
}

/* ===== Fußzeile: nicht interaktiv, genau zwei Zeilen ===== */
.wb-foot {
  margin-top: 6px;
}
.wb-banner {
  height: 36px;
  padding: 3px 9px;
  font-size: 10px;
  line-height: 14px;
  border-radius: 7px;
  border: 1px solid var(--wb-hair-strong);
  color: var(--wb-ink);
  background: var(--wb-panel);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wb-tone-warn {
  border-color: var(--wb-inv);
}
.wb-tone-bad {
  border-color: var(--wb-bad);
}
.wb-tone-ok {
  border-color: var(--wb-ok);
}

@media (prefers-reduced-motion: reduce) {
  .wb-wipe,
  .wb-pulse {
    animation: none;
  }
}
</style>
