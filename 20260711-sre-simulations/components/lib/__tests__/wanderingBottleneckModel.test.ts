/**
 * wanderingBottleneckModel.test.ts — pinnt das Flussmodell „Wandernde
 * Engpässe“ gegen die Drehbücher (Rabattaktion, Teure Abfragen) und gegen
 * die Kalibrierziele bei konstanter Last (gemessen, seed-fixiert).
 *
 * Messwerte (Seeds 1 + i·104729):
 *  - Drehbuch, 50 Seeds, ein Live-Lauf je Seed: 50/50 in jedem Schritt.
 *    Seiten/s · Bestellungen/s: Stufe 2 ≈ 293 · 10,2 — Stufe 3 ≈ 283 · 27,5
 *    — Stufe 4 ≈ 910 · 0 — Stufe 5 ≈ 910 · 69,4. Verloren/s: Stufe 0/1
 *    ≈ 1.000 (aufgegeben + zu spät), Stufe 4 ≈ 90 (nur Checkouts).
 *  - Neuer Engpass nach dem Scaling-Klick: reaktiv ≈ 99 s, vorgewärmt ≈ 15 s.
 *  - Drehbuch „teuer“, 50 Seeds: 50/50 in jedem Schritt (1.000 Seeds: 0
 *    Abweichungen). Seiten/s · Bestellungen/s: Start ≈ 291 · 10,2 — Scaling
 *    12 → 20 ≈ 291 · 10,3 — Batching ≈ 335 · 11,9 (k ≈ 42, +25 ms) — Cache
 *    ≈ 818 · 68,7. Reserve bei der Auflösung: DB −61 % nach Batching, nach
 *    dem Cache DB +24,5 % [+14; +34], Kasse −13,8 % [−22; −8].
 *  - Konstante Last, 10 min, 20 Seeds (Engpass-Wechsel · Engpass-Zeit ·
 *    Wechsel der knappsten Station): Nachbar zufällig 7,4 · 50 % · 9,2 —
 *    Nur Zufall 2,15 · 14 % · 8,9 — Murphy 8,3 · 63 % — Nur Zufall +
 *    Schutzkapazität 0 · 8 % · 2,2 — Nur Zufall + 20 % überall 0 · 0 % · 9,2
 *    — Eigener Host 0. Diese Seeds liegen bei „Nur Zufall“ eher niedrig:
 *    über 400 Seeds sind es ≈ 17 % Engpass-Zeit.
 *  - Ohne Hysterese wechselt die knappste Station bei Nur Zufall ≈ 17-mal
 *    statt ≈ 9-mal (Flattern), mit 10 % ≈ 4-mal.
 *  - Murphy-Fallback (Schlag ohne Tief nach 90 s): ≈ 6 % (Nachbar) bzw.
 *    ≈ 9 % (Nur Zufall) der Schläge; über 100 Seeds ≈ 9 %.
 *  - Drehbuch „retry“, 50 Seeds: 50/50 in jedem Schritt samt eigener Frage
 *    (Breaker-Schritt: 1.000 weitere Seeds, 0 Abweichungen). Versuche je
 *    Erstversuch, letzte 10 s: naiv ≈ 2,82 — Backoff ≈ 2,56 — Jitter ≈
 *    2,53 — Budget 1,02 — Breaker 1,01 (über den ganzen Schritt gezählt
 *    Jitter ≈ 3,02: Retries des vorigen Sturms ohne ihre Erstversuche).
 *    Spitze/Mittel der Retries nach dem Neustart: Backoff 1,88–2,00,
 *    Jitter 1,28–1,36. Bestellungen/s rechtzeitig (Frist 2 s über den
 *    ganzen Checkout; letzte 10 s): 0,06 — 2,4 — 0,9 — 49,9 — 9,9 (Breaker:
 *    seit dem Zug). Breaker: öffnet 3,9–4,4 s nach dem Zug (erkannte
 *    Timeouts), half-open ab ≈ 7 s, schließt ≈ 9,2 s, wenn die Proben
 *    gelingen; „abgefangen“ in allen Seeds zwischen 8,2 und 9,8 s —
 *    aufgelöst bei 8,7 s.
 *  - Drehbuch „empfehlung“, 50 Seeds: 50/50 in jedem Schritt samt eigener
 *    Frage (1.000 weitere Seeds: 0 Abweichungen). Mittel der letzten 10 s:
 *    Hänger 0 Seiten · 0 Bestellungen, ≈ 144/s zu spät (Reserve Webserver
 *    ≈ −30 %, Kapazität ≈ 149 req/s, Threads 97 %) — Bulkheads 0 · 20,
 *    ≈ 200/s verloren (−44 %) — Timeouts ≈ 199 · 20, alle Seiten ohne
 *    Empfehlungen, Threads ≈ 50 (Little: 200 × 0,25 s) — Breaker ≈ 200 ·
 *    20, Wartezeit auf Empfehlungen ≈ 0, DB +300 %.
 *  - Drehbuch „bots“, 50 Seeds: 50/50 in jedem Schritt samt eigener Frage
 *    (1.000 weitere Seeds: 0 Abweichungen; verzögerte Züge 0–150 s: 0).
 *    Mittel der letzten 20 s — Kundenseiten · Kunden abgewiesen · Bot
 *    rechtzeitig · Bot abgewiesen: Bot-Ansturm 0 · 0 · 0 · 0 (≈ 600/s
 *    verloren, DB-Wartezeit ≈ 7,9 s) — Shedding ≈ 89 · 139 · 195 · 304
 *    (DB-Wartezeit ≈ 0,45 s) — Rate Limit ≈ 229 · 0 · 10 · 490 —
 *    Admission + IO-Schub ≈ 0 · 0 · 0 · 490 (≈ 258/s verloren, DB-Wartezeit
 *    ≈ 12,5 s) — Back Pressure im IO-Schub ≈ 153 · 78 · 6,6 · 493.
 *
 * Budget ≈ 1,5 Mio. Schritte (≈ 1 s); Sweeps einmal memoisiert.
 */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import { mulberry32 } from "../rng.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pures JS-Modul ohne Typdeklarationen
import {
  AMP_X11,
  AMP_X2,
  AMP_X3,
  ASK_KINDS,
  BATCH_LAT_S,
  BATCH_WINDOW_S,
  BREAKER_CLOSE_S,
  BREAKER_OPEN_S,
  BREAKER_TAU_S,
  BULKHEAD_CHECKOUT,
  BottleneckSim,
  CACHE_HIT,
  CM_DEFAULTS,
  CM_PHASE2,
  DB_TIMEOUT_S,
  EMPF_CHECKOUTS,
  EMPF_LOAD,
  EMPF_PAGES,
  HALF_ADMIT,
  N_WEB_EMPF,
  PAY_BROWNOUT,
  PAY_BROWNOUT_S,
  PAY_GIVEUP_S,
  PAY_TIMEOUT_S,
  N_WEB_RETRY,
  RETRY_BASE_S,
  RETRY_BUDGET,
  RETRY_CHECKOUTS,
  RETRY_FEW_SHARE,
  RETRY_LOAD,
  RETRY_MAX_ATTEMPTS,
  RETRY_MODES,
  RETRY_START_S,
  RETRY_WAVE_RATIO,
  RETRY_WAVE_SKIP_S,
  retryWaveRatio,
  REC_LAT_S,
  REC_SLOW_AT_S,
  REC_SLOW_S,
  REC_TIMEOUT_S,
  THREADS_EMPF,
  THREADS_EMPF_TOTAL,
  TIP_WINDOW_S,
  observeTip,
  CAMPAIGN_CHECKOUTS,
  CAMPAIGN_PAGES,
  COLLAPSE_WAIT_S,
  DT,
  INV_AVAIL_E,
  INV_CAP_E,
  INV_OVERHEAD_E,
  INV_PAGES_PER_S,
  INV_PAGE_CACHED_E,
  INV_PAGE_E,
  INV_PER_ITEM_E,
  INV_RECO_CACHED_E,
  INV_RECO_E,
  INV_RESERVE_E,
  LOAD_CAMPAIGN,
  N_WEB_TEUER,
  SCALE_TARGET_TEUER,
  TEUER_LOAD,
  MURPHY_GAP_S,
  MURPHY_LOW_Z,
  MURPHY_MAX_WAIT_S,
  NB_HIT_GRACE_S,
  PAY_CAP,
  SCALE_COLD_S,
  SCALE_DETECT_S,
  SCALE_PREWARM_S,
  SCALE_REACTIVE_S,
  SCALE_TARGET,
  SCENARIOS,
  SCRIPTS,
  SCRIPT_FIGURES,
  START_MAX_TRIES,
  START_MIN_SHIFTS,
  THREADS_PER_INSTANCE,
  N_WEB_START,
  WEB_PER_INSTANCE,
  pickStartSeed,
  playScript,
  replay,
  MAIL_CAP,
  MAIL_EXCESS,
  MAIL_GIVEUP_S,
  MAIL_LATE_S,
  MAIL_LOST_SHARE,
  MAIL_MAX_AGE_S,
  MAIL_Q_EFF,
  MAIL_Q_MAX,
  MAIL_SMOOTH_TAU_S,
  MAIL_TIP_WINDOW_S,
  MAIL_WAVE_BACKLOG,
  MAIL_WAVE_DELAY_S,
  N_WEB_SPITZEN,
  SCALE_TARGET_SPITZEN,
  SPITZEN_AVG,
  SPITZEN_BASE,
  SPITZEN_ON_S,
  SPITZEN_PAGES,
  SPITZEN_PEAK,
  SPITZEN_PERIOD_S,
  SPITZEN_START_S,
  STATIONS as STATIONS_M,
  WAVE_RAMP_S,
  stationsOf,
  waveShape,
  ADMISSION_RPS,
  BOT_429,
  BOT_RATE,
  BOT_START_S,
  BOTS_CHECKOUTS,
  BOTS_CUST_E,
  BOTS_DB_E,
  BOTS_LOAD,
  BOTS_PAGES,
  BOTS_TOTAL,
  DB_AWAIT_BASE_MS,
  DB_IO_SHARE,
  DB_PERMIT_S,
  INV_CAP_IO_E,
  INV_PAGES_PER_S_IO,
  IO_BURST_AWAIT,
  IO_BURST_S,
  NB_AWAIT_MAX,
  NB_PHASE_MAX_S,
  N_WEB_BOTS,
  RL_BURST,
  RL_RATE,
  SCALE_TARGET_BOTS,
  SHED_DB_BAND_S,
  SHED_DB_S,
  SHED_TARGET_S,
  SHED_C_TARGET_S,
  CONV,
  LOAD_RAMP_S,
  STEPS_PER_S,
  TIP_OK_SHARE,
  TIP_PART_SHARE,
  WEB_CAP_BOTS,
  WEN_SHARE,
} from "../wanderingBottleneckModel.js";

type Station = "web" | "inv" | "pay";
type Vec = Record<Station, string>;
const STATIONS: Station[] = ["web", "inv", "pay"];
const SEEDS50 = Array.from({ length: 50 }, (_, i) => 1 + i * 104729);
const SEEDS20 = SEEDS50.slice(0, 20);
const SEEDS10 = SEEDS50.slice(0, 10);
const SLOW = { timeout: 15_000 }; // Sweeps: Vitest-Default sind 5 s
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

/* Wörtliche Kopie der Drehbuch-Tabelle „rabatt“ aus dem Plan (§1) —
 * absichtlich NICHT aus SCRIPTS gelesen: Modell und Szenario-Daten dürfen
 * nicht gemeinsam vom Plan wegdriften. `bn` = aufgelöstes „bleibt“. */
const PLAN_RABATT: {
  key: string;
  action: Record<string, unknown>;
  expect: string;
  bn: Station;
  overload: Vec;
}[] = [
  {
    key: "start",
    action: {},
    expect: "web",
    bn: "web",
    overload: { web: "kollabiert", inv: "ok", pay: "ok" },
  },
  {
    key: "scale",
    action: { scale: true, scaleMode: "reaktiv" },
    expect: "inv",
    bn: "inv",
    overload: { web: "ok", inv: "kollabiert", pay: "ok" },
  },
  {
    key: "bpInv",
    action: { bpInv: true },
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
  },
  {
    key: "shedBrowse",
    action: { shedBrowse: true },
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
  },
  {
    key: "featureShed",
    action: { featureShed: true },
    expect: "pay",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "kollabiert" },
  },
  {
    key: "payProtect",
    action: { bpPay: true, shedCheckout: true },
    expect: "bleibt",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "abgefangen" },
  },
];

/* Drehbuch „teuer“ (Phase 2, Familie „Arbeit reduzieren“), wörtlich aus dem
 * Auftrag — mit EINER bewussten Abweichung: Batching kommt VOR dem Cache
 * (Auftrag: scale → cache → batch, „ggf. → pay“). Batching spart je Seite
 * höchstens den Overhead 0,2 E; mit dem Cache zuerst stünde die Kasse bei
 * der Auflösung nur ≈ 8 % unter ihrer Grenze, 4 von 50 Seeds sähen sie
 * schon überlastet. Absichtlich NICHT aus SCRIPTS gelesen. */
const PLAN_TEUER: typeof PLAN_RABATT = [
  {
    key: "start",
    action: {},
    expect: "inv",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
  },
  {
    key: "scale",
    action: { scale: true, scaleMode: "vorgewaermt" },
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
  },
  {
    key: "batch",
    action: { batch: true },
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
  },
  {
    key: "cache",
    action: { cache: true },
    expect: "pay",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "abgefangen" },
  },
];

/* Drehbuch „empfehlung“ (Phase 2, Familie „Überlast isolieren +
 * Verstärkung verhindern“), wörtlich aus dem Auftrag: Hänger → Webserver
 * (Threads), Bulkheads → Checkouts laufen, Seiten hängen weiter; Timeouts →
 * Seiten schnell, degradiert; Breaker → schnelle Absage. Ab Schritt 1 eine
 * eigene Frage (ask) mit erwartetem Ausgang (answer); bn = null heißt „kein
 * Engpass“. Absichtlich NICHT aus SCRIPTS gelesen. */
const PLAN_EMPFEHLUNG: {
  key: string;
  action: Record<string, unknown>;
  expect: string | null;
  bn: Station | null;
  overload: Vec;
  ask?: string;
  answer?: string;
}[] = [
  {
    key: "start",
    action: {},
    expect: "web",
    bn: "web",
    overload: { web: "kollabiert", inv: "ok", pay: "ok" },
  },
  {
    key: "bulkhead",
    action: { bulkhead: true },
    expect: "bleibt",
    bn: "web",
    overload: { web: "kollabiert", inv: "ok", pay: "ok" },
    ask: "checkout",
    answer: "laufen",
  },
  {
    key: "timeouts",
    action: { timeouts: true },
    expect: null,
    bn: null,
    overload: { web: "ok", inv: "ok", pay: "ok" },
    ask: "browse",
    answer: "degradiert",
  },
  {
    key: "breaker",
    action: { breaker: true },
    expect: null,
    bn: null,
    overload: { web: "ok", inv: "ok", pay: "ok" },
    ask: "recWait",
    answer: "keine",
  },
];

/* Drehbuch „retry“ (Phase 2, Familie „Verstärkung verhindern“), wörtlich aus
 * dem Auftrag: naiv → Zahlungsdienst kollabiert (Verstärkung > 1,8×);
 * Backoff → Wellen; + Jitter → glatt; + Budget → Last gedeckelt (< 1,12×);
 * + Breaker → schnelle Absage. Jeder Schritt spielt dieselbe Störung ab
 * (event). Backoff und Jitter ändern die Menge nicht: Der Sturm bleibt, die
 * Station auch („bleibt“); erst das Budget beendet ihn (kein Engpass), der
 * Breaker fängt die nächste Störung ab. Absichtlich NICHT aus SCRIPTS
 * gelesen. */
const PLAN_RETRY: ((typeof PLAN_EMPFEHLUNG)[number] & { event: string })[] = [
  {
    key: "start",
    action: {},
    event: "stoerung",
    expect: "pay",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "kollabiert" },
  },
  {
    key: "backoff",
    action: { retry: "backoff" },
    event: "stoerung",
    expect: "bleibt",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "kollabiert" },
    ask: "retryShape",
    answer: "wellen",
  },
  {
    key: "jitter",
    action: { retry: "backoffJitter" },
    event: "stoerung",
    expect: "bleibt",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "kollabiert" },
    ask: "retryShape",
    answer: "glatt",
  },
  {
    key: "budget",
    action: { retryBudget: true },
    event: "stoerung",
    expect: null,
    bn: null,
    overload: { web: "ok", inv: "ok", pay: "ok" },
    ask: "payLoad",
    answer: "x11",
  },
  {
    key: "breaker",
    action: { breaker: true },
    event: "stoerung",
    expect: "pay",
    bn: "pay",
    overload: { web: "ok", inv: "ok", pay: "abgefangen" },
    ask: "kunden",
    answer: "sofort",
  },
];

/* Drehbuch „spitzen“ (Phase 2, Familie „Spitzen zeitlich verteilen“),
 * wörtlich aus dem Auftrag: Mailversand synchron im Checkout, Wellen →
 * Mailversand kollabiert in den Wellen (Bestellungen verloren); smoothing →
 * Bestellungen kommen durch, Mails verspätet, aber vollständig; „Aktion
 * verlängert: Dauerlast“ (Mittel > Kapazität) → der Puffer läuft voll,
 * Mails gehen verloren. Überlastvektor mit vierter Station. Absichtlich
 * NICHT aus SCRIPTS gelesen. */
const PLAN_SPITZEN: {
  key: string;
  action: Record<string, unknown>;
  event?: string;
  expect: string | null;
  bn: string | null;
  overload: Record<string, string>;
  ask?: string;
  answer?: string;
}[] = [
  {
    key: "start",
    action: {},
    expect: "mail",
    bn: "mail",
    overload: { web: "ok", inv: "ok", pay: "ok", mail: "kollabiert" },
  },
  {
    key: "smoothing",
    action: { smoothing: true },
    expect: null,
    bn: null,
    overload: { web: "ok", inv: "ok", pay: "ok", mail: "ok" },
    ask: "mails",
    answer: "verspaetet",
  },
  {
    key: "dauerlast",
    action: {},
    event: "dauerlast",
    expect: "mail",
    bn: "mail",
    overload: { web: "ok", inv: "ok", pay: "ok", mail: "abgefangen" },
    ask: "mails",
    answer: "verloren",
  },
];
const STATIONS4 = ["web", "inv", "pay", "mail"] as const;

/* Drehbuch „bots“ (Phase 2, Familie „Zufluss bremsen“), wörtlich aus dem
 * Auftrag: Bot → DB überlastet; Load Shedding → abgefangen, trifft Kunden
 * UND Bot; Rate Limit → nur der Bot, Kunden laufen — der Engpass bleibt
 * (die Nachfrage des Bots bleibt Nachfrage), aber entlastet; Admission
 * statisch + erzwungener IO-Schub der Nachbar-VM → die DB kollabiert wieder;
 * Back Pressure → abgefangen. Ab Schritt 1 eigene Fragen. EINE bewusste
 * Abweichung: Schritt 2 schaltet das Shedding ab („Rate Limit statt
 * Shedding“) — der Shedder reagiert auf die Wartezeit der DB und finge
 * sonst auch den IO-Schub ab. Absichtlich NICHT aus SCRIPTS gelesen. */
const PLAN_BOTS: ((typeof PLAN_EMPFEHLUNG)[number] & { event?: string })[] = [
  {
    key: "start",
    action: {},
    expect: "inv",
    bn: "inv",
    overload: { web: "ok", inv: "kollabiert", pay: "ok" },
  },
  {
    key: "shed",
    action: { shedBrowse: true },
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    ask: "wen",
    answer: "beide",
  },
  {
    key: "rateLimit",
    action: { rateLimit: true, shedBrowse: false },
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    ask: "wen",
    answer: "bot",
  },
  {
    key: "admission",
    action: { admission: true },
    event: "ioSchub",
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "kollabiert", pay: "ok" },
    ask: "seiten",
    answer: "warten",
  },
  {
    key: "bpInv",
    action: { bpInv: true },
    event: "ioSchub",
    expect: "bleibt",
    bn: "inv",
    overload: { web: "ok", inv: "abgefangen", pay: "ok" },
    ask: "seiten",
    answer: "teils",
  },
];

/* „Tief“ des Murphy-Nachbarn laut Modulkopf: Eigenrauschen ≤ −0,3 σ. */
const MURPHY_LOW = -0.3;

/* ===== Memoisierte Läufe (ein Live-Lauf je Seed; Sweeps einmal) ===== */

let scriptRuns: any[] | null = null;
function scriptRunsMemo(): any[] {
  scriptRuns ??= SEEDS50.map((seed) => playScript(seed, "rabatt").steps);
  return scriptRuns;
}
let teuerRuns: any[] | null = null;
function teuerRunsMemo(): any[] {
  teuerRuns ??= SEEDS50.map((seed) => playScript(seed, "teuer").steps);
  return teuerRuns;
}
let empfRuns: any[] | null = null;
function empfRunsMemo(): any[] {
  empfRuns ??= SEEDS50.map((seed) => playScript(seed, "empfehlung").steps);
  return empfRuns;
}
let retryRuns: any[] | null = null;
function retryRunsMemo(): any[] {
  retryRuns ??= SEEDS50.map((seed) => playScript(seed, "retry").steps);
  return retryRuns;
}
let spitzenRuns: any[] | null = null;
function spitzenRunsMemo(): any[] {
  spitzenRuns ??= SEEDS50.map((seed) => playScript(seed, "spitzen").steps);
  return spitzenRuns;
}
let botsRuns: any[] | null = null;
function botsRunsMemo(): any[] {
  botsRuns ??= SEEDS50.map((seed) => playScript(seed, "bots").steps);
  return botsRuns;
}

// 10-min-Fenster nach 30 s Vorlauf, wie die Fußzeile „in 10 min“
const W0 = 30;
const W1 = W0 + 600;

/* Beobachtung je Murphy-Schlag, gemessen VON AUSSEN: Zustand vor dem
 * Schritt, in dem der Schlag beginnt, und Rauschen, das Murphy darin sah. */
type StrikeObs = {
  t0: number;
  target: string;
  prevBn: string | null; // Engpass im vorigen Schritt
  prevLast: string | null; // letzte Engpass-Station vor dem Schlag
  z: number; // Eigenrauschen des Ziels
  waited: number; // s seit dem Ende des vorigen Schlags
  fallback: boolean;
};

const sweepCache = new Map<string, any[]>();
function sweep(
  scenario: string,
  cm: Record<string, unknown> = {},
  seeds: number[] = SEEDS20,
): any[] {
  const key = `${scenario} ${JSON.stringify(cm)} ${seeds.join(",")}`;
  let r = sweepCache.get(key);
  if (!r) {
    const observe = cm.nb === "murphy";
    r = seeds.map((seed) => {
      const sim = new BottleneckSim(seed, scenario, { cm });
      const starts: StrikeObs[] = [];
      if (!observe) sim.runTo(W1);
      while (sim.t < W1 - 1e-9) {
        const prevBn = sim.bottleneck;
        const prevLast = sim.lastOver;
        const k = sim.c.strikes;
        sim.runSteps(1);
        if (sim.c.strikes === k) continue;
        const s = sim.strikeLog[sim.strikeLog.length - 1];
        const prev = sim.strikeLog[sim.strikeLog.length - 2];
        starts.push({
          t0: s.t0,
          target: s.target,
          prevBn,
          prevLast,
          z: s.target === "web" ? sim.zW : sim.zI,
          // erster Schlag: das Modell startet mit „letztes Ende = −Abstand“
          waited: s.t0 - (prev ? prev.t1 : -MURPHY_GAP_S),
          fallback: s.fallback,
        });
      }
      return { sum: sim.summarize(W0, W1), sim, starts };
    });
    sweepCache.set(key, r);
  }
  return r;
}
const avg = (runs: any[], f: (s: any) => number) =>
  mean(runs.map((r) => f(r.sum)));

describe("Topologie und Konstanten", () => {
  it("Produktseite = 0,3 E + 1,2 E = 1,5 E ⇒ Bestand schafft 300 Seiten/s", () => {
    expect(INV_AVAIL_E + INV_RECO_E).toBeCloseTo(INV_PAGE_E, 12);
    expect(INV_PAGE_E).toBeCloseTo(1.5, 12);
    expect(INV_PAGES_PER_S).toBe(300);
    expect(INV_CAP_E / INV_PAGE_E).toBeCloseTo(INV_PAGES_PER_S, 9);
  });
  it("Lastknoten = Gesamtnachfrage: Produktseiten + Checkouts = 1.000 req/s", () => {
    expect(CAMPAIGN_PAGES + CAMPAIGN_CHECKOUTS).toBe(LOAD_CAMPAIGN);
    expect(CAMPAIGN_CHECKOUTS).toBeGreaterThan(PAY_CAP); // 91 > 70: Funnel trägt Stufe 4
    const sim = new BottleneckSim(12345, "rabatt");
    sim.runTo(200);
    const s = sim.snapshot();
    expect(s.load.nominal).toBe(LOAD_CAMPAIGN);
    expect(s.load.browse + s.load.checkout).toBeCloseTo(s.load.total, 9);
  });
  it("alle Schalter der Phase 2 wirken (CM_PHASE2 leer); Tippfehler werden abgelehnt", () => {
    const sim = new BottleneckSim(1, "rabatt");
    expect(CM_PHASE2).toEqual([]);
    expect(() => sim.set({ rateLimit: true, admission: true })).not.toThrow();
    expect(() => sim.set({ ratelimit: true })).toThrow(/unbekannter Schalter/);
    expect(() => sim.set({ smoothing: true })).not.toThrow();
    expect(() => sim.set({ cache: true, batch: true })).not.toThrow();
    expect(() => sim.set({ bpinv: true })).toThrow(/unbekannter Schalter/);
    expect(() => new BottleneckSim(1, "gibtsnicht")).toThrow();
  });
  it("Szenarien tragen Tempo, Fenster, Vorlauf und Start-Schalter", () => {
    for (const k of [
      "nachbar",
      "zufall",
      "rabatt",
      "teuer",
      "spitzen",
    ] as const) {
      const sc = SCENARIOS[k];
      expect(sc.tempo).toBeGreaterThan(0);
      expect(sc.windowS).toBe(600);
      expect(sc.prerollS).toBeGreaterThan(0);
      expect(typeof sc.cm).toBe("object");
    }
    // Vorfall im Sekundentakt: Zeitraffer ×1, Fenster 2 min (Plan §1)
    const e = SCENARIOS.empfehlung;
    expect(e.tempo).toBe(1);
    expect(e.windowS).toBe(120);
    expect(e.prerollS).toBe(REC_SLOW_AT_S);
    expect(typeof e.cm).toBe("object");
  });
});

describe("Determinismus", () => {
  it("gleicher Seed ⇒ identische Historie (auch mit Murphy)", () => {
    const a = new BottleneckSim(4711, "nachbar", { cm: { nb: "murphy" } });
    const b = new BottleneckSim(4711, "nachbar", { cm: { nb: "murphy" } });
    a.runTo(300);
    b.runTo(300);
    expect(b.histLen).toBe(a.histLen);
    for (let i = 0; i < a.histLen; i++)
      expect(b.histAt(i)).toEqual(a.histAt(i));
  });
  it("Schalter ändern die Umwelt nicht (OU-Zustände und Nachbar-Zyklus gleich)", () => {
    const a = new BottleneckSim(4711, "nachbar");
    const b = new BottleneckSim(4711, "nachbar");
    b.runTo(10);
    b.set({ headroom: true, nb: "murphy", scale: true, bpInv: true });
    b.runTo(60);
    b.set({
      isolate: true,
      featureShed: true,
      noise: "stark",
      shedBrowse: true,
      cache: true,
      batch: true,
      bulkhead: true,
      timeouts: true,
      breaker: true,
    });
    // lange ohne „zufall“: der Nachbar-Zyklus durchläuft mehrere Phasen,
    // während seine Wirkung abgeschaltet ist
    b.runTo(200);
    b.set({ nb: "aus", isolate: false });
    b.runTo(450);
    b.set({ nb: "zufall", headroomAll: true });
    a.runTo(600);
    b.runTo(600);
    let cycles = 0;
    for (let i = 0; i < a.histLen; i++) {
      expect(b.histAt(i).env).toEqual(a.histAt(i).env);
      if (
        i &&
        a.histAt(i).nbPhase === "idle" &&
        a.histAt(i - 1).nbPhase !== "idle"
      )
        cycles++;
    }
    expect(cycles).toBeGreaterThanOrEqual(2); // Phasenwechsel ohne „zufall“ abgedeckt
    expect(b.nbPhase).toBe(a.nbPhase);
    expect(b.nbEnd).toBe(a.nbEnd);
  });
  it("Replay aus dem Log reproduziert den Lauf bitgenau", () => {
    const sim = new BottleneckSim(99, "rabatt", { scaleTarget: 16 });
    sim.runTo(100);
    sim.set({ scale: true, scaleMode: "vorgewaermt" });
    sim.runTo(150);
    sim.set({ bpInv: true });
    sim.advance(33.37);
    sim.set({ featureShed: true, shedCheckout: true });
    sim.runTo(200);
    sim.set({ cache: true, batch: true, featureShed: false });
    sim.runTo(240);
    const r = replay(sim.seed, sim.scenario, sim.log, sim.n, sim.overrides);
    expect(r.n).toBe(sim.n);
    expect(r.histAt(r.histLen - 1)).toEqual(sim.histAt(sim.histLen - 1));
    expect(r.stats).toEqual(sim.stats);
  });
  it("Replay bitgenau auch mit Bulkheads, Timeouts und Breaker (empfehlung)", () => {
    const sim = new BottleneckSim(4242, "empfehlung");
    sim.runTo(40);
    sim.set({ bulkhead: true });
    sim.advance(7.77);
    sim.set({ timeouts: true, breaker: true });
    sim.runTo(70);
    sim.set({ bulkhead: false, featureShed: true });
    sim.runTo(90);
    const r = replay(sim.seed, sim.scenario, sim.log, sim.n, sim.overrides);
    expect(r.histAt(r.histLen - 1)).toEqual(sim.histAt(sim.histLen - 1));
    expect(r.stats).toEqual(sim.stats);
    expect(r.brRec).toEqual(sim.brRec);
  });
  it("advance() rechnet in DT-Schritten und trägt den Rest weiter", () => {
    const sim = new BottleneckSim(7, "rabatt");
    for (let i = 0; i < 1000; i++) sim.advance(0.37);
    expect(sim.n).toBe(3700);
    expect(sim.t).toBeCloseTo(370, 9);
  });
});

describe("Drehbuch Rabattaktion (ein Live-Lauf je Seed, 50 Seeds)", () => {
  const steps: any[] = SCRIPTS.rabatt;
  it("SCRIPTS.rabatt entspricht der Drehbuch-Tabelle des Plans (wörtlich)", () => {
    expect(steps.map((s) => s.key)).toEqual(PLAN_RABATT.map((p) => p.key));
    steps.forEach((s, i) => {
      const p = PLAN_RABATT[i]!;
      expect(s.action).toEqual(p.action);
      expect(s.expect).toBe(p.expect);
      expect(s.overload).toEqual(p.overload);
      expect(s.settle).toBeGreaterThan(0);
    });
  });
  it.each(PLAN_RABATT.map((p, i) => [i, p.key, p.bn]))(
    "Stufe %i (%s): Engpass „%s“ und Überlastvektor laut Plan bei appliedAt + settle in 50/50 Seeds",
    SLOW,
    (i) => {
      const plan = PLAN_RABATT[i as number]!;
      const misses: string[] = [];
      for (const run of scriptRunsMemo()) {
        const st = run[i as number];
        const vecOk = STATIONS.every(
          (s) => st.overload[s] === plan.overload[s],
        );
        if (st.bottleneck !== plan.bn || !vecOk) {
          misses.push(`${st.bottleneck} ${JSON.stringify(st.overload)}`);
        }
      }
      expect(misses).toEqual([]);
    },
  );
  it("„bleibt“ löst sich zur Station des vorigen Schritts auf", () => {
    const run = scriptRunsMemo()[0];
    expect(run.map((s: any) => s.expect)).toEqual(PLAN_RABATT.map((p) => p.bn));
  });
  it("zitierfähige Kennzahlen (SCRIPT_FIGURES) stimmen im Mittel über 50 Seeds", () => {
    const runs = scriptRunsMemo();
    const figs: any[] = SCRIPT_FIGURES.rabatt;
    expect(figs.map((f) => f.key)).toEqual(PLAN_RABATT.map((p) => p.key));
    figs.forEach((fig, i) => {
      const m = (f: (x: any) => number) => mean(runs.map((r) => f(r[i].sum)));
      // Toleranz: ±6 % des Werts, mindestens ±2 req/s
      const near = (v: number, ref: number) =>
        expect(Math.abs(v - ref)).toBeLessThanOrEqual(Math.max(2, 0.06 * ref));
      near(
        m((s) => s.okBrowse),
        fig.pages,
      );
      near(
        m((s) => s.okCheckout),
        fig.orders,
      );
      near(
        m((s) => s.rejected),
        fig.rejected,
      );
      near(
        m((s) => s.lost),
        fig.lost,
      );
      near(
        m((s) => s.waste),
        fig.waste,
      );
    });
  });
  it("ungeschützt geht fast alles verloren — durch Aufgeben, nicht nur durch Verspätung", () => {
    for (const run of scriptRunsMemo()) {
      for (const i of [0, 1]) {
        const s = run[i].sum;
        expect(s.lost).toBeGreaterThan(0.9 * s.load); // ≈ die ganze Last
        expect(s.abandoned).toBeGreaterThan(500); // Clients geben auf (504)
        expect(s.lost).toBeCloseTo(s.abandoned + s.waste, 6);
      }
    }
  });
  it("Kennzahlen je Seed: Bestellungen/s in festen Bändern", () => {
    for (const run of scriptRunsMemo()) {
      expect(run[0].sum.okCheckout).toBeLessThan(0.5);
      expect(run[1].sum.okCheckout).toBeLessThan(0.5);
      expect(run[2].sum.okCheckout).toBeGreaterThan(8);
      expect(run[2].sum.okCheckout).toBeLessThan(13);
      expect(run[3].sum.okCheckout).toBeGreaterThan(24);
      expect(run[3].sum.okCheckout).toBeLessThan(31);
      expect(run[4].sum.okCheckout).toBeLessThan(1);
      expect(run[5].sum.okCheckout).toBeGreaterThan(62);
      expect(run[5].sum.okCheckout).toBeLessThan(76);
    }
  });
  it("Shedding nach Priorität verdreifacht die Bestellungen gegenüber Tail-Drop", () => {
    const runs = scriptRunsMemo();
    const o2 = mean(runs.map((r) => r[2].sum.okCheckout));
    const o3 = mean(runs.map((r) => r[3].sum.okCheckout));
    expect(o3 / o2).toBeGreaterThan(2.3);
    // Stufe 2 weist per Tail-Drop ab (503), Stufe 3 früh per Shedding
    expect(mean(runs.map((r) => r[2].sum.r503))).toBeGreaterThan(600);
    expect(mean(runs.map((r) => r[3].sum.shed))).toBeGreaterThan(600);
    expect(mean(runs.map((r) => r[3].sum.r503))).toBeLessThan(1);
  });
});

describe("Drehbuch Teure Abfragen (ein Live-Lauf je Seed, 50 Seeds)", () => {
  const steps: any[] = SCRIPTS.teuer;
  it("SCRIPTS.teuer entspricht der Drehbuch-Tabelle (wörtlich, Batching vor Cache)", () => {
    expect(steps.map((s) => s.key)).toEqual(PLAN_TEUER.map((p) => p.key));
    steps.forEach((s, i) => {
      const p = PLAN_TEUER[i]!;
      expect(s.action).toEqual(p.action);
      expect(s.expect).toBe(p.expect);
      expect(s.overload).toEqual(p.overload);
      expect(s.settle).toBeGreaterThan(0);
    });
    // Start: DB-gebunden, Back Pressure an DB und Kasse läuft schon,
    // Webserver mit Reserve, Scaling auf ein eigenes Ziel
    const sc = SCENARIOS.teuer;
    expect(sc.variant).toBe("remedies");
    expect(sc.cm).toMatchObject({ bpInv: true, bpPay: true });
    expect(sc.nWeb).toBe(N_WEB_TEUER);
    expect(sc.scaleTarget).toBe(SCALE_TARGET_TEUER);
    expect(sc.load[sc.load.length - 1]![1]).toBe(TEUER_LOAD);
    expect(N_WEB_TEUER * WEB_PER_INSTANCE).toBeGreaterThan(1.25 * TEUER_LOAD);
  });
  it.each(PLAN_TEUER.map((p, i) => [i, p.key, p.bn]))(
    "Stufe %i (%s): Engpass „%s“ und Überlastvektor bei appliedAt + settle in 50/50 Seeds",
    SLOW,
    (i) => {
      const plan = PLAN_TEUER[i as number]!;
      const misses: string[] = [];
      for (const run of teuerRunsMemo()) {
        const st = run[i as number];
        const vecOk = STATIONS.every(
          (s) => st.overload[s] === plan.overload[s],
        );
        if (st.bottleneck !== plan.bn || !vecOk)
          misses.push(`${st.bottleneck} ${JSON.stringify(st.overload)}`);
      }
      expect(misses).toEqual([]);
    },
  );
  it("„bleibt“ löst sich zur Station des vorigen Schritts auf", () => {
    const run = teuerRunsMemo()[0];
    expect(run.map((s: any) => s.expect)).toEqual(PLAN_TEUER.map((p) => p.bn));
  });
  it("Marge bei der Auflösung: Engpass deutlich unter, Rest deutlich über der Grenze", () => {
    // Die UI startet mit Zufalls-Seed: Reserve-Abstand statt Glück
    for (const run of teuerRunsMemo()) {
      for (const i of [0, 1, 2]) {
        expect(run[i].snap.stations.inv.reserve).toBeLessThan(-0.5);
        expect(run[i].snap.stations.web.reserve).toBeGreaterThan(0.15);
      }
      const s3 = run[3].snap.stations;
      expect(s3.inv.reserve).toBeGreaterThan(0.1);
      expect(s3.pay.reserve).toBeLessThan(-0.05);
    }
  });
  it("zitierfähige Kennzahlen (SCRIPT_FIGURES.teuer) stimmen im Mittel über 50 Seeds", () => {
    const runs = teuerRunsMemo();
    const figs: any[] = SCRIPT_FIGURES.teuer;
    expect(figs.map((f) => f.key)).toEqual(PLAN_TEUER.map((p) => p.key));
    figs.forEach((fig, i) => {
      const m = (f: (x: any) => number) => mean(runs.map((r) => f(r[i].sum)));
      const near = (v: number, ref: number) =>
        expect(Math.abs(v - ref)).toBeLessThanOrEqual(Math.max(2, 0.06 * ref));
      near(
        m((s) => s.okBrowse),
        fig.pages,
      );
      near(
        m((s) => s.okCheckout),
        fig.orders,
      );
      near(
        m((s) => s.rejected),
        fig.rejected,
      );
      near(
        m((s) => s.lost),
        fig.lost,
      );
      near(
        m((s) => s.waste),
        fig.waste,
      );
    });
  });
});

describe("Arbeit reduzieren: Scaling, Batching, Cache + Coalescing (teuer)", () => {
  const close = (a: number, b: number, d = 9) => expect(a).toBeCloseTo(b, d);
  it("Scaling 12 → 20: Webserver-Kapazität +67 %, Seiten/s unverändert — die DB skaliert nicht", () => {
    const runs = teuerRunsMemo();
    for (const run of runs) {
      const w0 = run[0].snap.stations.web;
      const w1 = run[1].snap.stations.web;
      expect(w0.instances.running).toBe(N_WEB_TEUER);
      expect(w1.instances.running).toBe(SCALE_TARGET_TEUER);
      expect(w1.capNominal / w0.capNominal).toBeCloseTo(
        SCALE_TARGET_TEUER / N_WEB_TEUER,
        9,
      );
      expect(run[1].sum.util.inv).toBeGreaterThan(0.98);
    }
    const p0 = mean(runs.map((r) => r[0].sum.okBrowse));
    const p1 = mean(runs.map((r) => r[1].sum.okBrowse));
    expect(Math.abs(p1 / p0 - 1)).toBeLessThan(0.03);
  });
  it("Batching: Overhead / k, k = Rate × Fenster; nur Produktseiten; +½ Fenster Latenz", () => {
    for (const run of teuerRunsMemo()) {
      const s1 = run[1].snap;
      const s2 = run[2].snap;
      const inv = s2.stations.inv;
      // k aus der Nachfrage-Rate der Produktseiten an der DB
      close(inv.batchK, Math.max(1, s2.load.browse * BATCH_WINDOW_S), 6);
      expect(inv.batchK).toBeGreaterThan(30);
      close(
        inv.costPage,
        INV_OVERHEAD_E / inv.batchK + INV_PER_ITEM_E + INV_RECO_E,
      );
      expect(s1.stations.inv.costPage).toBe(INV_PAGE_E);
      // die Reservierung bleibt einzeln und live
      expect(inv.costCheckout).toBe(INV_RESERVE_E);
      // gleiche Wartezeiten (DB voll, Eingangs-Queue voll): genau +½ Fenster
      expect(s2.latency.browse - s1.latency.browse).toBeCloseTo(BATCH_LAT_S, 3);
      // Checkouts: nicht gebündelt (± Schwankung der Eingangs-Queue)
      expect(s2.latency.checkout).toBeCloseTo(s1.latency.checkout, 2);
    }
  });
  it("Batching spart nur den Overhead: DB bleibt voll, Seiten/s +10–20 %, nicht mehr", () => {
    const runs = teuerRunsMemo();
    const p1 = mean(runs.map((r) => r[1].sum.okBrowse));
    const p2 = mean(runs.map((r) => r[2].sum.okBrowse));
    // ≈ Kostenverhältnis 1,5 / 1,305
    expect(p2 / p1).toBeGreaterThan(1.1);
    expect(p2 / p1).toBeLessThan(1.2);
    for (const r of runs) expect(r[2].sum.util.inv).toBeGreaterThan(0.98);
  });
  it("Cache + Coalescing: Empfehlungen bleiben an, DB-Arbeit je Seite sinkt, Reservierung nie aus dem Cache", () => {
    for (const run of teuerRunsMemo()) {
      const s = run[3].snap;
      const inv = s.stations.inv;
      expect(s.rec.on).toBe(true);
      expect(s.rec.cached).toBe(true);
      expect(inv.cacheHit).toBe(CACHE_HIT);
      close(inv.recoE, INV_RECO_CACHED_E);
      close(
        inv.costPage,
        INV_OVERHEAD_E / inv.batchK + INV_PER_ITEM_E + INV_RECO_CACHED_E,
      );
      expect(inv.costCheckout).toBe(INV_RESERVE_E);
      // nur die Fehltreffer rufen die Empfehlungen auf (Webserver begrenzen nicht)
      close(s.rec.demand, s.load.browse * (1 - CACHE_HIT), 6);
      expect(run[3].sum.util.inv).toBeLessThan(0.9);
    }
    close(INV_PAGE_CACHED_E, INV_AVAIL_E + INV_RECO_E * (1 - CACHE_HIT));
  });
  it("Cache: Seiten/s ≥ 2,5×, die Kasse läuft am Limit, abgewiesen werden nur Checkouts", () => {
    const runs = teuerRunsMemo();
    const p0 = mean(runs.map((r) => r[0].sum.okBrowse));
    const p3 = mean(runs.map((r) => r[3].sum.okBrowse));
    expect(p3 / p0).toBeGreaterThan(2.5);
    for (const r of runs) {
      const s = r[3].sum;
      expect(s.okCheckout).toBeGreaterThan(0.85 * PAY_CAP);
      expect(s.rejectedC).toBeGreaterThan(3); // Back Pressure an der Kasse
      expect(s.rejectedB).toBeLessThan(0.5); // Produktseiten frei
      expect(r[3].snap.stations.pay.throttling).toBe(true);
    }
  });
  it("Cache statt Feature Shedding: gleiche Entlastung der DB, aber die Funktion bleibt", () => {
    const seed = SEEDS50[5]!;
    const head = SCRIPTS.teuer.slice(0, 3);
    const alt = (action: Record<string, unknown>) =>
      playScript(seed, "teuer", {
        steps: [...head, { ...SCRIPTS.teuer[3], key: "alt", action }],
      }).steps[3]!;
    const c = alt({ cache: true });
    const f = alt({ featureShed: true });
    for (const r of [c, f]) {
      expect(r.bottleneck).toBe("pay");
      expect(r.snap.stations.inv.reserve).toBeGreaterThan(0.1);
    }
    expect(c.snap.rec.on).toBe(true);
    expect(f.snap.rec.on).toBe(false);
    // Treffer sparen den Aufruf der Empfehlungen (Latenz), Feature Shedding
    // spart ihn ganz
    expect(c.snap.latency.browse - f.snap.latency.browse).toBeCloseTo(
      REC_LAT_S * (1 - CACHE_HIT),
      3,
    );
    // mit abgeschalteten Empfehlungen hat der Cache nichts mehr zu sparen
    const both = alt({ featureShed: true, cache: true });
    close(both.snap.stations.inv.costPage, f.snap.stations.inv.costPage);
  });
  it("Batching ohne Last: k = 1 spart nichts, kostet aber ½ Fenster (Kafka linger.ms)", () => {
    const mk = (cm: Record<string, unknown>, load: number) => {
      const sim = new BottleneckSim(SEEDS50[7]!, "teuer", {
        cm,
        load: [[0, load]],
      });
      sim.runTo(30);
      return sim.snapshot();
    };
    const a = mk({}, 10);
    const b = mk({ batch: true }, 10);
    expect(b.stations.inv.batchK).toBe(1);
    close(b.stations.inv.costPage, a.stations.inv.costPage);
    close(b.latency.browse - a.latency.browse, BATCH_LAT_S, 6);
    // bei 100 req/s füllt sich das Bündel nur mit ≈ 4–5 Abfragen
    const c = mk({ batch: true }, 100);
    expect(c.stations.inv.batchK).toBeGreaterThan(3);
    expect(c.stations.inv.batchK).toBeLessThan(6);
    expect(INV_PAGE_E - c.stations.inv.costPage).toBeLessThan(
      0.85 * INV_OVERHEAD_E,
    );
  });
  it("Kosten und Latenz ohne Cache/Batching bitgleich wie vorher (Phase 1 unverändert)", () => {
    const sim = new BottleneckSim(SEEDS50[1]!, "rabatt");
    sim.runTo(120);
    const s = sim.snapshot();
    expect(s.stations.inv.costPage).toBe(INV_PAGE_E);
    expect(s.stations.inv.recoE).toBe(INV_RECO_E);
    expect(s.stations.inv.batchK).toBe(1);
    expect(s.stations.inv.cacheHit).toBe(0);
    sim.set({ featureShed: true });
    sim.runTo(121);
    expect(sim.snapshot().stations.inv.costPage).toBe(INV_AVAIL_E);
  });
});

describe("Drehbuch Empfehlungen hängen (ein Live-Lauf je Seed, 50 Seeds)", () => {
  const steps: any[] = SCRIPTS.empfehlung;
  it("SCRIPTS.empfehlung entspricht der Drehbuch-Tabelle (wörtlich, mit eigenen Fragen)", () => {
    expect(steps.map((s) => s.key)).toEqual(PLAN_EMPFEHLUNG.map((p) => p.key));
    steps.forEach((s, i) => {
      const p = PLAN_EMPFEHLUNG[i]!;
      expect(s.action).toEqual(p.action);
      expect(s.expect).toBe(p.expect);
      expect(s.overload).toEqual(p.overload);
      expect(s.ask).toBe(p.ask);
      expect(s.answer).toBe(p.answer);
      if (s.ask)
        expect((ASK_KINDS as Record<string, string[]>)[s.ask]).toContain(
          s.answer,
        );
      // die Antwort braucht ein volles Fenster nach dem Zug
      expect(s.settle).toBeGreaterThanOrEqual(TIP_WINDOW_S + 5);
    });
    // fester Checkout-Strom statt Funnel, eigener Thread-Pool, Hänger-Profil
    const sc = SCENARIOS.empfehlung;
    expect(sc.variant).toBe("remedies");
    expect(sc.conv).toBe(0);
    expect(sc.cFix).toBe(EMPF_CHECKOUTS);
    expect(sc.load).toEqual([[0, EMPF_LOAD]]);
    expect(sc.nWeb).toBe(N_WEB_EMPF);
    expect(sc.threadsPerInstance).toBe(THREADS_EMPF);
    expect(sc.recLat).toEqual([[REC_SLOW_AT_S, REC_SLOW_S]]);
    // Little: ohne Hänger reichen die Threads locker, mit Hänger nicht
    expect(EMPF_PAGES * REC_SLOW_S).toBeGreaterThan(1.3 * THREADS_EMPF_TOTAL);
    expect(EMPF_PAGES * REC_TIMEOUT_S).toBeLessThan(
      0.3 * (1 - BULKHEAD_CHECKOUT) * THREADS_EMPF_TOTAL,
    );
  });
  it.each(PLAN_EMPFEHLUNG.map((p, i) => [i, p.key, p.bn ?? "kein Engpass"]))(
    "Stufe %i (%s): „%s“, Überlastvektor und Antwort der eigenen Frage bei appliedAt + settle in 50/50 Seeds",
    SLOW,
    (i) => {
      const plan = PLAN_EMPFEHLUNG[i as number]!;
      const misses: string[] = [];
      for (const run of empfRunsMemo()) {
        const st = run[i as number];
        const vecOk = STATIONS.every(
          (s) => st.overload[s] === plan.overload[s],
        );
        const tipOk = plan.ask ? st.tip === plan.answer : st.tip === null;
        if (st.bottleneck !== plan.bn || !vecOk || !tipOk)
          misses.push(
            `${st.bottleneck} ${JSON.stringify(st.overload)} tip=${st.tip}`,
          );
      }
      expect(misses).toEqual([]);
    },
  );
  it("„bleibt“ löst sich zur Station des vorigen Schritts auf, null bleibt „kein Engpass“", () => {
    const run = empfRunsMemo()[0];
    expect(run.map((s: any) => s.expect)).toEqual(
      PLAN_EMPFEHLUNG.map((p) => p.bn),
    );
  });
  it("Marge bei der Auflösung: Webserver deutlich unter, Rest deutlich über der Grenze", () => {
    for (const run of empfRunsMemo()) {
      for (const i of [0, 1]) {
        const st = run[i].snap.stations;
        expect(st.web.reserve).toBeLessThan(-0.2);
        expect(st.web.wait).toBeGreaterThan(3 * COLLAPSE_WAIT_S);
        expect(st.inv.reserve).toBeGreaterThan(0.5);
        expect(st.pay.reserve).toBeGreaterThan(1);
      }
      for (const i of [2, 3]) {
        const st = run[i].snap.stations;
        for (const k of STATIONS) expect(st[k].reserve).toBeGreaterThan(0.2);
      }
    }
  });
  it("zitierfähige Kennzahlen (SCRIPT_FIGURES.empfehlung) stimmen im Mittel über 50 Seeds", () => {
    const runs = empfRunsMemo();
    const figs: any[] = SCRIPT_FIGURES.empfehlung;
    expect(figs.map((f) => f.key)).toEqual(PLAN_EMPFEHLUNG.map((p) => p.key));
    expect(SCENARIOS.empfehlung.figWindowS).toBe(TIP_WINDOW_S);
    figs.forEach((fig, i) => {
      const m = (f: (x: any) => number) => mean(runs.map((r) => f(r[i].sum)));
      const near = (v: number, ref: number) =>
        expect(Math.abs(v - ref)).toBeLessThanOrEqual(Math.max(2, 0.06 * ref));
      // das Fenster der Kennzahlen ist das der Antwort (10 s)
      expect(runs[0][i].sum.dur).toBe(TIP_WINDOW_S);
      near(
        m((s) => s.okBrowse),
        fig.pages,
      );
      near(
        m((s) => s.okCheckout),
        fig.orders,
      );
      near(
        m((s) => s.rejected),
        fig.rejected,
      );
      near(
        m((s) => s.lost),
        fig.lost,
      );
      near(
        m((s) => s.waste),
        fig.waste,
      );
      near(
        m((s) => s.degraded),
        fig.degraded,
      );
    });
  });
});

describe("Überlast isolieren, Verstärkung verhindern (empfehlung)", () => {
  it("Hänger: Little — die Seiten belegen den Pool, die Webserver tragen nur, was die Threads hergeben", () => {
    for (const run of empfRunsMemo()) {
      const s = run[0].snap;
      const th = s.stations.web.threads;
      expect(th.max).toBe(THREADS_EMPF_TOTAL);
      expect(th.busy).toBeGreaterThan(0.95 * th.max);
      expect(th.waitRec).toBeGreaterThan(0.9 * th.max);
      expect(s.stations.web.blocked).toBe(true);
      expect(s.stations.web.blockedPool).toBe("alle");
      // Kapazität = was der Pool trägt: Threads / (Anteil Seiten × Zusatz-
      // Haltezeit), weit unter der CPU
      const hold = REC_SLOW_S - REC_LAT_S;
      const share = s.load.browse / s.load.total;
      expect(s.stations.web.cap).toBeCloseTo(th.max / (share * hold), 6);
      expect(s.stations.web.capCpu).toBeGreaterThan(2 * s.stations.web.cap);
      expect(s.rec.latS).toBeCloseTo(REC_SLOW_S, 9);
    }
  });
  it("Hänger: Checkouts blockieren, obwohl DB und Kasse gesund sind", () => {
    for (const run of empfRunsMemo()) {
      const s = run[0].sum;
      expect(s.okCheckout).toBeLessThan(0.05 * EMPF_CHECKOUTS);
      expect(s.okBrowse).toBeLessThan(1);
      expect(s.util.inv).toBeLessThan(0.75);
      expect(s.util.pay).toBeLessThan(0.3);
      expect(run[0].snap.overloaded).toEqual({
        web: "kollabiert",
        inv: "ok",
        pay: "ok",
      });
    }
  });
  it("Bulkheads: Pools 25 / 75 %, Checkouts wie vor dem Hänger, Seiten hängen weiter (verloren)", () => {
    for (const run of empfRunsMemo()) {
      const s = run[1].snap;
      const pools = s.stations.web.threads.pools;
      expect(pools.checkout.max).toBeCloseTo(
        BULKHEAD_CHECKOUT * THREADS_EMPF_TOTAL,
        9,
      );
      expect(pools.browse.max + pools.checkout.max).toBe(THREADS_EMPF_TOTAL);
      expect(pools.browse.busy).toBeGreaterThan(0.95 * pools.browse.max);
      expect(pools.checkout.busy).toBeLessThan(0.2 * pools.checkout.max);
      expect(s.stations.web.blockedPool).toBe("seiten");
      const sum = run[1].sum;
      expect(sum.okCheckout).toBeGreaterThan(0.95 * EMPF_CHECKOUTS);
      expect(sum.okBrowse).toBeLessThan(1);
      expect(sum.lostB).toBeGreaterThan(0.9 * EMPF_PAGES);
      // im kleineren Pool tragen die Threads noch weniger Seiten
      expect(s.stations.web.cap).toBeLessThan(run[0].snap.stations.web.cap);
    }
  });
  it("Timeouts: Seiten schnell und degradiert — Little: Threads = Seiten/s × (Timeout − Basis); der Dienst bekommt weiter jeden Aufruf", () => {
    for (const run of empfRunsMemo()) {
      const s = run[2].snap;
      const sum = run[2].sum;
      expect(s.rec.timedOut).toBe(true);
      expect(s.rec.waitS).toBe(REC_TIMEOUT_S);
      expect(sum.degraded).toBeGreaterThan(0.95 * sum.okBrowse);
      expect(sum.okBrowse).toBeGreaterThan(0.9 * EMPF_PAGES);
      expect(s.latency.browse).toBeLessThan(REC_TIMEOUT_S + 0.2);
      expect(s.stations.web.threads.waitRec).toBeCloseTo(
        s.load.browse * (REC_TIMEOUT_S - REC_LAT_S),
        0,
      );
      // jeder Aufruf geht raus (keine Cache-Treffer, Breaker aus)
      expect(s.rec.demand).toBeCloseTo(s.load.browse, 6);
      // die DB-Arbeit der Empfehlungen bleibt
      expect(s.stations.inv.costPage).toBe(INV_PAGE_E);
    }
  });
  it("Breaker: öffnet binnen ≈ 1 s, Seiten sofort ohne Aufruf, DB spart die Empfehlungen (automatisches Feature Shedding)", () => {
    for (const run of empfRunsMemo()) {
      const s = run[3].snap;
      const sum = run[3].sum;
      expect(sum.recWait).toBeLessThan(0.01);
      expect(s.stations.web.threads.waitRec).toBeLessThan(
        0.02 * THREADS_EMPF_TOTAL,
      );
      expect(sum.degraded).toBeGreaterThan(0.95 * sum.okBrowse);
      expect(sum.okBrowse).toBeGreaterThan(0.9 * EMPF_PAGES);
      expect(run[3].sum.util.inv).toBeLessThan(0.5 * run[2].sum.util.inv);
      // die Empfehlungen sind nicht abgeschaltet, nur übersprungen
      expect(s.rec.on).toBe(true);
      expect(s.cm.featureShed).toBe(false);
      // der Dienst hängt weiter: der Breaker öffnet immer wieder
      expect(run[3].full.tripsRec).toBeGreaterThanOrEqual(2);
    }
    // Öffnen: Fehler-EMA über die Schwelle ≈ τ · ln 2 nach dem Einschalten
    const sim = new BottleneckSim(SEEDS50[0]!, "empfehlung", {
      cm: { timeouts: true },
    });
    sim.runTo(60);
    sim.set({ breaker: true });
    const t0 = sim.t;
    while (sim.brRec.state === "closed" && sim.t < t0 + 5) sim.runSteps(1);
    expect(sim.t - t0).toBeGreaterThan(0.5 * BREAKER_TAU_S);
    expect(sim.t - t0).toBeLessThan(1.2 * BREAKER_TAU_S);
    const s = sim.snapshot();
    expect(s.rec.breaker).toBe("open");
    expect(s.rec.demand).toBe(0);
    expect(s.stations.inv.recoE).toBe(0);
    expect(s.stations.inv.costPage).toBeCloseTo(INV_AVAIL_E, 12);
  });
  it("Breaker-Zyklus: offen BREAKER_OPEN_S, Probe (HALF_ADMIT) scheitert → wieder offen; erholt sich der Dienst, schließt er nach BREAKER_CLOSE_S", () => {
    const sim = new BottleneckSim(SEEDS50[2]!, "empfehlung", {
      recLat: [
        [REC_SLOW_AT_S, REC_SLOW_S],
        [70, REC_LAT_S],
      ],
      cm: { timeouts: true, breaker: true },
    });
    const log: [number, string][] = [];
    let half = 0;
    while (sim.t < 100) {
      sim.runSteps(1);
      const st = sim.brRec.state;
      if (st === "half") {
        half++;
        expect(sim.recAdmit).toBe(HALF_ADMIT);
      }
      if (!log.length || log[log.length - 1]![1] !== st) log.push([sim.t, st]);
    }
    expect(half).toBeGreaterThan(0);
    // während des Hängers: offen genau BREAKER_OPEN_S, dann eine Probe
    const opens = log.filter(([t, st]) => st === "open" && t < 70);
    expect(opens.length).toBeGreaterThan(5);
    for (let i = 1; i < log.length; i++) {
      const [t, st] = log[i]!;
      const [tPrev, stPrev] = log[i - 1]!;
      if (stPrev === "open" && st === "half")
        expect(t - tPrev).toBeCloseTo(BREAKER_OPEN_S, 6);
      if (stPrev === "half" && st === "open")
        expect(t - tPrev).toBeCloseTo(REC_TIMEOUT_S, 6); // Probe = Timeout
    }
    // danach geschlossen, Empfehlungen wieder da
    const [tEnd, stEnd] = log[log.length - 1]!;
    const [tHalf, stHalf] = log[log.length - 2]!;
    expect(stEnd).toBe("closed");
    expect(stHalf).toBe("half");
    expect(tEnd - tHalf).toBeCloseTo(BREAKER_CLOSE_S, 6);
    expect(tEnd).toBeGreaterThan(70);
    expect(sim.summarize(90, 100).degraded).toBeLessThan(1);
  });
  it("Breaker ohne Timeouts sieht den Hänger nicht: langsam ist kein Fehler", () => {
    const seed = SEEDS50[4]!;
    const head = SCRIPTS.empfehlung.slice(0, 1);
    const r = playScript(seed, "empfehlung", {
      steps: [
        ...head,
        {
          ...SCRIPTS.empfehlung[3],
          key: "alt",
          ask: undefined,
          expect: "bleibt",
          action: { breaker: true },
        },
      ],
    }).steps[1]!;
    expect(r.snap.rec.breaker).toBe("closed");
    expect(r.full.tripsRec).toBe(0);
    expect(r.bottleneck).toBe("web");
  });
  it("Kontrolle der eigenen Fragen: jeder Ausgang ist erreichbar, die Antworten hängen am Zustand", () => {
    const seed = SEEDS50[6]!;
    const pre = new BottleneckSim(seed, "empfehlung");
    pre.runTo(REC_SLOW_AT_S - 2); // vor dem Hänger
    expect(observeTip(pre, "checkout")).toBe("laufen");
    expect(observeTip(pre, "browse")).toBe("normal");
    expect(observeTip(pre, "recWait")).toBe("kurz");
    const { sim } = playScript(seed, "empfehlung", {
      steps: SCRIPTS.empfehlung.slice(0, 1),
    });
    expect(observeTip(sim, "checkout")).toBe("haengen");
    expect(observeTip(sim, "browse")).toBe("haengen");
    expect(observeTip(sim, "recWait")).toBe("lang");
    const run = empfRunsMemo()[6];
    expect(run[1].tip).toBe("laufen");
    const t2 = playScript(seed, "empfehlung", {
      steps: SCRIPTS.empfehlung.slice(0, 3),
    }).sim;
    expect(observeTip(t2, "recWait")).toBe("timeout");
    // Feature Shedding statt Timeouts: auch ohne Empfehlungen (kein Rückfall,
    // aber was der Kunde sieht)
    const fs = playScript(seed, "empfehlung", {
      steps: [
        ...SCRIPTS.empfehlung.slice(0, 2),
        { ...SCRIPTS.empfehlung[2], key: "alt", action: { featureShed: true } },
      ],
    });
    expect(fs.steps[2]!.tip).toBe("degradiert");
    expect(fs.steps[2]!.sum.degraded).toBe(0); // zählt nicht als Rückfall
    // Abgewiesen: Back Pressure an der DB in der Rabattaktion (Stufe 2)
    const rb = playScript(SEEDS50[0]!, "rabatt", {
      steps: SCRIPTS.rabatt.slice(0, 3),
    }).sim;
    expect(observeTip(rb, "checkout")).toBe("abgewiesen");
    expect(observeTip(rb, "browse")).toBe("fehler");
    // Kasse überlastet: Rabattaktion Stufe 4
    const rk = playScript(SEEDS50[0]!, "rabatt", {
      steps: SCRIPTS.rabatt.slice(0, 5),
    }).sim;
    expect(observeTip(rk, "checkout")).toBe("kasse");
    expect(() => observeTip(rk, "gibtsnicht")).toThrow();
    // alle Ausgänge oben einmal getroffen
    expect(ASK_KINDS.checkout).toEqual([
      "laufen",
      "haengen",
      "abgewiesen",
      "kasse",
    ]);
  });
  it("DB-Timeouts: Rabattaktion nach dem Scaling — DB-Queue ≤ DB_TIMEOUT_S, Überlauf 504 (verloren), „abgefangen“", () => {
    const sim = new BottleneckSim(SEEDS50[3]!, "rabatt");
    sim.runTo(90);
    sim.set({ scale: true, scaleMode: "vorgewaermt" });
    sim.runTo(200);
    expect(sim.snapshot().overloaded.inv).toBe("kollabiert");
    sim.set({ timeouts: true });
    sim.runTo(260);
    const s = sim.snapshot();
    expect(s.overloaded.inv).toBe("abgefangen");
    expect(s.stations.inv.wait).toBeLessThanOrEqual(DB_TIMEOUT_S + 1e-9);
    const sum = sim.summarize(240, 260);
    expect(sum.r504B).toBeGreaterThan(500);
    expect(sum.lostB).toBeGreaterThanOrEqual(sum.r504B);
    expect(sum.lost).toBeCloseTo(
      sum.abandoned + sum.waste + sum.r504B + sum.r504C,
      6,
    );
    expect(sum.okBrowse).toBeGreaterThan(0.9 * INV_PAGES_PER_S);
    expect(sum.util.inv).toBeGreaterThan(0.98); // schafft keine Kapazität
  });
  it("Zahlungs-Timeout und -Breaker: Queue ≤ PAY_TIMEOUT_S; viele Abbrüche öffnen den Breaker → Checkouts sofort 503", () => {
    // 300 Checkouts/s fest gegen 70/s: ≈ 70 % brechen ab
    const sim = new BottleneckSim(SEEDS50[1]!, "rabatt", {
      cFix: 300,
      conv: 0,
    });
    sim.runTo(90);
    sim.set({ scale: true, scaleMode: "vorgewaermt", featureShed: true });
    sim.runTo(200);
    expect(sim.payFail).toBeGreaterThan(0.6);
    sim.set({ timeouts: true });
    sim.runTo(230);
    expect(sim.pq).toBeLessThanOrEqual(PAY_TIMEOUT_S * sim.payCap + 1e-9);
    sim.set({ breaker: true });
    sim.runTo(260);
    const sum = sim.summarize(240, 260);
    expect(sum.tripsPay).toBeGreaterThan(0);
    expect(sum.r503C).toBeGreaterThan(50);
    expect(sum.rejectedB).toBeLessThan(0.01); // nur Checkouts
  });
  it("ohne Profil, Timeouts und Breaker bitgleich wie vorher: Kapazität = CPU, keine Thread-Haltezeit", () => {
    const sim = new BottleneckSim(SEEDS50[1]!, "rabatt");
    let n = 0;
    while (sim.t < 300) {
      sim.runSteps(10);
      expect(sim.recN).toBe(0);
      expect(sim.thrCapB).toBe(Infinity);
      expect(sim.webCapEff).toBe(sim.webCap);
      expect(sim.recLat).toBe(REC_LAT_S);
      n++;
    }
    expect(n).toBe(300);
    expect(sim.stats.degB).toBe(0);
    expect(sim.stats.tripsRec + sim.stats.tripsPay).toBe(0);
    // alle neuen Schalter stehen in CM_DEFAULTS und sind aus
    for (const k of ["bulkhead", "timeouts", "breaker"])
      expect((CM_DEFAULTS as Record<string, unknown>)[k]).toBe(false);
  });
});

describe("Drehbuch Retry-Sturm (ein Live-Lauf je Seed, 50 Seeds)", () => {
  const steps: any[] = SCRIPTS.retry;
  it("SCRIPTS.retry entspricht der Drehbuch-Tabelle (wörtlich, jeder Schritt mit Störung)", () => {
    expect(steps.map((s) => s.key)).toEqual(PLAN_RETRY.map((p) => p.key));
    steps.forEach((s, i) => {
      const p = PLAN_RETRY[i]!;
      expect(s.action).toEqual(p.action);
      expect(s.event).toBe(p.event);
      expect(s.expect).toBe(p.expect);
      expect(s.overload).toEqual(p.overload);
      expect(s.ask).toBe(p.ask);
      expect(s.answer).toBe(p.answer);
      if (s.ask)
        expect((ASK_KINDS as Record<string, string[]>)[s.ask]).toContain(
          s.answer,
        );
    });
    // Auflösung nach dem Neustart (Wellen ab RETRY_WAVE_SKIP_S, ≥ 10 s
    // Fenster), beim Breaker mitten im Brownout
    for (const s of steps.slice(0, 4))
      expect(s.settle).toBeGreaterThanOrEqual(
        PAY_BROWNOUT_S + RETRY_WAVE_SKIP_S + TIP_WINDOW_S,
      );
    expect(steps[4].settle).toBeLessThan(PAY_BROWNOUT_S);
    // fester Checkout-Strom, Zahlung mit Versuchen, naiv mit Timeouts
    const sc = SCENARIOS.retry;
    expect(sc.variant).toBe("remedies");
    expect(sc.tempo).toBe(1);
    expect(sc.windowS).toBe(120);
    expect(sc.prerollS).toBe(RETRY_START_S);
    expect(sc.conv).toBe(0);
    expect(sc.cFix).toBe(RETRY_CHECKOUTS);
    expect(sc.load).toEqual([[0, RETRY_LOAD]]);
    expect(sc.nWeb).toBe(N_WEB_RETRY);
    expect(sc.retryLayer).toBe(true);
    expect(sc.cm).toMatchObject({ retry: "naiv", timeouts: true });
    // Kopfrechnen: ohne Retries Reserve, naiv 3× darüber, mit Budget darunter
    expect(RETRY_CHECKOUTS).toBeLessThan(PAY_CAP);
    expect(RETRY_CHECKOUTS).toBeGreaterThan(PAY_CAP * PAY_BROWNOUT);
    expect(RETRY_MAX_ATTEMPTS * RETRY_CHECKOUTS).toBeGreaterThan(2 * PAY_CAP);
    expect(RETRY_CHECKOUTS * (1 + RETRY_BUDGET)).toBeLessThan(0.85 * PAY_CAP);
  });
  it.each(PLAN_RETRY.map((p, i) => [i, p.key, p.bn ?? "kein Engpass"]))(
    "Stufe %i (%s): „%s“, Überlastvektor und Antwort der eigenen Frage bei appliedAt + settle in 50/50 Seeds",
    SLOW,
    (i) => {
      const plan = PLAN_RETRY[i as number]!;
      const misses: string[] = [];
      for (const run of retryRunsMemo()) {
        const st = run[i as number];
        const vecOk = STATIONS.every(
          (s) => st.overload[s] === plan.overload[s],
        );
        const tipOk = plan.ask ? st.tip === plan.answer : st.tip === null;
        if (st.bottleneck !== plan.bn || !vecOk || !tipOk)
          misses.push(
            `${st.bottleneck} ${JSON.stringify(st.overload)} tip=${st.tip}`,
          );
      }
      expect(misses).toEqual([]);
    },
  );
  it("Versuche je Zahlung, wie zitiert (letzte 10 s): nie mehr als RETRY_MAX_ATTEMPTS — je Seed und Schritt", () => {
    // Über den ganzen Schritt gezählt, kämen Retries des vorigen Sturms ohne
    // ihre Erstversuche dazu (Jitter ≈ 3,02 > 3) — darum das letzte Fenster
    for (const run of retryRunsMemo())
      for (const st of run) {
        expect(st.sum.amp).toBeGreaterThanOrEqual(1);
        expect(st.sum.amp).toBeLessThanOrEqual(RETRY_MAX_ATTEMPTS);
      }
  });
  it("„bleibt“ löst sich zur Station des vorigen Schritts auf, null bleibt „kein Engpass“", () => {
    const run = retryRunsMemo()[0];
    expect(run.map((s: any) => s.expect)).toEqual(PLAN_RETRY.map((p) => p.bn));
  });
  it("Marge bei der Auflösung: Zahlungsdienst deutlich unter, Rest deutlich über der Grenze", () => {
    for (const run of retryRunsMemo()) {
      for (const i of [0, 1, 2]) {
        const st = run[i].snap.stations;
        expect(st.pay.reserve).toBeLessThan(-0.2);
        expect(st.pay.wait).toBeGreaterThan(3 * COLLAPSE_WAIT_S);
        expect(st.web.reserve).toBeGreaterThan(0.5);
        expect(st.inv.reserve).toBeGreaterThan(0.3);
      }
      for (const k of STATIONS)
        expect(run[3].snap.stations[k].reserve).toBeGreaterThan(0.15);
      const s4 = run[4].snap.stations;
      expect(s4.pay.reserve).toBeLessThan(-0.2);
      expect(s4.pay.wait).toBeLessThan(0.7 * COLLAPSE_WAIT_S);
      // erste Probe-Phase: Die Queue beim Anbieter ist (fast) abgebaut, der
      // Breaker noch nicht wieder zu
      expect(s4.pay.breaker).toBe("half");
    }
  });
  it("zitierfähige Kennzahlen (SCRIPT_FIGURES.retry) stimmen im Mittel über 50 Seeds", () => {
    const runs = retryRunsMemo();
    const figs: any[] = SCRIPT_FIGURES.retry;
    expect(figs.map((f) => f.key)).toEqual(PLAN_RETRY.map((p) => p.key));
    expect(SCENARIOS.retry.figWindowS).toBe(TIP_WINDOW_S);
    figs.forEach((fig, i) => {
      const m = (f: (x: any) => number) => mean(runs.map((r) => f(r[i])));
      const near = (v: number, ref: number) =>
        expect(Math.abs(v - ref)).toBeLessThanOrEqual(Math.max(2, 0.06 * ref));
      // Fenster: die letzten 10 s, höchstens seit dem Zug (Breaker: der
      // ganze Schritt, auf volle Sekunden)
      expect(runs[0][i].sum.dur).toBe(
        Math.min(TIP_WINDOW_S, runs[0][i].full.dur),
      );
      if (steps[i].settle < TIP_WINDOW_S)
        expect(runs[0][i].sum.dur).toBeLessThan(TIP_WINDOW_S);
      near(
        m((r) => r.sum.okBrowse),
        fig.pages,
      );
      near(
        m((r) => r.sum.okCheckout),
        fig.orders,
      );
      near(
        m((r) => r.sum.rejected),
        fig.rejected,
      );
      near(
        m((r) => r.sum.lost),
        fig.lost,
      );
      // Verstärkung im selben Fenster, Wellen nach dem Neustart
      expect(Math.abs(m((r) => r.sum.amp) - fig.amp)).toBeLessThanOrEqual(0.1);
      if (fig.wave !== undefined)
        expect(Math.abs(m((r) => r.wave) - fig.wave)).toBeLessThanOrEqual(0.15);
    });
  });
});

describe("Verstärkung verhindern: Retries als Verzögerungsleitung (retry)", () => {
  /** Eine Störung im gegebenen Modus ab RETRY_START_S, gelaufen bis +dt. */
  const incident = (
    cm: Record<string, unknown>,
    dt: number,
    seed = SEEDS50[3]!,
  ) => {
    const sim = new BottleneckSim(seed, "retry", { cm });
    sim.runTo(RETRY_START_S);
    sim.trigger("stoerung");
    sim.runTo(RETRY_START_S + dt);
    return sim;
  };
  it("naiv: Verstärkung > 1,8× — und nach dem Brownout bleibt der Sturm (metastabil); ohne Retries erholt sich die Kasse", () => {
    for (const run of retryRunsMemo()) {
      expect(run[0].full.amp).toBeGreaterThan(1.8);
      expect(run[0].sum.okCheckout).toBeLessThan(0.25 * RETRY_CHECKOUTS);
    }
    const t = PAY_BROWNOUT_S + 12;
    const naiv = incident({}, t);
    const aus = incident({ retry: "aus" }, t);
    expect(naiv.snapshot().overloaded.pay).toBe("kollabiert");
    expect(aus.snapshot().bottleneck).toBe(null);
    const sN = naiv.summarize(naiv.t - 10, naiv.t);
    const sA = aus.summarize(aus.t - 10, aus.t);
    expect(sA.okCheckout).toBeGreaterThan(0.95 * RETRY_CHECKOUTS);
    expect(sA.amp).toBe(1);
    // naiv: Der Anbieter rechnet fast nur noch für Clients, die aufgaben
    expect(sN.payWaste).toBeGreaterThan(0.8 * PAY_CAP);
    expect(sN.tries).toBeGreaterThan(1.8 * PAY_CAP);
  });
  it("Backoff ohne Jitter: hohe Spitze/Mittel nach dem Neustart; mit Jitter deutlich kleiner — je Seed", () => {
    for (const run of retryRunsMemo()) {
      expect(run[1].wave).toBeGreaterThan(RETRY_WAVE_RATIO + 0.2);
      expect(run[2].wave).toBeLessThan(RETRY_WAVE_RATIO - 0.2);
      expect(run[1].wave / run[2].wave).toBeGreaterThan(1.35);
    }
  });
  it("Backoff und Jitter verteilen, deckeln aber nicht: Verstärkung bleibt > 2,4×", () => {
    for (const run of retryRunsMemo())
      for (const i of [1, 2]) expect(run[i].sum.amp).toBeGreaterThan(2.4);
  });
  it("Budget: Verstärkung < 1,12×, Retries ≤ 10 % der Erstversuche (+ Token-Vorrat); der Sturm endet mit der Störung", () => {
    for (const run of retryRunsMemo()) {
      const f = run[3].full;
      expect(f.amp).toBeLessThan(1.12);
      expect(f.retries / f.firsts).toBeLessThanOrEqual(RETRY_BUDGET + 0.02);
      expect(f.retryDenied).toBeGreaterThan(10); // es wurde verweigert
      expect(run[3].sum.okCheckout).toBeGreaterThan(0.95 * RETRY_CHECKOUTS);
    }
  });
  it("Breaker: in der Störung sofort abgewiesen (503) statt nach Timeouts gescheitert; der Anbieter bekommt nur Proben", () => {
    for (const run of retryRunsMemo()) {
      const f = run[4].full;
      // vor dem Öffnen (≈ 4 s) scheitern Versuche noch nach dem Timeout
      expect(f.rejectedC).toBeGreaterThan(1.2 * f.lostC);
      expect(f.tries).toBeLessThan(0.65 * f.arrivals.checkout);
      expect(f.tripsPay).toBeGreaterThanOrEqual(1);
      expect(f.amp).toBeLessThan(1.03);
    }
    // derselbe Schritt ohne Breaker: nichts sofort abgewiesen, mehr verloren
    // — der Rest wartet noch in der Queue
    const ohne = SCRIPTS.retry.map((s: any, i: number) =>
      i === 4 ? { ...s, action: {} } : s,
    );
    for (const seed of SEEDS50.slice(0, 3)) {
      const a = playScript(seed, "retry").steps[4]!.full; // 5 Schritte
      const b = playScript(seed, "retry", { steps: ohne }).steps[4]!.full;
      expect(b.rejectedC).toBeLessThan(0.1);
      expect(a.lostC).toBeLessThan(0.9 * b.lostC);
      expect(a.okCheckout + a.lostC + a.rejectedC).toBeGreaterThan(
        b.okCheckout + b.lostC + 15,
      );
    }
  });
  it("Breaker zählt nur Ausgänge, die der Client kennt: öffnet erst nach erkannten Timeouts, nicht beim ersten Versuch, der sie reißen wird", () => {
    const sim = new BottleneckSim(SEEDS50[5]!, "retry", {
      cm: { breaker: true, retryBudget: true },
    });
    sim.runTo(RETRY_START_S);
    sim.trigger("stoerung");
    let firstDoomed: number | null = null; // erster Versuch, der scheitern wird
    let firstSeen: number | null = null; // erster erkannter Timeout
    let open: number | null = null;
    while (sim.t < RETRY_START_S + 8) {
      sim.runSteps(1);
      if (firstDoomed === null && sim.payPF > 0.5) firstDoomed = sim.t;
      if (firstSeen === null && sim.payFail > 0.5 && sim.payOutcomes > 0)
        firstSeen = sim.t;
      if (open === null && sim.brPay.state === "open") open = sim.t;
    }
    expect(firstDoomed).not.toBeNull();
    // gemischte Schritte (ein Teil scheitert) zählen früher mit, aber nie
    // vor dem Timeout der ersten
    expect(firstSeen! - firstDoomed!).toBeGreaterThan(PAY_TIMEOUT_S - 0.5);
    expect(open!).toBeGreaterThan(firstSeen!);
  });
  it("Verzögerungsleitung: naiv im nächsten Schritt, Backoff genau RETRY_BASE_S · 2^(k−1), Jitter gleichverteilt bis dahin", () => {
    // Neustart im Sturm: Alle offenen Aufrufe scheitern im selben Moment
    const at = (mode: string) => {
      const sim = new BottleneckSim(SEEDS50[1]!, "retry", {
        cm: { retry: mode },
      });
      sim.runTo(RETRY_START_S);
      sim.trigger("stoerung");
      // runTo(t) rechnet bis zum Schritt t − DT; der nächste ist der Neustart
      sim.runTo(RETRY_START_S + PAY_BROWNOUT_S);
      const before = sim.fqSum;
      expect(before).toBeGreaterThan(50); // viele warten auf ihren Timeout
      const queued = sim.pq;
      expect(queued).toBeGreaterThan(5 * PAY_CAP * PAY_BROWNOUT); // > 5 s Queue
      sim.runSteps(1); // Neustart
      // alle Offenen erkannt; was jetzt noch wartet, kam in diesem Schritt
      // neu in die leere Queue (Erstversuche, kaum Ausfall)
      expect(sim.fqSum).toBeLessThan(0.1);
      expect(sim.pqOrph).toBeLessThan(0.1);
      expect(sim.pq).toBeLessThan(0.05 * queued);
      // was der Client jetzt kennt, ist fast nur Scheitern (dazu wenige
      // Erstversuche, die die leere Queue sofort bedient)
      expect(sim.payFail).toBeGreaterThan(0.95);
      // Slot-Belegung der Verzögerungsleitung je Versuch (2., 3.)
      const S = sim.rRq.length / 3;
      const lane = (k: number) =>
        Array.from(
          { length: 50 },
          (_, j) => sim.rRq[((sim.n + j) % S) * 3 + k]!,
        );
      return { sim, l2: lane(1), l3: lane(2) };
    };
    const b = at("backoff");
    const d2 = Math.round(RETRY_BASE_S / DT);
    const d3 = Math.round((2 * RETRY_BASE_S) / DT);
    // der Neustart-Puls liegt genau im Slot +Backoff (minus dem Schritt,
    // der schon gelaufen ist), nicht davor — darüber die laufenden Retries
    const pulse2 = b.l2[d2 - 1]!;
    const pulse3 = b.l3[d3 - 1]!;
    expect(pulse2).toBeGreaterThan(5 * Math.max(b.l2[d2 - 3]!, b.l2[d2 + 1]!));
    expect(pulse3).toBeGreaterThan(5 * Math.max(b.l3[d3 - 3]!, b.l3[d3 + 1]!));
    const j = at("backoffJitter");
    // Jitter: derselbe Puls über die Slots 0 … Backoff verteilt — keine
    // Spitze (dazu die verteilten Retries von vorher, daher nicht exakt eben)
    const head = j.l2.slice(0, d2 - 1);
    expect(Math.max(...head) / Math.min(...head)).toBeLessThan(2);
    expect(Math.max(...j.l2)).toBeLessThan(0.25 * pulse2);
    const n = at("naiv");
    expect(n.l2[0]).toBeGreaterThan(0.5 * pulse2); // sofort im nächsten Schritt
    expect(n.l2.slice(2).every((x) => x === 0)).toBe(true);
  });
  it("Timeout und Versuche: ohne Retries 1 Versuch; mit Timeouts scheitert ein Versuch nach PAY_TIMEOUT_S, ohne erst nach PAY_GIVEUP_S", () => {
    const naiv = incident({}, 10);
    expect(naiv.snapshot().retry.maxAttempts).toBe(RETRY_MAX_ATTEMPTS);
    expect(naiv.payTC).toBe(PAY_TIMEOUT_S);
    expect(incident({ retry: "aus" }, 1).snapshot().retry.maxAttempts).toBe(1);
    // ohne Client-Timeout wartet der Client bis zum Abbruch des Anbieters:
    // im Brownout scheitert noch nichts, es kommen keine Retries
    const slow = incident({ timeouts: false }, PAY_BROWNOUT_S - 1);
    expect(slow.payTC).toBe(PAY_GIVEUP_S);
    const sS = slow.summarize(RETRY_START_S, slow.t);
    expect(sS.retries).toBeLessThan(1e-6);
    expect(naiv.summarize(RETRY_START_S, naiv.t).retries).toBeGreaterThan(20);
    // Brownout: Kapazität PAY_BROWNOUT des Nennwerts, danach wieder voll
    const s = slow.snapshot().stations.pay;
    expect(s.capFactor).toBe(PAY_BROWNOUT);
    expect(s.brownout).toBe(true);
    slow.runTo(RETRY_START_S + PAY_BROWNOUT_S + 1);
    expect(slow.snapshot().stations.pay.capFactor).toBe(1);
  });
  it("Kontrolle der eigenen Fragen: jeder Ausgang ist erreichbar, die Antworten hängen am Zustand", () => {
    const pre = new BottleneckSim(SEEDS50[6]!, "retry");
    pre.runTo(RETRY_START_S - 2); // vor der Störung
    expect(observeTip(pre, "retryShape")).toBe("keine");
    expect(observeTip(pre, "payLoad")).toBe("x1");
    expect(observeTip(pre, "kunden")).toBe("klappt");
    const run = retryRunsMemo()[6];
    expect(run[1].tip).toBe("wellen");
    expect(run[2].tip).toBe("glatt");
    expect(run[3].tip).toBe("x11");
    expect(run[4].tip).toBe("sofort");
    // naiv mitten im Brownout: ×2, Kunden warten auf den Fehler
    const n8 = incident({}, 9, SEEDS50[6]!);
    expect(observeTip(n8, "payLoad")).toBe("x2");
    expect(observeTip(n8, "kunden")).toBe("warten");
    const n20 = incident({}, PAY_BROWNOUT_S + 10, SEEDS50[6]!);
    expect(observeTip(n20, "payLoad")).toBe("x3");
    // Budget: nur noch wenige Retries
    const b = incident({ retryBudget: true }, 10, SEEDS50[6]!);
    expect(observeTip(b, "retryShape")).toBe("wenige");
    // ohne Retries: keine; nach dem Brownout klappt die Hälfte (teils)
    const a = incident({ retry: "aus" }, PAY_BROWNOUT_S + 12, SEEDS50[6]!);
    expect(observeTip(a, "retryShape")).toBe("keine");
    expect(observeTip(a, "kunden")).toBe("teils");
    expect(observeTip(a, "payLoad")).toBe("x1");
    // Schwellen geordnet
    expect(AMP_X3 > AMP_X2 && AMP_X2 > AMP_X11 && AMP_X11 > 1).toBe(true);
    expect(RETRY_FEW_SHARE).toBeGreaterThan(RETRY_BUDGET);
    expect(ASK_KINDS.kunden).toEqual(["warten", "sofort", "teils", "klappt"]);
  });
  it("Breaker vor der Zahlung: scheitert die Probe, öffnet er erst nach ihrem Timeout (payTC) wieder", () => {
    // naiver Sturm mitten im Brownout: Die Queue beim Anbieter leert sich in
    // 3 s offen nicht — die Proben (HALF_ADMIT) reißen den Timeout
    const sim = incident({}, 8);
    sim.set({ breaker: true });
    const log: [number, string][] = [];
    while (sim.t < RETRY_START_S + PAY_BROWNOUT_S - 0.2) {
      sim.runSteps(1);
      const st = sim.brPay.state;
      if (st === "half") expect(sim.payAdmit).toBe(HALF_ADMIT);
      if (!log.length || log[log.length - 1]![1] !== st) log.push([sim.t, st]);
    }
    let reopen = 0;
    for (let i = 1; i < log.length; i++) {
      const [t, st] = log[i]!;
      const [tPrev, stPrev] = log[i - 1]!;
      if (stPrev === "open" && st === "half")
        expect(t - tPrev).toBeCloseTo(BREAKER_OPEN_S, 6);
      // Probe frühestens einen Schritt nach Beginn der Probe-Phase gesendet,
      // ihr Timeout einen Schritt später gesehen
      if (stPrev === "half" && st === "open") {
        expect(t - tPrev).toBeCloseTo(PAY_TIMEOUT_S + 2 * DT, 6);
        reopen++;
      }
      // ohne Ergebnis der Proben schließt er nicht
      if (stPrev === "half" && st === "closed")
        expect(t - tPrev).toBeGreaterThanOrEqual(PAY_TIMEOUT_S + 2 * DT - 1e-9);
    }
    expect(reopen).toBeGreaterThanOrEqual(1);
  });
  it("Retry-Modus live auf „aus“: Wartende Retries entfallen sofort und zählen als gescheitert", () => {
    const sim = incident({ retry: "backoff" }, 10);
    expect(sim.rqSum).toBeGreaterThan(50); // viele im Backoff
    const t0 = sim.t;
    const fail0 = sim.stats.failC;
    const waiting = sim.rqSum;
    sim.set({ retry: "aus" });
    sim.runSteps(1);
    expect(sim.rqSum).toBe(0);
    expect(sim.stats.failC - fail0).toBeGreaterThan(0.95 * waiting);
    sim.runTo(t0 + 2);
    const s = sim.summarize(t0, t0 + 2);
    expect(s.retries).toBeLessThan(1e-6);
    expect(sim.rqSum).toBe(0);
    expect(sim.stats.failC - fail0).toBeGreaterThan(50);
  });
  it("retryWaveRatio misst nach dem Neustart, ohne dessen erste Sekunden", () => {
    const sim = incident({ retry: "backoff" }, PAY_BROWNOUT_S + 12);
    const r = retryWaveRatio(sim);
    const t1 = RETRY_START_S + PAY_BROWNOUT_S;
    expect(r).toBeCloseTo(
      sim.summarize(t1 + RETRY_WAVE_SKIP_S, sim.t).retryPeakRatio,
      12,
    );
    // im Brownout: seit dessen Beginn
    const mid = incident({ retry: "backoff" }, 8);
    expect(retryWaveRatio(mid)).toBeCloseTo(
      mid.summarize(RETRY_START_S, mid.t).retryPeakRatio,
      12,
    );
  });
  it("Replay bitgenau mit Retries, Budget, Breaker und Störungen", () => {
    const sim = new BottleneckSim(4243, "retry");
    sim.runTo(20);
    sim.trigger("stoerung", 30); // geplant, wie Schritt 0 in der UI
    sim.runTo(50);
    sim.set({ retry: "backoffJitter" });
    sim.trigger("stoerung");
    sim.advance(13.37);
    sim.set({ retryBudget: true, breaker: true });
    sim.runTo(90);
    sim.set({ retry: "aus" });
    sim.runTo(100);
    const r = replay(sim.seed, sim.scenario, sim.log, sim.n, sim.overrides);
    expect(r.histAt(r.histLen - 1)).toEqual(sim.histAt(sim.histLen - 1));
    expect(r.stats).toEqual(sim.stats);
    expect([...r.rRq]).toEqual([...sim.rRq]);
    expect(() => sim.trigger("gibtsnicht")).toThrow(/Ereignis/);
    expect(() => sim.set({ retry: "doppelt" })).toThrow(/Retry-Modus/);
    expect(RETRY_MODES).toEqual(["aus", "naiv", "backoff", "backoffJitter"]);
  });
  it("Schalter und Störungen ziehen keine Zufallszahlen: gleiche Umwelt", () => {
    const a = new BottleneckSim(777, "retry");
    const b = new BottleneckSim(777, "retry");
    b.runTo(25);
    b.set({ retry: "backoff", retryBudget: true });
    b.trigger("stoerung");
    b.runTo(60);
    b.set({ retry: "backoffJitter", breaker: true, retryBudget: false });
    b.trigger("stoerung");
    a.runTo(120);
    b.runTo(120);
    for (let i = 0; i < a.histLen; i++)
      expect(b.histAt(i).env).toEqual(a.histAt(i).env);
  });
  it("Retries live in der Rabattaktion an und wieder aus: Zähler bleiben endlich und nicht negativ", () => {
    const sim = new BottleneckSim(SEEDS50[2]!, "rabatt");
    sim.runTo(100);
    expect(sim.retryLayer).toBe(false);
    sim.set({ scale: true, scaleMode: "vorgewaermt", featureShed: true });
    sim.runTo(200);
    sim.set({ retry: "naiv" }); // Kasse überlastet: Retries verstärken
    sim.runTo(240);
    expect(sim.retryLayer).toBe(true);
    const on = sim.summarize(220, 240);
    expect(on.amp).toBeGreaterThan(1.5);
    sim.set({ retry: "aus" });
    sim.runTo(260);
    expect(sim.retryLayer).toBe(false);
    expect(sim.payHeld).toBe(0);
    for (const k of ["okC", "lostC", "failC", "tryP", "r503C"] as const)
      expect(sim.stats[k]).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(sim.pq)).toBe(true);
    const off = sim.summarize(250, 260);
    expect(off.tries).toBe(0);
  });
  it("Frist mit Versuchen wie ohne: Eine Zahlung, die erst nach Wartezeit oder im zweiten Versuch gelingt, ist zu spät", () => {
    // Retry-Sturm ohne Client-Timeout: Zahlungen gelingen nach bis zu 10 s —
    // rechtzeitig sind sie nicht (vorher zählten sie als Bestellung)
    const slow = new BottleneckSim(SEEDS50[5]!, "retry", {
      cm: { timeouts: false },
    });
    slow.runTo(RETRY_START_S);
    slow.trigger("stoerung");
    slow.runTo(RETRY_START_S + 27);
    const sS = slow.summarize(RETRY_START_S, slow.t);
    expect(sS.okCheckout).toBeLessThan(0.25 * RETRY_CHECKOUTS);
    expect(sS.wasteC).toBeGreaterThan(0.5 * RETRY_CHECKOUTS);
    // Kurze Spitzen (synchrone Mail): Retries machen keine Bestellung
    // rechtzeitig, die ohne sie zu spät käme
    const okC = (retry: string) => {
      const sim = new BottleneckSim(SEEDS50[1]!, "spitzen", { cm: { retry } });
      sim.runTo(SPITZEN_START_S + SPITZEN_PERIOD_S + 25);
      return sim.summarize(sim.t - 20, sim.t).okCheckout;
    };
    expect(Math.abs(okC("naiv") - okC("aus"))).toBeLessThan(1);
    // Rabattaktion Schritt 4 (Kasse kollabiert, 10 s Queue): mit
    // Zahlungs-Ebene ebenfalls 0 Bestellungen rechtzeitig
    for (const retryLayer of [false, true]) {
      const sim = new BottleneckSim(SEEDS50[2]!, "rabatt", { retryLayer });
      sim.runTo(100);
      sim.set({ scale: true, scaleMode: "vorgewaermt", featureShed: true });
      sim.runTo(220);
      expect(sim.summarize(200, 220).okCheckout).toBeLessThan(1);
    }
  });
  it("Zeit seit dem Start reist mit: Retries tragen frühere Versuche und Pausen, der Neustart zählt nur die Zeit bis zu ihm, Checkouts die Wartezeit vor der Zahlung", () => {
    // naiver Sturm im Brownout: jeder fällige Retry hat einen Timeout hinter sich
    const sim = new BottleneckSim(SEEDS50[4]!, "retry");
    sim.runTo(RETRY_START_S);
    sim.trigger("stoerung");
    sim.runTo(RETRY_START_S + 10);
    let seen = 0;
    for (let i = 0; i < sim.rRq.length; i++)
      if (sim.rRq[i]! > 1e-6) {
        expect(sim.rRqE[i]! / sim.rRq[i]!).toBeGreaterThanOrEqual(
          PAY_TIMEOUT_S,
        );
        seen++;
      }
    expect(seen).toBeGreaterThan(0);
    // Neustart mit Backoff: Die offenen Aufrufe scheitern vor ihrem Timeout —
    // im Mittel deutlich früher als nach PAY_TIMEOUT_S
    const b = new BottleneckSim(SEEDS50[4]!, "retry", {
      cm: { retry: "backoff" },
    });
    b.runTo(RETRY_START_S);
    b.trigger("stoerung");
    b.runTo(RETRY_START_S + PAY_BROWNOUT_S);
    b.runSteps(1); // Neustart
    const S = b.rRq.length / 3;
    const i = ((b.n - 1 + Math.round(RETRY_BASE_S / DT)) % S) * 3 + 1;
    expect(b.rRq[i]!).toBeGreaterThan(50); // der Neustart-Puls
    expect(b.rRqE[i]! / b.rRq[i]!).toBeLessThan(
      PAY_TIMEOUT_S + RETRY_BASE_S - 0.5,
    );
    // Rabattaktion, DB kollabiert: Checkouts kommen nach langer Wartezeit an
    // der Zahlung an — mit Versuchen so zu spät wie ohne
    for (const retry of ["aus", "naiv"]) {
      const r = new BottleneckSim(SEEDS50[2]!, "rabatt", { cm: { retry } });
      r.runTo(70);
      r.set({ scale: true, scaleMode: "vorgewaermt" });
      r.runTo(150);
      expect(r.summarize(130, 150).okCheckout).toBeLessThan(0.5);
    }
  });
  it("Neustart im Sturm: Die Kasse bleibt „kollabiert“ — die leere Queue nach dem Neustart ist kein Schutz, solange die Mehrheit der Versuche scheitert", () => {
    for (const retry of ["naiv", "backoffJitter"]) {
      const sim = new BottleneckSim(SEEDS50[1]!, "retry", { cm: { retry } });
      sim.runTo(RETRY_START_S);
      sim.trigger("stoerung");
      sim.runTo(RETRY_START_S + PAY_BROWNOUT_S - 1);
      expect(sim.ov.pay).toBe("kollabiert");
      while (sim.t < RETRY_START_S + PAY_BROWNOUT_S + 4) {
        sim.runSteps(1);
        expect(sim.ov.pay, `${retry} t=${sim.t}`).toBe("kollabiert");
      }
    }
  });
  it("Breaker half-open: schließt nur in einem Schritt mit bekannten Ausgängen und nicht vor probeS", () => {
    const sim = new BottleneckSim(SEEDS50[1]!, "retry");
    const half = () => ({ state: "half", err: 0.6, t: 10 });
    const probeS = PAY_TIMEOUT_S + 2 * DT;
    let b = half();
    sim._breakerStep(b, true, 0, false, probeS, 10 + probeS, "tripsPay", true);
    expect(b.state).toBe("half"); // kein Ausgang bekannt: kein Beleg
    sim._breakerStep(
      b,
      true,
      0,
      true,
      probeS,
      10 + probeS - DT,
      "tripsPay",
      true,
    );
    expect(b.state).toBe("half"); // zu früh
    sim._breakerStep(b, true, 0, true, probeS, 10 + probeS, "tripsPay", true);
    expect(b.state).toBe("closed");
    b = half();
    sim._breakerStep(b, true, 1, true, probeS, 10 + probeS, "tripsPay", true);
    expect(b.state).toBe("open");
    // ohne closeNeedsCalls (Empfehlungen, Zahlung ohne Versuche): wie bisher
    b = half();
    sim._breakerStep(b, true, 0, false, 0.3, 10 + BREAKER_CLOSE_S, "tripsRec");
    expect(b.state).toBe("closed");
  });
  it("Erhaltung: jeder Checkout endet genau einmal — durch das Drehbuch und beim Umschalten (Retry-Modus, Breaker, Budget, Timeouts, Shedding)", () => {
    // Ankünfte = rechtzeitig + abgewiesen + verloren + noch im System
    const gap = (sim: any) => {
      const c = sim.c;
      const out = c.okC + c.shedC + c.r503C + c.r429C + c.lostC;
      const inSys =
        sim.ec +
        sim.dbNC +
        (sim.retryLayer
          ? sim.pqOk[0] + sim.pqOk[1] + sim.pqOk[2] + sim.fqSum + sim.rqSum
          : 0);
      return Math.abs(c.arrC - out - inSys);
    };
    let worst = 0;
    let bound = 0; // höchste Queue beim Anbieter, Anteil an PAY_GIVEUP_S
    const sim = new BottleneckSim(SEEDS50[2]!, "retry");
    sim.runTo(SCENARIOS.retry.prerollS);
    for (const st of SCRIPTS.retry as any[]) {
      if (Object.keys(st.action).length) sim.set(st.action);
      const at = sim.t;
      if (st.event) sim.trigger(st.event, at);
      while (sim.t < at + st.settle - 1e-9) {
        sim.runSteps(1);
        worst = Math.max(worst, gap(sim));
        bound = Math.max(bound, sim.pq / (PAY_GIVEUP_S * sim.payCap));
      }
    }
    // Der Anbieter bricht nach PAY_GIVEUP_S ab — die Grenze greift im Sturm
    expect(bound).toBeLessThanOrEqual(1 + 1e-9);
    expect(bound).toBeGreaterThan(0.95);
    const live = new BottleneckSim(SEEDS50[3]!, "retry");
    live.runTo(RETRY_START_S);
    live.trigger("stoerung");
    const patches: [number, Record<string, unknown>][] = [
      [8, { retry: "aus" }],
      [11, { retry: "backoff", shedCheckout: true }],
      [16, { breaker: true, timeouts: false }],
      [24, { retryBudget: true, bpPay: true }],
      [32, { timeouts: true, shedCheckout: false, retry: "backoffJitter" }],
      [40, { breaker: false, retryBudget: false }],
    ];
    for (const [dt, patch] of patches) {
      while (live.t < RETRY_START_S + dt - 1e-9) {
        live.runSteps(1);
        worst = Math.max(worst, gap(live));
      }
      live.set(patch);
      if (dt === 16) live.trigger("stoerung");
    }
    live.runTo(RETRY_START_S + 50);
    worst = Math.max(worst, gap(live));
    // Zahlungs-Ebene live an und aus (Rabattaktion)
    const r = new BottleneckSim(SEEDS50[2]!, "rabatt");
    r.runTo(100);
    r.set({ scale: true, scaleMode: "vorgewaermt", featureShed: true });
    while (r.t < 290 - 1e-9) {
      if (Math.abs(r.t - 200) < 1e-9) r.set({ retry: "naiv", breaker: true });
      if (Math.abs(r.t - 240) < 1e-9) r.set({ retry: "aus" });
      if (Math.abs(r.t - 260) < 1e-9)
        r.set({ retry: "backoffJitter", retryBudget: true });
      r.runSteps(1);
      worst = Math.max(worst, gap(r));
    }
    expect(worst).toBeLessThan(1e-6);
  });
  it("Shed: Checkouts zählt mit Versuchen alles, was der Shop in der Zahlung hält — auch die Retries im Backoff", () => {
    const sim = new BottleneckSim(SEEDS50[4]!, "retry", {
      cm: { retry: "backoff" },
    });
    sim.runTo(RETRY_START_S);
    sim.trigger("stoerung");
    sim.runTo(RETRY_START_S + PAY_BROWNOUT_S - 1);
    sim.set({ shedCheckout: true });
    sim.runTo(RETRY_START_S + PAY_BROWNOUT_S + 0.1);
    // nach dem Neustart: Queue beim Anbieter leer, der Neustart-Puls im Backoff
    expect(sim.pq).toBeLessThan(SHED_C_TARGET_S * PAY_CAP);
    expect(sim.payHeld).toBeGreaterThan(10 * SHED_C_TARGET_S * PAY_CAP);
    const t0 = sim.t;
    sim.runTo(t0 + 1);
    const s = sim.summarize(t0, sim.t);
    expect(s.shedC).toBeGreaterThan(0.95 * s.arrivals.checkout);
  });
  it("ohne Retries und Störung bitgleich wie vorher: keine Zahlungs-Ebene, kein Brownout (Rabattaktion)", () => {
    const sim = new BottleneckSim(SEEDS50[1]!, "rabatt");
    sim.runTo(300);
    expect(sim.retryLayer).toBe(false);
    expect(sim.payF).toBe(1);
    expect(sim.payHeld).toBe(0);
    expect(sim.incidents).toEqual([]);
    expect(sim.stats.tryP + sim.stats.failC + sim.stats.wasteP).toBe(0);
    expect((CM_DEFAULTS as Record<string, unknown>).retry).toBe("aus");
    expect((CM_DEFAULTS as Record<string, unknown>).retryBudget).toBe(false);
  });
});

describe("Drehbuch Kurze Spitzen (ein Live-Lauf je Seed, 50 Seeds)", () => {
  const steps: any[] = SCRIPTS.spitzen;
  const sc: any = SCENARIOS.spitzen;
  it("SCRIPTS.spitzen entspricht der Drehbuch-Tabelle (wörtlich, vierte Station, Dauerlast als Ereignis)", () => {
    expect(steps.map((s) => s.key)).toEqual(PLAN_SPITZEN.map((p) => p.key));
    steps.forEach((s, i) => {
      const p = PLAN_SPITZEN[i]!;
      expect(s.action).toEqual(p.action);
      expect(s.event).toBe(p.event);
      expect(s.expect).toBe(p.expect);
      expect(s.overload).toEqual(p.overload);
      expect(s.ask).toBe(p.ask);
      expect(s.answer).toBe(p.answer);
      if (s.ask)
        expect((ASK_KINDS as Record<string, string[]>)[s.ask]).toContain(
          s.answer,
        );
    });
    // Szenario: Wellen ab dem Vorlauf, Mailversand, kein Funnel
    expect(sc.variant).toBe("remedies");
    expect(sc.tempo).toBe(20);
    expect(sc.windowS).toBe(600);
    expect(sc.prerollS).toBe(SPITZEN_START_S);
    expect(sc.mail).toBe(true);
    expect(sc.conv).toBe(0);
    expect(sc.cFix).toBe(SPITZEN_BASE);
    expect(sc.load).toEqual([[0, SPITZEN_PAGES + SPITZEN_BASE]]);
    expect(sc.waves).toEqual({
      t0: SPITZEN_START_S,
      period: SPITZEN_PERIOD_S,
      on: SPITZEN_ON_S,
      base: SPITZEN_BASE,
      peak: SPITZEN_PEAK,
    });
    expect(sc.nWeb).toBe(N_WEB_SPITZEN);
    expect(sc.scaleTarget).toBe(SCALE_TARGET_SPITZEN);
    expect(stationsOf("spitzen")).toEqual([...STATIONS4]);
    // Kopfrechnen: im Mittel unter, in der Spitze über dem Mailversand;
    // Kasse, DB und Webserver mit Reserve auch in der Spitze
    expect(SPITZEN_AVG).toBeLessThan(0.75 * MAIL_CAP);
    expect(SPITZEN_PEAK).toBeGreaterThan(1.2 * MAIL_CAP);
    expect(SPITZEN_PEAK).toBeLessThan(0.9 * PAY_CAP);
    expect(N_WEB_SPITZEN * WEB_PER_INSTANCE).toBeGreaterThan(
      1.3 * (SPITZEN_PAGES + SPITZEN_PEAK),
    );
    expect(
      SPITZEN_PAGES * INV_PAGE_E + SPITZEN_PEAK * INV_RESERVE_E,
    ).toBeLessThan(0.85 * INV_CAP_E);
    // Schritt 0 löst mitten in der zweiten Welle auf (≥ 15 s nach ihrem
    // Beginn, vor ihrer Flanke) — Schritt 0 beginnt immer beim Vorlauf
    const res0 = sc.prerollS + steps[0].settle - sc.waves.t0;
    expect(Math.floor(res0 / SPITZEN_PERIOD_S)).toBe(1);
    expect(res0 % SPITZEN_PERIOD_S).toBeGreaterThanOrEqual(15);
    expect(res0 % SPITZEN_PERIOD_S).toBeLessThanOrEqual(SPITZEN_ON_S);
    // eigene Fragen: ein volles Fenster nach dem Übergang; die Dauerlast
    // füllt den Puffer auch leer binnen MAIL_Q_EFF / MAIL_EXCESS
    expect(steps[1].settle).toBeGreaterThanOrEqual(2 * MAIL_TIP_WINDOW_S);
    expect(steps[2].settle).toBeGreaterThanOrEqual(
      MAIL_TIP_WINDOW_S + MAIL_Q_EFF / MAIL_EXCESS,
    );
  });
  it.each(PLAN_SPITZEN.map((p, i) => [i, p.key, p.bn ?? "kein Engpass"]))(
    "Stufe %i (%s): „%s“, Überlastvektor (vier Stationen) und Antwort der eigenen Frage bei appliedAt + settle in 50/50 Seeds",
    SLOW,
    (i) => {
      const plan = PLAN_SPITZEN[i as number]!;
      const misses: string[] = [];
      for (const run of spitzenRunsMemo()) {
        const st = run[i as number];
        const vecOk =
          Object.keys(st.overload).length === 4 &&
          STATIONS4.every((s) => st.overload[s] === plan.overload[s]);
        const tipOk = plan.ask ? st.tip === plan.answer : st.tip === null;
        if (st.bottleneck !== plan.bn || !vecOk || !tipOk)
          misses.push(
            `${st.bottleneck} ${JSON.stringify(st.overload)} tip=${st.tip}`,
          );
        // Auflösung genau bei appliedAt + settle
        expect(st.snap.t).toBeCloseTo(
          st.appliedAt + steps[i as number].settle,
          9,
        );
      }
      expect(misses).toEqual([]);
    },
  );
  it("null bleibt „kein Engpass“; jeder Schritt beginnt, wo der vorige aufgelöst hat", () => {
    const run = spitzenRunsMemo()[0];
    expect(run.map((s: any) => s.expect)).toEqual(
      PLAN_SPITZEN.map((p) => p.bn),
    );
    expect(run[0].appliedAt).toBe(SPITZEN_START_S);
    expect(run[1].appliedAt).toBe(SPITZEN_START_S + steps[0].settle);
    expect(run[2].appliedAt).toBe(run[1].appliedAt + steps[1].settle);
  });
  it(
    "Schritte 1 und 2 hängen nicht an der Phase der Welle (▶ in der Auflösung verschiebt den Zug)",
    SLOW,
    () => {
      // Schritt 0 beginnt in der UI immer beim Vorlauf; danach kann der Zug
      // in jeder Phase der Welle kommen — die Antworten müssen trotzdem gelten
      const bad: string[] = [];
      for (const seed of SEEDS10.slice(0, 4)) {
        for (const d1 of [0, 37, 74, 111]) {
          for (const d2 of [0, 59]) {
            const sim = new BottleneckSim(seed, "spitzen");
            sim.runTo(sc.prerollS + steps[0].settle + d1);
            sim.set({ smoothing: true });
            sim.runTo(sim.t + steps[1].settle);
            const r1 = [
              sim.bottleneck,
              observeTip(sim, "mails"),
              (sim.ov as Record<string, string>).mail,
            ];
            sim.runTo(sim.t + d2);
            sim.trigger("dauerlast");
            sim.runTo(sim.t + steps[2].settle);
            const r2 = [
              sim.bottleneck,
              observeTip(sim, "mails"),
              (sim.ov as Record<string, string>).mail,
            ];
            if (
              r1.join() !== ",verspaetet,ok" ||
              r2.join() !== "mail,verloren,abgefangen"
            )
              bad.push(`${seed} +${d1} +${d2}: ${r1} | ${r2}`);
          }
        }
      }
      expect(bad).toEqual([]);
    },
  );
  it("Marge bei der Auflösung: Mailversand deutlich unter bzw. über der Grenze, der Rest mit Reserve", () => {
    for (const run of spitzenRunsMemo()) {
      const [s0, s1, s2] = run.map((r: any) => r.snap.stations);
      expect(s0.mail.reserve).toBeLessThan(-0.15);
      expect(s0.mail.wait).toBeGreaterThan(3 * COLLAPSE_WAIT_S);
      expect(s1.mail.reserve).toBeGreaterThan(0.2);
      expect(s2.mail.reserve).toBeLessThan(-0.15);
      for (const st of [s0, s1, s2]) {
        expect(st.web.reserve).toBeGreaterThan(0.3);
        expect(st.inv.reserve).toBeGreaterThan(0.1);
        expect(st.pay.reserve).toBeGreaterThan(0.05);
      }
    }
  });
  it("zitierfähige Kennzahlen (SCRIPT_FIGURES.spitzen) stimmen im Mittel über 50 Seeds", () => {
    const runs = spitzenRunsMemo();
    const figs: any[] = SCRIPT_FIGURES.spitzen;
    expect(figs.map((f) => f.key)).toEqual(PLAN_SPITZEN.map((p) => p.key));
    figs.forEach((fig, i) => {
      const m = (f: (r: any) => number) => mean(runs.map((r) => f(r[i])));
      const near = (v: number, ref: number) =>
        expect(Math.abs(v - ref)).toBeLessThanOrEqual(Math.max(2, 0.06 * ref));
      expect(runs[0][i].sum.dur).toBe(20);
      near(
        m((r) => r.sum.okBrowse),
        fig.pages,
      );
      near(
        m((r) => r.sum.okCheckout),
        fig.orders,
      );
      near(
        m((r) => r.sum.rejected),
        fig.rejected,
      );
      near(
        m((r) => r.sum.lost),
        fig.lost,
      );
      near(
        m((r) => r.sum.mail.sent),
        fig.mailSent,
      );
      near(
        m((r) => r.sum.mail.lost),
        fig.mailLost,
      );
      // größte Verzögerung einer Mail über den ganzen Schritt, ± 1 s
      expect(
        Math.abs(m((r) => r.full.mail.maxWait) - fig.delay),
      ).toBeLessThanOrEqual(1);
    });
  });
});

describe("Spitzen verteilen: Mailversand und Puffer (spitzen)", () => {
  const P0 = SPITZEN_START_S;
  const PER = SPITZEN_PERIOD_S;
  /** Lauf im Szenario spitzen bis t, optional mit Puffer von Anfang an. */
  const run = (
    t: number,
    cm: Record<string, unknown> = {},
    seed = SEEDS50[4]!,
  ) => {
    const sim = new BottleneckSim(seed, "spitzen", { cm });
    sim.runTo(t);
    return sim;
  };
  it("Wellen: je Periode an und aus, weiche Flanken, Mittel = SPITZEN_AVG; Dauerlast hält oben", () => {
    const w = (SCENARIOS.spitzen as any).waves;
    expect(waveShape(w, P0 - 1)).toBe(0);
    expect(waveShape(w, P0)).toBe(0);
    expect(waveShape(w, P0 + WAVE_RAMP_S)).toBe(1);
    expect(waveShape(w, P0 + SPITZEN_ON_S)).toBe(1);
    expect(waveShape(w, P0 + SPITZEN_ON_S + WAVE_RAMP_S)).toBe(0);
    expect(waveShape(w, P0 + PER + WAVE_RAMP_S)).toBe(1);
    // Mittel über eine Periode (DT-Raster) = SPITZEN_AVG
    let sum = 0;
    for (let k = 0; k < PER * 10; k++) sum += waveShape(w, P0 + k / 10);
    const avg =
      SPITZEN_BASE + (SPITZEN_PEAK - SPITZEN_BASE) * (sum / (PER * 10));
    expect(avg).toBeCloseTo(SPITZEN_AVG, 6);
    // Dauerlast: ab dann dauerhaft oben, auch in der Pause
    expect(waveShape(w, P0 + 60, P0 + 50)).toBe(1);
    expect(waveShape(w, P0 + 51, P0 + 50)).toBeGreaterThan(0);
    // im Lauf: Checkouts = Grundlast + Welle, Seiten konstant
    const sim = run(P0 + 20);
    const s = sim.snapshot();
    expect(s.load.checkout).toBeCloseTo(SPITZEN_PEAK, 9);
    expect(s.load.nominal).toBeCloseTo(SPITZEN_PAGES + SPITZEN_PEAK, 9);
    sim.runTo(P0 + 60);
    expect(sim.snapshot().load.checkout).toBeCloseTo(SPITZEN_BASE, 9);
  });
  it("synchron: in der Welle warten Kunden auf die Mail und gehen verloren, zwischen den Wellen laufen die Bestellungen", () => {
    for (const seed of SEEDS10) {
      const sim = run(P0 + PER + 25, {}, seed);
      // zwischen den Wellen (Pause der ersten Periode, Rückstand abgebaut)
      const gap = sim.summarize(P0 + 70, P0 + 115);
      expect(gap.okCheckout).toBeGreaterThan(0.95 * SPITZEN_BASE);
      expect(gap.lostC).toBeLessThan(0.5);
      expect(gap.mail.maxWait).toBeLessThan(1);
      // in der zweiten Welle: fast alle zu spät (verloren), die Mail wartet
      const wave = sim.summarize(P0 + PER + 10, P0 + PER + 25);
      expect(wave.okCheckout).toBeLessThan(0.2 * SPITZEN_PEAK);
      expect(wave.lostC).toBeGreaterThan(0.75 * SPITZEN_PEAK);
      expect(wave.wasteC).toBeCloseTo(wave.lostC, 6); // zu spät = verschwendet
      const s = sim.snapshot();
      expect(s.stations.mail!.mode).toBe("sync");
      expect(s.latency.checkout).toBeGreaterThan(s.stations.mail!.wait);
      // der Kunde wartet: die Mail hält ihren Web-Thread
      expect(s.stations.web.threads.busy).toBeGreaterThan(
        s.stations.mail!.queue,
      );
    }
  });
  it("Puffer, Mittel < Kapazität: Bestellungen sofort, Mails verspätet, aber alle — er füllt sich in der Welle und läuft leer", () => {
    for (const seed of SEEDS10) {
      const sim = run(P0 + 3 * PER, { smoothing: true }, seed);
      const per = sim.summarize(P0 + 2 * PER, P0 + 3 * PER);
      expect(per.okCheckout).toBeGreaterThan(0.98 * per.arrivals.checkout);
      expect(per.mail.lost).toBe(0);
      expect(per.mail.sent).toBeGreaterThan(0.97 * per.mail.in);
      expect(per.mail.sent).toBeLessThan(1.03 * per.mail.in);
      // Rückstand je Welle ≈ (Spitze − Kapazität) × Dauer, Verzögerung ≈ / Kapazität
      expect(per.mail.maxQueue).toBeGreaterThan(0.8 * MAIL_WAVE_BACKLOG);
      expect(per.mail.maxQueue).toBeLessThan(1.25 * MAIL_WAVE_BACKLOG);
      expect(per.mail.maxWait).toBeGreaterThan(MAIL_LATE_S);
      expect(per.mail.maxWait).toBeLessThan(1.4 * MAIL_WAVE_DELAY_S);
      expect(per.mail.maxQueue).toBeLessThan(0.7 * MAIL_Q_EFF); // nie voll
      // vor der nächsten Welle ist der Puffer leer
      const pre = run(P0 + 3 * PER - 2, { smoothing: true }, seed);
      expect(pre.mq).toBeLessThan(1);
      // die Mail zählt nicht zur Latenz der Bestellung, hält keinen Thread
      const inWave = run(P0 + 2 * PER + 25, { smoothing: true }, seed);
      const s = inWave.snapshot();
      expect(s.stations.mail!.mode).toBe("async");
      expect(s.stations.mail!.queue).toBeGreaterThan(200);
      expect(s.latency.checkout).toBeLessThan(0.5);
      expect(s.stations.web.threads.busy).toBeLessThan(
        0.2 * s.stations.mail!.queue,
      );
    }
  });
  it("Lastglättung schafft keine Kapazität: höchstens MAIL_CAP Mails/s — sie verschiebt Arbeit in die Pause", () => {
    const sim = new BottleneckSim(SEEDS50[4]!, "spitzen", {
      cm: { smoothing: true },
    });
    let maxRatio = 0;
    let afterWave = 0;
    while (sim.t < P0 + 2 * PER - 1e-9) {
      sim.runSteps(10);
      const h = sim.histAt(sim.histLen - 1);
      maxRatio = Math.max(maxRatio, h.mailSent / h.mailCap);
      const ph = (h.t - P0) % PER;
      // nach der Welle: weiter voll ausgelastet, solange der Puffer abbaut
      if (h.t > P0 + PER && ph >= SPITZEN_ON_S + 5 && ph <= SPITZEN_ON_S + 10) {
        expect(h.mailSent).toBeGreaterThan(0.95 * h.mailCap);
        expect(h.mailIn).toBeLessThan(1.1 * SPITZEN_BASE);
        afterWave++;
      }
    }
    expect(afterWave).toBeGreaterThan(3);
    expect(maxRatio).toBeLessThan(1.02); // 1-s-Mittel gegen den Momentwert
  });
  it("synchron hält jede wartende Mail einen Web-Thread: Mit wenigen Threads legt der Mailversand in der Welle auch die Produktseiten lahm — mit Puffer nicht", () => {
    // 4 × 50 = 200 Threads < Rückstand der Welle (bis 450 Mails). Wie bei
    // DB und Kasse senkt das Halten nicht die Kapazität der Webserver: Der
    // Engpass bleibt der Mailversand, der Rückstau erreicht den Rand.
    const mk = (cm: Record<string, unknown>) => {
      const sim = new BottleneckSim(SEEDS50[5]!, "spitzen", {
        cm,
        threadsPerInstance: 50,
      });
      sim.runTo(P0 + PER + 25);
      return sim;
    };
    const sync = mk({});
    const s = sync.snapshot();
    const th = s.stations.web.threads;
    expect(th.busy).toBeGreaterThan(0.85 * th.max);
    expect(th.busy).toBeGreaterThan(s.stations.mail!.queue);
    expect(s.bottleneck).toBe("mail");
    const wS = sync.summarize(P0 + PER + 15, P0 + PER + 25);
    expect(wS.okBrowse).toBeLessThan(0.5 * SPITZEN_PAGES);
    const as = mk({ smoothing: true });
    expect(as.snapshot().stations.web.blocked).toBe(false);
    const wA = as.summarize(P0 + PER + 15, P0 + PER + 25);
    expect(wA.okBrowse).toBeGreaterThan(0.95 * SPITZEN_PAGES);
  });
  it("Mails nur für bediente Zahlungen: Im Brownout der Kasse kommen höchstens so viele an, wie sie schafft", () => {
    const sim = new BottleneckSim(SEEDS50[6]!, "spitzen");
    sim.runTo(P0 + 2);
    sim.trigger("stoerung"); // Brownout auf PAY_BROWNOUT, mitten in der Welle
    sim.runTo(P0 + 12);
    const m = sim.summarize(P0 + 5, P0 + 12);
    expect(m.arrivals.checkout).toBeGreaterThan(0.95 * SPITZEN_PEAK);
    expect(m.mail.in).toBeLessThan(1.1 * PAY_BROWNOUT * PAY_CAP);
    expect(m.mail.in).toBeCloseTo(m.throughput.pay, 6);
  });
  it("Dauerlast, Mittel > Kapazität: der Puffer läuft voll und verliert Spitze − Kapazität je s; die Bestellungen bleiben", () => {
    for (const run2 of spitzenRunsMemo()) {
      const st = run2[2];
      const m = st.sum.mail;
      expect(Math.abs(m.lost - MAIL_EXCESS)).toBeLessThan(5);
      expect(m.lostShare).toBeGreaterThan(MAIL_LOST_SHARE);
      expect(st.sum.okCheckout).toBeGreaterThan(
        0.98 * st.sum.arrivals.checkout,
      );
      const mail = st.snap.stations.mail;
      // voll: Altersgrenze (bei der geglätteten Abflussrate) vor der
      // Größengrenze; die Verzögerung ist genau die Altersgrenze
      expect(mail.queue).toBeCloseTo(mail.queueMax, 6);
      expect(mail.queueMax).toBeCloseTo(mail.rate * MAIL_MAX_AGE_S, 6);
      expect(mail.queueMax).toBeLessThan(MAIL_Q_MAX);
      expect(mail.wait).toBeCloseTo(MAIL_MAX_AGE_S, 6);
      expect(st.snap.load.dauer).toBe(true);
    }
    // die Verluste je Sekunde folgen der Rate, nicht dem Rauschen jedes
    // Schritts (Altersgrenze gegen die geglättete Abflussrate)
    const { sim } = playScript(SEEDS50[0]!, "spitzen");
    const lost: number[] = [];
    for (let i = sim.histLen - 30; i < sim.histLen; i++)
      lost.push(sim.histAt(i).mailLost);
    expect(Math.max(...lost) - Math.min(...lost)).toBeLessThan(8);
  });
  it("Puffer: Größen- UND Altersgrenze — die engere zählt; synchron bricht der Shop nach MAIL_GIVEUP_S ab", () => {
    const sim = run(P0, { smoothing: true });
    expect(MAIL_Q_EFF).toBe(Math.min(MAIL_Q_MAX, MAIL_CAP * MAIL_MAX_AGE_S));
    expect(MAIL_Q_EFF).toBeLessThan(MAIL_Q_MAX); // hier greift das Alter
    sim.mailRate = MAIL_CAP;
    expect(sim._mailQMax()).toBeCloseTo(MAIL_CAP * MAIL_MAX_AGE_S, 9);
    sim.mailRate = 2 * MAIL_CAP; // schnellerer Versand: jetzt greift die Größe
    expect(sim._mailQMax()).toBe(MAIL_Q_MAX);
    sim.mailRate = MAIL_CAP;
    sim.set({ smoothing: false });
    expect(sim._mailQMax()).toBeCloseTo(MAIL_CAP * MAIL_GIVEUP_S, 9);
    // synchron in Dauerlast: der Versand hängt am Abbruch
    sim.trigger("dauerlast");
    sim.runTo(P0 + 120);
    const s = sim.snapshot().stations.mail!;
    expect(s.wait).toBeCloseTo(MAIL_GIVEUP_S, 0);
    expect(sim.summarize(P0 + 100, P0 + 120).mail.lost).toBeGreaterThan(5);
  });
  it("Nachfrage am Mailversand: synchron was jetzt ankommt, mit Puffer der Zufluss geglättet (EMA, τ = MAIL_SMOOTH_TAU_S)", () => {
    for (const r of spitzenRunsMemo().slice(0, 10)) {
      const m0 = r[0].snap.stations.mail;
      expect(m0.demand).toBe(m0.demandNow);
      expect(m0.demandNow).toBeGreaterThan(0.95 * SPITZEN_PEAK);
      const m1 = r[1].snap.stations.mail;
      expect(m1.demandNow).toBeGreaterThan(0.95 * SPITZEN_PEAK);
      expect(m1.demand).toBeGreaterThan(SPITZEN_AVG - 2);
      expect(m1.demand).toBeLessThan(0.9 * MAIL_CAP);
    }
    // EMA nachgerechnet: Sprung von 20 auf 60 Checkouts/s ab P0
    const sim = run(P0 + 25);
    let ema = SPITZEN_BASE;
    const k = 1 - Math.exp(-DT / MAIL_SMOOTH_TAU_S);
    const w = (SCENARIOS.spitzen as any).waves;
    // Ankünfte am Mailversand = Zahlungen, ≈ Checkouts mit Verzug — grob
    for (let t = 0; t < P0 + 25 - 1e-9; t += DT)
      ema +=
        (SPITZEN_BASE + (SPITZEN_PEAK - SPITZEN_BASE) * waveShape(w, t) - ema) *
        k;
    expect(Math.abs(sim.mailDemEma - ema)).toBeLessThan(1.5);
  });
  it("synchron kommt und geht der Engpass mit den Wellen: Engpass-Zeit ≈ Anteil der Welle", () => {
    for (const r of spitzenRunsMemo().slice(0, 10)) {
      const f = r[0].full;
      expect(f.overShare.mail).toBeGreaterThan(0.12);
      expect(f.overShare.mail).toBeLessThan(0.4);
      // der einzige Engpass ist der Mailversand
      expect(Math.abs(f.engpassZeit - f.overShare.mail)).toBeLessThan(0.01);
      // knappste Station: alle vier zusammen die ganze Zeit; der
      // Mailversand länger als nur in der Überlast
      const kn = f.knappShare;
      expect(kn.web + kn.inv + kn.pay + kn.mail).toBeCloseTo(1, 6);
      expect(kn.mail).toBeGreaterThan(f.overShare.mail);
      expect(f.overShare.web + f.overShare.inv + f.overShare.pay).toBe(0);
    }
  });
  it("Kontrolle der eigenen Frage „mails“: jeder Ausgang ist erreichbar", () => {
    expect(ASK_KINDS.mails).toEqual([
      "sofort",
      "verspaetet",
      "verloren",
      "kasse",
    ]);
    expect(observeTip(run(P0 - 5), "mails")).toBe("sofort");
    // synchron nach einer Welle: die Kasse wartet auf die Mail
    expect(observeTip(run(P0 + PER + 25), "mails")).toBe("kasse");
    const r = spitzenRunsMemo()[4];
    expect(r[1].tip).toBe("verspaetet");
    expect(r[2].tip).toBe("verloren");
    // mit Puffer zwischen den Wellen, Rückstand abgebaut, aber im Fenster
    // noch die Welle: verspätet — erst eine ruhige Periode ist „sofort“
    expect(observeTip(run(P0 + PER - 5, { smoothing: true }), "mails")).toBe(
      "verspaetet",
    );
    expect(MAIL_TIP_WINDOW_S).toBe(SPITZEN_PERIOD_S);
  });
  it("Puffer aus mit vollem Puffer: Der Rest geht im Hintergrund raus oder verfällt — er hält keine Threads und keine Kunden auf", () => {
    const sim = new BottleneckSim(SEEDS50[1]!, "spitzen");
    sim.runTo(150);
    sim.set({ smoothing: true });
    sim.runTo(200);
    sim.trigger("dauerlast");
    sim.runTo(260);
    const q0 = sim.mq;
    expect(q0).toBeGreaterThan(0.9 * MAIL_Q_EFF); // Puffer voll
    const lost0 = sim.stats.mailLost;
    sim.set({ smoothing: false });
    sim.runSteps(1);
    // nichts verworfen im Umschalten, keine Mail des Puffers wird synchron
    expect(sim.stats.mailLost - lost0).toBeLessThan(0.05 * q0);
    expect(sim.mq).toBeLessThan(5);
    expect(sim.mqBg).toBeGreaterThan(0.95 * q0);
    expect(sim.snapshot().stations.mail!.queue).toBeCloseTo(
      sim.mq + sim.mqBg,
      9,
    );
    const w = sim.snapshot().stations.web.threads!;
    expect(w.busy).toBeLessThan(0.05 * w.max);
    expect(sim.latC).toBeLessThan(1);
    // binnen MAIL_MAX_AGE_S raus oder verfallen
    sim.runTo(260 + MAIL_MAX_AGE_S + 1);
    expect(sim.mqBg).toBe(0);
    // wieder an: alles zurück in den Puffer
    sim.set({ smoothing: false });
    sim.set({ smoothing: true });
    sim.runSteps(1);
    expect(sim.mqBg).toBe(0);
  });
  it("Replay bitgenau mit Puffer und Dauerlast; Schalter und Dauerlast ziehen keine Zufallszahlen", () => {
    const sim = new BottleneckSim(4244, "spitzen");
    sim.runTo(150);
    sim.set({ smoothing: true });
    sim.advance(33.37);
    sim.trigger("dauerlast");
    sim.runTo(260);
    sim.set({ smoothing: false, scale: true });
    sim.runTo(300);
    const r = replay(sim.seed, sim.scenario, sim.log, sim.n, sim.overrides);
    expect(r.histAt(r.histLen - 1)).toEqual(sim.histAt(sim.histLen - 1));
    expect(r.stats).toEqual(sim.stats);
    expect(r.mq).toBe(sim.mq);
    // gleiche Umwelt wie ohne Eingriffe: OU-Zustände und Kapazität des
    // Mailversands je Probe
    const a = new BottleneckSim(4244, "spitzen");
    a.runTo(300);
    const caps: number[] = [];
    for (let i = 0; i < a.histLen; i++) {
      expect(sim.histAt(i).env).toEqual(a.histAt(i).env);
      expect(sim.histAt(i).mailCap).toBe(a.histAt(i).mailCap);
      caps.push(a.histAt(i).mailCap);
    }
    expect(sim.zM).toBe(a.zM);
    // der Mailversand schwankt wie die anderen Stationen (σ 3 %)
    expect(Math.max(...caps) - Math.min(...caps)).toBeGreaterThan(1);
    expect(Math.max(...caps)).toBeLessThan(1.15 * MAIL_CAP);
    expect(Math.min(...caps)).toBeGreaterThan(0.85 * MAIL_CAP);
  });
  it("ohne Mailversand unverändert: keine vierte Station, smoothing wirkungslos, Dauerlast nur mit Wellen", () => {
    expect(stationsOf("rabatt")).toEqual(STATIONS_M);
    const a = new BottleneckSim(SEEDS50[2]!, "rabatt");
    const b = new BottleneckSim(SEEDS50[2]!, "rabatt");
    a.runTo(200);
    b.runTo(100);
    b.set({ smoothing: true });
    b.runTo(200);
    const sa = a.snapshot();
    expect(Object.keys(sa.overloaded)).toEqual([...STATIONS_M]);
    expect(Object.keys(sa.stations)).toEqual([...STATIONS_M]);
    expect(a.stations).toEqual(STATIONS_M);
    for (let i = 0; i < a.histLen; i++) {
      const { marks: _ma, c: ca, ...ha } = a.histAt(i);
      const { marks: _mb, c: cb, ...hb } = b.histAt(i);
      expect(hb).toEqual(ha);
      expect(cb).toEqual(ca);
    }
    expect(a.stats.mailIn + a.stats.mailSent + a.stats.mailLost).toBe(0);
    expect(() => a.trigger("dauerlast")).toThrow(/Wellen/);
    expect((CM_DEFAULTS as Record<string, unknown>).smoothing).toBe(false);
  });
});

describe("Drehbuch Bot-Ansturm (ein Live-Lauf je Seed, 50 Seeds)", () => {
  const steps: any[] = SCRIPTS.bots;
  const sc: any = SCENARIOS.bots;
  it("SCRIPTS.bots entspricht der Drehbuch-Tabelle (wörtlich, Rate Limit statt Shedding, IO-Schub als Ereignis)", () => {
    expect(steps.map((s) => s.key)).toEqual(PLAN_BOTS.map((p) => p.key));
    steps.forEach((s, i) => {
      const p = PLAN_BOTS[i]!;
      expect(s.action).toEqual(p.action);
      expect(s.event).toBe(p.event);
      expect(s.expect).toBe(p.expect);
      expect(s.overload).toEqual(p.overload);
      expect(s.ask).toBe(p.ask);
      expect(s.answer).toBe(p.answer);
      if (s.ask)
        expect((ASK_KINDS as Record<string, string[]>)[s.ask]).toContain(
          s.answer,
        );
    });
    // Szenario: Kunden konstant ohne Funnel, der Bot ab dem Vorlauf
    expect(sc.variant).toBe("remedies");
    expect(sc.tempo).toBe(20);
    expect(sc.windowS).toBe(600);
    expect(sc.prerollS).toBe(BOT_START_S);
    expect(sc.load).toEqual([[0, BOTS_LOAD]]);
    expect(sc.bot).toEqual([
      [0, 0],
      [BOT_START_S, BOT_RATE],
    ]);
    expect(sc.conv).toBe(0);
    expect(sc.cFix).toBe(BOTS_CHECKOUTS);
    expect(sc.nWeb).toBe(N_WEB_BOTS);
    expect(sc.scaleTarget).toBe(SCALE_TARGET_BOTS);
    expect(stationsOf("bots")).toEqual(STATIONS_M);
    for (const k of ["rateLimit", "admission", "shedBrowse", "bpInv"])
      expect(sc.rail).toContain(k);
    // Kopfrechnen: Die Webserver tragen Kunden und Bot; die DB trägt die
    // Kunden allein, mit dem Bot nicht einmal die Hälfte — und im IO-Schub
    // nicht einmal die Kunden
    expect(BOTS_TOTAL).toBe(BOTS_LOAD + BOT_RATE);
    expect(BOTS_PAGES).toBe(BOTS_LOAD - BOTS_CHECKOUTS);
    expect(WEB_CAP_BOTS).toBeGreaterThan(1.3 * BOTS_TOTAL);
    expect(BOTS_CUST_E).toBeCloseTo(
      BOTS_PAGES * INV_PAGE_E + BOTS_CHECKOUTS * INV_RESERVE_E,
      9,
    );
    expect(BOTS_DB_E).toBeCloseTo(BOTS_CUST_E + BOT_RATE * INV_PAGE_E, 9);
    expect(BOTS_CUST_E).toBeLessThan(0.85 * INV_CAP_E);
    expect(BOTS_DB_E).toBeGreaterThan(2 * INV_CAP_E);
    expect(BOTS_CUST_E).toBeGreaterThan(1.3 * INV_CAP_IO_E);
    expect(BOTS_CHECKOUTS).toBeLessThan(0.5 * PAY_CAP);
    // Das statische Limit bremst mit Rate Limit niemanden — und passt im
    // IO-Schub nicht mehr zur DB
    expect(ADMISSION_RPS).toBe(INV_PAGES_PER_S);
    expect(ADMISSION_RPS).toBeGreaterThan(1.1 * (BOTS_LOAD + RL_RATE));
    expect(ADMISSION_RPS).toBeGreaterThan(1.5 * INV_PAGES_PER_S_IO);
    expect(BOT_429).toBe(BOT_RATE - RL_RATE);
    // Load Shedding: dasselbe Ziel am Rand und in der DB; über dem Ziel
    // wächst der abgewiesene Anteil über SHED_DB_BAND_S auf 100 %
    expect(SHED_DB_S).toBe(SHED_TARGET_S);
    expect(SHED_DB_S + SHED_DB_BAND_S).toBeLessThan(COLLAPSE_WAIT_S);
    // Rate Limit: 2 s Vorrat, ein Kunde liegt weit darunter
    expect(RL_BURST).toBe(2 * RL_RATE);
    expect(RL_RATE).toBeLessThan(BOT_RATE / 20);
    // Auflösung mitten im eigenen IO-Schub (Schritte 3 und 4)
    for (const i of [3, 4]) {
      expect(steps[i].event).toBe("ioSchub");
      expect(steps[i].settle).toBeLessThanOrEqual(IO_BURST_S - 5);
      expect(steps[i].settle).toBeGreaterThanOrEqual(30);
    }
  });
  it.each(PLAN_BOTS.map((p, i) => [i, p.key, p.bn]))(
    "Stufe %i (%s): „%s“, Überlastvektor und Antwort der eigenen Frage bei appliedAt + settle in 50/50 Seeds",
    SLOW,
    (i) => {
      const plan = PLAN_BOTS[i as number]!;
      const misses: string[] = [];
      for (const run of botsRunsMemo()) {
        const st = run[i as number];
        const vecOk =
          Object.keys(st.overload).length === 3 &&
          STATIONS.every((s) => st.overload[s] === plan.overload[s]);
        const tipOk = plan.ask ? st.tip === plan.answer : st.tip === null;
        if (st.bottleneck !== plan.bn || !vecOk || !tipOk)
          misses.push(
            `${st.bottleneck} ${JSON.stringify(st.overload)} tip=${st.tip}`,
          );
        expect(st.snap.t).toBeCloseTo(
          st.appliedAt + steps[i as number].settle,
          9,
        );
      }
      expect(misses).toEqual([]);
    },
  );
  it("„bleibt“ löst sich zur Station des vorigen Schritts auf; jeder Schritt beginnt, wo der vorige aufgelöst hat", () => {
    const run = botsRunsMemo()[0];
    expect(run.map((s: any) => s.expect)).toEqual(PLAN_BOTS.map((p) => p.bn));
    expect(run[0].appliedAt).toBe(BOT_START_S);
    for (let i = 1; i < run.length; i++)
      expect(run[i].appliedAt).toBeCloseTo(
        run[i - 1].appliedAt + steps[i - 1].settle,
        9,
      );
  });
  it("Marge bei der Auflösung: DB deutlich überlastet, Rest mit Reserve; Wartezeit und Antworten klar auf ihrer Seite der Schwelle", () => {
    for (const run of botsRunsMemo()) {
      const [s0, s1, s2, s3, s4] = run.map((r: any) => r.snap.stations);
      for (const st of [s0, s1, s2, s3, s4]) {
        expect(st.inv.reserve).toBeLessThan(-0.5);
        expect(st.web.reserve).toBeGreaterThan(0.3);
        expect(st.pay.reserve).toBeGreaterThan(1);
      }
      // kollabiert: lange Wartezeit; abgefangen: deutlich unter der Grenze
      expect(s0.inv.wait).toBeGreaterThan(5 * COLLAPSE_WAIT_S);
      expect(s1.inv.wait).toBeLessThan(0.6 * COLLAPSE_WAIT_S);
      expect(s2.inv.wait).toBeLessThan(0.1 * COLLAPSE_WAIT_S);
      expect(s3.inv.wait).toBeGreaterThan(5 * COLLAPSE_WAIT_S);
      expect(s4.inv.wait).toBeLessThanOrEqual(DB_PERMIT_S + 0.01);
      // eigene Fragen, gemessen über die letzten 20 s
      const [, k1, k2, k3, k4] = run.map((r: any) => r.sum);
      const share = (x: number, n: number) => x / Math.max(1e-9, n);
      expect(
        share(k1.customers.rejected, k1.customers.arrivals),
      ).toBeGreaterThan(5 * WEN_SHARE);
      expect(share(k1.bot.rejected, k1.bot.arrivals)).toBeGreaterThan(
        5 * WEN_SHARE,
      );
      expect(share(k2.customers.rejected, k2.customers.arrivals)).toBeLessThan(
        WEN_SHARE / 10,
      );
      expect(share(k2.bot.rejected, k2.bot.arrivals)).toBeGreaterThan(0.9);
      expect(share(k3.customers.okB, k3.customers.arrivalsB)).toBeLessThan(
        TIP_PART_SHARE / 2,
      );
      expect(k3.customers.lostB).toBeGreaterThan(5 * k3.customers.rejectedB);
      const ok4 = share(k4.customers.okB, k4.customers.arrivalsB);
      expect(ok4).toBeGreaterThan(TIP_PART_SHARE + 0.15);
      expect(ok4).toBeLessThan(TIP_OK_SHARE - 0.05);
      expect(k4.customers.rejectedB).toBeGreaterThan(10 * k4.customers.lostB);
    }
  });
  it("zitierfähige Kennzahlen (SCRIPT_FIGURES.bots) stimmen im Mittel über 50 Seeds", () => {
    const runs = botsRunsMemo();
    const figs: any[] = SCRIPT_FIGURES.bots;
    expect(figs.map((f) => f.key)).toEqual(PLAN_BOTS.map((p) => p.key));
    figs.forEach((fig, i) => {
      const m = (f: (r: any) => number) => mean(runs.map((r) => f(r[i])));
      const near = (v: number, ref: number, what: string) =>
        expect(Math.abs(v - ref), `${fig.key}.${what}`).toBeLessThanOrEqual(
          Math.max(2, 0.06 * ref),
        );
      expect(runs[0][i].sum.dur).toBe(20);
      near(
        m((r) => r.sum.okBrowse),
        fig.pages,
        "pages",
      );
      near(
        m((r) => r.sum.okCheckout),
        fig.orders,
        "orders",
      );
      near(
        m((r) => r.sum.rejected),
        fig.rejected,
        "rejected",
      );
      near(
        m((r) => r.sum.lost),
        fig.lost,
        "lost",
      );
      near(
        m((r) => r.sum.customers.okB),
        fig.custPages,
        "custPages",
      );
      near(
        m((r) => r.sum.customers.rejected),
        fig.custRej,
        "custRej",
      );
      near(
        m((r) => r.sum.bot.ok),
        fig.botOk,
        "botOk",
      );
      near(
        m((r) => r.sum.bot.rejected),
        fig.botRej,
        "botRej",
      );
    });
  });
  it(
    "verzögerte Züge (▶ in der Auflösung): Station, Überlastvektor und Antworten bleiben",
    SLOW,
    () => {
      const bad: string[] = [];
      for (const seed of SEEDS10.slice(0, 2))
        for (const d of [17, 61, 150])
          for (let k = 1; k < steps.length; k++) {
            const sim = new BottleneckSim(seed, "bots");
            sim.runTo(sc.prerollS);
            let prev: string | null = null;
            steps.forEach((st: any, i: number) => {
              if (i === k) sim.runTo(sim.t + d);
              if (Object.keys(st.action).length) sim.set(st.action);
              const at = sim.t;
              if (st.event) sim.trigger(st.event, at);
              sim.runTo(at + st.settle);
              const exp = st.expect === "bleibt" ? prev : st.expect;
              prev = exp;
              const tip = st.ask ? observeTip(sim, st.ask) : null;
              const ov = sim.ov as Record<string, string>;
              if (
                sim.bottleneck !== exp ||
                STATIONS.some((s) => ov[s] !== st.overload[s]) ||
                (st.ask && tip !== st.answer)
              )
                bad.push(
                  `${seed} +${d} vor ${k}: ${st.key} ${sim.bottleneck} ${JSON.stringify(ov)} ${tip}`,
                );
            });
          }
      expect(bad).toEqual([]);
    },
  );
});

describe("Zufluss bremsen: Bot, Rate Limit, Admission, IO-Schub (bots)", () => {
  const T1 = BOT_START_S + 2 * LOAD_RAMP_S; // Bot voll da
  /** Lauf im Szenario bots bis t, optional mit Schaltern von Anfang an und
   * IO-Schub ab tIo. */
  const run = (
    t: number,
    cm: Record<string, unknown> = {},
    tIo: number | null = null,
    seed = SEEDS50[3]!,
    overrides: Record<string, unknown> = {},
  ) => {
    const sim = new BottleneckSim(seed, "bots", { cm, ...overrides });
    if (tIo !== null) {
      sim.runTo(tIo);
      sim.trigger("ioSchub");
    }
    sim.runTo(t);
    return sim;
  };
  it("Bot: dritte Klasse, EIN Client — Produktseiten wie die Kunden (gleiche DB-Arbeit), ohne Rauschen, nicht im Funnel", () => {
    const sim = run(T1 + 20);
    const s = sim.snapshot();
    expect(s.load.bot).toBe(BOT_RATE);
    expect(s.load.nominal).toBe(BOTS_TOTAL);
    expect(s.load.browse + s.load.checkout).toBeCloseTo(s.load.total, 9);
    // ohne Rauschen: jede volle Sekunde genau BOT_RATE Bot-Anfragen
    for (let i = sim.histLen - 15; i < sim.histLen; i++)
      expect(sim.histAt(i).botIn).toBeCloseTo(BOT_RATE, 6);
    // vor dem Bot: keine Bot-Zähler
    expect(sim.summarize(0, BOT_START_S - 1).bot.arrivals).toBe(0);
    // DB-Arbeit: Bot-Seiten wie Kundenseiten (INV_PAGE_E), Anteil an der
    // Nachfrage = 500 · 1,5 / 1.115 ≈ 67 %
    expect(s.stations.inv.costPage).toBe(INV_PAGE_E);
    expect(s.stations.inv.botShare).toBeGreaterThan(0.62);
    expect(s.stations.inv.botShare).toBeLessThan(0.72);
    expect(s.stations.inv.demandE / BOTS_DB_E).toBeGreaterThan(0.95);
    expect(s.stations.inv.demandE / BOTS_DB_E).toBeLessThan(1.05);
    // Bots kaufen nicht: mit Funnel (10 %) folgen die Checkouts nur den
    // Kundenseiten — Feature Shedding, damit alle Seiten rechtzeitig kommen
    const fun = run(T1 + 120, { featureShed: true }, null, SEEDS50[3]!, {
      conv: CONV,
      cFix: 0,
    });
    const fs = fun.snapshot();
    const custPages = fs.load.browse - fs.load.bot;
    expect(fs.load.checkout).toBeGreaterThan(0.9 * CONV * custPages);
    expect(fs.load.checkout).toBeLessThan(1.1 * CONV * custPages);
    expect(fs.load.checkout).toBeLessThan(0.5 * CONV * fs.load.browse);
  });
  it("Rate Limit: Token Bucket je Client — der Bot bekommt RL_RATE/s (nach dem Vorrat RL_BURST), Kunden nichts ab; 429 ohne Arbeit", () => {
    const sim = run(T1 + 30, { rateLimit: true });
    const m = sim.summarize(T1 + 10, T1 + 30);
    expect(m.bot.r429).toBeCloseTo(BOT_RATE - RL_RATE, 6);
    expect(m.r429).toBeCloseTo(m.bot.r429, 9); // jedes 429 trifft den Bot
    expect(m.bot.ok + m.bot.lost).toBeCloseTo(RL_RATE, 1);
    expect(m.customers.rejected).toBe(0);
    expect(m.customers.okB).toBeGreaterThan(0.98 * m.customers.arrivalsB);
    expect(m.r429B).toBeCloseTo(m.r429, 9);
    expect(m.r429C).toBe(0);
    // Vorrat: Beim Einschalten ist der Eimer voll — der erste Schritt lässt
    // RL_BURST durch, danach RL_RATE · DT je Schritt
    const b = run(T1 + 5);
    const c0 = { ...b.c };
    b.set({ rateLimit: true });
    b.runSteps(2 * STEPS_PER_S);
    const passed = b.c.arrBot - c0.arrBot - (b.c.r429 - c0.r429);
    expect(passed).toBeCloseTo(RL_BURST + 2 * RL_RATE - RL_RATE * DT, 6);
  });
  it("Rate Limit senkt die Nachfrage nicht: Reserve der DB gleich, nur die Arbeit sinkt — der Engpass bleibt, abgefangen", () => {
    const a = run(T1 + 40);
    const b = run(T1 + 40, { rateLimit: true });
    const sa = a.snapshot().stations.inv;
    const sb = b.snapshot().stations.inv;
    expect(sb.demandE).toBe(sa.demandE);
    expect(b.resI).toBe(a.resI);
    expect(b.bottleneck).toBe("inv");
    expect((b.ov as Record<string, string>).inv).toBe("abgefangen");
    expect((a.ov as Record<string, string>).inv).toBe("kollabiert");
    const ua = a.summarize(T1 + 20, T1 + 40).util.inv;
    const ub = b.summarize(T1 + 20, T1 + 40).util.inv;
    expect(ua).toBeGreaterThan(0.99);
    expect(ub).toBeLessThan(0.9);
    expect(ub).toBeGreaterThan(0.75);
  });
  it("Admission: global und statisch — ADMISSION_RPS über alle Klassen, anteilig (503); ohne Rate Limit trifft es Kunden wie Bot", () => {
    const sim = run(T1 + 40, { admission: true });
    const m = sim.summarize(T1 + 20, T1 + 40);
    // durchgelassen ≈ ADMISSION_RPS, der Rest 503 (in r503)
    expect(m.load - m.admission).toBeCloseTo(ADMISSION_RPS, 0);
    expect(m.r503).toBeGreaterThanOrEqual(m.admission - 1e-9);
    const frac = 1 - ADMISSION_RPS / m.load;
    const kB = m.customers.rejectedB / Math.max(1e-9, m.customers.arrivalsB);
    const bB = m.bot.rejected / Math.max(1e-9, m.bot.arrivals);
    const kC = m.rejectedC / Math.max(1e-9, m.arrivals.checkout);
    for (const x of [kB, bB, kC]) expect(Math.abs(x - frac)).toBeLessThan(0.02);
    expect(observeTip(sim, "wen")).toBe("beide");
    // auch ohne Bot: die Rabattaktion bremst es auf ADMISSION_RPS — dort
    // trifft es nur Kunden
    const r = new BottleneckSim(SEEDS50[3]!, "rabatt", {
      cm: { admission: true },
    });
    r.runTo(200);
    expect(r.summarize(180, 200).admission).toBeGreaterThan(500);
    expect(observeTip(r, "wen")).toBe("kunden");
  });
  it("statische Admission versagt beim IO-Schub: Mit Rate Limit lässt sie alle Kunden durch — mehr, als die DB im Schub schafft; Load Shedding und Back Pressure folgen dem Zustand", () => {
    const tIo = T1 + 30;
    const mk = (cm: Record<string, unknown>) =>
      run(tIo + 30, { rateLimit: true, ...cm }, tIo);
    const adm = mk({ admission: true });
    const ma = adm.summarize(tIo + 10, tIo + 30);
    expect(ma.admission).toBe(0); // das Limit greift gar nicht
    expect((adm.ov as Record<string, string>).inv).toBe("kollabiert");
    expect(adm.snapshot().stations.inv.wait).toBeGreaterThan(
      5 * COLLAPSE_WAIT_S,
    );
    expect(ma.customers.okB).toBeLessThan(0.1 * ma.customers.arrivalsB);
    // ohne IO-Schub hätte es gereicht
    const calm = run(tIo + 30, { rateLimit: true, admission: true });
    expect((calm.ov as Record<string, string>).inv).toBe("abgefangen");
    // Shedding (Wartezeit der DB) und Back Pressure (Permits) fangen ab
    for (const cm of [{ shedBrowse: true }, { bpInv: true }]) {
      const s = mk({ admission: true, ...cm });
      expect((s.ov as Record<string, string>).inv, JSON.stringify(cm)).toBe(
        "abgefangen",
      );
      const m = s.summarize(tIo + 15, tIo + 30);
      // DB voll ausgelastet mit dem, was sie im Schub schafft
      expect(m.util.inv).toBeGreaterThan(0.97);
      expect(m.customers.okB).toBeGreaterThan(0.45 * m.customers.arrivalsB);
    }
  });
  it("Load Shedding reagiert auf den Zustand des Servers — ohne Back Pressure auf die Wartezeit der DB; wen es trifft, sieht es nicht", () => {
    for (const r of botsRunsMemo().slice(0, 10)) {
      const st = r[1];
      const m = st.sum;
      const kB = m.customers.rejectedB / m.customers.arrivalsB;
      const bB = m.bot.rejected / m.bot.arrivals;
      expect(Math.abs(kB - bB)).toBeLessThan(0.02); // Kunden wie Bot
      expect(kB).toBeGreaterThan(0.5);
      expect(m.rejectedC).toBeLessThan(0.5); // Checkouts mit Vorrang
      const w = st.snap.stations.inv.wait;
      expect(w).toBeGreaterThan(SHED_DB_S);
      expect(w).toBeLessThan(SHED_DB_S + SHED_DB_BAND_S);
      expect(m.okBrowse).toBeGreaterThan(0.9 * (m.okBrowse + m.lost - m.lostC));
    }
    // mit Back Pressure ruht der DB-Teil: In der Rabattaktion (Schritte
    // 3–5, BP an der DB) lassen die Permits höchstens DB_PERMIT_S Arbeit
    // in die DB — weniger, als sie in einem Schritt schafft. Nach jedem
    // Schritt ist sie leer, der DB-Teil (ab SHED_DB_S) kann nie greifen:
    // das Shedding dort ist unverändert
    for (const seed of SEEDS10.slice(0, 3)) {
      const sim = new BottleneckSim(seed, "rabatt");
      const sts: any[] = SCRIPTS.rabatt;
      sim.runTo(SCENARIOS.rabatt.prerollS);
      let maxW = 0;
      sts.forEach((st: any, i: number) => {
        if (Object.keys(st.action).length) sim.set(st.action);
        const t1 = sim.t + st.settle;
        while (sim.t < t1 - 1e-9) {
          sim.runSteps(1);
          if (i >= 3) maxW = Math.max(maxW, sim._waitInv());
        }
      });
      expect(DB_PERMIT_S).toBeLessThanOrEqual(DT);
      expect(maxW).toBeLessThan(1e-9);
      expect(maxW).toBeLessThan(SHED_DB_S);
    }
  });
  it("IO-Schub (trigger „ioSchub“): Disk-await × IO_BURST_AWAIT für IO_BURST_S, DB-Kapazität × 1 / (0,25 + 0,75 · 2); Eigener Host hebt ihn auf", () => {
    expect(IO_BURST_S).toBe(NB_PHASE_MAX_S);
    expect(IO_BURST_AWAIT).toBe(NB_AWAIT_MAX);
    expect(INV_CAP_IO_E).toBeCloseTo(
      INV_CAP_E / (1 - DB_IO_SHARE + DB_IO_SHARE * NB_AWAIT_MAX),
      9,
    );
    expect(INV_PAGES_PER_S_IO).toBe(Math.round(INV_CAP_IO_E / INV_PAGE_E));
    const t0 = 100;
    const sim = run(t0 + 20, {}, t0);
    let s = sim.snapshot();
    expect(s.stations.inv.ioBurst).toBe(true);
    expect(s.stations.inv.awaitMult).toBeGreaterThan(0.99 * IO_BURST_AWAIT);
    expect(s.stations.inv.capFactor).toBeCloseTo(
      1 / (1 - DB_IO_SHARE + DB_IO_SHARE * s.stations.inv.awaitMult),
      9,
    );
    expect(s.hidden.phase).toBe("io");
    expect(s.hidden.forced).toBe(true);
    expect(s.hosts.db.awaitMs).toBeCloseTo(
      DB_AWAIT_BASE_MS * s.stations.inv.awaitMult,
      9,
    );
    const h = sim.histAt(sim.histLen - 1);
    expect(h.io).toBe(true);
    expect(h.invPages).toBeLessThan(1.1 * INV_PAGES_PER_S_IO);
    sim.runTo(t0 + IO_BURST_S - 0.1);
    expect(sim.ioNow).toBe(true);
    sim.runTo(t0 + IO_BURST_S + 0.1);
    expect(sim.ioNow).toBe(false);
    sim.runTo(t0 + IO_BURST_S + 20);
    s = sim.snapshot();
    expect(s.stations.inv.ioBurst).toBe(false);
    expect(s.stations.inv.awaitMult).toBeLessThan(1.01);
    expect(sim.summarize(t0, t0 + IO_BURST_S).ioShare).toBeCloseTo(1, 6);
    // überlappende Schübe verlängern sich
    const o = run(t0 + 30, {}, t0);
    o.trigger("ioSchub");
    o.runTo(t0 + 30 + IO_BURST_S - 0.1);
    expect(o.ioNow).toBe(true);
    // geplante Schübe bleiben: einer jetzt, einer später — beide wirken
    const g = run(t0 - 10);
    g.trigger("ioSchub", t0 + 100);
    g.trigger("ioSchub");
    g.runTo(t0);
    expect(g.ioNow).toBe(true);
    g.runTo(t0 + 60);
    expect(g.ioNow).toBe(false);
    g.runTo(t0 + 110);
    expect(g.ioNow).toBe(true);
    // Eigener Host: der Schub läuft (hidden), wirkt aber nicht
    const iso = run(t0 + 20, { isolate: true }, t0);
    expect(iso.snapshot().hidden.phase).toBe("io");
    expect(iso.snapshot().stations.inv.awaitMult).toBe(1);
    // unbekannte Ereignisse bleiben verboten
    expect(() => sim.trigger("ioschub")).toThrow(/unbekanntes Ereignis/);
  });
  it("Back Pressure folgt der echten Kapazität: im IO-Schub DB voll, Wartezeit ≤ DB_PERMIT_S — Kunden teils sofort 503 statt Fehler nach Warten", () => {
    for (const r of botsRunsMemo().slice(0, 10)) {
      const m = r[4].sum;
      expect(m.util.inv).toBeGreaterThan(0.98);
      expect(m.ioShare).toBeCloseTo(1, 6);
      // was die DB im Schub für Seiten übrig hat: Kapazität − Checkouts −
      // Bot (Rate Limit), anteilig auf die Kundenseiten
      const room = (INV_CAP_IO_E - BOTS_CHECKOUTS * INV_RESERVE_E) / INV_PAGE_E;
      const custShare = BOTS_PAGES / (BOTS_PAGES + RL_RATE);
      expect(m.customers.okB / (room * custShare)).toBeGreaterThan(0.85);
      expect(m.customers.okB / (room * custShare)).toBeLessThan(1.15);
      expect(m.customers.lost).toBeLessThan(2);
      expect(r[4].snap.stations.web.queueMax).not.toBeNull(); // begrenzte Queue
    }
  });
  it("Tail-Drop der begrenzten Eingangs-Queue trifft Bot und Kunden anteilig (gemischte FIFO-Queue)", () => {
    const sim = new BottleneckSim(SEEDS50[1]!, "bots");
    sim.runTo(BOT_START_S + 30);
    sim.set({ bpInv: true }); // ohne Rate Limit: der Bot steht mit in der Queue
    sim.runTo(BOT_START_S + 70);
    const s = sim.summarize(sim.t - 20, sim.t);
    expect(s.r503B).toBeGreaterThan(0.3 * BOT_RATE);
    const bot = s.bot.rejected / s.bot.arrivals;
    const kunden = s.customers.rejectedB / s.customers.arrivalsB;
    expect(bot).toBeGreaterThan(0.3);
    expect(Math.abs(bot - kunden)).toBeLessThan(0.05);
  });
  it("Klassenzähler: Bot + Kunden = Summen (Ankünfte, rechtzeitig, abgewiesen, verloren); jedes 429 trifft den Bot", () => {
    const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
    for (const run of botsRunsMemo().slice(0, 10)) {
      for (const st of run) {
        const s = st.sum;
        close(s.customers.arrivals + s.bot.arrivals, s.load);
        close(s.customers.ok + s.bot.ok, s.okBrowse + s.okCheckout);
        close(s.customers.okB + s.bot.ok, s.okBrowse);
        close(s.customers.rejected + s.bot.rejected, s.rejected);
        close(s.customers.lost + s.bot.lost, s.lost);
        close(s.bot.r429, s.r429);
        const o = st.snap.outcome;
        expect(o.okBot).toBeLessThanOrEqual(o.okBrowse + 1e-9);
        expect(o.rejectedBot).toBeLessThanOrEqual(o.rejectedB + 1e-9);
      }
      // Eingangs-Queue gemischt: Was dort aufgegeben wird oder zu spät
      // kommt (Schritt 0), trifft den Bot nach seinem Anteil an den Seiten
      const s0 = run[0].sum;
      const botShare = BOT_RATE / (BOT_RATE + BOTS_PAGES);
      const lostShare = s0.bot.lost / (s0.bot.lost + s0.customers.lostB);
      expect(Math.abs(lostShare - botShare)).toBeLessThan(0.03);
      expect(s0.abandonedB).toBeGreaterThan(50); // es wird aufgegeben
    }
  });
  it("Kontrolle der eigenen Fragen „wen“ und „seiten“: jeder Ausgang ist erreichbar", () => {
    expect(ASK_KINDS.wen).toEqual(["bot", "beide", "kunden", "keiner"]);
    expect(ASK_KINDS.seiten).toEqual([
      "laden",
      "teils",
      "abgewiesen",
      "warten",
    ]);
    const before = run(BOT_START_S - 2);
    expect(observeTip(before, "wen")).toBe("keiner");
    expect(observeTip(before, "seiten")).toBe("laden");
    const r = botsRunsMemo()[5];
    expect(r.map((s: any) => s.tip)).toEqual([
      null,
      "beide",
      "bot",
      "warten",
      "teils",
    ]);
    // ohne Rate Limit, mit Back Pressure im IO-Schub: fast alle sofort 503
    const ab = run(T1 + 60, { bpInv: true }, T1 + 30);
    expect(observeTip(ab, "seiten")).toBe("abgewiesen");
    // „kunden“: Admission ohne Bot (siehe oben, Rabattaktion)
    expect(WEN_SHARE).toBeLessThan(0.1);
    expect(TIP_PART_SHARE).toBeLessThan(TIP_OK_SHARE);
  });
  it("Replay bitgenau mit Rate Limit, Admission, Shedding und IO-Schüben; Schalter und Schübe ziehen keine Zufallszahlen", () => {
    const sim = new BottleneckSim(4247, "bots");
    sim.runTo(70);
    sim.set({ shedBrowse: true });
    sim.advance(21.37);
    sim.set({ rateLimit: true, shedBrowse: false });
    sim.runTo(130);
    sim.set({ admission: true });
    sim.trigger("ioSchub");
    sim.advance(17.7);
    sim.set({ bpInv: true, rateLimit: false });
    sim.trigger("ioSchub");
    sim.runTo(220);
    const r = replay(sim.seed, sim.scenario, sim.log, sim.n, sim.overrides);
    expect(r.histAt(r.histLen - 1)).toEqual(sim.histAt(sim.histLen - 1));
    expect(r.stats).toEqual(sim.stats);
    expect(r.ebBot).toBe(sim.ebBot);
    const a = new BottleneckSim(4247, "bots");
    a.runTo(220);
    for (let i = 0; i < a.histLen; i++)
      expect(sim.histAt(i).env).toEqual(a.histAt(i).env);
  });
  it("ohne Bot unverändert: Rate Limit wirkungslos (Rabattaktion bitgleich), keine Bot-Zähler", () => {
    const a = new BottleneckSim(SEEDS50[2]!, "rabatt");
    const b = new BottleneckSim(SEEDS50[2]!, "rabatt");
    a.runTo(200);
    b.runTo(100);
    b.set({ rateLimit: true });
    b.runTo(200);
    for (let i = 0; i < a.histLen; i++) {
      const { marks: _ma, c: ca, ...ha } = a.histAt(i);
      const { marks: _mb, c: cb, ...hb } = b.histAt(i);
      expect(hb).toEqual(ha);
      expect(cb).toEqual(ca);
    }
    expect(a.stats.arrBot + a.stats.okBot + a.stats.r429).toBe(0);
    expect(a.snapshot().bots).toBeNull();
    expect((CM_DEFAULTS as Record<string, unknown>).rateLimit).toBe(false);
    expect((CM_DEFAULTS as Record<string, unknown>).admission).toBe(false);
  });
});

describe("Messgrößen je Klasse (B = Produktseite, C = Checkout)", () => {
  const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
  it("Klassenzähler summieren sich zu den Summenfeldern (summarize, Probe, Snapshot)", () => {
    for (const run of scriptRunsMemo().slice(0, 10)) {
      for (const st of run) {
        const s = st.sum;
        close(s.shedB + s.shedC, s.shed);
        close(s.r503B + s.r503C, s.r503);
        close(s.r429B + s.r429C, s.r429);
        close(s.rejectedB + s.rejectedC, s.rejected);
        close(s.lostB + s.lostC, s.lost);
        close(s.abandonedB + s.abandonedC, s.abandoned);
        close(s.wasteB + s.wasteC, s.waste);
        close(s.lostB, s.abandonedB + s.wasteB);
        const o = st.snap.outcome;
        close(o.rejectedB + o.rejectedC, o.rejected);
        close(o.lostB + o.lostC, o.lost);
        close(o.wasteB + o.wasteC, o.waste);
        close(o.shedB + o.r503B + o.r429B, o.rejectedB);
      }
    }
    const { sim } = playScript(SEEDS50[0]!, "rabatt", {
      steps: SCRIPTS.rabatt.slice(0, 1),
    });
    const h = sim.histAt(sim.histLen - 1);
    close(h.lostB + h.lostC, h.lost);
    close(h.wasteB + h.wasteC, h.waste);
    close(h.shedB + h.shedC, h.shed);
    close(h.r503B + h.r503C, h.r503);
  });
  it("Stufe 2: Tail-Drop trifft beide Klassen; Stufe 3: Shedding nur Produktseiten", () => {
    const runs = scriptRunsMemo();
    const m = (i: number, k: string) => mean(runs.map((r) => r[i].sum[k]));
    expect(m(2, "r503B")).toBeGreaterThan(600);
    expect(m(2, "r503C")).toBeGreaterThan(5); // Checkouts fliegen mit raus
    for (const r of runs) {
      expect(r[3].sum.shedB).toBeGreaterThan(600);
      expect(r[3].sum.rejectedC).toBeLessThan(0.01); // kein Checkout abgewiesen
    }
  });
  it("Stufe 4 verliert nur Checkouts (zu spät an der Kasse), Stufe 5 weist nur Checkouts ab", () => {
    for (const r of scriptRunsMemo()) {
      expect(r[4].sum.lostC).toBeGreaterThan(80);
      expect(r[4].sum.lostB).toBeLessThan(2);
      expect(r[5].sum.shedC).toBeGreaterThan(14);
      expect(r[5].sum.shedC).toBeLessThan(28);
      expect(r[5].sum.rejectedB).toBeLessThan(0.01);
      expect(r[5].sum.lostC).toBeLessThan(2);
    }
  });
});

describe("Nachfrage je Station (Engpass-Semantik)", () => {
  it(
    "Nachfrage ≥ Durchsatz an jeder Station, in jedem Schritt aller Drehbücher",
    SLOW,
    () => {
      const bad: string[] = [];
      const empf = new Set(empfRunsMemo());
      for (const run of [
        ...scriptRunsMemo(),
        ...teuerRunsMemo(),
        ...empf,
        ...spitzenRunsMemo(),
      ]) {
        for (const st of run) {
          // ganzer Schritt (mit Übergängen) und die 20 s vor der Auflösung.
          // „empfehlung“ nur das Fenster vor der Auflösung: Nach dem Timeout
          // baut sich der Stau der Seiten ab (Durchsatz > Ankünfte für ≈ 10 s),
          // beim Hänger füllt sich der Pool erst — Abbau bzw. Aufbau, keine
          // Nachfrage.
          const sums = empf.has(run) ? [st.sum] : [st.sum, st.full];
          for (const s of sums) {
            for (const k of STATIONS) {
              // Toleranz 1 %: EMA-Verzug und Abbau kleiner Queues
              if (s.demand[k] < 0.99 * s.throughput[k] - 0.05)
                bad.push(
                  `${st.key} ${k}: ${s.demand[k].toFixed(2)} < ${s.throughput[k].toFixed(2)}`,
                );
            }
          }
        }
      }
      expect(bad).toEqual([]);
    },
  );
  it("Zahlung: mit shedBrowse passieren Checkouts die DB mit Vorrang — Nachfrage = Checkout-Ankünfte", () => {
    for (const run of scriptRunsMemo().slice(0, 10)) {
      const s3 = run[3].snap;
      // = Checkout-Ankünfte (± 1 %, was gerade ankommt, kann minimal mehr sein)
      expect(s3.stations.pay.demand).toBeGreaterThanOrEqual(s3.load.checkout);
      expect(s3.stations.pay.demand).toBeLessThan(1.01 * s3.load.checkout);
      // Reserve der Kasse ehrlich (≈ +150 %), nicht am Deckel +300 %
      expect(s3.stations.pay.reserve).toBeLessThan(2);
      expect(s3.stations.pay.reserve).toBeGreaterThan(1);
    }
  });
  it("Zahlung: auch abgewiesene Checkouts zählen zur Nachfrage — mit Vorrang am knappen Webserver", () => {
    // 150 Checkouts/s fest auf 2 Webservern (200 req/s), Kasse 70/s:
    // shedBrowse gibt Checkouts Vorrang, shedCheckout weist an der Kasse ab
    const sim = new BottleneckSim(SEEDS50[3]!, "rabatt", { cFix: 150 });
    sim.runTo(90);
    sim.set({ shedBrowse: true, shedCheckout: true });
    sim.runTo(150);
    const s = sim.snapshot();
    const passWeb = Math.min(s.load.checkout, s.stations.web.cap);
    expect(s.stations.pay.demand).toBeCloseTo(passWeb, 6);
    expect(s.stations.pay.demand).toBeGreaterThan(2 * PAY_CAP);
    const sum = sim.summarize(130, 150);
    expect(sum.throughput.pay).toBeLessThan(1.1 * PAY_CAP);
    expect(sum.shedC).toBeGreaterThan(50);
    expect(s.overloaded.pay).toBe("abgefangen");
  });
  it("Empfehlungen: Nachfrage zählt nur Produktseiten", () => {
    for (const run of scriptRunsMemo().slice(0, 10)) {
      for (const i of [1, 2, 3]) {
        const s = run[i].snap; // 12 Webserver: die Webserver begrenzen nicht
        expect(s.rec.demand).toBeCloseTo(s.load.browse, 6);
      }
      const s0 = run[0].snap; // 2 Webserver: anteilig gekappt
      expect(s0.rec.demand).toBeCloseTo(
        (s0.load.browse * s0.stations.web.cap) / s0.load.total,
        6,
      );
      expect(run[4].snap.rec.demand).toBe(0); // Empfehlungen aus
    }
  });
  it("Threads: die kollabierte Web-CPU belegt alle Threads, abgefangen fast keine", () => {
    for (const run of scriptRunsMemo().slice(0, 10)) {
      const th0 = run[0].snap.stations.web.threads;
      expect(th0.max).toBe(N_WEB_START * THREADS_PER_INSTANCE);
      expect(th0.busy).toBeCloseTo(th0.max, 6);
      const th2 = run[2].snap.stations.web.threads;
      expect(th2.busy).toBeGreaterThan(1);
      expect(th2.busy).toBeLessThan(0.05 * th2.max);
    }
  });
});

describe("Schutz und Vorrang: die Pfade einzeln", () => {
  it("Webserver nur per shedBrowse geschützt ⇒ „abgefangen“; Checkouts kommen mit Vorrang durch", () => {
    const seed = SEEDS50[1]!;
    const a = new BottleneckSim(seed, "rabatt");
    a.runTo(90); // Aktion läuft, 2 Webserver, ≈ 10 s Seiten-Rückstau
    a.set({ shedBrowse: true });
    a.runTo(150);
    // Vorrang beim Bearbeitungsstart: Checkouts überholen den Rückstau der
    // Produktseiten sofort (FIFO: ≈ 1,5 rechtzeitig, ≈ 5 verloren je s)
    const first = a.summarize(90, 100);
    expect(first.okCheckout).toBeGreaterThan(4);
    expect(first.lostC).toBeLessThan(3);
    const s = a.snapshot();
    expect(s.bottleneck).toBe("web");
    expect(s.overloaded).toEqual({ web: "abgefangen", inv: "ok", pay: "ok" });
    expect(s.stations.web.wait).toBeLessThanOrEqual(COLLAPSE_WAIT_S);
    const sum = a.summarize(130, 150);
    // Vorrang beim Bearbeitungsstart: jede Checkout-Anfrage wird bedient
    expect(sum.lostC).toBeLessThan(0.1);
    expect(sum.rejectedC).toBe(0);
    expect(sum.okCheckout).toBeGreaterThan(10);
    expect(sum.shedB).toBeGreaterThan(600);
    // Gegenprobe ohne shedBrowse: kollabiert
    const b = new BottleneckSim(seed, "rabatt");
    b.runTo(150);
    expect(b.snapshot().overloaded.web).toBe("kollabiert");
  });
  it("Kasse nur per shedCheckout geschützt ⇒ „abgefangen“", () => {
    const sim = new BottleneckSim(SEEDS50[2]!, "rabatt");
    sim.runTo(90);
    sim.set({ scale: true, scaleMode: "vorgewaermt", featureShed: true });
    sim.runTo(250);
    expect(sim.snapshot().overloaded).toEqual({
      web: "ok",
      inv: "ok",
      pay: "kollabiert",
    });
    sim.set({ shedCheckout: true });
    sim.runTo(310);
    const s = sim.snapshot();
    expect(s.bottleneck).toBe("pay");
    expect(s.overloaded.pay).toBe("abgefangen");
    expect(s.stations.pay.queueMax).toBeNull(); // ohne bpPay
    expect(sim.summarize(290, 310).shedC).toBeGreaterThan(10);
  });
  it("geschützt, aber die Wartezeit wächst ⇒ „kollabiert“: Checkouts allein überlasten die Webserver", () => {
    // 300 Checkouts/s fest auf 2 Webservern (200 req/s): Shedding trifft nur
    // Produktseiten, die Checkouts stauen sich trotz Schutz
    const sim = new BottleneckSim(SEEDS50[1]!, "rabatt", { cFix: 300 });
    sim.runTo(90);
    sim.set({ shedBrowse: true });
    sim.runTo(150);
    const s = sim.snapshot();
    expect(s.bottleneck).toBe("web");
    expect(s.stations.web.wait).toBeGreaterThan(COLLAPSE_WAIT_S);
    expect(s.overloaded.web).toBe("kollabiert");
    const sum = sim.summarize(130, 150);
    expect(sum.okCheckout).toBeLessThan(1);
    expect(sum.abandonedC).toBeGreaterThan(100);
  });
});

describe("Scaling: reaktiv vs. vorgewärmt (Tooltip-Zeiten aus Konstanten)", () => {
  // Zeit vom Klick bis Engpass = inv bzw. bis volle Nennkapazität
  function measure(seed: number, mode: string) {
    const sim = new BottleneckSim(seed, "rabatt");
    sim.runTo(120);
    sim.set({ scale: true, scaleMode: mode });
    const t0 = sim.t;
    let tInv: number | null = null;
    let tFull: number | null = null;
    while (sim.t < t0 + 200) {
      sim.runSteps(1);
      if (tInv === null && sim.bottleneck === "inv") tInv = sim.t - t0;
      // webNom gehört zum Schritt, der bei sim.t − DT begann
      if (
        tFull === null &&
        sim.webNom >= SCALE_TARGET * WEB_PER_INSTANCE - 1e-9
      ) {
        tFull = sim.t - DT - t0;
      }
    }
    return { tInv: tInv ?? Infinity, tFull: tFull ?? Infinity };
  }
  const seeds = SEEDS50.slice(0, 10);
  let res: {
    r: ReturnType<typeof measure>[];
    w: ReturnType<typeof measure>[];
  } | null = null;
  const memo = () =>
    (res ??= {
      r: seeds.map((s) => measure(s, "reaktiv")),
      w: seeds.map((s) => measure(s, "vorgewaermt")),
    });

  it("volle Kapazität genau nach SCALE_REACTIVE_S (reaktiv) bzw. SCALE_PREWARM_S", () => {
    const { r, w } = memo();
    for (const x of r) expect(x.tFull).toBeCloseTo(SCALE_REACTIVE_S, 6);
    for (const x of w) expect(x.tFull).toBeCloseTo(SCALE_PREWARM_S, 6);
  });
  it("reaktiv: neuer Engpass erst nach Erkennen + Kaltstart (≈ 99 s), vorgewärmt ≈ 15 s", () => {
    const { r, w } = memo();
    for (const x of r) {
      expect(x.tInv).toBeGreaterThanOrEqual(SCALE_DETECT_S + SCALE_COLD_S);
      expect(x.tInv).toBeLessThanOrEqual(SCALE_REACTIVE_S);
    }
    for (const x of w) {
      expect(x.tInv).toBeGreaterThanOrEqual(SCALE_PREWARM_S);
      expect(x.tInv).toBeLessThanOrEqual(2 * SCALE_PREWARM_S);
    }
    expect(mean(r.map((x) => x.tInv))).toBeGreaterThan(
      4 * mean(w.map((x) => x.tInv)),
    );
  });
  it("Instanzen: erst „startend“ (hohl), dann laufend — deterministisch auf 12", () => {
    const sim = new BottleneckSim(5, "rabatt");
    sim.runTo(100);
    sim.set({ scale: true });
    sim.runTo(100 + SCALE_DETECT_S - 1);
    expect(sim.snapshot().stations.web.instances).toMatchObject({
      running: 2,
      starting: 0,
    });
    sim.runTo(100 + SCALE_DETECT_S + 1);
    expect(sim.snapshot().stations.web.instances).toMatchObject({
      running: 2,
      starting: 10,
    });
    sim.runTo(100 + SCALE_DETECT_S + SCALE_COLD_S + 1);
    const inst = sim.snapshot().stations.web.instances;
    expect(inst).toMatchObject({ running: SCALE_TARGET, starting: 0 });
    expect(inst.warmPct).toBeLessThan(50);
  });
});

describe("Back Pressure erzeugt keine Kapazität", () => {
  it("DB-Auslastung ≈ 1 mit und ohne bpInv; Goodput steigt nur, weil weniger verloren geht", () => {
    const runs = scriptRunsMemo();
    const s1 = runs.map((r) => r[1].sum); // ohne Back Pressure: kollabiert
    const s2 = runs.map((r) => r[2].sum); // mit Back Pressure: abgefangen
    expect(mean(s1.map((s) => s.util.inv))).toBeGreaterThan(0.98);
    expect(mean(s2.map((s) => s.util.inv))).toBeGreaterThan(0.98);
    // gleiche DB-Arbeit, aber vorher zu spät (verschwendet), jetzt rechtzeitig
    expect(mean(s1.map((s) => s.okBrowse))).toBeLessThan(1);
    expect(mean(s1.map((s) => s.waste))).toBeGreaterThan(250);
    expect(mean(s2.map((s) => s.waste))).toBeLessThan(5);
    for (const s of s2)
      expect(s.okBrowse).toBeLessThanOrEqual(INV_PAGES_PER_S * 1.06);
  });
  it("der Stau sitzt mit bpInv in der begrenzten Eingangs-Queue, nicht in der DB", () => {
    for (const run of scriptRunsMemo().slice(0, 10)) {
      expect(run[1].snap.stations.inv.wait).toBeGreaterThan(5);
      expect(run[2].snap.stations.inv.wait).toBeLessThan(0.15);
      expect(run[2].snap.stations.web.wait).toBeLessThanOrEqual(0.55);
      expect(run[2].snap.stations.web.queueMax).not.toBeNull();
      expect(run[2].snap.stations.inv.throttling).toBe(true);
    }
  });
  it(
    "Stufe 5: 12 vs. 20 Webserver liefern dieselben Bestellungen/s",
    SLOW,
    () => {
      SEEDS50.slice(0, 4).forEach((seed, k) => {
        const a = scriptRunsMemo()[k][5];
        const b = playScript(seed, "rabatt", { overrides: { scaleTarget: 20 } })
          .steps[5]!;
        expect(b.snap.stations.web.instances.running).toBe(20);
        expect(b.bottleneck).toBe("pay");
        expect(Math.abs(b.sum.okCheckout - a.sum.okCheckout)).toBeLessThan(0.5);
      });
    },
  );
});

describe("Konstante Last: Engpass-Wechsel in 10 min (20 Seeds)", () => {
  it("Nachbar zufällig: deutlich mehr Wechsel als Nur Zufall", SLOW, () => {
    const nb = avg(sweep("nachbar"), (s) => s.shifts);
    const zu = avg(sweep("zufall"), (s) => s.shifts);
    expect(nb).toBeGreaterThan(6);
    expect(nb).toBeGreaterThan(2.5 * zu);
    for (const r of sweep("nachbar"))
      expect(r.sum.shifts).toBeGreaterThanOrEqual(4);
  });
  it(
    "Nur Zufall: Wechsel > 0 ganz ohne Auslöser, Engpass-Zeit ≈ 10–20 %",
    SLOW,
    () => {
      const runs = sweep("zufall");
      expect(avg(runs, (s) => s.shifts)).toBeGreaterThan(1.2);
      expect(avg(runs, (s) => s.engpassZeit)).toBeGreaterThan(0.1);
      expect(avg(runs, (s) => s.engpassZeit)).toBeLessThan(0.2);
      // beide Stationen tragen bei (sonst gäbe es nichts zu wechseln)
      expect(avg(runs, (s) => s.overShare.web)).toBeGreaterThan(0.03);
      expect(avg(runs, (s) => s.overShare.inv)).toBeGreaterThan(0.03);
      expect(avg(runs, (s) => s.strikes)).toBe(0);
    },
  );
  it(
    "Hysterese 3 %: die knappste Station wechselt bei Nur Zufall ≈ 9-mal in 10 min, nicht ≈ 17-mal (Flattern)",
    SLOW,
    () => {
      // Band trennt HYST = 0 (≈ 16,6), 1 % (≈ 11,9) und 10 % (≈ 3,8) von 3 %
      const k = avg(sweep("zufall"), (s) => s.knappShifts);
      expect(k).toBeGreaterThan(7);
      expect(k).toBeLessThan(11);
    },
  );
  it(
    "Murphy: jeder Schlag nach dem ersten verschiebt den Engpass",
    SLOW,
    () => {
      let strikes = 0;
      for (const { sim } of sweep("nachbar", { nb: "murphy" })) {
        const done = sim.strikeLog.filter(
          (s: any) => s.t1 + NB_HIT_GRACE_S <= sim.t,
        );
        expect(done.length).toBeGreaterThanOrEqual(6);
        for (const s of done.slice(1)) expect(s.hit).toBe(true);
        strikes += done.length;
      }
      expect(strikes).toBeGreaterThan(120);
      // Murphy schlägt immer die ANDERE Station: Ziele wechseln sich ab
      const { sim } = sweep("nachbar", { nb: "murphy" })[0];
      const targets = sim.strikeLog.map((s: any) => s.target);
      for (let i = 1; i < targets.length; i++)
        expect(targets[i]).not.toBe(targets[i - 1]);
    },
  );
  it.each([
    ["nachbar", SEEDS20],
    ["zufall", SEEDS50.slice(0, 5)],
  ] as const)(
    "Murphy (%s): jeder Schlag beginnt nach Erholung, trifft die andere Station, im Tief oder nach 90 s",
    SLOW,
    (scenario, seeds) => {
      expect(MURPHY_LOW_Z).toBe(MURPHY_LOW);
      const bad: string[] = [];
      let n = 0;
      let fallbacks = 0;
      for (const { sim, starts } of sweep(scenario, { nb: "murphy" }, [
        ...seeds,
      ])) {
        for (const s of starts as StrikeObs[]) {
          n++;
          const why: string[] = [];
          if (s.prevBn !== null)
            why.push(`Engpass ${s.prevBn} im Schritt davor`);
          if (s.prevLast !== null && s.target === s.prevLast)
            why.push(`Ziel = letzte Engpass-Station ${s.target}`);
          if (s.waited < MURPHY_GAP_S - 1e-9) why.push(`Abstand ${s.waited}`);
          const low = s.z <= MURPHY_LOW;
          if (!low && s.waited < MURPHY_MAX_WAIT_S - 1e-9)
            why.push(`kein Tief (z = ${s.z.toFixed(2)}) nach ${s.waited} s`);
          if (s.fallback !== !low) why.push("fallback-Flag falsch");
          if (why.length) bad.push(`t=${s.t0}: ${why.join(", ")}`);
          if (s.fallback) fallbacks++;
        }
        expect(sim.stats.murphyFallbacks).toBe(
          (starts as StrikeObs[]).filter((s) => s.fallback).length,
        );
      }
      expect(bad).toEqual([]);
      expect(n).toBeGreaterThan(5 * seeds.length);
      // der Fallback ist die Ausnahme, nicht die Regel
      expect(fallbacks).toBeLessThan(0.2 * n);
    },
  );
  it(
    "Nur Zufall + Schutzkapazität an den Nicht-Engpässen ⇒ ≈ 0 Wechsel (Lawrence & Buss)",
    SLOW,
    () => {
      const runs = sweep("zufall", { headroom: true });
      expect(avg(runs, (s) => s.shifts)).toBeLessThan(0.2);
      expect(avg(runs, (s) => s.overShare.web)).toBe(0);
      // die DB wird zum festen, vorhersagbaren Engpass
      expect(avg(runs, (s) => s.knappShare.inv)).toBeGreaterThan(0.9);
      expect(avg(runs, (s) => s.knappShifts)).toBeLessThan(
        0.4 * avg(sweep("zufall"), (s) => s.knappShifts),
      );
    },
  );
  it(
    "Nur Zufall + 20 % überall ⇒ Überlast verschwindet, die knappste Station wandert weiter",
    SLOW,
    () => {
      const base = avg(sweep("zufall"), (s) => s.knappShifts);
      const all = sweep("zufall", { headroomAll: true });
      // Reserve überall hebt das Niveau, ändert die Reihenfolge nicht
      expect(avg(all, (s) => s.knappShifts)).toBeGreaterThan(0.8 * base);
      expect(avg(all, (s) => s.knappShifts)).toBeLessThan(1.25 * base);
      expect(avg(all, (s) => s.engpassZeit)).toBeLessThan(0.01);
      expect(avg(all, (s) => s.shifts)).toBeLessThan(0.2);
    },
  );
  it(
    "gegen den Nachbarn: Schutzkapazität senkt die Web-Überlastzeit, nicht die Wechsel",
    SLOW,
    () => {
      const base = sweep("nachbar");
      const hr = sweep("nachbar", { headroom: true });
      expect(avg(hr, (s) => s.overShare.web)).toBeLessThan(
        0.65 * avg(base, (s) => s.overShare.web),
      );
      expect(avg(hr, (s) => s.shifts)).toBeGreaterThan(
        0.8 * avg(base, (s) => s.shifts),
      );
    },
  );
  it("Eigener Host beseitigt die nachbargetriebenen Wechsel", SLOW, () => {
    const iso = sweep("nachbar", { isolate: true }, SEEDS10);
    const off = sweep("nachbar", { nb: "aus" }, SEEDS10);
    // Isolation = Nachbar ohne Wirkung: bitgleich zum Lauf ohne Nachbarn
    iso.forEach((r, k) => expect(r.sum.shifts).toBe(off[k].sum.shifts));
    expect(avg(iso, (s) => s.shifts)).toBeLessThan(0.3);
    expect(avg(iso, (s) => s.shiftsInStrike)).toBe(0);
    expect(avg(iso, (s) => s.strikes)).toBeGreaterThan(5); // der Nachbar läuft weiter
    // ohne Isolation fallen praktisch alle Wechsel in einen Nachbar-Schub
    const nb = sweep("nachbar");
    expect(avg(nb, (s) => s.shiftsInStrike)).toBeGreaterThan(
      0.9 * avg(nb, (s) => s.shifts),
    );
  });
});

describe("Startfenster: pickStartSeed (bewusste Demo-Auswahl)", () => {
  const firstWindowShifts = (scenario: "zufall" | "nachbar", seed: number) => {
    const sim = new BottleneckSim(seed, scenario);
    sim.runTo(SCENARIOS[scenario].prerollS);
    return sim.snapshot().win.shifts as number;
  };
  const counting = (k: number) => {
    const r = mulberry32(k);
    const rng = () => {
      rng.draws++;
      return r();
    };
    rng.draws = 0;
    return rng;
  };
  const firstDraw = (k: number) => Math.floor(mulberry32(k)() * 1e9) + 1;
  let pick1: number | null = null;

  it("Nur Zufall: das erste Fenster zeigt ≥ 2 Engpass-Wechsel, notfalls nach mehreren Versuchen", () => {
    // rng 4: der erste Seed zeigt ein ruhiges Fenster, erst der 4. reicht
    expect(firstWindowShifts("zufall", firstDraw(4))).toBeLessThan(
      START_MIN_SHIFTS,
    );
    const rng = counting(4);
    const seed = pickStartSeed("zufall", rng);
    expect(rng.draws).toBeGreaterThan(1);
    expect(rng.draws).toBeLessThanOrEqual(START_MAX_TRIES);
    expect(firstWindowShifts("zufall", seed)).toBeGreaterThanOrEqual(
      START_MIN_SHIFTS,
    );
    pick1 = pickStartSeed("zufall", mulberry32(1));
    expect(firstWindowShifts("zufall", pick1)).toBeGreaterThanOrEqual(
      START_MIN_SHIFTS,
    );
  });
  it("Nachbar-VM: erstes Fenster ≥ 2 Wechsel; deterministisch bei gegebenem rng", () => {
    const seed = pickStartSeed("nachbar", mulberry32(1));
    expect(firstWindowShifts("nachbar", seed)).toBeGreaterThanOrEqual(
      START_MIN_SHIFTS,
    );
    expect(pickStartSeed("zufall", mulberry32(1))).toBe(
      pick1 ?? pickStartSeed("zufall", mulberry32(1)),
    );
  });
  it("Gegenmaßnahmen-Szenario: der erste gezogene Seed, ohne Vorlauf", () => {
    const rng = counting(9);
    expect(pickStartSeed("rabatt", rng)).toBe(firstDraw(9));
    expect(rng.draws).toBe(1);
  });
  it("findet keiner genug Wechsel: nach maxTries der beste (bei Gleichstand der erste)", () => {
    const rng = counting(5);
    const seed = pickStartSeed("nachbar", rng, {
      overrides: { cm: { isolate: true } },
      maxTries: 2,
    });
    expect(rng.draws).toBe(2);
    expect(seed).toBe(firstDraw(5));
  });
});

describe("Sichtbarkeit im Gast (obs) vs. Wahrheit (hidden)", () => {
  // Proben mitten in den Phasen (≥ 10 s nach Phasenbeginn, Wirkung eingeschwungen)
  function phaseSamples() {
    const out: { cpu: any[]; io: any[]; idle: any[] } = {
      cpu: [],
      io: [],
      idle: [],
    };
    for (const seed of SEEDS50.slice(0, 3)) {
      const sim = new BottleneckSim(seed, "nachbar");
      let phase = "idle";
      let since = 0;
      for (let k = 0; k < 6000; k++) {
        sim.runSteps(1);
        if (sim.phaseNow !== phase) {
          phase = sim.phaseNow;
          since = sim.t;
        }
        if (k % 10 || sim.t - since < 10) continue;
        const s = sim.snapshot();
        if (phase === "cpu") out.cpu.push(s);
        else if (phase === "io") out.io.push(s);
        else out.idle.push(s);
      }
    }
    return out;
  }
  let samples: ReturnType<typeof phaseSamples> | null = null;
  const memo = () => (samples ??= phaseSamples());

  it("CPU-Phase: Web-Gast zeigt %steal > 20 %, die DB nichts", () => {
    const { cpu } = memo();
    expect(cpu.length).toBeGreaterThan(50);
    for (const s of cpu) {
      expect(s.hosts.web.stealPct).toBeGreaterThan(20);
      expect(s.hosts.db.awaitMs).toBeLessThan(1.3);
      expect(s.hidden).toMatchObject({
        phase: "cpu",
        target: "web",
        affects: true,
      });
    }
  });
  it("IO-Phase: Disk-await der DB deutlich höher, aber kein steal — IO-Wartezeit ist idle", () => {
    const { io, idle } = memo();
    expect(io.length).toBeGreaterThan(50);
    expect(idle.length).toBeGreaterThan(50);
    const dbSteal = (a: any[]) => mean(a.map((s) => s.hosts.db.stealPct));
    const dbAwait = (a: any[]) => mean(a.map((s) => s.hosts.db.awaitMs));
    // Kontrast: await steigt um ≥ 40 %, der DB-steal nicht (aus dem Zustand
    // gerechnet: Grundrauschen, solange die DB rechnet)
    expect(dbAwait(io)).toBeGreaterThan(1.4 * dbAwait(idle));
    expect(dbSteal(io)).toBeLessThanOrEqual(dbSteal(idle) + 0.05);
    expect(dbSteal(idle)).toBeGreaterThan(0); // die DB rechnet: Messgröße lebt
    for (const s of io) {
      expect(s.hosts.db.awaitMs).toBeGreaterThan(1.6);
      expect(s.hosts.db.stealPct).toBeLessThan(1);
      expect(s.hosts.web.stealPct).toBeLessThan(2);
      expect(s.hidden).toMatchObject({ phase: "io", target: "inv" });
    }
  });
  it("Eigener Host: der Nachbar läuft weiter (hidden), der Gast sieht nichts mehr", () => {
    const sim = new BottleneckSim(SEEDS50[0]!, "nachbar", {
      cm: { isolate: true },
    });
    let seen = 0;
    for (let k = 0; k < 3000; k++) {
      sim.runSteps(1);
      const s = sim.snapshot();
      if (s.hidden.phase !== "idle") seen++;
      expect(s.hidden.affects).toBe(false);
      expect(s.hosts.web.stealPct).toBeLessThan(1);
      expect(s.hosts.db.awaitMs).toBeLessThan(1.21);
    }
    expect(seen).toBeGreaterThan(100);
  });
  it("Eigener Host mitten im Schub an und wieder aus: der Schub wirkt wieder und zählt wieder", () => {
    const sim = new BottleneckSim(SEEDS50[0]!, "nachbar");
    while (!(sim.phaseNow === "cpu" && sim.t - sim.curStrike!.t0 >= 3))
      sim.runSteps(1);
    const strike = sim.curStrike!; // CPU-Phase im Modus „zufall“ ⇒ Schub läuft
    expect(strike.affects).toBe(true);
    sim.set({ isolate: true });
    expect(strike.affects).toBe(false);
    sim.runTo(sim.t + 5);
    expect(sim.snapshot().hidden.affects).toBe(false);
    expect(sim.snapshot().hosts.web.stealPct).toBeLessThan(20);
    sim.set({ isolate: false });
    expect(strike.affects).toBe(true); // dieser Schub zählt wieder als „im Schub“
    expect(sim.curStrike).toBe(strike);
    sim.runTo(sim.t + 10);
    expect(sim.phaseNow).toBe("cpu");
    expect(sim.snapshot().hidden.affects).toBe(true);
    expect(sim.snapshot().hosts.web.stealPct).toBeGreaterThan(20);
  });
});
